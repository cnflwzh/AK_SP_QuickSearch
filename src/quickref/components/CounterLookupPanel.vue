<script setup lang="ts">
import {computed, ref} from 'vue';
import {
  TIER_LABELS,
  equipmentWithRoles,
  operatorRolesAtElite,
  operatorsWithRoles,
  type CombatRole,
} from '../../../data/index.ts';
import {avatarSrc, equipIconSrc} from '../../lib/ui/assets.ts';
import {inRun, isRunBannedOp, run, runBans, runStat} from '../planStore.ts';
import {useQuickrefActions} from '../state.ts';

const props = defineProps<{
  title: string;
  subtitle?: string;
  roles: readonly CombatRole[];
}>();
const emit = defineEmits<{close: []}>();
const actions = useQuickrefActions();

const allOps = computed(() =>
  operatorsWithRoles(props.roles).filter((op) => op.stars > 0),
);
const bannedHiddenCount = computed(() =>
  runBans.value.length
    ? allOps.value.filter((op) => isRunBannedOp(op.name)).length
    : 0,
);
const activeRunCovenants = computed(() => new Set([...runStat.value.keys()]));

const rankedOps = computed(() => {
  const available = allOps.value.filter((op) => !isRunBannedOp(op.name));
  return available
    .map((op) => {
      const inCurrentRun = inRun.value.has(op.name);
      const fitsRunCov =
        !!run.value &&
        op.covenants.some((cov) => activeRunCovenants.value.has(cov));
      return {
        op,
        inCurrentRun,
        fitsRunCov,
        requiresElite: !operatorRolesAtElite(op, false).some((role) =>
          props.roles.includes(role),
        ),
        rank: inCurrentRun ? 2 : fitsRunCov ? 1 : 0,
      };
    })
    .sort((a, b) => b.rank - a.rank || a.op.tier - b.op.tier);
});

const initialOperatorCount = 24;
const expanded = ref(false);
const visibleOperators = computed(() =>
  expanded.value
    ? rankedOps.value
    : rankedOps.value.slice(0, initialOperatorCount),
);
const matchedEquipment = computed(() => equipmentWithRoles(props.roles));
</script>

<template>
  <div class="counter-lookup panel-reveal" role="region" :aria-label="`${title}对策推荐`">
    <header class="cl-head">
      <div class="cl-title">
        <b>{{ title }}</b>
        <span v-if="subtitle" class="cl-sub">{{ subtitle }}</span>
        <span v-for="role in roles" :key="role" class="tag a">{{ role }}</span>
      </div>
      <div class="cl-meta">
        <span v-if="bannedHiddenCount" class="cl-ban-note">
          已滤禁池 {{ bannedHiddenCount }} 名
        </span>
        <button
          type="button"
          class="cl-close"
          aria-label="收起对策推荐"
          @click="emit('close')">
          收起 ✕
        </button>
      </div>
    </header>

    <div v-if="rankedOps.length" class="cl-group">
      <span class="cl-k">
        干员（{{ rankedOps.length }} 名{{
          run ? ' · 优先显示本局/同盟约' : ''
        }}）
      </span>
      <div class="cl-chips">
        <button
          v-for="{
            op,
            inCurrentRun,
            fitsRunCov,
            requiresElite,
          } in visibleOperators"
          :key="op.name"
          type="button"
          :class="[
            'cl-chip',
            {inrun: inCurrentRun, cov: !inCurrentRun && fitsRunCov},
          ]"
          :data-t="op.tier"
          :data-op="op.name"
          @click="actions.openDetail('op', op.name)">
          <img
            :src="avatarSrc(op.name)"
            alt=""
            width="22"
            height="22"
            loading="lazy"
            decoding="async" />
          <i class="tn">{{ TIER_LABELS[op.tier] }}</i>
          <span>{{ op.name }}</span>
          <small v-if="requiresElite">需精锐</small>
          <em v-if="inCurrentRun">本局</em>
          <em v-else-if="fitsRunCov">同盟</em>
        </button>
      </div>
      <button
        v-if="rankedOps.length > initialOperatorCount"
        type="button"
        class="cl-more"
        :aria-expanded="expanded"
        @click="expanded = !expanded">
        {{
          expanded
            ? '收起名单'
            : `查看其余 ${rankedOps.length - initialOperatorCount} 名干员`
        }}
      </button>
    </div>

    <div v-if="matchedEquipment.length" class="cl-group">
      <span class="cl-k">装备（{{ matchedEquipment.length }} 件）</span>
      <div class="cl-chips">
        <button
          v-for="eq in matchedEquipment"
          :key="eq.name"
          type="button"
          class="cl-chip eq"
          :data-t="eq.tier"
          :data-eq="eq.name"
          @click="actions.openDetail('eq', eq.name)">
          <img
            :src="equipIconSrc(eq.name)"
            alt=""
            width="20"
            height="20"
            loading="lazy"
            decoding="async" />
          <span>{{ eq.name }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.counter-lookup {
  display: grid;
  gap: 10px;
  margin-top: 10px;
  padding: 12px 14px;
  border: 1px solid color-mix(in srgb, var(--teal) 40%, var(--line2));
  border-left: 3px solid var(--teal);
  border-radius: 9px;
  background: color-mix(in srgb, var(--teal) 4%, var(--surface));
}
.cl-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 6px 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--line);
}
.cl-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 13.5px;
}
.cl-sub {
  font-size: 12px;
  color: var(--ink3);
}
.cl-meta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.cl-ban-note {
  font-size: 11.5px;
  color: var(--red);
}
.cl-more,
.cl-close {
  min-height: 34px;
  padding: 2px 10px;
  border: 1px solid var(--line2);
  border-radius: 6px;
  background: var(--surface2);
  color: var(--ink2);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.cl-more:hover,
.cl-close:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.cl-group {
  display: grid;
  gap: 6px;
}
.cl-k {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--ink3);
}
.cl-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.cl-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  padding: 3px 9px 3px 4px;
  border: 1px solid var(--line2);
  border-radius: 7px;
  background: var(--surface2);
  color: var(--ink);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition:
    border-color 0.12s,
    transform 0.12s;
}
.cl-chip:hover {
  border-color: var(--accent);
  transform: translateY(-1px);
}
.cl-chip.inrun {
  border-color: var(--accent);
  background: var(--accent-soft);
  font-weight: 700;
}
.cl-chip.cov {
  border-color: var(--teal);
  background: var(--teal-soft);
}
.cl-chip img {
  border-radius: 5px;
  border: 1.5px solid var(--tc, var(--line));
  background: var(--surface);
}
.cl-chip em {
  font-style: normal;
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--accent);
  color: var(--accent-ink);
}
.cl-chip.cov em {
  background: var(--teal);
  color: #fff;
}
.cl-more {
  justify-self: start;
}
</style>
