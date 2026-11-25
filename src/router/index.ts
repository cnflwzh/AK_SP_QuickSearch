import {shallowRef} from 'vue';
import {
  createRouter,
  createWebHistory,
  type RouteLocationNormalized,
  type RouteRecordRaw,
} from 'vue-router';
import {lazyView} from '../lib/ui/lazyView.ts';
import {recordDiagnosticError} from '../lib/runtime/diagnosticErrors.ts';
import {isPlanShareHash} from '../lib/plans/shareInput.ts';
import {canonicalRoute} from './guard.ts';
import {BOX_PATH, BUILD_DETAIL_PATH, BUILD_EDIT_PATH, COVENANT_DETAIL_PATH, ENEMY_DETAIL_PATH} from './paths.ts';
import {
  settings,
  visibleContentTabs,
  type ContentTabId,
} from '../lib/settings/index.ts';
import {advisorPreviewEnabled} from '../quickref/experimentalFeatures.ts';
import {
  PAGE_LABELS,
  PAGE_PATHS,
  TAB_IDS,
  type TabId,
} from './location.ts';

declare module 'vue-router' {
  interface RouteMeta {
    tab?: TabId;
    /** 受窗口大小限制的页面名称，同时用于提示和文档标题。 */
    regularWindowTitle?: string;
  }
}

const catalog = () => import('../quickref/views/CatalogView.vue');
const builds = () => import('../quickref/views/BuildsView.vue');
const boxContent = lazyView(() => import('../quickref/numbers/BoxTools.vue'));
const settingsContent = lazyView(
  () => import('../quickref/views/SettingsView.vue'),
);
const regularWindowView = () =>
  import('../quickref/views/RegularWindowView.vue');
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    alias: ['/index', '/index.html'],
    redirect: (to) => {
      const {buildPath, ...query} = to.query;
      if (
        typeof buildPath === 'string' &&
        /^\/builds\/[^/?#]+(?:\/edit)?$/.test(buildPath)
      ) {
        return {path: buildPath, query, hash: to.hash};
      }
      const entry = router.resolve(entryPath(to.hash));
      return {
        path: entry.path,
        query: {...entry.query, ...to.query},
        hash: to.hash,
      };
    },
  },
  {
    path: PAGE_PATHS.fx,
    name: 'overview',
    meta: {tab: 'fx'},
    component: () => import('../quickref/views/EffectsView.vue'),
  },
  {
    path: BUILD_DETAIL_PATH + '?',
    name: 'builds',
    meta: {tab: 'bd'},
    component: builds,
  },
  {
    path: BUILD_EDIT_PATH,
    name: 'build-edit',
    meta: {tab: 'bd'},
    component: builds,
  },
  {
    path: COVENANT_DETAIL_PATH + '?',
    name: 'covenants',
    meta: {tab: 'cv'},
    component: () => import('../quickref/views/CovenantsView.vue'),
  },
  {
    path: PAGE_PATHS.op,
    name: 'operators',
    meta: {tab: 'op'},
    component: catalog,
    props: {kind: 'op'},
  },
  {
    path: PAGE_PATHS.eq,
    name: 'equipment',
    meta: {tab: 'eq'},
    component: catalog,
    props: {kind: 'eq'},
  },
  {
    path: PAGE_PATHS.st,
    name: 'strategies',
    meta: {tab: 'st'},
    component: catalog,
    props: {kind: 'st'},
  },
  {
    path: ENEMY_DETAIL_PATH + '?',
    name: 'enemies',
    meta: {tab: 'ld'},
    component: () => import('../quickref/views/EnemiesView.vue'),
  },
  {
    path: PAGE_PATHS.nu,
    name: 'tools',
    meta: {tab: 'nu'},
    component: () => import('../quickref/views/ToolsView.vue'),
  },
  {
    path: BOX_PATH,
    name: 'box',
    meta: {regularWindowTitle: '我的 Box'},
    component: regularWindowView,
    props: {content: boxContent},
  },
  {
    path: PAGE_PATHS.se,
    name: 'settings',
    meta: {tab: 'se', regularWindowTitle: PAGE_LABELS.se},
    component: regularWindowView,
    props: {content: settingsContent},
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('../quickref/views/RouteStatusView.vue'),
  },
];

/** Only the legacy entry restores a preference; explicit URLs always use deterministic defaults. */
function entryPath(hash: string): string {
  if (isPlanShareHash(hash)) return PAGE_PATHS.bd;
  if (hash.startsWith('#b=')) return '/box';
  const visible = visibleContentTabs();
  const fallback = PAGE_PATHS[visible[0] ?? 'fx'];
  if (
    settings.defaultTab !== 'last' &&
    !settings.hiddenTabs.includes(settings.defaultTab)
  ) {
    return PAGE_PATHS[settings.defaultTab];
  }
  try {
    const saved = localStorage.getItem('wsq.location');
    if (
      saved &&
      visible.some(
        (tab) =>
          saved === PAGE_PATHS[tab] ||
          saved.startsWith(PAGE_PATHS[tab] + '/') ||
          saved.startsWith(PAGE_PATHS[tab] + '?'),
      )
    )
      return saved;
    const oldTab = localStorage.getItem('wsq.tab') as ContentTabId | null;
    if (oldTab && visible.includes(oldTab)) return PAGE_PATHS[oldTab];
  } catch {
    /* A blocked storage API does not prevent navigation. */
  }
  return fallback;
}

export const navigationError = shallowRef<{destination: string} | null>(null);
export const routeNotice = shallowRef('');
let pendingTabScroll: {destination: string; top: number} | undefined;
export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(to, from, savedPosition) {
    // History restoration should be immediate, regardless of the document's smooth-scroll style.
    if (savedPosition) return {...savedPosition, behavior: 'instant'};
    if (to.meta.tab === from.meta.tab) return false;
    if (!from.name) return {top: 0};
    return pendingTabScroll?.destination === to.fullPath
      ? {top: pendingTabScroll.top}
      : false;
  },
});

// Measure the unchanged shell after lazy code loads, before Vue replaces the old view.
// Even reading scrollY after that replacement would synchronously lay out the new catalogue.
router.beforeResolve((to, from) => {
  pendingTabScroll = undefined;
  if (!from.name || to.meta.tab === from.meta.tab) return;
  const scrollY = window.scrollY;
  if (scrollY === 0) return;
  const view = document.getElementById('view');
  if (!view) return;
  const top = Math.max(
    0,
    view.getBoundingClientRect().top +
      scrollY -
      (document.getElementById('qbar')?.offsetHeight ?? 0) -
      4,
  );
  if (scrollY > top) pendingTabScroll = {destination: to.fullPath, top};
});

router.beforeEach((to) => canonicalRoute(to, advisorPreviewEnabled.value, (notice) => {
  routeNotice.value = notice;
}));

/** Most-recent locations are per-session navigation conveniences, never overrides for external links. */
export const tabLocations = shallowRef<Partial<Record<TabId, string>>>({});
router.afterEach((to, from, failure) => {
  if (failure) return;
  navigationError.value = null;
  const tab = to.meta.tab;
  if (!tab) return;
  const {card: _card, q: _query, ...backgroundQuery} = to.query;
  const background = router.resolve({
    path: to.path,
    query: backgroundQuery,
  }).fullPath;
  if (tabLocations.value[tab] !== background)
    tabLocations.value = {...tabLocations.value, [tab]: background};
  else if (from.meta.tab === tab) return;
  if (tab !== 'se') {
    try {
      localStorage.setItem('wsq.location', background);
    } catch {
      /* Optional preference. */
    }
  }
});
router.onError((error: unknown, to: RouteLocationNormalized) => {
  recordDiagnosticError(`切换页面失败（${to.path}）`, error);
  navigationError.value = {destination: to.fullPath};
});

export {PAGE_LABELS, PAGE_PATHS, TAB_IDS};
