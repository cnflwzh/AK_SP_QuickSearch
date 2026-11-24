import {reactive} from 'vue';
import {
  CONTENT_TAB_IDS,
  CUSTOMIZABLE_TOOL_IDS,
  createDefaultSettings,
  normalizeSettings,
  type ContentTabId,
  type CustomizableToolId,
  type UserSettings,
} from './model.ts';

export const SETTINGS_STORAGE_KEY = 'wsq.settings.v1';

function readStoredSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return createDefaultSettings();
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return createDefaultSettings();
  }
}

export const settings = reactive<UserSettings>(readStoredSettings());

function writeStoredSettings(current: UserSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* 隐私模式或存储受限时保持当前会话有效。 */
  }
}

function updateThemeColorMeta(theme: UserSettings['theme']): void {
  if (typeof document === 'undefined') return;
  const lightMeta = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"][media*="light"]',
  );
  const darkMeta = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"][media*="dark"]',
  );
  if (lightMeta) {
    lightMeta.content = theme === 'dark' ? '#0a1214' : '#edf1f0';
  }
  if (darkMeta) {
    darkMeta.content = theme === 'light' ? '#edf1f0' : '#0a1214';
  }
}

export function applySettingsToDom(current: UserSettings = settings): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.toggleAttribute(
    'data-debug-bounds',
    current.developerMode && current.debugLayoutBounds,
  );
  if (current.theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = current.theme;
  root.dataset.density = current.cardDensity;
  if (current.fontScale === 'large') root.dataset.font = 'large';
  else delete root.dataset.font;
  if (current.reducedMotion) root.dataset.motion = 'reduce';
  else delete root.dataset.motion;
  if (current.enableHoverPeek) delete root.dataset.peek;
  else root.dataset.peek = 'off';
  if (current.showFooter) delete root.dataset.hideFooter;
  else root.dataset.hideFooter = '1';
  updateThemeColorMeta(current.theme);
}

function replaceSettings(next: unknown, persist = true): void {
  const clean = normalizeSettings(next);
  // 归一化会创建新数组；保留内容未变化的引用，避免切换主题也重建导航和工具列表。
  for (const key of ['tabOrder', 'hiddenTabs', 'hiddenTools'] as const) {
    if (
      clean[key].length === settings[key].length &&
      clean[key].every((value, index) => value === settings[key][index])
    ) {
      Object.assign(clean, {[key]: settings[key]});
    }
  }
  const domChanged =
    clean.theme !== settings.theme ||
    clean.cardDensity !== settings.cardDensity ||
    clean.fontScale !== settings.fontScale ||
    clean.reducedMotion !== settings.reducedMotion ||
    (clean.developerMode && clean.debugLayoutBounds) !==
      (settings.developerMode && settings.debugLayoutBounds) ||
    clean.enableHoverPeek !== settings.enableHoverPeek ||
    clean.showFooter !== settings.showFooter;
  Object.assign(settings, clean);
  if (persist) writeStoredSettings(settings);
  if (domChanged) applySettingsToDom(settings);
}

export function updateSetting<K extends keyof UserSettings>(
  key: K,
  value: UserSettings[K],
): void {
  replaceSettings({...settings, [key]: value});
}

export function applySettings(raw: unknown): void {
  replaceSettings(raw);
}

export function resetAllSettings(): void {
  replaceSettings(createDefaultSettings());
}

export function moveContentTab(id: ContentTabId, delta: -1 | 1): boolean {
  const index = settings.tabOrder.indexOf(id);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= settings.tabOrder.length) {
    return false;
  }
  const nextOrder = [...settings.tabOrder];
  [nextOrder[index], nextOrder[target]] = [nextOrder[target], nextOrder[index]];
  replaceSettings({...settings, tabOrder: nextOrder});
  return true;
}

export function reorderContentTabs(
  fromId: ContentTabId,
  toId: ContentTabId,
): boolean {
  if (fromId === toId) return false;
  const from = settings.tabOrder.indexOf(fromId);
  const to = settings.tabOrder.indexOf(toId);
  if (from < 0 || to < 0) return false;
  const nextOrder = [...settings.tabOrder];
  const [moved] = nextOrder.splice(from, 1);
  nextOrder.splice(to, 0, moved);
  replaceSettings({...settings, tabOrder: nextOrder});
  return true;
}

export function toggleContentTabHidden(id: ContentTabId): boolean {
  const currentlyHidden = settings.hiddenTabs.includes(id);
  if (!currentlyHidden && visibleContentTabs().length <= 1) {
    return false;
  }
  const hiddenTabs = currentlyHidden
    ? settings.hiddenTabs.filter((item) => item !== id)
    : [...settings.hiddenTabs, id];
  replaceSettings({...settings, hiddenTabs});
  return true;
}

export function resetContentTabs(): void {
  replaceSettings({
    ...settings,
    tabOrder: [...CONTENT_TAB_IDS],
    hiddenTabs: [],
    defaultTab: 'last',
  });
}

export function toggleToolHidden(id: CustomizableToolId): boolean {
  const currentlyHidden = settings.hiddenTools.includes(id);
  const hiddenSet = new Set(settings.hiddenTools);
  if (currentlyHidden) {
    hiddenSet.delete(id);
  } else {
    if (hiddenSet.size + 1 >= CUSTOMIZABLE_TOOL_IDS.length) return false;
    hiddenSet.add(id);
  }
  replaceSettings({...settings, hiddenTools: [...hiddenSet]});
  return true;
}

export function visibleContentTabs(): ContentTabId[] {
  const hidden = new Set(settings.hiddenTabs);
  return settings.tabOrder.filter((id) => !hidden.has(id));
}

let initialized = false;
export function initSettingsDom(): void {
  applySettingsToDom(settings);
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  window.addEventListener('storage', (event) => {
    if (event.key !== null && event.key !== SETTINGS_STORAGE_KEY) return;
    replaceSettings(readStoredSettings(), false);
  });
}
