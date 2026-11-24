<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  ref,
  watch,
} from 'vue';
import {prefersReducedMotion} from '../../lib/ui/dom.ts';
import {nameScore, normalize} from '../../lib/ui/match.ts';
import type {PlanIcon} from '../../lib/plans/model.ts';
import PlanEmblem from './PlanEmblem.vue';
import EmptyState from './EmptyState.vue';
import SearchInput from './SearchInput.vue';
import SelectInput from './SelectInput.vue';
import SectionHeading from './SectionHeading.vue';

/** 展示信息由流派页提供，选择和管理操作均交回父级处理。 */
interface BuildChoice {
  key: string;
  name: string;
  accent: string;
  icon?: PlanIcon;
  modified?: boolean;
  badge?: string;
  badgeTitle?: string;
  ban?: number;
}
const props = defineProps<{
  open: boolean;
  currentKey: string;
  runKey: string;
  groups: {id: 'mine' | 'presets'; label: string; items: BuildChoice[]}[];
  collapsePresets: boolean;
  hasBox: boolean;
  sortByBox: boolean;
}>();
const emit = defineEmits<{
  close: [];
  select: [key: string];
  create: [];
  import: [];
  backup: [];
  sort: [];
  'toggle-presets': [];
}>();

const dialog = ref<HTMLDialogElement>();
const nativeOpen = ref(false);
const list = ref<HTMLElement>();
const closeButton = ref<HTMLButtonElement>();
const backupButton = ref<HTMLButtonElement>();
const searchInput = ref<InstanceType<typeof SearchInput>>();
const search = ref('');
const query = computed(() => normalize(search.value));
// 目录可以导入上万条历史流派。搜索和排序仍覆盖全集，弹层只挂载当前页的按钮。
const PAGE_SIZE = 100;
const page = ref(0);
function selectPage(index: number): void {
  page.value = index;
  if (list.value) list.value.scrollTop = 0;
}
watch(
  () => props.open,
  (open) => {
    if (open) {
      const current =
        props.groups
          .find((group) => group.id === 'mine')
          ?.items.findIndex((item) => item.key === props.currentKey) ?? -1;
      page.value = Math.max(0, Math.floor(current / PAGE_SIZE));
    }
  },
);
watch([query, () => props.sortByBox], () => {
  page.value = 0;
});
const allowFolding = computed(
  () => !query.value && !(props.hasBox && props.sortByBox),
);
const shownGroups = computed(() => {
  return props.groups
    .map(({id, label, items}) => {
      const matches = query.value
        ? items.filter((item) => nameScore(item.name, query.value))
        : items;
      const folded =
        id === 'presets' && props.collapsePresets && allowFolding.value;
      const pages = id === 'mine' ? Math.ceil(matches.length / PAGE_SIZE) : 1;
      const pageIndex = Math.max(0, Math.min(page.value, pages - 1));
      return {
        id,
        label,
        count: matches.length,
        folded,
        pageIndex,
        pages:
          pages > 1
            ? Array.from({length: pages}, (_, index) => ({
                value: index,
                label: `第 ${index + 1} / ${pages} 页`,
              }))
            : [],
        // 与原折叠预设行为一致，当前查看及本局使用的预设仍可直接访问。
        items: folded
          ? matches.filter(
              ({key}) => key === props.currentKey || key === props.runKey,
            )
          : pages > 1
            ? matches.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE)
            : matches,
      };
    })
    .filter((group) => group.count);
});
watch(
  [search, () => props.sortByBox],
  () => {
    if (list.value) list.value.scrollTop = 0;
  },
  {flush: 'post'},
);

function fitViewport(): void {
  const viewport = window.visualViewport;
  if (!viewport || !dialog.value) return;
  // 手机键盘只压缩 visualViewport，搜索时仍要看得见列表和底部操作。
  dialog.value.style.setProperty('--picker-height', `${viewport.height}px`);
  const bottom = Math.max(
    0,
    window.innerHeight - viewport.height - viewport.offsetTop,
  );
  dialog.value.style.setProperty('--picker-bottom', `${bottom}px`);
}

const triggerSelector = '[aria-controls="build-picker"]';
let opener: HTMLElement | null = null;
let focusSearchOnOpen: boolean | undefined;

/** 同一个二合一设备可用鼠标、软键盘或手指，优先使用实际打开抽屉的输入方式。 */
function rememberTrigger(event: MouseEvent): void {
  const trigger =
    event.target instanceof Element
      ? event.target.closest<HTMLElement>(triggerSelector)
      : null;
  if (!trigger) return;
  opener = trigger;
  const pointer = 'pointerType' in event ? event.pointerType : '';
  focusSearchOnOpen = pointer
    ? pointer === 'mouse'
    : event.detail === 0 || undefined;
}
onMounted(() => document.addEventListener('click', rememberTrigger, true));

let afterExit: (() => void) | undefined;
let exitDeadline: number | undefined;
let exitTransition: Animation | undefined;

function clearExit(): void {
  window.clearTimeout(exitDeadline);
  exitDeadline = undefined;
  exitTransition = undefined;
  afterExit = undefined;
  dialog.value?.querySelector('[data-picked]')?.removeAttribute('data-picked');
}

function releaseDialog(): void {
  clearExit();
  if (dialog.value?.open) dialog.value.close();
  if (
    nativeOpen.value &&
    opener?.isConnected &&
    document.activeElement === document.body
  )
    opener.focus({preventScroll: true});
  if (dialog.value) delete dialog.value.dataset.phase;
  nativeOpen.value = false;
  window.visualViewport?.removeEventListener('resize', fitViewport);
  window.visualViewport?.removeEventListener('scroll', fitViewport);
  search.value = '';
  opener = null;
  focusSearchOnOpen = undefined;
}

function finishExit(): void {
  if (dialog.value?.dataset.phase !== 'closing') return;
  const action = afterExit;
  releaseDialog();
  action?.();
}

/** 保持原生模态与滚动锁直到离场完成，再交给上层导航或聚焦下一块面板。 */
function leave(action?: () => void, source?: EventTarget | null): void {
  const element = dialog.value;
  if (!element?.open || element.dataset.phase === 'closing') return;
  if (source instanceof HTMLElement) source.dataset.picked = '';
  afterExit = action;
  element.dataset.phase = 'closing';
  if (prefersReducedMotion() || document.hidden) {
    finishExit();
    return;
  }
  // 首帧前连点可直接关。快速重开时，旧过渡的完成通知不能再关闭新抽屉。
  if (element.getAnimations) {
    const transition = element
      .getAnimations()
      .find(
        (animation) =>
          'transitionProperty' in animation &&
          animation.transitionProperty === 'transform',
      );
    if (!transition) {
      finishExit();
      return;
    }
    exitTransition = transition;
    const settle = () => {
      if (exitTransition === transition) finishExit();
    };
    void transition.finished.then(settle, settle);
  }
  // 原生动画 API 缺失、计时被浏览器限流时兜底（正常退场为 135ms）。
  exitDeadline = window.setTimeout(finishExit, 170);
}

function closePicker(): void {
  leave(() => emit('close'));
}

function onNativeClose(): void {
  // close 事件异步派送，紧接着重新打开时应忽略上一轮的事件。
  if (dialog.value?.open || !nativeOpen.value) return;
  const action = afterExit;
  releaseDialog();
  if (action) action();
  else if (props.open) emit('close');
}

function guardExiting(event: Event): void {
  if (dialog.value?.dataset.phase !== 'closing') return;
  event.preventDefault();
  event.stopImmediatePropagation();
}

watch(
  [dialog, () => props.open],
  ([element, open]) => {
    if (!element) return;
    if (!open) {
      // 路由或父页抢先关闭时取消尚未执行的选择，避免导航到旧目标。
      afterExit = undefined;
      leave();
      return;
    }
    if (element.open) {
      clearExit();
      element.dataset.phase = 'open';
      return;
    }
    // Safari 触屏点击按钮后可能仍聚焦在 body，此时从 aria-controls 找回入口。
    opener ??=
      document.activeElement instanceof HTMLElement &&
      document.activeElement.matches(triggerSelector)
        ? document.activeElement
        : document.querySelector<HTMLElement>(triggerSelector);
    fitViewport();
    nativeOpen.value = true;
    element.dataset.phase = 'entering';
    element.showModal();
    // 提交遮罩与面板的起始样式，同一帧即可响应输入并向终点过渡。
    void getComputedStyle(element, '::backdrop').opacity;
    void element.offsetWidth;
    element.dataset.phase = 'open';
    if (
      focusSearchOnOpen ??
      window.matchMedia('(hover: hover) and (pointer: fine)').matches
    )
      searchInput.value?.inputRef?.focus({preventScroll: true});
    const current = list.value?.querySelector('[aria-current="true"]');
    if (current && list.value) {
      const distance =
        current.getBoundingClientRect().bottom -
        list.value.getBoundingClientRect().bottom;
      if (distance > 0) list.value.scrollTop += distance;
    }
    window.visualViewport?.addEventListener('resize', fitViewport);
    window.visualViewport?.addEventListener('scroll', fitViewport);
  },
  {flush: 'post'},
);
onBeforeUnmount(() => {
  document.removeEventListener('click', rememberTrigger, true);
  releaseDialog();
});
onDeactivated(() => {
  releaseDialog();
  if (props.open) emit('close');
});

function isBackdrop(event: MouseEvent): boolean {
  if (event.target !== dialog.value || !dialog.value) return false;
  const {left, right, top, bottom} = dialog.value.getBoundingClientRect();
  return (
    event.clientX < left ||
    event.clientX > right ||
    event.clientY < top ||
    event.clientY > bottom
  );
}
let pointerStartedOnBackdrop = false;
function rememberBackdrop(event: PointerEvent): void {
  pointerStartedOnBackdrop = isBackdrop(event);
}
function clickBackdrop(event: MouseEvent): void {
  if (pointerStartedOnBackdrop && isBackdrop(event)) closePicker();
  pointerStartedOnBackdrop = false;
}

function onEscape(event: KeyboardEvent): void {
  if (event.isComposing || event.keyCode === 229) return;
  event.preventDefault();
  closePicker();
}

function navigateChoices(event: KeyboardEvent): void {
  const {key} = event;
  if (
    event.isComposing ||
    event.keyCode === 229 ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    !['ArrowDown', 'ArrowUp', 'Enter', 'Home', 'End'].includes(key)
  )
    return;
  const target = event.target;
  const fromSearch = target === searchInput.value?.inputRef;
  if (
    !(target instanceof HTMLElement) ||
    (!fromSearch && !target.matches('.picker-row'))
  )
    return;
  // 搜索框保留原生 Home / End 编辑，条目按钮保留 Enter 和 Space 的原生点击。
  if (
    (fromSearch && (key === 'Home' || key === 'End')) ||
    (!fromSearch && key === 'Enter')
  )
    return;
  const rows = Array.from(
    list.value?.querySelectorAll<HTMLButtonElement>('.picker-row') ?? [],
  );
  if (!rows.length) return;
  event.preventDefault();
  if (key === 'Enter') {
    const current =
      !query.value && rows.find((row) => row.dataset.bd === props.currentKey);
    (current || rows[0]).click();
    return;
  }
  const index = rows.findIndex((row) => row === target);
  let next = 0;
  if (key === 'End' || (fromSearch && key === 'ArrowUp'))
    next = rows.length - 1;
  else if (key === 'ArrowDown') next = (index + 1) % rows.length;
  else if (key === 'ArrowUp') next = (index - 1 + rows.length) % rows.length;
  rows[next].focus();
}

function onTab(event: KeyboardEvent): void {
  // 原生 dialog 令背景 inert，首尾循环还能避免 Tab 把焦点送进浏览器地址栏。
  const target = event.target;
  if (
    event.shiftKey &&
    (target === closeButton.value || target instanceof HTMLHeadingElement)
  ) {
    event.preventDefault();
    backupButton.value?.focus();
  } else if (!event.shiftKey && target === backupButton.value) {
    event.preventDefault();
    closeButton.value?.focus();
  }
}
</script>

<template>
  <Teleport to="body">
    <dialog
      id="build-picker"
      ref="dialog"
      class="build-picker"
      aria-labelledby="build-picker-title"
      data-noswipe
      @cancel.prevent="closePicker"
      @close="onNativeClose"
      @click.capture="guardExiting"
      @keydown.capture="guardExiting"
      @keydown.esc.stop="onEscape"
      @keydown.tab="onTab"
      @keydown="navigateChoices"
      @pointerdown="rememberBackdrop"
      @click.self="clickBackdrop">
      <template v-if="open || nativeOpen">
        <div class="picker-head">
          <h2 id="build-picker-title" tabindex="-1" autofocus>切换流派</h2>
          <button
            ref="closeButton"
            type="button"
            class="picker-close"
            aria-label="关闭流派选择器"
            @click="closePicker">
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="m5 5 10 10M15 5 5 15" />
            </svg>
          </button>
        </div>
        <div class="picker-filters">
          <SearchInput
            ref="searchInput"
            v-model="search"
            placeholder="搜索流派"
            aria-label="搜索流派" />
          <button
            v-if="hasBox"
            type="button"
            class="picker-sort btn"
            :aria-pressed="sortByBox"
            title="按当前 Box 的阵容适配度排序"
            @click="emit('sort')">
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M3 5h9M3 9h6M3 13h3M14 5v10m-3-3 3 3 3-3" />
            </svg>
            Box 适配度
          </button>
        </div>
        <div ref="list" class="picker-list">
          <section
            v-for="group in shownGroups"
            :key="group.id"
            class="picker-group">
            <SectionHeading
              class="picker-group-heading"
              :title="group.label"
              :count="group.count"
              variant="plain">
              <template
                v-if="
                  group.pages.length || (group.id === 'presets' && allowFolding)
                "
                #extra>
                <SelectInput
                  v-if="group.pages.length"
                  :model-value="group.pageIndex"
                  :options="group.pages"
                  label="我的流派页码"
                  compact
                  @update:model-value="selectPage" />
                <button
                  v-else
                  type="button"
                  class="picker-fold"
                  :aria-expanded="!group.folded"
                  aria-controls="build-picker-presets"
                  :aria-label="group.folded ? '展开预设流派' : '折叠预设流派'"
                  @click="emit('toggle-presets')">
                  {{ group.folded ? '展开全部' : '折叠' }}
                  <svg viewBox="0 0 20 20" aria-hidden="true">
                    <path d="m5.5 8 4.5 4.5L14.5 8" />
                  </svg>
                </button>
              </template>
            </SectionHeading>
            <ul
              :id="group.id === 'presets' ? 'build-picker-presets' : undefined">
              <li v-for="item in group.items" :key="item.key">
                <button
                  type="button"
                  class="picker-row"
                  :data-bd="item.key"
                  :style="{'--build-color': item.accent || 'var(--accent)'}"
                  :aria-current="item.key === currentKey ? 'true' : undefined"
                  @click="
                    leave(() => emit('select', item.key), $event.currentTarget)
                  ">
                  <PlanEmblem class="picker-emblem" :icon="item.icon" />
                  <span class="picker-info">
                    <span class="picker-name">{{ item.name }}</span>
                    <span v-if="item.key === runKey" class="picker-run">
                      本局
                    </span>
                    <span v-if="item.modified" class="picker-meta">已修改</span>
                    <span
                      v-if="item.badge"
                      class="picker-meta"
                      :title="item.badgeTitle">
                      Box {{ item.badge }}
                    </span>
                    <span v-if="item.ban" class="picker-ban">
                      禁池缺 {{ item.ban }} 人
                    </span>
                  </span>
                  <svg
                    v-if="item.key === currentKey"
                    class="picker-check"
                    viewBox="0 0 20 20"
                    aria-hidden="true">
                    <path d="m4 10 4 4 8-8" />
                  </svg>
                </button>
              </li>
            </ul>
          </section>
          <EmptyState
            v-if="!shownGroups.length"
            compact
            :message="search ? '没有找到匹配的流派' : '暂无流派'"
            action-label="清空搜索"
            :show-action="!!search"
            @action="search = ''" />
        </div>
        <footer class="picker-actions">
          <button
            type="button"
            class="btn"
            @click="leave(() => emit('create'), $event.currentTarget)">
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M10 4v12M4 10h12" />
            </svg>
            新建
          </button>
          <button
            type="button"
            class="btn"
            @click="leave(() => emit('import'), $event.currentTarget)">
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M10 3v9m-3-3 3 3 3-3M4 12v4h12v-4" />
            </svg>
            导入
          </button>
          <button
            ref="backupButton"
            type="button"
            class="btn"
            @click="leave(() => emit('backup'), $event.currentTarget)">
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <rect x="3.5" y="5" width="13" height="11" rx="1.5" />
              <path d="M3.5 8.5h13M8 12h4" />
            </svg>
            备份与恢复
          </button>
        </footer>
      </template>
    </dialog>
  </Teleport>
</template>

<style scoped>
.build-picker {
  --picker-pad: 16px;
  --picker-slide-x: 100%;
  --picker-slide-y: 0;
  position: fixed;
  inset: auto 0 var(--picker-bottom, 0px) auto;
  box-sizing: border-box;
  margin: 0;
  padding: 0 env(safe-area-inset-right, 0px) 0 env(safe-area-inset-left, 0px);
  width: min(420px, 100%);
  height: var(--picker-height, 100dvh);
  max-width: 100%;
  max-height: var(--picker-height, 100dvh);
  border: 0;
  border-left: 1px solid var(--line);
  background: var(--surface);
  color: var(--ink);
  box-shadow: -6px 0 32px rgba(4, 14, 16, 0.14);
  overflow: hidden;
}
.build-picker[open] {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  transform: translate(0, 0);
  opacity: 1;
  transition:
    transform 200ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 160ms ease-out;
}
.build-picker:is([data-phase='entering'], [data-phase='closing']) {
  transform: translate(var(--picker-slide-x), var(--picker-slide-y));
  opacity: 0.76;
}
.build-picker[data-phase='closing'] {
  transition:
    transform 135ms cubic-bezier(0.38, 0, 0.76, 0.38),
    opacity 110ms ease-in;
}
.build-picker::backdrop {
  background: rgba(5, 14, 17, 0.43);
  opacity: 1;
  transition: opacity 170ms ease-out;
}
.build-picker:is([data-phase='entering'], [data-phase='closing'])::backdrop {
  opacity: 0;
}
.build-picker[data-phase='closing']::backdrop {
  transition-duration: 120ms;
}
:global(html:has(.build-picker[open])) {
  overflow: hidden;
}
.picker-head,
.picker-filters,
.picker-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-inline: var(--picker-pad);
}
.picker-head {
  justify-content: space-between;
  padding-top: max(12px, env(safe-area-inset-top, 0px));
  padding-bottom: 6px;
}
.picker-head h2 {
  margin: 0;
  font-size: 18px;
  line-height: 1.35;
}
.picker-head h2:focus {
  outline: none;
}
.build-picker button {
  font-family: inherit;
  cursor: pointer;
  transition:
    color 140ms ease,
    background-color 140ms ease,
    border-color 140ms ease,
    transform 90ms ease;
}
.build-picker button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
.build-picker button svg {
  display: block;
  flex: none;
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.65;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.picker-close {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border: 0;
  border-radius: 7px;
  color: var(--ink2);
  background: transparent;
}
.picker-filters {
  padding-bottom: 12px;
  border-bottom: 1px solid var(--line);
}
.picker-filters .q-search {
  min-width: 0;
}
.picker-sort {
  flex: none;
  min-height: 36px;
}
.picker-sort[aria-pressed='true'] {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-soft);
}
.picker-fold {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 34px;
  padding: 3px 8px;
  border: 0;
  border-radius: 5px;
  color: var(--ink2);
  background: transparent;
  font-size: 13px;
}
.picker-fold[aria-expanded='true'] svg {
  transform: rotate(180deg);
}
.picker-list {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 12px var(--picker-pad) 16px;
}
.picker-group + .picker-group {
  margin-top: 16px;
}
.picker-group-heading {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--surface);
}
.picker-group ul {
  margin: 5px 0 0;
  padding: 0;
  list-style: none;
}
.picker-row {
  scroll-margin-block-start: 40px;
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  min-height: 42px;
  padding: 6px 9px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: var(--ink);
  text-align: left;
}
.picker-emblem {
  --emblem-size: 24px;
  --c: var(--build-color);
}
.picker-info {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  align-items: center;
  gap: 3px 6px;
  min-width: 0;
}
.picker-name {
  font-size: 15px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.picker-run,
.picker-meta,
.picker-ban {
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--ink2);
}
.picker-run {
  padding: 0 5px;
  border-radius: 4px;
  color: var(--teal);
  background: color-mix(in srgb, var(--teal) 12%, var(--surface));
}
.picker-ban {
  color: var(--red);
}
.picker-row[aria-current='true'] {
  border-color: color-mix(in srgb, var(--accent) 55%, var(--line));
  background: var(--accent-soft);
  box-shadow: inset 3px 0 0 var(--accent);
}
.build-picker button .picker-check {
  box-sizing: border-box;
  width: 20px;
  height: 20px;
  padding: 2px;
  border-radius: 50%;
  color: var(--accent-ink);
  background: var(--accent);
  stroke-width: 2;
}
.picker-actions {
  padding-block: 10px max(10px, env(safe-area-inset-bottom, 0px));
  border-top: 1px solid var(--line);
}
.picker-actions .btn {
  justify-content: center;
  min-height: 38px;
  padding-inline: 9px;
  color: var(--ink2);
  background: var(--surface);
}
.picker-actions .btn:first-child {
  color: var(--teal);
  border-color: color-mix(in srgb, var(--teal) 45%, var(--line));
  background: var(--teal-soft);
}
.picker-actions .btn:last-child {
  margin-left: auto;
}
@media (hover: hover) {
  .picker-row:not([aria-current='true']):hover,
  .picker-fold:hover,
  .picker-close:hover {
    background: var(--surface2);
  }
}
.picker-row:active,
.picker-row[data-picked],
.picker-actions button:active,
.picker-actions button[data-picked],
.picker-close:active {
  background: var(--accent-soft);
}
.picker-row:is(:active, [data-picked]),
.picker-actions .btn:is(:active, [data-picked]) {
  border-color: var(--accent);
  background: var(--accent-soft);
  transform: translateY(1px);
  transition-duration: 65ms;
}
@media (max-width: 560px) and (orientation: portrait) {
  .build-picker {
    --picker-slide-x: 0;
    --picker-slide-y: 100%;
    width: 100%;
    height: min(74dvh, 620px, var(--picker-height, 100dvh));
    border: 1px solid var(--line);
    border-bottom: 0;
    border-radius: 16px 16px 0 0;
    box-shadow: 0 -6px 32px rgba(4, 14, 16, 0.14);
  }
  .picker-head {
    padding-top: 9px;
  }
}
@media (max-height: 600px) {
  .build-picker {
    --picker-pad: 12px;
  }
  .picker-head {
    padding-block: max(4px, env(safe-area-inset-top, 0px)) 2px;
  }
  .picker-head h2 {
    font-size: 16px;
  }
  .picker-filters {
    padding-bottom: 6px;
  }
  .picker-list {
    padding-block: 6px;
  }
  .picker-group + .picker-group {
    margin-top: 8px;
  }
  .picker-row {
    min-height: 36px;
    padding-block: 3px;
  }
  .picker-close,
  .picker-actions .btn {
    min-height: 34px;
    height: 34px;
  }
  .picker-actions {
    padding-block: 5px max(5px, env(safe-area-inset-bottom, 0px));
  }
}
@media (prefers-reduced-motion: reduce) {
  .build-picker[open],
  .build-picker::backdrop,
  .build-picker button {
    transition: none !important;
    transform: none !important;
  }
}
:global(:root[data-motion='reduce'] .build-picker[open]),
:global(:root[data-motion='reduce'] .build-picker::backdrop),
:global(:root[data-motion='reduce'] .build-picker button) {
  transition: none !important;
  transform: none !important;
}
</style>
