/** 免费调阵搜索；不触发获得奖励，也不写入持有记录。 */
import { createLineupEvaluator, type Plan } from './planner.ts';
import {
  advisorDeploymentLimit,
  createRecruitmentPool,
  deployedLineup,
  reserveLineup,
  runLineupGoal,
  effectiveBans,
} from './advisorState.ts';
import type { AdvisorRun, DeploymentAdvice } from './advisorTypes.ts';
import {
  createRunPreference,
  createValueContext,
  explainLineupChange,
} from './advisorEvaluation.ts';
import { explainStrategyTransition } from './advisorStrategy.ts';
import { teamValue } from './advisorValue.ts';
import type { AdvisorPreferenceEvaluator } from './advisorPreferences.ts';
/** 已持有整备区干员的免费调阵，独立于买牌，不触发获得/合成奖励。 */
export function recommendDeployments(
  run: AdvisorRun,
  limit = 3,
  savedPlans: readonly Plan[] = [],
): DeploymentAdvice[] {
  const available = createRecruitmentPool(run);
  if (run.operators.some((operator) => !available(operator.name))) {
    return [];
  }
  const lineup = deployedLineup(run),
    reserve = reserveLineup(run);
  const preference = createRunPreference(run, savedPlans, lineup, reserve);
  return evaluateDeployments(run, limit, preference);
}
/** 买牌内部沿用购前已锚定的路线；不让假设新持有的候选反过来创建偏好。 */
export function evaluateDeployments(
  run: AdvisorRun,
  limit: number,
  preference: AdvisorPreferenceEvaluator,
): DeploymentAdvice[] {
  const lineup = deployedLineup(run),
    reserve = reserveLineup(run);
  const context = createValueContext(run);
  const evaluate = createLineupEvaluator(lineup, run.layers, {
    goal: runLineupGoal(run),
    reserve,
    bannedCovenants: effectiveBans(run),
  });
  const oldValue = teamValue(lineup, reserve, context);
  return reserve
    .flatMap((candidate) => {
      // 有空位也可能需要换人（如独行只能保留一人），不能只搜索补位。
      // 补位先列出，收益相同时保留现有成员，避免无意义挪动。
      const choices = [
        ...(lineup.length < advisorDeploymentLimit(run) ? [-1] : []),
        ...lineup.map((_, index) => index),
      ];
      const options = choices
        .map((index) => {
          const next = [...lineup],
            bench = reserve.filter((slot) => slot.name !== candidate.name);
          const outgoing = index < 0 ? null : lineup[index];
          if (outgoing) {
            next[index] = candidate;
            bench.push(outgoing);
          } else {
            next.push(candidate);
          }
          const evaluation = evaluate(next, bench),
            explanation = explainLineupChange(evaluation);
          const production = teamValue(next, bench, context) - oldValue;
          const score = evaluation.score + production + (outgoing ? 0 : 10);
          if (outgoing && !evaluation.improves && production <= 0.001) {
            return null;
          }
          const preferred = preference(next, bench);
          const transition = explainStrategyTransition(lineup, next, {
            strategy: run.strategy,
            format: run.format,
            inactiveCovenants: effectiveBans(run),
          });
          return {
            name: candidate.name,
            replace: outgoing?.name ?? '',
            score,
            preferenceScore: preferred.preference,
            breakdown: { lineup: evaluation.score, production, fill: outgoing ? 0 : 10 },
            reasons: [
              '已持有，无需再次购买；不重复计算获得时奖励',
              ...explanation.reasons,
              ...transition.reasons,
              ...preferred.reasons,
              ...(production > 0 ? ['上场后的持续收益或现有精锐装备投入优于当前配置'] : []),
            ],
            losses: [...explanation.losses, ...transition.losses, ...preferred.losses],
          };
        })
        .filter((item): item is DeploymentAdvice => item !== null && item.score > 0.001)
        .sort((a, b) => b.score - a.score || b.preferenceScore - a.preferenceScore);
      return options.slice(0, 1);
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.preferenceScore - a.preferenceScore ||
        a.name.localeCompare(b.name, 'zh-CN'),
    )
    .slice(0, Math.max(0, limit));
}
