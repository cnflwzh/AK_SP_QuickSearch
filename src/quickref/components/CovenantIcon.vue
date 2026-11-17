<script setup lang="ts">
import {computed} from 'vue';
import {covenantIconSrc} from '../../lib/ui/assets.ts';

const props = withDefaults(
  defineProps<{
    name: string;
    emblem?: boolean;
  }>(),
  {emblem: false},
);

const src = computed(() => covenantIconSrc(props.name));
</script>
<template>
  <span v-if="emblem && src" class="cv-emblem" aria-hidden="true">
    <img :src="src" alt="" width="40" height="40" decoding="async" />
  </span>
  <i
    v-else-if="src"
    class="cv-ic"
    :style="{'--cv-ic': `url('${src}')`}"
    aria-hidden="true"></i>
</template>
