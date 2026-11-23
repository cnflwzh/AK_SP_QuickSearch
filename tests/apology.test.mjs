import assert from 'node:assert/strict';
import test from 'node:test';
import {COVENANTS, OPERATOR, SEASON_META} from '../data/index.ts';
import {
  APOLOGY_TEMPLATES,
  APOLOGY_TEMPLATE_LIST,
  LEAK_SCALES,
  buildApologyDocument,
  buildScenePresets,
  createDefaultApologyState,
  formatApologyText,
  randomizeApologyState,
  renderPresetOpening,
  switchApologyTemplate,
} from '../src/lib/apology/index.ts';

function createSeededRand(seed = 42) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

test('scene presets and leak scales respect real season round limits and ~25 HP scale', () => {
  const scenes = buildScenePresets();
  assert.ok(scenes.length >= 6);
  const maxRound = SEASON_META.roundLimits.standard;
  for (const scene of scenes) {
    assert.equal(scene.includes(`第 ${maxRound + 1}`), false);
    assert.equal(scene.includes('第 15'), false);
  }
  for (const scale of LEAK_SCALES) {
    assert.equal(scale.includes('对不起'), false);
    assert.equal(scale.includes('20–50'), false);
  }
});

test('both templates support multiple opening presets, manual override, and avoid forbidden wording', () => {
  const fixedDate = new Date(2026, 10, 23);
  for (const meta of APOLOGY_TEMPLATE_LIST) {
    assert.ok(meta.openingPresets.length >= 5);
    const state = createDefaultApologyState(meta.id, {
      now: fixedDate,
      rand: createSeededRand(7),
    });
    state.recipient = '老张';

    // 切换不同正文模板时应实时生成对应文案且无未替换占位符
    for (const preset of meta.openingPresets) {
      const rendered = renderPresetOpening({...state, openingId: preset.id});
      assert.ok(rendered.length > 20);
      assert.equal(rendered.includes('{'), false);
      assert.equal(rendered.includes('对不起'), false);
    }

    // 自定义手写正文应覆盖预设
    const customDoc = buildApologyDocument({
      ...state,
      customOpening: '这一段是我自己写的正经说明。',
    });
    assert.equal(customDoc.opening, '这一段是我自己写的正经说明。');

    const doc = buildApologyDocument(state);
    assert.equal(doc.template, meta.id);
    assert.equal(doc.dateText, '2026-11-23');
    assert.ok(doc.docNo.startsWith(`${meta.docPrefix}-20261123-`));
    assert.ok(doc.reasons.some((item) => item.checked));
    assert.ok(doc.pledges.some((item) => item.checked));
    assert.ok(doc.pledges.some((item) => item.text.includes('老张')));
    assert.equal(doc.signature, state.applicant);
    assert.ok(doc.fileName.endsWith('-20261123.png'));

    const text = formatApologyText(doc);
    assert.ok(text.includes(`【${doc.issuer}】`));
    assert.ok(text.includes(`《${doc.title}》`));
    assert.ok(text.includes('1. '));
    for (const reason of doc.reasons) {
      assert.equal(text.includes(reason.text), reason.checked);
    }
    assert.equal(text.includes('公证人'), false);
    assert.equal(text.includes('本人声明以上'), false);
    assert.equal(text.includes('自本局起'), false);
    assert.equal(text.includes('对不起'), false);
    assert.equal(text.includes('{recipient}'), false);
    for (const q of meta.sampleQuotes) {
      assert.equal(q.includes('对不起'), false);
    }
    for (const r of meta.reasons) {
      assert.equal(r.text.includes('对不起'), false);
    }
    for (const p of meta.pledges) {
      assert.equal(p.text.includes('对不起'), false);
    }
  }
});

test('custom reasons and custom pledges append cleanly and only selected items appear', () => {
  const state = createDefaultApologyState('apology', {
    now: new Date(2026, 10, 23),
    rand: createSeededRand(5),
  });
  state.checkedReasons = ['bad-draws', 'network-lag'];
  state.customReasons = '外卖正好到了去拿了一下\n  猫咪踩到了快捷键  ';
  state.customPledges = '下波先把外卖放桌上再打';

  const doc = buildApologyDocument(state);
  const checkedReasons = doc.reasons.filter((item) => item.checked);
  assert.equal(checkedReasons.length, 4);

  const text = formatApologyText(doc);
  assert.ok(text.includes('发牌'));
  assert.ok(text.includes('网络'));
  assert.ok(text.includes('外卖正好到了去拿了一下'));
  assert.ok(text.includes('猫咪踩到了快捷键'));
  assert.ok(text.includes('下波先把外卖放桌上再打'));
  const unselected = doc.reasons.find((reason) => reason.id === 'greed-level');
  assert.equal(text.includes(unselected.text), false);
});

test('switchApologyTemplate keeps custom user fields while swapping template defaults', () => {
  const initial = createDefaultApologyState('apology', {
    now: new Date(2026, 10, 23),
    rand: createSeededRand(11),
  });
  initial.applicant = '阿能没开技能博士';
  initial.recipient = '带我飞的群友';
  initial.customQuote = '这是我自己写的专属备注';
  initial.customReasons = '顺手多刷了两下商店';
  initial.openingId = 'bounty';
  initial.customOpening = '赏金怪说它赶时间。';

  const switched = switchApologyTemplate(initial, 'application', {
    now: new Date(2026, 10, 23),
    rand: createSeededRand(13),
  });

  assert.equal(switched.template, 'application');
  assert.equal(switched.applicant, '阿能没开技能博士');
  assert.equal(switched.recipient, '带我飞的群友');
  assert.equal(switched.customQuote, '这是我自己写的专属备注');
  assert.equal(switched.customReasons, '顺手多刷了两下商店');
  assert.equal(switched.scene, '');
  assert.equal(
    switched.openingId,
    APOLOGY_TEMPLATES.application.defaultOpeningId,
  );
  assert.equal(switched.customOpening, null);
  assert.equal(switched.buildText, initial.covenant);
  assert.deepEqual(switched.checkedReasons, [
    ...APOLOGY_TEMPLATES.application.defaultReasons,
  ]);
  assert.ok(switched.docNo.startsWith('RI-SQ-20261123-'));

  switched.openingId = 'shop-led';
  switched.customOpening = '';
  const back = switchApologyTemplate(switched, 'apology');
  assert.equal(back.openingId, initial.openingId);
  assert.equal(back.customOpening, initial.customOpening);
  const application = switchApologyTemplate(back, 'application');
  assert.equal(application.openingId, 'shop-led');
  const doc = buildApologyDocument(application);
  assert.equal(doc.opening, '');
  assert.equal(
    formatApologyText(doc).includes(renderPresetOpening(application)),
    false,
  );
});

test('template placeholders preserve nicknames containing substitution characters', () => {
  const state = createDefaultApologyState('apology');
  state.applicant = '博士$&{recipient}';
  state.recipient = '群友$&{date}';

  const doc = buildApologyDocument(state);
  assert.ok(doc.opening.includes(state.applicant));
  assert.ok(doc.opening.includes(state.recipient));
  assert.ok(doc.pledges.some((item) => item.text.includes(state.recipient)));
});

test('randomizeApologyState produces deterministic valid season entities and opening presets', () => {
  const fixedDate = new Date(2026, 10, 23);

  for (const meta of APOLOGY_TEMPLATE_LIST) {
    const a = randomizeApologyState(meta.id, {
      now: fixedDate,
      rand: createSeededRand(99),
    });
    const b = randomizeApologyState(meta.id, {
      now: fixedDate,
      rand: createSeededRand(99),
    });
    assert.deepEqual(a, b);
    assert.ok(a.covenant && Object.hasOwn(COVENANTS, a.covenant));
    assert.ok(a.buildText.length > 0);
    assert.ok(meta.openingPresets.some((p) => p.id === a.openingId));
    if (meta.id === 'application') {
      assert.equal(a.scene, '');
    }
    if (a.operator) {
      assert.ok(Object.hasOwn(OPERATOR, a.operator));
    }
    assert.ok(a.checkedReasons.length >= 2 && a.checkedReasons.length <= 4);
    assert.ok(a.checkedPledges.length >= 2 && a.checkedPledges.length <= 3);
  }
});

test('randomized apologies pair the leak and opening with the selected encounter', () => {
  const rand = createSeededRand(22);
  const encounters = new Set();
  for (let i = 0; i < 100; i++) {
    const state = randomizeApologyState('apology', {rand});
    const encounter = /领袖|隐秘核心/.test(state.scene)
      ? 'boss'
      : state.scene.includes('悬赏')
        ? 'bounty'
        : 'regular';
    encounters.add(encounter);
    assert.equal(state.leakScale.includes('领袖'), encounter === 'boss');
    assert.equal(state.leakScale.includes('赏金'), encounter === 'bounty');
    const preset = APOLOGY_TEMPLATES.apology.openingPresets.find(
      (item) => item.id === state.openingId,
    );
    if (preset.encounter) assert.equal(preset.encounter, encounter);
  }
  assert.equal(encounters.size, 3);
});

test('buildApologyDocument falls back cleanly on blank fields and supports custom build names in application', () => {
  const state = createDefaultApologyState('application', {
    now: new Date(2026, 10, 23),
    rand: createSeededRand(3),
  });
  state.applicant = '   ';
  state.recipient = '';
  state.signature = '';
  state.customQuote = '';

  const customDoc = buildApologyDocument({
    ...state,
    buildText: '电表倒转科研流',
    operator: '',
  });
  assert.equal(
    customDoc.signature,
    APOLOGY_TEMPLATES.application.defaultApplicant,
  );
  assert.equal(customDoc.title, '关于游玩「电表倒转科研流」的使用申请书');
  assert.equal(customDoc.targetBadge?.kind, 'build');
  assert.equal(customDoc.targetBadge?.name, '电表倒转科研流');
  assert.equal(
    customDoc.metaRows.some((r) => r.label.includes('场次')),
    false,
  );
  assert.deepEqual(customDoc.closingLines, ['妥否，请批示。']);
  const customText = formatApologyText(customDoc);
  assert.ok(customText.includes('妥否，请批示。'));
  assert.equal(customText.includes('「」'), false);

  const covDoc = buildApologyDocument({
    ...state,
    buildText: state.covenant,
    operator: '',
  });
  assert.equal(covDoc.targetBadge?.kind, 'covenant');
  assert.equal(covDoc.targetBadge?.name, state.covenant);
});
