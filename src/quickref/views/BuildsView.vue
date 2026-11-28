<script setup lang="ts">
import {computed, nextTick, onUnmounted, ref, watch} from 'vue';
import {
  BORROW_LIMIT,
  CORE_BUILDS,
  COVENANTS,
  DEFAULT_BUILD_ID,
  OPERATOR,
  STRATEGY,
  TIER_LABELS,
  buildByName,
  isBannableCovenant,
  type Operator,
} from '../../../data/index.ts';
import {
  evaluateLineupBox,
  type LineupBoxAssessment,
} from '../../lib/box/insights.ts';
import {BOX_RANK_BORROWED} from '../../lib/box/model.ts';
import {
  boxSeasonBorrowedCount,
  hasAnyBox,
  operatorBox,
  setOperatorRanks,
} from '../../lib/box/store.ts';
import {isFloatingWindow} from '../../lib/ui/windowMode.ts';
import {prefersReducedMotion} from '../../lib/ui/dom.ts';
import {avatarSrc} from '../../lib/ui/assets.ts';
import {
  covenantStats,
  equipNotes,
  planCost,
  type PlanOp,
} from '../../lib/plans/core.ts';
import {settings, updateSetting} from '../../lib/settings/store.ts';
import {useQuickrefActions} from '../state.ts';
import {useCompactPlanner} from '../planner/useCompactPlanner.ts';
import {
  presetOf,
  presetFormation,
  presets,
  current,
  editing,
  runKey,
  runStageKey,
  stageKey,
  stageLabel,
  hasPlanOperators,
  endRun,
  runBans,
  runBanSet,
  isRunBannedOp,
  saveErrorMessage,
  presetColor,
  selectPreset,
  newPreset,
  copyPreset,
  removePreset,
  restorePreset,
  startEdit,
  finishEdit,
  setRun,
  applyGuideUpdate,
} from '../planStore.ts';
import {
  fetchSklandGuide,
  isCurrentGuideSeason,
} from '../../lib/plans/skland.ts';
import {isPlanShareHash} from '../../lib/plans/shareInput.ts';
import SklandGuideDetails from '../components/SklandGuideDetails.vue';
import GlossaryText from '../components/GlossaryText.vue';
import {color, fx} from '../format.ts';
import {lineupEquipment, stageOf} from '../../lib/plans/lineup.ts';
import {covenantEffectCard} from '../covenantEffect.ts';
import Chip from '../components/Chip.vue';
import CovenantIcon from '../components/CovenantIcon.vue';
import PlanEmblem from '../components/PlanEmblem.vue';
import {effectivePlanIcon} from '../../lib/plans/model.ts';
import OperatorTile from '../components/OperatorTile.vue';
import BuildPicker from '../components/BuildPicker.vue';
import BuildSwitchButton from '../components/BuildSwitchButton.vue';
import BuildStageSwitcher from '../components/BuildStageSwitcher.vue';
import OperatorRequestButton from '../components/OperatorRequestButton.vue';
import SubTabs, {
  subTabPanelAttrs,
  type SubTabDirection,
  type SubTabItem,
} from '../components/SubTabs.vue';
import ConfirmButton from '../components/ConfirmButton.vue';
import EmptyState from '../components/EmptyState.vue';
import SectionHeading from '../components/SectionHeading.vue';
import StatusNotice from '../components/StatusNotice.vue';

const lineupDir = ref<SubTabDirection>('');
/**
 * 流派：内置流派和我的流派都是预设。默认只读查看，局内扫一眼；点「编辑」进入规划器。
 * 「本局打这套」把它设为本局流派，盟约 / 效果 / 干员页随之高亮。
 */
import {lazyView} from '../../lib/ui/lazyView.ts';
import {
  currentRoute,
  routeQuery,
  updateQuery,
  navigate,
  buildLocation,
} from '../../router/navigation.ts';
import {buildKey} from '../../router/entities.ts';
import {queryText} from '../../router/location.ts';
import {routeNotice} from '../../router/index.ts';
const BuildBanPanel = lazyView(
  () => import('../components/BuildBanPanel.vue'),
);
const BuildImportPanel = lazyView(() => import('../components/BuildImportPanel.vue'));
const PlanSharePanel = lazyView(() => import('../components/PlanSharePanel.vue'));
const PlannerView = lazyView(() => import('./PlannerView.vue'));
const PlanBackupPanel = lazyView(
  () => import('../components/PlanBackupPanel.vue'),
);

/** URL changes select an existing draft. Preparing an edit never writes back to the URL. */
watch(
  [
    () => currentRoute.value.params.id,
    () => currentRoute.value.name,
    () => currentRoute.value.query.q,
  ],
  () => {
    if (currentRoute.value.meta.tab !== 'bd') return;
    const key = buildKey(
      String(currentRoute.value.params.id ?? DEFAULT_BUILD_ID),
    );
    if (!presetOf(key)) {
      routeNotice.value = '本机没有这套流派，请使用分享链接导入。';
      void navigate(
        {
          path: buildLocation(presets.value[0].key),
          query: currentRoute.value.query,
          hash: currentRoute.value.hash,
        },
        true,
      );
      return;
    }
    selectPreset(key);
    if (currentRoute.value.name === 'build-edit') startEdit(key);
    else finishEdit();
  },
  {immediate: true},
);
onUnmounted(finishEdit);
function selectBuild(key: string): void {
  pickerOpen.value = false;
  closeBuildMenu();
  void navigate(buildLocation(key));
}
function editBuild(key: string): void {
  pickerOpen.value = false;
  closeBuildMenu();
  void navigate(buildLocation(key, true));
}
function duplicateBuild(key: string): void {
  const created = copyPreset(key);
  if (created) selectBuild(created);
}
function completeEdit(): void {
  selectBuild(current.value.key);
}
const actions = useQuickrefActions();

// 交给新面板前先判断它是否在视野内，避免已在顶部时产生多余滚动。
function revealDestination(target: HTMLElement | null): void {
  if (!target) return;
  target.focus({preventScroll: true});
  const stickyBottom =
    document.getElementById('qbar')?.getBoundingClientRect().bottom ?? 0;
  const top = target.getBoundingClientRect().top;
  if (top >= stickyBottom && top < window.innerHeight - 40) return;
  target.scrollIntoView({
    block: 'start',
    behavior:
      prefersReducedMotion() || Math.abs(top) > window.innerHeight
        ? 'instant'
        : 'smooth',
  });
}

async function chooseFromPicker(key: string): Promise<void> {
  pickerOpen.value = false;
  await navigate(buildLocation(key));
  await nextTick();
  if (current.value.key === key && !editing.value)
    revealDestination(document.getElementById('build-heading'));
}

const editorRequested = ref('');
function createFromPicker(): void {
  editorRequested.value = newPreset();
  editBuild(editorRequested.value);
}
function onEditorReady(): void {
  if (editorRequested.value !== current.value.key) return;
  editorRequested.value = '';
  revealDestination(document.getElementById('build-editor-heading'));
}

/* ---------- 列表 ---------- */
// Wiki 分屏会改变正文宽度；横屏矮窗即使较宽也优先留空间给阵容。
const buildWidth = ref<HTMLElement>();
const narrowPane = useCompactPlanner(buildWidth);
const lowWindow = window.matchMedia('(max-height: 600px)');
const shortPane = ref(lowWindow.matches);
function syncHeight(): void {
  shortPane.value = lowWindow.matches;
}
lowWindow.addEventListener('change', syncHeight);
onUnmounted(() => lowWindow.removeEventListener('change', syncHeight));
const compact = computed(
  () => narrowPane.value || shortPane.value || isFloatingWindow.value,
);
const pickerOpen = ref(false);
const sortByBox = ref(false);
const presetBoxMap = computed(() => {
  const map = new Map<string, LineupBoxAssessment>();
  if (!hasAnyBox.value) return map;
  // 关闭目录后，翻回合或调整阵容只需计算当前流派。
  for (const item of pickerOpen.value ? presets.value : [current.value]) {
    const {ops} = presetFormation(item);
    if (!ops.length) continue;
    const assessment = evaluateLineupBox(ops, operatorBox);
    if (assessment.coverage.total) map.set(item.key, assessment);
  }
  return map;
});
function sortPresetList<T extends {key: string}>(list: T[]): T[] {
  if (!sortByBox.value || !hasAnyBox.value) return list;
  const map = presetBoxMap.value;
  return list
    .slice()
    .sort(
      (a, b) =>
        (map.get(b.key)?.fitScore ?? Number.MIN_SAFE_INTEGER) -
        (map.get(a.key)?.fitScore ?? Number.MIN_SAFE_INTEGER),
    );
}
function presetBoxSummary(key: string): {
  text: string;
  tone: 'warn' | 'ok';
  title: string;
} | null {
  if (!hasAnyBox.value) return null;
  const assess = presetBoxMap.value.get(key);
  if (!assess || !assess.coverage.total) return null;
  if (assess.substitutes.length > 0) {
    const names = assess.substitutes.map((s) => s.op.name).join('、');
    return {
      text: `借${assess.substitutes.length}`,
      tone: 'warn',
      title: `未借用 6★ ${assess.substitutes.length} 名（${names}），自持激活 ${assess.coverage.activated}/${assess.coverage.total}`,
    };
  }
  if (!sortByBox.value) return null;
  return {
    text: `${assess.coverage.activated}/${assess.coverage.total}`,
    tone: 'ok',
    title: `全员本体可用 · 自持激活 ${assess.coverage.activated}/${assess.coverage.total}`,
  };
}
const listedPresets = computed(() =>
  presets.value.map((item) => ({
    ...item,
    boxBadge: presetBoxSummary(item.key),
  })),
);
const pickerGroups = computed(() =>
  [
    {
      id: 'mine' as const,
      label: '我的流派',
      list: listedPresets.value.filter((item) => !item.builtin),
    },
    {
      id: 'presets' as const,
      label: '预设流派',
      list: listedPresets.value.filter((item) => item.builtin),
    },
  ].map(({id, label, list}) => ({
    id,
    label,
    items: sortPresetList(list).map((item) => ({
      key: item.key,
      name: item.plan.name,
      icon: effectivePlanIcon(item.plan),
      accent: presetColor(item),
      modified: item.modified,
      badge: item.boxBadge?.text,
      badgeTitle: item.boxBadge?.title,
      ban: banImpact.value.get(item.key),
    })),
  })),
);
function togglePresetFold(): void {
  updateSetting('collapsePresetBuilds', !settings.collapsePresetBuilds);
}
const actionsOpen = ref(false);
watch(pickerOpen, (open) => {
  if (open) closeBuildMenu();
});
function closeBuildMenu(event?: KeyboardEvent): void {
  if (!actionsOpen.value) return;
  event?.stopPropagation();
  if (
    event ||
    document.getElementById('build-actions')?.contains(document.activeElement)
  ) {
    document
      .getElementById('build-actions-toggle')
      ?.focus({preventScroll: true});
  }
  actionsOpen.value = false;
}
watch(
  [
    () => currentRoute.value.params.id,
    () => currentRoute.value.name,
    () => queryText(routeQuery.value, 'panel'),
  ],
  ([id, name, panel], [previousId, previousName]) => {
    if (id !== previousId || name !== previousName) {
      closeBuildMenu();
      pickerOpen.value = false;
    }
    // 直接打开分享地址或浏览器前进时，也让「收起分享」留在可见的操作区。
    if (panel === 'share') actionsOpen.value = true;
  },
  {immediate: true},
);

/* ---------- 查看 ---------- */
const p = computed(() => current.value);
const isRun = computed(() => runKey.value === p.value.key);
const viewedStage = ref<string | null>(null);
watch(
  () => p.value.key,
  () => {
    viewedStage.value = null;
  },
  {flush: 'sync'},
);
const selectedStage = computed<string>({
  get() {
    const source = p.value.plan;
    const key = isRun.value ? runStageKey.value : viewedStage.value;
    if (key === null && !source.ops.length) {
      const first = source.stages?.find((s) => s.ops.length);
      if (first) return stageKey(first);
    }
    return source.stages?.some((s) => stageKey(s) === key) ? key! : '';
  },
  set(key) {
    viewedStage.value = key;
    if (isRun.value) setRun(p.value.key, key);
  },
});
const stage = computed(() =>
  stageOf(p.value.plan, selectedStage.value),
);
const formation = computed(() => stage.value ?? p.value.plan);
function toggleCurrentRun(): void {
  if (isRun.value) endRun();
  else
    setRun(
      p.value.key,
      formation.value.ops.length ? selectedStage.value : undefined,
    );
  closeBuildMenu();
}
const lineupTabs = computed<readonly SubTabItem<0 | 1>[]>(() => [
  {
    id: 0,
    label: compact.value ? '阵容' : stage.value ? '阶段阵容' : '终盘阵容',
  },
  {id: 1, label: compact.value ? '抓牌' : '按等阶抓牌', title: '按等阶抓牌'},
]);
const stageOptions = computed(() => [
  {id: '', label: '成型阵容', count: p.value.plan.ops.length},
  ...(p.value.plan.stages ?? []).map((s) => ({
    id: stageKey(s),
    label: stageLabel(s),
    count: s.ops.length,
  })),
]);
watch(selectedStage, (key, previous) => {
  const index = (id: string) =>
    stageOptions.value.findIndex((item) => item.id === id);
  lineupDir.value = index(key) > index(previous) ? 'next' : 'prev';
});
const base = computed(() =>
  p.value.plan.base ? buildByName(p.value.plan.base) : undefined,
);
const coreBase = computed(() =>
  p.value.plan.base ? CORE_BUILDS[p.value.plan.base] : undefined,
);
const accent = computed(() => presetColor(p.value));
const slotEntries = computed(() =>
  formation.value.ops
    .map((slot) => ({slot, operator: OPERATOR[slot.name]}))
    .filter(
      (entry): entry is {slot: PlanOp; operator: Operator} => !!entry.operator,
    ),
);
const withAlts = computed(() =>
  slotEntries.value.filter((entry) => entry.slot.alt.length > 0),
);
const lineupMode = ref<0 | 1>(0);
interface GrabItem {
  operator: Operator;
  slot?: PlanOp;
  replaces: string[];
}
const GRAB_STAGES: readonly {
  label: string;
  range: string;
  tiers: readonly number[];
}[] = [
  {label: '前期抓牌', range: 'Ⅰ–Ⅱ 阶', tiers: [1, 2]},
  {label: '中期抓牌', range: 'Ⅲ–Ⅳ 阶', tiers: [3, 4]},
  {label: '后期抓牌', range: 'Ⅴ–Ⅵ 阶', tiers: [5, 6]},
];
const grabStages = computed(() => {
  const mainNames = new Set(slotEntries.value.map((e) => e.operator.name));
  const items: GrabItem[] = slotEntries.value.map(({slot, operator}) => ({
    operator,
    slot,
    replaces: [],
  }));
  const altTargets = new Map<string, string[]>();
  for (const {slot} of slotEntries.value) {
    for (const altName of slot.alt) {
      if (mainNames.has(altName) || !OPERATOR[altName]) continue;
      const list = altTargets.get(altName);
      if (list) {
        if (!list.includes(slot.name)) list.push(slot.name);
      } else {
        altTargets.set(altName, [slot.name]);
      }
    }
  }
  for (const [altName, replaces] of altTargets) {
    items.push({operator: OPERATOR[altName], replaces});
  }
  items.sort(
    (a, b) => a.operator.tier - b.operator.tier || +!!b.slot - +!!a.slot,
  );
  return GRAB_STAGES.map((stage) => ({
    ...stage,
    items: items.filter((item) => stage.tiers.includes(item.operator.tier)),
  })).filter((stage) => stage.items.length > 0);
});
const stats = computed(() =>
  covenantStats(formation.value.ops, formation.value.layers),
);
// 仅精锐计入的盟约由精锐人数产生，可以显示效果，但不是可被 ban 的原生盟约。
const bannable = computed(() =>
  stats.value.map((s) => s.name).filter(isBannableCovenant),
);
/** 这套要用的盟约：终盘阵容里激活的 */
const needs = computed(() => stats.value.filter((s) => s.active));
const headerSummary = computed(
  () =>
    base.value?.tagline ||
    needs.value
      .slice(0, 3)
      .map((s) => `${s.count} ${s.name}`)
      .join(' · ') ||
    (formation.value.ops.length ? `${formation.value.ops.length} 名干员` : ''),
);
/** 已成型盟约的效果；方案里填过层数的按层数代入 */
const effects = computed(() =>
  needs.value.map((s) => {
    const cov = COVENANTS[s.name],
      layers = formation.value.layers[s.name] ?? 0;
    return {
      ...s,
      layers,
      ...covenantEffectCard(cov, layers),
    };
  }),
);
const tips = computed(() =>
  formation.value.note
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean),
);
const longNotes = computed(
  () => formation.value.note.length > 100 || tips.value.length > 3,
);
const notesExpanded = ref(false);
watch([() => p.value.key, selectedStage], () => {
  notesExpanded.value = false;
});
const currentGuide = computed(() => {
  const guide = p.value.plan.skland;
  return guide && isCurrentGuideSeason(guide) ? guide : undefined;
});
const strategies = computed(() =>
  [
    ...new Set([
      p.value.plan.strategy,
      ...(p.value.plan.strategyAlternates ?? []),
    ]),
  ].filter((s) => Object.hasOwn(STRATEGY, s)),
);
const primaryStrategy = computed(() => STRATEGY[p.value.plan.strategy]);
const planEquipNotes = computed(() => equipNotes(formation.value.ops));
const cost = computed(() => planCost(formation.value.ops));
const coreNames = computed(() =>
  formation.value.ops.filter((s) => s.core).map((s) => s.name),
);
const assignedEquips = computed(() =>
  slotEntries.value.filter(({slot}) => slot.eq.length > 0),
);
const equipment = computed(() => {
  const selected = stage.value;
  const guide = selected
    ? currentGuide.value?.rounds.find((row) => row.from === selected.from && row.to === selected.to)
    : currentGuide.value?.formation;
  return [...lineupEquipment(formation.value.ops, base.value?.equipment, guide?.equipment)];
});
function remove(): void {
  removePreset(p.value.key);
  void navigate(buildLocation(current.value.key), true);
}
function restore(): void {
  restorePreset(p.value.key);
}

/* ---------- 盟约被 ban：被 ban 盟约的干员不会出现，给出替代 ---------- */
// 初次查看受禁池影响的阵容时自动展开，之后尊重用户在这套流派中的收起选择。
const manualBanOpen = ref<boolean | null>(null);
// 面板按需挂载，收起再打开时保留玩家展开的盟约及手选替补。
const showAllBans = ref(false);
const banImpact = computed(() => {
  const map = new Map<string, number>();
  if (!runBans.value.length) return map;
  for (const item of presets.value) {
    const count = presetFormation(item).ops.filter((s) =>
      isRunBannedOp(s.name),
    ).length;
    if (count > 0) map.set(item.key, count);
  }
  return map;
});
const hasRelevantBan = computed(
  () =>
    runBanSet.value.size > 0 &&
    bannable.value.some((name) => runBanSet.value.has(name)),
);
const banOpen = computed(() => manualBanOpen.value ?? hasRelevantBan.value);
const forced = ref<Record<string, string>>({});
watch(
  [() => p.value.key, () => runBans.value.join(), selectedStage],
  ([key], [previousKey]) => {
    forced.value = {};
    if (key !== previousKey) manualBanOpen.value = null;
  },
);
const currentBoxAssessment = computed(() => {
  if (formation.value === presetFormation(p.value))
    return presetBoxMap.value.get(p.value.key);
  if (!hasAnyBox.value) return undefined;
  const assessment = evaluateLineupBox(formation.value.ops, operatorBox);
  return assessment.coverage.total ? assessment : undefined;
});
const boxCheckOpen = ref(false);
const hasBoxDetails = computed(() => {
  const assess = currentBoxAssessment.value;
  return Boolean(
    assess &&
    (assess.substitutes.length > 0 ||
      assess.untrained.length > 0 ||
      boxActionNotice.value ||
      boxActionError.value),
  );
});
const hasBuildNotes = computed(
  () =>
    (!compact.value && tips.value.length > 0) ||
    Boolean(currentBoxAssessment.value && slotEntries.value.length),
);
const hasEquipment = computed(
  () => equipment.value.length > 0 || planEquipNotes.value.length > 0,
);
const hasLoadout = computed(
  () => strategies.value.length > 0 || hasEquipment.value,
);
const boxActionNotice = ref('');
const boxActionError = ref('');
watch(
  () => p.value.key,
  () => {
    boxCheckOpen.value = false;
    boxActionNotice.value = '';
    boxActionError.value = '';
  },
);
function borrowMissingFromBuild(): void {
  const missing = currentBoxAssessment.value?.substitutes ?? [];
  if (!missing.length) return;
  boxActionNotice.value = '';
  boxActionError.value = '';
  try {
    const changed = setOperatorRanks(
      missing.map((item) => item.op.name),
      BOX_RANK_BORROWED,
    );
    if (changed > 0) {
      boxActionNotice.value = `已将 ${missing.map((m) => m.op.name).join('、')} 加入助战（当前 ${boxSeasonBorrowedCount.value}/${BORROW_LIMIT}）。`;
    }
  } catch (error) {
    boxActionError.value =
      error instanceof Error ? error.message : '助战名额已满。';
  }
}

/* ---------- 工具面板；分享链接的片段在显式导入前保留 ---------- */
const activePanel = computed(
  () =>
    queryText(routeQuery.value, 'panel') ||
    (isPlanShareHash(currentRoute.value.hash) ? 'import' : ''),
);
const importOpen = computed(() => activePanel.value === 'import');
const libraryPanel = computed(
  () => importOpen.value || activePanel.value === 'backup',
);
async function openLibraryPanel(name: 'import' | 'backup'): Promise<void> {
  pickerOpen.value = false;
  if (activePanel.value !== name) await updateQuery({panel: name});
  await nextTick();
  if (activePanel.value === name)
    revealDestination(document.getElementById('build-library-heading'));
}
async function closeLibraryPanel(): Promise<void> {
  await updateQuery({
    panel: isPlanShareHash(currentRoute.value.hash) ? 'closed' : null,
  });
  await nextTick();
  document
    .querySelector<HTMLButtonElement>('[aria-controls="build-picker"]')
    ?.focus({preventScroll: true});
}
function toggleShare(): void {
  pickerOpen.value = false;
  const closedPanel = isPlanShareHash(currentRoute.value.hash)
    ? 'closed'
    : null;
  void updateQuery({
    panel: activePanel.value === 'share' ? closedPanel : 'share',
  });
}

/* ---------- 导入：分享码 / 链接 ---------- */
const importText = ref('');
const pulling = ref(false);
const pullNotice = ref('');
const pullFailed = ref(false);
let pullRequest: AbortController | undefined;
function resetPull(): void {
  pullRequest?.abort();
  pullRequest = undefined;
  pulling.value = false;
  pullNotice.value = '';
}
watch([() => p.value.key, () => currentRoute.value.fullPath], resetPull);
onUnmounted(resetPull);
async function pullGuide(): Promise<void> {
  const {key, plan} = p.value;
  if (!plan.skland || pulling.value) return;
  const controller = new AbortController();
  pullRequest = controller;
  pulling.value = true;
  pullFailed.value = false;
  pullNotice.value = '';
  try {
    const guide = await fetchSklandGuide(plan.skland.id, controller.signal);
    if (controller.signal.aborted || p.value.key !== key) return;
    const result = applyGuideUpdate(key, guide);
    if (result.status === 'copy') {
      await navigate(buildLocation(result.key));
      routeNotice.value = '已保留本地修改，现在查看独立保存的森空岛新版。';
    } else {
      pullNotice.value =
        result.status === 'unchanged'
          ? '已是森空岛最新版本。'
          : '已更新本地攻略和阵容。';
    }
  } catch (err) {
    if (!controller.signal.aborted) {
      pullFailed.value = true;
      pullNotice.value =
        err instanceof Error ? err.message : '更新失败，请稍后重试。';
    }
  } finally {
    if (pullRequest === controller) pulling.value = false;
  }
}
watch(
  () => currentRoute.value.hash,
  (hash) => {
    if (isPlanShareHash(hash)) {
      importText.value = hash;
    }
  },
  {immediate: true},
);
</script>
<template>
  <div ref="buildWidth">
    <BuildPicker
      :collapse-presets="settings.collapsePresetBuilds"
      :open="pickerOpen"
      :groups="pickerOpen ? pickerGroups : []"
      :current-key="p.key"
      :run-key="runKey"
      :has-box="hasAnyBox"
      :sort-by-box="sortByBox"
      @close="pickerOpen = false"
      @select="chooseFromPicker"
      @create="createFromPicker"
      @import="openLibraryPanel('import')"
      @backup="openLibraryPanel('backup')"
      @toggle-presets="togglePresetFold"
      @sort="sortByBox = !sortByBox" />

    <StatusNotice
      v-if="saveErrorMessage"
      tone="warning"
      :message="saveErrorMessage" />

    <Transition name="build-tool">
      <section
        v-if="libraryPanel"
        class="build-tool"
        aria-labelledby="build-library-heading">
        <div class="build-tool-clip">
          <div :key="activePanel" class="build-tool-content">
            <div class="build-panel-heading">
              <h2 id="build-library-heading" tabindex="-1">
                {{ importOpen ? '导入流派' : '备份与恢复' }}
              </h2>
              <button
                type="button"
                class="build-control"
                @click="closeLibraryPanel">
                收起
              </button>
            </div>
            <PlanBackupPanel
              v-if="activePanel === 'backup'"
              id="build-backup" />

            <BuildImportPanel v-if="importOpen" v-model="importText" />
          </div>
        </div>
      </section>
    </Transition>
  </div>
  <PlannerView
    v-if="editing"
    :key="p.key"
    class="build-page-in"
    @vue:mounted="onEditorReady"
    @done="completeEdit">
    <template #library>
      <BuildSwitchButton
        :open="pickerOpen"
        :name="p.plan.name"
        @click="pickerOpen = true" />
    </template>
  </PlannerView>

  <div
    v-else
    :key="p.key"
    :class="['build-frame', 'build-page-in', {'build-compact': compact}]"
    :style="{'--c': accent}">
    <header class="build-toolbar" @keydown.esc="closeBuildMenu">
      <div class="build-masthead">
        <div class="build-identity">
          <div class="build-title">
            <PlanEmblem :icon="effectivePlanIcon(p.plan)" />
            <h2 id="build-heading" class="build-name" tabindex="-1">
              {{ p.plan.name }}
            </h2>
          </div>
          <div v-if="headerSummary || p.modified" class="build-caption">
            <span v-if="headerSummary">{{ headerSummary }}</span>
            <span v-if="p.modified" class="build-status">已修改</span>
          </div>
        </div>
        <div class="build-primary-actions">
          <BuildSwitchButton
            :open="pickerOpen"
            :name="p.plan.name"
            @click="pickerOpen = true" />
          <button
            v-if="isRun && needs.length"
            type="button"
            class="build-control build-run"
            @click="actions.openCovenant(needs[0].name)">
            {{ compact ? '去抓牌' : '去盟约抓牌' }}
          </button>
          <button
            v-if="(!compact && isRun) || (!isRun && hasPlanOperators(p.plan))"
            type="button"
            :class="['build-control', {'build-run': !isRun}]"
            @click="toggleCurrentRun">
            <svg
              v-if="!isRun"
              viewBox="0 0 16 16"
              fill="currentColor"
              aria-hidden="true">
              <path d="M5 3.5v9l7-4.5z" />
            </svg>
            {{ isRun ? '结束本局' : '设为本局' }}
          </button>
          <button
            v-if="
              !p.builtin && !isRun && (!compact || !hasPlanOperators(p.plan))
            "
            type="button"
            :class="[
              'build-control build-icon-label',
              {'build-run': !hasPlanOperators(p.plan)},
            ]"
            @click="editBuild(p.key)">
            <svg
              class="build-action-icon"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              stroke-width="1.65"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true">
              <path
                d="m4 13.4 8.9-8.9a1.5 1.5 0 0 1 2.1 0l.5.5a1.5 1.5 0 0 1 0 2.1l-8.9 8.9L4 16zM11.9 5.5l2.6 2.6" />
            </svg>
            编辑
          </button>
          <button
            id="build-actions-toggle"
            type="button"
            class="build-control build-icon-label build-more"
            aria-label="更多流派操作"
            :aria-expanded="actionsOpen"
            aria-controls="build-actions"
            @click="actionsOpen = !actionsOpen">
            <svg
              class="build-action-icon"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true">
              <circle cx="4.5" cy="10" r="1.5" />
              <circle cx="10" cy="10" r="1.5" />
              <circle cx="15.5" cy="10" r="1.5" />
            </svg>
            <span v-if="!compact">更多</span>
            <svg
              v-if="!compact"
              class="build-drawer-chevron"
              viewBox="0 0 12 12"
              width="11"
              height="11"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true">
              <path d="M2.5 4.5 6 8l3.5-3.5" />
            </svg>
          </button>
        </div>
      </div>
    </header>

    <div
      id="build-actions"
      :class="['build-drawer', 'build-actions-drawer', {open: actionsOpen}]"
      :inert="!actionsOpen"
      :aria-hidden="!actionsOpen ? 'true' : undefined"
      @keydown.esc="closeBuildMenu">
      <div class="build-drawer-inner">
        <div class="build-fold build-actions build-actions-fold">
          <button
            v-if="isRun && compact"
            type="button"
            class="build-control"
            @click="toggleCurrentRun">
            结束本局
          </button>
          <button
            v-if="p.plan.skland"
            type="button"
            class="build-control"
            :disabled="pulling"
            @click="pullGuide">
            {{ pulling ? '正在拉取…' : '拉取更新' }}
          </button>
          <button
            type="button"
            class="build-control build-icon-label"
            :class="{on: activePanel === 'share'}"
            :aria-expanded="activePanel === 'share'"
            :aria-controls="activePanel === 'share' ? 'build-share' : undefined"
            @click="toggleShare">
            <svg
              class="build-action-icon"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              stroke-width="1.65"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true">
              <circle cx="5" cy="10" r="1.7" />
              <circle cx="14.5" cy="5" r="1.7" />
              <circle cx="14.5" cy="15" r="1.7" />
              <path d="m6.6 9.2 6.3-3.4m-6.3 5 6.3 3.4" />
            </svg>
            {{ activePanel === 'share' ? '收起分享' : '分享' }}
          </button>
          <button
            v-if="p.builtin || isRun || (compact && hasPlanOperators(p.plan))"
            type="button"
            class="build-control build-icon-label"
            @click="editBuild(p.key)">
            <svg
              class="build-action-icon"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              stroke-width="1.65"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true">
              <path
                d="m4 13.4 8.9-8.9a1.5 1.5 0 0 1 2.1 0l.5.5a1.5 1.5 0 0 1 0 2.1l-8.9 8.9L4 16zM11.9 5.5l2.6 2.6" />
            </svg>
            编辑
          </button>
          <button
            type="button"
            class="build-control build-icon-label"
            @click="duplicateBuild(p.key)">
            <svg
              class="build-action-icon"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              stroke-width="1.65"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true">
              <rect x="7" y="7" width="9" height="9" rx="1.5" />
              <path
                d="M12.5 7V5A1.5 1.5 0 0 0 11 3.5H5A1.5 1.5 0 0 0 3.5 5v6A1.5 1.5 0 0 0 5 12.5h2" />
            </svg>
            复制
          </button>
          <button
            v-if="slotEntries.length"
            type="button"
            class="build-control build-icon-label"
            :class="{on: banOpen}"
            :aria-expanded="banOpen"
            :aria-controls="banOpen ? 'build-bans' : undefined"
            @click="
              manualBanOpen = !banOpen;
              closeBuildMenu();
            ">
            <svg
              class="build-action-icon"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              stroke-width="1.65"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true">
              <circle cx="10" cy="10" r="6.2" />
              <path d="m5.6 14.4 8.8-8.8" />
            </svg>
            盟约禁选
          </button>
          <template
            v-if="coreNames.length && coreNames.length < formation.ops.length">
            <OperatorRequestButton
              :names="coreNames"
              :build-name="p.plan.name"
              label="求核心" />
            <OperatorRequestButton
              :names="formation.ops.map((slot) => slot.name)"
              :build-name="p.plan.name"
              label="求整队" />
          </template>
          <OperatorRequestButton
            v-else
            :names="formation.ops.map((slot) => slot.name)"
            :build-name="p.plan.name" />
          <ConfirmButton
            v-if="p.modified"
            label="恢复默认"
            confirm-label="确认恢复"
            tone="neutral"
            :reset-key="`${p.key}:${actionsOpen}`"
            @confirm="restore" />
          <ConfirmButton
            v-if="!p.builtin"
            label="删除"
            confirm-label="确认删除"
            :reset-key="`${p.key}:${actionsOpen}`"
            @confirm="remove" />
        </div>
      </div>
    </div>

    <div class="build-detail" @keydown.esc="closeBuildMenu">
      <StatusNotice
        v-if="pullNotice"
        :tone="pullFailed ? 'warning' : 'info'"
        :message="pullNotice" />
      <PlanSharePanel
        v-if="activePanel === 'share'"
        id="build-share"
        class="b-panel-in"
        :plan="p.plan" />

      <section class="build-roster" aria-label="当前阵容">
        <div
          v-if="p.plan.stages?.length || slotEntries.length"
          class="formation-tools">
          <BuildStageSwitcher
            v-if="p.plan.stages?.length"
            v-model="selectedStage"
            :items="stageOptions"
            label="查看阵容阶段" />
          <strong v-else class="formation-title">成型阵容</strong>
          <SubTabs
            v-if="slotEntries.length"
            v-model="lineupMode"
            :items="lineupTabs"
            :level="3"
            inline
            aria-label="阵容视图"
            panel-id="build-lineup-panel"
            attr="bdl"
            @change="(_, dir) => (lineupDir = dir)" />
        </div>
        <div
          v-if="slotEntries.length"
          :key="`${p.key}/${selectedStage}/${lineupMode}`"
          v-bind="subTabPanelAttrs('build-lineup-panel', lineupMode)"
          :class="{'subtab-panel': !!lineupDir}"
          :data-dir="lineupDir || undefined">
          <template v-if="lineupMode === 0">
            <div
              class="tiles build-lineup"
              :style="{'--build-count': slotEntries.length}">
              <OperatorTile
                v-for="entry in slotEntries"
                :key="entry.operator.name"
                :operator="entry.operator"
                :slot-meta="entry.slot"
                show-tier />
            </div>
            <div v-if="withAlts.length" class="balt">
              <span class="k">过渡 / 备选</span>
              <div class="balt-list">
                <span
                  v-for="{slot} in withAlts"
                  :key="slot.name"
                  class="balt-row">
                  <button
                    v-for="altName in slot.alt"
                    :key="altName"
                    type="button"
                    class="balt-chip"
                    :data-t="OPERATOR[altName]?.tier"
                    :data-op="altName"
                    @click="actions.openDetail('op', altName)">
                    <img
                      v-if="avatarSrc(altName)"
                      :src="avatarSrc(altName)"
                      alt=""
                      width="22"
                      height="22"
                      loading="lazy" />
                    <i class="tn">
                      {{ TIER_LABELS[OPERATOR[altName]?.tier ?? 0] }}
                    </i>
                    <b>{{ altName }}</b>
                  </button>
                  <span class="balt-to">→ 替</span>
                  <button
                    type="button"
                    class="balt-target"
                    @click="actions.openDetail('op', slot.name)">
                    {{ slot.name }}
                  </button>
                </span>
              </div>
            </div>
          </template>
          <div v-else class="bgrab-stages">
            <section
              v-for="stage in grabStages"
              :key="stage.label"
              class="bgrab-stage">
              <header>
                <b>{{ stage.label }}</b>
                <span class="tag">{{ stage.range }}</span>
              </header>
              <div class="bgrab-items">
                <button
                  v-for="item in stage.items"
                  :key="item.operator.name"
                  type="button"
                  :class="[
                    'bgrab-card',
                    {core: item.slot?.core, alt: !item.slot},
                  ]"
                  :data-t="item.operator.tier"
                  :data-op="item.operator.name"
                  @click="actions.openDetail('op', item.operator.name)">
                  <img
                    v-if="avatarSrc(item.operator.name)"
                    :src="avatarSrc(item.operator.name)"
                    alt=""
                    width="32"
                    height="32"
                    loading="lazy" />
                  <span class="bgrab-info">
                    <span class="bgrab-nm">
                      <i class="tn">{{ TIER_LABELS[item.operator.tier] }}</i>
                      <b>
                        {{ item.slot?.core ? '★ ' : ''
                        }}{{ item.operator.name }}
                      </b>
                    </span>
                    <small v-if="item.slot" class="bgrab-sub">
                      <template v-if="item.slot.elite">精锐</template>
                      <template v-if="item.slot.elite && item.slot.eq.length">
                        ·
                      </template>
                      <template v-if="item.slot.eq.length">
                        {{ item.slot.eq.join('/') }}
                      </template>
                      <template v-if="!item.slot.elite && !item.slot.eq.length">
                        主力
                      </template>
                    </small>
                    <small v-else class="bgrab-sub alt">
                      ⇄ 过渡/替{{ item.replaces.join('·') }}
                    </small>
                  </span>
                </button>
              </div>
            </section>
          </div>
        </div>
        <EmptyState v-else message="还没有干员，点「编辑」排阵容" />
        <div v-if="slotEntries.length" class="build-summary cnt">
          <span v-if="lineupMode === 0 && coreBase" class="build-core">
            核心
          </span>
          <span>
            <b>{{ slotEntries.length }}</b>
            人
          </span>
          <span>
            招募
            <b>{{ cost.recruit }}</b>
          </span>
          <span v-if="cost.elites">
            精锐
            <b>{{ cost.elites }}</b>
          </span>
          <span
            v-if="lineupMode === 0 && coreNames.length"
            class="build-legend">
            <i>★</i>
            核心位
          </span>
        </div>
      </section>
      <section
        v-if="compact && tips.length"
        class="formation-notes"
        aria-label="当前阶段打法要点">
        <div class="formation-note-heading">
          <h3>打法要点</h3>
          <button
            v-if="longNotes"
            type="button"
            :aria-expanded="notesExpanded"
            aria-controls="formation-notes-body"
            @click="notesExpanded = !notesExpanded">
            {{ notesExpanded ? '收起' : '展开全文' }}
          </button>
        </div>
        <div
          id="formation-notes-body"
          :class="{'notes-preview': longNotes && !notesExpanded}">
          <p v-for="(tip, index) in tips" :key="index">
            <GlossaryText :text="tip" :focusable="!longNotes || notesExpanded" />
          </p>
        </div>
      </section>
      <div v-if="slotEntries.length" class="bneed">
        <span v-if="needs.length" class="k">需要盟约</span>
        <button
          v-for="s in needs"
          :key="s.name"
          type="button"
          :class="[
            'c',
            {on: s.active, max: s.bonusActive, ban: runBans.includes(s.name)},
          ]"
          :style="{'--c': color(s.name)}"
          :data-cv="s.name"
          data-peek="off"
          @click="actions.openCovenant(s.name)">
          <CovenantIcon :name="s.name" />
          {{ s.name }}
          <small>{{ s.count }}/{{ s.need }}</small>
        </button>
        <button
          v-if="hasRelevantBan || banOpen"
          type="button"
          :class="['bbtn', {on: banOpen}]"
          :aria-expanded="banOpen"
          :aria-controls="banOpen ? 'build-bans' : undefined"
          @click="manualBanOpen = !banOpen">
          盟约禁选
        </button>
      </div>

      <BuildBanPanel
        v-if="slotEntries.length && banOpen"
        v-model:show-all="showAllBans"
        v-model:forced="forced"
        :plan="p.plan"
        :formation="formation"
        :bannable="bannable"
        :has-relevant-ban="hasRelevantBan"
        @saved="selectBuild" />

      <div v-if="hasBuildNotes || hasLoadout" class="bgrid">
        <div v-if="hasBuildNotes" class="bgrid-main">
          <div v-if="!compact && tips.length" class="bgrid-sec">
            <SectionHeading title="打法要点" :level="5" :accent="accent" />
            <ol :key="selectedStage" class="qsteps b-panel-in">
              <li v-for="(tip, index) in tips" :key="index">
                <GlossaryText :text="tip" />
              </li>
            </ol>
          </div>
          <div
            v-if="currentBoxAssessment && slotEntries.length"
            :class="[
              'b-box-strip',
              {
                warn: currentBoxAssessment.substitutes.length > 0,
                open: boxCheckOpen && hasBoxDetails,
              },
            ]"
            role="group"
            aria-label="当前流派账号 Box 体检">
            <button
              v-if="hasBoxDetails"
              type="button"
              class="b-box-head"
              :aria-expanded="boxCheckOpen"
              aria-controls="build-box-details"
              @click="boxCheckOpen = !boxCheckOpen">
              <span class="b-box-main">
                <span class="b-box-k">Box 体检</span>
                <span class="b-box-stat">
                  自持激活
                  <b>
                    {{ currentBoxAssessment.coverage.activated }}/{{
                      currentBoxAssessment.coverage.total
                    }}
                  </b>
                  <template v-if="currentBoxAssessment.coverage.maxed">
                    （满练 {{ currentBoxAssessment.coverage.maxed }}）
                  </template>
                  <template v-if="currentBoxAssessment.coverage.borrowed">
                    · 已借 {{ currentBoxAssessment.coverage.borrowed }}
                  </template>
                </span>
                <span
                  v-if="currentBoxAssessment.substitutes.length"
                  class="b-box-warn-tag">
                  缺 {{ currentBoxAssessment.substitutes.length }} 名未借 6★
                </span>
                <span v-else class="b-box-ready">✓ 全员本体出战</span>
                <span
                  v-if="currentBoxAssessment.untrained.length"
                  class="b-box-e0-tag">
                  精 0 待练 {{ currentBoxAssessment.untrained.length }}
                </span>
              </span>
              <span class="b-box-toggle">
                {{
                  boxCheckOpen
                    ? '收起'
                    : currentBoxAssessment.substitutes.length
                      ? '查看 / 借用'
                      : '详情'
                }}
                <i
                  :class="['b-box-arrow', {open: boxCheckOpen}]"
                  aria-hidden="true">
                  ▾
                </i>
              </span>
            </button>
            <div v-else class="b-box-head static">
              <span class="b-box-main">
                <span class="b-box-k">Box 体检</span>
                <span class="b-box-stat">
                  自持激活
                  <b>
                    {{ currentBoxAssessment.coverage.activated }}/{{
                      currentBoxAssessment.coverage.total
                    }}
                  </b>
                  <template v-if="currentBoxAssessment.coverage.maxed">
                    （满练 {{ currentBoxAssessment.coverage.maxed }}）
                  </template>
                  <template v-if="currentBoxAssessment.coverage.borrowed">
                    · 已借 {{ currentBoxAssessment.coverage.borrowed }}
                  </template>
                </span>
                <span class="b-box-ready">✓ 全员本体出战</span>
              </span>
            </div>
            <div
              v-if="hasBoxDetails"
              id="build-box-details"
              :class="['build-drawer', 'b-box-drawer', {open: boxCheckOpen}]"
              :inert="!boxCheckOpen"
              :aria-hidden="!boxCheckOpen ? 'true' : undefined">
              <div class="build-drawer-inner">
                <div class="b-box-body">
                  <div
                    v-if="currentBoxAssessment.substitutes.length"
                    class="b-box-gaps">
                    <span class="b-box-gap-label">
                      未借 6★（不借将变替补）：
                    </span>
                    <button
                      v-for="item in currentBoxAssessment.substitutes"
                      :key="item.op.name"
                      type="button"
                      :class="['b-box-gap-chip', {core: item.core}]"
                      :title="`${item.op.name} 未持有且未借用${item.backupOperator ? `，将替补为「${item.backupOperator}」` : ''}，点此查看详情`"
                      @click="actions.openDetail('op', item.op.name)">
                      <b>{{ item.core ? '★ ' : '' }}{{ item.op.name }}</b>
                      <small v-if="item.backupOperator">
                        → {{ item.backupOperator }}
                      </small>
                    </button>
                    <button
                      type="button"
                      class="b-box-borrow-btn"
                      @click="borrowMissingFromBuild">
                      {{
                        currentBoxAssessment.substitutes.length > 1
                          ? `全部加入助战 (+${currentBoxAssessment.substitutes.length} · ${boxSeasonBorrowedCount}/${BORROW_LIMIT})`
                          : `加入助战 (${boxSeasonBorrowedCount}/${BORROW_LIMIT})`
                      }}
                    </button>
                  </div>
                  <p
                    v-if="currentBoxAssessment.untrained.length"
                    class="b-box-untrained">
                    已持有但精 0 未激活：
                    <button
                      v-for="item in currentBoxAssessment.untrained"
                      :key="item.op.name"
                      type="button"
                      class="b-box-e0-link"
                      @click="actions.openDetail('op', item.op.name)">
                      {{ item.op.name }}
                    </button>
                    <small>（拉至精一即享攻防 +5%）</small>
                  </p>
                  <StatusNotice
                    v-if="boxActionNotice"
                    tone="success"
                    :message="boxActionNotice"
                    dismissible
                    @dismiss="boxActionNotice = ''" />
                  <StatusNotice
                    v-if="boxActionError"
                    tone="danger"
                    :message="boxActionError"
                    dismissible
                    @dismiss="boxActionError = ''" />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-if="hasLoadout" class="bgrid-side">
          <div v-if="strategies.length" class="bgrid-sec" data-key="strategies">
            <SectionHeading title="策略" :level="5" :accent="accent" />
            <div class="row">
              <Chip
                v-for="name in strategies"
                :key="name"
                kind="st"
                :name="name" />
            </div>
            <p v-if="primaryStrategy" class="b-st-fx">
              <span class="tag t">{{ primaryStrategy.skill }}</span>
              <span v-html="fx(primaryStrategy.effect)"></span>
            </p>
          </div>
          <div v-if="hasEquipment" class="bgrid-sec" data-key="equipment">
            <SectionHeading title="装备与配装" :level="5" :accent="accent" />
            <div v-if="equipment.length" class="row">
              <Chip
                v-for="name in equipment"
                :key="name"
                kind="eq"
                :name="name" />
            </div>
            <div v-if="assignedEquips.length" class="b-eq-assign">
              <span
                v-for="{slot} in assignedEquips"
                :key="slot.name"
                class="b-eq-slot">
                <button
                  type="button"
                  class="b-eq-op"
                  @click="actions.openDetail('op', slot.name)">
                  {{ slot.name }}
                </button>
                <i aria-hidden="true">→</i>
                <Chip
                  v-for="(eqName, index) in slot.eq"
                  :key="index"
                  kind="eq"
                  :name="eqName" />
              </span>
            </div>
            <ul v-if="planEquipNotes.length" class="b-eq-notes">
              <li
                v-for="(note, index) in planEquipNotes"
                :key="index"
                :class="note.kind">
                <b>{{ note.op }}</b>
                <GlossaryText :text="note.text" />
              </li>
            </ul>
          </div>
        </div>
      </div>
      <SklandGuideDetails
        v-if="p.plan.skland"
        :key="p.key"
        :guide="p.plan.skland" />
      <details
        v-if="effects.length"
        class="bfx bfx-fold"
        :open="!isFloatingWindow">
        <summary>
          盟约效果详情
          <span class="hint">已成型 {{ effects.length }} 个</span>
        </summary>
        <div class="fxg">
          <article
            v-for="(c, i) in effects"
            :key="c.name"
            :class="['fxc', 'on', {max: c.bonusActive}]"
            :style="{'--c': color(c.name), animationDelay: i * 0.05 + 's'}">
            <header>
              <button
                type="button"
                class="n"
                :data-cv="c.name"
                data-peek="off"
                :title="`查看${c.name}盟约页`"
                @click="actions.openCovenant(c.name)">
                <CovenantIcon :name="c.name" />
                {{ c.name }}
              </button>
              <span class="need">{{ c.need }} 人</span>
              <span class="mine" :title="c.members.join('、')">
                {{ c.count }} / {{ c.need }}
                <template v-if="c.layers">· {{ c.layers }} 层</template>
              </span>
            </header>
            <p v-html="c.effect"></p>
            <p v-if="c.bonus" class="bn">
              <span :class="['tag', c.bonusActive ? 'a' : '']">
                {{ c.bonusActive ? '已强化' : c.bonusLabel }}
              </span>
              <span v-html="c.bonus"></span>
            </p>
          </article>
        </div>
      </details>
    </div>
  </div>
</template>

<style scoped>
.build-drawer-chevron {
  flex: none;
  margin-left: 1px;
  opacity: 0.78;
  transition: transform 200ms cubic-bezier(0.22, 1, 0.36, 1);
}
[aria-expanded='true'] > .build-drawer-chevron {
  transform: rotate(180deg);
}

/* 通用折叠抽屉动效：更多操作与 Box 体检共用 */
.build-drawer {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  pointer-events: none;
  transition:
    grid-template-rows 210ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 150ms ease,
    margin-top 210ms cubic-bezier(0.22, 1, 0.36, 1);
}
.build-drawer.open {
  grid-template-rows: 1fr;
  opacity: 1;
  pointer-events: auto;
}
.build-drawer-inner {
  min-height: 0;
  overflow: hidden;
}
.build-drawer .build-fold,
.build-drawer .b-box-body {
  transform: translateY(-4px);
  transition: transform 210ms cubic-bezier(0.22, 1, 0.36, 1);
}
.build-drawer.open .build-fold,
.build-drawer.open .b-box-body {
  transform: translateY(0);
}
.build-actions-drawer {
  padding-inline: var(--build-inset);
}
.build-actions-fold {
  margin-top: 10px;
}
@keyframes build-panel-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
}
.b-panel-in {
  animation: build-panel-in 160ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

/* 流派详情的入口、主操作和阵容共享同一个视觉容器。 */
.build-frame {
  --build-inset: 16px;
  min-width: 0;
  border: 1px solid var(--line);
  border-top: 3px solid var(--c);
  border-radius: 10px;
  background: var(--surface);
  box-shadow: 0 2px 7px color-mix(in srgb, var(--ink) 6%, transparent);
}
.build-toolbar {
  display: grid;
  gap: 9px;
  min-width: 0;
  padding: 12px var(--build-inset) 10px;
  border-radius: 8px 8px 0 0;
  border-bottom: 1px solid var(--line);
  background: linear-gradient(
    110deg,
    color-mix(in srgb, var(--c) 9%, var(--surface)),
    var(--surface) 82%
  );
}
.build-masthead {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 10px;
  min-width: 0;
}
.build-identity {
  flex: 1 1 132px;
  min-width: 0;
  max-width: 100%;
}
.build-title {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  max-width: 100%;
  vertical-align: top;
}
.build-name {
  margin: 0;
  min-width: 0;
  color: var(--ink);
  font: 400 28px / 1.18 var(--fd);
  overflow-wrap: anywhere;
  text-wrap: balance;
}
.build-caption {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 7px;
  margin: 2px 0 0 41px;
  color: var(--ink2);
  font-size: 12px;
  line-height: 1.3;
}
.build-status {
  color: var(--c);
}
.build-primary-actions,
.build-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px 6px;
}
.build-primary-actions {
  flex: 0 0 auto;
  max-width: 100%;
  margin-inline-start: auto;
  justify-content: flex-end;
}
.build-icon-label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}
.build-action-icon {
  flex: none;
  width: 16px;
  height: 16px;
}
.build-control {
  min-height: 34px;
  padding: 4px 10px;
  border: 1px solid var(--line2);
  border-radius: 6px;
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  transition:
    border-color 150ms ease,
    color 150ms ease,
    background-color 150ms ease;
}
.build-control:hover,
.build-control.on,
.build-control[aria-expanded='true'] {
  border-color: var(--c, var(--accent));
  color: var(--c, var(--accent));
}
.build-control.on {
  background: color-mix(in srgb, var(--c, var(--accent)) 10%, var(--surface));
  font-weight: 600;
}
.build-control.build-run {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  border-color: transparent;
  background: var(--accent);
  color: var(--accent-ink);
  font-weight: 700;
}
@supports (color: contrast-color(red)) {
  .build-control.build-run {
    --run-fill: color-mix(in srgb, var(--c) 86%, #111);
    background: var(--run-fill);
    color: contrast-color(var(--run-fill));
  }
}
.build-run svg {
  width: 15px;
  height: 15px;
}
.build-more {
  border-color: var(--line);
  background: color-mix(in srgb, var(--surface) 72%, transparent);
  color: var(--ink2);
}
.build-control:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.build-fold {
  padding: 8px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface2);
}
.build-detail {
  display: grid;
  gap: 12px;
  min-width: 0;
  padding: 10px var(--build-inset) 16px;
}
.build-roster {
  min-width: 0;
}
.formation-tools,
.build-panel-heading,
.formation-note-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.formation-tools {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  margin-bottom: 8px;
}
.formation-title {
  font-size: 14px;
}
.build-roster > .build-summary {
  margin-top: 7px;
  font-size: 12px;
}
.build-panel-heading {
  margin: 0 0 6px;
}
.build-panel-heading h2 {
  margin: 0;
  font-size: 14px;
}
.build-tool {
  display: grid;
  grid-template-rows: 1fr;
}
.build-tool-clip {
  min-height: 0;
}
.build-tool-enter-active .build-tool-clip,
.build-tool-leave-active .build-tool-clip {
  overflow: clip;
}
.build-tool-content {
  padding-bottom: 8px;
}
.build-tool-content :deep(.bimp) {
  margin-bottom: 0;
  animation: none;
}
.build-name,
.build-panel-heading h2,
.build-page-in :deep(.pl-bar) {
  scroll-margin-top: 6px;
}
@media (prefers-reduced-motion: no-preference) {
  :global(:root:not([data-motion='reduce']) .build-tool-enter-active),
  :global(:root:not([data-motion='reduce']) .build-tool-leave-active) {
    transition:
      grid-template-rows 200ms cubic-bezier(0.22, 1, 0.36, 1),
      opacity 150ms ease;
  }
  .build-tool-enter-from,
  .build-tool-leave-to {
    grid-template-rows: 0fr;
    opacity: 0;
  }
  .build-page-in,
  .build-tool-content {
    animation: build-content-arrive 180ms cubic-bezier(0.22, 1, 0.36, 1);
  }
}
@keyframes build-content-arrive {
  from {
    opacity: 0.35;
    transform: translateY(6px);
  }
}
:global(:root[data-motion='reduce'] .build-page-in),
:global(:root[data-motion='reduce'] .build-tool-content) {
  animation: none;
}
:global(:root[data-motion='reduce'] .build-tool) {
  grid-template-rows: 1fr;
  opacity: 1;
}
.build-compact .build-masthead {
  flex-wrap: wrap;
  gap: 6px;
}
.build-compact .build-toolbar {
  padding: 5px var(--build-inset);
}
.build-compact .build-identity {
  flex: 1 1 185px;
}
.build-compact .build-primary-actions {
  flex-wrap: nowrap;
  gap: 5px;
}
.build-compact .build-title {
  --emblem-size: 27px;
}
.build-compact .build-caption {
  margin-inline-start: 34px;
  font-size: 11px;
}
.build-compact .build-name {
  font-size: clamp(18px, 4.5vw, 22px);
}
.build-compact .build-more {
  width: 36px;
  height: 36px;
  padding: 0;
}
.build-compact .build-detail {
  gap: 10px;
  padding-top: 7px;
}
.formation-note-heading button:focus-visible {
  outline: 2px solid var(--teal);
  outline-offset: 2px;
}
.formation-notes {
  min-width: 0;
  padding: 8px 10px;
  border-inline-start: 3px solid var(--c);
  border-radius: 0 6px 6px 0;
  background: color-mix(in srgb, var(--c) 5%, var(--surface));
}
.formation-note-heading h3 {
  margin: 0;
  font-size: 13px;
  color: var(--ink);
}
.formation-note-heading button {
  min-height: 34px;
  padding: 0 7px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  font: inherit;
  font-size: 12px;
  color: var(--teal);
  cursor: pointer;
}
.formation-notes p {
  margin: 3px 0 0;
  font-size: 13px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.notes-preview {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
}
@media (hover: hover) {
  .formation-note-heading button:hover {
    background: color-mix(in srgb, var(--teal) 8%, var(--surface));
  }
}
.build-control:active:not(:disabled),
.formation-note-heading button:active {
  box-shadow: inset 0 0 0 2px color-mix(in srgb, currentColor 25%, transparent);
}
@media (prefers-reduced-motion: no-preference) {
  :global(:root:not([data-motion='reduce']) .formation-note-heading button) {
    transition:
      background-color 150ms ease,
      box-shadow 150ms ease;
  }
}
.build-detail .bneed {
  gap: 5px 6px;
  margin: 0;
}
.build-detail .bneed > .k {
  font-weight: 600;
}
.build-detail .bneed .c {
  min-height: 34px;
}
.build-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 9px;
  min-width: 0;
  color: var(--ink2);
}
.build-summary b {
  color: var(--ink);
  font: 650 14px var(--fn);
}
.build-core {
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 600;
}
.build-legend {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 11.5px;
  color: var(--ink3);
}
.build-legend i {
  font-style: normal;
  color: var(--accent);
}
.build-lineup {
  display: grid;
  --build-tile-min: 64px;
  grid-template-columns: repeat(
    auto-fit,
    minmax(min(100%, var(--build-tile-min)), 1fr)
  );
  gap: 6px;
  width: min(
    100%,
    calc(var(--build-count) * 108px + (var(--build-count) - 1) * 6px)
  );
}
.build-lineup :deep(> .tile) {
  width: 100%;
  min-width: 0;
  max-width: 108px;
  padding: 5px 4px 4px;
  gap: 4px;
}
.build-lineup :deep(.tile-avatar > img) {
  width: 49px;
  height: 49px;
}
.build-lineup :deep(.tile.core::after) {
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
}
/* 完整展示长干员名：均衡折行、不截断省略，同时保持同排头像顶对齐、色条底对齐 */
.build-lineup :deep(.tile-name) {
  white-space: normal;
  overflow: visible;
  text-overflow: clip;
  overflow-wrap: anywhere;
  text-wrap: balance;
  font-size: 11.5px;
  font-weight: 600;
  line-height: 1.24;
  min-height: 1.24em;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1 0 auto;
}
.build-lineup :deep(.dots) {
  margin-top: auto;
}
/* 紧凑名单保留完整姓名。九人阶段在 390px 竖屏可以排成两行，在 640px 横窗能排一行。 */
.build-compact .build-lineup {
  --build-tile-min: 58px;
  gap: 4px;
}
.build-compact .build-lineup :deep(> .tile) {
  padding: 4px 2px 3px;
  gap: 3px;
}

/* 阵容区与打法/策略/配装区的层级分隔与易读性增强 */
.build-detail .bgrid {
  padding-top: 12px;
  border-top: 1px solid var(--line);
}
.build-detail .bgrid > :only-child {
  grid-column: 1 / -1;
}
.bgrid-main {
  display: grid;
  gap: 12px;
  align-content: start;
}
.bgrid-side {
  display: grid;
  gap: 14px;
  align-content: start;
}
.bgrid-sec {
  display: grid;
  gap: 8px;
  align-content: start;
}
.build-detail .qsteps {
  gap: 7px;
}
.build-detail .qsteps li {
  color: var(--ink);
  line-height: 1.65;
}
.build-detail .b-st-fx {
  margin: 2px 0 0;
  padding: 7px 10px;
  border-radius: 7px;
  border-left: 3px solid var(--teal);
  background: var(--surface2);
  color: var(--ink);
  line-height: 1.6;
}
.build-detail .bfx-fold > summary {
  padding: 4px 10px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: var(--surface2);
  color: var(--ink2);
  transition:
    border-color 150ms ease,
    color 150ms ease;
}
.build-detail .bfx-fold > summary:hover {
  border-color: var(--c);
  color: var(--ink);
}

@container quickref-view (min-width: 590px) {
  .build-lineup {
    --build-tile-min: 62px;
  }
}
@container quickref-view (max-width: 720px) {
  .build-detail .bgrid {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}
@media (max-height: 600px), (max-width: 600px) {
  .build-frame {
    --build-inset: 10px;
  }
  .build-toolbar {
    padding-block: 8px;
  }
  .build-detail {
    gap: 8px;
    padding-top: 7px;
  }
  .build-lineup :deep(.tile-avatar > img) {
    width: 46px;
    height: 46px;
  }
  .build-detail .bgrid {
    padding-top: 9px;
  }
}
@container quickref-view (max-width: 520px) {
  .build-control {
    padding-inline: 8px;
    font-size: 12.5px;
  }
}
@container quickref-view (max-width: 390px) {
  .build-masthead {
    gap: 5px 6px;
  }
  .build-control {
    padding-inline: 7px;
  }
}

.b-box-strip {
  display: grid;
  margin: 0;
  border: 1px solid color-mix(in srgb, var(--teal) 28%, var(--line));
  border-radius: 8px;
  background: color-mix(in srgb, var(--teal) 5%, var(--surface2));
  font-size: 12px;
  overflow: hidden;
}
.b-box-strip.warn {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--line));
  background: color-mix(in srgb, var(--accent) 6%, var(--surface2));
}
.b-box-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 6px 10px;
  width: 100%;
  min-height: 36px;
  padding: 5px 10px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.b-box-head.static {
  cursor: default;
}
.b-box-head:not(.static):hover {
  background: color-mix(in srgb, var(--accent) 5%, transparent);
}
.b-box-main {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px 8px;
}
.b-box-k {
  font-size: 11px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--surface);
  border: 1px solid var(--line);
  color: var(--ink2);
}
.b-box-stat {
  color: var(--ink2);
}
.b-box-stat b {
  font-family: var(--fn);
  color: var(--ink);
}
.b-box-ready {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--teal);
}
.b-box-warn-tag {
  font-size: 11.5px;
  font-weight: 700;
  padding: 0 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  color: var(--accent);
}
.b-box-e0-tag {
  font-size: 11.5px;
  color: var(--ink3);
}
.b-box-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--accent);
  white-space: nowrap;
}
.b-box-arrow {
  display: inline-block;
  font-style: normal;
  transition: transform 200ms cubic-bezier(0.22, 1, 0.36, 1);
}
.b-box-arrow.open {
  transform: rotate(180deg);
}
.b-box-body {
  display: grid;
  gap: 7px;
  padding: 8px 10px 9px;
  border-top: 1px solid color-mix(in srgb, var(--line) 80%, transparent);
}
.b-box-gaps {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.b-box-gap-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
}
.b-box-gap-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 34px;
  padding: 2px 8px;
  border: 1px dashed color-mix(in srgb, var(--accent) 55%, var(--line2));
  border-radius: 6px;
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.b-box-gap-chip.core {
  border-style: solid;
  border-color: var(--accent);
}
.b-box-gap-chip small {
  font-size: 11px;
  color: var(--ink3);
}
.b-box-borrow-btn {
  margin-left: auto;
  min-height: 34px;
  padding: 0 11px;
  border: 1px solid var(--accent);
  border-radius: 6px;
  background: var(--accent);
  color: var(--accent-ink);
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
}
.b-box-borrow-btn:hover {
  filter: brightness(1.06);
}
.b-box-untrained {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 6px;
  font-size: 12px;
  color: var(--ink2);
}
.b-box-untrained small {
  color: var(--ink3);
}
.b-box-e0-link {
  min-height: 34px;
  padding: 1px 6px;
  border: 1px solid var(--line2);
  border-radius: 5px;
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  font-size: 11.5px;
  cursor: pointer;
}
.b-box-e0-link:hover {
  border-color: var(--accent);
  color: var(--accent);
}
@media (max-height: 600px) {
  .b-box-head {
    min-height: 34px;
    padding: 4px 9px;
  }
  .b-box-body {
    padding: 6px 9px 7px;
    gap: 5px;
  }
}
@container quickref-view (max-width: 560px) {
  .b-box-borrow-btn {
    margin-left: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .b-box-arrow,
  .build-drawer-chevron,
  .build-drawer,
  .build-drawer .build-fold,
  .build-drawer .b-box-body,
  .build-control {
    transition: none;
  }
  .b-panel-in {
    animation: none;
  }
}
:global(:root[data-motion='reduce'] .b-box-arrow),
:global(:root[data-motion='reduce'] .build-drawer-chevron),
:global(:root[data-motion='reduce'] .build-drawer),
:global(:root[data-motion='reduce'] .build-drawer .build-fold),
:global(:root[data-motion='reduce'] .build-drawer .b-box-body),
:global(:root[data-motion='reduce'] .build-control) {
  transition: none !important;
}
:global(:root[data-motion='reduce'] .b-panel-in) {
  animation: none !important;
}
</style>
