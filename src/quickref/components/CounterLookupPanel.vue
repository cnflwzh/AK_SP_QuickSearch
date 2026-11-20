<script setup lang="ts">
import type {CombatRole} from '../../../data/index.ts';
import CovenantCounterGrid from './CovenantCounterGrid.vue';

defineProps<{
  title: string;
  subtitle?: string;
  roles: readonly CombatRole[];
}>();
const emit = defineEmits<{close: []}>();
</script>

<template>
  <div
    class="counter-lookup panel-reveal"
    role="region"
    :aria-label="`${title}对策推荐`">
    <header class="cl-head">
      <div class="cl-title">
        <b>{{ title }}</b>
        <span v-if="subtitle" class="cl-sub">{{ subtitle }}</span>
        <span v-for="role in roles" :key="role" class="tag a">{{ role }}</span>
      </div>
      <button
        type="button"
        class="cl-close"
        aria-label="收起对策推荐"
        @click="emit('close')">
        收起 ✕
      </button>
    </header>

    <CovenantCounterGrid :roles="roles" compact />
  </div>
</template>

<style scoped>
.counter-lookup {
  display: grid;
  gap: 10px;
  margin-top: 10px;
  padding: 11px 13px;
  border: 1px solid color-mix(in srgb, var(--teal) 40%, var(--line2));
  border-left: 3px solid var(--teal);
  border-radius: 9px;
  background: color-mix(in srgb, var(--teal) 4%, var(--surface));
}
.cl-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 6px 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--line);
}
.cl-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 13.5px;
}
.cl-sub {
  font-size: 12px;
  color: var(--ink3);
}
.cl-close {
  min-height: 34px;
  padding: 2px 10px;
  border: 1px solid var(--line2);
  border-radius: 6px;
  background: var(--surface2);
  color: var(--ink2);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition:
    border-color 0.14s ease,
    color 0.14s ease;
}
.cl-close:hover {
  border-color: var(--accent);
  color: var(--accent);
}
@media (prefers-reduced-motion: reduce) {
  .cl-close {
    transition: none;
  }
}
:global(:root[data-motion='reduce'] .cl-close) {
  transition: none !important;
}
</style>
