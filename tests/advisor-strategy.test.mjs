import assert from 'node:assert/strict';
import test from 'node:test';
import { newSlot } from '../src/lib/plans/index.ts';
import { explainStrategyTransition } from '../src/lib/recommendation/live/advisorStrategy.ts';
import { newAdvisorRun, recommendRecruits } from '../src/lib/recommendation/live/runAdvisor.ts';

const names = ['拜松', '矩', '乌有', '风絮', '余', '仇白', '黍', '老鲤', '夕'];
const field = count => names.slice(0, count).map(newSlot);
const context = { strategy: '望', format: 'standard', inactiveCovenants: new Set() };

test('Wang skill changes use distinct deployed Yan, not layers or virtual covenant counts', () => {
  assert.match(explainStrategyTransition(field(5), field(6), context).reasons.join(''), /满足黑白相易改为开战召唤1只/);
  assert.deepEqual(explainStrategyTransition(field(6), field(7), context), { reasons: [], losses: [] });
  assert.deepEqual(explainStrategyTransition(field(5), [...field(5), newSlot('拜松')], context), { reasons: [], losses: [] });
  assert.match(explainStrategyTransition(field(8), field(9), context).reasons.join(''), /满足开战召唤2只/);
  assert.match(explainStrategyTransition(field(9), field(8), context).losses.join(''), /无法确认仍满足召唤2只/);
  assert.match(explainStrategyTransition(field(6), field(5), context).losses.join(''), /无法确认仍满足召唤条件/);
  assert.deepEqual(explainStrategyTransition(field(5), field(6), { ...context, format: 'fast' }), { reasons: [], losses: [] });
  const run = { ...newAdvisorRun(), mode: 'full', format: 'standard', level: 6, round: 14, funds: 4, strategy: '望', mainCovenant: '炎', layers: { 炎: 999 },
    operators: names.slice(0, 5).map(name => ({ name, deployed: true, copies: 1, elite: false })), shop: ['仇白'] };
  assert.match(recommendRecruits(run)[0].reasons.join(''), /望：已录6名不同原生炎/);
  const owned = { ...run, operators: [...run.operators, { name: '仇白', deployed: false, copies: 1, elite: false }] };
  assert.ok(!recommendRecruits(owned)[0].reasons.some(reason => reason.startsWith('望：')));
});
