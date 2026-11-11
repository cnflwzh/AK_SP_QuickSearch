/** 数值页：盟约层数计算器、回合时限、调度中心、领袖生命、悬赏、练度等常查数字 */
import {
  MODES, DECISION_ROUNDS, ROUND_TIME, LEADERS, DISPATCH_LEVELS, DISPATCH_BY_MODE, BOUNTIES, TIER_STATS,
  TIER_LABELS, TRAINING, OWN_OPERATOR_BONUS, COVENANTS, CORE_COVENANTS, ADDON_COVENANTS,
} from '../../../data/index.js';
import { $, $$, esc, html, range, wan, round1 } from '../../lib/dom.js';
import { updateHTML } from '../../lib/update-html.js';
import { state } from '../state.js';
import { color, segmented } from '../chips.js';

const LAYER_PRESETS = [0, 30, 60, 100, 150, 200, 300];

/** 复用盟约数据中的公式，只生成当前层数的结果。 */
const layerValues = (name, layers) => COVENANTS[name].scaling.map(s =>
  `<div><span>${esc(s.label)}</span><b>${round1(s.at(layers))}<small>${esc(s.unit)}</small></b></div>`).join('');

/** 局内速查：计算器置顶，直接输入与预设按钮减少定位层数所需的操作。 */
function layerCalculator() {
  const name = state.calculatorCovenant;
  const layers = state.layers[name] ?? 60;
  const options = [['核心', CORE_COVENANTS], ['附加', ADDON_COVENANTS]].map(([label, names]) =>
    html`<optgroup label="${label}">${names.filter(n => COVENANTS[n].scaling.length).map(n =>
      `<option value="${esc(n)}" ${n === name ? 'selected' : ''}>${esc(n)}</option>`)}</optgroup>`);

  return html`<section class="qcalc ncalc" id="nuCalc" style="--c:${color(name)}" aria-label="盟约层数计算器">
    <div class="top">
      <h4>层数计算器</h4>
      <select id="nuCovenant" aria-label="计算盟约">${options}</select>
      <label class="layer-value"><input class="lv" id="nuLayers" type="number" min="0" max="300" step="1" value="${layers}" aria-label="盟约层数">层</label>
      <input id="nuRange" type="range" min="0" max="300" step="1" value="${layers}" aria-label="拖动调整层数">
    </div>
    <div class="q">${LAYER_PRESETS.map(n => `<button type="button" data-layers="${n}" class="${n === layers ? 'on' : ''}" aria-pressed="${n === layers}">${n}</button>`)}</div>
    <div class="vals" id="nuValues">${layerValues(name, layers)}</div>
  </section>`;
}

/** 每回合作战时限柱状图；联合模拟 14 回合，险境及以上可追加隐秘核心 */
function roundTimeline(modeIndex) {
  const mode = MODES[modeIndex];
  const standard = mode === '标准';
  const rounds = 14;
  const maxSeconds = Math.max(...ROUND_TIME);
  const columns = range(rounds, 1).map(r => {
    const leader = r === rounds;
    const seconds = ROUND_TIME[r - 1];
    const kind = leader ? 'ld' : DECISION_ROUNDS[mode].includes(r) ? 'dec' : '';
    return html`<div class="${kind}">
      <div class="rt-bar" style="height:${seconds / maxSeconds * 100}%">
        <span class="s">${seconds}</span>
        <i class="b" style="animation-delay:${r * .03}s"></i>
      </div>
      <span class="r">${leader ? '领袖' : 'R' + r}</span>
    </div>`;
  });
  if (!standard) {
    columns.push('<div class="hid"><div class="rt-bar" style="height:100%"><span class="s">??</span><i class="b"></i></div><span class="r">核心</span></div>');
  }
  return columns.join('');
}

/** 领袖生命条，按当前难度从高到低 */
function leaderBars(modeIndex) {
  const hiddenOf = leader => modeIndex > 0 && leader.hiddenCore ? leader.hiddenCore[modeIndex - 1] : 0;
  const sorted = LEADERS.slice().sort((a, b) => b.hp[modeIndex] - a.hp[modeIndex]);
  const max = Math.max(...sorted.map(l => Math.max(l.hp[modeIndex], hiddenOf(l))));
  return sorted.map(leader => {
    const hp = leader.hp[modeIndex];
    const hidden = hiddenOf(leader);
    return html`<span class="nm" data-key="name:${esc(leader.name)}">${esc(leader.name)}</span>
      <div class="tr" data-key="hp:${esc(leader.name)}">
        <div class="m" style="width:${hp / max * 100}%"></div>
        <span>${wan(hp)}${hidden ? ' · 核心 ' + wan(hidden) : ''}</span>
      </div>`;
  }).join('');
}

const dispatchTable = () => {
  const levels = state.mode === 0 ? DISPATCH_BY_MODE[1] : DISPATCH_LEVELS;
  return html`<div class="lv6">
  <div class="h">等级</div>${levels.map(r => `<div class="t" data-t="${r.level}">${r.level}</div>`)}
  <div class="h">升级费用</div>${levels.map(r => `<div class="c">${r.upgradeCost ?? 'MAX'}</div>`)}
  <div class="h">干员栏</div>${levels.map(r => `<div class="sl">${'<u></u>'.repeat(r.operatorSlots)}</div>`)}
  <div class="h">最高等阶</div>${levels.map(r => `<div class="t" data-t="${r.level}">${TIER_LABELS[r.level]}</div>`)}
</div>`;
};

/** 下场发放的悬赏按资金分 6 列；其余发放方式单独列出 */
function bounties() {
  const columns = range(6).map(funds => html`<div>
    <div class="col">${BOUNTIES.filter(b => b.funds === funds && b.when === '下场').map((b, i) =>
      `<span style="animation-delay:${i * .03}s">${esc(b.name)}</span>`)}</div>
    <div class="h">${funds}</div>
  </div>`);
  const others = BOUNTIES.filter(b => b.when !== '下场').map(b =>
    `<span class="tag">${esc(b.name)} · <b class="num" style="color:var(--accent)">${b.funds}</b> · ${esc(b.when)}</span>`);
  return html`<div class="qbty">${columns}</div><div class="row mt">${others}</div>`;
}

const tierStatsTable = () => html`<div class="tw"><table>
  <tr><th>等阶</th><th>初始</th><th>精锐</th></tr>
  ${TIER_STATS.map(r => html`<tr>
    <td><span class="op" data-t="${r.tier}" style="padding:2px"><i>${TIER_LABELS[r.tier]}</i></span></td>
    <td>${r.base}</td><td>${r.elite}</td>
  </tr>`)}
</table></div>`;

const ownBonusTable = () => html`<div class="tw"><table>
  <tr><th>练度</th><th>攻击</th><th>防御</th><th>生命</th></tr>
  ${OWN_OPERATOR_BONUS.map(r =>
    `<tr><td>${r.level}</td><td class="n">${r.atk}</td><td class="n">${r.def}</td><td class="n">${r.hp}</td></tr>`)}
</table></div>`;

export default {
  id: 'nu',
  label: '数值',
  count: '',

  render() {
    const modeTabs = segmented(MODES, state.mode, 'nud');
    return html`${layerCalculator()}<div class="ng">
      <div class="nc">
        <h4>回合时限（秒）${modeTabs}</h4>
        <div class="rtl">${roundTimeline(state.mode)}</div>
        <div class="lgd">
          <span><i style="background:var(--accent)"></i>机变</span><span><i style="background:var(--red)"></i>领袖</span>
        </div>
      </div>
      <div class="nc"><h4>调度中心 · ${MODES[state.mode]}<span class="tag t">升级费用每回合 −1</span></h4>${dispatchTable()}</div>
      <div class="nc"><h4>领袖生命${modeTabs}</h4><div class="qldr">${leaderBars(state.mode)}</div></div>
      <div class="nc"><h4>机变 · 悬赏资金</h4>${bounties()}</div>
      <div class="nc"><h4>等阶练度</h4>${tierStatsTable()}</div>
      <div class="nc">
        <h4>自持干员加成</h4>${ownBonusTable()}
        <h4 class="mt">特训类型</h4>
        <div class="row">${TRAINING.map(t => `<span class="tag t">${t.name} · ${t.desc}</span>`)}</div>
      </div>
    </div>`;
  },

  /** 只更新计算器的数值；切换盟约时恢复该盟约在本次会话中使用的层数。 */
  mount() {
    const calculator = $('#nuCalc');
    const select = $('#nuCovenant', calculator);
    const slider = $('#nuRange', calculator);
    const input = $('#nuLayers', calculator);
    const presets = $$('[data-layers]', calculator);
    const draw = value => {
      if (!Number.isFinite(value)) return;
      const layers = Math.max(0, Math.min(300, Math.round(value)));
      const name = state.calculatorCovenant;
      state.layers[name] = layers;
      slider.value = layers;
      if (input.value !== String(layers)) input.value = layers;
      updateHTML($('#nuValues', calculator), layerValues(name, layers));
      presets.forEach(button => {
        const selected = +button.dataset.layers === layers;
        button.classList.toggle('on', selected);
        button.setAttribute('aria-pressed', String(selected));
      });
    };
    select.onchange = () => {
      state.calculatorCovenant = select.value;
      calculator.style.setProperty('--c', color(select.value));
      draw(state.layers[select.value] ?? 60);
    };
    slider.oninput = () => draw(slider.valueAsNumber);
    input.oninput = () => draw(input.valueAsNumber);
    // 清空输入时允许继续键入；离开输入框后恢复有效层数，避免显示 NaN。
    input.onchange = () => draw(Number.isFinite(input.valueAsNumber)
      ? input.valueAsNumber : state.layers[state.calculatorCovenant] ?? 60);
    presets.forEach(button => { button.onclick = () => draw(+button.dataset.layers); });
  },
};
