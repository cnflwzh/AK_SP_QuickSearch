/** 将已解析的单干员效果换算为有限启发式价值，不修改实际对局状态。 */
import { OPERATOR,type Operator } from '../../../../data/index.ts';
import { type CovenantStat } from '../../plans/covenants.ts';
import { usesLayers,type PlanOp } from '../../plans/model.ts';
import {
crossedLayerMilestones,
layerValue,
productionHorizon,
} from './advisorLayerValue.ts';
import {
resolveAcquisitionEffects,
resolveBattleEffects,
resolveRestLayerEffects,
type RestLayerEffects,
} from './advisorTraitText.ts';
import type {
TraitValue,
ValueContext,
ValueRoster,
} from './advisorValueTypes.ts';
/** 获得时用初始或精锐特质二选一，合成不再叠加第三张初始特质。 */
export function acquisitionValue(
  operator: Operator,
  elite: boolean,
  stats: readonly CovenantStat[],
  context: ValueContext,
): TraitValue {
  const effects = resolveAcquisitionEffects(operator, elite, context.level);
  const investor = stats.find((stat) => stat.name === '投资人');
  const multiplier = investor?.active
    ? (context.layers['投资人'] ?? 0) >= 100
      ? 3
      : 2
    : 1;
  const gains = effects.gains.map((gain) => ({
    ...gain,
    amount: gain.amount * multiplier,
  }));
  const reasons: string[] = [];
  let score = 0;
  if (multiplier > 1 && effects.hasText) {
    reasons.push(`按购入前已激活投资人触发${multiplier}次，不预支新人激活收益`);
  }
  for (const { covenant, amount } of gains) {
    if (context.inactiveCovenants?.has(covenant)) {
      reasons.push(`${covenant}本局缺席，其获得时层数不计入收益`);
      continue;
    }
    const growthNote = effects.growsWithTriggers
      ? '起（成长次数未录入，按最低档）'
      : '';
    const activationNote = stats.some(
      (stat) => stat.name === covenant && stat.active,
    )
      ? ''
      : '（尚未激活）';
    score += layerValue(covenant, amount, stats, context);
    reasons.push(`获得时${covenant}+${amount}层${growthNote}${activationNote}`);
    for (const threshold of crossedLayerMilestones(
      covenant,
      amount,
      stats,
      context,
    )) {
      reasons.push(`按已录层数可跨过${covenant}${threshold}层强化门槛`);
    }
  }
  if (effects.freeRefreshes) {
    const count = effects.freeRefreshes * multiplier;
    const growthNote = effects.growsWithTriggers ? '起（未假定成长已满）' : '';
    score += count * 8;
    reasons.push(`获得${count}次免费刷新${growthNote}，不是返还现金`);
  }
  if (effects.equipmentReward) {
    const count = effects.equipmentReward.count * multiplier;
    score += 10 * count;
    reasons.push(
      `获得时提供${count}件${effects.equipmentReward.name}；未假定随机额外奖励或已装备`,
    );
  }
  return {
    score,
    reasons,
    acquisitionGains: gains.filter(
      (gain) => !context.inactiveCovenants?.has(gain.covenant),
    ),
  };
}
function restTriggerCount(effects: RestLayerEffects, horizon: number): number {
  if (effects.currentRoundOnly) {
    return 1;
  }
  if (effects.entersRest) {
    return Math.max(0, horizon - 1);
  }
  // 买入发生在当前休整期内，当前开始触发已过，只计本轮结束和以后开始。
  return horizon + (effects.startsAndEnds ? Math.max(0, horizon - 1) : 0);
}
function evaluateRestLayers(
  effects: RestLayerEffects,
  deployed: boolean,
  stats: readonly CovenantStat[],
  context: ValueContext,
): TraitValue {
  const horizon = productionHorizon(context);
  const triggers = restTriggerCount(effects, horizon);
  const reasons = [...effects.reasons];
  const gains = effects.gains.filter((gain) =>
    stats.some(
      (stat) =>
        stat.active && usesLayers(stat.name) && stat.name === gain.covenant,
    ),
  );
  let score = effects.unknownHighestTarget ? 5 * horizon : 0;
  if (effects.entersRest) {
    reasons.push(
      `当前进入休整的触发已过，仅评价未来${triggers}次进入休整；不计入本轮结束或苏苏洛指令`,
    );
  }
  const timing = effects.entersRest
    ? '进入时'
    : effects.startsAndEnds
      ? '开始/结束'
      : '结束';
  const frequency = effects.currentRoundOnly ? '本次' : '每次';
  const location = deployed ? '' : '（整备区生效）';
  for (const gain of gains) {
    score += layerValue(
      gain.covenant,
      gain.amount * triggers,
      stats,
      context,
      false,
    );
    if (effects.startsAndEnds) {
      reasons.push('本轮休整开始已过，不倒算买入前触发');
    }
    reasons.push(
      `${frequency}休整${timing}${gain.covenant}+${gain.amount}层${location}`,
    );
  }
  return { score, reasons, endOfRestGains: effects.entersRest ? [] : gains };
}
/** 临时层、战斗条件上限与属性转化独立估值，不写入确定休整产层。 */
function evaluateBattleEffects(
  text: string,
  slot: PlanOp,
  stats: readonly CovenantStat[],
  context: ValueContext,
  initialScore: number,
): TraitValue {
  const effects = resolveBattleEffects(text, slot);
  const active = stats.filter((stat) => stat.active && usesLayers(stat.name));
  const isActive = (covenant: string) =>
    active.some((stat) => stat.name === covenant);
  const reasons: string[] = [];
  let score = initialScore;
  for (const { covenant, amount } of effects.temporaryGains.filter((gain) =>
    isActive(gain.covenant),
  )) {
    score += layerValue(covenant, amount, stats, context, false);
    reasons.push(
      `下场战斗开始${covenant}临时+${amount}层；仅计一次战斗价值，不写入永久层数、不假定保存或实战伤害`,
    );
  }
  if (effects.conditionalCap) {
    const relevant = active.filter((stat) =>
      effects.conditionalCovenants.includes(stat.name),
    );
    if (relevant.length) {
      score +=
        Math.min(35, effects.conditionalCap * relevant.length * 0.65) *
        Math.min(productionHorizon(context), 2);
      reasons.push(
        `条件叠层支持${relevant.map((stat) => stat.name).join('、')}，单回合上限${effects.conditionalCap}层不等于实得`,
      );
    }
  }
  if (effects.convertsLayers) {
    const knownLayers = effects.conversionCovenants
      .filter(isActive)
      .reduce((sum, name) => sum + (context.layers[name] ?? 0), 0);
    const conversion = effects.attackConversion;
    if (
      conversion &&
      isActive(conversion.covenant) &&
      Object.hasOwn(context.layers, conversion.covenant)
    ) {
      const attackPercent =
        (context.layers[conversion.covenant] / conversion.layersPerTrigger) *
        conversion.attackPercent;
      // 沿用普通蓝毒原有估值尺度；精锐明示倍率不同，但属性比例不是伤害预测。
      score += Math.min(50, attackPercent * 0.3);
      reasons.push(
        `按已录${conversion.covenant}层数，按特质比例对应自身攻击力约+${Number(attackPercent.toFixed(2))}%；未核实取整，不计未来叠层或估算实战伤害`,
      );
    } else if (knownLayers) {
      score += Math.min(50, knownLayers * 0.15);
      reasons.push('已有层数可转化自身属性，未估算实战伤害');
    }
  }
  if (effects.savesUrsusLayers && isActive('乌萨斯')) {
    const futureRounds =
      context.totalRounds == null
        ? 0
        : context.round === null
          ? 1
          : Math.min(4, Math.max(0, context.totalRounds - context.round));
    score += 12 * futureRounds;
    reasons.push('可保存乌萨斯临时层数；未假定本轮可转化层数');
  }
  return { score, reasons };
}
/** 持续生产只给有限展望，战斗叠层按条件潜力折价，绝不显示为预计实得层数。 */
export function recurringValue(
  slot: PlanOp,
  deployed: boolean,
  stats: readonly CovenantStat[],
  context: ValueContext,
  roster?: ValueRoster,
): TraitValue {
  const operator = OPERATOR[slot.name];
  if (!operator) {
    return { score: 0, reasons: [] };
  }
  const text = slot.elite ? operator.elite : operator.trait;
  if (!deployed && !text.includes('整备区也生效')) {
    return { score: 0, reasons: [] };
  }
  const restEffects = resolveRestLayerEffects(
    text,
    slot,
    stats,
    context,
    roster,
  );
  const rest = evaluateRestLayers(restEffects, deployed, stats, context);
  const battle = evaluateBattleEffects(text, slot, stats, context, rest.score);
  return {
    score: Math.min(130, battle.score),
    reasons: [...rest.reasons, ...battle.reasons],
    endOfRestGains: rest.endOfRestGains,
  };
}
