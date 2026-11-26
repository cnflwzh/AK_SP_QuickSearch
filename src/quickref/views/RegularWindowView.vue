<script setup lang="ts">
import {computed, ref, watch, type Component} from 'vue';
import {useRoute} from 'vue-router';
import {
  mirrorEntryToken,
  mirrorReloadNotice,
} from '../../lib/settings/mirrorSite.ts';
import {
  migrationEnabled,
  migrationPeer,
} from '../../lib/settings/domainMigration.ts';
import {isFloatingWindow} from '../../lib/ui/windowMode.ts';
import RouteStatusView from './RouteStatusView.vue';

defineProps<{content: Component}>();
const route = useRoute();
// 入口校验已限定站点、设置页及一次性令牌。握手后哈希会清除，保留本页预览直至离开。
const transferEntry = ref(
  route.name === 'settings' &&
    (!!mirrorReloadNotice ||
      (!!mirrorEntryToken &&
        location.hash === '#mirror-backup=' + mirrorEntryToken)),
);
// 旧站小窗也能在弹窗受限时进入设置，下载同一份迁移备份。
const migrationSite = migrationEnabled && !!migrationPeer(location.origin);
const transferOnly = computed(
  () =>
    isFloatingWindow.value &&
    (transferEntry.value || (migrationSite && route.name === 'settings')),
);
watch(
  () => route.name,
  () => {
    transferEntry.value = false;
  },
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
