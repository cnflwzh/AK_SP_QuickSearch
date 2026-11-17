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
import {TAB_IDS} from '../src/router/location.ts';

test('settings tabs align with router content tabs and place settings after tools', () => {
  assert.deepEqual([...TAB_IDS], [...CONTENT_TAB_IDS, 'se']);
  assert.equal(TAB_IDS.indexOf('se'), TAB_IDS.indexOf('nu') + 1);
});

test('normalizeSettings deduplicates tab order, restores missing tabs, and blocks hiding all tabs or tools', () => {
  assert.deepEqual(normalizeSettings(null), createDefaultSettings());
  assert.deepEqual(normalizeSettings('invalid'), DEFAULT_SETTINGS);

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
    theme: 'dark',
    cardDensity: 'compact',
    tabOrder: ['op', 'st', 'fx'],
    hiddenTabs: ['ld'],
    showFooter: false,
    defaultOperatorElite: true,
    hiddenTools: ['dealer'],
  });
  applySettings(custom);

  const textOnly = serializeSettingsBackup(settings);
  const parsedOnly = parseSettingsBackup(`\uFEFF${textOnly}`);
  assert.deepEqual(parsedOnly.settings, custom);
  assert.equal(parsedOnly.plans, undefined);

  const samplePlan = builtinPlan('炎');
  assert.ok(samplePlan);
  const withPlans = serializeSettingsBackup(settings, [samplePlan]);
  const parsedWithPlans = parseSettingsBackup(withPlans);
  assert.deepEqual(parsedWithPlans.settings, custom);
  assert.equal(parsedWithPlans.plans?.length, 1);
  assert.equal(parsedWithPlans.plans?.[0].name, samplePlan.name);

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
