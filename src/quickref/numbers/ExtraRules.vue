<script setup lang="ts">
import { computed } from 'vue';
import { DECISION_ROUNDS, MODES, OWN_OPERATOR_BONUS, ROUND_TIME, TIER_LABELS, TIER_STATS, TRAINING } from '../../../data/rules.ts';
import { useNumberToolsState } from './useNumberToolsState.ts';
import Segmented from '../components/Segmented.vue';
const numberToolsState = useNumberToolsState();
const decisions = computed(() => DECISION_ROUNDS[MODES[numberToolsState.roundDifficulty]]);
</script>

<template>
  <div class="nt-extra-rules">
    <details class="nc nt-fold">
      <summary>回合与机变 <small>联合模拟</small></summary>
      <div class="bar nt-toolbar"><Segmented :labels="MODES" :active="numberToolsState.roundDifficulty" attr="number-difficulty" @change="numberToolsState.roundDifficulty = $event"/><span class="nt-muted">标记回合结束后进入机变</span></div>
      <div class="nt-rounds"><div v-for="(seconds, index) in ROUND_TIME" :key="index" :class="{ decision: decisions.includes(index + 1), leader: index === 13 }"><small>{{ index === 13 ? '领袖' : `R${index + 1}` }}</small><b>{{ seconds }}<small>秒</small></b><span>{{ decisions.includes(index + 1) ? '机变' : ' ' }}</span></div></div>
    </details>
    <details class="nc nt-fold">
      <summary>练度与特训 <small>等阶 · 自持加成 · 特训类型</small></summary>
      <div class="nt-secondary-grid">
        <div class="nt-table-scroll"><table><caption>等阶练度</caption><thead><tr><th>等阶</th><th>初始</th><th>精锐</th></tr></thead><tbody><tr v-for="row in TIER_STATS" :key="row.tier"><td>{{ TIER_LABELS[row.tier] }}</td><td>{{ row.base }}</td><td>{{ row.elite }}</td></tr></tbody></table></div>
        <div><table><caption>自持干员加成</caption><thead><tr><th>练度</th><th>攻击</th><th>防御</th><th>生命</th></tr></thead><tbody><tr v-for="row in OWN_OPERATOR_BONUS" :key="row.level"><td>{{ row.level }}</td><td>{{ row.atk }}</td><td>{{ row.def }}</td><td>{{ row.hp }}</td></tr></tbody></table><h4 class="nt-training-title" aria-level="3">特训类型</h4><div class="nt-training"><span v-for="item in TRAINING" :key="item.name"><b>{{ item.name }}</b>{{ item.desc }}</span></div></div>
      </div>
    </details>
  </div>
</template>
