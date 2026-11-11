/** 第 4 章 盟约进阶：激活门槛、层数、触发时机、站位、计算器、策略 */
import {
  OPERATORS, COVENANTS, ALL_COVENANTS, STRATEGIES, STRATEGY_CATEGORIES,
  isCoreCovenant, rosterOf,
} from '../../../data/index.js';
import { $, $$, html, range, round1 } from '../../lib/dom.js';
import { updateHTML } from '../../lib/update-html.js';
import { op, cv, portrait, color, mountSegmented } from '../chips.js';

/** 4.1 盟约卡片：实心圆 = 激活人数，空心圆 = 核心盟约强化还需的人数 */
function covenantGrid() {
  const pips = (n, c, filled = true) =>
    `<span class="pips" style="--c:${c}">${(filled ? '<i class="f"></i>' : '<i></i>').repeat(n)}</span>`;
  $('#covg').innerHTML = ALL_COVENANTS.map(name => {
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

/** 4.2 固定层数与临时层数的变化示意 */
function stackDiagram() {
  const SCALE = 1.6;
  const STEPS = [
    // [阶段, 固定层, 临时层, 动画, 说明]
    ['休整期', 40, 0, '', ''],
    ['战斗中', 40, 46, 'an', '击倒 +2 临时'],
    ['进入休整期', 52, 0, '', '折桠/乌啾 转化'],
    ['下一场', 52, 46, 'an', ''],
  ];
  $('#stk').innerHTML = STEPS.map(([label, fixed, temp, anim, note]) => html`<div class="col">
    <div class="bar" style="height:${(fixed + temp) * SCALE}px">
      <div class="fx" style="height:${fixed * SCALE}px"></div>
      ${temp > 0 && `<div class="tp ${anim}" style="--h:${temp * SCALE}px;height:${temp * SCALE}px"></div>`}
    </div>
    <div class="cap">${label}${note && `<br><span style="color:var(--accent)">${note}</span>`}</div>
  </div>`).join('');
}

/** 4.3 特质触发时机：按钮显示该时机的干员数，点击列出干员 */
const TRIGGERS = [
  ['进入休整期', ['<进入休整期时>', '<休整期开始时>']],
  ['获得时', ['<获得时>']],
  ['刷新时', ['<刷新时>']],
  ['售出时', ['<售出时>']],
  ['休整期结束', ['<休整期结束时>']],
  ['战斗开始', ['<战斗开始时>']],
  ['战斗中', ['<战斗中>']],
  ['战斗结束', ['<战斗结束时>']],
];

function triggerTimeline() {
  const lists = TRIGGERS.map(([, tags]) => OPERATORS.filter(o => tags.some(t => o.trait.includes(t))));
  const el = $('#trig');
  el.innerHTML = '<div class="zone z1">休整期内</div><div class="zone z2">边界</div><div class="zone z3">作战阶段</div>'
    + TRIGGERS.map(([label], i) => `<button type="button" data-i="${i}"><b>${lists[i].length}</b>${label}</button>`).join('');

  const select = i => {
    $$('button', el).forEach(b => b.classList.toggle('on', +b.dataset.i === i));
    updateHTML($('#tlist'), lists[i]
      .sort((a, b) => a.tier - b.tier)
      .map(o => `<div data-key="${o.name}">${op(o.name)}${o.trait.replace(/<[^>]+>/g, '')}</div>`).join(''));
  };
  el.onclick = e => {
    const b = e.target.closest('button');
    if (b && !b.classList.contains('on')) select(+b.dataset.i);
  };
  select(4);
}

/** 4.4 站位关系。坐标为 [行, 列偏移]，自己在第 1 行第 2 列；朝右为正方向 */
const POSITIONS = [
  ['身前一格', [[1, 1]]],
  ['身前两格', [[1, 1], [1, 2]]],
  ['身后一格', [[1, -1]]],
  ['周围四格', [[0, 0], [2, 0], [1, 1], [1, -1]]],
  ['周围八格', [[0, -1], [0, 0], [0, 1], [1, -1], [1, 1], [2, -1], [2, 0], [2, 1]]],
  ['同一行', [[1, -2], [1, -1], [1, 1], [1, 2]]],
];

function positions() {
  let current = 0;
  const draw = () => {
    const dir = $('#mirror').checked ? -1 : 1;   // 右侧玩家方向镜像
    const [keyword, offsets] = POSITIONS[current];
    const lit = offsets.map(([r, c]) => r + ',' + (2 + c * dir));
    let cells = '';
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 5; c++) {
        const me = r === 1 && c === 2;
        cells += `<div class="${me ? 'me' : ''} ${lit.includes(r + ',' + c) ? 'on' : ''}">${me ? (dir > 0 ? '▶' : '◀') : ''}</div>`;
      }
    }
    updateHTML($('#pos'), cells);

    const matched = OPERATORS.filter(o => (o.trait + o.elite).includes(keyword));
    $('#posTitle').textContent = keyword + ' · ' + matched.length + ' 名';
    const extra = {
      周围四格: '<span class="cv" style="--c:var(--accent)">灵巧盟约</span>',
      周围八格: '<span class="cv" style="--c:var(--accent)">灵巧 40 层</span>',
    }[keyword] || '';
    updateHTML($('#posOps'), matched.map(o => op(o.name)).join('') + extra);
  };
  mountSegmented($('#posseg'), POSITIONS.map(p => p[0]), 0, i => { current = i; draw(); });
  $('#mirror').onchange = draw;
}

/** 4.5 盟约数值计算器：选盟约、拖层数，右侧画主数值曲线 */
function calculator() {
  const select = $('#cvSel');
  const slider = $('#cvL');
  select.innerHTML = Object.keys(COVENANTS)
    .filter(n => COVENANTS[n].scaling.length)
    .map(n => `<option>${n}</option>`).join('');
  select.value = '乌萨斯';

  const draw = () => {
    const c = COVENANTS[select.value];
    const L = +slider.value;
    $('#cvLv').textContent = L;
    updateHTML($('#cvVals'), c.scaling.map(s =>
      `<div><span>${s.label}</span><b>${round1(s.at(L))}<small style="font-size:14px;color:var(--ink2)">${s.unit}</small></b></div>`).join(''));
    $('#cvBase').textContent = c.effect;
    $('#cvBig').textContent = c.bonus;

    // 曲线：x = 层数 0–300，y = 主数值
    const main = c.scaling[0];
    const f = main.at;
    const W = 440, x0 = 46, y0 = 228;
    const xs = x => x0 + x / 300 * (W - x0 - 12);
    const values = range(301).map(f);
    const top = Math.max(...values) * 1.1 || 1;
    const bottom = Math.min(0, ...values);
    const ys = v => y0 - (v - bottom) / (top - bottom) * (y0 - 18);

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
    updateHTML($('#cvChart'), s);
  };
  select.onchange = draw;
  slider.oninput = draw;
  draw();
}

/** 4.6 策略列表，按分类筛选 */
function strategies() {
  mountSegmented($('#stseg'), STRATEGY_CATEGORIES, 0, i => {
    const category = STRATEGY_CATEGORIES[i];
    const list = STRATEGIES.filter(s => category === '全部'
      || (category === '阵营' ? isCoreCovenant(s.category) : s.category === category));
    $('#stcnt').textContent = list.length + ' 名';
    updateHTML($('#stg'), list.map(s => html`<div class="stc" data-key="${s.name}">
      <div class="t">
        <span class="stp">${portrait(s.name)}</span><b>${s.name}</b>
        ${isCoreCovenant(s.category) ? cv(s.category) : `<span class="tag">${s.category}</span>`}
      </div>
      <div class="hp"><span>${s.hp}</span><div class="tr"><div style="width:${(s.hp - 15) / 25 * 100}%"></div></div></div>
      <div><span class="sk">${s.skill}</span>　${s.effect}</div>
      <div><span class="tag ${s.unlock === '初始' ? 't' : ''}">${s.unlock}</span></div>
    </div>`).join(''));
  });
}

export function initCovenants() {
  covenantGrid();
  stackDiagram();
  triggerTimeline();
  positions();
  calculator();
  strategies();
}
