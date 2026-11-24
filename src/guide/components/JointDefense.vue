<script setup lang="ts">
import {onBeforeUnmount, onMounted} from 'vue';
import {prefersReducedMotion} from '../../lib/ui/dom.ts';
import {whileVisible} from '../../lib/ui/visibility.ts';
import {jointDefense} from '../chapters/enemiesView.ts';
import Markup from './Markup.ts';

// Keep the same SVG nodes so whileVisible can resume animation if the OS preference changes.
const content = jointDefense();
let dispose: (() => void) | undefined;
onMounted(() => {
  const svg = document.querySelector<SVGSVGElement>('#joint');
  if (!svg) return;
  svg.pauseAnimations();
  dispose = whileVisible(svg, () => {
    if (!prefersReducedMotion()) svg.unpauseAnimations();
    return () => svg.pauseAnimations();
  });
});
onBeforeUnmount(() => dispose?.());
</script>
<template>
  <Markup
    as="svg"
    class="svgbox"
    id="joint"
    viewBox="0 0 520 220"
    role="img"
    aria-label="联合模拟联防示意"
    aria-describedby="joint-defense-description"
    :html="content" />
</template>
