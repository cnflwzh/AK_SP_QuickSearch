<script setup lang="ts">
import {computed, nextTick, ref, watch} from 'vue';
import {
  BORROW_LIMIT,
  OPERATORS,
  OPERATOR,
  OPERATOR_TYPES,
  COMBAT_ROLE_LABELS,
  EQUIPMENT,
  EQUIP,
  STRATEGIES,
  STRATEGY,
  STRATEGY_CATEGORIES,
  COVENANTS,
  CORE_COVENANTS,
  ALL_COVENANTS,
  TIERS,
  TIER_LABELS,
  isCoreCovenant,
  type CombatRole,
} from '../../../data/index.ts';
import {isBoxSubstitute} from '../../lib/box/insights.ts';
import {BOX_RANK_BORROWED} from '../../lib/box/model.ts';
import {
  boxSeasonBorrowedCount,
  hasAnyBox,
  operatorBox,
  setOperatorRanks,
} from '../../lib/box/store.ts';
import {avatarSrc, equipIconSrc, portraitSrc} from '../../lib/ui/assets.ts';
import {nameScore, normalize} from '../../lib/ui/match.ts';
import {
  LAYER_SLIDER,
  MAX_ALT,
  MAX_EQ,
  MAX_LAYERS,
  MAX_NOTE,
  MAX_OPS,
  usesLayers,
  atLayers,
  covenantStats,
  newSlot,
  diagnoseLineup,
  equipNotes,
  planCost,
  type Plan,
  type PlanOp,
} from '../../lib/plans/index.ts';
import {effectivePlanIcon, MAX_STRATEGIES, type PlanIcon, type PlanStage} from '../../lib/plans/model.ts';
import {suggestions, alternatesFor} from '../../lib/recommendation/index.ts';
import {
  current,
  presets,
  editingId,
  editingStageKey,
  stageKey,
  stageLabel,
  hasPlanOperators,
  plan,
  touch,
  runKey,
  runStageKey,
  setRun,
} from '../planStore.ts';
import {useQuickrefActions} from '../state.ts';
import {color, fx} from '../format.ts';
import Segmented from '../components/Segmented.vue';
import SearchInput from '../components/SearchInput.vue';
import SelectInput, {type SelectOption} from '../components/SelectInput.vue';
import EmptyState from '../components/EmptyState.vue';
import StatusNotice from '../components/StatusNotice.vue';
import ConfirmButton from '../components/ConfirmButton.vue';
import CovenantIcon from '../components/CovenantIcon.vue';
import PlanCovenants from '../components/PlanCovenants.vue';
import PlanSummary from '../components/PlanSummary.vue';
import GlossaryText from '../components/GlossaryText.vue';
import PlanSharePanel from '../components/PlanSharePanel.vue';
import PlannerSheet from '../components/PlannerSheet.vue';
import PlanIconPicker from '../components/PlanIconPicker.vue';
import PlannerStages from '../planner/PlannerStages.vue';
import {useCompactPlanner} from '../planner/useCompactPlanner.ts';
import '../workbench.css';
/**
 * 流派编辑器共用一套干员、装备和盟约控件，始终写入当前查看的阶段或成型阵容。
 */
import {routeQuery, updateQuery} from '../../router/navigation.ts';
import {CATEGORY_IDS, queryText} from '../../router/location.ts';
import {
  covenantId,
  covenantName,
  buildId,
  buildKey,
} from '../../router/entities.ts';
const emit = defineEmits<{done: []}>();
const actions = useQuickrefActions();
const stages = computed(() => plan.value.stages ?? []);
const stage = computed(() =>
  stages.value.find((item) => stageKey(item) === editingStageKey.value),
);
watch([editingStageKey, stage], ([key, item]) => {
  // 其他标签页更新存档后，已删除的区间应回到成型阵容并清除旧槽位的编辑状态。
  if (key && !item) editingStageKey.value = '';
});
const formation = computed(() => stage.value ?? plan.value);
const ops = computed(() => formation.value.ops);
const inPlan = computed(() => new Set(ops.value.map((op) => op.name)));
const stats = computed(() => covenantStats(ops.value, formation.value.layers));
const canRun = computed(() => hasPlanOperators(plan.value));

function setIcon(icon?: PlanIcon): void {
  // 再次选中预设自带的盟约，与恢复默认等效，不留下仅图标不同的修改版。
  if (!icon || (icon.kind === 'covenant' && icon.name === plan.value.base)) delete plan.value.icon;
  else plan.value.icon = icon;
  touch();
}

function commitStages(next: PlanStage[], selected: string): void {
  const oldKey = editingStageKey.value;
  const updatesRun =
    oldKey &&
    runKey.value === current.value.key &&
    runStageKey.value === oldKey &&
    !next.some((item) => stageKey(item) === oldKey);
  if (updatesRun && selected) runStageKey.value = selected;
  plan.value.stages = next;
  editingStageKey.value = selected;
  if (updatesRun && !selected) setRun(current.value.key);
  touch();
}
const noteInput = ref<HTMLTextAreaElement | null>(null);
const NOTE_PROMPTS = [
  ['+ 前期过渡', '前期过渡：'],
  ['+ 中期抓牌', '中期抓牌：'],
  ['+ 站位配装', '站位配装：'],
] as const;
const POOL_COVENANT_OPTIONS: readonly SelectOption<string>[] = [
  {value: '', label: '全部盟约'},
  ...ALL_COVENANTS.map((name) => ({value: name, label: name})),
];
const POOL_TYPE_OPTIONS: readonly SelectOption<string>[] = [
  {value: '', label: '全部类型'},
  ...OPERATOR_TYPES.map((typeName) => ({value: typeName, label: typeName})),
];
const POOL_ROLE_OPTIONS: readonly SelectOption<'' | CombatRole>[] = [
  {value: '', label: '全部职能'},
  ...COMBAT_ROLE_LABELS.map((role) => ({value: role, label: role})),
];
const compareOptions = computed<readonly SelectOption<string>[]>(() => [
  {value: '', label: '选择要对比的流派'},
  ...presets.value
    .filter((x) => x.plan.id !== plan.value.id)
    .map((x) => ({
      value: x.key,
      label: `${x.builtin ? '' : '我的 · '}${x.plan.name}`,
    })),
]);
const templatePresetOptions = computed<readonly SelectOption<string>[]>(() => [
  {value: '', label: '选择参考流派…'},
  ...presets.value
    .filter((x) => x.plan.id !== plan.value.id && x.plan.ops.length > 0)
    .map((x) => ({
      value: x.key,
      label: `${x.builtin ? '' : '我的 · '}${x.plan.name}`,
    })),
]);
function insertNotePrompt(prefix: string): void {
  const currentNote = formation.value.note;
  if (currentNote.includes(prefix)) {
    noteInput.value?.focus();
    return;
  }
  const sep = currentNote && !currentNote.endsWith('\n') ? '\n' : '';
  const next = (currentNote + sep + prefix).slice(0, MAX_NOTE);
  formation.value.note = next;
  touch();
  void nextTick(() => {
    const el = noteInput.value;
    if (!el) return;
    el.focus();
    el.setSelectionRange(next.length, next.length);
  });
}
function finishAndRun(): void {
  if (!canRun.value) return;
  setRun(
    current.value.key,
    ops.value.length ? editingStageKey.value : undefined,
  );
  emit('done');
}
function startWithCovenant(cov: string): void {
  poolCovenant.value = cov;
  if (compact.value) void openOperators();
}
function applyTemplatePreset(key: string): void {
  const source = presets.value.find((x) => x.key === key)?.plan;
  if (!source) return;
  formation.value.ops = JSON.parse(JSON.stringify(source.ops)) as PlanOp[];
  formation.value.layers = {...source.layers};
  if (!formation.value.note.trim()) formation.value.note = source.note;
  if (!stage.value) {
    plan.value.strategy = source.strategy;
    plan.value.strategyAlternates = [...(source.strategyAlternates ?? [])];
  }
  editing.value = -1;
  picking.value = '';
  replacing.value = false;
  touch();
}
function onSelectPlanCovenant(cov: string): void {
  const selected = poolCovenant.value === cov ? '' : cov;
  poolCovenant.value = selected;
  // 筛选值随路由异步更新，本次点击直接使用玩家刚选的盟约。
  if (compact.value && selected) void openOperators();
}
watch([editingId, editingStageKey], () => {
  closeMobilePanel();
  equipmentQuery.value = '';
  mobileSection.value = 'lineup';
});

/* ---------- 紧凑布局：总览留在原位，选人和编辑在底部面板完成 ---------- */
const root = ref<HTMLElement>();
const compact = useCompactPlanner(root);
type MobilePanel =
  | ''
  | 'slot'
  | 'operators'
  | 'replace'
  | 'equipment'
  | 'alternatives'
  | 'strategies';
const mobilePanel = ref<MobilePanel>('');
const mobileSection = ref<'lineup' | 'effects'>('lineup');
const panelTarget = '#planner-mobile-content';
const mobilePoolOpen = computed(() =>
  ['operators', 'replace', 'alternatives'].includes(mobilePanel.value),
);
const mobileCanGoBack = computed(
  () =>
    !!slot.value &&
    ['replace', 'equipment', 'alternatives'].includes(mobilePanel.value),
);
const mobileTitle = computed(() => {
  switch (mobilePanel.value) {
    case 'slot':
      return `编辑第 ${editing.value + 1} 位`;
    case 'replace':
      return `更换 ${slot.value?.name ?? '干员'}`;
    case 'equipment':
      return `装备 · ${slot.value?.name ?? ''}（${slot.value?.eq.length ?? 0}/${MAX_EQ}）`;
    case 'alternatives':
      return `过渡/备选 · ${slot.value?.name ?? ''}（${slot.value?.alt.length ?? 0}/${MAX_ALT}）`;
    case 'strategies':
      return strategyEdit.value < 0 ? '添加流派策略' : '更换流派策略';
    default:
      return `添加干员（${ops.value.length}/${MAX_OPS}）`;
  }
});

function closeMobilePanel(): void {
  mobilePanel.value = '';
  editing.value = -1;
  picking.value = '';
  replacing.value = false;
}
function backToSlot(): void {
  picking.value = '';
  mobilePanel.value = 'slot';
}
watch(compact, closeMobilePanel);

async function showSection(section: 'lineup' | 'effects'): Promise<void> {
  if (mobileSection.value === section) return;
  mobileSection.value = section;
  await nextTick();
  const top = root.value?.getBoundingClientRect().top;
  const visibleTop =
    (document.getElementById('qbar')?.getBoundingClientRect().height ?? 0) + 12;
  if (top !== undefined && top < visibleTop)
    window.scrollBy({top: top - visibleTop, behavior: 'instant'});
}

async function openOperators(replace = false): Promise<void> {
  picking.value = '';
  if (compact.value) {
    if (!replace) editing.value = -1;
    mobilePanel.value = replace ? 'replace' : 'operators';
  } else {
    replacing.value = replace && !!slot.value;
    await nextTick();
    root.value?.querySelector<HTMLInputElement>('.pl-pool input')?.focus();
  }
}

function openPicker(kind: 'eq' | 'st' | 'alt'): void {
  if (!compact.value) {
    picking.value = picking.value === kind ? '' : kind;
    return;
  }
  picking.value = kind;
  mobilePanel.value =
    kind === 'eq' ? 'equipment' : kind === 'st' ? 'strategies' : 'alternatives';
}

/* ---------- 阵容编辑 ---------- */
const editing = ref(-1);
const slot = computed<PlanOp | undefined>(() => ops.value[editing.value]);
/** 宽屏「更换」：选中槽位后，下一次点干员池替换该位置。手机由 replace 面板承担。 */
const replacing = ref(false);
const replaceMode = computed(
  () =>
    !!slot.value &&
    (compact.value ? mobilePanel.value === 'replace' : replacing.value),
);
const lineupFull = computed(() => ops.value.length >= MAX_OPS);
function toggle(name: string): void {
  if (picking.value === 'alt') return addAlt(name);
  if (replaceMode.value) {
    if (!slot.value || inPlan.value.has(name)) return;
    // 和换上备选一致：保留位置与装备，新干员重新设置精锐和核心标记。
    slot.value.name = name;
    slot.value.elite = false;
    slot.value.core = false;
    slot.value.alt = slot.value.alt.filter((alternate) => alternate !== name);
    touch();
    if (compact.value) backToSlot();
    else replacing.value = false;
    return;
  }
  const i = ops.value.findIndex((o) => o.name === name);
  if (i >= 0) {
    ops.value.splice(i, 1);
    if (editing.value === i) {
      editing.value = -1;
      picking.value = '';
      replacing.value = false;
    } else if (editing.value > i) editing.value--;
  } else if (ops.value.length < MAX_OPS) ops.value.push(newSlot(name));
  touch();
}
function move(d: number): void {
  const i = editing.value,
    j = i + d;
  if (j < 0 || j >= ops.value.length) return;
  [ops.value[i], ops.value[j]] = [ops.value[j], ops.value[i]];
  editing.value = j;
  touch();
}
function removeSlot(): void {
  if (!slot.value) return;
  ops.value.splice(editing.value, 1);
  closeMobilePanel();
  touch();
}
const picking = ref<'' | 'eq' | 'st' | 'alt'>('');
function addEquip(name: string): void {
  if (!slot.value || slot.value.eq.length >= MAX_EQ) return;
  slot.value.eq = [...slot.value.eq, name].slice(-MAX_EQ);
  if (slot.value.eq.length >= MAX_EQ) picking.value = '';
  touch();
  if (compact.value) backToSlot();
}
function dropEquip(i: number): void {
  slot.value?.eq.splice(i, 1);
  touch();
}
/* 备选：主选抓不到时的次级选择。点备选 = 和主选互换（看换人后的盟约），× = 移除 */
const activeBox = computed(() => (hasAnyBox.value ? operatorBox : undefined));
const altSuggest = computed(() =>
  slot.value
    ? alternatesFor(
        slot.value,
        ops.value,
        8,
        formation.value.layers,
        activeBox.value,
      )
    : [],
);
const earlyTransitionSuggest = computed(() => {
  const s = slot.value;
  if (!s || OPERATOR[s.name].tier < 3) return [];
  const targetCovs = OPERATOR[s.name].covenants;
  return OPERATORS.filter(
    (o) =>
      o.tier <= 2 &&
      o.name !== s.name &&
      !inPlan.value.has(o.name) &&
      !s.alt.includes(o.name) &&
      o.covenants.some((c) => targetCovs.includes(c)),
  )
    .sort(
      (a, b) =>
        +b.covenants.some((c) => present.value.has(c)) -
          +a.covenants.some((c) => present.value.has(c)) || a.tier - b.tier,
    )
    .slice(0, 8);
});
function addAlt(name: string): void {
  const s = slot.value;
  if (
    !s ||
    s.alt.length >= MAX_ALT ||
    name === s.name ||
    s.alt.includes(name) ||
    inPlan.value.has(name)
  )
    return;
  s.alt.push(name);
  if (s.alt.length >= MAX_ALT) picking.value = '';
  touch();
  if (compact.value && s.alt.length >= MAX_ALT) backToSlot();
}
function dropAlt(i: number): void {
  slot.value?.alt.splice(i, 1);
  touch();
}
function swapAlt(i: number): void {
  const s = slot.value;
  if (!s || inPlan.value.has(s.alt[i])) return;
  const next = s.alt[i];
  s.alt.splice(i, 1, s.name);
  s.name = next;
  s.elite = false;
  s.core = false;
  touch();
}
const strategies = computed(() =>
  [plan.value.strategy, ...(plan.value.strategyAlternates ?? [])].filter(
    Boolean,
  ),
);
const strategyEdit = ref(-1);

function openStrategies(index: number): void {
  if (picking.value === 'st' && strategyEdit.value !== index)
    picking.value = '';
  strategyEdit.value = index;
  openPicker('st');
}

function setStrategies(names: string[]): void {
  plan.value.strategy = names[0] ?? '';
  plan.value.strategyAlternates = names.slice(1);
  touch();
}

function pickStrategy(name: string): void {
  const names = [...strategies.value];
  if (names.includes(name)) return;
  if (strategyEdit.value < 0) {
    if (names.length >= MAX_STRATEGIES) return;
    names.push(name);
  } else {
    if (strategyEdit.value >= names.length) return;
    names[strategyEdit.value] = name;
  }
  setStrategies(names);
  picking.value = '';
  if (compact.value) closeMobilePanel();
}

function moveStrategy(index: number, offset: number): void {
  const names = [...strategies.value];
  const dest = index + offset;
  if (dest < 0 || dest >= names.length) return;
  [names[index], names[dest]] = [names[dest], names[index]];
  picking.value = '';
  setStrategies(names);
}

function removeStrategy(name: string): void {
  picking.value = '';
  setStrategies(strategies.value.filter((item) => item !== name));
}
function editSlot(i: number): void {
  editing.value = !compact.value && editing.value === i ? -1 : i;
  picking.value = '';
  replacing.value = false;
  if (compact.value) mobilePanel.value = 'slot';
}

/* ---------- 计算 ---------- */
/* 盟约层数：每个盟约各自的层数，存在方案里，随分享码一起分享 */
const layerOf = (name: string): number => formation.value.layers[name] ?? 0;
function setLayers(name: string, value: number): void {
  formation.value.layers = {
    ...formation.value.layers,
    [name]: Math.max(0, Math.min(MAX_LAYERS, Math.round(+value || 0))),
  };
  touch();
}
const active = computed(() => stats.value.filter((s) => s.active));
const cost = computed(() => planCost(ops.value));
const remainingBorrows = computed(() =>
  Math.max(0, BORROW_LIMIT - boxSeasonBorrowedCount.value),
);
const diagnostics = computed(() =>
  diagnoseLineup(
    ops.value,
    stats.value,
    activeBox.value,
    remainingBorrows.value,
  ),
);
// 同一名干员可能关联多个职能，只展示和占用一个助战名额。
const riskBorrowTargets = computed(() => {
  const rolesByOperator = new Map<string, CombatRole[]>();
  for (const risk of diagnostics.value.substituteRisks) {
    for (const {name} of risk.operators) {
      const roles = rolesByOperator.get(name) ?? [];
      roles.push(risk.role);
      rolesByOperator.set(name, roles);
    }
  }
  return [...rolesByOperator].map(([name, roles]) => ({
    name,
    backup: OPERATOR[name].backupOperator,
    roles,
  }));
});
const riskBorrowError = ref('');
watch(riskBorrowTargets, () => {
  riskBorrowError.value = '';
});
function borrowRiskOperators(names: readonly string[]): void {
  riskBorrowError.value = '';
  try {
    setOperatorRanks(names, BOX_RANK_BORROWED);
  } catch (error) {
    riskBorrowError.value =
      error instanceof Error ? error.message : '助战名额已满。';
  }
}
const recs = computed(() =>
  suggestions(ops.value, 8, formation.value.layers, activeBox.value),
);
const notes = computed(() => equipNotes(ops.value));
const replacingStrategy = computed(
  () => STRATEGY[strategies.value[strategyEdit.value]],
);
/** 阵容里已有的盟约：干员池里能推进它们的干员加星 */
const present = computed(
  () =>
    new Set(
      stats.value.filter((s) => !s.bonusActive && !s.broken).map((s) => s.name),
    ),
);
const GAIN: Record<string, string> = {
  on: '激活',
  bonus: '强化',
  up: '+1',
  off: '失效',
  weaken: '失去强化',
};

/* ---------- 干员池 ---------- */
const poolTier = computed({
  get: () => Number(queryText(routeQuery.value, 'poolTier')) || 0,
  set: (value: number) => {
    void updateQuery({poolTier: value || null});
  },
});
const poolCovenant = computed({
  get: () => covenantName(queryText(routeQuery.value, 'poolCovenant')),
  set: (value: string) => {
    void updateQuery({poolCovenant: covenantId(value) || null});
  },
});
const poolQuery = computed({
  get: () => queryText(routeQuery.value, 'poolQuery'),
  set: (value: string) => {
    void updateQuery({poolQuery: value || null}, true);
  },
});
const poolType = ref('');
const poolRole = ref<CombatRole | ''>('');
const poolAvailableOnly = ref(false);
const hasPoolFilter = computed(
  () =>
    !!(
      poolQuery.value ||
      poolCovenant.value ||
      poolType.value ||
      poolRole.value ||
      poolTier.value ||
      (hasAnyBox.value && poolAvailableOnly.value)
    ),
);
function resetPoolFilters(): void {
  poolType.value = '';
  poolRole.value = '';
  poolAvailableOnly.value = false;
  void updateQuery({
    poolQuery: null,
    poolCovenant: null,
    poolTier: null,
  });
}
function filterPoolByRole(role: CombatRole): void {
  poolRole.value = poolRole.value === role ? '' : role;
  if (compact.value && poolRole.value) void openOperators();
}
function isOpSub(name: string): boolean {
  if (!hasAnyBox.value) return false;
  const op = OPERATOR[name];
  return !!op && isBoxSubstitute(op, operatorBox);
}
const pool = computed(() => {
  const raw = poolQuery.value.trim();
  const q = normalize(poolQuery.value);
  const filterSub = hasAnyBox.value && poolAvailableOnly.value;
  return OPERATORS.filter(
    (o) =>
      (!filterSub || !isBoxSubstitute(o, operatorBox)) &&
      (!poolTier.value || o.tier === poolTier.value) &&
      (!poolCovenant.value || o.covenants.includes(poolCovenant.value)) &&
      (!poolType.value || o.type === poolType.value) &&
      (!poolRole.value || Boolean(o.roles?.includes(poolRole.value))) &&
      (!raw ||
        nameScore(o.name, q) > 0 ||
        o.covenants.some((c) => c === raw) ||
        Boolean(o.roles?.some((r) => r === raw || nameScore(r, q) > 0)) ||
        o.trait.includes(raw) ||
        o.elite.includes(raw) ||
        o.type.includes(raw)),
  );
});
const poolGroups = computed(() =>
  TIERS.map((tier) => ({
    tier,
    items: pool.value.filter((o) => o.tier === tier),
  })).filter((g) => g.items.length),
);
function poolDisabled(name: string): boolean {
  if (picking.value === 'alt')
    return (
      inPlan.value.has(name) ||
      !!slot.value?.alt.includes(name) ||
      !slot.value ||
      slot.value.alt.length >= MAX_ALT
    );
  if (replaceMode.value) return inPlan.value.has(name);
  return !inPlan.value.has(name) && lineupFull.value;
}
const eqGroups = TIERS.map((tier) => ({
  tier,
  items: EQUIPMENT.filter((e) => e.tier === tier),
}));
const equipmentQuery = ref('');
const filteredEquipment = computed(() => {
  const query = normalize(equipmentQuery.value);
  return eqGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          !query ||
          nameScore(item.name, query) > 0 ||
          item.effect.includes(equipmentQuery.value.trim()),
      ),
    }))
    .filter((group) => group.items.length);
});
const stCategory = computed({
  get: () =>
    Math.max(
      0,
      CATEGORY_IDS.indexOf(
        queryText(
          routeQuery.value,
          'strategyCategory',
        ) as (typeof CATEGORY_IDS)[number],
      ),
    ),
  set: (index: number) => {
    void updateQuery({strategyCategory: CATEGORY_IDS[index] || null});
  },
});
const stList = computed(() => {
  const c = STRATEGY_CATEGORIES[stCategory.value];
  return STRATEGIES.filter(
    (s) =>
      c === '全部' ||
      (c === '阵营' ? isCoreCovenant(s.category) : s.category === c),
  );
});

/* ---------- 分享 / 导入 / 对比 ---------- */
const panel = computed({
  get: () => queryText(routeQuery.value, 'panel'),
  set: (value: string) => {
    void updateQuery({panel: value || null});
  },
});
const openPanel = (name: typeof panel.value): void => {
  panel.value = panel.value === name ? '' : name;
};
const other = computed({
  get: () => buildKey(queryText(routeQuery.value, 'compare')),
  set: (key: string) => {
    void updateQuery({compare: key ? buildId(key) : null});
  },
});
const otherPlan = computed<Plan | null>(
  () => presets.value.find((x) => x.key === other.value)?.plan ?? null,
);
const onlyMine = computed(
  () =>
    new Set(
      plan.value.ops
        .map((o) => o.name)
        .filter((n) => !otherPlan.value?.ops.some((o) => o.name === n)),
    ),
);
const onlyOther = computed(
  () =>
    new Set(
      (otherPlan.value?.ops ?? [])
        .map((o) => o.name)
        .filter((n) => !plan.value.ops.some((o) => o.name === n)),
    ),
);
const shared = computed(() => plan.value.ops.length - onlyMine.value.size);
</script>
<template>
  <div
    ref="root"
    :class="['pl', 'workbench-controls', {'pl-compact': compact}]">
    <PlannerSheet
      :open="compact && !!mobilePanel"
      :title="mobileTitle"
      :context="`${mobilePanel}:${slot?.name ?? ''}`"
      content-id="planner-mobile-content"
      :can-go-back="mobileCanGoBack"
      :fit="mobilePanel === 'slot'"
      @close="closeMobilePanel"
      @back="backToSlot" />
    <!-- 方案栏 -->
    <div id="build-editor-heading" class="pl-bar" role="group" aria-label="流派编辑器" tabindex="-1">
      <PlanIconPicker :key="editingId" :model-value="plan.icon" :base="plan.base" @update:model-value="setIcon" />
      <input
        v-model="plan.name"
        class="pl-name"
        maxlength="16"
        aria-label="流派名"
        @input="touch" />
      <span class="pl-acts">
        <button
          type="button"
          :class="{on: panel === 'share'}"
          :aria-expanded="panel === 'share'"
          :aria-controls="panel === 'share' ? 'planner-share' : undefined"
          @click="openPanel('share')">
          分享
        </button>
        <button
          type="button"
          :class="{on: panel === 'compare'}"
          :aria-expanded="panel === 'compare'"
          :aria-controls="panel === 'compare' ? 'planner-compare' : undefined"
          @click="openPanel('compare')">
          对比
        </button>
        <template v-if="!compact">
          <i class="sep"></i>
          <slot name="library" />
          <button type="button" :disabled="!canRun" @click="finishAndRun">
            完成并设为本局
          </button>
          <button type="button" class="pri" @click="emit('done')">完成</button>
        </template>
      </span>
    </div>

    <!-- 分享 -->
    <PlanSharePanel v-if="panel === 'share'" id="planner-share" :plan="plan" />

    <!-- 对比 -->
    <section v-if="panel === 'compare'" id="planner-compare" class="pl-panel">
      <SelectInput
        v-model="other"
        :options="compareOptions"
        aria-label="对比对象" />
      <template v-if="otherPlan">
        <div class="pl-diff">
          <span>
            相同
            <b>{{ shared }}</b>
          </span>
          <span class="a">
            只在这边
            <b>{{ onlyMine.size }}</b>
          </span>
          <span class="b">
            只在那边
            <b>{{ onlyOther.size }}</b>
          </span>
        </div>
        <div class="pl-cmp">
          <PlanSummary
            :ops="plan.ops"
            :strategy="plan.strategy"
            :strategy-alternates="plan.strategyAlternates"
            :note="plan.note"
            :layers="plan.layers"
            :title="plan.name"
            :icon="effectivePlanIcon(plan)"
            :highlight="onlyMine"
            compact />
          <PlanSummary
            :ops="otherPlan.ops"
            :strategy="otherPlan.strategy"
            :strategy-alternates="otherPlan.strategyAlternates"
            :note="otherPlan.note"
            :layers="otherPlan.layers"
            :title="otherPlan.name"
            :icon="effectivePlanIcon(otherPlan)"
            :highlight="onlyOther"
            compact />
        </div>
      </template>
    </section>

    <PlannerStages
      :key="editingId"
      v-model="editingStageKey"
      :stages="stages"
      @commit="commitStages" />

    <div class="pl-grid">
      <!-- 左栏自成一列，高度不受右侧干员池影响 -->
      <div class="pl-main">
        <!-- 阵容 -->
        <section
          v-show="!compact || mobileSection === 'lineup'"
          id="planner-lineup"
          class="pl-card pl-lineup">
          <h4>
            阵容
            <span class="tag">{{ ops.length }} / {{ MAX_OPS }}</span>
            <span class="hint">点头像编辑 · 小头像是过渡/备选</span>
          </h4>
          <div class="pl-slots">
            <button
              v-for="(s, i) in ops"
              :key="s.name"
              type="button"
              :class="[
                'pl-slot',
                {on: editing === i, el: s.elite, core: s.core},
              ]"
              :aria-expanded="editing === i"
              :aria-controls="
                editing === i
                  ? compact
                    ? 'planner-mobile-content'
                    : 'planner-slot-editor'
                  : undefined
              "
              :aria-haspopup="compact ? 'dialog' : undefined"
              :data-t="OPERATOR[s.name].tier"
              :data-op="s.name"
              :style="{'--i': i}"
              @click="editSlot(i)">
              <i class="no">{{ i + 1 }}</i>
              <span class="av">
                <img :src="avatarSrc(s.name)" alt="" width="56" height="56" />
                <b class="tr" :title="`${OPERATOR[s.name].tier} 阶`">
                  {{ TIER_LABELS[OPERATOR[s.name].tier] }}
                </b>
              </span>
              <span class="nm">
                <b
                  v-if="s.core"
                  class="pl-core-mark"
                  title="核心干员"
                  aria-label="核心干员">
                  ★
                </b>
                {{ s.name }}
              </span>
              <span class="dots">
                <u
                  v-for="c in OPERATOR[s.name].covenants"
                  :key="c"
                  :style="{'--c': color(c)}"></u>
              </span>
              <span v-if="s.eq.length" class="eqs">
                <img
                  v-for="(e, k) in s.eq"
                  :key="k"
                  :src="equipIconSrc(e)"
                  alt=""
                  width="16"
                  height="16" />
              </span>
              <span v-if="s.alt.length" class="alts">
                <img
                  v-for="a in s.alt"
                  :key="a"
                  :src="avatarSrc(a)"
                  :data-t="OPERATOR[a].tier"
                  alt=""
                  width="18"
                  height="18" />
              </span>
            </button>
            <button
              v-if="!lineupFull"
              type="button"
              class="pl-slot empty"
              :aria-label="`添加第 ${ops.length + 1} 名干员`"
              :aria-haspopup="compact ? 'dialog' : undefined"
              @click="openOperators()">
              <i class="no">{{ ops.length + 1 }}</i>
              +
            </button>
          </div>

          <div v-if="!ops.length" class="pl-starter">
            <div class="pl-starter-row">
              <span class="k">选主轴盟约开排</span>
              <div class="pl-starter-covs">
                <button
                  v-for="cov in CORE_COVENANTS"
                  :key="cov"
                  type="button"
                  :class="{on: poolCovenant === cov}"
                  :style="{'--c': color(cov)}"
                  @click="startWithCovenant(cov)">
                  <CovenantIcon :name="cov" />
                  {{ cov }}
                </button>
              </div>
            </div>
            <label class="pl-starter-row">
              <span class="k">或套用现有流派微调</span>
              <SelectInput
                model-value=""
                :options="templatePresetOptions"
                aria-label="套用现有流派微调"
                @update:model-value="applyTemplatePreset" />
            </label>
          </div>

          <Teleport :to="panelTarget" :disabled="!compact" defer>
            <div
              v-if="
                slot &&
                (!compact ||
                  mobilePanel === 'slot' ||
                  mobilePanel === 'equipment')
              "
              id="planner-slot-editor"
              class="pl-edit">
              <template v-if="!compact || mobilePanel === 'slot'">
                <div class="pl-edit-head">
                  <span class="pl-edit-av" :data-t="OPERATOR[slot.name].tier">
                    <img
                      :src="avatarSrc(slot.name)"
                      alt=""
                      width="44"
                      height="44" />
                  </span>
                  <span class="pl-edit-id">
                    <b>{{ slot.name }}</b>
                    <small>
                      {{ TIER_LABELS[OPERATOR[slot.name].tier] }} 阶 ·
                      <template
                        v-for="(c, k) in OPERATOR[slot.name].covenants"
                        :key="c">
                        <template v-if="k">·</template>
                        <span :style="{color: color(c)}">{{ c }}</span>
                      </template>
                    </small>
                  </span>
                  <span class="pl-edit-flags">
                    <button
                      type="button"
                      class="pl-detail-btn"
                      @click="actions.openDetail('op', slot.name)">
                      详情
                    </button>
                    <Segmented
                      :labels="['初始', '精锐']"
                      :active="slot.elite ? 1 : 0"
                      attr="ple"
                      @change="
                        slot.elite = $event === 1;
                        touch();
                      " />
                    <button
                      type="button"
                      :class="['pl-core-toggle', {on: slot.core}]"
                      :aria-pressed="slot.core"
                      aria-label="核心干员"
                      @click="
                        slot.core = !slot.core;
                        touch();
                      ">
                      {{ slot.core ? '★ 核心' : '☆ 核心' }}
                    </button>
                  </span>
                </div>
                <p
                  class="pl-trait"
                  v-html="
                    fx(
                      slot.elite
                        ? OPERATOR[slot.name].elite
                        : OPERATOR[slot.name].trait,
                    )
                  "></p>
                <div class="pl-edit-line">
                  <span class="k">装备</span>
                  <span class="pl-edit-cells">
                    <template v-for="k in MAX_EQ" :key="k">
                      <button
                        v-if="slot.eq[k - 1]"
                        type="button"
                        class="pl-eq"
                        :data-t="EQUIP[slot.eq[k - 1]].tier"
                        :data-eq="slot.eq[k - 1]"
                        :aria-label="`卸下${slot.eq[k - 1]}`"
                        @click="dropEquip(k - 1)">
                        <img
                          :src="equipIconSrc(slot.eq[k - 1])"
                          alt=""
                          width="22"
                          height="22" />
                        <span>{{ slot.eq[k - 1] }}</span>
                        <i aria-hidden="true">×</i>
                      </button>
                      <button
                        v-else-if="k === slot.eq.length + 1"
                        type="button"
                        :class="['pl-eq', 'add', {on: picking === 'eq'}]"
                        :aria-expanded="picking === 'eq'"
                        :aria-controls="
                          picking === 'eq' ? 'planner-equipment' : undefined
                        "
                        @click="openPicker('eq')">
                        ＋ 装备
                      </button>
                      <span
                        v-else
                        class="pl-eq ghost"
                        aria-hidden="true"></span>
                    </template>
                  </span>
                </div>
                <div class="pl-edit-line pl-alts">
                  <span class="k">过渡/备选</span>
                  <span class="pl-edit-cells">
                    <span
                      v-for="(a, k) in slot.alt"
                      :key="a"
                      class="pl-alt"
                      :data-t="OPERATOR[a].tier"
                      :data-op="a">
                      <button
                        type="button"
                        :disabled="inPlan.has(a)"
                        :title="inPlan.has(a) ? '已在阵容里' : '换上场'"
                        @click="swapAlt(k)">
                        <img
                          :src="avatarSrc(a)"
                          alt=""
                          width="24"
                          height="24" />
                        {{ a }}
                        <b>⇄</b>
                      </button>
                      <button
                        type="button"
                        class="x"
                        aria-label="移除过渡/备选"
                        @click="dropAlt(k)">
                        ×
                      </button>
                    </span>
                    <button
                      v-if="slot.alt.length < MAX_ALT"
                      type="button"
                      :class="['pl-eq', 'add', {on: picking === 'alt'}]"
                      :aria-expanded="picking === 'alt'"
                      :aria-controls="
                        picking === 'alt' ? 'planner-alternatives' : undefined
                      "
                      @click="openPicker('alt')">
                      ＋ 过渡/备选
                    </button>
                  </span>
                </div>
                <div
                  v-if="!compact && picking === 'alt'"
                  id="planner-alternatives"
                  class="pl-pick pl-altpick">
                  <span class="hint">
                    前期打工或抓不到主选时的平替，设本局后盟约页同步高亮 ·
                    也可在右侧列表点选
                  </span>
                  <template v-if="earlyTransitionSuggest.length">
                    <span class="pl-altpick-sub">前期打工（Ⅰ–Ⅱ 阶同盟约）</span>
                    <div class="pl-pick-g">
                      <button
                        v-for="o in earlyTransitionSuggest"
                        :key="o.name"
                        type="button"
                        :data-t="o.tier"
                        :data-op="o.name"
                        @click="addAlt(o.name)">
                        <img
                          :src="avatarSrc(o.name)"
                          alt=""
                          width="34"
                          height="34"
                          loading="lazy" />
                        <small>{{ TIER_LABELS[o.tier] }} {{ o.name }}</small>
                        <span class="dots">
                          <u
                            v-for="c in o.covenants"
                            :key="c"
                            :style="{'--c': color(c)}"></u>
                        </span>
                      </button>
                    </div>
                  </template>
                  <template v-if="altSuggest.length">
                    <span
                      v-if="earlyTransitionSuggest.length"
                      class="pl-altpick-sub">
                      同位平替（抓不到时替换）
                    </span>
                    <div class="pl-pick-g">
                      <button
                        v-for="o in altSuggest"
                        :key="o.name"
                        type="button"
                        :data-t="o.tier"
                        :data-op="o.name"
                        @click="addAlt(o.name)">
                        <img
                          :src="avatarSrc(o.name)"
                          alt=""
                          width="34"
                          height="34"
                          loading="lazy" />
                        <small>
                          {{ o.name }}
                          <em v-if="isOpSub(o.name)" class="pl-sub-note">
                            需借
                          </em>
                        </small>
                        <span class="dots">
                          <u
                            v-for="c in o.covenants"
                            :key="c"
                            :style="{'--c': color(c)}"></u>
                        </span>
                      </button>
                    </div>
                  </template>
                </div>
                <div class="pl-edit-actions">
                  <span class="pl-move">
                    <button
                      type="button"
                      :disabled="editing === 0"
                      @click="move(-1)">
                      ‹ 左移
                    </button>
                    <button
                      type="button"
                      :disabled="editing === ops.length - 1"
                      @click="move(1)">
                      右移 ›
                    </button>
                  </span>
                  <button
                    type="button"
                    :class="{on: replaceMode}"
                    :aria-pressed="!compact ? replaceMode : undefined"
                    @click="
                      !compact && replaceMode
                        ? (replacing = false)
                        : openOperators(true)
                    ">
                    {{ !compact && replaceMode ? '取消更换' : '更换' }}
                  </button>
                  <ConfirmButton
                    label="移出"
                    confirm-label="确认移出"
                    :reset-key="slot.name"
                    @confirm="removeSlot" />
                </div>
              </template>
              <div
                v-if="picking === 'eq'"
                id="planner-equipment"
                class="pl-pick pl-eqpick">
                <SearchInput
                  v-model="equipmentQuery"
                  class="pl-paste"
                  placeholder="装备名字 / 拼音 / 效果"
                  aria-label="搜索装备" />
                <div
                  v-for="g in filteredEquipment"
                  :key="g.tier"
                  class="pl-pick-g">
                  <i class="tier" :data-t="g.tier">{{ TIER_LABELS[g.tier] }}</i>
                  <button
                    v-for="e in g.items"
                    :key="e.name"
                    type="button"
                    :data-t="e.tier"
                    :data-eq="e.name"
                    :class="{on: slot.eq.includes(e.name)}"
                    @click="addEquip(e.name)">
                    <img
                      :src="equipIconSrc(e.name)"
                      alt=""
                      width="30"
                      height="30"
                      loading="lazy" />
                    <small>{{ e.name }}</small>
                  </button>
                </div>
                <EmptyState
                  v-if="!filteredEquipment.length"
                  compact
                  message="没有匹配的装备" />
              </div>
            </div>
          </Teleport>

          <div class="pl-stats">
            <span>
              <b>{{ cost.recruit }}</b>
              招募
            </span>
            <span>
              <b>{{ cost.equipment }}</b>
              装备
            </span>
            <span>
              <b>{{ active.length }}</b>
              激活盟约
            </span>
            <span>
              <b>{{ cost.elites }}</b>
              精锐
            </span>
          </div>

          <div v-if="ops.length" class="pl-diag" aria-label="阵容实战职能体检">
            <span class="k">
              职能体检
              <small v-if="diagnostics.missingEssential.length" class="warn">
                缺
                {{
                  diagnostics.missingEssential.map((e) => e.role).join(' / ')
                }}
              </small>
              <small
                v-else-if="
                  diagnostics.substituteRisks.some((risk) => risk.essential)
                "
                class="warn">
                基础职能待确认
              </small>
              <small v-else class="ok">基础完备</small>
            </span>
            <div class="pl-diag-chips">
              <button
                v-for="entry in diagnostics.entries"
                :key="entry.role"
                type="button"
                :class="[
                  'pl-diag-chip',
                  {
                    ok: entry.providers.length > 0 && !entry.substituteOnly,
                    risk: !!entry.substituteOnly,
                    miss: entry.essential && entry.providers.length === 0,
                    on: poolRole === entry.role,
                  },
                ]"
                :aria-pressed="poolRole === entry.role"
                :title="
                  entry.substituteOnly
                    ? `${entry.role}：原方案来源为${entry.providers.join('、')}，替补上场后的覆盖需确认（点击筛选补位）`
                    : entry.providers.length
                      ? `${entry.role}：${entry.providers.join('、')}（点击在干员池中筛选）`
                      : `${entry.role}：${entry.desc}（当前未覆盖，点击筛选补位）`
                "
                @click="filterPoolByRole(entry.role)">
                <span>{{ entry.role }}</span>
                <b v-if="entry.substituteOnly">替</b>
                <b v-else-if="entry.providers.length">
                  {{ entry.providers.length }}
                </b>
                <b v-else-if="entry.essential">缺</b>
              </button>
            </div>
            <div v-if="riskBorrowTargets.length" class="pl-diag-risk">
              <div class="pl-diag-risk-text">
                <b>替补上场后需确认的职能</b>
                <div v-for="target in riskBorrowTargets" :key="target.name">
                  {{ target.name }} → {{ target.backup || '替补' }} ·
                  {{ target.roles.join(' / ') }}
                </div>
              </div>
              <button
                v-if="diagnostics.borrowPlan.names.length"
                type="button"
                class="pl-diag-borrow"
                :title="`可补足：${diagnostics.borrowPlan.roles.join('、')}`"
                @click="borrowRiskOperators(diagnostics.borrowPlan.names)">
                借用{{ diagnostics.borrowPlan.names.join('、') }} · 补
                {{ diagnostics.borrowPlan.roles.length }} 项职能
              </button>
              <template
                v-if="
                  remainingBorrows &&
                  riskBorrowTargets.length > diagnostics.borrowPlan.names.length
                ">
                <span>还可借 {{ remainingBorrows }} 名</span>
                <button
                  v-for="target in riskBorrowTargets"
                  :key="target.name"
                  type="button"
                  class="pl-diag-borrow"
                  @click="borrowRiskOperators([target.name])">
                  借用{{ target.name }}
                </button>
              </template>
              <span v-if="!remainingBorrows">
                助战名额已满（{{ boxSeasonBorrowedCount }}/{{ BORROW_LIMIT }}）
              </span>
            </div>
            <StatusNotice
              v-if="riskBorrowError"
              tone="danger"
              :message="riskBorrowError"
              dismissible
              @dismiss="riskBorrowError = ''" />
          </div>

          <div class="pl-strategies">
            <div class="pl-strategies-heading">
              <b>{{ stages.length ? '流派策略（各阶段共用）' : '流派策略' }}</b>
              <small>{{ strategies.length }} / {{ MAX_STRATEGIES }}</small>
            </div>
            <ol
              v-if="strategies.length"
              class="pl-strategies-list"
              aria-label="流派策略优先顺序">
              <li v-for="(name, index) in strategies" :key="name">
                <div class="pl-strategies-row">
                  <button
                    type="button"
                    :class="[
                      'pl-st-b',
                      {on: picking === 'st' && strategyEdit === index},
                    ]"
                    :aria-label="`更换${index === 0 ? '首选策略' : '备选策略 ' + index} ${name}`"
                    :aria-expanded="picking === 'st' && strategyEdit === index"
                    :data-st="name"
                    @click="openStrategies(index)">
                    <img
                      :src="portraitSrc(name)"
                      alt=""
                      width="36"
                      height="36" />
                    <span>
                      <small>
                        {{ index === 0 ? '首选' : '备选 ' + index }}
                      </small>
                      <b>{{ name }}</b>
                    </span>
                  </button>
                  <div class="pl-strategy-actions">
                    <button
                      v-if="strategies.length > 1"
                      class="btn"
                      type="button"
                      :aria-label="`上移策略 ${name}`"
                      :disabled="index === 0"
                      @click="moveStrategy(index, -1)">
                      ↑
                    </button>
                    <button
                      v-if="strategies.length > 1"
                      class="btn"
                      type="button"
                      :aria-label="`下移策略 ${name}`"
                      :disabled="index === strategies.length - 1"
                      @click="moveStrategy(index, 1)">
                      ↓
                    </button>
                    <ConfirmButton
                      label="移除"
                      :confirm-label="`移除${name}`"
                      @confirm="removeStrategy(name)" />
                  </div>
                </div>
                <p v-if="index === 0" v-html="fx(STRATEGY[name].effect)"></p>
              </li>
            </ol>
            <button
              v-if="strategies.length < MAX_STRATEGIES"
              type="button"
              class="btn pl-add-strategy"
              :aria-expanded="picking === 'st' && strategyEdit < 0"
              :aria-controls="
                picking === 'st' && strategyEdit < 0
                  ? 'planner-strategies'
                  : undefined
              "
              @click="openStrategies(-1)">
              {{ strategies.length ? '＋ 添加备选策略' : '＋ 选择首选策略' }}
            </button>
          </div>
          <Teleport :to="panelTarget" :disabled="!compact" defer>
            <div
              v-if="picking === 'st'"
              id="planner-strategies"
              class="pl-pick stp">
              <div v-if="replacingStrategy" class="pl-st-current">
                <img
                  :src="portraitSrc(replacingStrategy.name)"
                  alt=""
                  width="40"
                  height="40" />
                <span>
                  <small>正在更换 · {{ replacingStrategy.category }}</small>
                  <b>{{ replacingStrategy.name }}</b>
                  <span v-html="fx(replacingStrategy.effect)"></span>
                </span>
              </div>
              <Segmented
                :labels="STRATEGY_CATEGORIES"
                :active="stCategory"
                attr="plsc"
                @change="stCategory = $event" />
              <div class="pl-pick-g">
                <button
                  v-for="s in stList"
                  :key="s.name"
                  type="button"
                  :class="{on: strategies.includes(s.name)}"
                  :aria-pressed="strategies.includes(s.name)"
                  :disabled="strategies.includes(s.name)"
                  :data-st="s.name"
                  @click="pickStrategy(s.name)">
                  <img
                    :src="portraitSrc(s.name)"
                    alt=""
                    width="34"
                    height="34"
                    loading="lazy" />
                  <small>{{ s.name }}</small>
                  <em>{{ s.category }}</em>
                </button>
              </div>
            </div>
          </Teleport>
          <details class="pl-note-fold" :open="!compact">
            <summary v-show="compact">
              {{ stage ? '阶段说明' : '流派说明' }}
              <span class="hint">
                {{ formation.note.length }}/{{ MAX_NOTE }}
              </span>
            </summary>
            <div class="pl-note-box">
              <div class="pl-note-head">
                <span class="k">
                  {{
                    stage
                      ? stageLabel(stage) + '打法要点'
                      : '打法要点与抓牌说明'
                  }}
                </span>
                <span class="pl-note-prompts">
                  <button
                    v-for="[label, prefix] in NOTE_PROMPTS"
                    :key="label"
                    type="button"
                    @click="insertNotePrompt(prefix)">
                    {{ label }}
                  </button>
                </span>
              </div>
              <label class="pl-note">
                <textarea
                  ref="noteInput"
                  v-model="formation.note"
                  :maxlength="MAX_NOTE"
                  rows="4"
                  placeholder="可分行写：前期谁过渡、几本找核心、装备给谁、抓不到核心怎么平替"
                  :aria-label="stage ? '阶段说明' : '流派说明'"
                  @input="touch"></textarea>
                <small>{{ formation.note.length }}/{{ MAX_NOTE }}</small>
              </label>
            </div>
          </details>
        </section>

        <!-- 盟约 -->
        <section
          v-show="!compact || mobileSection === 'effects'"
          id="planner-covenants"
          class="pl-card pl-cov">
          <h4>
            盟约
            <span class="tag">{{ active.length }} 激活</span>
            <span class="hint">点盟约名筛干员</span>
          </h4>
          <PlanCovenants
            :stats="stats"
            :layers="formation.layers"
            interactive
            :selected="poolCovenant"
            @select="onSelectPlanCovenant" />
        </section>

        <!-- 补位 -->
        <section
          v-if="(!compact || mobileSection === 'lineup') && recs.length"
          class="pl-card pl-rec">
          <h4>
            补谁
            <span class="hint">加入后跨过的门槛</span>
          </h4>
          <div class="pl-recs">
            <button
              v-for="r in recs"
              :key="r.op.name"
              type="button"
              class="pl-r"
              :data-t="r.op.tier"
              :data-op="r.op.name"
              @click="toggle(r.op.name)">
              <img
                :src="avatarSrc(r.op.name)"
                alt=""
                width="40"
                height="40"
                loading="lazy" />
              <span>
                <b>
                  {{ r.op.name }}
                  <em v-if="isOpSub(r.op.name)" class="pl-sub-note">需借</em>
                </b>
                <span class="g">
                  <i
                    v-for="g in r.gains"
                    :key="g.covenant"
                    :class="g.kind === 'weaken' ? 'off' : g.kind"
                    :style="{'--c': color(g.covenant)}">
                    <CovenantIcon :name="g.covenant" />
                    {{ g.covenant }} {{ GAIN[g.kind] }}
                  </i>
                </span>
              </span>
            </button>
          </div>
        </section>

        <!-- 效果 -->
        <section
          v-show="!compact || mobileSection === 'effects'"
          id="planner-effects"
          class="pl-card pl-fx">
          <h4>
            效果
            <span class="hint">有层数的盟约各自拖动 / 填写</span>
          </h4>
          <ul class="pl-fxl">
            <li
              v-for="s in active"
              :key="s.name"
              :style="{'--c': color(s.name)}">
              <b class="n">
                <CovenantIcon :name="s.name" />
                {{ s.name }}
              </b>
              <div>
                <label v-if="usesLayers(s.name)" class="pl-layer">
                  <input
                    type="range"
                    min="0"
                    :max="Math.max(LAYER_SLIDER, layerOf(s.name))"
                    step="10"
                    :value="layerOf(s.name)"
                    :aria-label="`${s.name}层数`"
                    @input="
                      setLayers(
                        s.name,
                        +($event.target as HTMLInputElement).value,
                      )
                    " />
                  <input
                    type="number"
                    min="0"
                    :max="MAX_LAYERS"
                    inputmode="numeric"
                    :value="layerOf(s.name)"
                    :aria-label="`${s.name}层数`"
                    @change="
                      setLayers(
                        s.name,
                        +($event.target as HTMLInputElement).value,
                      )
                    " />
                  <span>层</span>
                </label>
                <p
                  v-html="
                    fx(atLayers(COVENANTS[s.name].effect, layerOf(s.name)))
                  "></p>
                <p
                  v-if="COVENANTS[s.name].bonus"
                  :class="['bn', {on: s.bonusActive}]"
                  v-html="
                    fx(atLayers(COVENANTS[s.name].bonus, layerOf(s.name)))
                  "></p>
              </div>
            </li>
            <li v-if="!active.length" class="none">还没有激活的盟约</li>
          </ul>
          <ul v-if="notes.length" class="pl-notes">
            <li v-for="(n, i) in notes" :key="i" :class="n.kind">
              <b>{{ n.op }}</b>
              <GlossaryText :text="n.text" />
              <span v-if="n.result" class="pl-note-result" v-html="fx(n.result)"></span>
            </li>
          </ul>
        </section>
      </div>

      <!-- 干员池 -->
      <Teleport :to="panelTarget" :disabled="!compact" defer>
        <section
          v-if="!compact || mobilePoolOpen"
          :class="['pl-card', 'pl-pool', {replacing: replaceMode}]">
          <h4>
            干员
            <span class="tag">{{ pool.length }}</span>
            <span class="hint">★ 能推进已有盟约</span>
          </h4>
          <div v-if="picking === 'alt' && slot" class="pl-altbar">
            <span>
              点选干员 → 加为
              <b>{{ slot.name }}</b>
              的过渡/备选（前期打工或平替，{{ slot.alt.length }}/{{ MAX_ALT }}）
            </span>
            <button v-if="!compact" type="button" @click="openPicker('alt')">
              完成
            </button>
          </div>
          <div v-else-if="replaceMode && slot" class="pl-altbar">
            <span>
              点选干员 → 替换第 {{ editing + 1 }} 位的
              <b>{{ slot.name }}</b>
              ，保留装备
            </span>
            <button v-if="!compact" type="button" @click="replacing = false">
              取消
            </button>
          </div>
          <p v-else-if="lineupFull" class="pl-full-hint">
            阵容已满 {{ MAX_OPS }}/{{ MAX_OPS }}。{{
              compact
                ? '点上面的已选干员可移出，再添加新的。'
                : '点已选的干员可移出；或选中左侧阵容里的干员，点「更换」直接替换。'
            }}
          </p>
          <div
            v-if="compact && mobilePanel === 'operators' && ops.length"
            class="pl-selected"
            aria-label="已选干员">
            <button
              v-for="member in ops"
              :key="member.name"
              type="button"
              :aria-label="`移出 ${member.name}`"
              @click="toggle(member.name)">
              {{ member.name }} ×
            </button>
          </div>
          <div class="pl-filter">
            <SearchInput
              v-model="poolQuery"
              placeholder="名字 / 拼音 / 特质词"
              aria-label="搜索干员" />
            <SelectInput
              v-model="poolCovenant"
              :options="POOL_COVENANT_OPTIONS"
              highlight-active
              aria-label="盟约" />
            <SelectInput
              v-model="poolType"
              :options="POOL_TYPE_OPTIONS"
              highlight-active
              aria-label="特质类型" />
            <SelectInput
              v-model="poolRole"
              :options="POOL_ROLE_OPTIONS"
              highlight-active
              aria-label="实战职能" />
            <Segmented
              :labels="['全部', ...TIER_LABELS.slice(1)]"
              :active="poolTier"
              attr="plt"
              @change="poolTier = $event" />
            <button
              v-if="hasAnyBox"
              type="button"
              :class="['pl-box-filter', {on: poolAvailableOnly}]"
              :aria-pressed="poolAvailableOnly"
              title="隐藏未持有且未借用（将变替补）的非特许 6★"
              @click="poolAvailableOnly = !poolAvailableOnly">
              {{ poolAvailableOnly ? '✓ 仅看本体可用' : '仅看本体可用' }}
            </button>
            <button
              v-if="hasPoolFilter"
              type="button"
              class="filter-clear"
              @click="resetPoolFilters">
              重置
            </button>
          </div>
          <div
            v-if="
              compact &&
              picking === 'alt' &&
              (earlyTransitionSuggest.length || altSuggest.length) &&
              !hasPoolFilter
            "
            class="pl-pick pl-altpick">
            <h4>推荐过渡 / 备选</h4>
            <template v-if="earlyTransitionSuggest.length">
              <span class="pl-altpick-sub">前期打工（Ⅰ–Ⅱ 阶同盟约）</span>
              <div class="pl-pick-g">
                <button
                  v-for="o in earlyTransitionSuggest"
                  :key="o.name"
                  type="button"
                  :data-t="o.tier"
                  :data-op="o.name"
                  :disabled="poolDisabled(o.name)"
                  @click="addAlt(o.name)">
                  <img
                    :src="avatarSrc(o.name)"
                    alt=""
                    width="34"
                    height="34"
                    loading="lazy" />
                  <small>{{ TIER_LABELS[o.tier] }} {{ o.name }}</small>
                </button>
              </div>
            </template>
            <template v-if="altSuggest.length">
              <span v-if="earlyTransitionSuggest.length" class="pl-altpick-sub">
                同位平替（抓不到时替换）
              </span>
              <div class="pl-pick-g">
                <button
                  v-for="o in altSuggest"
                  :key="o.name"
                  type="button"
                  :data-t="o.tier"
                  :data-op="o.name"
                  :disabled="poolDisabled(o.name)"
                  @click="addAlt(o.name)">
                  <img
                    :src="avatarSrc(o.name)"
                    alt=""
                    width="34"
                    height="34"
                    loading="lazy" />
                  <small>
                    {{ o.name }}
                    <em v-if="isOpSub(o.name)" class="pl-sub-note">需借</em>
                  </small>
                </button>
              </div>
            </template>
          </div>
          <template v-for="g in poolGroups" :key="g.tier">
            <div class="tierh" :data-t="g.tier">
              <i>{{ TIER_LABELS[g.tier] }}</i>
              <span>{{ g.items.length }}</span>
            </div>
            <div class="pl-tiles">
              <button
                v-for="o in g.items"
                :key="o.name"
                type="button"
                :class="[
                  'tile',
                  {
                    in: inPlan.has(o.name),
                    alt: slot?.alt.includes(o.name),
                    rec:
                      !inPlan.has(o.name) &&
                      o.covenants.some((c) => present.has(c)),
                    'is-sub': isOpSub(o.name),
                  },
                ]"
                :data-t="o.tier"
                :data-op="o.name"
                :title="
                  isOpSub(o.name)
                    ? `${o.name}：未持有且未借用${o.backupOperator ? `，将替补为「${o.backupOperator}」` : ''}`
                    : undefined
                "
                :aria-pressed="
                  picking === 'alt'
                    ? !!slot?.alt.includes(o.name)
                    : inPlan.has(o.name)
                "
                :disabled="poolDisabled(o.name)"
                @click="toggle(o.name)">
                <img
                  :src="avatarSrc(o.name)"
                  alt=""
                  width="80"
                  height="80"
                  loading="lazy"
                  decoding="async" />
                <span>{{ o.name }}</span>
                <span class="dots">
                  <u
                    v-for="c in o.covenants"
                    :key="c"
                    :style="{'--c': color(c)}"></u>
                </span>
              </button>
            </div>
          </template>
          <EmptyState
            v-if="!pool.length"
            compact
            message="没有匹配的干员"
            action-label="清空筛选"
            :show-action="hasPoolFilter"
            @action="resetPoolFilters" />
        </section>
      </Teleport>
    </div>
    <nav
      v-if="compact"
      class="pl-mobile-actions"
      aria-label="流派编辑操作"
      data-noswipe>
      <button
        type="button"
        :class="{on: mobileSection === 'lineup'}"
        :aria-pressed="mobileSection === 'lineup'"
        aria-controls="planner-lineup"
        @click="showSection('lineup')">
        阵容
      </button>
      <button
        type="button"
        :class="{on: mobileSection === 'effects'}"
        :aria-pressed="mobileSection === 'effects'"
        aria-controls="planner-covenants planner-effects"
        @click="showSection('effects')">
        盟约
      </button>
      <button type="button" aria-haspopup="dialog" @click="openOperators()">
        ＋ 干员
      </button>
      <button type="button" @click="emit('done')">完成</button>
      <slot name="library" />
      <button
        type="button"
        class="pri"
        :disabled="!canRun"
        @click="finishAndRun">
        设为本局
      </button>
    </nav>
  </div>
</template>

<style scoped>
.pl-mobile-actions {
  grid-template-columns: .75fr .75fr 1fr .75fr 1.35fr 1.25fr;
}
@container quickref-view (max-width: 440px) {
  .pl-mobile-actions {
    column-gap: 3px;
  }
  .pl-mobile-actions button,
  .pl-mobile-actions :slotted(.build-picker-trigger) {
    padding-inline: 2px;
    font-size: 12px;
  }
  .pl-mobile-actions :deep(.build-picker-trigger svg) {
    display: none;
  }
}
.pl-strategies {
  display: grid;
  gap: 6px;
  margin-top: 12px;
}
.pl-strategies-heading,
.pl-strategies-row,
.pl-strategy-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.pl-strategies-heading {
  font-size: 13px;
}
.pl-strategies-heading small {
  font: 12px var(--fn);
  color: var(--ink3);
}
.pl-strategies-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 6px;
}
.pl-strategies-list li {
  padding: 5px 8px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface2);
}
.pl-strategies-row {
  justify-content: space-between;
}
.pl-strategies-row > button {
  max-width: 100%;
}
.pl-strategies-list p {
  margin: 4px 0 0;
  color: var(--ink2);
  font-size: 12px;
  line-height: 1.55;
}
.pl-strategy-actions .btn {
  min-width: 34px;
  min-height: 34px;
  padding-inline: 6px;
}
.pl-add-strategy {
  justify-self: start;
  min-height: 34px;
}
@media (max-height: 600px) {
  .pl-strategies {
    margin-top: 8px;
  }
  .pl-strategies-list {
    gap: 4px;
  }
}
.pl-diag {
  display: grid;
  gap: 8px;
  margin-top: 10px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface2);
}
.pl-diag > .k {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 6px 10px;
  font-size: 12px;
  font-weight: 700;
  color: var(--ink2);
}
.pl-diag > .k small {
  font-weight: 600;
  font-size: 11.5px;
}
.pl-diag > .k small.warn {
  color: var(--red);
}
.pl-diag > .k small.ok {
  color: var(--teal);
}
.pl-diag-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.pl-diag-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 30px;
  padding: 2px 9px;
  border: 1px dashed var(--line2);
  border-radius: 999px;
  background: var(--surface);
  color: var(--ink3);
  font: inherit;
  font-size: 11.5px;
  cursor: pointer;
  transition:
    border-color 0.12s,
    color 0.12s,
    background-color 0.12s;
}
.pl-diag-chip:hover {
  border-color: var(--accent);
  color: var(--ink);
}
.pl-diag-chip.ok {
  border-style: solid;
  border-color: color-mix(in srgb, var(--teal) 45%, var(--line2));
  background: var(--teal-soft);
  color: var(--teal);
}
.pl-diag-chip.miss {
  border-style: dashed;
  border-color: color-mix(in srgb, var(--red) 55%, var(--line2));
  background: color-mix(in srgb, var(--red) 5%, var(--surface));
  color: var(--red);
}
.pl-diag-chip.risk {
  border-style: dashed;
  border-color: color-mix(in srgb, var(--accent) 65%, var(--line2));
  background: color-mix(in srgb, var(--accent) 8%, var(--surface));
  color: var(--accent);
}
.pl-diag-risk {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 7px;
  border: 1px dashed color-mix(in srgb, var(--accent) 55%, var(--line2));
  background: color-mix(in srgb, var(--accent) 7%, var(--surface));
  font-size: 12px;
  color: var(--ink2);
}
.pl-diag-risk-text {
  line-height: 1.45;
  flex: 1 1 240px;
}
.pl-diag-risk-text b {
  color: var(--accent);
}
.pl-diag-borrow {
  min-height: 34px;
  padding: 0 10px;
  border: 1px solid var(--accent);
  border-radius: 6px;
  background: var(--accent);
  color: var(--accent-ink);
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  max-width: 100%;
  overflow-wrap: anywhere;
  cursor: pointer;
}
.pl-sub-note {
  font-style: normal;
  font-size: 10.5px;
  font-weight: 700;
  padding: 0 4px;
  margin-left: 4px;
  border-radius: 4px;
  border: 1px dashed color-mix(in srgb, var(--accent) 55%, var(--line2));
  color: var(--accent);
}
.pl-box-filter {
  min-height: 34px;
  padding: 0 10px;
  border: 1px solid var(--line2);
  border-radius: 7px;
  background: var(--surface);
  color: var(--ink2);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}
.pl-box-filter.on {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--accent-ink);
}
.pl-tiles .tile.is-sub {
  opacity: 0.62;
  border-style: dashed;
}
.pl-tiles .tile.is-sub:hover {
  opacity: 1;
}
.pl-diag-chip.on {
  border-style: solid;
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 700;
}
.pl-diag-chip b {
  font-family: var(--fn);
  font-size: 10.5px;
}
@media (pointer: coarse), (max-height: 600px) {
  .pl-diag-chip {
    min-height: 34px;
  }
}
</style>
