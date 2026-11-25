<script setup lang="ts">
import {computed, onBeforeUnmount, ref, shallowRef, watch} from 'vue';
import {newId} from '../../lib/plans/storage.ts';
import {decodePlan, type Decoded} from '../../lib/plans/sharing.ts';
import {planShareSource} from '../../lib/plans/shareInput.ts';
import {readGuideReference} from '../../lib/plans/guideReference.ts';
import {MAX_BACKUP_BYTES, parsePlanBackup} from '../../lib/plans/backup.ts';
import type {Plan} from '../../lib/plans/model.ts';
import {buildLocation, navigate} from '../../router/navigation.ts';
import {hasPlanOperators, saveGuidePlan, setRun} from '../planStore.ts';
import PlanImportPreview from './PlanImportPreview.vue';
import SklandImport from './SklandImport.vue';
import StatusNotice from './StatusNotice.vue';

const importText = defineModel<string>({required: true});
const planFile = ref<HTMLInputElement>();
const filePlan = shallowRef<Plan>();
const pasteError = ref('');
const guideReference = computed(() =>
  imported.value ? null : readGuideReference(importText.value),
);
const canReadClipboard =
  typeof navigator !== 'undefined' &&
  typeof navigator.clipboard?.readText === 'function';
const imported = computed<Decoded | null>(() =>
  filePlan.value
    ? {plan: filePlan.value}
    : importText.value.trim() &&
        !planShareSource(importText.value).includes('#g=')
      ? decodePlan(importText.value)
      : null,
);
let fileRequest = 0;
function clearFileImport(): void {
  fileRequest++;
  filePlan.value = undefined;
  pasteError.value = '';
}
async function readPlanFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  clearFileImport();
  importText.value = '';
  const request = fileRequest;
  try {
    if (file.size > MAX_BACKUP_BYTES)
      throw new Error('请选择 5 MB 以内的流派文件。');
    const backup = parsePlanBackup(await file.text());
    if (backup.plans.length !== 1)
      throw new Error('包含多套流派的文件请在「备份与恢复」中导入。');
    if (request === fileRequest) filePlan.value = backup.plans[0];
  } catch (error) {
    if (request === fileRequest)
      pasteError.value =
        error instanceof Error ? error.message : '无法读取流派文件。';
  }
}
watch(
  importText,
  (text) => {
    if (text) clearFileImport();
  },
  {flush: 'sync'},
);
onBeforeUnmount(clearFileImport);
async function pasteImport(): Promise<void> {
  clearFileImport();
  const request = fileRequest;
  try {
    const text = await navigator.clipboard.readText();
    if (request !== fileRequest) return;
    if (text) {
      clearFileImport();
      importText.value = text;
    } else pasteError.value = '剪贴板里还没有内容。';
  } catch {
    if (request !== fileRequest) return;
    pasteError.value = '浏览器未授予读取剪贴板权限，请手动粘贴。';
  }
}
function saveImport(next: Plan, andRun: boolean): void {
  let key: string;
  try {
    key = saveGuidePlan(next);
  } catch {
    return; // 存储层已显示空间不足或跨标签冲突，保留当前预览供重试。
  }
  if (andRun) setRun(key);
  // Only explicit import consumes the fragment; preview survives WeChat -> browser handoff.
  void navigate({path: buildLocation(key), query: {}, hash: ''}, true);
  importText.value = '';
  clearFileImport();
  pasteError.value = '';
}
function acceptImport(andRun = false): void {
  const d = imported.value;
  if (!d || (andRun && !hasPlanOperators(d.plan))) return;
  // 导入一份独立副本，不复用文件里的本机 ID 或覆盖同名内置流派。
  const next: Plan = {
    ...d.plan,
    id: newId(),
    updated: Date.now(),
    name: d.plan.name || '导入的流派',
  };
  delete next.base;
  saveImport(next, andRun);
}
</script>

<template>
  <section id="build-import" class="pl-panel bimp">
    <div class="bimp-bar">
      <input
        v-model="importText"
        class="pl-paste"
        placeholder="粘贴分享码、森空岛链接或整段分享文案"
        aria-label="流派分享码或链接"
        @input="clearFileImport" />
      <button v-if="canReadClipboard" type="button" @click="pasteImport">
        粘贴
      </button>
      <button type="button" @click="planFile?.click()">导入文件</button>
      <input
        ref="planFile"
        hidden
        type="file"
        accept=".json,application/json"
        aria-label="选择流派 JSON 文件"
        @change="readPlanFile" />
    </div>
    <StatusNotice v-if="pasteError" tone="warning" :message="pasteError" />
    <SklandImport
      v-if="guideReference"
      :id="guideReference.id"
      :patch="guideReference.patch"
      @accept="saveImport" />
    <template v-else-if="imported">
      <PlanImportPreview :plan="imported.plan" />
      <div class="pl-row">
        <button type="button" @click="acceptImport(false)">存为我的流派</button>
        <button
          type="button"
          class="pri"
          :disabled="!hasPlanOperators(imported.plan)"
          @click="acceptImport(true)">
          导入并设为本局
        </button>
      </div>
    </template>
    <StatusNotice
      v-else-if="importText.trim()"
      tone="warning"
      message="认不出这个分享码" />
  </section>
</template>
