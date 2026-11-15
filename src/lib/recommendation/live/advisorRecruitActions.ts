/** 单张招募的动作搜索；只选择持有、补位、替换或整备，不处理价格和展示排序。 */
import {OPERATORS, type Operator} from '../../../../data/index.ts';
import {type CovenantStat} from '../../plans/covenants.ts';
import {type PlanOp} from '../../plans/model.ts';
import {
  createLineupEvaluator,
  type LineupEvaluation,
  type LineupGoal,
} from '../planning.ts';
import {
  evaluateDeployments,
  recommendDeployments,
} from './advisorDeployments.ts';
import {explainLineupChange} from './advisorEvaluation.ts';
import type {AdvisorPreferenceEvaluator} from './advisorPreferences.ts';
import {
  advisorDeploymentLimit,
  effectiveBans,
  eliteCopyCount,
} from './advisorState.ts';
import type {
  AdvisorRun,
  RecordedOperator,
  RecruitAdvice,
} from './advisorTypes.ts';
import {
  purchaseMilestoneAdjustment,
  teamValue,
  type TraitValue,
  type ValueContext,
} from './advisorValue.ts';
export interface RecruitActionContext {
  readonly run: AdvisorRun;
  readonly lineup: PlanOp[];
  readonly reserve: PlanOp[];
  readonly previousStats: CovenantStat[];
  readonly goal: LineupGoal | null;
  readonly preference: AdvisorPreferenceEvaluator;
  readonly evaluateLineup: (
    field: readonly PlanOp[],
    reserve?: readonly PlanOp[],
  ) => LineupEvaluation;
  readonly valueContext: ValueContext;
  readonly baselineTeamValue: number;
}
/** 说明与偏好读取搜索实际选中的阵容，不能再次用标签推导另一份局面。 */
export interface RecruitActionEvaluation {
  advice: RecruitAdvice;
  field: PlanOp[];
  reserve: PlanOp[];
  stats: CovenantStat[];
}
interface CandidateActionContext extends RecruitActionContext {
  readonly operator: Operator;
  readonly advice: RecruitAdvice;
  readonly evaluateProductionDelta: (
    field: PlanOp[],
    reserve: PlanOp[],
  ) => number;
}
/** advice 是本候选专属的结果草稿；所有玩家输入与其他候选保持不变。 */
export function evaluateRecruitAction(
  operator: Operator,
  existing: RecordedOperator | undefined,
  promotes: boolean,
  acquisition: TraitValue,
  advice: RecruitAdvice,
  evaluationContext: RecruitActionContext,
): RecruitActionEvaluation {
  const {previousStats, valueContext, baselineTeamValue, run, lineup} =
    evaluationContext;
  const candidateContext: CandidateActionContext = {
    ...evaluationContext,
    operator,
    advice,
    evaluateProductionDelta: (field, reserve) =>
      teamValue(field, reserve, valueContext) -
      baselineTeamValue +
      purchaseMilestoneAdjustment(
        acquisition,
        previousStats,
        field,
        reserve,
        valueContext,
      ).score,
  };
  if (existing) {
    return evaluateOwnedRecruit(candidateContext, existing, promotes);
  }
  const candidate: PlanOp = {
    name: operator.name,
    elite: false,
    core: false,
    eq: [],
    alt: [],
  };
  return lineup.length < advisorDeploymentLimit(run)
    ? evaluateRecruitWithSpace(candidateContext, candidate)
    : evaluateRecruitAtCapacity(candidateContext, candidate);
}
/** 已持有干员只评估对子/精锐增量，不重复计入已有的免费上场收益。 */
function evaluateOwnedRecruit(
  search: CandidateActionContext,
  existing: RecordedOperator,
  promotes: boolean,
): RecruitActionEvaluation {
  const {
    run,
    lineup,
    reserve,
    previousStats,
    operator,
    advice,
    evaluateLineup,
    evaluateProductionDelta,
  } = search;
  let resultingStats = previousStats;
  let field = lineup;
  let remainingReserve = reserve;
  if (existing.deployed) {
    const upgraded = lineup.map((slot) =>
      slot.name === operator.name ? {...slot, elite: promotes} : slot,
    );
    const evaluation = evaluateLineup(upgraded),
      explanation = explainLineupChange(evaluation);
    resultingStats = evaluation.stats;
    field = upgraded;
    advice.breakdown.lineup = evaluation.score;
    advice.breakdown.production = evaluateProductionDelta(upgraded, reserve);
    advice.breakdown.collection = promotes ? 75 : 20;
    advice.score =
      evaluation.score +
      advice.breakdown.production +
      advice.breakdown.collection;
    advice.reasons = [
      promotes
        ? '再抓1张即可晋升精锐'
        : `凑成两张，距精锐还差${eliteCopyCount(operator.name) - existing.copies - 1}张`,
      ...explanation.reasons,
    ];
    advice.losses = explanation.losses;
    advice.kind = promotes ? 'elite' : 'pair';
    advice.label = promotes ? '合成精锐' : '留对子';
  } else {
    // 这张卡已经可以免费上场。再次购买不能获得那份已有的盟约收益，
    // 整备区合成也不会立即改变场上精锐人数，只计算收集收益。
    advice.breakdown.collection = promotes ? 35 : 10;
    advice.breakdown.production = evaluateProductionDelta(
      lineup,
      reserve.map((slot) =>
        slot.name === operator.name ? {...slot, elite: promotes} : slot,
      ),
    );
    advice.score = advice.breakdown.collection + advice.breakdown.production;
    advice.reasons = [
      promotes ? '整备区再抓1张即可晋升精锐' : '整备区凑成两张，可保留合成',
    ];
    advice.label = promotes ? '合成备用' : '留对子';
    advice.kind = promotes ? 'elite' : 'pair';
    remainingReserve = reserve.map((slot) =>
      slot.name === operator.name ? {...slot, elite: promotes} : slot,
    );
    if (promotes) {
      applyPromotionDeploymentValue(run, operator.name, advice);
    }
  }
  return {advice, field, reserve: remainingReserve, stats: resultingStats};
}
/** 空位仍需比较留整备和替换，避免补位破坏独行等已有条件。 */
function evaluateRecruitWithSpace(
  search: CandidateActionContext,
  candidate: PlanOp,
): RecruitActionEvaluation {
  const {
    run,
    lineup,
    reserve,
    operator,
    advice,
    preference,
    evaluateLineup,
    evaluateProductionDelta,
  } = search;
  let resultingStats: CovenantStat[];
  let field = lineup;
  let remainingReserve = reserve;
  const evaluation = evaluateLineup([...lineup, candidate]),
    explanation = explainLineupChange(evaluation);
  const bench = evaluateLineup(lineup, [...reserve, candidate]);
  const fieldProduction = evaluateProductionDelta(
    [...lineup, candidate],
    reserve,
  );
  const benchProduction = evaluateProductionDelta(lineup, [
    ...reserve,
    candidate,
  ]);
  // 空位不等于无代价：第二名独行会让已有独行失效，仍须比较留整备区。
  if (evaluation.score + fieldProduction + 10 < bench.score + benchProduction) {
    resultingStats = bench.stats;
    remainingReserve = [...reserve, candidate];
    advice.breakdown.lineup = bench.score;
    advice.breakdown.production = benchProduction;
    advice.score = bench.score + benchProduction;
    advice.reasons = [
      '虽有空位，先留整备区；不上场可避免' +
        (explanation.losses.join('、') || '现有阵容收益下降'),
      ...explainLineupChange(bench).reasons,
    ];
    advice.kind = 'reserve';
    advice.label = '留整备区';
  } else {
    resultingStats = evaluation.stats;
    field = [...lineup, candidate];
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
  const purchasedRun: AdvisorRun = {
    ...run,
    operators: [
      ...run.operators,
      {name: operator.name, copies: 1, elite: false, deployed: false},
    ],
  };
  const swap = evaluateDeployments(
    purchasedRun,
    OPERATORS.length,
    preference,
  ).find((plan) => plan.name === operator.name && plan.replace);
  if (swap) {
    const next = lineup.map((slot) =>
      slot.name === swap.replace ? candidate : slot,
    );
    const nextReserve = [
      ...reserve,
      ...lineup.filter((slot) => slot.name === swap.replace),
    ];
    const evaluation = evaluateLineup(next, nextReserve),
      production = evaluateProductionDelta(next, nextReserve);
    if (evaluation.score + production > advice.score + 0.001) {
      const explanation = explainLineupChange(evaluation);
      resultingStats = evaluation.stats;
      field = next;
      remainingReserve = nextReserve;
      advice.breakdown.lineup = evaluation.score;
      advice.breakdown.production = production;
      advice.breakdown.collection = 0;
      advice.score = evaluation.score + production;
      advice.kind = 'replace';
      advice.label = '可替换';
      advice.replace = swap.replace;
      advice.reasons = [
        '买入先留整备区，再按建议换人；不因空位直接破坏现有盟约',
        ...explanation.reasons,
      ];
      advice.losses = explanation.losses;
    }
  }
  return {advice, field, reserve: remainingReserve, stats: resultingStats};
}
/** 满员时，新人的收益必须超过留整备；原成员的装备不会自动转移。 */
function evaluateRecruitAtCapacity(
  search: CandidateActionContext,
  candidate: PlanOp,
): RecruitActionEvaluation {
  const {
    run,
    lineup,
    reserve,
    goal,
    advice,
    preference,
    evaluateLineup,
    evaluateProductionDelta,
  } = search;
  let resultingStats: CovenantStat[];
  let field = lineup;
  let remainingReserve: typeof reserve;
  // 装备仍属于原持有者，不凭空转移给被推荐的新人。
  const purchasedReserve = [...reserve, candidate];
  const bench = evaluateLineup(lineup, purchasedReserve);
  const benchProduction = evaluateProductionDelta(lineup, purchasedReserve);
  const benchScore = bench.score + benchProduction;
  // 换人必须新增成型或生产收益；留整备区已可获得的收益不能再次算作换人理由。
  const evaluateDeployment = createLineupEvaluator(lineup, run.layers, {
    goal,
    reserve: purchasedReserve,
    bannedCovenants: effectiveBans(run),
  });
  const replacements = lineup
    .map((slot, index) => {
      const next = [...lineup];
      next[index] = candidate;
      const nextReserve = [...reserve, slot];
      const evaluation = evaluateLineup(next, nextReserve),
        deployment = evaluateDeployment(next, nextReserve);
      const delta = evaluateProductionDelta(next, nextReserve);
      return {
        name: slot.name,
        field: next,
        reserve: nextReserve,
        evaluation,
        deployment,
        score: evaluation.score + delta,
        delta,
        preferenceScore: preference(next, nextReserve).preference,
      };
    })
    .filter(
      (candidate) =>
        candidate.deployment.improves ||
        candidate.delta > benchProduction + 0.001,
    )
    .sort((a, b) => b.score - a.score || b.preferenceScore - a.preferenceScore);
  const best = replacements[0];
  // 经济盟约在整备区就能生效；相同收益时不要求玩家为它挪动上场阵容。
  if (best && best.score > Math.max(0, benchScore) + 0.001) {
    const explanation = explainLineupChange(best.evaluation);
    resultingStats = best.evaluation.stats;
    field = best.field;
    remainingReserve = best.reserve;
    advice.breakdown.lineup = best.evaluation.score;
    advice.breakdown.production = best.delta;
    advice.score = best.score;
    advice.reasons = explanation.reasons;
    advice.losses = explanation.losses;
    advice.replace = best.name;
    advice.kind = 'replace';
    advice.label = '可替换';
  } else {
    resultingStats = bench.stats;
    remainingReserve = purchasedReserve;
    advice.breakdown.lineup = bench.improves ? bench.score : 0;
    advice.breakdown.collection = bench.improves ? 0 : -20;
    advice.breakdown.production = evaluateProductionDelta(
      lineup,
      purchasedReserve,
    );
    advice.score =
      advice.breakdown.lineup +
      advice.breakdown.collection +
      advice.breakdown.production;
    advice.reasons = bench.improves
      ? ['放整备区即可计入经济盟约', ...explainLineupChange(bench).reasons]
      : ['上场已满，替换后暂无明确盟约收益'];
    advice.label = bench.improves ? '留整备区' : '暂缓抓取';
    advice.kind = 'reserve';
  }
  return {advice, field, reserve: remainingReserve, stats: resultingStats};
}
/**
 * 整备区晋升的价值还包括晋升后可以执行的调阵，但当前已能免费执行的方案必须扣除。
 * 复用同一调阵评估器，避免买牌与上场两处维护不同的盟约、装备和机会成本规则。
 */
function applyPromotionDeploymentValue(
  run: AdvisorRun,
  name: string,
  advice: RecruitAdvice,
): void {
  const currentPlan = recommendDeployments(run, OPERATORS.length).find(
    (plan) => plan.name === name,
  );
  const promotedRun: AdvisorRun = {
    ...run,
    operators: run.operators.map((operator) =>
      operator.name === name ? {...operator, elite: true, copies: 1} : operator,
    ),
  };
  const promotedPlan = recommendDeployments(promotedRun, OPERATORS.length).find(
    (plan) => plan.name === name,
  );
  if (!promotedPlan || promotedPlan.score <= (currentPlan?.score ?? 0)) {
    return;
  }
  const previous = currentPlan?.breakdown ?? {
    lineup: 0,
    production: 0,
    fill: 0,
  };
  advice.breakdown.lineup += promotedPlan.breakdown.lineup - previous.lineup;
  advice.breakdown.production +=
    promotedPlan.breakdown.production - previous.production;
  advice.breakdown.collection += promotedPlan.breakdown.fill - previous.fill;
  advice.score += promotedPlan.score - (currentPlan?.score ?? 0);
  advice.replace = promotedPlan.replace;
  advice.label = '晋升后上场';
  advice.reasons.push(
    `晋升后可上场${promotedPlan.replace ? `替换${promotedPlan.replace}` : '填入空位'}；已扣除现在即可免费调阵的收益`,
    ...promotedPlan.reasons.filter((reason) => !reason.startsWith('已持有')),
  );
  advice.losses.push(...promotedPlan.losses);
}
