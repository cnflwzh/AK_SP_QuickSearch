<script setup lang="ts">
import { TIER_LABELS, type Operator } from '../../../data/index.ts';
import { avatarSrc } from '../../lib/assets.ts';
import { fx } from '../format.ts';
import { useQuickrefActions } from '../state.ts';
import Chip from './Chip.vue';
defineProps<{ operator: Operator; showElite?: boolean }>();
const actions = useQuickrefActions();
</script>
<template>
  <button type="button" class="oc" :data-key="`op:${operator.name}`" :data-t="operator.tier" :data-op="operator.name" @click="actions.openDetail('op', operator.name)">
    <div class="h"><img v-if="avatarSrc(operator.name)" class="" :src="avatarSrc(operator.name)" alt="" width="80" height="80" loading="lazy" decoding="async"><b>{{ operator.name }}</b><i class="tn">{{ TIER_LABELS[operator.tier] }}</i></div>
    <div class="row"><Chip v-for="name in operator.covenants" :key="name" kind="cv" :name="name" static/><span class="tag">{{ operator.type }}</span></div>
    <div class="tx" v-html="fx(showElite ? operator.elite : operator.trait)"></div>
  </button>
</template>
