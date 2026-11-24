import {navigationLayout} from './windowMode.ts';

/** 调试信息沿用顶栏的分档结果，并报告用户设置和分屏后的实际可见状态。 */
export function readNavigationLayout(): string {
  const bar = document.querySelector('.qbar');
  if (!bar) return document.body.dataset.page === 'diff' ? '赛季更新对比' : '图解教程';
  const title = document.querySelector('.qhead');
  const layout = navigationLayout.value;
  return [
    layout.label,
    layout.search === 'row' ? '常规导航' : '紧凑单行导航',
    title?.getClientRects().length ? '标题显示' : '标题隐藏',
  ].join(' · ');
}

/** 在点击复制时采集实际视口、窗口模式和构建版本，生成可粘贴的诊断文本。 */
export function layoutReport(): string {
  const viewport = window.visualViewport;
  const content = document.querySelector('#view, main');
  const mode =
    ['standalone', 'fullscreen', 'picture-in-picture', 'minimal-ui'].find(
      (name) => matchMedia(`(display-mode: ${name})`).matches,
    ) ?? 'browser';
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
  ]
    .map(([label, value]) => `${label}：${value}`)
    .join('\n');
}
