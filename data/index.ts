/**
 * 数据入口：从当前赛季定义导出各数据表，并提供按名称查找、按盟约筛选与规则衍生索引。
 * 页面代码只从这里 import，不直接引用单个赛季数据文件。
 */
import {CURRENT_SEASON} from './season.ts';
import {SEASONS, getSeason} from './seasons/registry.ts';
import type {
  Bounty,
  Build,
  BuildField,
  CombatRole,
  CombatRoleMeta,
  CoreBuild,
  Covenant,
  CreditMilestone,
  CycleReward,
  Difficulty,
  DispatchLevel,
  EnemyTerm,
  Equipment,
  EquipmentCombo,
  HeadcountBreakpoint,
  LayerBreakpoint,
  Leader,
  LeaderBattlefield,
  LeaderMapConfig,
  MixedBuild,
  MovementBranches,
  Operator,
  OperatorSellMechanics,
  OwnOperatorBonus,
  SeasonMeta,
  SoloLevel,
  Strategy,
  TierStats,
  TrainingType,
} from './types.ts';

export type * from './types.ts';
export {SEASONS, getSeason};

const byName = <T extends {readonly name: string}>(
  list: readonly T[],
): Readonly<Record<string, T>> =>
  Object.fromEntries(list.map((item) => [item.name, item]));

export const SEASON_META: SeasonMeta = CURRENT_SEASON.meta;
export const PINYIN_OVERRIDES: Readonly<Record<string, readonly string[]>> =
  SEASON_META.pinyinOverrides;
export const SHARE_OPERATOR_IDS: readonly number[] =
  SEASON_META.shareOperatorIds;

export const OPERATORS: readonly Operator[] = CURRENT_SEASON.operators;
/** 自选与替补按身份单列，固定商店、阵容推荐及分享编码只使用 OPERATORS。 */
export const ADDITIONAL_OPERATORS = CURRENT_SEASON.additionalOperators ?? [];
export const SELECTION_LIMITS = CURRENT_SEASON.selectionLimits ?? [];
export const OPERATOR_TYPES: readonly string[] =
  CURRENT_SEASON.rules.operatorTypes;
export const OPERATOR_TRIGGERS: readonly (readonly [
  label: string,
  tags: readonly string[],
])[] = CURRENT_SEASON.rules.operatorTriggers;

export const COMBAT_ROLES: readonly CombatRoleMeta[] =
  CURRENT_SEASON.rules.combatRoles;
export const COMBAT_ROLE_LABELS: readonly CombatRole[] = COMBAT_ROLES.map(
  (role) => role.label,
);
export const COMBAT_ROLE_IDS: Readonly<Record<string, CombatRole>> =
  Object.fromEntries(COMBAT_ROLES.map((role) => [role.id, role.label]));

export function rolesForTraining(trainingName: string): CombatRole[] {
  return COMBAT_ROLES.filter((role) =>
    role.trainingTypes?.includes(trainingName),
  ).map((role) => role.label);
}

/** 返回该干员在指定赛季精锐状态下已解锁的职能。 */
export function operatorRolesAtElite(
  operator: Operator,
  elite: boolean,
): readonly CombatRole[] {
  const roles = operator.roles ?? [];
  const eliteOnly = operator.eliteOnlyRoles;
  return elite || !eliteOnly?.length
    ? roles
    : roles.filter((role) => !eliteOnly.includes(role));
}

export function operatorsWithRoles(roles: readonly CombatRole[]): Operator[] {
  if (!roles.length) return [];
  const wanted = new Set(roles);
  return OPERATORS.filter((op) => op.roles?.some((r) => wanted.has(r)));
}

export function equipmentWithRoles(roles: readonly CombatRole[]): Equipment[] {
  if (!roles.length) return [];
  const wanted = new Set(roles);
  return EQUIPMENT.filter((eq) => eq.roles?.some((r) => wanted.has(r)));
}

const triggerTags = new Map(OPERATOR_TRIGGERS);

/** 按当前显示的初始 / 精锐特质匹配时机；空名称不过滤，未知名称不匹配，不修改干员数据。 */
export function matchesOperatorTrigger(
  operator: Operator,
  trigger: string,
  elite = false,
): boolean {
  if (!trigger) return true;
  const text = elite ? operator.elite : operator.trait;
  return triggerTags.get(trigger)?.some((tag) => text.includes(tag)) ?? false;
}

export const EQUIPMENT: readonly Equipment[] = CURRENT_SEASON.equipment;
export const EQUIPMENT_COMBOS: readonly EquipmentCombo[] =
  CURRENT_SEASON.equipmentCombos;
/** 成品名称 → 两件材料与成品；装备列表和卡片共用，同一成品只计一次。 */
export const EQUIPMENT_RECIPES: Readonly<Record<string, EquipmentCombo>> =
  Object.fromEntries(EQUIPMENT_COMBOS.map((recipe) => [recipe[2], recipe]));

export const COMPANION_COVENANT_EQUIP: Equipment | undefined = EQUIPMENT.find(
  (eq) => eq.mechanics?.grantsCompanionCovenant,
);
export const COMPANION_EQUIP_NAME: string =
  COMPANION_COVENANT_EQUIP?.name ?? '';
export const DEPLOYMENT_BONUS_EQUIP: Equipment | undefined = EQUIPMENT.find(
  (eq) => (eq.mechanics?.deploymentSlotBonus ?? 0) > 0,
);

export const STRATEGY_CATEGORIES: readonly string[] =
  CURRENT_SEASON.strategyCategories;
export const STRATEGIES: readonly Strategy[] = CURRENT_SEASON.strategies;

export const COVENANTS: Readonly<Record<string, Covenant>> =
  CURRENT_SEASON.covenants;
/** 核心盟约：3 人激活，6 名不同干员触发强化 */
export const CORE_COVENANTS: readonly string[] = Object.entries(COVENANTS)
  .filter(([, cov]) => cov.kind === 'core')
  .map(([name]) => name);
/** 附加盟约：1–3 人激活，层数或人数里程碑触发强化 */
export const ADDON_COVENANTS: readonly string[] = Object.entries(COVENANTS)
  .filter(([, cov]) => cov.kind === 'addon')
  .map(([name]) => name);
/** 全部盟约名，核心在前 */
export const ALL_COVENANTS: readonly string[] = [
  ...CORE_COVENANTS,
  ...ADDON_COVENANTS,
];

export const COVENANT_IDS: Readonly<Record<string, string>> =
  Object.fromEntries(
    Object.entries(COVENANTS).map(([name, cov]) => [cov.id, name]),
  );
export const DEFAULT_COVENANT_ID: string = Object.hasOwn(
  COVENANTS,
  SEASON_META.defaultCovenant,
)
  ? COVENANTS[SEASON_META.defaultCovenant].id
  : '';

export const isCoreCovenant = (name: string): boolean =>
  Object.hasOwn(COVENANTS, name) && COVENANTS[name].kind === 'core';

/** 盟约主题色；附加盟约没有专属色，返回 fallback */
export const covenantColor = (name: string, fallback: string): string =>
  (Object.hasOwn(COVENANTS, name) ? COVENANTS[name].color : undefined) ||
  fallback;

export const LAYER_BREAKPOINTS: Readonly<
  Record<string, readonly LayerBreakpoint[]>
> = Object.fromEntries(
  Object.entries(COVENANTS)
    .filter(([, cov]) => cov.layerBreakpoints?.length)
    .map(([name, cov]) => [name, cov.layerBreakpoints!]),
);

export const CYCLE_REWARDS: Readonly<Record<string, CycleReward>> =
  Object.fromEntries(
    Object.entries(COVENANTS)
      .filter(([, cov]) => cov.cycleReward)
      .map(([name, cov]) => [name, cov.cycleReward!]),
  );

/** 固定展示顺序，不随输入、是否达标或概率变化重新排序。 */
export const COMMON_LAYER_COVENANTS: readonly string[] = Object.entries(
  COVENANTS,
)
  .filter(([, cov]) => cov.commonLayerOrder !== undefined)
  .sort(([, a], [, b]) => a.commonLayerOrder! - b.commonLayerOrder!)
  .map(([name]) => name);

export const HEADCOUNT_BREAKPOINTS: readonly HeadcountBreakpoint[] =
  Object.entries(COVENANTS)
    .filter(([, cov]) => cov.headcountBreakpoint)
    .map(([covenant, cov]) => ({covenant, ...cov.headcountBreakpoint!}))
    .sort(
      (a, b) =>
        (a.order ?? Number.MAX_SAFE_INTEGER) -
        (b.order ?? Number.MAX_SAFE_INTEGER),
    );

/** 附加的生效条件，对应 COVENANTS.scaling 的索引；不依赖解析展示文案。 */
export const SCALING_CONDITIONS: Readonly<
  Record<string, Readonly<Record<number, string>>>
> = Object.fromEntries(
  Object.entries(COVENANTS).flatMap(([name, cov]) => {
    const entries = cov.scaling
      .map((s, index) => [index, s.condition] as const)
      .filter((entry): entry is readonly [number, string] => Boolean(entry[1]));
    return entries.length ? [[name, Object.fromEntries(entries)]] : [];
  }),
);

export const RESTRICTED_MODE_COVENANTS: readonly string[] =
  ALL_COVENANTS.filter((name) => COVENANTS[name].restrictedModeAbsent);

export const RESERVE_COVENANTS: ReadonlySet<string> = new Set(
  ALL_COVENANTS.filter((name) => COVENANTS[name].mechanics?.countsReserve),
);

export const BANNABLE_COVENANTS: readonly string[] = ALL_COVENANTS.filter(
  (name) => COVENANTS[name].mechanics?.countMode !== 'fieldElites',
);

export const isBannableCovenant = (name: string): boolean =>
  Object.hasOwn(COVENANTS, name) &&
  COVENANTS[name].mechanics?.countMode !== 'fieldElites';

export const CORE_BUILDS: Readonly<Record<string, CoreBuild>> =
  CURRENT_SEASON.coreBuilds;
export const MIXED_BUILDS: readonly MixedBuild[] = CURRENT_SEASON.mixedBuilds;
export const MIXED_BUILD_IDS: Readonly<Record<string, string>> =
  Object.fromEntries(MIXED_BUILDS.map((build) => [build.id, build.name]));
export const DEFAULT_BUILD_ID: string =
  (Object.hasOwn(COVENANTS, SEASON_META.defaultBuild)
    ? COVENANTS[SEASON_META.defaultBuild].id
    : undefined) ??
  MIXED_BUILDS.find((build) => build.name === SEASON_META.defaultBuild)?.id ??
  SEASON_META.defaultBuild;

export const TIER_LABELS: readonly string[] = CURRENT_SEASON.rules.tierLabels;
export const TIERS: readonly number[] = CURRENT_SEASON.rules.tiers;
export const DISPATCH_LEVELS: readonly DispatchLevel[] =
  CURRENT_SEASON.rules.dispatchLevels;
export const DISPATCH_MODES: readonly string[] =
  CURRENT_SEASON.rules.dispatchModes;
export const DISPATCH_BY_MODE: readonly (readonly DispatchLevel[])[] =
  CURRENT_SEASON.rules.dispatchByMode;
export const TIER_STATS: readonly TierStats[] = CURRENT_SEASON.rules.tierStats;
export const OWN_OPERATOR_BONUS: readonly OwnOperatorBonus[] =
  CURRENT_SEASON.rules.ownOperatorBonus;
export const BORROW_LIMIT: number = CURRENT_SEASON.rules.borrowLimit;
export const DIFFICULTIES: readonly Difficulty[] =
  CURRENT_SEASON.rules.difficulties;
export const MODES: readonly string[] = CURRENT_SEASON.rules.modes;
export const DECISION_ROUNDS: Readonly<Record<string, readonly number[]>> =
  CURRENT_SEASON.rules.decisionRounds;
export const ROUND_TIME: readonly number[] = CURRENT_SEASON.rules.roundTime;
export const CREDIT: readonly number[] = CURRENT_SEASON.rules.credit;
export const LEADER_CREDIT_BONUS: number =
  CURRENT_SEASON.rules.leaderCreditBonus;
export const CREDIT_CAPS = CURRENT_SEASON.rules.creditCaps;
export const QUICK_CREDIT_MODE = CURRENT_SEASON.rules.quickCreditMode;
export const CREDIT_MILESTONES: readonly CreditMilestone[] =
  CURRENT_SEASON.rules.creditMilestones;
export const SOLO_LEVELS: readonly SoloLevel[] =
  CURRENT_SEASON.rules.soloLevels;
export const TRAINING: readonly TrainingType[] = CURRENT_SEASON.rules.training;
export const BOUNTIES: readonly Bounty[] = CURRENT_SEASON.rules.bounties;
export const ENEMY_GLOSSARY: Readonly<Record<string, EnemyTerm>> =
  CURRENT_SEASON.rules.enemyGlossary;

export const LEADER_BATTLEFIELDS: readonly LeaderBattlefield[] =
  CURRENT_SEASON.leaderBattlefields;
export const LEADER_MOVEMENTS: Readonly<Record<string, MovementBranches>> =
  CURRENT_SEASON.leaderMovements;
export const LEADER_MAP: LeaderMapConfig = CURRENT_SEASON.leaderMap;
export const LEADERS: readonly Leader[] = CURRENT_SEASON.leaders;

/** 名称 → 数据 */
export const OPERATOR: Readonly<Record<string, Operator>> = byName(OPERATORS);
export const EQUIP: Readonly<Record<string, Equipment>> = byName(EQUIPMENT);
export const STRATEGY: Readonly<Record<string, Strategy>> = byName(STRATEGIES);
export const LEADER: Readonly<Record<string, Leader>> = byName(LEADERS);

/** 干员基础购买价；特质改价优先于等阶基础价。 */
export function operatorPrice(
  operator: Pick<Operator, 'name' | 'tier'> & {readonly price?: number},
): number {
  return (
    operator.price ??
    (Object.hasOwn(OPERATOR, operator.name)
      ? OPERATOR[operator.name].price
      : undefined) ??
    SEASON_META.tierBasePrices[operator.tier]
  );
}

/** 干员晋升精锐所需张数；特质减张优先于赛季默认张数。 */
export function operatorEliteCopies(
  nameOrOp: string | Pick<Operator, 'name' | 'eliteCopies'>,
): number {
  if (typeof nameOrOp === 'string') {
    return (
      (Object.hasOwn(OPERATOR, nameOrOp)
        ? OPERATOR[nameOrOp].eliteCopies
        : undefined) ?? SEASON_META.defaultEliteCopies
    );
  }
  return (
    nameOrOp.eliteCopies ??
    (Object.hasOwn(OPERATOR, nameOrOp.name)
      ? OPERATOR[nameOrOp.name].eliteCopies
      : undefined) ??
    SEASON_META.defaultEliteCopies
  );
}

/** 干员特殊售出机制配置；普通干员返回 undefined（默认售出价 1）。 */
export function operatorSellMechanics(
  nameOrOp: string | Pick<Operator, 'name' | 'sellMechanics'>,
): OperatorSellMechanics | undefined {
  if (typeof nameOrOp === 'string') {
    return Object.hasOwn(OPERATOR, nameOrOp)
      ? OPERATOR[nameOrOp].sellMechanics
      : undefined;
  }
  return (
    nameOrOp.sellMechanics ??
    (Object.hasOwn(OPERATOR, nameOrOp.name)
      ? OPERATOR[nameOrOp.name].sellMechanics
      : undefined)
  );
}

/** 干员基础售出价；特殊售价优先于默认值 1。 */
export function operatorSellPrice(
  nameOrOp: string | Pick<Operator, 'name' | 'sellMechanics'>,
  elite = false,
): number {
  const mech = operatorSellMechanics(nameOrOp);
  if (!mech) return 1;
  return elite ? mech.elite : mech.base;
}

/** 局内推荐是否将该策略视为带有主动触发指令。 */
export const strategyUsesAdvisorCommand = (name: string): boolean =>
  Object.hasOwn(STRATEGY, name) &&
  Boolean(STRATEGY[name].advisor?.commandTrigger);

// 同一赛季的名单固定；列表、速览和发牌出题可以共用索引。
const covenantRosters = new Map<string, Operator[]>();
for (const operator of OPERATORS) {
  for (const covenant of new Set(operator.covenants)) {
    const roster = covenantRosters.get(covenant);
    if (roster) roster.push(operator);
    else covenantRosters.set(covenant, [operator]);
  }
}

/** 按盟约名返回数据表顺序的干员列表；调用方可以独立排序。 */
export const rosterOf = (covenant: string): Operator[] =>
  covenantRosters.get(covenant)?.slice() ?? [];

/**
 * 统计给定阵容中盟约的不同干员人数，重复名称只计一次。
 * @param {string[]} lineup 干员名称列表。
 * @param {string} covenant 盟约名称。
 * @returns {number} 阵容中拥有该盟约的不同干员数。
 */
export const lineupCovenantCount = (
  lineup: readonly string[],
  covenant: string,
): number =>
  [...new Set(lineup)].filter(
    (name) =>
      Object.hasOwn(OPERATOR, name) &&
      OPERATOR[name].covenants.includes(covenant),
  ).length;

/** 全部流派名：核心盟约流派 + 混搭流派 */
export const BUILD_NAMES: readonly string[] = [
  ...Object.keys(CORE_BUILDS),
  ...MIXED_BUILDS.map((b) => b.name),
];
export const BUILD_COUNT = BUILD_NAMES.length;

/** 按名称取流派；核心流派的 name 补为盟约名 */
export const buildByName = (name: string): Build | undefined =>
  Object.hasOwn(CORE_BUILDS, name)
    ? {name, ...CORE_BUILDS[name]}
    : MIXED_BUILDS.find((b) => b.name === name);

/**
 * 推荐了某干员 / 策略 / 装备的流派名。
 * field: 'lineup' | 'strategies' | 'equipment'
 * 干员同时匹配核心流派的 carries。
 */
export function buildsUsing(field: BuildField, name: string): string[] {
  const core = Object.entries(CORE_BUILDS)
    .filter(
      ([, b]) =>
        b[field].includes(name) ||
        (field === 'lineup' && b.carries.includes(name)),
    )
    .map(([covenant]) => covenant);
  const mixed = MIXED_BUILDS.filter((b) => b[field].includes(name)).map(
    (b) => b.name,
  );
  return [...core, ...mixed];
}

/** 小工具的查询入口；ID 用于 URL，文案不参与状态判断。 */
export const NUMBER_TOOLS = [
  {id: 'advisor', label: '局内抓取'},
  {id: 'match-reference', label: '对局速查'},
  {id: 'credit', label: '认证效率'},
  {id: 'dealer', label: '痛扁发牌'},
  {id: 'excuse', label: '抽象文案'},
] as const;
export type NumberTool = (typeof NUMBER_TOOLS)[number]['id'];

/** 数值工具共用的输入保护边界，非游戏内层数上限。 */
export const NUMBER_INPUT_LIMIT = 9999;
/** 层数滑块和数字输入共用的可调上限。 */
export const LAYER_INPUT_LIMIT = 999;

/** 模式 ID 与 DISPATCH_BY_MODE 保持同一索引，避免复用领袖难度误选费用表。 */
export const SHOP_MODE_IDS = ['advanced', 'standard', 'fast'] as const;

export const DEALER_DECOYS = CURRENT_SEASON.rules.dealerDecoys;
