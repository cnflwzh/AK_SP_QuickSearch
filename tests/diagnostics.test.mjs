import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COMBAT_ROLE_LABELS,
  equipmentWithRoles,
  operatorsWithRoles,
  rolesForCounterTag,
  rolesForTraining,
} from '../data/index.ts';
import {diagnoseLineup, newSlot} from '../src/lib/plans/index.ts';

test('combat role lookup connects trainings, leader counters, operators, and equipment', () => {
  assert.ok(COMBAT_ROLE_LABELS.includes('反隐'));
  assert.deepEqual(rolesForTraining('隐匿'), ['反隐']);
  assert.deepEqual(rolesForTraining('元素'), ['元素回复']);
  assert.ok(rolesForCounterTag('对空').includes('对空'));
  assert.ok(rolesForCounterTag('续航').includes('治疗'));

  const antiStealth = operatorsWithRoles(['反隐']).map((op) => op.name);
  assert.ok(antiStealth.includes('凛御银灰'));
  assert.ok(antiStealth.includes('真言'));

  const elemHeal = operatorsWithRoles(['元素回复']).map((op) => op.name);
  assert.ok(elemHeal.includes('纯烬艾雅法拉'));
  assert.ok(elemHeal.includes('哈洛德'));
  assert.ok(elemHeal.includes('褐果'));

  const controlEquips = equipmentWithRoles(['控制']).map((eq) => eq.name);
  assert.ok(controlEquips.includes('谢拉格不融冰'));
  assert.ok(controlEquips.includes('奥术法阵'));
});

test('diagnoseLineup aggregates operator and equipment roles and flags missing essentials', () => {
  // 只有拜松（阻挡）：缺对空、治疗、群攻
  const tankOnly = diagnoseLineup([newSlot('拜松')]);
  assert.deepEqual(
    tankOnly.missingEssential.map((entry) => entry.role),
    ['对空', '治疗', '群攻'],
  );

  // 给拜松佩戴聚合急救箱（提供治疗）并加入陨星（对空 + 群攻）后基础职能全覆盖
  const balanced = diagnoseLineup([
    {...newSlot('拜松'), eq: ['聚合急救箱']},
    newSlot('陨星'),
  ]);
  assert.equal(balanced.missingEssential.length, 0);
  const healEntry = balanced.entries.find((e) => e.role === '治疗');
  assert.deepEqual(healEntry?.providers, ['拜松·聚合急救箱']);
});
