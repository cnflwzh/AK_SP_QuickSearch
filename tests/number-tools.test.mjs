import assert from 'node:assert/strict';
import test from 'node:test';
import {OPERATORS, RESTRICTED_MODE_COVENANTS} from '../data/index.ts';
import {isBanned} from '../src/lib/recommendation/index.ts';
import {
  calculateCreditPlan,
  compareJointDifficulties,
  compareSoloLevels,
  nextCycleReward,
  nextLayerBreakpoint,
  poolBreakdown,
  refreshBudget,
  roundCredit,
  runsNeededForCredit,
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

test('credit calculator matches round scaling, leader bonus, and comparison rows', () => {
  // 标准 100%：第 14 回合 300，击败领袖 +50 = 350
  assert.deepEqual(roundCredit(14, 100, true), {
    perRun: 350,
    roundPart: 300,
    leaderBonus: 50,
  });
  // 未打到最终回合即使勾选领袖也不加领袖奖励
  assert.deepEqual(roundCredit(10, 120, true), {
    perRun: Math.round(170 * 1.2),
    roundPart: Math.round(170 * 1.2),
    leaderBonus: 0,
  });
  // 终极 150% 击败领袖：450 + 75 = 525
  assert.equal(roundCredit(14, 150, true).perRun, 525);
  assert.equal(runsNeededForCredit(6250, 6250, 350), 0);
  assert.equal(runsNeededForCredit(6500, 6250, 350), 0);
  assert.equal(runsNeededForCredit(0, 6250, 525), Math.ceil(6250 / 525));

  const plan = calculateCreditPlan({
    efficiency: 120,
    roundsCleared: 14,
    defeatedLeader: true,
    currentCredit: 1000,
    targetCredit: 6250,
  });
  assert.equal(plan.perRun, 420);
  assert.equal(plan.remainingCredit, 5250);
  assert.equal(plan.runsNeeded, 13);
  assert.ok(plan.maxCombatSeconds > 0);

  const jointRows = compareJointDifficulties({
    roundsCleared: 14,
    defeatedLeader: true,
    currentCredit: 0,
    targetCredit: 6250,
    activeIndex: 1,
  });
  assert.equal(jointRows.length, 4);
  assert.equal(jointRows[1].active, true);
  assert.ok(jointRows[3].perRun > jointRows[0].perRun);

  const soloRows = compareSoloLevels({
    roundsCleared: 14,
    defeatedLeader: false,
    currentCredit: 0,
    targetCredit: 3000,
    activeLevel: 7,
  });
  assert.ok(soloRows.some((row) => row.id === 'solo:7' && row.active));
});
