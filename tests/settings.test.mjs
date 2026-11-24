import assert from 'node:assert/strict';
import test from 'node:test';
import {builtinPlan} from '../src/lib/plans/index.ts';
import {
  CONTENT_TAB_IDS,
  CUSTOMIZABLE_TOOL_IDS,
  DEFAULT_SETTINGS,
  applySettings,
  createDefaultSettings,
  moveContentTab,
  normalizeSettings,
  parseSettingsBackup,
  reorderContentTabs,
  resetAllSettings,
  resetContentTabs,
  serializeSettingsBackup,
  settings,
  toggleContentTabHidden,
  toggleToolHidden,
  visibleContentTabs,
} from '../src/lib/settings/index.ts';

import {hasFloatingWindowBounds} from '../src/lib/ui/windowMode.ts';
import {
  DEFAULT_BREAKPOINTS,
  normalizeBreakpoints,
  resolveViewportLayout,
} from '../src/lib/ui/viewportLayout.ts';

test('手机整屏竖放显示教程，小窗和宽矮窗口使用各自的搜索布局', () => {
  for (const height of [732, 788]) {
    const result = resolveViewportLayout(384, height);
    assert.equal(result.showHeader && result.showGuide, true);
    assert.equal(result.search, 'row');
  }
  for (const [width, height, search] of [
    [384, 498, 'takeover'],
    [384, 460, 'takeover'],
    [384, 554, 'takeover'],
    [384, 516, 'takeover'],
    [808, 263, 'inline'],
    [808, 319, 'inline'],
  ]) {
    const result = resolveViewportLayout(width, height);
    assert.equal(result.showHeader || result.showGuide, false);
    assert.equal(result.search, search);
  }
  assert.equal(resolveViewportLayout(360, 844).showHeader, false);
  assert.equal(resolveViewportLayout(625, 670).showHeader, false);
  assert.equal(resolveViewportLayout(1280, 900).showGuide, true);
  assert.equal(
    resolveViewportLayout(384, 788, DEFAULT_BREAKPOINTS, true).showHeader,
    false,
  );
});

test('断点可独立校正、从设置备份恢复，非法单项用默认值', () => {
  const custom = normalizeBreakpoints({
    phoneWindowHeight: 750,
    narrowWidth: -10,
    squareWidth: '500',
  });
  assert.deepEqual(custom, {...DEFAULT_BREAKPOINTS, phoneWindowHeight: 750});
  assert.equal(resolveViewportLayout(384, 732, custom).showGuide, false);
  assert.equal(resolveViewportLayout(384, 788, custom).showGuide, true);
  const backup = serializeSettingsBackup({
    ...createDefaultSettings(),
    viewportBreakpoints: custom,
  });
  assert.deepEqual(
    parseSettingsBackup(backup).settings.viewportBreakpoints,
    custom,
  );
});

test('only a window reduced on both screen axes has floating bounds', () => {
  // 同一尺寸既可能是折叠屏的整个内屏，也可能是大屏上的浮窗。
  assert.equal(hasFloatingWindowBounds(625, 670, 625, 670), false);
  assert.equal(hasFloatingWindowBounds(625, 670, 900, 900), true);
  assert.equal(hasFloatingWindowBounds(844, 390, 844, 390), false);
  assert.equal(hasFloatingWindowBounds(390, 460, 390, 844), false);
  assert.equal(hasFloatingWindowBounds(390, 844, 900, 844), false);
  assert.equal(hasFloatingWindowBounds(640, 400, 960, 720), true);
  assert.equal(hasFloatingWindowBounds(625, 670, 0, 0), false);
});

test('normalizeSettings deduplicates tab order, restores missing tabs, and blocks hiding all tabs or tools', () => {
  assert.deepEqual(normalizeSettings(null), createDefaultSettings());
  assert.deepEqual(normalizeSettings('invalid'), DEFAULT_SETTINGS);
  assert.equal(normalizeSettings({}).developerMode, false);
  assert.equal(normalizeSettings({developerMode: 'true'}).developerMode, false);

  const normalized = normalizeSettings({
    theme: 'dark',
    cardDensity: 'compact',
    fontScale: 'large',
    reducedMotion: true,
    tabOrder: ['nu', 'op', 'nu', 'bad', 'se'],
    hiddenTabs: [...CONTENT_TAB_IDS],
    defaultTab: 'nu',
    showTabCounts: false,
    showHeader: false,
    showRunBanner: false,
    showWikiLinks: false,
    showRequestButtons: false,
    showFooter: false,
    collapsePresetBuilds: true,
    defaultOperatorElite: true,
    enableHoverPeek: false,
    enableSwipeTabs: false,
    hiddenTools: [...CUSTOMIZABLE_TOOL_IDS],
  });

  assert.equal(normalized.theme, 'dark');
  assert.equal(normalized.cardDensity, 'compact');
  assert.equal(normalized.fontScale, 'large');
  assert.equal(normalized.reducedMotion, true);
  assert.deepEqual(normalized.tabOrder, [
    'nu',
    'op',
    'fx',
    'bd',
    'cv',
    'eq',
    'st',
    'ld',
  ]);
  // At least the first tab in custom order stays visible; invalid defaultTab resets if hidden.
  assert.equal(normalized.hiddenTabs.includes('nu'), false);
  assert.equal(normalized.hiddenTabs.length, CONTENT_TAB_IDS.length - 1);
  assert.equal(normalized.defaultTab, 'nu');
  assert.equal(
    normalized.hiddenTools.includes(CUSTOMIZABLE_TOOL_IDS[0]),
    false,
  );
  assert.equal(normalized.hiddenTools.length, CUSTOMIZABLE_TOOL_IDS.length - 1);
  assert.equal(normalized.showTabCounts, false);
  assert.equal(normalized.showHeader, false);
  assert.equal(normalized.showRunBanner, false);
  assert.equal(normalized.showWikiLinks, false);
  assert.equal(normalized.showRequestButtons, false);
  assert.equal(normalized.showFooter, false);
  assert.equal(normalized.collapsePresetBuilds, true);
  assert.equal(normalized.defaultOperatorElite, true);
  assert.equal(normalized.enableHoverPeek, false);
  assert.equal(normalized.enableSwipeTabs, false);

  const hiddenDefault = normalizeSettings({
    hiddenTabs: ['op'],
    defaultTab: 'op',
  });
  assert.equal(hiddenDefault.defaultTab, 'last');
});

test('settings store supports tab reordering, visibility guards, tool toggles, and reset', () => {
  resetAllSettings();
  assert.deepEqual(visibleContentTabs(), [...CONTENT_TAB_IDS]);

  assert.equal(moveContentTab('fx', -1), false);
  assert.equal(moveContentTab('nu', 1), false);
  assert.equal(moveContentTab('nu', -1), true);
  assert.deepEqual(settings.tabOrder.slice(-2), ['nu', 'ld']);
  assert.equal(reorderContentTabs('st', 'fx'), true);
  assert.equal(settings.tabOrder[0], 'st');

  for (const id of CONTENT_TAB_IDS.slice(1)) {
    assert.equal(toggleContentTabHidden(id), true);
  }
  // Cannot hide the last remaining visible content tab.
  assert.equal(visibleContentTabs().length, 1);
  assert.equal(toggleContentTabHidden(visibleContentTabs()[0]), false);

  resetContentTabs();
  assert.deepEqual(settings.tabOrder, [...CONTENT_TAB_IDS]);
  assert.deepEqual(settings.hiddenTabs, []);

  for (const id of CUSTOMIZABLE_TOOL_IDS.slice(1)) {
    assert.equal(toggleToolHidden(id), true);
  }
  assert.equal(toggleToolHidden(CUSTOMIZABLE_TOOL_IDS[0]), false);

  resetAllSettings();
  assert.deepEqual(settings.hiddenTools, []);
});

test('settings backup serializes, validates, and preserves optional plans on round trip', () => {
  resetAllSettings();
  const custom = normalizeSettings({
    developerMode: true,
    theme: 'dark',
    cardDensity: 'compact',
    tabOrder: ['op', 'st', 'fx'],
    hiddenTabs: ['ld'],
    showFooter: false,
    collapsePresetBuilds: true,
    defaultOperatorElite: true,
    hiddenTools: ['dealer'],
  });
  applySettings(custom);

  const textOnly = serializeSettingsBackup(settings);
  const parsedOnly = parseSettingsBackup(`\uFEFF${textOnly}`);
  assert.equal(parsedOnly.settings.developerMode, true);
  assert.deepEqual(parsedOnly.settings, custom);
  assert.equal(parsedOnly.plans, undefined);

  const samplePlan = builtinPlan('炎');
  assert.ok(samplePlan);
  const sampleBox = {char_325_bison: 3, char_4055_bgsnow: 2};
  const withPlans = serializeSettingsBackup(settings, [samplePlan], sampleBox);
  const parsedWithPlans = parseSettingsBackup(withPlans);
  assert.deepEqual(parsedWithPlans.settings, custom);
  assert.equal(parsedWithPlans.plans?.length, 1);
  assert.equal(parsedWithPlans.plans?.[0].name, samplePlan.name);
  assert.deepEqual(parsedWithPlans.box, sampleBox);

  assert.throws(() => parseSettingsBackup('not-json'), /无法解析 JSON/);
  assert.throws(
    () =>
      parseSettingsBackup(
        JSON.stringify({
          format: 'weishu-quickref-builds',
          version: 1,
          exportedAt: new Date().toISOString(),
          plans: [],
        }),
      ),
    /纯流派备份/,
  );
  assert.throws(
    () =>
      parseSettingsBackup(
        JSON.stringify({
          format: 'weishu-quickref-settings',
          version: 99,
          exportedAt: new Date().toISOString(),
          settings: {},
        }),
      ),
    /版本暂不支持/,
  );
  assert.throws(
    () =>
      parseSettingsBackup(
        JSON.stringify({
          format: 'weishu-quickref-settings',
          version: 1,
          exportedAt: new Date().toISOString(),
          settings: {},
          plans: [{broken: true}],
        }),
      ),
    /第 1 套流派的数据不完整/,
  );

  resetAllSettings();
});
