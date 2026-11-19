import type {SeasonDefinition} from '../types.ts';
import {S1_SEASON} from './s1/index.ts';

/** 全部已注册赛季，按上线时间顺序排列；新赛季就绪后追加至此表即可启用切换与 Diff。 */
export const SEASONS: readonly SeasonDefinition[] = [S1_SEASON];

export function getSeason(id: string): SeasonDefinition | undefined {
  return SEASONS.find((season) => season.meta.id === id);
}
