/** 已保存方案的路线偏好；只用于相同规则收益的排序，不模拟伤害或把目标阵容当作已持有。 */
import {OPERATOR, STRATEGY, isCoreCovenant} from '../../../../data/index.ts';
import {
  MAX_OPS,
  builtinPlan,
  samePlan,
  type Plan,
  type PlanOp,
} from '../../plans/model.ts';
import {inferPrimaryCovenant} from '../planning.ts';
/** 调用方提供真实阵容和招募限制；不依赖页面选择、本局预设或浏览器存储。 */
export interface AdvisorPreferenceContext {
  field: readonly PlanOp[];
  reserve: readonly PlanOp[];
  mainCovenant: string;
  strategy: string;
  /** 命中闭区间时参考该阶段，没有指定回合或未规划该回合时参考终盘。 */
  round?: number | null;
  unavailableNames?: ReadonlySet<string>;
}
/** preference 是路线进度的相对变化，不能加入游戏收益、伤害或胜率分数。 */
export interface AdvisorPreferenceEvaluation {
  preference: number;
  matchedPlans: string[];
  reasons: string[];
  losses: string[];
}
/** 评价行动后的阵容；路线锚点固定在创建 evaluator 时的真实持有记录。 */
export type AdvisorPreferenceEvaluator = (
  field: readonly PlanOp[],
  reserve?: readonly PlanOp[],
) => AdvisorPreferenceEvaluation;
/** 各合法主选/备选填入同一位置的偏好分，上场额外加一分。 */
type TargetSlot = ReadonlyMap<string, number>;
interface AnchoredRoute {
  readonly name: string;
  readonly slots: readonly TargetSlot[];
  readonly baselineScore: number;
}
function strategyConflicts(actual: string, target: string): boolean {
  if (!actual || !target || actual === target) {
    return false;
  }
  const currentStrategy = STRATEGY[actual];
  const targetStrategy = STRATEGY[target];
  if (!currentStrategy || !targetStrategy) {
    return true;
  }
  // 同主盟约的不同领袖不视为冲突；其他不同策略不擅自当成可互换。
  return (
    !isCoreCovenant(currentStrategy.category) ||
    currentStrategy.category !== targetStrategy.category
  );
}
/** 匈牙利算法求最大权分配。行是目标位置，列是持有的干员；零分边可留空。
 * 以负偏好为费用逐行增广，每行可重排前面已分配的干员，复杂度 O(行数² × 列数)。 */
function assignmentScore(
  weights: readonly number[][],
  columnCount: number,
): number {
  const rowPotential = new Int32Array(weights.length + 1);
  const columnPotential = new Int32Array(columnCount + 1);
  const assignedRow = new Int32Array(columnCount + 1);
  const previousColumn = new Int32Array(columnCount + 1);
  for (let row = 1; row <= weights.length; row++) {
    // 第 0 列是本轮待分配位置的起点。首次遇到空列时，沿路径轮换已有分配。
    assignedRow[0] = row;
    let column = 0;
    const visited = new Uint8Array(columnCount + 1);
    const slack = new Float64Array(columnCount + 1).fill(Infinity);
    do {
      visited[column] = 1;
      const currentRow = assignedRow[column];
      let delta = Infinity;
      let nextColumn = 0;
      for (let col = 1; col <= columnCount; col++) {
        if (visited[col]) continue;
        const cost = -(weights[currentRow - 1][col - 1] ?? 0);
        const reduced = cost - rowPotential[currentRow] - columnPotential[col];
        if (reduced < slack[col]) {
          slack[col] = reduced;
          previousColumn[col] = column;
        }
        if (slack[col] < delta) {
          delta = slack[col];
          nextColumn = col;
        }
      }
      for (let col = 0; col <= columnCount; col++) {
        if (visited[col]) {
          rowPotential[assignedRow[col]] += delta;
          columnPotential[col] -= delta;
        } else {
          slack[col] -= delta;
        }
      }
      column = nextColumn;
    } while (assignedRow[column]);
    do {
      const previous = previousColumn[column];
      assignedRow[column] = assignedRow[previous];
      column = previous;
    } while (column);
  }
  let score = 0;
  for (let col = 1; col <= columnCount; col++) {
    if (assignedRow[col]) score += weights[assignedRow[col] - 1][col - 1] ?? 0;
  }
  return score;
}

/** 一个已持有干员最多填一个目标位置，只让持有记录和路线的交集参与分配。 */
function matchRoute(
  slots: readonly TargetSlot[],
  field: readonly PlanOp[],
  reserve: readonly PlanOp[],
): number {
  const deployedNames = new Set(field.map((slot) => slot.name));
  const reserveNames = new Set(reserve.map((slot) => slot.name));
  const columns = new Map<string, number>();
  const weights: number[][] = [];
  for (const slot of slots) {
    const row: number[] = [];
    for (const [name, score] of slot) {
      const deployed = deployedNames.has(name);
      if (!deployed && !reserveNames.has(name)) continue;
      const column = columns.get(name) ?? columns.size;
      columns.set(name, column);
      row[column] = score + Number(deployed);
    }
    if (row.length) weights.push(row);
  }
  return assignmentScore(weights, Math.max(weights.length, columns.size));
}
function availableTargetSlots(
  ops: readonly PlanOp[],
  positionWeight: number,
  unavailableNames?: ReadonlySet<string>,
): TargetSlot[] {
  const isAvailable = (name: string): boolean =>
    !!OPERATOR[name] && !unavailableNames?.has(name);
  const seenPrimaryNames = new Set<string>();
  const targetSlots: TargetSlot[] = [];
  for (const slot of ops.slice(0, MAX_OPS)) {
    if (seenPrimaryNames.has(slot.name)) {
      continue;
    }
    seenPrimaryNames.add(slot.name);
    const scores = new Map<string, number>();
    const base = positionWeight + Number(slot.core);
    for (const name of slot.alt) {
      if (isAvailable(name)) scores.set(name, base + 1);
    }
    if (isAvailable(slot.name)) scores.set(slot.name, base + 2);
    if (scores.size) targetSlots.push(scores);
  }
  return targetSlots;
}
function prepareRoute(
  plan: Plan,
  lineup: Pick<Plan, 'ops' | 'layers'>,
  context: AdvisorPreferenceContext,
  positionWeight: number,
): AnchoredRoute | null {
  if (!lineup.ops.length) {
    return null;
  }
  const builtin = plan.base ? builtinPlan(plan.base) : null;
  // 仅点开内置编辑器会生成一份临时副本，不把它当成用户保存的偏好。
  if (builtin && samePlan(plan, builtin)) {
    return null;
  }
  const primaryCovenant = inferPrimaryCovenant(lineup.ops, lineup.layers);
  const explicitMainCovenant =
    context.mainCovenant && context.mainCovenant !== 'mixed';
  if (
    explicitMainCovenant &&
    primaryCovenant &&
    context.mainCovenant !== primaryCovenant
  ) {
    return null;
  }
  const strategies = [plan.strategy, ...(plan.strategyAlternates ?? [])];
  if (
    strategies.every((target) => strategyConflicts(context.strategy, target))
  ) {
    return null;
  }
  const slots = availableTargetSlots(
    lineup.ops,
    positionWeight,
    context.unavailableNames,
  );
  const baselineScore = matchRoute(slots, context.field, context.reserve);
  if (baselineScore === 0) {
    return null;
  }
  return {name: plan.name, slots, baselineScore};
}
function evaluateAnchoredRoutes(
  routes: readonly AnchoredRoute[],
  field: readonly PlanOp[],
  reserve: readonly PlanOp[],
): AdvisorPreferenceEvaluation {
  if (!routes.length) {
    return {preference: 0, matchedPlans: [], reasons: [], losses: []};
  }
  const routeChanges = routes.map((route) => ({
    name: route.name,
    delta: matchRoute(route.slots, field, reserve) - route.baselineScore,
  }));
  const preference = routeChanges.reduce(
    (best, change) => Math.max(best, change.delta),
    -Infinity,
  );
  const bestRouteNames = routeChanges
    .filter((change) => change.delta === preference)
    .map((change) => change.name);
  const matchedPlans = [...new Set(bestRouteNames)].sort();
  const label = matchedPlans.slice(0, 2).join('、');
  return {
    preference,
    matchedPlans,
    reasons: preference > 0 ? [`更接近已保存方案「${label}」`] : [],
    losses: preference < 0 ? [`偏离已保存方案「${label}」的上场目标`] : [],
  };
}
/**
 * 只传入真实保存的 plans，不传全量内置预设列表。
 * 路线先由行动前持有记录锚定，保留最佳并列；候选不能自证一条原先不匹配的路线。
 * 多条路线取最大进度变化而不累加，因此复制方案或调整列表顺序不会增强偏好。
 */
export function createAdvisorPreferenceEvaluator(
  plans: readonly Plan[],
  context: AdvisorPreferenceContext,
): AdvisorPreferenceEvaluator {
  const round = context.round;
  const targets = plans.map((plan) => ({
    plan,
    lineup:
      round == null
        ? plan
        : (plan.stages?.find(({from, to}) => from <= round && round <= to) ??
          plan),
  }));
  // 跨路线必须用相同权重，匹配位置数优先于每位最多 4 分的质量分。旧八人方案沿用原分值。
  const maxPositions = targets.reduce(
    (count, {lineup}) => Math.max(count, Math.min(lineup.ops.length, MAX_OPS)),
    8,
  );
  const positionWeight = maxPositions * 4 + 1;
  const candidateRoutes = targets
    .map(({plan, lineup}) =>
      prepareRoute(plan, lineup, context, positionWeight),
    )
    .filter((route): route is AnchoredRoute => route !== null);
  const bestBaselineScore = candidateRoutes.reduce(
    (best, route) => Math.max(best, route.baselineScore),
    0,
  );
  const anchoredRoutes = candidateRoutes.filter(
    (route) => route.baselineScore === bestBaselineScore,
  );
  return (field, reserve = []) =>
    evaluateAnchoredRoutes(anchoredRoutes, field, reserve);
}
