import assert from 'node:assert/strict';
import test from 'node:test';
import {SEASON_META} from '../data/index.ts';
import {BOX_STORAGE_KEY} from '../src/lib/box/persistence.ts';
import {blankPlan, PLANS_STORAGE_KEY} from '../src/lib/plans/storage.ts';
import {toolStorageKeys} from '../src/lib/season/toolKeys.ts';
import {createDefaultSettings} from '../src/lib/settings/model.ts';
import {
  parseMigrationBackup,
  parseSettingsBackup,
  serializeSettingsBackup,
} from '../src/lib/settings/backup.ts';

const settings = {...createDefaultSettings(), theme: 'dark'};
const recent = [{kind: 'op', name: '拜松'}];
const options = {
  settings: true,
  box: true,
  plans: true,
  tools: ['mistakes', 'recent'],
};

test('跨季迁移先识别版本和来源，保留完整旧季原文，通用项可独立恢复', () => {
  const season = SEASON_META.id;
  const encoded = (version, extra = {}) =>
    JSON.stringify(
      {
        format: 'weishu-quickref-settings',
        version,
        exportedAt: '2026-11-23',
        settings,
        plans: [{id: 'past', ops: [{name: '仅上一赛季存在'}]}],
        box: {
          char_325_bison: 1,
          拜松: 2,
          char_9900_previous: 3,
          char_9901_borrowed: -2,
          旧版未知别名: 0,
        },
        ...(version >= 4 ? {season} : {}),
        ...(version === 5
          ? {tools: {recent: [{kind: 'op', name: '旧季干员'}], mistakes: []}}
          : {}),
        ...extra,
      },
      null,
      2,
    );
  try {
    SEASON_META.id = 'next-season';
    for (const version of [1, 2, 3, 4, 5]) {
      const text = '\uFEFF' + encoded(version);
      if (version < 5)
        assert.throws(() => parseSettingsBackup(text), /其他赛季/);
      const migration =
        version === 5 ? parseSettingsBackup(text) : parseMigrationBackup(text);
      assert.equal(migration.season, season);
      assert.equal(migration.settings.theme, 'dark');
      assert.deepEqual(migration.box, {
        char_325_bison: 2,
        char_9900_previous: 3,
      });
      assert.deepEqual(migration.tools, {});
      assert.equal(migration.plans, undefined);
      assert.equal(migration.archive.text, text);
      assert.equal(migration.archive.plans, 1);
      assert.equal(migration.archive.borrowed, 1);
      assert.equal(migration.archive.otherBox, 1);
      assert.equal(migration.archive.recent, version === 5 ? 1 : 0);
    }
    assert.throws(
      () => parseMigrationBackup(encoded(4, {season: undefined})),
      /来源赛季/,
    );
    assert.throws(
      () => parseMigrationBackup(encoded(5, {tools: null})),
      /工具备份/,
    );
    assert.throws(
      () => parseMigrationBackup(encoded(5, {tools: {daily: {}}})),
      /不支持/,
    );
  } finally {
    SEASON_META.id = season;
  }
  const legacy = serializeSettingsBackup(settings, [blankPlan('旧站流派')]);
  assert.equal(parseSettingsBackup(legacy).tools, undefined);
  assert.deepEqual(parseMigrationBackup(legacy).tools, {});
});

test('同季只迁移可复用历史，按预览选择、检测并发、失败回滚并可重复接收', async (t) => {
  const disk = new Map();
  let rejectKey;
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key) => disk.get(key) ?? null,
      setItem(key, value) {
        if (key === rejectKey) throw new Error('Quota exceeded');
        disk.set(key, value);
      },
      removeItem: (key) => disk.delete(key),
    },
  });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  });
  const plan = blankPlan('迁移的流派');
  disk.set(PLANS_STORAGE_KEY, JSON.stringify([plan]));
  disk.set(BOX_STORAGE_KEY, JSON.stringify({char_325_bison: 3}));
  disk.set(toolStorageKeys.recent, JSON.stringify(recent));
  const game = (
    await import('../src/quickref/numbers/useDealerGame.ts')
  ).useDealerGame();
  game.tapCard(game.round.value.cards.findIndex((card) => !card.isImpostor));
  const excluded = [
    'wsq.run',
    'wsq.runStage',
    'wsq.bans',
    'wsq.leader',
    'wsq.tools.advisor.v1',
    'wsq.dealer.daily.v3',
  ];
  for (const key of excluded) disk.set(key, '来源对局标记' + key);
  const {exportMirrorBackup, previewMirrorBackup, commitMirrorBackup} =
    await import('../src/quickref/mirrorBackupStore.ts');
  const backupText = exportMirrorBackup(true);
  assert.ok(!backupText.includes('来源对局标记'));
  const backup = parseSettingsBackup(backupText);
  assert.equal(backup.version, 5);
  assert.deepEqual(backup.plans, [plan]);
  assert.deepEqual(backup.box, {char_325_bison: 3});
  assert.deepEqual(backup.tools.recent, recent);
  assert.equal(backup.tools.mistakes.length, 1);
  assert.deepEqual(Object.keys(backup.tools).sort(), ['mistakes', 'recent']);
  assert.equal(parseSettingsBackup(exportMirrorBackup()).tools, undefined);
  for (const tools of [
    {run: {}},
    {advisor: {}},
    {daily: {}},
    {recent: Array(9).fill(recent[0])},
    {recent: [{kind: 'op', name: '不存在'}]},
    {mistakes: Array(151).fill({})},
    {mistakes: [{...backup.tools.mistakes[0], targetKey: '其他赛季的题型'}]},
  ]) {
    assert.throws(() =>
      parseSettingsBackup(JSON.stringify({...backup, tools})),
    );
  }

  disk.clear();
  for (const key of excluded) disk.set(key, '目标原有对局' + key);
  const preview = previewMirrorBackup(backup);
  assert.equal(preview.changes.empty, true);
  assert.ok(preview.changes.tools.every((row) => row.changed && !row.existing));
  const before = new Map(disk);
  for (rejectKey of [toolStorageKeys.recent, PLANS_STORAGE_KEY]) {
    assert.throws(
      () => commitMirrorBackup(preview, backup, options),
      /写入失败/,
    );
    assert.deepEqual(disk, before);
  }
  rejectKey = undefined;
  disk.set(toolStorageKeys.recent, '[{"kind":"cv","name":"炎"}]');
  const concurrent = new Map(disk);
  assert.throws(
    () => commitMirrorBackup(preview, backup, options),
    /其他标签页/,
  );
  assert.deepEqual(disk, concurrent);
  const conflict = previewMirrorBackup(backup);
  assert.equal(conflict.changes.empty, false);
  assert.equal(
    conflict.changes.tools.find((row) => row.id === 'recent').existing,
    1,
  );
  commitMirrorBackup(conflict, backup, {...options, tools: ['mistakes']});
  assert.equal(JSON.parse(disk.get(toolStorageKeys.recent))[0].kind, 'cv');
  const retry = previewMirrorBackup(backup);
  assert.equal(retry.changes.plans, 0);
  assert.deepEqual(
    retry.changes.tools.filter((row) => row.changed).map((row) => row.id),
    ['recent'],
  );
  commitMirrorBackup(retry, backup, {...options, tools: ['recent']});
  assert.ok(
    previewMirrorBackup(backup).changes.tools.every((row) => !row.changed),
  );
  for (const key of excluded) assert.equal(disk.get(key), '目标原有对局' + key);
});
