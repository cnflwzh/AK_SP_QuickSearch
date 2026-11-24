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
  BitReader,
  BitWriter,
  MAX_EXTENDED_PAYLOAD,
  MAX_PAYLOAD,
  packSharePayload,
  readShareText,
  unpackSharePayload,
  writeShareText,
} from './shareCodec.ts';
import {covenantStats} from './covenants.ts';
import {planShareSource} from './shareInput.ts';
import {equipNotes} from './costs.ts';
import {
  MAX_LAYERS,
  MAX_NOTE,
  MAX_OPS,
  MAX_STAGE_ROUND,
  MAX_STRATEGIES,
  cleanLayers,
  cleanOps,
  cleanStrategyAlternates,
  readPlanIcon,
  validStageRange,
  usesLayers,
  type Layers,
  type Plan,
  type PlanIcon,
  type PlanOp,
  type PlanStage,
} from './model.ts';
/* ---------- 分享码 ----------
 * 紧凑格式：WS + 一字符模式 + Base64URL 位流；链接省略 WS。
 * 模式低两位选择 UTF-8 / UTF-16 / 固定 Huffman，bit2 表示 raw DEFLATE，bit3 表示包含核心标记。
 * 数值按实际范围打包；层数根据当前最大值选择位宽，盟约按稀疏列表或位图存储。
 * bit4 标记扩展格式，允许分段阵容、策略备选及长说明。bit5 标记自选图标。
 */
export const CODE_PREFIX = 'WS';
export type Shared = Pick<
  Plan,
  | 'name'
  | 'icon'
  | 'ops'
  | 'strategy'
  | 'strategyAlternates'
  | 'stages'
  | 'note'
  | 'layers'
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

const LEGACY_OPS = 8;
const LEGACY_NOTE = 240;
// 固定类别编号和条目名称一起编码，图鉴增删、重排时仍能识别原图标。
const ICON_KINDS = ['covenant', 'operator', 'strategy', 'equipment'] as const;

function writeSlot(writer: BitWriter, slot: PlanOp, hasCore: boolean): void {
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

function readSlot(reader: BitReader, hasCore: boolean): PlanOp {
  const readOp = (): string => {
    const name = OP_BY_NO[reader.read(8)]?.name;
    if (!name) throw new Error('Unknown operator');
    return name;
  };
  const name = readOp(),
    elite = !!reader.read(1),
    core = hasCore && !!reader.read(1);
  const eqKind = reader.read(2),
    altCount = reader.read(2);
  const eq: string[] = [],
    alt: string[] = [];
  for (let e = 0; e < (eqKind === 3 ? 1 : eqKind); e++) {
    const item = EQ_BY_NO.get(reader.read(7));
    if (!item) throw new Error('Unknown equipment');
    eq.push(item.name);
  }
  if (eqKind === 3) eq.push(eq[0]);
  for (let a = 0; a < altCount; a++) {
    const candidate = readOp();
    if (candidate === name || alt.includes(candidate))
      throw new Error('Invalid alternate');
    alt.push(candidate);
  }
  return {name, elite, core, eq, alt};
}

function writeLayers(writer: BitWriter, value: Layers): void {
  const layers = Object.entries(cleanLayers(value)).sort(
    ([a], [b]) => COV_NO.get(a)! - COV_NO.get(b)!,
  );
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
}

function readLayers(reader: BitReader): Layers {
  const layers: Layers = {};
  if (reader.read(1)) {
    const selected: string[] = [];
    if (reader.read(1)) {
      for (const c of LAYER_NAMES) if (reader.read(1)) selected.push(c);
    } else {
      const layerCount = reader.read(5);
      if (layerCount > LAYER_NAMES.length) throw new Error('Invalid layer');
      for (let i = 0; i < layerCount; i++) {
        const c = LAYER_NAMES[reader.read(5)];
        if (!c || selected.includes(c)) throw new Error('Invalid layer');
        selected.push(c);
      }
    }
    if (!selected.length) throw new Error('Invalid layer');
    const width = reader.read(4) + 1;
    if (width > 14) throw new Error('Invalid layer');
    for (const c of selected) {
      const value = reader.read(width);
      if (!value || value > MAX_LAYERS) throw new Error('Invalid layer');
      layers[c] = value;
    }
  }
  return layers;
}

function strategyNumber(name: string): number {
  return Object.hasOwn(STRATEGY, name)
    ? +STRATEGY[name].portrait.slice(1) + 1
    : 0;
}
function readStrategy(reader: BitReader): string {
  const id = reader.read(6);
  if (!id) return '';
  const strategy = ST_BY_NO.get(id);
  if (!strategy) throw new Error('Unknown strategy');
  return strategy.name;
}

type Section = Pick<Plan, 'ops' | 'note' | 'layers'>;
const referenceBits = (count: number): number =>
  Math.ceil(Math.log2(Math.max(count, 1)));

/**
 * 为本机可编辑阵容生成 WS 分享码。旧规格方案沿用原协议，其余使用扩展协议。
 * 每种不同配置的干员仅完整写一次；引用还原为独立对象，编辑一个阶段不会影响另一个。
 * 完整说明按原 UTF-16 码元保存，超出领域上限时报错。
 */
export function encodePlan(plan: Shared): string {
  const icon = readPlanIcon(plan.icon);
  if (plan.icon && (!icon || icon.name.length > 63))
    throw new Error('Invalid plan icon');
  const stages = plan.stages ?? [];
  const alternatives = cleanStrategyAlternates(
    plan.strategy,
    plan.strategyAlternates,
  );
  const sections: Section[] = [plan, ...stages];
  if (
    plan.name.length > 16 ||
    sections.some((s) => s.note.length > MAX_NOTE || s.ops.length > MAX_OPS)
  )
    throw new Error('Plan exceeds sharing limits');
  if (
    stages.length > MAX_STAGE_ROUND ||
    stages.some((s, i) => !validStageRange(s.from, s.to, stages, i))
  )
    throw new Error('Invalid stage ranges');
  if (alternatives.length !== (plan.strategyAlternates?.length ?? 0))
    throw new Error('Invalid strategy alternates');

  const extended = !!(
    icon ||
    stages.length ||
    alternatives.length ||
    plan.ops.length > LEGACY_OPS ||
    plan.note.length > LEGACY_NOTE
  );
  const rosters = sections.map((s) => cleanOps(s.ops));
  const hasCore = rosters.some((ops) => ops.some((slot) => slot.core));
  const text =
    (icon?.name ?? '') + plan.name + sections.map((s) => s.note).join('');
  let best = '';
  // 大型合集用 UTF-16 加 DEFLATE，避免在手机上反复压缩整份长文。
  const modes = text.length > 8192 ? ([1] as const) : ([0, 1, 2] as const);
  for (const mode of modes) {
    const writer = new BitWriter();
    if (icon) {
      writer.write(ICON_KINDS.indexOf(icon.kind), 2);
      writer.write(icon.name.length, 6);
    }
    if (extended) {
      writer.write(plan.name.length, 5);
      writer.write(strategyNumber(plan.strategy), 6);
      writer.write(alternatives.length, 3);
      for (const name of alternatives) writer.write(strategyNumber(name), 6);
      writer.write(stages.length, 7);
    } else {
      writer.write(rosters[0].length, 4);
      writer.write(strategyNumber(plan.strategy), 6);
      writer.write(plan.name.length, 5);
      writer.write(plan.note.length, 8);
    }
    const slots = new Map<string, number>();
    for (const [i, section] of sections.entries()) {
      if (i) {
        writer.write(stages[i - 1].from, 7);
        writer.write(stages[i - 1].to, 7);
      }
      if (extended) {
        writer.write(section.note.length, 11);
        writer.write(rosters[i].length, 5);
      }
      for (const slot of rosters[i]) {
        if (extended) {
          const key = JSON.stringify(slot);
          const ref = slots.get(key);
          writer.write(+(ref !== undefined), 1);
          if (ref !== undefined) {
            writer.write(ref, referenceBits(slots.size));
            continue;
          }
          slots.set(key, slots.size);
        }
        writeSlot(writer, slot, hasCore);
      }
      writeLayers(writer, section.layers);
    }
    if (!writeShareText(writer, text, mode)) continue;
    const payload = writer.finish();
    if (payload.length > (extended ? MAX_EXTENDED_PAYLOAD : MAX_PAYLOAD))
      continue;
    const candidate = packSharePayload(
      payload,
      mode,
      hasCore,
      extended,
      !!icon,
    );
    if (!best || candidate.length < best.length) best = candidate;
  }
  if (!best) throw new Error('Share data too large');
  return CODE_PREFIX + best;
}

export interface Decoded {
  plan: Shared;
}

/** 接受分享码、链接、片段或完整攻略文案，损坏和超限输入返回 null。 */
export function decodePlan(input: string): Decoded | null {
  if (input.length > MAX_EXTENDED_PAYLOAD * 4) return null;
  const source = planShareSource(input);
  const token =
    source.match(/#p=([A-Za-z0-9_-]+)/)?.[1] ??
    source.match(/(?:^|[^A-Za-z0-9_-])WS([A-Za-z0-9_-]+)/)?.[1];
  if (!token) return null;
  try {
    const {reader, mode, hasCore, extended, hasIcon} =
      unpackSharePayload(token);
    const iconKind = hasIcon ? ICON_KINDS[reader.read(2)] : undefined;
    const iconLength = hasIcon ? reader.read(6) : 0;
    const legacyCount = extended ? 0 : reader.read(4);
    const extendedNameLength = extended ? reader.read(5) : 0;
    const strategy = readStrategy(reader);
    const nameLength = extended ? extendedNameLength : reader.read(5);
    if (nameLength > 16) return null;

    const alternatives: string[] = [];
    const altCount = extended ? reader.read(3) : 0;
    if (altCount >= MAX_STRATEGIES || (altCount && !strategy)) return null;
    for (let i = 0; i < altCount; i++) {
      const alt = readStrategy(reader);
      if (!alt || alt === strategy || alternatives.includes(alt)) return null;
      alternatives.push(alt);
    }
    const stageCount = extended ? reader.read(7) : 0;
    if (stageCount > MAX_STAGE_ROUND) return null;
    const sections: Section[] = [],
      stages: PlanStage[] = [],
      noteLengths: number[] = [];
    const slots: PlanOp[] = [];
    for (let i = 0; i <= stageCount; i++) {
      const from = i ? reader.read(7) : 0;
      const to = i ? reader.read(7) : 0;
      if (i && !validStageRange(from, to, stages)) return null;
      const noteLength = reader.read(extended ? 11 : 8);
      const count = extended ? reader.read(5) : legacyCount;
      if (
        count > (extended ? MAX_OPS : LEGACY_OPS) ||
        noteLength > (extended ? MAX_NOTE : LEGACY_NOTE)
      )
        return null;
      noteLengths.push(noteLength);
      const ops: PlanOp[] = [];
      for (let j = 0; j < count; j++) {
        let slot: PlanOp;
        if (extended && reader.read(1)) {
          const saved = slots[reader.read(referenceBits(slots.length))];
          if (!saved) return null;
          slot = {...saved, eq: [...saved.eq], alt: [...saved.alt]};
        } else {
          slot = readSlot(reader, hasCore);
          if (extended) slots.push(slot);
        }
        if (ops.some((o) => o.name === slot.name)) return null;
        ops.push(slot);
      }
      const section = {from, to, ops, note: '', layers: readLayers(reader)};
      sections.push(section);
      if (i) stages.push(section);
    }
    const text = readShareText(
      reader,
      noteLengths.reduce((n, length) => n + length, nameLength + iconLength),
      mode,
    );
    const icon: PlanIcon | undefined = hasIcon
      ? readPlanIcon({kind: iconKind, name: text.slice(0, iconLength)})
      : undefined;
    if (hasIcon && !icon) return null;
    let offset = iconLength + nameLength;
    sections.forEach((section, i) => {
      section.note = text.slice(offset, offset + noteLengths[i]);
      offset += noteLengths[i];
    });
    const {ops, layers, note} = sections[0];
    return {
      plan: {
        name: text.slice(iconLength, iconLength + nameLength),
        ...(icon ? {icon} : {}),
        ops,
        layers,
        note,
        strategy,
        ...(alternatives.length ? {strategyAlternates: alternatives} : {}),
        ...(stages.length ? {stages} : {}),
      },
    };
  } catch {
    return null;
  }
}

/** 链接的 #p= 已标明用途，省去只用于识别独立分享码的 WS 前缀。 */
export const shareUrl = (code: string, origin = location.origin): string =>
  `${origin}/#p=${code.slice(CODE_PREFIX.length)}`;

/** 当前二维码使用 Byte 模式和 M 级纠错，40 版容量为 2331 个字节。 */
export function canShareViaQr(link: string): boolean {
  // shareUrl 生成的 URL 为 ASCII，包括国际化域名的 punycode 形式。
  return !!link && link.length <= 2331 && /^[\x20-\x7e]+$/.test(link);
}

export const stageRoundLabel = (from: number, to: number): string =>
  from === to ? `第 ${from} 回合` : `第 ${from}–${to} 回合`;

const SHARE_STAGES: readonly (readonly [
  label: string,
  tiers: readonly number[],
])[] = [
  ['前期抓牌(1-2阶)', [1, 2]],
  ['中期抓牌(3-4阶)', [3, 4]],
  ['后期抓牌(5-6阶)', [5, 6]],
];

function formatSection(section: Section, lines: string[]): void {
  const ops = cleanOps(section.ops);
  const layers = cleanLayers(section.layers);
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

  const extraLayers = Object.entries(layers)
    .filter(([name]) => !activeStats.some((s) => s.name === name))
    .map(([name, count]) => `${name} ${count} 层`);
  if (extraLayers.length) lines.push(`记录层数：${extraLayers.join(' · ')}`);

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

  const noteLines = section.note
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (noteLines.length === 1) {
    lines.push(`打法要点：${noteLines[0]}`);
  } else if (noteLines.length > 1) {
    lines.push('打法要点：');
    noteLines.forEach((line, index) => lines.push(`${index + 1}. ${line}`));
  }
}

/**
 * 整理分段抓牌、策略和打法要点，末行链接可还原完整方案。
 * 省略 link 时生成分享码或链接；传入空字符串可在编码失败时仍复制可读文案。
 */
export function formatPlanShareText(plan: Shared, link?: string): string {
  const lines = [`【卫戍流派】${plan.name.trim() || '自建流派'}`];
  if (Object.hasOwn(STRATEGY, plan.strategy)) {
    const st = STRATEGY[plan.strategy];
    lines.push(`策略：${st.name}「${st.skill}」`);
  }
  if (plan.strategyAlternates?.length)
    lines.push(`备选策略：${plan.strategyAlternates.join('、')}`);
  for (const stage of plan.stages ?? []) {
    lines.push('', `【${stageRoundLabel(stage.from, stage.to)}】`);
    formatSection(stage, lines);
  }
  if (plan.stages?.length) lines.push('', '【终盘阵容】');
  formatSection(plan, lines);
  if (link === undefined) {
    const code = encodePlan(plan);
    lines.push(
      typeof location === 'undefined'
        ? `分享码：${code}`
        : `导入链接：${shareUrl(code)}`,
    );
  } else if (link) {
    lines.push(`导入链接：${link}`);
  }
  return lines.join('\n');
}
