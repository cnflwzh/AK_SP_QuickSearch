<script setup lang="ts">
import {computed} from 'vue';
import {round1} from '../lib/ui/dom.ts';
import type {CovenantCurveSeries} from './infographic.ts';
import SelectInput, {
  type SelectOption,
} from '../quickref/components/SelectInput.vue';
import type {LineChartDataset} from './LineChart.vue';
import {lazyView} from '../lib/ui/lazyView.ts';

const LineChart = lazyView(() => import('./LineChart.vue'));
const props = defineProps<{
  curves: readonly CovenantCurveSeries[];
  fromLabel: string;
  toLabel: string;
}>();
const activeCurveName = defineModel<string>({required: true});
const emit = defineEmits<{inspect: [name: string]}>();

const curveSelectOptions = computed<readonly SelectOption<string>[]>(() =>
  props.curves.map((c) => {
    const deltaTag =
      c.deltaAt100 === 0
        ? '100层持平'
        : `100层 ${c.deltaAt100 > 0 ? '+' : ''}${c.deltaAt100}${c.unit}`;
    return {
      value: c.name,
      label: `${c.name} · ${c.metricLabel}（${deltaTag}）`,
    };
  }),
);

const activeCurveIndex = computed(() => {
  const idx = props.curves.findIndex((c) => c.name === activeCurveName.value);
  return idx >= 0 ? idx : 0;
});

const activeCurve = computed<CovenantCurveSeries | undefined>(
  () => props.curves[activeCurveIndex.value],
);

function stepCurve(delta: -1 | 1): void {
  const list = props.curves;
  if (list.length <= 1) return;
  const nextIdx = (activeCurveIndex.value + delta + list.length) % list.length;
  activeCurveName.value = list[nextIdx].name;
}

const activeCurveDatasets = computed<readonly LineChartDataset[]>(() => {
  const c = activeCurve.value;
  if (!c) return [];
  return [
    {
      label: `${props.fromLabel}（原来）`,
      data: c.beforeValues,
      color: 'var(--ink3)',
      dashed: true,
    },
    {
      label: `${props.toLabel}（更新后）`,
      data: c.afterValues,
      color: c.color,
      fillToIndex: 0,
    },
  ];
});

const curveSnapshots = computed(() => {
  const c = activeCurve.value;
  if (!c) return [];
  return [0, 100, 200].map((layer) => {
    const idx = Math.round(layer / 10);
    const before = c.beforeValues[idx] ?? 0;
    const after = c.afterValues[idx] ?? 0;
    const delta = round1(after - before);
    return {layer, before, after, delta};
  });
});

const curveMilestoneNotes = computed<readonly string[]>(() => {
  const c = activeCurve.value;
  if (!c) return [];
  const notes: string[] = [];
  if (c.beforeCycleEvery !== c.afterCycleEvery) {
    const cycle = (every: number | null) =>
      every === null ? '无' : `每 ${every} 层`;
    notes.push(
      `循环奖励周期：${cycle(c.beforeCycleEvery)} → ${cycle(c.afterCycleEvery)}`,
    );
  }
  if (
    c.beforeBreakpoints.join(',') !== c.afterBreakpoints.join(',') &&
    (c.beforeBreakpoints.length || c.afterBreakpoints.length)
  ) {
    notes.push(
      `层数门槛：${c.beforeBreakpoints.join('/') || '无'} 层 → ${c.afterBreakpoints.join('/') || '无'} 层`,
    );
  }
  return notes;
});
</script>

<template>
  <div v-if="activeCurve" class="ig-curve-box">
    <div class="ig-curve-head">
      <SelectInput
        v-model="activeCurveName"
        class="ig-curve-select"
        :options="curveSelectOptions"
        aria-label="选择盟约查看叠层折线对比" />

      <div
        v-if="curves.length > 1"
        class="ig-curve-pager"
        role="group"
        aria-label="切换上下一条盟约曲线">
        <button
          type="button"
          class="ig-pager-btn"
          aria-label="上一盟约曲线"
          @click="stepCurve(-1)">
          ‹
        </button>
        <span class="ig-pager-idx">
          {{ activeCurveIndex + 1 }}/{{ curves.length }}
        </span>
        <button
          type="button"
          class="ig-pager-btn"
          aria-label="下一盟约曲线"
          @click="stepCurve(1)">
          ›
        </button>
      </div>

      <button
        type="button"
        class="ig-more-link"
        @click="emit('inspect', activeCurve.name)">
        词条 ▸
      </button>
    </div>

    <!-- 关键层数节点快照 -->
    <div class="ig-snap-strip">
      <div
        v-for="snap in curveSnapshots"
        :key="snap.layer"
        class="ig-snap-pill">
        <span class="ig-snap-lv">{{ snap.layer }}层</span>
        <span class="ig-snap-val">
          <em>{{ snap.before }}</em>
          →
          <b>{{ snap.after }}{{ activeCurve.unit }}</b>
        </span>
        <span
          v-if="snap.delta !== 0"
          :class="['ig-delta-chip', snap.delta > 0 ? 'up' : 'down']">
          {{ snap.delta > 0 ? '+' : '' }}{{ snap.delta }}{{ activeCurve.unit }}
        </span>
      </div>
    </div>

    <div v-if="curveMilestoneNotes.length" class="ig-ms-notes">
      <span v-for="note in curveMilestoneNotes" :key="note" class="ig-ms-tag">
        {{ note }}
      </span>
    </div>

    <LineChart
      :labels="activeCurve.layers"
      :datasets="activeCurveDatasets"
      x-suffix="层"
      :y-suffix="activeCurve.unit"
      :aria-label="`${activeCurve.name} 0至200层${activeCurve.metricLabel}更新前后折线对比图`" />
  </div>
</template>

<style scoped>
.ig-curve-box {
  padding: 10px 12px;
  border-radius: 9px;
  border: 1px solid var(--line);
  background: var(--surface2);
  display: grid;
  gap: 8px;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

.ig-curve-head {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  max-width: 100%;
}

.ig-curve-select {
  flex: 1 1 160px;
  min-width: 0;
}

.ig-curve-pager {
  flex: none;
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--line2);
  border-radius: 7px;
  background: var(--surface);
  overflow: hidden;
}

.ig-pager-btn {
  min-width: 30px;
  min-height: 34px;
  padding: 0 6px;
  border: 0;
  background: transparent;
  color: var(--ink2);
  font-family: var(--fn);
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}
.ig-pager-btn:hover {
  color: var(--accent);
  background: var(--accent-soft);
}

.ig-pager-idx {
  padding: 0 5px;
  font-family: var(--fn);
  font-size: 11.5px;
  color: var(--ink3);
  white-space: nowrap;
}

@container diff-view (max-width: 460px) {
  .ig-curve-head {
    flex-wrap: wrap;
  }
  .ig-curve-select {
    flex-basis: 100%;
  }
}

.ig-snap-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  min-width: 0;
}

@container diff-view (max-width: 440px) {
  .ig-snap-strip {
    grid-template-columns: minmax(0, 1fr);
  }
}

.ig-snap-pill {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 6px;
  background: var(--surface);
  border: 1px solid var(--line);
  font-family: var(--fn);
  font-size: 12px;
  min-width: 0;
}
.ig-snap-lv {
  color: var(--ink3);
  font-weight: 600;
}
.ig-snap-val em {
  font-style: normal;
  color: var(--ink3);
}

.ig-ms-notes {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.ig-ms-tag {
  font-size: 11.5px;
  padding: 2px 8px;
  border-radius: 5px;
  background: var(--accent-soft);
  border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
  color: var(--ink);
}
</style>
