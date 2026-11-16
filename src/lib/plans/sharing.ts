/** 既有方案分享协议。编码字段与顺序独立于推荐模块，保持旧链接兼容。 */
import {
  ALL_COVENANTS,
  EQUIP,
  EQUIPMENT,
  OPERATOR,
  OPERATORS,
  SHARE_OPERATOR_IDS,
  STRATEGIES,
  STRATEGY,
  type Operator,
} from '../../../data/index.ts';
import {
  BitWriter,
  MAX_PAYLOAD,
  packSharePayload,
  readShareText,
  unpackSharePayload,
  writeShareText,
} from './shareCodec.ts';
import {covenantStats} from './covenants.ts';
import {equipNotes} from './costs.ts';
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

// 短编号优先使用赛季固定 char_ID 表，新增干员追加在表尾，避免既有分享码位次漂移。
const opId = (op: Operator): number =>
  +(op.avatar.match(/^char_(\d+)_/)?.[1] ?? 0);
const OP_BY_ID = new Map(OPERATORS.map((op) => [opId(op), op]));
const KNOWN_SHARE_IDS = new Set(SHARE_OPERATOR_IDS);
const OP_BY_NO = [
  ...SHARE_OPERATOR_IDS.map((id) => OP_BY_ID.get(id)),
  ...OPERATORS.filter((op) => !KNOWN_SHARE_IDS.has(opId(op))),
];
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
    const payload = writer.finish();
    if (payload.length > MAX_PAYLOAD) continue;
    const candidate = packSharePayload(payload, mode, hasCore);
    if (!best || candidate.length < best.length) best = candidate;
  }
  if (!best) throw new Error('Share data too large');
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
    const {reader, mode, hasCore} = unpackSharePayload(token);
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
      ops.push({name, elite, core, eq, alt});
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

const SHARE_STAGES: readonly (readonly [
  label: string,
  tiers: readonly number[],
])[] = [
  ['前期抓牌(1-2阶)', [1, 2]],
  ['中期抓牌(3-4阶)', [3, 4]],
  ['后期抓牌(5-6阶)', [5, 6]],
];

/**
 * 将方案格式化为适合群聊分享的攻略文案（分阶抓牌、过渡备选、策略、配装与打法要点），
 * 末尾附带可被 decodePlan 直接识别并还原方案的链接或分享码。
 */
export function formatPlanShareText(plan: Shared, link?: string): string {
  const ops = cleanOps(plan.ops);
  const layers = cleanLayers(plan.layers);
  const title = plan.name.trim() || '自建流派';
  const lines: string[] = [`【卫戍流派】${title}`];

  const activeStats = covenantStats(ops, layers).filter((s) => s.active);
  if (activeStats.length) {
    const covText = activeStats
      .map((s) => {
        const layerCount = layers[s.name];
        return `${s.name} ${s.count}/${s.need}${s.bonusActive ? '(强化)' : ''}${layerCount ? `·${layerCount}层` : ''}`;
      })
      .join(' · ');
    lines.push(`盟约：${covText}`);
  }

  if (Object.hasOwn(STRATEGY, plan.strategy)) {
    const st = STRATEGY[plan.strategy];
    lines.push(`策略：${st.name}「${st.skill}」`);
  }

  const formatSlot = (slot: PlanOp): string => {
    const tier = OPERATOR[slot.name]?.tier ?? 0;
    const tags = [
      `${tier}阶`,
      ...(slot.elite ? ['精锐'] : []),
      ...(slot.eq.length ? [slot.eq.join('/')] : []),
    ];
    return `${slot.core ? '★' : ''}${slot.name}(${tags.join('·')})`;
  };

  for (const [label, tiers] of SHARE_STAGES) {
    const matched = ops.filter((slot) =>
      tiers.includes(OPERATOR[slot.name]?.tier ?? 0),
    );
    if (matched.length) {
      lines.push(`${label}：${matched.map(formatSlot).join('、')}`);
    }
  }
  const otherTierOps = ops.filter(
    (slot) =>
      !SHARE_STAGES.some(([, tiers]) =>
        tiers.includes(OPERATOR[slot.name]?.tier ?? 0),
      ),
  );
  if (otherTierOps.length) {
    lines.push(`其他抓牌：${otherTierOps.map(formatSlot).join('、')}`);
  }

  const altItems = ops.flatMap((slot) =>
    slot.alt.map((alt) => {
      const tier = OPERATOR[alt]?.tier ?? 0;
      return `${alt}(${tier ? `${tier}阶` : ''}→替${slot.name})`;
    }),
  );
  if (altItems.length) {
    lines.push(`过渡/备选：${altItems.join('、')}`);
  }

  const notes = equipNotes(ops);
  if (notes.length) {
    lines.push(
      `配装联动：${notes.map((n) => `${n.op}(${n.text})`).join('；')}`,
    );
  }

  const noteLines = plan.note
    .slice(0, MAX_NOTE)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (noteLines.length === 1) {
    lines.push(`打法要点：${noteLines[0]}`);
  } else if (noteLines.length > 1) {
    lines.push('打法要点：');
    noteLines.forEach((line, index) => lines.push(`${index + 1}. ${line}`));
  }

  const code = encodePlan({
    name: plan.name.slice(0, 16),
    ops,
    strategy: Object.hasOwn(STRATEGY, plan.strategy) ? plan.strategy : '',
    note: plan.note.slice(0, MAX_NOTE),
    layers,
  });
  const resolvedLink =
    link ?? (typeof location !== 'undefined' ? shareUrl(code) : '');
  lines.push(resolvedLink ? `导入链接：${resolvedLink}` : `分享码：${code}`);
  return lines.join('\n');
}
