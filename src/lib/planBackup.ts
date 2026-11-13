/** 流派备份文件的读写与合并；不读写浏览器存储，也不修改传入的方案。 */
import { OPERATOR, EQUIP, STRATEGY, COVENANTS, BUILD_NAMES } from '../../data/index.ts';
import { MAX_OPS, MAX_EQ, MAX_ALT, MAX_NOTE, MAX_LAYERS, newId, usesLayers, type Plan, type PlanOp } from './planner.ts';

const BACKUP_FORMAT = 'weishu-quickref-builds';
const BACKUP_VERSION = 1;
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;

/** version 标识文件结构；plans 包括自建流派和用户修改过的预设。 */
export interface PlanBackup {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  plans: Plan[];
}

/** 合并结果仅包含待追加的方案，便于存储成功后再更新响应式列表。 */
export interface PlanBackupMerge {
  additions: Plan[];
  skipped: number;
  /** 同一预设或 ID 的不同版本，恢复为独立的「我的流派」。 */
  conflicts: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = (value: unknown, limit: number): value is string => typeof value === 'string' && value.length <= limit;
const isKnown = (catalog: object, value: unknown): value is string => typeof value === 'string' && Object.hasOwn(catalog, value);

function readPlan(value: unknown, index: number): Plan {
  const invalid = (): never => { throw new Error(`第 ${index + 1} 套流派的数据不完整或包含无法识别的内容，请更新页面或重新导出备份。`); };
  if (!isRecord(value)) return invalid();
  if (!isText(value.id, 100) || !value.id || !isText(value.name, 16) || !isText(value.note, MAX_NOTE)
    || typeof value.updated !== 'number' || !Number.isFinite(value.updated)
    || !(value.strategy === '' || isKnown(STRATEGY, value.strategy))
    || !Array.isArray(value.ops) || value.ops.length > MAX_OPS || !isRecord(value.layers)
    || (value.base !== undefined && !isText(value.base, 100))) return invalid();

  // 校验整份文件后才允许恢复，避免把缺失干员或装备的残缺阵容写入存档。
  const names = new Set<string>();
  const ops: PlanOp[] = value.ops.map(slot => {
    if (!isRecord(slot) || !isKnown(OPERATOR, slot.name) || names.has(slot.name)
      || typeof slot.elite !== 'boolean' || typeof slot.core !== 'boolean'
      || !Array.isArray(slot.eq) || slot.eq.length > MAX_EQ || !slot.eq.every(name => isKnown(EQUIP, name))
      || !Array.isArray(slot.alt) || slot.alt.length > MAX_ALT
      || !slot.alt.every(name => isKnown(OPERATOR, name) && name !== slot.name)
      || new Set(slot.alt).size !== slot.alt.length) return invalid();
    names.add(slot.name);
    return { name: slot.name, elite: slot.elite, core: slot.core, eq: [...slot.eq], alt: [...slot.alt] };
  });
  const layers: Plan['layers'] = {};
  for (const [name, count] of Object.entries(value.layers)) {
    if (!isKnown(COVENANTS, name) || !usesLayers(name) || typeof count !== 'number'
      || !Number.isInteger(count) || count < 0 || count > MAX_LAYERS) return invalid();
    layers[name] = count;
  }
  // 原预设下架时仍保留用户的整套方案，作为自建流派展示。
  const base = typeof value.base === 'string' && BUILD_NAMES.includes(value.base) ? value.base : undefined;
  return {
    id: value.id, name: value.name, ops, strategy: value.strategy, note: value.note, layers, updated: value.updated,
    ...(base ? { base } : {}),
  };
}

/** 将当前内存中的流派序列化为 JSON；超过文件大小限制时抛出可展示的错误。 */
export function serializePlanBackup(plans: readonly Plan[]): string {
  const backup: PlanBackup = { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), plans: [...plans] };
  const text = JSON.stringify(backup, null, 2);
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES) throw new Error('流派备份超过 5 MB，请精简流派后再导出。');
  return text;
}

/** 解析并校验备份文本，返回独立的方案对象；无效文件抛出可直接展示的错误。 */
export function parsePlanBackup(text: string): PlanBackup {
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES) throw new Error('备份文件超过 5 MB，请选择流派备份文件。');
  let value: unknown;
  try { value = JSON.parse(text.replace(/^\uFEFF/, '')); }
  catch { throw new Error('无法读取此文件，请选择导出的 JSON 备份。'); }
  if (!isRecord(value) || value.format !== BACKUP_FORMAT) throw new Error('这不是卫戍速查的流派备份文件。');
  if (value.version !== BACKUP_VERSION) throw new Error('此备份版本暂不支持，请更新页面后重试。');
  if (!Array.isArray(value.plans) || typeof value.exportedAt !== 'string' || !Number.isFinite(Date.parse(value.exportedAt))) {
    throw new Error('备份文件数据不完整，请重新导出。');
  }
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: value.exportedAt, plans: value.plans.map(readPlan) };
}

/** 内容去重忽略 ID、修改时间和预设归属，层数字段的写入顺序不影响判定。 */
function contentKey(plan: Plan): string {
  return JSON.stringify([
    plan.name, plan.ops.map(slot => [slot.name, slot.elite, slot.core, slot.eq, slot.alt]), plan.strategy, plan.note,
    Object.entries(plan.layers).filter(([, count]) => count > 0).sort(([a], [b]) => a.localeCompare(b)),
  ]);
}

/**
 * 合并已校验的备份与本机方案，不覆盖现有内容。
 * 重复内容跳过；预设冲突时取消 base，保留为自建流派；所有新增项取得新的本机 ID。
 */
export function mergePlanBackup(existing: readonly Plan[], incoming: readonly Plan[]): PlanBackupMerge {
  const contents = new Set(existing.map(contentKey));
  const bases = new Set(existing.flatMap(plan => plan.base ? [plan.base] : []));
  const ids = new Set([...BUILD_NAMES, ...existing.map(plan => plan.id)]);
  const sourceIds = new Set(existing.map(plan => plan.id));
  const result: PlanBackupMerge = { additions: [], skipped: 0, conflicts: 0 };
  for (const plan of incoming) {
    const key = contentKey(plan);
    if (contents.has(key)) { result.skipped++; continue; }
    const copy: Plan = JSON.parse(JSON.stringify(plan));
    const conflict = (!!copy.base && bases.has(copy.base)) || sourceIds.has(copy.id);
    if (conflict) { result.conflicts++; delete copy.base; }
    if (copy.base) bases.add(copy.base);
    sourceIds.add(copy.id);
    do { copy.id = newId(); } while (ids.has(copy.id));
    ids.add(copy.id);
    contents.add(key);
    result.additions.push(copy);
  }
  return result;
}
