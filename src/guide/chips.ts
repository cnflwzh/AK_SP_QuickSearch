/**
 * 教程页实体芯片与徽章生成工具。
 * 保留 data-op / data-eq / data-st / data-cv / data-ld 属性，支持鼠标悬停或触屏长按弹出速览小卡。
 */
import {
  OPERATOR,
  EQUIP,
  STRATEGY,
  LEADER,
  TIER_LABELS,
  covenantColor,
} from '../../data/index.ts';
import {
  avatarSrc,
  covenantIconHtml,
  covenantIconSrc,
  enemyIconSrc,
  equipIconSrc,
  leaderSrc,
  portraitSrc,
  img,
} from '../lib/ui/assets.ts';
import {esc} from '../lib/ui/dom.ts';

/** 盟约色；附加盟约统一用强调色 */
export const color = (name: string) => covenantColor(name, 'var(--accent)');

/** 带底色的方形头像（商店、整备区、终盘阵容等） */
export const avatar = (name: string) => img(avatarSrc(name), 'ava');

export function op(name: string, extraClass = '') {
  const tier = OPERATOR[name]?.tier ?? 0;
  const src = avatarSrc(name);
  const safe = esc(name);
  return src
    ? `<span class="op ${extraClass}" data-key="op:${safe}" data-t="${tier}" data-op="${safe}"><span class="av">${img(src)}<i>${TIER_LABELS[tier]}</i></span>${safe}</span>`
    : `<span class="op ${extraClass}" data-key="op:${safe}" data-t="${tier}" data-op="${safe}"><i>${TIER_LABELS[tier] || '·'}</i>${safe}</span>`;
}

/** label 用于显示与名称不同的文字，如 "维式重锤＋" */
export function eq(name: string, label = name) {
  const tier = EQUIP[name]?.tier ?? 0;
  const src = equipIconSrc(name);
  const safeName = esc(name);
  const safeLabel = esc(label);
  return src
    ? `<span class="eq" data-key="eq:${safeName}" data-t="${tier}" data-eq="${safeName}"><span class="ei">${img(src)}<i>${TIER_LABELS[tier]}</i></span>${safeLabel}</span>`
    : `<span class="eq" data-key="eq:${safeName}" data-t="${tier}" data-eq="${safeName}"><i>${EQUIP[name] ? TIER_LABELS[tier] : ''}</i>${safeLabel}</span>`;
}

export const portrait = (name: string) => img(portraitSrc(name), '', 88);

export function st(name: string) {
  const safe = esc(name);
  return `<span class="st" data-key="st:${safe}" data-st="${safe}">${portrait(name)}<b>${STRATEGY[name]?.hp ?? ''}</b>${safe}</span>`;
}

export function cv(name: string) {
  const safe = esc(name);
  return `<span class="cv" data-key="cv:${safe}" data-cv="${safe}" style="--c:${color(name)}">${covenantIconHtml(name)}${safe}</span>`;
}

/** 盟约暗底方形徽章（用于流派面板标题与重点展示） */
export function emblem(name: string, size = 40) {
  const src = covenantIconSrc(name);
  if (!src) return '';
  return `<span class="cv-emblem" style="--c:${color(name)};--cv-emblem-size:${size}px">${img(src, '', size)}</span>`;
}

/** 领袖芯片（带圆形暗红边框头像与悬停速览） */
export function ld(name: string) {
  const safe = esc(name);
  const src = LEADER[name] ? leaderSrc(name) : '';
  return `<span class="ld-chip" data-key="ld:${safe}" data-ld="${safe}">${src ? img(src, 'ld-av', 56) : ''}${safe}</span>`;
}

/** 悬赏敌人方形小头像 */
export function bountyAvatar(enemyId: string) {
  const src = enemyIconSrc(enemyId);
  return src ? img(src, 'bty-av', 56) : '';
}

/** 小号等阶块，用于表格 */
export const tierBadge = (tier: number) =>
  `<span class="op" data-t="${tier}" style="padding:2px"><i>${TIER_LABELS[tier]}</i></span>`;
