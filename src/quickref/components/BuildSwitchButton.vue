<script setup lang="ts">
/** 同一个入口用于阅读和编辑；名称供读屏报出当前流派。 */
defineProps<{open: boolean; name?: string}>();
</script>

<template>
  <button
    type="button"
    class="build-picker-trigger"
    aria-haspopup="dialog"
    aria-controls="build-picker"
    :aria-expanded="open"
    :aria-label="name ? `切换流派，当前为${name}` : '切换流派'">
    <svg
      viewBox="0 0 20 20"
      width="17"
      height="17"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true">
      <path d="M3 6h13m-3-3 3 3-3 3M17 14H4m3-3-3 3 3 3" />
    </svg>
    切换流派
  </button>
</template>

<style scoped>
.build-picker-trigger {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid color-mix(in srgb, var(--accent) 26%, var(--line2));
  border-color: light-dark(#c6bbaa, #675e51);
  border-radius: 6px;
  background: var(--surface);
  background: light-dark(#f7f4ef, #292723);
  color: var(--ink);
  color: light-dark(#4e4539, #efe7da);
  font: 600 13px / 1.2 var(--fb);
  white-space: nowrap;
  cursor: pointer;
}
.build-picker-trigger svg {
  flex: none;
  color: light-dark(#756147, #cbb591);
}
@media (hover: hover) {
  .build-picker-trigger:hover {
    background: light-dark(#eee8de, #37322c);
    border-color: light-dark(#94816b, #a18c70);
  }
}
.build-picker-trigger:active,
.build-picker-trigger[aria-expanded='true'] {
  box-shadow: inset 0 0 0 2px color-mix(in srgb, currentColor 18%, transparent);
}
.build-picker-trigger:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
@media (max-width: 520px), (max-height: 600px) {
  .build-picker-trigger {
    min-height: 34px;
    padding-inline: 8px;
    font-size: 13px;
    gap: 4px;
  }
}
@media (prefers-reduced-motion: no-preference) {
  :global(:root:not([data-motion='reduce']) .build-picker-trigger) {
    transition:
      background-color 150ms ease,
      border-color 150ms ease,
      box-shadow 150ms ease;
  }
}
</style>
