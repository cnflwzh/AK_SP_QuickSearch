<script setup lang="ts">
import {computed, ref, watch} from 'vue';
import LiveStatus from '../../lib/ui/LiveStatus.vue';
import {normalize} from '../../lib/ui/match.ts';
import SubTabs, {type SubTabDirection} from '../components/SubTabs.vue';
import SearchInput from '../components/SearchInput.vue';
import EmptyState from '../components/EmptyState.vue';
import {useClipboardCopy} from '../components/useClipboardCopy.ts';
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
const catDir = ref<SubTabDirection>('');
const search = ref('');
const visibleLimit = ref(PAGE_SIZE);

const {copiedKey: copiedId, copyText} = useClipboardCopy(1500);
const lastRolledId = ref('');
const lastCopiedText = ref('');
const copyFallback = ref('');
const liveMessage = ref('');

const categoryMap = new Map(
  EXCUSE_CATEGORIES.map((item) => [item.id, item.label]),
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

function resetFilter(): void {
  search.value = '';
  category.value = 'all';
}

async function writeClipboard(id: string, text: string): Promise<void> {
  lastCopiedText.value = text;
  copyFallback.value = '';
  const outcome = await copyText(text, id);
  if (outcome === 'copied') {
    liveMessage.value = '已复制文案';
  } else {
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

    <section v-if="lastCopiedText" class="nc nt-excuse-flash panel-reveal">
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
        <SearchInput
          v-model="search"
          class="nt-excuse-search"
          placeholder="搜关键词：情头 / 谈恋爱 / 寿命 / 救世主 / 网卡 / 发牌员…"
          aria-label="搜索抽象文案" />
        <SubTabs
          v-model="category"
          :items="EXCUSE_CATEGORIES"
          :level="3"
          inline
          aria-label="文案分类"
          attr="excuse-cat"
          @change="(_, dir) => (catDir = dir)" />
      </div>
    </section>

    <template v-if="filteredExcuses.length">
      <div
        :key="category"
        :class="['nt-excuse-grid', {'subtab-panel': !!catDir}]"
        :data-dir="catDir || undefined">
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
    <EmptyState
      v-else
      card
      message="没有匹配的文案"
      action-label="显示全部"
      @action="resetFilter">
      <a
        class="btn nt-excuse-submit"
        :href="EXCUSE_SUBMIT_URL"
        target="_blank"
        rel="noopener noreferrer">
        投稿文案 ↗
      </a>
    </EmptyState>

    <LiveStatus :message="liveMessage" />
  </div>
</template>
