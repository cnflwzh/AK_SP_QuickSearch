import { computed, inject, reactive, type InjectionKey } from 'vue';
import { LEADERS } from '../../data/index.ts';
import { COVENANT_IDS, buildKey, covenantName, type DetailKind } from '../router/entities.ts';
import { CATEGORY_IDS, DIFFICULTIES, TRIGGER_IDS, TYPE_IDS, idForLabel, queryText, type TabId } from '../router/location.ts';
import { buildLocation, covenantLocation, currentRoute, leaderDestination, navigate, routeQuery, tabLocation, updateQuery } from '../router/navigation.ts';

export { TAB_IDS, type TabId } from '../router/location.ts';
export type { DetailKind, DetailSelection } from '../router/entities.ts';

/**
 * Presentation adapter for existing quick-reference controls.
 * URL-owned values are computed, not copied into a second mutable store.
 * Saved plans and the active game belong to planStore; the picker is transient UI only.
 */
const text = (key: string) => queryText(routeQuery.value, key);
function indexControl(key: string, values: readonly string[], fallback = 0) {
  return computed({
    get: () => Math.max(0, values.indexOf(text(key) || values[fallback])),
    set: (index: number) => { void updateQuery({ [key]: values[index] || null }); },
  });
}
function labelControl(key: string, labels: Readonly<Record<string, string>>) {
  return computed({
    get: () => labels[text(key)] ?? '',
    set: (label: string) => { void updateQuery({ [key]: idForLabel(labels, label) || null }); },
  });
}
export const state = reactive({
  tab: computed(() => currentRoute.value.meta.tab ?? 'fx'),
  covenant: computed(() => covenantName(String(currentRoute.value.params.id ?? '')) || '乌萨斯'),
  build: computed(() => buildKey(String(currentRoute.value.params.id ?? 'yan'))),
  opTier: computed({
    get: () => Number(text('tier')) || 0,
    set: (tier: number) => { void updateQuery({ tier: tier || null }); },
  }),
  opCovenant: labelControl('covenant', COVENANT_IDS),
  opTrigger: labelControl('trigger', TRIGGER_IDS),
  opType: labelControl('type', TYPE_IDS),
  opElite: computed({
    get: () => text('elite') === '1',
    set: (elite: boolean) => { void updateQuery({ elite: elite ? '1' : null }); },
  }),
  eqTier: computed({
    get: () => text('group') === 'combo' ? 7 : Number(text('tier')) || 0,
    set: (tier: number) => { void updateQuery({ group: tier === 7 ? 'combo' : null, tier: tier === 7 ? null : tier || null }); },
  }),
  stCategory: indexControl('category', CATEGORY_IDS),
  mode: indexControl('difficulty', DIFFICULTIES, 1),
  leader: computed(() => LEADERS.find(leader => leader.id === currentRoute.value.params.id)?.name ?? ''),
  leaderTerrain: computed({
    get: () => text('map') || '01',
    set: (id: string) => { void updateQuery({ map: id }); },
  }),
  leaderMapSide: indexControl('side', ['left', 'all', 'right']),
  leaderMapMode: indexControl('view', ['layout', 'routes']),
  pickerOpen: false,
});

/** Select a covenant in place; desktop keeps its sidebar and scroll position. */
export function setCovenant(name: string): Promise<void> {
  state.pickerOpen = false;
  return navigate(covenantLocation(name));
}
export function setBuild(key: string): Promise<void> {
  return navigate(buildLocation(key));
}
export function setTab(tab: TabId): Promise<void> {
  return navigate(tabLocation(tab));
}
export function setLeader(name: string): Promise<void> {
  return navigate(leaderDestination(name));
}

/** Navigation is supplied by the app so reusable cards also work inside the detail dialog. */
export interface QuickrefActions {
  openDetail(kind: DetailKind, name: string): void;
  openCovenant(name: string): Promise<void>;
  openBuild(name: string): Promise<void>;
  openLeader(name: string): Promise<void>;
  pickCovenant(name: string): Promise<void>;
  closeDetail(): void;
}
export const quickrefActionsKey: InjectionKey<QuickrefActions> = Symbol.for('wsq.quickref-actions');
export function useQuickrefActions(): QuickrefActions {
  const actions = inject(quickrefActionsKey);
  if (!actions) throw new Error('Quickref actions must be used inside QuickrefApp.');
  return actions;
}
