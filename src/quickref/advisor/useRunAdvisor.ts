import {computed, readonly} from 'vue';
import {plans as savedPlans} from '../planStore.ts';
import {
  clearMovedFrontTargets,
  supportsFrontTarget,
} from '../../lib/recommendation/live/advisorPosition.ts';
import {
  ADVISOR_MODES,
  ADVISOR_FORMATS,
  advisorRoundLimit,
  promotionRewardTier,
  type AdvisorFormat,
  type AdvisorMode,
  type CandidateSource,
} from '../../lib/recommendation/live/advisorRules.ts';
import {createAdvisorSession} from './advisorSession.ts';
import {createAdvisorEquipmentActions} from './advisorEquipmentActions.ts';
import {
  ALL_COVENANTS,
  SEASON_META,
  STRATEGIES,
  isCoreCovenant,
} from '../../../data/index.ts';
import {covenantStats, MAX_LAYERS, usesLayers} from '../../lib/plans/core.ts';
import {
  advisorDeploymentLimit,
  deployedLineup,
  eliteCopyCount,
  MAX_SHOP_CANDIDATES,
  newAdvisorRun,
  operatorsByName,
  createRecruitmentPool,
  effectiveBans,
  reserveLineup,
  runLineupGoal,
} from '../../lib/recommendation/live/advisorState.ts';
import {type RecordedOperator} from '../../lib/recommendation/live/advisorTypes.ts';
import {
  recommendRecruits,
  recommendDeployments,
} from '../../lib/recommendation/index.ts';
const session = createAdvisorSession();
const {run, change, showNotice, undo} = session;
const strategyNames = new Set(STRATEGIES.map((strategy) => strategy.name));
const deploymentLimit = computed(() => advisorDeploymentLimit(run.value));
const lineup = computed(() => deployedLineup(run.value));
const covenants = computed(() =>
  covenantStats(
    lineup.value,
    run.value.layers,
    reserveLineup(run.value),
    effectiveBans(run.value),
  ),
);
const goal = computed(() => runLineupGoal(run.value));
const unavailableNames = computed(() => {
  const available = createRecruitmentPool(run.value);
  return [...operatorsByName.keys()].filter((name) => !available(name));
});
const poolConflicts = computed(() =>
  run.value.operators
    .filter((operator) => unavailableNames.value.includes(operator.name))
    .map((operator) => operator.name),
);
// 录入商店后逐张排序全部候选，商店列表即建议列表；未录入时只列出前几名目标。
const rankedRecommendations = computed(() =>
  recommendRecruits(run.value, operatorsByName.size, savedPlans),
);
const recommendations = computed(() =>
  rankedRecommendations.value.slice(
    0,
    run.value.shop.length ? MAX_SHOP_CANDIDATES : 5,
  ),
);
const deploymentRecommendations = computed(() =>
  recommendDeployments(run.value, 3, savedPlans),
);
const deployed = computed(() =>
  run.value.operators.filter((operator) => operator.deployed),
);
const reserve = computed(() =>
  run.value.operators.filter((operator) => !operator.deployed),
);
/** 局内工具独立单例；动作立即保存，离开页面无需依赖计时器或页面退出事件。 */
export function useRunAdvisor() {
  const equipmentActions = createAdvisorEquipmentActions(change);
  /** 录入一张有效干员；空位默认上场，满员或指定 reserve 时入整备区；达到张数后自动晋升。 */
  function recruit(
    name: string,
    destination: 'auto' | 'reserve' = 'auto',
    confirmedAcquisition = false,
  ): boolean {
    if (!operatorsByName.has(name)) {
      return false;
    }
    return change(`已记录${name}`, (draft) => {
      if (!createRecruitmentPool(draft)(name)) {
        return `${name}不在本局招募池，请先调整禁用设置`;
      }
      const existing = draft.operators.find(
        (operator) => operator.name === name,
      );
      if (existing?.elite) {
        return `${name}已是精锐，无需再记录同名合成`;
      }
      // 计数来自游戏显示；普通购买、自身及晋升的计数细节未完全核实，不自动累加。
      if (confirmedAcquisition) {
        draft.acquisitionsThisRound = null;
      }
      if (existing) {
        existing.copies++;
        if (existing.copies >= eliteCopyCount(name)) {
          existing.elite = true;
          existing.copies = 1;
        }
      } else {
        draft.operators.push({
          name,
          copies: 1,
          elite: false,
          deployed:
            destination === 'auto' &&
            draft.operators.filter((operator) => operator.deployed).length <
              advisorDeploymentLimit(draft),
        });
      }
      // 手工补录其他持有干员，不等于选择眼前奖励；不得丢弃待选名单。
      if (draft.shop.includes(name)) {
        draft.shop =
          draft.candidateSource === 'promotion'
            ? []
            : draft.shop.filter((candidate) => candidate !== name);
        if (draft.candidateSource === 'promotion') {
          draft.candidateSource = 'shop';
        }
      }
    });
  }
  /** 商店卡与推荐卡共用同一落位决策；明确手工录入仍可使用 recruit 指定位置。 */
  function candidateError(name: string): string {
    if (run.value.candidateSource !== 'promotion') {
      return '';
    }
    if (!run.value.shop.includes(name)) {
      return '请先录入眼前的晋升奖励候选';
    }
    const operator = operatorsByName.get(name);
    if (
      !operator ||
      operator.stars <= 0 ||
      operator.tier !== promotionRewardTier(run.value.level)
    ) {
      return `当前晋升奖励应为${promotionRewardTier(run.value.level)}阶，请核对调度等级或候选来源`;
    }
    return '';
  }
  function recruitCandidate(name: string): boolean {
    const error = candidateError(name);
    if (error) {
      showNotice(error);
      return false;
    }
    const advice = rankedRecommendations.value.find(
      (item) => item.operator.name === name,
    );
    return recruit(
      name,
      advice?.kind === 'reserve' || advice?.kind === 'replace'
        ? 'reserve'
        : 'auto',
      true,
    );
  }
  function editOperator(
    name: string,
    message: string,
    edit: (operator: RecordedOperator) => void,
  ): void {
    if (!run.value.operators.some((operator) => operator.name === name)) {
      return;
    }
    change(message, (draft) => {
      const operator = draft.operators.find((item) => item.name === name);
      if (operator) {
        edit(operator);
      }
    });
  }
  /** 切换上场状态；显式替换不受空位影响，满员时必须选择换下对象，装备随原持有者保留。 */
  function setDeployment(name: string, active: boolean, replace = ''): boolean {
    return change(`${name}${active ? '已上场' : '已移入整备区'}`, (draft) => {
      const operator = draft.operators.find((item) => item.name === name);
      if (!operator) {
        return '未找到这名干员';
      }
      const onField = draft.operators.filter((item) => item.deployed);
      const moved = new Set<string>();
      if (operator.deployed !== active) {
        moved.add(name);
      }
      if (
        active &&
        !operator.deployed &&
        (replace || onField.length >= advisorDeploymentLimit(draft))
      ) {
        const outgoing = onField.find((item) => item.name === replace);
        if (!outgoing) {
          return replace
            ? '要换下的干员已不在场上，请重新选择'
            : `场上已有${advisorDeploymentLimit(draft)}名，请先选择要换下的干员`;
        }
        outgoing.deployed = false;
        moved.add(outgoing.name);
      }
      operator.deployed = active;
      draft.frontTargets = clearMovedFrontTargets(draft.frontTargets, moved);
    });
  }
  /** 只记录当前场上已确认的身前目标；null 清除为未知，空字符串确认无人。 */
  function setFrontTarget(name: string, target: string | null): boolean {
    return change('已更新身前一格记录', (draft) => {
      const field = new Set(
        draft.operators
          .filter((item) => item.deployed)
          .map((item) => item.name),
      );
      if (!field.has(name) || !supportsFrontTarget(name)) {
        return '请为场上的对应休整产层干员记录身前目标';
      }
      if (
        target !== null &&
        target !== '' &&
        (target === name || !field.has(target))
      ) {
        return '请选择其他已上场干员，或确认身前无人';
      }
      if (target === null) {
        delete draft.frontTargets[name];
      } else {
        draft.frontTargets[name] = target;
      }
    });
  }
  /** 删除持有记录，装备归还仓库，避免误删随身装备。 */
  function removeOperator(name: string): void {
    change(`已移除${name}，携带装备退回仓库`, (draft) => {
      draft.operators = draft.operators.filter(
        (operator) => operator.name !== name,
      );
      draft.frontTargets = clearMovedFrontTargets(
        draft.frontTargets,
        new Set([name]),
      );
      draft.equipment.forEach((item) => {
        if (item.holder === name) {
          item.holder = '';
        }
      });
    });
  }
  function setCopies(name: string, copies: number): void {
    if (!Number.isFinite(copies)) {
      return;
    }
    editOperator(name, `已更新${name}张数`, (operator) => {
      if (!operator.elite) {
        operator.copies = Math.max(
          1,
          Math.min(eliteCopyCount(name) - 1, Math.round(copies)),
        );
      }
    });
  }
  function setElite(name: string, elite: boolean): void {
    editOperator(name, `已更新${name}精锐状态`, (operator) => {
      operator.elite = elite;
      operator.copies = 1;
    });
  }
  function setMode(mode: AdvisorMode): void {
    if (
      !ADVISOR_MODES.some((item) => item.id === mode) ||
      (run.value.format === 'fast' && mode !== 'restricted')
    ) {
      return;
    }
    change('已更新模式；原持有记录保留，请核对冲突', (draft) => {
      draft.mode = mode;
    });
  }
  function setCandidateSource(source: CandidateSource): void {
    if (source !== 'shop' && source !== 'promotion') {
      return;
    }
    change('已更新候选来源；请核对当前卡牌是否属于该来源', (draft) => {
      draft.candidateSource = source;
    });
  }
  function setLevel(level: number): void {
    if (
      !Number.isInteger(level) ||
      level < 1 ||
      level > 6 ||
      level === run.value.level
    ) {
      return;
    }
    change(`当前${level}本`, (draft) => {
      draft.level = level;
    });
  }
  /** 仅补录游戏中已使用的消耗品状态；不删除仓库装备，也不推断付款。 */
  function setPersonnelDocumentUsed(used: boolean): boolean {
    if (used === run.value.personnelDocumentUsed) {
      return true;
    }
    return change('已更新部署上限', (draft) => {
      const limit = advisorDeploymentLimit({personnelDocumentUsed: used});
      if (
        draft.operators.filter((operator) => operator.deployed).length > limit
      ) {
        return `请先将场上人数降至${limit}名，再取消文档记录`;
      }
      draft.personnelDocumentUsed = used;
    });
  }
  /** 留空表示未知；这些是手动快照，不从购买记录推测回合或自动扣款。 */
  function setFormat(format: AdvisorFormat): void {
    if (
      !ADVISOR_FORMATS.some((item) => item.id === format) ||
      format === run.value.format
    ) {
      return;
    }
    change('已更新对局长度；请核对回合与持有记录', (draft) => {
      draft.format = format;
      if (format === 'fast') {
        draft.mode = 'restricted';
      }
      if (
        draft.round !== null &&
        draft.round >
          (advisorRoundLimit(format) ?? SEASON_META.roundLimits.standard)
      ) {
        draft.round = null;
      }
      draft.commandAvailable = null;
      draft.acquisitionsThisRound = null;
    });
  }
  function setRound(round: number | null): void {
    const limit =
      advisorRoundLimit(run.value.format) ?? SEASON_META.roundLimits.standard;
    if (
      round !== null &&
      (!Number.isInteger(round) || round < 1 || round > limit)
    ) {
      showNotice(`回合需为1至${limit}的整数，或留空表示未知`);
      return;
    }
    if (round === run.value.round) {
      return;
    }
    change('已更新当前回合，主动指令可用性待确认', (draft) => {
      draft.round = round;
      draft.commandAvailable = null;
      draft.acquisitionsThisRound = null;
    });
  }
  function setAcquisitionsThisRound(count: number | null): void {
    if (
      count !== null &&
      (!Number.isInteger(count) || count < 0 || count > 999)
    ) {
      showNotice('获得人数需为0至999的整数，或留空表示未知');
      return;
    }
    if (count === run.value.acquisitionsThisRound) {
      return;
    }
    change('已更新本轮获得人数', (draft) => {
      draft.acquisitionsThisRound = count;
    });
  }
  function setFunds(funds: number | null): void {
    if (
      funds !== null &&
      (!Number.isInteger(funds) || funds < 0 || funds > 999)
    ) {
      showNotice('资金需为0至999的整数，或留空表示未知');
      return;
    }
    if (funds === run.value.funds) {
      return;
    }
    change('已更新可用资金', (draft) => {
      draft.funds = funds;
    });
  }
  function setLayer(name: string, layers: number | null): void {
    if (!ALL_COVENANTS.includes(name) || !usesLayers(name)) {
      return;
    }
    if (
      layers !== null &&
      (!Number.isInteger(layers) || layers < 0 || layers > MAX_LAYERS)
    ) {
      showNotice(`层数需为0至${MAX_LAYERS}的整数，或留空表示未知`);
      return;
    }
    if (
      layers === null
        ? !Object.hasOwn(run.value.layers, name)
        : run.value.layers[name] === layers
    ) {
      return;
    }
    change(`已更新${name}层数`, (draft) => {
      if (layers === null) {
        delete draft.layers[name];
      } else {
        draft.layers[name] = layers;
      }
    });
  }
  /** 仅记录用户确认的可用性，不自动消耗指令或推算下一次冷却。 */
  function setCommandAvailable(available: boolean | null): void {
    if (
      (available !== null && typeof available !== 'boolean') ||
      available === run.value.commandAvailable
    ) {
      return;
    }
    change('已更新主动指令可用性', (draft) => {
      draft.commandAvailable = available;
    });
  }
  function setStrategy(name: string): void {
    if (name && !strategyNames.has(name)) {
      return;
    }
    if (name === run.value.strategy) {
      return;
    }
    change(name ? `已选策略${name}` : '已清除策略', (draft) => {
      draft.strategy = name;
      draft.commandAvailable = null;
    });
  }
  /** 手动选主盟约；空值恢复自动，mixed 保持混搭；切换方向同时恢复默认人数目标。 */
  function setMainCovenant(name: string): void {
    if (
      (name && name !== 'mixed' && !isCoreCovenant(name)) ||
      run.value.bannedCovenants.includes(name)
    ) {
      return;
    }
    change('已更新本局主轴', (draft) => {
      draft.mainCovenant = name;
      draft.mainTarget = 0;
    });
  }
  /** 仅改变推荐目标，不改变游戏盟约的真实激活与强化条件。 */
  function setMainTarget(target: number): void {
    if (target !== 0 && target !== 3 && target !== 6) {
      return;
    }
    change('已更新主轴目标', (draft) => {
      draft.mainTarget = target;
    });
  }
  /** 按开局简报记录缺席盟约；保留持有记录并提示冲突，不擅自出售或删除。 */
  function toggleBannedCovenant(name: string): void {
    if (!ALL_COVENANTS.includes(name)) {
      return;
    }
    change('已更新本局禁用盟约', (draft) => {
      draft.bannedCovenants = draft.bannedCovenants.includes(name)
        ? draft.bannedCovenants.filter((item) => item !== name)
        : [...draft.bannedCovenants, name];
      if (draft.bannedCovenants.includes(draft.mainCovenant)) {
        draft.mainCovenant = '';
        draft.mainTarget = 0;
      }
    });
  }
  /** 单独排除禁用干员或未选入本局的可选干员；再次选择可恢复。 */
  function toggleExcludedOperator(name: string): void {
    if (!operatorsByName.has(name)) {
      return;
    }
    change('已更新本局干员池', (draft) => {
      draft.excludedOperators = draft.excludedOperators.includes(name)
        ? draft.excludedOperators.filter((item) => item !== name)
        : [...draft.excludedOperators, name];
    });
  }
  /** 添加当前商店候选；重复、无效或已满时返回 false，不改变持有阵容。 */
  function addShopCandidate(name: string): boolean {
    if (!operatorsByName.has(name) || run.value.shop.includes(name)) {
      return false;
    }
    return change(`已将${name}加入本次商店`, (draft) => {
      if (!createRecruitmentPool(draft)(name)) {
        return `${name}不在本局招募池，请先调整禁用设置`;
      }
      if (
        draft.candidateSource === 'promotion' &&
        operatorsByName.get(name)?.tier !== promotionRewardTier(draft.level)
      ) {
        return `当前晋升奖励应为${promotionRewardTier(draft.level)}阶，请核对调度等级或候选来源`;
      }
      if (draft.candidateSource === 'promotion' && draft.shop.length >= 3) {
        return '晋升奖励最多录入眼前三名候选';
      }
      if (draft.shop.length >= MAX_SHOP_CANDIDATES) {
        return `最多比较${MAX_SHOP_CANDIDATES}名候选`;
      }
      draft.shop.push(name);
    });
  }
  function removeShopCandidate(name: string): void {
    change('已更新商店候选', (draft) => {
      draft.shop = draft.shop.filter((candidate) => candidate !== name);
    });
  }
  function clearShop(): void {
    change('已清空商店，恢复目标推荐', (draft) => {
      draft.shop = [];
      draft.candidateSource = 'shop';
    });
  }
  /** 清空本局并立即保存；上一局可用 undo 恢复，直到下一次编辑。 */
  function reset(): void {
    change('已新开一局，可撤销恢复上一局', (draft) => {
      Object.assign(draft, newAdvisorRun());
    });
  }
  return {
    run: readonly(run),
    deployed,
    reserve,
    deploymentLimit,
    covenants,
    recommendations,
    deploymentRecommendations,
    goal,
    unavailableNames,
    poolConflicts,
    notice: session.notice,
    saveFailed: session.saveFailed,
    canUndo: session.canUndo,
    recruit,
    recruitCandidate,
    candidateError,
    setDeployment,
    setFrontTarget,
    removeOperator,
    setCopies,
    setElite,
    setMode,
    setCandidateSource,
    setLevel,
    setPersonnelDocumentUsed,
    setFormat,
    setRound,
    setAcquisitionsThisRound,
    setFunds,
    setLayer,
    setStrategy,
    setCommandAvailable,
    setMainCovenant,
    setMainTarget,
    toggleBannedCovenant,
    toggleExcludedOperator,
    ...equipmentActions,
    addShopCandidate,
    removeShopCandidate,
    clearShop,
    reset,
    undo,
  };
}
