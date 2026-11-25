import {LEGACY_SEASON_ID, SEASON_META} from '../../../data/index.ts';
import {readStoredItem, seasonStorageKey, type StorageChange} from '../season/storage.ts';
import {
  AVATAR_KEY_RE,
  BOX_RANK_BORROWED,
  isValidBoxRank,
  isValidOwnedBoxRank,
  mergeBoxRank,
  normalizeOperatorBox,
  resolveBoxKey,
  type OperatorBox,
} from './model.ts';

// v1 始终是账号练度的唯一来源；早期 S1 页面也会在此键写入自持练度及本季助战。
export const BOX_STORAGE_KEY = 'wsq.box.v1';
export const borrowStorageKey = (season = SEASON_META.id): string | null =>
  season === LEGACY_SEASON_ID ? null : seasonStorageKey('wsq.box.borrowed', season);

interface BoxSnapshot {
  raw: string | null;
  rawBorrowed: string | null;
  borrowKey: string | null;
  account: OperatorBox;
  borrowed: readonly string[];
  box: OperatorBox;
}

/** 合并共享账号练度与指定赛季助战，原始快照用于并发校验与失败回滚。 */
export function readBoxSnapshot(season = SEASON_META.id): BoxSnapshot {
  const raw = readStoredItem(BOX_STORAGE_KEY);
  const borrowKey = borrowStorageKey(season);
  const rawBorrowed = borrowKey ? readStoredItem(borrowKey) : null;
  try {
    const value: unknown = JSON.parse(raw ?? '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error('账号练度格式无效');
    const account: OperatorBox = Object.create(null);
    for (const [label, rank] of Object.entries(value)) {
      const key = AVATAR_KEY_RE.test(label) ? label : resolveBoxKey(label);
      if (key && isValidBoxRank(rank)) mergeBoxRank(account, key, rank);
    }
    const entries: unknown = JSON.parse(rawBorrowed ?? '[]');
    if (!Array.isArray(entries) || !entries.every((id) => typeof id === 'string' && AVATAR_KEY_RE.test(id)))
      throw new Error('赛季助战格式无效');
    const borrowed = [...new Set<string>(entries)];
    const view: OperatorBox = Object.fromEntries(borrowed.map((id) => [id, BOX_RANK_BORROWED]));
    for (const [id, rank] of Object.entries(account)) {
      if (!borrowKey || rank !== BOX_RANK_BORROWED) view[id] = rank;
    }
    return {raw, rawBorrowed, borrowKey, account, borrowed, box: normalizeOperatorBox(view)};
  } catch (cause) {
    throw new Error('本站 Box 存档损坏，已停止写入并保留原始存档。', {cause});
  }
}

/** 将本季视图的变更映射到相应存储键，其他赛季的借用名单独立保留。 */
export function boxStorageChanges(snapshot: BoxSnapshot, after: Readonly<OperatorBox>): StorageChange[] {
  const account = {...snapshot.account};
  const borrowed = new Set(snapshot.borrowed);
  let accountChanged = false;
  for (const avatar of new Set([...Object.keys(snapshot.box), ...Object.keys(after)])) {
    const rank = after[avatar];
    if (rank === snapshot.box[avatar]) continue;
    // S1 的 -2 对其他赛季不可见。其他赛季只在用户标成自持或撤销自持时改账号档案。
    if (!snapshot.borrowKey || isValidOwnedBoxRank(rank) || isValidOwnedBoxRank(account[avatar])) {
      const accountRank = snapshot.borrowKey && rank === BOX_RANK_BORROWED ? undefined : rank;
      if (account[avatar] !== accountRank) {
        accountChanged = true;
        if (accountRank === undefined) delete account[avatar];
        else account[avatar] = accountRank;
      }
    }
    if (rank === BOX_RANK_BORROWED) borrowed.add(avatar);
    else borrowed.delete(avatar);
  }
  const result: StorageChange[] = [{
    key: BOX_STORAGE_KEY, before: snapshot.raw,
    after: accountChanged ? JSON.stringify(account) : snapshot.raw,
  }];
  if (snapshot.borrowKey) {
    const changed = borrowed.size !== snapshot.borrowed.length || snapshot.borrowed.some((id) => !borrowed.has(id));
    result.push({key: snapshot.borrowKey, before: snapshot.rawBorrowed,
      after: changed ? JSON.stringify([...borrowed]) : snapshot.rawBorrowed});
  }
  return result;
}
