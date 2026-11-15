import {
  ADDON_COVENANTS,
  ALL_COVENANTS,
  CORE_COVENANTS,
  COVENANTS,
  isCoreCovenant,
  OPERATORS,
  rosterOf,
} from '../../data/index.ts';
import {
  CYCLE_REWARDS,
  HEADCOUNT_BREAKPOINTS,
  LAYER_BREAKPOINTS,
} from '../../data/numberTools.ts';
import type {Operator} from '../../data/types.ts';

export const DEALER_SHOP_SIZE = 5;
export const DAILY_ROUND_COUNT = 5;
export const RAGE_PER_HIT = 25;

export type DealerMode = 'daily' | 'free';
export type HintLevel = 'blind' | 'clue' | 'open';
export type CardStatus =
  | 'unseen'
  | 'punched'
  | 'shielded'
  | 'calibrated'
  | 'kept';
export type MatrixCell = '👊' | '⚡' | '🟩' | '💥';

export interface TraitSegment {
  readonly text: string;
  readonly kind: 'text' | 'trigger' | 'covenant' | 'num';
}

export interface DealerCard {
  readonly operator: Operator;
  readonly isImpostor: boolean;
  readonly triggerHint: string;
  readonly traitSegments: readonly TraitSegment[];
  status: CardStatus;
}

export interface CovenantMemo {
  readonly covenant: string;
  readonly need: number;
  readonly summary: string;
  readonly bonus: string;
}

export interface DealerRound {
  readonly roundNumber: number;
  readonly targetCovenant: string;
  readonly impostorTotal: number;
  readonly goodTotal: number;
  readonly introLine: string;
  readonly cards: DealerCard[];
}

export interface RoundResultSummary {
  readonly roundNumber: number;
  readonly targetCovenant: string;
  readonly matrix: readonly MatrixCell[];
  readonly mistakes: number;
  readonly calibrated: boolean;
}

export interface DealerStats {
  readonly punched: number;
  readonly calibrated: number;
  readonly keptClean: number;
  readonly mistakes: number;
  readonly maxCombo: number;
  readonly roundsCleared: number;
}

export interface DealerRank {
  readonly title: string;
  readonly subtitle: string;
  readonly moodEmoji: string;
  readonly dealerDamage: string;
}

export type DealerGrade = 'SSS' | 'S' | 'A' | 'B';
export type VerdictTone = 'good' | 'ult' | 'warn' | 'muted' | 'empty';

export interface PosterRoundVerdict {
  readonly roundNumber: number;
  readonly scopeLabel: string;
  readonly icon: string;
  readonly filledCells: number;
  readonly title: string;
  readonly detail: string;
  readonly tone: VerdictTone;
}

export interface DealerPosterModel {
  readonly badgeText: string;
  readonly modeLabel: string;
  readonly summaryLine: string;
  readonly spoilerNotice: string;
  readonly grade: DealerGrade;
  readonly rank: DealerRank;
  readonly dealerArmorPct: number;
  readonly dealerQuote: string;
  readonly metrics: readonly {
    readonly label: string;
    readonly value: string;
    readonly unit: string;
    readonly tone: 'accent' | 'good' | 'warn' | 'teal';
  }[];
  readonly verdicts: readonly PosterRoundVerdict[];
  readonly ctaTitle: string;
  readonly shareUrl: string;
  readonly fileName: string;
}

/** At least two operators belong to these covenants (excludes 0-member 绝技). */
export const SELECTABLE_COVENANTS: readonly string[] = ALL_COVENANTS.filter(
  (name) => rosterOf(name).length >= 2,
);

const DAILY_CORE_POOL = CORE_COVENANTS.filter(
  (name) => rosterOf(name).length >= 5,
);
const DAILY_ADDON_POOL = ADDON_COVENANTS.filter(
  (name) => rosterOf(name).length >= 5,
);

const DEAL_LINES = [
  '看你在攒【$C】，我特意塞了几张「二缺一歪牌」帮你降温。',
  '今日已启动「读心发牌 v4.0」，猜猜这手【$C】里藏了几个内鬼？',
  '「再 D 最后十块钱肯定来！」——经典错觉，先把假【$C】退货再说！',
  '自在手：嘿嘿，你要【$C】是吧？我偏给你发满屏幕别的阵营！',
  '刚从可露希尔仓库批发的【$C】滞销品，里头混了卧底请自行质检。',
  '博士别光顾着看格子数啦，这手【$C】明显有两个凑数混进来的！',
  '连刷五次见不到核心的痛苦我都懂——来，拿这手【$C】里的歪牌出出气！',
  '整备区快塞满「二缺一」了？先把这排里假冒【$C】的通通踹下去！',
  '这一手【$C】含量高得可疑，依照泰拉经验，里面少说两张内鬼。',
  '刚出炉的【$C】商店直购页，敢不敢不翻图鉴直接盲点退货？',
] as const;

const COVENANT_DEAL_LINES: Readonly<Record<string, readonly string[]>> = {
  炎: [
    '看你在攒【炎】，我趁余弟颠勺忙不过来偷偷溜进了两张外援。',
    '大姐种田夕画画，你这桌【炎】里混进来的莫不是想蹭饭的？',
    '30 块都没 D 出关键【炎】组件？来，先把混血歪牌踹出去再刷。',
  ],
  萨尔贡: [
    '这手【萨尔贡】比异客给的浓茶还上头——里头混了几位异国游客。',
    '佩佩的大锤已经拎起来了，快找出混进【萨尔贡】淘金队的卧底！',
  ],
  维多利亚: [
    '伦蒂尼姆贵宾席位有限，混进【维多利亚】讨维式重锤的可不收！',
    '白铁正忙着砸精锐装备呢，先帮他把借【维多利亚】名头的歪牌退了！',
  ],
  谢拉格: [
    '喀兰圣山大雪封山，这几个自称【谢拉格】的有没有谢拉格户口？',
    '灵知刚帮你刷的【谢拉格】专场…咳，我好像不小心夹带了私货。',
  ],
  阿戈尔: [
    '三队长和歌蕾蒂娅在核对猎人名单——混进【阿戈尔】可是要当口粮的。',
    '海水涨潮前先把伪装成【阿戈尔】的旱鸭子请出商店吧！',
  ],
  叙拉古: [
    '家族长老点名只收【叙拉古】人，把放菠萝披萨的卧底当场叉出去！',
    '忍冬送的免费刷新到了，可这手【叙拉古】好像夹带了几张外地牌。',
  ],
  卡西米尔: [
    '商业联合会严查赛手资质，假冒【卡西米尔】骑士的立马取消资格！',
    '玛恩纳刚合上报纸准备加班，别让非【卡西米尔】牌占着他工位！',
  ],
  乌萨斯: [
    '学生自治团今天查寝，混进【乌萨斯】的别以为穿得厚实就能过关！',
    '都在等塔姐凑 6 【乌萨斯】呢，怎么商店里溜进来几张暖和面孔？',
  ],
  伊比利亚: [
    '大审判官艾丽妮已就位，冒充【伊比利亚】的等会儿都要吃一发「此等污秽」！',
    '温蒂和棘刺正算卖价叠加呢，快把不姓【伊比利亚】的清理出场！',
  ],
  莱塔尼亚: [
    '双子塔首席正在试音，把【莱塔尼亚】乐团里的南郭先生挑出来！',
    '小羊和黑键都听出走音了——谁在冒充【莱塔尼亚】乐手滥竽充数？',
  ],
  精准: [
    '精准狙击镜已架好！别让近战盲狙选手混进【精准】编制！',
    '灰喉和迷迭香看着呢，非【精准】高台请自觉站去备战席角落。',
  ],
  迅捷: [
    'W 正扛着炸药在门口数数呢——【迅捷】队只收疾走派，别想摸鱼！',
    '技能好了没回技力？多半是你错拿了非【迅捷】的外援。',
  ],
  灵巧: [
    '四格变八格的大佬正在热身，先把占坑的笨重非【灵巧】牌请走！',
    '攻速飙升之前，先把不属于【灵巧】体系的慢动作干员退货吧。',
  ],
  坚守: [
    '塞雷娅和蛇屠箱把盾架稳了，可后排怎么混进了几个脆皮非【坚守】？',
    '分摊伤害可不是给外人兜底用的——查清这手谁不归【坚守】管！',
  ],
  助力: [
    '休整期白涨层数的【助力】可太香了，小心发牌员塞假货以次充好！',
    '罗比菈塔举着妆造箱来了，非【助力】成员一律谢绝蹭层数！',
  ],
  远见: [
    '10 层 2 块钱、80 层还能打折，这么肥的【远见】哪轮得到外人蹭吃？',
    '寒檀一进一出忙着攒【远见】，快把借机混进来的歪牌抓出来！',
  ],
  奇迹: [
    '天天盼着免费刷新和 100 层高阶保底，先把假【奇迹】踢出去别毒奶了！',
    '星极说了两人就能精锐，可混进来的非【奇迹】牌可不帮你凑对！',
  ],
  投资人: [
    '可露希尔在账本前核对回扣呢，敢冒充【投资人】拿双倍获得时？',
    '这可不是一般的商店，非【投资人】请勿在采购部财务室门口逗留！',
  ],
  突袭: [
    '10 秒不打架就闪现骑脸的【突袭】局，哪来的站桩混子敢顶替位置？',
    '史尔特尔和赫德雷都在等开砍，先把非【突袭】的摸鱼牌赶出去！',
  ],
  不屈: [
    '倒了直接原地重部署才配叫【不屈】，谁拿了「真会凉透」的非【不屈】牌？',
    '砾已坐好弹射器待命，混进【不屈】方阵的外援麻溜自己下场！',
  ],
  调和: [
    '魔王亲自坐镇的【调和】稀缺户口，里头混的歪牌也太显眼了吧！',
    '核心盟约+1 的万金油【调和】谁都想来蹭，博士别被伪装骗了！',
  ],
  协防干员: [
    '全队减伤 20% 的【协防干员】大旗在这，快揪出假冒编制的混子！',
    'Mon3tr 的结晶都在震动预警了——这手里混了好几张非【协防干员】！',
  ],
  独行: [
    '场上恰好 1 名才生效的【独行】，千万别被混进来的干扰项带偏节奏！',
    '【独行】讲究一个独来独往，顺手把商店里非【独行】的推销员全部退掉！',
  ],
  聚合: [
    '奶量庇护管够的【聚合】治疗室，几个蹭 Wi-Fi 的非【聚合】牌给我出来！',
    '纯烬小羊和遥都支起治疗圈了，别让不走【聚合】编制的牌混进来！',
  ],
  奥术: [
    '3【奥术】连隐匿都能破，可我塞进来的这几张假【奥术】你看得穿吗？',
    '逻各斯和溯光星源在查法抗账本，非【奥术】的速速离开法阵！',
  ],
};

const HIT_LINES = [
  '哎哟！这都能被你一眼识破 $O？！',
  '别打脸！$O 这张异阵营歪牌我这就扛走！',
  '嘶——原来【$C】究竟有哪几位你真背熟了啊？',
  '痛痛痛！再也不敢把 $O 塞进【$C】商店里了！',
  '抓包成功！$O 刚想混在【$C】里白嫖一个格子，当场遣返！',
  '自在手算法失效：我明明给 $O 穿了伪装，你咋看穿的？',
  '行吧行吧，本来想骗你花 3 块买错牌，$O 我收回还不行么！',
  '警报：$O 的假【$C】工牌当场被博士撕了个粉碎！',
] as const;

const COMBO_LINES = [
  '$N 连扁！一拳把 $O 连同假【$C】滤镜一起打碎！',
  '$N 连扁！发牌员抱着商店刷新按钮缩在角落发抖…',
  '$N 连扁！再塞内鬼，可露希尔都要连夜开除发牌员了！',
  '$N 连扁！这哪是刷牌，分明是人形卫戍协议质检流水线！',
  '$N 连扁！海猫的自在手已经被博士物理掰正了！',
  '$N 连扁！$O 刚露头就被退货，发牌员正在疯狂翻代码查 Bug…',
] as const;

const MISS_LINES = [
  '嘿嘿，$O 可是正宗【$C】，连自己人你也扁？',
  '护盾触发！快拿小本本记下：$O 也有【$C】盟约！',
  '手滑了吧？差点把【$C】关键组件 $O 一脚踹飞！',
  '歪牌没抓着倒先揍了【$C】的 $O，发牌员在后台笑出猪叫！',
  '「二缺一就差 $O」结果你把真 $O 当内鬼退货了？！',
  '警报解除！$O 出示了真·【$C】户口本，下回合别再看走眼啦！',
] as const;

const ULTIMATE_LINES = [
  '物理校准启动！所有假冒【$C】连同发牌员一起飞出调度中心！',
  '专三满怒铁拳落下！发牌员与一屋子假【$C】全数格式化！',
  '「真以为 30 块钱我还 D 不出【$C】？」——物理一键清仓！',
  '调度中心警铃大作！发牌员被塞进弹射器连带着歪牌一起发射！',
] as const;

const CLEAR_LINES = [
  '本轮【$C】验明正身完毕，收好顺便把今天面孔记一笔！',
  '歪牌全部退货，这手【$C】干员的所属盟约都认全了吧？',
  '完美清仓！商店里干干净净只剩【$C】自己人，真舒服啊～',
  '内鬼一个不留！这波要是真打卫戍，6 盟约早胡了！',
  '发牌员捂着脸蹲在刷新机后面：这把【$C】真一滴都不剩了…',
  '商店质检通关！连【$C】单人冷门面孔都没骗过你的火眼金睛！',
] as const;

const REPLAY_SHUFFLE_LINES = [
  '嘿嘿，题目还是今天这 5 道，但我连夜把牌位全洗乱了——休想靠背站位逃课！',
  '重开今日同题！同样 5 组干员，位置全打散了，快用真本事再来扁一次！',
  '牌序大洗牌启动！发牌员偷笑：刚才记「左二右一」的博士这回可要重头看咯～',
  '今日同题二周目开张！题目照旧，站位全随机，专治各种肌肉记忆！',
] as const;

const OPERATOR_HIT_EASTER_EGGS: Readonly<Record<string, string>> = {
  可露希尔: '可露希尔捂着账本溜了：「博士你也太狠了，采购部自己人都退货，下次不给【$C】凑单了！」',
  阿米娅: '阿米娅敬了个礼转身离开：「博士放心，今天真不是来占【$C】格子的——记得少熬夜哦！」',
  Mon3tr: 'Mon3tr 晶刺微亮着退回后排：「警告，本单元无【$C】权限，凯尔希医生说别乱点！」',
  史尔特尔: '史尔特尔挖了一口冰淇淋：「哼，反正【$C】又不管饭，退货正好去找别家冰淇淋。」',
  玛恩纳: '玛恩纳合上报纸默默起身：「既然不是【$C】，那我继续休假了。下班。」',
  耀骑士临光: '耀骑士的炽光收拢散去：「抱歉博士，卡西米尔的辉光今天没签【$C】联名！」',
  砾: '砾笑着被弹回备战席：「每次都是我替歪牌挨拳头呢，博士也真够狠心的～」',
  拉普兰德: '拉普兰德舔了舔嘴角：「哈哈哈！终于不装了？我本来就没打算混进【$C】啊！」',
  荒芜拉普兰德: '荒芜拉普兰德挑眉一笑：「抓错人的狼可不多见，算你认得出谁不属于【$C】。」',
  铃兰: '铃兰抱着尾巴鞠了一躬：「对不起博士，我们的光今天照不亮【$C】这边呀！」',
  塞雷娅: '塞雷娅收起钙质化手甲：「判断很果断。确实不该在【$C】阵里硬塞我。」',
  凛御银灰: '凛御银灰把风衣一甩：「呵，连喀兰的盟约表都背得这么熟，不愧是我的挚友。」',
  圣聆初雪: '圣聆初雪轻摇圣铃：「神明见证，我确实不属于【$C】，这就回圣山喝热茶啦。」',
  初雪: '初雪拎起铃铛叹气：「雪山工作已经够多了，博士就别硬拽我来【$C】加班啦！」',
  幽灵鲨: '幽灵鲨转着电锯歪头笑：「哦呀？【$C】不需要锯子的话，我可去找海嗣啦～」',
  归溟幽灵鲨: '归溟幽灵鲨原地留下替身：「哎呀呀，差点就能在【$C】这里免费唱一出歌剧呢。」',
  浊心斯卡蒂: '浊心斯卡蒂停下了吟唱：「大群的低语停止了——看来【$C】还没被同化呢。」',
  乌尔比安: '乌尔比安单手提锚转身：「少在这儿试探了，阿戈尔的事可轮不到【$C】插手。」',
  歌蕾蒂娅: '歌蕾蒂娅微皱眉头收矛：「效率太慢了博士，【$C】队里本就不该出现我的名字。」',
  老鲤: '老鲤摇着折扇赔笑：「哎呀呀，鲤氏事务所走错片场啦！不归【$C】管，赔礼赔礼！」',
  夕: '夕拎起画笔缩进画卷：「说了别吵我睡觉，【$C】的名册上根本没写我！」',
  黍: '黍温柔一笑抖落稻穗：「田里的事还忙着呢，【$C】这茬庄稼可不归大姐头收哦。」',
  余: '余颠勺的火停了下来：「哎哟客官，我这炎国小炒店今天没接【$C】团餐啊！」',
  塔露拉: '塔露拉指尖跃起火光又熄灭：「别开玩笑了，【$C】的名单里怎么可能有我？」',
  酒神: '酒神推了推帽子消失在幕布后：「演出提前谢幕了啊…我还以为能在【$C】混个龙套。」',
  逻各斯: '逻各斯轻敲骨笔：「‘退货’之咒已应验。确实，我的铭文不隶属【$C】。」',
  棘刺: '棘刺拎着剑柄转身就走：「这种无意义的试探就算了吧，我去别的队当至高之术了。」',
  引星棘刺: '引星棘刺收起炼金瓶：「看来我的配方还混不进【$C】…伊比利亚那边还在等呢。」',
  艾雅法拉: '艾雅法拉抱着小黑羊退后：「啊、不好意思前辈！论文调研走错到【$C】棚里了！」',
  纯烬艾雅法拉: '纯烬艾雅法拉挥手道别：「风和温泉都在另一个方向呢，【$C】加油哦前辈！」',
  佩佩: '佩佩扛起黄金大锤：「哇啊！差点就能跟【$C】一块儿下去考古寻宝了说！」',
  魔王: '魔王温和颔首：「看来您依然清晰记得每一位伙伴所属的盟约，不曾迷失，博士。」',
  '维娜·维多利亚': '维娜甩了甩重锤：「想拿我当【$C】凑数？眼光倒还行，只可惜真不是那伙的。」',
  白铁: '白铁挠挠头扛起工具箱：「行行行，【$C】的装备没我什么事，我去敲别家重锤了！」',
  水月: '水月开心地飘回备战席：「哎嘿嘿，被一眼看穿啦，今天的水母可不在【$C】打工～」',
  迷迭香: '迷迭香的浮游盾轻轻收回：「没关系博士，我记不太清【$C】，但听你的准没错。」',
  W: 'W 晃着引信咧嘴笑：「哈！本来想炸乱你的【$C】队型，结果第一步就被退货了？」',
  缪尔赛思: '缪尔赛思化作一滩清水溜走：「讨厌啦博士～水做的流形可不能在【$C】里滥竽充数呀。」',
};

const OPERATOR_MISS_EASTER_EGGS: Readonly<Record<string, string>> = {
  可露希尔: '可露希尔举起采购账本格挡：「连老板我都敢误伤？记住，我可是正牌【$C】！」',
  阿米娅: '阿米娅挡在奇美拉护盾后：「博士冷静！我真有【$C】编制，差点把最高指挥官退货了！」',
  Mon3tr: 'Mon3tr 晶壁全开反弹一拳：「物理验证通过：本单元确实隶属【$C】，下次别手滑。」',
  史尔特尔: '史尔特尔亮起黄昏大剑：「你想把【$C】自家主C踹出去？再点我真融你防御了。」',
  玛恩纳: '玛恩纳用报纸挡住脸：「……【$C】正经干员你也退？这班是非加不可了么。」',
  耀骑士临光: '璀璨金盾弹开退货单：「辉光照耀之下，我本就是【$C】柱石，再看看名册！」',
  砾: '砾的防爆盾砰地立起：「虽说平时爱吃伤害，但人家可是正经【$C】自己人啊博士！」',
  拉普兰德: '拉普兰德笑着劈开退货函：「喂喂，把我当内鬼打？【$C】离了疯狗可转不起来哦！」',
  荒芜拉普兰德: '荒芜拉普兰德护盾反震：「哈哈哈！瞎退什么货，【$C】正统大核就在你眼前！」',
  铃兰: '铃兰被护盾抱住：「呜哇！我是【$C】正牌成员，别退掉我们的光呀博士！」',
  塞雷娅: '塞雷娅单手接下这拳：「钙质化护盾已张开——我就是【$C】，别把主坦砸飞了。」',
  凛御银灰: '凛御银灰风雪护盾一震：「挚友，莫非你连【$C】核心股东的脸都忘了？」',
  圣聆初雪: '圣聆初雪铃声一响冻结退货单：「误判了呢博士，雪山圣女确有【$C】之契。」',
  初雪: '初雪护盾闪出一阵霜花：「好险…差点被自己人踢出【$C】，要好好记住我呀！」',
  幽灵鲨: '幽灵鲨扛着护盾笑出声：「修女可是【$C】正牌成员哦，想退货还早得很呢～」',
  归溟幽灵鲨: '归溟幽灵鲨切换替身：「居然向正统【$C】挥拳？这场戏剧可真是戏剧性呀～」',
  浊心斯卡蒂: '浊心斯卡蒂的海嗣屏障撑开：「别害怕，此刻我仍站在【$C】的队列之中。」',
  乌尔比安: '乌尔比安重锚顿地：「连【$C】自家主力都不认识，怎么统领这支队伍？」',
  歌蕾蒂娅: '歌蕾蒂娅长矛横挡：「看清盟约表，博士——【$C】怎么能少了大猎手队长？」',
  老鲤: '老鲤扇面一展挡住拳头：「哎哟大水冲了龙王庙！鲤某明明也在【$C】挂了号啊！」',
  夕: '夕一挥笔画出护壁：「画里都写着呢——我是【$C】，少来瞎点我门牌！」',
  黍: '黍甩出稻浪格挡：「慢着点打嘛，【$C】大姐头站在这儿都能给你认成歪牌？」',
  余: '余抄起铁锅当盾牌：「客官手下留情！正宗【$C】大厨差点被你炒了鱿鱼！」',
  塔露拉: '塔露拉剑光一闪挡开退货单：「眼神放亮点，今天我就在【$C】阵营里头！」',
  酒神: '酒神面具下响起掌声：「精彩的误判——可惜我货真价实属于【$C】，不能下场呢。」',
  逻各斯: '逻各斯提笔重写‘无效’咒文：「手滑了，博士？这支骨笔正是【$C】的署名。」',
  棘刺: '棘刺护盾弹起炼金毒雾：「至高之术差点被误当歪牌清了——记好了，我是【$C】。」',
  引星棘刺: '引星棘刺瓶中光华一闪：「醒醒，六阶核心【$C】都要手抖退货，想直接投降么？」',
  艾雅法拉: '艾雅法拉头顶冒出小火山：「呜哇前辈别点我！小羊明明是正宗【$C】呀！」',
  纯烬艾雅法拉: '纯烬艾雅法拉撑起水雾盾：「前辈再仔细看一眼嘛，人家确实带着【$C】徽章呢！」',
  佩佩: '佩佩横起大锤嘎吱挡住：「喂！连【$C】都认错？这锤子差点就回敲到你桌上啦！」',
  魔王: '魔王以温和的源石技艺化解这一击：「无妨，也借此记住我正是【$C】的一员吧。」',
  '维娜·维多利亚': '维娜护盾嗡鸣：「差点把自家核心踢掉——我可一直站在【$C】这边。」',
  白铁: '白铁的便携装置弹飞这一拳：「停停停！正宗【$C】工程师差点被你当废铁拆了！」',
  水月: '水月果冻状弹回：「哇哦～好险好险，【$C】里少了我这只水母可少好多层呢！」',
  迷迭香: '迷迭香的盾牌叮咚拦下：「记住啦记住啦——我是【$C】，博士也快写进小本本！」',
  W: 'W 把定时炸弹往你桌上一放：「喂喂，好不容易我也在【$C】排班了，敢退货？」',
  缪尔赛思: '缪尔赛思水球护盾咕嘟一弹：「差点把自己人挤破啦！流形再像水也是正牌【$C】嘛。」',
};

let orderNonce = 0;

/** Generates a fresh per-attempt seed so card positions shuffle even on the same daily date. */
export function createOrderSeed(): string {
  orderNonce = (orderNonce + 1) | 0;
  return `${Date.now().toString(36)}-${orderNonce}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Formats a local calendar date key as YYYY-MM-DD. */
export function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function dailyTagFromKey(dateKey: string): string {
  return dateKey.slice(5).replace('-', '') || dateKey;
}

function hashSeed(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Deterministic PRNG (FNV-1a + Mulberry32) so daily runs match everywhere. */
export function createSeededRandom(seedKey: string): () => number {
  let state = hashSeed(seedKey) || 0x6d2b79f5;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWith<T>(list: readonly T[], rng: () => number): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function fillLineTemplate(
  raw: string,
  covenant: string,
  combo = 0,
  operatorName = '这张牌',
): string {
  return raw
    .replace(/\$C/g, covenant)
    .replace(/\$N/g, String(combo))
    .replace(/\$O/g, operatorName);
}

function pickLine(
  lines: readonly string[],
  seed: number,
  covenant: string,
  combo = 0,
  operatorName = '这张牌',
): string {
  const raw = lines[Math.abs(seed) % lines.length];
  return fillLineTemplate(raw, covenant, combo, operatorName);
}

function pickDealLine(covenant: string, seed: number): string {
  const themed = COVENANT_DEAL_LINES[covenant] ?? [];
  const pool: readonly string[] =
    themed.length > 0 ? [...themed, ...DEAL_LINES] : DEAL_LINES;
  return pickLine(pool, seed, covenant);
}

export function replayShuffleLine(seed: number): string {
  return REPLAY_SHUFFLE_LINES[Math.abs(seed) % REPLAY_SHUFFLE_LINES.length];
}

export function extractTriggerHint(trait: string): string {
  const match = trait.match(/<([^>]+)>/);
  return match?.[1] ?? '常驻生效';
}

export function shortenTraitText(trait: string): string {
  return trait
    .replace(/使已激活的|已激活的/g, '')
    .replace(/（此干员在整备区也生效）/g, '（整备区生效）')
    .replace(/每回合至多叠加/g, '每回合至多')
    .replace(/每场战斗至多叠加/g, '每场至多');
}

/** Splits an operator trait into styled segments without HTML interpolation. */
export function splitTraitSegments(trait: string): TraitSegment[] {
  const shortened = shortenTraitText(trait);
  const parts = shortened.split(/(<[^>]+>|【[^】]+】|\d+(?:\.\d+)?%?)/);
  const segments: TraitSegment[] = [];
  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith('<') && part.endsWith('>')) {
      segments.push({text: part.slice(1, -1), kind: 'trigger'});
    } else if (part.startsWith('【') && part.endsWith('】')) {
      segments.push({text: part.slice(1, -1), kind: 'covenant'});
    } else if (/^\d+(?:\.\d+)?%?$/.test(part)) {
      segments.push({text: part, kind: 'num'});
    } else {
      segments.push({text: part, kind: 'text'});
    }
  }
  return segments;
}

/** Returns concise rule-memory hints built strictly from static rules data. */
export function covenantMemo(covenant: string): CovenantMemo {
  const data = COVENANTS[covenant];
  if (!data) {
    return {covenant, need: 0, summary: '', bonus: ''};
  }
  const reserveNote = data.effect.includes('整备区也计入')
    ? '（整备区也计入）'
    : '';
  const summary = `${data.need}人激活${reserveNote} · ${data.effect}`;

  const bonusParts: string[] = [];
  const cycle = CYCLE_REWARDS[covenant];
  const layers = LAYER_BREAKPOINTS[covenant];
  const head = HEADCOUNT_BREAKPOINTS.find((item) => item.covenant === covenant);
  if (cycle) bonusParts.push(`每${cycle.every}层得${cycle.reward}`);
  if (layers?.length) {
    bonusParts.push(layers.map((p) => `${p.layers}层${p.effect}`).join('；'));
  }
  if (head) bonusParts.push(`${head.condition}：${head.effect}`);
  else if (!layers?.length && data.bonus) bonusParts.push(data.bonus);

  return {
    covenant,
    need: data.need,
    summary,
    bonus: bonusParts.join(' · '),
  };
}

function createDealerCard(operator: Operator, targetCovenant: string): DealerCard {
  return {
    operator,
    isImpostor: !operator.covenants.includes(targetCovenant),
    triggerHint: extractTriggerHint(operator.trait),
    traitSegments: splitTraitSegments(operator.trait),
    status: 'unseen',
  };
}

function sampleDistinct(
  primary: readonly Operator[],
  fallback: readonly Operator[],
  count: number,
  rng: () => number,
): Operator[] {
  const picked = shuffleWith(primary, rng).slice(0, count);
  if (picked.length >= count) return picked;
  const chosen = new Set(picked.map((op) => op.name));
  const extra = shuffleWith(
    fallback.filter((op) => !chosen.has(op.name)),
    rng,
  ).slice(0, count - picked.length);
  return [...picked, ...extra];
}

export function buildDealerRound(options: {
  roundNumber: number;
  targetCovenant: string;
  rng: () => number;
  orderRng?: () => number;
  introSeed?: number;
  usedNames?: Set<string>;
  preferredImpostors?: number;
}): DealerRound {
  const {roundNumber, targetCovenant, rng, usedNames} = options;
  const shuffleRng = options.orderRng ?? rng;
  const goodPool = rosterOf(targetCovenant);
  const badPool = OPERATORS.filter(
    (op) => !op.covenants.includes(targetCovenant),
  );

  const minGood = Math.min(2, goodPool.length);
  const minImpostor = Math.max(2, DEALER_SHOP_SIZE - goodPool.length);
  const maxImpostor = Math.min(
    DEALER_SHOP_SIZE - minGood,
    Math.max(minImpostor, 3),
  );
  const desiredImpostors =
    options.preferredImpostors !== undefined
      ? Math.max(minImpostor, Math.min(maxImpostor, options.preferredImpostors))
      : minImpostor + Math.floor(rng() * (maxImpostor - minImpostor + 1));
  const goodCount = Math.min(
    goodPool.length,
    DEALER_SHOP_SIZE - desiredImpostors,
  );
  const impostorCount = DEALER_SHOP_SIZE - goodCount;

  const freshGood = usedNames
    ? goodPool.filter((op) => !usedNames.has(op.name))
    : goodPool;
  const freshBad = usedNames
    ? badPool.filter((op) => !usedNames.has(op.name))
    : badPool;

  const goodPicked = sampleDistinct(freshGood, goodPool, goodCount, rng);
  const badPicked = sampleDistinct(freshBad, badPool, impostorCount, rng);
  for (const op of [...goodPicked, ...badPicked]) usedNames?.add(op.name);

  const canonical = [...goodPicked, ...badPicked];
  const orderedOps = shuffleWith(canonical, shuffleRng);
  if (
    orderedOps.length >= 2 &&
    orderedOps[0].name === canonical[0].name &&
    orderedOps[orderedOps.length - 1].name ===
      canonical[canonical.length - 1].name
  ) {
    const swapIdx = 1 + Math.floor(shuffleRng() * (orderedOps.length - 1));
    [orderedOps[0], orderedOps[swapIdx]] = [orderedOps[swapIdx], orderedOps[0]];
  }
  const cards = orderedOps.map((op) => createDealerCard(op, targetCovenant));
  const dealSeed =
    options.introSeed ?? roundNumber + Math.floor(shuffleRng() * 97);

  return {
    roundNumber,
    targetCovenant,
    impostorTotal: badPicked.length,
    goodTotal: goodPicked.length,
    introLine: pickDealLine(targetCovenant, dealSeed),
    cards,
  };
}

/** Generates deterministic daily questions while shuffling each round's card slots per attempt. */
export function buildDailyRounds(
  dateKey: string,
  orderSeed?: string,
): DealerRound[] {
  const questionRng = createSeededRandom(`wsq.dealer.daily:${dateKey}`);
  const effectiveOrderSeed = orderSeed ?? createOrderSeed();
  const orderRng = createSeededRandom(
    `wsq.dealer.daily.order:${dateKey}:${effectiveOrderSeed}`,
  );
  const cores = shuffleWith(DAILY_CORE_POOL, questionRng).slice(0, 3);
  const addons = shuffleWith(DAILY_ADDON_POOL, questionRng).slice(0, 2);
  const targets = shuffleWith([...cores, ...addons], questionRng);
  const impostorCounts = shuffleWith([2, 3, 2, 3, 2], questionRng);
  const usedNames = new Set<string>();

  return targets.map((targetCovenant, index) =>
    buildDealerRound({
      roundNumber: index + 1,
      targetCovenant,
      rng: questionRng,
      orderRng,
      introSeed: Math.floor(orderRng() * 1000) + index,
      usedNames,
      preferredImpostors: impostorCounts[index],
    }),
  );
}

export function reactionLine(
  event: 'hit' | 'miss' | 'ultimate' | 'clear',
  covenant: string,
  combo: number,
  seed: number,
  operator?: Operator,
): string {
  const opName = operator?.name ?? '这张牌';
  if (event === 'ultimate') {
    return pickLine(ULTIMATE_LINES, seed, covenant, combo, opName);
  }
  if (event === 'clear') {
    return pickLine(CLEAR_LINES, seed, covenant, combo, opName);
  }
  if (event === 'miss') {
    const egg = operator ? OPERATOR_MISS_EASTER_EGGS[operator.name] : undefined;
    if (egg) return fillLineTemplate(egg, covenant, combo, opName);
    return pickLine(MISS_LINES, seed, covenant, combo, opName);
  }
  if (combo >= 3) {
    return pickLine(COMBO_LINES, seed, covenant, combo, opName);
  }
  const hitEgg = operator ? OPERATOR_HIT_EASTER_EGGS[operator.name] : undefined;
  if (hitEgg) return fillLineTemplate(hitEgg, covenant, combo, opName);
  return pickLine(HIT_LINES, seed, covenant, combo, opName);
}

export function cardMatrixCell(card: DealerCard): MatrixCell {
  if (card.status === 'punched') return '👊';
  if (card.status === 'calibrated') return '⚡';
  if (card.status === 'shielded') return '💥';
  return '🟩';
}

export function summarizeRound(round: DealerRound): RoundResultSummary {
  let mistakes = 0;
  let calibrated = false;
  const matrix = round.cards.map((card) => {
    if (card.status === 'shielded') mistakes++;
    if (card.status === 'calibrated') calibrated = true;
    return cardMatrixCell(card);
  });
  return {
    roundNumber: round.roundNumber,
    targetCovenant: round.targetCovenant,
    matrix,
    mistakes,
    calibrated,
  };
}

function statsFlavorSeed(stats: DealerStats): number {
  return Math.abs(
    stats.punched * 31 +
      stats.calibrated * 19 +
      stats.mistakes * 17 +
      stats.maxCombo * 13 +
      stats.roundsCleared * 7,
  );
}

function pickBySeed(items: readonly string[], seed: number): string {
  return items[Math.abs(seed) % items.length];
}

const RANK_SUBTITLES = {
  idle: [
    '挑张看得不顺眼的歪牌点下去，发牌员立刻原形毕露。',
    '自在手已在后台热身，点一张异阵营牌先给它一拳下马威！',
  ],
  sss: [
    '零误伤全数退货！发牌员已提交调休申请。',
    '海猫自在手被物理超度！今日泰拉商店由博士接管。',
    '闭眼分清所有兼职盟约！可露希尔连夜请你去采购部坐镇。',
  ],
  s: [
    '谁归哪个盟约门儿清，发牌员根本塞不进歪牌。',
    '偶尔差一丢丢手滑，但发牌员的小九九早被你看穿了。',
    '连多盟约冷门面孔都记在脑子里，自在手直呼碰上硬茬！',
  ],
  a: [
    '虽然偶尔误伤自己人，但气势已经压住发牌员了。',
    '稍微给自家干员交了一点学费，下局直接全额追回来！',
    '读心发牌已出现明显卡顿，再认清几个兼职名额就稳了。',
  ],
  b: [
    '顺手多翻几次盟约与特质卡，下局直接一眼识破卧底！',
    '差点被发牌员连唬带骗拐偏了，多看看卡面特质再去复仇！',
    '没事，卫戍日常先交两回合学费，认熟面孔再回来反杀！',
  ],
} as const;

export function evaluateDealerRank(stats: DealerStats): DealerRank {
  const defeated = stats.punched + stats.calibrated;
  const attempts = defeated + stats.mistakes;
  const accuracy = attempts > 0 ? defeated / attempts : 0;
  const seed = statsFlavorSeed(stats);

  if (stats.roundsCleared === 0 && defeated === 0) {
    return {
      title: '蓄势待发的检修师',
      subtitle: pickBySeed(RANK_SUBTITLES.idle, seed),
      moodEmoji: '😏',
      dealerDamage: '满血挑衅中',
    };
  }
  if (stats.mistakes === 0 && stats.roundsCleared >= 3) {
    return {
      title: '发牌员连夜重写算法',
      subtitle: pickBySeed(RANK_SUBTITLES.sss, seed),
      moodEmoji: '🏳️',
      dealerDamage: '护甲清零 · 跪地求饶',
    };
  }
  if (accuracy >= 0.85) {
    return {
      title: '人形干员活体图鉴',
      subtitle: pickBySeed(RANK_SUBTITLES.s, seed),
      moodEmoji: '🤕',
      dealerDamage: '鼻青脸肿 · 怀疑人生',
    };
  }
  if (accuracy >= 0.65) {
    return {
      title: '坏牌质检专员',
      subtitle: pickBySeed(RANK_SUBTITLES.a, seed),
      moodEmoji: '😵‍💫',
      dealerDamage: '眼冒金星 · 老实了不少',
    };
  }
  return {
    title: '痛扁发牌见习生',
    subtitle: pickBySeed(RANK_SUBTITLES.b, seed),
    moodEmoji: '😰',
    dealerDamage: '额头冒汗 · 正在反省',
  };
}

const CIRCLED_NUMBERS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'] as const;

const DEALER_QUOTES_BY_GRADE: Readonly<Record<DealerGrade, readonly string[]>> =
  {
    SSS: [
      '“别打了！歪牌代码我连夜删，下把全发同盟约！”',
      '“求别打了！您就是泰拉活体盟约库，我跪！”',
      '“已向可露希尔递辞呈，今后发牌全凭良心！”',
    ],
    S: [
      '“嘶——博士把盟约表背下来了吧？塞张歪牌都秒退！”',
      '“读心算法当场失灵！这手怎么连冷门兼职都认得？”',
      '“再扁护甲真要碎了，下回绝对不敢随便歪牌！”',
    ],
    A: [
      '“挨了好几拳重的…下次不敢明目张胆塞异阵营了。”',
      '“嘶…虽骗过您一两回，但我腮帮子已肿起来了。”',
      '“好痛！您再翻两遍图鉴，下回我真藏不住卧底啦！”',
    ],
    B: [
      '“嘿嘿，趁博士还在翻盟约表，再偷偷塞两张外援…”',
      '“自在手发力中！先把这局全歪成异阵营再说，嘿嘿”',
      '“嘿嘿，刚刚把真核心混在歪牌里您居然没发现嘛！”',
    ],
  };

const VERDICT_DETAILS = {
  ult: ['满怒掀桌清场', '专三铁拳格式化', '满怒秒清歪牌'],
  good: [
    '零误伤全退货',
    '卧底当场抓获',
    '读心障眼法失效',
    '户口本级验牌',
    '发牌员痛失护甲',
  ],
  warn: ['护盾弹手提醒', '差点遣返自己人', '敌我不分王八拳'],
} as const;

function evaluateDealerGrade(
  stats: DealerStats,
  defeated: number,
  accuracy: number,
): DealerGrade {
  if (stats.roundsCleared >= 3 && stats.mistakes === 0) return 'SSS';
  if (accuracy >= 85 && (stats.roundsCleared >= 1 || defeated >= 2)) return 'S';
  if (accuracy >= 65 && defeated >= 1) return 'A';
  return 'B';
}

function summarizePerformance(stats: DealerStats) {
  const defeated = stats.punched + stats.calibrated;
  const attempts = defeated + stats.mistakes;
  const accuracy = attempts > 0 ? Math.round((defeated / attempts) * 100) : 100;
  const grade = evaluateDealerGrade(stats, defeated, accuracy);
  return {defeated, accuracy, grade};
}

function scopeLabelFor(mode: DealerMode, covenant: string): string {
  if (mode !== 'daily') return covenant;
  return isCoreCovenant(covenant) ? '核心盟约' : '附加盟约';
}

function verdictForRound(
  mode: DealerMode,
  item: RoundResultSummary,
): PosterRoundVerdict {
  const scopeLabel = scopeLabelFor(mode, item.targetCovenant);
  const idx = Math.max(0, item.roundNumber - 1);
  if (item.calibrated) {
    return {
      roundNumber: item.roundNumber,
      scopeLabel,
      icon: '⚡',
      filledCells: 5,
      title: '物理校准',
      detail: VERDICT_DETAILS.ult[idx % VERDICT_DETAILS.ult.length],
      tone: 'ult',
    };
  }
  if (item.mistakes === 0) {
    return {
      roundNumber: item.roundNumber,
      scopeLabel,
      icon: '🎯',
      filledCells: 5,
      title: '一眼识破',
      detail: VERDICT_DETAILS.good[idx % VERDICT_DETAILS.good.length],
      tone: 'good',
    };
  }
  return {
    roundNumber: item.roundNumber,
    scopeLabel,
    icon: '💥',
    filledCells: Math.max(1, 5 - item.mistakes),
    title: `误伤 ×${item.mistakes}`,
    detail: VERDICT_DETAILS.warn[idx % VERDICT_DETAILS.warn.length],
    tone: 'warn',
  };
}

/** Formats a spoiler-free shareable community message & site referral URL. */
export function formatDealerShareText(options: {
  mode: DealerMode;
  dateKey: string;
  history: readonly RoundResultSummary[];
  stats: DealerStats;
  shareUrl: string;
}): string {
  const {mode, dateKey, history, stats, shareUrl} = options;
  const rank = evaluateDealerRank(stats);
  const {defeated, grade} = summarizePerformance(stats);
  const tag =
    mode === 'daily'
      ? `#${dailyTagFromKey(dateKey)}`
      : `自由拷打 ${stats.roundsCleared} 轮`;

  const lines: string[] = [
    `【卫戍速查 · 痛扁发牌 ${tag}】`,
    `评级：${grade} · ${rank.title}`,
    `战绩：退货 ${defeated} 歪牌 · 误伤 ${stats.mistakes} 次 · 最高 ${stats.maxCombo} 连扁`,
    '',
  ];

  const displayRounds = history.slice(-5);
  if (displayRounds.length) {
    const badges = displayRounds.map((item, i) => {
      const prefix =
        CIRCLED_NUMBERS[i] ?? `${String(item.roundNumber).padStart(2, '0')}`;
      const outcome = item.calibrated
        ? '⚡物理校准'
        : item.mistakes === 0
          ? '🎯零误伤'
          : `💥误伤${item.mistakes}`;
      return `${prefix}${outcome}`;
    });
    lines.push(`拷打战况：${badges.join(' · ')}（🔒考题已防剧透隐藏）`);
  } else {
    lines.push('拷打战况：刚开局找发牌员算账中（🔒考题已防剧透隐藏）');
  }

  lines.push('');
  lines.push(
    mode === 'daily'
      ? `今日同题发牌，点这里也来揍一顿：${shareUrl}`
      : `卫戍协议速查 & 痛扁发牌员：${shareUrl}`,
  );
  return lines.join('\n');
}

/** Builds spoiler-free structured report data for Canvas poster rendering and tests. */
export function buildDealerPosterModel(options: {
  mode: DealerMode;
  dateKey: string;
  history: readonly RoundResultSummary[];
  currentRound?: DealerRound;
  stats: DealerStats;
  shareUrl: string;
}): DealerPosterModel {
  const {mode, dateKey, history, currentRound, stats, shareUrl} = options;
  const rank = evaluateDealerRank(stats);
  const {defeated, accuracy, grade} = summarizePerformance(stats);
  const tag = dailyTagFromKey(dateKey);

  const verdicts: PosterRoundVerdict[] = history
    .slice(-5)
    .map((item) => verdictForRound(mode, item));

  if (
    verdicts.length < 5 &&
    currentRound &&
    currentRound.cards.some((card) => card.status !== 'unseen') &&
    !verdicts.some((v) => v.roundNumber === currentRound.roundNumber)
  ) {
    verdicts.push({
      roundNumber: currentRound.roundNumber,
      scopeLabel: scopeLabelFor(mode, currentRound.targetCovenant),
      icon: '🕵️',
      filledCells: 2,
      title: '正在验牌',
      detail: '本轮校验中',
      tone: 'muted',
    });
  }

  while (verdicts.length < 5) {
    verdicts.push({
      roundNumber: verdicts.length + 1,
      scopeLabel: '待揭晓',
      icon: '🔒',
      filledCells: 0,
      title: '待挑战',
      detail: '牌面防剧透',
      tone: 'empty',
    });
  }

  const dealerArmorPct =
    defeated === 0 ? 100 : grade === 'SSS' ? 0 : Math.max(5, 100 - defeated * 8);

  return {
    badgeText: '卫戍速查 · 痛扁发牌',
    modeLabel:
      mode === 'daily'
        ? `今日同题 #${tag}`
        : `自由拷打 ${stats.roundsCleared} 轮`,
    summaryLine: `退货 ${defeated} 张 · 误伤 ${stats.mistakes} 次 · 最高 ${stats.maxCombo} 连 · 准确率 ${accuracy}%`,
    spoilerNotice: '🔒 牌序与考题已防剧透隐藏',
    grade,
    rank,
    dealerArmorPct,
    dealerQuote: pickBySeed(
      DEALER_QUOTES_BY_GRADE[grade],
      statsFlavorSeed(stats) + history.length,
    ),
    metrics: [
      {label: '退货歪牌', value: String(defeated), unit: '张', tone: 'accent'},
      {
        label: '误伤好牌',
        value: String(stats.mistakes),
        unit: '次',
        tone: stats.mistakes === 0 ? 'good' : 'warn',
      },
      {
        label: '最高连扁',
        value: String(stats.maxCombo),
        unit: '连',
        tone: 'teal',
      },
      {
        label: '验牌准确率',
        value: `${accuracy}%`,
        unit: `共${stats.roundsCleared}轮`,
        tone: accuracy >= 85 ? 'good' : 'teal',
      },
    ],
    verdicts,
    ctaTitle:
      mode === 'daily'
        ? '今日同题发牌 · 搜【卫戍速查】或访问下方地址一起痛扁发牌员'
        : '卫戍协议速查 · 搜【卫戍速查】或访问下方地址一起痛扁发牌员',
    shareUrl,
    fileName: `卫戍速查-痛扁发牌-${mode === 'daily' ? tag : '自由拷打'}.png`,
  };
}
