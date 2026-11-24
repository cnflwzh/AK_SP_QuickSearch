import {
  RESTRICTED_MODE_COVENANTS,
  SEASON_META,
} from '../../../../data/index.ts';

export const ADVISOR_MODES = [
  {id: 'unknown', label: '未指定模式（手动录入缺席盟约）'},
  {id: 'restricted', label: '规程1–4 / 联合标准 / 极速'},
  {id: 'full', label: '规程5以上 / 联合险境以上'},
] as const;
export type AdvisorMode = (typeof ADVISOR_MODES)[number]['id'];
export {RESTRICTED_MODE_COVENANTS};
export type CandidateSource = 'shop' | 'promotion';
/** 晋升奖励高于当前招募等级一档，上限为六星。 */
export function promotionRewardTier(level: number): number {
  return Math.min(6, level + 1);
}
/** 对局长度独立于招募池；不预支条件隐藏轮。 */
export const ADVISOR_FORMATS = [
  {id: 'unknown', label: '未指定，只计当前回合'},
  {id: 'standard', label: `常规 · ${SEASON_META.roundLimits.standard}回合`},
  {id: 'fast', label: `极速 · ${SEASON_META.roundLimits.fast}回合`},
] as const;
export type AdvisorFormat = (typeof ADVISOR_FORMATS)[number]['id'];
/** 未知赛制不推断剩余回合数。 */
export function advisorRoundLimit(format: AdvisorFormat): number | null {
  switch (format) {
    case 'fast':
      return SEASON_META.roundLimits.fast;
    case 'standard':
      return SEASON_META.roundLimits.standard;
    default:
      return null;
  }
}
