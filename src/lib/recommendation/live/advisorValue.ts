/** 整队估值协调：独立特质先求值，再合并本轮门槛与策略机会。 */
import {
  COVENANTS,
  OPERATOR,
  STRATEGY,
  type StrategyScoreFormula,
} from '../../../../data/index.ts';
import {
  covenantStats,
  covenantsOf,
  type CovenantStat,
} from '../../plans/covenants.ts';
import {usesLayers, type Layers, type PlanOp} from '../../plans/model.ts';
import {
  LAYER_MILESTONE_SCORE,
  crossedLayerMilestones,
  layerValue,
  productionHorizon,
} from './advisorLayerValue.ts';
import {
  hasHighestLayerTarget,
  isAcquisitionCountTrait,
} from './advisorTraitText.ts';
import {acquisitionValue, recurringValue} from './advisorTraits.ts';
import type {
  CommandOpportunity,
  LayerGain,
  TraitValue,
  ValueContext,
} from './advisorValueTypes.ts';
export {acquisitionValue, recurringValue} from './advisorTraits.ts';
export type {
  TraitValue,
  ValueContext,
  ValueRoster,
} from './advisorValueTypes.ts';
const REST_COMMAND_WEIGHT = 0.35;
const ACQUISITION_COMMAND_WEIGHT = 0.6;
const ELITE_REPLACEMENT_COST = 35;
const EQUIPMENT_REPLACEMENT_COST = 12;
interface RestProduction {
  stats: CovenantStat[];
  values: TraitValue[];
  totals: Map<string, number>;
}
/** 盟约自身的休整期产层，不是任一干员特质，整队只结算一次。 */
export function covenantProductionValue(
  stats: readonly CovenantStat[],
  context: ValueContext,
): TraitValue {
  const producers = stats.flatMap((stat) => {
    const cfg = stat.active
      ? COVENANTS[stat.name]?.mechanics?.endOfRestAllActiveLayers
      : undefined;
    return cfg
      ? [{name: stat.name, amount: stat.bonusActive ? cfg.bonus : cfg.base}]
      : [];
  });
  if (!producers.length) {
    return {score: 0, reasons: [], endOfRestGains: []};
  }
  const totalAmount = producers.reduce((sum, item) => sum + item.amount, 0);
  const gains = stats
    .filter((stat) => stat.active && usesLayers(stat.name))
    .map((stat) => ({covenant: stat.name, amount: totalAmount}));
  const score = gains.reduce(
    (total, gain) =>
      total +
      layerValue(
        gain.covenant,
        gain.amount * productionHorizon(context),
        stats,
        context,
        false,
      ),
    0,
  );
  return {
    score,
    endOfRestGains: gains,
    reasons: producers.map(
      (producer) =>
        `${producer.name}每次休整结束为所有已激活盟约各+${producer.amount}层；按当前${gains.length}种可叠层盟约计算`,
    ),
  };
}
function bestCommand(candidates: CommandOpportunity[]): CommandOpportunity {
  return (
    candidates.sort((first, second) => second.score - first.score)[0] ?? {
      score: 0,
      reasons: [],
    }
  );
}
function restCommandTarget(
  slot: PlanOp,
  field: readonly PlanOp[],
  reserve: readonly PlanOp[],
  stats: readonly CovenantStat[],
  context: ValueContext,
  hasDynamicTarget: boolean,
): CommandOpportunity {
  const text = slot.elite
    ? OPERATOR[slot.name]?.elite
    : OPERATOR[slot.name]?.trait;
  // 每回合上限是否与额外触发共享尚未核实，不将计数型产层复制一遍。
  const gains =
    text && isAcquisitionCountTrait(text)
      ? []
      : (recurringValue(slot, true, stats, context, {field, reserve})
          .endOfRestGains ?? []);
  const trigger: TraitValue = {
    score: 0,
    reasons: [],
    acquisitionGains: gains,
  };
  const milestones = hasDynamicTarget
    ? {
        score: 0,
        reasons: [
          '存在按层数选目标的休整产层，未假定额外触发顺序或计入合计门槛',
        ],
      }
    : purchaseMilestoneAdjustment(
        trigger,
        stats,
        field,
        reserve,
        context,
        '指令触发',
      );
  const immediateMilestoneScore = hasDynamicTarget
    ? 0
    : gains.reduce(
        (total, gain) =>
          total +
          crossedLayerMilestones(gain.covenant, gain.amount, stats, context)
            .length *
            LAYER_MILESTONE_SCORE,
        0,
      );
  const gainScore = gains.reduce(
    (total, gain) =>
      total + layerValue(gain.covenant, gain.amount, stats, context, false),
    0,
  );
  const score =
    (gainScore + immediateMilestoneScore + milestones.score) *
    REST_COMMAND_WEIGHT;
  const availability =
    context.commandAvailable === true
      ? `已记录本次${context.strategy}指令可用`
      : `若本轮${context.strategy}指令可用`;
  const consumption =
    context.commandAvailable === true
      ? '；未自动消耗指令'
      : '；未假定指令尚未使用';
  const gainDescription = gains
    .map((gain) => `${gain.covenant}+${gain.amount}层`)
    .join('、');
  return {
    target: slot.name,
    score,
    reasons:
      score > 0
        ? [
            `${availability}，可选${slot.name}额外触发一次：${gainDescription}${consumption}`,
            ...milestones.reasons,
          ]
        : [],
  };
}
/** 休整指令只估一次确定的休整结束特质，不预支未来回合或已用指令。 */
export function restCommandOpportunity(
  field: readonly PlanOp[],
  reserve: readonly PlanOp[],
  context: ValueContext,
): CommandOpportunity {
  const trigger = Object.hasOwn(STRATEGY, context.strategy)
    ? STRATEGY[context.strategy].advisor?.commandTrigger
    : undefined;
  if (trigger !== 'rest' || context.commandAvailable === false) {
    return {score: 0, reasons: []};
  }
  const stats = covenantStats(
    field,
    context.layers,
    reserve,
    context.inactiveCovenants,
  );
  // 额外触发不保证早于自然结算；动态选层目标时不推合计门槛。
  const hasDynamicTarget = [...field, ...reserve].some((slot) => {
    const text = slot.elite
      ? OPERATOR[slot.name]?.elite
      : OPERATOR[slot.name]?.trait;
    return hasHighestLayerTarget(text ?? '');
  });
  return bestCommand(
    field.map((slot) =>
      restCommandTarget(slot, field, reserve, stats, context, hasDynamicTarget),
    ),
  );
}
/** 获得指令只估一次额外获得特质；与普通购入奖励独立，未自动消耗指令。 */
export function acquisitionCommandOpportunity(
  field: readonly PlanOp[],
  reserve: readonly PlanOp[],
  context: ValueContext,
): CommandOpportunity {
  const trigger = Object.hasOwn(STRATEGY, context.strategy)
    ? STRATEGY[context.strategy].advisor?.commandTrigger
    : undefined;
  if (trigger !== 'acquisition' || context.commandAvailable === false) {
    return {score: 0, reasons: []};
  }
  // 整备区计数盟约，指令触发沿用完整阵容当前激活状态。
  const stats = covenantStats(
    field,
    context.layers,
    reserve,
    context.inactiveCovenants,
  );
  const candidates = field.map((slot) => {
    const acquisition = acquisitionValue(
      OPERATOR[slot.name],
      slot.elite,
      stats,
      context,
    );
    const milestones = purchaseMilestoneAdjustment(
      acquisition,
      stats,
      field,
      reserve,
      context,
      '指令触发',
    );
    const score =
      (acquisition.score + milestones.score) * ACQUISITION_COMMAND_WEIGHT;
    const availability =
      context.commandAvailable === true
        ? `已记录本次${context.strategy}指令可用`
        : `若本次${context.strategy}指令可用`;
    const consumption =
      context.commandAvailable === true
        ? '；未自动消耗指令'
        : '；未假定指令尚未使用';
    return {
      target: slot.name,
      score,
      reasons:
        score > 0
          ? [
              `${availability}，可选${slot.name}额外触发一次获得时特质；这是指令机会收益，不是再次购买${consumption}`,
              ...milestones.reasons,
            ]
          : [],
    };
  });
  return bestCommand(candidates);
}
function evaluateScoreFormula(
  formula: StrategyScoreFormula,
  field: readonly PlanOp[],
  context: ValueContext,
): number {
  const stats = covenantStats(
    field,
    context.layers,
    [],
    context.inactiveCovenants,
  );
  const elites = field.filter((slot) => slot.elite).length;
  switch (formula.kind) {
    case 'activeCovenantTier': {
      const activeCount = stats.filter((stat) => stat.active).length;
      return (
        Math.max(
          0,
          Math.min(formula.maxActive, activeCount) - (formula.minActive - 1),
        ) * formula.scorePerTier
      );
    }
    case 'fieldEliteThreshold':
      return elites >= formula.minElites ? formula.score : 0;
    case 'fieldEliteQuadratic':
      return elites * elites * formula.factor;
    case 'fieldEliteLinear':
      return elites * formula.scorePerElite;
    case 'distinctActiveOwnCovenantTiers': {
      const eligible = field.filter((slot) =>
        covenantsOf(slot).own.some((name) =>
          stats.some((stat) => stat.name === name && stat.active),
        ),
      );
      return (
        new Set(eligible.map((slot) => OPERATOR[slot.name]?.tier)).size *
        formula.scorePerTier
      );
    }
  }
}
/** 整队策略价值；整备区计数盟约的人数不能用于凑场上激活档位。 */
export function strategyValue(
  field: readonly PlanOp[],
  context: ValueContext,
  reserve: readonly PlanOp[] = [],
): number {
  const advisorRule = Object.hasOwn(STRATEGY, context.strategy)
    ? STRATEGY[context.strategy].advisor
    : undefined;
  if (!advisorRule) {
    return 0;
  }
  let total = 0;
  if (advisorRule.scoreFormula) {
    total += evaluateScoreFormula(advisorRule.scoreFormula, field, context);
  }
  if (advisorRule.commandTrigger === 'rest') {
    total += restCommandOpportunity(field, reserve, context).score;
  } else if (advisorRule.commandTrigger === 'acquisition') {
    total += acquisitionCommandOpportunity(field, reserve, context).score;
  }
  return total;
}
function sumLayerGains(gains: readonly LayerGain[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const gain of gains) {
    totals.set(gain.covenant, (totals.get(gain.covenant) ?? 0) + gain.amount);
  }
  return totals;
}
/** 只汇总本轮结束产层；排除进入休整、临时层和条件未知的指令。 */
function restProduction(
  field: readonly PlanOp[],
  reserve: readonly PlanOp[],
  context: ValueContext,
): RestProduction {
  const stats = covenantStats(
    field,
    context.layers,
    reserve,
    context.inactiveCovenants,
  );
  const roster = {field, reserve};
  const values = [
    covenantProductionValue(stats, context),
    ...field.map((slot) => recurringValue(slot, true, stats, context, roster)),
    ...reserve.map((slot) =>
      recurringValue(slot, false, stats, context, roster),
    ),
  ];
  const totals = sumLayerGains(
    values.flatMap((value) => value.endOfRestGains ?? []),
  );
  return {stats, values, totals};
}
function layersAfterAcquisition(
  layers: Layers,
  gains: ReadonlyMap<string, number>,
): Layers {
  const projected = {...layers};
  for (const [covenant, amount] of gains) {
    if (Object.hasOwn(projected, covenant)) {
      projected[covenant] += amount;
    }
  }
  return projected;
}
/** 获得与本次结束沿同一路径结算门槛，修正分开估值的漏算与重复。 */
export function purchaseMilestoneAdjustment(
  acquisition: TraitValue,
  before: readonly CovenantStat[],
  field: readonly PlanOp[],
  reserve: readonly PlanOp[],
  context: ValueContext,
  sourceLabel = '获得时',
): TraitValue {
  const current = restProduction(field, reserve, context);
  const gains = sumLayerGains(acquisition.acquisitionGains ?? []);
  // 获得先于休整结束。最高层目标可能改变，必须重算整队，而不只看获层盟约。
  const layers = layersAfterAcquisition(context.layers, gains);
  const projected = restProduction(field, reserve, {...context, layers});
  const covenants = new Set([
    ...gains.keys(),
    ...current.totals.keys(),
    ...projected.totals.keys(),
  ]);
  const reasons: string[] = [];
  let score = 0;
  for (const covenant of covenants) {
    const amount = gains.get(covenant) ?? 0;
    const end = projected.totals.get(covenant) ?? 0;
    const immediate = crossedLayerMilestones(covenant, amount, before, context);
    const production = crossedLayerMilestones(
      covenant,
      current.totals.get(covenant) ?? 0,
      current.stats,
      context,
    );
    const combined = crossedLayerMilestones(
      covenant,
      amount + end,
      current.stats,
      context,
    );
    // 若购买后盟约失效，不撤销已经实际触发的获得时门槛。
    const reached = new Set([...combined, ...immediate]);
    score +=
      (reached.size - immediate.length - production.length) *
      LAYER_MILESTONE_SCORE;
    for (const threshold of combined.filter(
      (value) => !immediate.includes(value) && !production.includes(value),
    )) {
      reasons.push(
        `${sourceLabel}${covenant}+${amount}层，加本次休整结束+${end}层，合计可跨过${threshold}层强化门槛`,
      );
    }
    if (immediate.some((value) => production.includes(value))) {
      reasons.push(`${covenant}同一强化门槛只计一次，不重复叠加触发与休整收益`);
    }
    for (const threshold of production.filter((value) => !reached.has(value))) {
      reasons.push(
        `${sourceLabel}层数改变休整产层目标，${covenant}本次不再达到${threshold}层门槛，已扣除原有收益`,
      );
    }
  }
  return {score, reasons};
}
/** 有限启发式整队生产力；装备、精锐投入只作换人机会成本，不等于战力。 */
export function teamValue(
  field: readonly PlanOp[],
  reserve: readonly PlanOp[],
  context: ValueContext,
): number {
  const {stats, values, totals} = restProduction(field, reserve, context);
  const milestoneValue = [...totals].reduce(
    (value, [covenant, amount]) =>
      value +
      crossedLayerMilestones(covenant, amount, stats, context).length *
        LAYER_MILESTONE_SCORE,
    0,
  );
  const retainedInvestment = field.reduce(
    (sum, slot) =>
      sum +
      (slot.elite ? ELITE_REPLACEMENT_COST : 0) +
      slot.eq.length * EQUIPMENT_REPLACEMENT_COST,
    0,
  );
  return (
    values.reduce((sum, value) => sum + value.score, 0) +
    milestoneValue +
    retainedInvestment +
    strategyValue(field, context, reserve)
  );
}
