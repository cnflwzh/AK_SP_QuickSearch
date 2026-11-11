<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { TRAINING, LEADERS } from '../../../data/index';
import { whileVisible } from '../../lib/visibility';
const grid = ref<HTMLElement>();
const chosen = ref<number[]>([]), leader = ref('');
const waves = ref<{ name: string; color: string }[]>([]);
const colors = ['var(--teal)', 'var(--t4)', 'var(--t5)'];
function shuffle() {
  chosen.value = Array.from({ length: 9 }, (_, i) => i).sort(() => Math.random() - .5).slice(0, 3);
  leader.value = LEADERS[Math.floor(Math.random() * LEADERS.length)].name;
  waves.value = Array.from({ length: 13 }, () => {
    const index = Math.floor(Math.random() * 3);
    return { name: TRAINING[chosen.value[index]].name, color: colors[index] };
  });
}
shuffle();
let dispose: (() => void) | undefined;
onMounted(() => {
  if (grid.value) dispose = whileVisible(grid.value, () => {
    const timer = window.setInterval(shuffle, 3200);
    return () => clearInterval(timer);
  });
});
onBeforeUnmount(() => dispose?.());
</script>
<template>
  <div class="row" style="justify-content:space-between;margin-bottom:10px"><div class="row"><span class="tag a">每局：1 名领袖 + 3 类特训</span><span class="tag">每波只含 1 类</span></div><span class="cnt" id="trLeader">领袖：{{ leader }}</span></div>
  <div class="tr9" id="tr9" ref="grid"><div v-for="(training, i) in TRAINING" :key="training.name" :class="{ on: chosen.includes(i) }"><b>{{ training.name }}</b><span style="font-size:11px;color:inherit;opacity:.75">{{ training.desc }}</span></div></div>
  <div class="waves" id="waves"><div v-for="(wave, i) in waves" :key="i" :style="{ background: wave.color }" :title="'R' + (i + 1)">{{ wave.name }}</div><div style="background:var(--red)">领袖</div></div>
</template>
