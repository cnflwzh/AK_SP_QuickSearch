<script setup lang="ts">
import { isCoreCovenant, type Strategy } from '../../../data/index.ts';
import { portraitSrc } from '../../lib/assets.ts';
import { esc } from '../../lib/dom.ts';
import { fx, hpWidth } from '../format.ts';
import { useQuickrefActions } from '../state.ts';
import Chip from './Chip.vue';
defineProps<{ strategy: Strategy }>();
const actions = useQuickrefActions();
</script>
<template>
  <button type="button" class="oc" :data-key="`st:${strategy.name}`" style="--tc:var(--teal)" :data-st="strategy.name" @click="actions.openDetail('st', strategy.name)">
    <div class="h"><img v-if="portraitSrc(strategy.name)" class="sp" :src="portraitSrc(strategy.name)" alt="" width="88" height="88" loading="lazy" decoding="async"><b>{{ strategy.name }}</b><Chip v-if="isCoreCovenant(strategy.category)" kind="cv" :name="strategy.category" static/><span v-else class="tag">{{ strategy.category }}</span></div>
    <div class="hp"><span>{{ strategy.hp }}</span><div class="trk"><div :style="{ width: hpWidth(strategy.hp) + '%' }"></div></div></div>
    <div class="tx" v-html="`<span style='color:var(--ink);font-weight:500'>${esc(strategy.skill)}</span>　${fx(strategy.effect)}`"></div>
    <div><span :class="['tag', { t: strategy.unlock === '初始' }]">{{ strategy.unlock }}</span></div>
  </button>
</template>
