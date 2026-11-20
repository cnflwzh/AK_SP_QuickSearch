import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ADDON_COVENANTS,
  ALL_COVENANTS,
  BOUNTIES,
  COMBAT_ROLE_LABELS,
  CORE_BUILDS,
  CORE_COVENANTS,
  COVENANTS,
  COVENANT_IDS,
  DEFAULT_BUILD_ID,
  DEFAULT_COVENANT_ID,
  DEPLOYMENT_BONUS_EQUIP,
  ENEMY_GLOSSARY,
  EQUIP,
  EQUIPMENT,
  EQUIPMENT_COMBOS,
  LEADERS,
  MIXED_BUILDS,
  MIXED_BUILD_IDS,
  OPERATOR,
  OPERATORS,
  RESERVE_COVENANTS,
  SEASONS,
  SEASON_META,
  SHARE_OPERATOR_IDS,
  STRATEGIES,
  STRATEGY,
  STRATEGY_CATEGORIES,
  TRAINING,
  getSeason,
  isBannableCovenant,
  operatorEliteCopies,
  operatorPrice,
  operatorSellMechanics,
  operatorSellPrice,
  strategyUsesAdvisorCommand,
} from '../data/index.ts';
import {CURRENT_SEASON} from '../data/season.ts';
import {diffSeasons} from '../src/lib/season/diff.ts';
import {leaderGlossaryTerms} from '../src/lib/leaders/leader.ts';
import {covenantStats, newSlot} from '../src/lib/plans/index.ts';
import {
  advisorDeploymentLimit,
  newAdvisorRun,
  recruitPriceRange,
} from '../src/lib/recommendation/live/advisorState.ts';
import {explainStrategyTransition} from '../src/lib/recommendation/live/advisorStrategy.ts';
import {buildKey, covenantName} from '../src/router/entities.ts';

test('season bundle integrity: references, covenants, IDs, share IDs, and defaults stay consistent', () => {
  const coreSet = new Set(CORE_COVENANTS);
  const addonSet = new Set(ADDON_COVENANTS);
  const allCovenantSet = new Set(ALL_COVENANTS);
  const strategyCatSet = new Set([...STRATEGY_CATEGORIES, ...CORE_COVENANTS]);

  const roleSet = new Set(COMBAT_ROLE_LABELS);
  for (const op of OPERATORS) {
    assert.ok(op.covenants.length > 0, `${op.name} has no covenants`);
    for (const cov of op.covenants) {
      assert.ok(
        allCovenantSet.has(cov),
        `Unknown covenant ${cov} on ${op.name}`,
      );
    }
    for (const role of op.roles ?? []) {
      assert.ok(roleSet.has(role), `Unknown role ${role} on ${op.name}`);
    }
  }
  for (const eq of EQUIPMENT) {
    if (eq.covenant !== null) {
      assert.ok(
        allCovenantSet.has(eq.covenant),
        `Unknown covenant ${eq.covenant} on equip ${eq.name}`,
      );
    }
    for (const role of eq.roles ?? []) {
      assert.ok(roleSet.has(role), `Unknown role ${role} on equip ${eq.name}`);
    }
  }
  for (const combo of EQUIPMENT_COMBOS) {
    for (const eqName of combo) {
      assert.ok(EQUIP[eqName], `Missing equip ${eqName} in combo`);
    }
  }
  for (const st of STRATEGIES) {
    assert.ok(
      strategyCatSet.has(st.category),
      `Unknown strategy category ${st.category} on ${st.name}`,
    );
  }

  for (const [key, build] of Object.entries(CORE_BUILDS)) {
    assert.ok(coreSet.has(key), `Core build key ${key} is not a core covenant`);
    for (const addon of build.addons) {
      assert.ok(
        addonSet.has(addon),
        `Core build ${key} addon ${addon} invalid`,
      );
    }
    for (const opName of [...build.lineup, ...build.carries]) {
      assert.ok(OPERATOR[opName], `Missing operator ${opName} in ${key}`);
    }
    for (const [slotName, alts] of Object.entries(build.alternatives ?? {})) {
      assert.ok(OPERATOR[slotName], `Missing alt slot ${slotName} in ${key}`);
      for (const alt of alts) {
        assert.ok(OPERATOR[alt], `Missing alt ${alt} in ${key}`);
      }
    }
    for (const eqName of build.equipment) {
      assert.ok(EQUIP[eqName], `Missing equip ${eqName} in ${key}`);
    }
    for (const stName of build.strategies) {
      assert.ok(STRATEGY[stName], `Missing strategy ${stName} in ${key}`);
    }
  }

  for (const build of MIXED_BUILDS) {
    for (const addon of build.addons ?? []) {
      assert.ok(
        allCovenantSet.has(addon),
        `Mixed build ${build.name} addon ${addon} invalid`,
      );
    }
    for (const opName of [...build.lineup, ...(build.carries ?? [])]) {
      assert.ok(
        OPERATOR[opName],
        `Missing operator ${opName} in ${build.name}`,
      );
    }
    for (const [slotName, alts] of Object.entries(build.alternatives ?? {})) {
      assert.ok(
        OPERATOR[slotName],
        `Missing alt slot ${slotName} in ${build.name}`,
      );
      for (const alt of alts) {
        assert.ok(OPERATOR[alt], `Missing alt ${alt} in ${build.name}`);
      }
    }
    for (const eqName of build.equipment) {
      assert.ok(EQUIP[eqName], `Missing equip ${eqName} in ${build.name}`);
    }
    for (const stName of build.strategies) {
      assert.ok(
        STRATEGY[stName],
        `Missing strategy ${stName} in ${build.name}`,
      );
    }
  }

  // Unique non-empty IDs with zero collision between COVENANT_IDS and MIXED_BUILD_IDS
  const seenIds = new Set();
  for (const [name, cov] of Object.entries(COVENANTS)) {
    assert.ok(cov.id.length > 0, `Empty covenant id on ${name}`);
    assert.ok(!seenIds.has(cov.id), `Duplicate id ${cov.id}`);
    seenIds.add(cov.id);
    assert.equal(COVENANT_IDS[cov.id], name);
  }
  assert.equal(Object.keys(COVENANT_IDS).length, ALL_COVENANTS.length);

  for (const build of MIXED_BUILDS) {
    assert.ok(build.id.length > 0, `Empty mixed build id on ${build.name}`);
    assert.ok(!seenIds.has(build.id), `Colliding/duplicate id ${build.id}`);
    seenIds.add(build.id);
    assert.equal(MIXED_BUILD_IDS[build.id], build.name);
  }
  assert.equal(Object.keys(MIXED_BUILD_IDS).length, MIXED_BUILDS.length);

  // Share IDs cover all operators without duplicates
  const shareSet = new Set(SHARE_OPERATOR_IDS);
  assert.equal(shareSet.size, SHARE_OPERATOR_IDS.length);
  for (const op of OPERATORS) {
    const charId = Number(op.avatar.match(/^char_(\d+)_/)?.[1] ?? 0);
    assert.ok(charId > 0, `Invalid avatar id on ${op.name}`);
    assert.ok(
      shareSet.has(charId),
      `${op.name} (${charId}) missing from SHARE_OPERATOR_IDS`,
    );
  }

  assert.ok(DEFAULT_COVENANT_ID.length > 0);
  assert.ok(DEFAULT_BUILD_ID.length > 0);
  assert.equal(covenantName(DEFAULT_COVENANT_ID), SEASON_META.defaultCovenant);
  assert.equal(buildKey(DEFAULT_BUILD_ID), SEASON_META.defaultBuild);
});

test('generic mechanics helpers obey data contracts rather than hardcoded names', () => {
  // operatorPrice
  assert.equal(operatorPrice(OPERATOR['真理']), 1);
  assert.equal(operatorPrice({name: '真理', tier: 2}), 1);
  assert.equal(operatorPrice(OPERATOR['至简']), 1);
  assert.equal(operatorPrice({name: 'custom', tier: 5, price: 2}), 2);
  assert.equal(
    operatorPrice({name: 'unknown', tier: 4}),
    SEASON_META.tierBasePrices[4],
  );

  // operatorEliteCopies
  assert.equal(operatorEliteCopies('星极'), 2);
  assert.equal(operatorEliteCopies(OPERATOR['星极']), 2);
  assert.equal(operatorEliteCopies({name: 'custom', eliteCopies: 4}), 4);
  assert.equal(operatorEliteCopies('拜松'), SEASON_META.defaultEliteCopies);
  assert.equal(
    operatorEliteCopies('__proto__'),
    SEASON_META.defaultEliteCopies,
  );

  // strategyUsesAdvisorCommand & isBannableCovenant
  assert.equal(strategyUsesAdvisorCommand('苏苏洛'), true);
  assert.equal(strategyUsesAdvisorCommand('铃兰'), true);
  assert.equal(strategyUsesAdvisorCommand('阿米娅'), false);
  assert.equal(strategyUsesAdvisorCommand('__proto__'), false);
  assert.equal(isBannableCovenant('绝技'), false);
  assert.equal(isBannableCovenant('炎'), true);
  assert.equal(isBannableCovenant('__proto__'), false);

  // advisorDeploymentLimit reads baseDeploymentLimit + deploymentSlotBonus
  const expectedBonus =
    DEPLOYMENT_BONUS_EQUIP?.mechanics?.deploymentSlotBonus ?? 0;
  assert.equal(
    advisorDeploymentLimit({personnelDocumentUsed: false}),
    SEASON_META.baseDeploymentLimit,
  );
  assert.equal(
    advisorDeploymentLimit({personnelDocumentUsed: true}),
    SEASON_META.baseDeploymentLimit + expectedBonus,
  );

  // covenantStats: grantsCompanionCovenant, countsReserve, addsCoreCount, maxCount, fieldElites
  const companionStats = covenantStats([
    {...newSlot('拜松'), eq: ['变形同构体', '坚守盾牌']},
  ]);
  const steadfast = companionStats.find((s) => s.name === '坚守');
  assert.ok(steadfast);
  assert.deepEqual(steadfast.granted, ['拜松']);
  assert.equal(
    covenantStats([{...newSlot('拜松'), eq: ['坚守盾牌']}]).some(
      (s) => s.name === '坚守',
    ),
    false,
  );

  // countsReserve: reserve counts only for RESERVE_COVENANTS, without double counting
  const reserveOnly = covenantStats([], {}, [
    newSlot('渡桥'),
    newSlot('寒檀'),
    newSlot('拜松'),
  ]);
  assert.equal(reserveOnly.find((s) => s.name === '远见')?.count, 2);
  assert.equal(
    reserveOnly.some((s) => s.name === '炎'),
    false,
  );
  assert.ok(RESERVE_COVENANTS.has('远见'));

  // addsCoreCount (调和): boosts core covenants by 1, not addons
  const harmonyStats = covenantStats([
    newSlot('拜松'),
    newSlot('盟约·辅助干员'),
  ]);
  assert.equal(harmonyStats.find((s) => s.name === '炎')?.extra, 1);
  assert.equal(harmonyStats.find((s) => s.name === '调和')?.extra, 0);

  // maxCount (独行): breaks when > 1
  assert.equal(
    covenantStats([newSlot('艾丝黛尔')]).find((s) => s.name === '独行')?.active,
    true,
  );
  const brokenSolo = covenantStats([newSlot('艾丝黛尔'), newSlot('地灵')]).find(
    (s) => s.name === '独行',
  );
  assert.equal(brokenSolo?.broken, true);
  assert.equal(brokenSolo?.active, false);

  // fieldElites (绝技)
  const fiveElites = ['拜松', '矩', '风絮', '余', '仇白'].map((n) => ({
    ...newSlot(n),
    elite: true,
  }));
  const mastery = covenantStats(fiveElites).find((s) => s.name === '绝技');
  assert.equal(mastery?.bonusElite, true);
  assert.equal(mastery?.bonusActive, true);
  assert.equal(
    covenantStats(fiveElites, {}, [], new Set(['绝技'])).some(
      (s) => s.name === '绝技',
    ),
    false,
  );

  // explainStrategyTransition driven by STRATEGY[name].advisor.deployedCovenantThresholds
  const yanField = ['拜松', '矩', '乌有', '风絮', '余', '仇白'].map(newSlot);
  assert.equal(
    explainStrategyTransition(yanField.slice(0, 5), yanField, {
      strategy: '望',
      format: 'standard',
      inactiveCovenants: new Set(),
    }).reasons.length,
    1,
  );
  assert.equal(
    explainStrategyTransition(yanField.slice(0, 5), yanField, {
      strategy: '望',
      format: 'fast',
      inactiveCovenants: new Set(),
    }).reasons.length,
    0,
  );

  // recruitPriceRange driven by priceDiscounts & covenantMinPrice
  const baseRun = newAdvisorRun();
  assert.deepEqual(
    recruitPriceRange({...baseRun, layers: {}}, OPERATOR['逻各斯']),
    {min: 2, max: 4},
  );
  assert.deepEqual(
    recruitPriceRange({...baseRun, layers: {远见: 150}}, OPERATOR['逻各斯']),
    {min: 2, max: 2},
  );
  assert.deepEqual(
    recruitPriceRange({...baseRun, strategy: '休露丝'}, OPERATOR['圣聆初雪']),
    {min: 1, max: 4},
  );
  assert.deepEqual(
    recruitPriceRange(
      {...baseRun, candidateSource: 'promotion'},
      OPERATOR['逻各斯'],
    ),
    {min: 0, max: 0},
  );

  // operatorSellPrice & operatorSellMechanics
  assert.equal(operatorSellPrice('温蒂', false), 3);
  assert.equal(operatorSellPrice('温蒂', true), 6);
  assert.equal(operatorSellPrice('拜松', false), 1);
  assert.equal(operatorSellPrice('__proto__', true), 1);
  assert.deepEqual(operatorSellMechanics('海沫')?.roundGrowth, {
    baseStep: 1,
    eliteStep: 2,
    baseMax: 4,
    eliteMax: 8,
  });

  // season registry & diffSeasons
  assert.ok(SEASONS.length >= 1);
  assert.equal(getSeason(SEASON_META.id)?.meta.id, SEASON_META.id);
  const identical = diffSeasons(CURRENT_SEASON, CURRENT_SEASON);
  assert.equal(identical.operators.added.length, 0);
  assert.equal(identical.operators.removed.length, 0);
  assert.equal(identical.operators.changed.length, 0);

  const syntheticNext = {
    ...CURRENT_SEASON,
    meta: {...CURRENT_SEASON.meta, id: 's2'},
    operators: [
      {
        ...CURRENT_SEASON.operators[0],
        tier: CURRENT_SEASON.operators[0].tier + 1,
      },
      ...CURRENT_SEASON.operators.slice(2),
      {...CURRENT_SEASON.operators[0], name: '测试新干员'},
    ],
  };
  const changed = diffSeasons(CURRENT_SEASON, syntheticNext);
  assert.deepEqual(changed.operators.added, ['测试新干员']);
  assert.deepEqual(changed.operators.removed, [
    CURRENT_SEASON.operators[1].name,
  ]);
  assert.equal(changed.operators.changed.length, 1);
  assert.equal(changed.operators.changed[0].changes[0].field, 'tier');
  assert.deepEqual(changed.operators.changed[0].changes.find((c) => c.field === 'price'), {
    field: 'price',
    before: CURRENT_SEASON.meta.tierBasePrices[CURRENT_SEASON.operators[0].tier],
    after: syntheticNext.meta.tierBasePrices[syntheticNext.operators[0].tier],
  });
});

test('enemy intel integrity: leaders, bounties, training types, and glossary stay complete and valid', () => {
  const roleSet = new Set(COMBAT_ROLE_LABELS);
  const validMobility = new Set(['地面', '飞行']);
  const validRange = new Set(['近战', '远程', '近远', '不攻击']);
  const validDamage = new Set(['物理', '法术', '混伤', '元素', '无']);

  assert.ok(Object.keys(ENEMY_GLOSSARY).length >= 12);

  for (const leader of LEADERS) {
    assert.ok(
      leader.profile.attackMode.length > 0,
      `${leader.name} missing attackMode`,
    );
    assert.ok(
      leader.profile.defense.length > 0,
      `${leader.name} missing defense`,
    );
    assert.ok(
      leader.profile.targeting.length > 0,
      `${leader.name} missing targeting`,
    );
    assert.ok(
      leader.profile.blocking.length > 0,
      `${leader.name} missing blocking`,
    );
    assert.ok(
      leader.profile.summary.length > 0,
      `${leader.name} missing summary`,
    );
    if (leader.hiddenCore) {
      assert.ok(
        (leader.profile.hiddenSummary ?? '').length > 0,
        `${leader.name} missing hiddenSummary`,
      );
    }
    const terms = leaderGlossaryTerms(leader, ENEMY_GLOSSARY);
    assert.ok(
      terms.length >= 2,
      `${leader.name} should collect glossary terms`,
    );
  }

  for (const bounty of BOUNTIES) {
    assert.ok(
      validMobility.has(bounty.mobility),
      `Invalid mobility on ${bounty.name}`,
    );
    assert.ok(validRange.has(bounty.range), `Invalid range on ${bounty.name}`);
    assert.ok(
      validDamage.has(bounty.damage),
      `Invalid damage on ${bounty.name}`,
    );
    assert.ok(
      bounty.mechanics.length >= 8,
      `Too short mechanics on ${bounty.name}`,
    );
    assert.ok(
      bounty.counter.length >= 8,
      `Too short counter on ${bounty.name}`,
    );
    for (const role of bounty.roles ?? []) {
      assert.ok(
        roleSet.has(role),
        `Unknown role ${role} on bounty ${bounty.name}`,
      );
    }
  }

  for (const training of TRAINING) {
    assert.ok(
      training.attackStyle.length >= 10,
      `Missing attackStyle on ${training.name}`,
    );
    assert.ok(
      training.strategy.length >= 10,
      `Missing strategy on ${training.name}`,
    );
    assert.ok(
      training.examples.length >= 2,
      `Missing examples on ${training.name}`,
    );
    assert.ok(training.tags.length >= 2, `Missing tags on ${training.name}`);
  }
});
