<script setup lang="ts">
import {computed, ref} from 'vue';
import {LEADER, LEADERS, MODES} from '../../../data/index.ts';
import {patrols} from '../../lib/leaders/leader.ts';
import {state} from '../state.ts';
import RunBanner from '../components/RunBanner.vue';
import SubTabs, {
  type SubTabDirection,
  type SubTabItem,
} from '../components/SubTabs.vue';
import EmptyState from '../components/EmptyState.vue';
import LeaderRow from '../components/LeaderRow.vue';
import LeaderDetail from '../components/LeaderDetail.vue';
/** 领袖列表 → 详情。一局只有一个领袖，选中后记住，再进来直接是详情 */
const current = computed(() => LEADER[state.leader]);
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
  <div class="bar" data-key="filters">
    <SubTabs
      v-model="state.mode"
      :items="modeTabs"
      :level="2"
      inline
      aria-label="领袖难度"
      attr="nud" />
    <SubTabs
      v-if="!current"
      v-model="traitFilter"
      :items="traitTabs"
      :level="3"
      inline
      aria-label="领袖特性筛选"
      attr="ldf"
      @change="(_, dir) => (listDir = dir)" />
    <span class="cnt">
      <template v-if="!current && traitFilter">
        {{ filteredLeaders.length }}/{{ LEADERS.length }} ·
      </template>
      第 14 回合 · 极速第 9 回合
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
      message="没有符合该筛选条件的领袖"
      action-label="显示全部领袖"
      @action="traitFilter = 0" />
  </div>
</template>
