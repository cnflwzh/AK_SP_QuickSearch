<script setup lang="ts">
import type {PlanIcon} from '../../lib/plans/model.ts';
import {planIconSrc} from '../../lib/ui/assets.ts';

defineProps<{icon?: PlanIcon}>();
</script>

<template>
  <span class="plan-emblem" :data-kind="icon?.kind" aria-hidden="true">
    <img
      v-if="icon"
      :src="planIconSrc(icon)"
      alt=""
      loading="lazy"
      decoding="async" />
    <svg
      v-else
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round">
      <rect x="4" y="4" width="12" height="12" rx="2" />
      <path d="M7 8h6M7 12h4" />
    </svg>
  </span>
</template>

<style scoped>
.plan-emblem {
  display: inline-grid;
  place-items: center;
  flex: none;
  width: var(--emblem-size, 34px);
  height: var(--emblem-size, 34px);
  overflow: hidden;
  border-radius: 7px;
  background: color-mix(in srgb, var(--c, var(--accent)) 12%, var(--surface));
  color: var(--c, var(--accent));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, currentColor 20%, transparent);
}
.plan-emblem[data-kind] {
  background: #243238;
}
.plan-emblem[data-kind='covenant'] {
  background: radial-gradient(
    at 50% 30%,
    color-mix(in srgb, var(--c, var(--teal)) 44%, #182628),
    #0d1618
  );
}
img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
[data-kind='covenant'] img {
  padding: 12%;
}
[data-kind='operator'] img,
[data-kind='strategy'] img {
  object-fit: cover;
  object-position: center 24%;
}
svg {
  width: 65%;
  height: 65%;
}
</style>
