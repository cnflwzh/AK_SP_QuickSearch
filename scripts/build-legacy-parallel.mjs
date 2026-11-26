import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {build} from 'vite';
import {describeLegacySource} from './legacy-source.mjs';

const root = resolve(import.meta.dirname, '..');
const source = describeLegacySource();
process.env.VITE_DOMAIN_MIGRATION = 'parallel';
// Use exactly the old release's normal build and hosting-specific settings. The
// next season is built independently, from the checkout that owns its data.
await build({root});
await writeFile(
  resolve(root, 'dist/legacy-source.json'),
  JSON.stringify(
    {
      artifact: 'legacy-parallel',
      ...source,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  `旧域名并行版来源 ${source.sourceSeason} · ${source.sourceFingerprint}`,
);
