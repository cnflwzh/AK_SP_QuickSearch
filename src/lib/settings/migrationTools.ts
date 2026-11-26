import {BOUNTIES, EQUIP, OPERATOR, STRATEGY} from '../../../data/index.ts';
import {MAX_MISTAKE_RECORDS, normalizeMistakes} from '../dealer/mistakes.ts';
import {
  BOUNTY_THEMES,
  EQUIP_THEMES,
  SELECTABLE_COVENANTS,
  STRATEGY_THEMES,
  TIER_CHECK_THEMES,
  TRANSMUTE_COVENANTS,
  TRIGGER_THEMES,
} from '../dealer/themes.ts';
import type {DealerMistakeRecord} from '../dealer/types.ts';
import {readStoredItem, type StorageChange} from '../season/storage.ts';
import {toolStorageKeys} from '../season/toolKeys.ts';
import {
  MAX_RECENT_ITEMS,
  sanitizeRecentList,
  type RecentItem,
} from './recent.ts';

/** 仅迁移可复用的历史。每日牌局、局内抓取、本局流派等临时对局从不读取或写入。 */
export interface MigrationTools {
  mistakes?: DealerMistakeRecord[];
  recent?: RecentItem[];
}
export type MigrationToolId = keyof MigrationTools;
const ids: readonly MigrationToolId[] = ['mistakes', 'recent'];
const labels = {mistakes: '痛扁发牌错题本', recent: '最近查看'};
const targets: Record<DealerMistakeRecord['roundKind'], readonly string[]> = {
  covenant: SELECTABLE_COVENANTS,
  transmute: TRANSMUTE_COVENANTS,
  trigger: TRIGGER_THEMES,
  tier_check: TIER_CHECK_THEMES,
  equipment: EQUIP_THEMES,
  strategy: STRATEGY_THEMES,
  bounty: BOUNTY_THEMES,
};
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

function invalid(id: MigrationToolId): never {
  throw new Error(`${labels[id]}记录无效或超出上限，请检查来源备份。`);
}

/** 跨赛季只验证容器和规模，以便展示来源数量；外季实体不会按当前赛季目录解释。 */
export function countMigrationTools(value: unknown) {
  if (
    !object(value) ||
    !Object.keys(value).every((id) => Object.hasOwn(labels, id))
  )
    throw new Error('工具备份包含不支持的记录类型。');
  function count(id: MigrationToolId, max: number) {
    const items = (value as Record<string, unknown>)[id];
    if (items === undefined) return 0;
    if (!Array.isArray(items) || items.length > max || !items.every(object))
      return invalid(id);
    return items.length;
  }
  return {
    mistakes: count('mistakes', MAX_MISTAKE_RECORDS),
    recent: count('recent', MAX_RECENT_ITEMS),
  };
}

function readMistakes(value: Record<string, unknown>[]): DealerMistakeRecord[] {
  const records = normalizeMistakes(value);
  if (
    records.length !== value.length ||
    !records.every((row, index) => {
      const source = value[index];
      const known =
        row.cardKind === 'bounty'
          ? BOUNTIES.some((bounty) => bounty.name === row.title)
          : Object.hasOwn(
              {operator: OPERATOR, equipment: EQUIP, strategy: STRATEGY}[
                row.cardKind
              ],
              row.title,
            );
      return (
        known &&
        targets[row.roundKind].includes(row.targetKey) &&
        row.targetLabel.length <= 160 &&
        [row.wrongCount, row.correctStreak, row.lastWrongAt].every(
          Number.isSafeInteger,
        ) &&
        Object.entries(source).every(
          ([key, val]) =>
            Object.hasOwn(row, key) &&
            row[key as keyof DealerMistakeRecord] === val,
        )
      );
    })
  )
    return invalid('mistakes');
  return records;
}

/** 同季导入以原工具的实体目录和规范化逻辑重建记录。缺项和空数组不覆盖接收站。 */
export function readMigrationTools(value: unknown): MigrationTools {
  const counts = countMigrationTools(value);
  const source = value as Record<MigrationToolId, Record<string, unknown>[]>;
  const tools: MigrationTools = {};
  if (counts.mistakes) tools.mistakes = readMistakes(source.mistakes);
  if (counts.recent) {
    const recent = sanitizeRecentList(source.recent);
    if (recent.length !== counts.recent) return invalid('recent');
    tools.recent = recent;
  }
  return tools;
}

/** 从白名单键读取磁盘快照，包括预览后并发校验与失败撤回所需的原始字节。 */
export function readMigrationSnapshot() {
  const raw = {
    mistakes: readStoredItem(toolStorageKeys.mistakes),
    recent: readStoredItem(toolStorageKeys.recent),
  };
  const value: Record<string, unknown> = {};
  try {
    for (const id of ids) {
      const item = raw[id];
      if (item === null) continue;
      if (item.length > 256 * 1024) return invalid(id);
      value[id] = JSON.parse(item);
    }
    return {raw, tools: readMigrationTools(value)};
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : '';
    throw new Error(`本站工具历史存档损坏，已保留原记录。${detail}`, {cause});
  }
}

/** 预览变更；仅来源有记录的组需要确认，目标已有其他组也不算空站。 */
export function compareMigrationTools(
  incoming: MigrationTools,
  local: MigrationTools,
) {
  return ids.map((id) => ({
    id,
    label: labels[id],
    incoming: incoming[id]?.length ?? 0,
    existing: local[id]?.length ?? 0,
    changed:
      !!incoming[id]?.length &&
      JSON.stringify(incoming[id]) !== JSON.stringify(local[id]),
  }));
}

/** 只生成明确选中分组的条件写入，由交接事务检查并发和统一回滚。 */
export function migrationStorageChanges(
  snapshot: ReturnType<typeof readMigrationSnapshot>,
  incoming: MigrationTools,
  selected: readonly MigrationToolId[],
): StorageChange[] {
  return ids
    .filter((id) => selected.includes(id) && incoming[id]?.length)
    .map((id) => ({
      key: toolStorageKeys[id],
      before: snapshot.raw[id],
      after: JSON.stringify(incoming[id]),
    }));
}
