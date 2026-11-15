/** 已保存方案的路线偏好；只用于相同规则收益的排序，不模拟伤害或把目标阵容当作已持有。 */
import { OPERATOR, STRATEGY, isCoreCovenant } from '../../data/index.ts';
import {
  builtinPlan,
  inferPrimaryCovenant,
  MAX_OPS,
  samePlan,
  type Plan,
  type PlanOp,
} from './planner.ts';
/** 调用方提供真实阵容和招募限制；不依赖页面选择、本局预设或浏览器存储。 */
export interface AdvisorPreferenceContext {
  field: readonly PlanOp[];
  reserve: readonly PlanOp[];
  mainCovenant: string;
  strategy: string;
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
interface TargetSlot {
  readonly name: string;
  readonly alternatives: readonly string[];
  readonly core: boolean;
}
interface AnchoredRoute {
  readonly name: string;
  readonly slots: readonly TargetSlot[];
  readonly baselineScore: number;
}
// 最多 8 个位置，每个位置最多 4 点偏好；位置数量必须优先于主选/核心/上场质量。
const POSITION_WEIGHT = MAX_OPS * 4 + 1;
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
/** 不匹配返回 null；分值只表示位置偏好，不代表干员战力。 */
function slotMatchScore(slot: TargetSlot, name: string, deployed: boolean): number | null {
  const isPrimary = slot.name === name;
  if (!isPrimary && !slot.alternatives.includes(name)) {
    return null;
  }
  return POSITION_WEIGHT + (isPrimary ? 2 : 1) + Number(slot.core) + Number(deployed);
}
/** 从上一轮状态扩展一次，防止同一个干员在本轮被重复分配给多个位置。 */
function assignOperatorToSlots(
  previousScores: ReadonlyMap<number, number>,
  slots: readonly TargetSlot[],
  name: string,
  deployed: boolean,
): Map<number, number> {
  // 保留不分配这个干员的选择。mask 的每一位表示对应目标位置是否已被占用。
  const nextScores = new Map(previousScores);
  for (const [occupiedSlots, score] of previousScores) {
    for (const [index, slot] of slots.entries()) {
      const slotBit = 1 << index;
      if (occupiedSlots & slotBit) {
        continue;
      }
      const matchScore = slotMatchScore(slot, name, deployed);
      if (matchScore === null) {
        continue;
      }
      const nextOccupiedSlots = occupiedSlots | slotBit;
      const previousBest = nextScores.get(nextOccupiedSlots) ?? 0;
      nextScores.set(nextOccupiedSlots, Math.max(previousBest, score + matchScore));
    }
  }
  return nextScores;
}
/** 一个已持有干员最多填一个目标位置，同位置主选和备选也只能填一次。 */
function matchRoute(
  slots: readonly TargetSlot[],
  field: readonly PlanOp[],
  reserve: readonly PlanOp[],
): number {
  const deployedNames = new Set(field.map((slot) => slot.name));
  const ownedNames = new Set([...field, ...reserve].map((slot) => slot.name));
  let assignmentScores = new Map<number, number>([[0, 0]]);
  for (const name of ownedNames) {
    assignmentScores = assignOperatorToSlots(
      assignmentScores,
      slots,
      name,
      deployedNames.has(name),
    );
  }
  return Math.max(...assignmentScores.values());
}
function availableTargetSlots(plan: Plan, unavailableNames?: ReadonlySet<string>): TargetSlot[] {
  const isAvailable = (name: string): boolean => !!OPERATOR[name] && !unavailableNames?.has(name);
  const seenPrimaryNames = new Set<string>();
  const targetSlots: TargetSlot[] = [];
  for (const slot of plan.ops.slice(0, MAX_OPS)) {
    if (seenPrimaryNames.has(slot.name)) {
      continue;
    }
    seenPrimaryNames.add(slot.name);
    const alternatives = [...new Set(slot.alt.filter(isAvailable))].filter(
      (name) => name !== slot.name,
    );
    const primaryAvailable = isAvailable(slot.name);
    if (!primaryAvailable && !alternatives.length) {
      continue;
    }
    targetSlots.push({ name: primaryAvailable ? slot.name : '', alternatives, core: slot.core });
  }
  return targetSlots;
}
function prepareRoute(plan: Plan, context: AdvisorPreferenceContext): AnchoredRoute | null {
  if (!plan.ops.length) {
    return null;
  }
  const builtin = plan.base ? builtinPlan(plan.base) : null;
  // 仅点开内置编辑器会生成一份临时副本，不把它当成用户保存的偏好。
  if (builtin && samePlan(plan, builtin)) {
    return null;
  }
  const primaryCovenant = inferPrimaryCovenant(plan.ops);
  const explicitMainCovenant = context.mainCovenant && context.mainCovenant !== 'mixed';
  if (explicitMainCovenant && primaryCovenant && context.mainCovenant !== primaryCovenant) {
    return null;
  }
  if (strategyConflicts(context.strategy, plan.strategy)) {
    return null;
  }
  const slots = availableTargetSlots(plan, context.unavailableNames);
  const baselineScore = matchRoute(slots, context.field, context.reserve);
  if (baselineScore === 0) {
    return null;
  }
  return { name: plan.name, slots, baselineScore };
}
function evaluateAnchoredRoutes(
  routes: readonly AnchoredRoute[],
  field: readonly PlanOp[],
  reserve: readonly PlanOp[],
): AdvisorPreferenceEvaluation {
  if (!routes.length) {
    return { preference: 0, matchedPlans: [], reasons: [], losses: [] };
  }
  const routeChanges = routes.map((route) => ({
    name: route.name,
    delta: matchRoute(route.slots, field, reserve) - route.baselineScore,
  }));
  const preference = Math.max(...routeChanges.map((change) => change.delta));
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
  const candidateRoutes = plans
    .map((plan) => prepareRoute(plan, context))
    .filter((route): route is AnchoredRoute => route !== null);
  const bestBaselineScore = Math.max(0, ...candidateRoutes.map((route) => route.baselineScore));
  const anchoredRoutes = candidateRoutes.filter(
    (route) => route.baselineScore === bestBaselineScore,
  );
  return (field, reserve = []) => evaluateAnchoredRoutes(anchoredRoutes, field, reserve);
}
