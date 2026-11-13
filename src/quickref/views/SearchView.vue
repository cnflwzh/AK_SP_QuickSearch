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
import LiveStatus from '../../lib/LiveStatus.vue';
const props = defineProps<{ query: string }>();
const operatorLimit = ref(60);
watch(() => props.query, () => { operatorLimit.value = 60; });
const normalizedDescriptions = new Map<unknown, string>();
function descriptionOf<T>(item: T, textOf: (item: T) => string): string {
  if (!normalizedDescriptions.has(item)) normalizedDescriptions.set(item, normalize(textOf(item)));
  return normalizedDescriptions.get(item)!;
}
/** 各目录补充的检索条件；同分时默认保留数据表顺序。 */
interface SearchOptions<T> {
  descriptionOf?: (item: T) => string;
  matchesRelatedName?: (item: T) => boolean;
  tieBreak?: (a: T, b: T) => number;
}

/** 返回排序后的匹配项，不修改原列表；名称优先，其次关联名称，最后说明文本。query 须先归一化。 */
function rankBy<T>(list: readonly T[], query: string, nameOf: (item: T) => string, options: SearchOptions<T> = {}): T[] {
  // 名称匹配的最低分为 1.5，关联盟约应排在名称之后、普通说明文本之前。
  const relatedNameScore = 1.25;
  return list.map(item => ({
    item,
    score: nameScore(nameOf(item), query)
      || (options.matchesRelatedName?.(item) ? relatedNameScore : 0)
      || (options.descriptionOf && descriptionOf(item, options.descriptionOf).includes(query) ? 1 : 0),
  })).filter(({ score }) => score)
    .sort((a, b) => b.score - a.score || options.tieBreak?.(a.item, b.item) || 0)
    .map(({ item }) => item);
}
const normalizedQuery = computed(() => normalize(props.query));
const results = computed(() => {
  const q = normalizedQuery.value;
  // Punctuation-only queries retain the original blank search pane.
  if (!q) return { covenants: [], builds: [], operators: [], equipment: [], strategies: [], leaders: [] };
  const covenants = rankBy(ALL_COVENANTS, q, name => name);
  // 复用盟约名称的汉字、全拼和首字母匹配，避免干员关联搜索只匹配中文说明。
  const matchingCovenants = new Set(covenants);
  return {
    covenants,
    builds: rankBy(BUILD_NAMES, q, name => name),
    operators: rankBy(OPERATORS, q, operator => operator.name, {
      matchesRelatedName: operator => operator.covenants.some(name => matchingCovenants.has(name)),
      descriptionOf: operator => operator.covenants.join('/') + operator.trait + operator.elite,
      tieBreak: (a, b) => a.tier - b.tier,
    }),
    equipment: rankBy(EQUIPMENT, q, item => item.name, {
      descriptionOf: item => (item.covenant || '') + item.effect + (item.advanced || ''),
    }),
    strategies: rankBy(STRATEGIES, q, strategy => strategy.name, {
      descriptionOf: strategy => strategy.skill + '|' + strategy.effect + strategy.category,
    }),
    leaders: rankBy(LEADERS, q, leader => leader.name, {
      descriptionOf: leader => [...leader.abilities, ...leader.hiddenAbilities, ...leader.counters.map(counter => ({ skill: counter.tag, text: counter.text }))]
        .map(ability => (ability.skill ?? '') + ability.text).join('|'),
    }),
  };
});
const empty = computed(() => !!normalizedQuery.value && Object.values(results.value).every(list => !list.length));
const resultSummary = computed(() => {
  if (!normalizedQuery.value) return '';
  if (empty.value) return `没有匹配「${props.query}」的结果`;
  const counts = [
    [results.value.covenants.length, '个盟约'], [results.value.builds.length, '个流派'],
    [results.value.operators.length, '名干员'], [results.value.equipment.length, '件装备'],
    [results.value.strategies.length, '个策略'], [results.value.leaders.length, '名领袖'],
  ] as const;
  return `「${props.query}」找到` + counts.filter(([count]) => count > 0).map(([count, label]) => `${count} ${label}`).join('，');
});
</script>
<template>
  <div v-if="empty" class="empty">没有匹配「{{ query }}」</div>
  <template v-if="results.covenants.length">
    <div class="sec" role="heading" aria-level="2" data-key="heading:盟约">盟约<span class="n">{{ results.covenants.length }}</span></div>
    <div class="row" data-key="covenants"><Chip v-for="name in results.covenants" :key="name" kind="cv" :name="name"/></div>
  </template>
  <template v-if="results.builds.length">
    <div class="sec" role="heading" aria-level="2" data-key="heading:流派">流派<span class="n">{{ results.builds.length }}</span></div>
    <div class="row" data-key="builds"><Chip v-for="name in results.builds" :key="name" kind="build" :name="name"/></div>
  </template>
  <template v-if="results.operators.length">
    <div class="sec" role="heading" aria-level="2" data-key="heading:干员">干员<span class="n">{{ results.operators.length }}</span></div>
    <div class="qg" data-key="operators"><OperatorCard v-for="operator in results.operators.slice(0, operatorLimit)" :key="operator.name" :operator="operator" show-wiki-link/></div>
    <button v-if="operatorLimit < results.operators.length" type="button" class="filter-clear" @click="operatorLimit += 60">显示更多干员（{{ operatorLimit }} / {{ results.operators.length }}）</button>
  </template>
  <template v-if="results.equipment.length"><div class="sec" role="heading" aria-level="2" data-key="heading:装备">装备<span class="n">{{ results.equipment.length }}</span></div><div class="qg" data-key="equipment"><EquipmentCard v-for="item in results.equipment" :key="item.name" :item="item"/></div></template>
  <template v-if="results.strategies.length"><div class="sec" role="heading" aria-level="2" data-key="heading:策略">策略<span class="n">{{ results.strategies.length }}</span></div><div class="qg" data-key="strategies"><StrategyCard v-for="strategy in results.strategies" :key="strategy.name" :strategy="strategy"/></div></template>
  <template v-if="results.leaders.length"><div class="sec" role="heading" aria-level="2" data-key="heading:领袖">领袖<span class="n">{{ results.leaders.length }}</span></div><div class="lwl" data-key="leaders"><LeaderRow v-for="leader in results.leaders" :key="leader.id" :leader="leader" :mode="state.mode"/></div></template>
  <LiveStatus :message="resultSummary"/>
</template>
