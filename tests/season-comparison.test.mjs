import assert from 'node:assert/strict';
import test from 'node:test';
import {SEASONS} from '../data/seasons/registry.ts';
import {diffSeasons} from '../src/lib/season/diff.ts';
import {buildSeasonVisualComparison} from '../src/diff/comparison.ts';
import {buildSeasonDiffInfographic} from '../src/diff/infographic.ts';

test('同季修订保留实际数值差异，材料换序不产生配方变动', () => {
  const season = SEASONS[0];
  const [item, ...rest] = season.equipment;
  const next = {
    ...season,
    equipment: [
      {...item, mechanics: {...item.mechanics, deploymentSlotBonus: 2}},
      ...rest,
    ],
    equipmentCombos: season.equipmentCombos.map(([a, b, result]) => [
      b,
      a,
      result,
    ]),
  };
  const summary = diffSeasons(season, next);
  assert.deepEqual(
    summary.equipment.changed.map((entry) => entry.name),
    [item.name],
  );
  assert.deepEqual(
    summary.equipment.changed[0].changes.map((change) => change.field),
    ['deploymentSlotBonus'],
  );
  const comparison = buildSeasonVisualComparison(season, next);
  assert.equal(comparison.totals.totalChanges, 1);
  assert.equal(buildSeasonDiffInfographic(comparison).comboDiffs.length, 0);
});

test('跨季互换交换增删方向，统计与所选两版的明细一致', () => {
  const season = SEASONS[0];
  const [retiring, joining, ...shared] = season.operators;
  const before = {...season, operators: [retiring, ...shared]};
  const after = {...season, operators: [joining, ...shared]};
  const forward = buildSeasonVisualComparison(before, after);
  const reverse = buildSeasonVisualComparison(after, before);
  for (const status of ['added', 'modified', 'removed', 'unchanged']) {
    const opposite = {added: 'removed', removed: 'added'}[status] ?? status;
    assert.equal(forward.totals[status], reverse.totals[opposite]);
    assert.equal(
      forward.totals[status],
      forward.entries.filter((entry) => entry.status === status).length,
    );
  }
  assert.equal(forward.totals.added, 1);
  assert.equal(forward.totals.removed, 1);
  const same = buildSeasonVisualComparison(after, after);
  assert.equal(same.totals.totalChanges, 0);
});
