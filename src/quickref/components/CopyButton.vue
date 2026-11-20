<script setup lang="ts">
import {computed} from 'vue';
import {useClipboardCopy} from './useClipboardCopy.ts';

const props = withDefaults(
  defineProps<{
    /** 要复制的文本，支持传函数以延迟拼装。 */
    text: string | (() => string);
    label: string;
    copiedLabel?: string;
    title?: string;
    disabled?: boolean;
    variant?: 'default' | 'primary' | 'compact';
    /** 剪贴板不可用时的降级方式：prompt 弹窗或 emit('fallback', text)。 */
    fallbackMode?: 'prompt' | 'emit';
    promptTitle?: string;
    resetMs?: number;
  }>(),
  {
    copiedLabel: '已复制',
    variant: 'default',
    fallbackMode: 'prompt',
    promptTitle: '复制下面的内容',
    resetMs: 1600,
  },
);

const emit = defineEmits<{
  copied: [text: string];
  fallback: [text: string];
}>();

const {copiedKey, copyText, reset} = useClipboardCopy(props.resetMs);
const isCopied = computed(() => copiedKey.value === 'ok');

async function handleClick(): Promise<void> {
  if (props.disabled) return;
  const content = typeof props.text === 'function' ? props.text() : props.text;
  if (!content) return;
  const outcome = await copyText(content, 'ok', {
    resetMs: props.resetMs,
    promptTitle:
      props.fallbackMode === 'prompt' ? props.promptTitle : undefined,
  });
  if (outcome === 'copied') emit('copied', content);
  else if (outcome === 'fallback') emit('fallback', content);
}

defineExpose({reset});
</script>

<template>
  <button
    type="button"
    :disabled="disabled"
    :title="title"
    :class="['copy-btn', `is-${variant}`, {copied: isCopied}]"
    @click="handleClick">
    <svg
      v-if="isCopied"
      class="copy-btn-ic"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true">
      <path d="M3.2 8.4 6.5 11.7 12.8 4.6" />
    </svg>
    <span>{{ isCopied ? copiedLabel : label }}</span>
  </button>
</template>

<style scoped>
.copy-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 36px;
  padding: 5px 12px;
  border: 1px solid var(--line2);
  border-radius: 6px;
  background: var(--surface2);
  color: var(--ink);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.3;
  white-space: nowrap;
  cursor: pointer;
  transition:
    border-color 0.16s ease,
    background-color 0.16s ease,
    color 0.16s ease;
}
.copy-btn:not(:disabled):hover {
  border-color: var(--accent);
  color: var(--accent);
}
.copy-btn:disabled {
  opacity: 0.42;
  cursor: not-allowed;
}
.copy-btn.is-primary {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--accent-ink);
  font-weight: 600;
}
.copy-btn.is-primary:not(:disabled):hover {
  filter: brightness(1.06);
  color: var(--accent-ink);
}
.copy-btn.is-compact {
  min-height: 32px;
  padding: 3px 10px;
  font-size: 12px;
}
.copy-btn.copied {
  border-color: color-mix(in srgb, var(--teal) 55%, var(--line));
  background: var(--teal-soft);
  color: var(--teal);
  font-weight: 600;
}
.copy-btn.is-primary.copied {
  border-color: var(--teal);
  background: var(--teal);
  color: var(--accent-ink);
}
.copy-btn-ic {
  width: 13px;
  height: 13px;
  flex: none;
  animation: copy-check-in 0.16s ease-out;
}
@keyframes copy-check-in {
  from {
    opacity: 0;
    transform: scale(0.8);
  }
}
@media (pointer: coarse), (max-height: 600px) {
  .copy-btn.is-compact {
    min-height: 34px;
  }
}
@media (max-height: 600px) {
  .copy-btn {
    min-height: 34px;
    padding: 4px 10px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .copy-btn,
  .copy-btn-ic {
    animation: none !important;
    transition: none !important;
  }
}
:global(:root[data-motion='reduce'] .copy-btn),
:global(:root[data-motion='reduce'] .copy-btn-ic) {
  animation: none !important;
  transition: none !important;
}
</style>
