import type { Leader, MapPos, StageEscort } from './types.ts';

/**
 * 领袖（最终回合首领）。
 *
 * 来源：ArknightsGameData activity_table.autoChessData.bossInfoDict（领袖名单与隐秘核心形态）、
 * enemy_handbook_table（能力描述，按原文精简措辞）；头像取自 PRTS「头像_敌人_<名称>.png」。
 *
 * hp          [标准, 险境, 绝境, 终极]
 * hiddenCore  隐秘核心 [险境, 绝境, 终极]；null = 无
 * damage      能力中出现的伤害 / 损伤类型
 * abilities / hiddenAbilities 的 text 写法：
 *   【技能】  技能名（引用其他技能时也这样写）
 *   <单位>    召唤物、部件等单位名
 *   {状态}    异常状态与损伤，如 {晕眩}、{神经损伤}
 * 游戏内只说明隐秘核心需「达成特定条件」，这里不写具体条件。
 *
 * stage / hiddenStage 取自关卡文件 levels/activities/act3autochess/
 *   level_act3autochess_h07_xx_s.json（领袖回合）与 h08_xx_s.json（隐秘核心回合），独立模拟版本。
 *   十张图地形相同（见 LEADER_MAP），区别只在领袖位置、巡逻路线与随行敌人。
 *   随行敌人的数量为单个场地的数量，能力摘自 enemy_handbook_table。
 * counters 由能力描述、随行敌人与路线推导，by 写明依据。
 * layout 为我方站位示意，依据同上；危险区尺寸取自 enemy_database.json 的技能参数（如环波 range_radius 1.5）。
 * 具体数值（20% / 50%、2%、25% / 15 秒 / 50%、1.5 / 1.6 格）取自 levels/enemydata/enemy_database.json。
 */

/**
 * 领袖关卡地图，[列, 行]，行从上往下。
 * grid  # 不可部署   . 可部署   _ 领袖平台   o 平台顶部   S 敌人出发点   E / i 出口
 * 独立模拟只用左半场（列 1–7）；联合模拟两人一图，右侧玩家镜像。
 */
export const LEADER_MAP = {
  grid: [
    '#################',
    '#......_o_......#',
    '#......___......#',
    '#......___......#',
    'E.......S.......E',
    '#i#############i#',
  ],
  spawn: [8, 4] as MapPos,
  exit: [1, 5] as MapPos,
  /** 地面敌人：沿底行走向左下出口 */
  walk: [[8, 4], [1, 4], [1, 5]] as readonly MapPos[],
  /** 妖怪：在左半场折返飞行 */
  fly: [[8, 4], [7, 4], [7, 1], [5, 1], [5, 4], [3, 4], [3, 1], [1, 1], [1, 4], [1, 5]] as readonly MapPos[],
  /** 每张领袖图都有的随行敌人 */
  common: [
    { name: '萨卡兹枯朽前锋', count: 22, note: '位于源石污染区内时攻击造成法术伤害' },
    { name: '妖怪', count: 22, fly: true, note: '不造成伤害' },
  ] as readonly StageEscort[],
} as const;

export const LEADERS: readonly Leader[] = [
  {
    name: '假想敌：胄', id: 'enemy_9013_acstmk', damage: ['物理', '法术'],
    hp: [283680, 945600, 2364000, 3940000], hiddenCore: [1641600, 4104000, 6840000],
    abilities: [
      { text: '随机选择目标发射射线，造成法术伤害' },
      { skill: '灭顶之灾', text: '对攻击力最高的干员发射<刺胄之弹>，落点处目标及周围 8 格{晕眩}较长时间并每秒受到物理伤害；飞行中攻击数次可击破' },
      { skill: '死亡集群', text: '周期性召唤<妖怪>；每击倒一只，胄受到最大生命值 2% 的真实伤害' },
      { text: '生命值低于 20% 后受到的物理与法术伤害降低 50%，【灭顶之灾】额外发射<刺胄之弹>' },
    ],
    hiddenAbilities: [
      { skill: '旧日的剑与锤', text: '以完全形态登场，带着<“斩胄之剑”>与<“破胄之锤”>' },
      { text: '剑与锤初始无敌，周期性飞向攻击力最低的干员自爆：目标及周围 8 格{晕眩}并每秒受到物理伤害，随后返回' },
      { text: '飞行途中失去无敌，受到一定次数伤害后被击落；击落后视为地面单位、受到的伤害增加，所受伤害按比例传给胄' },
    ],
    stage: {
      marks: [{ name: '胄', kind: 'boss', at: [8, 3] }],
      escorts: [{ name: '重装防御组长', count: 9 }],
    },
    hiddenStage: {
      marks: [
        { name: '胄', kind: 'boss', at: [8, 3] },
        { name: '斩胄之剑', kind: 'part', at: [10, 3] },
        { name: '破胄之锤', kind: 'part', at: [6, 3] },
      ],
      escorts: [{ name: '“帝国的甲胄”', count: 3, note: '出场锁定生命值最高的单位连续物理伤害；远程；攻击数次后蓄力三连击' }],
    },
    counters: [
      { tag: '分散', text: '攻击力最高的干员周围 8 格少放人：落点九宫格{晕眩}并持续物理伤害', by: '灭顶之灾' },
      { tag: '集火', text: '<刺胄之弹>飞行途中挨数次攻击即被击破，攻速快的干员能拦截', by: '灭顶之灾' },
      { tag: '对空', text: '召唤的<妖怪>会飞，每击倒一只胄掉 2% 最大生命：带上能打飞行单位的干员', by: '死亡集群' },
      { tag: '分散', text: '剑与锤飞向攻击力最低的干员：治疗、辅助周围 8 格留空', by: '旧日的剑与锤', hidden: true },
      { tag: '集火', text: '剑与锤飞行时可被击落；落地后受到的伤害增加并按比例传给胄', by: '旧日的剑与锤', hidden: true },
    ],
    layout: {
      slots: [
        { role: '坦', at: [7, 4] }, { role: '输', at: [6, 3] }, { role: '空', at: [6, 1] },
        { role: '输', at: [4, 1], mark: '攻击最高' }, { role: '疗', at: [5, 4] },
        { role: '坦', at: [2, 4] }, { role: '空', at: [1, 2] },
      ],
      zones: [{ shape: { kind: 'rect', at: [3, 1], w: 3, h: 2 }, label: '刺胄之弹 3×3' }],
    },
    hiddenLayout: {
      slots: [
        { role: '坦', at: [7, 4] }, { role: '输', at: [5, 3] }, { role: '空', at: [6, 1] },
        { role: '输', at: [4, 1], mark: '攻击最高' }, { role: '疗', at: [1, 2], mark: '攻击最低' },
        { role: '坦', at: [2, 4] }, { role: '空', at: [3, 3] },
      ],
      zones: [
        { shape: { kind: 'rect', at: [3, 1], w: 3, h: 2 }, label: '刺胄之弹 3×3' },
        { shape: { kind: 'rect', at: [1, 1], w: 2, h: 3 }, label: '剑与锤 3×3', tone: 'hc' },
      ],
    },
  },
  {
    name: '假想敌：铳', id: 'enemy_9017_achunt', damage: ['物理', '侵蚀'],
    hp: [162000, 540000, 1350000, 2250000], hiddenCore: [1435200, 3588000, 5980000],
    abilities: [
      { text: '优先攻击防御力最高的单位，攻击附带{侵蚀损伤}' },
      { text: '持续攻击同一目标时攻击速度逐渐提升' },
      { skill: '最终之罚', text: '停止攻击并大幅加速，冲向全场防御力最高的单位；期间无法被阻挡，对经过的单位造成物理伤害' },
    ],
    hiddenAbilities: [
      { skill: '未尽的告解', text: '场上出现<“碎铳之簧”>，铳受到的物理与法术伤害极大幅降低' },
      { skill: '盲信之誓', text: '与所有<“碎铳之簧”>连结：簧受到的伤害按比例传给铳和其他簧；站在连结线上的我方单位每秒受到物理伤害' },
      { skill: '末日布道', text: '持续把所有<“碎铳之簧”>拉向自身，期间簧大幅加速并免疫伤害，对经过的我方单位造成物理伤害' },
    ],
    stage: {
      marks: [{ name: '铳', kind: 'boss', at: [8, 2], path: [[7, 1], [1, 4], [7, 3]], loop: true }],
      escorts: [{ name: '愧悔魂灵圣杯', count: 2, fly: true, note: '分摊周围地面敌人受到的部分伤害' }],
    },
    hiddenStage: {
      marks: [
        { name: '铳', kind: 'boss', at: [8, 2], path: [[7, 1], [1, 4], [7, 3]], loop: true },
        { name: '碎铳之簧', kind: 'part', at: [7, 2], path: [[7, 4], [7, 1], [1, 4]], loop: true },
        { name: '碎铳之簧', kind: 'part', at: [8, 2] },
        { name: '碎铳之簧', kind: 'part', at: [9, 2] },
      ],
      escorts: [{ name: '假想敌：淤困', count: 2, note: '被阻挡时寄生目标：持续法术伤害，受到的{元素损伤}增加' }],
    },
    counters: [
      { tag: '阻挡', text: '铳会巡逻进你的半场：路线上放防御最高的阻挡干员', by: '巡逻路线' },
      { tag: '续航', text: '盯住防御最高的单位且越打越快，附带{侵蚀损伤}：主坦要有治疗', by: '特性' },
      { tag: '避让', text: '冲锋不可阻挡、伤害沿途单位：其他干员别挡在铳和主坦之间', by: '最终之罚' },
      { tag: '集火', text: '铳本体极大幅减伤，打<碎铳之簧>，伤害按比例传给铳', by: '未尽的告解', hidden: true },
      { tag: '避让', text: '铳与簧之间的连结线上每秒受物理伤害，别站在线上', by: '盲信之誓', hidden: true },
      { tag: '避让', text: '簧被拉回铳身边时免疫伤害并撞伤沿途单位', by: '末日布道', hidden: true },
    ],
    layout: {
      slots: [
        { role: '坦', at: [5, 2], mark: '防御最高' }, { role: '疗', at: [4, 1] },
        { role: '输', at: [2, 1] }, { role: '输', at: [3, 1] }, { role: '空', at: [6, 4] },
        { role: '坦', at: [7, 4] }, { role: '群', at: [1, 2] },
      ],
      zones: [{ shape: { kind: 'line', path: [[8, 2], [7, 1], [1, 4], [7, 3], [7, 1]] }, label: '巡逻 / 冲锋' }],
    },
    hiddenLayout: null,
  },
  {
    name: '假想敌：管', id: 'enemy_9021_acduml', damage: ['法术', '凋亡'],
    hp: [302400, 1008000, 2520000, 4200000], hiddenCore: [1732800, 4332000, 7220000],
    abilities: [
      { text: '在场时持续召唤【暗色的喟叹】形态<“余音”>，生命值低于一定比例后召唤间隔缩短' },
      { text: '优先攻击【暗色的喟叹】形态<“余音”>' },
      { skill: '裂管之奏', text: '对场上所有【暗色的喟叹】形态<“余音”>三连击，造成范围法术伤害和{凋亡损伤}' },
    ],
    hiddenAbilities: [
      { text: '<假想敌：弦>与管同时登场' },
    ],
    stage: {
      marks: [{ name: '管', kind: 'boss', at: [8, 3] }],
      escorts: [
        { name: '“余音”', count: 2, note: '只能被阻挡数≥2 的单位阻挡；受击时范围法术伤害和{凋亡损伤}' },
        { name: '堂皇', count: 2, note: '周期性使周围敌人{隐匿}；死亡后生成<铁灯盘>' },
      ],
    },
    hiddenStage: {
      marks: [
        { name: '管', kind: 'boss', at: [7, 3] },
        { name: '弦', kind: 'part', at: [7, 3] },
      ],
      escorts: [
        { name: '“余音”', count: 2, note: '只能被阻挡数≥2 的单位阻挡；受击时范围法术伤害和{凋亡损伤}' },
        { name: '假想敌：再生', count: 2, note: '被击倒后进入再生，给周围敌人加护盾，一段时间后重生' },
      ],
    },
    counters: [
      { tag: '法抗', text: '全是法术伤害加{凋亡损伤}：阻挡位优先法抗高的干员', by: '伤害类型' },
      { tag: '阻挡', text: '<余音>只能被阻挡数≥2 的干员挡住', by: '余音' },
      { tag: '避让', text: '以每个暗色<余音>为中心范围三连击：余音身边别堆人，尽快清掉', by: '裂管之奏' },
      { tag: '集火', text: '<弦>永久无敌，管倒下时一起离场：只打管', by: '弦', hidden: true },
      { tag: '避让', text: '<弦>以金黄<余音>为中心打大范围法术伤害', by: '断弦之奏', hidden: true },
    ],
    layout: {
      slots: [
        { role: '坦', at: [7, 4] }, { role: '坦', at: [6, 4], mark: '双坦 阻挡≥2' },
        { role: '疗', at: [4, 3] }, { role: '输', at: [3, 1] }, { role: '输', at: [4, 1] },
        { role: '群', at: [5, 1] }, { role: '坦', at: [2, 4] },
      ],
      zones: [{ shape: { kind: 'rect', at: [5, 3], w: 3, h: 2 }, label: '余音溅射' }],
    },
    hiddenLayout: null,
  },
  {
    name: '盐风主教昆图斯', id: 'enemy_1521_dslily', damage: ['物理', '法术', '神经'],
    hp: [314640, 1048800, 2622000, 4370000], hiddenCore: null,
    abilities: [
      { text: '同时攻击防御力最高的两个单位' },
      { skill: '大潮', text: '对所有我方单位造成法术伤害和{神经损伤}' },
      { skill: '崩坍', text: '对若干我方单位造成物理伤害' },
      { skill: '断裂生殖', text: '召唤子代缠绕我方单位，使其{晕眩}' },
      { skill: '物种爆发', text: '战斗经过较长时间后，扣除所有目标生命' },
    ],
    hiddenAbilities: [],
    stage: {
      marks: [{ name: '昆图斯', kind: 'boss', at: [8, 3] }],
      escorts: [{ name: '复核洋流使者', count: 5, note: '吞噬<赘生甲壳>后攻击力和生命值大幅提升' }],
    },
    hiddenStage: null,
    counters: [
      { tag: '限时', text: '战斗越久、生命越低，攻击力越高、技能越频繁：速战速决', by: '特性' },
      { tag: '续航', text: '同时打防御最高的两个单位：准备两个能扛的阻挡位', by: '特性' },
      { tag: '法抗', text: '全体法术伤害加{神经损伤}', by: '大潮' },
      { tag: '集火', text: '<复核洋流使者>吃到<赘生甲壳>会大幅变强，优先击杀', by: '复核洋流使者' },
    ],
    layout: {
      slots: [
        { role: '坦', at: [7, 4], mark: '防御最高' }, { role: '坦', at: [5, 4], mark: '防御次高' },
        { role: '疗', at: [6, 2] }, { role: '输', at: [4, 2] }, { role: '输', at: [3, 1] },
        { role: '群', at: [4, 3] }, { role: '空', at: [2, 2] },
      ],
      zones: [],
    },
    hiddenLayout: null,
  },
  {
    name: '阿利斯泰尔，帝国余晖', id: 'enemy_9032_aclionk', damage: ['物理', '法术'],
    hp: [266400, 888000, 2220000, 3700000], hiddenCore: null,
    abilities: [
      { skill: '王权号令', text: '锁定一个我方单位及其周围 4 格，造成一次高额物理伤害，并在这些地块上生成随机装备' },
      { skill: '莫非王土', text: '场上有装备时活化一件，不同装备效果不同' },
      { text: '生命值降至一半及以下时防御力大幅提升、法术抗性 +45，【莫非王土】每次活化两件' },
      { skill: '斥退', text: '战斗经过较长时间后，对全场我方单位造成法术溅射伤害，并扣除所有目标生命' },
    ],
    hiddenAbilities: [],
    stage: {
      marks: [
        { name: '阿利斯泰尔', kind: 'boss', at: [8, 3] },
        { name: '萨科塔昂首', kind: 'unit', at: [8, 1], path: [[7, 2], [5, 2], [4, 3], [2, 3], [1, 4], [1, 5]] },
      ],
      escorts: [{ name: '“萨科塔昂首”', count: 2, fly: true, note: '【祈祷邀约】降低全场我方单位攻击速度；生命首次低于一半时{恐惧}' }],
    },
    hiddenStage: null,
    counters: [
      { tag: '集火', text: '半血后防御大幅提升、法抗 +45，一次活化两件装备：爆发留到半血前', by: '特性' },
      { tag: '分散', text: '锁定一名干员及上下左右 4 格高额物理伤害：别十字相邻', by: '王权号令' },
      { tag: '对空', text: '<萨科塔昂首>从平台顶部飞出，降低全场攻速，优先击落', by: '萨科塔昂首' },
    ],
    layout: {
      slots: [
        { role: '坦', at: [7, 4] }, { role: '空', at: [6, 3] }, { role: '输', at: [5, 2] },
        { role: '疗', at: [4, 3] }, { role: '坦', at: [3, 4] }, { role: '输', at: [4, 1] },
        { role: '群', at: [2, 1] },
      ],
      zones: [{ shape: { kind: 'cross', at: [5, 2] }, label: '王权号令 十字' }],
    },
    hiddenLayout: null,
  },
  {
    name: '“萨米的意志”', id: 'enemy_9033_acdeer', damage: ['物理', '法术'],
    hp: [290880, 969600, 2424000, 4040000], hiddenCore: null,
    abilities: [
      { skill: '冰凌', text: '攻击时对整列我方单位造成物理伤害' },
      { skill: '自然涌动', text: '使一名我方单位{晕眩}并持续受到法术伤害' },
      { text: '生命值低于一半时受到的物理和法术伤害降低，【冰凌】和【自然涌动】额外选择一个目标' },
    ],
    hiddenAbilities: [],
    stage: {
      marks: [{ name: '萨米的意志', kind: 'boss', at: [8, 3] }],
      escorts: [
        { name: '冰爆源石虫', count: 5, note: '死亡时对周围造成物理伤害并{寒冷}' },
        { name: '游击队盾卫', count: 4, note: '自身容易受到攻击（吸引火力）' },
      ],
    },
    hiddenStage: null,
    counters: [
      { tag: '分散', text: '攻击打整列：同一列别放多名干员', by: '冰凌' },
      { tag: '续航', text: '{晕眩}一名干员并持续法术伤害；半血后多选一个目标', by: '自然涌动' },
      { tag: '避让', text: '<冰爆源石虫>死亡时周围物理伤害加{寒冷}，别在阻挡点附近堆人', by: '冰爆源石虫' },
    ],
    layout: {
      slots: [
        { role: '坦', at: [7, 4] }, { role: '输', at: [6, 2] }, { role: '疗', at: [5, 3] },
        { role: '输', at: [4, 1] }, { role: '空', at: [3, 3] }, { role: '坦', at: [2, 4] },
        { role: '群', at: [1, 2] },
      ],
      zones: [{ shape: { kind: 'col', x: 6 }, label: '冰凌 整列' }],
    },
    hiddenLayout: null,
  },
  {
    name: '假想敌：械', id: 'enemy_9029_acfnc', damage: ['物理'],
    hp: [239400, 798000, 1995000, 3325000], hiddenCore: [1254000, 3135000, 5225000],
    abilities: [
      { text: '攻击命中时，在目标位置或周围召唤<量变之械>' },
      { skill: '洪流攻势', text: '在阻挡数最高的我方单位周围召唤<量变之械>' },
      { text: '生命值低于 50% 时召唤<冲击之械>，受到来自<冲击之械>方向的伤害降低' },
    ],
    hiddenAbilities: [
      { text: '攻击在多个目标间跳跃，每跳伤害降低；登场即召唤<冲击之械>' },
      { skill: '威光冲击', text: '<冲击之械>向两侧飞出，经过数个我方单位或到达最远处时砸下，造成大量物理伤害；两个<冲击之械>之间的我方单位攻击速度大幅降低' },
      { text: '<冲击之械>受到伤害时缓慢反向移动，撞上械则销毁场上所有<冲击之械>' },
      { skill: '衰颓与复兴', text: '销毁并重新召唤<冲击之械>' },
    ],
    stage: {
      marks: [{ name: '械', kind: 'boss', at: [8, 3] }],
      escorts: [{ name: '搏命享受者', count: 3, note: '周围敌人受到的物理和法术伤害降低' }],
    },
    hiddenStage: {
      marks: [{ name: '械', kind: 'boss', at: [8, 3] }],
      escorts: [{ name: '搏命享受者', count: 3, note: '周围敌人受到的物理和法术伤害降低' }],
    },
    counters: [
      { tag: '控制', text: '阻挡数最高的干员身边会刷<量变之械>：给它配范围输出', by: '洪流攻势' },
      { tag: '集火', text: '命中处也会刷<量变之械>，要持续清场', by: '特性' },
      { tag: '集火', text: '半血后来自<冲击之械>方向的伤害降低，从另一侧输出', by: '特性' },
      { tag: '集火', text: '打<冲击之械>能把它推回去，撞上械时全部销毁', by: '威光冲击', hidden: true },
      { tag: '避让', text: '两个<冲击之械>之间的干员攻速大幅降低', by: '威光冲击', hidden: true },
    ],
    layout: {
      slots: [
        { role: '坦', at: [7, 4] }, { role: '坦', at: [4, 4], mark: '阻挡最高' },
        { role: '群', at: [4, 2] }, { role: '群', at: [2, 3] }, { role: '疗', at: [5, 2] },
        { role: '输', at: [6, 2] }, { role: '空', at: [2, 1] },
      ],
      zones: [{ shape: { kind: 'rect', at: [3, 3], w: 3, h: 2 }, label: '量变之械' }],
    },
    hiddenLayout: null,
  },
  {
    name: '假想敌：茧', id: 'enemy_9035_acspider', damage: ['物理', '真实'],
    hp: [298800, 996000, 2490000, 4150000], hiddenCore: [1892400, 4731000, 7885000],
    abilities: [
      { text: '对每个场地当前生命值最高的 3 个我方单位造成远程物理伤害' },
      { text: '每损失 25% 生命值进入 15 秒伪装，物理和法术闪避 50%' },
      { skill: '淤困捕食', text: '在若干我方单位脚下召唤<淤困之茧>，使其无法攻击、阻挡和开启技能' },
    ],
    hiddenAbilities: [
      { text: '普通攻击附带中毒，每个场地额外选择一个目标；【淤困捕食】目标数增加；伪装闪避提高到 80%' },
      { skill: '悲惨之雨', text: '酸雨覆盖一片场地，场上我方单位攻击速度下降并持续受到真实伤害' },
    ],
    stage: {
      marks: [{ name: '茧', kind: 'boss', at: [8, 3] }],
      escorts: [{ name: '恶尘源石虫', count: 4, note: '死亡时对周围造成物理伤害并生成源石污染区' }],
    },
    hiddenStage: {
      marks: [{ name: '茧', kind: 'boss', at: [8, 3] }],
      escorts: [{ name: '假想敌：丛生', count: 3, note: '对每个目标的首次伤害提升，并使其一段时间内无法被治疗' }],
    },
    counters: [
      { tag: '续航', text: '每次打当前生命最高的 3 个干员：高血量干员要有治疗', by: '特性' },
      { tag: '集火', text: '每掉 25% 生命伪装 15 秒、闪避 50%：爆发技能避开这段', by: '特性' },
      { tag: '阻挡', text: '若干干员会被<淤困之茧>捆住，无法攻击、阻挡、开技能：别只靠一个阻挡点', by: '淤困捕食' },
      { tag: '法抗', text: '<恶尘源石虫>死后留下源石污染区，<萨卡兹枯朽前锋>在区内改打法术伤害', by: '恶尘源石虫' },
      { tag: '分散', text: '酸雨覆盖一片场地：降攻速并持续真实伤害', by: '悲惨之雨', hidden: true },
      { tag: '续航', text: '<丛生>使目标一段时间无法被治疗，普攻还附带中毒', by: '假想敌：丛生', hidden: true },
    ],
    layout: {
      slots: [
        { role: '坦', at: [7, 4], mark: '生命高' }, { role: '坦', at: [3, 4], mark: '生命高' },
        { role: '疗', at: [5, 2] }, { role: '输', at: [6, 2] }, { role: '输', at: [4, 1] },
        { role: '空', at: [2, 2] }, { role: '群', at: [5, 4] },
      ],
      zones: [],
    },
    hiddenLayout: null,
  },
  {
    name: '假想敌：鳍', id: 'enemy_9037_aceel', damage: ['法术', '神经'],
    hp: [151200, 504000, 1260000, 2100000], hiddenCore: [1482000, 3705000, 6175000],
    abilities: [
      { text: '攻击附带{神经损伤}' },
      { text: '未被阻挡时获得特殊护盾，受到的物理与法术伤害降低；被阻挡时消耗护盾，下次攻击伤害提升' },
      { skill: '离子环波', text: '对周围 1.5 格内所有我方单位造成法术伤害和{神经损伤}；可被沉默' },
    ],
    hiddenAbilities: [
      { text: '攻击在多个我方单位间跳跃，每跳伤害降低；连续攻击同一目标时伤害提升、跳跃次数增加' },
      { text: '在场时变为雷暴天气，周期性雷击站位密集的我方单位' },
    ],
    stage: {
      marks: [
        { name: '鳍', kind: 'boss', at: [8, 2], path: [[7, 1], [1, 4], [7, 3]], loop: true },
        { name: '纤核漂游者', kind: 'unit', at: [8, 4], path: [[6, 1], [5, 4], [3, 1], [1, 5]] },
      ],
      escorts: [{ name: '纤核漂游者', count: 3, fly: true, note: '优先攻击高台单位，攻击附带{神经损伤}' }],
    },
    hiddenStage: {
      marks: [{ name: '鳍', kind: 'boss', at: [8, 2], path: [[7, 1], [1, 4], [7, 3]], loop: true }],
      escorts: [{ name: '假想敌：淤困', count: 2, note: '被阻挡时寄生目标：持续法术伤害，受到的{元素损伤}增加' }],
    },
    counters: [
      { tag: '阻挡', text: '没被挡住时带减伤护盾：巡逻路线上一定要有人挡', by: '特性' },
      { tag: '续航', text: '被挡住后下一击伤害提升：阻挡位要扛得住', by: '特性' },
      { tag: '控制', text: '环波半径 1.5 格且可被沉默：阻挡位附近少放人，带沉默更稳', by: '离子环波' },
      { tag: '对空', text: '<纤核漂游者>会飞，附带{神经损伤}', by: '纤核漂游者' },
      { tag: '分散', text: '雷暴周期性劈站位密集处；攻击还会在干员间跳跃', by: '雷暴天气', hidden: true },
    ],
    layout: {
      slots: [
        { role: '坦', at: [5, 2], mark: '法抗高' }, { role: '坦', at: [7, 4] },
        { role: '疗', at: [3, 2] }, { role: '输', at: [2, 1] }, { role: '输', at: [1, 3] },
        { role: '空', at: [5, 4] },
      ],
      zones: [
        { shape: { kind: 'line', path: [[8, 2], [7, 1], [1, 4], [7, 3], [7, 1]] }, label: '巡逻路线' },
        { shape: { kind: 'rect', at: [4, 1], w: 3, h: 3 }, label: '离子环波 1.5 格' },
      ],
    },
    hiddenLayout: null,
  },
  {
    name: '矩兽', id: 'enemy_2124_dyjsfg', damage: ['物理'],
    hp: [140400, 468000, 1170000, 1950000], hiddenCore: null,
    abilities: [
      { skill: '明力', text: '{晕眩}、{寒冷}、{冻结}等异常状态持续时间大幅降低，受到的物理与法术伤害大幅降低；被阻挡或停止移动时减伤效果减少' },
      { skill: '尚同', text: '持续对周围 1.6 格造成物理伤害，每次被阻挡时额外造成一次高额物理伤害' },
      { skill: '非命', text: '生命值首次低于 50% 时，占用阻挡数、攻击力与移动速度提升' },
      { skill: '兼爱', text: '被击倒或退场时，使场上除<后兽>外的所有敌人退场，并对场上所有友方单位造成一次无视{隐匿}的高额物理伤害' },
    ],
    hiddenAbilities: [],
    stage: {
      marks: [{ name: '矩兽', kind: 'boss', at: [8, 2], path: [[7, 1], [1, 4], [7, 3]], loop: true }],
      escorts: [{ name: '山海众秘使', count: 2, note: '{隐匿}；隐匿失效后的下一次攻击伤害更高' }],
    },
    hiddenStage: null,
    counters: [
      { tag: '阻挡', text: '被阻挡或停下时减伤变少：必须挡住', by: '明力' },
      { tag: '续航', text: '每次被阻挡对周围额外一次高额物理伤害：阻挡位要硬，身边少放人', by: '尚同' },
      { tag: '控制', text: '{晕眩}{寒冷}{冻结}持续时间大幅缩短，控制收益低', by: '明力' },
      { tag: '阻挡', text: '占用阻挡数 3，首次半血后 +1：阻挡位要能挡 4', by: '非命' },
    ],
    layout: {
      slots: [
        { role: '坦', at: [5, 2], mark: '阻挡≥3' }, { role: '坦', at: [7, 4] },
        { role: '疗', at: [3, 3] }, { role: '输', at: [2, 1] }, { role: '输', at: [2, 4] },
        { role: '空', at: [6, 4] },
      ],
      zones: [
        { shape: { kind: 'line', path: [[8, 2], [7, 1], [1, 4], [7, 3], [7, 1]] }, label: '巡逻路线' },
        { shape: { kind: 'rect', at: [4, 1], w: 3, h: 3 }, label: '尚同 1.6 格' },
      ],
    },
    hiddenLayout: null,
  },
];
