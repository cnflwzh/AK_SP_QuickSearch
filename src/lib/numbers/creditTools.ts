import {
  CREDIT,
  CREDIT_MILESTONES,
  DIFFICULTIES,
  LEADER_CREDIT_BONUS,
  ROUND_TIME,
  SOLO_LEVELS,
} from '../../../data/index.ts';

export type CreditMode = 'joint' | 'solo';

export interface CreditCalculation {
  readonly roundsCleared: number;
  readonly defeatedLeader: boolean;
  readonly efficiency: number;
  readonly baseRoundCredit: number;
  readonly baseLeaderBonus: number;
  readonly perRun: number;
  readonly leaderBonus: number;
  readonly remainingCredit: number;
  readonly runsNeeded: number;
  /** 所选回合区间内的作战时限累计（秒），供玩家评估时间投入。 */
  readonly maxCombatSeconds: number;
}

export interface CreditComparisonRow {
  readonly id: string;
  readonly label: string;
  readonly efficiency: number;
  readonly strength: number | null;
  readonly note: string;
  readonly perRun: number;
  readonly leaderBonus: number;
  readonly runsNeeded: number;
  readonly active: boolean;
}

const MAX_ROUNDS = CREDIT.length;

function clampRounds(rounds: number): number {
  if (!Number.isFinite(rounds)) return MAX_ROUNDS;
  return Math.max(1, Math.min(MAX_ROUNDS, Math.round(rounds)));
}

/** 计算给定通过回合、是否击败领袖与效率百分比下的单局认证点数。 */
export function roundCredit(
  roundsCleared: number,
  efficiency: number,
  defeatedLeader = false,
): {perRun: number; roundPart: number; leaderBonus: number} {
  const rounds = clampRounds(roundsCleared);
  const ratio = Math.max(0, efficiency) / 100;
  const roundPart = Math.round((CREDIT[rounds - 1] ?? 0) * ratio);
  const canBonus = defeatedLeader && rounds >= MAX_ROUNDS;
  const leaderBonus = canBonus ? Math.round(LEADER_CREDIT_BONUS * ratio) : 0;
  return {
    perRun: roundPart + leaderBonus,
    roundPart,
    leaderBonus,
  };
}

/** 根据当前认证、目标认证与单局收益计算还需局数；已达标返回 0，无收益返回 Infinity。 */
export function runsNeededForCredit(
  currentCredit: number,
  targetCredit: number,
  perRun: number,
): number {
  const remaining = Math.max(0, Math.round(targetCredit) - Math.round(currentCredit));
  if (remaining <= 0) return 0;
  if (perRun <= 0) return Infinity;
  return Math.ceil(remaining / perRun);
}

/** 综合计算当前设置下的单局收益、剩余局数与参考作战时长上限。 */
export function calculateCreditPlan(options: {
  readonly efficiency: number;
  readonly roundsCleared: number;
  readonly defeatedLeader: boolean;
  readonly currentCredit: number;
  readonly targetCredit: number;
}): CreditCalculation {
  const rounds = clampRounds(options.roundsCleared);
  const defeatedLeader = options.defeatedLeader && rounds >= MAX_ROUNDS;
  const {perRun, leaderBonus} = roundCredit(
    rounds,
    options.efficiency,
    defeatedLeader,
  );
  const remainingCredit = Math.max(
    0,
    Math.round(options.targetCredit) - Math.round(options.currentCredit),
  );
  const runsNeeded = runsNeededForCredit(
    options.currentCredit,
    options.targetCredit,
    perRun,
  );
  const maxCombatSeconds = ROUND_TIME.slice(0, rounds).reduce(
    (sum, sec) => sum + sec,
    0,
  );
  return {
    roundsCleared: rounds,
    defeatedLeader,
    efficiency: options.efficiency,
    baseRoundCredit: CREDIT[rounds - 1] ?? 0,
    baseLeaderBonus: defeatedLeader ? LEADER_CREDIT_BONUS : 0,
    perRun,
    leaderBonus,
    remainingCredit,
    runsNeeded,
    maxCombatSeconds,
  };
}

/** 生成联合四档难度的横向收益对比，便于衡量“稳通低难 vs 翻车高难”。 */
export function compareJointDifficulties(options: {
  readonly roundsCleared: number;
  readonly defeatedLeader: boolean;
  readonly currentCredit: number;
  readonly targetCredit: number;
  readonly activeIndex: number;
}): CreditComparisonRow[] {
  const validDifficulties = DIFFICULTIES.filter((d) => d.efficiency > 0);
  return validDifficulties.map((item, index) => {
    const {perRun, leaderBonus} = roundCredit(
      options.roundsCleared,
      item.efficiency,
      options.defeatedLeader,
    );
    return {
      id: `joint:${index}`,
      label: item.name,
      efficiency: item.efficiency,
      strength: item.strength,
      note: item.note,
      perRun,
      leaderBonus,
      runsNeeded: runsNeededForCredit(
        options.currentCredit,
        options.targetCredit,
        perRun,
      ),
      active: index === options.activeIndex,
    };
  });
}

const KEY_SOLO_LEVELS = [1, 5, 9, 13, 15, 20] as const;

/** 生成个人规程关键档位（及当前所选档位）的横向对比。 */
export function compareSoloLevels(options: {
  readonly roundsCleared: number;
  readonly defeatedLeader: boolean;
  readonly currentCredit: number;
  readonly targetCredit: number;
  readonly activeLevel: number;
}): CreditComparisonRow[] {
  const levels = [
    ...new Set<number>([...KEY_SOLO_LEVELS, options.activeLevel]),
  ]
    .filter((lv) => lv >= 1 && lv <= SOLO_LEVELS.length)
    .sort((a, b) => a - b);
  return levels.map((level) => {
    const row = SOLO_LEVELS[level - 1];
    const {perRun, leaderBonus} = roundCredit(
      options.roundsCleared,
      row.efficiency,
      options.defeatedLeader,
    );
    return {
      id: `solo:${level}`,
      label: `规程 ${level}`,
      efficiency: row.efficiency,
      strength: row.strength,
      note: row.note,
      perRun,
      leaderBonus,
      runsNeeded: runsNeededForCredit(
        options.currentCredit,
        options.targetCredit,
        perRun,
      ),
      active: level === options.activeLevel,
    };
  });
}

export function defaultCreditTarget(): number {
  return (
    CREDIT_MILESTONES.find((m) => m.title.includes('上限'))?.value ??
    CREDIT_MILESTONES[CREDIT_MILESTONES.length - 1]?.value ??
    6250
  );
}
