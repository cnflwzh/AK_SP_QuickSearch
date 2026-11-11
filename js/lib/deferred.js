/** 等待首屏图片完成；慢速或失败的图片最多推迟字体三秒。 */
async function visibleImagesReady() {
  const images = [...document.images].filter(image => {
    const rect = image.getBoundingClientRect();
    return !image.complete && rect.width > 0 && rect.top < innerHeight && rect.bottom > 0;
  });
  await Promise.all(images.map(image => new Promise(resolve => {
    const done = () => {
      clearTimeout(timer);
      image.removeEventListener('load', done);
      image.removeEventListener('error', done);
      resolve();
    };
    const timer = setTimeout(done, 3000);
    image.addEventListener('load', done, { once: true });
    image.addEventListener('error', done, { once: true });
  })));
}

/** 等待后台任务时机；不支持 requestIdleCallback 的浏览器让出一个任务即可。 */
const idle = () => new Promise(resolve => {
  if ('requestIdleCallback' in window) requestIdleCallback(resolve, { timeout: 2000 });
  else setTimeout(resolve, 0);
});

/**
 * 首屏已可操作后调用。保持原字体和字重，字体下载失败时继续使用系统字体。
 * 返回 Promise<void>；离线缓存只处理本页已请求的资源，不预取其他页面。
 */
export async function loadDeferredAssets() {
  await visibleImagesReady();
  await idle();
  const fonts = document.createElement('link');
  fonts.rel = 'stylesheet';
  fonts.href = 'assets/css/fonts.css';
  fonts.fetchPriority = 'low';
  const settled = new Promise(resolve => {
    // 超时后仍让字体继续加载，避免离线注册被字体服务无限期拖住。
    const timer = setTimeout(resolve, 10000);
    fonts.onerror = () => { clearTimeout(timer); resolve(); };
    fonts.onload = () => {
      // load 在样式应用之前触发，下一帧再等字体，避免取到旧的 fonts.ready。
      requestAnimationFrame(() => {
        document.fonts.ready.then(() => { clearTimeout(timer); resolve(); });
      });
    };
  });
  document.head.append(fonts);
  await settled;
  await idle();
  const { registerServiceWorker } = await import('./pwa.js');
  registerServiceWorker();
}
