import assert from 'node:assert/strict';
import test from 'node:test';
import {OPERATORS, RESTRICTED_MODE_COVENANTS} from '../data/index.ts';
import {roundCredit} from '../src/lib/numbers/creditTools.ts';
import {isBanned} from '../src/lib/recommendation/index.ts';
import {
  nextCycleReward,
  nextLayerBreakpoint,
  poolBreakdown,
  refreshBudget,
  synthesisHitRate,
  synthesisTier,
} from '../src/lib/numbers/numberTools.ts';

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
  assert.deepEqual(refreshBudget(20, 4), {
    balance: 20,
    refreshes: 16,
    upgradeShortfall: 0,
    reserveShortfall: 0,
  });
  assert.deepEqual(refreshBudget(20, 4, 8), {
    balance: 12,
    refreshes: 8,
    upgradeShortfall: 0,
    reserveShortfall: 0,
  });
  assert.deepEqual(refreshBudget(10, 3, 7), {
    balance: 3,
    refreshes: 0,
    upgradeShortfall: 0,
    reserveShortfall: 0,
  });
});

test('insufficient upgrade funds and insufficient purchase reserve remain distinct', () => {
  assert.deepEqual(refreshBudget(5, 4, 8), {
    balance: -3,
    refreshes: 0,
    upgradeShortfall: 3,
    reserveShortfall: 0,
  });
  assert.deepEqual(refreshBudget(10, 4, 8), {
    balance: 2,
    refreshes: 0,
    upgradeShortfall: 0,
    reserveShortfall: 2,
  });
});

test('synthesis rewards start at tier II and remain capped at tier VI at max level', () => {
  assert.equal(synthesisTier(1), 2);
  assert.equal(synthesisTier(4), 5);
  assert.equal(synthesisTier(5), 6);
  assert.equal(synthesisTier(6), 6);
});

test('non-pool operators cannot appear in either synthesis estimate', () => {
  const target = OPERATORS.find((op) => op.stars === 0 && op.tier > 1);
  assert.ok(target);
  const result = poolBreakdown(target.tier - 1, target.name);
  assert.equal(result.rewardHitRate, 0);
  assert.equal(result.targetSynthesisHitRate, 0);
});

test('poolBreakdown reflects active shop pool, banned targets, and synthesis hit rate', () => {
  const fullPoolOps = OPERATORS.filter((o) => o.stars !== 0);
  const sampleTarget = fullPoolOps.find(
    (o) => o.tier === 4 && o.covenants.length > 0,
  );
  assert.ok(sampleTarget);
  const full = poolBreakdown(4, sampleTarget.name, [], false);
  assert.equal(full.targetBanned, false);
  assert.equal(
    full.shopPoolTotal,
    fullPoolOps.filter((o) => o.tier <= 4).length,
  );
  assert.equal(full.shopPoolActive, full.shopPoolTotal);
  assert.equal(
    full.rewardTierActive,
    fullPoolOps.filter((o) => o.tier === 5).length,
  );
  assert.equal(
    full.targetSynthesisHitRate,
    synthesisHitRate(full.targetTierActive),
  );

  const cov = sampleTarget.covenants[0];
  const afterBan = poolBreakdown(4, sampleTarget.name, [cov], false);
  const expectedActive = fullPoolOps.filter(
    (o) => o.tier <= 4 && !isBanned(o.name, new Set([cov])),
  ).length;
  assert.equal(afterBan.shopPoolActive, expectedActive);
  if (isBanned(sampleTarget.name, new Set([cov]))) {
    assert.equal(afterBan.targetBanned, true);
    assert.equal(afterBan.targetSynthesisHitRate, 0);
  }

  const restricted = poolBreakdown(3, sampleTarget.name, [], true);
  assert.equal(
    restricted.shopPoolActive,
    fullPoolOps.filter(
      (o) =>
        o.tier <= 3 && !isBanned(o.name, new Set(RESTRICTED_MODE_COVENANTS)),
    ).length,
  );
  assert.equal(synthesisHitRate(0), 0);
  assert.equal(synthesisHitRate(2), 1);
  assert.equal(synthesisHitRate(6), 0.5);
});

test('guide chart scales cleared rounds and awards the final leader bonus', () => {
  // 标准 100%：第 14 回合 300，击败领袖 +50 = 350
  assert.deepEqual(roundCredit(14, 100, true), {
    perRun: 350,
    roundPart: 300,
    leaderBonus: 50,
  });
  // 最终回合前不发领袖奖励
  assert.deepEqual(roundCredit(10, 120, true), {
    perRun: Math.round(170 * 1.2),
    roundPart: Math.round(170 * 1.2),
    leaderBonus: 0,
  });
  // 终极 150% 击败领袖：450 + 75 = 525
  assert.equal(roundCredit(14, 150, true).perRun, 525);
});

test('zero cleared rounds, quick finals and half points use the selected mode', () => {
  assert.deepEqual(roundCredit(0, 100), {
    perRun: 0,
    roundPart: 0,
    leaderBonus: 0,
  });
  assert.equal(roundCredit(4, 115).perRun, 58);
  assert.equal(roundCredit(14, 115, true).perRun, 403);
  assert.deepEqual(roundCredit(9, 100, true, 'quick'), {
    perRun: 200,
    roundPart: 150,
    leaderBonus: 50,
  });
  assert.equal(roundCredit(8, 100, true, 'quick').leaderBonus, 0);
});
