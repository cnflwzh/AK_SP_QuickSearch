<script setup lang="ts">
import NavigationLink from './NavigationLink.vue';
import { cardLocation } from '../../router/navigation.ts';
import type { Operator } from '../../../data/index.ts';
import { avatarSrc } from '../../lib/assets.ts';
import { color } from '../format.ts';
import { useQuickrefActions } from '../state.ts';
import { inRun } from '../planStore.ts';
withDefaults(defineProps<{ operator: Operator; extraClass?: string }>(), { extraClass: '' });
const actions = useQuickrefActions();
const blank = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
</script>
<template>
  <NavigationLink :to="cardLocation('op', operator.name)" :activate="() => actions.openDetail('op', operator.name)" :class="['tile', extraClass, { inplan: inRun.has(operator.name) }]" :data-key="`op:${operator.name}`" :data-t="operator.tier" :data-op="operator.name">
    <img v-if="avatarSrc(operator.name)" class="" :src="avatarSrc(operator.name)" alt="" width="80" height="80" loading="lazy" decoding="async"><img v-else alt="" :src="blank">
    <span>{{ operator.name }}</span><span class="dots"><u v-for="name in operator.covenants" :key="name" :style="{ '--c': color(name) }"></u></span>
  </NavigationLink>
</template>
