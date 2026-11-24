<script setup lang="ts">
import {computed, nextTick, onDeactivated, ref, watch} from 'vue';
import {
  effectivePlanIcon,
  PLAN_ICON_CATALOGS,
  type PlanIcon,
} from '../../lib/plans/model.ts';
import {nameScore, normalize} from '../../lib/ui/match.ts';
import EmptyState from './EmptyState.vue';
import PlanEmblem from './PlanEmblem.vue';
import SearchInput from './SearchInput.vue';

const props = defineProps<{modelValue?: PlanIcon; base?: string}>();
const emit = defineEmits<{'update:modelValue': [icon: PlanIcon | undefined]}>();
const labels = {
  covenant: '盟约',
  operator: '干员',
  strategy: '策略',
  equipment: '装备',
} as const;
const current = computed(() =>
  effectivePlanIcon({base: props.base, icon: props.modelValue}),
);
const category = ref<PlanIcon['kind']>('covenant');
const query = ref('');
const dialog = ref<HTMLDialogElement>();
const grid = ref<HTMLElement>();
const title = ref<HTMLElement>();
const open = ref(false);
const names = computed(() => {
  const q = normalize(query.value);
  return Object.keys(PLAN_ICON_CATALOGS[category.value]).filter(
    (name) => !q || nameScore(name, q),
  );
});
watch([category, query], () => {
  if (grid.value) grid.value.scrollTop = 0;
});

async function show() {
  category.value = current.value?.kind ?? 'covenant';
  query.value = '';
  open.value = true;
  dialog.value?.showModal();
  await nextTick();
  // 聚焦标题，不在手机上自动唤起键盘；重新打开时让已选图标可见。
  title.value?.focus({preventScroll: true});
  grid.value
    ?.querySelector('[aria-pressed="true"]')
    ?.scrollIntoView({block: 'nearest'});
}
function select(icon?: PlanIcon) {
  emit('update:modelValue', icon);
  dialog.value?.close();
}
function switchCategory(kind: PlanIcon['kind']) {
  if (category.value === kind) return;
  category.value = kind;
  query.value = '';
}
onDeactivated(() => dialog.value?.close());
</script>

<template>
  <button
    type="button"
    class="icon-trigger"
    aria-haspopup="dialog"
    :aria-expanded="open"
    :aria-label="`更换流派图标，当前为${current?.name ?? '默认图标'}`"
    title="更换流派图标"
    @click="show">
    <PlanEmblem :icon="current" />
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6">
      <path d="m3 10 7.5-7.5 3 3L6 13l-3.5.5zM9 4l3 3" />
    </svg>
  </button>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="icon-library"
      aria-label="流派图标库"
      data-noswipe
      @click.self="dialog?.close()"
      @close="open = false">
      <div v-if="open" class="library-body">
        <header>
          <h3 ref="title" tabindex="-1">流派图标库</h3>
          <button
            type="button"
            class="close-library"
            aria-label="关闭图标库"
            @click="dialog?.close()">
            ✕
          </button>
        </header>
        <div class="library-columns">
          <div class="categories" role="group" aria-label="图标分类">
            <button
              v-for="(label, kind) in labels"
              :key="kind"
              type="button"
              :aria-pressed="category === kind"
              @click="switchCategory(kind)">
              {{ label }}
            </button>
          </div>
          <div class="library-results">
            <SearchInput
              v-model="query"
              :placeholder="`搜索${labels[category]}`"
              label="搜索当前分类图标" />
            <div ref="grid" class="icon-scroll">
              <div
                v-if="names.length"
                class="icon-grid"
                role="group"
                :aria-label="`${labels[category]}图标`">
                <button
                  v-for="name in names"
                  :key="name"
                  type="button"
                  :title="name"
                  :aria-pressed="
                    current?.kind === category && current.name === name
                  "
                  @click="select({kind: category, name})">
                  <PlanEmblem :icon="{kind: category, name}" />
                  <span>{{ name }}</span>
                </button>
              </div>
              <EmptyState
                v-else
                compact
                message="没有找到图标"
                action-label="清空搜索"
                @action="query = ''" />
            </div>
          </div>
        </div>
        <footer>
          <span>
            <PlanEmblem :icon="current" />
            {{ current?.name ?? '默认图标' }}
          </span>
          <button type="button" :disabled="!modelValue" @click="select()">
            恢复默认图标
          </button>
        </footer>
      </div>
    </dialog>
  </Teleport>
</template>

<style scoped>
.icon-trigger,
.icon-library button {
  font: inherit;
  color: inherit;
  cursor: pointer;
}
.icon-trigger {
  position: relative;
  display: grid;
  place-items: center;
  flex: none;
  width: 42px;
  height: 42px;
  padding: 2px;
  border: 1px solid var(--line2);
  border-radius: 8px;
  background: var(--surface);
}
.icon-trigger svg {
  position: absolute;
  right: -1px;
  bottom: -1px;
  width: 16px;
  height: 16px;
  padding: 2px;
  color: var(--ink);
  background: var(--surface);
  border: 1px solid var(--line2);
  border-radius: 4px;
}
.icon-library {
  width: min(540px, calc(100% - 16px));
  max-width: none;
  max-height: none;
  margin: auto;
  padding: 0;
  overflow: hidden;
  color: var(--ink);
  background: var(--surface);
  border: 1px solid var(--line2);
  border-radius: 12px;
  box-shadow: var(--shadow);
}
.icon-library::backdrop {
  background: rgb(8 18 21 / 55%);
}
.library-body {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  height: min(510px, calc(100dvh - 16px));
}
.library-body header,
.library-body footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 12px;
}
.library-body header {
  border-bottom: 1px solid var(--line);
}
.library-body h3 {
  margin: 0;
  font: 400 22px/1.2 var(--fd);
}
.library-body h3:focus {
  outline: none;
}
.library-body button {
  min-height: 36px;
  border: 0;
  border-radius: 6px;
  background: transparent;
}
.library-body .close-library {
  min-width: 36px;
  color: var(--ink2);
}
.library-columns {
  display: grid;
  grid-template-columns: clamp(58px, 16vw, 86px) minmax(0, 1fr);
  min-height: 0;
}
.categories {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 4px;
  background: var(--surface2);
  border-right: 1px solid var(--line);
  overflow: auto;
}
.categories button {
  flex: none;
  color: var(--ink2);
}
.categories button[aria-pressed='true'] {
  background: var(--surface);
  color: var(--teal);
  box-shadow: inset 3px 0 var(--teal);
  font-weight: 700;
}
.library-results {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 6px;
  min-height: 0;
  padding-top: 8px;
}
.library-results > .q-search {
  margin-inline: 8px;
}
.icon-scroll {
  overflow: auto;
  overscroll-behavior: contain;
  padding: 2px 8px 8px;
}
.icon-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(62px, 1fr));
  gap: 4px;
  align-content: start;
}
.icon-grid button {
  --emblem-size: 38px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: start;
  gap: 3px;
  padding: 5px 2px;
  font-size: 12px;
  line-height: 1.3;
  overflow-wrap: anywhere;
}
.icon-grid button[aria-pressed='true'] {
  background: var(--surface2);
  box-shadow: inset 0 0 0 2px var(--teal);
}
.library-body footer {
  border-top: 1px solid var(--line);
  font-size: 13px;
}
.library-body footer > span {
  --emblem-size: 23px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.library-body footer button {
  color: var(--teal);
}
.library-body footer button:disabled {
  color: var(--ink2);
  opacity: 0.55;
  cursor: default;
}
.icon-library button:focus-visible,
.icon-trigger:focus-visible {
  outline: 2px solid var(--teal);
  outline-offset: -2px;
}
@media (hover: hover) {
  .icon-library button:enabled:hover {
    background: color-mix(in srgb, var(--teal) 10%, var(--surface));
  }
  .icon-trigger:hover {
    border-color: var(--teal);
  }
}
@media (prefers-reduced-motion: no-preference) {
  .icon-library[open] {
    animation: icon-library-in 150ms ease-out;
  }
}
:global(:root[data-motion='reduce'] .icon-library[open]) {
  animation: none;
}
@keyframes icon-library-in {
  from {
    opacity: 0;
    transform: translateY(5px);
  }
}
@media (max-height: 400px) {
  .library-body header,
  .library-body footer {
    padding-block: 2px;
  }
  .library-results {
    gap: 2px;
    padding-top: 4px;
  }
}
</style>
