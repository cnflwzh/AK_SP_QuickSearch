<script setup lang="ts">
import {computed} from 'vue';
import {
  CORE_COVENANTS,
  COVENANTS,
  LAYER_BREAKPOINTS,
  LAYER_INPUT_LIMIT,
  SCALING_CONDITIONS,
} from '../../../data/index.ts';
import {
  nextCycleReward,
  nextLayerBreakpoint,
} from '../../lib/numbers/numberTools.ts';
import {round1} from '../../lib/ui/dom.ts';
import {covenantId} from '../../router/entities.ts';
import {covenantLocation} from '../../router/navigation.ts';
import {color, fx} from '../format.ts';
import CovenantIcon from '../components/CovenantIcon.vue';
import NumberInput from './NumberInput.vue';

const props = defineProps<{name: string}>();
const covenant = computed(() => COVENANTS[props.name]);
const layers = defineModel<number>('layers', {required: true});
const breakpoints = computed(() => LAYER_BREAKPOINTS[props.name] ?? []);
const next = computed(() => nextLayerBreakpoint(props.name, layers.value));
const cycle = computed(() => nextCycleReward(props.name, layers.value));
const isCore = computed(() => CORE_COVENANTS.includes(props.name));
const countCondition = computed(() => {
  const mechanics = covenant.value.mechanics;
  if (mechanics?.countMode === 'fieldElites') {
    return `${covenant.value.need} 名精锐激活`;
  }
  if (mechanics?.maxCount === 1) {
    return `场上恰好 1 名${props.name}`;
  }
  return `${covenant.value.need} 名激活${mechanics?.countsReserve ? ' · 含整备区' : ''}`;
});
const previewLayers = computed(
  () => covenant.value.mechanics?.rangePreviewLayers,
);
const quickLayers = computed(() =>
  [
    ...new Set([
      0,
      ...breakpoints.value.map((item) => item.layers),
      100,
      200,
      300,
      LAYER_INPUT_LIMIT,
    ]),
  ].sort((a, b) => a - b),
);
const cells = Array.from({length: 9}, (_, index) => index);
const rangeAffected = (index: number, expanded: boolean) =>
  index !== 4 && (expanded || [1, 3, 5, 7].includes(index));
function setLayers(value: number | null): void {
  if (value !== null) layers.value = value;
}
</script>

<template>
  <section
    class="qcalc ncalc nt-calculator"
    :style="{'--c': color(name)}"
    :aria-label="`${name}层数计算`">
    <header class="nt-heading">
      <div class="nt-calc-title">
        <CovenantIcon :name="name" emblem />
        <div>
          <h4 aria-level="3">{{ name }}</h4>
          <span class="nt-muted">{{ countCondition }}</span>
        </div>
      </div>
    </header>

    <template v-if="covenant.scaling.length">
      <div class="nt-layer-input">
        <label class="layer-value">
          当前层数
          <NumberInput
            class="lv"
            :value="layers"
            :max="LAYER_INPUT_LIMIT"
            label="当前盟约层数"
            @change="setLayers" />
        </label>
        <span v-if="next" class="nt-gap">
          还差
          <b>{{ next.layers - layers }}</b>
          层
        </span>
        <span v-else-if="breakpoints.length" class="nt-achieved">
          层数门槛已达成
        </span>
      </div>
      <input
        type="range"
        min="0"
        :max="LAYER_INPUT_LIMIT"
        step="1"
        :value="layers"
        aria-label="拖动调整盟约层数"
        :aria-valuetext="`${layers} 层`"
        @input="setLayers(($event.target as HTMLInputElement).valueAsNumber)" />
      <div class="q" aria-label="快捷层数">
        <button
          v-for="value in quickLayers"
          :key="value"
          type="button"
          :class="{on: layers === value}"
          :aria-pressed="layers === value"
          @click="setLayers(value)">
          {{ value }}
        </button>
      </div>

      <div class="vals nt-values">
        <div
          v-for="(scaling, index) in covenant.scaling"
          :key="scaling.label"
          class="nt-value">
          <span>{{ scaling.label }}</span>
          <b>
            {{ round1(scaling.at(layers)) }}
            <small>{{ scaling.unit }}</small>
          </b>
          <small v-if="next">
            {{ next.layers }} 层 → {{ round1(scaling.at(next.layers))
            }}{{ scaling.unit }}
          </small>
          <small v-if="SCALING_CONDITIONS[name]?.[index]" class="nt-condition">
            {{ SCALING_CONDITIONS[name][index] }}
          </small>
        </div>
      </div>

      <div v-if="breakpoints.length" class="nt-milestones">
        <div
          v-for="point in breakpoints"
          :key="point.layers"
          :class="{reached: layers >= point.layers}">
          <span class="nt-point">
            {{ point.layers }}
            <small>层</small>
          </span>
          <span>{{ point.effect }}</span>
          <small>
            {{
              layers >= point.layers ? '已达成' : `差 ${point.layers - layers}`
            }}
          </small>
        </div>
      </div>
      <div v-if="cycle" class="nt-cycle">
        <span>每 {{ cycle.every }} 层 · {{ cycle.reward }}</span>
        <b>
          下一档 {{ cycle.target }} 层
          <small>还差 {{ cycle.remaining }}</small>
        </b>
      </div>

      <div v-if="previewLayers !== undefined" class="nt-ranges">
        <figure v-for="preview in [false, true]" :key="String(preview)">
          <div
            class="nt-range-grid"
            :aria-label="
              preview || layers >= previewLayers ? '周围八格' : '周围四格'
            "
            role="img">
            <span
              v-for="cell in cells"
              :key="cell"
              :class="{
                center: cell === 4,
                affected: rangeAffected(
                  cell,
                  preview || layers >= previewLayers,
                ),
              }">
              {{ cell === 4 ? '◆' : '' }}
            </span>
          </div>
          <figcaption>
            {{
              preview
                ? `${previewLayers} 层起 · 周围 8 格`
                : `当前 · 周围 ${layers >= previewLayers ? 8 : 4} 格`
            }}
          </figcaption>
        </figure>
      </div>
    </template>

    <p
      v-if="!covenant.scaling.length"
      class="nt-effect"
      v-html="fx(covenant.effect)"></p>
    <p v-if="covenant.bonus && !breakpoints.length" class="nt-condition-block">
      <span class="tag">{{ isCore ? '6 名不同干员' : '人数强化' }}</span>
      <span v-html="fx(covenant.bonus)"></span>
    </p>
    <details v-if="covenant.scaling.length" class="nt-inline-details">
      <summary>作用条件与公式</summary>
      <p v-html="fx(covenant.effect)"></p>
    </details>
    <footer class="nt-links">
      <RouterLink :to="covenantLocation(name)">盟约详情 ↗</RouterLink>
      <RouterLink
        :to="{
          path: '/operators',
          query: {covenant: covenantId(name), type: 'stacking'},
        }">
        查叠层干员 ↗
      </RouterLink>
    </footer>
  </section>
</template>
