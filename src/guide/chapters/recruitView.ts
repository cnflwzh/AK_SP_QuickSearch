/** 第 2 章 招募与升本：调度中心、精锐、卡池、阵型、装备 */
import {
  CORE_COVENANTS,
  RECRUIT_EXAMPLES,
  OPERATORS,
  OPERATOR,
  EQUIP,
  DISPATCH_LEVELS,
  DISPATCH_BY_MODE,
  TIER_STATS,
  TIER_LABELS,
  TIERS,
  SEASON_META,
  EQUIPMENT_COMBOS,
  operatorEliteCopies,
} from '../../../data/index.ts';
import {esc, html, range} from '../../lib/ui/dom.ts';
import {tokenizeTrait, traitLabel} from '../../lib/ui/traitText.ts';
import {glossaryHtml} from '../../lib/ui/glossaryText.ts';
import {avatarSrc} from '../../lib/ui/assets.ts';
import {op, eq, st, cv, avatar, tierBadge} from '../chips.ts';

/** Format the selected dispatch mode table with its original upgrade and slot rules. */
export function dispatchTable(mode: number) {
  const out: Record<string, string> = {};
  const levels = DISPATCH_BY_MODE[mode];
  const row = (label: string, cell: (row: (typeof levels)[number]) => string) =>
    `<tr><td>${label}</td>${levels.map(cell).join('')}</tr>`;
  out.shopTbl =
    `<tr><th>调度中心等级</th>${levels.map((r) => `<th>${r.level} 本</th>`).join('')}</tr>` +
    row(
      '初始升本费（每回合−1）',
      (r) => `<td class="n">${r.upgradeCost ?? 'MAX'}</td>`,
    ) +
    row('干员刷新栏位', (r) => `<td class="n">${r.operatorSlots}</td>`) +
    row('装备刷新栏位', (r) => `<td class="n">${r.equipmentSlots}</td>`) +
    row('可刷最高等阶', (r) => `<td>${tierBadge(r.level)}</td>`);
  return out.shopTbl;
}

function tierStatsTable(out: Record<string, string>) {
  out.tierTbl =
    '<tr><th>等阶</th><th>购买价</th><th>初始状态练度</th><th>三合一精锐练度</th></tr>' +
    TIER_STATS.map((r) => {
      const baseCost = SEASON_META.tierBasePrices[r.tier];
      return `<tr><td>${tierBadge(r.tier)}</td><td class="n">${baseCost}</td><td>${r.base}</td><td><b>${r.elite}</b></td></tr>`;
    }).join('');
}

const highlightTrait = (text: string) =>
  tokenizeTrait(text).map(part => {
    const label = esc(traitLabel(part));
    if (part.kind === 'trigger') return '<span class="tg">' + label + '</span>';
    if (part.kind === 'num') return '<b>' + label + '</b>';
    return label;
  }).join('');

/** Format initial and elite traits for the supplied operator name. */
export function eliteComparison(name: string) {
  const out: Record<string, string> = {};
  const o = OPERATOR[name];
  if (!o) return '';
  const stats = TIER_STATS.find((row) => row.tier === o.tier);
  if (!stats) return '';
  const copies = operatorEliteCopies(o);
  out.elOut = html`
    <div class="elc">
      <div class="elh">
        ${op(o.name)}
        <span class="tag">初始</span>
      </div>
      <div class="els">${stats.base}</div>
      <div class="elt">${highlightTrait(o.trait)}</div>
    </div>
    <div class="elarr">
      ▼ ${copies === 2 ? '二' : copies === 3 ? '三' : copies}合一晋升
    </div>
    <div class="elc el">
      <div class="elh">
        ${op(o.name, 'el')}
        <span class="tag a">精锐</span>
      </div>
      <div class="els">${stats.elite}</div>
      <div class="elt">${highlightTrait(o.elite)}</div>
    </div>
  `;
  return out.elOut;
}

function eliteDetails(out: Record<string, string>) {
  const COSTS: [string, number][] = [
    ['Ⅰ阶 ×3', 6],
    ['Ⅱ–Ⅳ阶 ×3', 9],
    ['Ⅴ–Ⅵ阶 ×3', 12],
    ['真理 / 至简 ×3', 3],
    ['星极 ×2', 6],
    ['3费×2 + 拟态物质', 10],
    ['3费 + 博士投影', 8],
  ];
  out.elCost = COSTS.map(
    ([label, funds]) => html`
      <div class="hb" style="grid-template-columns:8.2em 1fr 2em">
        <span>${label}</span>
        <div class="hb-t">
          <div class="hb-f" style="width:${(funds / 12) * 100}%"></div>
        </div>
        <span class="hb-v">${funds}</span>
      </div>
    `,
  ).join('');

  out.elFx = html`
    <div class="fxr">
      <span class="tag a">绝技计数</span>
      <div class="row">
        ${cv('绝技')}
        <span>场上 2 精锐 +30% 攻 · 5 精锐技力消耗 −30%</span>
      </div>
    </div>
    <div class="fxr">
      <span class="tag a">策略联动</span>
      <div class="row">${st('伊奥莱塔·罗素')}${st('陈')}${st('复奏')}</div>
    </div>
    <div class="fxr">
      <span class="tag t">直升精锐</span>
      <div class="row">
        ${eq('博士投影')}${eq('拟态物质')}${st('缪尔赛思')}${st('大嘴莫布')}
      </div>
    </div>
    <div class="fxr">
      <span class="tag t">两张即合</span>
      <div class="row">
        ${op('星极')}
        <span>仅需 2 张同名即可晋升精锐</span>
      </div>
    </div>
  `;
}

const poolAvatar = (name: string, className = '') =>
  `<img class="${className}" src="${avatarSrc(name)}" alt="${esc(name)}" title="${esc(name)}" width="80" height="80" loading="lazy">`;

/** Format the shared-pool example; a nonzero value enables the contested example. */
export function poolDiagram(contested: number) {
  const out: Record<string, string> = {};
  const SAMPLE = RECRUIT_EXAMPLES.operator;
  const [primary, second, third, fourth] = RECRUIT_EXAMPLES.factions;
  const PLAYERS: Record<string, [string, string, number][]> = {
    solo: [
      ['你', primary, 3],
      ['队友 1', second, 0],
      ['队友 2', third, 0],
      ['队友 3', fourth, 0],
    ],
    contested: [
      ['你', primary, 2],
      ['队友 1', primary, 1],
      ['队友 2', third, 0],
      ['队友 3', fourth, 0],
    ],
  };

  const players = contested ? PLAYERS.contested : PLAYERS.solo;
  const playerCard = (
    [who, covenant, got]: [string, string, number],
    i: number,
  ) => html`
    <div class="pvp ${i ? '' : 'me'}">
      <b>${who}</b>
      ${cv(covenant)}
      <div class="got">${range(got).map(() => poolAvatar(SAMPLE))}</div>
      <span class="cnt">${got ? got + ' / 3' : '不抢卡'}</span>
    </div>
  `;
  out.poolV = html`
    <div class="pvpool">
      <span class="lab" style="margin:0">
        假设共享卡池里只剩最后 3 张 ${SAMPLE}
      </span>
      <div class="row">${range(3).map(() => poolAvatar(SAMPLE, 'gone'))}</div>
    </div>
    <div class="pvarr">▼ ▼ ▼</div>
    <div class="pvpl">${players.map(playerCard)}</div>
    <p
      style="margin:2px 0 0;font-size:13px;font-weight:600;color:${contested ? 'var(--red)' : 'var(--teal)'}">
      ${
        contested
          ? '你卡在 2 张对子 · 队友拿走 1 张 → 两边都卡死合不出精锐！'
          : '4 人各走不同阵营 → 3 张全归你，顺利三合一！'
      }
    </p>
  `;
  return out.poolV;
}

function poolDetails(out: Record<string, string>) {
  const KEPT = RECRUIT_EXAMPLES.kept;
  const REMOVED = CORE_COVENANTS.filter((name) => !KEPT.includes(name));
  out.soloSplit = html`
    <div class="split">
      <div class="ok">
        <b>✔ 选定保留组（${KEPT.length} 大核心）</b>
        <div class="row">${KEPT.map(cv)}</div>
        <div class="row">${RECRUIT_EXAMPLES.keptOperators.map((n) => op(n))}</div>
        <span class="cnt">整局正常刷出</span>
      </div>
      <div class="no">
        <b>✕ 未选组（整局移出）</b>
        <div class="row">${REMOVED.map(cv)}</div>
        <div class="row">${RECRUIT_EXAMPLES.removedOperators.map((n) => op(n))}</div>
        <span class="cnt">不占卡池名额</span>
      </div>
    </div>
  `;

  out.tierMx = html`
    <div class="mx">
      <div class="h">等级</div>
      ${TIERS.map((t) => `<div class="h">${TIER_LABELS[t]}</div>`)}
      <div class="h">干员栏</div>
      ${DISPATCH_LEVELS.map(
        (r) => html`
          <div class="h">${r.level}本</div>
          ${TIERS.map(
            (t) =>
              `<div data-t="${t}" class="${t <= r.level ? 'on' : 'off'}">${t <= r.level ? TIER_LABELS[t] : '·'}</div>`,
          )}
          <div class="num" style="font-size:16px">${r.operatorSlots}</div>
        `,
      )}
    </div>
  `;

  const before = ['乌啾', '拜松', '慕斯'];
  const after = ['角峰', '深靛', '雪猎'];
  const strip = (names: readonly string[], cls = '') =>
    names.map((n) => poolAvatar(n, cls)).join('');
  out.rfx = html`
    <span class="tag a">${glossaryHtml('刷新')} −1</span>
    <div class="ms">
      ${strip(before)}
      <span class="ar">▶</span>
      ${strip(after)}
      <span class="cnt">整排换新</span>
    </div>
    <span class="tag t">${glossaryHtml('冻结商店')} ❄</span>
    <div class="ms">
      ${strip(before, 'lk')}
      <span class="ar">▶ 下回合</span>
      ${strip(before, 'lk')}
      <span class="cnt">原样保留（空位补满）</span>
    </div>
    <span class="tag">不冻结</span>
    <div class="ms">
      ${strip(before)}
      <span class="ar">▶ 下回合</span>
      ${strip(after)}
      <span class="cnt">免费自动换新</span>
    </div>
  `;

  out.rfChips = html`
    <div class="fxr">
      <span class="tag t">免费刷新</span>
      <div class="row">${cv('奇迹')}${op('忍冬')}${op('奥斯塔')}</div>
    </div>
    <div class="fxr">
      <span class="tag t">定向找牌</span>
      <div class="row">
        ${op('灵知')}${eq('人事部记录')}${st('雅拉')}${st('杜遥夜')}${st('渡桥')}
      </div>
    </div>
    <div class="fxr">
      <span class="tag a">刷新叠层</span>
      <div class="row">
        ${op('复奏')}${op('安洁莉娜')}${st('裁度')}${st('贾维')}
      </div>
    </div>
  `;
}

function formation(out: Record<string, string>) {
  const LINEUP = RECRUIT_EXAMPLES.lineup;
  out.dgrid = range(12)
    .map((i) => {
      if (i < LINEUP.length)
        return `<div style="animation-delay:${i * 0.45}s"><span class="dn">${i + 1}</span>${avatar(LINEUP[i])}</div>`;
      if (i === LINEUP.length) return '<div class="g">+9</div>';
      return '<div class="g" style="visibility:hidden"></div>';
    })
    .join('');

  const BENCH = RECRUIT_EXAMPLES.bench;
  out.benchDemo = range(15)
    .map((i) => {
      const name = BENCH[i];
      if (i >= 10)
        return '<div class="b x" style="cursor:default">装备格</div>';
      if (!name) return `<div class="b x"></div>`;
      const tier = OPERATOR[name].tier;
      return `<div class="b hasava" data-t="${tier}" style="cursor:default">${avatar(name)}<i>${TIER_LABELS[tier]}</i>${name}</div>`;
    })
    .join('');

  const mentioning = (keyword: string) =>
    OPERATORS.filter((o) => (o.trait + o.elite).includes(keyword)).map(
      (o) => o.name,
    );
  const onDeploy = OPERATORS.filter((o) => o.trait.includes('部署时')).map(
    (o) => o.name,
  );
  const ops = (names: readonly string[]) => names.map((n) => op(n)).join('');

  out.ordFx = html`
    <div class="fxr">
      <span class="tag a">部署时触发</span>
      <div class="row">${ops(onDeploy)}</div>
    </div>
    <div class="fxr">
      <span class="tag a">反复部署流</span>
      <div class="row">
        ${cv('卡西米尔')}
        <span>每次部署全体卡西米尔 +20% 攻</span>
        ${st('大帝')}
        <span>再部署 −50%</span>
      </div>
    </div>
    <div class="fxr">
      <span class="tag a">身前一格</span>
      <div class="row">
        ${cv('阿戈尔')}
        <span>开战吞噬身前口粮</span>
        ${ops(mentioning('身前一格').slice(0, 8))}
        <a class="tag t" href="#s44" style="text-decoration:none">
          去 4.4 看朝向图 ▸
        </a>
      </div>
    </div>
    <div class="fxr">
      <span class="tag a">同一行联动</span>
      <div class="row">${ops(mentioning('同一行'))}</div>
    </div>
    <div class="fxr">
      <span class="tag t">放备战席生效</span>
      <div class="row">${ops(mentioning('在整备区也生效'))}</div>
    </div>
  `;
}

function equipmentCombos(out: Record<string, string>) {
  out.combos = EQUIPMENT_COMBOS.map(
    ([a, b, result]) => html`
      <div class="combo-card">
        <div class="combo">
          ${eq(a)}
          <span class="pl">＋</span>
          ${eq(b)}
          <span class="pl">＝</span>
          ${eq(result)}
        </div>
        <div class="combo-fx">${esc(EQUIP[result].effect)}</div>
      </div>
    `,
  ).join('');
}

/** Return the fixed recruitment, formation, and equipment illustrations. */
export function recruitContent() {
  const out: Record<string, string> = {};
  tierStatsTable(out);
  eliteDetails(out);
  poolDetails(out);
  formation(out);
  equipmentCombos(out);
  return out;
}
