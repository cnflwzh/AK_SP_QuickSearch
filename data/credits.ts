import type { LicenseEntry, UploaderSource, WikiSource } from './types.ts';

/**
 * 项目说明与数据来源，首次打开时的「关于」弹窗由此生成（js/lib/about.js）。
 *
 * 新增或更换数据来源时：
 *   1. 在下方对应列表里补一条，写清楚用到了它的哪部分内容
 *   2. 把 ABOUT_VERSION 加 1，已看过弹窗的用户下次打开会再看到一次
 *
 * WIKIS  { name, page, url, used }        used = 从这个页面取用了什么
 * UPLOADERS { name, uid, videos: [{ title, bv, used }] }
 * FURTHER_READING  同 UPLOADERS，列出值得一看但未直接取用内容的攻略
 */

export const ABOUT_VERSION = 4;

/** 开源仓库地址，填写后弹窗里会出现「反馈 / 源码」链接 */
export const REPO_URL = 'https://github.com/cnflwzh/AK_SP_QuickSearch';

export const PURPOSE: readonly string[] = [
  '玩家自制的《明日方舟》卫戍协议·规程攻略工具。',
  '速查页把干员、盟约、装备、策略、领袖、流派整理成对局中横屏小窗也能快速翻的卡片；图解教程从入门讲到流派。',
  '免费、开源，可安装为离线应用。',
];

export const WIKIS: readonly WikiSource[] = [
  {
    name: 'PRTS', page: '假想敌：胄', url: 'https://prts.wiki/w/假想敌：胄',
    used: '低生命值阶段的能力修正、刺胄之弹与核心部件的目标和范围',
  },
  {
    name: 'PRTS', page: '假想敌：管', url: 'https://prts.wiki/w/假想敌：管',
    used: '余音形态、裂管之奏的三连击与 1.8 格溅射半径',
  },
  {
    name: 'PRTS', page: '假想敌：弦', url: 'https://prts.wiki/w/假想敌：弦',
    used: '弦的无敌与退场条件、断弦之奏的 3 格溅射半径',
  },
  {
    name: 'ArknightsGameData', page: '规程 V3_1 · 2026-11-11',
    url: 'https://github.com/Kengxxiao/ArknightsGameData/blob/master/zh_CN/gamedata/excel/activity_table.json',
    used: '招募价格、练度、各模式升级费用与栏位、回合配置、基础认证；关卡文件核对作战时限；领袖名单与隐秘核心形态',
  },
  {
    name: 'ArknightsGameData', page: 'enemy_handbook_table · 2026-11-11',
    url: 'https://github.com/Kengxxiao/ArknightsGameData/blob/master/zh_CN/gamedata/excel/enemy_handbook_table.json',
    used: '领袖、隐秘核心与随行敌人的能力描述（精简措辞）',
  },
  {
    name: 'ArknightsGameData', page: 'levels/activities/act3autochess · 2026-11-11',
    url: 'https://github.com/Kengxxiao/ArknightsGameData/tree/master/zh_CN/gamedata/levels/activities/act3autochess',
    used: '领袖与隐秘核心的巡逻检查点、联合全场随行数量，以及关卡覆盖的阻挡数、减伤和技能计时',
  },
  {
    name: 'ArknightsGameData', page: '标准场地 01 · 联合战场',
    url: 'https://github.com/Kengxxiao/ArknightsGameData/blob/master/zh_CN/gamedata/levels/activities/act3autochess/level_act3autochess_m01/level_act3autochess_m01_sub_03.json',
    used: '站位图的地形、可部署格、阻隔工事初始位置、蓝门与传送口',
  },
  {
    name: 'ArknightsGameData', page: 'levels/enemydata/enemy_database · 2026-11-11',
    url: 'https://github.com/Kengxxiao/ArknightsGameData/blob/master/zh_CN/gamedata/levels/enemydata/enemy_database.json',
    used: '领袖技能参数、伪装闪避、环波与践踏半径；与各关卡覆盖参数共同核对实际能力',
  },
  {
    name: 'PRTS',
    page: '“萨米的意志”',
    url: 'https://prts.wiki/w/%E2%80%9C%E8%90%A8%E7%B1%B3%E7%9A%84%E6%84%8F%E5%BF%97%E2%80%9D',
    used: '【冰凌】按列纵向判定',
  },
  {
    name: 'PRTS',
    page: '卫戍协议·规程',
    url: 'https://prts.wiki/w/%E5%8D%AB%E6%88%8D%E5%8D%8F%E8%AE%AE%C2%B7%E8%A7%84%E7%A8%8B',
    used: '赛季规则、规程等级与难度、模式',
  },
  {
    name: 'PRTS',
    page: '敌人一览 · 头像_敌人',
    url: 'https://prts.wiki/w/%E6%95%8C%E4%BA%BA%E4%B8%80%E8%A7%88',
    used: '领袖头像',
  },
  {
    name: 'PRTS',
    page: '卫戍协议·规程/PRTS盟约记录',
    url: 'https://prts.wiki/w/%E5%8D%AB%E6%88%8D%E5%8D%8F%E8%AE%AE%C2%B7%E8%A7%84%E7%A8%8B/PRTS%E7%9B%9F%E7%BA%A6%E8%AE%B0%E5%BD%95',
    used: '全部干员的盟约、特质与精锐特质，盟约效果，装备，策略效果与策略头像；各难度领袖与隐秘核心生命值',
  },
  {
    name: 'PRTS',
    page: '卫戍协议 · 卫戍协议/帮助',
    url: 'https://prts.wiki/w/%E5%8D%AB%E6%88%8D%E5%8D%8F%E8%AE%AE/%E5%B8%AE%E5%8A%A9',
    used: '基础机制：资金、调度中心、合成精锐、领袖与悬赏',
  },
  {
    name: 'PRTS',
    page: '卫戍协议：盟约 · 卫戍协议：盟约 下半',
    url: 'https://prts.wiki/w/%E5%8D%AB%E6%88%8D%E5%8D%8F%E8%AE%AE%EF%BC%9A%E7%9B%9F%E7%BA%A6',
    used: '盟约机制与上一期数值对照',
  },
  {
    name: '可露希尔 Wiki',
    page: '卫戍协议：规程',
    url: 'https://closure.wiki/zh-cn/stronghold-protocol/3',
    used: '规程等级、盟约池、模拟强度与认证效率，干员头像与装备图标',
  },
  {
    name: 'BWIKI',
    page: '卫戍协议·规程 · 盟约',
    url: 'https://wiki.biligame.com/arknights/%E7%9B%9F%E7%BA%A6',
    used: '经济与流程数值核对',
  },
  {
    name: 'Arknights Wiki (wiki.gg)',
    page: 'Stronghold Protocol',
    url: 'https://arknights.wiki.gg/wiki/Stronghold_Protocol',
    used: '调度中心等级与干员等阶数值核对',
  },
];

/** 流派页的方向参考。阵容由本项目根据上方 Wiki 数据整理，视频提供核心盟约、开局策略与打法关键词 */
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
        used: '乌萨斯流派：奥术迅捷、全屏火雨',
      },
      {
        title: '【卫戍协议∶规程】新版本轮椅盟约！奥术精准莱塔尼亚公式化运营一图流',
        bv: 'BV1UhWW6kE6t',
        used: '莱塔尼亚流派：奥术精准',
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
