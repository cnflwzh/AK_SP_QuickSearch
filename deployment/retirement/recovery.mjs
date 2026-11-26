/* global document, location, window */
import {createApp, h, ref} from 'vue';
import {SEASON_META} from '../../data/index.ts';
import {migrationPeer} from '../../src/lib/settings/domainMigration.ts';
import {mirrorEntryToken} from '../../src/lib/settings/mirrorSite.ts';
import {downloadBlob} from '../../src/lib/ui/download.ts';
import {useRetiredBackupSource} from '../../src/quickref/components/useMirrorBackup.ts';
import {exportMirrorBackup} from '../../src/quickref/mirrorBackupStore.ts';

const target = migrationPeer(location.origin);
if (target && !mirrorEntryToken) {
  const url = new URL(location.href);
  url.host = new URL(target.origin).host;
  location.replace(url.href);
} else if (target && window.top === window) {
  createApp({
    setup() {
      const session = useRetiredBackupSource(exportMirrorBackup);
      const downloadMessage = ref('');
      function downloadBackup() {
        try {
          downloadBlob(
            new Blob([exportMirrorBackup(true)], {type: 'application/json'}),
            `卫戍速查-旧站迁移存档-${SEASON_META.id}.json`,
          );
          downloadMessage.value = '请到新网址的设置页导入下载的配置文件。';
        } catch (cause) {
          downloadMessage.value =
            cause instanceof Error ? cause.message : '导出失败，请重新取回。';
        }
      }
      return () =>
        h('main', [
          h('h1', '从旧网址取回存档'),
          h('p', `来源赛季：${SEASON_META.title}（${SEASON_META.id}）`),
          h('p', {role: 'status'}, session.message.value || '正在连接新网址…'),
          h(
            'button',
            {type: 'button', onClick: downloadBackup},
            '下载旧站配置文件',
          ),
          downloadMessage.value &&
            h('p', {role: 'status'}, downloadMessage.value),
        ]);
    },
  }).mount(document.getElementById('recovery'));
}
