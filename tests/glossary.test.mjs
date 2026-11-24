import assert from 'node:assert/strict';
import test from 'node:test';
import {ENEMY_GLOSSARY} from '../data/index.ts';
import {glossaryHtml} from '../src/lib/ui/glossaryText.ts';
import {
  findGlossaryTerm,
  GLOSSARY_ENTRIES,
  searchGlossary,
  splitGlossaryText,
} from '../src/lib/glossary.ts';

test('攻略简称与敌方词条共用正式名称，商店冻结与战斗状态分别解释', () => {
  assert.equal(findGlossaryTerm('ｄ 牌')?.term, '刷新');
  assert.equal(findGlossaryTerm('眩晕')?.desc, ENEMY_GLOSSARY.晕眩.desc);
  assert.equal(findGlossaryTerm('侵蚀')?.desc, ENEMY_GLOSSARY.侵蚀损伤.desc);
  assert.equal(findGlossaryTerm('冻结商店')?.term, '锁店');
  assert.equal(findGlossaryTerm('冻结')?.desc, ENEMY_GLOSSARY.冻结.desc);
  assert.equal(findGlossaryTerm('constructor'), undefined);
});

test('正文优先匹配完整词，保留空格、标点和用户原文，跳过英文标识符', () => {
  const text =
    '<b>升本</b>\n先Ｄ 牌、再d；主 C防侵蚀损伤、眩晕与三连击。ID/DPS/build_id/2D。';
  const parts = splitGlossaryText(text);
  assert.equal(parts.map((part) => part.text).join(''), text);
  assert.deepEqual(
    parts.filter((part) => part.term).map(({text, term}) => [text, term]),
    [
      ['升本', '升本'],
      ['Ｄ 牌', '刷新'],
      ['d', '刷新'],
      ['主 C', '主C'],
      ['侵蚀损伤', '侵蚀损伤'],
      ['眩晕', '晕眩'],
      ['三连击', '连击'],
    ],
  );
  assert.deepEqual(splitGlossaryText(''), []);
});

test('标注导入的攻略时，排版回调只收到已转义的作者原文', () => {
  const chunks = [];
  const marked = glossaryHtml(
    '<em title="D">升本 & 存钱</em>',
    false,
    (escaped) => {
      chunks.push(escaped);
      return escaped;
    },
  );
  assert.equal(
    chunks.join(''),
    '&lt;em title=&quot;D&quot;&gt;升本 &amp; 存钱&lt;/em&gt;',
  );
  assert.ok(marked.includes('data-glossary-term="升本"'));
  assert.ok(!marked.includes('<em'));
  assert.ok(!marked.includes('tabindex'));
});

test('搜索命中别名、全拼、首字母和释义，并把完整词名排在前面', () => {
  for (const [query, term] of [
    ['shēng běn', '升本'],
    ['sb', '升本'],
    ['shuapai', '刷新'],
    ['qs', '侵蚀损伤'],
    ['眩晕', '晕眩'],
  ]) {
    assert.equal(searchGlossary(query)[0]?.term, term, query);
  }
  assert.deepEqual(
    searchGlossary('d').map((entry) => entry.term),
    ['刷新'],
  );
  assert.ok(
    searchGlossary('永久降低').some((entry) => entry.term === '侵蚀损伤'),
  );
  assert.deepEqual(searchGlossary('永久降低', false), []);
  assert.equal(searchGlossary('shuapai', false)[0]?.term, '刷新');
  assert.deepEqual(searchGlossary(' '), GLOSSARY_ENTRIES);
  assert.deepEqual(searchGlossary('zzzzzz'), []);
});

test('区分联机场景、运营路线和招募动作，按原样标注带数字的攻略', () => {
  const advice = '卖血速6，存对子等碰 5；优先经济牌，联防让队友兜怪。';
  const parts = splitGlossaryText(advice);
  assert.equal(parts.map((part) => part.text).join(''), advice);
  assert.deepEqual(
    parts.filter((part) => part.term).map((part) => part.term),
    ['卖血', '速本', '对子', '精锐奖励', '经济牌', '兜底'],
  );
  assert.equal(findGlossaryTerm('碰对子')?.term, '精锐');
  assert.equal(searchGlossary('dianbiaodaozhuan', false)[0]?.term, '电表倒转');
  assert.ok(searchGlossary('同行').some((entry) => entry.term === '抢卡'));
  assert.deepEqual(splitGlossaryText('不同行列'), [{text: '不同行列'}]);
});
