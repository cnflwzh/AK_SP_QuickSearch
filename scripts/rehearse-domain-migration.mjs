/**
 * 本地四域名 Chromium 演练。准备 VITE_DOMAIN_MIGRATION=parallel、WSQ_STATIC_ROUTES=1
 * 的 dist，另运行 npm run build:retirement。两个旧来源切换时仅替换本地 HTTP 处理函数。
 * npm exec --offline --package=playwright -- node scripts/rehearse-domain-migration.mjs
 * 可选 --sw=both|on|off、--phase=both|parallel|retired|layout、--dist=...、--retirement-dir=...。
 * --legacy-dist=... 另用迁移前的真实构建演练旧版发起、接收。目录同样需要静态路由入口。
 * --next-season-dist=... 另测真实第二赛季构建，--next-season 默认为 rehearsal-next。
 * 环境变量 WSQ_PLAYWRIGHT_MODULE、WSQ_CHROMIUM_EXECUTABLE、WSQ_CHROMIUM_CHANNEL、
 * WSQ_OPENSSL 可指定本机已有的工具。使用临时证书与浏览器上下文，不读取个人浏览器目录。
 */
/* global caches, window, document, requestAnimationFrame */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash, X509Certificate} from 'node:crypto';
import {existsSync} from 'node:fs';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {createServer} from 'node:https';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {basename, delimiter, extname, join, resolve, sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';
import {ABOUT_VERSION} from '../data/credits.ts';
import {OPERATOR, SEASON_META} from '../data/index.ts';
import {seasonStorageKey} from '../src/lib/season/storage.ts';
import {BORROWABLE_SIX_STARS} from '../src/lib/box/model.ts';
import {SELECTABLE_COVENANTS} from '../src/lib/dealer/themes.ts';
import {newAdvisorRun} from '../src/lib/recommendation/live/advisorState.ts';

const root = resolve(import.meta.dirname, '..');
const {values} = parseArgs({
  options: {
    sw: {type: 'string', default: 'both'},
    phase: {type: 'string', default: 'both'},
    dist: {type: 'string', default: join(root, 'dist')},
    'next-season-dist': {type: 'string'},
    'next-season': {type: 'string', default: 'rehearsal-next'},
    'legacy-dist': {type: 'string'},
    'retirement-dir': {
      type: 'string',
      default: join(root, '.codex-retirement'),
    },
  },
});
assert(['both', 'on', 'off'].includes(values.sw), 'Expected --sw=both|on|off');
assert(
  ['both', 'parallel', 'retired', 'layout'].includes(values.phase),
  'Expected --phase=both|parallel|retired|layout',
);
const dist = resolve(values.dist);
const legacyGlobal = 'https://sp.enjoyacg.com';
const legacyMainland = 'https://ak.cnflwzh.top';
const newGlobal = 'https://global.arksp.top';
const newMainland = 'https://arksp.top';
const origins = [legacyGlobal, legacyMainland, newGlobal, newMainland];
const hosts = origins.map((origin) => new URL(origin).hostname);
const deepPath = '/operators?tier=3&q=demo#operator-list';
const settingsKey = 'wsq.settings.v1';
const boxKey = 'wsq.box.v1';
const fromBox = OPERATOR['拜松'].avatar;
const toBox = OPERATOR['鸿雪'].avatar;
const [sourceBorrow, destinationBorrow] = BORROWABLE_SIX_STARS.filter(
  (op) => op.avatar !== fromBox && op.avatar !== toBox,
).map((op) => op.avatar);
const oldSeason = SEASON_META.id;
const nextSeason = values['next-season'];
function seasonKeys(season) {
  const scoped = (name) => seasonStorageKey(name, season);
  return {
    plans: scoped('wsq.plans'),
    run: scoped('wsq.run'),
    daily: scoped('wsq.dealer.daily.v3'),
    advisor: scoped('wsq.tools.advisor.v1'),
    recent: scoped('wsq.recent.v1'),
    mistakes: scoped('wsq.dealer.mistakes.v1'),
    borrowed: scoped('wsq.box.borrowed'),
  };
}
const timeout = 20_000;

function loadChromium() {
  const require = createRequire(import.meta.url);
  if (process.env.WSQ_PLAYWRIGHT_MODULE)
    return require(resolve(process.env.WSQ_PLAYWRIGHT_MODULE)).chromium;
  // npm exec exposes its package's .bin on PATH, without installing it in the project.
  const packageRoots = (process.env.PATH ?? '')
    .split(delimiter)
    .filter((path) => basename(path) === '.bin')
    .map((path) => resolve(path, '../..'));
  const entry = require.resolve('playwright', {paths: [root, ...packageRoots]});
  return require(entry).chromium;
}

async function temporaryCertificate() {
  const directory = await mkdtemp(join(tmpdir(), 'wsq-migration-tls-'));
  try {
    let openssl = process.env.WSQ_OPENSSL || 'openssl';
    if (process.platform === 'win32' && !process.env.WSQ_OPENSSL) {
      const gitExec = execFileSync('git', ['--exec-path'], {
        encoding: 'utf8',
      }).trim();
      const bundled = resolve(gitExec, '../../../usr/bin/openssl.exe');
      if (existsSync(bundled)) openssl = bundled;
    }
    await writeFile(
      join(directory, 'openssl.cnf'),
      '[req]\ndistinguished_name=dn\n[dn]\n',
    );
    execFileSync(
      openssl,
      [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-days',
        '1',
        '-config',
        'openssl.cnf',
        '-subj',
        '/CN=Local migration rehearsal',
        '-addext',
        'subjectAltName=' + hosts.map((host) => 'DNS:' + host).join(','),
        '-keyout',
        'key.pem',
        '-out',
        'cert.pem',
      ],
      {cwd: directory, stdio: 'pipe'},
    );
    const [cert, key] = await Promise.all(
      ['cert.pem', 'key.pem'].map((name) => readFile(join(directory, name))),
    );
    const publicKey = new X509Certificate(cert).publicKey.export({
      type: 'spki',
      format: 'der',
    });
    return {
      cert,
      key,
      pin: createHash('sha256').update(publicKey).digest('base64'),
    };
  } finally {
    await rm(directory, {recursive: true, force: true});
  }
}

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

async function staticResponse(url, directory) {
  const path = decodeURIComponent(url.pathname);
  const htmlPath = path.endsWith('/') ? path + 'index.html' : path + '.html';
  const filename = resolve(directory, '.' + (extname(path) ? path : htmlPath));
  if (!filename.startsWith(directory + sep))
    return new Response(null, {status: 404});
  try {
    return new Response(await readFile(filename), {
      headers: {
        'Content-Type': mime[extname(filename)] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR')
      return new Response(null, {status: 404});
    throw error;
  }
}

async function loadRetirement() {
  if (values.phase === 'parallel' || values.phase === 'layout')
    return new Map();
  const fromBuild = (name) =>
    import(pathToFileURL(resolve(values['retirement-dir'], name)).href);
  const [cloudflare, edgeone] = await Promise.all([
    fromBuild('cloudflare/worker.mjs'),
    fromBuild('edgeone/middleware.js'),
  ]);
  return new Map([
    [legacyGlobal, (request) => cloudflare.default.fetch(request)],
    [legacyMainland, (request) => edgeone.middleware({request})],
  ]);
}

function fixture(source, season, seasonOnly = false) {
  const name = source ? '来源阵容' : '已有阵容';
  const operator = source ? '拜松' : '鸿雪';
  const id = source ? 'fixture-old' : 'fixture-new';
  const theme = source ? 'dark' : 'light';
  const title = operator;
  const targetKey = SELECTABLE_COVENANTS[0];
  const borrowed = source ? sourceBorrow : destinationBorrow;
  const keys = seasonKeys(season);
  const box = seasonOnly ? {} : {[source ? fromBox : toBox]: source ? 3 : 2};
  if (source && !seasonOnly) box.char_999999_rehearsal = 1;
  if (season === 's1') box[borrowed] = -2;
  const plan = {
    id,
    name,
    updated: 1,
    ops: [{name: operator, elite: true, core: true, eq: [], alt: []}],
    strategy: '',
    note: name,
    layers: {},
  };
  const mistakes = [
    {
      key: 'covenant:' + targetKey + ':' + title,
      roundKind: 'covenant',
      cardKind: 'operator',
      detailKind: 'op',
      title,
      targetKey,
      targetLabel: targetKey,
      wrongCount: 1,
      lastWrongAt: 1000,
      correctStreak: 0,
    },
  ];
  const daily = {
    dateKey: '2026-11-26',
    orderSeed: id,
    roundIndex: 0,
    history: [],
    dailyCompleted: false,
    rage: 0,
    combo: 0,
    stats: {
      punched: 0,
      calibrated: 0,
      keptClean: 0,
      mistakes: 0,
      maxCombo: 0,
      roundsCleared: 0,
      hintsUsed: 0,
      hintedRounds: 0,
    },
  };
  return {
    ...(!seasonOnly && {[settingsKey]: JSON.stringify({theme})}),
    [boxKey]: JSON.stringify(box),
    ...(season !== 's1' && {[keys.borrowed]: JSON.stringify([borrowed])}),
    [keys.plans]: JSON.stringify([plan]),
    [keys.run]: id,
    [keys.daily]: JSON.stringify(daily),
    [keys.advisor]: JSON.stringify({
      ...newAdvisorRun(),
      level: 3,
      funds: source ? 17 : 21,
    }),
    [keys.mistakes]: JSON.stringify(mistakes),
    [keys.recent]: JSON.stringify([{kind: 'op', name: operator}]),
  };
}

function makeStorageState({
  source,
  destination,
  existing,
  crossSeason,
  seasonOnly,
}) {
  return {
    cookies: [],
    origins: origins.map((origin) => {
      let save = {};
      if (origin === source) save = fixture(true, oldSeason, seasonOnly);
      if (origin === destination && existing)
        save = fixture(false, crossSeason ? nextSeason : oldSeason);
      return {
        origin,
        localStorage: Object.entries({
          ...save,
          'wsq.about': String(ABOUT_VERSION),
          'wsq.box.onboarding.v1': '1',
        }).map(([name, value]) => ({name, value})),
      };
    }),
  };
}

function readSave(entries, season) {
  const keys = seasonKeys(season);
  const parse = (key, fallback) =>
    JSON.parse(entries[key] ?? 'null') ?? fallback;
  const box = parse(boxKey, {});
  return {
    theme: parse(settingsKey, {}).theme ?? 'system',
    plans: parse(keys.plans, [])
      .map((p) => p.name)
      .sort(),
    owned: Object.fromEntries(
      Object.entries(box).filter(([, rank]) => rank >= 0),
    ),
    borrowed: (season === 's1'
      ? Object.keys(box).filter((key) => box[key] === -2)
      : parse(keys.borrowed, [])
    ).sort(),
    mistakes: parse(keys.mistakes, []).map((item) => item.title),
    recent: parse(keys.recent, []).map((item) => item.name),
    // Excluded in-progress records must remain byte-identical, even when adopting another origin's settings.
    progress: [keys.run, keys.advisor, keys.daily].map(
      (key) => entries[key] ?? null,
    ),
  };
}

async function rawStorage(page) {
  return page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
}

async function downloadBytes(page, name) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', {name, exact: true}).click(),
  ]);
  const chunks = [];
  for await (const chunk of await download.createReadStream())
    chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function openPage(context, address) {
  const page = await context.newPage();
  const response = await page.goto(address, {waitUntil: 'domcontentloaded'});
  assert.equal(response?.status(), 200, 'Navigation to ' + address);
  return page;
}

// Wait for a page claimed by the site's own worker, so that the next navigation exercises it.
async function warm(context, origin) {
  const page = await openPage(context, origin + '/settings');
  await page.waitForFunction(
    () => navigator.serviceWorker?.controller?.state === 'activated',
  );
  return page;
}

async function followLink(page, expected) {
  const link = page.getByRole('link', {name: '直接访问新域名', exact: true});
  assert.equal(
    await link.getAttribute('href'),
    expected,
    'The direct link must preserve the complete deep link',
  );
  let landing = page;
  if ((await link.getAttribute('target')) === '_blank') {
    [landing] = await Promise.all([page.waitForEvent('popup'), link.click()]);
  } else {
    await link.click();
  }
  await landing.waitForURL(expected);
  await landing.waitForLoadState('domcontentloaded');
}

async function checkNoticeLayout(context) {
  const page = await openPage(context, legacyGlobal + '/operators');
  const notice = page.locator('aside[aria-label="域名迁移"]');
  await notice.waitFor();
  async function measure(width, height, split = false) {
    await page.setViewportSize({width, height});
    const sizes = await notice.evaluate(async (el) => {
      await document.fonts.ready;
      await new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      );
      const bounds = el.getBoundingClientRect();
      const documentWidth = document.documentElement.clientWidth;
      const controls = [...el.querySelectorAll('button, a')].map((button) =>
        button.getBoundingClientRect(),
      );
      return {
        width: Math.round(bounds.width),
        minHeight: Math.min(...controls.map((rect) => rect.height)),
        fits:
          bounds.left >= 0 &&
          bounds.right <= documentWidth + 1 &&
          document.documentElement.scrollWidth <= documentWidth + 1 &&
          el.scrollWidth <= el.clientWidth + 1 &&
          controls.every(
            (rect) =>
              rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1,
          ),
      };
    });
    assert(
      sizes.minHeight >= 34 && sizes.fits,
      `Migration notice ${width}×${height}: ${JSON.stringify(sizes)}`,
    );
    if (split)
      assert(
        sizes.width < width * 0.65,
        'Wiki did not narrow the reading pane',
      );
    console.log(
      `  ${width}×${height}${split ? ' PRTS 分屏' : ''} · 提示宽 ${sizes.width}px · 控件最小高度 ${sizes.minHeight}px`,
    );
  }
  for (const [width, height] of [
    [390, 844],
    [640, 400],
    [860, 380],
    [625, 670],
    [1280, 900],
  ])
    await measure(width, height);
  // Chromium denies external names. The real side panel can open even with the Wiki article offline.
  await page
    .getByRole('link', {name: /^在右侧打开.+的 PRTS Wiki$/})
    .first()
    .click();
  await page.getByRole('button', {name: '关闭 PRTS 侧栏'}).waitFor();
  await measure(640, 400, true);
  await page.close();
  for (const path of ['/guide', '/diff']) {
    const entry = await openPage(context, legacyGlobal + path);
    await entry
      .getByRole('button', {name: '迁移存档到新域名', exact: true})
      .waitFor();
    const direct = entry.getByRole('link', {
      name: '直接访问新域名',
      exact: true,
    });
    await direct.focus();
    assert.equal(
      await direct.getAttribute('href'),
      entry.url().replace(legacyGlobal, newGlobal),
    );
    console.log('  旧域入口 ' + path + ' 展示迁移提示和对应新域深链');
    await entry.close();
  }
}

async function checkFloatingDownload(context) {
  const settings = await openPage(context, legacyGlobal + '/settings');
  await settings.waitForFunction(() =>
    document.documentElement.hasAttribute('data-floating-window'),
  );
  await settings.locator('.mirror-only').waitFor();
  const backup = JSON.parse(
    (await downloadBytes(settings, '下载迁移备份')).toString('utf8'),
  );
  assert.equal(backup.version, 5);
  assert.equal(backup.season, oldSeason);
  assert.equal(backup.box[fromBox], 3);
  assert.deepEqual(Object.keys(backup.tools).sort(), ['mistakes', 'recent']);
  console.log('  640×400 旧域浮窗仅显示交接设置；下载的 v5 备份包含旧季存档');
}

async function transfer(context, scenario) {
  const {
    source,
    destination,
    existing,
    fetch,
    button,
    banner,
    cancelRetry,
    crossSeason,
    restoreTools,
    legacySite,
    seasonOnly,
  } = scenario;
  const origin = fetch ? destination : source;
  const peer = fetch ? source : destination;
  const migrating = pairs.some(
    ([old, current]) => source === old && destination === current,
  );
  const season = crossSeason ? nextSeason : oldSeason;
  const sourceSave = fixture(true, oldSeason, seasonOnly);
  const before = readSave(existing ? fixture(false, season) : {}, season);
  const original = readSave(sourceSave, oldSeason);
  const page = await openPage(
    context,
    origin + (banner ? deepPath : '/settings'),
  );
  if (crossSeason) {
    // This label is compiled from the running site's SEASON_META, independent of all seeded storage.
    const settings = fetch
      ? page
      : await openPage(context, destination + '/settings');
    await settings.locator('.settings-season-meta .tag').first().waitFor();
    assert.equal(
      (
        await settings.locator('.settings-season-meta .tag').first().innerText()
      ).trim(),
      season.toUpperCase(),
    );
    if (settings !== page) await settings.close();
  }
  const requests = [];
  context.on('request', (request) => {
    const url = new URL(request.url());
    if (
      url.origin === peer &&
      url.pathname === '/settings' &&
      request.isNavigationRequest()
    )
      requests.push(url);
  });
  async function start() {
    const [child] = await Promise.all([
      page.waitForEvent('popup'),
      page.getByRole('button', {name: button, exact: true}).click(),
    ]);
    return fetch ? page : child;
  }
  let receiving = await start();
  const confirm = () =>
    receiving.getByRole('button', {name: '确认合并所选内容', exact: true});
  const cancel = () =>
    receiving
      .locator('.settings-preview')
      .getByRole('button', {name: '取消', exact: true})
      .click();
  const readDestination = async () =>
    readSave(await rawStorage(receiving), season);
  const message = () =>
    receiving.evaluate(() =>
      JSON.parse(sessionStorage.getItem('rehearsal-message')),
    );
  if (existing || crossSeason) {
    await confirm().waitFor();
    assert.deepEqual(
      await readDestination(),
      before,
      'Preview changed destination data',
    );
    if (cancelRetry) {
      await cancel();
      await confirm().waitFor({state: 'hidden'});
      assert.deepEqual(
        await readDestination(),
        before,
        'Cancelling changed destination data',
      );
      receiving = await start();
      await confirm().waitFor();
    }
    if (crossSeason) {
      assert.deepEqual(
        await downloadBytes(receiving, '下载来源原始备份'),
        Buffer.from((await message()).raw),
        'Download must contain the exact original UTF-8 document',
      );
    } else if (migrating) {
      for (const id of ['mistakes', 'recent']) {
        const group = receiving.locator(
          '.settings-preview input[value="' + id + '"]',
        );
        assert.equal(
          await group.isChecked(),
          false,
          'Conflicting history should be opt-in',
        );
        if (restoreTools) await group.check();
      }
    }
    // The cross-season preview may leave settings opt-in even on a blank destination.
    if (crossSeason && !seasonOnly) {
      const settings = receiving
        .locator('.settings-preview')
        .getByRole('checkbox', {name: /界面设置/});
      if (await settings.count()) await settings.check();
      const box = receiving
        .locator('.settings-preview')
        .getByRole('checkbox', {name: /Box|练度/});
      if (await box.count()) await box.check();
    }
    if (seasonOnly) await cancel();
    else await confirm().click();
  }
  if (!seasonOnly)
    await receiving.waitForFunction(
      ({key, avatar}) =>
        JSON.parse(localStorage.getItem(key) || '{}')[avatar] === 3,
      {key: boxKey, avatar: fromBox},
    );
  assert.equal(new URL(receiving.url()).origin, destination);
  const restoringHistory =
    migrating && !crossSeason && (!existing || restoreTools);
  if (restoringHistory)
    await receiving.waitForFunction(
      () => performance.getEntriesByType('navigation')[0]?.type === 'reload',
    );
  const expected = {...before};
  if (!seasonOnly) {
    expected.theme = 'dark';
    expected.owned = {...before.owned, ...original.owned};
    if (!crossSeason) {
      expected.plans = [...before.plans, ...original.plans].sort();
      expected.borrowed = [...before.borrowed, ...original.borrowed].sort();
    }
    if (restoringHistory) {
      expected.mistakes = original.mistakes;
      expected.recent = original.recent;
    }
  }
  assert.deepEqual(
    await readDestination(),
    expected,
    'Unexpected destination save',
  );
  if (crossSeason) {
    const entries = await rawStorage(receiving);
    for (const key of Object.values(seasonKeys(oldSeason)))
      assert.equal(
        entries[key],
        undefined,
        'Old season data written into target domain: ' + key,
      );
    assert.equal(
      JSON.parse(entries[boxKey] || '{}')[sourceBorrow],
      undefined,
      'S1 borrowed rank leaked into shared Box',
    );
  }
  const captured = await message();
  const backup = JSON.parse(captured.raw);
  assert.equal(captured.origin, source);
  assert(
    migrating ? backup.version === 5 : [1, 2, 3, 4].includes(backup.version),
    'Unexpected transfer version ' + backup.version,
  );
  assert.deepEqual(
    Object.keys(backup.tools ?? {}).sort(),
    migrating ? ['mistakes', 'recent'] : [],
  );
  assert.equal(backup.season ?? 's1', oldSeason);
  const handoff = requests.find(
    (url) =>
      url.searchParams.get('mirror-action') === (fetch ? 'fetch' : 'send'),
  );
  assert(handoff, 'Expected navigation to the handoff URL at ' + peer);
  if (legacySite)
    assert.equal(
      handoff.searchParams.has('mirror-from'),
      false,
      'Legacy pair must retain its original URL',
    );
  const sourceState = (await context.storageState()).origins.find(
    (item) => item.origin === source,
  );
  assert.deepEqual(
    readSave(
      Object.fromEntries(
        sourceState.localStorage.map((item) => [item.name, item.value]),
      ),
      oldSeason,
    ),
    original,
    'Source save changed',
  );
  console.log(
    '  ' +
      source +
      ' → ' +
      destination +
      ' · ' +
      button +
      ' · ' +
      oldSeason +
      ' → ' +
      season +
      ' · ' +
      (seasonOnly
        ? '仅旧季原文下载'
        : crossSeason
          ? '确认账号项、原文下载'
          : cancelRetry
            ? '取消后重试合并'
            : existing
              ? '确认合并'
              : '空站自动导入'),
  );
}

// Same-generation buttons keep their ordinary site names; cross-generation buttons identify the old/new domain.
const pairs = [
  [legacyGlobal, newGlobal, '主站'],
  [legacyMainland, newMainland, '大陆镜像'],
];
const scenarios = [
  ...pairs.flatMap(([source, destination, label]) => [
    {source, destination, button: '迁移存档到新域名', banner: true},
    {
      source,
      destination,
      button: '从旧' + label + '取回存档',
      fetch: true,
      existing: true,
      cancelRetry: true,
      restoreTools: source === legacyMainland,
    },
  ]),
  ...[
    [legacyGlobal, legacyMainland],
    [newGlobal, newMainland],
  ].flatMap(([global, mainland]) => [
    {source: global, destination: mainland, button: '携带存档切换到大陆镜像'},
    {
      source: mainland,
      destination: global,
      button: '携带存档切换到主站',
      existing: true,
    },
  ]),
  ...(values['next-season-dist']
    ? pairs.flatMap(([source, destination, label]) => [
        {
          source,
          destination,
          crossSeason: true,
          fetch: true,
          button: '从旧' + label + '取回存档',
          existing: true,
          cancelRetry: true,
        },
        {
          source,
          destination,
          crossSeason: true,
          button: '迁移存档到新域名',
          banner: true,
          seasonOnly: source === legacyGlobal,
        },
      ])
    : []),
  ...(values['legacy-dist']
    ? [
        {
          source: legacyGlobal,
          destination: legacyMainland,
          legacySite: legacyGlobal,
          button: '携带存档切换到大陆镜像',
        },
        {
          source: legacyMainland,
          destination: legacyGlobal,
          legacySite: legacyGlobal,
          button: '携带存档切换到主站',
        },
      ]
    : []),
];

async function rehearse(browser, serviceWorkers, deployed) {
  console.log(`Service worker ${serviceWorkers === 'allow' ? 'ON' : 'OFF'}`);
  async function withContext(scenario, callback, options = {}) {
    deployed.retired = false;
    deployed.legacySite = scenario.legacySite;
    deployed.nextSite = scenario.crossSeason ? scenario.destination : null;
    const context = await browser.newContext({
      serviceWorkers,
      reducedMotion: 'reduce',
      viewport: {width: 1280, height: 900},
      storageState: makeStorageState(scenario),
      ...options,
    });
    context.setDefaultTimeout(timeout);
    try {
      // Keep the synthetic test payload in this isolated context for schema and byte-for-byte download checks.
      await context.addInitScript(() => {
        window.addEventListener('message', ({origin, data}) => {
          if (
            data?.channel !== 'wsq.mirror.backup.v1' ||
            data.type !== 'backup'
          )
            return;
          sessionStorage.setItem(
            'rehearsal-message',
            JSON.stringify({origin, raw: data.text}),
          );
        });
      });
      if (serviceWorkers === 'allow') {
        const pages = await Promise.all(
          [scenario.source, scenario.destination].map((origin) =>
            warm(context, origin),
          ),
        );
        await Promise.all(pages.map((page) => page.close()));
      }
      await callback(context);
    } catch (cause) {
      for (const page of context.pages()) {
        const notices = await page
          .locator('[role="alert"], [role="status"]')
          .allTextContents()
          .catch(() => []);
        console.error(
          `  ${page.url()} ${notices.join(' ').trim().slice(0, 500)}`,
        );
      }
      throw new Error(
        `Failed ${scenario.source} → ${scenario.destination}, ${scenario.button}, ${serviceWorkers}, retired=${deployed.retired}`,
        {cause},
      );
    } finally {
      await context.close();
      deployed.retired = false;
    }
  }
  if (values.phase !== 'retired') {
    if (serviceWorkers === 'block' || values.sw === 'on') {
      await withContext(scenarios[0], checkNoticeLayout);
      await withContext(scenarios[0], checkFloatingDownload, {
        hasTouch: true,
        isMobile: true,
        viewport: {width: 640, height: 400},
        screen: {width: 1440, height: 900},
      });
    }
    if (values.phase === 'layout') return;
    for (const scenario of scenarios) {
      await withContext(scenario, async (context) => {
        if (scenario.banner)
          await followLink(
            await openPage(context, scenario.source + deepPath),
            scenario.destination + deepPath,
          );
        await transfer(context, scenario);
      });
    }
  }
  if (values.phase !== 'parallel') {
    for (const [source, destination, label] of pairs) {
      const scenario = {
        source,
        destination,
        button: '从旧' + label + '取回存档',
        fetch: true,
        existing: true,
        restoreTools: true,
        crossSeason: !!values['next-season-dist'],
      };
      await withContext(scenario, async (context) => {
        let monitor;
        if (serviceWorkers === 'allow') {
          monitor = await warm(context, source);
          await monitor.waitForFunction(async () =>
            (await caches.keys()).some((name) => name.startsWith('wsq-')),
          );
          await monitor.evaluate(() =>
            caches.open('rehearsal-unrelated').then(() => true),
          );
        }
        deployed.retired = true;
        const landing = await openPage(context, source + deepPath);
        await landing.waitForURL(destination + deepPath);
        assert.equal(
          JSON.parse((await rawStorage(landing))[settingsKey]).theme,
          'light',
          'An ordinary redirect changed destination data',
        );
        await transfer(context, scenario);
        if (monitor) {
          // Browsers throttle background SW updates; make the update check deterministic after first-hop recovery.
          await monitor.evaluate(async () => {
            const registration =
              await navigator.serviceWorker.getRegistration();
            if (registration)
              await registration.update().catch(async (error) => {
                if (await navigator.serviceWorker.getRegistration())
                  throw error;
              });
          });
          await monitor.waitForFunction(
            async () =>
              !(await navigator.serviceWorker.getRegistration()) &&
              !(await caches.keys()).some((name) => name.startsWith('wsq-')),
          );
          assert(
            await monitor.evaluate(() => caches.has('rehearsal-unrelated')),
            'Unrelated cache removed',
          );
          assert.deepEqual(
            readSave(await rawStorage(monitor), oldSeason),
            readSave(fixture(true, oldSeason), oldSeason),
          );
        }
        console.log(
          '  退役后的旧深链保持路径、查询参数、片段；已从旧站取回存档',
        );
      });
    }
  }
}

assert(
  existsSync(join(dist, 'settings.html')),
  'Build dist with VITE_DOMAIN_MIGRATION=parallel and WSQ_STATIC_ROUTES=1 first',
);
if (values['legacy-dist'])
  assert(
    existsSync(resolve(values['legacy-dist'], 'settings.html')),
    'Missing legacy dist/settings.html',
  );
if (values['next-season-dist']) {
  assert.notEqual(
    nextSeason,
    oldSeason,
    'The two builds must target different seasons',
  );
  assert(
    existsSync(resolve(values['next-season-dist'], 'settings.html')),
    'Missing next-season dist/settings.html',
  );
}
const chromium = loadChromium();
const [adapters, tls] = await Promise.all([
  loadRetirement(),
  temporaryCertificate(),
]);
const deployed = {retired: false};
let browser;
const server = createServer(tls, async (req, res) => {
  try {
    if (!hosts.includes(req.headers.host) || req.method !== 'GET')
      return res.writeHead(403).end();
    const origin = 'https://' + req.headers.host;
    const url = new URL(req.url, origin);
    if (url.origin !== origin) return res.writeHead(403).end();
    const adapter = deployed.retired && adapters.get(origin);
    const directory =
      deployed.legacySite === origin
        ? resolve(values['legacy-dist'])
        : deployed.nextSite === origin
          ? resolve(values['next-season-dist'])
          : dist;
    const result = adapter
      ? await adapter(new Request(url, {headers: req.headers}))
      : await staticResponse(url, directory);
    res
      .writeHead(result.status, Object.fromEntries(result.headers))
      .end(Buffer.from(await result.arrayBuffer()));
  } catch (error) {
    console.error(error);
    res.writeHead(500).end();
  }
});
try {
  await new Promise((ok, fail) =>
    server.once('error', fail).listen(0, '127.0.0.1', ok),
  );
  const mappings = hosts.map(
    (host) => `MAP ${host}:443 127.0.0.1:${server.address().port}`,
  );
  // Deny all remaining names inside Chromium's resolver, including requests made by workers.
  mappings.push('MAP * ~NOTFOUND');
  browser = await chromium.launch({
    headless: true,
    channel: process.env.WSQ_CHROMIUM_CHANNEL,
    executablePath: process.env.WSQ_CHROMIUM_EXECUTABLE,
    args: [
      '--no-proxy-server',
      '--disable-quic',
      '--disable-background-networking',
      '--host-resolver-rules=' + mappings.join(', '),
      '--ignore-certificate-errors-spki-list=' + tls.pin,
    ],
  });
  for (const mode of values.sw === 'both'
    ? ['block', 'allow']
    : [values.sw === 'on' ? 'allow' : 'block']) {
    await rehearse(browser, mode, deployed);
  }
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise((ok) => server.close(ok));
}
