/** 第 4 章 盟约与叠层：激活门槛、层数转化、站位坐标、曲线计算与开局策略 */
import {
  ALL_COVENANTS,
  COVENANTS,
  CYCLE_REWARDS,
  HEADCOUNT_BREAKPOINTS,
  LAYER_BREAKPOINTS,
  RESERVE_COVENANTS,
  STRATEGIES,
  STRATEGY_CATEGORIES,
  isCoreCovenant,
  rosterOf,
} from '../../../data/index.ts';
import {covenantIconHtml} from '../../lib/ui/assets.ts';
import {esc, html, range} from '../../lib/ui/dom.ts';
import {color, cv, portrait} from '../chips.ts';

export type CovenantFilter = 'all' | 'core' | 'addon' | 'milestone';

export function covenantGrid(filter: CovenantFilter = 'all') {
  const pips = (n: number, c: string, filled = true) =>
    `<span class="pips" style="--c:${c}">${(filled ? '<i class="f"></i>' : '<i></i>').repeat(n)}</span>`;

  const headcountSet = new Set(HEADCOUNT_BREAKPOINTS.map((h) => h.covenant));
  const list = ALL_COVENANTS.filter((name) => {
    if (filter === 'core') return isCoreCovenant(name);
    if (filter === 'addon') return !isCoreCovenant(name);
    if (filter === 'milestone') {
      return Boolean(
        LAYER_BREAKPOINTS[name]?.length ||
        CYCLE_REWARDS[name] ||
        headcountSet.has(name),
      );
    }
    return true;
  });

  return list
    .map((name) => {
      const c = COVENANTS[name];
      const col = color(name);
      const badges: string[] = [];
      if (RESERVE_COVENANTS.has(name)) badges.push('备战席计入');
      if (CYCLE_REWARDS[name]) {
        badges.push(
          `每${CYCLE_REWARDS[name].every}层：${CYCLE_REWARDS[name].reward}`,
        );
      }
      for (const bp of LAYER_BREAKPOINTS[name] ?? []) {
        badges.push(`${bp.layers}层质变`);
      }
      return html`
        <div class="covc" data-key="${esc(name)}" style="--c:${col}">
          <div class="t">
            <span class="covc-nm">${covenantIconHtml(name)}${esc(name)}</span>
            <span class="row" style="gap:6px">
              ${pips(c.need, col)}${isCoreCovenant(name) && pips(3, col, false)}
              <span class="cnt">${rosterOf(name).length}人</span>
            </span>
          </div>
          <div>${esc(c.effect)}</div>
          ${c.bonus && `<div class="bg">${esc(c.bonus)}</div>`}
          ${
            badges.length > 0 &&
            `<div class="row" style="margin-top:4px">${badges.map((b) => `<span class="tag a">${esc(b)}</span>`).join('')}</div>`
          }
        </div>
      `;
    })
    .join('');
}

function stackDiagram(out: Record<string, string>) {
  const SCALE = 1.6;
  const STEPS: [string, number, number, string, string][] = [
    ['休整期', 40, 0, '', '永久底数 40'],
    ['战斗中', 40, 46, 'an', '击倒 +46 临时层'],
    ['下回合休整', 52, 0, '', '折桠/乌啾 转永久'],
    ['下一场战斗', 52, 46, 'an', '滚雪球越打越高'],
  ];
  out.stk = STEPS.map(
    ([label, fixed, temp, anim, note]) => html`
      <div class="col">
        <div class="bar" style="height:${(fixed + temp) * SCALE}px">
          <div class="fx" style="height:${fixed * SCALE}px"></div>
          ${
            temp > 0 &&
            `<div class="tp ${anim}" style="--h:${temp * SCALE}px;height:${temp * SCALE}px"></div>`
          }
        </div>
        <div class="cap">
          <b>${label}</b>
          ${note && `<br><span style="color:var(--accent)">${note}</span>`}
        </div>
      </div>
    `,
  ).join('');
}

export const POSITIONS: [string, [number, number][]][] = [
  ['身前一格', [[1, 1]]],
  [
    '身前两格',
    [
      [1, 1],
      [1, 2],
    ],
  ],
  ['身后一格', [[1, -1]]],
  [
    '周围四格',
    [
      [0, 0],
      [2, 0],
      [1, 1],
      [1, -1],
    ],
  ],
  [
    '周围八格',
    [
      [0, -1],
      [0, 0],
      [0, 1],
      [1, -1],
      [1, 1],
      [2, -1],
      [2, 0],
      [2, 1],
    ],
  ],
  [
    '同一行',
    [
      [1, -2],
      [1, -1],
      [1, 1],
      [1, 2],
    ],
  ],
];

/** 给定具有层数公式的盟约，返回 0–300 层的固定曲线、刻度、里程碑线和游标坐标。 */
export function covenantCurve(name: string) {
  const main = COVENANTS[name].scaling[0];
  const xs = (layer: number) => 46 + (layer / 300) * (428 - 46);
  const values = range(301).map((layer) => main.at(layer));
  const top = Math.max(...values) * 1.1 || 1;
  const bottom = Math.min(0, ...values);
  const ys = (value: number) =>
    228 - ((value - bottom) / (top - bottom)) * (228 - 18);
  const points = values.map((value, layer) => ({x: xs(layer), y: ys(value)}));
  const path =
    'M' + points.map(({x, y}) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L');
  const milestones = (LAYER_BREAKPOINTS[name] ?? [])
    .filter((bp) => bp.layers <= 300)
    .map((bp) => ({
      layers: bp.layers,
      x: xs(bp.layers),
      effect: bp.effect,
    }));
  return {
    main,
    points,
    path,
    area: path + ' L428,228 L46,228 Z',
    milestones,
    xTicks: [0, 50, 100, 150, 200, 250, 300].map((label) => ({
      label,
      x: xs(label),
    })),
    yTicks: range(5).map((index) => {
      const value = bottom + ((top - bottom) * index) / 4;
      return {label: Math.round(value), y: ys(value)};
    }),
    start: values[0],
    end: values[300],
  };
}

/** Format the selected strategy category and result count. */
export function strategies(i: number) {
  const out: Record<string, string> = {};
  const category = STRATEGY_CATEGORIES[i];
  const list = STRATEGIES.filter(
    (s) =>
      category === '全部' ||
      (category === '阵营'
        ? isCoreCovenant(s.category)
        : s.category === category),
  );
  out.stcnt = list.length + ' 名';
  out.stg = list
    .map(
      (s) => html`
        <div class="stc" data-key="${esc(s.name)}" data-st="${esc(s.name)}">
          <div class="t">
            <span class="stp">${portrait(s.name)}</span>
            <b>${esc(s.name)}</b>
            ${
              isCoreCovenant(s.category)
                ? cv(s.category)
                : `<span class="tag">${esc(s.category)}</span>`
            }
          </div>
          <div class="hp">
            <span>♥ ${s.hp}</span>
            <div class="tr">
              <div style="width:${((s.hp - 15) / 25) * 100}%"></div>
            </div>
          </div>
          <div>
            <span class="sk">${esc(s.skill)}</span>
            · ${esc(s.effect)}
          </div>
          <div>
            <span class="tag ${s.unlock === '初始' ? 't' : ''}">
              ${esc(s.unlock)}
            </span>
          </div>
        </div>
      `,
    )
    .join('');
  return out;
}

/** Return the fixed stack illustration. */
export function covenantContent() {
  const out: Record<string, string> = {};
  stackDiagram(out);
  return out;
}
