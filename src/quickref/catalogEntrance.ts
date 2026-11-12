import { onBeforeUnmount, type ObjectDirective } from 'vue';

/** 一个目录共用观察器；卡片第一次进入视口才播放，结束后释放动画状态。 */
export function useCatalogEntrance(): ObjectDirective<HTMLElement> {
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pending = new Set<HTMLElement>(), active = new Set<HTMLElement>();
  const observer = typeof IntersectionObserver === 'undefined' ? undefined : new IntersectionObserver(entries => {
    let order = 0;
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const element = entry.target as HTMLElement;
      observer?.unobserve(element); pending.delete(element);
      if (motion.matches) { clear(element); continue; }
      element.style.setProperty('--entry-order', String(Math.min(order++, 16)));
      element.dataset.catalogEnter = 'active';
      active.add(element); element.addEventListener('animationend', ended);
    }
  });
  function clear(element: HTMLElement): void {
    pending.delete(element); active.delete(element); observer?.unobserve(element);
    element.removeEventListener('animationend', ended);
    delete element.dataset.catalogEnter; element.style.removeProperty('--entry-order');
  }
  function ended(event: AnimationEvent): void {
    if (event.animationName === 'oc-in' && event.target === event.currentTarget) clear(event.currentTarget as HTMLElement);
  }
  function motionChanged(): void {
    if (motion.matches) for (const element of [...pending, ...active]) clear(element);
  }
  motion.addEventListener('change', motionChanged);
  onBeforeUnmount(() => {
    observer?.disconnect(); motion.removeEventListener('change', motionChanged);
    for (const element of [...pending, ...active]) clear(element);
  });
  return {
    beforeMount(element) { if (observer && !motion.matches) element.dataset.catalogEnter = 'pending'; },
    mounted(element) { if (element.dataset.catalogEnter) { pending.add(element); observer?.observe(element); } },
    beforeUnmount: clear,
  };
}
