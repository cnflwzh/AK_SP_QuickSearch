/** 策略人数门槛只说明确定的技能变化，不将召唤数量换算为伤害分数。 */
import { OPERATOR } from '../../../../data/index.ts';
import type { PlanOp } from '../../plans/model.ts';
import type { AdvisorFormat } from './advisorRules.ts';
interface StrategyContext {
  strategy: string;
  format: AdvisorFormat;
  inactiveCovenants: ReadonlySet<string>;
}
interface StrategyTransition {
  reasons: string[];
  losses: string[];
}
/** V3_1 望明确要求在场不同炎干员；不用含调和虚拟人数的盟约统计替代。 */
function wangSummonCount(field: readonly PlanOp[]): number {
  const yanOperators = field.filter((slot) =>
    OPERATOR[slot.name]?.covenants.includes('炎'),
  );
  const distinctOperatorCount = new Set(yanOperators.map((slot) => slot.name))
    .size;
  if (distinctOperatorCount >= 9) {
    return 2;
  }
  if (distinctOperatorCount >= 6) {
    return 1;
  }
  return 0;
}
/** 只说明已验证的召唤门槛变化；不推算伤害、附加盟约或极速模式效果。 */
export function explainStrategyTransition(
  before: readonly PlanOp[],
  after: readonly PlanOp[],
  context: StrategyContext,
): StrategyTransition {
  if (
    context.strategy !== '望' ||
    context.format === 'fast' ||
    context.inactiveCovenants.has('炎')
  ) {
    return { reasons: [], losses: [] };
  }
  const previousSummonCount = wangSummonCount(before);
  const nextSummonCount = wangSummonCount(after);
  if (previousSummonCount === nextSummonCount) {
    return { reasons: [], losses: [] };
  }
  if (nextSummonCount > previousSummonCount) {
    const reason =
      nextSummonCount === 1
        ? '望：已录6名不同原生炎在场，满足黑白相易改为开战召唤1只炎佑的条件；未估算召唤伤害'
        : '望：已录9名不同原生炎在场，满足开战召唤2只炎佑的条件；未估算召唤伤害';
    return { reasons: [reason], losses: [] };
  }
  const loss =
    nextSummonCount === 0
      ? '望：已录原生炎在场不足6名，无法确认仍满足召唤条件；附加盟约是否计入尚未核实'
      : '望：已录原生炎在场不足9名，无法确认仍满足召唤2只的条件；附加盟约是否计入尚未核实';
  return { reasons: [], losses: [loss] };
}
