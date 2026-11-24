<script lang="ts">
export interface SubTabItem<T extends string | number = string> {
  readonly id: T;
  readonly label: string;
  readonly count?: number | string;
  readonly title?: string;
  readonly disabled?: boolean;
}

export type SubTabDirection = 'next' | 'prev' | '';
</script>

<script setup lang="ts" generic="T extends string | number = string">
import {computed, nextTick, ref, useAttrs, type StyleValue} from 'vue';
import {useSlidingPill} from './useSlidingPill.ts';

defineOptions({inheritAttrs: false});

const model = defineModel<T>({required: true});

const props = withDefaults(
  defineProps<{
    id?: string;
    items: readonly SubTabItem<T>[];
    level?: 2 | 3;
    label?: string;
    attr?: string;
    inline?: boolean;
    overflow?: 'auto' | 'scroll' | 'wrap';
  }>(),
  {
    level: 2,
    inline: false,
    overflow: 'auto',
  },
);

const emit = defineEmits<{
  change: [id: T, direction: SubTabDirection];
}>();

const attrs = useAttrs();
const trackRef = ref<HTMLElement | null>(null);
const resolvedLabel = computed(
  () => props.label ?? (attrs['aria-label'] as string | undefined),
);

const activeIndex = computed(() =>
  props.items.findIndex((item) => item.id === model.value),
);

const tabStopIndex = computed(() =>
  activeIndex.value >= 0 && !props.items[activeIndex.value].disabled
    ? activeIndex.value
    : props.items.findIndex((item) => !item.disabled),
);

const layoutSignature = computed(
  () =>
    `${props.level}:${props.overflow}:${props.inline ? 1 : 0}:` +
    props.items
      .map((item) => `${String(item.id)}|${item.label}|${item.count ?? ''}`)
      .join(','),
);

const {pill, animated, pillStyle, moreLeft, moreRight, updateScrollHints} =
  useSlidingPill({
    trackRef,
    activeSelector: '.subtabs-btn.on',
    activeSource: () => model.value,
    layoutSource: layoutSignature,
  });

/**
 * 同步估算单行紧凑模式所需宽度，用于无闪烁、无抖动地选择不同尺寸下的换行阈值。
 */
const spanTier = computed<'compact' | 'medium' | 'wide'>(() => {
  const perTabPad = props.level === 2 ? 20 : 16;
  const charCjk = props.level === 2 ? 13 : 12;
  const charAscii = props.level === 2 ? 7.5 : 7;
  let total = 10 + Math.max(0, props.items.length - 1) * 4;
  for (const item of props.items) {
    let textWidth = 0;
    for (const ch of item.label) {
      textWidth += ch.charCodeAt(0) > 0x7f ? charCjk : charAscii;
    }
    const hasCount = item.count !== undefined && item.count !== '';
    const countWidth = hasCount ? String(item.count).length * 7 + 18 : 0;
    total += textWidth + countWidth + perTabPad;
  }
  if (total <= 335) return 'compact';
  if (total <= 455) return 'medium';
  return 'wide';
});

/** 多项换行时采用均衡列数，避免在窄屏出现 N-1 + 1 的孤立尾项。 */
const gridCols = computed(() => {
  const n = props.items.length;
  if (n <= 4) return Math.max(1, n);
  if (n <= 6) return 3;
  if (n <= 8) return 4;
  return Math.ceil(n / 2);
});

function select(id: T): void {
  if (id === model.value) return;
  const prevIndex = activeIndex.value;
  const nextIndex = props.items.findIndex((item) => item.id === id);
  const direction: SubTabDirection =
    prevIndex >= 0 && nextIndex >= 0
      ? nextIndex > prevIndex
        ? 'next'
        : 'prev'
      : '';
  model.value = id;
  emit('change', id, direction);
}

async function moveFocus(targetIndex: number): Promise<void> {
  const item = props.items[targetIndex];
  if (!item || item.disabled) return;
  select(item.id);
  await nextTick();
  const buttons =
    trackRef.value?.querySelectorAll<HTMLButtonElement>('.subtabs-btn');
  buttons?.[targetIndex]?.focus();
}

function findEnabledIndex(start: number, step: 1 | -1): number {
  const len = props.items.length;
  if (!len) return -1;
  for (let offset = 1; offset <= len; offset++) {
    const idx = (start + step * offset + len) % len;
    if (!props.items[idx]?.disabled) return idx;
  }
  return -1;
}

function onKeydown(event: KeyboardEvent): void {
  const buttons =
    trackRef.value?.querySelectorAll<HTMLButtonElement>('.subtabs-btn');
  const current = buttons
    ? Array.from(buttons).indexOf(event.target as HTMLButtonElement)
    : activeIndex.value;
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    const next = findEnabledIndex(current < 0 ? -1 : current, 1);
    if (next >= 0) {
      event.preventDefault();
      void moveFocus(next);
    }
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    const prev = findEnabledIndex(current < 0 ? 0 : current, -1);
    if (prev >= 0) {
      event.preventDefault();
      void moveFocus(prev);
    }
  } else if (event.key === 'Home') {
    const first = props.items.findIndex((item) => !item.disabled);
    if (first >= 0) {
      event.preventDefault();
      void moveFocus(first);
    }
  } else if (event.key === 'End') {
    for (let i = props.items.length - 1; i >= 0; i--) {
      if (!props.items[i]?.disabled) {
        event.preventDefault();
        void moveFocus(i);
        break;
      }
    }
  }
}
</script>

<template>
  <div
    :class="[
      'subtabs',
      `is-l${level}`,
      inline ? 'is-inline' : 'is-standalone',
      `is-overflow-${overflow}`,
      `is-span-${spanTier}`,
      {'is-few': items.length <= 4},
      attrs.class,
    ]"
    :style="[attrs.style as StyleValue, {'--st-cols': String(gridCols)}]">
    <div :class="['subtabs-shell', {'more-l': moreLeft, 'more-r': moreRight}]">
      <div
        ref="trackRef"
        class="subtabs-track"
        role="tablist"
        :id="id"
        :aria-label="resolvedLabel"
        @scroll.passive="updateScrollHints"
        @keydown="onKeydown">
        <span
          v-if="pill.visible"
          :class="['subtabs-pill', {animated}]"
          aria-hidden="true"
          :style="pillStyle" />
        <button
          v-for="(item, index) in items"
          :key="String(item.id)"
          type="button"
          role="tab"
          :disabled="item.disabled"
          :title="item.title"
          :aria-selected="item.id === model"
          :tabindex="index === tabStopIndex ? 0 : -1"
          :class="[
            'subtabs-btn',
            {
              on: item.id === model,
              'is-fallback': item.id === model && !pill.visible,
            },
          ]"
          v-bind="attr ? {[`data-${attr}`]: String(item.id)} : undefined"
          @click="select(item.id)">
          <span class="subtabs-label">{{ item.label }}</span>
          <i
            v-if="item.count !== undefined && item.count !== ''"
            class="subtabs-count">
            {{ item.count }}
          </i>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.subtabs {
  min-width: 0;
  max-width: 100%;
}
.subtabs.is-standalone {
  width: 100%;
  container: subtabs / inline-size;
}
.subtabs.is-inline {
  display: inline-flex;
  width: fit-content;
  flex: 0 1 auto;
}

.subtabs-shell {
  position: relative;
  display: inline-flex;
  width: fit-content;
  max-width: 100%;
  min-width: 0;
  border: 1px solid var(--line);
  background: var(--surface2);
}

.subtabs-track {
  position: relative;
  display: inline-flex;
  align-items: stretch;
  flex-wrap: nowrap;
  max-width: 100%;
  min-width: 0;
  border-radius: inherit;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
}
.subtabs-track::-webkit-scrollbar {
  display: none;
}

/* 横向溢出时的渐变边缘与箭头提示（与一级导航保持一致） */
.subtabs-shell.more-r .subtabs-track {
  -webkit-mask-image: linear-gradient(
    90deg,
    #000 calc(100% - 24px),
    transparent
  );
  mask-image: linear-gradient(90deg, #000 calc(100% - 24px), transparent);
}
.subtabs-shell.more-l .subtabs-track {
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 24px);
  mask-image: linear-gradient(90deg, transparent, #000 24px);
}
.subtabs-shell.more-l.more-r .subtabs-track {
  -webkit-mask-image: linear-gradient(
    90deg,
    transparent,
    #000 24px,
    #000 calc(100% - 24px),
    transparent
  );
  mask-image: linear-gradient(
    90deg,
    transparent,
    #000 24px,
    #000 calc(100% - 24px),
    transparent
  );
}
.subtabs-shell.more-l::before,
.subtabs-shell.more-r::after {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 3;
  pointer-events: none;
  font-family: var(--fn);
  font-size: 15px;
  font-weight: 700;
  line-height: 1;
  color: var(--accent);
}
.subtabs-shell.more-l::before {
  content: '‹';
  left: 3px;
}
.subtabs-shell.more-r::after {
  content: '›';
  right: 3px;
}

.subtabs-pill {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 0;
  pointer-events: none;
  box-sizing: border-box;
}

.subtabs-btn {
  position: relative;
  z-index: 1;
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  color: var(--ink2);
  font: inherit;
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
  transition:
    color 0.18s ease,
    background-color 0.16s ease;
}
.subtabs-btn:disabled {
  opacity: 0.42;
  cursor: not-allowed;
}
.subtabs-btn:not(.on):not(:disabled):hover {
  color: var(--ink);
  background: color-mix(in srgb, var(--surface) 60%, transparent);
}
.subtabs-btn:focus-visible {
  outline-offset: -2px;
}

.subtabs-label {
  min-width: 0;
}

.subtabs-count {
  font-style: normal;
  border-radius: 999px;
  background: color-mix(in srgb, var(--line) 55%, transparent);
  color: var(--ink3);
  transition:
    background-color 0.18s ease,
    color 0.18s ease;
}

/* ==========================================================================
   二级 Tab（level = 2）：主视口内顶层切换栏 —— 更大字号、实心主色滑块、高视觉权重
   ========================================================================== */
.subtabs.is-l2 .subtabs-shell {
  border-radius: 11px;
  box-shadow: inset 0 1px 2px rgba(18, 34, 32, 0.04);
}
.subtabs.is-l2 .subtabs-track {
  padding: 4px;
  gap: 4px;
}
.subtabs.is-l2 .subtabs-pill,
.subtabs.is-l2 .subtabs-btn.is-fallback {
  border-radius: 7.5px;
  background: var(--accent);
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.16),
    0 4px 10px -4px color-mix(in srgb, var(--accent) 45%, transparent);
}
.subtabs.is-l2 .subtabs-pill.animated {
  transition:
    transform 0.24s cubic-bezier(0.22, 1, 0.36, 1),
    width 0.24s cubic-bezier(0.22, 1, 0.36, 1),
    height 0.24s cubic-bezier(0.22, 1, 0.36, 1);
}
.subtabs.is-l2 .subtabs-btn {
  min-height: 36px;
  padding: 5px 14px;
  gap: 6px;
  border-radius: 7.5px;
  font-size: 13.5px;
  font-weight: 600;
}
.subtabs.is-l2 .subtabs-btn.on {
  color: var(--accent-ink);
  font-weight: 700;
}
.subtabs.is-l2 .subtabs-count {
  font: 700 11.5px/1.2 var(--fn);
  padding: 1px 6.5px;
}
.subtabs.is-l2 .subtabs-btn.on .subtabs-count {
  background: color-mix(in srgb, var(--accent-ink) 20%, transparent);
  color: var(--accent-ink);
}

/* ==========================================================================
   三级 Tab（level = 3）：页内嵌套子切换栏 —— 更紧凑、浅底浮卡滑块，明确弱于二级
   ========================================================================== */
.subtabs.is-l3 {
  --st-l3-track: color-mix(in srgb, var(--line) 22%, var(--surface2));
  --st-l3-pill-bg: var(--surface);
  --st-l3-pill-border: color-mix(in srgb, var(--accent) 40%, var(--line2));
  --st-l3-pill-shadow: 0 1px 2px rgba(18, 34, 32, 0.09);
  --st-l3-active-ink: color-mix(in srgb, var(--accent) 88%, var(--ink));
}
.subtabs.is-l3 .subtabs-shell {
  border-radius: 8px;
  background: var(--st-l3-track);
}
.subtabs.is-l3 .subtabs-track {
  padding: 3px;
  gap: 2px;
}
.subtabs.is-l3 .subtabs-pill,
.subtabs.is-l3 .subtabs-btn.is-fallback {
  border-radius: 6px;
  background: var(--st-l3-pill-bg);
  border: 1px solid var(--st-l3-pill-border);
  box-shadow: var(--st-l3-pill-shadow);
}
.subtabs.is-l3 .subtabs-pill.animated {
  transition:
    transform 0.2s cubic-bezier(0.22, 1, 0.36, 1),
    width 0.2s cubic-bezier(0.22, 1, 0.36, 1),
    height 0.2s cubic-bezier(0.22, 1, 0.36, 1);
}
.subtabs.is-l3 .subtabs-btn {
  min-height: 30px;
  padding: 3px 10px;
  gap: 5px;
  border-radius: 6px;
  font-size: 12.5px;
  font-weight: 500;
}
.subtabs.is-l3 .subtabs-btn.on {
  color: var(--st-l3-active-ink);
  font-weight: 700;
}
.subtabs.is-l3 .subtabs-count {
  font: 700 10.5px/1.2 var(--fn);
  padding: 1px 5px;
}
.subtabs.is-l3 .subtabs-btn.on .subtabs-count {
  background: var(--accent-soft);
  color: inherit;
}

/* 深色模式下三级滑块抬升对比度（深色主题中 surface2 比 surface 更亮） */
:global(:root[data-theme='dark'] .subtabs.is-l3) {
  --st-l3-track: color-mix(in srgb, var(--bg) 52%, var(--surface2));
  --st-l3-pill-bg: color-mix(in srgb, var(--accent) 16%, var(--surface2));
  --st-l3-pill-border: color-mix(in srgb, var(--accent) 50%, var(--line2));
  --st-l3-pill-shadow: 0 1px 3px rgba(0, 0, 0, 0.28);
  --st-l3-active-ink: var(--accent);
}
@media (prefers-color-scheme: dark) {
  :global(:root:not([data-theme='light']) .subtabs.is-l3) {
    --st-l3-track: color-mix(in srgb, var(--bg) 52%, var(--surface2));
    --st-l3-pill-bg: color-mix(in srgb, var(--accent) 16%, var(--surface2));
    --st-l3-pill-border: color-mix(in srgb, var(--accent) 50%, var(--line2));
    --st-l3-pill-shadow: 0 1px 3px rgba(0, 0, 0, 0.28);
    --st-l3-active-ink: var(--accent);
  }
}

/* 触屏设备：保证三级按钮同样满足 >= 34px 触控高度，但视觉体量仍小于二级 */
@media (pointer: coarse) {
  .subtabs.is-l2 .subtabs-btn {
    min-height: 38px;
  }
  .subtabs.is-l3 .subtabs-btn {
    min-height: 34px;
  }
}

/* ==========================================================================
   响应式尺寸与防孤项换行逻辑（优先容器查询，适配 Wiki 分栏 / 折叠屏 / 小窗）
   ========================================================================== */

/* 中等宽度（如 625×670 方形小窗、640×400 横屏小窗、半屏分栏）：收紧内边距尽量保单行 */
@container subtabs (max-width: 640px) {
  .subtabs.is-l2 .subtabs-track {
    padding: 3px;
    gap: 2px;
  }
  .subtabs.is-l2 .subtabs-btn {
    min-height: 36px;
    padding: 4px 9px;
    font-size: 13px;
    gap: 5px;
  }
  .subtabs.is-l3 .subtabs-btn {
    min-height: 34px;
    padding: 3px 8px;
    font-size: 12px;
    gap: 4px;
  }
}
@container quickref-view (max-width: 640px) {
  .subtabs.is-inline.is-l2 .subtabs-track {
    padding: 3px;
    gap: 2px;
  }
  .subtabs.is-inline.is-l2 .subtabs-btn {
    min-height: 36px;
    padding: 4px 9px;
    font-size: 13px;
    gap: 5px;
  }
  .subtabs.is-inline.is-l3 .subtabs-btn {
    min-height: 34px;
    padding: 3px 8px;
    font-size: 12px;
    gap: 4px;
  }
}

/* 正常高度（非矮窗）下，宽多标签栏在较窄容器中切换为均衡多行网格（如 4+3 / 4+4），杜绝 7+1 孤项 */
@media (min-height: 601px) {
  @container subtabs (max-width: 560px) {
    .subtabs.is-standalone.is-span-wide:not(.is-overflow-scroll)
      .subtabs-shell {
      width: 100%;
    }
    .subtabs.is-standalone.is-span-wide:not(.is-overflow-scroll)
      .subtabs-track {
      display: grid;
      grid-template-columns: repeat(var(--st-cols), minmax(0, 1fr));
      width: 100%;
      overflow: visible;
    }
    .subtabs.is-standalone.is-span-wide:not(.is-overflow-scroll) .subtabs-btn {
      width: 100%;
      padding-inline: 6px;
      font-size: 12.5px;
    }
  }

  @container quickref-view (max-width: 560px) {
    .subtabs.is-inline.is-span-wide:not(.is-overflow-scroll) {
      flex: 1 1 100%;
      width: 100%;
    }
    .subtabs.is-inline.is-span-wide:not(.is-overflow-scroll) .subtabs-shell {
      width: 100%;
    }
    .subtabs.is-inline.is-span-wide:not(.is-overflow-scroll) .subtabs-track {
      display: grid;
      grid-template-columns: repeat(var(--st-cols), minmax(0, 1fr));
      width: 100%;
      overflow: visible;
    }
    .subtabs.is-inline.is-span-wide:not(.is-overflow-scroll) .subtabs-btn {
      width: 100%;
      padding-inline: 6px;
      font-size: 12.5px;
    }
  }

  /* 中等总宽的多标签栏（如策略 8 分类）：在竖屏手机（<= 450px）拆为 4+4 均衡双行 */
  @container subtabs (max-width: 450px) {
    .subtabs.is-standalone.is-span-medium:not(.is-overflow-scroll)
      .subtabs-shell {
      width: 100%;
    }
    .subtabs.is-standalone.is-span-medium:not(.is-overflow-scroll)
      .subtabs-track {
      display: grid;
      grid-template-columns: repeat(var(--st-cols), minmax(0, 1fr));
      width: 100%;
      overflow: visible;
    }
    .subtabs.is-standalone.is-span-medium:not(.is-overflow-scroll)
      .subtabs-btn {
      width: 100%;
      padding-inline: 5px;
      font-size: 12.5px;
    }
  }

  @container quickref-view (max-width: 450px) {
    .subtabs.is-inline.is-span-medium:not(.is-overflow-scroll) {
      flex: 1 1 100%;
      width: 100%;
    }
    .subtabs.is-inline.is-span-medium:not(.is-overflow-scroll) .subtabs-shell {
      width: 100%;
    }
    .subtabs.is-inline.is-span-medium:not(.is-overflow-scroll) .subtabs-track {
      display: grid;
      grid-template-columns: repeat(var(--st-cols), minmax(0, 1fr));
      width: 100%;
      overflow: visible;
    }
    .subtabs.is-inline.is-span-medium:not(.is-overflow-scroll) .subtabs-btn {
      width: 100%;
      padding-inline: 5px;
      font-size: 12.5px;
    }
  }

  /* 少项独立标签栏（2–4 项，如 固定/自选/替补）：竖屏手机等宽铺满单行，防止 2+1 孤项换行 */
  @container subtabs (max-width: 480px) {
    .subtabs.is-standalone.is-few .subtabs-shell {
      width: 100%;
    }
    .subtabs.is-standalone.is-few .subtabs-track {
      width: 100%;
    }
    .subtabs.is-standalone.is-few .subtabs-btn {
      flex: 1 1 auto;
      padding-inline: 8px;
      gap: 4px;
    }
    .subtabs.is-standalone.is-l2.is-few .subtabs-btn {
      font-size: 12.5px;
    }
    .subtabs.is-standalone.is-l2.is-few .subtabs-count {
      font-size: 11px;
      padding: 1px 5px;
    }
  }

  @container quickref-view (max-width: 480px) {
    .subtabs.is-inline.is-l2 .subtabs-btn {
      padding: 4px 8px;
      font-size: 12.5px;
      gap: 4px;
    }
    .subtabs.is-inline.is-l3 .subtabs-btn {
      padding: 3px 7px;
      font-size: 12px;
      gap: 3px;
    }
  }

  /* 超窄屏兜底（<= 320px）：compact 多项栏改 2 列，不裁切 */
  @container subtabs (max-width: 320px) {
    .subtabs.is-standalone.is-span-compact:not(.is-overflow-scroll)
      .subtabs-track {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      width: 100%;
      overflow: visible;
    }
  }
}

/* 矮窗口（安卓横屏小窗 640×400 / 860×380）：永远保持紧凑单行（溢出横向滚动），留足纵向空间 */
@media (max-height: 600px) {
  .subtabs.is-l2 .subtabs-shell {
    border-radius: 9px;
  }
  .subtabs.is-l2 .subtabs-track {
    padding: 3px;
    gap: 2px;
  }
  .subtabs.is-l2 .subtabs-btn {
    min-height: 36px;
    padding: 3px 10px;
    font-size: 12.5px;
    gap: 4px;
    border-radius: 6.5px;
  }
  .subtabs.is-l2 .subtabs-pill,
  .subtabs.is-l2 .subtabs-btn.is-fallback {
    border-radius: 6.5px;
  }
  .subtabs.is-l2 .subtabs-count {
    font-size: 11px;
    padding: 1px 5px;
  }

  .subtabs.is-l3 .subtabs-shell {
    border-radius: 7px;
  }
  .subtabs.is-l3 .subtabs-track {
    padding: 2px;
    gap: 2px;
  }
  .subtabs.is-l3 .subtabs-btn {
    min-height: 34px;
    padding: 2px 8px;
    font-size: 12px;
    gap: 3px;
    border-radius: 5px;
  }
  .subtabs.is-l3 .subtabs-pill,
  .subtabs.is-l3 .subtabs-btn.is-fallback {
    border-radius: 5px;
  }
}

/* 减弱动画偏好（同时遵循系统设置与站点设置开关） */
@media (prefers-reduced-motion: reduce) {
  .subtabs-pill,
  .subtabs-btn,
  .subtabs-count {
    transition: none !important;
  }
}
:global(:root[data-motion='reduce'] .subtabs-pill),
:global(:root[data-motion='reduce'] .subtabs-btn),
:global(:root[data-motion='reduce'] .subtabs-count) {
  transition: none !important;
}
</style>
