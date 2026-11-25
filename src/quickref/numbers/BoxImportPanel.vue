<script setup lang="ts">
import {nextTick, onBeforeUnmount, ref, shallowRef, watch} from 'vue';
import type {OwnedBoxRank} from '../../lib/box/model.ts';
import type {BoxImportResult} from '../../lib/box/importText.ts';
import {applyBoxBatch} from '../../lib/box/store.ts';
import {lazyView} from '../../lib/ui/lazyView.ts';
import {routeQuery, updateQuery} from '../../router/navigation.ts';
import ConfirmButton from '../components/ConfirmButton.vue';
import SelectInput, {type SelectOption} from '../components/SelectInput.vue';
import StatusNotice from '../components/StatusNotice.vue';

const props = defineProps<{open: boolean}>();
const emit = defineEmits<{notice: [message: string]; close: []}>();
const BoxImportGuide = lazyView(() => import('./BoxImportGuide.vue'));
const guideOpen = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const pasteField = ref<HTMLTextAreaElement>();
const fileButton = ref<HTMLButtonElement>();
const importText = ref('');
const workbookName = ref('');
const fallbackRank = ref<OwnedBoxRank>(3);
const importPreview = shallowRef<BoxImportResult | null>(null);
const importError = ref('');

const FALLBACK_RANK_OPTIONS: readonly SelectOption<OwnedBoxRank>[] = [
  {value: 3, label: '精二 60 级（满自持加成）'},
  {value: 2, label: '精英二'},
  {value: 1, label: '精英一'},
  {value: 0, label: '已持有 · 未练（精0）'},
];

async function startGuidedImport(method: 'file' | 'paste'): Promise<void> {
  // 手机选择文件需要用户手势。先触发文件选择，再等待面板焦点更新。
  if (method === 'file') fileInput.value?.click();
  else if (workbookName.value) invalidateImportPreview();
  await nextTick();
  const target = method === 'file' ? fileButton.value : pasteField.value;
  target?.scrollIntoView({block: 'center'});
  target?.focus({preventScroll: true});
}

watch(
  () => routeQuery.value.import,
  (flag) => {
    if (flag !== '1') return;
    void updateQuery({import: null}, true);
    guideOpen.value = true;
  },
  {immediate: true},
);

let importRevision = 0;

// 输入、档位或面板变化立即作废旧预览和在途读取，覆盖按钮只能提交当前内容。
function invalidateImportPreview(): void {
  importRevision++;
  workbookName.value = '';
  importPreview.value = null;
  importError.value = '';
}
watch([importText, fallbackRank, () => props.open], invalidateImportPreview, {
  flush: 'sync',
});
onBeforeUnmount(invalidateImportPreview);

async function parseInput(): Promise<void> {
  invalidateImportPreview();
  const request = importRevision;
  emit('notice', '');
  try {
    const {parseBoxInputOnDemand} = await import('../../lib/box/importText.ts');
    if (request !== importRevision) return;
    const preview = await parseBoxInputOnDemand(
      importText.value,
      fallbackRank.value,
    );
    if (request === importRevision) importPreview.value = preview;
  } catch (cause) {
    if (request !== importRevision) return;
    importError.value =
      cause instanceof Error ? cause.message : '导入解析失败，请重试。';
  }
}

async function onSelectFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || !props.open) return;
  emit('notice', '');
  importText.value = '';
  invalidateImportPreview();
  const request = importRevision;
  try {
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('文件超过 5 MB，请检查是否选中了干员练度文件。');
    }
    if (
      /\.xlsx$/i.test(file.name) ||
      file.type ===
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ) {
      workbookName.value = file.name;
      const {readYituliuWorkbook} = await import('../../lib/box/importText.ts');
      if (request !== importRevision) return;
      const preview = await readYituliuWorkbook(file);
      if (request === importRevision) importPreview.value = preview;
      return;
    }
    const text = await file.text();
    if (request !== importRevision) return;
    importText.value = text;
    await parseInput();
  } catch (cause) {
    if (request !== importRevision) return;
    workbookName.value = '';
    importError.value =
      cause instanceof Error ? cause.message : '文件读取失败，请重试。';
  }
}

function commitImport(mode: 'merge' | 'replace'): void {
  const preview = importPreview.value;
  if (!preview || (mode === 'replace' && !preview.matchedCount)) return;
  try {
    applyBoxBatch(preview.entries, mode);
  } catch (cause) {
    importError.value = cause instanceof Error ? cause.message : '导入失败。';
    return;
  }
  const b = preview.breakdown;
  const extraBorrowed = b.borrowed ? ` / 已借用 ${b.borrowed}` : '';
  let notice = `已${mode === 'replace' ? '覆盖' : '合并'}导入 ${preview.matchedCount} 名本赛季干员（精二60 ${b.e260} / 精二 ${b.e2} / 精一 ${b.e1} / 未练精0 ${b.e0}${extraBorrowed}）。`;
  if (preview.otherSeasonCount) {
    notice += ` 同时导入 ${preview.otherSeasonCount} 条其他赛季记录。`;
  }
  emit('notice', notice);
  importText.value = '';
  emit('close');
}
</script>

<template>
  <div v-if="open" class="bx-import panel-reveal">
    <div class="bx-import-head">
      <b>批量导入干员持有与练度</b>
      <button type="button" class="btn bx-guide-link" @click="guideOpen = true">
        导入指南
      </button>
    </div>
    <p v-if="workbookName" class="bx-workbook" role="status">
      {{ importPreview ? '已读取' : '正在读取' }} {{ workbookName }}
    </p>
    <textarea
      v-else
      ref="pasteField"
      v-model="importText"
      class="bx-textarea"
      aria-label="粘贴干员练度 JSON、一图流练度表、同步短码或干员名单"
      placeholder="粘贴 MAA JSON、带列名的一图流表格、WB 跨端同步码，或干员名（如：鸿雪、仇白）"></textarea>
    <div class="bx-import-controls">
      <label v-if="!workbookName" class="bx-fallback-rank">
        纯名单默认状态
        <SelectInput
          v-model="fallbackRank"
          :options="FALLBACK_RANK_OPTIONS"
          aria-label="纯名单默认状态" />
      </label>
      <button
        v-if="!workbookName"
        type="button"
        class="btn p"
        @click="parseInput">
        解析预览
      </button>
      <button
        v-else
        type="button"
        class="btn"
        @click="startGuidedImport('paste')">
        改用粘贴
      </button>
      <button
        ref="fileButton"
        type="button"
        class="btn"
        @click="fileInput?.click()">
        选择练度文件
      </button>
      <button type="button" class="btn" @click="emit('close')">收起</button>
    </div>
    <StatusNotice v-if="importError" tone="danger" :message="importError" />
    <div v-if="importPreview" class="bx-preview panel-reveal">
      <p>
        识别格式：
        <b>{{ importPreview.formatLabel }}</b>
        · 匹配本赛季干员
        <b>{{ importPreview.matchedCount }}</b>
        名（精二60 {{ importPreview.breakdown.e260 }} / 精二
        {{ importPreview.breakdown.e2 }} / 精一
        {{ importPreview.breakdown.e1 }} / 未练精0
        {{ importPreview.breakdown.e0 }}
        <template v-if="importPreview.breakdown.borrowed">
          / 已借用 {{ importPreview.breakdown.borrowed }}
        </template>
        ）
        <template v-if="importPreview.otherSeasonCount">
          · 其他赛季记录 {{ importPreview.otherSeasonCount }} 条
        </template>
        <template v-if="importPreview.ignoredCount">
          · 跳过未入池/未识别 {{ importPreview.ignoredCount }} 项
        </template>
      </p>
      <div class="bx-actions">
        <button type="button" class="btn p" @click="commitImport('merge')">
          合并导入（保留较高练度）
        </button>
        <ConfirmButton
          label="覆盖本季练度"
          confirm-label="确认替换（清除名单外标记）"
          :disabled="!importPreview.matchedCount"
          :reset-key="importPreview"
          @confirm="commitImport('replace')" />
        <button type="button" class="btn" @click="invalidateImportPreview">
          取消
        </button>
      </div>
    </div>
  </div>
  <BoxImportGuide
    v-if="guideOpen"
    @start="startGuidedImport"
    @close="guideOpen = false" />
  <input
    ref="fileInput"
    type="file"
    accept=".xlsx,.json,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/json,text/plain"
    hidden
    @change="onSelectFile" />
</template>

<style scoped>
/* ---------- 批量导入面板 ---------- */
.bx-import {
  min-width: 0;
  display: grid;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--line2);
  border-radius: 8px;
  background: var(--surface2);
}
.bx-import-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px 10px;
}
.bx-import-head b {
  font-size: 13px;
}
.bx-guide-link {
  margin-inline-start: auto;
}
.bx-workbook {
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--ink2);
}
.bx-textarea {
  width: 100%;
  min-height: 80px;
  padding: 8px;
  border: 1px solid var(--line2);
  border-radius: 6px;
  background: var(--surface);
  color: var(--ink);
  font: 12px/1.5 var(--fn);
  resize: vertical;
}
.bx-import-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.bx-fallback-rank {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--ink2);
}
.bx-preview {
  display: grid;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--teal);
  border-radius: 6px;
  background: color-mix(in srgb, var(--teal) 8%, var(--surface));
  font-size: 12.5px;
}
</style>
