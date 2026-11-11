import { createApp } from 'vue';
import QuickrefApp from './QuickrefApp.vue';
/** Mounts the quick reference page. Boot owns shared hover previews and page readiness. */
export async function mountQuickref(): Promise<() => void> {
  const app = createApp(QuickrefApp);
  app.mount('#app');
  return () => app.unmount();
}
