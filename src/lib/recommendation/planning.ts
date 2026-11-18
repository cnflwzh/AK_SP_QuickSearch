/** 静态方案推荐：补位、备选与禁用替换，不推测真实商店或回合。 */
import {
  ALL_COVENANTS,
  COVENANTS,
  OPERATOR,
  OPERATORS,
  RESERVE_COVENANTS,
  buildByName,
  isCoreCovenant,
  type Operator,
} from '../../../data/index.ts';
import {
  bonusLayersOf,
  bonusNeedOf,
  covenantStats,
  covenantsOf,
  type CovenantStat,
} from '../plans/covenants.ts';
import {
  MAX_ALT,
  MAX_OPS,
  newSlot,
  type Layers,
  type PlanOp,
} from '../plans/model.ts';
/** 一次阵容变更的盟约变化；保留前后状态，供不同页面生成自己的说明。 */
export interface CovenantChange {
  covenant: string;
  kind: 'on' | 'bonus' | 'up' | 'off' | 'weaken';
  before?: CovenantStat;
  after?: CovenantStat;
}
/** 阵容收益与解释共用同一份结果，避免正分但没有实际收益的换人建议。 */
export interface LineupEvaluation {
  /** 相对原阵容的收益。 */
  score: number;
  /** 总分为正，且至少有一次盟约进度提升或主轴核心输出补入。 */
  improves: boolean;
  stats: CovenantStat[];
  changes: CovenantChange[];
}
export interface Suggestion {
  op: Operator;
  score: number;
  gains: Pick<CovenantChange, 'covenant' | 'kind'>[];
}
/** 推荐主轴：target 是本次构筑目标，不改变游戏实际的激活/强化门槛。 */
export interface LineupGoal {
  covenant: string;
  target: 3 | 6;
}
export interface LineupEvaluationOptions {
  /** undefined 自动识别；null 表示尚未确定主轴。 */
  goal?: LineupGoal | null;
  reserve?: readonly PlanOp[];
  bannedCovenants?: ReadonlySet<string>;
}

/** 依照已有预设区分混搭与六人主盟约；用户仍可在局内工具里手选目标。 */
export function defaultLineupGoal(covenant: string): LineupGoal {
  const build = buildByName(covenant);
  const members =
    build?.lineup.filter((name) => OPERATOR[name]?.covenants.includes(covenant))
      .length ?? 6;
  return {covenant, target: members < 6 ? 3 : 6};
}

/** 至少两名本家才自动确定方向；同人数先看用户的核心标记，仍相同则不强行选边。 */
export function inferPrimaryCovenant(ops: readonly PlanOp[]): string {
  const candidates = covenantStats(ops)
    .filter((stat) => stat.core && stat.members.length >= 2)
    .map((stat) => ({
      name: stat.name,
      count: stat.members.length,
      marked: ops.filter(
        (slot) => slot.core && stat.members.includes(slot.name),
      ).length,
    }))
    .sort((a, b) => b.count - a.count || b.marked - a.marked);
  const [first, second] = candidates;
  return first &&
    (!second || first.count !== second.count || first.marked !== second.marked)
    ? first.name
    : '';
}
const COV_INDEX = new Map(ALL_COVENANTS.map((name, i) => [name, i]));
const COV_RULES = ALL_COVENANTS.map((name) => {
  const cov = COVENANTS[name];
  const core = isCoreCovenant(name);
  const bonusNeed =
    cov.mechanics?.bonusNeed ?? (bonusNeedOf(cov.bonus) || (core ? 6 : 0));
  return {
    name,
    core,
    need: cov.need,
    bonusNeed,
    bonusLayers: bonusNeed ? 0 : bonusLayersOf(cov.bonus),
    countMode: cov.mechanics?.countMode ?? 'members',
    maxCount: cov.mechanics?.maxCount,
    addsCoreCount: cov.mechanics?.addsCoreCount ?? 0,
  };
});
const FIELD_ELITE_INDICES = COV_RULES.flatMap((rule, index) =>
  rule.countMode === 'fieldElites' ? [index] : [],
);
const CORE_BOOSTERS = COV_RULES.flatMap((rule, index) =>
  rule.addsCoreCount > 0 ? [{index, amount: rule.addsCoreCount}] : [],
);
const OP_INDEX = new Map(OPERATORS.map((op, i) => [op.name, i]));
const OP_BITS = OPERATORS.map((_, i) => 1n << BigInt(i));

function slotCovenants(slot: PlanOp): number[] {
  const {own, granted} = covenantsOf(slot);
  return [...new Set([...own, ...granted])].map((name) => COV_INDEX.get(name)!);
}
function lineupCounts(
  ops: readonly PlanOp[],
  reserve: readonly PlanOp[] = [],
): Uint8Array {
  const counts = new Uint8Array(ALL_COVENANTS.length),
    seen = new Set<string>();
  for (const slot of ops) {
    if (seen.has(slot.name) || !OPERATOR[slot.name]) continue;
    seen.add(slot.name);
    for (const index of slotCovenants(slot)) counts[index]++;
    if (slot.elite) {
      for (const index of FIELD_ELITE_INDICES) counts[index]++;
    }
  }
  // 同名在两个区域最多计一次；经济盟约保留各自的名字集合以支持装备赋予。
  for (const covenant of RESERVE_COVENANTS) {
    const members = new Set(
      ops
        .filter((slot) => {
          const tags = covenantsOf(slot);
          return tags.own.includes(covenant) || tags.granted.includes(covenant);
        })
        .map((slot) => slot.name),
    );
    for (const slot of reserve) {
      const tags = covenantsOf(slot);
      if (tags.own.includes(covenant) || tags.granted.includes(covenant))
        members.add(slot.name);
    }
    counts[COV_INDEX.get(covenant)!] = members.size;
  }
  return counts;
}

/**
 * 用整队状态评价候选：优先保住已有核心的激活/强化，再保附加盟约，
 * 尚未成型的盟约只给有限进度分，超过目标门槛的人数不继续加分。
 * 与 covenantStats 共用门槛来源，并计入调和、独行、精锐和装备赋予的盟约。
 */
function createCountScorer(
  ops: readonly PlanOp[],
  layers: Layers,
  bans: ReadonlySet<string> = new Set(),
  options: LineupEvaluationOptions = {},
): (counts: Uint8Array) => number {
  const inferred = inferPrimaryCovenant(
    ops.filter((slot) => !isBanned(slot.name, bans)),
  );
  const main =
    options.goal === undefined
      ? inferred
        ? defaultLineupGoal(inferred)
        : null
      : options.goal;
  const support = new Set(
    main ? (buildByName(main.covenant)?.addons ?? []) : [],
  );
  const original = new Map(
    covenantStats(ops, layers, options.reserve, options.bannedCovenants).map(
      (stat) => [stat.name, stat],
    ),
  );
  const goals = COV_RULES.map((rule) => {
    const was = original.get(rule.name);
    return {
      ...rule,
      banned: bans.has(rule.name),
      activation: was?.active
        ? rule.core
          ? 1000
          : 120
        : main?.covenant === rule.name || (!main && rule.core)
          ? 90
          : support.has(rule.name)
            ? 40
            : 12,
      bonus: was?.bonusActive ? (rule.core ? 700 : 80) : rule.core ? 50 : 8,
      // 主轴每补一名都有明确收益，不能在三人激活后把四、五人的进度截断。
      // 附加盟约的开门收益仍保留，但不足以单独压过主轴的一个成型位置。
      progress:
        main?.covenant === rule.name
          ? 200 * main.target
          : was
            ? rule.core
              ? 30
              : 10
            : 1,
      target:
        main?.covenant === rule.name
          ? main.target
          : was?.active
            ? rule.bonusNeed || rule.need
            : rule.need,
    };
  });
  return (counts) => {
    let score = 0;
    let extraCoreCount = 0;
    for (const booster of CORE_BOOSTERS) {
      const goal = goals[booster.index];
      const count = counts[booster.index];
      if (
        !goal.banned &&
        count >= goal.need &&
        (goal.maxCount === undefined || count <= goal.maxCount)
      ) {
        extraCoreCount += booster.amount;
      }
    }
    for (let i = 0; i < goals.length; i++) {
      const goal = goals[i],
        members = counts[i];
      if (!members || goal.banned) continue;
      const count = members + (goal.core ? extraCoreCount : 0);
      if (goal.maxCount !== undefined && count > goal.maxCount) continue;
      const active = count >= goal.need;
      const bonus =
        active &&
        (goal.bonusNeed
          ? count >= goal.bonusNeed
          : goal.bonusLayers > 0 &&
            (layers[goal.name] ?? 0) >= goal.bonusLayers);
      score += (active ? goal.activation : 0) + (bonus ? goal.bonus : 0);
      score += (goal.progress * Math.min(count, goal.target)) / goal.target;
    }
    return score;
  };
}

/** 新人保留该位置的装备；精锐和原干员的核心标记清除，备选不计入实际阵容。 */
function replacement(slot: PlanOp, name: string): PlanOp {
  return {name, elite: false, core: false, eq: [...slot.eq], alt: []};
}
function slotAffinity(slot: PlanOp, op: Operator): number {
  const original = OPERATOR[slot.name],
    alt = slot.alt.indexOf(op.name);
  // type 是叠层/作战/整备等特质类型，不是职业或战力评级。
  return (
    (alt >= 0 ? 6 - alt : 0) +
    (op.type === original.type ? 1.5 : 0) -
    Math.abs(op.tier - original.tier) * 0.45
  );
}
function changedCovenants(
  before: readonly CovenantStat[],
  after: readonly CovenantStat[],
): CovenantChange[] {
  const previous = new Map(before.map((stat) => [stat.name, stat]));
  const current = new Map(after.map((stat) => [stat.name, stat]));
  // 遍历完整盟约表，包含换人后彻底消失的盟约；仅遍历 after 会漏报这种损失。
  return ALL_COVENANTS.flatMap((covenant) => {
    const was = previous.get(covenant),
      next = current.get(covenant);
    const kind: CovenantChange['kind'] | null =
      was?.active && !next?.active
        ? 'off'
        : was?.bonusActive && !next?.bonusActive
          ? 'weaken'
          : next?.active && !was?.active
            ? 'on'
            : next?.bonusActive && !was?.bonusActive
              ? 'bonus'
              : next &&
                  !next.broken &&
                  next.next > 0 &&
                  next.count > (was?.count ?? 0)
                ? 'up'
                : null;
    return kind ? [{covenant, kind, before: was, after: next}] : [];
  });
}

/**
 * 为一份原阵容创建可复用的评估器，供流派补位与局内抓取共用。
 * ops 是变更前的上场阵容，layers 是已知层数（缺省按 0），options 提供主轴、禁用和整备区；
 * 返回函数接收候选阵容与变更后的整备区（省略则保持原整备区），
 * 输出相对收益、盟约状态和得失，不修改输入。原阵容或层数变化后应重新创建。
 * 候选范围、同名合成价值、策略偏好以及换人时装备是否继承，由调用场景决定。
 * 主轴/配合取自 data/builds.ts 已注明来源的预设；分值是推荐优先级，不是游戏属性或胜率。
 */
export function createLineupEvaluator(
  ops: readonly PlanOp[],
  layers: Layers = {},
  options: LineupEvaluationOptions = {},
): (next: readonly PlanOp[], reserve?: readonly PlanOp[]) => LineupEvaluation {
  const before = covenantStats(
    ops,
    layers,
    options.reserve,
    options.bannedCovenants,
  );
  const scoreCounts = createCountScorer(
    ops,
    layers,
    options.bannedCovenants,
    options,
  );
  const initial = scoreCounts(lineupCounts(ops, options.reserve));
  const inferred = inferPrimaryCovenant(
    ops.filter(
      (slot) =>
        !options.bannedCovenants ||
        !isBanned(slot.name, options.bannedCovenants),
    ),
  );
  const goal =
    options.goal === undefined
      ? inferred
        ? defaultLineupGoal(inferred)
        : null
      : options.goal;
  const carries = new Set(
    goal ? (buildByName(goal.covenant)?.carries ?? []) : [],
  );
  const carrierCount = (lineup: readonly PlanOp[]) =>
    new Set(
      lineup.filter((slot) => carries.has(slot.name)).map((slot) => slot.name),
    ).size;
  const initialCarriers = carrierCount(ops);
  return (next, reserve = options.reserve) => {
    const stats = covenantStats(next, layers, reserve, options.bannedCovenants);
    const changes = changedCovenants(before, stats);
    const carrierGain = carrierCount(next) - initialCarriers;
    const score =
      scoreCounts(lineupCounts(next, reserve)) - initial + carrierGain * 20;
    const improves =
      score > 0 &&
      (carrierGain > 0 ||
        changes.some(
          (change) =>
            change.kind === 'on' ||
            change.kind === 'bonus' ||
            (change.kind === 'up' &&
              (!!change.before || change.covenant === goal?.covenant)),
        ));
    return {score, improves, stats, changes};
  };
}

/** 返回加入后改善整队盟约的干员；layers 使用当前方案层数，函数不修改阵容。 */
export function suggestions(
  ops: readonly PlanOp[],
  limit = 8,
  layers: Layers = {},
): Suggestion[] {
  if (ops.length >= MAX_OPS) return [];
  const taken = new Set(ops.map((slot) => slot.name));
  const evaluate = createLineupEvaluator(ops, layers);
  return OPERATORS.filter((op) => !taken.has(op.name))
    .map((op) => ({op, evaluation: evaluate([...ops, newSlot(op.name)])}))
    .filter(({evaluation}) => evaluation.improves)
    .map(({op, evaluation}) => ({
      op,
      score: evaluation.score,
      gains: evaluation.changes.map(({covenant, kind}) => ({
        covenant,
        kind,
      })),
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.op.tier - b.op.tier ||
        OP_INDEX.get(a.op.name)! - OP_INDEX.get(b.op.name)!,
    )
    .slice(0, limit);
}

/** 在原位置实际换人后评价整队，计入该位置装备；优先保住成型盟约，再比较备选、特质类型和等阶。 */
export function alternatesFor(
  slot: PlanOp,
  ops: readonly PlanOp[],
  limit = 8,
  layers: Layers = {},
): Operator[] {
  if (!OPERATOR[slot.name]) return [];
  const taken = new Set([...ops.map((op) => op.name), ...slot.alt]);
  const evaluate = createCountScorer(ops, layers);
  return OPERATORS.filter((op) => !taken.has(op.name))
    .map((op) => {
      const lineup = ops.map((current) =>
        current.name === slot.name ? replacement(slot, op.name) : current,
      );
      return {
        op,
        score: evaluate(lineupCounts(lineup)) + slotAffinity(slot, op),
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        OP_INDEX.get(a.op.name)! - OP_INDEX.get(b.op.name)!,
    )
    .slice(0, limit)
    .map((result) => result.op);
}

/* ---------- 盟约被 ban ---------- */
export interface BanPick {
  name: string;
  replaces: string;
  alts: string[];
  gains: string[];
}
export interface BanResult {
  removed: string[];
  picks: BanPick[];
  ops: PlanOp[];
  /** 原本激活、换人后失效的盟约；被 ban 的盟约不计。 */
  lost: string[];
}
/** 当前赛季入门指南：核心缺席整组禁用；附加则仅所有原生附加均缺席时禁用。
 * 来源：ArknightsGameData 6f63c14 / story/activities/autochess/guide/mode_training_2/
 * guide_auto_chess_mode_training_2_stage_info.txt；装备赋予的盟约不改变招募资格。
 */
export const isBanned = (name: string, bans: ReadonlySet<string>): boolean => {
  const covenants = OPERATOR[name]?.covenants;
  if (!covenants) return false;
  if (covenants.some((c) => isCoreCovenant(c) && bans.has(c))) return true;
  const addons = covenants.filter((c) => !isCoreCovenant(c));
  return addons.length > 0 && addons.every((c) => bans.has(c));
};

type ReplacementCandidate = {
  name: string;
  bit: bigint;
  covenants: number[];
  affinity: number;
};
type ReplacementSearch = {
  choices: string[];
  counts: Uint8Array;
  used: bigint;
  affinity: number;
  score: number;
};
const REPLACEMENT_BEAM = 24;

/**
 * 对所有空位联合搜索，每层保留 24 套不同的候选阵容，计算量有固定上限。
 * forced 先锁定并预留干员，避免前面的自动推荐抢走后面手选的人；
 * layers 参与强化门槛计算。返回原站位顺序，保留装备，排除被 ban 与重复干员。
 * 此搜索以整队盟约和位置适配度评分，不修改输入。
 */
export function banReplace(
  ops: readonly PlanOp[],
  bans: readonly string[],
  forced: Readonly<Record<string, string>> = {},
  layers: Layers = {},
): BanResult {
  const banned = new Set(bans);
  const removed = ops.filter((slot) => isBanned(slot.name, banned));
  if (!removed.length)
    return {
      removed: [],
      picks: [],
      lost: [],
      ops: ops.map((slot) => ({
        ...slot,
        eq: [...slot.eq],
        alt: slot.alt.filter((name) => !isBanned(name, banned)),
      })),
    };
  const kept = ops.filter((slot) => !isBanned(slot.name, banned));
  const evaluate = createCountScorer(ops, layers, banned);
  const taken = new Set(kept.map((slot) => slot.name));
  const assignments = new Map<string, string>();
  // 先处理全部有效手选；同名冲突按原站位顺序保留一个，UI 会把最新选择设为唯一锁定。
  for (const slot of removed) {
    const name = forced[slot.name];
    if (OPERATOR[name] && !isBanned(name, banned) && !taken.has(name)) {
      assignments.set(slot.name, name);
      taken.add(name);
    }
  }
  const seeded = [
    ...kept,
    ...removed
      .filter((slot) => assignments.has(slot.name))
      .map((slot) => replacement(slot, assignments.get(slot.name)!)),
  ];
  const pending = removed
    .filter((slot) => !assignments.has(slot.name))
    .sort(
      (a, b) =>
        OPERATOR[b.name].tier - OPERATOR[a.name].tier ||
        OP_INDEX.get(a.name)! - OP_INDEX.get(b.name)!,
    );
  const available = OPERATORS.filter(
    (op) => !taken.has(op.name) && !isBanned(op.name, banned),
  );
  const counts = lineupCounts(seeded);
  let beam: ReplacementSearch[] = [
    {choices: [], counts, used: 0n, affinity: 0, score: evaluate(counts)},
  ];
  for (const slot of pending) {
    const candidates: ReplacementCandidate[] = available.map((op) => ({
      name: op.name,
      bit: OP_BITS[OP_INDEX.get(op.name)!],
      covenants: slotCovenants(replacement(slot, op.name)),
      affinity: slotAffinity(slot, op),
    }));
    const expanded: ReplacementSearch[] = [];
    for (const state of beam) {
      let added = false;
      for (const candidate of candidates) {
        if (state.used & candidate.bit) continue;
        const next = state.counts.slice();
        for (const index of candidate.covenants) next[index]++;
        const affinity = state.affinity + candidate.affinity;
        expanded.push({
          choices: [...state.choices, candidate.name],
          counts: next,
          used: state.used | candidate.bit,
          affinity,
          score: evaluate(next) + affinity,
        });
        added = true;
      }
      // 候选全部耗尽时保留未填空位，不能重用干员或偷偷引入被 ban 的干员。
      if (!added) expanded.push({...state, choices: [...state.choices, '']});
    }
    expanded.sort((a, b) => b.score - a.score);
    const seen = new Map<bigint, Set<string>>();
    beam = [];
    for (const state of expanded) {
      const signature = state.counts.join(',');
      const variants = seen.get(state.used) ?? new Set<string>();
      if (variants.has(signature)) continue;
      variants.add(signature);
      seen.set(state.used, variants);
      beam.push(state);
      if (beam.length === REPLACEMENT_BEAM) break;
    }
  }
  pending.forEach((slot, index) => {
    const name = beam[0]?.choices[index];
    if (name) assignments.set(slot.name, name);
  });
  const selected = new Set([
    ...kept.map((slot) => slot.name),
    ...assignments.values(),
  ]);
  const result = ops.flatMap((slot) => {
    const name = assignments.get(slot.name);
    if (isBanned(slot.name, banned) && !name) return [];
    return [
      {
        ...(name ? replacement(slot, name) : slot),
        eq: [...slot.eq],
        alt: slot.alt.filter(
          (alt) =>
            alt !== (name ?? slot.name) &&
            !selected.has(alt) &&
            !isBanned(alt, banned),
        ),
      },
    ];
  });
  const finalStats = covenantStats(result, layers, [], banned);
  const picks = removed.flatMap((slot) => {
    const name = assignments.get(slot.name);
    if (!name) return [];
    const without = result.filter((op) => op.name !== name);
    const withoutStats = new Map(
      covenantStats(without, layers, [], banned).map((stat) => [stat.name, stat]),
    );
    const gains = finalStats
      .filter(
        (stat) =>
          !stat.broken &&
          ((stat.active && !withoutStats.get(stat.name)?.active) ||
            (stat.bonusActive && !withoutStats.get(stat.name)?.bonusActive)),
      )
      .map((stat) => stat.name);
    const alternatives = OPERATORS.filter(
      (op) => !selected.has(op.name) && !isBanned(op.name, banned),
    )
      .map((op) => ({
        name: op.name,
        score:
          evaluate(lineupCounts([...without, replacement(slot, op.name)])) +
          slotAffinity(slot, op),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_ALT)
      .map((candidate) => candidate.name);
    return [{name, replaces: slot.name, alts: alternatives, gains}];
  });
  const active = new Set(
    finalStats.filter((stat) => stat.active).map((stat) => stat.name),
  );
  return {
    removed: removed.map((slot) => slot.name),
    picks,
    ops: result,
    lost: covenantStats(ops, layers)
      .filter(
        (stat) =>
          stat.active && !banned.has(stat.name) && !active.has(stat.name),
      )
      .map((stat) => stat.name),
  };
}
