/** 速查页的界面状态。tab / cv / bd 会记在 localStorage，下次打开时恢复 */
import { COVENANTS } from '../../data/index.js';

const PREFIX = 'wsq.';

export const store = {
  get(key) {
    try { return localStorage.getItem(PREFIX + key); } catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(PREFIX + key, value); } catch { /* 隐私模式等情况下忽略 */ }
  },
};

export const TAB_IDS = ['cv', 'op', 'eq', 'st', 'bd', 'nu'];

export const state = {
  tab: store.get('tab') || 'cv',
  covenant: store.get('cv') || '乌萨斯',   // 盟约页当前盟约
  build: store.get('bd') || '乌萨斯',      // 流派页当前流派
  opTier: 0,                               // 干员页：0 = 全部等阶
  opCovenant: '',                          // 干员页：'' = 全部盟约
  opElite: false,                          // 干员页：显示精锐特质
  eqTier: 0,                               // 装备页
  stCategory: 0,                           // 策略页：STRATEGY_CATEGORIES 下标
  calculatorCovenant: '乌萨斯',             // 数值页计算器当前盟约
  layers: {},                              // 数值页计算器：盟约名 → 层数
  mode: 1,                                 // 数值页：MODES 下标
};

if (!TAB_IDS.includes(state.tab)) state.tab = 'cv';
if (!COVENANTS[state.covenant]) state.covenant = '乌萨斯';
if (COVENANTS[state.covenant].scaling.length) state.calculatorCovenant = state.covenant;

/** 修改状态并按需持久化 */
export function setCovenant(name) {
  state.covenant = name;
  store.set('cv', name);
  // 局内从盟约页切到数值页时直接算当前盟约，省去再次选择。
  if (COVENANTS[name].scaling.length) state.calculatorCovenant = name;
}
export function setBuild(name) { state.build = name; store.set('bd', name); }
export function setTab(id) { state.tab = id; store.set('tab', id); }
