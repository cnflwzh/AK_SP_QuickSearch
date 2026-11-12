/**
 * 数据入口：重新导出各数据表，并提供按名称查找、按盟约筛选等常用索引。
 * 页面代码只从这里 import，不直接引用单个数据文件。
 */
import type { Build, BuildField, Equipment, Leader, Operator, Strategy } from './types.ts';
import { OPERATORS } from './operators.ts';
import { EQUIPMENT } from './equipment.ts';
import { STRATEGIES } from './strategies.ts';
import { COVENANTS, CORE_COVENANTS, ADDON_COVENANTS } from './covenants.ts';
import { CORE_BUILDS, MIXED_BUILDS } from './builds.ts';
import { LEADERS } from './leaders.ts';

export * from './operators.ts';
export * from './operator-filters.ts';
export * from './equipment.ts';
export * from './strategies.ts';
export * from './covenants.ts';
export * from './builds.ts';
export * from './rules.ts';
export * from './leaders.ts';
export * from './leader-movement.ts';
export type * from './types.ts';

const byName = <T extends { readonly name: string }>(list: readonly T[]): Readonly<Record<string, T>> =>
  Object.fromEntries(list.map(item => [item.name, item]));

/** 名称 → 数据 */
export const OPERATOR: Readonly<Record<string, Operator>> = byName(OPERATORS);
export const EQUIP: Readonly<Record<string, Equipment>> = byName(EQUIPMENT);
export const STRATEGY: Readonly<Record<string, Strategy>> = byName(STRATEGIES);
export const LEADER: Readonly<Record<string, Leader>> = byName(LEADERS);

/** 全部盟约名，核心在前 */
export const ALL_COVENANTS: readonly string[] = [...CORE_COVENANTS, ...ADDON_COVENANTS];

export const isCoreCovenant = (name: string): boolean => CORE_COVENANTS.includes(name);

/** 盟约主题色；附加盟约没有专属色，返回 fallback */
export const covenantColor = (name: string, fallback: string): string => COVENANTS[name]?.color || fallback;

/** 属于某盟约的全部干员（保持数据表顺序） */
export const rosterOf = (covenant: string): Operator[] => OPERATORS.filter(o => o.covenants.includes(covenant));

/**
 * 统计给定阵容中盟约的不同干员人数，重复名称只计一次。
 * @param {string[]} lineup 干员名称列表。
 * @param {string} covenant 盟约名称。
 * @returns {number} 阵容中拥有该盟约的不同干员数。
 */
export const lineupCovenantCount = (lineup: readonly string[], covenant: string): number =>
  [...new Set(lineup)].filter(name => OPERATOR[name]?.covenants.includes(covenant)).length;

/** 全部流派名：核心盟约流派 + 混搭流派 */
export const BUILD_NAMES: readonly string[] = [...Object.keys(CORE_BUILDS), ...MIXED_BUILDS.map(b => b.name)];
export const BUILD_COUNT = BUILD_NAMES.length;

/** 按名称取流派；核心流派的 name 补为盟约名 */
export const buildByName = (name: string): Build | undefined =>
  CORE_BUILDS[name] ? { name, ...CORE_BUILDS[name] } : MIXED_BUILDS.find(b => b.name === name);

/**
 * 推荐了某干员 / 策略 / 装备的流派名。
 * field: 'lineup' | 'strategies' | 'equipment'
 * 干员同时匹配核心流派的 carries。
 */
export function buildsUsing(field: BuildField, name: string): string[] {
  const core = Object.entries(CORE_BUILDS)
    .filter(([, b]) => b[field].includes(name) || (field === 'lineup' && b.carries.includes(name)))
    .map(([covenant]) => covenant);
  const mixed = MIXED_BUILDS.filter(b => b[field].includes(name)).map(b => b.name);
  return [...core, ...mixed];
}
