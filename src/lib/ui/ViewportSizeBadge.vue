<script setup lang="ts">
import {onMounted, onUnmounted, ref, useTemplateRef, watch} from 'vue';
import {settings} from '../settings/store.ts';
import {readNavigationLayout} from './layoutDiagnostics.ts';
import {navigationLayout} from './windowMode.ts';

const size = ref('');
const detail = ref('');
let observer: ResizeObserver | undefined;
const badge = useTemplateRef<HTMLElement>('badge');
function updateSize(): void {
  // 与 CSS 媒体查询使用同一布局视口，便于定位小窗的响应式断点。
  size.value = `${window.innerWidth} × ${window.innerHeight} px`;
  if (settings.debugLayoutDetails) detail.value = readNavigationLayout();
}

// 新打开的原生弹窗会盖过所有 z-index。手动浮层只展示读数，焦点留给弹窗。
function onLayerToggle(event: Event): void {
  const target = event.target;
  const el = badge.value;
  if (!el || target === el || !(target instanceof HTMLElement)) return;
  if (!target.matches('dialog:modal, [popover]:popover-open')) return;
  el.hidePopover();
  el.showPopover();
}

onMounted(() => {
  // Wiki 分屏和隐藏标题可以只改变内容区，不触发窗口的 resize。
  watch(
    () => [
      settings.debugLayoutDetails,
      settings.showHeader,
      navigationLayout.value,
    ],
    () => {
      observer?.disconnect();
      if (settings.debugLayoutDetails) {
        observer ??= new ResizeObserver(updateSize);
        document
          .querySelectorAll('#view, .qbar')
          .forEach((el) => observer!.observe(el));
      }
      updateSize();
    },
    {immediate: true, flush: 'post'},
  );
  const el = badge.value;
  if (el && typeof el.showPopover === 'function') {
    el.popover = 'manual';
    el.showPopover();
    document.addEventListener('toggle', onLayerToggle, true);
  }
  window.addEventListener('resize', updateSize);
  window.addEventListener('pageshow', updateSize);
});
onUnmounted(() => {
  observer?.disconnect();
  document.removeEventListener('toggle', onLayerToggle, true);
  window.removeEventListener('resize', updateSize);
  window.removeEventListener('pageshow', updateSize);
});
</script>

<template>
  <Teleport to="body">
    <span ref="badge" class="viewport-size-badge">
      <span class="sr-only">页面视口尺寸：</span>
      {{ size }}
      <small v-if="settings.debugLayoutDetails">{{ detail }}</small>
    </span>
  </Teleport>
</template>

<style scoped>
.viewport-size-badge {
  position: fixed;
  inset: auto;
  top: calc(env(safe-area-inset-top, 0px) + 4px);
  left: calc(env(safe-area-inset-left, 0px) + 4px);
  margin: 0;
  z-index: 10001;
  pointer-events: none;
  user-select: none;
  white-space: nowrap;
  padding: 2px 6px;
  border: 1px solid var(--line2);
  border-radius: 5px;
  background: color-mix(in srgb, var(--surface) 78%, transparent);
  color: var(--ink);
  font:
    600 12px/1.3 ui-monospace,
    monospace;
  font-variant-numeric: tabular-nums;
}
.viewport-size-badge::backdrop {
  display: none;
}
.viewport-size-badge small {
  display: block;
  font: 11px/1.5 var(--fb, sans-serif);
}
@media print {
  .viewport-size-badge {
    display: none;
  }
}
</style>
