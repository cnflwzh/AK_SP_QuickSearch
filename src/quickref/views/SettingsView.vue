<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  shallowRef,
  type ComponentPublicInstance,
} from 'vue';
import {NUMBER_TOOLS} from '../../../data/index.ts';
import LiveStatus from '../../lib/ui/LiveStatus.vue';
import {downloadBlob} from '../../lib/ui/download.ts';
import {
  CONTENT_TAB_IDS,
  CUSTOMIZABLE_TOOL_IDS,
  MAX_SETTINGS_BACKUP_BYTES,
  applySettings,
  moveContentTab,
  parseSettingsBackup,
  resetAllSettings,
  resetContentTabs,
  serializeSettingsBackup,
  settings,
  toggleContentTabHidden,
  toggleToolHidden,
  updateSetting,
  visibleContentTabs,
  type CardDensity,
  type ContentTabId,
  type CustomizableToolId,
  type FontScale,
  type SettingsBackup,
  type ThemePreference,
} from '../../lib/settings/index.ts';
import {PAGE_LABELS} from '../../router/location.ts';
import {plans, restorePlanBackup} from '../planStore.ts';
import Segmented from '../components/Segmented.vue';
import '../workbench.css';

const THEME_OPTIONS: readonly {id: ThemePreference; label: string}[] = [
  {id: 'system', label: '跟随系统'},
  {id: 'light', label: '浅色模式'},
  {id: 'dark', label: '夜间模式'},
];
const DENSITY_OPTIONS: readonly {id: CardDensity; label: string}[] = [
  {id: 'auto', label: '自动（小窗紧凑）'},
  {id: 'comfortable', label: '标准舒适'},
  {id: 'compact', label: '全局紧凑'},
];
const FONT_OPTIONS: readonly {id: FontScale; label: string}[] = [
  {id: 'normal', label: '标准字号'},
  {id: 'large', label: '大字号'},
];

const MODULE_TOGGLES = [
  {
    key: 'showHeader',
    title: '顶部标题与教程入口',
    desc: '关闭后隐藏顶部标题与「图解教程」，搜索栏与栏目直接贴顶',
  },
  {
    key: 'showRunBanner',
    title: '跨页面「本局」提示横幅',
    desc: '勾选本局流派、禁池或领袖后，在各页面上方同步显示本局进度',
  },
  {
    key: 'showWikiLinks',
    title: 'PRTS Wiki 跳转与分屏阅读',
    desc: '在干员卡片右上角与详情弹窗中保留 PRTS 维基入口',
  },
  {
    key: 'showRequestButtons',
    title: '联机求牌快捷短语按钮',
    desc: '在流派与干员详情中保留一键复制队友找牌短语按钮',
  },
  {
    key: 'showFooter',
    title: '页面底部来源与许可栏',
    desc: '隐藏最底部数据来源与版权栏，减少页面末端占用',
  },
] as const;

const HABIT_TOGGLES = [
  {
    key: 'defaultOperatorElite',
    title: '干员列表默认展示「精锐」词条',
    desc: '打开干员页且未手动切换档位时，默认直接查看精锐强化描述',
  },
  {
    key: 'enableHoverPeek',
    title: '悬停 / 长按弹出速览小卡',
    desc: '鼠标悬停或触屏长按干员、盟约、装备卡片时弹出轻量速览',
  },
  {
    key: 'enableSwipeTabs',
    title: '触屏左右滑动切换栏目',
    desc: '在内容区横向滑动切换顶部页签（容易误触时可关闭）',
  },
] as const;

const toolMap = new Map(NUMBER_TOOLS.map((tool) => [tool.id, tool.label]));
const customizableTools = CUSTOMIZABLE_TOOL_IDS.map((id) => ({
  id,
  label: toolMap.get(id) ?? id,
}));

const themeIndex = computed(() =>
  Math.max(
    0,
    THEME_OPTIONS.findIndex((item) => item.id === settings.theme),
  ),
);
const densityIndex = computed(() =>
  Math.max(
    0,
    DENSITY_OPTIONS.findIndex((item) => item.id === settings.cardDensity),
  ),
);
const fontIndex = computed(() =>
  Math.max(
    0,
    FONT_OPTIONS.findIndex((item) => item.id === settings.fontScale),
  ),
);
const visibleTabList = computed(() => visibleContentTabs());
const isDefaultTabOrder = computed(
  () =>
    settings.hiddenTabs.length === 0 &&
    settings.defaultTab === 'last' &&
    settings.tabOrder.every((id, index) => id === CONTENT_TAB_IDS[index]),
);
const visibleToolCount = computed(
  () => CUSTOMIZABLE_TOOL_IDS.length - settings.hiddenTools.length,
);

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

function isReducedMotion(): boolean {
  return (
    settings.reducedMotion ||
    (typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  );
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

async function finishDrag(event?: PointerEvent, commit = true): Promise<void> {
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

  if (!commit || isReducedMotion()) {
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

/* ---------- 导入导出与重置 ---------- */
const fileInput = ref<HTMLInputElement>();
const includePlansInExport = ref(plans.length > 0);
const importPlansFromBackup = ref(true);
const showPasteBox = ref(false);
const pasteText = ref('');
const exportTextFallback = ref('');
const readingFile = ref(false);
const pendingBackup = shallowRef<SettingsBackup | null>(null);
const pendingSourceName = ref('');
const errorMessage = ref('');
const statusMessage = ref('');
const confirmResetOpen = ref(false);
let readRequest = 0;

onBeforeUnmount(() => {
  readRequest++;
  draggedTab.value = null;
  activePointerId = null;
  detachDragListeners();
  cancelAnimationFrame(dropFrame);
  window.clearTimeout(dropTimer);
  window.clearTimeout(nudgeTimer);
});

const previewExportedAt = computed(() =>
  pendingBackup.value
    ? new Date(pendingBackup.value.exportedAt).toLocaleString('zh-CN')
    : '',
);
const previewSummary = computed(() => {
  if (!pendingBackup.value) return '';
  const target = pendingBackup.value.settings;
  const themeLabel =
    THEME_OPTIONS.find((item) => item.id === target.theme)?.label ??
    target.theme;
  const densityLabel =
    DENSITY_OPTIONS.find((item) => item.id === target.cardDensity)?.label ??
    target.cardDensity;
  const parts = [themeLabel, densityLabel];
  if (target.hiddenTabs.length) {
    parts.push(`隐藏 ${target.hiddenTabs.length} 个栏目`);
  }
  if (target.hiddenTools.length) {
    parts.push(`隐藏 ${target.hiddenTools.length} 个子工具`);
  }
  if (pendingBackup.value.plans?.length) {
    parts.push(`附带 ${pendingBackup.value.plans.length} 套流派`);
  }
  return parts.join(' · ');
});

function clearNotices(): void {
  errorMessage.value = '';
  statusMessage.value = '';
  exportTextFallback.value = '';
}

function exportSettingsFile(): void {
  clearNotices();
  try {
    const bundled = includePlansInExport.value ? plans : undefined;
    const json = serializeSettingsBackup(settings, bundled);
    const now = new Date();
    const date = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-');
    downloadBlob(
      new Blob([json], {type: 'application/json;charset=utf-8'}),
      `卫戍速查-配置备份-${date}.json`,
    );
    statusMessage.value = bundled?.length
      ? `已导出配置与 ${bundled.length} 套流派文件。`
      : '已导出配置文件。';
  } catch (cause) {
    errorMessage.value =
      cause instanceof Error ? cause.message : '配置导出失败，请重试。';
  }
}

async function copySettingsText(): Promise<void> {
  clearNotices();
  try {
    const bundled = includePlansInExport.value ? plans : undefined;
    const json = serializeSettingsBackup(settings, bundled);
    try {
      await navigator.clipboard.writeText(json);
      statusMessage.value = bundled?.length
        ? `已复制配置文本（含 ${bundled.length} 套流派），可在其他设备粘贴导入。`
        : '已复制配置文本，可在其他设备粘贴导入。';
    } catch {
      exportTextFallback.value = json;
      statusMessage.value =
        '浏览器未授予剪贴板权限，请手动全选下方配置文本复制。';
    }
  } catch (cause) {
    errorMessage.value =
      cause instanceof Error ? cause.message : '配置序列化失败，请重试。';
  }
}

function loadBackupText(text: string, sourceLabel: string): void {
  pendingBackup.value = parseSettingsBackup(text);
  pendingSourceName.value = sourceLabel;
  importPlansFromBackup.value = (pendingBackup.value.plans?.length ?? 0) > 0;
}

async function onSelectFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  const request = ++readRequest;
  clearNotices();
  pendingBackup.value = null;
  readingFile.value = true;
  try {
    if (file.size > MAX_SETTINGS_BACKUP_BYTES) {
      throw new Error('配置文件超过 5 MB，请选择正确的配置备份文件。');
    }
    const text = await file.text();
    if (request !== readRequest) return;
    loadBackupText(text, file.name);
  } catch (cause) {
    if (request === readRequest) {
      errorMessage.value =
        cause instanceof Error ? cause.message : '文件读取失败，请重试。';
    }
  } finally {
    if (request === readRequest) readingFile.value = false;
  }
}

function parsePastedBackup(): void {
  // 粘贴的新配置取代尚未完成的文件读取，旧请求不得覆盖当前预览。
  readRequest++;
  readingFile.value = false;
  clearNotices();
  pendingBackup.value = null;
  if (!pasteText.value.trim()) {
    errorMessage.value = '请先粘贴导出的配置 JSON 文本。';
    return;
  }
  try {
    loadBackupText(pasteText.value, '剪贴板文本');
  } catch (cause) {
    errorMessage.value =
      cause instanceof Error ? cause.message : '配置解析失败，请检查粘贴内容。';
  }
}

function confirmImportBackup(): void {
  if (!pendingBackup.value) return;
  clearNotices();
  try {
    const incomingPlans = pendingBackup.value.plans;
    applySettings(pendingBackup.value.settings);
    const messages = ['已导入并应用页面设置'];
    if (importPlansFromBackup.value && incomingPlans?.length) {
      const merged = restorePlanBackup(incomingPlans);
      messages.push(`新增流派 ${merged.additions.length} 套`);
      if (merged.skipped) messages.push(`跳过重复 ${merged.skipped} 套`);
      if (merged.conflicts)
        messages.push(`冲突保留副本 ${merged.conflicts} 套`);
    }
    statusMessage.value = messages.join('，') + '。';
    pendingBackup.value = null;
    pendingSourceName.value = '';
    pasteText.value = '';
    showPasteBox.value = false;
  } catch (cause) {
    errorMessage.value =
      cause instanceof Error ? cause.message : '导入应用失败，请重试。';
  }
}

function cancelImportPreview(): void {
  readRequest++;
  readingFile.value = false;
  pendingBackup.value = null;
  pendingSourceName.value = '';
}

function handleToggleTool(id: CustomizableToolId): void {
  clearNotices();
  if (!toggleToolHidden(id)) {
    errorMessage.value = '至少需要保留 1 个小工具子栏目显示。';
  }
}

function handleToggleTab(id: ContentTabId): void {
  clearNotices();
  if (!toggleContentTabHidden(id)) {
    errorMessage.value = '顶部至少需要保留 1 个可见栏目。';
  }
}

function handleResetAll(): void {
  clearNotices();
  resetAllSettings();
  confirmResetOpen.value = false;
  statusMessage.value =
    '已恢复全部默认设置（自建流派与本局记录保留不受影响）。';
}
</script>

<template>
  <div class="settings-view workbench-controls">
    <div class="settings-grid">
      <section class="panel settings-card" aria-labelledby="set-appearance">
        <header class="settings-card-head">
          <div>
            <h2 id="set-appearance">外观与排版</h2>
            <p class="settings-desc">跨设备同步外观，夜间模式会自动记住选择</p>
          </div>
        </header>

        <div class="settings-rows">
          <div class="settings-row">
            <div class="settings-row-info">
              <b>主题模式</b>
              <small>切换浅色 / 夜间模式或跟随系统</small>
            </div>
            <Segmented
              :labels="THEME_OPTIONS.map((item) => item.label)"
              :active="themeIndex"
              attr="set-theme"
              @change="updateSetting('theme', THEME_OPTIONS[$event].id)" />
          </div>

          <div class="settings-row">
            <div class="settings-row-info">
              <b>卡片排版密度</b>
              <small>「全局紧凑」可让桌面与窄屏同时展示更多干员/策略卡片</small>
            </div>
            <Segmented
              :labels="DENSITY_OPTIONS.map((item) => item.label)"
              :active="densityIndex"
              attr="set-density"
              @change="
                updateSetting('cardDensity', DENSITY_OPTIONS[$event].id)
              " />
          </div>

          <div class="settings-row">
            <div class="settings-row-info">
              <b>界面文字大小</b>
              <small>放大卡片说明与正文，高分屏阅读更省力</small>
            </div>
            <Segmented
              :labels="FONT_OPTIONS.map((item) => item.label)"
              :active="fontIndex"
              attr="set-font"
              @change="updateSetting('fontScale', FONT_OPTIONS[$event].id)" />
          </div>

          <label class="settings-toggle-row">
            <span class="settings-row-info">
              <b>减弱动画与滑动过渡</b>
              <small>关闭切页滑入、微震动和展开动画</small>
            </span>
            <input
              type="checkbox"
              :checked="settings.reducedMotion"
              @change="
                updateSetting(
                  'reducedMotion',
                  ($event.target as HTMLInputElement).checked,
                )
              " />
          </label>
        </div>
      </section>

      <section class="panel settings-card" aria-labelledby="set-modules">
        <header class="settings-card-head">
          <div>
            <h2 id="set-modules">页面展示模块</h2>
            <p class="settings-desc">自由决定速查页面里要展示和隐藏哪些区域</p>
          </div>
        </header>

        <div class="settings-rows">
          <label
            v-for="item in MODULE_TOGGLES"
            :key="item.key"
            class="settings-toggle-row">
            <span class="settings-row-info">
              <b>{{ item.title }}</b>
              <small>{{ item.desc }}</small>
            </span>
            <input
              type="checkbox"
              :checked="settings[item.key]"
              @change="
                updateSetting(
                  item.key,
                  ($event.target as HTMLInputElement).checked,
                )
              " />
          </label>
        </div>
      </section>

      <section
        class="panel settings-card settings-card-wide"
        aria-labelledby="set-tabs">
        <header class="settings-card-head">
          <div>
            <h2 id="set-tabs">顶部 Tab 排列与显隐</h2>
            <p class="settings-desc">
              上下拖拽或点击箭头调整顺序（自上而下对应顶部从左到右），也可隐藏不需要的栏目；「设置」固定在最右侧且在小窗模式自动隐藏
            </p>
          </div>
          <button
            type="button"
            class="btn"
            :disabled="isDefaultTabOrder"
            @click="resetContentTabs">
            恢复默认顺序
          </button>
        </header>

        <div class="settings-tab-controls">
          <label class="settings-select-row">
            <span>打开网站默认进入</span>
            <select
              aria-label="打开网站默认进入"
              :value="settings.defaultTab"
              @change="
                updateSetting(
                  'defaultTab',
                  ($event.target as HTMLSelectElement).value as
                    'last' | ContentTabId,
                )
              ">
              <option value="last">上次浏览的页面（默认）</option>
              <option
                v-for="tabId in visibleTabList"
                :key="tabId"
                :value="tabId">
                {{ PAGE_LABELS[tabId] }}
              </option>
            </select>
          </label>

          <label class="settings-inline-check">
            <input
              type="checkbox"
              :checked="settings.showTabCounts"
              @change="
                updateSetting(
                  'showTabCounts',
                  ($event.target as HTMLInputElement).checked,
                )
              " />
            <span>在栏目名称旁显示总数角标（如 干员 142）</span>
          </label>
        </div>

        <TransitionGroup
          tag="ul"
          name="tab-sort"
          :class="['settings-tab-list', {'is-sorting': draggedTab !== null}]"
          aria-label="栏目顺序与显隐设置">
          <li
            v-for="(tabId, index) in displayedTabOrder"
            :key="tabId"
            :ref="(el) => setSlotRef(tabId, el)"
            :class="[
              'settings-tab-slot',
              {
                'is-dragging': draggedTab === tabId,
                'is-dropping': droppingTab === tabId,
                'is-nudged': nudgedTab === tabId,
              },
            ]">
            <div
              :class="[
                'settings-tab-item',
                {
                  hidden: settings.hiddenTabs.includes(tabId),
                  dragging: draggedTab === tabId,
                  dropping: droppingTab === tabId,
                },
              ]"
              @pointerdown="onRowPointerDown(tabId, $event)">
              <span
                class="settings-drag-grip"
                aria-hidden="true"
                title="上下拖拽调整顺序">
                ⋮⋮
              </span>
              <span class="settings-tab-idx" aria-hidden="true">
                {{ index + 1 }}
              </span>
              <span class="settings-tab-name">{{ PAGE_LABELS[tabId] }}</span>
              <div class="settings-tab-btns">
                <button
                  type="button"
                  class="btn settings-step-btn"
                  :disabled="index === 0"
                  :aria-label="`将${PAGE_LABELS[tabId]}向前移动一位`"
                  @click="handleMoveTab(tabId, -1)">
                  ↑
                </button>
                <button
                  type="button"
                  class="btn settings-step-btn"
                  :disabled="index === displayedTabOrder.length - 1"
                  :aria-label="`将${PAGE_LABELS[tabId]}向后移动一位`"
                  @click="handleMoveTab(tabId, 1)">
                  ↓
                </button>
                <button
                  type="button"
                  :class="[
                    'btn',
                    'settings-vis-btn',
                    {off: settings.hiddenTabs.includes(tabId)},
                  ]"
                  :aria-pressed="!settings.hiddenTabs.includes(tabId)"
                  :disabled="
                    !settings.hiddenTabs.includes(tabId) &&
                    visibleTabList.length <= 1
                  "
                  @click="handleToggleTab(tabId)">
                  {{
                    settings.hiddenTabs.includes(tabId) ? '已隐藏' : '显示中'
                  }}
                </button>
              </div>
            </div>
          </li>
        </TransitionGroup>
      </section>

      <section class="panel settings-card" aria-labelledby="set-habits">
        <header class="settings-card-head">
          <div>
            <h2 id="set-habits">速查与小工具习惯</h2>
            <p class="settings-desc">
              按使用习惯调整默认展开词条与小工具子页面
            </p>
          </div>
        </header>

        <div class="settings-rows">
          <label
            v-for="item in HABIT_TOGGLES"
            :key="item.key"
            class="settings-toggle-row">
            <span class="settings-row-info">
              <b>{{ item.title }}</b>
              <small>{{ item.desc }}</small>
            </span>
            <input
              type="checkbox"
              :checked="settings[item.key]"
              @change="
                updateSetting(
                  item.key,
                  ($event.target as HTMLInputElement).checked,
                )
              " />
          </label>

          <div class="settings-subblock">
            <div class="settings-row-info">
              <b>「小工具」内展示的子栏目</b>
              <small>隐藏不常用的子工具（至少保留 1 个）</small>
            </div>
            <div
              class="settings-tool-pills"
              role="group"
              aria-label="小工具子栏目">
              <button
                v-for="tool in customizableTools"
                :key="tool.id"
                type="button"
                :class="[
                  'settings-tool-pill',
                  {on: !settings.hiddenTools.includes(tool.id)},
                ]"
                :aria-pressed="!settings.hiddenTools.includes(tool.id)"
                :disabled="
                  !settings.hiddenTools.includes(tool.id) &&
                  visibleToolCount <= 1
                "
                @click="handleToggleTool(tool.id)">
                {{
                  settings.hiddenTools.includes(tool.id)
                    ? `+ ${tool.label}`
                    : `✓ ${tool.label}`
                }}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section class="panel settings-card" aria-labelledby="set-backup">
        <header class="settings-card-head">
          <div>
            <h2 id="set-backup">配置导入导出与重置</h2>
            <p class="settings-desc">
              换手机或清缓存前可导出全部自定义设置，在新设备上直接导入恢复
            </p>
          </div>
        </header>

        <div class="settings-rows">
          <label class="settings-inline-check">
            <input v-model="includePlansInExport" type="checkbox" />
            <span>
              导出时附带「我的流派 / 已修改预设」（当前 {{ plans.length }} 套）
            </span>
          </label>

          <div class="settings-btn-group">
            <button type="button" class="btn p" @click="exportSettingsFile">
              导出配置文件 (.json)
            </button>
            <button type="button" class="btn" @click="copySettingsText">
              复制配置文本
            </button>
            <button type="button" class="btn" @click="fileInput?.click()">
              选择文件导入
            </button>
            <button
              type="button"
              :class="['btn', {on: showPasteBox}]"
              :aria-expanded="showPasteBox"
              @click="showPasteBox = !showPasteBox">
              粘贴文本导入
            </button>
            <input
              ref="fileInput"
              type="file"
              accept=".json,application/json"
              hidden
              @change="onSelectFile" />
          </div>

          <div v-if="exportTextFallback" class="settings-box">
            <p class="settings-box-note">
              点击全选并复制以下配置文本，再到新设备的「粘贴文本导入」中使用：
            </p>
            <textarea
              class="settings-textarea"
              readonly
              aria-label="配置导出文本"
              :value="exportTextFallback"
              @focus="
                ($event.target as HTMLTextAreaElement).select()
              "></textarea>
          </div>

          <div v-if="showPasteBox" class="settings-box">
            <textarea
              v-model="pasteText"
              class="settings-textarea"
              aria-label="粘贴配置备份文本"
              placeholder="在此粘贴从其他设备复制的 JSON 配置文本…"></textarea>
            <div class="settings-btn-group">
              <button type="button" class="btn p" @click="parsePastedBackup">
                解析配置
              </button>
              <button
                type="button"
                class="btn"
                @click="
                  showPasteBox = false;
                  pasteText = '';
                ">
                收起
              </button>
            </div>
          </div>

          <p v-if="readingFile" class="settings-note" role="status">
            正在读取配置文件…
          </p>

          <div v-if="pendingBackup" class="settings-box settings-preview">
            <b>即将应用来自「{{ pendingSourceName }}」的配置</b>
            <small>导出时间：{{ previewExportedAt }}</small>
            <p class="settings-preview-summary">{{ previewSummary }}</p>
            <label
              v-if="pendingBackup.plans?.length"
              class="settings-inline-check">
              <input v-model="importPlansFromBackup" type="checkbox" />
              <span>
                同时合并恢复附带的
                {{ pendingBackup.plans.length }} 套流派（不覆盖现有内容）
              </span>
            </label>
            <div class="settings-btn-group">
              <button type="button" class="btn p" @click="confirmImportBackup">
                确认应用设置
              </button>
              <button type="button" class="btn" @click="cancelImportPreview">
                取消
              </button>
            </div>
          </div>

          <p v-if="errorMessage" class="settings-alert" role="alert">
            {{ errorMessage }}
          </p>
          <p v-if="statusMessage" class="settings-status" role="status">
            {{ statusMessage }}
          </p>

          <div class="settings-reset-zone">
            <template v-if="!confirmResetOpen">
              <button
                type="button"
                class="btn settings-danger-btn"
                @click="confirmResetOpen = true">
                恢复全部默认设置
              </button>
              <small>
                仅重置界面设置与栏目顺序，不会删除自建流派和本局记录。
              </small>
            </template>
            <div v-else class="settings-btn-group">
              <button
                type="button"
                class="btn settings-danger-solid"
                @click="handleResetAll">
                确认恢复默认
              </button>
              <button
                type="button"
                class="btn"
                @click="confirmResetOpen = false">
                取消
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
    <LiveStatus :message="statusMessage || errorMessage" />
  </div>
</template>

<style scoped>
.settings-view {
  min-width: 0;
}
.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  align-items: start;
}
.settings-card {
  display: grid;
  gap: 12px;
  padding: 14px;
}
.settings-card-wide {
  grid-column: 1 / -1;
}
.settings-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.settings-card-head h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: var(--ink);
}
.settings-desc {
  margin: 2px 0 0;
  font-size: 12.5px;
  color: var(--ink3);
  line-height: 1.45;
}
.settings-rows {
  display: grid;
  gap: 10px;
}
.settings-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
  padding-top: 10px;
  border-top: 1px dashed var(--line);
}
.settings-row:first-child {
  padding-top: 0;
  border-top: 0;
}
.settings-row-info {
  display: grid;
  gap: 1px;
  min-width: 0;
  flex: 1 1 200px;
}
.settings-row-info b {
  font-size: 13.5px;
  color: var(--ink);
}
.settings-row-info small {
  font-size: 12px;
  color: var(--ink3);
  line-height: 1.45;
}
.settings-row :deep(.seg) {
  margin: 0;
  max-width: 100%;
}
.settings-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 40px;
  padding: 6px 8px;
  border-radius: 7px;
  border: 1px solid var(--line);
  background: var(--surface2);
  cursor: pointer;
}
.settings-toggle-row:hover {
  border-color: var(--accent);
}
.settings-toggle-row input[type='checkbox'] {
  width: 18px;
  height: 18px;
  flex: none;
  accent-color: var(--accent);
  cursor: pointer;
}
.settings-tab-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 16px;
}
.settings-select-row {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--ink2);
}
.settings-inline-check {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--ink2);
  cursor: pointer;
  min-height: 32px;
}
.settings-inline-check input[type='checkbox'] {
  width: 17px;
  height: 17px;
  flex: none;
  accent-color: var(--accent);
  cursor: pointer;
}
.settings-tab-list {
  position: relative;
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 6px;
}
.settings-tab-list.is-sorting {
  user-select: none;
}
.settings-tab-slot {
  position: relative;
}
.settings-tab-slot.is-dragging {
  z-index: 5;
  transition: none !important;
  transform: none !important;
}
.settings-tab-slot.is-dropping {
  z-index: 4;
}
.settings-tab-slot.is-nudged {
  z-index: 3;
}
.tab-sort-move {
  transition: transform 220ms cubic-bezier(0.2, 0, 0, 1);
}
.settings-tab-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 7px;
  border: 1px solid var(--line);
  background: var(--surface2);
  user-select: none;
  cursor: grab;
  transition:
    border-color 0.15s,
    background-color 0.15s,
    opacity 0.15s,
    box-shadow 0.15s;
}
.settings-tab-item:hover {
  border-color: var(--line2);
}
.settings-tab-item.hidden {
  opacity: 0.65;
  border-style: dashed;
}
.settings-tab-item.dragging {
  transform: translate3d(0, var(--drag-y, 0px), 0);
  border-color: var(--accent);
  background: var(--surface);
  box-shadow:
    0 10px 24px -10px rgba(0, 0, 0, 0.35),
    0 0 0 1px var(--accent);
  cursor: grabbing;
  will-change: transform;
}
.settings-tab-item.dropping {
  transform: translate3d(0, var(--drag-y, 0px), 0);
  transition:
    transform 180ms cubic-bezier(0.2, 0, 0, 1),
    box-shadow 180ms ease,
    border-color 180ms ease,
    background-color 180ms ease;
}
.settings-drag-grip {
  display: inline-grid;
  place-items: center;
  min-width: 28px;
  min-height: 34px;
  border-radius: 5px;
  color: var(--ink3);
  font-family: var(--fn);
  font-size: 14px;
  letter-spacing: -1px;
  user-select: none;
  touch-action: none;
}
@media (pointer: coarse) {
  .settings-drag-grip {
    min-width: 36px;
  }
}
.settings-tab-idx {
  display: inline-grid;
  place-items: center;
  min-width: 22px;
  height: 22px;
  padding: 0 5px;
  border-radius: 5px;
  background: var(--surface);
  border: 1px solid var(--line);
  font-family: var(--fn);
  font-size: 12px;
  font-weight: 700;
  color: var(--ink2);
  flex: none;
}
.settings-tab-name {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--ink);
  min-width: 0;
  flex: 1;
}
.settings-tab-btns {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.settings-step-btn {
  min-width: 34px;
  min-height: 34px;
  padding: 0;
  justify-content: center;
}
.settings-vis-btn {
  min-height: 34px;
  padding: 3px 9px;
  border-color: var(--teal);
  color: var(--teal);
  font-weight: 600;
  background: color-mix(in srgb, var(--teal) 9%, var(--surface));
}
.settings-vis-btn.off {
  border-color: var(--line2);
  color: var(--ink3);
  background: var(--surface);
  font-weight: 400;
}
.settings-subblock {
  display: grid;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--line);
}
.settings-tool-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.settings-tool-pill {
  min-height: 36px;
  padding: 4px 11px;
  border-radius: 999px;
  border: 1px dashed var(--line2);
  background: var(--surface2);
  color: var(--ink3);
  font-size: 13px;
  cursor: pointer;
}
.settings-tool-pill.on {
  border-style: solid;
  border-color: var(--teal);
  background: color-mix(in srgb, var(--teal) 10%, var(--surface));
  color: var(--teal);
  font-weight: 600;
}
.settings-tool-pill:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.settings-btn-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.settings-btn-group .btn {
  min-height: 38px;
  align-items: center;
}
.settings-btn-group .btn.on {
  border-color: var(--accent);
  color: var(--accent);
}
.settings-box {
  display: grid;
  gap: 8px;
  padding: 10px;
  border-radius: 7px;
  border: 1px solid var(--line);
  background: var(--surface2);
}
.settings-preview {
  border-color: color-mix(in srgb, var(--teal) 55%, var(--line));
}
.settings-preview b {
  font-size: 13.5px;
  color: var(--ink);
}
.settings-preview small,
.settings-box-note,
.settings-note {
  margin: 0;
  font-size: 12px;
  color: var(--ink3);
}
.settings-preview-summary {
  margin: 0;
  font-size: 13px;
  color: var(--teal);
  font-weight: 600;
}
.settings-textarea {
  width: 100%;
  min-height: 92px;
  padding: 8px;
  border-radius: 6px;
  border: 1px solid var(--line2);
  background: var(--surface);
  color: var(--ink);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  resize: vertical;
}
.settings-alert {
  margin: 0;
  padding: 8px 10px;
  border-radius: 6px;
  border-left: 3px solid var(--red);
  background: color-mix(in srgb, var(--red) 10%, var(--surface2));
  color: var(--red);
  font-size: 13px;
}
.settings-status {
  margin: 0;
  padding: 8px 10px;
  border-radius: 6px;
  border-left: 3px solid var(--teal);
  background: color-mix(in srgb, var(--teal) 10%, var(--surface2));
  color: var(--teal);
  font-size: 13px;
}
.settings-reset-zone {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  padding-top: 10px;
  border-top: 1px dashed var(--line);
}
.settings-reset-zone small {
  font-size: 12px;
  color: var(--ink3);
}
.settings-danger-btn {
  min-height: 36px;
  color: var(--red);
  border-color: color-mix(in srgb, var(--red) 45%, var(--line));
}
.settings-danger-solid {
  min-height: 36px;
  background: var(--red);
  border-color: var(--red);
  color: #fff;
  font-weight: 600;
}

@container quickref-view (max-width: 820px) {
  .settings-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (prefers-reduced-motion: reduce) {
  .tab-sort-move,
  .settings-tab-item.dropping {
    transition: none !important;
  }
}
:global(:root[data-motion='reduce']) .tab-sort-move,
:global(:root[data-motion='reduce']) .settings-tab-item.dropping {
  transition: none !important;
}
</style>
