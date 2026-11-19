import {onBeforeUnmount, ref} from 'vue';

export type ClipboardCopyOutcome = 'copied' | 'fallback';

export interface ClipboardCopyOptions {
  /** 复制成功提示持续时长（毫秒）。 */
  resetMs?: number;
  /** 剪贴板不可用时，若提供文案则自动弹出 window.prompt 兜底。 */
  promptTitle?: string;
}

/**
 * 统一剪贴板写入逻辑：带防竞态请求计数、自动恢复状态与组件卸载清理。
 */
export function useClipboardCopy(defaultResetMs = 1600) {
  const copiedKey = ref('');
  let timer: ReturnType<typeof setTimeout> | undefined;
  let requestId = 0;

  function reset(): void {
    clearTimeout(timer);
    copiedKey.value = '';
  }

  async function copyText(
    text: string,
    key = 'default',
    options: ClipboardCopyOptions = {},
  ): Promise<ClipboardCopyOutcome> {
    if (!text) return 'fallback';
    const current = ++requestId;
    const duration = options.resetMs ?? defaultResetMs;
    clearTimeout(timer);
    try {
      await navigator.clipboard.writeText(text);
      if (current === requestId) {
        copiedKey.value = key;
        timer = setTimeout(() => {
          if (current === requestId) copiedKey.value = '';
        }, duration);
      }
      return 'copied';
    } catch {
      if (current === requestId) {
        copiedKey.value = '';
        if (options.promptTitle) {
          window.prompt(options.promptTitle, text);
        }
      }
      return 'fallback';
    }
  }

  onBeforeUnmount(() => {
    clearTimeout(timer);
    requestId++;
  });

  return {
    copiedKey,
    copyText,
    reset,
  };
}
