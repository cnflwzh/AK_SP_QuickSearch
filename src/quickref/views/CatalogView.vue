<script setup lang="ts">
import {computed, ref, watch} from 'vue';
import LiveStatus from '../../lib/ui/LiveStatus.vue';
import {
  OPERATORS,
  OPERATOR_TYPES,
  OPERATOR_TRIGGERS,
  COMBAT_ROLE_LABELS,
  matchesOperatorTrigger,
  operatorRolesAtElite,
  EQUIP,
  EQUIPMENT,
  EQUIPMENT_COMBOS,
  EQUIPMENT_RECIPES,
  STRATEGIES,
  ALL_COVENANTS,
  TIERS,
  TIER_LABELS,
  STRATEGY_CATEGORIES,
  isCoreCovenant,
} from '../../../data/index.ts';
import {equipIconSrc} from '../../lib/ui/assets.ts';
import {queryText, rosterOperator} from '../../router/location.ts';
import {routeQuery, updateQuery} from '../../router/navigation.ts';
import {state, useQuickrefActions} from '../state.ts';
import {
  inRunAny,
  isRunBannedOp,
  run,
  runBans,
  runEquipMaterials,
  runEquipRecommended,
  runStrategies,
} from '../planStore.ts';
import {useCatalogEntrance} from '../catalogEntrance.ts';
import RunBanner from '../components/RunBanner.vue';
import Segmented from '../components/Segmented.vue';
import SelectInput, {type SelectOption} from '../components/SelectInput.vue';
import SubTabs, {
  type SubTabDirection,
  type SubTabItem,
} from '../components/SubTabs.vue';
import EmptyState from '../components/EmptyState.vue';
import OperatorCard from '../components/OperatorCard.vue';
import EquipmentCard from '../components/EquipmentCard.vue';
import StrategyCard from '../components/StrategyCard.vue';
import OperatorRosterSources, {
  type RosterSource,
} from '../components/OperatorRosterSources.vue';
const props = defineProps<{kind: 'op' | 'eq' | 'st'}>();
const rosterSource = ref<RosterSource>('fixed');
const rosterDir = ref<SubTabDirection>('');
const rosterTarget = computed(() => {
  if (props.kind !== 'op' || routeQuery.value.q) return;
  return rosterOperator(queryText(routeQuery.value, 'roster'));
});
watch(rosterTarget, (target) => {
  if (target) rosterSource.value = target.source === 'reserve' ? 'substitute' : 'selectable';
}, {immediate: true});
function switchRoster(direction: SubTabDirection): void {
  rosterDir.value = direction;
  if (rosterTarget.value) void updateQuery({roster: null}, true);
}
const stDir = ref<SubTabDirection>('');
const vEnter = useCatalogEntrance();
const actions = useQuickrefActions();

const opTierTabs: readonly SubTabItem<number>[] = [
  '全部',
  ...TIER_LABELS.slice(1),
].map((label, id) => ({id, label}));
const eqTierTabs: readonly SubTabItem<number>[] = [
  '全部',
  ...TIER_LABELS.slice(1),
  '组合',
].map((label, id) => ({id, label}));
const stCategoryTabs: readonly SubTabItem<number>[] = STRATEGY_CATEGORIES.map(
  (label, id) => ({id, label}),
);
const opCovenantOptions: readonly SelectOption<string>[] = [
  {value: '', label: '全部盟约'},
  ...ALL_COVENANTS.map((name) => ({value: name, label: name})),
];
const opTriggerOptions: readonly SelectOption<string>[] = [
  {value: '', label: '全部触发时机'},
  ...OPERATOR_TRIGGERS.map(([label]) => ({value: label, label})),
];
const opTypeOptions: readonly SelectOption<string>[] = [
  {value: '', label: '全部特质类型'},
  ...OPERATOR_TYPES.map((name) => ({value: name, label: name})),
];
const opRoleOptions: readonly SelectOption<string>[] = [
  {value: '', label: '全部实战职能'},
  ...COMBAT_ROLE_LABELS.map((role) => ({value: role, label: role})),
];

/* ---------- 干员 ---------- */
const onlyRunOps = ref(false);
const hideBannedOps = ref(false);
const filterToRunOps = computed(
  () => onlyRunOps.value && !!run.value && inRunAny.value.size > 0,
);
const bannedCount = computed(() =>
  runBans.value.length
    ? OPERATORS.filter((o) => isRunBannedOp(o.name)).length
    : 0,
);
const hideBannedActive = computed(
  () => hideBannedOps.value && bannedCount.value > 0,
);
const operators = computed(() =>
  OPERATORS.filter(
    (o) =>
      (!filterToRunOps.value || inRunAny.value.has(o.name)) &&
      (!hideBannedActive.value || !isRunBannedOp(o.name)) &&
      (!state.opTier || o.tier === state.opTier) &&
      (!state.opCovenant || o.covenants.includes(state.opCovenant)) &&
      (!state.opType || o.type === state.opType) &&
      (!state.opRole ||
        operatorRolesAtElite(o, state.opElite).some((role) => role === state.opRole)) &&
      matchesOperatorTrigger(o, state.opTrigger, state.opElite),
  ),
);
const operatorFiltersActive = computed(
  () =>
    !!(
      filterToRunOps.value ||
      hideBannedActive.value ||
      state.opTier ||
      state.opCovenant ||
      state.opTrigger ||
      state.opType ||
      state.opRole
    ),
);
function clearOperatorFilters(): void {
  onlyRunOps.value = false;
  hideBannedOps.value = false;
  void updateQuery({
    tier: null,
    covenant: null,
    trigger: null,
    type: null,
    role: null,
  });
}

/* ---------- 装备 ---------- */
// 组合是筛选入口，成品仍保留原来的 VI 阶，不增加重复装备。
const COMBO_FILTER = TIERS.length + 1;
const onlyRunEq = ref(false);
const eqCovenant = ref('');
const craftPickerOpen = ref(false);
const selectedMaterial = ref('');
const equipCovenants = computed(() =>
  ALL_COVENANTS.filter((cov) => EQUIPMENT.some((eq) => eq.covenant === cov)),
);
const equipCovenantOptions = computed<readonly SelectOption<string>[]>(() => [
  {value: '', label: '全部盟约'},
  {value: '__any__', label: '可转盟约装'},
  ...equipCovenants.value.map((cov) => ({value: cov, label: cov})),
]);
const comboMaterials = computed(() =>
  [...new Set(EQUIPMENT_COMBOS.flatMap(([a, b]) => [a, b]))].filter((name) =>
    Object.hasOwn(EQUIP, name),
  ),
);
const matchedRecipes = computed(() =>
  selectedMaterial.value
    ? EQUIPMENT_COMBOS.filter((recipe) =>
        recipe.includes(selectedMaterial.value),
      )
    : [],
);
const recipeItemSet = computed(() => new Set(matchedRecipes.value.flat()));
const hasRunEquip = computed(
  () =>
    !!run.value &&
    (runEquipRecommended.value.size > 0 || runEquipMaterials.value.size > 0),
);
const filterToRunEq = computed(() => onlyRunEq.value && hasRunEquip.value);
const showCraftBar = computed(
  () =>
    craftPickerOpen.value ||
    state.eqTier === COMBO_FILTER ||
    !!selectedMaterial.value,
);
const equipmentFiltersActive = computed(
  () =>
    !!(
      filterToRunEq.value ||
      state.eqTier ||
      eqCovenant.value ||
      selectedMaterial.value
    ),
);
function selectMaterial(name: string): void {
  selectedMaterial.value = selectedMaterial.value === name ? '' : name;
}
function toggleCraftPicker(): void {
  if (craftPickerOpen.value) {
    craftPickerOpen.value = false;
    selectedMaterial.value = '';
  } else {
    craftPickerOpen.value = true;
  }
}
function clearEquipFilters(): void {
  onlyRunEq.value = false;
  eqCovenant.value = '';
  selectedMaterial.value = '';
  craftPickerOpen.value = false;
  if (state.eqTier) state.eqTier = 0;
}
const equipment = computed(() =>
  EQUIPMENT.filter((e) => {
    if (selectedMaterial.value && !recipeItemSet.value.has(e.name)) return false;
    if (
      filterToRunEq.value &&
      !runEquipRecommended.value.has(e.name) &&
      !runEquipMaterials.value.has(e.name)
    )
      return false;
    if (eqCovenant.value === '__any__') {
      if (!e.covenant) return false;
    } else if (eqCovenant.value && e.covenant !== eqCovenant.value) {
      return false;
    }
    return state.eqTier === COMBO_FILTER
      ? Object.hasOwn(EQUIPMENT_RECIPES, e.name)
      : !state.eqTier || e.tier === state.eqTier;
  }),
);

/* ---------- 策略 ---------- */
const onlyRunSt = ref(false);
const filterToRunSt = computed(
  () => onlyRunSt.value && !!run.value && runStrategies.value.all.size > 0,
);
const strategies = computed(() => {
  const category = STRATEGY_CATEGORIES[state.stCategory];
  return STRATEGIES.filter(
    (s) =>
      (!filterToRunSt.value || runStrategies.value.all.has(s.name)) &&
      (category === '全部' ||
        (category === '阵营'
          ? isCoreCovenant(s.category)
          : s.category === category)),
  );
});

const operatorGroups = computed(() =>
  TIERS.map((tier) => ({
    tier,
    items: operators.value.filter((o) => o.tier === tier),
  })).filter((group) => group.items.length),
);
const equipmentGroups = computed(() =>
  TIERS.map((tier) => ({
    tier,
    items: equipment.value.filter((e) => e.tier === tier),
  })).filter((group) => group.items.length),
);
</script>
<template>
  <RunBanner />
  <OperatorRosterSources
    v-if="kind === 'op'"
    v-model="rosterSource"
    :focus-name="rosterTarget?.name"
    @switch="switchRoster" />
  <div
    v-if="kind === 'op' && rosterSource === 'fixed'"
    :class="{'subtab-panel': !!rosterDir}"
    :data-dir="rosterDir || undefined">
    <div class="bar" data-key="filters">
      <button
        v-if="run && inRunAny.size"
        type="button"
        :class="['run-filter-btn', {on: filterToRunOps}]"
        :aria-pressed="filterToRunOps"
        @click="onlyRunOps = !onlyRunOps">
        本局抓牌 {{ inRunAny.size }}
      </button>
      <button
        v-if="bannedCount"
        type="button"
        :class="['run-ban-btn', {on: hideBannedActive}]"
        :aria-pressed="hideBannedActive"
        title="隐藏本局禁池盟约的干员"
        @click="hideBannedOps = !hideBannedOps">
        {{
          hideBannedActive
            ? `已藏禁池 -${bannedCount}`
            : `排除禁池 ${bannedCount}`
        }}
      </button>
      <SubTabs
        v-model="state.opTier"
        :items="opTierTabs"
        :level="3"
        inline
        aria-label="干员等阶"
        attr="opt" />
      <SelectInput
        id="opC"
        v-model="state.opCovenant"
        :options="opCovenantOptions"
        highlight-active
        aria-label="盟约" />
      <SelectInput
        id="opTrigger"
        v-model="state.opTrigger"
        :options="opTriggerOptions"
        highlight-active
        aria-label="触发时机" />
      <SelectInput
        id="opType"
        v-model="state.opType"
        :options="opTypeOptions"
        highlight-active
        aria-label="特质类型" />
      <SelectInput
        id="opRole"
        v-model="state.opRole"
        :options="opRoleOptions"
        highlight-active
        aria-label="实战职能" />
      <Segmented
        :labels="['初始', '精锐']"
        :active="state.opElite ? 1 : 0"
        attr="opel"
        @change="state.opElite = $event === 1" />
      <button
        v-if="operatorFiltersActive"
        type="button"
        class="filter-clear"
        @click="clearOperatorFilters">
        重置
      </button>
      <span class="cnt">{{ operators.length }} 名</span>
    </div>
    <template v-for="group in operatorGroups" :key="group.tier">
      <div
        class="tierh"
        role="heading"
        aria-level="2"
        :data-key="`heading:${group.tier}`"
        :data-t="group.tier">
        <i>{{ TIER_LABELS[group.tier] }}</i>
        <span>{{ group.items.length }}</span>
      </div>
      <div class="qg" :data-key="`tier:${group.tier}`">
        <OperatorCard
          v-enter
          v-for="operator in group.items"
          :key="operator.name"
          :operator="operator"
          :show-elite="state.opElite"
          show-wiki-link />
      </div>
    </template>
    <EmptyState
      v-if="!operators.length"
      message="当前筛选下没有干员"
      action-label="清空筛选"
      :show-action="operatorFiltersActive"
      @action="clearOperatorFilters" />
  </div>
  <template v-else-if="kind === 'eq'">
    <div class="bar" data-key="filters">
      <button
        v-if="hasRunEquip"
        type="button"
        :class="['run-filter-btn', {on: filterToRunEq}]"
        :aria-pressed="filterToRunEq"
        @click="onlyRunEq = !onlyRunEq">
        本局配装
      </button>
      <SubTabs
        v-model="state.eqTier"
        :items="eqTierTabs"
        :level="2"
        inline
        aria-label="装备等阶"
        attr="eqt" />
      <SelectInput
        v-if="equipCovenants.length"
        v-model="eqCovenant"
        :options="equipCovenantOptions"
        highlight-active
        aria-label="装备盟约" />
      <button
        v-if="comboMaterials.length"
        type="button"
        :class="['run-filter-btn', {on: craftPickerOpen || !!selectedMaterial}]"
        :aria-pressed="craftPickerOpen || !!selectedMaterial"
        @click="toggleCraftPicker">
        散件合成
      </button>
      <button
        v-if="equipmentFiltersActive"
        type="button"
        class="filter-clear"
        @click="clearEquipFilters">
        重置
      </button>
      <span class="cnt">{{ equipment.length }} 件</span>
    </div>
    <div v-if="showCraftBar" class="eq-craft-bar" aria-label="散件合成反查">
      <div class="eq-craft-pills">
        <span class="k">选散件反查</span>
        <button
          v-for="mat in comboMaterials"
          :key="mat"
          type="button"
          :class="['eq-craft-pill', {on: selectedMaterial === mat}]"
          :aria-pressed="selectedMaterial === mat"
          @click="selectMaterial(mat)">
          <img
            v-if="equipIconSrc(mat)"
            :src="equipIconSrc(mat)"
            alt=""
            width="18"
            height="18"
            loading="lazy" />
          {{ mat }}
        </button>
      </div>
      <div v-if="matchedRecipes.length" class="eq-craft-results">
        <div
          v-for="recipe in matchedRecipes"
          :key="recipe[2]"
          class="eq-craft-row">
          <button
            type="button"
            class="eq-craft-item"
            :class="{self: recipe[0] === selectedMaterial}"
            @click="actions.openDetail('eq', recipe[0])">
            {{ recipe[0] }}
          </button>
          <span aria-hidden="true">＋</span>
          <button
            type="button"
            class="eq-craft-item"
            :class="{self: recipe[1] === selectedMaterial}"
            @click="actions.openDetail('eq', recipe[1])">
            {{ recipe[1] }}
          </button>
          <span aria-hidden="true">→</span>
          <button
            type="button"
            class="eq-craft-item result"
            @click="actions.openDetail('eq', recipe[2])">
            {{ recipe[2] }}
          </button>
          <small v-if="EQUIP[recipe[2]]">{{ EQUIP[recipe[2]].effect }}</small>
        </div>
      </div>
    </div>
    <template v-for="group in equipmentGroups" :key="group.tier">
      <div
        class="tierh"
        role="heading"
        aria-level="2"
        :data-key="`heading:${group.tier}`"
        :data-t="group.tier">
        <i>{{ TIER_LABELS[group.tier] }}</i>
        <span>{{ group.items.length }}</span>
      </div>
      <div class="qg" :data-key="`tier:${group.tier}`">
        <EquipmentCard
          v-enter
          v-for="item in group.items"
          :key="item.name"
          :item="item" />
      </div>
    </template>
    <EmptyState
      v-if="!equipment.length"
      message="当前筛选下没有装备"
      action-label="清空筛选"
      :show-action="equipmentFiltersActive"
      @action="clearEquipFilters" />
  </template>
  <template v-else-if="kind === 'st'">
    <div class="bar">
      <button
        v-if="run && runStrategies.all.size"
        type="button"
        :class="['run-filter-btn', {on: filterToRunSt}]"
        :aria-pressed="filterToRunSt"
        @click="onlyRunSt = !onlyRunSt">
        本局策略 {{ runStrategies.all.size }}
      </button>
      <SubTabs
        v-model="state.stCategory"
        :items="stCategoryTabs"
        :level="2"
        inline
        aria-label="策略分类"
        attr="stc"
        @change="(_, dir) => (stDir = dir)" />
      <span class="cnt">{{ strategies.length }} 名</span>
    </div>
    <div
      :key="state.stCategory"
      :class="['qg', {'subtab-panel': !!stDir}]"
      :data-dir="stDir || undefined">
      <StrategyCard
        v-enter
        v-for="strategy in strategies"
        :key="strategy.name"
        :strategy="strategy" />
    </div>
    <EmptyState
      v-if="!strategies.length"
      message="当前筛选下没有策略"
      action-label="显示全部策略"
      @action="
        onlyRunSt = false;
        state.stCategory = 0;
      " />
  </template>
  <LiveStatus
    v-if="kind !== 'op' || rosterSource === 'fixed'"
    :message="
      kind === 'op'
        ? `筛选结果：${operators.length} 名干员`
        : kind === 'eq'
          ? `筛选结果：${equipment.length} 件装备`
          : `筛选结果：${strategies.length} 个策略`
    " />
</template>
