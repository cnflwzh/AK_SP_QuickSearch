<script setup lang="ts">
import {computed, ref, toRefs} from 'vue';
import LiveStatus from '../../lib/ui/LiveStatus.vue';
import {BOUNTIES} from '../../../data/index.ts';
import {enemyIconSrc} from '../../lib/ui/assets.ts';
import {nameScore, normalize} from '../../lib/ui/match.ts';
import SubTabs, {
  type SubTabDirection,
  type SubTabItem,
} from '../components/SubTabs.vue';
import SearchInput from '../components/SearchInput.vue';
import SelectInput, {type SelectOption} from '../components/SelectInput.vue';
import EmptyState from '../components/EmptyState.vue';
import {useNumberToolsState} from './useNumberToolsState.ts';

const filters: readonly SubTabItem<'' | 'single' | 'multi'>[] = [
  {id: '', label: '全部'},
  {id: 'single', label: '单次'},
  {id: 'multi', label: '多轮'},
];
const sortOptions: readonly SelectOption<'' | 'reward'>[] = [
  {value: '', label: '默认顺序'},
  {value: 'reward', label: '资金从高到低'},
];
const {search, payout, sort} = toRefs(useNumberToolsState().bounty);
const listDir = ref<SubTabDirection>('');
const bounties = computed(() => {
  const query = normalize(search.value);
  const filtered = BOUNTIES.filter(
    (item) =>
      (!query || nameScore(item.name, query) > 0) &&
      (!payout.value ||
        (payout.value === 'single'
          ? item.when === '下场'
          : item.when !== '下场')),
  );
  return sort.value === 'reward'
    ? [...filtered].sort((a, b) => b.funds - a.funds)
    : filtered;
});
</script>

<template>
  <div class="nt-bounties">
    <div class="bar nt-toolbar">
      <h4 class="nt-section-title" aria-level="2">悬赏收益</h4>
      <span class="nt-muted">{{ bounties.length }} 项</span>
    </div>
    <section class="nc">
      <div class="bar nt-bounty-controls">
        <SearchInput
          v-model="search"
          placeholder="搜索悬赏敌人"
          aria-label="搜索悬赏敌人" />
        <SubTabs
          v-model="payout"
          :items="filters"
          :level="3"
          inline
          aria-label="悬赏发放时机"
          attr="bounty-payout"
          @change="(_, dir) => (listDir = dir)" />
        <SelectInput
          v-model="sort"
          :options="sortOptions"
          highlight-active
          aria-label="悬赏排序" />
      </div>
      <div class="nt-bounty-heading">
        <span>悬赏敌人</span>
        <span>资金</span>
        <span>发放时机</span>
      </div>
      <div
        :key="payout"
        :class="['nt-bounty-list', {'subtab-panel': !!listDir}]"
        :data-dir="listDir || undefined">
        <div
          v-for="bounty in bounties"
          :key="bounty.name"
          class="nt-bounty-row"
          :class="{recurring: bounty.when !== '下场'}">
          <span class="nt-bounty-enemy">
            <img
              :src="enemyIconSrc(bounty.enemyId)"
              alt=""
              width="36"
              height="36"
              loading="lazy"
              decoding="async" />
            <span>{{ bounty.name }}</span>
          </span>
          <strong>+{{ bounty.funds }}</strong>
          <span class="tag">{{ bounty.when }}</span>
        </div>
      </div>
      <EmptyState
        v-if="!bounties.length"
        compact
        message="没有匹配的悬赏"
        action-label="清空筛选"
        @action="
          search = '';
          payout = '';
        " />
    </section>
    <LiveStatus
      :message="
        bounties.length
          ? `悬赏筛选结果：${bounties.length} 项`
          : '没有匹配的悬赏'
      " />
  </div>
</template>
