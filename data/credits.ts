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
