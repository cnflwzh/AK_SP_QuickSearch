import { LAYER_BREAKPOINTS } from '../../data/numberTools.ts';
import type { CovenantStat } from './planner.ts';
import type { ValueContext } from './advisorValueTypes.ts';
/** 启发式门槛权重，既不是层数，也不是伤害加成。 */
export const LAYER_MILESTONE_SCORE = 24;
const MAX_SCORED_LAYER_GAIN = 24;
const ACTIVE_LAYER_SCORE = 2;
const INACTIVE_LAYER_SCORE = 0.25;
const MAX_PRODUCTION_HORIZON = 4;
/** 复用层数工具的完整规则表；未激活或未录层数时不假定跨档。 */
export function crossedLayerMilestones(
  covenant: string,
  amount: number,
  stats: readonly CovenantStat[],
  context: ValueContext,
): number[] {
  const active = stats.some((stat) => stat.name === covenant && stat.active);
  if (!active || !Object.hasOwn(context.layers, covenant)) {
    return [];
  }
  const current = context.layers[covenant];
  return (LAYER_BREAKPOINTS[covenant] ?? [])
    .filter((item) => current < item.layers && current + amount >= item.layers)
    .map((item) => item.layers);
}
/** 永久层未激活时只留少量未来价值；临时层调用者需自行排除未激活盟约。 */
export function layerValue(
  covenant: string,
  amount: number,
  stats: readonly CovenantStat[],
  context: ValueContext,
  includeMilestone = true,
): number {
  const stat = stats.find((stat) => stat.name === covenant);
  if (!stat?.active) {
    return INACTIVE_LAYER_SCORE * amount;
  }
  const milestones = includeMilestone
    ? crossedLayerMilestones(covenant, amount, stats, context).length
    : 0;
  return (
    Math.min(amount, MAX_SCORED_LAYER_GAIN) * ACTIVE_LAYER_SCORE +
    milestones * LAYER_MILESTONE_SCORE
  );
}
/** 限制预支未来价值：未指定局长只计本次，未知回合采用两次有限展望。 */
export function productionHorizon(context: ValueContext): number {
  if (context.totalRounds == null) {
    return 1;
  }
  if (context.round === null) {
    return 2;
  }
  return Math.min(MAX_PRODUCTION_HORIZON, Math.max(1, context.totalRounds - context.round + 1));
}
