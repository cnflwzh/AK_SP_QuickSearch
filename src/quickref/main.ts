import { createApp } from 'vue';
import QuickrefApp from './QuickrefApp.vue';
import { router } from '../router/index.ts';
/** Mounts the quick reference page. Boot owns shared hover previews and page readiness. */
export async function mountQuickref(): Promise<() => void> {
  const app = createApp(QuickrefApp);
  app.use(router);
  // Resolve the entry URL before painting; failed lazy routes retain the shell's recovery controls.
  await router.isReady().catch(() => {});
  app.mount('#app');
  return () => app.unmount();
}
