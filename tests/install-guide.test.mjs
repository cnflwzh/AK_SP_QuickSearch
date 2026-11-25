import assert from 'node:assert/strict';
import test from 'node:test';
import {getInstallGuide} from '../src/lib/runtime/installGuide.ts';

const win = 'Windows NT 10.0; Win64; x64';
const android = 'Linux; Android 10; K';
const mac = 'Macintosh; Intel Mac OS X 10_15_7';
const chrome = 'Chrome/145.0.0.0 Safari/537.36';
const androidChrome = 'Chrome/145.0.0.0 Mobile Safari/537.36';
const safari = 'Version/18.0 Mobile/15E148 Safari/604.1';

function webkit(platform, product) {
  const engine = product.includes('Chrome/') ? '537.36' : '605.1.15';
  return (
    'Mozilla/5.0 (' +
    platform +
    ') AppleWebKit/' +
    engine +
    ' (KHTML, like Gecko) ' +
    product
  );
}

function device(userAgent, brands, maxTouchPoints = 0) {
  const userAgentData = brands && {brands: brands.map((brand) => ({brand}))};
  return (
    getInstallGuide({userAgent, userAgentData, maxTouchPoints})?.device ?? null
  );
}

test('Chromium 内核、第三方壳和安装能力不能代替明确的浏览器品牌', () => {
  assert.equal(
    device(webkit(win, chrome), ['Chromium', 'Google Chrome']),
    '桌面版 Chrome',
  );
  assert.equal(
    device(webkit(android, androidChrome), ['Google Chrome']),
    'Android · Chrome',
  );
  assert.equal(
    device(webkit(win, chrome + ' Edg/145.0'), ['Microsoft Edge']),
    '桌面版 Edge',
  );
  assert.equal(
    device(webkit(android, androidChrome + ' EdgA/145.0')),
    'Android · Edge',
  );
  assert.equal(
    device(webkit(android, 'SamsungBrowser/30.0 ' + androidChrome)),
    'Android · 三星浏览器',
  );
  assert.equal(device(webkit(win, chrome)), null);
  assert.equal(
    device(webkit(android, androidChrome), ['Chromium', 'Unknown Browser']),
    null,
  );
  assert.equal(
    device(webkit(android, androidChrome + ' Quark/8.0'), ['Google Chrome']),
    null,
  );
  assert.equal(
    device(webkit(android + '; wv', 'Version/4.0 ' + androidChrome), [
      'Android WebView',
    ]),
    null,
  );
  assert.equal(
    device(webkit(win, chrome + ' Edg/145.0'), ['Other Browser']),
    null,
  );
});

test('Apple 移动端匹配共享菜单入口，桌面模式的 iPad 与 Mac 分别判断', () => {
  const phone = (version) =>
    'iPhone; CPU iPhone OS ' + version + ' like Mac OS X';
  assert.equal(device(webkit(phone('18_6'), safari)), 'iPhone · Safari');
  assert.equal(
    device(webkit(phone('18_6'), safari + ' MicroMessenger/8.0')),
    null,
  );
  assert.equal(device(webkit(phone('18_6'), 'Mobile/15E148')), null);
  for (const [product, browser] of [
    ['CriOS/145.0', 'Chrome'],
    ['EdgiOS/145.0 Version/18.0', 'Edge'],
    ['FxiOS/145.0', 'Firefox'],
  ]) {
    const suffix = product + ' Mobile/15E148 Safari/604.1';
    assert.equal(device(webkit(phone('16_3'), suffix)), null);
    assert.equal(device(webkit(phone('16_4'), suffix)), 'iPhone · ' + browser);
  }
  const desktopSafari = 'Version/17.0 Safari/605.1.15';
  assert.equal(
    device(webkit(mac, desktopSafari), undefined, 5),
    'iPad · Safari',
  );
  assert.equal(device(webkit(mac, desktopSafari)), null);
  assert.equal(
    device(webkit('Macintosh; Intel Mac OS X 13_6', desktopSafari)),
    null,
  );
  assert.equal(
    device(webkit('Macintosh; Intel Mac OS X 14_0', desktopSafari)),
    'Mac · Safari',
  );
  assert.equal(
    device(webkit(mac, 'Version/26.0 Safari/605.1.15')),
    'Mac · Safari',
  );
});

test('Firefox 仅在已支持的平台和版本提供本机安装引导', () => {
  const firefox = (platform, major) =>
    'Mozilla/5.0 (' +
    platform +
    '; rv:' +
    major +
    '.0) Gecko/20100101 Firefox/' +
    major +
    '.0';
  assert.equal(device(firefox(win, 149)), null);
  assert.equal(device(firefox(win, 150)), 'Windows · Firefox');
  assert.equal(device(firefox(mac, 150)), null);
  assert.equal(device(firefox('X11; Linux x86_64', 150)), null);
  assert.equal(
    device(
      'Mozilla/5.0 (Android 15; Mobile; rv:150.0) Gecko/150.0 Firefox/150.0',
    ),
    'Android · Firefox',
  );
});
