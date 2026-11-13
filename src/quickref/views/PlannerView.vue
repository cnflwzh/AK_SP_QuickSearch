<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import {
  OPERATORS, OPERATOR, EQUIPMENT, EQUIP, STRATEGIES, STRATEGY, STRATEGY_CATEGORIES, COVENANTS, ALL_COVENANTS,
  TIERS, TIER_LABELS, isCoreCovenant,
} from '../../../data/index.ts';
import { avatarSrc, equipIconSrc, portraitSrc } from '../../lib/assets.ts';
import { nameScore, normalize } from '../../lib/match.ts';
import {
  LAYER_SLIDER, MAX_ALT, MAX_EQ, MAX_LAYERS, MAX_NOTE, MAX_OPS, alternatesFor, usesLayers, atLayers, newSlot, equipNotes,
  planCost, suggestions, type Plan, type PlanOp,
} from '../../lib/planner.ts';
import { presets, editingId, plan, touch, planOps as ops, inPlan, planStats as stats } from '../planStore.ts';
import { color, fx } from '../format.ts';
import Segmented from '../components/Segmented.vue';
import PlanCovenants from '../components/PlanCovenants.vue';
import PlanSummary from '../components/PlanSummary.vue';
import PlanSharePanel from '../components/PlanSharePanel.vue';
import PlannerSheet from '../components/PlannerSheet.vue';
import { useCompactPlanner } from '../planner/useCompactPlanner.ts';
/**
 * 流派编辑（规划器）：从全部干员里排 8 人，实时看盟约进度、效果和补位推荐；
 * 编辑的是流派页当前选中的预设，可用分享码 / 链接 / 图片分享，或与另一套对比。
 */
import { routeQuery, updateQuery } from '../../router/navigation.ts';
import { CATEGORY_IDS, queryText } from '../../router/location.ts';
import { covenantId, covenantName, buildId, buildKey } from '../../router/entities.ts';
const emit = defineEmits<{ done: [] }>();
watch(editingId, () => { closeMobilePanel(); mobileSection.value = 'lineup'; });

/* ---------- 紧凑布局：总览留在原位，选人和编辑在底部面板完成 ---------- */
const root = ref<HTMLElement>();
const compact = useCompactPlanner(root);
type MobilePanel = '' | 'slot' | 'operators' | 'replace' | 'equipment' | 'alternatives' | 'strategies';
const mobilePanel = ref<MobilePanel>('');
const mobileSection = ref<'lineup' | 'effects'>('lineup');
const panelTarget = '#planner-mobile-content';
const mobilePoolOpen = computed(() => ['operators', 'replace', 'alternatives'].includes(mobilePanel.value));
const mobileCanGoBack = computed(() => !!slot.value && ['replace', 'equipment', 'alternatives'].includes(mobilePanel.value));
const mobileTitle = computed(() => {
  switch (mobilePanel.value) {
    case 'slot': return `${slot.value?.name ?? '干员'} · ${OPERATOR[slot.value?.name ?? '']?.tier ?? ''} 阶`;
    case 'replace': return `更换 ${slot.value?.name ?? '干员'}`;
    case 'equipment': return `装备 · ${slot.value?.name ?? ''}`;
    case 'alternatives': return `备选 · ${slot.value?.name ?? ''}（${slot.value?.alt.length ?? 0}/${MAX_ALT}）`;
    case 'strategies': return '选择策略';
    default: return `添加干员（${ops.value.length}/${MAX_OPS}）`;
  }
});

function closeMobilePanel(): void { mobilePanel.value = ''; editing.value = -1; picking.value = ''; }
function backToSlot(): void { picking.value = ''; mobilePanel.value = 'slot'; }
watch(compact, closeMobilePanel);

async function showSection(section: 'lineup' | 'effects'): Promise<void> {
  if (mobileSection.value === section) return;
  mobileSection.value = section;
  await nextTick();
  const top = root.value?.getBoundingClientRect().top;
  const visibleTop = (document.getElementById('qbar')?.getBoundingClientRect().height ?? 0) + 12;
  if (top !== undefined && top < visibleTop) window.scrollBy({ top: top - visibleTop, behavior: 'instant' });
}

async function openOperators(replace = false): Promise<void> {
  picking.value = '';
  if (compact.value) {
    if (!replace) editing.value = -1;
    mobilePanel.value = replace ? 'replace' : 'operators';
  } else {
    await nextTick();
    root.value?.querySelector<HTMLInputElement>('.pl-pool input')?.focus();
  }
}

function openPicker(kind: 'eq' | 'st' | 'alt'): void {
  if (!compact.value) { picking.value = picking.value === kind ? '' : kind; return; }
  picking.value = kind;
  mobilePanel.value = kind === 'eq' ? 'equipment' : kind === 'st' ? 'strategies' : 'alternatives';
}

/* ---------- 阵容编辑 ---------- */
const editing = ref(-1);
const slot = computed<PlanOp | undefined>(() => ops.value[editing.value]);
function toggle(name: string): void {
  if (picking.value === 'alt') return addAlt(name);
  if (compact.value && mobilePanel.value === 'replace') {
    if (!slot.value || inPlan.value.has(name)) return;
    // 和换上备选一致：保留位置与装备，新干员重新设置精锐和核心标记。
    slot.value.name = name;
    slot.value.elite = false;
    slot.value.core = false;
    slot.value.alt = slot.value.alt.filter(alternate => alternate !== name);
    touch();
    backToSlot();
    return;
  }
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
function removeSlot(): void {
  if (!slot.value) return;
  ops.value.splice(editing.value, 1);
  closeMobilePanel();
  touch();
}
const picking = ref<'' | 'eq' | 'st' | 'alt'>('');
function addEquip(name: string): void {
  if (!slot.value || slot.value.eq.length >= MAX_EQ) return;
  slot.value.eq = [...slot.value.eq, name].slice(-MAX_EQ);
  if (slot.value.eq.length >= MAX_EQ) picking.value = '';
  touch();
  if (compact.value) backToSlot();
}
function dropEquip(i: number): void { slot.value?.eq.splice(i, 1); touch(); }
/* 备选：主选抓不到时的次级选择。点备选 = 和主选互换（看换人后的盟约），× = 移除 */
const altSuggest = computed(() => slot.value ? alternatesFor(slot.value, ops.value, 8, plan.value.layers) : []);
function addAlt(name: string): void {
  const s = slot.value;
  if (!s || s.alt.length >= MAX_ALT || name === s.name || s.alt.includes(name) || inPlan.value.has(name)) return;
  s.alt.push(name);
  if (s.alt.length >= MAX_ALT) picking.value = '';
  touch();
  if (compact.value && s.alt.length >= MAX_ALT) backToSlot();
}
function dropAlt(i: number): void { slot.value?.alt.splice(i, 1); touch(); }
function swapAlt(i: number): void {
  const s = slot.value; if (!s || inPlan.value.has(s.alt[i])) return;
  const next = s.alt[i];
  s.alt.splice(i, 1, s.name);
  s.name = next; s.elite = false; s.core = false;
  touch();
}
function pickStrategy(name: string): void {
  plan.value.strategy = plan.value.strategy === name ? '' : name;
  picking.value = '';
  if (compact.value) closeMobilePanel();
  touch();
}
function editSlot(i: number): void {
  editing.value = !compact.value && editing.value === i ? -1 : i;
  picking.value = '';
  if (compact.value) mobilePanel.value = 'slot';
}

/* ---------- 计算 ---------- */
/* 盟约层数：每个盟约各自的层数，存在方案里，随分享码一起分享 */
const layerOf = (name: string): number => plan.value.layers[name] ?? 0;
function setLayers(name: string, value: number): void {
  plan.value.layers = { ...plan.value.layers, [name]: Math.max(0, Math.min(MAX_LAYERS, Math.round(+value || 0))) };
  touch();
}
const active = computed(() => stats.value.filter(s => s.active));
const cost = computed(() => planCost(ops.value));
const recs = computed(() => suggestions(ops.value, 8, plan.value.layers));
const notes = computed(() => equipNotes(ops.value));
const strategy = computed(() => STRATEGY[plan.value.strategy]);
/** 阵容里已有的盟约：干员池里能推进它们的干员加星 */
const present = computed(() => new Set(stats.value.filter(s => !s.bonusActive && !s.broken).map(s => s.name)));
const GAIN: Record<string, string> = { on: '激活', bonus: '强化', up: '+1', off: '失效', weaken: '失去强化' };

/* ---------- 干员池 ---------- */
const poolTier = computed({
  get: () => Number(queryText(routeQuery.value, 'poolTier')) || 0,
  set: (value: number) => { void updateQuery({ poolTier: value || null }); },
});
const poolCovenant = computed({
  get: () => covenantName(queryText(routeQuery.value, 'poolCovenant')),
  set: (value: string) => { void updateQuery({ poolCovenant: covenantId(value) || null }); },
});
const poolQuery = computed({
  get: () => queryText(routeQuery.value, 'poolQuery'),
  set: (value: string) => { void updateQuery({ poolQuery: value || null }, true); },
});
const pool = computed(() => {
  const q = normalize(poolQuery.value);
  return OPERATORS.filter(o => (!poolTier.value || o.tier === poolTier.value)
    && (!poolCovenant.value || o.covenants.includes(poolCovenant.value))
    && (!q || nameScore(o.name, q) > 0 || o.covenants.some(c => c === poolQuery.value.trim())));
});
const poolGroups = computed(() => TIERS.map(tier => ({ tier, items: pool.value.filter(o => o.tier === tier) })).filter(g => g.items.length));
function poolDisabled(name: string): boolean {
  if (picking.value === 'alt') return inPlan.value.has(name) || !!slot.value?.alt.includes(name) || !slot.value || slot.value.alt.length >= MAX_ALT;
  if (compact.value && mobilePanel.value === 'replace') return inPlan.value.has(name);
  return !inPlan.value.has(name) && ops.value.length >= MAX_OPS;
}
const eqGroups = TIERS.map(tier => ({ tier, items: EQUIPMENT.filter(e => e.tier === tier) }));
const equipmentQuery = ref('');
const filteredEquipment = computed(() => {
  const query = normalize(equipmentQuery.value);
  return eqGroups.map(group => ({ ...group, items: group.items.filter(item => !query || nameScore(item.name, query) > 0 || item.effect.includes(equipmentQuery.value.trim())) }))
    .filter(group => group.items.length);
});
const stCategory = computed({
  get: () => Math.max(0, CATEGORY_IDS.indexOf(queryText(routeQuery.value, 'strategyCategory') as typeof CATEGORY_IDS[number])),
  set: (index: number) => { void updateQuery({ strategyCategory: CATEGORY_IDS[index] || null }); },
});
const stList = computed(() => { const c = STRATEGY_CATEGORIES[stCategory.value]; return STRATEGIES.filter(s => c === '全部' || (c === '阵营' ? isCoreCovenant(s.category) : s.category === c)); });

/* ---------- 分享 / 导入 / 对比 ---------- */
const panel = computed({
  get: () => queryText(routeQuery.value, 'panel'),
  set: (value: string) => { void updateQuery({ panel: value || null }); },
});
const openPanel = (name: typeof panel.value): void => { panel.value = panel.value === name ? '' : name; };
const other = computed({
  get: () => buildKey(queryText(routeQuery.value, 'compare')),
  set: (key: string) => { void updateQuery({ compare: key ? buildId(key) : null }); },
});
const otherPlan = computed<Plan | null>(() => presets.value.find(x => x.key === other.value)?.plan ?? null);
const onlyMine = computed(() => new Set(ops.value.map(o => o.name).filter(n => !otherPlan.value?.ops.some(o => o.name === n))));
const onlyOther = computed(() => new Set((otherPlan.value?.ops ?? []).map(o => o.name).filter(n => !inPlan.value.has(n))));
const shared = computed(() => ops.value.length - onlyMine.value.size);

</script>
<template>
  <div ref="root" :class="['pl', { 'pl-compact': compact }]">
    <PlannerSheet :open="compact && !!mobilePanel" :title="mobileTitle" :context="`${mobilePanel}:${slot?.name ?? ''}`" content-id="planner-mobile-content" :can-go-back="mobileCanGoBack" @close="closeMobilePanel" @back="backToSlot"/>
    <!-- 方案栏 -->
    <div class="pl-bar">
      <input v-model="plan.name" class="pl-name" maxlength="16" aria-label="流派名" @input="touch">
      <span class="pl-acts">
        <button type="button" :class="{ on: panel === 'share' }" :aria-expanded="panel === 'share'" :aria-controls="panel === 'share' ? 'planner-share' : undefined" @click="openPanel('share')">分享</button>
        <button type="button" :class="{ on: panel === 'compare' }" :aria-expanded="panel === 'compare'" :aria-controls="panel === 'compare' ? 'planner-compare' : undefined" @click="openPanel('compare')">对比</button>
        <i class="sep"></i>
        <button v-if="!compact" type="button" class="pri" @click="emit('done')">完成</button>
      </span>
    </div>

    <!-- 分享 -->
    <PlanSharePanel v-if="panel === 'share'" id="planner-share" :plan="plan"/>

    <!-- 对比 -->
    <section v-if="panel === 'compare'" id="planner-compare" class="pl-panel">
      <select v-model="other" aria-label="对比对象">
        <option value="">选择要对比的流派</option>
        <option v-for="x in presets.filter(x => x.plan.id !== plan.id)" :key="x.key" :value="x.key">{{ x.builtin ? '' : '我的 · ' }}{{ x.plan.name }}</option>
      </select>
      <template v-if="otherPlan">
        <div class="pl-diff"><span>相同 <b>{{ shared }}</b></span><span class="a">只在这边 <b>{{ onlyMine.size }}</b></span><span class="b">只在那边 <b>{{ onlyOther.size }}</b></span></div>
        <div class="pl-cmp">
          <PlanSummary :ops="ops" :strategy="plan.strategy" :note="plan.note" :layers="plan.layers" :title="plan.name" :highlight="onlyMine" compact/>
          <PlanSummary :ops="otherPlan.ops" :strategy="otherPlan.strategy" :note="otherPlan.note" :layers="otherPlan.layers" :title="otherPlan.name" :highlight="onlyOther" compact/>
        </div>
      </template>
    </section>

    <div class="pl-grid">
      <!-- 阵容 -->
      <section v-show="!compact || mobileSection === 'lineup'" id="planner-lineup" class="pl-card pl-lineup">
        <h4>阵容<span class="tag">{{ ops.length }} / {{ MAX_OPS }}</span><span class="hint">点头像编辑 · 小头像是备选</span></h4>
        <div class="pl-slots">
          <button v-for="(s, i) in ops" :key="s.name" type="button" :class="['pl-slot', { on: editing === i, el: s.elite, core: s.core }]" :aria-expanded="editing === i" :aria-controls="editing === i ? compact ? 'planner-mobile-content' : 'planner-slot-editor' : undefined" :aria-haspopup="compact ? 'dialog' : undefined" :data-t="OPERATOR[s.name].tier" :data-op="s.name" :style="{ '--i': i }" @click="editSlot(i)">
            <i class="no">{{ i + 1 }}</i>
            <span class="av"><img :src="avatarSrc(s.name)" alt="" width="56" height="56"><b class="tr" :title="`${OPERATOR[s.name].tier} 阶`">{{ TIER_LABELS[OPERATOR[s.name].tier] }}</b></span>
            <span class="nm"><b v-if="s.core" class="pl-core-mark" title="核心干员" aria-label="核心干员">★</b>{{ s.name }}</span>
            <span class="dots"><u v-for="c in OPERATOR[s.name].covenants" :key="c" :style="{ '--c': color(c) }"></u></span>
            <span v-if="s.eq.length" class="eqs"><img v-for="(e, k) in s.eq" :key="k" :src="equipIconSrc(e)" alt="" width="16" height="16"></span>
            <span v-if="s.alt.length" class="alts"><img v-for="a in s.alt" :key="a" :src="avatarSrc(a)" :data-t="OPERATOR[a].tier" alt="" width="18" height="18"></span>
          </button>
          <button v-for="k in MAX_OPS - ops.length" :key="`e${k}`" type="button" class="pl-slot empty" :aria-label="`添加第 ${ops.length + k} 名干员`" :aria-haspopup="compact ? 'dialog' : undefined" @click="openOperators()"><i class="no">{{ ops.length + k }}</i>+</button>
        </div>

        <Teleport :to="panelTarget" :disabled="!compact" defer>
        <div v-if="slot && (!compact || mobilePanel === 'slot' || mobilePanel === 'equipment')" id="planner-slot-editor" class="pl-edit">
          <template v-if="!compact || mobilePanel === 'slot'">
          <div class="pl-row">
            <b>{{ slot.name }}</b>
            <Segmented :labels="['初始', '精锐']" :active="slot.elite ? 1 : 0" attr="ple" @change="slot.elite = $event === 1; touch()"/>
            <button type="button" :class="['pl-core-toggle', { on: slot.core }]" :aria-pressed="slot.core" aria-label="核心干员" @click="slot.core = !slot.core; touch()">{{ slot.core ? '★ 核心' : '☆ 核心' }}</button>
            <span class="pl-move"><button type="button" aria-label="左移" :disabled="editing === 0" @click="move(-1)">‹</button><button type="button" aria-label="右移" :disabled="editing === ops.length - 1" @click="move(1)">›</button></span>
            <button type="button" class="dg" @click="removeSlot">移出</button>
            <button v-if="compact" type="button" @click="openOperators(true)">更换</button>
          </div>
          <p class="pl-trait" v-html="fx(slot.elite ? OPERATOR[slot.name].elite : OPERATOR[slot.name].trait)"></p>
          <div class="pl-row pl-eqs">
            <span class="k">装备</span>
            <button v-for="(e, k) in slot.eq" :key="k" type="button" class="pl-eq" :data-t="EQUIP[e].tier" :data-eq="e" @click="dropEquip(k)"><img :src="equipIconSrc(e)" alt="" width="22" height="22">{{ e }}<i>×</i></button>
            <button v-if="slot.eq.length < MAX_EQ" type="button" :class="['pl-eq', 'add', { on: picking === 'eq' }]" :aria-expanded="picking === 'eq'" :aria-controls="picking === 'eq' ? 'planner-equipment' : undefined" @click="openPicker('eq')">+ 装备</button>
          </div>
          <div class="pl-row pl-alts">
            <span class="k">备选</span>
            <span v-for="(a, k) in slot.alt" :key="a" class="pl-alt" :data-t="OPERATOR[a].tier" :data-op="a">
              <button type="button" :disabled="inPlan.has(a)" :title="inPlan.has(a) ? '已在阵容里' : '换上场'" @click="swapAlt(k)"><img :src="avatarSrc(a)" alt="" width="24" height="24">{{ a }}<b>⇄</b></button>
              <button type="button" class="x" aria-label="移除备选" @click="dropAlt(k)">×</button>
            </span>
            <button v-if="slot.alt.length < MAX_ALT" type="button" :class="['pl-eq', 'add', { on: picking === 'alt' }]" :aria-expanded="picking === 'alt'" :aria-controls="picking === 'alt' ? 'planner-alternatives' : undefined" @click="openPicker('alt')">+ 备选</button>
          </div>
          <div v-if="!compact && picking === 'alt'" id="planner-alternatives" class="pl-pick pl-altpick">
            <span class="hint">同盟约、等阶相近 · 也可以在干员列表里点选</span>
            <div class="pl-pick-g"><button v-for="o in altSuggest" :key="o.name" type="button" :data-t="o.tier" :data-op="o.name" @click="addAlt(o.name)"><img :src="avatarSrc(o.name)" alt="" width="34" height="34" loading="lazy"><small>{{ o.name }}</small><span class="dots"><u v-for="c in o.covenants" :key="c" :style="{ '--c': color(c) }"></u></span></button></div>
          </div>
          </template>
          <div v-if="picking === 'eq'" id="planner-equipment" class="pl-pick">
            <input v-if="compact" v-model="equipmentQuery" type="search" class="pl-paste" placeholder="装备名字 / 拼音 / 效果" aria-label="搜索装备">
            <div v-for="g in compact ? filteredEquipment : eqGroups" :key="g.tier" class="pl-pick-g"><i class="tier" :data-t="g.tier">{{ TIER_LABELS[g.tier] }}</i>
              <button v-for="e in g.items" :key="e.name" type="button" :data-t="e.tier" :data-eq="e.name" :title="e.name" @click="addEquip(e.name)"><img :src="equipIconSrc(e.name)" alt="" width="30" height="30" loading="lazy"><small v-if="compact">{{ e.name }}</small></button>
            </div>
            <p v-if="compact && !filteredEquipment.length" class="empty">没有匹配的装备</p>
          </div>
        </div>
        </Teleport>

        <div class="pl-stats">
          <span><b>{{ cost.recruit }}</b>招募</span>
          <span><b>{{ cost.equipment }}</b>装备</span>
          <span><b>{{ active.length }}</b>激活盟约</span>
          <span><b>{{ cost.elites }}</b>精锐</span>
        </div>

        <div class="pl-st">
          <button type="button" :class="['pl-st-b', { on: picking === 'st' }]" :aria-expanded="picking === 'st'" :aria-controls="picking === 'st' ? 'planner-strategies' : undefined" :data-st="strategy?.name" @click="openPicker('st')">
            <img v-if="strategy" :src="portraitSrc(strategy.name)" alt="" width="36" height="36"><span v-else class="ph">+</span>
            <span><small>策略</small><b>{{ strategy ? `${strategy.name}` : '选择策略' }}</b></span>
          </button>
          <p v-if="strategy" v-html="fx(strategy.effect)"></p>
        </div>
        <Teleport :to="panelTarget" :disabled="!compact" defer>
        <div v-if="picking === 'st'" id="planner-strategies" class="pl-pick stp">
          <Segmented :labels="STRATEGY_CATEGORIES" :active="stCategory" attr="plsc" @change="stCategory = $event"/>
          <div class="pl-pick-g"><button v-for="s in stList" :key="s.name" type="button" :class="{ on: s.name === plan.strategy }" :aria-pressed="s.name === plan.strategy" :data-st="s.name" @click="pickStrategy(s.name)"><img :src="portraitSrc(s.name)" alt="" width="34" height="34" loading="lazy"><small>{{ s.name }}</small></button></div>
        </div>
        </Teleport>
        <details class="pl-note-fold" :open="!compact">
          <summary v-show="compact">流派说明 <span class="hint">{{ plan.note.length }}/{{ MAX_NOTE }}</span></summary>
        <label class="pl-note"><span class="k">流派说明</span><textarea v-model="plan.note" :maxlength="MAX_NOTE" rows="4" placeholder="核心思路、靠谁输出、前期怎么过渡、几层转型、抓不到核心时怎么换" aria-label="流派说明" @input="touch"></textarea><small>{{ plan.note.length }}/{{ MAX_NOTE }}</small></label>
        </details>
      </section>

      <!-- 盟约 -->
      <section v-show="!compact || mobileSection === 'effects'" id="planner-covenants" class="pl-card pl-cov">
        <h4>盟约<span class="tag">{{ active.length }} 激活</span></h4>
        <PlanCovenants :stats="stats" :layers="plan.layers"/>
      </section>

      <!-- 补位 -->
      <section v-if="recs.length" v-show="!compact || mobileSection === 'lineup'" class="pl-card pl-rec">
        <h4>补谁<span class="hint">加入后跨过的门槛</span></h4>
        <div class="pl-recs">
          <button v-for="r in recs" :key="r.op.name" type="button" class="pl-r" :data-t="r.op.tier" :data-op="r.op.name" @click="toggle(r.op.name)">
            <img :src="avatarSrc(r.op.name)" alt="" width="40" height="40" loading="lazy">
            <span><b>{{ r.op.name }}</b><span class="g"><i v-for="g in r.gains" :key="g.covenant" :class="g.kind === 'weaken' ? 'off' : g.kind" :style="{ '--c': color(g.covenant) }">{{ g.covenant }} {{ GAIN[g.kind] }}</i></span></span>
          </button>
        </div>
      </section>

      <!-- 效果 -->
      <section v-show="!compact || mobileSection === 'effects'" id="planner-effects" class="pl-card pl-fx">
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
      <Teleport :to="panelTarget" :disabled="!compact" defer>
      <section v-if="!compact || mobilePoolOpen" class="pl-card pl-pool">
        <h4>干员<span class="tag">{{ pool.length }}</span><span class="hint">★ 能推进已有盟约</span></h4>
        <div v-if="picking === 'alt' && slot" class="pl-altbar"><span>点选干员 → 加为 <b>{{ slot.name }}</b> 的备选（{{ slot.alt.length }}/{{ MAX_ALT }}）</span><button type="button" @click="compact ? backToSlot() : openPicker('alt')">完成</button></div>
        <div v-if="compact && mobilePanel === 'operators' && ops.length" class="pl-selected" aria-label="已选干员">
          <button v-for="member in ops" :key="member.name" type="button" :aria-label="`移出 ${member.name}`" @click="toggle(member.name)">{{ member.name }} ×</button>
        </div>
        <div class="pl-filter">
          <input v-model="poolQuery" type="search" placeholder="名字 / 拼音" aria-label="搜索干员">
          <select v-model="poolCovenant" aria-label="盟约"><option value="">全部盟约</option><option v-for="name in ALL_COVENANTS" :key="name">{{ name }}</option></select>
          <Segmented :labels="['全部', ...TIER_LABELS.slice(1)]" :active="poolTier" attr="plt" @change="poolTier = $event"/>
        </div>
        <div v-if="compact && picking === 'alt' && altSuggest.length && !poolQuery && !poolCovenant && !poolTier" class="pl-pick pl-altpick">
          <h4>推荐备选</h4>
          <div class="pl-pick-g"><button v-for="o in altSuggest" :key="o.name" type="button" :data-t="o.tier" :data-op="o.name" :disabled="poolDisabled(o.name)" @click="addAlt(o.name)"><img :src="avatarSrc(o.name)" alt="" width="34" height="34" loading="lazy"><small>{{ o.name }}</small></button></div>
        </div>
        <template v-for="g in poolGroups" :key="g.tier">
          <div class="tierh" :data-t="g.tier"><i>{{ TIER_LABELS[g.tier] }}</i><span>{{ g.items.length }}</span></div>
          <div class="pl-tiles">
            <button v-for="o in g.items" :key="o.name" type="button" :class="['tile', { in: inPlan.has(o.name), alt: slot?.alt.includes(o.name), rec: !inPlan.has(o.name) && o.covenants.some(c => present.has(c)) }]" :data-t="o.tier" :data-op="o.name" :aria-pressed="picking === 'alt' ? !!slot?.alt.includes(o.name) : inPlan.has(o.name)" :disabled="poolDisabled(o.name)" @click="toggle(o.name)">
              <img :src="avatarSrc(o.name)" alt="" width="80" height="80" loading="lazy" decoding="async">
              <span>{{ o.name }}</span><span class="dots"><u v-for="c in o.covenants" :key="c" :style="{ '--c': color(c) }"></u></span>
            </button>
          </div>
        </template>
        <div v-if="!pool.length" class="empty">—</div>
      </section>
      </Teleport>
    </div>
    <nav v-if="compact" class="pl-mobile-actions" aria-label="流派编辑操作" data-noswipe>
      <button type="button" :class="{ on: mobileSection === 'lineup' }" :aria-pressed="mobileSection === 'lineup'" aria-controls="planner-lineup" @click="showSection('lineup')">阵容</button>
      <button type="button" :class="{ on: mobileSection === 'effects' }" :aria-pressed="mobileSection === 'effects'" aria-controls="planner-covenants planner-effects" @click="showSection('effects')">盟约·层数</button>
      <button type="button" aria-haspopup="dialog" @click="openOperators()">＋ 干员</button>
      <button type="button" class="pri" @click="emit('done')">完成</button>
    </nav>
  </div>
</template>
