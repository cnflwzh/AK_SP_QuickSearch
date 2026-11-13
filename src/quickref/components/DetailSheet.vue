<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { OPERATOR, EQUIP, EQUIPMENT_COMBOS, STRATEGY, OPERATORS, TIER_LABELS, TIER_STATS, COVENANTS, buildsUsing, isCoreCovenant, rosterOf } from '../../../data/index.ts';
import { avatarSrc, equipIconSrc, portraitSrc } from '../../lib/assets.ts';
import { color, fx, peekFx, hpWidth, bonusHeadcount, bonusText } from '../format.ts';
import { useQuickrefActions, type DetailSelection } from '../state.ts';
import Chip from './Chip.vue';
import PrtsLink from './PrtsLink.vue';
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
const operator = computed(() => props.selection?.kind === 'op' ? OPERATOR[props.selection.name] : undefined);
// 分屏优先完整展示干员自身信息，盟约效果仅在普通详情中展开。
const showCovenantEffects = computed(() => !!operator.value && !props.splitView);
const equipment = computed(() => props.selection?.kind === 'eq' ? EQUIP[props.selection.name] : undefined);
const equipmentRecipes = computed(() => equipment.value ? EQUIPMENT_COMBOS.filter(recipe => recipe.includes(equipment.value!.name)) : []);
const strategy = computed(() => props.selection?.kind === 'st' ? STRATEGY[props.selection.name] : undefined);
const stats = computed(() => operator.value ? TIER_STATS[operator.value.tier - 1] : undefined);
const mates = computed(() => { const current = operator.value; return current ? OPERATORS.filter(other => other.name !== current.name && other.tier === current.tier && other.covenants.some(c => current.covenants.includes(c))) : []; });
const builds = computed(() => props.selection ? buildsUsing(props.selection.kind === 'op' ? 'lineup' : props.selection.kind === 'eq' ? 'equipment' : 'strategies', props.selection.name) : []);
watch([() => props.selection, () => props.splitView], async ([selection, splitView], [previousSelection]) => {
  await nextTick();
  // 路由或分屏状态在同一轮更新中变化时，只处理最新的展示状态。
  if (!dialog.value || selection !== props.selection || splitView !== props.splitView) return;
  if (selection) {
    if (!dialog.value.open) {
      returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    const focusedChild = dialog.value.contains(document.activeElement) && document.activeElement instanceof HTMLElement
      ? document.activeElement : null;
    // 原生模态会禁用整个文档；切换模式前先关闭，避免 show/showModal 抛出异常。
    const shouldBeModal = !splitView;
    if (dialog.value.open && dialog.value.matches(':modal') !== shouldBeModal) dialog.value.close();
    if (!dialog.value.open) {
      if (shouldBeModal) dialog.value.showModal();
      else dialog.value.show();
      focusedChild?.focus({ preventScroll: true });
    }
    if (selection !== previousSelection) {
      if (main.value) main.value.scrollTop = 0;
      if (covenantEffects.value) covenantEffects.value.scrollTop = 0;
      dialog.value.scrollTop = 0;
    }
  } else if (dialog.value.open) {
    dialog.value.close();
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    returnFocus = null;
  }
}, { flush: 'post', immediate: true });
onBeforeUnmount(() => dialog.value?.close());
</script>
<template>
  <div :class="['detail-layer', { split: splitView && !!selection }]" @click.self="actions.closeDetail()">
  <dialog id="sheet" ref="dialog" aria-labelledby="detail-title" :class="['sheet', { 'operator-sheet': !!operator, 'with-side': showCovenantEffects }]" :data-viewing="operator?.name ?? ''" @click.self="actions.closeDetail()" @cancel.prevent="actions.closeDetail()" @keydown.esc.stop.prevent="actions.closeDetail()">
    <div v-if="selection" ref="main" class="sh-main">
      <div v-if="operator" class="sh-h" :data-t="operator.tier"><img v-if="avatarSrc(operator.name)" class="pic" :src="avatarSrc(operator.name)" alt="" width="80" height="80"><div><div class="row"><i class="tn">{{ TIER_LABELS[operator.tier] }} 阶</i><span class="stars">{{ '★'.repeat(operator.stars) }}</span><span class="tag">{{ operator.type }}</span></div><div class="operator-detail-title"><h3 id="detail-title">{{ operator.name }}</h3><PrtsLink :name="operator.name"/></div><div class="row"><Chip v-for="name in operator.covenants" :key="name" kind="cv" :name="name"/></div></div><button type="button" class="sh-x" data-close aria-label="关闭" @click="actions.closeDetail()">✕</button></div>
      <div v-else-if="equipment" class="sh-h" :data-t="equipment.tier"><img v-if="equipIconSrc(equipment.name)" class="pic e" :src="equipIconSrc(equipment.name)" alt="" width="80" height="80"><div><div class="row"><i class="tn">{{ TIER_LABELS[equipment.tier] }} 阶</i><span class="tag a">{{ equipment.price }} 资金</span></div><h3 id="detail-title">{{ equipment.name }}</h3><div class="row"><Chip v-if="equipment.covenant" kind="cv" :name="equipment.covenant"/></div></div><button type="button" class="sh-x" data-close aria-label="关闭" @click="actions.closeDetail()">✕</button></div>
      <div v-else-if="strategy" class="sh-h"><img v-if="portraitSrc(strategy.name)" class="pic s" :src="portraitSrc(strategy.name)" alt="" width="88" height="88"><div><div class="row"><Chip v-if="isCoreCovenant(strategy.category)" kind="cv" :name="strategy.category"/><span v-else class="tag">{{ strategy.category }}</span><span :class="['tag', { t: strategy.unlock === '初始' }]">{{ strategy.unlock }}</span></div><h3 id="detail-title">{{ strategy.name }}</h3><div class="hpbig"><b>{{ strategy.hp }}</b><div class="trk"><div :style="{ width: hpWidth(strategy.hp) + '%' }"></div></div></div></div><button type="button" class="sh-x" data-close aria-label="关闭" @click="actions.closeDetail()">✕</button></div>
      <div class="sh-b">
        <div v-if="operator && stats" class="cmp2"><div v-html="`<div class='lb'><span class='tag'>初始</span><small>${stats.base}</small></div>${fx(operator.trait)}`"></div><div class="el" v-html="`<div class='lb'><span class='tag a'>精锐</span><small>${stats.elite}</small></div>${fx(operator.elite)}`"></div></div>
        <div v-else-if="equipment" class="cmp2"><div v-html="`<div class='lb'><span class='tag'>基础</span></div>${fx(equipment.effect)}`"></div><div class="el" v-html="`<div class='lb'><span class='tag a'>进阶</span></div>${fx(equipment.advanced || equipment.effect)}`"></div></div>
        <div v-else-if="strategy" class="ef" style="--c:var(--teal)"><span class="tag t">{{ strategy.skill }}</span><div v-html="fx(strategy.effect)"></div></div>
        <div v-if="equipmentRecipes.length">
          <h5 class="cnt" style="margin:0 0 6px">组合配方</h5>
          <div v-for="recipe in equipmentRecipes" :key="recipe[2]" class="row eq-formula">
            <Chip kind="eq" :name="recipe[0]"/><span aria-hidden="true">＋</span><Chip kind="eq" :name="recipe[1]"/><span aria-hidden="true">→</span><Chip kind="eq" :name="recipe[2]"/>
          </div>
        </div>
        <div v-if="builds.length"><h5 class="cnt" style="margin:0 0 6px">流派</h5><div class="row"><Chip v-for="name in builds" :key="name" kind="build" :name="name"/></div></div>
        <div v-if="mates.length"><h5 class="cnt" style="margin:0 0 6px">同盟约 · 同阶</h5><div class="row"><Chip v-for="mate in mates" :key="mate.name" kind="op" :name="mate.name"/></div></div>
      </div>
    </div>
    <aside v-if="operator && showCovenantEffects" ref="covenantEffects" class="sh-side" aria-label="盟约效果" tabindex="0"><div class="sd-k">盟约效果</div><section v-for="(name, index) in operator.covenants" :key="name" class="sd-c" :data-key="name" :style="{ '--c': color(name), '--i': index }"><button type="button" class="sd-h" :data-cv="name" data-peek="off" :title="`查看${name}盟约页`" @click="actions.openCovenant(name)"><b>{{ name }}</b><span>{{ isCoreCovenant(name) ? '核心' : '附加' }} · {{ rosterOf(name).length }} 名</span><em>▸</em></button><div class="pk-row"><span>{{ COVENANTS[name].need }} 人</span><div v-html="peekFx(COVENANTS[name].effect)"></div></div><div v-if="COVENANTS[name].bonus" class="pk-row a"><span>{{ bonusHeadcount(COVENANTS[name].bonus) ? bonusHeadcount(COVENANTS[name].bonus) + ' 名' : '强化' }}</span><div v-html="peekFx(bonusText(COVENANTS[name].bonus))"></div></div></section></aside>
  </dialog>
  </div>
</template>

<style scoped>
.operator-detail-title { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.detail-layer { display: contents; }
.detail-layer.split {
  position: fixed;
  inset: 0 var(--wiki-panel-width) 0 0;
  z-index: 90;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  container: detail-area / inline-size;
  background: rgba(5, 12, 14, .55);
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
.split dialog.sheet.operator-sheet { width: min(940px, calc(100% - 24px)); }
/* 取消原先给盟约效果预留的高度；干员信息可使用整张卡片，内容较短时自然收起。 */
.split .sh-main { flex: 0 1 auto; max-height: var(--detail-max-height); overflow: auto; }

.sh-side:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }

/* 按左侧实际宽度调整详情布局，避免沿用整个浏览器宽度挤压两栏。 */
@container detail-area (max-width: 560px) {
  .split dialog.sheet, .split dialog.sheet.operator-sheet { width: calc(100% - 16px); }
  .split .cmp2 { grid-template-columns: minmax(0, 1fr); }
  .split .sh-h { grid-template-columns: auto minmax(0, 1fr) auto; gap: 10px; padding: 12px; }
  .split .sh-h .pic { width: 64px; height: 64px; }
  .split .sh-b { padding: 12px; }
}
@container detail-area (max-width: 400px) {
  .split .sh-h { gap: 8px; padding: 10px; }
  .split .sh-h .pic { width: 48px; height: 48px; }
  .split .sh-h h3 { font-size: 20px; }
  .split .sh-x { width: 32px; height: 32px; }
}
</style>
