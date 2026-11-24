import {createApp} from 'vue';
import DiffApp from './DiffApp.vue';

/** 挂载赛季更新对比独立页。 */
export function mountDiff(): () => void {
  const app = createApp(DiffApp);
  app.mount('#app');
  return () => app.unmount();
}
