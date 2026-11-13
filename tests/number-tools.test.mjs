import assert from 'node:assert/strict';
import test from 'node:test';
import { nextCycleReward, nextLayerBreakpoint, refreshBudget, synthesisTier } from '../src/lib/numberTools.ts';

test('layer thresholds advance at the exact milestone and stop after the last one', () => {
  assert.equal(nextLayerBreakpoint('灵巧', 39).layers, 40);
  assert.equal(nextLayerBreakpoint('灵巧', 40), undefined);
  assert.equal(nextLayerBreakpoint('远见', 79).layers, 80);
  assert.equal(nextLayerBreakpoint('远见', 80).layers, 150);
  assert.equal(nextLayerBreakpoint('远见', 150), undefined);
});

test('cycle rewards point to the next payout even when the current layer is an exact multiple', () => {
  const beforePayout = nextCycleReward('维多利亚', 24);
  assert.equal(beforePayout.target, 25);
  assert.equal(beforePayout.remaining, 1);
  const afterPayout = nextCycleReward('维多利亚', 25);
  assert.equal(afterPayout.target, 50);
  assert.equal(afterPayout.remaining, 25);
  assert.equal(nextCycleReward('远见', 80).target, 90);
  assert.equal(nextCycleReward('灵巧', 40), undefined);
});

test('refresh budgets reserve purchase funds after the actual upgrade cost', () => {
  assert.deepEqual(refreshBudget(20, 4), { balance: 20, refreshes: 16, upgradeShortfall: 0, reserveShortfall: 0 });
  assert.deepEqual(refreshBudget(20, 4, 8), { balance: 12, refreshes: 8, upgradeShortfall: 0, reserveShortfall: 0 });
  assert.deepEqual(refreshBudget(10, 3, 7), { balance: 3, refreshes: 0, upgradeShortfall: 0, reserveShortfall: 0 });
});

test('insufficient upgrade funds and insufficient purchase reserve remain distinct', () => {
  assert.deepEqual(refreshBudget(5, 4, 8), { balance: -3, refreshes: 0, upgradeShortfall: 3, reserveShortfall: 0 });
  assert.deepEqual(refreshBudget(10, 4, 8), { balance: 2, refreshes: 0, upgradeShortfall: 0, reserveShortfall: 2 });
});

test('synthesis rewards start at tier II and remain capped at tier VI at max level', () => {
  assert.equal(synthesisTier(1), 2);
  assert.equal(synthesisTier(4), 5);
  assert.equal(synthesisTier(5), 6);
  assert.equal(synthesisTier(6), 6);
});
