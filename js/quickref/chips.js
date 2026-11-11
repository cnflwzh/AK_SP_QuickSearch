/**
 * 速查页的小组件。所有 "芯片" 都是 <button>，带 data-* 属性，
 * 点击由 main.js 统一处理：data-op / data-eq / data-st 打开详情，data-cv / data-build 跳转。
 */
import { OPERATOR, EQUIP, STRATEGY, CORE_BUILDS, TIER_LABELS, covenantColor } from '../../data/index.js';
import { esc, html } from '../lib/dom.js';
import { avatarSrc, equipIconSrc, portraitSrc, img } from '../lib/assets.js';

/** 盟约色；附加盟约统一用青色 */
export const color = name => covenantColor(name, 'var(--teal)');

/** 特质 / 效果文本：数字加粗，<时机> 和 【盟约】 上色 */
export const fx = text => esc(text)
  .replace(/(\d+(?:\.\d+)?%?)/g, '<b>$1</b>')
  .replace(/&lt;([^&]+?)&gt;/g, '<em class="k">$1</em>')
  .replace(/【([^】]+)】/g, '<em class="c">$1</em>');

/** 等阶角标：有图时叠在图上，没图时单独显示 */
const badgeWithPicture = (src, wrapperClass, tier) => src
  ? html`<span class="${wrapperClass}">
      <img src="${src}" alt="" width="80" height="80" loading="lazy" decoding="async"><i>${TIER_LABELS[tier]}</i>
    </span>`
  : null;

export function op(name, extraClass = '') {
  const tier = OPERATOR[name]?.tier ?? 0;
  return html`<button type="button" class="op ${extraClass}" data-key="op:${esc(name)}" data-t="${tier}" data-op="${esc(name)}">
    ${badgeWithPicture(avatarSrc(name), 'av', tier) ?? `<i>${TIER_LABELS[tier] || '·'}</i>`}${esc(name)}
  </button>`;
}

export function eq(name) {
  const tier = EQUIP[name]?.tier ?? 0;
  return html`<button type="button" class="eq" data-key="eq:${esc(name)}" data-t="${tier}" data-eq="${esc(name)}">
    ${badgeWithPicture(equipIconSrc(name), 'ei', tier) ?? `<i>${TIER_LABELS[tier]}</i>`}${esc(name)}
  </button>`;
}

export function st(name) {
  const hp = STRATEGY[name]?.hp ?? '';
  return html`<button type="button" class="st" data-key="st:${esc(name)}" data-st="${esc(name)}">
    ${img(portraitSrc(name))}<b>${hp}</b>${esc(name)}
  </button>`;
}

export const cv = name =>
  `<button type="button" class="cv" data-key="cv:${esc(name)}" style="--c:${color(name)}" data-cv="${esc(name)}">${esc(name)}</button>`;

/** 静态盟约标签（不可点） */
export const cvTag = name => `<span class="cv" style="--c:${color(name)}">${name}</span>`;

/** 跳到流派页的链接 */
export const buildLink = name => {
  const c = CORE_BUILDS[name] ? color(name) : 'var(--accent)';
  return `<button type="button" class="cv" data-key="build:${esc(name)}" style="--c:${c}" data-build="${esc(name)}">${esc(name)} ▸</button>`;
};

const BLANK_GIF = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

/** 头像方块：盟约页阵容、流派页终盘阵容。底部色点 = 所属盟约 */
export function tile(operator, extraClass = '') {
  const { name, tier, covenants } = operator;
  const src = avatarSrc(name);
  return html`<button type="button" class="tile ${extraClass}" data-key="op:${esc(name)}" data-t="${tier}" data-op="${esc(name)}">
    ${src ? img(src) : `<img alt="" src="${BLANK_GIF}">`}
    <span>${esc(name)}</span>
    <span class="dots">${covenants.map(c => `<u style="--c:${color(c)}"></u>`)}</span>
  </button>`;
}

/** 分段按钮。点击时 main.js 根据 data-<attr> 的下标更新状态 */
export const segmented = (labels, active, attr) => html`<div class="seg">
  ${labels.map((label, i) =>
    `<button type="button" class="${i === active ? 'on' : ''}" data-${attr}="${i}">${label}</button>`)}
</div>`;

/** 等阶分组标题 */
export const tierHeading = (tier, count) =>
  `<div class="tierh" data-key="heading:${tier}" data-t="${tier}"><i>${TIER_LABELS[tier]}</i><span>${count}</span></div>`;

/** 策略初始生命条（15–40） */
export const hpWidth = hp => (hp - 15) / 25 * 100;
