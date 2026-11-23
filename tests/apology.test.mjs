import assert from 'node:assert/strict';
import test from 'node:test';
import {COVENANTS, OPERATOR} from '../data/index.ts';
import {
  APOLOGY_TEMPLATES,
  APOLOGY_TEMPLATE_LIST,
  LEAK_SCALES,
  buildApologyDocument,
  buildScenePresets,
  createDefaultApologyState,
  formatApologyText,
  randomizeApologyState,
  switchApologyTemplate,
} from '../src/lib/apology/index.ts';

function createSeededRand(seed = 42) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

test('both templates show only checked reasons and pledges, stay single-match scoped, and avoid forbidden wording', () => {
  const fixedDate = new Date(2026, 10, 23);
  for (const scale of LEAK_SCALES) {
    assert.equal(scale.includes('对不起'), false);
  }
  for (const meta of APOLOGY_TEMPLATE_LIST) {
    const state = createDefaultApologyState(meta.id, {
      now: fixedDate,
      rand: createSeededRand(7),
    });
    state.recipient = '老张';
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
    // 未勾选的原因不应出现在成文中
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
  assert.equal(text.includes('贪图利息'), false);
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
  assert.equal(switched.buildText, initial.covenant);
  assert.deepEqual(switched.checkedReasons, [
    ...APOLOGY_TEMPLATES.application.defaultReasons,
  ]);
  assert.ok(switched.docNo.startsWith('RI-SQ-20261123-'));
});

test('randomizeApologyState produces deterministic valid season entities and checked items', () => {
  const fixedDate = new Date(2026, 10, 23);
  const scenes = buildScenePresets();
  assert.ok(scenes.length >= 4);

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
    if (meta.id === 'application') {
      assert.equal(a.scene, '');
    }
    if (a.operator) {
      assert.ok(Object.hasOwn(OPERATOR, a.operator));
    }
    assert.ok(a.checkedReasons.length >= 2 && a.checkedReasons.length <= 4);
    assert.ok(a.checkedPledges.length >= 2 && a.checkedPledges.length <= 4);
  }
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
