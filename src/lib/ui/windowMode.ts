import {readonly, shallowRef} from 'vue';

const floatingWindow = shallowRef(false);
export const isFloatingWindow = readonly(floatingWindow);

/** 窗口外框和当前屏幕可用区域均用 CSS 像素。尺寸缺失时保留完整页面。 */
export function hasFloatingWindowBounds(
  outerWidth: number,
  outerHeight: number,
  availableWidth: number,
  availableHeight: number,
): boolean {
  // 工具栏、输入法或单边分屏都可能让内容区变矮。只采信外框在两个方向都明显缩小的紧凑窗口。
  return (
    [outerWidth, outerHeight, availableWidth, availableHeight].every(
      (size) => Number.isFinite(size) && size > 0,
    ) &&
    Math.max(outerWidth, outerHeight) <= 960 &&
    Math.min(outerWidth, outerHeight) <= 720 &&
    outerWidth <= availableWidth * 0.85 &&
    outerHeight <= availableHeight * 0.85
  );
}

/** 在挂载前同步导航、路由和布局共用的浮窗状态，并跟踪折叠、旋转及窗口模式切换。 */
export function initWindowMode(): void {
  if (typeof window === 'undefined' || !window.matchMedia) return;
  const pictureInPicture = window.matchMedia(
    '(display-mode: picture-in-picture)',
  );
  const fullscreen = window.matchMedia('(display-mode: fullscreen)');
  const touch = window.matchMedia('(pointer: coarse)');
  function update(): void {
    const next =
      pictureInPicture.matches ||
      (touch.matches &&
        !fullscreen.matches &&
        hasFloatingWindowBounds(
          window.outerWidth,
          window.outerHeight,
          window.screen.availWidth,
          window.screen.availHeight,
        ));
    if (floatingWindow.value === next) return;
    floatingWindow.value = next;
    document.documentElement.toggleAttribute('data-floating-window', next);
  }
  update();
  window.addEventListener('resize', update);
  window.addEventListener('pageshow', update);
  window.screen.orientation?.addEventListener('change', update);
  for (const query of [pictureInPicture, fullscreen, touch]) {
    query.addEventListener('change', update);
  }
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      window.removeEventListener('resize', update);
      window.removeEventListener('pageshow', update);
      window.screen.orientation?.removeEventListener('change', update);
      for (const query of [pictureInPicture, fullscreen, touch]) {
        query.removeEventListener('change', update);
      }
      document.documentElement.removeAttribute('data-floating-window');
    });
  }
}
