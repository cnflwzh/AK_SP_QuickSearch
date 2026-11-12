<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router';

defineOptions({ inheritAttrs: false });
const props = defineProps<{ to: RouteLocationRaw; activate?: () => void }>();

/** Preserve native new-tab/copy-link behavior; plain clicks may also coordinate dialog history. */
function follow(event: MouseEvent, navigate: (event: MouseEvent) => unknown): void {
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  if (props.activate) {
    event.preventDefault();
    props.activate();
  } else void navigate(event);
}
</script>
<template>
  <RouterLink :to="to" custom v-slot="{ href, navigate }">
    <a v-bind="$attrs" :href="href" @click="follow($event, navigate)"><slot/></a>
  </RouterLink>
</template>
