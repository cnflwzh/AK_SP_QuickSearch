/** Build a second, offline-only application with a distinct season and storage namespace. */
import {execFileSync} from 'node:child_process';
import {
  cp,
  lstat,
  mkdir,
  readFile,
  realpath,
  writeFile,
} from 'node:fs/promises';
import {join, resolve} from 'node:path';

const root = resolve(import.meta.dirname, '..');
const fixture = join(root, '.codex-migration-fixture');
const marker = join(fixture, '.migration-rehearsal');
const owner = 'AK_SP_QuickSearch local migration rehearsal\n';
try {
  await mkdir(fixture);
  await writeFile(marker, owner);
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  if (
    (await realpath(fixture)) !== fixture ||
    (await readFile(marker, 'utf8')) !== owner
  )
    throw new Error(
      'The rehearsal directory already exists and is not owned by this build.',
      {cause: error},
    );
}

// Keep production season selection, dist and hosting builds independent of this fixture.
// Copy the build inputs so Vite also generates the real static routes and Service Worker.
const inputs = [
  'data',
  'src',
  'public',
  'scripts',
  'index.html',
  'guide.html',
  'diff.html',
  'vite.config.ts',
  'package.json',
  'edgeone.json',
  'LICENSE',
];
for (const name of inputs) {
  const destination = join(fixture, name);
  const existing = await lstat(destination).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
  });
  if (existing?.isSymbolicLink())
    throw new Error(`Unexpected rehearsal symlink at ${name}`);
  await cp(join(root, name), destination, {recursive: true});
}
const seasonEntry = join(fixture, 'data', 'season.ts');
await cp(seasonEntry, join(fixture, 'data', 'rehearsal-base.ts'));
await writeFile(
  seasonEntry,
  `import {CURRENT_SEASON as base} from './rehearsal-base.ts';
import type {SeasonDefinition} from './types.ts';
export const CURRENT_SEASON: SeasonDefinition = {
  ...base,
  meta: {...base.meta, id: 'rehearsal-next', title: '本地演练赛季'},
};
`,
);
execFileSync(
  process.execPath,
  [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'build'],
  {
    cwd: fixture,
    env: {
      ...process.env,
      VITE_DOMAIN_MIGRATION: 'parallel',
      WSQ_STATIC_ROUTES: '1',
      VITE_GA_MEASUREMENT_ID: '',
    },
    stdio: 'inherit',
  },
);
console.log(`演练构建完成。赛季 rehearsal-next，目录 ${join(fixture, 'dist')}`);
