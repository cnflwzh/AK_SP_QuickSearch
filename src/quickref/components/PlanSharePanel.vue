<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { encodePlan, shareUrl, type Plan } from '../../lib/planner.ts';
import { downloadBlob } from '../../lib/download.ts';

/** 分享传入方案的当前内容；查看页和编辑页共用，不会修改或保存方案。 */
const props = defineProps<{ plan: Plan }>();
const code = computed(() => encodePlan(props.plan));
const link = computed(() => shareUrl(code.value));
const copied = ref('');
let copyTimer: ReturnType<typeof setTimeout> | undefined;
onBeforeUnmount(() => clearTimeout(copyTimer));
async function copy(text: string, what: string): Promise<void> {
  clearTimeout(copyTimer);
  try { await navigator.clipboard.writeText(text); copied.value = what; }
  catch { copied.value = ''; prompt('复制下面的内容', text); }
  copyTimer = setTimeout(() => { copied.value = ''; }, 1500);
}

const imageBusy = ref(false);
const imageError = ref('');
async function saveImage(): Promise<void> {
  if (imageBusy.value) return;
  imageBusy.value = true;
  imageError.value = '';
  // 导出期间切换或继续编辑，也让图片、二维码和文件名来自同一份快照。
  const snapshot: Plan = JSON.parse(JSON.stringify(props.plan));
  try {
    const { planImage } = await import('../../lib/planImage.ts');
    const blob = await planImage(snapshot, shareUrl(encodePlan(snapshot)));
    if (!blob) throw new Error('Image export failed');
    downloadBlob(blob, `${snapshot.name || '阵容'}.png`);
  } catch { imageError.value = '图片生成失败，请重试或复制分享链接。'; }
  finally { imageBusy.value = false; }
}
</script>

<template>
  <section class="pl-panel plan-share" aria-label="分享流派">
    <div class="pl-code"><span class="k">分享码</span><code>{{ code }}</code><button type="button" aria-label="复制分享码" @click="copy(code, 'code')">{{ copied === 'code' ? '已复制' : '复制' }}</button></div>
    <div class="pl-code"><span class="k">链接</span><code>{{ link }}</code><button type="button" aria-label="复制分享链接" @click="copy(link, 'link')">{{ copied === 'link' ? '已复制' : '复制' }}</button></div>
    <div class="pl-code"><span class="k">图片</span><span class="hint">干员、装备、盟约，附二维码，扫码即导入</span><button type="button" :disabled="imageBusy || !plan.ops.length" @click="saveImage">{{ imageBusy ? '生成中…' : '生成图片' }}</button></div>
    <p v-if="imageError" class="pl-warn" role="status">{{ imageError }}</p>
    <span class="sr-only" role="status">{{ copied ? '已复制' : '' }}</span>
  </section>
</template>

<style scoped>
.plan-share { min-width: 0; }
.plan-share button { font-family: inherit; color: var(--ink); cursor: pointer; }
.plan-share button:disabled { opacity: .5; cursor: default; }
.plan-share .hint { font-size: 11.5px; color: var(--ink3); }
</style>
