import {CURRENT_SEASON} from './season.ts';
import type {LicenseEntry, UploaderSource, WikiSource} from './types.ts';

/**
 * 项目说明与数据来源，首次打开时的「关于」弹窗由此生成（src/lib/ui/about.ts）。
 *
 * 新增或更换数据来源时：
 *   1. 在对应赛季 credits 里补一条，写清楚用到了它的哪部分内容
 *   2. 把 aboutVersion 加 1，已看过弹窗的用户下次打开会再看到一次
 */

export const ABOUT_VERSION = CURRENT_SEASON.credits.aboutVersion;

/** 开源仓库地址，填写后弹窗里会出现「反馈 / 源码」链接 */
export const REPO_URL = 'https://github.com/cnflwzh/AK_SP_QuickSearch';

export const PURPOSE: readonly string[] = CURRENT_SEASON.credits.purpose;

/** 关于页按开发日期从新到旧展示玩家可用的主要变化。 */
export const SITE_UPDATES = [
  {
    date: '2026-11-24',
    title: '森空岛流派支持扫码分享，小工具新增术语词典',
    items: [
      '读攻略遇到「升本」「D 牌」「侵蚀」等术语，可以悬停或长按看解释。「小工具 → 术语词典」支持按俗称、拼音和释义搜索。',
      '粘贴森空岛攻略链接即可在本地保存阵容和原文快照。原作者改了攻略，可从「更多」拉取更新。',
      '第 1–15 回合可自定阶段，每阶段最多安排 20 名干员，整套流派可按优先级推荐 5 个策略。点流派名旁的图标，可从盟约、干员、策略或装备中挑选徽章。',
      '手机竖屏全屏时可打开图解教程，紧凑小窗会收起标题栏。想微调切换尺寸，可在设置底部的开发者模式查看窗口宽高、调整断点。',
      '原样转发可复制森空岛原链。改过的阵容优先用攻略编号和修改内容生成短链接，扫码即可还原。下载 JSON 也会带上原文链接和快照。',
    ],
  },
  {
    date: '2026-11-23',
    title: '流派页优先展示阵容，新增「漏怪文书」',
    items: [
      '打开流派页就能看到完整流派名和阵容，分享、复制等操作收进「更多」。',
      '「小工具」里可以把本局流派和领袖带入《漏怪道歉书》或《流派使用申请书》，自己改条款，再发文字或图片给队友。',
    ],
  },
  {
    date: '2026-11-21',
    title: '敌人页新增术语速查',
    items: [
      '遇到不熟悉的机制，可以直接点说明里的术语查看释义，也可以用名称或拼音搜索。',
    ],
  },
  {
    date: '2026-11-20',
    title: '按自己的 Box 选助战',
    items: [
      '选好想玩的流派，就能看到缺哪些干员、借谁能补齐更多核心。换设备时，可以扫码或粘贴短码导入整份 Box。',
    ],
  },
  {
    date: '2026-11-19',
    title: '「我的 Box」开始记录干员练度',
    items: [
      '可导入 MAA 导出的 JSON，或直接粘贴干员名单，再在列表里批量标记练度和借用状态。',
    ],
  },
  {
    date: '2026-11-17',
    title: '常用页面可以排在前面',
    items: [
      '在设置里可调整顶部标签的顺序和显隐，指定默认打开的页面，也可切换大字号或紧凑布局。',
    ],
  },
  {
    date: '2026-11-16',
    title: '本局禁池与领袖联动，「痛扁发牌」开放挑战',
    items: [
      '「痛扁发牌」可以挑战每日同题，结束后生成不透露答案的战报图。',
      '选好本局流派、标记禁池和领袖后，切到干员、装备或敌人页也能接着查本局可用的选择。',
    ],
  },
] as const;

export const WIKIS: readonly WikiSource[] = CURRENT_SEASON.credits.wikis;

/** 当前版本的流派参考。阵容与运营结合攻略正文、实战讨论及 Wiki 的干员特质整理。 */
export const UPLOADERS: readonly UploaderSource[] =
  CURRENT_SEASON.credits.uploaders;

export const FURTHER_READING: readonly UploaderSource[] =
  CURRENT_SEASON.credits.furtherReading;

export const LICENSES: readonly LicenseEntry[] = [
  ['代码', 'GNU AGPL-3.0'],
  ['整理后的数据（data/）', 'CC BY-NC-SA 3.0，沿用 PRTS 的协议'],
  ['游戏图片、名称与文本', '© 上海鹰角网络科技有限公司'],
  ['视频攻略', '版权归各 UP 主'],
];

export const spaceUrl = (uid: number): string =>
  `https://space.bilibili.com/${uid}`;
export const videoUrl = (bv: string): string =>
  `https://www.bilibili.com/video/${bv}/`;
