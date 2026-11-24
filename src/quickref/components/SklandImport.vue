<script setup lang="ts">
import {computed, ref, shallowRef, watch} from 'vue';
import {
  fetchSklandGuide,
  guideCandidates,
  guidePlanFields,
  isCurrentGuideSeason,
  type SklandGuide,
} from '../../lib/plans/skland.ts';
import {MAX_OPS, type Plan} from '../../lib/plans/model.ts';
import {applyGuidePatch} from '../../lib/plans/sklandShare.ts';
import {blankPlan} from '../../lib/plans/storage.ts';
import {hasPlanOperators} from '../planStore.ts';
import PlanImportPreview from './PlanImportPreview.vue';
import StatusNotice from './StatusNotice.vue';
import SklandGuideDetails from './SklandGuideDetails.vue';

const props = defineProps<{id: string; patch?: string}>();
const emit = defineEmits<{accept: [plan: Plan, andRun: boolean]}>();
const guide = shallowRef<SklandGuide>();
const selected = ref<string[]>([]);
const error = ref('');
const retry = ref(0);
const candidates = computed(() =>
  guide.value ? guideCandidates(guide.value) : [],
);
const preview = computed(() => {
  if (!guide.value) return {};
  try {
    return {
      fields: props.patch
        ? applyGuidePatch(guide.value, props.patch)
        : guidePlanFields(guide.value, selected.value),
    };
  } catch (reason) {
    return {
      error: reason instanceof Error ? reason.message : '无法还原这份阵容。',
    };
  }
});
const fields = computed(() => preview.value.fields);
watch(
  [() => props.id, retry],
  async ([id], _, onCleanup) => {
    const controller = new AbortController();
    onCleanup(() => controller.abort());
    guide.value = undefined;
    error.value = '';
    try {
      const next = await fetchSklandGuide(id, controller.signal);
      if (controller.signal.aborted) return;
      selected.value = guidePlanFields(next).ops.map((op) => op.name);
      guide.value = next;
    } catch (reason) {
      if (!controller.signal.aborted) {
        const message =
          reason instanceof Error ? reason.message : '读取失败，请重试。';
        error.value = props.patch
          ? message + '也可向分享者索取完整分享码。'
          : message;
      }
    }
  },
  {immediate: true},
);
function accept(andRun: boolean): void {
  if (guide.value && fields.value)
    emit(
      'accept',
      {...blankPlan(), ...fields.value, skland: guide.value},
      andRun,
    );
}
</script>

<template>
  <template v-if="guide && fields">
    <SklandGuideDetails :guide="guide" />
    <fieldset
      v-if="!patch && candidates.length > MAX_OPS"
      class="guide-choices">
      <legend>选择成型阵容干员（{{ selected.length }}/{{ MAX_OPS }}）</legend>
      <label v-for="op in candidates" :key="op.name">
        <input
          v-model="selected"
          type="checkbox"
          :value="op.name"
          :disabled="
            selected.length >= MAX_OPS && !selected.includes(op.name)
          " />
        {{ op.name }}
      </label>
    </fieldset>
    <PlanImportPreview
      v-if="patch || isCurrentGuideSeason(guide)"
      :plan="fields"
      :title="patch ? '分享者修改后的阵容' : '可编辑阵容'"
      compact />
    <div class="pl-row">
      <button type="button" @click="accept(false)">存为我的流派</button>
      <button
        type="button"
        class="pri"
        :disabled="!hasPlanOperators(fields)"
        @click="accept(true)">
        导入并设为本局
      </button>
    </div>
  </template>
  <template v-else-if="error || preview.error">
    <StatusNotice tone="warning" :message="error || preview.error" />
    <div class="pl-row">
      <button type="button" @click="retry++">重新读取</button>
    </div>
  </template>
  <StatusNotice v-else tone="info" message="正在读取森空岛攻略…" />
</template>

<style scoped>
.guide-choices {
  border: 1px solid var(--line);
  min-width: 0;
}
.guide-choices label {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  margin-right: 8px;
  cursor: pointer;
}
</style>
