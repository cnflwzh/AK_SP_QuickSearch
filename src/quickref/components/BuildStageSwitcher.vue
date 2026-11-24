<script setup lang="ts">
import {computed} from 'vue';
import SelectInput from './SelectInput.vue';
import SubTabs from './SubTabs.vue';

/** id 为空字符串时表示成型阵容；count 为可选的上场干员数。 */
interface StageItem {
  readonly id: string;
  readonly label: string;
  readonly count?: number;
}

const props = defineProps<{
  items: readonly StageItem[];
  label: string;
}>();
const selected = defineModel<string>({required: true});
const currentIndex = computed(() =>
  props.items.findIndex((item) => item.id === selected.value),
);
const options = computed(() =>
  props.items.map((item) => ({
    value: item.id,
    label:
      item.count === undefined
        ? item.label
        : `${item.label} · ${item.count} 人`,
  })),
);
const current = computed(() => options.value[currentIndex.value]);
const previous = computed(() => props.items[currentIndex.value - 1]);
const next = computed(() =>
  currentIndex.value >= 0 ? props.items[currentIndex.value + 1] : undefined,
);
</script>

<template>
  <div class="build-stage-switcher">
    <SubTabs
      v-model="selected"
      class="stage-tabs"
      :items="items"
      :level="3"
      overflow="scroll"
      :label="label"
      attr="build-stage" />
    <div class="stage-stepper" role="group" :aria-label="label">
      <button
        type="button"
        class="stage-step"
        aria-label="上一阶段"
        :title="previous ? '上一阶段 · ' + previous.label : '已是首个阶段'"
        :disabled="!previous"
        @click="previous && (selected = previous.id)">
        <span class="stage-chevron prev" aria-hidden="true" />
      </button>
      <SelectInput
        v-model="selected"
        class="stage-select"
        :options="options"
        :trigger-label="items[currentIndex]?.label"
        :label="label"
        :title="current?.label"
        :disabled="!items.length"
        compact />
      <button
        type="button"
        class="stage-step"
        aria-label="下一阶段"
        :title="next ? '下一阶段 · ' + next.label : '已是最后阶段'"
        :disabled="!next"
        @click="next && (selected = next.id)">
        <span class="stage-chevron" aria-hidden="true" />
      </button>
      <span class="sr-only" role="status" aria-atomic="true">
        <template v-if="current">
          {{ current.label }}，第 {{ currentIndex + 1 }} 项，共
          {{ items.length }} 项
        </template>
      </span>
    </div>
  </div>
</template>

<style scoped>
.build-stage-switcher {
  min-width: 0;
  container: build-stage / inline-size;
}
.stage-tabs {
  display: none;
}
.stage-stepper {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) 36px;
  max-width: 24rem;
  border-radius: 8px;
  background: var(--surface2);
  box-shadow: inset 0 0 0 1px var(--line);
}
.stage-step {
  display: grid;
  place-items: center;
  min-height: 36px;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--ink2);
  cursor: pointer;
  transition:
    color 150ms ease,
    background-color 150ms ease,
    border-color 150ms ease;
}
.stage-step:disabled {
  color: var(--ink3);
  opacity: 0.42;
  cursor: default;
}
@media (hover: hover) {
  .stage-step:not(:disabled):hover {
    background: var(--accent-soft);
    color: var(--accent);
  }
}
.stage-step:not(:disabled):active {
  background: var(--accent-soft);
  color: var(--accent);
}
.stage-step:focus-visible {
  outline: 2px solid var(--teal);
  outline-offset: -2px;
}
.stage-select :deep(.q-select-trigger) {
  min-height: 36px;
  box-shadow: none;
}
.stage-select :deep(.q-select-trigger:focus-visible),
.stage-select:has(:focus-visible) :deep(.q-select-trigger) {
  outline: 2px solid var(--teal);
  outline-offset: -2px;
}
.stage-chevron {
  width: 7px;
  height: 7px;
  border-top: 1.6px solid currentColor;
  border-right: 1.6px solid currentColor;
  transform: rotate(45deg);
}
.stage-chevron.prev {
  transform: rotate(-135deg);
}
.stage-select :deep(.q-select-text) {
  text-align: center;
  font-weight: 600;
}

/* 从容器取宽度，Wiki 窄栏和编辑按钮都会压缩这里的实际可用空间。 */
@container build-stage (max-width: 192px) {
  .stage-stepper {
    grid-template-columns: minmax(0, 1fr);
  }
  .stage-step {
    display: none;
  }
}
@media (min-height: 601px) {
  @container build-stage (min-width: 601px) {
    .stage-tabs {
      display: block;
    }
    .stage-stepper {
      display: none;
    }
  }
}
@media (prefers-reduced-motion: reduce) {
  .stage-step {
    transition: none;
  }
}
:global(:root[data-motion='reduce'] .stage-step) {
  transition: none;
}
</style>
