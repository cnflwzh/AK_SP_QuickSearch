<script setup lang="ts">
import {copyPosterPng} from '../../lib/ui/canvasPoster.ts';
import {computed, onBeforeUnmount, ref} from 'vue';
import {formatPlanShareText, type Plan} from '../../lib/plans/index.ts';
import {downloadBlob} from '../../lib/ui/download.ts';
import {serializePlanBackup} from '../../lib/plans/backup.ts';
import {canShareViaQr} from '../../lib/plans/sharing.ts';
import {sklandUrl} from '../../lib/plans/skland.ts';
import {planShareLinks} from '../../lib/plans/sklandShare.ts';
import CopyButton from './CopyButton.vue';
import StatusNotice from './StatusNotice.vue';

/** 分享传入方案的当前内容；查看页和编辑页共用，不会修改或保存方案。 */
const props = defineProps<{plan: Plan}>();
const share = computed(() => planShareLinks(props.plan, location.origin));
const qrFits = computed(() => canShareViaQr(share.value.qrLink));
const guideText = computed(() =>
  formatPlanShareText(props.plan, share.value.link),
);
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

const canCopyImage =
  typeof ClipboardItem !== 'undefined' &&
  typeof navigator !== 'undefined' &&
  typeof navigator.clipboard?.write === 'function';
const imageBusy = ref('');
const imageError = ref('');
const fileError = ref('');
function savePlanFile(): void {
  fileError.value = '';
  try {
    const text = serializePlanBackup([props.plan]);
    downloadBlob(
      new Blob([text], {type: 'application/json;charset=utf-8'}),
      `${props.plan.name || '阵容'}.json`,
    );
  } catch (cause) {
    fileError.value =
      cause instanceof Error ? cause.message : '方案文件导出失败，请重试。';
  }
}
async function buildImageBlob(snapshot: Plan, url: string): Promise<Blob> {
  const {planImage} = await import('../../lib/plans/image.ts');
  const blob = await planImage(snapshot, url);
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
    const blob = await buildImageBlob(snapshot, share.value.qrLink);
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
    if (await copyPosterPng(buildImageBlob(snapshot, share.value.qrLink)) !== 'copied') {
      throw new Error('Clipboard unavailable');
    }
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
    <div v-if="share.link" class="pl-code">
      <span class="k">
        {{ share.kind === 'original' ? '森空岛原文' : '阵容链接' }}
      </span>
      <code>
        {{
          share.link.length > 160 ? share.link.slice(0, 160) + '…' : share.link
        }}
      </code>
      <CopyButton
        :text="share.link"
        label="复制链接"
        copied-label="已复制"
        variant="compact"
        aria-label="复制分享链接"
        @copied="markCopied('link')" />
    </div>
    <p v-if="plan.skland" class="hint share-source-hint">
      {{
        share.kind === 'original'
          ? '阵容与原文一致。转发链接可看森空岛原文，扫描分享图可在卫戍速查导入。'
          : share.kind === 'delta'
            ? '链接包含你相对原文的修改。接收方需联网读取森空岛；离线导入可使用下方完整分享码。'
            : '这份阵容使用完整分享，导入时可离线还原修改。'
      }}
    </p>
    <div v-if="plan.skland && share.kind !== 'original'" class="pl-code">
      <span class="k">森空岛原文</span>
      <code>{{ sklandUrl(plan.skland.id) }}</code>
      <CopyButton
        :text="sklandUrl(plan.skland.id)"
        label="复制原链"
        copied-label="已复制"
        variant="compact" />
    </div>
    <div class="pl-code pl-code-wrap">
      <span class="k">攻略文案</span>
      <span class="hint">分段阵容、抓牌顺序、策略配装与打法要点</span>
      <span class="share-btns">
        <button
          type="button"
          :class="{on: showPreview}"
          :aria-expanded="showPreview"
          @click="showPreview = !showPreview">
          {{ showPreview ? '收起' : '预览' }}
        </button>
        <CopyButton
          :text="guideText"
          label="复制文案"
          copied-label="已复制文案"
          variant="primary"
          aria-label="复制攻略文案"
          @copied="markCopied('guide')" />
      </span>
    </div>
    <pre v-if="showPreview" class="pl-guide-preview">{{ guideText }}</pre>
    <div class="pl-code pl-code-wrap">
      <span class="k">一图流</span>
      <span class="hint">
        {{
          qrFits
            ? '终盘配装与阶段概览，扫码可导入完整方案。'
            : '终盘配装与阶段概览，发送时可附上方案文件。'
        }}
      </span>
      <span class="share-btns">
        <button
          v-if="canCopyImage"
          type="button"
          :disabled="!!imageBusy"
          @click="copyImage">
          {{
            imageBusy === 'copy'
              ? '生成中…'
              : copied === 'img'
                ? '已复制图片'
                : '复制图片'
          }}
        </button>
        <button type="button" :disabled="!!imageBusy" @click="saveImage">
          {{ imageBusy === 'save' ? '生成中…' : '保存图片' }}
        </button>
      </span>
    </div>
    <div v-if="share.code" class="pl-code">
      <span class="k">{{ plan.skland ? '完整分享码' : '分享码' }}</span>
      <code>
        {{
          share.code.length > 160 ? share.code.slice(0, 160) + '…' : share.code
        }}
      </code>
      <CopyButton
        :text="share.code"
        label="复制"
        copied-label="已复制"
        variant="compact"
        aria-label="复制分享码"
        @copied="markCopied('code')" />
    </div>
    <StatusNotice
      v-if="!qrFits"
      tone="info"
      :message="
        share.code
          ? '完整链接超出二维码容量。可复制分享码，也可发送 JSON 方案文件。'
          : '当前方案无法生成分享码，可下载 JSON 文件保存完整内容。'
      " />
    <div class="pl-code pl-code-wrap">
      <span class="k">方案文件</span>
      <span class="hint">{{
        plan.skland
          ? '包含当前阵容、森空岛原文链接和原文快照。'
          : '包含完整内容，可在流派页选择「导入文件」。'
      }}</span>
      <span class="share-btns">
        <button type="button" @click="savePlanFile">下载 JSON</button>
      </span>
    </div>
    <StatusNotice v-if="fileError" tone="warning" :message="fileError" />
    <StatusNotice v-if="imageError" tone="warning" :message="imageError" />
    <span class="sr-only" role="status">{{ copied ? '已复制' : '' }}</span>
  </section>
</template>

<style scoped>
.plan-share {
  min-width: 0;
}
.share-source-hint {
  margin: 0;
}
.plan-share button:not(.copy-btn) {
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
