/**
 * 教程页的小组件。与速查页不同，这里的芯片只是展示用的 <span>，不可点击。
 */
import { OPERATOR, EQUIP, STRATEGY, TIER_LABELS, covenantColor } from '../../data/index.js';
import { $$ } from '../lib/dom.js';
import { avatarSrc, equipIconSrc, portraitSrc, img } from '../lib/assets.js';

/** 盟约色；附加盟约统一用强调色 */
export const color = name => covenantColor(name, 'var(--accent)');

/** 带底色的方形头像（商店、整备区、终盘阵容等） */
export const avatar = name => img(avatarSrc(name), 'ava');

export function op(name, extraClass = '') {
  const tier = OPERATOR[name]?.tier ?? 0;
  const src = avatarSrc(name);
  return src
    ? `<span class="op ${extraClass}" data-t="${tier}" data-op="${name}"><span class="av">${img(src)}<i>${TIER_LABELS[tier]}</i></span>${name}</span>`
    : `<span class="op ${extraClass}" data-t="${tier}" data-op="${name}"><i>${TIER_LABELS[tier] || '·'}</i>${name}</span>`;
}

/** label 用于显示与名称不同的文字，如 "维式重锤＋" */
export function eq(name, label = name) {
  const tier = EQUIP[name]?.tier ?? 0;
  const src = equipIconSrc(name);
  return src
    ? `<span class="eq" data-t="${tier}" data-eq="${name}"><span class="ei">${img(src)}<i>${TIER_LABELS[tier]}</i></span>${label}</span>`
    : `<span class="eq" data-t="${tier}" data-eq="${name}"><i>${EQUIP[name] ? TIER_LABELS[tier] : ''}</i>${label}</span>`;
}

export const portrait = name => img(portraitSrc(name), '', 88);

export const st = name => `<span class="st" data-st="${name}">${portrait(name)}<b>${STRATEGY[name]?.hp ?? ''}</b>${name}</span>`;

export const cv = name => `<span class="cv" style="--c:${color(name)}">${name}</span>`;

/** 小号等阶块，用于表格 */
export const tierBadge = tier =>
  `<span class="op" data-t="${tier}" style="padding:2px"><i>${TIER_LABELS[tier]}</i></span>`;

/**
 * guide.html 里手写的 <span class="op">名字</span> / <span class="eq">…</span> / .fc 卡片，
 * 在这里补上头像和图标，HTML 里就不用写图片路径了。
 */
export function decorateStaticChips() {
  const ROMAN = /^[ⅠⅡⅢⅣⅤⅥ·]/;

  $$('span.op').forEach(el => {
    const name = el.textContent.replace(ROMAN, '');
    if (!avatarSrc(name)) return;
    el.outerHTML = op(name, el.classList.contains('hl') ? 'hl' : '');
  });

  $$('.fc').forEach(el => {
    const name = el.textContent.replace(/[ⅠⅡⅢⅣⅤⅥ]|精锐/g, '').trim();
    if (avatarSrc(name)) el.querySelector('i').insertAdjacentHTML('beforebegin', avatar(name));
  });

  $$('span.eq').forEach(el => {
    const label = el.textContent.replace(ROMAN, '');
    const name = label.replace(/＋$/, '');
    if (!equipIconSrc(name)) return;
    const style = el.getAttribute('style');
    el.outerHTML = eq(name, label).replace('<span class="eq"', `<span class="eq"${style ? ` style="${style}"` : ''}`);
  });
}

/**
 * 分段按钮：渲染到 el，点击时高亮并回调 onChange(下标)。
 * 初始化时会立即以 initial 调用一次 onChange。
 */
export function mountSegmented(el, labels, initial, onChange) {
  el.innerHTML = labels.map((label, i) =>
    `<button type="button" data-i="${i}" class="${i === initial ? 'on' : ''}">${label}</button>`).join('');
  el.onclick = e => {
    const button = e.target.closest('button');
    if (!button) return;
    [...el.children].forEach(c => c.classList.toggle('on', c === button));
    onChange(+button.dataset.i);
  };
  onChange(initial);
}
