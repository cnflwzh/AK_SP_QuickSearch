/** 方案领域数据与纯校验。没有浏览器存储、分享编码或推荐评分。 */
import {
  COVENANTS,
  EQUIP,
  OPERATOR,
  STRATEGY,
  buildByName,
} from '../../../data/index.ts';
export const MAX_OPS = 8;
export const MAX_EQ = 2;
/** 每个位置的备选干员数：抓不到主选时的次级选择 */
export const MAX_ALT = 3;
/** 流派说明字数上限 */
export const MAX_NOTE = 150;
/** 盟约层数：滑条到 1000，输入框可以填到 9999 */
export const LAYER_SLIDER = 1000;
export const MAX_LAYERS = 9999;

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
/** base：改自哪个内置流派（同名内置流派由这份修改版代替）；没有 = 自建流派 */
export interface Plan {
  id: string;
  name: string;
  ops: PlanOp[];
  strategy: string;
  note: string;
  layers: Layers;
  updated: number;
  base?: string;
}

export const usesLayers = (name: string): boolean =>
  /层/.test(COVENANTS[name].effect + COVENANTS[name].bonus);
const clampLayers = (n: unknown): number =>
  Math.max(0, Math.min(MAX_LAYERS, Math.round(+(n as number) || 0)));

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

/** 内置流派转成方案：终盘阵容、首选策略，要点逐行写进说明 */
export function builtinPlan(name: string): Plan | null {
  const build = buildByName(name);
  if (!build) return null;
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
    strategy: build.strategies.find((s) => Object.hasOwn(STRATEGY, s)) ?? '',
    note: build.tips.join('\n').slice(0, MAX_NOTE),
  };
}
/** 两份方案的内容是否一样（不看 id、修改时间） */
export const samePlan = (a: Plan, b: Plan): boolean =>
  JSON.stringify([a.name, a.ops, a.strategy, a.note, cleanLayers(a.layers)]) ===
  JSON.stringify([b.name, b.ops, b.strategy, b.note, cleanLayers(b.layers)]);

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const knownOp = (name: unknown): name is string =>
  typeof name === 'string' && Object.hasOwn(OPERATOR, name);
const knownEq = (name: unknown): name is string =>
  typeof name === 'string' && Object.hasOwn(EQUIP, name);

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
