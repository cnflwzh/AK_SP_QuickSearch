<script setup lang="ts">
import {computed, nextTick, ref, watch} from 'vue';
import {
  ADDITIONAL_OPERATORS,
  ALL_COVENANTS,
  BORROW_LIMIT,
  OWN_OPERATOR_BONUS,
  rosterOf,
  TIER_LABELS,
  TIERS,
  type Operator,
} from '../../../data/index.ts';
import {
  BORROWABLE_SIX_STARS,
  BOX_OPERATORS,
  BOX_RANK_BORROWED,
  BOX_RANK_META,
  PRESET_SIX_STARS,
  boxRankOf,
  isBorrowableSixStar,
  type BoxRank,
} from '../../lib/box/model.ts';
import {
  boxSeasonBorrowedCount,
  boxSeasonCount,
  clearOperatorBox,
  hasAnyBox,
  operatorBox,
  rankOfOperator,
  setOperatorRank,
  setOperatorRanks,
} from '../../lib/box/store.ts';
import {prefersReducedMotion} from '../../lib/ui/dom.ts';
import {lazyView} from '../../lib/ui/lazyView.ts';
import {nameScore, normalize} from '../../lib/ui/match.ts';
import OperatorRosterSources, {
  type RosterSource,
} from '../components/OperatorRosterSources.vue';
import {subTabPanelAttrs, type SubTabDirection} from '../components/SubTabs.vue';
import BoxBonusRules from './BoxBonusRules.vue';
import BoxOperatorCard from './BoxOperatorCard.vue';
import BoxPlannerPanel from './BoxPlannerPanel.vue';
import CovenantIcon from '../components/CovenantIcon.vue';
import Segmented from '../components/Segmented.vue';
import SearchInput from '../components/SearchInput.vue';
import SelectInput, {type SelectOption} from '../components/SelectInput.vue';
import ConfirmButton from '../components/ConfirmButton.vue';

const TIER_FILTER_OPTIONS: readonly SelectOption<number>[] = [
  {value: 0, label: '全部等阶'},
  ...TIERS.map((t) => ({value: t, label: `${TIER_LABELS[t]} 阶`})),
];
const COVENANT_FILTER_OPTIONS: readonly SelectOption<string>[] = [
  {value: '', label: '全部盟约'},
  ...ALL_COVENANTS.map((name) => ({value: name, label: name})),
];
import StatusNotice from '../components/StatusNotice.vue';
import SectionHeading from '../components/SectionHeading.vue';
import EmptyState from '../components/EmptyState.vue';
import {color} from '../format.ts';
import {useQuickrefActions} from '../state.ts';
import {currentRoute, navigate, routeQuery} from '../../router/navigation.ts';
import './numbers.css';
import '../workbench.css';

type CategoryFilter =
  | 'all'
  | 'owned'
  | 'missing'
  | 'e260'
  | 'e2'
  | 'e1'
  | 'e0'
  | 'borrowed'
  | 'unborrowed'
  | 'preset';

type StatusBucketId =
  'e260' | 'e2' | 'e1' | 'e0' | 'borrowed' | 'unborrowed' | 'preset';

interface StatusBucketMeta {
  readonly id: StatusBucketId;
  readonly title: string;
  readonly desc: string;
  readonly tone: string;
}

const BRUSHES: readonly {readonly rank: BoxRank; readonly label: string}[] = [
  {rank: 3, label: '精二60'},
  {rank: 2, label: '精二'},
  {rank: 1, label: '精一'},
  {rank: 0, label: '未练(精0)'},
  {rank: BOX_RANK_BORROWED, label: '已借用'},
  {rank: -1, label: '未持有'},
];

const GROUP_MODES = [
  {id: 'status', label: '按状态分类'},
  {id: 'tier', label: '按等阶'},
  {id: 'covenant', label: '按盟约'},
] as const;
const GROUP_MODE_LABELS = GROUP_MODES.map((mode) => mode.label);

const FILTER_LABELS: Readonly<Record<CategoryFilter, string>> = {
  all: '全部干员',
  owned: '已持有（全部）',
  missing: '未持有（全部）',
  e260: '已持有 · 精二 60',
  e2: '已持有 · 精英二',
  e1: '已持有 · 精英一',
  e0: '已持有 · 未练(精0)',
  borrowed: '未持有 · 已借用 6★',
  unborrowed: '未持有 · 可借用 6★',
  preset: '未持有 · 系统预设',
};

function bonusSummary(index: number): string {
  const row = OWN_OPERATOR_BONUS[index];
  if (!row) return '';
  const parts: string[] = [];
  if (row.atk !== '—') parts.push(`攻${row.atk}`);
  if (row.def !== '—') parts.push(`防${row.def}`);
  if (row.hp !== '—') parts.push(`血${row.hp}`);
  return parts.join(' ');
}

const BONUS_TEXT_E1 = bonusSummary(0);
const BONUS_TEXT_E2 = bonusSummary(1);
const BONUS_TEXT_E260 = bonusSummary(2);
const PRESET_SIX_NAMES = PRESET_SIX_STARS.map((op) => op.name).join('、');

const STATUS_BUCKETS: readonly StatusBucketMeta[] = [
  {
    id: 'e260',
    title: '精二 60 · 满加成',
    desc: `自持满档加成（${BONUS_TEXT_E260}）`,
    tone: 'r3',
  },
  {
    id: 'e2',
    title: '精英二 · 已激活',
    desc: `自持二档加成（${BONUS_TEXT_E2}）`,
    tone: 'r2',
  },
  {
    id: 'e1',
    title: '精英一 · 已激活',
    desc: `自持基础加成（${BONUS_TEXT_E1}）`,
    tone: 'r1',
  },
  {
    id: 'e0',
    title: '已持有 · 未练（精 0）',
    desc: '已拥有但尚未激活加成，升至精一即可生效',
    tone: 'r0',
  },
  {
    id: 'borrowed',
    title: '未持有 · 已借用 6★',
    desc: `已选入助战（上限 ${BORROW_LIMIT} 名，不限好友）；局内本体出战，无自持加成（属性等效精0）`,
    tone: 'rborrowed',
  },
  {
    id: 'unborrowed',
    title: '未持有 · 可借用 6★',
    desc: '尚未借用；不借则由原型 / 预备干员替补出战',
    tone: 'runborrowed',
  },
  {
    id: 'preset',
    title: '未持有 · 系统预设',
    desc: `免借直出，局内自带本体出战（无自持加成）；含 ${PRESET_SIX_STARS.length} 名特许 6★（${PRESET_SIX_NAMES}）与 4–5★`,
    tone: 'rpreset',
  },
];

const BUCKET_ACCENT: Readonly<Record<StatusBucketId, string>> = {
  e260: 'var(--bx-r3)',
  e2: 'var(--bx-r2)',
  e1: 'var(--bx-r1)',
  e0: 'var(--bx-r0)',
  borrowed: 'var(--bx-borrowed)',
  unborrowed: 'var(--bx-unborrowed)',
  preset: 'var(--bx-preset)',
};

const actions = useQuickrefActions();

const categoryFilter = ref<CategoryFilter>('all');
const groupModeIndex = ref(0);
const groupMode = computed(() => GROUP_MODES[groupModeIndex.value].id);
const search = ref('');
const covenant = ref('');
const tierFilter = ref(0);

const editMode = ref(false);
const editorBar = ref<HTMLElement>();
const fixedRosterFilters = ref<HTMLElement>();
const rosterSource = ref<RosterSource>('fixed');
const roster = ref<InstanceType<typeof OperatorRosterSources>>();
const brushes = computed(() =>
  rosterSource.value === 'selectable'
    ? BRUSHES.filter((brush) => brush.rank !== BOX_RANK_BORROWED)
    : BRUSHES,
);
const rosterDir = ref<SubTabDirection>('');
const brushIndex = ref(0);
watch(rosterSource, (source) => {
  brushIndex.value = 0;
  if (source === 'substitute') editMode.value = false;
});
const BoxImportPanel = lazyView(() => import('./BoxImportPanel.vue'));
const BoxIncomingShare = lazyView(() => import('./BoxIncomingShare.vue'));
const BoxSyncPanel = lazyView(() => import('./BoxSyncPanel.vue'));
const importOpen = ref(false);
const importStarted = ref(false);
const importButton = ref<HTMLButtonElement>();
const syncOpen = ref(false);
const notice = ref('');

function showImport(open: boolean): void {
  importOpen.value = open;
  if (open) {
    // 首次打开才加载，收起后保留粘贴草稿及默认练度。
    importStarted.value = true;
    syncOpen.value = false;
  }
}

async function closeImport(): Promise<void> {
  importOpen.value = false;
  await nextTick();
  importButton.value?.focus({preventScroll: true});
}

watch(
  () => routeQuery.value.import,
  (flag) => {
    if (flag === '1') showImport(true);
  },
  {immediate: true},
);

function dismissIncomingShare(): void {
  if (currentRoute.value.hash.startsWith('#b=')) {
    void navigate({path: '/box', query: routeQuery.value, hash: ''}, true);
  }
}

const currentBrush = computed<BoxRank>(
  () => brushes.value[brushIndex.value].rank,
);
const isBorrowBrush = computed(
  () => editMode.value && currentBrush.value === BOX_RANK_BORROWED,
);

function opRank(op: Operator): BoxRank {
  return boxRankOf(operatorBox, op.avatar);
}

function opBucketId(op: Operator): StatusBucketId {
  const rank = opRank(op);
  if (rank === 3) return 'e260';
  if (rank === 2) return 'e2';
  if (rank === 1) return 'e1';
  if (rank === 0) return 'e0';
  if (rank === BOX_RANK_BORROWED) return 'borrowed';
  return isBorrowableSixStar(op) ? 'unborrowed' : 'preset';
}

const rankCounts = computed(() => {
  let e0 = 0;
  let e1 = 0;
  let e2 = 0;
  let e260 = 0;
  let borrowed = 0;
  let unborrowed = 0;
  let preset = 0;
  let presetSix = 0;
  for (const op of BOX_OPERATORS) {
    const rank = boxRankOf(operatorBox, op.avatar);
    if (rank === 3) e260++;
    else if (rank === 2) e2++;
    else if (rank === 1) e1++;
    else if (rank === 0) e0++;
    else if (rank === BOX_RANK_BORROWED) borrowed++;
    else if (isBorrowableSixStar(op)) unborrowed++;
    else {
      preset++;
      if (op.stars === 6) presetSix++;
    }
  }
  const total = BOX_OPERATORS.length;
  const activated = e1 + e2 + e260;
  const owned = activated + e0;
  const missing = borrowed + unborrowed + preset;
  const pct = (n: number) => (total ? (n / total) * 100 : 0);
  return {
    total,
    owned,
    missing,
    activated,
    borrowed,
    unborrowed,
    preset,
    presetSix,
    e0,
    e1,
    e2,
    e260,
    activatedPct: total ? Math.round((activated / total) * 100) : 0,
    wE260: pct(e260),
    wE2: pct(e2),
    wE1: pct(e1),
    wE0: pct(e0),
    wBorrowed: pct(borrowed),
    wPreset: pct(preset),
  };
});

const ownedTiers = computed(() => [
  {
    id: 'e260' as const,
    label: '精二 60',
    state: '满加成',
    count: rankCounts.value.e260,
    tone: 'r3',
  },
  {
    id: 'e2' as const,
    label: '精英二',
    state: '已激活',
    count: rankCounts.value.e2,
    tone: 'r2',
  },
  {
    id: 'e1' as const,
    label: '精英一',
    state: '已激活',
    count: rankCounts.value.e1,
    tone: 'r1',
  },
  {
    id: 'e0' as const,
    label: '未练(精0)',
    state: '未激活',
    count: rankCounts.value.e0,
    tone: 'r0',
  },
]);

function matchesCategory(op: Operator, filter: CategoryFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'owned') return opRank(op) >= 0;
  if (filter === 'missing') return opRank(op) < 0;
  return opBucketId(op) === filter;
}

const filteredOperators = computed(() => {
  const q = normalize(search.value);
  return BOX_OPERATORS.filter(
    (op) =>
      matchesCategory(op, categoryFilter.value) &&
      (!tierFilter.value || op.tier === tierFilter.value) &&
      (!covenant.value || op.covenants.includes(covenant.value)) &&
      (!q ||
        nameScore(op.name, q) > 0 ||
        op.covenants.some((c) => nameScore(c, q) > 0) ||
        (Boolean(op.backupOperator) && nameScore(op.backupOperator!, q) > 0)),
  );
});

const statusGroups = computed(() => {
  const buckets = new Map<StatusBucketId, Operator[]>(
    STATUS_BUCKETS.map((b) => [b.id, []]),
  );
  for (const op of filteredOperators.value) {
    buckets.get(opBucketId(op))!.push(op);
  }
  return STATUS_BUCKETS.map((meta) => {
    const items = buckets.get(meta.id)!.slice();
    if (meta.id === 'preset') {
      items.sort((a, b) => b.stars - a.stars || b.tier - a.tier);
    } else {
      items.sort((a, b) => b.tier - a.tier || b.stars - a.stars);
    }
    return {...meta, items};
  }).filter((g) => g.items.length > 0);
});

const rosterGroups = computed(() => {
  const operators = filteredOperators.value;
  let groups: {title: string; tier?: number; items: Operator[]}[];
  if (groupMode.value === 'tier') {
    groups = TIERS.map((tier) => ({
      title: `${TIER_LABELS[tier]} 阶`,
      tier,
      items: operators.filter((op) => op.tier === tier),
    }));
  } else {
    const visible = new Set(operators.map((op) => op.avatar));
    const names = covenant.value ? [covenant.value] : ALL_COVENANTS;
    // 多盟约干员在各自的组中展示；工具栏计数和批量编辑仍以去重的筛选结果为准。
    groups = names.map((name) => ({
      title: name,
      items: rosterOf(name).filter((op) => visible.has(op.avatar)),
    }));
  }
  return groups
    .filter((group) => group.items.length > 0)
    .map((group) => {
      let activeCount = 0;
      let ownedCount = 0;
      let borrowedCount = 0;
      let unborrowedCount = 0;
      for (const op of group.items) {
        const rank = opRank(op);
        if (rank >= 0) ownedCount++;
        if (rank >= 1) activeCount++;
        if (rank === BOX_RANK_BORROWED) borrowedCount++;
        if (rank === -1 && isBorrowableSixStar(op)) unborrowedCount++;
      }
      return {
        ...group,
        activeCount,
        ownedCount,
        borrowedCount,
        unborrowedCount,
      };
    });
});

const activeFilters = computed(() => {
  const list: {key: string; label: string; clear: () => void}[] = [];
  if (categoryFilter.value !== 'all') {
    list.push({
      key: 'category',
      label: `分类：${FILTER_LABELS[categoryFilter.value]}`,
      clear: () => {
        categoryFilter.value = 'all';
      },
    });
  }
  if (tierFilter.value) {
    list.push({
      key: 'tier',
      label: `等阶：${TIER_LABELS[tierFilter.value]} 阶`,
      clear: () => {
        tierFilter.value = 0;
      },
    });
  }
  if (covenant.value) {
    list.push({
      key: 'covenant',
      label: `盟约：${covenant.value}`,
      clear: () => {
        covenant.value = '';
      },
    });
  }
  if (search.value.trim()) {
    list.push({
      key: 'search',
      label: `搜索：${search.value.trim()}`,
      clear: () => {
        search.value = '';
      },
    });
  }
  return list;
});

const hasAnyMarked = computed(
  () => boxSeasonCount.value > 0 || boxSeasonBorrowedCount.value > 0,
);

function toggleCategory(target: CategoryFilter): void {
  rosterSource.value = 'fixed';
  categoryFilter.value = categoryFilter.value === target ? 'all' : target;
}

async function toggleEditMode(): Promise<void> {
  if (rosterSource.value === 'substitute') rosterSource.value = 'fixed';
  editMode.value = !editMode.value;
  if (!editMode.value) return;

  await nextTick();
  const bar = editorBar.value;
  const filters =
    rosterSource.value === 'selectable'
      ? roster.value?.rosterFilters
      : fixedRosterFilters.value;
  if (!bar || !filters) return;

  // 两份名单都紧接各自的筛选栏。给吸顶导航和可能换行的画笔栏留出实际高度。
  const stickyTop = parseFloat(getComputedStyle(bar).top);
  const listTop = window.scrollY + filters.getBoundingClientRect().bottom;
  bar.focus({preventScroll: true});
  window.scrollTo({
    top: listTop - stickyTop - bar.offsetHeight,
    behavior: prefersReducedMotion() ? 'instant' : 'smooth',
  });
}

function onCardClick(op: Operator): void {
  if (!editMode.value) {
    actions.openDetail('op', op.name);
    return;
  }
  notice.value = '';
  if (currentBrush.value === BOX_RANK_BORROWED && !isBorrowableSixStar(op)) {
    notice.value = `「${op.name}」属于系统预设干员，局内自带本体出战，无需占用助战名额。`;
    return;
  }
  if (isBorrowBrush.value && opRank(op) >= 0) {
    notice.value = `「${op.name}」已持有，会以自有干员出战。`;
    return;
  }
  paintOperator(op.avatar);
}

function paintOperator(avatar: string): void {
  notice.value = '';
  const target = currentBrush.value;
  try {
    setOperatorRank(avatar, rankOfOperator(avatar) === target ? -1 : target);
  } catch (cause) {
    notice.value = cause instanceof Error ? cause.message : '练度更新失败。';
  }
}

const brushTargets = computed(() => {
  if (rosterSource.value === 'selectable')
    return roster.value?.visibleOwnable ?? [];
  if (rosterSource.value === 'substitute') return [];
  return isBorrowBrush.value
    ? filteredOperators.value.filter(
        (op) => isBorrowableSixStar(op) && opRank(op) < 0,
      )
    : filteredOperators.value;
});

function applyBrushToVisible(): void {
  notice.value = '';
  const target = currentBrush.value;
  if (!brushTargets.value.length) {
    notice.value = '当前列表中没有可标记的干员。';
    return;
  }
  try {
    const changed = setOperatorRanks(
      brushTargets.value.map((op) => op.avatar),
      target,
    );
    notice.value = `已更新 ${changed} 名干员为「${BOX_RANK_META[target].label}」。`;
  } catch (cause) {
    notice.value = cause instanceof Error ? cause.message : '批量编辑失败。';
  }
}

function confirmClearAll(): void {
  clearOperatorBox();
  notice.value = '已清空全部干员练度与助战借用标记。';
}

function resetFilters(): void {
  categoryFilter.value = 'all';
  search.value = '';
  covenant.value = '';
  tierFilter.value = 0;
}
</script>

<template>
  <div :class="['bx-tool', 'workbench-controls', {'is-edit': editMode}]">
    <BoxIncomingShare
      v-if="currentRoute.hash.startsWith('#b=')"
      :hash="currentRoute.hash"
      @notice="notice = $event"
      @dismiss="dismissIncomingShare" />

    <section class="nc bx-hero" aria-label="干员练度与助战总览">
      <div class="bx-overview">
        <div class="bx-hero-top">
          <div class="bx-hero-title">
            <div class="bx-headline">
              <span class="bx-kicker">固定干员 · 自持加成激活</span>
              <strong>{{ rankCounts.activated }}</strong>
              <span class="bx-total">/ {{ rankCounts.total }}</span>
              <span class="bx-pct">{{ rankCounts.activatedPct }}%</span>
            </div>
            <p class="bx-subline">
              已持有
              <b>{{ rankCounts.owned }}</b>
              · 未持有
              <b>{{ rankCounts.missing }}</b>
              （已借
              <b
                :class="[
                  'borrow-num',
                  {over: rankCounts.borrowed > BORROW_LIMIT},
                ]">
                {{ rankCounts.borrowed }}/{{ BORROW_LIMIT }}
              </b>
              · 可借 {{ rankCounts.unborrowed }} · 预设
              {{ rankCounts.preset }}）
            </p>
          </div>
          <div class="bx-top-actions">
            <button
              ref="importButton"
              type="button"
              :class="['btn', {p: importOpen}]"
              :aria-expanded="importOpen"
              @click="showImport(!importOpen)">
              导入 MAA / 名单
            </button>
            <button
              v-if="hasAnyBox"
              type="button"
              :class="['btn', {p: syncOpen}]"
              :aria-expanded="syncOpen"
              @click="
                syncOpen = !syncOpen;
                if (syncOpen) importOpen = false;
              ">
              跨端同步
            </button>
            <button
              type="button"
              :class="['btn', 'bx-edit-btn', {active: editMode}]"
              :aria-pressed="editMode"
              @click="toggleEditMode">
              {{ editMode ? '✓ 完成编辑' : '✎ 编辑练度' }}
            </button>
          </div>
        </div>

        <StatusNotice
          v-if="rankCounts.borrowed > BORROW_LIMIT"
          tone="danger"
          :message="`旧记录超出 ${rankCounts.borrowed - BORROW_LIMIT} 个助战名额，请在「已借用」列表取消多出的选择。`" />
        <div
          class="bx-stacked-bar"
          role="img"
          :aria-label="`精二60 ${rankCounts.e260} 名，精二 ${rankCounts.e2} 名，精一 ${rankCounts.e1} 名，未练精0 ${rankCounts.e0} 名，助战已借用 ${rankCounts.borrowed} 名，未借6星 ${rankCounts.unborrowed} 名，系统预设 ${rankCounts.preset} 名`">
          <i
            v-if="rankCounts.wE260 > 0"
            class="seg-r3"
            :style="{width: `${rankCounts.wE260}%`}"></i>
          <i
            v-if="rankCounts.wE2 > 0"
            class="seg-r2"
            :style="{width: `${rankCounts.wE2}%`}"></i>
          <i
            v-if="rankCounts.wE1 > 0"
            class="seg-r1"
            :style="{width: `${rankCounts.wE1}%`}"></i>
          <i
            v-if="rankCounts.wE0 > 0"
            class="seg-r0"
            :style="{width: `${rankCounts.wE0}%`}"></i>
          <i
            v-if="rankCounts.wBorrowed > 0"
            class="seg-rborrowed"
            :style="{width: `${rankCounts.wBorrowed}%`}"></i>
          <i
            v-if="rankCounts.wPreset > 0"
            class="seg-rpreset"
            :style="{width: `${rankCounts.wPreset}%`}"></i>
        </div>

        <BoxSyncPanel v-if="syncOpen && hasAnyBox" @close="syncOpen = false" />
        <BoxImportPanel
          v-if="importStarted"
          :open="importOpen"
          @notice="notice = $event"
          @close="closeImport" />

        <div
          class="bx-pillars"
          role="group"
          aria-label="按持有状态与练度分类筛选">
          <div class="bx-pillar">
            <div class="bx-pillar-head">
              <span class="bx-pillar-title">
                一、已持有
                <b>{{ rankCounts.owned }}</b>
              </span>
              <button
                type="button"
                :class="['bx-scope-btn', {on: categoryFilter === 'owned'}]"
                :aria-pressed="categoryFilter === 'owned'"
                @click="toggleCategory('owned')">
                只看已持有
              </button>
            </div>
            <div class="bx-owned-row">
              <button
                v-for="tier in ownedTiers"
                :key="tier.id"
                type="button"
                :class="[
                  'bx-cat-card',
                  tier.tone,
                  {on: categoryFilter === tier.id},
                ]"
                :aria-pressed="categoryFilter === tier.id"
                @click="toggleCategory(tier.id)">
                <span class="bx-cat-top">
                  <span class="bx-cat-name">
                    <i class="bx-dot"></i>
                    <b>{{ tier.label }}</b>
                  </span>
                  <strong class="bx-cat-num">{{ tier.count }}</strong>
                </span>
                <span class="bx-cat-meta">{{ tier.state }}</span>
              </button>
            </div>
          </div>

          <div class="bx-pillar">
            <div class="bx-pillar-head">
              <span class="bx-pillar-title">
                二、未持有
                <b>{{ rankCounts.missing }}</b>
                <small>含 {{ BORROWABLE_SIX_STARS.length }} 名可借池 6★</small>
              </span>
              <span class="bx-pillar-actions">
                <span
                  :class="[
                    'bx-quota-pill',
                    {over: rankCounts.borrowed > BORROW_LIMIT},
                  ]">
                  助战已借 {{ rankCounts.borrowed }} / {{ BORROW_LIMIT }}
                </span>
                <button
                  type="button"
                  :class="['bx-scope-btn', {on: categoryFilter === 'missing'}]"
                  :aria-pressed="categoryFilter === 'missing'"
                  @click="toggleCategory('missing')">
                  只看未持有
                </button>
              </span>
            </div>
            <div class="bx-missing-row">
              <button
                type="button"
                :class="[
                  'bx-cat-card',
                  'rborrowed',
                  {on: categoryFilter === 'borrowed'},
                ]"
                :aria-pressed="categoryFilter === 'borrowed'"
                @click="toggleCategory('borrowed')">
                <span class="bx-cat-top">
                  <span class="bx-cat-name">
                    <i class="bx-dot"></i>
                    <b>已借用 6★</b>
                  </span>
                  <strong class="bx-cat-num">{{ rankCounts.borrowed }}</strong>
                </span>
                <span class="bx-cat-meta">助战本体 · 等效精0</span>
              </button>
              <button
                type="button"
                :class="[
                  'bx-cat-card',
                  'runborrowed',
                  {on: categoryFilter === 'unborrowed'},
                ]"
                :aria-pressed="categoryFilter === 'unborrowed'"
                @click="toggleCategory('unborrowed')">
                <span class="bx-cat-top">
                  <span class="bx-cat-name">
                    <i class="bx-dot"></i>
                    <b>可借用 6★</b>
                  </span>
                  <strong class="bx-cat-num">
                    {{ rankCounts.unborrowed }}
                  </strong>
                </span>
                <span class="bx-cat-meta">尚未借用 · 不借则替补</span>
              </button>
              <button
                type="button"
                :class="[
                  'bx-cat-card',
                  'rpreset',
                  {on: categoryFilter === 'preset'},
                ]"
                :aria-pressed="categoryFilter === 'preset'"
                @click="toggleCategory('preset')">
                <span class="bx-cat-top">
                  <span class="bx-cat-name">
                    <i class="bx-dot"></i>
                    <b>系统预设</b>
                  </span>
                  <strong class="bx-cat-num">{{ rankCounts.preset }}</strong>
                </span>
                <span class="bx-cat-meta">
                  免借直出 · 含 {{ rankCounts.presetSix }}/{{
                    PRESET_SIX_STARS.length
                  }}
                  特许 6★
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <BoxBonusRules />
    </section>

    <section
      v-if="editMode"
      ref="editorBar"
      tabindex="-1"
      class="nc bx-editor-bar panel-reveal"
      aria-label="画笔标注模式工具栏">
      <div class="bx-editor-row">
        <div class="bx-brush">
          <span class="bx-edit-badge">标注模式</span>
          <Segmented
            :labels="brushes.map((b) => b.label)"
            :active="brushIndex"
            attr="box-brush"
            @change="brushIndex = $event" />
        </div>
        <div class="bx-actions">
          <ConfirmButton
            v-if="currentBrush === -1"
            label="当前列表全标「未持有」"
            :confirm-label="`清除筛选内 ${brushTargets.length} 人的标记`"
            :disabled="!brushTargets.length"
            :reset-key="brushTargets"
            @confirm="applyBrushToVisible" />
          <button
            v-else
            type="button"
            class="btn"
            :disabled="!brushTargets.length"
            @click="applyBrushToVisible">
            当前列表全标「{{ brushes[brushIndex].label }}」
          </button>
          <ConfirmButton
            v-if="hasAnyMarked"
            label="清空全部"
            confirm-label="确认清空"
            :reset-key="`${rosterSource}:${editMode}`"
            @confirm="confirmClearAll" />
          <button type="button" class="btn p" @click="toggleEditMode">
            完成编辑
          </button>
        </div>
      </div>
      <p class="bx-editor-hint">
        <template v-if="isBorrowBrush">
          「已借用」画笔适用于
          {{ BORROWABLE_SIX_STARS.length }}
          名非特许六星，批量标记会跳过已持有干员（当前已借
          <b>{{ rankCounts.borrowed }} / {{ BORROW_LIMIT }}</b>
          名）；借用干员在局内无自持加成，属性等效精0。
        </template>
        <template v-else>
          点干员卡片标为「{{
            brushes[brushIndex].label
          }}」，再点一次退回未持有。
        </template>
      </p>
    </section>

    <OperatorRosterSources
      ref="roster"
      v-model="rosterSource"
      panel-id="box-roster-panel"
      :tab-level="2"
      show-ranks
      :brush="editMode ? currentBrush : undefined"
      @paint="paintOperator"
      @switch="rosterDir = $event" />
    <StatusNotice
      v-if="notice"
      tone="info"
      :message="notice"
      dismissible
      @dismiss="notice = ''" />
    <div
      v-if="rosterSource === 'fixed'"
      v-bind="
        ADDITIONAL_OPERATORS.length
          ? subTabPanelAttrs('box-roster-panel', rosterSource)
          : undefined
      "
      :class="['bx-fixed-pane', {'subtab-panel': !!rosterDir}]"
      :data-dir="rosterDir || undefined">
      <BoxPlannerPanel />
      <section
        ref="fixedRosterFilters"
        class="nc bx-toolbar"
        aria-label="列表筛选与分组">
        <div class="bx-filter-row">
          <SearchInput
            v-model="search"
            class="bx-search"
            placeholder="搜干员名 / 拼音 / 盟约 / 替补干员…"
            aria-label="搜索干员" />
          <SelectInput
            v-model="tierFilter"
            :options="TIER_FILTER_OPTIONS"
            highlight-active
            aria-label="按等阶筛选" />
          <SelectInput
            v-model="covenant"
            :options="COVENANT_FILTER_OPTIONS"
            highlight-active
            aria-label="按盟约筛选" />
          <Segmented
            :labels="GROUP_MODE_LABELS"
            :active="groupModeIndex"
            attr="box-group-mode"
            aria-label="干员分组方式"
            @change="groupModeIndex = $event" />
          <span class="bx-count">
            共
            <b>{{ filteredOperators.length }}</b>
            名
          </span>
        </div>

        <div v-if="activeFilters.length" class="bx-active-filters">
          <span class="bx-kicker">当前筛选</span>
          <button
            v-for="item in activeFilters"
            :key="item.key"
            type="button"
            class="bx-filter-chip"
            :title="`清除${item.label}`"
            @click="item.clear()">
            <span>{{ item.label }}</span>
            <i aria-hidden="true">×</i>
          </button>
          <button type="button" class="bx-clear-all" @click="resetFilters">
            重置全部
          </button>
        </div>
      </section>

      <div class="bx-groups">
        <template v-if="groupMode === 'status'">
          <section
            v-for="group in statusGroups"
            :key="group.id"
            class="bx-group">
            <SectionHeading
              variant="dot"
              :accent="BUCKET_ACCENT[group.id]"
              :title="group.title"
              :count="
                group.id === 'borrowed'
                  ? `${group.items.length} / ${BORROW_LIMIT} 名`
                  : `${group.items.length} 名`
              "
              :count-tone="
                group.id === 'borrowed' && rankCounts.borrowed > BORROW_LIMIT
                  ? 'danger'
                  : 'default'
              "
              :desc="group.desc"
              :level="3" />

            <div class="bx-grid">
              <BoxOperatorCard
                v-for="op in group.items"
                :key="op.avatar"
                :op="op"
                :rank="opRank(op)"
                :brush="editMode ? currentBrush : undefined"
                @activate="onCardClick" />
            </div>
          </section>
        </template>

        <template v-else>
          <section
            v-for="group in rosterGroups"
            :key="group.title"
            class="bx-group">
            <header class="bx-group-head" :data-t="group.tier">
              <i v-if="group.tier" class="bx-tier-badge">{{ group.title }}</i>
              <h3
                v-else
                class="bx-group-title bx-covenant-title"
                :style="{color: color(group.title)}">
                <CovenantIcon :name="group.title" />
                {{ group.title }}
              </h3>
              <span class="bx-group-desc">
                已激活
                <b>{{ group.activeCount }}</b>
                · 自持 {{ group.ownedCount }} / {{ group.items.length }} 名
                <template v-if="group.borrowedCount > 0">
                  ·
                  <em class="bx-tier-borrowed">
                    已借 {{ group.borrowedCount }} 名
                  </em>
                </template>
                <template v-if="group.unborrowedCount > 0">
                  ·
                  <em class="bx-tier-unborrowed">
                    可借 6★ {{ group.unborrowedCount }} 名
                  </em>
                </template>
              </span>
              <span class="bx-group-line" aria-hidden="true"></span>
            </header>

            <div class="bx-grid">
              <BoxOperatorCard
                v-for="op in group.items"
                :key="op.avatar"
                :op="op"
                :rank="opRank(op)"
                :brush="editMode ? currentBrush : undefined"
                :hide-tier="!!group.tier"
                @activate="onCardClick" />
            </div>
          </section>
        </template>

        <EmptyState
          v-if="!filteredOperators.length"
          card
          message="当前筛选下没有匹配的干员"
          action-label="重置筛选条件"
          @action="resetFilters" />
      </div>

      <p class="nt-footnote">
        固定名单共
        {{ rankCounts.total }}
        名可持有干员。默认处于安全浏览模式，点干员卡片看详情；点击「✎
        编辑练度」可标记自持等级或助战借用。数据仅存本机浏览器，可在「设置 →
        配置备份」随配置迁移。
      </p>
    </div>
  </div>
</template>

<style scoped>
.bx-fixed-pane {
  display: grid;
  gap: 12px;
  min-width: 0;
}
.bx-tool {
  /* 高对比度七色体系：仅「未借用 6★（局内无法用本体）」用灰色，其余可用本体的类别各占独立色相 */
  --bx-r3: #c96f00;
  --bx-r3-ink: #ffffff;
  --bx-r2: #059669;
  --bx-r1: #2563eb;
  --bx-r0: #7c3aed;
  --bx-borrowed: #db2777;
  --bx-borrowed-ink: #ffffff;
  --bx-preset: #0891b2;
  --bx-preset-ink: #ffffff;
  --bx-unborrowed: #64748b;
  container: box-tools / inline-size;
  display: grid;
  gap: 12px;
  min-width: 0;
}
:global(:root[data-theme='dark'] .bx-tool) {
  --bx-r3: #fbbf24;
  --bx-r3-ink: #1b1306;
  --bx-r2: #34d399;
  --bx-r1: #60a5fa;
  --bx-r0: #c084fc;
  --bx-borrowed: #f472b6;
  --bx-borrowed-ink: #270618;
  --bx-preset: #22d3ee;
  --bx-preset-ink: #04252d;
  --bx-unborrowed: #94a3b8;
}
@media (prefers-color-scheme: dark) {
  :global(:root:not([data-theme='light']) .bx-tool) {
    --bx-r3: #fbbf24;
    --bx-r3-ink: #1b1306;
    --bx-r2: #34d399;
    --bx-r1: #60a5fa;
    --bx-r0: #c084fc;
    --bx-borrowed: #f472b6;
    --bx-borrowed-ink: #270618;
    --bx-preset: #22d3ee;
    --bx-preset-ink: #04252d;
    --bx-unborrowed: #94a3b8;
  }
}

:deep(.bx-kicker) {
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--ink3);
  white-space: nowrap;
}

/* ---------- 顶部双栏总览：左（进度 + 三大来源分类筛选） / 右（第一版等级加成对照表） ---------- */
.bx-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(290px, 0.75fr);
  gap: 14px 16px;
  align-items: start;
  padding: 14px 16px;
}
.bx-overview {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 10px;
  min-width: 0;
}
.bx-hero-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px 12px;
  flex-wrap: wrap;
}
.bx-hero-title {
  display: grid;
  gap: 2px;
}
.bx-headline {
  display: flex;
  align-items: baseline;
  gap: 6px;
  flex-wrap: wrap;
}
.bx-headline strong {
  font: 700 28px/1 var(--fn);
  color: var(--teal);
}
.bx-total {
  font: 600 15px/1 var(--fn);
  color: var(--ink3);
}
.bx-pct {
  padding: 2px 7px;
  border-radius: 999px;
  background: var(--teal-soft);
  color: var(--teal);
  font-size: 11.5px;
  font-weight: 700;
}
.bx-subline {
  font-size: 12px;
  color: var(--ink2);
}
.bx-subline b {
  font: 700 13px var(--fn);
  color: var(--ink);
}
.bx-subline .borrow-num {
  color: var(--bx-borrowed);
}
.bx-subline .borrow-num.over {
  color: var(--red);
}
.bx-top-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.bx-top-actions .btn {
  min-height: 36px;
  padding: 5px 11px;
  font-size: 12.5px;
  font-weight: 600;
}
.bx-edit-btn.active {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--accent-ink);
}

.bx-stacked-bar {
  display: flex;
  height: 8px;
  border-radius: 999px;
  overflow: hidden;
  background: var(--surface2);
  border: 1px solid var(--line);
}
.bx-stacked-bar i {
  display: block;
  height: 100%;
  transition: width 0.22s ease;
}
.bx-stacked-bar .seg-r3 {
  background: var(--bx-r3);
}
.bx-stacked-bar .seg-r2 {
  background: var(--bx-r2);
}
.bx-stacked-bar .seg-r1 {
  background: var(--bx-r1);
}
.bx-stacked-bar .seg-r0 {
  background: var(--bx-r0);
}
.bx-stacked-bar .seg-rborrowed {
  background: var(--bx-borrowed);
}
.bx-stacked-bar .seg-rpreset {
  background: color-mix(in srgb, var(--bx-preset) 72%, var(--surface2));
}

/* ---------- 两大分类分区（一、已持有 / 二、未持有） ---------- */
.bx-pillars {
  display: grid;
  gap: 8px;
}
.bx-pillar {
  display: grid;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: var(--surface2);
  align-content: start;
}
.bx-pillar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  flex-wrap: wrap;
  min-height: 24px;
}
.bx-pillar-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.bx-pillar-title {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
  color: var(--ink2);
}
.bx-pillar-title b {
  font: 700 14.5px var(--fn);
  color: var(--ink);
}
.bx-pillar-title small {
  font-size: 11px;
  font-weight: 500;
  color: var(--ink3);
}
.bx-scope-btn {
  min-height: 34px;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--line2);
  background: var(--surface);
  color: var(--ink2);
  font: inherit;
  font-size: 11.5px;
  font-weight: 600;
  transition:
    border-color 0.14s,
    background-color 0.14s,
    color 0.14s;
}
.bx-scope-btn:hover {
  border-color: var(--accent);
  color: var(--ink);
}
.bx-scope-btn.on {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--accent-ink);
}
.bx-quota-pill {
  padding: 2px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--bx-borrowed) 15%, var(--surface));
  color: var(--bx-borrowed);
  font: 700 11.5px var(--fn);
  white-space: nowrap;
}
.bx-quota-pill.over {
  background: color-mix(in srgb, var(--red) 16%, var(--surface));
  color: var(--red);
}

.bx-owned-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}
.bx-missing-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.bx-cat-card {
  display: grid;
  gap: 2px;
  min-height: 46px;
  padding: 6px 8px;
  border-radius: 7px;
  border: 1px solid var(--line);
  border-left: 3px solid var(--line2);
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  text-align: left;
  transition:
    border-color 0.14s,
    background-color 0.14s,
    box-shadow 0.14s;
}
.bx-cat-card:hover {
  border-color: var(--line2);
}
.bx-cat-card.on {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
  background: var(--accent-soft);
}
.bx-cat-card.r3 {
  border-color: color-mix(in srgb, var(--bx-r3) 42%, var(--line));
  border-left-color: var(--bx-r3);
}
.bx-cat-card.r3.on {
  border-color: var(--bx-r3);
  box-shadow: 0 0 0 1px var(--bx-r3);
  background: color-mix(in srgb, var(--bx-r3) 14%, var(--surface));
}
.bx-cat-card.r2 {
  border-color: color-mix(in srgb, var(--bx-r2) 42%, var(--line));
  border-left-color: var(--bx-r2);
}
.bx-cat-card.r2.on {
  border-color: var(--bx-r2);
  box-shadow: 0 0 0 1px var(--bx-r2);
  background: color-mix(in srgb, var(--bx-r2) 14%, var(--surface));
}
.bx-cat-card.r1 {
  border-color: color-mix(in srgb, var(--bx-r1) 42%, var(--line));
  border-left-color: var(--bx-r1);
}
.bx-cat-card.r1.on {
  border-color: var(--bx-r1);
  box-shadow: 0 0 0 1px var(--bx-r1);
  background: color-mix(in srgb, var(--bx-r1) 14%, var(--surface));
}
.bx-cat-card.r0 {
  border-color: color-mix(in srgb, var(--bx-r0) 42%, var(--line));
  border-left-color: var(--bx-r0);
}
.bx-cat-card.r0.on {
  border-color: var(--bx-r0);
  box-shadow: 0 0 0 1px var(--bx-r0);
  background: color-mix(in srgb, var(--bx-r0) 14%, var(--surface));
}
.bx-cat-card.rborrowed {
  border-color: color-mix(in srgb, var(--bx-borrowed) 52%, var(--line));
  border-left-color: var(--bx-borrowed);
  background: color-mix(in srgb, var(--bx-borrowed) 9%, var(--surface));
}
.bx-cat-card.rborrowed.on {
  border-color: var(--bx-borrowed);
  box-shadow: 0 0 0 1px var(--bx-borrowed);
  background: color-mix(in srgb, var(--bx-borrowed) 18%, var(--surface));
}
.bx-cat-card.runborrowed {
  border-style: dashed;
  border-left-style: dashed;
  border-color: color-mix(in srgb, var(--bx-unborrowed) 55%, var(--line));
  border-left-color: var(--bx-unborrowed);
  background: color-mix(in srgb, var(--bx-unborrowed) 8%, var(--surface));
}
.bx-cat-card.runborrowed.on {
  border-style: solid;
  border-color: var(--bx-unborrowed);
  box-shadow: 0 0 0 1px var(--bx-unborrowed);
  background: color-mix(in srgb, var(--bx-unborrowed) 16%, var(--surface));
}
.bx-cat-card.rpreset {
  border-color: color-mix(in srgb, var(--bx-preset) 48%, var(--line));
  border-left-color: var(--bx-preset);
  background: color-mix(in srgb, var(--bx-preset) 8%, var(--surface));
}
.bx-cat-card.rpreset.on {
  border-color: var(--bx-preset);
  box-shadow: 0 0 0 1px var(--bx-preset);
  background: color-mix(in srgb, var(--bx-preset) 16%, var(--surface));
}

.bx-cat-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}
.bx-cat-name {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
}
.bx-cat-name b {
  font-size: 12px;
  font-weight: 700;
  color: var(--ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.bx-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  flex: none;
  background: var(--line2);
}
.bx-cat-card.r3 .bx-dot {
  background: var(--bx-r3);
}
.bx-cat-card.r2 .bx-dot {
  background: var(--bx-r2);
}
.bx-cat-card.r1 .bx-dot {
  background: var(--bx-r1);
}
.bx-cat-card.r0 .bx-dot {
  background: var(--bx-r0);
}
.bx-cat-card.rborrowed .bx-dot {
  background: var(--bx-borrowed);
}
.bx-cat-card.runborrowed .bx-dot {
  background: transparent;
  border: 1.5px dashed var(--bx-unborrowed);
}
.bx-cat-card.rpreset .bx-dot {
  background: var(--bx-preset);
}
.bx-cat-num {
  font: 700 17px/1 var(--fn);
  color: var(--ink);
  flex: none;
}
.bx-cat-card.r3 .bx-cat-num {
  color: var(--bx-r3);
}
.bx-cat-card.r2 .bx-cat-num {
  color: var(--bx-r2);
}
.bx-cat-card.r1 .bx-cat-num {
  color: var(--bx-r1);
}
.bx-cat-card.r0 .bx-cat-num {
  color: var(--bx-r0);
}
.bx-cat-card.rborrowed .bx-cat-num {
  color: var(--bx-borrowed);
}
.bx-cat-card.runborrowed .bx-cat-num {
  color: var(--bx-unborrowed);
}
.bx-cat-card.rpreset .bx-cat-num {
  color: var(--bx-preset);
}
.bx-cat-meta {
  font-size: 10.5px;
  line-height: 1.3;
  color: var(--ink3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ---------- 可开关的编辑画笔工具栏 ---------- */
.bx-editor-bar {
  position: sticky;
  top: var(--qbar-height, 0px);
  z-index: 5;
  align-self: start;
  display: grid;
  gap: 7px;
  padding: 10px 14px;
  border-color: color-mix(in srgb, var(--accent) 55%, var(--line));
  border-left: 3px solid var(--accent);
  background: color-mix(in srgb, var(--accent) 7%, var(--surface));
}
.bx-editor-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.bx-brush {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.bx-edit-badge {
  padding: 3px 8px;
  border-radius: 4px;
  background: var(--accent);
  color: var(--accent-ink);
  font-size: 11.5px;
  font-weight: 700;
  white-space: nowrap;
}
.bx-editor-hint {
  font-size: 12px;
  color: var(--ink2);
}
.bx-editor-hint b {
  font: 700 13px var(--fn);
  color: var(--bx-borrowed);
}
.bx-tool :deep(.bx-actions) {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.bx-tool :deep(.bx-actions .btn) {
  min-height: 34px;
  padding: 4px 10px;
  font-size: 12.5px;
}

/* ---------- 精简筛选栏 + 当前激活条件 ---------- */
.bx-toolbar {
  display: grid;
  gap: 8px;
  padding: 10px 14px;
}
.bx-filter-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.bx-filter-row .bx-search {
  flex: 1 1 180px;
  min-width: 130px;
}
.bx-count {
  margin-left: auto;
  font-size: 12px;
  color: var(--ink3);
  white-space: nowrap;
}
.bx-count b {
  font: 700 14px var(--fn);
  color: var(--ink);
}
.bx-active-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding-top: 7px;
  border-top: 1px dashed var(--line);
}
.bx-filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 34px;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--accent) 45%, var(--line));
  background: var(--accent-soft);
  color: var(--ink);
  font: inherit;
  font-size: 11.5px;
  font-weight: 600;
}
.bx-filter-chip i {
  font-style: normal;
  font-size: 13px;
  line-height: 1;
  color: var(--accent);
}
.bx-clear-all {
  min-height: 34px;
  padding: 4px 8px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--ink3);
  font: inherit;
  font-size: 11.5px;
  text-decoration: underline;
}
.bx-clear-all:hover {
  color: var(--ink);
}

/* ---------- 分类列表与干员卡片 ---------- */
.bx-groups {
  display: grid;
  gap: 16px;
}
.bx-group {
  display: grid;
  gap: 8px;
}
.bx-group-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
}
.bx-group-title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--ink);
}
.bx-covenant-title {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.bx-group-desc {
  font-size: 12px;
  color: var(--ink3);
}
.bx-group-desc b {
  font: 700 13px var(--fn);
  color: var(--teal);
}
.bx-tier-borrowed {
  font-style: normal;
  font-weight: 700;
  color: var(--bx-borrowed);
}
.bx-tier-unborrowed {
  font-style: normal;
  font-weight: 600;
  color: var(--bx-unborrowed);
}
.bx-group-line {
  flex: 1 1 32px;
  height: 1px;
  background: var(--line);
}
.bx-tier-badge {
  font-style: normal;
  font: 700 12.5px/1 var(--fn);
  padding: 4px 8px;
  border-radius: 5px;
  background: color-mix(in srgb, var(--tc, var(--ink2)) 16%, var(--surface2));
  color: var(--tc, var(--ink));
  border: 1px solid color-mix(in srgb, var(--tc, var(--line2)) 40%, var(--line));
}

.bx-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(198px, 1fr));
  gap: 8px;
}
/* 标注态多一个独立详情按钮，卡片按实际可用宽度排栏。 */
.bx-tool.is-edit .bx-grid {
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 236px), 1fr));
}

/* ---------- 容器查询与横屏小窗适配 ---------- */
@container box-tools (max-width: 820px) {
  .bx-hero {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }
}
@container box-tools (max-width: 600px) {
  .bx-owned-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .bx-missing-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .bx-missing-row > :last-child {
    grid-column: 1 / -1;
  }
}
@container box-tools (max-width: 520px) {
  .bx-editor-bar {
    padding: 8px;
  }
  .bx-brush {
    width: 100%;
  }
  .bx-edit-badge {
    display: none;
  }
  .bx-brush :deep(.seg) {
    flex: 1;
    gap: 2px;
  }
  .bx-brush :deep(.seg button) {
    flex: auto;
    min-height: 34px;
    padding-inline: 4px;
  }
  .bx-filter-row .bx-search {
    flex-basis: 100%;
  }
  .bx-grid {
    grid-template-columns: repeat(auto-fill, minmax(156px, 1fr));
    gap: 6px;
  }
}
@media (max-height: 600px) {
  .bx-tool {
    gap: 8px;
  }
  .bx-hero {
    padding: 10px 12px;
    gap: 10px;
  }
  .bx-headline strong {
    font-size: 22px;
  }
  .bx-top-actions .btn {
    min-height: 34px;
    padding: 4px 10px;
  }
  .bx-pillar {
    padding: 6px 8px;
    gap: 5px;
  }
  .bx-cat-card {
    min-height: 40px;
    padding: 4px 7px;
  }
  .bx-cat-num {
    font-size: 15.5px;
  }
  .bx-editor-bar,
  .bx-toolbar {
    padding: 8px 10px;
    gap: 6px;
  }
  .bx-editor-hint,
  .bx-group-desc {
    display: none;
  }
  .bx-grid {
    grid-template-columns: repeat(auto-fill, minmax(176px, 1fr));
    gap: 6px;
  }
}
</style>
