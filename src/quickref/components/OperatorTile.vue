<script setup lang="ts">
import {computed} from 'vue';
import NavigationLink from './NavigationLink.vue';
import {cardLocation} from '../../router/navigation.ts';
import {TIER_LABELS, type Operator} from '../../../data/index.ts';
import {avatarSrc, equipIconSrc} from '../../lib/ui/assets.ts';
import type {PlanOp} from '../../lib/plans/index.ts';
import {color} from '../format.ts';
import {useQuickrefActions} from '../state.ts';
import {inRun, runAltTargets, runSlotMap} from '../planStore.ts';
const props = withDefaults(
  defineProps<{
    operator: Operator;
    extraClass?: string;
    /** 流派阵容显示等阶；已按等阶分栏的盟约页由栏标题说明。 */
    showTier?: boolean;
    /** 传入流派槽位信息时展示精锐、核心与专属配装角标。 */
    slotMeta?: PlanOp;
  }>(),
  {extraClass: '', showTier: false, slotMeta: undefined},
);
const actions = useQuickrefActions();
const blank =
  'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
const isMainInRun = computed(() => inRun.value.has(props.operator.name));
const altTargets = computed(
  () => runAltTargets.value.get(props.operator.name) ?? [],
);
const isAltInRun = computed(
  () => !isMainInRun.value && altTargets.value.length > 0,
);
const isCore = computed(
  () =>
    props.slotMeta?.core ||
    (!props.slotMeta &&
      isMainInRun.value &&
      !!runSlotMap.value.get(props.operator.name)?.core),
);
const isElite = computed(
  () =>
    props.slotMeta?.elite ||
    (!props.slotMeta &&
      isMainInRun.value &&
      !!runSlotMap.value.get(props.operator.name)?.elite),
);
const eqList = computed(() => props.slotMeta?.eq.slice(0, 2) ?? []);
const tileTitle = computed(() =>
  !props.slotMeta && isAltInRun.value
    ? `过渡 / 备选 → 替 ${altTargets.value.join('、')}`
    : undefined,
);
</script>
<template>
  <NavigationLink
    :to="cardLocation('op', operator.name)"
    :activate="() => actions.openDetail('op', operator.name)"
    :class="[
      'tile',
      extraClass,
      {
        inplan: !slotMeta && isMainInRun,
        inalt: !slotMeta && isAltInRun,
        core: isCore,
        el: isElite,
      },
    ]"
    :title="tileTitle"
    :data-key="`op:${operator.name}`"
    :data-t="operator.tier"
    :data-op="operator.name">
    <div class="tile-avatar">
      <img
        :src="avatarSrc(operator.name) || blank"
        alt=""
        width="80"
        height="80"
        loading="lazy"
        decoding="async" />
      <b
        v-if="showTier"
        class="tr"
        :title="`${operator.tier} 阶`"
        :aria-label="`${operator.tier} 阶`">
        {{ TIER_LABELS[operator.tier] }}
      </b>
      <em v-if="isElite" class="tile-el">精锐</em>
      <span v-if="eqList.length" class="tile-eqs">
        <img
          v-for="(eqName, index) in eqList"
          :key="index"
          :src="equipIconSrc(eqName)"
          :alt="eqName"
          :title="eqName"
          width="16"
          height="16" />
      </span>
    </div>
    <span class="tile-name">{{ operator.name }}</span>
    <span class="dots">
      <u
        v-for="name in operator.covenants"
        :key="name"
        :style="{'--c': color(name)}"></u>
    </span>
  </NavigationLink>
</template>
