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
