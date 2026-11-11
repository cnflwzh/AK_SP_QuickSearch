/**
 * 盟约页：左侧盟约选择器，右侧依次为
 * 激活人数 → 效果 → 按等阶的阵容 → 叠层干员 → 专属装备/策略/流派 → 层数计算器
 */
import {
  COVENANTS, CORE_COVENANTS, ADDON_COVENANTS, CORE_BUILDS, EQUIPMENT, STRATEGIES,
  TIERS, TIER_LABELS, ALL_COVENANTS, isCoreCovenant, rosterOf,
} from '../../../data/index.js';
import { $, $$, esc, html, range, round1 } from '../../lib/dom.js';
import { updateHTML } from '../../lib/update-html.js';
import { avatarSrc, img } from '../../lib/assets.js';
import { state } from '../state.js';
import { color, fx, eq, st, buildLink, tile } from '../chips.js';

/* ---------- 叠层文本 ---------- */

/** 去掉每条特质都有的套话，让一行放得下 */
const shorten = text => text
  .replace(/使已激活的|已激活的/g, '')
  .replace(/（此干员在整备区也生效）/, '（整备区生效）')
  .replace(/每回合至多叠加/g, '每回合至多')
  .replace(/每场战斗至多叠加/g, '每场至多');

/** <时机> 与 【盟约】 上色；当前盟约额外高亮 */
const formatTags = (text, current) => esc(text)
  .replace(/&lt;([^&]+?)&gt;/g, '<em class="k">$1</em>')
  .replace(/【([^】]+)】/g, (_, name) =>
    `<em class="c${name === current ? ' on' : ''}" style="--c:${color(name)}">${name}</em>`);

/** formatTags + 数字加粗（不碰标签内部） */
const formatWithNumbers = (text, current) =>
  formatTags(text, current).replace(/(\d+(?:\.\d+)?)(?![^<]*>)/g, '<b>$1</b>');

const NUMBER = /(\d+(?:\.\d+)?)/;

/**
 * 初始与精锐特质只差数字时合并成一行："叠加 2/4 层"。
 * 文字骨架不同则返回 null，由调用方分两行显示。
 */
function mergeBaseAndElite(base, elite, current) {
  const a = base.split(NUMBER);
  const b = elite.split(NUMBER);
  const sameSkeleton = a.length === b.length && a.every((part, i) => i % 2 || part === b[i]);
  if (!sameSkeleton) return null;
  return a.map((part, i) => {
    if (i % 2 === 0) return formatTags(part, current);
    return part === b[i] ? `<b>${part}</b>` : `<b>${part}<s>/</s><u>${b[i]}</u></b>`;
  }).join('');
}

/** 叠层列表中的一行 */
function stackRow(operator, current, recommended) {
  const { name, tier, covenants } = operator;
  const base = shorten(operator.trait);
  const elite = shorten(operator.elite);
  const text = mergeBaseAndElite(base, elite, current)
    || formatWithNumbers(base, current) + `<span class="el"><u>精锐</u> ${formatWithNumbers(elite, current)}</span>`;
  const otherCovenants = covenants.filter(c => c !== current);

  return html`<button type="button" class="sr" data-key="${esc(name)}" data-t="${tier}" data-op="${esc(name)}" data-peek="off">
    ${avatarSrc(name) ? img(avatarSrc(name)) : '<span class="ph"></span>'}
    <div>
      <div class="nl">
        <i class="tn">${TIER_LABELS[tier]}</i><b>${esc(name)}</b>
        ${otherCovenants.map(c => `<span class="x" style="--c:${color(c)}">${c}</span>`)}
        ${recommended && '<span class="rk">★</span>'}
      </div>
      <div class="tt">${text}</div>
    </div>
  </button>`;
}

/* ---------- 各区块 ---------- */

function picker(current) {
  const core = isCoreCovenant(current);
  const button = name => {
    const on = name === current ? 'on' : '';
    return `<button type="button" class="cvb ${on}" style="--c:${color(name)}" data-pick="${name}" aria-pressed="${name === current}">`
      + `${name}<span>${rosterOf(name).length}</span></button>`;
  };
  return html`<div class="cvside" id="cvside">
    <button type="button" class="cvtg" data-cvtg style="--c:${color(current)}">
      <b>${current}</b><span class="tag ${core ? 'a' : 't'}">${core ? '核心' : '附加'}</span><i>▾</i>
    </button>
    <div class="cvp" id="cvp">
      <h5>核心</h5>${CORE_COVENANTS.map(button)}
      <h5>附加</h5>${ADDON_COVENANTS.map(button)}
    </div>
  </div>`;
}

/** 强化门槛人数："6名不同【炎】：…" → 6 */
const bonusHeadcount = bonus => +((bonus || '').match(/^(\d+)名/)?.[1] ?? 0);

function header(name, covenant, core) {
  const { need } = covenant;
  const bigN = bonusHeadcount(covenant.bonus);
  const slots = core ? 6 : Math.max(need, bigN);
  const bars = range(slots).map(i =>
    `<i class="${i < need ? '' : 'o'}" style="animation-delay:${i * .05}s"></i>`);
  return html`<div class="cvh" data-key="header">
    <h2>${name}</h2><span class="tag ${core ? 'a' : 't'}">${core ? '核心' : '附加'}</span>
    <div class="need">${bars}<b>${need}</b><span class="cnt">人激活</span></div>
  </div>`;
}

function effects(covenant, core) {
  const { need, effect, bonus } = covenant;
  const bigN = bonusHeadcount(bonus);
  const bonusLabel = bigN ? bigN + (core ? ' 名不同' : ' 名') : '强化';
  const bonusText = (bonus || '').replace(/^\d+名(不同【[^】]+】)?[：:]?/, '');
  return html`<div class="efx" data-key="effects">
    <div class="ef"><span class="tag">${need} 人</span> ${fx(effect)}</div>
    ${bonus && `<div class="ef bonus"><span class="tag a">${bonusLabel}</span> ${fx(bonusText)}</div>`}
  </div>`;
}

/** 按等阶分 6 列的阵容；★ = 流派终盘阵容，高亮 = 核心输出 */
function rosterGrid(roster, build) {
  if (!roster.length) return '';
  const recommended = new Set(build ? [...build.lineup, ...build.carries] : []);
  const carries = new Set(build ? build.carries : []);
  const tileClass = name => (carries.has(name) ? 'core ' : '') + (recommended.has(name) ? 'rec' : '');

  return html`<div class="roster" data-key="roster">
    <div class="lg">
      <span class="cnt">${roster.length} 名</span>
      ${build && '<span><b>★</b> 终盘阵容</span><span class="tag a" style="padding:0 6px">核心</span>'}
    </div>
    <div class="rcols">${TIERS.map(tier => {
      const list = roster.filter(o => o.tier === tier);
      return html`<div class="rc ${list.length ? '' : 'none'}" data-t="${tier}">
        <i>${TIER_LABELS[tier]}</i>
        <div class="tiles">${list.map(o => tile(o, tileClass(o.name)))}</div>
      </div>`;
    })}</div>
  </div>`;
}

/** 按特质类型分组的叠层干员 */
function stackList(roster, current, build) {
  if (!roster.length) return '';
  const recommended = new Set(build ? [...build.lineup, ...build.carries] : []);
  const groups = [
    ['持续叠加', roster.filter(o => o.type === '持续叠加')],
    ['单次叠加', roster.filter(o => o.type === '单次叠加')],
    ['其他特质', roster.filter(o => o.type !== '持续叠加' && o.type !== '单次叠加')],
  ].filter(([, list]) => list.length);

  return html`<div class="stak" data-key="stacks">
    <div class="lg">
      <b class="sh5">叠层</b>
      <span><b class="sw">初始</b><s>/</s><b class="sw e">精锐</b></span>
      ${build && '<span><b>★</b> 终盘</span>'}
    </div>
    ${groups.map(([title, list]) => html`<div class="sg" data-key="${title}">
      <h5>${title}<span>${list.length}</span></h5>
      <div class="srs">${list
        .sort((a, b) => a.tier - b.tier)
        .map(o => stackRow(o, current, recommended.has(o.name)))}</div>
    </div>`)}
  </div>`;
}

/** 专属装备 / 专属策略 / 用到该盟约的流派 */
function related(name, build) {
  const equipment = EQUIPMENT.filter(e => e.covenant === name).map(e => eq(e.name));
  const strategies = STRATEGIES.filter(s => s.category === name).map(s => st(s.name));
  const usedAsAddon = Object.entries(CORE_BUILDS)
    .filter(([, b]) => b.addons.includes(name))
    .map(([covenant]) => covenant);
  const builds = [...(build ? [buildLink(name)] : []), ...usedAsAddon.map(buildLink)];

  const row = (label, items) => items.length
    ? html`<div><span>${label}</span><div class="row">${items}</div></div>`
    : '';
  return html`<div class="tools" data-key="related">
    ${row('专属装备', equipment)}${row('专属策略', strategies)}${row('流派', builds)}
  </div>`;
}

const PRESETS = [0, 30, 60, 100, 150, 200, 300];

function calculator(covenant, layers) {
  if (!covenant.scaling.length) return '';
  return html`<div class="qcalc" data-key="calculator">
    <div class="top">
      <span class="tag">层数</span>
      <input type="range" min="0" max="300" value="${layers}" id="cvL" aria-label="层数">
      <span class="lv num" id="cvLv">${layers}</span>
    </div>
    <div class="q">${PRESETS.map(x => `<button type="button" data-lv="${x}">${x}</button>`)}</div>
    <div class="vals" id="cvVals"></div>
  </div>`;
}

/* ---------- 视图 ---------- */

/** 只生成右侧详情内容；首屏与局部切换共用，层数从当前会话状态恢复。 */
function detailContent(name) {
  const covenant = COVENANTS[name];
  const core = isCoreCovenant(name);
  const build = CORE_BUILDS[name];
  const roster = rosterOf(name);
  const layers = state.layers[name] ?? 60;

  return html`${header(name, covenant, core)}
    ${effects(covenant, core)}
    ${rosterGrid(roster, build)}
    ${stackList(roster, name, build)}
    ${related(name, build)}
    ${calculator(covenant, layers)}`;
}

export default {
  id: 'cv',
  label: '盟约',
  count: ALL_COVENANTS.length,

  render() {
    const name = state.covenant;

    return html`<div class="cvwrap">
      ${picker(name)}
      <div class="cvd" data-covenant="${name}" style="--c:${color(name)}">
        ${detailContent(name)}
      </div>
    </div>`;
  },

  /**
   * 按 state.covenant 更新右侧详情及左侧选中状态，保留列表节点、焦点与滚动位置。
   * @returns {boolean} 盟约视图已挂载时返回 true；返回 false 时由入口完整渲染。
   * 切换盟约时重新绑定详情计算器；重复选择当前盟约不重建详情。
   */
  updateSelection() {
    const side = $('#cvside');
    const detail = $('#view .cvd');
    if (!side || !detail) return false;

    const name = state.covenant;
    const core = isCoreCovenant(name);
    $$('[data-pick]', side).forEach(button => {
      const selected = button.dataset.pick === name;
      button.classList.toggle('on', selected);
      button.setAttribute('aria-pressed', String(selected));
    });

    // 窄屏折叠菜单只更新摘要，保留菜单列表及其滚动位置。
    const toggle = $('.cvtg', side);
    toggle.style.setProperty('--c', color(name));
    $('b', toggle).textContent = name;
    const tag = $('.tag', toggle);
    tag.textContent = core ? '核心' : '附加';
    tag.classList.toggle('a', core);
    tag.classList.toggle('t', !core);
    side.classList.remove('open');

    if (detail.dataset.covenant !== name) {
      detail.style.setProperty('--c', color(name));
      updateHTML(detail, detailContent(name));
      detail.dataset.covenant = name;
      this.mount();
    }
    return true;
  },

  /** 计算器：拖动或点预设层数时刷新数值 */
  mount() {
    const name = state.covenant;
    const { scaling } = COVENANTS[name];
    if (!scaling.length) return;
    const slider = $('#cvL');
    const draw = () => {
      const layers = +slider.value;
      state.layers[name] = layers;
      $('#cvLv').textContent = layers;
      updateHTML($('#cvVals'), scaling.map(s =>
        `<div><span>${s.label}</span><b>${round1(s.at(layers))}<small>${s.unit}</small></b></div>`).join(''));
    };
    slider.oninput = draw;
    $$('[data-lv]').forEach(b => {
      b.onclick = () => { slider.value = b.dataset.lv; draw(); };
    });
    draw();
  },
};
