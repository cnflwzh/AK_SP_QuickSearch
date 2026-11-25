import assert from 'node:assert/strict';
import test from 'node:test';
import {SEASON_META} from '../data/index.ts';
import {BORROWABLE_SIX_STARS, BOX_RANK_BORROWED} from '../src/lib/box/model.ts';
import {BOX_STORAGE_KEY, boxStorageChanges, readBoxSnapshot} from '../src/lib/box/persistence.ts';
import {blankPlan} from '../src/lib/plans/storage.ts';
import {parsePlanBackup, serializePlanBackup} from '../src/lib/plans/backup.ts';
import {parseSettingsBackup, serializeSettingsBackup} from '../src/lib/settings/backup.ts';
import {createDefaultSettings} from '../src/lib/settings/model.ts';
import {commitStorageChanges, seasonStorageKey} from '../src/lib/season/storage.ts';

test('旧键与无标记备份归 S1，新赛季独立保存阵容和本局阶段', () => {
  const season = SEASON_META.id;
  const prefs = createDefaultSettings();
  const s1 = JSON.parse(serializePlanBackup([blankPlan('旧方案')]));
  delete s1.season;
  assert.equal(parsePlanBackup(JSON.stringify(s1)).season, 's1');
  const oldSettings = serializeSettingsBackup(prefs, [blankPlan('旧方案')], {});
  const preferencesOnly = serializeSettingsBackup(prefs);
  const account = serializeSettingsBackup(prefs, [], {char_325_bison: 2});
  try {
    SEASON_META.id = 'season_fixture';
    for (const key of ['wsq.plans', 'wsq.run', 'wsq.runStage', 'wsq.bans', 'wsq.leader']) {
      assert.notEqual(seasonStorageKey(key), key);
      assert.equal(seasonStorageKey(key, 's1'), key);
    }
    assert.throws(() => parsePlanBackup(JSON.stringify(s1)), /其他赛季/);
    assert.throws(() => parseSettingsBackup(oldSettings), /其他赛季/);
    assert.deepEqual(parseSettingsBackup(preferencesOnly).settings, prefs);
    assert.deepEqual(parseSettingsBackup(account).box, {char_325_bison: 2});
    const next = serializePlanBackup([blankPlan('新赛季阵容')]);
    assert.equal(parsePlanBackup(next).version, 4);
    SEASON_META.id = season;
    assert.throws(() => parsePlanBackup(next), /其他赛季/);
  } finally {
    SEASON_META.id = season;
  }
});

test('不同赛季的借用独立，自持与仍打开的 S1 客户端持续双向互通', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const disk = new Map();
  const [a, b] = BORROWABLE_SIX_STARS.map((op) => op.avatar);
  const storage = {
    getItem: (key) => disk.get(key) ?? null,
    setItem: (key, value) => disk.set(key, value),
    removeItem: (key) => disk.delete(key),
  };
  Object.defineProperty(globalThis, 'localStorage', {value: storage, configurable: true});
  function change(season, avatar, rank) {
    const snapshot = readBoxSnapshot(season);
    const after = {...snapshot.box};
    if (rank === undefined) delete after[avatar];
    else after[avatar] = rank;
    commitStorageChanges(boxStorageChanges(snapshot, after), () => undefined);
  }
  try {
    disk.set(BOX_STORAGE_KEY, JSON.stringify({[a]: BOX_RANK_BORROWED}));
    assert.equal(readBoxSnapshot('s1').box[a], BOX_RANK_BORROWED);
    assert.equal(readBoxSnapshot('s2').box[a], undefined);
    change('s2', b, BOX_RANK_BORROWED);
    assert.deepEqual(JSON.parse(disk.get(BOX_STORAGE_KEY)), {[a]: BOX_RANK_BORROWED});
    // 旧客户端随后按 v1 格式写入；新的 S2 标签页必须看到最新自持和自己的借用。
    disk.set(BOX_STORAGE_KEY, JSON.stringify({[a]: 2}));
    assert.deepEqual(readBoxSnapshot('s2').box, {[a]: 2, [b]: BOX_RANK_BORROWED});
    change('s2', b, 3);
    assert.deepEqual(JSON.parse(disk.get(BOX_STORAGE_KEY)), {[a]: 2, [b]: 3});
    const originalDisk = new Map(disk);
    const write = localStorage.setItem;
    localStorage.setItem = (key, value) => {
      if (key === readBoxSnapshot('s2').borrowKey) throw new Error('quota');
      return write(key, value);
    };
    assert.throws(() => change('s2', b, BOX_RANK_BORROWED), /写入失败/);
    assert.deepEqual(disk, originalDisk);
    localStorage.setItem = write;
    change('s2', b, BOX_RANK_BORROWED);
    assert.equal(readBoxSnapshot('s1').box[b], undefined);
    assert.equal(readBoxSnapshot('s2').box[b], BOX_RANK_BORROWED);
  } finally {
    if (original === undefined) delete globalThis.localStorage;
    else Object.defineProperty(globalThis, 'localStorage', original);
  }
});
