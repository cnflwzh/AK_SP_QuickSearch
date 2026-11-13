<script setup lang="ts">
import { operatorWikiUrl } from '../../lib/prts.ts';
import { useWikiPanel } from '../wikiPanel.ts';

/** 干员卡片和详情共用的 Wiki 外链，name 为完整干员名称。 */
const props = defineProps<{ name: string }>();
const wikiPanel = useWikiPanel();

/** 宽屏点击或触摸进入侧栏；组合键和窄屏继续使用原生外链。 */
function openWiki(event: MouseEvent): void {
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  if (wikiPanel?.open(props.name)) {
    event.preventDefault();
  }
}
</script>

<template>
  <a
    :href="operatorWikiUrl(name)"
    class="prts-link"
    target="_blank"
    rel="noopener noreferrer"
    :aria-label="`${wikiPanel?.available.value ? '在右侧打开' : '在新标签页打开'}${name}的 PRTS Wiki`"
    :title="`${name} · PRTS Wiki（${wikiPanel?.available.value ? '右侧阅读' : '新标签页'}）`"
    :data-op="name"
    data-peek="off"
    data-prts-link
    @click.stop="openWiki"
    @auxclick.stop
  >
    PRTS
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M9 2h5v5M14 2 7 9M6 3H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-3"/></svg>
  </a>
</template>

<style scoped>
.prts-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex-shrink: 0;
  min-height: 28px;
  padding: 2px 6px;
  border-radius: 4px;
  color: var(--teal);
  font-size: 12px;
  line-height: 1.25;
  text-decoration: none;
  white-space: nowrap;
}
.prts-link svg { flex: none; }
.prts-link:hover { background: var(--teal-soft); }
.prts-link:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
@media (pointer: coarse) {
  .prts-link { min-width: 44px; min-height: 44px; }
}
</style>
