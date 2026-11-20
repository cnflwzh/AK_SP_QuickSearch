import assert from 'node:assert/strict';
import test from 'node:test';
import {DISPATCH_LEVELS, operatorEliteCopies, STRATEGY} from '../data/index.ts';
import {
  activeMistakes,
  buildDealerRound,
  buildMistakeRound,
  buildScenarioRound,
  createSeededRandom,
  DEALER_MISTAKES_STORAGE_KEY,
  DEALER_SHOP_SIZE,
  isMistakeMastered,
  masteredMistakeCount,
  MAX_MISTAKE_RECORDS,
  MISTAKE_MASTERY_STREAK,
  mistakeStatsByKind,
  normalizeMistakes,
  recordMistake,
  recordRoundMastery,
  SCENARIO_ARCHETYPES,
  SCENARIO_MIN_SCORE_MARGIN,
} from '../src/lib/dealer/index.ts';

let moduleSeq = 0;

function mockStorage(t) {
  const saved = new Map();
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key) => saved.get(key) ?? null,
      setItem: (key, value) => saved.set(key, value),
    },
  });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  });
  return saved;
}

async function loadDealerGame() {
  const {useDealerGame} = await import(
    `../src/quickref/numbers/useDealerGame.ts?ext=${++moduleSeq}`
  );
  return useDealerGame();
}

test('mistake book records, deduplicates, masters after clean streak, and caps at max records', () => {
  const rng = createSeededRandom('mistake-lifecycle');
  const round = buildDealerRound({
    roundNumber: 1,
    kind: 'covenant',
    targetCovenant: '谢拉格',
    rng,
  });
  const goodCard = round.cards.find((c) => !c.isImpostor);
  assert.ok(goodCard);

  let list = [];
  list = recordMistake(list, round, goodCard, 1000);
  assert.equal(list.length, 1);
  assert.equal(list[0].wrongCount, 1);
  assert.equal(list[0].correctStreak, 0);
  assert.equal(isMistakeMastered(list[0]), false);

  // Repeat miss increments count and resets streak.
  list = recordMistake(list, round, goodCard, 2000);
  assert.equal(list.length, 1);
  assert.equal(list[0].wrongCount, 2);
  assert.equal(list[0].lastWrongAt, 2000);

  // Clean round increments streak; reaches mastery at MISTAKE_MASTERY_STREAK.
  for (let step = 1; step <= MISTAKE_MASTERY_STREAK; step++) {
    const cleanRound = {
      ...round,
      cards: round.cards.map((c) => ({
        ...c,
        status: c.isImpostor ? 'punched' : 'kept',
      })),
    };
    list = recordRoundMastery(list, cleanRound);
    assert.equal(list[0].correctStreak, step);
  }
  assert.equal(isMistakeMastered(list[0]), true);
  assert.equal(activeMistakes(list).length, 0);
  assert.equal(masteredMistakeCount(list), 1);

  // Another miss resets mastery.
  list = recordMistake(list, round, goodCard, 3000);
  assert.equal(list[0].correctStreak, 0);
  assert.equal(isMistakeMastered(list[0]), false);
  assert.equal(activeMistakes(list).length, 1);
  assert.equal(mistakeStatsByKind(list)[0].kind, 'covenant');

  // Normalize drops bad records and trims to MAX_MISTAKE_RECORDS.
  const bulk = [];
  for (let i = 0; i < MAX_MISTAKE_RECORDS + 30; i++) {
    bulk.push({
      roundKind: 'covenant',
      cardKind: 'operator',
      title: `测试干员${i}`,
      targetKey: '谢拉格',
      targetLabel: '谢拉格',
      wrongCount: i % 3 === 0 ? 3 : 1,
      correctStreak: i < 20 ? 2 : 0,
      lastWrongAt: 1000 + i,
    });
  }
  const normalized = normalizeMistakes([...bulk, {bad: true}, null]);
  assert.equal(normalized.length, MAX_MISTAKE_RECORDS);
  // Active records are preserved ahead of mastered ones when trimming.
  assert.ok(activeMistakes(normalized).length >= MAX_MISTAKE_RECORDS - 20);
});

test('buildMistakeRound constructs valid 5-card review rounds containing the missed item across all 7 knowledge kinds', () => {
  const rng = createSeededRandom('mistake-all-kinds');
  const sampleRounds = [
    buildDealerRound({
      roundNumber: 1,
      kind: 'covenant',
      targetCovenant: '维多利亚',
      rng,
    }),
    buildDealerRound({
      roundNumber: 2,
      kind: 'transmute',
      targetCovenant: '谢拉格',
      rng,
    }),
    buildDealerRound({
      roundNumber: 3,
      kind: 'trigger',
      triggerTheme: 'on_acquire',
      rng,
    }),
    buildDealerRound({
      roundNumber: 4,
      kind: 'tier_check',
      tierCheckTheme: 'high_core_56',
      rng,
    }),
    buildDealerRound({
      roundNumber: 5,
      kind: 'equipment',
      equipTheme: 'consumable',
      rng,
    }),
    buildDealerRound({
      roundNumber: 6,
      kind: 'strategy',
      strategyTheme: 'high_hp',
      rng,
    }),
    buildDealerRound({
      roundNumber: 7,
      kind: 'bounty',
      bountyTheme: 'big_bounty',
      rng,
    }),
  ];

  for (const sample of sampleRounds) {
    const missedCard = sample.cards.find((c) => !c.isImpostor);
    assert.ok(missedCard, `Expected good card in ${sample.kind}`);
    const list = recordMistake([], sample, missedCard, 5000);
    const review = buildMistakeRound(list, {roundNumber: 10, rng});
    assert.ok(review, `Expected mistake round for ${sample.kind}`);
    assert.equal(review.kind, sample.kind);
    assert.equal(review.isMistakeReview, true);
    assert.equal(review.cards.length, DEALER_SHOP_SIZE);
    assert.equal(
      new Set(review.cards.map((c) => c.title)).size,
      DEALER_SHOP_SIZE,
    );
    assert.ok(
      review.cards.some((c) => c.title === missedCard.title),
      `Mistake round (${sample.kind}) must include missed item ${missedCard.title}`,
    );
  }
});

test('reviewing a removed card or a different transmutation cannot advance the original mistake', () => {
  const rng = createSeededRandom('removed-review');
  const round = buildDealerRound({
    roundNumber: 1,
    kind: 'transmute',
    targetCovenant: '谢拉格',
    rng,
  });
  const original = round.cards.find((card) => card.attachedEquip && !card.isImpostor);
  assert.ok(original);
  const records = recordMistake([], round, original);
  const differentEquip = {
    ...round,
    cards: [{...original, isImpostor: true, status: 'punched'}],
  };
  assert.equal(recordRoundMastery(records, differentEquip)[0].correctStreak, 0);
  const obsolete = {...records[0], title: '已移出的干员'};
  assert.equal(buildMistakeRound([obsolete], {roundNumber: 2, rng}), null);
});

test('buildScenarioRound produces unambiguous, advisor-verified best-pick rounds across all archetypes', () => {
  for (const archetype of SCENARIO_ARCHETYPES) {
    const seeds = Array.from(
      {length: 10},
      (_, i) => `scenario-${archetype}-${i}`,
    );
    if (archetype === 'covenant_step') seeds.push('review-11');
    if (archetype === 'elite_promote') seeds.push('review-36');
    for (const [i, seed] of seeds.entries()) {
      const rng = createSeededRandom(seed);
      const round = buildScenarioRound({
        roundNumber: i + 1,
        rng,
        preferredArchetype: archetype,
      });
      assert.equal(round.kind, 'scenario');
      assert.equal(round.selectionMode, 'best_pick');
      assert.ok(round.scenarioContext);
      const context = round.scenarioContext;
      assert.equal(context.archetype, archetype);
      const shopSize = DISPATCH_LEVELS.find(
        (row) => row.level === context.level,
      ).operatorSlots;
      assert.equal(round.cards.length, shopSize);
      assert.equal(round.goodTotal + round.impostorTotal, shopSize);
      assert.equal(new Set(round.cards.map((c) => c.title)).size, shopSize);

      const bestCards = round.cards.filter((c) => c.isBestPick);
      assert.equal(bestCards.length, 1);

      const sortedByRank = [...round.cards].sort(
        (a, b) => (a.advisorRank ?? 99) - (b.advisorRank ?? 99),
      );
      assert.deepEqual(
        sortedByRank.map((c) => c.advisorRank),
        Array.from({length: shopSize}, (_, rank) => rank + 1),
      );

      const [first, second] = sortedByRank;
      assert.ok(first.operator && first.operator.stars > 0);
      if (archetype === 'elite_promote') {
        const owned = context.deployed.find(
          (unit) => unit.name === first.title,
        );
        assert.equal(owned?.copies, operatorEliteCopies(first.operator) - 1);
      } else if (archetype === 'budget_synergy') {
        const reserve =
          STRATEGY[context.strategy]?.advisor?.reserveFundsFloor?.minFunds ?? 0;
        assert.ok(first.operator.covenants.includes(context.goalCovenant));
        assert.equal(context.funds - first.price, reserve);
        assert.ok(
          round.cards.some(
            (card) =>
              card.operator.covenants.includes(context.goalCovenant) &&
              context.funds - card.price < reserve,
          ),
        );
      }
      assert.ok(first.operator.tier <= round.scenarioContext.level);
      assert.ok(
        (first.price ?? 99) <= round.scenarioContext.funds,
        `Top pick ${first.title} must be affordable`,
      );
      assert.ok(
        (first.advisorReasons?.length ?? 0) > 0,
        'Top pick must include advisor reasons',
      );

      const runnerUpUnaffordable = second.advisorLabel === '资金不足';
      const scoreGap = (first.advisorScore ?? 0) - (second.advisorScore ?? 0);
      assert.ok(
        runnerUpUnaffordable || scoreGap >= SCENARIO_MIN_SCORE_MARGIN,
        `Expected clear margin for ${archetype}#${i}: gap=${scoreGap}, runnerUp=${second.advisorLabel}`,
      );
    }
  }
});

test('useDealerGame tracks mistakes into storage, supports mistake drill, and handles scenario best-pick flow', async (t) => {
  const saved = mockStorage(t);
  const game = await loadDealerGame();

  // Trigger a mistake on daily round 1.
  const firstGoodIdx = game.round.value.cards.findIndex((c) => !c.isImpostor);
  const missedTitle = game.round.value.cards[firstGoodIdx].title;
  game.tapCard(firstGoodIdx);
  assert.equal(game.activeMistakeList.value.length, 1);
  assert.equal(game.activeMistakeList.value[0].title, missedTitle);
  assert.ok(saved.has(DEALER_MISTAKES_STORAGE_KEY));

  // Start mistake drill -> Free Play switches to review round containing missedTitle.
  game.startMistakeDrill();
  assert.equal(game.state.mode, 'free');
  assert.equal(game.state.focusCovenant, 'mistakes');
  assert.equal(game.round.value.isMistakeReview, true);
  assert.ok(game.round.value.cards.some((c) => c.title === missedTitle));

  // 校准覆盖整轮，自动留下的错题不能计入连对。
  game.session.value.rage = 100;
  game.castUltimate();
  assert.equal(game.isRoundCleared.value, true);
  assert.equal(game.activeMistakeList.value[0].correctStreak, 0);
  game.nextRound();

  // Clear two review rounds cleanly -> mistake becomes mastered.
  for (let pass = 0; pass < MISTAKE_MASTERY_STREAK; pass++) {
    game.round.value.cards.forEach((c, idx) => {
      if (c.isImpostor && c.status === 'unseen') game.tapCard(idx);
    });
    assert.equal(game.isRoundCleared.value, true);
    if (pass + 1 < MISTAKE_MASTERY_STREAK) game.nextRound();
  }
  assert.equal(game.activeMistakeList.value.length, 0);
  assert.equal(game.masteredMistakes.value, 1);
  assert.equal(game.state.focusCovenant, '');
  game.nextRound();
  assert.ok(!game.round.value.isMistakeReview);

  // Switch Free Play focus to practical recruit scenarios (`kind:scenario`).
  game.setFocusCovenant('kind:scenario');
  assert.equal(game.round.value.kind, 'scenario');
  assert.equal(game.round.value.selectionMode, 'best_pick');
  assert.equal(game.isRoundCleared.value, false);

  // Tapping a suboptimal card reveals it, counts mistake, does NOT clear round or add entity mistake.
  const wrongIdx = game.round.value.cards.findIndex((c) => !c.isBestPick);
  game.tapCard(wrongIdx);
  assert.equal(game.round.value.cards[wrongIdx].status, 'shielded');
  assert.equal(game.isRoundCleared.value, false);
  assert.equal(game.activeMistakeList.value.length, 0);

  // Tapping the optimal card clears the round immediately and reveals remaining cards.
  const bestIdx = game.round.value.cards.findIndex((c) => c.isBestPick);
  game.tapCard(bestIdx);
  assert.equal(game.round.value.cards[bestIdx].status, 'punched');
  assert.equal(game.isRoundCleared.value, true);
  assert.ok(game.round.value.cards.every((c) => c.status !== 'unseen'));
});
