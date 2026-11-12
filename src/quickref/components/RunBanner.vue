<script setup lang="ts">
import { computed } from 'vue';
import { color } from '../format.ts';
import { useQuickrefActions } from '../state.ts';
import { run, runKey, runStats, runBans, setRun, presetColor } from '../planStore.ts';
/** 本局提示条：本局打的流派和它要用的盟约；focus = 当前正在看的盟约 */
defineProps<{ focus?: string }>();
const actions = useQuickrefActions();
/** 这套流派终盘激活的盟约 */
const covs = computed(() => runStats.value.filter(s => s.name !== '绝技' && s.active));
</script>
<template>
  <div v-if="run" class="runb" :style="{ '--c': presetColor(run) }">
    <span class="k">本局</span>
    <button type="button" class="nm" :title="`查看「${run.plan.name}」`" @click="actions.openBuild(runKey)">{{ run.plan.name }} ▸</button>
    <span class="cvs">
      <button v-for="s in covs" :key="s.name" type="button" :class="['c', { on: s.active, max: s.bonusActive, f: s.name === focus, ban: runBans.includes(s.name) }]" :style="{ '--c': color(s.name) }" :data-cv="s.name" data-peek="off" @click="actions.openCovenant(s.name)">{{ s.name }}<small>{{ s.count }}/{{ s.need }}</small></button>
    </span>
    <button type="button" class="x" title="结束本局" aria-label="结束本局" @click="setRun('')">✕</button>
  </div>
</template>
