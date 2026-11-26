import {
  COVENANTS,
  EQUIP,
  LEADER,
  OPERATOR,
  STRATEGY,
} from '../../../data/index.ts';

export type RecentKind = 'op' | 'eq' | 'st' | 'cv' | 'ld';

export interface RecentItem {
  readonly kind: RecentKind;
  readonly name: string;
}

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
