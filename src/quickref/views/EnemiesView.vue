<script setup lang="ts">
import {computed, ref} from 'vue';
import {
  BOUNTIES,
  LEADER,
  LEADERS,
  MODES,
  SEASON_META,
  TRAINING,
} from '../../../data/index.ts';
import {patrols} from '../../lib/leaders/leader.ts';
import {queryText} from '../../router/location.ts';
import {routeQuery, updateQuery} from '../../router/navigation.ts';
import {state} from '../state.ts';
import RunBanner from '../components/RunBanner.vue';
import SubTabs, {
  subTabPanelAttrs,
  type SubTabDirection,
  type SubTabItem,
} from '../components/SubTabs.vue';
import EmptyState from '../components/EmptyState.vue';
import LeaderRow from '../components/LeaderRow.vue';
import {lazyView} from '../../lib/ui/lazyView.ts';

const BountyEnemiesPanel = lazyView(() => import('../components/BountyEnemiesPanel.vue'));
const TrainingEnemiesPanel = lazyView(() => import('../components/TrainingEnemiesPanel.vue'));
const LeaderDetail = lazyView(() => import('../components/LeaderDetail.vue'));

type EnemyKind = 'boss' | 'bounty' | 'normal';

/** 敌人页：分「Boss」「悬赏敌人」「普通敌人」三个二级页签 */
const current = computed(() => LEADER[state.leader]);
const enemyKind = computed<EnemyKind>({
  get: () => {
    if (current.value) return 'boss';
    const kind = queryText(routeQuery.value, 'kind');
    if (kind === 'bounty') return 'bounty';
    if (kind === 'normal') return 'normal';
    return 'boss';
  },
  set: (kind) => {
    void updateQuery({kind: kind === 'boss' ? null : kind});
  },
});
const kindTabs: readonly SubTabItem<EnemyKind>[] = [
  {id: 'boss', label: 'Boss', count: LEADERS.length},
  {id: 'bounty', label: '悬赏敌人', count: BOUNTIES.length},
  {id: 'normal', label: '普通敌人', count: TRAINING.length},
];
const kindDir = ref<SubTabDirection>('');
const traitFilter = ref(0);
const listDir = ref<SubTabDirection>('');
const modeTabs: readonly SubTabItem<number>[] = MODES.map((label, id) => ({
  id,
  label,
}));
const traitTabs: readonly SubTabItem<number>[] = [
  '全部',
  '隐秘核心',
  '会巡逻',
  '含飞行怪',
].map((label, id) => ({id, label}));
const filteredLeaders = computed(() =>
  LEADERS.filter((leader) => {
    if (traitFilter.value === 1) return !!leader.hiddenCore;
    if (traitFilter.value === 2) return patrols(leader);
    if (traitFilter.value === 3) {
      return [
        ...leader.stage.escorts,
        ...(leader.hiddenStage?.escorts ?? []),
      ].some((e) => e.fly);
    }
    return true;
  }),
);
</script>
<template>
  <RunBanner />
  <div v-if="!current" class="bar enemy-kind-bar" data-key="enemy-kind">
    <SubTabs
      v-model="enemyKind"
      :items="kindTabs"
      :level="2"
      aria-label="敌人分类"
      panel-id="enemy-kind-panel"
      attr="enemy-kind"
      @change="(_, dir) => (kindDir = dir)" />
  </div>

  <div
    :key="current ? `boss:${current.id}` : enemyKind"
    v-bind="subTabPanelAttrs('enemy-kind-panel', enemyKind)"
    :class="{'subtab-panel': !current && !!kindDir}"
    :data-dir="!current ? kindDir || undefined : undefined">
    <template v-if="enemyKind === 'boss'">
      <div class="bar" data-key="filters">
        <SubTabs
          v-model="state.mode"
          :items="modeTabs"
          :level="3"
          inline
          aria-label="Boss 难度"
          attr="nud" />
        <SubTabs
          v-if="!current"
          v-model="traitFilter"
          :items="traitTabs"
          :level="3"
          inline
          aria-label="Boss 特性筛选"
          attr="ldf"
          @change="(_, dir) => (listDir = dir)" />
        <span class="cnt">
          <template v-if="!current && traitFilter">
            {{ filteredLeaders.length }}/{{ LEADERS.length }} ·
          </template>
          第 {{ SEASON_META.roundLimits.standard }} 回合 · 极速第 {{ SEASON_META.roundLimits.fast }} 回合
        </span>
      </div>
      <LeaderDetail v-if="current" :key="current.id" :leader="current" />
      <div
        v-else
        :key="traitFilter"
        :class="['lwl', {'subtab-panel': !!listDir}]"
        :data-dir="listDir || undefined"
        data-key="list">
        <LeaderRow
          v-for="(leader, index) in filteredLeaders"
          :key="leader.id"
          :leader="leader"
          :mode="state.mode"
          :index="index" />
        <EmptyState
          v-if="!filteredLeaders.length"
          message="没有符合该筛选条件的 Boss"
          action-label="显示全部 Boss"
          @action="traitFilter = 0" />
      </div>
    </template>
    <BountyEnemiesPanel v-else-if="enemyKind === 'bounty'" />
    <TrainingEnemiesPanel v-else />
  </div>
</template>
