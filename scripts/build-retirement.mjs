import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {build} from 'vite';
import {describeLegacySource} from './legacy-source.mjs';

const root = resolve(import.meta.dirname, '..');
const source = resolve(root, 'deployment/retirement');
const output = resolve(root, '.codex-retirement');
const legacySource = describeLegacySource();
// This build runs in its own process. A recovery page always needs the migration
// protocol, even on a workstation whose ordinary application builds have it off.
process.env.VITE_DOMAIN_MIGRATION = 'parallel';

async function bundle(entry, format, plugins = []) {
  const result = await build({
    root,
    configFile: false,
    publicDir: false,
    plugins,
    define: {
      'process.env.NODE_ENV': '"production"',
      __VUE_OPTIONS_API__: true,
      __VUE_PROD_DEVTOOLS__: false,
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
    },
    build: {
      target: 'es2022',
      lib: {
        entry: resolve(source, entry),
        formats: [format],
        name: 'WsqRetirement',
      },
      write: false,
      minify: true,
      reportCompressedSize: false,
    },
  });
  const [{output: files}] = Array.isArray(result) ? result : [result];
  const chunks = files.filter((file) => file.type === 'chunk');
  if (
    chunks.length !== 1 ||
    files.some(
      (file) =>
        file.type === 'asset' && file.fileName !== '.vite/manifest.json',
    )
  )
    throw new Error(`Retirement entry ${entry} must be self-contained.`);
  return chunks[0].code;
}

const [script, template, serviceWorker] = await Promise.all([
  bundle('recovery.mjs', 'iife'),
  readFile(resolve(source, 'recovery.html'), 'utf8'),
  readFile(resolve(source, 'sw.js'), 'utf8'),
]);
// Inline once so an old SW cannot mix app shells or hashed chunks across deployments.
const inlineScript = script
  .replace(/<\/script/gi, '<\\/script')
  .replace(/\r\n?/g, '\n');
const digest = createHash('sha256').update(inlineScript).digest('base64');
const payload = {
  sourceSeason: legacySource.sourceSeason,
  recoveryPage: template.replace('/* recovery-script */', () => inlineScript),
  contentPolicy: `default-src 'none'; script-src 'sha256-${digest}'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`,
  serviceWorker,
};
const payloadId = 'virtual:wsq-retirement-payload';
const providePayload = {
  name: 'retirement-payload',
  resolveId(id) {
    if (id === payloadId) return '\0' + id;
  },
  load(id) {
    if (id === '\0' + payloadId)
      return 'export default ' + JSON.stringify(payload);
  },
};
const [cloudflare, edgeone] = await Promise.all([
  bundle('cloudflare.mjs', 'es', [providePayload]),
  bundle('edgeone.mjs', 'es', [providePayload]),
]);

// Keep this completely outside dist, which is the deployable live application.
const cfDir = resolve(output, 'cloudflare');
const eoDir = resolve(output, 'edgeone');
await Promise.all([
  mkdir(cfDir, {recursive: true}),
  mkdir(resolve(eoDir, 'public'), {recursive: true}),
]);
const json = (value) => JSON.stringify(value, null, 2) + '\n';
const manifest = json({
  artifact: 'legacy-retirement',
  ...legacySource,
  sha256: {
    'cloudflare/worker.mjs': createHash('sha256')
      .update(cloudflare)
      .digest('hex'),
    'edgeone/middleware.js': createHash('sha256').update(edgeone).digest('hex'),
  },
});
await Promise.all([
  writeFile(resolve(output, 'legacy-source.json'), manifest),
  writeFile(resolve(cfDir, 'legacy-source.json'), manifest),
  writeFile(resolve(eoDir, 'legacy-source.json'), manifest),
  writeFile(resolve(cfDir, 'worker.mjs'), cloudflare),
  writeFile(
    resolve(cfDir, 'wrangler.jsonc'),
    json({
      name: 'ak-sp-quicksearch-legacy-redirect',
      compatibility_date: '2026-11-10',
      main: './worker.mjs',
      workers_dev: false,
      preview_urls: false,
    }),
  ),
  writeFile(resolve(eoDir, 'middleware.js'), edgeone),
  writeFile(
    resolve(eoDir, 'package.json'),
    json({private: true, type: 'module'}),
  ),
  writeFile(
    resolve(eoDir, 'edgeone.json'),
    json({outputDirectory: './public'}),
  ),
  // EdgeOne also expects a static project entry. Seeing this page indicates
  // that the deployed project is missing its middleware.
  writeFile(
    resolve(eoDir, 'public/index.html'),
    '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>部署检查</title><p>此部署未加载旧网址退役中间件。</p></html>\n',
  ),
]);
console.log(`生成旧站退役部署目录 ${output}`);
