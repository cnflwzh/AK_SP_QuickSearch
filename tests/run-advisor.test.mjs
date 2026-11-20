import assert from 'node:assert/strict';
import test from 'node:test';
import {OPERATORS, OPERATOR} from '../data/index.ts';
import {
  covenantStats,
  createLineupEvaluator,
  newSlot,
} from '../src/lib/plans/index.ts';
import {
  createRecruitmentPool,
  newAdvisorRun,
  recommendRecruits,
  sanitizeAdvisorRun,
} from '../src/lib/recommendation/live/runAdvisor.ts';

const owned = (name, deployed = true) => ({
  name,
  deployed,
  copies: 1,
  elite: false,
});
const runWith = (names, extra = {}) => ({
  ...newAdvisorRun(),
  format: 'standard',
  level: 6,
  operators: names.map((name) => owned(name)),
  ...extra,
});

test('banned covenants and individually excluded operators never return through either candidate source', () => {
  const run = runWith([], {
    bannedCovenants: ['炎'],
    excludedOperators: ['真理'],
  });
  const available = createRecruitmentPool(run);
  assert.equal(available('仇白'), false);
  assert.equal(available('真理'), false);
  assert.equal(available('烈夏'), true);
  assert.ok(
    recommendRecruits(run, OPERATORS.length).every((item) =>
      available(item.operator.name),
    ),
  );
  assert.deepEqual(
    recommendRecruits({...run, shop: ['仇白', '真理', '烈夏']}).map(
      (item) => item.operator.name,
    ),
    ['烈夏'],
  );
  assert.deepEqual(recommendRecruits({...run, shop: ['仇白']}), []);
});

test('default targets respect level while actual shop rewards can exceed it', () => {
  const run = runWith([], {level: 1});
  assert.ok(
    recommendRecruits(run, OPERATORS.length).every(
      (item) => item.operator.tier === 1 && item.operator.stars > 0,
    ),
  );
  assert.equal(
    recommendRecruits({...run, shop: ['夕']})[0].operator.name,
    '夕',
  );
});

test('reserve cards count only for the three economic covenants and never double-count a name', () => {
  for (const covenant of ['远见', '奇迹', '投资人']) {
    const members = OPERATORS.filter((operator) =>
      operator.covenants.includes(covenant),
    )
      .slice(0, 3)
      .map((operator) => ({...newSlot(operator.name), elite: true}));
    const stats = covenantStats([], {}, members);
    assert.equal(
      stats.find((stat) => stat.name === covenant).count,
      members.length,
    );
    assert.ok(
      stats.every((stat) => ['远见', '奇迹', '投资人'].includes(stat.name)),
    );
    assert.equal(
      covenantStats(members.slice(0, 1), {}, members).find(
        (stat) => stat.name === covenant,
      ).count,
      members.length,
    );
    const evaluation = createLineupEvaluator(
      [],
      {},
      {reserve: members.slice(0, 1), goal: null},
    )([], members);
    assert.ok(evaluation.score > 0);
  }
});

test('same-name purchases distinguish pairs, promotions and already elite records without mutating the run', () => {
  const run = runWith(['真理'], {shop: ['真理']});
  assert.equal(recommendRecruits(run)[0].kind, 'pair');
  run.operators[0].copies = 2;
  const before = structuredClone(run);
  assert.equal(recommendRecruits(run)[0].kind, 'elite');
  assert.deepEqual(run, before);
  run.operators[0].elite = true;
  assert.equal(recommendRecruits(run)[0].kind, 'skip');
  const special = runWith(['星极'], {shop: ['星极']});
  assert.equal(recommendRecruits(special)[0].kind, 'elite');
});

test('loading older records adds independent pool defaults while sanitizing invalid selections', () => {
  const old = sanitizeAdvisorRun({level: 4, operators: [owned('真理')]});
  assert.equal(old.operators[0].name, '真理');
  assert.deepEqual(old.bannedCovenants, []);
  const saved = sanitizeAdvisorRun({
    ...old,
    mainCovenant: '炎',
    bannedCovenants: ['炎', '炎', '无效'],
    excludedOperators: ['真理', '不存在'],
  });
  assert.equal(saved.mainCovenant, '');
  assert.deepEqual(saved.bannedCovenants, ['炎']);
  assert.deepEqual(saved.excludedOperators, ['真理']);
  assert.ok(saved.operators.every((operator) => OPERATOR[operator.name]));
});

test('acquisition traits distinguish base from elite and respect grouped layers', async () => {
  const {acquisitionValue} =
    await import('../src/lib/recommendation/live/advisorValue.ts');
  const context = {
    totalRounds: 14,
    round: 4,
    level: 4,
    strategy: '',
    layers: {},
  };
  assert.match(
    acquisitionValue(OPERATOR['矩'], true, [], context).reasons.join(' '),
    /炎\+8层/,
  );
  const logos = acquisitionValue(
    OPERATOR['逻各斯'],
    false,
    [],
    context,
  ).reasons.join(' ');
  assert.match(logos, /奥术\+10层/);
  assert.match(logos, /远见\+5层/);
  assert.doesNotMatch(logos, /攻速/);
});

test('known insufficient funds demote unaffordable cards without mutating snapshots', () => {
  const run = runWith(['拜松', '矩', '风絮'], {funds: 0, shop: ['仇白']});
  const previous = structuredClone(run);
  assert.equal(recommendRecruits(run)[0].label, '资金不足');
  assert.deepEqual(run, previous);
});

test('investor multiplies acquisition only from the existing active state', async () => {
  const {acquisitionValue} =
    await import('../src/lib/recommendation/live/advisorValue.ts');
  const context = {
    totalRounds: 14,
    round: 4,
    level: 4,
    strategy: '',
    layers: {投资人: 100},
  };
  const inactive = acquisitionValue(OPERATOR['矩'], false, [], context);
  const active = acquisitionValue(
    OPERATOR['矩'],
    false,
    [{name: '投资人', active: true}],
    context,
  );
  assert.match(active.reasons.join(' '), /炎\+12层/);
  assert.match(inactive.reasons.join(' '), /炎\+4层/);
});

test('guaranteed equipment acquisition preserves quantity and exact name, not random rewards', async () => {
  const {acquisitionValue} =
    await import('../src/lib/recommendation/live/advisorValue.ts');
  const context = {
    totalRounds: 14,
    round: 4,
    level: 4,
    strategy: '',
    layers: {},
  };
  for (const name of ['承曦格雷伊', '缪尔赛思', '乌有']) {
    const base = acquisitionValue(OPERATOR[name], false, [], context);
    const elite = acquisitionValue(OPERATOR[name], true, [], context);
    assert.equal(elite.score, base.score * 2, name);
  }
  const cathy = acquisitionValue(OPERATOR['凯瑟琳'], true, [], context);
  assert.match(cathy.reasons.join(' '), /1件特殊维式重锤/);
  assert.doesNotMatch(cathy.reasons.join(' '), /终极维式重锤/);
});

test('already owned reserve deployment is independent from acquisition and budget', async () => {
  const {recommendDeployments} =
    await import('../src/lib/recommendation/live/runAdvisor.ts');
  const run = runWith(['拜松', '风絮'], {funds: 0});
  run.operators.push(owned('矩', false));
  const old = structuredClone(run);
  const advice = recommendDeployments(run).find((item) => item.name === '矩');
  assert.ok(advice && advice.score > 0);
  assert.equal(advice.replace, '');
  assert.ok(advice.reasons.some((reason) => reason.includes('无需再次购买')));
  assert.deepEqual(run, old);
});

test('deterministic production uses roster conditions and rest-start is not retroactive', async () => {
  const {recurringValue} =
    await import('../src/lib/recommendation/live/advisorValue.ts');
  const context = {
    totalRounds: 14,
    round: 14,
    level: 4,
    strategy: '',
    layers: {远见: 20},
  };
  const stats = [{name: '远见', active: true}];
  const s = recurringValue(newSlot('寒檀'), true, stats, context);
  assert.equal(s.score, 6); // only this rest-end: 3 layers, not already-passed rest-start
  const jessica = newSlot('涤火杰西卡');
  const stats2 = [{name: '维多利亚', active: true}];
  const ctx = {...context, layers: {}};
  assert.equal(
    recurringValue(jessica, true, stats2, ctx, {field: [jessica], reserve: []})
      .score,
    0,
  );
  assert.equal(
    recurringValue(jessica, true, stats2, ctx, {
      field: [{...jessica, eq: ['维式重锤', '坚守盾牌']}],
      reserve: [],
    }).score,
    4,
  );
});

test('full-roster suggestions remain finite, deterministic and do not mutate inputs', async () => {
  const {recommendDeployments} =
    await import('../src/lib/recommendation/live/runAdvisor.ts');
  const run = runWith(
    ['拜松', '矩', '风絮', '山', '仇白', '夜莺', '焰尾', '寒檀'],
    {round: 9, funds: 2, layers: {炎: 70, 远见: 80}},
  );
  run.operators.push(owned('逻各斯', false), {
    ...owned('涤火杰西卡', false),
    elite: true,
  });
  run.equipment = [
    {id: 'one', name: '维式重锤', holder: '涤火杰西卡', advanced: false},
  ];
  const old = structuredClone(run);
  const first = recommendRecruits(run, OPERATORS.length);
  assert.deepEqual(first, recommendRecruits(run, OPERATORS.length));
  for (const advice of first) assert.ok(Number.isFinite(advice.score));
  for (const advice of recommendDeployments(run)) {
    assert.ok(Number.isFinite(advice.score));
    assert.ok(
      run.operators.some((op) => !op.deployed && op.name === advice.name),
    );
    assert.ok(
      run.operators.some((op) => op.deployed && op.name === advice.replace),
    );
  }
  assert.deepEqual(run, old);
  const late = runWith(
    ['慕斯', 'Miss.Christine', '凯瑟琳', '拜松', '矩', '风絮', '灰喉', '霜叶'],
    {
      round: 14,
      mainCovenant: 'mixed',
      shop: ['寒檀'],
    },
  );
  const purchase = recommendRecruits(late)[0];
  const deployment = recommendDeployments({
    ...late,
    operators: [...late.operators, owned('寒檀', false)],
  }).find((item) => item.name === '寒檀');
  assert.ok(deployment?.score > 0);
  assert.equal(purchase.kind, 'replace');
  assert.equal(purchase.replace, deployment.replace);
});

test('verified restricted mode excludes its static pool and disabled covenant effects', async () => {
  const {effectiveBans} =
    await import('../src/lib/recommendation/live/runAdvisor.ts');
  const run = runWith([], {mode: 'restricted', shop: ['焰尾', '逻各斯']});
  const available = createRecruitmentPool(run);
  assert.equal(available('焰尾'), false); // 卡西米尔
  assert.equal(available('逻各斯'), true);
  assert.ok(
    !recommendRecruits(run).some((item) => item.operator.name === '焰尾'),
  );
  const elites = ['拜松', '矩'].map((name) => ({
    ...newSlot(name),
    elite: true,
  }));
  assert.ok(
    covenantStats(elites).some((stat) => stat.name === '绝技' && stat.active),
  );
  assert.ok(
    !covenantStats(elites, {}, [], effectiveBans(run)).some(
      (stat) => stat.name === '绝技',
    ),
  );
  assert.ok(
    !createLineupEvaluator(
      [],
      {},
      {bannedCovenants: effectiveBans(run)},
    )(elites).changes.some((change) => change.covenant === '绝技'),
  );
});

test('promotion rewards are free observed choices, capped by shop level not purchased card tier', async () => {
  const {promotionRewardTier} =
    await import('../src/lib/recommendation/live/advisorRules.ts');
  assert.equal(promotionRewardTier(6), 6);
  assert.equal(promotionRewardTier(3), 4);
  const run = runWith([], {
    level: 3,
    funds: 0,
    candidateSource: 'promotion',
    shop: ['寒檀'],
  });
  const advice = recommendRecruits(run)[0];
  assert.equal(advice.estimatedPrice, 0);
  assert.equal(advice.affordable, true);
  assert.notEqual(advice.label, '资金不足');
  assert.deepEqual(recommendRecruits({...run, shop: []}), []);
  assert.deepEqual(recommendRecruits({...run, shop: ['矩']}), []); // reward source is not ordinary low-tier stock
  assert.equal(sanitizeAdvisorRun({}).candidateSource, 'shop');
  assert.equal(sanitizeAdvisorRun({}).mode, 'unknown');
});

test('recording a promotion reward consumes the choice once and undo restores it', async () => {
  const saved = new Map();
  const oldStorage = Object.getOwnPropertyDescriptor(
    globalThis,
    'localStorage',
  );
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key) => saved.get(key) ?? null,
      setItem: (key, value) => saved.set(key, value),
    },
  });
  try {
    const {useRunAdvisor} =
      await import('../src/quickref/advisor/useRunAdvisor.ts');
    const advisor = useRunAdvisor();
    advisor.reset();
    advisor.setLevel(3);
    advisor.setCandidateSource('promotion');
    advisor.addShopCandidate('寒檀');
    advisor.addShopCandidate('涤火杰西卡');
    advisor.removeShopCandidate('涤火杰西卡');
    assert.equal(advisor.run.value.candidateSource, 'promotion');
    assert.deepEqual([...advisor.run.value.shop], ['寒檀']);
    advisor.addShopCandidate('涤火杰西卡');
    assert.equal(advisor.recruit('寒檀'), true);
    assert.equal(advisor.run.value.candidateSource, 'shop');
    assert.deepEqual([...advisor.run.value.shop], []);
    advisor.undo();
    assert.equal(advisor.run.value.candidateSource, 'promotion');
    assert.deepEqual([...advisor.run.value.shop], ['寒檀', '涤火杰西卡']);
    assert.equal(advisor.run.value.operators.length, 0);
  } finally {
    if (oldStorage)
      Object.defineProperty(globalThis, 'localStorage', oldStorage);
    else delete globalThis.localStorage;
  }
});

test('Silence counts each recorded reserve carrier covenant once and only active effects', async () => {
  const {recurringValue} =
    await import('../src/lib/recommendation/live/advisorValue.ts');
  const context = {
    totalRounds: 14,
    round: 14,
    level: 6,
    strategy: '',
    layers: {},
  };
  const stats = [
    {name: '炎', active: true},
    {name: '聚合', active: false},
  ];
  const roster = {
    field: [newSlot('淬羽赫默')],
    reserve: [newSlot('拜松'), newSlot('风絮')],
  };
  const result = recurringValue(roster.field[0], true, stats, context, roster);
  assert.match(result.reasons.join(' '), /炎\+2层/);
  assert.doesNotMatch(result.reasons.join(' '), /聚合\+/);
  assert.equal(
    recurringValue(roster.field[0], false, stats, context, roster).score,
    0,
  );
  assert.equal(
    recurringValue(roster.field[0], true, stats, context, {
      ...roster,
      reserve: [],
    }).score,
    0,
  );
});

test('candidate recording keeps solo recommendation on reserve and undo restores the shop', async () => {
  const {useRunAdvisor} =
    await import('../src/quickref/advisor/useRunAdvisor.ts');
  const advisor = useRunAdvisor();
  advisor.reset();
  advisor.setMainCovenant('mixed');
  advisor.recruit('艾丝黛尔');
  advisor.addShopCandidate('地灵');
  assert.equal(advisor.recruitCandidate('地灵'), true);
  assert.equal(
    advisor.run.value.operators.find((op) => op.name === '地灵').deployed,
    false,
  );
  assert.ok(
    advisor.covenants.value.find((stat) => stat.name === '独行').active,
  );
  assert.equal(advisor.run.value.shop.length, 0);
  advisor.undo();
  assert.deepEqual([...advisor.run.value.shop], ['地灵']);
  assert.equal(advisor.run.value.operators.length, 1);
});

test('editing owned roster does not consume an unrelated pending promotion choice', async () => {
  const {useRunAdvisor} =
    await import('../src/quickref/advisor/useRunAdvisor.ts');
  const advisor = useRunAdvisor();
  advisor.reset();
  advisor.setLevel(3);
  advisor.setCandidateSource('promotion');
  advisor.addShopCandidate('寒檀');
  advisor.addShopCandidate('涤火杰西卡');
  assert.equal(advisor.recruit('拜松'), true); // 手工补录已有干员，不是奖励选择
  assert.equal(advisor.run.value.candidateSource, 'promotion');
  assert.deepEqual([...advisor.run.value.shop], ['寒檀', '涤火杰西卡']);
  advisor.undo();
  assert.equal(advisor.run.value.operators.length, 0);
});

test('stale promotion candidates cannot be consumed after a level/source change', async () => {
  const {useRunAdvisor} =
    await import('../src/quickref/advisor/useRunAdvisor.ts');
  const advisor = useRunAdvisor();
  advisor.reset();
  advisor.setLevel(3);
  advisor.addShopCandidate('拜松');
  advisor.setCandidateSource('promotion');
  assert.equal(advisor.recruitCandidate('拜松'), false);
  assert.equal(advisor.run.value.operators.length, 0);
  assert.deepEqual([...advisor.run.value.shop], ['拜松']);
  assert.match(advisor.notice.value, /4阶/);
  advisor.undo(); // 失败不能覆盖此前切换来源的撤销快照
  assert.equal(advisor.run.value.candidateSource, 'shop');
});

test('full-field swap preserves both operators elite and equipment state and is atomic on undo', async () => {
  const {useRunAdvisor} =
    await import('../src/quickref/advisor/useRunAdvisor.ts');
  const advisor = useRunAdvisor();
  advisor.reset();
  for (const name of [
    '拜松',
    '矩',
    '风絮',
    '山',
    '仇白',
    '夜莺',
    '焰尾',
    '寒檀',
  ])
    advisor.recruit(name);
  advisor.recruit('逻各斯', 'reserve');
  advisor.setElite('寒檀', true);
  advisor.setElite('逻各斯', true);
  advisor.addEquipment('维式重锤', '寒檀');
  advisor.addEquipment('精准狙击镜', '逻各斯');
  const snapshot = JSON.parse(JSON.stringify(advisor.run.value));
  assert.equal(advisor.setDeployment('逻各斯', true, '不存在'), false);
  assert.deepEqual(JSON.parse(JSON.stringify(advisor.run.value)), snapshot);
  assert.equal(advisor.setDeployment('逻各斯', true, '寒檀'), true);
  assert.equal(advisor.deployed.value.length, 8);
  assert.equal(advisor.reserve.value.length, 1);
  assert.equal(
    advisor.run.value.operators.find((op) => op.name === '寒檀').elite,
    true,
  );
  assert.equal(
    advisor.run.value.operators.find((op) => op.name === '逻各斯').elite,
    true,
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(advisor.run.value.equipment)),
    snapshot.equipment,
  );
  advisor.undo();
  assert.deepEqual(JSON.parse(JSON.stringify(advisor.run.value)), snapshot);
});

test('promotion of an equipped field pair preserves placement and gear without consuming other ordinary shop cards', async () => {
  const {useRunAdvisor} =
    await import('../src/quickref/advisor/useRunAdvisor.ts');
  const advisor = useRunAdvisor();
  advisor.reset();
  advisor.recruit('拜松');
  advisor.setCopies('拜松', 2);
  advisor.addEquipment('维式重锤', '拜松');
  advisor.addShopCandidate('拜松');
  advisor.addShopCandidate('矩');
  const before = JSON.parse(JSON.stringify(advisor.run.value));
  assert.equal(advisor.recruitCandidate('拜松'), true);
  const result = advisor.run.value.operators.find((op) => op.name === '拜松');
  assert.equal(result.elite, true);
  assert.equal(result.deployed, true);
  assert.deepEqual([...advisor.run.value.shop], ['矩']);
  assert.deepEqual(
    JSON.parse(JSON.stringify(advisor.run.value.equipment)),
    before.equipment,
  );
  advisor.undo();
  assert.deepEqual(JSON.parse(JSON.stringify(advisor.run.value)), before);
});

test('a restricted-pool rejection leaves owned gear and the preceding undo snapshot untouched', async () => {
  const {useRunAdvisor} =
    await import('../src/quickref/advisor/useRunAdvisor.ts');
  const advisor = useRunAdvisor();
  advisor.reset();
  advisor.recruit('拜松');
  advisor.addEquipment('维式重锤', '拜松');
  advisor.setMode('restricted');
  const before = JSON.parse(JSON.stringify(advisor.run.value));
  assert.equal(advisor.recruitCandidate('焰尾'), false);
  assert.deepEqual(JSON.parse(JSON.stringify(advisor.run.value)), before);
  advisor.undo();
  assert.equal(advisor.run.value.mode, 'unknown');
  assert.equal(advisor.run.value.equipment[0].holder, '拜松');
});

test('pool bans distinguish a missing core from all missing native addons', async () => {
  const {isBanned} = await import('../src/lib/plans/index.ts');
  assert.equal(isBanned('承曦格雷伊', new Set(['灵巧'])), false);
  assert.equal(isBanned('承曦格雷伊', new Set(['灵巧', '精准'])), true);
  assert.equal(isBanned('史尔特尔', new Set(['突袭'])), false);
  assert.equal(isBanned('史尔特尔', new Set(['突袭', '不屈'])), true);
  assert.equal(isBanned('焰尾', new Set(['卡西米尔'])), true);
  assert.equal(isBanned('矩', new Set(['灵巧'])), false); // 空附加盟约不能 every([]) 误禁
  const run = runWith([], {
    mode: 'restricted',
    shop: ['承曦格雷伊', '史尔特尔', '焰尾'],
  });
  const recommendations = recommendRecruits(run);
  assert.deepEqual(
    new Set(recommendations.map((item) => item.operator.name)),
    new Set(['承曦格雷伊', '史尔特尔']),
  );
  for (const item of recommendations) {
    assert.ok(!item.reasons.some((reason) => /激活灵巧|激活突袭/.test(reason)));
  }
});

test('missing addon layers receive no acquisition value while retained addons still do', async () => {
  const {acquisitionValue} =
    await import('../src/lib/recommendation/live/advisorValue.ts');
  const context = {
    totalRounds: 14,
    round: 4,
    level: 6,
    strategy: '',
    layers: {},
    inactiveCovenants: new Set(['奥术']),
  };
  const stats = [{name: '远见', active: true}];
  const value = acquisitionValue(OPERATOR['逻各斯'], false, stats, context);
  assert.equal(value.score, 10); // 仅远见5层×2，缺席奥术不留未来价值
  assert.match(value.reasons.join(' '), /奥术.*缺席.*不计/);
  assert.match(value.reasons.join(' '), /远见\+5层/);
  assert.doesNotMatch(value.reasons.join(' '), /获得时奥术\+/);
  const run = runWith([], {bannedCovenants: ['奥术'], shop: ['逻各斯']});
  const advice = recommendRecruits(run)[0];
  assert.equal(advice.operator.name, '逻各斯');
  assert.equal(advice.breakdown.acquisition, 1.25); // 未激活远见仅保留未来价值
  for (const layers of [{远见: 150}, {}]) {
    const missingForesight = recommendRecruits(
      runWith([], {
        bannedCovenants: ['远见'],
        layers,
        funds: 2,
        shop: ['逻各斯'],
      }),
    )[0];
    assert.equal(missingForesight.estimatedPrice, 4); // 奥术仍可留池，缺席远见不提供已知或假定折扣
    assert.equal(missingForesight.affordable, false);
  }
});

test('deterministic rest producers cross a shared threshold jointly and award it only once', async () => {
  const {teamValue} =
    await import('../src/lib/recommendation/live/advisorValue.ts');
  const field = ['渡桥', '寒檀'].map(newSlot); // 本次休整结束远见+2和+3
  const context = {
    totalRounds: 14,
    round: 14,
    level: 4,
    strategy: '',
    layers: {远见: 0},
  };
  const base = teamValue(field, [], context);
  const joint = teamValue(field, [], {...context, layers: {远见: 76}});
  const overlaps = teamValue(field, [], {...context, layers: {远见: 78}});
  assert.equal(joint - base, 24); // 各自不足，合计跨过80
  assert.equal(overlaps - base, 24); // 两个来源都足够时仍只加一次
  assert.equal(teamValue(field, [], {...context, layers: {远见: 80}}), base);
  assert.equal(
    teamValue(field, [], {...context, layers: {远见: 146}}) - base,
    24,
  );
  assert.equal(
    teamValue(field, [], {...context, layers: {远见: 148}}) - base,
    24,
  );
  assert.equal(teamValue(field, [], {...context, layers: {远见: 150}}), base);
  const {acquisitionValue} =
    await import('../src/lib/recommendation/live/advisorValue.ts');
  const stats = covenantStats(field, {远见: 146});
  const acquisition = acquisitionValue(OPERATOR['逻各斯'], false, stats, {
    ...context,
    layers: {远见: 146},
  });
  const withoutCrossing = acquisitionValue(OPERATOR['逻各斯'], false, stats, {
    ...context,
    layers: {远见: 150},
  });
  assert.equal(acquisition.score - withoutCrossing.score, 24);
  assert.match(acquisition.reasons.join(' '), /远见150层强化门槛/);
});

test('recorded front targets add only confirmed distinct layers and are cleared atomically when moved', async () => {
  const {recurringValue} =
    await import('../src/lib/recommendation/live/advisorValue.ts');
  const field = ['渡桥', '寒檀', '拜松', '矩', '风絮'].map(newSlot);
  const context = {
    totalRounds: 14,
    round: 14,
    level: 6,
    strategy: '',
    layers: {},
  };
  const stats = covenantStats(field);
  const unknown = recurringValue(field[0], true, stats, context, {
    field,
    reserve: [],
  });
  const known = recurringValue(
    field[0],
    true,
    stats,
    {...context, frontTargets: {渡桥: '矩'}},
    {field, reserve: []},
  );
  assert.equal(known.score - unknown.score, 4); // 额外确定炎+2；不虚构其他站位
  assert.match(known.reasons.join(' '), /身前矩/);
  const shared = recurringValue(
    field[0],
    true,
    stats,
    {...context, frontTargets: {渡桥: '寒檀'}},
    {field, reserve: []},
  );
  assert.equal(shared.score, unknown.score);
  assert.match(shared.reasons.join(' '), /共享.*下界/);
  const {useRunAdvisor} =
    await import('../src/quickref/advisor/useRunAdvisor.ts');
  const advisor = useRunAdvisor();
  advisor.reset();
  for (const name of field.map((slot) => slot.name)) advisor.recruit(name);
  assert.equal(advisor.setFrontTarget('渡桥', '矩'), true);
  advisor.setDeployment('矩', false);
  assert.deepEqual({...advisor.run.value.frontTargets}, {});
  advisor.undo();
  assert.equal(advisor.run.value.frontTargets['渡桥'], '矩');
  assert.equal(advisor.setFrontTarget('渡桥', '渡桥'), false);
  assert.equal(advisor.run.value.frontTargets['渡桥'], '矩');
  const restored = sanitizeAdvisorRun({
    ...advisor.run.value,
    frontTargets: {渡桥: '矩', 寒檀: '矩', 帕拉斯: '矩'},
  });
  assert.deepEqual(restored.frontTargets, {渡桥: '矩'});
  assert.deepEqual(sanitizeAdvisorRun({}).frontTargets, {});
});

test('a purchase and this rest end share one milestone path without inventing unknown layers', () => {
  // 独立手算：29+帕拉斯9=38；霜叶购入+2后达40。31层时不买也已到40。
  const base = runWith(['帕拉斯', '云迹'], {
    round: 14,
    funds: 20,
    mainCovenant: 'mixed',
    frontTargets: {帕拉斯: ''},
    shop: ['霜叶'],
  });
  const joint = recommendRecruits({...base, layers: {灵巧: 29}})[0];
  const already = recommendRecruits({...base, layers: {灵巧: 31}})[0];
  assert.equal(joint.score - already.score, 24);
  assert.match(
    joint.reasons.join(' '),
    /获得时灵巧\+2层，加本次休整结束\+9层，合计可跨过40/,
  );
  assert.equal(
    recommendRecruits({...base, layers: {灵巧: 38}})[0].score,
    already.score,
  );
  assert.ok(
    !recommendRecruits(base)[0].reasons.some((reason) =>
      reason.includes('合计可跨过'),
    ),
  );
  assert.deepEqual(base.layers, {});
  // 唯一休整生产者夏栎：不买突袭49→50；买后灵巧48→50成为最高，突袭停在49。
  const redirected = runWith(['夏栎', '杰克', '贝洛内', '云迹', '水灯心'], {
    round: 14,
    mainCovenant: 'mixed',
    layers: {突袭: 49, 灵巧: 48},
    shop: ['霜叶'],
  });
  const advice = recommendRecruits(redirected)[0];
  assert.equal(advice.breakdown.production, -24);
  assert.match(advice.reasons.join(' '), /突袭本次不再达到50层门槛/);
  assert.deepEqual(redirected.layers, {突袭: 49, 灵巧: 48});
});

test('explicit game length separates fast final rest from standard and preserves unknown old saves', async () => {
  const base = runWith(['凯瑟琳', '渡桥'], {
    mode: 'restricted',
    mainCovenant: 'mixed',
    round: 9,
    layers: {远见: 50},
    frontTargets: {渡桥: ''},
    shop: ['寒檀', '空弦'],
  });
  const at = (format, round = 9) =>
    new Map(
      recommendRecruits({...base, format, round}).map((advice) => [
        advice.operator.name,
        advice,
      ]),
    );
  const fast = at('fast'),
    final = at('standard', 14),
    early = at('standard');
  for (const name of ['寒檀', '空弦'])
    assert.equal(
      fast.get(name).breakdown.production,
      final.get(name).breakdown.production,
    );
  assert.equal(fast.get('空弦').breakdown.production, 0);
  assert.ok(early.get('空弦').breakdown.production > 0);
  assert.equal(at('unknown').get('空弦').breakdown.production, 0);
  const old = sanitizeAdvisorRun({mode: 'restricted', round: 9});
  assert.equal(old.format, 'unknown');
  assert.equal(old.round, 9);
  assert.equal(
    sanitizeAdvisorRun({format: 'fast', mode: 'full', round: 14}).round,
    null,
  );
  assert.equal(
    sanitizeAdvisorRun({format: 'fast', mode: 'full'}).mode,
    'restricted',
  );
  const {useRunAdvisor} =
    await import('../src/quickref/advisor/useRunAdvisor.ts');
  const advisor = useRunAdvisor();
  advisor.reset();
  advisor.setFormat('standard');
  advisor.setMode('full');
  advisor.setRound(14);
  advisor.setCommandAvailable(true);
  advisor.setFormat('fast');
  assert.equal(advisor.run.value.round, null);
  assert.equal(advisor.run.value.mode, 'restricted');
  assert.equal(advisor.run.value.commandAvailable, null);
  advisor.setRound(10);
  assert.equal(advisor.run.value.round, null);
  advisor.undo();
  assert.equal(advisor.run.value.format, 'standard');
  assert.equal(advisor.run.value.mode, 'full');
  assert.equal(advisor.run.value.round, 14);
  assert.equal(advisor.run.value.commandAvailable, true);
});

test('all saved routes guide equal-value choices without replacing rules, funds or current holdings', async () => {
  const saved = (id, names) => ({
    id,
    name: id,
    ops: names.map(newSlot),
    strategy: '',
    note: '',
    layers: {},
    updated: 0,
  });
  const route = saved('我的炎终局', ['拜松', '矩', '夕']);
  const run = runWith(['拜松', '矩'], {
    mode: 'full',
    mainCovenant: 'mixed',
    round: 14,
    funds: 4,
    shop: ['风絮', '夕'],
  });
  const before = structuredClone(run);
  const plain = recommendRecruits(run);
  assert.equal(plain[0].operator.name, '风絮');
  const guided = recommendRecruits(run, 5, [route]);
  assert.equal(guided[0].operator.name, '夕');
  assert.equal(
    guided[0].score,
    plain.find((item) => item.operator.name === '夕').score,
  );
  assert.ok(guided[0].reasons.some((reason) => reason.includes('我的炎终局')));
  assert.deepEqual(run, before);
  assert.deepEqual(
    recommendRecruits(run, 5, [route, {...route, id: '重复备份'}]).map(
      (item) => [item.operator.name, item.preferenceScore],
    ),
    guided.map((item) => [item.operator.name, item.preferenceScore]),
  );
  assert.equal(
    recommendRecruits({...run, funds: 3}, 5, [route])[0].operator.name,
    '风絮',
  );
  const noAnchor = {...run, operators: []};
  assert.ok(
    recommendRecruits(noAnchor, 5, [route]).every(
      (item) => item.preferenceScore === 0,
    ),
  );
  const better = {
    ...run,
    operators: [...run.operators, owned('乌有')],
    shop: ['仇白', '夕'],
  };
  assert.equal(recommendRecruits(better, 5, [route])[0].operator.name, '仇白');
  const secondRoute = saved('我的炎过渡', ['拜松', '矩', '风絮']);
  const conflict = recommendRecruits(run, 5, [route, secondRoute]);
  assert.equal(
    conflict.find((item) => item.operator.name === '夕').preferenceScore,
    conflict.find((item) => item.operator.name === '风絮').preferenceScore,
  );
  const {createAdvisorPreferenceEvaluator} =
    await import('../src/lib/recommendation/live/advisorPreferences.ts');
  const {builtinPlan} = await import('../src/lib/plans/index.ts');
  const alternate = saved('可替换位置', ['拜松', '矩']);
  alternate.ops[0].alt = ['风絮'];
  const context = {
    field: [newSlot('拜松')],
    reserve: [],
    mainCovenant: '',
    strategy: '',
  };
  const evaluate = createAdvisorPreferenceEvaluator([alternate], context);
  assert.equal(evaluate(['拜松', '风絮'].map(newSlot)).preference, 0); // 两人不能重复满足同一目标位置。
  assert.ok(evaluate([], [newSlot('拜松')]).preference < 0);
  assert.equal(evaluate([newSlot('拜松')], [newSlot('拜松')]).preference, 0);
  const untouched = builtinPlan('炎');
  assert.equal(
    createAdvisorPreferenceEvaluator([untouched], {
      ...context,
      field: untouched.ops.slice(0, 1),
    })(untouched.ops).preference,
    0,
  );
  assert.equal(
    createAdvisorPreferenceEvaluator([route], {
      ...context,
      mainCovenant: '伊比利亚',
    })(['拜松', '矩'].map(newSlot)).preference,
    0,
  );
});

test('an acquisition milestone can favor a swap while the same free deployment favors the empty slot', async () => {
  const {recommendDeployments} =
    await import('../src/lib/recommendation/live/runAdvisor.ts');
  const run = runWith(['淬羽赫默', '霜叶', '云迹', '拜松', '乌有'], {
    mode: 'full',
    round: 14,
    mainCovenant: '炎',
    mainTarget: 3,
    layers: {灵巧: 33},
    shop: ['仇白'],
  });
  const snapshot = structuredClone(run);
  const free = recommendDeployments({
    ...run,
    operators: [...run.operators, owned('仇白', false)],
  })[0];
  assert.equal(free.replace, '');
  const purchase = recommendRecruits(run)[0];
  assert.equal(purchase.kind, 'replace');
  assert.equal(purchase.replace, '霜叶');
  assert.match(
    purchase.reasons.join(' '),
    /获得时灵巧\+6层，加本次休整结束\+1层，合计可跨过40/,
  );
  assert.equal(
    recommendRecruits({...run, layers: {灵巧: 32}})[0].kind,
    'deploy',
  );
  assert.deepEqual(run, snapshot);
});

test('bench promotion explains production on the selected field and deducts an already available route step', () => {
  const run = runWith(['凯瑟琳', '渡桥'], {
    mode: 'full',
    round: 14,
    mainCovenant: 'mixed',
    layers: {远见: 50},
    shop: ['寒檀'],
  });
  run.operators.push({...owned('寒檀', false), copies: 2});
  const route = {
    id: '远见',
    name: '远见路线',
    ops: ['渡桥', '寒檀'].map(newSlot),
    strategy: '',
    note: '',
    layers: {},
    updated: 0,
  };
  const promotion = recommendRecruits(run, 1, [route])[0];
  assert.equal(promotion.label, '晋升后上场');
  assert.equal(promotion.preferenceScore, 0);
  assert.ok(
    !promotion.reasons.some((reason) => reason.includes('更接近已保存方案')),
  );
  assert.match(promotion.reasons.join(' '), /休整开始\/结束远见\+6层/);
});
