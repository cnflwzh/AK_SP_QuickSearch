import {
  computed,
  nextTick,
  onActivated,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
  type Ref,
  type WatchSource,
} from 'vue';
import {prefersReducedMotion} from '../../lib/ui/dom.ts';

export interface SlidingPillOptions {
  /** 可滚动轨道元素（同时作为指示滑块的定位上下文）。 */
  trackRef: Ref<HTMLElement | null>;
  /** 用于定位当前激活按钮的选择器。 */
  activeSelector: string;
  /** 激活态变化时触发平滑滑动。 */
  activeSource: WatchSource<unknown>;
  /** 选项集合变化时无动画同步位置，避免重排错位。 */
  layoutSource?: WatchSource<unknown>;
}

/**
 * 为分段切换栏 / 二三级 Tab 栏提供 GPU 加速的平滑滑动指示器，
 * 同时管理横向溢出时的左右渐变提示与激活项自动居中滚动。
 */
export function useSlidingPill(options: SlidingPillOptions) {
  const pill = reactive({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    visible: false,
  });
  const animated = ref(false);
  const moreLeft = ref(false);
  const moreRight = ref(false);

  let mounted = false;
  let observer: ResizeObserver | undefined;
  let rafId = 0;

  function updateScrollHints(): void {
    const track = options.trackRef.value;
    if (!track || track.scrollWidth <= track.clientWidth + 2) {
      moreLeft.value = false;
      moreRight.value = false;
      return;
    }
    moreLeft.value = track.scrollLeft > 2;
    moreRight.value =
      track.scrollLeft + track.clientWidth < track.scrollWidth - 2;
  }

  function scrollActiveIntoView(smooth: boolean): void {
    const track = options.trackRef.value;
    if (!track || track.scrollWidth <= track.clientWidth + 2) return;
    const active = track.querySelector<HTMLElement>(options.activeSelector);
    if (!active) return;

    const trackRect = track.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    const rawTarget =
      track.scrollLeft +
      (activeRect.left - trackRect.left) -
      (track.clientWidth - activeRect.width) / 2;
    const maxLeft = Math.max(0, track.scrollWidth - track.clientWidth);
    const targetLeft = Math.max(0, Math.min(maxLeft, rawTarget));
    if (Math.abs(track.scrollLeft - targetLeft) <= 1) return;

    track.scrollTo({
      left: targetLeft,
      behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'instant',
    });
  }

  function measure(shouldAnimate: boolean): void {
    const track = options.trackRef.value;
    if (!track) return;
    updateScrollHints();

    const active = track.querySelector<HTMLElement>(options.activeSelector);
    if (!active) {
      pill.visible = false;
      return;
    }

    let left: number;
    let top: number;
    const width = active.offsetWidth;
    const height = active.offsetHeight;

    if (width <= 0 || height <= 0) {
      pill.visible = false;
      return;
    }

    if (active.offsetParent === track) {
      left = active.offsetLeft;
      top = active.offsetTop;
    } else {
      const trackRect = track.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();
      left =
        activeRect.left - trackRect.left + track.scrollLeft - track.clientLeft;
      top = activeRect.top - trackRect.top + track.scrollTop - track.clientTop;
    }

    const canAnimate =
      shouldAnimate && pill.visible && !prefersReducedMotion();
    animated.value = canAnimate;
    pill.left = left;
    pill.top = top;
    pill.width = width;
    pill.height = height;
    pill.visible = true;
  }

  function scheduleMeasure(shouldAnimate: boolean, centerActive = false): void {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      if (!mounted) return;
      measure(shouldAnimate);
      if (centerActive) scrollActiveIntoView(shouldAnimate);
    });
  }

  watch(
    options.activeSource,
    async () => {
      await nextTick();
      if (!mounted) return;
      measure(true);
      scrollActiveIntoView(true);
    },
    {flush: 'post'},
  );

  if (options.layoutSource) {
    watch(
      options.layoutSource,
      async () => {
        await nextTick();
        if (!mounted) return;
        measure(false);
        scrollActiveIntoView(false);
      },
      {flush: 'post'},
    );
  }

  onMounted(() => {
    mounted = true;
    measure(false);
    scrollActiveIntoView(false);

    const track = options.trackRef.value;
    if (track && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        scheduleMeasure(false, false);
      });
      observer.observe(track);
    }

    if (typeof document !== 'undefined' && document.fonts?.ready) {
      void document.fonts.ready.then(() => {
        if (mounted) scheduleMeasure(false, false);
      });
    }
  });

  onActivated(() => {
    scheduleMeasure(false, true);
  });

  onBeforeUnmount(() => {
    mounted = false;
    cancelAnimationFrame(rafId);
    observer?.disconnect();
  });

  const pillStyle = computed(() => ({
    transform: `translate3d(${pill.left}px, ${pill.top}px, 0)`,
    width: `${pill.width}px`,
    height: `${pill.height}px`,
  }));

  return {
    pill,
    animated,
    pillStyle,
    moreLeft,
    moreRight,
    updateScrollHints,
    remeasure: () => scheduleMeasure(false, false),
  };
}
