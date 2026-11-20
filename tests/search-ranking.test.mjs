import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ALL_COVENANTS,
  BOUNTIES,
  EQUIPMENT,
  LEADERS,
  OPERATOR,
  OPERATORS,
  STRATEGIES,
  TRAINING,
} from '../data/index.ts';
import {
  normalizeQuery,
  rosterLocation,
  rosterOperator,
} from '../src/router/location.ts';
import {nameScore, normalize} from '../src/lib/ui/match.ts';
import {
  bountyMatchScore,
  leaderSearchTerms,
  matchedOnlyAdvanced,
  matchedOnlyElite,
  matchingEnemyTerms,
  prepareSearchQuery,
  searchResults,
  topSearchTarget,
  trainingMatchScore,
} from '../src/quickref/searchRanking.ts';

test('matchedOnlyElite triggers only when query matches elite trait exclusively', () => {
  const op = OPERATORS.find(
    (item) =>
      item.elite.includes('每回合至多') &&
      !item.trait.includes('每回合至多') &&
      !item.name.includes('至多'),
  );
  if (op) {
    assert.equal(matchedOnlyElite(op, '至多'), true);
    assert.equal(matchedOnlyElite(op, op.name), false);
  }
  const sample = OPERATORS[0];
  assert.equal(matchedOnlyElite(sample, sample.name), false);
  assert.equal(matchedOnlyElite(sample, sample.covenants[0]), false);
});

test('matchedOnlyAdvanced detects equipment matches unique to advanced tier', () => {
  const eq = EQUIPMENT.find(
    (item) => item.advanced && item.advanced !== item.effect,
  );
  assert.ok(eq);
  assert.equal(matchedOnlyAdvanced(eq, eq.name), false);
  assert.equal(matchedOnlyAdvanced(eq, eq.effect.slice(0, 4)), false);
});

test('topSearchTarget selects direct navigation or detail target for Enter shortcut', () => {
  const opHit = topSearchTarget(OPERATORS[0].name);
  assert.deepEqual(opHit, {kind: 'op', id: OPERATORS[0].name});

  const covHit = topSearchTarget(ALL_COVENANTS[0]);
  assert.deepEqual(covHit, {kind: 'cv', id: ALL_COVENANTS[0]});

  const eqHit = topSearchTarget(EQUIPMENT[0].name);
  assert.deepEqual(eqHit, {kind: 'eq', id: EQUIPMENT[0].name});

  const uniqueStrategy = STRATEGIES.find(
    (item) => !Object.hasOwn(OPERATOR, item.name),
  );
  assert.ok(uniqueStrategy);
  const stHit = topSearchTarget(uniqueStrategy.name);
  assert.deepEqual(stHit, {kind: 'st', id: uniqueStrategy.name});

  const ldHit = topSearchTarget(LEADERS[0].name);
  assert.deepEqual(ldHit, {kind: 'ld', id: LEADERS[0].name});

  const customHit = topSearchTarget('专属自定义流派XYZ', [
    {key: 'custom-1', name: '专属自定义流派XYZ'},
  ]);
  assert.deepEqual(customHit, {kind: 'bd', id: 'custom-1'});

  assert.equal(topSearchTarget(''), null);
  assert.equal(topSearchTarget('___not_found___'), null);
});

test('additional operators open a validated roster target by name, pinyin, or initials', () => {
  for (const [query, name] of [
    ['重岳', '重岳'],
    ['chongyue', '重岳'],
    ['zhongyue', '重岳'],
    ['Sharp', 'Sharp'],
    ['ybgyjw', '预备干员-近卫'],
  ]) {
    const hit = topSearchTarget(query);
    assert.equal(hit?.kind, 'roster', query);
    const operator = rosterOperator(hit.id);
    assert.equal(operator?.name, name, query);
    const target = rosterLocation(hit.id);
    assert.equal(target.path, '/operators');
    assert.deepEqual(normalizeQuery('op', target.query), target.query);
  }
  assert.deepEqual(normalizeQuery('op', {roster: 'unknown'}), {});
});

test('enemy, bounty, training, and glossary pinyin search matches names, terms, and polyphones', () => {
  // Polyphone overrides
  assert.ok(nameScore('刺胄之弹', normalize('cizhouzhidan')) >= 3);
  assert.ok(nameScore('断攻重置', normalize('chongzhi')) >= 1.5);
  assert.ok(nameScore('澪', normalize('ling')) >= 3);
  assert.ok(nameScore('澪', normalize('miao')) >= 3);
  assert.ok(nameScore('晕眩', normalize('xuanyun')) >= 3);
  assert.ok(nameScore('赘生甲壳', normalize('jiake')) >= 1.5);

  // Glossary pinyin lookup
  assert.ok(matchingEnemyTerms('qs').some((e) => e.term === '侵蚀损伤'));
  assert.ok(matchingEnemyTerms('diaowang').some((e) => e.term === '凋亡损伤'));
  assert.ok(matchingEnemyTerms('ymhx').some((e) => e.term === '隐秘核心'));

  // Boss related term pinyin matching
  const gun = LEADERS.find((l) => l.name === '假想敌：铳');
  assert.ok(gun);
  assert.ok(
    leaderSearchTerms(gun).some((t) => nameScore(t, 'suichongzhihuang') > 0),
  );
  assert.ok(leaderSearchTerms(gun).some((t) => nameScore(t, 'qinshi') > 0));

  // Bounty pinyin matching (name, tags, roles, glossary)
  const ratKing = BOUNTIES.find((b) => b.name === '“鼠王”');
  const jetman = BOUNTIES.find((b) => b.name === '喷气人');
  const boat = BOUNTIES.find((b) => b.name.includes('术师快艇'));
  assert.ok(ratKing && jetman && boat);
  assert.ok(bountyMatchScore(ratKing, 'shuwang') >= 3);
  assert.ok(bountyMatchScore(ratKing, 'sw') >= 3);
  assert.ok(bountyMatchScore(jetman, 'pqr') >= 3);
  assert.ok(bountyMatchScore(jetman, 'duikong') > 0);
  assert.ok(bountyMatchScore(boat, 'qs') > 0);
  assert.ok(bountyMatchScore(boat, 'sskt') >= 1.5);

  // Training pinyin matching
  const refract = TRAINING.find((t) => t.name === '折射');
  assert.ok(refract);
  assert.ok(trainingMatchScore(refract, 'zheshe') >= 3);
  assert.ok(trainingMatchScore(refract, 'zs') >= 3);
  assert.ok(trainingMatchScore(refract, 'chenmo') > 0);

  // Enter shortcut targets unique bounties & trainings while preserving operator priority
  assert.deepEqual(topSearchTarget('shuwang'), {kind: 'bounty', id: '“鼠王”'});
  assert.deepEqual(topSearchTarget('penqiren'), {kind: 'bounty', id: '喷气人'});
  assert.deepEqual(topSearchTarget('zheshe'), {kind: 'training', id: '折射'});
  assert.deepEqual(topSearchTarget('cizhouzhidan'), {
    kind: 'ld',
    id: '假想敌：胄',
  });
});

test('global search intersects words across fields and retains contiguous pinyin priority', () => {
  const search = (raw) => searchResults(prepareSearchQuery(raw));
  const names = (query) => search(query).operators.map((op) => op.name);
  assert.ok(names('乌萨斯 控制').includes('折桠'));
  assert.ok(names('kongzhi，wusasi').includes('折桠'));
  assert.deepEqual(names('控制 乌萨斯'), names('乌萨斯 控制'));
  assert.ok(!names('乌萨斯 控制').includes('角峰'));
  assert.ok(
    search('weiduoliya').equipment.some((item) => item.name === '维式重锤'),
  );
  assert.deepEqual(topSearchTarget('lǚ gǔ'), {kind: 'op', id: '旅骨'});
  assert.deepEqual(topSearchTarget('ｓｈａｒｐ'), topSearchTarget('Sharp'));
  assert.deepEqual(topSearchTarget('假想敌:铳'), {
    kind: 'ld',
    id: '假想敌：铳',
  });
});

test('the first displayed section and Enter share exact, related, and body ranking', () => {
  for (const query of ['乌萨斯', '折桠 控制', '角峰 4秒寒冷', 'shuwang']) {
    const result = searchResults(prepareSearchQuery(query));
    const group = result.order[0];
    const first = result[group][0];
    const kinds = {operators: 'op', covenants: 'cv', bounties: 'bounty'};
    assert.deepEqual(
      topSearchTarget(query),
      {
        kind: kinds[group],
        id: typeof first === 'string' ? first : first.name,
      },
      query,
    );
  }
  assert.equal(matchedOnlyElite(OPERATOR['角峰'], '角峰 4秒寒冷'), true);
  assert.equal(matchedOnlyElite(OPERATOR['角峰'], '角峰 控制'), false);
});

test('search picks up live edits to a build and compares its old key with other names', () => {
  const plan = {name: '改名后的流派', strategy: '', ops: [], note: '手写备注'};
  const builds = [{key: '原来的流派', plan}];
  const query = prepareSearchQuery('备注');
  assert.equal(searchResults(query, builds).builds[0], builds[0].key);
  plan.note = '另一段说明';
  assert.deepEqual(searchResults(query, builds).builds, []);
  assert.deepEqual(topSearchTarget('原来的流派', builds), {
    kind: 'bd',
    id: builds[0].key,
  });
});
