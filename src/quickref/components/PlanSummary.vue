<script setup lang="ts">
import { computed } from 'vue';
import { OPERATOR, STRATEGY } from '../../../data/index.ts';
import { avatarSrc, equipIconSrc, portraitSrc } from '../../lib/assets.ts';
import { covenantStats, planCost, type PlanOp } from '../../lib/planner.ts';
import PlanCovenants from './PlanCovenants.vue';
/** 只读的阵容概览：导入预览与对比共用。highlight 中的干员加框（对比时标出两边不同的人） */
const props = withDefaults(defineProps<{ ops: readonly PlanOp[]; strategy: string; title?: string; highlight?: ReadonlySet<string> | null; compact?: boolean }>(), { title: '', highlight: null, compact: false });
const stats = computed(() => covenantStats(props.ops, 0));
const cost = computed(() => planCost(props.ops));
</script>
<template>
  <div class="pls">
    <div v-if="title" class="pls-t"><b>{{ title }}</b><span>{{ ops.length }} 人 · {{ stats.filter(s => s.active).length }} 盟约</span></div>
    <div class="pls-ops">
      <span v-for="slot in ops" :key="slot.name" :class="['pls-op', { el: slot.elite, hi: highlight?.has(slot.name) }]" :data-t="OPERATOR[slot.name]?.tier" :data-op="slot.name">
        <img :src="avatarSrc(slot.name)" alt="" width="44" height="44" loading="lazy">
        <small>{{ slot.name }}</small>
        <span v-if="slot.eq.length" class="eqs"><img v-for="(e, i) in slot.eq" :key="i" :src="equipIconSrc(e)" :data-eq="e" alt="" width="14" height="14"></span>
      </span>
    </div>
    <div v-if="STRATEGY[strategy]" class="pls-st" :data-st="strategy"><img :src="portraitSrc(strategy)" alt="" width="22" height="22">{{ strategy }}</div>
    <PlanCovenants :stats="stats" :compact="compact"/>
    <div class="pls-c"><span>招募 <b>{{ cost.recruit }}</b></span><span>装备 <b>{{ cost.equipment }}</b></span><span>调度中心 <b>Lv{{ cost.maxTier || '—' }}</b></span></div>
  </div>
</template>
