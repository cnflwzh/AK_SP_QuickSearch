<script setup lang="ts">
import type { RecruitAdvice } from '../../lib/runAdvisor.ts';
import { avatarSrc } from '../../lib/assets.ts';
defineProps<{ advice: readonly RecruitAdvice[]; emptyMessage: string }>();
defineEmits<{ recruit: [name: string] }>();
</script>

<template>
  <div class="ra-recommendations">
    <details v-for="(item, index) in advice" :key="item.operator.name"
      class="ra-recommendation" :class="{ cautious: item.score <= 0 }">
      <summary>
        <span class="ra-rank">{{ index + 1 }}</span>
        <img :src="avatarSrc(item.operator.name)" alt="" width="32" height="32" loading="lazy">
        <span class="ra-rec-text">
          <span><b>{{ item.operator.name }}</b><small>{{ item.label }}</small></span>
          <span class="ra-rec-preview">{{ item.losses.length ? `代价：${item.losses.join('、')}` : item.reasons[0] }}</span>
        </span>
        <button type="button" class="ra-grab" :disabled="item.kind === 'skip'"
          :aria-label="`已抓到${item.operator.name}`" title="记录已抓到"
          @click.stop.prevent="$emit('recruit', item.operator.name)">＋</button>
      </summary>
      <div class="ra-rec-detail">
        <ul><li v-for="reason in item.reasons" :key="reason">{{ reason }}</li></ul>
        <p v-if="item.replace">可换下 <b>{{ item.replace }}</b>，抓到后先入整备区。</p>
        <p v-if="item.losses.length" class="ra-warning">代价：{{ item.losses.join('；') }}</p>
      </div>
    </details>
    <p v-if="!advice.length" class="ra-empty">{{ emptyMessage }}</p>
  </div>
</template>
