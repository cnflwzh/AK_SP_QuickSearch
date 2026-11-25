import {
  canPromptInstall,
  installGuide,
  installHintDisabled,
  installHintDismissed,
} from '../runtime/installPrompt.ts';
import type {DiagnosticRow} from './layoutDiagnostics.ts';

const unavailable = '浏览器未提供';

function titlebar(): string {
  const overlay = (
    navigator as Navigator & {
      windowControlsOverlay?: {
        visible: boolean;
        getTitlebarAreaRect(): DOMRectReadOnly;
      };
    }
  ).windowControlsOverlay;
  if (!overlay) return unavailable;
  if (!overlay.visible) return '未启用覆盖';
  if (typeof overlay.getTitlebarAreaRect !== 'function')
    return '覆盖已启用，浏览器未提供可用区域';
  const {x, y, width, height} = overlay.getTitlebarAreaRect();
  return `覆盖已启用 · 可用区域 (${x}, ${y})，${width} × ${height} CSS px`;
}

/** 读取浏览器实际选用的安装引导、窗口覆盖区域和输入设备特征。 */
export function environmentRows(): DiagnosticRow[] {
  return [
    ['站点', location.origin],
    ['网络状态（浏览器报告）', navigator.onLine ? '在线' : '离线'],
    ['安全上下文', window.isSecureContext ? '是' : '否'],
    [
      '主要指针',
      matchMedia('(pointer: coarse)').matches
        ? '粗指针（如触屏）'
        : matchMedia('(pointer: fine)').matches
          ? '精细指针（如鼠标）'
          : '无或未知',
    ],
    ['最大触点数', navigator.maxTouchPoints ?? unavailable],
    [
      '匹配的安装引导',
      installGuide.value?.device ?? '无，此环境不展示安装横幅',
    ],
    [
      '安装清单',
      document
        .querySelector<HTMLLinkElement>('link[rel~="manifest"]')
        ?.getAttribute('href') || '无',
    ],
    [
      '原生安装提示',
      canPromptInstall.value ? '已收到，可调用' : '当前无可调用的安装事件',
    ],
    [
      '安装提示偏好',
      installHintDisabled.value
        ? '全站隐藏'
        : installHintDismissed.value
          ? '仅设置页保留'
          : '允许展示',
    ],
    ['窗口控件覆盖', titlebar()],
  ];
}

/** 读取本次整页导航的计时；尚未发生的里程碑保留为待完成。 */
export function timingRows(): DiagnosticRow[] {
  const nav = performance.getEntriesByType?.('navigation')[0] as
    PerformanceNavigationTiming | undefined;
  const mark = performance.getEntriesByName?.('app-ready', 'mark')[0];
  const duration = (value?: number) =>
    value === undefined
      ? unavailable
      : value > 0
        ? `${Math.round(value)} ms`
        : '尚未记录';
  return [
    ['导航类型', nav?.type ?? unavailable],
    ['导航至收到首字节', duration(nav?.responseStart)],
    ['DOM 就绪', duration(nav?.domContentLoadedEventEnd)],
    ['页面资源加载完成', duration(nav?.loadEventEnd)],
    ['应用可操作', duration(mark?.startTime)],
  ];
}

// 部分浏览器会无限期挂起存储请求；单项超时不应阻塞整份报告。
async function readValue(read: () => Promise<string>): Promise<string> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      read(),
      new Promise<string>((resolve) => {
        timer = setTimeout(() => resolve('读取超时，可刷新重试'), 3000);
      }),
    ]);
  } catch {
    return '读取失败或访问受限';
  } finally {
    clearTimeout(timer);
  }
}

function bytes(value?: number): string {
  if (value === undefined) return unavailable;
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(2)} GiB`;
  return `${(value / 1024 ** 2).toFixed(1)} MiB`;
}

/** 并行读取本站的 Worker、离线入口和存储配额；不注册 Worker、不创建或删除缓存。 */
export async function offlineRows(): Promise<DiagnosticRow[]> {
  const checks: [string, () => Promise<string>][] = [
    [
      '当前页面受 Worker 控制',
      async () => {
        if (!navigator.serviceWorker) return unavailable;
        const worker = navigator.serviceWorker.controller;
        return worker
          ? new URL(worker.scriptURL).pathname + ' · ' + worker.state
          : '否';
      },
    ],
    [
      'Service Worker 注册',
      async () => {
        if (!navigator.serviceWorker) return unavailable;
        const sw = await navigator.serviceWorker.getRegistration();
        if (!sw) return '当前页面无注册';
        const states = [sw.installing, sw.waiting, sw.active].flatMap(
          (worker) => (worker ? [worker.state] : []),
        );
        return `作用域 ${new URL(sw.scope).pathname} · ${states.join(' / ') || '无运行实例'}`;
      },
    ],
    [
      '本站缓存版本',
      async () => {
        if (!window.caches) return unavailable;
        return (
          (await caches.keys())
            .filter((name) => name.startsWith('wsq-'))
            .join('、') || '无'
        );
      },
    ],
    [
      '入口 HTML 缓存',
      async () => {
        if (!window.caches) return unavailable;
        const core = (await caches.keys()).filter((name) =>
          name.startsWith('wsq-core-'),
        );
        const entries = [
          ['速查', '/index.html'],
          ['教程', '/guide.html'],
          ['赛季对比', '/diff.html'],
        ];
        const results = await Promise.all(
          entries.map(async ([label, path]) => {
            const hits = await Promise.all(
              core.map((cacheName) =>
                caches.match(path, {cacheName, ignoreVary: true}),
              ),
            );
            return label + (hits.some(Boolean) ? '已缓存' : '未缓存');
          }),
        );
        return results.join(' · ');
      },
    ],
    [
      '本站存储用量 / 配额（估算）',
      async () => {
        if (!navigator.storage?.estimate) return unavailable;
        const {usage, quota} = await navigator.storage.estimate();
        return `${bytes(usage)} / ${bytes(quota)}`;
      },
    ],
    [
      '持久化存储授权',
      async () => {
        if (!navigator.storage?.persisted) return unavailable;
        return (await navigator.storage.persisted()) ? '已授予' : '未授予';
      },
    ],
  ];
  return Promise.all(
    checks.map(async ([label, read]): Promise<DiagnosticRow> => [
      label,
      await readValue(read),
    ]),
  );
}

/** 用独立的临时键验证指定存储能否写入、读回及删除，不读写用户配置。 */
export function probeStorage(name: 'localStorage' | 'sessionStorage'): string {
  const key = `wsq.dev.probe.${Date.now()}.${Math.random()}`;
  try {
    const storage = window[name];
    try {
      storage.setItem(key, 'ok');
      if (storage.getItem(key) !== 'ok') return '读回值不一致';
    } finally {
      storage.removeItem(key);
    }
    return storage.getItem(key) === null ? '读写和删除正常' : '删除失败';
  } catch (error) {
    return error instanceof DOMException ? `失败（${error.name}）` : '访问失败';
  }
}

/** 从当前站点请求安装清单的响应头。HEAD 绕过本站只处理 GET 的离线 Worker。 */
export async function checkSiteConnection(
  controller: AbortController,
): Promise<string> {
  const manifest = document.querySelector<HTMLLinkElement>(
    'link[rel~="manifest"]',
  );
  if (!manifest) return '当前页面没有安装清单';
  const started = performance.now();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(manifest.href, {
      method: 'HEAD',
      mode: 'same-origin',
      cache: 'no-store',
      credentials: 'omit',
      signal: controller.signal,
    });
    const type =
      response.headers.get('content-type')?.split(';')[0] ?? '未提供类型';
    const result = `HTTP ${response.status} · ${Math.round(performance.now() - started)} ms · ${type}`;
    return response.ok && type === 'text/html'
      ? result + '（清单地址返回了网页）'
      : result;
  } catch {
    return controller.signal.aborted
      ? '请求超时或已取消'
      : '请求失败，未收到本站响应';
  } finally {
    clearTimeout(timer);
  }
}
