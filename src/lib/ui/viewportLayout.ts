/** 速查顶栏使用 CSS 像素；Chrome 与 PWA 共用规则。组件内部的容器查询独立生效。 */
export const DEFAULT_BREAKPOINTS = Object.freeze({
  phoneWidth: 480,
  phoneWindowHeight: 600,
  shortHeight: 520,
  narrowWidth: 360,
  compactHeaderWidth: 960,
  searchTakeoverWidth: 639,
  wideGuideWidth: 760,
  squareWidth: 720,
  squareHeight: 840,
  squareRatioPercent: 62.5,
});
export type Breakpoint = keyof typeof DEFAULT_BREAKPOINTS;
export type ViewportBreakpoints = Record<Breakpoint, number>;
export const breakpointKeys = Object.keys(DEFAULT_BREAKPOINTS) as Breakpoint[];
export const validBreakpoint = (
  key: Breakpoint,
  value: unknown,
): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value > 0 &&
  (key === 'squareRatioPercent'
    ? value <= 100
    : Number.isInteger(value) && value <= 8192);

/** 缺失或无效的单项回落到项目默认值，旧设置和手改备份也可读取。 */
export function normalizeBreakpoints(raw: unknown): ViewportBreakpoints {
  const result = {...DEFAULT_BREAKPOINTS} as ViewportBreakpoints;
  if (!raw || typeof raw !== 'object') return result;
  for (const key of breakpointKeys) {
    const value = (raw as Record<string, unknown>)[key];
    if (validBreakpoint(key, value)) result[key] = value;
  }
  return result;
}

/** 根据布局视口和系统浮窗信号决定顶栏可见性、搜索占位及尺寸档。 */
export function resolveViewportLayout(
  width: number,
  height: number,
  config: ViewportBreakpoints = DEFAULT_BREAKPOINTS,
  floating = false,
) {
  const phone = width <= config.phoneWidth;
  const short =
    height <= config.shortHeight ||
    (phone && height <= config.phoneWindowHeight);
  const narrow = width <= config.narrowWidth;
  const square =
    width >= config.phoneWidth &&
    width <= config.squareWidth &&
    height <= config.squareHeight &&
    width * 100 >= height * config.squareRatioPercent;
  const showHeader = !(
    floating ||
    narrow ||
    square ||
    (short && width <= config.compactHeaderWidth)
  );
  const showGuide =
    showHeader &&
    height > config.phoneWindowHeight &&
    (height > width || width > config.wideGuideWidth);
  const search = !short
    ? 'row'
    : width <= config.searchTakeoverWidth
      ? 'takeover'
      : 'inline';
  const label = floating
    ? '系统浮窗'
    : narrow
      ? '极窄窗口'
      : short
        ? search === 'takeover'
          ? '紧凑小窗'
          : '宽矮窗口'
        : square
          ? '近方形小窗'
          : height > width
            ? '常规竖屏'
            : '常规宽屏';
  return {label, showHeader, showGuide, search} as const;
}
