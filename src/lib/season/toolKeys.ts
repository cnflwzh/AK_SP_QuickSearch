import {seasonStorageKey} from './storage.ts';

/** 实际写入用户工具数据的赛季键。迁移按此清单读取，以免携带浏览器诊断、导航和其他站内状态。 */
export const toolStorageKeys = {
  mistakes: seasonStorageKey('wsq.dealer.mistakes.v1'),
  recent: seasonStorageKey('wsq.recent.v1'),
} as const;
