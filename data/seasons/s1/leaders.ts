import type {
  Leader,
  LeaderMapConfig,
  MapPos,
  StageEscort,
} from '../../types.ts';
import {
  S1_LEADER_BATTLEFIELDS,
  S1_LEADER_MOVEMENTS,
} from './leader-movement.ts';

/**
 * 领袖（最终回合首领）。
 *
 * 来源：ArknightsGameData activity_table.autoChessData.bossInfoDict（领袖名单与隐秘核心形态）、
 * enemy_handbook_table、PRTS 修正条目与关卡 overwrittenData（实际能力）；头像取自 PRTS「头像_敌人_<名称>.png」。
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
 *   level_act3autochess_h07_xx.json（领袖回合）与 h08_xx.json（隐秘核心回合），并交叉核对 _s 独立模拟版本。
 *   h07/h08 是波次与路线模板；实际地形及完整移动指令见 leader-movement.ts。
 *   随行数量取联合模拟 h07/h08 全场的静态 SPAWN 总数，额外技能召唤另计。
 * counters 由能力描述、随行敌人与路线推导，by 写明依据。
 * layout 根据机制整理我方站位；范围取自 enemy_database 与 PRTS 技能解析（管 1.8 格、弦 3 格）。
 * 具体数值（20% / 50%、2%、25% / 15 秒 / 50%、1.5 / 1.6 格）取自 levels/enemydata/enemy_database.json。
 */

/**
 * 标准场地 01 的联合战场，截取原图列 2–18、从上往下第 6–11 行。
 * 来源：Kengxxiao/ArknightsGameData，zh_CN/gamedata/levels/activities/act3autochess/
 * level_act3autochess_m01/level_act3autochess_m01_sub_03.json。
 * # 禁行，. 可部署地面，B 可部署但地面敌人不可通行的障碍格，_ 不可部署通道，
 * o 传送出口，E 蓝门，i 传送入口，b 整备区；crates 为预置阻隔工事。
 * 地面路线根据关卡检查点绕过地形；飞行路线保留原检查点。
 */
export const S1_LEADER_MAP: LeaderMapConfig = {
  ...S1_LEADER_BATTLEFIELDS[0],
  name: '标准场地 01',
  spawn: [8, 4] as MapPos,
  exit: [0, 4] as MapPos,
  transfer: [1, 5] as MapPos,
  /** 当前左侧分支；跨场传送不画成穿越地形的连线。 */
  walk: [
    [8, 4],
    [1, 4],
    [1, 5],
  ] as readonly MapPos[],
  /** 妖怪：在左半场折返飞行 */
  fly: [
    [8, 4],
    [7, 4],
    [7, 1],
    [5, 1],
    [5, 4],
    [3, 4],
    [3, 1],
    [1, 1],
    [1, 4],
    [1, 5],
  ] as readonly MapPos[],
  /** 每张领袖图都有的随行敌人 */
  common: [
    {
      name: '萨卡兹枯朽前锋',
      count: 22,
      note: '位于源石污染区内时攻击造成法术伤害',
    },
    {name: '妖怪', count: 22, fly: true, note: '不造成伤害'},
  ] as readonly StageEscort[],
};

export const S1_LEADERS: readonly Leader[] = [
  {
    name: '假想敌：胄',
    id: 'enemy_9013_acstmk',
    damage: ['物理', '法术'],
    profile: {
      attackMode: '定点远程 · 物法混伤',
      defense: '防御 1000 / 法抗 25；隐秘核心 1200 / 30。生命低于 20% 时物法减伤 50%',
      targeting: '随机射线；灭顶之灾锁最高攻；核心剑锤锁最低攻',
      blocking: '本体不可阻挡 · 常规地面杂兵与大量飞行妖怪',
      summary:
        '最高攻干员周围 8 格留空防九宫格晕眩，用高频攻击拦截弹体。每击倒一只【死亡集群】召出的妖怪，可对胄造成 2% 最大生命的真实伤害；20% 血以下半伤注意收尾。',
      hiddenSummary:
        '登场自带【斩胄之剑】与【破胄之锤】飞向最低攻干员自爆，飞行时失去无敌可被高频击落，击落后受增伤并将伤害传给本体。',
    },
    terms: [
      {
        term: '刺胄之弹',
        kind: 'unit',
        desc: '【灭顶之灾】射向攻击力最高干员的飞行弹体：飞行途中受到一定次数攻击即可击破；未击破落地会使九宫格长时间晕眩并每秒受物理伤害。',
      },
      {
        term: '“斩胄之剑”',
        kind: 'unit',
        desc: '隐秘核心专属部件，常态无敌；周期性飞向攻击力最低干员自爆并造成九宫格晕眩与持续物伤。飞行途中失去无敌，高频击落后视为地面单位且受伤增加、伤害按比例传给胄。',
      },
      {
        term: '“破胄之锤”',
        kind: 'unit',
        desc: '隐秘核心专属部件，机制与“斩胄之剑”相同：瞄准最低攻干员自爆，需在飞行途中用高频击落并集火落地部件以传导高额伤害给本体。',
      },
      {
        term: '“帝国的甲胄”',
        kind: 'unit',
        desc: '隐秘核心随行远程精英（联合全场 ×6）：出场锁定生命值最高单位连续造成物理伤害，攻击数次后蓄力发动三连击。',
      },
    ],
    hp: [283680, 945600, 2364000, 3940000],
    hiddenCore: [1641600, 4104000, 6840000],
    abilities: [
      {text: '随机选择目标发射射线，造成法术伤害'},
      {
        skill: '灭顶之灾',
        text: '对攻击力最高的干员发射<刺胄之弹>，落点处目标及周围 8 格{晕眩}较长时间并每秒受到物理伤害；飞行中攻击数次可击破',
      },
      {
        skill: '死亡集群',
        text: '周期性召唤<妖怪>；击倒本技能召唤的妖怪时，胄受到最大生命值 2% 的真实伤害',
      },
      {text: '生命值低于 20% 后，受到的物理与法术伤害降低 50%'},
    ],
    hiddenAbilities: [
      {
        skill: '旧日的剑与锤',
        text: '以完全形态登场，带着<“斩胄之剑”>与<“破胄之锤”>',
      },
      {
        text: '剑与锤初始无敌，周期性飞向攻击力最低的干员自爆：目标及周围 8 格{晕眩}并每秒受到物理伤害，随后返回',
      },
      {
        text: '飞行途中失去无敌，受到一定次数伤害后被击落；击落后视为地面单位、受到的伤害增加，所受伤害按比例传给胄',
      },
    ],
    stage: {
      marks: [{name: '胄', kind: 'boss', at: [8, 3]}],
      escorts: [{name: '重装防御组长', count: 14}],
    },
    hiddenStage: {
      marks: [
        {name: '胄', kind: 'boss', at: [8, 3]},
        {name: '斩胄之剑', kind: 'part', at: [10, 3]},
        {name: '破胄之锤', kind: 'part', at: [6, 3]},
      ],
      escorts: [
        {
          name: '“帝国的甲胄”',
          count: 6,
          note: '出场锁定生命值最高的单位连续物理伤害；远程；攻击数次后蓄力三连击',
        },
      ],
    },
    counters: [
      {
        tag: '分散',
        text: '攻击力最高的干员周围 8 格少放人：落点九宫格{晕眩}并持续物理伤害',
        by: '灭顶之灾',
      },
      {
        tag: '集火',
        roles: ['高频'],
        text: '<刺胄之弹>飞行途中挨数次攻击即被击破，攻速快的干员能拦截',
        by: '灭顶之灾',
      },
      {
        tag: '对空',
        roles: ['对空'],
        text: '【死亡集群】召唤的<妖怪>被击倒时，胄损失 2% 最大生命：带上能打飞行单位的干员',
        by: '死亡集群',
      },
      {
        tag: '分散',
        text: '剑与锤飞向攻击力最低的干员：让该单位周围 8 格留空',
        by: '旧日的剑与锤',
        hidden: true,
      },
      {
        tag: '集火',
        roles: ['高频'],
        text: '剑与锤飞行时可被击落；落地后受到的伤害增加并按比例传给胄',
        by: '旧日的剑与锤',
        hidden: true,
      },
    ],
    layout: {
      slots: [
        {role: '坦', at: [7, 4], facing: 'right'},
        {role: '输', at: [6, 3], facing: 'right'},
        {role: '空', at: [6, 1], facing: 'down'},
        {role: '空', at: [4, 2], facing: 'right', mark: '攻击最高'},
        {role: '疗', at: [6, 4], facing: 'up'},
        {role: '坦', at: [2, 4], facing: 'right'},
        {role: '空', at: [1, 2], facing: 'right'},
      ],
      zones: [
        {
          label: '灭顶之灾',
          shape: {kind: 'rect', at: [3, 1], w: 3, h: 3},
          hint: '攻击最高者周围八格留空；弹体飞行中用多次命中击破。',
          targets: [[4, 2]],
        },
        {
          label: '死亡集群',
          shape: {kind: 'line', path: S1_LEADER_MAP.fly},
          hint: '对空输出覆盖飞行路线；死亡集群召唤的妖怪被击倒时，胄损失 2% 最大生命。',
        },
      ],
    },
    hiddenLayout: {
      slots: [
        {role: '坦', at: [7, 4], facing: 'right'},
        {role: '输', at: [6, 3], facing: 'right'},
        {role: '空', at: [6, 1], facing: 'down'},
        {role: '空', at: [4, 2], facing: 'right', mark: '攻击最高'},
        {role: '疗', at: [1, 2], facing: 'right', mark: '攻击最低'},
        {role: '坦', at: [2, 4], facing: 'right'},
        {role: '疗', at: [6, 4], facing: 'up'},
      ],
      zones: [
        {
          label: '灭顶之灾',
          shape: {kind: 'rect', at: [3, 1], w: 3, h: 3},
          hint: '攻击最高者周围八格留空；弹体飞行中用多次命中击破。',
          targets: [[4, 2]],
        },
        {
          label: '旧日的剑与锤',
          shape: {kind: 'rect', at: [0, 1], w: 3, h: 3},
          hint: '最低攻击力单位周围留空；飞行时击落剑锤，再集中输出落地部件。',
          tone: 'hc',
          targets: [[1, 2]],
        },
        {
          label: '死亡集群',
          shape: {kind: 'line', path: S1_LEADER_MAP.fly},
          hint: '对空输出覆盖飞行路线；死亡集群召唤的妖怪被击倒时，胄损失 2% 最大生命。',
        },
      ],
    },
  },
  {
    name: '假想敌：铳',
    id: 'enemy_9017_achunt',
    damage: ['物理', '侵蚀'],
    profile: {
      attackMode: '巡逻远程 · 物理 + 侵蚀损伤',
      defense: '参考 防 1100 / 法抗 60（核心本体极大幅减伤）',
      targeting: '普攻优先选范围内防御最高的单位，冲锋选全场防御最高的单位',
      blocking: '会巡逻进入半场，可用前排拦截；发动【最终之罚】冲锋时无法阻挡',
      summary:
        '巡逻路线放高防主坦配奶与元素回复清侵蚀，主坦与铳之间留空避免冲锋撞伤后排；优先击落分伤飞行圣杯。',
      hiddenSummary:
        '本体获得极大幅物法减伤，必须转火【碎铳之簧】将伤害传导给本体；避开铳与簧之间的物理切割连结线及拉回路径。',
    },
    terms: [
      {
        term: '“碎铳之簧”',
        kind: 'unit',
        desc: '隐秘核心专属部件（3 个）：与铳连结分摊并传递伤害，本体极大幅减伤时必须集火打簧。站在铳与簧的连结线上会每秒受物理伤害；【末日布道】将其拉向铳时簧免疫伤害且撞伤沿途单位。',
      },
      {
        term: '愧悔魂灵圣杯',
        kind: 'unit',
        desc: '领袖回合飞行随行（×2）：分摊周围地面敌人受到的部分伤害，拖慢击杀效率，建议用对空优先击落。',
      },
      {
        term: '假想敌：淤困',
        kind: 'unit',
        desc: '隐秘核心地面随行（×2）：被阻挡时寄生目标，造成持续法术伤害并使目标受到的元素损伤增加，极易加速侵蚀爆发。',
      },
    ],
    hp: [162000, 540000, 1350000, 2250000],
    hiddenCore: [1435200, 3588000, 5980000],
    abilities: [
      {text: '优先攻击防御力最高的单位，攻击附带{侵蚀损伤}'},
      {text: '持续攻击同一目标时攻击速度逐渐提升'},
      {
        skill: '最终之罚',
        text: '停止攻击并大幅加速，冲向全场防御力最高的单位；期间无法被阻挡，对经过的单位造成物理伤害',
      },
    ],
    hiddenAbilities: [
      {
        skill: '未尽的告解',
        text: '场上出现<“碎铳之簧”>，铳受到的物理与法术伤害极大幅降低',
      },
      {
        skill: '盲信之誓',
        text: '与所有<“碎铳之簧”>连结：簧受到的伤害按比例传给铳和其他簧；站在连结线上的我方单位每秒受到物理伤害',
      },
      {
        skill: '末日布道',
        text: '持续把所有<“碎铳之簧”>拉向自身，期间簧大幅加速并免疫伤害，对经过的我方单位造成物理伤害',
      },
    ],
    stage: {
      marks: [
        {
          name: '铳',
          kind: 'boss',
          at: S1_LEADER_MOVEMENTS.gun.left.legs[0].points[0],
          movement: S1_LEADER_MOVEMENTS.gun,
        },
      ],
      escorts: [
        {
          name: '愧悔魂灵圣杯',
          count: 2,
          fly: true,
          note: '分摊周围地面敌人受到的部分伤害',
        },
      ],
    },
    hiddenStage: {
      marks: [
        {
          name: '铳',
          kind: 'boss',
          at: S1_LEADER_MOVEMENTS.gunCore.left.legs[0].points[0],
          movement: S1_LEADER_MOVEMENTS.gunCore,
        },
        {
          name: '碎铳之簧',
          kind: 'part',
          at: S1_LEADER_MOVEMENTS.springA.left.legs[0].points[0],
          movement: S1_LEADER_MOVEMENTS.springA,
        },
        {
          name: '碎铳之簧',
          kind: 'part',
          at: S1_LEADER_MOVEMENTS.springB.left.legs[0].points[0],
          movement: S1_LEADER_MOVEMENTS.springB,
        },
        {
          name: '碎铳之簧',
          kind: 'part',
          at: S1_LEADER_MOVEMENTS.springC.left.legs[0].points[0],
          movement: S1_LEADER_MOVEMENTS.springC,
        },
      ],
      escorts: [
        {
          name: '假想敌：淤困',
          count: 2,
          note: '被阻挡时寄生目标：持续法术伤害，受到的{元素损伤}增加',
        },
      ],
    },
    counters: [
      {
        tag: '阻挡',
        roles: ['阻挡'],
        text: '铳会巡逻进你的半场：路线上放防御最高的阻挡干员',
        by: '巡逻路线',
      },
      {
        tag: '续航',
        roles: ['治疗', '元素回复'],
        text: '盯住防御最高的单位且越打越快，附带{侵蚀损伤}：主坦要有治疗',
        by: '特性',
      },
      {
        tag: '避让',
        text: '冲锋不可阻挡、伤害沿途单位：其他干员别挡在铳和主坦之间',
        by: '最终之罚',
      },
      {
        tag: '集火',
        text: '铳本体极大幅减伤，打<碎铳之簧>，伤害按比例传给铳',
        by: '未尽的告解',
        hidden: true,
      },
      {
        tag: '避让',
        text: '铳与簧之间的连结线上每秒受物理伤害，别站在线上',
        by: '盲信之誓',
        hidden: true,
      },
      {
        tag: '避让',
        text: '簧被拉回铳身边时免疫伤害并撞伤沿途单位',
        by: '末日布道',
        hidden: true,
      },
    ],
    layout: {
      slots: [
        {role: '坦', at: [6, 2], facing: 'right', mark: '防御最高'},
        {role: '疗', at: [3, 1], facing: 'right'},
        {role: '输', at: [2, 1], facing: 'right'},
        {role: '输', at: [2, 3], facing: 'up'},
        {role: '空', at: [6, 4], facing: 'up'},
        {role: '坦', at: [7, 4], facing: 'right'},
      ],
      zones: [
        {
          label: '最终之罚',
          shape: {
            kind: 'line',
            path: [
              [8, 2],
              [6, 2],
            ],
          },
          hint: '冲锋锁定最高防御单位；两者之间留出通道。',
          targets: [[6, 2]],
        },
        {
          label: '巡逻路线',
          shape: {
            kind: 'line',
            path: [
              [8, 2],
              [7, 1],
              [1, 4],
              [7, 3],
              [7, 1],
            ],
          },
          hint: '在巡逻经过的位置准备阻挡，后排与承伤位错开。',
        },
      ],
    },
    hiddenLayout: {
      slots: [
        {role: '坦', at: [6, 2], facing: 'right', mark: '防御最高'},
        {role: '疗', at: [3, 1], facing: 'right'},
        {role: '输', at: [2, 1], facing: 'right'},
        {role: '输', at: [2, 3], facing: 'up'},
        {role: '空', at: [6, 4], facing: 'up'},
        {role: '坦', at: [7, 4], facing: 'right'},
      ],
      zones: [
        {
          label: '最终之罚',
          shape: {
            kind: 'line',
            path: [
              [8, 2],
              [6, 2],
            ],
          },
          hint: '冲锋锁定最高防御单位；两者之间留出通道。',
          targets: [[6, 2]],
        },
        {
          label: '巡逻路线',
          shape: {
            kind: 'line',
            path: [
              [8, 2],
              [7, 1],
              [1, 4],
              [7, 3],
              [7, 1],
            ],
          },
          hint: '在巡逻经过的位置准备阻挡，后排与承伤位错开。',
        },
        {
          label: '盲信之誓',
          shape: {
            kind: 'line',
            path: [
              [8, 2],
              [6, 1],
            ],
          },
          hint: '避开铳与簧之间的连结线，集中攻击可受伤的簧。',
          tone: 'hc',
          extraShapes: [
            {
              kind: 'line',
              path: [
                [8, 2],
                [2, 3],
              ],
            },
            {
              kind: 'line',
              path: [
                [8, 2],
                [6, 3],
              ],
            },
          ],
          markers: [
            {name: '簧', at: [6, 1]},
            {name: '簧', at: [2, 3]},
            {name: '簧', at: [6, 3]},
          ],
        },
        {
          label: '末日布道',
          shape: {
            kind: 'line',
            path: [
              [6, 3],
              [8, 2],
            ],
          },
          hint: '簧回到本体途中免疫伤害；让开它们的移动路径。',
          tone: 'hc',
          extraShapes: [
            {
              kind: 'line',
              path: [
                [2, 3],
                [8, 2],
              ],
            },
            {
              kind: 'line',
              path: [
                [6, 1],
                [8, 2],
              ],
            },
          ],
          markers: [
            {name: '簧', at: [6, 3]},
            {name: '簧', at: [6, 1]},
            {name: '簧', at: [2, 3]},
          ],
        },
      ],
    },
  },
  {
    name: '假想敌：管',
    id: 'enemy_9021_acduml',
    damage: ['法术', '凋亡'],
    profile: {
      attackMode: '定点远程 · 范围法术三连击 + 凋亡损伤',
      defense: '参考 防 700 / 法抗 50（法抗偏高，物理/真伤更顺手）',
      targeting: '普攻与【裂管之奏】优先瞄准暗色【余音】触发 1.8 格范围溅射',
      blocking: '本体不可阻挡；【余音】必须由阻挡数 ≥2 的干员阻挡',
      summary:
        '用阻挡 ≥2 的法抗坦在前方卡住【余音】，输出与治疗远离余音 1.8 格并带元素回复防凋亡封技；注意随行【堂皇】隐匿光环。',
      hiddenSummary:
        '永久无敌的【假想敌：弦】同场登场，以金黄形态余音为中心触发 3 格超大范围【断弦之奏】；弦随管退场，只打管即可。',
    },
    terms: [
      {
        term: '“余音”',
        kind: 'unit',
        desc: '管持续召唤的特殊装置，只能被阻挡数 ≥2 的干员阻挡，受击时会向周围释放范围法术伤害和凋亡损伤；同时也是管/弦全屏共振技能的溅射中心。',
      },
      {
        term: '暗色的喟叹',
        kind: 'mechanic',
        desc: '余音的初始形态：管普攻与【裂管之奏】优先锁定所有暗色余音发动三连击，造成半径 1.8 格范围法伤与凋亡损伤。',
      },
      {
        term: '假想敌：弦',
        kind: 'unit',
        desc: '隐秘核心同场双首领，永久无敌、管倒下时一同退场；会以金黄形态余音为中心发动半径 3 格的【断弦之奏】并转换余音形态。',
      },
      {
        term: '堂皇',
        kind: 'unit',
        desc: '领袖回合随行敌人（×2）：周期性使周围敌人获得隐匿，死亡后在原地留下装置<铁灯盘>，建议携带反隐或前排阻挡显形。',
      },
      {
        term: '假想敌：再生',
        kind: 'unit',
        desc: '隐秘核心随行精英（×2）：首次被击倒后进入再生状态，给周围敌人套物法护盾，一段时间后复活，可用高频/控制处理。',
      },
    ],
    hp: [302400, 1008000, 2520000, 4200000],
    hiddenCore: [1732800, 4332000, 7220000],
    abilities: [
      {
        text: '在场时持续召唤【暗色的喟叹】形态<“余音”>，生命值低于一定比例后召唤间隔缩短',
      },
      {text: '普通攻击为范围法术三连击，优先攻击【暗色的喟叹】形态<“余音”>'},
      {
        skill: '裂管之奏',
        text: '对场上所有【暗色的喟叹】形态<“余音”>三连击，造成范围法术伤害和{凋亡损伤}',
      },
    ],
    hiddenAbilities: [
      {text: '<假想敌：弦>与管同时登场；弦持续无敌，管倒下后随之退场'},
      {
        skill: '断弦之奏',
        text: '弦以金黄形态<余音>为中心造成范围法术伤害和{凋亡损伤}，并改变余音形态',
      },
    ],
    stage: {
      marks: [{name: '管', kind: 'boss', at: [8, 3]}],
      escorts: [
        {
          name: '“余音”',
          count: 2,
          note: '只能被阻挡数≥2 的单位阻挡；受击时范围法术伤害和{凋亡损伤}',
        },
        {
          name: '堂皇',
          count: 2,
          note: '周期性使周围敌人{隐匿}；死亡后生成<铁灯盘>',
        },
      ],
    },
    hiddenStage: {
      marks: [
        {name: '管', kind: 'boss', at: [7, 3]},
        {name: '弦', kind: 'part', at: [7, 3]},
      ],
      escorts: [
        {
          name: '“余音”',
          count: 4,
          note: '只能被阻挡数≥2 的单位阻挡；受击时范围法术伤害和{凋亡损伤}',
        },
        {
          name: '假想敌：再生',
          count: 2,
          note: '被击倒后进入再生，给周围敌人加护盾，一段时间后重生',
        },
      ],
    },
    counters: [
      {
        tag: '法抗',
        roles: ['元素回复'],
        text: '管与余音造成法术伤害和{凋亡损伤}：阻挡位兼顾法抗与元素恢复',
        by: '伤害类型',
      },
      {tag: '阻挡', text: '<余音>只能被阻挡数≥2 的干员挡住', by: '余音'},
      {
        tag: '避让',
        text: '以每个暗色<余音>为中心范围三连击：余音身边别堆人，尽快清掉',
        by: '裂管之奏',
      },
      {
        tag: '控制',
        roles: ['反隐'],
        text: '随行<堂皇>会周期性令周围敌人{隐匿}，带反隐可防止前排被隐匿怪绕穿',
        by: '堂皇',
      },
      {
        tag: '集火',
        text: '<弦>永久无敌，管倒下时一起离场：只打管',
        by: '弦',
        hidden: true,
      },
      {
        tag: '避让',
        text: '<弦>以金黄<余音>为中心打大范围法术伤害',
        by: '断弦之奏',
        hidden: true,
      },
    ],
    layout: {
      slots: [
        {role: '坦', at: [6, 4], facing: 'right', mark: '阻挡≥2'},
        {role: '坦', at: [2, 4], facing: 'right'},
        {role: '疗', at: [3, 1], facing: 'right'},
        {role: '输', at: [6, 1], facing: 'down'},
        {role: '输', at: [4, 1], facing: 'right'},
        {role: '群', at: [2, 1], facing: 'right'},
      ],
      zones: [
        {
          label: '裂管之奏',
          shape: {kind: 'circle', at: [6.7, 4], radius: 1.8},
          hint: '暗色余音是溅射中心；阻挡位留在前方，输出与治疗拉开。',
          markers: [{name: '余音', at: [6.7, 4]}],
        },
      ],
    },
    hiddenLayout: {
      slots: [
        {role: '坦', at: [6, 4], facing: 'right', mark: '阻挡≥2'},
        {role: '坦', at: [2, 4], facing: 'right'},
        {role: '疗', at: [3, 1], facing: 'right'},
        {role: '输', at: [6, 1], facing: 'down'},
        {role: '输', at: [4, 1], facing: 'right'},
        {role: '群', at: [2, 1], facing: 'right'},
      ],
      zones: [
        {
          label: '裂管之奏',
          shape: {kind: 'circle', at: [6.7, 4], radius: 1.8},
          hint: '暗色余音是溅射中心；阻挡位留在前方，输出与治疗拉开。',
          markers: [{name: '余音', at: [6.7, 4]}],
        },
        {
          label: '断弦之奏',
          shape: {kind: 'circle', at: [6.7, 4], radius: 3},
          hint: '金黄余音周围的大范围伤害；弦持续无敌，主要输出集中给管。',
          tone: 'hc',
          markers: [{name: '余音', at: [6.7, 4]}],
        },
      ],
    },
  },
  {
    name: '盐风主教昆图斯',
    id: 'enemy_1521_dslily',
    damage: ['物理', '法术', '神经'],
    profile: {
      attackMode: '定点远程 · 双目标物伤 + 全场法伤与神经损伤',
      defense: '规程领袖回合基础防御 500 / 法抗 40',
      targeting:
        '普攻同时锁防御最高的 2 名单位；【大潮】打全场；【断裂生殖】缠绕单体',
      blocking: '本体不可阻挡 · 需准备两名高防阻挡位分摊普攻与地面怪',
      summary:
        '越拖攻击越高、放技越快，核心是速战速决！备双高防前排 + 群奶与元素回复防神经晕眩，第一时间打掉【子代】与洋流使者。',
    },
    terms: [
      {
        term: '子代',
        kind: 'unit',
        desc: '【断裂生殖】召唤出来缠绕我方单位的衍生物，持续对被缠干员造成物理伤害、神经损伤与晕眩；必须靠周围输出迅速击破救人。',
      },
      {
        term: '复核洋流使者',
        kind: 'unit',
        desc: '本场随行精英（×10）：一旦吞噬场上的<赘生甲壳>，攻击力与生命值会大幅飙升，需在其吞噬前集火消灭。',
      },
      {
        term: '赘生甲壳',
        kind: 'unit',
        desc: '场上可被<复核洋流使者>吞噬的强化物体；若不尽快击杀洋流使者，会养出高攻高血的前排杀手。',
      },
    ],
    hp: [314640, 1048800, 2622000, 4370000],
    hiddenCore: null,
    abilities: [
      {text: '同时攻击防御力最高的两个单位，造成物理伤害和{神经损伤}'},
      {skill: '大潮', text: '对所有我方单位造成法术伤害和{神经损伤}'},
      {skill: '崩坍', text: '对若干我方单位造成物理伤害'},
      {
        skill: '断裂生殖',
        text: '召唤<子代>缠绕我方单位，持续造成物理伤害、{神经损伤}和{晕眩}',
      },
    ],
    hiddenAbilities: [],
    stage: {
      marks: [{name: '昆图斯', kind: 'boss', at: [8, 3]}],
      escorts: [
        {
          name: '复核洋流使者',
          count: 10,
          note: '吞噬<赘生甲壳>后攻击力和生命值大幅提升',
        },
      ],
    },
    hiddenStage: null,
    counters: [
      {
        tag: '限时',
        text: '战斗越久、生命越低，攻击力越高、技能越频繁：速战速决',
        by: '特性',
      },
      {
        tag: '续航',
        roles: ['阻挡'],
        text: '同时打防御最高的两个单位：准备两个能扛的阻挡位',
        by: '特性',
      },
      {
        tag: '法抗',
        roles: ['元素回复'],
        text: '全体法术伤害加{神经损伤}',
        by: '大潮',
      },
      {
        tag: '集火',
        text: '<复核洋流使者>吃到<赘生甲壳>会大幅变强，优先击杀',
        by: '复核洋流使者',
      },
    ],
    layout: {
      slots: [
        {role: '坦', at: [7, 4], facing: 'right', mark: '防御最高'},
        {role: '坦', at: [6, 4], facing: 'right', mark: '防御次高'},
        {role: '疗', at: [6, 2], facing: 'down'},
        {role: '输', at: [4, 2], facing: 'right'},
        {role: '群', at: [4, 1], facing: 'right'},
        {role: '空', at: [2, 2], facing: 'right'},
      ],
      zones: [
        {
          label: '双目标攻击',
          shape: {
            kind: 'tiles',
            at: [
              [7, 4],
              [6, 4],
            ],
          },
          hint: '防御最高的两名单位承伤；同时保持两处治疗覆盖。',
          targets: [
            [7, 4],
            [6, 4],
          ],
        },
        {
          label: '大潮',
          shape: {kind: 'rect', at: [1, 1], w: 6, h: 4},
          hint: '全场法术伤害与神经损伤，准备群体治疗和元素恢复。',
          extraShapes: [{kind: 'rect', at: [7, 4], w: 1, h: 1}],
        },
        {
          label: '断裂生殖',
          shape: {kind: 'tiles', at: [[6, 4]]},
          hint: '其他输出覆盖被缠绕者附近，及时清理子代。',
          targets: [[6, 4]],
          markers: [{name: '子代', at: [6, 3.3]}],
        },
      ],
    },
    hiddenLayout: null,
  },
  {
    name: '阿利斯泰尔，帝国余晖',
    id: 'enemy_9032_aclionk',
    damage: ['物理', '法术'],
    profile: {
      attackMode: '定点远程 · 十字高额物伤 + 活化装备混伤',
      defense: '基础防御 1030 / 法抗 20；半血及以下防御提高 100%、法抗增加 45',
      targeting: '【王权号令】锁定 1 名干员及上下左右 4 格轰击并掉落随机装备',
      blocking: '本体不可阻挡 · 注意装备【施术单元】活化后会占用部署格',
      summary:
        '关键干员错开十字相邻格减少溅射；带对空速杀全场减攻速的【萨科塔昂首】，备破抗或真伤应对半血后高双抗与双活化。',
    },
    terms: [
      {
        term: '黄金回响',
        kind: 'unit',
        desc: '【莫非王土】活化施术单元后生成的特殊装置，会占用我方部署格并对周围造成法术伤害，限制站位空间。',
      },
      {
        term: '“萨科塔昂首”',
        kind: 'unit',
        desc: '从顶部飞出的飞行随行（×2）：【祈祷邀约】会降低全场我方攻速，首次半血时触发恐惧乱飞；务必优先对空击落。',
      },
      {
        term: '活化装备',
        kind: 'mechanic',
        desc: '【王权号令】会在十字落点生成随机装备，随后【莫非王土】将其活化：刀片攻击我方、背心给 Boss 提供屏障与方向减伤、施术单元生成占格<黄金回响>；半血后每次活化两件。',
      },
    ],
    hp: [266400, 888000, 2220000, 3700000],
    hiddenCore: null,
    abilities: [
      {
        skill: '王权号令',
        text: '锁定一个我方单位及其周围 4 格，造成一次高额物理伤害，并在这些地块上生成随机装备',
      },
      {
        skill: '莫非王土',
        text: '活化装备：刀片攻击我方；背心提供屏障和方向减伤；施术单元生成<黄金回响>并占用部署格',
      },
      {
        text: '生命值降至一半及以下时防御力大幅提升、法术抗性 +45，【莫非王土】每次活化两件',
      },
    ],
    hiddenAbilities: [],
    stage: {
      marks: [
        {name: '阿利斯泰尔', kind: 'boss', at: [8, 3]},
        {
          name: '萨科塔昂首',
          kind: 'unit',
          at: S1_LEADER_MOVEMENTS.sakota.left.legs[0].points[0],
          movement: S1_LEADER_MOVEMENTS.sakota,
        },
      ],
      escorts: [
        {
          name: '“萨科塔昂首”',
          count: 2,
          fly: true,
          note: '【祈祷邀约】降低全场我方单位攻击速度；生命首次低于一半时{恐惧}',
        },
      ],
    },
    hiddenStage: null,
    counters: [
      {
        tag: '集火',
        roles: ['破抗', '真伤'],
        text: '半血后防御与法抗提高、每次活化两件装备：准备削弱或持续输出处理强化阶段',
        by: '特性',
      },
      {
        tag: '分散',
        text: '锁定一名干员及上下左右 4 格高额物理伤害：别十字相邻',
        by: '王权号令',
      },
      {
        tag: '对空',
        roles: ['对空'],
        text: '<萨科塔昂首>从平台顶部飞出，降低全场攻速，优先击落',
        by: '萨科塔昂首',
      },
    ],
    layout: {
      slots: [
        {role: '坦', at: [7, 4], facing: 'right'},
        {role: '空', at: [6, 3], facing: 'up'},
        {role: '输', at: [5, 2], facing: 'right'},
        {role: '疗', at: [3, 1], facing: 'right'},
        {role: '坦', at: [2, 4], facing: 'right'},
        {role: '输', at: [4, 1], facing: 'right'},
        {role: '群', at: [2, 1], facing: 'right'},
      ],
      zones: [
        {
          label: '王权号令',
          shape: {kind: 'cross', at: [5, 2]},
          hint: '关键单位错开上下左右相邻格，降低十字伤害与装备落点的影响。',
          targets: [[5, 2]],
        },
      ],
    },
    hiddenLayout: null,
  },
  {
    name: '“萨米的意志”',
    id: 'enemy_9033_acdeer',
    damage: ['物理', '法术'],
    profile: {
      attackMode: '定点远程 · 整列物伤 + 单体晕眩持续法伤',
      defense: '规程领袖回合基础防御 500 / 法抗 35；半血以下物法减伤 30%',
      targeting:
        '【冰凌】贯穿目标所在整列；【自然涌动】控单体；半血后均多选 1 目标',
      blocking:
        '本体不可阻挡 · 注意【游击队盾卫】高嘲讽与【冰爆源石虫】亡语寒冷',
      summary:
        '核心干员尽量分列站位避免同列吃满【冰凌】，阻挡位周围少堆人防冰爆虫冻结连片；半血后减伤 30% 且双目标点名，备足治疗与破抗/真伤。',
    },
    terms: [
      {
        term: '冰爆源石虫',
        kind: 'unit',
        desc: '本场随行敌人（×8）：死亡时自爆，对周围我方单位造成物理伤害并施加寒冷（叠加两层即冻结），别在阻挡点周围扎堆。',
      },
      {
        term: '游击队盾卫',
        kind: 'unit',
        desc: '高防随行敌人（×4）：自带高嘲讽极易吸引我方单体输出火力，防止主力输出被吸走拖慢打 Boss 节奏。',
      },
    ],
    hp: [290880, 969600, 2424000, 4040000],
    hiddenCore: null,
    abilities: [
      {skill: '冰凌', text: '攻击时对整列我方单位造成物理伤害'},
      {skill: '自然涌动', text: '使一名我方单位{晕眩}并持续受到法术伤害'},
      {
        text: '生命值低于一半时受到的物理和法术伤害降低 30%，【冰凌】和【自然涌动】额外选择一个目标',
      },
    ],
    hiddenAbilities: [],
    stage: {
      marks: [{name: '萨米的意志', kind: 'boss', at: [8, 3]}],
      escorts: [
        {
          name: '冰爆源石虫',
          count: 8,
          note: '死亡时对周围造成物理伤害并{寒冷}',
        },
        {name: '游击队盾卫', count: 4, note: '自身容易受到攻击（吸引火力）'},
      ],
    },
    hiddenStage: null,
    counters: [
      {tag: '分散', text: '攻击打整列：同一列别放多名干员', by: '冰凌'},
      {
        tag: '续航',
        roles: ['治疗'],
        text: '{晕眩}一名干员并持续法术伤害；半血后多选一个目标',
        by: '自然涌动',
      },
      {
        tag: '避让',
        text: '<冰爆源石虫>死亡时周围物理伤害加{寒冷}，别在阻挡点附近堆人',
        by: '冰爆源石虫',
      },
    ],
    layout: {
      slots: [
        {role: '坦', at: [7, 4], facing: 'right'},
        {role: '输', at: [6, 2], facing: 'right'},
        {role: '疗', at: [5, 3], facing: 'up'},
        {role: '输', at: [4, 1], facing: 'right'},
        {role: '空', at: [3, 1], facing: 'right'},
        {role: '坦', at: [2, 4], facing: 'right'},
        {role: '群', at: [1, 2], facing: 'right'},
      ],
      zones: [
        {
          label: '冰凌',
          shape: {kind: 'col', x: 6},
          hint: '输出与治疗错列，避免同列一起受击。',
          targets: [[6, 2]],
        },
        {
          label: '半血强化',
          shape: {kind: 'col', x: 6},
          hint: '半血后冰凌与自然涌动各多选一名目标；核心输出保持分列。',
          extraShapes: [{kind: 'col', x: 4}],
          targets: [
            [6, 2],
            [4, 1],
          ],
        },
        {
          label: '自然涌动',
          shape: {kind: 'tiles', at: [[6, 2]]},
          hint: '受控单位持续承受法术伤害，需要其他治疗支援。',
          targets: [[6, 2]],
        },
      ],
    },
    hiddenLayout: null,
  },
  {
    name: '假想敌：械',
    id: 'enemy_9029_acfnc',
    damage: ['物理'],
    profile: {
      attackMode: '定点远程 · 物理输出 + 高频刷兵召唤',
      defense: '参考 防 600 / 法抗 30（半血后来自冲击之械方向减伤）',
      targeting: '普攻命中点刷杂兵；【洪流攻势】锁定阻挡数最高单位刷兵',
      blocking: '本体不可阻挡 · 持续刷新大量地面【量变之械】极度考验阻挡与清场',
      summary:
        '最高阻挡坦身边铺满群攻持续清【量变之械】，半血后绕开【冲击之械】减伤方向输出，优先处理提供减伤光环的【搏命享受者】。',
      hiddenSummary:
        '普攻在多目标间跳跃且登场即召【冲击之械】；飞出砸地并在两部件之间大幅降攻速，集火攻击部件可将其推回本体全部销毁。',
    },
    terms: [
      {
        term: '量变之械',
        kind: 'unit',
        desc: '械普攻命中处与【洪流攻势】（最高阻挡者周围）持续召唤的近战机械杂兵，数量极多，必须用群攻持续清理避免撑爆阻挡数。',
      },
      {
        term: '冲击之械',
        kind: 'unit',
        desc: '半血/隐秘核心召唤的巨型部件：为械提供来自部件方向的减伤；核心形态下向两侧飞出砸伤我方并令两部件之间攻速暴跌，对其造成伤害会反向推回，撞上械时全部销毁。',
      },
      {
        term: '搏命享受者',
        kind: 'unit',
        desc: '本场随行敌人（×6）：光环使周围敌人受到的物理与法术伤害降低，建议用群攻尽早清除以免拖慢清杂。',
      },
    ],
    hp: [239400, 798000, 1995000, 3325000],
    hiddenCore: [1254000, 3135000, 5225000],
    abilities: [
      {text: '攻击命中时，在目标位置或周围召唤<量变之械>'},
      {skill: '洪流攻势', text: '在阻挡数最高的我方单位周围召唤<量变之械>'},
      {
        text: '生命值低于 50% 时召唤<冲击之械>，受到来自<冲击之械>方向的伤害降低',
      },
    ],
    hiddenAbilities: [
      {text: '攻击在多个目标间跳跃，每跳伤害降低；登场即召唤<冲击之械>'},
      {
        skill: '威光冲击',
        text: '<冲击之械>向两侧飞出，经过数个我方单位或到达最远处时砸下，造成大量物理伤害；两个<冲击之械>之间的我方单位攻击速度大幅降低',
      },
      {
        text: '<冲击之械>受到伤害时缓慢反向移动，撞上械则销毁场上所有<冲击之械>',
      },
      {skill: '衰颓与复兴', text: '销毁并重新召唤<冲击之械>'},
    ],
    stage: {
      marks: [{name: '械', kind: 'boss', at: [8, 3]}],
      escorts: [
        {
          name: '搏命享受者',
          count: 6,
          note: '周围敌人受到的物理和法术伤害降低',
        },
      ],
    },
    hiddenStage: {
      marks: [{name: '械', kind: 'boss', at: [8, 3]}],
      escorts: [
        {
          name: '搏命享受者',
          count: 6,
          note: '周围敌人受到的物理和法术伤害降低',
        },
      ],
    },
    counters: [
      {
        tag: '控制',
        roles: ['群攻'],
        text: '阻挡数最高的干员身边会刷<量变之械>：给它配范围输出',
        by: '洪流攻势',
      },
      {
        tag: '集火',
        roles: ['群攻'],
        text: '命中处也会刷<量变之械>，要持续清场',
        by: '特性',
      },
      {
        tag: '集火',
        text: '半血后来自<冲击之械>方向的伤害降低，从另一侧输出',
        by: '特性',
      },
      {
        tag: '集火',
        text: '打<冲击之械>能把它推回去，撞上械时全部销毁',
        by: '威光冲击',
        hidden: true,
      },
      {
        tag: '避让',
        text: '两个<冲击之械>之间的干员攻速大幅降低',
        by: '威光冲击',
        hidden: true,
      },
    ],
    layout: {
      slots: [
        {role: '坦', at: [7, 4], facing: 'right'},
        {role: '坦', at: [2, 4], facing: 'right', mark: '阻挡最高'},
        {role: '群', at: [4, 2], facing: 'down'},
        {role: '群', at: [2, 3], facing: 'down'},
        {role: '疗', at: [5, 2], facing: 'down'},
        {role: '输', at: [6, 2], facing: 'right'},
        {role: '空', at: [2, 1], facing: 'right'},
      ],
      zones: [
        {
          label: '洪流攻势',
          shape: {kind: 'tiles', at: [[2, 4]]},
          hint: '以最高阻挡数单位为召唤中心，让群攻与治疗覆盖这一带。',
          targets: [[2, 4]],
          markers: [
            {name: '量变', at: [2, 3.3]},
            {name: '量变', at: [1.3, 4]},
          ],
        },
      ],
    },
    hiddenLayout: {
      slots: [
        {role: '坦', at: [7, 4], facing: 'right'},
        {role: '坦', at: [2, 4], facing: 'right', mark: '阻挡最高'},
        {role: '群', at: [4, 2], facing: 'down'},
        {role: '群', at: [2, 3], facing: 'down'},
        {role: '疗', at: [5, 2], facing: 'down'},
        {role: '输', at: [6, 2], facing: 'right'},
        {role: '空', at: [2, 1], facing: 'right'},
      ],
      zones: [
        {
          label: '洪流攻势',
          shape: {kind: 'tiles', at: [[2, 4]]},
          hint: '以最高阻挡数单位为召唤中心，让群攻与治疗覆盖这一带。',
          targets: [[2, 4]],
          markers: [
            {name: '量变', at: [2, 3.3]},
            {name: '量变', at: [1.3, 4]},
          ],
        },
        {
          label: '威光冲击',
          shape: {
            kind: 'line',
            path: [
              [2, 3],
              [8, 3],
            ],
          },
          hint: '两侧部件夹区会降低攻速；攻击飞出的冲击之械，将其推回本体。',
          tone: 'hc',
          extraShapes: [
            {
              kind: 'line',
              path: [
                [10, 3],
                [8, 3],
              ],
            },
          ],
          markers: [
            {name: '冲击', at: [2, 3]},
            {name: '冲击', at: [10, 3]},
          ],
        },
      ],
    },
  },
  {
    name: '假想敌：茧',
    id: 'enemy_9035_acspider',
    damage: ['物理', '真实'],
    profile: {
      attackMode: '定点远程 · 多目标物伤 + 束缚茧（核心酸雨真伤）',
      defense: '参考 防 800 / 法抗 30（每掉 25% 血伪装 15 秒，50%/80% 闪避）',
      targeting: '普攻锁定每片场地当前生命最高的 3 名单位（核心 4 名）',
      blocking:
        '本体不可阻挡 · 须准备双阻挡点，防止唯一主坦被【淤困之茧】捆住漏怪',
      summary:
        '高血量干员备足治疗，输出互相覆盖及时打掉脚下【淤困之茧】；每掉 25% 血会进入 15 秒高闪避伪装，爆发大招错开该窗口。',
      hiddenSummary:
        '普攻增至 4 目标且附带中毒，伪装闪避飙至 80%；【悲惨之雨】酸雨覆盖一片场地，对该场地的我方单位降攻速并持续造成真实伤害，随行【丛生】还会施加禁疗。',
    },
    terms: [
      {
        term: '淤困之茧',
        kind: 'unit',
        desc: '【淤困捕食】在干员脚下召唤的束缚茧：使被困干员无法攻击、阻挡与开技能，必须依靠周围队友集火打掉茧才能解救。',
      },
      {
        term: '恶尘源石虫',
        kind: 'unit',
        desc: '领袖回合随行（×4）：死亡时对周围造成物理伤害并生成<源石污染区>，令区内的<萨卡兹枯朽前锋>改为法术攻击。',
      },
      {
        term: '假想敌：丛生',
        kind: 'unit',
        desc: '隐秘核心随行精英（×6）：对每个目标的首次攻击伤害大幅提升，并令目标一段时间内无法被治疗（禁疗），极易配合酸雨造成减员。',
      },
    ],
    hp: [298800, 996000, 2490000, 4150000],
    hiddenCore: [1892400, 4731000, 7885000],
    abilities: [
      {text: '对每个场地当前生命值最高的 3 个我方单位造成远程物理伤害'},
      {text: '每损失 25% 生命值进入 15 秒伪装，物理和法术闪避 50%'},
      {
        skill: '淤困捕食',
        text: '在若干我方单位脚下召唤<淤困之茧>，使其无法攻击、阻挡和开启技能',
      },
    ],
    hiddenAbilities: [
      {
        text: '普通攻击附带中毒，每个场地额外选择一个目标；【淤困捕食】目标数增加；伪装闪避提高到 80%',
      },
      {
        skill: '悲惨之雨',
        text: '酸雨覆盖一片场地，该片场地上的我方单位攻击速度下降并持续受到真实伤害',
      },
    ],
    stage: {
      marks: [{name: '茧', kind: 'boss', at: [8, 3]}],
      escorts: [
        {
          name: '恶尘源石虫',
          count: 4,
          note: '死亡时对周围造成物理伤害并生成源石污染区',
        },
      ],
    },
    hiddenStage: {
      marks: [{name: '茧', kind: 'boss', at: [8, 3]}],
      escorts: [
        {
          name: '假想敌：丛生',
          count: 6,
          note: '对每个目标的首次伤害提升，并使其一段时间内无法被治疗',
        },
      ],
    },
    counters: [
      {
        tag: '续航',
        roles: ['治疗'],
        text: '每次打当前生命最高的 3 个干员：高血量干员要有治疗',
        by: '特性',
      },
      {
        tag: '集火',
        text: '每掉 25% 生命伪装 15 秒、闪避 50%：爆发技能避开这段',
        by: '特性',
      },
      {
        tag: '阻挡',
        text: '若干干员会被<淤困之茧>捆住，无法攻击、阻挡、开技能：别只靠一个阻挡点',
        by: '淤困捕食',
      },
      {
        tag: '法抗',
        text: '<恶尘源石虫>死后留下源石污染区，<萨卡兹枯朽前锋>在区内改打法术伤害',
        by: '恶尘源石虫',
      },
      {
        tag: '续航',
        roles: ['治疗'],
        text: '酸雨覆盖整片场地：用群体治疗应对持续真实伤害与攻速下降',
        by: '悲惨之雨',
        hidden: true,
      },
      {
        tag: '续航',
        text: '<丛生>的首次伤害使目标暂时无法被治疗；茧的核心形态普攻另附加中毒',
        by: '丛生 / 核心普攻',
        hidden: true,
      },
    ],
    layout: {
      slots: [
        {role: '坦', at: [7, 4], facing: 'right', mark: '当前生命①'},
        {role: '坦', at: [2, 4], facing: 'right', mark: '当前生命②'},
        {role: '疗', at: [5, 2], facing: 'down'},
        {role: '输', at: [6, 2], facing: 'down', mark: '当前生命③'},
        {role: '输', at: [4, 1], facing: 'right'},
        {role: '空', at: [2, 2], facing: 'right'},
        {role: '群', at: [5, 3], facing: 'up'},
      ],
      zones: [
        {
          label: '三目标攻击',
          shape: {
            kind: 'tiles',
            at: [
              [7, 4],
              [2, 4],
              [6, 2],
            ],
          },
          hint: '按当前生命值选择前三名；治疗和受伤都会改变目标排序。',
          targets: [
            [7, 4],
            [2, 4],
            [6, 2],
          ],
        },
        {
          label: '淤困捕食',
          shape: {kind: 'tiles', at: [[6, 2]]},
          hint: '输出互相覆盖，及时打掉淤困之茧；阻挡位保留接替位置。',
          targets: [[6, 2]],
          markers: [{name: '茧', at: [6, 2]}],
        },
      ],
    },
    hiddenLayout: {
      slots: [
        {role: '坦', at: [7, 4], facing: 'right', mark: '当前生命①'},
        {role: '坦', at: [2, 4], facing: 'right', mark: '当前生命②'},
        {role: '疗', at: [5, 2], facing: 'down'},
        {role: '输', at: [6, 2], facing: 'down', mark: '当前生命③'},
        {role: '输', at: [4, 1], facing: 'right', mark: '当前生命④'},
        {role: '空', at: [2, 2], facing: 'right'},
        {role: '群', at: [5, 3], facing: 'up'},
      ],
      zones: [
        {
          label: '四目标攻击',
          shape: {
            kind: 'tiles',
            at: [
              [7, 4],
              [2, 4],
              [6, 2],
              [4, 1],
            ],
          },
          hint: '核心每个场地多攻击一名单位，普攻附加中毒。',
          tone: 'hc',
          targets: [
            [7, 4],
            [2, 4],
            [6, 2],
            [4, 1],
          ],
        },
        {
          label: '淤困捕食',
          shape: {kind: 'tiles', at: [[6, 2]]},
          hint: '输出互相覆盖，及时打掉淤困之茧；阻挡位保留接替位置。',
          targets: [[6, 2]],
          markers: [{name: '茧', at: [6, 2]}],
        },
        {
          label: '悲惨之雨',
          shape: {kind: 'rect', at: [1, 1], w: 6, h: 4},
          hint: '酸雨覆盖整个场地；准备群体续航应对真实伤害与攻速下降。',
          tone: 'hc',
          extraShapes: [{kind: 'rect', at: [7, 4], w: 1, h: 1}],
        },
      ],
    },
  },
  {
    name: '假想敌：鳍',
    id: 'enemy_9037_aceel',
    damage: ['法术', '神经'],
    profile: {
      attackMode: '巡逻近战 · 法术攻击 + 神经损伤（核心链式雷击）',
      defense: '参考 防 600 / 法抗 30（未被阻挡时自带高额减伤护盾）',
      targeting:
        '近战攻击阻挡目标；【离子环波】炸周围 1.5 格；核心雷暴劈站位密集处',
      blocking: '会巡逻进半场且必须阻挡破盾（挡住后下击增伤，需高法抗坦）',
      summary:
        '巡逻路线放高法抗硬坦拦住破掉减伤盾，后排离开主坦 1.5 格防环波溅射；带沉默可废【离子环波】，带对空+元素回复处理漂游者。',
      hiddenSummary:
        '普攻改为多目标连锁跳跃（连打同一目标伤害和跳跃数递增），全场进入雷暴天气周期性雷击扎堆干员；务必分散站位。',
    },
    terms: [
      {
        term: '特殊护盾',
        kind: 'mechanic',
        desc: '鳍未被阻挡时常驻物法减伤护盾；一旦被我方干员阻挡即消耗护盾，但它的下一次攻击伤害大幅提升，因此阻挡位必须够硬且有治疗。',
      },
      {
        term: '纤核漂游者',
        kind: 'unit',
        desc: '领袖回合飞行随行（×6）：优先攻击高台单位且攻击附带神经损伤，需要及时对空击落并备好元素回复。',
      },
      {
        term: '假想敌：淤困',
        kind: 'unit',
        desc: '隐秘核心地面随行（×2）：被阻挡时寄生目标造成持续法术伤害并放大所受元素损伤，容易让主坦迅速吃满神经损伤晕眩。',
      },
      {
        term: '雷暴天气',
        kind: 'mechanic',
        desc: '隐秘核心阶段常驻天气：周期性对站位最密集的我方区域降下雷击，搭配核心链式跳跃普攻，必须将后排拉散。',
      },
    ],
    hp: [151200, 504000, 1260000, 2100000],
    hiddenCore: [1482000, 3705000, 6175000],
    abilities: [
      {text: '攻击附带{神经损伤}'},
      {
        text: '未被阻挡时获得特殊护盾，受到的物理与法术伤害降低；被阻挡时消耗护盾，下次攻击伤害提升',
      },
      {
        skill: '离子环波',
        text: '对周围 1.5 格内所有我方单位造成法术伤害和{神经损伤}；可被沉默',
      },
    ],
    hiddenAbilities: [
      {
        text: '攻击在多个我方单位间跳跃，每跳伤害降低；连续攻击同一目标时伤害提升、跳跃次数增加',
      },
      {text: '在场时变为雷暴天气，周期性雷击站位密集的我方单位'},
    ],
    stage: {
      marks: [
        {
          name: '鳍',
          kind: 'boss',
          at: S1_LEADER_MOVEMENTS.fin.left.legs[0].points[0],
          movement: S1_LEADER_MOVEMENTS.fin,
        },
        {
          name: '纤核漂游者',
          kind: 'unit',
          at: S1_LEADER_MOVEMENTS.fiber.left.legs[0].points[0],
          movement: S1_LEADER_MOVEMENTS.fiber,
        },
      ],
      escorts: [
        {
          name: '纤核漂游者',
          count: 6,
          fly: true,
          note: '优先攻击高台单位，攻击附带{神经损伤}',
        },
      ],
    },
    hiddenStage: {
      marks: [
        {
          name: '鳍',
          kind: 'boss',
          at: S1_LEADER_MOVEMENTS.finCore.left.legs[0].points[0],
          movement: S1_LEADER_MOVEMENTS.finCore,
        },
      ],
      escorts: [
        {
          name: '假想敌：淤困',
          count: 2,
          note: '被阻挡时寄生目标：持续法术伤害，受到的{元素损伤}增加',
        },
      ],
    },
    counters: [
      {
        tag: '阻挡',
        roles: ['阻挡'],
        text: '没被挡住时带减伤护盾：巡逻路线上一定要有人挡',
        by: '特性',
      },
      {
        tag: '续航',
        roles: ['阻挡'],
        text: '被挡住后下一击伤害提升：阻挡位要扛得住',
        by: '特性',
      },
      {
        tag: '控制',
        roles: ['沉默'],
        text: '环波半径 1.5 格且可被沉默：阻挡位附近少放人，带沉默更稳',
        by: '离子环波',
      },
      {
        tag: '对空',
        roles: ['对空', '元素回复'],
        text: '<纤核漂游者>会飞，附带{神经损伤}',
        by: '纤核漂游者',
      },
      {
        tag: '分散',
        text: '雷暴周期性劈站位密集处；攻击还会在干员间跳跃',
        by: '雷暴天气',
        hidden: true,
      },
    ],
    layout: {
      slots: [
        {role: '坦', at: [6, 2], facing: 'right', mark: '法抗承伤'},
        {role: '坦', at: [7, 4], facing: 'right'},
        {role: '疗', at: [3, 1], facing: 'right'},
        {role: '输', at: [2, 1], facing: 'right'},
        {role: '输', at: [1, 3], facing: 'right'},
        {role: '空', at: [4, 2], facing: 'up'},
      ],
      zones: [
        {
          label: '离子环波',
          shape: {kind: 'circle', at: [6.9, 2], radius: 1.5},
          hint: '以鳍为中心的半径 1.5 格；后排离开承伤位周围，可用沉默处理环波。',
          targets: [[6, 2]],
          bossAt: [6.9, 2],
        },
        {
          label: '巡逻路线',
          shape: {
            kind: 'line',
            path: [
              [8, 2],
              [7, 1],
              [1, 4],
              [7, 3],
              [7, 1],
            ],
          },
          hint: '在巡逻经过的位置准备阻挡，后排与承伤位错开。',
        },
      ],
    },
    hiddenLayout: {
      slots: [
        {role: '坦', at: [6, 2], facing: 'right', mark: '法抗承伤'},
        {role: '坦', at: [7, 4], facing: 'right'},
        {role: '疗', at: [3, 1], facing: 'right'},
        {role: '输', at: [2, 1], facing: 'right'},
        {role: '输', at: [1, 3], facing: 'right'},
        {role: '空', at: [4, 2], facing: 'up'},
      ],
      zones: [
        {
          label: '离子环波',
          shape: {kind: 'circle', at: [6.9, 2], radius: 1.5},
          hint: '以鳍为中心的半径 1.5 格；后排离开承伤位周围，可用沉默处理环波。',
          targets: [[6, 2]],
          bossAt: [6.9, 2],
        },
        {
          label: '巡逻路线',
          shape: {
            kind: 'line',
            path: [
              [8, 2],
              [7, 1],
              [1, 4],
              [7, 3],
              [7, 1],
            ],
          },
          hint: '在巡逻经过的位置准备阻挡，后排与承伤位错开。',
        },
        {
          label: '连锁攻击',
          shape: {
            kind: 'line',
            path: [
              [6.9, 2],
              [6, 2],
            ],
          },
          hint: '连续攻击同一目标会增加伤害和跳跃数；后排保持间距。',
          tone: 'hc',
          targets: [[6, 2]],
          bossAt: [6.9, 2],
        },
      ],
    },
  },
  {
    name: '矩兽',
    id: 'enemy_2124_dyjsfg',
    damage: ['物理'],
    profile: {
      attackMode: '巡逻范围 · 不常规普攻，持续对周围 1.6 格造成物理伤害',
      defense: '基础防御 1000 / 法抗 10；移动时物法减伤 50%，被阻挡或停下时减伤降至 20%',
      targeting:
        '无视单点仇恨，伤害覆盖自身 1.6 格；每次被阻挡触发高额冲击；亡语打全场',
      blocking: '必须阻挡以削减减伤！初始占阻挡 2，首次半血后升至占阻挡 3',
      summary:
        '备好阻挡 ≥3 的超高坦度重装在巡逻线拦截减伤，后排全部站在 1.6 格圈外；控场收益极低，击杀前抬满全队血量扛住退场【兼爱】全场物伤。',
    },
    terms: [
      {
        term: '后兽',
        kind: 'unit',
        desc: '矩兽【兼爱】机制例外单位：矩兽被击倒或退场时会令场上除<后兽>外的所有敌人立刻退场，同时对我方全场造成一次无视隐匿的高额物理伤害。',
      },
      {
        term: '山海众秘使',
        kind: 'unit',
        desc: '本场随行敌人（×4）：自带隐匿，且隐匿失效后的下一次攻击伤害极高；建议携带反隐提前击杀或避免脆皮接敌。',
      },
    ],
    hp: [140400, 468000, 1170000, 1950000],
    hiddenCore: null,
    abilities: [
      {
        skill: '明力',
        text: '{晕眩}、{寒冷}、{冻结}等异常状态持续时间大幅降低，移动时受到的物理与法术伤害降低 50%；被阻挡或停止移动时降低 20%',
      },
      {
        skill: '尚同',
        text: '持续对周围 1.6 格造成物理伤害，每次被阻挡时额外造成一次高额物理伤害',
      },
      {
        skill: '非命',
        text: '生命值首次低于 50% 时，占用阻挡数、攻击力与移动速度提升',
      },
      {
        skill: '兼爱',
        text: '被击倒或退场时，使场上除<后兽>外的所有敌人退场，并对场上所有友方单位造成一次无视{隐匿}的高额物理伤害',
      },
    ],
    hiddenAbilities: [],
    stage: {
      marks: [
        {
          name: '矩兽',
          kind: 'boss',
          at: S1_LEADER_MOVEMENTS.beast.left.legs[0].points[0],
          movement: S1_LEADER_MOVEMENTS.beast,
        },
      ],
      escorts: [
        {
          name: '山海众秘使',
          count: 4,
          note: '{隐匿}；隐匿失效后的下一次攻击伤害更高',
        },
      ],
    },
    hiddenStage: null,
    counters: [
      {
        tag: '阻挡',
        roles: ['阻挡'],
        text: '被阻挡或停下时减伤变少：必须挡住',
        by: '明力',
      },
      {
        tag: '续航',
        roles: ['阻挡'],
        text: '每次被阻挡对周围额外一次高额物理伤害：阻挡位要硬，身边少放人',
        by: '尚同',
      },
      {
        tag: '控制',
        text: '{晕眩}{寒冷}{冻结}持续时间大幅缩短，控制收益低',
        by: '明力',
      },
      {
        tag: '阻挡',
        roles: ['阻挡'],
        text: '初始占用阻挡数 2，首次半血后增加到 3：提前准备阻挡 3 的承伤位',
        by: '非命',
      },
      {
        tag: '控制',
        roles: ['反隐'],
        text: '随行<山海众秘使>自带{隐匿}且破隐首击高伤，备反隐可安全提前清理',
        by: '山海众秘使',
      },
    ],
    layout: {
      slots: [
        {role: '坦', at: [6, 2], facing: 'right', mark: '半血后阻挡≥3'},
        {role: '坦', at: [7, 4], facing: 'right'},
        {role: '疗', at: [4, 2], facing: 'right'},
        {role: '输', at: [2, 1], facing: 'right'},
        {role: '输', at: [2, 4], facing: 'right'},
        {role: '空', at: [6, 4], facing: 'up'},
      ],
      zones: [
        {
          label: '尚同',
          shape: {kind: 'circle', at: [6.9, 2], radius: 1.6},
          hint: '初始占用阻挡 2，半血后 3；近身范围持续伤害，后排离开承伤圈。',
          targets: [[6, 2]],
          bossAt: [6.9, 2],
        },
        {
          label: '巡逻路线',
          shape: {
            kind: 'line',
            path: [
              [8, 2],
              [7, 1],
              [1, 4],
              [7, 3],
              [7, 1],
            ],
          },
          hint: '在巡逻经过的位置准备阻挡，后排与承伤位错开。',
        },
        {
          label: '兼爱',
          shape: {kind: 'rect', at: [1, 1], w: 6, h: 4},
          hint: '击倒前抬高全队生命，预留治疗或减伤承受退场伤害。',
          extraShapes: [{kind: 'rect', at: [7, 4], w: 1, h: 1}],
        },
      ],
    },
    hiddenLayout: null,
  },
];
