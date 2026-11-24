import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COVENANTS,
  EQUIPMENT,
  OPERATORS,
  SEASON_META,
  STRATEGY,
} from '../data/index.ts';
import {
  applyGuidePatch,
  planShareLinks,
  readGuideReference,
} from '../src/lib/plans/sklandShare.ts';
import {
  canShareViaQr,
  decodePlan,
  formatPlanShareText,
} from '../src/lib/plans/sharing.ts';
import {samePlan, usesLayers} from '../src/lib/plans/model.ts';
import {blankPlan, loadPlans} from '../src/lib/plans/storage.ts';
import {parsePlanBackup, serializePlanBackup} from '../src/lib/plans/backup.ts';
import {serializeSettingsBackup} from '../src/lib/settings/backup.ts';
import {DEFAULT_SETTINGS} from '../src/lib/settings/model.ts';
import {
  guidePlanFields,
  matchesGuidePlan,
  parseSklandResponse,
  sklandIdFromText,
  sklandUrl,
} from '../src/lib/plans/skland.ts';

const id = '2124459193780160798';
const {season, version} = SEASON_META.skland;
const roster = OPERATORS.slice(0, 22);
const strategyNames = Object.keys(STRATEGY).slice(0, 6);
const lineup = {
  tabType: 1,
  startRound: 0,
  endRound: 0,
  recChars: [
    ...roster.map((op) => ({
      charId: op.avatar,
      skillId: 'skill',
      moduleId: 'mod',
      mergeLevel: 1,
    })),
    {charId: 'unknown'},
  ],
  recItems: [{itemId: 'scope'}],
  operationIdea: '运营'.repeat(1001),
  activeBonds: {seasonBondIds: ['bond'], regularBondIds: []},
};
const payload = {
  code: 0,
  data: {
    guide: {
      guide: {
        guideId: id,
        title: '公开攻略',
        seasonId: season,
        versionId: version,
        latestEditAtTs: '100',
        strategyIds: [
          'unknown-strategy',
          ...strategyNames.map((_, i) => String(i)),
        ],
        tabs: [
          lineup,
          {
            ...lineup,
            tabType: 2,
            startRound: 1,
            endRound: 4,
            recChars: [...lineup.recChars].reverse(),
            operationIdea: '前期'.repeat(900),
          },
        ],
      },
      poster: {nickname: '作者'},
    },
    seasonResourceMap: {
      [season]: {
        versionResourceMap: {
          [version]: {
            chars: Object.fromEntries(
              roster.map((op) => [
                op.avatar,
                {
                  name: op.name,
                  skills: [{skillId: 'skill', name: '技能'}],
                  modules: [{moduleId: 'mod', name: '模组'}],
                },
              ]),
            ),
            items: {scope: {name: '精准狙击镜'}},
            strategies: Object.fromEntries(
              strategyNames.map((name, i) => [
                String(i),
                {initiatorName: name},
              ]),
            ),
            bonds: {bond: {name: '维多利亚'}},
          },
        },
      },
    },
  },
};

test('分享文案保留长编号，仅识别官方攻略详情', () => {
  assert.equal(sklandIdFromText('分享 [原文](' + sklandUrl(id) + ')'), id);
  assert.equal(
    sklandIdFromText(sklandUrl(id).replace('game.skland.com', 'example.com')),
    null,
  );
  assert.throws(() => parseSklandResponse(payload, '1'));
});

test('原样转发只带攻略编号，二维码能直接导入，文案中的其他链接不抢占末行目标', () => {
  const guide = parseSklandResponse(payload, id);
  const plan = {...blankPlan(), ...guidePlanFields(guide), skland: guide};
  const origin = 'https://example.org';
  const {kind, link, qrLink, code} = planShareLinks(plan, origin);
  assert.equal(kind, 'original');
  assert.equal(link, sklandUrl(id));
  assert.equal(qrLink, origin + '/#g=' + id);
  assert.equal(readGuideReference(qrLink).id, id);
  assert.equal(readGuideReference(id).id, id);
  assert.equal(
    readGuideReference(sklandUrl('42') + '\n导入链接：' + link).id,
    id,
  );
  assert.ok(samePlan(plan, decodePlan(code).plan));
  for (const suffix of ['.', '.Q', '.Aaa', '.Qabc!', '.Qabc.extra'])
    assert.equal(readGuideReference(qrLink + suffix), null);
  const nativePlan = {...plan, skland: undefined};
  const native = planShareLinks(nativePlan, origin);
  assert.equal(native.kind, 'full');
  assert.ok(samePlan(nativePlan, decodePlan(native.link).plan));
});

test('差异还原全部可编辑字段，保留显式清空；二次转发稳定并拒绝错版和损坏的链接', () => {
  const guide = parseSklandResponse(payload, id);
  const fields = guidePlanFields(guide);
  const plan = {...blankPlan(), ...fields, skland: guide};
  const original = structuredClone(plan);
  plan.icon = {kind: 'operator', name: roster[0].name};
  assert.equal(matchesGuidePlan(plan, guide), false);
  plan.name = '我的修改';
  plan.ops.reverse();
  plan.ops[0].core = true;
  plan.ops[0].elite = false;
  plan.ops[0].eq = [EQUIPMENT[0].name];
  plan.ops[0].alt = [roster.at(-1).name];
  plan.layers[Object.keys(COVENANTS).find(usesLayers)] = 15;
  plan.strategy = strategyNames[4];
  plan.strategyAlternates = [];
  plan.note = '';
  plan.stages[0].to = 5;
  plan.stages[0].note = plan.stages[0].note.slice(0, -1) + '😀';
  plan.stages[0].ops.splice(2, 1);
  plan.stages.push({from: 6, to: 15, note: '换人', ops: [], layers: {}});
  for (const edited of [
    plan,
    {...plan, stages: [], ops: [], strategy: '', icon: undefined},
  ]) {
    const share = planShareLinks(edited, 'https://example.org');
    assert.equal(share.kind, 'delta');
    assert.ok(canShareViaQr(share.qrLink));
    const ref = readGuideReference(formatPlanShareText(edited, share.link));
    assert.equal(ref.id, id);
    const restored = {
      ...blankPlan(),
      ...applyGuidePatch(guide, ref.patch),
      skland: guide,
    };
    assert.ok(samePlan(edited, restored));
    assert.throws(
      () => applyGuidePatch({...guide, id: '12'}, ref.patch),
      /完整分享码/,
    );
    assert.deepEqual(planShareLinks(restored, 'https://example.org'), share);
    assert.throws(
      () => applyGuidePatch({...guide, title: '作者更新'}, ref.patch),
      /完整分享码/,
    );
    assert.throws(
      () => applyGuidePatch(guide, ref.patch.slice(0, -2)),
      /完整分享码/,
    );
    assert.ok(samePlan(edited, decodePlan(share.code).plan));
  }
  assert.deepEqual(guidePlanFields(guide), guidePlanFields(original.skland));
});

test('独立映射各阶段二十人、五项策略和长备注，存档与备份保留完整原文', () => {
  const guide = parseSklandResponse(payload, id);
  assert.equal(guide.formation.operators.length, 23);
  assert.equal(guide.rounds[0].to, 4);
  assert.deepEqual(guide.formation.operators[0], {
    name: roster[0].name,
    id: roster[0].avatar,
    skill: '技能',
    module: '模组',
    elite: true,
  });
  assert.equal(guide.formation.operators.at(-1).name, 'unknown');
  const fields = guidePlanFields(guide);
  assert.deepEqual(
    fields.ops.map((op) => op.name),
    roster.slice(0, 20).map((op) => op.name),
  );
  assert.deepEqual(
    fields.stages[0].ops.map((op) => op.name),
    roster
      .slice()
      .reverse()
      .slice(0, 20)
      .map((op) => op.name),
  );
  assert.equal(fields.stages[0].note, '前期'.repeat(900));
  assert.equal(fields.note.length, 2000);
  assert.deepEqual(
    [fields.strategy, ...fields.strategyAlternates],
    strategyNames.slice(0, 5),
  );
  assert.deepEqual(fields.ops[0].eq, []);
  assert.deepEqual(guide.formation.equipment, ['精准狙击镜']);
  assert.equal(guide.formation.idea.length, 2002);
  assert.equal(
    guidePlanFields(guide, [roster[8].name]).ops[0].name,
    roster[8].name,
  );
  const other = guidePlanFields({...guide, version: 'other'});
  assert.deepEqual(
    [other.ops, other.stages, other.strategy, other.strategyAlternates],
    [[], [], '', []],
  );
  const plan = {...blankPlan(), ...fields, skland: guide};
  assert.deepEqual(loadPlans(JSON.stringify([plan])), [plan]);
  assert.deepEqual(parsePlanBackup(serializePlanBackup([plan])).plans, [plan]);
});

test('下载单套流派、备份流派和导出配置时都写入森空岛原文链接', () => {
  const guide = parseSklandResponse(payload, id);
  const edited = {
    ...blankPlan(),
    ...guidePlanFields(guide),
    skland: guide,
    note: '自己的打法',
  };
  const local = blankPlan('自建');
  for (const json of [
    serializePlanBackup([edited]),
    serializePlanBackup([edited, local]),
    serializeSettingsBackup(DEFAULT_SETTINGS, [edited, local]),
  ]) {
    const {plans} = JSON.parse(json);
    assert.equal(plans[0].sklandUrl, sklandUrl(id));
    assert.equal(plans[0].note, edited.note);
    assert.deepEqual(plans[0].skland, guide);
    if (plans.length > 1)
      assert.equal(Object.hasOwn(plans[1], 'sklandUrl'), false);
  }
});

test('无效与重叠回合留在原文，其余阶段仍按回合转入且独立于成型阵容', () => {
  const raw = structuredClone(payload);
  const tabs = raw.data.guide.guide.tabs;
  const stage = tabs[1];
  tabs.push(
    {...stage, startRound: 3, endRound: 7},
    {...stage, startRound: '待定', endRound: 9},
    {...stage, startRound: 8, endRound: 6},
    {...stage, startRound: 98, endRound: 100},
    {...stage, startRound: 12, endRound: 18},
    {...stage, startRound: 7, endRound: 7},
  );
  const guide = parseSklandResponse(raw, id);
  assert.equal(guide.rounds.length, 7);
  assert.equal(guide.rounds[2].from, '待定');
  const fields = guidePlanFields(guide, []);
  assert.deepEqual(fields.ops, []);
  assert.deepEqual(
    fields.stages.map(({from, to}) => [from, to]),
    [
      [1, 4],
      [7, 7],
      [12, 15],
    ],
  );
  assert.equal(fields.stages[0].ops.length, 20);
  assert.equal(guide.rounds[5].to, 18);
});

test('旧八人导入可离线恢复各阶段，已修改的字段及后来清空的阶段得到保留', () => {
  const guide = parseSklandResponse(payload, id);
  const fields = guidePlanFields(guide);
  const legacy = {
    ...blankPlan(),
    skland: guide,
    name: fields.name,
    strategy: '',
    ops: fields.ops.slice(0, 8),
    note: fields.note.slice(0, 240),
  };
  const [migrated] = loadPlans(JSON.stringify([legacy]));
  assert.equal(migrated.id, legacy.id);
  assert.ok(matchesGuidePlan(migrated, guide));
  const legacyBackup = {
    format: 'weishu-quickref-builds',
    version: 1,
    exportedAt: new Date().toISOString(),
    plans: [legacy],
  };
  assert.deepEqual(parsePlanBackup(JSON.stringify(legacyBackup)).plans, [
    migrated,
  ]);
  const edited = {
    ...legacy,
    ops: legacy.ops.slice(1),
    note: '自己的备注',
    strategy: strategyNames[5],
  };
  const [kept] = loadPlans(JSON.stringify([edited]));
  assert.deepEqual(kept.ops, edited.ops);
  assert.equal(kept.note, edited.note);
  assert.equal(kept.strategy, edited.strategy);
  assert.deepEqual(kept.stages, fields.stages);
  assert.equal(matchesGuidePlan(kept, guide), false);
  const cleared = {...migrated, stages: [], strategyAlternates: []};
  assert.deepEqual(loadPlans(JSON.stringify([cleared])), [cleared]);
  assert.deepEqual(parsePlanBackup(serializePlanBackup([cleared])).plans, [
    cleared,
  ]);
  assert.equal(matchesGuidePlan(cleared, guide), false);
});

test('拉取更新原位更新干净阵容，保留本地改动、本局选择和已保存的新版副本', async () => {
  const records = new Map();
  globalThis.localStorage = {
    getItem: (key) => records.get(key) ?? null,
    setItem: (key, value) => records.set(key, value),
  };
  globalThis.matchMedia = () => ({matches: false});
  const store = await import('../src/quickref/planStore.ts');
  const original = parseSklandResponse(payload, id);
  const key = store.saveGuidePlan({
    ...blankPlan(),
    ...guidePlanFields(original),
    skland: original,
  });
  store.setRun(key);
  assert.equal(store.applyGuideUpdate(key, original).status, 'unchanged');
  const next = {...original, title: '更新', editedAt: '101'};
  assert.deepEqual(store.applyGuideUpdate(key, next), {key, status: 'updated'});
  store.presetOf(key).plan.stages[0].ops[0].eq.push('精准狙击镜');
  assert.equal(
    matchesGuidePlan(
      {
        ...store.presetOf(key).plan,
        ...guidePlanFields(next),
        strategyAlternates: [],
      },
      next,
    ),
    false,
  );
  const latest = {...next, title: '又更新', editedAt: '102'};
  const copy = store.applyGuideUpdate(key, latest);
  assert.equal(copy.status, 'copy');
  assert.notEqual(copy.key, key);
  assert.equal(store.runKey.value, key);
  assert.deepEqual(store.presetOf(key).plan.stages[0].ops[0].eq, [
    '精准狙击镜',
  ]);
  assert.equal(store.applyGuideUpdate(key, latest).key, copy.key);
  assert.equal(loadPlans(records.get('wsq.plans')).length, 2);
});
