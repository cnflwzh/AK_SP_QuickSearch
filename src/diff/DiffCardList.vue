<script setup lang="ts">
import {computed, onBeforeUnmount, onMounted, shallowReactive, watch} from 'vue';
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

const chunkSize = 4;
const overscan = 320;
const mountedChunks = shallowReactive(new Set<string>());
const expanded = shallowReactive(new Set<string>());
const chunks = computed(() => {
  const result = [];
  for (let i = 0; i < props.entries.length; i += chunkSize) {
    const items = props.entries.slice(i, i + chunkSize);
    const estimatedHeight = items.reduce((height, item) => {
      let fields = item.rows.length;
      if (item.status === 'unchanged') fields = 0;
      if (item.status === 'modified') fields = item.changedCount;
      return height + 102 + fields * 52;
    }, 0);
    result.push({key: items[0].key, items, estimatedHeight});
  }
  return result;
});

function mountChunk(key: string): void {
  mountedChunks.add(key);
}

let observer: IntersectionObserver | undefined;
const vObserveChunk: ObjectDirective<HTMLElement, string> = {
  mounted(element, {value: key}) {
    if (typeof IntersectionObserver === 'undefined') {
      mountChunk(key);
      return;
    }
    observer ??= new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.target.isConnected)
            mountChunk((entry.target as HTMLElement).dataset.chunk!);
        }
      },
      {rootMargin: `${overscan}px 0px`},
    );
    const bounds = element.getBoundingClientRect();
    if (bounds.top < window.innerHeight + overscan && bounds.bottom > -overscan)
      mountChunk(key);
    observer.observe(element);
  },
  beforeUnmount(element, {value: key}) {
    observer?.unobserve(element);
    mountedChunks.delete(key);
  },
};

let cancelFill: (() => void) | undefined;
let scrollIdleTimer = 0;
function waitForScrollIdle(): void {
  if (!cancelFill && !scrollIdleTimer) return;
  cancelFill?.();
  cancelFill = undefined;
  window.clearTimeout(scrollIdleTimer);
  scrollIdleTimer = window.setTimeout(() => {
    scrollIdleTimer = 0;
    fillInBackground();
  }, 120);
}

function fillInBackground(): void {
  if (
    cancelFill ||
    scrollIdleTimer ||
    chunks.value.every(({key}) => mountedChunks.has(key))
  )
    return;
  const fill = () => {
    cancelFill = undefined;
    if (!document.body.classList.contains('is-loading')) {
      const next = chunks.value.find(({key}) => !mountedChunks.has(key));
      if (next) mountChunk(next.key);
    }
    fillInBackground();
  };
  if (document.body.classList.contains('is-loading')) {
    // 首屏已经挂载附近卡片。等遮罩撤掉后再逐批补齐可供浏览器查找的正文。
    const frame = requestAnimationFrame(fill);
    cancelFill = () => cancelAnimationFrame(frame);
  } else if (typeof window.requestIdleCallback === 'function') {
    const idle = window.requestIdleCallback(fill);
    cancelFill = () => window.cancelIdleCallback(idle);
  } else {
    const timer = window.setTimeout(fill, 16);
    cancelFill = () => window.clearTimeout(timer);
  }
}

function setExpanded(key: string, open: boolean): void {
  if (open) expanded.add(key);
  else expanded.delete(key);
}

onMounted(() => {
  fillInBackground();
  // 离屏补齐让位给正在滚动的页面，靠近视口的卡片仍由观察器立即挂载。
  window.addEventListener('scroll', waitForScrollIdle, {passive: true});
});
watch(chunks, fillInBackground, {flush: 'post'});
onBeforeUnmount(() => {
  cancelFill?.();
  window.clearTimeout(scrollIdleTimer);
  window.removeEventListener('scroll', waitForScrollIdle);
  observer?.disconnect();
});
</script>

<template>
  <div class="df-list">
    <div
      v-for="(chunk, index) in chunks"
      :key="chunk.key"
      v-observe-chunk="chunk.key"
      :data-chunk="chunk.key"
      class="df-list"
      :class="{
        'df-deferred-chunk': index > 0,
        'df-chunk-pending': !mountedChunks.has(chunk.key),
      }"
      :style="{'--df-chunk-height': chunk.estimatedHeight + 'px'}"
      :tabindex="mountedChunks.has(chunk.key) ? undefined : 0"
      :aria-label="
        mountedChunks.has(chunk.key) ? undefined : `第 ${index * chunkSize + 1} 项起的比较结果`
      "
      :role="mountedChunks.has(chunk.key) ? undefined : 'group'"
      @focus="mountChunk(chunk.key)">
      <template v-if="mountedChunks.has(chunk.key)">
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

<style scoped>
.df-deferred-chunk {
  content-visibility: auto;
  contain-intrinsic-block-size: auto var(--df-chunk-height);
}
.df-chunk-pending {
  min-block-size: var(--df-chunk-height);
}
</style>
