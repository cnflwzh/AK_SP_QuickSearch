<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { OPERATOR, EQUIP, EQUIPMENT_COMBOS, STRATEGY, OPERATORS, TIER_LABELS, TIER_STATS, COVENANTS, buildsUsing, isCoreCovenant, rosterOf } from '../../../data/index.ts';
import { avatarSrc, equipIconSrc, portraitSrc } from '../../lib/assets.ts';
import { color, fx, peekFx, hpWidth, bonusHeadcount, bonusText } from '../format.ts';
import { useQuickrefActions, type DetailSelection } from '../state.ts';
import Chip from './Chip.vue';
const props = defineProps<{ selection: DetailSelection | null }>();
const actions = useQuickrefActions();
const dialog = ref<HTMLDialogElement | null>(null);
const main = ref<HTMLDivElement | null>(null);
let returnFocus: HTMLElement | null = null;
const operator = computed(() => props.selection?.kind === 'op' ? OPERATOR[props.selection.name] : undefined);
const equipment = computed(() => props.selection?.kind === 'eq' ? EQUIP[props.selection.name] : undefined);
const equipmentRecipes = computed(() => equipment.value ? EQUIPMENT_COMBOS.filter(recipe => recipe.includes(equipment.value!.name)) : []);
const strategy = computed(() => props.selection?.kind === 'st' ? STRATEGY[props.selection.name] : undefined);
const stats = computed(() => operator.value ? TIER_STATS[operator.value.tier - 1] : undefined);
const mates = computed(() => { const current = operator.value; return current ? OPERATORS.filter(other => other.name !== current.name && other.tier === current.tier && other.covenants.some(c => current.covenants.includes(c))) : []; });
const builds = computed(() => props.selection ? buildsUsing(props.selection.kind === 'op' ? 'lineup' : props.selection.kind === 'eq' ? 'equipment' : 'strategies', props.selection.name) : []);
watch(() => props.selection, async selection => {
  await nextTick();
  if (!dialog.value) return;
  if (selection) {
    if (!dialog.value.open) {
      returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.value.showModal();
    }
    if (main.value) main.value.scrollTop = 0;
  } else if (dialog.value.open) {
    dialog.value.close();
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    returnFocus = null;
  }
}, { flush: 'post', immediate: true });
onBeforeUnmount(() => dialog.value?.close());
</script>
<template>
  <dialog id="sheet" ref="dialog" aria-labelledby="detail-title" :class="['sheet', { 'with-side': !!operator }]" :data-viewing="operator?.name ?? ''" @click.self="actions.closeDetail()" @cancel.prevent="actions.closeDetail()">
    <div v-if="selection" ref="main" class="sh-main">
      <div v-if="operator" class="sh-h" :data-t="operator.tier"><img v-if="avatarSrc(operator.name)" class="pic" :src="avatarSrc(operator.name)" alt="" width="80" height="80"><div><div class="row"><i class="tn">{{ TIER_LABELS[operator.tier] }} 阶</i><span class="stars">{{ '★'.repeat(operator.stars) }}</span><span class="tag">{{ operator.type }}</span></div><h3 id="detail-title">{{ operator.name }}</h3><div class="row"><Chip v-for="name in operator.covenants" :key="name" kind="cv" :name="name"/></div></div><button type="button" class="sh-x" data-close aria-label="关闭" @click="actions.closeDetail()">✕</button></div>
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
    <aside v-if="operator" class="sh-side" aria-label="盟约效果"><div class="sd-k">盟约效果</div><section v-for="(name, index) in operator.covenants" :key="name" class="sd-c" :data-key="name" :style="{ '--c': color(name), '--i': index }"><button type="button" class="sd-h" :data-cv="name" data-peek="off" :title="`查看${name}盟约页`" @click="actions.openCovenant(name)"><b>{{ name }}</b><span>{{ isCoreCovenant(name) ? '核心' : '附加' }} · {{ rosterOf(name).length }} 名</span><em>▸</em></button><div class="pk-row"><span>{{ COVENANTS[name].need }} 人</span><div v-html="peekFx(COVENANTS[name].effect)"></div></div><div v-if="COVENANTS[name].bonus" class="pk-row a"><span>{{ bonusHeadcount(COVENANTS[name].bonus) ? bonusHeadcount(COVENANTS[name].bonus) + ' 名' : '强化' }}</span><div v-html="peekFx(bonusText(COVENANTS[name].bonus))"></div></div></section></aside>
  </dialog>
</template>
