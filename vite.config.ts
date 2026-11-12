import { execFileSync } from 'node:child_process';
import { realpathSync, existsSync, lstatSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { generateServiceWorker } from './scripts/build-sw.mjs';

const root = import.meta.dirname;
const dist = resolve(root, 'dist');
// Vite clears outDir. Never follow a local junction/symlink outside this checkout.
if (existsSync(dist) && (lstatSync(dist).isSymbolicLink() || realpathSync(dist) !== dist)) {
  throw new Error('dist must be a real directory inside this checkout.');
}
let commit = process.env.CF_PAGES_COMMIT_SHA || process.env.BUILD_COMMIT_SHA || '';
try { commit = execFileSync('git', ['rev-parse', '--verify', 'HEAD^{commit}'], { cwd: root, encoding: 'utf8' }).trim(); } catch { /* Deployment archive may not include .git. */ }
if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(commit)) throw new Error('Cannot determine build commit.');

export default defineConfig({
  base: '/',
  plugins: [vue({ template: { compilerOptions: { whitespace: 'preserve' } } }), {
    name: 'site-build-metadata',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return html.replace('<code class="build-version" data-build-version hidden></code>',
          `<code class="build-version" data-build-version title="Git commit ${commit}" aria-label="构建版本 ${commit.slice(0, 7)}">${commit.slice(0, 7)}</code>`)
          // The boot module cannot handle its own download failure. Keep the existing retry overlay.
          .replace(/<script type="module"([^>]+)>/g,
            `<script type="module"$1 onerror="document.getElementById('load-screen')?.setAttribute('data-state','error')">`);
      },
    },
  }, {
    name: 'site-offline-output',
    apply: 'build',
    closeBundle() { copyFileSync(resolve(root, 'LICENSE'), resolve(dist, 'LICENSE')); generateServiceWorker(dist); },
  }],
  define: { __BUILD_COMMIT__: JSON.stringify(commit) },
  build: {
    target: 'es2022',
    rolldownOptions: { input: { index: resolve(root, 'index.html'), guide: resolve(root, 'guide.html') } },
  },
});
