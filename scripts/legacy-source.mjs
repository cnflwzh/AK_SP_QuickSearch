import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readdirSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {CURRENT_SEASON} from '../data/season.ts';
import {requireLegacyDomainSeason} from '../src/lib/settings/legacyDomainSeason.ts';

const root = resolve(import.meta.dirname, '..');

/** Identify the exact data, serialization code and locked dependencies even when the checkout has local edits. */
export function describeLegacySource() {
  const {meta} = CURRENT_SEASON;
  requireLegacyDomainSeason(meta.id);
  const files = ['package-lock.json'];
  function collect(directory) {
    for (const entry of readdirSync(resolve(root, directory), {
      withFileTypes: true,
    })) {
      const file = directory + '/' + entry.name;
      if (entry.isDirectory()) collect(file);
      else if (entry.isFile()) files.push(file);
    }
  }
  collect('src');
  collect('data');
  const fingerprint = createHash('sha256');
  for (const file of files.sort()) {
    // Git may check the same text out with LF or CRLF on different build hosts.
    const bytes = readFileSync(resolve(root, file));
    const content = bytes.includes(0)
      ? bytes
      : bytes.toString('utf8').replace(/\r\n/g, '\n');
    fingerprint
      .update(file + '\0')
      .update(createHash('sha256').update(content).digest());
  }
  let commit =
    process.env.CF_PAGES_COMMIT_SHA || process.env.BUILD_COMMIT_SHA || '';
  try {
    commit = execFileSync('git', ['rev-parse', '--verify', 'HEAD^{commit}'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    /* A source archive may only have a hosting-provided Git revision. */
  }
  return {
    sourceSeason: meta.id,
    seasonTitle: meta.title,
    ruleVersion: meta.ruleVersion,
    sourceCommit: /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(commit)
      ? commit
      : null,
    sourceFingerprint: fingerprint.digest('hex'),
  };
}
