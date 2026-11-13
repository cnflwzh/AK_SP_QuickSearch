<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue';
import { operatorWikiUrl } from '../../lib/prts.ts';

const props = defineProps<{ operatorName: string }>();
const emit = defineEmits<{ close: [] }>();
// 正文解析和清理只在打开 Wiki 后加载，不进入速查首屏的依赖链。
const PrtsReader = defineAsyncComponent(() => import('./PrtsReader.vue'));
const url = computed(() => `${operatorWikiUrl(props.operatorName)}#${encodeURIComponent('特性')}`);
const heading = ref<HTMLHeadingElement | null>(null);
const toolbar = ref<HTMLElement | null>(null);
const toolbarHeight = ref(44);
let toolbarObserver: ResizeObserver | undefined;
onMounted(() => {
  heading.value?.focus({ preventScroll: true });
  const updateHeight = () => { toolbarHeight.value = Math.ceil(toolbar.value?.getBoundingClientRect().height ?? 44); };
  updateHeight();
  toolbarObserver = new ResizeObserver(updateHeight);
  if (toolbar.value) toolbarObserver.observe(toolbar.value);
});
onBeforeUnmount(() => toolbarObserver?.disconnect());
</script>

<template>
  <aside class="prts-panel" aria-labelledby="prts-panel-title" @keydown.esc.stop="emit('close')">
    <header ref="toolbar" class="prts-panel-header">
      <div class="prts-panel-heading">
        <span>PRTS Wiki</span>
        <h2 id="prts-panel-title" ref="heading" tabindex="-1" :title="operatorName">{{ operatorName }}</h2>
      </div>
      <a :href="url" target="_blank" rel="noopener noreferrer" data-prts-link :aria-label="`在新标签页打开${operatorName}的 PRTS Wiki`">独立打开 ↗</a>
      <button type="button" aria-label="关闭 PRTS 侧栏" title="关闭 PRTS 侧栏" @click="emit('close')">✕</button>
    </header>
    <div class="prts-panel-content">
      <PrtsReader :operator-name="operatorName" :top-inset="toolbarHeight + 12"/>
    </div>
  </aside>
</template>

<style scoped>
.prts-panel {
  --wiki-control-size: 32px;
  --wiki-toolbar-padding: 6px;
  --wiki-toolbar-top: max(var(--wiki-toolbar-padding), env(safe-area-inset-top));
  position: fixed;
  inset: 0 0 0 auto;
  z-index: 80;
  display: flex;
  flex-direction: column;
  width: var(--wiki-panel-width);
  height: 100dvh;
  padding-right: env(safe-area-inset-right);
  padding-bottom: var(--safe-area-bottom, 0px);
  border-left: 1px solid var(--line2);
  background: var(--surface);
  box-shadow: -8px 0 24px #00000012;
  animation: wiki-panel-in .18s ease-out;
}
.prts-panel-header {
  position: absolute;
  inset: 0 env(safe-area-inset-right) auto 0;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: var(--wiki-toolbar-top) 12px var(--wiki-toolbar-padding);
  /* 渐变在标题栏自身高度内衰减，正文需要铺在透明区域下方。 */
  background: linear-gradient(180deg, var(--surface) 0%, transparent 100%);
  pointer-events: none;
}
.prts-panel-header > * { pointer-events: auto; }
.prts-panel-heading,
.prts-panel-header a,
.prts-panel-header button {
  border: 1px solid color-mix(in srgb, var(--line) 80%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--surface) 96%, transparent);
  box-shadow: 0 2px 8px #0000000d;
}
.prts-panel-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 1 auto;
  min-width: 0;
  height: 32px;
  margin-right: auto;
  padding: 0 10px;
}
.prts-panel-heading > span { flex: none; color: var(--teal); font-size: 10px; letter-spacing: .04em; white-space: nowrap; }
.prts-panel-heading h2 { min-width: 0; margin: 0; color: var(--ink); font-size: 16px; line-height: 1.4; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.prts-panel-header a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  min-height: var(--wiki-control-size);
  padding: 0 10px;
  color: var(--teal);
  font-size: 12px;
  text-decoration: none;
  white-space: nowrap;
}
.prts-panel-header button { display: grid; place-items: center; flex: none; width: var(--wiki-control-size); height: var(--wiki-control-size); padding: 0; color: var(--ink2); cursor: pointer; }
.prts-panel-header :is(a, button):hover { border-color: var(--line2); background: var(--surface2); }
.prts-panel-header button:hover { color: var(--ink); }
.prts-panel-header :is(a, button, h2):focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
.prts-panel-content {
  position: relative;
  flex: 1;
  min-height: 0;
  /* 正文铺在渐变下方；章节留白由阅读器内部滚动定位处理。 */
}
@keyframes wiki-panel-in { from { opacity: 0; transform: translateX(16px); } to { opacity: 1; transform: translateX(0); } }
@media (pointer: coarse) {
  .prts-panel { --wiki-control-size: 44px; --wiki-toolbar-padding: 4px; }
  .prts-panel-header { gap: 6px; padding-inline: 10px; }
  .prts-panel-header a { padding-inline: 8px; }
}
@media (prefers-reduced-motion: reduce) { .prts-panel { animation: none; } }
</style>
