import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {
  EXCUSE_CATEGORIES,
  EXCUSE_SUBMIT_URL,
  EXCUSES,
  pickRandomExcuse,
} from '../src/quickref/numbers/excuseData.ts';

test('copypasta catalog has authentic category items, unique ids, and clean copy', () => {
  assert.equal(EXCUSE_SUBMIT_URL, 'https://wj.qq.com/s2/28706504/dfoc/');
  assert.deepEqual(
    EXCUSE_CATEGORIES.map((item) => [item.id, item.label]),
    [
      ['all', '全部'],
      ['twist', '情感反转'],
      ['mania', '发病文学'],
      ['excuse', '嘴硬甩锅'],
    ],
  );
  assert.ok(
    EXCUSES.length >= 75,
    `Expected >= 75 copypastas, got ${EXCUSES.length}`,
  );

  const validCats = new Set(['twist', 'mania', 'excuse']);
  const counts = {twist: 0, mania: 0, excuse: 0};
  const ids = new Set();
  const texts = new Set();
  const banned =
    /滞销|退货|批发|清仓|假货|以次充好|凑单|凑数|混子|南郭|滥竽|疯狗|旱鸭|脆皮|笨重|慢动作|污秽|口粮|废铁|白嫖|歪牌|坏牌|质检|误伤|买错牌|退掉|踢出|踢掉|踹|赶出|冷门|可露希尔|：「/;
  const forbiddenArtifact = /扣\s*1|疯狂星期四|疯四|v\s*我\s*50|肯德基|kfc/i;

  for (const cat of EXCUSE_CATEGORIES) {
    assert.ok(!forbiddenArtifact.test(cat.label), `Bad category: ${cat.label}`);
  }

  for (const item of EXCUSES) {
    assert.ok(item.id);
    assert.ok(!ids.has(item.id), `Duplicate id: ${item.id}`);
    ids.add(item.id);
    assert.equal(
      'title' in item,
      false,
      `Unexpected title property on ${item.id}`,
    );

    assert.ok(
      validCats.has(item.category),
      `Invalid category: ${item.category}`,
    );
    counts[item.category] += 1;

    const text = item.text.trim();
    assert.ok(
      text.length >= 28,
      `Copypasta too short (${item.id}, ${text.length} chars): ${text}`,
    );
    assert.ok(!texts.has(text), `Duplicate text: ${item.id}`);
    texts.add(text);

    assert.ok(!banned.test(text), `Unexpected phrase in ${item.id}: ${text}`);
    assert.ok(
      !forbiddenArtifact.test(text),
      `Forbidden phrase in ${item.id}: ${text}`,
    );
  }

  assert.ok(counts.twist >= 30, `twist count too low: ${counts.twist}`);
  assert.ok(counts.mania >= 25, `mania count too low: ${counts.mania}`);
  assert.ok(counts.excuse >= 20, `excuse count too low: ${counts.excuse}`);

  for (const snippet of [
    '你用情头的时候我差点没喘过来气 我手抖得厉害 眼泪在眼睛里打转',
    '我们先谈恋爱 再互相了解好吗 这样你就可以让我陪你 做一切你想做的事情了',
    '卫戍协议的寿命只有40天，人类的寿命有70-100年，卫戍协议只是人类眼中小小的过客，但对卫戍协议来说你就是它的一生，所以放下身边的杂活，多陪陪卫戍协议',
    '其实我的实力和你差不多 只是我有时候网卡 卡键 手抖 误触 帧率低 高延迟',
    '和我玩卫戍协议的队友听好了如果不是我没叠起来你能抢到这个播报吗？还不谢谢我？为了满足你的救世主情结我可是很用心的在堕落了啊！',
  ]) {
    assert.ok(
      EXCUSES.some((item) => item.text.includes(snippet)),
      `Missing expected copypasta: ${snippet}`,
    );
  }

  const vueSource = readFileSync(
    new URL('../src/quickref/numbers/ExcuseTools.vue', import.meta.url),
    'utf8',
  );
  assert.ok(
    !forbiddenArtifact.test(vueSource),
    'Forbidden phrase in ExcuseTools.vue',
  );
  assert.ok(vueSource.includes(':href="EXCUSE_SUBMIT_URL"'));
  assert.ok(vueSource.includes('target="_blank"'));
  assert.ok(vueSource.includes('rel="noopener noreferrer"'));
});

test('pickRandomExcuse skips the previous item and handles edge cases', () => {
  const first = pickRandomExcuse(EXCUSES, EXCUSES[0].id, () => 0);
  assert.ok(first);
  assert.notEqual(first.id, EXCUSES[0].id);

  assert.equal(
    pickRandomExcuse([], undefined, () => 0),
    undefined,
  );
  assert.equal(
    pickRandomExcuse([EXCUSES[0]], EXCUSES[0].id, () => 0)?.id,
    EXCUSES[0].id,
  );
});
