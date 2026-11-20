/** 单张招募的动作搜索；只选择持有、补位、替换或整备，不处理价格和展示排序。 */
import {type Operator} from '../../../../data/index.ts';
import {type CovenantStat} from '../../plans/covenants.ts';
import {type PlanOp} from '../../plans/model.ts';
import {
  createLineupEvaluator,
  type LineupEvaluation,
  type LineupGoal,
} from '../planning.ts';
import {evaluateDeployments} from './advisorDeployments.ts';
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
  /** 普通卡当前即可执行的调阵，用于比较购买才带来的差异。 */
  freeDeployment?: {
    field: PlanOp[];
    stats: CovenantStat[];
    preferenceScore: number;
  };
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
  const {previousStats, valueContext, baselineTeamValue} = evaluationContext;
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
  return evaluateNewRecruit(candidateContext, candidate);
}
/** 已持有干员只评估对子/精锐增量，不重复计入已有的免费上场收益。 */
function evaluateOwnedRecruit(
  search: CandidateActionContext,
  existing: RecordedOperator,
  promotes: boolean,
): RecruitActionEvaluation {
  const {
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
    if (promotes) {
      const existingSlot = reserve.find((slot) => slot.name === operator.name)!;
      return evaluateReservePromotion(search, existingSlot);
    }
    advice.breakdown.collection = 10;
    advice.breakdown.production = evaluateProductionDelta(lineup, reserve);
    advice.score = advice.breakdown.collection + advice.breakdown.production;
    advice.reasons = ['整备区凑成两张，可保留合成'];
    advice.label = '留对子';
    advice.kind = 'pair';
  }
  return {advice, field, reserve, stats: resultingStats};
}
interface RecruitPlacement {
  kind: 'reserve' | 'deploy' | 'replace';
  replace: string;
  field: PlanOp[];
  reserve: PlanOp[];
  evaluation: LineupEvaluation;
  production: number;
  fill: number;
  score: number;
}
/** 从真实购前状态比较留整备、补空位和逐一换人。候选已持有时，benchWithoutCandidate 保留其余整备成员。 */
function chooseRecruitPlacement(
  search: CandidateActionContext,
  candidate: PlanOp,
  benchWithoutCandidate: PlanOp[],
): {best: RecruitPlacement; bench: RecruitPlacement; hasSpace: boolean} {
  const {
    run,
    lineup,
    goal,
    evaluateLineup,
    evaluateProductionDelta,
    preference,
  } = search;
  const hasSpace = lineup.length < advisorDeploymentLimit(run);
  const purchasedReserve = [...benchWithoutCandidate, candidate];
  function placement(
    kind: RecruitPlacement['kind'],
    field: PlanOp[],
    reserve: PlanOp[],
    replace = '',
  ): RecruitPlacement {
    const evaluation = evaluateLineup(field, reserve);
    const production = evaluateProductionDelta(field, reserve);
    const fill = kind === 'deploy' ? 10 : 0;
    return {
      kind,
      replace,
      field,
      reserve,
      evaluation,
      production,
      fill,
      score: evaluation.score + production + fill,
    };
  }
  const bench = placement('reserve', lineup, purchasedReserve);
  let best = bench;
  if (hasSpace) {
    const fill = placement(
      'deploy',
      [...lineup, candidate],
      benchWithoutCandidate,
    );
    if (fill.score >= bench.score) best = fill;
  }
  if (!lineup.length) return {best, bench, hasSpace};
  // 换人必须比保留场上成员有实际收益。单独校验部署改善，防止把整备区本已生效的经济盟约算给换人。
  const evaluateDeployment = createLineupEvaluator(lineup, run.layers, {
    goal,
    reserve: purchasedReserve,
    bannedCovenants: effectiveBans(run),
  });
  let bestSwapPreference: number | undefined;
  for (const [index, outgoing] of lineup.entries()) {
    const field = [...lineup];
    field[index] = candidate;
    const swap = placement(
      'replace',
      field,
      [...benchWithoutCandidate, outgoing],
      outgoing.name,
    );
    if (
      swap.score <= Math.max(0, bench.score) + 0.001 ||
      swap.score < best.score
    )
      continue;
    if (best.kind !== 'replace' && swap.score <= best.score + 0.001) continue;
    if (
      swap.production <= bench.production + 0.001 &&
      !evaluateDeployment(swap.field, swap.reserve).improves
    )
      continue;
    if (swap.score === best.score) {
      bestSwapPreference ??= preference(best.field, best.reserve).preference;
      const nextPreference = preference(swap.field, swap.reserve).preference;
      if (nextPreference <= bestSwapPreference) continue;
      bestSwapPreference = nextPreference;
    } else {
      bestSwapPreference = undefined;
    }
    best = swap;
  }
  return {best, bench, hasSpace};
}
/** 价格和获得时的固定收益由调用方统一计算；这里保留位置相关的门槛得失。 */
function evaluateNewRecruit(
  search: CandidateActionContext,
  candidate: PlanOp,
): RecruitActionEvaluation {
  const {advice} = search;
  const {best, hasSpace} = chooseRecruitPlacement(
    search,
    candidate,
    search.reserve,
  );
  const {evaluation, production, fill, kind, replace, field, reserve} = best;
  const explanation = explainLineupChange(evaluation);
  const defer = kind === 'reserve' && !hasSpace && !evaluation.improves;
  advice.kind = kind;
  advice.replace = replace;
  advice.label =
    kind === 'replace'
      ? '可替换'
      : kind === 'deploy'
        ? '补上场'
        : defer
          ? '暂缓抓取'
          : '留整备区';
  advice.breakdown.lineup = defer ? 0 : evaluation.score;
  advice.breakdown.production = production;
  advice.breakdown.collection = defer ? -20 : fill;
  advice.score =
    advice.breakdown.lineup + production + advice.breakdown.collection;
  advice.reasons = explanation.reasons;
  advice.losses = explanation.losses;
  if (kind === 'reserve') {
    advice.reasons.unshift(
      hasSpace
        ? '虽有空位，先留整备区可保留更高的阵容或生产收益'
        : defer
          ? '上场已满，替换后暂无明确盟约收益'
          : '放整备区即可计入经济盟约',
    );
  } else if (kind === 'replace' && hasSpace) {
    advice.reasons.unshift('买入先留整备区，再按建议换人');
  }
  return {advice, field, reserve, stats: evaluation.stats};
}
/**
 * 在实际获得收益下选择晋升后的落位，再扣除普通卡已能免费执行的调阵。
 * 返回所选阵容和免费的对照阵容，供主轴、策略及路线比较。
 */
function evaluateReservePromotion(
  search: CandidateActionContext,
  existing: PlanOp,
): RecruitActionEvaluation {
  const {run, lineup, reserve, goal, preference, advice} = search;
  const remaining = reserve.filter((slot) => slot.name !== existing.name);
  const {best, bench} = chooseRecruitPlacement(
    search,
    {...existing, elite: true},
    remaining,
  );
  const current =
    best !== bench
      ? evaluateDeployments(run, 1, preference, existing.name)[0]
      : undefined;
  const deploy =
    best !== bench && best.score - bench.score > (current?.score ?? 0) + 0.001;
  const selected = deploy ? best : bench;
  const free = deploy ? current : undefined;
  const previous = free?.breakdown;
  advice.kind = 'elite';
  advice.label = deploy ? '晋升后上场' : '合成备用';
  advice.replace = selected.replace;
  advice.breakdown.lineup = selected.evaluation.score - (previous?.lineup ?? 0);
  advice.breakdown.production =
    selected.production - (previous?.production ?? 0);
  advice.breakdown.collection = 35 + selected.fill - (previous?.fill ?? 0);
  advice.score =
    advice.breakdown.lineup +
    advice.breakdown.production +
    advice.breakdown.collection;
  advice.reasons = ['整备区再抓1张即可晋升精锐'];
  if (deploy) {
    advice.reasons.push(
      `晋升后可上场${selected.replace ? `替换${selected.replace}` : '填入空位'}；已扣除现在即可免费调阵的收益`,
    );
  }
  let freeDeployment: RecruitActionEvaluation['freeDeployment'];
  let change = selected.evaluation;
  if (free) {
    const outgoing = lineup.find((slot) => slot.name === free.replace);
    const field = outgoing
      ? lineup.map((slot) => (slot === outgoing ? existing : slot))
      : [...lineup, existing];
    const freeReserve = outgoing ? [...remaining, outgoing] : remaining;
    const evaluate = createLineupEvaluator(field, run.layers, {
      goal,
      reserve: freeReserve,
      bannedCovenants: effectiveBans(run),
    });
    freeDeployment = {
      field,
      stats: evaluate(field).stats,
      preferenceScore: free.preferenceScore,
    };
    change = evaluate(selected.field, selected.reserve);
  }
  const explanation = explainLineupChange(change);
  advice.reasons.push(...explanation.reasons);
  advice.losses = explanation.losses;
  return {
    advice,
    field: selected.field,
    reserve: selected.reserve,
    stats: selected.evaluation.stats,
    freeDeployment,
  };
}
