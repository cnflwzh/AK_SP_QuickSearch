/** 局内抓取：只计算已录入的阵容变化，不依赖页面状态，也不修改现有流派存档。 */
import { ALL_COVENANTS, BUILD_NAMES, buildByName, OPERATORS, EQUIPMENT, STRATEGIES, isCoreCovenant, operatorPrice, type Operator } from '../../data/index.ts';
import { covenantStats, createLineupEvaluator, defaultLineupGoal, inferPrimaryCovenant, isBanned, MAX_EQ, MAX_OPS, usesLayers, MAX_LAYERS, type Layers, type CovenantStat, type LineupEvaluation, type LineupGoal, type PlanOp } from './planner.ts';

import { ADVISOR_MODES, RESTRICTED_MODE_COVENANTS, promotionRewardTier, type AdvisorMode, type CandidateSource } from './advisorRules.ts';
import { acquisitionValue, covenantProductionValue, recurringValue, restCommandOpportunity, teamValue, type ValueContext } from './advisorValue.ts';

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
  mode: AdvisorMode;
  candidateSource: CandidateSource;
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
export interface AdviceBreakdown { lineup: number; production: number; acquisition: number; collection: number; fit: number; economy: number }
export interface DeploymentAdvice {
  name: string;
  replace: string;
  score: number;
  breakdown: { lineup: number; production: number; fill: number };
  reasons: string[];
  losses: string[];
}
export interface RecruitAdvice {
  operator: Operator;
  kind: 'elite' | 'pair' | 'deploy' | 'replace' | 'reserve' | 'skip';
  label: string;
  /** 排序使用的相对收益，不是胜率或伤害预测。 */
  score: number;
  /** 仅当主要收益相同时，才比较策略和装备搭配。 */
  fitScore: number;
  breakdown: AdviceBreakdown;
  estimatedPrice: number | null;
  affordable: boolean | null;
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
  return { level: 1, mode: 'unknown', candidateSource: 'shop', round: null, funds: null, layers: {}, strategy: '', mainCovenant: '', mainTarget: 0, bannedCovenants: [], excludedOperators: [], operators: [], equipment: [], shop: [] };
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
  result.mode = ADVISOR_MODES.some(mode => mode.id === source.mode) ? source.mode as AdvisorMode : 'unknown';
  result.candidateSource = source.candidateSource === 'promotion' ? 'promotion' : 'shop';
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

/** 招募池过滤规则；核心缺席整组排除，附加仅全部原生附加缺席时排除，装备不改变招募资格。 */
export function createRecruitmentPool(run: Pick<AdvisorRun, 'bannedCovenants' | 'excludedOperators'> & Partial<Pick<AdvisorRun, 'mode'>>): (name: string) => boolean {
  const bans = effectiveBans(run), excluded = new Set(run.excludedOperators);
  return name => operatorsByName.has(name) && !excluded.has(name) && !isBanned(name, bans);
}

export function effectiveBans(run: { bannedCovenants: readonly string[]; mode?: AdvisorMode }): ReadonlySet<string> {
  return new Set([...run.bannedCovenants, ...(run.mode === 'restricted' ? RESTRICTED_MODE_COVENANTS : [])]);
}

/** 显式选择优先，其次场上投入、专属策略、整备区；证据相同则保持未定方向。 */
export function runLineupGoal(run: AdvisorRun): LineupGoal | null {
  if (run.mainCovenant === 'mixed') return null;
  const available = createRecruitmentPool(run);
  const field = deployedLineup(run).filter(slot => available(slot.name));
  const strategy = strategiesByName.get(run.strategy);
  const strategyCovenant = strategy && isCoreCovenant(strategy.category) && !effectiveBans(run).has(strategy.category) ? strategy.category : '';
  const covenant = (effectiveBans(run).has(run.mainCovenant) ? '' : run.mainCovenant) || inferPrimaryCovenant(field) || strategyCovenant
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
  if (ALL_COVENANTS.includes(strategy.category) && !effectiveBans(run).has(strategy.category) && operator.covenants.includes(strategy.category)) {
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
  const before = covenantStats(lineup, run.layers, reserve, effectiveBans(run));
  const evaluate = createLineupEvaluator(lineup, run.layers, { goal, reserve, bannedCovenants: effectiveBans(run) });
  const context: ValueContext = { round: run.round, layers: run.layers, level: run.level, strategy: run.strategy, inactiveCovenants: effectiveBans(run) };
  const oldValue = teamValue(lineup, reserve, context);
  const marginal = (field: PlanOp[], bench: PlanOp[]) => teamValue(field, bench, context) - oldValue;
  const build = goal ? buildByName(goal.covenant) : undefined;
  const owned = new Map(run.operators.map(operator => [operator.name, operator]));
  const candidates = (run.shop.length
    ? run.shop.map(name => operatorsByName.get(name)).filter((operator): operator is Operator => !!operator)
    // Pith 指令赠送的辅助干员不在普通商店池，仍可在持有记录中手动录入。
    : OPERATORS.filter(operator => operator.stars > 0 && operator.tier <= run.level && !owned.get(operator.name)?.elite))
    .filter(operator => available(operator.name) && (run.candidateSource !== 'promotion' || operator.stars > 0 && operator.tier === promotionRewardTier(run.level)));
  // 晋升奖励来自实际三选一，不在未录入候选时凭空生成可选卡。
  if (run.candidateSource === 'promotion' && !run.shop.length) return [];
  const ranked = candidates.map(operator => {
    const existing = owned.get(operator.name);
    const advice: RecruitAdvice = { operator, kind: 'reserve', label: '备选', score: 0, fitScore: 0, breakdown: { lineup: 0, production: 0, acquisition: 0, collection: 0, fit: 0, economy: 0 }, estimatedPrice: null, affordable: null, reasons: [], losses: [], replace: '' };
    if (existing?.elite) return { ...advice, kind: 'skip' as const, label: '暂不追', score: -1000, breakdown: { ...advice.breakdown, collection: -1000 }, reasons: ['已有精锐，本工具不再追同名合成'] };
    const promotes = !!existing && existing.copies + 1 >= eliteCopyCount(operator.name);
    let after = before;
    if (existing?.deployed) {
      const upgraded = lineup.map(slot => slot.name === operator.name ? { ...slot, elite: promotes } : slot);
      const evaluation = evaluate(upgraded), explanation = explainLineupChange(evaluation);
      after = evaluation.stats;
      advice.breakdown.lineup = evaluation.score;
      advice.breakdown.production = marginal(upgraded, reserve);
      advice.breakdown.collection = promotes ? 75 : 20;
      advice.score = evaluation.score + advice.breakdown.production + advice.breakdown.collection;
      advice.reasons = [promotes ? '再抓1张即可晋升精锐' : `凑成两张，距精锐还差${eliteCopyCount(operator.name) - existing.copies - 1}张`, ...explanation.reasons];
      advice.losses = explanation.losses;
      advice.kind = promotes ? 'elite' : 'pair';
      advice.label = promotes ? '合成精锐' : '留对子';
    } else if (existing) {
      // 这张卡已经可以免费上场。再次购买不能获得那份已有的盟约收益，
      // 整备区合成也不会立即改变场上精锐人数，只计算收集收益。
      advice.breakdown.collection = promotes ? 35 : 10;
      advice.breakdown.production = marginal(lineup, reserve.map(slot => slot.name === operator.name ? { ...slot, elite: promotes } : slot));
      advice.score = advice.breakdown.collection + advice.breakdown.production;
      advice.reasons = [promotes ? '整备区再抓1张即可晋升精锐' : '整备区凑成两张，可保留合成'];
      advice.label = promotes ? '合成备用' : '留对子';
      advice.kind = promotes ? 'elite' : 'pair';
      if (promotes) applyPromotionDeploymentValue(run, operator.name, advice);
    } else {
      const candidate: PlanOp = { name: operator.name, elite: false, core: false, eq: [], alt: [] };
      if (lineup.length < MAX_OPS) {
        const evaluation = evaluate([...lineup, candidate]), explanation = explainLineupChange(evaluation);
        const bench = evaluate(lineup, [...reserve, candidate]);
        const fieldProduction = marginal([...lineup, candidate], reserve);
        const benchProduction = marginal(lineup, [...reserve, candidate]);
        // 空位不等于无代价：第二名独行会让已有独行失效，仍须比较留整备区。
        if (evaluation.score + fieldProduction + 10 < bench.score + benchProduction) {
          after = bench.stats;
          advice.breakdown.lineup = bench.score;
          advice.breakdown.production = benchProduction;
          advice.score = bench.score + benchProduction;
          advice.reasons = ['虽有空位，先留整备区；不上场可避免' + (explanation.losses.join('、') || '现有阵容收益下降'), ...explainLineupChange(bench).reasons];
          advice.kind = 'reserve';
          advice.label = '留整备区';
        } else {
          after = evaluation.stats;
          advice.breakdown.lineup = evaluation.score;
          advice.breakdown.production = fieldProduction;
          advice.breakdown.collection = 10;
          advice.score = evaluation.score + fieldProduction + 10;
          advice.reasons = explanation.reasons;
          advice.losses = explanation.losses;
          advice.kind = 'deploy';
          advice.label = '补上场';
        }
        // 买牌与免费调阵共享搜索结果：空位不能掩盖保持独行、补齐核心的换人方案。
        const purchasedRun: AdvisorRun = { ...run,
          operators: [...run.operators, { name: operator.name, copies: 1, elite: false, deployed: false }],
        };
        const swap = recommendDeployments(purchasedRun, OPERATORS.length).find(plan => plan.name === operator.name && plan.replace);
        if (swap) {
          const next = lineup.map(slot => slot.name === swap.replace ? candidate : slot);
          const nextReserve = [...reserve, ...lineup.filter(slot => slot.name === swap.replace)];
          const evaluation = evaluate(next, nextReserve), production = marginal(next, nextReserve);
          if (evaluation.score + production > advice.score + .001) {
            const explanation = explainLineupChange(evaluation);
            after = evaluation.stats;
            advice.breakdown.lineup = evaluation.score;
            advice.breakdown.production = production;
            advice.breakdown.collection = 0;
            advice.score = evaluation.score + production;
            advice.kind = 'replace';
            advice.label = '可替换';
            advice.replace = swap.replace;
            advice.reasons = ['买入先留整备区，再按建议换人；不因空位直接破坏现有盟约', ...explanation.reasons];
            advice.losses = explanation.losses;
          }
        }
      } else {
        // 装备仍属于原持有者，不凭空转移给被推荐的新人。
        const purchasedReserve = [...reserve, candidate];
        const bench = evaluate(lineup, purchasedReserve);
        const benchScore = bench.score + marginal(lineup, purchasedReserve);
        // 先扣掉购买后留整备区就能取得的收益，换人必须另有成型或核心输出价值。
        const evaluateDeployment = createLineupEvaluator(lineup, run.layers, {
          goal, reserve: purchasedReserve, bannedCovenants: effectiveBans(run),
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
          advice.breakdown.lineup = best.evaluation.score;
          advice.breakdown.production = best.delta;
          advice.score = best.score;
          advice.reasons = explanation.reasons;
          advice.losses = explanation.losses;
          advice.replace = best.name;
          advice.kind = 'replace';
          advice.label = '可替换';
        } else {
          after = bench.stats;
          advice.breakdown.lineup = bench.improves ? bench.score : 0;
          advice.breakdown.collection = bench.improves ? 0 : -20;
          advice.breakdown.production = marginal(lineup, purchasedReserve);
          advice.score = advice.breakdown.lineup + advice.breakdown.collection + advice.breakdown.production;
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
    const covenantProduction = covenantProductionValue(after, context);
    if (covenantProduction.score > covenantProductionValue(before, context).score) advice.reasons.push(...covenantProduction.reasons);
    const acquisition = acquisitionValue(operator, promotes, before, context);
    advice.breakdown.acquisition = acquisition.score;
    advice.score += acquisition.score;
    advice.reasons.push(...acquisition.reasons);
    const willDeploy = existing?.deployed || advice.kind === 'deploy' || advice.kind === 'replace';
    const candidateSlot: PlanOp = { name: operator.name, elite: promotes, eq: existing ? planSlot(run, existing).eq : [], core: false, alt: [] };
    const finalField = existing ? lineup.map(slot => slot.name === operator.name ? candidateSlot : slot)
      : advice.kind === 'deploy' ? [...lineup, candidateSlot] : advice.kind === 'replace' ? lineup.map(slot => slot.name === advice.replace ? candidateSlot : slot) : lineup;
    const finalReserve = existing ? reserve.map(slot => slot.name === operator.name ? candidateSlot : slot)
      : advice.kind === 'reserve' ? [...reserve, candidateSlot] : advice.kind === 'replace' ? [...reserve, ...lineup.filter(slot => slot.name === advice.replace)] : reserve;
    const commandOpportunity = restCommandOpportunity(finalField, finalReserve, context);
    if (commandOpportunity.target === operator.name) advice.reasons.push(...commandOpportunity.reasons);
    const production = recurringValue(candidateSlot, !!willDeploy, after, context, { field: finalField, reserve: finalReserve });
    if (!existing || promotes) advice.reasons.push(...production.reasons);
    else if (production.score > 0) advice.reasons.push('现有干员已提供持续收益，买入对子不会重复增加这份产出');
    if (advice.kind === 'reserve' && !existing && advice.score > 0 && (acquisition.score > 0 || production.score > 0)) {
      advice.label = acquisition.score > 0 ? '获得收益' : '整备区生产';
      advice.reasons = advice.reasons.filter(reason => reason !== '上场已满，替换后暂无明确盟约收益');
      advice.reasons.push('无需挤掉当前上场位，按获得或整备区特质评估');
    }
    if (promotes) advice.reasons.push('晋升按精锐获得时触发，不重复计算第三张基础特质；另有调度中心高一阶（最高6阶）免费三选一，未假定奖励人选');
    if (advice.replace) advice.reasons.push('换下位的精锐、装备与持续生产投入已计入机会成本；未模拟站位和实战伤害');
    if (run.candidateSource === 'promotion') advice.reasons.push(`已录晋升奖励：免费选择，奖励等阶为${promotionRewardTier(run.level)}；不计算抽中概率`);
    const price = recruitPriceRange(run, operator);
    advice.estimatedPrice = price.min === price.max ? price.max : null;
    advice.affordable = run.funds === null ? null : run.funds < price.min ? false : run.funds >= price.max ? true : null;
    if (price.min !== price.max) advice.reasons.push(`价格待核：${price.min}—${price.max}资金，折扣/本轮首购状态未知`);
    if (advice.affordable === false) {
      advice.label = '资金不足';
      advice.losses.push(`至少需要${price.min}资金，当前仅${run.funds}；仍可手动记录已获得的奖励牌`);
    } else if (run.candidateSource !== 'promotion' && run.strategy === '坎诺特' && run.round !== 14 && run.funds !== null && run.funds >= 5 && run.funds - price.min < 5) {
      advice.breakdown.economy = -30;
      advice.score -= 30;
      advice.losses.push('买入后不足5资金，可能失去下回合额外1资金');
    }
    const strategy = strategyAffinity(run, operator, before, after, promotes);
    const equipment = equipmentAffinity(run, operator);
    advice.fitScore = strategy.score + equipment.score;
    advice.breakdown.fit = advice.fitScore;
    if (strategy.reason) advice.reasons.push(strategy.reason);
    if (equipment.reason) advice.reasons.push(equipment.reason);
    if (existing && !existing.deployed) advice.reasons.push('已有整备区干员，也可先直接上场，无需重复购买');
    if (!advice.reasons.length) advice.reasons.push(`先补上场人数 · ${operator.type}，可点头像查看特质`);
    return advice;
  });
  return ranked.sort((a, b) => Number(a.affordable === false) - Number(b.affordable === false) || b.score - a.score || b.fitScore - a.fitScore || operatorPrice(a.operator) - operatorPrice(b.operator)
    || operatorOrder.get(a.operator.name)! - operatorOrder.get(b.operator.name)!).slice(0, Math.max(0, limit));
}


/** 只采用当前数据可证明的价格区间，不把未知折扣当成免费。 */
export function recruitPriceRange(run: AdvisorRun, operator: Operator): { min: number; max: number } {
  if (run.candidateSource === 'promotion') return { min: 0, max: 0 };
  const base = operatorPrice(operator);
  let min = base, max = base;
  if (operator.covenants.includes('远见') && !effectiveBans(run).has('远见')) {
    const layers = run.layers['远见'];
    if (layers === undefined) min = Math.max(1, base - 2);
    else min = max = Math.max(1, base - Number(layers >= 80) - Number(layers >= 150));
  }
  if (run.strategy === '休露丝' && operator.covenants.includes('谢拉格')) min = Math.min(min, 1);
  return { min, max };
}

/**
 * 整备区晋升的价值还包括晋升后可以执行的调阵，但当前已能免费执行的方案必须扣除。
 * 复用同一调阵评估器，避免买牌与上场两处维护不同的盟约、装备和机会成本规则。
 */
function applyPromotionDeploymentValue(run: AdvisorRun, name: string, advice: RecruitAdvice): void {
  const currentPlan = recommendDeployments(run, OPERATORS.length).find(plan => plan.name === name);
  const promotedRun: AdvisorRun = { ...run,
    operators: run.operators.map(operator => operator.name === name ? { ...operator, elite: true, copies: 1 } : operator),
  };
  const promotedPlan = recommendDeployments(promotedRun, OPERATORS.length).find(plan => plan.name === name);
  if (!promotedPlan || promotedPlan.score <= (currentPlan?.score ?? 0)) return;
  const previous = currentPlan?.breakdown ?? { lineup: 0, production: 0, fill: 0 };
  advice.breakdown.lineup += promotedPlan.breakdown.lineup - previous.lineup;
  advice.breakdown.production += promotedPlan.breakdown.production - previous.production;
  advice.breakdown.collection += promotedPlan.breakdown.fill - previous.fill;
  advice.score += promotedPlan.score - (currentPlan?.score ?? 0);
  advice.replace = promotedPlan.replace;
  advice.label = '晋升后上场';
  advice.reasons.push(`晋升后可上场${promotedPlan.replace ? `替换${promotedPlan.replace}` : '填入空位'}；已扣除现在即可免费调阵的收益`,
    ...promotedPlan.reasons.filter(reason => !reason.startsWith('已持有')));
  advice.losses.push(...promotedPlan.losses);
}

/** 已持有整备区干员的免费调阵，独立于买牌，不触发获得/合成奖励。 */
export function recommendDeployments(run: AdvisorRun, limit = 3): DeploymentAdvice[] {
  const available = createRecruitmentPool(run);
  if (run.operators.some(operator => !available(operator.name))) return [];
  const lineup = deployedLineup(run), reserve = reserveLineup(run);
  const context: ValueContext = { round: run.round, layers: run.layers, level: run.level, strategy: run.strategy, inactiveCovenants: effectiveBans(run) };
  const evaluate = createLineupEvaluator(lineup, run.layers, { goal: runLineupGoal(run), reserve, bannedCovenants: effectiveBans(run) });
  const oldValue = teamValue(lineup, reserve, context);
  return reserve.flatMap(candidate => {
    // 有空位也可能需要换人（如独行只能保留一人），不能只搜索补位。
    // 补位先列出，收益相同时保留现有成员，避免无意义挪动。
    const choices = [...(lineup.length < MAX_OPS ? [-1] : []), ...lineup.map((_, index) => index)];
    const options = choices.map(index => {
      const next = [...lineup], bench = reserve.filter(slot => slot.name !== candidate.name);
      const outgoing = index < 0 ? null : lineup[index];
      if (outgoing) { next[index] = candidate; bench.push(outgoing); } else next.push(candidate);
      const evaluation = evaluate(next, bench), explanation = explainLineupChange(evaluation);
      const production = teamValue(next, bench, context) - oldValue;
      const score = evaluation.score + production + (outgoing ? 0 : 10);
      return { name: candidate.name, replace: outgoing?.name ?? '', score,
        breakdown: { lineup: evaluation.score, production, fill: outgoing ? 0 : 10 },
        reasons: ['已持有，无需再次购买；不重复计算获得时奖励', ...explanation.reasons,
          ...(production > 0 ? ['上场后的持续收益或现有精锐装备投入优于当前配置'] : [])], losses: explanation.losses };
    }).filter(item => item.score > .001).sort((a, b) => b.score - a.score);
    return options.slice(0, 1);
  }).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'zh-CN')).slice(0, Math.max(0, limit));
}
