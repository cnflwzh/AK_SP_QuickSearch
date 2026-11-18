<script setup lang="ts">
import {computed, onBeforeUnmount, ref} from 'vue';
import {
  encodePlan,
  formatPlanShareText,
  shareUrl,
  type Plan,
} from '../../lib/plans/index.ts';
import {downloadBlob} from '../../lib/ui/download.ts';

/** 分享传入方案的当前内容；查看页和编辑页共用，不会修改或保存方案。 */
const props = defineProps<{plan: Plan}>();
const code = computed(() => encodePlan(props.plan));
const link = computed(() => shareUrl(code.value));
const guideText = computed(() => formatPlanShareText(props.plan, link.value));
const showPreview = ref(false);
const copied = ref('');
let copyTimer: ReturnType<typeof setTimeout> | undefined;
onBeforeUnmount(() => clearTimeout(copyTimer));
function markCopied(what: string): void {
  clearTimeout(copyTimer);
  copied.value = what;
  copyTimer = setTimeout(() => {
    copied.value = '';
  }, 1500);
}
async function copy(text: string, what: string): Promise<void> {
  clearTimeout(copyTimer);
  try {
    await navigator.clipboard.writeText(text);
    markCopied(what);
  } catch {
    copied.value = '';
    prompt('复制下面的内容', text);
  }
}

const canCopyImage =
  typeof ClipboardItem !== 'undefined' &&
  typeof navigator !== 'undefined' &&
  typeof navigator.clipboard?.write === 'function';
const imageBusy = ref('');
const imageError = ref('');
async function buildImageBlob(snapshot: Plan): Promise<Blob> {
  const {planImage} = await import('../../lib/plans/image.ts');
  const blob = await planImage(snapshot, shareUrl(encodePlan(snapshot)));
  if (!blob) throw new Error('Image export failed');
  return blob;
}
async function saveImage(): Promise<void> {
  if (imageBusy.value) return;
  imageBusy.value = 'save';
  imageError.value = '';
  // 导出期间切换或继续编辑，也让图片、二维码和文件名来自同一份快照。
  const snapshot: Plan = JSON.parse(JSON.stringify(props.plan));
  try {
    const blob = await buildImageBlob(snapshot);
    downloadBlob(blob, `${snapshot.name || '阵容'}.png`);
  } catch {
    imageError.value = '图片生成失败，请重试或复制攻略文案。';
  } finally {
    imageBusy.value = '';
  }
}
async function copyImage(): Promise<void> {
  if (imageBusy.value || !canCopyImage) return;
  imageBusy.value = 'copy';
  imageError.value = '';
  const snapshot: Plan = JSON.parse(JSON.stringify(props.plan));
  try {
    // 绘图会异步加载头像；在点击事件内发起写入，避免生成图片期间用户激活失效。
    await navigator.clipboard.write([
      new ClipboardItem({'image/png': buildImageBlob(snapshot)}),
    ]);
    markCopied('img');
  } catch {
    imageError.value = '复制图片失败，可点「保存图片」后发送。';
  } finally {
    imageBusy.value = '';
  }
}
</script>

<template>
  <section class="pl-panel plan-share" aria-label="分享流派">
    <div class="pl-code pl-code-wrap">
      <span class="k">攻略文案</span>
      <span class="hint">
        分阶抓牌、过渡备选、策略配装与打法要点（发群可直接看，粘贴即可导入）
      </span>
      <span class="share-btns">
        <button
          type="button"
          :class="{on: showPreview}"
          :aria-expanded="showPreview"
          @click="showPreview = !showPreview">
          {{ showPreview ? '收起' : '预览' }}
        </button>
        <button
          type="button"
          class="pri"
          aria-label="复制攻略文案"
          @click="copy(guideText, 'guide')">
          {{ copied === 'guide' ? '已复制文案' : '复制文案' }}
        </button>
      </span>
    </div>
    <pre v-if="showPreview" class="pl-guide-preview">{{ guideText }}</pre>
    <div class="pl-code pl-code-wrap">
      <span class="k">一图流</span>
      <span class="hint">干员、过渡备选、配装、打法与扫码导入</span>
      <span class="share-btns">
        <button
          v-if="canCopyImage"
          type="button"
          :disabled="!!imageBusy || !plan.ops.length"
          @click="copyImage">
          {{
            imageBusy === 'copy'
              ? '生成中…'
              : copied === 'img'
                ? '已复制图片'
                : '复制图片'
          }}
        </button>
        <button
          type="button"
          :disabled="!!imageBusy || !plan.ops.length"
          @click="saveImage">
          {{ imageBusy === 'save' ? '生成中…' : '保存图片' }}
        </button>
      </span>
    </div>
    <div class="pl-code">
      <span class="k">链接</span>
      <code>{{ link }}</code>
      <button
        type="button"
        aria-label="复制分享链接"
        @click="copy(link, 'link')">
        {{ copied === 'link' ? '已复制' : '复制' }}
      </button>
    </div>
    <div class="pl-code">
      <span class="k">分享码</span>
      <code>{{ code }}</code>
      <button type="button" aria-label="复制分享码" @click="copy(code, 'code')">
        {{ copied === 'code' ? '已复制' : '复制' }}
      </button>
    </div>
    <p v-if="imageError" class="pl-warn" role="status">{{ imageError }}</p>
    <span class="sr-only" role="status">{{ copied ? '已复制' : '' }}</span>
  </section>
</template>

<style scoped>
.plan-share {
  min-width: 0;
}
.plan-share button {
  font-family: inherit;
  color: var(--ink);
  cursor: pointer;
}
.plan-share button.pri {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-ink);
  font-weight: 700;
}
.plan-share button.on {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-soft);
}
.plan-share button:disabled {
  opacity: 0.5;
  cursor: default;
}
.plan-share .hint {
  font-size: 11.5px;
  color: var(--ink3);
}
.pl-code .k {
  width: 4.2em;
}
.pl-code-wrap {
  flex-wrap: wrap;
}
.share-btns {
  display: inline-flex;
  gap: 6px;
  flex: none;
  margin-left: auto;
}
.pl-guide-preview {
  margin: 0;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--surface2);
  color: var(--ink);
  font-family: inherit;
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 180px;
  overflow: auto;
  user-select: text;
}
@media (max-height: 600px) {
  .pl-guide-preview {
    max-height: 120px;
  }
}
</style>
