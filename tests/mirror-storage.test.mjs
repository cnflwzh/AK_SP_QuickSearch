import assert from 'node:assert/strict';
import test from 'node:test';
import {nextTick} from 'vue';
import {blankPlan, PLANS_STORAGE_KEY} from '../src/lib/plans/storage.ts';
import {createDefaultSettings} from '../src/lib/settings/model.ts';
import {
  parseSettingsBackup,
  serializeSettingsBackup,
} from '../src/lib/settings/backup.ts';

test('站点间交接只以真实保存的内容判定成功', async (t) => {
  const disk = new Map();
  let rejectKey;
  globalThis.localStorage = {
    getItem: (key) => disk.get(key) ?? null,
    setItem(key, value) {
      if (key === rejectKey) throw new Error('Quota exceeded');
      disk.set(key, value);
    },
    removeItem: (key) => disk.delete(key),
  };
  const {previewMirrorBackup, commitMirrorBackup, exportMirrorBackup} =
    await import('../src/quickref/mirrorBackupStore.ts');
  const {plans, flushSave} = await import('../src/quickref/planStore.ts');
  const {BOX_STORAGE_KEY, exportOperatorBox} =
    await import('../src/lib/box/store.ts');
  const {SETTINGS_STORAGE_KEY, settings} =
    await import('../src/lib/settings/store.ts');
  const incoming = parseSettingsBackup(
    serializeSettingsBackup(
      {...createDefaultSettings(), theme: 'dark'},
      [blankPlan('对站流派')],
      {char_325_bison: 3},
    ),
  );
  const all = {plans: true, settings: true, box: true};

  await t.test(
    '每个分组写入失败均恢复原始字节，取消再取回和直接重试都以磁盘为准',
    () => {
      for (const previous of [null, '{ "char_325_bison": 0 }']) {
        disk.clear();
        if (previous !== null) disk.set(BOX_STORAGE_KEY, previous);
        disk.set(SETTINGS_STORAGE_KEY, '{  "theme": "light" }');
        const before = new Map(disk);
        for (rejectKey of [
          BOX_STORAGE_KEY,
          SETTINGS_STORAGE_KEY,
          PLANS_STORAGE_KEY,
        ]) {
          const preview = previewMirrorBackup(incoming);
          assert.throws(
            () => commitMirrorBackup(preview, incoming, all),
            /写入失败/,
          );
          assert.deepEqual(disk, before);
          assert.equal(plans.length, 0);
          assert.notEqual(settings.theme, 'dark');
          assert.notEqual(exportOperatorBox().char_325_bison, 3);
          const retry = previewMirrorBackup(incoming);
          assert.equal(retry.changes.plans, 1);
          assert.equal(retry.changes.newOperators + retry.changes.upgrades, 1);
        }
      }
      rejectKey = undefined;
      commitMirrorBackup(previewMirrorBackup(incoming), incoming, all);
      assert.equal(JSON.parse(disk.get(BOX_STORAGE_KEY)).char_325_bison, 3);
      assert.equal(JSON.parse(disk.get(SETTINGS_STORAGE_KEY)).theme, 'dark');
      assert.equal(JSON.parse(disk.get(PLANS_STORAGE_KEY)).length, 1);
      assert.equal(previewMirrorBackup(incoming).changes.plans, 0);
    },
  );

  await t.test(
    '旧标签页发送最近保存的流派；预览后发生并发编辑时保留对方更新',
    () => {
      const resident = blankPlan('原流派');
      const newer = blankPlan('另一标签页新增');
      disk.set(PLANS_STORAGE_KEY, JSON.stringify([resident]));
      const preview = previewMirrorBackup(incoming);
      disk.set(PLANS_STORAGE_KEY, JSON.stringify([resident, newer]));
      assert.throws(
        () => commitMirrorBackup(preview, incoming, all),
        /其他标签页已更新流派/,
      );
      const result = parseSettingsBackup(exportMirrorBackup());
      assert.deepEqual(result.plans, [resident, newer]);
      plans[0].note = '尚未落盘的本页编辑';
      assert.equal(
        parseSettingsBackup(exportMirrorBackup()).plans[0].note,
        plans[0].note,
      );
      assert.equal(JSON.parse(disk.get(PLANS_STORAGE_KEY))[0].note, '');
      flushSave(true);
    },
  );

  await t.test('损坏的原始存档阻止收发；离页保存也保留原文', async () => {
    for (const [key, invalid] of [
      [PLANS_STORAGE_KEY, '[{"name":"尚可恢复"}'],
      [PLANS_STORAGE_KEY, '{}'],
      [PLANS_STORAGE_KEY, '[null]'],
      [BOX_STORAGE_KEY, '[]'],
      [SETTINGS_STORAGE_KEY, ''],
    ]) {
      disk.set(key, invalid);
      const before = new Map(disk);
      assert.throws(() => exportMirrorBackup(), /存档损坏/);
      assert.throws(() => previewMirrorBackup(incoming), /存档损坏/);
      await nextTick();
      flushSave(true);
      assert.deepEqual(disk, before);
      disk.delete(key);
    }
  });
});
