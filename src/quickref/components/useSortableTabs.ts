import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  shallowRef,
  type ComponentPublicInstance,
} from 'vue';
import {
  moveContentTab,
  settings,
  updateSetting,
  type ContentTabId,
} from '../../lib/settings/index.ts';
import {prefersReducedMotion} from '../../lib/ui/dom.ts';

/** 管理设置页栏目排序的指针、键盘和过渡状态，卸载时撤销窗口监听与动画。 */
export function useSortableTabs() {
  const slotRefs = new Map<ContentTabId, HTMLElement>();
  const draggedTab = ref<ContentTabId | null>(null);
  const droppingTab = ref<ContentTabId | null>(null);
  const nudgedTab = ref<ContentTabId | null>(null);
  // 只在松手时提交全局设置，拖动预览不会触发顶部导航、持久化和其他页面更新。
  const draftTabOrder = shallowRef<ContentTabId[] | null>(null);
  const displayedTabOrder = computed(
    () => draftTabOrder.value ?? settings.tabOrder,
  );

  let activePointerId: number | null = null;
  let grabOffsetY = 0;
  let draggedHeight = 0;
  let lastClientY = 0;
  let swapPending = false;
  let dropTimer = 0;
  let nudgeTimer = 0;
  let dragFrame = 0;
  let dropFrame = 0;
  let dragGeometry: {
    top: number;
    bottom: number;
    slots: Map<ContentTabId, {top: number; height: number}>;
  } | null = null;

  /** 在开始拖动、滚动或列表换位后集中读取布局；指针移动本身只更新 transform。 */
  function measureDragGeometry(): void {
    const id = draggedTab.value;
    const list = id ? slotRefs.get(id)?.parentElement : null;
    if (!list) return;
    const bounds = list.getBoundingClientRect();
    dragGeometry = {
      top: bounds.top,
      bottom: bounds.bottom,
      slots: new Map(
        [...slotRefs].map(([key, slot]) => [
          key,
          {top: slot.offsetTop, height: slot.offsetHeight},
        ]),
      ),
    };
  }

  function setSlotRef(
    id: ContentTabId,
    el: Element | ComponentPublicInstance | null,
  ): void {
    if (el instanceof HTMLElement) {
      slotRefs.set(id, el);
    } else if (!el) {
      slotRefs.delete(id);
    }
  }

  function setItemDragY(id: ContentTabId, yPx: number | null): void {
    const item = slotRefs
      .get(id)
      ?.querySelector<HTMLElement>('.settings-tab-item');
    if (!item) return;
    if (yPx === null) {
      item.style.removeProperty('--drag-y');
    } else {
      const next = `${yPx}px`;
      if (item.style.getPropertyValue('--drag-y') !== next) {
        item.style.setProperty('--drag-y', next);
      }
    }
  }

  function getClampedVisualTop(): {
    visualTop: number;
    listTop: number;
  } | null {
    if (!dragGeometry) measureDragGeometry();
    if (!dragGeometry) return null;
    const minTop = dragGeometry.top - 8;
    const maxTop = Math.max(minTop, dragGeometry.bottom - draggedHeight + 8);
    const visualTop = Math.max(
      minTop,
      Math.min(maxTop, lastClientY - grabOffsetY),
    );
    return {visualTop, listTop: dragGeometry.top};
  }

  function syncDraggedOffset(): void {
    const id = draggedTab.value;
    if (!id) return;
    const info = getClampedVisualTop();
    if (!info) return;
    const slot = dragGeometry?.slots.get(id);
    if (!slot) return;
    setItemDragY(
      id,
      Math.round((info.visualTop - info.listTop - slot.top) * 10) / 10,
    );
  }

  async function checkLiveSwap(): Promise<void> {
    if (swapPending) return;
    const id = draggedTab.value;
    if (!id) return;
    const info = getClampedVisualTop();
    if (!info) return;

    const order = displayedTabOrder.value;
    const fromIndex = order.indexOf(id);
    if (fromIndex < 0) return;

    const dragCenterInList = info.visualTop - info.listTop + draggedHeight / 2;
    let targetIndex = fromIndex;

    for (let i = fromIndex + 1; i < order.length; i++) {
      const sibling = dragGeometry?.slots.get(order[i]);
      if (!sibling) continue;
      const mid = sibling.top + sibling.height / 2;
      if (dragCenterInList > mid) targetIndex = i;
      else break;
    }
    if (targetIndex === fromIndex) {
      for (let i = fromIndex - 1; i >= 0; i--) {
        const sibling = dragGeometry?.slots.get(order[i]);
        if (!sibling) continue;
        const mid = sibling.top + sibling.height / 2;
        if (dragCenterInList < mid) targetIndex = i;
        else break;
      }
    }

    if (targetIndex === fromIndex) return;
    swapPending = true;
    try {
      const nextOrder = [...order];
      nextOrder.splice(fromIndex, 1);
      nextOrder.splice(targetIndex, 0, id);
      draftTabOrder.value = nextOrder;
      await nextTick();
    } finally {
      swapPending = false;
    }
    if (draggedTab.value === id) {
      measureDragGeometry();
      syncDraggedOffset();
    }
  }

  function scheduleDragFrame(): void {
    if (dragFrame) return;
    dragFrame = requestAnimationFrame(() => {
      dragFrame = 0;
      syncDraggedOffset();
      void checkLiveSwap();
    });
  }

  function cancelDrag(): void {
    finishDrag(undefined, false);
  }

  function onDragKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelDrag();
    }
  }

  function detachDragListeners(): void {
    window.removeEventListener('pointermove', onWindowPointerMove);
    window.removeEventListener('pointerup', finishDrag);
    window.removeEventListener('pointercancel', onPointerCancel);
    window.removeEventListener('scroll', onWindowScroll, true);
    window.removeEventListener('blur', cancelDrag);
    window.removeEventListener('resize', cancelDrag);
    window.removeEventListener('keydown', onDragKeyDown);
    cancelAnimationFrame(dragFrame);
    dragFrame = 0;
  }

  function onRowPointerDown(tabId: ContentTabId, event: PointerEvent): void {
    if (activePointerId !== null || !event.isPrimary) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, a, input, select')) return;
    if (
      event.pointerType !== 'mouse' &&
      !target?.closest('.settings-drag-grip')
    ) {
      return;
    }
    const slotEl = slotRefs.get(tabId);
    if (!slotEl) return;

    event.preventDefault();
    cancelAnimationFrame(dropFrame);
    window.clearTimeout(dropTimer);
    if (droppingTab.value) {
      setItemDragY(droppingTab.value, null);
      droppingTab.value = null;
    }

    const rect = slotEl.getBoundingClientRect();
    activePointerId = event.pointerId;
    grabOffsetY = event.clientY - rect.top;
    draggedHeight = rect.height;
    lastClientY = event.clientY;
    draggedTab.value = tabId;
    draftTabOrder.value = [...settings.tabOrder];
    measureDragGeometry();
    setItemDragY(tabId, 0);

    window.addEventListener('pointermove', onWindowPointerMove);
    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', onPointerCancel);
    window.addEventListener('blur', cancelDrag);
    window.addEventListener('resize', cancelDrag);
    window.addEventListener('keydown', onDragKeyDown);
    window.addEventListener('scroll', onWindowScroll, {
      capture: true,
      passive: true,
    });
  }

  function onWindowPointerMove(event: PointerEvent): void {
    if (event.pointerId !== activePointerId) return;
    lastClientY = event.clientY;
    scheduleDragFrame();
  }

  function onWindowScroll(): void {
    if (!draggedTab.value) return;
    dragGeometry = null;
    scheduleDragFrame();
  }

  function onPointerCancel(event: PointerEvent): void {
    if (event.pointerId === activePointerId) cancelDrag();
  }

  async function finishDrag(
    event?: PointerEvent,
    commit = true,
  ): Promise<void> {
    if (
      event &&
      activePointerId !== null &&
      event.pointerId !== activePointerId
    ) {
      return;
    }
    const id = draggedTab.value;
    const pointerId = activePointerId;
    // pointerup 可能早于最后一次动画帧，先消费最新位置再提交。
    if (commit && event) lastClientY = event.clientY;
    detachDragListeners();
    if (!id) return;
    if (commit) {
      await checkLiveSwap();
      await nextTick();
      if (draggedTab.value !== id || activePointerId !== pointerId) return;
      measureDragGeometry();
      syncDraggedOffset();
    }
    activePointerId = null;
    const order = draftTabOrder.value;
    if (
      commit &&
      order &&
      order.some((tab, index) => tab !== settings.tabOrder[index])
    ) {
      updateSetting('tabOrder', order);
    }
    draftTabOrder.value = null;
    dragGeometry = null;

    if (!commit || prefersReducedMotion()) {
      draggedTab.value = null;
      setItemDragY(id, null);
      return;
    }

    droppingTab.value = id;
    draggedTab.value = null;
    dropFrame = requestAnimationFrame(() => {
      if (droppingTab.value === id) {
        setItemDragY(id, 0);
      }
    });
    window.clearTimeout(dropTimer);
    dropTimer = window.setTimeout(() => {
      if (droppingTab.value === id) {
        droppingTab.value = null;
        setItemDragY(id, null);
      }
    }, 190);
  }

  function handleMoveTab(tabId: ContentTabId, delta: -1 | 1): void {
    cancelDrag();
    if (!moveContentTab(tabId, delta)) return;
    nudgedTab.value = tabId;
    window.clearTimeout(nudgeTimer);
    nudgeTimer = window.setTimeout(() => {
      if (nudgedTab.value === tabId) nudgedTab.value = null;
    }, 240);
  }

  onBeforeUnmount(() => {
    draggedTab.value = null;
    activePointerId = null;
    detachDragListeners();
    cancelAnimationFrame(dropFrame);
    window.clearTimeout(dropTimer);
    window.clearTimeout(nudgeTimer);
  });

  return {
    displayedTabOrder,
    draggedTab,
    droppingTab,
    nudgedTab,
    setSlotRef,
    onRowPointerDown,
    handleMoveTab,
  };
}
