<script setup lang="ts">
import type {Component} from 'vue';
import {useRoute} from 'vue-router';
import {isFloatingWindow} from '../../lib/ui/windowMode.ts';
import RouteStatusView from './RouteStatusView.vue';

defineProps<{content: Component}>();
const route = useRoute();
</script>

<template>
  <RouteStatusView
    v-if="isFloatingWindow"
    :window-page="route.meta.regularWindowTitle" />
  <!-- 缩小窗口时保留已打开的表单；直接从小窗进入时暂缓加载页面。 -->
  <KeepAlive :max="1">
    <component :is="content" v-if="!isFloatingWindow" />
  </KeepAlive>
</template>
