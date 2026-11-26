import {defineAsyncComponent} from 'vue';
import {isLegacyOrigin, migrationEnabled} from '../settings/domainMigration.ts';
import {mirrorEntryToken} from '../settings/mirrorSite.ts';

/** 三个入口共享提示。交接窗口打开时优先展示接收页。 */
export const MigrationNotice =
  migrationEnabled &&
  window.top === window &&
  isLegacyOrigin(location.origin) &&
  !mirrorEntryToken
    ? defineAsyncComponent(() => import('./MigrationNotice.vue'))
    : null;
