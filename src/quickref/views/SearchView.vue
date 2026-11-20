<script setup lang="ts">
import {computed, ref, watch} from 'vue';
import {rolesForTraining, type EnemyTerm} from '../../../data/index.ts';
import {enemyIconSrc} from '../../lib/ui/assets.ts';
import {rosterLocation} from '../../router/location.ts';
import NavigationLink from '../components/NavigationLink.vue';
import {
  matchedOnlyElite,
  prepareSearchQuery,
  searchResults,
} from '../searchRanking.ts';
import {presets} from '../planStore.ts';
import {state, useQuickrefActions} from '../state.ts';
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
const actions = useQuickrefActions();
const operatorLimit = ref(60);
const eliteMode = ref<0 | 1 | 2>(0);
const GLOSSARY_KIND_LABEL: Readonly<Record<EnemyTerm['kind'], string>> = {
  unit: '单位',
  status: '状态',
  mechanic: '机制',
};
watch(
  () => props.query,
  () => {
    operatorLimit.value = 60;
  },
);
const prepared = computed(() => prepareSearchQuery(props.query));
const results = computed(() => searchResults(prepared.value, presets.value));
const visibleOperators = computed(() =>
  results.value.operators.slice(0, operatorLimit.value).map((operator) => ({
    operator,
    eliteMatched:
      eliteMode.value === 0 && matchedOnlyElite(operator, prepared.value),
  })),
);
const empty = computed(
  () =>
    !!prepared.value.text &&
    !results.value.order.length &&
    !results.value.glossary.length,
);
const resultSummary = computed(() => {
  if (!prepared.value.text) return '';
  if (empty.value) return `没有匹配「${props.query}」的结果`;
  const counts = [
    [results.value.covenants.length, '个盟约'],
    [results.value.builds.length, '个流派'],
    [
      results.value.operators.length + results.value.additional.length,
      '名干员',
    ],
    [results.value.equipment.length, '件装备'],
    [results.value.strategies.length, '个策略'],
    [results.value.leaders.length, '名 Boss'],
    [results.value.bounties.length, '名悬赏敌人'],
    [results.value.trainings.length, '类普通敌人'],
    [results.value.glossary.length, '条敌人名词'],
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
  <template v-for="group in results.order" :key="group">
    <template v-if="group === 'covenants'">
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
    <template v-else-if="group === 'builds'">
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
    <template v-else-if="group === 'operators'">
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
    <template v-else-if="group === 'additional'">
      <SectionHeading
        class="sr-sec"
        title="自选与替补干员"
        :count="results.additional.length"
        :level="2"
        data-key="heading:自选与替补干员" />
      <div class="row" data-key="additional-operators">
        <NavigationLink
          v-for="op in results.additional"
          :key="op.avatar"
          :to="rosterLocation(op.avatar)"
          class="sr-roster-hit">
          {{ op.name }}
          <small>
            {{
              op.source === 'reserve'
                ? '预备替补'
                : op.source === 'system'
                  ? '特派原型'
                  : '自选'
            }}
          </small>
        </NavigationLink>
      </div>
    </template>
    <template v-else-if="group === 'equipment'">
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
    <template v-else-if="group === 'strategies'">
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
    <template v-else-if="group === 'leaders'">
      <SectionHeading
        class="sr-sec"
        title="Boss"
        :count="results.leaders.length"
        :level="2"
        data-key="heading:Boss" />
      <div class="lwl" data-key="leaders">
        <LeaderRow
          v-for="leader in results.leaders"
          :key="leader.id"
          :leader="leader"
          :mode="state.mode" />
      </div>
    </template>
    <template v-else-if="group === 'bounties'">
      <SectionHeading
        class="sr-sec"
        title="悬赏敌人"
        :count="results.bounties.length"
        :level="2"
        data-key="heading:悬赏敌人" />
      <div class="sr-enemy-grid" data-key="bounties">
        <button
          v-for="bounty in results.bounties"
          :key="bounty.name"
          type="button"
          class="sr-bty-card"
          @click="actions.openBounty(bounty.name)">
          <img
            :src="enemyIconSrc(bounty.enemyId)"
            alt=""
            width="38"
            height="38"
            loading="lazy"
            decoding="async" />
          <div class="sr-bty-main">
            <div class="sr-bty-top">
              <b>{{ bounty.name }}</b>
              <span class="sr-bty-meta">
                {{ bounty.when }} · {{ bounty.mobility }} · {{ bounty.range
                }}{{ bounty.damage !== '无' ? ` · ${bounty.damage}伤` : '' }}
              </span>
            </div>
            <p class="sr-bty-desc">{{ bounty.mechanics }}</p>
            <p class="sr-bty-counter">{{ bounty.counter }}</p>
          </div>
          <strong class="sr-bty-funds">+{{ bounty.funds }}</strong>
        </button>
      </div>
    </template>
    <template v-else-if="group === 'trainings'">
      <SectionHeading
        class="sr-sec"
        title="普通敌人（特训）"
        :count="results.trainings.length"
        :level="2"
        data-key="heading:普通敌人" />
      <div class="sr-enemy-grid" data-key="trainings">
        <button
          v-for="tr in results.trainings"
          :key="tr.name"
          type="button"
          class="sr-tr-card"
          @click="actions.openTraining(tr.name)">
          <div class="sr-tr-top">
            <b>{{ tr.name }}</b>
            <span>{{ tr.desc }}</span>
            <em v-for="role in rolesForTraining(tr.name)" :key="role">
              {{ role }}
            </em>
          </div>
          <p class="sr-bty-desc">{{ tr.attackStyle }}</p>
          <p class="sr-bty-counter">{{ tr.strategy }}</p>
        </button>
      </div>
    </template>
  </template>
  <template v-if="results.glossary.length">
    <SectionHeading
      class="sr-sec"
      title="敌人名词解析"
      :count="results.glossary.length"
      :level="2"
      data-key="heading:敌人名词" />
    <dl class="sr-gloss-list" data-key="glossary">
      <div
        v-for="entry in results.glossary"
        :key="entry.term"
        class="sr-gloss-item">
        <dt>
          <i :class="['sr-gloss-kind', entry.kind]">
            {{ GLOSSARY_KIND_LABEL[entry.kind] }}
          </i>
          <b>{{ entry.term }}</b>
        </dt>
        <dd>{{ entry.desc }}</dd>
      </div>
    </dl>
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
.sr-roster-hit {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  padding: 3px 9px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--surface);
  color: var(--ink);
  font-weight: 600;
  text-decoration: none;
}
.sr-roster-hit small {
  color: var(--ink3);
  font-weight: 400;
}
.sr-roster-hit:hover {
  border-color: var(--accent);
}
.sr-enemy-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 330px), 1fr));
  gap: 8px;
}
.sr-bty-card,
.sr-tr-card {
  display: grid;
  gap: 6px;
  padding: 9px 11px;
  border: 1px solid var(--line);
  border-left: 3px solid var(--teal);
  border-radius: 8px;
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.14s ease,
    transform 0.14s ease;
}
.sr-bty-card {
  grid-template-columns: 38px minmax(0, 1fr) auto;
  align-items: start;
  gap: 9px;
}
.sr-bty-card:hover,
.sr-tr-card:hover {
  border-color: var(--accent);
  transform: translateY(-1px);
}
.sr-bty-card img {
  width: 38px;
  height: 38px;
  border-radius: 5px;
  border: 1px solid var(--line);
  background: #172321;
  object-fit: cover;
}
.sr-bty-main {
  display: grid;
  gap: 3px;
  min-width: 0;
}
.sr-bty-top,
.sr-tr-top {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 6px;
}
.sr-bty-top b,
.sr-tr-top b {
  font-size: 13.5px;
  color: var(--ink);
}
.sr-bty-meta,
.sr-tr-top span {
  font-size: 11px;
  color: var(--ink3);
}
.sr-tr-top em {
  font-style: normal;
  font-size: 10.5px;
  font-weight: 600;
  padding: 0 5px;
  border-radius: 4px;
  background: var(--teal-soft);
  color: var(--teal);
}
.sr-bty-desc,
.sr-bty-counter {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--ink2);
}
.sr-bty-counter {
  color: var(--ink);
}
.sr-bty-funds {
  font-family: var(--fn);
  font-size: 17px;
  color: var(--accent);
  font-weight: 700;
  white-space: nowrap;
}
.sr-gloss-list {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
  gap: 7px;
}
.sr-gloss-item {
  display: grid;
  gap: 3px;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
}
.sr-gloss-item dt {
  display: flex;
  align-items: center;
  gap: 6px;
}
.sr-gloss-item dt b {
  font-size: 13px;
  color: var(--ink);
}
.sr-gloss-item dd {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--ink2);
}
.sr-gloss-kind {
  font-style: normal;
  font-size: 10.5px;
  font-weight: 700;
  padding: 0 5px;
  border-radius: 4px;
}
.sr-gloss-kind.unit {
  background: color-mix(in srgb, var(--teal) 15%, transparent);
  color: var(--teal);
}
.sr-gloss-kind.status {
  background: color-mix(in srgb, var(--red) 14%, transparent);
  color: var(--red);
}
.sr-gloss-kind.mechanic {
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  color: var(--accent);
}
@media (prefers-reduced-motion: reduce) {
  .sr-bty-card,
  .sr-tr-card {
    transition: none;
  }
}
:global(:root[data-motion='reduce'] .sr-bty-card),
:global(:root[data-motion='reduce'] .sr-tr-card) {
  transition: none !important;
}
</style>
