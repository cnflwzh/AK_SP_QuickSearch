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
  isCoreCovenant, operatorPrice, type Operator,
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

/** alt：主选抓不到时依次考虑的备选，只作参考，不计入盟约统计 */
export interface PlanOp { name: string; elite: boolean; eq: string[]; alt: string[] }
/** layers：各盟约自己的层数（只记效果随层数变化的盟约） */
export type Layers = Record<string, number>;
export interface Plan { id: string; name: string; ops: PlanOp[]; strategy: string; note: string; layers: Layers; updated: number }

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
  }).sort((a, b) => +b.active - +a.active || +b.bonusActive - +a.bonusActive || +b.core - +a.core || b.count - a.count);
}

/** 把 "(23+0.9×层)" 换成该层数下的数值 */
export const atLayers = (text: string, layers: number): string =>
  text.replace(/\((\d+(?:\.\d+)?)\+(\d+(?:\.\d+)?)×层\)/g, (match, a: string, b: string, offset: number) => {
    const value = Math.round((+a + +b * layers) * 100) / 100;
    return String(/^%\s*概率/.test(text.slice(offset + match.length)) ? Math.min(100, value) : value);
  });

/* ---------- 补位推荐 ---------- */

export interface Suggestion { op: Operator; score: number; gains: { covenant: string; kind: 'on' | 'bonus' | 'up' | 'off' }[] }

/** 对每个没上场的干员，算加入后跨过的门槛：激活 > 强化 > 只加人数；会让【独行】失效的扣分 */
export function suggestions(ops: readonly PlanOp[], limit = 8): Suggestion[] {
  if (ops.length >= MAX_OPS) return [];
  const taken = new Set(ops.map(o => o.name));
  const before = new Map(covenantStats(ops).map(s => [s.name, s]));
  const out: Suggestion[] = [];
  for (const op of OPERATORS) {
    if (taken.has(op.name)) continue;
    const gains: Suggestion['gains'] = [];
    let score = 0;
    // 与主面板使用同一套计算，调和同时影响激活和六人强化。
    for (const next of covenantStats([...ops, newSlot(op.name)])) {
      const was = before.get(next.name);
      if (next.broken && was?.active) { gains.push({ covenant: next.name, kind: 'off' }); score -= 4; }
      else if (next.active && !was?.active) { gains.push({ covenant: next.name, kind: 'on' }); score += 6; }
      else if (next.bonusActive && !was?.bonusActive) { gains.push({ covenant: next.name, kind: 'bonus' }); score += 5; }
      else if (was && !next.broken && next.next > 0 && next.count > was.count) {
        gains.push({ covenant: next.name, kind: 'up' }); score += next.active ? 1.2 : 1.5;
      }
    }
    if (score > 0) out.push({ op, score: score + op.tier * .01, gains });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * 某个位置的备选推荐：和主选共享盟约越多、等阶越接近越靠前；排除场上和已列的备选。
 * 共享核心盟约权重更高，因为核心盟约断人会直接掉档。
 */
export function alternatesFor(slot: PlanOp, ops: readonly PlanOp[], limit = 8): Operator[] {
  const main = OPERATOR[slot.name]; if (!main) return [];
  const taken = new Set([...ops.map(o => o.name), ...slot.alt]);
  return OPERATORS
    .filter(op => !taken.has(op.name))
    .map(op => {
      const shared = op.covenants.filter(c => main.covenants.includes(c));
      return { op, score: shared.reduce((s, c) => s + (isCoreCovenant(c) ? 3 : 2), 0) - Math.abs(op.tier - main.tier) * .6 };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit).map(x => x.op);
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
 * 模式低两位选择 UTF-8 / UTF-16 / 固定 Huffman，bit2 表示 raw DEFLATE。
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
 * 生成可直接复制的分享码，保留八人阵容、顺序、装备、备选、层数及完整说明。
 * 同时比较三种文字编码及可选 DEFLATE，返回最短结果；超出编码容量时抛出异常。
 */
export function encodePlan(plan: Shared): string {
  const ops = cleanOps(plan.ops);
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
    const candidate = packSharePayload(writer.finish(), mode);
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
    const { reader, mode } = unpackSharePayload(token);
    const count = reader.read(4), strategyNo = reader.read(6), nameLength = reader.read(5), noteLength = reader.read(8);
    if (count > MAX_OPS || nameLength > 16 || noteLength > MAX_NOTE || (strategyNo && !ST_BY_NO.has(strategyNo))) return null;
    const ops: PlanOp[] = [];
    const readOp = (): string => {
      const name = OP_BY_NO[reader.read(8)]?.name;
      if (!name) throw new Error('Unknown operator');
      return name;
    };
    for (let k = 0; k < count; k++) {
      const name = readOp(), elite = !!reader.read(1), eqKind = reader.read(2), altCount = reader.read(2);
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
      ops.push({ name, elite, eq, alt });
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
export const shareUrl = (code: string): string => `${location.origin}${location.pathname}#p=${code.slice(CODE_PREFIX.length)}`;


/* ---------- 本地存档 ---------- */

const KEY = 'wsq.plans', CURRENT = 'wsq.plan';
const read = (key: string): string | null => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key: string, value: string): boolean => { try { localStorage.setItem(key, value); return true; } catch { return false; } };

export const newId = (): string => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const blankPlan = (name = '新阵容'): Plan => ({ id: newId(), name, ops: [], strategy: '', note: '', layers: {}, updated: Date.now() });
export const newSlot = (name: string): PlanOp => ({ name, elite: false, eq: [], alt: [] });

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const knownOp = (name: unknown): name is string => typeof name === 'string' && Object.hasOwn(OPERATOR, name);
const knownEq = (name: unknown): name is string => typeof name === 'string' && Object.hasOwn(EQUIP, name);

/** 分享和本地存档共同遵守八人、两装备、三备选的约束，同名主选只保留一次。 */
function cleanOps(value: unknown): PlanOp[] {
  const result: PlanOp[] = [], seen = new Set<string>();
  if (!Array.isArray(value)) return result;
  for (const slot of value) {
    if (!record(slot) || !knownOp(slot.name) || seen.has(slot.name)) continue;
    seen.add(slot.name);
    result.push({ name: slot.name, elite: !!slot.elite,
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
  return {
    id: typeof value.id === 'string' && value.id ? value.id : newId(),
    name: typeof value.name === 'string' && value.name ? value.name.slice(0, 16) : '阵容',
    updated: typeof value.updated === 'number' && Number.isFinite(value.updated) ? value.updated : Date.now(),
    strategy: typeof value.strategy === 'string' && Object.hasOwn(STRATEGY, value.strategy) ? value.strategy : '',
    note: typeof value.note === 'string' ? value.note.slice(0, MAX_NOTE) : '',
    layers: cleanLayers(value.layers), ops: cleanOps(value.ops),
  };
}
export function loadPlans(): Plan[] {
  try {
    const list: unknown = JSON.parse(read(KEY) ?? '[]');
    if (!Array.isArray(list)) return [];
    const ids = new Set<string>();
    return list.map(clean).filter((p): p is Plan => !!p).map(p => {
      if (ids.has(p.id)) p.id = newId();
      ids.add(p.id); return p;
    });
  } catch { return []; }
}
/** 写入全部方案，返回是否成功；存储被禁用或空间不足时返回 false。 */
export const savePlans = (plans: readonly Plan[]): boolean => write(KEY, JSON.stringify(plans));
export const loadCurrent = (): string => read(CURRENT) ?? '';
export const saveCurrent = (id: string): void => { write(CURRENT, id); };
