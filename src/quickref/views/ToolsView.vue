<script setup lang="ts">
import {computed, defineAsyncComponent, ref, watch} from 'vue';
import {NUMBER_TOOLS, type NumberTool} from '../../../data/index.ts';
import {queryText} from '../../router/location.ts';
import {routeQuery, updateQuery} from '../../router/navigation.ts';
import RunBanner from '../components/RunBanner.vue';
import SubTabs, {
  subTabPanelAttrs,
  type SubTabDirection,
  type SubTabItem,
} from '../components/SubTabs.vue';
import LayerTools from '../numbers/LayerTools.vue';
import '../numbers/numbers.css';
import '../workbench.css';
import {advisorPreviewEnabled} from '../experimentalFeatures.ts';
import {settings, type CustomizableToolId} from '../../lib/settings/index.ts';

const panels = {
  advisor: defineAsyncComponent(() => import('../advisor/RunAdvisor.vue')),
  'match-reference': LayerTools,
  glossary: defineAsyncComponent(() => import('../numbers/GlossaryTools.vue')),
  dealer: defineAsyncComponent(() => import('../numbers/DealerGame.vue')),
  excuse: defineAsyncComponent(() => import('../numbers/ExcuseTools.vue')),
  apology: defineAsyncComponent(() => import('../numbers/ApologyTools.vue')),
};
const visibleTools = computed(() => {
  const hidden = new Set(settings.hiddenTools);
  const publicTools = NUMBER_TOOLS.filter(
    (tool) =>
      tool.id !== 'advisor' && !hidden.has(tool.id as CustomizableToolId),
  );
  const fallback =
    NUMBER_TOOLS.find((tool) => tool.id === 'match-reference') ??
    NUMBER_TOOLS[1];
  const availablePublic = publicTools.length ? publicTools : [fallback];
  return advisorPreviewEnabled.value
    ? [NUMBER_TOOLS[0], ...availablePublic]
    : availablePublic;
});
const activeTool = computed<NumberTool>(() => {
  const requested = queryText(routeQuery.value, 'tool');
  return (
    visibleTools.value.find((tool) => tool.id === requested)?.id ??
    visibleTools.value[0].id
  );
});
const toolItems = computed<readonly SubTabItem<NumberTool>[]>(() =>
  visibleTools.value.map((tool) => ({id: tool.id, label: tool.label})),
);
const panelTransition = ref<'subtab-next' | 'subtab-prev' | 'number-panel'>(
  'number-panel',
);
watch(activeTool, (next, prev) => {
  const order = visibleTools.value.map((tool) => tool.id);
  const nextIndex = order.indexOf(next);
  const prevIndex = order.indexOf(prev);
  if (nextIndex >= 0 && prevIndex >= 0 && nextIndex !== prevIndex) {
    panelTransition.value =
      nextIndex > prevIndex ? 'subtab-next' : 'subtab-prev';
  } else {
    panelTransition.value = 'number-panel';
  }
});
const selectedTool = computed<NumberTool>({
  get: () => activeTool.value,
  set: (id) => {
    void updateQuery({
      tool:
        id === visibleTools.value[0]?.id && id === 'match-reference'
          ? null
          : id,
    });
  },
});
function onToolChange(_id: NumberTool, dir: SubTabDirection): void {
  if (dir === 'next') panelTransition.value = 'subtab-next';
  else if (dir === 'prev') panelTransition.value = 'subtab-prev';
}
watch(advisorPreviewEnabled, (enabled) => {
  if (!enabled && queryText(routeQuery.value, 'tool') === 'advisor')
    void updateQuery({tool: null}, true);
});
</script>

<template>
  <RunBanner v-if="activeTool === 'match-reference'" />
  <div class="numbers-tools workbench-controls">
    <!-- 工具标题沿用现有 h4 样式，由 aria-level 表达页面与卡片的标题层级。 -->
    <div class="bar numbers-subtabs">
      <SubTabs
        v-model="selectedTool"
        :items="toolItems"
        :level="2"
        panel-id="number-tool-panel"
        aria-label="小工具"
        attr="number-tool"
        @change="onToolChange" />
    </div>
    <!-- 仅工具切换产生过渡；临时输入和详情弹窗更新不重建面板。 -->
    <div v-bind="subTabPanelAttrs('number-tool-panel', activeTool)">
      <Transition :name="panelTransition" mode="out-in">
        <KeepAlive :max="7">
          <component :is="panels[activeTool]" :key="activeTool" />
        </KeepAlive>
      </Transition>
    </div>
  </div>
</template>
