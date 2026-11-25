import assert from 'node:assert/strict';
import test from 'node:test';
import {BORROW_LIMIT, BUILD_NAMES, OPERATOR, OPERATORS, SEASON_META} from '../data/index.ts';
import {
  BORROWABLE_SIX_STARS,
  BOX_CODE_PREFIX,
  BOX_RANK_BORROWED,
  OWNABLE_OPERATORS,
  PRESET_SIX_STARS,
  applyBoxBatch,
  boxSeasonActivatedCount,
  boxSeasonBorrowableMissingCount,
  boxSeasonBorrowedCount,
  boxSeasonCount,
  boxSeasonMaxedCount,
  boxSeasonUntrainedCount,
  boxShareUrl,
  clearOperatorBox,
  decodeBox,
  encodeBox,
  evaluateLineupBox,
  exportOperatorBox,
  isBorrowableSixStar,
  isBoxAvailable,
  isBoxSubstitute,
  lineupBoxCoverage,
  normalizeOperatorBox,
  operatorBoxStatus,
  parseExternalBox,
  rankFromEliteLevel,
  rankOfOperator,
  recommendBorrows,
  recommendTraining,
  resolveBoxKey,
  setOperatorRank,
  setOperatorRanks,
} from '../src/lib/box/index.ts';
import {builtinPlan, newSlot} from '../src/lib/plans/index.ts';
import {isBoxShareInput} from '../src/lib/box/shareInput.ts';
import {recommendBorrowBatch} from '../src/lib/box/insights.ts';

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
    [
      '拜松',
      '鸿雪',
      '仇白',
      '角峰',
      '烛煌',
      '塔露拉',
      '歌蕾蒂娅',
      '盟约·辅助干员',
    ],
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
    [
      '伺夜',
      '维伊',
      '流明',
      '淬羽赫默',
      '歌蕾蒂娅',
      '溯光星源',
      '魔王',
      '机械师',
    ],
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
      {
        id: OPERATOR['鸿雪'].avatar,
        name: '鸿雪',
        own: true,
        elite: 2,
        level: 90,
      },
      {
        id: OPERATOR['拜松'].avatar,
        name: '拜松',
        own: true,
        elite: 1,
        level: 55,
      },
      {
        id: OPERATOR['仇白'].avatar,
        name: '仇白',
        own: true,
        elite: 0,
        level: 1,
      },
      {
        id: OPERATOR['角峰'].avatar,
        name: '角峰',
        own: false,
        elite: 0,
        level: 1,
      },
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

test('localized form IDs resolve to the same owned operator across exports and backups', () => {
  const actual = OPERATOR['阿米娅'].avatar;
  const forms = parseExternalBox(
    JSON.stringify([
      {id: 'char_1001_amiya2', name: 'Amiya', own: true, elite: 2, level: 60},
      {id: actual, name: 'Amiya', own: false},
    ]),
  );
  assert.equal(forms.matchedCount, 1);
  assert.deepEqual(forms.entries, {[actual]: 3});
  assert.deepEqual(normalizeOperatorBox({char_1037_amiya3: 2, [actual]: 1}), {
    [actual]: 2,
  });
});

test('training table imports keep ownership, precision and duplicate ranks across reordered columns', () => {
  const rows = [
    '职业\t等级\t是否已招募\t干员名称\t精英化等级',
    '狙击\t59\t是\t鸿雪\t2',
    '狙击\t60\t是\t鸿雪\t2',
    '重装\t1\t是\t拜松\t0',
    '近卫\t90\t否\t仇白\t2',
    '近卫\t1\t是\t未入池的干员\t0',
  ];
  const result = parseExternalBox(rows.join('\n'));
  assert.deepEqual(result.entries, {
    [OPERATOR['鸿雪'].avatar]: 3,
    [OPERATOR['拜松'].avatar]: 0,
  });
  assert.equal(result.ignoredCount, 1);
  assert.throws(() => parseExternalBox(rows.slice(1).join('\n')), /列名/);
  assert.throws(
    () => parseExternalBox(rows.join('\n').replace('59', '99')),
    /第 2 行/,
  );
  assert.throws(
    () => parseExternalBox('名称,ID,等级,持有\n玛恩纳,char_4064_mlynar,1,否'),
    /MAA 请导出 JSON/,
  );
  assert.throws(
    () =>
      parseExternalBox(
        '| Name | ID | Level | Own |\n| 玛恩纳 | char_4064_mlynar | 1 | No |',
      ),
    /MAA 请导出 JSON/,
  );
});

test('batch editing deduplicates names and prevents partial writes at the borrow limit', () => {
  clearOperatorBox();
  try {
    const avatars = BORROWABLE_SIX_STARS.slice(0, BORROW_LIMIT).map(
      (op) => op.avatar,
    );
    assert.equal(
      setOperatorRanks(
        [...avatars, BORROWABLE_SIX_STARS[0].name],
        BOX_RANK_BORROWED,
      ),
      BORROW_LIMIT,
    );
    const before = exportOperatorBox();
    assert.throws(
      () =>
        setOperatorRanks(
          [...avatars, BORROWABLE_SIX_STARS[BORROW_LIMIT].avatar],
          BOX_RANK_BORROWED,
        ),
      /上限/,
    );
    assert.deepEqual(exportOperatorBox(), before);
    applyBoxBatch({char_9999_future: 2});
    applyBoxBatch({[OPERATOR['拜松'].avatar]: 1}, 'replace');
    assert.deepEqual(exportOperatorBox(), {
      char_9999_future: 2,
      [OPERATOR['拜松'].avatar]: 1,
    });
  } finally {
    clearOperatorBox();
  }
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

  applyBoxBatch(
    {[OPERATOR['鸿雪'].avatar]: 2, [OPERATOR['仇白'].avatar]: 0},
    'merge',
  );
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
      op.avatar,
      BOX_RANK_BORROWED,
    ]),
  );
  assert.throws(() => applyBoxBatch(overLimit, 'replace'), /上限/);
  assert.deepEqual(exportOperatorBox(), exported);

  clearOperatorBox();
  assert.equal(boxSeasonCount.value, 0);
  assert.equal(boxSeasonBorrowableMissingCount.value, 67);
});

test('box share codec losslessly encodes sparse and dense boxes and rejects corrupted codes', () => {
  const sparse = {
    [OPERATOR['拜松'].avatar]: 3,
    [OPERATOR['鸿雪'].avatar]: 2,
    [OPERATOR['仇白'].avatar]: 0,
    [OPERATOR['角峰'].avatar]: 1,
    [OPERATOR['塔露拉'].avatar]: BOX_RANK_BORROWED,
  };
  const sparseCode = encodeBox(sparse);
  assert.ok(sparseCode.startsWith(BOX_CODE_PREFIX));
  assert.ok(
    sparseCode.length < 40,
    `expected compact sparse code, got ${sparseCode.length}`,
  );
  assert.deepEqual(decodeBox(sparseCode), sparse);
  assert.deepEqual(decodeBox(boxShareUrl(sparseCode)), sparse);

  // Full realistic box across fixed + selectable 6★ + borrowed slots
  const dense = {};
  OWNABLE_OPERATORS.forEach((op, idx) => {
    if (idx % 5 === 0) return;
    dense[op.avatar] = idx % 4;
  });
  for (const op of BORROWABLE_SIX_STARS.slice(0, 12)) {
    dense[op.avatar] = BOX_RANK_BORROWED;
  }
  const denseCode = encodeBox(dense);
  assert.ok(
    denseCode.length < 150,
    `expected compact dense code (<150 chars), got ${denseCode.length}`,
  );
  assert.deepEqual(decodeBox(denseCode), dense);

  // parseExternalBox recognizes both short code and #b= URL
  const imported = parseExternalBox(`扫一扫同步：${boxShareUrl(sparseCode)}`);
  assert.equal(imported.formatLabel, '跨端同步码');
  assert.equal(imported.matchedCount, 5);
  assert.equal(imported.breakdown.borrowed, 1);
  assert.equal(imported.breakdown.e260, 1);
  assert.equal(imported.breakdown.e0, 1);

  // Tampered or truncated code must fail checksum/parsing
  const last = sparseCode.slice(-1);
  const flipped = sparseCode.slice(0, -1) + (last === 'A' ? 'B' : 'A');
  assert.equal(decodeBox(flipped), null);
  assert.equal(decodeBox(sparseCode.slice(0, -3)), null);
  assert.equal(decodeBox('WBinvalid!!!'), null);
});

test('box sync keeps released slot IDs and rejects an invalid code without importing nearby names', () => {
  // 已发行的 V1 短码。第 0 槽是阿米娅，第 206 槽是自选六星国度。
  const legacyCode = 'WBEgEAGzoA6A';
  const expected = {char_002_amiya: 2, char_4246_dminon: 3};
  assert.deepEqual(decodeBox(legacyCode), expected);
  assert.equal(encodeBox(expected), legacyCode);
  assert.equal(boxShareUrl(legacyCode), '/#b=EgEAGzoA6A');
  assert.deepEqual(decodeBox(boxShareUrl(legacyCode)), expected);
  assert.equal(decodeBox('WBEgEAGzoA6B'), null);
  assert.throws(() => parseExternalBox('WB损坏，鸿雪'), /同步码/);
  assert.throws(() => parseExternalBox('#b=作废/鸿雪'), /同步码/);

  // 文件中的备注可以引用其他 Box，仍应导入文件本身的记录。
  const json = JSON.stringify({[OPERATOR['鸿雪'].avatar]: 1, note: legacyCode});
  assert.deepEqual(parseExternalBox(json).entries, {
    [OPERATOR['鸿雪'].avatar]: 1,
  });

  const fullRoster = Object.fromEntries(
    OWNABLE_OPERATORS.map((op) => [op.avatar, 1]),
  );
  assert.deepEqual(decodeBox(encodeBox(fullRoster)), fullRoster);
});

test('box insights classify operator status, rank builds by fit, and recommend borrows & E0 training', () => {
  const sampleBox = {
    [OPERATOR['拜松'].avatar]: 3,
    [OPERATOR['仇白'].avatar]: 0,
    [OPERATOR['塔露拉'].avatar]: BOX_RANK_BORROWED,
  };

  assert.equal(
    operatorBoxStatus(OPERATOR['拜松'], sampleBox).kind,
    'owned-activated',
  );
  assert.equal(
    operatorBoxStatus(OPERATOR['仇白'], sampleBox).kind,
    'owned-untrained',
  );
  assert.equal(
    operatorBoxStatus(OPERATOR['塔露拉'], sampleBox).kind,
    'borrowed',
  );
  assert.equal(
    operatorBoxStatus(OPERATOR['歌蕾蒂娅'], sampleBox).kind,
    'preset',
  );
  const sub = operatorBoxStatus(OPERATOR['烛煌'], sampleBox);
  assert.equal(sub.kind, 'substitute');
  assert.equal(sub.isSubstitute, true);
  assert.equal(sub.backupOperator, OPERATOR['烛煌'].backupOperator);
  assert.equal(isBoxSubstitute(OPERATOR['烛煌'], sampleBox), true);
  assert.equal(isBoxAvailable(OPERATOR['烛煌'], sampleBox), false);
  assert.equal(isBoxAvailable(OPERATOR['塔露拉'], sampleBox), true);
  assert.equal(isBoxAvailable(OPERATOR['歌蕾蒂娅'], sampleBox), true);

  // Lineup with missing core 6★ ranks lower than lineup with all available operators
  const ready = evaluateLineupBox(
    [newSlot('拜松'), newSlot('歌蕾蒂娅')],
    sampleBox,
  );
  const missingNonCore = evaluateLineupBox(
    [newSlot('拜松'), newSlot('烛煌')],
    sampleBox,
  );
  const missingCore = evaluateLineupBox(
    [newSlot('拜松'), {...newSlot('烛煌'), core: true}],
    sampleBox,
  );
  assert.ok(ready.fitScore > missingNonCore.fitScore);
  assert.ok(missingNonCore.fitScore > missingCore.fitScore);
  assert.equal(missingCore.coreSubstitutes.length, 1);

  const sources = BUILD_NAMES.map((key) => {
    const plan = builtinPlan(key);
    return {key, name: plan.name, builtin: true, ops: plan.ops};
  });
  const borrows = recommendBorrows(sampleBox, sources);
  assert.equal(borrows.length, BORROWABLE_SIX_STARS.length - 1); // 仇白已持有被排除
  assert.ok(!borrows.some((item) => item.op.name === '仇白'));
  assert.ok(borrows.some((item) => item.op.name === '塔露拉' && item.borrowed));
  assert.ok(borrows[0].score >= borrows.at(-1).score);

  const focused = recommendBorrows(sampleBox, sources, new Set(['炎']));
  const yanCoreSix = builtinPlan('炎')
    .ops.filter(
      (s) =>
        s.core && isBorrowableSixStar(OPERATOR[s.name]) && s.name !== '仇白',
    )
    .map((s) => s.name);
  if (yanCoreSix.length) {
    assert.ok(
      focused.slice(0, 6).some((item) => yanCoreSix.includes(item.op.name)),
      'focusing on 炎 should float 炎 core borrowable 6★ near the top',
    );
  }

  const training = recommendTraining(sampleBox, sources);
  assert.ok(training.some((item) => item.op.name === '仇白'));
});

test('two remaining borrows can complete the 谢拉格 lineup instead of splitting its slots with 炎', () => {
  const sources = ['谢拉格', '炎'].map((key) => ({
    key,
    name: key,
    builtin: true,
    ops: builtinPlan(key).ops,
  }));
  const missing = new Set(['锏', '圣聆初雪', '烛煌', '仇白', '老鲤']);
  const box = Object.fromEntries(
    BORROWABLE_SIX_STARS.filter((op) => !missing.has(op.name)).map((op) => [
      op.avatar,
      0,
    ]),
  );
  const inPlans = new Set(
    sources.flatMap(({ops}) => ops.flatMap((slot) => [slot.name, ...slot.alt])),
  );
  for (const op of BORROWABLE_SIX_STARS.filter(
    (op) => !inPlans.has(op.name),
  ).slice(0, BORROW_LIMIT - 2)) {
    box[op.avatar] = BOX_RANK_BORROWED;
  }

  const batch = recommendBorrowBatch(Object.freeze(box), sources);
  assert.equal(
    batch.ranking.filter((item) => !item.borrowed)[0].op.name,
    '烛煌',
  );
  assert.deepEqual(new Set(batch.picks), new Set(['锏', '圣聆初雪']));
  assert.equal(batch.completedLineups, 1);
  assert.equal(batch.completedCores, 1);

  const onlyYan = recommendBorrowBatch(box, sources, new Set(['炎']));
  assert.equal(onlyYan.picks.length, 2);
  assert.ok(
    onlyYan.picks.every((name) => ['烛煌', '仇白', '老鲤'].includes(name)),
  );
  assert.equal(onlyYan.completedCores, 0);

  const oneLeft = {...box, [OPERATOR['锏'].avatar]: BOX_RANK_BORROWED};
  const last = recommendBorrowBatch(oneLeft, sources);
  assert.deepEqual(last.picks, ['圣聆初雪']);
  assert.ok(
    last.ranking.some((item) => item.op.name === '锏' && item.borrowed),
  );
  assert.ok(
    last.ranking
      .find((item) => item.op.name === '圣聆初雪')
      .reasons.includes('借后补齐 1 套主选'),
  );
  assert.deepEqual(
    recommendBorrowBatch(
      {...oneLeft, [OPERATOR['圣聆初雪'].avatar]: BOX_RANK_BORROWED},
      sources,
    ).picks,
    [],
  );
});

test('the final two borrows maximize completed goals even when an unrelated single is more efficient', () => {
  const pending = ['锏', '圣聆初雪', '烛煌'];
  const box = Object.fromEntries(
    BORROWABLE_SIX_STARS.filter((op) => !pending.includes(op.name))
      .slice(0, BORROW_LIMIT - 2)
      .map((op) => [op.avatar, BOX_RANK_BORROWED]),
  );
  // 单借烛煌能补齐两套；三套不同的自建阵容都同时缺锏和圣聆初雪。
  const lineups = [
    ['烛煌', '拜松'],
    ['烛煌', '地灵'],
    ['锏', '圣聆初雪', '拜松'],
    ['锏', '圣聆初雪', '地灵'],
    ['锏', '圣聆初雪', '波登可'],
  ];
  const plans = lineups.map((names) => ({
    name: names.join('、'),
    key: names.join('/'),
    builtin: false,
    ops: names.map(newSlot),
  }));
  const batch = recommendBorrowBatch(
    box,
    plans,
    new Set(plans.map(({key}) => key)),
  );
  assert.deepEqual(new Set(batch.picks), new Set(pending.slice(0, 2)));
  assert.equal(batch.completedLineups, 3);
});

test('training priorities reflect which main lineups can field all their original operators', () => {
  const sources = [
    {
      key: 'ready',
      name: '现成阵容',
      builtin: false,
      ops: [newSlot('鸿雪'), newSlot('拜松')],
    },
    {
      key: 'blocked',
      name: '待借阵容',
      builtin: false,
      ops: [newSlot('仇白'), newSlot('烛煌')],
    },
  ];
  const box = {[OPERATOR['鸿雪'].avatar]: 0, [OPERATOR['仇白'].avatar]: 0};
  const [ready, blocked] = recommendTraining(box, sources);
  assert.equal(ready.op.name, '鸿雪');
  assert.ok(ready.score > blocked.score);
  assert.ok(ready.reasons.includes('1 套主选已齐'));
  assert.ok(!blocked.reasons.includes('1 套主选已齐'));
  const after = recommendTraining(
    {...box, [OPERATOR['烛煌'].avatar]: BOX_RANK_BORROWED},
    sources,
  );
  assert.equal(after[0].score, after[1].score);
});

test('WB 跨季同版本不同槽表不能互读，511 槽和版本 15 可往返', async () => {
  const originalSeason = SEASON_META.id;
  const originalFormat = SEASON_META.boxShare;
  const sample = {char_002_amiya: 2};
  const legacy = encodeBox(sample);
  let sequence = 0;
  const fixture = async (season, version, operatorIds) => {
    SEASON_META.id = season;
    SEASON_META.boxShare = {version, operatorIds};
    return import(`../src/lib/box/share.ts?box-fixture=${++sequence}`);
  };
  try {
    const s2 = await fixture('s2', originalFormat.version, [325, 2]);
    const s3 = await fixture('s3', originalFormat.version, [2, 325]);
    const newCode = s2.encodeBox(sample);
    for (const input of [newCode, s2.boxShareUrl(newCode), '同步码：' + newCode]) {
      assert.ok(isBoxShareInput(input));
      assert.deepEqual(s2.decodeBox(input), sample);
      assert.equal(s3.decodeBox(input), null);
      assert.equal(decodeBox(input), null);
    }
    assert.equal(s2.decodeBox(legacy), null);
    assert.equal(s2.decodeBox(boxShareUrl(legacy)), null);
    assert.equal(s2.decodeBox(s3.encodeBox(sample)), null);

    const slots = [...Array.from({length: 510}, (_, index) => index + 100000), 2];
    const max = await fixture('s2', 15, slots);
    assert.deepEqual(max.decodeBox(max.encodeBox(sample)), sample);
    assert.equal(s2.decodeBox(max.encodeBox(sample)), null);
    for (const [version, ids] of [[0, slots], [16, slots], [1, [...slots, 325]], [1, [2, 2]]]) {
      const invalid = await fixture('s2', version, ids);
      assert.throws(() => invalid.encodeBox(sample), /协议范围/);
      assert.equal(invalid.decodeBox(newCode), null);
    }
  } finally {
    SEASON_META.id = originalSeason;
    SEASON_META.boxShare = originalFormat;
  }
});
