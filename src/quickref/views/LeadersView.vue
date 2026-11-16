<script setup lang="ts">
import {computed, ref} from 'vue';
import {LEADER, LEADERS, MODES} from '../../../data/index.ts';
import {patrols} from '../../lib/leaders/leader.ts';
import {state} from '../state.ts';
import RunBanner from '../components/RunBanner.vue';
import Segmented from '../components/Segmented.vue';
import LeaderRow from '../components/LeaderRow.vue';
import LeaderDetail from '../components/LeaderDetail.vue';
/** 领袖列表 → 详情。一局只有一个领袖，选中后记住，再进来直接是详情 */
const current = computed(() => LEADER[state.leader]);
const traitFilter = ref(0);
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
    <Segmented
      :labels="MODES"
      :active="state.mode"
      attr="nud"
      @change="state.mode = $event" />
    <Segmented
      v-if="!current"
      :labels="['全部', '隐秘核心', '会巡逻', '含飞行怪']"
      :active="traitFilter"
      attr="ldf"
      @change="traitFilter = $event" />
    <span class="cnt">
      <template v-if="!current && traitFilter">
        {{ filteredLeaders.length }}/{{ LEADERS.length }} ·
      </template>
      第 14 回合 · 极速第 9 回合
    </span>
  </div>
  <LeaderDetail v-if="current" :key="current.id" :leader="current" />
  <div v-else class="lwl" data-key="list">
    <LeaderRow
      v-for="(leader, index) in filteredLeaders"
      :key="leader.id"
      :leader="leader"
      :mode="state.mode"
      :index="index" />
    <div v-if="!filteredLeaders.length" class="empty">
      没有符合该筛选条件的领袖
    </div>
  </div>
</template>
