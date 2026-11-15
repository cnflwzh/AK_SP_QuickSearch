/** 已保存方案的路线偏好；只用于相同规则收益的排序，不模拟伤害或把目标阵容当作已持有。 */
import { OPERATOR, STRATEGY, isCoreCovenant } from '../../data/index.ts';
import { builtinPlan, inferPrimaryCovenant, MAX_OPS, samePlan, type Plan, type PlanOp } from './planner.ts';

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

interface TargetSlot { name: string; alternatives: readonly string[]; core: boolean }
interface Route { name: string; slots: readonly TargetSlot[]; before: number }
// 最多 8 个位置，每个位置最多 4 点偏好；优先匹配更多不同位置，再比较主选/核心/上场。
const POSITION_WEIGHT = MAX_OPS * 4 + 1;

function strategyConflicts(actual: string, target: string): boolean {
  if (!actual || !target || actual === target) return false;
  const current = STRATEGY[actual], planned = STRATEGY[target];
  // 同主盟约的不同领袖不视为冲突；其他不同策略不擅自当成可互换。
  return !current || !planned || !isCoreCovenant(current.category) || current.category !== planned.category;
}

/** 一个已持有干员最多填一个目标位置，同位置主选和备选也只能填一次。 */
function matchRoute(slots: readonly TargetSlot[], field: readonly PlanOp[], reserve: readonly PlanOp[]): number {
  const deployed = new Set(field.map(slot => slot.name));
  const names = [...new Set([...field, ...reserve].map(slot => slot.name))];
  let states = new Map<number, number>([[0, 0]]);
  for (const name of names) {
    const next = new Map(states);
    for (const [mask, score] of states) {
      slots.forEach((slot, index) => {
        if (mask & (1 << index)) return;
        const primary = slot.name === name;
        if (!primary && !slot.alternatives.includes(name)) return;
        const value = POSITION_WEIGHT + (primary ? 2 : 1) + Number(slot.core) + Number(deployed.has(name));
        const nextMask = mask | (1 << index);
        next.set(nextMask, Math.max(next.get(nextMask) ?? 0, score + value));
      });
    }
    states = next;
  }
  return Math.max(...states.values());
}

function prepareRoute(plan: Plan, context: AdvisorPreferenceContext): Route | null {
  if (!plan.ops.length) return null;
  const builtin = plan.base ? builtinPlan(plan.base) : null;
  // 仅点开内置编辑器会生成一份临时副本，不把它当成用户保存的偏好。
  if (builtin && samePlan(plan, builtin)) return null;
  const primary = inferPrimaryCovenant(plan.ops);
  if (context.mainCovenant && context.mainCovenant !== 'mixed' && primary && context.mainCovenant !== primary) return null;
  if (strategyConflicts(context.strategy, plan.strategy)) return null;
  const available = (name: string): boolean => !!OPERATOR[name] && !context.unavailableNames?.has(name);
  const seen = new Set<string>();
  const slots: TargetSlot[] = [];
  for (const slot of plan.ops.slice(0, MAX_OPS)) {
    if (seen.has(slot.name)) continue;
    seen.add(slot.name);
    const alternatives = [...new Set(slot.alt.filter(available))].filter(name => name !== slot.name);
    if (!available(slot.name) && !alternatives.length) continue;
    slots.push({ name: available(slot.name) ? slot.name : '', alternatives, core: slot.core });
  }
  const before = matchRoute(slots, context.field, context.reserve);
  return before > 0 ? { name: plan.name, slots, before } : null;
}

/**
 * 只传入真实保存的 plans，不传全量内置预设列表。
 * 路线先由行动前持有记录锚定，保留最佳并列；候选不能自证一条原先不匹配的路线。
 * 多条路线取最大进度变化而不累加，因此复制方案或调整列表顺序不会增强偏好。
 */
export function createAdvisorPreferenceEvaluator(plans: readonly Plan[], context: AdvisorPreferenceContext):
  (field: readonly PlanOp[], reserve?: readonly PlanOp[]) => AdvisorPreferenceEvaluation {
  const candidates = plans.map(plan => prepareRoute(plan, context)).filter((route): route is Route => route !== null);
  const best = Math.max(0, ...candidates.map(route => route.before));
  const routes = candidates.filter(route => route.before === best);
  return (field, reserve = []) => {
    if (!routes.length) return { preference: 0, matchedPlans: [], reasons: [], losses: [] };
    const changes = routes.map(route => ({ route, delta: matchRoute(route.slots, field, reserve) - route.before }));
    const preference = Math.max(...changes.map(change => change.delta));
    const matchedPlans = [...new Set(changes.filter(change => change.delta === preference).map(change => change.route.name))].sort();
    const label = matchedPlans.slice(0, 2).join('、');
    return {
      preference, matchedPlans,
      reasons: preference > 0 ? [`更接近已保存方案「${label}」`] : [],
      losses: preference < 0 ? [`偏离已保存方案「${label}」的上场目标`] : [],
    };
  };
}
