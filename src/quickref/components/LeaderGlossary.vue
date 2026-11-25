<script setup lang="ts">
import {computed, nextTick, ref} from 'vue';
import type {EnemyTerm} from '../../../data/index.ts';
import {prefersReducedMotion} from '../../lib/ui/dom.ts';
import {nameScore, normalize} from '../../lib/ui/match.ts';
import SubTabs from './SubTabs.vue';
import SearchInput from './SearchInput.vue';
import EmptyState from './EmptyState.vue';

const props = defineProps<{items: readonly EnemyTerm[]}>();
const activeTerm = ref('');
const glossaryOpen = ref(false);
const glossaryQuery = ref('');
const glossaryKind = ref<'all' | EnemyTerm['kind']>('all');
const glossaryEl = ref<HTMLElement | null>(null);
const TERM_KIND_LABEL: Readonly<Record<EnemyTerm['kind'], string>> = {
  unit: '单位',
  status: '状态',
  mechanic: '机制',
};
const activeTermEntry = computed<EnemyTerm | null>(
  () =>
    props.items.find((item) => item.term === activeTerm.value) ?? null,
);
const glossaryKindOptions = computed<
  readonly {id: 'all' | EnemyTerm['kind']; label: string}[]
>(() => {
  const present = new Set(props.items.map((item) => item.kind));
  const options: {id: 'all' | EnemyTerm['kind']; label: string}[] = [
    {id: 'all', label: '全部'},
  ];
  for (const kind of ['unit', 'status', 'mechanic'] as const) {
    if (present.has(kind))
      options.push({id: kind, label: TERM_KIND_LABEL[kind]});
  }
  return options;
});
const filteredGlossaryItems = computed<readonly EnemyTerm[]>(() => {
  const q = normalize(glossaryQuery.value);
  return props.items.filter((item) => {
    if (glossaryKind.value !== 'all' && item.kind !== glossaryKind.value) {
      return false;
    }
    if (!q) return true;
    return (
      nameScore(item.term, q) > 0 ||
      normalize(item.desc).includes(q) ||
      normalize(TERM_KIND_LABEL[item.kind]).includes(q)
    );
  });
});
function resetGlossaryFilter(): void {
  glossaryQuery.value = '';
  glossaryKind.value = 'all';
}
function scrollGlossaryTerm(matched: string): void {
  const target = glossaryEl.value?.querySelector<HTMLElement>(
    `[data-glossary="${CSS.escape(matched)}"]`,
  );
  target?.scrollIntoView({
    behavior: prefersReducedMotion() ? 'instant' : 'smooth',
    block: 'nearest',
  });
}
function toggleGlossary(): void {
  glossaryOpen.value = !glossaryOpen.value;
}
function openGlossaryFromPin(): void {
  const current = activeTerm.value;
  glossaryOpen.value = true;
  resetGlossaryFilter();
  if (!current) return;
  void nextTick(() => scrollGlossaryTerm(current));
}
/** 定位当前领袖的已解析词条；折叠时显示摘要，展开时滚动到列表项。 */
function focusTerm(matched: string): void {
  activeTerm.value = matched;
  if (glossaryOpen.value) {
    if (!filteredGlossaryItems.value.some((item) => item.term === matched)) {
      resetGlossaryFilter();
    }
    void nextTick(() => scrollGlossaryTerm(matched));
    return;
  }
  void nextTick(() => {
    glossaryEl.value?.scrollIntoView({
      behavior: prefersReducedMotion() ? 'instant' : 'smooth',
      block: 'nearest',
    });
  });
}
defineExpose({focusTerm});
</script>

<template>
  <div
    v-if="items.length"
    ref="glossaryEl"
    class="lwd-gloss"
    data-peek="off">
    <button
      type="button"
      :class="['lwd-gloss-toggle', {open: glossaryOpen}]"
      :aria-expanded="glossaryOpen"
      aria-controls="leader-glossary-panel"
      @click="toggleGlossary">
      <span class="lwd-gloss-title">
        <b>名词与单位解析</b>
        <span class="lwd-gloss-cnt">{{ items.length }} 条</span>
        <small
          v-if="!glossaryOpen && !activeTermEntry"
          class="lwd-gloss-hint">
          悬停或点虚线词直查
        </small>
      </span>
      <span class="lwd-gloss-act">
        {{ glossaryOpen ? '收起' : '展开全部' }}
        <svg
          class="lwd-gloss-arrow"
          viewBox="0 0 12 12"
          width="11"
          height="11"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true">
          <path d="M2.5 4.5 6 8l3.5-3.5" />
        </svg>
      </span>
    </button>

    <div
      v-if="!glossaryOpen && activeTermEntry"
      :key="activeTermEntry.term"
      class="lwd-gloss-pin"
      role="region"
      :aria-label="`${activeTermEntry.term}名词解释`">
      <div class="lwd-gloss-pin-head">
        <i :class="['gloss-kind', activeTermEntry.kind]">
          {{ TERM_KIND_LABEL[activeTermEntry.kind] }}
        </i>
        <b>{{ activeTermEntry.term }}</b>
        <div class="lwd-gloss-pin-acts">
          <button
            type="button"
            class="lwd-gloss-mini"
            @click="openGlossaryFromPin">
            全部 {{ items.length }} 条
          </button>
          <button
            type="button"
            class="lwd-gloss-close"
            aria-label="收起该名词解释"
            @click="activeTerm = ''">
            ✕
          </button>
        </div>
      </div>
      <p>{{ activeTermEntry.desc }}</p>
    </div>

    <div
      id="leader-glossary-panel"
      :class="['lwd-gloss-drawer', {open: glossaryOpen}]"
      :inert="!glossaryOpen || undefined"
      :aria-hidden="!glossaryOpen ? 'true' : undefined">
      <div class="lwd-gloss-drawer-inner">
        <div class="lwd-gloss-body">
          <div class="lwd-gloss-tools">
            <SearchInput
              v-model="glossaryQuery"
              placeholder="搜词条名或说明…"
              aria-label="筛选当前 Boss 名词解释"
              class="lwd-gloss-search" />
            <SubTabs
              v-if="glossaryKindOptions.length > 2"
              v-model="glossaryKind"
              :items="glossaryKindOptions"
              :level="3"
              inline
              aria-label="词条类别"
              attr="gloss-kind" />
          </div>
          <dl v-if="filteredGlossaryItems.length" class="lwd-gloss-list">
            <div
              v-for="entry in filteredGlossaryItems"
              :key="entry.term"
              :data-glossary="entry.term"
              :class="['lwd-gloss-item', {on: activeTerm === entry.term}]"
              @click="
                activeTerm = activeTerm === entry.term ? '' : entry.term
              ">
              <dt>
                <i :class="['gloss-kind', entry.kind]">
                  {{ TERM_KIND_LABEL[entry.kind] }}
                </i>
                <b>{{ entry.term }}</b>
              </dt>
              <dd>{{ entry.desc }}</dd>
            </div>
          </dl>
          <EmptyState
            v-else
            compact
            message="没有匹配的名词解释"
            action-label="清空筛选"
            @action="resetGlossaryFilter" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 名词与单位解析（默认折叠为轻量摘要栏，支持点选单条速览与按需检索） */
.lwd-gloss {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--line);
  display: grid;
  gap: 0;
}
.lwd-gloss-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  min-height: 36px;
  padding: 5px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface2);
  color: var(--ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.14s ease,
    background-color 0.14s ease,
    color 0.14s ease;
}
.lwd-gloss-toggle:hover,
.lwd-gloss-toggle.open {
  border-color: var(--accent);
}
.lwd-gloss-toggle:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.lwd-gloss-title {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}
.lwd-gloss-title b {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--ink);
}
.lwd-gloss-cnt {
  font-family: var(--fn);
  font-size: 11px;
  color: var(--ink3);
}
.lwd-gloss-hint {
  font-size: 11px;
  color: var(--ink3);
}
.lwd-gloss-act {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--accent);
}
.lwd-gloss-arrow {
  flex: none;
  transition: transform 0.2s cubic-bezier(0.22, 1, 0.36, 1);
}
.lwd-gloss-toggle.open .lwd-gloss-arrow {
  transform: rotate(180deg);
}
.lwd-gloss-pin {
  margin-top: 7px;
  padding: 8px 10px;
  border: 1px solid color-mix(in srgb, var(--accent) 45%, var(--line));
  border-left: 3px solid var(--accent);
  border-radius: 8px;
  background: var(--accent-soft);
  display: grid;
  gap: 5px;
  animation: gloss-pin-in 0.15s ease-out;
}
@keyframes gloss-pin-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
}
.lwd-gloss-pin-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.lwd-gloss-pin-head b {
  font-size: 13px;
  color: var(--ink);
}
.lwd-gloss-pin-acts {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.lwd-gloss-mini,
.lwd-gloss-close {
  border: 1px solid var(--line2);
  border-radius: 6px;
  background: var(--surface);
  color: var(--ink2);
  font: inherit;
  font-size: 11.5px;
  cursor: pointer;
  min-height: 34px;
  transition:
    border-color 0.14s ease,
    color 0.14s ease;
}
.lwd-gloss-mini {
  padding: 2px 9px;
}
.lwd-gloss-close {
  min-width: 34px;
  padding: 0;
  display: inline-grid;
  place-items: center;
}
.lwd-gloss-mini:hover,
.lwd-gloss-close:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.lwd-gloss-pin p {
  margin: 0;
  font-size: 12px;
  line-height: 1.55;
  color: var(--ink2);
}
.lwd-gloss-drawer {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transition:
    grid-template-rows 0.22s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.18s ease,
    margin-top 0.22s cubic-bezier(0.22, 1, 0.36, 1);
}
.lwd-gloss-drawer.open {
  grid-template-rows: 1fr;
  opacity: 1;
  margin-top: 7px;
}
.lwd-gloss-drawer-inner {
  min-height: 0;
  overflow: hidden;
}
.lwd-gloss-body {
  display: grid;
  gap: 7px;
  padding: 1px;
}
.lwd-gloss-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.lwd-gloss-search {
  flex: 1 1 150px;
  min-width: 0;
}
.lwd-gloss-list {
  margin: 0;
  display: grid;
  gap: 5px;
}
.lwd-gloss-item {
  display: grid;
  gap: 2px;
  padding: 6px 8px;
  border-radius: 7px;
  border: 1px solid var(--line);
  background: var(--surface2);
  cursor: pointer;
  transition:
    border-color 0.14s ease,
    background-color 0.14s ease,
    box-shadow 0.14s ease;
}
.lwd-gloss-item:hover {
  border-color: var(--line2);
}
.lwd-gloss-item.on {
  border-color: var(--accent);
  background: var(--accent-soft);
  box-shadow: 0 0 0 1px var(--accent);
}
.lwd-gloss-item dt {
  display: flex;
  align-items: center;
  gap: 5px;
}
.lwd-gloss-item dt b {
  font-size: 12.5px;
  color: var(--ink);
}
.lwd-gloss-item dd {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--ink2);
}
.gloss-kind {
  font-style: normal;
  font-size: 10px;
  font-weight: 700;
  line-height: 1.4;
  padding: 0 5px;
  border-radius: 4px;
  flex: none;
}
.gloss-kind.unit {
  background: color-mix(in srgb, var(--teal) 15%, transparent);
  color: var(--teal);
}
.gloss-kind.status {
  background: color-mix(in srgb, var(--red) 14%, transparent);
  color: var(--red);
}
.gloss-kind.mechanic {
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  color: var(--accent);
}

@container quickref-view (max-width: 500px) {
  .lwd-gloss-hint { display: none; }
}
@media (max-height: 600px) {
  .lwd-gloss-toggle { min-height: 34px; padding: 4px 8px; }
  .lwd-gloss-hint { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .lwd-gloss :is(button, .lwd-gloss-item, .lwd-gloss-arrow, .lwd-gloss-drawer) { transition: none; }
  .lwd-gloss-pin { animation: none; }
}
:global(:root[data-motion='reduce'] .lwd-gloss :is(button, .lwd-gloss-item, .lwd-gloss-arrow, .lwd-gloss-drawer)) { transition: none; }
:global(:root[data-motion='reduce'] .lwd-gloss-pin) { animation: none; }
</style>
