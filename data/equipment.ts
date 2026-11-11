import type { Equipment, EquipmentCombo } from './types.ts';

/**
 * 装备（70 件）
 *
 * name      名称
 * tier      等阶 1–6
 * price     价格（资金）
 * covenant  与变形同构体组合后得到的盟约；null = 不可组合
 * effect    基础效果
 * advanced  进阶效果（同名两件合成）；null = 无进阶
 * icon      图标文件名：assets/img/equipment/<icon>.webp
 */
export const EQUIPMENT: readonly Equipment[] = [
  {
    name: '维式重锤', tier: 1, price: 1, covenant: '维多利亚', icon: 'e00',
    effect: '攻击力+15%',
    advanced: '攻击力+25%',
  },
  {
    name: '坚守盾牌', tier: 1, price: 1, covenant: '坚守', icon: 'e01',
    effect: '防御力+20%',
    advanced: '防御力+35%',
  },
  {
    name: '盟约之币', tier: 1, price: 1, covenant: null, icon: 'e02',
    effect: '装备时销毁，获得1资金',
    advanced: '装备时销毁，获得2资金',
  },
  {
    name: '随身身份牌', tier: 1, price: 1, covenant: null, icon: 'e03',
    effect: '装备时销毁，携带者所属盟约层数+3（无需激活）',
    advanced: '装备时销毁，携带者所属盟约层数+6（无需激活）',
  },
  {
    name: '源石溶剂', tier: 1, price: 1, covenant: null, icon: 'e04',
    effect: '每秒流失60生命，攻击力+40%',
    advanced: '每秒流失60生命，攻击力+60%',
  },
  {
    name: '虹彩活血饮料', tier: 1, price: 1, covenant: null, icon: 'e05',
    effect: '无法被治疗，每秒回复75生命',
    advanced: '无法被治疗，每秒回复150生命',
  },
  {
    name: '雪祀之衣', tier: 1, price: 1, covenant: null, icon: 'e06',
    effect: '生命上限+15%，更不易被攻击，阻挡-1',
    advanced: '生命上限+25%，更不易被攻击，阻挡-1',
  },
  {
    name: '不屈弹射器', tier: 2, price: 1, covenant: '不屈', icon: 'e07',
    effect: '再部署时间-30%，生命上限-30%',
    advanced: '再部署时间-50%，生命上限-30%',
  },
  {
    name: '紧急调度券', tier: 2, price: 2, covenant: null, icon: 'e08',
    effect: '装备时销毁，随机获取调度中心1名干员',
    advanced: '装备时销毁，随机获取调度中心2名干员',
  },
  {
    name: '战栗维式重锤', tier: 2, price: 2, covenant: '维多利亚', icon: 'e09',
    effect: '攻击力+20%；地面干员攻击10%概率战栗2秒',
    advanced: '攻击力+35%；地面干员攻击10%概率战栗2秒',
  },
  {
    name: '萨尔贡浓茶', tier: 2, price: 2, covenant: '萨尔贡', icon: 'e10',
    effect: '技力自然回复+0.15/秒',
    advanced: '技力自然回复+0.25/秒',
  },
  {
    name: '精打细算玩偶', tier: 2, price: 3, covenant: null, icon: 'e11',
    effect: '装备时销毁，之后每回合开始+1资金',
    advanced: '装备时销毁，之后每回合开始+2资金',
  },
  {
    name: '简易通讯机', tier: 2, price: 2, covenant: null, icon: 'e12',
    effect: '装备时销毁，随机获得1名同第一盟约干员',
    advanced: '装备时销毁，随机获得2名同第一盟约干员',
  },
  {
    name: '见钱眼开玩偶', tier: 2, price: 1, covenant: null, icon: 'e13',
    effect: '装备时销毁，下回合+2资金',
    advanced: '装备时销毁，下回合+4资金',
  },
  {
    name: '卫戍推荐信', tier: 2, price: 2, covenant: null, icon: 'e14',
    effect: '休整期结束时，携带者已激活盟约层数+1',
    advanced: '休整期结束时，携带者已激活盟约层数+2',
  },
  {
    name: '聚合急救箱', tier: 2, price: 2, covenant: '聚合', icon: 'e15',
    effect: '范围内友方首次低于50%生命时治疗35%',
    advanced: '范围内友方首次低于50%生命时治疗50%',
  },
  {
    name: '灵巧涡轮手套', tier: 2, price: 2, covenant: '灵巧', icon: 'e16',
    effect: '部署后每秒攻速+2（20次），受伤清空',
    advanced: '部署后每秒攻速+3（20次），受伤清空',
  },
  {
    name: '叙拉古正装', tier: 3, price: 2, covenant: '叙拉古', icon: 'e17',
    effect: '攻速+15，左右两侧干员攻速+10',
    advanced: '攻速+25，左右两侧干员攻速+15',
  },
  {
    name: '精准狙击镜', tier: 3, price: 2, covenant: '精准', icon: 'e18',
    effect: '攻击3格及以上目标伤害+30%',
    advanced: '攻击3格及以上目标伤害+50%',
  },
  {
    name: '炎国短刀', tier: 3, price: 2, covenant: '炎', icon: 'e19',
    effect: '每开启一次技能攻击力+5%（10次）',
    advanced: '每开启一次技能攻击力+8%（10次）',
  },
  {
    name: '迅捷作战粮', tier: 3, price: 2, covenant: '迅捷', icon: 'e20',
    effect: '部署时+3技力，每有一名同盟约干员再+3',
    advanced: '部署时+6技力，每有一名同盟约干员再+6',
  },
  {
    name: '歌利亚头盔', tier: 3, price: 2, covenant: null, icon: 'e21',
    effect: '生命上限+25%；身前无干员再+15%',
    advanced: '生命上限+45%；身前无干员再+25%',
  },
  {
    name: '阿戈尔重刃', tier: 3, price: 2, covenant: '阿戈尔', icon: 'e22',
    effect: '攻击力+40%，攻速-10',
    advanced: '攻击力+60%，攻速-10',
  },
  {
    name: '奥术法阵', tier: 3, price: 1, covenant: '奥术', icon: 'e23',
    effect: '法抗+20，攻击使目标失去特殊能力5秒',
    advanced: '法抗+30，攻击使目标失去特殊能力5秒',
  },
  {
    name: '坚固维式重锤', tier: 3, price: 2, covenant: '维多利亚', icon: 'e24',
    effect: '攻击力+25%；首次致命伤害锁血8秒',
    advanced: '攻击力+45%；首次致命伤害锁血8秒',
  },
  {
    name: '加速维式重锤', tier: 3, price: 2, covenant: '维多利亚', icon: 'e25',
    effect: '攻击力+25%，攻速+30',
    advanced: '攻击力+45%，攻速+30',
  },
  {
    name: '突袭手雷', tier: 3, price: 1, covenant: '突袭', icon: 'e26',
    effect: '部署后10秒内攻击晕眩2秒',
    advanced: '部署后15秒内攻击晕眩2秒',
  },
  {
    name: '驮兽储蓄罐', tier: 3, price: 3, covenant: null, icon: 'e27',
    effect: '装备时销毁，随机1~6资金',
    advanced: '装备时销毁，随机2~12资金',
  },
  {
    name: '乌萨斯呼吸器', tier: 3, price: 2, covenant: '乌萨斯', icon: 'e28',
    effect: '阻挡+1，攻击力+20%，每次再部署叠加（2次）',
    advanced: '阻挡+1，攻击力+30%，每次再部署叠加（3次）',
  },
  {
    name: '多功能补剂', tier: 3, price: 2, covenant: null, icon: 'e29',
    effect: '每次造成伤害，所属已激活盟约临时层数+1（每场12）',
    advanced: '每次造成伤害，所属已激活盟约临时层数+2（每场24）',
  },
  {
    name: '伊比利亚骨刺刀', tier: 3, price: 2, covenant: '伊比利亚', icon: 'e30',
    effect: '每次伤害额外1次25%攻击力法伤',
    advanced: '每次伤害额外2次25%攻击力法伤',
  },
  {
    name: '定期存折', tier: 3, price: 2, covenant: null, icon: 'e31',
    effect: '装备时销毁，获得X资金（持有时每回合+1）',
    advanced: null,
  },
  {
    name: '不退者之盾', tier: 3, price: 2, covenant: null, icon: 'e32',
    effect: '免疫晕眩、冻结等状态；配不退者力场→不退者卫护系统',
    advanced: null,
  },
  {
    name: '寻呼模块', tier: 4, price: 4, covenant: null, icon: 'e33',
    effect: '装备时销毁，出现至多3名同第一盟约干员免费选1',
    advanced: null,
  },
  {
    name: '蜂鸣器', tier: 4, price: 1, covenant: null, icon: 'e34',
    effect: '更容易被攻击，生命上限+40%',
    advanced: '更容易被攻击，生命上限+60%',
  },
  {
    name: '伪装服', tier: 4, price: 1, covenant: null, icon: 'e35',
    effect: '首次受伤后隐匿15秒',
    advanced: '首次受伤后隐匿25秒',
  },
  {
    name: '卡西米尔竞技旗', tier: 4, price: 2, covenant: '卡西米尔', icon: 'e36',
    effect: '部署后15秒伤害135%，随后衰减',
    advanced: '部署后15秒伤害160%，随后衰减',
  },
  {
    name: '灼燃维式重锤', tier: 4, price: 2, covenant: '维多利亚', icon: 'e37',
    effect: '攻击力+30%；法伤附带10%灼燃损伤',
    advanced: '攻击力+50%；法伤附带10%灼燃损伤',
  },
  {
    name: '护盾无人机', tier: 4, price: 2, covenant: null, icon: 'e38',
    effect: '治疗时10%概率给1层护盾',
    advanced: '治疗时15%概率给1层护盾',
  },
  {
    name: 'M3茧甲', tier: 4, price: 2, covenant: null, icon: 'e39',
    effect: '被击倒时立刻复活（每场1次）',
    advanced: '被击倒时立刻复活（每场2次）',
  },
  {
    name: '莱塔尼亚小鼓', tier: 4, price: 2, covenant: '莱塔尼亚', icon: 'e40',
    effect: '范围内每有单位倒下回复2技力',
    advanced: '范围内每有单位倒下回复4技力',
  },
  {
    name: '谢拉格不融冰', tier: 4, price: 2, covenant: '谢拉格', icon: 'e41',
    effect: '造成伤害12%概率寒冷1.5秒',
    advanced: '造成伤害20%概率寒冷1.5秒',
  },
  {
    name: '可靠怀表', tier: 4, price: 2, covenant: null, icon: 'e42',
    effect: '技能所需技力-20%，技能期间攻速-25%',
    advanced: '技能所需技力-40%，技能期间攻速-25%',
  },
  {
    name: '一次性促销券', tier: 4, price: 2, covenant: null, icon: 'e43',
    effect: '装备时销毁，出现3件装备免费选1',
    advanced: '装备时销毁，出现6件装备免费选2',
  },
  {
    name: '驱逐者警棍', tier: 4, price: 2, covenant: null, icon: 'e44',
    effect: '对异常状态敌人伤害+30%；配驱逐者瓦斯→驱逐者防暴装备',
    advanced: null,
  },
  {
    name: '动能单手弩', tier: 4, price: 2, covenant: null, icon: 'e45',
    effect: '30%概率该次攻击力130%；配动能加速器→动能轰击弩',
    advanced: null,
  },
  {
    name: '汲取者之喙', tier: 4, price: 2, covenant: null, icon: 'e46',
    effect: '伤害5%吸血；配汲取者之心→汲取者之镰',
    advanced: null,
  },
  {
    name: '双模机械臂', tier: 5, price: 3, covenant: null, icon: 'e47',
    effect: '攻击力+30%，伤害转为弱点伤害',
    advanced: '攻击力+50%，伤害转为弱点伤害',
  },
  {
    name: '信标', tier: 5, price: 3, covenant: null, icon: 'e48',
    effect: '销毁携带干员，出现2名同阶干员免费选1；原干员下回合送给队友',
    advanced: null,
  },
  {
    name: '拟态物质', tier: 5, price: 4, covenant: null, icon: 'e49',
    effect: '已有2名该初始干员时再给1名（直接三连）；否则随机1名同阶',
    advanced: null,
  },
  {
    name: '博士投影', tier: 5, price: 5, covenant: null, icon: 'e50',
    effect: '下回合开始时使携带者晋升精锐',
    advanced: '立即使携带者晋升精锐',
  },
  {
    name: '天马之盔', tier: 5, price: 3, covenant: null, icon: 'e51',
    effect: '生命上限+60%；配天马之枪→天马之耀',
    advanced: null,
  },
  {
    name: '电流维式重锤', tier: 5, price: 2, covenant: '维多利亚', icon: 'e52',
    effect: '攻击力+30%；5%麻痹，对麻痹敌人无视30%防御法抗',
    advanced: '攻击力+50%；5%麻痹，对麻痹敌人无视30%防御法抗',
  },
  {
    name: '佣兵名牌', tier: 5, price: 2, covenant: null, icon: 'e53',
    effect: '每种激活盟约使携带者攻击、生命+6%（8次）',
    advanced: '每种激活盟约使携带者攻击、生命+12%（8次）',
  },
  {
    name: '人事部记录', tier: 5, price: 3, covenant: null, icon: 'e54',
    effect: '装备时销毁，特殊刷新，优先出现同第一盟约干员',
    advanced: null,
  },
  {
    name: '瓶装烈性反应', tier: 5, price: 2, covenant: null, icon: 'e55',
    effect: '对元素爆发中的敌人伤害+30%',
    advanced: '对元素爆发中的敌人伤害+50%',
  },
  {
    name: '不退者力场', tier: 5, price: 3, covenant: null, icon: 'e56',
    effect: '阻挡+2，每阻挡1名生命、防御+20%；配不退者之盾→卫护系统',
    advanced: null,
  },
  {
    name: '驱逐者瓦斯', tier: 5, price: 3, covenant: null, icon: 'e57',
    effect: '范围内敌人异常状态时长+100%；配驱逐者警棍→防暴装备',
    advanced: null,
  },
  {
    name: '投机骰子', tier: 5, price: 3, covenant: null, icon: 'e58',
    effect: '装备时销毁，从3个指令中选1个替换当前指令',
    advanced: null,
  },
  {
    name: '天马之枪', tier: 6, price: 3, covenant: null, icon: 'e59',
    effect: '攻击力+50%；配天马之盔→天马之耀',
    advanced: null,
  },
  {
    name: '人事部文档', tier: 6, price: 4, covenant: null, icon: 'e60',
    effect: '装备时销毁，最大可部署人数变为9',
    advanced: null,
  },
  {
    name: '变形同构体', tier: 6, price: 3, covenant: null, icon: 'e61',
    effect: '携带者获得另一件携带装备对应的盟约',
    advanced: null,
  },
  {
    name: '动能加速器', tier: 6, price: 3, covenant: null, icon: 'e62',
    effect: '每次攻击/治疗攻速+2（60层）；配动能单手弩→动能轰击弩',
    advanced: null,
  },
  {
    name: '汲取者之心', tier: 6, price: 3, covenant: null, icon: 'e63',
    effect: '攻击力+30%，攻速+30，每秒流失1%生命；配汲取者之喙→汲取者之镰',
    advanced: null,
  },
  {
    name: '终极维式重锤', tier: 6, price: 3, covenant: '维多利亚', icon: 'e64',
    effect: '获得场上所有维式重锤特效，每种特效再+20%攻击力',
    advanced: null,
  },
  {
    name: '不退者卫护系统', tier: 6, price: 6, covenant: null, icon: 'e65',
    effect: '免疫异常，阻挡+2，阻挡加生命防御，开技能诱导周围敌人3秒',
    advanced: null,
  },
  {
    name: '动能轰击弩', tier: 6, price: 6, covenant: null, icon: 'e66',
    effect: '30%概率130%攻击；攻速叠满60层后30%概率范围100%物伤',
    advanced: null,
  },
  {
    name: '汲取者之镰', tier: 6, price: 6, covenant: null, icon: 'e67',
    effect: '攻击力+30%，攻速+30，5%吸血；技能期间翻倍且无法被治疗',
    advanced: null,
  },
  {
    name: '驱逐者防暴装备', tier: 6, price: 6, covenant: null, icon: 'e68',
    effect: '异常时长+100%，对异常敌人伤害+30%，技能期间50%传染异常',
    advanced: null,
  },
  {
    name: '天马之耀', tier: 6, price: 6, covenant: null, icon: 'e69',
    effect: '生命上限+60%，每秒回复8%；攻击力+50%，额外30%攻击力真伤',
    advanced: null,
  },
];

/** 组合装备：前两件 → 第三件（价格 6） */
export const EQUIPMENT_COMBOS: readonly EquipmentCombo[] = [
  ['天马之盔', '天马之枪', '天马之耀'],
  ['不退者之盾', '不退者力场', '不退者卫护系统'],
  ['动能单手弩', '动能加速器', '动能轰击弩'],
  ['汲取者之喙', '汲取者之心', '汲取者之镰'],
  ['驱逐者警棍', '驱逐者瓦斯', '驱逐者防暴装备'],
];
