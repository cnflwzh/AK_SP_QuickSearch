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

/** 关于页按日期倒序展示面向玩家的功能变化。 */
export const SITE_UPDATES = [
  {
    date: '2026-11-24',
    title: '流派支持分阶段规划和自选图标',
    items: [
      '粘贴森空岛攻略链接即可保存阵容、查看原文快照，并手动拉取更新。',
      '可在第 1–15 回合内划分阶段，每阶段能安排 20 名干员，流派最多推荐 5 个策略。点名称旁的图标可更换流派徽章。',
      '设置页底部的开发者模式可以检查小窗导航、标出布局边界，并复制当前窗口的诊断信息。',
    ],
  },
  {
    date: '2026-11-23',
    title: '流派切换和 Box 浏览更顺手',
    items: [
      '从流派页打开目录即可切换阵容。编辑 Box 时，页面会滚动到干员列表。',
    ],
  },
  {
    date: '2026-11-21',
    title: '敌人页新增术语速查',
    items: ['可以搜索敌人机制术语，也可以在说明中直接点开术语查看释义。'],
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
