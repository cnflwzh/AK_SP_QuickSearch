<script lang="ts">
const SEEN_KEY = 'wsq.box.importGuide.seen';
let shownThisVisit = false;

function hasSeenGuide(): boolean {
  try {
    return shownThisVisit || localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return shownThisVisit;
  }
}
</script>

<script setup lang="ts">
import {onActivated, onDeactivated, onMounted, ref, watchEffect} from 'vue';
import {initialNoticeComplete} from '../../lib/ui/initialNotice.ts';
import {routeQuery} from '../../router/navigation.ts';
import SubTabs, {
  type SubTabDirection,
  type SubTabItem,
} from '../components/SubTabs.vue';

const sourceTabs: readonly SubTabItem<number>[] = [
  {id: 0, label: 'MAA'},
  {id: 1, label: '森空岛'},
  {id: 2, label: '只有干员名'},
];
const source = ref(0);
const stepDir = ref<SubTabDirection>('');
const active = ref(false);
const dialog = ref<HTMLDialogElement>();
const emit = defineEmits<{start: [method: 'file' | 'paste']}>();

/** 同一浏览器自动展示一次；用户也可从导入面板再次打开。 */
function show(): void {
  const element = dialog.value;
  if (!element?.isConnected || element.open) return;
  source.value = 0;
  stepDir.value = '';
  element.showModal();
  shownThisVisit = true;
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    // 禁用本地存储时，当前访问期间仍只自动弹出一次。
  }
}
defineExpose({show});

// 异步工具可能在 KeepAlive 首次激活后才挂载，两个入口都要标记为可见。
function activate(): void {
  active.value = true;
}
onMounted(activate);
onActivated(activate);
onDeactivated(() => {
  active.value = false;
  dialog.value?.close();
});
watchEffect(() => {
  if (active.value && initialNoticeComplete.value && !routeQuery.value.card &&
      !routeQuery.value.q && !hasSeenGuide()) show();
}, {flush: 'post'});

function start(method: 'file' | 'paste'): void {
  dialog.value?.close();
  emit('start', method);
}
</script>

<template>
  <dialog
    ref="dialog"
    class="box-import-guide"
    aria-labelledby="box-import-guide-title"
    data-noswipe>
    <header>
      <h2 id="box-import-guide-title" tabindex="-1" autofocus>怎么导入我的干员？</h2>
      <button type="button" class="btn" @click="dialog?.close()">先跳过</button>
    </header>
    <div class="guide-body">
      <SubTabs
        v-model="source"
        :items="sourceTabs"
        :level="3"
        aria-label="选择名单来源"
        attr="box-import-source"
        @change="(_, dir) => (stepDir = dir)" />
      <ol
        :key="source"
        class="subtab-panel"
        :data-dir="stepDir || undefined">
        <template v-if="source === 0">
          <li>
            <b>让 MAA 看一遍你的干员</b>
            <p>在模拟器里登录明日方舟。打开电脑上的 MAA，进入「小工具 → 干员识别」，点「开始识别」。</p>
          </li>
          <li>
            <b>把识别结果存下来</b>
            <p>识别结束后，在「导出到」选 JSON，再点「导出」。把文件存到桌面，默认文件名是 <code>Arknights_OperBox_Export.json</code>。在手机上使用时，把它发到手机即可。</p>
            <p>在同一台电脑上，也可以导出到剪贴板，回来点「粘贴数据」。</p>
          </li>
        </template>
        <template v-else-if="source === 1">
          <li>
            <b>打开一图流的「我的干员」</b>
            <p>登录一图流，点「导入干员数据」，选「森空岛扫码登录」，再点「开始导入」。如果已经看得到自己的练度，可以直接去第 3 步。</p>
            <a href="https://ark.yituliu.cn/survey/operators/" target="_blank" rel="noopener noreferrer">打开一图流 · 我的干员 ↗</a>
          </li>
          <li>
            <b>用森空岛 App 扫码</b>
            <p>可以在电脑上显示二维码，用手机扫码并确认授权。回到一图流，点你要导入的游戏昵称，等页面显示你的干员。</p>
          </li>
          <li>
            <b>下载练度表，回到这里选文件</b>
            <p>在一图流点「导出为 Excel」。下载完成后，回到这里点「选择练度文件」，从手机的「下载」或「最近使用」中选「干员练度表.xlsx」，就会看到预览。</p>
          </li>
        </template>
        <template v-else>
          <li>
            <b>把同一练度的干员写在一起</b>
            <p>例如「鸿雪、仇白」。用顿号隔开，或每行写一人。</p>
          </li>
          <li>
            <b>告诉练度箱他们练到了哪里</b>
            <p>点下方「填写干员名单」，贴上名字，在「纯名单默认状态」选这一批的练度，再点「解析预览」。不同练度可以分批导入。</p>
          </li>
        </template>
        <li>
          <b>核对人数和练度，再保存</b>
          <p><template v-if="source === 0">点「选择 JSON 文件」选刚才保存的文件，或粘贴后点「解析预览」。</template>核对预览里本赛季的人数和练度，然后点「合并导入」。同一干员会保留较高练度。</p>
        </li>
      </ol>
      <details v-if="source === 1" class="guide-alternative">
        <summary>用 iPhone 的「罗德岛助理」或已有 JSON？</summary>
        <p>在罗德岛助理登录森空岛，打开 Today 页。看到当前理智后，长按理智栏，导出森空岛原始数据，存到「文件」。</p>
        <p>回到这里点「选择练度文件」。已经有森空岛干员 JSON 或附带练度的本站设置备份，也可以直接选文件。</p>
        <a href="https://apps.apple.com/cn/app/%E7%BD%97%E5%BE%B7%E5%B2%9B%E5%8A%A9%E7%90%86/id1632810611" target="_blank" rel="noopener noreferrer">在 App Store 查看罗德岛助理 ↗</a>
      </details>
      <a
        v-if="source === 0"
        href="https://docs.maa.plus/zh-cn/manual/introduction/tools.html#干员识别"
        target="_blank"
        rel="noopener noreferrer">查看 MAA 官方操作说明 ↗</a>
    </div>
    <div class="guide-actions">
      <template v-if="source !== 2">
        <button type="button" class="btn" @click="start('paste')">
          {{ source === 1 ? '粘贴练度表' : '粘贴数据' }}
        </button>
        <button type="button" class="btn p" @click="start('file')">
          {{ source === 1 ? '选择练度文件' : '选择 JSON 文件' }}
        </button>
      </template>
      <button v-else type="button" class="btn p" @click="start('paste')">填写干员名单</button>
    </div>
  </dialog>
</template>

<style scoped>
.box-import-guide {
  box-sizing: border-box;
  width: min(30rem, calc(100% - 24px));
  max-height: calc(100dvh - 24px);
  margin: auto;
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--line2);
  border-radius: 12px;
  background: var(--surface);
  color: var(--ink);
  box-shadow: var(--shadow);
}
.box-import-guide[open] {
  animation: shin .25s ease-out;
  display: flex;
  flex-direction: column;
}
.box-import-guide::backdrop { background: rgb(9 18 20 / 56%); }
header, .guide-actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
}
header { justify-content: space-between; border-bottom: 1px solid var(--line); }
h2 { margin: 0; font-size: 18px; }
.guide-body {
  padding: 14px 16px;
  overflow-y: auto;
  overscroll-behavior: contain;
}
ol { margin: 14px 0 0; padding-inline-start: 1.5em; }
li { padding-inline-start: 3px; }
li + li { margin-top: 12px; }
li::marker { color: var(--accent); font-weight: 700; }
code { overflow-wrap: anywhere; }
p { margin: 3px 0 0; color: var(--ink2); font-size: 14px; line-height: 1.55; }
.guide-body a { display: inline-block; margin-top: 4px; color: var(--teal); font-size: 13px; }
.guide-body > a { margin-top: 12px; }
.guide-alternative { margin-top: 14px; border-top: 1px solid var(--line); }
.guide-alternative summary { padding-block: 9px; color: var(--teal); cursor: pointer; }
.guide-actions { justify-content: flex-end; border-top: 1px solid var(--line); }
.btn { min-height: 40px; }
@media (max-height: 600px) {
  .box-import-guide { max-height: calc(100dvh - 8px); }
  header, .guide-actions { padding-block: 6px; }
  .guide-body { padding-block: 8px; }
  .btn { min-height: 34px; }
}
</style>
