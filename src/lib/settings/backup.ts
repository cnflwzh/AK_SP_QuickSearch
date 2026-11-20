import {normalizeOperatorBox, type OperatorBox} from '../box/model.ts';
import {MAX_BACKUP_BYTES, readBackupPlans} from '../plans/backup.ts';
import type {Plan} from '../plans/model.ts';
import {normalizeSettings, type UserSettings} from './model.ts';

export const SETTINGS_BACKUP_FORMAT = 'weishu-quickref-settings';
export const SETTINGS_BACKUP_VERSION = 1;
export const MAX_SETTINGS_BACKUP_BYTES = MAX_BACKUP_BYTES;

export interface SettingsBackup {
  format: typeof SETTINGS_BACKUP_FORMAT;
  version: typeof SETTINGS_BACKUP_VERSION;
  exportedAt: string;
  settings: UserSettings;
  plans?: Plan[];
  box?: OperatorBox;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** 序列化设置配置（可选附带自建/修改流派与个人干员练度 Box），供文件导出或跨设备迁移。 */
export function serializeSettingsBackup(
  settings: UserSettings,
  plans?: readonly Plan[],
  box?: Readonly<OperatorBox>,
): string {
  const cleanSettings = normalizeSettings(settings);
  const cleanBox = box ? normalizeOperatorBox(box) : undefined;
  const backup: SettingsBackup = {
    format: SETTINGS_BACKUP_FORMAT,
    version: SETTINGS_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings: cleanSettings,
    ...(plans ? {plans: JSON.parse(JSON.stringify(plans)) as Plan[]} : {}),
    ...(cleanBox && Object.keys(cleanBox).length ? {box: cleanBox} : {}),
  };
  const text = JSON.stringify(backup, null, 2);
  if (new TextEncoder().encode(text).length > MAX_SETTINGS_BACKUP_BYTES) {
    throw new Error('配置文件超过 5 MB，请取消打包流派后重试。');
  }
  return text;
}

/** 解析并校验导出的设置文件或配置文本；无效时抛出可直接展示的错误说明。 */
export function parseSettingsBackup(text: string): SettingsBackup {
  if (new TextEncoder().encode(text).length > MAX_SETTINGS_BACKUP_BYTES) {
    throw new Error('配置文件超过 5 MB，请重新选择设置备份文件。');
  }
  let value: unknown;
  try {
    value = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    throw new Error('无法解析 JSON，请粘贴完整配置文本或选择导出的配置文件。');
  }
  if (!isRecord(value)) {
    throw new Error('配置文件结构无效，请选择卫戍速查导出的设置文件。');
  }
  if (value.format === 'weishu-quickref-builds') {
    throw new Error('这是纯流派备份文件，请在「流派页 → 备份与恢复」中导入。');
  }
  if (value.format !== SETTINGS_BACKUP_FORMAT) {
    throw new Error('这不是卫戍速查的配置文件。');
  }
  if (value.version !== SETTINGS_BACKUP_VERSION) {
    throw new Error('此配置版本暂不支持，请更新页面后重新导出。');
  }
  if (
    typeof value.exportedAt !== 'string' ||
    !Number.isFinite(Date.parse(value.exportedAt)) ||
    !isRecord(value.settings)
  ) {
    throw new Error('配置文件数据不完整，请重新导出。');
  }
  const plans =
    value.plans !== undefined ? readBackupPlans(value.plans) : undefined;
  let box: OperatorBox | undefined;
  if (value.box !== undefined) {
    if (!isRecord(value.box)) {
      throw new Error('配置文件中的干员练度 Box 数据格式无效。');
    }
    box = normalizeOperatorBox(value.box);
  }
  return {
    format: SETTINGS_BACKUP_FORMAT,
    version: SETTINGS_BACKUP_VERSION,
    exportedAt: value.exportedAt,
    settings: normalizeSettings(value.settings),
    ...(plans ? {plans} : {}),
    ...(box && Object.keys(box).length ? {box} : {}),
  };
}
