/** 第 6 章 图鉴：可筛选的干员列表 + 按等阶分列的装备 */
import { OPERATORS, EQUIPMENT, ALL_COVENANTS, TIERS, TIER_LABELS } from '../../../data/index.js';
import { $, html } from '../../lib/dom.js';
import { updateHTML } from '../../lib/update-html.js';
import { equipIconSrc } from '../../lib/assets.js';
import { cv, avatar, mountSegmented } from '../chips.js';

const traitHtml = text => text.replace(/<([^>]+)>/g, '<b style="color:var(--accent)">$1</b> ');

function operatorDatabase() {
  let tier = 0;
  const covenantSelect = $('#dbCov');
  const typeSelect = $('#dbType');
  const eliteToggle = $('#dbEl');
  const search = $('#dbQ');
  covenantSelect.innerHTML = '<option value="">全部盟约</option>' + ALL_COVENANTS.map(n => `<option>${n}</option>`).join('');

  const draw = () => {
    const covenant = covenantSelect.value;
    const type = typeSelect.value;
    const query = search.value.trim();
    const elite = eliteToggle.checked;
    const list = OPERATORS.filter(o =>
      (!tier || o.tier === tier)
      && (!covenant || o.covenants.includes(covenant))
      && (!type || o.type === type)
      && (!query || (o.name + o.covenants.join('/') + o.trait).includes(query)));

    $('#dbN').textContent = list.length + ' / ' + OPERATORS.length;
    updateHTML($('#dbg'), list.map(o => html`<div class="dbc" data-key="${o.name}" data-t="${o.tier}">
      <div class="t">${avatar(o.name)}<i>${TIER_LABELS[o.tier]}</i><b>${o.name}</b><span class="s">${o.stars ? '★' + o.stars : ''}</span></div>
      <div class="row">${o.covenants.map(cv)}<span class="tag">${o.type}</span></div>
      <div class="tx">${traitHtml(elite ? o.elite : o.trait)}</div>
    </div>`).join(''));
  };

  mountSegmented($('#dbTier'), ['全部', ...TIER_LABELS.slice(1)], 0, i => { tier = i; draw(); });
  [covenantSelect, typeSelect, eliteToggle].forEach(el => { el.onchange = draw; });
  search.oninput = draw;
}

function equipmentColumns() {
  const card = e => {
    const icon = equipIconSrc(e.name);
    return html`<div class="eqi" data-t="${e.tier}">
      <div class="eh">
        ${icon && `<img class="ico" src="${icon}" alt="" width="80" height="80" loading="lazy" decoding="async">`}
        <b>${e.name}<span>${e.price}</span></b>
      </div>
      ${e.effect}
      ${e.advanced && `<br><span style="color:var(--accent)">进阶</span> ${e.advanced}`}
      ${e.covenant && `<br>${cv(e.covenant)}`}
    </div>`;
  };
  $('#eqcols').innerHTML = TIERS.map(t =>
    html`<div class="col"><div data-t="${t}">${TIER_LABELS[t]}</div>${EQUIPMENT.filter(e => e.tier === t).map(card)}</div>`,
  ).join('');
}

export function initDatabase() {
  operatorDatabase();
  equipmentColumns();
}
