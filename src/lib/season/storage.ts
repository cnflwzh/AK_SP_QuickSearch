import {LEGACY_SEASON_ID, SEASON_META} from '../../../data/index.ts';

/** 为赛季生成存档键，未加后缀的历史键永久分配给序列Ⅰ。 */
export function seasonStorageKey(key: string, season = SEASON_META.id): string {
  return season === LEGACY_SEASON_ID ? key : `${key}.season.${encodeURIComponent(season)}`;
}

/** 区分「未授权读取」与「空存档」，调用方可以安全决定是否继续交接。 */
export function readStoredItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (cause) {
    throw new Error('无法读取本站存档，请检查浏览器的站点存储权限后重试。', {cause});
  }
}

/** 没有赛季字段的已发布备份属于 S1；必须先核对赛季，再按当前实体表校验。 */
export function checkBackupSeason(season: unknown): void {
  if ((season === undefined ? LEGACY_SEASON_ID : season) !== SEASON_META.id)
    throw new Error('此备份属于其他赛季，请在对应赛季导入。');
}

export interface StorageChange {
  key: string;
  before: string | null;
  after: string | null;
}

/** 核对同站快照并顺序写入，末尾可提交带独立并发保护的流派。失败时撤回本次仍持有的更改。 */
export function commitStorageChanges<T>(changes: readonly StorageChange[], finish: () => T): T {
  const written: StorageChange[] = [];
  try {
    for (const change of changes) {
      if (readStoredItem(change.key) !== change.before)
        throw new Error('其他标签页已更新存档，请重新读取后重试。');
      if (change.after === change.before) continue;
      if (change.after === null) localStorage.removeItem(change.key);
      else localStorage.setItem(change.key, change.after);
      written.push(change);
    }
    return finish();
  } catch (cause) {
    let failed = false;
    for (const {key, before, after} of written.reverse()) {
      try {
        if (readStoredItem(key) !== after) continue;
        if (before === null) localStorage.removeItem(key);
        else localStorage.setItem(key, before);
      } catch {
        failed = true;
      }
    }
    if (failed)
      throw new Error('本机存储写入失败，部分内容未能撤回。请保留备份并检查浏览器存储权限。', {cause});
    const reason = cause instanceof Error ? cause.message : '';
    throw new Error(`本机存储写入失败，请检查空间或权限后重试。${reason}`, {cause});
  }
}
