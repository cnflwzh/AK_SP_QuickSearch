import { execFileSync } from 'node:child_process';
import { realpathSync, existsSync, lstatSync, copyFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { generateServiceWorker } from './scripts/build-sw.mjs';
import { writeRouteEntries } from './scripts/build-route-entries.ts';
import {publishStyles} from './scripts/build-styles.ts';
import {checkHostingRules} from './scripts/sync-hosting.mjs';

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
    transformIndexHtml(html) {
      // 三个入口在页面脚本启动前选择清单。移动版 Edge 使用 EdgA 或 EdgiOS 标记。
      // The critical rules precede every sheet. A single capture listener covers all
      // generated module scripts, including failures before the boot module can run.
      const critical = readFileSync(resolve(root, 'src/boot-screen.css'), 'utf8');
      const startup = `{const m=document.querySelector('link[rel="manifest"]');if(m&&/\\bEdg\\//.test(navigator.userAgent))m.href='/${edgeManifestName}';addEventListener('error',e=>{if(e.target?.matches?.('script[type="module"],link[data-site-style]')){const fail=()=>document.getElementById('load-screen')?.setAttribute('data-state','error');if(document.body)fail();else document.addEventListener('DOMContentLoaded',fail,{once:true})}},true)}`;
      return html.replace('<!-- boot-screen -->', `<style>${critical}</style><script>${startup}</script>`);
    },
  }, {
    name: 'site-build-metadata',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return html.replace('<code class="build-version" data-build-version hidden></code>',
          `<code class="build-version" data-build-version title="Git commit ${commit}" aria-label="构建版本 ${commit.slice(0, 7)}">${commit.slice(0, 7)}</code>`);
      },
    },
  }, {
    name: 'site-offline-output',
    apply: 'build',
    buildStart() { checkHostingRules(); },
    writeBundle() {
      copyFileSync(resolve(root, 'LICENSE'), resolve(dist, 'LICENSE'));
      publishStyles(dist);
      if (process.env.WSQ_STATIC_ROUTES === '1') writeRouteEntries(dist);
      generateServiceWorker(dist);
    },
  }],
  build: {
    assetsDir: 'assets/bundles',
    target: 'es2022',
    rolldownOptions: { input: { index: resolve(root, 'index.html'), guide: resolve(root, 'guide.html'), diff: resolve(root, 'diff.html') } },
  },
});
