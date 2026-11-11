<script setup lang="ts">
import type { CovenantStat } from '../../lib/planner.ts';
import { color } from '../format.ts';
/**
 * 盟约进度条：每格一名干员，竖线标出激活 / 强化门槛。
 * 实心 = 本身有该盟约；描边 = 装备赋予；斜纹 = 调和 +1。
 */
const props = withDefaults(defineProps<{ stats: readonly CovenantStat[]; layers?: Readonly<Record<string, number>>; compact?: boolean }>(), { layers: () => ({}), compact: false });
const layerOf = (s: CovenantStat): number => props.layers[s.name] ?? 0;
const cells = (s: CovenantStat): number => Math.max(s.count, s.bonusNeed && !s.bonusElite ? s.bonusNeed : s.need, s.need);
const kind = (s: CovenantStat, i: number): string => {
  const own = s.members.length - s.granted.length;
  return i < own ? 'f' : i < s.members.length ? 'g' : i < s.count ? 'x' : '';
};
function status(s: CovenantStat): { text: string; cls: string } {
  if (s.broken) return { text: '超过 1 名失效', cls: 'off' };
  if (s.bonusActive) return { text: s.bonusElite ? `${s.bonusCount} 精锐 · 强化` : s.bonusLayers ? `${layerOf(s)} 层 · 强化` : '强化', cls: 'max' };
  if (s.active) {
    if (s.next) return { text: `差 ${s.next} 名强化`, cls: 'on' };
    if (s.bonusElite) return { text: `精锐 ${s.bonusCount}/5`, cls: 'on' };
    if (s.bonusLayers) return { text: `${layerOf(s)}/${s.bonusLayers} 层强化`, cls: 'on' };
    return { text: '激活', cls: 'on' };
  }
  return { text: `差 ${s.next} 名`, cls: '' };
}
</script>
<template>
  <ul :class="['plc', { compact }]">
    <li v-for="(s, i) in stats" :key="s.name" :class="{ on: s.active, max: s.bonusActive, off: s.broken }" :style="{ '--c': color(s.name), '--i': i }">
      <b class="n" :data-cv="s.name">{{ s.name }}</b>
      <span class="pips">
        <template v-for="k in cells(s)" :key="k">
          <i :class="kind(s, k - 1)"></i>
          <u v-if="k === s.need && k < cells(s)" class="th"></u>
          <u v-else-if="s.bonusNeed && !s.bonusElite && k === s.bonusNeed && k < cells(s)" class="th b"></u>
        </template>
      </span>
      <small v-if="!compact" :class="['cs', status(s).cls]">{{ status(s).text }}</small>
    </li>
    <li v-if="!stats.length" class="none">—</li>
  </ul>
</template>
