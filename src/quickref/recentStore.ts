import {seasonStorageKey} from '../lib/season/storage.ts';
import {readonly, ref} from 'vue';
import {
  COVENANTS,
  EQUIP,
  LEADER,
  OPERATOR,
  STRATEGY,
} from '../../data/index.ts';

export type RecentKind = 'op' | 'eq' | 'st' | 'cv' | 'ld';

export interface RecentItem {
  readonly kind: RecentKind;
  readonly name: string;
}

export const RECENT_STORAGE_KEY = seasonStorageKey('wsq.recent.v1');
export const MAX_RECENT_ITEMS = 8;

const VALID_KINDS: readonly RecentKind[] = ['op', 'eq', 'st', 'cv', 'ld'];

export function isValidRecentItem(kind: RecentKind, name: string): boolean {
  if (!name) return false;
  switch (kind) {
    case 'op':
      return Object.hasOwn(OPERATOR, name);
    case 'eq':
      return Object.hasOwn(EQUIP, name);
    case 'st':
      return Object.hasOwn(STRATEGY, name);
    case 'cv':
      return Object.hasOwn(COVENANTS, name);
    case 'ld':
      return Object.hasOwn(LEADER, name);
  }
}

export function sanitizeRecentList(raw: unknown): RecentItem[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const result: RecentItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const {kind, name} = entry as {kind?: unknown; name?: unknown};
    if (
      typeof kind !== 'string' ||
      typeof name !== 'string' ||
      !(VALID_KINDS as readonly string[]).includes(kind)
    ) {
      continue;
    }
    const typedKind = kind as RecentKind;
    if (!isValidRecentItem(typedKind, name)) continue;
    const key = `${typedKind}:${name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({kind: typedKind, name});
    if (result.length >= MAX_RECENT_ITEMS) break;
  }
  return result;
}

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
