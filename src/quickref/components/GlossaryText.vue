<script setup lang="ts">
import {computed} from 'vue';
import {glossaryHtml} from '../../lib/ui/glossaryText.ts';

const props = withDefaults(defineProps<{text: string; focusable?: boolean}>(), {
  focusable: true,
});
const markup = computed(() => glossaryHtml(props.text, props.focusable));
</script>

<template>
  <span v-html="markup"></span>
</template>
