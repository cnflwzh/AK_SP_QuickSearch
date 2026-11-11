import { inject, reactive, type InjectionKey } from 'vue';
import { COVENANTS, BUILD_NAMES, LEADER } from '../../data/index.ts';

export const TAB_IDS = ['cv', 'op', 'eq', 'st', 'ld', 'bd', 'pl', 'nu'] as const;
export type TabId = typeof TAB_IDS[number];
export type DetailKind = 'op' | 'eq' | 'st';
export interface DetailSelection { kind: DetailKind; name: string }
export interface QuickrefState {
  tab: TabId; covenant: string; build: string; opTier: number; opCovenant: string;
  opElite: boolean; eqTier: number; stCategory: number; calculatorCovenant: string;
  layers: Record<string, number>; mode: number; pickerOpen: boolean;
  /** 领袖页正在看的领袖名；空字符串 = 列表。记住它：一局只有一个领袖，重开页面直接回到详情 */
  leader: string;
}
const store = {
  get(key: string): string | null { try { return localStorage.getItem('wsq.' + key); } catch { return null; } },
  set(key: string, value: string): void { try { localStorage.setItem('wsq.' + key, value); } catch { /* Storage may be unavailable in private browsing. */ } },
};
/** 打开分享链接（#p=分享码）时直接进入规划页 */
const sharedPlan = typeof location !== 'undefined' && location.hash.startsWith('#p=');
const storedTab = sharedPlan ? 'pl' : store.get('tab');
const storedCovenant = store.get('cv') || '乌萨斯';
const storedBuild = store.get('bd') || '乌萨斯';
const covenant = COVENANTS[storedCovenant] ? storedCovenant : '乌萨斯';
const storedLeader = store.get('ld') || '';
export const state = reactive<QuickrefState>({
  tab: TAB_IDS.includes(storedTab as TabId) ? storedTab as TabId : 'cv',
  covenant, build: BUILD_NAMES.includes(storedBuild) ? storedBuild : '乌萨斯',
  opTier: 0, opCovenant: '', opElite: false, eqTier: 0, stCategory: 0,
  calculatorCovenant: COVENANTS[covenant].scaling.length ? covenant : '乌萨斯',
  layers: {}, mode: 1, pickerOpen: false,
  leader: LEADER[storedLeader] ? storedLeader : '',
});
/** Updates the selected covenant and remembers it; scalable covenants also prime the calculator. */
export function setCovenant(name: string): void {
  if (!COVENANTS[name]) return;
  state.covenant = name; state.pickerOpen = false; store.set('cv', name);
  if (COVENANTS[name].scaling.length) state.calculatorCovenant = name;
}
export function setBuild(name: string): void { state.build = name; store.set('bd', name); }
export function setTab(id: TabId): void { state.tab = id; store.set('tab', id); }
export function setLeader(name: string): void { state.leader = LEADER[name] ? name : ''; store.set('ld', state.leader); }
/** Navigation is supplied by the app so cards retain native Vue event handlers. */
export interface QuickrefActions {
  openDetail(kind: DetailKind, name: string): void;
  openCovenant(name: string): Promise<void>;
  openBuild(name: string): Promise<void>;
  openLeader(name: string): Promise<void>;
  pickCovenant(name: string): Promise<void>;
  closeDetail(): void;
}
export const quickrefActionsKey: InjectionKey<QuickrefActions> = Symbol('quickref-actions');
export function useQuickrefActions(): QuickrefActions {
  const actions = inject(quickrefActionsKey);
  if (!actions) throw new Error('Quickref actions must be used inside QuickrefApp.');
  return actions;
}
