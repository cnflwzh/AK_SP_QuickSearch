/** 干员、装备、策略与盟约的静态数据契约；只读字段防止页面误改共享数据。 */
export interface OperatorSellMechanics {
  readonly base: number;
  readonly elite: number;
  /** 休整期结束时随回合增长的售出价配置（如海沫）。 */
  readonly roundGrowth?: {
    readonly baseStep: number;
    readonly eliteStep: number;
    readonly baseMax: number;
    readonly eliteMax: number;
  };
}

export type CombatRole =
  | '对空'
  | '反隐'
  | '治疗'
  | '元素回复'
  | '高频'
  | '控制'
  | '阻挡'
  | '群攻'
  | '真伤'
  | '元素输出'
  | '破抗'
  | '沉默'
  | '快活';

export interface CombatRoleMeta {
  readonly id: string;
  readonly label: CombatRole;
  readonly desc: string;
  readonly trainingTypes?: readonly string[];
}

export interface Operator {
  readonly name: string;
  readonly tier: number;
  readonly stars: number;
  readonly covenants: readonly string[];
  readonly type: string;
  readonly avatar: string;
  /** 同一自持干员的升变模板 ID，在练度导入与旧备份中归到本体。 */
  readonly formAvatars?: readonly string[];
  readonly trait: string;
  readonly elite: string;
  readonly price?: number;
  readonly eliteCopies?: number;
  readonly sellMechanics?: OperatorSellMechanics;
  /** 按赛季默认形态、技能及满精锐列出的职能。 */
  readonly roles?: readonly CombatRole[];
  readonly eliteOnlyRoles?: readonly CombatRole[];
  /** 任一指定状态有来源时，才能稳定触发该干员的元素输出。 */
  readonly elementalPrerequisites?: readonly ElementalCondition[];
  /** 部署人数不足时不会触发的团队能力，如余的第二天赋。 */
  readonly minimumFieldRoles?: {
    readonly count: number;
    readonly roles: readonly CombatRole[];
  };
  readonly inflictsElements?: readonly ElementalCondition[];
  /** 为装备判定记录本体的近战部署位及能否产生攻击/伤害事件。 */
  readonly melee?: boolean;
  readonly combatAction?: '攻击' | '可造成法伤' | '间接伤害' | '无伤害';
  /** 未持有时能否通过助战借用同名干员补位（仅限非特许六星，对应官方 chessType === 'NORMAL'）。 */
  readonly borrowable?: boolean;
  /** 未持有且未借用助战时，系统默认替补出战的原型/预备干员名（对应官方 backupCharId）。 */
  readonly backupOperator?: string;
}

export interface EquipmentMechanics {
  readonly grantsCompanionCovenant?: boolean;
  readonly deploymentSlotBonus?: number;
}

export type ElementalCondition = '凋亡' | '灼燃' | '神经' | '侵蚀' | '麻痹';
export type EquipmentRoleTrigger =
  '攻击' | '伤害' | '法伤' | '地面' | '地面攻击';

export interface Equipment {
  readonly name: string;
  readonly tier: number;
  readonly price: number;
  readonly covenant: string | null;
  readonly icon: string;
  readonly effect: string;
  readonly advanced: string | null;
  readonly mechanics?: EquipmentMechanics;
  readonly roles?: readonly CombatRole[];
  /** 该装备要提供上述职能，携带者必须能触发的事件或部署条件。 */
  readonly roleTrigger?: EquipmentRoleTrigger;
  readonly grantsArtsOnDamage?: boolean;
  readonly inflictsElements?: readonly ElementalCondition[];
}

export type EquipmentCombo = readonly [
  first: string,
  second: string,
  result: string,
];

export type StrategyScoreFormula =
  | {
      readonly kind: 'activeCovenantTier';
      readonly minActive: number;
      readonly maxActive: number;
      readonly scorePerTier: number;
    }
  | {
      readonly kind: 'fieldEliteThreshold';
      readonly minElites: number;
      readonly score: number;
    }
  | {
      readonly kind: 'fieldEliteQuadratic';
      readonly factor: number;
    }
  | {
      readonly kind: 'fieldEliteLinear';
      readonly scorePerElite: number;
    }
  | {
      readonly kind: 'distinctActiveOwnCovenantTiers';
      readonly scorePerTier: number;
    };

export interface StrategyCovenantThresholdTier {
  readonly count: number;
  readonly gainReason: string;
  readonly lossReason: string;
}

export interface StrategyAdvisorRule {
  readonly scoreFormula?: StrategyScoreFormula;
  readonly commandTrigger?: 'rest' | 'acquisition';
  readonly deployedCovenantThresholds?: {
    readonly covenant: string;
    readonly ignoreInFastFormat?: boolean;
    readonly tiers: readonly StrategyCovenantThresholdTier[];
  };
  readonly covenantMinPrice?: {
    readonly covenant: string;
    readonly minPrice: number;
  };
  readonly reserveFundsFloor?: {
    readonly minFunds: number;
    readonly penalty: number;
    readonly lossReason: string;
  };
}

export interface Strategy {
  readonly name: string;
  readonly hp: number;
  readonly category: string;
  readonly unlock: string;
  readonly portrait: string;
  readonly skill: string;
  readonly effect: string;
  readonly advisor?: StrategyAdvisorRule;
}

export interface CovenantScaling {
  readonly label: string;
  readonly unit: string;
  /** 输入盟约层数，返回该条效果的实际数值，不修改数据。 */
  readonly at: (layers: number) => number;
  readonly condition?: string;
}

export interface LayerBreakpoint {
  readonly layers: number;
  readonly effect: string;
}

export interface CycleReward {
  readonly every: number;
  readonly reward: string;
}

export interface HeadcountBreakpointInfo {
  readonly condition: string;
  readonly effect: string;
  readonly order?: number;
}

export type HeadcountBreakpoint = HeadcountBreakpointInfo & {
  readonly covenant: string;
};

export interface CovenantPriceDiscountStep {
  readonly layers: number;
  readonly discount: number;
}

export interface CovenantMechanics {
  readonly countsReserve?: boolean;
  readonly countMode?: 'members' | 'fieldElites';
  readonly maxCount?: number;
  readonly addsCoreCount?: number;
  readonly bonusNeed?: number;
  readonly acquisitionMultiplier?: {
    readonly base: number;
    readonly bonusLayers?: number;
    readonly bonus?: number;
  };
  readonly endOfRestAllActiveLayers?: {
    readonly base: number;
    readonly bonus: number;
  };
  readonly priceDiscounts?: {
    readonly minPrice?: number;
    readonly steps: readonly CovenantPriceDiscountStep[];
  };
  readonly rangePreviewLayers?: number;
}

export interface Covenant {
  readonly id: string;
  readonly icon?: string;
  readonly kind: 'core' | 'addon';
  readonly color?: string;
  readonly need: number;
  readonly effect: string;
  readonly bonus: string;
  readonly scaling: readonly CovenantScaling[];
  readonly layerBreakpoints?: readonly LayerBreakpoint[];
  readonly commonLayerOrder?: number;
  readonly cycleReward?: CycleReward;
  readonly headcountBreakpoint?: HeadcountBreakpointInfo;
  readonly restrictedModeAbsent?: boolean;
  readonly mechanics?: CovenantMechanics;
  /** 对应基础激活和人数/层数强化两个档位的实战职能。 */
  readonly roles?: readonly CombatRole[];
  readonly bonusRoles?: readonly CombatRole[];
  readonly bonusElements?: readonly ElementalCondition[];
  readonly memberArtsDamage?: boolean;
}

/** 核心与混搭流派共用的阵容、推荐和运营说明。 */
export interface BuildDetails {
  /** 主选干员名到同位置备选名单；载入预设时写入规划器的备选栏。 */
  readonly alternatives?: Readonly<Record<string, readonly string[]>>;
  readonly tagline: string;
  readonly lineup: readonly string[];
  readonly strategies: readonly string[];
  readonly equipment: readonly string[];
  readonly tips: readonly string[];
}

export interface CoreBuild extends BuildDetails {
  readonly carries: readonly string[];
  readonly addons: readonly string[];
}

export interface MixedBuild extends BuildDetails {
  readonly id: string;
  readonly name: string;
  readonly carries?: readonly string[];
  readonly addons?: readonly string[];
}

/** 查找结果为补齐盟约名称的核心流派，或自带名称的混搭流派。 */
export type Build = (CoreBuild & {readonly name: string}) | MixedBuild;
export type BuildField = 'lineup' | 'strategies' | 'equipment';

export interface DispatchLevel {
  readonly level: number;
  readonly upgradeCost: number | null;
  readonly operatorSlots: number;
  readonly equipmentSlots: number;
}

export interface TierStats {
  readonly tier: number;
  readonly base: string;
  readonly elite: string;
}

export interface OwnOperatorBonus {
  readonly level: string;
  readonly atk: string;
  readonly def: string;
  readonly hp: string;
}

export interface Difficulty {
  readonly name: string;
  readonly efficiency: number;
  readonly strength: number | null;
  readonly note: string;
}

export interface SoloLevel {
  readonly level: number;
  readonly efficiency: number;
  readonly strength: number;
  readonly note: string;
}

export type CreditTargetKind = 'battle' | 'total' | 'spend';

export interface CreditMilestone {
  readonly kind: CreditTargetKind;
  readonly value: number;
  readonly title: string;
  readonly reward?: string;
}

/** 领袖能力的一条；skill 为技能名（无名的被动能力省略）。text 写法见 data/leaders.ts 开头。 */
export interface LeaderAbility {
  readonly skill?: string;
  readonly text: string;
}

/** 敌人/Boss 名词、异常状态、损伤与特殊单位速查解释 */
export interface EnemyTerm {
  readonly term: string;
  readonly kind: 'status' | 'mechanic' | 'unit';
  readonly desc: string;
}

/** 领袖战斗速览档案：不出站即掌握攻击方式、面板抗性、索敌规律与阻挡需求 */
export interface LeaderProfile {
  /** 攻击与行动形态，如「定点远程 · 物理/法术」「巡逻近战 · 法术」 */
  readonly attackMode: string;
  /** 防御 / 法抗参考值及阶段抗性变化 */
  readonly defense: string;
  /** 核心索敌 / 仇恨目标说明 */
  readonly targeting: string;
  /** 阻挡需求与路线提示 */
  readonly blocking: string;
  /** 一句话战前速记 */
  readonly summary: string;
  /** 隐秘核心形态的关键机制变化（无隐秘核心省略） */
  readonly hiddenSummary?: string;
}

/** 伤害与损伤类型，速查卡片按类型上色 */
export type LeaderDamage = '物理' | '法术' | '真实' | '侵蚀' | '凋亡' | '神经';

export interface Leader {
  readonly name: string;
  /** 敌人 ID，也是 public/assets/img/leaders/ 下的图片文件名 */
  readonly id: string;
  readonly damage: readonly LeaderDamage[];
  /** 战斗基础档案（攻击方式、抗性参考、索敌规律、阻挡需求与战前速记） */
  readonly profile: LeaderProfile;
  /** 该 Boss 专属召唤物、部件或特殊机制名词解释 */
  readonly terms?: readonly EnemyTerm[];
  readonly hp: readonly [
    standard: number,
    danger: number,
    desperate: number,
    ultimate: number,
  ];
  readonly hiddenCore:
    readonly [danger: number, desperate: number, ultimate: number] | null;
  readonly abilities: readonly LeaderAbility[];
  /** 隐秘核心回合的变化；没有隐秘核心为空数组 */
  readonly hiddenAbilities: readonly LeaderAbility[];
  /** 领袖回合的关卡：领袖位置、巡逻路线与特殊随行敌人 */
  readonly stage: LeaderStage;
  /** 隐秘核心回合的关卡；没有隐秘核心为 null */
  readonly hiddenStage: LeaderStage | null;
  readonly counters: readonly LeaderCounter[];
  /** 我方干员站位示意 */
  readonly layout: LeaderLayout;
  /** 隐秘核心回合的站位；null = 沿用 layout */
  readonly hiddenLayout: LeaderLayout | null;
}

/**
 * 站位示意里的干员职能：坦 阻挡 / 承伤　输 主输出　疗 治疗　空 对空 / 远程　群 群攻
 * 卫戍协议允许远程干员部署于近战位。部署格与阻隔工事位置见 LEADER_MAP；示例站位避开禁行格及预置工事。
 */
export type OpRole = '坦' | '输' | '疗' | '空' | '群';
export interface OpSlot {
  readonly role: OpRole;
  readonly at: MapPos;
  /** 朝向；仅表达该站位的攻击或支援方向，不预设具体干员射程。 */
  readonly facing: 'up' | 'right' | 'down' | 'left';
  /** 关键条件，如「攻击最高」「防御最高」「阻挡≥3」 */
  readonly mark?: string;
}

/**
 * 危险区：rect 矩形（at 为左上角）、cross 十字、col 整列、circle 圆形半径、tiles 目标格、line 轨迹
 * tone：red 领袖本体，hc 隐秘核心或部件
 */
export type ZoneShape =
  | {
      readonly kind: 'rect';
      readonly at: MapPos;
      readonly w: number;
      readonly h: number;
    }
  | {readonly kind: 'cross'; readonly at: MapPos}
  | {readonly kind: 'col'; readonly x: number}
  | {readonly kind: 'line'; readonly path: readonly MapPos[]}
  | {readonly kind: 'circle'; readonly at: MapPos; readonly radius: number}
  | {readonly kind: 'tiles'; readonly at: readonly MapPos[]};
export interface LayoutZone {
  readonly shape: ZoneShape;
  readonly label: string;
  readonly tone?: 'red' | 'hc';
  /** 当前技能对应的站位要点。 */
  readonly hint: string;
  /** 同一技能的附加范围；与主范围同时显示。 */
  readonly extraShapes?: readonly ZoneShape[];
  /** 被技能选中的我方格子。 */
  readonly targets?: readonly MapPos[];
  /** 巡逻领袖发动技能时的演示位置，路线页仍使用真实出生点。 */
  readonly bossAt?: MapPos;
  /** 技能场景中的余音、茧和部件等单位。 */
  readonly markers?: readonly {readonly name: string; readonly at: MapPos}[];
}

export interface LeaderLayout {
  readonly slots: readonly OpSlot[];
  readonly zones: readonly LayoutZone[];
}

/** 领袖关卡地图上的坐标：[列, 行]，行从上往下数（关卡文件的 row 自下往上，已换算） */
export type MapPos = readonly [x: number, y: number];

/**
 * 地图标记。
 * boss  领袖本体   part  领袖的部件 / 同场首领（剑与锤、碎铳之簧、弦）   unit  走特殊路线的随行敌人
 * movement 保存完整出生段、巡逻段和跨场传送；at 是静态站位图的默认位置。
 */
export interface StageMark {
  readonly name: string;
  readonly kind: 'boss' | 'part' | 'unit';
  readonly at: MapPos;
  readonly movement?: MovementBranches;
}

/** 联合领袖关卡静态刷出的全场随行数量；技能额外召唤不计入 count。 */
export interface StageEscort {
  readonly name: string;
  readonly count: number;
  readonly fly?: boolean;
  /** 能力摘要，写法同 LeaderAbility.text */
  readonly note?: string;
}

export interface LeaderStage {
  readonly marks: readonly StageMark[];
  readonly escorts: readonly StageEscort[];
}

/**
 * 对策：由能力描述、随行敌人与路线推导。
 * tag  分散 / 阻挡 / 集火 / 法抗 / 对空 / 限时 / 避让 / 续航 / 控制
 * by   依据的技能或单位
 */
export type CounterTag =
  | '分散'
  | '阻挡'
  | '集火'
  | '法抗'
  | '对空'
  | '限时'
  | '避让'
  | '续航'
  | '控制';
export interface LeaderCounter {
  readonly tag: CounterTag;
  /** 这条机制实际需要的职能。走位、转火等仅需操作的提示省略此项。 */
  readonly roles?: readonly CombatRole[];
  readonly text: string;
  readonly by: string;
  readonly hidden?: boolean;
}

export type EnemyMobility = '地面' | '飞行';
export type EnemyAttackRange = '近战' | '远程' | '近远' | '不攻击';
export type EnemyDamageKind = '物理' | '法术' | '混伤' | '元素' | '无';

export interface TrainingType {
  readonly name: string;
  /** 是否参与开局的随机特训类型抽选。 */
  readonly randomCandidate: boolean;
  readonly desc: string;
  /** 该类特训波次的典型敌人与攻击方式 */
  readonly attackStyle: string;
  /** 核心威胁点与实战应对思路 */
  readonly strategy: string;
  /** 代表敌人或典型机制提示 */
  readonly examples: readonly string[];
  /** 关键机制标签 */
  readonly tags: readonly string[];
}

export interface Bounty {
  readonly name: string;
  /** 对应游戏图鉴 ID，同时用于本地敌人头像文件名。 */
  readonly enemyId: string;
  readonly funds: number;
  readonly when: string;
  /** 行动方式：地面 / 飞行 */
  readonly mobility: EnemyMobility;
  /** 攻击距离：近战 / 远程 / 近远 / 不攻击 */
  readonly range: EnemyAttackRange;
  /** 主要伤害类型 */
  readonly damage: EnemyDamageKind;
  /** 攻击方式与核心机制简述 */
  readonly mechanics: string;
  /** 实战对策方法 */
  readonly counter: string;
  /** 推荐实战职能（用于联动查对策干员与装备） */
  readonly roles?: readonly CombatRole[];
  /** 机制关键词标签 */
  readonly tags?: readonly string[];
}

export interface WikiSource {
  readonly name: string;
  readonly page: string;
  readonly url: string;
  readonly used: string;
}

export interface VideoSource {
  readonly title: string;
  readonly bv: string;
  readonly used: string;
}

export interface UploaderSource {
  readonly name: string;
  readonly uid: number;
  readonly videos: readonly VideoSource[];
}

export type LicenseEntry = readonly [subject: string, license: string];
export type PinyinReadings = string | readonly string[];
export type PinyinIndex = Readonly<Record<string, PinyinReadings>>;

/** 领袖战场的实际地形；坐标与 MapPos 一致，crates/platforms 为初始可见设施。 */
export interface LeaderBattlefield {
  readonly id: string;
  readonly name: string;
  readonly grid: readonly string[];
  readonly crates: readonly MapPos[];
  readonly platforms: readonly MapPos[];
}

/** 一段连续运动；wait 是此段开始前的离场等待秒数，段间跳转按传送处理。 */
export interface MovementLeg {
  readonly points: readonly MapPos[];
  readonly wait?: number;
}

/** 基础移动配置；speed 为格/秒，delay 为出场延时，loopFrom 指定重复的巡逻段。 */
export interface EnemyMovement {
  readonly speed: number;
  readonly flying: boolean;
  readonly delay: number;
  readonly legs: readonly MovementLeg[];
  readonly loopFrom?: number;
}

/** left/right 为游戏数据中的实际分支；只有 left 时路线由全场共享，不镜像生成。 */
export interface MovementBranches {
  readonly left: EnemyMovement;
  readonly right?: EnemyMovement;
}

export interface LeaderMapConfig extends LeaderBattlefield {
  readonly spawn: MapPos;
  readonly exit: MapPos;
  readonly transfer: MapPos;
  readonly walk: readonly MapPos[];
  readonly fly: readonly MapPos[];
  readonly common: readonly StageEscort[];
}

export interface SeasonMeta {
  readonly id: string;
  readonly title: string;
  readonly guideSubtitle: string;
  readonly ruleVersion: string;
  /** 森空岛攻略使用的活动与数据版本，只有匹配时才转入本局规划。 */
  readonly skland?: {readonly season: string; readonly version: string};
  readonly ruleSource: string;
  readonly defaultCovenant: string;
  readonly defaultBuild: string;
  readonly baseDeploymentLimit: number;
  readonly defaultEliteCopies: number;
  readonly tierBasePrices: readonly number[];
  readonly roundLimits: {
    readonly standard: number;
    readonly fast: number;
  };
  readonly pinyinOverrides: Readonly<Record<string, readonly string[]>>;
  readonly shareOperatorIds: readonly number[];
  readonly boxShare: {
    /** 1–15 的协议编号。使用不兼容槽表的新赛季须分配新编号。 */
    readonly version: number;
    /** 对应官方 char_ID；已发布的下标不能更换或删除。 */
    readonly operatorIds: readonly number[];
  };
}

export interface SeasonRules {
  /** 每日练习使用固定顺序，不能随装备展示列表重排。 */
  readonly dealerDecoys: {
    readonly transmute: readonly string[];
    readonly consumable: readonly string[];
  };
  readonly tierLabels: readonly string[];
  readonly tiers: readonly number[];
  readonly dispatchLevels: readonly DispatchLevel[];
  readonly dispatchModes: readonly string[];
  readonly dispatchByMode: readonly (readonly DispatchLevel[])[];
  readonly tierStats: readonly TierStats[];
  readonly ownOperatorBonus: readonly OwnOperatorBonus[];
  /** 备战助战干员借用数量上限（对应官方 constData.borrowCount）。 */
  readonly borrowLimit: number;
  readonly difficulties: readonly Difficulty[];
  readonly modes: readonly string[];
  readonly decisionRounds: Readonly<Record<string, readonly number[]>>;
  readonly roundTime: readonly number[];
  readonly credit: readonly number[];
  readonly leaderCreditBonus: number;
  readonly creditCaps: {
    readonly battle: number;
    readonly objectives: number;
    readonly limitedSpend: number;
  };
  readonly quickCreditMode: {
    readonly rounds: number;
    readonly efficiency: number;
  };
  readonly creditMilestones: readonly CreditMilestone[];
  readonly soloLevels: readonly SoloLevel[];
  readonly training: readonly TrainingType[];
  readonly bounties: readonly Bounty[];
  /** 敌人通用名词、异常状态与元素损伤词典 */
  readonly enemyGlossary: Readonly<Record<string, EnemyTerm>>;
  readonly operatorTypes: readonly string[];
  readonly operatorTriggers: readonly (readonly [
    label: string,
    tags: readonly string[],
  ])[];
  readonly combatRoles: readonly CombatRoleMeta[];
}

export interface AboutUsageItem {
  readonly title: string;
  readonly desc: string;
}

export interface SeasonCredits {
  readonly aboutVersion: number;
  readonly purpose: readonly string[];
  readonly usage: readonly AboutUsageItem[];
  readonly tip?: string;
  readonly wikis: readonly WikiSource[];
  readonly uploaders: readonly UploaderSource[];
  readonly furtherReading: readonly UploaderSource[];
}

/** 固定棋子之外的参战身份。covenants 仅用于主动自选，替补时读取原棋子。 */
export interface AdditionalOperator {
  readonly name: string;
  readonly avatar: string;
  /** operator 为可持有六星，system 为可自选原型，reserve 仅用于替补。 */
  readonly source: 'operator' | 'system' | 'reserve';
  readonly covenants: readonly string[];
}

export interface SeasonDefinition {
  readonly additionalOperators?: readonly AdditionalOperator[];
  readonly selectionLimits?: readonly {
    tier: number;
    slots: number;
    perRun: number;
  }[];
  readonly meta: SeasonMeta;
  readonly covenants: Readonly<Record<string, Covenant>>;
  readonly operators: readonly Operator[];
  readonly equipment: readonly Equipment[];
  readonly equipmentCombos: readonly EquipmentCombo[];
  readonly strategies: readonly Strategy[];
  readonly strategyCategories: readonly string[];
  readonly coreBuilds: Readonly<Record<string, CoreBuild>>;
  readonly mixedBuilds: readonly MixedBuild[];
  readonly leaders: readonly Leader[];
  readonly leaderBattlefields: readonly LeaderBattlefield[];
  readonly leaderMovements: Readonly<Record<string, MovementBranches>>;
  readonly leaderMap: LeaderMapConfig;
  readonly rules: SeasonRules;
  readonly credits: SeasonCredits;
}
