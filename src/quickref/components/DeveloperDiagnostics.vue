<script setup lang="ts">
import {computed, onBeforeUnmount, onMounted, ref, shallowRef} from 'vue';
import {diagnosticErrors} from '../../lib/runtime/diagnosticErrors.ts';
import {
  checkSiteConnection,
  environmentRows,
  offlineRows,
  probeStorage,
  timingRows,
} from '../../lib/ui/browserDiagnostics.ts';
import {
  formatRows,
  layoutRows,
  type DiagnosticRow,
} from '../../lib/ui/layoutDiagnostics.ts';
import CopyButton from './CopyButton.vue';
import SectionHeading from './SectionHeading.vue';

const ua = navigator.userAgent;
const layout = shallowRef<DiagnosticRow[]>([]);
const environment = shallowRef<DiagnosticRow[]>([]);
const timing = shallowRef<DiagnosticRow[]>([]);
const offline = shallowRef<DiagnosticRow[]>([]);
const storage = shallowRef<DiagnosticRow[]>([]);
const capturedAt = ref('');
const busy = ref(false);
const networkResult = ref('');
const checkingNetwork = ref(false);
let request: AbortController | undefined;
const groups = computed(() => [
  {title: '窗口与布局', rows: layout.value},
  {title: '浏览器与 PWA', rows: environment.value},
  {title: '网络、离线缓存与存储', rows: offline.value, checks: true},
  {title: '页面加载耗时', rows: timing.value},
]);

async function refresh(): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  try {
    capturedAt.value = new Date().toISOString();
    layout.value = layoutRows();
    environment.value = environmentRows();
    timing.value = timingRows();
    offline.value = await offlineRows();
  } finally {
    busy.value = false;
  }
}

function checkStorage(): void {
  storage.value = [
    ['localStorage', probeStorage('localStorage')],
    ['sessionStorage', probeStorage('sessionStorage')],
  ];
}

async function checkNetwork(): Promise<void> {
  if (checkingNetwork.value) return;
  checkingNetwork.value = true;
  request = new AbortController();
  try {
    networkResult.value = await checkSiteConnection(request);
  } finally {
    checkingNetwork.value = false;
    request = undefined;
  }
}

function report(): string {
  return [
    `卫戍速查诊断 · ${capturedAt.value}`,
    `浏览器 UA：${ua || '浏览器未提供'}`,
    ...groups.value.map(({title, rows}) => title + '\n' + formatRows(rows)),
    '本站连通性自检\n' +
      (checkingNetwork.value ? '检查中' : networkResult.value || '尚未运行'),
    '存储读写自检\n' +
      (storage.value.length ? formatRows(storage.value) : '尚未运行'),
    '最近错误\n' + (diagnosticErrors.value.join('\n') || '无记录'),
  ].join('\n\n');
}

onMounted(refresh);
onBeforeUnmount(() => request?.abort());
</script>

<template>
  <section class="diagnostics" aria-label="浏览器诊断">
    <SectionHeading title="浏览器诊断" />
    <div class="ua">
      <strong>浏览器 UA</strong>
      <CopyButton
        :text="ua"
        :disabled="!ua"
        label="复制 UA"
        copied-label="已复制 UA" />
      <code>{{ ua || '浏览器未提供' }}</code>
    </div>
    <div class="actions">
      <CopyButton
        :text="report"
        :disabled="busy"
        label="复制完整报告"
        copied-label="已复制报告" />
      <button type="button" class="btn" :disabled="busy" @click="refresh">
        刷新诊断
      </button>
      <small role="status">
        {{
          busy
            ? '正在读取…'
            : capturedAt
              ? '采集于 ' + new Date(capturedAt).toLocaleTimeString()
              : ''
        }}
      </small>
    </div>
    <details v-for="group in groups" :key="group.title">
      <summary>{{ group.title }}</summary>
      <dl>
        <div v-for="[label, value] in group.rows" :key="label">
          <dt>{{ label }}</dt>
          <dd>{{ value }}</dd>
        </div>
      </dl>
      <template v-if="group.checks">
        <div class="actions">
          <button
            type="button"
            class="btn"
            :disabled="checkingNetwork"
            @click="checkNetwork">
            检查本站连通性
          </button>
          <button type="button" class="btn" @click="checkStorage">
            检查存储读写
          </button>
        </div>
        <p v-if="checkingNetwork || networkResult" role="status">
          {{ checkingNetwork ? '正在请求本站安装清单…' : networkResult }}
        </p>
        <p v-if="storage.length" role="status">{{ formatRows(storage) }}</p>
      </template>
    </details>
    <details>
      <summary>最近错误（{{ diagnosticErrors.length }}）</summary>
      <small>
        本标签页在开发者模式下保留最近 20
        条错误。刷新后可查看，关闭开发者模式会清空记录。
      </small>
      <ul v-if="diagnosticErrors.length">
        <li v-for="(line, index) in diagnosticErrors" :key="index">
          {{ line }}
        </li>
      </ul>
      <p v-else>暂无错误记录。</p>
    </details>
  </section>
</template>

<style scoped>
.diagnostics {
  min-width: 0;
  display: grid;
  gap: 8px;
}
.ua,
.actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 10px;
}
.ua strong,
summary {
  font-size: 13.5px;
}
.ua code {
  flex: 1 1 100%;
  font:
    12px/1.5 ui-monospace,
    monospace;
}
code,
dd,
li,
p {
  overflow-wrap: anywhere;
}
details {
  border-top: 1px solid var(--line);
  font-size: 13px;
}
summary {
  padding: 8px 0;
  min-height: 34px;
  cursor: pointer;
  font-weight: 600;
}
dl,
ul,
p {
  margin: 4px 0 8px;
}
dl > div {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 12px;
  margin-bottom: 5px;
}
dt {
  flex: 0 1 11em;
}
dd {
  flex: 1 1 12em;
  min-width: 0;
  margin: 0;
}
dt,
small {
  color: var(--ink3);
}
ul {
  padding-inline-start: 1.5em;
}
p {
  white-space: pre-line;
}
.actions .btn,
details .btn {
  min-height: 34px;
}
</style>
