/**
 * 策略（开局指挥，61 名）
 *
 * name      名称
 * hp        初始目标生命
 * skill     技能名
 * effect    技能效果
 * unlock    解锁条件（"初始" = 默认可用）
 * category  分类：叠层 / 精锐 / 抓牌 / 经济 / 装备 / 生存，或核心盟约名（阵营策略）
 * portrait  头像文件名：assets/img/strategies/<portrait>.webp
 */
export const STRATEGY_CATEGORIES = ['全部', '叠层', '精锐', '抓牌', '经济', '装备', '生存', '阵营'];

export const STRATEGIES = [
  {
    name: '阿米娅', hp: 25, category: '叠层', unlock: '初始', portrait: 's00',
    skill: '众志合一',
    effect: '场上存在3/4/5种以上激活盟约时，所有干员攻击力、生命上限+20%/30%/40%',
  },
  {
    name: '歌利亚', hp: 40, category: '生存', unlock: '初始', portrait: 's01',
    skill: '坚不可摧',
    effect: '初始目标生命值为40点',
  },
  {
    name: '大帝', hp: 26, category: '生存', unlock: '初始', portrait: 's02',
    skill: '加急调派',
    effect: '我方干员每次部署后，本场战斗内再部署时间-50%',
  },
  {
    name: '卡莱莎', hp: 26, category: '生存', unlock: '初始', portrait: 's03',
    skill: '食腐之蝶',
    effect: '我方干员被击倒时，场上剩余单位攻击力+20%（最大+200%）',
  },
  {
    name: '伊奥莱塔·罗素', hp: 29, category: '精锐', unlock: '初始', portrait: 's04',
    skill: '统御号令',
    effect: '战斗开始时，场上每有1名精锐干员，精锐干员攻击力、生命上限+10%',
  },
  {
    name: '百炼嘉维尔', hp: 27, category: '生存', unlock: '初始', portrait: 's05',
    skill: '意志鼓舞',
    effect: '拖拽（0）：选择一名干员，下次战斗开始时立即击倒并复活，并获得额外2次复活',
  },
  {
    name: '天空盒', hp: 28, category: '装备', unlock: '初始', portrait: 's06',
    skill: '内部货源',
    effect: '点击（0）：下一件购买的装备价格-1',
  },
  {
    name: '风丸', hp: 25, category: '抓牌', unlock: '初始', portrait: 's07',
    skill: '纸片替身',
    effect: '拖拽（0）：使调度中心一名干员变为同阶随机干员（每回合2次）',
  },
  {
    name: '妮芙', hp: 28, category: '生存', unlock: '初始', portrait: 's08',
    skill: '溃心领域',
    effect: '拖拽（0）：指定地块，首个经过的敌人恐惧3秒；第4/8/12回合升级，每回合1→4次',
  },
  {
    name: '夕', hp: 28, category: '抓牌', unlock: '初始', portrait: 's09',
    skill: '幻画为真',
    effect: '拖拽（0）：复制一名我方干员，含精锐状态与装备（每局1次）',
  },
  {
    name: '但书', hp: 26, category: '叠层', unlock: '初始', portrait: 's10',
    skill: '条文修正',
    effect: '第4回合解锁；拖拽（0）：使一名干员已激活的所有盟约层数+9（冷却3回合）',
  },
  {
    name: '大嘴莫布', hp: 26, category: '精锐', unlock: '初始', portrait: 's11',
    skill: '全场聚焦',
    effect: '拖拽（1）：选择一名干员，下次战斗开始时变为精锐，持续至战斗结束',
  },
  {
    name: '杰西卡', hp: 22, category: '抓牌', unlock: '初始', portrait: 's12',
    skill: '集结指示',
    effect: '第4/7/10/13回合进入休整期时获得<寻呼模块>',
  },
  {
    name: '华法琳', hp: 24, category: '叠层', unlock: '初始', portrait: 's13',
    skill: '重点监护',
    effect: '战斗开始时，每个不同等阶各1名随机干员的已激活盟约层数+1；调度中心3级、5级时各再+1',
  },
  {
    name: '桑葚', hp: 24, category: '生存', unlock: '初始', portrait: 's14',
    skill: '药枚实验',
    effect: '拖拽（0）：指定干员下场战斗每次攻击20%概率获得1层护盾；第7回合升至35%',
  },
  {
    name: '奥达', hp: 26, category: '装备', unlock: '初始', portrait: 's15',
    skill: '全力熔铸',
    effect: '第3/6/9/12/14回合进入休整期时获得1件当前等级随机装备',
  },
  {
    name: '陈', hp: 26, category: '精锐', unlock: '通关任意模拟1次', portrait: 's16',
    skill: '以己之长',
    effect: '所有干员物理/法术伤害变为弱点伤害；精锐干员攻击力+16%、攻速+16',
  },
  {
    name: '老鲤', hp: 27, category: '经济', unlock: '通关任意模拟2次', portrait: 's17',
    skill: '得闲饮茶',
    effect: '第1、2回合资金暂存至第3回合发放；第3回合获得2阶、4阶随机干员各1名',
  },
  {
    name: '芬', hp: 24, category: '抓牌', unlock: '通关任意模拟3次', portrait: 's18',
    skill: '协力共进',
    effect: '第8/10/12/14回合获得<信标>',
  },
  {
    name: 'Touch', hp: 28, category: '精锐', unlock: '通关任意模拟3次', portrait: 's19',
    skill: '外勤医疗',
    effect: '所有玩家场上出现<预备干员-医疗>；战斗开始时场上≥2名精锐则替换为<Touch>',
  },
  {
    name: '森蚺', hp: 29, category: '装备', unlock: '通关任意模拟5次', portrait: 's20',
    skill: '暴躁铁皮',
    effect: '第1回合获得可装备4件装备的特殊干员<“暴躁铁皮”>',
  },
  {
    name: '寻宝人', hp: 22, category: '经济', unlock: '通关任意模拟5次', portrait: 's21',
    skill: '宝藏探机',
    effect: '拖拽（1）：部署<模拟宝藏>，战斗结束仍在则+1资金（冷却3回合）',
  },
  {
    name: '缪尔赛思', hp: 28, category: '精锐', unlock: '通关任意模拟8次', portrait: 's22',
    skill: '至纯凝结',
    effect: '拖拽（0）：立即使一名干员晋升精锐（每局1次）',
  },
  {
    name: 'Misery', hp: 27, category: '生存', unlock: '通关任意模拟8次', portrait: 's23',
    skill: '消解空间',
    effect: '拖拽（0）：指定干员下场首次受伤时击倒，并召唤整备区最右侧干员',
  },
  {
    name: '“变形者集群”', hp: 22, category: '装备', unlock: '通关任意模拟10次', portrait: 's24',
    skill: '变形同构',
    effect: '每5回合获得1件<变形同构体>',
  },
  {
    name: '小贾斯汀', hp: 23, category: '经济', unlock: '通关标准模拟', portrait: 's25',
    skill: '私募基金',
    effect: '点击（0）：随机获得1-6资金，冷却回合数=获得资金',
  },
  {
    name: '铃兰', hp: 20, category: '叠层', unlock: '通关绝境模拟', portrait: 's26',
    skill: '御守之力',
    effect: '拖拽（0）：触发一名干员的<获得时>特质',
  },
  {
    name: '苏苏洛', hp: 21, category: '叠层', unlock: '通关绝境模拟', portrait: 's27',
    skill: '强制休整',
    effect: '拖拽（0）：使一名干员的<休整期结束时>特质本回合额外触发一次',
  },
  {
    name: '昆图斯', hp: 24, category: '抓牌', unlock: '通关险境模拟', portrait: 's28',
    skill: '不稳定要素',
    effect: '第4回合解锁；拖拽（0）：使一名干员变为高一阶随机干员',
  },
  {
    name: '信仰搅拌机', hp: 27, category: '经济', unlock: '联合模拟通关5次', portrait: 's29',
    skill: '献身护卫',
    effect: '第4回合解锁；点击（0）：生命降至全场最低者，获得等量资金（至多10），休整期结束时为其回复等量生命',
  },
  {
    name: '“追随者们”', hp: 21, category: '抓牌', unlock: '联合模拟通关10次', portrait: 's30',
    skill: '好多委托！',
    effect: '每次进入休整期，从2个随机指令中选1个替换当前指令',
  },
  {
    name: '坎诺特', hp: 27, category: '经济', unlock: '累计消耗100资金', portrait: 's31',
    skill: '利滚利',
    effect: '剩余资金可继承；剩余≥5时每回合额外+1资金',
  },
  {
    name: '鸭爵', hp: 29, category: '经济', unlock: '累计消耗200资金', portrait: 's32',
    skill: '“神秘顾客”',
    effect: '第5回合起部分敌人替换为鸭爵一伙，击倒+1资金（含联防）',
  },
  {
    name: '琳琅诗怀雅', hp: 24, category: '抓牌', unlock: '累计消耗1000资金', portrait: 's33',
    skill: '最佳品味',
    effect: '消耗60资金后解锁：点击（0）随机获取调度中心1名干员；消耗120资金后变为2名',
  },
  {
    name: '巫恋', hp: 25, category: '抓牌', unlock: '累计出售50名干员', portrait: 's34',
    skill: '替身娃娃',
    effect: '每回合首次出售初始干员时，改为与调度中心随机1名干员交换',
  },
  {
    name: '三船光平', hp: 22, category: '叠层', unlock: '累计出售100名干员', portrait: 's35',
    skill: '东之极道',
    effect: '拖拽（0）：出售一名干员，所有已激活盟约叠加等同于其等阶的层数',
  },
  {
    name: '雅拉', hp: 24, category: '抓牌', unlock: '累计刷新100次', portrait: 's36',
    skill: '人才锁定',
    effect: '点击（1）：刷新，必定包含1名高一阶干员（每回合3次）',
  },
  {
    name: '渡桥', hp: 30, category: '抓牌', unlock: '累计刷新200次', portrait: 's37',
    skill: '专享情报',
    effect: '点击（3）：特殊刷新，优先出现场上已部署的干员（每局1次）',
  },
  {
    name: 'Mechanist', hp: 29, category: '装备', unlock: '累计获得50件装备', portrait: 's38',
    skill: '精巧设计',
    effect: '每回合首次装备进阶时出现3件装备免费选1；点击（0）替换调度中心装备（每回合2次）',
  },
  {
    name: '布丁', hp: 23, category: '装备', unlock: '累计获得100件装备', portrait: 's39',
    skill: '电气化！',
    effect: '拖拽（1）：销毁调度中心一件装备，下场战斗所有有空栏位的干员暂时获得它',
  },
  {
    name: '拜松', hp: 23, category: '抓牌', unlock: '累计升级调度中心30次', portrait: 's40',
    skill: '打包速递',
    effect: '点击（9）：买下调度中心全部干员；每回合结束指令费用-1，使用后重置',
  },
  {
    name: 'Pith', hp: 24, category: '叠层', unlock: '结算阵容含【调和】干员', portrait: 's41',
    skill: '优等生',
    effect: '第1回合获得属于【调和】的特殊干员',
  },
  {
    name: '坚雷', hp: 25, category: '叠层', unlock: '结算阵容含3名【助力】', portrait: 's42',
    skill: '正直教官',
    effect: '拖拽（0）：一名干员下场战斗叠层上限+当前回合数',
  },
  {
    name: '复奏', hp: 24, category: '精锐', unlock: '结算阵容含2名【奇迹】', portrait: 's43',
    skill: '二重奏',
    effect: '每回合首次晋升精锐时，额外获得1次晋升奖励',
  },
  {
    name: '望', hp: 23, category: '炎', unlock: '累计获得50名【炎】', portrait: 's44',
    skill: '黑白相易',
    effect: '拖拽（1）：移除一名干员，换1名不高于其等阶的【炎】干员；6炎/9炎时改为召唤1/2只“炎佑”',
  },
  {
    name: '杜遥夜', hp: 26, category: '炎', unlock: '结算阵容含6名【炎】', portrait: 's45',
    skill: '广交豪杰',
    effect: '点击（1）：刷新，优先出现1名【炎】干员（每回合2次）',
  },
  {
    name: '娜仁图亚', hp: 24, category: '萨尔贡', unlock: '累计获得50名【萨尔贡】', portrait: 's46',
    skill: '沙洲梦魇',
    effect: '获得3名【萨尔贡】后当前升级费用-3（每级1次）；6萨尔贡时改为开技能全体萨尔贡加攻',
  },
  {
    name: '佩佩', hp: 23, category: '萨尔贡', unlock: '结算阵容含6名【萨尔贡】', portrait: 's47',
    skill: '博学多通',
    effect: '调度中心升至2/4/6级后，获得1次优先【萨尔贡】的特殊刷新',
  },
  {
    name: '洛洛', hp: 25, category: '维多利亚', unlock: '累计维多利亚200层', portrait: 's48',
    skill: '自发制造',
    effect: '每购买3名【维多利亚】获得1件随机装备；6维多利亚时改为开技能共享装备给周围八格',
  },
  {
    name: '哈洛德', hp: 23, category: '维多利亚', unlock: '结算阵容含6名【维多利亚】', portrait: 's49',
    skill: '人才盲盒',
    effect: '第4回合起每2回合获得1名【维多利亚】干员',
  },
  {
    name: '歌蕾蒂娅', hp: 23, category: '阿戈尔', unlock: '累计阿戈尔200层', portrait: 's50',
    skill: '猎人战法',
    effect: '调度中心4级解锁；点击（1）：获得1名【阿戈尔】干员；6阿戈尔时改为前3名首次倒下召唤整备区阿戈尔',
  },
  {
    name: '克莱门莎', hp: 26, category: '阿戈尔', unlock: '结算阵容含5名【阿戈尔】', portrait: 's51',
    skill: '崇高牺牲',
    effect: '【阿戈尔】干员被击倒时，阿戈尔叠加等同其等阶的层数',
  },
  {
    name: '焰尾', hp: 25, category: '卡西米尔', unlock: '累计获得50名【卡西米尔】', portrait: 's52',
    skill: '骑士团长',
    effect: '点击（6）：获得1名【卡西米尔】；每回合结束费用-2，使用后重置；6卡西米尔时改为阻挡真伤+晕眩',
  },
  {
    name: '玛恩纳', hp: 28, category: '卡西米尔', unlock: '结算阵容含6名【卡西米尔】', portrait: 's53',
    skill: '业务指标',
    effect: '每购买1名【卡西米尔】，下回合+1资金（每回合至多3）',
  },
  {
    name: '耶拉', hp: 23, category: '谢拉格', unlock: '累计获得50名【谢拉格】', portrait: 's54',
    skill: '不融信念',
    effect: '第4/7/10/13回合获得<谢拉格不融冰>；6谢拉格时改为每25秒全场寒冷',
  },
  {
    name: '休露丝', hp: 23, category: '谢拉格', unlock: '结算阵容含6名【谢拉格】', portrait: 's55',
    skill: '雪域礼赠',
    effect: '每回合首次购买的【谢拉格】干员只需1资金',
  },
  {
    name: '裁度', hp: 26, category: '叙拉古', unlock: '累计获得50名【叙拉古】', portrait: 's56',
    skill: '量体裁衣',
    effect: '每回合首次主动刷新后+1资金；6叙拉古时改为部署后隐匿、真伤+恐惧',
  },
  {
    name: '贾维', hp: 24, category: '叙拉古', unlock: '结算阵容含6名【叙拉古】', portrait: 's57',
    skill: '团伙行动',
    effect: '每回合主动刷新4次后获得1名【叙拉古】干员',
  },
  {
    name: '车尔尼', hp: 24, category: '莱塔尼亚', unlock: '结算阵容含6名【莱塔尼亚】', portrait: 's58',
    skill: '流动乐章',
    effect: '点击（1）：获得1名【莱塔尼亚】，每次使用后费用永久+1',
  },
  {
    name: '怒潮凛冬', hp: 26, category: '乌萨斯', unlock: '结算阵容含6名【乌萨斯】', portrait: 's59',
    skill: '无惧风雪',
    effect: '点击（5）：获得1名【乌萨斯】；每购买乌萨斯费用-1，使用后重置',
  },
  {
    name: '引星棘刺', hp: 23, category: '伊比利亚', unlock: '结算阵容含6名【伊比利亚】', portrait: 's60',
    skill: '出航时刻',
    effect: '伊比利亚激活4人时解锁；拖拽（1）：把调度中心一名干员换成不高于其等阶的【伊比利亚】（每回合2次）',
  },
];
