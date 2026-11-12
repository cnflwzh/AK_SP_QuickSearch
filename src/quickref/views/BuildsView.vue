<script setup lang="ts">
import { computed, defineAsyncComponent, h, onMounted, onUnmounted, ref, watch } from 'vue';
import { CORE_BUILDS, COVENANTS, OPERATOR, EQUIP, STRATEGY, buildByName, type Operator } from '../../../data/index.ts';
import { round1 } from '../../lib/dom.ts';
import { avatarSrc } from '../../lib/assets.ts';
import { atLayers, banReplace, blankPlan, covenantStats, decodePlan, type Decoded } from '../../lib/planner.ts';
import { state, useQuickrefActions } from '../state.ts';
import {
  presets, current, editing, runKey, runBans, saveError, presetColor, selectPreset, newPreset, copyPreset, removePreset, restorePreset,
  startEdit, finishEdit, setRun, toggleBan, addPlan,
} from '../planStore.ts';
import { color, fx, bonusHeadcount, bonusText } from '../format.ts';
import Chip from '../components/Chip.vue';
import OperatorTile from '../components/OperatorTile.vue';
import PlanSummary from '../components/PlanSummary.vue';
/**
 * 流派：内置流派和我的流派都是预设。默认只读查看，局内扫一眼；点「编辑」进入规划器。
 * 「本局打这套」把它设为本局流派，盟约 / 效果 / 干员页随之高亮。
 */
const PlannerView = defineAsyncComponent({
  loader: () => import('./PlannerView.vue'),
  loadingComponent: { render: () => h('div', { class: 'empty', role: 'status' }, '正在加载编辑器…') },
  errorComponent: { render: () => h('div', { class: 'empty', role: 'alert' }, [
    '编辑器加载失败。', h('button', { type: 'button', onClick: () => location.reload() }, '重新加载'),
  ]) },
});
const actions = useQuickrefActions();

/* ---------- 列表 ---------- */
const coreList = computed(() => presets.value.filter(x => x.builtin && CORE_BUILDS[x.key]));
const mixedList = computed(() => presets.value.filter(x => x.builtin && !CORE_BUILDS[x.key]));
const mine = computed(() => presets.value.filter(x => !x.builtin));

/* ---------- 查看 ---------- */
const p = computed(() => current.value);
const base = computed(() => p.value.plan.base ? buildByName(p.value.plan.base) : undefined);
const coreBase = computed(() => p.value.plan.base ? CORE_BUILDS[p.value.plan.base] : undefined);
const accent = computed(() => presetColor(p.value));
const carries = computed(() => new Set(base.value?.carries ?? []));
const lineup = computed(() => p.value.plan.ops.map(o => OPERATOR[o.name]).filter((o): o is Operator => !!o));
const withAlts = computed(() => p.value.plan.ops.filter(o => o.alt.length));
const stats = computed(() => covenantStats(p.value.plan.ops, p.value.plan.layers).filter(s => s.name !== '绝技'));
/** 这套要用的盟约：终盘阵容里激活的 */
const needs = computed(() => stats.value.filter(s => s.active));
/** 已成型盟约的效果；方案里填过层数的按层数代入 */
const effects = computed(() => needs.value.map(s => {
  const cov = COVENANTS[s.name], layers = p.value.plan.layers[s.name] ?? 0, head = bonusHeadcount(cov.bonus);
  return {
    ...s, layers,
    effect: fx(layers ? atLayers(cov.effect, layers) : cov.effect),
    bonus: cov.bonus ? fx(layers ? atLayers(bonusText(cov.bonus), layers) : bonusText(cov.bonus)) : '',
    bonusLabel: head ? `${head} 名` : '强化',
  };
}));
const tips = computed(() => p.value.plan.note.split('\n').map(t => t.trim()).filter(Boolean));
const strategies = computed(() => [...new Set([p.value.plan.strategy, ...(base.value?.strategies ?? [])])].filter(s => STRATEGY[s]));
const equipment = computed(() => [...new Set([...p.value.plan.ops.flatMap(o => o.eq), ...(base.value?.equipment ?? [])])].filter(e => EQUIP[e]));
const main = computed(() => coreBase.value ? COVENANTS[p.value.plan.base!].scaling[0] : undefined);
const isRun = computed(() => runKey.value === p.value.key);
function remove(): void { if (confirm(`删除「${p.value.plan.name}」？`)) removePreset(p.value.key); }
function restore(): void { if (confirm(`放弃对「${p.value.key}」的修改，恢复内置版本？`)) restorePreset(p.value.key); }

/* ---------- 盟约被 ban：被 ban 盟约的干员不会出现，给出替代 ---------- */
const banOpen = ref(false);
const myBans = computed(() => runBans.value.filter(b => stats.value.some(s => s.name === b)));
const forced = ref<Record<string, string>>({});
watch(() => [p.value.key, runBans.value.join()], () => { forced.value = {}; });
const ban = computed(() => myBans.value.length ? banReplace(p.value.plan.ops, runBans.value, forced.value) : null);
const banAfter = computed(() => ban.value ? covenantStats(ban.value.ops).filter(s => s.active && s.name !== '绝技') : []);
function pickAlt(replaces: string, name: string): void { forced.value = { ...forced.value, [replaces]: name }; }
function saveBan(): void {
  const result = ban.value; if (!result) return;
  const source = p.value.plan, st = STRATEGY[source.strategy];
  addPlan({
    ...blankPlan(`${source.name.slice(0, 13)}·替`), ops: JSON.parse(JSON.stringify(result.ops)),
    strategy: st && runBans.value.includes(st.category) ? '' : source.strategy, note: source.note, layers: { ...source.layers },
  });
  setRun(state.build);
}

/* ---------- 导入：分享码 / 链接 ---------- */
const importOpen = ref(false);
const importText = ref('');
const imported = computed<Decoded | null>(() => importText.value.trim() ? decodePlan(importText.value) : null);
function acceptImport(): void {
  const d = imported.value; if (!d) return;
  addPlan({ ...blankPlan(d.plan.name || '导入的流派'), ops: d.plan.ops, strategy: d.plan.strategy, note: d.plan.note, layers: d.plan.layers });
  importText.value = ''; importOpen.value = false;
}
/** 分享链接 #p=分享码：打开导入预览，然后把地址栏的码去掉，免得刷新后重复弹出 */
function readHash(): void {
  if (!location.hash.startsWith('#p=')) return;
  finishEdit();
  importText.value = location.hash; importOpen.value = true;
  history.replaceState(null, '', location.pathname + location.search);
  window.scrollTo({ top: 0 });
}
onMounted(() => { readHash(); window.addEventListener('hashchange', readHash); });
onUnmounted(() => window.removeEventListener('hashchange', readHash));
</script>
<template>
  <div class="bsel">
    <button v-for="x in coreList" :key="x.key" type="button" :class="{ on: x.key === p.key, run: x.key === runKey }" :style="{ '--c': presetColor(x) }" :data-bd="x.key" @click="selectPreset(x.key)">{{ x.plan.name }}<i v-if="x.modified" class="md" title="已修改">✎</i></button>
    <span class="sp"></span>
    <button v-for="x in mixedList" :key="x.key" type="button" :class="{ on: x.key === p.key, run: x.key === runKey }" style="--c:var(--accent)" :data-bd="x.key" @click="selectPreset(x.key)">{{ x.plan.name }}<i v-if="x.modified" class="md" title="已修改">✎</i></button>
    <span class="sp"></span>
    <span class="bk">我的</span>
    <button v-for="x in mine" :key="x.key" type="button" :class="['my', { on: x.key === p.key, run: x.key === runKey }]" style="--c:var(--accent)" :data-bd="x.key" @click="selectPreset(x.key)">{{ x.plan.name }}</button>
    <button type="button" class="add" @click="newPreset">＋ 新建</button>
    <button type="button" :class="['add', { on: importOpen }]" @click="importOpen = !importOpen">导入</button>
  </div>

  <p v-if="saveError" class="pl-warn" role="status">本地保存失败，请先复制分享码保留流派。</p>

  <section v-if="importOpen" class="pl-panel bimp">
    <input v-model="importText" class="pl-paste" placeholder="粘贴分享码或链接" aria-label="分享码">
    <template v-if="imported">
      <PlanSummary :ops="imported.plan.ops" :strategy="imported.plan.strategy" :note="imported.plan.note" :layers="imported.plan.layers" :title="imported.plan.name || '导入的流派'"/>
      <div class="pl-row"><button type="button" class="pri" @click="acceptImport">存为我的流派</button></div>
    </template>
    <p v-else-if="importText.trim()" class="pl-warn">认不出这个分享码</p>
  </section>

  <PlannerView v-if="editing" @done="finishEdit"/>

  <div v-else class="panel" :style="{ '--c': accent }">
    <div class="ph">
      <h2>{{ p.plan.name }}</h2>
      <span v-if="base?.tagline" class="tag a">{{ base.tagline }}</span>
      <span v-if="p.modified" class="tag">已修改</span>
      <span class="bact">
        <button type="button" :class="['pri', { in: isRun }]" :disabled="!p.plan.ops.length" @click="setRun(isRun ? '' : p.key)">{{ isRun ? '✓ 本局 · 结束' : '▶ 本局打这套' }}</button>
        <button type="button" @click="startEdit(p.key)">编辑</button>
        <button type="button" @click="copyPreset(p.key)">复制</button>
        <button v-if="p.modified" type="button" @click="restore">恢复默认</button>
        <button v-if="!p.builtin" type="button" class="dg" @click="remove">删除</button>
      </span>
    </div>

    <div v-if="needs.length" class="bneed">
      <span class="k">需要盟约</span>
      <button v-for="s in needs" :key="s.name" type="button" :class="['c', { on: s.active, max: s.bonusActive, ban: runBans.includes(s.name) }]" :style="{ '--c': color(s.name) }" :data-cv="s.name" data-peek="off" @click="actions.openCovenant(s.name)">{{ s.name }}<small>{{ s.count }}/{{ s.need }}</small></button>
      <button type="button" :class="['bbtn', { on: banOpen || myBans.length }]" :aria-expanded="banOpen || !!myBans.length" @click="banOpen = !banOpen">有盟约被 ban？</button>
    </div>

    <div v-if="banOpen || myBans.length" class="bban">
      <div class="bpick"><span class="k">点选被 ban 的</span><button v-for="s in stats" :key="s.name" type="button" :class="['bc', { on: runBans.includes(s.name) }]" :style="{ '--c': color(s.name) }" @click="toggleBan(s.name)">{{ s.name }}</button></div>
      <template v-if="ban">
        <div v-for="pk in ban.picks" :key="pk.replaces" class="bpk">
          <span class="av off" :data-t="OPERATOR[pk.replaces].tier" :title="`${pk.replaces} 不会出现`"><img :src="avatarSrc(pk.replaces)" alt="" width="36" height="36"><small>{{ pk.replaces }}</small></span>
          <b class="ar">→</b>
          <button type="button" class="av to" :data-t="OPERATOR[pk.name].tier" :data-op="pk.name" @click="actions.openDetail('op', pk.name)"><img :src="avatarSrc(pk.name)" alt="" width="36" height="36"><small>{{ pk.name }}</small></button>
          <span class="g"><i v-for="c in pk.gains" :key="c" :style="{ '--c': color(c) }">{{ c }}</i></span>
          <span v-if="pk.alts.length" class="alts"><span class="k">或</span><button v-for="a in pk.alts" :key="a" type="button" :data-t="OPERATOR[a].tier" :title="`换成 ${a}`" @click="pickAlt(pk.replaces, a)"><img :src="avatarSrc(a)" alt="" width="28" height="28"></button></span>
        </div>
        <div v-for="n in ban.removed.filter(n => !ban!.picks.some(pk => pk.replaces === n))" :key="n" class="bpk">
          <span class="av off" :data-t="OPERATOR[n].tier"><img :src="avatarSrc(n)" alt="" width="36" height="36"><small>{{ n }}</small></span>
          <span class="hint">找不到能补回盟约的替代</span>
        </div>
        <div class="bres">
          <span class="k">换人后</span>
          <span v-for="s in banAfter" :key="s.name" :class="['c', 'on', { max: s.bonusActive }]" :style="{ '--c': color(s.name) }">{{ s.name }}<small>{{ s.count }}/{{ s.need }}</small></span>
          <span v-for="l in ban.lost" :key="l" class="c lost" :style="{ '--c': color(l) }">{{ l }}<small>失效</small></span>
          <button type="button" class="pri" @click="saveBan">存为新流派 · 本局打它</button>
        </div>
      </template>
      <p v-else class="hint">被 ban 盟约的干员整局不会出现，点上面的盟约看替代方案</p>
    </div>

    <div><h5>终盘阵容<template v-if="coreBase"> · <span class="tag a" style="padding:0 6px">核心</span></template></h5>
      <div v-if="lineup.length" class="tiles"><OperatorTile v-for="operator in lineup" :key="operator.name" :operator="operator" :extra-class="carries.has(operator.name) ? 'core' : ''"/></div>
      <div v-else class="empty">还没有干员，点「编辑」排阵容</div>
      <div v-if="withAlts.length" class="balt"><span class="k">备选</span><span v-for="o in withAlts" :key="o.name"><b>{{ o.name }}</b> → {{ o.alt.join('、') }}</span></div>
    </div>
    <div v-if="effects.length" class="bfx"><h5>盟约效果<span class="hint">终盘阵容已成型</span></h5>
      <div class="fxg">
        <article v-for="(c, i) in effects" :key="c.name" :class="['fxc', 'on', { max: c.bonusActive }]" :style="{ '--c': color(c.name), animationDelay: i * .05 + 's' }">
          <header>
            <button type="button" class="n" :data-cv="c.name" data-peek="off" :title="`查看${c.name}盟约页`" @click="actions.openCovenant(c.name)">{{ c.name }}</button>
            <span class="need">{{ c.need }} 人</span>
            <span class="mine" :title="c.members.join('、')">{{ c.count }} / {{ c.need }}<template v-if="c.layers"> · {{ c.layers }} 层</template></span>
          </header>
          <p v-html="c.effect"></p>
          <p v-if="c.bonus" class="bn"><span :class="['tag', c.bonusActive ? 'a' : '']">{{ c.bonusActive ? '已强化' : c.bonusLabel }}</span> <span v-html="c.bonus"></span></p>
        </article>
      </div>
    </div>
    <div class="bgrid">
      <div v-if="tips.length"><h5>要点</h5><ol class="qsteps"><li v-for="(tip, index) in tips" :key="index" :style="{ animationDelay: index * .06 + 's' }"><span>{{ tip }}</span></li></ol></div>
      <div style="display:grid;gap:12px;align-content:start">
        <div v-if="strategies.length" data-key="strategies"><h5>策略</h5><div class="row"><Chip v-for="name in strategies" :key="name" kind="st" :name="name"/></div></div>
        <div v-if="equipment.length" data-key="equipment"><h5>装备</h5><div class="row"><Chip v-for="name in equipment" :key="name" kind="eq" :name="name"/></div></div>
      </div>
    </div>
    <div v-if="main" class="qcalc" :style="{ '--c': accent }"><div class="vals"><div v-for="layers in [0, 50, 100, 150, 200]" :key="layers"><span>{{ layers }} 层 · {{ main.label }}</span><b>{{ round1(main.at(layers)) }}<small>{{ main.unit }}</small></b></div></div></div>
  </div>
</template>
