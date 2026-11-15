import {execFileSync} from 'node:child_process';
import {ESLint} from 'eslint';
import * as prettier from 'prettier';

// Read the index, never rewrite or restage files: partial staging stays intact.
const git = (...args) => execFileSync('git', args, {encoding: 'utf8'});
const paths = git('diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z')
  .split('\0')
  .filter((path) => /\.(?:[cm]?ts|vue|[cm]?js)$/.test(path));
const eslint = new ESLint();
const formatter = await eslint.loadFormatter('stylish');
let failed = false;
for (const path of paths) {
  if (await eslint.isPathIgnored(path)) continue;
  const source = git('show', `:${path}`);
  const options = await prettier.resolveConfig(path);
  if (!(await prettier.check(source, {...options, filepath: path}))) {
    console.error(
      `Format the staged version of ${JSON.stringify(path)} before committing.`,
    );
    failed = true;
  }
  const results = await eslint.lintText(source, {filePath: path});
  if (results.some((result) => result.errorCount || result.warningCount)) {
    console.error(formatter.format(results));
    failed = true;
  }
}
if (failed) process.exitCode = 1;
else
  console.log(
    `Checked ${paths.length} staged source files without changing the index.`,
  );
