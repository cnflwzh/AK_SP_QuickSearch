<script setup lang="ts">
import { computed } from 'vue';
import LiveStatus from '../../lib/LiveStatus.vue';
import { OPERATORS, OPERATOR_TYPES, OPERATOR_TRIGGERS, matchesOperatorTrigger, EQUIPMENT, EQUIPMENT_RECIPES, STRATEGIES, ALL_COVENANTS, TIERS, TIER_LABELS, STRATEGY_CATEGORIES, isCoreCovenant } from '../../../data/index.ts';
import { updateQuery } from '../../router/navigation.ts';
import { state } from '../state.ts';
import { useCatalogEntrance } from '../catalogEntrance.ts';
import Segmented from '../components/Segmented.vue';
import OperatorCard from '../components/OperatorCard.vue';
import EquipmentCard from '../components/EquipmentCard.vue';
import StrategyCard from '../components/StrategyCard.vue';
const vEnter = useCatalogEntrance();
defineProps<{ kind: 'op' | 'eq' | 'st' }>();
const operators = computed(() => OPERATORS.filter(o => (!state.opTier || o.tier === state.opTier)
  && (!state.opCovenant || o.covenants.includes(state.opCovenant))
  && (!state.opType || o.type === state.opType)
  && matchesOperatorTrigger(o, state.opTrigger, state.opElite)));
const operatorFiltersActive = computed(() => !!(state.opTier || state.opCovenant || state.opTrigger || state.opType));
function clearOperatorFilters(): void { void updateQuery({ tier: null, covenant: null, trigger: null, type: null }); }
// 组合是筛选入口，成品仍保留原来的 VI 阶，不增加重复装备。
const COMBO_FILTER = TIERS.length + 1;
const equipment = computed(() => EQUIPMENT.filter(e => state.eqTier === COMBO_FILTER
  ? Object.hasOwn(EQUIPMENT_RECIPES, e.name) : !state.eqTier || e.tier === state.eqTier));
const strategies = computed(() => { const category = STRATEGY_CATEGORIES[state.stCategory]; return STRATEGIES.filter(s => category === '全部' || (category === '阵营' ? isCoreCovenant(s.category) : s.category === category)); });
const operatorGroups = computed(() => TIERS.map(tier => ({ tier, items: operators.value.filter(o => o.tier === tier) })).filter(group => group.items.length));
const equipmentGroups = computed(() => TIERS.map(tier => ({ tier, items: equipment.value.filter(e => e.tier === tier) })).filter(group => group.items.length));
</script>
<template>
  <template v-if="kind === 'op'">
    <div class="bar" data-key="filters">
      <Segmented :labels="['全部', ...TIER_LABELS.slice(1)]" :active="state.opTier" attr="opt" @change="state.opTier = $event"/>
      <select id="opC" v-model="state.opCovenant" aria-label="盟约"><option value="">全部盟约</option><option v-for="name in ALL_COVENANTS" :key="name">{{ name }}</option></select>
      <select id="opTrigger" v-model="state.opTrigger" aria-label="触发时机"><option value="">全部触发时机</option><option v-for="[label] in OPERATOR_TRIGGERS" :key="label">{{ label }}</option></select>
      <select id="opType" v-model="state.opType" aria-label="特质类型"><option value="">全部特质类型</option><option v-for="name in OPERATOR_TYPES" :key="name">{{ name }}</option></select>
      <Segmented :labels="['初始', '精锐']" :active="state.opElite ? 1 : 0" attr="opel" @change="state.opElite = $event === 1"/>
      <button v-if="operatorFiltersActive" type="button" class="filter-clear" @click="clearOperatorFilters">重置</button>
      <span class="cnt">{{ operators.length }} 名</span>
    </div>
    <template v-for="group in operatorGroups" :key="group.tier"><div class="tierh" role="heading" aria-level="2" :data-key="`heading:${group.tier}`" :data-t="group.tier"><i>{{ TIER_LABELS[group.tier] }}</i><span>{{ group.items.length }}</span></div><div class="qg" :data-key="`tier:${group.tier}`"><OperatorCard v-enter v-for="operator in group.items" :key="operator.name" :operator="operator" :show-elite="state.opElite" show-wiki-link/></div></template>
    <div v-if="!operators.length" class="empty">—</div>
  </template>
  <template v-else-if="kind === 'eq'">
    <div class="bar" data-key="filters"><Segmented :labels="['全部', ...TIER_LABELS.slice(1), '组合']" :active="state.eqTier" attr="eqt" @change="state.eqTier = $event"/><span class="cnt">{{ equipment.length }} 件</span></div>
    <template v-for="group in equipmentGroups" :key="group.tier"><div class="tierh" role="heading" aria-level="2" :data-key="`heading:${group.tier}`" :data-t="group.tier"><i>{{ TIER_LABELS[group.tier] }}</i><span>{{ group.items.length }}</span></div><div class="qg" :data-key="`tier:${group.tier}`"><EquipmentCard v-enter v-for="item in group.items" :key="item.name" :item="item"/></div></template>
  </template>
  <template v-else>
    <div class="bar"><Segmented :labels="STRATEGY_CATEGORIES" :active="state.stCategory" attr="stc" @change="state.stCategory = $event"/><span class="cnt">{{ strategies.length }} 名</span></div><div class="qg"><StrategyCard v-enter v-for="strategy in strategies" :key="strategy.name" :strategy="strategy"/></div>
  </template>
  <LiveStatus :message="kind === 'op' ? `筛选结果：${operators.length} 名干员` : kind === 'eq' ? `筛选结果：${equipment.length} 件装备` : `筛选结果：${strategies.length} 个策略`"/>
</template>
