import assert from 'node:assert/strict';
import test from 'node:test';
import { EQUIPMENT, STRATEGIES } from '../data/index.ts';
import { blankPlan, builtinPlan, newSlot } from '../src/lib/plans/index.ts';
import { mergePlanBackup, parsePlanBackup, serializePlanBackup } from '../src/lib/plans/backup.ts';
import {loadPlans} from '../src/lib/plans/storage.ts';
import {parseSettingsBackup, serializeSettingsBackup} from '../src/lib/settings/backup.ts';
import {normalizeSettings} from '../src/lib/settings/model.ts';

test('backup round trip retains custom builds, preset edits and all lineup settings', () => {
  const custom = {
    ...blankPlan('手机迁移'), note: '换设备保留\n说明与层数', strategy: STRATEGIES[0].name,
    layers: { 炎: 999, 灵巧: 40 },
    ops: [{ ...newSlot('夕'), elite: true, core: true, eq: [EQUIPMENT[0].name, EQUIPMENT[0].name], alt: ['烛煌', '黍'] }],
  };
  const preset = { ...builtinPlan('炎'), id: 'edited-yan', note: '我修改过的预设' };
  const original = structuredClone([custom, preset]);
  const restored = parsePlanBackup(serializePlanBackup(original));
  assert.deepEqual(restored.plans, original);
  const merged = mergePlanBackup([], restored.plans);
  assert.equal(merged.additions.length, 2);
  assert.equal(merged.additions[1].base, '炎');
  assert.notEqual(merged.additions[0].id, custom.id);
  assert.deepEqual(mergePlanBackup(merged.additions, restored.plans), { additions: [], skipped: 2, conflicts: 0 });
  assert.deepEqual(restored.plans, original);
});

test('restore merges different versions without overwriting and repeated restore is idempotent', () => {
  const local = { ...builtinPlan('炎'), id: 'same-id', note: '本机版本' };
  const incoming = { ...structuredClone(local), note: '另一台设备的版本' };
  const snapshot = structuredClone(local);
  const merged = mergePlanBackup([local], [incoming, structuredClone(incoming)]);
  assert.equal(merged.additions.length, 1);
  assert.equal(merged.conflicts, 1);
  assert.equal(merged.skipped, 1);
  assert.equal(merged.additions[0].base, undefined);
  assert.notEqual(merged.additions[0].id, local.id);
  assert.deepEqual(local, snapshot);
  assert.deepEqual(mergePlanBackup([local, ...merged.additions], [incoming]), { additions: [], skipped: 1, conflicts: 0 });
});

test('a custom icon survives local, plan and settings backups and distinguishes otherwise identical plans', () => {
  const original = blankPlan('我的流派');
  const changed = {...original, icon: {kind: 'equipment', name: EQUIPMENT[0].name}};
  const backup = parsePlanBackup(serializePlanBackup([changed]));
  assert.equal(backup.version, 3);
  assert.deepEqual(backup.plans, [changed]);
  assert.deepEqual(loadPlans(JSON.stringify([changed])), [changed]);
  const settings = parseSettingsBackup(serializeSettingsBackup(normalizeSettings({}), [changed]));
  assert.equal(settings.version, 3);
  assert.deepEqual(settings.plans, [changed]);
  const {additions} = mergePlanBackup([original], backup.plans);
  assert.deepEqual(additions[0].icon, changed.icon);
  assert.equal(mergePlanBackup(additions, backup.plans).skipped, 1);
  const invalid = {...original, icon: {kind: '__proto__', name: 'invalid'}};
  assert.deepEqual(loadPlans(JSON.stringify([invalid])), [original]);
  assert.throws(() => parsePlanBackup(serializePlanBackup([invalid])));
});

test('invalid backups fail as a whole instead of silently removing unknown lineup data', () => {
  const backup = JSON.parse(serializePlanBackup([{ ...blankPlan('完整阵容'), ops: [newSlot('夕')] }]));
  for (const mutate of [
    value => { value.version = 999; },
    value => { value.plans[0].ops[0].name = 'missing'; },
    value => { value.plans[0].ops[0].eq = ['missing']; },
    value => { value.plans[0].layers = { 炎: -1 }; },
    value => { value.plans.push({ name: '损坏记录' }); },
  ]) {
    const invalid = structuredClone(backup);
    mutate(invalid);
    assert.throws(() => parsePlanBackup(JSON.stringify(invalid)));
  }
  assert.throws(() => parsePlanBackup('{'));
  const retired = structuredClone(backup);
  retired.plans[0].base = '已移除的预设';
  assert.equal(parsePlanBackup(JSON.stringify(retired)).plans[0].base, undefined);
});
