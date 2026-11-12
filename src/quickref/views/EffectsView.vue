<script setup lang="ts">
import { computed, ref } from 'vue';
import { ALL_COVENANTS, COVENANTS, isCoreCovenant } from '../../../data/index.ts';
import { atLayers } from '../../lib/planner.ts';
import { color, fx, bonusHeadcount, bonusText } from '../format.ts';
import { useQuickrefActions } from '../state.ts';
import { run, runStat, runBans } from '../planStore.ts';
import RunBanner from '../components/RunBanner.vue';
import Segmented from '../components/Segmented.vue';
/**
 * 盟约效果一览：所有盟约的激活 / 强化效果平铺成卡片，局内扫一眼就能查到。
 * 本局流派里有的盟约标出人数进度；填过层数的按该层数代入数值。
 */
const actions = useQuickrefActions();
const filter = ref(0);
const labels = ['全部', '核心', '附加'];
const list = computed(() => ALL_COVENANTS.filter(name => filter.value === 0 || isCoreCovenant(name) === (filter.value === 1)));
const cards = computed(() => list.value.map(name => {
  const cov = COVENANTS[name], stat = runStat.value.get(name);
  const layers = stat ? run.value?.plan.layers[name] ?? 0 : 0;
  const head = bonusHeadcount(cov.bonus);
  return {
    name, need: cov.need, core: isCoreCovenant(name), stat, layers, banned: runBans.value.includes(name),
    effect: fx(layers ? atLayers(cov.effect, layers) : cov.effect),
    bonus: cov.bonus ? fx(layers ? atLayers(bonusText(cov.bonus), layers) : bonusText(cov.bonus)) : '',
    bonusLabel: head ? `${head} 名` : '强化',
  };
}));
</script>
<template>
  <RunBanner/>
  <div class="fxv">
    <div class="fxv-bar"><Segmented :labels="labels" :active="filter" attr="fxf" @change="filter = $event"/></div>
    <div class="fxg">
      <article v-for="c in cards" :key="c.name" :class="['fxc', { on: c.stat?.active, max: c.stat?.bonusActive, off: c.stat?.broken, ban: c.banned }]" :style="{ '--c': color(c.name) }">
        <header>
          <button type="button" class="n" :data-cv="c.name" data-peek="off" :title="`查看${c.name}盟约页`" @click="actions.openCovenant(c.name)">{{ c.name }}</button>
          <span class="need">{{ c.need }} 人</span>
          <span v-if="c.banned" class="ban">被 ban</span><span v-if="c.stat" class="mine" :title="c.stat.members.join('、')">本局 {{ c.stat.count }}<template v-if="c.layers"> · {{ c.layers }} 层</template></span>
        </header>
        <p v-html="c.effect"></p>
        <p v-if="c.bonus" class="bn"><span class="tag a">{{ c.bonusLabel }}</span> <span v-html="c.bonus"></span></p>
      </article>
    </div>
  </div>
</template>
