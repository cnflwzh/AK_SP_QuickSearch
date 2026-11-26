<script setup lang="ts">
import {ref, watch} from 'vue';
import {migrationPeer} from '../settings/domainMigration.ts';
import StatusNotice from '../../quickref/components/StatusNotice.vue';
import {useMigrationSender} from '../../quickref/components/useMirrorBackup.ts';

const props = defineProps<{routeKey?: string}>();
const target = migrationPeer(location.origin)!;
const targetHost = new URL(target.origin).host;
const dismissalKey = 'wsq.domainMigration.noticeHidden';
const hidden = ref(false);
try {
  hidden.value = sessionStorage.getItem(dismissalKey) === '1';
} catch {
  /* 无法使用会话存储时，仍可收起当前页面的提示。 */
}

const {start, busy, activeHere, message, failed, cancel} = useMigrationSender(
  async () => {
    const {exportMirrorBackup} =
      await import('../../quickref/mirrorBackupStore.ts');
    return exportMirrorBackup(true);
  },
);

function destination() {
  const url = new URL(target.origin);
  url.pathname = location.pathname;
  url.search = location.search;
  url.hash = location.hash;
  return url.href;
}
const directHref = ref(destination());
watch(
  () => props.routeKey,
  () => {
    directHref.value = destination();
  },
  {flush: 'post'},
);
function refreshLink(event: Event) {
  // 教程和对比页也会用 History API 修改当前条件。键鼠打开或复制链接时取最新地址。
  directHref.value = destination();
  (event.currentTarget as HTMLAnchorElement).href = directHref.value;
}
function dismiss() {
  hidden.value = true;
  try {
    sessionStorage.setItem(dismissalKey, '1');
  } catch {
    /* 仅在本页生效。 */
  }
}
</script>

<template>
  <aside v-if="!hidden" class="domain-migration" aria-label="域名迁移">
    <StatusNotice :dismissible="!busy" @dismiss="dismiss">
      <span class="migration-row">
        <span>
          本站将迁至
          <b>{{ targetHost }}</b>
          ，请在这台设备上迁移存档。
        </span>
        <span class="migration-actions">
          <button type="button" :disabled="busy" @click="start()">
            迁移存档到新域名
          </button>
          <a
            :href="directHref"
            @focus="refreshLink"
            @pointerdown="refreshLink"
            @contextmenu="refreshLink"
            @click="refreshLink">
            直接访问新域名
          </a>
          <button v-if="activeHere" type="button" @click="cancel()">
            取消交接
          </button>
        </span>
      </span>
    </StatusNotice>
    <StatusNotice v-if="message" :tone="failed ? 'warning' : 'info'">
      <span class="migration-row">
        {{ message }}
        <span v-if="failed" class="migration-actions">
          <a href="/settings#set-backup">到设置下载迁移备份</a>
        </span>
      </span>
    </StatusNotice>
  </aside>
</template>

<style scoped>
.domain-migration {
  margin: 8px 0;
}
.domain-migration :deep(.q-notice-close) {
  min-width: 34px;
  min-height: 34px;
}
.migration-row,
.migration-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 12px;
}
.migration-row {
  justify-content: space-between;
}
.migration-actions :is(button, a) {
  display: inline-flex;
  align-items: center;
  min-height: 36px;
  color: var(--teal);
  font: inherit;
}
.migration-actions button {
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--surface);
  cursor: pointer;
  font-weight: 700;
}
.migration-actions button:disabled {
  opacity: 0.6;
  cursor: wait;
}
@media (max-height: 600px) {
  .domain-migration {
    margin: 4px 0;
  }
  .migration-actions :is(button, a) {
    min-height: 34px;
  }
}
</style>
