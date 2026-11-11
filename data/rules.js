/** 罗马数字等阶标记，下标即等阶（0 留空） */
export const TIER_LABELS = ['', 'Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ'];
export const TIERS = [1, 2, 3, 4, 5, 6];

/** 调度中心：个人规程 / 联合险境及以上。V3_1 shopLevelDataDict。 */
export const DISPATCH_LEVELS = [
  { level: 1, upgradeCost: 5, operatorSlots: 3, equipmentSlots: 1 },
  { level: 2, upgradeCost: 8, operatorSlots: 4, equipmentSlots: 1 },
  { level: 3, upgradeCost: 11, operatorSlots: 4, equipmentSlots: 1 },
  { level: 4, upgradeCost: 12, operatorSlots: 5, equipmentSlots: 1 },
  { level: 5, upgradeCost: 13, operatorSlots: 5, equipmentSlots: 1 },
  { level: 6, upgradeCost: null, operatorSlots: 5, equipmentSlots: 1 },
];

/** 联合标准与极速有独立的升级费用、栏位表。 */
const dispatchRows = (costs, slots) => costs.map((upgradeCost, i) => ({
  level: i + 1, upgradeCost, operatorSlots: slots[i], equipmentSlots: 1,
}));
export const DISPATCH_MODES = ['个人规程 / 险境以上', '联合标准', '极速模拟'];
export const DISPATCH_BY_MODE = [
  DISPATCH_LEVELS,
  dispatchRows([5, 8, 10, 11, 11, null], [3, 4, 4, 4, 4, 5]),
  dispatchRows([1, 1, 5, 8, 10, null], [3, 4, 4, 4, 4, 5]),
];
/** 干员基础购买价；特质改价优先于等阶基础价。 */
export function operatorPrice(operator) {
  return ['真理', '至简'].includes(operator.name) ? 1 : [0, 2, 3, 3, 3, 4, 4][operator.tier];
}

/** 各等阶干员练度：初始 / 精锐 */
export const TIER_STATS = [
  { tier: 1, base: '精一 Lv55 · 技能4', elite: '精二 Lv50 · 技能7 · 模组1' },
  { tier: 2, base: '精一 Lv60 · 技能4', elite: '精二 Lv55 · 技能7 · 模组1' },
  { tier: 3, base: '精二 Lv1 · 技能4', elite: '精二 Lv60 · 技能7 · 模组1' },
  { tier: 4, base: '精二 Lv1 · 技能4', elite: '精二 Lv60 · 技能7 · 模组1' },
  { tier: 5, base: '精二 Lv1 · 技能4', elite: '精二 Lv60 · 技能7 · 模组1' },
  { tier: 6, base: '精二 Lv1 · 技能4', elite: '精二 Lv60 · 技能7 · 模组3' },
];

/** 自己账号里练过的干员带来的属性加成 */
export const OWN_OPERATOR_BONUS = [
  { level: '精英一', atk: '+5%', def: '+5%', hp: '—' },
  { level: '精英二', atk: '+10%', def: '+5%', hp: '+5%' },
  { level: '精英二 60 级', atk: '+10%', def: '+10%', hp: '+10%' },
];

/** 联合模拟难度。efficiency = 认证效率 %，strength = 模拟强度 */
export const DIFFICULTIES = [
  { name: '入门协议', efficiency: 0, strength: null, note: '预设干员 · 无进度' },
  { name: '标准模拟', efficiency: 100, strength: 8, note: '14 回合' },
  { name: '险境模拟', efficiency: 120, strength: 13, note: '通关标准解锁' },
  { name: '绝境模拟', efficiency: 135, strength: 19, note: '追加敌人' },
  { name: '终极模拟', efficiency: 150, strength: 20, note: '绝境通关 3 次' },
];

/** 有进度的四档难度简称，顺序与 LEADERS[].hp 一致 */
export const MODES = ['标准', '险境', '绝境', '终极'];

/** 各难度的机变 / 悬赏决策回合（该回合结束后） */
export const DECISION_ROUNDS = { 标准: [2, 8], 险境: [5, 8], 绝境: [2, 8, 10], 终极: [2, 8, 10] };

/** 第 1–14 回合作战时限（秒），领袖回合固定 120 */
export const ROUND_TIME = [45, 45, 55, 55, 55, 70, 85, 85, 95, 95, 115, 115, 115, 120];

/** 通过第 N 回合的基础认证：autoChessData.roundScoreDataList；其他难度乘效率。 */
export const CREDIT = [10, 20, 30, 50, 70, 90, 110, 130, 150, 170, 200, 230, 260, 300];

/** 个人模拟规程等级。efficiency = 认证效率 %，strength = 模拟强度 */
export const SOLO_LEVELS = [
  { level: 1, efficiency: 100, strength: 0, note: '' },
  { level: 2, efficiency: 105, strength: 1, note: '' },
  { level: 3, efficiency: 110, strength: 2, note: '' },
  { level: 4, efficiency: 115, strength: 3, note: '' },
  { level: 5, efficiency: 120, strength: 4, note: '盟约池 26/26' },
  { level: 6, efficiency: 125, strength: 5, note: '' },
  { level: 7, efficiency: 130, strength: 6, note: '' },
  { level: 8, efficiency: 130, strength: 7, note: '' },
  { level: 9, efficiency: 135, strength: 8, note: '追加敌人 · 开放险境' },
  { level: 10, efficiency: 135, strength: 9, note: '' },
  { level: 11, efficiency: 140, strength: 10, note: '' },
  { level: 12, efficiency: 140, strength: 11, note: '' },
  { level: 13, efficiency: 145, strength: 12, note: '' },
  { level: 14, efficiency: 145, strength: 13, note: '' },
  { level: 15, efficiency: 150, strength: 14, note: '开放绝境' },
  { level: 16, efficiency: 150, strength: 15, note: '' },
  { level: 17, efficiency: 150, strength: 16, note: '' },
  { level: 18, efficiency: 150, strength: 17, note: '' },
  { level: 19, efficiency: 150, strength: 18, note: '' },
  { level: 20, efficiency: 150, strength: 19, note: '' },
];

/**
 * 领袖生命值
 * hp          [标准, 险境, 绝境, 终极]
 * hiddenCore  隐秘核心 [险境, 绝境, 终极]；null = 无
 */
export const LEADERS = [
  { name: '假想敌：胄', hp: [283680, 945600, 2364000, 3940000], hiddenCore: [1641600, 4104000, 6840000] },
  { name: '假想敌：铳', hp: [162000, 540000, 1350000, 2250000], hiddenCore: [1435200, 3588000, 5980000] },
  { name: '假想敌：管', hp: [302400, 1008000, 2520000, 4200000], hiddenCore: [1732800, 4332000, 7220000] },
  { name: '盐风主教昆图斯', hp: [314640, 1048800, 2622000, 4370000], hiddenCore: null },
  { name: '阿利斯泰尔，帝国余晖', hp: [266400, 888000, 2220000, 3700000], hiddenCore: null },
  { name: '“萨米的意志”', hp: [290880, 969600, 2424000, 4040000], hiddenCore: null },
  { name: '假想敌：械', hp: [239400, 798000, 1995000, 3325000], hiddenCore: [1254000, 3135000, 5225000] },
  { name: '假想敌：茧', hp: [298800, 996000, 2490000, 4150000], hiddenCore: [1892400, 4731000, 7885000] },
  { name: '假想敌：鳍', hp: [151200, 504000, 1260000, 2100000], hiddenCore: [1482000, 3705000, 6175000] },
  { name: '矩兽', hp: [140400, 468000, 1170000, 1950000], hiddenCore: null },
];

/** 战术特训敌人类型，每局随机 3 类 */
export const TRAINING = [
  { name: '特异', desc: '输出与承伤都高' },
  { name: '飞行', desc: '大量空中单位' },
  { name: '频次', desc: '需要一定攻击次数击破' },
  { name: '元素', desc: '造成元素损伤' },
  { name: '持续', desc: '持续性伤害' },
  { name: '隐匿', desc: '拥有隐匿' },
  { name: '折射', desc: '拥有折射' },
  { name: '致命', desc: '特定条件下高额伤害' },
  { name: '复苏', desc: '首次倒下后重生' },
];

/**
 * 悬赏敌人
 * funds  击败后获得的资金
 * when   发放时机：下场 / 之后每场 / 两场
 */
export const BOUNTIES = [
  { name: '源石虫·特训', funds: 0, when: '下场' },
  { name: '幽灵组长', funds: 1, when: '下场' },
  { name: '重装防御者', funds: 1, when: '下场' },
  { name: '碎骨', funds: 1, when: '下场' },
  { name: '弑君者', funds: 1, when: '下场' },
  { name: 'W', funds: 1, when: '下场' },
  { name: '法术大师A2', funds: 2, when: '下场' },
  { name: '山海众头目', funds: 2, when: '下场' },
  { name: '“萨科塔之眼”', funds: 2, when: '下场' },
  { name: '重弩突袭者', funds: 2, when: '下场' },
  { name: '萨卡兹百夫长', funds: 2, when: '下场' },
  { name: '“庞贝”', funds: 2, when: '下场' },
  { name: '大鲍勃', funds: 2, when: '下场' },
  { name: '元核孽生者', funds: 3, when: '下场' },
  { name: '腐败骑士', funds: 3, when: '下场' },
  { name: '凋零骑士', funds: 3, when: '下场' },
  { name: '喷气人', funds: 3, when: '下场' },
  { name: '“鼠王”', funds: 3, when: '下场' },
  { name: '澪', funds: 3, when: '下场' },
  { name: '陷落雪祀', funds: 3, when: '下场' },
  { name: '泥岩', funds: 4, when: '下场' },
  { name: '“遗弃者”', funds: 4, when: '下场' },
  { name: '杰斯顿·威廉姆斯', funds: 4, when: '下场' },
  { name: '“自在”', funds: 4, when: '下场' },
  { name: '“墓碑”', funds: 4, when: '下场' },
  { name: '“复仇者”', funds: 4, when: '下场' },
  { name: '锏', funds: 5, when: '下场' },
  { name: '扎罗，“狼之主”', funds: 5, when: '下场' },
  { name: '迷路的巨像', funds: 5, when: '下场' },
  { name: '“巨大的丑东西”', funds: 5, when: '下场' },
  { name: '山海众头目·多轮', funds: 1, when: '之后每场' },
  { name: '假想敌：蚀裂·多轮', funds: 1, when: '之后每场' },
  { name: '假想敌：黑云·多轮', funds: 1, when: '之后每场' },
  { name: '悬赏·飞行Ⅰ 妖怪', funds: 1, when: '两场' },
  { name: '悬赏·频次Ⅲ 清明', funds: 3, when: '两场' },
  { name: '悬赏·损伤Ⅲ 术师快艇', funds: 3, when: '两场' },
];
