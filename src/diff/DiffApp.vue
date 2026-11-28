<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watch,
  watchEffect,
} from 'vue';
import {COMPARISON_VERSIONS} from '../../data/comparison/index.ts';
import {
  buildSeasonVisualComparison,
  type DiffCategory,
  type DiffFilterCategory,
  type DiffStatus,
  type VisualDiffEntry,
} from './comparison.ts';
import {settings} from '../lib/settings/store.ts';
import {useComponentErrorDiagnostics} from '../lib/runtime/diagnosticErrors.ts';
import {prefersReducedMotion} from '../lib/ui/dom.ts';
import {normalize} from '../lib/ui/match.ts';
import {matchesComparisonName} from './search.ts';
import SkipLink from '../lib/ui/SkipLink.vue';
import PwaInstallNotice from '../lib/ui/PwaInstallNotice.vue';
import ViewportSizeBadge from '../lib/ui/ViewportSizeBadge.vue';
import CopyButton from '../quickref/components/CopyButton.vue';
import EmptyState from '../quickref/components/EmptyState.vue';
import SearchInput from '../quickref/components/SearchInput.vue';
import SectionHeading from '../quickref/components/SectionHeading.vue';
import Segmented from '../quickref/components/Segmented.vue';
import SelectInput, {
  type SelectOption,
} from '../quickref/components/SelectInput.vue';
import StatusNotice from '../quickref/components/StatusNotice.vue';
import SubTabs, {
  subTabPanelAttrs,
  type SubTabDirection,
  type SubTabItem,
} from '../quickref/components/SubTabs.vue';
import DiffCardList from './DiffCardList.vue';
import {lazyView} from '../lib/ui/lazyView.ts';

const SeasonDiffInfographic = lazyView(
  () => import('./SeasonDiffInfographic.vue'),
);

useComponentErrorDiagnostics();

type DiffTab = 'infographic' | DiffFilterCategory;
type StatusFilter = 'changed' | DiffStatus | 'all';
type ViewMode = 'split' | 'unified';

const VALID_TABS = new Set<DiffTab>([
  'infographic',
  'all',
  'covenants',
  'strategies',
  'equipment',
  'operators',
  'rules',
]);
const VALID_STATUS = new Set<StatusFilter>([
  'changed',
  'added',
  'modified',
  'removed',
  'all',
]);

const versions = new Map(
  COMPARISON_VERSIONS.map((version) => [version.id, version]),
);
const seasonAliases = new Map(
  COMPARISON_VERSIONS.map((version) => [version.season.meta.id, version.id]),
);
const hasVersionPair = COMPARISON_VERSIONS.length > 1;
const defaultStatus: StatusFilter = hasVersionPair ? 'changed' : 'all';
const defaultTo = COMPARISON_VERSIONS.at(-1)!;
const defaultFrom = COMPARISON_VERSIONS.at(-2) ?? defaultTo;

function resolveVersionId(value: string | null) {
  if (!value) return undefined;
  return versions.get(value)?.id ?? seasonAliases.get(value);
}

function parseInitialUrlState() {
  const params = new URLSearchParams(location.search);
  const rawFrom = params.get('from');
  const rawTo = params.get('to');
  const fromId = resolveVersionId(rawFrom);
  const toId = resolveVersionId(rawTo);
  const query = (params.get('q') ?? '').trim().slice(0, 80);
  const rawCat = params.get('cat') as DiffTab | null;
  const defaultTab: DiffTab = query ? 'all' : 'infographic';
  const tab = rawCat && VALID_TABS.has(rawCat) ? rawCat : defaultTab;
  const rawStatus = (params.get('status') ?? 'changed') as StatusFilter;
  const status =
    hasVersionPair && VALID_STATUS.has(rawStatus) ? rawStatus : defaultStatus;
  const viewMode: ViewMode =
    params.get('view') === 'unified' ? 'unified' : 'split';
  const covenant = (params.get('cov') ?? '').trim();
  const parsedTier = Number(params.get('tier') ?? '0');
  const tier =
    Number.isSafeInteger(parsedTier) && parsedTier >= 1 ? parsedTier : 0;
  return {
    fromId: fromId ?? defaultFrom.id,
    toId: toId ?? defaultTo.id,
    missingVersion: Boolean((rawFrom && !fromId) || (rawTo && !toId)),
    tab,
    status,
    viewMode,
    query,
    covenant,
    tier,
  };
}

const initial = parseInitialUrlState();

const fromId = ref(initial.fromId);
const toId = ref(initial.toId);
const missingVersion = ref(initial.missingVersion);
const activeTab = ref<DiffTab>(initial.tab);
const diffPanelAttrs = computed(() =>
  hasVersionPair || activeTab.value !== 'infographic'
    ? subTabPanelAttrs('diff-category-panel', activeTab.value)
    : undefined,
);
const statusFilter = ref<StatusFilter>(initial.status);
const viewMode = ref<ViewMode>(initial.viewMode);
const searchQuery = ref(initial.query);
const covenantFilter = ref(initial.covenant);
const tierFilter = ref<number>(initial.tier);
const panelDir = ref<SubTabDirection>('');
const controlsAnchor = ref<HTMLElement | null>(null);

const fromVersion = computed(() => versions.get(fromId.value) ?? defaultFrom);
const toVersion = computed(() => versions.get(toId.value) ?? defaultTo);

const seasonOptions: readonly SelectOption<string>[] = COMPARISON_VERSIONS.map(
  ({id, label}) => ({value: id, label}),
);

const quickPresets = [
  {from: defaultFrom.id, to: defaultTo.id, label: '最近一次更新'},
];
if (COMPARISON_VERSIONS.length > 2) {
  quickPresets.push({
    from: COMPARISON_VERSIONS[0].id,
    to: defaultTo.id,
    label: '最早与最新版本',
  });
}

function swapSeasons(): void {
  const prevFrom = fromId.value;
  fromId.value = toId.value;
  toId.value = prevFrom;
}

function applyPreset(from: string, to: string): void {
  fromId.value = from;
  toId.value = to;
}

const comparison = computed(() =>
  buildSeasonVisualComparison(fromVersion.value.season, toVersion.value.season),
);

const diffMeterBlocks = computed<readonly ('add' | 'mod' | 'del' | 'idle')[]>(
  () => {
    const {added, removed, totalChanges} = comparison.value.totals;
    if (totalChanges === 0) return ['idle', 'idle', 'idle', 'idle', 'idle'];
    const slots = 5;
    let addCells = Math.round((added / totalChanges) * slots);
    let delCells = Math.round((removed / totalChanges) * slots);
    if (added > 0 && addCells === 0) addCells = 1;
    if (removed > 0 && delCells === 0 && addCells < slots) delCells = 1;
    while (addCells + delCells > slots) {
      if (addCells >= delCells) addCells--;
      else delCells--;
    }
    const modCells = Math.max(0, slots - addCells - delCells);
    return [
      ...Array<'add'>(addCells).fill('add'),
      ...Array<'mod'>(modCells).fill('mod'),
      ...Array<'del'>(delCells).fill('del'),
    ];
  },
);

const categoryTabs = computed<readonly SubTabItem<DiffTab>[]>(() => {
  const {totals, byCategory} = comparison.value;
  const countOf = (c: {totalChanges: number; unchanged: number}) =>
    statusFilter.value === 'all'
      ? c.totalChanges + c.unchanged
      : c.totalChanges;
  return [
    {id: 'infographic', label: '更新图解'},
    {id: 'all', label: '全部对比', count: countOf(totals)},
    {id: 'covenants', label: '盟约', count: countOf(byCategory.covenants)},
    {id: 'strategies', label: '策略', count: countOf(byCategory.strategies)},
    {id: 'equipment', label: '装备', count: countOf(byCategory.equipment)},
    {id: 'operators', label: '干员', count: countOf(byCategory.operators)},
    {id: 'rules', label: '敌人与规则', count: countOf(byCategory.rules)},
  ];
});

function scrollToControls(): void {
  const el = controlsAnchor.value;
  if (!el || typeof window === 'undefined') return;
  const rect = el.getBoundingClientRect();
  if (rect.top < 0 || rect.top > window.innerHeight * 0.65) {
    window.scrollTo({
      top: Math.max(0, rect.top + window.scrollY - 58),
      behavior: prefersReducedMotion() ? 'instant' : 'smooth',
    });
  }
}

async function handleSelectCategory(
  target: DiffCategory | 'all',
): Promise<void> {
  panelDir.value = 'next';
  activeTab.value = target;
  await nextTick();
  scrollToControls();
}

async function handleInspectEntity(
  category: DiffCategory,
  name: string,
): Promise<void> {
  panelDir.value = 'next';
  activeTab.value = category;
  statusFilter.value = 'changed';
  covenantFilter.value = '';
  tierFilter.value = 0;
  searchQuery.value = name;
  await nextTick();
  scrollToControls();
}

const categoryEntries = computed(() =>
  activeTab.value === 'all' || activeTab.value === 'infographic'
    ? comparison.value.entries
    : comparison.value.entries.filter((e) => e.category === activeTab.value),
);

const statusTabs = computed<readonly SubTabItem<StatusFilter>[]>(() => {
  const list = categoryEntries.value;
  let added = 0;
  let modified = 0;
  let removed = 0;
  let unchanged = 0;
  for (const item of list) {
    if (item.status === 'added') added++;
    else if (item.status === 'modified') modified++;
    else if (item.status === 'removed') removed++;
    else unchanged++;
  }
  return [
    {id: 'changed', label: '全部变动', count: added + modified + removed},
    {id: 'added', label: '+ 新增', count: added},
    {id: 'modified', label: '~ 调整', count: modified},
    {id: 'removed', label: '− 移除', count: removed},
    {id: 'all', label: '含未变', count: added + modified + removed + unchanged},
  ];
});

const availableCovenants = computed<readonly SelectOption<string>[]>(() => {
  const names = Object.keys(comparison.value.mergedCovenants);
  return [
    {value: '', label: '全部盟约'},
    ...names.map((name) => ({value: name, label: name})),
  ];
});

const tierSelectOptions = computed<readonly SelectOption<number>[]>(() => {
  const before = fromVersion.value.season.rules;
  const after = toVersion.value.season.rules;
  const tiers = [...new Set([...before.tiers, ...after.tiers])].sort(
    (a, b) => a - b,
  );
  return [
    {value: 0, label: '全部等阶'},
    ...tiers.map((tier) => ({
      value: tier,
      label: `${after.tierLabels[tier] ?? before.tierLabels[tier] ?? tier} 阶`,
    })),
  ];
});

const showTierSelect = computed(
  () => activeTab.value === 'operators' || activeTab.value === 'equipment',
);

const showCovenantSelect = computed(() => activeTab.value !== 'rules');

const normalizedEntryText = new WeakMap<VisualDiffEntry, string>();
function matchesQuery(
  entry: VisualDiffEntry,
  normalizedQuery: string,
): boolean {
  if (!normalizedQuery) return true;
  if (matchesComparisonName(entry.name, normalizedQuery)) return true;
  for (const cov of entry.covenants) {
    if (matchesComparisonName(cov, normalizedQuery)) return true;
  }
  let text = normalizedEntryText.get(entry);
  if (text === undefined) {
    text = normalize(entry.searchText);
    normalizedEntryText.set(entry, text);
  }
  return text.includes(normalizedQuery);
}

const matchingEntries = computed(() => {
  const query = normalize(searchQuery.value.trim());
  const covenant = showCovenantSelect.value ? covenantFilter.value : '';
  const tier = showTierSelect.value ? tierFilter.value : 0;
  return categoryEntries.value.filter(
    (entry) =>
      (!covenant || entry.covenants.includes(covenant)) &&
      (!tier || entry.left?.tier === tier || entry.right?.tier === tier) &&
      matchesQuery(entry, query),
  );
});

const filteredEntries = computed(() => {
  const filter = statusFilter.value;
  if (filter === 'all') return matchingEntries.value;
  return matchingEntries.value.filter((entry) =>
    filter === 'changed'
      ? entry.status !== 'unchanged'
      : entry.status === filter,
  );
});

const unchangedMatchCount = computed(() =>
  filteredEntries.value.length
    ? 0
    : matchingEntries.value.filter((entry) => entry.status === 'unchanged')
        .length,
);

const SECTION_META: readonly {
  id: DiffCategory;
  title: string;
  accent: string;
}[] = [
  {id: 'covenants', title: '盟约变更', accent: 'var(--accent)'},
  {id: 'strategies', title: '开局策略变更', accent: 'var(--teal)'},
  {id: 'equipment', title: '装备与合成变更', accent: 'var(--t5)'},
  {id: 'operators', title: '固定干员变更', accent: 'var(--t3)'},
  {id: 'rules', title: 'Boss 领袖与全局规则', accent: 'var(--red)'},
];

const groupedSections = computed(() => {
  if (activeTab.value !== 'all') return [];
  return SECTION_META.map((sec) => ({
    ...sec,
    items: filteredEntries.value.filter((e) => e.category === sec.id),
  })).filter((sec) => sec.items.length > 0);
});

const hasActiveFilter = computed(
  () =>
    Boolean(searchQuery.value.trim()) ||
    (showCovenantSelect.value && Boolean(covenantFilter.value)) ||
    (showTierSelect.value && tierFilter.value > 0) ||
    statusFilter.value !== defaultStatus,
);

function resetFilters(): void {
  searchQuery.value = '';
  covenantFilter.value = '';
  tierFilter.value = 0;
  statusFilter.value = defaultStatus;
}

function buildShareUrl(): string {
  if (typeof location === 'undefined') return '';
  const url = new URL(location.href);
  url.searchParams.set('from', fromId.value);
  url.searchParams.set('to', toId.value);
  return url.href;
}

watch(
  [
    fromId,
    toId,
    activeTab,
    statusFilter,
    viewMode,
    searchQuery,
    covenantFilter,
    tierFilter,
  ],
  () => {
    if (typeof history === 'undefined' || typeof location === 'undefined') {
      return;
    }
    const params = new URLSearchParams({from: fromId.value, to: toId.value});
    if (activeTab.value !== 'infographic') {
      params.set('cat', activeTab.value);
      if (statusFilter.value !== defaultStatus) {
        params.set('status', statusFilter.value);
      }
      if (viewMode.value !== 'split') params.set('view', viewMode.value);
      const q = searchQuery.value.trim();
      if (q) params.set('q', q);
      if (covenantFilter.value && showCovenantSelect.value) {
        params.set('cov', covenantFilter.value);
      }
      if (tierFilter.value > 0 && showTierSelect.value) {
        params.set('tier', String(tierFilter.value));
      }
    }
    const nextSearch = params.toString();
    const targetUrl =
      location.pathname + (nextSearch ? `?${nextSearch}` : '') + location.hash;
    if (targetUrl !== location.pathname + location.search + location.hash) {
      history.replaceState(null, '', targetUrl);
    }
  },
);

watchEffect(() => {
  if (typeof document === 'undefined') return;
  const pair =
    fromId.value === toId.value
      ? fromVersion.value.label
      : `${fromVersion.value.label} → ${toVersion.value.label}`;
  document.title = `${pair} · 赛季更新对比 · 卫戍速查`;
});

function onPopState(): void {
  const next = parseInitialUrlState();
  missingVersion.value = next.missingVersion;
  fromId.value = next.fromId;
  toId.value = next.toId;
  activeTab.value = next.tab;
  statusFilter.value = next.status;
  viewMode.value = next.viewMode;
  searchQuery.value = next.query;
  covenantFilter.value = next.covenant;
  tierFilter.value = next.tier;
}

onMounted(() => {
  window.addEventListener('popstate', onPopState);
});
onUnmounted(() => {
  window.removeEventListener('popstate', onPopState);
});
</script>

<template>
  <SkipLink target-id="diff-main" sticky-header=".df-top" />
  <ViewportSizeBadge v-if="settings.developerMode" />

  <!-- 顶部常驻导航：与速查、图解教程同级互跳 -->
  <header class="df-top">
    <div class="wrap df-top-inner">
      <div class="df-brand">
        <h1>赛季更新对比</h1>
      </div>
      <nav class="df-peer-nav" aria-label="站点页面切换">
        <CopyButton
          :text="buildShareUrl"
          label="复制链接"
          copied-label="已复制"
          variant="compact"
          prompt-title="复制当前赛季对比直链" />
        <a class="df-peer-link" href="/index.html">◂ 卫戍速查</a>
        <a class="df-peer-link" href="/guide.html">图解教程 ▸</a>
      </nav>
    </div>
  </header>

  <main
    id="diff-main"
    class="wrap df-main"
    tabindex="-1"
    aria-label="赛季更新对比内容">
    <PwaInstallNotice />
    <StatusNotice
      v-if="missingVersion"
      tone="warning"
      dismissible
      @dismiss="missingVersion = false">
      链接中有未收录的版本，已选用下方显示的版本。
    </StatusNotice>

    <!-- Git 分支对比选择器面板（BASE vs HEAD） -->
    <section
      v-if="hasVersionPair"
      class="df-rev-card"
      aria-label="选择对比的两个赛季">
      <div class="df-rev-grid">
        <div class="df-rev-box is-base">
          <div class="df-rev-label-row">
            <span class="df-git-ref">
              <i class="df-git-sign" aria-hidden="true">−</i>
              BASE · 更新前（原来）
            </span>
            <span class="df-rev-ver">
              {{ fromVersion.season.meta.ruleVersion }}
            </span>
          </div>
          <SelectInput
            v-model="fromId"
            :options="seasonOptions"
            aria-label="选择基准赛季（原来）" />
        </div>

        <div class="df-swap-col">
          <button
            type="button"
            class="df-swap-btn"
            title="互换左右对比赛季"
            aria-label="互换基准赛季与目标赛季"
            @click="swapSeasons">
            ⇄
          </button>
        </div>

        <div class="df-rev-box is-head">
          <div class="df-rev-label-row">
            <span class="df-git-ref">
              <i class="df-git-sign" aria-hidden="true">+</i>
              HEAD · 更新后（目标）
            </span>
            <span class="df-rev-ver">
              {{ toVersion.season.meta.ruleVersion }}
            </span>
          </div>
          <SelectInput
            v-model="toId"
            :options="seasonOptions"
            aria-label="选择目标赛季（更新后）" />
        </div>
      </div>

      <!-- 快捷相邻/跨代赛季预设 & Git Diffstat 汇总 -->
      <div class="df-rev-foot">
        <div
          v-if="quickPresets.length"
          class="df-presets"
          role="group"
          aria-label="快捷对比预设">
          <span class="df-presets-label">快捷对比：</span>
          <button
            v-for="preset in quickPresets"
            :key="`${preset.from}-${preset.to}`"
            type="button"
            :class="[
              'df-preset-chip',
              {on: fromId === preset.from && toId === preset.to},
            ]"
            @click="applyPreset(preset.from, preset.to)">
            {{ preset.label }}
          </button>
        </div>

        <div class="df-diffstat" aria-live="polite">
          <span class="df-meter" aria-hidden="true">
            <i
              v-for="(cell, idx) in diffMeterBlocks"
              :key="idx"
              :class="cell"></i>
          </span>
          <span class="df-stat-total">
            共 {{ comparison.totals.totalChanges }} 项变动
          </span>
          <span class="df-stat-add">+{{ comparison.totals.added }} 新增</span>
          <span class="df-stat-mod">
            ~{{ comparison.totals.modified }} 调整
          </span>
          <span class="df-stat-del">−{{ comparison.totals.removed }} 移除</span>
        </div>
      </div>
    </section>

    <!-- 二级主切换栏：更新图解 | 全部对比 | 盟约 | 策略 | 装备 | 干员 | 敌人与规则 -->
    <div
      v-if="hasVersionPair || activeTab !== 'infographic'"
      ref="controlsAnchor"
      class="df-controls">
      <SubTabs
        v-model="activeTab"
        :items="categoryTabs"
        :level="2"
        panel-id="diff-category-panel"
        aria-label="图解与分类切换"
        attr="diff-cat"
        @change="(_, dir) => (panelDir = dir)" />

      <!-- 仅在 Git 明细分类下显示搜索框与筛选栏，保持图解视图清爽 -->
      <template v-if="activeTab !== 'infographic'">
        <div class="df-toolbar">
          <SearchInput
            v-model="searchQuery"
            class="df-toolbar-search"
            placeholder="搜名称 / 拼音 / 盟约 / 变动关键词…"
            aria-label="搜索赛季变更条目" />

          <SelectInput
            v-if="showCovenantSelect"
            v-model="covenantFilter"
            class="df-toolbar-select"
            :options="availableCovenants"
            highlight-active
            aria-label="按盟约筛选" />

          <SelectInput
            v-if="showTierSelect"
            v-model="tierFilter"
            class="df-toolbar-select"
            :options="tierSelectOptions"
            highlight-active
            aria-label="按等阶筛选" />

          <Segmented
            class="df-toolbar-view"
            :labels="['左右双栏', '上下合并']"
            :active="viewMode === 'split' ? 0 : 1"
            attr="diff-view"
            @change="viewMode = $event === 0 ? 'split' : 'unified'" />
        </div>

        <SubTabs
          v-if="hasVersionPair"
          v-model="statusFilter"
          :items="statusTabs"
          :level="3"
          aria-label="变更状态筛选"
          attr="diff-status" />
      </template>
    </div>

    <!-- 同赛季对比空态 -->
    <div
      v-if="
        fromId === toId &&
        (activeTab === 'infographic' || statusFilter !== 'all')
      "
      v-bind="diffPanelAttrs">
      <EmptyState
        card
        :message="
          hasVersionPair
            ? '两侧选择了同一版本，没有变动'
            : '目前只收录了一个正式版本'
        "
        :hint="
          hasVersionPair
            ? '选择另一个版本即可对比，也可以查看当前版本的条目。'
            : `${defaultTo.label} · ${defaultTo.season.meta.ruleVersion}。收录下一次更新后，即可查看前后差异。`
        "
        action-label="浏览当前版本条目"
        @action="
          activeTab = 'all';
          statusFilter = 'all';
        " />
    </div>

    <!-- 视图 A：可视化更新图解看板 -->
    <div
      v-else-if="activeTab === 'infographic'"
      :key="`infographic:${fromId}:${toId}`"
      v-bind="diffPanelAttrs"
      :class="{'subtab-panel': !!panelDir}"
      :data-dir="panelDir || undefined">
      <SeasonDiffInfographic
        :comparison="comparison"
        :from-label="fromVersion.label"
        :to-label="toVersion.label"
        :total-changes="comparison.totals.totalChanges"
        @select-category="handleSelectCategory"
        @inspect-entity="handleInspectEntity" />
    </div>

    <!-- 视图 B：图形化 Git 左右双栏 / 上下合并明细 -->
    <div v-else v-bind="diffPanelAttrs">
      <div
        v-if="viewMode === 'split' && filteredEntries.length > 0"
        class="df-col-banner"
        aria-hidden="true">
        <div class="df-col-side is-left">
          <span>− 原来 · {{ fromVersion.label }}</span>
        </div>
        <div class="df-col-side is-right">
          <span>+ 更新后 · {{ toVersion.label }}</span>
        </div>
      </div>

      <EmptyState
        v-if="filteredEntries.length === 0"
        card
        :message="
          unchangedMatchCount > 0
            ? `找到 ${unchangedMatchCount} 个匹配条目在此赛季区间内「未发生变动」`
            : '当前筛选条件下没有匹配的赛季变更条目'
        "
        :hint="
          unchangedMatchCount > 0
            ? '你可以切换至「含未变」直接核对它们的原始数值与机制'
            : undefined
        "
        :action-label="hasActiveFilter ? '重置筛选' : undefined"
        :show-action="hasActiveFilter"
        @action="resetFilters">
        <button
          v-if="unchangedMatchCount > 0"
          type="button"
          class="btn p"
          @click="statusFilter = 'all'">
          显示这 {{ unchangedMatchCount }} 个未变动条目
        </button>
      </EmptyState>

      <!-- 全部对比：按模块清晰分组展示 -->
      <div
        v-else-if="activeTab === 'all'"
        :key="`all:${fromId}:${toId}`"
        :class="{'subtab-panel': !!panelDir}"
        :data-dir="panelDir || undefined">
        <section
          v-for="section in groupedSections"
          :key="section.id"
          class="df-section">
          <SectionHeading
            :title="section.title"
            :count="`${section.items.length} 项`"
            :accent="section.accent"
            variant="bar"
            :level="2" />
          <DiffCardList
            :entries="section.items"
            :from-label="fromVersion.label"
            :to-label="toVersion.label"
            :view-mode="viewMode"
            :covenants="comparison.mergedCovenants" />
        </section>
      </div>

      <!-- 单一分类视图 -->
      <DiffCardList
        v-else
        :key="`${activeTab}:${fromId}:${toId}`"
        :class="{'subtab-panel': !!panelDir}"
        :data-dir="panelDir || undefined"
        :entries="filteredEntries"
        :from-label="fromVersion.label"
        :to-label="toVersion.label"
        :view-mode="viewMode"
        :covenants="comparison.mergedCovenants" />
    </div>
  </main>
</template>
