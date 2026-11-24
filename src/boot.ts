import {settleInitialFonts} from './lib/runtime/fonts.ts';
import {prefersReducedMotion} from './lib/ui/dom.ts';
import {finishInitialNotice} from './lib/ui/initialNotice.ts';
import {initWindowMode} from './lib/ui/windowMode.ts';
import {initSettingsDom} from './lib/settings/store.ts';

initWindowMode();
initSettingsDom();

// 页脚来自静态 HTML。用户可在首屏就绪前点它，让首次点击和首访公告共用一次加载。
let aboutReady: Promise<(() => void) | undefined> | undefined;
function loadAbout() {
  return (aboutReady ??= import('./lib/ui/about.ts')
    .then(({initAbout}) => {
      const {show, dispose} = initAbout(finishInitialNotice);
      import.meta.hot?.dispose(dispose);
      return show;
    })
    .catch(() => {
      aboutReady = undefined;
      finishInitialNotice();
      return undefined;
    }));
}
const aboutTrigger = document.querySelector('[data-about]');
const openAbout = () => {
  void loadAbout().then((show) => show?.());
};
aboutTrigger?.addEventListener('click', openAbout);
import.meta.hot?.dispose(() =>
  aboutTrigger?.removeEventListener('click', openAbout),
);

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
        [
          registration.installing,
          registration.waiting,
          registration.active,
        ].some((worker) => worker?.scriptURL === siteWorker)
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
  } else if (document.body.dataset.page === 'diff') {
    const {mountDiff} = await import('./diff/main.ts');
    const unmount = mountDiff();
    import.meta.hot?.dispose(unmount);
  } else {
    const {mountQuickref} = await import('./quickref/main.ts');
    const unmount = await mountQuickref();
    import.meta.hot?.dispose(unmount);
  }
  await settleInitialFonts();
  clearTimeout(slow);
  document.body.classList.remove('is-loading');
  document.getElementById('app')?.removeAttribute('aria-busy');
  if (screen) {
    if (prefersReducedMotion() || document.hidden) {
      screen.remove();
    } else {
      screen.classList.add('is-leaving');
      let removed = false;
      const cleanup = () => {
        if (removed) return;
        removed = true;
        screen.remove();
      };
      screen.addEventListener('transitionend', cleanup, {once: true});
      setTimeout(cleanup, 260);
    }
  }
  performance.mark('app-ready');
  await painted();
  // 速览是附加交互，模块下载或初始化失败时仍可使用页面和详情。
  import('./lib/ui/peek.ts')
    .then((module) => {
      const dispose = module.initPeek();
      import.meta.hot?.dispose(dispose);
    })
    .catch((error) => console.warn('Hover previews unavailable', error));
  // 统计下载独立于启动流程，网络不可达时也不影响速查和教程使用。
  if (import.meta.env.PROD && import.meta.env.VITE_GA_MEASUREMENT_ID?.trim()) {
    import('./lib/runtime/analytics.ts')
      .then((module) => module.initializeAnalytics())
      .catch(() => {});
  }
  void loadAbout();
  import('./lib/runtime/deferred.ts')
    .then((module) => module.loadDeferredAssets())
    .catch(() => {});
} catch (error) {
  clearTimeout(slow);
  document.getElementById('app')?.removeAttribute('aria-busy');
  if (screen) screen.dataset.state = 'error';
  console.error('Page initialization failed', error);
}
