/** 流派页：顶部流派选择，下方为终盘阵容、运营要点、附加盟约 / 策略 / 装备 */
import {
  CORE_BUILDS, MIXED_BUILDS, COVENANTS, OPERATOR, BUILD_NAMES, BUILD_COUNT, buildByName, lineupCovenantCount,
} from '../../../data/index.js';
import { esc, html, round1 } from '../../lib/dom.js';
import { state } from '../state.js';
import { color, cv, st, eq, tile } from '../chips.js';

function selector(current) {
  const coreButtons = Object.keys(CORE_BUILDS).map(name =>
    `<button type="button" class="${name === current ? 'on' : ''}" style="--c:${color(name)}" data-bd="${name}">${name}</button>`);
  const mixedButtons = MIXED_BUILDS.map(({ name }) =>
    `<button type="button" class="${name === current ? 'on' : ''}" style="--c:var(--accent)" data-bd="${esc(name)}">${esc(name)}</button>`);
  return html`<div class="bsel">${coreButtons}<span class="sp"></span>${mixedButtons}</div>`;
}

/** 核心流派：主数值在 0–200 层的取值 */
function layerTable(covenantName, accent) {
  const main = COVENANTS[covenantName].scaling[0];
  if (!main) return '';
  return html`<div class="qcalc" style="--c:${accent}">
    <div class="vals">${[0, 50, 100, 150, 200].map(layers =>
      html`<div><span>${layers} 层 · ${main.label}</span><b>${round1(main.at(layers))}<small>${main.unit}</small></b></div>`)}
    </div>
  </div>`;
}

export default {
  id: 'bd',
  label: '流派',
  count: BUILD_COUNT,

  render() {
    if (!BUILD_NAMES.includes(state.build)) state.build = '乌萨斯';
    const name = state.build;
    const core = !!CORE_BUILDS[name];
    const build = buildByName(name);
    const accent = core ? color(name) : 'var(--accent)';
    const carries = new Set(core ? build.carries : []);
    const lineup = build.lineup.map(n => OPERATOR[n] ? tile(OPERATOR[n], carries.has(n) ? 'core' : '') : '');

    return html`${selector(name)}
    <div class="panel" style="--c:${accent}">
      <div class="ph"><h2>${esc(name)}</h2><span class="tag a">${esc(build.tagline)}</span>${core && cv(name)}</div>
      <div>
        <h5>终盘阵容${core && ' · <span class="tag a" style="padding:0 6px">核心</span>'}</h5>
        <div class="tiles">${lineup}</div>
      </div>
      <div class="bgrid">
        <div>
          <h5>要点</h5>
          <ol class="qsteps">${build.tips.map((tip, i) =>
            `<li style="animation-delay:${i * .06}s"><span>${esc(tip)}</span></li>`)}</ol>
        </div>
        <div style="display:grid;gap:12px;align-content:start">
          ${core && html`<div data-key="addons"><h5>推荐附加盟约 · 阵容人数 / 激活人数</h5><div class="row">${build.addons.map(n => html`<span class="row" data-key="${n}">${cv(n)}<span class="tag">${lineupCovenantCount(build.lineup, n)} / ${COVENANTS[n].need}</span></span>`)}</div></div>`}
          <div data-key="strategies"><h5>策略</h5><div class="row">${build.strategies.map(st)}</div></div>
          <div data-key="equipment"><h5>装备</h5><div class="row">${build.equipment.map(eq)}</div></div>
        </div>
      </div>
      ${core && layerTable(name, accent)}
    </div>`;
  },
};
