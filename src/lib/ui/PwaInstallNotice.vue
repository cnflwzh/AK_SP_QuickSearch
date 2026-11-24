<script setup lang="ts">
import {computed, ref, useId, watch} from 'vue';
import {getInstallGuide} from '../runtime/installGuide.ts';
import {
  dismissInstallHint,
  installGuideAvailable,
  installHintDismissed,
  installHintDisabled,
  canPromptInstall,
  requestNativeInstall,
} from '../runtime/installPrompt.ts';
import StatusNotice from '../../quickref/components/StatusNotice.vue';

const props = defineProps<{inSettings?: boolean}>();
const guide = getInstallGuide(navigator);
const stepsId = useId();
const expanded = ref(false);
const explanation = ref<HTMLDialogElement>();
const interacted = ref(false);
const visible = computed(
  () =>
    installGuideAvailable.value &&
    !installHintDisabled.value &&
    (props.inSettings || !installHintDismissed.value),
);

// 设置页一直保留手动入口。点击链接、展开步骤或用键盘激活按钮后，不打断阅读。
watch(
  () => visible.value && !props.inSettings && !interacted.value,
  (idle, _, onCleanup) => {
    if (!idle) return;
    const timer = window.setTimeout(
      () => dismissInstallHint('outside-settings'),
      60_000,
    );
    onCleanup(() => window.clearTimeout(timer));
  },
  {immediate: true},
);

watch(
  () => props.inSettings,
  () => {
    interacted.value = false;
    expanded.value = false;
  },
);

async function install() {
  if (!(await requestNativeInstall())) expanded.value = true;
}
</script>

<template>
  <div v-if="visible" class="install-notice" @click.capture="interacted = true">
    <StatusNotice
      tone="accent"
      :dismissible="!inSettings"
      @dismiss="dismissInstallHint('outside-settings')">
      <span class="install-row">
        <span class="install-copy">
          <strong>{{ guide.title }}</strong>
          <span>点图标就能查牌，已经看过的资料断网也能查。</span>
        </span>
        <span class="install-actions">
          <button
            type="button"
            class="install-link"
            aria-haspopup="dialog"
            @click="explanation?.showModal()">
            什么是 PWA？
          </button>
          <button
            type="button"
            :aria-expanded="expanded"
            :aria-controls="stepsId"
            @click="expanded = !expanded">
            {{ expanded ? '收起步骤' : '安装步骤' }}
          </button>
          <button
            v-if="canPromptInstall"
            type="button"
            class="install-now"
            @click="install">
            立即安装
          </button>
          <button
            v-if="inSettings"
            type="button"
            @click="dismissInstallHint('everywhere')">
            不再提示
          </button>
        </span>
      </span>
    </StatusNotice>
    <div v-show="expanded" :id="stepsId" class="install-steps">
      <strong>{{ guide.device }}</strong>
      <ol>
        <li v-for="step in guide.steps" :key="step">{{ step }}</li>
      </ol>
    </div>
    <dialog
      ref="explanation"
      class="about install-dialog"
      aria-label="什么是 PWA？"
      @click.self="explanation?.close()">
      <header class="ab-h">
        <h2>什么是 PWA？</h2>
        <button
          class="ab-x"
          type="button"
          aria-label="关闭说明"
          @click="explanation?.close()">
          ✕
        </button>
      </header>
      <div class="ab-b">
        <section>
          <p><strong>就是能装到手机或电脑上的网页。</strong></p>
          <p>
            拿卫戍速查来说，装好后会多一个图标。下次打游戏时点它，就能直接查干员、装备和盟约，不用再找网址。
          </p>
          <p>
            有网时先打开想看的资料，浏览器存好后，断网也能再看。第一次看的内容还需要联网。
          </p>
        </section>
      </div>
    </dialog>
  </div>
</template>

<style scoped>
.install-notice {
  margin-block-end: 10px;
  container-type: inline-size;
}
.install-notice :deep(.q-notice-close) {
  width: 34px;
  height: 34px;
}
.install-row,
.install-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 10px;
}
.install-row {
  justify-content: space-between;
}
.install-copy {
  display: grid;
  gap: 2px;
  color: var(--ink2);
}
.install-copy strong {
  color: var(--ink);
}
.install-actions {
  gap: 4px;
}
.install-actions button {
  min-height: 36px;
  padding: 2px 10px;
  border: 1px solid var(--line2);
  border-radius: 6px;
  background: var(--surface);
  color: var(--ink2);
  font: inherit;
  cursor: pointer;
}
.install-actions button:hover,
.install-actions .install-now {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-soft);
}
.install-actions .install-link {
  border: 0;
  padding: 2px 4px;
  background: transparent;
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 3px;
  font: inherit;
  cursor: pointer;
}
.install-dialog {
  max-width: 420px;
}
.install-dialog p + p {
  margin-top: 8px;
}
.install-steps {
  margin-top: 4px;
  padding: 10px 14px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: var(--surface);
  color: var(--ink2);
  font-size: 13px;
  line-height: 1.6;
}
.install-steps ol {
  margin: 4px 0 0;
  padding-inline-start: 1.6em;
}
@container (max-width: 440px) {
  .install-row {
    gap: 3px 6px;
  }
  .install-actions button {
    padding-inline: 7px;
  }
}
@media (max-height: 600px) {
  .install-notice {
    margin-block-end: 5px;
  }
  .install-notice :deep(.q-notice) {
    padding-block: 2px;
  }
  .install-actions button {
    min-height: 34px;
  }
}
</style>
