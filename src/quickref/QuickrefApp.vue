<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, provide, ref } from 'vue';
import { ALL_COVENANTS, OPERATORS, EQUIPMENT, STRATEGIES, LEADERS, BUILD_COUNT, OPERATOR, EQUIP, STRATEGY } from '../../data/index.ts';
import { prefersReducedMotion } from '../lib/dom.ts';
import { state, setTab, setBuild, setCovenant, setLeader, quickrefActionsKey, TAB_IDS, type DetailKind, type DetailSelection, type TabId } from './state.ts';
import EffectsView from './views/EffectsView.vue';
import CovenantsView from './views/CovenantsView.vue';
import CatalogView from './views/CatalogView.vue';
import BuildsView from './views/BuildsView.vue';
import LeadersView from './views/LeadersView.vue';
import NumbersView from './views/NumbersView.vue';
import SearchView from './views/SearchView.vue';
import DetailSheet from './components/DetailSheet.vue';
const TAB_META: Record<TabId, { label: string; count: number | '' }> = {
  // 速览：全部盟约效果平铺；盟约详情：单个盟约的成员、叠层、装备策略
  fx: { label: '速览', count: '' }, cv: { label: '盟约详情', count: ALL_COVENANTS.length }, op: { label: '干员', count: OPERATORS.length },
  bd: { label: '流派', count: BUILD_COUNT },
  eq: { label: '装备', count: EQUIPMENT.length }, st: { label: '策略', count: STRATEGIES.length },
  ld: { label: '领袖', count: LEADERS.length }, nu: { label: '数值', count: '' },
};
const tabs = TAB_IDS.map(id => ({ id, ...TAB_META[id] }));
const query = ref('');
const renderedQuery = ref('');
const searching = computed(() => !!query.value.trim());
const searchInput = ref<HTMLInputElement | null>(null);
const searchBar = ref<HTMLDivElement | null>(null);
const view = ref<HTMLElement | null>(null);
const tabBar = ref<HTMLDivElement | null>(null);
/** 滑动切换时新页面滑入的方向：l = 从右往左进，r = 从左往右进；点 Tab 切换时为空 */
const slide = ref<'' | 'l' | 'r'>('');
const detail = ref<DetailSelection | null>(null);
let searchTimer: ReturnType<typeof setTimeout> | undefined;
const scrollBehavior = (): ScrollBehavior => prefersReducedMotion ? 'auto' : 'smooth';
const topOf = (element: Element): number => element.getBoundingClientRect().top + window.scrollY - (searchBar.value?.offsetHeight ?? 0);
function clearSearch(): void { clearTimeout(searchTimer); query.value = ''; renderedQuery.value = ''; }
function search(event: Event): void {
  query.value = (event.target as HTMLInputElement).value;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { slide.value = ''; renderedQuery.value = query.value.trim(); }, 90);
}
/** Keeps pane identity stable for filter/search updates, then scrolls only for navigation. */
async function show(tab: TabId, scroll = true): Promise<void> {
  // 新页面从它在 Tab 栏里的方向滑入：往右的 Tab 从右边进，往左的从左边进
  const from = TAB_IDS.indexOf(state.tab), to = TAB_IDS.indexOf(tab);
  if (from !== to || renderedQuery.value) slide.value = to > from ? 'l' : to < from ? 'r' : '';
  clearSearch(); setTab(tab); await nextTick();
  // Tab 栏可横向滚动：切换后把当前 Tab 带进可见范围
  const bar = tabBar.value, on = bar?.querySelector<HTMLElement>('button.on');
  if (bar && on) bar.scrollTo({ left: bar.scrollLeft + on.getBoundingClientRect().left - bar.getBoundingClientRect().left - (bar.clientWidth - on.offsetWidth) / 2, behavior: scrollBehavior() });
  if (scroll && view.value) { const top = topOf(view.value) - 4; if (window.scrollY > top) window.scrollTo({ top, behavior: scrollBehavior() }); }
}
function flashOperator(name: string): boolean {
  const targets = [...document.querySelectorAll<HTMLElement>('#view .tile[data-op], #view .sr[data-op]')].filter(element => element.dataset.op === name);
  if (!targets.length) return false;
  const first = targets[0], bounds = first.getBoundingClientRect();
  if (bounds.top < (searchBar.value?.offsetHeight ?? 0) || bounds.bottom > window.innerHeight) first.scrollIntoView({ block: 'center', behavior: scrollBehavior() });
  for (const target of targets) target.classList.remove('flash');
  void first.offsetWidth; // 合并布局读取，避免每个匹配项都强制重排。
  for (const target of targets) target.classList.add('flash');
  return true;
}
function openDetail(kind: DetailKind, name: string): void {
  const exists = kind === 'op' ? OPERATOR[name] : kind === 'eq' ? EQUIP[name] : STRATEGY[name];
  if (exists) detail.value = { kind, name };
}
function closeDetail(): void {
  // Closing before navigation lets the browser restore dialog focus before we scroll/flash.
  const sheet = document.querySelector<HTMLDialogElement>('#sheet');
  if (sheet?.open) sheet.close();
  detail.value = null;
}
async function openCovenant(name: string): Promise<void> {
  const fromOperator = detail.value?.kind === 'op' ? detail.value.name : '';
  closeDetail(); setCovenant(name); await show('cv', !fromOperator);
  if (fromOperator && !flashOperator(fromOperator)) await show('cv');
}
async function openBuild(name: string): Promise<void> { closeDetail(); setBuild(name); await show('bd'); }
async function openLeader(name: string): Promise<void> { closeDetail(); setLeader(name); await show('ld'); }
async function pickCovenant(name: string): Promise<void> {
  setCovenant(name); await nextTick();
  const element = view.value?.querySelector('.cvd');
  if (window.innerWidth <= 860 && element) window.scrollTo({ top: topOf(element) - 6, behavior: scrollBehavior() });
}
provide(quickrefActionsKey, { openDetail, closeDetail, openCovenant, openBuild, openLeader, pickCovenant });
/** ✕：清空并留在搜索框；矮窗口下搜索框平时只是一个图标，✕ 直接清空并收起 */
function clearAndFocus(): void {
  const compact = window.matchMedia('(max-height:520px)').matches;
  if (query.value && !compact) { clearSearch(); searchInput.value?.focus(); return; }
  clearSearch();
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
}
function pickTab(tab: TabId): void { void show(tab, false); }

/* ---------- 左右滑动切换大 Tab ----------
 * 只认又快又明显的横向滑动；起点落在输入控件、地图或任何能横向滚动的区域里时不触发，
 * 所以页内的分段按钮、滑条、横向列表照常使用。 */
let swipeStart: { x: number; y: number; at: number } | null = null;
function swipeBlocked(target: EventTarget | null): boolean {
  for (let el = target instanceof Element ? target : null; el && el !== view.value; el = el.parentElement) {
    if (el.matches('input, textarea, select, [contenteditable], [role=slider], dialog, svg.lwm, [data-noswipe]')) return true;
    if (el.scrollWidth > el.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(el).overflowX)) return true;
  }
  return false;
}
function touchStart(event: TouchEvent): void {
  swipeStart = null;
  if (event.touches.length !== 1 || renderedQuery.value || detail.value || swipeBlocked(event.target)) return;
  swipeStart = { x: event.touches[0].clientX, y: event.touches[0].clientY, at: event.timeStamp };
}
function touchCancel(): void { swipeStart = null; }
function touchEnd(event: TouchEvent): void {
  const start = swipeStart; swipeStart = null;
  if (!start || event.changedTouches.length !== 1) return;
  const dx = event.changedTouches[0].clientX - start.x, dy = event.changedTouches[0].clientY - start.y;
  if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 2 || event.timeStamp - start.at > 700) return;
  const next = tabs[tabs.findIndex(tab => tab.id === state.tab) + (dx < 0 ? 1 : -1)];
  if (next) void show(next.id);
}
function keydown(event: KeyboardEvent): void {
  // 规划器包含方案名、搜索框和长说明，输入时让 / 保留为普通字符。
  const target = event.target;
  if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
  if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select')) && target !== searchInput.value) return;
  if (event.key === '/' && document.activeElement !== searchInput.value && !detail.value) { event.preventDefault(); searchInput.value?.focus(); searchInput.value?.select(); }
  else if (event.key === 'Escape' && document.activeElement === searchInput.value && query.value) clearSearch();
}
function outsidePicker(event: MouseEvent): void { if (state.pickerOpen && event.target instanceof Element && !event.target.closest('#cvside')) state.pickerOpen = false; }
/** 页面已打开时再点分享链接（只改了 #p=）：切到流派页，由 BuildsView 读取分享码 */
function sharedLink(): void { if (location.hash.startsWith('#p=')) { closeDetail(); void show('bd', false); } }
onMounted(() => { document.addEventListener('keydown', keydown); document.addEventListener('click', outsidePicker); window.addEventListener('hashchange', sharedLink); });
onUnmounted(() => { clearTimeout(searchTimer); document.removeEventListener('keydown', keydown); document.removeEventListener('click', outsidePicker); window.removeEventListener('hashchange', sharedLink); });
</script>
<template>
  <header class="wrap qhead"><div><h1>卫戍速查<small>卫戍协议·规程</small></h1></div><a class="guide" href="guide.html"><svg viewBox="0 0 72 72" aria-hidden="true"><circle class="ring" cx="36" cy="36" r="26"/><circle class="nd" cx="36" cy="10" r="6"/><circle class="nd" cx="58.5" cy="49" r="6"/><circle class="nd" cx="13.5" cy="49" r="6"/><circle class="mv" r="4"><animateMotion v-if="!prefersReducedMotion" id="gmv" dur="5s" repeatCount="indefinite" path="M36,10 A26,26 0 1 1 35.9,10"/></circle></svg><div><div class="k">GUIDE</div><b>图解教程</b><div class="qsteps"><span><i>01</i>入门</span><span><i>02</i>招募升本</span><span><i>03</i>刷怪</span><span><i>04</i>盟约</span><span><i>05</i>流派</span></div></div><span class="go">▸</span></a></header>
  <div id="qbar" ref="searchBar" :class="['qbar', { searching }]"><div class="wrap"><label id="sbox" :class="['search', { has: searching }]"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input id="q" ref="searchInput" type="search" :value="query" placeholder="干员 / 装备 / 策略 / 盟约 / 特质，支持拼音" autocomplete="off" aria-label="搜索" @input="search"><kbd>/</kbd><button id="qx" type="button" class="x" aria-label="清空或收起搜索" @click.prevent="clearAndFocus">✕</button></label><div id="tabs" ref="tabBar" class="tabs" role="tablist"><button v-for="tab in tabs" :key="tab.id" type="button" role="tab" :data-tab="tab.id" :class="{ on: state.tab === tab.id }" @click="pickTab(tab.id)">{{ tab.label }}<i v-if="tab.count">{{ tab.count }}</i></button></div></div></div>
  <main id="view" ref="view" class="wrap" @touchstart.passive="touchStart" @touchend.passive="touchEnd" @touchcancel.passive="touchCancel"><div :key="renderedQuery ? 'search' : state.tab" class="pane" :data-key="renderedQuery ? 'search' : state.tab" :data-slide="slide || undefined"><SearchView v-if="renderedQuery" :query="renderedQuery"/><EffectsView v-else-if="state.tab === 'fx'"/><CovenantsView v-else-if="state.tab === 'cv'"/><CatalogView v-else-if="state.tab === 'op' || state.tab === 'eq' || state.tab === 'st'" :kind="state.tab"/><LeadersView v-else-if="state.tab === 'ld'"/><BuildsView v-else-if="state.tab === 'bd'"/><NumbersView v-else/></div></main>
  <DetailSheet :selection="detail" @closed="closeDetail"/>
</template>
