import { computed, inject, onBeforeUnmount, onMounted, provide, readonly, ref, type ComputedRef, type InjectionKey, type Ref } from 'vue';
import { OPERATOR } from '../../data/index.ts';

/** 本次页面会话的 Wiki 阅读状态，不写入流派或持久化存储。 */
export interface WikiPanelController {
  readonly available: Readonly<Ref<boolean>>;
  readonly operatorName: Readonly<Ref<string>>;
  readonly isOpen: ComputedRef<boolean>;
  /** 选择完整干员名称；宽度足够时打开侧栏并返回 true，否则保留原生外链行为。 */
  open(name: string): boolean;
  /** 卸载 Wiki 页面并将键盘焦点还给打开侧栏的入口。 */
  close(): void;
}

const wikiPanelKey: InjectionKey<WikiPanelController> = Symbol('wiki-panel');
// 两侧各保留至少约 320 CSS 像素；展开的折叠屏无需鼠标或悬停能力。
const SPLIT_VIEW_QUERY = '(min-width: 640px)';

/** 在速查根组件 setup 中调用；媒体查询监听随组件卸载一并清理。 */
export function provideWikiPanel(): WikiPanelController {
  const available = ref(false);
  const operatorName = ref('');
  const isOpen = computed(() => available.value && !!operatorName.value);
  let mediaQuery: MediaQueryList | undefined;
  let returnFocus: HTMLElement | null = null;

  function syncAvailability(): void {
    available.value = mediaQuery?.matches ?? false;
    // 合屏时由 isOpen 卸载 iframe，保留选择，重新展开后恢复阅读。
  }

  onMounted(() => {
    mediaQuery = window.matchMedia(SPLIT_VIEW_QUERY);
    syncAvailability();
    mediaQuery.addEventListener('change', syncAvailability);
  });
  onBeforeUnmount(() => mediaQuery?.removeEventListener('change', syncAvailability));

  const controller: WikiPanelController = {
    available: readonly(available),
    operatorName: readonly(operatorName),
    isOpen,
    open(name) {
      if (!mediaQuery?.matches || !OPERATOR[name]) return false;
      if (!isOpen.value) returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      operatorName.value = name;
      return true;
    },
    close() {
      operatorName.value = '';
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
      returnFocus = null;
    },
  };
  provide(wikiPanelKey, controller);
  return controller;
}

/** 获取可选的侧栏控制器；组件在其他页面使用时仍可作为普通 Wiki 外链。 */
export function useWikiPanel(): WikiPanelController | null {
  return inject(wikiPanelKey, null);
}
