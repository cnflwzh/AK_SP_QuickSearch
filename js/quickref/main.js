/**
 * 速查页入口（index.html）
 *
 * 页面由 6 个标签页视图组成，每个视图是一个 { id, label, count, render(), mount?() } 对象：
 *   render() 返回 HTML 字符串，mount() 在插入 DOM 后绑定局部事件。
 * 点击统一用事件委托处理，见下方 ACTIONS。
 */
import { OPERATORS, EQUIPMENT, STRATEGIES, ALL_COVENANTS, BUILD_COUNT } from '../../data/index.js';
import { $, $$, prefersReducedMotion } from '../lib/dom.js';
import { initPeek } from '../lib/peek.js';
import { state, setTab, setCovenant, setBuild } from './state.js';
import { renderSearch } from './search.js';
import { sheet, openOperator, openEquipment, openStrategy } from './sheet.js';
import covenants from './views/covenants.js';
import operators from './views/operators.js';
import equipment from './views/equipment.js';
import strategies from './views/strategies.js';
import builds from './views/builds.js';
import numbers from './views/numbers.js';

const VIEWS = [covenants, operators, equipment, strategies, builds, numbers];
const VIEW = Object.fromEntries(VIEWS.map(v => [v.id, v]));

const view = $('#view');
const tabs = $('#tabs');
const searchBar = $('#qbar');
const searchBox = $('#sbox');
const searchInput = $('#q');

/* ---------- 页头 ---------- */

if (prefersReducedMotion) $('#gmv')?.remove();

$('#qkpi').innerHTML = [
  [OPERATORS.length, '干员'],
  [ALL_COVENANTS.length, '盟约'],
  [EQUIPMENT.length, '装备'],
  [STRATEGIES.length, '策略'],
  [BUILD_COUNT, '流派'],
].map(([n, label]) => `<span><b>${n}</b>${label}</span>`).join('');

tabs.innerHTML = VIEWS.map(v =>
  `<button type="button" role="tab" data-tab="${v.id}">${v.label}${v.count ? `<i>${v.count}</i>` : ''}</button>`,
).join('') + '<a class="tlink" href="guide.html">教程 ▸</a>';

/* ---------- 渲染 ---------- */

function render() {
  const query = searchInput.value.trim();
  const current = VIEW[state.tab];
  view.innerHTML = `<div class="pane">${query ? renderSearch(query) : current.render()}</div>`;
  if (!query) current.mount?.(render);
}

const scrollBehavior = () => prefersReducedMotion ? 'auto' : 'smooth';

/** 视图顶部在吸顶栏下方的位置 */
const topOf = el => el.getBoundingClientRect().top + scrollY - searchBar.offsetHeight;

function clearSearch() {
  searchInput.value = '';
  searchBox.classList.remove('has');
  searchBar.classList.remove('searching');
}

/** 切换标签页；默认清空搜索，并在已滚过视图顶部时滚回去 */
function show(tab, { keepQuery = false, scroll = true } = {}) {
  setTab(tab);
  if (!keepQuery && searchInput.value) clearSearch();
  [...tabs.children].forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  render();
  if (scroll) {
    const y = topOf(view) - 4;
    if (scrollY > y) scrollTo({ top: y, behavior: scrollBehavior() });
  }
}

/**
 * 在当前视图里找到某干员的头像方块和叠层条目：滚动到可见处并闪五下（动画次数见 quickref.css 的 .flash）。
 * 从干员详情点盟约跳转过来时使用。
 */
function flashOperator(name) {
  const targets = $$('#view .tile[data-op], #view .sr[data-op]').filter(el => el.dataset.op === name);
  if (!targets.length) return false;
  const first = targets[0];
  const r = first.getBoundingClientRect();
  if (r.top < searchBar.offsetHeight || r.bottom > innerHeight) {
    first.scrollIntoView({ block: 'center', behavior: scrollBehavior() });
  }
  targets.forEach(el => {
    el.classList.remove('flash');
    void el.offsetWidth;          // 重新触发动画
    el.classList.add('flash');
  });
  return true;
}

/* ---------- 点击 ---------- */

const closeSheetIfOpen = () => { if (sheet.open) sheet.close(); };

/**
 * data-* 属性 → 处理函数。按顺序匹配，元素上第一个出现的属性生效。
 * d 为被点击元素的 dataset。
 */
const ACTIONS = {
  close: () => sheet.close(),
  tab: d => show(d.tab, { scroll: false }),
  op: d => openOperator(d.op),
  eq: d => openEquipment(d.eq),
  st: d => openStrategy(d.st),
  cv: d => {
    const fromOperator = sheet.open ? sheet.dataset.viewing : '';
    closeSheetIfOpen();
    setCovenant(d.cv);
    show('cv', { scroll: !fromOperator });
    if (fromOperator && !flashOperator(fromOperator)) show('cv');
  },
  build: d => { closeSheetIfOpen(); setBuild(d.build); show('bd'); },
  cvtg: () => $('#cvside').classList.toggle('open'),          // 窄屏盟约菜单开关
  pick: d => {                                                 // 选择盟约
    setCovenant(d.pick);
    render();
    if (innerWidth <= 860) scrollTo({ top: topOf($('.cvd')) - 6, behavior: scrollBehavior() });
  },
  bd: d => { setBuild(d.bd); render(); },
  opt: d => { state.opTier = +d.opt; render(); },
  opel: d => { state.opElite = d.opel === '1'; render(); },
  eqt: d => { state.eqTier = +d.eqt; render(); },
  stc: d => { state.stCategory = +d.stc; render(); },
  nud: d => { state.mode = +d.nud; render(); },
};

const toAttr = key => 'data-' + key.replace(/[A-Z]/g, c => '-' + c.toLowerCase());
const ACTION_SELECTOR = Object.keys(ACTIONS).map(k => `[${toAttr(k)}]`).join(',');

document.addEventListener('click', e => {
  // 点击菜单外部时收起窄屏盟约菜单
  const side = $('#cvside');
  if (side?.classList.contains('open') && !e.target.closest('#cvside')) side.classList.remove('open');

  const el = e.target.closest(ACTION_SELECTOR);
  if (!el) return;
  const key = Object.keys(ACTIONS).find(k => k in el.dataset);
  ACTIONS[key](el.dataset);
});

/* ---------- 搜索 ---------- */

let searchTimer;
searchInput.addEventListener('input', () => {
  const active = !!searchInput.value.trim();
  searchBox.classList.toggle('has', active);
  searchBar.classList.toggle('searching', active);
  clearTimeout(searchTimer);
  searchTimer = setTimeout(render, 90);
});

$('#qx').onclick = e => {
  e.preventDefault();
  clearSearch();
  render();
  searchInput.focus();
};

// "/" 聚焦搜索框，Esc 清空
document.addEventListener('keydown', e => {
  if (e.key === '/' && document.activeElement !== searchInput && !sheet.open) {
    e.preventDefault();
    searchInput.focus();
    searchInput.select();
  } else if (e.key === 'Escape' && document.activeElement === searchInput && searchInput.value) {
    clearSearch();
    render();
  }
});

show(state.tab, { scroll: false });
initPeek();
