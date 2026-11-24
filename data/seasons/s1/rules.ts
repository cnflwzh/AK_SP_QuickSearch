import type {DispatchLevel, SeasonRules} from '../../types.ts';

/** 调度中心：个人规程 / 联合险境及以上。V3_1 shopLevelDataDict。 */
const S1_DISPATCH_LEVELS: readonly DispatchLevel[] = [
  {level: 1, upgradeCost: 5, operatorSlots: 3, equipmentSlots: 1},
  {level: 2, upgradeCost: 8, operatorSlots: 4, equipmentSlots: 1},
  {level: 3, upgradeCost: 11, operatorSlots: 4, equipmentSlots: 1},
  {level: 4, upgradeCost: 12, operatorSlots: 5, equipmentSlots: 1},
  {level: 5, upgradeCost: 13, operatorSlots: 5, equipmentSlots: 1},
  {level: 6, upgradeCost: null, operatorSlots: 5, equipmentSlots: 1},
];

/** 联合标准与极速有独立的升级费用、栏位表。 */
const dispatchRows = (
  costs: readonly (number | null)[],
  slots: readonly number[],
): DispatchLevel[] =>
  costs.map((upgradeCost, i) => ({
    level: i + 1,
    upgradeCost,
    operatorSlots: slots[i],
    equipmentSlots: 1,
  }));

// 来自 V3_1 的 itemMaxCount、periodicalRewards 合计及限时商店价格 × 库存合计。
const creditCaps = {battle: 6250, objectives: 2500, limitedSpend: 8250};

export const S1_RULES: SeasonRules = {
  dealerDecoys: {
    transmute: [
      '雪祀之衣',
      '随身身份牌',
      '卫戍推荐信',
      '歌利亚头盔',
      '盟约之币',
      '多功能补剂',
      '虹彩活血饮料',
      'M3茧甲',
      '双模机械臂',
      '佣兵名牌',
      '不退者之盾',
      '瓶装烈性反应',
      '可靠怀表',
      '博士投影',
    ],
    consumable: [
      '卫戍推荐信',
      '佣兵名牌',
      '博士投影',
      '拟态物质',
      '多功能补剂',
      '源石溶剂',
      '变形同构体',
      '信标',
    ],
  },
  /** 罗马数字等阶标记，下标即等阶（0 留空） */
  tierLabels: ['', 'Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ'],
  tiers: [1, 2, 3, 4, 5, 6],
  dispatchLevels: S1_DISPATCH_LEVELS,
  dispatchModes: ['个人规程 / 险境以上', '联合标准', '极速模拟'],
  dispatchByMode: [
    S1_DISPATCH_LEVELS,
    dispatchRows([5, 8, 10, 11, 11, null], [3, 4, 4, 4, 4, 5]),
    dispatchRows([1, 1, 5, 8, 10, null], [3, 4, 4, 4, 4, 5]),
  ],
  /** 各等阶干员练度：初始 / 精锐 */
  tierStats: [
    {tier: 1, base: '精一 Lv55 · 技能4', elite: '精二 Lv50 · 技能7 · 模组1'},
    {tier: 2, base: '精一 Lv60 · 技能4', elite: '精二 Lv55 · 技能7 · 模组1'},
    {tier: 3, base: '精二 Lv1 · 技能4', elite: '精二 Lv60 · 技能7 · 模组1'},
    {tier: 4, base: '精二 Lv1 · 技能4', elite: '精二 Lv60 · 技能7 · 模组1'},
    {tier: 5, base: '精二 Lv1 · 技能4', elite: '精二 Lv60 · 技能7 · 模组1'},
    {tier: 6, base: '精二 Lv1 · 技能4', elite: '精二 Lv60 · 技能7 · 模组3'},
  ],
  /** 自己账号里练过的干员带来的属性加成 */
  ownOperatorBonus: [
    {level: '精英一', atk: '+5%', def: '+5%', hp: '—'},
    {level: '精英二', atk: '+10%', def: '+5%', hp: '+5%'},
    {level: '精英二 60 级', atk: '+10%', def: '+10%', hp: '+10%'},
  ],
  /** 备战助战补位上限：V3_1 constData.borrowCount（不限好友）。 */
  borrowLimit: 30,
  /** 联合模拟难度。efficiency = 认证效率 %，strength = 模拟强度 */
  difficulties: [
    {
      name: '入门协议',
      efficiency: 0,
      strength: null,
      note: '预设干员 · 无进度',
    },
    {name: '标准模拟', efficiency: 100, strength: 8, note: '14 回合'},
    {name: '险境模拟', efficiency: 120, strength: 13, note: '通关标准解锁'},
    {name: '绝境模拟', efficiency: 135, strength: 19, note: '追加敌人'},
    {name: '终极模拟', efficiency: 150, strength: 20, note: '绝境通关 3 次'},
  ],
  /** 有进度的四档难度简称，顺序与 LEADERS[].hp 一致 */
  modes: ['标准', '险境', '绝境', '终极'],
  /** 各难度的机变 / 悬赏决策回合（该回合结束后） */
  decisionRounds: {
    标准: [2, 8],
    险境: [5, 8],
    绝境: [2, 8, 10],
    终极: [2, 8, 10],
  },
  /** 第 1–14 回合作战时限（秒），领袖回合固定 120 */
  roundTime: [45, 45, 55, 55, 55, 70, 85, 85, 95, 95, 115, 115, 115, 120],
  /** 通过第 N 回合的基础认证：autoChessData.roundScoreDataList；其他难度乘效率。 */
  credit: [10, 20, 30, 50, 70, 90, 110, 130, 150, 170, 200, 230, 260, 300],
  /** 击败领袖额外获得的基础认证（同样按难度 / 规程效率缩放）。 */
  leaderCreditBonus: 50,
  creditCaps,
  quickCreditMode: {rounds: 9, efficiency: 100},
  /** 目标口径用于区分作战收入、总收入与限时商店累消。 */
  creditMilestones: [
    {
      kind: 'spend',
      value: 3000,
      title: '限时累消 · 主题',
      reward: '乌萨斯齐心团',
    },
    {
      kind: 'spend',
      value: 6000,
      title: '限时累消 · 家具',
      reward: '“卫戍之光”投币玩偶',
    },
    {kind: 'battle', value: creditCaps.battle, title: '作战上限'},
    {
      kind: 'total',
      value: creditCaps.battle + creditCaps.objectives,
      title: '总获取上限',
    },
  ],
  /** 个人模拟规程等级。efficiency = 认证效率 %，strength = 模拟强度 */
  soloLevels: [
    {level: 1, efficiency: 100, strength: 0, note: ''},
    {level: 2, efficiency: 105, strength: 1, note: ''},
    {level: 3, efficiency: 110, strength: 2, note: ''},
    {level: 4, efficiency: 115, strength: 3, note: ''},
    {level: 5, efficiency: 120, strength: 4, note: '盟约池 26/26'},
    {level: 6, efficiency: 125, strength: 5, note: ''},
    {level: 7, efficiency: 130, strength: 6, note: ''},
    {level: 8, efficiency: 130, strength: 7, note: ''},
    {level: 9, efficiency: 135, strength: 8, note: '追加敌人 · 开放险境'},
    {level: 10, efficiency: 135, strength: 9, note: ''},
    {level: 11, efficiency: 140, strength: 10, note: ''},
    {level: 12, efficiency: 140, strength: 11, note: ''},
    {level: 13, efficiency: 145, strength: 12, note: ''},
    {level: 14, efficiency: 145, strength: 13, note: ''},
    {level: 15, efficiency: 150, strength: 14, note: '开放绝境'},
    {level: 16, efficiency: 150, strength: 15, note: ''},
    {level: 17, efficiency: 150, strength: 16, note: ''},
    {level: 18, efficiency: 150, strength: 17, note: ''},
    {level: 19, efficiency: 150, strength: 18, note: ''},
    {level: 20, efficiency: 150, strength: 19, note: ''},
  ],
  /** 分组与代表敌人按本季特训名单；随机资格取自 autoChessData.enemyTypeDatas.involveRandom */
  training: [
    {
      name: '特异',
      randomCandidate: false,
      desc: '输出与承伤都高',
      attackStyle:
        '高攻击或高耐久的地面单位会混编推进。猎狗容易穿过空档，粉碎攻坚手的重击会晕眩阻挡者。',
      strategy:
        '先守住通路，再按敌人的防御和法抗选输出。前排接重击时，在后方留一个阻挡位接漏怪。',
      examples: ['猎狗pro', '粉碎攻坚手', '重装五十夫长'],
      tags: ['高输出', '高耐久'],
    },
    {
      name: '飞行',
      randomCandidate: true,
      desc: '大量空中单位',
      attackStyle:
        '空中单位越过地面阻挡。妖怪不攻击，法术大师A2从空中造成法术伤害，黑云还能吞噬其他飞行敌人补充弹药。',
      strategy:
        '让能攻击空中单位的干员覆盖飞行路线。遇到黑云时可提前清掉附近的普通飞行敌人。',
      examples: ['妖怪', '法术大师A2', '假想敌：黑云'],
      tags: ['飞行', '对空'],
    },
    {
      name: '频次',
      randomCandidate: true,
      desc: '需要一定攻击次数击破',
      attackStyle:
        '磨砻倒下后生成木制瑞印。假想敌：再生倒下后会给附近敌人加次数盾，本体的再生状态也需要多次命中才能击破。',
      strategy:
        '把高攻速或多段攻击覆盖在这些单位倒下的位置，及时清掉器物、次数盾和再生目标。',
      examples: ['磨砻', '深池逐火战士', '假想敌：再生'],
      tags: ['多次命中', '高频清理'],
    },
    {
      name: '元素',
      randomCandidate: true,
      desc: '造成元素损伤',
      attackStyle:
        '敌人会积累我方干员的元素损伤。控潮术师的攻击会对目标与周围四格附加侵蚀损伤；元核孽生者受击后会向周围施加神经损伤。',
      strategy:
        '用具备元素回复能力的干员保护承伤位，对十字溅射分散站位。留意神经损伤爆发带来的晕眩。',
      examples: ['控潮术师', '元核孽生者', '假想敌：淤困'],
      tags: ['元素损伤', '元素回复'],
    },
    {
      name: '持续',
      randomCandidate: true,
      desc: '持续性伤害',
      attackStyle:
        '伤害可能持续到敌人倒下之后。萨卡兹枯朽战士死亡时使附近干员持续流失生命，蚀裂会向击倒它的单位投出毒雾。',
      strategy:
        '治疗要覆盖击杀点和负责补刀的远程干员。让主力适当分散，减少同一片毒雾波及的人数。',
      examples: ['萨卡兹枯朽战士', '逐腐兽', '假想敌：蚀裂'],
      tags: ['持续掉血', '治疗覆盖'],
    },
    {
      name: '隐匿',
      randomCandidate: true,
      desc: '拥有隐匿',
      attackStyle:
        '隐匿敌人在未被阻挡时通常无法被直接选中。山海众头目破隐后的第一次攻击伤害更高；重弩突袭者会沿直线发射法术弩箭。',
      strategy:
        '用反隐提前集火，或在必经路线上阻挡显形。让脆弱输出避开重弩突袭者瞄准的行列。',
      examples: ['隐形弩手', '山海众头目', '重弩突袭者'],
      tags: ['隐匿', '反隐/阻挡'],
    },
    {
      name: '折射',
      randomCandidate: true,
      desc: '拥有折射',
      attackStyle:
        '折射使敌人法术抗性增加 70。镜膜在折射生效时还会提高生命上限，镜眼受到法术伤害会降低伤害来源的攻速。',
      strategy:
        '优先考虑物理、真实或元素输出。能沉默的目标可先解除折射，再投入法术火力。',
      examples: ['深池方阵战士', '假想敌：镜膜', '假想敌：镜眼'],
      tags: ['法抗 +70', '可沉默'],
    },
    {
      name: '致命',
      randomCandidate: true,
      desc: '特定条件下高额伤害',
      attackStyle:
        '不同敌人的触发条件各异。雪怪小队攻击冻结目标时伤害上升，寻路者狙击手有弹药时攻击力提高，丛生首次命中目标时伤害提高且禁疗。',
      strategy:
        '先看实际敌人。遇到雪怪注意防冻结，面对丛生则让能承受首击的前排接敌。',
      examples: ['雪怪小队', '寻路者狙击手', '假想敌：丛生'],
      tags: ['条件增伤', '首击威胁'],
    },
    {
      name: '复苏',
      randomCandidate: true,
      desc: '首次倒下后重生',
      attackStyle:
        '首次击倒后仍可能有敌人继续前进。萨卡兹子裔战士可重生为大君之触，变异岩蛛倒下后会分裂出多个畸变赘生物。',
      strategy:
        '保留持续输出，并让前排有余量拦住重生或分裂产生的目标。先后击倒可减轻短时间的阻挡压力。',
      examples: ['萨卡兹子裔战士', '变异岩蛛', '萨卡兹子裔工匠'],
      tags: ['重生', '分裂续战'],
    },
  ],
  /**
   * 悬赏敌人
   * funds  击败后获得的资金
   * when   追加敌人的场次：下场 / 之后每场 / 两场；资金逐只归击倒者
   */
  bounties: [
    {
      name: '源石虫·特训',
      enemyId: 'enemy_1007_slime',
      funds: 0,
      when: '下场',
      mobility: '地面',
      range: '近战',
      damage: '物理',
      mechanics: '低威胁基础近战地面单位，仅用于保底过渡，无额外资金奖励。',
      counter: '任意前排阻挡即可轻松清理；前期战力极弱不想翻车时才会选它保血。',
      tags: ['白给过渡', '低威胁'],
    },
    {
      name: '幽灵组长',
      enemyId: 'enemy_1026_aghost',
      funds: 1,
      when: '下场',
      mobility: '地面',
      range: '不攻击',
      damage: '无',
      mechanics: '不可被阻挡的高速穿线单位，不攻击我方但会直接冲向蓝门。',
      counter:
        '无法靠重装拦住，需要减速/控制留人并在其跑过防线前用集火输出打掉。',
      roles: ['控制'],
      tags: ['不可阻挡', '高速偷家'],
    },
    {
      name: '重装防御者',
      enemyId: 'enemy_1006_shield',
      funds: 1,
      when: '下场',
      mobility: '地面',
      range: '近战',
      damage: '物理',
      mechanics:
        '超高物理防御、极低法抗的慢速重甲单位，纯物理低攻干员容易抛光。',
      counter: '用法术输出、破甲或真伤轻松融化，随便放个阻挡位拦住即可。',
      roles: ['破抗', '真伤'],
      tags: ['高物防', '低法抗'],
    },
    {
      name: '碎骨',
      enemyId: 'enemy_1500_skulsr',
      funds: 1,
      when: '下场',
      mobility: '地面',
      range: '近远',
      damage: '物理',
      mechanics:
        '未被阻挡时发射物理榴弹，命中目标及周围单位并暂时降低防御。被阻挡后近战，半血以下攻击力大幅提升。',
      counter: '尽快用近战阻挡避免高台被榴弹炸伤，主力与脆皮略微分散站位。',
      roles: ['阻挡', '治疗'],
      tags: ['范围榴弹', '降防', '半血强化'],
    },
    {
      name: '弑君者',
      enemyId: 'enemy_1502_crowns',
      funds: 1,
      when: '下场',
      mobility: '地面',
      range: '近战',
      damage: '物理',
      mechanics:
        '被阻挡时会闪现越过阻挡者身后的格子（带冷却），容易直接绕过单防线漏怪。',
      counter:
        '采用前后双阻挡阵型接力拦住，或用晕眩/束缚等控制配合集火直接带走。',
      roles: ['控制', '阻挡'],
      tags: ['闪现穿盾', '高机动'],
    },
    {
      name: 'W',
      enemyId: 'enemy_1504_cqbw',
      funds: 1,
      when: '下场',
      mobility: '地面',
      range: '远程',
      damage: '物理',
      mechanics:
        '远程物理攻击，定时炸弹引爆时波及周围单位。生命低于一半时，一次使用的炸药包数量增加。',
      counter:
        '站位适当分散防止炸弹连片波及后排，有治疗覆盖即可稳接，趁早切掉。',
      roles: ['治疗'],
      tags: ['定时炸弹', '范围物伤'],
    },
    {
      name: '法术大师A2',
      enemyId: 'enemy_1041_lazerd_2',
      funds: 2,
      when: '下场',
      mobility: '飞行',
      range: '远程',
      damage: '法术',
      mechanics:
        '较慢的精英法伤无人机，自身法抗较高且能持续对地面与高台造成远程法术伤害。',
      counter: '必须备足物理对空输出快速击落，法伤对空打它效率偏低。',
      roles: ['对空'],
      tags: ['飞行', '高法抗', '远程法伤'],
    },
    {
      name: '山海众头目',
      enemyId: 'enemy_1299_ymkilr',
      funds: 2,
      when: '下场',
      mobility: '地面',
      range: '近战',
      damage: '物理',
      mechanics: '拥有隐匿，隐匿失效后的下一次攻击造成双倍物理伤害。',
      counter: '可用反隐提前集火；以阻挡破隐时，先让能承受强化首击的干员接敌。',
      roles: ['反隐', '阻挡'],
      tags: ['隐匿', '破隐强化首击'],
    },
    {
      name: '“萨科塔之眼”',
      enemyId: 'enemy_10084_hlegle',
      funds: 2,
      when: '下场',
      mobility: '飞行',
      range: '远程',
      damage: '物理',
      mechanics:
        '飞行单位，命中带弹药目标时不造成伤害而是扣 1 发弹药；首次低于半血时自我恐惧 5 秒并提速至 150%。',
      counter:
        '注意弹药干员可能被夺走弹药；面对没有弹药的目标时，它会改为造成高额物理伤害。用对空火力优先处理。',
      roles: ['对空', '控制'],
      tags: ['飞行', '扣弹药', '半血恐惧加速'],
    },
    {
      name: '重弩突袭者',
      enemyId: 'enemy_1404_msnip',
      funds: 2,
      when: '下场',
      mobility: '地面',
      range: '远程',
      damage: '法术',
      mechanics:
        '自带隐匿，与我方单位同一直线时会沿该方向射出弩箭，命中造成法术伤害和 5 秒晕眩。',
      counter: '用反隐提前处理；输出和治疗错开行列，避免与阻挡位同时被晕眩。',
      roles: ['反隐', '治疗'],
      tags: ['隐匿', '直线法伤', '晕眩'],
    },
    {
      name: '萨卡兹百夫长',
      enemyId: 'enemy_1501_demonk',
      funds: 2,
      when: '下场',
      mobility: '地面',
      range: '远程',
      damage: '法术',
      mechanics: '远程法术攻击，一次可以命中两个目标。',
      counter: '让治疗覆盖两个可能受击的干员；法抗能减轻持续承伤的压力。',
      roles: ['治疗'],
      tags: ['双目标', '远程法伤'],
    },
    {
      name: '“庞贝”',
      enemyId: 'enemy_1050_lslime',
      funds: 2,
      when: '下场',
      mobility: '地面',
      range: '远程',
      damage: '法术',
      mechanics:
        '最多同时攻击四名单位并灼烧目标。被阻挡时会发动范围自爆，生命降至一半后攻速提高。',
      counter:
        '用物理或真实伤害对付高法抗，治疗覆盖多个目标。近距离阻挡时，给其他干员留出躲开自爆的空间。',
      roles: ['治疗', '真伤'],
      tags: ['多目标法伤', '灼烧', '范围自爆'],
    },
    {
      name: '大鲍勃',
      enemyId: 'enemy_1001_bigbo',
      funds: 2,
      when: '下场',
      mobility: '地面',
      range: '近战',
      damage: '物理',
      mechanics: '移动慢，近战物理攻击高。基础防御 800、法术抗性 30。',
      counter: '在其接近前利用法术或真伤输出；需要阻挡时给前排安排治疗。',
      roles: ['阻挡', '破抗'],
      tags: ['重甲', '近战重击', '移动慢'],
    },
    {
      name: '元核孽生者',
      enemyId: 'enemy_1439_dslntf',
      funds: 3,
      when: '下场',
      mobility: '地面',
      range: '近战',
      damage: '物理',
      mechanics:
        '普攻造成物理伤害；受伤后进入临战状态，移速提升，并持续对周围单位造成神经损伤。',
      counter:
        '带元素回复防止前排吃满神经损伤晕眩漏怪，配合控制与集火在其冲阵前击杀。',
      roles: ['元素回复', '控制'],
      tags: ['受击加速', '周围神经损伤'],
    },
    {
      name: '腐败骑士',
      enemyId: 'enemy_1513_dekght',
      funds: 3,
      when: '下场',
      mobility: '地面',
      range: '近战',
      damage: '物理',
      mechanics:
        '普攻和蓄力重击都会对目标及其周围四格造成物理伤害。凋零骑士同时在场并先倒下时，腐败骑士会大幅强化。',
      counter:
        '用法术或真伤集中输出；其他干员和主坦错开十字相邻格，避免跟着吃重击。',
      roles: ['阻挡', '破抗', '控制'],
      tags: ['高物防', '超高单发重击'],
    },
    {
      name: '凋零骑士',
      enemyId: 'enemy_1513_dekght_2',
      funds: 3,
      when: '下场',
      mobility: '地面',
      range: '远程',
      damage: '法术',
      mechanics:
        '普攻可同时命中两名目标。技能向三名目标发射延时爆炸箭，对各自周围四格造成法术伤害。腐败骑士同时在场并先倒下时会强化。',
      counter:
        '用物理或真伤输出快速切掉，后排分散站位避免吃满箭雨并配群体治疗。',
      roles: ['治疗', '真伤'],
      tags: ['高法抗', '范围法术箭雨'],
    },
    {
      name: '喷气人',
      enemyId: 'enemy_2004_balloon',
      funds: 3,
      when: '下场',
      mobility: '地面',
      range: '近战',
      damage: '物理',
      mechanics:
        '一旦被阻挡就会起飞进入持续 7 秒的近地悬浮状态：变为不可阻挡、移速 +50% 且仅受对空攻击。',
      counter:
        '必须备有对空火力！可用前排主动触发其起飞后由防空干员集火打下，或直接用远程秒杀。',
      roles: ['对空'],
      tags: ['受阻起飞', '悬浮不可阻挡'],
    },
    {
      name: '“鼠王”',
      enemyId: 'enemy_1509_mousek',
      funds: 3,
      when: '下场',
      mobility: '地面',
      range: '远程',
      damage: '混伤',
      mechanics:
        '【唱沙】对生命上限最高的单位及其十字范围造成物理伤害。【沙狱】使生命上限最低的单位及其周围友方降攻，并持续受到法术伤害。入场时的法术屏障同时提高物防。',
      counter:
        '让最高生命上限的单位与队友错开行列，最低生命上限的单位远离主输出。用法术伤害先消耗屏障，直接集火时也可使用真伤。',
      roles: ['治疗', '真伤'],
      tags: ['法术屏障', '最高生命上限', '最低生命上限'],
    },
    {
      name: '澪',
      enemyId: 'enemy_10118_ymgprc',
      funds: 3,
      when: '下场',
      mobility: '地面',
      range: '近战',
      damage: '物理',
      mechanics:
        '高血高法抗（约 50 法抗）的近战精英，普通攻击为二连击，每数次攻击触发【寒晖】造成高倍率强力二连斩。',
      counter:
        '前排需高防御和充足治疗扛住二连斩，输出端优先物理破甲或真伤，法伤较吃亏。',
      roles: ['阻挡', '治疗', '破抗'],
      tags: ['高法抗', '近战二连击', '强化斩击'],
    },
    {
      name: '陷落雪祀',
      enemyId: 'enemy_2050_smsha',
      funds: 3,
      when: '下场',
      mobility: '地面',
      range: '远程',
      damage: '法术',
      mechanics:
        '远程法术攻击会附加寒冷，最多命中三个目标，跳跃时伤害递减。【反自然馈赠】能使其他敌人提高攻速与移速。',
      counter: '主力干员保持间距减少弹射冻结，配足治疗并尽快集中火力消灭。',
      roles: ['治疗'],
      tags: ['寒冷冻结', '3 目标弹射法伤'],
    },
    {
      name: '泥岩',
      enemyId: 'enemy_1511_mdrock',
      funds: 4,
      when: '下场',
      mobility: '地面',
      range: '近战',
      damage: '物理',
      mechanics:
        '攻击时永久提升攻击力，最多六层。周期性刷新的屏障吸收法术伤害；有盾时生命上限和攻速提高。',
      counter:
        '可用法术爆发破盾，或用物理、真实伤害直接削减生命。不要让同一前排长时间独自承受叠满后的攻击。',
      roles: ['阻挡', '真伤', '破抗'],
      tags: ['周期法术盾', '高防重击'],
    },
    {
      name: '“遗弃者”',
      enemyId: 'enemy_2005_axetro',
      funds: 4,
      when: '下场',
      mobility: '地面',
      range: '近远',
      damage: '物理',
      mechanics:
        '远近均可持续物理攻击。连续攻击叠加攻击与攻速，停止攻击 4 秒后清空加成。',
      counter:
        '覆盖其射程的控制需持续足够久才会清层。高防承伤时，用集中火力尽快结束战斗。',
      roles: ['控制', '快活'],
      tags: ['越打越痛', '断攻重置'],
    },
    {
      name: '杰斯顿·威廉姆斯',
      enemyId: 'enemy_1516_jakill',
      funds: 4,
      when: '下场',
      mobility: '地面',
      range: '近远',
      damage: '混伤',
      mechanics:
        '双形态重生：一形态高法抗远程法伤且带 2 目标 3 秒晕眩；倒地重生切二形态后物防大涨、改近战物理二连无视 60% 防御。',
      counter:
        '一形态用物理打，二形态转法伤/真伤；留足主坦治疗或控制扛住二形态破甲二连击。',
      roles: ['阻挡', '真伤', '控制'],
      tags: ['重生双形态', '远程晕眩', '无视 60% 防御'],
    },
    {
      name: '“自在”',
      enemyId: 'enemy_1517_xi',
      funds: 4,
      when: '下场',
      mobility: '地面',
      range: '远程',
      damage: '法术',
      mechanics:
        '首条生命耗尽后重生，二阶段普攻两次。【纬地经天】会攻击最近目标，二阶段还会攻击最远目标；【破桎而出】的屏障未及时打破会引发范围伤害。',
      counter:
        '让最近与最远的单位都能得到治疗，留集中火力处理【破桎而出】的屏障。',
      roles: ['治疗', '阻挡'],
      tags: ['重生', '十字法伤', '限时破盾'],
    },
    {
      name: '“墓碑”',
      enemyId: 'enemy_2008_flking',
      funds: 4,
      when: '下场',
      mobility: '地面',
      range: '近远',
      damage: '物理',
      mechanics:
        '在场时削弱我方攻防，并周期性获得相当于自身最大生命 10% 的伤害屏障；未被阻挡时可进行远程物理攻击。',
      counter:
        '按攻防被削弱后的强度安排承伤和治疗。集中输出清除屏障，注意远程攻击波及后排。',
      roles: ['阻挡', '治疗', '破抗'],
      tags: ['全伤屏障', '九宫格溅射', '高物攻'],
    },
    {
      name: '“复仇者”',
      enemyId: 'enemy_1539_reid',
      funds: 4,
      when: '下场',
      mobility: '地面',
      range: '近战',
      damage: '物理',
      mechanics:
        '半血以下攻击力暴增 +180%；未被阻挡时会锁定前方目标高速冲锋；首次倒下后 5 秒重生并恢复 50% 生命。',
      counter:
        '半血与重生后极易秒坦！用硬坦配控、快活垫刀，或留大招在压过半血后一口气灌死。',
      roles: ['控制', '快活', '阻挡'],
      tags: ['半血 +180% 攻', '高速冲锋', '重生'],
    },
    {
      name: '锏',
      enemyId: 'enemy_1525_blkswb',
      funds: 5,
      when: '下场',
      mobility: '地面',
      range: '近战',
      damage: '物理',
      mechanics:
        '双形态重生（10 秒无敌）：一形态无视 20% 防；二形态自带隐匿、近战二连无视 40% 防，且每掉 25% 血发动【瞬息杀机】大范围缴械+清空技力 10 秒。',
      counter:
        '极高危 +5 悬赏！必须备反隐与硬坦，核心输出尽量拉开 2.8 格避开缴械清技力，无敌结束后再交爆发。',
      roles: ['反隐', '阻挡', '治疗'],
      tags: ['二形态隐匿', '大范围缴械清技力', '无视 40% 防', '重生'],
    },
    {
      name: '扎罗，“狼之主”',
      enemyId: 'enemy_1535_wlfmster',
      funds: 5,
      when: '下场',
      mobility: '地面',
      range: '近远',
      damage: '物理',
      mechanics:
        '失衡免疫且一形态免疫晕眩，技能大幅降攻速并令目标无法撤退持续掉血；倒地重生后转高攻速远程二连击并带近身降攻速光环。',
      counter:
        '极高危 +5 悬赏！依赖群体治疗扛住持续掉血，利用二形态前摇与远程站位错开近身降攻速圈。',
      roles: ['治疗', '阻挡', '破抗'],
      tags: ['重生无敌', '降攻速光环', '持续掉血', '二形态远程二连'],
    },
    {
      name: '迷路的巨像',
      enemyId: 'enemy_2003_rockman',
      funds: 5,
      when: '下场',
      mobility: '地面',
      range: '近远',
      damage: '物理',
      mechanics:
        '近战重击造成物理伤害，远程投石能使目标晕眩 25 秒，已晕眩的单位不会被下一次投石选中。',
      counter:
        '避免防线只靠一个阻挡位；安排其他干员接怪或持续输出，让治疗覆盖可能被投石的目标。',
      roles: ['阻挡', '治疗'],
      tags: ['近战重击', '25 秒晕眩'],
    },
    {
      name: '“巨大的丑东西”',
      enemyId: 'enemy_1512_mcmstr',
      funds: 5,
      when: '下场',
      mobility: '地面',
      range: '近远',
      damage: '物理',
      mechanics:
        '机甲远程攻击造成物理溅射，近战伤害更高。生命归零后机甲自爆造成范围晕眩，随后驾驶员大祭司脱出；大祭司无法阻挡，并会持续失去生命。',
      counter:
        '为机甲自爆预留距离，并把输出覆盖到机甲倒下后的行进路线，及时处理脱出的驾驶员。',
      roles: ['破抗', '真伤', '治疗'],
      tags: ['物理溅射', '自爆晕眩', '驾驶员不可阻挡'],
    },
    {
      name: '山海众头目·多轮',
      enemyId: 'enemy_1299_ymkilr',
      funds: 1,
      when: '之后每场',
      mobility: '地面',
      range: '近战',
      damage: '物理',
      mechanics:
        '后续每场追加一只带隐匿的山海众头目，击倒该只敌人的玩家获得 1 资金。破隐后首击伤害翻倍。',
      counter: '反隐可使远程输出提前开火；用前排接敌时留足承伤余量。',
      roles: ['反隐', '阻挡'],
      tags: ['多轮悬赏', '隐匿', '破隐强化首击'],
    },
    {
      name: '假想敌：蚀裂·多轮',
      enemyId: 'enemy_9006_actoxi',
      funds: 1,
      when: '之后每场',
      mobility: '地面',
      range: '近战',
      damage: '法术',
      mechanics:
        '近战法术源石造物；非沉默状态下被击倒时会朝击杀者投掷毒雾，持续对周围造成法术伤害。',
      counter:
        '沉默可阻止毒雾，用远程补刀时把击倒者与其他干员分开，并让治疗覆盖落点。',
      roles: ['沉默', '治疗'],
      tags: ['多轮滚经济', '亡语毒雾', '可沉默'],
    },
    {
      name: '假想敌：黑云·多轮',
      enemyId: 'enemy_9009_acfort',
      funds: 1,
      when: '之后每场',
      mobility: '飞行',
      range: '远程',
      damage: '物理',
      mechanics:
        '会束缚并吞噬附近的普通飞行敌人，按吞噬数量补充弹药；攻击时会一次消耗现有的全部弹药。',
      counter:
        '用对空火力击落黑云或提前清掉它附近的普通飞行敌人，减少弹药带来的物理爆发。',
      roles: ['对空', '治疗'],
      tags: ['多轮滚经济', '飞行', '吞噬充能爆发'],
    },
    {
      name: '悬赏·飞行Ⅰ 妖怪',
      enemyId: 'enemy_1005_yokai',
      funds: 1,
      when: '两场',
      mobility: '飞行',
      range: '不攻击',
      damage: '无',
      mechanics:
        '接下来两场各追加一只妖怪。它不攻击，也不受地面阻挡；每只由击倒者获得 1 资金。',
      counter: '让对空干员覆盖飞行路线，避免妖怪飞出火力范围。',
      roles: ['对空'],
      tags: ['飞行', '不攻击', '两场各一只'],
    },
    {
      name: '悬赏·频次Ⅲ 清明',
      enemyId: 'enemy_1209_sfden',
      funds: 3,
      when: '两场',
      mobility: '地面',
      range: '近战',
      damage: '法术',
      mechanics:
        '周期性使周围其他敌人隐匿；死亡后生成一个铜灯盘。灯盘无法阻挡，需要造成 35 次伤害才能击破。',
      counter:
        '用反隐或阻挡处理被掩护的敌人，并让多段或高攻速输出覆盖铜灯盘的路线。',
      roles: ['高频', '反隐'],
      tags: ['隐匿光环', '35 次命中', '两场各一只'],
    },
    {
      name: '悬赏·损伤Ⅲ 术师快艇',
      enemyId: 'enemy_1162_magmot',
      funds: 3,
      when: '两场',
      mobility: '地面',
      range: '远程',
      damage: '法术',
      mechanics:
        '远程范围法术攻击（目标及周围 4 格）并附带侵蚀损伤（满 1000 永降 100 防并炸 800 物伤）；快艇毁坏后车上术师仍会继续作战。',
      counter:
        '携带元素回复清侵蚀条，前排与输出十字错开站位减少溅射，打碎快艇后记得补刀术师。',
      roles: ['元素回复', '治疗'],
      tags: ['侵蚀损伤', '十字溅射', '毁船留人'],
    },
  ],
  /** 敌人与 Boss 通用名词、异常状态、元素损伤词典 */
  enemyGlossary: {
    隐秘核心: {
      term: '隐秘核心',
      kind: 'mechanic',
      desc: '个人规程等级 5 或联合险境及以上，通过第 14 回合并满足特定条件后可进入额外回合。核心形态的生命与技能随领袖而异；挑战失败仍算通关。',
    },
    巡逻: {
      term: '巡逻',
      kind: 'mechanic',
      desc: '该 Boss 会离开中心平台沿固定路线进入我方半场巡逻；需要在巡逻路径上安排高坦阻挡位，并让后排与路线错开。',
    },
    侵蚀损伤: {
      term: '侵蚀损伤',
      kind: 'status',
      desc: '我方单位累计满 1000 点侵蚀损伤时，受到 800 物理伤害并永久降低 100 点防御力（可叠加）。元素回复能在爆发前减少积累值。',
    },
    凋亡损伤: {
      term: '凋亡损伤',
      kind: 'status',
      desc: '我方单位累计 1000 点时爆发，15 秒内无法开启技能，每秒失去 1 技力并受到 100 法术伤害。',
    },
    神经损伤: {
      term: '神经损伤',
      kind: 'status',
      desc: '我方单位累计满 1000 点神经损伤时，受到 1000 真实伤害并晕眩 10 秒。前排会暂时停止阻挡，元素回复可在爆发前降低损伤。',
    },
    灼燃损伤: {
      term: '灼燃损伤',
      kind: 'status',
      desc: '我方单位累计满 1000 点灼燃损伤时，受到 1200 法术伤害，法术抗性降低 20 点、持续 10 秒。对敌方施加灼燃时，普通和精英敌人的爆发门槛为 1000 点，领袖为 2000 点。爆发造成 7000 元素伤害，期间法抗降低 20 点。',
    },
    元素损伤: {
      term: '元素损伤',
      kind: 'status',
      desc: '独立于生命值的损伤条，蓄满后按损伤类型触发爆发。通常我方单位、普通和精英敌人的门槛为 1000 点，领袖为 2000 点。有元素回复能力的干员可以在友方爆发前降低积累值。',
    },
    晕眩: {
      term: '晕眩',
      kind: 'status',
      desc: '强控异常：期间无法移动、阻挡、攻击及开启技能。阻挡位被晕眩会立即放行当前阻挡的敌人。',
    },
    寒冷: {
      term: '寒冷',
      kind: 'status',
      desc: '攻击速度降低 30 点。寒冷期间再次受到寒冷，若目标可被冻结，会变为「冻结」。',
    },
    冻结: {
      term: '冻结',
      kind: 'status',
      desc: '由叠加寒冷触发：期间无法移动、攻击及开启技能，且自身法术抗性额外降低 15。',
    },
    恐惧: {
      term: '恐惧',
      kind: 'status',
      desc: '受影响的敌人会尝试远离恐惧来源，可能暂时离开原本的行进路线。',
    },
    隐匿: {
      term: '隐匿',
      kind: 'status',
      desc: '未被阻挡时不会成为敌方远程攻击的目标；必须使用「反隐」手段破隐，或用近战干员将其阻挡后才会显形。',
    },
    伪装: {
      term: '伪装',
      kind: 'status',
      desc: '不会成为常规远程攻击目标（但仍会受到范围溅射伤害）；部分 Boss 的伪装还伴随高额物法闪避，建议爆发技能错开该时段。',
    },
    沉默: {
      term: '沉默',
      kind: 'mechanic',
      desc: '使可被沉默的敌人在持续时间内失去特殊能力（如鳍的【离子环波】、折射特性或亡语毒雾）。',
    },
    折射: {
      term: '折射',
      kind: 'mechanic',
      desc: '敌方高法抗特性：生效期间法术抗性 +70，常规法术很难打动；优先使用物理、真实或弱点伤害，可沉默的目标也能用沉默解除折射。',
    },
    次数盾: {
      term: '次数盾',
      kind: 'mechanic',
      desc: '不看单次伤害高低、必须承受规定次数的攻击才能击破的护盾或器物（如铜灯盘、木制瑞印、再生护盾），需要高攻速或多段连击的「高频」干员清理。',
    },
    源石污染区: {
      term: '源石污染区',
      kind: 'mechanic',
      desc: '恶尘源石虫等单位死亡后留下的特殊地块；位于区内的「萨卡兹枯朽前锋」普攻会从物理转为法术伤害。',
    },
    中毒: {
      term: '中毒',
      kind: 'status',
      desc: '持续造成生命流失/伤害的状态，叠加多层或配合全场酸雨时对群体治疗压力极大。',
    },
    萨卡兹枯朽前锋: {
      term: '萨卡兹枯朽前锋',
      kind: 'unit',
      desc: '全部领袖战的通用地面随行杂兵（联合全场 ×22）；常态物理近战，站在源石污染区内时改造成法术伤害。',
    },
    妖怪: {
      term: '妖怪',
      kind: 'unit',
      desc: '全部领袖战的通用飞行随行（联合全场 ×22），不攻击但沿折返路线直飞蓝门；在「假想敌：胄」战中击落技能召唤的妖怪还会扣除胄 2% 最大生命真实伤害。',
    },
  },
  /** 教程与速查共用的特质类型，顺序与图鉴一致。 */
  operatorTypes: ['持续叠加', '单次叠加', '作战能力', '整备能力', '特异化'],
  /** 显示名称与原始特质标签；两种休整期开始写法归为同一时机。 */
  operatorTriggers: [
    ['进入休整期', ['<进入休整期时>', '<休整期开始时>']],
    ['获得时', ['<获得时>']],
    ['刷新时', ['<刷新时>']],
    ['售出时', ['<售出时>']],
    ['休整期结束', ['<休整期结束时>']],
    ['战斗开始', ['<战斗开始时>']],
    ['战斗中', ['<战斗中>']],
    ['战斗结束', ['<战斗结束时>']],
  ],
  /** 实战职能标签：关联战术特训与领袖对策，干员标注以卫戍默认技能/特性与特质为准。 */
  combatRoles: [
    {
      id: 'antiair',
      label: '对空',
      desc: '普攻或默认技能可命中飞行敌人',
      trainingTypes: ['飞行'],
    },
    {
      id: 'antistealth',
      label: '反隐',
      desc: '使敌人隐匿失效',
      trainingTypes: ['隐匿'],
    },
    {
      id: 'heal',
      label: '治疗',
      desc: '为其他友方单位回复生命',
      trainingTypes: ['持续'],
    },
    {
      id: 'elemheal',
      label: '元素回复',
      desc: '为友方回复元素损伤',
      trainingTypes: ['元素'],
    },
    {
      id: 'multihit',
      label: '高频',
      desc: '多段连击或高攻速，破频次盾/弹体',
      trainingTypes: ['频次'],
    },
    {
      id: 'control',
      label: '控制',
      desc: '对敌人施加限制行动的效果、强制位移或沉默',
      trainingTypes: ['复苏'],
    },
    {
      id: 'block',
      label: '阻挡',
      desc: '3 阻挡重装、前排护盾或强承伤',
      trainingTypes: ['特异', '致命'],
    },
    {
      id: 'aoe',
      label: '群攻',
      desc: '范围或多目标清杂',
      trainingTypes: ['特异'],
    },
    {
      id: 'truedmg',
      label: '真伤',
      desc: '可直接造成真实伤害，忽略目标的防御力和法术抗性',
      trainingTypes: ['折射', '特异'],
    },
    {
      id: 'elemental',
      label: '元素输出',
      desc: '对敌人造成元素损伤或元素伤害，部分技能需要特定元素爆发',
      trainingTypes: ['折射', '特异'],
    },
    {
      id: 'penetration',
      label: '破抗',
      desc: '削减或无视目标的部分防御力或法术抗性',
      trainingTypes: ['特异'],
    },
    {
      id: 'silence',
      label: '沉默',
      desc: '使可被沉默的地面敌人失去特殊能力',
      trainingTypes: ['折射'],
    },
    {
      id: 'fast',
      label: '快活',
      desc: '低再部署时间，适合救火与吃技能',
      trainingTypes: ['致命'],
    },
  ],
};
