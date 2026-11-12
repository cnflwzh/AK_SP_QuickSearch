<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  OPERATORS, OPERATOR, EQUIPMENT, EQUIP, STRATEGIES, STRATEGY, STRATEGY_CATEGORIES, COVENANTS, ALL_COVENANTS,
  TIERS, TIER_LABELS, isCoreCovenant,
} from '../../../data/index.ts';
import { avatarSrc, equipIconSrc, portraitSrc } from '../../lib/assets.ts';
import { nameScore, normalize } from '../../lib/match.ts';
import {
  LAYER_SLIDER, MAX_ALT, MAX_EQ, MAX_LAYERS, MAX_NOTE, MAX_OPS, alternatesFor, usesLayers, atLayers, newSlot, encodePlan, equipNotes,
  planCost, shareUrl, suggestions, type Plan, type PlanOp,
} from '../../lib/planner.ts';
import { presets, editingId, plan, touch, planOps as ops, inPlan, planStats as stats } from '../planStore.ts';
import { color, fx } from '../format.ts';
import Segmented from '../components/Segmented.vue';
import PlanCovenants from '../components/PlanCovenants.vue';
import PlanSummary from '../components/PlanSummary.vue';
/**
 * 流派编辑（规划器）：从全部干员里排 8 人，实时看盟约进度、效果和补位推荐；
 * 编辑的是流派页当前选中的预设，可用分享码 / 链接 / 图片分享，或与另一套对比。
 */
const emit = defineEmits<{ done: [] }>();
watch(editingId, () => { editing.value = -1; picking.value = ''; });

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
const altSuggest = computed(() => slot.value ? alternatesFor(slot.value, ops.value, 8, plan.value.layers) : []);
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
  s.name = next; s.elite = false; s.core = false;
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
const recs = computed(() => suggestions(ops.value, 8, plan.value.layers));
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
const panel = ref<'' | 'share' | 'compare'>('');
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
const other = ref('');
const otherPlan = computed<Plan | null>(() => presets.value.find(x => x.key === other.value)?.plan ?? null);
const onlyMine = computed(() => new Set(ops.value.map(o => o.name).filter(n => !otherPlan.value?.ops.some(o => o.name === n))));
const onlyOther = computed(() => new Set((otherPlan.value?.ops ?? []).map(o => o.name).filter(n => !inPlan.value.has(n))));
const shared = computed(() => ops.value.length - onlyMine.value.size);

</script>
<template>
  <div class="pl">
    <!-- 方案栏 -->
    <div class="pl-bar">
      <input v-model="plan.name" class="pl-name" maxlength="16" aria-label="流派名" @input="touch">
      <span class="pl-acts">
        <button type="button" :class="{ on: panel === 'share' }" @click="openPanel('share')">分享</button>
        <button type="button" :class="{ on: panel === 'compare' }" @click="openPanel('compare')">对比</button>
        <i class="sep"></i>
        <button type="button" class="pri" @click="emit('done')">完成</button>
      </span>
    </div>

    <!-- 分享 -->
    <section v-if="panel === 'share'" class="pl-panel">
      <div class="pl-code"><span class="k">分享码</span><code>{{ code }}</code><button type="button" @click="copy(code, 'code')">{{ copied === 'code' ? '已复制' : '复制' }}</button></div>
      <div class="pl-code"><span class="k">链接</span><code>{{ link }}</code><button type="button" @click="copy(link, 'link')">{{ copied === 'link' ? '已复制' : '复制' }}</button></div>
      <div class="pl-code"><span class="k">图片</span><span class="hint">干员、装备、盟约，附二维码，扫码即导入</span><button type="button" :disabled="imageBusy || !ops.length" @click="saveImage">{{ imageBusy ? '生成中…' : '生成图片' }}</button></div>
    </section>

    <p v-if="imageError && panel === 'share'" class="pl-warn" role="status">{{ imageError }}</p>

    <!-- 对比 -->
    <section v-if="panel === 'compare'" class="pl-panel">
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
      <section class="pl-card pl-lineup">
        <h4>阵容<span class="tag">{{ ops.length }} / {{ MAX_OPS }}</span><span class="hint">点头像编辑 · 小头像是备选</span></h4>
        <div class="pl-slots">
          <button v-for="(s, i) in ops" :key="s.name" type="button" :class="['pl-slot', { on: editing === i, el: s.elite, core: s.core }]" :data-t="OPERATOR[s.name].tier" :data-op="s.name" :style="{ '--i': i }" @click="editSlot(i)">
            <i class="no">{{ i + 1 }}</i>
            <span class="av"><img :src="avatarSrc(s.name)" alt="" width="56" height="56"><b class="tr" :title="`${OPERATOR[s.name].tier} 阶`">{{ TIER_LABELS[OPERATOR[s.name].tier] }}</b></span>
            <span class="nm"><b v-if="s.core" class="pl-core-mark" title="核心干员" aria-label="核心干员">★</b>{{ s.name }}</span>
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
            <button type="button" :class="['pl-core-toggle', { on: slot.core }]" :aria-pressed="slot.core" aria-label="核心干员" @click="slot.core = !slot.core; touch()">{{ slot.core ? '★ 核心' : '☆ 核心' }}</button>
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
      <section v-if="recs.length" class="pl-card pl-rec">
        <h4>补谁<span class="hint">加入后跨过的门槛</span></h4>
        <div class="pl-recs">
          <button v-for="r in recs" :key="r.op.name" type="button" class="pl-r" :data-t="r.op.tier" :data-op="r.op.name" @click="toggle(r.op.name)">
            <img :src="avatarSrc(r.op.name)" alt="" width="40" height="40" loading="lazy">
            <span><b>{{ r.op.name }}</b><span class="g"><i v-for="g in r.gains" :key="g.covenant" :class="g.kind" :style="{ '--c': color(g.covenant) }">{{ g.covenant }} {{ GAIN[g.kind] }}</i></span></span>
          </button>
        </div>
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
