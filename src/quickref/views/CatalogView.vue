<script setup lang="ts">
import { computed } from 'vue';
import { OPERATORS, EQUIPMENT, STRATEGIES, ALL_COVENANTS, TIERS, TIER_LABELS, STRATEGY_CATEGORIES, isCoreCovenant } from '../../../data/index.ts';
import { state } from '../state.ts';
import { useCatalogEntrance } from '../catalogEntrance.ts';
import Segmented from '../components/Segmented.vue';
import OperatorCard from '../components/OperatorCard.vue';
import EquipmentCard from '../components/EquipmentCard.vue';
import StrategyCard from '../components/StrategyCard.vue';
const vEnter = useCatalogEntrance();
defineProps<{ kind: 'op' | 'eq' | 'st' }>();
const operators = computed(() => OPERATORS.filter(o => (!state.opTier || o.tier === state.opTier) && (!state.opCovenant || o.covenants.includes(state.opCovenant))));
const equipment = computed(() => EQUIPMENT.filter(e => !state.eqTier || e.tier === state.eqTier));
const strategies = computed(() => { const category = STRATEGY_CATEGORIES[state.stCategory]; return STRATEGIES.filter(s => category === '全部' || (category === '阵营' ? isCoreCovenant(s.category) : s.category === category)); });
const operatorGroups = computed(() => TIERS.map(tier => ({ tier, items: operators.value.filter(o => o.tier === tier) })).filter(group => group.items.length));
const equipmentGroups = computed(() => TIERS.map(tier => ({ tier, items: equipment.value.filter(e => e.tier === tier) })).filter(group => group.items.length));
</script>
<template>
  <template v-if="kind === 'op'">
    <div class="bar" data-key="filters"><Segmented :labels="['全部', ...TIER_LABELS.slice(1)]" :active="state.opTier" attr="opt" @change="state.opTier = $event"/><select id="opC" v-model="state.opCovenant" aria-label="盟约"><option value="">全部盟约</option><option v-for="name in ALL_COVENANTS" :key="name">{{ name }}</option></select><Segmented :labels="['初始', '精锐']" :active="state.opElite ? 1 : 0" attr="opel" @change="state.opElite = $event === 1"/><span class="cnt">{{ operators.length }} 名</span></div>
    <template v-for="group in operatorGroups" :key="group.tier"><div class="tierh" :data-key="`heading:${group.tier}`" :data-t="group.tier"><i>{{ TIER_LABELS[group.tier] }}</i><span>{{ group.items.length }}</span></div><div class="qg" :data-key="`tier:${group.tier}`"><OperatorCard v-enter v-for="operator in group.items" :key="operator.name" :operator="operator" :show-elite="state.opElite"/></div></template>
    <div v-if="!operators.length" class="empty">—</div>
  </template>
  <template v-else-if="kind === 'eq'">
    <div class="bar" data-key="filters"><Segmented :labels="['全部', ...TIER_LABELS.slice(1)]" :active="state.eqTier" attr="eqt" @change="state.eqTier = $event"/><span class="cnt">{{ equipment.length }} 件</span></div>
    <template v-for="group in equipmentGroups" :key="group.tier"><div class="tierh" :data-key="`heading:${group.tier}`" :data-t="group.tier"><i>{{ TIER_LABELS[group.tier] }}</i><span>{{ group.items.length }}</span></div><div class="qg" :data-key="`tier:${group.tier}`"><EquipmentCard v-enter v-for="item in group.items" :key="item.name" :item="item"/></div></template>
  </template>
  <template v-else>
    <div class="bar"><Segmented :labels="STRATEGY_CATEGORIES" :active="state.stCategory" attr="stc" @change="state.stCategory = $event"/><span class="cnt">{{ strategies.length }} 名</span></div><div class="qg"><StrategyCard v-enter v-for="strategy in strategies" :key="strategy.name" :strategy="strategy"/></div>
  </template>
</template>
