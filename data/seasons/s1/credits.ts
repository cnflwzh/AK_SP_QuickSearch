import type {SeasonCredits} from '../../types.ts';

export const S1_CREDITS: SeasonCredits = {
  aboutVersion: 7,
  purpose: [
    '这是《明日方舟》「卫戍协议·规程」的对局旁速查工具与入门教程，免费开源、支持离线使用。',
    '对局每回合抓牌、配装的时间有限，干员特质、盟约叠层、装备配方和 Boss 机制很难一次记全。打对局时，可把本站开在电脑分屏或手机悬浮小窗里边打边查；刚接触这个玩法时，先点顶部「图解教程」就能一步步摸清招募、升本与叠层规则。',
  ],
  usage: [
    {
      title: '搜单卡 · 悬停看效果',
      desc: '顶部搜索框可查干员、装备、策略、盟约、敌人与机制，支持拼音首字母（如输 fy 查反隐，电脑按 / 聚焦）。页面内的名片与虚线词条，悬停或手机长按即可弹出说明。',
    },
    {
      title: '抄流派 · 设为本局',
      desc: '在「流派」页选一套预设阵容（或粘贴森空岛攻略链接、分享码导入）并点「设为本局」；若有盟约开局被禁，再去「速览 → 标记本局禁池」勾上，全站会自动高亮本局抓牌并推荐替补。',
    },
    {
      title: '合装备 · 查敌人对策',
      desc: '拿到散件不知道合什么，点「装备 → 散件合成」查看能做出的组合装备；战前去「敌人」页看 Boss 站位路线图、悬赏收益与普通特训怪打法，点对策标签即可展开可用干员。',
    },
    {
      title: '导入个人练度 Box',
      desc: '点顶部「导入 Box / 我的 Box」传入 MAA、一图流练度表或手动勾选，即可核对局内自持属性加成、管理 6★ 助战借用，并在流派页标出缺卡与替补。',
    },
  ],
  tip: '「小工具」可查盟约层数门槛、各等级调度中心的升级费用和攻略术语。手机可通过浏览器菜单安装到主屏幕，离线查看已缓存的资料。',
  wikis: [
    {
      name: 'PRTS',
      page: '',
      url: 'https://prts.wiki/',
      used: '卫戍协议规则、盟约、干员特质、装备与策略；领袖和隐秘核心的机制、生命值及敌人头像',
    },
    {
      name: 'ArknightsGameData',
      page: '',
      url: 'https://github.com/Kengxxiao/ArknightsGameData',
      used: '游戏内招募与升级数值、回合配置、认证收益、自选名单与原型替补关系、干员默认技能与实战职能核对、敌人能力与技能参数，以及战场地形和敌人行进路线',
    },
    {
      name: 'ArknightsGameResource',
      page: '',
      url: 'https://github.com/yuanyan3060/ArknightsGameResource',
      used: '自选干员与替补原型头像',
    },
    {
      name: '可露希尔 Wiki',
      page: '',
      url: 'https://closure.wiki/',
      used: '规程等级、盟约池、模拟强度与认证效率，干员头像与装备图标',
    },
    {
      name: '森空岛',
      page: '',
      url: 'https://www.skland.com/',
      used: '卫戍协议·规程全 26 个盟约的游戏内图标资源',
    },
    {
      name: 'BWIKI',
      page: '',
      url: 'https://wiki.biligame.com/arknights/',
      used: '经济与流程数值核对',
    },
    {
      name: 'Arknights Wiki (wiki.gg)',
      page: '',
      url: 'https://arknights.wiki.gg/',
      used: '调度中心等级与干员等阶数值核对',
    },
  ],
  uploaders: [
    {
      name: '小写毛',
      uid: 439914967,
      videos: [
        {
          title: '一个视频教会你新版本卫戍协议如何叠谢拉格',
          bv: 'BV1XBWn6gE16',
          used: '谢拉格冻结叠层与凛御银灰站位，评论区关于延后六谢、避免巨人提前清场的反馈',
        },
      ],
    },
    {
      name: '-录音机-',
      uid: 74385129,
      videos: [
        {
          title: '一站式攻略：十大盟约叠层与小盟约搭配 II',
          bv: 'BV1U5WS6JEZJ',
          used: '作者置顶一图流：炎的投资人与仇白 / 黍获得时叠层、萨尔贡的佩佩 / 鸿雪主轴、叙拉古的安洁莉娜与塞雷娅过渡',
        },
      ],
    },
    {
      name: '小鬼卡比',
      uid: 259571179,
      videos: [
        {
          title: '【卫戍协议：规程】保姆级【入门】攻略合集',
          bv: 'BV1D2Wp6kEni',
          used: '教程入门章节的顺序；炎·杜遥夜、维多利亚·哈洛德、萨尔贡·佩佩的开局策略',
        },
      ],
    },
    {
      name: '白樱iridescent',
      uid: 1358014912,
      videos: [
        {
          title: '伊比利亚公式化运营一图流',
          bv: 'BV1WGWr6UEhb',
          used: '作者置顶修订图的三本伊比利亚路线：旅骨、海沫、蓝毒主轴，青枳与夜莺终盘搭配，以及转职补坚守 / 聚合的条件',
        },
        {
          title: '坚守维多利亚公式化运营一图流',
          bv: 'BV1FHWX6GEh2',
          used: '三维三坚守过渡、杰西卡策略找涤火杰西卡，以及酒神 / 机械师的无转职高阶终盘',
        },
        {
          title: '【卫戍协议∶规程】新版本最爽盟约—乌萨斯公式化运营一图流',
          bv: 'BV1CwWW6aEjh',
          used: '乌萨斯的六本家 + 霍尔海雅 + 青枳终盘，四本晋升奖励选冻河、迅捷叠层与青枳替换',
        },
        {
          title:
            '【卫戍协议∶规程】新版本轮椅盟约！奥术精准莱塔尼亚公式化运营一图流',
          bv: 'BV1UhWW6kE6t',
          used: '莱塔尼亚的奥术 / 精准搭配及过渡思路',
        },
        {
          title: '【卫戍协议∶规程】奥精聚莱塔尼亚一图流',
          bv: 'BV1BvWP6MEwG',
          used: '四本找纯烬艾雅法拉与薇薇安娜，精准、奥术、聚合的人口分配',
        },
        {
          title: '【卫戍协议∶规程】复奏一本流轮椅打法一图流',
          bv: 'BV1FoWj6kEBs',
          used: '莱塔尼亚八人终盘、复奏转型节奏，以及华法琳与霍尔海雅的叠层主轴',
        },
      ],
    },
    {
      name: '我是谁压实度',
      uid: 28860267,
      videos: [
        {
          title: '保三争二的强力阵营？新版卫戍阿戈尔教学！',
          bv: 'BV1k8WL63EeU',
          used: '阿戈尔的克莱门莎主输出、吞噬站位与聚合 / 灵巧搭配的实战讨论',
        },
      ],
    },
  ],
  furtherReading: [
    {
      name: '小鬼卡比',
      uid: 259571179,
      videos: [
        {
          title: '【一图流】卫戍协议：规程【核心盟约】叠层方式一览',
          bv: 'BV1qUWJ6yEVE',
          used: '核心盟约叠层一图流',
        },
      ],
    },
    {
      name: '柏喙攻略组',
      uid: 512280695,
      videos: [
        {
          title:
            '【卫戍协议机制详解】刷牌or升本？一期视频带你算清抓到key牌的概率',
          bv: 'BV1uCdfBWE6y',
          used: '各等级刷新与抓牌概率',
        },
      ],
    },
  ],
};
