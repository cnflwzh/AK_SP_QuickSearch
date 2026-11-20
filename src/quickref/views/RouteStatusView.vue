<script setup lang="ts">
import {useClipboardCopy} from '../components/useClipboardCopy.ts';
import {PAGE_PATHS} from '../../router/location.ts';

/** 有值时提示用户放大窗口；缺省时展示未知地址的 404。 */
defineProps<{windowPage?: string}>();
const {copiedKey, copyText} = useClipboardCopy();

function copyPageLink(): void {
  void copyText(window.location.href, 'page', {
    promptTitle: '复制当前页面链接',
  });
}
</script>

<template>
  <section class="route-status" aria-labelledby="route-status-title">
    <div class="route-status-mark" aria-hidden="true">
      <svg
        v-if="windowPage"
        viewBox="0 0 64 64"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linejoin="round"
        stroke-linecap="round">
        <rect x="7" y="10" width="50" height="42" rx="4" />
        <path d="M7 20h50" />
        <rect
          x="14"
          y="32"
          width="19"
          height="13"
          rx="2"
          fill="var(--teal-soft)" />
        <path d="m35 34 11-9m-8 0h8v7" />
      </svg>
      <span v-else>404</span>
    </div>
    <div class="route-status-body">
      <h2 id="route-status-title">
        {{ windowPage ? '请放大窗口' : '页面未找到' }}
      </h2>
      <p>
        {{
          windowPage
            ? `退出小窗或将窗口最大化，即可继续使用「${windowPage}」。`
            : '请检查链接地址，或返回速览继续查找。'
        }}
      </p>
      <div class="route-status-actions">
        <RouterLink class="btn p" :to="PAGE_PATHS.fx">返回速览</RouterLink>
        <button
          v-if="windowPage"
          class="btn"
          type="button"
          @click="copyPageLink">
          <span aria-live="polite">
            {{ copiedKey ? '已复制' : '复制页面链接' }}
          </span>
        </button>
      </div>
    </div>
  </section>
</template>
