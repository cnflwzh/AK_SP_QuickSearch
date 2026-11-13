/** 数值页的查询入口；ID 用于 URL，文案不参与状态判断。 */
export const NUMBER_TOOLS = [
  { id: 'layers', label: '层数门槛' },
  { id: 'recruit', label: '找牌升本' },
  { id: 'bounty', label: '悬赏收益' },
] as const;
export type NumberTool = typeof NUMBER_TOOLS[number]['id'];

/** 输入保护边界，非游戏内层数上限。和 URL 校验使用同一个值。 */
export const NUMBER_INPUT_LIMIT = 9999;

export interface LayerBreakpoint {
  readonly layers: number;
  readonly effect: string;
}
export interface CycleReward {
  readonly every: number;
  readonly reward: string;
}

/** 本期盟约规则。仅离散层数条件；人数强化不由层数计算器推断。 */
export const LAYER_BREAKPOINTS: Readonly<Record<string, readonly LayerBreakpoint[]>> = {
  灵巧: [{ layers: 40, effect: '周围 4 格 → 8 格' }],
  迅捷: [{ layers: 40, effect: '全体技能结束时，同概率额外回复 15 技力' }],
  突袭: [{ layers: 50, effect: '全体攻速 +50' }],
  远见: [
    { layers: 80, effect: '首次达成：远见干员购买价 −1' },
    { layers: 150, effect: '首次达成：远见干员购买价再 −1' },
  ],
  奇迹: [{ layers: 100, effect: '首次达成：刷新至少出现 1 名当前等级的干员' }],
  投资人: [{ layers: 100, effect: '获得时特质：2 次 → 3 次' }],
};

export const CYCLE_REWARDS: Readonly<Record<string, CycleReward>> = {
  维多利亚: { every: 25, reward: '特效维式重锤 ×1' },
  谢拉格: { every: 100, reward: '谢拉格不融冰 ×1' },
  远见: { every: 10, reward: '资金 +2' },
};

/** 固定展示顺序，不随输入、是否达标或概率变化重新排序。 */
export const COMMON_LAYER_COVENANTS = ['灵巧', '迅捷', '突袭', '远见', '奇迹', '投资人'] as const;

export const HEADCOUNT_BREAKPOINTS = [
  { covenant: '精准', condition: '3 名', effect: '扩展至全体远程 · 无视 30% 双抗' },
  { covenant: '坚守', condition: '3 名', effect: '分摊伤害 · 受伤反击' },
  { covenant: '助力', condition: '3 名', effect: '已激活盟约每回合 +4 层' },
  { covenant: '不屈', condition: '3 名', effect: '地面干员倒下时全场技力 +5' },
  { covenant: '聚合', condition: '3 名', effect: '范围内友方获得庇护' },
  { covenant: '奥术', condition: '3 名', effect: '削减法抗 · 范围内反隐' },
  { covenant: '绝技', condition: '5 名精锐', effect: '精锐干员技力消耗 −30%' },
] as const;

/** 附加的生效条件，对应 COVENANTS.scaling 的索引；不依赖解析展示文案。 */
export const SCALING_CONDITIONS: Readonly<Record<string, Readonly<Record<number, string>>>> = {
  炎: { 1: '6 名不同炎' },
  萨尔贡: { 1: '6 名不同萨尔贡', 2: '6 名不同萨尔贡 · 技能期间' },
  维多利亚: { 0: '携带装备的维多利亚' },
  谢拉格: { 0: '谢拉格攻击寒冷 / 冻结敌人' },
  叙拉古: { 2: '6 名不同叙拉古 · 敌人至少 2 种异常' },
  乌萨斯: { 2: '6 名不同乌萨斯 · 阻挡时' },
  莱塔尼亚: { 1: '6 名不同莱塔尼亚' },
  迅捷: { 0: '技能结束时' },
  坚守: { 1: '3 名坚守' },
  不屈: { 0: '地面干员倒下时' },
  聚合: { 1: '3 名聚合' },
  奥术: { 1: '3 名奥术' },
};

/** 模式 ID 与 DISPATCH_BY_MODE 保持同一索引，避免复用领袖难度误选费用表。 */
export const SHOP_MODE_IDS = ['advanced', 'standard', 'fast'] as const;
