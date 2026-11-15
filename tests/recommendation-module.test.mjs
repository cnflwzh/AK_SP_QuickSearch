import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import test from 'node:test';
import * as recommendation from '../src/lib/recommendation/index.ts';
import * as planner from '../src/lib/planner.ts';
import * as live from '../src/lib/runAdvisor.ts';

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
      const dependency = resolve(dirname(file), path);
      assert.doesNotMatch(dependency, /\/(?:quickref|router)\/|\/(?:planner|shareCodec)\.ts$/, dependency);
      inspect(dependency);
    }
  }
  inspect(new URL('../src/lib/recommendation/index.ts', import.meta.url).pathname);
});
