import assert from 'node:assert/strict';
import test from 'node:test';
import {ALL_COVENANTS, OPERATOR} from '../data/index.ts';
import {
  evaluateLineupBox,
  recommendBorrows,
  recommendTraining,
} from '../src/lib/box/insights.ts';
import {BOX_RANK_BORROWED} from '../src/lib/box/model.ts';
import {
  alternatesFor,
  banReplace,
  builtinPlan,
  covenantStats,
  newSlot,
  suggestions,
} from '../src/lib/plans/index.ts';

test('manual choices are reserved before automatic choices for earlier slots', () => {
  const ops = builtinPlan('炎').ops,
    bans = ['炎'];
  const automatic = banReplace(ops, bans);
  assert.ok(automatic.picks.length >= 2);
  const name = automatic.picks[0].name,
    target = automatic.picks.at(-1).replaces;
  const result = banReplace(ops, bans, {[target]: name});
  assert.equal(
    result.ops[ops.findIndex((slot) => slot.name === target)].name,
    name,
  );
  assert.equal(result.ops.filter((slot) => slot.name === name).length, 1);
});

test('replacements retain equipment, recompute granted covenants and reset elite and core flags', () => {
  const ops = [
    {...newSlot('夕'), elite: true, core: true, eq: ['变形同构体', '炎国短刀']},
    newSlot('黍'),
  ];
  const before = structuredClone(ops);
  const result = banReplace(ops, ['炎'], {夕: '艾丝黛尔'});
  assert.equal(result.ops[0].name, '艾丝黛尔');
  assert.equal(result.ops[0].elite, false);
  assert.equal(result.ops[0].core, false);
  assert.deepEqual(result.ops[0].eq, ops[0].eq);
  assert.ok(
    covenantStats(result.ops)
      .find((s) => s.name === '炎')
      .granted.includes('艾丝黛尔'),
  );
  assert.deepEqual(ops, before);
  result.ops[0].eq.pop();
  assert.deepEqual(ops, before);
});

test('joint replacements preserve a six-person core when another covenant is banned', () => {
  const ops = builtinPlan('炎').ops;
  assert.ok(covenantStats(ops).find((s) => s.name === '炎').bonusActive);
  const result = banReplace(ops, ['投资人']);
  assert.ok(covenantStats(result.ops).find((s) => s.name === '炎').bonusActive);
});

test('exhausted pools never reintroduce banned or duplicate operators', () => {
  const result = banReplace(builtinPlan('炎').ops, ALL_COVENANTS);
  assert.deepEqual(result.ops, []);
  assert.deepEqual(result.picks, []);
  assert.deepEqual(result.lost, []);
});

test('box-aware recommendations preserve empty-box behavior and prefer available operators on ties', () => {
  const ops = [newSlot('折桠'), newSlot('拜松')];
  assert.deepEqual(suggestions(ops, 8, {}, {}), suggestions(ops, 8, {}));
  const baseAlt = alternatesFor(ops[1], ops, 8, {});
  assert.deepEqual(alternatesFor(ops[1], ops, 8, {}, {}), baseAlt);

  assert.deepEqual(
    suggestions(ops, 8, {}, {char_99999_other: 3}),
    suggestions(ops, 8, {}),
  );

  const baseline = suggestions(ops, Infinity);
  const later = baseline.find(
    (item, i) => item.op.stars && i > 0 && baseline[i - 1].score === item.score,
  );
  assert.ok(
    later,
    'fixture should contain two candidates with equal covenant gains',
  );
  const ranked = suggestions(ops, Infinity, {}, {[later.op.avatar]: 3});
  assert.deepEqual(
    ranked.map((item) => item.score),
    baseline.map((item) => item.score),
  );
  assert.equal(
    ranked.find((item) => item.score === later.score).op.name,
    later.op.name,
  );
});

test('focused borrow/training lists count the whole plan once, with mains taking priority', () => {
  const source = {
    key: 'mine',
    name: '我的方案',
    builtin: false,
    ops: [
      {...newSlot('拜松'), alt: ['妮芙', '斯卡蒂']},
      {...newSlot('妮芙'), core: true, alt: ['斯卡蒂']},
    ],
  };
  const plans = [
    source,
    {
      key: 'other',
      name: '其他方案',
      builtin: true,
      ops: [newSlot('荒芜拉普兰德')],
    },
  ];
  const selected = new Set(['mine']);
  const focused = recommendBorrows({}, plans, selected);
  assert.deepEqual(
    focused.map((item) => [
      item.op.name,
      item.buildCount,
      item.coreCount,
      item.altCount,
    ]),
    [
      ['妮芙', 1, 1, 0],
      ['斯卡蒂', 0, 0, 1],
    ],
  );
  assert.deepEqual(focused[1].buildNames, ['我的方案']);
  assert.ok(
    recommendBorrows({}, plans).some((item) => item.op.name === '荒芜拉普兰德'),
  );
  const box = {[OPERATOR['妮芙'].avatar]: 0, [OPERATOR['斯卡蒂'].avatar]: 0};
  assert.deepEqual(
    recommendTraining(box, plans, selected).map((item) => [
      item.op.name,
      item.buildCount,
      item.altCount,
    ]),
    [
      ['妮芙', 1, 0],
      ['斯卡蒂', 0, 1],
    ],
  );
});

test('equal untrained, borrowed and preset bodies have the same lineup fit', () => {
  const box = {
    [OPERATOR['妮芙'].avatar]: 0,
    [OPERATOR['斯卡蒂'].avatar]: BOX_RANK_BORROWED,
  };
  const score = (name) => evaluateLineupBox([newSlot(name)], box).fitScore;
  assert.equal(score('妮芙'), score('斯卡蒂'));
  assert.equal(score('妮芙'), score('歌蕾蒂娅'));
});
