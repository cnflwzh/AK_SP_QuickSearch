<script setup lang="ts">
import { markRaw, nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowReactive, type Component } from 'vue';
import { OPERATORS } from '../../data/index';
import { whileVisible } from '../lib/visibility';
import Markup from './components/Markup';
import { placeholders } from './placeholders';

const props = defineProps<{ ready: () => void; failed: (error: unknown) => void }>();
const loaders: Record<string, () => Promise<{ default: Component }>> = {
  c1: () => import('./chapters/Basics.vue'),
  c2: () => import('./chapters/Recruit.vue'),
  c3: () => import('./chapters/Enemies.vue'),
  c4: () => import('./chapters/Covenants.vue'),
  c5: () => import('./chapters/Builds.vue'),
  c6: () => import('./chapters/Database.vue'),
};
const ids = Object.keys(loaders);
const components = shallowReactive<Record<string, Component>>({});
const busy = reactive<Record<string, boolean>>({}), errors = reactive<Record<string, boolean>>({});
const pending = new Map<string, Promise<void>>();
const active = ref(''), loop = ref<SVGSVGElement>();
const kpis = [['14', '回合 + ??'], ['8', '部署上限'], ['3→1', '合成精锐'], ['6', '级调度中心'], ['26', '盟约'], [String(OPERATORS.length), '干员']];
const cleanup: (() => void)[] = [];
let mounted = true;

/** Load each chapter once; failed imports remain retryable without replacing siblings. */
function loadChapter(id: string): Promise<void> {
  const existing = pending.get(id);
  if (existing) return existing;
  if (!loaders[id]) return Promise.resolve();
  busy[id] = true;
  errors[id] = false;
  const task = loaders[id]().then(async module => {
    if (!mounted) return;
    components[id] = markRaw(module.default);
    await nextTick();
    busy[id] = false;
  }).catch((error: unknown) => {
    pending.delete(id);
    busy[id] = false;
    errors[id] = true;
    console.error('Chapter initialization failed', id, error);
    throw error;
  });
  pending.set(id, task);
  return task;
}
const hashSection = () => document.getElementById(decodeURIComponent(location.hash.slice(1)))?.closest<HTMLElement>('.chap');
const backgroundLoad = (id: string) => { void loadChapter(id).catch(() => {}); };
function navigate(event: MouseEvent) {
  const link = (event.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
  const section = link && document.getElementById(link.hash.slice(1))?.closest<HTMLElement>('.chap');
  if (section) backgroundLoad(section.id);
}

onMounted(async () => {
  const sections = Array.from(document.querySelectorAll<HTMLElement>('.chap'));
  const navObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => { if (entry.isIntersecting) active.value = entry.target.id; });
  }, { rootMargin: '-45% 0px -50% 0px' });
  const nearby = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      nearby.unobserve(entry.target);
      backgroundLoad(entry.target.id);
    }
  }, { rootMargin: '240px 0px' });
  const initial = new Set<HTMLElement>();
  const target = hashSection();
  if (target) initial.add(target);
  sections.forEach(section => {
    navObserver.observe(section);
    const rect = section.getBoundingClientRect();
    if (rect.top < innerHeight + 240 && rect.bottom > -240) initial.add(section);
    else nearby.observe(section);
  });
  const onHash = () => {
    const hash = location.hash;
    const section = hashSection();
    if (!section) return;
    // A deep anchor inside an unloaded chapter is replaced with the Vue view.
    // Restore that exact anchor after rendering, without stealing a later jump.
    void loadChapter(section.id).then(() => {
      if (location.hash === hash) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView();
    }).catch(() => {});
  };
  addEventListener('hashchange', onHash);
  cleanup.push(() => { navObserver.disconnect(); nearby.disconnect(); removeEventListener('hashchange', onHash); });
  if (loop.value) {
    const svg = loop.value;
    svg.pauseAnimations();
    cleanup.push(whileVisible(svg, () => { svg.unpauseAnimations(); return () => svg.pauseAnimations(); }));
  }
  try {
    await Promise.all([...initial].map(section => loadChapter(section.id)));
    await nextTick();
    if (target) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
    props.ready();
  } catch (error) { props.failed(error); }
});
onBeforeUnmount(() => { mounted = false; cleanup.forEach(dispose => dispose()); });
</script>
<template>
<header class="wrap hero">
  <div>
    <div class="kicker">ARKNIGHTS · STRONGHOLD PROTOCOL</div>
    <h1>卫戍协议<span>规程 · 序列Ⅰ</span></h1>
    <div class="kpis" id="kpis"><div v-for="[value, label] in kpis" :key="label" class="kpi"><b>{{ value }}</b><span>{{ label }}</span></div></div>
  </div>
  <svg ref="loop" class="loop" viewBox="0 0 320 320" role="img" aria-label="休整期、作战阶段、联防阶段循环">
    <defs><marker id="ah" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--accent)"/></marker></defs>
    <circle class="ring" cx="160" cy="160" r="112"/>
    <path class="arc" d="M196,54 A112,112 0 0 1 262,200" marker-end="url(#ah)"/>
    <path class="arc" d="M222,256 A112,112 0 0 1 98,256" marker-end="url(#ah)"/>
    <path class="arc" d="M58,200 A112,112 0 0 1 124,54" marker-end="url(#ah)"/>
    <text class="core" x="160" y="158">每回合</text>
    <text class="core2" x="160" y="180">ROUND LOOP</text>
    <g class="nd"><circle cx="160" cy="48" r="36"/><text x="160" y="46">休整期</text><text class="s" x="160" y="63">招募·升级</text></g>
    <g class="nd"><circle cx="257" cy="216" r="36"/><text x="257" y="214">作战</text><text class="s" x="257" y="231">自动部署</text></g>
    <g class="nd"><circle cx="63" cy="216" r="36"/><text x="63" y="214">联防</text><text class="s" x="63" y="231">清理漏怪</text></g>
    <circle class="mover" r="7"><animateMotion dur="6s" repeatCount="indefinite" path="M160,48 A112,112 0 1 1 159.9,48"/></circle>
  </svg>
</header>

<nav class="top"><div class="wrap" id="nav" @click="navigate">
  <a href="index.html" class="home"><i>◂</i>速查</a>  <a href="#c1" :class="{ on: active === 'c1' }"><i>01</i>入门</a><a href="#c2" :class="{ on: active === 'c2' }"><i>02</i>招募与升本</a><a href="#c3" :class="{ on: active === 'c3' }"><i>03</i>刷怪</a><a href="#c4" :class="{ on: active === 'c4' }"><i>04</i>盟约进阶</a><a href="#c5" :class="{ on: active === 'c5' }"><i>05</i>流派</a><a href="#c6" :class="{ on: active === 'c6' }"><i>06</i>图鉴</a>
</div></nav>


<main class="wrap">
  <section v-for="id in ids" :key="id" class="chap" :id="id" :aria-busy="busy[id] ? 'true' : undefined" :data-loaded="components[id] ? 'true' : undefined">
    <button v-if="errors[id]" type="button" class="btn chapter-retry" @click="backgroundLoad(id)">重新加载本章</button>
    <component v-if="components[id]" :is="components[id]" />
    <Markup v-else :html="placeholders[id]" />
  </section>
</main>
</template>
