import type { Operator } from './types.ts';

/** 教程与速查共用的特质类型，顺序与图鉴一致。 */
export const OPERATOR_TYPES = ['持续叠加', '单次叠加', '作战能力', '整备能力', '特异化'] as const;

/** 显示名称与原始特质标签；两种休整期开始写法归为同一时机。 */
export const OPERATOR_TRIGGERS: readonly (readonly [label: string, tags: readonly string[]])[] = [
  ['进入休整期', ['<进入休整期时>', '<休整期开始时>']],
  ['获得时', ['<获得时>']],
  ['刷新时', ['<刷新时>']],
  ['售出时', ['<售出时>']],
  ['休整期结束', ['<休整期结束时>']],
  ['战斗开始', ['<战斗开始时>']],
  ['战斗中', ['<战斗中>']],
  ['战斗结束', ['<战斗结束时>']],
];
const triggerTags = new Map(OPERATOR_TRIGGERS);

/** 按当前显示的初始 / 精锐特质匹配时机；空名称不过滤，未知名称不匹配，不修改干员数据。 */
export function matchesOperatorTrigger(operator: Operator, trigger: string, elite = false): boolean {
  if (!trigger) return true;
  const text = elite ? operator.elite : operator.trait;
  return triggerTags.get(trigger)?.some(tag => text.includes(tag)) ?? false;
}
