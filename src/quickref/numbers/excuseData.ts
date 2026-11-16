import {BLAME_EXCUSES} from './copypastaExcuse.ts';
import {MANIA_EXCUSES} from './copypastaMania.ts';
import {TWIST_EXCUSES} from './copypastaTwist.ts';

export type ExcuseCategory = 'all' | 'twist' | 'mania' | 'excuse';

export const EXCUSE_SUBMIT_URL = 'https://wj.qq.com/s2/28706504/dfoc/';

export interface ExcuseItem {
  readonly id: string;
  readonly category: Exclude<ExcuseCategory, 'all'>;
  readonly text: string;
}

export const EXCUSE_CATEGORIES = [
  {id: 'all', label: '全部'},
  {id: 'twist', label: '情感反转'},
  {id: 'mania', label: '发病文学'},
  {id: 'excuse', label: '嘴硬甩锅'},
] as const;

export const EXCUSES: readonly ExcuseItem[] = [
  ...TWIST_EXCUSES,
  ...MANIA_EXCUSES,
  ...BLAME_EXCUSES,
];

export function pickRandomExcuse(
  pool: readonly ExcuseItem[],
  avoidId?: string,
  rand: () => number = Math.random,
): ExcuseItem | undefined {
  if (!pool.length) return undefined;
  const candidates =
    pool.length > 1 && avoidId
      ? pool.filter((item) => item.id !== avoidId)
      : pool;
  const idx = Math.floor(rand() * candidates.length) % candidates.length;
  return candidates[idx];
}
