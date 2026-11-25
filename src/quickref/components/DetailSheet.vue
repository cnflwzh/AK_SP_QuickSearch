<script setup lang="ts">
import {computed, nextTick, onBeforeUnmount, ref, watch} from 'vue';
import {
  COMBAT_ROLES,
  OPERATOR,
  EQUIP,
  EQUIPMENT_COMBOS,
  STRATEGY,
  OPERATORS,
  TIER_LABELS,
  TIER_STATS,
  COVENANTS,
  isCoreCovenant,
  rosterOf,
  type CombatRole,
  type Operator,
} from '../../../data/index.ts';
import {navigate} from '../../router/navigation.ts';
import {PAGE_PATHS, ROLE_IDS, idForLabel} from '../../router/location.ts';
import {avatarSrc, equipIconSrc, portraitSrc} from '../../lib/ui/assets.ts';
import {
  color,
  fx,
  peekFx,
  hpWidth,
  bonusHeadcount,
  bonusText,
} from '../format.ts';
import {MAX_EQ, MAX_OPS} from '../../lib/plans/core.ts';
import {useQuickrefActions, type DetailSelection} from '../state.ts';
import {
  isRunBannedOp,
  presetsUsing,
  quickTargetPreset,
  quickTargetOps,
  runAltTargets,
  runEquipMaterials,
  runEquipOwners,
  runEquipRecommended,
  runSlotMap,
  runStrategies,
  setStrategyInQuickBuild,
  toggleEquipInQuickBuild,
  toggleOpInQuickBuild,
} from '../planStore.ts';
import Chip from './Chip.vue';
import CovenantIcon from './CovenantIcon.vue';
import GlossaryText from './GlossaryText.vue';
import PrtsLink from './PrtsLink.vue';
import OperatorRequestButton from './OperatorRequestButton.vue';
import SectionHeading from './SectionHeading.vue';
const props = defineProps<{
  selection: DetailSelection | null;
  /** 分屏时仅覆盖速查区域，保持旁边的 Wiki 可以交互。 */
  splitView?: boolean;
}>();
const actions = useQuickrefActions();
const dialog = ref<HTMLDialogElement | null>(null);
const main = ref<HTMLDivElement | null>(null);
const covenantEffects = ref<HTMLElement | null>(null);
let returnFocus: HTMLElement | null = null;
const operator = computed(() =>
  props.selection?.kind === 'op' ? OPERATOR[props.selection.name] : undefined,
);
const roleDescMap = new Map(
  COMBAT_ROLES.map((item) => [item.label, item.desc]),
);

interface RoleEntry {
  readonly role: CombatRole;
  readonly condition: string;
}

function operatorRoleCondition(op: Operator, role: CombatRole): string {
  const conditions: string[] = [];
  if (op.eliteOnlyRoles?.includes(role)) conditions.push('精锐');
  if (role === '元素输出' && op.elementalPrerequisites) {
    const targets = op.elementalPrerequisites.map((e) =>
      e === '麻痹' ? e : e + '爆发',
    );
    conditions.push('需' + targets.join('或'));
  }
  if (op.minimumFieldRoles?.roles.includes(role)) {
    conditions.push('场上≥' + op.minimumFieldRoles.count + '人');
  }
  return conditions.join(' · ');
}

const operatorRoleEntries = computed<RoleEntry[]>(() => {
  const op = operator.value;
  if (!op?.roles?.length) return [];
  const entries = op.roles.map((role) => ({
    role,
    condition: operatorRoleCondition(op, role),
  }));
  // 常驻职能排在前，带前置条件的职能排在后，便于扫一眼先抓核心定位。
  return [
    ...entries.filter((e) => !e.condition),
    ...entries.filter((e) => e.condition),
  ];
});

function openRoleFilter(role: CombatRole): void {
  const id = idForLabel(ROLE_IDS, role);
  if (!id) return;
  void navigate({path: PAGE_PATHS.op, query: {role: id}});
}
const opBanned = computed(() =>
  operator.value ? isRunBannedOp(operator.value.name) : false,
);
const opRunSlot = computed(() =>
  operator.value ? runSlotMap.value.get(operator.value.name) : undefined,
);
const opAltTargets = computed(() =>
  operator.value ? (runAltTargets.value.get(operator.value.name) ?? []) : [],
);
const inQuickBuild = computed(
  () =>
    !!operator.value &&
    quickTargetOps.value.some((slot) => slot.name === operator.value!.name),
);
const quickBuildFull = computed(
  () => !!quickTargetPreset.value && quickTargetOps.value.length >= MAX_OPS,
);
const quickBuildLabel = computed(() => {
  const target = quickTargetPreset.value;
  if (!target) return '＋ 用TA建流派';
  if (inQuickBuild.value) return '✓ 已在流派 · 移出';
  if (quickTargetOps.value.length >= MAX_OPS)
    return `流派已满 ${MAX_OPS}/${MAX_OPS}`;
  const shortName =
    target.plan.name.length > 5
      ? `${target.plan.name.slice(0, 5)}…`
      : target.plan.name;
  return `＋ 加入「${shortName}」`;
});
function onToggleQuickBuild(): void {
  if (!operator.value) return;
  toggleOpInQuickBuild(operator.value.name);
}
// 分屏优先完整展示干员自身信息，盟约效果仅在普通详情中展开。
const showCovenantEffects = computed(
  () => !!operator.value && !props.splitView,
);
const equipment = computed(() =>
  props.selection?.kind === 'eq' ? EQUIP[props.selection.name] : undefined,
);
const eqOwners = computed(() =>
  equipment.value ? (runEquipOwners.value.get(equipment.value.name) ?? []) : [],
);
const eqInRec = computed(() =>
  equipment.value ? runEquipRecommended.value.has(equipment.value.name) : false,
);
const eqCraftsInto = computed(() =>
  equipment.value
    ? (runEquipMaterials.value.get(equipment.value.name) ?? [])
    : [],
);
const equipmentRecipes = computed(() =>
  equipment.value
    ? EQUIPMENT_COMBOS.filter((recipe) =>
        recipe.includes(equipment.value!.name),
      )
    : [],
);
const strategy = computed(() =>
  props.selection?.kind === 'st' ? STRATEGY[props.selection.name] : undefined,
);
const stIsPrimary = computed(() =>
  strategy.value ? runStrategies.value.primary === strategy.value.name : false,
);
const stInRun = computed(() =>
  strategy.value ? runStrategies.value.all.has(strategy.value.name) : false,
);
const strategyQuickSelected = computed(
  () =>
    !!strategy.value &&
    quickTargetPreset.value?.plan.strategy === strategy.value.name,
);
const strategyQuickLabel = computed(() => {
  const target = quickTargetPreset.value;
  if (!target) return '＋ 用TA建流派';
  const shortName =
    target.plan.name.length > 5
      ? `${target.plan.name.slice(0, 5)}…`
      : target.plan.name;
  return strategyQuickSelected.value
    ? `✓ 已设为「${shortName}」策略`
    : `＋ 设为「${shortName}」策略`;
});
const stats = computed(() =>
  operator.value ? TIER_STATS[operator.value.tier - 1] : undefined,
);
const mates = computed(() => {
  const current = operator.value;
  return current
    ? OPERATORS.filter(
        (other) =>
          other.name !== current.name &&
          other.tier === current.tier &&
          other.covenants.some((c) => current.covenants.includes(c)),
      )
    : [];
});
const builds = computed(() =>
  props.selection
    ? presetsUsing(props.selection.kind, props.selection.name)
    : [],
);
watch(
  [() => props.selection, () => props.splitView],
  async ([selection, splitView], [previousSelection]) => {
    await nextTick();
    // 路由或分屏状态在同一轮更新中变化时，只处理最新的展示状态。
    if (
      !dialog.value ||
      selection !== props.selection ||
      splitView !== props.splitView
    )
      return;
    if (selection) {
      if (!dialog.value.open) {
        returnFocus =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
      }
      const focusedChild =
        dialog.value.contains(document.activeElement) &&
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      // 原生模态会禁用整个文档；切换模式前先关闭，避免 show/showModal 抛出异常。
      const shouldBeModal = !splitView;
      if (dialog.value.open && dialog.value.matches(':modal') !== shouldBeModal)
        dialog.value.close();
      if (!dialog.value.open) {
        if (shouldBeModal) dialog.value.showModal();
        else dialog.value.show();
        focusedChild?.focus({preventScroll: true});
      }
      if (selection !== previousSelection) {
        if (main.value) main.value.scrollTop = 0;
        if (covenantEffects.value) covenantEffects.value.scrollTop = 0;
        dialog.value.scrollTop = 0;
      }
    } else if (dialog.value.open) {
      dialog.value.close();
      if (returnFocus?.isConnected) returnFocus.focus({preventScroll: true});
      returnFocus = null;
    }
  },
  {flush: 'post', immediate: true},
);
onBeforeUnmount(() => dialog.value?.close());
</script>
<template>
  <div
    :class="['detail-layer', {split: splitView && !!selection}]"
    @click.self="actions.closeDetail()">
    <dialog
      id="sheet"
      ref="dialog"
      aria-labelledby="detail-title"
      :class="[
        'sheet',
        {'operator-sheet': !!operator, 'with-side': showCovenantEffects},
      ]"
      :data-viewing="operator?.name ?? ''"
      @click.self="actions.closeDetail()"
      @cancel.prevent="actions.closeDetail()"
      @keydown.esc.stop.prevent="actions.closeDetail()">
      <div v-if="selection" ref="main" class="sh-main">
        <div
          v-if="operator"
          class="sh-h operator-detail-header"
          :data-t="operator.tier">
          <img
            v-if="avatarSrc(operator.name)"
            class="pic"
            :src="avatarSrc(operator.name)"
            alt=""
            width="80"
            height="80" />
          <div class="op-dh-info">
            <div class="op-dh-eyebrow">
              <i class="tn">{{ TIER_LABELS[operator.tier] }} 阶</i>
              <span v-if="operator.stars" class="stars">
                {{ '★'.repeat(operator.stars) }}
              </span>
              <GlossaryText class="op-dh-type" :text="operator.type" />
              <span v-if="opBanned" class="tag r">本局禁池</span>
              <span v-if="opRunSlot" class="tag t">
                {{ opRunSlot.core ? '★ 本局核心' : '✓ 本局主力' }}
              </span>
              <span v-else-if="!opBanned && opAltTargets.length" class="tag a">
                ⇄ 备选·替{{ opAltTargets[0] }}
              </span>
            </div>
            <div class="operator-detail-title">
              <h3 id="detail-title">{{ operator.name }}</h3>
            </div>
            <div class="op-dh-covs">
              <Chip
                v-for="name in operator.covenants"
                :key="name"
                kind="cv"
                :name="name" />
            </div>
          </div>
          <div class="operator-detail-controls">
            <button
              type="button"
              class="sh-x"
              data-close
              aria-label="关闭"
              @click="actions.closeDetail()">
              ✕
            </button>
            <div
              class="operator-detail-actions"
              role="group"
              aria-label="干员操作">
              <button
                type="button"
                :class="['operator-quick-build', {on: inQuickBuild}]"
                :disabled="!inQuickBuild && quickBuildFull"
                :title="
                  quickTargetPreset
                    ? `流派「${quickTargetPreset.plan.name}」（${quickTargetOps.length}/${MAX_OPS}）`
                    : '新建我的流派并加入这名干员'
                "
                @click="onToggleQuickBuild">
                {{ quickBuildLabel }}
              </button>
              <OperatorRequestButton :names="[operator.name]" />
              <PrtsLink :name="operator.name" />
            </div>
          </div>
        </div>
        <div v-else-if="equipment" class="sh-h" :data-t="equipment.tier">
          <img
            v-if="equipIconSrc(equipment.name)"
            class="pic e"
            :src="equipIconSrc(equipment.name)"
            alt=""
            width="80"
            height="80" />
          <div class="op-dh-info">
            <div class="op-dh-eyebrow">
              <i class="tn">{{ TIER_LABELS[equipment.tier] }} 阶</i>
              <span class="tag a">{{ equipment.price }} 资金</span>
              <span v-if="eqOwners.length" class="tag t">
                ✓ 给{{ eqOwners.join('·') }}
              </span>
              <span v-else-if="eqInRec" class="tag t">✓ 本局推荐</span>
              <span v-else-if="eqCraftsInto.length" class="tag a">
                ⇄ 合{{ eqCraftsInto[0] }}
              </span>
            </div>
            <div class="operator-detail-title">
              <h3 id="detail-title">{{ equipment.name }}</h3>
            </div>
            <div v-if="equipment.covenant" class="op-dh-covs">
              <Chip kind="cv" :name="equipment.covenant" />
            </div>
          </div>
          <button
            type="button"
            class="sh-x"
            data-close
            aria-label="关闭"
            @click="actions.closeDetail()">
            ✕
          </button>
        </div>
        <div v-else-if="strategy" class="sh-h">
          <img
            v-if="portraitSrc(strategy.name)"
            class="pic s"
            :src="portraitSrc(strategy.name)"
            alt=""
            width="88"
            height="88" />
          <div>
            <div class="row">
              <Chip
                v-if="isCoreCovenant(strategy.category)"
                kind="cv"
                :name="strategy.category" />
              <span v-else class="tag">{{ strategy.category }}</span>
              <span :class="['tag', {t: strategy.unlock === '初始'}]">
                {{ strategy.unlock }}
              </span>
            </div>
            <div class="operator-detail-title">
              <h3 id="detail-title">{{ strategy.name }}</h3>
              <span v-if="stIsPrimary" class="tag a">★ 本局首选</span>
              <span v-else-if="stInRun" class="tag t">✓ 本局备选</span>
            </div>
            <div class="hpbig">
              <b>{{ strategy.hp }}</b>
              <div class="trk">
                <div :style="{width: hpWidth(strategy.hp) + '%'}"></div>
              </div>
            </div>
            <div class="strategy-quick-row">
              <button
                type="button"
                :class="['operator-quick-build', {on: strategyQuickSelected}]"
                @click="setStrategyInQuickBuild(strategy.name)">
                {{ strategyQuickLabel }}
              </button>
            </div>
          </div>
          <button
            type="button"
            class="sh-x"
            data-close
            aria-label="关闭"
            @click="actions.closeDetail()">
            ✕
          </button>
        </div>
        <div class="sh-b">
          <div v-if="operator && stats" class="cmp2">
            <div>
              <div class="lb">
                <span class="tag">初始</span>
                <small>{{ stats.base }}</small>
              </div>
              <span v-html="fx(operator.trait)"></span>
            </div>
            <div class="el">
              <div class="lb">
                <GlossaryText class="tag a" text="精锐" />
                <small>{{ stats.elite }}</small>
              </div>
              <span v-html="fx(operator.elite)"></span>
            </div>
          </div>
          <div v-else-if="equipment" class="cmp2">
            <div
              v-html="
                `<div class='lb'><span class='tag'>基础</span></div>${fx(equipment.effect)}`
              "></div>
            <div
              class="el"
              v-html="
                `<div class='lb'><span class='tag a'>进阶</span></div>${fx(equipment.advanced || equipment.effect)}`
              "></div>
          </div>
          <div v-else-if="strategy" class="ef" style="--c: var(--teal)">
            <span class="tag t">{{ strategy.skill }}</span>
            <div v-html="fx(strategy.effect)"></div>
          </div>
          <div v-if="operatorRoleEntries.length" class="sh-sec sh-roles-sec">
            <SectionHeading
              title="实战职能"
              desc="点按可筛选同职能干员"
              variant="plain"
              :level="5" />
            <div class="sh-roles-list">
              <button
                v-for="item in operatorRoleEntries"
                :key="item.role"
                type="button"
                :class="['sh-role-chip', {'has-cond': !!item.condition}]"
                :title="`${item.role}：${roleDescMap.get(item.role) ?? ''}${item.condition ? `（触发条件：${item.condition}）` : ''}（点此按该职能筛选干员）`"
                @click="openRoleFilter(item.role)">
                <span class="sh-role-name">{{ item.role }}</span>
                <span v-if="item.condition" class="sh-role-cond">
                  {{ item.condition }}
                </span>
              </button>
            </div>
          </div>
          <div
            v-else-if="equipment && equipment.roles?.length"
            class="sh-sec sh-roles-sec">
            <SectionHeading
              title="实战职能"
              desc="点按可查看同职能干员"
              variant="plain"
              :level="5" />
            <div class="sh-roles-list">
              <button
                v-for="role in equipment.roles"
                :key="role"
                type="button"
                class="sh-role-chip"
                :title="`${role}：${roleDescMap.get(role) ?? ''}（点此查看同职能干员）`"
                @click="openRoleFilter(role)">
                <span class="sh-role-name">{{ role }}</span>
              </button>
            </div>
          </div>
          <div
            v-if="equipment && quickTargetPreset && quickTargetOps.length"
            class="sh-sec sh-eq-assign">
            <SectionHeading
              :title="`配给「${quickTargetPreset.plan.name}」`"
              variant="plain"
              :level="5" />
            <div class="row">
              <button
                v-for="slot in quickTargetOps"
                :key="slot.name"
                type="button"
                :class="['sh-eq-slot', {on: slot.eq.includes(equipment.name)}]"
                :disabled="
                  !slot.eq.includes(equipment.name) && slot.eq.length >= MAX_EQ
                "
                :title="
                  slot.eq.includes(equipment.name)
                    ? `从 ${slot.name} 卸下${equipment.name}`
                    : slot.eq.length >= MAX_EQ
                      ? `${slot.name} 装备已满 ${MAX_EQ}/${MAX_EQ}`
                      : `给 ${slot.name} 佩戴${equipment.name}`
                "
                @click="toggleEquipInQuickBuild(slot.name, equipment.name)">
                <img
                  v-if="avatarSrc(slot.name)"
                  :src="avatarSrc(slot.name)"
                  alt=""
                  width="20"
                  height="20" />
                <span>{{ slot.name }}</span>
                <small>
                  {{
                    slot.eq.includes(equipment.name)
                      ? '✓'
                      : `${slot.eq.length}/${MAX_EQ}`
                  }}
                </small>
              </button>
            </div>
          </div>
          <div v-if="equipmentRecipes.length" class="sh-sec">
            <SectionHeading title="组合配方" variant="plain" :level="5" />
            <div
              v-for="recipe in equipmentRecipes"
              :key="recipe[2]"
              class="row eq-formula">
              <Chip kind="eq" :name="recipe[0]" />
              <span aria-hidden="true">＋</span>
              <Chip kind="eq" :name="recipe[1]" />
              <span aria-hidden="true">→</span>
              <Chip kind="eq" :name="recipe[2]" />
            </div>
          </div>
          <div v-if="builds.length" class="sh-sec">
            <SectionHeading title="推荐流派" variant="plain" :level="5" />
            <div class="row">
              <Chip
                v-for="name in builds"
                :key="name"
                kind="build"
                :name="name" />
            </div>
          </div>
          <div v-if="mates.length" class="sh-sec">
            <SectionHeading
              title="同盟约 · 同阶"
              :count="`${mates.length} 名`"
              variant="plain"
              :level="5" />
            <div class="row">
              <Chip
                v-for="mate in mates"
                :key="mate.name"
                kind="op"
                :name="mate.name" />
            </div>
          </div>
        </div>
      </div>
      <aside
        v-if="operator && showCovenantEffects"
        ref="covenantEffects"
        class="sh-side"
        aria-label="盟约效果"
        tabindex="0">
        <div class="sd-k">盟约效果</div>
        <section
          v-for="(name, index) in operator.covenants"
          :key="name"
          class="sd-c"
          :data-key="name"
          :style="{'--c': color(name), '--i': index}">
          <button
            type="button"
            class="sd-h"
            :data-cv="name"
            data-peek="off"
            :title="`查看${name}盟约页`"
            @click="actions.openCovenant(name)">
            <CovenantIcon :name="name" />
            <b>{{ name }}</b>
            <span>
              {{ isCoreCovenant(name) ? '核心' : '附加' }} ·
              {{ rosterOf(name).length }} 名
            </span>
            <em>▸</em>
          </button>
          <div class="pk-row">
            <span>{{ COVENANTS[name].need }} 人</span>
            <div v-html="peekFx(COVENANTS[name].effect)"></div>
          </div>
          <div v-if="COVENANTS[name].bonus" class="pk-row a">
            <span>
              {{
                bonusHeadcount(COVENANTS[name].bonus)
                  ? bonusHeadcount(COVENANTS[name].bonus) + ' 名'
                  : '强化'
              }}
            </span>
            <div v-html="peekFx(bonusText(COVENANTS[name].bonus))"></div>
          </div>
        </section>
      </aside>
    </dialog>
  </div>
</template>

<style scoped>
.op-dh-info {
  min-width: 0;
  display: grid;
  gap: 5px;
  align-content: center;
}
.op-dh-eyebrow {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.op-dh-type {
  font-size: 11.5px;
  color: var(--ink3);
  padding: 0 6px;
  border-radius: 4px;
  background: var(--surface2);
  border: 1px solid var(--line);
  line-height: 1.55;
}
.operator-detail-title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.operator-detail-title h3 {
  margin: 0;
}
.op-dh-covs {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.operator-detail-header > div {
  min-width: 0;
}
.operator-detail-controls {
  align-self: stretch;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: space-between;
  gap: 10px;
}
.operator-detail-controls .sh-x {
  align-self: flex-end;
}
.operator-detail-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 6px;
}
.operator-quick-build {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 32px;
  padding: 4px 10px;
  border: 1px dashed var(--accent);
  border-radius: 6px;
  background: var(--surface);
  color: var(--accent);
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;
  white-space: nowrap;
  cursor: pointer;
}
.operator-quick-build.on {
  border-style: solid;
  background: var(--accent);
  color: var(--accent-ink);
}
.operator-quick-build:disabled {
  border-color: var(--line2);
  color: var(--ink3);
  opacity: 0.7;
  cursor: default;
}
.operator-detail-actions :deep(.operator-request),
.operator-detail-actions :deep(.prts-link) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 68px;
  min-height: 32px;
  padding: 4px 11px;
  border: 1px solid var(--line2);
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.5;
}
@media (pointer: coarse) {
  .operator-quick-build,
  .sh-role-chip,
  .operator-detail-actions :deep(.operator-request),
  .operator-detail-actions :deep(.prts-link) {
    min-height: 36px;
  }
}
@media (max-height: 600px) {
  .sh-h {
    padding: 10px 12px;
    gap: 10px;
  }
  .sh-h .pic {
    width: 60px;
    height: 60px;
  }
  .sh-h h3 {
    font-size: 20px;
  }
  .sh-b {
    padding: 10px 12px;
    gap: 8px;
  }
  .operator-quick-build,
  .operator-detail-actions :deep(.operator-request),
  .operator-detail-actions :deep(.prts-link),
  .sh-eq-slot {
    min-height: 34px;
  }
}
.strategy-quick-row {
  margin-top: 6px;
}

/* ---------- 详情页主体区块统一排版 ---------- */
.sh-sec {
  display: grid;
  gap: 6px;
}
.sh-roles-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.sh-role-chip {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--teal) 40%, var(--line2));
  border-radius: 6px;
  background: color-mix(in srgb, var(--teal) 9%, var(--surface2));
  color: var(--teal);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  overflow: hidden;
  cursor: pointer;
  transition:
    border-color 0.14s,
    color 0.14s,
    background-color 0.14s;
}
.sh-role-name {
  padding: 3px 9px;
  line-height: 1.3;
}
.sh-role-chip.has-cond {
  border-style: dashed;
  border-color: color-mix(in srgb, var(--teal) 45%, var(--line2));
  background: var(--surface2);
}
.sh-role-cond {
  padding: 3px 8px;
  border-left: 1px solid color-mix(in srgb, var(--line2) 70%, transparent);
  background: color-mix(in srgb, var(--accent) 9%, var(--surface));
  color: var(--ink2);
  font-size: 11px;
  font-weight: 500;
  line-height: 1.3;
}
.sh-role-chip:hover {
  border-style: solid;
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-soft);
}
.sh-role-chip:hover .sh-role-cond {
  color: var(--accent);
}
.sh-eq-slot {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 34px;
  padding: 3px 8px;
  border: 1px solid var(--line2);
  border-radius: 6px;
  background: var(--surface2);
  color: var(--ink);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.sh-eq-slot img {
  border-radius: 3px;
  background: var(--tc, var(--surface2));
}
.sh-eq-slot small {
  font-family: var(--fn);
  font-size: 11px;
  color: var(--ink3);
}
.sh-eq-slot:hover:not(:disabled) {
  border-color: var(--accent);
}
.sh-eq-slot.on {
  border-color: var(--teal);
  background: var(--teal-soft);
  color: var(--teal);
  font-weight: 600;
}
.sh-eq-slot.on small {
  color: var(--teal);
}
.sh-eq-slot:disabled {
  opacity: 0.45;
  cursor: default;
}
/* 窄屏将关闭键留在右上角，三枚操作按钮铺到底部整行，避免挤压标题或撑高头部。 */
@media (max-width: 560px) {
  .operator-detail-controls {
    display: contents;
  }
  .operator-detail-controls .sh-x {
    grid-column: 3;
    grid-row: 1;
  }
  .operator-detail-actions {
    grid-column: 1 / -1;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: flex-start;
    gap: 6px;
  }
  .operator-detail-actions :deep(.operator-request),
  .operator-detail-actions :deep(.prts-link) {
    min-width: 64px;
    padding-inline: 10px;
  }
}
.detail-layer {
  display: contents;
}
.detail-layer.split {
  position: fixed;
  inset: 0 var(--wiki-panel-width) 0 0;
  z-index: 90;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  container: detail-area / inline-size;
  background: rgba(5, 12, 14, 0.55);
  backdrop-filter: blur(2px);
}
.split dialog.sheet {
  --detail-max-height: min(88dvh, 800px);
  position: relative;
  inset: auto;
  flex: none;
  margin: 0;
  width: min(600px, calc(100% - 24px));
  max-height: var(--detail-max-height);
  flex-direction: column;
}
.split dialog.sheet.operator-sheet {
  width: min(940px, calc(100% - 24px));
}
/* 取消原先给盟约效果预留的高度；干员信息可使用整张卡片，内容较短时自然收起。 */
.split .sh-main {
  flex: 0 1 auto;
  max-height: var(--detail-max-height);
  overflow: auto;
}

.sh-side:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

/* 按左侧实际宽度调整详情布局，避免沿用整个浏览器宽度挤压两栏。 */
@container detail-area (max-width: 560px) {
  .operator-detail-controls {
    display: contents;
  }
  .operator-detail-controls .sh-x {
    grid-column: 3;
    grid-row: 1;
  }
  .operator-detail-actions {
    grid-column: 1 / -1;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: flex-start;
    gap: 6px;
  }
  .operator-detail-actions :deep(.operator-request),
  .operator-detail-actions :deep(.prts-link) {
    min-width: 64px;
    padding-inline: 10px;
  }
  .split dialog.sheet,
  .split dialog.sheet.operator-sheet {
    width: calc(100% - 16px);
  }
  .split .cmp2 {
    grid-template-columns: minmax(0, 1fr);
  }
  .split .sh-h {
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 10px;
    padding: 12px;
  }
  .split .sh-h .pic {
    width: 64px;
    height: 64px;
  }
  .split .sh-b {
    padding: 12px;
  }
}
@container detail-area (max-width: 400px) {
  .split .sh-h {
    gap: 8px;
    padding: 10px;
  }
  .split .sh-h .pic {
    width: 48px;
    height: 48px;
  }
  .split .sh-h h3 {
    font-size: 20px;
  }
  .split .sh-x {
    width: 32px;
    height: 32px;
  }
}
</style>
