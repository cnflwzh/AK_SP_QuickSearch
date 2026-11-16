import assert from 'node:assert/strict';
import test from 'node:test';
import { advisorDeploymentLimit, newAdvisorRun, recommendDeployments, recommendRecruits, sanitizeAdvisorRun } from '../src/lib/recommendation/live/runAdvisor.ts';

const names = ['拜松', '矩', '乌有', '风絮', '余', '仇白', '黍', '老鲤', '夕'];
const owned = name => ({ name, copies: 1, elite: false, deployed: true });

test('only confirmed document use enables the ninth slot in storage and recommendations', () => {
  const base = { ...newAdvisorRun(), mode: 'full', level: 6, format: 'standard', round: 14, funds: 4, mainCovenant: '炎', operators: names.map(owned) };
  const legacy = sanitizeAdvisorRun({ ...base, personnelDocumentUsed: undefined });
  assert.equal(advisorDeploymentLimit(legacy), 8);
  assert.equal(legacy.operators.filter(operator => operator.deployed).length, 8);
  const warehouse = sanitizeAdvisorRun({ ...base, equipment: [{ id: 'document', name: '人事部文档', holder: '', advanced: false }] });
  assert.equal(advisorDeploymentLimit(warehouse), 8);
  const confirmed = sanitizeAdvisorRun({ ...base, personnelDocumentUsed: true });
  assert.equal(advisorDeploymentLimit(confirmed), 9);
  assert.equal(confirmed.operators.filter(operator => operator.deployed).length, 9);
  const shopping = { ...base, personnelDocumentUsed: true, operators: names.slice(0, 8).map(owned), shop: ['夕'] };
  assert.equal(recommendRecruits(shopping)[0].kind, 'deploy');
  const reserve = { ...shopping, operators: [...shopping.operators, { ...owned('夕'), deployed: false }] };
  assert.equal(recommendDeployments(reserve).find(item => item.name === '夕').replace, '');
});

test('document recording, ninth deployment and rollback preserve explicit ownership and undo', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const saved = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) } });
  try {
    const { useRunAdvisor } = await import('../src/quickref/advisor/useRunAdvisor.ts');
    const advisor = useRunAdvisor();
    advisor.reset();
    advisor.setMode('full');
    names.forEach(name => assert.equal(advisor.recruit(name), true));
    assert.equal(advisor.deployed.value.length, 8);
    assert.equal(advisor.setPersonnelDocumentUsed(true), true);
    assert.equal(advisor.deploymentLimit.value, 9);
    advisor.undo();
    assert.equal(advisor.deploymentLimit.value, 8);
    advisor.setPersonnelDocumentUsed(true);
    assert.equal(advisor.setDeployment('夕', true), true);
    assert.equal(advisor.deployed.value.length, 9);
    assert.equal(advisor.setPersonnelDocumentUsed(false), false);
    assert.equal(advisor.deploymentLimit.value, 9);
    advisor.undo();
    assert.equal(advisor.deployed.value.length, 8);
    assert.equal(advisor.reserve.value[0].name, '夕');
    assert.equal(advisor.setPersonnelDocumentUsed(false), true);
    assert.equal(advisor.deploymentLimit.value, 8);
    assert.equal(advisor.run.value.equipment.length, 0);
    assert.equal(advisor.run.value.funds, null);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
});
