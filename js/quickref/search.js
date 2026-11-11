/**
 * 全局搜索：在盟约、流派、干员、装备、策略中查找。
 * 名称支持汉字、全拼、首字母（见 lib/match.js），名称命中排在描述命中前面。
 */
import { ALL_COVENANTS, OPERATORS, EQUIPMENT, STRATEGIES, BUILD_NAMES } from '../../data/index.js';
import { esc, html } from '../lib/dom.js';
import { normalize, nameScore } from '../lib/match.js';
import { cv, buildLink } from './chips.js';
import { operatorCard } from './views/operators.js';
import { equipmentCard } from './views/equipment.js';
import { strategyCard } from './views/strategies.js';

const MAX_OPERATORS = 60;

/** 按相关度筛选并排序：名称匹配度见 nameScore（1.5–3），描述包含 = 1 */
function rankBy(list, q, nameOf, textOf = () => '', tieBreak = () => 0) {
  const score = item => nameScore(nameOf(item), q) || (normalize(textOf(item)).includes(q) ? 1 : 0);
  return list
    .map(item => [item, score(item)])
    .filter(([, s]) => s)
    .sort((a, b) => b[1] - a[1] || tieBreak(a[0], b[0]))
    .map(([item]) => item);
}

const section = (title, count, body) =>
  html`<div class="sec">${title}<span class="n">${count}</span></div>${body}`;

export function renderSearch(query) {
  const q = normalize(query);
  if (!q) return '';
  const covenants = rankBy(ALL_COVENANTS, q, c => c);
  const builds = rankBy(BUILD_NAMES, q, b => b);
  const operators = rankBy(OPERATORS, q, o => o.name,
    o => o.covenants.join('/') + o.trait + o.elite, (a, b) => a.tier - b.tier);
  const equipment = rankBy(EQUIPMENT, q, e => e.name,
    e => (e.covenant || '') + e.effect + (e.advanced || ''));
  const strategies = rankBy(STRATEGIES, q, s => s.name,
    s => s.skill + '|' + s.effect + s.category);

  if (!covenants.length && !builds.length && !operators.length && !equipment.length && !strategies.length) {
    return `<div class="empty">没有匹配「${esc(query)}」</div>`;
  }

  // 注意：html`` 会原样输出数字 0，所以条件要写成布尔值
  return html`
    ${covenants.length + builds.length > 0 && section('盟约 / 流派', covenants.length + builds.length,
      html`<div class="row">${covenants.map(cv)}${builds.map(buildLink)}</div>`)}
    ${operators.length > 0 && section('干员', operators.length,
      html`<div class="qg">${operators.slice(0, MAX_OPERATORS).map(o => operatorCard(o, false))}</div>`)}
    ${equipment.length > 0 && section('装备', equipment.length,
      html`<div class="qg">${equipment.map(equipmentCard)}</div>`)}
    ${strategies.length > 0 && section('策略', strategies.length,
      html`<div class="qg">${strategies.map(strategyCard)}</div>`)}`;
}
