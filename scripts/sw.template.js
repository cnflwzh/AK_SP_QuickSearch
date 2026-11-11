/*
 * 卫戍速查 Service Worker
 * sw.js 由 scripts/build-sw.mjs 根据本模板生成，请修改模板而不是 sw.js。
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
const ALLOWED = new Set([...CORE, ...IMAGES].map(path => new URL(path, self.registration.scope).href));

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
  // Static same-origin resources are identical for module CORS and ordinary fetches.
  // Preview servers may send Vary: Origin; visited-resource backfills omit that header.
  const options = { ignoreSearch: true, ignoreVary: true };
  const hit = await caches.match(request, options);
  if (hit) return hit;
  const url = new URL(request.url);
  return caches.match(new URL(alternatePath(url.pathname), url).href, options);
}

// 安装时不下载任何页面、图片或字体；未访问的内容不会占用网络。
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));

const cacheName = url => url.pathname.includes('/assets/fonts/') ? FONT_CACHE
  : /\/assets\/(img|icons)\//.test(url.pathname) ? IMAGE_CACHE : CORE_CACHE;

/** 首次安装前已下载的本页资源，从 HTTP 缓存补存；后续请求由 fetch 事件缓存。 */
self.addEventListener('message', event => {
  if (event.data?.type !== 'CACHE_VISITED' || !Array.isArray(event.data.urls)) return;
  event.waitUntil((async () => {
    const urls = [...new Set(event.data.urls)].filter(value => {
      if (typeof value !== 'string') return false;
      try {
        const url = new URL(value);
        if (url.origin !== location.origin) return false;
        return ALLOWED.has(url.href)
          || ALLOWED.has(new URL(alternatePath(url.pathname), url).href)
          || /\/assets\/fonts\/[a-z]+-[a-f0-9]{16}\.woff2$/.test(url.pathname);
      } catch { return false; }
    });
    let next = 0;
    await Promise.all(Array.from({ length: 2 }, async () => {
      while (next < urls.length) {
        const url = new URL(urls[next++]);
        const cache = await caches.open(cacheName(url));
        if (await cache.match(url.href)) continue;
        try {
          const response = await fetch(url.href, { cache: 'force-cache', priority: 'low' });
          if (response.ok) await cache.put(url.href, await stripRedirect(response));
        } catch { /* 网络中断时，已保存的其他资源仍可离线使用。 */ }
      }
    }));
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
  const hit = await cache.match(request, { ignoreVary: true });
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

function networkFirst(event) {
  const request = event.request;
  return fetch(request).then(async res => {
    if (res.ok && res.type === 'basic') {
      const copy = await stripRedirect(res.clone());
      event.waitUntil(caches.open(CORE_CACHE).then(cache => cache.put(request, copy)));
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
    event.respondWith(networkFirst(event));
  }
});
