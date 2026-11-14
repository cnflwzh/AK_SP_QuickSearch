/** 可解释的特质估值，不把条件上限、随机奖励或文本类型当成实际伤害。 */
import { EQUIPMENT, OPERATOR, type Operator } from '../../data/index.ts';
import { covenantStats, covenantsOf, type CovenantStat, type Layers, type PlanOp } from './planner.ts';

export interface ValueContext { round: number | null; layers: Layers; level: number; strategy: string }
export interface TraitValue { score: number; reasons: string[] }
const tags = (text: string) => [...text.matchAll(/【([^】]+)】/g)].map(match => match[1]);
/** 只识别紧挨明确盟约列表的固定加层，不从条件次数/上限猜实际收益。 */
function fixedLayers(text: string): { covenant: string; amount: number }[] {
  return [...text.matchAll(/((?:【[^】]+】)+)层数\+(\d+)/g)]
    .flatMap(match => tags(match[1]).map(covenant => ({ covenant, amount: +match[2] })));
}
function layerValue(covenant: string, amount: number, stats: readonly CovenantStat[], context: ValueContext): number {
  const stat = stats.find(stat => stat.name === covenant);
  if (!stat?.active) return .25 * amount; // 未激活的永久层只留少量未来价值，不视为当下战力。
  let value = Math.min(amount, 24) * 2;
  const milestone = stat.bonusLayers;
  if (milestone && Object.hasOwn(context.layers, covenant)
    && context.layers[covenant] < milestone && context.layers[covenant] + amount >= milestone) value += 24;
  return value;
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
    score += layerValue(covenant, amount, stats, context);
    reasons.push(`获得时${covenant}+${amount}层${scaling ? '起（成长次数未录入，按最低档）' : ''}${stats.find(s => s.name === covenant)?.active ? '' : '（尚未激活）'}`);
    const threshold = stats.find(s => s.name === covenant)?.bonusLayers;
    if (threshold && Object.hasOwn(context.layers, covenant) && context.layers[covenant] < threshold && context.layers[covenant] + amount >= threshold)
      reasons.push(`按已录层数可跨过${covenant}${threshold}层强化门槛`);
  }
  if (/获得(?:一|1|两|2)次免费刷新/.test(text)) {
    const count = /获得(?:两|2)次/.test(text) ? 2 : 1;
    score += count * 8 * multiplier;
    reasons.push(`获得${count * multiplier}次免费刷新${scaling ? '起（未假定成长已满）' : ''}，不是返还现金`);
  }
  const item = EQUIPMENT.find(item => text.includes(item.name));
  if (item || /获得[一两]枚“盟约之币”/.test(text)) {
    score += 10 * multiplier * (text.includes('两枚') ? 2 : 1);
    reasons.push(`获得时提供${item?.name ?? '盟约之币'}；未假定随机额外奖励`);
  }
  return { score, reasons };
}

/** 持续生产只给有限展望，战斗叠层按条件潜力折价，绝不显示为预计实得层数。 */
export function recurringValue(slot: PlanOp, deployed: boolean, stats: readonly CovenantStat[], context: ValueContext): TraitValue {
  const operator = OPERATOR[slot.name];
  if (!operator) return { score: 0, reasons: [] };
  const text = slot.elite ? operator.elite : operator.trait;
  if (!deployed && !text.includes('整备区也生效')) return { score: 0, reasons: [] };
  // 只评价有限未来窗口；未知回合不假装早期，最后一轮不再奖励后续回合收入。
  const horizon = context.round === null ? 2 : Math.min(4, Math.max(1, 15 - context.round));
  let score = 0;
  const reasons: string[] = [];
  const withoutAcquire = text.replace(/<获得时>[^<]*/g, '');
  const active = stats.filter(stat => stat.active);
  const direct = withoutAcquire.match(/^<休整期结束时>使已激活的((?:【[^】]+】)+)层数\+(\d+)(?:$|（)/);
  let gains = direct ? tags(direct[1]).map(covenant => ({ covenant, amount: +direct[2] })) : [];
  if (/^<休整期结束时>使已激活的核心盟约层数\+/.test(withoutAcquire)) {
    const amount = +(withoutAcquire.match(/层数\+(\d+)/)?.[1] ?? 0);
    gains = active.filter(stat => stat.core).map(stat => ({ covenant: stat.name, amount }));
  }
  if (/^<休整期结束时>使当前已激活且层数最多的盟约层数\+/.test(withoutAcquire) && active.length) {
    const known = active.filter(stat => Object.hasOwn(context.layers, stat.name));
    const selected = [...known].sort((a, b) => context.layers[b.name] - context.layers[a.name])[0];
    if (selected && known.length === active.length) gains = [{ covenant: selected.name, amount: +(withoutAcquire.match(/层数\+(\d+)/)?.[1] ?? 0) }];
    else { score += 5 * horizon; reasons.push('可为最高层激活盟约叠层；层数未完整录入，不假定目标'); }
  }
  for (const gain of gains) {
    if (!active.some(stat => stat.name === gain.covenant)) continue;
    score += layerValue(gain.covenant, gain.amount * horizon, stats, context);
    reasons.push(`每次休整结束${gain.covenant}+${gain.amount}层${deployed ? '' : '（整备区生效）'}`);
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
  if (withoutAcquire.includes('每叠加') && /本干员|自身/.test(withoutAcquire)) {
    const knownLayers = [...new Set(tags(withoutAcquire))].filter(name => active.some(stat => stat.name === name)).reduce((sum, name) => sum + (context.layers[name] ?? 0), 0);
    if (knownLayers) { score += Math.min(50, knownLayers * .15); reasons.push('已有层数可转化自身属性，未估算实战伤害'); }
  }
  if (withoutAcquire.includes('临时层数为固定层数') && active.some(stat => stat.name === '乌萨斯')) {
    score += 12 * (context.round === null ? 1 : Math.min(4, Math.max(0, 14 - context.round)));
    reasons.push('可保存乌萨斯临时层数；未假定本轮可转化层数');
  }
  return { score: Math.min(130, score), reasons };
}

/** 按整队状态计算策略档位，换下干员同样会失去收益。整备区经济盟约不能给阿米娅凑场上档位。 */
export function strategyValue(ops: readonly PlanOp[], context: ValueContext): number {
  const stats = covenantStats(ops, context.layers), elites = ops.filter(slot => slot.elite).length;
  if (context.strategy === '阿米娅') return Math.max(0, Math.min(5, stats.filter(stat => stat.active).length) - 2) * 25;
  if (context.strategy === 'Touch') return elites >= 2 ? 45 : 0;
  if (context.strategy === '伊奥莱塔·罗素') return elites * elites * 3;
  if (context.strategy === '陈') return elites * 12;
  if (context.strategy === '华法琳') return new Set(ops.filter(slot => covenantsOf(slot).own.some(name => stats.some(stat => stat.name === name && stat.active))).map(slot => OPERATOR[slot.name]?.tier)).size * 7;
  if (context.strategy === '铃兰' || context.strategy === '苏苏洛') {
    return Math.max(0, ...ops.map(slot => context.strategy === '铃兰'
      ? acquisitionValue(OPERATOR[slot.name], slot.elite, stats, context).score * .6
      : ((slot.elite ? OPERATOR[slot.name]?.elite : OPERATOR[slot.name]?.trait)?.includes('<休整期结束时>') ? recurringValue(slot, true, stats, context).score * .35 : 0)));
  }
  return 0;
}

/** 有限启发式整队生产力；装备/精锐投入作为换人机会成本，不当作精确战力。 */
export function teamValue(ops: readonly PlanOp[], reserve: readonly PlanOp[], context: ValueContext): number {
  const stats = covenantStats(ops, context.layers, reserve);
  return ops.reduce((sum, slot) => sum + recurringValue(slot, true, stats, context).score + (slot.elite ? 35 : 0) + slot.eq.length * 12, 0)
    + reserve.reduce((sum, slot) => sum + recurringValue(slot, false, stats, context).score, 0) + strategyValue(ops, context);
}
