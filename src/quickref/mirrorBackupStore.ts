import {normalizeOperatorBox} from '../lib/box/model.ts';
import {
  acceptStoredBox,
  BOX_STORAGE_KEY,
  boxStorageWriteFailed,
  buildBoxImport,
  exportOperatorBox,
} from '../lib/box/store.ts';
import {PLANS_STORAGE_KEY} from '../lib/plans/storage.ts';
import {
  serializeSettingsBackup,
  type SettingsBackup,
} from '../lib/settings/backup.ts';
import {compareMirrorBackup} from '../lib/settings/mirrorBackup.ts';
import {normalizeSettings} from '../lib/settings/model.ts';
import {
  acceptStoredSettings,
  SETTINGS_STORAGE_KEY,
  settings,
  settingsStorageWriteFailed,
} from '../lib/settings/store.ts';
import {plans, refreshMirrorPlans, restorePlanBackup} from './planStore.ts';

function readObject(key: string, label: string) {
  const raw = localStorage.getItem(key);
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

function readMirrorState(carryDraft = false) {
  const preferences = readObject(SETTINGS_STORAGE_KEY, '设置');
  const roster = readObject(BOX_STORAGE_KEY, 'Box');
  return {
    rawPlans: refreshMirrorPlans(carryDraft),
    rawSettings: preferences.raw,
    rawBox: roster.raw,
    settings: normalizeSettings(preferences.value),
    box: normalizeOperatorBox(roster.value),
  };
}

/** 发送前重读同站存档；本页因配额而尚未保存的设置和练度仍可携带到另一站。 */
export function exportMirrorBackup(): string {
  const state = readMirrorState(true);
  return serializeSettingsBackup(
    settingsStorageWriteFailed ? settings : state.settings,
    plans,
    boxStorageWriteFailed.value ? exportOperatorBox() : state.box,
  );
}

/** 只使用已落盘的内容判定重复和空站，并保留快照供确认时检测其他标签页的更新。 */
export function previewMirrorBackup(backup: SettingsBackup) {
  const state = readMirrorState();
  const changes = compareMirrorBackup(backup, state.settings, plans, state.box);
  if (boxStorageWriteFailed.value || settingsStorageWriteFailed)
    changes.empty = false;
  return {...state, changes};
}

type MirrorPreview = ReturnType<typeof previewMirrorBackup>;
interface Selection {
  settings: boolean;
  plans: boolean;
  box: boolean;
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
  const pending: {key: string; before: string | null; after: string}[] = [];
  const nextBox =
    selected.box && backup.box
      ? buildBoxImport(
          boxStorageWriteFailed.value
            ? buildBoxImport(preview.box, exportOperatorBox())
            : preview.box,
          backup.box,
        )
      : undefined;
  if (nextBox)
    pending.push({
      key: BOX_STORAGE_KEY,
      before: preview.rawBox,
      after: JSON.stringify(nextBox),
    });
  if (selected.settings)
    pending.push({
      key: SETTINGS_STORAGE_KEY,
      before: preview.rawSettings,
      after: JSON.stringify(backup.settings),
    });
  // 包括确认时刚刚保存的本页草稿。改变预览基线后，让玩家重新查看差异。
  if (selected.plans && refreshMirrorPlans() !== preview.rawPlans)
    throw new Error(
      '其他标签页已更新流派或本页草稿已改变，请取消预览后重新取回。',
    );
  for (const {key, before} of pending) {
    if (localStorage.getItem(key) !== before)
      throw new Error('本站设置或 Box 已更新，请取消预览后重新取回。');
  }

  const written: typeof pending = [];
  let merged;
  try {
    for (const change of pending) {
      if (change.after === change.before) continue;
      localStorage.setItem(change.key, change.after);
      written.push(change);
    }
    if (selected.plans && backup.plans?.length) {
      if (localStorage.getItem(PLANS_STORAGE_KEY) !== preview.rawPlans)
        throw new Error('其他标签页已更新流派，请取消预览后重新取回。');
      merged = restorePlanBackup(backup.plans);
    }
  } catch (cause) {
    // 逐项回到原始字节（包括原本不存在的键）。其他标签页已改写的值归该页所有。
    let rollbackFailed = false;
    for (const {key, before, after} of written.reverse()) {
      try {
        if (localStorage.getItem(key) !== after) continue;
        if (before === null) localStorage.removeItem(key);
        else localStorage.setItem(key, before);
      } catch {
        rollbackFailed = true;
      }
    }
    if (rollbackFailed)
      throw new Error(
        '本机存储写入失败，部分内容未能撤回。请保留来源站存档，恢复存储权限后重新取回。',
        {cause},
      );
    const reason = cause instanceof Error ? cause.message : '';
    throw new Error(`本机存储写入失败，请检查空间或权限后重试。${reason}`, {
      cause,
    });
  }
  if (nextBox) acceptStoredBox(nextBox);
  if (selected.settings) acceptStoredSettings(backup.settings);
  return merged;
}
