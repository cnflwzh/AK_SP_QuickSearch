import assert from 'node:assert/strict';
import test from 'node:test';
import { OPERATORS, OPERATOR } from '../data/index.ts';
import { covenantStats, createLineupEvaluator, newSlot, suggestions } from '../src/lib/planner.ts';
import { createRecruitmentPool, newAdvisorRun, recommendRecruits, runLineupGoal, sanitizeAdvisorRun } from '../src/lib/runAdvisor.ts';

const owned = (name, deployed = true) => ({ name, deployed, copies: 1, elite: false });
const runWith = (names, extra = {}) => ({ ...newAdvisorRun(), level: 6, operators: names.map(name => owned(name)), ...extra });

test('fourth and fifth main-covenant members outrank an unrelated new addon', () => {
  for (const names of [['拜松', '矩', '风絮'], ['拜松', '矩', '风絮', '山']]) {
    // 夜莺能与风絮开启聚合，仇白则把已经激活的炎继续推进一名。
    const run = runWith(names, { shop: ['夜莺', '仇白'] });
    assert.equal(runLineupGoal(run).covenant, '炎');
    assert.equal(recommendRecruits(run)[0].operator.name, '仇白');
    const lineup = names.map(newSlot);
    const ranked = suggestions(lineup, OPERATORS.length);
    assert.ok(ranked.find(item => item.op.name === '仇白').score > ranked.find(item => item.op.name === '夜莺').score);
  }
});

test('a three-person mixed goal stops awarding progress for extra home members', () => {
  const run = runWith(['拜松', '矩', '风絮'], { mainCovenant: '炎', mainTarget: 3, shop: ['夜莺', '仇白'] });
  assert.equal(recommendRecruits(run)[0].operator.name, '夜莺');
  assert.deepEqual(runLineupGoal({ ...run, mainCovenant: 'mixed' }), null);
});

test('banned covenants and individually excluded operators never return through either candidate source', () => {
  const run = runWith([], { bannedCovenants: ['炎'], excludedOperators: ['真理'] });
  const available = createRecruitmentPool(run);
  assert.equal(available('仇白'), false);
  assert.equal(available('真理'), false);
  assert.equal(available('烈夏'), true);
  assert.ok(recommendRecruits(run, OPERATORS.length).every(item => available(item.operator.name)));
  assert.deepEqual(recommendRecruits({ ...run, shop: ['仇白', '真理', '烈夏'] }).map(item => item.operator.name), ['烈夏']);
  assert.deepEqual(recommendRecruits({ ...run, shop: ['仇白'] }), []);
});

test('owned cards conflicting with the recorded pool require correction instead of creating fictitious slots', () => {
  const run = runWith(['拜松'], { bannedCovenants: ['炎'] });
  assert.deepEqual(recommendRecruits(run), []);
  assert.equal(run.operators[0].name, '拜松');
});

test('default targets respect level while actual shop rewards can exceed it', () => {
  const run = runWith([], { level: 1 });
  assert.ok(recommendRecruits(run, OPERATORS.length).every(item => item.operator.tier === 1 && item.operator.stars > 0));
  assert.equal(recommendRecruits({ ...run, shop: ['夕'] })[0].operator.name, '夕');
});

test('reserve cards count only for the three economic covenants and never double-count a name', () => {
  for (const covenant of ['远见', '奇迹', '投资人']) {
    const members = OPERATORS.filter(operator => operator.covenants.includes(covenant)).slice(0, 3).map(operator => ({ ...newSlot(operator.name), elite: true }));
    const stats = covenantStats([], {}, members);
    assert.equal(stats.find(stat => stat.name === covenant).count, members.length);
    assert.ok(stats.every(stat => ['远见', '奇迹', '投资人'].includes(stat.name)));
    assert.equal(covenantStats(members.slice(0, 1), {}, members).find(stat => stat.name === covenant).count, members.length);
    const evaluation = createLineupEvaluator([], {}, { reserve: members.slice(0, 1), goal: null })([], members);
    assert.ok(evaluation.score > 0);
  }
});

test('a full lineup can gain an economic covenant without displacing any deployed operator', () => {
  const names = OPERATORS.filter(operator => operator.covenants.includes('炎') && !operator.covenants.includes('远见')).slice(0, 8).map(operator => operator.name);
  assert.equal(names.length, 8);
  const run = runWith(names, { shop: ['空弦'] });
  // 两名远见留整备区即可激活；不能为了新增一个尚未激活的精准标签要求换人。
  const partner = OPERATORS.find(operator => operator.name !== '空弦' && operator.covenants.includes('远见') && !names.includes(operator.name));
  run.operators.push(owned(partner.name, false));
  const advice = recommendRecruits(run)[0];
  assert.equal(advice.kind, 'reserve');
  assert.equal(advice.replace, '');
  assert.ok(advice.reasons.some(reason => reason.includes('远见')));
});

test('same-name purchases distinguish pairs, promotions and already elite records without mutating the run', () => {
  const run = runWith(['真理'], { shop: ['真理'] });
  assert.equal(recommendRecruits(run)[0].kind, 'pair');
  run.operators[0].copies = 2;
  const before = structuredClone(run);
  assert.equal(recommendRecruits(run)[0].kind, 'elite');
  assert.deepEqual(run, before);
  run.operators[0].elite = true;
  assert.equal(recommendRecruits(run)[0].kind, 'skip');
  const special = runWith(['星极'], { shop: ['星极'] });
  assert.equal(recommendRecruits(special)[0].kind, 'elite');
});

test('loading older records adds independent pool defaults while sanitizing invalid selections', () => {
  const old = sanitizeAdvisorRun({ level: 4, operators: [owned('真理')] });
  assert.equal(old.operators[0].name, '真理');
  assert.deepEqual(old.bannedCovenants, []);
  const saved = sanitizeAdvisorRun({ ...old, mainCovenant: '炎', bannedCovenants: ['炎', '炎', '无效'], excludedOperators: ['真理', '不存在'] });
  assert.equal(saved.mainCovenant, '');
  assert.deepEqual(saved.bannedCovenants, ['炎']);
  assert.deepEqual(saved.excludedOperators, ['真理']);
  assert.ok(saved.operators.every(operator => OPERATOR[operator.name]));
});

test('optional snapshots preserve explicit zero and sanitize old saves', () => {
  const run = sanitizeAdvisorRun({ round: 99, funds: 0, layers: { 炎: 0, 奥术: 100, 无效: 3, 远见: '9' } });
  assert.equal(run.round, 14);
  assert.equal(run.funds, 0);
  assert.deepEqual(run.layers, { 炎: 0, 奥术: 100 });
  assert.equal(sanitizeAdvisorRun({}).round, null);
});

test('acquisition traits distinguish base from elite and respect grouped layers', async () => {
  const { acquisitionValue } = await import('../src/lib/advisorValue.ts');
  const context = { round: 4, level: 4, strategy: '', layers: {} };
  assert.match(acquisitionValue(OPERATOR['矩'], true, [], context).reasons.join(' '), /炎\+8层/);
  const logos = acquisitionValue(OPERATOR['逻各斯'], false, [], context).reasons.join(' ');
  assert.match(logos, /奥术\+10层/);
  assert.match(logos, /远见\+5层/);
  assert.doesNotMatch(logos, /攻速/);
});

test('known insufficient funds demote unaffordable cards without mutating snapshots', () => {
  const run = runWith(['拜松', '矩', '风絮'], { funds: 0, shop: ['仇白'] });
  const previous = structuredClone(run);
  assert.equal(recommendRecruits(run)[0].label, '资金不足');
  assert.deepEqual(run, previous);
});

test('reserve-enabled production has positive value and shorter late-game horizon', async () => {
  const { recurringValue } = await import('../src/lib/advisorValue.ts');
  const slot = newSlot('夏栎');
  const stats = covenantStats(['拜松', '矩', '风絮'].map(newSlot));
  const context = { round: 2, level: 3, strategy: '', layers: { 炎: 20 } };
  const early = recurringValue(slot, false, stats, context);
  assert.ok(early.score > 0);
  assert.ok(early.score > recurringValue(slot, false, stats, { ...context, round: 14 }).score);
});

test('known foresight discounts and Shirus faction restriction affect affordability', () => {
  const foresight = OPERATORS.find(op => op.covenants.includes('远见') && op.tier === 4);
  assert.ok(foresight);
  const run = runWith([], { funds: 3, layers: { 远见: 80 }, shop: [foresight.name] });
  assert.notEqual(recommendRecruits(run)[0].label, '资金不足');
  const other = runWith([], { funds: 0, strategy: '休露丝', shop: ['仇白'] });
  assert.equal(recommendRecruits(other)[0].label, '资金不足');
});

test('investor multiplies acquisition only from the existing active state', async () => {
  const { acquisitionValue } = await import('../src/lib/advisorValue.ts');
  const context = { round: 4, level: 4, strategy: '', layers: { 投资人: 100 } };
  const inactive = acquisitionValue(OPERATOR['矩'], false, [], context);
  const active = acquisitionValue(OPERATOR['矩'], false, [{ name: '投资人', active: true }], context);
  assert.match(active.reasons.join(' '), /炎\+12层/);
  assert.match(inactive.reasons.join(' '), /炎\+4层/);
});

test('unknown discounts use price bounds: zero funds cannot buy a foresight card', () => {
  for (const funds of [0, 1]) {
    const run = runWith([], { funds, layers: {}, shop: ['逻各斯'] });
    const advice = recommendRecruits(run)[0];
    assert.equal(advice.affordable, false);
    assert.equal(advice.label, '资金不足');
  }
  const uncertain = recommendRecruits(runWith([], { funds: 2, layers: {}, shop: ['逻各斯'] }))[0];
  assert.equal(uncertain.affordable, null);
  assert.equal(uncertain.estimatedPrice, null);
  const covered = recommendRecruits(runWith([], { funds: 4, layers: {}, shop: ['逻各斯'] }))[0];
  assert.equal(covered.affordable, true);
});

test('Cannnot protects next-round income but not after the final round', () => {
  const setup = runWith([], { funds: 5, strategy: '坎诺特', shop: ['仇白'] });
  const previous = recommendRecruits({ ...setup, round: 13 })[0];
  const final = recommendRecruits({ ...setup, round: 14 })[0];
  assert.equal(previous.breakdown.economy, -30);
  assert.equal(final.breakdown.economy, 0);
});

test('guaranteed equipment acquisition preserves quantity and exact name, not random rewards', async () => {
  const { acquisitionValue } = await import('../src/lib/advisorValue.ts');
  const context = { round: 4, level: 4, strategy: '', layers: {} };
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
  const { recommendDeployments } = await import('../src/lib/runAdvisor.ts');
  const run = runWith(['拜松', '风絮'], { funds: 0 });
  run.operators.push(owned('矩', false));
  const old = structuredClone(run);
  const advice = recommendDeployments(run).find(item => item.name === '矩');
  assert.ok(advice && advice.score > 0);
  assert.equal(advice.replace, '');
  assert.ok(advice.reasons.some(reason => reason.includes('无需再次购买')));
  assert.deepEqual(run, old);
});

test('deterministic production uses roster conditions and rest-start is not retroactive', async () => {
  const { recurringValue } = await import('../src/lib/advisorValue.ts');
  const context = { round: 14, level: 4, strategy: '', layers: { 远见: 20 } };
  const stats = [{ name: '远见', active: true }];
  const s = recurringValue(newSlot('寒檀'), true, stats, context);
  assert.equal(s.score, 6); // only this rest-end: 3 layers, not already-passed rest-start
  const jessica = newSlot('涤火杰西卡');
  const stats2 = [{ name: '维多利亚', active: true }];
  const ctx = { ...context, layers: {} };
  assert.equal(recurringValue(jessica, true, stats2, ctx, { field: [jessica], reserve: [] }).score, 0);
  assert.equal(recurringValue(jessica, true, stats2, ctx, { field: [{ ...jessica, eq: ['维式重锤', '坚守盾牌'] }], reserve: [] }).score, 4);
});

test('score explanation sums to total while affordability is a separate gate', () => {
  const run = runWith(['拜松', '风絮', '矩'], { level: 6, funds: 0, shop: ['逻各斯', '仇白', '矩'] });
  for (const item of recommendRecruits(run, 8)) {
    const { lineup, production, acquisition, collection, economy } = item.breakdown;
    assert.ok(Math.abs(item.score - lineup - production - acquisition - collection - economy) < 1e-8);
  }
});

test('full-roster suggestions remain finite, deterministic and do not mutate inputs', async () => {
  const { recommendDeployments } = await import('../src/lib/runAdvisor.ts');
  const run = runWith(['拜松', '矩', '风絮', '山', '仇白', '夜莺', '焰尾', '寒檀'], { round: 9, funds: 2, layers: { 炎: 70, 远见: 80 } });
  run.operators.push(owned('逻各斯', false), { ...owned('涤火杰西卡', false), elite: true });
  run.equipment = [{ id: 'one', name: '维式重锤', holder: '涤火杰西卡', advanced: false }];
  const old = structuredClone(run);
  const first = recommendRecruits(run, OPERATORS.length);
  assert.deepEqual(first, recommendRecruits(run, OPERATORS.length));
  for (const advice of first) assert.ok(Number.isFinite(advice.score));
  for (const advice of recommendDeployments(run)) {
    assert.ok(Number.isFinite(advice.score));
    assert.ok(run.operators.some(op => !op.deployed && op.name === advice.name));
    assert.ok(run.operators.some(op => op.deployed && op.name === advice.replace));
  }
  assert.deepEqual(run, old);
});

test('verified restricted mode excludes its static pool and disabled covenant effects', async () => {
  const { effectiveBans } = await import('../src/lib/runAdvisor.ts');
  const run = runWith([], { mode: 'restricted', shop: ['焰尾', '逻各斯'] });
  const available = createRecruitmentPool(run);
  assert.equal(available('焰尾'), false); // 卡西米尔
  assert.equal(available('逻各斯'), true);
  assert.ok(!recommendRecruits(run).some(item => item.operator.name === '焰尾'));
  const elites = ['拜松', '矩'].map(name => ({ ...newSlot(name), elite: true }));
  assert.ok(covenantStats(elites).some(stat => stat.name === '绝技' && stat.active));
  assert.ok(!covenantStats(elites, {}, [], effectiveBans(run)).some(stat => stat.name === '绝技'));
  assert.ok(!createLineupEvaluator([], {}, { bannedCovenants: effectiveBans(run) })(elites).changes.some(change => change.covenant === '绝技'));
});

test('promotion rewards are free observed choices, capped by shop level not purchased card tier', async () => {
  const { promotionRewardTier } = await import('../src/lib/advisorRules.ts');
  assert.equal(promotionRewardTier(6), 6);
  assert.equal(promotionRewardTier(3), 4);
  const run = runWith([], { level: 3, funds: 0, candidateSource: 'promotion', shop: ['寒檀'] });
  const advice = recommendRecruits(run)[0];
  assert.equal(advice.estimatedPrice, 0);
  assert.equal(advice.affordable, true);
  assert.notEqual(advice.label, '资金不足');
  assert.deepEqual(recommendRecruits({ ...run, shop: [] }), []);
  assert.deepEqual(recommendRecruits({ ...run, shop: ['矩'] }), []); // reward source is not ordinary low-tier stock
  assert.equal(sanitizeAdvisorRun({}).candidateSource, 'shop');
  assert.equal(sanitizeAdvisorRun({}).mode, 'unknown');
});

test('recording a promotion reward consumes the choice once and undo restores it', async () => {
  const saved = new Map();
  const oldStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) } });
  try {
    const { useRunAdvisor } = await import('../src/quickref/advisor/useRunAdvisor.ts');
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
    if (oldStorage) Object.defineProperty(globalThis, 'localStorage', oldStorage);
    else delete globalThis.localStorage;
  }
});

test('front-cell producers count their own known covenants but never invent a neighbour', async () => {
  const { recurringValue } = await import('../src/lib/advisorValue.ts');
  const context = { round: 14, level: 6, strategy: '', layers: {} };
  const stats = [{ name: '远见', active: true }, { name: '灵巧', active: true }, { name: '助力', active: true }];
  const normal = recurringValue(newSlot('渡桥'), true, stats, context);
  assert.match(normal.reasons.join(' '), /远见\+2层/);
  assert.match(normal.reasons.join(' '), /身前.*未/);
  assert.equal(recurringValue(newSlot('渡桥'), false, stats, context).score, 0);
  const pallas = recurringValue(newSlot('帕拉斯'), true, stats, context);
  assert.match(pallas.reasons.join(' '), /灵巧\+9层/);
  assert.match(pallas.reasons.join(' '), /助力\+9层/);
  assert.ok(recurringValue({ ...newSlot('渡桥'), elite: true }, true, stats, context).score > normal.score);
});

test('Silence counts each recorded reserve carrier covenant once and only active effects', async () => {
  const { recurringValue } = await import('../src/lib/advisorValue.ts');
  const context = { round: 14, level: 6, strategy: '', layers: {} };
  const stats = [{ name: '炎', active: true }, { name: '聚合', active: false }];
  const roster = { field: [newSlot('淬羽赫默')], reserve: [newSlot('拜松'), newSlot('风絮')] };
  const result = recurringValue(roster.field[0], true, stats, context, roster);
  assert.match(result.reasons.join(' '), /炎\+2层/);
  assert.doesNotMatch(result.reasons.join(' '), /聚合\+/);
  assert.equal(recurringValue(roster.field[0], false, stats, context, roster).score, 0);
  assert.equal(recurringValue(roster.field[0], true, stats, context, { ...roster, reserve: [] }).score, 0);
});

test('a free field slot does not force a second solo operator to break an active solo covenant', () => {
  const run = runWith(['艾丝黛尔'], { mainCovenant: 'mixed', shop: ['地灵'] });
  run.operators[0].elite = true;
  const advice = recommendRecruits(run)[0];
  assert.equal(advice.kind, 'reserve');
  assert.equal(advice.replace, '');
  assert.ok(advice.reasons.some(reason => reason.includes('独行')));
  assert.ok(advice.reasons.some(reason => reason.includes('整备区')));
  assert.equal(advice.breakdown.lineup, 0);
  assert.equal(run.operators[0].deployed, true);
});

test('candidate recording keeps solo recommendation on reserve and undo restores the shop', async () => {
  const { useRunAdvisor } = await import('../src/quickref/advisor/useRunAdvisor.ts');
  const advisor = useRunAdvisor();
  advisor.reset();
  advisor.setMainCovenant('mixed');
  advisor.recruit('艾丝黛尔');
  advisor.addShopCandidate('地灵');
  assert.equal(advisor.recruitCandidate('地灵'), true);
  assert.equal(advisor.run.value.operators.find(op => op.name === '地灵').deployed, false);
  assert.ok(advisor.covenants.value.find(stat => stat.name === '独行').active);
  assert.equal(advisor.run.value.shop.length, 0);
  advisor.undo();
  assert.deepEqual([...advisor.run.value.shop], ['地灵']);
  assert.equal(advisor.run.value.operators.length, 1);
});
