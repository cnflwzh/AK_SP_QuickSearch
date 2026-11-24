/** 浏览器方案存档适配。读写与默认记录生成留在推荐计算模块之外。 */
import {STRATEGY, buildByName} from '../../../data/index.ts';
import {
  MAX_NOTE,
  cleanLayers,
  cleanOps,
  cleanStages,
  cleanStrategyAlternates,
  type Plan,
} from './model.ts';
import {isSklandGuide, migrateLegacyGuidePlan} from './skland.ts';
/* ---------- 本地存档 ---------- */

const KEY = 'wsq.plans',
  CURRENT = 'wsq.plan';
const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string): boolean => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

export const newId = (): string =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const blankPlan = (name = '新阵容'): Plan => ({
  id: newId(),
  name,
  ops: [],
  strategy: '',
  note: '',
  layers: {},
  updated: Date.now(),
});
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
/** 单条损坏存档被略过，其余方案仍可读取。 */
function clean(value: unknown): Plan | null {
  if (!record(value)) return null;
  const base =
    typeof value.base === 'string' && buildByName(value.base)
      ? value.base
      : undefined;
  const strategy =
    typeof value.strategy === 'string' &&
    Object.hasOwn(STRATEGY, value.strategy)
      ? value.strategy
      : '';
  return migrateLegacyGuidePlan({
    id: typeof value.id === 'string' && value.id ? value.id : newId(),
    name:
      typeof value.name === 'string' && value.name
        ? value.name.slice(0, 16)
        : '阵容',
    updated:
      typeof value.updated === 'number' && Number.isFinite(value.updated)
        ? value.updated
        : Date.now(),
    strategy,
    ...(Array.isArray(value.strategyAlternates)
      ? {
          strategyAlternates: cleanStrategyAlternates(
            strategy,
            value.strategyAlternates,
          ),
        }
      : {}),
    ...(Array.isArray(value.stages) ? {stages: cleanStages(value.stages)} : {}),
    note: typeof value.note === 'string' ? value.note.slice(0, MAX_NOTE) : '',
    layers: cleanLayers(value.layers),
    ops: cleanOps(value.ops, base ? buildByName(base)!.carries : []),
    ...(isSklandGuide(value.skland) ? {skland: value.skland} : {}),
    ...(base ? {base} : {}),
  });
}
/** 读取当前原始存档，用于判断另一个标签页是否已保存。 */
export const readPlanSnapshot = (): string | null => read(KEY);

/** 解析给定存档或当前本地存档，跳过损坏的记录。 */
export function loadPlans(snapshot = readPlanSnapshot()): Plan[] {
  try {
    const list: unknown = JSON.parse(snapshot ?? '[]');
    if (!Array.isArray(list)) return [];
    const ids = new Set<string>(),
      bases = new Set<string>();
    return list
      .map(clean)
      .filter((p): p is Plan => !!p)
      .map((p) => {
        if (ids.has(p.id)) p.id = newId();
        // 每个内置流派只认一份修改版，多出来的当作自建流派
        if (p.base && bases.has(p.base)) delete p.base;
        if (p.base) bases.add(p.base);
        ids.add(p.id);
        return p;
      });
  } catch {
    return [];
  }
}
/** 写入已经序列化的方案快照，返回是否成功；存储被禁用或空间不足时返回 false。 */
export const savePlanSnapshot = (snapshot: string): boolean =>
  write(KEY, snapshot);
/** 序列化并写入全部方案，返回是否成功。 */
export const savePlans = (plans: readonly Plan[]): boolean =>
  savePlanSnapshot(JSON.stringify(plans));
export const loadCurrent = (): string => read(CURRENT) ?? '';
export const saveCurrent = (id: string): void => {
  write(CURRENT, id);
};
