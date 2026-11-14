/** 仅保存玩家确认的邻接关系，不把阵容列表顺序解释为棋盘坐标。
 * 当前 V3_1 garrison_138 / garrison_177：SERVER_ADD_BOND_POSITION，dir=front。
 * 客户端表未说明共享盟约去重方式，因此估值只补计目标独有盟约。
 */
import { OPERATOR } from '../../data/index.ts';

export type FrontTargets = Record<string, string>;
export const FRONT_LAYER_PATTERN = /^<休整期结束时>使自身(?:及|以及)身前一格干员已激活的盟约层数\+(\d+)/;

export function supportsFrontTarget(name: string): boolean {
  const operator = OPERATOR[name];
  return !!operator && (FRONT_LAYER_PATTERN.test(operator.trait) || FRONT_LAYER_PATTERN.test(operator.elite));
}

/** 缺少键表示未知，空字符串表示确认无人；失效关系不继承给替补干员。 */
export function sanitizeFrontTargets(value: unknown, field: ReadonlySet<string>): FrontTargets {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([source, target]) =>
    field.has(source) && supportsFrontTarget(source) && typeof target === 'string'
    && (target === '' || target !== source && field.has(target))));
}

export function clearMovedFrontTargets(targets: Readonly<FrontTargets>, moved: ReadonlySet<string>): FrontTargets {
  return Object.fromEntries(Object.entries(targets).filter(([source, target]) => !moved.has(source) && !moved.has(target)));
}
