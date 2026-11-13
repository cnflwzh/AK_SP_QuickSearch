<script setup lang="ts">
import { ref, watch } from 'vue';
import { NUMBER_INPUT_LIMIT } from '../../../data/numberTools.ts';

const props = withDefaults(defineProps<{
  value: number | null;
  label: string;
  placeholder?: string;
  nullable?: boolean;
}>(), { nullable: false });
const emit = defineEmits<{ change: [value: number | null] }>();
const draft = ref(props.value === null ? '' : String(props.value));
watch(() => props.value, value => {
  // 空草稿允许暂时保留，输入完成后再补齐，避免数字键盘连续输入被打断。
  if (value !== null && Number(draft.value) === value && draft.value !== '') return;
  draft.value = value === null ? '' : String(value);
});

function read(event: Event): void {
  const input = event.target as HTMLInputElement;
  draft.value = input.value;
  if (input.value === '') {
    if (props.nullable) emit('change', null);
    return;
  }
  if (Number.isInteger(input.valueAsNumber) && input.valueAsNumber >= 0 && input.valueAsNumber <= NUMBER_INPUT_LIMIT) {
    emit('change', input.valueAsNumber);
  }
}
function commit(event: Event): void {
  const input = event.target as HTMLInputElement;
  const value = draft.value === '' && props.nullable ? null
    : Number.isFinite(input.valueAsNumber) ? Math.max(0, Math.min(NUMBER_INPUT_LIMIT, Math.round(input.valueAsNumber)))
      : props.value ?? (props.nullable ? null : 0);
  draft.value = value === null ? '' : String(value);
  input.value = draft.value;
  emit('change', value);
}
</script>

<template>
  <input type="number" inputmode="numeric" min="0" :max="NUMBER_INPUT_LIMIT" step="1"
    :value="draft" :aria-label="label" :placeholder="placeholder" @input="read" @blur="commit" @keydown.enter="commit">
</template>
