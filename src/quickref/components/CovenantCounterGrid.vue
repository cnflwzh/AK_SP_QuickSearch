<script setup lang="ts">
import {computed, ref, watch} from 'vue';
import {
  ADDON_COVENANTS,
  CORE_COVENANTS,
  TIER_LABELS,
  covenantColor,
  equipmentWithRoles,
  operatorRolesAtElite,
  operatorsWithRoles,
  type CombatRole,
  type Operator,
} from '../../../data/index.ts';
import {avatarSrc, equipIconSrc} from '../../lib/ui/assets.ts';
import {isBoxSubstitute} from '../../lib/box/insights.ts';
import {hasAnyBox, operatorBox} from '../../lib/box/store.ts';
import {inRun, isRunBannedOp, run, runStat} from '../planStore.ts';
import {useQuickrefActions} from '../state.ts';
import CovenantIcon from './CovenantIcon.vue';
import Segmented from './Segmented.vue';
import EmptyState from './EmptyState.vue';

const props = withDefaults(
  defineProps<{
    roles: readonly CombatRole[];
    compact?: boolean;
    showEquipment?: boolean;
  }>(),
  {
    compact: false,
    showEquipment: true,
  },
);

const actions = useQuickrefActions();

interface RankedOp {
  readonly op: Operator;
  readonly inCurrentRun: boolean;
  readonly requiresElite: boolean;
  readonly isSubstitute: boolean;
}

interface CovenantGroup {
  readonly covenant: string;
  readonly kind: 'core' | 'addon';
  readonly color: string;
  readonly isRunCovenant: boolean;
  readonly ops: readonly RankedOp[];
}

/** 0 全部盟约 · 1 核心盟约 · 2 附加盟约 */
const covScope = ref<0 | 1 | 2>(0);
const onlyRunCov = ref(false);
const hideSubstitutes = ref(false);

watch([() => props.roles.join('|'), () => run.value?.key], () => {
  covScope.value = 0;
  onlyRunCov.value = false;
});

const allMatchedOps = computed(() =>
  operatorsWithRoles(props.roles).filter((op) => op.stars > 0),
);

const rankedOps = computed<readonly RankedOp[]>(() => {
  const roles = props.roles;
  const checkBox = hasAnyBox.value;
  return allMatchedOps.value
    .filter((op) => !isRunBannedOp(op.name))
    .map((op) => ({
      op,
      inCurrentRun: inRun.value.has(op.name),
      requiresElite: !operatorRolesAtElite(op, false).some((role) =>
        roles.includes(role),
      ),
      isSubstitute: checkBox && isBoxSubstitute(op, operatorBox),
    }))
    .sort((a, b) => {
      if (a.inCurrentRun !== b.inCurrentRun) return a.inCurrentRun ? -1 : 1;
      if (a.isSubstitute !== b.isSubstitute) return a.isSubstitute ? 1 : -1;
      return a.op.tier - b.op.tier;
    });
});

const bannedHiddenCount = computed(
  () => allMatchedOps.value.length - rankedOps.value.length,
);
const substituteCount = computed(
  () => rankedOps.value.filter((entry) => entry.isSubstitute).length,
);

const hideSubstitutesActive = computed(
  () => hasAnyBox.value && hideSubstitutes.value && substituteCount.value > 0,
);

const availableOps = computed<readonly RankedOp[]>(() =>
  hideSubstitutesActive.value
    ? rankedOps.value.filter((entry) => !entry.isSubstitute)
    : rankedOps.value,
);

function chipTitle(entry: RankedOp): string | undefined {
  if (!entry.isSubstitute) return undefined;
  return entry.op.backupOperator
    ? `未持有且未借用，局内将替补为「${entry.op.backupOperator}」，可能缺失该对策能力（可在「我的 Box」加入助战）`
    : '未持有且未借用，局内将由原型/预备干员替补，可能缺失该对策能力';
}

function buildGroups(
  covenants: readonly string[],
  kind: 'core' | 'addon',
): CovenantGroup[] {
  const runCovs = runStat.value;
  const groups: CovenantGroup[] = [];
  for (const cov of covenants) {
    const ops = availableOps.value.filter((entry) =>
      entry.op.covenants.includes(cov),
    );
    if (!ops.length) continue;
    groups.push({
      covenant: cov,
      kind,
      color: covenantColor(cov, 'var(--teal)'),
      isRunCovenant: !!run.value && runCovs.has(cov),
      ops,
    });
  }
  return groups.sort((a, b) => {
    if (a.isRunCovenant !== b.isRunCovenant) return a.isRunCovenant ? -1 : 1;
    return 0;
  });
}

const coreGroups = computed(() => buildGroups(CORE_COVENANTS, 'core'));
const addonGroups = computed(() => buildGroups(ADDON_COVENANTS, 'addon'));

const hasBothKinds = computed(
  () => coreGroups.value.length > 0 && addonGroups.value.length > 0,
);
const hasRunCovGroup = computed(
  () =>
    !!run.value &&
    (coreGroups.value.some((g) => g.isRunCovenant) ||
      addonGroups.value.some((g) => g.isRunCovenant)),
);

const visibleCoreGroups = computed(() => {
  if (covScope.value === 2) return [];
  return onlyRunCov.value
    ? coreGroups.value.filter((g) => g.isRunCovenant)
    : coreGroups.value;
});
const visibleAddonGroups = computed(() => {
  if (covScope.value === 1) return [];
  return onlyRunCov.value
    ? addonGroups.value.filter((g) => g.isRunCovenant)
    : addonGroups.value;
});

// 同一干员可同时出现在多个盟约，标题只统计当前可见结果中的不同干员。
const visibleOpCount = computed(() => {
  const names = new Set<string>();
  for (const group of [
    ...visibleCoreGroups.value,
    ...visibleAddonGroups.value,
  ]) {
    for (const {op} of group.ops) names.add(op.name);
  }
  return names.size;
});

function clearOperatorFilters(): void {
  covScope.value = 0;
  onlyRunCov.value = false;
  hideSubstitutes.value = false;
}

const matchedEquipment = computed(() =>
  props.showEquipment ? equipmentWithRoles(props.roles) : [],
);

const SCOPE_LABELS = ['全部', '核心盟约', '附加盟约'] as const;
</script>

<template>
  <div :class="['ccg', {compact}]">
    <div v-if="allMatchedOps.length" class="ccg-section">
      <div class="ccg-head">
        <div class="ccg-title">
          <h4>
            对策干员
            <small>{{ visibleOpCount }} 名 · 按盟约分组</small>
          </h4>
          <span v-if="bannedHiddenCount" class="ccg-ban">
            已滤禁池 {{ bannedHiddenCount }}
          </span>
        </div>
        <div class="ccg-controls">
          <button
            v-if="hasAnyBox && substituteCount > 0"
            type="button"
            :class="['ccg-run-btn', {on: hideSubstitutesActive}]"
            :aria-pressed="hideSubstitutesActive"
            :title="`隐藏 ${substituteCount} 名未持有且未借用（将变替补）的非特许 6★`"
            @click="hideSubstitutes = !hideSubstitutes">
            {{
              hideSubstitutesActive
                ? `已隐藏替补 ${substituteCount}`
                : `仅看本体可用 (${rankedOps.length - substituteCount})`
            }}
          </button>
          <button
            v-if="rankedOps.length && (hasRunCovGroup || onlyRunCov)"
            type="button"
            :class="['ccg-run-btn', {on: onlyRunCov}]"
            :aria-pressed="onlyRunCov"
            @click="onlyRunCov = !onlyRunCov">
            只看本局盟约
          </button>
          <Segmented
            v-if="rankedOps.length && (hasBothKinds || covScope !== 0)"
            :labels="SCOPE_LABELS"
            :active="covScope"
            attr="ccg-scope"
            aria-label="盟约类型筛选"
            @change="covScope = $event as 0 | 1 | 2" />
        </div>
      </div>

      <EmptyState
        v-if="!rankedOps.length"
        compact
        message="符合职能的干员都已被本局禁池排除。" />
      <EmptyState
        v-else-if="!visibleOpCount"
        compact
        :message="
          hideSubstitutesActive && !availableOps.length
            ? '符合职能的干员都需要借用助战才能以本体出战。'
            : '当前筛选下没有符合条件的对策干员。'
        "
        action-label="清除干员筛选"
        @action="clearOperatorFilters" />

      <div v-if="visibleCoreGroups.length" class="ccg-block">
        <div
          v-if="visibleAddonGroups.length && covScope === 0"
          class="ccg-subhead">
          核心盟约
          <small>{{ visibleCoreGroups.length }}</small>
        </div>
        <div class="ccg-groups">
          <div
            v-for="group in visibleCoreGroups"
            :key="`core:${group.covenant}`"
            :class="['ccg-row', {run: group.isRunCovenant}]"
            :style="{'--cov-c': group.color}">
            <div class="ccg-cov">
              <CovenantIcon :name="group.covenant" />
              <b>{{ group.covenant }}</b>
              <i>{{ group.ops.length }}</i>
              <em v-if="group.isRunCovenant">本局</em>
            </div>
            <div class="ccg-chips">
              <button
                v-for="entry in group.ops"
                :key="entry.op.name"
                type="button"
                :class="[
                  'ccg-chip',
                  {inrun: entry.inCurrentRun, 'is-sub': entry.isSubstitute},
                ]"
                :data-t="entry.op.tier"
                :data-op="entry.op.name"
                :title="chipTitle(entry)"
                @click="actions.openDetail('op', entry.op.name)">
                <img
                  :src="avatarSrc(entry.op.name)"
                  alt=""
                  width="22"
                  height="22"
                  loading="lazy"
                  decoding="async" />
                <i class="tn">{{ TIER_LABELS[entry.op.tier] }}</i>
                <span>{{ entry.op.name }}</span>
                <small v-if="entry.requiresElite">精锐</small>
                <span v-if="entry.isSubstitute" class="ccg-sub-tag">替补</span>
                <em v-if="entry.inCurrentRun">本局</em>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="visibleAddonGroups.length" class="ccg-block">
        <div
          v-if="visibleCoreGroups.length && covScope === 0"
          class="ccg-subhead">
          附加盟约
          <small>{{ visibleAddonGroups.length }}</small>
        </div>
        <div class="ccg-groups">
          <div
            v-for="group in visibleAddonGroups"
            :key="`addon:${group.covenant}`"
            :class="['ccg-row', 'addon', {run: group.isRunCovenant}]"
            :style="{'--cov-c': group.color}">
            <div class="ccg-cov">
              <CovenantIcon :name="group.covenant" />
              <b>{{ group.covenant }}</b>
              <i>{{ group.ops.length }}</i>
              <em v-if="group.isRunCovenant">本局</em>
            </div>
            <div class="ccg-chips">
              <button
                v-for="entry in group.ops"
                :key="entry.op.name"
                type="button"
                :class="[
                  'ccg-chip',
                  {inrun: entry.inCurrentRun, 'is-sub': entry.isSubstitute},
                ]"
                :data-t="entry.op.tier"
                :data-op="entry.op.name"
                :title="chipTitle(entry)"
                @click="actions.openDetail('op', entry.op.name)">
                <img
                  :src="avatarSrc(entry.op.name)"
                  alt=""
                  width="22"
                  height="22"
                  loading="lazy"
                  decoding="async" />
                <i class="tn">{{ TIER_LABELS[entry.op.tier] }}</i>
                <span>{{ entry.op.name }}</span>
                <small v-if="entry.requiresElite">精锐</small>
                <span v-if="entry.isSubstitute" class="ccg-sub-tag">替补</span>
                <em v-if="entry.inCurrentRun">本局</em>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="matchedEquipment.length" class="ccg-section">
      <div class="ccg-head">
        <div class="ccg-title">
          <h4>
            对策装备
            <small>{{ matchedEquipment.length }} 件</small>
          </h4>
        </div>
      </div>
      <div class="ccg-chips">
        <button
          v-for="eq in matchedEquipment"
          :key="eq.name"
          type="button"
          class="ccg-chip eq"
          :data-t="eq.tier"
          :data-eq="eq.name"
          @click="actions.openDetail('eq', eq.name)">
          <img
            :src="equipIconSrc(eq.name)"
            alt=""
            width="22"
            height="22"
            loading="lazy"
            decoding="async" />
          <i class="tn">{{ TIER_LABELS[eq.tier] }}</i>
          <span>{{ eq.name }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ccg {
  display: grid;
  gap: 12px;
  min-width: 0;
}
.ccg.compact {
  gap: 9px;
}
.ccg-section {
  display: grid;
  gap: 7px;
  min-width: 0;
}
.ccg-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 6px 10px;
}
.ccg-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.ccg-title h4 {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  color: var(--ink);
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
}
.ccg-title small {
  font-size: 11.5px;
  font-weight: 500;
  color: var(--ink3);
}
.ccg-ban {
  font-size: 11px;
  font-weight: 600;
  color: var(--red);
  padding: 1px 6px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--red) 10%, transparent);
}
.ccg-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.ccg-run-btn {
  min-height: 34px;
  padding: 2px 9px;
  border: 1px solid var(--line2);
  border-radius: 6px;
  background: var(--surface2);
  color: var(--ink2);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition:
    border-color 0.14s ease,
    background-color 0.14s ease,
    color 0.14s ease;
}
.ccg-run-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.ccg-run-btn.on {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--accent-ink);
}
.ccg-block {
  display: grid;
  gap: 5px;
  min-width: 0;
}
.ccg-subhead {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  font-weight: 700;
  color: var(--ink3);
  letter-spacing: 0.03em;
}
.ccg-subhead small {
  font-family: var(--fn);
  font-weight: 600;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--surface2);
  color: var(--ink3);
}
.ccg-groups {
  display: grid;
  gap: 5px;
}
.ccg-row {
  display: grid;
  grid-template-columns: 108px minmax(0, 1fr);
  gap: 8px;
  align-items: start;
  padding: 6px 8px;
  border: 1px solid var(--line);
  border-left: 3px solid var(--cov-c, var(--teal));
  border-radius: 8px;
  background: color-mix(in srgb, var(--cov-c, var(--teal)) 4%, var(--surface));
}
.ccg-row.addon {
  border-left-color: color-mix(in srgb, var(--teal) 60%, var(--line2));
  background: var(--surface);
}
.ccg-row.run {
  border-color: color-mix(in srgb, var(--accent) 55%, var(--line));
  border-left-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 6%, var(--surface));
}
.ccg-cov {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  padding-top: 6px;
  min-width: 0;
}
.ccg-cov :deep(.cv-ic) {
  --cv-ic-size: 14px;
  color: var(--cov-c, var(--teal));
  flex: none;
}
.ccg-cov b {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--ink);
  line-height: 1.25;
}
.ccg-cov i {
  font-style: normal;
  font-family: var(--fn);
  font-size: 11px;
  color: var(--ink3);
}
.ccg-cov em {
  font-style: normal;
  font-size: 10px;
  font-weight: 700;
  padding: 0 4px;
  border-radius: 3px;
  background: var(--accent);
  color: var(--accent-ink);
  line-height: 1.45;
}
.ccg-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  min-width: 0;
}
.ccg-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 34px;
  padding: 3px 8px 3px 4px;
  border: 1px solid var(--line2);
  border-radius: 7px;
  background: var(--surface2);
  color: var(--ink);
  font: inherit;
  font-size: 12.5px;
  cursor: pointer;
  transition:
    border-color 0.12s ease,
    background-color 0.12s ease,
    transform 0.12s ease;
}
.ccg-chip:hover {
  border-color: var(--accent);
  background: var(--surface);
  transform: translateY(-1px);
}
.ccg-chip.inrun {
  border-color: var(--accent);
  background: var(--accent-soft);
  font-weight: 700;
}
.ccg-chip.is-sub {
  border-style: dashed;
}
.ccg-sub-tag {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 4px;
  border-radius: 4px;
  border: 1px solid var(--line2);
  background: var(--surface);
  color: var(--ink3);
}
.ccg-chip img {
  flex: none;
  border-radius: 5px;
  border: 1.5px solid var(--tc, var(--line));
  background: var(--surface);
  object-fit: cover;
}
.ccg-chip .tn {
  font-style: normal;
  font-family: var(--fn);
  font-size: 11px;
  font-weight: 700;
  color: var(--ink3);
}
.ccg-chip small {
  font-size: 10.5px;
  color: var(--accent);
  font-weight: 600;
}
.ccg-chip em {
  font-style: normal;
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 4px;
  background: var(--accent);
  color: var(--accent-ink);
  font-weight: 700;
}

@media (max-height: 600px) {
  .ccg {
    gap: 8px;
  }
  .ccg-row {
    grid-template-columns: 92px minmax(0, 1fr);
    gap: 6px;
    padding: 4px 6px;
  }
  .ccg-run-btn {
    min-height: 34px;
  }
  .ccg-chip {
    min-height: 34px;
    padding: 2px 7px 2px 3px;
    font-size: 12px;
  }
}

@container quickref-view (max-width: 560px) {
  .ccg-row {
    grid-template-columns: minmax(0, 1fr);
    gap: 5px;
    padding: 6px 7px;
  }
  .ccg-cov {
    padding-top: 0;
  }
  .ccg-run-btn {
    min-height: 34px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ccg-chip,
  .ccg-run-btn {
    transition: none;
  }
}
:global(:root[data-motion='reduce'] .ccg-chip),
:global(:root[data-motion='reduce'] .ccg-run-btn) {
  transition: none !important;
}
</style>
