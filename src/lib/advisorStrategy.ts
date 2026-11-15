/** 策略人数门槛只说明确定的技能变化，不将召唤数量换算为伤害分数。 */
import { OPERATOR } from '../../data/index.ts';
import type { PlanOp } from './planner.ts';
import type { AdvisorFormat } from './advisorRules.ts';

interface StrategyContext {
  strategy: string;
  format: AdvisorFormat;
  inactiveCovenants: ReadonlySet<string>;
}

/** V3_1 望明确要求在场不同炎干员；不用含调和虚拟人数的盟约统计替代。 */
function wangSummons(field: readonly PlanOp[]): number {
  const count = new Set(field.filter(slot => OPERATOR[slot.name]?.covenants.includes('炎')).map(slot => slot.name)).size;
  return count >= 9 ? 2 : count >= 6 ? 1 : 0;
}

export function explainStrategyTransition(before: readonly PlanOp[], after: readonly PlanOp[], context: StrategyContext): { reasons: string[]; losses: string[] } {
  if (context.strategy !== '望' || context.format === 'fast' || context.inactiveCovenants.has('炎')) return { reasons: [], losses: [] };
  const previous = wangSummons(before), next = wangSummons(after);
  if (previous === next) return { reasons: [], losses: [] };
  if (next > previous) return { reasons: [next === 1
    ? '望：已录6名不同原生炎在场，满足黑白相易改为开战召唤1只炎佑的条件；未估算召唤伤害'
    : '望：已录9名不同原生炎在场，满足开战召唤2只炎佑的条件；未估算召唤伤害'], losses: [] };
  return { reasons: [], losses: [next === 0
    ? '望：已录原生炎在场不足6名，无法确认仍满足召唤条件；附加盟约是否计入尚未核实'
    : '望：已录原生炎在场不足9名，无法确认仍满足召唤2只的条件；附加盟约是否计入尚未核实'] };
}
