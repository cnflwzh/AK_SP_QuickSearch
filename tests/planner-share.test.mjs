import assert from 'node:assert/strict';
import test from 'node:test';
import {deflateSync} from 'fflate';
import {
  ALL_COVENANTS,
  BUILD_NAMES,
  buildByName,
  EQUIPMENT,
  OPERATORS,
  STRATEGIES,
} from '../data/index.ts';
import {
  MAX_NOTE,
  decodePlan,
  encodePlan,
  formatPlanShareText,
  newSlot,
  shareUrl,
  usesLayers,
} from '../src/lib/plans/index.ts';
import {
  BitWriter,
  packSharePayload,
  unpackSharePayload,
} from '../src/lib/plans/shareCodec.ts';
import {TEXT_CODE_GROUPS} from '../src/lib/plans/shareTextCodebook.ts';
import {canShareViaQr} from '../src/lib/plans/sharing.ts';

const layerNames = ALL_COVENANTS.filter(usesLayers);
const empty = () => ({name: '', note: '', ops: [], strategy: '', layers: {}});
const base64 = (bytes) => Buffer.from(bytes).toString('base64url');
function roundTrip(plan) {
  const code = encodePlan(plan);
  assert.match(code, /^WS[ABCEFGIJKMNOQRSUVWYZacde][A-Za-z0-9_-]+$/);
  assert.deepEqual(decodePlan(code)?.plan, plan);
  return code;
}

test('built-in lineups and every operator, equipment and strategy survive sharing', () => {
  roundTrip(empty());
  for (const name of BUILD_NAMES) {
    const build = buildByName(name);
    roundTrip({
      ...empty(),
      name,
      note: build.tagline,
      strategy: build.strategies[0] ?? '',
      ops: build.lineup.map(newSlot),
    });
  }
  for (const op of OPERATORS) roundTrip({...empty(), ops: [newSlot(op.name)]});
  for (const item of EQUIPMENT) {
    for (const eq of [[item.name], [item.name, item.name]]) {
      roundTrip({
        ...empty(),
        ops: [{...newSlot(OPERATORS[0].name), elite: true, eq}],
      });
    }
  }
  for (const strategy of STRATEGIES)
    roundTrip({...empty(), strategy: strategy.name});
});

test('full roster preserves order, elite and core flags, two equipment and three alternates', () => {
  const plan = {
    ...empty(),
    name: '满编测试',
    note: '每个干员的装备、备选和精锐状态都应保留。',
    ops: OPERATORS.slice(0, 8).map((op, i) => ({
      name: op.name,
      elite: i % 2 === 0,
      core: i % 3 === 0,
      eq: EQUIPMENT.slice(i * 2, i * 2 + 2).map((e) => e.name),
      alt: OPERATORS.slice(8 + i * 3, 11 + i * 3).map((o) => o.name),
    })),
    strategy: STRATEGIES.at(-1).name,
    layers: Object.fromEntries(layerNames.map((name) => [name, 9999])),
  };
  const original = structuredClone(plan);
  roundTrip(plan);
  assert.deepEqual(plan, original, 'encoding must not mutate the saved plan');
});

test('published eight-member, 240-unit share code remains byte-for-byte stable', () => {
  // 原协议在扩容前生成的码，覆盖 core、重复装备、备选和 UTF-16 说明边界。
  const code =
    'WSNa_B8wNDAw-DGyNyiIMAQwdjA3nD63JMJdw_901VQWLtnhaDSbMHuDdV7GEd5w40HAA';
  const names = [
    '阿米娅',
    'W',
    '艾丝黛尔',
    '蓝毒',
    '星源',
    '拉普兰德',
    '幽灵鲨',
    '蛇屠箱',
  ];
  const plan = {
    ...empty(),
    name: '旧版满编',
    strategy: '阿米娅',
    note: '逐回合配装😀'.repeat(40).slice(0, 240),
    ops: names.map((name, i) => ({
      ...newSlot(name),
      core: i === 0,
      elite: i % 2 === 1,
      eq: i === 2 ? ['维式重锤', '维式重锤'] : [],
      alt: i === 3 ? ['华法琳'] : [],
    })),
  };
  assert.equal(encodePlan(plan), code);
  assert.deepEqual(decodePlan(`/#p=${code.slice(2)}`)?.plan, plan);
});

test('extended shares preserve 20 editable slots per stage and ordered strategy alternatives', () => {
  const ops = OPERATORS.slice(0, 20).map((op, i) => ({
    ...newSlot(op.name),
    core: i % 3 === 0,
    elite: i % 2 === 0,
    eq: [EQUIPMENT[i].name, EQUIPMENT[i].name],
    alt: OPERATORS.slice(20 + i, 23 + i).map((o) => o.name),
  }));
  const note = '\ud800 前排😀\n'.repeat(350).slice(0, MAX_NOTE);
  const early = {
    from: 1,
    to: 3,
    ops: structuredClone(ops).reverse(),
    layers: {[layerNames[0]]: 9999},
    note,
  };
  const late = {
    ...structuredClone(early),
    from: 90,
    to: 99,
    note: '另一个方案：/#p=AAAAA',
  };
  late.ops[0].eq = [];
  const plan = {
    ...empty(),
    name: '分段分享',
    note,
    ops,
    strategy: STRATEGIES[0].name,
    strategyAlternates: STRATEGIES.slice(1, 5).map((s) => s.name),
    stages: [early, late],
    layers: {[layerNames[0]]: 123},
  };
  const code = roundTrip(plan);
  const guide = formatPlanShareText(plan);
  assert.match(guide, /备选策略：/);
  assert.match(guide, /【第 1–3 回合】/);
  assert.match(guide, /【终盘阵容】/);
  assert.deepEqual(decodePlan(guide)?.plan, plan);
  const decoded = decodePlan(`https://example.org/#p=${code.slice(2)}`).plan;
  decoded.stages[0].ops[0].eq.pop();
  assert.deepEqual(decoded.ops.at(-1).eq, ops.at(-1).eq);
  assert.equal(decodePlan(code.slice(0, -1)), null);
});

test('largest supported round set and long incompressible notes have a complete non-QR share', () => {
  let state = 12345;
  const nextNote = () =>
    Array.from({length: MAX_NOTE}, () => {
      state = (Math.imul(1664525, state) + 1013904223) >>> 0;
      return String.fromCharCode(0x4e00 + (state % 20000));
    }).join('');
  const plan = {
    ...empty(),
    note: nextNote(),
    stages: Array.from({length: 99}, (_, i) => ({
      from: i + 1,
      to: i + 1,
      ops: [],
      layers: {},
      note: nextNote(),
    })),
  };
  const code = encodePlan(plan);
  assert.ok(code.length > 65536, 'exercise chunked base64 conversion');
  assert.equal(canShareViaQr(`https://example.org/#p=${code.slice(2)}`), false);
  const restored = decodePlan(code)?.plan;
  assert.equal(restored?.note, plan.note);
  assert.equal(restored.stages.length, 99);
  assert.ok(
    restored.stages.every(
      (stage, i) =>
        stage.from === i + 1 &&
        stage.to === i + 1 &&
        stage.note === plan.stages[i].note,
    ),
  );
  assert.equal(canShareViaQr('a'.repeat(2331)), true);
  assert.equal(canShareViaQr('a'.repeat(2332)), false);
  assert.equal(canShareViaQr(''), false);
});

test('extended codes reject invalid ranges, oversized lineups and incorrect member references', () => {
  const plan = empty();
  const stage = {from: 1, to: 2, ops: [], note: '', layers: {}};
  assert.throws(() =>
    encodePlan({...plan, stages: [stage, {...stage, from: 2}]}),
  );
  assert.throws(() =>
    encodePlan({...plan, stages: [{...stage, note: 'a'.repeat(MAX_NOTE + 1)}]}),
  );
  const malformed = (count, noteLength, tail = () => {}) => {
    const writer = new BitWriter();
    writer.write(0, 5); // Name, primary strategy, alternatives, stages
    writer.write(0, 6);
    writer.write(0, 3);
    writer.write(0, 7);
    writer.write(noteLength, 11);
    writer.write(count, 5);
    tail(writer);
    return 'WS' + packSharePayload(writer.finish(), 1, false, true);
  };
  assert.equal(decodePlan(malformed(21, 0)), null);
  assert.equal(decodePlan(malformed(0, MAX_NOTE + 1)), null);
  assert.equal(decodePlan(malformed(1, 0, (w) => w.write(1, 1))), null);
});

test('sparse and dense layers preserve values at every bit-width boundary', () => {
  for (let count = 1; count <= layerNames.length; count++) {
    for (const value of [
      1, 2, 3, 127, 128, 255, 256, 1023, 1024, 8191, 8192, 9999,
    ]) {
      roundTrip({
        ...empty(),
        layers: Object.fromEntries(
          layerNames
            .slice(0, count)
            .map((name, i) => [name, i % 2 ? 1 : value]),
        ),
      });
    }
  }
});

test('spaces, newlines, BOM, rare characters, emoji and lone UTF-16 surrogates are lossless', () => {
  const texts = [
    '  前排阻挡\n后排输出\t ',
    '\ufeff开场保留 BOM',
    '😀🦉𠮷e\u0301\u200d',
    '\ud800X\udfff',
    '\0\r\n\t\u007f',
    '说明'.repeat(MAX_NOTE / 2),
  ];
  for (const note of texts) roundTrip({...empty(), name: '  阵容😀\n', note});
  const chars =
    TEXT_CODE_GROUPS.map(([, chars]) => chars).join('') + '𠮷😀\ud800';
  for (let i = 0; i < chars.length; i += MAX_NOTE)
    roundTrip({...empty(), note: chars.slice(i, i + MAX_NOTE)});
  roundTrip({
    ...empty(),
    name: '😀'.repeat(8),
    note: '😀'.repeat(MAX_NOTE / 2),
  });
  for (const note of [
    '说明'.repeat(MAX_NOTE / 2),
    '龥'.repeat(MAX_NOTE),
    '😀'.repeat(MAX_NOTE / 2),
    '\ud800'.repeat(MAX_NOTE),
  ]) {
    const fullWorstCase = {
      name: '😀'.repeat(8),
      note,
      ops: OPERATORS.slice(0, 8).map((op, i) => ({
        name: op.name,
        elite: i % 2 === 0,
        core: i % 3 === 0,
        eq: EQUIPMENT.slice(i * 2, i * 2 + 2).map((e) => e.name),
        alt: OPERATORS.slice(8 + i * 3, 11 + i * 3).map((o) => o.name),
      })),
      strategy: STRATEGIES.at(-1).name,
      layers: Object.fromEntries(layerNames.map((name) => [name, 9999])),
    };
    roundTrip(fullWorstCase);
  }
});

test('share codes, full links, fragments and copied text resolve to the same plan', () => {
  const plan = {
    ...empty(),
    name: '链接导入',
    ops: [newSlot(OPERATORS[0].name)],
    note: '保留说明\n😀',
  };
  const code = roundTrip(plan);
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'location');
  try {
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: {origin: 'https://sp.enjoyacg.com', pathname: '/builds/yan/edit'},
    });
    const url = shareUrl(code);
    assert.equal(
      new URL(url).pathname,
      '/',
      'sharing always uses the public entry, independent of the editor route',
    );
    assert.equal(url, `https://sp.enjoyacg.com/#p=${code.slice(2)}`);
    for (const input of [
      url,
      new URL(url).hash,
      `阵容分享：${url}\n`,
      ` ${code}\n`,
    ])
      assert.deepEqual(decodePlan(input)?.plan, plan);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'location', descriptor);
    else delete globalThis.location;
  }
});

test('500 reproducible mixed lineups round-trip without information loss', () => {
  let seed = 0x5a17c0de;
  const random = (n) =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) % n;
  const chars = [...'前排治疗核心盟约层数装备选择 abc123😀𠮷\n\t'];
  const text = (length) =>
    Array.from({length}, () => chars[random(chars.length)])
      .join('')
      .slice(0, length);
  for (let run = 0; run < 500; run++) {
    const chosen = [];
    while (chosen.length < 8) {
      const name = OPERATORS[random(OPERATORS.length)].name;
      if (!chosen.includes(name)) chosen.push(name);
    }
    const pool = OPERATORS.filter((op) => !chosen.includes(op.name));
    const ops = chosen.slice(0, random(9)).map((name) => {
      const alt = [];
      const count = random(4);
      while (alt.length < count) {
        const candidate = pool[random(pool.length)].name;
        if (!alt.includes(candidate)) alt.push(candidate);
      }
      return {
        name,
        elite: !!random(2),
        core: !!random(2),
        eq: Array.from(
          {length: random(3)},
          () => EQUIPMENT[random(EQUIPMENT.length)].name,
        ),
        alt,
      };
    });
    roundTrip({
      name: text(random(17)),
      note: text(random(MAX_NOTE + 1)),
      ops,
      strategy: random(3) ? STRATEGIES[random(STRATEGIES.length)].name : '',
      layers: Object.fromEntries(
        layerNames
          .filter(() => random(3) === 0)
          .map((name) => [name, random(9999) + 1]),
      ),
    });
  }
});

test('truncated codes and extra payload bytes are rejected', () => {
  for (const note of [
    '前排阻挡，后排治疗😀',
    '核心站位与过渡说明'.repeat(15),
  ]) {
    const code = roundTrip({
      ...empty(),
      name: '截断检查',
      ops: [newSlot(OPERATORS[0].name)],
      note,
    });
    for (let i = 0; i < code.length; i++)
      assert.equal(decodePlan(code.slice(0, i)), null, `truncation at ${i}`);
    const bytes = Buffer.from(code.slice(3), 'base64url');
    assert.equal(
      decodePlan(
        `${code.slice(0, 3)}${base64(Buffer.concat([bytes, Buffer.from([0])]))}`,
      ),
      null,
    );
  }
  for (const input of [
    '',
    'not a code',
    'WSDAAA',
    'WSHAAA',
    'WSAAAAAA',
    'WSA' + 'A'.repeat(4096),
  ])
    assert.equal(decodePlan(input), null);
  assert.throws(() => unpackSharePayload('AAB'), /padding/);
});

test('out-of-range roster fields are rejected instead of partially imported', () => {
  const malformed = (
    count,
    strategy,
    nameLength,
    noteLength,
    tail = () => {},
  ) => {
    const writer = new BitWriter();
    writer.write(count, 4);
    writer.write(strategy, 6);
    writer.write(nameLength, 5);
    writer.write(noteLength, 8);
    tail(writer);
    return 'WS' + packSharePayload(writer.finish(), 1);
  };
  for (const code of [
    malformed(9, 0, 0, 0),
    malformed(0, 63, 0, 0),
    malformed(0, 0, 17, 0),
    malformed(0, 0, 0, 241),
    malformed(1, 0, 0, 0, (w) => w.write(255, 8)),
    malformed(1, 0, 0, 0, (w) => {
      w.write(0, 8);
      w.write(0, 1);
      w.write(1, 2);
      w.write(0, 2);
      w.write(127, 7);
    }),
  ])
    assert.equal(decodePlan(code), null);
});

test('formatPlanShareText outputs structured card-picking guide and round-trips via decodePlan', () => {
  const byTier = (tier) => OPERATORS.find((op) => op.tier === tier).name;
  const op1 = byTier(1),
    op3 = byTier(3),
    op5 = byTier(5);
  const alt2 = OPERATORS.find(
    (op) => op.tier === 2 && ![op1, op3, op5].includes(op.name),
  ).name;
  const eq = EQUIPMENT[0].name;
  const st = STRATEGIES[0];
  const plan = {
    name: '攻略文本测试',
    ops: [
      {...newSlot(op1), core: false, elite: false, eq: [], alt: []},
      {...newSlot(op3), core: false, elite: true, eq: [eq, eq], alt: []},
      {...newSlot(op5), core: true, elite: false, eq: [], alt: [alt2]},
    ],
    strategy: st.name,
    note: '前期用二阶卡过渡\n五阶主核成型站前排',
    layers: {},
  };

  const withoutLocation = formatPlanShareText(plan);
  assert.match(withoutLocation, /【卫戍流派】攻略文本测试/);
  assert.match(withoutLocation, new RegExp(`策略：${st.name}「${st.skill}」`));
  assert.match(withoutLocation, /前期抓牌\(1-2阶\)：/);
  assert.match(withoutLocation, /中期抓牌\(3-4阶\)：.*精锐/);
  assert.match(withoutLocation, new RegExp(`后期抓牌\\(5-6阶\\)：★${op5}`));
  assert.match(
    withoutLocation,
    new RegExp(`过渡/备选：${alt2}\\(2阶→替${op5}\\)`),
  );
  assert.match(withoutLocation, /1\. 前期用二阶卡过渡/);
  assert.match(withoutLocation, /2\. 五阶主核成型站前排/);
  assert.match(withoutLocation, /分享码：WS/);
  assert.deepEqual(decodePlan(withoutLocation)?.plan, plan);

  const customLink = `https://sp.enjoyacg.com/#p=${encodePlan(plan).slice(2)}`;
  const withLink = formatPlanShareText(plan, customLink);
  assert.match(withLink, /导入链接：https:\/\/sp\.enjoyacg\.com\/#p=/);
  assert.deepEqual(decodePlan(withLink)?.plan, plan);
});

test('decompression limit and noncanonical compressed tails are enforced', () => {
  for (const length of [769, 2 * 1024 * 1024]) {
    const oversized =
      'E' + base64(deflateSync(new Uint8Array(length), {level: 9, mem: 4}));
    assert.throws(() => unpackSharePayload(oversized));
  }
  const compressed = packSharePayload(new Uint8Array(768), 0);
  const body = Buffer.from(compressed.slice(1), 'base64url');
  assert.throws(
    () =>
      unpackSharePayload(
        compressed[0] + base64(Buffer.concat([body, Buffer.from([0])])),
      ),
    /Noncanonical/,
  );
  assert.throws(() => packSharePayload(new Uint8Array(769), 0), /large/);
});
