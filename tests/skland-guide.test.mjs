import assert from 'node:assert/strict';
import test from 'node:test';
import {OPERATORS, SEASON_META, STRATEGY} from '../data/index.ts';
import {blankPlan, loadPlans} from '../src/lib/plans/storage.ts';
import {parsePlanBackup, serializePlanBackup} from '../src/lib/plans/backup.ts';
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
