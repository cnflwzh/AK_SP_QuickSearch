<script setup lang="ts">
import {ref} from 'vue';
import {BORROW_LIMIT} from '../../../data/index.ts';
import {boxSeasonBorrowedCount} from '../../lib/box/store.ts';
import {lazyView} from '../../lib/ui/lazyView.ts';

const Recommendations = lazyView(
  () => import('./BoxPlannerRecommendations.vue'),
);
const open = ref(false);
const visited = ref(false);

// 第一次展开时加载推荐；收起后保留筛选，停止渲染和计算清单。
function toggle(): void {
  open.value = !open.value;
  if (open.value) visited.value = true;
}
</script>

<template>
  <section class="nc bxp" aria-label="助战与养成规划建议">
    <button
      type="button"
      class="bxp-summary"
      :aria-expanded="open"
      @click="toggle">
      <span class="bxp-summary-left">
        <span class="bxp-kicker">备战规划</span>
        <span class="bxp-summary-text">
          助战已借
          <b>{{ boxSeasonBorrowedCount }}/{{ BORROW_LIMIT }}</b>
        </span>
      </span>
      <span class="bxp-toggle">
        {{ open ? '收起规划' : '展开推荐清单' }}
        <i :class="['bxp-arrow', {open}]" aria-hidden="true">▾</i>
      </span>
    </button>

    <div v-if="visited" v-show="open">
      <Recommendations :expanded="open" />
    </div>
  </section>
</template>

<style scoped>
.bxp {
  display: grid;
  gap: 0;
  padding: 0;
  overflow: hidden;
}
.bxp-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
  width: 100%;
  min-height: 44px;
  padding: 9px 14px;
  border: 0;
  background: transparent;
  color: var(--ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.bxp-summary:hover {
  background: color-mix(in srgb, var(--accent) 4%, transparent);
}
.bxp-summary-left {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
}
.bxp-kicker {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 5px;
  background: var(--accent-soft);
  color: var(--accent);
}
.bxp-summary-text {
  font-size: 12.5px;
  color: var(--ink2);
}
.bxp-summary-text b {
  font-family: var(--fn);
  color: var(--ink);
}
.bxp-toggle {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
}
.bxp-arrow {
  display: inline-block;
  font-style: normal;
  transition: transform 0.16s ease;
}
.bxp-arrow.open {
  transform: rotate(180deg);
}
@media (max-height: 600px) {
  .bxp-summary {
    min-height: 38px;
    padding: 6px 11px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .bxp-arrow {
    transition: none;
  }
}
:global(:root[data-motion='reduce'] .bxp-arrow) {
  transition: none !important;
}
</style>
