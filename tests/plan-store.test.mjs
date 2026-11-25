import assert from 'node:assert/strict';
import test from 'node:test';
import {nextTick} from 'vue';
import {
  EQUIPMENT_COMBOS,
  LEADERS,
  OPERATORS,
  STRATEGIES,
} from '../data/index.ts';
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
    removeItem: (key) => values.delete(key),
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
  const quotaMessage = store.saveErrorMessage.value;
  assert.match(quotaMessage, /下载 JSON/);
  store.flushSave(true);
  assert.equal(
    store.saveErrorMessage.value,
    quotaMessage,
    'an idle pagehide save must keep the warning for the rejected transaction',
  );
  localStorage.setItem = setItem;
  const restored = store.restorePlanBackup([blankPlan('另一台设备')]);
  assert.equal(restored.additions.length, 1);
  assert.equal(store.saveErrorMessage.value, '');
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

  // 测试本局领袖锚点、全局禁池联动、装备/策略快捷编队与自建流派反查
  const leaderName = LEADERS[0].name;
  store.setRunLeader(leaderName);
  assert.equal(store.runLeaderKey.value, leaderName);
  assert.equal(store.runLeader.value?.name, leaderName);
  assert.equal(values.get('wsq.leader'), leaderName);

  const customCheck = {
    ...blankPlan('详情反查与禁池测试'),
    ops: [{...newSlot(opA), eq: [combo[2]]}],
    strategy: STRATEGIES[0].name,
  };
  const customCheckKey = store.addPlan(customCheck);
  store.setRun(customCheckKey);
  assert.ok(store.presetsUsing('op', opA).includes(customCheckKey));
  assert.ok(store.presetsUsing('eq', combo[2]).includes(customCheckKey));
  assert.ok(
    store.presetsUsing('st', STRATEGIES[0].name).includes(customCheckKey),
  );

  assert.equal(store.toggleEquipInQuickBuild(opA, combo[0]), 'added');
  assert.equal(store.runEquipOwners.value.get(combo[0])?.[0], opA);
  assert.equal(store.toggleEquipInQuickBuild(opA, combo[0]), 'removed');
  assert.equal(store.setStrategyInQuickBuild(STRATEGIES[1].name).status, 'set');
  assert.equal(store.runStrategies.value.primary, STRATEGIES[1].name);

  store.toggleBan(OPERATORS[0].covenants[0]);
  assert.equal(store.isRunBannedOp(opA), true);
  store.endRun();
  assert.equal(store.runKey.value, '');
  assert.equal(store.runLeaderKey.value, '');
  assert.equal(store.runBans.value.length, 0);

  const stagedKey = store.addPlan({
    ...blankPlan('阶段联动'),
    strategy: STRATEGIES[0].name,
    strategyAlternates: [STRATEGIES[1].name, STRATEGIES[2].name],
    stages: [
      {from: 1, to: 4, ops: [newSlot(opA)], note: '开局', layers: {炎: 16}},
      {from: 5, to: 9, ops: [newSlot(opB)], note: '过渡', layers: {}},
    ],
  });
  store.setRun(stagedKey);
  assert.equal(store.runStageKey.value, '1-4');
  assert.equal(store.runFormation.value.layers.炎, 16);
  store.setRun(stagedKey, '5-9');
  assert.equal(values.get('wsq.runStage'), '5-9');
  assert.deepEqual([...store.inRun.value], [opB]);
  assert.deepEqual(
    store.quickTargetOps.value.map((op) => op.name),
    [opB],
  );
  assert.equal(store.toggleEquipInQuickBuild(opB, combo[0]), 'added');
  assert.ok(store.presetsUsing('eq', combo[0]).includes(stagedKey));
  assert.ok(store.runStrategies.value.all.has(STRATEGIES[2].name));
  assert.equal(store.presetOf(stagedKey).plan.ops.length, 0);
  store.endRun();
  assert.equal(values.get('wsq.runStage'), '');

  // run 可写但阶段失败时，两键都恢复原字节。
  const beforeSelection = [values.get('wsq.run'), values.get('wsq.runStage')];
  localStorage.setItem = (key, value) => {
    if (key === 'wsq.runStage') throw new Error('Quota exceeded');
    return setItem(key, value);
  };
  store.setRun(stagedKey, '5-9');
  assert.deepEqual([values.get('wsq.run'), values.get('wsq.runStage')], beforeSelection);
  assert.match(store.saveErrorMessage.value, /本局设置只在当前页面生效/);
  localStorage.setItem = setItem;
  store.endRun();

  // 阵容本身可能刚好存得下，而随后的本局 ID / 阶段写入超出配额。
  localStorage.setItem = (key, value) => {
    if (key === 'wsq.run' || key === 'wsq.runStage')
      throw new Error('Quota exceeded');
    return setItem(key, value);
  };
  store.setRun(stagedKey, '5-9');
  assert.equal(store.runKey.value, stagedKey);
  assert.equal(values.get('wsq.run'), '');
  assert.equal(values.get('wsq.runStage'), '');
  assert.match(store.saveErrorMessage.value, /本局设置只在当前页面生效/);
  localStorage.setItem = setItem;
  store.flushSave(true);
  assert.equal(values.get('wsq.run'), stagedKey);
  assert.equal(values.get('wsq.runStage'), '5-9');
  assert.equal(store.saveErrorMessage.value, '');

  localStorage.setItem = (key, value) => {
    if (key === 'wsq.run') throw new Error('Quota exceeded');
    return setItem(key, value);
  };
  store.setRun('炎');
  values.set('wsq.run', '乌萨斯');
  localStorage.setItem = setItem;
  store.flushSave(true);
  assert.equal(
    values.get('wsq.run'),
    '乌萨斯',
    'retry must not overwrite another tab',
  );
  assert.equal(
    values.get('wsq.runStage'),
    '5-9',
    'a deferred stage must not be written to another run',
  );
  store.endRun();
  assert.equal(store.saveErrorMessage.value, '');

  await nextTick();
  store.flushSave();

  // storage 事件到达时即使 Vue 的深监听尚未执行，也必须保留草稿。
  function remoteWrite(raw) {
    values.set('wsq.plans', raw);
    const event = Object.assign(new Event('storage'), {key: 'wsq.plans'});
    window.dispatchEvent(event);
  }
  store.finishEdit();
  store.flushSave(true);
  const external = blankPlan('外部版本');
  remoteWrite(JSON.stringify([external]));
  assert.equal(store.plans[0].id, external.id);
  store.plans[0].note = '本地未保存';
  const nextRemote = JSON.stringify([{...external, note: '另一页已保存'}]);
  remoteWrite(nextRemote);
  store.flushSave(true);
  assert.equal(store.plans[0].note, '本地未保存');
  assert.equal(values.get('wsq.plans'), nextRemote);
  assert.match(store.saveErrorMessage.value, /其他标签页/);
});
