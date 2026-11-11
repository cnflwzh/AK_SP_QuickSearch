<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { whileVisible } from '../../lib/visibility';
import { jointDefense } from '../chapters/enemiesView';
import Markup from './Markup';
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const content = jointDefense(reduced.matches);
let dispose: (() => void) | undefined;
onMounted(() => {
  const svg = document.querySelector<SVGSVGElement>('#joint');
  if (!svg) return;
  svg.pauseAnimations();
  dispose = whileVisible(svg, () => { svg.unpauseAnimations(); return () => svg.pauseAnimations(); });
});
onBeforeUnmount(() => dispose?.());
</script>
<template><Markup as="svg" class="svgbox" id="joint" viewBox="0 0 520 220" :html="content" /></template>
