import {computed, shallowRef} from 'vue';
import {getInstallGuide, type InstallGuide} from './installGuide.ts';

interface InstallPromptEvent extends Event {
  prompt(): Promise<unknown>;
  readonly userChoice: Promise<{outcome: 'accepted' | 'dismissed'}>;
}

const dismissalKey = 'wsq.pwa.hint.dismissed';
const disabledKey = 'wsq.pwa.hint.disabled';
const pending = shallowRef<InstallPromptEvent>();
export const installGuide = shallowRef<InstallGuide | null>(null);
export const installGuideAvailable = shallowRef(false);
export const installHintDismissed = shallowRef(false);
export const installHintDisabled = shallowRef(false);
export const canPromptInstall = computed(() => !!pending.value);

/** 记住关闭范围。普通页面超时或被关闭后仍可在设置页查看，显式选择全站关闭才隐藏设置入口。 */
export function dismissInstallHint(
  scope: 'outside-settings' | 'everywhere',
): void {
  const everywhere = scope === 'everywhere';
  if (everywhere) installHintDisabled.value = true;
  else installHintDismissed.value = true;
  try {
    localStorage.setItem(everywhere ? disabledKey : dismissalKey, '1');
  } catch {
    // 存储受限时，至少记住本页的选择。
  }
}

/** 在各页面开始挂载前捕获安装事件。返回值用于热更新时移除监听。 */
export function initInstallPrompt(): () => void {
  if (window.top !== window || !window.isSecureContext) return () => {};
  installGuide.value = getInstallGuide(navigator);
  const appMode = window.matchMedia(
    '(display-mode: standalone), (display-mode: minimal-ui), (display-mode: window-controls-overlay)',
  );
  let justInstalled = false;
  function syncMode() {
    const ios = navigator as Navigator & {standalone?: boolean};
    const inApp = appMode.matches || ios.standalone === true;
    installGuideAvailable.value =
      !!installGuide.value && !inApp && !justInstalled;
    if (inApp || justInstalled) {
      pending.value = undefined;
      dismissInstallHint('outside-settings');
    }
  }
  function syncDismissal() {
    try {
      installHintDismissed.value = localStorage.getItem(dismissalKey) === '1';
      installHintDisabled.value = localStorage.getItem(disabledKey) === '1';
    } catch {
      // 延续当前页面的状态。
    }
  }
  function onStorage(event: StorageEvent) {
    if (
      event.key === dismissalKey ||
      event.key === disabledKey ||
      event.key === null
    )
      syncDismissal();
  }
  function onPrompt(event: Event) {
    if (!installGuideAvailable.value) return;
    event.preventDefault();
    pending.value = event as InstallPromptEvent;
  }
  function onInstalled() {
    justInstalled = true;
    syncMode();
  }
  syncDismissal();
  syncMode();
  window.addEventListener('beforeinstallprompt', onPrompt);
  window.addEventListener('appinstalled', onInstalled);
  window.addEventListener('storage', onStorage);
  appMode.addEventListener('change', syncMode);
  return () => {
    window.removeEventListener('beforeinstallprompt', onPrompt);
    window.removeEventListener('appinstalled', onInstalled);
    window.removeEventListener('storage', onStorage);
    appMode.removeEventListener('change', syncMode);
    pending.value = undefined;
    installGuideAvailable.value = false;
    installGuide.value = null;
  };
}

/** 在点击处理函数中立即调用。事件不可用或调用失败时返回 false，页面改为显示手动步骤。 */
export async function requestNativeInstall(): Promise<boolean> {
  const event = pending.value;
  if (!event) return false;
  // 浏览器只允许对同一个事件调用一次 prompt()。
  pending.value = undefined;
  try {
    await event.prompt();
    const {outcome} = await event.userChoice;
    if (outcome === 'accepted') dismissInstallHint('outside-settings');
    return true;
  } catch {
    return false;
  }
}
