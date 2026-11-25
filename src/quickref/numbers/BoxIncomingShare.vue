<script setup lang="ts">
import {ref, shallowRef, watch} from 'vue';
import {parseBoxShare} from '../../lib/box/importShare.ts';
import type {BoxImportResult} from '../../lib/box/importText.ts';
import {applyBoxBatch, boxStorageWriteFailed} from '../../lib/box/store.ts';
import ConfirmButton from '../components/ConfirmButton.vue';
import StatusNotice from '../components/StatusNotice.vue';

const props = defineProps<{hash: string}>();
const emit = defineEmits<{notice: [message: string]; dismiss: []}>();
const syncIncoming = shallowRef<BoxImportResult | null>(null);
const syncIncomingError = ref('');

watch(
  () => props.hash,
  (hash) => {
    syncIncoming.value = null;
    syncIncomingError.value = '';
    try {
      syncIncoming.value = parseBoxShare(hash);
    } catch (error) {
      syncIncomingError.value =
        error instanceof Error
          ? error.message
          : '跨端同步链接不完整或已损坏，请重新扫码。';
    }
  },
  {immediate: true},
);

function clearSyncHash(): void {
  syncIncoming.value = null;
  syncIncomingError.value = '';
  emit('dismiss');
}

function commitIncomingSync(mode: 'merge' | 'replace'): void {
  const preview = syncIncoming.value;
  if (!preview || (mode === 'replace' && !preview.matchedCount)) return;
  syncIncomingError.value = '';
  try {
    applyBoxBatch(preview.entries, mode);
  } catch (cause) {
    syncIncomingError.value =
      cause instanceof Error ? cause.message : '同步导入失败。';
    return;
  }
  // 只有写盘成功才消费链接，存储受限时可保留来源并重试。
  if (boxStorageWriteFailed.value) return;
  const b = preview.breakdown;
  const extraBorrowed = b.borrowed ? ` / 已借用 ${b.borrowed}` : '';
  emit(
    'notice',
    `已通过跨端同步${mode === 'replace' ? '覆盖' : '合并'}导入 ${preview.matchedCount} 名本赛季干员（精二60 ${b.e260} / 精二 ${b.e2} / 精一 ${b.e1} / 未练精0 ${b.e0}${extraBorrowed}）。`,
  );
  clearSyncHash();
}
</script>

<template>
  <section
    v-if="syncIncoming || syncIncomingError"
    class="nc bx-sync-incoming panel-reveal"
    aria-label="跨端同步导入确认">
    <template v-if="syncIncoming">
      <div class="bx-sync-in-head">
        <b>收到跨端同步的干员 Box</b>
        <span>
          共 {{ syncIncoming.matchedCount }} 名（精二60
          {{ syncIncoming.breakdown.e260 }} / 精二
          {{ syncIncoming.breakdown.e2 }} / 精一
          {{ syncIncoming.breakdown.e1 }} / 精0
          {{ syncIncoming.breakdown.e0 }}
          <template v-if="syncIncoming.breakdown.borrowed">
            / 已借用 {{ syncIncoming.breakdown.borrowed }}
          </template>
          ）
        </span>
      </div>
      <div class="bx-actions">
        <button
          type="button"
          class="btn p"
          @click="commitIncomingSync('merge')">
          合并导入（保留较高练度）
        </button>
        <ConfirmButton
          label="覆盖本季练度"
          confirm-label="确认覆盖当前 Box"
          :disabled="!syncIncoming.matchedCount"
          :reset-key="syncIncoming"
          @confirm="commitIncomingSync('replace')" />
        <button type="button" class="btn" @click="clearSyncHash">忽略</button>
      </div>
    </template>
    <StatusNotice
      v-if="syncIncomingError"
      tone="warning"
      :message="syncIncomingError"
      dismissible
      @dismiss="clearSyncHash" />
  </section>
</template>

<style scoped>
.bx-sync-incoming {
  display: grid;
  gap: 8px;
  padding: 12px 14px;
  border-color: color-mix(in srgb, var(--teal) 45%, var(--line));
  background: color-mix(in srgb, var(--teal) 6%, var(--surface));
}
.bx-sync-in-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 10px;
  font-size: 12.5px;
  color: var(--ink2);
}
.bx-sync-in-head b {
  font-size: 13.5px;
  color: var(--teal);
}
</style>
