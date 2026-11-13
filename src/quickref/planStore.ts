/**
 * 流派预设：内置流派 + 我的流派，编辑即规划。
 *
 * - 内置流派第一次编辑时存一份修改版（Plan.base = 内置流派名），之后列表里由修改版代替；
 *   改回和内置一样时自动丢弃，也可以手动恢复默认。
 * - “本局”：玩家开局前选一套要打的流派；盟约 / 效果 / 干员各页据此高亮。
 * - 本局被 ban 的盟约由玩家自己勾，只用于给出替代方案。
 */
import { computed, reactive, ref, watch } from 'vue';
import { BUILD_NAMES, CORE_BUILDS, ALL_COVENANTS } from '../../data/index.ts';
import { color } from './format.ts';
import { blankPlan, builtinPlan, covenantStats, loadPlans, newId, samePlan, savePlans, type CovenantStat, type Plan } from '../lib/planner.ts';
import { mergePlanBackup, type PlanBackupMerge } from '../lib/planBackup.ts';
// The route adapter selects a preset; this store does not depend on the browser router.
const selectedPresetKey = ref(BUILD_NAMES[0]);

/** 用户的方案：自建流派和内置流派的修改版 */
// 旧版规划页会自动建一个空的“我的阵容”，没动过的就不带进流派列表
export const plans = reactive<Plan[]>(loadPlans().filter(p => p.ops.length || p.note || p.strategy || Object.keys(p.layers).length || p.base || p.name !== '我的阵容'));

/* ---------- 存档：连续修改合并写入，离页时立即落盘 ---------- */
export const saveError = ref(false);
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let dirty = false;
export function flushSave(force = false): void {
  clearTimeout(saveTimer); saveTimer = undefined;
  if (!dirty && !force) return;
  const saved = savePlans(plans); saveError.value = !saved; dirty = !saved;
}
function scheduleSave(): void { dirty = true; clearTimeout(saveTimer); saveTimer = setTimeout(flushSave, 250); }
const stopSaving = watch(plans, scheduleSave, { deep: true });
// 离页事件可能先于 Vue 的批量 watch 执行，直接保存当前数据，避免漏掉最后一次修改。
const saveOnExit = (): void => flushSave(true);
const saveOnHidden = (): void => { if (document.visibilityState === 'hidden') saveOnExit(); };
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', saveOnExit);
  document.addEventListener('visibilitychange', saveOnHidden);
}

/* ---------- 预设列表 ---------- */
export interface Preset {
  /** 内置流派 = 流派名；自建流派 = 方案 id */
  key: string;
  plan: Plan;
  builtin: boolean;
  /** 内置流派已被改过 */
  modified: boolean;
}
const BUILTIN = new Map(BUILD_NAMES.map(name => [name, builtinPlan(name)!]));
export const presets = computed<Preset[]>(() => [
  ...BUILD_NAMES.map(name => {
    const own = plans.find(p => p.base === name);
    return { key: name, plan: own ?? BUILTIN.get(name)!, builtin: true, modified: !!own };
  }),
  ...plans.filter(p => !p.base).map(p => ({ key: p.id, plan: p, builtin: false, modified: false })),
]);
export const presetOf = (key: string): Preset | undefined => presets.value.find(p => p.key === key);
/** 核心流派用盟约色，其余用强调色 */
export const presetColor = (preset: Preset): string => preset.builtin && CORE_BUILDS[preset.key] ? color(preset.key) : 'var(--accent)';
/** 流派页正在看的预设 */
export const current = computed(() => presetOf(selectedPresetKey.value) ?? presets.value[0]);
export const myPresets = computed(() => presets.value.filter(p => !p.builtin));

const clone = (plan: Plan): Plan => JSON.parse(JSON.stringify(plan)) as Plan;
function select(key: string): void {
  if (key === selectedPresetKey.value) return;
  finishEdit();
  selectedPresetKey.value = presetOf(key) ? key : BUILD_NAMES[0];
}
export { select as selectPreset };

/** Adds a saved plan at the front and returns its local ID; navigation belongs to the caller. */
export function addPlan(next: Plan): string { plans.unshift(next); select(next.id); return next.id; }
/** 合并已校验的备份；先写入本地存储，再追加到界面。保存失败抛出错误，现有方案保持原样。 */
export function restorePlanBackup(incoming: readonly Plan[]): PlanBackupMerge {
  const result = mergePlanBackup(plans, incoming);
  if (!result.additions.length) return result;
  if (!savePlans([...plans, ...result.additions])) {
    saveError.value = true;
    throw new Error('本地保存失败，请检查浏览器的存储空间和权限后重试。');
  }
  saveError.value = false;
  plans.push(...result.additions);
  return result;
}
export function newPreset(): string { return addPlan(blankPlan(`我的流派 ${myPresets.value.length + 1}`)); }
export function copyPreset(key: string): string | undefined {
  const source = presetOf(key); if (!source) return;
  const copy = { ...clone(source.plan), id: newId(), name: source.plan.name.slice(0, 13) + ' 副本', updated: Date.now() };
  delete copy.base;
  return addPlan(copy);
}
export function removePreset(key: string): void {
  const i = plans.findIndex(p => p.id === key && !p.base);
  if (i < 0) return;
  if (editingId.value === key) editingId.value = '';
  plans.splice(i, 1);
  if (runKey.value === key) setRun('');
  if (selectedPresetKey.value === key) select(BUILD_NAMES[0]);
}
/** 丢掉内置流派的修改版 */
export function restorePreset(name: string): void {
  const i = plans.findIndex(p => p.base === name);
  if (i < 0) return;
  if (editingId.value === plans[i].id) editingId.value = '';
  plans.splice(i, 1);
}

/* ---------- 编辑 ---------- */
export const editingId = ref('');
const FALLBACK = blankPlan();
/** 正在编辑的方案；规划器只在编辑时挂载 */
export const plan = computed<Plan>(() => plans.find(p => p.id === editingId.value) ?? FALLBACK);
export const editing = computed(() => !!editingId.value && plan.value !== FALLBACK);
export const touch = (): void => { plan.value.updated = Date.now(); };
/** 进入编辑；内置流派先复制一份修改版 */
export function startEdit(key: string): void {
  const preset = presetOf(key); if (!preset) return;
  select(key);
  if (editing.value && editingId.value === preset.plan.id) return;
  if (preset.builtin && !preset.modified) {
    plans.push({ ...clone(preset.plan), id: newId(), updated: Date.now() });
    editingId.value = plans[plans.length - 1].id;
  } else editingId.value = preset.plan.id;
}
/** 退出编辑；修改版改回和内置一样时丢弃 */
export function finishEdit(): void {
  const edited = plans.find(p => p.id === editingId.value);
  editingId.value = '';
  if (edited?.base && samePlan(edited, BUILTIN.get(edited.base)!)) plans.splice(plans.indexOf(edited), 1);
}
/** 规划器内部：正在编辑的阵容 */
export const planOps = computed(() => plan.value.ops);
export const inPlan = computed(() => new Set(planOps.value.map(o => o.name)));
export const planStats = computed(() => covenantStats(planOps.value, plan.value.layers));

/* ---------- 本局 ---------- */
const read = (key: string): string => { try { return localStorage.getItem(key) ?? ''; } catch { return ''; } };
const write = (key: string, value: string): void => { try { localStorage.setItem(key, value); } catch { /* 隐私模式下不可用 */ } };
const storedBans = ((): string[] => { try { const v: unknown = JSON.parse(read('wsq.bans') || '[]'); return Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && ALL_COVENANTS.includes(x) && x !== '绝技'))] : []; } catch { return []; } })();

const storedRun = read('wsq.run');
export const runKey = ref(presetOf(storedRun) ? storedRun : '');
/** 本局被 ban 的盟约（玩家自己勾的，只用于替代推荐） */
export const runBans = ref<string[]>(storedBans);
const stopRun = watch(runKey, key => write('wsq.run', key), { flush: 'sync' });
const stopBans = watch(runBans, bans => write('wsq.bans', JSON.stringify(bans)), { deep: true, flush: 'sync' });
export const run = computed(() => runKey.value ? presetOf(runKey.value) : undefined);
/** 换一套流派或结束本局；结束时清掉勾选的 ban */
export function setRun(key: string): void {
  if (key && !presetOf(key)) return;
  runKey.value = key;
  if (!key) runBans.value = [];
}
export function toggleBan(name: string): void {
  if (!ALL_COVENANTS.includes(name) || name === '绝技') return;
  const i = runBans.value.indexOf(name);
  if (i >= 0) runBans.value.splice(i, 1); else runBans.value.push(name);
}
export const runOps = computed(() => run.value?.plan.ops ?? []);
export const inRun = computed(() => new Set(runOps.value.map(o => o.name)));
export const runStats = computed<CovenantStat[]>(() => run.value ? covenantStats(run.value.plan.ops, run.value.plan.layers) : []);
export const runStat = computed(() => new Map(runStats.value.map(s => [s.name, s])));

/** 开发热更新时也释放模块级监听器，避免每次更新叠加存档任务。 */
if (import.meta.hot) import.meta.hot.dispose(() => {
  saveOnExit(); stopSaving(); stopRun(); stopBans();
  window.removeEventListener('pagehide', saveOnExit);
  document.removeEventListener('visibilitychange', saveOnHidden);
});
