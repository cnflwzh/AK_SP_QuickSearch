/** 当前客户端静态规则；不是服务端发牌概率模型。来源详情见 docs/advisor-rule-audit.md。 */
export const ADVISOR_RULE_VERSION = 'act3autochess.V3_1 / CN 2.7.91';
export const ADVISOR_RULE_SOURCE = 'https://github.com/Kengxxiao/ArknightsGameData/blob/6f63c14e27b847ef74b53b00fe51fc322b3cd7ff/zh_CN/gamedata/excel/activity_table.json';
export const ADVISOR_MODES = [
  { id: 'unknown', label: '未指定模式（手动录入缺席盟约）' },
  { id: 'restricted', label: '规程1–4 / 联合标准 / 极速' },
  { id: 'full', label: '规程5以上 / 联合险境以上' },
] as const;
export type AdvisorMode = typeof ADVISOR_MODES[number]['id'];
export const RESTRICTED_MODE_COVENANTS: readonly string[] = ['阿戈尔', '卡西米尔', '灵巧', '奇迹', '投资人', '突袭', '独行', '绝技'];
export type CandidateSource = 'shop' | 'promotion';
export function promotionRewardTier(level: number): number { return Math.min(6, level + 1); }
