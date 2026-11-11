/**
 * Run start() only while element intersects the viewport and motion is enabled.
 * start returns a stop callback that cancels its timers/frames. Returns cleanup.
 */
export function whileVisible(element, start) {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let visible = false, stop = null;
  const sync = () => {
    const active = visible && !document.hidden && !motion.matches;
    if (active && !stop) stop = start();
    else if (!active && stop) { stop(); stop = null; }
  };
  const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
  observer.observe(element);
  document.addEventListener('visibilitychange', sync);
  motion.addEventListener('change', sync);
  return () => {
    observer.disconnect(); stop?.();
    document.removeEventListener('visibilitychange', sync);
    motion.removeEventListener('change', sync);
  };
}
