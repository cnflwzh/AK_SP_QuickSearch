/**
 * 名称匹配：支持汉字、全拼、首字母，以及全拼前缀。
 *   冻河 ← "冻河" / "冻" / "donghe" / "dongh" / "dh" / "he"（从第二个字开始）
 * 拼音只从音节边界开始匹配，"he" 不会命中 "shen" 中间的 he。
 * 拼音表由 scripts/gen_pinyin.mjs 生成（data/pinyin.ts）。
 */
import {PINYIN} from '../../../data/pinyin.ts';
import type {PinyinIndex, PinyinReadings} from '../../../data/types.ts';

const ASCII = /^[a-z0-9]+$/;
const SEPARATORS = /[\s·・'"“”]/g;

/** 统一全半角、大小写与带调拼音；赛季拼音表用 v 表示 ü。 */
export function normalize(text: unknown): string {
  return String(text)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[üǖǘǚǜ]/g, 'v')
    .replace(/[āáǎàēéěèīíǐìōóǒòūúǔùńňǹḿ]/g, (ch) => ch.normalize('NFD')[0])
    .replace(SEPARATORS, '');
}

interface Reading {
  full: string;
  initials: string;
  /** 每个音节在全拼中的起点。 */
  offsets: number[];
}

// 只缓存赛季拼音表中的名称。用户可自由命名流派，名称也可能与 Object 原型属性同名。
const normalizedNames = new Map<string, string>();
// 同名实体在不同赛季可有不同读法，缓存以传入词表中的读音为键。
const readingCache = new Map<PinyinReadings, Reading[]>();

function normalizedName(name: string): string {
  const cached = normalizedNames.get(name);
  if (cached !== undefined) return cached;
  const value = normalize(name);
  if (Object.hasOwn(PINYIN, name)) normalizedNames.set(name, value);
  return value;
}

function readingsOf(value: PinyinReadings): readonly Reading[] {
  const cached = readingCache.get(value);
  if (cached) return cached;
  const readings = (typeof value === 'string' ? [value] : value).map(
    (reading) => {
      const syllables = reading.split(' ');
      let offset = 0;
      const offsets = syllables.map((syllable) => {
        const start = offset;
        offset += syllable.length;
        return start;
      });
      return {
        full: syllables.join(''),
        initials: syllables.map((s) => s[0]).join(''),
        offsets,
      };
    },
  );
  readingCache.set(value, readings);
  return readings;
}

function pinyinScore(value: PinyinReadings, q: string): number {
  let best = 0;
  for (const {full, initials, offsets} of readingsOf(value)) {
    if (full === q || initials === q) return 3;
    for (let i = 0; i < offsets.length; i++) {
      const hit = full.startsWith(q, offsets[i]) || initials.startsWith(q, i);
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
 * query 需先经过 normalize。index 默认使用当前赛季的词表。
 */
export function nameScore(
  name: string,
  query: string,
  index: PinyinIndex = PINYIN,
): number {
  if (!query) return 0;
  const n = normalizedName(name);
  if (n === query) return 3;
  if (n.includes(query)) return 2;
  return ASCII.test(query) && Object.hasOwn(index, name)
    ? pinyinScore(index[name], query)
    : 0;
}
