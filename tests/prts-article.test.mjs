import assert from 'node:assert/strict';
import test from 'node:test';
import {fetchPrtsArticle} from '../src/lib/prts/prtsArticle.ts';

const articleResponse = () =>
  Response.json({parse: {title: '星极', text: {'*': '<p>干员资料</p>'}}});

test('主站到时后改用移动站，成功的规范页面在本次会话内复用', async (t) => {
  t.mock.timers.enable({apis: ['setTimeout']});
  const origins = [];
  t.mock.method(globalThis, 'fetch', (url, options) => {
    origins.push(url.origin);
    assert.equal(options.credentials, 'omit');
    assert.equal(url.searchParams.get('page'), '星极');
    if (origins.length === 1)
      return new Promise((_, reject) => {
        options.signal.addEventListener('abort', () => reject(options.signal.reason));
      });
    return articleResponse();
  });
  const controller = new AbortController();
  const pending = fetchPrtsArticle('星极', controller.signal);
  t.mock.timers.tick(8_999);
  assert.deepEqual(origins, ['https://prts.wiki']);
  t.mock.timers.tick(1);
  const article = await pending;
  assert.equal(article.url, 'https://prts.wiki/w/' + encodeURIComponent('星极'));
  assert.equal(await fetchPrtsArticle('星极', controller.signal), article);
  assert.deepEqual(origins, ['https://prts.wiki', 'https://m.prts.wiki']);
});

test('关闭阅读器可中断请求，移动站不会继续请求或缓存已取消的结果', async (t) => {
  const calls = [];
  const controller = new AbortController();
  t.mock.method(globalThis, 'fetch', (url, {signal}) => {
    calls.push(url.origin);
    if (calls.length > 1) return articleResponse();
    return new Promise((_, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason));
    });
  });
  const pending = fetchPrtsArticle('乌啾', controller.signal);
  controller.abort();
  await assert.rejects(pending, {name: 'AbortError'});
  assert.deepEqual(calls, ['https://prts.wiki']);
  await fetchPrtsArticle('乌啾', new AbortController().signal);
  assert.deepEqual(calls, ['https://prts.wiki', 'https://prts.wiki']);
});
