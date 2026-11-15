<script setup lang="ts">
import { computed, ref } from 'vue';
import { ALL_COVENANTS, OPERATORS, EQUIPMENT, STRATEGIES, TIER_LABELS } from '../../../data/index.ts';
import { normalize, nameScore } from '../../lib/match.ts';
import { avatarSrc, equipIconSrc, portraitSrc } from '../../lib/assets.ts';
import { eliteCopyCount, type RecordedOperator } from '../../lib/runAdvisor.ts';

const props = withDefaults(defineProps<{
  kind: 'op' | 'eq' | 'st';
  selected?: readonly string[];
  disabledNames?: readonly string[];
  excludedNames?: readonly string[];
  level?: number;
  action?: string;
  notice?: string;
  /** 批量选择允许原位移除；单选策略仍保持已选项不可重复提交。 */
  canDeselect?: boolean;
  maxSelected?: number;
  ownedOperators?: readonly Readonly<RecordedOperator>[];
  recording?: boolean;
  summary?: string;
  doneLabel?: string;
  canUndo?: boolean;
}>(), {
  selected: () => [], disabledNames: () => [], excludedNames: () => [], ownedOperators: () => [],
  level: 6, action: '添加', notice: '', summary: '', doneLabel: '完成',
});
const emit = defineEmits<{
  select: [name: string]; remove: [name: string]; details: [kind: 'op' | 'eq' | 'st', name: string]; done: []; undo: [];
}>();
const query = ref('');
const tier = ref(0);
const covenant = ref('');
const selectedNames = computed(() => new Set(props.selected));
const ownedByName = computed(() => new Map(props.ownedOperators.map(operator => [operator.name, operator])));
const atCapacity = computed(() => props.maxSelected !== undefined && props.selected.length >= props.maxSelected);
const hasFilters = computed(() => !!query.value || !!tier.value || !!covenant.value);
const placeholder = computed(() => props.kind === 'st' ? '名称 / 拼音 / 类型' : '名称 / 拼音 / 盟约');
// 录入允许奖励获得的高阶牌；本数仅限制默认推荐，不限制事实记录。
const items = computed(() => {
  if (props.kind === 'op') return OPERATORS.map(operator => ({
    name: operator.name, tier: operator.tier, detail: operator.covenants.join(' · '),
    tags: operator.covenants, image: avatarSrc(operator.name),
  }));
  if (props.kind === 'eq') return EQUIPMENT.map(equipment => ({
    name: equipment.name, tier: equipment.tier,
    detail: equipment.covenant ? `可组合${equipment.covenant}` : '通用装备',
    tags: [equipment.covenant || ''], image: equipIconSrc(equipment.name),
  }));
  return STRATEGIES.map(strategy => ({
    name: strategy.name, tier: 0, detail: strategy.skill,
    tags: [strategy.category], image: portraitSrc(strategy.name),
  }));
});
const results = computed(() => {
  const needle = normalize(query.value);
  return items.value
    .filter(item => !props.excludedNames.includes(item.name))
    .filter(item => !tier.value || item.tier === tier.value)
    .filter(item => !covenant.value || item.tags.includes(covenant.value))
    .map(item => ({
      ...item,
      match: !needle ? 1 : nameScore(item.name, needle) * 2
        || Math.max(0, ...item.tags.map(tag => nameScore(tag, needle))),
    }))
    .filter(item => item.match > 0)
    .sort((a, b) => b.match - a.match);
});
const selectedItems = computed(() => {
  const byName = new Map(items.value.map(item => [item.name, item]));
  return props.selected.flatMap(name => byName.has(name) ? [byName.get(name)!] : []);
});
function isDisabled(name: string): boolean {
  if (selectedNames.value.has(name)) return !props.canDeselect;
  return props.disabledNames.includes(name) || atCapacity.value;
}
function choose(name: string): void {
  if (isDisabled(name)) return;
  if (selectedNames.value.has(name) && props.canDeselect) emit('remove', name);
  else emit('select', name);
}
function actionLabel(name: string): string {
  if (selectedNames.value.has(name) && props.canDeselect) return `移出${name}`;
  return props.recording && ownedByName.value.has(name) ? `再记录一张${name}` : `${props.action}${name}`;
}
function ownershipLabel(name: string): string {
  const owned = props.kind === 'op' ? ownedByName.value.get(name) : undefined;
  if (!owned) return '';
  if (owned.elite) return '已精锐';
  if (props.recording && owned.copies + 1 >= eliteCopyCount(name)) return '再 1 张精锐';
  return `已有 ${owned.copies} 张`;
}
/** 卡片底部的一行状态：持有情况优先，其次提示高于本数（仍可录入奖励所得）。 */
function stateLabel(name: string, tier: number): string {
  return ownershipLabel(name) || (tier > props.level ? '高于本数' : '');
}
function clearFilters(): void { query.value = ''; tier.value = 0; covenant.value = ''; }
</script>

<template>
  <div class="ra-picker">
    <div class="ra-picker-controls">
      <label class="ra-search">
        <span class="sr-only">搜索候选</span>
        <input v-model="query" type="search" :placeholder="placeholder" autocomplete="off" data-initial-focus>
      </label>
      <label v-if="kind !== 'st'">
        <span class="sr-only">按等阶筛选</span>
        <select v-model="tier">
          <option :value="0">全部等阶</option>
          <option v-for="value in 6" :key="value" :value="value">{{ TIER_LABELS[value] }} 阶</option>
        </select>
      </label>
      <label v-if="kind === 'op'" class="ra-picker-covenant">
        <span class="sr-only">按盟约筛选</span>
        <select v-model="covenant">
          <option value="">全部盟约</option>
          <option v-for="name in ALL_COVENANTS.filter(name => name !== '绝技')" :key="name" :value="name">{{ name }}</option>
        </select>
      </label>
    </div>
    <div class="ra-picker-status">
      <span>{{ results.length }} 项{{ atCapacity ? ' · 已满，可移除已选项' : ` · 点卡片${action}` }}</span>
      <button v-if="hasFilters" type="button" class="ra-text-button" @click="clearFilters">清除筛选</button>
      <span class="ra-picker-notice" role="status" aria-live="polite">{{ notice }}</span>
    </div>
    <div class="ra-picker-grid">
      <article v-for="item in results" :key="item.name" class="ra-picker-card"
        :class="{ chosen: selectedNames.has(item.name), owned: kind === 'op' && ownedByName.has(item.name) }" :data-t="item.tier">
        <button type="button" class="ra-pick-entity"
          :disabled="isDisabled(item.name)" :aria-pressed="canDeselect ? selectedNames.has(item.name) : undefined"
          :aria-label="actionLabel(item.name)" @click="choose(item.name)">
          <span class="ra-picker-picture">
            <img :src="item.image" alt="" width="44" height="44" loading="lazy">
            <i v-if="item.tier">{{ TIER_LABELS[item.tier] }}</i>
            <b v-if="selectedNames.has(item.name)">✓</b>
            <b v-else-if="kind === 'op' && ownedByName.has(item.name)">{{ ownedByName.get(item.name)!.elite ? '精' : `×${ownedByName.get(item.name)!.copies}` }}</b>
          </span>
          <strong>{{ item.name }}</strong>
          <small>{{ disabledNames.includes(item.name) ? '已精锐' : item.detail }}</small>
          <em v-if="stateLabel(item.name, item.tier)" :class="{ warn: item.tier > level && !ownershipLabel(item.name) }">{{ stateLabel(item.name, item.tier) }}</em>
        </button>
        <button type="button" class="ra-pick-info" :aria-label="`查看${item.name}详情`" title="详情"
          @click="$emit('details', kind, item.name)">i</button>
      </article>
      <div v-if="!results.length" class="ra-empty">
        <p>没有匹配的候选。</p>
        <button v-if="hasFilters" type="button" class="btn" @click="clearFilters">清除筛选</button>
      </div>
    </div>
    <div class="ra-picker-footer">
      <div v-if="canDeselect && selectedItems.length" class="ra-picker-selected" aria-label="已选候选">
        <button v-for="item in selectedItems" :key="item.name" type="button" :aria-label="`移出${item.name}`" @click="emit('remove', item.name)">
          <img :src="item.image" alt="" width="22" height="22" loading="lazy">
          <span>{{ item.name }}</span><span aria-hidden="true">×</span>
        </button>
      </div>
      <div class="ra-picker-actions">
        <span class="ra-muted">{{ maxSelected ? `已选 ${selected.length} / ${maxSelected}` : summary }}</span>
        <button type="button" class="ra-text-button" :disabled="!canUndo" @click="emit('undo')">撤销</button>
        <button type="button" class="btn p" @click="emit('done')">{{ doneLabel }}</button>
      </div>
    </div>
  </div>
</template>
