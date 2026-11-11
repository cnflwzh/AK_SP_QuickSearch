<script setup lang="ts">
defineProps<{ labels: readonly string[]; modelValue: number }>();
const emit = defineEmits<{ 'update:modelValue': [value: number] }>();
</script>
<template>
  <div class="seg"><button v-for="(label, i) in labels" :key="label" type="button" :data-i="i" :class="{ on: modelValue === i }" @click="emit('update:modelValue', i)">{{ label }}</button></div>
</template>
