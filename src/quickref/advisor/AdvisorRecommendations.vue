<script setup lang="ts">
import { avatarSrc } from '../../lib/assets.ts';
import type { RecruitAdvice } from '../../lib/runAdvisor.ts';

/**
 * 抓取建议列表。录入商店时它就是商店本身：按推荐排序，可直接记录抓到或移出候选；
 * 不参与推荐的商店牌（禁用、冲突）排在最后，说明原因。
 */
withDefaults(defineProps<{
  advice: readonly RecruitAdvice[];
  blocked?: readonly { name: string; reason: string }[];
  /** 商店模式：每行可移出候选。 */
  removable?: boolean;
  emptyMessage: string;
}>(), { blocked: () => [], removable: false });
defineEmits<{ recruit: [name: string]; remove: [name: string]; details: [name: string] }>();
</script>

<template>
  <ol v-if="advice.length || blocked.length" class="ra-recommendations">
    <li v-for="(item, index) in advice" :key="item.operator.name" class="ra-recommendation"
      :class="{ cautious: item.score <= 0, top: index === 0 && item.score > 0 }" :data-kind="item.kind">
      <details>
        <summary>
          <span class="ra-rank">{{ index + 1 }}</span>
          <img :src="avatarSrc(item.operator.name)" alt="" width="36" height="36" loading="lazy">
          <span class="ra-rec-text">
            <span class="ra-rec-title"><b>{{ item.operator.name }}</b><small>{{ item.label }}</small></span>
            <span class="ra-rec-preview">{{ item.losses.length ? `代价：${item.losses.join('、')}` : item.reasons[0] }}</span>
          </span>
        </summary>
        <div class="ra-rec-detail">
          <ul><li v-for="reason in item.reasons" :key="reason">{{ reason }}</li></ul>
          <p v-if="item.replace">可换下 <b>{{ item.replace }}</b>，抓到后先入整备区。</p>
          <p v-if="item.losses.length" class="ra-warning">代价：{{ item.losses.join('；') }}</p>
          <button type="button" class="ra-text-button" @click="$emit('details', item.operator.name)">查看特质 ↗</button>
        </div>
      </details>
      <div class="ra-rec-actions">
        <button type="button" class="ra-grab" :disabled="item.kind === 'skip'"
          :aria-label="`记录已抓到${item.operator.name}`" @click="$emit('recruit', item.operator.name)">＋抓到</button>
        <button v-if="removable" type="button" class="ra-rec-remove" :aria-label="`移出商店候选${item.operator.name}`"
          @click="$emit('remove', item.operator.name)">×</button>
      </div>
    </li>
    <li v-for="item in blocked" :key="item.name" class="ra-recommendation blocked">
      <div class="ra-rec-static">
        <span class="ra-rank">–</span>
        <img :src="avatarSrc(item.name)" alt="" width="36" height="36" loading="lazy">
        <span class="ra-rec-text">
          <span class="ra-rec-title"><b>{{ item.name }}</b><small>{{ item.reason }}</small></span>
          <span class="ra-rec-preview">不参与本轮推荐</span>
        </span>
      </div>
      <div class="ra-rec-actions">
        <button v-if="removable" type="button" class="ra-rec-remove" :aria-label="`移出商店候选${item.name}`"
          @click="$emit('remove', item.name)">×</button>
      </div>
    </li>
  </ol>
  <p v-else class="ra-empty">{{ emptyMessage }}</p>
</template>
