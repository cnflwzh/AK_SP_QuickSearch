<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

/** 手机编辑面板的容器；内容由调用方 Teleport 到 contentId，保持桌面和手机共用同一套表单。 */
const props = defineProps<{ open: boolean; title: string; context: string; contentId: string; canGoBack: boolean }>();
const emit = defineEmits<{ close: []; back: [] }>();
const dialog = ref<HTMLDialogElement>();
const heading = ref<HTMLElement>();
const content = ref<HTMLElement>();
const viewportHeight = ref('100dvh');
const viewportBottom = ref('0px');
let returnFocus: HTMLElement | null = null;

function syncViewport(): void {
  if (!props.open) return;
  const viewport = window.visualViewport;
  viewportHeight.value = `${viewport?.height ?? window.innerHeight}px`;
  viewportBottom.value = `${Math.max(0, window.innerHeight - (viewport?.offsetTop ?? 0) - (viewport?.height ?? window.innerHeight))}px`;
}
onMounted(() => {
  syncViewport();
  window.visualViewport?.addEventListener('resize', syncViewport);
  window.visualViewport?.addEventListener('scroll', syncViewport);
});

watch([() => props.open, () => props.context], async ([open, context]) => {
  await nextTick();
  if (!dialog.value || open !== props.open || context !== props.context) return;
  if (open) {
    syncViewport();
    if (!dialog.value.open) {
      returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.value.showModal();
    }
    if (content.value) content.value.scrollTop = 0;
    // 不自动聚焦搜索框，避免打开面板便弹出软键盘、遮住候选干员。
    heading.value?.focus({ preventScroll: true });
  } else if (dialog.value.open) {
    dialog.value.close();
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    returnFocus = null;
  }
}, { flush: 'post' });

onBeforeUnmount(() => {
  dialog.value?.close();
  window.visualViewport?.removeEventListener('resize', syncViewport);
  window.visualViewport?.removeEventListener('scroll', syncViewport);
});
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialog" class="pl pl-sheet" aria-labelledby="planner-sheet-title"
      :style="{ '--planner-viewport-height': viewportHeight, '--planner-viewport-bottom': viewportBottom }"
      @cancel.prevent="emit('close')" @keydown.esc.stop.prevent="emit('close')" @click.self="emit('close')"
    >
      <header class="pl-sheet-heading">
        <button v-if="canGoBack" type="button" class="btn" @click="emit('back')">‹ 返回</button>
        <h3 id="planner-sheet-title" ref="heading" tabindex="-1">{{ title }}</h3>
        <button type="button" class="btn pri" @click="emit('close')">完成</button>
      </header>
      <div :id="contentId" ref="content" class="pl-sheet-content" data-noswipe></div>
    </dialog>
  </Teleport>
</template>

<style scoped>
.pl-sheet {
  position: fixed;
  inset: auto 0 var(--planner-viewport-bottom, 0px);
  margin: 0 auto;
  padding: 0;
  width: min(100%, 720px);
  max-width: 100%;
  max-height: calc(var(--planner-viewport-height, 100dvh) - 12px);
  height: min(86dvh, calc(var(--planner-viewport-height, 100dvh) - 12px));
  border: 1px solid var(--line);
  border-radius: 14px 14px 0 0;
  color: var(--ink);
  background: var(--surface);
  box-shadow: var(--shadow);
  overflow: hidden;
  gap: 0;
}
.pl-sheet:not([open]) { display: none; }
.pl-sheet[open] { display: flex; flex-direction: column; animation: planner-sheet-in .2s ease-out; }
.pl-sheet::backdrop { background: rgba(5, 12, 14, .5); }
.pl-sheet-heading { display: flex; align-items: center; gap: 8px; flex: none; padding: 12px; border-bottom: 1px solid var(--line); }
.pl-sheet-heading h3 { flex: 1; margin: 0; font-size: 16px; min-width: 0; }
.pl-sheet-heading h3:focus { outline: none; }
.pl-sheet-heading button { flex: none; min-height: 40px; }
.pl-sheet-content { min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 12px 12px max(16px, var(--safe-area-bottom)); }
:global(html:has(dialog.pl-sheet[open])) { overflow: hidden; }
@keyframes planner-sheet-in { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .pl-sheet[open] { animation: none; } }
</style>
