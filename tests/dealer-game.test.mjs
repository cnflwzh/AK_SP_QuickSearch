import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDailyRounds,
  buildDealerPosterModel,
  buildDealerRound,
  covenantMemo,
  createSeededRandom,
  DAILY_ROUND_COUNT,
  DEALER_SHOP_SIZE,
  evaluateDealerRank,
  formatDealerShareText,
  reactionLine,
  replayShuffleLine,
  SELECTABLE_COVENANTS,
  summarizeRound,
} from '../src/lib/dealerGame.ts';
import {CORE_COVENANTS, OPERATOR} from '../data/index.ts';

test('daily challenge keeps target questions identical while shuffling card positions across attempts', () => {
  const first = buildDailyRounds('2026-11-15');
  const second = buildDailyRounds('2026-11-15');
  assert.equal(first.length, DAILY_ROUND_COUNT);
  assert.deepEqual(
    first.map((r) => ({
      target: r.targetCovenant,
      sortedOps: r.cards.map((c) => c.operator.name).sort(),
    })),
    second.map((r) => ({
      target: r.targetCovenant,
      sortedOps: r.cards.map((c) => c.operator.name).sort(),
    })),
  );
  assert.notDeepEqual(
    first.map((r) => r.cards.map((c) => c.operator.name)),
    second.map((r) => r.cards.map((c) => c.operator.name)),
  );

  const seededA = buildDailyRounds('2026-11-15', 'same-order-seed');
  const seededB = buildDailyRounds('2026-11-15', 'same-order-seed');
  assert.deepEqual(
    seededA.map((r) => r.cards.map((c) => c.operator.name)),
    seededB.map((r) => r.cards.map((c) => c.operator.name)),
  );

  const uniqueCovenants = new Set(first.map((r) => r.targetCovenant));
  assert.equal(uniqueCovenants.size, DAILY_ROUND_COUNT);
  const coreCount = first.filter((r) =>
    CORE_COVENANTS.includes(r.targetCovenant),
  ).length;
  assert.equal(coreCount, 3);

  const seenOperators = new Set();
  for (const round of first) {
    assert.equal(round.cards.length, DEALER_SHOP_SIZE);
    for (const card of round.cards) {
      assert.equal(
        card.isImpostor,
        !card.operator.covenants.includes(round.targetCovenant),
      );
      seenOperators.add(card.operator.name);
    }
    const impostors = round.cards.filter((c) => c.isImpostor).length;
    assert.ok(impostors >= 2 && impostors <= 3);
  }
  assert.equal(seenOperators.size, DAILY_ROUND_COUNT * DEALER_SHOP_SIZE);
});

test('all selectable covenants including 2-operator covenants build 5 distinct cards', () => {
  assert.ok(!SELECTABLE_COVENANTS.includes('绝技'));
  assert.ok(SELECTABLE_COVENANTS.includes('调和'));

  const rng = createSeededRandom('selectable-check');
  for (const covenant of SELECTABLE_COVENANTS) {
    const round = buildDealerRound({
      roundNumber: 1,
      targetCovenant: covenant,
      rng,
    });
    assert.equal(round.cards.length, DEALER_SHOP_SIZE);
    const names = new Set(round.cards.map((c) => c.operator.name));
    assert.equal(names.size, DEALER_SHOP_SIZE);
    assert.ok(round.goodTotal >= 2);
    assert.ok(round.impostorTotal >= 1);
  }
});

test('covenant rule memo summarizes activation requirement and milestone rules', () => {
  const victoria = covenantMemo('维多利亚');
  assert.equal(victoria.need, 3);
  assert.ok(victoria.summary.includes('3人激活'));
  assert.ok(victoria.bonus.includes('25层'));

  const foresight = covenantMemo('远见');
  assert.ok(foresight.summary.includes('整备区也计入'));
  assert.ok(foresight.bonus.includes('80层'));

  const miracle = covenantMemo('奇迹');
  assert.equal(miracle.bonus.split('100层').length - 1, 1);
});

test('share report formats spoiler-free rank, round summary, and referral url cleanly', () => {
  const round = buildDailyRounds('2026-11-15')[0];
  for (const card of round.cards) {
    card.status = card.isImpostor ? 'punched' : 'kept';
  }
  const summary = summarizeRound(round);
  const stats = {
    punched: round.impostorTotal,
    calibrated: 0,
    keptClean: round.goodTotal,
    mistakes: 0,
    maxCombo: round.impostorTotal,
    roundsCleared: 5,
  };
  const rank = evaluateDealerRank(stats);
  assert.ok(rank.title.includes('重写算法'));

  const shareText = formatDealerShareText({
    mode: 'daily',
    dateKey: '2026-11-15',
    history: [summary],
    stats,
    shareUrl: 'https://example.com/numbers?tool=dealer',
  });
  assert.ok(shareText.includes('#1115'));
  assert.ok(!shareText.includes(round.targetCovenant));
  assert.ok(!shareText.includes(summary.matrix.join('')));
  assert.ok(shareText.includes('🎯零误伤'));
  assert.ok(shareText.includes('🔒考题已防剧透隐藏'));
  assert.ok(shareText.includes('https://example.com/numbers?tool=dealer'));
});

test('poster model builds spoiler-free verdicts, dealer armor, and PNG file metadata', () => {
  const rounds = buildDailyRounds('2026-11-16');
  const first = rounds[0];
  for (const card of first.cards) {
    card.status = card.isImpostor ? 'punched' : 'kept';
  }
  const second = rounds[1];
  second.cards[0].status = second.cards[0].isImpostor ? 'punched' : 'shielded';

  const summary = summarizeRound(first);
  const stats = {
    punched: first.impostorTotal + (second.cards[0].isImpostor ? 1 : 0),
    calibrated: 0,
    keptClean: first.goodTotal,
    mistakes: second.cards[0].isImpostor ? 0 : 1,
    maxCombo: first.impostorTotal,
    roundsCleared: 1,
  };

  const poster = buildDealerPosterModel({
    mode: 'daily',
    dateKey: '2026-11-16',
    history: [summary],
    currentRound: second,
    stats,
    shareUrl: 'https://example.com/numbers?tool=dealer',
  });

  assert.equal(poster.modeLabel, '今日同题 #1116');
  assert.equal(poster.fileName, '卫戍速查-痛扁发牌-1116.png');
  assert.equal(poster.shareUrl, 'https://example.com/numbers?tool=dealer');
  assert.equal(poster.spoilerNotice, '🔒 牌序与考题已防剧透隐藏');
  assert.ok(poster.summaryLine.includes('退货'));
  assert.ok(poster.summaryLine.includes('准确率'));
  assert.ok(['SSS', 'S', 'A', 'B'].includes(poster.grade));
  assert.ok(poster.dealerArmorPct >= 0 && poster.dealerArmorPct <= 100);
  assert.equal(poster.metrics.length, 4);
  assert.equal(poster.metrics[0].label, '退货歪牌');
  assert.equal(poster.metrics[3].unit, '共1轮');
  assert.equal(poster.verdicts.length, 5);
  assert.ok(
    poster.verdicts[0].scopeLabel === '核心盟约' ||
      poster.verdicts[0].scopeLabel === '附加盟约',
  );
  assert.ok(!poster.verdicts[0].scopeLabel.includes(first.targetCovenant));
  assert.equal(poster.verdicts[0].filledCells, 5);
  assert.equal(poster.verdicts[0].tone, 'good');
  assert.equal(poster.verdicts[1].roundNumber, 2);
  assert.equal(poster.verdicts[1].filledCells, 2);
  assert.equal(poster.verdicts[1].title, '正在验牌');
  assert.equal(poster.verdicts[1].tone, 'muted');
  assert.equal(poster.verdicts[4].filledCells, 0);
  assert.equal(poster.verdicts[4].title, '待挑战');
  assert.equal(poster.verdicts[4].tone, 'empty');

  const highAccRank = evaluateDealerRank({
    punched: 9,
    calibrated: 0,
    keptClean: 6,
    mistakes: 1,
    maxCombo: 5,
    roundsCleared: 2,
  });
  assert.ok(!highAccRank.title.includes('PRTS'));

  const noDuplicate = buildDealerPosterModel({
    mode: 'free',
    dateKey: '2026-11-16',
    history: [summary],
    currentRound: first,
    stats: {...stats, roundsCleared: 5, mistakes: 0},
    shareUrl: 'https://example.com/numbers?tool=dealer',
  });
  assert.equal(noDuplicate.grade, 'SSS');
  assert.equal(noDuplicate.dealerArmorPct, 0);
  assert.equal(noDuplicate.verdicts.length, 5);
  assert.equal(noDuplicate.verdicts[0].scopeLabel, first.targetCovenant);
  assert.equal(noDuplicate.verdicts[1].tone, 'empty');
  assert.equal(noDuplicate.fileName, '卫戍速查-痛扁发牌-自由拷打.png');
});

test('reaction copy includes operator Easter eggs and varied lines across seeds', () => {
  const closureHit = reactionLine('hit', '炎', 1, 0, OPERATOR.可露希尔);
  assert.ok(closureHit.includes('可露希尔'));
  assert.ok(closureHit.includes('采购部'));
  assert.ok(closureHit.includes('炎'));

  const sariaMiss = reactionLine('miss', '坚守', 0, 0, OPERATOR.塞雷娅);
  assert.ok(sariaMiss.includes('塞雷娅'));
  assert.ok(sariaMiss.includes('坚守'));
  assert.ok(sariaMiss.includes('钙质化'));

  const clearLines = new Set(
    [0, 1, 2, 3, 4, 5].map((seed) => reactionLine('clear', '炎', 2, seed)),
  );
  assert.ok(clearLines.size >= 4);

  const shuffleLines = new Set([0, 1, 2, 3].map((seed) => replayShuffleLine(seed)));
  assert.ok(shuffleLines.size >= 3);
});
