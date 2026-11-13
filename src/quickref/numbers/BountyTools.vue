<script setup lang="ts">
import { computed, toRefs } from 'vue';
import LiveStatus from '../../lib/LiveStatus.vue';
import { BOUNTIES } from '../../../data/rules.ts';
import { enemyIconSrc } from '../../lib/assets.ts';
import { nameScore, normalize } from '../../lib/match.ts';
import Segmented from '../components/Segmented.vue';
import { useNumberToolsState } from './useNumberToolsState.ts';

const filters = [{ id: '', label: '全部' }, { id: 'single', label: '单次' }, { id: 'multi', label: '多轮' }] as const;
const { search, payout, sort } = toRefs(useNumberToolsState().bounty);
const bounties = computed(() => {
  const query = normalize(search.value);
  const filtered = BOUNTIES.filter(item => (!query || nameScore(item.name, query) > 0)
    && (!payout.value || (payout.value === 'single' ? item.when === '下场' : item.when !== '下场')));
  return sort.value === 'reward' ? [...filtered].sort((a, b) => b.funds - a.funds) : filtered;
});
</script>

<template>
  <div class="nt-bounties">
    <div class="bar nt-toolbar"><h4 class="nt-section-title" aria-level="2">悬赏收益</h4><span class="nt-muted">{{ bounties.length }} 项</span></div>
    <section class="nc">
      <div class="bar nt-bounty-controls">
        <input v-model="search" type="search" placeholder="搜索悬赏敌人" aria-label="搜索悬赏敌人">
        <Segmented :labels="filters.map(filter => filter.label)" :active="filters.findIndex(filter => filter.id === payout)" attr="bounty-payout" @change="payout = filters[$event].id"/>
        <select v-model="sort" aria-label="悬赏排序"><option value="">默认顺序</option><option value="reward">资金从高到低</option></select>
      </div>
      <div class="nt-bounty-heading"><span>悬赏敌人</span><span>资金</span><span>发放时机</span></div>
      <div class="nt-bounty-list">
        <div v-for="bounty in bounties" :key="bounty.name" class="nt-bounty-row" :class="{ recurring: bounty.when !== '下场' }">
          <span class="nt-bounty-enemy"><img :src="enemyIconSrc(bounty.enemyId)" alt="" width="36" height="36" loading="lazy" decoding="async"><span>{{ bounty.name }}</span></span>
          <strong>+{{ bounty.funds }}</strong><span class="tag">{{ bounty.when }}</span>
        </div>
      </div>
      <div v-if="!bounties.length" class="nt-no-results"><p>没有匹配的悬赏</p><button type="button" class="btn" @click="search = ''; payout = ''">清空筛选</button></div>
    </section>
    <LiveStatus :message="bounties.length ? `悬赏筛选结果：${bounties.length} 项` : '没有匹配的悬赏'"/>
  </div>
</template>
