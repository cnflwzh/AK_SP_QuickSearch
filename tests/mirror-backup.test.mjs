import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mirrorPeer,
  mirrorTransferUrl,
  parseMirrorEntry,
} from '../src/lib/settings/mirrorSite.ts';
import {compareMirrorBackup} from '../src/lib/settings/mirrorBackup.ts';
import {createDefaultSettings} from '../src/lib/settings/model.ts';
import {blankPlan} from '../src/lib/plans/storage.ts';

test('交接只能在两个正式站点之间或本机同端口之间进行', () => {
  for (const [a, b] of [
    ['https://sp.enjoyacg.com', 'https://ak.cnflwzh.top'],
    ['http://localhost:4189', 'http://127.0.0.1:4189'],
  ]) {
    assert.equal(mirrorPeer(a).origin, b);
    assert.equal(mirrorPeer(b).origin, a);
  }
  for (const other of [
    'https://sp.enjoyacg.com.example',
    'https://ak.cnflwzh.top:8443',
    'http://sp.enjoyacg.com',
    'https://develop.example',
  ]) {
    assert.equal(mirrorPeer(other), null);
  }
});

const oldGlobal = 'https://sp.enjoyacg.com';
const oldMainland = 'https://ak.cnflwzh.top';
const newGlobal = 'https://global.arksp.top';
const newMainland = 'https://arksp.top';
const token = 'b28c2aaa-00ac-4921-a068-22a262c7c0ef';

test('允许的请求往返时，接收页认定的来源和动作均与发起页一致', () => {
  for (const [origin, target] of [
    [oldGlobal, oldMainland],
    [newGlobal, newMainland],
    [oldGlobal, newGlobal],
    [oldMainland, newMainland],
  ]) {
    for (const [from, to] of [
      [origin, target],
      [target, origin],
    ]) {
      for (const direction of ['send', 'fetch']) {
        const url = new URL(
          mirrorTransferUrl(from, to, direction, token, true),
        );
        assert.equal(url.origin, to);
        const entry = parseMirrorEntry(url, true);
        assert.equal(entry.token, token);
        assert.equal(entry.direction, direction);
        assert.equal(entry.peer.origin, from);
      }
    }
  }
});

test('默认构建与旧版互通，原链接及无方向的旧协议只匹配同代镜像', () => {
  const url = mirrorTransferUrl(oldGlobal, oldMainland, 'fetch', token, false);
  assert.equal(
    url,
    oldMainland + '/settings?mirror-action=fetch#mirror-backup=' + token,
  );
  const legacy = new URL(url);
  legacy.search = '';
  assert.equal(parseMirrorEntry(legacy, true).peer.origin, oldGlobal);
  assert.equal(parseMirrorEntry(legacy, true).direction, null);
  assert.equal(mirrorPeer(newGlobal, false), null);
  for (const [from, to] of [
    [oldGlobal, newGlobal],
    [newGlobal, oldGlobal],
    [newGlobal, newMainland],
  ]) {
    assert.equal(mirrorTransferUrl(from, to, 'send', token, false), null);
    assert.equal(
      parseMirrorEntry(
        new URL(mirrorTransferUrl(from, to, 'fetch', token, true)),
        false,
      ),
      null,
    );
  }
});

test('交接拒绝跨地区跨代、仿冒来源、含糊入口及无效会话片段', () => {
  for (const target of [
    newMainland,
    oldGlobal,
    newGlobal + ':444',
    newGlobal + '.example',
    'http://global.arksp.top',
  ]) {
    assert.equal(
      mirrorTransferUrl(oldGlobal, target, 'send', token, true),
      null,
    );
  }
  const valid = new URL(
    mirrorTransferUrl(oldMainland, newMainland, 'send', token, true),
  );
  for (const search of [
    '?mirror-action=send',
    '?mirror-action=send&mirror-from=',
    '?mirror-from=' + oldMainland,
    '?mirror-action=other&mirror-from=' + oldMainland,
    '?mirror-action=send&mirror-from=' + oldGlobal,
    '?mirror-action=send&mirror-from=' + newMainland,
    '?mirror-action=send&mirror-from=' + oldMainland + '.example',
    '?mirror-action=send&mirror-from=' + oldMainland + '/',
    valid.search + '&mirror-from=' + oldMainland,
    valid.search + '&mirror-action=fetch',
  ]) {
    const url = new URL(valid);
    url.search = search;
    assert.equal(parseMirrorEntry(url, true), null, search);
  }
  assert.equal(
    parseMirrorEntry(new URL(valid.href.replace('/settings', '/box')), true),
    null,
  );
  assert.equal(parseMirrorEntry(new URL(valid.href + '0'), true), null);
  assert.equal(
    mirrorTransferUrl(oldMainland, newMainland, 'send', 'invalid', true),
    null,
  );
});

test('交接预览识别空站、默认偏好、同名冲突及 Box 的实际增量', () => {
  const defaults = createDefaultSettings();
  const local = blankPlan('自建阵容');
  const incoming = {...local, note: '另一站的修改'};
  const backup = {
    settings: defaults,
    plans: [incoming],
    box: {one: 1, two: 0, three: 2},
  };
  assert.equal(compareMirrorBackup(backup, defaults, [], {}).empty, true);
  const changes = compareMirrorBackup(
    backup,
    {...defaults, theme: 'dark'},
    [local],
    {one: 3, three: 0},
  );
  assert.deepEqual(changes, {
    settings: 1,
    incomingDefault: true,
    empty: false,
    plans: 1,
    conflicts: 1,
    newOperators: 1,
    upgrades: 1,
  });
  // 从另一站返回时，内容相同但本机 ID 不同的方案不会再次新增。
  assert.equal(
    compareMirrorBackup(backup, defaults, [{...incoming, id: 'copied'}], {})
      .plans,
    0,
  );
});
