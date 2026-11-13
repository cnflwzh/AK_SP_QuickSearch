<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import { NUMBER_TOOLS, type NumberTool } from '../../../data/numberTools.ts';
import { queryText } from '../../router/location.ts';
import { routeQuery, updateQuery } from '../../router/navigation.ts';
import Segmented from '../components/Segmented.vue';
import LayerTools from '../numbers/LayerTools.vue';
import ExtraRules from '../numbers/ExtraRules.vue';
import '../numbers/numbers.css';

const panels = {
  layers: LayerTools,
  recruit: defineAsyncComponent(() => import('../numbers/RecruitTools.vue')),
  bounty: defineAsyncComponent(() => import('../numbers/BountyTools.vue')),
};
const activeTool = computed(() => (queryText(routeQuery.value, 'tool') || 'layers') as NumberTool);
const toolLabels = NUMBER_TOOLS.map(tool => tool.label);
const activeIndex = computed(() => NUMBER_TOOLS.findIndex(tool => tool.id === activeTool.value));
function selectTool(index: number): void {
  const id = NUMBER_TOOLS[index]?.id;
  if (id) void updateQuery({ tool: id === 'layers' ? null : id });
}
</script>

<template>
  <div class="numbers-tools">
    <nav class="bar" aria-label="数值工具">
      <Segmented :labels="toolLabels" :active="activeIndex" attr="number-tool" @change="selectTool"/>
    </nav>
    <!-- 仅工具切换产生过渡；数字、筛选和详情 query 更新不重建面板。 -->
    <Transition name="number-panel" mode="out-in">
      <KeepAlive :max="3"><component :is="panels[activeTool]" :key="activeTool"/></KeepAlive>
    </Transition>
    <ExtraRules/>
  </div>
</template>
