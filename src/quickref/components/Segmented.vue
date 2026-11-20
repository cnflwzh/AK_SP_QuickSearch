<script setup lang="ts">
import {computed, ref} from 'vue';
import {useSlidingPill} from './useSlidingPill.ts';

const props = defineProps<{
  labels: readonly string[];
  active: number;
  attr: string;
}>();
defineEmits<{change: [index: number]}>();

const trackRef = ref<HTMLElement | null>(null);
const layoutSignature = computed(() => props.labels.join('|'));

const {pill, animated, pillStyle} = useSlidingPill({
  trackRef,
  activeSelector: 'button.on',
  activeSource: () => props.active,
  layoutSource: layoutSignature,
});
</script>

<template>
  <div ref="trackRef" class="seg" role="group">
    <span
      v-if="pill.visible"
      :class="['seg-pill', {animated}]"
      aria-hidden="true"
      :style="pillStyle" />
    <button
      v-for="(label, index) in labels"
      :key="label"
      type="button"
      :class="{on: index === active, 'is-fallback': index === active && !pill.visible}"
      :aria-pressed="index === active"
      v-bind="{['data-' + attr]: index}"
      @click="$emit('change', index)">
      {{ label }}
    </button>
  </div>
</template>

<style scoped>
.seg {
  position: relative;
  border-radius: 7px;
}
.seg-pill {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 0;
  pointer-events: none;
  border-radius: 5px;
  background: var(--accent);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.14);
}
.seg-pill.animated {
  transition:
    transform 0.2s cubic-bezier(0.22, 1, 0.36, 1),
    width 0.2s cubic-bezier(0.22, 1, 0.36, 1),
    height 0.2s cubic-bezier(0.22, 1, 0.36, 1);
}
.seg button {
  position: relative;
  z-index: 1;
  border-radius: 5px;
  transition:
    color 0.16s ease,
    background-color 0.14s ease;
}
.seg button:not(.on):hover {
  color: var(--ink);
  background: color-mix(in srgb, var(--surface) 55%, transparent);
}
.seg button.on:not(.is-fallback) {
  background: transparent;
}
@media (prefers-reduced-motion: reduce) {
  .seg-pill,
  .seg button {
    transition: none !important;
  }
}
:global(:root[data-motion='reduce'] .seg-pill),
:global(:root[data-motion='reduce'] .seg button) {
  transition: none !important;
}
</style>
