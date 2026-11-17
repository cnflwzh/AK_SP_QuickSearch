<script setup lang="ts">
import {computed, onBeforeUnmount, ref, watch} from 'vue';
import LiveStatus from '../../lib/ui/LiveStatus.vue';
import {normalize} from '../../lib/ui/match.ts';
import Segmented from '../components/Segmented.vue';
import {
  EXCUSE_CATEGORIES,
  EXCUSE_SUBMIT_URL,
  EXCUSES,
  pickRandomExcuse,
  type ExcuseCategory,
  type ExcuseItem,
} from './excuseData.ts';

const PAGE_SIZE = 24;

const category = ref<ExcuseCategory>('all');
const search = ref('');
const visibleLimit = ref(PAGE_SIZE);

const copiedId = ref('');
const lastRolledId = ref('');
const lastCopiedText = ref('');
const copyFallback = ref('');
const liveMessage = ref('');
let copiedTimer: ReturnType<typeof setTimeout> | undefined;

const categoryMap = new Map(
  EXCUSE_CATEGORIES.map((item) => [item.id, item.label]),
);
const categoryLabels = EXCUSE_CATEGORIES.map((item) => item.label);
const categoryIndex = computed(() =>
  Math.max(
    0,
    EXCUSE_CATEGORIES.findIndex((item) => item.id === category.value),
  ),
);

const filteredExcuses = computed(() => {
  const q = normalize(search.value);
  return EXCUSES.filter((item) => {
    if (category.value !== 'all' && item.category !== category.value) {
      return false;
    }
    if (!q) return true;
    const catLabel = categoryMap.get(item.category) ?? '';
    return normalize(item.text).includes(q) || normalize(catLabel).includes(q);
  });
});

const visibleExcuses = computed(() =>
  filteredExcuses.value.slice(0, visibleLimit.value),
);

watch([category, search], () => {
  visibleLimit.value = PAGE_SIZE;
});

onBeforeUnmount(() => clearTimeout(copiedTimer));

function selectCategory(index: number): void {
  const next = EXCUSE_CATEGORIES[index];
  if (next) category.value = next.id;
}

function resetFilter(): void {
  search.value = '';
  category.value = 'all';
}

async function writeClipboard(id: string, text: string): Promise<void> {
  clearTimeout(copiedTimer);
  lastCopiedText.value = text;
  copyFallback.value = '';
  try {
    await navigator.clipboard.writeText(text);
    copiedId.value = id;
    liveMessage.value = '已复制文案';
    copiedTimer = setTimeout(() => {
      copiedId.value = '';
    }, 1500);
  } catch {
    copiedId.value = '';
    copyFallback.value = text;
    liveMessage.value = '浏览器未授予剪贴板权限，请手动复制文案';
  }
}

function copyItem(item: ExcuseItem): void {
  lastRolledId.value = item.id;
  void writeClipboard(item.id, item.text);
}

function rollAndCopy(): void {
  const source = filteredExcuses.value.length ? filteredExcuses.value : EXCUSES;
  const picked = pickRandomExcuse(source, lastRolledId.value);
  if (!picked) return;
  lastRolledId.value = picked.id;
  void writeClipboard(picked.id, picked.text);
}
</script>

<template>
  <div class="nt-excuses">
    <div class="bar nt-toolbar">
      <h4 class="nt-section-title" aria-level="2">
        抽象文案 · {{ filteredExcuses.length }} 条
      </h4>
      <div class="nt-excuse-actions">
        <a
          class="btn nt-excuse-submit"
          :href="EXCUSE_SUBMIT_URL"
          target="_blank"
          rel="noopener noreferrer">
          投稿文案 ↗
        </a>
        <button type="button" class="btn p nt-excuse-roll" @click="rollAndCopy">
          🎲 随机抽一条复制
        </button>
      </div>
    </div>

    <section v-if="lastCopiedText" class="nc nt-excuse-flash">
      <div class="nt-heading">
        <b>{{ copyFallback ? '已选中文本 · 手动复制' : '✓ 已复制到剪贴板' }}</b>
        <button type="button" class="btn nt-text-button" @click="rollAndCopy">
          再换一条
        </button>
      </div>
      <textarea
        v-if="copyFallback"
        class="nt-copy-fallback"
        readonly
        aria-label="抽象文案复制框"
        :value="copyFallback"
        @focus="($event.target as HTMLTextAreaElement).select()"></textarea>
      <p v-else class="nt-excuse-flash-text">{{ lastCopiedText }}</p>
    </section>

    <section class="nc nt-excuse-controls-card">
      <div class="bar nt-excuse-controls">
        <div class="nt-excuse-search">
          <input
            v-model="search"
            type="search"
            placeholder="搜关键词：情头 / 谈恋爱 / 寿命 / 救世主 / 网卡 / 发牌员…"
            aria-label="搜索抽象文案" />
          <button
            v-if="search"
            type="button"
            class="nt-excuse-clear"
            aria-label="清空搜索"
            @click="search = ''">
            ✕
          </button>
        </div>
        <Segmented
          :labels="categoryLabels"
          :active="categoryIndex"
          attr="excuse-cat"
          @change="selectCategory" />
      </div>
    </section>

    <template v-if="filteredExcuses.length">
      <div class="nt-excuse-grid">
        <article
          v-for="item in visibleExcuses"
          :key="item.id"
          :class="['nc', 'nt-excuse-card', {copied: copiedId === item.id}]">
          <header class="nt-excuse-card-head">
            <span class="tag">{{ categoryMap.get(item.category) }}</span>
            <button
              type="button"
              :class="['btn', 'nt-excuse-copy', {p: copiedId === item.id}]"
              @click="copyItem(item)">
              {{ copiedId === item.id ? '✓ 已复制' : '一键复制' }}
            </button>
          </header>
          <p
            class="nt-excuse-text"
            title="点击正文直接复制"
            @click="copyItem(item)">
            {{ item.text }}
          </p>
        </article>
      </div>
      <button
        v-if="visibleLimit < filteredExcuses.length"
        type="button"
        class="btn nt-excuse-more"
        @click="visibleLimit += PAGE_SIZE">
        显示更多（{{ visibleLimit }} / {{ filteredExcuses.length }}）
      </button>
    </template>
    <section v-else class="nc nt-no-results">
      <p>没有匹配的文案</p>
      <div class="nt-excuse-empty-actions">
        <button type="button" class="btn" @click="resetFilter">显示全部</button>
        <a
          class="btn nt-excuse-submit"
          :href="EXCUSE_SUBMIT_URL"
          target="_blank"
          rel="noopener noreferrer">
          投稿文案 ↗
        </a>
      </div>
    </section>

    <LiveStatus :message="liveMessage" />
  </div>
</template>
