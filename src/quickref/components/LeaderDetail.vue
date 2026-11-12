<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { LEADER_MAP, LEADER_BATTLEFIELDS, MODES, ROUND_TIME, type Leader } from '../../../data/index.ts';
import { leaderSrc } from '../../lib/assets.ts';
import { prefersReducedMotion, wan } from '../../lib/dom.ts';
import { abilityLabel, counterClass, damageClass, leaderFx, patrols } from '../../lib/leader.ts';
import { state, setLeader } from '../state.ts';
import Segmented from './Segmented.vue';
import LeaderMap from './LeaderMap.vue';
/**
 * 领袖详情：技能、对策、站位图与随行敌人、生命值。
 * 生命条按该领袖自身（含隐秘核心）的最大值缩放；秒伤 = 生命 ÷ 领袖回合时限。
 */
const props = defineProps<{ leader: Leader }>();
const LIMIT = ROUND_TIME[ROUND_TIME.length - 1];
const rows = computed(() => MODES.map((label, i) => ({
  label, hp: props.leader.hp[i], hidden: i > 0 && props.leader.hiddenCore ? props.leader.hiddenCore[i - 1] : 0,
})));
const max = computed(() => Math.max(...rows.value.map(r => Math.max(r.hp, r.hidden))));
const now = computed(() => rows.value[state.mode]);
const dps = (hp: number) => wan(Math.ceil(hp / LIMIT));
/** 0 领袖回合 · 1 隐秘核心回合 */
const view = ref(0);
const hiddenView = computed(() => !!view.value && !!props.leader.hiddenStage);
const stage = computed(() => hiddenView.value ? props.leader.hiddenStage! : props.leader.stage);
/** 0 我方站位 · 1 敌人路线 */
const mapMode = computed({ get: () => state.leaderMapMode, set: value => { state.leaderMapMode = value; } });
const terrain = computed(() => mapMode.value
  ? LEADER_BATTLEFIELDS.find(map => map.id === state.leaderTerrain) ?? LEADER_BATTLEFIELDS[0]
  : LEADER_BATTLEFIELDS[0]);
const sides = ['left', 'all', 'right'] as const;
const side = computed(() => sides[state.leaderMapSide] ?? 'left');
const paused = ref(false), rate = ref(1), replay = ref(0);
const mapPicker = ref<HTMLDetailsElement>(), pickerOpen = ref(false);
/** 只改变路线地形；示例部署始终保留在原始场地 01。 */
function chooseTerrain(id: string): void {
  state.leaderTerrain = id;
  if (mapPicker.value) mapPicker.value.open = false;
}
function restartRoute(): void { replay.value++; paused.value = false; }
const mapChoices = LEADER_BATTLEFIELDS.map(map => ({
  ...map, tiles: map.grid.flatMap((row, y) => [...row].map((ch, x) => ({ x, y, ch }))),
}));
const sceneIndex = ref(0);
watch(() => props.leader.id, () => { view.value = 0; sceneIndex.value = 0; });
watch(view, () => { sceneIndex.value = 0; });
const layout = computed(() => mapMode.value ? null : hiddenView.value ? props.leader.hiddenLayout ?? props.leader.layout : props.leader.layout);
const scene = computed(() => layout.value?.zones[sceneIndex.value] ?? layout.value?.zones[0]);
const targetMarks = computed(() => layout.value?.slots.filter(slot => scene.value?.targets?.some(([x, y]) => x === slot.at[0] && y === slot.at[1])).map(slot => slot.mark).filter(Boolean) ?? []);
const ROLES = [['坦', '阻挡 / 承伤'], ['输', '主输出'], ['疗', '治疗'], ['空', '对空 / 远程'], ['群', '群攻']] as const;
const ROLE_CLASS: Record<string, string> = { 坦: 'tk', 输: 'dp', 疗: 'hl', 空: 'aa', 群: 'ao' };
const usedRoles = computed(() => ROLES.filter(([role]) => layout.value?.slots.some(slot => slot.role === role)));
const escorts = computed(() => [...stage.value.escorts, ...LEADER_MAP.common]);
const counters = computed(() => props.leader.counters.filter(c => !c.hidden));
const hiddenCounters = computed(() => props.leader.counters.filter(c => c.hidden));
const portrait = computed(() => leaderSrc(props.leader.name));
</script>
<template>
  <article class="lwd" :data-key="`ldd:${leader.name}`">
    <header class="lwd-h">
      <button type="button" class="lw-back" aria-label="返回领袖列表" @click="setLeader('')">‹</button>
      <img class="lw-pic" :src="portrait" alt="" width="64" height="64" decoding="async">
      <div class="lwd-t">
        <h3>{{ leader.name }}</h3>
        <div class="row"><i v-for="damage in leader.damage" :key="damage" :class="['ldt', damageClass(damage)]">{{ damage }}</i><i v-if="patrols(leader)" class="lwb pt">巡逻</i><i v-if="leader.hiddenCore" class="lwb hc">隐秘核心</i></div>
      </div>
      <div class="lwd-now">
        <b>{{ wan(now.hp) }}</b><span>{{ now.label }} · 120秒均伤 <em>{{ dps(now.hp) }}</em>/秒</span>
      </div>
    </header>

    <section class="lws ab">
      <h4>技能</h4>
      <div class="lc-ab"><div v-for="(ability, i) in leader.abilities" :key="i" :class="['lr', { sk: ability.skill }]"><span>{{ abilityLabel(ability.skill) }}</span><div v-html="leaderFx(ability.text)"></div></div></div>
      <template v-if="leader.hiddenAbilities.length">
        <h5>隐秘核心</h5>
        <div class="lc-ab hc"><div v-for="(ability, i) in leader.hiddenAbilities" :key="i" :class="['lr', { sk: ability.skill }]"><span>{{ abilityLabel(ability.skill, true) }}</span><div v-html="leaderFx(ability.text)"></div></div></div>
      </template>
    </section>

    <section class="lws ct">
      <h4>对策</h4>
      <p class="leader-section-note">对策是 AI 根据 Boss 技能推测而得出的，并不代表真实的游玩建议。</p>
      <ul class="lwc">
        <li v-for="(c, i) in counters" :key="i" :style="{ '--i': i }"><i :class="['ctg', counterClass(c.tag)]">{{ c.tag }}</i><span v-html="leaderFx(c.text)"></span><small>{{ c.by }}</small></li>
      </ul>
      <template v-if="hiddenCounters.length">
        <h5>隐秘核心</h5>
        <ul class="lwc hc">
          <li v-for="(c, i) in hiddenCounters" :key="i" :style="{ '--i': i + counters.length }"><i :class="['ctg', counterClass(c.tag)]">{{ c.tag }}</i><span v-html="leaderFx(c.text)"></span><small>{{ c.by }}</small></li>
        </ul>
      </template>
    </section>

    <section class="lws mp">
      <h4>站位图<span class="lwsw"><Segmented :labels="['部署站位', '敌人路线']" :active="mapMode" attr="lwm" @change="mapMode = $event"/><Segmented v-if="leader.hiddenStage" :labels="['领袖', '隐秘核心']" :active="view" attr="lwv" @change="view = $event"/></span></h4>
      <p class="leader-section-note">该站位图中的干员摆放以及敌人行进路线仅供站位参考，并不代表实际游玩中的真实内容。</p>
      <div v-if="layout" class="map-skills" role="group" aria-label="选择技能范围">
        <button v-for="(z, i) in layout.zones" :key="z.label" type="button" :class="{ on: scene === z, hc: z.tone === 'hc' }" :aria-pressed="scene === z" @click="sceneIndex = i">{{ z.label }}</button>
      </div>
      <div v-if="mapMode" class="map-controls">
        <details ref="mapPicker" class="map-picker" @toggle="pickerOpen = ($event.target as HTMLDetailsElement).open">
          <summary>{{ terrain.name }}<span aria-hidden="true">⌄</span></summary>
          <div v-if="pickerOpen" class="map-options" role="group" aria-label="选择实际场地">
            <button v-for="option in mapChoices" :key="option.id" type="button" :class="{ on: option.id === terrain.id }" :aria-pressed="option.id === terrain.id" @click="chooseTerrain(option.id)">
              <svg viewBox="0 0 170 60" aria-hidden="true">
                <rect v-for="t in option.tiles" :key="t.x + ',' + t.y" :x="t.x * 10" :y="t.y * 10" width="9" height="9" :class="['mini-tile', { wall: t.ch === '#', barrier: 'BHb'.includes(t.ch), gate: t.ch === 'E', special: 'IMGV'.includes(t.ch) }]"/>
                <rect v-for="([x, y], i) in option.crates" :key="'c' + i" :x="x * 10 + 1" :y="y * 10 + 1" width="7" height="7" class="mini-crate"/>
                <rect v-for="([x, y], i) in option.platforms" :key="'p' + i" :x="x * 10 + 1" :y="y * 10 + 1" width="7" height="7" class="mini-platform"/>
              </svg>
              <span>{{ option.name }}</span>
            </button>
          </div>
        </details>
        <Segmented :labels="['左侧', '全场', '右侧']" :active="state.leaderMapSide" attr="map-side" @change="state.leaderMapSide = $event"/>
        <div v-if="!prefersReducedMotion" class="map-playback" role="group" aria-label="路线播放">
          <button type="button" :aria-pressed="paused" @click="paused = !paused">{{ paused ? '继续' : '暂停' }}</button>
          <button type="button" @click="restartRoute">重播</button>
          <select v-model.number="rate" aria-label="路线播放速度"><option :value="1">1× 基础移速</option><option :value="2">2×</option><option :value="4">4×</option></select>
        </div>
      </div>
      <div class="map-terrain-key"><b>{{ mapMode ? terrain.name : LEADER_MAP.name }}</b><span><i class="terrain-road"></i>地面</span><span title="地面敌人不可通行，可部署干员"><i class="terrain-barrier"></i>地形障碍</span><span><i class="terrain-crate"></i>阻隔工事</span><span><i class="terrain-wall"></i>禁行</span></div>
      <LeaderMap :stage="stage" :layout="layout" :scene="scene" :portrait="portrait" :terrain="terrain" :side="side" :rate="rate" :paused="paused" :replay="replay"/>
      <div v-if="scene" class="map-reading" aria-live="polite">
        <div v-if="targetMarks.length" class="map-targets"><span>目标</span><b v-for="mark in targetMarks" :key="mark">{{ mark }}</b></div>
        <p>{{ scene.hint }}</p>
      </div>
      <div v-if="layout" class="lwlg ops">
        <span v-for="[role, desc] in usedRoles" :key="role"><i :class="['op', ROLE_CLASS[role]]">{{ role }}</i>{{ desc }}</span>
        <span v-if="scene"><i :class="[scene.shape.kind === 'line' ? 'zl' : 'zn', scene.tone ?? 'red']"></i>{{ scene.label }}</span>
      </div>
      <div v-else class="lwlg">
        <span><i class="b"></i>领袖</span><span v-if="patrols(leader)"><i class="pt"></i>巡逻</span>
        <span><i class="w"></i>地面</span><span><i class="f"></i>飞行</span>
        <span v-if="stage.marks.some(m => m.kind !== 'boss')"><i class="u"></i>特殊单位</span>
        <span><i class="s"></i>敌人入场</span><span><i class="x"></i>蓝门</span>
      </div>
      <h5 class="escort-heading">随行敌人<span>联合全场</span></h5>
      <ul class="lwe">
        <li v-for="e in escorts" :key="e.name"><b>{{ e.name }}</b><span class="n">×{{ e.count }}</span><i v-if="e.fly" class="lwb fl">飞行</i><span v-if="e.note" class="note" v-html="leaderFx(e.note)"></span></li>
      </ul>
    </section>

    <section class="lws hp">
      <h4>生命值<span class="tag">时限 {{ LIMIT }} 秒 · 超时每秒 −1</span></h4>
      <div class="lwhp">
        <button v-for="(r, i) in rows" :key="r.label" type="button" :class="['r', { on: i === state.mode }]" :aria-pressed="i === state.mode" @click="state.mode = i">
          <span class="k">{{ r.label }}</span>
          <span class="trk">
            <i class="m" :style="{ width: r.hp / max * 100 + '%', '--d': i * .06 + 's' }"></i>
            <i v-if="r.hidden" class="h" :style="{ width: r.hidden / max * 100 + '%', '--d': i * .06 + .1 + 's' }"></i>
          </span>
          <span class="v"><b>{{ wan(r.hp) }}</b><small>{{ dps(r.hp) }}/秒</small></span>
          <span v-if="r.hidden" class="v hc"><b>{{ wan(r.hidden) }}</b><small>{{ dps(r.hidden) }}/秒</small></span>
          <span v-else-if="leader.hiddenCore" class="v hc none">—</span>
        </button>
      </div>
      <div v-if="leader.hiddenCore" class="lgd"><span><i class="m"></i>领袖</span><span><i class="h"></i>隐秘核心</span></div>
    </section>
  </article>
</template>
