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
 * 字节（版本 2）：[2][策略序号+1][干员数]
 *   每名干员 [游戏 ID 高][低][标志: bit0 精锐, bit1-2 装备数, bit3-4 备选数][装备序号+1 …][备选 ID 高][低] …
 *   [层数条目数] 每条 [盟约序号][层数高][低]
 *   然后 [方案名字节数][方案名 UTF-8][说明 UTF-16]（中文 2 字节 / 字，比 UTF-8 省三分之一，二维码更小）
 * 版本 1 没有备选和说明，余下全部是方案名；仍可导入。
 * 干员用游戏内 char_ID，装备 / 策略用图标序号（e00、s00）：换赛季调整列表顺序后，旧码仍能解析。
 */
const VERSION = 2;
export const CODE_PREFIX = 'WS';
const opId = (op: Operator): number => +(op.avatar.match(/^char_(\d+)_/)?.[1] ?? 0);
const OP_BY_ID = new Map(OPERATORS.map(op => [opId(op), op]));
const EQ_BY_NO = new Map(EQUIPMENT.map(e => [+e.icon.slice(1), e]));
const ST_BY_NO = new Map(STRATEGIES.map(s => [+s.portrait.slice(1), s]));

const toB64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64 = (text: string): Uint8Array => {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64 + '='.repeat((4 - b64.length % 4) % 4)), c => c.charCodeAt(0));
};
const idBytes = (name: string): number[] => { const id = opId(OPERATOR[name]); return [id >> 8 & 255, id & 255]; };

export type Shared = Pick<Plan, 'name' | 'ops' | 'strategy' | 'note' | 'layers'>;
const COV_NO = new Map(ALL_COVENANTS.map((c, i) => [c, i]));
const utf16 = (text: string): number[] => [...text].flatMap(ch => { const out: number[] = []; for (let i = 0; i < ch.length; i++) out.push(ch.charCodeAt(i) >> 8, ch.charCodeAt(i) & 255); return out; });
const fromUtf16 = (b: Uint8Array): string => { let s = ''; for (let i = 0; i + 1 < b.length; i += 2) s += String.fromCharCode(b[i] << 8 | b[i + 1]); return s; };
/** 只留有层数效果、非零的条目 */
export const cleanLayers = (layers: unknown): Layers => Object.fromEntries(Object.entries(layers && typeof layers === 'object' ? layers : {})
  .filter(([c]) => Object.hasOwn(COVENANTS, c) && usesLayers(c)).map(([c, n]) => [c, clampLayers(n)]).filter(([, n]) => n));

export function encodePlan(plan: Shared): string {
  const bytes: number[] = [VERSION, STRATEGY[plan.strategy] ? +STRATEGY[plan.strategy].portrait.slice(1) + 1 : 0];
  const ops = cleanOps(plan.ops);
  bytes.push(ops.length);
  for (const slot of ops) {
    const eq = slot.eq.filter(n => EQUIP[n]).slice(0, MAX_EQ);
    const alt = slot.alt.filter(n => OPERATOR[n]).slice(0, MAX_ALT);
    bytes.push(...idBytes(slot.name), (slot.elite ? 1 : 0) | eq.length << 1 | alt.length << 3,
      ...eq.map(n => +EQUIP[n].icon.slice(1) + 1), ...alt.flatMap(idBytes));
  }
  const layers = Object.entries(cleanLayers(plan.layers)).slice(0, 255);
  bytes.push(layers.length, ...layers.flatMap(([c, n]) => [COV_NO.get(c)!, n >> 8, n & 255]));
  const name = new TextEncoder().encode(plan.name.trim().slice(0, 16));
  const note = utf16(plan.note.trim().slice(0, MAX_NOTE));
  return CODE_PREFIX + toB64(Uint8Array.from([...bytes, name.length, ...name, ...note]));
}

export interface Decoded { plan: Shared; missing: number }
/** 接受分享码、带 #p= 的链接或含码文本；结构不完整或超出阵容限制时返回 null。 */
export function decodePlan(input: string): Decoded | null {
  const raw = input.trim().match(/#p=([\w-]+)/)?.[1] ?? input.trim().match(new RegExp(`${CODE_PREFIX}[\\w-]{4,}`))?.[0] ?? '';
  const code = raw.startsWith(CODE_PREFIX) ? raw.slice(CODE_PREFIX.length) : raw;
  // 正常八人方案不足 1 KB；在解码前限制尺寸，避免长文本占用主线程。
  if (!code || code.length > 2048) return null;
  try {
    const b = fromB64(code), v = b[0];
    if ((v !== 1 && v !== 2) || b.length < 3 || b[2] > MAX_OPS) return null;
    let i = 3, missing = 0;
    const take = (length: number): Uint8Array => {
      if (i + length > b.length) throw new Error('Incomplete plan');
      const value = b.slice(i, i + length); i += length; return value;
    };
    const ops: PlanOp[] = [];
    for (let k = 0; k < b[2]; k++) {
      const [hi, lo, flags] = take(3);
      const name = OP_BY_ID.get(hi << 8 | lo)?.name;
      const eqCount = flags >> 1 & 3, altCount = v > 1 ? flags >> 3 & 3 : 0;
      if (eqCount > MAX_EQ || flags >> (v > 1 ? 5 : 3)) return null;
      const eq = [...take(eqCount)].map(n => EQ_BY_NO.get(n - 1)?.name).filter((n): n is string => !!n);
      const alt: string[] = [];
      for (let a = 0; a < altCount; a++) {
        const [ah, al] = take(2), n = OP_BY_ID.get(ah << 8 | al)?.name;
        if (n && n !== name && !alt.includes(n)) alt.push(n);
      }
      if (name && !ops.some(o => o.name === name)) ops.push({ name, elite: !!(flags & 1), eq, alt });
      else missing++;
    }
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let name = '', note = '';
    const layers: Layers = {};
    if (v > 1) {
      const [count] = take(1);
      for (let k = 0; k < count; k++) {
        const [index, hi, lo] = take(3), c = ALL_COVENANTS[index];
        if (c) layers[c] = hi << 8 | lo;
      }
      const [nameLength] = take(1);
      name = decoder.decode(take(nameLength)).trim().slice(0, 16);
      if ((b.length - i) % 2) return null;
      note = fromUtf16(take(b.length - i)).trim().slice(0, MAX_NOTE);
    } else name = decoder.decode(take(b.length - i)).trim().slice(0, 16);
    return { plan: { name, ops, strategy: ST_BY_NO.get(b[1] - 1)?.name ?? '', note, layers: cleanLayers(layers) }, missing };
  } catch { return null; }
}

export const shareUrl = (code: string): string => `${location.origin}${location.pathname}#p=${code}`;

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
