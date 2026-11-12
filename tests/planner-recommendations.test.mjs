import assert from 'node:assert/strict';
import test from 'node:test';
import { ALL_COVENANTS, OPERATORS, OPERATOR } from '../data/index.ts';
import { banReplace, builtinPlan, covenantStats, isBanned, newSlot, suggestions } from '../src/lib/planner.ts';

test('manual choices are reserved before automatic choices for earlier slots', () => {
  const ops = builtinPlan('炎').ops, bans = ['炎'];
  const automatic = banReplace(ops, bans);
  assert.ok(automatic.picks.length >= 2);
  const name = automatic.picks[0].name, target = automatic.picks.at(-1).replaces;
  const result = banReplace(ops, bans, { [target]: name });
  assert.equal(result.ops[ops.findIndex(slot => slot.name === target)].name, name);
  assert.equal(result.ops.filter(slot => slot.name === name).length, 1);
});

test('a valid manual choice is honoured even without shared covenants', () => {
  const ops = [newSlot('夕')];
  const candidate = OPERATORS.find(op => !op.covenants.some(c => OPERATOR['夕'].covenants.includes(c)));
  assert.ok(candidate);
  assert.equal(banReplace(ops, ['炎'], { 夕: candidate.name }).ops[0].name, candidate.name);
});

test('replacements retain equipment, recompute granted covenants and reset elite', () => {
  const ops = [{ ...newSlot('夕'), elite: true, eq: ['变形同构体', '炎国短刀'] }, newSlot('黍')];
  const before = structuredClone(ops);
  const result = banReplace(ops, ['炎'], { 夕: '艾丝黛尔' });
  assert.equal(result.ops[0].name, '艾丝黛尔');
  assert.equal(result.ops[0].elite, false);
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

test('harmony recommendations count the simultaneous activation of two cores', () => {
  const ops = ['炎', '乌萨斯'].flatMap(c => OPERATORS.filter(op => op.covenants.includes(c)).slice(0, 2).map(op => newSlot(op.name)));
  const choices = suggestions(ops);
  assert.ok(choices[0].op.covenants.includes('调和'));
  assert.ok(choices[0].gains.some(g => g.covenant === '炎' && g.kind === 'on'));
  assert.ok(choices[0].gains.some(g => g.covenant === '乌萨斯' && g.kind === 'on'));
});

test('a second solo member is not recommended just for matching the active solo covenant', () => {
  const choices = suggestions([newSlot('艾丝黛尔')], OPERATORS.length);
  assert.ok(choices.length);
  assert.ok(choices.every(choice => !choice.op.covenants.includes('独行')));
});

test('layer bonuses participate in lineup ranking', () => {
  const ops = [newSlot(OPERATORS.find(op => op.covenants.includes('灵巧')).name)];
  const low = suggestions(ops, OPERATORS.length);
  const high = suggestions(ops, OPERATORS.length, { 灵巧: 40 });
  // 补齐灵巧人数时，已达到 40 层的阵容应同时获得强化收益。
  const candidate = high.find(choice => choice.gains.some(g => g.covenant === '灵巧' && g.kind === 'on'));
  assert.ok(candidate);
  assert.ok(candidate.score > low.find(choice => choice.op.name === candidate.op.name).score);
});

test('exhausted pools never reintroduce banned or duplicate operators', () => {
  const result = banReplace(builtinPlan('炎').ops, ALL_COVENANTS);
  assert.deepEqual(result.ops, []);
  assert.deepEqual(result.picks, []);
  assert.deepEqual(result.lost, []);
});

test('no-op replacement preserves slot content and all recommendations are deterministic', () => {
  const ops = [{ ...newSlot('夕'), eq: ['炎国短刀'], alt: ['黍'] }, newSlot('黍')];
  assert.deepEqual(banReplace(ops, []).ops, ops);
  assert.deepEqual(banReplace(ops, ['炎']), banReplace(ops, ['炎']));
  for (const pick of banReplace(ops, ['炎']).picks) assert.ok(!isBanned(pick.name, new Set(['炎'])));
});
