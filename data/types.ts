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

export interface Leader {
  readonly name: string;
  readonly hp: readonly [standard: number, danger: number, desperate: number, ultimate: number];
  readonly hiddenCore: readonly [danger: number, desperate: number, ultimate: number] | null;
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
