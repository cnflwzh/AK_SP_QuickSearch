<script setup lang="ts">
import { onBeforeUnmount, onDeactivated, onMounted, ref, useId, watch } from 'vue';

const props = withDefaults(defineProps<{
  title: string; wide?: boolean; canGoBack?: boolean;
  /** false 时只收起原生 dialog，保留选择器状态以便从详情返回。 */
  open?: boolean;
}>(), { open: true });
const emit = defineEmits<{ close: []; back: [] }>();
const dialog = ref<HTMLDialogElement>();
const heading = ref<HTMLElement>();
const titleId = useId();
const viewportHeight = ref('100dvh');
const viewportBottom = ref('0px');
let returnFocus: HTMLElement | null = null;
let contentFocus: HTMLElement | null = null;

/** 只在键鼠设备自动聚焦搜索；触屏先展示候选，避免弹窗打开便被键盘遮住。 */
function focusContent(): void {
  const canFocusSearch = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const remembered = contentFocus?.isConnected && !contentFocus.matches(':disabled')
    && (canFocusSearch || !contentFocus.matches('input, textarea')) ? contentFocus : null;
  const target = remembered ?? (canFocusSearch ? dialog.value?.querySelector<HTMLElement>('[data-initial-focus]') : null);
  (target ?? heading.value)?.focus({ preventScroll: true });
  contentFocus = null;
}
function syncViewport(): void {
  if (!props.open) return;
  const viewport = window.visualViewport;
  viewportHeight.value = `${viewport?.height ?? window.innerHeight}px`;
  viewportBottom.value = `${Math.max(0, window.innerHeight - (viewport?.offsetTop ?? 0) - (viewport?.height ?? window.innerHeight))}px`;
}
function syncVisibility(): void {
  if (!dialog.value) return;
  if (!props.open) {
    if (dialog.value.open) {
      contentFocus = dialog.value.contains(document.activeElement) && document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.value.close();
    }
    return;
  }
  syncViewport();
  if (!dialog.value.open) dialog.value.showModal();
  focusContent();
}
onMounted(() => {
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  window.visualViewport?.addEventListener('resize', syncViewport);
  window.visualViewport?.addEventListener('scroll', syncViewport);
  syncVisibility();
});
watch([() => props.open, () => props.title], syncVisibility, { flush: 'post' });
function release(): void {
  dialog.value?.close();
  if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  returnFocus = null;
}
onBeforeUnmount(() => {
  window.visualViewport?.removeEventListener('resize', syncViewport);
  window.visualViewport?.removeEventListener('scroll', syncViewport);
  release();
});
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
      :style="{ '--ra-viewport-height': viewportHeight, '--ra-viewport-bottom': viewportBottom }"
      @cancel.prevent="$emit('close')" @click="dismissBackdrop">
      <header class="ra-overlay-header">
        <button v-if="canGoBack" type="button" class="btn" @click="emit('back')">‹ 返回</button>
        <h2 :id="titleId" ref="heading" tabindex="-1">{{ title }}</h2>
        <button type="button" class="ra-icon-button" aria-label="关闭面板" @click="$emit('close')">×</button>
      </header>
      <div class="ra-overlay-body"><slot/></div>
    </dialog>
  </Teleport>
</template>
