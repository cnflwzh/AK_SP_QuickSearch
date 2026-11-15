/**
 * 旧版展示文案适配层，仅识别已有模型支持的语句。
 * 当前客户端规则尚未全部结构化；这里的匹配不能作为新增游戏规则的证据。
 */
import { EQUIPMENT,OPERATOR,type Operator } from '../../../../data/index.ts';
import { covenantsOf,type CovenantStat } from '../../plans/covenants.ts';
import { usesLayers,type PlanOp } from '../../plans/model.ts';
import { FRONT_LAYER_PATTERN } from './advisorPosition.ts';
import type {
LayerGain,
ValueContext,
ValueRoster,
} from './advisorValueTypes.ts';
const ACQUISITION_COUNT_PATTERN =
  /^<休整期结束时>本回合每获得过一名干员，使已激活的((?:【[^】]+】)+)层数\+(\d+)（每回合至多(?:叠加)?(\d+)层）$/;
const EQUIPMENT_BY_NAME_LENGTH = [...EQUIPMENT].sort(
  (first, second) => second.name.length - first.name.length,
);
export interface RestLayerEffects {
  gains: LayerGain[];
  reasons: string[];
  entersRest: boolean;
  startsAndEnds: boolean;
  currentRoundOnly: boolean;
  unknownHighestTarget: boolean;
}
interface ResolvedLayerTargets {
  gains: LayerGain[];
  reasons: string[];
}
function covenantTags(text: string): string[] {
  return [...text.matchAll(/【([^】]+)】/g)].map((match) => match[1]);
}
function layerGains(covenants: readonly string[], amount: number): LayerGain[] {
  return covenants.map((covenant) => ({ covenant, amount }));
}
function distinctCovenants(slot: PlanOp): string[] {
  const covenants = covenantsOf(slot);
  return [...new Set([...covenants.own, ...covenants.granted])];
}
/** 只识别紧挨明确盟约列表的固定加层，不从条件次数或上限猜实际收益。 */
function fixedLayers(text: string): LayerGain[] {
  return [...text.matchAll(/((?:【[^】]+】)+)层数\+(\d+)/g)].flatMap((match) =>
    layerGains(covenantTags(match[1]), Number(match[2])),
  );
}
/** 身前未知时保留自身下界；已确认目标只补计不重合盟约。 */
function adjacentLayerTargets(
  slot: PlanOp,
  amount: number,
  isBehind: boolean,
  active: readonly CovenantStat[],
  context: ValueContext,
  roster?: ValueRoster,
): ResolvedLayerTargets {
  const own = new Set(distinctCovenants(slot));
  const gains = layerGains([...own], amount);
  const reasons: string[] = [];
  const targetName = isBehind ? undefined : context.frontTargets?.[slot.name];
  const target =
    targetName &&
    roster?.field.find(
      (member) => member.name === targetName && member.name !== slot.name,
    );
  if (target) {
    const frontCovenants = distinctCovenants(target);
    gains.push(
      ...layerGains(
        frontCovenants.filter((covenant) => !own.has(covenant)),
        amount,
      ),
    );
    reasons.push(`按已录身前${target.name}，计入其独有且已激活的盟约产层`);
    if (
      frontCovenants.some(
        (covenant) =>
          own.has(covenant) && active.some((stat) => stat.name === covenant),
      )
    ) {
      reasons.push(
        '与身前共享的盟约是否重复叠层尚未核实，仅计自身一次作为下界',
      );
    }
  } else if (targetName === '') {
    reasons.push('已录身前无人，仅计自身已激活盟约');
  } else {
    reasons.push(
      isBehind
        ? '仅计自身已激活盟约；身后一格未录入，不借用身前关系或假定相邻干员收益'
        : '仅计自身已激活盟约；身前一格未录入或已变动，未假定相邻干员收益',
    );
  }
  return { gains, reasons };
}
/** 按明确记录的人、装备携带者或不同等阶计数，不推算未录副本。 */
function rosterLayerTargets(
  text: string,
  roster: ValueRoster,
): ResolvedLayerTargets | undefined {
  const reserveCovenants = text.match(
    /^<休整期结束时>使整备区每名干员已激活的盟约层数\+(\d+)/,
  );
  if (reserveCovenants) {
    const amounts = new Map<string, number>();
    for (const member of roster.reserve) {
      for (const covenant of distinctCovenants(member)) {
        amounts.set(
          covenant,
          (amounts.get(covenant) ?? 0) + Number(reserveCovenants[1]),
        );
      }
    }
    return {
      gains: [...amounts].map(([covenant, amount]) => ({ covenant, amount })),
      reasons: ['按已记录整备区干员各自盟约计层；未记录的同名副本不推算'],
    };
  }
  const equipped = text.match(
    /^<休整期结束时>场上每有一名携带装备的干员，使已激活的((?:【[^】]+】)+)层数\+(\d+)/,
  );
  if (equipped) {
    const count = roster.field.filter((member) => member.eq.length > 0).length;
    return {
      gains: layerGains(covenantTags(equipped[1]), Number(equipped[2]) * count),
      reasons: [`按场上${count}名装备携带者计算，不按装备件数重复计人`],
    };
  }
  const tiers = text.match(
    /^<休整期结束时>场上每有一名不同阶的【([^】]+)】干员，使已激活的((?:【[^】]+】)+)层数\+(\d+)/,
  );
  if (tiers) {
    const members = roster.field.filter((member) =>
      distinctCovenants(member).includes(tiers[1]),
    );
    const count = new Set(members.map((member) => OPERATOR[member.name]?.tier))
      .size;
    return {
      gains: layerGains(covenantTags(tiers[2]), Number(tiers[3]) * count),
      reasons: [`按场上${tiers[1]}的${count}种等阶计算`],
    };
  }
  const benched = text.match(
    /^<休整期结束时>整备区每有一名干员，使已激活的((?:【[^】]+】)+)层数\+(\d+)/,
  );
  if (benched) {
    return {
      gains: layerGains(
        covenantTags(benched[1]),
        Number(benched[2]) * roster.reserve.length,
      ),
      reasons: [`按整备区${roster.reserve.length}名已记录干员计算`],
    };
  }
  return undefined;
}
/** 解析层数目标和已知数量，不决定估值权重或把未知目标当成确定产层。 */
export function resolveRestLayerEffects(
  text: string,
  slot: PlanOp,
  stats: readonly CovenantStat[],
  context: ValueContext,
  roster?: ValueRoster,
): RestLayerEffects {
  const withoutAcquire = text.replace(/<获得时>[^<]*/g, '');
  const restText = withoutAcquire.replace(
    /^<休整期开始时>(?=<休整期结束时>)/,
    '',
  );
  const active = stats.filter((stat) => stat.active && usesLayers(stat.name));
  const direct = restText.match(
    /^<休整期结束时>使已激活的((?:【[^】]+】)+)层数\+(\d+)(?:$|（)/,
  );
  const effects: RestLayerEffects = {
    gains: direct ? layerGains(covenantTags(direct[1]), Number(direct[2])) : [],
    reasons: [],
    entersRest: false,
    startsAndEnds: text.startsWith('<休整期开始时><休整期结束时>'),
    currentRoundOnly: false,
    unknownHighestTarget: false,
  };
  const fixedAmount = Number(withoutAcquire.match(/层数\+(\d+)/)?.[1] ?? 0);
  if (/^<休整期结束时>使已激活的核心盟约层数\+/.test(restText)) {
    effects.gains = layerGains(
      active.filter((stat) => stat.core).map((stat) => stat.name),
      fixedAmount,
    );
  }
  if (
    /^<休整期结束时>使当前已激活且层数最多的盟约层数\+/.test(restText) &&
    active.length
  ) {
    const known = active.filter((stat) =>
      Object.hasOwn(context.layers, stat.name),
    );
    const selected = [...known].sort(
      (first, second) =>
        context.layers[second.name] - context.layers[first.name],
    )[0];
    if (selected && known.length === active.length) {
      effects.gains = [{ covenant: selected.name, amount: fixedAmount }];
    } else {
      effects.unknownHighestTarget = true;
      effects.reasons.push(
        '可为最高层激活盟约叠层；层数未完整录入，不假定目标',
      );
    }
  }
  const selfAndBack = restText.match(
    /^<进入休整期时>使自身及身后一格干员已激活的盟约层数\+(\d+)/,
  );
  const selfAndAdjacent = restText.match(FRONT_LAYER_PATTERN) ?? selfAndBack;
  if (selfAndAdjacent) {
    effects.entersRest = restText.startsWith('<进入休整期时>');
    const adjacent = adjacentLayerTargets(
      slot,
      Number(selfAndAdjacent[1]),
      Boolean(selfAndBack),
      active,
      context,
      roster,
    );
    effects.gains = adjacent.gains;
    effects.reasons.push(...adjacent.reasons);
  }
  const rosterEffects = roster
    ? rosterLayerTargets(restText, roster)
    : undefined;
  if (rosterEffects) {
    effects.gains = rosterEffects.gains;
    effects.reasons.push(...rosterEffects.reasons);
  }
  // 风絮、夕只按本轮确认记录结算，不外推购买频率到后续回合。
  const acquisitionCount = restText.match(ACQUISITION_COUNT_PATTERN);
  effects.currentRoundOnly = Boolean(acquisitionCount);
  if (acquisitionCount) {
    if (context.acquisitionsThisRound == null) {
      effects.reasons.push('本轮获得人数未记录，未将叠层上限当作实际收益');
    } else {
      const amount = Math.min(
        context.acquisitionsThisRound * Number(acquisitionCount[2]),
        Number(acquisitionCount[3]),
      );
      effects.gains = layerGains(covenantTags(acquisitionCount[1]), amount);
      effects.reasons.push(
        `按本轮已确认获得${context.acquisitionsThisRound}名计入本次结束产层，仅计已确认下界，不另算拟购买或未来回合获得人数`,
      );
    }
  }
  return effects;
}
export interface AcquisitionEffects {
  hasText: boolean;
  gains: LayerGain[];
  growsWithTriggers: boolean;
  freeRefreshes: number;
  equipmentReward?: {
    name: string;
    count: number;
  };
}
/** 只读取保证获得的第一项装备，不将后续随机奖励并入保证收益。 */
export function resolveAcquisitionEffects(
  operator: Operator,
  elite: boolean,
  level: number,
): AcquisitionEffects {
  const trait = elite ? operator.elite : operator.trait;
  const text = trait.match(/<获得时>([^<]*)/)?.[1] ?? '';
  let gains = fixedLayers(text);
  if (/等同于当前调度中心等级(?:两倍)?的【炎】层数/.test(text)) {
    gains = [{ covenant: '炎', amount: level * (elite ? 2 : 1) }];
  }
  const guaranteed = text.split(/[，；]/)[0];
  const equipment = EQUIPMENT_BY_NAME_LENGTH.find((item) =>
    guaranteed.includes(item.name),
  );
  const hasEquipmentReward =
    equipment || /获得[一两]枚“盟约之币”/.test(guaranteed);
  const equipmentReward = hasEquipmentReward
    ? {
        name:
          guaranteed.match(/获得[一两12][件个枚][“"]?([^”"]+)/)?.[1] ??
          equipment?.name ??
          '盟约之币',
        count: /获得(?:两|2)[件个枚]/.test(guaranteed) ? 2 : 1,
      }
    : undefined;
  const freeRefreshes = /获得(?:一|1|两|2)次免费刷新/.test(text)
    ? /获得(?:两|2)次/.test(text)
      ? 2
      : 1
    : 0;
  return {
    hasText: Boolean(text),
    gains,
    growsWithTriggers: /触发后升级|触发\d+次后升级/.test(text),
    freeRefreshes,
    equipmentReward,
  };
}
export interface BattleEffects {
  temporaryGains: LayerGain[];
  conditionalCap: number;
  conditionalCovenants: string[];
  convertsLayers: boolean;
  conversionCovenants: string[];
  attackConversion?: {
    covenant: string;
    layersPerTrigger: number;
    attackPercent: number;
  };
  savesUrsusLayers: boolean;
}
/** 战斗效果只解析限定类型；上限、属性比例、临时层不会变成休整确定产层。 */
export function resolveBattleEffects(
  text: string,
  slot: PlanOp,
): BattleEffects {
  const withoutAcquire = text.replace(/<获得时>[^<]*/g, '');
  const restText = withoutAcquire.replace(
    /^<休整期开始时>(?=<休整期结束时>)/,
    '',
  );
  const temporary = restText.match(
    /^<战斗开始时>使已激活的((?:【[^】]+】)+)临时层数\+(\d+)$/,
  );
  const cap = Number(
    withoutAcquire.match(/每(?:回合|场战斗)至多(?:叠加)?(\d+)层/)?.[1] ?? 0,
  );
  const covenants = covenantsOf(slot);
  const conversion = restText.match(
    /^<战斗中>【([^】]+)】每叠加(\d+)层，本干员攻击力\+(\d+)%$/,
  );
  return {
    temporaryGains: temporary
      ? covenantTags(temporary[1]).map((covenant) => ({
          covenant,
          amount: Number(temporary[2]),
        }))
      : [],
    conditionalCap: withoutAcquire.includes('<战斗中>') ? cap : 0,
    conditionalCovenants: withoutAcquire.includes('自身已激活')
      ? [...covenants.own, ...covenants.granted]
      : covenantTags(withoutAcquire),
    convertsLayers:
      withoutAcquire.includes('每叠加') && /本干员|自身/.test(restText),
    conversionCovenants: [...new Set(covenantTags(withoutAcquire))],
    attackConversion: conversion
      ? {
          covenant: conversion[1],
          layersPerTrigger: Number(conversion[2]),
          attackPercent: Number(conversion[3]),
        }
      : undefined,
    savesUrsusLayers: withoutAcquire.includes('临时层数为固定层数'),
  };
}
/** 每回合上限是否与指令共享尚未确认，不能直接复制这类特质。 */
export function isAcquisitionCountTrait(text: string): boolean {
  return ACQUISITION_COUNT_PATTERN.test(text);
}
/** 动态目标的指令与自然结算顺序未知，禁止宣称确定的合计门槛。 */
export function hasHighestLayerTarget(text: string): boolean {
  return /<休整期结束时>使当前已激活且层数最多/.test(text);
}
