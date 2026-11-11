/** Generate the offline allowlist from final hashed Vite outputs; nothing is precached. */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(import.meta.dirname, '..');
function filesUnder(directory, prefix = '') {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const name = prefix + entry.name;
    return entry.isDirectory() ? filesUnder(resolve(directory, entry.name), name + '/') : [name];
  }).sort();
}

/** @param {string} directory Completed static site directory; writes only its sw.js. */
export function generateServiceWorker(directory) {
  if (!existsSync(resolve(directory, 'index.html'))) throw new Error('Build the site before generating its service worker.');
  const files = filesUnder(directory);
  const core = files.filter(name => name !== 'sw.js' && (/\.(?:html|js|css)$/.test(name) || name === 'manifest.webmanifest' || name.startsWith('assets/icons/')));
  const images = files.filter(name => name.startsWith('assets/img/'));
  const template = readFileSync(resolve(root, 'scripts/sw.template.js'), 'utf8');
  const digest = createHash('sha1').update(template);
  const imageDigest = createHash('sha1');
  for (const name of [...core, ...images]) digest.update(name).update(readFileSync(resolve(directory, name)));
  for (const name of images) imageDigest.update(name).update(readFileSync(resolve(directory, name)));
  const version = digest.digest('hex').slice(0, 10);
  const output = template.replace('__VERSION__', version)
    .replace('__IMAGE_VERSION__', imageDigest.digest('hex').slice(0, 10))
    .replace('__CORE__', JSON.stringify(['./', ...core], null, 2))
    .replace('__IMAGES__', JSON.stringify(images, null, 2));
  writeFileSync(resolve(directory, 'sw.js'), output);
  console.log(`sw.js version=${version} core=${core.length + 1} images=${images.length}`);
}
if (process.argv[1] && relative(fileURLToPath(import.meta.url), resolve(process.argv[1])) === '') {
  generateServiceWorker(resolve(root, 'dist'));
}
