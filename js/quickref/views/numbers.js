/** 数值页：回合时限、调度中心、领袖生命、悬赏、练度等常查数字 */
import {
  MODES, DECISION_ROUNDS, ROUND_TIME, LEADERS, DISPATCH_LEVELS, DISPATCH_BY_MODE, BOUNTIES, TIER_STATS,
  TIER_LABELS, TRAINING, OWN_OPERATOR_BONUS,
} from '../../../data/index.js';
import { esc, html, range, wan } from '../../lib/dom.js';
import { state } from '../state.js';
import { segmented } from '../chips.js';

const FACTS = [
  ['8', '部署上限'], ['9', '人事部文档'], ['10+5', '整备区'],
  ['3→1', '合成精锐'], ['2 / 3 / 4', 'Ⅰ / Ⅱ–Ⅳ / Ⅴ–Ⅵ阶价格'], ['1', '真理 / 至简'],
];

/** 每回合作战时限柱状图；联合模拟 14 回合，险境及以上可追加隐秘核心 */
function roundTimeline(modeIndex) {
  const mode = MODES[modeIndex];
  const standard = mode === '标准';
  const rounds = 14;
  const columns = range(rounds, 1).map(r => {
    const leader = r === rounds;
    const seconds = leader ? 120 : ROUND_TIME[r - 1];
    const kind = leader ? 'ld' : DECISION_ROUNDS[mode].includes(r) ? 'dec' : '';
    return html`<div class="${kind}">
      <span class="s">${seconds}</span>
      <i class="b" style="height:${seconds / 120 * 100}%;animation-delay:${r * .03}s"></i>
      <span>${leader ? '领袖' : 'R' + r}</span>
    </div>`;
  });
  if (!standard) {
    columns.push('<div class="hid"><span class="s">??</span><i class="b" style="height:100%"></i><span>核心</span></div>');
  }
  return columns.join('');
}

/** 领袖生命条，按当前难度从高到低 */
function leaderBars(modeIndex) {
  const hiddenOf = leader => modeIndex > 0 && leader.hiddenCore ? leader.hiddenCore[modeIndex - 1] : 0;
  const sorted = LEADERS.slice().sort((a, b) => b.hp[modeIndex] - a.hp[modeIndex]);
  const max = Math.max(...sorted.map(l => Math.max(l.hp[modeIndex], hiddenOf(l))));
  return sorted.map((leader, i) => {
    const hp = leader.hp[modeIndex];
    const hidden = hiddenOf(leader);
    return html`<span class="nm">${esc(leader.name)}</span>
      <div class="tr">
        <div class="m" style="width:${hp / max * 100}%;animation-delay:${i * .04}s"></div>
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
    return html`<div class="facts" style="margin-bottom:14px">
      ${FACTS.map(([value, label]) => `<div><b>${value}</b><span>${label}</span></div>`)}
    </div>
    <div class="ng">
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
};
