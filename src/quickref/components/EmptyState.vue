<script setup lang="ts">
withDefaults(
  defineProps<{
    message: string;
    hint?: string;
    actionLabel?: string;
    showAction?: boolean;
    /** 卡片式边框（在独立工具卡片区内使用时开启）。 */
    card?: boolean;
    /** 紧凑内边距（用于弹窗或局部列表中）。 */
    compact?: boolean;
  }>(),
  {
    showAction: true,
    card: false,
    compact: false,
  },
);

defineEmits<{action: []}>();
</script>

<template>
  <div :class="['q-empty', {nc: card, 'is-compact': compact}]" role="status">
    <p class="q-empty-msg">{{ message }}</p>
    <p v-if="hint" class="q-empty-hint">{{ hint }}</p>
    <div v-if="(actionLabel && showAction) || $slots.default" class="q-empty-actions">
      <button
        v-if="actionLabel && showAction"
        type="button"
        class="q-empty-btn"
        @click="$emit('action')">
        {{ actionLabel }}
      </button>
      <slot />
    </div>
  </div>
</template>

<style scoped>
.q-empty {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: 28px 16px;
  text-align: center;
  color: var(--ink3);
  animation: q-empty-in 0.16s ease-out;
}
.q-empty.is-compact {
  padding: 16px 12px;
  gap: 6px;
}
.q-empty-msg {
  margin: 0;
  font-size: 13.5px;
  color: var(--ink2);
  line-height: 1.5;
}
.q-empty-hint {
  margin: 0;
  font-size: 12px;
  color: var(--ink3);
  line-height: 1.5;
}
.q-empty-actions {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 2px;
}
.q-empty-btn {
  min-height: 34px;
  padding: 5px 14px;
  border: 1px solid var(--line2);
  border-radius: 6px;
  background: var(--surface);
  color: var(--ink2);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition:
    border-color 0.14s ease,
    color 0.14s ease,
    background-color 0.14s ease;
}
.q-empty-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-soft);
}
@keyframes q-empty-in {
  from {
    opacity: 0;
  }
}
@media (max-height: 600px) {
  .q-empty {
    padding: 16px 12px;
    gap: 6px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .q-empty,
  .q-empty-btn {
    animation: none !important;
    transition: none !important;
  }
}
:global(:root[data-motion='reduce'] .q-empty),
:global(:root[data-motion='reduce'] .q-empty-btn) {
  animation: none !important;
  transition: none !important;
}
</style>
