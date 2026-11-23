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
  <!-- 按路由名区分 Box 与设置的缓存，缩放窗口或切换查询参数时保留当前表单。 -->
  <KeepAlive :max="1">
    <component
      :is="content"
      v-if="!isFloatingWindow"
      :key="route.name ?? undefined" />
  </KeepAlive>
</template>
