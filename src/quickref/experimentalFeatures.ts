import { readonly, shallowRef } from 'vue';

const ADVISOR_PREVIEW_KEY = 'wsq.preview.advisor';

function restoreAdvisorPreview(): boolean {
  try { return sessionStorage.getItem(ADVISOR_PREVIEW_KEY) === '1'; }
  catch { return false; }
}

const advisorPreview = shallowRef(restoreAdvisorPreview());
export const advisorPreviewEnabled = readonly(advisorPreview);

declare global {
  interface Window {
    /** 控制台预览开关：默认开启；传 false 关闭。返回当前开关状态。 */
    wsqAdvisor: (enabled?: boolean) => boolean;
  }
}

/** 注册控制台入口。开关只在当前标签页会话保存，不改变用户的局内记录。 */
export function registerExperimentalCommands(): void {
  window.wsqAdvisor = (enabled = true) => {
    advisorPreview.value = enabled === true;
    try {
      if (advisorPreview.value) sessionStorage.setItem(ADVISOR_PREVIEW_KEY, '1');
      else sessionStorage.removeItem(ADVISOR_PREVIEW_KEY);
    } catch { /* 存储不可用时，开关仍在当前页面即时生效。 */ }
    return advisorPreview.value;
  };
}
