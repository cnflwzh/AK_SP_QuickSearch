/** 方案领域数据与纯校验。没有浏览器存储、分享编码或推荐评分。 */
import type {SklandGuide} from './skland.ts';
import {MAX_LAYERS} from '../season/layers.ts';
import {
  COVENANTS,
  EQUIP,
  OPERATOR,
  STRATEGY,
  buildByName,
} from '../../../data/index.ts';
/** 成型阵容与每个阶段独立计算人数。 */
export const MAX_OPS = 20;
export const MAX_EQ = 2;
/** 每个位置的备选干员数：抓不到主选时的次级选择 */
export const MAX_ALT = 3;
/** 各阵容说明的 UTF-16 码元上限，与 textarea.maxLength 一致。 */
export const MAX_NOTE = 2000;
/** 首选与有序备选共用推荐策略名额。 */
export const MAX_STRATEGIES = 5;
/** 可规划回合包含第 15 回合。分享协议仍沿用原有位宽。 */
export const MAX_STAGE_ROUND = 15;
/** 盟约层数：滑条到 1000，输入框可以填到 9999 */
export const LAYER_SLIDER = 1000;
export {MAX_LAYERS};

/** core：用户标注的核心干员，仅用于展示；alt：主选抓不到时的备选名单，不计入盟约统计。 */
export interface PlanOp {
  name: string;
  elite: boolean;
  core: boolean;
  eq: string[];
  alt: string[];
}
/** layers：各盟约自己的层数（只记效果随层数变化的盟约） */
export type Layers = Record<string, number>;
/** 闭区间 [from, to] 的独立阵容，允许在相邻阶段之间留出未规划回合。 */
export interface PlanStage {
  from: number;
  to: number;
  ops: PlanOp[];
  note: string;
  layers: Layers;
}
/** 图标只引用本赛季的图鉴条目，存档和分享均不保存图片地址。 */
export const PLAN_ICON_CATALOGS = {
  covenant: COVENANTS,
  operator: OPERATOR,
  strategy: STRATEGY,
  equipment: EQUIP,
} as const;
export interface PlanIcon {
  kind: keyof typeof PLAN_ICON_CATALOGS;
  name: string;
}

/** 从外部数据还原已知图标，缺省或已失效的条目交由界面显示默认图标。 */
export function readPlanIcon(value: unknown): PlanIcon | undefined {
  if (
    !record(value) ||
    typeof value.kind !== 'string' ||
    !Object.hasOwn(PLAN_ICON_CATALOGS, value.kind) ||
    typeof value.name !== 'string'
  )
    return;
  const kind = value.kind as PlanIcon['kind'];
  if (Object.hasOwn(PLAN_ICON_CATALOGS[kind], value.name))
    return {kind, name: value.name};
}

/** 预设默认沿用同名盟约徽章，自建流派缺省时使用通用图标。 */
export function effectivePlanIcon(
  plan: Pick<Plan, 'base' | 'icon'>,
): PlanIcon | undefined {
  return (
    plan.icon ??
    (plan.base && Object.hasOwn(COVENANTS, plan.base)
      ? {kind: 'covenant', name: plan.base}
      : undefined)
  );
}
/** base：改自哪个内置流派（同名内置流派由这份修改版代替）；没有 = 自建流派 */
export interface Plan {
  /** 最近导入的森空岛原文快照，与可编辑的本局配置独立保存。 */
  skland?: SklandGuide;
  id: string;
  name: string;
  icon?: PlanIcon;
  ops: PlanOp[];
  strategy: string;
  /** 首选以外的推荐策略，按玩家设置的优先级排列。 */
  strategyAlternates?: string[];
  stages?: PlanStage[];
  note: string;
  layers: Layers;
  updated: number;
  base?: string;
}

export function usesLayers(name: string): boolean {
  if (!Object.hasOwn(COVENANTS, name)) return false;
  const covenant = COVENANTS[name];
  return !!(covenant.scaling.length || covenant.layerBreakpoints?.length || covenant.cycleReward);
}
const clampLayers = (n: unknown): number =>
  typeof n === 'number' || typeof n === 'string'
    ? Math.max(0, Math.min(MAX_LAYERS, Math.round(Number(n) || 0)))
    : 0;

export const cleanLayers = (layers: unknown): Layers =>
  Object.fromEntries(
    Object.entries(layers && typeof layers === 'object' ? layers : {})
      .filter(([c]) => Object.hasOwn(COVENANTS, c) && usesLayers(c))
      .map(([c, n]) => [c, clampLayers(n)])
      .filter(([, n]) => n),
  );

export const newSlot = (name: string): PlanOp => ({
  name,
  elite: false,
  core: false,
  eq: [],
  alt: [],
});

/** 将内置流派转换为独立可编辑的终盘阵容，保留推荐策略顺序；名称无效时返回 null。 */
export function builtinPlan(name: string): Plan | null {
  const build = buildByName(name);
  if (!build) return null;
  const strategy =
    build.strategies.find((s) => Object.hasOwn(STRATEGY, s)) ?? '';
  const strategyAlternates = cleanStrategyAlternates(
    strategy,
    build.strategies,
  );
  return {
    id: `b:${name}`,
    base: name,
    name: name.slice(0, 16),
    updated: 0,
    layers: {},
    ops: cleanOps(
      build.lineup.map((name) => ({
        ...newSlot(name),
        core: build.carries?.includes(name) ?? false,
        alt: build.alternatives?.[name] ?? [],
      })),
    ),
    strategy,
    ...(strategyAlternates.length ? {strategyAlternates} : {}),
    note: build.tips.join('\n').slice(0, MAX_NOTE),
  };
}
function lineupContent(lineup: Pick<Plan, 'ops' | 'note' | 'layers'>) {
  return [
    lineup.ops.map((slot) => [
      slot.name,
      slot.elite,
      slot.core,
      slot.eq,
      slot.alt,
    ]),
    lineup.note,
    Object.entries(cleanLayers(lineup.layers)).sort(([a], [b]) =>
      a.localeCompare(b),
    ),
  ];
}

/** 生成可编辑内容的比较键，忽略来源、预设归属、时间及层数的写入顺序。 */
export function editablePlanKey(plan: Plan): string {
  return JSON.stringify([
    plan.name,
    plan.icon ? [plan.icon.kind, plan.icon.name] : null,
    ...lineupContent(plan),
    plan.strategy,
    plan.strategyAlternates ?? [],
    (plan.stages ?? []).map((stage) => [
      stage.from,
      stage.to,
      ...lineupContent(stage),
    ]),
  ]);
}

/** 比较两份方案的全部可编辑内容。 */
export const samePlan = (a: Plan, b: Plan): boolean =>
  editablePlanKey(a) === editablePlanKey(b);

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const knownOp = (name: unknown): name is string =>
  typeof name === 'string' && Object.hasOwn(OPERATOR, name);
const knownEq = (name: unknown): name is string =>
  typeof name === 'string' && Object.hasOwn(EQUIP, name);

/** 返回已知、互不重复的备选策略，保留原顺序并排除首选。 */
export function cleanStrategyAlternates(
  primary: string,
  value: unknown,
): string[] {
  if (!Object.hasOwn(STRATEGY, primary) || !Array.isArray(value)) return [];
  const names = value.filter(
    (name): name is string =>
      typeof name === 'string' &&
      name !== primary &&
      Object.hasOwn(STRATEGY, name),
  );
  return [...new Set(names)].slice(0, MAX_STRATEGIES - 1);
}

/** 检查回合范围与已有阶段是否互斥，修改阶段时以 exceptIndex 排除它自身。 */
export function validStageRange(
  from: number,
  to: number,
  stages: readonly PlanStage[],
  exceptIndex?: number,
): boolean {
  return (
    Number.isInteger(from) &&
    Number.isInteger(to) &&
    from >= 1 &&
    from <= to &&
    to <= MAX_STAGE_ROUND &&
    stages.every(
      (stage, index) =>
        index === exceptIndex || to < stage.from || from > stage.to,
    )
  );
}

/** 从本地存档读取有效阶段；重复区间保留首次出现的阶段，其余合法阶段可继续读取。 */
export function cleanStages(value: unknown): PlanStage[] {
  const stages: PlanStage[] = [];
  if (!Array.isArray(value)) return stages;
  for (const stage of value) {
    if (
      !record(stage) ||
      typeof stage.from !== 'number' ||
      typeof stage.to !== 'number' ||
      !Number.isInteger(stage.to) ||
      stage.to > 99
    )
      continue;
    // 旧存档允许规划到 99 回合，跨越新上限的区间保留可用部分及其阵容。
    const to = Math.min(stage.to, MAX_STAGE_ROUND);
    if (!validStageRange(stage.from, to, stages)) continue;
    stages.push({
      from: stage.from,
      to,
      ops: cleanOps(stage.ops),
      note: typeof stage.note === 'string' ? stage.note.slice(0, MAX_NOTE) : '',
      layers: cleanLayers(stage.layers),
    });
  }
  return stages;
}

/** 规范化干员数据；旧存档未记录核心标记时继承预设，显式取消的标记保留为 false。 */
export function cleanOps(
  value: unknown,
  defaultCores: readonly string[] = [],
): PlanOp[] {
  const result: PlanOp[] = [],
    seen = new Set<string>();
  if (!Array.isArray(value)) return result;
  for (const slot of value) {
    if (!record(slot) || !knownOp(slot.name) || seen.has(slot.name)) continue;
    seen.add(slot.name);
    result.push({
      name: slot.name,
      elite: !!slot.elite,
      core:
        typeof slot.core === 'boolean'
          ? slot.core
          : defaultCores.includes(slot.name),
      eq: Array.isArray(slot.eq)
        ? slot.eq.filter(knownEq).slice(0, MAX_EQ)
        : [],
      alt: Array.isArray(slot.alt)
        ? [...new Set(slot.alt.filter(knownOp))]
            .filter((n) => n !== slot.name)
            .slice(0, MAX_ALT)
        : [],
    });
    if (result.length === MAX_OPS) break;
  }
  return result;
}
