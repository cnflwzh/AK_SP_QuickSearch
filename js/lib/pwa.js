/**
 * 页面可用、字体让出网络后注册 Service Worker，补存本页已经请求的资源。
 * 不下载未访问页面；后续访问的内容由 Service Worker 按需缓存。
 * 嵌在 iframe 里预览时、或非 https 的远程地址上不注册。
 */
export function registerServiceWorker() {
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  const allowed = 'serviceWorker' in navigator
    && window.top === window
    && (location.protocol === 'https:' || local);
  if (!allowed) return;

  const register = async () => {
    try {
      await navigator.serviceWorker.register('sw.js');
      const registration = await navigator.serviceWorker.ready;
      // performance 只包含已经结束的请求；首次安装前的资源同样可供离线使用。
      const urls = [location.origin + location.pathname,
        ...performance.getEntriesByType('resource').map(entry => entry.name)]
        .filter(value => new URL(value).origin === location.origin)
        .map(value => { const url = new URL(value); url.search = ''; url.hash = ''; return url.href; });
      const save = () => registration.active?.postMessage({ type: 'CACHE_VISITED', urls });
      save();
      // 更新期间 ready 可能先返回旧 Worker；新版本接管后再补存一次。
      navigator.serviceWorker.addEventListener('controllerchange', save, { once: true });
    } catch { /* 受限浏览器中照常使用在线页面。 */ }
  };
  if (document.readyState === 'complete') register();
  else addEventListener('load', register, { once: true });
}
