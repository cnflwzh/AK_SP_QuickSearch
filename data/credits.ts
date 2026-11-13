import type { LicenseEntry, UploaderSource, WikiSource } from './types.ts';

/**
 * 项目说明与数据来源，首次打开时的「关于」弹窗由此生成（src/lib/about.ts）。
 *
 * 新增或更换数据来源时：
 *   1. 在下方对应列表里补一条，写清楚用到了它的哪部分内容
 *   2. 把 ABOUT_VERSION 加 1，已看过弹窗的用户下次打开会再看到一次
 *
 * WIKIS  { name, page, url, used }        used = 从这个来源取用了什么
 * UPLOADERS { name, uid, videos: [{ title, bv, used }] }
 * FURTHER_READING  同 UPLOADERS，列出值得一看但未直接取用内容的攻略
 */

export const ABOUT_VERSION = 6;

/** 开源仓库地址，填写后弹窗里会出现「反馈 / 源码」链接 */
export const REPO_URL = 'https://github.com/cnflwzh/AK_SP_QuickSearch';

export const PURPOSE: readonly string[] = [
  '玩家自制的《明日方舟》卫戍协议·规程攻略工具。',
  '速查页把干员、盟约、装备、策略、领袖、流派整理成对局中横屏小窗也能快速翻的卡片；图解教程从入门讲到流派。',
  '免费、开源，可安装为离线应用。',
];

export const WIKIS: readonly WikiSource[] = [
  {
    name: 'NGA', page: '终极模拟卫戍组排连胜分享 · 2026-11-12',
    url: 'https://ngabbs.com/read.php?tid=47901793',
    used: '莱塔尼亚四本成型、伊比利亚低阶六人，以及涤火杰西卡 / 塞雷娅 / 罗比菈塔 / 白铁的坚守维主轴',
  },
  {
    name: '小红书 · 育儿博士', page: '4图轮椅攻略：从小白成为卫戍高手 · 2026-11-11',
    url: 'https://www.xiaohongshu.com/search_result/6af43dda000000002b02aceb?xsec_token=ABgTpD-cOZqlbfs_cvDxl22eLgAfsP5ho4wZuHPvqdS6o=&xsec_source=',
    used: '卡西米尔的砾、风丸、瑕光起手，后期玛恩纳 / 史尔特尔与不屈、突袭搭配',
  },
  {
    name: '小红书 · 🌵🌵🌵', page: '卫戍协议 伊比利亚阵营玩法详解 · 2026-11-11',
    url: 'https://www.xiaohongshu.com/search_result/6af3f3a8000000002b012298?xsec_token=ABVKHOqlYrjrQOjlH_Nwa2DuQnNU9Q4Ox04VdjJGe5l5Y=&xsec_source=',
    used: '旅骨与海沫 / 温蒂的卖价叠层、低阶六伊阵容、精准与聚合搭配',
  },
  {
    name: '小黑盒', page: '十大流派构筑讨论 · 2026-11-09',
    url: 'https://www.xiaoheihe.cn/app/bbs/link/196514413',
    used: '评论区关于阿戈尔聚合 / 灵巧、卡西米尔不屈、白铁升级装备的实战反馈',
  },
  {
    name: 'PRTS', page: '', url: 'https://prts.wiki/',
    used: '卫戍协议规则、盟约、干员特质、装备与策略；领袖和隐秘核心的机制、生命值及敌人头像',
  },
  {
    name: 'ArknightsGameData', page: '', url: 'https://github.com/Kengxxiao/ArknightsGameData',
    used: '游戏内招募与升级数值、回合配置、认证收益、敌人能力与技能参数，以及战场地形和敌人行进路线',
  },
  {
    name: '可露希尔 Wiki', page: '', url: 'https://closure.wiki/',
    used: '规程等级、盟约池、模拟强度与认证效率，干员头像与装备图标',
  },
  {
    name: 'BWIKI', page: '', url: 'https://wiki.biligame.com/arknights/',
    used: '经济与流程数值核对',
  },
  {
    name: 'Arknights Wiki (wiki.gg)', page: '', url: 'https://arknights.wiki.gg/',
    used: '调度中心等级与干员等阶数值核对',
  },
];

/** 当前版本的流派参考。阵容与运营结合攻略正文、实战讨论及 Wiki 的干员特质整理。 */
export const UPLOADERS: readonly UploaderSource[] = [
  {
    name: '小鬼卡比',
    uid: 259571179,
    videos: [
      {
        title: '【卫戍协议：规程】保姆级【入门】攻略合集',
        bv: 'BV1D2Wp6kEni',
        used: '教程入门章节的顺序；炎·杜遥夜、维多利亚·哈洛德、萨尔贡·佩佩、阿米娅多盟约的开局策略',
      },
    ],
  },
  {
    name: '白樱iridescent',
    uid: 1358014912,
    videos: [
      {
        title: '【卫戍协议∶规程】新版本最爽盟约—乌萨斯公式化运营一图流',
        bv: 'BV1CwWW6aEjh',
        used: '乌萨斯的六本家 + 霍尔海雅 + 青枳终盘，四本晋升奖励选冻河、迅捷叠层与青枳替换',
      },
      {
        title: '【卫戍协议∶规程】新版本轮椅盟约！奥术精准莱塔尼亚公式化运营一图流',
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
];

export const FURTHER_READING: readonly UploaderSource[] = [
  {
    name: '小鬼卡比',
    uid: 259571179,
    videos: [
      { title: '【一图流】卫戍协议：规程【核心盟约】叠层方式一览', bv: 'BV1qUWJ6yEVE', used: '核心盟约叠层一图流' },
    ],
  },
  {
    name: '柏喙攻略组',
    uid: 512280695,
    videos: [
      { title: '【卫戍协议机制详解】刷牌or升本？一期视频带你算清抓到key牌的概率', bv: 'BV1uCdfBWE6y', used: '各等级刷新与抓牌概率' },
    ],
  },
];

export const LICENSES: readonly LicenseEntry[] = [
  ['代码', 'GNU AGPL-3.0'],
  ['整理后的数据（data/）', 'CC BY-NC-SA 3.0，沿用 PRTS 的协议'],
  ['游戏图片、名称与文本', '© 上海鹰角网络科技有限公司'],
  ['视频攻略', '版权归各 UP 主'],
];

export const spaceUrl = (uid: number): string => `https://space.bilibili.com/${uid}`;
export const videoUrl = (bv: string): string => `https://www.bilibili.com/video/${bv}/`;
