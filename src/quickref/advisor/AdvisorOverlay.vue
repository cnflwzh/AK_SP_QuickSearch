<script setup lang="ts">
import { nextTick, onBeforeUnmount, onDeactivated, onMounted, ref, useId, watch } from 'vue';

const props = defineProps<{ title: string; wide?: boolean }>();
const emit = defineEmits<{ close: [] }>();
const dialog = ref<HTMLDialogElement>();
const titleId = useId();
let returnFocus: HTMLElement | null = null;
onMounted(() => {
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  dialog.value?.showModal();
});
watch(() => props.title, async () => {
  await nextTick();
  // 选装备后会回到同一个弹层中的干员编辑器，将焦点交回当前内容。
  const content = dialog.value?.querySelector('.ra-overlay-body');
  const target = content?.querySelector<HTMLElement>('[autofocus]')
    ?? content?.querySelector<HTMLElement>('button:not(:disabled), input, select');
  target?.focus({ preventScroll: true });
});
function release(): void {
  dialog.value?.close();
  if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  returnFocus = null;
}
onBeforeUnmount(release);
onDeactivated(() => { release(); emit('close'); });
function dismissBackdrop(event: MouseEvent): void {
  if (event.target !== dialog.value) return;
  const bounds = dialog.value.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) emit('close');
}
</script>

<template>
  <Teleport to="body">
    <dialog ref="dialog" class="ra-overlay workbench-controls" :class="{ wide }" :aria-labelledby="titleId"
      @cancel.prevent="$emit('close')" @click="dismissBackdrop">
      <header class="ra-overlay-header">
        <h2 :id="titleId">{{ title }}</h2>
        <button type="button" class="ra-icon-button" aria-label="关闭面板" @click="$emit('close')">×</button>
      </header>
      <div class="ra-overlay-body"><slot/></div>
    </dialog>
  </Teleport>
</template>
