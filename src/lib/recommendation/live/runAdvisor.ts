/** 局内招募入口：比较可执行的动作，输出建议，不修改玩家记录。 */
import {
  ALL_COVENANTS,
  BUILD_NAMES,
  OPERATORS,
  STRATEGIES,
  buildByName,
  operatorPrice,
  type Operator,
} from '../../../../data/index.ts';
import {covenantStats} from '../../plans/covenants.ts';
import {type Plan, type PlanOp} from '../../plans/model.ts';
import {createLineupEvaluator} from '../planning.ts';
import {createRunPreference, createValueContext} from './advisorEvaluation.ts';
import {
  evaluateRecruitAction,
  type RecruitActionContext,
} from './advisorRecruitActions.ts';
import {advisorRoundLimit, promotionRewardTier} from './advisorRules.ts';
import {
  createRecruitmentPool,
  deployedLineup,
  effectiveBans,
  eliteCopyCount,
  operatorsByName,
  planSlot,
  recruitPriceRange,
  reserveLineup,
  runLineupGoal,
} from './advisorState.ts';
import {explainStrategyTransition} from './advisorStrategy.ts';
import type {
  AdvisorRun,
  RecordedOperator,
  RecruitAdvice,
} from './advisorTypes.ts';
import {
  acquisitionCommandOpportunity,
  acquisitionValue,
  covenantProductionValue,
  purchaseMilestoneAdjustment,
  recurringValue,
  restCommandOpportunity,
  teamValue,
} from './advisorValue.ts';
// 保留已有入口，页面与外部调用不必随内部职责拆分调整路径。
export {recommendDeployments} from './advisorDeployments.ts';
export {
  MAX_RECORDED_EQUIPMENT,
  MAX_SHOP_CANDIDATES,
  advisorDeploymentLimit,
  createRecruitmentPool,
  deployedLineup,
  effectiveBans,
  eliteCopyCount,
  newAdvisorRun,
  operatorsByName,
  recruitPriceRange,
  reserveLineup,
  runLineupGoal,
  sanitizeAdvisorRun,
} from './advisorState.ts';
export type {
  AdviceBreakdown,
  AdvisorRun,
  DeploymentAdvice,
  OwnedEquipment,
  RecordedOperator,
  RecruitAdvice,
} from './advisorTypes.ts';
const STRATEGIES_BY_NAME = new Map(
  STRATEGIES.map((strategy) => [strategy.name, strategy]),
);
const OPERATOR_ORDER = new Map(
  OPERATORS.map((operator, index) => [operator.name, index]),
);
const EQUIPMENT_PAIRINGS = BUILD_NAMES.flatMap((name) => {
  const build = buildByName(name);
  return build
    ? (build.carries ?? []).map((operator) => ({
        operator,
        build: name,
        equipment: build.equipment,
      }))
    : [];
});
/** 策略只读取已建模的明确规则；通用经济、随机刷新等效果不虚构成干员强度。 */
function strategyAffinity(
  run: AdvisorRun,
  operator: Operator,
  elite: boolean,
): {
  score: number;
  reason: string;
} {
  const strategy = STRATEGIES_BY_NAME.get(run.strategy);
  if (!strategy) {
    return {score: 0, reason: ''};
  }
  if (
    ALL_COVENANTS.includes(strategy.category) &&
    !effectiveBans(run).has(strategy.category) &&
    operator.covenants.includes(strategy.category)
  ) {
    return {
      score: 8,
      reason: `符合${strategy.name}的${strategy.category}方向`,
    };
  }
  if (elite && strategy.category === '精锐') {
    return {score: 8, reason: `晋升精锐，契合${strategy.name}的精锐方向`};
  }
  return {score: 0, reason: ''};
}
function equipmentAffinity(
  run: AdvisorRun,
  operator: Operator,
): {
  score: number;
  reason: string;
} {
  // covenant 字段只描述变形同构体的组合结果，不是适配加成。此处只用预设里的核心装备搭配。
  // 已被其他干员占用的装备不同时分配给新人。
  const available = run.equipment.filter(
    (item) => !item.holder || item.holder === operator.name,
  );
  for (const pairing of EQUIPMENT_PAIRINGS) {
    if (pairing.operator !== operator.name) {
      continue;
    }
    const matching = available.find((item) =>
      pairing.equipment.includes(item.name),
    );
    if (matching) {
      return {
        score: 5,
        reason: `${matching.holder ? '已携带' : '仓库有'}${matching.name}，属于${pairing.build}预设的核心搭配`,
      };
    }
  }
  return {score: 0, reason: ''};
}
/**
 * 返回最多 limit 条建议。商店不为空时只比较实物候选，否则按当前本数找目标。
 * 用纯函数评估添加/晋升/逐一替换；所有动作仍由用户确认，函数没有写入副作用。
 */
export function recommendRecruits(
  run: AdvisorRun,
  limit = 5,
  savedPlans: readonly Plan[] = [],
): RecruitAdvice[] {
  const available = createRecruitmentPool(run),
    goal = runLineupGoal(run);
  // 禁用设置和持有记录矛盾时先让玩家修正，不能假定这些位置已经空出。
  if (run.operators.some((operator) => !available(operator.name))) {
    return [];
  }
  const lineup = deployedLineup(run).filter((slot) => available(slot.name));
  const reserve = reserveLineup(run).filter((slot) => available(slot.name));
  const preference = createRunPreference(run, savedPlans, lineup, reserve);
  const previousStats = covenantStats(
    lineup,
    run.layers,
    reserve,
    effectiveBans(run),
  );
  const evaluateLineup = createLineupEvaluator(lineup, run.layers, {
    goal,
    reserve,
    bannedCovenants: effectiveBans(run),
  });
  const valueContext = createValueContext(run);
  const baselineTeamValue = teamValue(lineup, reserve, valueContext);
  const owned = new Map(
    run.operators.map((operator) => [operator.name, operator]),
  );
  const candidates = (
    run.shop.length
      ? run.shop
          .map((name) => operatorsByName.get(name))
          .filter((operator): operator is Operator => !!operator)
      : // Pith 指令赠送的辅助干员不在普通商店池，仍可在持有记录中手动录入。
        OPERATORS.filter(
          (operator) =>
            operator.stars > 0 &&
            operator.tier <= run.level &&
            !owned.get(operator.name)?.elite,
        )
  ).filter(
    (operator) =>
      available(operator.name) &&
      (run.candidateSource !== 'promotion' ||
        (operator.stars > 0 &&
          operator.tier === promotionRewardTier(run.level))),
  );
  // 晋升奖励来自实际三选一，不在未录入候选时凭空生成可选卡。
  if (run.candidateSource === 'promotion' && !run.shop.length) {
    return [];
  }
  const evaluationContext: RecruitEvaluationContext = {
    run,
    lineup,
    reserve,
    previousStats,
    goal,
    preference,
    evaluateLineup,
    valueContext,
    baselineTeamValue,
    owned,
  };
  return candidates
    .map((operator) => evaluateRecruitCandidate(operator, evaluationContext))
    .sort(compareRecruitAdvice)
    .slice(0, Math.max(0, limit));
}
interface RecruitEvaluationContext extends RecruitActionContext {
  owned: ReadonlyMap<string, RecordedOperator>;
}
/** 单个候选依次经过动作搜索、收益解释、预算限制；仅在相同规则收益的动作与候选之间比较偏好。 */
function evaluateRecruitCandidate(
  operator: Operator,
  evaluationContext: RecruitEvaluationContext,
): RecruitAdvice {
  const {run, lineup, previousStats, goal, preference, valueContext, owned} =
    evaluationContext;
  const build = goal ? buildByName(goal.covenant) : undefined;
  const existing = owned.get(operator.name);
  const advice: RecruitAdvice = {
    operator,
    kind: 'reserve',
    label: '备选',
    score: 0,
    fitScore: 0,
    preferenceScore: 0,
    breakdown: {
      lineup: 0,
      production: 0,
      acquisition: 0,
      collection: 0,
      fit: 0,
      economy: 0,
    },
    estimatedPrice: null,
    affordable: null,
    reasons: [],
    losses: [],
    replace: '',
  };
  if (existing?.elite) {
    return {
      ...advice,
      kind: 'skip' as const,
      label: '暂不追',
      score: -1000,
      breakdown: {...advice.breakdown, collection: -1000},
      reasons: ['已有精锐，本工具不再追同名合成'],
    };
  }
  const promotes =
    !!existing && existing.copies + 1 >= eliteCopyCount(operator.name);
  const acquisition = acquisitionValue(
    operator,
    promotes,
    previousStats,
    valueContext,
  );
  const action = evaluateRecruitAction(
    operator,
    existing,
    promotes,
    acquisition,
    advice,
    evaluationContext,
  );
  const resultingStats = action.stats;
  if (goal && advice.score > 0) {
    const previous =
      previousStats.find((stat) => stat.name === goal.covenant)?.count ?? 0;
    const current =
      resultingStats.find((stat) => stat.name === goal.covenant)?.count ?? 0;
    if (current > previous && previous < goal.target) {
      advice.reasons.unshift(
        `主盟约${goal.covenant} ${previous}→${current} / ${goal.target}，优先补主轴`,
      );
    } else if (build?.carries?.includes(operator.name)) {
      advice.reasons.unshift(
        `${goal.covenant}预设的核心输出${existing ? '，继续提升精锐' : '，可替换过渡位'}`,
      );
    } else if (
      build?.addons?.some((covenant) => operator.covenants.includes(covenant))
    ) {
      advice.reasons.push(`可补${goal.covenant}主轴的附加盟约配合`);
    }
  }
  const covenantProduction = covenantProductionValue(
    resultingStats,
    valueContext,
  );
  if (
    covenantProduction.score >
    covenantProductionValue(previousStats, valueContext).score
  ) {
    advice.reasons.push(...covenantProduction.reasons);
  }
  advice.breakdown.acquisition = acquisition.score;
  advice.score += acquisition.score;
  advice.reasons.push(...acquisition.reasons);
  const willDeploy =
    existing?.deployed || advice.kind === 'deploy' || advice.kind === 'replace';
  const candidateSlot: PlanOp = {
    name: operator.name,
    elite: promotes,
    eq: existing ? planSlot(run, existing).eq : [],
    core: false,
    alt: [],
  };
  const finalField = action.field;
  const finalReserve = action.reserve;
  const transition = explainStrategyTransition(lineup, finalField, {
    strategy: run.strategy,
    format: run.format,
    inactiveCovenants: effectiveBans(run),
  });
  advice.reasons.push(...transition.reasons);
  advice.losses.push(...transition.losses);
  const preferred = preference(finalField, finalReserve);
  advice.preferenceScore = preferred.preference;
  advice.reasons.push(...preferred.reasons);
  advice.losses.push(...preferred.losses);
  const milestones = purchaseMilestoneAdjustment(
    acquisition,
    previousStats,
    finalField,
    finalReserve,
    valueContext,
  );
  advice.reasons.push(...milestones.reasons);
  const commandOpportunity = restCommandOpportunity(
    finalField,
    finalReserve,
    valueContext,
  );
  if (commandOpportunity.target === operator.name) {
    advice.reasons.push(...commandOpportunity.reasons);
  }
  const acquisitionOpportunity = acquisitionCommandOpportunity(
    finalField,
    finalReserve,
    valueContext,
  );
  if (acquisitionOpportunity.target === operator.name) {
    advice.reasons.push(...acquisitionOpportunity.reasons);
  }
  const production = recurringValue(
    candidateSlot,
    !!willDeploy,
    resultingStats,
    valueContext,
    {
      field: finalField,
      reserve: finalReserve,
    },
  );
  if (!existing || promotes) {
    advice.reasons.push(...production.reasons);
  } else if (production.score > 0) {
    advice.reasons.push('现有干员已提供持续收益，买入对子不会重复增加这份产出');
  }
  if (
    advice.kind === 'reserve' &&
    !existing &&
    advice.score > 0 &&
    (acquisition.score > 0 || production.score > 0)
  ) {
    advice.label = acquisition.score > 0 ? '获得收益' : '整备区生产';
    advice.reasons = advice.reasons.filter(
      (reason) => reason !== '上场已满，替换后暂无明确盟约收益',
    );
    advice.reasons.push('无需挤掉当前上场位，按获得或整备区特质评估');
  }
  if (promotes) {
    advice.reasons.push(
      '晋升按精锐获得时触发，不重复计算第三张基础特质；另有调度中心高一阶（最高6阶）免费三选一，未假定奖励人选',
    );
  }
  if (advice.replace) {
    advice.reasons.push(
      '换下位的精锐、装备与持续生产投入已计入机会成本；未模拟站位和实战伤害',
    );
  }
  if (run.candidateSource === 'promotion') {
    advice.reasons.push(
      `已录晋升奖励：免费选择，奖励等阶为${promotionRewardTier(run.level)}；不计算抽中概率`,
    );
  }
  applyPurchaseBudget(run, operator, advice);
  const strategy = strategyAffinity(run, operator, promotes);
  const equipment = equipmentAffinity(run, operator);
  advice.fitScore = strategy.score + equipment.score;
  advice.breakdown.fit = advice.fitScore;
  if (strategy.reason) {
    advice.reasons.push(strategy.reason);
  }
  if (equipment.reason) {
    advice.reasons.push(equipment.reason);
  }
  if (existing && !existing.deployed) {
    advice.reasons.push('已有整备区干员，也可先直接上场，无需重复购买');
  }
  if (!advice.reasons.length) {
    advice.reasons.push(`先补上场人数 · ${operator.type}，可点头像查看特质`);
  }
  return advice;
}
/** 预算优先于路线偏好；未知折扣保持区间，不转成可购买承诺。 */
function applyPurchaseBudget(
  run: AdvisorRun,
  operator: Operator,
  advice: RecruitAdvice,
): void {
  const price = recruitPriceRange(run, operator);
  const lastRound = advisorRoundLimit(run.format);
  advice.estimatedPrice = price.min === price.max ? price.max : null;
  advice.affordable =
    run.funds === null
      ? null
      : run.funds < price.min
        ? false
        : run.funds >= price.max
          ? true
          : null;
  if (price.min !== price.max) {
    advice.reasons.push(
      `价格待核：${price.min}—${price.max}资金，折扣/本轮首购状态未知`,
    );
  }
  const reserveFloor = STRATEGIES_BY_NAME.get(run.strategy)?.advisor
    ?.reserveFundsFloor;
  if (advice.affordable === false) {
    advice.label = '资金不足';
    advice.losses.push(
      `至少需要${price.min}资金，当前仅${run.funds}；仍可手动记录已获得的奖励牌`,
    );
  } else if (
    reserveFloor &&
    run.candidateSource !== 'promotion' &&
    lastRound !== null &&
    (run.round === null || run.round < lastRound) &&
    run.funds !== null &&
    run.funds >= reserveFloor.minFunds &&
    run.funds - price.min < reserveFloor.minFunds
  ) {
    advice.breakdown.economy = -reserveFloor.penalty;
    advice.score -= reserveFloor.penalty;
    advice.losses.push(reserveFloor.lossReason);
  }
}
/** 同收益才比较已保存路线和适配，最后保留原有价序与图鉴顺序。 */
function compareRecruitAdvice(
  first: RecruitAdvice,
  second: RecruitAdvice,
): number {
  return (
    Number(first.affordable === false) - Number(second.affordable === false) ||
    second.score - first.score ||
    second.preferenceScore - first.preferenceScore ||
    second.fitScore - first.fitScore ||
    operatorPrice(first.operator) - operatorPrice(second.operator) ||
    (OPERATOR_ORDER.get(first.operator.name) ?? 0) -
      (OPERATOR_ORDER.get(second.operator.name) ?? 0)
  );
}
