/*
 * 规程速查 Service Worker
 * sw.js 由 scripts/build_sw.py 根据本模板生成，请修改模板而不是 sw.js。
 *
 * 缓存策略
 *   页面 / 脚本 / 样式 / 数据：联网优先，离线时回落到缓存
 *   图片：缓存优先
 *   本地字体：按需下载，缓存优先；文件名包含内容哈希
 */
const VERSION = '__VERSION__';
const CORE = __CORE__;
const IMAGES = __IMAGES__;

const CORE_CACHE = 'wsq-core-' + VERSION;
const IMAGE_CACHE = 'wsq-img-__IMAGE_VERSION__';
const FONT_CACHE = 'wsq-font-local-v1';

/*
 * Cloudflare Pages 会把 /guide.html 重定向到 /guide。
 * 被重定向过的响应不能直接用于页面导航，缓存前重新包一层；查找时两种路径都试。
 */
const stripRedirect = async res => res.redirected
  ? new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers })
  : res;

const alternatePath = p => {
  if (p.endsWith('/')) return p + 'index.html';
  if (p.endsWith('/index.html')) return p.slice(0, -10);
  if (p.endsWith('.html')) return p.slice(0, -5);
  return p + '.html';
};

async function fromCache(request) {
  const options = { ignoreSearch: true };
  const hit = await caches.match(request, options);
  if (hit) return hit;
  const url = new URL(request.url);
  return caches.match(new URL(alternatePath(url.pathname), url).href, options);
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const core = await caches.open(CORE_CACHE);
    await Promise.all(CORE.map(async url => {
      const res = await fetch(url, { cache: 'reload' });
      if (res.ok) await core.put(url, await stripRedirect(res));
    }));
    const images = await caches.open(IMAGE_CACHE);
    // Reuse unchanged images across content updates; at most four background downloads.
    let next = 0;
    await Promise.all(Array.from({ length: 4 }, async () => {
      while (next < IMAGES.length) {
        const url = IMAGES[next++];
        if (!await images.match(url)) await images.add(url).catch(() => {});
      }
    }));
    self.skipWaiting();
  })());
});

// 删除旧版本缓存
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keep = [CORE_CACHE, IMAGE_CACHE, FONT_CACHE];
    for (const key of await caches.keys()) {
      if (key.startsWith('wsq-') && !keep.includes(key)) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

async function cacheFirst(request, cacheName = IMAGE_CACHE) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

function networkFirst(request) {
  return fetch(request).then(async res => {
    if (res.ok && res.type === 'basic') {
      const copy = await stripRedirect(res.clone());
      caches.open(CORE_CACHE).then(cache => cache.put(request, copy));
    }
    return res;
  }).catch(async () =>
    (await fromCache(request)) || (request.mode === 'navigate' ? caches.match('index.html') : Response.error()));
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin !== location.origin) {
    // 其他第三方请求不处理
  } else if (url.pathname.includes('/assets/fonts/')) {
    event.respondWith(cacheFirst(request, FONT_CACHE));
  } else if (url.pathname.includes('/assets/img/') || url.pathname.includes('/assets/icons/')) {
    event.respondWith(cacheFirst(request));
  } else {
    event.respondWith(networkFirst(request));
  }
});
