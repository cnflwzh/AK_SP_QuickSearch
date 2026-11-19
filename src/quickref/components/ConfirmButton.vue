<script setup lang="ts">
import {onBeforeUnmount, ref, watch} from 'vue';

const props = withDefaults(
  defineProps<{
    label: string;
    confirmLabel?: string;
    cancelLabel?: string;
    tone?: 'danger' | 'neutral';
    disabled?: boolean;
    /** 外部状态变化时可重置确认态（如切换列表或退出编辑）。 */
    resetKey?: unknown;
  }>(),
  {
    confirmLabel: '确认',
    cancelLabel: '取消',
    tone: 'danger',
    disabled: false,
  },
);

const emit = defineEmits<{confirm: []}>();

const armed = ref(false);
const rootRef = ref<HTMLElement | null>(null);

function disarm(): void {
  armed.value = false;
}

function arm(): void {
  if (props.disabled) return;
  armed.value = true;
}

function submit(): void {
  armed.value = false;
  emit('confirm');
}

function onDocumentClick(event: MouseEvent): void {
  if (
    armed.value &&
    event.target instanceof Node &&
    !rootRef.value?.contains(event.target)
  ) {
    armed.value = false;
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && armed.value) {
    event.stopPropagation();
    armed.value = false;
  }
}

watch(
  () => props.resetKey,
  () => {
    armed.value = false;
  },
);

watch(armed, (active) => {
  if (active) {
    document.addEventListener('click', onDocumentClick, true);
    document.addEventListener('keydown', onKeydown);
  } else {
    document.removeEventListener('click', onDocumentClick, true);
    document.removeEventListener('keydown', onKeydown);
  }
});

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick, true);
  document.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <span ref="rootRef" class="q-confirm">
    <Transition name="q-confirm-swap" mode="out-in">
      <button
        v-if="!armed"
        key="idle"
        type="button"
        :disabled="disabled"
        :class="['q-confirm-trigger', `is-${tone}`]"
        @click="arm">
        {{ label }}
      </button>
      <span v-else key="armed" class="q-confirm-pair">
        <button
          type="button"
          :class="['q-confirm-ok', `is-${tone}`]"
          @click="submit">
          {{ confirmLabel }}
        </button>
        <button type="button" class="q-confirm-cancel" @click="disarm">
          {{ cancelLabel }}
        </button>
      </span>
    </Transition>
  </span>
</template>

<style scoped>
.q-confirm {
  display: inline-flex;
  align-items: center;
}
.q-confirm-pair {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.q-confirm-trigger,
.q-confirm-ok,
.q-confirm-cancel {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  padding: 5px 12px;
  border-radius: 6px;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition:
    border-color 0.14s ease,
    background-color 0.14s ease,
    color 0.14s ease;
}
.q-confirm-trigger:disabled {
  opacity: 0.42;
  cursor: not-allowed;
}
.q-confirm-trigger.is-danger {
  border: 1px solid color-mix(in srgb, var(--red) 45%, var(--line));
  background: var(--surface2);
  color: var(--red);
}
.q-confirm-trigger.is-danger:not(:disabled):hover {
  border-color: var(--red);
  background: color-mix(in srgb, var(--red) 10%, var(--surface));
}
.q-confirm-trigger.is-neutral {
  border: 1px solid var(--line2);
  background: var(--surface2);
  color: var(--ink2);
}
.q-confirm-trigger.is-neutral:not(:disabled):hover {
  border-color: var(--accent);
  color: var(--accent);
}
.q-confirm-ok {
  font-weight: 600;
}
.q-confirm-ok.is-danger {
  border: 1px solid var(--red);
  background: var(--red);
  color: #fff;
}
.q-confirm-ok.is-neutral {
  border: 1px solid var(--accent);
  background: var(--accent);
  color: var(--accent-ink);
}
.q-confirm-cancel {
  border: 1px solid var(--line2);
  background: var(--surface2);
  color: var(--ink2);
}
.q-confirm-cancel:hover {
  border-color: var(--accent);
  color: var(--ink);
}

.q-confirm-swap-enter-active,
.q-confirm-swap-leave-active {
  transition:
    opacity 0.14s ease,
    transform 0.14s ease;
}
.q-confirm-swap-enter-from {
  opacity: 0;
  transform: translateX(4px);
}
.q-confirm-swap-leave-to {
  opacity: 0;
  transform: translateX(-4px);
}

@media (max-height: 600px) {
  .q-confirm-trigger,
  .q-confirm-ok,
  .q-confirm-cancel {
    min-height: 34px;
    padding: 4px 10px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .q-confirm-trigger,
  .q-confirm-ok,
  .q-confirm-cancel,
  .q-confirm-swap-enter-active,
  .q-confirm-swap-leave-active {
    transition: none !important;
  }
}
:global(:root[data-motion='reduce'] .q-confirm-trigger),
:global(:root[data-motion='reduce'] .q-confirm-ok),
:global(:root[data-motion='reduce'] .q-confirm-cancel),
:global(:root[data-motion='reduce'] .q-confirm-swap-enter-active),
:global(:root[data-motion='reduce'] .q-confirm-swap-leave-active) {
  transition: none !important;
}
</style>
