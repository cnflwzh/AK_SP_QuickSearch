import {toolStorageKeys} from '../lib/season/toolKeys.ts';
import {readonly, ref} from 'vue';
import {isValidRecentItem, MAX_RECENT_ITEMS, sanitizeRecentList, type RecentItem, type RecentKind} from '../lib/settings/recent.ts';
export {isValidRecentItem, MAX_RECENT_ITEMS, sanitizeRecentList, type RecentItem, type RecentKind} from '../lib/settings/recent.ts';
export const RECENT_STORAGE_KEY = toolStorageKeys.recent;
function readStoredRecent(fallback: RecentItem[] = []): RecentItem[] {
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    return sanitizeRecentList(JSON.parse(raw));
  } catch {
    return fallback;
  }
}

let unsavedRecent = false;
function writeStoredRecent(items: readonly RecentItem[]): void {
  try {
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(items));
    unsavedRecent = false;
  } catch {
    unsavedRecent = true;
  }
}

const recentList = ref<RecentItem[]>(readStoredRecent());
export const recentItems = readonly(recentList);
function syncRecent(event: StorageEvent): void {
  if (!unsavedRecent && (event.key === RECENT_STORAGE_KEY || event.key === null))
    recentList.value = readStoredRecent(recentList.value);
}
if (typeof window !== 'undefined') {
  window.addEventListener('storage', syncRecent);
  import.meta.hot?.dispose(() => window.removeEventListener('storage', syncRecent));
}

/** 记录用户主动查看的条目并置顶去重；无效实体忽略。 */
export function recordRecent(kind: RecentKind, name: string): void {
  if (!isValidRecentItem(kind, name)) return;
  const previous = unsavedRecent ? recentList.value : readStoredRecent(recentList.value);
  const next = [
    {kind, name},
    ...previous.filter(
      (item) => !(item.kind === kind && item.name === name),
    ),
  ].slice(0, MAX_RECENT_ITEMS);
  recentList.value = next;
  writeStoredRecent(next);
}

export function clearRecent(): void {
  recentList.value = [];
  writeStoredRecent([]);
}
