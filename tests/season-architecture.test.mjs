import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import {dirname, relative, resolve} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {
  ADDON_COVENANTS,
  ALL_COVENANTS,
  CORE_BUILDS,
  CORE_COVENANTS,
  COVENANTS,
  COVENANT_IDS,
  DEFAULT_BUILD_ID,
  DEFAULT_COVENANT_ID,
  DEPLOYMENT_BONUS_EQUIP,
  EQUIP,
  EQUIPMENT,
  EQUIPMENT_COMBOS,
  MIXED_BUILDS,
  MIXED_BUILD_IDS,
  OPERATOR,
  OPERATORS,
  RESERVE_COVENANTS,
  SEASON_META,
  SHARE_OPERATOR_IDS,
  STRATEGIES,
  STRATEGY,
  STRATEGY_CATEGORIES,
  isBannableCovenant,
  operatorEliteCopies,
  operatorPrice,
  strategyUsesAdvisorCommand,
} from '../data/index.ts';
import {
  covenantStats,
  decodePlan,
  encodePlan,
  newSlot,
} from '../src/lib/plans/index.ts';
import {
  advisorDeploymentLimit,
  newAdvisorRun,
  recruitPriceRange,
} from '../src/lib/recommendation/live/advisorState.ts';
import {explainStrategyTransition} from '../src/lib/recommendation/live/advisorStrategy.ts';
import {buildKey, covenantName} from '../src/router/entities.ts';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function walkFiles(dir, extensions) {
  const results = [];
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    if (
      entry.name === 'node_modules' ||
      entry.name === 'dist' ||
      entry.name === '.git'
    ) {
      continue;
    }
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(full, extensions));
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Strips JS/TS comments (and HTML comments for .vue) while preserving string,
 * template (including nested ${...}), and regex literals. Returns both the
 * comment-stripped source and extracted static string/template literal chunks.
 */
function stripCommentsAndExtractLiterals(source, isVue = false) {
  const input = isVue ? source.replace(/<!--[\s\S]*?-->/g, ' ') : source;
  let out = '';
  const literals = [];
  const stack = []; // 'template' | 'expr'
  let i = 0;
  let lastSignificant = '';

  const regexCanPrecede = (ch, indexBefore) => {
    if (!ch || '(=[,;:?!&|{}~^+-*%<>'.includes(ch)) return true;
    const prefix = input.slice(Math.max(0, indexBefore - 12), indexBefore + 1);
    return /\b(?:return|case|throw|typeof|void|delete|yield|await|in|of|else|do)$/.test(
      prefix,
    );
  };

  while (i < input.length) {
    const mode = stack.at(-1);
    if (mode === 'template') {
      let chunk = '';
      while (i < input.length) {
        const ch = input[i];
        if (ch === '\\' && i + 1 < input.length) {
          chunk += input.slice(i, i + 2);
          out += input.slice(i, i + 2);
          i += 2;
        } else if (ch === '`') {
          literals.push(chunk);
          out += '`';
          stack.pop();
          lastSignificant = '`';
          i++;
          break;
        } else if (ch === '$' && input[i + 1] === '{') {
          literals.push(chunk);
          out += '${';
          stack.push({kind: 'expr', depth: 1});
          lastSignificant = '{';
          i += 2;
          break;
        } else {
          chunk += ch;
          out += ch;
          i++;
        }
      }
      continue;
    }

    const ch = input[i];
    const next = input[i + 1];

    if (ch === '/' && next === '/') {
      i += 2;
      while (i < input.length && input[i] !== '\n') i++;
      out += ' ';
      continue;
    }
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < input.length && !(input[i] === '*' && input[i + 1] === '/')) {
        i++;
      }
      i += 2;
      out += ' ';
      continue;
    }
    if (ch === "'" || ch === '"') {
      const quote = ch;
      let content = '';
      out += ch;
      i++;
      while (i < input.length) {
        const c = input[i];
        if (c === '\\' && i + 1 < input.length) {
          content += input.slice(i, i + 2);
          out += input.slice(i, i + 2);
          i += 2;
        } else if (c === quote) {
          literals.push(content);
          out += quote;
          i++;
          break;
        } else {
          content += c;
          out += c;
          i++;
        }
      }
      lastSignificant = quote;
      continue;
    }
    if (ch === '`') {
      out += '`';
      stack.push('template');
      i++;
      continue;
    }
    if (ch === '/' && regexCanPrecede(lastSignificant, i - 1)) {
      let inClass = false;
      out += '/';
      i++;
      while (i < input.length) {
        const c = input[i];
        if (c === '\\' && i + 1 < input.length) {
          out += input.slice(i, i + 2);
          i += 2;
        } else if (c === '[') {
          inClass = true;
          out += c;
          i++;
        } else if (c === ']' && inClass) {
          inClass = false;
          out += c;
          i++;
        } else if (c === '/' && !inClass) {
          out += '/';
          i++;
          while (i < input.length && /[a-z]/i.test(input[i])) {
            out += input[i];
            i++;
          }
          break;
        } else {
          out += c;
          i++;
        }
      }
      lastSignificant = '/';
      continue;
    }
    if (mode && typeof mode === 'object' && mode.kind === 'expr') {
      if (ch === '{') {
        mode.depth++;
      } else if (ch === '}') {
        mode.depth--;
        if (mode.depth === 0) {
          stack.pop();
        }
      }
    }
    out += ch;
    if (!/\s/.test(ch)) {
      lastSignificant = ch;
    }
    i++;
  }
  return {code: out, literals};
}

test('season bundle integrity: references, covenants, IDs, share IDs, and defaults stay consistent', () => {
  const coreSet = new Set(CORE_COVENANTS);
  const addonSet = new Set(ADDON_COVENANTS);
  const allCovenantSet = new Set(ALL_COVENANTS);
  const strategyCatSet = new Set([...STRATEGY_CATEGORIES, ...CORE_COVENANTS]);

  for (const op of OPERATORS) {
    assert.ok(op.covenants.length > 0, `${op.name} has no covenants`);
    for (const cov of op.covenants) {
      assert.ok(
        allCovenantSet.has(cov),
        `Unknown covenant ${cov} on ${op.name}`,
      );
    }
  }
  for (const eq of EQUIPMENT) {
    if (eq.covenant !== null) {
      assert.ok(
        allCovenantSet.has(eq.covenant),
        `Unknown covenant ${eq.covenant} on equip ${eq.name}`,
      );
    }
  }
  for (const combo of EQUIPMENT_COMBOS) {
    for (const eqName of combo) {
      assert.ok(EQUIP[eqName], `Missing equip ${eqName} in combo`);
    }
  }
  for (const st of STRATEGIES) {
    assert.ok(
      strategyCatSet.has(st.category),
      `Unknown strategy category ${st.category} on ${st.name}`,
    );
  }

  for (const [key, build] of Object.entries(CORE_BUILDS)) {
    assert.ok(coreSet.has(key), `Core build key ${key} is not a core covenant`);
    for (const addon of build.addons) {
      assert.ok(
        addonSet.has(addon),
        `Core build ${key} addon ${addon} invalid`,
      );
    }
    for (const opName of [...build.lineup, ...build.carries]) {
      assert.ok(OPERATOR[opName], `Missing operator ${opName} in ${key}`);
    }
    for (const [slotName, alts] of Object.entries(build.alternatives ?? {})) {
      assert.ok(OPERATOR[slotName], `Missing alt slot ${slotName} in ${key}`);
      for (const alt of alts) {
        assert.ok(OPERATOR[alt], `Missing alt ${alt} in ${key}`);
      }
    }
    for (const eqName of build.equipment) {
      assert.ok(EQUIP[eqName], `Missing equip ${eqName} in ${key}`);
    }
    for (const stName of build.strategies) {
      assert.ok(STRATEGY[stName], `Missing strategy ${stName} in ${key}`);
    }
  }

  for (const build of MIXED_BUILDS) {
    for (const addon of build.addons ?? []) {
      assert.ok(
        allCovenantSet.has(addon),
        `Mixed build ${build.name} addon ${addon} invalid`,
      );
    }
    for (const opName of [...build.lineup, ...(build.carries ?? [])]) {
      assert.ok(
        OPERATOR[opName],
        `Missing operator ${opName} in ${build.name}`,
      );
    }
    for (const [slotName, alts] of Object.entries(build.alternatives ?? {})) {
      assert.ok(
        OPERATOR[slotName],
        `Missing alt slot ${slotName} in ${build.name}`,
      );
      for (const alt of alts) {
        assert.ok(OPERATOR[alt], `Missing alt ${alt} in ${build.name}`);
      }
    }
    for (const eqName of build.equipment) {
      assert.ok(EQUIP[eqName], `Missing equip ${eqName} in ${build.name}`);
    }
    for (const stName of build.strategies) {
      assert.ok(
        STRATEGY[stName],
        `Missing strategy ${stName} in ${build.name}`,
      );
    }
  }

  // Unique non-empty IDs with zero collision between COVENANT_IDS and MIXED_BUILD_IDS
  const seenIds = new Set();
  for (const [name, cov] of Object.entries(COVENANTS)) {
    assert.ok(cov.id.length > 0, `Empty covenant id on ${name}`);
    assert.ok(!seenIds.has(cov.id), `Duplicate id ${cov.id}`);
    seenIds.add(cov.id);
    assert.equal(COVENANT_IDS[cov.id], name);
  }
  assert.equal(Object.keys(COVENANT_IDS).length, ALL_COVENANTS.length);

  for (const build of MIXED_BUILDS) {
    assert.ok(build.id.length > 0, `Empty mixed build id on ${build.name}`);
    assert.ok(!seenIds.has(build.id), `Colliding/duplicate id ${build.id}`);
    seenIds.add(build.id);
    assert.equal(MIXED_BUILD_IDS[build.id], build.name);
  }
  assert.equal(Object.keys(MIXED_BUILD_IDS).length, MIXED_BUILDS.length);

  // Share IDs cover all operators without duplicates, and round-trip cleanly
  const shareSet = new Set(SHARE_OPERATOR_IDS);
  assert.equal(shareSet.size, SHARE_OPERATOR_IDS.length);
  for (const op of OPERATORS) {
    const charId = Number(op.avatar.match(/^char_(\d+)_/)?.[1] ?? 0);
    assert.ok(charId > 0, `Invalid avatar id on ${op.name}`);
    assert.ok(
      shareSet.has(charId),
      `${op.name} (${charId}) missing from SHARE_OPERATOR_IDS`,
    );
    const plan = {
      name: '',
      note: '',
      ops: [newSlot(op.name)],
      strategy: '',
      layers: {},
    };
    const decoded = decodePlan(encodePlan(plan));
    assert.deepEqual(
      decoded?.plan,
      plan,
      `Share round-trip failed for ${op.name}`,
    );
  }

  assert.ok(DEFAULT_COVENANT_ID.length > 0);
  assert.ok(DEFAULT_BUILD_ID.length > 0);
  assert.equal(covenantName(DEFAULT_COVENANT_ID), SEASON_META.defaultCovenant);
  assert.equal(buildKey(DEFAULT_BUILD_ID), SEASON_META.defaultBuild);
});

test('static guards: no direct season imports, no deprecated data imports, no S1 literals in lib/router', () => {
  const allowedDataTargets = new Set([
    'index.ts',
    'index',
    'credits.ts',
    'credits',
    'pinyin.ts',
    'pinyin',
    'types.ts',
    'types',
  ]);
  const importRegex = /(?:from|import)\s*(?:\(\s*)?['"]([^'"]+)['"]/g;

  // 1. Only data/season.ts and data/seasons/** may import data/seasons/**
  for (const dirName of ['data', 'src', 'tests', 'scripts']) {
    for (const file of walkFiles(resolve(ROOT_DIR, dirName), [
      '.ts',
      '.mts',
      '.mjs',
      '.js',
      '.vue',
    ])) {
      const rel = relative(ROOT_DIR, file).replaceAll('\\', '/');
      if (rel === 'data/season.ts' || rel.startsWith('data/seasons/')) {
        continue;
      }
      const {code} = stripCommentsAndExtractLiterals(
        readFileSync(file, 'utf8'),
        file.endsWith('.vue'),
      );
      for (const match of code.matchAll(importRegex)) {
        const spec = match[1];
        assert.ok(
          !/(?:^|\/)seasons\//.test(spec),
          `${rel} must not import seasons directory directly: ${spec}`,
        );
      }
    }
  }

  // 2. src/** and tests/** and scripts/** may only import allowed data entry files
  for (const dirName of ['src', 'tests', 'scripts']) {
    for (const file of walkFiles(resolve(ROOT_DIR, dirName), [
      '.ts',
      '.mts',
      '.mjs',
      '.js',
      '.vue',
    ])) {
      const rel = relative(ROOT_DIR, file).replaceAll('\\', '/');
      const {code} = stripCommentsAndExtractLiterals(
        readFileSync(file, 'utf8'),
        file.endsWith('.vue'),
      );
      for (const match of code.matchAll(importRegex)) {
        const spec = match[1];
        const dataMatch = spec.match(/(?:^|\/)data\/(.+)$/);
        if (dataMatch) {
          assert.ok(
            allowedDataTargets.has(dataMatch[1]),
            `${rel} imports deprecated or disallowed data file: ${spec}`,
          );
        }
      }
    }
  }

  // 3. src/lib/** and src/router/** executable code contains no S1 entity literals
  const multiCharForbidden = [
    '变形同构体',
    '人事部文档',
    '星极',
    '真理',
    '至简',
    '绝技',
    '调和',
    '独行',
    '投资人',
    '远见',
    '奇迹',
    '助力',
    '苏苏洛',
    '铃兰',
    '坎诺特',
    '休露丝',
    '伊奥莱塔·罗素',
    '阿米娅 · 多盟约',
    '乌萨斯',
    '谢拉格',
    '华法琳',
    '阿米娅',
    'Touch',
  ];
  const singleCharForbidden = ['炎', '望', '陈'];

  for (const dirName of ['src/lib', 'src/router']) {
    for (const file of walkFiles(resolve(ROOT_DIR, dirName), ['.ts', '.vue'])) {
      const rel = relative(ROOT_DIR, file).replaceAll('\\', '/');
      const {code, literals} = stripCommentsAndExtractLiterals(
        readFileSync(file, 'utf8'),
        file.endsWith('.vue'),
      );
      for (const term of multiCharForbidden) {
        assert.ok(
          !code.includes(term),
          `${rel} contains forbidden S1 literal "${term}" in executable code`,
        );
      }
      for (const term of singleCharForbidden) {
        assert.ok(
          !literals.includes(term),
          `${rel} contains exact S1 literal "${term}"`,
        );
        if (rel !== 'src/lib/plans/shareTextCodebook.ts') {
          assert.ok(
            !code.includes(term),
            `${rel} contains forbidden S1 char literal "${term}" in executable code`,
          );
        }
      }
    }
  }
});

test('generic mechanics helpers obey data contracts rather than hardcoded names', () => {
  // operatorPrice
  assert.equal(operatorPrice(OPERATOR['真理']), 1);
  assert.equal(operatorPrice({name: '真理', tier: 2}), 1);
  assert.equal(operatorPrice(OPERATOR['至简']), 1);
  assert.equal(operatorPrice({name: 'custom', tier: 5, price: 2}), 2);
  assert.equal(
    operatorPrice({name: 'unknown', tier: 4}),
    SEASON_META.tierBasePrices[4],
  );

  // operatorEliteCopies
  assert.equal(operatorEliteCopies('星极'), 2);
  assert.equal(operatorEliteCopies(OPERATOR['星极']), 2);
  assert.equal(operatorEliteCopies({name: 'custom', eliteCopies: 4}), 4);
  assert.equal(operatorEliteCopies('拜松'), SEASON_META.defaultEliteCopies);
  assert.equal(
    operatorEliteCopies('__proto__'),
    SEASON_META.defaultEliteCopies,
  );

  // strategyUsesAdvisorCommand & isBannableCovenant
  assert.equal(strategyUsesAdvisorCommand('苏苏洛'), true);
  assert.equal(strategyUsesAdvisorCommand('铃兰'), true);
  assert.equal(strategyUsesAdvisorCommand('阿米娅'), false);
  assert.equal(strategyUsesAdvisorCommand('__proto__'), false);
  assert.equal(isBannableCovenant('绝技'), false);
  assert.equal(isBannableCovenant('炎'), true);
  assert.equal(isBannableCovenant('__proto__'), false);

  // advisorDeploymentLimit reads baseDeploymentLimit + deploymentSlotBonus
  const expectedBonus =
    DEPLOYMENT_BONUS_EQUIP?.mechanics?.deploymentSlotBonus ?? 0;
  assert.equal(
    advisorDeploymentLimit({personnelDocumentUsed: false}),
    SEASON_META.baseDeploymentLimit,
  );
  assert.equal(
    advisorDeploymentLimit({personnelDocumentUsed: true}),
    SEASON_META.baseDeploymentLimit + expectedBonus,
  );

  // covenantStats: grantsCompanionCovenant, countsReserve, addsCoreCount, maxCount, fieldElites
  const companionStats = covenantStats([
    {...newSlot('拜松'), eq: ['变形同构体', '坚守盾牌']},
  ]);
  const steadfast = companionStats.find((s) => s.name === '坚守');
  assert.ok(steadfast);
  assert.deepEqual(steadfast.granted, ['拜松']);
  assert.equal(
    covenantStats([{...newSlot('拜松'), eq: ['坚守盾牌']}]).some(
      (s) => s.name === '坚守',
    ),
    false,
  );

  // countsReserve: reserve counts only for RESERVE_COVENANTS, without double counting
  const reserveOnly = covenantStats([], {}, [
    newSlot('渡桥'),
    newSlot('寒檀'),
    newSlot('拜松'),
  ]);
  assert.equal(reserveOnly.find((s) => s.name === '远见')?.count, 2);
  assert.equal(
    reserveOnly.some((s) => s.name === '炎'),
    false,
  );
  assert.ok(RESERVE_COVENANTS.has('远见'));

  // addsCoreCount (调和): boosts core covenants by 1, not addons
  const harmonyStats = covenantStats([
    newSlot('拜松'),
    newSlot('盟约·辅助干员'),
  ]);
  assert.equal(harmonyStats.find((s) => s.name === '炎')?.extra, 1);
  assert.equal(harmonyStats.find((s) => s.name === '调和')?.extra, 0);

  // maxCount (独行): breaks when > 1
  assert.equal(
    covenantStats([newSlot('艾丝黛尔')]).find((s) => s.name === '独行')?.active,
    true,
  );
  const brokenSolo = covenantStats([newSlot('艾丝黛尔'), newSlot('地灵')]).find(
    (s) => s.name === '独行',
  );
  assert.equal(brokenSolo?.broken, true);
  assert.equal(brokenSolo?.active, false);

  // fieldElites (绝技)
  const fiveElites = ['拜松', '矩', '风絮', '余', '仇白'].map((n) => ({
    ...newSlot(n),
    elite: true,
  }));
  const mastery = covenantStats(fiveElites).find((s) => s.name === '绝技');
  assert.equal(mastery?.bonusElite, true);
  assert.equal(mastery?.bonusActive, true);
  assert.equal(
    covenantStats(fiveElites, {}, [], new Set(['绝技'])).some(
      (s) => s.name === '绝技',
    ),
    false,
  );

  // explainStrategyTransition driven by STRATEGY[name].advisor.deployedCovenantThresholds
  const yanField = ['拜松', '矩', '乌有', '风絮', '余', '仇白'].map(newSlot);
  assert.equal(
    explainStrategyTransition(yanField.slice(0, 5), yanField, {
      strategy: '望',
      format: 'standard',
      inactiveCovenants: new Set(),
    }).reasons.length,
    1,
  );
  assert.equal(
    explainStrategyTransition(yanField.slice(0, 5), yanField, {
      strategy: '望',
      format: 'fast',
      inactiveCovenants: new Set(),
    }).reasons.length,
    0,
  );

  // recruitPriceRange driven by priceDiscounts & covenantMinPrice
  const baseRun = newAdvisorRun();
  assert.deepEqual(
    recruitPriceRange({...baseRun, layers: {}}, OPERATOR['逻各斯']),
    {min: 2, max: 4},
  );
  assert.deepEqual(
    recruitPriceRange({...baseRun, layers: {远见: 150}}, OPERATOR['逻各斯']),
    {min: 2, max: 2},
  );
  assert.deepEqual(
    recruitPriceRange({...baseRun, strategy: '休露丝'}, OPERATOR['圣聆初雪']),
    {min: 1, max: 4},
  );
  assert.deepEqual(
    recruitPriceRange(
      {...baseRun, candidateSource: 'promotion'},
      OPERATOR['逻各斯'],
    ),
    {min: 0, max: 0},
  );
});
