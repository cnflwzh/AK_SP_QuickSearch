/** 局内记录和建议的稳定契约；序列化字段不随内部评估模块重命名。 */
import type { Operator } from '../../data/index.ts';
import type { Layers } from './planner.ts';
import type { FrontTargets } from './advisorPosition.ts';
import type { AdvisorFormat, AdvisorMode, CandidateSource } from './advisorRules.ts';
/** 同名干员合并记录；copies 是尚未合成的张数，精锐只保留一条记录。 */
export interface RecordedOperator {
  name: string;
  copies: number;
  elite: boolean;
  deployed: boolean;
}
/** 一条记录对应一个装备栏位；holder 为空表示仓库，进阶装备仍只占一格。 */
export interface OwnedEquipment {
  id: string;
  name: string;
  holder: string;
  advanced: boolean;
}
/** 独立保存的一局；商店名单只表示眼前候选，不代表已经持有。 */
export interface AdvisorRun {
  level: number;
  /** 已在游戏中使用人事部文档；仅持有装备不增加部署上限。 */
  personnelDocumentUsed: boolean;
  mode: AdvisorMode;
  format: AdvisorFormat;
  candidateSource: CandidateSource;
  round: number | null;
  funds: number | null;
  /** 本轮已确认获得人数；不根据持有列表反推，未知保持 null。 */
  acquisitionsThisRound: number | null;
  layers: Layers;
  frontTargets: FrontTargets;
  strategy: string;
  /** 手动记录本次主动指令是否可用，null 不推测剩余次数。 */
  commandAvailable: boolean | null;
  /** 空字符串自动判断；mixed 明确选择混搭，不锁定核心盟约。 */
  mainCovenant: string;
  /** 0 使用预设构筑目标；3/6 为玩家手动指定。 */
  mainTarget: 0 | 3 | 6;
  bannedCovenants: string[];
  /** 禁用干员，或本局没有选入招募池的可选干员。 */
  excludedOperators: string[];
  operators: RecordedOperator[];
  equipment: OwnedEquipment[];
  shop: string[];
}
export interface AdviceBreakdown {
  lineup: number;
  production: number;
  acquisition: number;
  collection: number;
  fit: number;
  economy: number;
}
export interface DeploymentAdvice {
  name: string;
  replace: string;
  score: number;
  preferenceScore: number;
  breakdown: {
    lineup: number;
    production: number;
    fill: number;
  };
  reasons: string[];
  losses: string[];
}
export interface RecruitAdvice {
  operator: Operator;
  kind: 'elite' | 'pair' | 'deploy' | 'replace' | 'reserve' | 'skip';
  label: string;
  /** 排序使用的相对收益，不是胜率或伤害预测。 */
  score: number;
  /** 仅当主要收益相同时，才比较策略和装备搭配。 */
  fitScore: number;
  /** 保存流派只在规则收益相同的时候排序，不计入收益总分。 */
  preferenceScore: number;
  breakdown: AdviceBreakdown;
  estimatedPrice: number | null;
  affordable: boolean | null;
  reasons: string[];
  losses: string[];
  replace: string;
}
