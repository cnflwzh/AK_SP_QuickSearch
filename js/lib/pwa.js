/**
 * 注册 Service Worker（离线缓存）。
 * 嵌在 iframe 里预览时、或非 https 的远程地址上不注册。
 */
export function registerServiceWorker() {
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  const allowed = 'serviceWorker' in navigator
    && window.top === window
    && (location.protocol === 'https:' || local);
  if (!allowed) return;

  const register = () => navigator.serviceWorker.register('sw.js').catch(() => {});
  if (document.readyState === 'complete') register();
  else addEventListener('load', register);
}
