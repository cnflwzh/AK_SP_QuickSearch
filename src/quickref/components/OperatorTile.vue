<script setup lang="ts">
import NavigationLink from './NavigationLink.vue';
import { cardLocation } from '../../router/navigation.ts';
import { TIER_LABELS, type Operator } from '../../../data/index.ts';
import { avatarSrc } from '../../lib/assets.ts';
import { color } from '../format.ts';
import { useQuickrefActions } from '../state.ts';
import { inRun } from '../planStore.ts';
withDefaults(defineProps<{
  operator: Operator;
  extraClass?: string;
  /** 流派阵容显示等阶；已按等阶分栏的盟约页由栏标题说明。 */
  showTier?: boolean;
}>(), { extraClass: '', showTier: false });
const actions = useQuickrefActions();
const blank = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
</script>
<template>
  <NavigationLink :to="cardLocation('op', operator.name)" :activate="() => actions.openDetail('op', operator.name)" :class="['tile', extraClass, { inplan: inRun.has(operator.name) }]" :data-key="`op:${operator.name}`" :data-t="operator.tier" :data-op="operator.name">
    <div class="tile-avatar">
      <img :src="avatarSrc(operator.name) || blank" alt="" width="80" height="80" loading="lazy" decoding="async">
      <b v-if="showTier" class="tr" :title="`${operator.tier} 阶`" :aria-label="`${operator.tier} 阶`">{{ TIER_LABELS[operator.tier] }}</b>
    </div>
    <span>{{ operator.name }}</span><span class="dots"><u v-for="name in operator.covenants" :key="name" :style="{ '--c': color(name) }"></u></span>
  </NavigationLink>
</template>
