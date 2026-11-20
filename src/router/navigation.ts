import { computed } from 'vue';
import type { LocationQuery, LocationQueryRaw, RouteLocationRaw } from 'vue-router';
import { DEFAULT_BUILD_ID, DEFAULT_COVENANT_ID, LEADER } from '../../data/index.ts';
import { router, tabLocations } from './index.ts';
import { PAGE_PATHS, queryText, sameQuery, type TabId } from './location.ts';
import { buildId, covenantId, detailId, type DetailKind } from './entities.ts';

export const currentRoute = router.currentRoute;
export const routeQuery = computed(() => currentRoute.value.query);

// 详情卡互相切换不会改变列表里任何卡片链接，保留背景引用以免整份图鉴重绘。
const cardBackground = computed<{path: string; query: LocationQuery; hash: string}>((previous) => {
  const {path, hash, query: {card: _card, ...query}} = currentRoute.value;
  if (previous && previous.path === path && previous.hash === hash && sameQuery(previous.query, query))
    return previous;
  return {path, query, hash};
});

/** Navigation errors are displayed by the app shell, including offline/expired lazy chunks. */
export async function navigate(to: RouteLocationRaw, replace = false): Promise<void> {
  try { await (replace ? router.replace(to) : router.push(to)); } catch { /* router.onError supplies recovery UI. */ }
}

/** Change a group of controls atomically; null removes a parameter. Continuous inputs use replace. */
export function updateQuery(changes: LocationQueryRaw, replace = false): Promise<void> {
  const route = currentRoute.value;
  const query: LocationQueryRaw = { ...route.query };
  for (const [key, value] of Object.entries(changes)) {
    if (value == null) delete query[key];
    else query[key] = value;
  }
  return navigate({ path: route.path, query, hash: route.hash }, replace);
}

export function tabLocation(tab: TabId): string {
  const previousLocation = tabLocations.value[tab];
  if (previousLocation) return previousLocation;
  if (tab === 'bd') return `${PAGE_PATHS.bd}/${DEFAULT_BUILD_ID}`;
  if (tab === 'cv') return `${PAGE_PATHS.cv}/${DEFAULT_COVENANT_ID}`;
  return PAGE_PATHS[tab];
}
export function buildLocation(key: string, edit = false): string {
  return `${PAGE_PATHS.bd}/${encodeURIComponent(buildId(key))}${edit ? '/edit' : ''}`;
}
export function covenantLocation(name: string): string {
  return `${PAGE_PATHS.cv}/${covenantId(name)}`;
}
export function leaderLocation(name: string): string {
  return LEADER[name] ? `${PAGE_PATHS.ld}/${LEADER[name].id}` : PAGE_PATHS.ld;
}
/** Shared by real anchors and programmatic navigation so modified clicks retain the same state. */
export function leaderDestination(name: string) {
  const query = currentRoute.value.meta.tab === 'ld'
    ? { ...routeQuery.value, round: null, skill: null, card: null, q: null }
    : { difficulty: routeQuery.value.difficulty };
  return { path: leaderLocation(name), query };
}
export function cardLocation(kind: DetailKind, name: string) {
  const route = cardBackground.value;
  return { path: route.path, query: { ...route.query, card: detailId(kind, name) }, hash: route.hash };
}

/** Mark only entries opened inside this tab. A shared/direct URL must never close by leaving the site. */
export function openCard(kind: DetailKind, name: string): Promise<void> {
  if (!detailId(kind, name)) return Promise.resolve();
  const replacingCard = !!queryText(routeQuery.value, 'card');
  const location = cardLocation(kind, name);
  return navigate({ ...location, state: { cardOpenedHere: replacingCard ? history.state?.cardOpenedHere === true : true } }, replacingCard);
}
export function closeCard(): void {
  if (!queryText(routeQuery.value, 'card')) return;
  if (history.state?.cardOpenedHere === true) router.back();
  else void updateQuery({ card: null }, true);
}
