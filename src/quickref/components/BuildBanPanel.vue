<script setup lang="ts">
import {computed} from 'vue';
import {BANNABLE_COVENANTS, OPERATOR, STRATEGY} from '../../../data/index.ts';
import {hasAnyBox, operatorBox} from '../../lib/box/store.ts';
import {
  blankPlan,
  covenantStats,
  type Plan,
  type PlanStage,
} from '../../lib/plans/core.ts';
import {banReplace} from '../../lib/recommendation/planning.ts';
import {avatarSrc} from '../../lib/ui/assets.ts';
import {color} from '../format.ts';
import {addPlan, runBans, runBanSet, setRun, toggleBan} from '../planStore.ts';
import {useQuickrefActions} from '../state.ts';
import CovenantIcon from './CovenantIcon.vue';

const props = defineProps<{
  plan: Plan;
  formation: Plan | PlanStage;
  bannable: string[];
  hasRelevantBan: boolean;
}>();
const showAll = defineModel<boolean>('showAll', {required: true});
const forced = defineModel<Record<string, string>>('forced', {required: true});
const emit = defineEmits<{saved: [key: string]}>();
const actions = useQuickrefActions();

const visibleBanCovenants = computed(() =>
  showAll.value
    ? BANNABLE_COVENANTS
    : [...new Set([...props.bannable, ...runBans.value])],
);
const ban = computed(() =>
  props.hasRelevantBan
    ? banReplace(
        props.formation.ops,
        runBans.value,
        forced.value,
        props.formation.layers,
        hasAnyBox.value ? operatorBox : undefined,
      )
    : null,
);
const banAfter = computed(() =>
  ban.value
    ? covenantStats(
        ban.value.ops,
        props.formation.layers,
        [],
        runBanSet.value,
      ).filter((s) => s.active)
    : [],
);
function pickAlt(replaces: string, name: string): void {
  forced.value = {
    ...Object.fromEntries(
      Object.entries(forced.value).filter(([, chosen]) => chosen !== name),
    ),
    [replaces]: name,
  };
}
function saveBan(): void {
  const result = ban.value;
  if (!result?.ops.length) return;
  const source = props.plan;
  const [strategy = '', ...alternates] = [
    source.strategy,
    ...(source.strategyAlternates ?? []),
  ].filter(
    (name) =>
      STRATEGY[name] && !runBans.value.includes(STRATEGY[name].category),
  );
  const key = addPlan({
    ...blankPlan(`${source.name.slice(0, 13)}·替`),
    ops: result.ops.map((slot) => ({
      ...slot,
      eq: [...slot.eq],
      alt: [...slot.alt],
    })),
    strategy,
    note: props.formation.note,
    layers: {...props.formation.layers},
    ...(alternates.length ? {strategyAlternates: alternates} : {}),
  });
  setRun(key);
  emit('saved', key);
}
</script>

<template>
  <div id="build-bans" class="bban">
    <div class="bpick">
      <span class="k">点选被 ban 的</span>
      <button
        v-for="covName in visibleBanCovenants"
        :key="covName"
        type="button"
        :class="['bc', {on: runBans.includes(covName)}]"
        :aria-pressed="runBans.includes(covName)"
        :style="{'--c': color(covName)}"
        @click="toggleBan(covName)">
        <CovenantIcon :name="covName" />
        {{ covName }}
      </button>
      <button
        type="button"
        class="bc-more"
        :aria-expanded="showAll"
        @click="showAll = !showAll">
        {{ showAll ? '收起其他盟约' : '其他盟约 ▾' }}
      </button>
    </div>
    <template v-if="ban">
      <div v-for="pk in ban.picks" :key="pk.replaces" class="bpk">
        <span
          class="av off"
          :data-t="OPERATOR[pk.replaces].tier"
          :data-op="pk.replaces"
          :title="`${pk.replaces} 不会出现`">
          <img :src="avatarSrc(pk.replaces)" alt="" width="36" height="36" />
          <small>{{ pk.replaces }}</small>
        </span>
        <b class="ar">→</b>
        <button
          type="button"
          class="av to"
          :data-t="OPERATOR[pk.name].tier"
          :data-op="pk.name"
          @click="actions.openDetail('op', pk.name)">
          <img :src="avatarSrc(pk.name)" alt="" width="36" height="36" />
          <small>{{ pk.name }}</small>
        </button>
        <span class="g">
          <i v-for="c in pk.gains" :key="c" :style="{'--c': color(c)}">
            <CovenantIcon :name="c" />
            {{ c }}
          </i>
        </span>
        <span v-if="pk.alts.length" class="alts">
          <span class="k">或</span>
          <button
            v-for="a in pk.alts"
            :key="a"
            type="button"
            :data-t="OPERATOR[a].tier"
            :data-op="a"
            :aria-label="`换成 ${a}`"
            @click="pickAlt(pk.replaces, a)">
            <img :src="avatarSrc(a)" alt="" width="28" height="28" />
          </button>
        </span>
      </div>
      <div
        v-for="n in ban.removed.filter(
          (n) => !ban!.picks.some((pk) => pk.replaces === n),
        )"
        :key="n"
        class="bpk">
        <span class="av off" :data-t="OPERATOR[n].tier" :data-op="n">
          <img :src="avatarSrc(n)" alt="" width="36" height="36" />
          <small>{{ n }}</small>
        </span>
        <span class="hint">找不到能补回盟约的替代</span>
      </div>
      <div class="bres">
        <span class="k">换人后</span>
        <span
          v-for="s in banAfter"
          :key="s.name"
          :class="['c', 'on', {max: s.bonusActive}]"
          :style="{'--c': color(s.name)}">
          <CovenantIcon :name="s.name" />
          {{ s.name }}
          <small>{{ s.count }}/{{ s.need }}</small>
        </span>
        <span
          v-for="l in ban.lost"
          :key="l"
          class="c lost"
          :style="{'--c': color(l)}">
          <CovenantIcon :name="l" />
          {{ l }}
          <small>失效</small>
        </span>
        <button
          type="button"
          class="pri"
          :disabled="!ban.ops.length"
          @click="saveBan">
          存为新流派 · 本局打它
        </button>
      </div>
    </template>
    <p v-else class="hint">
      被 ban 盟约的干员整局不会出现，点上面的盟约看替代方案
    </p>
  </div>
</template>
