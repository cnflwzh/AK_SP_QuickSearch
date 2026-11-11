/*
 * 规程速查 Service Worker
 * sw.js 由 scripts/build_sw.py 根据本模板生成，请修改模板而不是 sw.js。
 *
 * 缓存策略
 *   页面 / 脚本 / 样式 / 数据：联网优先，离线时回落到缓存
 *   图片：缓存优先
 *   Google Fonts：先用缓存，同时后台更新
 */
const VERSION = '__VERSION__';
const CORE = __CORE__;
const IMAGES = __IMAGES__;

const CORE_CACHE = 'wsq-core-' + VERSION;
const IMAGE_CACHE = 'wsq-img-' + VERSION;
const FONT_CACHE = 'wsq-font';

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
    await Promise.all(IMAGES.map(url => images.add(url).catch(() => {})));
    self.skipWaiting();
  })());
});

// 删除旧版本缓存
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keep = [CORE_CACHE, IMAGE_CACHE, FONT_CACHE];
    for (const key of await caches.keys()) {
      if (!keep.includes(key)) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

function staleWhileRevalidate(request) {
  return caches.open(FONT_CACHE).then(async cache => {
    const hit = await cache.match(request);
    const network = fetch(request).then(res => {
      if (res.ok || res.type === 'opaque') cache.put(request, res.clone());
      return res;
    }).catch(() => hit);
    return hit || network;
  });
}

function cacheFirst(request) {
  return caches.match(request).then(hit => hit || fetch(request).then(res => {
    if (res.ok) {
      const copy = res.clone();
      caches.open(IMAGE_CACHE).then(cache => cache.put(request, copy));
    }
    return res;
  }));
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

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(request));
  } else if (url.origin !== location.origin) {
    // 其他第三方请求不处理
  } else if (url.pathname.includes('/assets/img/') || url.pathname.includes('/assets/icons/')) {
    event.respondWith(cacheFirst(request));
  } else {
    event.respondWith(networkFirst(request));
  }
});
