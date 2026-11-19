import type {
  Bounty,
  Equipment,
  Operator,
  Strategy,
} from '../../../data/index.ts';

export const DEALER_SHOP_SIZE = 5;
export const DAILY_ROUND_COUNT = 5;
export const RAGE_PER_HIT = 25;

export type DealerMode = 'daily' | 'free';
export type DealerKnowledgeRoundKind =
  | 'covenant'
  | 'transmute'
  | 'trigger'
  | 'tier_check'
  | 'equipment'
  | 'strategy'
  | 'bounty';
export type DealerRoundKind = DealerKnowledgeRoundKind | 'scenario';
export type DealerSelectionMode = 'impostors' | 'best_pick';
export type DealerScenarioArchetype =
  | 'covenant_step'
  | 'elite_promote'
  | 'budget_synergy';
export type EquipChallengeTheme =
  | 'transmute_capable'
  | 'upgradable'
  | 'consumable'
  | 'combo_recipe'
  | 'price_thrift';
export type TriggerChallengeTheme =
  'on_acquire' | 'rest_end' | 'prep_type' | 'in_battle_stack';
export type TierCheckTheme = 'low_shop_3' | 'high_core_56' | 'high_equip_56';
export type StrategyChallengeTheme =
  'faction_exclusive' | 'active_command' | 'stack_focus' | 'high_hp';
export type BountyChallengeTheme = 'big_bounty' | 'safe_bounty';
export type HintLevel = 'blind' | 'clue' | 'open';
export type HintBadgeTone = 'blind' | 'hinted' | 'assist';
export type CardStatus =
  'unseen' | 'punched' | 'shielded' | 'calibrated' | 'kept';
export type MatrixCell = '👊' | '⚡' | '🟩' | '💥';

export interface TraitSegment {
  readonly text: string;
  readonly kind: 'text' | 'trigger' | 'covenant' | 'num';
}

export interface CardRevealTag {
  readonly label: string;
  readonly covenant?: string;
  readonly match?: boolean;
  readonly mismatch?: boolean;
}

export interface DealerScenarioUnit {
  readonly name: string;
  readonly tier: number;
  readonly copies: number;
  readonly elite: boolean;
  readonly deployed: boolean;
}

export interface DealerScenarioCovenantHint {
  readonly name: string;
  readonly count: number;
  readonly need: number;
  readonly active: boolean;
}

export interface DealerScenarioContext {
  readonly archetype: DealerScenarioArchetype;
  readonly archetypeLabel: string;
  readonly level: number;
  readonly round: number;
  readonly funds: number;
  readonly strategy: string;
  readonly goalCovenant: string;
  readonly goalTarget: number;
  readonly deployed: readonly DealerScenarioUnit[];
  readonly reserve: readonly DealerScenarioUnit[];
  readonly covenantHints: readonly DealerScenarioCovenantHint[];
}

export interface DealerMistakeRecord {
  readonly key: string;
  readonly cardKind: 'operator' | 'equipment' | 'strategy' | 'bounty';
  readonly title: string;
  readonly detailKind?: 'op' | 'eq' | 'st';
  readonly roundKind: DealerKnowledgeRoundKind;
  readonly targetKey: string;
  readonly targetLabel: string;
  readonly wrongCount: number;
  readonly correctStreak: number;
  readonly lastWrongAt: number;
}

export interface DealerCard {
  readonly cardKind: 'operator' | 'equipment' | 'strategy' | 'bounty';
  readonly operator?: Operator;
  readonly equipment?: Equipment;
  readonly strategy?: Strategy;
  readonly bounty?: Bounty;
  readonly attachedEquip?: Equipment;
  readonly detailKind?: 'op' | 'eq' | 'st';
  readonly enemyId?: string;
  readonly title: string;
  readonly tier: number;
  readonly cornerBadge: string;
  readonly cornerBadgeHidden?: string;
  readonly hideTierBeforeReveal?: boolean;
  readonly isImpostor: boolean;
  readonly isBestPick?: boolean;
  readonly price?: number;
  readonly advisorRank?: number;
  readonly advisorLabel?: string;
  readonly advisorScore?: number;
  readonly advisorReasons?: readonly string[];
  readonly advisorLosses?: readonly string[];
  readonly advisorReplace?: string;
  readonly triggerHint: string;
  readonly secondaryClue: string;
  readonly traitSegments: readonly TraitSegment[];
  readonly revealTags: readonly CardRevealTag[];
  status: CardStatus;
}

export interface CovenantMemo {
  readonly covenant: string;
  readonly need: number;
  readonly summary: string;
  readonly bonus: string;
}

export interface DealerRound {
  readonly roundNumber: number;
  readonly kind: DealerRoundKind;
  readonly selectionMode?: DealerSelectionMode;
  readonly targetCovenant: string;
  readonly targetLabel: string;
  readonly missionTitle: string;
  readonly missionSummary: string;
  readonly missionBonus: string;
  readonly equipTheme?: EquipChallengeTheme;
  readonly triggerTheme?: TriggerChallengeTheme;
  readonly tierCheckTheme?: TierCheckTheme;
  readonly strategyTheme?: StrategyChallengeTheme;
  readonly bountyTheme?: BountyChallengeTheme;
  readonly scenarioContext?: DealerScenarioContext;
  readonly isMistakeReview?: boolean;
  readonly mistakeTargetKey?: string;
  readonly impostorTotal: number;
  readonly goodTotal: number;
  readonly introLine: string;
  readonly cards: DealerCard[];
  hintRevealed: boolean;
  usedHint: boolean;
}

export interface RoundResultSummary {
  readonly roundNumber: number;
  readonly roundKind: DealerRoundKind;
  readonly targetCovenant: string;
  readonly matrix: readonly MatrixCell[];
  readonly mistakes: number;
  readonly calibrated: boolean;
  readonly usedHint: boolean;
}

export interface DealerStats {
  readonly punched: number;
  readonly calibrated: number;
  readonly keptClean: number;
  readonly mistakes: number;
  readonly maxCombo: number;
  readonly roundsCleared: number;
  readonly hintsUsed?: number;
  readonly hintedRounds?: number;
}

export interface DealerRank {
  readonly title: string;
  readonly subtitle: string;
  readonly moodEmoji: string;
  readonly dealerDamage: string;
}

export type DealerGrade = 'SSS' | 'S' | 'A' | 'B';
export type VerdictTone = 'good' | 'ult' | 'warn' | 'muted' | 'empty';

export interface PosterRoundVerdict {
  readonly roundNumber: number;
  readonly scopeLabel: string;
  readonly icon: string;
  readonly filledCells: number;
  readonly title: string;
  readonly detail: string;
  readonly usedHint?: boolean;
  readonly tone: VerdictTone;
}

export interface PosterHintBadge {
  readonly text: string;
  readonly tone: HintBadgeTone;
}

export interface DealerPosterModel {
  readonly badgeText: string;
  readonly modeLabel: string;
  readonly hintBadge: PosterHintBadge;
  readonly summaryLine: string;
  readonly spoilerNotice: string;
  readonly grade: DealerGrade;
  readonly rank: DealerRank;
  readonly dealerArmorPct: number;
  readonly dealerQuote: string;
  readonly metrics: readonly {
    readonly label: string;
    readonly value: string;
    readonly unit: string;
    readonly tone: 'accent' | 'good' | 'warn' | 'teal';
  }[];
  readonly verdicts: readonly PosterRoundVerdict[];
  readonly ctaTitle: string;
  readonly shareUrl: string;
  readonly fileName: string;
}
