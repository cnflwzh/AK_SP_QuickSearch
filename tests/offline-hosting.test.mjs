import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
import test from 'node:test';
import {writeRouteEntries} from '../scripts/build-route-entries.ts';
import {generateServiceWorker} from '../scripts/build-sw.mjs';
import {checkHostingRules} from '../scripts/sync-hosting.mjs';
import missingAssetWorker from '../workers/not-found.mjs';

const root = resolve(import.meta.dirname, '..');
const origin = 'https://offline.example';
const activeFont = '/assets/fonts/notosanssc-123456789abcdef0.woff2';
const retiredFont =
  '/assets/fonts/zcoolqingkehuangyou-ui-0000000000000000.woff2';
const activeChunk = '/assets/bundles/app-0123456789.js';
const retiredChunk = '/assets/bundles/app-oldabcdefgh.js';
const keyOf = (request) =>
  typeof request === 'string' ? request : request.url;

function createSite(t) {
  const temp = resolve(tmpdir());
  const directory = mkdtempSync(join(temp, 'wsq-offline-'));
  t.after(() => {
    if (dirname(directory) === temp)
      rmSync(directory, {recursive: true, force: true});
  });
  for (const name of [
    '/index.html',
    '/guide.html',
    '/diff.html',
    '/404.html',
    activeFont,
    activeChunk,
  ]) {
    const path = join(directory, name);
    mkdirSync(dirname(path), {recursive: true});
    writeFileSync(path, name);
  }
  generateServiceWorker(directory);
  return directory;
}

/** Implement the Cache API operations the worker uses, preserving generations and response bodies. */
function memoryCaches() {
  const stores = new Map();
  const open = async (name) => {
    if (stores.has(name)) return stores.get(name);
    const values = new Map();
    const cache = {
      keys: async () => [...values.keys()].map((url) => new Request(url)),
      put: async (req, res) => {
        values.set(keyOf(req), res.clone());
      },
      match: async (req) => values.get(keyOf(req))?.clone(),
      delete: async (req) => values.delete(keyOf(req)),
    };
    stores.set(name, cache);
    return cache;
  };
  return {
    open,
    keys: async () => [...stores.keys()],
    delete: async (name) => stores.delete(name),
    match: async (req) => {
      for (const cache of stores.values()) {
        const hit = await cache.match(req);
        if (hit) return hit;
      }
    },
  };
}

test('EdgeOne publishes settings handoff entries without adding route copies to the offline cache', (t) => {
  const edge = JSON.parse(readFileSync(join(root, 'edgeone.json'), 'utf8'));
  assert.match(edge.buildCommand, /\bWSQ_STATIC_ROUTES=1\b/);
  const directory = createSite(t);
  const file = join(directory, 'sw.js');
  const canonical = readFileSync(file, 'utf8');
  const shell = readFileSync(join(directory, 'index.html'));
  writeRouteEntries(directory);
  for (const path of ['settings.html', 'settings/index.html', 'overview.html', 'builds/yan/index.html'])
    assert.deepEqual(readFileSync(join(directory, path)), shell, path);
  generateServiceWorker(directory);
  assert.equal(readFileSync(file, 'utf8'), canonical);
  assert.doesNotMatch(canonical, /builds\/yan(?:\.html|\/index\.html)/);
});

test('a visited old chunk stays readable without renewing it and retired fonts expire on activation', async (t) => {
  const directory = createSite(t);
  const source = readFileSync(join(directory, 'sw.js'), 'utf8');
  const current =
    'wsq-core-' + source.match(/const VERSION = '([0-9a-f]+)'/)[1];
  const listeners = new Map();
  const network = [];
  const caches = memoryCaches();
  const self = {
    registration: {scope: origin + '/'},
    addEventListener: (name, fn) => listeners.set(name, fn),
    clients: {claim: async () => {}},
  };
  runInNewContext(source, {
    self,
    URL,
    Response,
    caches,
    location: new URL(origin),
    fetch: async (req) => {
      const url = keyOf(req);
      network.push(url);
      return url.endsWith(activeChunk)
        ? new Response('current code')
        : new Response('<html>unexpected fallback</html>', {
            headers: {'Content-Type': 'text/html'},
          });
    },
  });
  const old = await caches.open('wsq-core-previous');
  await old.put(origin + retiredChunk, new Response('previous code'));
  const fonts = await caches.open('wsq-font-local-v1');
  await fonts.put(origin + activeFont, new Response('active font'));
  await fonts.put(origin + retiredFont, new Response('retired font'));
  let activation;
  listeners.get('activate')({
    waitUntil: (promise) => {
      activation = promise;
    },
  });
  await activation;
  assert.ok(await fonts.match(origin + activeFont));
  assert.equal(await fonts.match(origin + retiredFont), undefined);

  const request = async (path) => {
    const work = [];
    let delivery;
    listeners.get('fetch')({
      request: new Request(origin + path),
      respondWith: (promise) => {
        delivery = promise;
      },
      waitUntil: (promise) => work.push(promise),
    });
    const response = await delivery;
    await Promise.all(work);
    return response;
  };
  assert.equal(await (await request(retiredChunk)).text(), 'previous code');
  const active = await caches.open(current);
  assert.equal(await active.match(origin + retiredChunk), undefined);
  assert.deepEqual(network, []);
  assert.equal(await (await request(activeChunk)).text(), 'current code');
  assert.equal(
    await (await active.match(origin + activeChunk)).text(),
    'current code',
  );
  assert.equal((await request('/assets/bundles/missing.js')).status, 404);
  assert.equal(
    await active.match(origin + '/assets/bundles/missing.js'),
    undefined,
  );
});

/** Both providers interpret :name as one segment and * as a greedy path splat. */
function matches(pattern, path) {
  const expression = pattern
    .split(/(:\w+|\*)/)
    .map((part) => {
      if (part === '*') return '.*';
      if (part.startsWith(':')) return '[^/]+';
      return part.replaceAll('.', '\\.');
    })
    .join('');
  return new RegExp('^' + expression + '$').test(path);
}

test('hosting rules preserve custom build links, real asset misses and immutable fingerprinted resources', () => {
  checkHostingRules();
  const edge = JSON.parse(readFileSync(join(root, 'edgeone.json'), 'utf8'));
  const worker = JSON.parse(readFileSync(join(root, 'wrangler.jsonc'), 'utf8'));
  assert.equal(worker.main, 'workers/not-found.mjs');
  assert.equal(worker.assets.binding, 'ASSETS');
  assert.equal(worker.assets.not_found_handling, 'none');
  assert.equal(worker.assets.run_worker_first, false);
  const cloud = readFileSync(join(root, 'public/_redirects'), 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.startsWith('/'))
    .map((line) => line.split(/\s+/));
  for (const path of [
    '/box',
    '/box/',
    '/operators',
    '/covenants/yan',
    '/enemies/boss/',
    '/builds/custom-local/edit',
    '/builds/custom-local/',
  ]) {
    assert.equal(
      edge.rewrites.find((rule) => matches(rule.source, path))?.destination,
      '/index.html',
      path,
    );
    assert.deepEqual(
      cloud.find(([pattern]) => matches(pattern, path))?.slice(1),
      ['/', '200'],
      path,
    );
  }
  for (const path of [
    '/assets/bundles/removed.js',
    '/assets/img/missing.webp',
    '/box/absent',
    '/unknown',
  ]) {
    assert.equal(
      edge.rewrites.some((rule) => matches(rule.source, path)),
      false,
      path,
    );
    assert.equal(
      cloud.some(([pattern]) => matches(pattern, path)),
      false,
      path,
    );
  }
  const edgeImmutable = edge.headers
    .filter((rule) =>
      rule.headers.some(
        (header) =>
          header.key.toLowerCase() === 'cache-control' &&
          header.value.includes('immutable'),
      ),
    )
    .map((rule) => rule.source);
  const headerFile = readFileSync(join(root, 'public/_headers'), 'utf8');
  // SW 与两种安装清单必须自行声明重新验证，并且每个请求只收到一次 Cache-Control。
  for (const path of ['/sw.js', '/manifest.webmanifest', '/manifest-edge.webmanifest']) {
    const pattern = path === '/sw.js' ? path : '/*.webmanifest';
    const declared = edge.headers.find((rule) => rule.source === pattern)?.headers;
    assert.ok(declared?.some(({key, value}) => key === 'Cache-Control' && value === 'no-cache'), path);
    const matchesPath = edge.headers.filter((rule) => matches(rule.source, path));
    assert.deepEqual(matchesPath.flatMap((rule) => rule.headers)
      .filter(({key}) => key === 'Cache-Control').map(({value}) => value), ['no-cache'], path);
    assert.ok(headerFile.includes(pattern + '\n  Cache-Control: no-cache\n'), path);
    if (path.endsWith('.webmanifest'))
      assert.ok(declared.some(({key, value}) => key === 'Content-Type' && value === 'application/manifest+json'));
  }
  const cloudImmutable = [
    ...headerFile.matchAll(/^(\/\S*)\r?\n +Cache-Control:[^\n]*immutable/gm),
  ].map((m) => m[1]);
  for (const patterns of [edgeImmutable, cloudImmutable]) {
    for (const path of [
      activeChunk,
      '/assets/bundles/site-fonts-123456789abcd.css',
      activeFont,
    ])
      assert.ok(
        patterns.some((pattern) => matches(pattern, path)),
        path,
      );
    for (const path of [
      '/sw.js',
      '/index.html',
      '/assets/fonts/notosanssc-OFL.txt',
      '/assets/img/example.webp',
    ])
      assert.ok(!patterns.some((pattern) => matches(pattern, path)), path);
  }
  // Every WOFF2 matched by the immutable header must actually be named after its bytes.
  const dir = join(root, 'public/assets/fonts');
  const fonts = readdirSync(dir).filter((name) => name.endsWith('.woff2'));
  assert.ok(fonts.length);
  for (const name of fonts) {
    const hash = createHash('sha256')
      .update(readFileSync(join(dir, name)))
      .digest('hex')
      .slice(0, 16);
    assert.ok(name.endsWith('-' + hash + '.woff2'), name);
  }
});


test('Workers static asset misses preserve the custom 404 without storing a negative immutable response', async () => {
  const html = readFileSync(join(root, 'public/404.html'), 'utf8');
  const reads = [];
  const env = {ASSETS: {async fetch(request) {
    reads.push([request.method, request.url]);
    return new Response(html, {headers: {'Cache-Control': 'public, max-age=31536000, immutable'}});
  }}};
  for (const [path, method, status] of [
    ['/assets/bundles/missing-01234567.js', 'GET', 404],
    ['/assets/fonts/missing-0123456789abcdef.woff2', 'HEAD', 404],
    ['/unknown', 'POST', 405],
  ]) {
    const response = await missingAssetWorker.fetch(new Request(origin + path, {method}), env);
    assert.equal(response.status, status);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.equal(response.headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin');
    if (status === 404) assert.match(response.headers.get('Content-Type'), /^text\/html/);
    if (status === 405) assert.equal(response.headers.get('Allow'), 'GET, HEAD');
    assert.equal(await response.text(), method === 'GET' ? html : '');
  }
  assert.deepEqual(reads, [['GET', origin + '/404']]);
});
