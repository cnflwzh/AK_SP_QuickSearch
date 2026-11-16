import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ALL_COVENANTS,
  EQUIPMENT,
  LEADERS,
  OPERATOR,
  OPERATORS,
  STRATEGIES,
} from '../data/index.ts';
import {
  matchedOnlyAdvanced,
  matchedOnlyElite,
  topSearchTarget,
} from '../src/quickref/searchRanking.ts';

test('matchedOnlyElite triggers only when query matches elite trait exclusively', () => {
  const op = OPERATORS.find(
    (item) =>
      item.elite.includes('每回合至多') &&
      !item.trait.includes('每回合至多') &&
      !item.name.includes('至多'),
  );
  if (op) {
    assert.equal(matchedOnlyElite(op, '至多'), true);
    assert.equal(matchedOnlyElite(op, op.name), false);
  }
  const sample = OPERATORS[0];
  assert.equal(matchedOnlyElite(sample, sample.name), false);
  assert.equal(matchedOnlyElite(sample, sample.covenants[0]), false);
});

test('matchedOnlyAdvanced detects equipment matches unique to advanced tier', () => {
  const eq = EQUIPMENT.find(
    (item) => item.advanced && item.advanced !== item.effect,
  );
  assert.ok(eq);
  assert.equal(matchedOnlyAdvanced(eq, eq.name), false);
  assert.equal(matchedOnlyAdvanced(eq, eq.effect.slice(0, 4)), false);
});

test('topSearchTarget selects direct navigation or detail target for Enter shortcut', () => {
  const opHit = topSearchTarget(OPERATORS[0].name);
  assert.deepEqual(opHit, {kind: 'op', id: OPERATORS[0].name});

  const covHit = topSearchTarget(ALL_COVENANTS[0]);
  assert.deepEqual(covHit, {kind: 'cv', id: ALL_COVENANTS[0]});

  const eqHit = topSearchTarget(EQUIPMENT[0].name);
  assert.deepEqual(eqHit, {kind: 'eq', id: EQUIPMENT[0].name});

  const uniqueStrategy = STRATEGIES.find(
    (item) => !Object.hasOwn(OPERATOR, item.name),
  );
  assert.ok(uniqueStrategy);
  const stHit = topSearchTarget(uniqueStrategy.name);
  assert.deepEqual(stHit, {kind: 'st', id: uniqueStrategy.name});

  const ldHit = topSearchTarget(LEADERS[0].name);
  assert.deepEqual(ldHit, {kind: 'ld', id: LEADERS[0].name});

  const customHit = topSearchTarget('专属自定义流派XYZ', [
    {key: 'custom-1', name: '专属自定义流派XYZ'},
  ]);
  assert.deepEqual(customHit, {kind: 'bd', id: 'custom-1'});

  assert.equal(topSearchTarget(''), null);
  assert.equal(topSearchTarget('___not_found___'), null);
});
