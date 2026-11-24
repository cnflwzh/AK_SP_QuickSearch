<script lang="ts">
export interface LineChartDataset {
  readonly label: string;
  readonly data: readonly number[];
  /** CSS 颜色字符串（如 #d65645）；支持传主题变量名由组件解析。 */
  readonly color: string;
  readonly dashed?: boolean;
  /** 填充到目标数据集下标（例如将更新后曲线填充至更新前曲线以突显差值面积）。 */
  readonly fillToIndex?: number;
  readonly fillAboveColor?: string;
  readonly fillBelowColor?: string;
}
</script>

<script setup lang="ts">
import {
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  type ChartConfiguration,
  type TooltipItem,
} from 'chart.js';
import {
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  useAttrs,
  watch,
  type StyleValue,
} from 'vue';
import {prefersReducedMotion, round1} from '../lib/ui/dom.ts';

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
  Legend,
);

defineOptions({inheritAttrs: false});

const props = withDefaults(
  defineProps<{
    labels: readonly (string | number)[];
    datasets: readonly LineChartDataset[];
    xSuffix?: string;
    ySuffix?: string;
    label?: string;
    height?: number;
  }>(),
  {
    xSuffix: '',
    ySuffix: '',
    height: 224,
  },
);

const attrs = useAttrs();
const canvasRef = ref<HTMLCanvasElement | null>(null);
const chartInstance = shallowRef<Chart<'line'> | null>(null);

function resolveCssColor(input: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const trimmed = input.trim();
  const varMatch = trimmed.match(/^var\((--[^,)]+)/);
  if (!varMatch) return trimmed || fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(varMatch[1])
    .trim();
  return value || fallback;
}

function readThemePalette() {
  if (typeof document === 'undefined') {
    return {
      ink: '#122220',
      ink2: '#465a57',
      ink3: '#7a8b88',
      grid: 'rgba(18, 34, 32, 0.09)',
      surface: '#ffffff',
      border: '#b5c4c1',
      greenFill: 'rgba(45, 138, 75, 0.18)',
      redFill: 'rgba(193, 61, 54, 0.18)',
    };
  }
  const styles = getComputedStyle(document.documentElement);
  const dark =
    document.documentElement.dataset.theme === 'dark' ||
    (document.documentElement.dataset.theme !== 'light' &&
      window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  return {
    ink: styles.getPropertyValue('--ink').trim() || '#122220',
    ink2: styles.getPropertyValue('--ink2').trim() || '#465a57',
    ink3: styles.getPropertyValue('--ink3').trim() || '#7a8b88',
    grid: dark ? 'rgba(225, 234, 232, 0.09)' : 'rgba(18, 34, 32, 0.08)',
    surface: styles.getPropertyValue('--surface').trim() || '#ffffff',
    border: styles.getPropertyValue('--line2').trim() || '#b5c4c1',
    greenFill: dark ? 'rgba(95, 194, 127, 0.22)' : 'rgba(45, 138, 75, 0.16)',
    redFill: dark ? 'rgba(239, 107, 96, 0.22)' : 'rgba(193, 61, 54, 0.16)',
  };
}

function buildConfig(): ChartConfiguration<'line'> {
  const palette = readThemePalette();
  const reduced = prefersReducedMotion();

  return {
    type: 'line',
    data: {
      labels: props.labels.map((item) => `${item}${props.xSuffix}`),
      datasets: props.datasets.map((ds) => {
        const resolvedColor = resolveCssColor(ds.color, palette.ink2);
        return {
          label: ds.label,
          data: [...ds.data],
          borderColor: resolvedColor,
          backgroundColor: resolvedColor,
          borderWidth: ds.dashed ? 2 : 2.6,
          borderDash: ds.dashed ? [6, 4] : undefined,
          pointRadius: ds.dashed ? 0 : 2.5,
          pointHoverRadius: 5,
          pointHitRadius: 12,
          tension: 0.15,
          fill:
            ds.fillToIndex !== undefined
              ? {
                  target: ds.fillToIndex,
                  above: ds.fillAboveColor ?? palette.greenFill,
                  below: ds.fillBelowColor ?? palette.redFill,
                }
              : false,
        };
      }),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      resizeDelay: 16,
      animation: reduced ? false : {duration: 200},
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'end',
          labels: {
            color: palette.ink2,
            boxWidth: 18,
            boxHeight: 2,
            padding: 10,
            font: {
              size: 12,
              family: '"Noto Sans SC", system-ui, sans-serif',
            },
          },
        },
        tooltip: {
          backgroundColor: palette.surface,
          titleColor: palette.ink,
          bodyColor: palette.ink2,
          footerColor: palette.ink,
          borderColor: palette.border,
          borderWidth: 1,
          padding: 9,
          displayColors: true,
          callbacks: {
            label(ctx: TooltipItem<'line'>): string {
              const val = ctx.parsed.y ?? 0;
              return ` ${ctx.dataset.label}：${round1(val)}${props.ySuffix}`;
            },
            footer(items: TooltipItem<'line'>[]): string {
              if (items.length < 2) return '';
              const baseVal = items[0]?.parsed.y;
              const nextVal = items[1]?.parsed.y;
              if (
                baseVal === null ||
                nextVal === null ||
                baseVal === undefined ||
                nextVal === undefined
              ) {
                return '';
              }
              const delta = round1(nextVal - baseVal);
              if (delta === 0) return '变化：0（持平）';
              return `变化：${delta > 0 ? '+' : ''}${delta}${props.ySuffix}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: {
            color: palette.grid,
          },
          ticks: {
            color: palette.ink3,
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 6,
            font: {
              size: 11,
              family: '"Saira Condensed", "Noto Sans SC", sans-serif',
            },
          },
        },
        y: {
          grid: {
            color: palette.grid,
          },
          ticks: {
            color: palette.ink3,
            maxTicksLimit: 5,
            font: {
              size: 11,
              family: '"Saira Condensed", "Noto Sans SC", sans-serif',
            },
            callback(value): string {
              return `${value}${props.ySuffix}`;
            },
          },
        },
      },
    },
  };
}

function renderOrUpdateChart(): void {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const nextConfig = buildConfig();
  const existing = chartInstance.value;
  if (!existing) {
    chartInstance.value = new Chart(canvas, nextConfig);
    return;
  }
  existing.data = nextConfig.data;
  existing.options = nextConfig.options ?? {};
  existing.update(prefersReducedMotion() ? 'none' : undefined);
}

let themeObserver: MutationObserver | undefined;
let mediaQueries: MediaQueryList[] = [];

watch(
  [
    () => props.labels,
    () => props.datasets,
    () => props.xSuffix,
    () => props.ySuffix,
  ],
  renderOrUpdateChart,
  {deep: true},
);

onMounted(() => {
  renderOrUpdateChart();
  if (typeof MutationObserver !== 'undefined') {
    themeObserver = new MutationObserver(renderOrUpdateChart);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-font', 'data-motion'],
    });
  }
  mediaQueries = [
    window.matchMedia('(prefers-color-scheme: dark)'),
    window.matchMedia('(prefers-reduced-motion: reduce)'),
  ];
  for (const media of mediaQueries)
    media.addEventListener('change', renderOrUpdateChart);
});

onBeforeUnmount(() => {
  themeObserver?.disconnect();
  for (const media of mediaQueries)
    media.removeEventListener('change', renderOrUpdateChart);
  chartInstance.value?.destroy();
  chartInstance.value = null;
});
</script>

<template>
  <div
    :class="['lc-shell', attrs.class]"
    :style="[{'--lc-h': `${height}px`}, attrs.style as StyleValue]">
    <canvas
      ref="canvasRef"
      class="lc-canvas"
      role="img"
      :aria-label="
        label ?? (attrs['aria-label'] as string | undefined) ?? '数值对比折线图'
      "></canvas>
  </div>
</template>

<style scoped>
.lc-shell {
  position: relative;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  height: var(--lc-h, 224px);
  padding: 6px 8px 4px;
  border-radius: 7px;
  border: 1px solid var(--line);
  background: var(--surface);
  overflow: hidden;
}

.lc-canvas {
  display: block;
  width: 100% !important;
  height: 100% !important;
}

@media (max-height: 600px) {
  .lc-shell {
    height: 184px;
  }
}
</style>
