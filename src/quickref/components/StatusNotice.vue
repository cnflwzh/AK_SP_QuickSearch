<script setup lang="ts">
withDefaults(
  defineProps<{
    message?: string;
    tone?: 'info' | 'success' | 'warning' | 'danger';
    dismissible?: boolean;
  }>(),
  {
    tone: 'info',
    dismissible: false,
  },
);

defineEmits<{dismiss: []}>();
</script>

<template>
  <div
    :class="['q-notice', `is-${tone}`]"
    :role="tone === 'danger' || tone === 'warning' ? 'alert' : 'status'">
    <span class="q-notice-body">
      <slot>{{ message }}</slot>
    </span>
    <button
      v-if="dismissible"
      type="button"
      class="q-notice-close"
      aria-label="关闭提示"
      @click="$emit('dismiss')">
      ✕
    </button>
  </div>
</template>

<style scoped>
.q-notice {
  --qn-c: var(--teal);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 11px;
  border-radius: 7px;
  border: 1px solid color-mix(in srgb, var(--qn-c) 35%, var(--line));
  border-left: 3px solid var(--qn-c);
  background: color-mix(in srgb, var(--qn-c) 7%, var(--surface));
  color: var(--ink);
  font-size: 12.5px;
  line-height: 1.5;
  animation: q-notice-in 0.16s ease-out;
}
.q-notice.is-info {
  --qn-c: var(--teal);
}
.q-notice.is-success {
  --qn-c: var(--green);
}
.q-notice.is-warning {
  --qn-c: var(--accent);
}
.q-notice.is-danger {
  --qn-c: var(--red);
  color: var(--red);
}
.q-notice-body {
  flex: 1;
  min-width: 0;
}
.q-notice-close {
  flex: none;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--ink3);
  display: grid;
  place-items: center;
  font-size: 12px;
  cursor: pointer;
  transition:
    color 0.14s ease,
    background-color 0.14s ease;
}
.q-notice-close:hover {
  color: var(--ink);
  background: color-mix(in srgb, var(--line) 45%, transparent);
}
@keyframes q-notice-in {
  from {
    opacity: 0;
    transform: translateY(3px);
  }
}
@media (pointer: coarse), (max-height: 600px) {
  .q-notice-close {
    width: 34px;
    height: 34px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .q-notice,
  .q-notice-close {
    animation: none !important;
    transition: none !important;
  }
}
:global(:root[data-motion='reduce'] .q-notice),
:global(:root[data-motion='reduce'] .q-notice-close) {
  animation: none !important;
  transition: none !important;
}
</style>
