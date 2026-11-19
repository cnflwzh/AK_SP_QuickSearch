<script setup lang="ts">
import {computed, ref, watch} from 'vue';
import {
  ALL_COVENANTS,
  OPERATORS,
  EQUIPMENT,
  STRATEGIES,
  LEADERS,
} from '../../../data/index.ts';
import {normalize, nameScore} from '../../lib/ui/match.ts';
import {
  buildSearchDescription,
  matchedOnlyElite,
  matchingCombatRoles,
} from '../searchRanking.ts';
import {presets} from '../planStore.ts';
import {state} from '../state.ts';
import Chip from '../components/Chip.vue';
import Segmented from '../components/Segmented.vue';
import EmptyState from '../components/EmptyState.vue';
import SectionHeading from '../components/SectionHeading.vue';
import LeaderRow from '../components/LeaderRow.vue';
import OperatorCard from '../components/OperatorCard.vue';
import EquipmentCard from '../components/EquipmentCard.vue';
import StrategyCard from '../components/StrategyCard.vue';
import LiveStatus from '../../lib/ui/LiveStatus.vue';
const props = defineProps<{query: string}>();
const operatorLimit = ref(60);
const eliteMode = ref<0 | 1 | 2>(0);
watch(
  () => props.query,
  () => {
    operatorLimit.value = 60;
  },
);
const normalizedDescriptions = new Map<unknown, string>();
function descriptionOf<T>(item: T, textOf: (item: T) => string): string {
  if (!normalizedDescriptions.has(item))
    normalizedDescriptions.set(item, normalize(textOf(item)));
  return normalizedDescriptions.get(item)!;
}
/** 各目录补充的检索条件；同分时默认保留数据表顺序。 */
interface SearchOptions<T> {
  descriptionOf?: (item: T) => string;
  /** 可原地编辑的流派每次读取描述，同时保留 Vue 对成员和策略的依赖跟踪。 */
  mutableDescription?: boolean;
  matchesRelatedName?: (item: T) => boolean;
  tieBreak?: (a: T, b: T) => number;
}

/** 返回排序后的匹配项，不修改原列表；名称优先，其次关联名称，最后说明文本。query 须先归一化。 */
function rankBy<T>(
  list: readonly T[],
  query: string,
  nameOf: (item: T) => string,
  options: SearchOptions<T> = {},
): T[] {
  // 名称匹配的最低分为 1.5，关联盟约应排在名称之后、普通说明文本之前。
  const relatedNameScore = 1.25;
  return list
    .map((item) => ({
      item,
      score:
        nameScore(nameOf(item), query) ||
        (options.matchesRelatedName?.(item) ? relatedNameScore : 0) ||
        (options.descriptionOf &&
        (options.mutableDescription
          ? normalize(options.descriptionOf(item))
          : descriptionOf(item, options.descriptionOf)
        ).includes(query)
          ? 1
          : 0),
    }))
    .filter(({score}) => score)
    .sort(
      (a, b) => b.score - a.score || options.tieBreak?.(a.item, b.item) || 0,
    )
    .map(({item}) => item);
}
const normalizedQuery = computed(() => normalize(props.query));
const results = computed(() => {
  const q = normalizedQuery.value;
  // Punctuation-only queries retain the original blank search pane.
  if (!q)
    return {
      covenants: [],
      builds: [],
      operators: [],
      equipment: [],
      strategies: [],
      leaders: [],
    };
  const covenants = rankBy(ALL_COVENANTS, q, (name) => name);
  // 复用盟约与实战职能名称的汉字、全拼和首字母匹配，搜 "反隐"/"fanyin"/"对空" 也能直达干员与装备。
  const matchingCovenants = new Set(covenants);
  const matchingRoles = matchingCombatRoles(q);
  return {
    covenants,
    builds: rankBy(presets.value, q, (preset) => preset.plan.name, {
      mutableDescription: true,
      matchesRelatedName: (preset) =>
        preset.key !== preset.plan.name && nameScore(preset.key, q) > 0,
      descriptionOf: (preset) => buildSearchDescription(preset.plan),
    }).map((preset) => preset.key),
    operators: rankBy(OPERATORS, q, (operator) => operator.name, {
      matchesRelatedName: (operator) =>
        operator.covenants.some((name) => matchingCovenants.has(name)) ||
        Boolean(operator.roles?.some((role) => matchingRoles.has(role))),
      descriptionOf: (operator) =>
        operator.covenants.join('/') +
        (operator.roles?.join('/') ?? '') +
        operator.trait +
        operator.elite,
      tieBreak: (a, b) => a.tier - b.tier,
    }),
    equipment: rankBy(EQUIPMENT, q, (item) => item.name, {
      matchesRelatedName: (item) =>
        Boolean(item.roles?.some((role) => matchingRoles.has(role))),
      descriptionOf: (item) =>
        (item.covenant || '') +
        (item.roles?.join('/') ?? '') +
        item.effect +
        (item.advanced || ''),
    }),
    strategies: rankBy(STRATEGIES, q, (strategy) => strategy.name, {
      descriptionOf: (strategy) =>
        strategy.skill + '|' + strategy.effect + strategy.category,
    }),
    leaders: rankBy(LEADERS, q, (leader) => leader.name, {
      descriptionOf: (leader) =>
        [
          ...leader.abilities,
          ...leader.hiddenAbilities,
          ...leader.counters.map((counter) => ({
            skill: counter.tag,
            text: counter.text,
          })),
        ]
          .map((ability) => (ability.skill ?? '') + ability.text)
          .join('|'),
    }),
  };
});
const visibleOperators = computed(() =>
  results.value.operators.slice(0, operatorLimit.value).map((operator) => ({
    operator,
    eliteMatched:
      eliteMode.value === 0 && matchedOnlyElite(operator, normalizedQuery.value),
  })),
);
const empty = computed(
  () =>
    !!normalizedQuery.value &&
    Object.values(results.value).every((list) => !list.length),
);
const resultSummary = computed(() => {
  if (!normalizedQuery.value) return '';
  if (empty.value) return `没有匹配「${props.query}」的结果`;
  const counts = [
    [results.value.covenants.length, '个盟约'],
    [results.value.builds.length, '个流派'],
    [results.value.operators.length, '名干员'],
    [results.value.equipment.length, '件装备'],
    [results.value.strategies.length, '个策略'],
    [results.value.leaders.length, '名领袖'],
  ] as const;
  return (
    `「${props.query}」找到` +
    counts
      .filter(([count]) => count > 0)
      .map(([count, label]) => `${count} ${label}`)
      .join('，')
  );
});
</script>
<template>
  <EmptyState v-if="empty" :message="`没有匹配「${query}」`" />
  <template v-if="results.covenants.length">
    <SectionHeading
      class="sr-sec"
      title="盟约"
      :count="results.covenants.length"
      :level="2"
      data-key="heading:盟约" />
    <div class="row" data-key="covenants">
      <Chip
        v-for="name in results.covenants"
        :key="name"
        kind="cv"
        :name="name" />
    </div>
  </template>
  <template v-if="results.builds.length">
    <SectionHeading
      class="sr-sec"
      title="流派"
      :count="results.builds.length"
      :level="2"
      data-key="heading:流派" />
    <div class="row" data-key="builds">
      <Chip
        v-for="name in results.builds"
        :key="name"
        kind="build"
        :name="name" />
    </div>
  </template>
  <template v-if="results.operators.length">
    <SectionHeading
      class="sr-sec sr-op-sec"
      title="干员"
      :count="results.operators.length"
      :level="2"
      data-key="heading:干员">
      <template #extra>
        <Segmented
          class="sr-elite-seg"
          :labels="['自动', '初始', '精锐']"
          :active="eliteMode"
          attr="srel"
          @change="eliteMode = $event as 0 | 1 | 2" />
      </template>
    </SectionHeading>
    <div class="qg" data-key="operators">
      <OperatorCard
        v-for="{operator, eliteMatched} in visibleOperators"
        :key="operator.name"
        :operator="operator"
        :show-elite="eliteMode === 2 || eliteMatched"
        :elite-matched="eliteMatched"
        show-wiki-link />
    </div>
    <button
      v-if="operatorLimit < results.operators.length"
      type="button"
      class="filter-clear"
      @click="operatorLimit += 60">
      显示更多干员（{{ operatorLimit }} / {{ results.operators.length }}）
    </button>
  </template>
  <template v-if="results.equipment.length">
    <SectionHeading
      class="sr-sec"
      title="装备"
      :count="results.equipment.length"
      :level="2"
      data-key="heading:装备" />
    <div class="qg" data-key="equipment">
      <EquipmentCard
        v-for="item in results.equipment"
        :key="item.name"
        :item="item" />
    </div>
  </template>
  <template v-if="results.strategies.length">
    <SectionHeading
      class="sr-sec"
      title="策略"
      :count="results.strategies.length"
      :level="2"
      data-key="heading:策略" />
    <div class="qg" data-key="strategies">
      <StrategyCard
        v-for="strategy in results.strategies"
        :key="strategy.name"
        :strategy="strategy" />
    </div>
  </template>
  <template v-if="results.leaders.length">
    <SectionHeading
      class="sr-sec"
      title="领袖"
      :count="results.leaders.length"
      :level="2"
      data-key="heading:领袖" />
    <div class="lwl" data-key="leaders">
      <LeaderRow
        v-for="leader in results.leaders"
        :key="leader.id"
        :leader="leader"
        :mode="state.mode" />
    </div>
  </template>
  <LiveStatus :message="resultSummary" />
</template>

<style scoped>
.sr-sec {
  margin: 22px 0 10px;
}
.sr-sec:first-child {
  margin-top: 0;
}
</style>
