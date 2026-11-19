import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COMBAT_ROLE_LABELS,
  equipmentWithRoles,
  operatorsWithRoles,
  rolesForTraining,
} from '../data/index.ts';
import {diagnoseLineup, newSlot} from '../src/lib/plans/index.ts';

test('combat role lookup connects trainings, operators, and equipment', () => {
  assert.ok(COMBAT_ROLE_LABELS.includes('反隐'));
  assert.deepEqual(rolesForTraining('隐匿'), ['反隐']);
  assert.deepEqual(rolesForTraining('元素'), ['元素回复']);

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

test('diagnostics follows the seasonal form, skill and elite module', () => {
  const covered = (slots) =>
    diagnoseLineup(slots)
      .entries.filter((entry) => entry.providers.length)
      .map((entry) => entry.role);
  for (const role of ['治疗', '群攻', '真伤']) {
    assert.ok(covered([newSlot('阿米娅')]).includes(role));
  }
  assert.ok(!covered([newSlot('森蚺')]).includes('控制'));
  assert.ok(!covered([newSlot('地灵')]).includes('群攻'));
  assert.ok(!covered([newSlot('远牙')]).includes('群攻'));
  assert.ok(covered([newSlot('真理')]).includes('群攻'));
  assert.ok(!covered([newSlot('黑键')]).includes('元素输出'));
  assert.ok(covered([{...newSlot('黑键'), elite: true}]).includes('元素输出'));
});

test('coverage requires an independent source and an eligible equipment holder', () => {
  const providers = (slots, role) =>
    diagnoseLineup(slots).entries.find((entry) => entry.role === role)
      .providers;
  const equipped = (name, ...eq) => ({...newSlot(name), eq});
  const sniper = [equipped('灰喉', '护盾无人机', '驱逐者瓦斯')];
  assert.deepEqual(providers(sniper, '治疗'), []);
  assert.deepEqual(providers(sniper, '控制'), []);
  assert.deepEqual(providers([equipped('灰喉', '战栗维式重锤')], '控制'), []);
  assert.deepEqual(
    providers([equipped('灰喉', '灼燃维式重锤')], '元素输出'),
    [],
  );
  assert.deepEqual(
    providers([equipped('灰喉', '伊比利亚骨刺刀', '灼燃维式重锤')], '元素输出'),
    ['灰喉·灼燃维式重锤'],
  );
  assert.deepEqual(providers([newSlot('折光')], '元素输出'), []);
  assert.deepEqual(providers([newSlot('折光'), newSlot('妮芙')], '元素输出'), [
    '妮芙',
    '折光',
  ]);
  assert.deepEqual(providers([newSlot('卡达'), newSlot('伊桑')], '反隐'), []);
  assert.deepEqual(
    providers(['卡达', '伊桑', 'Miss.Christine'].map(newSlot), '反隐'),
    ['奥术'],
  );
  assert.deepEqual(providers(['莎草', '波登可'].map(newSlot), '元素回复'), [
    '聚合',
  ]);
});
