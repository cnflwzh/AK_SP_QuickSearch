/** 按方案计算盟约与装备赋予效果；不读取局内状态或存档。 */
import {
  ALL_COVENANTS,
  COVENANTS,
  EQUIP,
  OPERATOR,
  isCoreCovenant,
} from '../../../data/index.ts';
import { type Layers, type PlanOp } from './model.ts';
const ISOMORPH = '变形同构体';
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
export function covenantsOf(slot: PlanOp): {
  own: readonly string[];
  granted: string[];
} {
  const own = OPERATOR[slot.name]?.covenants ?? [];
  const granted = slot.eq.includes(ISOMORPH)
    ? slot.eq
        .map((name) => EQUIP[name]?.covenant)
        .filter((c): c is string => !!c && !own.includes(c))
    : [];
  return { own, granted: [...new Set(granted)] };
}

export const bonusNeedOf = (bonus: string): number =>
  +(bonus.match(/^(\d+)名(?!精锐)/)?.[1] ?? 0);
export const bonusLayersOf = (bonus: string): number =>
  +(bonus.match(/(\d+)层/)?.[1] ?? 0);

/** 效果或强化条件里出现“层”的盟约，才需要填层数 */
/** 这些经济盟约按场上与整备区的不同干员合计，其余盟约只数场上。 */
export const RESERVE_COVENANTS: ReadonlySet<string> = new Set([
  '远见',
  '奇迹',
  '投资人',
]);

/** 返回场上盟约状态；reserve 只为允许整备区计数的经济盟约提供人数。 */
export function covenantStats(
  ops: readonly PlanOp[],
  layers: Layers = {},
  reserve: readonly PlanOp[] = [],
  inactive: ReadonlySet<string> = new Set(),
): CovenantStat[] {
  const members = new Map<string, Set<string>>(),
    granted = new Map<string, Set<string>>();
  for (const slot of ops) {
    const { own, granted: extra } = covenantsOf(slot);
    for (const c of [...own, ...extra])
      (members.get(c) ?? members.set(c, new Set()).get(c)!).add(slot.name);
    for (const c of extra)
      (granted.get(c) ?? granted.set(c, new Set()).get(c)!).add(slot.name);
  }
  for (const slot of reserve) {
    const { own, granted: extra } = covenantsOf(slot);
    for (const c of [...own, ...extra].filter((name) =>
      RESERVE_COVENANTS.has(name),
    )) {
      (members.get(c) ?? members.set(c, new Set()).get(c)!).add(slot.name);
      if (extra.includes(c))
        (granted.get(c) ?? granted.set(c, new Set()).get(c)!).add(slot.name);
    }
  }
  // 绝技按全场精锐计数，不依赖干员原有盟约；数据表里没有原生绝技干员。
  const eliteMembers = new Set(ops.filter((o) => o.elite).map((o) => o.name));
  if (eliteMembers.size) members.set('绝技', eliteMembers);
  const harmony = members.has('调和') && !inactive.has('调和');
  const elites = eliteMembers.size;
  // 强化状态随层数变化，只更新数值和提示，避免拖动层数时列表跳位。
  return ALL_COVENANTS.filter(
    (name) => members.has(name) && !inactive.has(name),
  )
    .map((name) => {
      const cov = COVENANTS[name],
        core = isCoreCovenant(name);
      const list = [...members.get(name)!];
      const extra = core && harmony ? 1 : 0;
      const count = list.length + extra;
      const bonusElite = name === '绝技';
      const bonusNeed = bonusElite
        ? 5
        : bonusNeedOf(cov.bonus) || (core ? 6 : 0);
      const bonusLayers = bonusNeed ? 0 : bonusLayersOf(cov.bonus);
      const broken = name === '独行' && count > 1;
      const active = !broken && count >= cov.need;
      const bonusCount = bonusElite ? elites : count;
      const bonusActive =
        active &&
        (bonusNeed
          ? bonusCount >= bonusNeed
          : bonusLayers
            ? (layers[name] ?? 0) >= bonusLayers
            : false);
      const next = broken
        ? 0
        : count < cov.need
          ? cov.need - count
          : bonusNeed && !bonusElite && count < bonusNeed
            ? bonusNeed - count
            : 0;
      return {
        name,
        core,
        members: list,
        granted: [...(granted.get(name) ?? [])],
        extra,
        count,
        need: cov.need,
        bonusNeed,
        bonusLayers,
        bonusElite,
        bonusCount,
        active,
        bonusActive,
        next,
        broken,
      };
    })
    .sort(
      (a, b) => +b.active - +a.active || +b.core - +a.core || b.count - a.count,
    );
}

/** 把 "(23+0.9×层)" 换成该层数下的数值 */
export const atLayers = (text: string, layers: number): string =>
  text.replace(
    /\((\d+(?:\.\d+)?)\+(\d+(?:\.\d+)?)×层\)/g,
    (match, a: string, b: string, offset: number) => {
      const value = Math.round((+a + +b * layers) * 100) / 100;
      return String(
        /^%\s*概率/.test(text.slice(offset + match.length))
          ? Math.min(100, value)
          : value,
      );
    },
  );
