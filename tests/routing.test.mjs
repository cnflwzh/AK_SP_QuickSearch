import assert from 'node:assert/strict';
import test from 'node:test';
import { ALL_COVENANTS, BUILD_NAMES, EQUIPMENT, OPERATORS, STRATEGIES, LEADERS } from '../data/index.ts';
import { buildId, buildKey, covenantId, covenantName, detailFromId, detailId } from '../src/router/entities.ts';
import { normalizeQuery } from '../src/router/location.ts';
import { decodeFragment } from '../src/lib/url.ts';

test('public entity IDs are unique and every catalogue entry can be linked independently of ordering', () => {
  const ids = new Set();
  for (const [kind, entries] of [['op', OPERATORS], ['eq', EQUIPMENT], ['st', STRATEGIES]]) {
    for (const { name } of [...entries].reverse()) {
      const id = detailId(kind, name);
      assert.ok(id);
      assert.ok(!ids.has(id), `duplicate card ID: ${id}`);
      ids.add(id);
      assert.deepEqual(detailFromId(id), { kind, name });
    }
  }
  for (const name of ALL_COVENANTS) assert.equal(covenantName(covenantId(name)), name);
  for (const key of BUILD_NAMES) assert.equal(buildKey(buildId(key)), key);
  assert.equal(buildKey(buildId('custom-local-plan')), 'custom-local-plan');
  assert.equal(detailFromId('op-missing'), undefined);
  assert.equal(covenantName('__proto__'), '');
});

test('external filters normalize repeated values, invalid IDs and out-of-range numbers without changing input', () => {
  const input = { tier: ['3', '5'], covenant: 'victoria', trigger: 'battle', type: 'combat', elite: '1', q: '  攻击  ', card: 'op-char_4177_brigid', unused: 'value' };
  const original = structuredClone(input);
  assert.deepEqual(normalizeQuery('op', input), { tier: '3', covenant: 'victoria', trigger: 'battle', type: 'combat', elite: '1', q: '攻击', card: 'op-char_4177_brigid' });
  assert.deepEqual(input, original);
  assert.deepEqual(normalizeQuery('op', { tier: 'NaN', covenant: '__proto__', type: 'unknown', card: 'bad' }), {});
});

test('numbers links retain navigation destinations without calculator inputs or local filters', () => {
  const target = OPERATORS.find(operator => operator.name === '凛御银灰').avatar;
  const transient = {
    covenant: 'foresight', layerSection: 'cycle', layers: '80', difficulty: 'ultimate',
    target, operatorQuery: '银灰', shopMode: 'standard', level: '5', funds: '20', upgrade: '0', reserve: '0',
    payout: 'multi', sort: 'reward', bountyQuery: '假想敌',
  };
  assert.deepEqual(normalizeQuery('nu', transient), {});
  for (const tool of ['recruit', 'bounty']) {
    const query = { ...transient, tool, q: '  攻击  ', card: detailId('op', '凛御银灰') };
    const original = structuredClone(query);
    const destination = { tool, q: '攻击', card: query.card };
    assert.deepEqual(normalizeQuery('nu', query), destination);
    assert.deepEqual(normalizeQuery('nu', destination), destination);
    assert.deepEqual(query, original);
  }
  assert.deepEqual(normalizeQuery('nu', { tool: 'layers' }), {});
  assert.deepEqual(normalizeQuery('nu', { tool: 'missing', layers: 'NaN', card: 'missing' }), {});
});

test('secondary pages keep only their own controls and normalization is idempotent', () => {
  const cases = [
    ['fx', { group: 'core' }], ['eq', { tier: '6', group: 'combo' }],
    ['st', { category: 'equipment' }], ['op', { tier: '100', q: 'x'.repeat(300) }],
    ['bd', { panel: 'compare', compare: 'ursus', poolTier: '5', poolCovenant: 'yan', poolQuery: '炎', strategyCategory: 'faction' }],
  ];
  for (const [tab, input] of cases) {
    const result = normalizeQuery(tab, input, 'yan', true);
    assert.deepEqual(normalizeQuery(tab, result, 'yan', true), result);
  }
  assert.deepEqual(normalizeQuery('eq', { tier: '6', group: 'combo' }), { group: 'combo' });
  assert.deepEqual(normalizeQuery('bd', { panel: 'share', compare: 'ursus' }, 'yan', false), {});
});

test('leader skill and hidden-round parameters follow the selected leader capabilities', () => {
  const leader = LEADERS.find(item => item.hiddenStage && item.hiddenLayout?.zones.length > 1);
  assert.ok(leader);
  const skill = leader.hiddenLayout.zones[1].label;
  const query = { round: 'hidden', skill, view: 'routes', side: 'right', map: '01' };
  assert.deepEqual(normalizeQuery('ld', query, leader.id), { round: 'hidden', skill, view: 'routes', side: 'right' });
  assert.deepEqual(normalizeQuery('ld', { round: 'hidden', skill: 'missing', map: '999', side: 'bottom' }, 'missing'), {});
});

test('malformed tutorial anchors do not abort startup', () => {
  assert.equal(decodeFragment('#c4'), 'c4');
  assert.equal(decodeFragment('#%E7%82%8E'), '炎');
  assert.equal(decodeFragment('#%E0%A4'), '');
});
