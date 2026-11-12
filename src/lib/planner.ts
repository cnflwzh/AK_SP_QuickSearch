/**
 * 阵容规划器：盟约统计、补位推荐、费用、分享码与本地存档。只依赖 data/。
 *
 * 规则（与图解教程一致）
 *   - 场上至多 8 名干员；同名只算一次，3 张同名合成精锐（星极 2 张）
 *   - 每名干员至多 2 件装备；同名两件 → 进阶；【变形同构体】让携带者获得另一件装备对应的盟约
 *   - 核心盟约 3 人激活、6 名不同干员强化；附加盟约按各自人数 / 层数门槛
 *   - 【调和】：场上核心盟约激活人数 +1；【独行】：恰好 1 名时生效
 */
import {
  OPERATORS, OPERATOR, EQUIPMENT, EQUIP, EQUIPMENT_COMBOS, STRATEGIES, STRATEGY, COVENANTS, ALL_COVENANTS,
  isCoreCovenant, operatorPrice, buildByName, type Operator,
} from '../../data/index.ts';
import { BitWriter, writeShareText, readShareText, packSharePayload, unpackSharePayload } from './shareCodec.ts';

export const MAX_OPS = 8;
export const MAX_EQ = 2;
/** 每个位置的备选干员数：抓不到主选时的次级选择 */
export const MAX_ALT = 3;
/** 流派说明字数上限 */
export const MAX_NOTE = 150;
/** 盟约层数：滑条到 1000，输入框可以填到 9999 */
export const LAYER_SLIDER = 1000;
export const MAX_LAYERS = 9999;
const ISOMORPH = '变形同构体';

/** core：用户标注的核心干员，仅用于展示；alt：主选抓不到时的备选名单，不计入盟约统计。 */
export interface PlanOp { name: string; elite: boolean; core: boolean; eq: string[]; alt: string[] }
/** layers：各盟约自己的层数（只记效果随层数变化的盟约） */
export type Layers = Record<string, number>;
/** base：改自哪个内置流派（同名内置流派由这份修改版代替）；没有 = 自建流派 */
export interface Plan { id: string; name: string; ops: PlanOp[]; strategy: string; note: string; layers: Layers; updated: number; base?: string }

/* ---------- 盟约 ---------- */

export interface CovenantStat {
  name: string;
  core: boolean;
  /** 计入的不同干员（含装备赋予） */
  members: string[];
  /** 其中靠【变形同构体】获得的 */
  granted: string[];
  /** 额外人数（调和） */
  extra: number;
  count: number;
  need: number;
  /** 强化的人数门槛（0 = 无） */
  bonusNeed: number;
  /** 强化的层数门槛（0 = 无） */
  bonusLayers: number;
  /** 绝技：强化数的是全场精锐数 */
  bonusElite: boolean;
  bonusCount: number;
  active: boolean;
  bonusActive: boolean;
  /** 离下一个人数门槛还差几人；0 = 已到顶或只剩层数门槛 */
  next: number;
  /** 独行：人数超过 1 反而失效 */
  broken: boolean;
}

/** 某名干员（含装备）提供的盟约 */
export function covenantsOf(slot: PlanOp): { own: readonly string[]; granted: string[] } {
  const own = OPERATOR[slot.name]?.covenants ?? [];
  const granted = slot.eq.includes(ISOMORPH)
    ? slot.eq.map(name => EQUIP[name]?.covenant).filter((c): c is string => !!c && !own.includes(c))
    : [];
  return { own, granted: [...new Set(granted)] };
}

const bonusNeedOf = (bonus: string): number => +(bonus.match(/^(\d+)名(?!精锐)/)?.[1] ?? 0);
const bonusLayersOf = (bonus: string): number => +(bonus.match(/(\d+)层/)?.[1] ?? 0);

/** 效果或强化条件里出现“层”的盟约，才需要填层数 */
export const usesLayers = (name: string): boolean => /层/.test(COVENANTS[name].effect + COVENANTS[name].bonus);
const clampLayers = (n: unknown): number => Math.max(0, Math.min(MAX_LAYERS, Math.round(+(n as number) || 0)));

export function covenantStats(ops: readonly PlanOp[], layers: Layers = {}): CovenantStat[] {
  const members = new Map<string, Set<string>>(), granted = new Map<string, Set<string>>();
  for (const slot of ops) {
    const { own, granted: extra } = covenantsOf(slot);
    for (const c of [...own, ...extra]) (members.get(c) ?? members.set(c, new Set()).get(c)!).add(slot.name);
    for (const c of extra) (granted.get(c) ?? granted.set(c, new Set()).get(c)!).add(slot.name);
  }
  // 绝技按全场精锐计数，不依赖干员原有盟约；数据表里没有原生绝技干员。
  const eliteMembers = new Set(ops.filter(o => o.elite).map(o => o.name));
  if (eliteMembers.size) members.set('绝技', eliteMembers);
  const harmony = members.has('调和');
  const elites = eliteMembers.size;
  // 强化状态随层数变化，只更新数值和提示，避免拖动层数时列表跳位。
  return ALL_COVENANTS.filter(name => members.has(name)).map(name => {
    const cov = COVENANTS[name], core = isCoreCovenant(name);
    const list = [...members.get(name)!];
    const extra = core && harmony ? 1 : 0;
    const count = list.length + extra;
    const bonusElite = name === '绝技';
    const bonusNeed = bonusElite ? 5 : bonusNeedOf(cov.bonus) || (core ? 6 : 0);
    const bonusLayers = bonusNeed ? 0 : bonusLayersOf(cov.bonus);
    const broken = name === '独行' && count > 1;
    const active = !broken && count >= cov.need;
    const bonusCount = bonusElite ? elites : count;
    const bonusActive = active && (bonusNeed ? bonusCount >= bonusNeed : bonusLayers ? (layers[name] ?? 0) >= bonusLayers : false);
    const next = broken ? 0 : count < cov.need ? cov.need - count : bonusNeed && !bonusElite && count < bonusNeed ? bonusNeed - count : 0;
    return {
      name, core, members: list, granted: [...(granted.get(name) ?? [])], extra, count, need: cov.need,
      bonusNeed, bonusLayers, bonusElite, bonusCount, active, bonusActive, next, broken,
    };
  }).sort((a, b) => +b.active - +a.active || +b.core - +a.core || b.count - a.count);
}

/** 把 "(23+0.9×层)" 换成该层数下的数值 */
export const atLayers = (text: string, layers: number): string =>
  text.replace(/\((\d+(?:\.\d+)?)\+(\d+(?:\.\d+)?)×层\)/g, (match, a: string, b: string, offset: number) => {
    const value = Math.round((+a + +b * layers) * 100) / 100;
    return String(/^%\s*概率/.test(text.slice(offset + match.length)) ? Math.min(100, value) : value);
  });

/* ---------- 阵容评价与补位推荐 ---------- */

export interface Suggestion { op: Operator; score: number; gains: { covenant: string; kind: 'on' | 'bonus' | 'up' | 'off' }[] }
const COV_INDEX = new Map(ALL_COVENANTS.map((name, i) => [name, i]));
const HARMONY_INDEX = COV_INDEX.get('调和')!;
const ELITE_INDEX = COV_INDEX.get('绝技')!;
const COV_RULES = ALL_COVENANTS.map(name => ({
  name, core: isCoreCovenant(name), need: COVENANTS[name].need,
  bonusNeed: name === '绝技' ? 5 : bonusNeedOf(COVENANTS[name].bonus) || (isCoreCovenant(name) ? 6 : 0),
  bonusLayers: bonusLayersOf(COVENANTS[name].bonus), solo: name === '独行',
}));
const OP_INDEX = new Map(OPERATORS.map((op, i) => [op.name, i]));
const OP_BITS = OPERATORS.map((_, i) => 1n << BigInt(i));

function slotCovenants(slot: PlanOp): number[] {
  const { own, granted } = covenantsOf(slot);
  return [...new Set([...own, ...granted])].map(name => COV_INDEX.get(name)!);
}
function lineupCounts(ops: readonly PlanOp[]): Uint8Array {
  const counts = new Uint8Array(ALL_COVENANTS.length), seen = new Set<string>();
  for (const slot of ops) {
    if (seen.has(slot.name) || !OPERATOR[slot.name]) continue;
    seen.add(slot.name);
    for (const index of slotCovenants(slot)) counts[index]++;
    if (slot.elite) counts[ELITE_INDEX]++;
  }
  return counts;
}

/**
 * 用整队状态评价候选：优先保住已有核心的激活/强化，再保附加盟约，
 * 尚未成型的盟约只给有限进度分，超过目标门槛的人数不继续加分。
 * 与 covenantStats 共用门槛来源，并计入调和、独行、精锐和装备赋予的盟约。
 */
function lineupEvaluator(ops: readonly PlanOp[], layers: Layers, bans: ReadonlySet<string> = new Set()): (counts: Uint8Array) => number {
  const original = new Map(covenantStats(ops, layers).map(stat => [stat.name, stat]));
  const goals = COV_RULES.map(rule => {
    const was = original.get(rule.name);
    return {
      ...rule, banned: bans.has(rule.name),
      activation: was?.active ? rule.core ? 1000 : 120 : rule.core ? 90 : 12,
      bonus: was?.bonusActive ? rule.core ? 700 : 80 : rule.core ? 50 : 8,
      progress: was ? rule.core ? 30 : 10 : 1,
      target: was ? Math.min(Math.max(was.count, rule.need), rule.bonusNeed || rule.need) : rule.need,
    };
  });
  return counts => {
    let score = 0;
    const harmony = counts[HARMONY_INDEX] > 0;
    for (let i = 0; i < goals.length; i++) {
      const goal = goals[i], members = counts[i];
      if (!members || goal.banned) continue;
      const count = members + (goal.core && harmony ? 1 : 0);
      if (goal.solo && count !== 1) continue;
      const active = count >= goal.need;
      const bonus = active && (goal.bonusNeed ? count >= goal.bonusNeed : goal.bonusLayers > 0 && (layers[goal.name] ?? 0) >= goal.bonusLayers);
      score += (active ? goal.activation : 0) + (bonus ? goal.bonus : 0);
      score += goal.progress * Math.min(count, goal.target) / goal.target;
    }
    return score;
  };
}

/** 新人保留该位置的装备；精锐和原干员的核心标记清除，备选不计入实际阵容。 */
function replacement(slot: PlanOp, name: string): PlanOp {
  return { name, elite: false, core: false, eq: [...slot.eq], alt: [] };
}
function slotAffinity(slot: PlanOp, op: Operator): number {
  const original = OPERATOR[slot.name], alt = slot.alt.indexOf(op.name);
  // type 是叠层/作战/整备等特质类型，不是职业或战力评级。
  return (alt >= 0 ? 6 - alt : 0) + (op.type === original.type ? 1.5 : 0) - Math.abs(op.tier - original.tier) * .45;
}
function changedCovenants(before: readonly CovenantStat[], after: readonly CovenantStat[]): Suggestion['gains'] {
  const previous = new Map(before.map(stat => [stat.name, stat]));
  return after.flatMap(next => {
    const was = previous.get(next.name);
    const kind: Suggestion['gains'][number]['kind'] | null = was?.active && !next.active ? 'off'
      : next.active && !was?.active ? 'on'
      : next.bonusActive && !was?.bonusActive ? 'bonus'
      : was && !next.broken && next.next > 0 && next.count > was.count ? 'up' : null;
    return kind ? [{ covenant: next.name, kind }] : [];
  });
}

/** 返回加入后改善整队盟约的干员；layers 使用当前方案层数，函数不修改阵容。 */
export function suggestions(ops: readonly PlanOp[], limit = 8, layers: Layers = {}): Suggestion[] {
  if (ops.length >= MAX_OPS) return [];
  const taken = new Set(ops.map(slot => slot.name)), before = covenantStats(ops, layers);
  const evaluate = lineupEvaluator(ops, layers), initial = evaluate(lineupCounts(ops));
  return OPERATORS.filter(op => !taken.has(op.name)).map(op => {
    const lineup = [...ops, newSlot(op.name)];
    return { op, score: evaluate(lineupCounts(lineup)) - initial,
      gains: changedCovenants(before, covenantStats(lineup, layers)) };
  }).filter(result => result.score > 0 && result.gains.some(gain => gain.kind !== 'off'))
    .sort((a, b) => b.score - a.score || a.op.tier - b.op.tier || OP_INDEX.get(a.op.name)! - OP_INDEX.get(b.op.name)!)
    .slice(0, limit);
}

/** 在原位置实际换人后评价整队，计入该位置装备；优先保住成型盟约，再比较备选、特质类型和等阶。 */
export function alternatesFor(slot: PlanOp, ops: readonly PlanOp[], limit = 8, layers: Layers = {}): Operator[] {
  if (!OPERATOR[slot.name]) return [];
  const taken = new Set([...ops.map(op => op.name), ...slot.alt]);
  const evaluate = lineupEvaluator(ops, layers);
  return OPERATORS.filter(op => !taken.has(op.name)).map(op => {
    const lineup = ops.map(current => current.name === slot.name ? replacement(slot, op.name) : current);
    return { op, score: evaluate(lineupCounts(lineup)) + slotAffinity(slot, op) };
  }).sort((a, b) => b.score - a.score || OP_INDEX.get(a.op.name)! - OP_INDEX.get(b.op.name)!)
    .slice(0, limit).map(result => result.op);
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
export const isBanned = (name: string, bans: ReadonlySet<string>): boolean => !!OPERATOR[name]?.covenants.some(c => bans.has(c));

type ReplacementCandidate = { name: string; bit: bigint; covenants: number[]; affinity: number };
type ReplacementSearch = { choices: string[]; counts: Uint8Array; used: bigint; affinity: number; score: number };
const REPLACEMENT_BEAM = 24;

/**
 * 对所有空位联合搜索，每层保留 24 套不同的候选阵容，计算量有固定上限。
 * forced 先锁定并预留干员，避免前面的自动推荐抢走后面手选的人；
 * layers 参与强化门槛计算。返回原站位顺序，保留装备，排除被 ban 与重复干员。
 * 此搜索以整队盟约和位置适配度评分，不修改输入。
 */
export function banReplace(ops: readonly PlanOp[], bans: readonly string[], forced: Readonly<Record<string, string>> = {}, layers: Layers = {}): BanResult {
  const banned = new Set(bans);
  const removed = ops.filter(slot => isBanned(slot.name, banned));
  if (!removed.length) return { removed: [], picks: [], lost: [], ops: ops.map(slot => ({ ...slot, eq: [...slot.eq], alt: [...slot.alt] })) };
  const kept = ops.filter(slot => !isBanned(slot.name, banned));
  const evaluate = lineupEvaluator(ops, layers, banned);
  const taken = new Set(kept.map(slot => slot.name));
  const assignments = new Map<string, string>();
  // 先处理全部有效手选；同名冲突按原站位顺序保留一个，UI 会把最新选择设为唯一锁定。
  for (const slot of removed) {
    const name = forced[slot.name];
    if (OPERATOR[name] && !isBanned(name, banned) && !taken.has(name)) { assignments.set(slot.name, name); taken.add(name); }
  }
  const seeded = [...kept, ...removed.filter(slot => assignments.has(slot.name)).map(slot => replacement(slot, assignments.get(slot.name)!))];
  const pending = removed.filter(slot => !assignments.has(slot.name))
    .sort((a, b) => OPERATOR[b.name].tier - OPERATOR[a.name].tier || OP_INDEX.get(a.name)! - OP_INDEX.get(b.name)!);
  const available = OPERATORS.filter(op => !taken.has(op.name) && !isBanned(op.name, banned));
  const counts = lineupCounts(seeded);
  let beam: ReplacementSearch[] = [{ choices: [], counts, used: 0n, affinity: 0, score: evaluate(counts) }];
  for (const slot of pending) {
    const candidates: ReplacementCandidate[] = available.map(op => ({
      name: op.name, bit: OP_BITS[OP_INDEX.get(op.name)!], covenants: slotCovenants(replacement(slot, op.name)), affinity: slotAffinity(slot, op),
    }));
    const expanded: ReplacementSearch[] = [];
    for (const state of beam) {
      let added = false;
      for (const candidate of candidates) {
        if (state.used & candidate.bit) continue;
        const next = state.counts.slice();
        for (const index of candidate.covenants) next[index]++;
        const affinity = state.affinity + candidate.affinity;
        expanded.push({ choices: [...state.choices, candidate.name], counts: next, used: state.used | candidate.bit,
          affinity, score: evaluate(next) + affinity });
        added = true;
      }
      // 候选全部耗尽时保留未填空位，不能重用干员或偷偷引入被 ban 的干员。
      if (!added) expanded.push({ ...state, choices: [...state.choices, ''] });
    }
    expanded.sort((a, b) => b.score - a.score);
    const seen = new Map<bigint, Set<string>>();
    beam = [];
    for (const state of expanded) {
      const signature = state.counts.join(',');
      const variants = seen.get(state.used) ?? new Set<string>();
      if (variants.has(signature)) continue;
      variants.add(signature); seen.set(state.used, variants);
      beam.push(state);
      if (beam.length === REPLACEMENT_BEAM) break;
    }
  }
  pending.forEach((slot, index) => { const name = beam[0]?.choices[index]; if (name) assignments.set(slot.name, name); });
  const selected = new Set([...kept.map(slot => slot.name), ...assignments.values()]);
  const result = ops.flatMap(slot => {
    const name = assignments.get(slot.name);
    if (isBanned(slot.name, banned) && !name) return [];
    return [{ ...(name ? replacement(slot, name) : slot), eq: [...slot.eq],
      alt: slot.alt.filter(alt => alt !== (name ?? slot.name) && !selected.has(alt) && !isBanned(alt, banned)) }];
  });
  const finalStats = covenantStats(result, layers);
  const picks = removed.flatMap(slot => {
    const name = assignments.get(slot.name);
    if (!name) return [];
    const without = result.filter(op => op.name !== name);
    const withoutStats = new Map(covenantStats(without, layers).map(stat => [stat.name, stat]));
    const gains = finalStats.filter(stat => !banned.has(stat.name) && !stat.broken &&
      ((stat.active && !withoutStats.get(stat.name)?.active) || (stat.bonusActive && !withoutStats.get(stat.name)?.bonusActive)))
      .map(stat => stat.name);
    const alternatives = OPERATORS.filter(op => !selected.has(op.name) && !isBanned(op.name, banned)).map(op => ({
      name: op.name, score: evaluate(lineupCounts([...without, replacement(slot, op.name)])) + slotAffinity(slot, op),
    })).sort((a, b) => b.score - a.score).slice(0, MAX_ALT).map(candidate => candidate.name);
    return [{ name, replaces: slot.name, alts: alternatives, gains }];
  });
  const active = new Set(finalStats.filter(stat => stat.active).map(stat => stat.name));
  return { removed: removed.map(slot => slot.name), picks, ops: result,
    lost: covenantStats(ops, layers).filter(stat => stat.active && !banned.has(stat.name) && !active.has(stat.name)).map(stat => stat.name) };
}


/* ---------- 费用、装备 ---------- */

export const copiesFor = (slot: PlanOp): number => slot.elite ? (slot.name === '星极' ? 2 : 3) : 1;

export interface PlanCost { recruit: number; equipment: number; maxTier: number; elites: number; copies: number }
export function planCost(ops: readonly PlanOp[]): PlanCost {
  let recruit = 0, equipment = 0, maxTier = 0, elites = 0, copies = 0;
  for (const slot of ops) {
    const op = OPERATOR[slot.name]; if (!op) continue;
    const n = copiesFor(slot);
    recruit += operatorPrice(op) * n; copies += n;
    maxTier = Math.max(maxTier, op.tier);
    if (slot.elite) elites++;
    for (const name of slot.eq) { equipment += EQUIP[name]?.price ?? 0; maxTier = Math.max(maxTier, EQUIP[name]?.tier ?? 0); }
  }
  return { recruit, equipment, maxTier, elites, copies };
}

export interface EquipNote { op: string; kind: 'adv' | 'combo' | 'grant'; text: string; result?: string }
/** 同一名干员身上的装备互动：同名进阶、两件组合、变形同构体赋予盟约 */
export function equipNotes(ops: readonly PlanOp[]): EquipNote[] {
  const notes: EquipNote[] = [];
  for (const slot of ops) {
    const [a, b] = slot.eq;
    if (a && a === b && EQUIP[a]?.advanced) notes.push({ op: slot.name, kind: 'adv', text: `${a} ×2 → 进阶`, result: EQUIP[a].advanced! });
    const combo = a && b ? EQUIPMENT_COMBOS.find(([x, y]) => (x === a && y === b) || (x === b && y === a)) : undefined;
    if (combo) notes.push({ op: slot.name, kind: 'combo', text: `${a} + ${b} → ${combo[2]}`, result: EQUIP[combo[2]]?.effect });
    for (const c of covenantsOf(slot).granted) notes.push({ op: slot.name, kind: 'grant', text: `${ISOMORPH} → 获得【${c}】` });
  }
  return notes;
}

/* ---------- 分享码 ----------
 * 紧凑格式：WS + 一字符模式 + Base64URL 位流；链接省略 WS。
 * 模式低两位选择 UTF-8 / UTF-16 / 固定 Huffman，bit2 表示 raw DEFLATE，bit3 表示包含核心标记。
 * 数值按实际范围打包；层数根据当前最大值选择位宽，盟约按稀疏列表或位图存储。
 * 仅解析当前格式；名称、说明的空格、换行、emoji 都原样保留。
 */
export const CODE_PREFIX = 'WS';
export type Shared = Pick<Plan, 'name' | 'ops' | 'strategy' | 'note' | 'layers'>;

// 短编号使用固定 char_ID 表，干员在展示列表中换位置不会改变分享码含义。
const SHARE_OP_IDS = [
  2, 113, 127, 129, 135, 140, 143, 150, 171, 174, 179, 180, 183, 185, 188, 193,
  194, 195, 199, 202, 206, 218, 219, 237, 249, 258, 263, 264, 274, 291, 293, 322,
  325, 328, 332, 333, 337, 341, 346, 347, 350, 355, 358, 367, 381, 391, 400, 416,
  420, 422, 423, 426, 427, 430, 437, 455, 469, 472, 474, 484, 485, 488, 492, 496,
  499, 616, 1012, 1014, 1016, 1019, 1023, 1027, 1031, 1034, 1036, 1038, 1039, 1040, 1042, 1045,
  1046, 1047, 1051, 2015, 2025, 2026, 4009, 4010, 4013, 4016, 4026, 4027, 4031, 4037, 4041, 4042,
  4046, 4047, 4054, 4055, 4058, 4064, 4065, 4066, 4072, 4082, 4088, 4098, 4114, 4116, 4133, 4134,
  4137, 4139, 4145, 4146, 4147, 4151, 4162, 4163, 4165, 4166, 4177, 4179, 4193, 4198, 4202, 4203,
  4204, 4207, 4211, 4221, 4222, 4224, 4226, 4228, 4230, 4231, 4232, 4244, 4245, 4247,
];
const opId = (op: Operator): number => +(op.avatar.match(/^char_(\d+)_/)?.[1] ?? 0);
const OP_BY_ID = new Map(OPERATORS.map(op => [opId(op), op]));
const OP_BY_NO = SHARE_OP_IDS.map(id => OP_BY_ID.get(id));
const OP_NO = new Map(OP_BY_NO.flatMap((op, i) => op ? [[op.name, i] as const] : []));
const EQ_BY_NO = new Map(EQUIPMENT.map(e => [+e.icon.slice(1) + 1, e]));
const ST_BY_NO = new Map(STRATEGIES.map(s => [+s.portrait.slice(1) + 1, s]));
const LAYER_NAMES = ALL_COVENANTS.filter(usesLayers);
const COV_NO = new Map(LAYER_NAMES.map((c, i) => [c, i]));

/** 只留有层数效果、非零的条目。 */
export const cleanLayers = (layers: unknown): Layers => Object.fromEntries(Object.entries(layers && typeof layers === 'object' ? layers : {})
  .filter(([c]) => Object.hasOwn(COVENANTS, c) && usesLayers(c)).map(([c, n]) => [c, clampLayers(n)]).filter(([, n]) => n));

/**
 * 生成可直接复制的分享码，保留八人阵容、顺序、核心标记、装备、备选、层数及完整说明。
 * 同时比较三种文字编码及可选 DEFLATE，返回最短结果；超出编码容量时抛出异常。
 */
export function encodePlan(plan: Shared): string {
  const ops = cleanOps(plan.ops);
  const hasCore = ops.some(slot => slot.core);
  const name = plan.name.slice(0, 16), note = plan.note.slice(0, MAX_NOTE), text = name + note;
  const layers = Object.entries(cleanLayers(plan.layers)).sort(([a], [b]) => COV_NO.get(a)! - COV_NO.get(b)!);
  let best = '';
  for (const mode of [0, 1, 2] as const) {
    const writer = new BitWriter();
    writer.write(ops.length, 4);
    writer.write(Object.hasOwn(STRATEGY, plan.strategy) ? +STRATEGY[plan.strategy].portrait.slice(1) + 1 : 0, 6);
    writer.write(name.length, 5); writer.write(note.length, 8);
    for (const slot of ops) {
      writer.write(OP_NO.get(slot.name)!, 8);
      writer.write(+slot.elite, 1);
      if (hasCore) writer.write(+slot.core, 1);
      const sameEquip = slot.eq.length === 2 && slot.eq[0] === slot.eq[1];
      writer.write(sameEquip ? 3 : slot.eq.length, 2);
      writer.write(slot.alt.length, 2);
      for (const eq of sameEquip ? slot.eq.slice(0, 1) : slot.eq) writer.write(+EQUIP[eq].icon.slice(1) + 1, 7);
      for (const alt of slot.alt) writer.write(OP_NO.get(alt)!, 8);
    }
    writer.write(layers.length ? 1 : 0, 1);
    if (layers.length) {
      const dense = 5 + layers.length * 5 > LAYER_NAMES.length;
      writer.write(+dense, 1);
      if (dense) {
        const selected = new Set(layers.map(([c]) => c));
        for (const c of LAYER_NAMES) writer.write(+selected.has(c), 1);
      } else {
        writer.write(layers.length, 5);
        for (const [c] of layers) writer.write(COV_NO.get(c)!, 5);
      }
      const width = Math.ceil(Math.log2(Math.max(...layers.map(([, n]) => n)) + 1));
      writer.write(width - 1, 4);
      for (const [, n] of layers) writer.write(n, width);
    }
    if (!writeShareText(writer, text, mode)) continue;
    const candidate = packSharePayload(writer.finish(), mode, hasCore);
    if (!best || candidate.length < best.length) best = candidate;
  }
  return CODE_PREFIX + best;
}

export interface Decoded { plan: Shared }
/** 接受当前分享码或 #p= 链接；损坏、截断、超限或含未知条目的数据返回 null。 */
export function decodePlan(input: string): Decoded | null {
  if (input.length > 4096) return null;
  const link = input.match(/#p=([A-Za-z0-9_-]+)/);
  const token = link?.[1] ?? input.match(/(?:^|[^A-Za-z0-9_-])WS([A-Za-z0-9_-]+)/)?.[1];
  if (!token) return null;
  try {
    const { reader, mode, hasCore } = unpackSharePayload(token);
    const count = reader.read(4), strategyNo = reader.read(6), nameLength = reader.read(5), noteLength = reader.read(8);
    if (count > MAX_OPS || nameLength > 16 || noteLength > MAX_NOTE || (strategyNo && !ST_BY_NO.has(strategyNo))) return null;
    const ops: PlanOp[] = [];
    const readOp = (): string => {
      const name = OP_BY_NO[reader.read(8)]?.name;
      if (!name) throw new Error('Unknown operator');
      return name;
    };
    for (let k = 0; k < count; k++) {
      const name = readOp(), elite = !!reader.read(1), core = hasCore && !!reader.read(1);
      const eqKind = reader.read(2), altCount = reader.read(2);
      if (ops.some(o => o.name === name)) return null;
      const eq: string[] = [], alt: string[] = [];
      for (let e = 0; e < (eqKind === 3 ? 1 : eqKind); e++) {
        const item = EQ_BY_NO.get(reader.read(7));
        if (!item) return null;
        eq.push(item.name);
      }
      if (eqKind === 3) eq.push(eq[0]);
      for (let a = 0; a < altCount; a++) {
        const candidate = readOp();
        if (candidate === name || alt.includes(candidate)) return null;
        alt.push(candidate);
      }
      ops.push({ name, elite, core, eq, alt });
    }
    const layers: Layers = {};
    if (reader.read(1)) {
      const selected: string[] = [];
      if (reader.read(1)) {
        for (const c of LAYER_NAMES) if (reader.read(1)) selected.push(c);
      } else {
        const layerCount = reader.read(5);
        if (layerCount > LAYER_NAMES.length) return null;
        for (let i = 0; i < layerCount; i++) {
          const c = LAYER_NAMES[reader.read(5)];
          if (!c || selected.includes(c)) return null;
          selected.push(c);
        }
      }
      if (!selected.length) return null;
      const width = reader.read(4) + 1;
      if (width > 14) return null;
      for (const c of selected) {
        const value = reader.read(width);
        if (!value || value > MAX_LAYERS) return null;
        layers[c] = value;
      }
    }
    const text = readShareText(reader, nameLength + noteLength, mode);
    return { plan: { name: text.slice(0, nameLength), note: text.slice(nameLength), ops, layers, strategy: ST_BY_NO.get(strategyNo)?.name ?? '' } };
  } catch { return null; }
}

/** 链接的 #p= 已标明用途，省去只用于识别独立分享码的 WS 前缀。 */
export const shareUrl = (code: string): string => `${location.origin}/#p=${code.slice(CODE_PREFIX.length)}`;


/* ---------- 本地存档 ---------- */

const KEY = 'wsq.plans', CURRENT = 'wsq.plan';
const read = (key: string): string | null => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key: string, value: string): boolean => { try { localStorage.setItem(key, value); return true; } catch { return false; } };

export const newId = (): string => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const blankPlan = (name = '新阵容'): Plan => ({ id: newId(), name, ops: [], strategy: '', note: '', layers: {}, updated: Date.now() });
export const newSlot = (name: string): PlanOp => ({ name, elite: false, core: false, eq: [], alt: [] });

/** 内置流派转成方案：终盘阵容、首选策略，要点逐行写进说明 */
export function builtinPlan(name: string): Plan | null {
  const build = buildByName(name);
  if (!build) return null;
  return {
    id: `b:${name}`, base: name, name: name.slice(0, 16), updated: 0, layers: {},
    ops: cleanOps(build.lineup.map(name => ({ ...newSlot(name), core: build.carries?.includes(name) ?? false, alt: build.alternatives?.[name] ?? [] }))),
    strategy: build.strategies.find(s => Object.hasOwn(STRATEGY, s)) ?? '',
    note: build.tips.join('\n').slice(0, MAX_NOTE),
  };
}
/** 两份方案的内容是否一样（不看 id、修改时间） */
export const samePlan = (a: Plan, b: Plan): boolean =>
  JSON.stringify([a.name, a.ops, a.strategy, a.note, cleanLayers(a.layers)]) === JSON.stringify([b.name, b.ops, b.strategy, b.note, cleanLayers(b.layers)]);

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const knownOp = (name: unknown): name is string => typeof name === 'string' && Object.hasOwn(OPERATOR, name);
const knownEq = (name: unknown): name is string => typeof name === 'string' && Object.hasOwn(EQUIP, name);

/** 规范化干员数据；旧存档未记录核心标记时继承预设，显式取消的标记保留为 false。 */
function cleanOps(value: unknown, defaultCores: readonly string[] = []): PlanOp[] {
  const result: PlanOp[] = [], seen = new Set<string>();
  if (!Array.isArray(value)) return result;
  for (const slot of value) {
    if (!record(slot) || !knownOp(slot.name) || seen.has(slot.name)) continue;
    seen.add(slot.name);
    result.push({ name: slot.name, elite: !!slot.elite,
      core: typeof slot.core === 'boolean' ? slot.core : defaultCores.includes(slot.name),
      eq: Array.isArray(slot.eq) ? slot.eq.filter(knownEq).slice(0, MAX_EQ) : [],
      alt: Array.isArray(slot.alt) ? [...new Set(slot.alt.filter(knownOp))].filter(n => n !== slot.name).slice(0, MAX_ALT) : [],
    });
    if (result.length === MAX_OPS) break;
  }
  return result;
}
/** 单条损坏存档被略过，其余方案仍可读取。 */
function clean(value: unknown): Plan | null {
  if (!record(value)) return null;
  const base = typeof value.base === 'string' && buildByName(value.base) ? value.base : undefined;
  return {
    id: typeof value.id === 'string' && value.id ? value.id : newId(),
    name: typeof value.name === 'string' && value.name ? value.name.slice(0, 16) : '阵容',
    updated: typeof value.updated === 'number' && Number.isFinite(value.updated) ? value.updated : Date.now(),
    strategy: typeof value.strategy === 'string' && Object.hasOwn(STRATEGY, value.strategy) ? value.strategy : '',
    note: typeof value.note === 'string' ? value.note.slice(0, MAX_NOTE) : '',
    layers: cleanLayers(value.layers), ops: cleanOps(value.ops, base ? buildByName(base)!.carries : []),
    ...(base ? { base } : {}),
  };
}
export function loadPlans(): Plan[] {
  try {
    const list: unknown = JSON.parse(read(KEY) ?? '[]');
    if (!Array.isArray(list)) return [];
    const ids = new Set<string>(), bases = new Set<string>();
    return list.map(clean).filter((p): p is Plan => !!p).map(p => {
      if (ids.has(p.id)) p.id = newId();
      // 每个内置流派只认一份修改版，多出来的当作自建流派
      if (p.base && bases.has(p.base)) delete p.base;
      if (p.base) bases.add(p.base);
      ids.add(p.id); return p;
    });
  } catch { return []; }
}
/** 写入全部方案，返回是否成功；存储被禁用或空间不足时返回 false。 */
export const savePlans = (plans: readonly Plan[]): boolean => write(KEY, JSON.stringify(plans));
export const loadCurrent = (): string => read(CURRENT) ?? '';
export const saveCurrent = (id: string): void => { write(CURRENT, id); };
