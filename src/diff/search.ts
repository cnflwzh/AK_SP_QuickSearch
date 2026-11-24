import {COMPARISON_PINYIN} from '../../data/comparison/pinyin.ts';
import {nameScore} from '../lib/ui/match.ts';

/** 在当前赛季及历史版本收录的读音中匹配名称。查询须先经过 normalize。 */
export function matchesComparisonName(
  name: string,
  normalizedQuery: string,
): boolean {
  return (
    nameScore(name, normalizedQuery) > 0 ||
    (Object.hasOwn(COMPARISON_PINYIN, name) &&
      nameScore(name, normalizedQuery, COMPARISON_PINYIN) > 0)
  );
}
