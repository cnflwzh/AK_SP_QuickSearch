/**
 * 流派预设：内置流派 + 我的流派，编辑即规划。
 *
 * - 内置流派第一次编辑时存一份修改版（Plan.base = 内置流派名），之后列表里由修改版代替；
 *   改回和内置一样时自动丢弃，也可以手动恢复默认。
 * - “本局”：玩家开局前选一套要打的流派；盟约 / 效果 / 干员各页据此高亮。
 * - 本局被 ban 的盟约由玩家自己勾，只用于给出替代方案。
 */
import {computed, reactive, ref, watch} from 'vue';
import {
  BUILD_NAMES,
  CORE_BUILDS,
  EQUIP,
  EQUIPMENT_RECIPES,
  LEADER,
  OPERATOR,
  STRATEGY,
  buildByName,
  buildsUsing,
  isBannableCovenant,
} from '../../data/index.ts';
import {color} from './format.ts';
import {
  MAX_EQ,
  MAX_OPS,
  blankPlan,
  builtinPlan,
  covenantStats,
  loadPlans,
  newId,
  newSlot,
  samePlan,
  savePlans,
  type CovenantStat,
  type Plan,
} from '../lib/plans/index.ts';
import {isBanned} from '../lib/recommendation/index.ts';
import {mergePlanBackup, type PlanBackupMerge} from '../lib/plans/backup.ts';
// The route adapter selects a preset; this store does not depend on the browser router.
const selectedPresetKey = ref(BUILD_NAMES[0]);

/** 用户的方案：自建流派和内置流派的修改版 */
// 旧版规划页会自动建一个空的“我的阵容”，没动过的就不带进流派列表
export const plans = reactive<Plan[]>(
  loadPlans().filter(
    (p) =>
      p.ops.length ||
      p.note ||
      p.strategy ||
      Object.keys(p.layers).length ||
      p.base ||
      p.name !== '我的阵容',
  ),
);

/* ---------- 存档：连续修改合并写入，离页时立即落盘 ---------- */
export const saveError = ref(false);
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let dirty = false;
export function flushSave(force = false): void {
  clearTimeout(saveTimer);
  saveTimer = undefined;
  if (!dirty && !force) return;
  const saved = savePlans(plans);
  saveError.value = !saved;
  dirty = !saved;
}
function scheduleSave(): void {
  dirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 250);
}
const stopSaving = watch(plans, scheduleSave, {deep: true});
// 离页事件可能先于 Vue 的批量 watch 执行，直接保存当前数据，避免漏掉最后一次修改。
const saveOnExit = (): void => flushSave(true);
const saveOnHidden = (): void => {
  if (document.visibilityState === 'hidden') saveOnExit();
};
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
const BUILTIN = new Map(BUILD_NAMES.map((name) => [name, builtinPlan(name)!]));
export const presets = computed<Preset[]>(() => [
  ...BUILD_NAMES.map((name) => {
    const own = plans.find((p) => p.base === name);
    return {
      key: name,
      plan: own ?? BUILTIN.get(name)!,
      builtin: true,
      modified: !!own,
    };
  }),
  ...plans
    .filter((p) => !p.base)
    .map((p) => ({key: p.id, plan: p, builtin: false, modified: false})),
]);
export const presetOf = (key: string): Preset | undefined =>
  presets.value.find((p) => p.key === key);
/** 核心流派用盟约色，其余用强调色 */
export const presetColor = (preset: Preset): string =>
  preset.builtin && CORE_BUILDS[preset.key]
    ? color(preset.key)
    : 'var(--accent)';
/** 流派页正在看的预设 */
export const current = computed(
  () => presetOf(selectedPresetKey.value) ?? presets.value[0],
);
export const myPresets = computed(() =>
  presets.value.filter((p) => !p.builtin),
);

const clone = (plan: Plan): Plan => JSON.parse(JSON.stringify(plan)) as Plan;
function select(key: string): void {
  if (key === selectedPresetKey.value) return;
  finishEdit();
  selectedPresetKey.value = presetOf(key) ? key : BUILD_NAMES[0];
}
export {select as selectPreset};

/** Adds a saved plan at the front and returns its local ID; navigation belongs to the caller. */
export function addPlan(next: Plan): string {
  plans.unshift(next);
  select(next.id);
  return next.id;
}
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
export function newPreset(): string {
  return addPlan(blankPlan(`我的流派 ${myPresets.value.length + 1}`));
}
export function copyPreset(key: string): string | undefined {
  const source = presetOf(key);
  if (!source) return;
  const copy = {
    ...clone(source.plan),
    id: newId(),
    name: source.plan.name.slice(0, 13) + ' 副本',
    updated: Date.now(),
  };
  delete copy.base;
  return addPlan(copy);
}
export function removePreset(key: string): void {
  const i = plans.findIndex((p) => p.id === key && !p.base);
  if (i < 0) return;
  if (editingId.value === key) editingId.value = '';
  plans.splice(i, 1);
  if (runKey.value === key) setRun('');
  if (selectedPresetKey.value === key) select(BUILD_NAMES[0]);
}
/** 丢掉内置流派的修改版 */
export function restorePreset(name: string): void {
  const i = plans.findIndex((p) => p.base === name);
  if (i < 0) return;
  if (editingId.value === plans[i].id) editingId.value = '';
  plans.splice(i, 1);
}

/* ---------- 编辑 ---------- */
export const editingId = ref('');
const FALLBACK = blankPlan();
/** 正在编辑的方案；规划器只在编辑时挂载 */
export const plan = computed<Plan>(
  () => plans.find((p) => p.id === editingId.value) ?? FALLBACK,
);
export const editing = computed(
  () => !!editingId.value && plan.value !== FALLBACK,
);
export const touch = (): void => {
  plan.value.updated = Date.now();
};
/** 进入编辑；内置流派先复制一份修改版 */
export function startEdit(key: string): void {
  const preset = presetOf(key);
  if (!preset) return;
  select(key);
  if (editing.value && editingId.value === preset.plan.id) return;
  if (preset.builtin && !preset.modified) {
    plans.push({...clone(preset.plan), id: newId(), updated: Date.now()});
    editingId.value = plans[plans.length - 1].id;
  } else editingId.value = preset.plan.id;
}
/** 退出编辑；修改版改回和内置一样时丢弃 */
export function finishEdit(): void {
  const edited = plans.find((p) => p.id === editingId.value);
  editingId.value = '';
  if (edited?.base && samePlan(edited, BUILTIN.get(edited.base)!))
    plans.splice(plans.indexOf(edited), 1);
}
/** 规划器内部：正在编辑的阵容 */
export const planOps = computed(() => plan.value.ops);
export const inPlan = computed(() => new Set(planOps.value.map((o) => o.name)));
export const planStats = computed(() =>
  covenantStats(planOps.value, plan.value.layers),
);

/* ---------- 本局 ---------- */
const read = (key: string): string => {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
};
const write = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* 隐私模式下不可用 */
  }
};
const storedBans = ((): string[] => {
  try {
    const v: unknown = JSON.parse(read('wsq.bans') || '[]');
    return Array.isArray(v)
      ? [
          ...new Set(
            v.filter(
              (x): x is string =>
                typeof x === 'string' && isBannableCovenant(x),
            ),
          ),
        ]
      : [];
  } catch {
    return [];
  }
})();

const storedRun = read('wsq.run');
export const runKey = ref(presetOf(storedRun) ? storedRun : '');
/** 本局被 ban 的盟约（玩家自己勾的，用于替代推荐、图鉴禁池隐藏与真实抓牌概率） */
export const runBans = ref<string[]>(storedBans);
export const runBanSet = computed(() => new Set(runBans.value));
const storedLeader = read('wsq.leader');
export const runLeaderKey = ref(
  Object.hasOwn(LEADER, storedLeader) ? storedLeader : '',
);
const stopRun = watch(runKey, (key) => write('wsq.run', key), {flush: 'sync'});
const stopBans = watch(
  runBans,
  (bans) => write('wsq.bans', JSON.stringify(bans)),
  {deep: true, flush: 'sync'},
);
const stopLeader = watch(runLeaderKey, (key) => write('wsq.leader', key), {
  flush: 'sync',
});
export const run = computed(() =>
  runKey.value ? presetOf(runKey.value) : undefined,
);
export const runLeader = computed(() =>
  runLeaderKey.value ? LEADER[runLeaderKey.value] : undefined,
);
/** 换一套流派或结束本局；结束时清掉勾选的 ban */
export function setRun(key: string): void {
  if (key && !presetOf(key)) return;
  runKey.value = key;
  if (!key) runBans.value = [];
}
export function setRunLeader(name: string): void {
  if (name && !Object.hasOwn(LEADER, name)) return;
  runLeaderKey.value = name;
}
/** 一键结束本局（清空本局流派、禁池与领袖标记）。 */
export function endRun(): void {
  runKey.value = '';
  runBans.value = [];
  runLeaderKey.value = '';
}
export function toggleBan(name: string): void {
  if (!isBannableCovenant(name)) return;
  const i = runBans.value.indexOf(name);
  if (i >= 0) runBans.value.splice(i, 1);
  else runBans.value.push(name);
}
export function clearBans(): void {
  runBans.value = [];
}
export function isRunBannedOp(name: string): boolean {
  return runBanSet.value.size > 0 && isBanned(name, runBanSet.value);
}
export const runOps = computed(() => run.value?.plan.ops ?? []);
export const inRun = computed(() => new Set(runOps.value.map((o) => o.name)));
export const runSlotMap = computed(
  () => new Map(runOps.value.map((slot) => [slot.name, slot])),
);
export const runAltTargets = computed(() => {
  const map = new Map<string, string[]>();
  for (const slot of runOps.value) {
    for (const alt of slot.alt) {
      if (inRun.value.has(alt)) continue;
      const list = map.get(alt);
      if (list) {
        if (!list.includes(slot.name)) list.push(slot.name);
      } else {
        map.set(alt, [slot.name]);
      }
    }
  }
  return map;
});
export const inRunAlt = computed(() => new Set(runAltTargets.value.keys()));
export const inRunAny = computed(
  () => new Set([...inRun.value, ...inRunAlt.value]),
);
export const runStats = computed<CovenantStat[]>(() =>
  run.value ? covenantStats(run.value.plan.ops, run.value.plan.layers) : [],
);
export const runStat = computed(
  () => new Map(runStats.value.map((s) => [s.name, s])),
);
export const runBaseBuild = computed(() =>
  run.value?.plan.base ? buildByName(run.value.plan.base) : undefined,
);
export const runEquipOwners = computed(() => {
  const map = new Map<string, string[]>();
  for (const slot of runOps.value) {
    for (const eq of slot.eq) {
      const list = map.get(eq);
      if (list) {
        if (!list.includes(slot.name)) list.push(slot.name);
      } else {
        map.set(eq, [slot.name]);
      }
    }
  }
  return map;
});
export const runEquipRecommended = computed(
  () =>
    new Set(
      [
        ...runOps.value.flatMap((o) => o.eq),
        ...(runBaseBuild.value?.equipment ?? []),
      ].filter((e) => Object.hasOwn(EQUIP, e)),
    ),
);
export const runEquipMaterials = computed(() => {
  const map = new Map<string, string[]>();
  for (const target of runEquipRecommended.value) {
    const recipe = EQUIPMENT_RECIPES[target];
    if (!recipe) continue;
    for (const mat of [recipe[0], recipe[1]]) {
      const list = map.get(mat);
      if (list) {
        if (!list.includes(target)) list.push(target);
      } else {
        map.set(mat, [target]);
      }
    }
  }
  return map;
});
export const runStrategies = computed(() => {
  const primary = run.value?.plan.strategy ?? '';
  const all = new Set(
    [primary, ...(runBaseBuild.value?.strategies ?? [])].filter((s) =>
      Object.hasOwn(STRATEGY, s),
    ),
  );
  return {
    primary: Object.hasOwn(STRATEGY, primary) ? primary : '',
    all,
  };
});

export const quickTargetPreset = computed<Preset | undefined>(() => {
  if (editing.value)
    return presets.value.find((p) => p.plan.id === editingId.value);
  if (run.value && !run.value.builtin) return run.value;
  return myPresets.value[0];
});

export function toggleOpInQuickBuild(opName: string): {
  status: 'added' | 'removed' | 'full' | 'created';
  key: string;
  planName: string;
} {
  if (!Object.hasOwn(OPERATOR, opName)) {
    return {status: 'full', key: '', planName: ''};
  }
  const existing = quickTargetPreset.value;
  if (existing) {
    const target = existing.plan;
    const index = target.ops.findIndex((slot) => slot.name === opName);
    if (index >= 0) {
      target.ops.splice(index, 1);
      target.updated = Date.now();
      return {status: 'removed', key: existing.key, planName: target.name};
    }
    if (target.ops.length >= MAX_OPS) {
      return {status: 'full', key: existing.key, planName: target.name};
    }
    target.ops.push(newSlot(opName));
    target.updated = Date.now();
    return {status: 'added', key: existing.key, planName: target.name};
  }
  const created = blankPlan(`我的流派 ${myPresets.value.length + 1}`);
  created.ops.push(newSlot(opName));
  const key = addPlan(created);
  if (!runKey.value) setRun(key);
  return {status: 'created', key, planName: created.name};
}

/** 反查使用了某干员、装备或策略的流派（同时涵盖内置预设与玩家自建流派）。 */
export function presetsUsing(kind: 'op' | 'eq' | 'st', name: string): string[] {
  const staticSet = new Set(
    buildsUsing(
      kind === 'op' ? 'lineup' : kind === 'eq' ? 'equipment' : 'strategies',
      name,
    ),
  );
  return presets.value
    .filter((preset) => {
      if (kind === 'op') {
        return (
          preset.plan.ops.some(
            (slot) => slot.name === name || slot.alt.includes(name),
          ) ||
          (preset.builtin && !preset.modified && staticSet.has(preset.key))
        );
      }
      if (kind === 'eq') {
        return (
          preset.plan.ops.some((slot) => slot.eq.includes(name)) ||
          (preset.plan.base
            ? (buildByName(preset.plan.base)?.equipment.includes(name) ?? false)
            : false) ||
          (preset.builtin && !preset.modified && staticSet.has(preset.key))
        );
      }
      return (
        preset.plan.strategy === name ||
        (preset.plan.base
          ? (buildByName(preset.plan.base)?.strategies.includes(name) ?? false)
          : false) ||
        (preset.builtin && !preset.modified && staticSet.has(preset.key))
      );
    })
    .map((preset) => preset.key);
}

export function toggleEquipInQuickBuild(
  opName: string,
  eqName: string,
): 'added' | 'removed' | 'full' | 'missing' {
  if (!Object.hasOwn(EQUIP, eqName) || !quickTargetPreset.value) {
    return 'missing';
  }
  const target = quickTargetPreset.value.plan;
  const slot = target.ops.find((item) => item.name === opName);
  if (!slot) return 'missing';
  const index = slot.eq.indexOf(eqName);
  if (index >= 0) {
    slot.eq.splice(index, 1);
    target.updated = Date.now();
    return 'removed';
  }
  if (slot.eq.length >= MAX_EQ) return 'full';
  slot.eq.push(eqName);
  target.updated = Date.now();
  return 'added';
}

export function setStrategyInQuickBuild(stName: string): {
  status: 'set' | 'cleared' | 'created';
  key: string;
  planName: string;
} {
  if (!Object.hasOwn(STRATEGY, stName)) {
    return {status: 'cleared', key: '', planName: ''};
  }
  const existing = quickTargetPreset.value;
  if (existing) {
    const target = existing.plan;
    target.strategy = target.strategy === stName ? '' : stName;
    target.updated = Date.now();
    return {
      status: target.strategy ? 'set' : 'cleared',
      key: existing.key,
      planName: target.name,
    };
  }
  const created = blankPlan(`我的流派 ${myPresets.value.length + 1}`);
  created.strategy = stName;
  const key = addPlan(created);
  if (!runKey.value) setRun(key);
  return {status: 'created', key, planName: created.name};
}

/** 开发热更新时也释放模块级监听器，避免每次更新叠加存档任务。 */
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    saveOnExit();
    stopSaving();
    stopRun();
    stopBans();
    stopLeader();
    window.removeEventListener('pagehide', saveOnExit);
    document.removeEventListener('visibilitychange', saveOnHidden);
  });
