<script setup lang="ts">
import { onActivated, onBeforeUnmount, onDeactivated, ref, watch } from 'vue';

const props = defineProps<{ message: string }>();
const announcement = ref('');
let timer: ReturnType<typeof setTimeout> | undefined;
let active = true;

/** Keep the live region mounted and announce only the latest settled result. */
function scheduleAnnouncement(): void {
  clearTimeout(timer);
  if (!active) return;
  if (!props.message) { announcement.value = ''; return; }
  timer = setTimeout(() => { announcement.value = props.message; }, 350);
}

watch(() => props.message, scheduleAnnouncement, { immediate: true });
onActivated(() => { active = true; scheduleAnnouncement(); });
onDeactivated(() => { active = false; clearTimeout(timer); announcement.value = ''; });
onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
  <span class="sr-only" role="status" aria-live="polite" aria-atomic="true">{{ announcement }}</span>
</template>
