/** Shared lazy About dialog, mounted once and disposed during HMR. */
import { createApp } from 'vue';
import AboutDialog from './AboutDialog.vue';
import { ABOUT_VERSION } from '../../data/credits.ts';

const STORAGE_KEY = 'wsq.about';
const seenVersion = () => { try { return localStorage.getItem(STORAGE_KEY); } catch { return null; } };
const markSeen = () => { try { localStorage.setItem(STORAGE_KEY, String(ABOUT_VERSION)); } catch { /* Private browsing. */ } };

/** Bind About triggers and open it once per content version. Returns listener/component cleanup. */
export function initAbout(): () => void {
  const host = document.createElement('div');
  document.body.append(host);
  const app = createApp(AboutDialog, { onSeen: markSeen });
  const instance = app.mount(host) as InstanceType<typeof AboutDialog>;
  const controller = new AbortController();
  document.addEventListener('click', event => {
    if (!(event.target instanceof Element) || !event.target.closest('[data-about]')) return;
    event.preventDefault();
    instance.show();
  }, { signal: controller.signal });
  if (seenVersion() !== String(ABOUT_VERSION)) instance.show();
  return () => { controller.abort(); app.unmount(); host.remove(); };
}
