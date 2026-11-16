/** 既有方案分享协议。编码字段与顺序独立于推荐模块，保持旧链接兼容。 */
import {
  ALL_COVENANTS,
  EQUIP,
  EQUIPMENT,
  OPERATORS,
  STRATEGIES,
  STRATEGY,
  type Operator,
} from '../../../data/index.ts';
import {
  BitWriter,
  packSharePayload,
  readShareText,
  unpackSharePayload,
  writeShareText,
} from './shareCodec.ts';
import {
  MAX_LAYERS,
  MAX_NOTE,
  MAX_OPS,
  cleanLayers,
  cleanOps,
  usesLayers,
  type Layers,
  type Plan,
  type PlanOp,
} from './model.ts';
/* ---------- 分享码 ----------
 * 紧凑格式：WS + 一字符模式 + Base64URL 位流；链接省略 WS。
 * 模式低两位选择 UTF-8 / UTF-16 / 固定 Huffman，bit2 表示 raw DEFLATE，bit3 表示包含核心标记。
 * 数值按实际范围打包；层数根据当前最大值选择位宽，盟约按稀疏列表或位图存储。
 * 仅解析当前格式；名称、说明的空格、换行、emoji 都原样保留。
 */
export const CODE_PREFIX = 'WS';
export type Shared = Pick<
  Plan,
  'name' | 'ops' | 'strategy' | 'note' | 'layers'
>;

// 短编号使用固定 char_ID 表，干员在展示列表中换位置不会改变分享码含义。
const SHARE_OP_IDS = [
  2, 113, 127, 129, 135, 140, 143, 150, 171, 174, 179, 180, 183, 185, 188, 193,
  194, 195, 199, 202, 206, 218, 219, 237, 249, 258, 263, 264, 274, 291, 293,
  322, 325, 328, 332, 333, 337, 341, 346, 347, 350, 355, 358, 367, 381, 391,
  400, 416, 420, 422, 423, 426, 427, 430, 437, 455, 469, 472, 474, 484, 485,
  488, 492, 496, 499, 616, 1012, 1014, 1016, 1019, 1023, 1027, 1031, 1034, 1036,
  1038, 1039, 1040, 1042, 1045, 1046, 1047, 1051, 2015, 2025, 2026, 4009, 4010,
  4013, 4016, 4026, 4027, 4031, 4037, 4041, 4042, 4046, 4047, 4054, 4055, 4058,
  4064, 4065, 4066, 4072, 4082, 4088, 4098, 4114, 4116, 4133, 4134, 4137, 4139,
  4145, 4146, 4147, 4151, 4162, 4163, 4165, 4166, 4177, 4179, 4193, 4198, 4202,
  4203, 4204, 4207, 4211, 4221, 4222, 4224, 4226, 4228, 4230, 4231, 4232, 4244,
  4245, 4247,
];
const opId = (op: Operator): number =>
  +(op.avatar.match(/^char_(\d+)_/)?.[1] ?? 0);
const OP_BY_ID = new Map(OPERATORS.map((op) => [opId(op), op]));
const OP_BY_NO = SHARE_OP_IDS.map((id) => OP_BY_ID.get(id));
const OP_NO = new Map(
  OP_BY_NO.flatMap((op, i) => (op ? [[op.name, i] as const] : [])),
);
const EQ_BY_NO = new Map(EQUIPMENT.map((e) => [+e.icon.slice(1) + 1, e]));
const ST_BY_NO = new Map(STRATEGIES.map((s) => [+s.portrait.slice(1) + 1, s]));
const LAYER_NAMES = ALL_COVENANTS.filter(usesLayers);
const COV_NO = new Map(LAYER_NAMES.map((c, i) => [c, i]));

/** 只留有层数效果、非零的条目。 */
/**
 * 生成可直接复制的分享码，保留八人阵容、顺序、核心标记、装备、备选、层数及完整说明。
 * 同时比较三种文字编码及可选 DEFLATE，返回最短结果；超出编码容量时抛出异常。
 */
export function encodePlan(plan: Shared): string {
  const ops = cleanOps(plan.ops);
  const hasCore = ops.some((slot) => slot.core);
  const name = plan.name.slice(0, 16),
    note = plan.note.slice(0, MAX_NOTE),
    text = name + note;
  const layers = Object.entries(cleanLayers(plan.layers)).sort(
    ([a], [b]) => COV_NO.get(a)! - COV_NO.get(b)!,
  );
  let best = '';
  for (const mode of [0, 1, 2] as const) {
    const writer = new BitWriter();
    writer.write(ops.length, 4);
    writer.write(
      Object.hasOwn(STRATEGY, plan.strategy)
        ? +STRATEGY[plan.strategy].portrait.slice(1) + 1
        : 0,
      6,
    );
    writer.write(name.length, 5);
    writer.write(note.length, 8);
    for (const slot of ops) {
      writer.write(OP_NO.get(slot.name)!, 8);
      writer.write(+slot.elite, 1);
      if (hasCore) writer.write(+slot.core, 1);
      const sameEquip = slot.eq.length === 2 && slot.eq[0] === slot.eq[1];
      writer.write(sameEquip ? 3 : slot.eq.length, 2);
      writer.write(slot.alt.length, 2);
      for (const eq of sameEquip ? slot.eq.slice(0, 1) : slot.eq)
        writer.write(+EQUIP[eq].icon.slice(1) + 1, 7);
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
      const width = Math.ceil(
        Math.log2(Math.max(...layers.map(([, n]) => n)) + 1),
      );
      writer.write(width - 1, 4);
      for (const [, n] of layers) writer.write(n, width);
    }
    if (!writeShareText(writer, text, mode)) continue;
    const candidate = packSharePayload(writer.finish(), mode, hasCore);
    if (!best || candidate.length < best.length) best = candidate;
  }
  return CODE_PREFIX + best;
}

export interface Decoded {
  plan: Shared;
}
/** 接受当前分享码或 #p= 链接；损坏、截断、超限或含未知条目的数据返回 null。 */
export function decodePlan(input: string): Decoded | null {
  if (input.length > 4096) return null;
  const link = input.match(/#p=([A-Za-z0-9_-]+)/);
  const token =
    link?.[1] ?? input.match(/(?:^|[^A-Za-z0-9_-])WS([A-Za-z0-9_-]+)/)?.[1];
  if (!token) return null;
  try {
    const { reader, mode, hasCore } = unpackSharePayload(token);
    const count = reader.read(4),
      strategyNo = reader.read(6),
      nameLength = reader.read(5),
      noteLength = reader.read(8);
    if (
      count > MAX_OPS ||
      nameLength > 16 ||
      noteLength > MAX_NOTE ||
      (strategyNo && !ST_BY_NO.has(strategyNo))
    )
      return null;
    const ops: PlanOp[] = [];
    const readOp = (): string => {
      const name = OP_BY_NO[reader.read(8)]?.name;
      if (!name) throw new Error('Unknown operator');
      return name;
    };
    for (let k = 0; k < count; k++) {
      const name = readOp(),
        elite = !!reader.read(1),
        core = hasCore && !!reader.read(1);
      const eqKind = reader.read(2),
        altCount = reader.read(2);
      if (ops.some((o) => o.name === name)) return null;
      const eq: string[] = [],
        alt: string[] = [];
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
    return {
      plan: {
        name: text.slice(0, nameLength),
        note: text.slice(nameLength),
        ops,
        layers,
        strategy: ST_BY_NO.get(strategyNo)?.name ?? '',
      },
    };
  } catch {
    return null;
  }
}

/** 链接的 #p= 已标明用途，省去只用于识别独立分享码的 WS 前缀。 */
export const shareUrl = (code: string): string =>
  `${location.origin}/#p=${code.slice(CODE_PREFIX.length)}`;
