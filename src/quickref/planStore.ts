/**
 * 当前阵容：规划页编辑的方案，同时供效果 / 盟约 / 流派 / 干员详情读取。
 * 各页据此标出“已在阵容”的干员、盟约进度，以及和现成流派的接近程度。
 */
import { computed, reactive, ref, watch } from 'vue';
import { BUILD_NAMES, OPERATOR, STRATEGY, buildByName } from '../../data/index.ts';
import {
  MAX_OPS, blankPlan, covenantStats, loadCurrent, loadPlans, newSlot, saveCurrent, savePlans, type CovenantStat, type Plan,
} from '../lib/planner.ts';

export const plans = reactive<Plan[]>(loadPlans());
if (!plans.length) plans.push(blankPlan('我的阵容'));
export const currentId = ref(plans.some(p => p.id === loadCurrent()) ? loadCurrent() : plans[0].id);
export const plan = computed(() => plans.find(p => p.id === currentId.value) ?? plans[0]);

/* ---------- 存档：连续修改合并写入，离页时立即落盘 ---------- */
export const saveError = ref(false);
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let dirty = false;
export function flushSave(): void {
  clearTimeout(saveTimer); saveTimer = undefined;
  if (!dirty) return;
  const saved = savePlans(plans); saveError.value = !saved; dirty = !saved;
}
function scheduleSave(): void { dirty = true; clearTimeout(saveTimer); saveTimer = setTimeout(flushSave, 250); }
// 只深度监听当前方案；方案增删由 addPlan / removePlan 显式触发。
watch(plan, scheduleSave, { deep: true });
watch(currentId, id => saveCurrent(id));
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushSave);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushSave(); });
}

export const touch = (): void => { plan.value.updated = Date.now(); };
export function addPlan(next: Plan): void { plans.unshift(next); currentId.value = next.id; scheduleSave(); }
export function removePlan(target: Plan): void {
  plans.splice(plans.indexOf(target), 1);
  if (!plans.length) plans.push(blankPlan('我的阵容'));
  currentId.value = plans[0].id; scheduleSave();
}

/* ---------- 供其他页读取 ---------- */
export const planOps = computed(() => plan.value.ops);
export const inPlan = computed(() => new Set(planOps.value.map(o => o.name)));
export const planFull = computed(() => planOps.value.length >= MAX_OPS);
export const planStats = computed(() => covenantStats(planOps.value, plan.value.layers));
export const planStat = computed(() => new Map<string, CovenantStat>(planStats.value.map(s => [s.name, s])));

/** 把干员加入 / 移出当前阵容；满员时不加 */
export function toggleInPlan(name: string): void {
  if (!OPERATOR[name]) return;
  const ops = plan.value.ops, i = ops.findIndex(o => o.name === name);
  if (i >= 0) ops.splice(i, 1);
  else if (ops.length < MAX_OPS) ops.push(newSlot(name));
  else return;
  touch();
}

/** 以流派终盘阵容新建一套方案并切过去 */
export function planFromBuild(name: string): void {
  const build = buildByName(name);
  if (!build) return;
  addPlan({
    ...blankPlan(name), strategy: build.strategies.find(s => STRATEGY[s]) ?? '',
    ops: build.lineup.filter(n => OPERATOR[n]).slice(0, MAX_OPS).map(newSlot),
    note: build.tagline,
  });
}

/* ---------- 流派接近度 ---------- */
export interface BuildMatch { name: string; have: string[]; missing: string[]; total: number }
/** 当前阵容和每套流派终盘阵容的重合：已有几人、还差谁 */
export const buildMatches = computed<BuildMatch[]>(() => BUILD_NAMES.map(name => {
  const lineup = buildByName(name)!.lineup.filter(n => OPERATOR[n]);
  return { name, have: lineup.filter(n => inPlan.value.has(n)), missing: lineup.filter(n => !inPlan.value.has(n)), total: lineup.length };
}));
export const buildMatch = computed(() => new Map(buildMatches.value.map(m => [m.name, m])));
/** 至少重合 2 人的流派，按重合数排序：阵容还没成形时不乱推荐 */
export const closestBuilds = computed(() => buildMatches.value.filter(m => m.have.length >= 2)
  .sort((a, b) => b.have.length - a.have.length || a.missing.length - b.missing.length).slice(0, 3));
