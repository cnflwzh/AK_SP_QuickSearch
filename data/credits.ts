import {CURRENT_SEASON} from './season.ts';
import type {
  AboutUsageItem,
  LicenseEntry,
  UploaderSource,
  WikiSource,
} from './types.ts';

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

export const USAGE: readonly AboutUsageItem[] = CURRENT_SEASON.credits.usage;

export const ABOUT_TIP: string | undefined = CURRENT_SEASON.credits.tip;

export interface SiteUpdate {
  readonly date: string;
  readonly title: string;
  readonly items: readonly string[];
}

/** 关于页按开发日期从新到旧展示面向玩家的主要更新。 */
export const SITE_UPDATES: readonly SiteUpdate[] = [
  {
    date: '2026-11-25',
    title: '主站与镜像站存档交接，优化 PWA 安装提示范围',
    items: [
      '「设置」页新增实验性「站点间存档交接」：在同一浏览器内切换主站与大陆镜像时，可直接传递或取回界面设置、干员练度 Box 与自建流派。',
      '接收站已有存档时会先列出两侧差异，支持勾选合并且不覆盖未保存草稿；若跳转到已安装的独立应用导致连接断开，也会引导就地取回或复制配置文本导入。',
      '收紧 PWA 安装引导的显示范围，仅在确认支持安装到桌面或添加到主屏幕的浏览器与系统版本中展示操作步骤。',
    ],
  },
  {
    date: '2026-11-24',
    title: '森空岛阵容导入、术语词典、赛季对比与 PWA 安装引导',
    items: [
      '想把速查放到主屏幕或电脑桌面，可以点「安装步骤」查看当前浏览器的操作方法，也可以点「什么是 PWA？」了解用途。装好后点图标就能查牌，断网也能查看已缓存的资料。',
      '普通页面的安装提示一分钟无人点击后，以后只在「设置」里显示。在设置页点「不再提示」，就能为当前浏览器关闭全站安装提示。',
      '修复桌面版 Edge 安装速查后，窗口无法拖动、右上角按钮被遮住的问题。现在可以拖动系统标题栏移动窗口。',
      '上线「赛季更新对比」页（可从顶部「更新对比」或页脚进入），提供跨赛季改动一图流及盟约、干员、装备、策略、规则的逐项对比；长列表随滚动按需显示，展开未变属性后滚回原处仍保留展开状态。',
      '「设置 → 开发者模式」新增浏览器诊断面板，可查看窗口布局、PWA 与离线缓存状态、页面加载耗时及最近错误，支持本站连通性与存储读写自检并一键复制诊断报告。',
      '粘贴森空岛攻略链接即可导入阵容并保存原文快照，后续可在「更多 → 拉取更新」同步作者改动；微调配装后也能直接生成短链或一图流扫码分享。',
      '流派可按回合分阶段记录阵容、配装和打法，整套流派共用一份按优先级排列的推荐策略。编辑时点流派名旁的图标可更换徽章。',
      '攻略、特质与敌人说明里的「升本」「D 牌」「侵蚀」等用语支持悬停或长按看释义；「小工具 → 术语词典」可按词条、俗称或拼音检索。',
      '重做六章图解教程。可以在调度中心练习买牌合精锐、点选特训查看对策，也能按实战职能查找干员与配装。',
      '恢复手机竖屏顶部的「图解教程」入口；安卓横屏小窗下自动收起标题栏，把空间留给查牌列表。',
    ],
  },
  {
    date: '2026-11-23',
    title: '流派页精简改版，小工具新增「漏怪文书」',
    items: [
      '重排流派页顶栏，打开即完整展示流派名与核心阵容；点「切换流派」可直接搜索切换预设或自建方案，分享、复制与禁选收进「更多」。',
      '「小工具 → 漏怪文书」可将本局流派、盟约与 Boss 一键带入《漏怪道歉书》或《流派使用申请书》，自定条款后生成文字或公文长图发给队友。',
      '适配大屏折叠设备展开窗口下的「我的 Box」与「设置」浏览；小窗查看盟约详情时干员保持双栏紧凑排布。',
    ],
  },
  {
    date: '2026-11-21',
    title: 'Boss 机制与召唤单位支持点词速查',
    items: [
      'Boss 详情页可直接点击技能说明里的虚线词条，原位查看异常状态、特殊地块与召唤单位解析，也可展开词条面板按分类筛选。',
    ],
  },
  {
    date: '2026-11-20',
    title: '敌人页补齐悬赏与普通敌人，流派联动个人 Box',
    items: [
      '原「领袖」升级为「敌人」页，补齐 Boss、悬赏敌人（资金收益与机制）及 9 类特训普通敌人，点对策标签即可按盟约展开推荐干员与装备。',
      '「干员」页收录固定、自选与替补原型三类名单，新增对空、反隐、元素回复、高频等实战职能筛选；点开顶部搜索框可直达「最近查看」。',
      '流派页结合个人 Box 提示缺口干员、替补方案与助战 6★ 借用建议；换设备时可通过短码或二维码同步整份 Box。',
    ],
  },
  {
    date: '2026-11-19',
    title: '上线「我的 Box」个人练度档案',
    items: [
      '支持导入 MAA 识别 JSON、一图流练度 Excel 或直接粘贴干员名单，也可开启画笔批量标记自持练度与助战借用状态，方便核对局内属性加成。',
    ],
  },
  {
    date: '2026-11-17',
    title: '个性化「设置」页与全盟约游戏图标',
    items: [
      '补齐全部 26 个盟约的游戏内图标；新增「设置」页，支持拖拽调整顶部栏目与小工具的顺序和显隐、指定默认首页，以及切换夜间模式、紧凑卡片和大字号。',
    ],
  },
  {
    date: '2026-11-16',
    title: '「本局」全站联动、散件反查与「痛扁发牌」',
    items: [
      '选定本局流派、禁池盟约与 Boss 后，干员、装备、策略与敌人对策全站同步高亮或过滤禁池；装备页支持点选散件反查可合成的组合装备，干员与流派页支持一键复制联机求牌短语。',
      '小工具新增「痛扁发牌」（每日同题挑战、错题本与防剧透战报图）及联机开黑用的「抽象文案」。',
    ],
  },
  {
    date: '2026-11-13',
    title: 'PRTS Wiki 分屏阅读与对局速查改版',
    items: [
      '干员卡片与详情支持一键开启右侧 PRTS Wiki 分屏阅读；重排对局速查工具，并为各栏目、筛选条件与详情卡片补齐可分享链接。',
    ],
  },
  {
    date: '2026-11-11',
    title: '卫戍速查与图解教程上线',
    items: [
      '收录《卫戍协议·规程》干员、盟约、装备、策略速查卡片与六章交互式图解教程，上线八人阵容规划器与 Boss 站位路线图，支持安装为离线应用。',
    ],
  },
];

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
