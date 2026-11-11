/**
 * 页面启动顺序：数据与交互 → 收起遮罩 → 可见图片 → 字体 / 已访问资源的离线缓存。
 * 两个入口由 body[data-page] 选择；模块失败时保留可重试的遮罩。
 */
const screen = document.getElementById('load-screen');
const slow = setTimeout(() => { screen.dataset.state = 'slow'; }, 15000);
const painted = () => new Promise(resolve => {
  if (document.hidden) resolve();
  else requestAnimationFrame(() => requestAnimationFrame(resolve));
});

try {
  if (document.body.dataset.page === 'guide') await import('./guide/main.js');
  else await import('./quickref/main.js');
  clearTimeout(slow);
  document.body.classList.remove('is-loading');
  document.body.removeAttribute('aria-busy');
  screen.remove();
  performance.mark('app-ready');
  await painted();

  // 附属说明与字体不参与首屏就绪判断，也不影响搜索和图表的使用。
  import('./lib/about.js').then(module => module.initAbout()).catch(() => {});
  import('./lib/deferred.js').then(module => module.loadDeferredAssets()).catch(() => {});
} catch (error) {
  clearTimeout(slow);
  screen.dataset.state = 'error';
  console.error('Page initialization failed', error);
}
