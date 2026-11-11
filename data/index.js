/**
 * 数据入口：重新导出各数据表，并提供按名称查找、按盟约筛选等常用索引。
 * 页面代码只从这里 import，不直接引用单个数据文件。
 */
import { OPERATORS } from './operators.js';
import { EQUIPMENT } from './equipment.js';
import { STRATEGIES } from './strategies.js';
import { COVENANTS, CORE_COVENANTS, ADDON_COVENANTS } from './covenants.js';
import { CORE_BUILDS, MIXED_BUILDS } from './builds.js';

export * from './operators.js';
export * from './equipment.js';
export * from './strategies.js';
export * from './covenants.js';
export * from './builds.js';
export * from './rules.js';

const byName = list => Object.fromEntries(list.map(item => [item.name, item]));

/** 名称 → 数据 */
export const OPERATOR = byName(OPERATORS);
export const EQUIP = byName(EQUIPMENT);
export const STRATEGY = byName(STRATEGIES);

/** 全部盟约名，核心在前 */
export const ALL_COVENANTS = [...CORE_COVENANTS, ...ADDON_COVENANTS];

export const isCoreCovenant = name => CORE_COVENANTS.includes(name);

/** 盟约主题色；附加盟约没有专属色，返回 fallback */
export const covenantColor = (name, fallback) => COVENANTS[name]?.color || fallback;

/** 属于某盟约的全部干员（保持数据表顺序） */
export const rosterOf = covenant => OPERATORS.filter(o => o.covenants.includes(covenant));

/** 全部流派名：核心盟约流派 + 混搭流派 */
export const BUILD_NAMES = [...Object.keys(CORE_BUILDS), ...MIXED_BUILDS.map(b => b.name)];
export const BUILD_COUNT = BUILD_NAMES.length;

/** 按名称取流派；核心流派的 name 补为盟约名 */
export const buildByName = name =>
  CORE_BUILDS[name] ? { name, ...CORE_BUILDS[name] } : MIXED_BUILDS.find(b => b.name === name);

/**
 * 推荐了某干员 / 策略 / 装备的流派名。
 * field: 'lineup' | 'strategies' | 'equipment'
 * 干员同时匹配核心流派的 carries。
 */
export function buildsUsing(field, name) {
  const core = Object.entries(CORE_BUILDS)
    .filter(([, b]) => b[field].includes(name) || (field === 'lineup' && b.carries.includes(name)))
    .map(([covenant]) => covenant);
  const mixed = MIXED_BUILDS.filter(b => b[field].includes(name)).map(b => b.name);
  return [...core, ...mixed];
}
