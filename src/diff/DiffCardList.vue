<script setup lang="ts">
import {computed, onBeforeUnmount, ref, shallowReactive, watch} from 'vue';
import type {ObjectDirective} from 'vue';
import type {Covenant} from '../../data/index.ts';
import type {VisualDiffEntry} from './comparison.ts';
import DiffCard from './DiffCard.vue';

const props = defineProps<{
  entries: readonly VisualDiffEntry[];
  fromLabel: string;
  toLabel: string;
  viewMode: 'split' | 'unified';
  covenants: Readonly<Record<string, Covenant>>;
}>();

// 卡片高度随文字、窗宽和展开状态变化。保留离屏分块的实测高度，使滚动条能跨过整份结果。
const chunkSize = 4;
const overscan = 320;
const near = shallowReactive(new Set<string>());
const expanded = shallowReactive(new Set<string>());
const focused = ref<string>();
const heights = new Map<string, number>();
const chunks = computed(() => {
  const result = [];
  for (let i = 0; i < props.entries.length; i += chunkSize) {
    const items = props.entries.slice(i, i + chunkSize);
    result.push({key: items[0].key, start: i, items});
  }
  return result;
});
const windowed = computed(
  () =>
    props.entries.length > chunkSize &&
    typeof IntersectionObserver !== 'undefined',
);

function showChunk(key: string): boolean {
  return !windowed.value || near.has(key) || focused.value === key;
}

function placeholderHeight(
  key: string,
  items: readonly VisualDiffEntry[],
): number {
  const measured = heights.get(key);
  if (measured !== undefined) return measured;
  return items.reduce((height, item) => {
    let fields = item.rows.length;
    if (item.status === 'unchanged') fields = 0;
    if (item.status === 'modified') fields = item.changedCount;
    return height + 102 + fields * 52;
  }, 0);
}

let observer: IntersectionObserver | undefined;
const vObserveChunk: ObjectDirective<HTMLElement, string> = {
  mounted(el, {value: key}) {
    if (typeof IntersectionObserver === 'undefined') return;
    observer ??= new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.target.isConnected) continue;
          const id = (entry.target as HTMLElement).dataset.chunk!;
          if (entry.isIntersecting) near.add(id);
          else if (near.has(id)) {
            heights.set(id, entry.boundingClientRect.height);
            near.delete(id);
          }
        }
      },
      {rootMargin: `${overscan}px 0px`},
    );
    // 第一次绘制就挂载视口附近的卡片，无需等到观察器的首次异步通知。
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight + overscan && rect.bottom > -overscan)
      near.add(key);
    observer.observe(el);
  },
  beforeUnmount(el, {value: key}) {
    observer?.unobserve(el);
    near.delete(key);
    heights.delete(key);
  },
};

function leaveChunk(event: FocusEvent, key: string): void {
  const chunk = event.currentTarget as HTMLElement;
  if (
    focused.value === key &&
    !(
      event.relatedTarget instanceof Node && chunk.contains(event.relatedTarget)
    )
  ) {
    // 焦点可能在滚出视口后才离开；此时仍能读到展开后的实际高度。
    heights.set(key, chunk.getBoundingClientRect().height);
    focused.value = undefined;
  }
}

function setExpanded(key: string, open: boolean): void {
  if (open) expanded.add(key);
  else expanded.delete(key);
}

watch([() => props.entries, () => props.viewMode], () => heights.clear());
onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <div class="df-list">
    <div
      v-for="chunk in chunks"
      :key="chunk.key"
      v-observe-chunk="chunk.key"
      class="df-list"
      :data-chunk="chunk.key"
      :style="
        showChunk(chunk.key)
          ? undefined
          : {height: placeholderHeight(chunk.key, chunk.items) + 'px'}
      "
      :tabindex="showChunk(chunk.key) ? -1 : 0"
      role="group"
      :aria-label="`第 ${chunk.start + 1} 至 ${chunk.start + chunk.items.length} 项`"
      @focusin="focused = chunk.key"
      @focusout="leaveChunk($event, chunk.key)">
      <template v-if="showChunk(chunk.key)">
        <DiffCard
          v-for="entry in chunk.items"
          :key="entry.key"
          :entry="entry"
          :from-label="fromLabel"
          :to-label="toLabel"
          :view-mode="viewMode"
          :covenants="covenants"
          :expanded-context="expanded.has(entry.key)"
          @update:expanded-context="setExpanded(entry.key, $event)" />
      </template>
    </div>
  </div>
</template>
