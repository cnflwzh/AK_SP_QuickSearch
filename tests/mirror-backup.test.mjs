import assert from 'node:assert/strict';
import test from 'node:test';
import {mirrorPeer} from '../src/lib/settings/mirrorSite.ts';
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
