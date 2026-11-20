import {shallowRef} from 'vue';
import {
  createRouter,
  createWebHistory,
  type RouteLocationNormalized,
  type RouteRecordRaw,
} from 'vue-router';
import {
  DEFAULT_BUILD_ID,
  DEFAULT_COVENANT_ID,
  LEADERS,
} from '../../data/index.ts';
import {lazyView} from '../lib/ui/lazyView.ts';
import {covenantName, detailFromId} from './entities.ts';
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
  normalizeQuery,
  queryText,
  sameQuery,
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
    path: `${PAGE_PATHS.bd}/:id?`,
    name: 'builds',
    meta: {tab: 'bd'},
    component: builds,
  },
  {
    path: `${PAGE_PATHS.bd}/:id/edit`,
    name: 'build-edit',
    meta: {tab: 'bd'},
    component: builds,
  },
  {
    path: `${PAGE_PATHS.cv}/:id?`,
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
    path: `${PAGE_PATHS.ld}/:id?`,
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
    path: '/box',
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
  if (hash.startsWith('#p=')) return PAGE_PATHS.bd;
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

router.beforeEach((to) => {
  if (to.name === 'box') {
    if (
      queryText(to.query, 'card') &&
      !detailFromId(queryText(to.query, 'card'))
    )
      routeNotice.value = '未找到这张卡片。';
    const boxQuery: Record<string, string> = {};
    if (queryText(to.query, 'import') === '1') boxQuery.import = '1';
    if (queryText(to.query, 'q').trim())
      boxQuery.q = queryText(to.query, 'q').trim().slice(0, 200);
    if (detailFromId(queryText(to.query, 'card')))
      boxQuery.card = queryText(to.query, 'card');
    if (!sameQuery(boxQuery, to.query))
      return {path: to.path, query: boxQuery, hash: to.hash};
    return;
  }
  const tab = to.meta.tab;
  if (!tab) return;
  const id = String(to.params.id ?? '');
  if (tab === 'cv' && (!id || !covenantName(id))) {
    if (id) routeNotice.value = '未找到这个盟约，已打开默认盟约。';
    return {
      path: `${PAGE_PATHS.cv}/${DEFAULT_COVENANT_ID}`,
      query: to.query,
      hash: to.hash,
    };
  }
  if (tab === 'ld' && id && !LEADERS.some((leader) => leader.id === id)) {
    routeNotice.value = '未找到这个 Boss，已返回敌人列表。';
    return {path: PAGE_PATHS.ld, query: to.query, hash: to.hash};
  }
  if (tab === 'bd' && !id)
    return {
      path: `${PAGE_PATHS.bd}/${DEFAULT_BUILD_ID}`,
      query: to.query,
      hash: to.hash,
    };
  if (queryText(to.query, 'card') && !detailFromId(queryText(to.query, 'card')))
    routeNotice.value = '未找到这张卡片。';
  const query = normalizeQuery(tab, to.query, id, to.name === 'build-edit');
  if (tab === 'nu') {
    // 局内抓取成为默认工具时，保留显式的对局速查选择。
    if (
      advisorPreviewEnabled.value &&
      queryText(to.query, 'tool') === 'match-reference'
    )
      query.tool = 'match-reference';
    else if (!advisorPreviewEnabled.value && query.tool === 'advisor')
      delete query.tool;
  }
  // Preserve the caller's push/replace intent while canonicalizing default/empty controls.
  if (!sameQuery(query, to.query)) return {path: to.path, query, hash: to.hash};
});

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
router.onError((_error: unknown, to: RouteLocationNormalized) => {
  navigationError.value = {destination: to.fullPath};
});

export {PAGE_LABELS, PAGE_PATHS, TAB_IDS};
