<script setup lang="ts">
import NavigationLink from './NavigationLink.vue';
import { cardLocation } from '../../router/navigation.ts';
import { computed } from 'vue';
import { EQUIPMENT_RECIPES, type Equipment } from '../../../data/index.ts';
import { equipIconSrc } from '../../lib/assets.ts';
import { fx } from '../format.ts';
import { useQuickrefActions } from '../state.ts';
import Chip from './Chip.vue';
const props = defineProps<{ item: Equipment }>();
const recipe = computed(() => EQUIPMENT_RECIPES[props.item.name]);
const actions = useQuickrefActions();
</script>
<template>
  <NavigationLink :to="cardLocation('eq', item.name)" :activate="() => actions.openDetail('eq', item.name)" class="oc" :data-key="`eq:${item.name}`" :data-t="item.tier" :data-eq="item.name">
    <div class="h"><img v-if="equipIconSrc(item.name)" class="ei" :src="equipIconSrc(item.name)" alt="" width="80" height="80" loading="lazy" decoding="async"><b>{{ item.name }}</b><Chip v-if="item.covenant" kind="cv" :name="item.covenant" static/><span class="pr">{{ item.price }}</span></div>
    <div class="tx" v-html="fx(item.effect)"></div><div v-if="item.advanced && item.advanced !== item.effect" class="tx adv" v-html="`<span class='tag a'>进阶</span> ${fx(item.advanced)}`"></div>
    <div v-if="recipe" class="eq-recipe" aria-label="组合配方">
      <template v-for="(name, index) in recipe" :key="name">
        <b v-if="index" class="eq-recipe-sign" aria-hidden="true">{{ index === 1 ? '＋' : '→' }}</b>
        <span :data-eq="name"><img :src="equipIconSrc(name)" alt="" width="18" height="18" loading="lazy" decoding="async">{{ name }}</span>
      </template>
    </div>
  </NavigationLink>
</template>
