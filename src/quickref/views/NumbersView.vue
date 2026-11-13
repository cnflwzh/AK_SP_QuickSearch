<script setup lang="ts">
import { computed, defineAsyncComponent, watch } from 'vue';
import { NUMBER_TOOLS, type NumberTool } from '../../../data/numberTools.ts';
import { queryText } from '../../router/location.ts';
import { routeQuery, updateQuery } from '../../router/navigation.ts';
import Segmented from '../components/Segmented.vue';
import LayerTools from '../numbers/LayerTools.vue';
import ExtraRules from '../numbers/ExtraRules.vue';
import '../numbers/numbers.css';
import '../workbench.css';
import { advisorPreviewEnabled } from '../experimentalFeatures.ts';

const panels = {
  advisor: defineAsyncComponent(() => import('../advisor/RunAdvisor.vue')),
  layers: LayerTools,
  recruit: defineAsyncComponent(() => import('../numbers/RecruitTools.vue')),
  bounty: defineAsyncComponent(() => import('../numbers/BountyTools.vue')),
};
const visibleTools = computed(() => NUMBER_TOOLS.filter(tool => tool.id !== 'advisor' || advisorPreviewEnabled.value));
const activeTool = computed<NumberTool>(() => {
  const requested = queryText(routeQuery.value, 'tool');
  return visibleTools.value.find(tool => tool.id === requested)?.id ?? 'layers';
});
const toolLabels = computed(() => visibleTools.value.map(tool => tool.label));
const activeIndex = computed(() => visibleTools.value.findIndex(tool => tool.id === activeTool.value));
watch(advisorPreviewEnabled, enabled => {
  if (!enabled && queryText(routeQuery.value, 'tool') === 'advisor') void updateQuery({ tool: null }, true);
});
function selectTool(index: number): void {
  const id = visibleTools.value[index]?.id;
  if (id) void updateQuery({ tool: id === 'layers' ? null : id });
}
</script>

<template>
  <div class="numbers-tools workbench-controls">
    <!-- 工具标题沿用现有 h4 样式，由 aria-level 表达页面与卡片的标题层级。 -->
    <nav class="bar" aria-label="小工具">
      <Segmented :labels="toolLabels" :active="activeIndex" attr="number-tool" @change="selectTool"/>
    </nav>
    <!-- 仅工具切换产生过渡；临时输入和详情弹窗更新不重建面板。 -->
    <Transition name="number-panel" mode="out-in">
      <KeepAlive :max="4"><component :is="panels[activeTool]" :key="activeTool"/></KeepAlive>
    </Transition>
    <ExtraRules v-if="activeTool !== 'advisor'"/>
  </div>
</template>
