import assert from 'node:assert/strict';
import test from 'node:test';
import {nextTick} from 'vue';
import {EQUIPMENT_COMBOS, OPERATORS, STRATEGIES} from '../data/index.ts';
import {MAX_OPS, blankPlan, newSlot} from '../src/lib/plans/index.ts';

test('preset storage retains configured drafts, flushes on exit and follows cross-page selection', async () => {
  const draft = {
    ...blankPlan('我的阵容'),
    strategy: STRATEGIES[0].name,
    layers: {炎: 40},
  };
  const values = new Map([
    ['wsq.plans', JSON.stringify([draft, blankPlan('我的阵容')])],
    ['wsq.run', 'missing'],
    ['wsq.bans', '["炎","炎","missing"]'],
  ]);
  globalThis.matchMedia = () => ({matches: false});
  globalThis.window = new EventTarget();
  globalThis.document = new EventTarget();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const store = await import('../src/quickref/planStore.ts');
  assert.deepEqual(
    store.plans.map((p) => p.id),
    [draft.id],
  );
  assert.equal(store.runKey.value, '');
  assert.deepEqual([...store.runBans.value], ['炎']);
  store.plans[0].note = '最后一次编辑';
  window.dispatchEvent(new Event('pagehide'));
  assert.equal(JSON.parse(values.get('wsq.plans'))[0].note, '最后一次编辑');
  store.startEdit('炎');
  assert.equal(store.editing.value, true);
  const editingId = store.editingId.value;
  store.startEdit('炎');
  assert.equal(
    store.editingId.value,
    editingId,
    're-entering an edit must reuse the draft',
  );
  store.selectPreset('乌萨斯');
  assert.equal(store.editing.value, false);
  assert.ok(!store.plans.some((p) => p.base === '炎'));
  store.setRun('炎');
  assert.equal(values.get('wsq.run'), '炎');
  store.setRun('missing');
  assert.equal(store.runKey.value, '炎');
  await nextTick();
  store.flushSave();

  const beforeRestore = JSON.stringify(store.plans);
  const beforeStorage = values.get('wsq.plans');
  const setItem = localStorage.setItem;
  localStorage.setItem = () => {
    throw new Error('Quota exceeded');
  };
  assert.throws(() => store.restorePlanBackup([blankPlan('另一台设备')]));
  assert.equal(
    JSON.stringify(store.plans),
    beforeRestore,
    'failed restore must preserve current drafts',
  );
  assert.equal(values.get('wsq.plans'), beforeStorage);
  localStorage.setItem = setItem;
  const restored = store.restorePlanBackup([blankPlan('另一台设备')]);
  assert.equal(restored.additions.length, 1);
  assert.ok(
    JSON.parse(values.get('wsq.plans')).some((p) => p.name === '另一台设备'),
  );
  await nextTick();
  store.flushSave();

  // 测试本局主力/核心/过渡备选索引与跨页快捷编队
  const opA = OPERATORS[0].name;
  const opB = OPERATORS[1].name;
  const opC = OPERATORS[2].name;
  const custom = {
    ...blankPlan('测试联动'),
    ops: [
      {...newSlot(opA), core: true, elite: true, alt: [opC, opB]},
      {...newSlot(opB), alt: [opC]},
    ],
  };
  const customKey = store.addPlan(custom);
  store.setRun(customKey);
  assert.equal(store.inRun.value.has(opA), true);
  assert.equal(store.inRun.value.has(opB), true);
  assert.equal(store.inRunAlt.value.has(opC), true);
  assert.equal(
    store.inRunAlt.value.has(opB),
    false,
    'operator already in main ops must not be classified as alt',
  );
  assert.deepEqual(store.runAltTargets.value.get(opC), [opA, opB]);
  assert.equal(store.inRunAny.value.has(opC), true);
  assert.equal(store.runSlotMap.value.get(opA)?.core, true);

  const addResult = store.toggleOpInQuickBuild(opC);
  assert.equal(addResult.status, 'added');
  assert.equal(store.inRun.value.has(opC), true);
  const removeResult = store.toggleOpInQuickBuild(opC);
  assert.equal(removeResult.status, 'removed');
  assert.equal(store.inRun.value.has(opC), false);

  for (const extra of OPERATORS.slice(2, 2 + MAX_OPS)) {
    store.toggleOpInQuickBuild(extra.name);
  }
  assert.equal(store.quickTargetPreset.value.plan.ops.length, MAX_OPS);
  const overflow = OPERATORS.find((o) => !store.inRun.value.has(o.name)).name;
  assert.equal(store.toggleOpInQuickBuild(overflow).status, 'full');

  // 删除全部自建流派后，快捷编队应自动新建并设为本局
  store.setRun('');
  for (const key of store.myPresets.value.map((p) => p.key)) {
    store.removePreset(key);
  }
  const createdResult = store.toggleOpInQuickBuild(opA);
  assert.equal(createdResult.status, 'created');
  assert.equal(store.runKey.value, createdResult.key);
  assert.equal(store.inRun.value.has(opA), true);

  // 测试本局装备归属、合成材料反查与本局策略索引
  const combo = EQUIPMENT_COMBOS[0];
  assert.ok(combo, 'season must have at least one equipment combo');
  const eqPlan = {
    ...blankPlan('配装策略测试'),
    ops: [{...newSlot(opA), eq: [combo[2]]}],
    strategy: STRATEGIES[0].name,
  };
  const eqKey = store.addPlan(eqPlan);
  store.setRun(eqKey);
  assert.deepEqual(store.runEquipOwners.value.get(combo[2]), [opA]);
  assert.equal(store.runEquipRecommended.value.has(combo[2]), true);
  assert.deepEqual(store.runEquipMaterials.value.get(combo[0]), [combo[2]]);
  assert.deepEqual(store.runEquipMaterials.value.get(combo[1]), [combo[2]]);
  assert.equal(store.runStrategies.value.primary, STRATEGIES[0].name);
  assert.equal(store.runStrategies.value.all.has(STRATEGIES[0].name), true);

  store.setRun('炎');
  assert.equal(store.runBaseBuild.value?.name, '炎');
  assert.ok(store.runStrategies.value.all.size >= 1);

  await nextTick();
  store.flushSave();
});
