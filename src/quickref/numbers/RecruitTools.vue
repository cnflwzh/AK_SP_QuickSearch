<script setup lang="ts">
import { computed, ref, toRefs } from 'vue';
import LiveStatus from '../../lib/LiveStatus.vue';
import { OPERATORS } from '../../../data/operators.ts';
import { DISPATCH_BY_MODE, DISPATCH_MODES, operatorPrice, TIER_LABELS } from '../../../data/rules.ts';
import { SHOP_MODE_IDS } from '../../../data/numberTools.ts';
import type { Operator } from '../../../data/types.ts';
import { avatarSrc } from '../../lib/assets.ts';
import { nameScore, normalize } from '../../lib/match.ts';
import { synthesisTier } from '../../lib/numberTools.ts';
import { cardLocation } from '../../router/navigation.ts';
import { useQuickrefActions } from '../state.ts';
import NavigationLink from '../components/NavigationLink.vue';
import RefreshBudget from './RefreshBudget.vue';
import { useWishlist } from './useWishlist.ts';
import { useNumberToolsState, type ShopMode } from './useNumberToolsState.ts';

const actions = useQuickrefActions();
const { targets, names, maxTargets, saveFailed, add, remove } = useWishlist();
const copied = ref(false);
const copyFallback = ref('');
const recruitState = useNumberToolsState().recruit;
const { search, showAllResults, onlyAvailable, level, shopMode } = toRefs(recruitState);
const budget = recruitState.budget;
const modeIndex = computed(() => Math.max(0, SHOP_MODE_IDS.findIndex(mode => mode === shopMode.value)));
const levels = computed(() => DISPATCH_BY_MODE[modeIndex.value]);
const target = computed(() => OPERATORS.find(operator => operator.name === recruitState.targetName));
const rewardTier = computed(() => synthesisTier(level.value));
const searchResults = computed(() => {
  const query = normalize(search.value);
  if (!query) return [];
  return OPERATORS.filter(operator => (!onlyAvailable.value || operator.tier <= level.value)
    && (nameScore(operator.name, query) > 0 || operator.covenants.some(name => nameScore(name, query) > 0)));
});
const visibleResults = computed(() => showAllResults.value ? searchResults.value : searchResults.value.slice(0, 12));

function selectTarget(operator: Operator): void {
  recruitState.targetName = operator.name;
  search.value = '';
}
function searchOperators(event: Event): void {
  showAllResults.value = false;
  search.value = (event.target as HTMLInputElement).value;
}
function changeLevel(nextLevel: number): void {
  // 当前升级价属于当前等级，升/降级后需要重新填写，不沿用上一等级价格。
  level.value = nextLevel;
  budget.upgrade = null;
}
function changeMode(event: Event): void {
  shopMode.value = (event.target as HTMLSelectElement).value as ShopMode;
  budget.upgrade = null;
}
function addTarget(operator: Operator): void { add(operator.name); copied.value = false; copyFallback.value = ''; }
function removeTarget(name: string): void { remove(name); copied.value = false; copyFallback.value = ''; }
/** 仅在玩家点击复制时写剪贴板；权限不可用时提供可选中的文本。 */
async function copyTargets(): Promise<void> {
  const text = '卫戍待找干员\n' + targets.value.map(operator => `${operator.name} · ${TIER_LABELS[operator.tier]}阶 · ${operatorPrice(operator)}资金`).join('\n');
  try { await navigator.clipboard.writeText(text); copied.value = true; copyFallback.value = ''; }
  catch { copied.value = false; copyFallback.value = text; }
}
const searchSummary = computed(() => {
  if (!normalize(search.value)) return '';
  return searchResults.value.length
    ? `「${search.value}」找到 ${searchResults.value.length} 名干员，已显示 ${visibleResults.value.length} 名`
    : `没有匹配「${search.value}」的干员`;
});
</script>

<template>
  <div class="nt-recruit">
    <div class="bar nt-toolbar">
      <h4 class="nt-section-title" aria-level="2">找牌与升本</h4>
      <select :value="shopMode" aria-label="调度模式" @change="changeMode">
        <option v-for="(id, index) in SHOP_MODE_IDS" :key="id" :value="id">{{ DISPATCH_MODES[index] }}</option>
      </select>
    </div>
    <section class="nc nt-recruit-grid" aria-label="目标干员与刷新预算">
      <section class="nt-operator-search">
        <header class="nt-heading"><h4 aria-level="3">目标干员</h4><span class="nt-muted">名字 / 拼音 / 盟约</span></header>
        <div class="bar nt-search-row">
          <input type="search" :value="search" placeholder="找谁？" aria-label="查找目标干员" @input="searchOperators">
          <button v-if="search" type="button" class="btn nt-text-button" @click="search = ''">清空</button>
        </div>
        <template v-if="search">
          <label class="nt-checkbox"><input v-model="onlyAvailable" type="checkbox">仅看当前等级可刷 <small>{{ searchResults.length }} 名</small></label>
          <div class="nt-search-results">
            <div v-for="operator in visibleResults" :key="operator.name" class="nt-search-result" :class="{ selected: target?.name === operator.name }">
              <button type="button" class="nt-select-operator" @click="selectTarget(operator)">
                <img :src="avatarSrc(operator.name)" alt="" width="36" height="36" loading="lazy" decoding="async">
                <span><b>{{ operator.name }}</b><small>{{ operator.covenants.join(' · ') }}</small></span>
                <span class="nt-tier">{{ TIER_LABELS[operator.tier] }}</span>
              </button>
              <button type="button" class="nt-pin" :aria-label="`待找${operator.name}`" :disabled="names.includes(operator.name) || names.length >= maxTargets" @click="addTarget(operator)">{{ names.includes(operator.name) ? '✓' : '+' }}</button>
            </div>
          </div>
          <p v-if="!searchResults.length" class="nt-muted">没有匹配的干员</p>
          <button v-if="searchResults.length > 12 && !showAllResults" type="button" class="btn nt-text-button" @click="showAllResults = true">展开其余 {{ searchResults.length - 12 }} 名</button>
        </template>

        <div v-if="target" class="nt-target">
          <div class="nt-heading">
            <NavigationLink :to="cardLocation('op', target.name)" :activate="() => actions.openDetail('op', target!.name)" class="nt-target-name" :data-op="target.name">
              <img :src="avatarSrc(target.name)" alt="" width="44" height="44" loading="lazy" decoding="async">
              <span><b>{{ target.name }} <small>↗</small></b><small>{{ TIER_LABELS[target.tier] }} 阶 · 基础价 {{ operatorPrice(target) }}</small></span>
            </NavigationLink>
            <button type="button" class="btn nt-pin-label" :disabled="names.includes(target.name) || names.length >= maxTargets" @click="addTarget(target)">{{ names.includes(target.name) ? '已加入' : '+ 待找' }}</button>
          </div>
          <div class="nt-eligibility">
            <div :class="{ available: target.tier <= level }"><small>普通刷新</small><b>{{ target.tier <= level ? '等阶已开放' : `${target.tier} 级起可刷` }}</b><span>当前 {{ level }} 级 · 最高 {{ TIER_LABELS[level] }} 阶</span></div>
            <div :class="{ available: target.tier === rewardTier }"><small>合成奖励 · {{ TIER_LABELS[rewardTier] }} 阶</small><b>{{ target.tier === rewardTier ? '三选一中可出现' : target.tier === 1 ? '合成奖励 II 阶起' : `${target.tier - 1} 级合成可出此阶` }}</b><span>三名相同干员合成精锐</span></div>
          </div>
        </div>
      </section>

      <RefreshBudget v-model:funds="budget.funds" v-model:upgrade="budget.upgrade" v-model:reserve="budget.reserveOverride" :level="level" :target="target"/>
    </section>

    <section v-if="targets.length" class="nc nt-wishlist">
      <header class="nt-heading"><h4 aria-level="3">待找清单 <small>{{ targets.length }}/{{ maxTargets }}</small></h4><button type="button" class="btn nt-text-button" @click="copyTargets">{{ copied ? '已复制' : '复制给队友' }}</button></header>
      <div class="nt-target-list">
        <div v-for="operator in targets" :key="operator.name" class="nt-target-item">
          <button type="button" class="nt-select-operator" @click="selectTarget(operator)"><img :src="avatarSrc(operator.name)" alt="" width="36" height="36" loading="lazy" decoding="async"><span><b>{{ operator.name }}</b><small>{{ operator.tier }} 级起 · {{ operatorPrice(operator) }} 资金</small></span></button>
          <button type="button" class="nt-remove" :aria-label="`移除待找${operator.name}`" @click="removeTarget(operator.name)">×</button>
        </div>
      </div>
      <p v-if="saveFailed" role="status" class="nt-warning">清单暂未保存，请检查浏览器的存储权限。</p>
      <textarea v-if="copyFallback" class="nt-copy-fallback" readonly aria-label="待找清单文本" :value="copyFallback" @focus="($event.target as HTMLTextAreaElement).select()"></textarea>
    </section>

    <section class="nc nt-dispatch">
      <header class="nt-heading"><h4 aria-level="3">当前等级</h4><span class="nt-muted">升级价每回合 −1</span></header>
      <div class="nt-table-scroll">
        <table class="nt-dispatch-table">
          <thead><tr><th scope="col">调度中心</th><th v-for="row in levels" :key="row.level" scope="col" :class="{ current: level === row.level }">
            <button type="button" class="btn" :class="{ p: level === row.level }" :aria-pressed="level === row.level" :aria-label="`当前等级 ${row.level}`" @click="changeLevel(row.level)">{{ row.level }}<small>级</small></button>
          </th></tr></thead>
          <tbody>
            <tr><th scope="row">升级初始价</th><td v-for="row in levels" :key="row.level" :class="{ current: level === row.level }" :aria-label="row.upgradeCost === null ? '已满级' : undefined">{{ row.upgradeCost ?? '—' }}</td></tr>
            <tr><th scope="row">干员栏位</th><td v-for="row in levels" :key="row.level" :class="{ current: level === row.level }">{{ row.operatorSlots }}</td></tr>
            <tr><th scope="row">刷新最高阶</th><td v-for="row in levels" :key="row.level" :class="{ current: level === row.level }">{{ TIER_LABELS[row.level] }}</td></tr>
            <tr><th scope="row">合成奖励阶</th><td v-for="row in levels" :key="row.level" :class="{ current: level === row.level }">{{ TIER_LABELS[synthesisTier(row.level)] }}</td></tr>
          </tbody>
        </table>
      </div>
      <p class="nt-footnote">合成奖励：当前等级 +1 阶，最高 VI 阶，随机三选一</p>
    </section>
    <LiveStatus :message="searchSummary"/>
  </div>
</template>
