<script setup lang="ts">
import { computed, ref } from 'vue';
import { OPERATORS, EQUIPMENT, STRATEGIES, TIER_LABELS } from '../../../data/index.ts';
import { normalize, nameScore } from '../../lib/match.ts';
import { avatarSrc, equipIconSrc, portraitSrc } from '../../lib/assets.ts';

const props = withDefaults(defineProps<{
  kind: 'op' | 'eq' | 'st';
  selected?: readonly string[];
  disabledNames?: readonly string[];
  excludedNames?: readonly string[];
  level?: number;
  action?: string;
  notice?: string;
}>(), { selected: () => [], disabledNames: () => [], excludedNames: () => [], level: 6, action: '添加', notice: '' });
defineEmits<{ select: [name: string]; details: [kind: 'op' | 'eq' | 'st', name: string] }>();
const query = ref('');
const tier = ref(0);
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
    .map(item => ({
      ...item,
      match: !needle ? 1 : nameScore(item.name, needle) * 2
        || Math.max(0, ...item.tags.map(tag => nameScore(tag, needle))),
    }))
    .filter(item => item.match > 0)
    .sort((a, b) => b.match - a.match);
});
</script>

<template>
  <div class="ra-picker">
    <div class="ra-picker-controls">
      <label class="ra-search">
        <span class="sr-only">搜索候选</span>
        <input v-model="query" type="search" placeholder="名称 / 拼音 / 盟约" autocomplete="off" autofocus>
      </label>
      <label v-if="kind !== 'st'">
        <span class="sr-only">按等阶筛选</span>
        <select v-model="tier">
          <option :value="0">全部等阶</option>
          <option v-for="value in 6" :key="value" :value="value">{{ TIER_LABELS[value] }} 阶</option>
        </select>
      </label>
    </div>
    <div class="ra-picker-status">
      <span>{{ results.length }} 项 · 点击卡片{{ action }}</span>
      <span role="status" aria-live="polite">{{ notice }}</span>
    </div>
    <div class="ra-picker-grid">
      <article v-for="item in results" :key="item.name" class="ra-picker-card"
        :class="{ chosen: selected.includes(item.name) }" :data-t="item.tier">
        <button type="button" class="ra-pick-entity"
          :disabled="selected.includes(item.name) || disabledNames.includes(item.name)"
          :aria-label="`${action}${item.name}`" @click="$emit('select', item.name)">
          <span class="ra-picker-picture">
            <img :src="item.image" alt="" width="48" height="48" loading="lazy">
            <i v-if="item.tier">{{ TIER_LABELS[item.tier] }}</i>
            <b v-if="selected.includes(item.name)">✓</b>
          </span>
          <strong>{{ item.name }}</strong>
          <small>{{ disabledNames.includes(item.name) ? '已精锐' : item.detail }}</small>
        </button>
        <div class="ra-picker-card-footer">
          <span v-if="item.tier > level">高于当前本数</span>
          <span v-else>{{ selected.includes(item.name) ? '已选' : '' }}</span>
          <button type="button" class="ra-text-button" :aria-label="`查看${item.name}详情`"
            @click="$emit('details', kind, item.name)">详情 ↗</button>
        </div>
      </article>
      <p v-if="!results.length" class="ra-empty">没有找到，试试名称或拼音首字母。</p>
    </div>
  </div>
</template>
