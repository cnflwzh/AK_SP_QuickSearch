<script setup lang="ts">
import {computed, ref, watch} from 'vue';
import {
  boxShareUrl,
  encodeBox,
  renderBoxQrDataUrl,
} from '../../lib/box/share.ts';
import {
  boxSeasonBorrowedCount,
  boxSeasonCount,
  operatorBox,
} from '../../lib/box/store.ts';
import CopyButton from '../components/CopyButton.vue';
import StatusNotice from '../components/StatusNotice.vue';

const emit = defineEmits<{close: []}>();

const code = computed(() => encodeBox(operatorBox));
const url = computed(() => boxShareUrl(code.value));
const qrSrc = ref('');
const qrError = ref('');

let renderId = 0;
watch(
  url,
  async (target) => {
    const seq = ++renderId;
    qrSrc.value = '';
    qrError.value = '';
    try {
      const dataUrl = await renderBoxQrDataUrl(target);
      if (seq === renderId) qrSrc.value = dataUrl;
    } catch {
      if (seq === renderId) {
        qrSrc.value = '';
        qrError.value = '二维码生成失败，可直接复制下方链接或短码粘贴导入。';
      }
    }
  },
  {immediate: true},
);
</script>

<template>
  <section class="bx-sync panel-reveal" aria-label="Box 跨端离线同步">
    <div class="bx-sync-head">
      <div class="bx-sync-title">
        <b>跨端同步（二维码 / 短码）</b>
        <small>
          已打包 {{ boxSeasonCount }} 名持有
          <template v-if="boxSeasonBorrowedCount">
            · {{ boxSeasonBorrowedCount }} 名助战
          </template>
          · {{ code.length }} 字符 · 仅含本季记录
        </small>
      </div>
      <button type="button" class="btn" @click="emit('close')">收起</button>
    </div>

    <div class="bx-sync-body">
      <div class="bx-sync-qr-box">
        <img
          v-if="qrSrc"
          :src="qrSrc"
          class="bx-sync-qr"
          width="156"
          height="156"
          alt="使用手机扫描此二维码导入 Box" />
        <div v-else class="bx-sync-qr-placeholder">
          {{ qrError ? '二维码不可用' : '生成中…' }}
        </div>
        <span v-if="qrSrc" class="bx-sync-qr-tip">
          手机相机或浏览器扫码直达
        </span>
      </div>

      <div class="bx-sync-fields">
        <p class="bx-sync-desc">
          在手机上扫码打开链接，核对练度后选择合并或覆盖。手机无法访问此链接时，可把短码粘贴到手机速查页的「导入
          MAA / 名单」。
        </p>

        <div class="bx-sync-row">
          <span class="k">同步链接</span>
          <code>{{ url }}</code>
          <CopyButton
            :text="url"
            label="复制链接"
            copied-label="已复制"
            variant="primary"
            aria-label="复制 Box 同步链接" />
        </div>

        <div class="bx-sync-row">
          <span class="k">离线短码</span>
          <code>{{ code }}</code>
          <CopyButton
            :text="code"
            label="复制短码"
            copied-label="已复制"
            variant="compact"
            aria-label="复制 Box 离线短码" />
        </div>

        <StatusNotice v-if="qrError" tone="warning" :message="qrError" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.bx-sync {
  grid-column: 1 / -1;
  display: grid;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid color-mix(in srgb, var(--teal) 35%, var(--line));
  border-radius: 10px;
  background: color-mix(in srgb, var(--teal) 4%, var(--surface2));
}
.bx-sync-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.bx-sync-title {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 10px;
}
.bx-sync-title b {
  font-size: 13.5px;
  color: var(--ink);
}
.bx-sync-title small {
  font-size: 11.5px;
  color: var(--ink3);
  font-family: var(--fn);
}
.bx-sync-body {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 14px;
  align-items: center;
}
.bx-sync-qr-box {
  display: grid;
  justify-items: center;
  gap: 5px;
}
.bx-sync-qr {
  display: block;
  width: 156px;
  height: 156px;
  padding: 6px;
  border-radius: 10px;
  background: #ffffff;
  border: 1px solid var(--line2);
  image-rendering: pixelated;
}
.bx-sync-qr-placeholder {
  width: 156px;
  height: 156px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  border: 1px dashed var(--line2);
  background: var(--surface);
  font-size: 12px;
  color: var(--ink3);
}
.bx-sync-qr-tip {
  font-size: 11px;
  color: var(--ink3);
}
.bx-sync-fields {
  display: grid;
  gap: 8px;
  min-width: 0;
}
.bx-sync-desc {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--ink2);
}
.bx-sync-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
}
.bx-sync-row .k {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--ink3);
  white-space: nowrap;
}
.bx-sync-row code {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--fn);
  font-size: 11.5px;
  color: var(--ink);
}
@container box-tools (max-width: 600px) {
  .bx-sync-body {
    grid-template-columns: minmax(0, 1fr);
    justify-items: stretch;
  }
  .bx-sync-row {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .bx-sync-row .k {
    grid-column: 1 / -1;
  }
}
@media (max-height: 600px) {
  .bx-sync {
    padding: 9px 11px;
    gap: 7px;
  }
  .bx-sync-qr,
  .bx-sync-qr-placeholder {
    width: 116px;
    height: 116px;
  }
}
</style>
