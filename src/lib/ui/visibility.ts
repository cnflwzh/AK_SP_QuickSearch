import {watch} from 'vue';
import {settings} from '../settings/store.ts';

/** 启动可见元素的动画；start 返回暂停函数。系统或站点偏好变更时同步，返回值用于卸载。 */
export function whileVisible(
  element: Element,
  start: () => () => void,
): () => void {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let visible = false;
  let stop: (() => void) | null = null;
  const sync = () => {
    const active =
      visible && !document.hidden && !motion.matches && !settings.reducedMotion;
    if (active && !stop) stop = start();
    else if (!active && stop) {
      stop();
      stop = null;
    }
  };
  const observer = new IntersectionObserver((entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    sync();
  });
  observer.observe(element);
  const stopWatching = watch(() => settings.reducedMotion, sync);
  document.addEventListener('visibilitychange', sync);
  motion.addEventListener('change', sync);
  return () => {
    observer.disconnect();
    stopWatching();
    stop?.();
    document.removeEventListener('visibilitychange', sync);
    motion.removeEventListener('change', sync);
  };
}
