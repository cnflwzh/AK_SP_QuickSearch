import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import * as recommendation from '../src/lib/recommendation/index.ts';
import * as planner from '../src/lib/plans/index.ts';
import * as live from '../src/lib/recommendation/live/runAdvisor.ts';

test('recommendation entry points remain compatible without storage or UI dependencies', () => {
  for (const name of ['suggestions', 'alternatesFor', 'banReplace', 'createLineupEvaluator']) {
    assert.equal(recommendation[name], planner[name]);
  }
  for (const name of ['recommendRecruits', 'recommendDeployments']) {
    assert.equal(recommendation[name], live[name]);
  }
  const visited = new Set();
  function inspect(file) {
    if (visited.has(file)) return;
    visited.add(file);
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /\b(?:localStorage|sessionStorage|window|document)\s*[.(]/, file);
    for (const match of source.matchAll(/(?:from\s+|import\s*)['"]([^'"]+)['"]/g)) {
      const path = match[1];
      if (!path.startsWith('.')) {
        assert.fail(`Unexpected external dependency in recommendation: ${path}`);
      }
      const dependency = resolve(dirname(file), path).replaceAll('\\', '/');
      assert.doesNotMatch(
        dependency,
        /\/(?:quickref|router)\/|\/plans\/(?:index|storage|sharing|backup|image|shareCodec)\.ts$/,
        dependency,
      );
      inspect(dependency);
    }
  }
  inspect(fileURLToPath(new URL('../src/lib/recommendation/index.ts', import.meta.url)));
});

test('src/lib organizes all modules into domain subdirectories without loose root files', () => {
  const libDir = fileURLToPath(new URL('../src/lib', import.meta.url));
  const entries = readdirSync(libDir, { withFileTypes: true });
  const rootFiles = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  assert.deepEqual(rootFiles, []);
  const dirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(dirs, [
    'dealer',
    'leaders',
    'numbers',
    'plans',
    'prts',
    'recommendation',
    'runtime',
    'ui',
  ]);
});
