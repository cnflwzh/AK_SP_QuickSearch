import {execFileSync, spawnSync} from 'node:child_process';
import {
  accessSync,
  constants,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import {dirname} from 'node:path';

// Opt-in only: do not replace contributors' existing hooks or Git configuration.
const configured = spawnSync('git', ['config', '--get', 'core.hooksPath'], {
  encoding: 'utf8',
});
if (configured.status !== 1) {
  throw new Error(
    'Existing hooksPath or Git error: install the precommit command manually.',
  );
}
const hook = execFileSync(
  'git',
  ['rev-parse', '--git-path', 'hooks/pre-commit'],
  {
    encoding: 'utf8',
  },
).trim();
const content =
  '#!/bin/sh\n# AK_SP_QuickSearch pre-commit checks\nnpm run precommit\n';
let existing;
try {
  existing = readFileSync(hook, 'utf8');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
if (existing === content) {
  accessSync(hook, constants.X_OK);
  console.log('The pre-commit hook is already installed.');
} else if (existing !== undefined) {
  throw new Error(
    'Existing pre-commit hook left unchanged; add npm run precommit manually.',
  );
} else {
  mkdirSync(dirname(hook), {recursive: true});
  writeFileSync(hook, content, {flag: 'wx', mode: 0o755});
  console.log('Installed pre-commit checks for this Git repository.');
}
