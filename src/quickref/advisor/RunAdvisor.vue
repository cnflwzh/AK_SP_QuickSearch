<script setup lang="ts">
import { computed, nextTick, onActivated, onBeforeUnmount, onDeactivated, ref, watch } from 'vue';
import { STRATEGY, covenantColor } from '../../../data/index.ts';
import { avatarSrc, equipIconSrc, portraitSrc } from '../../lib/assets.ts';
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
import AdvisorDeployments from './AdvisorDeployments.vue';
import AdvisorPoolSettings from './AdvisorPoolSettings.vue';
import type { AdvisorSelection } from './types.ts';
import './advisor.css';

const advisor = useRunAdvisor();
const { run, deployed, reserve, covenants, recommendations, deploymentRecommendations, notice, saveFailed, canUndo, goal, unavailableNames, poolConflicts } = advisor;
const root = ref<HTMLElement>();
const compact = ref(false);
const mobileView = ref<'lineup' | 'shop'>('lineup');
const storageView = ref<'reserve' | 'equipment'>('reserve');
const panelView = ref<'advice' | 'edit'>('advice');
const selection = ref<AdvisorSelection | null>(null);
const inspectorOpen = ref(false);
const poolSettingsOpen = ref(false);
const newRunConfirmationOpen = ref(false);
const suspendedForDetails = ref(false);
type PickerTarget = 'strategy' | 'deployed' | 'reserve' | 'equipment' | 'shop' | 'excluded';
const picker = ref<{ target: PickerTarget; holder: string } | null>(null);
const canReturnToPanel = computed(() => !!picker.value && (poolSettingsOpen.value || compact.value && inspectorOpen.value && !!selection.value));
const recordingOperators = computed(() => picker.value?.target === 'deployed' || picker.value?.target === 'reserve');
const pickerSummary = computed(() => recordingOperators.value
  ? `上场 ${deployed.value.length}/${MAX_OPS} · 整备 ${reserve.value.length}`
  : picker.value?.target === 'equipment' ? `已记录 ${run.value.equipment.length} 件`
  : picker.value?.target === 'excluded' ? `已排除 ${run.value.excludedOperators.length} 名` : '');
const hasRunData = computed(() => run.value.round !== null || run.value.funds !== null || Object.keys(run.value.layers).length > 0 || run.value.level !== 1 || !!run.value.strategy || !!run.value.mainCovenant
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
const selectedTitle = computed(() => selection.value?.kind === 'operator' ? selection.value.id
  : run.value.equipment.find(item => item.id === selection.value?.id)?.name || '编辑记录');
const pickerKind = computed(() => picker.value?.target === 'strategy' ? 'st' : picker.value?.target === 'equipment' ? 'eq' : 'op');
const pickerTitle = computed(() => picker.value?.target === 'strategy' ? '选择开局策略'
  : picker.value?.target === 'excluded' ? '排除禁用 / 未入池干员'
  : picker.value?.target === 'equipment' ? (picker.value.holder ? `为${picker.value.holder}添加装备` : '记录已获得的装备')
  : picker.value?.target === 'shop' ? `录入商店 · 最多${MAX_SHOP_CANDIDATES}名`
  : picker.value?.target === 'reserve' ? '记录整备区干员' : '记录上场干员');
const selectedPickerNames = computed(() => picker.value?.target === 'excluded' ? run.value.excludedOperators
  : picker.value?.target === 'shop' ? run.value.shop : picker.value?.target === 'strategy' && run.value.strategy ? [run.value.strategy] : []);
const disabledPickerNames = computed(() => picker.value?.target === 'deployed' || picker.value?.target === 'reserve' ? eliteNames.value : []);
const excludedPickerNames = computed(() => pickerKind.value === 'op' && picker.value?.target !== 'excluded' ? unavailableNames.value : []);
const poolLabel = computed(() => `${goal.value ? `${goal.value.covenant} · ${goal.value.target} 人` : run.value.mainCovenant === 'mixed' ? '混搭' : '方向 / 禁用'}${unavailableNames.value.length ? ` · 禁 ${unavailableNames.value.length}` : ''}`);
const shopAdvice = computed(() => new Map(recommendations.value.map((advice, index) => [advice.operator.name, { ...advice, rank: index + 1 }])));
const adviceEmptyMessage = computed(() => poolConflicts.value.length ? '先修正持有记录与禁用设置的冲突。'
  : run.value.shop.length && run.value.shop.every(name => unavailableNames.value.includes(name)) ? '本轮候选都被排除，请核对商店或禁用设置。'
  : '当前没有待追目标，可更新本数或录入商店。');

let resizeObserver: ResizeObserver | undefined;
// 使用面板实际宽度，折叠屏与 Wiki 分屏也能进入紧凑模式。
onActivated(async () => {
  await nextTick();
  if (!root.value) return;
  compact.value = root.value.clientWidth <= 800;
  resizeObserver ??= new ResizeObserver(entries => {
    compact.value = entries[0].contentRect.width <= 800;
  });
  resizeObserver.observe(root.value);
});
function releaseTransientUi(): void {
  resizeObserver?.disconnect();
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
  panelView.value = 'advice';
}
function selectEntity(next: AdvisorSelection): void {
  selection.value = next;
  panelView.value = 'edit';
  inspectorOpen.value = true;
}
function openPicker(target: PickerTarget, holder = ''): void {
  if (!holder && compact.value) inspectorOpen.value = false;
  picker.value = { target, holder };
}
function closeOverlay(): void {
  picker.value = null;
  poolSettingsOpen.value = false;
  inspectorOpen.value = false;
  newRunConfirmationOpen.value = false;
}
function finishPicker(): void {
  if (picker.value?.target === 'shop') {
    mobileView.value = 'shop';
    panelView.value = 'advice';
  }
  if (canReturnToPanel.value) picker.value = null;
  else closeOverlay();
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
  suspendedForDetails.value = !!picker.value || poolSettingsOpen.value || compact.value && inspectorOpen.value;
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
  mobileView.value = 'lineup';
  storageView.value = 'reserve';
  advisor.reset();
}
function clearStrategy(): void {
  advisor.setStrategy('');
}
</script>

<template>
  <div ref="root" class="run-advisor">
    <header class="ra-toolbar">
      <h2>局内抓取</h2>
      <label class="ra-level">
        <span class="sr-only">当前本数</span>
        <select :value="run.level" @change="advisor.setLevel(Number(($event.target as HTMLSelectElement).value))">
          <option v-for="level in 6" :key="level" :value="level">{{ level }} 本</option>
        </select>
      </label>
      <div class="ra-strategy-control">
        <button type="button" class="btn ra-strategy-button control-disclosure" aria-haspopup="dialog"
          :aria-expanded="picker?.target === 'strategy'" @click="openPicker('strategy')">
          <img v-if="run.strategy" :src="portraitSrc(run.strategy)" alt="" width="28" height="28">
          <span class="ra-strategy-label">{{ run.strategy || '选择策略' }}</span>
          <span class="control-chevron" aria-hidden="true"></span>
        </button>
        <button v-if="run.strategy" type="button" class="ra-icon-button ra-clear-strategy"
          aria-label="清除策略" @click="clearStrategy">×</button>
      </div>
      <button type="button" class="btn ra-pool-button control-disclosure" aria-haspopup="dialog"
        :aria-expanded="poolSettingsOpen" @click="poolSettingsOpen = true">
        <span>{{ poolLabel }}</span><span class="control-chevron" aria-hidden="true"></span>
      </button>
      <div class="ra-toolbar-actions">
        <button type="button" class="ra-text-button" :disabled="!canUndo" @click="advisor.undo">撤销</button>
        <button type="button" class="btn" aria-haspopup="dialog" @click="requestNewRun">新开一局</button>
      </div>
    </header>
    <div class="ra-status">
      <span role="status" aria-live="polite" :class="{ 'ra-warning': saveFailed }">
        {{ saveFailed ? '本地保存失败，请勿关闭页面' : notice || '本局自动保存在此设备 · 点头像编辑' }}
      </span>
      <span v-if="run.strategy" :title="STRATEGY[run.strategy]?.effect">{{ STRATEGY[run.strategy]?.skill }}</span>
    </div>
    <p v-if="poolConflicts.length" class="ra-pool-conflict">{{ poolConflicts.join('、') }}与禁用设置冲突，请修正持有记录或<button type="button" class="ra-text-button" @click="poolSettingsOpen = true">调整禁用</button>。</p>
    <nav class="ra-mobile-switch" aria-label="局内面板">
      <button type="button" :class="{ active: mobileView === 'lineup' }"
        :aria-pressed="mobileView === 'lineup'" @click="mobileView = 'lineup'">
        阵容与装备 <b>{{ deployed.length }}/8</b>
      </button>
      <button type="button" :class="{ active: mobileView === 'shop' }"
        :aria-pressed="mobileView === 'shop'" @click="mobileView = 'shop'">
        商店与建议 <b>{{ recommendations.length }}</b>
      </button>
    </nav>

    <div class="ra-workspace" :data-mobile-view="mobileView">
      <section class="ra-panel ra-field-panel" aria-label="本局阵容">
        <div class="ra-section-heading">
          <h3>上场 <small>{{ deployed.length }} / 8</small></h3>
          <span class="ra-muted">点头像调整</span>
          <button type="button" class="ra-text-button" @click="openPicker('deployed')">＋ 记录干员</button>
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
            :selected="selection?.kind === 'operator' && selection.id === operator?.name"
            @select="operator ? selectEntity({ kind: 'operator', id: operator.name }) : openPicker('deployed')"/>
        </div>
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
          <button type="button" class="ra-text-button" @click="openPicker(storageView)">
            ＋ {{ storageView === 'reserve' ? '备选' : '装备' }}
          </button>
        </div>
        <div v-if="storageView === 'reserve'" class="ra-storage-strip" aria-label="整备区">
          <AdvisorSlot v-for="operator in reserve" :key="operator.name" compact
            :name="operator.name" :copies="operator.copies" :elite="operator.elite"
            :selected="selection?.kind === 'operator' && selection.id === operator.name"
            @select="selectEntity({ kind: 'operator', id: operator.name })"/>
          <AdvisorSlot compact empty-label="记录备选" @select="openPicker('reserve')"/>
          <span v-if="!reserve.length" class="ra-storage-hint">对子和备选放这里<br>远见 / 奇迹 / 投资人也计人数</span>
        </div>
        <div v-else class="ra-storage-strip" aria-label="装备仓库">
          <button v-for="item in run.equipment" :key="item.id" type="button" class="ra-equipment-tile"
            :class="{ selected: selection?.kind === 'equipment' && selection.id === item.id }"
            :aria-label="`编辑装备${item.name}`" :data-eq="item.name"
            @click="selectEntity({ kind: 'equipment', id: item.id })">
            <img :src="equipIconSrc(item.name)" alt="" width="32" height="32">
            <b>{{ item.name }}</b><small>{{ item.advanced ? '进阶 · ' : '' }}{{ item.holder || '仓库' }}</small>
          </button>
          <AdvisorSlot compact empty-label="记录装备" @select="openPicker('equipment')"/>
        </div>
      </section>

      <aside class="ra-panel ra-side-panel" aria-label="建议和编辑">
        <div class="ra-side-tabs" role="group" aria-label="侧边面板">
          <button type="button" :class="{ active: panelView === 'advice' || compact }"
            :aria-pressed="panelView === 'advice' || compact" @click="panelView = 'advice'">
            抓取建议 <small>{{ recommendations.length }}</small>
          </button>
          <button v-if="!compact" type="button" :disabled="!selection"
            :class="{ active: panelView === 'edit' }" :aria-pressed="panelView === 'edit'" @click="panelView = 'edit'">
            {{ selection ? selectedTitle : '选中后编辑' }}
          </button>
        </div>
        <div class="ra-side-body">
          <AdvisorInspector v-if="panelView === 'edit' && selection && !compact" :selection="selection"
            @add-equipment="holder => openPicker('equipment', holder)" @details="openDetails" @removed="clearSelection"/>
          <template v-else>
            <div class="ra-advice-heading">
              <span>{{ run.shop.length ? '只比较本轮商店' : `${run.level} 本可找目标` }}</span>
              <span>展开看理由 · ＋ 已抓到</span>
            </div>
            <p class="ra-direction-note">{{ goal ? `主攻${goal.covenant} · 目标${goal.target}人${run.mainCovenant ? '' : '（自动）'}` : run.mainCovenant === 'mixed' ? '混搭 · 比较整队收益' : '主轴未定 · 随来牌判断，可手选方向' }}</p>
            <AdvisorDeployments :advice="deploymentRecommendations" @deploy="(name, replace) => advisor.setDeployment(name, true, replace)"/>
            <AdvisorRecommendations :advice="recommendations" :empty-message="adviceEmptyMessage" @recruit="advisor.recruit"/>
            <details class="ra-method">
              <summary>建议依据</summary>
              <p>比较盟约成型、已建模特质、精锐与装备搭配，可在「方向 / 禁用」中补充回合、资金和层数。资金与回合为手动快照，记录抓取不会自动扣款或推算回合。禁用牌不参与推荐；远见、奇迹、投资人计入整备区，其他盟约只计上场。推荐分是启发式优先级，不是胜率或伤害预测；未录入的站位、敌人、技能时机等条件不作保证，满员替换仍由你决定。</p>
            </details>
          </template>
        </div>
      </aside>

      <section class="ra-panel ra-shop-panel" aria-label="本轮商店">
        <div class="ra-section-heading">
          <h3>商店 <small>{{ run.shop.length ? `${run.shop.length} 张` : '选填' }}</small></h3>
          <span class="ra-muted">录入后只比较这批牌</span>
          <button v-if="run.shop.length" type="button" class="ra-text-button" @click="advisor.clearShop">清空</button>
          <button type="button" class="ra-text-button" @click="openPicker('shop')">＋ 录入商店</button>
        </div>
        <div class="ra-shop-strip">
          <div v-for="name in run.shop" :key="name" class="ra-shop-card">
            <button type="button" class="ra-shop-identity" :data-op="name" @click="openDetails('op', name)">
              <img :src="avatarSrc(name)" alt="" width="36" height="36">
              <span><b>{{ name }}</b><small>{{ unavailableNames.includes(name) ? '本局禁用' : shopAdvice.get(name)?.label || '商店候选' }}</small></span>
            </button>
            <button type="button" class="ra-grab" :aria-label="`抓取商店${name}`"
              :disabled="eliteNames.includes(name) || unavailableNames.includes(name)" @click="advisor.recruit(name)">＋</button>
            <button type="button" class="ra-shop-remove" :aria-label="`移除商店候选${name}`"
              @click="advisor.removeShopCandidate(name)">×</button>
          </div>
          <button v-for="index in Math.max(1, 5 - run.shop.length)" :key="`shop-empty-${index}`"
            type="button" class="ra-shop-empty" :aria-label="`添加商店候选${index}`" @click="openPicker('shop')">
            <b>＋</b><span>商店候选</span>
          </button>
        </div>
      </section>
    </div>

    <AdvisorOverlay v-if="picker || poolSettingsOpen || newRunConfirmationOpen || compact && inspectorOpen && selection"
      :open="!suspendedForDetails" :can-go-back="canReturnToPanel"
      :title="newRunConfirmationOpen ? '新开一局' : picker ? pickerTitle : poolSettingsOpen ? '本局方向与禁用' : selectedTitle"
      :wide="!!picker || poolSettingsOpen" @close="closeOverlay" @back="picker = null">
      <div v-if="newRunConfirmationOpen" class="ra-reset-confirmation">
        <p>清空本局的阵容、装备、商店和禁用设置，重新从 1 本开始？</p>
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
