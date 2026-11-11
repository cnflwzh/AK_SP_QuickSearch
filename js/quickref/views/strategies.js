/** 策略页：按分类筛选的策略卡片 */
import { STRATEGIES, STRATEGY_CATEGORIES, isCoreCovenant } from '../../../data/index.js';
import { esc, html } from '../../lib/dom.js';
import { portraitSrc } from '../../lib/assets.js';
import { state } from '../state.js';
import { fx, cvTag, segmented, hpWidth } from '../chips.js';

/** 分类为核心盟约名时显示盟约标签，否则显示普通标签 */
export const categoryTag = category =>
  isCoreCovenant(category) ? cvTag(category) : `<span class="tag">${category}</span>`;

export const unlockTag = unlock =>
  `<span class="tag ${unlock === '初始' ? 't' : ''}">${esc(unlock)}</span>`;

/** "阵营" 分类 = 所有核心盟约策略 */
export const inCategory = (strategy, category) =>
  category === '全部'
  || (category === '阵营' ? isCoreCovenant(strategy.category) : strategy.category === category);

/** 策略卡片（搜索结果也用） */
export const strategyCard = strategy => {
  const { name, hp, skill, effect, category, unlock } = strategy;
  const portrait = portraitSrc(name);
  return html`<button type="button" class="oc" style="--tc:var(--teal)" data-st="${esc(name)}">
    <div class="h">
      ${portrait && `<img class="sp" src="${portrait}" alt="" width="88" height="88" loading="lazy" decoding="async">`}
      <b>${esc(name)}</b>${categoryTag(category)}
    </div>
    <div class="hp"><span>${hp}</span><div class="trk"><div style="width:${hpWidth(hp)}%"></div></div></div>
    <div class="tx"><span style="color:var(--ink);font-weight:500">${esc(skill)}</span>　${fx(effect)}</div>
    <div>${unlockTag(unlock)}</div>
  </button>`;
};

export default {
  id: 'st',
  label: '策略',
  count: STRATEGIES.length,

  render() {
    const category = STRATEGY_CATEGORIES[state.stCategory];
    const list = STRATEGIES.filter(s => inCategory(s, category));
    return html`<div class="bar">
      ${segmented(STRATEGY_CATEGORIES, state.stCategory, 'stc')}
      <span class="cnt">${list.length} 名</span>
    </div>
    <div class="qg">${list.map(strategyCard)}</div>`;
  },
};
