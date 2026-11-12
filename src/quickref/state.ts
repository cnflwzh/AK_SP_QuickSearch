import { inject, reactive, type InjectionKey } from 'vue';
import { COVENANTS, LEADER } from '../../data/index.ts';

/** 顺序即 Tab 栏从左到右的顺序，左右滑动也按它切换 */
export const TAB_IDS = ['fx', 'bd', 'cv', 'op', 'eq', 'st', 'ld', 'nu'] as const;
export type TabId = typeof TAB_IDS[number];
export type DetailKind = 'op' | 'eq' | 'st';
export interface DetailSelection { kind: DetailKind; name: string }
export interface QuickrefState {
  tab: TabId; covenant: string; build: string; opTier: number; opCovenant: string;
  opElite: boolean; eqTier: number; stCategory: number; calculatorCovenant: string;
  layers: Record<string, number>; mode: number; pickerOpen: boolean;
  /** 领袖页正在看的领袖名；空字符串 = 列表。记住它：一局只有一个领袖，重开页面直接回到详情 */
  leader: string;
  /** 同一局切换领袖时保留所选场地、观察侧与地图模式。 */
  leaderTerrain: string; leaderMapSide: number; leaderMapMode: number;
}
const store = {
  get(key: string): string | null { try { return localStorage.getItem('wsq.' + key); } catch { return null; } },
  set(key: string, value: string): void { try { localStorage.setItem('wsq.' + key, value); } catch { /* Storage may be unavailable in private browsing. */ } },
};
/** 打开分享链接（#p=分享码）时直接进入流派页的导入预览；旧版的“规划”Tab 已并入流派 */
const sharedPlan = typeof location !== 'undefined' && location.hash.startsWith('#p=');
const savedTab = store.get('tab');
const storedTab = sharedPlan || savedTab === 'pl' ? 'bd' : savedTab;
const storedCovenant = store.get('cv') || '乌萨斯';
/** 流派页选中的预设：内置流派名或自建流派 id，找不到时由 planStore 回退到第一套 */
const storedBuild = store.get('bd') || '乌萨斯';
const covenant = COVENANTS[storedCovenant] ? storedCovenant : '乌萨斯';
const storedLeader = store.get('ld') || '';
export const state = reactive<QuickrefState>({
  tab: TAB_IDS.includes(storedTab as TabId) ? storedTab as TabId : 'fx',
  covenant, build: storedBuild,
  opTier: 0, opCovenant: '', opElite: false, eqTier: 0, stCategory: 0,
  calculatorCovenant: COVENANTS[covenant].scaling.length ? covenant : '乌萨斯',
  layers: {}, mode: 1, pickerOpen: false,
  leader: LEADER[storedLeader] ? storedLeader : '',
  leaderTerrain: '01', leaderMapSide: 0, leaderMapMode: 0,
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
