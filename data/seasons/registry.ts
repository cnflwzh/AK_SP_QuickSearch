import type {SeasonDefinition} from '../types.ts';
import {S1_SEASON} from './s1/index.ts';

/** 供对比页和数据检查使用的完整赛季对象，按上线顺序排列。速查和教程从 data/season.ts 选取当前赛季。 */
export const SEASONS: readonly SeasonDefinition[] = [S1_SEASON];

export function getSeason(id: string): SeasonDefinition | undefined {
  return SEASONS.find((season) => season.meta.id === id);
}
