import {SEASONS} from '../seasons/registry.ts';
import type {SeasonDefinition} from '../types.ts';

/** 已收录版本的完整快照与分享链接使用的稳定 ID。 */
export interface ComparisonVersion {
  readonly id: string;
  readonly label: string;
  readonly season: SeasonDefinition;
}

/** 比较页独立入口。同季不同修订用 ruleVersion 区分，归档旧快照时须保留该值。 */
export const COMPARISON_VERSIONS: readonly ComparisonVersion[] = SEASONS.map(
  (season) => ({
    id: `${season.meta.id}@${season.meta.ruleVersion}`,
    label: `${season.meta.id.toUpperCase()} · ${season.meta.guideSubtitle}`,
    season,
  }),
);
