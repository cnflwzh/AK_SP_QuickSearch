<script setup lang="ts">
import { prefersReducedMotion } from './dom.ts';

const props = defineProps<{ targetId: string; stickyHeader: string }>();

/** Move keyboard focus past the repeated navigation without adding a URL fragment. */
function skipToContent(): void {
  const content = document.getElementById(props.targetId);
  if (!content) return;
  const headerHeight = document.querySelector(props.stickyHeader)?.getBoundingClientRect().height ?? 0;
  content.focus({ preventScroll: true });
  window.scrollTo({
    top: content.getBoundingClientRect().top + window.scrollY - headerHeight - 12,
    behavior: prefersReducedMotion() ? 'instant' : 'smooth',
  });
}
</script>

<template>
  <a class="skip-link" :href="`#${targetId}`" @click.prevent="skipToContent">跳到主要内容</a>
</template>
