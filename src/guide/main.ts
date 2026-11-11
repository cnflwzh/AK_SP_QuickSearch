import { createApp } from 'vue';
import GuideApp from './GuideApp.vue';

/** Mount the tutorial and resolve after its visible/hash chapter has rendered.
 * A rejected initial chapter load leaves the boot overlay available for retry.
 */
export function mountGuide(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const app = createApp(GuideApp, { ready: resolve, failed: reject });
    app.config.errorHandler = reject;
    app.mount('#app');
    import.meta.hot?.dispose(() => app.unmount());
  });
}
