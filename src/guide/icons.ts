import type {CombatRole} from '../../data/index.ts';

/**
 * 教程页轻量内联 SVG 图标集（24×24，跟随 currentColor，零网络请求）。
 * 用于章节口诀卡、机制对照图、9 类战术特训与实战职能标识。
 */
export type GuideIconName =
  | 'coin'
  | 'grid'
  | 'merge'
  | 'stack'
  | 'bolt'
  | 'refresh'
  | 'snowflake'
  | 'shield'
  | 'box'
  | 'users'
  | 'user'
  | 'timer'
  | 'anvil'
  | 'compass'
  | 'skull'
  | 'bounty'
  | 'spark'
  | 'check'
  | 'cross'
  | 'link'
  | 'swords'
  | 'wing'
  | 'burst'
  | 'orb'
  | 'heart'
  | 'eye'
  | 'prism'
  | 'rebirth';

const PATHS: Readonly<Record<GuideIconName, string>> = {
  coin: '<circle cx="12" cy="12" r="8.5"/><path d="M9.5 9.5h3.2a1.8 1.8 0 0 1 0 3.6h-1.4a1.8 1.8 0 0 0 0 3.6H14.5M12 6.8v10.4"/>',
  grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
  merge:
    '<path d="M12 3.5l2.3 4.7 5.2.7-3.8 3.7.9 5.2L12 15.3l-4.6 2.5.9-5.2-3.8-3.7 5.2-.7L12 3.5z"/>',
  stack:
    '<path d="M12 3.5 3.5 8l8.5 4.5L20.5 8 12 3.5z"/><path d="M3.5 12.5 12 17l8.5-4.5"/><path d="M3.5 16.8 12 21.3l8.5-4.5"/>',
  bolt: '<path d="M13.2 2.8 5.5 13.2h5.6l-1.1 8 8.5-10.8h-5.7l.4-7.6z"/>',
  refresh:
    '<path d="M20 11a8 8 0 0 0-14.6-4.5L4 8m0-4v4h4"/><path d="M4 13a8 8 0 0 0 14.6 4.5L20 16m0 4v-4h-4"/>',
  snowflake:
    '<path d="M12 2.5v19M4.2 7l15.6 10M19.8 7 4.2 17M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5"/>',
  shield:
    '<path d="M12 3 4.5 6.2v5.6c0 4.8 3.2 8.2 7.5 9.7 4.3-1.5 7.5-4.9 7.5-9.7V6.2L12 3z"/><path d="m9 12 2.1 2.1L15.2 10"/>',
  box: '<path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5v-9z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/>',
  users:
    '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.2 19c0-3 2.6-5.2 5.8-5.2s5.8 2.2 5.8 5.2"/><circle cx="16.5" cy="9.5" r="2.5"/><path d="M16.2 14.2c2.5.3 4.6 2.1 4.6 4.8"/>',
  user: '<circle cx="12" cy="8.2" r="3.6"/><path d="M5 19.5c0-3.5 3.1-6 7-6s7 2.5 7 6"/>',
  timer:
    '<circle cx="12" cy="13" r="7.5"/><path d="M10 2.8h4M12 9v4.2l2.8 1.8M18.2 6.8l1.6-1.6"/>',
  anvil:
    '<path d="M7 6h11l2.5 3.5-3.5 2.5H7V6z"/><path d="M4 8h3v3H4zM9.5 12v4.5L7 19.5h10l-2.5-3V12"/>',
  compass:
    '<circle cx="12" cy="12" r="8.5"/><polygon points="15.8,8.2 13.6,13.6 8.2,15.8 10.4,10.4"/>',
  skull:
    '<path d="M12 3.5a7.5 7.5 0 0 0-7.5 7.5c0 2.7 1.4 5 3.5 6.3V20h8v-2.7c2.1-1.3 3.5-3.6 3.5-6.3A7.5 7.5 0 0 0 12 3.5z"/><circle cx="9.3" cy="11.5" r="1.2"/><circle cx="14.7" cy="11.5" r="1.2"/><path d="M10 17.5v2.5M14 17.5v2.5"/>',
  bounty:
    '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>',
  spark:
    '<path d="M12 2.8 14.2 9l6.2 2.2-6.2 2.2L12 19.6 9.8 13.4 3.6 11.2 9.8 9 12 2.8z"/><path d="M19 3.5v3M17.5 5h3"/>',
  check: '<circle cx="12" cy="12" r="8.5"/><path d="m8.3 12.2 2.5 2.5 5-5.2"/>',
  cross:
    '<circle cx="12" cy="12" r="8.5"/><path d="m9.2 9.2 5.6 5.6M14.8 9.2l-5.6 5.6"/>',
  link: '<path d="M7 17 17 7M9.5 7H17v7.5"/>',
  swords:
    '<path d="M4.5 19.5 19 5m-4.5 0H19v4.5M4.5 15l4.5 4.5"/><path d="M19.5 19.5 5 5m4.5 0H5v4.5M19.5 15 15 19.5"/>',
  wing: '<path d="M3.5 16.5c4.5-.5 8-3.2 10.5-7.5 1.3-2.2 3.2-3.8 6.5-4-1 3.8-2.8 6.8-5.8 8.8 2-.2 3.8-.8 5.3-1.8-1.8 3.5-5.2 5.8-10 6.2l-6.5-1.7z"/>',
  burst:
    '<path d="m12 3 2.1 5.4L19.8 6l-3.2 5 5.4 2-5.6 1.2 2.4 5.3-5-3-1.8 5-1.8-5-5 3 2.4-5.3L2 13l5.4-2L4.2 6l5.7 2.4L12 3z"/>',
  orb: '<circle cx="12" cy="12" r="7.5"/><path d="M12 4.5a5.5 5.5 0 0 0 0 15 5.5 5.5 0 0 1 0-15z"/><circle cx="12" cy="12" r="2"/>',
  heart:
    '<path d="M12 20.2s-7.5-4.6-7.5-10.2A4.4 4.4 0 0 1 12 6.8a4.4 4.4 0 0 1 7.5 3.2c0 5.6-7.5 10.2-7.5 10.2z"/><path d="M9.5 12h5M12 9.5v5"/>',
  eye: '<path d="M2.5 12s3.6-6 9.5-6 9.5 6 9.5 6-3.6 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.8"/>',
  prism:
    '<polygon points="12,3.2 20.5,18.8 3.5,18.8"/><path d="M12 3.2v15.6M7.8 11.2l12.7 7.6"/>',
  rebirth:
    '<path d="M18.4 7.6A7.5 7.5 0 1 0 19.5 13"/><polyline points="14.5,7.8 18.8,7.8 18.8,3.5"/><circle cx="12" cy="12" r="2.2"/>',
};

export function iconSvg(name: GuideIconName, className = 'g-ic'): string {
  return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${PATHS[name]}</svg>`;
}

/** 9 类战术特训对应的视觉图标名称 */
export const TRAINING_ICONS: Readonly<Record<string, GuideIconName>> = {
  特异: 'swords',
  飞行: 'wing',
  频次: 'burst',
  元素: 'orb',
  持续: 'heart',
  隐匿: 'eye',
  折射: 'prism',
  致命: 'skull',
  复苏: 'rebirth',
};

/** 13 类实战职能对应的视觉图标名称 */
export const ROLE_ICONS: Readonly<Record<CombatRole, GuideIconName>> = {
  对空: 'wing',
  反隐: 'eye',
  治疗: 'heart',
  元素回复: 'orb',
  高频: 'burst',
  控制: 'compass',
  阻挡: 'shield',
  群攻: 'swords',
  真伤: 'prism',
  元素输出: 'spark',
  破抗: 'anvil',
  沉默: 'cross',
  快活: 'bolt',
};
