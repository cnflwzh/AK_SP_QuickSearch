/** 第 4 章 盟约进阶：激活门槛、层数、触发时机、站位、计算器、策略 */
import {
  COVENANTS, ALL_COVENANTS, STRATEGIES, STRATEGY_CATEGORIES,
  isCoreCovenant, rosterOf,
} from '../../../data/index';
import { html, range, round1 } from '../../lib/dom';
import { cv, portrait, color } from '../chips';

function covenantGrid(out: Record<string, string>) {
  const pips = (n: number, c: string, filled = true) =>
    `<span class="pips" style="--c:${c}">${(filled ? '<i class="f"></i>' : '<i></i>').repeat(n)}</span>`;
  out.covg = ALL_COVENANTS.map(name => {
    const c = COVENANTS[name];
    const col = color(name);
    return html`<div class="covc" style="--c:${col}">
      <div class="t">
        <span>${name}</span>
        <span class="row" style="gap:6px">
          ${pips(c.need, col)}${isCoreCovenant(name) && pips(3, col, false)}<span class="cnt">${rosterOf(name).length}人</span>
        </span>
      </div>
      ${c.effect}${c.bonus && `<div class="bg">${c.bonus}</div>`}
    </div>`;
  }).join('');
}

function stackDiagram(out: Record<string, string>) {
  const SCALE = 1.6;
  const STEPS: [string, number, number, string, string][] = [
    // [阶段, 固定层, 临时层, 动画, 说明]
    ['休整期', 40, 0, '', ''],
    ['战斗中', 40, 46, 'an', '击倒 +2 临时'],
    ['进入休整期', 52, 0, '', '折桠/乌啾 转化'],
    ['下一场', 52, 46, 'an', ''],
  ];
  out.stk = STEPS.map(([label, fixed, temp, anim, note]) => html`<div class="col">
    <div class="bar" style="height:${(fixed + temp) * SCALE}px">
      <div class="fx" style="height:${fixed * SCALE}px"></div>
      ${temp > 0 && `<div class="tp ${anim}" style="--h:${temp * SCALE}px;height:${temp * SCALE}px"></div>`}
    </div>
    <div class="cap">${label}${note && `<br><span style="color:var(--accent)">${note}</span>`}</div>
  </div>`).join('');
}

export const POSITIONS: [string, [number, number][]][] = [
  ['身前一格', [[1, 1]]],
  ['身前两格', [[1, 1], [1, 2]]],
  ['身后一格', [[1, -1]]],
  ['周围四格', [[0, 0], [2, 0], [1, 1], [1, -1]]],
  ['周围八格', [[0, -1], [0, 0], [0, 1], [1, -1], [1, 1], [2, -1], [2, 0], [2, 1]]],
  ['同一行', [[1, -2], [1, -1], [1, 1], [1, 2]]],
];

/** Calculate all displayed values and the main SVG curve for a covenant and layer count. */
export function calculator(name: string, L: number) {
 const out: Record<string, string> = {};
    const c = COVENANTS[name];
    out.cvLv = String(L);
    out.cvVals = c.scaling.map(s =>
      `<div><span>${s.label}</span><b>${round1(s.at(L))}<small style="font-size:14px;color:var(--ink2)">${s.unit}</small></b></div>`).join('');
    out.cvBase = c.effect;
    out.cvBig = c.bonus;

    // 曲线：x = 层数 0–300，y = 主数值
    const main = c.scaling[0];
    const f = main.at;
    const W = 440, x0 = 46, y0 = 228;
    const xs = (x: number) => x0 + x / 300 * (W - x0 - 12);
    const values = range(301).map(f);
    const top = Math.max(...values) * 1.1 || 1;
    const bottom = Math.min(0, ...values);
    const ys = (v: number) => y0 - (v - bottom) / (top - bottom) * (y0 - 18);

    let s = '';
    for (let k = 0; k <= 4; k++) {
      const v = bottom + (top - bottom) * k / 4;
      const y = ys(v);
      s += `<line class="gl" x1="${x0}" x2="${W - 12}" y1="${y}" y2="${y}"/><text class="axl" x="${x0 - 6}" y="${y + 4}" text-anchor="end">${Math.round(v)}</text>`;
    }
    [0, 50, 100, 150, 200, 250, 300].forEach(x => {
      s += `<text class="axl" x="${xs(x)}" y="${y0 + 18}" text-anchor="middle">${x}</text>`;
    });
    const points = values.map((v, x) => `${xs(x).toFixed(1)},${ys(v).toFixed(1)}`);
    s += `<path class="ar" d="M${xs(0)},${y0} L${points.slice(0, L + 1).join(' L')} L${xs(L)},${y0}Z"/>`
      + `<path class="ln" d="M${points.join(' L')}"/>`
      + `<line x1="${xs(L)}" x2="${xs(L)}" y1="${y0}" y2="${ys(f(L))}" stroke="var(--accent)" stroke-dasharray="3 3"/>`
      + `<circle class="dot" cx="${xs(L)}" cy="${ys(f(L))}" r="6"/>`
      + `<text class="axl" x="${x0}" y="12" style="fill:var(--ink2)">${main.label}（${main.unit}）</text>`
      + `<text class="axl" x="${W - 12}" y="${y0 - 6}" text-anchor="end">层数</text>`;
    const description = `横轴为 0 至 300 层，纵轴为${main.label}，单位${main.unit || '无'}。当前 ${L} 层：`
      + c.scaling.map(value => `${value.label} ${round1(value.at(L))}${value.unit}`).join('，')
      + `。${main.label}在 0 层为 ${round1(f(0))}${main.unit}，300 层为 ${round1(f(300))}${main.unit}。`;
    out.cvChart = `<desc id="covenant-chart-description">${description}</desc>` + s;
return out;
}
/** Format the selected strategy category and result count. */
export function strategies(i: number) {
 const out: Record<string, string> = {};
    const category = STRATEGY_CATEGORIES[i];
    const list = STRATEGIES.filter(s => category === '全部'
      || (category === '阵营' ? isCoreCovenant(s.category) : s.category === category));
    out.stcnt = list.length + ' 名';
    out.stg = list.map(s => html`<div class="stc" data-key="${s.name}">
      <div class="t">
        <span class="stp">${portrait(s.name)}</span><b>${s.name}</b>
        ${isCoreCovenant(s.category) ? cv(s.category) : `<span class="tag">${s.category}</span>`}
      </div>
      <div class="hp"><span>${s.hp}</span><div class="tr"><div style="width:${(s.hp - 15) / 25 * 100}%"></div></div></div>
      <div><span class="sk">${s.skill}</span>　${s.effect}</div>
      <div><span class="tag ${s.unlock === '初始' ? 't' : ''}">${s.unlock}</span></div>
    </div>`).join('');
return out;
}

/** Return the fixed covenant and stack illustrations. */
export function covenantContent() {
 const out: Record<string, string> = {};
 covenantGrid(out); stackDiagram(out);
 return out;
}
