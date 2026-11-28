<script setup lang="ts">
import {computed, ref, useAttrs, type StyleValue} from 'vue';

defineOptions({inheritAttrs: false});

const model = defineModel<string>({required: true});

const props = withDefaults(
  defineProps<{
    id?: string;
    placeholder?: string;
    label?: string;
    initialFocus?: boolean;
  }>(),
  {
    placeholder: '搜索…',
    initialFocus: false,
  },
);

const emit = defineEmits<{clear: []}>();

const attrs = useAttrs();
const inputRef = ref<HTMLInputElement | null>(null);
const resolvedLabel = computed(
  () => props.label ?? (attrs['aria-label'] as string | undefined) ?? '搜索',
);

function clear(): void {
  model.value = '';
  emit('clear');
  inputRef.value?.focus();
}

function focus(): void {
  inputRef.value?.focus();
}

defineExpose({focus, inputRef});
</script>

<template>
  <span
    :class="['q-search', {has: !!model}, attrs.class]"
    :style="attrs.style as StyleValue">
    <svg
      class="q-search-ic"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      aria-hidden="true"
      focusable="false">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
    <input
      :id="id"
      ref="inputRef"
      v-model="model"
      type="search"
      class="q-search-input"
      autocomplete="off"
      :placeholder="placeholder"
      :aria-label="resolvedLabel"
      :data-initial-focus="initialFocus ? '' : undefined" />
    <Transition name="q-clear">
      <button
        v-if="model"
        type="button"
        class="q-search-clear"
        aria-label="清空搜索"
        @click="clear">
        ✕
      </button>
    </Transition>
  </span>
</template>

<style scoped>
.q-search {
  --search-control-height: 36px;
  --search-clear-size: 28px;
  position: relative;
  display: inline-flex;
  align-items: center;
  flex: 1 1 180px;
  min-width: 130px;
  max-width: 100%;
}
.q-search-ic {
  position: absolute;
  left: 10px;
  width: 15px;
  height: 15px;
  color: var(--ink3);
  pointer-events: none;
  transition: color 0.15s ease;
}
.q-search:focus-within .q-search-ic {
  color: var(--accent);
}
.q-search-input {
  width: 100%;
  min-width: 0;
  min-height: var(--search-control-height);
  padding: 6px calc(var(--search-clear-size) + 5px) 6px 31px;
  border: 1px solid var(--line2);
  border-radius: 6px;
  background: var(--surface2);
  color: var(--ink);
  font: inherit;
  font-size: 13px;
  line-height: 1.45;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease,
    box-shadow 0.15s ease;
}
.q-search-input::-webkit-search-cancel-button {
  display: none;
}
.q-search-input:focus {
  border-color: var(--accent);
  background: var(--surface);
  box-shadow: 0 0 0 2px var(--accent-soft);
}
.q-search-input:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.q-search-clear {
  position: absolute;
  right: 3px;
  top: 50%;
  transform: translateY(-50%);
  width: var(--search-clear-size);
  height: var(--search-clear-size);
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--ink3);
  display: grid;
  place-items: center;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  transition:
    color 0.14s ease,
    background-color 0.14s ease;
}
.q-search-clear:hover {
  color: var(--accent);
  background: var(--accent-soft);
}

.q-clear-enter-active,
.q-clear-leave-active {
  transition:
    opacity 0.14s ease,
    transform 0.14s ease;
}
.q-clear-enter-from,
.q-clear-leave-to {
  opacity: 0;
  transform: translateY(-50%) scale(0.86);
}

@media (max-width: 800px), (pointer: coarse) {
  .q-search {
    --search-control-height: 40px;
    --search-clear-size: 34px;
  }
  .q-search-input {
    font-size: 16px;
  }
  .q-search-clear {
    right: 2px;
  }
}
@media (pointer: coarse) and (min-height: 601px) {
  .q-search {
    --search-control-height: 44px;
    --search-clear-size: 44px;
  }
}
@media (max-height: 600px) {
  .q-search {
    --search-control-height: 36px;
    --search-clear-size: 34px;
  }
  .q-search-input {
    padding-block: 5px;
  }
  .q-search-clear {
    right: 2px;
  }
}
@media (forced-colors: active) {
  .q-search-input:focus-visible {
    outline-color: Highlight;
  }
}
@media (prefers-reduced-motion: reduce) {
  .q-search-ic,
  .q-search-input,
  .q-search-clear,
  .q-clear-enter-active,
  .q-clear-leave-active {
    transition: none !important;
  }
}
:global(:root[data-motion='reduce'] .q-search-ic),
:global(:root[data-motion='reduce'] .q-search-input),
:global(:root[data-motion='reduce'] .q-search-clear),
:global(:root[data-motion='reduce'] .q-clear-enter-active),
:global(:root[data-motion='reduce'] .q-clear-leave-active) {
  transition: none !important;
}
</style>
