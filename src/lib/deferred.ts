/** 等待后台任务时机；不支持 requestIdleCallback 的浏览器让出一个任务即可。 */
const idle = () => new Promise<void>(resolve => {
  if ('requestIdleCallback' in window) requestIdleCallback(() => resolve(), { timeout: 2000 });
  else setTimeout(resolve, 0);
});

/**
 * 首屏可操作后，在空闲时注册离线缓存；只补存本页已请求的资源。
 * 字体声明由 HTML 提前加载，不能在此动态插入，否则缓存命中也会触发字体替换。
 * 返回 Promise<void>，不预取其他页面。
 */
export async function loadDeferredAssets(): Promise<void> {
  await idle();
  const { registerServiceWorker } = await import('./pwa.ts');
  registerServiceWorker();
}
