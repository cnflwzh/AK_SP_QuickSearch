import assert from 'node:assert/strict';
import test from 'node:test';
import {BORROW_LIMIT, OPERATOR, OPERATORS} from '../data/index.ts';
import {
  BORROWABLE_SIX_STARS,
  BOX_RANK_BORROWED,
  PRESET_SIX_STARS,
  applyBoxBatch,
  boxSeasonActivatedCount,
  boxSeasonBorrowableMissingCount,
  boxSeasonBorrowedCount,
  boxSeasonCount,
  boxSeasonMaxedCount,
  boxSeasonUntrainedCount,
  clearOperatorBox,
  exportOperatorBox,
  isBorrowableSixStar,
  lineupBoxCoverage,
  normalizeOperatorBox,
  parseExternalBox,
  rankFromEliteLevel,
  rankOfOperator,
  resolveBoxKey,
  setOperatorRank,
} from '../src/lib/box/index.ts';

test('box model distinguishes unowned (-1) from owned E0 (0) and trained ranks (1-3)', () => {
  assert.equal(rankFromEliteLevel(0, 50), 0);
  assert.equal(rankFromEliteLevel(1, 50), 1);
  assert.equal(rankFromEliteLevel(2, 59), 2);
  assert.equal(rankFromEliteLevel(2, 60), 3);
  assert.equal(rankFromEliteLevel(2, 90), 3);

  const bisonKey = resolveBoxKey('拜松');
  assert.equal(bisonKey, OPERATOR['拜松'].avatar);
  assert.equal(resolveBoxKey(bisonKey), bisonKey);
  assert.equal(resolveBoxKey('盟约·辅助干员'), '');
  assert.equal(resolveBoxKey('__proto__'), '');

  const normalized = normalizeOperatorBox({
    拜松: 3,
    [OPERATOR['鸿雪'].avatar]: 2,
    仇白: 0,
    塔露拉: BOX_RANK_BORROWED,
    歌蕾蒂娅: BOX_RANK_BORROWED,
    char_9999_future: 1,
    invalid: 3,
    角峰: 9,
  });
  assert.deepEqual(normalized, {
    [OPERATOR['拜松'].avatar]: 3,
    [OPERATOR['鸿雪'].avatar]: 2,
    [OPERATOR['仇白'].avatar]: 0,
    [OPERATOR['塔露拉'].avatar]: BOX_RANK_BORROWED,
    char_9999_future: 1,
  });

  const cov = lineupBoxCoverage(
    ['拜松', '鸿雪', '仇白', '角峰', '烛煌', '塔露拉', '歌蕾蒂娅', '盟约·辅助干员'],
    normalized,
  );
  assert.equal(cov.total, 7);
  assert.equal(cov.owned, 3);
  assert.equal(cov.activated, 2);
  assert.equal(cov.untrained, 1);
  assert.equal(cov.missing, 4);
  assert.equal(cov.borrowed, 1);
  assert.equal(cov.borrowableMissing, 1);
  assert.equal(cov.elite2, 2);
  assert.equal(cov.maxed, 1);
});

test('borrowable six-star metadata matches official V3_1 NORMAL vs PRESET split', () => {
  assert.equal(BORROW_LIMIT, 30);
  assert.equal(BORROWABLE_SIX_STARS.length, 67);
  assert.equal(PRESET_SIX_STARS.length, 8);
  assert.deepEqual(
    PRESET_SIX_STARS.map((op) => op.name),
    ['伺夜', '维伊', '流明', '淬羽赫默', '歌蕾蒂娅', '溯光星源', '魔王', '机械师'],
  );

  for (const op of OPERATORS) {
    if (op.borrowable) {
      assert.equal(op.stars, 6, `${op.name} marked borrowable must be 6-star`);
      assert.ok(
        op.backupOperator && op.backupOperator.length > 0,
        `${op.name} missing backupOperator`,
      );
      assert.equal(isBorrowableSixStar(op), true);
    } else {
      assert.equal(isBorrowableSixStar(op), false);
    }
  }
});

test('box importer preserves owned-but-untrained E0 operators while excluding unowned entries', () => {
  const maa = parseExternalBox(
    JSON.stringify([
      {id: OPERATOR['鸿雪'].avatar, name: '鸿雪', own: true, elite: 2, level: 90},
      {id: OPERATOR['拜松'].avatar, name: '拜松', own: true, elite: 1, level: 55},
      {id: OPERATOR['仇白'].avatar, name: '仇白', own: true, elite: 0, level: 1},
      {id: OPERATOR['角峰'].avatar, name: '角峰', own: false, elite: 0, level: 1},
      {id: 'char_9999_unknown', name: '未入池', own: true, elite: 2, level: 60},
    ]),
  );
  assert.equal(maa.matchedCount, 3);
  assert.equal(maa.ignoredCount, 1);
  assert.equal(maa.entries[OPERATOR['鸿雪'].avatar], 3);
  assert.equal(maa.entries[OPERATOR['拜松'].avatar], 1);
  assert.equal(maa.entries[OPERATOR['仇白'].avatar], 0);
  assert.equal(Object.hasOwn(maa.entries, OPERATOR['角峰'].avatar), false);
  assert.equal(maa.breakdown.e260, 1);
  assert.equal(maa.breakdown.e1, 1);
  assert.equal(maa.breakdown.e0, 1);

  const skland = parseExternalBox(
    JSON.stringify({
      data: {
        chars: [
          {charId: OPERATOR['仇白'].avatar, evolvePhase: 2, level: 40},
          {charId: OPERATOR['烛煌'].avatar, evolvePhase: 2, level: 60},
          {charId: OPERATOR['拜松'].avatar, evolvePhase: 0, level: 1},
        ],
      },
    }),
  );
  assert.equal(skland.matchedCount, 3);
  assert.equal(skland.entries[OPERATOR['仇白'].avatar], 2);
  assert.equal(skland.entries[OPERATOR['烛煌'].avatar], 3);
  assert.equal(skland.entries[OPERATOR['拜松'].avatar], 0);
  assert.equal(skland.breakdown.e0, 1);

  const text = parseExternalBox('鸿雪、仇白\n烛煌,不存在干员', 0);
  assert.equal(text.matchedCount, 3);
  assert.equal(text.ignoredCount, 1);
  assert.equal(text.entries[OPERATOR['鸿雪'].avatar], 0);

  assert.throws(() => parseExternalBox(''), /请先粘贴/);
  assert.throws(() => parseExternalBox('{broken'), /JSON 解析失败/);
});

test('box store tracks owned, activated, untrained, borrowable, and unowned states cleanly', () => {
  clearOperatorBox();
  assert.equal(boxSeasonCount.value, 0);
  assert.equal(boxSeasonBorrowableMissingCount.value, 67);
  assert.equal(rankOfOperator('拜松'), -1);

  assert.equal(setOperatorRank('拜松', 0), true);
  assert.equal(rankOfOperator('拜松'), 0);
  assert.equal(boxSeasonCount.value, 1);
  assert.equal(boxSeasonActivatedCount.value, 0);
  assert.equal(boxSeasonUntrainedCount.value, 1);
  assert.equal(boxSeasonBorrowableMissingCount.value, 67);

  // Preset 6-star and 4-5 star cannot be marked as borrowed
  assert.equal(setOperatorRank('歌蕾蒂娅', BOX_RANK_BORROWED), false);
  assert.equal(setOperatorRank('拜松', BOX_RANK_BORROWED), false);
  assert.equal(boxSeasonBorrowedCount.value, 0);

  // Borrowable 6-star can be marked as borrowed (equivalent to E0, not counted as owned/activated)
  assert.equal(setOperatorRank('塔露拉', BOX_RANK_BORROWED), true);
  assert.equal(rankOfOperator('塔露拉'), BOX_RANK_BORROWED);
  assert.equal(boxSeasonBorrowedCount.value, 1);
  assert.equal(boxSeasonBorrowableMissingCount.value, 66);
  assert.equal(boxSeasonCount.value, 1);
  assert.equal(boxSeasonActivatedCount.value, 0);

  // Importing/marking an operator owned automatically replaces its borrowed mark
  applyBoxBatch({[OPERATOR['塔露拉'].avatar]: 2}, 'merge');
  applyBoxBatch({[OPERATOR['塔露拉'].avatar]: BOX_RANK_BORROWED}, 'merge');
  assert.equal(rankOfOperator('塔露拉'), 2);
  assert.equal(boxSeasonBorrowedCount.value, 0);
  assert.equal(boxSeasonBorrowableMissingCount.value, 66);
  assert.equal(setOperatorRank('塔露拉', -1), true);
  assert.equal(boxSeasonBorrowableMissingCount.value, 67);

  // Preset 6-star owned does not change borrowableMissingCount
  assert.equal(setOperatorRank('歌蕾蒂娅', 3), true);
  assert.equal(boxSeasonBorrowableMissingCount.value, 67);
  assert.equal(setOperatorRank('歌蕾蒂娅', -1), true);

  assert.equal(setOperatorRank('拜松', 3), true);
  assert.equal(rankOfOperator('拜松'), 3);
  assert.equal(boxSeasonCount.value, 1);
  assert.equal(boxSeasonActivatedCount.value, 1);
  assert.equal(boxSeasonUntrainedCount.value, 0);
  assert.equal(boxSeasonMaxedCount.value, 1);

  applyBoxBatch({[OPERATOR['鸿雪'].avatar]: 2, [OPERATOR['仇白'].avatar]: 0}, 'merge');
  assert.equal(boxSeasonCount.value, 3);
  assert.equal(boxSeasonActivatedCount.value, 2);
  assert.equal(boxSeasonUntrainedCount.value, 1);
  assert.equal(boxSeasonBorrowableMissingCount.value, 65);
  assert.equal(rankOfOperator('拜松'), 3);
  assert.equal(rankOfOperator('鸿雪'), 2);
  assert.equal(rankOfOperator('仇白'), 0);

  assert.equal(setOperatorRank('仇白', -1), true);
  assert.equal(rankOfOperator('仇白'), -1);
  assert.equal(boxSeasonCount.value, 2);
  assert.equal(boxSeasonBorrowableMissingCount.value, 66);

  applyBoxBatch({[OPERATOR['仇白'].avatar]: 3}, 'replace');
  assert.equal(boxSeasonCount.value, 1);
  assert.equal(boxSeasonBorrowableMissingCount.value, 66);
  assert.equal(rankOfOperator('拜松'), -1);
  assert.equal(rankOfOperator('仇白'), 3);

  const exported = exportOperatorBox();
  assert.deepEqual(exported, {[OPERATOR['仇白'].avatar]: 3});

  const overLimit = Object.fromEntries(
    BORROWABLE_SIX_STARS.slice(0, BORROW_LIMIT + 1).map((op) => [
      op.avatar, BOX_RANK_BORROWED,
    ]),
  );
  assert.throws(() => applyBoxBatch(overLimit, 'replace'), /上限/);
  assert.deepEqual(exportOperatorBox(), exported);

  clearOperatorBox();
  assert.equal(boxSeasonCount.value, 0);
  assert.equal(boxSeasonBorrowableMissingCount.value, 67);
});
