/** 干员、装备、策略与盟约的静态数据契约；只读字段防止页面误改共享数据。 */
export interface Operator {
  readonly name: string;
  readonly tier: number;
  readonly stars: number;
  readonly covenants: readonly string[];
  readonly type: string;
  readonly avatar: string;
  readonly trait: string;
  readonly elite: string;
}

export interface Equipment {
  readonly name: string;
  readonly tier: number;
  readonly price: number;
  readonly covenant: string | null;
  readonly icon: string;
  readonly effect: string;
  readonly advanced: string | null;
}

export type EquipmentCombo = readonly [first: string, second: string, result: string];

export interface Strategy {
  readonly name: string;
  readonly hp: number;
  readonly category: string;
  readonly unlock: string;
  readonly portrait: string;
  readonly skill: string;
  readonly effect: string;
}

export interface CovenantScaling {
  readonly label: string;
  readonly unit: string;
  /** 输入盟约层数，返回该条效果的实际数值，不修改数据。 */
  readonly at: (layers: number) => number;
}

export interface Covenant {
  readonly color?: string;
  readonly need: number;
  readonly effect: string;
  readonly bonus: string;
  readonly scaling: readonly CovenantScaling[];
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
  readonly name: string;
  readonly carries?: readonly string[];
  readonly addons?: readonly string[];
}

/** 查找结果为补齐盟约名称的核心流派，或自带名称的混搭流派。 */
export type Build = (CoreBuild & { readonly name: string }) | MixedBuild;
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

/** 领袖能力的一条；skill 为技能名（无名的被动能力省略）。text 写法见 data/leaders.ts 开头。 */
export interface LeaderAbility {
  readonly skill?: string;
  readonly text: string;
}

/** 伤害与损伤类型，速查卡片按类型上色 */
export type LeaderDamage = '物理' | '法术' | '真实' | '侵蚀' | '凋亡' | '神经';

export interface Leader {
  readonly name: string;
  /** 敌人 ID，也是 public/assets/img/leaders/ 下的图片文件名 */
  readonly id: string;
  readonly damage: readonly LeaderDamage[];
  readonly hp: readonly [standard: number, danger: number, desperate: number, ultimate: number];
  readonly hiddenCore: readonly [danger: number, desperate: number, ultimate: number] | null;
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
  | { readonly kind: 'rect'; readonly at: MapPos; readonly w: number; readonly h: number }
  | { readonly kind: 'cross'; readonly at: MapPos }
  | { readonly kind: 'col'; readonly x: number }
  | { readonly kind: 'line'; readonly path: readonly MapPos[] }
  | { readonly kind: 'circle'; readonly at: MapPos; readonly radius: number }
  | { readonly kind: 'tiles'; readonly at: readonly MapPos[] };
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
  readonly markers?: readonly { readonly name: string; readonly at: MapPos }[];
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
export type CounterTag = '分散' | '阻挡' | '集火' | '法抗' | '对空' | '限时' | '避让' | '续航' | '控制';
export interface LeaderCounter {
  readonly tag: CounterTag;
  readonly text: string;
  readonly by: string;
  readonly hidden?: boolean;
}

export interface TrainingType {
  readonly name: string;
  readonly desc: string;
}

export interface Bounty {
  readonly name: string;
  readonly funds: number;
  readonly when: string;
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
