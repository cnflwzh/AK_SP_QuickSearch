<script setup lang="ts">
import {computed, defineAsyncComponent, watch} from 'vue';
import {NUMBER_TOOLS, type NumberTool} from '../../../data/index.ts';
import {queryText} from '../../router/location.ts';
import {routeQuery, updateQuery} from '../../router/navigation.ts';
import RunBanner from '../components/RunBanner.vue';
import Segmented from '../components/Segmented.vue';
import LayerTools from '../numbers/LayerTools.vue';
import ExtraRules from '../numbers/ExtraRules.vue';
import '../numbers/numbers.css';
import '../workbench.css';
import {advisorPreviewEnabled} from '../experimentalFeatures.ts';
import {settings, type CustomizableToolId} from '../../lib/settings/index.ts';

const panels = {
  advisor: defineAsyncComponent(() => import('../advisor/RunAdvisor.vue')),
  layers: LayerTools,
  recruit: defineAsyncComponent(() => import('../numbers/RecruitTools.vue')),
  bounty: defineAsyncComponent(() => import('../numbers/BountyTools.vue')),
  dealer: defineAsyncComponent(() => import('../numbers/DealerGame.vue')),
  excuse: defineAsyncComponent(() => import('../numbers/ExcuseTools.vue')),
};
const visibleTools = computed(() => {
  const hidden = new Set(settings.hiddenTools);
  const publicTools = NUMBER_TOOLS.filter(
    (tool) =>
      tool.id !== 'advisor' && !hidden.has(tool.id as CustomizableToolId),
  );
  const fallback =
    NUMBER_TOOLS.find((tool) => tool.id === 'layers') ?? NUMBER_TOOLS[1];
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
const toolLabels = computed(() => visibleTools.value.map((tool) => tool.label));
const activeIndex = computed(() =>
  visibleTools.value.findIndex((tool) => tool.id === activeTool.value),
);
watch(advisorPreviewEnabled, (enabled) => {
  if (!enabled && queryText(routeQuery.value, 'tool') === 'advisor')
    void updateQuery({tool: null}, true);
});
function selectTool(index: number): void {
  const id = visibleTools.value[index]?.id;
  if (id)
    void updateQuery({
      tool: id === visibleTools.value[0]?.id && id === 'layers' ? null : id,
    });
}
</script>

<template>
  <RunBanner
    v-if="
      activeTool !== 'advisor' &&
      activeTool !== 'dealer' &&
      activeTool !== 'excuse'
    " />
  <div class="numbers-tools workbench-controls">
    <!-- 工具标题沿用现有 h4 样式，由 aria-level 表达页面与卡片的标题层级。 -->
    <nav class="bar" aria-label="小工具">
      <Segmented
        :labels="toolLabels"
        :active="activeIndex"
        attr="number-tool"
        @change="selectTool" />
    </nav>
    <!-- 仅工具切换产生过渡；临时输入和详情弹窗更新不重建面板。 -->
    <Transition name="number-panel" mode="out-in">
      <KeepAlive :max="6">
        <component :is="panels[activeTool]" :key="activeTool" />
      </KeepAlive>
    </Transition>
    <ExtraRules
      v-if="
        activeTool !== 'advisor' &&
        activeTool !== 'dealer' &&
        activeTool !== 'excuse'
      " />
  </div>
</template>
