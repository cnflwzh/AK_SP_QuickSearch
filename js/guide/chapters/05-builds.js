/** 第 5 章 流派：核心盟约流派面板 + 混搭流派卡片 */
import {
  CORE_BUILDS, MIXED_BUILDS, CORE_COVENANTS, COVENANTS, OPERATOR, TIERS, TIER_LABELS, rosterOf,
} from '../../../data/index.js';
import { $, html, range } from '../../lib/dom.js';
import { op, eq, st, cv, avatar, color } from '../chips.js';

/** 主数值在 0–150 层的迷你曲线 */
function sparkline(name) {
  const main = COVENANTS[name].scaling[0];
  if (!main) return '';
  const f = main.at;
  const values = range(151).map(f);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const points = values.map((v, x) => `${(x / 150 * 300).toFixed(1)},${(56 - (v - min) / ((max - min) || 1) * 50).toFixed(1)}`);
  return html`<svg class="spark" viewBox="0 0 300 60" preserveAspectRatio="none">
    <path class="a" d="M0,60 L${points.join(' L')} L300,60Z"/><path d="M${points.join(' L')}"/>
  </svg>
  <div class="row" style="justify-content:space-between;font-size:12px;color:var(--ink3)">
    <span>0 层 · ${Math.round(f(0))}${main.unit}</span><span>${main.label}</span><span>150 层 · ${Math.round(f(150))}${main.unit}</span>
  </div>`;
}

function drawBuild(name) {
  const build = CORE_BUILDS[name];
  const roster = rosterOf(name);
  const covenant = COVENANTS[name];

  // 全部干员按等阶分行，终盘阵容高亮
  const tierRows = TIERS.map(tier => {
    const list = roster.filter(o => o.tier === tier);
    if (!list.length) return '';
    return html`<div class="tr"><i data-t="${tier}">${TIER_LABELS[tier]}</i>
      <div class="row">${list.map(o => op(o.name, build.lineup.includes(o.name) ? 'hl' : ''))}</div>
    </div>`;
  }).join('');

  // 终盘 8 人，C = 核心输出
  const lineup = build.lineup.map(n => {
    const tier = OPERATOR[n].tier;
    return `<div class="${build.carries.includes(n) ? 'c' : ''}" data-t="${tier}">${avatar(n)}<i>${TIER_LABELS[tier]}</i>${n}</div>`;
  });

  $('#bpanel').innerHTML = html`<div class="bp" style="--c:${color(name)}">
    <div class="bp-h">
      <div><h3>${name}</h3><div class="tg">${build.tagline}</div></div>
      <div style="min-width:min(100%,300px);flex:1;max-width:420px">${sparkline(name)}</div>
    </div>
    <div class="bp-grid">
      <div>
        <p class="lab">ROSTER · 按等阶</p>
        <div class="tierrows">${tierRows}</div>
        <p class="lab" style="margin-top:16px">盟约效果</p>
        <div style="font-size:13px;color:var(--ink2)">${covenant.effect}</div>
        <div style="font-size:13px;margin-top:4px">${covenant.bonus}</div>
      </div>
      <div>
        <p class="lab">终局 8 人</p>
        <div class="fin">${lineup}</div>
        <p class="lab" style="margin-top:16px">运营</p>
        <ol class="steps">${build.tips.map(t => `<li>${t}</li>`)}</ol>
        <p class="lab" style="margin-top:16px">附加盟约</p>
        <div class="row">${build.addons.map(cv)}</div>
        <p class="lab" style="margin-top:12px">策略</p>
        <div class="row">${build.strategies.map(st)}</div>
        <p class="lab" style="margin-top:12px">装备</p>
        <div class="row">${build.equipment.map(n => eq(n))}</div>
      </div>
    </div>
  </div>`;
}

export function initBuilds() {
  const DEFAULT = '乌萨斯';
  const tabs = $('#btabs');
  tabs.innerHTML = CORE_COVENANTS.map(n =>
    `<button type="button" style="--c:${color(n)}" data-n="${n}" class="${n === DEFAULT ? 'on' : ''}">${n}</button>`).join('');
  tabs.onclick = e => {
    const b = e.target.closest('button');
    if (!b) return;
    [...tabs.children].forEach(c => c.classList.toggle('on', c === b));
    drawBuild(b.dataset.n);
  };
  drawBuild(DEFAULT);

  $('#hyb').innerHTML = MIXED_BUILDS.map(b => html`<div class="card">
    <h5>${b.name}</h5>
    <div class="sub">${b.tagline}</div>
    <div class="row">${b.lineup.map(n => op(n))}</div>
    <div class="row mt">${b.strategies.map(st)}</div>
    <div class="row mt">${b.equipment.map(n => eq(n))}</div>
    <ol class="steps mt" style="--c:var(--accent)">${b.tips.map(t => `<li>${t}</li>`)}</ol>
  </div>`).join('');
}
