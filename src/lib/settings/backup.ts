import {LEGACY_SEASON_ID, SEASON_META} from '../../../data/index.ts';
import {checkBackupSeason} from '../season/storage.ts';
import {
  BOX_RANK_BORROWED,
  isValidOwnedBoxRank,
  mergeBoxRank,
  normalizeOperatorBox,
  resolveStoredBoxKey,
  type OperatorBox,
} from '../box/model.ts';
import {
  MAX_BACKUP_BYTES,
  planBackupVersion,
  readBackupPlans,
  serializeBackupDocument,
  writeBackupPlans,
} from '../plans/backup.ts';
import type {Plan} from '../plans/model.ts';
import {normalizeSettings, type UserSettings} from './model.ts';
import {
  countMigrationTools,
  readMigrationTools,
  type MigrationTools,
} from './migrationTools.ts';

export const SETTINGS_BACKUP_FORMAT = 'weishu-quickref-settings';
export const SETTINGS_BACKUP_VERSION = 5;
export const MAX_SETTINGS_BACKUP_BYTES = MAX_BACKUP_BYTES;

export interface SettingsBackup {
  format: typeof SETTINGS_BACKUP_FORMAT;
  version: 1 | 2 | 3 | 4 | typeof SETTINGS_BACKUP_VERSION;
  season?: string;
  exportedAt: string;
  settings: UserSettings;
  plans?: Plan[];
  box?: OperatorBox;
  tools?: MigrationTools;
  /** 只在跨季预览中出现；原文供玩家下载后在来源赛季恢复，不写入目标站。 */
  archive?: {
    season: string;
    exportedAt: string;
    plans: number;
    borrowed: number;
    otherBox: number;
    mistakes: number;
    recent: number;
    text: string;
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** 序列化设置配置（可选附带自建/修改流派与个人干员练度 Box），供文件导出或跨设备迁移。 */
export function serializeSettingsBackup(
  settings: UserSettings,
  plans?: readonly Plan[],
  box?: Readonly<OperatorBox>,
  tools?: MigrationTools,
): string {
  const cleanSettings = normalizeSettings(settings);
  const cleanBox = box ? normalizeOperatorBox(box) : undefined;
  const backup: SettingsBackup = {
    format: SETTINGS_BACKUP_FORMAT,
    version: tools
      ? SETTINGS_BACKUP_VERSION
      : plans?.length ||
          (cleanBox && Object.values(cleanBox).includes(BOX_RANK_BORROWED))
        ? planBackupVersion(plans)
        : 1,
    season: SEASON_META.id,
    exportedAt: new Date().toISOString(),
    settings: cleanSettings,
    ...(plans ? {plans: writeBackupPlans(plans)} : {}),
    ...(cleanBox && Object.keys(cleanBox).length ? {box: cleanBox} : {}),
    ...(tools ? {tools} : {}),
  };
  return serializeBackupDocument(
    backup,
    tools
      ? '迁移存档超过 5 MB，请检查流派和工具记录后重试。'
      : '配置文件超过 5 MB，请取消打包流派后重试。',
  );
}

/** 读取设置文件或文本。普通 v1–4 保持其原赛季限制，新的 v5 迁移文件支持跨季预览。 */
export function parseSettingsBackup(text: string): SettingsBackup {
  return parseBackup(text, false);
}

/** 显式域名迁移入口也接受旧站 v1–4 的输出；跨季仅提取通用设置及可识别的账号自持练度。 */
export function parseMigrationBackup(text: string): SettingsBackup {
  return parseBackup(text, true);
}

function parseBackup(text: string, migration: boolean): SettingsBackup {
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
  if (
    value.version !== 1 &&
    value.version !== 2 &&
    value.version !== 3 &&
    value.version !== 4 &&
    value.version !== SETTINGS_BACKUP_VERSION
  ) {
    throw new Error('此配置版本暂不支持，请更新页面后重新导出。');
  }
  if (
    typeof value.exportedAt !== 'string' ||
    !Number.isFinite(Date.parse(value.exportedAt)) ||
    !isRecord(value.settings)
  ) {
    throw new Error('配置文件数据不完整，请重新导出。');
  }
  if ((value.version === 5) !== (value.tools !== undefined))
    throw new Error('此配置的版本与工具备份格式不一致，请重新导出。');
  const migrating = migration || value.version === 5;
  const season =
    value.season ??
    (value.version < 4 && value.season === undefined ? LEGACY_SEASON_ID : null);
  const common = {
    format: SETTINGS_BACKUP_FORMAT,
    version: value.version,
    exportedAt: value.exportedAt,
    settings: normalizeSettings(value.settings),
  } as const;
  if (migrating) {
    if (
      typeof season !== 'string' ||
      !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(season)
    )
      throw new Error('无法识别迁移备份的来源赛季，请重新导出。');
    if (season !== SEASON_META.id) {
      if (
        value.plans !== undefined &&
        (!Array.isArray(value.plans) || !value.plans.every(isRecord))
      )
        throw new Error('迁移备份中的流派列表无效。');
      if (value.box !== undefined && !isRecord(value.box))
        throw new Error('迁移备份中的干员练度 Box 格式无效。');
      const box: OperatorBox = {};
      let borrowed = 0,
        otherBox = 0;
      for (const [label, rank] of Object.entries(value.box ?? {})) {
        if (rank === BOX_RANK_BORROWED) borrowed++;
        else if (isValidOwnedBoxRank(rank)) {
          // 此解析器保留不在当季图鉴的规范 charId，也识别已有的干员名称和形态别名。
          const key = label.length <= 128 ? resolveStoredBoxKey(label) : '';
          if (key) mergeBoxRank(box, key, rank);
          else otherBox++;
        } else if (rank !== -1) throw new Error('迁移备份中的干员练度值无效。');
      }
      return {
        ...common,
        season,
        ...(Object.keys(box).length ? {box} : {}),
        tools: {},
        archive: {
          season,
          exportedAt: common.exportedAt,
          text,
          plans: value.plans?.length ?? 0,
          borrowed,
          otherBox,
          ...countMigrationTools(value.version === 5 ? value.tools : {}),
        },
      };
    }
  }
  // 普通旧文件仍要求实际的阵容或助战选择与当前赛季一致。
  if (
    (Array.isArray(value.plans) && value.plans.length) ||
    (isRecord(value.box) &&
      Object.values(value.box).includes(BOX_RANK_BORROWED))
  )
    checkBackupSeason(
      value.version >= 4 ? (value.season ?? null) : value.season,
    );
  const plans =
    value.plans !== undefined ? readBackupPlans(value.plans) : undefined;
  const tools = migrating
    ? readMigrationTools(value.version === 5 ? value.tools : {})
    : undefined;
  let box: OperatorBox | undefined;
  if (value.box !== undefined) {
    if (!isRecord(value.box)) {
      throw new Error('配置文件中的干员练度 Box 数据格式无效。');
    }
    box = normalizeOperatorBox(value.box);
  }
  return {
    ...common,
    season: SEASON_META.id,
    ...(plans ? {plans} : {}),
    ...(box && Object.keys(box).length ? {box} : {}),
    ...(tools ? {tools} : {}),
  };
}
