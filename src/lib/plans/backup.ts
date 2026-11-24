/** 流派备份文件的读写与合并；不读写浏览器存储，也不修改传入的方案。 */
import {
  OPERATOR,
  EQUIP,
  STRATEGY,
  COVENANTS,
  BUILD_NAMES,
} from '../../../data/index.ts';
import {
  MAX_OPS,
  MAX_EQ,
  MAX_ALT,
  MAX_NOTE,
  MAX_LAYERS,
  cleanStrategyAlternates,
  editablePlanKey,
  readPlanIcon,
  usesLayers,
  validStageRange,
  type Plan,
  type PlanOp,
  type PlanStage,
} from './model.ts';
import {newId} from './storage.ts';
import {isSklandGuide, migrateLegacyGuidePlan} from './skland.ts';

const BACKUP_FORMAT = 'weishu-quickref-builds';
type BackupVersion = 1 | 2 | 3;
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;

/** version 标识文件结构；plans 包括自建流派和用户修改过的预设。 */
export interface PlanBackup {
  format: typeof BACKUP_FORMAT;
  version: BackupVersion;
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
const isText = (value: unknown, limit: number): value is string =>
  typeof value === 'string' && value.length <= limit;
const isKnown = (catalog: object, value: unknown): value is string =>
  typeof value === 'string' && Object.hasOwn(catalog, value);

// 成型阵容与各阶段使用相同的完整校验，避免恢复时静默跳过人数、装备或说明。
function readLineup(
  value: Record<string, unknown>,
  invalid: () => never,
): Pick<Plan, 'ops' | 'note' | 'layers'> {
  if (
    !isText(value.note, MAX_NOTE) ||
    !Array.isArray(value.ops) ||
    value.ops.length > MAX_OPS ||
    !isRecord(value.layers)
  )
    return invalid();

  // 校验整份文件后才允许恢复，避免把缺失干员或装备的残缺阵容写入存档。
  const names = new Set<string>();
  const ops: PlanOp[] = value.ops.map((slot) => {
    if (
      !isRecord(slot) ||
      !isKnown(OPERATOR, slot.name) ||
      names.has(slot.name) ||
      typeof slot.elite !== 'boolean' ||
      typeof slot.core !== 'boolean' ||
      !Array.isArray(slot.eq) ||
      slot.eq.length > MAX_EQ ||
      !slot.eq.every((name) => isKnown(EQUIP, name)) ||
      !Array.isArray(slot.alt) ||
      slot.alt.length > MAX_ALT ||
      !slot.alt.every(
        (name) => isKnown(OPERATOR, name) && name !== slot.name,
      ) ||
      new Set(slot.alt).size !== slot.alt.length
    )
      return invalid();
    names.add(slot.name);
    return {
      name: slot.name,
      elite: slot.elite,
      core: slot.core,
      eq: [...slot.eq],
      alt: [...slot.alt],
    };
  });
  const layers: Plan['layers'] = {};
  for (const [name, count] of Object.entries(value.layers)) {
    if (
      !isKnown(COVENANTS, name) ||
      !usesLayers(name) ||
      typeof count !== 'number' ||
      !Number.isInteger(count) ||
      count < 0 ||
      count > MAX_LAYERS
    )
      return invalid();
    layers[name] = count;
  }
  return {ops, note: value.note, layers};
}

function readPlan(value: unknown, index: number): Plan {
  const invalid = (): never => {
    throw new Error(
      `第 ${index + 1} 套流派的数据不完整或包含无法识别的内容，请更新页面或重新导出备份。`,
    );
  };
  if (
    !isRecord(value) ||
    !isText(value.id, 100) ||
    !value.id ||
    !isText(value.name, 16) ||
    typeof value.updated !== 'number' ||
    !Number.isFinite(value.updated) ||
    !(value.strategy === '' || isKnown(STRATEGY, value.strategy)) ||
    (value.base !== undefined && !isText(value.base, 100)) ||
    (value.skland !== undefined && !isSklandGuide(value.skland))
  )
    return invalid();
  const icon = readPlanIcon(value.icon);
  if (value.icon !== undefined && !icon) return invalid();
  let strategyAlternates: string[] | undefined;
  if (value.strategyAlternates !== undefined) {
    if (!Array.isArray(value.strategyAlternates)) return invalid();
    strategyAlternates = cleanStrategyAlternates(
      value.strategy,
      value.strategyAlternates,
    );
    if (strategyAlternates.length !== value.strategyAlternates.length)
      return invalid();
  }
  let stages: PlanStage[] | undefined;
  if (value.stages !== undefined) {
    if (!Array.isArray(value.stages)) return invalid();
    stages = [];
    for (const stage of value.stages) {
      if (
        !isRecord(stage) ||
        typeof stage.from !== 'number' ||
        typeof stage.to !== 'number' ||
        !validStageRange(stage.from, stage.to, stages)
      )
        return invalid();
      stages.push({
        from: stage.from,
        to: stage.to,
        ...readLineup(stage, invalid),
      });
    }
  }
  // 原预设下架时仍保留用户的整套方案，作为自建流派展示。
  const base =
    typeof value.base === 'string' && BUILD_NAMES.includes(value.base)
      ? value.base
      : undefined;
  return migrateLegacyGuidePlan({
    id: value.id,
    ...(icon ? {icon} : {}),
    name: value.name,
    ...readLineup(value, invalid),
    strategy: value.strategy,
    ...(strategyAlternates ? {strategyAlternates} : {}),
    ...(stages ? {stages} : {}),
    updated: value.updated,
    ...(isSklandGuide(value.skland) ? {skland: value.skland} : {}),
    ...(base ? {base} : {}),
  });
}

/** 旧版最多读取 8 人与 240 码元，且会丢弃新增字段；包含这些扩展的文件须标记新版。 */
export function needsExtendedPlanBackup(plan: Plan): boolean {
  return (
    plan.icon !== undefined ||
    plan.ops.length > 8 ||
    plan.note.length > 240 ||
    plan.skland !== undefined ||
    plan.strategyAlternates !== undefined ||
    plan.stages !== undefined
  );
}

/** 只在需要时提高导出版本，防止旧版读取带图标的备份时静默丢弃图标。 */
export function planBackupVersion(plans: readonly Plan[] = []): BackupVersion {
  if (plans.some((plan) => plan.icon)) return 3;
  return plans.some(needsExtendedPlanBackup) ? 2 : 1;
}

/** 导出 JSON，优先保留缩进；只有紧凑内容本身超过导入字节上限时才抛出调用方的提示。 */
export function serializeBackupDocument(
  value: object,
  oversizeMessage: string,
): string {
  const encoder = new TextEncoder();
  for (const indent of [2, 0]) {
    const text = JSON.stringify(value, null, indent);
    if (
      text.length <= MAX_BACKUP_BYTES &&
      encoder.encode(text).length <= MAX_BACKUP_BYTES
    )
      return text;
  }
  throw new Error(oversizeMessage);
}

/** 将当前内存中的流派序列化为 JSON；超过文件大小限制时抛出可展示的错误。 */
export function serializePlanBackup(plans: readonly Plan[]): string {
  const backup: PlanBackup = {
    format: BACKUP_FORMAT,
    version: planBackupVersion(plans),
    exportedAt: new Date().toISOString(),
    plans: [...plans],
  };
  return serializeBackupDocument(
    backup,
    '流派备份超过 5 MB，请精简流派后再导出。',
  );
}

/** 解析流派或设置备份中的全部方案。任意一项无效会抛错，并取消整批恢复。 */
export function readBackupPlans(value: unknown): Plan[] {
  if (!Array.isArray(value)) throw new Error('流派列表格式无效。');
  return value.map(readPlan);
}

/** 解析并校验备份文本，返回独立的方案对象；无效文件抛出可直接展示的错误。 */
export function parsePlanBackup(text: string): PlanBackup {
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES)
    throw new Error('备份文件超过 5 MB，请选择流派备份文件。');
  let value: unknown;
  try {
    value = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    throw new Error('无法读取此文件，请选择导出的 JSON 备份。');
  }
  if (!isRecord(value) || value.format !== BACKUP_FORMAT)
    throw new Error('这不是卫戍速查的流派备份文件。');
  if (value.version !== 1 && value.version !== 2 && value.version !== 3)
    throw new Error('此备份版本暂不支持，请更新页面后重试。');
  if (
    !Array.isArray(value.plans) ||
    typeof value.exportedAt !== 'string' ||
    !Number.isFinite(Date.parse(value.exportedAt))
  ) {
    throw new Error('备份文件数据不完整，请重新导出。');
  }
  return {
    format: BACKUP_FORMAT,
    version: value.version,
    exportedAt: value.exportedAt,
    plans: readBackupPlans(value.plans),
  };
}

/** 内容去重忽略 ID、修改时间和预设归属，层数字段的写入顺序不影响判定。 */
function contentKey(plan: Plan): string {
  return JSON.stringify([plan.skland ?? null, editablePlanKey(plan)]);
}

/**
 * 合并已校验的备份与本机方案，不覆盖现有内容。
 * 重复内容跳过；预设冲突时取消 base，保留为自建流派；所有新增项取得新的本机 ID。
 */
export function mergePlanBackup(
  existing: readonly Plan[],
  incoming: readonly Plan[],
): PlanBackupMerge {
  const contents = new Set(existing.map(contentKey));
  const bases = new Set(
    existing.flatMap((plan) => (plan.base ? [plan.base] : [])),
  );
  const ids = new Set([...BUILD_NAMES, ...existing.map((plan) => plan.id)]);
  const sourceIds = new Set(existing.map((plan) => plan.id));
  const result: PlanBackupMerge = {additions: [], skipped: 0, conflicts: 0};
  for (const plan of incoming) {
    const key = contentKey(plan);
    if (contents.has(key)) {
      result.skipped++;
      continue;
    }
    const copy: Plan = JSON.parse(JSON.stringify(plan));
    const conflict =
      (!!copy.base && bases.has(copy.base)) || sourceIds.has(copy.id);
    if (conflict) {
      result.conflicts++;
      delete copy.base;
    }
    if (copy.base) bases.add(copy.base);
    sourceIds.add(copy.id);
    do {
      copy.id = newId();
    } while (ids.has(copy.id));
    ids.add(copy.id);
    contents.add(key);
    result.additions.push(copy);
  }
  return result;
}
