<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onDeactivated, ref, watch } from 'vue';
import { STRATEGY, covenantColor } from '../../../data/index.ts';
import { equipIconSrc, portraitSrc } from '../../lib/assets.ts';
import { prefersReducedMotion } from '../../lib/dom.ts';
import { MAX_SHOP_CANDIDATES, type OwnedEquipment } from '../../lib/runAdvisor.ts';
import { MAX_OPS } from '../../lib/planner.ts';
import { currentRoute, openCard } from '../../router/navigation.ts';
import { queryText } from '../../router/location.ts';
import { useRunAdvisor } from './useRunAdvisor.ts';
import AdvisorSlot from './AdvisorSlot.vue';
import AdvisorOverlay from './AdvisorOverlay.vue';
import AdvisorInspector from './AdvisorInspector.vue';
import AdvisorPicker from './AdvisorPicker.vue';
import AdvisorRecommendations from './AdvisorRecommendations.vue';
import AdvisorPoolSettings from './AdvisorPoolSettings.vue';
import type { AdvisorSelection } from './types.ts';
import './advisor.css';

/**
 * 局内抓取：上场阵容、本轮商店（即抓取建议）、整备区三块。
 * 宽屏为左右两栏，建议栏常驻；窄屏单列滚动，不再分页切换。编辑和录入统一在弹层中完成。
 */
const advisor = useRunAdvisor();
const { run, deployed, reserve, covenants, recommendations, notice, saveFailed, canUndo, goal, unavailableNames, poolConflicts } = advisor;
const sidePanel = ref<HTMLElement>();
const storageView = ref<'reserve' | 'equipment'>('reserve');
const selection = ref<AdvisorSelection | null>(null);
const inspectorOpen = ref(false);
const poolSettingsOpen = ref(false);
const newRunConfirmationOpen = ref(false);
const suspendedForDetails = ref(false);
type PickerTarget = 'strategy' | 'deployed' | 'reserve' | 'equipment' | 'shop' | 'excluded';
const picker = ref<{ target: PickerTarget; holder: string } | null>(null);
const canReturnToPanel = computed(() => !!picker.value && (poolSettingsOpen.value || inspectorOpen.value && !!selection.value));
const recordingOperators = computed(() => picker.value?.target === 'deployed' || picker.value?.target === 'reserve');
const pickerSummary = computed(() => recordingOperators.value
  ? `上场 ${deployed.value.length}/${MAX_OPS} · 整备 ${reserve.value.length}`
  : picker.value?.target === 'equipment' ? `已记录 ${run.value.equipment.length} 件`
  : picker.value?.target === 'excluded' ? `已排除 ${run.value.excludedOperators.length} 名` : '');
const hasRunData = computed(() => run.value.level !== 1 || !!run.value.strategy || !!run.value.mainCovenant
  || !!run.value.mainTarget || !!run.value.operators.length || !!run.value.equipment.length || !!run.value.shop.length
  || !!run.value.bannedCovenants.length || !!run.value.excludedOperators.length);
const eliteNames = computed(() => run.value.operators.filter(operator => operator.elite).map(operator => operator.name));
const fieldSlots = computed(() => Array.from({ length: MAX_OPS }, (_, index) => deployed.value[index]));
const equipmentByHolder = computed(() => {
  const result = new Map<string, Readonly<OwnedEquipment>[]>();
  for (const item of run.value.equipment) {
    const list = result.get(item.holder) ?? [];
    list.push(item);
    result.set(item.holder, list);
  }
  return result;
});
const visibleCovenants = computed(() => covenants.value.filter(covenant => covenant.active || covenant.next === 1));
const selectedOperator = computed(() => selection.value?.kind === 'operator' ? run.value.operators.find(item => item.name === selection.value?.id) : undefined);
const selectedTitle = computed(() => selection.value?.kind === 'equipment' ? '编辑装备'
  : selectedOperator.value ? `编辑${selectedOperator.value.deployed ? '上场' : '整备区'}干员` : '编辑记录');
const pickerKind = computed(() => picker.value?.target === 'strategy' ? 'st' : picker.value?.target === 'equipment' ? 'eq' : 'op');
const pickerTitle = computed(() => picker.value?.target === 'strategy' ? '选择开局策略'
  : picker.value?.target === 'excluded' ? '排除禁用 / 未入池干员'
  : picker.value?.target === 'equipment' ? (picker.value.holder ? `为${picker.value.holder}添加装备` : '记录已获得的装备')
  : picker.value?.target === 'shop' ? `录入本轮商店 · 最多${MAX_SHOP_CANDIDATES}名`
  : picker.value?.target === 'reserve' ? '记录整备区干员' : '记录上场干员');
const selectedPickerNames = computed(() => picker.value?.target === 'excluded' ? run.value.excludedOperators
  : picker.value?.target === 'shop' ? run.value.shop : picker.value?.target === 'strategy' && run.value.strategy ? [run.value.strategy] : []);
const disabledPickerNames = computed(() => picker.value?.target === 'deployed' || picker.value?.target === 'reserve' ? eliteNames.value : []);
const excludedPickerNames = computed(() => pickerKind.value === 'op' && picker.value?.target !== 'excluded' ? unavailableNames.value : []);
const poolLabel = computed(() => `${goal.value ? `${goal.value.covenant} · ${goal.value.target}人` : run.value.mainCovenant === 'mixed' ? '混搭' : '方向 / 禁用'}${unavailableNames.value.length ? ` · 禁${unavailableNames.value.length}` : ''}`);
const strategySkill = computed(() => run.value.strategy ? STRATEGY[run.value.strategy]?.skill ?? '' : '');
const statusText = computed(() => saveFailed.value ? '本地保存失败，请勿关闭页面' : notice.value || '自动保存在此设备');
/** 录入的商店牌里，没有出现在推荐结果中的（禁用或待修正冲突）单独列出，避免“录了却不见”。 */
const blockedShop = computed(() => run.value.shop
  .filter(name => !recommendations.value.some(advice => advice.operator.name === name))
  .map(name => ({ name, reason: unavailableNames.value.includes(name) ? '本局禁用' : poolConflicts.value.length ? '待修正冲突' : '不参与推荐' })));
const directionNote = computed(() => goal.value ? `主攻${goal.value.covenant} · 目标${goal.value.target}人${run.value.mainCovenant ? '' : '（自动）'}`
  : run.value.mainCovenant === 'mixed' ? '混搭 · 比较整队收益' : '主轴未定 · 随来牌判断，可在「方向 / 禁用」手选');
const adviceEmptyMessage = computed(() => poolConflicts.value.length ? '先修正持有记录与禁用设置的冲突。'
  : '当前没有待追目标，可更新本数或录入商店。');

function releaseTransientUi(): void {
  picker.value = null;
  poolSettingsOpen.value = false;
  inspectorOpen.value = false;
  newRunConfirmationOpen.value = false;
  suspendedForDetails.value = false;
}
onDeactivated(releaseTransientUi);
onBeforeUnmount(releaseTransientUi);
// 查看详情只暂时收起弹窗。关闭详情后复用原选择器，保留搜索、筛选和滚动位置。
watch(() => queryText(currentRoute.value.query, 'card'), (card, previousCard) => {
  if (previousCard && !card) suspendedForDetails.value = false;
});
watch(() => run.value, () => {
  const current = selection.value;
  if (!current) return;
  const valid = current.kind === 'operator'
    ? run.value.operators.some(operator => operator.name === current.id)
    : run.value.equipment.some(item => item.id === current.id);
  if (!valid) clearSelection();
});
function clearSelection(): void {
  selection.value = null;
  inspectorOpen.value = false;
}
function selectEntity(next: AdvisorSelection): void {
  selection.value = next;
  inspectorOpen.value = true;
}
function openPicker(target: PickerTarget, holder = ''): void {
  // 从编辑面板为干员加装备时保留编辑上下文，完成后返回；其他入口关闭编辑面板。
  if (!holder) inspectorOpen.value = false;
  picker.value = { target, holder };
}
function closeOverlay(): void {
  picker.value = null;
  poolSettingsOpen.value = false;
  inspectorOpen.value = false;
  newRunConfirmationOpen.value = false;
}
/** 录完商店后，窄屏把建议栏滚到眼前；宽屏建议栏常驻，无需滚动。 */
async function revealAdvice(): Promise<void> {
  await nextTick();
  const panel = sidePanel.value;
  if (!panel) return;
  const bounds = panel.getBoundingClientRect();
  const offset = (document.getElementById('qbar')?.offsetHeight ?? 0) + 8;
  if (bounds.top >= offset && bounds.top < window.innerHeight * .5) return;
  window.scrollTo({ top: bounds.top + window.scrollY - offset, behavior: prefersReducedMotion() ? 'instant' : 'smooth' });
}
function finishPicker(): void {
  const fromShop = picker.value?.target === 'shop';
  if (canReturnToPanel.value) picker.value = null;
  else closeOverlay();
  if (fromShop && run.value.shop.length) void revealAdvice();
}
function removeCandidate(name: string): void {
  if (picker.value?.target === 'shop') advisor.removeShopCandidate(name);
  else if (picker.value?.target === 'excluded') advisor.toggleExcludedOperator(name);
}
function selectCandidate(name: string): void {
  const current = picker.value;
  if (!current) return;
  if (current.target === 'excluded') {
    advisor.toggleExcludedOperator(name);
  } else if (current.target === 'strategy') {
    advisor.setStrategy(name);
    picker.value = null;
  } else if (current.target === 'shop') {
    advisor.addShopCandidate(name);
  } else if (current.target === 'equipment') {
    if (advisor.addEquipment(name, current.holder) && current.holder) picker.value = null;
  } else {
    advisor.recruit(name, current.target === 'reserve' ? 'reserve' : 'auto');
  }
}
/** 暂停当前模态后打开站内详情；加载失败时恢复原面板，不丢弃录入上下文。 */
async function openDetails(kind: 'op' | 'eq' | 'st', name: string): Promise<void> {
  suspendedForDetails.value = !!picker.value || poolSettingsOpen.value || inspectorOpen.value;
  await nextTick();
  await openCard(kind, name);
  if (!queryText(currentRoute.value.query, 'card')) suspendedForDetails.value = false;
}
function requestNewRun(): void {
  if (hasRunData.value) newRunConfirmationOpen.value = true;
  else startNewRun();
}
function startNewRun(): void {
  clearSelection();
  closeOverlay();
  storageView.value = 'reserve';
  advisor.reset();
}
</script>

<template>
  <div class="run-advisor">
    <h2 class="sr-only">局内抓取</h2>
    <header class="ra-toolbar">
      <label class="ra-level">
        <span class="sr-only">当前本数</span>
        <select :value="run.level" @change="advisor.setLevel(Number(($event.target as HTMLSelectElement).value))">
          <option v-for="level in 6" :key="level" :value="level">{{ level }} 本</option>
        </select>
      </label>
      <div class="ra-strategy-control">
        <button type="button" class="btn ra-strategy-button control-disclosure" aria-haspopup="dialog"
          :aria-expanded="picker?.target === 'strategy'" :title="strategySkill || undefined" @click="openPicker('strategy')">
          <img v-if="run.strategy" :src="portraitSrc(run.strategy)" alt="" width="24" height="24">
          <span class="ra-strategy-label">{{ run.strategy || '选择策略' }}</span>
          <span class="control-chevron" aria-hidden="true"></span>
        </button>
        <button v-if="run.strategy" type="button" class="ra-icon-button ra-clear-strategy"
          aria-label="清除策略" @click="advisor.setStrategy('')">×</button>
      </div>
      <button type="button" class="btn ra-pool-button control-disclosure" aria-haspopup="dialog"
        :class="{ set: !!goal || !!unavailableNames.length }" :aria-expanded="poolSettingsOpen" @click="poolSettingsOpen = true">
        <span>{{ poolLabel }}</span><span class="control-chevron" aria-hidden="true"></span>
      </button>
      <div class="ra-toolbar-actions">
        <span class="ra-status" role="status" aria-live="polite" :class="{ 'ra-warning': saveFailed, fresh: !!notice }">{{ statusText }}</span>
        <button type="button" class="ra-text-button ra-undo" :disabled="!canUndo" @click="advisor.undo">
          <span aria-hidden="true">↶</span> 撤销
        </button>
        <button type="button" class="ra-text-button ra-new-run" aria-haspopup="dialog" @click="requestNewRun">新开一局</button>
      </div>
    </header>
    <p v-if="poolConflicts.length" class="ra-pool-conflict">{{ poolConflicts.join('、') }}与禁用设置冲突，请修正持有记录或<button type="button" class="ra-text-button" @click="poolSettingsOpen = true">调整禁用</button>。</p>

    <div class="ra-workspace">
      <section class="ra-panel ra-field-panel" aria-labelledby="ra-field-title">
        <div class="ra-section-heading">
          <h3 id="ra-field-title">上场 <small>{{ deployed.length }} / {{ MAX_OPS }}</small></h3>
          <span class="ra-muted">点头像编辑</span>
          <button type="button" class="ra-text-button" aria-haspopup="dialog" @click="openPicker('deployed')">＋ 记录干员</button>
        </div>
        <div class="ra-covenant-strip">
          <span v-for="covenant in visibleCovenants" :key="covenant.name" class="ra-covenant"
            :class="{ inactive: !covenant.active }" :data-cv="covenant.name"
            :style="{ '--c': covenantColor(covenant.name, 'var(--teal)') }">
            <i></i>{{ covenant.name }}
            <b>{{ covenant.count }}/{{ covenant.active ? covenant.bonusNeed || covenant.need : covenant.need }}</b>
          </span>
          <span v-if="!visibleCovenants.length" class="ra-muted">记录干员后显示盟约进度</span>
        </div>
        <div class="ra-field-grid">
          <AdvisorSlot v-for="(operator, index) in fieldSlots" :key="operator?.name || `empty-${index}`"
            :index="index" :name="operator?.name" :copies="operator?.copies" :elite="operator?.elite"
            :equipment="equipmentByHolder.get(operator?.name || '')"
            :selected="inspectorOpen && selection?.kind === 'operator' && selection.id === operator?.name"
            @select="operator ? selectEntity({ kind: 'operator', id: operator.name }) : openPicker('deployed')"/>
        </div>
      </section>

      <aside ref="sidePanel" class="ra-panel ra-side-panel" aria-labelledby="ra-side-title">
        <div class="ra-side-heading">
          <h3 id="ra-side-title">
            {{ run.shop.length ? '本轮商店' : '抓取建议' }}
            <small>{{ run.shop.length ? `${run.shop.length} 张 · 按推荐排序` : `${run.level} 本可找目标` }}</small>
          </h3>
          <button v-if="run.shop.length" type="button" class="ra-text-button ra-muted-action" @click="advisor.clearShop">清空</button>
          <button v-if="run.shop.length" type="button" class="btn ra-shop-button" aria-haspopup="dialog" @click="openPicker('shop')">改商店</button>
        </div>
        <p class="ra-direction-note">{{ directionNote }}</p>
        <div class="ra-side-body">
          <button v-if="!run.shop.length" type="button" class="ra-shop-cta" aria-haspopup="dialog" @click="openPicker('shop')">
            <b>＋</b><span><strong>录入本轮商店</strong><small>只比较这批牌，按收益排序</small></span>
          </button>
          <AdvisorRecommendations :advice="recommendations" :blocked="blockedShop" :removable="!!run.shop.length"
            :empty-message="adviceEmptyMessage" @recruit="advisor.recruit" @remove="advisor.removeShopCandidate"
            @details="name => openDetails('op', name)"/>
          <details class="ra-method">
            <summary>建议依据</summary>
            <p>优先推进主盟约目标，成型后比较核心输出、相关配合与精锐。3 人目标为混搭留位，6 人目标追人数强化。禁用牌不参与推荐；远见、奇迹、投资人计入整备区，其他盟约只计上场。满员抓取先入整备区，替换由你决定。</p>
          </details>
        </div>
      </aside>

      <section class="ra-panel ra-storage-panel" aria-label="整备区和装备">
        <div class="ra-storage-heading">
          <div class="ra-storage-tabs" role="group" aria-label="整备区和装备">
            <button type="button" :class="{ active: storageView === 'reserve' }"
              :aria-pressed="storageView === 'reserve'" @click="storageView = 'reserve'">
              整备区 <b>{{ reserve.length }}</b>
            </button>
            <button type="button" :class="{ active: storageView === 'equipment' }"
              :aria-pressed="storageView === 'equipment'" @click="storageView = 'equipment'">
              装备 <b>{{ run.equipment.length }}</b>
            </button>
          </div>
          <button type="button" class="ra-text-button" aria-haspopup="dialog" @click="openPicker(storageView)">
            ＋ {{ storageView === 'reserve' ? '记录备选' : '记录装备' }}
          </button>
        </div>
        <div v-if="storageView === 'reserve'" class="ra-storage-strip" aria-label="整备区">
          <AdvisorSlot v-for="operator in reserve" :key="operator.name" compact
            :name="operator.name" :copies="operator.copies" :elite="operator.elite"
            :selected="inspectorOpen && selection?.kind === 'operator' && selection.id === operator.name"
            @select="selectEntity({ kind: 'operator', id: operator.name })"/>
          <AdvisorSlot compact empty-label="记录备选" @select="openPicker('reserve')"/>
          <span v-if="!reserve.length" class="ra-storage-hint">对子和备选放这里<br>远见 / 奇迹 / 投资人也计人数</span>
        </div>
        <div v-else class="ra-storage-strip" aria-label="装备仓库">
          <button v-for="item in run.equipment" :key="item.id" type="button" class="ra-equipment-tile"
            :class="{ selected: inspectorOpen && selection?.kind === 'equipment' && selection.id === item.id }"
            :aria-label="`编辑装备${item.name}`" @click="selectEntity({ kind: 'equipment', id: item.id })">
            <img :src="equipIconSrc(item.name)" alt="" width="32" height="32">
            <b>{{ item.name }}</b><small>{{ item.advanced ? '进阶 · ' : '' }}{{ item.holder || '仓库' }}</small>
          </button>
          <AdvisorSlot compact empty-label="记录装备" @select="openPicker('equipment')"/>
        </div>
      </section>
    </div>

    <AdvisorOverlay v-if="picker || poolSettingsOpen || newRunConfirmationOpen || inspectorOpen && selection"
      :open="!suspendedForDetails" :can-go-back="canReturnToPanel"
      :title="newRunConfirmationOpen ? '新开一局' : picker ? pickerTitle : poolSettingsOpen ? '本局方向与禁用' : selectedTitle"
      :wide="!!picker || poolSettingsOpen" @close="closeOverlay" @back="picker = null">
      <div v-if="newRunConfirmationOpen" class="ra-reset-confirmation">
        <p>清空本局的阵容、装备、商店和禁用设置，重新从 1 本开始？新开后仍可撤销一次。</p>
        <div class="ra-reset-actions">
          <button type="button" class="btn" @click="closeOverlay">保留本局</button>
          <button type="button" class="btn p" @click="startNewRun">确认新开</button>
        </div>
      </div>
      <AdvisorPicker v-else-if="picker" :key="picker.target" :kind="pickerKind"
        :selected="selectedPickerNames" :disabled-names="disabledPickerNames" :excluded-names="excludedPickerNames" :level="run.level"
        :can-deselect="picker.target === 'shop' || picker.target === 'excluded'"
        :max-selected="picker.target === 'shop' ? MAX_SHOP_CANDIDATES : undefined"
        :owned-operators="run.operators" :recording="recordingOperators" :summary="pickerSummary" :can-undo="canUndo"
        :done-label="picker.target === 'shop' ? '查看建议' : '完成'"
        :action="picker.target === 'excluded' ? '排除' : picker.target === 'strategy' ? '选择' : '添加'" :notice="notice"
        @select="selectCandidate" @remove="removeCandidate" @details="openDetails" @done="finishPicker" @undo="advisor.undo"/>
      <AdvisorPoolSettings v-else-if="poolSettingsOpen" @exclude-operator="openPicker('excluded')"/>
      <AdvisorInspector v-else-if="selection" :selection="selection"
        @add-equipment="holder => openPicker('equipment', holder)" @details="openDetails" @removed="clearSelection"/>
    </AdvisorOverlay>
  </div>
</template>
