<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, provide, ref } from 'vue';
import { ALL_COVENANTS, OPERATORS, EQUIPMENT, STRATEGIES, LEADERS, BUILD_COUNT, OPERATOR, EQUIP, STRATEGY } from '../../data/index.ts';
import { prefersReducedMotion } from '../lib/dom.ts';
import { state, setTab, setBuild, setCovenant, setLeader, quickrefActionsKey, type DetailKind, type DetailSelection, type TabId } from './state.ts';
import CovenantsView from './views/CovenantsView.vue';
import CatalogView from './views/CatalogView.vue';
import BuildsView from './views/BuildsView.vue';
import LeadersView from './views/LeadersView.vue';
import NumbersView from './views/NumbersView.vue';
import SearchView from './views/SearchView.vue';
import DetailSheet from './components/DetailSheet.vue';
const tabs: { id: TabId; label: string; count: number | '' }[] = [
  { id: 'cv', label: '盟约', count: ALL_COVENANTS.length }, { id: 'op', label: '干员', count: OPERATORS.length },
  { id: 'eq', label: '装备', count: EQUIPMENT.length }, { id: 'st', label: '策略', count: STRATEGIES.length },
  { id: 'ld', label: '领袖', count: LEADERS.length },
  { id: 'bd', label: '流派', count: BUILD_COUNT }, { id: 'nu', label: '数值', count: '' },
];
const query = ref('');
const renderedQuery = ref('');
const searching = computed(() => !!query.value.trim());
const searchInput = ref<HTMLInputElement | null>(null);
const searchBar = ref<HTMLDivElement | null>(null);
const view = ref<HTMLElement | null>(null);
const detail = ref<DetailSelection | null>(null);
let searchTimer: ReturnType<typeof setTimeout> | undefined;
const scrollBehavior = (): ScrollBehavior => prefersReducedMotion ? 'auto' : 'smooth';
const topOf = (element: Element): number => element.getBoundingClientRect().top + window.scrollY - (searchBar.value?.offsetHeight ?? 0);
function clearSearch(): void { clearTimeout(searchTimer); query.value = ''; renderedQuery.value = ''; }
function search(event: Event): void {
  query.value = (event.target as HTMLInputElement).value;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { renderedQuery.value = query.value.trim(); }, 90);
}
/** Keeps pane identity stable for filter/search updates, then scrolls only for navigation. */
async function show(tab: TabId, scroll = true): Promise<void> {
  clearSearch(); setTab(tab); await nextTick();
  if (scroll && view.value) { const top = topOf(view.value) - 4; if (window.scrollY > top) window.scrollTo({ top, behavior: scrollBehavior() }); }
}
function flashOperator(name: string): boolean {
  const targets = [...document.querySelectorAll<HTMLElement>('#view .tile[data-op], #view .sr[data-op]')].filter(element => element.dataset.op === name);
  if (!targets.length) return false;
  const first = targets[0], bounds = first.getBoundingClientRect();
  if (bounds.top < (searchBar.value?.offsetHeight ?? 0) || bounds.bottom > window.innerHeight) first.scrollIntoView({ block: 'center', behavior: scrollBehavior() });
  for (const target of targets) { target.classList.remove('flash'); void target.offsetWidth; target.classList.add('flash'); }
  return true;
}
function openDetail(kind: DetailKind, name: string): void {
  const exists = kind === 'op' ? OPERATOR[name] : kind === 'eq' ? EQUIP[name] : STRATEGY[name];
  if (exists) detail.value = { kind, name };
}
function closeDetail(): void {
  // Closing before navigation lets the browser restore dialog focus before we scroll/flash.
  const sheet = document.querySelector<HTMLDialogElement>('#sheet');
  if (sheet?.open) sheet.close();
  detail.value = null;
}
async function openCovenant(name: string): Promise<void> {
  const fromOperator = detail.value?.kind === 'op' ? detail.value.name : '';
  closeDetail(); setCovenant(name); await show('cv', !fromOperator);
  if (fromOperator && !flashOperator(fromOperator)) await show('cv');
}
async function openBuild(name: string): Promise<void> { closeDetail(); setBuild(name); await show('bd'); }
async function openLeader(name: string): Promise<void> { closeDetail(); setLeader(name); await show('ld'); }
async function pickCovenant(name: string): Promise<void> {
  setCovenant(name); await nextTick();
  const element = view.value?.querySelector('.cvd');
  if (window.innerWidth <= 860 && element) window.scrollTo({ top: topOf(element) - 6, behavior: scrollBehavior() });
}
provide(quickrefActionsKey, { openDetail, closeDetail, openCovenant, openBuild, openLeader, pickCovenant });
function clearAndFocus(): void { clearSearch(); searchInput.value?.focus(); }
function keydown(event: KeyboardEvent): void {
  if (event.key === '/' && document.activeElement !== searchInput.value && !detail.value) { event.preventDefault(); searchInput.value?.focus(); searchInput.value?.select(); }
  else if (event.key === 'Escape' && document.activeElement === searchInput.value && query.value) clearSearch();
}
function outsidePicker(event: MouseEvent): void { if (state.pickerOpen && event.target instanceof Element && !event.target.closest('#cvside')) state.pickerOpen = false; }
onMounted(() => { document.addEventListener('keydown', keydown); document.addEventListener('click', outsidePicker); });
onUnmounted(() => { clearTimeout(searchTimer); document.removeEventListener('keydown', keydown); document.removeEventListener('click', outsidePicker); });
</script>
<template>
  <header class="wrap qhead"><div><h1>卫戍速查<small>卫戍协议·规程</small></h1></div><a class="guide" href="guide.html"><svg viewBox="0 0 72 72" aria-hidden="true"><circle class="ring" cx="36" cy="36" r="26"/><circle class="nd" cx="36" cy="10" r="6"/><circle class="nd" cx="58.5" cy="49" r="6"/><circle class="nd" cx="13.5" cy="49" r="6"/><circle class="mv" r="4"><animateMotion v-if="!prefersReducedMotion" id="gmv" dur="5s" repeatCount="indefinite" path="M36,10 A26,26 0 1 1 35.9,10"/></circle></svg><div><div class="k">GUIDE</div><b>图解教程</b><div class="qsteps"><span><i>01</i>入门</span><span><i>02</i>招募升本</span><span><i>03</i>刷怪</span><span><i>04</i>盟约</span><span><i>05</i>流派</span></div></div><span class="go">▸</span></a></header>
  <div id="qbar" ref="searchBar" :class="['qbar', { searching }]"><div class="wrap"><label id="sbox" :class="['search', { has: searching }]"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input id="q" ref="searchInput" type="search" :value="query" placeholder="干员 / 装备 / 策略 / 盟约 / 特质，支持拼音" autocomplete="off" aria-label="搜索" @input="search"><kbd>/</kbd><button id="qx" type="button" class="x" aria-label="清空" @click.prevent="clearAndFocus">✕</button></label><div id="tabs" class="tabs" role="tablist"><button v-for="tab in tabs" :key="tab.id" type="button" role="tab" :data-tab="tab.id" :class="{ on: state.tab === tab.id }" @click="show(tab.id, false)">{{ tab.label }}<i v-if="tab.count">{{ tab.count }}</i></button><a class="tlink" href="guide.html">教程 ▸</a></div></div></div>
  <main id="view" ref="view" class="wrap"><div :key="renderedQuery ? 'search' : state.tab" class="pane" :data-key="renderedQuery ? 'search' : state.tab"><SearchView v-if="renderedQuery" :query="renderedQuery"/><CovenantsView v-else-if="state.tab === 'cv'"/><CatalogView v-else-if="state.tab === 'op' || state.tab === 'eq' || state.tab === 'st'" :kind="state.tab"/><LeadersView v-else-if="state.tab === 'ld'"/><BuildsView v-else-if="state.tab === 'bd'"/><NumbersView v-else/></div></main>
  <DetailSheet :selection="detail" @closed="closeDetail"/>
</template>
