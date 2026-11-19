<script setup lang="ts">
import {computed, ref, watch} from 'vue';
import {OPERATOR} from '../../../data/index.ts';
import {settings} from '../../lib/settings/index.ts';
import CopyButton from './CopyButton.vue';

/** names 为实际要找的干员；提供 buildName 时生成整队求牌文本，否则生成单人求牌文本。 */
const props = defineProps<{
  names: readonly string[];
  buildName?: string;
  label?: string;
}>();
const names = computed(() => [...new Set(props.names)].filter(Boolean));
// 聊天文本使用数字等阶，便于队友按调度中心等级找牌。
const requestedOperators = computed(() =>
  names.value
    .map((name) => {
      const operator = OPERATOR[name];
      return operator ? `${name}（${operator.tier}阶）` : name;
    })
    .join('、'),
);
const requestText = computed(() =>
  props.buildName !== undefined
    ? `我这局玩「${props.buildName || '这套阵容'}」，需要：${requestedOperators.value}。求求帮我留一下！`
    : `求求帮我留一下「${requestedOperators.value}」！`,
);
const copyRef = ref<InstanceType<typeof CopyButton>>();
watch(requestText, () => copyRef.value?.reset());
</script>

<template>
  <CopyButton
    v-if="settings.showRequestButtons"
    ref="copyRef"
    class="operator-request"
    :text="requestText"
    :label="props.label || '求求'"
    copied-label="已复制"
    prompt-title="复制下面的求牌文本"
    :disabled="!names.length"
    :title="requestText"
    :aria-label="
      buildName !== undefined
        ? `${props.label || '求求'}：复制干员名单`
        : `求求：复制${names.join('、')}的求牌文本`
    " />
</template>

<style scoped>
.operator-request {
  background: var(--surface);
}
</style>
