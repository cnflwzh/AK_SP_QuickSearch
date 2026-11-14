/** 局内抓取：只计算已录入的阵容变化，不依赖页面状态，也不修改现有流派存档。 */
import { ALL_COVENANTS, BUILD_NAMES, buildByName, OPERATORS, EQUIPMENT, STRATEGIES, isCoreCovenant, operatorPrice, type Operator } from '../../data/index.ts';
import { covenantStats, createLineupEvaluator, defaultLineupGoal, inferPrimaryCovenant, isBanned, MAX_EQ, MAX_OPS, usesLayers, MAX_LAYERS, type Layers, type CovenantStat, type LineupEvaluation, type LineupGoal, type PlanOp } from './planner.ts';

import { acquisitionValue, recurringValue, teamValue, type ValueContext } from './advisorValue.ts';

/** 同名干员合并记录；copies 是尚未合成的张数，精锐只保留一条记录。 */
export interface RecordedOperator {
  name: string;
  copies: number;
  elite: boolean;
  deployed: boolean;
}
/** 一条记录对应一个装备栏位；holder 为空表示仓库，进阶装备仍只占一格。 */
export interface OwnedEquipment { id: string; name: string; holder: string; advanced: boolean }
/** 独立保存的一局；商店名单只表示眼前候选，不代表已经持有。 */
export interface AdvisorRun {
  level: number;
  round: number | null;
  funds: number | null;
  layers: Layers;
  strategy: string;
  /** 空字符串自动判断；mixed 明确选择混搭，不锁定核心盟约。 */
  mainCovenant: string;
  /** 0 使用预设构筑目标；3/6 为玩家手动指定。 */
  mainTarget: 0 | 3 | 6;
  bannedCovenants: string[];
  /** 禁用干员，或本局没有选入招募池的可选干员。 */
  excludedOperators: string[];
  operators: RecordedOperator[];
  equipment: OwnedEquipment[];
  shop: string[];
}
export interface RecruitAdvice {
  operator: Operator;
  kind: 'elite' | 'pair' | 'deploy' | 'replace' | 'reserve' | 'skip';
  label: string;
  /** 排序使用的相对收益，不是胜率或伤害预测。 */
  score: number;
  /** 仅当主要收益相同时，才比较策略和装备搭配。 */
  fitScore: number;
  reasons: string[];
  losses: string[];
  replace: string;
}

export const operatorsByName = new Map(OPERATORS.map(operator => [operator.name, operator]));
const equipmentByName = new Map(EQUIPMENT.map(equipment => [equipment.name, equipment]));
const strategiesByName = new Map(STRATEGIES.map(strategy => [strategy.name, strategy]));
const operatorOrder = new Map(OPERATORS.map((operator, index) => [operator.name, index]));
const equipmentPairings = BUILD_NAMES.flatMap(name => {
  const build = buildByName(name);
  return build ? (build.carries ?? []).map(operator => ({ operator, build: name, equipment: build.equipment })) : [];
});
/** 只约束输入规模，避免损坏的存档生成过量 DOM；不是游戏内的仓库上限。 */
export const MAX_RECORDED_EQUIPMENT = 64;
export const MAX_SHOP_CANDIDATES = 8;

/** 返回一局空记录，默认从 1 本开始；每次调用得到独立数组。 */
export function newAdvisorRun(): AdvisorRun {
  return { level: 1, round: null, funds: null, layers: {}, strategy: '', mainCovenant: '', mainTarget: 0, bannedCovenants: [], excludedOperators: [], operators: [], equipment: [], shop: [] };
}
/** 星极两张晋升，其余干员三张；输入为数据表中的干员名称。 */
export function eliteCopyCount(name: string): number { return name === '星极' ? 2 : 3; }

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function integer(value: unknown, fallback: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(1, Math.min(max, Math.round(value))) : fallback;
}

/** 校验外部存档并复制为有效记录；无效名称被丢弃，超出部署/装备栏位的内容移回仓库。 */
export function sanitizeAdvisorRun(value: unknown): AdvisorRun {
  const source = record(value), result = newAdvisorRun();
  result.level = integer(source.level, 1, 6);
  result.round = typeof source.round === 'number' && Number.isFinite(source.round) ? integer(source.round, 1, 14) : null;
  result.funds = typeof source.funds === 'number' && Number.isFinite(source.funds) ? Math.max(0, Math.min(999, Math.round(source.funds))) : null;
  result.layers = Object.fromEntries(Object.entries(record(source.layers)).filter(([name, n]) => ALL_COVENANTS.includes(name) && usesLayers(name) && typeof n === 'number' && Number.isFinite(n)).map(([name, n]) => [name, Math.max(0, Math.min(MAX_LAYERS, Math.round(n as number)))]));
  result.strategy = typeof source.strategy === 'string' && strategiesByName.has(source.strategy) ? source.strategy : '';
  result.bannedCovenants = validNames(source.bannedCovenants, name => ALL_COVENANTS.includes(name));
  result.excludedOperators = validNames(source.excludedOperators, name => operatorsByName.has(name));
  result.mainCovenant = typeof source.mainCovenant === 'string' && (isCoreCovenant(source.mainCovenant) || source.mainCovenant === 'mixed')
    && !result.bannedCovenants.includes(source.mainCovenant) ? source.mainCovenant : '';
  result.mainTarget = source.mainTarget === 3 || source.mainTarget === 6 ? source.mainTarget : 0;
  const names = new Set<string>();
  let deployed = 0;
  for (const item of Array.isArray(source.operators) ? source.operators.slice(0, OPERATORS.length) : []) {
    const entry = record(item), name = String(entry.name ?? '');
    if (!operatorsByName.has(name) || names.has(name)) continue;
    names.add(name);
    const onField = entry.deployed === true && deployed < MAX_OPS;
    if (onField) deployed++;
    const elite = entry.elite === true;
    result.operators.push({ name, elite, deployed: onField, copies: elite ? 1 : integer(entry.copies, 1, eliteCopyCount(name) - 1) });
  }
  const held = new Map<string, Set<string>>();
  const ids = new Set<string>();
  for (const [index, item] of (Array.isArray(source.equipment) ? source.equipment.slice(0, MAX_RECORDED_EQUIPMENT) : []).entries()) {
    const entry = record(item), name = String(entry.name ?? '');
    if (!equipmentByName.has(name)) continue;
    let id = typeof entry.id === 'string' ? entry.id.slice(0, 100) : '';
    if (!id || ids.has(id)) id = `saved-${index}`;
    while (ids.has(id)) id += '-';
    ids.add(id);
    let holder = typeof entry.holder === 'string' && names.has(entry.holder) ? entry.holder : '';
    const items = held.get(holder) ?? new Set<string>();
    if (holder && (items.size >= MAX_EQ || items.has(name))) holder = '';
    if (holder) { items.add(name); held.set(holder, items); }
    result.equipment.push({ id, name, holder, advanced: entry.advanced === true && !!equipmentByName.get(name)?.advanced });
  }
  result.shop = [...new Set((Array.isArray(source.shop) ? source.shop : []).filter(
    (name): name is string => typeof name === 'string' && operatorsByName.has(name),
  ))].slice(0, MAX_SHOP_CANDIDATES);
  return result;
}

function validNames(value: unknown, valid: (name: string) => boolean): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((name): name is string => typeof name === 'string' && valid(name)))] : [];
}

/** 招募池过滤规则；盟约缺席会排除所有带该原生盟约的干员，装备不改变招募资格。 */
export function createRecruitmentPool(run: Pick<AdvisorRun, 'bannedCovenants' | 'excludedOperators'>): (name: string) => boolean {
  const bans = new Set(run.bannedCovenants), excluded = new Set(run.excludedOperators);
  return name => operatorsByName.has(name) && !excluded.has(name) && !isBanned(name, bans);
}

/** 显式选择优先，其次场上投入、专属策略、整备区；证据相同则保持未定方向。 */
export function runLineupGoal(run: AdvisorRun): LineupGoal | null {
  if (run.mainCovenant === 'mixed') return null;
  const available = createRecruitmentPool(run);
  const field = deployedLineup(run).filter(slot => available(slot.name));
  const strategy = strategiesByName.get(run.strategy);
  const strategyCovenant = strategy && isCoreCovenant(strategy.category) && !run.bannedCovenants.includes(strategy.category) ? strategy.category : '';
  const covenant = run.mainCovenant || inferPrimaryCovenant(field) || strategyCovenant
    || inferPrimaryCovenant(reserveLineup(run).filter(slot => available(slot.name)));
  return covenant ? { ...defaultLineupGoal(covenant), ...(run.mainTarget ? { target: run.mainTarget } : {}) } : null;
}

function planSlot(run: AdvisorRun, operator: RecordedOperator): PlanOp {
  return { name: operator.name, elite: operator.elite, core: false, alt: [],
    eq: run.equipment.filter(item => item.holder === operator.name).map(item => item.name) };
}
/** 转成共用盟约统计的上场输入；整备区由 reserveLineup 单独传入。 */
export function deployedLineup(run: AdvisorRun): PlanOp[] {
  return run.operators.filter(operator => operator.deployed).map(operator => planSlot(run, operator));
}
/** 整备区携带的装备仍保留，用于远见、奇迹、投资人的人数统计。 */
export function reserveLineup(run: AdvisorRun): PlanOp[] {
  return run.operators.filter(operator => !operator.deployed).map(operator => planSlot(run, operator));
}

/** 仅负责局内页面的文案；盟约评分和变化判断来自共用评估器。 */
function explainLineupChange(evaluation: LineupEvaluation): { reasons: string[]; losses: string[] } {
  const reasons: string[] = [], losses: string[] = [];
  for (const { covenant, kind, before, after } of evaluation.changes) {
    if (kind === 'off') losses.push(`${covenant}失效`);
    else if (kind === 'weaken') losses.push(`${covenant}失去强化`);
    else if (after) {
      if (kind === 'on') reasons.push(`激活${covenant}（${after.count}人）`);
      if (kind === 'bonus' || kind === 'on' && after.bonusActive) {
        reasons.push(`${covenant}达到${after.bonusNeed ? `${after.bonusNeed}人` : `${after.bonusLayers}层`}强化`);
      }
      if (kind === 'up') reasons.push(`${covenant} ${before?.count ?? 0}→${after.count}，距${after.active ? '人数强化' : '激活'}差${after.next}人`);
    }
  }
  return { reasons, losses };
}

/** 策略只读取已建模的明确规则；通用经济、随机刷新等效果不虚构成干员强度。 */
function strategyAffinity(run: AdvisorRun, operator: Operator, before: readonly CovenantStat[], after: readonly CovenantStat[], elite: boolean): { score: number; reason: string } {
  const strategy = strategiesByName.get(run.strategy);
  if (!strategy) return { score: 0, reason: '' };
  if (ALL_COVENANTS.includes(strategy.category) && operator.covenants.includes(strategy.category)) {
    return { score: 8, reason: `符合${strategy.name}的${strategy.category}方向` };
  }
  if (elite && strategy.category === '精锐') {
    return { score: 8, reason: `晋升精锐，契合${strategy.name}的精锐方向` };
  }
  return { score: 0, reason: '' };
}

function equipmentAffinity(run: AdvisorRun, operator: Operator): { score: number; reason: string } {
  // covenant 字段只描述变形同构体的组合结果，不是适配加成。此处只用预设里的核心装备搭配。
  // 已被其他干员占用的装备不同时分配给新人。
  const available = run.equipment.filter(item => !item.holder || item.holder === operator.name);
  for (const pairing of equipmentPairings) {
    if (pairing.operator !== operator.name) continue;
    const matching = available.find(item => pairing.equipment.includes(item.name));
    if (matching) return { score: 5, reason: `${matching.holder ? '已携带' : '仓库有'}${matching.name}，属于${pairing.build}预设的核心搭配` };
  }
  return { score: 0, reason: '' };
}

/**
 * 返回最多 limit 条建议。商店不为空时只比较实物候选，否则按当前本数找目标。
 * 用纯函数评估添加/晋升/逐一替换；所有动作仍由用户确认，函数没有写入副作用。
 */
export function recommendRecruits(run: AdvisorRun, limit = 5): RecruitAdvice[] {
  const available = createRecruitmentPool(run), goal = runLineupGoal(run);
  // 禁用设置和持有记录矛盾时先让玩家修正，不能假定这些位置已经空出。
  if (run.operators.some(operator => !available(operator.name))) return [];
  const lineup = deployedLineup(run).filter(slot => available(slot.name));
  const reserve = reserveLineup(run).filter(slot => available(slot.name));
  const before = covenantStats(lineup, run.layers, reserve);
  const evaluate = createLineupEvaluator(lineup, run.layers, { goal, reserve, bannedCovenants: new Set(run.bannedCovenants) });
  const context: ValueContext = { round: run.round, layers: run.layers, level: run.level, strategy: run.strategy };
  const oldValue = teamValue(lineup, reserve, context);
  const marginal = (field: PlanOp[], bench: PlanOp[]) => teamValue(field, bench, context) - oldValue;
  const build = goal ? buildByName(goal.covenant) : undefined;
  const owned = new Map(run.operators.map(operator => [operator.name, operator]));
  const candidates = (run.shop.length
    ? run.shop.map(name => operatorsByName.get(name)).filter((operator): operator is Operator => !!operator)
    // Pith 指令赠送的辅助干员不在普通商店池，仍可在持有记录中手动录入。
    : OPERATORS.filter(operator => operator.stars > 0 && operator.tier <= run.level && !owned.get(operator.name)?.elite))
    .filter(operator => available(operator.name));
  const ranked = candidates.map(operator => {
    const existing = owned.get(operator.name);
    const advice: RecruitAdvice = { operator, kind: 'reserve', label: '备选', score: 0, fitScore: 0, reasons: [], losses: [], replace: '' };
    if (existing?.elite) return { ...advice, kind: 'skip' as const, label: '暂不追', score: -1000, reasons: ['已有精锐，本工具不再追同名合成'] };
    const promotes = !!existing && existing.copies + 1 >= eliteCopyCount(operator.name);
    let after = before;
    if (existing?.deployed) {
      const upgraded = lineup.map(slot => slot.name === operator.name ? { ...slot, elite: promotes } : slot);
      const evaluation = evaluate(upgraded), explanation = explainLineupChange(evaluation);
      after = evaluation.stats;
      advice.score = evaluation.score + marginal(upgraded, reserve) + (promotes ? 75 : 20);
      advice.reasons = [promotes ? '再抓1张即可晋升精锐' : `凑成两张，距精锐还差${eliteCopyCount(operator.name) - existing.copies - 1}张`, ...explanation.reasons];
      advice.losses = explanation.losses;
      advice.kind = promotes ? 'elite' : 'pair';
      advice.label = promotes ? '合成精锐' : '留对子';
    } else if (existing) {
      // 这张卡已经可以免费上场。再次购买不能获得那份已有的盟约收益，
      // 整备区合成也不会立即改变场上精锐人数，只计算收集收益。
      advice.score = (promotes ? 35 : 10) + marginal(lineup, reserve.map(slot => slot.name === operator.name ? { ...slot, elite: promotes } : slot));
      advice.reasons = [promotes ? '整备区再抓1张即可晋升精锐' : '整备区凑成两张，可保留合成'];
      advice.label = promotes ? '合成备用' : '留对子';
      advice.kind = promotes ? 'elite' : 'pair';
    } else {
      const candidate: PlanOp = { name: operator.name, elite: false, core: false, eq: [], alt: [] };
      if (lineup.length < MAX_OPS) {
        const evaluation = evaluate([...lineup, candidate]), explanation = explainLineupChange(evaluation);
        after = evaluation.stats;
        advice.score = evaluation.score + marginal([...lineup, candidate], reserve) + 10;
        advice.reasons = explanation.reasons;
        advice.losses = explanation.losses;
        advice.kind = 'deploy';
        advice.label = '补上场';
      } else {
        // 装备仍属于原持有者，不凭空转移给被推荐的新人。
        const purchasedReserve = [...reserve, candidate];
        const bench = evaluate(lineup, purchasedReserve);
        const benchScore = bench.score + marginal(lineup, purchasedReserve);
        // 先扣掉购买后留整备区就能取得的收益，换人必须另有成型或核心输出价值。
        const evaluateDeployment = createLineupEvaluator(lineup, run.layers, {
          goal, reserve: purchasedReserve, bannedCovenants: new Set(run.bannedCovenants),
        });
        const replacements = lineup.map((slot, index) => {
          const next = [...lineup];
          next[index] = candidate;
          const nextReserve = [...reserve, slot];
          const evaluation = evaluate(next, nextReserve), deployment = evaluateDeployment(next, nextReserve);
          const delta = marginal(next, nextReserve);
          return { name: slot.name, evaluation, deployment, score: evaluation.score + delta, delta };
        }).filter(candidate => (candidate.evaluation.improves && candidate.deployment.improves) || candidate.delta > 10)
          .sort((a, b) => b.score - a.score);
        const best = replacements[0];
        // 经济盟约在整备区就能生效；相同收益时不要求玩家为它挪动上场阵容。
        if (best && best.score > Math.max(0, benchScore) + .001) {
          const explanation = explainLineupChange(best.evaluation);
          after = best.evaluation.stats;
          advice.score = best.score;
          advice.reasons = explanation.reasons;
          advice.losses = explanation.losses;
          advice.replace = best.name;
          advice.kind = 'replace';
          advice.label = '可替换';
        } else {
          after = bench.stats;
          advice.score = (bench.improves ? bench.score : -20) + marginal(lineup, purchasedReserve);
          advice.reasons = bench.improves ? ['放整备区即可计入经济盟约', ...explainLineupChange(bench).reasons] : ['上场已满，替换后暂无明确盟约收益'];
          advice.label = bench.improves ? '留整备区' : '暂缓抓取';
          advice.kind = 'reserve';
        }
      }
    }
    if (goal && advice.score > 0) {
      const previous = before.find(stat => stat.name === goal.covenant)?.count ?? 0;
      const current = after.find(stat => stat.name === goal.covenant)?.count ?? 0;
      if (current > previous && previous < goal.target) {
        advice.reasons.unshift(`主盟约${goal.covenant} ${previous}→${current} / ${goal.target}，优先补主轴`);
      } else if (build?.carries?.includes(operator.name)) {
        advice.reasons.unshift(`${goal.covenant}预设的核心输出${existing ? '，继续提升精锐' : '，可替换过渡位'}`);
      } else if (build?.addons?.some(covenant => operator.covenants.includes(covenant))) {
        advice.reasons.push(`可补${goal.covenant}主轴的附加盟约配合`);
      }
    }
    const acquisition = acquisitionValue(operator, promotes, before, context);
    advice.score += acquisition.score;
    advice.reasons.push(...acquisition.reasons);
    const willDeploy = existing?.deployed || advice.kind === 'deploy' || advice.kind === 'replace';
    const production = recurringValue({ name: operator.name, elite: promotes, eq: [], core: false, alt: [] }, !!willDeploy, after, context);
    advice.reasons.push(...production.reasons);
    if (advice.kind === 'reserve' && !existing && advice.score > 0 && (acquisition.score > 0 || production.score > 0)) {
      advice.label = acquisition.score > 0 ? '获得收益' : '整备区生产';
      advice.reasons = advice.reasons.filter(reason => reason !== '上场已满，替换后暂无明确盟约收益');
      advice.reasons.push('无需挤掉当前上场位，按获得或整备区特质评估');
    }
    if (promotes) advice.reasons.push('晋升按精锐获得时触发，不重复计算第三张基础特质；另有高一档免费招募，未假定奖励人选');
    if (advice.replace) advice.losses.push('换下位的精锐、装备与持续生产投入已计入机会成本；未模拟站位和实战伤害');
    const basePrice = operatorPrice(operator);
    const foresight = run.layers['远见'];
    const discount = operator.covenants.includes('远见') ? (foresight >= 80 ? 1 : 0) + (foresight >= 150 ? 1 : 0) : 0;
    const price = Math.max(1, basePrice - discount);
    if (discount) advice.reasons.push(`已录远见层数对应减价${discount}，估价${price}资金`);
    if (run.funds !== null) {
      if (operator.covenants.includes('远见') && foresight === undefined) advice.reasons.push(`基础价格${basePrice}；远见历史减价档位未知，请核对实际价格`);
      else if (run.strategy === '休露丝' && operator.covenants.includes('谢拉格') && run.funds >= 1) advice.reasons.push(`基础价格${price}，本轮首购折扣状态未知，请核对实际价格`);
      else if (run.funds < price) { advice.score = -500; advice.label = '资金不足'; advice.losses.push(`需要${price}资金，当前仅${run.funds}`); }
      else if (run.strategy === '坎诺特' && run.funds >= 5 && run.funds - price < 5) {
        advice.score -= 30; advice.losses.push('买入后不足5资金，可能失去坎诺特每回合额外1资金');
      }
    }
    const strategy = strategyAffinity(run, operator, before, after, promotes);
    const equipment = equipmentAffinity(run, operator);
    advice.fitScore = strategy.score + equipment.score;
    if (strategy.reason) advice.reasons.push(strategy.reason);
    if (equipment.reason) advice.reasons.push(equipment.reason);
    if (existing && !existing.deployed) advice.reasons.push('已有整备区干员，也可先直接上场，无需重复购买');
    if (!advice.reasons.length) advice.reasons.push(`先补上场人数 · ${operator.type}，可点头像查看特质`);
    return advice;
  });
  return ranked.sort((a, b) => b.score - a.score || b.fitScore - a.fitScore || operatorPrice(a.operator) - operatorPrice(b.operator)
    || operatorOrder.get(a.operator.name)! - operatorOrder.get(b.operator.name)!).slice(0, Math.max(0, limit));
}
