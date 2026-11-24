import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BUILD_NAMES,
  EQUIPMENT,
  OPERATORS,
  STRATEGIES,
  STRATEGY,
  buildByName,
} from '../data/index.ts';
import {
  MAX_NOTE,
  MAX_OPS,
  MAX_STRATEGIES,
  MAX_STAGE_ROUND,
  blankPlan,
  builtinPlan,
  loadPlans,
  newSlot,
  samePlan,
  validStageRange,
} from '../src/lib/plans/index.ts';
import {
  MAX_BACKUP_BYTES,
  mergePlanBackup,
  parsePlanBackup,
  serializePlanBackup,
} from '../src/lib/plans/backup.ts';
import {createDefaultSettings} from '../src/lib/settings/model.ts';
import {
  parseSettingsBackup,
  serializeSettingsBackup,
} from '../src/lib/settings/backup.ts';

const names = STRATEGIES.slice(0, MAX_STRATEGIES).map((entry) => entry.name);
const stage = {
  from: 1,
  to: 3,
  note: '第一阶段',
  layers: {炎: 12, 灵巧: 5},
  ops: [newSlot('夕')],
};

test('整批备份接近 5 MiB 时忽略缩进开销，实际内容超限仍明确拒绝', () => {
  const ops = OPERATORS.slice(0, MAX_OPS).map((op, i) => ({
    ...newSlot(op.name),
    alt: OPERATORS.slice(MAX_OPS + i, MAX_OPS + i + 3).map((item) => item.name),
    eq: EQUIPMENT.slice(i, i + 2).map((item) => item.name),
  }));
  const collection = Array.from({length: 1000}, (_, index) => ({
    ...blankPlan(`方案 ${index}`),
    ops,
  }));
  assert.ok(
    Buffer.byteLength(JSON.stringify(collection, null, 2)) > MAX_BACKUP_BYTES,
  );
  const oversized = collection.map((plan) => ({
    ...plan,
    note: '界'.repeat(MAX_NOTE),
  }));
  for (const [serialize, parse] of [
    [serializePlanBackup, parsePlanBackup],
    [
      (plans) => serializeSettingsBackup(createDefaultSettings(), plans),
      parseSettingsBackup,
    ],
  ]) {
    const exported = serialize(collection);
    assert.ok(Buffer.byteLength(exported) <= MAX_BACKUP_BYTES);
    assert.deepEqual(parse(exported).plans, collection);
    assert.throws(() => serialize(oversized), /超过 5 MB/);
  }
});

test('完整阵容、阶段与策略在本地、流派备份和配置备份中往返一致', () => {
  const ops = OPERATORS.slice(0, MAX_OPS).map((op) => newSlot(op.name));
  const note = '😀'.repeat(MAX_NOTE / 2);
  const plan = {
    ...blankPlan(),
    ops,
    note,
    strategy: names[0],
    strategyAlternates: names.slice(1),
    stages: [
      stage,
      {
        from: MAX_STAGE_ROUND,
        to: MAX_STAGE_ROUND,
        ops: ops.toReversed(),
        note,
        layers: {炎: 2},
      },
    ],
  };
  const legacy = blankPlan();
  for (const [original, version] of [
    [legacy, 1],
    [plan, 2],
  ]) {
    assert.deepEqual(loadPlans(JSON.stringify([original])), [original]);
    const backup = parsePlanBackup(serializePlanBackup([original]));
    const settingsBackup = parseSettingsBackup(
      serializeSettingsBackup(createDefaultSettings(), [original]),
    );
    for (const restored of [backup, settingsBackup]) {
      assert.equal(restored.version, version);
      assert.deepEqual(restored.plans, [original]);
    }
  }
  for (const build of BUILD_NAMES) {
    const preset = builtinPlan(build);
    assert.deepEqual(
      [preset.strategy, ...(preset.strategyAlternates ?? [])],
      [
        ...new Set(
          buildByName(build).strategies.filter((name) =>
            Object.hasOwn(STRATEGY, name),
          ),
        ),
      ].slice(0, MAX_STRATEGIES),
    );
  }
});

test('本地修复受损项目，备份严格拒绝无效阶段与策略', () => {
  const plan = {...blankPlan(), strategy: names[0]};
  for (const range of [
    [0, 3],
    [1.5, 4],
    [1, MAX_STAGE_ROUND + 1],
    [3, 1],
    [3, 5],
  ]) {
    assert.equal(validStageRange(...range, [stage]), false);
    const damaged = {
      ...plan,
      stages: [stage, {...stage, from: range[0], to: range[1]}],
    };
    assert.throws(
      () => parsePlanBackup(serializePlanBackup([plan, damaged])),
      /第 2 套/,
    );
    assert.deepEqual(loadPlans(JSON.stringify([damaged]))[0].stages, [stage]);
  }
  assert.equal(validStageRange(1, 3, [stage], 0), true);
  assert.equal(validStageRange(4, 4, [stage]), true);
  for (const changes of [
    {strategyAlternates: [names[0]]},
    {strategyAlternates: [names[1], names[1]]},
    {strategyAlternates: ['unknown']},
    {
      strategyAlternates: STRATEGIES.slice(1, MAX_STRATEGIES + 1).map(
        (entry) => entry.name,
      ),
    },
    {strategy: '', strategyAlternates: [names[1]]},
    {stages: [{...stage, ops: [newSlot('unknown')]}]},
    {stages: [{...stage, ops: [newSlot('夕'), newSlot('夕')]}]},
    {stages: [{...stage, note: '字'.repeat(MAX_NOTE + 1)}]},
    {stages: [{...stage, layers: {炎: -1}}]},
  ]) {
    assert.throws(() =>
      parsePlanBackup(serializePlanBackup([{...plan, ...changes}])),
    );
  }
});

test('比较和恢复去重保留任何阶段编辑与备选顺序，忽略层数键顺序', () => {
  const plan = {
    ...blankPlan(),
    strategy: names[0],
    strategyAlternates: names.slice(1),
    stages: [stage],
  };
  const reorderedLayers = {
    ...plan,
    stages: [{...stage, layers: {灵巧: 5, 炎: 12}}],
  };
  assert.equal(samePlan(plan, reorderedLayers), true);
  const edits = [
    {...plan, strategyAlternates: names.slice(1).reverse()},
    ...[
      {to: 4},
      {ops: [{...newSlot('夕'), core: true}]},
      {layers: {炎: 11}},
      {note: '开局优先'},
    ].map((edit) => ({...plan, stages: [{...stage, ...edit}]})),
  ];
  assert.ok(edits.every((edited) => !samePlan(plan, edited)));
  const merge = mergePlanBackup([plan], [reorderedLayers, ...edits, ...edits]);
  assert.equal(merge.additions.length, edits.length);
  assert.equal(merge.skipped, edits.length + 1);
});
