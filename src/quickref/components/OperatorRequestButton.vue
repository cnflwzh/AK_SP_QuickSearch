<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { OPERATOR } from '../../../data/index.ts';

/** names 为实际要找的干员；提供 buildName 时生成整队求牌文本，否则生成单人求牌文本。 */
const props = defineProps<{ names: readonly string[]; buildName?: string }>();
const names = computed(() => [...new Set(props.names)].filter(Boolean));
// 聊天文本使用数字等阶，便于队友按调度中心等级找牌。
const requestedOperators = computed(() => names.value.map(name => {
  const operator = OPERATOR[name];
  return operator ? `${name}（${operator.tier}阶）` : name;
}).join('、'));
const requestText = computed(() => props.buildName !== undefined
  ? `我这局玩「${props.buildName || '这套阵容'}」，需要：${requestedOperators.value}。求求帮我留一下！`
  : `求求帮我留一下「${requestedOperators.value}」！`);
const copied = ref(false);
const copying = ref(false);
let copyRequest = 0;
let feedbackTimer: ReturnType<typeof setTimeout> | undefined;

function resetFeedback(): void {
  copyRequest++;
  clearTimeout(feedbackTimer);
  copied.value = false;
  copying.value = false;
}
watch(requestText, resetFeedback);
onBeforeUnmount(resetFeedback);

/** 仅在点击时写入剪贴板；权限不可用时展示可手动复制的文本。 */
async function copyRequestText(): Promise<void> {
  if (!names.value.length || copying.value) return;
  clearTimeout(feedbackTimer);
  const request = ++copyRequest;
  const text = requestText.value;
  copying.value = true;
  copied.value = false;
  try {
    await navigator.clipboard.writeText(text);
    // 权限请求期间可能切换流派或干员，旧操作不更新新内容的反馈。
    if (request !== copyRequest) return;
    copied.value = true;
    feedbackTimer = setTimeout(() => { copied.value = false; }, 1500);
  } catch {
    if (request === copyRequest) window.prompt('复制下面的求牌文本', text);
  } finally { if (request === copyRequest) copying.value = false; }
}
</script>

<template>
  <button
    type="button"
    class="btn operator-request"
    :disabled="!names.length || copying"
    :title="requestText"
    :aria-label="copied ? '已复制求牌文本' : buildName !== undefined ? '求求：复制整队干员名单' : `求求：复制${names.join('、')}的求牌文本`"
    @click="copyRequestText"
  ><span aria-live="polite">{{ copied ? '已复制' : '求求' }}</span></button>
</template>

<style scoped>
.operator-request {
  justify-content: center;
  padding: 4px 12px;
  border-radius: 6px;
  background: var(--surface);
  font-family: inherit;
  color: var(--ink);
  white-space: nowrap;
}
</style>
