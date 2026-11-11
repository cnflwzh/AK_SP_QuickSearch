/** 装备页：按等阶分组，显示价格、组合盟约、基础与进阶效果 */
import { EQUIPMENT, TIERS, TIER_LABELS } from '../../../data/index.js';
import { esc, html } from '../../lib/dom.js';
import { equipIconSrc } from '../../lib/assets.js';
import { state } from '../state.js';
import { fx, cvTag, segmented, tierHeading } from '../chips.js';

/** 装备卡片（搜索结果也用） */
export const equipmentCard = item => {
  const { name, tier, price, covenant, effect, advanced } = item;
  const icon = equipIconSrc(name);
  return html`<button type="button" class="oc" data-key="eq:${esc(name)}" data-t="${tier}" data-eq="${esc(name)}">
    <div class="h">
      ${icon && `<img class="ei" src="${icon}" alt="" width="80" height="80" loading="lazy" decoding="async">`}
      <b>${esc(name)}</b>${covenant && cvTag(covenant)}<span class="pr">${price}</span>
    </div>
    <div class="tx">${fx(effect)}</div>
    ${advanced && advanced !== effect
      && html`<div class="tx adv"><span class="tag a">进阶</span> ${fx(advanced)}</div>`}
  </button>`;
};

export default {
  id: 'eq',
  label: '装备',
  count: EQUIPMENT.length,

  render() {
    const { eqTier } = state;
    const list = EQUIPMENT.filter(e => !eqTier || e.tier === eqTier);
    const body = TIERS.map(tier => {
      const group = list.filter(e => e.tier === tier);
      if (!group.length) return '';
      return tierHeading(tier, group.length) + html`<div class="qg" data-key="tier:${tier}">${group.map(equipmentCard)}</div>`;
    });
    return html`<div class="bar" data-key="filters">
      ${segmented(['全部', ...TIER_LABELS.slice(1)], eqTier, 'eqt')}
      <span class="cnt">${list.length} 件</span>
    </div>
    ${body}`;
  },
};
