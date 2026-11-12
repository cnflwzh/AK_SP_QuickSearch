<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ALL_COVENANTS, OPERATORS, EQUIPMENT, STRATEGIES, LEADERS, BUILD_NAMES } from '../../../data/index.ts';
import { normalize, nameScore } from '../../lib/match.ts';
import { state } from '../state.ts';
import Chip from '../components/Chip.vue';
import LeaderRow from '../components/LeaderRow.vue';
import OperatorCard from '../components/OperatorCard.vue';
import EquipmentCard from '../components/EquipmentCard.vue';
import StrategyCard from '../components/StrategyCard.vue';
const props = defineProps<{ query: string }>();
const operatorLimit = ref(60);
watch(() => props.query, () => { operatorLimit.value = 60; });
const normalizedDescriptions = new Map<unknown, string>();
function descriptionOf<T>(item: T, textOf: (item: T) => string): string {
  if (!normalizedDescriptions.has(item)) normalizedDescriptions.set(item, normalize(textOf(item)));
  return normalizedDescriptions.get(item)!;
}
/** Name matches precede description matches; ties retain the original catalogue order. */
function rankBy<T>(list: readonly T[], q: string, nameOf: (item: T) => string, textOf: (item: T) => string = () => '', tieBreak: (a: T, b: T) => number = () => 0): T[] {
  return list.map(item => ({ item, score: nameScore(nameOf(item), q) || (descriptionOf(item, textOf).includes(q) ? 1 : 0) }))
    .filter(({ score }) => score).sort((a, b) => b.score - a.score || tieBreak(a.item, b.item)).map(({ item }) => item);
}
const normalizedQuery = computed(() => normalize(props.query));
const results = computed(() => {
  const q = normalizedQuery.value;
  // Punctuation-only queries retain the original blank search pane.
  if (!q) return { covenants: [], builds: [], operators: [], equipment: [], strategies: [], leaders: [] };
  return {
    covenants: rankBy(ALL_COVENANTS, q, c => c), builds: rankBy(BUILD_NAMES, q, b => b),
    operators: rankBy(OPERATORS, q, o => o.name, o => o.covenants.join('/') + o.trait + o.elite, (a, b) => a.tier - b.tier),
    equipment: rankBy(EQUIPMENT, q, e => e.name, e => (e.covenant || '') + e.effect + (e.advanced || '')),
    strategies: rankBy(STRATEGIES, q, s => s.name, s => s.skill + '|' + s.effect + s.category),
    leaders: rankBy(LEADERS, q, l => l.name, l => [...l.abilities, ...l.hiddenAbilities, ...l.counters.map(c => ({ skill: c.tag, text: c.text }))].map(a => (a.skill ?? '') + a.text).join('|')),
  };
});
const empty = computed(() => !!normalizedQuery.value && Object.values(results.value).every(list => !list.length));
</script>
<template>
  <div v-if="empty" class="empty">没有匹配「{{ query }}」</div>
  <template v-if="results.covenants.length + results.builds.length"><div class="sec" data-key="heading:盟约 / 流派">盟约 / 流派<span class="n">{{ results.covenants.length + results.builds.length }}</span></div><div class="row" data-key="covenants"><Chip v-for="name in results.covenants" :key="`cv:${name}`" kind="cv" :name="name"/><Chip v-for="name in results.builds" :key="`build:${name}`" kind="build" :name="name"/></div></template>
  <template v-if="results.operators.length"><div class="sec" data-key="heading:干员">干员<span class="n">{{ results.operators.length }}</span></div><div class="qg" data-key="operators"><OperatorCard v-for="operator in results.operators.slice(0, operatorLimit)" :key="operator.name" :operator="operator"/></div><button v-if="operatorLimit < results.operators.length" type="button" class="filter-clear" @click="operatorLimit += 60">显示更多干员（{{ operatorLimit }} / {{ results.operators.length }}）</button></template>
  <template v-if="results.equipment.length"><div class="sec" data-key="heading:装备">装备<span class="n">{{ results.equipment.length }}</span></div><div class="qg" data-key="equipment"><EquipmentCard v-for="item in results.equipment" :key="item.name" :item="item"/></div></template>
  <template v-if="results.strategies.length"><div class="sec" data-key="heading:策略">策略<span class="n">{{ results.strategies.length }}</span></div><div class="qg" data-key="strategies"><StrategyCard v-for="strategy in results.strategies" :key="strategy.name" :strategy="strategy"/></div></template>
  <template v-if="results.leaders.length"><div class="sec" data-key="heading:领袖">领袖<span class="n">{{ results.leaders.length }}</span></div><div class="lwl" data-key="leaders"><LeaderRow v-for="leader in results.leaders" :key="leader.id" :leader="leader" :mode="state.mode"/></div></template>
</template>
