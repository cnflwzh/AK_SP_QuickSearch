<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  provide,
  ref,
  watch,
  watchEffect,
} from 'vue';
import {
  ALL_COVENANTS,
  OPERATORS,
  EQUIPMENT,
  STRATEGIES,
  LEADERS,
  SEASON_META,
} from '../../data/index.ts';
import {initBoxStorageSync} from '../lib/box/index.ts';
import {prefersReducedMotion} from '../lib/ui/dom.ts';
import {
  isSmallWindow,
  settings,
  visibleContentTabs,
} from '../lib/settings/index.ts';
import {
  state,
  setTab,
  setBuild,
  setCovenant,
  setLeader,
  quickrefActionsKey,
  type DetailKind,
  type TabId,
} from './state.ts';
import {navigationError, routeNotice, PAGE_LABELS} from '../router/index.ts';
import {detailFromId} from '../router/entities.ts';
import {queryText} from '../router/location.ts';
import {
  closeCard,
  currentRoute,
  navigate,
  openCard,
  tabLocation,
  updateQuery,
} from '../router/navigation.ts';
import {topSearchTarget} from './searchRanking.ts';
import {flushSave, presetOf, presets} from './planStore.ts';
import {
  clearRecent,
  recentItems,
  recordRecent,
  type RecentItem,
} from './recentStore.ts';
import {
  avatarSrc,
  equipIconSrc,
  leaderSrc,
  portraitSrc,
} from '../lib/ui/assets.ts';
import {lazyView} from '../lib/ui/lazyView.ts';
import CovenantIcon from './components/CovenantIcon.vue';
import DetailSheet from './components/DetailSheet.vue';
import PrtsPanel from './components/PrtsPanel.vue';
import {provideWikiPanel} from './wikiPanel.ts';
import SkipLink from '../lib/ui/SkipLink.vue';

const wikiPanel = provideWikiPanel();
const SearchView = lazyView(() => import('./views/SearchView.vue'));
const TAB_META: Record<TabId, {label: string; count: number | ''}> = {
  // 速览：全部盟约效果平铺；盟约详情：单个盟约的成员、叠层、装备策略
  fx: {label: '速览', count: ''},
  cv: {label: '盟约详情', count: ALL_COVENANTS.length},
  op: {label: '干员', count: OPERATORS.length},
  bd: {label: '流派', count: ''},
  eq: {label: '装备', count: EQUIPMENT.length},
  st: {label: '策略', count: STRATEGIES.length},
  ld: {label: '领袖', count: LEADERS.length},
  nu: {label: '小工具', count: ''},
  se: {label: '设置', count: ''},
};
const tabs = computed(() => {
  const ordered: TabId[] = [...visibleContentTabs()];
  if (!isSmallWindow.value) ordered.push('se');
  return ordered.map((id) => ({
    id,
    label: TAB_META[id].label,
    count: settings.showTabCounts
      ? id === 'bd'
        ? presets.value.length
        : TAB_META[id].count
      : ('' as const),
  }));
});
const renderedQuery = computed(() => queryText(currentRoute.value.query, 'q'));
// 从搜索链接进入时延后挂载背景页。已经展示过的页面保留筛选、草稿和本局状态。
const mountBackground = ref(!renderedQuery.value);
const query = ref(renderedQuery.value);
const composing = ref(false);
const searchFocused = ref(false);
const searching = computed(() => !!query.value.trim());
const showRecentTray = computed(
  () => searchFocused.value && !searching.value && recentItems.value.length > 0,
);
const RECENT_KIND_LABEL: Readonly<Record<RecentItem['kind'], string>> = {
  op: '干员',
  eq: '装备',
  st: '策略',
  cv: '盟约',
  ld: '领袖',
};
function recentThumb(item: RecentItem): string {
  if (item.kind === 'op') return avatarSrc(item.name);
  if (item.kind === 'eq') return equipIconSrc(item.name);
  if (item.kind === 'st') return portraitSrc(item.name);
  if (item.kind === 'ld') return leaderSrc(item.name);
  return '';
}
function openRecent(item: RecentItem): void {
  searchFocused.value = false;
  if (document.activeElement === searchInput.value) searchInput.value?.blur();
  if (item.kind === 'cv') {
    void openCovenant(item.name);
    return;
  }
  if (item.kind === 'ld') {
    void openLeader(item.name);
    return;
  }
  openDetail(item.kind, item.name);
}
const searchInput = ref<HTMLInputElement | null>(null);
const searchBar = ref<HTMLDivElement | null>(null);
const view = ref<HTMLElement | null>(null);
const tabBar = ref<HTMLElement | null>(null);
const tabsMoreLeft = ref(false);
const tabsMoreRight = ref(false);
/** 点 Tab 和左右滑动共用：按目标 Tab 的方向滑入新页面。 */
const slide = ref<'' | 'l' | 'r'>('');
let tabScrollFrame = 0;
let tabResizeObserver: ResizeObserver | undefined;
const detail = computed(
  () => detailFromId(queryText(currentRoute.value.query, 'card')) ?? null,
);
watch(detail, (next, prev) => {
  if (
    next &&
    (next.kind !== prev?.kind || next.name !== prev?.name)
  ) {
    recordRecent(next.kind, next.name);
  }
});
let searchTimer: ReturnType<typeof setTimeout> | undefined;
const scrollBehavior = (): ScrollBehavior =>
  prefersReducedMotion() ? 'instant' : 'smooth';
const topOf = (element: Element): number =>
  element.getBoundingClientRect().top +
  window.scrollY -
  (searchBar.value?.offsetHeight ?? 0);
watch(
  currentRoute,
  (route, previous) => {
    clearTimeout(searchTimer);
    query.value = renderedQuery.value;
    if (!renderedQuery.value || route.path !== previous.path)
      mountBackground.value = !renderedQuery.value;
  },
);
watchEffect(() => {
  const tab = currentRoute.value.meta.tab;
  const entity =
    detail.value?.name ||
    (tab === 'cv'
      ? state.covenant
      : tab === 'ld'
        ? state.leader
        : tab === 'bd'
          ? presetOf(state.build)?.plan.name
          : '');
  document.title = [entity, tab ? PAGE_LABELS[tab] : '页面未找到', '卫戍速查']
    .filter(Boolean)
    .join(' · ');
});
function clearSearch(): void {
  clearTimeout(searchTimer);
  query.value = '';
  void updateQuery({q: null}, true);
}
function search(event: Event): void {
  query.value = (event.target as HTMLInputElement).value;
  clearTimeout(searchTimer);
  if (composing.value || (event instanceof InputEvent && event.isComposing))
    return;
  searchTimer = setTimeout(() => {
    slide.value = '';
    void updateQuery({q: query.value.trim() || null}, !!renderedQuery.value);
  }, 120);
}
function compositionEnd(event: CompositionEvent): void {
  composing.value = false;
  search(event);
}
async function show(tab: TabId): Promise<void> {
  clearTimeout(searchTimer);
  await setTab(tab);
}
function updateTabOverflow(): void {
  const bar = tabBar.value;
  if (!bar || bar.scrollWidth <= bar.clientWidth + 2) {
    tabsMoreLeft.value = false;
    tabsMoreRight.value = false;
    return;
  }
  tabsMoreLeft.value = bar.scrollLeft > 2;
  tabsMoreRight.value = bar.scrollLeft + bar.clientWidth < bar.scrollWidth - 2;
}
/** Wait for the new view to paint before measuring; a nextTick read forces its entire layout. */
function scheduleTabScroll(): void {
  cancelAnimationFrame(tabScrollFrame);
  tabScrollFrame = requestAnimationFrame(() => {
    tabScrollFrame = requestAnimationFrame(() => {
      tabScrollFrame = 0;
      const bar = tabBar.value;
      if (!bar) return;
      updateTabOverflow();
      if (bar.scrollWidth <= bar.clientWidth) return;
      const active = bar.querySelector<HTMLElement>('a.on');
      if (!active) return;
      const bounds = bar.getBoundingClientRect(),
        activeBounds = active.getBoundingClientRect();
      const rawTarget =
        bar.scrollLeft +
        activeBounds.left -
        bounds.left -
        (bar.clientWidth - activeBounds.width) / 2;
      const maxLeft = Math.max(0, bar.scrollWidth - bar.clientWidth);
      const targetLeft = Math.max(0, Math.min(maxLeft, rawTarget));
      if (Math.abs(bar.scrollLeft - targetLeft) <= 1) return;
      bar.scrollTo({
        left: targetLeft,
        behavior: scrollBehavior(),
      });
    });
  });
}
watch(
  () => state.tab,
  (tab, previous) => {
    const order = tabs.value.map((item) => item.id);
    const nextIndex = order.indexOf(tab);
    const prevIndex = order.indexOf(previous);
    slide.value =
      nextIndex >= 0 && prevIndex >= 0 && nextIndex < prevIndex ? 'r' : 'l';
  },
);
watch(
  [() => state.tab, tabs, () => settings.showTabCounts],
  scheduleTabScroll,
  {flush: 'post'},
);
watch(() => wikiPanel.isOpen.value, scheduleTabScroll, {flush: 'post'});
watch(
  () => settings.showWikiLinks,
  (enabled) => {
    if (!enabled && wikiPanel.operatorName.value) wikiPanel.close();
  },
);
async function reloadPage(): Promise<void> {
  flushSave(true);
  location.assign(
    navigationError.value?.destination ?? currentRoute.value.fullPath,
  );
}
function retryNavigation(): void {
  const destination = navigationError.value?.destination;
  if (destination) void navigate(destination);
}
function flashOperator(name: string): boolean {
  const targets = [
    ...document.querySelectorAll<HTMLElement>(
      '#view .tile[data-op], #view .sr[data-op]',
    ),
  ].filter((element) => element.dataset.op === name);
  if (!targets.length) return false;
  const first = targets[0],
    bounds = first.getBoundingClientRect();
  if (
    bounds.top < (searchBar.value?.offsetHeight ?? 0) ||
    bounds.bottom > window.innerHeight
  )
    first.scrollIntoView({block: 'center', behavior: scrollBehavior()});
  for (const target of targets) target.classList.remove('flash');
  void first.offsetWidth; // 合并布局读取，避免每个匹配项都强制重排。
  for (const target of targets) target.classList.add('flash');
  return true;
}
function openDetail(kind: DetailKind, name: string): void {
  void openCard(kind, name);
}
function closeDetail(): void {
  closeCard();
}
async function openCovenant(name: string): Promise<void> {
  const fromOperator = detail.value?.kind === 'op' ? detail.value.name : '';
  recordRecent('cv', name);
  await setCovenant(name);
  await nextTick();
  if (fromOperator) flashOperator(fromOperator);
}
async function openBuild(name: string): Promise<void> {
  await setBuild(name);
}
async function openLeader(name: string): Promise<void> {
  if (name) recordRecent('ld', name);
  await setLeader(name);
}
async function pickCovenant(name: string): Promise<void> {
  recordRecent('cv', name);
  await setCovenant(name);
  await nextTick();
  const element = view.value?.querySelector('.cvd');
  // 分栏时宽屏也可能显示折叠选择器，按控件是否可见决定滚动。
  const pickerToggle = view.value?.querySelector<HTMLElement>('.cvtg');
  if (pickerToggle?.getClientRects().length && element)
    window.scrollTo({top: topOf(element) - 6, behavior: scrollBehavior()});
}
provide(quickrefActionsKey, {
  openDetail,
  closeDetail,
  openCovenant,
  openBuild,
  openLeader,
  pickCovenant,
});
/** ✕：清空并留在搜索框；矮窗口下搜索框平时只是一个图标，✕ 直接清空并收起 */
function clearAndFocus(): void {
  const compact = window.matchMedia('(max-height:520px)').matches;
  if (query.value && !compact) {
    clearSearch();
    searchInput.value?.focus();
    return;
  }
  clearSearch();
  if (document.activeElement instanceof HTMLElement)
    document.activeElement.blur();
}

/* ---------- 左右滑动切换大 Tab ----------
 * 只认又快又明显的横向滑动；起点落在输入控件、地图或任何能横向滚动的区域里时不触发，
 * 所以页内的分段按钮、滑条、横向列表照常使用。 */
let swipeStart: {x: number; y: number; at: number} | null = null;
function swipeBlocked(target: EventTarget | null): boolean {
  for (
    let el = target instanceof Element ? target : null;
    el && el !== view.value;
    el = el.parentElement
  ) {
    if (
      el.matches(
        'input, textarea, select, [contenteditable], [role=slider], dialog, svg.lwm, [data-noswipe]',
      )
    )
      return true;
    if (
      el.scrollWidth > el.clientWidth + 1 &&
      /auto|scroll/.test(getComputedStyle(el).overflowX)
    )
      return true;
  }
  return false;
}
function touchStart(event: TouchEvent): void {
  swipeStart = null;
  if (
    !settings.enableSwipeTabs ||
    event.touches.length !== 1 ||
    renderedQuery.value ||
    detail.value ||
    swipeBlocked(event.target)
  )
    return;
  swipeStart = {
    x: event.touches[0].clientX,
    y: event.touches[0].clientY,
    at: event.timeStamp,
  };
}
function touchCancel(): void {
  swipeStart = null;
}
function touchEnd(event: TouchEvent): void {
  const start = swipeStart;
  swipeStart = null;
  if (!start || event.changedTouches.length !== 1) return;
  const dx = event.changedTouches[0].clientX - start.x,
    dy = event.changedTouches[0].clientY - start.y;
  if (
    Math.abs(dx) < 64 ||
    Math.abs(dx) < Math.abs(dy) * 2 ||
    event.timeStamp - start.at > 700
  )
    return;
  const tabList = tabs.value;
  const next =
    tabList[
      tabList.findIndex((tab) => tab.id === state.tab) + (dx < 0 ? 1 : -1)
    ];
  if (next) void show(next.id);
}
function keydown(event: KeyboardEvent): void {
  // 规划器包含方案名、搜索框和长说明，输入时让 / 保留为普通字符。
  const target = event.target;
  if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey)
    return;
  if (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.closest('input, textarea, select')) &&
    target !== searchInput.value
  )
    return;
  if (
    event.key === '/' &&
    document.activeElement !== searchInput.value &&
    !detail.value
  ) {
    event.preventDefault();
    searchInput.value?.focus();
    searchInput.value?.select();
  } else if (
    event.key === 'Escape' &&
    document.activeElement === searchInput.value
  ) {
    if (query.value) {
      clearSearch();
    } else {
      searchFocused.value = false;
      searchInput.value?.blur();
    }
  }
}
function outsidePicker(event: MouseEvent): void {
  if (
    state.pickerOpen &&
    event.target instanceof Element &&
    !event.target.closest('#cvside')
  )
    state.pickerOpen = false;
}
async function onSearchEnter(event: KeyboardEvent): Promise<void> {
  if (composing.value || event.isComposing || !query.value.trim()) return;
  const hit = topSearchTarget(
    query.value,
    presets.value.map((preset) => ({
      key: preset.key,
      name: preset.plan.name,
      plan: preset.plan,
    })),
  );
  if (!hit) return;
  event.preventDefault();
  clearTimeout(searchTimer);
  if (hit.kind === 'op' || hit.kind === 'eq' || hit.kind === 'st') {
    // Enter 可以早于搜索防抖结束；先保存搜索背景，关闭详情时才能回到结果。
    const submittedQuery = query.value.trim();
    const submittedPath = currentRoute.value.path;
    await updateQuery({q: submittedQuery}, !!renderedQuery.value);
    if (
      currentRoute.value.path !== submittedPath ||
      renderedQuery.value !== submittedQuery
    )
      return;
    openDetail(hit.kind, hit.id);
    return;
  }
  clearSearch();
  if (hit.kind === 'cv') void openCovenant(hit.id);
  else if (hit.kind === 'bd') void openBuild(hit.id);
  else void openLeader(hit.id);
}
onMounted(() => {
  initBoxStorageSync();
  scheduleTabScroll();
  if (tabBar.value && typeof ResizeObserver !== 'undefined') {
    tabResizeObserver = new ResizeObserver(() => {
      updateTabOverflow();
      scheduleTabScroll();
    });
    tabResizeObserver.observe(tabBar.value);
  }
  document.addEventListener('keydown', keydown);
  document.addEventListener('click', outsidePicker);
});
onUnmounted(() => {
  cancelAnimationFrame(tabScrollFrame);
  clearTimeout(searchTimer);
  tabResizeObserver?.disconnect();
  tabResizeObserver = undefined;
  document.removeEventListener('keydown', keydown);
  document.removeEventListener('click', outsidePicker);
});
</script>
<template>
  <div :class="['quickref-layout', {'wiki-open': wikiPanel.isOpen.value}]">
    <div class="quickref-content" :inert="wikiPanel.isOpen.value && !!detail">
      <SkipLink target-id="view" sticky-header="#qbar" />
      <header v-if="settings.showHeader" class="wrap qhead">
        <h1>
          卫戍速查
          <small>{{ SEASON_META.title }}</small>
        </h1>
        <a class="guide-mini" href="/guide.html">图解教程 ▸</a>
      </header>
      <div id="qbar" ref="searchBar" :class="['qbar', {searching}]">
        <div class="wrap">
          <label id="sbox" :class="['search', {has: searching}]">
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
              fill="none"
              stroke-width="2"
              stroke-linecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              id="q"
              ref="searchInput"
              type="search"
              :value="query"
              placeholder="干员 / 装备 / 策略 / 盟约 / 特质，支持拼音（Enter 直开首项）"
              autocomplete="off"
              aria-label="搜索"
              @focus="searchFocused = true"
              @blur="searchFocused = false"
              @input="search"
              @keydown.enter="onSearchEnter"
              @compositionstart="composing = true"
              @compositionend="compositionEnd" />
            <kbd>/</kbd>
            <button
              id="qx"
              type="button"
              class="x"
              aria-label="清空或收起搜索"
              @click.prevent="clearAndFocus">
              ✕
            </button>
          </label>
          <div
            :class="[
              'tabs-wrap',
              {'more-l': tabsMoreLeft, 'more-r': tabsMoreRight},
            ]">
            <nav
              id="tabs"
              ref="tabBar"
              class="tabs"
              aria-label="速查栏目"
              @scroll.passive="updateTabOverflow">
              <TransitionGroup
                :css="false"
                :name="
                  currentRoute.meta.tab === 'se' ? 'top-tab-sort' : undefined
                ">
                <RouterLink
                  v-for="tab in tabs"
                  :key="tab.id"
                  :to="tabLocation(tab.id)"
                  :data-tab="tab.id"
                  :class="{on: currentRoute.meta.tab === tab.id}"
                  :aria-current="
                    currentRoute.meta.tab === tab.id ? 'page' : undefined
                  ">
                  {{ tab.label }}
                  <i v-if="tab.count">{{ tab.count }}</i>
                </RouterLink>
              </TransitionGroup>
            </nav>
          </div>
        </div>
        <div
          v-if="showRecentTray"
          class="recent-tray"
          data-noswipe
          role="region"
          aria-label="最近查看"
          @mousedown.prevent>
          <div class="wrap recent-tray-inner">
            <span class="recent-label">最近</span>
            <div class="recent-list">
              <button
                v-for="item in recentItems"
                :key="`${item.kind}:${item.name}`"
                type="button"
                class="recent-chip"
                :title="`${RECENT_KIND_LABEL[item.kind]} · ${item.name}`"
                @click="openRecent(item)">
                <CovenantIcon v-if="item.kind === 'cv'" :name="item.name" />
                <img
                  v-else-if="recentThumb(item)"
                  :src="recentThumb(item)"
                  alt=""
                  width="20"
                  height="20"
                  decoding="async" />
                <span>{{ item.name }}</span>
              </button>
            </div>
            <button
              type="button"
              class="recent-clear"
              aria-label="清空最近查看"
              @click="clearRecent">
              清空
            </button>
          </div>
        </div>
      </div>
      <main
        id="view"
        ref="view"
        class="wrap"
        tabindex="-1"
        aria-label="速查内容"
        @touchstart.passive="touchStart"
        @touchend.passive="touchEnd"
        @touchcancel.passive="touchCancel">
        <div v-if="navigationError" class="route-message" role="alert">
          <span>页面加载失败，请检查网络后重试。</span>
          <button type="button" @click="retryNavigation">重试</button>
          <button type="button" @click="reloadPage">刷新页面</button>
        </div>
        <div v-if="routeNotice" class="route-message" role="status">
          {{ routeNotice }}
          <button type="button" @click="routeNotice = ''">关闭</button>
        </div>
        <div
          class="pane"
          :data-key="renderedQuery ? 'search' : state.tab"
          :data-slide="slide || undefined">
          <SearchView v-if="renderedQuery" :query="renderedQuery" />
          <div v-if="mountBackground" v-show="!renderedQuery">
            <RouterView v-slot="{Component}">
              <component :is="Component" />
            </RouterView>
          </div>
        </div>
      </main>
    </div>
    <PrtsPanel
      v-if="wikiPanel.isOpen.value"
      :operator-name="wikiPanel.operatorName.value"
      @close="wikiPanel.close()" />
    <DetailSheet :selection="detail" :split-view="wikiPanel.isOpen.value" />
  </div>
</template>

<style scoped>
.quickref-layout {
  --wiki-panel-width: min(50vw, 880px);
  display: contents;
}
.quickref-content {
  display: contents;
}
.wiki-open .quickref-content {
  display: block;
  container: quickref-column / inline-size;
  min-width: 0;
  margin-right: var(--wiki-panel-width);
}
.wiki-open .qhead {
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  padding-top: max(8px, env(safe-area-inset-top));
  padding-bottom: 8px;
}
.wiki-open .qhead h1 {
  font-size: 34px;
  white-space: nowrap;
}
.wiki-open .qhead h1 small {
  display: none;
}
/* 折叠屏展开后，半屏宽度仍接近手机；页头和导航也按该列宽度收紧。 */
@container quickref-column (max-width: 520px) {
  .wiki-open .qhead {
    gap: 8px;
  }
  .wiki-open .qhead h1 {
    font-size: 28px;
  }
  .wiki-open .qbar .wrap {
    padding-top: 6px;
  }
  .wiki-open .search {
    height: 40px;
  }
  .wiki-open .search input {
    font-size: 14px;
  }
  .wiki-open .search kbd,
  .wiki-open .tabs a i {
    display: none;
  }
  .wiki-open .tabs a {
    padding: 8px 10px;
    font-size: 14px;
  }
}
/* footer 位于 Vue 挂载点外，与左侧速查保持同宽。 */
:global(body:has(.wiki-open) > footer) {
  max-width: none;
  margin-left: 0;
  margin-right: min(50vw, 880px);
}
.recent-tray {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 60;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line2);
  background: color-mix(in srgb, var(--surface) 96%, transparent);
  backdrop-filter: blur(8px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.14);
}
.recent-tray-inner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 6px;
  padding-bottom: 6px;
}
.recent-label {
  flex: none;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--ink3);
  white-space: nowrap;
}
.recent-list {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
}
.recent-list::-webkit-scrollbar {
  display: none;
}
.recent-chip {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 34px;
  padding: 3px 9px 3px 5px;
  border: 1px solid var(--line2);
  border-radius: 6px;
  background: var(--surface2);
  color: var(--ink);
  font: inherit;
  font-size: 12.5px;
  white-space: nowrap;
  cursor: pointer;
}
.recent-chip:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.recent-chip img {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  object-fit: cover;
  background: var(--surface);
}
.recent-clear {
  flex: none;
  min-height: 34px;
  padding: 0 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--ink3);
  font: inherit;
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
}
.recent-clear:hover {
  color: var(--accent);
  background: var(--surface2);
}
@media (max-height: 600px) {
  .recent-tray-inner {
    padding-top: 4px;
    padding-bottom: 4px;
  }
}
</style>
