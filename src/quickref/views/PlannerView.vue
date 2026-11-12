<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import {
  OPERATORS, OPERATOR, EQUIPMENT, EQUIP, STRATEGIES, STRATEGY, STRATEGY_CATEGORIES, COVENANTS, ALL_COVENANTS,
  TIERS, TIER_LABELS, BUILD_NAMES, CORE_BUILDS, buildByName, isCoreCovenant,
} from '../../../data/index.ts';
import { avatarSrc, equipIconSrc, portraitSrc } from '../../lib/assets.ts';
import { nameScore, normalize } from '../../lib/match.ts';
import {
  LAYER_SLIDER, MAX_ALT, MAX_EQ, MAX_LAYERS, MAX_NOTE, MAX_OPS, alternatesFor, usesLayers, atLayers, blankPlan, newSlot, decodePlan, encodePlan, equipNotes,
  newId, planCost, shareUrl, suggestions, type Decoded, type Plan, type PlanOp,
} from '../../lib/planner.ts';
import {
  plans, currentId, plan, saveError, touch, addPlan, removePlan as dropPlan, planFromBuild, planOps as ops, inPlan, planStats as stats, closestBuilds,
} from '../planStore.ts';
import { useQuickrefActions } from '../state.ts';
import { color, fx } from '../format.ts';
import Segmented from '../components/Segmented.vue';
import PlanCovenants from '../components/PlanCovenants.vue';
import PlanSummary from '../components/PlanSummary.vue';
/**
 * 阵容规划：从全部干员里排 8 人，实时看盟约进度、效果和补位推荐；
 * 方案存在本地，可用分享码 / 链接 / 图片分享，也能导入别人的方案或与另一套对比。
 */

/* ---------- 方案存档：状态在 planStore，其他页也读同一份当前阵容 ---------- */
const actions = useQuickrefActions();
watch(currentId, () => { editing.value = -1; picking.value = ''; });
function newPlan(): void { addPlan(blankPlan(`阵容 ${plans.length + 1}`)); }
function copyPlan(): void { addPlan({ ...JSON.parse(JSON.stringify(plan.value)) as Plan, id: newId(), name: plan.value.name.slice(0, 13) + ' 副本', updated: Date.now() }); }
function removePlan(): void {
  if (!confirm(`删除「${plan.value.name}」？`)) return;
  dropPlan(plan.value);
}
const template = ref('');
function fromBuild(name: string): void { template.value = ''; planFromBuild(name); }

/* ---------- 阵容编辑 ---------- */
const editing = ref(-1);
const slot = computed<PlanOp | undefined>(() => ops.value[editing.value]);
function toggle(name: string): void {
  if (picking.value === 'alt') return addAlt(name);
  const i = ops.value.findIndex(o => o.name === name);
  if (i >= 0) {
    ops.value.splice(i, 1);
    if (editing.value === i) { editing.value = -1; picking.value = ''; }
    else if (editing.value > i) editing.value--;
  }
  else if (ops.value.length < MAX_OPS) ops.value.push(newSlot(name));
  touch();
}
function move(d: number): void {
  const i = editing.value, j = i + d;
  if (j < 0 || j >= ops.value.length) return;
  [ops.value[i], ops.value[j]] = [ops.value[j], ops.value[i]];
  editing.value = j; touch();
}
function removeSlot(): void { ops.value.splice(editing.value, 1); editing.value = -1; picking.value = ''; touch(); }
const picking = ref<'' | 'eq' | 'st' | 'alt'>('');
function addEquip(name: string): void {
  if (!slot.value) return;
  slot.value.eq = [...slot.value.eq, name].slice(-MAX_EQ);
  if (slot.value.eq.length >= MAX_EQ) picking.value = '';
  touch();
}
function dropEquip(i: number): void { slot.value?.eq.splice(i, 1); touch(); }
/* 备选：主选抓不到时的次级选择。点备选 = 和主选互换（看换人后的盟约），× = 移除 */
const altSuggest = computed(() => slot.value ? alternatesFor(slot.value, ops.value) : []);
function addAlt(name: string): void {
  const s = slot.value;
  if (!s || s.alt.length >= MAX_ALT || name === s.name || s.alt.includes(name) || inPlan.value.has(name)) return;
  s.alt.push(name);
  if (s.alt.length >= MAX_ALT) picking.value = '';
  touch();
}
function dropAlt(i: number): void { slot.value?.alt.splice(i, 1); touch(); }
function swapAlt(i: number): void {
  const s = slot.value; if (!s || inPlan.value.has(s.alt[i])) return;
  const next = s.alt[i];
  s.alt.splice(i, 1, s.name);
  s.name = next; s.elite = false;
  touch();
}
function pickStrategy(name: string): void { plan.value.strategy = plan.value.strategy === name ? '' : name; picking.value = ''; touch(); }
function editSlot(i: number): void { editing.value = editing.value === i ? -1 : i; if (picking.value === 'eq' || picking.value === 'alt') picking.value = ''; }

/* ---------- 计算 ---------- */
/* 盟约层数：每个盟约各自的层数，存在方案里，随分享码一起分享 */
const layerOf = (name: string): number => plan.value.layers[name] ?? 0;
function setLayers(name: string, value: number): void {
  plan.value.layers = { ...plan.value.layers, [name]: Math.max(0, Math.min(MAX_LAYERS, Math.round(+value || 0))) };
  touch();
}
const active = computed(() => stats.value.filter(s => s.active));
const cost = computed(() => planCost(ops.value));
/** 补位推荐：最接近的流派里还缺的人优先，并标出流派名 */
const nearest = computed(() => closestBuilds.value[0]);
const recs = computed(() => {
  const wanted = new Set(nearest.value?.missing ?? []);
  return suggestions(ops.value, 24).map(r => ({ ...r, build: wanted.has(r.op.name), score: r.score + (wanted.has(r.op.name) ? 4 : 0) }))
    .sort((a, b) => b.score - a.score).slice(0, 8);
});
const notes = computed(() => equipNotes(ops.value));
const strategy = computed(() => STRATEGY[plan.value.strategy]);
/** 阵容里已有的盟约：干员池里能推进它们的干员加星 */
const present = computed(() => new Set(stats.value.filter(s => !s.bonusActive && !s.broken).map(s => s.name)));
const GAIN: Record<string, string> = { on: '激活', bonus: '强化', up: '+1', off: '失效' };

/* ---------- 干员池 ---------- */
const poolTier = ref(0);
const poolCovenant = ref('');
const poolQuery = ref('');
const pool = computed(() => {
  const q = normalize(poolQuery.value);
  return OPERATORS.filter(o => (!poolTier.value || o.tier === poolTier.value)
    && (!poolCovenant.value || o.covenants.includes(poolCovenant.value))
    && (!q || nameScore(o.name, q) > 0 || o.covenants.some(c => c === poolQuery.value.trim())));
});
const poolGroups = computed(() => TIERS.map(tier => ({ tier, items: pool.value.filter(o => o.tier === tier) })).filter(g => g.items.length));
const eqGroups = TIERS.map(tier => ({ tier, items: EQUIPMENT.filter(e => e.tier === tier) }));
const stCategory = ref(0);
const stList = computed(() => { const c = STRATEGY_CATEGORIES[stCategory.value]; return STRATEGIES.filter(s => c === '全部' || (c === '阵营' ? isCoreCovenant(s.category) : s.category === c)); });

/* ---------- 分享 / 导入 / 对比 ---------- */
const panel = ref<'' | 'share' | 'import' | 'compare'>('');
const openPanel = (name: typeof panel.value): void => { panel.value = panel.value === name ? '' : name; };
const code = computed(() => encodePlan(plan.value));
const link = computed(() => shareUrl(code.value));
const copied = ref('');
async function copy(text: string, what: string): Promise<void> {
  try { await navigator.clipboard.writeText(text); copied.value = what; } catch { copied.value = ''; prompt('复制下面的内容', text); }
  setTimeout(() => { if (copied.value === what) copied.value = ''; }, 1500);
}
const imageBusy = ref(false);
const imageError = ref('');
async function saveImage(): Promise<void> {
  if (imageBusy.value) return;
  imageBusy.value = true; imageError.value = '';
  // 导出期间继续编辑或切换方案，也保持图片、二维码和文件名来自同一份快照。
  const snapshot: Plan = JSON.parse(JSON.stringify(plan.value));
  try {
    const { planImage } = await import('../../lib/planImage.ts');
    const blob = await planImage(snapshot, shareUrl(encodePlan(snapshot)));
    if (!blob) throw new Error('Image export failed');
    // 直接保存到本地，不弹系统分享
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `${snapshot.name || '阵容'}.png`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  } catch { imageError.value = '图片生成失败，请重试或复制分享链接。'; }
  finally { imageBusy.value = false; }
}
const importText = ref('');
const imported = computed<Decoded | null>(() => importText.value.trim() ? decodePlan(importText.value) : null);
function acceptImport(): void {
  const d = imported.value; if (!d) return;
  addPlan({ ...blankPlan(d.plan.name || '导入的阵容'), ops: d.plan.ops, strategy: d.plan.strategy, note: d.plan.note, layers: d.plan.layers });
  importText.value = ''; panel.value = '';
}
const other = ref('');
const otherPlan = computed<{ title: string; ops: PlanOp[]; strategy: string; note: string; layers: Record<string, number> } | null>(() => {
  const [kind, key] = other.value.split(':');
  if (kind === 'p') { const p = plans.find(x => x.id === key); return p ? { title: p.name, ops: p.ops, strategy: p.strategy, note: p.note, layers: p.layers } : null; }
  if (kind === 'b') {
    const b = buildByName(key);
    return b ? { title: `流派 · ${key}`, ops: b.lineup.filter(n => OPERATOR[n]).map(newSlot), strategy: b.strategies[0] ?? '', note: b.tagline, layers: {} } : null;
  }
  return null;
});
const onlyMine = computed(() => new Set(ops.value.map(o => o.name).filter(n => !otherPlan.value?.ops.some(o => o.name === n))));
const onlyOther = computed(() => new Set((otherPlan.value?.ops ?? []).map(o => o.name).filter(n => !inPlan.value.has(n))));
const shared = computed(() => ops.value.length - onlyMine.value.size);

/** 分享链接 #p=分享码：打开导入预览，然后把地址栏的码去掉，免得刷新后重复弹出 */
function readHash(): void {
  if (!location.hash.startsWith('#p=')) return;
  importText.value = location.hash; panel.value = 'import';
  history.replaceState(null, '', location.pathname + location.search);
  window.scrollTo({ top: 0 });
}
onMounted(() => { readHash(); window.addEventListener('hashchange', readHash); });
onUnmounted(() => window.removeEventListener('hashchange', readHash));
</script>
<template>
  <div class="pl">
    <!-- 方案栏 -->
    <div class="pl-bar">
      <select v-model="currentId" aria-label="方案"><option v-for="p in plans" :key="p.id" :value="p.id">{{ p.name }}（{{ p.ops.length }}）</option></select>
      <input v-model="plan.name" class="pl-name" maxlength="16" aria-label="方案名" @input="touch">
      <span class="pl-acts">
        <button type="button" @click="newPlan">新建</button>
        <button type="button" @click="copyPlan">复制</button>
        <select v-model="template" class="pl-tpl" aria-label="从流派载入" @change="fromBuild(template)"><option value="">从流派载入</option><option v-for="name in BUILD_NAMES" :key="name" :value="name">{{ name }}</option></select>
        <button type="button" class="dg" @click="removePlan">删除</button>
        <i class="sep"></i>
        <button type="button" :class="{ on: panel === 'share' }" @click="openPanel('share')">分享</button>
        <button type="button" :class="{ on: panel === 'import' }" @click="openPanel('import')">导入</button>
        <button type="button" :class="{ on: panel === 'compare' }" @click="openPanel('compare')">对比</button>
      </span>
    </div>

    <p v-if="saveError" class="pl-warn" role="status">本地保存失败，请先复制分享码保留方案。</p>

    <!-- 分享 -->
    <section v-if="panel === 'share'" class="pl-panel">
      <div class="pl-code"><span class="k">分享码</span><code>{{ code }}</code><button type="button" @click="copy(code, 'code')">{{ copied === 'code' ? '已复制' : '复制' }}</button></div>
      <div class="pl-code"><span class="k">链接</span><code>{{ link }}</code><button type="button" @click="copy(link, 'link')">{{ copied === 'link' ? '已复制' : '复制' }}</button></div>
      <div class="pl-code"><span class="k">图片</span><span class="hint">干员、装备、盟约，附二维码，扫码即导入</span><button type="button" :disabled="imageBusy || !ops.length" @click="saveImage">{{ imageBusy ? '生成中…' : '生成图片' }}</button></div>
    </section>

    <p v-if="imageError && panel === 'share'" class="pl-warn" role="status">{{ imageError }}</p>

    <!-- 导入 -->
    <section v-if="panel === 'import'" class="pl-panel">
      <input v-model="importText" class="pl-paste" placeholder="粘贴分享码或链接" aria-label="分享码">
      <template v-if="imported">
        <PlanSummary :ops="imported.plan.ops" :strategy="imported.plan.strategy" :note="imported.plan.note" :layers="imported.plan.layers" :title="imported.plan.name || '导入的阵容'"/>
        <div class="pl-row"><button type="button" class="pri" @click="acceptImport">存为我的方案</button></div>
      </template>
      <p v-else-if="importText.trim()" class="pl-warn">认不出这个分享码</p>
    </section>

    <!-- 对比 -->
    <section v-if="panel === 'compare'" class="pl-panel">
      <select v-model="other" aria-label="对比对象">
        <option value="">选择要对比的方案或流派</option>
        <optgroup label="我的方案"><option v-for="p in plans.filter(p => p.id !== plan.id)" :key="p.id" :value="`p:${p.id}`">{{ p.name }}</option></optgroup>
        <optgroup label="流派"><option v-for="name in BUILD_NAMES" :key="name" :value="`b:${name}`">{{ name }}</option></optgroup>
      </select>
      <template v-if="otherPlan">
        <div class="pl-diff"><span>相同 <b>{{ shared }}</b></span><span class="a">只在这边 <b>{{ onlyMine.size }}</b></span><span class="b">只在那边 <b>{{ onlyOther.size }}</b></span></div>
        <div class="pl-cmp">
          <PlanSummary :ops="ops" :strategy="plan.strategy" :note="plan.note" :layers="plan.layers" :title="plan.name" :highlight="onlyMine" compact/>
          <PlanSummary :ops="otherPlan.ops" :strategy="otherPlan.strategy" :note="otherPlan.note" :layers="otherPlan.layers" :title="otherPlan.title" :highlight="onlyOther" compact/>
        </div>
      </template>
    </section>

    <div class="pl-grid">
      <!-- 阵容 -->
      <section class="pl-card pl-lineup">
        <h4>阵容<span class="tag">{{ ops.length }} / {{ MAX_OPS }}</span><span class="hint">点头像编辑 · 小头像是备选</span></h4>
        <div class="pl-slots">
          <button v-for="(s, i) in ops" :key="s.name" type="button" :class="['pl-slot', { on: editing === i, el: s.elite }]" :data-t="OPERATOR[s.name].tier" :data-op="s.name" :style="{ '--i': i }" @click="editSlot(i)">
            <i class="no">{{ i + 1 }}</i>
            <span class="av"><img :src="avatarSrc(s.name)" alt="" width="56" height="56"><b class="tr" :title="`${OPERATOR[s.name].tier} 阶`">{{ TIER_LABELS[OPERATOR[s.name].tier] }}</b></span>
            <span class="nm">{{ s.name }}</span>
            <span class="dots"><u v-for="c in OPERATOR[s.name].covenants" :key="c" :style="{ '--c': color(c) }"></u></span>
            <span v-if="s.eq.length" class="eqs"><img v-for="(e, k) in s.eq" :key="k" :src="equipIconSrc(e)" alt="" width="16" height="16"></span>
            <span v-if="s.alt.length" class="alts"><img v-for="a in s.alt" :key="a" :src="avatarSrc(a)" :data-t="OPERATOR[a].tier" alt="" width="18" height="18"></span>
          </button>
          <span v-for="k in MAX_OPS - ops.length" :key="`e${k}`" class="pl-slot empty"><i class="no">{{ ops.length + k }}</i>+</span>
        </div>

        <div v-if="slot" class="pl-edit">
          <div class="pl-row">
            <b>{{ slot.name }}</b>
            <Segmented :labels="['初始', '精锐']" :active="slot.elite ? 1 : 0" attr="ple" @change="slot.elite = $event === 1; touch()"/>
            <span class="pl-move"><button type="button" aria-label="左移" :disabled="editing === 0" @click="move(-1)">‹</button><button type="button" aria-label="右移" :disabled="editing === ops.length - 1" @click="move(1)">›</button></span>
            <button type="button" class="dg" @click="removeSlot">移出</button>
          </div>
          <p class="pl-trait" v-html="fx(slot.elite ? OPERATOR[slot.name].elite : OPERATOR[slot.name].trait)"></p>
          <div class="pl-row pl-eqs">
            <span class="k">装备</span>
            <button v-for="(e, k) in slot.eq" :key="k" type="button" class="pl-eq" :data-t="EQUIP[e].tier" :data-eq="e" @click="dropEquip(k)"><img :src="equipIconSrc(e)" alt="" width="22" height="22">{{ e }}<i>×</i></button>
            <button v-if="slot.eq.length < MAX_EQ" type="button" :class="['pl-eq', 'add', { on: picking === 'eq' }]" @click="picking = picking === 'eq' ? '' : 'eq'">+ 装备</button>
          </div>
          <div class="pl-row pl-alts">
            <span class="k">备选</span>
            <span v-for="(a, k) in slot.alt" :key="a" class="pl-alt" :data-t="OPERATOR[a].tier" :data-op="a">
              <button type="button" :disabled="inPlan.has(a)" :title="inPlan.has(a) ? '已在阵容里' : '换上场'" @click="swapAlt(k)"><img :src="avatarSrc(a)" alt="" width="24" height="24">{{ a }}<b>⇄</b></button>
              <button type="button" class="x" aria-label="移除备选" @click="dropAlt(k)">×</button>
            </span>
            <button v-if="slot.alt.length < MAX_ALT" type="button" :class="['pl-eq', 'add', { on: picking === 'alt' }]" @click="picking = picking === 'alt' ? '' : 'alt'">+ 备选</button>
          </div>
          <div v-if="picking === 'alt'" class="pl-pick pl-altpick">
            <span class="hint">同盟约、等阶相近 · 也可以在干员列表里点选</span>
            <div class="pl-pick-g"><button v-for="o in altSuggest" :key="o.name" type="button" :data-t="o.tier" :data-op="o.name" @click="addAlt(o.name)"><img :src="avatarSrc(o.name)" alt="" width="34" height="34" loading="lazy"><small>{{ o.name }}</small><span class="dots"><u v-for="c in o.covenants" :key="c" :style="{ '--c': color(c) }"></u></span></button></div>
          </div>
          <div v-if="picking === 'eq'" class="pl-pick">
            <div v-for="g in eqGroups" :key="g.tier" class="pl-pick-g"><i class="tier" :data-t="g.tier">{{ TIER_LABELS[g.tier] }}</i>
              <button v-for="e in g.items" :key="e.name" type="button" :data-t="e.tier" :data-eq="e.name" :title="e.name" @click="addEquip(e.name)"><img :src="equipIconSrc(e.name)" alt="" width="30" height="30" loading="lazy"></button>
            </div>
          </div>
        </div>

        <div class="pl-stats">
          <span><b>{{ cost.recruit }}</b>招募</span>
          <span><b>{{ cost.equipment }}</b>装备</span>
          <span><b>Lv{{ cost.maxTier || '—' }}</b>调度中心</span>
          <span><b>{{ active.length }}</b>激活盟约</span>
          <span><b>{{ cost.elites }}</b>精锐</span>
        </div>

        <div class="pl-st">
          <button type="button" :class="['pl-st-b', { on: picking === 'st' }]" :data-st="strategy?.name" @click="picking = picking === 'st' ? '' : 'st'">
            <img v-if="strategy" :src="portraitSrc(strategy.name)" alt="" width="36" height="36"><span v-else class="ph">+</span>
            <span><small>策略</small><b>{{ strategy ? `${strategy.name}` : '选择策略' }}</b></span>
          </button>
          <p v-if="strategy" v-html="fx(strategy.effect)"></p>
        </div>
        <div v-if="picking === 'st'" class="pl-pick stp">
          <Segmented :labels="STRATEGY_CATEGORIES" :active="stCategory" attr="plsc" @change="stCategory = $event"/>
          <div class="pl-pick-g"><button v-for="s in stList" :key="s.name" type="button" :class="{ on: s.name === plan.strategy }" :data-st="s.name" @click="pickStrategy(s.name)"><img :src="portraitSrc(s.name)" alt="" width="34" height="34" loading="lazy"><small>{{ s.name }}</small></button></div>
        </div>
        <label class="pl-note"><span class="k">流派说明</span><textarea v-model="plan.note" :maxlength="MAX_NOTE" rows="4" placeholder="核心思路、靠谁输出、前期怎么过渡、几层转型、抓不到核心时怎么换" aria-label="流派说明" @input="touch"></textarea><small>{{ plan.note.length }}/{{ MAX_NOTE }}</small></label>
      </section>

      <!-- 盟约 -->
      <section class="pl-card pl-cov">
        <h4>盟约<span class="tag">{{ active.length }} 激活</span></h4>
        <PlanCovenants :stats="stats" :layers="plan.layers"/>
      </section>

      <!-- 补位 -->
      <section v-if="recs.length || closestBuilds.length" class="pl-card pl-rec">
        <h4 v-if="recs.length">补谁<span class="hint">加入后跨过的门槛</span></h4>
        <div v-if="recs.length" class="pl-recs">
          <button v-for="r in recs" :key="r.op.name" type="button" class="pl-r" :data-t="r.op.tier" :data-op="r.op.name" @click="toggle(r.op.name)">
            <img :src="avatarSrc(r.op.name)" alt="" width="40" height="40" loading="lazy">
            <span><b>{{ r.op.name }}</b><span class="g"><i v-if="r.build" class="bd">{{ nearest?.name }} 流派</i><i v-for="g in r.gains" :key="g.covenant" :class="g.kind" :style="{ '--c': color(g.covenant) }">{{ g.covenant }} {{ GAIN[g.kind] }}</i></span></span>
          </button>
        </div>
        <template v-if="closestBuilds.length">
          <h4 class="pl-bm-h">接近的流派<span class="hint">点头像补进阵容 · 点名字看打法</span></h4>
          <div v-for="m in closestBuilds" :key="m.name" class="pl-bm" :style="{ '--c': CORE_BUILDS[m.name] ? color(m.name) : 'var(--accent)' }">
            <button type="button" class="nm" :data-build="m.name" @click="actions.openBuild(m.name)"><b>{{ m.name }}</b><span class="bar"><i v-for="k in m.total" :key="k" :class="{ f: k <= m.have.length }"></i></span><small>{{ m.have.length }}/{{ m.total }}</small></button>
            <span v-if="m.missing.length" class="miss"><span class="k">还差</span><button v-for="n in m.missing" :key="n" type="button" :data-t="OPERATOR[n].tier" :data-op="n" :disabled="ops.length >= MAX_OPS" :title="`加入 ${n}`" @click="toggle(n)"><img :src="avatarSrc(n)" alt="" width="30" height="30" loading="lazy"></button></span>
            <span v-else class="done">已凑齐</span>
          </div>
        </template>
      </section>

      <!-- 效果 -->
      <section class="pl-card pl-fx">
        <h4>效果<span class="hint">有层数的盟约各自拖动 / 填写</span></h4>
        <ul class="pl-fxl">
          <li v-for="s in active" :key="s.name" :style="{ '--c': color(s.name) }">
            <b class="n">{{ s.name }}</b>
            <div>
              <label v-if="usesLayers(s.name)" class="pl-layer">
                <input type="range" min="0" :max="Math.max(LAYER_SLIDER, layerOf(s.name))" step="10" :value="layerOf(s.name)" :aria-label="`${s.name}层数`" @input="setLayers(s.name, +($event.target as HTMLInputElement).value)">
                <input type="number" min="0" :max="MAX_LAYERS" inputmode="numeric" :value="layerOf(s.name)" :aria-label="`${s.name}层数`" @change="setLayers(s.name, +($event.target as HTMLInputElement).value)"><span>层</span>
              </label>
              <p v-html="fx(atLayers(COVENANTS[s.name].effect, layerOf(s.name)))"></p>
              <p v-if="COVENANTS[s.name].bonus" :class="['bn', { on: s.bonusActive }]" v-html="fx(atLayers(COVENANTS[s.name].bonus, layerOf(s.name)))"></p>
            </div>
          </li>
          <li v-if="!active.length" class="none">还没有激活的盟约</li>
        </ul>
        <ul v-if="notes.length" class="pl-notes">
          <li v-for="(n, i) in notes" :key="i" :class="n.kind"><b>{{ n.op }}</b>{{ n.text }}<span v-if="n.result" v-html="fx(n.result)"></span></li>
        </ul>
      </section>

      <!-- 干员池 -->
      <section class="pl-card pl-pool">
        <h4>干员<span class="tag">{{ pool.length }}</span><span class="hint">★ 能推进已有盟约</span></h4>
        <div v-if="picking === 'alt' && slot" class="pl-altbar"><span>点选干员 → 加为 <b>{{ slot.name }}</b> 的备选（{{ slot.alt.length }}/{{ MAX_ALT }}）</span><button type="button" @click="picking = ''">完成</button></div>
        <div class="pl-filter">
          <input v-model="poolQuery" type="search" placeholder="名字 / 拼音" aria-label="搜索干员">
          <select v-model="poolCovenant" aria-label="盟约"><option value="">全部盟约</option><option v-for="name in ALL_COVENANTS" :key="name">{{ name }}</option></select>
          <Segmented :labels="['全部', ...TIER_LABELS.slice(1)]" :active="poolTier" attr="plt" @change="poolTier = $event"/>
        </div>
        <template v-for="g in poolGroups" :key="g.tier">
          <div class="tierh" :data-t="g.tier"><i>{{ TIER_LABELS[g.tier] }}</i><span>{{ g.items.length }}</span></div>
          <div class="pl-tiles">
            <button v-for="o in g.items" :key="o.name" type="button" :class="['tile', { in: inPlan.has(o.name), alt: slot?.alt.includes(o.name), rec: !inPlan.has(o.name) && o.covenants.some(c => present.has(c)) }]" :data-t="o.tier" :data-op="o.name" :disabled="picking === 'alt' ? inPlan.has(o.name) || !!slot?.alt.includes(o.name) : !inPlan.has(o.name) && ops.length >= MAX_OPS" @click="toggle(o.name)">
              <img :src="avatarSrc(o.name)" alt="" width="80" height="80" loading="lazy" decoding="async">
              <span>{{ o.name }}</span><span class="dots"><u v-for="c in o.covenants" :key="c" :style="{ '--c': color(c) }"></u></span>
            </button>
          </div>
        </template>
        <div v-if="!pool.length" class="empty">—</div>
      </section>
    </div>
  </div>
</template>
