import { shallowRef } from 'vue';
import { createRouter, createWebHistory, type RouteLocationNormalized, type RouteRecordRaw } from 'vue-router';
import { LEADERS } from '../../data/index.ts';
import { covenantName, detailFromId } from './entities.ts';
import { PAGE_LABELS, PAGE_PATHS, TAB_IDS, normalizeQuery, queryText, sameQuery, type TabId } from './location.ts';

declare module 'vue-router' {
  interface RouteMeta {
    tab?: TabId;
  }
}

const catalog = () => import('../quickref/views/CatalogView.vue');
const builds = () => import('../quickref/views/BuildsView.vue');
const routes: RouteRecordRaw[] = [
  { path: '/', alias: ['/index', '/index.html'], redirect: to => {
    const entry = router.resolve(entryPath(to.hash));
    return { path: entry.path, query: { ...entry.query, ...to.query }, hash: to.hash };
  } },
  { path: '/overview', name: 'overview', meta: { tab: 'fx' }, component: () => import('../quickref/views/EffectsView.vue') },
  { path: '/builds/:id?', name: 'builds', meta: { tab: 'bd' }, component: builds },
  { path: '/builds/:id/edit', name: 'build-edit', meta: { tab: 'bd' }, component: builds },
  { path: '/covenants/:id?', name: 'covenants', meta: { tab: 'cv' }, component: () => import('../quickref/views/CovenantsView.vue') },
  { path: '/operators', name: 'operators', meta: { tab: 'op' }, component: catalog, props: { kind: 'op' } },
  { path: '/equipment', name: 'equipment', meta: { tab: 'eq' }, component: catalog, props: { kind: 'eq' } },
  { path: '/strategies', name: 'strategies', meta: { tab: 'st' }, component: catalog, props: { kind: 'st' } },
  { path: '/leaders/:id?', name: 'leaders', meta: { tab: 'ld' }, component: () => import('../quickref/views/LeadersView.vue') },
  { path: '/numbers', name: 'numbers', meta: { tab: 'nu' }, component: () => import('../quickref/views/NumbersView.vue') },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('../quickref/views/NotFoundView.vue') },
];

/** Only the legacy entry restores a preference; explicit URLs always use deterministic defaults. */
function entryPath(hash: string): string {
  if (hash.startsWith('#p=')) return '/builds';
  try {
    const saved = localStorage.getItem('wsq.location');
    if (saved && TAB_IDS.some(tab => saved === PAGE_PATHS[tab] || saved.startsWith(PAGE_PATHS[tab] + '/') || saved.startsWith(PAGE_PATHS[tab] + '?'))) return saved;
    const oldTab = localStorage.getItem('wsq.tab');
    if (TAB_IDS.includes(oldTab as TabId)) return PAGE_PATHS[oldTab as TabId];
  } catch { /* A blocked storage API does not prevent navigation. */ }
  return '/overview';
}

export const navigationError = shallowRef<{ destination: string } | null>(null);
export const routeNotice = shallowRef('');
let pendingTabScroll: { destination: string; top: number } | undefined;
export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(to, from, savedPosition) {
    // History restoration should be immediate, regardless of the document's smooth-scroll style.
    if (savedPosition) return { ...savedPosition, behavior: 'instant' };
    if (to.meta.tab === from.meta.tab) return false;
    if (!from.name) return { top: 0 };
    return pendingTabScroll?.destination === to.fullPath ? { top: pendingTabScroll.top } : false;
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
  const top = Math.max(0, view.getBoundingClientRect().top + scrollY - (document.getElementById('qbar')?.offsetHeight ?? 0) - 4);
  if (scrollY > top) pendingTabScroll = { destination: to.fullPath, top };
});

router.beforeEach(to => {
  const tab = to.meta.tab;
  if (!tab) return;
  const id = String(to.params.id ?? '');
  if (tab === 'cv' && (!id || !covenantName(id))) {
    if (id) routeNotice.value = '未找到这个盟约，已打开默认盟约。';
    return { path: '/covenants/ursus', query: to.query, hash: to.hash };
  }
  if (tab === 'ld' && id && !LEADERS.some(leader => leader.id === id)) {
    routeNotice.value = '未找到这个领袖，已返回领袖列表。';
    return { path: '/leaders', query: to.query, hash: to.hash };
  }
  if (tab === 'bd' && !id) return { path: '/builds/yan', query: to.query, hash: to.hash };
  if (queryText(to.query, 'card') && !detailFromId(queryText(to.query, 'card'))) routeNotice.value = '未找到这张卡片。';
  const query = normalizeQuery(tab, to.query, id, to.name === 'build-edit');
  // Preserve the caller's push/replace intent while canonicalizing default/empty controls.
  if (!sameQuery(query, to.query)) return { path: to.path, query, hash: to.hash };
});

/** Most-recent locations are per-session navigation conveniences, never overrides for external links. */
export const tabLocations = shallowRef<Partial<Record<TabId, string>>>({});
router.afterEach((to, _from, failure) => {
  if (failure) return;
  navigationError.value = null;
  const tab = to.meta.tab;
  if (!tab) return;
  const { card: _card, q: _query, ...backgroundQuery } = to.query;
  const background = router.resolve({ path: to.path, query: backgroundQuery }).fullPath;
  tabLocations.value = { ...tabLocations.value, [tab]: background };
  try { localStorage.setItem('wsq.location', background); } catch { /* Optional preference. */ }
});
router.onError((_error: unknown, to: RouteLocationNormalized) => {
  navigationError.value = { destination: to.fullPath };
});

export { PAGE_LABELS, PAGE_PATHS, TAB_IDS };
