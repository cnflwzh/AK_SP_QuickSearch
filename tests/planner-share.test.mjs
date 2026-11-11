import assert from 'node:assert/strict';
import test from 'node:test';
import { deflateSync } from 'fflate';
import { ALL_COVENANTS, BUILD_NAMES, buildByName, EQUIPMENT, OPERATORS, STRATEGIES } from '../data/index.ts';
import { decodePlan, encodePlan, newSlot, shareUrl, usesLayers } from '../src/lib/planner.ts';
import { BitReader, BitWriter, packSharePayload, readShareText, unpackSharePayload, writeShareText } from '../src/lib/shareCodec.ts';
import { TEXT_CODE_GROUPS } from '../src/lib/shareTextCodebook.ts';

const layerNames = ALL_COVENANTS.filter(usesLayers);
const empty = () => ({ name: '', note: '', ops: [], strategy: '', layers: {} });
const base64 = bytes => Buffer.from(bytes).toString('base64url');
function roundTrip(plan) {
  const code = encodePlan(plan);
  assert.match(code, /^WS[ABCEFG][A-Za-z0-9_-]+$/);
  assert.deepEqual(decodePlan(code)?.plan, plan);
  return code;
}

test('built-in lineups and every operator, equipment and strategy survive sharing', () => {
  roundTrip(empty());
  for (const name of BUILD_NAMES) {
    const build = buildByName(name);
    roundTrip({ ...empty(), name, note: build.tagline, strategy: build.strategies[0] ?? '', ops: build.lineup.map(newSlot) });
  }
  for (const op of OPERATORS) roundTrip({ ...empty(), ops: [newSlot(op.name)] });
  for (const item of EQUIPMENT) {
    for (const eq of [[item.name], [item.name, item.name]]) {
      roundTrip({ ...empty(), ops: [{ ...newSlot(OPERATORS[0].name), elite: true, eq }] });
    }
  }
  for (const strategy of STRATEGIES) roundTrip({ ...empty(), strategy: strategy.name });
});

test('full roster preserves order, elite flags, two equipment and three alternates', () => {
  const plan = {
    ...empty(), name: '满编测试', note: '每个干员的装备、备选和精锐状态都应保留。',
    ops: OPERATORS.slice(0, 8).map((op, i) => ({
      name: op.name, elite: i % 2 === 0,
      eq: EQUIPMENT.slice(i * 2, i * 2 + 2).map(e => e.name),
      alt: OPERATORS.slice(8 + i * 3, 11 + i * 3).map(o => o.name),
    })),
    strategy: STRATEGIES.at(-1).name,
    layers: Object.fromEntries(layerNames.map(name => [name, 9999])),
  };
  const original = structuredClone(plan);
  roundTrip(plan);
  assert.deepEqual(plan, original, 'encoding must not mutate the saved plan');
});

test('sparse and dense layers preserve values at every bit-width boundary', () => {
  for (let count = 1; count <= layerNames.length; count++) {
    for (const value of [1, 2, 3, 127, 128, 255, 256, 1023, 1024, 8191, 8192, 9999]) {
      roundTrip({ ...empty(), layers: Object.fromEntries(layerNames.slice(0, count).map((name, i) => [name, i % 2 ? 1 : value])) });
    }
  }
});

test('spaces, newlines, BOM, rare characters, emoji and lone UTF-16 surrogates are lossless', () => {
  const texts = ['  前排阻挡\n后排输出\t ', '\ufeff开场保留 BOM', '😀🦉𠮷e\u0301\u200d', '\ud800X\udfff', '\0\r\n\t\u007f', '说明'.repeat(75)];
  for (const note of texts) roundTrip({ ...empty(), name: '  阵容😀\n', note });
  const chars = TEXT_CODE_GROUPS.map(([, chars]) => chars).join('') + '𠮷😀\ud800';
  for (let i = 0; i < chars.length; i += 150) roundTrip({ ...empty(), note: chars.slice(i, i + 150) });
  roundTrip({ ...empty(), name: '😀'.repeat(8), note: '😀'.repeat(75) });
});

test('all text encodings work at unaligned bit positions', () => {
  for (const mode of [0, 1, 2]) {
    for (let offset = 0; offset < 8; offset++) {
      const text = '\ufeff 炎队\n策略😀𠮷';
      const writer = new BitWriter();
      writer.write(0, offset);
      assert.equal(writeShareText(writer, text, mode), true);
      const reader = new BitReader(writer.finish());
      reader.read(offset);
      assert.equal(readShareText(reader, text.length, mode), text);
    }
  }
  assert.equal(writeShareText(new BitWriter(), '\ud800', 0), false);
});

test('raw and compressed payloads work for all three text modes', () => {
  for (const mode of [0, 1, 2]) {
    for (const bytes of [Uint8Array.of(7, 119, 251), new Uint8Array(768).fill(42)]) {
      const token = packSharePayload(bytes, mode);
      assert.equal(token[0], (bytes.length === 3 ? 'ABC' : 'EFG')[mode]);
      const { reader, mode: decodedMode } = unpackSharePayload(token);
      assert.equal(decodedMode, mode);
      assert.deepEqual(Uint8Array.from(bytes, () => reader.read(8)), bytes);
      reader.finish();
    }
  }
});

test('share codes, full links, fragments and copied text resolve to the same plan', () => {
  const plan = { ...empty(), name: '链接导入', ops: [newSlot(OPERATORS[0].name)], note: '保留说明\n😀' };
  const code = roundTrip(plan);
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'location');
  try {
    Object.defineProperty(globalThis, 'location', { configurable: true, value: { origin: 'https://sp.enjoyacg.com', pathname: '/' } });
    const url = shareUrl(code);
    assert.equal(url, `https://sp.enjoyacg.com/#p=${code.slice(2)}`);
    for (const input of [url, new URL(url).hash, `阵容分享：${url}\n`, ` ${code}\n`]) assert.deepEqual(decodePlan(input)?.plan, plan);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'location', descriptor);
    else delete globalThis.location;
  }
});

test('500 reproducible mixed lineups round-trip without information loss', () => {
  let seed = 0x5a17c0de;
  const random = n => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) % n);
  const chars = [...'前排治疗核心盟约层数装备选择 abc123😀𠮷\n\t'];
  const text = length => Array.from({ length }, () => chars[random(chars.length)]).join('').slice(0, length);
  for (let run = 0; run < 500; run++) {
    const chosen = [];
    while (chosen.length < 8) { const name = OPERATORS[random(OPERATORS.length)].name; if (!chosen.includes(name)) chosen.push(name); }
    const pool = OPERATORS.filter(op => !chosen.includes(op.name));
    const ops = chosen.slice(0, random(9)).map(name => {
      const alt = [];
      const count = random(4);
      while (alt.length < count) { const candidate = pool[random(pool.length)].name; if (!alt.includes(candidate)) alt.push(candidate); }
      return { name, elite: !!random(2), eq: Array.from({ length: random(3) }, () => EQUIPMENT[random(EQUIPMENT.length)].name), alt };
    });
    roundTrip({ name: text(random(17)), note: text(random(151)), ops,
      strategy: random(3) ? STRATEGIES[random(STRATEGIES.length)].name : '',
      layers: Object.fromEntries(layerNames.filter(() => random(3) === 0).map(name => [name, random(9999) + 1])),
    });
  }
});

test('truncated codes and extra payload bytes are rejected', () => {
  for (const note of ['前排阻挡，后排治疗😀', '核心站位与过渡说明'.repeat(15)]) {
    const code = roundTrip({ ...empty(), name: '截断检查', ops: [newSlot(OPERATORS[0].name)], note });
    for (let i = 0; i < code.length; i++) assert.equal(decodePlan(code.slice(0, i)), null, `truncation at ${i}`);
    const bytes = Buffer.from(code.slice(3), 'base64url');
    assert.equal(decodePlan(`${code.slice(0, 3)}${base64(Buffer.concat([bytes, Buffer.from([0])]))}`), null);
  }
  for (const input of ['', 'not a code', 'WSDAAA', 'WSHAAA', 'WSAAAAAA', 'WSA' + 'A'.repeat(4096)]) assert.equal(decodePlan(input), null);
  assert.throws(() => unpackSharePayload('AAB'), /padding/);
});

test('out-of-range roster fields are rejected instead of partially imported', () => {
  const malformed = (count, strategy, nameLength, noteLength, tail = () => {}) => {
    const writer = new BitWriter();
    writer.write(count, 4); writer.write(strategy, 6); writer.write(nameLength, 5); writer.write(noteLength, 8);
    tail(writer);
    return 'WS' + packSharePayload(writer.finish(), 1);
  };
  for (const code of [
    malformed(9, 0, 0, 0), malformed(0, 63, 0, 0), malformed(0, 0, 17, 0), malformed(0, 0, 0, 151),
    malformed(1, 0, 0, 0, w => w.write(255, 8)),
    malformed(1, 0, 0, 0, w => { w.write(0, 8); w.write(0, 1); w.write(1, 2); w.write(0, 2); w.write(127, 7); }),
  ]) assert.equal(decodePlan(code), null);
});

test('decompression limit and noncanonical compressed tails are enforced', () => {
  for (const length of [769, 2 * 1024 * 1024]) {
    const oversized = 'E' + base64(deflateSync(new Uint8Array(length), { level: 9, mem: 4 }));
    assert.throws(() => unpackSharePayload(oversized));
  }
  const compressed = packSharePayload(new Uint8Array(768), 0);
  const body = Buffer.from(compressed.slice(1), 'base64url');
  assert.throws(() => unpackSharePayload(compressed[0] + base64(Buffer.concat([body, Buffer.from([0])]))), /Noncanonical/);
  assert.throws(() => packSharePayload(new Uint8Array(769), 0), /large/);
});
