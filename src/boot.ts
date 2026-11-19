import {settleInitialFonts} from './lib/runtime/fonts.ts';
import {finishInitialNotice} from './lib/ui/initialNotice.ts';
import {initSettingsDom} from './lib/settings/index.ts';

initSettingsDom();

/** Mount content and controls first; visited-only offline caching starts after first paint. */
const screen = document.getElementById('load-screen');
const slow = setTimeout(() => {
  if (screen) screen.dataset.state = 'slow';
}, 15000);
const painted = () =>
  new Promise<void>((resolve) => {
    if (document.hidden) resolve();
    else requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
try {
  if (import.meta.env.DEV && 'serviceWorker' in navigator) {
    // An earlier production preview may have registered a worker on this localhost port.
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const siteWorker = new URL('/sw.js', location.origin).href;
      if (
        registration &&
        [registration.installing, registration.waiting, registration.active].some(
          (worker) => worker?.scriptURL === siteWorker,
        )
      ) {
        await registration.unregister();
      }
    } catch {
      /* 开发环境禁用 Service Worker 时，仍可直接加载 Vite 模块。 */
    }
  }
  if (document.body.dataset.page === 'guide') {
    const {mountGuide} = await import('./guide/main.ts');
    await mountGuide();
  } else {
    const {mountQuickref} = await import('./quickref/main.ts');
    const unmount = await mountQuickref();
    import.meta.hot?.dispose(unmount);
  }
  // 首屏 DOM 就绪后即可选择字体，速览模块的下载与此过程互不依赖。
  const [{initPeek}] = await Promise.all([
    import('./lib/ui/peek.ts'),
    settleInitialFonts(),
  ]);
  const disposePeek = initPeek();
  import.meta.hot?.dispose(disposePeek);
  clearTimeout(slow);
  document.body.classList.remove('is-loading');
  document.body.removeAttribute('aria-busy');
  screen?.remove();
  performance.mark('app-ready');
  await painted();
  // 统计下载独立于启动流程，网络不可达时也不影响速查和教程使用。
  if (import.meta.env.PROD && import.meta.env.VITE_GA_MEASUREMENT_ID?.trim()) {
    import('./lib/runtime/analytics.ts')
      .then((module) => module.initializeAnalytics())
      .catch(() => {});
  }
  import('./lib/ui/about.ts')
    .then((module) => {
      const dispose = module.initAbout(finishInitialNotice);
      import.meta.hot?.dispose(dispose);
    })
    .catch(finishInitialNotice);
  import('./lib/runtime/deferred.ts')
    .then((module) => module.loadDeferredAssets())
    .catch(() => {});
} catch (error) {
  clearTimeout(slow);
  if (screen) screen.dataset.state = 'error';
  console.error('Page initialization failed', error);
}
