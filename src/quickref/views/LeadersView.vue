<script setup lang="ts">
import { computed } from 'vue';
import { LEADER, LEADERS, MODES } from '../../../data/index.ts';
import { state } from '../state.ts';
import Segmented from '../components/Segmented.vue';
import LeaderRow from '../components/LeaderRow.vue';
import LeaderDetail from '../components/LeaderDetail.vue';
/** 领袖列表 → 详情。一局只有一个领袖，选中后记住，再进来直接是详情 */
const current = computed(() => LEADER[state.leader]);
</script>
<template>
  <div class="bar" data-key="filters"><Segmented :labels="MODES" :active="state.mode" attr="nud" @change="state.mode = $event"/><span class="cnt">第 14 回合 · 极速第 9 回合</span></div>
  <LeaderDetail v-if="current" :key="current.id" :leader="current"/>
  <div v-else class="lwl" data-key="list"><LeaderRow v-for="(leader, index) in LEADERS" :key="leader.id" :leader="leader" :mode="state.mode" :index="index"/></div>
</template>
