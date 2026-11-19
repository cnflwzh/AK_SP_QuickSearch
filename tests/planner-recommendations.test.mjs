import assert from 'node:assert/strict';
import test from 'node:test';
import {ALL_COVENANTS} from '../data/index.ts';
import {banReplace, builtinPlan, covenantStats, newSlot} from '../src/lib/plans/index.ts';

test('manual choices are reserved before automatic choices for earlier slots', () => {
  const ops = builtinPlan('炎').ops, bans = ['炎'];
  const automatic = banReplace(ops, bans);
  assert.ok(automatic.picks.length >= 2);
  const name = automatic.picks[0].name, target = automatic.picks.at(-1).replaces;
  const result = banReplace(ops, bans, { [target]: name });
  assert.equal(result.ops[ops.findIndex(slot => slot.name === target)].name, name);
  assert.equal(result.ops.filter(slot => slot.name === name).length, 1);
});

test('replacements retain equipment, recompute granted covenants and reset elite and core flags', () => {
  const ops = [{ ...newSlot('夕'), elite: true, core: true, eq: ['变形同构体', '炎国短刀'] }, newSlot('黍')];
  const before = structuredClone(ops);
  const result = banReplace(ops, ['炎'], { 夕: '艾丝黛尔' });
  assert.equal(result.ops[0].name, '艾丝黛尔');
  assert.equal(result.ops[0].elite, false);
  assert.equal(result.ops[0].core, false);
  assert.deepEqual(result.ops[0].eq, ops[0].eq);
  assert.ok(covenantStats(result.ops).find(s => s.name === '炎').granted.includes('艾丝黛尔'));
  assert.deepEqual(ops, before);
  result.ops[0].eq.pop();
  assert.deepEqual(ops, before);
});

test('joint replacements preserve a six-person core when another covenant is banned', () => {
  const ops = builtinPlan('炎').ops;
  assert.ok(covenantStats(ops).find(s => s.name === '炎').bonusActive);
  const result = banReplace(ops, ['投资人']);
  assert.ok(covenantStats(result.ops).find(s => s.name === '炎').bonusActive);
});

test('exhausted pools never reintroduce banned or duplicate operators', () => {
  const result = banReplace(builtinPlan('炎').ops, ALL_COVENANTS);
  assert.deepEqual(result.ops, []);
  assert.deepEqual(result.picks, []);
  assert.deepEqual(result.lost, []);
});
