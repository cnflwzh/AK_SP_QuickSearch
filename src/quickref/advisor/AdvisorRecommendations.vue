<script setup lang="ts">
import type { RecruitAdvice } from '../../lib/runAdvisor.ts';
import { avatarSrc } from '../../lib/assets.ts';
defineProps<{ advice: readonly RecruitAdvice[]; emptyMessage: string }>();
defineEmits<{ recruit: [name: string] }>();
const contributionLabels = [
  ['lineup', '阵容'], ['production', '持续收益/投入'], ['acquisition', '获取收益'],
  ['collection', '收集进度'], ['fit', '搭配（同分参考）'], ['economy', '经济'],
] as const;
function signed(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}`;
}
</script>

<template>
  <div class="ra-recommendations">
    <details v-for="(item, index) in advice" :key="item.operator.name"
      class="ra-recommendation" :class="{ cautious: item.score <= 0 || item.affordable === false }">
      <summary>
        <span class="ra-rank">{{ index + 1 }}</span>
        <img :src="avatarSrc(item.operator.name)" alt="" width="32" height="32" loading="lazy">
        <span class="ra-rec-text">
          <span><b>{{ item.operator.name }}</b><small>{{ item.label }}</small></span>
          <span v-if="item.affordable === false" class="ra-rec-budget ra-warning">资金不足 · 仅供规划</span>
          <span class="ra-rec-preview">{{ item.reasons[0] || item.label }}{{ item.replace ? ` · 可换下${item.replace}` : '' }}</span>
          <span v-if="item.losses.length" class="ra-rec-budget ra-warning">有 {{ item.losses.length }} 项代价，展开查看</span>
        </span>
        <button type="button" class="ra-grab" :disabled="item.kind === 'skip'"
          :aria-label="`已抓到${item.operator.name}`" title="记录已抓到"
          @click.stop.prevent="$emit('recruit', item.operator.name)">＋</button>
      </summary>
      <div class="ra-rec-detail">
        <p class="ra-rec-price" :class="{ 'ra-warning': item.affordable === false }">
          招募估价：{{ item.estimatedPrice == null ? '未知' : `${item.estimatedPrice} 资金` }}
          <span v-if="item.affordable === false"> · 当前资金不足</span>
          <span v-else-if="item.affordable === true"> · 当前资金可负担</span>
          <span v-else> · 预算判断未知</span>
        </p>
        <template v-if="item.breakdown">
          <p class="ra-muted">分项相对贡献（非伤害、非胜率）；搭配仅作同分参考，不计入总分</p>
          <dl class="ra-score-breakdown">
            <div v-for="[key, label] in contributionLabels" :key="key">
              <dt>{{ label }}</dt><dd :class="{ 'ra-warning': item.breakdown[key] < 0 }">{{ signed(item.breakdown[key]) }}</dd>
            </div>
          </dl>
        </template>
        <ul><li v-for="reason in item.reasons" :key="reason">{{ reason }}</li></ul>
        <p class="ra-muted">「＋」仅记录你已抓到的干员，不会购买或扣款。</p>
        <p v-if="item.replace">可换下 <b>{{ item.replace }}</b>，抓到后先入整备区。</p>
        <p v-if="item.losses.length" class="ra-warning">代价：{{ item.losses.join('；') }}</p>
      </div>
    </details>
    <p v-if="!advice.length" class="ra-empty">{{ emptyMessage }}</p>
  </div>
</template>
