<script setup lang="ts">
import type { Equipment } from '../../../data/index.ts';
import { equipIconSrc } from '../../lib/assets.ts';
import { fx } from '../format.ts';
import { useQuickrefActions } from '../state.ts';
import Chip from './Chip.vue';
defineProps<{ item: Equipment }>();
const actions = useQuickrefActions();
</script>
<template>
  <button type="button" class="oc" :data-key="`eq:${item.name}`" :data-t="item.tier" :data-eq="item.name" @click="actions.openDetail('eq', item.name)">
    <div class="h"><img v-if="equipIconSrc(item.name)" class="ei" :src="equipIconSrc(item.name)" alt="" width="80" height="80" loading="lazy" decoding="async"><b>{{ item.name }}</b><Chip v-if="item.covenant" kind="cv" :name="item.covenant" static/><span class="pr">{{ item.price }}</span></div>
    <div class="tx" v-html="fx(item.effect)"></div><div v-if="item.advanced && item.advanced !== item.effect" class="tx adv" v-html="`<span class='tag a'>进阶</span> ${fx(item.advanced)}`"></div>
  </button>
</template>
