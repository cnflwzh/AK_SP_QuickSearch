import {
  commitStorageChanges,
  readStoredItem,
  type StorageChange,
} from '../lib/season/storage.ts';
import {readBoxSnapshot, boxStorageChanges} from '../lib/box/persistence.ts';
import {
  acceptStoredBox,
  boxStorageWriteFailed,
  buildBoxImport,
  exportOperatorBox,
} from '../lib/box/store.ts';
import {PLANS_STORAGE_KEY} from '../lib/plans/storage.ts';
import {SEASON_META} from '../../data/index.ts';
import {isLegacyOrigin} from '../lib/settings/domainMigration.ts';
import {requireLegacyDomainSeason} from '../lib/settings/legacyDomainSeason.ts';
import {
  serializeSettingsBackup,
  type SettingsBackup,
} from '../lib/settings/backup.ts';
import {compareMirrorBackup} from '../lib/settings/mirrorBackup.ts';
import {
  compareMigrationTools,
  migrationStorageChanges,
  readMigrationSnapshot,
  type MigrationToolId,
} from '../lib/settings/migrationTools.ts';
import {normalizeSettings} from '../lib/settings/model.ts';
import {
  acceptStoredSettings,
  SETTINGS_STORAGE_KEY,
  settings,
  settingsStorageWriteFailed,
} from '../lib/settings/store.ts';
import {plans, refreshMirrorPlans, restorePlanBackup} from './planStore.ts';

function readObject(key: string, label: string) {
  const raw = readStoredItem(key);
  try {
    const value: unknown = raw === null ? {} : JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error('存档格式无效');
    return {raw, value};
  } catch (cause) {
    throw new Error(`本站${label}存档损坏，已停止交接并保留原始存档。`, {
      cause,
    });
  }
}

function readMirrorState(carryDraft = false, includeSeasonPlans = true) {
  const preferences = readObject(SETTINGS_STORAGE_KEY, '设置');
  const roster = readBoxSnapshot();
  return {
    rawPlans: includeSeasonPlans ? refreshMirrorPlans(carryDraft) : null,
    rawSettings: preferences.raw,
    roster,
    settings: normalizeSettings(preferences.value),
    box: roster.box,
  };
}

/** 发送前重读同站存档。迁移时携带本赛季工具历史，同代镜像继续使用原备份格式。 */
export function exportMirrorBackup(migrating = false): string {
  if (
    migrating &&
    typeof location !== 'undefined' &&
    isLegacyOrigin(location.origin)
  )
    requireLegacyDomainSeason(SEASON_META.id);
  const state = readMirrorState(true);
  return serializeSettingsBackup(
    settingsStorageWriteFailed ? settings : state.settings,
    plans,
    boxStorageWriteFailed.value ? exportOperatorBox() : state.box,
    migrating ? readMigrationSnapshot().tools : undefined,
  );
}

/** 只使用已落盘的内容判定重复和空站，并保留快照供确认时检测其他标签页的更新。 */
export function previewMirrorBackup(backup: SettingsBackup) {
  const state = readMirrorState(false, !backup.archive);
  const changes = compareMirrorBackup(backup, state.settings, plans, state.box);
  const toolSnapshot =
    backup.tools && !backup.archive ? readMigrationSnapshot() : undefined;
  const tools =
    backup.tools && toolSnapshot
      ? compareMigrationTools(backup.tools, toolSnapshot.tools)
      : [];
  if (tools.some((group) => group.existing)) changes.empty = false;
  if (boxStorageWriteFailed.value || settingsStorageWriteFailed)
    changes.empty = false;
  return {...state, toolSnapshot, changes: {...changes, tools}};
}

type MirrorPreview = ReturnType<typeof previewMirrorBackup>;
interface Selection {
  settings: boolean;
  plans: boolean;
  box: boolean;
  tools?: readonly MigrationToolId[];
}

/**
 * 将勾选的分组写入当前站。流派最后写，以沿用其并发保护和旧版本迁移。
 * 后续写入失败时撤回本次先前的写入，所有写入完成后才发布到当前页。
 * 返回已合并的流派统计；配额、权限或预览冲突会抛错，调用方保留预览供重试。
 */
export function commitMirrorBackup(
  preview: MirrorPreview,
  backup: SettingsBackup,
  selected: Selection,
) {
  const pending: StorageChange[] = [];
  const nextBox =
    selected.box && backup.box
      ? buildBoxImport(
          boxStorageWriteFailed.value
            ? buildBoxImport(preview.box, exportOperatorBox())
            : preview.box,
          backup.box,
        )
      : undefined;
  if (nextBox) pending.push(...boxStorageChanges(preview.roster, nextBox));
  if (backup.tools && preview.toolSnapshot && selected.tools)
    pending.push(
      ...migrationStorageChanges(
        preview.toolSnapshot,
        backup.tools,
        selected.tools,
      ),
    );
  if (selected.settings)
    pending.push({
      key: SETTINGS_STORAGE_KEY,
      before: preview.rawSettings,
      after: JSON.stringify(backup.settings),
    });
  // 包括确认时刚刚保存的本页草稿。改变预览基线后，让玩家重新查看差异。
  if (
    selected.plans &&
    !backup.archive &&
    refreshMirrorPlans() !== preview.rawPlans
  )
    throw new Error(
      '其他标签页已更新流派或本页草稿已改变，请取消预览后重新取回。',
    );
  const merged = commitStorageChanges(pending, () => {
    if (!selected.plans || !backup.plans?.length) return undefined;
    if (readStoredItem(PLANS_STORAGE_KEY) !== preview.rawPlans)
      throw new Error('其他标签页已更新流派，请取消预览后重新取回。');
    return restorePlanBackup(backup.plans);
  });
  if (nextBox) acceptStoredBox(nextBox);
  if (selected.settings) acceptStoredSettings(backup.settings);
  return merged;
}
