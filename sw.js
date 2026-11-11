/*
 * 规程速查 Service Worker
 * sw.js 由 scripts/build_sw.py 根据本模板生成，请修改模板而不是 sw.js。
 *
 * 缓存策略
 *   页面 / 脚本 / 样式 / 数据：联网优先，离线时回落到缓存
 *   图片：缓存优先
 *   Google Fonts：先用缓存，同时后台更新
 */
const VERSION = '5265bb701b';
const CORE = [
  "./",
  "assets/css/base.css",
  "assets/css/guide.css",
  "assets/css/quickref.css",
  "assets/icons/apple-180.png",
  "assets/icons/favicon-48.png",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/icons/maskable-512.png",
  "data/builds.js",
  "data/covenants.js",
  "data/credits.js",
  "data/equipment.js",
  "data/index.js",
  "data/operators.js",
  "data/pinyin.js",
  "data/rules.js",
  "data/strategies.js",
  "guide.html",
  "index.html",
  "js/guide/chapters/01-basics.js",
  "js/guide/chapters/02-recruit.js",
  "js/guide/chapters/03-enemies.js",
  "js/guide/chapters/04-covenants.js",
  "js/guide/chapters/05-builds.js",
  "js/guide/chapters/06-database.js",
  "js/guide/chapters/shop-simulator.js",
  "js/guide/chips.js",
  "js/guide/main.js",
  "js/lib/about.js",
  "js/lib/assets.js",
  "js/lib/dom.js",
  "js/lib/match.js",
  "js/lib/peek.js",
  "js/lib/pwa.js",
  "js/quickref/chips.js",
  "js/quickref/main.js",
  "js/quickref/search.js",
  "js/quickref/sheet.js",
  "js/quickref/state.js",
  "js/quickref/views/builds.js",
  "js/quickref/views/covenants.js",
  "js/quickref/views/equipment.js",
  "js/quickref/views/numbers.js",
  "js/quickref/views/operators.js",
  "js/quickref/views/strategies.js",
  "manifest.webmanifest"
];
const IMAGES = [
  "assets/img/avatars/char_002_amiya.webp",
  "assets/img/avatars/char_1012_skadi2.webp",
  "assets/img/avatars/char_1014_nearl2.webp",
  "assets/img/avatars/char_1016_agoat2.webp",
  "assets/img/avatars/char_1019_siege2.webp",
  "assets/img/avatars/char_1023_ghost2.webp",
  "assets/img/avatars/char_1027_greyy2.webp",
  "assets/img/avatars/char_1031_slent2.webp",
  "assets/img/avatars/char_1034_jesca2.webp",
  "assets/img/avatars/char_1036_fang2.webp",
  "assets/img/avatars/char_1038_whitw2.webp",
  "assets/img/avatars/char_1039_thorn2.webp",
  "assets/img/avatars/char_1040_blaze2.webp",
  "assets/img/avatars/char_1042_phatm2.webp",
  "assets/img/avatars/char_1045_svash2.webp",
  "assets/img/avatars/char_1046_sbell2.webp",
  "assets/img/avatars/char_1047_halo2.webp",
  "assets/img/avatars/char_1051_headb2.webp",
  "assets/img/avatars/char_113_cqbw.webp",
  "assets/img/avatars/char_127_estell.webp",
  "assets/img/avatars/char_129_bluep.webp",
  "assets/img/avatars/char_135_halo.webp",
  "assets/img/avatars/char_140_whitew.webp",
  "assets/img/avatars/char_143_ghost.webp",
  "assets/img/avatars/char_150_snakek.webp",
  "assets/img/avatars/char_171_bldsk.webp",
  "assets/img/avatars/char_174_slbell.webp",
  "assets/img/avatars/char_179_cgbird.webp",
  "assets/img/avatars/char_180_amgoat.webp",
  "assets/img/avatars/char_183_skgoat.webp",
  "assets/img/avatars/char_185_frncat.webp",
  "assets/img/avatars/char_188_helage.webp",
  "assets/img/avatars/char_193_frostl.webp",
  "assets/img/avatars/char_194_leto.webp",
  "assets/img/avatars/char_195_glassb.webp",
  "assets/img/avatars/char_199_yak.webp",
  "assets/img/avatars/char_2015_dusk.webp",
  "assets/img/avatars/char_2025_shu.webp",
  "assets/img/avatars/char_2026_yu.webp",
  "assets/img/avatars/char_202_demkni.webp",
  "assets/img/avatars/char_206_gnosis.webp",
  "assets/img/avatars/char_218_cuttle.webp",
  "assets/img/avatars/char_219_meteo.webp",
  "assets/img/avatars/char_237_gravel.webp",
  "assets/img/avatars/char_249_mlyss.webp",
  "assets/img/avatars/char_258_podego.webp",
  "assets/img/avatars/char_263_skadi.webp",
  "assets/img/avatars/char_264_f12yin.webp",
  "assets/img/avatars/char_274_astesi.webp",
  "assets/img/avatars/char_291_aglina.webp",
  "assets/img/avatars/char_293_thorns.webp",
  "assets/img/avatars/char_322_lmlee.webp",
  "assets/img/avatars/char_325_bison.webp",
  "assets/img/avatars/char_328_cammou.webp",
  "assets/img/avatars/char_332_archet.webp",
  "assets/img/avatars/char_333_sidero.webp",
  "assets/img/avatars/char_337_utage.webp",
  "assets/img/avatars/char_341_sntlla.webp",
  "assets/img/avatars/char_346_aosta.webp",
  "assets/img/avatars/char_347_jaksel.webp",
  "assets/img/avatars/char_350_surtr.webp",
  "assets/img/avatars/char_355_ethan.webp",
  "assets/img/avatars/char_358_lisa.webp",
  "assets/img/avatars/char_367_swllow.webp",
  "assets/img/avatars/char_381_bubble.webp",
  "assets/img/avatars/char_391_rosmon.webp",
  "assets/img/avatars/char_4009_irene.webp",
  "assets/img/avatars/char_400_weedy.webp",
  "assets/img/avatars/char_4010_etlchi.webp",
  "assets/img/avatars/char_4013_kjera.webp",
  "assets/img/avatars/char_4016_kazema.webp",
  "assets/img/avatars/char_4026_vulpis.webp",
  "assets/img/avatars/char_4027_heyak.webp",
  "assets/img/avatars/char_4031_liesel.webp",
  "assets/img/avatars/char_4037_demetr.webp",
  "assets/img/avatars/char_4041_chnut.webp",
  "assets/img/avatars/char_4042_lumen.webp",
  "assets/img/avatars/char_4046_ebnhlz.webp",
  "assets/img/avatars/char_4047_pianst.webp",
  "assets/img/avatars/char_4054_malist.webp",
  "assets/img/avatars/char_4055_bgsnow.webp",
  "assets/img/avatars/char_4058_pepe.webp",
  "assets/img/avatars/char_4064_mlynar.webp",
  "assets/img/avatars/char_4065_judge.webp",
  "assets/img/avatars/char_4066_highmo.webp",
  "assets/img/avatars/char_4072_ironmn.webp",
  "assets/img/avatars/char_4082_qiubai.webp",
  "assets/img/avatars/char_4088_hodrer.webp",
  "assets/img/avatars/char_4098_vvana.webp",
  "assets/img/avatars/char_4114_harold.webp",
  "assets/img/avatars/char_4116_blkkgt.webp",
  "assets/img/avatars/char_4133_logos.webp",
  "assets/img/avatars/char_4134_cetsyr.webp",
  "assets/img/avatars/char_4137_udflow.webp",
  "assets/img/avatars/char_4139_papyrs.webp",
  "assets/img/avatars/char_4145_ulpia.webp",
  "assets/img/avatars/char_4146_nymph.webp",
  "assets/img/avatars/char_4147_mitm.webp",
  "assets/img/avatars/char_4151_tinman.webp",
  "assets/img/avatars/char_4162_cathy.webp",
  "assets/img/avatars/char_4163_rosesa.webp",
  "assets/img/avatars/char_4165_ctrail.webp",
  "assets/img/avatars/char_4166_varkis.webp",
  "assets/img/avatars/char_416_zumama.webp",
  "assets/img/avatars/char_4177_brigid.webp",
  "assets/img/avatars/char_4179_monstr.webp",
  "assets/img/avatars/char_4193_lemuen.webp",
  "assets/img/avatars/char_4198_christ.webp",
  "assets/img/avatars/char_4202_haruka.webp",
  "assets/img/avatars/char_4203_kichi.webp",
  "assets/img/avatars/char_4204_mantra.webp",
  "assets/img/avatars/char_4207_branch.webp",
  "assets/img/avatars/char_420_flamtl.webp",
  "assets/img/avatars/char_4211_snhunt.webp",
  "assets/img/avatars/char_4221_ju.webp",
  "assets/img/avatars/char_4222_taraxa.webp",
  "assets/img/avatars/char_4224_turdus.webp",
  "assets/img/avatars/char_4226_veen.webp",
  "assets/img/avatars/char_4228_closur.webp",
  "assets/img/avatars/char_422_aurora.webp",
  "assets/img/avatars/char_4230_mcnist.webp",
  "assets/img/avatars/char_4231_clemnt.webp",
  "assets/img/avatars/char_4232_hbound.webp",
  "assets/img/avatars/char_423_blemsh.webp",
  "assets/img/avatars/char_4244_tocka.webp",
  "assets/img/avatars/char_4245_alga.webp",
  "assets/img/avatars/char_4247_oxi.webp",
  "assets/img/avatars/char_426_billro.webp",
  "assets/img/avatars/char_427_vigil.webp",
  "assets/img/avatars/char_430_fartth.webp",
  "assets/img/avatars/char_437_mizuki.webp",
  "assets/img/avatars/char_455_nothin.webp",
  "assets/img/avatars/char_469_indigo.webp",
  "assets/img/avatars/char_472_pasngr.webp",
  "assets/img/avatars/char_474_glady.webp",
  "assets/img/avatars/char_484_robrta.webp",
  "assets/img/avatars/char_485_pallas.webp",
  "assets/img/avatars/char_488_buildr.webp",
  "assets/img/avatars/char_492_quercu.webp",
  "assets/img/avatars/char_496_wildmn.webp",
  "assets/img/avatars/char_499_kaitou.webp",
  "assets/img/avatars/char_616_pithst.webp",
  "assets/img/equipment/e00.webp",
  "assets/img/equipment/e01.webp",
  "assets/img/equipment/e02.webp",
  "assets/img/equipment/e03.webp",
  "assets/img/equipment/e04.webp",
  "assets/img/equipment/e05.webp",
  "assets/img/equipment/e06.webp",
  "assets/img/equipment/e07.webp",
  "assets/img/equipment/e08.webp",
  "assets/img/equipment/e09.webp",
  "assets/img/equipment/e10.webp",
  "assets/img/equipment/e11.webp",
  "assets/img/equipment/e12.webp",
  "assets/img/equipment/e13.webp",
  "assets/img/equipment/e14.webp",
  "assets/img/equipment/e15.webp",
  "assets/img/equipment/e16.webp",
  "assets/img/equipment/e17.webp",
  "assets/img/equipment/e18.webp",
  "assets/img/equipment/e19.webp",
  "assets/img/equipment/e20.webp",
  "assets/img/equipment/e21.webp",
  "assets/img/equipment/e22.webp",
  "assets/img/equipment/e23.webp",
  "assets/img/equipment/e24.webp",
  "assets/img/equipment/e25.webp",
  "assets/img/equipment/e26.webp",
  "assets/img/equipment/e27.webp",
  "assets/img/equipment/e28.webp",
  "assets/img/equipment/e29.webp",
  "assets/img/equipment/e30.webp",
  "assets/img/equipment/e31.webp",
  "assets/img/equipment/e32.webp",
  "assets/img/equipment/e33.webp",
  "assets/img/equipment/e34.webp",
  "assets/img/equipment/e35.webp",
  "assets/img/equipment/e36.webp",
  "assets/img/equipment/e37.webp",
  "assets/img/equipment/e38.webp",
  "assets/img/equipment/e39.webp",
  "assets/img/equipment/e40.webp",
  "assets/img/equipment/e41.webp",
  "assets/img/equipment/e42.webp",
  "assets/img/equipment/e43.webp",
  "assets/img/equipment/e44.webp",
  "assets/img/equipment/e45.webp",
  "assets/img/equipment/e46.webp",
  "assets/img/equipment/e47.webp",
  "assets/img/equipment/e48.webp",
  "assets/img/equipment/e49.webp",
  "assets/img/equipment/e50.webp",
  "assets/img/equipment/e51.webp",
  "assets/img/equipment/e52.webp",
  "assets/img/equipment/e53.webp",
  "assets/img/equipment/e54.webp",
  "assets/img/equipment/e55.webp",
  "assets/img/equipment/e56.webp",
  "assets/img/equipment/e57.webp",
  "assets/img/equipment/e58.webp",
  "assets/img/equipment/e59.webp",
  "assets/img/equipment/e60.webp",
  "assets/img/equipment/e61.webp",
  "assets/img/equipment/e62.webp",
  "assets/img/equipment/e63.webp",
  "assets/img/equipment/e64.webp",
  "assets/img/equipment/e65.webp",
  "assets/img/equipment/e66.webp",
  "assets/img/equipment/e67.webp",
  "assets/img/equipment/e68.webp",
  "assets/img/equipment/e69.webp",
  "assets/img/strategies/s00.webp",
  "assets/img/strategies/s01.webp",
  "assets/img/strategies/s02.webp",
  "assets/img/strategies/s03.webp",
  "assets/img/strategies/s04.webp",
  "assets/img/strategies/s05.webp",
  "assets/img/strategies/s06.webp",
  "assets/img/strategies/s07.webp",
  "assets/img/strategies/s08.webp",
  "assets/img/strategies/s09.webp",
  "assets/img/strategies/s10.webp",
  "assets/img/strategies/s11.webp",
  "assets/img/strategies/s12.webp",
  "assets/img/strategies/s13.webp",
  "assets/img/strategies/s14.webp",
  "assets/img/strategies/s15.webp",
  "assets/img/strategies/s16.webp",
  "assets/img/strategies/s17.webp",
  "assets/img/strategies/s18.webp",
  "assets/img/strategies/s19.webp",
  "assets/img/strategies/s20.webp",
  "assets/img/strategies/s21.webp",
  "assets/img/strategies/s22.webp",
  "assets/img/strategies/s23.webp",
  "assets/img/strategies/s24.webp",
  "assets/img/strategies/s25.webp",
  "assets/img/strategies/s26.webp",
  "assets/img/strategies/s27.webp",
  "assets/img/strategies/s28.webp",
  "assets/img/strategies/s29.webp",
  "assets/img/strategies/s30.webp",
  "assets/img/strategies/s31.webp",
  "assets/img/strategies/s32.webp",
  "assets/img/strategies/s33.webp",
  "assets/img/strategies/s34.webp",
  "assets/img/strategies/s35.webp",
  "assets/img/strategies/s36.webp",
  "assets/img/strategies/s37.webp",
  "assets/img/strategies/s38.webp",
  "assets/img/strategies/s39.webp",
  "assets/img/strategies/s40.webp",
  "assets/img/strategies/s41.webp",
  "assets/img/strategies/s42.webp",
  "assets/img/strategies/s43.webp",
  "assets/img/strategies/s44.webp",
  "assets/img/strategies/s45.webp",
  "assets/img/strategies/s46.webp",
  "assets/img/strategies/s47.webp",
  "assets/img/strategies/s48.webp",
  "assets/img/strategies/s49.webp",
  "assets/img/strategies/s50.webp",
  "assets/img/strategies/s51.webp",
  "assets/img/strategies/s52.webp",
  "assets/img/strategies/s53.webp",
  "assets/img/strategies/s54.webp",
  "assets/img/strategies/s55.webp",
  "assets/img/strategies/s56.webp",
  "assets/img/strategies/s57.webp",
  "assets/img/strategies/s58.webp",
  "assets/img/strategies/s59.webp",
  "assets/img/strategies/s60.webp"
];

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
