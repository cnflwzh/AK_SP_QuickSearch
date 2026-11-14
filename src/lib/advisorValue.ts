/** 可解释的特质估值，不把条件上限、随机奖励或文本类型当成实际伤害。 */
import { EQUIPMENT, OPERATOR, type Operator } from '../../data/index.ts';
import { LAYER_BREAKPOINTS } from '../../data/numberTools.ts';
import { covenantStats, covenantsOf, type CovenantStat, type Layers, type PlanOp, usesLayers } from './planner.ts';

export interface ValueContext { round: number | null; layers: Layers; level: number; strategy: string; commandAvailable?: boolean | null; inactiveCovenants?: ReadonlySet<string> }
export interface ValueRoster { field: readonly PlanOp[]; reserve: readonly PlanOp[] }
export interface TraitValue {
  score: number;
  reasons: string[];
  /** 当前休整结束的确定性产层；不含未来回合、战斗上限或未知站位。 */
  endOfRestGains?: { covenant: string; amount: number }[];
}
const equipmentByNameLength = [...EQUIPMENT].sort((a, b) => b.name.length - a.name.length);
const tags = (text: string) => [...text.matchAll(/【([^】]+)】/g)].map(match => match[1]);
/** 只识别紧挨明确盟约列表的固定加层，不从条件次数/上限猜实际收益。 */
function fixedLayers(text: string): { covenant: string; amount: number }[] {
  return [...text.matchAll(/((?:【[^】]+】)+)层数\+(\d+)/g)]
    .flatMap(match => tags(match[1]).map(covenant => ({ covenant, amount: +match[2] })));
}
/** 复用层数工具的完整规则表，避免从展示文案只读到远见的第一档。 */
function crossedLayerMilestones(covenant: string, amount: number, stats: readonly CovenantStat[], context: ValueContext): number[] {
  if (!stats.some(stat => stat.name === covenant && stat.active) || !Object.hasOwn(context.layers, covenant)) return [];
  const current = context.layers[covenant];
  return (LAYER_BREAKPOINTS[covenant] ?? []).filter(item => current < item.layers && current + amount >= item.layers)
    .map(item => item.layers);
}
function layerValue(covenant: string, amount: number, stats: readonly CovenantStat[], context: ValueContext, includeMilestone = true): number {
  const stat = stats.find(stat => stat.name === covenant);
  if (!stat?.active) return .25 * amount; // 未激活的永久层只留少量未来价值，不视为当下战力。
  const milestones = includeMilestone ? crossedLayerMilestones(covenant, amount, stats, context).length : 0;
  return Math.min(amount, 24) * 2 + milestones * 24;
}

/** 获得时用初始或精锐特质二选一，合成不再叠加第三张初始特质。 */
export function acquisitionValue(operator: Operator, elite: boolean, stats: readonly CovenantStat[], context: ValueContext): TraitValue {
  const text = (elite ? operator.elite : operator.trait).match(/<获得时>([^<]*)/)?.[1] ?? '';
  const reasons: string[] = [];
  let score = 0;
  let gains = fixedLayers(text);
  if (/等同于当前调度中心等级(?:两倍)?的【炎】层数/.test(text)) gains = [{ covenant: '炎', amount: context.level * (elite ? 2 : 1) }];
  const investor = stats.find(stat => stat.name === '投资人');
  const multiplier = investor?.active ? ((context.layers['投资人'] ?? 0) >= 100 ? 3 : 2) : 1;
  gains = gains.map(gain => ({ ...gain, amount: gain.amount * multiplier }));
  if (multiplier > 1 && text) reasons.push(`按购入前已激活投资人触发${multiplier}次，不预支新人激活收益`);
  const scaling = /触发后升级|触发\d+次后升级/.test(text);
  for (const { covenant, amount } of gains) {
    if (context.inactiveCovenants?.has(covenant)) {
      reasons.push(`${covenant}本局缺席，其获得时层数不计入收益`);
      continue;
    }
    score += layerValue(covenant, amount, stats, context);
    reasons.push(`获得时${covenant}+${amount}层${scaling ? '起（成长次数未录入，按最低档）' : ''}${stats.find(s => s.name === covenant)?.active ? '' : '（尚未激活）'}`);
    for (const threshold of crossedLayerMilestones(covenant, amount, stats, context))
      reasons.push(`按已录层数可跨过${covenant}${threshold}层强化门槛`);
  }
  if (/获得(?:一|1|两|2)次免费刷新/.test(text)) {
    const count = /获得(?:两|2)次/.test(text) ? 2 : 1;
    score += count * 8 * multiplier;
    reasons.push(`获得${count * multiplier}次免费刷新${scaling ? '起（未假定成长已满）' : ''}，不是返还现金`);
  }
  const guaranteed = text.split(/[，；]/)[0];
  const item = equipmentByNameLength.find(item => guaranteed.includes(item.name));
  if (item || /获得[一两]枚“盟约之币”/.test(guaranteed)) {
    const count = /获得(?:两|2)[件个枚]/.test(guaranteed) ? 2 : 1;
    score += 10 * multiplier * count;
    const rewardName = guaranteed.match(/获得[一两12][件个枚][“"]?([^”"]+)/)?.[1] ?? item?.name ?? '盟约之币';
    reasons.push(`获得时提供${count * multiplier}件${rewardName}；未假定随机额外奖励或已装备`);
  }
  return { score, reasons };
}

/** 未知回合采用有限展望；最后一轮只计当前休整结束。 */
function productionHorizon(round: number | null): number {
  return round === null ? 2 : Math.min(4, Math.max(1, 15 - round));
}

/** 助力是盟约自身的产层，不是任一干员特质，整队只结算一次。 */
export function covenantProductionValue(stats: readonly CovenantStat[], context: ValueContext): TraitValue {
  const support = stats.find(stat => stat.name === '助力');
  if (!support?.active) return { score: 0, reasons: [], endOfRestGains: [] };
  const amount = support.bonusActive ? 4 : 2;
  const gains = stats.filter(stat => stat.active && usesLayers(stat.name)).map(stat => ({ covenant: stat.name, amount }));
  const score = gains.reduce((total, gain) => total + layerValue(gain.covenant,
    gain.amount * productionHorizon(context.round), stats, context, false), 0);
  return { score, endOfRestGains: gains,
    reasons: [`助力每次休整结束为所有已激活盟约各+${amount}层；按当前${gains.length}种可叠层盟约计算`] };
}

/** 持续生产只给有限展望，战斗叠层按条件潜力折价，绝不显示为预计实得层数。 */
export function recurringValue(slot: PlanOp, deployed: boolean, stats: readonly CovenantStat[], context: ValueContext, roster?: ValueRoster): TraitValue {
  const operator = OPERATOR[slot.name];
  if (!operator) return { score: 0, reasons: [] };
  const text = slot.elite ? operator.elite : operator.trait;
  if (!deployed && !text.includes('整备区也生效')) return { score: 0, reasons: [] };
  // 只评价有限未来窗口；未知回合不假装早期，最后一轮不再奖励后续回合收入。
  const horizon = productionHorizon(context.round);
  let score = 0;
  const reasons: string[] = [];
  const withoutAcquire = text.replace(/<获得时>[^<]*/g, '');
  const restText = withoutAcquire.replace(/^<休整期开始时>(?=<休整期结束时>)/, '');
  const active = stats.filter(stat => stat.active && usesLayers(stat.name));
  const direct = restText.match(/^<休整期结束时>使已激活的((?:【[^】]+】)+)层数\+(\d+)(?:$|（)/);
  let gains = direct ? tags(direct[1]).map(covenant => ({ covenant, amount: +direct[2] })) : [];
  if (/^<休整期结束时>使已激活的核心盟约层数\+/.test(restText)) {
    const amount = +(withoutAcquire.match(/层数\+(\d+)/)?.[1] ?? 0);
    gains = active.filter(stat => stat.core).map(stat => ({ covenant: stat.name, amount }));
  }
  if (/^<休整期结束时>使当前已激活且层数最多的盟约层数\+/.test(restText) && active.length) {
    const known = active.filter(stat => Object.hasOwn(context.layers, stat.name));
    const selected = [...known].sort((a, b) => context.layers[b.name] - context.layers[a.name])[0];
    if (selected && known.length === active.length) gains = [{ covenant: selected.name, amount: +(withoutAcquire.match(/层数\+(\d+)/)?.[1] ?? 0) }];
    else { score += 5 * horizon; reasons.push('可为最高层激活盟约叠层；层数未完整录入，不假定目标'); }
  }
  // 身前目标尚未录入，但自身部分是确定收益，不能整条特质漏算。
  const selfAndFront = restText.match(/^<休整期结束时>使自身(?:及|以及)身前一格干员已激活的盟约层数\+(\d+)/);
  if (selfAndFront) {
    const covenants = covenantsOf(slot);
    gains = [...new Set([...covenants.own, ...covenants.granted])]
      .map(covenant => ({ covenant, amount: +selfAndFront[1] }));
    reasons.push('仅计自身已激活盟约；身前一格未录入，未假定相邻干员收益');
  }
  if (roster) {
    const reserveCovenants = restText.match(/^<休整期结束时>使整备区每名干员已激活的盟约层数\+(\d+)/);
    if (reserveCovenants) {
      const amounts = new Map<string, number>();
      for (const member of roster.reserve) {
        const covenants = covenantsOf(member);
        for (const covenant of new Set([...covenants.own, ...covenants.granted])) {
          amounts.set(covenant, (amounts.get(covenant) ?? 0) + +reserveCovenants[1]);
        }
      }
      gains = [...amounts].map(([covenant, amount]) => ({ covenant, amount }));
      reasons.push('按已记录整备区干员各自盟约计层；未记录的同名副本不推算');
    }
    const equipped = restText.match(/^<休整期结束时>场上每有一名携带装备的干员，使已激活的((?:【[^】]+】)+)层数\+(\d+)/);
    const tiers = restText.match(/^<休整期结束时>场上每有一名不同阶的【([^】]+)】干员，使已激活的((?:【[^】]+】)+)层数\+(\d+)/);
    const benched = restText.match(/^<休整期结束时>整备区每有一名干员，使已激活的((?:【[^】]+】)+)层数\+(\d+)/);
    if (equipped) {
      const count = roster.field.filter(member => member.eq.length > 0).length;
      gains = tags(equipped[1]).map(covenant => ({ covenant, amount: +equipped[2] * count }));
      reasons.push(`按场上${count}名装备携带者计算，不按装备件数重复计人`);
    } else if (tiers) {
      const count = new Set(roster.field.filter(member => [...covenantsOf(member).own, ...covenantsOf(member).granted].includes(tiers[1])).map(member => OPERATOR[member.name]?.tier)).size;
      gains = tags(tiers[2]).map(covenant => ({ covenant, amount: +tiers[3] * count }));
      reasons.push(`按场上${tiers[1]}的${count}种等阶计算`);
    } else if (benched) {
      gains = tags(benched[1]).map(covenant => ({ covenant, amount: +benched[2] * roster.reserve.length }));
      reasons.push(`按整备区${roster.reserve.length}名已记录干员计算`);
    }
  }
  const startsAndEnds = text.startsWith('<休整期开始时><休整期结束时>');
  // 买入发生在当前休整期内，当前开始触发已过，只计本轮结束和以后开始。
  const triggers = horizon + (startsAndEnds ? Math.max(0, horizon - 1) : 0);
  for (const gain of gains) {
    if (!active.some(stat => stat.name === gain.covenant)) continue;
    score += layerValue(gain.covenant, gain.amount * triggers, stats, context, false);
    if (startsAndEnds) reasons.push('本轮休整开始已过，不倒算买入前触发');
    reasons.push(`每次休整${startsAndEnds ? '开始/结束' : '结束'}${gain.covenant}+${gain.amount}层${deployed ? '' : '（整备区生效）'}`);
  }
  const cap = +(withoutAcquire.match(/每(?:回合|场战斗)至多(?:叠加)?(\d+)层/)?.[1] ?? 0);
  if (cap && withoutAcquire.includes('<战斗中>')) {
    const affected = withoutAcquire.includes('自身已激活') ? [...covenantsOf(slot).own, ...covenantsOf(slot).granted] : tags(withoutAcquire);
    const relevant = active.filter(stat => affected.includes(stat.name));
    if (relevant.length) {
      score += Math.min(35, cap * relevant.length * .65) * Math.min(horizon, 2);
      reasons.push(`条件叠层支持${relevant.map(s => s.name).join('、')}，单回合上限${cap}层不等于实得`);
    }
  }
  // 已知层数才能评价“叠层转自身属性”；没有战斗模型，不输出DPS。
  if (withoutAcquire.includes('每叠加') && /本干员|自身/.test(restText)) {
    const knownLayers = [...new Set(tags(withoutAcquire))].filter(name => active.some(stat => stat.name === name)).reduce((sum, name) => sum + (context.layers[name] ?? 0), 0);
    if (knownLayers) { score += Math.min(50, knownLayers * .15); reasons.push('已有层数可转化自身属性，未估算实战伤害'); }
  }
  if (withoutAcquire.includes('临时层数为固定层数') && active.some(stat => stat.name === '乌萨斯')) {
    score += 12 * (context.round === null ? 1 : Math.min(4, Math.max(0, 14 - context.round)));
    reasons.push('可保存乌萨斯临时层数；未假定本轮可转化层数');
  }
  return { score: Math.min(130, score), reasons,
    endOfRestGains: gains.filter(gain => active.some(stat => stat.name === gain.covenant)) };

}

/** 苏苏洛的可执行目标：只估一次确定的休整结束特质，不预支未来回合或已用指令。 */
export function restCommandOpportunity(ops: readonly PlanOp[], reserve: readonly PlanOp[], context: ValueContext): TraitValue & { target?: string } {
  if (context.strategy !== '苏苏洛' || context.commandAvailable === false) return { score: 0, reasons: [] };
  const stats = covenantStats(ops, context.layers, reserve, context.inactiveCovenants);
  const candidates = ops.map(slot => {
    const gains = recurringValue(slot, true, stats, context, { field: ops, reserve }).endOfRestGains ?? [];
    // 使用同样的保守机会权重；仅一次固定产层，不把持续属性或战斗上限当作复制收益。
    const score = gains.reduce((total, gain) => total + layerValue(gain.covenant, gain.amount, stats, context, false), 0) * .35;
    return { target: slot.name, score, reasons: score > 0
      ? [`${context.commandAvailable === true ? '已记录本次苏苏洛指令可用' : '若本轮苏苏洛指令可用'}，可选${slot.name}额外触发一次：${gains.map(gain => `${gain.covenant}+${gain.amount}层`).join('、')}${context.commandAvailable === true ? '；未自动消耗指令' : '；未假定指令尚未使用'}`]
      : [] };
  });
  return candidates.sort((a, b) => b.score - a.score)[0] ?? { score: 0, reasons: [] };
}

/** 按整队状态计算策略档位，换下干员同样会失去收益。整备区经济盟约不能给阿米娅凑场上档位。 */
export function strategyValue(ops: readonly PlanOp[], context: ValueContext, reserve: readonly PlanOp[] = []): number {
  const stats = covenantStats(ops, context.layers, [], context.inactiveCovenants), elites = ops.filter(slot => slot.elite).length;
  if (context.strategy === '阿米娅') return Math.max(0, Math.min(5, stats.filter(stat => stat.active).length) - 2) * 25;
  if (context.strategy === 'Touch') return elites >= 2 ? 45 : 0;
  if (context.strategy === '伊奥莱塔·罗素') return elites * elites * 3;
  if (context.strategy === '陈') return elites * 12;
  if (context.strategy === '华法琳') return new Set(ops.filter(slot => covenantsOf(slot).own.some(name => stats.some(stat => stat.name === name && stat.active))).map(slot => OPERATOR[slot.name]?.tier)).size * 7;
  if (context.strategy === '苏苏洛') return restCommandOpportunity(ops, reserve, context).score;
  if (context.strategy === '铃兰') {
    // 投资人整备区也计人数；指令触发获得特质时沿用已激活的完整阵容状态。
    // 不能复用上面的场上统计，否则会漏掉整备区提供的重复触发。
    if (context.commandAvailable === false) return 0;
    const acquisitionStats = covenantStats(ops, context.layers, reserve, context.inactiveCovenants);
    return Math.max(0, ...ops.map(slot => acquisitionValue(OPERATOR[slot.name], slot.elite, acquisitionStats, context).score * .6));
  }
  return 0;
}

/** 有限启发式整队生产力；装备/精锐投入作为换人机会成本，不当作精确战力。 */
export function teamValue(ops: readonly PlanOp[], reserve: readonly PlanOp[], context: ValueContext): number {
  const stats = covenantStats(ops, context.layers, reserve, context.inactiveCovenants);
  const values = [covenantProductionValue(stats, context), ...ops.map(slot => recurringValue(slot, true, stats, context, { field: ops, reserve })),
    ...reserve.map(slot => recurringValue(slot, false, stats, context, { field: ops, reserve }))];
  // 多位生产者先汇总本次确定产层，再判断门槛；避免各自重复奖励或合计可达却漏算。
  const totals = new Map<string, number>();
  for (const value of values) for (const gain of value.endOfRestGains ?? []) {
    totals.set(gain.covenant, (totals.get(gain.covenant) ?? 0) + gain.amount);
  }
  const milestoneValue = [...totals].reduce((value, [covenant, amount]) =>
    value + crossedLayerMilestones(covenant, amount, stats, context).length * 24, 0);
  return values.reduce((sum, value) => sum + value.score, 0) + milestoneValue
    + ops.reduce((sum, slot) => sum + (slot.elite ? 35 : 0) + slot.eq.length * 12, 0)
    + strategyValue(ops, context, reserve);
}
