/** 策略人数门槛只说明确定的技能变化，不将召唤数量换算为伤害分数。 */
import {
  OPERATOR,
  STRATEGY,
  type StrategyCovenantThresholdTier,
} from '../../../../data/index.ts';
import type {PlanOp} from '../../plans/model.ts';
import type {AdvisorFormat} from './advisorRules.ts';
interface StrategyContext {
  strategy: string;
  format: AdvisorFormat;
  inactiveCovenants: ReadonlySet<string>;
}
interface StrategyTransition {
  reasons: string[];
  losses: string[];
}
function highestTierIndex(
  field: readonly PlanOp[],
  covenant: string,
  tiers: readonly StrategyCovenantThresholdTier[],
): number {
  const distinctCount = new Set(
    field
      .filter((slot) => OPERATOR[slot.name]?.covenants.includes(covenant))
      .map((slot) => slot.name),
  ).size;
  let reached = -1;
  for (let i = 0; i < tiers.length; i++) {
    if (distinctCount >= tiers[i].count) {
      reached = i;
    }
  }
  return reached;
}
/** 只说明已验证的策略门槛变化；不推算伤害、附加盟约或被忽略赛制的效果。 */
export function explainStrategyTransition(
  before: readonly PlanOp[],
  after: readonly PlanOp[],
  context: StrategyContext,
): StrategyTransition {
  const rule = Object.hasOwn(STRATEGY, context.strategy)
    ? STRATEGY[context.strategy].advisor?.deployedCovenantThresholds
    : undefined;
  if (
    !rule ||
    (rule.ignoreInFastFormat && context.format === 'fast') ||
    context.inactiveCovenants.has(rule.covenant)
  ) {
    return {reasons: [], losses: []};
  }
  const tiers = [...rule.tiers].sort((a, b) => a.count - b.count);
  const previousTier = highestTierIndex(before, rule.covenant, tiers);
  const nextTier = highestTierIndex(after, rule.covenant, tiers);
  if (previousTier === nextTier) {
    return {reasons: [], losses: []};
  }
  if (nextTier > previousTier) {
    return {reasons: [tiers[nextTier].gainReason], losses: []};
  }
  return {reasons: [], losses: [tiers[nextTier + 1].lossReason]};
}
