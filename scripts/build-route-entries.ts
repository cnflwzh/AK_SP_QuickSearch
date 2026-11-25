import {copyFileSync, mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {
  CORE_BUILDS,
  COVENANT_IDS,
  LEADERS,
  MIXED_BUILD_IDS,
} from '../data/index.ts';
import {buildId} from '../src/router/entities.ts';
import {BOX_PATH, PAGE_PATHS} from '../src/router/paths.ts';

/** Emit clean-URL and directory entries in the completed build for hosts without history rewrites. */
export function writeRouteEntries(directory: string): void {
  const paths = new Set<string>([...Object.values(PAGE_PATHS), BOX_PATH]);
  for (const id of Object.keys(COVENANT_IDS))
    paths.add(`${PAGE_PATHS.cv}/${id}`);
  for (const leader of LEADERS) paths.add(`${PAGE_PATHS.ld}/${leader.id}`);
  const builds = [
    ...Object.keys(CORE_BUILDS).map(buildId),
    ...Object.keys(MIXED_BUILD_IDS),
  ];
  for (const id of builds) {
    paths.add(`${PAGE_PATHS.bd}/${id}`);
    paths.add(`${PAGE_PATHS.bd}/${id}/edit`);
  }
  const shell = join(directory, 'index.html');
  for (const path of paths) {
    const entry = join(directory, path.slice(1));
    mkdirSync(entry, {recursive: true});
    copyFileSync(shell, join(entry, 'index.html'));
    copyFileSync(shell, `${entry}.html`);
  }
}
