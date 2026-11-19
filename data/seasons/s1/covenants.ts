import type {Covenant} from '../../types.ts';

/**
 * 盟约效果（10 核心 + 16 附加，保持核心在前、附加在后顺序）
 *
 * id       公开路由标识
 * kind     core 核心盟约（3 人激活，6 名不同干员触发强化）；addon 附加盟约
 * color    主题色（仅核心盟约有）
 * need     激活人数
 * effect   基础效果，"层" 指该盟约的层数
 * bonus    强化效果，以 "N名" 开头时表示人数门槛
 * scaling  随层数变化的数值，供计算器与曲线使用：{ label, unit, at(层数), condition? }
 */
export const S1_COVENANTS: Readonly<Record<string, Covenant>> = {
  炎: {
    bonusRoles: ['元素输出'],
    bonusElements: ['神经', '灼燃', '凋亡', '侵蚀'],
    id: 'yan',
    kind: 'core',
    color: '#d65645',
    need: 3,
    effect: '【炎】攻击力 +(23+0.9×层)%',
    bonus:
      '6名不同【炎】：攻击附带6%攻击力随机元素损伤；全场敌人元素损伤恢复速度 +(40+0.3×层)%',
    scaling: [
      {label: '攻击力', unit: '%', at: (L) => 23 + 0.9 * L},
      {
        label: '敌人元素恢复速度(6人)',
        unit: '%',
        at: (L) => 40 + 0.3 * L,
        condition: '6 名不同炎',
      },
    ],
  },
  萨尔贡: {
    roles: ['高频'],
    bonusRoles: ['群攻', '控制'],
    id: 'sargon',
    kind: 'core',
    color: '#d4a03c',
    need: 3,
    effect: '开技能时全体【萨尔贡】攻速+12（至多+300），持续 (5+0.22×层)秒',
    bonus:
      '6名不同【萨尔贡】：开技能生成流沙，迟钝 (20+0.025×层)%，每5秒 (5000+25×层) 法伤并束缚；技能期间每秒 (800+4×层) 法伤',
    scaling: [
      {label: '攻速增益持续', unit: '秒', at: (L) => 5 + 0.22 * L},
      {
        label: '流沙每5秒法伤(6人)',
        unit: '',
        at: (L) => 5000 + 25 * L,
        condition: '6 名不同萨尔贡',
      },
      {
        label: '技能中流沙每秒法伤',
        unit: '',
        at: (L) => 800 + 4 * L,
        condition: '6 名不同萨尔贡 · 技能期间',
      },
    ],
  },
  维多利亚: {
    id: 'victoria',
    kind: 'core',
    color: '#4f7ccc',
    need: 3,
    effect:
      '携带装备的【维多利亚】伤害提升至 (125+0.8×层)%；每25层得一把特效维式重锤',
    bonus: '6名不同【维多利亚】：每件装备攻击力+40%（进阶+80%）',
    scaling: [
      {
        label: '带装备伤害倍率',
        unit: '%',
        at: (L) => 125 + 0.8 * L,
        condition: '携带装备的维多利亚',
      },
      {label: '已得重锤', unit: '把', at: (L) => Math.floor(L / 25)},
    ],
    cycleReward: {every: 25, reward: '特效维式重锤 ×1'},
  },
  谢拉格: {
    bonusRoles: ['阻挡', '群攻'],
    id: 'kjerag',
    kind: 'core',
    color: '#73bfdc',
    need: 3,
    effect:
      '【谢拉格】伤害125%，对寒冷/冻结敌人 (135+1×层)%；每100层得谢拉格不融冰',
    bonus:
      '6名不同【谢拉格】：战斗开始召唤雪山巨人（攻击与生命随层数提升），雪山/巨人形态切换',
    scaling: [
      {
        label: '对寒冷冻结伤害',
        unit: '%',
        at: (L) => 135 + L,
        condition: '谢拉格攻击寒冷 / 冻结敌人',
      },
      {label: '已得不融冰', unit: '块', at: (L) => Math.floor(L / 100)},
    ],
    cycleReward: {every: 100, reward: '谢拉格不融冰 ×1'},
  },
  阿戈尔: {
    id: 'aegir',
    kind: 'core',
    color: '#2e9f98',
    need: 3,
    effect:
      '【阿戈尔】生命 +(35+1×层)%；战斗开始吞噬身前一格干员，获得其基础攻击力与阻挡数，并叠加等于其等阶的层数',
    bonus: '6名不同【阿戈尔】：前3名阿戈尔首次被击倒时立刻复活',
    scaling: [{label: '生命值', unit: '%', at: (L) => 35 + L}],
    restrictedModeAbsent: true,
  },
  叙拉古: {
    roles: ['高频'],
    bonusRoles: ['真伤', '控制', '群攻'],
    id: 'siracusa',
    kind: 'core',
    color: '#8a68b8',
    need: 3,
    effect: '【叙拉古】部署后攻速 +(25+0.8×层)，持续 (32+0.4×层)秒',
    bonus:
      '6名不同【叙拉古】：攻击30%概率附加随机异常，持续 (1+0.0018×层)秒；敌人有≥2种异常时每秒对自身及周围 (800+10×层) 真伤',
    scaling: [
      {label: '部署后攻速', unit: '', at: (L) => 25 + 0.8 * L},
      {label: '持续时间', unit: '秒', at: (L) => 32 + 0.4 * L},
      {
        label: '双异常每秒真伤(6人)',
        unit: '',
        at: (L) => 800 + 10 * L,
        condition: '6 名不同叙拉古 · 敌人至少 2 种异常',
      },
    ],
  },
  卡西米尔: {
    bonusRoles: ['真伤'],
    id: 'kazimierz',
    kind: 'core',
    color: '#c4ad37',
    need: 3,
    effect: '每有干员部署，【卡西米尔】攻击力+20%，上限 (50+1×层)%，持续整场',
    bonus:
      '6名不同【卡西米尔】：地面卡西米尔倒下时离场并召唤整备区最右侧卡西米尔；开技能或部署后30秒内攻击附带65%攻击力真伤',
    scaling: [
      {label: '攻击力上限', unit: '%', at: (L) => 50 + L},
      {
        label: '叠满所需部署次数',
        unit: '次',
        at: (L) => Math.ceil((50 + L) / 20),
      },
    ],
    restrictedModeAbsent: true,
  },
  乌萨斯: {
    id: 'ursus',
    kind: 'core',
    color: '#c0506e',
    need: 3,
    effect:
      '【乌萨斯】攻击力 +(35+0.75×层)%，生命 +(10+0.3×层)%；击倒单位叠2层临时层数',
    bonus:
      '6名不同【乌萨斯】：受伤的 (15+0.05×层)% 转为可中断的生命流失；阻挡时敌人每秒受 (50+0.25×层)% 攻击力法伤；击倒叠4层临时层数',
    scaling: [
      {label: '攻击力', unit: '%', at: (L) => 35 + 0.75 * L},
      {label: '生命值', unit: '%', at: (L) => 10 + 0.3 * L},
      {
        label: '阻挡每秒法伤(6人)',
        unit: '%攻',
        at: (L) => 50 + 0.25 * L,
        condition: '6 名不同乌萨斯 · 阻挡时',
      },
    ],
  },
  伊比利亚: {
    memberArtsDamage: true,
    roles: ['高频'],
    bonusRoles: ['控制', '群攻'],
    id: 'iberia',
    kind: 'core',
    color: '#3f8a6a',
    need: 3,
    effect:
      '【伊比利亚】每次伤害使目标每秒受 (11+0.06×层)% 攻击力法伤，叠10次，持续10秒',
    bonus:
      '6名不同【伊比利亚】：持续法伤×2，每次叠减速4%（至多80%）；20%概率弹射300%攻击力法伤',
    scaling: [
      {label: '每层每秒法伤', unit: '%攻', at: (L) => 11 + 0.06 * L},
      {label: '叠满10层每秒', unit: '%攻', at: (L) => (11 + 0.06 * L) * 10},
    ],
  },
  莱塔尼亚: {
    id: 'leithanien',
    kind: 'core',
    color: '#c46cad',
    need: 3,
    effect:
      '【莱塔尼亚】干员与召唤物攻击力 +(30+1×层)%；敌人倒下时召唤“一个小节”（上限10）',
    bonus:
      '6名不同【莱塔尼亚】：(30+0.1×层)% 概率改召“一个乐部”（莱塔尼亚攻速+20），召唤物上限20；我方倒下也召唤小节',
    scaling: [
      {label: '攻击力', unit: '%', at: (L) => 30 + L},
      {
        label: '乐部概率(6人)',
        unit: '%',
        at: (L) => Math.min(100, 30 + 0.1 * L),
        condition: '6 名不同莱塔尼亚',
      },
    ],
  },
  精准: {
    bonusRoles: ['破抗'],
    id: 'precision',
    kind: 'addon',
    need: 2,
    effect: '【精准】攻击力 +(10+1.2×层)%',
    bonus: '3名：范围扩展至所有远程干员，攻击无视30%防御与法抗',
    scaling: [{label: '攻击力', unit: '%', at: (L) => 10 + 1.2 * L}],
    headcountBreakpoint: {
      order: 1,
      condition: '3 名',
      effect: '扩展至全体远程 · 无视 30% 双抗',
    },
  },
  迅捷: {
    id: 'swift',
    kind: 'addon',
    need: 2,
    effect: '【迅捷】技能结束时 (20+0.35×层)% 概率立刻回12技力',
    bonus: '40层：所有干员技能结束时同概率额外回15技力',
    scaling: [
      {
        label: '回技力概率',
        unit: '%',
        at: (L) => Math.min(100, 20 + 0.35 * L),
        condition: '技能结束时',
      },
    ],
    layerBreakpoints: [
      {layers: 40, effect: '全体技能结束时，同概率额外回复 15 技力'},
    ],
    commonLayerOrder: 2,
  },
  灵巧: {
    roles: ['高频'],
    id: 'dexterity',
    kind: 'addon',
    need: 2,
    effect: '【灵巧】及周围4格干员攻速 +(10+1×层)',
    bonus: '40层：范围变为周围8格',
    scaling: [{label: '攻速', unit: '', at: (L) => 10 + L}],
    layerBreakpoints: [{layers: 40, effect: '周围 4 格 → 8 格'}],
    commonLayerOrder: 1,
    restrictedModeAbsent: true,
    mechanics: {rangePreviewLayers: 40},
  },
  坚守: {
    id: 'steadfast',
    kind: 'addon',
    need: 2,
    effect: '所有干员生命 +(25+1.2×层)%',
    bonus:
      '3名：非坚守干员40%伤害由坚守分摊；坚守受伤反击 (850+10×层) 法伤与40%脆弱',
    scaling: [
      {label: '生命值', unit: '%', at: (L) => 25 + 1.2 * L},
      {
        label: '反击法伤(3人)',
        unit: '',
        at: (L) => 850 + 10 * L,
        condition: '3 名坚守',
      },
    ],
    headcountBreakpoint: {
      order: 2,
      condition: '3 名',
      effect: '分摊伤害 · 受伤反击',
    },
  },
  助力: {
    id: 'support',
    kind: 'addon',
    need: 2,
    effect:
      '所有干员防御 +(15+1.2×层)%，再部署-30%；休整期结束时所有已激活盟约+2层',
    bonus: '3名：改为每回合所有已激活盟约+4层',
    scaling: [{label: '防御力', unit: '%', at: (L) => 15 + 1.2 * L}],
    headcountBreakpoint: {
      order: 3,
      condition: '3 名',
      effect: '已激活盟约每回合 +4 层',
    },
    mechanics: {endOfRestAllActiveLayers: {base: 2, bonus: 4}},
  },
  远见: {
    id: 'foresight',
    kind: 'addon',
    need: 2,
    effect: '每10层得2资金；整备区也计入人数',
    bonus: '首次80层：远见干员购买价格-1；首次150层：再-1',
    scaling: [
      {label: '累计获得资金', unit: '', at: (L) => Math.floor(L / 10) * 2},
    ],
    layerBreakpoints: [
      {layers: 80, effect: '首次达成：远见干员购买价 −1'},
      {layers: 150, effect: '首次达成：远见干员购买价再 −1'},
    ],
    commonLayerOrder: 4,
    cycleReward: {every: 10, reward: '资金 +2'},
    mechanics: {
      countsReserve: true,
      priceDiscounts: {
        minPrice: 1,
        steps: [
          {layers: 80, discount: 1},
          {layers: 150, discount: 1},
        ],
      },
    },
  },
  奇迹: {
    id: 'miracle',
    kind: 'addon',
    need: 2,
    effect: '刷新时 (18+0.25×层)% 概率下次刷新免费；整备区也计入人数',
    bonus: '首次100层：刷新至少出现1名等同调度中心等级的干员',
    scaling: [
      {
        label: '免费刷新概率',
        unit: '%',
        at: (L) => Math.min(100, 18 + 0.25 * L),
      },
    ],
    layerBreakpoints: [
      {layers: 100, effect: '首次达成：刷新至少出现 1 名当前等级的干员'},
    ],
    commonLayerOrder: 5,
    restrictedModeAbsent: true,
    mechanics: {countsReserve: true},
  },
  投资人: {
    id: 'investor',
    kind: 'addon',
    need: 3,
    effect: '“获得时”特质每次触发2次；整备区也计入人数',
    bonus: '100层：触发3次',
    scaling: [
      {label: '获得时触发次数', unit: '次', at: (L) => (L >= 100 ? 3 : 2)},
    ],
    layerBreakpoints: [{layers: 100, effect: '获得时特质：2 次 → 3 次'}],
    commonLayerOrder: 6,
    restrictedModeAbsent: true,
    mechanics: {
      countsReserve: true,
      acquisitionMultiplier: {base: 2, bonusLayers: 100, bonus: 3},
    },
  },
  突袭: {
    bonusRoles: ['高频'],
    id: 'assault',
    kind: 'addon',
    need: 2,
    effect:
      '10秒未攻击或技能就绪且范围无敌人时，带技力闪现到地面敌人身边，攻击与生命 +(25+1×层)%',
    bonus: '50层：所有干员攻速+50',
    scaling: [{label: '攻击/生命', unit: '%', at: (L) => 25 + L}],
    layerBreakpoints: [{layers: 50, effect: '全体攻速 +50'}],
    commonLayerOrder: 3,
    restrictedModeAbsent: true,
  },
  不屈: {
    id: 'unyielding',
    kind: 'addon',
    need: 2,
    effect: '地面干员倒下时 (18+0.4×层)% 概率立刻重新部署',
    bonus: '3名：地面干员倒下时全场技力+5',
    scaling: [
      {
        label: '立即重部署概率',
        unit: '%',
        at: (L) => Math.min(100, 18 + 0.4 * L),
        condition: '地面干员倒下时',
      },
    ],
    headcountBreakpoint: {
      order: 4,
      condition: '3 名',
      effect: '地面干员倒下时全场技力 +5',
    },
  },
  调和: {
    id: 'harmony',
    kind: 'addon',
    need: 1,
    effect: '场上核心盟约激活人数+1，调和干员享受已激活的核心盟约效果',
    bonus: '',
    scaling: [],
    mechanics: {addsCoreCount: 1},
  },
  协防干员: {
    id: 'defender',
    kind: 'addon',
    need: 2,
    effect: '所有干员受到物理与法术伤害-20%；协防干员伤害120%，精锐140%',
    bonus: '',
    scaling: [],
  },
  独行: {
    id: 'lone',
    kind: 'addon',
    need: 1,
    effect: '场上恰好1名独行时：其攻击与生命+60%，初始技力+15（2名及以上失效）',
    bonus: '',
    scaling: [],
    restrictedModeAbsent: true,
    mechanics: {maxCount: 1},
  },
  绝技: {
    id: 'mastery',
    kind: 'addon',
    need: 2,
    effect: '2名精锐：精锐攻击力+30%',
    bonus: '5名精锐：精锐技力消耗-30%（任何干员的精锐状态都计入）',
    scaling: [],
    headcountBreakpoint: {
      order: 7,
      condition: '5 名精锐',
      effect: '精锐干员技力消耗 −30%',
    },
    restrictedModeAbsent: true,
    mechanics: {countMode: 'fieldElites', bonusNeed: 5},
  },
  聚合: {
    roles: ['治疗', '元素回复'],
    id: 'convergence',
    kind: 'addon',
    need: 2,
    effect:
      '范围内友方每秒回复 (16+0.12×层)% 攻击力生命与 (8+0.06×层)% 元素损伤',
    bonus: '3名：范围内干员获得 (15+0.08×层)% 庇护',
    scaling: [
      {label: '每秒治疗', unit: '%攻', at: (L) => 16 + 0.12 * L},
      {
        label: '庇护(3人)',
        unit: '%',
        at: (L) => 15 + 0.08 * L,
        condition: '3 名聚合',
      },
    ],
    headcountBreakpoint: {
      order: 5,
      condition: '3 名',
      effect: '范围内友方获得庇护',
    },
  },
  奥术: {
    memberArtsDamage: true,
    roles: ['高频'],
    bonusRoles: ['反隐', '破抗'],
    id: 'arcane',
    kind: 'addon',
    need: 2,
    effect: '【奥术】伤害额外附加 (20+0.4×层)% 攻击力法伤',
    bonus: '3名：敌人每次受伤法抗-1（至多 -(30+0.05×层)）；范围内敌人隐匿失效',
    scaling: [
      {label: '附加法伤', unit: '%攻', at: (L) => 20 + 0.4 * L},
      {
        label: '法抗削减上限(3人)',
        unit: '',
        at: (L) => 30 + 0.05 * L,
        condition: '3 名奥术',
      },
    ],
    headcountBreakpoint: {
      order: 6,
      condition: '3 名',
      effect: '削减法抗 · 范围内反隐',
    },
  },
};
