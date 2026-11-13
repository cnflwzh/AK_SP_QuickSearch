import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';

/** 按编辑区域的实际宽度启用紧凑交互，兼容手机、平板及 Wiki 分屏；卸载时释放观察器。 */
export function useCompactPlanner(root: Ref<HTMLElement | undefined>) {
  const compact = ref(window.matchMedia('(max-width: 860px)').matches);
  let observer: ResizeObserver | undefined;
  let layoutFrame = 0;
  onMounted(() => {
    if (!root.value) return;
    compact.value = root.value.clientWidth <= 860;
    observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const nextCompact = entry.contentRect.width <= 860;
      cancelAnimationFrame(layoutFrame);
      // 切换布局会改变被观察区域的尺寸，移到下一帧，避免在同一次尺寸通知中循环更新。
      layoutFrame = requestAnimationFrame(() => { compact.value = nextCompact; });
    });
    observer.observe(root.value);
  });
  onBeforeUnmount(() => {
    observer?.disconnect();
    cancelAnimationFrame(layoutFrame);
  });
  return compact;
}
