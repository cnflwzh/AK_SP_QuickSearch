<script setup lang="ts">
import {computed} from 'vue';
import NavigationLink from './NavigationLink.vue';
import {cardLocation} from '../../router/navigation.ts';
import {TIER_LABELS, type Operator} from '../../../data/index.ts';
import {avatarSrc, equipIconSrc} from '../../lib/ui/assets.ts';
import {
  BOX_RANK_BORROWED,
  BOX_RANK_META,
  hasAnyBox,
  isBorrowableSixStar,
  rankOfOperator,
} from '../../lib/box/index.ts';
import {settings} from '../../lib/settings/index.ts';
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
const boxRank = computed(() =>
  hasAnyBox.value && settings.showBoxBadges && props.operator.stars > 0
    ? rankOfOperator(props.operator.avatar)
    : -1,
);
const isBorrowed = computed(() => boxRank.value === BOX_RANK_BORROWED);
const borrowableMissing = computed(
  () =>
    hasAnyBox.value &&
    settings.showBoxBadges &&
    boxRank.value === -1 &&
    isBorrowableSixStar(props.operator),
);
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
      <em
        v-else-if="boxRank > 0"
        :class="['tile-box', `r${boxRank}`]"
        :title="`自持：${BOX_RANK_META[boxRank].label}（${BOX_RANK_META[boxRank].bonusText}）`">
        {{ BOX_RANK_META[boxRank].shortLabel }}
      </em>
      <em
        v-else-if="isBorrowed"
        class="tile-box borrowed"
        title="助战已借用 · 局内本体出战（无自持加成，等效精0）">
        已借
      </em>
      <em
        v-else-if="borrowableMissing"
        class="tile-box borrow"
        :title="`未持有 · 可借用同名助战补位${operator.backupOperator ? `（不借替为 ${operator.backupOperator}）` : ''}`">
        可借
      </em>
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
    <span>{{ operator.name }}</span>
    <span class="dots">
      <u
        v-for="name in operator.covenants"
        :key="name"
        :style="{'--c': color(name)}"></u>
    </span>
  </NavigationLink>
</template>

<style scoped>
.tile-box {
  position: absolute;
  left: 2px;
  bottom: 2px;
  padding: 0 3px;
  border-radius: 3px;
  font-style: normal;
  font-family: var(--fn);
  font-size: 9px;
  font-weight: 700;
  line-height: 1.4;
  background: rgba(15, 23, 28, 0.82);
  color: #f3f5f6;
  pointer-events: none;
}
.tile-box.r1 {
  background: #2563eb;
  color: #fff;
}
.tile-box.r2 {
  background: #059669;
  color: #fff;
}
.tile-box.r3 {
  background: var(--accent);
  color: var(--accent-ink);
}
.tile-box.borrowed {
  background: #db2777;
  color: #fff;
}
.tile-box.borrow {
  background: #475569;
  color: #e2e8f0;
}
</style>
