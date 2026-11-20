<script lang="ts">
const ONBOARDING_KEY = 'wsq.box.onboarding.v1';
const LEGACY_GUIDE_KEY = 'wsq.box.importGuide.seen';
let dismissedThisVisit = false;

function hasDismissedOnboarding(): boolean {
  if (dismissedThisVisit) return true;
  try {
    return (
      localStorage.getItem(ONBOARDING_KEY) === '1' ||
      localStorage.getItem(LEGACY_GUIDE_KEY) === '1'
    );
  } catch {
    return false;
  }
}

function markOnboardingDismissed(): void {
  dismissedThisVisit = true;
  try {
    localStorage.setItem(ONBOARDING_KEY, '1');
  } catch {
    /* 禁用本地存储时，当前访问期间仍只展示一次。 */
  }
}
</script>

<script setup lang="ts">
import {computed, ref, watch} from 'vue';
import {hasAnyBox} from '../../lib/box/store.ts';
import {initialNoticeComplete} from '../../lib/ui/initialNotice.ts';
import {currentRoute, navigate, routeQuery} from '../../router/navigation.ts';

const dialog = ref<HTMLDialogElement>();
const renderDialog = ref(false);
const eligible = computed(
  () =>
    initialNoticeComplete.value &&
    !hasAnyBox.value &&
    currentRoute.value.path !== '/box' &&
    !routeQuery.value.q &&
    !routeQuery.value.card &&
    !routeQuery.value.roster,
);

// 用户打开搜索、详情或 Box 时撤销等待中的提示。弹层仅在实际需要时挂载。
watch(
  eligible,
  (allowed, _, onCleanup) => {
    if (!allowed || hasDismissedOnboarding()) {
      renderDialog.value = false;
      return;
    }
    const timer = window.setTimeout(() => {
      renderDialog.value = eligible.value && !hasDismissedOnboarding();
    }, 320);
    onCleanup(() => window.clearTimeout(timer));
  },
  {immediate: true},
);

watch(dialog, (element) => {
  if (element?.isConnected && eligible.value && !hasDismissedOnboarding()) {
    element.showModal();
    markOnboardingDismissed();
  }
});

function skip(): void {
  markOnboardingDismissed();
  dialog.value?.close();
}

function goImport(): void {
  markOnboardingDismissed();
  dialog.value?.close();
  void navigate({path: '/box', query: {import: '1'}});
}
</script>

<template>
  <dialog
    v-if="renderDialog"
    ref="dialog"
    class="box-onboarding"
    aria-labelledby="box-onboarding-title"
    data-noswipe
    @close="renderDialog = false">
    <div class="bo-head">
      <div>
        <span class="bo-kicker">MY BOX · 个人练度</span>
        <h2 id="box-onboarding-title" tabindex="-1" autofocus>
          导入你的干员练度 Box？
        </h2>
      </div>
      <button type="button" class="bo-close" aria-label="先跳过" @click="skip">
        ✕
      </button>
    </div>

    <p class="bo-lead">
      在独立的「我的
      Box」页面集中管理你的本季干员练度与助战借用（数据仅存本地浏览器，随时可修改或清空）：
    </p>

    <ul class="bo-points">
      <li>
        <b>自持练度与加成总览</b>
        <span>按精二 60 / 精二 / 精一 / 未练自动统计自持攻防血加成覆盖率</span>
      </li>
      <li>
        <b>助战借用与系统预设</b>
        <span>
          清晰区分已借用、可借用 6★ 与系统预设干员，避免超出 30 名借用上限
        </span>
      </li>
      <li>
        <b>多种快捷导入方式</b>
        <span>支持 MAA JSON、一图流/森空岛表格，或直接粘贴干员名</span>
      </li>
    </ul>

    <div class="bo-actions">
      <button type="button" class="btn p" @click="goImport">
        去导入干员 Box
      </button>
      <button type="button" class="btn" @click="skip">先跳过</button>
    </div>
    <p class="bo-foot">随时可通过页面顶部的「我的 Box」入口管理练度。</p>
  </dialog>
</template>

<style scoped>
.box-onboarding {
  width: min(440px, calc(100vw - 24px));
  max-height: calc(100dvh - 24px);
  margin: auto;
  padding: 20px 20px 16px;
  border: 1px solid var(--line2);
  border-radius: 14px;
  background: var(--surface);
  color: var(--ink);
  box-shadow:
    0 20px 48px -16px rgba(10, 22, 20, 0.36),
    0 2px 8px rgba(10, 22, 20, 0.1);
  overflow-y: auto;
}
.box-onboarding::backdrop {
  background: rgba(10, 18, 20, 0.52);
  backdrop-filter: blur(2px);
}
.bo-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}
.bo-kicker {
  display: block;
  font: 700 10.5px/1.2 var(--fn);
  letter-spacing: 0.14em;
  color: var(--teal);
  margin-bottom: 3px;
}
.bo-head h2 {
  margin: 0;
  font-size: 17px;
  line-height: 1.3;
  color: var(--ink);
}
.bo-head h2:focus {
  outline: none;
}
.bo-close {
  flex: none;
  width: 34px;
  height: 34px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface2);
  color: var(--ink3);
  font-size: 13px;
  display: grid;
  place-items: center;
  cursor: pointer;
}
.bo-close:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.bo-lead {
  margin: 10px 0 12px;
  font-size: 13px;
  line-height: 1.55;
  color: var(--ink2);
}
.bo-points {
  list-style: none;
  margin: 0 0 16px;
  padding: 0;
  display: grid;
  gap: 8px;
}
.bo-points li {
  display: grid;
  gap: 2px;
  padding: 9px 11px;
  border: 1px solid var(--line);
  border-left: 3px solid var(--teal);
  border-radius: 8px;
  background: var(--surface2);
}
.bo-points b {
  font-size: 13px;
  color: var(--ink);
}
.bo-points span {
  font-size: 12px;
  line-height: 1.45;
  color: var(--ink2);
}
.bo-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.bo-actions .btn {
  flex: 1 1 130px;
  min-height: 38px;
  justify-content: center;
  font-weight: 600;
}
.bo-foot {
  margin: 10px 0 0;
  font-size: 11.5px;
  color: var(--ink3);
  text-align: center;
}

@media (max-height: 600px) {
  .box-onboarding {
    padding: 13px 15px 12px;
  }
  .bo-lead {
    margin: 6px 0 8px;
    font-size: 12.5px;
  }
  .bo-points {
    gap: 5px;
    margin-bottom: 10px;
  }
  .bo-points li {
    padding: 6px 9px;
  }
  .bo-actions .btn {
    min-height: 34px;
  }
  .bo-foot {
    margin-top: 6px;
  }
}
</style>
