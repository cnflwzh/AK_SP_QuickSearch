import {
  ADDITIONAL_OPERATORS,
  OPERATOR,
  type CombatRole,
  type Operator,
} from '../../../data/index.ts';
import type {PlanOp} from '../plans/model.ts';
import {
  BORROWABLE_SIX_STARS,
  BOX_OPERATORS,
  OWNABLE_OPERATORS,
  BOX_RANK_BORROWED,
  BOX_RANK_META,
  boxRankOf,
  isBorrowableSixStar,
  lineupBoxCoverage,
  type BoxRank,
  type LineupBoxCoverage,
  type OperatorBox,
} from './model.ts';

export type OperatorBoxStatusKind =
  'owned-activated' | 'owned-untrained' | 'borrowed' | 'preset' | 'substitute';

export interface OperatorBoxStatus {
  readonly kind: OperatorBoxStatusKind;
  readonly rank: BoxRank;
  readonly label: string;
  readonly bonusText: string;
  /** 未持有且未借用的非特许 6★，实战会降级为原型/预备替补。 */
  readonly isSubstitute: boolean;
  /** 本体出战（自持、已借用或系统预设免借）。 */
  readonly available: boolean;
  readonly backupOperator?: string;
}

export interface LineupBoxSubstitute {
  readonly op: Operator;
  readonly core: boolean;
  readonly backupOperator?: string;
  readonly highImpact: boolean;
}

export interface LineupBoxUntrained {
  readonly op: Operator;
  readonly core: boolean;
}

export interface LineupBoxAssessment {
  readonly coverage: LineupBoxCoverage;
  readonly substitutes: readonly LineupBoxSubstitute[];
  readonly coreSubstitutes: readonly LineupBoxSubstitute[];
  readonly untrained: readonly LineupBoxUntrained[];
  /** 越高越适配当前账号：优先无替补，再看核心完整性与自持激活率。 */
  readonly fitScore: number;
}

export interface BoxPlanSource {
  readonly key: string;
  readonly name: string;
  readonly builtin: boolean;
  readonly ops: readonly PlanOp[];
}

export interface BorrowRecommendation {
  readonly op: Operator;
  readonly borrowed: boolean;
  readonly score: number;
  readonly coreCount: number;
  readonly buildCount: number;
  readonly altCount: number;
  readonly buildNames: readonly string[];
  readonly backupOperator?: string;
  readonly reserveBackup: boolean;
  readonly scarceRoles: readonly CombatRole[];
  readonly reasons: readonly string[];
}

export interface TrainingRecommendation {
  readonly op: Operator;
  readonly score: number;
  readonly coreCount: number;
  readonly buildCount: number;
  readonly altCount: number;
  readonly buildNames: readonly string[];
  readonly lowCost: boolean;
  readonly reasons: readonly string[];
}

const RESERVE_BACKUPS = new Set(
  ADDITIONAL_OPERATORS.filter((op) => op.source === 'reserve').map(
    (op) => op.name,
  ),
);

const SCARCE_ROLES: readonly CombatRole[] = [
  '反隐',
  '沉默',
  '元素输出',
  '元素回复',
  '真伤',
  '破抗',
];

/** 只有本赛季的自持或有效借用记录才开启账号适配，其他赛季存档不参与判断。 */
export function hasBoxEntries(
  box?: Readonly<OperatorBox>,
): box is Readonly<OperatorBox> {
  return (
    !!box && OWNABLE_OPERATORS.some((op) => boxRankOf(box, op.avatar) !== -1)
  );
}

/** 该干员在当前 Box 下是否会降级为替补干员（未持有且未借用的非特许 6★）。 */
export function isBoxSubstitute(
  op: Pick<Operator, 'avatar' | 'stars' | 'borrowable'>,
  box: Readonly<OperatorBox>,
): boolean {
  return isBorrowableSixStar(op) && boxRankOf(box, op.avatar) === -1;
}

/** 该干员在当前 Box 下是否能以本体出战。 */
export function isBoxAvailable(
  op: Pick<Operator, 'avatar' | 'stars' | 'borrowable'>,
  box: Readonly<OperatorBox>,
): boolean {
  return !isBoxSubstitute(op, box);
}

/** 返回干员在当前 Box 中的完整状态与局内生效口径。 */
export function operatorBoxStatus(
  op: Operator,
  box: Readonly<OperatorBox>,
): OperatorBoxStatus {
  const rank = boxRankOf(box, op.avatar);
  if (rank >= 1) {
    const meta = BOX_RANK_META[rank];
    return {
      kind: 'owned-activated',
      rank,
      label: `自持 · ${meta.label}`,
      bonusText: meta.bonusText,
      isSubstitute: false,
      available: true,
    };
  }
  if (rank === 0) {
    return {
      kind: 'owned-untrained',
      rank,
      label: '已持有 · 精0未练',
      bonusText: '精一可激活攻+5% 防+5%',
      isSubstitute: false,
      available: true,
    };
  }
  if (rank === BOX_RANK_BORROWED) {
    return {
      kind: 'borrowed',
      rank,
      label: '助战已借用',
      bonusText: '本体出战 · 无自持加成（等效精0）',
      isSubstitute: false,
      available: true,
    };
  }
  if (isBorrowableSixStar(op)) {
    return {
      kind: 'substitute',
      rank: -1,
      label: '未持有 · 未借用',
      bonusText: op.backupOperator
        ? `将替补为「${op.backupOperator}」`
        : '将由原型 / 预备干员替补',
      isSubstitute: true,
      available: false,
      backupOperator: op.backupOperator,
    };
  }
  return {
    kind: 'preset',
    rank: -1,
    label: op.stars === 6 ? '系统特许 6★' : '系统预设',
    bonusText: '免借直出本体 · 无自持加成',
    isSubstitute: false,
    available: true,
  };
}

/** 为一次候选排序检查一次账号资料。相同构筑收益下优先本体出战，再比较已激活的自持加成。 */
export function createBoxAffinityScorer(
  box?: Readonly<OperatorBox>,
): (op: Operator) => number {
  if (!hasBoxEntries(box)) return () => 0;
  return (op) => {
    const rank = boxRankOf(box, op.avatar);
    if (rank >= 1) return 0.12 + rank * 0.04;
    // 自持精零、已借用、免借的本体均无自持加成。
    return rank === -1 && isBorrowableSixStar(op) ? -0.75 : 0;
  };
}

/** 对单个干员返回账号排序权重，未记录当前赛季时返回 0。 */
export function boxAffinityScore(
  op: Operator,
  box?: Readonly<OperatorBox>,
): number {
  return createBoxAffinityScorer(box)(op);
}

/** 评估一套阵容在当前账号 Box 下的缺口、精 0 未激活与综合适配度。 */
export function evaluateLineupBox(
  ops: readonly PlanOp[],
  box: Readonly<OperatorBox>,
): LineupBoxAssessment {
  const names = ops.map((slot) => slot.name);
  const coverage = lineupBoxCoverage(names, box);
  const seen = new Set<string>();
  const substitutes: LineupBoxSubstitute[] = [];
  const untrained: LineupBoxUntrained[] = [];

  for (const slot of ops) {
    if (seen.has(slot.name)) continue;
    seen.add(slot.name);
    const op = OPERATOR[slot.name];
    if (!op || !op.stars) continue;
    const rank = boxRankOf(box, op.avatar);
    if (rank === 0) {
      untrained.push({op, core: Boolean(slot.core)});
    } else if (rank === -1 && isBorrowableSixStar(op)) {
      substitutes.push({
        op,
        core: Boolean(slot.core),
        backupOperator: op.backupOperator,
        highImpact:
          Boolean(slot.core) ||
          (Boolean(op.backupOperator) &&
            RESERVE_BACKUPS.has(op.backupOperator!)),
      });
    }
  }

  substitutes.sort(
    (a, b) =>
      +b.core - +a.core ||
      +b.highImpact - +a.highImpact ||
      b.op.tier - a.op.tier,
  );
  untrained.sort((a, b) => +b.core - +a.core || a.op.stars - b.op.stars);

  const coreSubstitutes = substitutes.filter((item) => item.core);
  // 先保「全员真身不缺核心」，再看自持激活比例和满练覆盖。
  const fitScore =
    1000 -
    coreSubstitutes.length * 180 -
    (substitutes.length - coreSubstitutes.length) * 85 +
    coverage.ratio * 60 +
    (coverage.total ? (coverage.maxed / coverage.total) * 18 : 0);

  return {
    coverage,
    substitutes,
    coreSubstitutes,
    untrained,
    fitScore,
  };
}

interface PlanUsage {
  core: number;
  main: number;
  alt: number;
  names: string[];
  custom: number;
}

function emptyUsage(): PlanUsage {
  return {core: 0, main: 0, alt: 0, names: [], custom: 0};
}

/** 一个流派对同一干员只记一次主选或一次备选，主选优先且与站位顺序无关。 */
function planUsage(
  plans: readonly BoxPlanSource[],
  selectedKeys?: ReadonlySet<string>,
) {
  const usage = new Map<string, PlanUsage>();
  for (const source of plans) {
    if (selectedKeys?.size && !selectedKeys.has(source.key)) continue;
    const main = new Set(source.ops.map((slot) => slot.name));
    const core = new Set(
      source.ops.filter((slot) => slot.core).map((slot) => slot.name),
    );
    const names = new Set([...main, ...source.ops.flatMap((slot) => slot.alt)]);
    for (const name of names) {
      const rec = usage.get(name) ?? emptyUsage();
      if (main.has(name)) {
        rec.main++;
        if (core.has(name)) rec.core++;
        if (!source.builtin) rec.custom++;
      } else {
        rec.alt++;
      }
      if (!rec.names.includes(source.name)) rec.names.push(source.name);
      usage.set(name, rec);
    }
  }
  return usage;
}

/** 计算当前账号未持有的非特许 6★ 的助战借用优先级，支持只围绕所选流派重算。 */
export function recommendBorrows(
  box: Readonly<OperatorBox>,
  plans: readonly BoxPlanSource[],
  selectedKeys?: ReadonlySet<string>,
): BorrowRecommendation[] {
  const usage = planUsage(plans, selectedKeys);
  const results: BorrowRecommendation[] = [];
  for (const op of BORROWABLE_SIX_STARS) {
    const rank = boxRankOf(box, op.avatar);
    if (rank >= 0) continue; // 已持有，无需助战
    const borrowed = rank === BOX_RANK_BORROWED;
    const referenced = usage.get(op.name);
    if (selectedKeys?.size && !referenced) continue;
    const u = referenced ?? emptyUsage();
    const reserveBackup =
      Boolean(op.backupOperator) && RESERVE_BACKUPS.has(op.backupOperator!);
    const scarceRoles = (op.roles ?? []).filter((role) =>
      SCARCE_ROLES.includes(role),
    );
    const score =
      u.core * 42 +
      u.main * 22 +
      u.custom * 14 +
      u.alt * 6 +
      (reserveBackup ? 16 : 6) +
      scarceRoles.length * 7 +
      op.tier * 2;

    const reasons: string[] = [];
    if (u.core > 0) reasons.push(`核心×${u.core}`);
    if (u.names.length > 0) {
      const preview = u.names.slice(0, 2).join(' / ');
      reasons.push(
        u.names.length > 2 ? `${preview} 等${u.names.length}套` : preview,
      );
    }
    if (u.alt > 0) reasons.push(`备选×${u.alt}`);
    if (reserveBackup) {
      reasons.push(`替补仅4★(${op.backupOperator})`);
    } else if (op.backupOperator) {
      reasons.push(`替补:${op.backupOperator}`);
    }
    if (scarceRoles.length > 0) {
      reasons.push(scarceRoles.slice(0, 2).join('/'));
    }

    results.push({
      op,
      borrowed,
      score,
      coreCount: u.core,
      buildCount: u.main,
      altCount: u.alt,
      buildNames: u.names,
      backupOperator: op.backupOperator,
      reserveBackup,
      scarceRoles,
      reasons,
    });
  }

  return results.sort(
    (a, b) =>
      b.score - a.score ||
      b.coreCount - a.coreCount ||
      b.buildCount - a.buildCount ||
      b.op.tier - a.op.tier ||
      a.op.name.localeCompare(b.op.name, 'zh-CN'),
  );
}

/** 找出已持有但精 0 未练、且在主流或自定义流派中出场的高性价比养成干员。 */
export function recommendTraining(
  box: Readonly<OperatorBox>,
  plans: readonly BoxPlanSource[],
  selectedKeys?: ReadonlySet<string>,
): TrainingRecommendation[] {
  const usage = planUsage(plans, selectedKeys);
  const results: TrainingRecommendation[] = [];
  for (const op of BOX_OPERATORS) {
    if (boxRankOf(box, op.avatar) !== 0) continue;
    const u = usage.get(op.name);
    if (!u || (u.main === 0 && u.alt === 0)) continue;
    const lowCost = op.stars <= 5;
    const score =
      u.core * 36 +
      u.main * 22 +
      u.custom * 14 +
      u.alt * 8 +
      (op.stars === 4 ? 14 : op.stars === 5 ? 9 : 4);

    const reasons: string[] = [];
    if (u.core > 0) reasons.push(`核心×${u.core}`);
    if (u.names.length > 0) {
      const preview = u.names.slice(0, 2).join(' / ');
      reasons.push(
        u.names.length > 2 ? `${preview} 等${u.names.length}套` : preview,
      );
    }
    reasons.push(lowCost ? `${op.stars}★低成本拉精一` : '6★拉精一激活+5%');

    results.push({
      op,
      score,
      coreCount: u.core,
      buildCount: u.main,
      altCount: u.alt,
      buildNames: u.names,
      lowCost,
      reasons,
    });
  }

  return results.sort(
    (a, b) =>
      b.score - a.score ||
      b.buildCount - a.buildCount ||
      a.op.stars - b.op.stars ||
      a.op.tier - b.op.tier,
  );
}
