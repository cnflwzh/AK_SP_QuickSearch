<script setup lang="ts">
import {
  markRaw,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  shallowReactive,
  watch,
  type Component,
} from 'vue';
import {SEASON_META, TIERS} from '../../data/index.ts';
import {prefersReducedMotion} from '../lib/ui/dom.ts';
import {whileVisible} from '../lib/ui/visibility.ts';
import {decodeFragment} from '../lib/runtime/url.ts';
import {chapterForAnchor, placeholders} from './placeholders.ts';
import {iconSvg} from './icons.ts';
import Markup from './components/Markup.ts';
import SkipLink from '../lib/ui/SkipLink.vue';
import PwaInstallNotice from '../lib/ui/PwaInstallNotice.vue';
import {MigrationNotice} from '../lib/ui/migrationNotice.ts';
import ViewportSizeBadge from '../lib/ui/ViewportSizeBadge.vue';
import {settings} from '../lib/settings/store.ts';
import {recordDiagnosticError, useComponentErrorDiagnostics} from '../lib/runtime/diagnosticErrors.ts';

useComponentErrorDiagnostics();
const props = defineProps<{
  ready: () => void;
  failed: (error: unknown) => void;
}>();

const chapters = [
  {id: 'c1', no: '01', label: '快速上手'},
  {id: 'c2', no: '02', label: '招募与升本'},
  {id: 'c3', no: '03', label: '敌人与对策'},
  {id: 'c4', no: '04', label: '盟约与叠层'},
  {id: 'c5', no: '05', label: '热门流派'},
  {id: 'c6', no: '06', label: '避坑与实战'},
] as const;

const loaders: Record<string, () => Promise<{default: Component}>> = {
  c1: () => import('./chapters/Basics.vue'),
  c2: () => import('./chapters/Recruit.vue'),
  c3: () => import('./chapters/Enemies.vue'),
  c4: () => import('./chapters/Covenants.vue'),
  c5: () => import('./chapters/Builds.vue'),
  c6: () => import('./chapters/Database.vue'),
};
const ids = chapters.map((item) => item.id);
const components = shallowReactive<Record<string, Component>>({});
const busy = reactive<Record<string, boolean>>({});
const errors = reactive<Record<string, boolean>>({});
const pending = new Map<string, Promise<void>>();
const active = ref('c1');
const loop = ref<SVGSVGElement>();
const navWrap = ref<HTMLElement>();
const navMoreLeft = ref(false);
const navMoreRight = ref(false);

const mnemonics = [
  {
    num: '01',
    title: '资金当回合花光',
    desc: '开战时剩余资金会清零，多余的钱可先买角色存备战席',
  },
  {
    num: '02',
    title: `通常最多上阵 ${SEASON_META.baseDeploymentLimit} 人`,
    desc: `升级商店（1–${TIERS.length} 级）能招募更高阶干员，上阵人数上限不随商店升级提高`,
  },
  {
    num: '03',
    title: `通常 ${SEASON_META.defaultEliteCopies} 张同名合精锐`,
    desc: '合成后免费选一张比当前商店高一阶的干员，奖励最高到顶阶',
  },
  {
    num: '04',
    title: '凑盟约叠层变强',
    desc: '凑齐同阵营人数激活羁绊，层数叠得越高伤害越猛',
  },
];

const cleanup: (() => void)[] = [];
let mounted = true;

function updateNavHints() {
  const el = navWrap.value;
  if (!el) return;
  navMoreLeft.value = el.scrollLeft > 6;
  navMoreRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 6;
}

/** Load each chapter once; failed imports remain retryable without replacing siblings. */
function loadChapter(id: string): Promise<void> {
  const existing = pending.get(id);
  if (existing) return existing;
  if (!loaders[id]) return Promise.resolve();
  busy[id] = true;
  errors[id] = false;
  const task = loaders[id]()
    .then(async (module) => {
      if (!mounted) return;
      components[id] = markRaw(module.default);
      await nextTick();
      busy[id] = false;
    })
    .catch((error: unknown) => {
      pending.delete(id);
      busy[id] = false;
      errors[id] = true;
      recordDiagnosticError(`教程章节加载失败（${id}）`, error);
      console.error('Chapter initialization failed', id, error);
      throw error;
    });
  pending.set(id, task);
  return task;
}

function hashSection(hash: string) {
  const anchor = decodeFragment(hash);
  const rendered = document
    .getElementById(anchor)
    ?.closest<HTMLElement>('.chap');
  if (rendered) return rendered;
  const chapter = chapterForAnchor(anchor);
  return chapter ? document.getElementById(chapter) : null;
}

function revealAnchor(hash: string) {
  if (location.hash !== hash) return;
  const target = document.getElementById(decodeFragment(hash));
  if (!target) return;
  // 旧书签可能指向改版后收在折叠表内的图表或筛选器。
  for (
    let fold = target.closest('details');
    fold;
    fold = fold.parentElement?.closest('details') ?? null
  ) {
    fold.open = true;
  }
  target.scrollIntoView({behavior: 'instant'});
}

const backgroundLoad = (id: string) => {
  void loadChapter(id).catch(() => {});
};

function navigate(event: MouseEvent) {
  const link = (event.target as Element).closest<HTMLAnchorElement>(
    'a[href^="#"]',
  );
  const section = link && hashSection(link.hash);
  if (section) backgroundLoad(section.id);
}

watch(active, (id) => {
  const bar = navWrap.value;
  const current = bar?.querySelector<HTMLElement>(`a[href="#${id}"]`);
  if (!bar || !current) return;
  const targetLeft =
    current.offsetLeft - (bar.clientWidth - current.offsetWidth) / 2;
  bar.scrollTo({
    left: Math.max(0, targetLeft),
    behavior: prefersReducedMotion() ? 'instant' : 'smooth',
  });
});

onMounted(async () => {
  const sections = Array.from(document.querySelectorAll<HTMLElement>('.chap'));
  const updateActiveSection = () => {
    const pivot = innerHeight * 0.28;
    let current = sections[0]?.id ?? 'c1';
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= pivot) current = section.id;
      else break;
    }
    active.value = current;
  };
  const nearby = new IntersectionObserver(
    (entries) => {
      for (const entry of entries)
        if (entry.isIntersecting) {
          nearby.unobserve(entry.target);
          backgroundLoad(entry.target.id);
        }
    },
    {rootMargin: '320px 0px'},
  );
  const initial = new Set<HTMLElement>();
  const initialHash = location.hash;
  const target = hashSection(initialHash);
  if (target) initial.add(target);
  sections.forEach((section) => {
    const rect = section.getBoundingClientRect();
    if (rect.top < innerHeight + 280 && rect.bottom > -280)
      initial.add(section);
    else nearby.observe(section);
  });
  const onHash = () => {
    const hash = location.hash;
    const section = hashSection(hash);
    if (!section) return;
    void loadChapter(section.id)
      .then(() => revealAnchor(hash))
      .catch(() => {});
  };
  addEventListener('scroll', updateActiveSection, {passive: true});
  addEventListener('resize', updateNavHints, {passive: true});
  addEventListener('hashchange', onHash);
  updateNavHints();
  updateActiveSection();
  cleanup.push(() => {
    nearby.disconnect();
    removeEventListener('scroll', updateActiveSection);
    removeEventListener('resize', updateNavHints);
    removeEventListener('hashchange', onHash);
  });
  if (loop.value) {
    const svg = loop.value;
    svg.pauseAnimations();
    cleanup.push(
      whileVisible(svg, () => {
        if (!prefersReducedMotion()) svg.unpauseAnimations();
        return () => svg.pauseAnimations();
      }),
    );
  }
  try {
    await Promise.all([...initial].map((section) => loadChapter(section.id)));
    await nextTick();
    if (target) revealAnchor(initialHash);
    updateNavHints();
    updateActiveSection();
    props.ready();
  } catch (error) {
    props.failed(error);
  }
});

onBeforeUnmount(() => {
  mounted = false;
  cleanup.forEach((dispose) => dispose());
});
</script>
<template>
  <SkipLink target-id="guide-content" sticky-header="nav.top" />
  <ViewportSizeBadge v-if="settings.developerMode" />
  <header class="wrap hero" @click="navigate">
    <div class="hero-main">
      <div class="kicker">ARKNIGHTS · STRONGHOLD PROTOCOL</div>
      <h1>
        卫戍协议
        <span>{{ SEASON_META.guideSubtitle }} · 零基础图解教程</span>
      </h1>
      <p class="hero-lead">
        《卫戍协议》是《明日方舟》中的
        <b>回合制策略防守玩法</b>
        （可单人不限时慢玩，也可 4 人组队合作）。每回合先在商店
        <b>花资金招募角色（干员）、穿装备、摆站位</b>
        ；开战后角色
        <b>全自动上场打怪</b>
        ，守住防线并击败最终首领即可获胜。
      </p>

      <div class="mnemo-panel" aria-label="四大核心口诀">
        <div v-for="item in mnemonics" :key="item.num" class="mnemo-item">
          <span class="mnemo-num">{{ item.num }}</span>
          <div>
            <strong>{{ item.title }}</strong>
            <span>{{ item.desc }}</span>
          </div>
        </div>
      </div>

      <div class="hero-actions">
        <a href="#c1" class="btn p hero-cta">开始 3 分钟入门 ▾</a>
        <a href="/index.html" class="btn hero-cta">
          打开局内速查
          <Markup :html="iconSvg('link', 'g-ic sm')" />
        </a>
        <a href="/diff.html" class="btn hero-cta">赛季更新对比</a>
      </div>
    </div>

    <div class="hero-loop-stage">
      <svg
        ref="loop"
        class="loop"
        viewBox="0 0 380 368"
        role="img"
        aria-label="每回合休整期、作战阶段、联防阶段循环示意">
        <defs>
          <marker
            id="ah"
            viewBox="0 0 10 10"
            refX="5"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--accent)" />
          </marker>
        </defs>
        <circle class="ring" cx="190" cy="192" r="122" />
        <path
          class="arc"
          d="M251,86 A122,122 0 0 1 312,192"
          marker-end="url(#ah)" />
        <path
          class="arc"
          d="M251,298 A122,122 0 0 1 129,298"
          marker-end="url(#ah)" />
        <path
          class="arc"
          d="M68,192 A122,122 0 0 1 129,86"
          marker-end="url(#ah)" />

        <circle class="mover" r="6">
          <animateMotion
            dur="6.5s"
            repeatCount="indefinite"
            path="M190,70 A122,122 0 1 1 189.9,70" />
        </circle>

        <circle class="core-bg" cx="190" cy="192" r="46" />
        <text class="core" x="190" y="188">每回合</text>
        <text class="core2" x="190" y="206">ROUND LOOP</text>

        <g class="nd">
          <circle cx="190" cy="70" r="54" />
          <text class="step-tag" x="190" y="48">STEP 1</text>
          <text class="nd-title" x="190" y="70">休整期</text>
          <text class="s" x="190" y="90">发钱 · 买牌 · 布阵</text>
        </g>
        <g class="nd">
          <circle cx="296" cy="253" r="54" />
          <text class="step-tag" x="296" y="231">STEP 2</text>
          <text class="nd-title" x="296" y="253">作战阶段</text>
          <text class="s" x="296" y="273">自动登场 · 放技能</text>
        </g>
        <g class="nd">
          <circle cx="84" cy="253" r="54" />
          <text class="step-tag" x="84" y="231">STEP 3</text>
          <text class="nd-title" x="84" y="253">联防阶段</text>
          <text class="s" x="84" y="273">联机帮清漏怪</text>
        </g>
      </svg>
    </div>
  </header>

  <nav class="top" aria-label="教程章节">
    <div
      :class="['nav-shell', {'more-l': navMoreLeft, 'more-r': navMoreRight}]">
      <div
        ref="navWrap"
        class="wrap"
        id="nav"
        @click="navigate"
        @scroll.passive="updateNavHints">
        <a href="/index.html" class="home">
          <i>◂</i>
          速查页
        </a>
        <a
          v-for="chap in chapters"
          :key="chap.id"
          :href="`#${chap.id}`"
          :class="{on: active === chap.id}"
          :aria-current="active === chap.id ? 'location' : undefined">
          <i>{{ chap.no }}</i>
          {{ chap.label }}
        </a>
      </div>
    </div>
  </nav>

  <main id="guide-content" class="wrap" tabindex="-1" aria-label="图解教程内容">
    <component :is="MigrationNotice" v-if="MigrationNotice" />
    <PwaInstallNotice />
    <section
      v-for="id in ids"
      :key="id"
      class="chap"
      :id="id"
      :aria-busy="busy[id] ? 'true' : undefined"
      :data-loaded="components[id] ? 'true' : undefined">
      <button
        v-if="errors[id]"
        type="button"
        class="btn chapter-retry"
        @click="backgroundLoad(id)">
        重新加载本章
      </button>
      <component v-if="components[id]" :is="components[id]" />
      <!-- 占位内容是随包发布的静态 HTML；章节加载后整块替换。 -->
      <div v-else style="display: contents" v-html="placeholders[id]"></div>
    </section>
  </main>
</template>
