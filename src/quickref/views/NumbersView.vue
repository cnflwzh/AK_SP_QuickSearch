<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { MODES, DECISION_ROUNDS, ROUND_TIME, LEADERS, DISPATCH_LEVELS, DISPATCH_BY_MODE, BOUNTIES, TIER_STATS, TIER_LABELS, TRAINING, OWN_OPERATOR_BONUS, COVENANTS, CORE_COVENANTS, ADDON_COVENANTS } from '../../../data/index.ts';
import { wan, round1 } from '../../lib/dom.ts';
import { state } from '../state.ts';
import { color } from '../format.ts';
import Segmented from '../components/Segmented.vue';
const presets = [0, 30, 60, 100, 150, 200, 300];
const layers = computed(() => state.layers[state.calculatorCovenant] ?? 60);
const inputText = ref(String(layers.value));
watch(layers, value => { inputText.value = String(value); });
const options = [ { label: '核心', names: CORE_COVENANTS.filter(n => COVENANTS[n].scaling.length) }, { label: '附加', names: ADDON_COVENANTS.filter(n => COVENANTS[n].scaling.length) } ];
/** Keeps number/range/presets synchronized without replacing other numeric panels. */
function draw(value: number): void {
  if (!Number.isFinite(value)) return;
  state.layers[state.calculatorCovenant] = Math.max(0, Math.min(300, Math.round(value)));
  inputText.value = String(layers.value);
}
function changeCovenant(event: Event): void {
  state.calculatorCovenant = (event.target as HTMLSelectElement).value;
  draw(state.layers[state.calculatorCovenant] ?? 60);
}
function inputLayers(event: Event): void {
  const input = event.target as HTMLInputElement;
  inputText.value = input.value;
  draw(input.valueAsNumber);
  // The normalized value may equal the previous state, so also normalize the active control.
  if (Number.isFinite(input.valueAsNumber)) input.value = inputText.value;
}
function commitLayers(event: Event): void {
  const input = event.target as HTMLInputElement;
  draw(Number.isFinite(input.valueAsNumber) ? input.valueAsNumber : layers.value);
  input.value = inputText.value;
}
const modeName = computed(() => MODES[state.mode]);
const decisions = computed(() => DECISION_ROUNDS[modeName.value as keyof typeof DECISION_ROUNDS]);
const maxSeconds = Math.max(...ROUND_TIME);
const levels = computed(() => state.mode === 0 ? DISPATCH_BY_MODE[1] : DISPATCH_LEVELS);
const leaders = computed(() => {
  const items = [...LEADERS].sort((a, b) => b.hp[state.mode] - a.hp[state.mode]).map(leader => ({ name: leader.name, hp: leader.hp[state.mode], hidden: state.mode > 0 && leader.hiddenCore ? leader.hiddenCore[state.mode - 1] : 0 }));
  const max = Math.max(...items.map(item => Math.max(item.hp, item.hidden)));
  return items.map(item => ({ ...item, width: item.hp / max * 100 }));
});
const bountyColumns = Array.from({ length: 6 }, (_, funds) => ({ funds, items: BOUNTIES.filter(b => b.funds === funds && b.when === '下场') }));
const otherBounties = BOUNTIES.filter(b => b.when !== '下场');
</script>
<template>
  <section id="nuCalc" class="qcalc ncalc" :style="{ '--c': color(state.calculatorCovenant) }" aria-label="盟约层数计算器">
    <div class="top"><h4>层数计算器</h4><select id="nuCovenant" :value="state.calculatorCovenant" aria-label="计算盟约" @change="changeCovenant"><optgroup v-for="group in options" :key="group.label" :label="group.label"><option v-for="name in group.names" :key="name" :value="name">{{ name }}</option></optgroup></select><label class="layer-value"><input id="nuLayers" class="lv" type="number" min="0" max="300" step="1" :value="inputText" aria-label="盟约层数" @input="inputLayers" @change="commitLayers">层</label><input id="nuRange" type="range" min="0" max="300" step="1" :value="layers" aria-label="拖动调整层数" @input="draw(($event.target as HTMLInputElement).valueAsNumber)"></div>
    <div class="q"><button v-for="value in presets" :key="value" type="button" :data-layers="value" :class="{ on: value === layers }" :aria-pressed="value === layers" @click="draw(value)">{{ value }}</button></div><div id="nuValues" class="vals"><div v-for="scaling in COVENANTS[state.calculatorCovenant].scaling" :key="scaling.label"><span>{{ scaling.label }}</span><b>{{ round1(scaling.at(layers)) }}<small>{{ scaling.unit }}</small></b></div></div>
  </section>
  <div class="ng">
    <div class="nc"><h4>回合时限（秒）<Segmented :labels="MODES" :active="state.mode" attr="nud" @change="state.mode = $event"/></h4><div class="rtl"><div v-for="(seconds, index) in ROUND_TIME" :key="index" :class="index === 13 ? 'ld' : decisions.includes(index + 1) ? 'dec' : ''"><div class="rt-bar" :style="{ height: seconds / maxSeconds * 100 + '%' }"><span class="s">{{ seconds }}</span><i class="b" :style="{ animationDelay: (index + 1) * .03 + 's' }"></i></div><span class="r">{{ index === 13 ? '领袖' : 'R' + (index + 1) }}</span></div><div v-if="state.mode !== 0" class="hid"><div class="rt-bar" style="height:100%"><span class="s">??</span><i class="b"></i></div><span class="r">核心</span></div></div><div class="lgd"><span><i style="background:var(--accent)"></i>机变</span><span><i style="background:var(--red)"></i>领袖</span></div></div>
    <div class="nc"><h4>调度中心 · {{ modeName }}<span class="tag t">升级费用每回合 −1</span></h4><div class="lv6"><div class="h">等级</div><div v-for="row in levels" :key="`level:${row.level}`" class="t" :data-t="row.level">{{ row.level }}</div><div class="h">升级费用</div><div v-for="row in levels" :key="`cost:${row.level}`" class="c">{{ row.upgradeCost ?? 'MAX' }}</div><div class="h">干员栏</div><div v-for="row in levels" :key="`slots:${row.level}`" class="sl"><u v-for="slot in row.operatorSlots" :key="slot"></u></div><div class="h">最高等阶</div><div v-for="row in levels" :key="`tier:${row.level}`" class="t" :data-t="row.level">{{ TIER_LABELS[row.level] }}</div></div></div>
    <div class="nc"><h4>领袖生命<Segmented :labels="MODES" :active="state.mode" attr="nud" @change="state.mode = $event"/></h4><div class="qldr"><template v-for="leader in leaders" :key="leader.name"><span class="nm" :data-key="`name:${leader.name}`" :data-ld="leader.name">{{ leader.name }}</span><div class="tr" :data-key="`hp:${leader.name}`"><div class="m" :style="{ width: leader.width + '%' }"></div><span>{{ wan(leader.hp) }}{{ leader.hidden ? ' · 核心 ' + wan(leader.hidden) : '' }}</span></div></template></div></div>
    <div class="nc"><h4>机变 · 悬赏资金</h4><div class="qbty"><div v-for="column in bountyColumns" :key="column.funds"><div class="col"><span v-for="(bounty, index) in column.items" :key="bounty.name" :style="{ animationDelay: index * .03 + 's' }">{{ bounty.name }}</span></div><div class="h">{{ column.funds }}</div></div></div><div class="row mt"><span v-for="bounty in otherBounties" :key="bounty.name" class="tag">{{ bounty.name }} · <b class="num" style="color:var(--accent)">{{ bounty.funds }}</b> · {{ bounty.when }}</span></div></div>
    <div class="nc"><h4>等阶练度</h4><div class="tw"><table><tbody><tr><th>等阶</th><th>初始</th><th>精锐</th></tr><tr v-for="row in TIER_STATS" :key="row.tier"><td><span class="op" :data-t="row.tier" style="padding:2px"><i>{{ TIER_LABELS[row.tier] }}</i></span></td><td>{{ row.base }}</td><td>{{ row.elite }}</td></tr></tbody></table></div></div>
    <div class="nc"><h4>自持干员加成</h4><div class="tw"><table><tbody><tr><th>练度</th><th>攻击</th><th>防御</th><th>生命</th></tr><tr v-for="row in OWN_OPERATOR_BONUS" :key="row.level"><td>{{ row.level }}</td><td class="n">{{ row.atk }}</td><td class="n">{{ row.def }}</td><td class="n">{{ row.hp }}</td></tr></tbody></table></div><h4 class="mt">特训类型</h4><div class="row"><span v-for="training in TRAINING" :key="training.name" class="tag t">{{ training.name }} · {{ training.desc }}</span></div></div>
  </div>
</template>
