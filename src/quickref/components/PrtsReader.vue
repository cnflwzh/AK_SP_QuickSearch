<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { createPrtsReaderDocument, fetchPrtsArticle } from '../../lib/prtsArticle.ts';
import readerStyles from '../wikiReader.css?raw';

const props = defineProps<{
  operatorName: string;
  /** 标题栏实测高度加阅读间距，单位为 CSS 像素。 */
  topInset: number;
}>();
const frame = ref<HTMLIFrameElement | null>(null);
const sourceDocument = ref('');
const state = ref<'loading' | 'ready' | 'error'>('loading');
const attempt = ref(0);
let request: AbortController | undefined;
let frameEvents: AbortController | undefined;
let layoutFrame = 0;
let pinnedSection: string | null = '特性';

/** 旋转或展开折叠屏后保持刚选中的章节；用户主动阅读滚动后不再纠正位置。 */
function alignPinnedSection(): void {
  if (state.value !== 'ready' || !pinnedSection) return;
  cancelAnimationFrame(layoutFrame);
  layoutFrame = requestAnimationFrame(() => {
    const document = frame.value?.contentDocument;
    if (document && pinnedSection) scrollToSection(document, pinnedSection);
  });
}
const frameObserver = new ResizeObserver(alignPinnedSection);
watch(frame, element => {
  frameObserver.disconnect();
  if (element) frameObserver.observe(element);
});

/** 根据正文内的章节 ID 定位；只调整内部滚动，不移动 iframe 或渐变栏。 */
function scrollToSection(document: Document, fragment: string): boolean {
  let id = fragment;
  try { id = decodeURIComponent(fragment); } catch { /* 保留原始 ID 作为后备。 */ }
  const target = document.getElementById(id);
  const scroll = document.scrollingElement;
  if (!target || !scroll) return false;
  pinnedSection = id;
  const top = target.getBoundingClientRect().top + scroll.scrollTop - props.topInset;
  document.defaultView?.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
  return true;
}

function toggleTooltip(element: Element): void {
  const tooltip = element.closest<HTMLElement>('[data-reader-tooltip]');
  const content = tooltip?.querySelector('[data-reader-tip]');
  if (!tooltip || !content) return;
  const open = tooltip.getAttribute('aria-expanded') !== 'true';
  tooltip.setAttribute('aria-expanded', String(open));
  content.toggleAttribute('data-open', open);
}

function onDocumentClick(event: MouseEvent): void {
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
  const element = event.target as Element | null;
  if (!element || element.nodeType !== 1) return;
  const anchor = element.closest<HTMLAnchorElement>('a[data-reader-anchor]');
  if (anchor && scrollToSection(element.ownerDocument, anchor.dataset.readerAnchor!)) {
    event.preventDefault();
    return;
  }
  if (!element.closest('a')) toggleTooltip(element);
}

function onDocumentChange(event: Event): void {
  const input = event.target as HTMLInputElement | null;
  const group = input?.dataset?.readerToggle;
  if (!input || input.localName !== 'input' || !group) return;
  const document = input.ownerDocument;
  for (const copy of document.querySelectorAll<HTMLInputElement>('input[data-reader-toggle]')) {
    if (copy.dataset.readerToggle === group) copy.checked = input.checked;
  }
  for (const index of [1, 2]) {
    for (const element of document.getElementsByClassName(`${group}_${index}`)) {
      (element as HTMLElement).style.display = (index === 2) === input.checked ? 'inline' : 'none';
    }
  }
}

function onFrameLoaded(): void {
  const document = frame.value?.contentDocument;
  if (!sourceDocument.value || document?.documentElement.dataset.prtsArticle !== props.operatorName
    || !document.getElementById('mw-content-text')) return;
  frameEvents?.abort();
  frameEvents = new AbortController();
  const options = { signal: frameEvents.signal };
  document.documentElement.style.setProperty('--reader-top', `${props.topInset}px`);
  document.addEventListener('click', onDocumentClick, options);
  document.addEventListener('change', onDocumentChange, options);
  const releaseAnchor = () => { pinnedSection = null; };
  document.addEventListener('wheel', releaseAnchor, { ...options, passive: true });
  document.addEventListener('touchstart', releaseAnchor, { ...options, passive: true });
  document.addEventListener('pointerdown', releaseAnchor, options);
  document.addEventListener('keydown', event => {
    if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) releaseAnchor();
    const element = event.target as Element | null;
    if ((event.key === 'Enter' || event.key === ' ') && element?.matches('[data-reader-tooltip]')) {
      event.preventDefault();
      toggleTooltip(element);
    }
  }, options);
  document.fonts.addEventListener('loadingdone', alignPinnedSection, options);
  // 宽表仅在自己的容器内横向滚动，不撑开整页；逐个包裹不会重建表内节点。
  for (const table of document.querySelectorAll<HTMLTableElement>('.mw-parser-output > table')) {
    const wrapper = document.createElement('div');
    wrapper.className = 'reader-table-scroll';
    table.replaceWith(wrapper);
    wrapper.append(table);
  }
  cancelAnimationFrame(layoutFrame);
  layoutFrame = requestAnimationFrame(() => {
    scrollToSection(document, '特性');
    state.value = 'ready';
  });
}

watch([() => props.operatorName, attempt], async ([name], _, onCleanup) => {
  const controller = new AbortController();
  request = controller;
  onCleanup(() => controller.abort());
  frameEvents?.abort();
  cancelAnimationFrame(layoutFrame);
  sourceDocument.value = '';
  state.value = 'loading';
  pinnedSection = '特性';
  try {
    const article = await fetchPrtsArticle(name, controller.signal);
    controller.signal.throwIfAborted();
    sourceDocument.value = createPrtsReaderDocument(article, readerStyles, props.topInset);
  } catch {
    if (!controller.signal.aborted) state.value = 'error';
  }
}, { immediate: true });

watch(() => props.topInset, async inset => {
  await nextTick();
  const document = frame.value?.contentDocument;
  if (!document) return;
  document.documentElement.style.setProperty('--reader-top', `${inset}px`);
  alignPinnedSection();
});

onBeforeUnmount(() => {
  request?.abort();
  frameEvents?.abort();
  frameObserver.disconnect();
  cancelAnimationFrame(layoutFrame);
});
</script>

<template>
  <div class="prts-reader" :style="{ '--reader-inset': `${topInset}px` }" :aria-busy="state === 'loading'">
    <div v-if="state === 'loading'" class="reader-status" role="status">正在加载 PRTS…</div>
    <div v-else-if="state === 'error'" class="reader-status" role="alert">
      <span>正文加载失败</span><button type="button" @click="attempt++">重试</button>
    </div>
    <!-- 仅本站父页面管理正文定位；隔离文档不允许运行 PRTS 或正文内的脚本。 -->
    <iframe
      v-if="sourceDocument"
      ref="frame"
      :srcdoc="sourceDocument"
      :title="`${operatorName} · PRTS Wiki 正文`"
      :class="{ ready: state === 'ready' }"
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      referrerpolicy="strict-origin-when-cross-origin"
      @load="onFrameLoaded"
    ></iframe>
  </div>
</template>

<style scoped>
.prts-reader { position: relative; height: 100%; min-height: 0; background: #fff; }
.prts-reader iframe { display: block; width: 100%; height: 100%; border: 0; opacity: 0; pointer-events: none; }
.prts-reader iframe.ready { opacity: 1; pointer-events: auto; }
.reader-status { position: absolute; z-index: 1; top: var(--reader-inset); left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 10px; white-space: nowrap; padding: 8px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); color: var(--ink2); font-size: 13px; }
.reader-status button { border: 1px solid var(--line); border-radius: 5px; padding: 3px 8px; background: var(--surface2); color: var(--teal); cursor: pointer; }
</style>
