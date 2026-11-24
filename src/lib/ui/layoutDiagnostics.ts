import {navigationLayout} from './windowMode.ts';

/** 调试信息沿用顶栏的分档结果，并报告用户设置和分屏后的实际可见状态。 */
export function readNavigationLayout(): string {
  const bar = document.querySelector('.qbar');
  if (!bar)
    return document.body.dataset.page === 'diff' ? '赛季更新对比' : '图解教程';
  const title = document.querySelector('.qhead');
  const layout = navigationLayout.value;
  return [
    layout.label,
    layout.search === 'row' ? '常规导航' : '紧凑单行导航',
    title?.getClientRects().length ? '标题显示' : '标题隐藏',
  ].join(' · ');
}

export type DiagnosticRow = readonly [label: string, value: string | number];

/** 读取当下的 CSS 视口和导航状态，供设置面板及复制报告共用。 */
export function layoutRows(): DiagnosticRow[] {
  const viewport = window.visualViewport;
  const content = document.querySelector('#view, main');
  const mode =
    [
      'window-controls-overlay',
      'fullscreen',
      'picture-in-picture',
      'standalone',
      'minimal-ui',
    ].find((name) => matchMedia(`(display-mode: ${name})`).matches) ??
    ((navigator as Navigator & {standalone?: boolean}).standalone
      ? 'standalone'
      : 'browser');
  return [
    ['布局视口', `${innerWidth} × ${innerHeight} CSS px`],
    [
      '可视视口',
      viewport
        ? `${Math.round(viewport.width)} × ${Math.round(viewport.height)} CSS px · 缩放 ${viewport.scale.toFixed(2)}×`
        : '浏览器未提供',
    ],
    ['内容宽度', content ? `${content.clientWidth} CSS px` : '—'],
    ['导航布局', readNavigationLayout()],
    [
      '教程入口',
      document.querySelector('.guide-mini')?.getClientRects().length
        ? '显示'
        : '隐藏',
    ],
    [
      '窗口模式',
      mode +
        (document.documentElement.hasAttribute('data-floating-window')
          ? ' · 系统浮窗'
          : ''),
    ],
    ['设备像素比', Number(window.devicePixelRatio.toFixed(3))],
    [
      '构建版本',
      document.querySelector('[data-build-version]')?.textContent?.trim() ||
        '本地开发',
    ],
  ];
}

/** 将带标签的诊断值转成可直接粘贴的逐行文本。 */
export function formatRows(rows: readonly DiagnosticRow[]): string {
  return rows.map(([label, value]) => `${label}：${value}`).join('\n');
}

/** 点击复制时采集当前布局、浏览器 UA 和构建版本。 */
export function layoutReport(): string {
  return formatRows([
    ...layoutRows(),
    ['浏览器 UA', navigator.userAgent || '浏览器未提供'],
  ]);
}
