<script setup lang="ts">
import { computed } from 'vue';
import { CORE_BUILDS, MIXED_BUILDS, COVENANTS, OPERATOR, buildByName, lineupCovenantCount, type Operator } from '../../../data/index.ts';
import { round1 } from '../../lib/dom.ts';
import { state, setBuild } from '../state.ts';
import { color } from '../format.ts';
import Chip from '../components/Chip.vue';
import OperatorTile from '../components/OperatorTile.vue';
const core = computed(() => CORE_BUILDS[state.build]);
const build = computed(() => buildByName(state.build)!);
const accent = computed(() => core.value ? color(state.build) : 'var(--accent)');
const carries = computed(() => new Set(core.value?.carries ?? []));
const lineup = computed(() => build.value.lineup.map(name => OPERATOR[name]).filter((operator): operator is Operator => !!operator));
const main = computed(() => core.value ? COVENANTS[state.build].scaling[0] : undefined);
</script>
<template>
  <div class="bsel"><button v-for="(_, name) in CORE_BUILDS" :key="name" type="button" :class="{ on: name === state.build }" :style="{ '--c': color(name) }" :data-bd="name" @click="setBuild(name)">{{ name }}</button><span class="sp"></span><button v-for="item in MIXED_BUILDS" :key="item.name" type="button" :class="{ on: item.name === state.build }" style="--c:var(--accent)" :data-bd="item.name" @click="setBuild(item.name)">{{ item.name }}</button></div>
  <div class="panel" :style="{ '--c': accent }"><div class="ph"><h2>{{ state.build }}</h2><span class="tag a">{{ build.tagline }}</span><Chip v-if="core" kind="cv" :name="state.build"/></div><div><h5>终盘阵容<template v-if="core"> · <span class="tag a" style="padding:0 6px">核心</span></template></h5><div class="tiles"><OperatorTile v-for="operator in lineup" :key="operator.name" :operator="operator" :extra-class="carries.has(operator.name) ? 'core' : ''"/></div></div>
    <div class="bgrid"><div><h5>要点</h5><ol class="qsteps"><li v-for="(tip, index) in build.tips" :key="tip" :style="{ animationDelay: index * .06 + 's' }"><span>{{ tip }}</span></li></ol></div><div style="display:grid;gap:12px;align-content:start"><div v-if="core" data-key="addons"><h5>推荐附加盟约 · 阵容人数 / 激活人数</h5><div class="row"><span v-for="name in core.addons" :key="name" class="row" :data-key="name"><Chip kind="cv" :name="name"/><span class="tag">{{ lineupCovenantCount(build.lineup, name) }} / {{ COVENANTS[name].need }}</span></span></div></div><div data-key="strategies"><h5>策略</h5><div class="row"><Chip v-for="name in build.strategies" :key="name" kind="st" :name="name"/></div></div><div data-key="equipment"><h5>装备</h5><div class="row"><Chip v-for="name in build.equipment" :key="name" kind="eq" :name="name"/></div></div></div></div>
    <div v-if="main" class="qcalc" :style="{ '--c': accent }"><div class="vals"><div v-for="layers in [0, 50, 100, 150, 200]" :key="layers"><span>{{ layers }} 层 · {{ main.label }}</span><b>{{ round1(main.at(layers)) }}<small>{{ main.unit }}</small></b></div></div></div>
  </div>
</template>
