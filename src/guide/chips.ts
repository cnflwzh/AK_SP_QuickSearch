/**
 * 教程页的小组件。与速查页不同，这里的芯片只是展示用的 <span>，不可点击。
 */
import { OPERATOR, EQUIP, STRATEGY, TIER_LABELS, covenantColor } from '../../data/index';
import { avatarSrc, equipIconSrc, portraitSrc, img } from '../lib/assets';

/** 盟约色；附加盟约统一用强调色 */
export const color = (name: string) => covenantColor(name, 'var(--accent)');

/** 带底色的方形头像（商店、整备区、终盘阵容等） */
export const avatar = (name: string) => img(avatarSrc(name), 'ava');

export function op(name: string, extraClass = '') {
  const tier = OPERATOR[name]?.tier ?? 0;
  const src = avatarSrc(name);
  return src
    ? `<span class="op ${extraClass}" data-key="op:${name}" data-t="${tier}" data-op="${name}"><span class="av">${img(src)}<i>${TIER_LABELS[tier]}</i></span>${name}</span>`
    : `<span class="op ${extraClass}" data-key="op:${name}" data-t="${tier}" data-op="${name}"><i>${TIER_LABELS[tier] || '·'}</i>${name}</span>`;
}

/** label 用于显示与名称不同的文字，如 "维式重锤＋" */
export function eq(name: string, label = name) {
  const tier = EQUIP[name]?.tier ?? 0;
  const src = equipIconSrc(name);
  return src
    ? `<span class="eq" data-key="eq:${name}" data-t="${tier}" data-eq="${name}"><span class="ei">${img(src)}<i>${TIER_LABELS[tier]}</i></span>${label}</span>`
    : `<span class="eq" data-key="eq:${name}" data-t="${tier}" data-eq="${name}"><i>${EQUIP[name] ? TIER_LABELS[tier] : ''}</i>${label}</span>`;
}

export const portrait = (name: string) => img(portraitSrc(name), '', 88);

export const st = (name: string) => `<span class="st" data-key="st:${name}" data-st="${name}">${portrait(name)}<b>${STRATEGY[name]?.hp ?? ''}</b>${name}</span>`;

export const cv = (name: string) => `<span class="cv" data-key="cv:${name}" style="--c:${color(name)}">${name}</span>`;

/** 小号等阶块，用于表格 */
export const tierBadge = (tier: number) =>
  `<span class="op" data-t="${tier}" style="padding:2px"><i>${TIER_LABELS[tier]}</i></span>`;
