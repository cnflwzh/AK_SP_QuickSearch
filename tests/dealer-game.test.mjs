import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BOUNTY_THEMES,
  buildDailyRounds,
  buildDealerPosterModel,
  buildDealerRound,
  covenantMemo,
  createSeededRandom,
  DAILY_ROUND_COUNT,
  DEALER_SHOP_SIZE,
  EQUIP_THEMES,
  evaluateDealerRank,
  formatDealerShareText,
  reactionLine,
  replayShuffleLine,
  SELECTABLE_COVENANTS,
  STRATEGY_THEMES,
  summarizeRound,
  TIER_CHECK_THEMES,
  TRANSMUTE_COVENANTS,
  TRIGGER_THEMES,
} from '../src/lib/dealer/index.ts';
import {
  CORE_COVENANTS,
  EQUIPMENT_COMBOS,
  matchesOperatorTrigger,
  OPERATORS,
} from '../data/index.ts';

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
    assert.ok(falseTransmuters.length >= 1, `Expected decoy transmuter for ${covenant}`);
  }
});

test('all 5 equipment round themes match equipment catalog rules accurately', () => {
  const comboParts = new Set(EQUIPMENT_COMBOS.flatMap(([a, b]) => [a, b]));
  const rng = createSeededRandom('equip-themes-check');

  for (const theme of EQUIP_THEMES) {
    const round = buildDealerRound({
      roundNumber: 5,
      kind: 'equipment',
      equipTheme: theme,
      rng,
    });
    assert.equal(round.kind, 'equipment');
    assert.equal(round.cards.length, DEALER_SHOP_SIZE);
    assert.equal(
      new Set(round.cards.map((c) => c.title)).size,
      DEALER_SHOP_SIZE,
    );
    for (const card of round.cards) {
      assert.equal(card.cardKind, 'equipment');
      assert.equal(card.detailKind, 'eq');
      assert.ok(card.equipment);
      const eq = card.equipment;
      let expectedMatch = false;
      if (theme === 'transmute_capable') expectedMatch = eq.covenant !== null;
      else if (theme === 'upgradable') expectedMatch = eq.advanced !== null;
      else if (theme === 'consumable')
        expectedMatch = eq.effect.startsWith('装备时销毁');
      else if (theme === 'combo_recipe')
        expectedMatch = comboParts.has(eq.name);
      else if (theme === 'price_thrift')
        expectedMatch = eq.price === 1;
      assert.equal(card.isImpostor, !expectedMatch);
    }
    assert.ok(round.goodTotal >= 2);
    assert.ok(round.impostorTotal >= 2);
  }
});

test('trigger, tier_check, strategy, and bounty themes match static rules cleanly', () => {
  const rng = createSeededRandom('new-kinds-check');

  for (const theme of TRIGGER_THEMES) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const round = buildDealerRound({
        roundNumber: 2,
        kind: 'trigger',
        triggerTheme: theme,
        rng,
      });
      assert.equal(round.kind, 'trigger');
      assert.equal(round.cards.length, DEALER_SHOP_SIZE);
      assert.equal(new Set(round.cards.map((c) => c.title)).size, DEALER_SHOP_SIZE);
      for (const card of round.cards) {
        assert.equal(card.cardKind, 'operator');
        assert.equal(card.detailKind, 'op');
        assert.ok(card.operator);
        const op = card.operator;
        let expectedMatch = false;
        if (theme === 'on_acquire') expectedMatch = matchesOperatorTrigger(op, '获得时', false);
        else if (theme === 'rest_end') expectedMatch = matchesOperatorTrigger(op, '休整期结束', false);
        else if (theme === 'prep_type') expectedMatch = op.type === '整备能力';
        else if (theme === 'in_battle_stack')
          expectedMatch = matchesOperatorTrigger(op, '战斗中', false) && op.type === '持续叠加';
        assert.equal(card.isImpostor, !expectedMatch);
        if (theme === 'rest_end' && op.name === '寒檀') {
          assert.equal(card.isImpostor, false);
        }
      }
      assert.ok(round.goodTotal >= 2);
      assert.ok(round.impostorTotal >= 2);
    }
  }

  for (const theme of TIER_CHECK_THEMES) {
    const round = buildDealerRound({
      roundNumber: 2,
      kind: 'tier_check',
      tierCheckTheme: theme,
      rng,
    });
    assert.equal(round.kind, 'tier_check');
    assert.equal(round.cards.length, DEALER_SHOP_SIZE);
    assert.equal(new Set(round.cards.map((c) => c.title)).size, DEALER_SHOP_SIZE);
    for (const card of round.cards) {
      assert.equal(card.hideTierBeforeReveal, true);
      assert.equal(card.cornerBadgeHidden, '?');
      if (theme === 'low_shop_3') {
        assert.equal(card.cardKind, 'operator');
        assert.equal(card.isImpostor, card.tier > 3);
      } else if (theme === 'high_core_56') {
        assert.equal(card.cardKind, 'operator');
        assert.equal(card.isImpostor, card.tier < 5);
      } else {
        assert.equal(card.cardKind, 'equipment');
        assert.equal(card.isImpostor, card.tier < 5);
      }
    }
    assert.ok(round.goodTotal >= 2);
    assert.ok(round.impostorTotal >= 2);
  }

  for (const theme of STRATEGY_THEMES) {
    const round = buildDealerRound({
      roundNumber: 5,
      kind: 'strategy',
      strategyTheme: theme,
      rng,
    });
    assert.equal(round.kind, 'strategy');
    assert.equal(round.cards.length, DEALER_SHOP_SIZE);
    assert.equal(new Set(round.cards.map((c) => c.title)).size, DEALER_SHOP_SIZE);
    for (const card of round.cards) {
      assert.equal(card.cardKind, 'strategy');
      assert.equal(card.detailKind, 'st');
      assert.ok(card.strategy);
      const st = card.strategy;
      let expectedMatch = false;
      if (theme === 'faction_exclusive') expectedMatch = CORE_COVENANTS.includes(st.category);
      else if (theme === 'active_command')
        expectedMatch = st.effect.includes('点击（') || st.effect.includes('拖拽（');
      else if (theme === 'stack_focus') expectedMatch = st.category === '叠层';
      else if (theme === 'high_hp') {
        expectedMatch = st.hp >= 28;
        assert.equal(card.hideTierBeforeReveal, true);
        assert.equal(card.cornerBadgeHidden, '❤?');
      }
      assert.equal(card.isImpostor, !expectedMatch);
    }
    assert.ok(round.goodTotal >= 2);
    assert.ok(round.impostorTotal >= 2);
  }

  for (const theme of BOUNTY_THEMES) {
    const round = buildDealerRound({
      roundNumber: 5,
      kind: 'bounty',
      bountyTheme: theme,
      rng,
    });
    assert.equal(round.kind, 'bounty');
    assert.equal(round.cards.length, DEALER_SHOP_SIZE);
    assert.equal(new Set(round.cards.map((c) => c.title)).size, DEALER_SHOP_SIZE);
    assert.equal(new Set(round.cards.map((c) => c.enemyId)).size, DEALER_SHOP_SIZE);
    for (const card of round.cards) {
      assert.equal(card.cardKind, 'bounty');
      assert.equal(card.detailKind, undefined);
      assert.equal(card.hideTierBeforeReveal, true);
      assert.equal(card.cornerBadgeHidden, '💰?');
      assert.ok(card.bounty);
      const b = card.bounty;
      const expectedMatch =
        theme === 'big_bounty'
          ? b.when === '下场' && b.funds >= 4
          : b.when === '下场' && b.funds >= 1 && b.funds <= 2;
      assert.equal(card.isImpostor, !expectedMatch);
    }
    assert.ok(round.goodTotal >= 2);
    assert.ok(round.impostorTotal >= 2);
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

test('share report formats spoiler-free rank, hint badges, round summary, and referral url cleanly', () => {
  const rounds = buildDailyRounds('2026-11-15');
  const first = rounds[0];
  for (const card of first.cards) {
    card.status = card.isImpostor ? 'punched' : 'kept';
  }
  const blindSummary = summarizeRound(first);
  const stats = {
    punched: first.impostorTotal,
    calibrated: 0,
    keptClean: first.goodTotal,
    mistakes: 0,
    maxCombo: first.impostorTotal,
    roundsCleared: 5,
    hintsUsed: 0,
    hintedRounds: 0,
  };
  const rank = evaluateDealerRank(stats);
  assert.ok(rank.title.includes('重写算法'));

  const blindShare = formatDealerShareText({
    mode: 'daily',
    dateKey: '2026-11-15',
    history: [blindSummary],
    stats,
    shareUrl: 'https://example.com/tools?tool=dealer',
  });
  assert.ok(blindShare.includes('#1115'));
  assert.ok(blindShare.includes('👁️ 全程盲猜'));
  assert.ok(!blindShare.includes(first.targetCovenant));
  assert.ok(!blindShare.includes(blindSummary.matrix.join('')));
  assert.ok(blindShare.includes('🎯零误判'));
  assert.ok(!blindShare.includes('(💡)'));
  assert.ok(blindShare.includes('🔒考题已防剧透隐藏'));
  assert.ok(blindShare.includes('https://example.com/tools?tool=dealer'));

  const second = rounds[1];
  second.usedHint = true;
  for (const card of second.cards) {
    card.status = card.isImpostor ? 'punched' : 'kept';
  }
  const hintedSummary = summarizeRound(second);
  const hintedShare = formatDealerShareText({
    mode: 'daily',
    dateKey: '2026-11-15',
    history: [blindSummary, hintedSummary],
    stats: {...stats, hintsUsed: 2, hintedRounds: 1},
    shareUrl: 'https://example.com/tools?tool=dealer',
  });
  assert.ok(hintedShare.includes('💡 场中提示 ×2'));
  assert.ok(hintedShare.includes('🎯零误判(💡)'));
});

test('poster model annotates blind vs hinted rounds cleanly without spoilers', () => {
  const rounds = buildDailyRounds('2026-11-16');
  const first = rounds[0];
  for (const card of first.cards) {
    card.status = card.isImpostor ? 'punched' : 'kept';
  }
  const second = rounds[1];
  second.usedHint = true;
  second.cards[0].status = second.cards[0].isImpostor ? 'punched' : 'shielded';

  const summary = summarizeRound(first);
  const blindStats = {
    punched: first.impostorTotal,
    calibrated: 0,
    keptClean: first.goodTotal,
    mistakes: 0,
    maxCombo: first.impostorTotal,
    roundsCleared: 1,
    hintsUsed: 0,
    hintedRounds: 0,
  };

  const blindPoster = buildDealerPosterModel({
    mode: 'daily',
    dateKey: '2026-11-16',
    history: [summary],
    stats: blindStats,
    shareUrl: 'https://example.com/tools?tool=dealer',
  });
  assert.equal(blindPoster.hintBadge.tone, 'blind');
  assert.equal(blindPoster.hintBadge.text, '👁️ 全程盲猜');
  assert.equal(blindPoster.metrics[3].unit, '零提示·1轮');
  assert.equal(blindPoster.verdicts[0].scopeLabel, '盟约点名');
  assert.equal(blindPoster.verdicts[0].title, '一眼识破');

  const hintedRound2Done = {
    roundNumber: 2,
    roundKind: 'transmute',
    targetCovenant: second.targetCovenant,
    matrix: second.cards.map((c) => (c.isImpostor ? '👊' : '🟩')),
    mistakes: 0,
    calibrated: false,
    usedHint: true,
  };
  const equipRound3Done = {
    roundNumber: 3,
    roundKind: 'equipment',
    targetCovenant: '可同名进阶装',
    matrix: ['👊', '🟩', '👊', '🟩', '🟩'],
    mistakes: 0,
    calibrated: false,
    usedHint: false,
  };

  const fourth = rounds[3];
  fourth.usedHint = true;
  const hintedPoster = buildDealerPosterModel({
    mode: 'daily',
    dateKey: '2026-11-16',
    history: [summary, hintedRound2Done, equipRound3Done],
    currentRound: fourth,
    stats: {...blindStats, roundsCleared: 3, hintsUsed: 2, hintedRounds: 2},
    shareUrl: 'https://example.com/tools?tool=dealer',
  });
  assert.equal(hintedPoster.modeLabel, '今日同题 #1116');
  assert.equal(hintedPoster.fileName, '卫戍速查-痛扁发牌-1116.png');
  assert.equal(hintedPoster.spoilerNotice, '🔒 考题防剧透');
  assert.equal(hintedPoster.hintBadge.tone, 'hinted');
  assert.equal(hintedPoster.hintBadge.text, '💡 场中提示 ×2');
  assert.equal(hintedPoster.metrics[3].unit, '含提示×2');
  assert.equal(hintedPoster.verdicts[0].scopeLabel, '盟约点名');
  assert.equal(hintedPoster.verdicts[1].scopeLabel, '同构转职');
  assert.equal(hintedPoster.verdicts[1].title, '借提示识破');
  assert.equal(hintedPoster.verdicts[1].detail, '💡 本轮点过提示');
  assert.equal(hintedPoster.verdicts[1].usedHint, true);
  assert.equal(hintedPoster.verdicts[2].scopeLabel, '装备整备');
  assert.equal(hintedPoster.verdicts[3].scopeLabel, '装备整备');
  assert.equal(hintedPoster.verdicts[3].title, '正在核对');
  assert.equal(hintedPoster.verdicts[3].detail, '💡 本轮点过提示');
  assert.equal(hintedPoster.verdicts[4].tone, 'empty');

  const allKindsHistory = [
    {roundNumber: 1, roundKind: 'covenant', targetCovenant: '炎', matrix: ['👊', '🟩', '👊', '🟩', '🟩'], mistakes: 0, calibrated: false, usedHint: false},
    {roundNumber: 2, roundKind: 'trigger', targetCovenant: '获得时触发', matrix: ['👊', '🟩', '👊', '🟩', '🟩'], mistakes: 0, calibrated: false, usedHint: false},
    {roundNumber: 3, roundKind: 'tier_check', targetCovenant: '1~3 阶低本干员', matrix: ['👊', '🟩', '👊', '🟩', '🟩'], mistakes: 0, calibrated: false, usedHint: false},
    {roundNumber: 4, roundKind: 'strategy', targetCovenant: '叠层流派策略', matrix: ['👊', '🟩', '👊', '🟩', '🟩'], mistakes: 0, calibrated: false, usedHint: false},
    {roundNumber: 5, roundKind: 'bounty', targetCovenant: '单场 4~5 资金高赏金', matrix: ['👊', '🟩', '👊', '🟩', '🟩'], mistakes: 0, calibrated: false, usedHint: false},
  ];
  const dailyAllKindsPoster = buildDealerPosterModel({
    mode: 'daily',
    dateKey: '2026-11-16',
    history: allKindsHistory,
    stats: {...blindStats, roundsCleared: 5},
    shareUrl: 'https://example.com/tools?tool=dealer',
  });
  assert.deepEqual(
    dailyAllKindsPoster.verdicts.map((v) => v.scopeLabel),
    ['盟约点名', '特质时机', '升本验阶', '开局策略', '悬赏猎金'],
  );

  const assistPoster = buildDealerPosterModel({
    mode: 'free',
    dateKey: '2026-11-16',
    history: allKindsHistory,
    stats: {...blindStats, roundsCleared: 5, hintsUsed: 1, hintedRounds: 1},
    shareUrl: 'https://example.com/tools?tool=dealer',
    usedAssistOnly: true,
  });
  assert.equal(assistPoster.hintBadge.tone, 'assist');
  assert.equal(assistPoster.hintBadge.text, '📖 提示模式');
  assert.equal(assistPoster.grade, 'SSS');
  assert.equal(assistPoster.dealerArmorPct, 0);
  assert.deepEqual(
    assistPoster.verdicts.map((v) => v.scopeLabel),
    ['炎', '时机·获得时触发', '验阶·1~3 阶低本干员', '策略·叠层流派策略', '悬赏·单场 4~5 资金高赏金'],
  );
  assert.equal(assistPoster.fileName, '卫戍速查-痛扁发牌-自由拷打.png');
});

test('reaction copy uses dealer perspective with dynamic operator and covenant placeholders', () => {
  const sampleOp = OPERATORS[0];
  const hitLines = new Set(
    Array.from({length: 12}, (_, seed) =>
      reactionLine('hit', '炎', 1, seed, sampleOp),
    ),
  );
  assert.ok(hitLines.size >= 8);
  for (const line of hitLines) {
    assert.ok(line.includes(sampleOp.name) || line.includes('炎'));
    assert.ok(!line.includes('：「'));
  }

  const missLines = new Set(
    Array.from({length: 10}, (_, seed) =>
      reactionLine('miss', '坚守', 0, seed, sampleOp),
    ),
  );
  assert.ok(missLines.size >= 8);
  for (const line of missLines) {
    assert.ok(line.includes(sampleOp.name) || line.includes('坚守'));
    assert.ok(!line.includes('：「'));
  }

  const clearLines = new Set(
    [0, 1, 2, 3, 4, 5].map((seed) => reactionLine('clear', '炎', 2, seed)),
  );
  assert.ok(clearLines.size >= 4);

  const shuffleLines = new Set([0, 1, 2, 3].map((seed) => replayShuffleLine(seed)));
  assert.ok(shuffleLines.size >= 3);
});

test('all copy excludes dehumanizing or merchandise terms toward operators', () => {
  const banned =
    /滞销|退货|批发|清仓|假货|以次充好|凑单|凑数|混子|南郭|滥竽|疯狗|旱鸭|脆皮|笨重|慢动作|污秽|口粮|废铁|白嫖|歪牌|坏牌|质检|误伤|买错牌|退掉|踢出|踢掉|踹|赶出|冷门|可露希尔|：「/;

  const collected = [];
  const rng = createSeededRandom('banned-copy-check');
  for (const covenant of SELECTABLE_COVENANTS) {
    for (let introSeed = 0; introSeed < 14; introSeed++) {
      collected.push(
        buildDealerRound({
          roundNumber: 1,
          kind: 'covenant',
          targetCovenant: covenant,
          rng,
          introSeed,
        }).introLine,
      );
    }
  }
  for (const covenant of TRANSMUTE_COVENANTS.slice(0, 6)) {
    for (let introSeed = 0; introSeed < 6; introSeed++) {
      collected.push(
        buildDealerRound({
          roundNumber: 2,
          kind: 'transmute',
          targetCovenant: covenant,
          rng,
          introSeed,
        }).introLine,
      );
    }
  }
  for (const theme of EQUIP_THEMES) {
    for (let introSeed = 0; introSeed < 5; introSeed++) {
      const round = buildDealerRound({
        roundNumber: 4,
        kind: 'equipment',
        equipTheme: theme,
        rng,
        introSeed,
      });
      collected.push(round.introLine, round.targetLabel, round.missionSummary, round.missionBonus);
    }
  }
  for (const theme of TRIGGER_THEMES) {
    for (let introSeed = 0; introSeed < 4; introSeed++) {
      const round = buildDealerRound({
        roundNumber: 2,
        kind: 'trigger',
        triggerTheme: theme,
        rng,
        introSeed,
      });
      collected.push(round.introLine, round.targetLabel, round.missionSummary, round.missionBonus);
    }
  }
  for (const theme of TIER_CHECK_THEMES) {
    for (let introSeed = 0; introSeed < 4; introSeed++) {
      const round = buildDealerRound({
        roundNumber: 2,
        kind: 'tier_check',
        tierCheckTheme: theme,
        rng,
        introSeed,
      });
      collected.push(round.introLine, round.targetLabel, round.missionSummary, round.missionBonus);
    }
  }
  for (const theme of STRATEGY_THEMES) {
    for (let introSeed = 0; introSeed < 4; introSeed++) {
      const round = buildDealerRound({
        roundNumber: 5,
        kind: 'strategy',
        strategyTheme: theme,
        rng,
        introSeed,
      });
      collected.push(round.introLine, round.targetLabel, round.missionSummary, round.missionBonus);
    }
  }
  for (const theme of BOUNTY_THEMES) {
    for (let introSeed = 0; introSeed < 4; introSeed++) {
      const round = buildDealerRound({
        roundNumber: 5,
        kind: 'bounty',
        bountyTheme: theme,
        rng,
        introSeed,
      });
      collected.push(round.introLine, round.targetLabel, round.missionSummary, round.missionBonus);
    }
  }

  const syntheticOp = {...OPERATORS[0], name: '示例干员'};
  for (let seed = 0; seed < 12; seed++) {
    collected.push(reactionLine('hit', '炎', 1, seed, syntheticOp));
    collected.push(reactionLine('hit', '炎', 3, seed, syntheticOp));
    collected.push(reactionLine('miss', '炎', 0, seed, syntheticOp));
    collected.push(reactionLine('ultimate', '炎', 3, seed, syntheticOp));
    collected.push(reactionLine('clear', '炎', 2, seed, syntheticOp));
  }

  for (const op of OPERATORS) {
    const hitLine = reactionLine('hit', '炎', 1, 0, op);
    const missLine = reactionLine('miss', '炎', 0, 0, op);
    assert.ok(hitLine.includes(op.name) || hitLine.includes('炎'));
    assert.ok(missLine.includes(op.name) || missLine.includes('炎'));
    assert.ok(!hitLine.includes('：「'));
    assert.ok(!missLine.includes('：「'));
  }

  for (let seed = 0; seed < 8; seed++) {
    collected.push(replayShuffleLine(seed));
  }

  const statCases = [
    {punched: 0, calibrated: 0, keptClean: 0, mistakes: 0, maxCombo: 0, roundsCleared: 0, hintsUsed: 0, hintedRounds: 0},
    {punched: 12, calibrated: 0, keptClean: 13, mistakes: 0, maxCombo: 5, roundsCleared: 5, hintsUsed: 0, hintedRounds: 0},
    {punched: 10, calibrated: 2, keptClean: 12, mistakes: 1, maxCombo: 4, roundsCleared: 4, hintsUsed: 2, hintedRounds: 1},
    {punched: 6, calibrated: 0, keptClean: 9, mistakes: 2, maxCombo: 3, roundsCleared: 3, hintsUsed: 1, hintedRounds: 1},
    {punched: 3, calibrated: 0, keptClean: 6, mistakes: 4, maxCombo: 1, roundsCleared: 2, hintsUsed: 0, hintedRounds: 0},
  ];
  for (const stats of statCases) {
    const rank = evaluateDealerRank(stats);
    collected.push(rank.title, rank.subtitle, rank.dealerDamage);
    const dailyPoster = buildDealerPosterModel({
      mode: 'daily',
      dateKey: '2026-11-16',
      history: [],
      stats,
      shareUrl: 'https://example.com/tools?tool=dealer',
    });
    collected.push(
      dailyPoster.badgeText,
      dailyPoster.modeLabel,
      dailyPoster.hintBadge.text,
      dailyPoster.summaryLine,
      dailyPoster.spoilerNotice,
      dailyPoster.dealerQuote,
      dailyPoster.ctaTitle,
      ...dailyPoster.metrics.flatMap((m) => [m.label, m.value, m.unit]),
    );
    collected.push(
      formatDealerShareText({
        mode: 'daily',
        dateKey: '2026-11-16',
        history: [],
        stats,
        shareUrl: 'https://example.com/tools?tool=dealer',
      }),
    );
  }

  for (const line of collected) {
    assert.ok(!banned.test(line), `Unexpected banned phrase in: ${line}`);
  }
});
