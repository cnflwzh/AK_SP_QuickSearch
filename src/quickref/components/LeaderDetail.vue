<script setup lang="ts">
import {computed, nextTick, ref, shallowRef} from 'vue';
import {
  ENEMY_GLOSSARY,
  LEADER_MAP,
  LEADER_BATTLEFIELDS,
  MODES,
  ROUND_TIME,
  type EnemyTerm,
  type LeaderCounter,
  type Leader,
} from '../../../data/index.ts';
import {leaderSrc} from '../../lib/ui/assets.ts';
import {prefersReducedMotion, wan} from '../../lib/ui/dom.ts';
import {nameScore, normalize} from '../../lib/ui/match.ts';
import {
  abilityLabel,
  counterClass,
  damageClass,
  leaderFx,
  leaderGlossaryTerms,
  normalizeTermKey,
  patrols,
} from '../../lib/leaders/leader.ts';
import {routeQuery, updateQuery} from '../../router/navigation.ts';
import {queryText} from '../../router/location.ts';
import {runLeaderKey, setRunLeader} from '../planStore.ts';
import {state, setLeader} from '../state.ts';
import Segmented from './Segmented.vue';
import SelectInput, {type SelectOption} from './SelectInput.vue';
import SubTabs, {type SubTabItem} from './SubTabs.vue';
import CopyButton from './CopyButton.vue';
import SearchInput from './SearchInput.vue';
import EmptyState from './EmptyState.vue';
import LeaderMap from './LeaderMap.vue';
import CounterLookupPanel from './CounterLookupPanel.vue';

const TERRAIN_OPTIONS: readonly SelectOption<string>[] =
  LEADER_BATTLEFIELDS.map((option) => ({value: option.id, label: option.name}));

const MAP_MODE_TABS: readonly SubTabItem<number>[] = [
  {id: 0, label: '部署站位'},
  {id: 1, label: '敌人路线'},
];
const STAGE_VIEW_TABS: readonly SubTabItem<number>[] = [
  {id: 0, label: '领袖'},
  {id: 1, label: '隐秘核心'},
];
/**
 * 领袖详情：技能、对策、站位图与随行敌人、生命值。
 * 生命条按该领袖自身（含隐秘核心）的最大值缩放；秒伤 = 生命 ÷ 领袖回合时限。
 */
const props = defineProps<{leader: Leader}>();
const LIMIT = ROUND_TIME[ROUND_TIME.length - 1];
const rows = computed(() =>
  MODES.map((label, i) => ({
    label,
    hp: props.leader.hp[i],
    hidden:
      i > 0 && props.leader.hiddenCore ? props.leader.hiddenCore[i - 1] : 0,
  })),
);
const max = computed(() =>
  Math.max(...rows.value.map((r) => Math.max(r.hp, r.hidden))),
);
const now = computed(() => rows.value[state.mode]);
const dps = (hp: number) => wan(Math.ceil(hp / LIMIT));
/** 0 领袖回合 · 1 隐秘核心回合 */
const view = computed({
  get: () => (queryText(routeQuery.value, 'round') === 'hidden' ? 1 : 0),
  set: (value: number) => {
    void updateQuery({round: value ? 'hidden' : null, skill: null});
  },
});
const hiddenView = computed(() => !!view.value && !!props.leader.hiddenStage);
const stage = computed(() =>
  hiddenView.value ? props.leader.hiddenStage! : props.leader.stage,
);
/** 0 我方站位 · 1 敌人路线 */
const mapMode = computed({
  get: () => state.leaderMapMode,
  set: (value) => {
    state.leaderMapMode = value;
  },
});
const terrain = computed(() =>
  mapMode.value
    ? (LEADER_BATTLEFIELDS.find((map) => map.id === state.leaderTerrain) ??
      LEADER_BATTLEFIELDS[0])
    : LEADER_BATTLEFIELDS[0],
);
const sides = ['left', 'all', 'right'] as const;
const side = computed(() => sides[state.leaderMapSide] ?? 'left');
const layout = computed(() =>
  mapMode.value
    ? null
    : hiddenView.value
      ? (props.leader.hiddenLayout ?? props.leader.layout)
      : props.leader.layout,
);
const scene = computed(
  () =>
    layout.value?.zones.find(
      (zone) => zone.label === queryText(routeQuery.value, 'skill'),
    ) ?? layout.value?.zones[0],
);
const targetMarks = computed(
  () =>
    layout.value?.slots
      .filter((slot) =>
        scene.value?.targets?.some(
          ([x, y]) => x === slot.at[0] && y === slot.at[1],
        ),
      )
      .map((slot) => slot.mark)
      .filter(Boolean) ?? [],
);
const ROLES = [
  ['坦', '阻挡 / 承伤'],
  ['输', '主输出'],
  ['疗', '治疗'],
  ['空', '对空 / 远程'],
  ['群', '群攻'],
] as const;
const ROLE_CLASS: Record<string, string> = {
  坦: 'tk',
  输: 'dp',
  疗: 'hl',
  空: 'aa',
  群: 'ao',
};
const usedRoles = computed(() =>
  ROLES.filter(([role]) =>
    layout.value?.slots.some((slot) => slot.role === role),
  ),
);
const escorts = computed(() => [...stage.value.escorts, ...LEADER_MAP.common]);
const counters = computed(() => props.leader.counters.filter((c) => !c.hidden));
const hiddenCounters = computed(() =>
  props.leader.counters.filter((c) => c.hidden),
);
const glossaryItems = computed<readonly EnemyTerm[]>(() =>
  leaderGlossaryTerms(props.leader, ENEMY_GLOSSARY),
);
const knownTermMap = computed(() => {
  const map = new Map<string, string>();
  for (const item of glossaryItems.value) {
    map.set(normalizeTermKey(item.term), item.term);
  }
  return map;
});
const activeTerm = ref('');
const glossaryOpen = ref(false);
const glossaryQuery = ref('');
const glossaryKind = ref<'all' | EnemyTerm['kind']>('all');
const glossaryEl = ref<HTMLElement | null>(null);
const TERM_KIND_LABEL: Readonly<Record<EnemyTerm['kind'], string>> = {
  unit: '单位',
  status: '状态',
  mechanic: '机制',
};
const activeTermEntry = computed<EnemyTerm | null>(
  () =>
    glossaryItems.value.find((item) => item.term === activeTerm.value) ?? null,
);
const glossaryKindOptions = computed<
  readonly {id: 'all' | EnemyTerm['kind']; label: string}[]
>(() => {
  const present = new Set(glossaryItems.value.map((item) => item.kind));
  const options: {id: 'all' | EnemyTerm['kind']; label: string}[] = [
    {id: 'all', label: '全部'},
  ];
  for (const kind of ['unit', 'status', 'mechanic'] as const) {
    if (present.has(kind))
      options.push({id: kind, label: TERM_KIND_LABEL[kind]});
  }
  return options;
});
const glossaryKindIndex = computed(() => {
  const index = glossaryKindOptions.value.findIndex(
    (option) => option.id === glossaryKind.value,
  );
  return index >= 0 ? index : 0;
});
const filteredGlossaryItems = computed<readonly EnemyTerm[]>(() => {
  const q = normalize(glossaryQuery.value);
  return glossaryItems.value.filter((item) => {
    if (glossaryKind.value !== 'all' && item.kind !== glossaryKind.value) {
      return false;
    }
    if (!q) return true;
    return (
      nameScore(item.term, q) > 0 ||
      normalize(item.desc).includes(q) ||
      normalize(TERM_KIND_LABEL[item.kind]).includes(q)
    );
  });
});
function formatFx(text: string): string {
  return leaderFx(text, knownTermMap.value);
}
function termFor(raw: string): string | undefined {
  return knownTermMap.value.get(normalizeTermKey(raw));
}
function resetGlossaryFilter(): void {
  glossaryQuery.value = '';
  glossaryKind.value = 'all';
}
function scrollGlossaryTerm(matched: string): void {
  const target = glossaryEl.value?.querySelector<HTMLElement>(
    `[data-glossary="${CSS.escape(matched)}"]`,
  );
  target?.scrollIntoView({
    behavior: prefersReducedMotion() ? 'instant' : 'smooth',
    block: 'nearest',
  });
}
function toggleGlossary(): void {
  glossaryOpen.value = !glossaryOpen.value;
}
function openGlossaryFromPin(): void {
  const current = activeTerm.value;
  glossaryOpen.value = true;
  resetGlossaryFilter();
  if (!current) return;
  void nextTick(() => scrollGlossaryTerm(current));
}
function focusTerm(termName: string): void {
  const matched = knownTermMap.value.get(normalizeTermKey(termName));
  if (!matched) return;
  activeTerm.value = matched;
  if (glossaryOpen.value) {
    if (!filteredGlossaryItems.value.some((item) => item.term === matched)) {
      resetGlossaryFilter();
    }
    void nextTick(() => scrollGlossaryTerm(matched));
    return;
  }
  void nextTick(() => {
    glossaryEl.value?.scrollIntoView({
      behavior: prefersReducedMotion() ? 'instant' : 'smooth',
      block: 'nearest',
    });
  });
}
function onTermInteract(event: Event): void {
  const el =
    event.target instanceof Element
      ? event.target.closest<HTMLElement>('[data-term]')
      : null;
  if (!el?.dataset.term) return;
  event.preventDefault();
  focusTerm(el.dataset.term);
}
const activeCounter = shallowRef<LeaderCounter | null>(null);
function toggleCounterLookup(counter: LeaderCounter): void {
  activeCounter.value = activeCounter.value === counter ? null : counter;
}
const portrait = computed(() => leaderSrc(props.leader.name));
const isRunLeader = computed(() => runLeaderKey.value === props.leader.name);
function toggleRunLeader(): void {
  setRunLeader(isRunLeader.value ? '' : props.leader.name);
}
function leaderBriefText(): string {
  const hiddenPart = now.value.hidden
    ? ` · 隐秘核心 ${wan(now.value.hidden)}`
    : '';
  const summary = counters.value
    .slice(0, 3)
    .map((c) => `[${c.tag}] ${c.text.replace(/[<>{}]/g, '')}`)
    .join('；');
  return `${props.leader.name}（${now.value.label} ${wan(now.value.hp)} · 均伤 ${dps(now.value.hp)}/秒${hiddenPart}）\n档案：${props.leader.profile.attackMode}；${props.leader.profile.targeting}${summary ? `\n要点：${summary}` : ''}`;
}
</script>
<template>
  <article
    class="lwd"
    :data-key="`ldd:${leader.name}`"
    :data-leader="leader.name"
    @click="onTermInteract"
    @keydown.enter="onTermInteract"
    @keydown.space="onTermInteract">
    <header class="lwd-h">
      <button
        type="button"
        class="lw-back"
        aria-label="返回 Boss 列表"
        @click="setLeader('')">
        ‹
      </button>
      <img
        class="lw-pic"
        :src="portrait"
        alt=""
        width="64"
        height="64"
        decoding="async" />
      <div class="lwd-t">
        <h3>{{ leader.name }}</h3>
        <div class="row">
          <i
            v-for="damage in leader.damage"
            :key="damage"
            :class="['ldt', damageClass(damage)]">
            {{ damage }}
          </i>
          <button
            v-if="patrols(leader)"
            type="button"
            class="lwb pt lwb-btn"
            data-term="巡逻"
            title="点击查看「巡逻」说明"
            @click.stop="focusTerm('巡逻')">
            巡逻
          </button>
          <button
            v-if="leader.hiddenCore"
            type="button"
            class="lwb hc lwb-btn"
            data-term="隐秘核心"
            title="点击查看「隐秘核心」说明"
            @click.stop="focusTerm('隐秘核心')">
            隐秘核心
          </button>
        </div>
        <div class="lwd-acts">
          <button
            type="button"
            :class="['lw-act-btn', {on: isRunLeader}]"
            :aria-pressed="isRunLeader"
            @click="toggleRunLeader">
            {{ isRunLeader ? '✓ 本局 Boss' : '▶ 设为本局' }}
          </button>
          <CopyButton
            :text="leaderBriefText"
            label="复制要点"
            copied-label="已复制"
            variant="compact"
            prompt-title="复制发给好友的 Boss 要点"
            title="复制血量与前三条核心对策，方便发给没开语音的好友" />
        </div>
      </div>
      <div class="lwd-now">
        <b>{{ wan(now.hp) }}</b>
        <span>
          {{ now.label }} · {{ LIMIT }} 秒均伤
          <em>{{ dps(now.hp) }}</em>
          /秒
        </span>
      </div>
    </header>

    <!-- 战前档案速览：攻击方式、双抗参考、索敌规律、阻挡要求与核心速记 -->
    <section class="lws pf" aria-label="Boss 战斗档案">
      <div class="lwd-pf-grid">
        <div class="lwd-pf-cell">
          <small>攻击方式</small>
          <span>{{ leader.profile.attackMode }}</span>
        </div>
        <div class="lwd-pf-cell">
          <small>双抗参考</small>
          <span>{{ leader.profile.defense }}</span>
        </div>
        <div class="lwd-pf-cell">
          <small>索敌 / 仇恨</small>
          <span>{{ leader.profile.targeting }}</span>
        </div>
        <div class="lwd-pf-cell">
          <small>阻挡要求</small>
          <span>{{ leader.profile.blocking }}</span>
        </div>
      </div>
      <div class="lwd-pf-notes">
        <p class="lwd-pf-note">
          <b>战前速记</b>
          <span>{{ leader.profile.summary }}</span>
        </p>
        <p v-if="leader.profile.hiddenSummary" class="lwd-pf-note hc">
          <b>隐秘核心</b>
          <span>{{ leader.profile.hiddenSummary }}</span>
        </p>
      </div>
    </section>

    <section class="lws ab">
      <h4>
        技能与机制
        <span class="tag">悬停或点虚线词可查解释</span>
      </h4>
      <div class="lc-ab">
        <div
          v-for="(ability, i) in leader.abilities"
          :key="i"
          :class="['lr', {sk: ability.skill}]">
          <span>{{ abilityLabel(ability.skill) }}</span>
          <div v-html="formatFx(ability.text)"></div>
        </div>
      </div>
      <template v-if="leader.hiddenAbilities.length">
        <h5>隐秘核心</h5>
        <div class="lc-ab hc">
          <div
            v-for="(ability, i) in leader.hiddenAbilities"
            :key="i"
            :class="['lr', {sk: ability.skill}]">
            <span>{{ abilityLabel(ability.skill, true) }}</span>
            <div v-html="formatFx(ability.text)"></div>
          </div>
        </div>
      </template>

      <div
        v-if="glossaryItems.length"
        ref="glossaryEl"
        class="lwd-gloss"
        data-peek="off">
        <button
          type="button"
          :class="['lwd-gloss-toggle', {open: glossaryOpen}]"
          :aria-expanded="glossaryOpen"
          aria-controls="leader-glossary-panel"
          @click="toggleGlossary">
          <span class="lwd-gloss-title">
            <b>名词与单位解析</b>
            <span class="lwd-gloss-cnt">{{ glossaryItems.length }} 条</span>
            <small
              v-if="!glossaryOpen && !activeTermEntry"
              class="lwd-gloss-hint">
              悬停或点虚线词直查
            </small>
          </span>
          <span class="lwd-gloss-act">
            {{ glossaryOpen ? '收起' : '展开全部' }}
            <svg
              class="lwd-gloss-arrow"
              viewBox="0 0 12 12"
              width="11"
              height="11"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true">
              <path d="M2.5 4.5 6 8l3.5-3.5" />
            </svg>
          </span>
        </button>

        <div
          v-if="!glossaryOpen && activeTermEntry"
          :key="activeTermEntry.term"
          class="lwd-gloss-pin"
          role="region"
          :aria-label="`${activeTermEntry.term}名词解释`">
          <div class="lwd-gloss-pin-head">
            <i :class="['gloss-kind', activeTermEntry.kind]">
              {{ TERM_KIND_LABEL[activeTermEntry.kind] }}
            </i>
            <b>{{ activeTermEntry.term }}</b>
            <div class="lwd-gloss-pin-acts">
              <button
                type="button"
                class="lwd-gloss-mini"
                @click="openGlossaryFromPin">
                全部 {{ glossaryItems.length }} 条
              </button>
              <button
                type="button"
                class="lwd-gloss-close"
                aria-label="收起该名词解释"
                @click="activeTerm = ''">
                ✕
              </button>
            </div>
          </div>
          <p>{{ activeTermEntry.desc }}</p>
        </div>

        <div
          id="leader-glossary-panel"
          :class="['lwd-gloss-drawer', {open: glossaryOpen}]"
          :inert="!glossaryOpen || undefined"
          :aria-hidden="!glossaryOpen ? 'true' : undefined">
          <div class="lwd-gloss-drawer-inner">
            <div class="lwd-gloss-body">
              <div class="lwd-gloss-tools">
                <SearchInput
                  v-model="glossaryQuery"
                  placeholder="搜词条名或说明…"
                  aria-label="筛选当前 Boss 名词解释"
                  class="lwd-gloss-search" />
                <Segmented
                  v-if="glossaryKindOptions.length > 2"
                  :labels="glossaryKindOptions.map((option) => option.label)"
                  :active="glossaryKindIndex"
                  attr="gloss-kind"
                  @change="glossaryKind = glossaryKindOptions[$event].id" />
              </div>
              <dl v-if="filteredGlossaryItems.length" class="lwd-gloss-list">
                <div
                  v-for="entry in filteredGlossaryItems"
                  :key="entry.term"
                  :data-glossary="entry.term"
                  :class="['lwd-gloss-item', {on: activeTerm === entry.term}]"
                  @click="
                    activeTerm = activeTerm === entry.term ? '' : entry.term
                  ">
                  <dt>
                    <i :class="['gloss-kind', entry.kind]">
                      {{ TERM_KIND_LABEL[entry.kind] }}
                    </i>
                    <b>{{ entry.term }}</b>
                  </dt>
                  <dd>{{ entry.desc }}</dd>
                </div>
              </dl>
              <EmptyState
                v-else
                compact
                message="没有匹配的名词解释"
                action-label="清空筛选"
                @action="resetGlossaryFilter" />
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="lws ct">
      <h4>对策</h4>
      <p class="leader-section-note">
        点击带 ▾ 的对策标签，可按盟约展开对应干员与装备。
      </p>
      <ul class="lwc">
        <li v-for="(c, i) in counters" :key="i" :style="{'--i': i}">
          <button
            v-if="c.roles?.length"
            type="button"
            :class="[
              'ctg',
              'ctg-btn',
              counterClass(c.tag),
              {on: activeCounter === c},
            ]"
            :aria-expanded="activeCounter === c"
            :title="`查看「${c.by}」的对策干员与装备`"
            @click="toggleCounterLookup(c)">
            {{ c.tag }} ▾
          </button>
          <i v-else :class="['ctg', counterClass(c.tag)]">{{ c.tag }}</i>
          <span v-html="formatFx(c.text)"></span>
          <small>{{ c.by }}</small>
        </li>
      </ul>
      <template v-if="hiddenCounters.length">
        <h5>隐秘核心</h5>
        <ul class="lwc hc">
          <li
            v-for="(c, i) in hiddenCounters"
            :key="i"
            :style="{'--i': i + counters.length}">
            <button
              v-if="c.roles?.length"
              type="button"
              :class="[
                'ctg',
                'ctg-btn',
                counterClass(c.tag),
                {on: activeCounter === c},
              ]"
              :aria-expanded="activeCounter === c"
              :title="`查看「${c.by}」的对策干员与装备`"
              @click="toggleCounterLookup(c)">
              {{ c.tag }} ▾
            </button>
            <i v-else :class="['ctg', counterClass(c.tag)]">{{ c.tag }}</i>
            <span v-html="formatFx(c.text)"></span>
            <small>{{ c.by }}</small>
          </li>
        </ul>
      </template>
      <CounterLookupPanel
        v-if="activeCounter?.roles?.length"
        :key="activeCounter.text"
        :title="`对策：${activeCounter.tag}`"
        :subtitle="activeCounter.by"
        :roles="activeCounter.roles"
        @close="activeCounter = null" />
    </section>

    <section class="lws mp">
      <h4>
        站位图
        <span class="lwsw">
          <SubTabs
            v-model="mapMode"
            :items="MAP_MODE_TABS"
            :level="3"
            inline
            aria-label="站位图视图"
            attr="lwm" />
          <SubTabs
            v-if="leader.hiddenStage"
            v-model="view"
            :items="STAGE_VIEW_TABS"
            :level="3"
            inline
            aria-label="领袖阶段"
            attr="lwv" />
        </span>
      </h4>
      <p class="leader-section-note">
        该站位图中的干员摆放以及敌人行进路线仅供站位参考，并不代表实际游玩中的真实内容。
      </p>
      <div
        v-if="layout"
        class="map-skills"
        role="group"
        aria-label="选择技能范围">
        <button
          v-for="z in layout.zones"
          :key="z.label"
          type="button"
          :class="{on: scene === z, hc: z.tone === 'hc'}"
          :aria-pressed="scene === z"
          @click="updateQuery({skill: z.label})">
          {{ z.label }}
        </button>
      </div>
      <div v-if="mapMode" class="map-controls">
        <SelectInput
          v-model="state.leaderTerrain"
          :options="TERRAIN_OPTIONS"
          compact
          class="map-picker"
          aria-label="选择实际场地" />
        <Segmented
          :labels="['左侧', '全场', '右侧']"
          :active="state.leaderMapSide"
          attr="map-side"
          @change="state.leaderMapSide = $event" />
      </div>
      <div class="map-terrain-key">
        <b>{{ mapMode ? terrain.name : LEADER_MAP.name }}</b>
        <span>
          <i class="terrain-road"></i>
          地面
        </span>
        <span title="地面敌人不可通行，可部署干员">
          <i class="terrain-barrier"></i>
          地形障碍
        </span>
        <span>
          <i class="terrain-crate"></i>
          阻隔工事
        </span>
        <span>
          <i class="terrain-wall"></i>
          禁行
        </span>
      </div>
      <LeaderMap
        :stage="stage"
        :layout="layout"
        :scene="scene"
        :portrait="portrait"
        :terrain="terrain"
        :side="side" />
      <div v-if="scene" class="map-reading" aria-live="polite">
        <div v-if="targetMarks.length" class="map-targets">
          <span>目标</span>
          <b v-for="mark in targetMarks" :key="mark">{{ mark }}</b>
        </div>
        <p>{{ scene.hint }}</p>
      </div>
      <div v-if="layout" class="lwlg ops">
        <span v-for="[role, desc] in usedRoles" :key="role">
          <i :class="['op', ROLE_CLASS[role]]">{{ role }}</i>
          {{ desc }}
        </span>
        <span v-if="scene">
          <i
            :class="[
              scene.shape.kind === 'line' ? 'zl' : 'zn',
              scene.tone ?? 'red',
            ]"></i>
          {{ scene.label }}
        </span>
      </div>
      <div v-else class="lwlg">
        <span>
          <i class="b"></i>
          领袖
        </span>
        <span v-if="patrols(leader)">
          <i class="pt"></i>
          巡逻
        </span>
        <span>
          <i class="w"></i>
          地面
        </span>
        <span>
          <i class="f"></i>
          飞行
        </span>
        <span v-if="stage.marks.some((m) => m.kind !== 'boss')">
          <i class="u"></i>
          特殊单位
        </span>
        <span>
          <i class="s"></i>
          敌人入场
        </span>
        <span>
          <i class="x"></i>
          蓝门
        </span>
      </div>
      <h5 class="escort-heading">
        随行敌人
        <span>联合全场</span>
      </h5>
      <ul class="lwe">
        <li v-for="e in escorts" :key="e.name">
          <b
            :class="{'has-term': !!termFor(e.name)}"
            :data-term="termFor(e.name)"
            :tabindex="termFor(e.name) ? 0 : undefined"
            :role="termFor(e.name) ? 'button' : undefined">
            {{ e.name }}
          </b>
          <span class="n">×{{ e.count }}</span>
          <i v-if="e.fly" class="lwb fl">飞行</i>
          <span v-if="e.note" class="note" v-html="formatFx(e.note)"></span>
        </li>
      </ul>
    </section>

    <section class="lws hp">
      <h4>
        生命值
        <span class="tag">时限 {{ LIMIT }} 秒 · 超时每秒 −1</span>
      </h4>
      <div class="lwhp">
        <button
          v-for="(r, i) in rows"
          :key="r.label"
          type="button"
          :class="['r', {on: i === state.mode}]"
          :aria-pressed="i === state.mode"
          @click="state.mode = i">
          <span class="k">{{ r.label }}</span>
          <span class="trk">
            <i
              class="m"
              :style="{
                width: (r.hp / max) * 100 + '%',
                '--d': i * 0.06 + 's',
              }"></i>
            <i
              v-if="r.hidden"
              class="h"
              :style="{
                width: (r.hidden / max) * 100 + '%',
                '--d': i * 0.06 + 0.1 + 's',
              }"></i>
          </span>
          <span class="v">
            <b>{{ wan(r.hp) }}</b>
            <small>{{ dps(r.hp) }}/秒</small>
          </span>
          <span v-if="r.hidden" class="v hc">
            <b>{{ wan(r.hidden) }}</b>
            <small>{{ dps(r.hidden) }}/秒</small>
          </span>
          <span v-else-if="leader.hiddenCore" class="v hc none">—</span>
        </button>
      </div>
      <div v-if="leader.hiddenCore" class="lgd">
        <span>
          <i class="m"></i>
          领袖
        </span>
        <span>
          <i class="h"></i>
          隐秘核心
        </span>
      </div>
    </section>
  </article>
</template>

<style scoped>
.ctg-btn {
  border: 1px solid transparent;
  font: inherit;
  cursor: pointer;
}
.ctg-btn:hover,
.ctg-btn.on {
  border-color: currentColor;
  filter: brightness(1.06);
}
.lwb-btn {
  border: 0;
  font: inherit;
  cursor: pointer;
  transition: filter 0.14s ease;
}
.lwb-btn:hover {
  filter: brightness(1.08);
}

/* 战前档案速览卡 */
.lws.pf {
  display: grid;
  gap: 8px;
  padding: 10px 12px;
  border-left: 3px solid var(--teal);
}
.lwd-pf-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 7px;
}
.lwd-pf-cell {
  display: grid;
  align-content: start;
  gap: 2px;
  padding: 6px 8px;
  border-radius: 7px;
  background: var(--surface2);
  border: 1px solid var(--line);
}
.lwd-pf-cell small {
  font-size: 10.5px;
  font-weight: 700;
  color: var(--ink3);
  letter-spacing: 0.03em;
}
.lwd-pf-cell span {
  font-size: 12px;
  line-height: 1.45;
  color: var(--ink);
  font-weight: 500;
}
.lwd-pf-notes {
  display: grid;
  gap: 5px;
}
.lwd-pf-note {
  margin: 0;
  display: flex;
  align-items: baseline;
  gap: 7px;
  padding: 6px 9px;
  border-radius: 7px;
  background: color-mix(in srgb, var(--accent) 8%, var(--surface2));
  border: 1px solid color-mix(in srgb, var(--accent) 28%, var(--line));
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--ink);
}
.lwd-pf-note b {
  flex: none;
  font-size: 11px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--accent);
  color: var(--accent-ink);
}
.lwd-pf-note.hc {
  background: color-mix(in srgb, var(--hc) 8%, var(--surface2));
  border-color: color-mix(in srgb, var(--hc) 30%, var(--line));
}
.lwd-pf-note.hc b {
  background: var(--hc);
  color: #fff;
}

/* 可点击名词下划线提示 */
:deep(.has-term) {
  cursor: help;
  text-decoration: underline dotted currentColor;
  text-underline-offset: 2px;
  border-radius: 3px;
}
:deep(.has-term:hover) {
  background: color-mix(in srgb, currentColor 14%, transparent);
}

/* 名词与单位解析（默认折叠为轻量摘要栏，支持点选单条速览与按需检索） */
.lwd-gloss {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--line);
  display: grid;
  gap: 0;
}
.lwd-gloss-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  min-height: 36px;
  padding: 5px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface2);
  color: var(--ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.14s ease,
    background-color 0.14s ease,
    color 0.14s ease;
}
.lwd-gloss-toggle:hover,
.lwd-gloss-toggle.open {
  border-color: var(--accent);
}
.lwd-gloss-toggle:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.lwd-gloss-title {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}
.lwd-gloss-title b {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--ink);
}
.lwd-gloss-cnt {
  font-family: var(--fn);
  font-size: 11px;
  color: var(--ink3);
}
.lwd-gloss-hint {
  font-size: 11px;
  color: var(--ink3);
}
.lwd-gloss-act {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--accent);
}
.lwd-gloss-arrow {
  flex: none;
  transition: transform 0.2s cubic-bezier(0.22, 1, 0.36, 1);
}
.lwd-gloss-toggle.open .lwd-gloss-arrow {
  transform: rotate(180deg);
}
.lwd-gloss-pin {
  margin-top: 7px;
  padding: 8px 10px;
  border: 1px solid color-mix(in srgb, var(--accent) 45%, var(--line));
  border-left: 3px solid var(--accent);
  border-radius: 8px;
  background: var(--accent-soft);
  display: grid;
  gap: 5px;
  animation: gloss-pin-in 0.15s ease-out;
}
@keyframes gloss-pin-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
}
.lwd-gloss-pin-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.lwd-gloss-pin-head b {
  font-size: 13px;
  color: var(--ink);
}
.lwd-gloss-pin-acts {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.lwd-gloss-mini,
.lwd-gloss-close {
  border: 1px solid var(--line2);
  border-radius: 6px;
  background: var(--surface);
  color: var(--ink2);
  font: inherit;
  font-size: 11.5px;
  cursor: pointer;
  min-height: 34px;
  transition:
    border-color 0.14s ease,
    color 0.14s ease;
}
.lwd-gloss-mini {
  padding: 2px 9px;
}
.lwd-gloss-close {
  min-width: 34px;
  padding: 0;
  display: inline-grid;
  place-items: center;
}
.lwd-gloss-mini:hover,
.lwd-gloss-close:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.lwd-gloss-pin p {
  margin: 0;
  font-size: 12px;
  line-height: 1.55;
  color: var(--ink2);
}
.lwd-gloss-drawer {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transition:
    grid-template-rows 0.22s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.18s ease,
    margin-top 0.22s cubic-bezier(0.22, 1, 0.36, 1);
}
.lwd-gloss-drawer.open {
  grid-template-rows: 1fr;
  opacity: 1;
  margin-top: 7px;
}
.lwd-gloss-drawer-inner {
  min-height: 0;
  overflow: hidden;
}
.lwd-gloss-body {
  display: grid;
  gap: 7px;
  padding: 1px;
}
.lwd-gloss-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.lwd-gloss-search {
  flex: 1 1 150px;
  min-width: 0;
}
.lwd-gloss-list {
  margin: 0;
  display: grid;
  gap: 5px;
}
.lwd-gloss-item {
  display: grid;
  gap: 2px;
  padding: 6px 8px;
  border-radius: 7px;
  border: 1px solid var(--line);
  background: var(--surface2);
  cursor: pointer;
  transition:
    border-color 0.14s ease,
    background-color 0.14s ease,
    box-shadow 0.14s ease;
}
.lwd-gloss-item:hover {
  border-color: var(--line2);
}
.lwd-gloss-item.on {
  border-color: var(--accent);
  background: var(--accent-soft);
  box-shadow: 0 0 0 1px var(--accent);
}
.lwd-gloss-item dt {
  display: flex;
  align-items: center;
  gap: 5px;
}
.lwd-gloss-item dt b {
  font-size: 12.5px;
  color: var(--ink);
}
.lwd-gloss-item dd {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--ink2);
}
.gloss-kind {
  font-style: normal;
  font-size: 10px;
  font-weight: 700;
  line-height: 1.4;
  padding: 0 5px;
  border-radius: 4px;
  flex: none;
}
.gloss-kind.unit {
  background: color-mix(in srgb, var(--teal) 15%, transparent);
  color: var(--teal);
}
.gloss-kind.status {
  background: color-mix(in srgb, var(--red) 14%, transparent);
  color: var(--red);
}
.gloss-kind.mechanic {
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  color: var(--accent);
}

@container quickref-view (max-width: 820px) {
  .lwd-pf-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@container quickref-view (max-width: 500px) {
  .lwd-pf-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .lwd-pf-note {
    flex-direction: column;
    gap: 3px;
  }
  .lwd-gloss-hint {
    display: none;
  }
}
@media (max-height: 600px) {
  .lws.pf {
    padding: 7px 9px;
    gap: 6px;
  }
  .lwd-pf-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 5px;
  }
  .lwd-pf-cell {
    padding: 4px 7px;
  }
  .lwd-gloss-toggle {
    min-height: 34px;
    padding: 4px 8px;
  }
  .lwd-gloss-hint {
    display: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .lwd-gloss-item,
  .lwd-gloss-toggle,
  .lwd-gloss-arrow,
  .lwd-gloss-mini,
  .lwd-gloss-close,
  .lwd-gloss-drawer,
  .lwb-btn {
    transition: none;
  }
  .lwd-gloss-pin {
    animation: none;
  }
}
:global(:root[data-motion='reduce'] .lwd-gloss-item),
:global(:root[data-motion='reduce'] .lwd-gloss-toggle),
:global(:root[data-motion='reduce'] .lwd-gloss-arrow),
:global(:root[data-motion='reduce'] .lwd-gloss-mini),
:global(:root[data-motion='reduce'] .lwd-gloss-close),
:global(:root[data-motion='reduce'] .lwd-gloss-drawer),
:global(:root[data-motion='reduce'] .lwb-btn) {
  transition: none !important;
}
:global(:root[data-motion='reduce'] .lwd-gloss-pin) {
  animation: none !important;
}
</style>
