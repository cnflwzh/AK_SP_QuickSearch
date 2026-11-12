<script setup lang="ts">
import { computed } from 'vue';
import { OPERATOR, EQUIP, STRATEGY, CORE_BUILDS, TIER_LABELS } from '../../../data/index.ts';
import { avatarSrc, equipIconSrc, portraitSrc } from '../../lib/assets.ts';
import { color } from '../format.ts';
import { useQuickrefActions } from '../state.ts';
import { buildLocation, covenantLocation, cardLocation } from '../../router/navigation.ts';
import NavigationLink from './NavigationLink.vue';
const props = withDefaults(defineProps<{ kind: 'op' | 'eq' | 'st' | 'cv' | 'build'; name: string; extraClass?: string; static?: boolean }>(), { extraClass: '', static: false });
const actions = useQuickrefActions();
const tier = computed(() => props.kind === 'op' ? OPERATOR[props.name]?.tier ?? 0 : EQUIP[props.name]?.tier ?? 0);
const picture = computed(() => props.kind === 'op' ? avatarSrc(props.name) : props.kind === 'eq' ? equipIconSrc(props.name) : portraitSrc(props.name));
const accent = computed(() => props.kind === 'build' && !CORE_BUILDS[props.name] ? 'var(--accent)' : color(props.name));
const destination = computed(() => props.kind === 'cv' ? covenantLocation(props.name) : props.kind === 'build' ? buildLocation(props.name) : cardLocation(props.kind, props.name));
function activate(): void {
  if (props.kind === 'cv') void actions.openCovenant(props.name);
  else if (props.kind === 'build') void actions.openBuild(props.name);
  else actions.openDetail(props.kind, props.name);
}
</script>
<template>
  <span v-if="props.static" class="cv" :style="{ '--c': accent }">{{ name }}</span>
  <NavigationLink :to="destination" :activate="activate" v-else-if="kind === 'cv' || kind === 'build'" class="cv" :data-key="`${kind}:${name}`" :style="{ '--c': accent }" :data-cv="kind === 'cv' ? name : undefined" :data-build="kind === 'build' ? name : undefined">{{ name }}{{ kind === 'build' ? ' ▸' : '' }}</NavigationLink>
  <NavigationLink :to="destination" :activate="activate" v-else-if="kind === 'st'" class="st" :data-key="`st:${name}`" :data-st="name"><img v-if="picture" class="" :src="picture" alt="" width="80" height="80" loading="lazy" decoding="async"><b>{{ STRATEGY[name]?.hp ?? '' }}</b>{{ name }}</NavigationLink>
  <NavigationLink :to="destination" :activate="activate" v-else :class="[kind, extraClass]" :data-key="`${kind}:${name}`" :data-t="tier" :data-op="kind === 'op' ? name : undefined" :data-eq="kind === 'eq' ? name : undefined"><span v-if="picture" :class="kind === 'op' ? 'av' : 'ei'"><img :src="picture" alt="" width="80" height="80" loading="lazy" decoding="async"><i>{{ TIER_LABELS[tier] }}</i></span><i v-else>{{ TIER_LABELS[tier] || (kind === 'op' ? '·' : '') }}</i>{{ name }}</NavigationLink>
</template>
