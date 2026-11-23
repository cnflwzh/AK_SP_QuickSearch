<script setup lang="ts">
import {
  computed,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  ref,
  shallowRef,
  watch,
} from 'vue';
import {
  ADDON_COVENANTS,
  BUILD_NAMES,
  CORE_COVENANTS,
  OPERATORS,
  TIER_LABELS,
} from '../../../data/index.ts';
import {
  APOLOGY_TEMPLATES,
  APOLOGY_TEMPLATE_LIST,
  LEAK_SCALES,
  buildApologyDocument,
  buildScenePresets,
  createDefaultApologyState,
  formatApologyText,
  generateDocNo,
  randomizeApologyState,
  renderPresetOpening,
  resolveChoiceText,
  splitCustomLines,
  switchApologyTemplate,
  type ApologyDocument,
  type ApologyFormState,
  type ApologyTemplateId,
} from '../../lib/apology/index.ts';
import LiveStatus from '../../lib/ui/LiveStatus.vue';
import {downloadBlob} from '../../lib/ui/download.ts';
import {run, runLeader, runStats} from '../planStore.ts';
import CopyButton from '../components/CopyButton.vue';
import SectionHeading from '../components/SectionHeading.vue';
import SelectInput, {type SelectEntry} from '../components/SelectInput.vue';
import StatusNotice from '../components/StatusNotice.vue';
import SubTabs, {
  type SubTabDirection,
  type SubTabItem,
} from '../components/SubTabs.vue';
import {copyApologyImage, renderApologyPoster} from './apologyPoster.ts';

const TEMPLATE_TABS: readonly SubTabItem<ApologyTemplateId>[] =
  APOLOGY_TEMPLATE_LIST.map((item) => ({
    id: item.id,
    label: item.tabLabel,
  }));

const SCENE_PRESETS = buildScenePresets();

const COVENANT_OPTIONS: readonly SelectEntry<string>[] = [
  {value: '', label: '不指定盟约'},
  {
    label: '核心盟约',
    options: CORE_COVENANTS.map((name) => ({value: name, label: name})),
  },
  {
    label: '附加盟约',
    options: ADDON_COVENANTS.map((name) => ({value: name, label: name})),
  },
];

const OPERATOR_OPTIONS: readonly SelectEntry<string>[] = (() => {
  const byTier = new Map<number, string[]>();
  for (const op of OPERATORS) {
    const list = byTier.get(op.tier);
    if (list) list.push(op.name);
    else byTier.set(op.tier, [op.name]);
  }
  const groups: SelectEntry<string>[] = [{value: '', label: '不指定干员'}];
  for (const tier of [...byTier.keys()].sort((a, b) => b - a)) {
    const label = `${TIER_LABELS[tier] ?? tier} 阶干员`;
    groups.push({
      label,
      options: (byTier.get(tier) ?? []).map((name) => ({
        value: name,
        label: `${TIER_LABELS[tier] ?? ''} · ${name}`,
      })),
    });
  }
  return groups;
})();

const LEAK_SCALE_OPTIONS: readonly SelectEntry<string>[] = LEAK_SCALES.map(
  (item) => ({value: item, label: item}),
);

const SCENE_PICKER_OPTIONS: readonly SelectEntry<string>[] = [
  {value: '', label: '快捷套用场景…'},
  ...SCENE_PRESETS.map((item) => ({value: item, label: item})),
];

const BUILD_PICKER_OPTIONS: readonly SelectEntry<string>[] = [
  {value: '', label: '快捷填入流派 / 盟约…'},
  {
    label: '内置流派',
    options: BUILD_NAMES.map((name) => ({value: name, label: name})),
  },
  {
    label: '附加盟约',
    options: ADDON_COVENANTS.map((name) => ({value: name, label: name})),
  },
  {
    label: '常见套路',
    options: [
      {value: '电表倒转', label: '电表倒转'},
      {value: '冷门科研流', label: '冷门科研流'},
      {value: '随缘过渡杂技队', label: '随缘过渡杂技队'},
    ],
  },
];

const form = ref<ApologyFormState>(createDefaultApologyState('apology'));
const templateDir = ref<SubTabDirection>('');
const active = ref(true);

const templateMeta = computed(() => APOLOGY_TEMPLATES[form.value.template]);
const openingText = computed<string>({
  get: () => form.value.customOpening ?? renderPresetOpening(form.value),
  set: (text) => {
    form.value.customOpening = text;
  },
});
const documentModel = computed(() => buildApologyDocument(form.value));
const plainText = computed(() => formatApologyText(documentModel.value));

const selectedTemplate = computed<ApologyTemplateId>({
  get: () => form.value.template,
  set: (next) => {
    form.value = switchApologyTemplate(form.value, next);
  },
});

function replaceCurrentForm(next: ApologyFormState): void {
  // 随机换一套和恢复默认只影响正在编辑的文书。
  form.value = {...next, savedOpenings: form.value.savedOpenings};
}

const customReasonCount = computed(
  () => splitCustomLines(form.value.customReasons).length,
);
const customPledgeCount = computed(
  () => splitCustomLines(form.value.customPledges).length,
);
const checkedReasonCount = computed(
  () => form.value.checkedReasons.length + customReasonCount.value,
);
const allPresetReasonsChecked = computed(
  () => form.value.checkedReasons.length === templateMeta.value.reasons.length,
);
const checkedPledgeCount = computed(
  () => form.value.checkedPledges.length + customPledgeCount.value,
);

const hasRunContext = computed(() =>
  Boolean(run.value || (form.value.template === 'apology' && runLeader.value)),
);

function onTemplateChange(_id: ApologyTemplateId, dir: SubTabDirection): void {
  templateDir.value = dir;
}

function toggleReason(id: string): void {
  const current = form.value.checkedReasons;
  if (current.includes(id)) {
    form.value.checkedReasons = current.filter((item) => item !== id);
  } else {
    const order = templateMeta.value.reasons.map((r) => r.id);
    const next = new Set([...current, id]);
    form.value.checkedReasons = order.filter((item) => next.has(item));
  }
}

function selectAllReasons(): void {
  const allIds = templateMeta.value.reasons.map((item) => item.id);
  form.value.checkedReasons =
    form.value.checkedReasons.length === allIds.length ? [] : allIds;
}

function togglePledge(id: string): void {
  const current = form.value.checkedPledges;
  if (current.includes(id)) {
    form.value.checkedPledges = current.filter((item) => item !== id);
  } else {
    const order = templateMeta.value.pledges.map((p) => p.id);
    const next = new Set([...current, id]);
    form.value.checkedPledges = order.filter((item) => next.has(item));
  }
}

function cycleQuote(): void {
  const quotes = templateMeta.value.sampleQuotes;
  if (!quotes.length) return;
  const currentIdx = quotes.indexOf(form.value.customQuote.trim());
  const nextIdx = currentIdx >= 0 ? (currentIdx + 1) % quotes.length : 0;
  form.value.customQuote = quotes[nextIdx];
}

function applyRandomMeme(): void {
  replaceCurrentForm(randomizeApologyState(form.value.template));
  liveMessage.value = `已随机生成一份「${templateMeta.value.tabLabel}」`;
}

function refreshDocNo(): void {
  form.value.docNo = generateDocNo(form.value.template);
}

function applyCurrentRun(): void {
  const activeRun = run.value;
  const leader = runLeader.value;
  if (activeRun) {
    form.value.buildText = activeRun.plan.name;
    const activated = runStats.value.filter((stat) => stat.active);
    const named = activated.find(
      (stat) =>
        stat.name === activeRun.plan.base || stat.name === activeRun.key,
    );
    const mostMembers = Math.max(0, ...activated.map((stat) => stat.count));
    const largest = activated.filter((stat) => stat.count === mostMembers);
    // 混搭阵容若有多个并列主轴，让玩家自行指定盟约。
    form.value.covenant =
      named?.name ?? (largest.length === 1 ? largest[0].name : '');
    const coreSlot =
      activeRun.plan.ops.find((slot) => slot.core) ?? activeRun.plan.ops[0];
    form.value.operator = coreSlot?.name ?? '';
  }
  if (leader && form.value.template !== 'application') {
    form.value.scene = `领袖「${leader.name}」决战波`;
  }
  liveMessage.value =
    [activeRun && '流派', leader && form.value.template === 'apology' && '领袖']
      .filter(Boolean)
      .join('与') + '已带入文书';
}

function applyScenePreset(value: string): void {
  if (value) form.value.scene = value;
}

function applyBuildPreset(value: string): void {
  if (value) form.value.buildText = value;
}

function resetTemplate(): void {
  replaceCurrentForm(createDefaultApologyState(form.value.template));
  liveMessage.value = '已重置为默认模板';
}

/* ---------- 屏幕预览与按需高清导出 ---------- */
const poster = shallowRef<{doc: ApologyDocument; url: string}>();
const previewAttempt = ref(0);
const imageError = ref('');
const exportJob = shallowRef<AbortController>();
const previewReady = computed(() => poster.value?.doc === documentModel.value);
const canExport = computed(
  () => active.value && previewReady.value && !exportJob.value,
);
const imageStatus = ref<'idle' | 'copied' | 'saved'>('idle');
const copyFallback = ref('');
const liveMessage = ref('');
let statusTimer: ReturnType<typeof setTimeout> | undefined;

function clearPreview(): void {
  if (poster.value) URL.revokeObjectURL(poster.value.url);
  poster.value = undefined;
}

async function renderPreview(
  doc: ApologyDocument,
  signal: AbortSignal,
): Promise<void> {
  try {
    const blob = await renderApologyPoster(doc, 'preview', signal);
    if (signal.aborted || !active.value || doc !== documentModel.value) return;
    const url = URL.createObjectURL(blob);
    clearPreview();
    poster.value = {doc, url};
  } catch {
    if (signal.aborted || !active.value || doc !== documentModel.value) return;
    clearPreview();
    imageError.value = '预览生成失败，可重新生成或复制纯文本。';
  }
}

const stopPreview = watch(
  [documentModel, active, previewAttempt],
  ([doc, visible], _, onCleanup) => {
    exportJob.value?.abort();
    exportJob.value = undefined;
    imageStatus.value = 'idle';
    imageError.value = '';
    copyFallback.value = '';
    if (!visible || poster.value?.doc === doc) return;

    const controller = new AbortController();
    const timer = setTimeout(
      () => {
        void renderPreview(doc, controller.signal);
      },
      poster.value ? 120 : 0,
    );
    onCleanup(() => {
      clearTimeout(timer);
      controller.abort();
    });
  },
  {immediate: true},
);

onActivated(() => {
  active.value = true;
});
onDeactivated(() => {
  active.value = false;
});
onBeforeUnmount(() => {
  active.value = false;
  stopPreview();
  exportJob.value?.abort();
  clearTimeout(statusTimer);
  clearPreview();
});

function setImageFeedback(status: 'copied' | 'saved', message: string): void {
  clearTimeout(statusTimer);
  imageStatus.value = status;
  liveMessage.value = message;
  statusTimer = setTimeout(() => {
    imageStatus.value = 'idle';
  }, 2400);
}

async function exportPoster(action: 'copy' | 'save'): Promise<void> {
  if (!canExport.value) return;
  const doc = documentModel.value;
  const controller = new AbortController();
  exportJob.value = controller;
  imageError.value = '';
  try {
    // 写剪贴板要在点击时发起，并与下载回退共用同一份快照和编码结果。
    const png = renderApologyPoster(doc, 'export', controller.signal);
    const [blob, outcome] = await Promise.all([
      png,
      action === 'copy' ? copyApologyImage(png) : 'save',
    ]);
    if (
      controller.signal.aborted ||
      !active.value ||
      doc !== documentModel.value
    )
      return;
    if (outcome === 'copied') {
      setImageFeedback('copied', '已复制文书图片到剪贴板，可直接粘贴发送');
    } else {
      downloadBlob(blob, doc.fileName);
      setImageFeedback(
        'saved',
        action === 'copy'
          ? '当前浏览器未能复制图片，已转为保存 PNG'
          : `已保存图片 ${doc.fileName}`,
      );
    }
  } catch {
    if (
      !controller.signal.aborted &&
      active.value &&
      doc === documentModel.value
    ) {
      imageError.value = '图片导出失败，请重试或复制纯文本。';
    }
  } finally {
    if (exportJob.value === controller) exportJob.value = undefined;
  }
}
</script>

<template>
  <div class="nt-apology">
    <div class="bar nt-toolbar nt-apology-toolbar">
      <div class="nt-apology-title-wrap">
        <h4 class="nt-section-title" aria-level="2">漏怪文书</h4>
        <SubTabs
          v-model="selectedTemplate"
          :items="TEMPLATE_TABS"
          :level="3"
          inline
          aria-label="文书类型"
          attr="apology-tpl"
          @change="onTemplateChange" />
      </div>
      <div class="nt-apology-top-actions">
        <button
          v-if="hasRunContext"
          type="button"
          class="btn nt-apology-action"
          title="将当前本局流派与领袖带入文书"
          @click="applyCurrentRun">
          带入本局
        </button>
        <button
          type="button"
          class="btn p nt-apology-action"
          @click="applyRandomMeme">
          🎲 随机换一套
        </button>
      </div>
    </div>

    <div
      :key="form.template"
      :class="['nt-apology-layout', {'subtab-panel': !!templateDir}]"
      :data-dir="templateDir || undefined">
      <div class="nt-apology-editor">
        <section class="nc nt-apology-card">
          <SectionHeading
            title="基本信息"
            desc="不填也能直接出图，点选即可实时预览"
            :level="4"
            accent="#b8322a">
            <template #extra>
              <button
                type="button"
                class="btn nt-apology-mini"
                @click="resetTemplate">
                恢复默认
              </button>
            </template>
          </SectionHeading>

          <div class="nt-apology-fields">
            <label class="nt-apology-field">
              <span>{{ templateMeta.applicantLabel }}</span>
              <input
                v-model="form.applicant"
                type="text"
                maxlength="32"
                :placeholder="templateMeta.defaultApplicant" />
            </label>
            <label class="nt-apology-field">
              <span>{{ templateMeta.recipientLabel }}</span>
              <input
                v-model="form.recipient"
                type="text"
                maxlength="36"
                :placeholder="templateMeta.defaultRecipient" />
            </label>

            <template v-if="form.template === 'application'">
              <div class="nt-apology-field nt-apology-field-full">
                <div class="nt-apology-field-head">
                  <label for="apology-build-text">拟玩流派 / 盟约</label>
                  <SelectInput
                    :model-value="''"
                    :options="BUILD_PICKER_OPTIONS"
                    compact
                    aria-label="快捷填入流派或盟约"
                    @update:model-value="applyBuildPreset" />
                </div>
                <input
                  id="apology-build-text"
                  v-model="form.buildText"
                  type="text"
                  maxlength="24"
                  placeholder="自由填写，如：炎、电表倒转、冷门科研流…" />
              </div>

              <div class="nt-apology-field nt-apology-field-full">
                <span>关键干员（可选，带头像）</span>
                <SelectInput
                  v-model="form.operator"
                  :options="OPERATOR_OPTIONS"
                  highlight-active
                  aria-label="关键干员" />
              </div>
            </template>

            <template v-else>
              <div class="nt-apology-field nt-apology-field-full">
                <div class="nt-apology-field-head">
                  <label :for="`apology-scene-${form.template}`">
                    {{ templateMeta.sceneLabel }}
                  </label>
                  <SelectInput
                    :model-value="''"
                    :options="SCENE_PICKER_OPTIONS"
                    compact
                    aria-label="套用常见翻车现场"
                    @update:model-value="applyScenePreset" />
                </div>
                <input
                  :id="`apology-scene-${form.template}`"
                  v-model="form.scene"
                  type="text"
                  maxlength="48"
                  :placeholder="templateMeta.defaultScene" />
              </div>

              <div class="nt-apology-field nt-apology-field-full">
                <span>漏怪情况</span>
                <SelectInput
                  v-model="form.leakScale"
                  :options="LEAK_SCALE_OPTIONS"
                  aria-label="漏怪情况" />
              </div>

              <div class="nt-apology-field">
                <span>关联盟约（带图标）</span>
                <SelectInput
                  v-model="form.covenant"
                  :options="COVENANT_OPTIONS"
                  highlight-active
                  aria-label="关联盟约" />
              </div>
              <div class="nt-apology-field">
                <span>关联干员（带头像）</span>
                <SelectInput
                  v-model="form.operator"
                  :options="OPERATOR_OPTIONS"
                  highlight-active
                  aria-label="关联干员" />
              </div>
            </template>
          </div>
        </section>

        <section class="nc nt-apology-card">
          <SectionHeading
            title="正文文案"
            :desc="
              form.customOpening !== null
                ? '已手动改写，恢复模板可套用所选风格'
                : '点选风格或直接修改正文'
            "
            :level="4"
            accent="#b8322a">
            <template #extra>
              <button
                v-if="form.customOpening !== null"
                type="button"
                class="btn nt-apology-mini"
                @click="form.customOpening = null">
                恢复模板
              </button>
            </template>
          </SectionHeading>
          <div
            class="nt-apology-presets"
            role="radiogroup"
            aria-label="正文文案风格">
            <label
              v-for="preset in templateMeta.openingPresets"
              :key="preset.id"
              :class="[
                'nt-apology-preset-btn',
                {on: form.openingId === preset.id},
              ]">
              <input
                v-model="form.openingId"
                class="sr-only"
                type="radio"
                :name="`apology-opening-${form.template}`"
                :value="preset.id" />
              {{ preset.label }}
            </label>
          </div>
          <label class="nt-apology-field">
            <span>正文内容（可直接编辑或自行撰写）</span>
            <textarea
              v-model="openingText"
              rows="4"
              maxlength="360"
              placeholder="可直接输入想写的正文内容…"></textarea>
          </label>
        </section>

        <section class="nc nt-apology-card">
          <SectionHeading
            :title="templateMeta.reasonHeading"
            :count="`已选 ${checkedReasonCount} 条`"
            :level="4"
            accent="#b8322a">
            <template #extra>
              <button
                type="button"
                class="btn nt-apology-mini"
                @click="selectAllReasons">
                {{ allPresetReasonsChecked ? '全部取消' : '全选' }}
              </button>
            </template>
          </SectionHeading>
          <div
            class="nt-apology-checks"
            role="group"
            :aria-label="templateMeta.reasonHeading">
            <button
              v-for="item in templateMeta.reasons"
              :key="item.id"
              type="button"
              :class="[
                'nt-apology-check',
                {on: form.checkedReasons.includes(item.id)},
              ]"
              :aria-pressed="form.checkedReasons.includes(item.id)"
              @click="toggleReason(item.id)">
              <span class="nt-apology-box" aria-hidden="true">
                {{ form.checkedReasons.includes(item.id) ? '✓' : '' }}
              </span>
              <span class="nt-apology-check-text">
                {{ resolveChoiceText(item.text, form.recipient) }}
              </span>
            </button>
          </div>
          <label class="nt-apology-field nt-apology-custom-field">
            <span>自定义补充原因（一行一条，自动写入）</span>
            <textarea
              v-model="form.customReasons"
              rows="2"
              maxlength="240"
              :placeholder="templateMeta.customReasonPlaceholder"></textarea>
          </label>
        </section>

        <section class="nc nt-apology-card">
          <SectionHeading
            :title="templateMeta.pledgeHeading"
            :count="`已选 ${checkedPledgeCount} 条`"
            :level="4"
            accent="var(--teal)" />
          <div
            class="nt-apology-checks"
            role="group"
            :aria-label="templateMeta.pledgeHeading">
            <button
              v-for="item in templateMeta.pledges"
              :key="item.id"
              type="button"
              :class="[
                'nt-apology-check',
                'tone-teal',
                {on: form.checkedPledges.includes(item.id)},
              ]"
              :aria-pressed="form.checkedPledges.includes(item.id)"
              @click="togglePledge(item.id)">
              <span class="nt-apology-box" aria-hidden="true">
                {{ form.checkedPledges.includes(item.id) ? '✓' : '' }}
              </span>
              <span class="nt-apology-check-text">
                {{ resolveChoiceText(item.text, form.recipient) }}
              </span>
            </button>
          </div>
          <label class="nt-apology-field nt-apology-custom-field">
            <span>自定义补充条款（一行一条，自动写入）</span>
            <textarea
              v-model="form.customPledges"
              rows="2"
              maxlength="240"
              :placeholder="templateMeta.customPledgePlaceholder"></textarea>
          </label>
        </section>

        <section class="nc nt-apology-card">
          <SectionHeading
            title="补充声明 · 落款"
            :level="4"
            accent="var(--accent)" />

          <div class="nt-apology-field nt-apology-field-full">
            <div class="nt-apology-field-head">
              <label :for="`apology-quote-${form.template}`">
                {{ templateMeta.quoteLabel }}
              </label>
              <button
                type="button"
                class="btn nt-apology-mini"
                @click="cycleQuote">
                换一句
              </button>
            </div>
            <textarea
              :id="`apology-quote-${form.template}`"
              v-model="form.customQuote"
              rows="2"
              maxlength="160"
              :placeholder="templateMeta.quotePlaceholder"></textarea>
          </div>

          <div class="nt-apology-fields nt-apology-fields-sign">
            <label class="nt-apology-field">
              <span>{{ templateMeta.signatureLabel }}（留空同 ID）</span>
              <input
                v-model="form.signature"
                type="text"
                maxlength="24"
                :placeholder="
                  form.applicant || templateMeta.defaultApplicant
                " />
            </label>
            <label class="nt-apology-field">
              <span>日期</span>
              <input v-model="form.dateText" type="text" maxlength="20" />
            </label>
            <div class="nt-apology-field nt-apology-field-full">
              <div class="nt-apology-field-head">
                <label :for="`apology-docno-${form.template}`">公文编号</label>
                <button
                  type="button"
                  class="btn nt-apology-mini"
                  @click="refreshDocNo">
                  换编号
                </button>
              </div>
              <input
                :id="`apology-docno-${form.template}`"
                v-model="form.docNo"
                type="text"
                maxlength="32" />
            </div>
          </div>

          <div class="nt-apology-mobile-export">
            <button
              type="button"
              class="btn p nt-apology-export-btn"
              :disabled="!canExport"
              @click="exportPoster('copy')">
              {{
                imageStatus === 'copied'
                  ? '✓ 已复制图片'
                  : imageStatus === 'saved'
                    ? '✓ 已保存 PNG'
                    : '复制文书图片'
              }}
            </button>
            <CopyButton
              :text="plainText"
              label="复制纯文本"
              copied-label="已复制文字"
              fallback-mode="emit"
              @copied="copyFallback = ''"
              @fallback="copyFallback = $event" />
          </div>
        </section>
      </div>

      <aside class="nt-apology-preview">
        <section class="nc nt-apology-preview-card">
          <div class="nt-apology-export-bar">
            <button
              type="button"
              class="btn p nt-apology-export-btn"
              :disabled="!canExport"
              @click="exportPoster('copy')">
              {{
                imageStatus === 'copied'
                  ? '✓ 已复制图片'
                  : imageStatus === 'saved'
                    ? '✓ 已保存 PNG'
                    : '复制图片发群'
              }}
            </button>
            <button
              type="button"
              class="btn nt-apology-export-btn"
              :disabled="!canExport"
              @click="exportPoster('save')">
              保存 PNG
            </button>
            <CopyButton
              :text="plainText"
              label="复制文字"
              copied-label="已复制文字"
              fallback-mode="emit"
              @copied="copyFallback = ''"
              @fallback="copyFallback = $event" />
          </div>

          <StatusNotice v-if="imageError" tone="warning">
            {{ imageError }}
            <button
              v-if="!poster"
              type="button"
              class="btn nt-apology-mini"
              @click="previewAttempt++">
              重新生成
            </button>
          </StatusNotice>

          <div v-if="copyFallback" class="nt-apology-fallback">
            <p class="hint">
              浏览器限制自动写入剪贴板，请长按或全选下方文字复制：
            </p>
            <textarea
              class="nt-copy-fallback"
              readonly
              aria-label="漏怪文书纯文本复制框"
              :value="copyFallback"
              @focus="
                ($event.target as HTMLTextAreaElement).select()
              "></textarea>
          </div>

          <div
            v-if="poster || !imageError"
            :aria-busy="!previewReady"
            :class="[
              'nt-apology-stage',
              {updating: !previewReady && !!poster},
            ]">
            <img
              v-if="poster"
              class="nt-apology-poster"
              :src="poster.url"
              :alt="`${poster.doc.title} 预览图`"
              :aria-hidden="!previewReady" />
            <div v-else-if="!imageError" class="nt-apology-loading">
              正在排版红头公文…
            </div>
          </div>

          <p class="nt-apology-tip">
            电脑端可直接「复制图片发群」后
            Ctrl+V；手机端也可直接长按预览图保存转发。
          </p>

          <details class="nt-apology-text-fold">
            <summary>查看纯文本排版（适合群聊 / NGA 直接粘贴）</summary>
            <pre class="nt-apology-pre">{{ plainText }}</pre>
          </details>
        </section>
      </aside>
    </div>

    <LiveStatus :message="liveMessage" />
  </div>
</template>

<style scoped>
.nt-apology {
  display: grid;
  gap: 12px;
}

.nt-apology-toolbar {
  justify-content: space-between;
  align-items: center;
  gap: 8px 12px;
  margin-bottom: 0;
}

.nt-apology-title-wrap {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  min-width: 0;
}

.nt-apology-title-wrap .subtabs {
  margin: 0;
}

.nt-apology-top-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.nt-apology-action {
  min-height: 36px;
  white-space: nowrap;
  font-weight: 700;
}

.nt-apology-layout {
  display: grid;
  grid-template-columns: minmax(0, 0.96fr) minmax(360px, 1.04fr);
  gap: 14px;
  align-items: start;
}

.nt-apology-editor {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.nt-apology-card {
  display: grid;
  gap: 10px;
  padding: 13px 15px;
}

.nt-apology-mini {
  min-height: 34px;
  padding: 4px 11px;
  font-size: 13px;
  white-space: nowrap;
}

.nt-apology-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.nt-apology-field {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.nt-apology-field-full {
  grid-column: 1 / -1;
}

.nt-apology-field > span,
.nt-apology-field > label,
.nt-apology-field-head > span,
.nt-apology-field-head > label {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--ink2);
}

.nt-apology-field-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.nt-apology-field input,
.nt-apology-field textarea {
  width: 100%;
  min-width: 0;
  min-height: 38px;
  padding: 7px 11px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  font-size: 14.5px;
  line-height: 1.5;
  transition: border-color 140ms ease;
}

.nt-apology-field textarea {
  resize: vertical;
  min-height: 68px;
}

.nt-apology-field input:focus-visible,
.nt-apology-field textarea:focus-visible {
  outline: none;
  border-color: var(--accent);
}

.nt-apology-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.nt-apology-preset-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  padding: 4px 11px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--ink2);
  font: inherit;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  transition:
    border-color 140ms ease,
    background-color 140ms ease,
    color 140ms ease;
}

.nt-apology-preset-btn:has(input:focus-visible) {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.nt-apology-preset-btn:hover {
  border-color: color-mix(in srgb, #b8322a 55%, var(--line));
  color: var(--ink);
}

.nt-apology-preset-btn.on {
  border-color: #b8322a;
  background: color-mix(in srgb, #b8322a 10%, var(--surface));
  color: #b8322a;
}

.nt-apology-checks {
  display: grid;
  gap: 7px;
}

.nt-apology-check {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  min-height: 40px;
  padding: 8px 11px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--ink2);
  text-align: left;
  font: inherit;
  font-size: 14.5px;
  line-height: 1.5;
  cursor: pointer;
  transition:
    border-color 140ms ease,
    background-color 140ms ease,
    color 140ms ease;
}

.nt-apology-check:hover {
  border-color: color-mix(in srgb, #b8322a 55%, var(--line));
  color: var(--ink);
}

.nt-apology-check.on {
  border-color: #b8322a;
  background: color-mix(in srgb, #b8322a 8%, var(--surface));
  color: var(--ink);
  font-weight: 600;
}

.nt-apology-check.tone-teal:hover {
  border-color: color-mix(in srgb, var(--teal) 55%, var(--line));
}

.nt-apology-check.tone-teal.on {
  border-color: var(--teal);
  background: color-mix(in srgb, var(--teal) 8%, var(--surface));
}

.nt-apology-box {
  flex: none;
  display: inline-grid;
  place-items: center;
  width: 19px;
  height: 19px;
  margin-top: 1px;
  border-radius: 4px;
  border: 1.5px solid var(--line2, var(--line));
  background: var(--bg);
  color: #fff;
  font-size: 12px;
  font-weight: 800;
  line-height: 1;
}

.nt-apology-check.on .nt-apology-box {
  border-color: #b8322a;
  background: #b8322a;
}

.nt-apology-check.tone-teal.on .nt-apology-box {
  border-color: var(--teal);
  background: var(--teal);
}

.nt-apology-check-text {
  min-width: 0;
  flex: 1;
}

.nt-apology-custom-field {
  margin-top: 2px;
  padding-top: 8px;
  border-top: 1px dashed var(--line);
}

.nt-apology-preview {
  position: sticky;
  top: calc(var(--qbar-height, 0px) + 8px);
  min-width: 0;
}

.nt-apology-preview-card {
  display: grid;
  gap: 10px;
  padding: 12px 14px;
}

.nt-apology-export-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px;
}

.nt-apology-export-btn {
  min-height: 36px;
  white-space: nowrap;
  font-weight: 700;
}

.nt-apology-export-bar .btn.p {
  flex: 1 1 130px;
}

.nt-apology-stage {
  border-radius: 10px;
  background: color-mix(in srgb, var(--surface) 70%, var(--bg));
  border: 1px solid var(--line);
  padding: 6px;
  display: grid;
  place-items: center;
  min-height: 240px;
  transition: opacity 150ms ease;
}

.nt-apology-stage.updating {
  opacity: 0.76;
}

.nt-apology-stage.updating .nt-apology-poster {
  pointer-events: none;
}
.nt-apology-poster {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 6px;
}

.nt-apology-loading {
  color: var(--ink3);
  font-size: 14px;
  padding: 40px 12px;
}

.nt-apology-tip {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--ink3);
}

.nt-apology-fallback {
  display: grid;
  gap: 6px;
}

.nt-apology-text-fold {
  border-top: 1px solid var(--line);
  padding-top: 8px;
}

.nt-apology-text-fold > summary {
  cursor: pointer;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--ink2);
  min-height: 34px;
  display: flex;
  align-items: center;
}

.nt-apology-pre {
  margin: 6px 0 0;
  padding: 11px 13px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: var(--bg);
  color: var(--ink);
  font-size: 13.5px;
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 280px;
  overflow: auto;
}

.nt-apology-mobile-export {
  display: none;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 4px;
  border-top: 1px solid var(--line);
}

/* 深色主题双分支：保证手动夜间与跟随系统表现一致 */
:global(:root[data-theme='dark'] .nt-apology-check.on),
:global(:root[data-theme='dark'] .nt-apology-preset-btn.on) {
  border-color: #e0645c;
  background: color-mix(in srgb, #e0645c 14%, var(--surface));
}

:global(:root[data-theme='dark'] .nt-apology-preset-btn.on) {
  color: #f38f88;
}

:global(:root[data-theme='dark'] .nt-apology-check.on .nt-apology-box) {
  border-color: #e0645c;
  background: #c8443c;
}

@media (prefers-color-scheme: dark) {
  :global(:root:not([data-theme='light']) .nt-apology-check.on),
  :global(:root:not([data-theme='light']) .nt-apology-preset-btn.on) {
    border-color: #e0645c;
    background: color-mix(in srgb, #e0645c 14%, var(--surface));
  }

  :global(:root:not([data-theme='light']) .nt-apology-preset-btn.on) {
    color: #f38f88;
  }

  :global(
    :root:not([data-theme='light']) .nt-apology-check.on .nt-apology-box
  ) {
    border-color: #e0645c;
    background: #c8443c;
  }
}

/* 窄屏与分屏：预览提前至顶部，表单收紧，并在表单底部附带快捷导出 */
@container number-tools (max-width: 820px) {
  .nt-apology-layout {
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;
  }

  .nt-apology-preview {
    position: static;
    order: -1;
  }

  .nt-apology-mobile-export {
    display: flex;
  }

  .nt-apology-mobile-export .btn.p {
    flex: 1 1 140px;
  }
}

@container number-tools (max-width: 520px) {
  .nt-apology-fields {
    grid-template-columns: minmax(0, 1fr);
  }
}

/* 触屏防 iOS 自动放大 */
@media (pointer: coarse) {
  .nt-apology-field input,
  .nt-apology-field textarea {
    font-size: 16px;
  }
}

/* 安卓横屏小窗（640×400 / 860×380）：压缩间距与预览高度，保留 34px 触控底线 */
@media (max-height: 600px) {
  .nt-apology {
    gap: 8px;
  }

  .nt-apology-card,
  .nt-apology-preview-card {
    padding: 9px 11px;
    gap: 7px;
  }

  .nt-apology-action,
  .nt-apology-export-btn,
  .nt-apology-mini,
  .nt-apology-check {
    min-height: 34px;
  }

  .nt-apology-stage {
    min-height: 160px;
    padding: 4px;
  }

  .nt-apology-poster {
    max-height: min(260px, calc(100dvh - 140px));
    width: auto;
    max-width: 100%;
    object-fit: contain;
  }

  .nt-apology-tip {
    display: none;
  }
}

/* 双分支减弱动效 */
@media (prefers-reduced-motion: reduce) {
  .nt-apology-field input,
  .nt-apology-field textarea,
  .nt-apology-preset-btn,
  .nt-apology-check,
  .nt-apology-stage {
    transition: none !important;
  }
}

:global(:root[data-motion='reduce'] .nt-apology-field input),
:global(:root[data-motion='reduce'] .nt-apology-field textarea),
:global(:root[data-motion='reduce'] .nt-apology-preset-btn),
:global(:root[data-motion='reduce'] .nt-apology-check),
:global(:root[data-motion='reduce'] .nt-apology-stage) {
  transition: none !important;
}
</style>
