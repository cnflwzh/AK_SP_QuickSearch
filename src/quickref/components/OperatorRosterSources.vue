<script lang="ts">
export type RosterSource = 'fixed' | 'selectable' | 'substitute';
</script>

<script setup lang="ts">
import {computed, ref, watch} from 'vue';
import {
  ADDITIONAL_OPERATORS,
  ALL_COVENANTS,
  OPERATORS,
  SELECTION_LIMITS,
  TIER_LABELS,
  type AdditionalOperator,
  type Operator,
} from '../../../data/index.ts';
import {
  BOX_OPERATORS,
  BOX_RANK_META,
  type BoxRank,
} from '../../lib/box/model.ts';
import {rankOfOperator} from '../../lib/box/store.ts';
import {avatarSrc} from '../../lib/ui/assets.ts';
import {nameScore, normalize} from '../../lib/ui/match.ts';
import {cardLocation} from '../../router/navigation.ts';
import {color} from '../format.ts';
import {useQuickrefActions} from '../state.ts';
import Chip from './Chip.vue';
import NavigationLink from './NavigationLink.vue';
import PrtsLink from './PrtsLink.vue';
import SubTabs, {type SubTabDirection, type SubTabItem} from './SubTabs.vue';
import SearchInput from './SearchInput.vue';
import SelectInput, {type SelectOption} from './SelectInput.vue';
import SectionHeading from './SectionHeading.vue';
import EmptyState from './EmptyState.vue';

const rosterFilters = ref<HTMLElement>();
const source = defineModel<RosterSource>({required: true});
const props = withDefaults(
  defineProps<{
    showRanks?: boolean;
    brush?: BoxRank;
    tabLevel?: 2 | 3;
    focusName?: string;
  }>(),
  {tabLevel: 2},
);
const emit = defineEmits<{
  paint: [avatar: string];
  switch: [direction: SubTabDirection];
}>();
const actions = useQuickrefActions();

type SelectableScope = 'all' | 'operator' | 'system';
type SubstituteScope = 'all' | 'system' | 'reserve';

const SELECTABLE_SCOPE_TABS: readonly SubTabItem<SelectableScope>[] = [
  {id: 'all', label: '全部'},
  {id: 'operator', label: '自有六星'},
  {id: 'system', label: '系统原型'},
];
const SUBSTITUTE_SCOPE_TABS: readonly SubTabItem<SubstituteScope>[] = [
  {id: 'all', label: '全部'},
  {id: 'system', label: '6★ 特派原型'},
  {id: 'reserve', label: '4★ 预备干员'},
];

const query = ref('');
const covenant = ref('');
const selectableScope = ref<SelectableScope>('all');
const substituteScope = ref<SubstituteScope>('all');
const expandedSubstitutes = ref(new Set<string>());
const panelDir = ref<SubTabDirection>('');
const search = computed(() => normalize(query.value));

function onSourceChange(_id: RosterSource, dir: SubTabDirection): void {
  panelDir.value = dir;
  emit('switch', dir);
}

// 同一次路由导航可能同时更新来源和目标，合并监听以免来源切换抹掉定位词。
watch(
  [source, () => props.focusName],
  ([, name], [, previousName]) => {
    resetLocalFilters();
    expandedSubstitutes.value = new Set();
    if (name && name !== previousName) query.value = name;
  },
  {immediate: true},
);

const choices = ADDITIONAL_OPERATORS.filter((op) => op.source !== 'reserve');
const ownable = choices.filter((op) => op.source === 'operator');
const systemChoices = choices.filter((op) => op.source === 'system');

interface SubstituteEntry extends AdditionalOperator {
  readonly slots: readonly Operator[];
  readonly tierSpan: string;
}

function formatTierSpan(slots: readonly Operator[]): string {
  if (!slots.length) return '';
  let min = slots[0].tier;
  let max = slots[0].tier;
  for (const slot of slots) {
    if (slot.tier < min) min = slot.tier;
    if (slot.tier > max) max = slot.tier;
  }
  return min === max
    ? `${TIER_LABELS[min]} 阶`
    : `${TIER_LABELS[min]}–${TIER_LABELS[max]} 阶`;
}

const substitutes: readonly SubstituteEntry[] = ADDITIONAL_OPERATORS.filter(
  (op) => op.source !== 'operator',
)
  .map((op) => {
    const slots = OPERATORS.filter((slot) => slot.backupOperator === op.name)
      .slice()
      .sort((a, b) => b.tier - a.tier);
    return {
      ...op,
      slots,
      tierSpan: formatTierSpan(slots),
    };
  })
  .filter((op) => op.slots.length > 0);

const eliteSubstitutesCount = substitutes.filter(
  (op) => op.source === 'system',
).length;
const reserveSubstitutesCount = substitutes.filter(
  (op) => op.source === 'reserve',
).length;
const totalCoveredSlots = substitutes.reduce(
  (sum, op) => sum + op.slots.length,
  0,
);

const sourceTabs = computed(() => [
  {
    id: 'fixed' as const,
    label: '固定干员',
    count: props.showRanks ? BOX_OPERATORS.length : OPERATORS.length,
  },
  {
    id: 'selectable' as const,
    label: '自选干员',
    count: choices.length,
  },
  {
    id: 'substitute' as const,
    label: '替补干员',
    count: substitutes.length,
  },
]);

const matchesName = (name: string) =>
  !search.value || nameScore(name, search.value) > 0;
const matchesCovenants = (names: readonly string[]) =>
  !covenant.value || names.includes(covenant.value);

const focusedName = computed(() =>
  props.focusName && normalize(props.focusName) === search.value
    ? props.focusName
    : '',
);
const filteredChoices = computed(() =>
  choices.filter(
    (op) =>
      (!focusedName.value || op.name === focusedName.value) &&
      (selectableScope.value === 'all' ||
        op.source === selectableScope.value) &&
      matchesCovenants(op.covenants) &&
      (matchesName(op.name) || op.covenants.some(matchesName)),
  ),
);

const choiceGroups = computed(() => {
  const operatorItems = filteredChoices.value.filter(
    (op) => op.source === 'operator',
  );
  const systemItems = filteredChoices.value.filter(
    (op) => op.source === 'system',
  );
  return [
    {
      id: 'operator',
      title: '自有六星',
      desc: '从自己持有的六星干员中预选入池',
      tone: 'ownable',
      items: operatorItems,
    },
    {
      id: 'system',
      title: '系统特派原型',
      desc: '无需持有，系统直接提供自选（归属协防干员）',
      tone: 'system',
      items: systemItems,
    },
  ].filter((g) => g.items.length > 0);
});

const filteredSubstitutes = computed(() =>
  substitutes
    .filter(
      (op) =>
        (!focusedName.value || op.name === focusedName.value) &&
        (substituteScope.value === 'all' ||
          op.source === substituteScope.value),
    )
    .map((op) => ({
      ...op,
      slots: op.slots.filter(
        (slot) =>
          matchesCovenants(slot.covenants) &&
          (matchesName(op.name) ||
            matchesName(slot.name) ||
            slot.covenants.some(matchesName)),
      ),
    }))
    .filter((op) => op.slots.length > 0),
);

// 闭合的替补卡只渲染摘要。搜索命中时直接展开对应关系，手动收起仍然有效。
watch(
  [search, covenant, substituteScope, source],
  () => {
    expandedSubstitutes.value = new Set(
      source.value === 'substitute' && (search.value || covenant.value)
        ? filteredSubstitutes.value.map((op) => op.avatar)
        : [],
    );
  },
  {immediate: true},
);

const allSubstitutesExpanded = computed(
  () =>
    filteredSubstitutes.value.length > 0 &&
    filteredSubstitutes.value.every((op) =>
      expandedSubstitutes.value.has(op.avatar),
    ),
);

function toggleAllSubstitutes(): void {
  expandedSubstitutes.value = new Set(
    allSubstitutesExpanded.value
      ? []
      : filteredSubstitutes.value.map((op) => op.avatar),
  );
}

function toggleSubstitute(avatar: string): void {
  if (expandedSubstitutes.value.has(avatar))
    expandedSubstitutes.value.delete(avatar);
  else expandedSubstitutes.value.add(avatar);
}

const substituteGroups = computed(() => {
  const eliteItems = filteredSubstitutes.value.filter(
    (op) => op.source === 'system',
  );
  const reserveItems = filteredSubstitutes.value.filter(
    (op) => op.source === 'reserve',
  );
  return [
    {
      id: 'system',
      title: '罗德岛特派干员 · 6★ 原型',
      desc: '替补未持有且未借用的主力六星干员',
      tone: 'system',
      items: eliteItems,
    },
    {
      id: 'reserve',
      title: '罗德岛预备干员 · 4★ 原型',
      desc: '替补部分未持有且未借用的六星干员',
      tone: 'reserve',
      items: reserveItems,
    },
  ].filter((g) => g.items.length > 0);
});

const filterCovenants = computed(() =>
  source.value === 'substitute'
    ? ALL_COVENANTS
    : ALL_COVENANTS.filter((name) =>
        choices.some((op) => op.covenants.includes(name)),
      ),
);
const filterCovenantOptions = computed<readonly SelectOption<string>[]>(() => [
  {value: '', label: '全部盟约'},
  ...filterCovenants.value.map((name) => ({value: name, label: name})),
]);

const visibleOwnable = computed(() =>
  filteredChoices.value.filter((op) => op.source === 'operator'),
);

const ownedCount = computed(
  () => ownable.filter((op) => rankOfOperator(op.avatar) >= 0).length,
);

const hasActiveFilter = computed(
  () =>
    !!query.value.trim() ||
    !!covenant.value ||
    (source.value === 'selectable' && selectableScope.value !== 'all') ||
    (source.value === 'substitute' && substituteScope.value !== 'all'),
);

function resetLocalFilters(): void {
  query.value = '';
  covenant.value = '';
  selectableScope.value = 'all';
  substituteScope.value = 'all';
}

function choiceCardTone(op: AdditionalOperator): string {
  if (op.source === 'system') return 'is-system';
  if (!props.showRanks) return 'is-browse';
  const rank = rankOfOperator(op.avatar);
  return rank >= 0 ? `rank-${rank}` : 'rank-missing';
}

function choiceAccentStyle(
  op: AdditionalOperator,
): Record<string, string> | undefined {
  if (op.source === 'system' || props.showRanks) return undefined;
  const primaryCov = op.covenants[0];
  return primaryCov ? {'--card-accent': color(primaryCov)} : undefined;
}

// 批量画笔只作用于当前筛选可见的自有六星。
defineExpose({visibleOwnable, rosterFilters});
</script>

<template>
  <div v-if="ADDITIONAL_OPERATORS.length" class="rs-wrap">
    <SubTabs
      v-model="source"
      :items="sourceTabs"
      :level="tabLevel"
      aria-label="干员来源"
      attr="roster-source"
      @change="onSourceChange" />

    <section
      v-if="source !== 'fixed'"
      :key="source"
      class="rs-panel subtab-panel"
      :data-dir="panelDir || undefined"
      :aria-label="source === 'selectable' ? '自选干员名单' : '替补对应表'">
      <header ref="rosterFilters" class="nc rs-hero">
        <div class="rs-hero-main">
          <div class="rs-hero-title">
            <h3>
              {{ source === 'selectable' ? '自选干员名单' : '替补干员对照表' }}
            </h3>
            <span
              v-if="showRanks && source === 'selectable'"
              class="rs-stat-pill own">
              已持有自有六星
              <b>{{ ownedCount }}</b>
              / {{ ownable.length }}
            </span>
            <span v-else-if="source === 'selectable'" class="rs-stat-pill">
              自有六星
              <b>{{ ownable.length }}</b>
              · 系统原型
              <b>{{ systemChoices.length }}</b>
            </span>
            <span v-else class="rs-stat-pill">
              特派原型
              <b>{{ eliteSubstitutesCount }}</b>
              · 预备干员
              <b>{{ reserveSubstitutesCount }}</b>
              · 覆盖
              <b>{{ totalCoveredSlots }}</b>
              位 6★
            </span>
          </div>

          <div v-if="source === 'selectable'" class="rs-rule-pills">
            <span
              v-for="limit in SELECTION_LIMITS"
              :key="limit.tier"
              class="rs-rule-pill"
              :data-t="limit.tier">
              <i class="tn">{{ TIER_LABELS[limit.tier] }} 阶</i>
              <span>预选 {{ limit.slots }} · 每局 ≤{{ limit.perRun }}</span>
            </span>
            <span class="rs-rule-note">仅带所属盟约，无棋子特质</span>
          </div>
          <p v-else class="rs-hero-desc">
            未持有且未借用非特许 6★
            时，局内由对应原型替补上场，继承原干员的等阶、盟约与特质；点击任意原干员可查看完整详情。
          </p>
        </div>

        <div class="rs-bar">
          <SubTabs
            v-if="source === 'selectable'"
            v-model="selectableScope"
            :items="SELECTABLE_SCOPE_TABS"
            :level="3"
            inline
            aria-label="自选干员分类"
            attr="rs-choice-scope" />
          <SubTabs
            v-else
            v-model="substituteScope"
            :items="SUBSTITUTE_SCOPE_TABS"
            :level="3"
            inline
            aria-label="替补干员分类"
            attr="rs-sub-scope" />
          <SearchInput
            v-model="query"
            class="rs-search"
            :aria-label="
              source === 'selectable' ? '搜索自选干员' : '搜索替补关系'
            "
            :placeholder="
              source === 'selectable'
                ? '搜干员名 / 拼音 / 盟约…'
                : '搜原型名 / 原干员 / 盟约…'
            " />
          <SelectInput
            v-model="covenant"
            :options="filterCovenantOptions"
            highlight-active
            aria-label="筛选名单盟约" />
          <button
            v-if="source === 'substitute' && filteredSubstitutes.length"
            type="button"
            class="rs-btn"
            :aria-pressed="allSubstitutesExpanded"
            @click="toggleAllSubstitutes">
            {{ allSubstitutesExpanded ? '全部收起' : '全部展开' }}
          </button>
          <button
            v-if="hasActiveFilter"
            type="button"
            class="rs-btn"
            @click="resetLocalFilters">
            重置
          </button>
          <span class="rs-cnt">
            共
            <b>
              {{
                source === 'selectable'
                  ? filteredChoices.length
                  : filteredSubstitutes.length
              }}
            </b>
            名
          </span>
        </div>
      </header>

      <div
        v-if="source === 'selectable' && choiceGroups.length"
        class="rs-sections">
        <section
          v-for="group in choiceGroups"
          :key="group.id"
          class="rs-section">
          <SectionHeading
            :title="group.title"
            :count="`${group.items.length} 名`"
            :desc="group.desc"
            :accent="
              group.tone === 'system' ? 'var(--rs-system)' : 'var(--accent)'
            "
            :level="4" />

          <div class="rs-choice-grid">
            <article
              v-for="op in group.items"
              :key="op.avatar"
              :class="[
                'rs-choice-card',
                choiceCardTone(op),
                {paintable: brush !== undefined && op.source === 'operator'},
              ]"
              :style="choiceAccentStyle(op)">
              <component
                :is="
                  brush !== undefined && op.source === 'operator'
                    ? 'button'
                    : 'div'
                "
                :type="
                  brush !== undefined && op.source === 'operator'
                    ? 'button'
                    : undefined
                "
                class="rs-choice-main"
                :aria-label="
                  brush !== undefined && op.source === 'operator'
                    ? '标注' +
                      op.name +
                      '，当前' +
                      BOX_RANK_META[rankOfOperator(op.avatar)].label
                    : undefined
                "
                @click="
                  brush !== undefined &&
                  op.source === 'operator' &&
                  emit('paint', op.avatar)
                ">
                <span class="rs-av">
                  <img
                    :src="`/assets/img/avatars/${op.avatar}.webp`"
                    width="44"
                    height="44"
                    loading="lazy"
                    decoding="async"
                    alt="" />
                </span>
                <span class="rs-choice-top">
                  <strong class="rs-choice-name">{{ op.name }}</strong>
                  <span v-if="op.source === 'system'" class="rs-badge system">
                    系统提供
                  </span>
                  <span
                    v-else-if="showRanks"
                    :class="[
                      'rs-badge',
                      rankOfOperator(op.avatar) >= 0
                        ? `r${rankOfOperator(op.avatar)}`
                        : 'missing',
                    ]">
                    {{ BOX_RANK_META[rankOfOperator(op.avatar)].label }}
                  </span>
                </span>
                <span class="rs-choice-meta">
                  <span class="rs-covs">
                    <Chip
                      v-for="cov in op.covenants"
                      :key="cov"
                      kind="cv"
                      :name="cov"
                      static />
                  </span>
                  <PrtsLink
                    v-if="op.source === 'operator' && brush === undefined"
                    class="rs-choice-wiki"
                    :name="op.name" />
                </span>
              </component>
            </article>
          </div>
        </section>
      </div>

      <div
        v-else-if="source === 'substitute' && substituteGroups.length"
        class="rs-sections">
        <section
          v-for="group in substituteGroups"
          :key="group.id"
          class="rs-section">
          <SectionHeading
            :title="group.title"
            :count="`${group.items.length} 名`"
            :desc="group.desc"
            :accent="
              group.tone === 'system' ? 'var(--rs-system)' : 'var(--rs-r1)'
            "
            :level="4" />

          <div class="rs-sub-list">
            <details
              v-for="op in group.items"
              :key="op.avatar"
              :class="['rs-sub-card', op.source]"
              :open="expandedSubstitutes.has(op.avatar)">
              <summary
                class="rs-sub-summary"
                @click.prevent="toggleSubstitute(op.avatar)">
                <span class="rs-av sm">
                  <img
                    :src="`/assets/img/avatars/${op.avatar}.webp`"
                    width="40"
                    height="40"
                    loading="lazy"
                    decoding="async"
                    alt="" />
                </span>
                <span class="rs-sub-info">
                  <span class="rs-sub-name-row">
                    <strong>{{ op.name }}</strong>
                    <span :class="['rs-badge', op.source]">
                      {{
                        op.source === 'system' ? '6★ 特派原型' : '4★ 预备干员'
                      }}
                    </span>
                    <span class="rs-sub-tiers">{{ op.tierSpan }}</span>
                  </span>
                  <small class="rs-sub-preview">
                    替补：{{
                      op.slots
                        .slice(0, 5)
                        .map((s) => s.name)
                        .join('、')
                    }}{{
                      op.slots.length > 5 ? ` 等 ${op.slots.length} 名` : ''
                    }}
                  </small>
                </span>
                <span class="rs-sub-right">
                  <span class="rs-slot-count">
                    <b>{{ op.slots.length }}</b>
                    个替补位
                  </span>
                  <svg
                    class="rs-chevron"
                    viewBox="0 0 12 12"
                    width="13"
                    height="13"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true">
                    <path d="M2.5 4.25 6 7.75l3.5-3.5" />
                  </svg>
                </span>
              </summary>

              <div
                v-if="expandedSubstitutes.has(op.avatar)"
                class="rs-sub-slots">
                <NavigationLink
                  v-for="slot in op.slots"
                  :key="slot.avatar"
                  class="rs-slot-card"
                  :data-t="slot.tier"
                  :to="cardLocation('op', slot.name)"
                  :activate="() => actions.openDetail('op', slot.name)">
                  <span class="rs-slot-av">
                    <img
                      v-if="avatarSrc(slot.name)"
                      :src="avatarSrc(slot.name)"
                      width="36"
                      height="36"
                      loading="lazy"
                      decoding="async"
                      alt="" />
                    <i>{{ TIER_LABELS[slot.tier] }}</i>
                  </span>
                  <span class="rs-slot-body">
                    <b>{{ slot.name }}</b>
                    <span class="rs-slot-covs">
                      <Chip
                        v-for="cov in slot.covenants"
                        :key="cov"
                        kind="cv"
                        :name="cov"
                        static />
                    </span>
                  </span>
                </NavigationLink>
              </div>
            </details>
          </div>
        </section>
      </div>

      <EmptyState
        v-else
        card
        message="当前筛选下没有匹配的干员"
        action-label="清空筛选"
        :show-action="hasActiveFilter"
        @action="resetLocalFilters" />
    </section>
  </div>
</template>

<style scoped>
.rs-wrap {
  --rs-r3: #c96f00;
  --rs-r3-ink: #ffffff;
  --rs-r2: #059669;
  --rs-r1: #2563eb;
  --rs-r0: #7c3aed;
  --rs-system: #0891b2;
  --rs-system-ink: #ffffff;
  --rs-missing: #64748b;
  container: extra-roster / inline-size;
  display: grid;
  gap: 10px;
  margin-bottom: 10px;
  min-width: 0;
}
:global(:root[data-theme='dark'] .rs-wrap) {
  --rs-r3: #fbbf24;
  --rs-r3-ink: #1b1306;
  --rs-r2: #34d399;
  --rs-r1: #60a5fa;
  --rs-r0: #c084fc;
  --rs-system: #22d3ee;
  --rs-system-ink: #04252d;
  --rs-missing: #94a3b8;
}
@media (prefers-color-scheme: dark) {
  :global(:root:not([data-theme='light']) .rs-wrap) {
    --rs-r3: #fbbf24;
    --rs-r3-ink: #1b1306;
    --rs-r2: #34d399;
    --rs-r1: #60a5fa;
    --rs-r0: #c084fc;
    --rs-system: #22d3ee;
    --rs-system-ink: #04252d;
    --rs-missing: #94a3b8;
  }
}

/* ---------- 面板头部与筛选栏 ---------- */
.rs-panel {
  display: grid;
  gap: 12px;
  min-width: 0;
}
.rs-hero {
  display: grid;
  gap: 10px;
  padding: 12px 14px;
}
.rs-hero-main {
  display: grid;
  gap: 7px;
}
.rs-hero-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
  flex-wrap: wrap;
}
.rs-hero-title h3 {
  margin: 0;
  font-size: 15.5px;
  font-weight: 700;
  color: var(--ink);
}
.rs-stat-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--surface2);
  color: var(--ink2);
  font-size: 12px;
}
.rs-stat-pill b {
  font: 700 13.5px var(--fn);
  color: var(--ink);
}
.rs-stat-pill.own {
  border-color: color-mix(in srgb, var(--teal) 45%, var(--line));
  background: var(--teal-soft);
  color: var(--teal);
}
.rs-stat-pill.own b {
  color: var(--teal);
}
.rs-rule-pills {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
}
.rs-rule-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px 3px 4px;
  border-radius: 6px;
  border: 1px solid color-mix(in srgb, var(--tc, var(--line2)) 45%, var(--line));
  background: var(--surface2);
  font-size: 12px;
  color: var(--ink2);
}
.rs-rule-pill .tn {
  font-family: var(--fn);
  font-style: normal;
  font-weight: 700;
  font-size: 11.5px;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--tc, var(--teal));
  color: #fff;
}
.rs-rule-note,
.rs-hero-desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--ink3);
}

.rs-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding-top: 9px;
  border-top: 1px dashed var(--line);
}
.rs-search {
  flex: 1 1 170px;
  min-width: 120px;
}
.rs-bar :deep(.q-select) {
  min-width: 112px;
}
.rs-btn {
  min-height: 34px;
  padding: 4px 10px;
  border: 1px solid var(--line2);
  border-radius: 6px;
  background: var(--surface);
  color: var(--ink2);
  font: inherit;
  font-size: 12.5px;
  cursor: pointer;
  white-space: nowrap;
}
.rs-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.rs-cnt {
  margin-left: auto;
  font-size: 12px;
  color: var(--ink3);
  white-space: nowrap;
}
.rs-cnt b {
  font: 700 14px var(--fn);
  color: var(--ink);
}

/* ---------- 分组容器 ---------- */
.rs-sections {
  display: grid;
  gap: 14px;
}
.rs-section {
  display: grid;
  gap: 8px;
}

/* ---------- 自选干员卡片网格 ---------- */
.rs-choice-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 218px), 1fr));
  gap: 8px;
}
.rs-choice-card {
  --card-accent: var(--line2);
  display: flex;
  align-items: stretch;
  border: 1px solid var(--line);
  border-left: 3px solid var(--card-accent);
  border-radius: 8px;
  background: var(--surface);
  overflow: hidden;
  transition:
    border-color 0.14s,
    background-color 0.14s,
    transform 0.12s;
}
@media (hover: hover) {
  .rs-choice-card:hover {
    border-color: var(--accent);
    transform: translateY(-1px);
  }
}
.rs-choice-card.is-system {
  --card-accent: var(--rs-system);
  border-color: color-mix(in srgb, var(--rs-system) 44%, var(--line));
  background: color-mix(in srgb, var(--rs-system) 6%, var(--surface));
}
.rs-choice-card.rank-3 {
  --card-accent: var(--rs-r3);
  border-color: color-mix(in srgb, var(--rs-r3) 52%, var(--line));
  background: color-mix(in srgb, var(--rs-r3) 9%, var(--surface));
}
.rs-choice-card.rank-2 {
  --card-accent: var(--rs-r2);
  border-color: color-mix(in srgb, var(--rs-r2) 48%, var(--line));
  background: color-mix(in srgb, var(--rs-r2) 8%, var(--surface));
}
.rs-choice-card.rank-1 {
  --card-accent: var(--rs-r1);
  border-color: color-mix(in srgb, var(--rs-r1) 46%, var(--line));
  background: color-mix(in srgb, var(--rs-r1) 7%, var(--surface));
}
.rs-choice-card.rank-0 {
  --card-accent: var(--rs-r0);
  border-color: color-mix(in srgb, var(--rs-r0) 46%, var(--line));
  background: color-mix(in srgb, var(--rs-r0) 7%, var(--surface));
}
.rs-choice-card.rank-missing {
  --card-accent: var(--rs-missing);
  border-style: dashed;
  border-left-style: dashed;
  background: color-mix(in srgb, var(--surface2) 78%, var(--surface));
}
.rs-choice-card.rank-missing .rs-av img {
  filter: grayscale(0.85);
  opacity: 0.52;
}
.rs-choice-card.rank-missing .rs-choice-name {
  color: var(--ink3);
}

.rs-choice-main {
  flex: 1;
  min-width: 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-content: center;
  align-items: center;
  gap: 3px 9px;
  padding: 7px 8px;
  border: 0;
  background: transparent;
  color: var(--ink);
  font: inherit;
  text-align: left;
}
button.rs-choice-main {
  cursor: pointer;
}
.rs-av {
  flex: 0 0 42px;
  width: 42px;
  height: 42px;
  border-radius: 6px;
  overflow: hidden;
  border: 1.5px solid color-mix(in srgb, var(--card-accent) 60%, var(--line));
  background: var(--surface2);
}
.rs-av.sm {
  flex-basis: 38px;
  width: 38px;
  height: 38px;
}
.rs-av img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.rs-choice-main > .rs-av {
  grid-row: span 2;
}
.rs-choice-top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
  min-width: 0;
}
.rs-choice-name {
  font-size: 13.5px;
  line-height: 1.25;
  color: var(--ink);
  overflow-wrap: anywhere;
}
.rs-choice-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 4px;
}
.rs-covs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.rs-covs :deep(.cv) {
  font-size: 11px;
  padding: 0 6px;
}
.rs-choice-wiki {
  margin-inline-start: auto;
  min-height: 34px;
  font-size: 11px;
}

.rs-badge {
  display: inline-flex;
  align-items: center;
  flex: none;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10.5px;
  font-weight: 700;
  line-height: 1.35;
  white-space: nowrap;
}
.rs-badge.system {
  background: var(--rs-system);
  color: var(--rs-system-ink);
}
.rs-badge.reserve {
  background: color-mix(in srgb, var(--rs-r1) 16%, var(--surface));
  color: var(--rs-r1);
}
.rs-badge.r3 {
  background: var(--rs-r3);
  color: var(--rs-r3-ink);
}
.rs-badge.r2 {
  background: color-mix(in srgb, var(--rs-r2) 18%, var(--surface));
  color: var(--rs-r2);
}
.rs-badge.r1 {
  background: color-mix(in srgb, var(--rs-r1) 18%, var(--surface));
  color: var(--rs-r1);
}
.rs-badge.r0 {
  background: color-mix(in srgb, var(--rs-r0) 18%, var(--surface));
  color: var(--rs-r0);
}
.rs-badge.missing {
  background: color-mix(in srgb, var(--rs-missing) 14%, var(--surface));
  color: var(--rs-missing);
}

/* ---------- 替补干员手风琴卡片 ---------- */
.rs-sub-list {
  display: grid;
  gap: 8px;
}
.rs-sub-card {
  --card-accent: var(--rs-system);
  border: 1px solid var(--line);
  border-left: 3px solid var(--card-accent);
  border-radius: 8px;
  background: var(--surface);
  overflow: hidden;
  transition: border-color 0.14s;
}
.rs-sub-card.reserve {
  --card-accent: var(--rs-r1);
}
.rs-sub-card[open] {
  border-color: color-mix(in srgb, var(--card-accent) 52%, var(--line));
}
.rs-sub-summary {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  cursor: pointer;
  list-style: none;
  user-select: none;
  transition: background-color 0.14s;
}
.rs-sub-summary::-webkit-details-marker {
  display: none;
}
.rs-sub-summary:hover {
  background: var(--surface2);
}
.rs-sub-info {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 2px;
}
.rs-sub-name-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.rs-sub-name-row strong {
  font-size: 14.5px;
  color: var(--ink);
}
.rs-sub-tiers {
  font: 600 11.5px var(--fn);
  color: var(--ink3);
}
.rs-sub-preview {
  font-size: 12px;
  color: var(--ink3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rs-sub-card[open] .rs-sub-preview {
  display: none;
}
.rs-sub-right {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex: none;
}
.rs-slot-count {
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--surface2);
  border: 1px solid var(--line);
  font-size: 11.5px;
  color: var(--ink2);
  white-space: nowrap;
}
.rs-slot-count b {
  font: 700 13px var(--fn);
  color: var(--card-accent);
}
.rs-chevron {
  color: var(--ink3);
  transition: transform 0.16s ease;
}
.rs-sub-card[open] .rs-chevron {
  transform: rotate(180deg);
  color: var(--card-accent);
}

.rs-sub-slots {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 205px), 1fr));
  gap: 6px;
  padding: 9px 12px 11px;
  border-top: 1px dashed var(--line);
  background: var(--surface2);
}
.rs-slot-card {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  padding: 6px 8px;
  border: 1px solid var(--line);
  border-left: 3px solid var(--tc, var(--teal));
  border-radius: 7px;
  background: var(--surface);
  color: var(--ink);
  text-decoration: none;
  transition:
    border-color 0.14s,
    transform 0.12s;
}
.rs-slot-card:hover {
  border-color: var(--accent);
  border-left-color: var(--tc, var(--teal));
  transform: translateY(-1px);
}
.rs-slot-av {
  position: relative;
  flex: 0 0 36px;
  width: 36px;
  height: 36px;
  border-radius: 5px;
  overflow: hidden;
  background: var(--tc, var(--surface2));
}
.rs-slot-av img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.rs-slot-av i {
  position: absolute;
  left: 0;
  top: 0;
  padding: 0 4px;
  border-bottom-right-radius: 4px;
  background: var(--tc, rgba(10, 18, 20, 0.8));
  color: #fff;
  font-style: normal;
  font: 700 9.5px/1.35 var(--fn);
}
.rs-slot-body {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 3px;
}
.rs-slot-body b {
  font-size: 13px;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rs-slot-covs {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}
.rs-slot-covs :deep(.cv) {
  font-size: 10.5px;
  padding: 0 5px;
}

/* ---------- 容器查询与横屏小窗适配 ---------- */
@container extra-roster (max-width: 520px) {
  .rs-search {
    flex-basis: 100%;
  }
  .rs-choice-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }
  /* 有 Wiki 链接时，盟约和链接共用整张卡片的底行，给上方名字留足宽度。 */
  .rs-choice-main:has(.rs-choice-wiki) > .rs-av {
    grid-row: 1;
    width: 34px;
    height: 34px;
  }
  .rs-choice-main:has(.rs-choice-wiki) > .rs-choice-meta {
    grid-column: 1 / -1;
  }
  .rs-sub-slots {
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 158px), 1fr));
    gap: 6px;
  }
  .rs-sub-summary {
    padding: 8px 10px;
    gap: 8px;
  }
  .rs-sub-preview {
    display: none;
  }
}
@media (max-height: 600px) {
  .rs-wrap {
    gap: 6px;
    margin-bottom: 6px;
  }
  .rs-hero {
    padding: 8px 10px;
    gap: 7px;
  }
  .rs-bar {
    padding-top: 6px;
    gap: 6px;
  }
  .rs-choice-main {
    padding: 5px 6px;
    column-gap: 7px;
  }
  .rs-av {
    flex-basis: 36px;
    width: 36px;
    height: 36px;
  }
  .rs-sub-summary {
    padding: 6px 10px;
  }
}
</style>
