/**
 * 名称匹配：支持汉字、全拼、首字母，以及全拼前缀。
 *   冻河 ← "冻河" / "冻" / "donghe" / "dongh" / "dh" / "he"（从第二个字开始）
 * 拼音只从音节边界开始匹配，"he" 不会命中 "shen" 中间的 he。
 * 拼音表由 scripts/gen_pinyin.mjs 生成（data/pinyin.ts）。
 */
import { PINYIN } from '../../data/pinyin.ts';

const ASCII = /^[a-z0-9]+$/;
const SEPARATORS = /[\s·・'"“”]/g;

export const normalize = (text: unknown) => String(text).toLowerCase().replace(SEPARATORS, '');

/** 名称 → [[音节, …], …]（每种读法一组），首次用到时缓存 */
const syllableCache = new Map<string, string[][]>();
function readingsOf(name: string): string[][] {
  if (!syllableCache.has(name)) {
    const value = PINYIN[name];
    const list = value ? (typeof value === 'string' ? [value] : value) : [];
    syllableCache.set(name, list.map(r => r.split(' ')));
  }
  return syllableCache.get(name)!;
}

function pinyinScore(name: string, q: string): number {
  let best = 0;
  for (const syllables of readingsOf(name)) {
    const full = syllables.join('');
    const initials = syllables.map(s => s[0]).join('');
    if (full === q || initials === q) return 3;
    for (let i = 0; i < syllables.length; i++) {
      const hit = syllables.slice(i).join('').startsWith(q) || initials.slice(i).startsWith(q);
      if (hit) {
        best = Math.max(best, i === 0 ? 2 : 1.5);
        break;
      }
    }
  }
  return best;
}

/**
 * 名称与查询的匹配度：
 *   3 = 完全一致（汉字、全拼或首字母）  2 = 包含 / 拼音前缀  1.5 = 拼音从中间的字开始  0 = 不匹配
 * query 需先经过 normalize。
 */
export function nameScore(name: string, query: string): number {
  const n = normalize(name);
  if (n === query) return 3;
  if (n.includes(query)) return 2;
  return ASCII.test(query) ? pinyinScore(name, query) : 0;
}
