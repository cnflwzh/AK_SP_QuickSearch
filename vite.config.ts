import { execFileSync } from 'node:child_process';
import { realpathSync, existsSync, lstatSync, copyFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { generateServiceWorker } from './scripts/build-sw.mjs';
import { writeRouteEntries } from './scripts/build-route-entries.ts';

const root = import.meta.dirname;
const dist = resolve(root, 'dist');
const edgeManifestName = 'manifest-edge.webmanifest';

/** 桌面 Edge 使用系统标题栏。清单与原件同目录，保留已有安装的应用 ID、启动地址和图标。 */
function edgeManifest(): string {
  const manifest = JSON.parse(readFileSync(resolve(root, 'public/manifest.webmanifest'), 'utf8'));
  manifest.id ??= manifest.start_url;
  delete manifest.display_override;
  return JSON.stringify(manifest);
}
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
    name: 'edge-pwa-native-titlebar',
    configureServer(server) {
      server.middlewares.use('/' + edgeManifestName, (_req, res) => {
        res.setHeader('Content-Type', 'application/manifest+json');
        res.end(edgeManifest());
      });
    },
    generateBundle() {
      this.emitFile({type: 'asset', fileName: edgeManifestName, source: edgeManifest()});
    },
    transformIndexHtml() {
      // 三个入口在页面脚本启动前选择清单。移动版 Edge 使用 EdgA 或 EdgiOS 标记。
      return [{
        tag: 'script',
        injectTo: 'head',
        children: `if (/\\bEdg\\//.test(navigator.userAgent)) document.querySelector('link[rel="manifest"]').href = '/${edgeManifestName}';`,
      }];
    },
  }, {
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
    closeBundle() {
      copyFileSync(resolve(root, 'LICENSE'), resolve(dist, 'LICENSE'));
      generateServiceWorker(dist);
      // All route entries serve the same versioned shell already in the offline manifest.
      writeRouteEntries(dist);
    },
  }],
  build: {
    target: 'es2022',
    rolldownOptions: { input: { index: resolve(root, 'index.html'), guide: resolve(root, 'guide.html'), diff: resolve(root, 'diff.html') } },
  },
});
