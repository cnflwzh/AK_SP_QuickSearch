<script setup lang="ts">
import {computed, ref, watch} from 'vue';
import {settings, updateSetting} from '../../lib/settings/store.ts';
import {isFloatingWindow, viewportSize} from '../../lib/ui/windowMode.ts';
import {
  breakpointKeys,
  DEFAULT_BREAKPOINTS,
  resolveViewportLayout,
  validBreakpoint,
  type Breakpoint,
  type ViewportBreakpoints,
} from '../../lib/ui/viewportLayout.ts';
import SelectInput from './SelectInput.vue';
import StatusNotice from './StatusNotice.vue';

const fields: Record<Breakpoint, string> = {
  phoneWidth: '窄窗口宽度上限',
  phoneWindowHeight: '窄窗口紧凑高度',
  shortHeight: '任意窗口紧凑高度',
  narrowWidth: '极窄窗口隐藏标题的宽度',
  compactHeaderWidth: '紧凑导航隐藏标题的宽度',
  searchTakeoverWidth: '搜索独占一行的宽度',
  wideGuideWidth: '宽屏显示教程的宽度分界',
  squareWidth: '近方形窗口宽度上限',
  squareHeight: '近方形窗口高度上限',
  squareRatioPercent: '近方形窗口最小宽高比',
};
const samples = [
  {value: '', label: '当前窗口'},
  {
    label: 'Chrome',
    options: [
      {value: '384x732', label: '竖屏全屏 · 384 × 732'},
      {value: '384x498', label: '竖屏小窗 · 384 × 498'},
      {value: '384x460', label: '横屏小窗 · 384 × 460'},
      {value: '808x263', label: '横屏全屏 · 808 × 263'},
    ],
  },
  {
    label: 'PWA',
    options: [
      {value: '384x788', label: '竖屏全屏 · 384 × 788'},
      {value: '384x554', label: '竖屏小窗 · 384 × 554'},
      {value: '384x516', label: '横屏小窗 · 384 × 516'},
      {value: '808x319', label: '横屏全屏 · 808 × 319'},
    ],
  },
];
const draft = ref<ViewportBreakpoints>({...settings.viewportBreakpoints});
const sample = ref('');
const message = ref('');
const savedKey = computed(() =>
  breakpointKeys.map((k) => settings.viewportBreakpoints[k]).join(','),
);
watch(savedKey, () => {
  draft.value = {...settings.viewportBreakpoints};
});
const valid = computed(() =>
  breakpointKeys.every((k) => validBreakpoint(k, draft.value[k])),
);
const dirty = computed(() =>
  breakpointKeys.some(
    (k) => draft.value[k] !== settings.viewportBreakpoints[k],
  ),
);
const customized = computed(() =>
  breakpointKeys.some(
    (k) => settings.viewportBreakpoints[k] !== DEFAULT_BREAKPOINTS[k],
  ),
);
const preview = computed(() => {
  if (!valid.value) return '';
  const [w, h] = sample.value
    ? sample.value.split('x').map(Number)
    : [viewportSize.value.width, viewportSize.value.height];
  const layout = resolveViewportLayout(
    w,
    h,
    draft.value,
    !sample.value && isFloatingWindow.value,
  );
  const header = settings.showHeader && layout.showHeader;
  const search = {
    row: '搜索单独一行',
    inline: '展开搜索时保留栏目',
    takeover: '展开搜索时占满整行',
  };
  return [
    `${w} × ${h} · ${layout.label}`,
    header ? '显示标题' : '隐藏标题',
    header && layout.showGuide ? '显示教程' : '隐藏教程',
    search[layout.search],
  ].join(' · ');
});
function apply() {
  if (!valid.value || !dirty.value) return;
  updateSetting('viewportBreakpoints', {...draft.value});
  message.value = '断点已应用到本机。';
}
function reset() {
  draft.value = {...DEFAULT_BREAKPOINTS};
  updateSetting('viewportBreakpoints', {...DEFAULT_BREAKPOINTS});
  message.value = '已恢复默认断点。';
}
</script>

<template>
  <details class="breakpoints">
    <summary>调整尺寸断点</summary>
    <form @submit.prevent="apply" @input="message = ''">
      <p>
        先选窗口尺寸预览效果，再应用到本机。自定义断点只在开发者模式开启时生效。
      </p>
      <div class="preview">
        <SelectInput v-model="sample" :options="samples" label="预览窗口尺寸" />
        <output>{{ preview || '请输入有效的断点以预览。' }}</output>
      </div>
      <div class="thresholds">
        <label v-for="key in breakpointKeys" :key="key">
          <span>{{ fields[key] }}</span>
          <span class="value">
            <input
              v-model.number="draft[key]"
              type="number"
              :min="key === 'squareRatioPercent' ? 0 : 1"
              :max="key === 'squareRatioPercent' ? 100 : 8192"
              :step="key === 'squareRatioPercent' ? 'any' : 1"
              :aria-label="fields[key]"
              :aria-invalid="!validBreakpoint(key, draft[key])" />
            <small>{{ key === 'squareRatioPercent' ? '%' : 'px' }}</small>
          </span>
        </label>
      </div>
      <div class="buttons">
        <button type="submit" class="btn p" :disabled="!valid || !dirty">
          应用断点
        </button>
        <button
          type="button"
          class="btn"
          :disabled="!dirty && !customized"
          @click="reset">
          恢复默认断点
        </button>
      </div>
      <StatusNotice
        v-if="!valid"
        tone="warning"
        message="尺寸须为 1–8192 的整数，宽高比须大于 0 且不超过 100%。" />
      <StatusNotice v-else-if="message" tone="success" :message="message" />
    </form>
  </details>
</template>

<style scoped>
.breakpoints {
  border-top: 1px solid var(--line);
}
summary {
  padding: 8px 0;
  min-height: 36px;
  cursor: pointer;
  font-weight: 600;
}
form {
  display: grid;
  gap: 12px;
}
p {
  margin: 0;
  font-size: 13px;
  color: var(--ink2);
}
.preview,
.buttons {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.preview {
  padding: 8px;
  border-radius: 6px;
  background: var(--surface2);
}
output {
  font-size: 13px;
  color: var(--ink);
}
.thresholds {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 235px), 1fr));
  gap: 8px 16px;
}
label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 13px;
}
.value {
  display: flex;
  align-items: center;
  gap: 4px;
}
input {
  width: 66px;
  min-height: 36px;
  padding: 3px 5px;
  border: 1px solid var(--line2);
  border-radius: 5px;
  font: inherit;
  background: var(--surface);
  color: var(--ink);
}
input[aria-invalid='true'] {
  border-color: var(--red);
}
small {
  min-width: 16px;
  color: var(--ink2);
}
</style>
