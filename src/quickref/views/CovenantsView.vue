<script setup lang="ts">
import { computed } from 'vue';
import { COVENANTS, CORE_COVENANTS, ADDON_COVENANTS, CORE_BUILDS, EQUIPMENT, STRATEGIES, TIERS, TIER_LABELS, isCoreCovenant, rosterOf } from '../../../data/index.ts';
import { avatarSrc } from '../../lib/assets.ts';
import { color, fx, bonusHeadcount, bonusText, stackText } from '../format.ts';
import { state, useQuickrefActions } from '../state.ts';
import Chip from '../components/Chip.vue';
import OperatorTile from '../components/OperatorTile.vue';
const actions = useQuickrefActions();
const name = computed(() => state.covenant);
const covenant = computed(() => COVENANTS[name.value]);
const core = computed(() => isCoreCovenant(name.value));
const build = computed(() => CORE_BUILDS[name.value]);
const roster = computed(() => rosterOf(name.value));
const slots = computed(() => core.value ? 6 : Math.max(covenant.value.need, bonusHeadcount(covenant.value.bonus)));
const recommended = computed(() => new Set(build.value ? [...build.value.lineup, ...build.value.carries] : []));
const carries = computed(() => new Set(build.value?.carries ?? []));
const groups = computed(() => [
  { title: '持续叠加', list: roster.value.filter(o => o.type === '持续叠加') },
  { title: '单次叠加', list: roster.value.filter(o => o.type === '单次叠加') },
  { title: '其他特质', list: roster.value.filter(o => o.type !== '持续叠加' && o.type !== '单次叠加') },
].filter(group => group.list.length).map(group => ({ ...group, list: group.list.sort((a, b) => a.tier - b.tier) })));
const equipment = computed(() => EQUIPMENT.filter(e => e.covenant === name.value));
const strategies = computed(() => STRATEGIES.filter(s => s.category === name.value));
const builds = computed(() => [...(build.value ? [name.value] : []), ...Object.entries(CORE_BUILDS).filter(([, b]) => b.addons.includes(name.value)).map(([c]) => c)]);
const bonusLabel = computed(() => { const head = bonusHeadcount(covenant.value.bonus); return head ? head + (core.value ? ' 名不同' : ' 名') : '强化'; });
</script>
<template>
  <div class="cvwrap">
    <div id="cvside" :class="['cvside', { open: state.pickerOpen }]">
      <button type="button" class="cvtg" data-cvtg :style="{ '--c': color(name) }" @click="state.pickerOpen = !state.pickerOpen"><b>{{ name }}</b><span :class="['tag', core ? 'a' : 't']">{{ core ? '核心' : '附加' }}</span><i>▾</i></button>
      <div id="cvp" class="cvp"><h5>核心</h5><button v-for="item in CORE_COVENANTS" :key="item" type="button" :class="['cvb', { on: item === name }]" :style="{ '--c': color(item) }" :data-pick="item" :aria-pressed="item === name" @click="actions.pickCovenant(item)">{{ item }}<span>{{ rosterOf(item).length }}</span></button><h5>附加</h5><button v-for="item in ADDON_COVENANTS" :key="item" type="button" :class="['cvb', { on: item === name }]" :style="{ '--c': color(item) }" :data-pick="item" :aria-pressed="item === name" @click="actions.pickCovenant(item)">{{ item }}<span>{{ rosterOf(item).length }}</span></button></div>
    </div>
    <div class="cvd" :data-covenant="name" :style="{ '--c': color(name) }">
      <div class="cvh" data-key="header"><h2>{{ name }}</h2><span :class="['tag', core ? 'a' : 't']">{{ core ? '核心' : '附加' }}</span><div class="need"><i v-for="index in slots" :key="index" :class="{ o: index > covenant.need }" :style="{ animationDelay: (index - 1) * .05 + 's' }"></i><b>{{ covenant.need }}</b><span class="cnt">人激活</span></div></div>
      <div class="efx" data-key="effects"><div class="ef" v-html="`<span class='tag'>${covenant.need} 人</span> ${fx(covenant.effect)}`"></div><div v-if="covenant.bonus" class="ef bonus" v-html="`<span class='tag a'>${bonusLabel}</span> ${fx(bonusText(covenant.bonus))}`"></div></div>
      <div v-if="roster.length" class="roster" data-key="roster">
        <div class="lg"><span class="cnt">{{ roster.length }} 名</span><template v-if="build"><span><b>★</b> 终盘阵容</span><span class="tag a" style="padding:0 6px">核心</span></template></div>
        <div class="rcols"><div v-for="tier in TIERS" :key="tier" :class="['rc', { none: !roster.some(o => o.tier === tier) }]" :data-t="tier"><i>{{ TIER_LABELS[tier] }}</i><div class="tiles"><OperatorTile v-for="operator in roster.filter(o => o.tier === tier)" :key="operator.name" :operator="operator" :extra-class="(carries.has(operator.name) ? 'core ' : '') + (recommended.has(operator.name) ? 'rec' : '')"/></div></div></div>
      </div>
      <div v-if="roster.length" class="stak" data-key="stacks">
        <div class="lg"><b class="sh5">叠层</b><span><b class="sw">初始</b><s>/</s><b class="sw e">精锐</b></span><span v-if="build"><b>★</b> 终盘</span></div>
        <div v-for="group in groups" :key="group.title" class="sg" :data-key="group.title"><h5>{{ group.title }}<span>{{ group.list.length }}</span></h5><div class="srs"><button v-for="operator in group.list" :key="operator.name" type="button" class="sr" :data-key="operator.name" :data-t="operator.tier" :data-op="operator.name" data-peek="off" @click="actions.openDetail('op', operator.name)"><img v-if="avatarSrc(operator.name)" class="" :src="avatarSrc(operator.name)" alt="" width="80" height="80" loading="lazy" decoding="async"><span v-else class="ph"></span><div><div class="nl"><i class="tn">{{ TIER_LABELS[operator.tier] }}</i><b>{{ operator.name }}</b><span v-for="other in operator.covenants.filter(c => c !== name)" :key="other" class="x" :style="{ '--c': color(other) }">{{ other }}</span><span v-if="recommended.has(operator.name)" class="rk">★</span></div><div class="tt" v-html="stackText(operator.trait, operator.elite, name)"></div></div></button></div></div>
      </div>
      <div class="tools" data-key="related"><div v-if="equipment.length"><span>专属装备</span><div class="row"><Chip v-for="item in equipment" :key="item.name" kind="eq" :name="item.name"/></div></div><div v-if="strategies.length"><span>专属策略</span><div class="row"><Chip v-for="item in strategies" :key="item.name" kind="st" :name="item.name"/></div></div><div v-if="builds.length"><span>流派</span><div class="row"><Chip v-for="item in builds" :key="item" kind="build" :name="item"/></div></div></div>
    </div>
  </div>
</template>
