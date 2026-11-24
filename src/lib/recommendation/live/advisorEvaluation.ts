/** 招募与免费调阵共用的评估输入及结果说明。 */
import { OPERATORS } from '../../../../data/index.ts';
import type { Plan,PlanOp } from '../../plans/model.ts';
import type { LineupEvaluation } from '../planning.ts';
import { createAdvisorPreferenceEvaluator } from './advisorPreferences.ts';
import { advisorRoundLimit } from './advisorRules.ts';
import { createRecruitmentPool,effectiveBans } from './advisorState.ts';
import type { AdvisorRun } from './advisorTypes.ts';
import type { ValueContext } from './advisorValue.ts';
/** 一次评估使用同一份真实局面；未知字段原样传递，不从推测动作回填。 */
export function createValueContext(run: AdvisorRun): ValueContext {
  return {
    round: run.round,
    acquisitionsThisRound: run.acquisitionsThisRound,
    totalRounds: advisorRoundLimit(run.format),
    layers: run.layers,
    level: run.level,
    strategy: run.strategy,
    commandAvailable: run.commandAvailable,
    frontTargets: run.frontTargets,
    inactiveCovenants: effectiveBans(run),
  };
}
/** 在动作搜索前锚定保存路线，不能用假设新持有的候选自证偏好。 */
export function createRunPreference(
  run: AdvisorRun,
  plans: readonly Plan[],
  field: readonly PlanOp[],
  reserve: readonly PlanOp[],
) {
  const available = createRecruitmentPool(run);
  const unavailableNames = new Set(
    OPERATORS.filter((operator) => !available(operator.name)).map(
      (operator) => operator.name,
    ),
  );
  return createAdvisorPreferenceEvaluator(plans, {
    field,
    reserve,
    mainCovenant: run.mainCovenant,
    strategy: run.strategy,
    round: run.round,
    unavailableNames,
  });
}
/** 仅负责局内页面的文案；盟约评分和变化判断来自共用评估器。 */
export function explainLineupChange(evaluation: LineupEvaluation): {
  reasons: string[];
  losses: string[];
} {
  const reasons: string[] = [],
    losses: string[] = [];
  for (const { covenant, kind, before, after } of evaluation.changes) {
    if (kind === 'off') {
      losses.push(`${covenant}失效`);
    } else if (kind === 'weaken') {
      losses.push(`${covenant}失去强化`);
    } else if (after) {
      if (kind === 'on') {
        reasons.push(`激活${covenant}（${after.count}人）`);
      }
      if (kind === 'bonus' || (kind === 'on' && after.bonusActive)) {
        reasons.push(
          `${covenant}达到${after.bonusNeed ? `${after.bonusNeed}人` : `${after.bonusLayers}层`}强化`,
        );
      }
      if (kind === 'up') {
        reasons.push(
          `${covenant} ${before?.count ?? 0}→${after.count}，距${after.active ? '人数强化' : '激活'}差${after.next}人`,
        );
      }
    }
  }
  return { reasons, losses };
}
