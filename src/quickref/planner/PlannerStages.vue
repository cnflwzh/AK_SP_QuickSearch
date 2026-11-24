<script setup lang="ts">
import {computed, nextTick, ref, watch} from 'vue';
import {
  MAX_STAGE_ROUND,
  validStageRange,
  type PlanStage,
} from '../../lib/plans/model.ts';
import {stageKey, stageLabel} from '../planStore.ts';
import BuildStageSwitcher from '../components/BuildStageSwitcher.vue';
import ConfirmButton from '../components/ConfirmButton.vue';
import StatusNotice from '../components/StatusNotice.vue';

const props = defineProps<{stages: readonly PlanStage[]}>();
/** 空键指向成型阵容。仅在回合有效时提交阶段列表和选中项。 */
const selected = defineModel<string>({required: true});
const emit = defineEmits<{commit: [stages: PlanStage[], selected: string]}>();
const stageIndex = computed(() =>
  props.stages.findIndex((stage) => stageKey(stage) === selected.value),
);
const chronological = computed(() =>
  [...props.stages].sort((a, b) => a.from - b.from),
);
const nextRound = computed(() => {
  let round = 1;
  for (const stage of chronological.value) {
    if (round < stage.from) break;
    round = stage.to + 1;
  }
  return round;
});
const tabs = computed(() => [
  {id: '', label: '成型阵容'},
  ...chronological.value.map((stage) => ({
    id: stageKey(stage),
    label: stageLabel(stage),
  })),
]);
const mode = ref<'' | 'add' | 'edit'>('');
const from = ref<number | ''>(1);
const to = ref<number | ''>(1);
const firstInput = ref<HTMLInputElement>();
const error = ref('');

watch(selected, () => {
  mode.value = '';
});
watch([from, to], () => {
  error.value = '';
});

function openRange(action: 'add' | 'edit'): void {
  const current = props.stages[stageIndex.value];
  if (action === 'edit' && current) {
    from.value = current.from;
    to.value = current.to;
  } else {
    from.value = to.value = nextRound.value;
  }
  mode.value = action;
  error.value = '';
  void nextTick(() => firstInput.value?.focus({preventScroll: true}));
}

function saveRange(): void {
  const start = Number(from.value);
  const end = Number(to.value);
  const index = mode.value === 'edit' ? stageIndex.value : -1;
  if (!validStageRange(start, end, props.stages, index)) {
    error.value =
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 1 ||
      end < 1 ||
      start > MAX_STAGE_ROUND ||
      end > MAX_STAGE_ROUND
        ? `请输入 1 至 ${MAX_STAGE_ROUND} 的整数回合。`
        : start > end
          ? '结束回合应等于或晚于起始回合。'
          : '这段回合与已有阶段重叠，请调整范围。';
    return;
  }
  const stage = {
    ...(props.stages[index] ?? {ops: [], note: '', layers: {}}),
    from: start,
    to: end,
  };
  const stages = [...props.stages.filter((_, i) => i !== index), stage];
  mode.value = '';
  emit(
    'commit',
    stages.sort((a, b) => a.from - b.from),
    stageKey(stage),
  );
}

function removeStage(): void {
  const current = stageIndex.value;
  if (current < 0) return;
  mode.value = '';
  emit(
    'commit',
    props.stages.filter((_, i) => i !== current),
    '',
  );
}
</script>

<template>
  <section class="pl-stages" aria-label="阵容阶段">
    <div class="pl-stage-bar">
      <BuildStageSwitcher
        v-if="stages.length"
        v-model="selected"
        :items="tabs"
        label="编辑阵容阶段" />
      <b v-else>成型阵容</b>
      <div class="pl-stage-actions">
        <button
          v-if="stageIndex >= 0"
          type="button"
          class="btn"
          @click="openRange('edit')">
          调整回合
        </button>
        <button
          type="button"
          class="btn"
          :disabled="nextRound > MAX_STAGE_ROUND"
          :title="
            nextRound > MAX_STAGE_ROUND
              ? `全部 ${MAX_STAGE_ROUND} 个回合已分配`
              : undefined
          "
          @click="openRange('add')">
          ＋ 添加阶段
        </button>
      </div>
    </div>
    <form
      v-if="mode"
      class="pl-stage-form"
      novalidate
      @submit.prevent="saveRange">
      <label>
        起始回合
        <input
          ref="firstInput"
          v-model.number="from"
          type="number"
          min="1"
          :max="MAX_STAGE_ROUND"
          step="1"
          inputmode="numeric" />
      </label>
      <label>
        结束回合
        <input
          v-model.number="to"
          type="number"
          min="1"
          :max="MAX_STAGE_ROUND"
          step="1"
          inputmode="numeric" />
      </label>
      <div class="pl-stage-actions">
        <button type="submit" class="btn pri">
          {{ mode === 'edit' ? '保存回合' : '创建阶段' }}
        </button>
        <button type="button" class="btn" @click="mode = ''">取消</button>
        <ConfirmButton
          v-if="mode === 'edit'"
          label="删除阶段"
          confirm-label="确认删除阶段"
          :reset-key="selected"
          @confirm="removeStage" />
      </div>
      <StatusNotice v-if="error" tone="warning" :message="error" />
    </form>
  </section>
</template>

<style scoped>
.pl-stages {
  min-width: 0;
  margin-bottom: 10px;
}
.pl-stage-bar,
.pl-stage-form,
.pl-stage-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.pl-stage-bar > b {
  font-size: 13px;
}
.pl-stage-bar > :first-child {
  flex: 1 1 180px;
  min-width: 0;
}
.pl-stage-bar > b:first-child {
  flex-basis: auto;
}
.pl-stage-bar .btn {
  padding-inline: 8px;
  white-space: nowrap;
}
.pl-stage-form {
  margin-top: 6px;
  padding: 8px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface2);
}
.pl-stage-form label {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--ink2);
  font-size: 12px;
}
.pl-stage-form input {
  box-sizing: border-box;
  width: 5em;
  min-height: 34px;
  padding: 4px 6px;
  border: 1px solid var(--line2);
  border-radius: 6px;
  background: var(--surface);
  color: var(--ink);
  font: inherit;
}
.pl-stage-form .q-notice {
  flex: 1 0 100%;
  box-sizing: border-box;
}
.pl-stages .btn {
  min-height: 34px;
}
@media (max-height: 600px) {
  .pl-stages {
    margin-bottom: 6px;
  }
  .pl-stage-form {
    padding: 5px 7px;
  }
}
</style>
