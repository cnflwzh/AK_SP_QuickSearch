<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, provide, ref, watch, watchEffect } from 'vue';
import { ALL_COVENANTS, OPERATORS, EQUIPMENT, STRATEGIES, LEADERS, BUILD_COUNT } from '../../data/index.ts';
import { prefersReducedMotion } from '../lib/dom.ts';
import { state, setTab, setBuild, setCovenant, setLeader, quickrefActionsKey, TAB_IDS, type DetailKind, type TabId } from './state.ts';
import { navigationError, routeNotice, PAGE_LABELS } from '../router/index.ts';
import { detailFromId } from '../router/entities.ts';
import { queryText } from '../router/location.ts';
import { closeCard, currentRoute, navigate, openCard, tabLocation, updateQuery } from '../router/navigation.ts';
import { whileVisible } from '../lib/visibility.ts';
import { current as selectedPreset, flushSave } from './planStore.ts';
import { lazyView } from '../lib/lazyView.ts';
import DetailSheet from './components/DetailSheet.vue';
import PrtsPanel from './components/PrtsPanel.vue';
import { provideWikiPanel } from './wikiPanel.ts';
import SkipLink from '../lib/SkipLink.vue';

const wikiPanel = provideWikiPanel();
const SearchView = lazyView(() => import('./views/SearchView.vue'));
const TAB_META: Record<TabId, { label: string; count: number | '' }> = {
  // 速览：全部盟约效果平铺；盟约详情：单个盟约的成员、叠层、装备策略
  fx: { label: '速览', count: '' }, cv: { label: '盟约详情', count: ALL_COVENANTS.length }, op: { label: '干员', count: OPERATORS.length },
  bd: { label: '流派', count: BUILD_COUNT },
  eq: { label: '装备', count: EQUIPMENT.length }, st: { label: '策略', count: STRATEGIES.length },
  ld: { label: '领袖', count: LEADERS.length }, nu: { label: '数值', count: '' },
};
const tabs = TAB_IDS.map(id => ({ id, ...TAB_META[id] }));
const renderedQuery = computed(() => queryText(currentRoute.value.query, 'q'));
const query = ref(renderedQuery.value);
const composing = ref(false);
const guideAnimation = ref<SVGSVGElement>();
let stopGuideAnimation: (() => void) | undefined;
const searching = computed(() => !!query.value.trim());
const searchInput = ref<HTMLInputElement | null>(null);
const searchBar = ref<HTMLDivElement | null>(null);
const view = ref<HTMLElement | null>(null);
const tabBar = ref<HTMLDivElement | null>(null);
/** 点 Tab 和左右滑动共用：按目标 Tab 的方向滑入新页面。 */
const slide = ref<'' | 'l' | 'r'>('');
let tabScrollFrame = 0;
const detail = computed(() => detailFromId(queryText(currentRoute.value.query, 'card')) ?? null);
let searchTimer: ReturnType<typeof setTimeout> | undefined;
const scrollBehavior = (): ScrollBehavior => prefersReducedMotion() ? 'instant' : 'smooth';
const topOf = (element: Element): number => element.getBoundingClientRect().top + window.scrollY - (searchBar.value?.offsetHeight ?? 0);
watch(() => currentRoute.value.fullPath, () => {
  clearTimeout(searchTimer);
  query.value = renderedQuery.value;
});
watchEffect(() => {
  const tab = currentRoute.value.meta.tab;
  const entity = detail.value?.name || (tab === 'cv' ? state.covenant : tab === 'ld' ? state.leader : tab === 'bd' ? selectedPreset.value.plan.name : '');
  document.title = [entity, tab ? PAGE_LABELS[tab] : '页面未找到', '卫戍速查'].filter(Boolean).join(' · ');
});
function clearSearch(): void {
  clearTimeout(searchTimer);
  query.value = '';
  void updateQuery({ q: null }, true);
}
function search(event: Event): void {
  query.value = (event.target as HTMLInputElement).value;
  clearTimeout(searchTimer);
  if (composing.value || (event instanceof InputEvent && event.isComposing)) return;
  searchTimer = setTimeout(() => {
    slide.value = '';
    void updateQuery({ q: query.value.trim() || null }, !!renderedQuery.value);
  }, 120);
}
function compositionEnd(event: CompositionEvent): void { composing.value = false; search(event); }
async function show(tab: TabId): Promise<void> {
  clearTimeout(searchTimer);
  await setTab(tab);
}
/** Wait for the new view to paint before measuring; a nextTick read forces its entire layout. */
function scheduleTabScroll(): void {
  cancelAnimationFrame(tabScrollFrame);
  tabScrollFrame = requestAnimationFrame(() => {
    tabScrollFrame = requestAnimationFrame(() => {
      tabScrollFrame = 0;
      const bar = tabBar.value;
      if (!bar || bar.scrollWidth <= bar.clientWidth) return;
      const active = bar.querySelector<HTMLElement>('a.on');
      if (!active) return;
      const bounds = bar.getBoundingClientRect(), activeBounds = active.getBoundingClientRect();
      if (activeBounds.left >= bounds.left && activeBounds.right <= bounds.right) return;
      bar.scrollTo({ left: bar.scrollLeft + activeBounds.left - bounds.left - (bar.clientWidth - activeBounds.width) / 2, behavior: scrollBehavior() });
    });
  });
}
watch(() => state.tab, (tab, previous) => {
  slide.value = TAB_IDS.indexOf(tab) > TAB_IDS.indexOf(previous) ? 'l' : 'r';
});
watch(() => state.tab, scheduleTabScroll, { flush: 'post' });
async function reloadPage(): Promise<void> {
  flushSave(true);
  location.assign(navigationError.value?.destination ?? currentRoute.value.fullPath);
}
function retryNavigation(): void {
  const destination = navigationError.value?.destination;
  if (destination) void navigate(destination);
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
function openDetail(kind: DetailKind, name: string): void { void openCard(kind, name); }
function closeDetail(): void { closeCard(); }
async function openCovenant(name: string): Promise<void> {
  const fromOperator = detail.value?.kind === 'op' ? detail.value.name : '';
  await setCovenant(name);
  await nextTick();
  if (fromOperator) flashOperator(fromOperator);
}
async function openBuild(name: string): Promise<void> { await setBuild(name); }
async function openLeader(name: string): Promise<void> { await setLeader(name); }
async function pickCovenant(name: string): Promise<void> {
  await setCovenant(name);
  await nextTick();
  const element = view.value?.querySelector('.cvd');
  // 分栏时宽屏也可能显示折叠选择器，按控件是否可见决定滚动。
  const pickerToggle = view.value?.querySelector<HTMLElement>('.cvtg');
  if (pickerToggle?.getClientRects().length && element) window.scrollTo({ top: topOf(element) - 6, behavior: scrollBehavior() });
}
provide(quickrefActionsKey, { openDetail, closeDetail, openCovenant, openBuild, openLeader, pickCovenant });
/** ✕：清空并留在搜索框；矮窗口下搜索框平时只是一个图标，✕ 直接清空并收起 */
function clearAndFocus(): void {
  const compact = window.matchMedia('(max-height:520px)').matches;
  if (query.value && !compact) { clearSearch(); searchInput.value?.focus(); return; }
  clearSearch();
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
}


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
onMounted(() => {
  scheduleTabScroll();
  document.addEventListener('keydown', keydown);
  document.addEventListener('click', outsidePicker);
  if (guideAnimation.value) {
    const svg = guideAnimation.value;
    svg.pauseAnimations();
    stopGuideAnimation = whileVisible(svg, () => { svg.unpauseAnimations(); return () => svg.pauseAnimations(); });
  }
});
onUnmounted(() => {
  cancelAnimationFrame(tabScrollFrame);
  clearTimeout(searchTimer);
  stopGuideAnimation?.();
  document.removeEventListener('keydown', keydown);
  document.removeEventListener('click', outsidePicker);
});
</script>
<template>
  <div :class="['quickref-layout', { 'wiki-open': wikiPanel.isOpen.value }]">
  <div class="quickref-content" :inert="wikiPanel.isOpen.value && !!detail">
  <SkipLink target-id="view" sticky-header="#qbar"/>
  <header class="wrap qhead"><div><h1>卫戍速查<small>卫戍协议·规程</small></h1></div><a class="guide" href="/guide.html"><svg ref="guideAnimation" viewBox="0 0 72 72" aria-hidden="true"><circle class="ring" cx="36" cy="36" r="26"/><circle class="nd" cx="36" cy="10" r="6"/><circle class="nd" cx="58.5" cy="49" r="6"/><circle class="nd" cx="13.5" cy="49" r="6"/><circle class="mv" r="4"><animateMotion id="gmv" dur="5s" repeatCount="indefinite" path="M36,10 A26,26 0 1 1 35.9,10"/></circle></svg><div><div class="k">GUIDE</div><b>图解教程</b><div class="qsteps"><span><i>01</i>入门</span><span><i>02</i>招募升本</span><span><i>03</i>刷怪</span><span><i>04</i>盟约</span><span><i>05</i>流派</span></div></div><span class="go">▸</span></a></header>
  <div id="qbar" ref="searchBar" :class="['qbar', { searching }]"><div class="wrap"><label id="sbox" :class="['search', { has: searching }]"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input id="q" ref="searchInput" type="search" :value="query" placeholder="干员 / 装备 / 策略 / 盟约 / 特质，支持拼音" autocomplete="off" aria-label="搜索" @input="search" @compositionstart="composing = true" @compositionend="compositionEnd"><kbd>/</kbd><button id="qx" type="button" class="x" aria-label="清空或收起搜索" @click.prevent="clearAndFocus">✕</button></label><nav id="tabs" ref="tabBar" class="tabs" aria-label="速查栏目"><RouterLink v-for="tab in tabs" :key="tab.id" :to="tabLocation(tab.id)" :data-tab="tab.id" :class="{ on: currentRoute.meta.tab === tab.id }" :aria-current="currentRoute.meta.tab === tab.id ? 'page' : undefined">{{ tab.label }}<i v-if="tab.count">{{ tab.count }}</i></RouterLink></nav></div></div>
  <main id="view" ref="view" class="wrap" tabindex="-1" aria-label="速查内容" @touchstart.passive="touchStart" @touchend.passive="touchEnd" @touchcancel.passive="touchCancel">
    <div v-if="navigationError" class="route-message" role="alert">
      <span>页面加载失败，请检查网络后重试。</span>
      <button type="button" @click="retryNavigation">重试</button>
      <button type="button" @click="reloadPage">刷新页面</button>
    </div>
    <div v-if="routeNotice" class="route-message" role="status">{{ routeNotice }}<button type="button" @click="routeNotice = ''">关闭</button></div>
    <div class="pane" :data-key="renderedQuery ? 'search' : state.tab" :data-slide="slide || undefined">
      <SearchView v-if="renderedQuery" :query="renderedQuery"/>
      <div v-show="!renderedQuery"><RouterView v-slot="{ Component }">
        <component :is="Component"/>
      </RouterView></div>
    </div>
  </main>
  </div>
  <PrtsPanel v-if="wikiPanel.isOpen.value" :operator-name="wikiPanel.operatorName.value" @close="wikiPanel.close()"/>
  <DetailSheet :selection="detail" :split-view="wikiPanel.isOpen.value"/>
  </div>
</template>

<style scoped>
.quickref-layout { --wiki-panel-width: min(50vw, 880px); display: contents; }
.quickref-content { display: contents; }
.wiki-open .quickref-content { display: block; container: quickref-column / inline-size; min-width: 0; margin-right: var(--wiki-panel-width); }
.wiki-open .qhead { grid-template-columns: minmax(0, 1fr) auto; gap: 12px; padding-top: max(16px, env(safe-area-inset-top)); padding-bottom: 12px; }
.wiki-open .qhead h1 { font-size: 34px; white-space: nowrap; }
.wiki-open .qhead h1 small, .wiki-open .guide svg, .wiki-open .guide .k, .wiki-open .guide .qsteps { display: none; }
.wiki-open .guide { width: auto; grid-template-columns: 1fr auto; padding: 8px 12px; }
.wiki-open .guide b { font-size: 16px; }
/* 折叠屏展开后，半屏宽度仍接近手机；页头和导航也按该列宽度收紧。 */
@container quickref-column (max-width: 520px) {
  .wiki-open .qhead { gap: 8px; padding-top: max(8px, env(safe-area-inset-top)); padding-bottom: 8px; }
  .wiki-open .qhead h1 { font-size: 28px; }
  .wiki-open .guide { gap: 6px; padding: 6px 8px; }
  .wiki-open .guide b { font-size: 14px; }
  .wiki-open .guide .go { font-size: 16px; }
  .wiki-open .qbar .wrap { padding-top: 6px; }
  .wiki-open .search { height: 40px; }
  .wiki-open .search input { font-size: 14px; }
  .wiki-open .search kbd, .wiki-open .tabs a i { display: none; }
  .wiki-open .tabs a { padding: 8px 10px; font-size: 14px; }
}
/* footer 位于 Vue 挂载点外，与左侧速查保持同宽。 */
:global(body:has(.wiki-open) > footer) { max-width: none; margin-left: 0; margin-right: min(50vw, 880px); }
</style>
