import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDailyRounds,
  buildDealerRound,
  createSeededRandom,
  DAILY_ROUND_COUNT,
  DEALER_SHOP_SIZE,
  SELECTABLE_COVENANTS,
  TRANSMUTE_COVENANTS,
} from '../src/lib/dealer/index.ts';

test('daily challenge rotates across all 7 kinds while keeping same-day questions invariant and positions shuffled', () => {
  const first = buildDailyRounds('2026-11-15');
  const second = buildDailyRounds('2026-11-15');
  assert.equal(first.length, DAILY_ROUND_COUNT);
  assert.equal(first[0].kind, 'covenant');
  assert.ok(['trigger', 'tier_check'].includes(first[1].kind));
  assert.equal(first[2].kind, 'transmute');
  assert.equal(first[3].kind, 'equipment');
  assert.ok(['strategy', 'bounty'].includes(first[4].kind));

  assert.deepEqual(
    first.map((r) => ({
      kind: r.kind,
      target: r.targetCovenant,
      sortedTitles: r.cards.map((c) => `${c.title}:${c.attachedEquip?.name ?? ''}`).sort(),
    })),
    second.map((r) => ({
      kind: r.kind,
      target: r.targetCovenant,
      sortedTitles: r.cards.map((c) => `${c.title}:${c.attachedEquip?.name ?? ''}`).sort(),
    })),
  );
  assert.notDeepEqual(
    first.map((r) => r.cards.map((c) => c.title)),
    second.map((r) => r.cards.map((c) => c.title)),
  );

  const seededA = buildDailyRounds('2026-11-15', 'same-order-seed');
  const seededB = buildDailyRounds('2026-11-15', 'same-order-seed');
  assert.deepEqual(
    seededA.map((r) => r.cards.map((c) => c.title)),
    seededB.map((r) => r.cards.map((c) => c.title)),
  );

  const seenOperators = new Set();
  let expectedOperatorCount = 0;
  for (const round of first) {
    assert.equal(round.cards.length, DEALER_SHOP_SIZE);
    for (const card of round.cards) {
      if (card.cardKind === 'operator' && card.operator) {
        expectedOperatorCount++;
        seenOperators.add(card.operator.name);
        if (round.kind === 'covenant' || round.kind === 'transmute') {
          const nativeMatch = card.operator.covenants.includes(round.targetCovenant);
          const transmuteMatch = card.attachedEquip?.covenant === round.targetCovenant;
          assert.equal(card.isImpostor, !(nativeMatch || transmuteMatch));
        }
      }
    }
    const impostors = round.cards.filter((c) => c.isImpostor).length;
    assert.ok(impostors >= 2 && impostors <= 3);
  }
  assert.equal(seenOperators.size, expectedOperatorCount);

  const seenKinds = new Set();
  for (let day = 1; day <= 20; day++) {
    const key = `2026-11-${String(day).padStart(2, '0')}`;
    for (const r of buildDailyRounds(key, 'fixed')) {
      seenKinds.add(r.kind);
    }
  }
  assert.deepEqual(
    [...seenKinds].sort(),
    ['bounty', 'covenant', 'equipment', 'strategy', 'tier_check', 'transmute', 'trigger'],
  );
});

test('all selectable covenants and transmute covenants build 5 distinct valid cards', () => {
  assert.ok(!SELECTABLE_COVENANTS.includes('绝技'));
  assert.ok(SELECTABLE_COVENANTS.includes('调和'));
  assert.ok(TRANSMUTE_COVENANTS.includes('谢拉格'));

  const rng = createSeededRandom('selectable-check');
  for (const covenant of SELECTABLE_COVENANTS) {
    const round = buildDealerRound({
      roundNumber: 1,
      kind: 'covenant',
      targetCovenant: covenant,
      rng,
    });
    assert.equal(round.cards.length, DEALER_SHOP_SIZE);
    assert.equal(
      new Set(round.cards.map((c) => c.title)).size,
      DEALER_SHOP_SIZE,
    );
    assert.ok(round.goodTotal >= 2);
    assert.ok(round.impostorTotal >= 1);
  }

  for (const covenant of TRANSMUTE_COVENANTS) {
    const round = buildDealerRound({
      roundNumber: 2,
      kind: 'transmute',
      preferredImpostors: 3,
      targetCovenant: covenant,
      rng,
    });
    assert.equal(round.kind, 'transmute');
    assert.equal(
      new Set(round.cards.map((c) => c.title)).size,
      DEALER_SHOP_SIZE,
    );
    const trueTransmuters = round.cards.filter(
      (c) =>
        c.operator &&
        !c.operator.covenants.includes(covenant) &&
        c.attachedEquip?.covenant === covenant &&
        !c.isImpostor,
    );
    const falseTransmuters = round.cards.filter(
      (c) => c.attachedEquip && c.attachedEquip.covenant !== covenant && c.isImpostor,
    );
    assert.ok(trueTransmuters.length >= 1, `Expected true transmuter for ${covenant}`);
    assert.equal(falseTransmuters.length, 2);
    assert.ok(falseTransmuters.some((card) => card.attachedEquip.covenant === null));
    assert.ok(falseTransmuters.some((card) => card.attachedEquip.covenant !== null));
  }
});
