<script setup lang="ts">
import { computed, nextTick, ref, toRefs } from 'vue';
import { ADDON_COVENANTS, CORE_COVENANTS, COVENANTS } from '../../../data/covenants.ts';
import { COMMON_LAYER_COVENANTS, CYCLE_REWARDS, HEADCOUNT_BREAKPOINTS, LAYER_BREAKPOINTS } from '../../../data/numberTools.ts';
import { color } from '../format.ts';
import LayerCalculator from './LayerCalculator.vue';
import { useNumberToolsState, type LayerSection } from './useNumberToolsState.ts';

const root = ref<HTMLElement>();
const layerState = useNumberToolsState().layers;
const { covenant: selected, section: selectedSection } = toRefs(layerState);
const detailOrder = computed(() => selectedSection.value === 'cycle' ? 3 : selectedSection.value === 'headcount' ? 5 : 1);
const groups = [{ label: '核心盟约', names: CORE_COVENANTS }, { label: '附加盟约', names: ADDON_COVENANTS }];
function isSelected(name: string, section: LayerSection): boolean {
  return selected.value === name && selectedSection.value === section;
}
/** 宽屏只更新常驻右栏；窄屏把同一个结果卡排在当前分组后，必要时滚动到结果。 */
async function select(name: string, section: LayerSection = 'threshold'): Promise<void> {
  selected.value = name;
  selectedSection.value = section;
  await nextTick();
  const result = root.value?.querySelector<HTMLElement>('.nt-layer-detail');
  if (!result) return;
  if (getComputedStyle(result).position === 'sticky') return;
  const top = result.getBoundingClientRect().top;
  const visibleTop = (document.getElementById('qbar')?.getBoundingClientRect().height ?? 0) + 12;
  if (top < visibleTop || top + 120 > window.innerHeight) {
    window.scrollBy({ top: top - visibleTop, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }
}
</script>

<template>
  <div ref="root" class="nt-layers">
    <div class="bar nt-toolbar">
      <h4 class="nt-section-title" aria-level="2">层数与强化</h4>
      <select :value="selected" aria-label="选择盟约计算" @change="select(($event.target as HTMLSelectElement).value)">
        <optgroup v-for="group in groups" :key="group.label" :label="group.label">
          <option v-for="name in group.names" :key="name" :value="name">{{ name }}</option>
        </optgroup>
      </select>
    </div>

    <div class="nt-layer-layout">
      <section class="nc nt-threshold-list" aria-label="层数门槛速查">
        <div class="nt-threshold-heading"><span>盟约</span><span>层数</span><span>关键变化</span></div>
        <button v-for="name in COMMON_LAYER_COVENANTS" :key="name" type="button" class="nt-threshold-row" :class="{ selected: isSelected(name, 'threshold') }"
          :style="{ '--c': color(name) }" :aria-pressed="isSelected(name, 'threshold')" aria-controls="numbers-layer-calculator" @click="select(name)">
          <span class="nt-covenant-name"><b>{{ name }}</b><small>{{ COVENANTS[name].need }} 名</small></span>
          <span class="nt-threshold-number">{{ LAYER_BREAKPOINTS[name].map(point => point.layers).join(' / ') }}</span>
          <span class="nt-threshold-effect">{{ LAYER_BREAKPOINTS[name].map(point => point.effect).join('；') }}<i>›</i></span>
        </button>
      </section>

      <section class="nc nt-cycle-list" aria-label="循环奖励">
        <h4 aria-level="3">循环奖励</h4>
        <button v-for="(cycle, name) in CYCLE_REWARDS" :key="name" type="button" class="nt-reference-row" :class="{ selected: isSelected(name, 'cycle') }"
          :aria-pressed="isSelected(name, 'cycle')" aria-controls="numbers-layer-calculator" @click="select(name, 'cycle')">
          <b :style="{ color: color(name) }">{{ name }}</b><span class="tag">每 {{ cycle.every }} 层</span><span>{{ cycle.reward }}</span><i>›</i>
        </button>
      </section>

      <section class="nc nt-headcount-list" aria-label="人数强化">
        <header class="nt-heading"><h4 aria-level="3">人数强化</h4><small class="nt-muted">核心 6 名 · 附加 3 名 · 绝技 5 名精锐</small></header>
        <p class="nt-muted">核心盟约：6 名不同干员触发强化</p>
        <button v-for="item in HEADCOUNT_BREAKPOINTS" :key="item.covenant" type="button" class="nt-reference-row" :class="{ selected: isSelected(item.covenant, 'headcount') }"
          :aria-pressed="isSelected(item.covenant, 'headcount')" aria-controls="numbers-layer-calculator" @click="select(item.covenant, 'headcount')">
          <b>{{ item.covenant }}</b><span class="tag">{{ item.condition }}</span><span>{{ item.effect }}</span><i>›</i>
        </button>
      </section>

      <div id="numbers-layer-calculator" class="nt-layer-detail" :style="{ '--detail-order': detailOrder }">
        <LayerCalculator v-model:layers="layerState.count" :name="selected"/>
      </div>
    </div>
  </div>
</template>
