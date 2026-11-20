<script setup lang="ts">
import {computed, ref, watch} from 'vue';
import {
  BOUNTIES,
  type Bounty,
  type CombatRole,
  type EnemyDamageKind,
} from '../../../data/index.ts';
import LiveStatus from '../../lib/ui/LiveStatus.vue';
import {enemyIconSrc} from '../../lib/ui/assets.ts';
import {normalize} from '../../lib/ui/match.ts';
import {bountyMatchScore} from '../searchRanking.ts';
import {state} from '../state.ts';
import SearchInput from './SearchInput.vue';
import SelectInput, {type SelectOption} from './SelectInput.vue';
import SubTabs, {type SubTabDirection, type SubTabItem} from './SubTabs.vue';
import EmptyState from './EmptyState.vue';
import CovenantCounterGrid from './CovenantCounterGrid.vue';

const search = ref('');
const payout = ref<'' | 'single' | 'multi'>('');
const feature = ref<'' | 'fly' | 'ground' | 'elem' | 'revive'>('');
const sort = ref<'' | 'reward' | 'reward-asc'>('');
const listDir = ref<SubTabDirection>('');

const expandedName = ref('');
const expandedRole = ref<'' | CombatRole>('');

watch(
  () => state.focusBounty,
  (target) => {
    if (!target) return;
    search.value = target;
    payout.value = '';
    feature.value = '';
    expandedName.value = target;
    expandedRole.value = '';
    state.focusBounty = '';
  },
  {immediate: true},
);

const singleCount = BOUNTIES.filter((b) => b.when === '下场').length;
const multiCount = BOUNTIES.length - singleCount;

const payoutTabs: readonly SubTabItem<'' | 'single' | 'multi'>[] = [
  {id: '', label: '全部', count: BOUNTIES.length},
  {id: 'single', label: '单次', count: singleCount},
  {id: 'multi', label: '多轮', count: multiCount},
];

const featureOptions: readonly SelectOption<
  '' | 'fly' | 'ground' | 'elem' | 'revive'
>[] = [
  {value: '', label: '全部类型'},
  {value: 'fly', label: '飞行 / 可升空'},
  {value: 'ground', label: '地面起步'},
  {value: 'elem', label: '含元素损伤'},
  {value: 'revive', label: '重生 / 隐匿'},
];

const sortOptions: readonly SelectOption<'' | 'reward' | 'reward-asc'>[] = [
  {value: '', label: '默认顺序'},
  {value: 'reward', label: '资金从高到低'},
  {value: 'reward-asc', label: '资金从低到高'},
];

function matchesFeature(item: Bounty): boolean {
  if (!feature.value) return true;
  if (feature.value === 'fly') {
    return (
      item.mobility === '飞行' ||
      Boolean(item.tags?.some((t) => t.includes('起飞') || t.includes('飞行')))
    );
  }
  if (feature.value === 'ground') return item.mobility === '地面';
  if (feature.value === 'elem') {
    return (
      item.damage === '元素' ||
      item.mechanics.includes('损伤') ||
      Boolean(item.roles?.includes('元素回复'))
    );
  }
  if (feature.value === 'revive') {
    return Boolean(
      item.tags?.some((t) => t.includes('重生') || t.includes('隐匿')),
    );
  }
  return true;
}

function matchesSearch(item: Bounty, query: string): boolean {
  if (!query) return true;
  return bountyMatchScore(item, query) > 0;
}

const bounties = computed(() => {
  const q = normalize(search.value);
  const filtered = BOUNTIES.filter(
    (item) =>
      matchesSearch(item, q) &&
      (!payout.value ||
        (payout.value === 'single'
          ? item.when === '下场'
          : item.when !== '下场')) &&
      matchesFeature(item),
  );
  if (sort.value === 'reward') {
    return [...filtered].sort((a, b) => b.funds - a.funds);
  }
  if (sort.value === 'reward-asc') {
    return [...filtered].sort((a, b) => a.funds - b.funds);
  }
  return filtered;
});

function rewardTone(funds: number): 'high' | 'mid' | 'low' {
  if (funds >= 4) return 'high';
  if (funds >= 2) return 'mid';
  return 'low';
}

const DAMAGE_LABEL: Readonly<Record<EnemyDamageKind, string>> = {
  物理: '物理伤害',
  法术: '法术伤害',
  混伤: '物法混伤',
  元素: '元素损伤',
  无: '无',
};

const DAMAGE_TONE: Readonly<Record<EnemyDamageKind, string>> = {
  物理: 'phy',
  法术: 'arts',
  混伤: 'mix',
  元素: 'elem',
  无: 'none',
};

function toggleCounter(bounty: Bounty, role?: CombatRole): void {
  if (!bounty.roles?.length) return;
  if (expandedName.value === bounty.name) {
    if (role && expandedRole.value !== role) {
      expandedRole.value = role;
      return;
    }
    expandedName.value = '';
    expandedRole.value = '';
    return;
  }
  expandedName.value = bounty.name;
  expandedRole.value = role ?? '';
}

function activeRolesFor(bounty: Bounty): readonly CombatRole[] {
  if (!bounty.roles?.length) return [];
  if (expandedName.value === bounty.name && expandedRole.value) {
    return [expandedRole.value];
  }
  return bounty.roles;
}

function resetFilters(): void {
  search.value = '';
  payout.value = '';
  feature.value = '';
  sort.value = '';
}
</script>

<template>
  <section class="bty-shell" aria-label="悬赏敌人情报与资金收益">
    <div class="bar bty-bar" data-key="bounty-filters">
      <SearchInput
        v-model="search"
        class="bty-search"
        placeholder="搜悬赏敌人、拼音或机制（如 隐匿 / 晕眩 / 飞行）…"
        aria-label="搜索悬赏敌人" />
      <SubTabs
        v-model="payout"
        :items="payoutTabs"
        :level="3"
        inline
        aria-label="悬赏敌人出现场次"
        attr="bounty-payout"
        @change="(_, dir) => (listDir = dir)" />
      <SelectInput
        v-model="feature"
        :options="featureOptions"
        highlight-active
        aria-label="敌人类型筛选" />
      <SelectInput
        v-model="sort"
        :options="sortOptions"
        highlight-active
        aria-label="资金排序" />
      <span class="cnt">
        已收录 {{ bounties.length }}/{{ BOUNTIES.length }} 项 · 资金按只归击倒者
      </span>
    </div>

    <div
      v-if="bounties.length"
      :key="payout"
      :class="['bty-grid', {'subtab-panel': !!listDir}]"
      :data-dir="listDir || undefined">
      <article
        v-for="bounty in bounties"
        :key="bounty.name"
        :class="[
          'bty-card',
          `tone-${rewardTone(bounty.funds)}`,
          {
            recurring: bounty.when !== '下场',
            expanded: expandedName === bounty.name,
          },
        ]">
        <header class="bty-head">
          <img
            :src="enemyIconSrc(bounty.enemyId)"
            alt=""
            width="42"
            height="42"
            loading="lazy"
            decoding="async" />
          <div class="bty-title">
            <div class="bty-name-row">
              <b>{{ bounty.name }}</b>
              <span :class="['bty-when', {recurring: bounty.when !== '下场'}]">
                {{ bounty.when }}
              </span>
            </div>
            <div class="bty-specs">
              <i :class="['bty-spec', {fly: bounty.mobility === '飞行'}]">
                {{ bounty.mobility }}
              </i>
              <i class="bty-spec">{{ bounty.range }}</i>
              <i
                v-if="bounty.damage !== '无'"
                :class="['bty-spec', `dmg-${DAMAGE_TONE[bounty.damage]}`]">
                {{ DAMAGE_LABEL[bounty.damage] }}
              </i>
              <i
                v-for="tag in (bounty.tags ?? []).slice(0, 3)"
                :key="tag"
                class="bty-tag">
                {{ tag }}
              </i>
            </div>
          </div>
          <strong class="bty-funds" :title="`每只击倒者获得 ${bounty.funds} 资金`">
            +{{ bounty.funds }}
            <small>资</small>
          </strong>
        </header>

        <div class="bty-body">
          <p class="bty-line">
            <span class="bty-k">机制</span>
            <span>{{ bounty.mechanics }}</span>
          </p>
          <p class="bty-line counter">
            <span class="bty-k">对策</span>
            <span>{{ bounty.counter }}</span>
          </p>
        </div>

        <div class="bty-foot">
          <template v-if="bounty.roles?.length">
            <span class="bty-foot-label">推荐对策</span>
            <button
              v-for="role in bounty.roles"
              :key="role"
              type="button"
              :class="[
                'bty-role-btn',
                {
                  on:
                    expandedName === bounty.name &&
                    (expandedRole === role ||
                      (expandedRole === '' && bounty.roles.length === 1)),
                },
              ]"
              :aria-expanded="expandedName === bounty.name"
              @click="toggleCounter(bounty, role)">
              {{ role }}
            </button>
            <button
              type="button"
              :class="['bty-expand-btn', {on: expandedName === bounty.name}]"
              :aria-expanded="expandedName === bounty.name"
              @click="toggleCounter(bounty)">
              {{
                expandedName === bounty.name ? '收起对策干员 ▲' : '查对策干员 ▾'
              }}
            </button>
          </template>
          <span v-else class="bty-foot-none">
            无特殊对策要求 · 常规阻挡即可清理
          </span>
        </div>

        <div
          v-if="expandedName === bounty.name && bounty.roles?.length"
          class="bty-drawer panel-reveal">
          <div v-if="bounty.roles.length > 1" class="bty-drawer-roles">
            <button
              type="button"
              :class="['bty-role-btn', {on: expandedRole === ''}]"
              @click="expandedRole = ''">
              全部职能
            </button>
            <button
              v-for="role in bounty.roles"
              :key="role"
              type="button"
              :class="['bty-role-btn', {on: expandedRole === role}]"
              @click="expandedRole = expandedRole === role ? '' : role">
              {{ role }}
            </button>
          </div>
          <CovenantCounterGrid :roles="activeRolesFor(bounty)" compact />
        </div>
      </article>
    </div>

    <EmptyState
      v-else
      card
      message="没有符合当前筛选条件的悬赏敌人"
      action-label="清空筛选条件"
      @action="resetFilters" />
    <LiveStatus :message="`当前显示 ${bounties.length} 名悬赏敌人`" />
  </section>
</template>

<style scoped>
.bty-shell {
  display: grid;
  gap: 10px;
}
.bty-bar {
  align-items: center;
}
.bty-search {
  flex: 1 1 210px;
  min-width: 170px;
}
.bty-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 330px), 1fr));
  gap: 8px;
  align-items: stretch;
}
.bty-card {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 9px 11px;
  border: 1px solid var(--line);
  border-left: 3.5px solid var(--line2);
  border-radius: 9px;
  background: var(--surface);
  min-width: 0;
  transition:
    border-color 0.14s ease,
    box-shadow 0.14s ease;
}
.bty-card.tone-high {
  border-left-color: var(--accent);
}
.bty-card.tone-mid {
  border-left-color: var(--teal);
}
.bty-card.recurring {
  background: color-mix(in srgb, var(--teal) 5%, var(--surface));
  border-color: color-mix(in srgb, var(--teal) 35%, var(--line));
  border-left-color: var(--teal);
}
.bty-card.expanded {
  grid-column: 1 / -1;
  border-color: var(--accent);
  box-shadow: 0 6px 20px -12px rgba(14, 30, 28, 0.35);
}
.bty-head {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) auto;
  gap: 9px;
  align-items: center;
}
.bty-head img {
  width: 42px;
  height: 42px;
  border-radius: 6px;
  border: 1px solid var(--line);
  background: #172321;
  object-fit: cover;
}
.bty-title {
  display: grid;
  gap: 4px;
  min-width: 0;
}
.bty-name-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
  min-width: 0;
}
.bty-name-row b {
  font-size: 14px;
  line-height: 1.25;
  color: var(--ink);
}
.bty-when {
  font-size: 10.5px;
  font-weight: 600;
  line-height: 1.35;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--surface2);
  color: var(--ink3);
  border: 1px solid var(--line);
  white-space: nowrap;
}
.bty-when.recurring {
  background: color-mix(in srgb, var(--teal) 14%, transparent);
  border-color: color-mix(in srgb, var(--teal) 45%, transparent);
  color: var(--teal);
}
.bty-specs {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}
.bty-spec,
.bty-tag {
  font-style: normal;
  font-size: 10.5px;
  line-height: 1.35;
  padding: 0 5px;
  border-radius: 4px;
  white-space: nowrap;
}
.bty-spec {
  background: var(--surface2);
  color: var(--ink2);
  font-weight: 600;
}
.bty-spec.fly {
  background: color-mix(in srgb, #2563eb 14%, transparent);
  color: #2563eb;
}
.bty-spec.dmg-phy {
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  color: var(--accent);
}
.bty-spec.dmg-arts {
  background: color-mix(in srgb, #4f7fd9 16%, transparent);
  color: #4f7fd9;
}
.bty-spec.dmg-mix {
  background: color-mix(in srgb, #9333ea 14%, transparent);
  color: #9333ea;
}
.bty-spec.dmg-elem {
  background: color-mix(in srgb, #cf4d93 15%, transparent);
  color: #cf4d93;
}
.bty-tag {
  background: color-mix(in srgb, var(--ink) 5%, transparent);
  color: var(--ink3);
}
.bty-funds {
  font-family: var(--fn);
  font-size: 20px;
  line-height: 1;
  font-weight: 700;
  color: var(--ink2);
  display: inline-flex;
  align-items: baseline;
  gap: 1px;
  padding: 5px 8px;
  border-radius: 7px;
  background: var(--surface2);
}
.bty-funds small {
  font-size: 11px;
  font-weight: 500;
  color: var(--ink3);
}
.bty-card.tone-high .bty-funds {
  color: var(--accent);
  background: var(--accent-soft);
}
.bty-card.tone-mid .bty-funds {
  color: var(--teal);
  background: var(--teal-soft);
}
.bty-body {
  flex: 1 1 auto;
  display: grid;
  align-content: start;
  gap: 4px;
  padding-top: 6px;
  border-top: 1px dashed var(--line);
}
.bty-line {
  margin: 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 6px;
  align-items: baseline;
  font-size: 12px;
  line-height: 1.5;
  color: var(--ink2);
}
.bty-line.counter {
  color: var(--ink);
}
.bty-k {
  font-size: 10.5px;
  font-weight: 700;
  padding: 0 5px;
  border-radius: 4px;
  background: var(--surface2);
  color: var(--ink3);
  line-height: 1.55;
  white-space: nowrap;
}
.bty-line.counter .bty-k {
  background: color-mix(in srgb, var(--teal) 13%, transparent);
  color: var(--teal);
}
.bty-foot {
  margin-top: auto;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
  padding-top: 6px;
  border-top: 1px solid var(--line);
}
.bty-foot-label {
  font-size: 11px;
  color: var(--ink3);
  margin-right: 2px;
}
.bty-foot-none {
  min-height: 28px;
  display: inline-flex;
  align-items: center;
  font-size: 11.5px;
  color: var(--ink3);
}
.bty-role-btn {
  min-height: 28px;
  padding: 1px 8px;
  border: 1px solid var(--line2);
  border-radius: 999px;
  background: var(--surface2);
  color: var(--ink2);
  font: inherit;
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  transition:
    border-color 0.14s ease,
    background-color 0.14s ease,
    color 0.14s ease;
}
.bty-role-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.bty-role-btn.on {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--accent-ink);
}
.bty-expand-btn {
  margin-left: auto;
  min-height: 28px;
  padding: 1px 9px;
  border: 1px solid color-mix(in srgb, var(--teal) 45%, var(--line2));
  border-radius: 6px;
  background: color-mix(in srgb, var(--teal) 8%, var(--surface));
  color: var(--teal);
  font: inherit;
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition:
    border-color 0.14s ease,
    background-color 0.14s ease,
    color 0.14s ease;
}
.bty-expand-btn:hover,
.bty-expand-btn.on {
  border-color: var(--teal);
  background: var(--teal);
  color: #fff;
}
.bty-drawer {
  display: grid;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--line2);
}
.bty-drawer-roles {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

:global(:root[data-theme='dark'] .bty-spec.fly) {
  color: #7eb2ff;
}
:global(:root[data-theme='dark'] .bty-spec.dmg-arts) {
  color: #8bb4ff;
}
:global(:root[data-theme='dark'] .bty-spec.dmg-mix) {
  color: #c896ff;
}
:global(:root[data-theme='dark'] .bty-spec.dmg-elem) {
  color: #f38bc2;
}
@media (prefers-color-scheme: dark) {
  :global(:root:not([data-theme='light']) .bty-spec.fly) {
    color: #7eb2ff;
  }
  :global(:root:not([data-theme='light']) .bty-spec.dmg-arts) {
    color: #8bb4ff;
  }
  :global(:root:not([data-theme='light']) .bty-spec.dmg-mix) {
    color: #c896ff;
  }
  :global(:root:not([data-theme='light']) .bty-spec.dmg-elem) {
    color: #f38bc2;
  }
}

@container quickref-view (max-width: 540px) {
  .bty-search {
    flex-basis: 100%;
  }
  .bty-role-btn,
  .bty-expand-btn {
    min-height: 34px;
  }
}

@media (max-height: 600px) {
  .bty-grid {
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
    gap: 6px;
  }
  .bty-card {
    padding: 7px 9px;
    gap: 5px;
  }
  .bty-role-btn,
  .bty-expand-btn {
    min-height: 34px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .bty-card,
  .bty-role-btn,
  .bty-expand-btn {
    transition: none;
  }
}
:global(:root[data-motion='reduce'] .bty-card),
:global(:root[data-motion='reduce'] .bty-role-btn),
:global(:root[data-motion='reduce'] .bty-expand-btn) {
  transition: none !important;
}
</style>
