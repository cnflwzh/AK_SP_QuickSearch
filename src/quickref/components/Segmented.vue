<script setup lang="ts">
defineProps<{ labels: readonly string[]; active: number; attr: string }>();
defineEmits<{ change: [index: number] }>();
</script>
<template><div class="seg" role="group"><button v-for="(label, index) in labels" :key="label" type="button" :class="{ on: index === active }" :aria-pressed="index === active" v-bind="{ ['data-' + attr]: index }" @click="$emit('change', index)">{{ label }}</button></div></template>
