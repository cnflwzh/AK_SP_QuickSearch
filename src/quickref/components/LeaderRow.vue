<script setup lang="ts">
import { computed } from 'vue';
import { LEADERS, type Leader } from '../../../data/index.ts';
import { leaderSrc } from '../../lib/assets.ts';
import { wan } from '../../lib/dom.ts';
import { damageClass, patrols } from '../../lib/leader.ts';
import { useQuickrefActions } from '../state.ts';
/** 领袖列表的一行：点开进入详情。生命条按同难度全部领袖的最大值缩放 */
const props = defineProps<{ leader: Leader; mode: number; index?: number }>();
const { openLeader } = useQuickrefActions();
const hp = computed(() => props.leader.hp[props.mode]);
const max = computed(() => Math.max(...LEADERS.map(l => l.hp[props.mode])));
</script>
<template>
  <button type="button" class="lwr" :data-key="`ld:${leader.name}`" :style="{ '--i': index ?? 0 }" @click="openLeader(leader.name)">
    <img class="lw-pic" :src="leaderSrc(leader.name)" alt="" width="48" height="48" loading="lazy" decoding="async">
    <span class="lwr-t">
      <b>{{ leader.name }}</b>
      <span class="row"><i v-for="damage in leader.damage" :key="damage" :class="['ldt', damageClass(damage)]">{{ damage }}</i><i v-if="patrols(leader)" class="lwb pt">巡逻</i><i v-if="leader.hiddenCore" class="lwb hc">隐秘核心</i></span>
    </span>
    <span class="lwr-hp"><b>{{ wan(hp) }}</b><span class="trk"><i :key="mode" :style="{ width: hp / max * 100 + '%' }"></i></span></span>
    <span class="go" aria-hidden="true">›</span>
  </button>
</template>
