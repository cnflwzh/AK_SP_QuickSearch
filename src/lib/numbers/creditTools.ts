import {
  CREDIT,
  CREDIT_CAPS,
  DIFFICULTIES,
  LEADER_CREDIT_BONUS,
  QUICK_CREDIT_MODE,
  ROUND_TIME,
  SOLO_LEVELS,
} from '../../../data/index.ts';
import type {CreditTargetKind} from '../../../data/types.ts';

export type CreditMode = 'joint' | 'solo' | 'quick';

interface CreditPlanOptions {
  readonly mode?: CreditMode;
  readonly roundsCleared: number;
  readonly defeatedLeader: boolean;
  /** 作战获得与关键目标获得均为本序列累计，消费不扣减。 */
  readonly battleEarned?: number;
  readonly objectiveEarned?: number;
  /** 限时兑换累计消耗与当前可用余额分别填写，常规兑换不计入累消。 */
  readonly limitedSpend?: number;
  readonly balance?: number;
  readonly targetKind?: CreditTargetKind;
  readonly targetCredit: number;
  /** 兼容此前只记录作战获取进度的调用方。 */
  readonly currentCredit?: number;
}

export interface CreditCalculation {
  readonly roundsCleared: number;
  readonly defeatedLeader: boolean;
  readonly efficiency: number;
  readonly baseRoundCredit: number;
  readonly baseLeaderBonus: number;
  /** 预计下一局实际可得，含作战上限截断。 */
  readonly perRun: number;
  readonly uncappedPerRun: number;
  readonly leaderBonus: number;
  readonly progress: number;
  readonly remainingCredit: number;
  readonly battleNeeded: number;
  readonly objectiveNeeded: number;
  readonly unreachableCredit: number;
  /** 取得所需作战部分的局数。零收益时为 Infinity。 */
  readonly runsNeeded: number;
  readonly maxCombatSeconds: number;
}

export interface CreditComparisonRow {
  readonly id: string;
  readonly label: string;
  readonly efficiency: number;
  readonly strength: number | null;
  readonly note: string;
  readonly roundsCleared: number;
  readonly perRun: number;
  readonly leaderBonus: number;
  readonly runsNeeded: number;
  readonly active: boolean;
}

/** 返回所选模拟模式的最终领袖回合。 */
export function creditRoundLimit(mode: CreditMode = 'joint'): number {
  return mode === 'quick' ? QUICK_CREDIT_MODE.rounds : CREDIT.length;
}

function whole(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : 0;
}

/** 用通过回合数和整数百分比估算单局未封顶收益。领袖奖励计入总额后统一取最近整数。 */
export function roundCredit(
  roundsCleared: number,
  efficiency: number,
  defeatedLeader = false,
  mode: CreditMode = 'joint',
): {perRun: number; roundPart: number; leaderBonus: number} {
  const finalRound = creditRoundLimit(mode);
  const rounds = Math.min(finalRound, whole(roundsCleared));
  const base = CREDIT[rounds - 1] ?? 0;
  const bonus =
    defeatedLeader && rounds === finalRound ? LEADER_CREDIT_BONUS : 0;
  const percent = whole(efficiency);
  const roundPart = Math.round((base * percent) / 100);
  const perRun = Math.round(((base + bonus) * percent) / 100);
  return {perRun, roundPart, leaderBonus: perRun - roundPart};
}

/** 从当前进度到目标所需固定收益的局数，达标返回 0，零收益返回 Infinity。 */
export function runsNeededForCredit(
  currentCredit: number,
  targetCredit: number,
  perRun: number,
): number {
  const remaining = Math.max(0, whole(targetCredit) - whole(currentCredit));
  if (remaining === 0) return 0;
  return perRun > 0 ? Math.ceil(remaining / perRun) : Infinity;
}

/** 计算下一局可获认证及达标条件。优先使用已持有余额（累消目标）与可刷作战额度，
 * 再指出至少还需多少关键目标认证；超过当前序列可获上限的部分另列。
 */
export function calculateCreditPlan(
  options: CreditPlanOptions & {readonly efficiency: number},
): CreditCalculation {
  const mode = options.mode ?? 'joint';
  const finalRound = creditRoundLimit(mode);
  const rounds = Math.min(finalRound, whole(options.roundsCleared));
  const defeatedLeader = options.defeatedLeader && rounds === finalRound;
  const result = roundCredit(rounds, options.efficiency, defeatedLeader, mode);

  const battle = Math.min(
    CREDIT_CAPS.battle,
    whole(options.battleEarned ?? options.currentCredit),
  );
  const objectives = Math.min(
    CREDIT_CAPS.objectives,
    whole(options.objectiveEarned),
  );
  const kind = options.targetKind ?? 'battle';
  const progress =
    kind === 'spend'
      ? whole(options.limitedSpend)
      : kind === 'total'
        ? battle + objectives
        : battle;
  const remainingCredit = Math.max(0, whole(options.targetCredit) - progress);
  // 当期可消耗额度受限时商店库存限制，剩余余额也只能抵扣仍可消费的部分。
  const stockGap =
    kind === 'spend'
      ? Math.max(
          0,
          remainingCredit - Math.max(0, CREDIT_CAPS.limitedSpend - progress),
        )
      : 0;
  const fundsNeeded = Math.max(
    0,
    remainingCredit -
      stockGap -
      (kind === 'spend' ? whole(options.balance) : 0),
  );
  const battleRoom = CREDIT_CAPS.battle - battle;
  const battleNeeded = Math.min(fundsNeeded, battleRoom);
  const objectiveRoom =
    kind === 'battle' ? 0 : CREDIT_CAPS.objectives - objectives;
  const objectiveNeeded = Math.min(fundsNeeded - battleNeeded, objectiveRoom);
  const perRun = Math.min(battleRoom, result.perRun);

  // 极速的前八关沿用通常表，第九关直接进入领袖战。
  const normalRounds = Math.min(rounds, finalRound - 1);
  const combatSeconds = ROUND_TIME.slice(0, normalRounds).reduce(
    (sum, time) => sum + time,
    0,
  );
  return {
    roundsCleared: rounds,
    defeatedLeader,
    efficiency: options.efficiency,
    baseRoundCredit: CREDIT[rounds - 1] ?? 0,
    baseLeaderBonus: defeatedLeader ? LEADER_CREDIT_BONUS : 0,
    perRun,
    uncappedPerRun: result.perRun,
    leaderBonus: Math.max(0, perRun - result.roundPart),
    progress,
    remainingCredit,
    battleNeeded,
    objectiveNeeded,
    unreachableCredit: stockGap + fundsNeeded - battleNeeded - objectiveNeeded,
    runsNeeded: runsNeededForCredit(0, battleNeeded, result.perRun),
    maxCombatSeconds:
      combatSeconds + (rounds === finalRound ? (ROUND_TIME.at(-1) ?? 0) : 0),
  };
}

type RowMeta = Pick<
  CreditComparisonRow,
  'id' | 'label' | 'efficiency' | 'strength' | 'note' | 'active'
>;

function compareRow(
  options: CreditPlanOptions,
  mode: CreditMode,
  meta: RowMeta,
): CreditComparisonRow {
  // 比较完整通关时，各模式用自身的最终回合。中途结算按相同通过回合数对照。
  const finished = options.roundsCleared >= creditRoundLimit(options.mode);
  const roundsCleared = finished
    ? creditRoundLimit(mode)
    : options.roundsCleared;
  const plan = calculateCreditPlan({
    ...options,
    mode,
    roundsCleared,
    efficiency: meta.efficiency,
  });
  return {
    ...meta,
    roundsCleared: plan.roundsCleared,
    perRun: plan.perRun,
    leaderBonus: plan.leaderBonus,
    runsNeeded: plan.runsNeeded,
  };
}

/** 按当前结算条件、目标和剩余作战额度比较联合难度。 */
export function compareJointDifficulties(
  options: CreditPlanOptions & {readonly activeIndex: number},
): CreditComparisonRow[] {
  return DIFFICULTIES.filter((d) => d.efficiency > 0).map((item, index) =>
    compareRow(options, 'joint', {
      id: `joint:${index}`,
      label: item.name,
      efficiency: item.efficiency,
      strength: item.strength,
      note: item.note,
      active: index === options.activeIndex,
    }),
  );
}

const KEY_SOLO_LEVELS = [1, 5, 9, 13, 15, 20] as const;

/** 比较极速、个人规程关键档和当前档。完整通关按各自的领袖回合换算。 */
export function compareSoloLevels(
  options: CreditPlanOptions & {readonly activeLevel: number},
): CreditComparisonRow[] {
  const levels = [...new Set<number>([...KEY_SOLO_LEVELS, options.activeLevel])]
    .filter((level) => level >= 1 && level <= SOLO_LEVELS.length)
    .sort((a, b) => a - b);
  const quick = compareRow(options, 'quick', {
    id: 'quick:0',
    label: '极速模拟',
    efficiency: QUICK_CREDIT_MODE.efficiency,
    strength: null,
    note: `${QUICK_CREDIT_MODE.rounds} 回合`,
    active: options.mode === 'quick',
  });
  return [
    quick,
    ...levels.map((level) => {
      const row = SOLO_LEVELS[level - 1];
      return compareRow(options, 'solo', {
        id: `solo:${level}`,
        label: `规程 ${level}`,
        efficiency: row.efficiency,
        strength: row.strength,
        note: row.note,
        active: options.mode !== 'quick' && level === options.activeLevel,
      });
    }),
  ];
}

/** 新打开工具时，以本序列的作战获取上限为目标。 */
export function defaultCreditTarget(): number {
  return CREDIT_CAPS.battle;
}
