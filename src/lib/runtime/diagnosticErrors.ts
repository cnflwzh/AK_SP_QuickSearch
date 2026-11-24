import {onErrorCaptured, shallowRef, watch} from 'vue';
import {settings} from '../settings/store.ts';

const storageKey = 'wsq.dev.errors.v1';
const maxErrors = 20;
export const diagnosticErrors = shallowRef<string[]>([]);

/** 只保留最近的记录。同标签页刷新或从教程返回设置时仍能查看，存储受限时保留内存副本。 */
function save(lines: string[]): void {
  diagnosticErrors.value = lines;
  try {
    if (lines.length) sessionStorage.setItem(storageKey, JSON.stringify(lines));
    else sessionStorage.removeItem(storageKey);
  } catch {
    // 浏览器可能禁用会话存储。
  }
}

function resourceName(value: string): string {
  try {
    const url = new URL(value, location.href);
    if (!['http:', 'https:'].includes(url.protocol)) return url.protocol;
    return (url.origin === location.origin ? '' : url.origin) + url.pathname;
  } catch {
    return '';
  }
}

/** 记录浏览器或应用入口已捕获的错误。只在开发者模式下生效，不读取堆栈或序列化业务对象。 */
export function recordDiagnosticError(kind: string, reason: unknown): void {
  if (!settings.developerMode) return;
  const message =
    reason instanceof Error
      ? reason.message
      : typeof reason === 'string'
        ? reason
        : '未提供错误说明';
  const summary = message
    .replace(/(?:https?:\/\/|(?:blob|data):)[^\s"'<>]+/gi, resourceName)
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, 300);
  const line = `${new Date().toISOString()} · ${location.pathname} · ${kind} · ${summary}`;
  save([line, ...diagnosticErrors.value].slice(0, maxErrors));
}

/** 在页面根组件中观察后代组件的错误，交由 Vue 继续执行原有错误处理。 */
export function useComponentErrorDiagnostics(): void {
  onErrorCaptured((error) => {
    recordDiagnosticError('Vue 组件错误', error);
  });
}

/** 按设置启停本标签页的错误监听，返回供热更新使用的清理函数。 */
export function initDiagnosticErrors(): () => void {
  return watch(
    () => settings.developerMode,
    (enabled, _, onCleanup) => {
      if (!enabled) {
        save([]);
        return;
      }
      try {
        const lines: unknown = JSON.parse(
          sessionStorage.getItem(storageKey) || '[]',
        );
        if (Array.isArray(lines))
          diagnosticErrors.value = lines
            .filter((line): line is string => typeof line === 'string')
            .slice(0, maxErrors)
            .map((line) => line.slice(0, 600));
      } catch {
        // 保留内存中的记录。
      }
      function onError(event: Event) {
        if (event instanceof ErrorEvent) {
          const source = event.filename
            ? ` · ${resourceName(event.filename)}:${event.lineno}:${event.colno}`
            : '';
          recordDiagnosticError('脚本错误', event.message + source);
        } else if (event.target instanceof Element) {
          const path =
            event.target.getAttribute('src') ||
            event.target.getAttribute('href');
          if (path) recordDiagnosticError('资源加载失败', resourceName(path));
        }
      }
      function onRejection(event: PromiseRejectionEvent) {
        recordDiagnosticError('未处理的 Promise', event.reason);
      }
      window.addEventListener('error', onError, true);
      window.addEventListener('unhandledrejection', onRejection);
      onCleanup(() => {
        window.removeEventListener('error', onError, true);
        window.removeEventListener('unhandledrejection', onRejection);
      });
    },
    {immediate: true, flush: 'sync'},
  );
}
