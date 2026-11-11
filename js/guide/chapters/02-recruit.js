/** 第 2 章 招募与升本：调度中心、精锐、卡池、阵型、装备 */
import {
  OPERATORS, OPERATOR, EQUIP, DISPATCH_LEVELS, TIER_STATS, TIER_LABELS, TIERS, EQUIPMENT_COMBOS,
} from '../../../data/index.js';
import { $, html, range } from '../../lib/dom.js';
import { avatarSrc } from '../../lib/assets.js';
import { op, eq, st, cv, avatar, tierBadge, mountSegmented } from '../chips.js';
import { initShopSimulator } from './shop-simulator.js';

/** 2.2 调度中心等级表 */
function dispatchTable() {
  const row = (label, cell) => `<tr><td>${label}</td>${DISPATCH_LEVELS.map(cell).join('')}</tr>`;
  $('#shopTbl').innerHTML = `<tr><th>等级</th>${DISPATCH_LEVELS.map(r => `<th>${r.level}</th>`).join('')}</tr>`
    + row('升级费用', r => `<td class="n">${r.upgradeCost ?? 'MAX'}</td>`)
    + row('干员栏位', r => `<td class="n">${r.operatorSlots}</td>`)
    + row('装备栏位', r => `<td class="n">${r.equipmentSlots}</td>`)
    + row('最高等阶', r => `<td>${tierBadge(r.level)}</td>`);
}

/** 2.3 各等阶练度 */
function tierStatsTable() {
  $('#tierTbl').innerHTML = '<tr><th>等阶</th><th>初始</th><th>精锐</th></tr>'
    + TIER_STATS.map(r => `<tr><td>${tierBadge(r.tier)}</td><td>${r.base}</td><td>${r.elite}</td></tr>`).join('');
}

/** 特质文本：数字加粗，<时机> 上色 */
const highlightTrait = text => text
  .replace(/<([^>]+)>/g, '\u0001$1\u0002')
  .replace(/(\d+(?:\.\d+)?%?)/g, '<b>$1</b>')
  .replace(/\u0001([^\u0002]+)\u0002/g, '<span class="tg">$1</span>');

/** 2.3 精锐前后对比 / 成本 / 额外价值 */
function elite() {
  const select = $('#elSel');
  select.innerHTML = TIERS.map(t => html`<optgroup label="${TIER_LABELS[t]} 阶">
    ${OPERATORS.filter(o => o.tier === t).map(o => `<option>${o.name}</option>`)}
  </optgroup>`).join('');
  select.value = '乌啾';

  const draw = () => {
    const o = OPERATOR[select.value];
    const stats = TIER_STATS[o.tier - 1];
    $('#elOut').innerHTML = html`
      <div class="elc">
        <div class="elh">${op(o.name)}<span class="tag">初始</span></div>
        <div class="els">${stats.base}</div>
        <div class="elt">${highlightTrait(o.trait)}</div>
      </div>
      <div class="elarr">▼ 三合一</div>
      <div class="elc el">
        <div class="elh">${op(o.name, 'el')}<span class="tag a">精锐</span></div>
        <div class="els">${stats.elite}</div>
        <div class="elt">${highlightTrait(o.elite)}</div>
      </div>`;
  };
  select.onchange = draw;
  draw();

  const COSTS = [
    ['3 张普通干员', 9], ['真理 / 至简 ×3', 3], ['星极 ×2', 6], ['2 张 + 拟态物质', 10], ['1 张 + 博士投影', 8],
  ];
  $('#elCost').innerHTML = COSTS.map(([label, funds]) => html`<div class="hb" style="grid-template-columns:8em 1fr 2em">
    <span>${label}</span><div class="hb-t"><div class="hb-f" style="width:${funds * 10}%"></div></div><span class="hb-v">${funds}</span>
  </div>`).join('');

  $('#elFx').innerHTML = html`
    <div class="fxr"><span class="tag a">计数</span><div class="row">${cv('绝技')}<span>2 精锐 +30% 攻 · 5 精锐技力 −30%</span></div></div>
    <div class="fxr"><span class="tag a">策略加成</span><div class="row">${st('伊奥莱塔·罗素')}${st('陈')}${st('复奏')}</div></div>
    <div class="fxr"><span class="tag t">直接精锐</span><div class="row">${eq('博士投影')}${eq('拟态物质')}${st('缪尔赛思')}${st('大嘴莫布')}</div></div>
    <div class="fxr"><span class="tag t">少一张</span><div class="row">${op('星极')}<span>2 合 1</span></div></div>`;
}

/** 卡池示意用的小头像 */
const poolAvatar = (name, className = '', delay = 0) =>
  `<img class="${className}" src="${avatarSrc(name)}" alt="${name}" title="${name}" width="80" height="80" loading="lazy" style="animation-delay:${delay}s">`;

/** 2.4 卡池：联合模拟共享卡池 / 个人模拟二选一 / 商店等阶 / 刷新与冻结 */
function cardPool() {
  const SAMPLE = '乌啾';
  const PLAYERS = {
    solo: [['你', '乌萨斯', 3], ['队友 1', '炎', 0], ['队友 2', '谢拉格', 0], ['队友 3', '叙拉古', 0]],
    contested: [['你', '乌萨斯', 2], ['队友 1', '乌萨斯', 1], ['队友 2', '谢拉格', 0], ['队友 3', '叙拉古', 0]],
  };

  mountSegmented($('#poolSeg'), ['只有你玩乌萨斯', '队友也玩乌萨斯'], 0, contested => {
    const players = contested ? PLAYERS.contested : PLAYERS.solo;
    let order = 0;   // 依次飞入的动画延迟
    const playerCard = ([who, covenant, got], i) => html`<div class="pvp ${i ? '' : 'me'}">
      <b>${who}</b>${cv(covenant)}
      <div class="got">${range(got).map(() => poolAvatar(SAMPLE, '', .25 + (order++) * .35))}</div>
      <span class="cnt">${got ? got + ' / 3' : ''}</span>
    </div>`;
    $('#poolV').innerHTML = html`
      <div class="pvpool">
        <span class="lab" style="margin:0">例：卡池剩 3 张${SAMPLE}</span>
        <div class="row">${range(3).map(() => poolAvatar(SAMPLE, 'gone'))}</div>
      </div>
      <div class="pvarr">▼ ▼ ▼</div>
      <div class="pvpl">${players.map(playerCard)}</div>
      <div class="row">${contested
        ? '<span class="tag r">你 2 张 · 队友 1 张 → 谁都合不成精锐</span>'
        : '<span class="tag t">3 张全归你 → 合成精锐</span>'}</div>`;
  });

  const KEPT = ['炎', '维多利亚', '阿戈尔', '卡西米尔', '伊比利亚'];
  const REMOVED = ['萨尔贡', '谢拉格', '叙拉古', '乌萨斯', '莱塔尼亚'];
  $('#soloSplit').innerHTML = html`<div class="split">
    <div class="ok">
      <b>✔ 选这一组</b>
      <div class="row">${KEPT.map(cv)}</div>
      <div class="row">${['斯卡蒂', '玛恩纳', '黍'].map(n => op(n))}</div>
      <span class="cnt">留在卡池</span>
    </div>
    <div class="no">
      <b>✕ 另一组</b>
      <div class="row">${REMOVED.map(cv)}</div>
      <div class="row">${['塔露拉', '真言', '锏'].map(n => op(n))}</div>
      <span class="cnt">干员移出卡池</span>
    </div>
  </div>`;

  $('#tierMx').innerHTML = html`<div class="mx">
    <div class="h">等级</div>${TIERS.map(t => `<div class="h">${TIER_LABELS[t]}</div>`)}<div class="h">干员栏</div>
    ${DISPATCH_LEVELS.map(r => html`<div class="h">Lv${r.level}</div>
      ${TIERS.map(t => `<div data-t="${t}" class="${t <= r.level ? 'on' : 'off'}">${t <= r.level ? TIER_LABELS[t] : '·'}</div>`)}
      <div class="num" style="font-size:16px">${r.operatorSlots}</div>`)}
  </div>`;

  const before = ['乌啾', '拜松', '慕斯'];
  const after = ['角峰', '深靛', '雪猎'];
  const strip = (names, cls) => names.map(n => poolAvatar(n, cls)).join('');
  $('#rfx').innerHTML = html`
    <span class="tag a">刷新 −1</span>
    <div class="ms">${strip(before)}<span class="ar">▶</span>${strip(after)}<span class="cnt">整排换新</span></div>
    <span class="tag t">冻结 ❄</span>
    <div class="ms">${strip(before, 'lk')}<span class="ar">▶ 下回合</span>${strip(before, 'lk')}<span class="cnt">原样保留</span></div>
    <span class="tag">不冻结</span>
    <div class="ms">${strip(before)}<span class="ar">▶ 下回合</span>${strip(after)}<span class="cnt">自动换新</span></div>`;

  $('#rfChips').innerHTML = html`
    <div class="fxr"><span class="tag t">免费刷新</span><div class="row">${cv('奇迹')}${op('忍冬')}${op('奥斯塔')}</div></div>
    <div class="fxr"><span class="tag t">定向刷新</span><div class="row">${op('灵知')}${eq('人事部记录')}${st('雅拉')}${st('杜遥夜')}${st('渡桥')}</div></div>
    <div class="fxr"><span class="tag a">刷新叠层</span><div class="row">${op('复奏')}${op('安洁莉娜')}${st('裁度')}${st('贾维')}</div></div>`;
}

/** 2.5 阵型与整备区：部署顺序动画、整备区示例、与站位相关的特质 */
function formation() {
  const LINEUP = ['折桠', '烈夏', '乌啾', '奥尔佳', '赫拉格', '维伊', '冻河', '塔露拉'];
  $('#dgrid').innerHTML = range(12).map(i => {
    if (i < 8) return `<div style="animation-delay:${i * .45}s"><span class="dn">${i + 1}</span>${avatar(LINEUP[i])}</div>`;
    if (i === 8) return '<div class="g">9</div>';   // 人事部文档解锁的第 9 格
    return '<div class="g" style="visibility:hidden"></div>';
  }).join('');

  const BENCH = ['真理', '慕斯', '深靛', '卡达', '灰喉', '夏栎', '星源', '淬羽赫默', '焰尾', '历阵锐枪芬', '拜松', '霜叶'];
  $('#benchDemo').innerHTML = range(15).map(i => {
    const name = BENCH[i];
    const temp = i >= 10 ? 'tmp' : '';
    if (!name) return `<div class="b x ${temp}"></div>`;
    const tier = OPERATOR[name].tier;
    return `<div class="b hasava ${temp}" data-t="${tier}" style="cursor:default">${avatar(name)}<i>${TIER_LABELS[tier]}</i>${name}</div>`;
  }).join('');

  const mentioning = keyword => OPERATORS.filter(o => (o.trait + o.elite).includes(keyword)).map(o => o.name);
  const onDeploy = OPERATORS.filter(o => o.trait.includes('部署时')).map(o => o.name);
  const ops = names => names.map(n => op(n)).join('');

  $('#ordFx').innerHTML = html`
    <div class="fxr"><span class="tag a">部署时触发</span><div class="row">${ops(onDeploy)}</div></div>
    <div class="fxr"><span class="tag a">每次部署叠加</span><div class="row">${cv('卡西米尔')}<span>每部署 1 次全体卡西米尔 +20% 攻</span>${st('大帝')}<span>再部署 −50%</span></div></div>
    <div class="fxr"><span class="tag a">身前一格</span><div class="row">${cv('阿戈尔')}<span>开战吞噬身前干员</span>${ops(mentioning('身前一格').slice(0, 8))}<a class="tag t" href="#s44" style="text-decoration:none">4.4 站位关系 ▸</a></div></div>
    <div class="fxr"><span class="tag a">同一行</span><div class="row">${ops(mentioning('同一行'))}</div></div>
    <div class="fxr"><span class="tag t">放整备区也有用</span><div class="row">${ops(mentioning('整备区'))}</div></div>`;
}

/** 2.6 组合装备 */
function equipmentCombos() {
  $('#combos').innerHTML = EQUIPMENT_COMBOS.map(([a, b, result]) =>
    `<div class="combo">${eq(a)}<span class="pl">＋</span>${eq(b)}<span class="pl">＝</span><span>${eq(result)}</span></div>`,
  ).join('') + `<div class="row mt"><span class="tag w">天马之耀：${EQUIP['天马之耀'].effect}</span></div>`;
}

export function initRecruit() {
  dispatchTable();
  tierStatsTable();
  initShopSimulator();
  elite();
  cardPool();
  formation();
  equipmentCombos();
}
