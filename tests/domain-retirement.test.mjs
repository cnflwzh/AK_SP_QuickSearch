import assert from 'node:assert/strict';
import {test} from 'node:test';
import {handleRetirement} from '../deployment/retirement/router.mjs';
import {requireLegacyDomainSeason} from '../src/lib/settings/legacyDomainSeason.ts';

const legacy = 'https://sp.enjoyacg.com';
const current = 'https://global.arksp.top';
const payload = {
  sourceSeason: 's1',
  recoveryPage: 'recovery',
  contentPolicy: "default-src 'none'",
  serviceWorker: 'tombstone',
};
const fetchOld = (url, method = 'GET') =>
  handleRetirement(new Request(url, {method}), legacy, payload);

test('a next-season release cannot build either old-domain deployment', () => {
  assert.doesNotThrow(() => requireLegacyDomainSeason('s1'));
  assert.throws(
    () => requireLegacyDomainSeason('next-season'),
    /旧域名保留的是 s1 存档/,
  );
});

test('retirement preserves the path and query but keeps the destination pinned to the regional origin', () => {
  for (const [from, to] of [
    [legacy, current],
    ['https://ak.cnflwzh.top', 'https://arksp.top'],
  ]) {
    for (const suffix of [
      '/guide?q=a%2Fb&q=b+',
      '//example.org/a?x=1',
      '/%2F%2Fevil.test',
      '/?',
    ]) {
      const res = handleRetirement(new Request(from + suffix), from, payload);
      assert.equal(res.status, 307);
      assert.equal(res.headers.get('location'), to + suffix);
      assert.equal(res.headers.get('cache-control'), 'no-store');
    }
  }
  assert.equal(
    fetchOld('http://sp.enjoyacg.com/tools').headers.get('location'),
    current + '/tools',
  );
  for (const origin of [
    current,
    'https://ak.cnflwzh.top',
    legacy + ':8443',
    legacy + '.elsewhere.test',
  ])
    assert.equal(fetchOld(origin + '/tools').status, 421);
  assert.equal(
    handleRetirement(new Request(current), current, payload).status,
    421,
  );
  assert.equal(fetchOld(legacy, 'POST').status, 405);
});

test('only the exact HTTPS recovery request and the old service worker stay on the old origin', async () => {
  const entry =
    '/settings?mirror-action=fetch&mirror-from=' + encodeURIComponent(current);
  const res = fetchOld(legacy + entry);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-wsq-source-season'), 's1');
  assert.equal(await res.text(), payload.recoveryPage);
  assert.equal(
    res.headers.get('content-security-policy'),
    payload.contentPolicy,
  );
  assert.equal(await fetchOld(legacy + entry, 'HEAD').text(), '');
  assert.equal(await fetchOld(legacy + '/sw.js').text(), payload.serviceWorker);
  for (const path of [
    '/settings',
    '/settings?mirror-action=fetch',
    entry + '&extra=1',
    entry + '&mirror-action=fetch',
    entry.replace('fetch', 'send'),
    entry.replace('global.arksp.top', 'arksp.top'),
    entry.replace('global.arksp.top', 'global.arksp.top.evil.test'),
    '/settings/?mirror-action=fetch&mirror-from=' + encodeURIComponent(current),
  ])
    assert.equal(
      fetchOld(legacy + path).headers.get('location'),
      current + path,
    );
  assert.equal(fetchOld('http://sp.enjoyacg.com' + entry).status, 307);
});
