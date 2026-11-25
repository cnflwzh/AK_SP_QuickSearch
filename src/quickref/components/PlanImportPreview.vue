<script setup lang="ts">
import {computed, ref, watch} from 'vue';
import type {Shared} from '../../lib/plans/sharing.ts';
import {stageKey, stageLabel, stageOf} from '../../lib/plans/lineup.ts';
import PlanSummary from './PlanSummary.vue';
import GlossaryText from './GlossaryText.vue';
import BuildStageSwitcher from './BuildStageSwitcher.vue';

const props = withDefaults(
  defineProps<{
    plan: Shared;
    label?: string;
    title?: string;
    compact?: boolean;
  }>(),
  {label: '预览阵容阶段', compact: false},
);
const selected = ref('');
const tabs = computed(() => [
  {id: '', label: '成型阵容', count: props.plan.ops.length},
  ...(props.plan.stages ?? []).map((stage) => ({
    id: stageKey(stage),
    label: stageLabel(stage),
    count: stage.ops.length,
  })),
]);
const lineup = computed(
  () =>
    stageOf(props.plan, selected.value) ??
    props.plan,
);
watch(
  () => props.plan,
  (plan) => {
    const first = plan.stages?.find((stage) => stage.ops.length);
    selected.value = !plan.ops.length && first ? stageKey(first) : '';
  },
  {immediate: true},
);
</script>

<template>
  <div class="import-preview">
    <BuildStageSwitcher
      v-if="tabs.length > 1"
      v-model="selected"
      :items="tabs"
      :label="label" />
    <PlanSummary
      :ops="lineup.ops"
      :strategy="plan.strategy"
      :strategy-alternates="plan.strategyAlternates"
      :layers="lineup.layers"
      :title="title || plan.name || '导入的流派'"
      :icon="plan.icon"
      :compact="compact" />
    <details
      v-if="lineup.note"
      :key="selected"
      :open="lineup.note.length <= 240">
      <summary>运营思路</summary>
      <p><GlossaryText :text="lineup.note" /></p>
    </details>
  </div>
</template>

<style scoped>
.import-preview {
  display: grid;
  gap: 5px;
  min-width: 0;
}
summary {
  min-height: 34px;
  align-content: center;
  cursor: pointer;
  color: var(--accent);
  font-weight: 600;
}
p {
  margin: 4px 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
