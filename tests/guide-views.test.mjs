import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ADDON_COVENANTS,
  ALL_COVENANTS,
  COMBAT_ROLE_LABELS,
  CORE_COVENANTS,
  CORE_BUILDS,
  COVENANTS,
  DISPATCH_MODES,
  EQUIPMENT_COMBOS,
  MIXED_BUILDS,
  MODES,
  RESTRICTED_MODE_COVENANTS,
  STRATEGY_CATEGORIES,
  TRAINING,
} from '../data/index.ts';
import {
  basicsContent,
  creditChart,
  roundTimeline,
} from '../src/guide/chapters/basicsView.ts';
import {drawBuild, mixedBuilds} from '../src/guide/chapters/buildsView.ts';
import {
  covenantContent,
  covenantCurve,
  covenantGrid,
  strategies,
} from '../src/guide/chapters/covenantsView.ts';
import {enemyContent, jointDefense} from '../src/guide/chapters/enemiesView.ts';
import {
  dispatchTable,
  eliteComparison,
  poolDiagram,
  recruitContent,
} from '../src/guide/chapters/recruitView.ts';
import {ROLE_ICONS, TRAINING_ICONS, iconSvg} from '../src/guide/icons.ts';
import {chapterForAnchor, placeholders} from '../src/guide/placeholders.ts';

test('guide icons cover every season training type and combat role without missing paths', () => {
  for (const training of TRAINING) {
    const key = TRAINING_ICONS[training.name];
    assert.ok(key, `Missing icon mapping for training ${training.name}`);
    const svg = iconSvg(key);
    assert.match(svg, /^<svg /);
    assert.doesNotMatch(svg, /undefined/);
  }
  for (const role of COMBAT_ROLE_LABELS) {
    const key = ROLE_ICONS[role];
    assert.ok(key, `Missing icon mapping for combat role ${role}`);
    const svg = iconSvg(key);
    assert.match(svg, /^<svg /);
    assert.doesNotMatch(svg, /undefined/);
  }
});

test('guide chapter views stay synchronized with season data and routes', () => {
  const basics = basicsContent();
  for (const cov of RESTRICTED_MODE_COVENANTS) {
    assert.ok(basics.lvmiss.includes(cov), `lvmiss missing ${cov}`);
  }
  MODES.forEach((_, index) => {
    assert.ok(roundTimeline(index).tl.length > 0);
    assert.ok(creditChart(index).crchart.length > 0);
  });

  const recruit = recruitContent();
  for (const [, , result] of EQUIPMENT_COMBOS) {
    assert.ok(recruit.combos.includes(result), `combos missing ${result}`);
  }
  DISPATCH_MODES.forEach((_, modeIndex) => {
    assert.match(dispatchTable(modeIndex), /<tr>/);
  });
  assert.match(eliteComparison('星极'), /二合一晋升/);
  assert.match(eliteComparison('乌啾'), /三合一晋升/);
  assert.match(poolDiagram(0), /顺利三合一/);
  assert.match(poolDiagram(1), /合不出精锐/);

  const enemies = enemyContent();
  assert.match(jointDefense(), /联防战场/);
  assert.match(enemies.bty, /低危过渡/);
  assert.match(enemies.decTbl, /机变阶段/);

  assert.match(covenantContent().stk, /折桠\/乌啾/);
  const allGrid = covenantGrid('all');
  const coreGrid = covenantGrid('core');
  const addonGrid = covenantGrid('addon');
  for (const name of ALL_COVENANTS) assert.ok(allGrid.includes(name));
  for (const name of CORE_COVENANTS) assert.ok(coreGrid.includes(name));
  for (const name of ADDON_COVENANTS) assert.ok(addonGrid.includes(name));

  const dexterityCurve = covenantCurve('灵巧');
  assert.ok(dexterityCurve.milestones.some((ms) => ms.layers === 40));

  STRATEGY_CATEGORIES.forEach((_, idx) => {
    assert.match(strategies(idx).stcnt, /名$/);
  });

  for (const cov of CORE_COVENANTS) {
    const html = drawBuild(cov);
    assert.ok(html.includes(`/builds/${COVENANTS[cov].id}`));
    assert.doesNotMatch(html, /<(?:div|svg|span|p)[a-z]+=/i);
    assert.match(html, /<svg class="spark"/);
    assert.equal(
      (html.match(/<div class="[^"]*" data-key="[^"]*" data-op="/g) ?? [])
        .length,
      CORE_BUILDS[cov].lineup.length,
      `Expected one intact lineup card per operator in drawBuild(${cov})`,
    );
  }
  const mixedHtml = mixedBuilds();
  for (const mb of MIXED_BUILDS) {
    assert.ok(mixedHtml.includes(`/builds/${mb.id}`));
  }

  for (const id of ['c1', 'c2', 'c3', 'c4', 'c5', 'c6']) {
    assert.ok(placeholders[id]?.trim().length > 0, `Missing placeholder ${id}`);
  }
  assert.equal(chapterForAnchor('s44'), 'c4');
});
