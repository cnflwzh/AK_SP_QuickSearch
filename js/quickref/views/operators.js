/** 干员页：按等阶分组的干员卡片，可按等阶 / 盟约筛选，切换初始与精锐特质 */
import { OPERATORS, ALL_COVENANTS, TIERS, TIER_LABELS } from '../../../data/index.js';
import { $, esc, html } from '../../lib/dom.js';
import { avatarSrc, img } from '../../lib/assets.js';
import { state } from '../state.js';
import { fx, cvTag, segmented, tierHeading } from '../chips.js';

/** 干员卡片（搜索结果也用） */
export const operatorCard = (operator, showElite) => {
  const { name, tier, covenants, type } = operator;
  return html`<button type="button" class="oc" data-t="${tier}" data-op="${esc(name)}">
    <div class="h">${img(avatarSrc(name))}<b>${esc(name)}</b><i class="tn">${TIER_LABELS[tier]}</i></div>
    <div class="row">${covenants.map(cvTag)}<span class="tag">${type}</span></div>
    <div class="tx">${fx(showElite ? operator.elite : operator.trait)}</div>
  </button>`;
};

export default {
  id: 'op',
  label: '干员',
  count: OPERATORS.length,

  render() {
    const { opTier, opCovenant, opElite } = state;
    const list = OPERATORS.filter(o =>
      (!opTier || o.tier === opTier) && (!opCovenant || o.covenants.includes(opCovenant)));

    const body = TIERS.map(tier => {
      const group = list.filter(o => o.tier === tier);
      if (!group.length) return '';
      return tierHeading(tier, group.length)
        + html`<div class="qg">${group.map(o => operatorCard(o, opElite))}</div>`;
    }).join('');

    const covenantOptions = ALL_COVENANTS.map(c =>
      `<option ${c === opCovenant ? 'selected' : ''}>${c}</option>`);

    return html`<div class="bar">
      ${segmented(['全部', ...TIER_LABELS.slice(1)], opTier, 'opt')}
      <select id="opC" aria-label="盟约"><option value="">全部盟约</option>${covenantOptions}</select>
      ${segmented(['初始', '精锐'], opElite ? 1 : 0, 'opel')}
      <span class="cnt">${list.length} 名</span>
    </div>
    ${body || '<div class="empty">—</div>'}`;
  },

  mount(rerender) {
    $('#opC').onchange = e => {
      state.opCovenant = e.target.value;
      rerender();
    };
  },
};
