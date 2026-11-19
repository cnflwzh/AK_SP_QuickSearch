<script setup lang="ts" generic="T extends string | number = string">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  useAttrs,
  useId,
  watch,
  type StyleValue,
} from 'vue';
import {prefersReducedMotion} from '../../lib/ui/dom.ts';

export interface SelectOption<V extends string | number = string> {
  readonly value: V;
  readonly label: string;
  readonly disabled?: boolean;
}

export interface SelectOptionGroup<V extends string | number = string> {
  readonly label: string;
  readonly options: readonly SelectOption<V>[];
}

export type SelectEntry<V extends string | number = string> =
  | SelectOption<V>
  | SelectOptionGroup<V>;

interface FlatOption<V extends string | number> extends SelectOption<V> {
  readonly index: number;
}

type RenderEntry<V extends string | number> =
  | {readonly kind: 'option'; readonly option: FlatOption<V>}
  | {
      readonly kind: 'group';
      readonly label: string;
      readonly options: readonly FlatOption<V>[];
    };

function isOptionGroup<V extends string | number>(
  entry: SelectEntry<V>,
): entry is SelectOptionGroup<V> {
  return 'options' in entry;
}

defineOptions({inheritAttrs: false});

const model = defineModel<T>({required: true});

const props = withDefaults(
  defineProps<{
    options: readonly SelectEntry<T>[];
    label?: string;
    id?: string;
    disabled?: boolean;
    compact?: boolean;
    highlightActive?: boolean;
    defaultValue?: T;
    placeholder?: string;
  }>(),
  {
    disabled: false,
    compact: false,
    highlightActive: false,
  },
);

const emit = defineEmits<{change: [value: T]}>();

const attrs = useAttrs();
const uid = useId();
const menuId = `${uid}-menu`;

const rootRef = ref<HTMLSpanElement | null>(null);
const triggerRef = ref<HTMLButtonElement | null>(null);
const nativeRef = ref<HTMLSelectElement | null>(null);
const menuRef = ref<HTMLDivElement | null>(null);

const open = ref(false);
const menuMounted = ref(false);
const menuShown = ref(false);
const highlightedIndex = ref(-1);
const teleportTarget = ref<HTMLElement | string>('body');
const isCoarse = ref(false);
const supportsPopover =
  typeof HTMLElement !== 'undefined' &&
  typeof HTMLElement.prototype.showPopover === 'function';

let openFrame = 0;
let closeTimer = 0;

const resolvedLabel = computed(
  () => props.label ?? (attrs['aria-label'] as string | undefined),
);
const resolvedTitle = computed(
  () => (attrs.title as string | undefined) ?? undefined,
);

const parsedEntries = computed<{
  render: readonly RenderEntry<T>[];
  flat: readonly FlatOption<T>[];
}>(() => {
  const render: RenderEntry<T>[] = [];
  const flat: FlatOption<T>[] = [];
  for (const entry of props.options) {
    if (isOptionGroup(entry)) {
      const groupOptions: FlatOption<T>[] = [];
      for (const option of entry.options) {
        const flatOpt: FlatOption<T> = {...option, index: flat.length};
        flat.push(flatOpt);
        groupOptions.push(flatOpt);
      }
      render.push({kind: 'group', label: entry.label, options: groupOptions});
    } else {
      const flatOpt: FlatOption<T> = {...entry, index: flat.length};
      flat.push(flatOpt);
      render.push({kind: 'option', option: flatOpt});
    }
  }
  return {render, flat};
});

const flatOptions = computed(() => parsedEntries.value.flat);
const renderEntries = computed(() => parsedEntries.value.render);

const selectedIndex = computed(() =>
  flatOptions.value.findIndex((option) => option.value === model.value),
);

const selectedOption = computed<FlatOption<T> | undefined>(() =>
  selectedIndex.value >= 0 ? flatOptions.value[selectedIndex.value] : undefined,
);

const displayLabel = computed(
  () => selectedOption.value?.label ?? props.placeholder ?? String(model.value),
);

const isActiveFilter = computed(() => {
  if (!props.highlightActive) return false;
  if (props.defaultValue !== undefined) {
    return model.value !== props.defaultValue;
  }
  return typeof model.value === 'number'
    ? model.value !== 0
    : model.value !== '';
});

const activeOptionId = computed(() =>
  highlightedIndex.value >= 0
    ? `${uid}-opt-${highlightedIndex.value}`
    : undefined,
);

function clearPendingTimers(): void {
  if (openFrame) {
    cancelAnimationFrame(openFrame);
    openFrame = 0;
  }
  if (closeTimer) {
    window.clearTimeout(closeTimer);
    closeTimer = 0;
  }
}

function hideMenuPopover(menu: HTMLElement | null): void {
  if (!menu) return;
  if (supportsPopover && menu.hasAttribute('popover')) {
    try {
      if (menu.matches(':popover-open')) menu.hidePopover();
    } catch {
      /* 已关闭或已卸载时忽略 */
    }
  }
}

function syncNativeValue(): void {
  const el = nativeRef.value;
  if (!el) return;
  el.value = selectedIndex.value >= 0 ? String(selectedIndex.value) : '';
}

function handleNativeChange(event: Event): void {
  const select = event.target as HTMLSelectElement;
  const idx = Number(select.value);
  const picked = Number.isInteger(idx) ? flatOptions.value[idx] : undefined;
  if (!picked || picked.disabled) {
    syncNativeValue();
    return;
  }
  model.value = picked.value;
  emit('change', picked.value);
  // 若父组件保持原值（如动作型下拉或拒绝非法更改），下一帧把原生 DOM 同步回真实状态。
  void nextTick(syncNativeValue);
}

function findEnabledIndex(start: number, step: 1 | -1): number {
  const list = flatOptions.value;
  if (!list.length) return -1;
  for (let i = 0; i < list.length; i += 1) {
    const idx = (start + i * step + list.length) % list.length;
    if (!list[idx].disabled) return idx;
  }
  return -1;
}

function firstEnabledIndex(): number {
  return flatOptions.value.findIndex((opt) => !opt.disabled);
}

function lastEnabledIndex(): number {
  for (let i = flatOptions.value.length - 1; i >= 0; i -= 1) {
    if (!flatOptions.value[i].disabled) return i;
  }
  return -1;
}

function scrollHighlightedIntoView(): void {
  const menu = menuRef.value;
  if (!menu || highlightedIndex.value < 0) return;
  const item = menu.querySelector<HTMLElement>(
    `[data-opt-index="${highlightedIndex.value}"]`,
  );
  item?.scrollIntoView({block: 'nearest'});
}

function positionMenu(menu: HTMLElement): void {
  const trigger = triggerRef.value;
  if (!trigger) return;
  const rect = trigger.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const gap = 5;
  const edge = 8;

  const minWidth = Math.max(Math.round(rect.width), 136);
  const maxWidth = Math.min(360, Math.max(140, vw - edge * 2));
  menu.style.minWidth = `${Math.min(minWidth, maxWidth)}px`;
  menu.style.maxWidth = `${maxWidth}px`;
  menu.style.maxHeight = '320px';

  const menuWidth = Math.min(Math.max(menu.offsetWidth, minWidth), maxWidth);
  const naturalHeight = Math.min(menu.scrollHeight + 2, 320);

  const spaceBelow = vh - rect.bottom - gap - edge;
  const spaceAbove = rect.top - gap - edge;
  const openAbove = spaceBelow < naturalHeight && spaceAbove > spaceBelow;
  const availHeight = Math.max(
    112,
    Math.min(320, Math.floor(openAbove ? spaceAbove : spaceBelow)),
  );

  menu.style.maxHeight = `${availHeight}px`;
  if (openAbove) {
    menu.dataset.placement = 'top';
    menu.style.top = 'auto';
    menu.style.bottom = `${Math.max(edge, Math.round(vh - rect.top + gap))}px`;
  } else {
    menu.dataset.placement = 'bottom';
    menu.style.bottom = 'auto';
    menu.style.top = `${Math.max(edge, Math.round(rect.bottom + gap))}px`;
  }

  let left = rect.left;
  if (left + menuWidth > vw - edge) {
    left = vw - edge - menuWidth;
  }
  if (left < edge) left = edge;
  menu.style.left = `${Math.round(left)}px`;
  menu.style.right = 'auto';
}

function openMenu(initialIndex?: number): void {
  if (props.disabled || isCoarse.value || !flatOptions.value.length) return;
  clearPendingTimers();
  const dialog = triggerRef.value?.closest('dialog');
  teleportTarget.value = dialog ?? 'body';
  if (
    initialIndex !== undefined &&
    initialIndex >= 0 &&
    !flatOptions.value[initialIndex]?.disabled
  ) {
    highlightedIndex.value = initialIndex;
  } else if (selectedOption.value && !selectedOption.value.disabled) {
    highlightedIndex.value = selectedOption.value.index;
  } else {
    highlightedIndex.value = firstEnabledIndex();
  }
  menuMounted.value = true;
  menuShown.value = false;
  open.value = true;

  void nextTick(() => {
    const menu = menuRef.value;
    if (!open.value || !menu) return;
    // 必须在元素已挂载到真实 DOM 后再调用 showPopover()；失败时移除 popover 属性降级为 fixed 定位。
    if (supportsPopover) {
      try {
        menu.setAttribute('popover', 'manual');
        if (!menu.matches(':popover-open')) menu.showPopover();
      } catch {
        menu.removeAttribute('popover');
      }
    }
    positionMenu(menu);
    scrollHighlightedIntoView();
    if (prefersReducedMotion()) {
      menuShown.value = true;
    } else {
      openFrame = requestAnimationFrame(() => {
        openFrame = 0;
        if (open.value) menuShown.value = true;
      });
    }
  });
}

function closeMenu(restoreFocus = false): void {
  if (!open.value && !menuMounted.value) return;
  clearPendingTimers();
  open.value = false;
  menuShown.value = false;
  highlightedIndex.value = -1;
  if (restoreFocus) {
    triggerRef.value?.focus({preventScroll: true});
  }
  const unmount = () => {
    hideMenuPopover(menuRef.value);
    menuMounted.value = false;
  };
  if (prefersReducedMotion()) {
    unmount();
  } else {
    closeTimer = window.setTimeout(() => {
      closeTimer = 0;
      if (!open.value) unmount();
    }, 120);
  }
}

function toggleMenu(): void {
  if (open.value) closeMenu(false);
  else openMenu();
}

function pickOption(option: FlatOption<T>): void {
  if (option.disabled) return;
  model.value = option.value;
  emit('change', option.value);
  closeMenu(true);
}

function handleTriggerKeydown(event: KeyboardEvent): void {
  if (props.disabled) return;
  if (!open.value) {
    if (
      event.key === 'ArrowDown' ||
      event.key === 'Down' ||
      event.key === 'ArrowUp' ||
      event.key === 'Up' ||
      event.key === 'Enter' ||
      event.key === ' '
    ) {
      event.preventDefault();
      openMenu();
    }
    return;
  }

  if (event.key === 'ArrowDown' || event.key === 'Down') {
    event.preventDefault();
    const start = highlightedIndex.value >= 0 ? highlightedIndex.value + 1 : 0;
    highlightedIndex.value = findEnabledIndex(start, 1);
    void nextTick(scrollHighlightedIntoView);
  } else if (event.key === 'ArrowUp' || event.key === 'Up') {
    event.preventDefault();
    const start =
      highlightedIndex.value >= 0
        ? highlightedIndex.value - 1
        : flatOptions.value.length - 1;
    highlightedIndex.value = findEnabledIndex(start, -1);
    void nextTick(scrollHighlightedIntoView);
  } else if (event.key === 'Home') {
    event.preventDefault();
    highlightedIndex.value = firstEnabledIndex();
    void nextTick(scrollHighlightedIntoView);
  } else if (event.key === 'End') {
    event.preventDefault();
    highlightedIndex.value = lastEnabledIndex();
    void nextTick(scrollHighlightedIntoView);
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    const current = flatOptions.value[highlightedIndex.value];
    if (current && !current.disabled) pickOption(current);
  } else if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    closeMenu(true);
  } else if (event.key === 'Tab') {
    closeMenu(false);
  }
}

function handleDocumentPointerDown(event: PointerEvent): void {
  if (!open.value) return;
  const target = event.target as Node | null;
  if (!target) return;
  if (menuRef.value?.contains(target)) return;
  if (rootRef.value?.contains(target)) return;
  const labels = triggerRef.value?.labels;
  if (labels) {
    for (const label of labels) {
      if (label.contains(target)) return;
    }
  }
  closeMenu(false);
}

function handleDocumentKeydown(event: KeyboardEvent): void {
  if (!open.value) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    closeMenu(true);
  }
}

function handleWindowScroll(event: Event): void {
  if (!open.value) return;
  const target = event.target as Node | null;
  if (target && menuRef.value?.contains(target)) return;
  closeMenu(false);
}

function handleWindowResize(): void {
  if (open.value) closeMenu(false);
}

function addGlobalListeners(): void {
  document.addEventListener('pointerdown', handleDocumentPointerDown, true);
  document.addEventListener('keydown', handleDocumentKeydown, true);
  window.addEventListener('scroll', handleWindowScroll, true);
  window.addEventListener('resize', handleWindowResize);
}

function removeGlobalListeners(): void {
  document.removeEventListener('pointerdown', handleDocumentPointerDown, true);
  document.removeEventListener('keydown', handleDocumentKeydown, true);
  window.removeEventListener('scroll', handleWindowScroll, true);
  window.removeEventListener('resize', handleWindowResize);
}

watch(open, (isOpen) => {
  if (isOpen) addGlobalListeners();
  else removeGlobalListeners();
});

watch(
  [selectedIndex, isCoarse, () => props.options],
  () => {
    void nextTick(syncNativeValue);
  },
  {immediate: true},
);

watch(isCoarse, (coarse) => {
  if (coarse && (open.value || menuMounted.value)) closeMenu(false);
});

watch(
  () => props.disabled,
  (isDisabled) => {
    if (isDisabled && (open.value || menuMounted.value)) closeMenu(false);
  },
);

let coarseMedia: MediaQueryList | null = null;
function syncPointerMode(): void {
  isCoarse.value = coarseMedia?.matches ?? false;
}

onMounted(() => {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    coarseMedia = window.matchMedia('(pointer: coarse)');
    syncPointerMode();
    coarseMedia.addEventListener('change', syncPointerMode);
  }
  syncNativeValue();
});

onBeforeUnmount(() => {
  clearPendingTimers();
  removeGlobalListeners();
  coarseMedia?.removeEventListener('change', syncPointerMode);
  hideMenuPopover(menuRef.value);
});

function focus(): void {
  if (isCoarse.value) nativeRef.value?.focus();
  else triggerRef.value?.focus();
}

defineExpose({focus});
</script>

<template>
  <span
    ref="rootRef"
    :class="[
      'q-select',
      {
        'is-open': open,
        'is-active': isActiveFilter,
        'is-disabled': disabled,
        'is-compact': compact,
        'is-coarse': isCoarse,
      },
      attrs.class,
    ]"
    :style="attrs.style as StyleValue"
    :title="resolvedTitle">
    <!-- 移动端/触屏：统一美化外观，展开调用原生系统选择器 -->
    <template v-if="isCoarse">
      <span class="q-select-trigger" aria-hidden="true">
        <span class="q-select-text">{{ displayLabel }}</span>
        <svg
          class="q-select-chev"
          viewBox="0 0 14 14"
          fill="none"
          aria-hidden="true"
          focusable="false">
          <path
            d="M3.5 5.25 7 8.75 10.5 5.25"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round" />
        </svg>
      </span>
      <select
        :id="id"
        ref="nativeRef"
        class="q-select-native"
        :disabled="disabled"
        :aria-label="resolvedLabel"
        @change="handleNativeChange">
        <template v-for="(entry, eIdx) in renderEntries" :key="eIdx">
          <optgroup
            v-if="entry.kind === 'group'"
            :label="entry.label">
            <option
              v-for="opt in entry.options"
              :key="opt.index"
              :value="String(opt.index)"
              :disabled="opt.disabled">
              {{ opt.label }}
            </option>
          </optgroup>
          <option
            v-else
            :value="String(entry.option.index)"
            :disabled="entry.option.disabled">
            {{ entry.option.label }}
          </option>
        </template>
      </select>
    </template>

    <!-- PC 端：定制悬浮主题面板 -->
    <template v-else>
      <button
        :id="id"
        ref="triggerRef"
        type="button"
        class="q-select-trigger"
        role="combobox"
        aria-haspopup="listbox"
        :aria-expanded="open"
        :aria-controls="open ? menuId : undefined"
        :aria-activedescendant="open ? activeOptionId : undefined"
        :aria-label="resolvedLabel"
        :disabled="disabled"
        @click="toggleMenu"
        @keydown="handleTriggerKeydown">
        <span class="q-select-text">{{ displayLabel }}</span>
        <svg
          class="q-select-chev"
          viewBox="0 0 14 14"
          fill="none"
          aria-hidden="true"
          focusable="false">
          <path
            d="M3.5 5.25 7 8.75 10.5 5.25"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round" />
        </svg>
      </button>

      <Teleport :to="teleportTarget">
        <div
          v-if="menuMounted"
          :id="menuId"
          ref="menuRef"
          :class="['q-select-menu', {'is-shown': menuShown}]"
          role="listbox"
          :aria-label="resolvedLabel">
          <template v-for="(entry, eIdx) in renderEntries" :key="eIdx">
            <div
              v-if="entry.kind === 'group'"
              class="q-select-group"
              role="group"
              :aria-label="entry.label">
              <div class="q-select-group-label" aria-hidden="true">
                {{ entry.label }}
              </div>
              <button
                v-for="opt in entry.options"
                :id="`${uid}-opt-${opt.index}`"
                :key="opt.index"
                type="button"
                role="option"
                :data-opt-index="opt.index"
                :aria-selected="opt.index === selectedIndex"
                :aria-disabled="opt.disabled || undefined"
                :disabled="opt.disabled"
                :class="[
                  'q-select-opt',
                  {
                    'is-sel': opt.index === selectedIndex,
                    'is-hi': opt.index === highlightedIndex,
                    'is-dis': opt.disabled,
                  },
                ]"
                @mousedown.prevent
                @mouseenter="
                  if (!opt.disabled) highlightedIndex = opt.index;
                "
                @click="pickOption(opt)">
                <span class="q-select-opt-label">{{ opt.label }}</span>
                <svg
                  v-if="opt.index === selectedIndex"
                  class="q-select-check"
                  viewBox="0 0 14 14"
                  fill="none"
                  aria-hidden="true"
                  focusable="false">
                  <path
                    d="M3 7.3 5.8 10 11 4.2"
                    stroke="currentColor"
                    stroke-width="1.9"
                    stroke-linecap="round"
                    stroke-linejoin="round" />
                </svg>
              </button>
            </div>
            <button
              v-else
              :id="`${uid}-opt-${entry.option.index}`"
              type="button"
              role="option"
              :data-opt-index="entry.option.index"
              :aria-selected="entry.option.index === selectedIndex"
              :aria-disabled="entry.option.disabled || undefined"
              :disabled="entry.option.disabled"
              :class="[
                'q-select-opt',
                {
                  'is-sel': entry.option.index === selectedIndex,
                  'is-hi': entry.option.index === highlightedIndex,
                  'is-dis': entry.option.disabled,
                },
              ]"
              @mousedown.prevent
              @mouseenter="
                if (!entry.option.disabled)
                  highlightedIndex = entry.option.index;
              "
              @click="pickOption(entry.option)">
              <span class="q-select-opt-label">{{ entry.option.label }}</span>
              <svg
                v-if="entry.option.index === selectedIndex"
                class="q-select-check"
                viewBox="0 0 14 14"
                fill="none"
                aria-hidden="true"
                focusable="false">
                <path
                  d="M3 7.3 5.8 10 11 4.2"
                  stroke="currentColor"
                  stroke-width="1.9"
                  stroke-linecap="round"
                  stroke-linejoin="round" />
              </svg>
            </button>
          </template>
        </div>
      </Teleport>
    </template>
  </span>
</template>

<style scoped>
.q-select {
  position: relative;
  display: inline-flex;
  align-items: stretch;
  max-width: 100%;
  min-width: 0;
  vertical-align: middle;
}

.q-select-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 7px;
  width: 100%;
  min-width: 0;
  min-height: 36px;
  padding: 6px 9px 6px 11px;
  border: 1px solid var(--line2);
  border-radius: 7px;
  background: var(--surface);
  color: var(--ink);
  font-family: var(--fb);
  font-size: 13px;
  font-weight: 500;
  line-height: 1.4;
  text-align: left;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(18, 34, 32, 0.04);
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease,
    box-shadow 0.15s ease,
    color 0.15s ease;
}

.q-select.is-compact .q-select-trigger {
  min-height: 34px;
  padding: 5px 8px 5px 9px;
  font-size: 12.5px;
  gap: 5px;
}

.q-select-text {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.q-select-chev {
  flex: 0 0 auto;
  width: 14px;
  height: 14px;
  color: var(--ink3);
  transition:
    transform 0.16s cubic-bezier(0.22, 1, 0.36, 1),
    color 0.15s ease;
}

@media (hover: hover) {
  .q-select:not(.is-disabled) .q-select-trigger:hover {
    border-color: color-mix(in srgb, var(--accent) 55%, var(--line2));
    background: color-mix(in srgb, var(--surface2) 45%, var(--surface));
    box-shadow: 0 2px 6px -2px rgba(18, 34, 32, 0.12);
  }
  .q-select:not(.is-disabled) .q-select-trigger:hover .q-select-chev {
    color: var(--ink2);
  }
}

.q-select.is-active .q-select-trigger {
  border-color: color-mix(in srgb, var(--accent) 58%, var(--line2));
  background: color-mix(in srgb, var(--accent) 8%, var(--surface));
}

.q-select.is-active .q-select-chev {
  color: var(--accent);
}

.q-select.is-open .q-select-trigger,
.q-select-trigger:focus-visible,
.q-select:has(.q-select-native:focus-visible) .q-select-trigger {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2.5px var(--accent-soft);
}

.q-select.is-open .q-select-chev {
  color: var(--accent);
  transform: rotate(180deg);
}

.q-select.is-disabled {
  opacity: 0.5;
}
.q-select.is-disabled .q-select-trigger,
.q-select.is-disabled .q-select-native {
  cursor: not-allowed;
}

/* 移动端原生透明覆盖层：视觉完全走定制触发框，点击调起系统原生选择器 */
.q-select .q-select-native {
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  min-height: 0;
  margin: 0;
  padding: 0;
  border: 0;
  opacity: 0;
  appearance: none;
  background: transparent;
  font-size: 16px;
  cursor: pointer;
}

/* PC 悬浮菜单面板（Teleport 渲染到 body 或当前 dialog，并在挂载后启用 Top Layer popover） */
.q-select-menu {
  position: fixed;
  inset: auto;
  z-index: 2500;
  width: max-content;
  height: auto;
  margin: 0;
  padding: 5px;
  overflow-y: auto;
  overscroll-behavior: contain;
  border: 1px solid var(--line2);
  border-radius: 10px;
  background: var(--surface);
  color: var(--ink);
  font-family: var(--fb);
  box-shadow:
    0 14px 34px -10px rgba(14, 30, 28, 0.24),
    0 2px 8px -2px rgba(14, 30, 28, 0.08);
  scrollbar-width: thin;
  scrollbar-color: var(--line2) transparent;
  opacity: 0;
  transform: translateY(-4px) scale(0.985);
  transition:
    opacity 0.14s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.14s cubic-bezier(0.22, 1, 0.36, 1);
}

.q-select-menu[data-placement='top'] {
  transform: translateY(4px) scale(0.985);
}

.q-select-menu.is-shown {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.q-select-group {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.q-select-opt + .q-select-group,
.q-select-group + .q-select-group,
.q-select-group + .q-select-opt {
  margin-top: 4px;
  padding-top: 5px;
  border-top: 1px solid var(--line);
}

.q-select-group-label {
  padding: 4px 10px 3px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--ink3);
  user-select: none;
}

.q-select-opt {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  min-height: 34px;
  padding: 6px 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--ink);
  font-family: var(--fb);
  font-size: 13px;
  font-weight: 400;
  line-height: 1.4;
  text-align: left;
  cursor: pointer;
  transition:
    background-color 0.1s ease,
    color 0.1s ease;
}

.q-select-opt + .q-select-opt {
  margin-top: 1px;
}

.q-select-opt-label {
  flex: 1 1 auto;
  min-width: 0;
  overflow-wrap: anywhere;
}

.q-select-check {
  flex: 0 0 auto;
  width: 14px;
  height: 14px;
  color: var(--accent);
}

.q-select-opt.is-hi:not(.is-dis):not(.is-sel) {
  background: color-mix(in srgb, var(--ink) 6%, transparent);
}

.q-select-opt.is-sel {
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 600;
}

.q-select-opt.is-sel.is-hi:not(.is-dis) {
  background: color-mix(in srgb, var(--accent) 18%, transparent);
}

.q-select-opt.is-dis {
  opacity: 0.42;
  color: var(--ink3);
  cursor: not-allowed;
}

/* 深色主题双分支（整条选择器写进 :global） */
:global(:root[data-theme='dark'] .q-select-menu) {
  background: #142429;
  border-color: var(--line2);
  box-shadow:
    0 18px 42px -10px rgba(0, 0, 0, 0.72),
    0 0 0 1px rgba(255, 255, 255, 0.04);
}
:global(:root[data-theme='dark'] .q-select-trigger) {
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.24);
}
:global(:root[data-theme='dark'] .q-select-opt.is-hi:not(.is-dis):not(.is-sel)) {
  background: rgba(255, 255, 255, 0.07);
}
@media (prefers-color-scheme: dark) {
  :global(:root:not([data-theme='light']) .q-select-menu) {
    background: #142429;
    border-color: var(--line2);
    box-shadow:
      0 18px 42px -10px rgba(0, 0, 0, 0.72),
      0 0 0 1px rgba(255, 255, 255, 0.04);
  }
  :global(:root:not([data-theme='light']) .q-select-trigger) {
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.24);
  }
  :global(
    :root:not([data-theme='light']) .q-select-opt.is-hi:not(.is-dis):not(.is-sel)
  ) {
    background: rgba(255, 255, 255, 0.07);
  }
}

/* 触屏与窄屏：留足 40px 触控高度 */
@media (max-width: 800px), (pointer: coarse) {
  .q-select-trigger {
    min-height: 40px;
    padding: 7px 10px 7px 11px;
  }
  .q-select.is-compact .q-select-trigger {
    min-height: 36px;
    padding: 5px 8px 5px 9px;
  }
}

/* 矮窗口（安卓横屏小窗）：收紧到 36px，不低于 34px 底线 */
@media (max-height: 600px) {
  .q-select-trigger {
    min-height: 36px;
    padding: 5px 9px 5px 10px;
    font-size: 12.5px;
  }
  .q-select.is-compact .q-select-trigger {
    min-height: 34px;
    padding: 4px 7px 4px 8px;
  }
}

/* 减弱动效双分支 */
@media (prefers-reduced-motion: reduce) {
  .q-select-trigger,
  .q-select-chev,
  .q-select-opt,
  .q-select-menu {
    transition: none !important;
  }
}
:global(:root[data-motion='reduce'] .q-select-trigger),
:global(:root[data-motion='reduce'] .q-select-chev),
:global(:root[data-motion='reduce'] .q-select-opt),
:global(:root[data-motion='reduce'] .q-select-menu) {
  transition: none !important;
}

@media (forced-colors: active) {
  .q-select .q-select-native {
    opacity: 1;
    appearance: auto;
  }
  .q-select.is-coarse .q-select-trigger {
    visibility: hidden;
  }
}
</style>
