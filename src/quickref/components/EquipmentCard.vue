<script setup lang="ts">
import NavigationLink from './NavigationLink.vue';
import {cardLocation} from '../../router/navigation.ts';
import {computed} from 'vue';
import {
  EQUIPMENT_COMBOS,
  EQUIPMENT_RECIPES,
  type Equipment,
} from '../../../data/index.ts';
import {equipIconSrc} from '../../lib/ui/assets.ts';
import {fx} from '../format.ts';
import {
  runEquipMaterials,
  runEquipOwners,
  runEquipRecommended,
} from '../planStore.ts';
import {useQuickrefActions} from '../state.ts';
import Chip from './Chip.vue';
const props = defineProps<{item: Equipment}>();
const recipe = computed(
  () =>
    EQUIPMENT_RECIPES[props.item.name] ??
    EQUIPMENT_COMBOS.find(
      (combo) => combo[0] === props.item.name || combo[1] === props.item.name,
    ),
);
const owners = computed(() => runEquipOwners.value.get(props.item.name) ?? []);
const isRec = computed(() => runEquipRecommended.value.has(props.item.name));
const craftsInto = computed(
  () => runEquipMaterials.value.get(props.item.name) ?? [],
);
const actions = useQuickrefActions();
</script>
<template>
  <NavigationLink
    :to="cardLocation('eq', item.name)"
    :activate="() => actions.openDetail('eq', item.name)"
    :class="['oc', {inplan: isRec, inalt: !isRec && craftsInto.length > 0}]"
    :data-key="`eq:${item.name}`"
    :data-t="item.tier"
    :data-eq="item.name">
    <div class="h">
      <img
        v-if="equipIconSrc(item.name)"
        class="ei"
        :src="equipIconSrc(item.name)"
        alt=""
        width="80"
        height="80"
        loading="lazy"
        decoding="async" />
      <b>{{ item.name }}</b>
      <Chip v-if="item.covenant" kind="cv" :name="item.covenant" static />
      <span v-if="owners.length" class="inp">✓ 给{{ owners.join('·') }}</span>
      <span v-else-if="isRec" class="inp">✓ 本局推荐</span>
      <span v-else-if="craftsInto.length" class="inp alt">
        ⇄ 合{{ craftsInto[0] }}
      </span>
      <span class="pr">{{ item.price }}</span>
    </div>
    <div class="tx" v-html="fx(item.effect, false)"></div>
    <div
      v-if="item.advanced && item.advanced !== item.effect"
      class="tx adv"
      v-html="`<span class='tag a'>进阶</span> ${fx(item.advanced, false)}`"></div>
    <div v-if="recipe" class="eq-recipe" aria-label="组合配方">
      <template v-for="(name, index) in recipe" :key="name">
        <b v-if="index" class="eq-recipe-sign" aria-hidden="true">
          {{ index === 1 ? '＋' : '→' }}
        </b>
        <span :data-eq="name" :class="{self: name === item.name}">
          <img
            :src="equipIconSrc(name)"
            alt=""
            width="18"
            height="18"
            loading="lazy"
            decoding="async" />
          {{ name }}
        </span>
      </template>
    </div>
  </NavigationLink>
</template>
