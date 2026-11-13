<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue';
import { MAX_BACKUP_BYTES, parsePlanBackup, serializePlanBackup, type PlanBackup } from '../../lib/planBackup.ts';
import { downloadBlob } from '../../lib/download.ts';
import { plans, restorePlanBackup } from '../planStore.ts';

const fileInput = ref<HTMLInputElement>();
const backup = shallowRef<PlanBackup | null>(null);
const filename = ref('');
const reading = ref(false);
const error = ref('');
const message = ref('');
const customCount = computed(() => plans.filter(plan => !plan.base).length);
const modifiedCount = computed(() => plans.length - customCount.value);
const exportedDate = computed(() => backup.value ? new Date(backup.value.exportedAt).toLocaleString('zh-CN') : '');
let readRequest = 0;
onBeforeUnmount(() => { readRequest++; });

function exportBackup(): void {
  error.value = '';
  message.value = '';
  try {
    const text = serializePlanBackup(plans);
    const now = new Date();
    const date = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
    downloadBlob(new Blob([text], { type: 'application/json;charset=utf-8' }), `卫戍速查-流派备份-${date}.json`);
  } catch (cause) { error.value = cause instanceof Error ? cause.message : '备份导出失败，请重试。'; }
}

async function selectFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  const request = ++readRequest;
  backup.value = null;
  error.value = '';
  message.value = '';
  filename.value = file.name;
  reading.value = true;
  try {
    if (file.size > MAX_BACKUP_BYTES) throw new Error('备份文件超过 5 MB，请选择流派备份文件。');
    const text = await file.text();
    if (request !== readRequest) return;
    backup.value = parsePlanBackup(text);
  } catch (cause) {
    if (request === readRequest) error.value = cause instanceof Error ? cause.message : '文件读取失败，请重新选择。';
  } finally { if (request === readRequest) reading.value = false; }
}

function restoreBackup(): void {
  if (!backup.value) return;
  error.value = '';
  try {
    const result = restorePlanBackup(backup.value.plans);
    const details = [`已恢复 ${result.additions.length} 套流派`];
    if (result.skipped) details.push(`跳过 ${result.skipped} 套重复流派`);
    if (result.conflicts) details.push(`${result.conflicts} 套冲突版本已保留为我的流派`);
    message.value = details.join('，') + '。';
    backup.value = null;
  } catch (cause) { error.value = cause instanceof Error ? cause.message : '恢复失败，请重试。'; }
}
</script>

<template>
  <section class="pl-panel bimp plan-backup" aria-labelledby="plan-backup-title">
    <div class="backup-heading">
      <h3 id="plan-backup-title">备份与恢复</h3>
      <span class="hint">我的流派 {{ customCount }} · 已修改预设 {{ modifiedCount }}</span>
    </div>
    <p class="hint">导出流派备份，在另一台设备选择文件即可恢复。</p>
    <div class="pl-row">
      <button type="button" :disabled="!plans.length" @click="exportBackup">导出全部流派</button>
      <button type="button" @click="fileInput?.click()">选择备份文件</button>
      <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="selectFile">
    </div>
    <p v-if="reading" class="hint" role="status">正在读取备份…</p>
    <div v-if="backup" class="backup-preview">
      <p class="backup-filename">{{ filename }}</p>
      <p class="hint">{{ exportedDate }} · {{ backup.plans.length }} 套流派</p>
      <ul v-if="backup.plans.length" class="backup-list" aria-label="备份中的流派">
        <li v-for="(plan, index) in backup.plans" :key="index"><span>{{ plan.name || '未命名流派' }}</span><small>{{ plan.base ? '已修改预设' : '我的流派' }}</small></li>
      </ul>
      <p class="hint">相同内容自动跳过，冲突版本保留为我的流派。</p>
      <div class="pl-row"><button type="button" class="backup-restore" :disabled="!backup.plans.length" @click="restoreBackup">恢复流派</button></div>
    </div>
    <p v-if="error" class="pl-warn" role="alert">{{ error }}</p>
    <p v-if="message" class="backup-message" role="status">{{ message }}</p>
  </section>
</template>

<style scoped>
.plan-backup { gap: 10px; }
.plan-backup p { margin: 0; }
.plan-backup button { font-family: inherit; color: var(--ink); cursor: pointer; }
.plan-backup button:disabled { opacity: .5; cursor: default; }
.backup-heading { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 12px; }
.backup-heading h3 { margin: 0; font-size: 15px; }
.plan-backup .hint { color: var(--ink3); font-size: 12px; }
.backup-preview { display: grid; gap: 8px; border-top: 1px dashed var(--line); padding-top: 10px; }
.backup-filename { font-size: 13px; overflow-wrap: anywhere; }
.backup-list { list-style: none; padding: 0; margin: 0; max-height: 180px; overflow-y: auto; }
.backup-list li { display: flex; align-items: center; gap: 12px; padding: 5px 0; font-size: 13px; }
.backup-list li span { overflow-wrap: anywhere; }
.backup-list small { flex: none; color: var(--ink3); }
.pl-row .backup-restore { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
.backup-message { font-size: 13px; }
</style>
