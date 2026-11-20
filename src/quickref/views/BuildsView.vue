<script setup lang="ts">
import {computed, onUnmounted, ref, watch} from 'vue';
import {
  BANNABLE_COVENANTS,
  BORROW_LIMIT,
  CORE_BUILDS,
  COVENANTS,
  DEFAULT_BUILD_ID,
  OPERATOR,
  EQUIP,
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
import {round1} from '../../lib/ui/dom.ts';
import {avatarSrc} from '../../lib/ui/assets.ts';
import {banReplace} from '../../lib/recommendation/index.ts';
import {
  atLayers,
  blankPlan,
  covenantStats,
  decodePlan,
  equipNotes,
  planCost,
  type Decoded,
  type PlanOp,
} from '../../lib/plans/index.ts';
import {
  isSmallWindow,
  settings,
  updateSetting,
} from '../../lib/settings/store.ts';
import {useQuickrefActions} from '../state.ts';
import {
  presetOf,
  presets,
  current,
  editing,
  runKey,
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
  toggleBan,
  addPlan,
} from '../planStore.ts';
import {color, fx, bonusHeadcount, bonusText} from '../format.ts';
import Chip from '../components/Chip.vue';
import CovenantIcon from '../components/CovenantIcon.vue';
import OperatorTile from '../components/OperatorTile.vue';
import PlanSummary from '../components/PlanSummary.vue';
import PlanSharePanel from '../components/PlanSharePanel.vue';
import OperatorRequestButton from '../components/OperatorRequestButton.vue';
import SubTabs, {
  type SubTabDirection,
  type SubTabItem,
} from '../components/SubTabs.vue';
import ConfirmButton from '../components/ConfirmButton.vue';
import EmptyState from '../components/EmptyState.vue';
import StatusNotice from '../components/StatusNotice.vue';

const LINEUP_TABS: readonly SubTabItem<0 | 1>[] = [
  {id: 0, label: '终盘阵容'},
  {id: 1, label: '按等阶抓牌'},
];
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
const PlannerView = lazyView(() => import('./PlannerView.vue'));
const PlanBackupPanel = lazyView(
  () => import('../components/PlanBackupPanel.vue'),
);

/** URL changes select an existing draft. Preparing an edit never writes back to the URL. */
watch(
  [() => currentRoute.value.params.id, () => currentRoute.value.name],
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
  void navigate(buildLocation(key));
}
function editBuild(key: string): void {
  void navigate(buildLocation(key, true));
}
function createBuild(): void {
  editBuild(newPreset());
}
function duplicateBuild(key: string): void {
  const created = copyPreset(key);
  if (created) selectBuild(created);
}
function completeEdit(): void {
  selectBuild(current.value.key);
}
const actions = useQuickrefActions();

/* ---------- 列表 ---------- */
const sortByBox = ref(false);
const presetBoxMap = computed(() => {
  const map = new Map<string, LineupBoxAssessment>();
  if (!hasAnyBox.value) return map;
  for (const item of presets.value) {
    // 收起抽屉时只有当前流派、本局流派和自建流派仍展示体检结果。
    if (
      item.builtin &&
      settings.collapsePresetBuilds &&
      item.key !== current.value.key &&
      item.key !== runKey.value
    )
      continue;
    if (!item.plan.ops.length) continue;
    const assessment = evaluateLineupBox(item.plan.ops, operatorBox);
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
const coreList = computed(() =>
  sortPresetList(
    listedPresets.value.filter((x) => x.builtin && CORE_BUILDS[x.key]),
  ),
);
const mixedList = computed(() =>
  sortPresetList(
    listedPresets.value.filter((x) => x.builtin && !CORE_BUILDS[x.key]),
  ),
);
const mine = computed(() =>
  sortPresetList(listedPresets.value.filter((x) => !x.builtin)),
);
const builtinCount = computed(
  () => coreList.value.length + mixedList.value.length,
);
const drawerGroups = computed(() => [
  {list: coreList.value, offset: 0},
  {list: mixedList.value, offset: coreList.value.length},
]);
const pinnedPresets = computed(() =>
  settings.collapsePresetBuilds
    ? listedPresets.value.filter(
        (x) =>
          x.builtin && (x.key === current.value.key || x.key === runKey.value),
      )
    : [],
);
function togglePresetFold(): void {
  updateSetting('collapsePresetBuilds', !settings.collapsePresetBuilds);
}
function pinBeforeLeave(el: Element): void {
  const target = el as HTMLElement;
  target.style.left = `${target.offsetLeft}px`;
  target.style.top = `${target.offsetTop}px`;
}
function clearPinStyle(el: Element): void {
  const target = el as HTMLElement;
  target.style.left = '';
  target.style.top = '';
}

/* ---------- 查看 ---------- */
const p = computed(() => current.value);
const base = computed(() =>
  p.value.plan.base ? buildByName(p.value.plan.base) : undefined,
);
const coreBase = computed(() =>
  p.value.plan.base ? CORE_BUILDS[p.value.plan.base] : undefined,
);
const accent = computed(() => presetColor(p.value));
const slotEntries = computed(() =>
  p.value.plan.ops
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
  covenantStats(p.value.plan.ops, p.value.plan.layers),
);
// 仅精锐计入的盟约由精锐人数产生，可以显示效果，但不是可被 ban 的原生盟约。
const bannable = computed(() =>
  stats.value.filter((s) => isBannableCovenant(s.name)),
);
/** 这套要用的盟约：终盘阵容里激活的 */
const needs = computed(() => stats.value.filter((s) => s.active));
/** 已成型盟约的效果；方案里填过层数的按层数代入 */
const effects = computed(() =>
  needs.value.map((s) => {
    const cov = COVENANTS[s.name],
      layers = p.value.plan.layers[s.name] ?? 0,
      head = bonusHeadcount(cov.bonus);
    return {
      ...s,
      layers,
      effect: fx(layers ? atLayers(cov.effect, layers) : cov.effect),
      bonus: cov.bonus
        ? fx(
            layers
              ? atLayers(bonusText(cov.bonus), layers)
              : bonusText(cov.bonus),
          )
        : '',
      bonusLabel: head ? `${head} 名` : '强化',
    };
  }),
);
const tips = computed(() =>
  p.value.plan.note
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean),
);
const strategies = computed(() =>
  [
    ...new Set([p.value.plan.strategy, ...(base.value?.strategies ?? [])]),
  ].filter((s) => STRATEGY[s]),
);
const primaryStrategy = computed(() => STRATEGY[p.value.plan.strategy]);
const planEquipNotes = computed(() => equipNotes(p.value.plan.ops));
const cost = computed(() => planCost(p.value.plan.ops));
const coreNames = computed(() =>
  p.value.plan.ops.filter((s) => s.core).map((s) => s.name),
);
const assignedEquips = computed(() =>
  slotEntries.value.filter(({slot}) => slot.eq.length > 0),
);
const equipment = computed(() =>
  [
    ...new Set([
      ...p.value.plan.ops.flatMap((o) => o.eq),
      ...(base.value?.equipment ?? []),
    ]),
  ].filter((e) => EQUIP[e]),
);
const main = computed(() =>
  coreBase.value ? COVENANTS[p.value.plan.base!].scaling[0] : undefined,
);
const isRun = computed(() => runKey.value === p.value.key);
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
const showAllBans = ref(false);
const banImpact = computed(() => {
  const map = new Map<string, number>();
  if (!runBans.value.length) return map;
  for (const item of presets.value) {
    const count = item.plan.ops.filter((s) => isRunBannedOp(s.name)).length;
    if (count > 0) map.set(item.key, count);
  }
  return map;
});
const hasRelevantBan = computed(
  () =>
    runBanSet.value.size > 0 &&
    bannable.value.some((s) => runBanSet.value.has(s.name)),
);
const banOpen = computed(() => manualBanOpen.value ?? hasRelevantBan.value);
const visibleBanCovenants = computed(() =>
  showAllBans.value
    ? BANNABLE_COVENANTS
    : [...new Set([...bannable.value.map((s) => s.name), ...runBans.value])],
);
const forced = ref<Record<string, string>>({});
watch(
  [() => p.value.key, () => runBans.value.join()],
  ([key], [previousKey]) => {
    forced.value = {};
    if (key !== previousKey) manualBanOpen.value = null;
  },
);
const currentBoxAssessment = computed(() =>
  presetBoxMap.value.get(p.value.key),
);
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

const ban = computed(() =>
  hasRelevantBan.value
    ? banReplace(
        p.value.plan.ops,
        runBans.value,
        forced.value,
        p.value.plan.layers,
        hasAnyBox.value ? operatorBox : undefined,
      )
    : null,
);
const banAfter = computed(() =>
  ban.value
    ? covenantStats(
        ban.value.ops,
        p.value.plan.layers,
        [],
        runBanSet.value,
      ).filter((s) => s.active)
    : [],
);
function pickAlt(replaces: string, name: string): void {
  forced.value = {
    ...Object.fromEntries(
      Object.entries(forced.value).filter(([, chosen]) => chosen !== name),
    ),
    [replaces]: name,
  };
}
function saveBan(): void {
  const result = ban.value;
  if (!result?.ops.length) return;
  const source = p.value.plan,
    st = STRATEGY[source.strategy];
  const key = addPlan({
    ...blankPlan(`${source.name.slice(0, 13)}·替`),
    ops: JSON.parse(JSON.stringify(result.ops)),
    strategy: st && runBans.value.includes(st.category) ? '' : source.strategy,
    note: source.note,
    layers: {...source.layers},
  });
  setRun(key);
  selectBuild(key);
}

/* ---------- 工具面板；分享链接的片段在显式导入前保留 ---------- */
const activePanel = computed(
  () =>
    queryText(routeQuery.value, 'panel') ||
    (currentRoute.value.hash.startsWith('#p=') ? 'import' : ''),
);
const importOpen = computed(() => activePanel.value === 'import');
function togglePanel(name: 'import' | 'backup' | 'share'): void {
  const closedPanel = currentRoute.value.hash.startsWith('#p=')
    ? 'closed'
    : null;
  void updateQuery({panel: activePanel.value === name ? closedPanel : name});
}

/* ---------- 导入：分享码 / 链接 ---------- */
const importText = ref('');
const pasteError = ref('');
const canReadClipboard =
  typeof navigator !== 'undefined' &&
  typeof navigator.clipboard?.readText === 'function';
const imported = computed<Decoded | null>(() =>
  importText.value.trim() ? decodePlan(importText.value) : null,
);
async function pasteImport(): Promise<void> {
  pasteError.value = '';
  try {
    const text = await navigator.clipboard.readText();
    if (text) importText.value = text;
    else pasteError.value = '剪贴板里还没有内容。';
  } catch {
    pasteError.value = '浏览器未授予读取剪贴板权限，请手动粘贴。';
  }
}
function acceptImport(andRun = false): void {
  const d = imported.value;
  if (!d || (andRun && !d.plan.ops.length)) return;
  const key = addPlan({
    ...blankPlan(d.plan.name || '导入的流派'),
    ops: d.plan.ops,
    strategy: d.plan.strategy,
    note: d.plan.note,
    layers: d.plan.layers,
  });
  if (andRun) setRun(key);
  // Only explicit import consumes the fragment; preview survives WeChat -> browser handoff.
  void navigate({path: buildLocation(key), query: {}, hash: ''}, true);
  importText.value = '';
  pasteError.value = '';
}
watch(
  () => currentRoute.value.hash,
  (hash) => {
    if (hash.startsWith('#p=')) importText.value = hash;
  },
  {immediate: true},
);
</script>
<template>
  <div
    :class="[
      'bsel-wrap',
      {'is-editing': editing && !importOpen && activePanel !== 'backup'},
    ]">
    <div
      :class="['bsel-drawer', {collapsed: settings.collapsePresetBuilds}]"
      :inert="settings.collapsePresetBuilds"
      :aria-hidden="settings.collapsePresetBuilds ? 'true' : undefined">
      <div class="bsel-drawer-inner">
        <div class="bsel bsel-presets">
          <template v-for="(group, gi) in drawerGroups" :key="gi">
            <span v-if="gi > 0" class="sp"></span>
            <button
              v-for="(x, idx) in group.list"
              :key="x.key"
              type="button"
              :class="{on: x.key === p.key, run: x.key === runKey}"
              :style="{'--c': presetColor(x), '--i': group.offset + idx}"
              :data-bd="x.key"
              :aria-pressed="x.key === p.key"
              @click="selectBuild(x.key)">
              <CovenantIcon v-if="CORE_BUILDS[x.key]" :name="x.key" />
              {{ x.plan.name }}
              <i v-if="x.modified" class="md" title="已修改">✎</i>
              <i
                v-if="x.boxBadge"
                :class="['box-fit-pill', x.boxBadge.tone]"
                :title="x.boxBadge.title">
                {{ x.boxBadge.text }}
              </i>
              <i
                v-if="banImpact.get(x.key)"
                class="ban-hit"
                :title="`本局禁池缺 ${banImpact.get(x.key)} 人`">
                -{{ banImpact.get(x.key) }}
              </i>
            </button>
          </template>
        </div>
      </div>
    </div>
    <div class="bsel bsel-bar">
      <button
        type="button"
        :class="['preset-fold', {folded: settings.collapsePresetBuilds}]"
        :aria-expanded="!settings.collapsePresetBuilds"
        @click="togglePresetFold">
        <span>
          {{ settings.collapsePresetBuilds ? '预设流派' : '收起预设' }}
        </span>
        <i>{{ builtinCount }}</i>
        <svg
          class="preset-fold-arrow"
          viewBox="0 0 12 12"
          width="11"
          height="11"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true">
          <path d="M2.5 7.5 6 4l3.5 3.5" />
        </svg>
      </button>
      <button
        v-if="hasAnyBox"
        type="button"
        :class="['add', 'box-sort-btn', {on: sortByBox}]"
        :aria-pressed="sortByBox"
        title="按当前账号 Box 完整度与自持激活率排序流派"
        @click="sortByBox = !sortByBox">
        {{ sortByBox ? '✓ 按 Box 适配度' : '按 Box 适配度' }}
      </button>
      <TransitionGroup
        name="bsel-pin"
        @before-leave="pinBeforeLeave"
        @leave-cancelled="clearPinStyle">
        <button
          v-for="x in pinnedPresets"
          :key="`pin:${x.key}`"
          type="button"
          :class="{on: x.key === p.key, run: x.key === runKey}"
          :style="{'--c': presetColor(x)}"
          :data-bd="x.key"
          :aria-pressed="x.key === p.key"
          @click="selectBuild(x.key)">
          <CovenantIcon v-if="CORE_BUILDS[x.key]" :name="x.key" />
          {{ x.plan.name }}
          <i v-if="x.modified" class="md" title="已修改">✎</i>
          <i
            v-if="x.boxBadge"
            :class="['box-fit-pill', x.boxBadge.tone]"
            :title="x.boxBadge.title">
            {{ x.boxBadge.text }}
          </i>
          <i
            v-if="banImpact.get(x.key)"
            class="ban-hit"
            :title="`本局禁池缺 ${banImpact.get(x.key)} 人`">
            -{{ banImpact.get(x.key) }}
          </i>
        </button>
        <span key="sp-mine" class="sp"></span>
        <span key="bk-mine" class="bk">我的</span>
        <button
          v-for="x in mine"
          :key="x.key"
          type="button"
          :class="['my', {on: x.key === p.key, run: x.key === runKey}]"
          style="--c: var(--accent)"
          :data-bd="x.key"
          :aria-pressed="x.key === p.key"
          @click="selectBuild(x.key)">
          {{ x.plan.name }}
          <i
            v-if="x.boxBadge"
            :class="['box-fit-pill', x.boxBadge.tone]"
            :title="x.boxBadge.title">
            {{ x.boxBadge.text }}
          </i>
          <i
            v-if="banImpact.get(x.key)"
            class="ban-hit"
            :title="`本局禁池缺 ${banImpact.get(x.key)} 人`">
            -{{ banImpact.get(x.key) }}
          </i>
        </button>
        <button key="act-new" type="button" class="add" @click="createBuild">
          ＋ 新建
        </button>
        <button
          key="act-import"
          type="button"
          :class="['add', {on: importOpen}]"
          :aria-expanded="importOpen"
          :aria-controls="importOpen ? 'build-import' : undefined"
          @click="togglePanel('import')">
          导入
        </button>
        <button
          key="act-backup"
          type="button"
          :class="['add', {on: activePanel === 'backup'}]"
          :aria-expanded="activePanel === 'backup'"
          :aria-controls="activePanel === 'backup' ? 'build-backup' : undefined"
          @click="togglePanel('backup')">
          备份与恢复
        </button>
      </TransitionGroup>
    </div>
  </div>

  <StatusNotice
    v-if="saveErrorMessage"
    tone="warning"
    :message="saveErrorMessage" />

  <PlanBackupPanel v-if="activePanel === 'backup'" id="build-backup" />

  <section v-if="importOpen" id="build-import" class="pl-panel bimp">
    <div class="bimp-bar">
      <input
        v-model="importText"
        class="pl-paste"
        placeholder="粘贴分享码、链接或整段攻略文案"
        aria-label="分享码" />
      <button v-if="canReadClipboard" type="button" @click="pasteImport">
        粘贴
      </button>
    </div>
    <StatusNotice v-if="pasteError" tone="warning" :message="pasteError" />
    <template v-if="imported">
      <PlanSummary
        :ops="imported.plan.ops"
        :strategy="imported.plan.strategy"
        :note="imported.plan.note"
        :layers="imported.plan.layers"
        :title="imported.plan.name || '导入的流派'" />
      <div class="pl-row">
        <button type="button" @click="acceptImport(false)">存为我的流派</button>
        <button
          type="button"
          class="pri"
          :disabled="!imported.plan.ops.length"
          @click="acceptImport(true)">
          导入并设为本局
        </button>
      </div>
    </template>
    <StatusNotice
      v-else-if="importText.trim()"
      tone="warning"
      message="认不出这个分享码" />
  </section>

  <PlannerView v-if="editing" @done="completeEdit" />

  <div v-else class="panel" :style="{'--c': accent}">
    <div class="ph">
      <CovenantIcon v-if="COVENANTS[p.key]" :name="p.key" emblem />
      <h2>{{ p.plan.name }}</h2>
      <span v-if="base?.tagline" class="tag a">{{ base.tagline }}</span>
      <span v-if="p.modified" class="tag">已修改</span>
      <span class="bact">
        <button
          type="button"
          :class="['pri', {in: isRun}]"
          :disabled="!p.plan.ops.length"
          @click="isRun ? endRun() : setRun(p.key)">
          {{ isRun ? '✓ 本局 · 结束' : '▶ 本局打这套' }}
        </button>
        <button
          v-if="isRun && needs.length"
          type="button"
          class="b-go-cv"
          @click="actions.openCovenant(needs[0].name)">
          去盟约抓牌 ▸
        </button>
        <button
          type="button"
          :class="{on: activePanel === 'share'}"
          :aria-expanded="activePanel === 'share'"
          :aria-controls="activePanel === 'share' ? 'build-share' : undefined"
          @click="togglePanel('share')">
          分享
        </button>
        <button type="button" @click="editBuild(p.key)">编辑</button>
        <button type="button" @click="duplicateBuild(p.key)">复制</button>
        <template
          v-if="coreNames.length && coreNames.length < p.plan.ops.length">
          <OperatorRequestButton
            :names="coreNames"
            :build-name="p.plan.name"
            label="求核心" />
          <OperatorRequestButton
            :names="p.plan.ops.map((slot) => slot.name)"
            :build-name="p.plan.name"
            label="求整队" />
        </template>
        <OperatorRequestButton
          v-else
          :names="p.plan.ops.map((slot) => slot.name)"
          :build-name="p.plan.name" />
        <ConfirmButton
          v-if="p.modified"
          label="恢复默认"
          confirm-label="确认恢复"
          tone="neutral"
          :reset-key="p.key"
          @confirm="restore" />
        <ConfirmButton
          v-if="!p.builtin"
          label="删除"
          confirm-label="确认删除"
          :reset-key="p.key"
          @confirm="remove" />
      </span>
    </div>

    <PlanSharePanel
      v-if="activePanel === 'share'"
      id="build-share"
      :plan="p.plan" />

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
        type="button"
        :class="['bbtn', {on: banOpen}]"
        :aria-expanded="banOpen"
        @click="manualBanOpen = !banOpen">
        有盟约被 ban？
      </button>
    </div>

    <div v-if="slotEntries.length && banOpen" class="bban">
      <div class="bpick">
        <span class="k">点选被 ban 的</span>
        <button
          v-for="covName in visibleBanCovenants"
          :key="covName"
          type="button"
          :class="['bc', {on: runBans.includes(covName)}]"
          :aria-pressed="runBans.includes(covName)"
          :style="{'--c': color(covName)}"
          @click="toggleBan(covName)">
          <CovenantIcon :name="covName" />
          {{ covName }}
        </button>
        <button
          type="button"
          class="bc-more"
          :aria-expanded="showAllBans"
          @click="showAllBans = !showAllBans">
          {{ showAllBans ? '收起其他盟约' : '其他盟约 ▾' }}
        </button>
      </div>
      <template v-if="ban">
        <div v-for="pk in ban.picks" :key="pk.replaces" class="bpk">
          <span
            class="av off"
            :data-t="OPERATOR[pk.replaces].tier"
            :data-op="pk.replaces"
            :title="`${pk.replaces} 不会出现`">
            <img :src="avatarSrc(pk.replaces)" alt="" width="36" height="36" />
            <small>{{ pk.replaces }}</small>
          </span>
          <b class="ar">→</b>
          <button
            type="button"
            class="av to"
            :data-t="OPERATOR[pk.name].tier"
            :data-op="pk.name"
            @click="actions.openDetail('op', pk.name)">
            <img :src="avatarSrc(pk.name)" alt="" width="36" height="36" />
            <small>{{ pk.name }}</small>
          </button>
          <span class="g">
            <i v-for="c in pk.gains" :key="c" :style="{'--c': color(c)}">
              <CovenantIcon :name="c" />
              {{ c }}
            </i>
          </span>
          <span v-if="pk.alts.length" class="alts">
            <span class="k">或</span>
            <button
              v-for="a in pk.alts"
              :key="a"
              type="button"
              :data-t="OPERATOR[a].tier"
              :data-op="a"
              :aria-label="`换成 ${a}`"
              @click="pickAlt(pk.replaces, a)">
              <img :src="avatarSrc(a)" alt="" width="28" height="28" />
            </button>
          </span>
        </div>
        <div
          v-for="n in ban.removed.filter(
            (n) => !ban!.picks.some((pk) => pk.replaces === n),
          )"
          :key="n"
          class="bpk">
          <span class="av off" :data-t="OPERATOR[n].tier" :data-op="n">
            <img :src="avatarSrc(n)" alt="" width="36" height="36" />
            <small>{{ n }}</small>
          </span>
          <span class="hint">找不到能补回盟约的替代</span>
        </div>
        <div class="bres">
          <span class="k">换人后</span>
          <span
            v-for="s in banAfter"
            :key="s.name"
            :class="['c', 'on', {max: s.bonusActive}]"
            :style="{'--c': color(s.name)}">
            <CovenantIcon :name="s.name" />
            {{ s.name }}
            <small>{{ s.count }}/{{ s.need }}</small>
          </span>
          <span
            v-for="l in ban.lost"
            :key="l"
            class="c lost"
            :style="{'--c': color(l)}">
            <CovenantIcon :name="l" />
            {{ l }}
            <small>失效</small>
          </span>
          <button
            type="button"
            class="pri"
            :disabled="!ban.ops.length"
            @click="saveBan">
            存为新流派 · 本局打它
          </button>
        </div>
      </template>
      <p v-else class="hint">
        被 ban 盟约的干员整局不会出现，点上面的盟约看替代方案
      </p>
    </div>

    <div>
      <div class="bsec-head">
        <h5>
          {{ lineupMode === 0 ? '终盘阵容' : '按等阶抓牌顺序' }}
          <template v-if="lineupMode === 0 && coreBase">
            ·
            <span class="tag a" style="padding: 0 6px">核心</span>
          </template>
          <span v-if="slotEntries.length" class="cnt">
            · {{ slotEntries.length }} 人 · 招募 {{ cost.recruit }}
            <template v-if="cost.elites">· {{ cost.elites }} 精锐</template>
          </span>
        </h5>
        <SubTabs
          v-if="slotEntries.length"
          v-model="lineupMode"
          :items="LINEUP_TABS"
          :level="3"
          inline
          aria-label="阵容视图"
          attr="bdl"
          @change="(_, dir) => (lineupDir = dir)" />
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
          :aria-controls="boxCheckOpen ? 'build-box-details' : undefined"
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
          v-if="boxCheckOpen && hasBoxDetails"
          id="build-box-details"
          class="b-box-body">
          <div
            v-if="currentBoxAssessment.substitutes.length"
            class="b-box-gaps">
            <span class="b-box-gap-label">未借 6★（不借将变替补）：</span>
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
      <div
        v-if="slotEntries.length"
        :key="lineupMode"
        :class="{'subtab-panel': !!lineupDir}"
        :data-dir="lineupDir || undefined">
        <template v-if="lineupMode === 0">
          <div class="tiles">
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
                      {{ item.slot?.core ? '★ ' : '' }}{{ item.operator.name }}
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
    </div>
    <div class="bgrid">
      <div v-if="tips.length">
        <h5>打法要点</h5>
        <ol class="qsteps">
          <li
            v-for="(tip, index) in tips"
            :key="index"
            :style="{animationDelay: index * 0.06 + 's'}">
            <span>{{ tip }}</span>
          </li>
        </ol>
      </div>
      <div style="display: grid; gap: 12px; align-content: start">
        <div v-if="strategies.length" data-key="strategies">
          <h5>策略</h5>
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
        <div
          v-if="equipment.length || planEquipNotes.length"
          data-key="equipment">
          <h5>装备与配装</h5>
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
              {{ note.text }}
            </li>
          </ul>
        </div>
      </div>
    </div>
    <details v-if="effects.length" class="bfx bfx-fold" :open="!isSmallWindow">
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
    <div v-if="main" class="qcalc" :style="{'--c': accent}">
      <div class="vals">
        <div v-for="layers in [0, 50, 100, 150, 200]" :key="layers">
          <span>{{ layers }} 层 · {{ main.label }}</span>
          <b>
            {{ round1(main.at(layers)) }}
            <small>{{ main.unit }}</small>
          </b>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.box-fit-pill {
  font-style: normal;
  font-family: var(--fn);
  font-size: 10.5px;
  font-weight: 700;
  line-height: 1.35;
  padding: 0 5px;
  border-radius: 999px;
  margin-left: 2px;
}
.box-fit-pill.warn {
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  color: var(--accent);
}
.box-fit-pill.ok {
  background: color-mix(in srgb, var(--teal) 14%, transparent);
  color: var(--teal);
}
.bsel button.on .box-fit-pill {
  background: color-mix(in srgb, currentColor 18%, transparent);
  color: inherit;
}
.b-box-strip {
  display: grid;
  margin: 0 0 8px;
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
  transition: transform 0.16s ease;
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
  .b-box-arrow {
    transition: none;
  }
}
:global(:root[data-motion='reduce'] .b-box-arrow) {
  transition: none !important;
}
</style>
