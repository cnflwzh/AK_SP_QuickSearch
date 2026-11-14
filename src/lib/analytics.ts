declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let initialized = false;

/**
 * 在首屏可操作后初始化 GA4，ID 来自构建环境 VITE_GA_MEASUREMENT_ID。
 * 只在生产构建且 ID 有效时生效；重复调用不会重复配置或加载脚本。
 * 首次浏览由 config 上报，Vue Router 导航交给 GA4 增强型衡量的历史事件。
 */
export function initializeAnalytics(): void {
  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim();
  if (initialized || !import.meta.env.PROD || !measurementId) return;
  if (!/^G-[A-Z0-9]+$/.test(measurementId)) {
    console.warn('VITE_GA_MEASUREMENT_ID must be a GA4 Measurement ID starting with G-.');
    return;
  }
  initialized = true;
  window.dataLayer ??= [];
  // Google tag 使用 Arguments 队列；脚本下载期间也能保存初始化命令。
  window.gtag ??= function (..._args: unknown[]): void {
    window.dataLayer!.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', measurementId);

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.append(script);
}
