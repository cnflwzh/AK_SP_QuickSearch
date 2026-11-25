import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_RECENT_ITEMS,
  RECENT_STORAGE_KEY,
  clearRecent,
  isValidRecentItem,
  recentItems,
  recordRecent,
  sanitizeRecentList,
} from '../src/quickref/recentStore.ts';

test('recentStore validates entities, deduplicates, moves latest to front, and caps length', () => {
  clearRecent();
  assert.equal(recentItems.value.length, 0);
  assert.equal(isValidRecentItem('op', '拜松'), true);
  assert.equal(isValidRecentItem('op', '不存在的干员'), false);
  assert.equal(isValidRecentItem('cv', '炎'), true);
  assert.equal(isValidRecentItem('ld', '假想敌：胄'), true);

  recordRecent('op', '拜松');
  recordRecent('cv', '炎');
  recordRecent('op', '拜松');
  assert.deepEqual(recentItems.value, [
    {kind: 'op', name: '拜松'},
    {kind: 'cv', name: '炎'},
  ]);

  recordRecent('op', '无效');
  assert.equal(recentItems.value.length, 2);

  const sanitized = sanitizeRecentList([
    {kind: 'op', name: '拜松'},
    {kind: 'op', name: '拜松'},
    {kind: 'bad', name: '炎'},
    {kind: 'eq', name: '维式重锤'},
    {kind: 'st', name: '杜遥夜'},
    {kind: 'ld', name: '假想敌：胄'},
  ]);
  assert.deepEqual(sanitized, [
    {kind: 'op', name: '拜松'},
    {kind: 'eq', name: '维式重锤'},
    {kind: 'st', name: '杜遥夜'},
    {kind: 'ld', name: '假想敌：胄'},
  ]);

  for (const name of [
    '折桠',
    '艾丝黛尔',
    '幽灵鲨',
    '野鬃',
    '慕斯',
    '角峰',
    '灰喉',
    '深靛',
    '卡达',
    '摆渡人',
  ]) {
    recordRecent('op', name);
  }
  assert.equal(recentItems.value.length, MAX_RECENT_ITEMS);
  assert.equal(recentItems.value[0].name, '摆渡人');

  clearRecent();
  assert.equal(recentItems.value.length, 0);
});

test('记录最近查看前重读其他标签页的写入与清空', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const disk = new Map();
  const storage = {
    getItem: (key) => disk.get(key) ?? null,
    setItem: (key, value) => disk.set(key, value),
  };
  Object.defineProperty(globalThis, 'localStorage', {value: storage, configurable: true});
  try {
    clearRecent();
    recordRecent('op', '拜松');
    disk.set(RECENT_STORAGE_KEY, JSON.stringify([{kind: 'cv', name: '炎'}]));
    recordRecent('op', '乌啾');
    assert.deepEqual(recentItems.value, [
      {kind: 'op', name: '乌啾'},
      {kind: 'cv', name: '炎'},
    ]);
    disk.delete(RECENT_STORAGE_KEY);
    recordRecent('op', '拜松');
    assert.deepEqual(recentItems.value, [{kind: 'op', name: '拜松'}]);
  } finally {
    clearRecent();
    if (original === undefined) delete globalThis.localStorage;
    else Object.defineProperty(globalThis, 'localStorage', original);
  }
});
