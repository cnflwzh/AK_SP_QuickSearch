/** 详情弹窗（<dialog id="sheet">）：干员 / 装备 / 策略 */
import {
  OPERATOR, EQUIP, STRATEGY, OPERATORS, TIER_LABELS, TIER_STATS, buildsUsing, isCoreCovenant, covenantColor, rosterOf,
} from '../../data/index.js';
import { $, esc, html } from '../lib/dom.js';
import { covenantRows } from '../lib/peek.js';
import { avatarSrc, equipIconSrc, portraitSrc } from '../lib/assets.js';
import { fx, op, cv, buildLink, hpWidth } from './chips.js';
import { unlockTag } from './views/strategies.js';

export const sheet = $('#sheet');

const closeButton = '<button type="button" class="sh-x" data-close aria-label="关闭">✕</button>';

const linkedBuilds = names => names.length > 0
  && html`<div><h5 class="cnt" style="margin:0 0 6px">流派</h5><div class="row">${names.map(buildLink)}</div></div>`;

/** 左右两栏对比：初始 / 精锐，或基础 / 进阶 */
const compare = (left, right) => html`<div class="cmp2">
  <div><div class="lb"><span class="tag">${left.label}</span>${left.note}</div>${left.text}</div>
  <div class="el"><div class="lb"><span class="tag a">${right.label}</span>${right.note}</div>${right.text}</div>
</div>`;

/**
 * 宽屏时弹窗右侧的盟约效果列（窄屏由 CSS 隐藏），与详情同在一张卡片里。
 * 每段标题即跳转按钮；带 data-peek="off"，因为效果已经展示在下方，悬停不再弹速览。
 */
const covenantSide = names => html`<aside class="sh-side" aria-label="盟约效果">
  <div class="sd-k">盟约效果</div>
  ${names.map((name, i) => html`<section class="sd-c" style="--c:${covenantColor(name, 'var(--teal)')};--i:${i}">
    <button type="button" class="sd-h" data-cv="${esc(name)}" data-peek="off" title="查看${esc(name)}盟约页">
      <b>${esc(name)}</b><span>${isCoreCovenant(name) ? '核心' : '附加'} · ${rosterOf(name).length} 名</span><em>▸</em>
    </button>
    ${covenantRows(name)}
  </section>`)}
</aside>`;

/**
 * operator：当前展示的干员名，跳转到盟约页后用来高亮；其他详情为空。
 * 记在 data-viewing 上，不能用 data-op，否则整个弹窗会被当成干员芯片
 * （悬停弹速览、点遮罩又重新打开）。
 */
function open(content, { operator = '', side = '' } = {}) {
  sheet.dataset.viewing = operator;
  sheet.classList.toggle('with-side', !!side);
  sheet.innerHTML = `<div class="sh-main">${content}</div>${side}`;
  if (!sheet.open) sheet.showModal();
  $('.sh-main', sheet).scrollTop = 0;
}

export function openOperator(name) {
  const o = OPERATOR[name];
  if (!o) return;
  const stats = TIER_STATS[o.tier - 1];
  const sameTierMates = OPERATORS.filter(x =>
    x.name !== name && x.tier === o.tier && x.covenants.some(c => o.covenants.includes(c)));
  const pic = avatarSrc(name);

  open(html`<div class="sh-h" data-t="${o.tier}">
    ${pic && `<img class="pic" src="${pic}" alt="" width="80" height="80">`}
    <div>
      <div class="row">
        <i class="tn">${TIER_LABELS[o.tier]} 阶</i><span class="stars">${'★'.repeat(o.stars)}</span><span class="tag">${o.type}</span>
      </div>
      <h3>${esc(name)}</h3>
      <div class="row">${o.covenants.map(cv)}</div>
    </div>
    ${closeButton}
  </div>
  <div class="sh-b">
    ${compare(
      { label: '初始', note: `<small>${stats.base}</small>`, text: fx(o.trait) },
      { label: '精锐', note: `<small>${stats.elite}</small>`, text: fx(o.elite) })}
    ${linkedBuilds(buildsUsing('lineup', name))}
    ${sameTierMates.length > 0 && html`<div>
      <h5 class="cnt" style="margin:0 0 6px">同盟约 · 同阶</h5>
      <div class="row">${sameTierMates.map(x => op(x.name))}</div>
    </div>`}
  </div>`, { operator: name, side: covenantSide(o.covenants) });
}

export function openEquipment(name) {
  const e = EQUIP[name];
  if (!e) return;
  const pic = equipIconSrc(name);

  open(html`<div class="sh-h" data-t="${e.tier}">
    ${pic && `<img class="pic e" src="${pic}" alt="" width="80" height="80">`}
    <div>
      <div class="row"><i class="tn">${TIER_LABELS[e.tier]} 阶</i><span class="tag a">${e.price} 资金</span></div>
      <h3>${esc(name)}</h3>
      <div class="row">${e.covenant && cv(e.covenant)}</div>
    </div>
    ${closeButton}
  </div>
  <div class="sh-b">
    ${compare(
      { label: '基础', note: '', text: fx(e.effect) },
      { label: '进阶', note: '', text: fx(e.advanced || e.effect) })}
    ${linkedBuilds(buildsUsing('equipment', name))}
  </div>`);
}

export function openStrategy(name) {
  const s = STRATEGY[name];
  if (!s) return;
  const pic = portraitSrc(name);

  open(html`<div class="sh-h">
    ${pic && `<img class="pic s" src="${pic}" alt="" width="88" height="88">`}
    <div>
      <div class="row">
        ${isCoreCovenant(s.category) ? cv(s.category) : `<span class="tag">${s.category}</span>`}${unlockTag(s.unlock)}
      </div>
      <h3>${esc(name)}</h3>
      <div class="hpbig"><b>${s.hp}</b><div class="trk"><div style="width:${hpWidth(s.hp)}%"></div></div></div>
    </div>
    ${closeButton}
  </div>
  <div class="sh-b">
    <div class="ef" style="--c:var(--teal)"><span class="tag t">${esc(s.skill)}</span><div>${fx(s.effect)}</div></div>
    ${linkedBuilds(buildsUsing('strategies', name))}
  </div>`);
}

// 点击遮罩关闭
sheet.addEventListener('click', e => {
  if (e.target === sheet) sheet.close();
});
