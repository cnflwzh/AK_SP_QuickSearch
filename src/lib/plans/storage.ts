/** 浏览器方案存档适配。读写与默认记录生成留在推荐计算模块之外。 */
import {STRATEGY, buildByName} from '../../../data/index.ts';
import {
  MAX_NOTE,
  MAX_STAGE_ROUND,
  cleanLayers,
  cleanOps,
  cleanStages,
  cleanStrategyAlternates,
  readPlanIcon,
  type Plan,
} from './model.ts';
import {isSklandGuide, migrateLegacyGuidePlan} from './skland.ts';
/* ---------- 本地存档 ---------- */

export const PLANS_STORAGE_KEY = 'wsq.plans';
const BEFORE_ROUND_LIMIT = 'wsq.plans.beforeRoundLimit';
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
  const icon = readPlanIcon(value.icon);
  return migrateLegacyGuidePlan({
    ...(icon ? {icon} : {}),
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
export const readPlanSnapshot = (): string | null => read(PLANS_STORAGE_KEY);

/** 只保留涉及超限回合的旧记录，供玩家从备份面板取回原始阵容和备注。 */
function legacyRoundRecords(snapshot: string | null): string | null {
  if (!snapshot) return null;
  try {
    const records: unknown = JSON.parse(snapshot);
    if (!Array.isArray(records)) return null;
    const affected = records.filter(
      (plan) =>
        Array.isArray(plan?.stages) &&
        plan.stages.some(
          (stage: unknown) =>
            record(stage) &&
            typeof stage.to === 'number' &&
            stage.to > MAX_STAGE_ROUND,
        ),
    );
    return affected.length ? JSON.stringify(affected) : null;
  } catch {
    return null;
  }
}
export const originalRoundRecords = (): string | null =>
  read(BEFORE_ROUND_LIMIT) ?? legacyRoundRecords(readPlanSnapshot());

/** 解析给定存档。普通浏览容许损坏记录；交接使用 strict，在原始 JSON 或记录结构损坏时抛错。 */
export function loadPlans(
  snapshot = readPlanSnapshot(),
  strict = false,
): Plan[] {
  try {
    const list: unknown = JSON.parse(snapshot ?? '[]');
    if (!Array.isArray(list) || (strict && !list.every(record)))
      throw new Error('流派存档格式无效');
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
  } catch (cause) {
    if (strict)
      throw new Error('本站流派存档损坏，已停止交接并保留原始存档。', {cause});
    return [];
  }
}
let checkedSnapshot: string | null = null;
/** 保存应用中的方案，首次迁移先备份被裁剪的旧记录；任一写入失败均保留原主存档。 */
export function savePlanSnapshot(snapshot: string): boolean {
  const previous = readPlanSnapshot();
  if (previous !== checkedSnapshot && !read(BEFORE_ROUND_LIMIT)) {
    const original = legacyRoundRecords(previous);
    if (original && !write(BEFORE_ROUND_LIMIT, original)) return false;
  }
  if (!write(PLANS_STORAGE_KEY, snapshot)) return false;
  checkedSnapshot = snapshot;
  return true;
}
/** 序列化并写入全部方案，返回是否成功。 */
export const savePlans = (plans: readonly Plan[]): boolean =>
  savePlanSnapshot(JSON.stringify(plans));
