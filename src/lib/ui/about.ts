/** Shared lazy About dialog, mounted once and disposed during HMR. */
import { createApp } from 'vue';
import AboutDialog from './AboutDialog.vue';
import { ABOUT_VERSION } from '../../../data/credits.ts';

const STORAGE_KEY = 'wsq.about';
const seenVersion = () => { try { return localStorage.getItem(STORAGE_KEY); } catch { return null; } };
const markSeen = () => { try { localStorage.setItem(STORAGE_KEY, String(ABOUT_VERSION)); } catch { /* Private browsing. */ } };

/** 初始化全站公告。首访公告已读或关闭后通知页面引导；返回值用于解除监听、卸载弹窗。 */
export function initAbout(onInitialNoticeComplete: () => void): () => void {
  let host: HTMLDivElement | undefined;
  let app: ReturnType<typeof createApp> | undefined;
  let instance: InstanceType<typeof AboutDialog> | undefined;
  // 读过公告的玩家通常不会打开关于页；等实际展示时再创建来源列表和弹窗。
  function show(): void {
    if (!instance) {
      host = document.createElement('div');
      document.body.append(host);
      app = createApp(AboutDialog, { onSeen() { markSeen(); onInitialNoticeComplete(); } });
      instance = app.mount(host) as InstanceType<typeof AboutDialog>;
    }
    instance.show();
  }
  const controller = new AbortController();
  document.addEventListener('click', event => {
    if (!(event.target instanceof Element) || !event.target.closest('[data-about]')) return;
    event.preventDefault();
    show();
  }, { signal: controller.signal });
  if (seenVersion() !== String(ABOUT_VERSION)) show();
  else onInitialNoticeComplete();
  return () => { controller.abort(); app?.unmount(); host?.remove(); };
}
