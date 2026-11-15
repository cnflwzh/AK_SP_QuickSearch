import { computed, readonly, ref } from 'vue';
import { newAdvisorRun, sanitizeAdvisorRun } from '../../lib/recommendation/live/advisorState.ts';
import { type AdvisorRun } from '../../lib/recommendation/live/advisorTypes.ts';
const STORAGE_KEY = 'wsq.tools.advisor.v1';
const NOTICE_DURATION_MS = 3200;
/** 编辑只作用于草稿；返回错误时丢弃草稿并保留上次撤销机会。 */
export type AdvisorChange = (
  message: string,
  edit: (draft: AdvisorRun) => string | void,
) => boolean;
function loadRun(): AdvisorRun {
  try {
    return sanitizeAdvisorRun(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'));
  } catch {
    return newAdvisorRun();
  }
}
function cloneRun(run: AdvisorRun): AdvisorRun {
  return {
    ...run,
    operators: run.operators.map((operator) => ({ ...operator })),
    equipment: run.equipment.map((equipment) => ({ ...equipment })),
    layers: { ...run.layers },
    frontTargets: { ...run.frontTargets },
    shop: [...run.shop],
    bannedCovenants: [...run.bannedCovenants],
    excludedOperators: [...run.excludedOperators],
  };
}
/** 会话只负责持久化和原子编辑；推荐计算与游戏动作由调用方负责。 */
export function createAdvisorSession() {
  const run = ref<AdvisorRun>(loadRun());
  const undoSnapshot = ref<AdvisorRun | null>(null);
  const notice = ref('');
  const saveFailed = ref(false);
  let noticeTimer: ReturnType<typeof setTimeout> | undefined;
  function showNotice(message: string): void {
    clearTimeout(noticeTimer);
    notice.value = message;
    if (message) {
      noticeTimer = setTimeout(() => {
        notice.value = '';
      }, NOTICE_DURATION_MS);
    }
  }
  function saveRun(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(run.value));
      saveFailed.value = false;
    } catch {
      saveFailed.value = true;
    }
  }
  function change(message: string, edit: (draft: AdvisorRun) => string | void): boolean {
    const draft = cloneRun(run.value);
    const error = edit(draft);
    if (error) {
      showNotice(error);
      return false;
    }
    undoSnapshot.value = cloneRun(run.value);
    run.value = draft;
    showNotice(message);
    saveRun();
    return true;
  }
  function undo(): void {
    if (!undoSnapshot.value) {
      return;
    }
    run.value = undoSnapshot.value;
    undoSnapshot.value = null;
    showNotice('已撤销上一步');
    saveRun();
  }
  return {
    run,
    change,
    undo,
    showNotice,
    notice: readonly(notice),
    saveFailed: readonly(saveFailed),
    canUndo: computed(() => undoSnapshot.value !== null),
  };
}
