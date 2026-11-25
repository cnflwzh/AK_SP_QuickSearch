<script setup lang="ts">
import {computed, ref, watch, type Component} from 'vue';
import {useRoute} from 'vue-router';
import {mirrorEntryToken} from '../../lib/settings/mirrorSite.ts';
import {isFloatingWindow} from '../../lib/ui/windowMode.ts';
import RouteStatusView from './RouteStatusView.vue';

defineProps<{content: Component}>();
const route = useRoute();
// 入口校验已限定站点、设置页及一次性令牌。握手后哈希会清除，保留本页预览直至离开。
const transferEntry = ref(
  !!mirrorEntryToken &&
    route.name === 'settings' &&
    location.hash === '#mirror-backup=' + mirrorEntryToken,
);
const transferOnly = computed(
  () => isFloatingWindow.value && transferEntry.value,
);
watch(
  () => route.name,
  () => { transferEntry.value = false; },
);
</script>

<template>
  <RouteStatusView
    v-if="isFloatingWindow && !transferOnly"
    :window-page="route.meta.regularWindowTitle" />
  <!-- 按路由名区分 Box 与设置的缓存，缩放窗口或切换查询参数时保留当前表单。 -->
  <KeepAlive :max="1">
    <component
      :is="content"
      v-if="!isFloatingWindow || transferOnly"
      v-bind="route.name === 'settings' ? {mirrorOnly: transferOnly} : {}"
      :key="route.name ?? undefined" />
  </KeepAlive>
</template>
