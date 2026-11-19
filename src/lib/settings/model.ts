import {normalizeOperatorBox, type OperatorBox} from '../box/model.ts';
import {MAX_BACKUP_BYTES, readBackupPlans} from '../plans/backup.ts';
import type {Plan} from '../plans/model.ts';

export const CONTENT_TAB_IDS = [
  'fx',
  'bd',
  'cv',
  'op',
  'eq',
  'st',
  'ld',
  'nu',
] as const;
export type ContentTabId = (typeof CONTENT_TAB_IDS)[number];

export const CUSTOMIZABLE_TOOL_IDS = [
  'layers',
  'recruit',
  'bounty',
  'credit',
  'box',
  'dealer',
  'excuse',
] as const;
export type CustomizableToolId = (typeof CUSTOMIZABLE_TOOL_IDS)[number];

export type ThemePreference = 'system' | 'light' | 'dark';
export type CardDensity = 'auto' | 'comfortable' | 'compact';
export type FontScale = 'normal' | 'large';
export type DefaultTabSetting = 'last' | ContentTabId;

export interface UserSettings {
  theme: ThemePreference;
  cardDensity: CardDensity;
  fontScale: FontScale;
  reducedMotion: boolean;
  tabOrder: ContentTabId[];
  hiddenTabs: ContentTabId[];
  defaultTab: DefaultTabSetting;
  showTabCounts: boolean;
  showHeader: boolean;
  showRunBanner: boolean;
  showWikiLinks: boolean;
  showRequestButtons: boolean;
  showBoxBadges: boolean;
  showFooter: boolean;
  collapsePresetBuilds: boolean;
  defaultOperatorElite: boolean;
  enableHoverPeek: boolean;
  enableSwipeTabs: boolean;
  hiddenTools: CustomizableToolId[];
}

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

const isContentTabId = (value: unknown): value is ContentTabId =>
  typeof value === 'string' &&
  (CONTENT_TAB_IDS as readonly string[]).includes(value);

const isToolId = (value: unknown): value is CustomizableToolId =>
  typeof value === 'string' &&
  (CUSTOMIZABLE_TOOL_IDS as readonly string[]).includes(value);

const readBool = (
  record: Record<string, unknown>,
  key: keyof UserSettings,
  fallback: boolean,
): boolean => (typeof record[key] === 'boolean' ? record[key] : fallback);

function readEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === 'string' && allowed.includes(value as T)
    ? (value as T)
    : fallback;
}

export function createDefaultSettings(): UserSettings {
  return {
    theme: 'system',
    cardDensity: 'auto',
    fontScale: 'normal',
    reducedMotion: false,
    tabOrder: [...CONTENT_TAB_IDS],
    hiddenTabs: [],
    defaultTab: 'last',
    showTabCounts: true,
    showHeader: true,
    showRunBanner: true,
    showWikiLinks: true,
    showRequestButtons: true,
    showBoxBadges: true,
    showFooter: true,
    collapsePresetBuilds: false,
    defaultOperatorElite: false,
    enableHoverPeek: true,
    enableSwipeTabs: true,
    hiddenTools: [],
  };
}

export const DEFAULT_SETTINGS: Readonly<UserSettings> = Object.freeze({
  ...createDefaultSettings(),
  tabOrder: Object.freeze([...CONTENT_TAB_IDS]) as unknown as ContentTabId[],
  hiddenTabs: Object.freeze([]) as unknown as ContentTabId[],
  hiddenTools: Object.freeze([]) as unknown as CustomizableToolId[],
});

/** 将外部输入与已存设置归一化为有效配置，保证至少有一个可见栏目与一个可见子工具。 */
export function normalizeSettings(raw: unknown): UserSettings {
  const defaults = createDefaultSettings();
  if (!isRecord(raw)) return defaults;

  const orderSet = new Set<ContentTabId>();
  if (Array.isArray(raw.tabOrder)) {
    for (const item of raw.tabOrder) {
      if (isContentTabId(item)) orderSet.add(item);
    }
  }
  for (const fallbackId of CONTENT_TAB_IDS) {
    orderSet.add(fallbackId);
  }
  const tabOrder = [...orderSet];

  const hiddenTabSet = new Set<ContentTabId>();
  if (Array.isArray(raw.hiddenTabs)) {
    for (const item of raw.hiddenTabs) {
      if (isContentTabId(item)) hiddenTabSet.add(item);
    }
  }
  if (hiddenTabSet.size >= CONTENT_TAB_IDS.length) {
    hiddenTabSet.delete(tabOrder[0]);
  }
  const hiddenTabs = tabOrder.filter((id) => hiddenTabSet.has(id));

  const hiddenToolSet = new Set<CustomizableToolId>();
  if (Array.isArray(raw.hiddenTools)) {
    for (const item of raw.hiddenTools) {
      if (isToolId(item)) hiddenToolSet.add(item);
    }
  }
  if (hiddenToolSet.size >= CUSTOMIZABLE_TOOL_IDS.length) {
    hiddenToolSet.delete(CUSTOMIZABLE_TOOL_IDS[0]);
  }
  const hiddenTools = CUSTOMIZABLE_TOOL_IDS.filter((id) =>
    hiddenToolSet.has(id),
  );

  const requestedDefault = raw.defaultTab;
  const defaultTab: DefaultTabSetting =
    requestedDefault === 'last' ||
    (isContentTabId(requestedDefault) && !hiddenTabSet.has(requestedDefault))
      ? requestedDefault
      : 'last';

  return {
    theme: readEnum(raw.theme, ['system', 'light', 'dark'], defaults.theme),
    cardDensity: readEnum(
      raw.cardDensity,
      ['auto', 'comfortable', 'compact'],
      defaults.cardDensity,
    ),
    fontScale: readEnum(raw.fontScale, ['normal', 'large'], defaults.fontScale),
    reducedMotion: readBool(raw, 'reducedMotion', defaults.reducedMotion),
    tabOrder,
    hiddenTabs,
    defaultTab,
    showTabCounts: readBool(raw, 'showTabCounts', defaults.showTabCounts),
    showHeader: readBool(raw, 'showHeader', defaults.showHeader),
    showRunBanner: readBool(raw, 'showRunBanner', defaults.showRunBanner),
    showWikiLinks: readBool(raw, 'showWikiLinks', defaults.showWikiLinks),
    showRequestButtons: readBool(
      raw,
      'showRequestButtons',
      defaults.showRequestButtons,
    ),
    showBoxBadges: readBool(raw, 'showBoxBadges', defaults.showBoxBadges),
    showFooter: readBool(raw, 'showFooter', defaults.showFooter),
    collapsePresetBuilds: readBool(
      raw,
      'collapsePresetBuilds',
      defaults.collapsePresetBuilds,
    ),
    defaultOperatorElite: readBool(
      raw,
      'defaultOperatorElite',
      defaults.defaultOperatorElite,
    ),
    enableHoverPeek: readBool(raw, 'enableHoverPeek', defaults.enableHoverPeek),
    enableSwipeTabs: readBool(raw, 'enableSwipeTabs', defaults.enableSwipeTabs),
    hiddenTools,
  };
}

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
