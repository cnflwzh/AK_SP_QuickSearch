import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COMBAT_ROLE_LABELS,
  OPERATOR,
  OPERATORS,
  equipmentWithRoles,
  operatorRolesAtElite,
  operatorsWithRoles,
  rolesForTraining,
} from '../data/index.ts';
import {BOX_RANK_BORROWED} from '../src/lib/box/model.ts';
import {
  covenantStats,
  diagnoseLineup,
  newSlot,
} from '../src/lib/plans/index.ts';

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

test('diagnoseLineup reports substituteRisks when a role depends solely on unborrowed 6★ operators', () => {
  const slots = [newSlot('拜松'), newSlot('荒芜拉普兰德')];
  const stats = covenantStats(slots);

  // Without Box, no substitute risks are reported
  assert.deepEqual(diagnoseLineup(slots, stats).substituteRisks, []);

  // With a non-empty Box that does not own/borrow 荒芜拉普兰德, 沉默 is at risk
  const box = {[OPERATOR['拜松'].avatar]: 3};
  const risky = diagnoseLineup(slots, stats, box);
  assert.ok(risky.substituteRisks.some((r) => r.role === '沉默'));
  assert.equal(
    risky.entries.find((e) => e.role === '沉默')?.substituteOnly,
    true,
  );
  // 阻挡 is provided by 拜松 (owned), so it is not a substitute risk
  assert.ok(!risky.substituteRisks.some((r) => r.role === '阻挡'));

  // Once 荒芜拉普兰德 is borrowed, the risk disappears
  const borrowed = diagnoseLineup(slots, stats, {
    ...box,
    [OPERATOR['荒芜拉普兰德'].avatar]: BOX_RANK_BORROWED,
  });
  assert.deepEqual(borrowed.substituteRisks, []);
});

test('substitute equipment risks depend on the trigger and report a borrowable operator', () => {
  const box = {[OPERATOR['拜松'].avatar]: 0};
  const equipped = {...newSlot('斯卡蒂'), eq: ['聚合急救箱', '奥术法阵']};
  const report = diagnoseLineup([equipped], undefined, box);
  assert.deepEqual(report.entries.find((r) => r.role === '治疗').providers, [
    '斯卡蒂·聚合急救箱',
  ]);
  assert.equal(
    report.entries.find((r) => r.role === '治疗').substituteOnly,
    undefined,
  );
  assert.deepEqual(
    report.substituteRisks.find((r) => r.role === '沉默').operators,
    [{name: '斯卡蒂', backupOperator: OPERATOR['斯卡蒂'].backupOperator}],
  );

  const withCaster = diagnoseLineup(
    [equipped, newSlot('拉普兰德')],
    undefined,
    box,
  );
  assert.ok(!withCaster.substituteRisks.some((risk) => risk.role === '沉默'));
});

test('borrow plan covers essential roles first and spends one slot per independent need', () => {
  const box = {[OPERATOR['拜松'].avatar]: 3};
  const slots = [
    newSlot('赫拉格'), // 高频
    newSlot('白铁'), // 群攻
    {...newSlot('隐德来希'), core: true}, // 群攻，同等覆盖时优先核心
  ];
  const suggest = (limit) =>
    diagnoseLineup(slots, undefined, box, limit).borrowPlan;
  assert.deepEqual(suggest(0).names, []);
  assert.deepEqual(suggest(1), {names: ['隐德来希'], roles: ['群攻']});
  assert.deepEqual(suggest(3).names, ['赫拉格', '隐德来希']);
});

test('conditional elemental output tracks the missing source of elemental damage', () => {
  const slots = ['折光', '妮芙'].map(newSlot);
  const box = {[OPERATOR['折光'].avatar]: 1};
  const report = diagnoseLineup(slots, undefined, box);
  assert.deepEqual(
    report.entries.find((r) => r.role === '元素输出').providers,
    ['妮芙', '折光'],
  );
  assert.deepEqual(
    report.substituteRisks.find((r) => r.role === '元素输出').operators,
    [{name: '妮芙', backupOperator: OPERATOR['妮芙'].backupOperator}],
  );
  const borrowed = {...box, [OPERATOR['妮芙'].avatar]: BOX_RANK_BORROWED};
  assert.ok(
    !diagnoseLineup(slots, undefined, borrowed).substituteRisks.some(
      (r) => r.role === '元素输出',
    ),
  );
});

test('a twenty-position draft can borrow its last operator for a unique role', () => {
  const last = '荒芜拉普兰德';
  const slots = OPERATORS.filter(
    (op) =>
      op.borrowable &&
      op.stars === 6 &&
      !operatorRolesAtElite(op, false).includes('沉默'),
  )
    .slice(0, 19)
    .map((op) => newSlot(op.name));
  slots.push(newSlot(last));
  assert.equal(slots.length, 20);
  const box = {[OPERATOR['拜松'].avatar]: 3};
  const report = diagnoseLineup(slots, [], box, 20);
  assert.deepEqual(
    report.substituteRisks
      .find((risk) => risk.role === '沉默')
      .operators.map((op) => op.name),
    [last],
  );
  assert.ok(report.borrowPlan.names.includes(last));
  assert.ok(report.borrowPlan.names.length < slots.length);
  for (const name of report.borrowPlan.names)
    box[OPERATOR[name].avatar] = BOX_RANK_BORROWED;
  assert.deepEqual(diagnoseLineup(slots, [], box).substituteRisks, []);
});
