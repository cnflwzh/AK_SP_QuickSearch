import assert from 'node:assert/strict';
import test from 'node:test';
import { BUILD_NAMES, OPERATOR, buildByName } from '../data/index.ts';
import { banReplace, builtinPlan, covenantStats, isBanned, loadPlans, newSlot, samePlan, savePlans, MAX_NOTE } from '../src/lib/planner.ts';

test('every built-in build converts to an editable plan', () => {
  for (const name of BUILD_NAMES) {
    const plan = builtinPlan(name);
    const build = buildByName(name);
    assert.equal(plan.base, name);
    assert.deepEqual(plan.ops.map(o => o.name), build.lineup.filter(n => OPERATOR[n]));
    assert.deepEqual(plan.ops.filter(slot => slot.core).map(slot => slot.name), build.lineup.filter(name => build.carries?.includes(name)));
    for (const slot of plan.ops) assert.deepEqual(slot.alt, build.alternatives?.[slot.name] ?? []);
    assert.ok(plan.note.length <= MAX_NOTE);
    assert.ok(samePlan(plan, builtinPlan(name)));
    assert.ok(!samePlan(plan, { ...plan, note: plan.note + '!' }));
  }
});

test('banned covenant members are replaced without bringing banned operators back', () => {
  for (const name of BUILD_NAMES) {
    const ops = builtinPlan(name).ops;
    const covenants = [...new Set(ops.flatMap(o => OPERATOR[o.name].covenants))];
    for (const banned of covenants) {
      const bans = new Set([banned]);
      const result = banReplace(ops, [banned]);
      assert.deepEqual(result.removed, ops.filter(o => isBanned(o.name, bans)).map(o => o.name));
      assert.ok(result.ops.length <= ops.length);
      assert.equal(new Set(result.ops.map(o => o.name)).size, result.ops.length, 'no duplicates');
      for (const slot of result.ops) {
        assert.ok(!isBanned(slot.name, bans), `${name}: ${slot.name} carries ${banned}`);
        assert.ok(slot.alt.every(a => !isBanned(a, bans)));
      }
      assert.ok(!result.lost.includes(banned));
      for (const pick of result.picks) assert.ok(!pick.alts.includes(pick.name));
    }
  }
});

test('a forced replacement is honoured and kept in the original slot', () => {
  const ops = builtinPlan('炎').ops;
  const first = banReplace(ops, ['投资人']);
  if (!first.picks.length || !first.picks[0].alts.length) return;
  const pick = first.picks[0], alt = pick.alts[0];
  const forced = banReplace(ops, ['投资人'], { [pick.replaces]: alt });
  assert.equal(forced.picks.find(p => p.replaces === pick.replaces).name, alt);
  assert.equal(forced.ops[ops.findIndex(o => o.name === pick.replaces)].name, alt);
});

test('replacements restore the remaining core covenant when possible', () => {
  const ops = builtinPlan('炎').ops;
  const before = covenantStats(ops).find(s => s.name === '炎');
  const result = banReplace(ops, ['投资人']);
  const after = covenantStats(result.ops).find(s => s.name === '炎');
  assert.ok(after.active || !before.active);
  assert.ok(!result.lost.includes('炎'));
});

test('slots with nothing to replace keep their place', () => {
  const ops = ['夕', '黍'].map(newSlot);
  const result = banReplace(ops, []);
  assert.deepEqual(result.ops.map(o => o.name), ['夕', '黍']);
  assert.deepEqual(result.removed, []);
});


test('core flags survive local saves and legacy preset normalization', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  } });
  try {
    const preset = builtinPlan('维多利亚');
    const legacy = structuredClone(preset);
    legacy.ops.forEach(slot => { delete slot.core; });
    assert.ok(savePlans([legacy]));
    assert.deepEqual(loadPlans()[0].ops, preset.ops, 'existing preset keeps its core operators');
    const edited = structuredClone(preset);
    edited.ops.forEach(slot => { slot.core = false; });
    assert.ok(!samePlan(edited, preset), 'unmarking cores counts as an edit');
    assert.ok(savePlans([edited]));
    assert.ok(loadPlans()[0].ops.every(slot => !slot.core), 'explicitly removed cores stay removed');
    delete edited.base;
    edited.ops[0].core = true;
    assert.ok(savePlans([edited]));
    assert.deepEqual(loadPlans()[0].ops, edited.ops, 'custom plan keeps selected cores');
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});
