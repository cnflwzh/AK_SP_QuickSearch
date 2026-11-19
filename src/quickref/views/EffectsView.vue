<script setup lang="ts">
import {computed, ref} from 'vue';
import {
  ALL_COVENANTS,
  COVENANTS,
  isBannableCovenant,
  isCoreCovenant,
} from '../../../data/index.ts';
import {atLayers} from '../../lib/plans/index.ts';
import {color, fx, bonusHeadcount, bonusText} from '../format.ts';
import {useQuickrefActions} from '../state.ts';
import {clearBans, run, runStat, runBans, toggleBan} from '../planStore.ts';
import RunBanner from '../components/RunBanner.vue';
import SubTabs, {
  type SubTabDirection,
  type SubTabItem,
} from '../components/SubTabs.vue';
import EmptyState from '../components/EmptyState.vue';
import CovenantIcon from '../components/CovenantIcon.vue';
/**
 * 盟约效果一览：所有盟约的激活 / 强化效果平铺成卡片，局内扫一眼就能查到。
 * 本局流派里有的盟约标出人数进度；填过层数的按该层数代入数值，并支持就地勾选禁池。
 */
import {routeQuery, updateQuery} from '../../router/navigation.ts';
import {queryText} from '../../router/location.ts';
const actions = useQuickrefActions();
const groups = ['', 'core', 'addon'];
const filter = computed({
  get: () => Math.max(0, groups.indexOf(queryText(routeQuery.value, 'group'))),
  set: (index: number) => {
    void updateQuery({group: groups[index] || null});
  },
});
const panelDir = ref<SubTabDirection>('');
const onlyRunFx = ref(false);
const banEditMode = ref(false);
const filterToRunFx = computed(
  () => onlyRunFx.value && !!run.value && runStat.value.size > 0,
);
const scopedCovenants = computed(() =>
  filterToRunFx.value
    ? ALL_COVENANTS.filter((name) => runStat.value.has(name))
    : ALL_COVENANTS,
);
const groupTabs = computed<readonly SubTabItem<number>[]>(() => {
  const all = scopedCovenants.value;
  const coreCount = all.filter((name) => isCoreCovenant(name)).length;
  return [
    {id: 0, label: '全部', count: all.length},
    {id: 1, label: '核心', count: coreCount},
    {id: 2, label: '附加', count: all.length - coreCount},
  ];
});
const list = computed(() =>
  scopedCovenants.value.filter(
    (name) => filter.value === 0 || isCoreCovenant(name) === (filter.value === 1),
  ),
);
const cards = computed(() =>
  list.value.map((name) => {
    const cov = COVENANTS[name],
      stat = runStat.value.get(name);
    const layers = stat ? (run.value?.plan.layers[name] ?? 0) : 0;
    const head = bonusHeadcount(cov.bonus);
    return {
      name,
      need: cov.need,
      core: isCoreCovenant(name),
      bannable: isBannableCovenant(name),
      stat,
      layers,
      banned: runBans.value.includes(name),
      effect: fx(layers ? atLayers(cov.effect, layers) : cov.effect),
      bonus: cov.bonus
        ? fx(
            layers
              ? atLayers(bonusText(cov.bonus), layers)
              : bonusText(cov.bonus),
          )
        : '',
      bonusLabel: head ? `${head} 名` : '强化',
    };
  }),
);
</script>
<template>
  <RunBanner />
  <div class="fxv">
    <div class="bar fxv-bar">
      <SubTabs
        v-model="filter"
        :items="groupTabs"
        :level="2"
        inline
        aria-label="盟约分类"
        attr="fxf"
        @change="(_, dir) => (panelDir = dir)" />
      <button
        v-if="run && runStat.size"
        type="button"
        :class="['run-filter-btn', {on: filterToRunFx}]"
        :aria-pressed="filterToRunFx"
        @click="onlyRunFx = !onlyRunFx">
        只看本局 {{ runStat.size }}
      </button>
      <button
        type="button"
        :class="['run-ban-btn', {on: banEditMode || runBans.length > 0}]"
        :aria-pressed="banEditMode"
        title="勾选本局随机被 ban 的盟约，同步过滤干员图鉴、抓牌概率和流派替补"
        @click="banEditMode = !banEditMode">
        {{
          banEditMode
            ? '完成禁池选择'
            : runBans.length
              ? `本局禁池 ${runBans.length}`
              : '标记本局禁池'
        }}
      </button>
      <button
        v-if="runBans.length"
        type="button"
        class="filter-clear"
        @click="clearBans()">
        清空禁池
      </button>
    </div>
    <div
      :key="filter"
      :class="['fxg', {'subtab-panel': !!panelDir}]"
      :data-dir="panelDir || undefined">
      <article
        v-for="c in cards"
        :key="c.name"
        :class="[
          'fxc',
          {
            on: c.stat?.active,
            max: c.stat?.bonusActive,
            off: c.stat?.broken,
            ban: c.banned,
          },
        ]"
        :style="{'--c': color(c.name)}">
        <header>
          <button
            type="button"
            class="n"
            :data-cv="c.name"
            data-peek="off"
            :title="`查看${c.name}盟约页`"
            @click="actions.openCovenant(c.name)">
            <CovenantIcon :name="c.name" />
            {{ c.name }}
          </button>
          <span class="need">{{ c.need }} 人</span>
          <button
            v-if="c.bannable && (banEditMode || c.banned)"
            type="button"
            :class="['fxc-ban-toggle', {on: c.banned}]"
            :aria-pressed="c.banned"
            :title="
              c.banned ? `解除 ${c.name} 禁池` : `将 ${c.name} 标为本局禁池`
            "
            @click="toggleBan(c.name)">
            {{ c.banned ? '✕ 已禁' : '标禁' }}
          </button>
          <span v-else-if="c.banned" class="ban">被 ban</span>
          <span v-if="c.stat" class="mine" :title="c.stat.members.join('、')">
            本局 {{ c.stat.count }}
            <template v-if="c.layers">· {{ c.layers }} 层</template>
          </span>
        </header>
        <p v-html="c.effect"></p>
        <p v-if="c.bonus" class="bn">
          <span class="tag a">{{ c.bonusLabel }}</span>
          <span v-html="c.bonus"></span>
        </p>
      </article>
      <EmptyState v-if="!cards.length" message="当前筛选下没有盟约" />
    </div>
  </div>
</template>
