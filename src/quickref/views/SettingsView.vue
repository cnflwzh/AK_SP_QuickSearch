<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  shallowRef,
  watch,
} from 'vue';
import {NUMBER_TOOLS, SEASON_META, REGISTERED_SEASON_IDS} from '../../../data/index.ts';
import LiveStatus from '../../lib/ui/LiveStatus.vue';
import {downloadBlob} from '../../lib/ui/download.ts';
import {layoutReport} from '../../lib/ui/layoutDiagnostics.ts';
import {
  CONTENT_TAB_IDS,
  CUSTOMIZABLE_TOOL_IDS,
  MAX_SETTINGS_BACKUP_BYTES,
  applySettings,
  parseSettingsBackup,
  resetAllSettings,
  resetContentTabs,
  serializeSettingsBackup,
  settings,
  toggleContentTabHidden,
  toggleToolHidden,
  updateSetting,
  visibleContentTabs,
  type CardDensity,
  type ContentTabId,
  type CustomizableToolId,
  type FontScale,
  type SettingsBackup,
  type ThemePreference,
} from '../../lib/settings/index.ts';
import {OWNABLE_OPERATORS} from '../../lib/box/model.ts';
import {
  prepareBoxImport,
  boxSeasonActivatedCount,
  boxSeasonBorrowedCount,
  boxSeasonCount,
  boxSeasonMaxedCount,
  boxStorageWriteFailed,
  exportOperatorBox,
} from '../../lib/box/store.ts';
import {PAGE_LABELS} from '../../router/location.ts';
import {navigate} from '../../router/navigation.ts';
import {plans, restorePlanBackup} from '../planStore.ts';
import {
  commitMirrorBackup,
  exportMirrorBackup,
  previewMirrorBackup,
} from '../mirrorBackupStore.ts';
import {useSortableTabs} from '../components/useSortableTabs.ts';
import {useMirrorBackup} from '../components/useMirrorBackup.ts';
import {
  mirrorReloadNotice,
  saveMirrorReloadNotice,
  type MirrorDirection,
  type MirrorPeer,
} from '../../lib/settings/mirrorSite.ts';
import {isNewOrigin} from '../../lib/settings/domainMigration.ts';
import {parseMigrationBackup} from '../../lib/settings/backup.ts';
import type {MigrationToolId} from '../../lib/settings/migrationTools.ts';
import SectionHeading from '../components/SectionHeading.vue';
import Segmented from '../components/Segmented.vue';
import SelectInput, {type SelectOption} from '../components/SelectInput.vue';
import ConfirmButton from '../components/ConfirmButton.vue';
import CopyButton from '../components/CopyButton.vue';
import {useClipboardCopy} from '../components/useClipboardCopy.ts';
import DeveloperDiagnostics from '../components/DeveloperDiagnostics.vue';
import ViewportBreakpointEditor from '../components/ViewportBreakpointEditor.vue';
import StatusNotice from '../components/StatusNotice.vue';
import '../workbench.css';

defineProps<{mirrorOnly?: boolean}>();
const {copyText, reset: resetCopy} = useClipboardCopy();

const THEME_OPTIONS: readonly {id: ThemePreference; label: string}[] = [
  {id: 'system', label: '跟随系统'},
  {id: 'light', label: '浅色模式'},
  {id: 'dark', label: '夜间模式'},
];
const debugOptions = [
  {
    key: 'debugLayoutDetails',
    title: '显示导航布局',
    hint: '在尺寸浮窗下显示当前导航布局和标题栏状态。',
  },
  {
    key: 'debugLayoutBounds',
    title: '标出布局边界',
    hint: '实线标记主要容器，虚线标记导航和抽屉内的区域。',
  },
] as const;
const DENSITY_OPTIONS: readonly {id: CardDensity; label: string}[] = [
  {id: 'auto', label: '自动（小窗紧凑）'},
  {id: 'comfortable', label: '标准舒适'},
  {id: 'compact', label: '全局紧凑'},
];
const FONT_OPTIONS: readonly {id: FontScale; label: string}[] = [
  {id: 'normal', label: '标准字号'},
  {id: 'large', label: '大字号'},
];

const MODULE_TOGGLES = [
  {
    key: 'showHeader',
    title: '顶部标题与教程入口',
  },
  {
    key: 'showTabCounts',
    title: '栏目名称旁显示总数角标（如 干员 142）',
  },
  {
    key: 'showRunBanner',
    title: '跨页面「本局」提示横幅',
  },
  {
    key: 'showWikiLinks',
    title: 'PRTS Wiki 跳转与分屏阅读',
  },
  {
    key: 'showRequestButtons',
    title: '联机求牌快捷短语按钮',
  },
  {
    key: 'showFooter',
    title: '页面底部来源与许可栏',
  },
] as const;

const HABIT_TOGGLES = [
  {
    key: 'collapsePresetBuilds',
    title: '在「切换流派」抽屉中折叠预设流派',
  },
  {
    key: 'defaultOperatorElite',
    title: '干员列表默认展示「精锐」词条',
  },
  {
    key: 'enableHoverPeek',
    title: '悬停 / 长按弹出速览小卡',
  },
  {
    key: 'enableSwipeTabs',
    title: '触屏左右滑动切换栏目',
  },
] as const;

const toolMap = new Map(NUMBER_TOOLS.map((tool) => [tool.id, tool.label]));
const customizableTools = CUSTOMIZABLE_TOOL_IDS.map((id) => ({
  id,
  label: toolMap.get(id) ?? id,
}));

const themeIndex = computed(() =>
  Math.max(
    0,
    THEME_OPTIONS.findIndex((item) => item.id === settings.theme),
  ),
);
const densityIndex = computed(() =>
  Math.max(
    0,
    DENSITY_OPTIONS.findIndex((item) => item.id === settings.cardDensity),
  ),
);
const fontIndex = computed(() =>
  Math.max(
    0,
    FONT_OPTIONS.findIndex((item) => item.id === settings.fontScale),
  ),
);
const visibleTabList = computed(() => visibleContentTabs());
const defaultTabOptions = computed<
  readonly SelectOption<'last' | ContentTabId>[]
>(() => [
  {value: 'last', label: '上次浏览的页面（默认）'},
  ...visibleTabList.value.map((tabId) => ({
    value: tabId,
    label: PAGE_LABELS[tabId],
  })),
]);
const isDefaultTabOrder = computed(
  () =>
    settings.hiddenTabs.length === 0 &&
    settings.defaultTab === 'last' &&
    settings.tabOrder.every((id, index) => id === CONTENT_TAB_IDS[index]),
);
const visibleToolCount = computed(
  () => CUSTOMIZABLE_TOOL_IDS.length - settings.hiddenTools.length,
);

const {
  displayedTabOrder, draggedTab, droppingTab, nudgedTab,
  setSlotRef, onRowPointerDown, handleMoveTab,
} = useSortableTabs();

/* ---------- 导入导出与重置 ---------- */
const fileInput = ref<HTMLInputElement>();
const includePlansInExport = ref(plans.length > 0);

function openBoxTool(): void {
  void navigate({path: '/box'});
}
// 空 Box 会由序列化器省略，恢复备份后也能立即携带新练度导出。
const includeBoxInExport = ref(true);
const importPlansFromBackup = ref(true);
const importBoxFromBackup = ref(true);
const importPageSettings = ref(true);
const importTools = ref<MigrationToolId[]>([]);
// 旧版文件还用于普通整站恢复。仅在玩家明确选择迁移时才提取其中的跨季数据。
const migrateLegacyFile = ref(false);
type SeasonArchive = NonNullable<SettingsBackup['archive']>;
const lastSeasonArchive = shallowRef<SeasonArchive | null>(null);
const mirrorPreview = shallowRef<ReturnType<typeof previewMirrorBackup> | null>(
  null,
);
const mirrorSection = ref<HTMLElement>();
const previewSection = ref<HTMLElement>();
const showPasteBox = ref(false);
const pasteText = ref('');
const exportTextFallback = ref('');
const readingFile = ref(false);
const pendingBackup = shallowRef<SettingsBackup | null>(null);
const pendingSourceName = ref('');
const errorMessage = ref('');
const statusMessage = ref(mirrorReloadNotice);
let readRequest = 0;

const mirrorChanges = computed(() => mirrorPreview.value?.changes);

const {
  peer,
  migration,
  busy: mirrorBusy,
  activeHere: mirrorActiveHere,
  message: mirrorMessage,
  failed: mirrorFailed,
  recovery: mirrorRecovery,
  start: openMirror,
  cancel: cancelMirror,
} = useMirrorBackup(exportMirrorBackup, receiveMirrorBackup);
const mirrorTargets = [migration, peer].filter(
  (target): target is MirrorPeer => !!target,
);
const newSite = !!migration && isNewOrigin(location.origin);
const mirrorDirections: readonly MirrorDirection[] = ['send', 'fetch'];
// 旧网址退役后仍可响应取回，但不能再接收新站的存档。
const migrationDirections: readonly MirrorDirection[] = [newSite ? 'fetch' : 'send'];

watch(
  mirrorRecovery,
  (action) => {
    if (action) mirrorSection.value?.focus();
  },
  {flush: 'post'},
);

function startMirror(direction: MirrorDirection, target: MirrorPeer | null) {
  if (!target) return;
  clearNotices();
  openMirror(direction, target);
}

function prepareMirrorPreview(backup: SettingsBackup, sourceName: string) {
  const preview = previewMirrorBackup(backup);
  pendingBackup.value = backup;
  pendingSourceName.value = sourceName;
  mirrorPreview.value = preview;
  const {changes} = preview;
  importPageSettings.value = changes.settings > 0 && !changes.incomingDefault;
  importPlansFromBackup.value = changes.plans > 0;
  importBoxFromBackup.value = changes.newOperators + changes.upgrades > 0;
  importTools.value = changes.tools
    .filter((group) => group.changed && !group.existing)
    .map((group) => group.id);
  return changes;
}

function receiveMirrorBackup(
  text: string,
  source: MirrorPeer,
  sourceSeason?: string,
): void {
  if (pendingBackup.value || readingFile.value)
    throw new Error('接收页还有待处理的配置，请先完成或取消，再重试。');
  clearNotices();
  const migrating = source.origin === migration?.origin;
  const backup = migrating
    ? parseMigrationBackup(text)
    : parseSettingsBackup(text);
  if (migrating && sourceSeason && backup.season !== sourceSeason)
    throw new Error('备份来源赛季与发送页声明的赛季不一致，请在来源站重新导出。');
  if (!migrating && (backup.tools || backup.archive))
    throw new Error('请使用同地区的新旧网址交接迁移备份。');
  const changes = prepareMirrorPreview(backup, source.name);
  // 跨季原始备份含有不会写入本站的数据。即使目标全空或没有差异，也留给玩家确认和下载。
  if (
    !backup.archive &&
    !changes.settings &&
    !changes.plans &&
    !changes.newOperators &&
    !changes.upgrades &&
    !changes.tools.some((group) => group.changed)
  ) {
    cancelImportPreview();
    statusMessage.value = '本站已包含这份存档的全部内容。';
  } else if (!backup.archive && changes.empty) {
    confirmImportBackup();
    if (errorMessage.value) throw new Error(errorMessage.value);
  }
  void nextTick(() =>
    (previewSection.value ?? mirrorSection.value)?.focus({
      preventScroll: false,
    }),
  );
}

onBeforeUnmount(() => {
  readRequest++;
});

const previewExportedAt = computed(() =>
  pendingBackup.value
    ? new Date(pendingBackup.value.exportedAt).toLocaleString('zh-CN')
    : '',
);
const previewSummary = computed(() => {
  if (!pendingBackup.value) return '';
  const target = pendingBackup.value.settings;
  const themeLabel =
    THEME_OPTIONS.find((item) => item.id === target.theme)?.label ??
    target.theme;
  const densityLabel =
    DENSITY_OPTIONS.find((item) => item.id === target.cardDensity)?.label ??
    target.cardDensity;
  const parts = [themeLabel, densityLabel];
  if (target.hiddenTabs.length) {
    parts.push(`隐藏 ${target.hiddenTabs.length} 个栏目`);
  }
  if (target.hiddenTools.length) {
    parts.push(`隐藏 ${target.hiddenTools.length} 个子工具`);
  }
  if (target.collapsePresetBuilds) {
    parts.push('折叠预设流派');
  }
  if (pendingBackup.value.plans?.length) {
    parts.push(`附带 ${pendingBackup.value.plans.length} 套流派`);
  }
  const boxCount = pendingBackup.value.box
    ? Object.keys(pendingBackup.value.box).length
    : 0;
  if (boxCount > 0) {
    parts.push(`附带 ${boxCount} 名干员练度`);
  }
  return parts.join(' · ');
});

function clearNotices(): void {
  resetCopy();
  errorMessage.value = '';
  statusMessage.value = '';
  mirrorMessage.value = '';
  mirrorRecovery.value = null;
  exportTextFallback.value = '';
}

function exportSettingsFile(): void {
  clearNotices();
  try {
    const bundled = includePlansInExport.value ? plans : undefined;
    const bundledBox = includeBoxInExport.value
      ? exportOperatorBox()
      : undefined;
    const json = serializeSettingsBackup(settings, bundled, bundledBox);
    const now = new Date();
    const date = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-');
    downloadBlob(
      new Blob([json], {type: 'application/json;charset=utf-8'}),
      `卫戍速查-配置备份-${date}.json`,
    );
    const extras: string[] = [];
    if (bundled?.length) extras.push(`${bundled.length} 套流派`);
    if (bundledBox && Object.keys(bundledBox).length) {
      extras.push(`${Object.keys(bundledBox).length} 名干员练度`);
    }
    statusMessage.value = extras.length
      ? `已导出配置文件（附带 ${extras.join('、')}）。`
      : '已导出配置文件。';
  } catch (cause) {
    errorMessage.value =
      cause instanceof Error ? cause.message : '配置导出失败，请重试。';
  }
}

function downloadMigrationBackup(): void {
  clearNotices();
  try {
    const text = exportMirrorBackup(true);
    downloadBlob(
      new Blob([text], {type: 'application/json;charset=utf-8'}),
      '卫戍速查-迁移备份.json',
    );
    statusMessage.value = '已导出迁移备份，可在接收站点「选择文件导入」恢复。';
  } catch (cause) {
    errorMessage.value =
      cause instanceof Error ? cause.message : '迁移备份导出失败。';
  }
}

function downloadSourceArchive(archive: SeasonArchive): void {
  try {
    downloadBlob(
      new Blob([archive.text], {type: 'application/json;charset=utf-8'}),
      `卫戍速查-${archive.season}-来源原始备份.json`,
    );
  } catch (cause) {
    errorMessage.value = cause instanceof Error ? cause.message : '原始备份下载失败。';
  }
}

function skippedSeasonItems(archive: SeasonArchive): string {
  const items = [];
  if (archive.plans) items.push(`${archive.plans} 套流派`);
  if (archive.borrowed) items.push(`${archive.borrowed} 名助战`);
  if (archive.otherBox) items.push(`${archive.otherBox} 名本站无法识别的自持练度`);
  if (archive.mistakes) items.push(`${archive.mistakes} 条错题`);
  if (archive.recent) items.push(`${archive.recent} 条最近查看记录`);
  return items.length
    ? `本次跳过${items.join('、')}。这些内容留在原赛季，可下载原始备份。`
    : '这份备份中没有需要跳过的赛季专属内容。';
}

async function copySettingsText(): Promise<void> {
  clearNotices();
  try {
    const bundled = includePlansInExport.value ? plans : undefined;
    const bundledBox = includeBoxInExport.value
      ? exportOperatorBox()
      : undefined;
    const json = serializeSettingsBackup(settings, bundled, bundledBox);
    const outcome = await copyText(json);
    if (outcome === 'superseded') return;
    if (outcome === 'copied') {
      const extras: string[] = [];
      if (bundled?.length) extras.push(`${bundled.length} 套流派`);
      if (bundledBox && Object.keys(bundledBox).length) {
        extras.push(`${Object.keys(bundledBox).length} 名干员练度`);
      }
      statusMessage.value = extras.length
        ? `已复制配置文本（含 ${extras.join('、')}），可在其他设备粘贴导入。`
        : '已复制配置文本，可在其他设备粘贴导入。';
    } else {
      exportTextFallback.value = json;
      statusMessage.value =
        '浏览器未授予剪贴板权限，请手动全选下方配置文本复制。';
    }
  } catch (cause) {
    errorMessage.value =
      cause instanceof Error ? cause.message : '配置序列化失败，请重试。';
  }
}

function loadBackupText(text: string, sourceLabel: string): void {
  const backup = migrateLegacyFile.value
    ? parseMigrationBackup(text)
    : parseSettingsBackup(text);
  if (backup.tools || backup.archive || migrateLegacyFile.value) {
    prepareMirrorPreview(backup, sourceLabel);
    return;
  }
  pendingBackup.value = backup;
  mirrorPreview.value = null;
  importPageSettings.value = true;
  pendingSourceName.value = sourceLabel;
  importPlansFromBackup.value = (pendingBackup.value.plans?.length ?? 0) > 0;
  importBoxFromBackup.value =
    Object.keys(pendingBackup.value.box ?? {}).length > 0;
}

async function onSelectFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  const request = ++readRequest;
  clearNotices();
  pendingBackup.value = null;
  readingFile.value = true;
  try {
    if (file.size > MAX_SETTINGS_BACKUP_BYTES) {
      throw new Error('配置文件超过 5 MB，请选择正确的配置备份文件。');
    }
    // 保留原始 UTF-8 BOM，跨季下载可还原玩家选择的备份。
    const text = new TextDecoder('utf-8', {ignoreBOM: true, fatal: true})
      .decode(await file.arrayBuffer());
    if (request !== readRequest) return;
    loadBackupText(text, file.name);
  } catch (cause) {
    if (request === readRequest) {
      errorMessage.value =
        cause instanceof Error ? cause.message : '文件读取失败，请重试。';
    }
  } finally {
    if (request === readRequest) readingFile.value = false;
  }
}

function parsePastedBackup(): void {
  // 粘贴的新配置取代尚未完成的文件读取，旧请求不得覆盖当前预览。
  readRequest++;
  readingFile.value = false;
  clearNotices();
  pendingBackup.value = null;
  if (!pasteText.value.trim()) {
    errorMessage.value = '请先粘贴导出的配置 JSON 文本。';
    return;
  }
  try {
    loadBackupText(pasteText.value, '剪贴板文本');
  } catch (cause) {
    errorMessage.value =
      cause instanceof Error ? cause.message : '配置解析失败，请检查粘贴内容。';
  }
}

function confirmImportBackup(): void {
  if (!pendingBackup.value) return;
  clearNotices();
  try {
    const incomingPlans = pendingBackup.value.plans;
    const incomingBox = importBoxFromBackup.value
      ? pendingBackup.value.box
      : undefined;
    const messages: string[] = [];
    let merged;
    let restoredTools = false;
    if (mirrorPreview.value) {
      merged = commitMirrorBackup(mirrorPreview.value, pendingBackup.value, {
        settings: importPageSettings.value,
        plans: importPlansFromBackup.value,
        box: importBoxFromBackup.value,
        tools: importTools.value,
      });
      if (importTools.value.length) {
        restoredTools = true;
        const labels = mirrorPreview.value.changes.tools
          .filter((group) => importTools.value.includes(group.id))
          .map((group) => group.label);
        messages.push('已恢复' + labels.join('、'));
      }
    } else {
      const commitBox = incomingBox ? prepareBoxImport(incomingBox) : undefined;
      if (importPlansFromBackup.value && incomingPlans?.length)
        merged = restorePlanBackup(incomingPlans);
      commitBox?.();
      const savedSettings =
        !importPageSettings.value ||
        applySettings(pendingBackup.value.settings);
      if (!savedSettings || (commitBox && boxStorageWriteFailed.value)) {
        errorMessage.value =
          '当前页面已应用所选内容，但本机存储写入失败。请保持页面打开，导出配置或释放空间后重试。';
        return;
      }
    }
    if (merged) {
      messages.push(`新增流派 ${merged.additions.length} 套`);
      if (merged.skipped) messages.push(`跳过重复 ${merged.skipped} 套`);
      if (merged.conflicts)
        messages.push(`冲突保留副本 ${merged.conflicts} 套`);
    }
    if (incomingBox) {
      messages.push(`合并 ${Object.keys(incomingBox).length} 名干员练度`);
    }
    if (importPageSettings.value) messages.unshift('已应用页面设置');
    statusMessage.value = messages.length
      ? messages.join('，') + '。'
      : '已保留本站存档。';
    if (pendingBackup.value.archive) {
      lastSeasonArchive.value = pendingBackup.value.archive;
    }
    pendingBackup.value = null;
    pendingSourceName.value = '';
    mirrorPreview.value = null;
    pasteText.value = '';
    showPasteBox.value = false;
    if (restoredTools) {
      saveMirrorReloadNotice(statusMessage.value);
      // 浏览器先排入跨窗口回执，再让错题本和最近查看重新读取已恢复的记录。
      window.setTimeout(() => location.reload(), 0);
    }
  } catch (cause) {
    errorMessage.value =
      cause instanceof Error ? cause.message : '导入应用失败，请重试。';
  }
}

function cancelImportPreview(): void {
  readRequest++;
  readingFile.value = false;
  pendingBackup.value = null;
  pendingSourceName.value = '';
  mirrorPreview.value = null;
}

function handleToggleTool(id: CustomizableToolId): void {
  clearNotices();
  if (!toggleToolHidden(id)) {
    errorMessage.value = '至少需要保留 1 个小工具子栏目显示。';
  }
}

function handleToggleTab(id: ContentTabId): void {
  clearNotices();
  if (!toggleContentTabHidden(id)) {
    errorMessage.value = '顶部至少需要保留 1 个可见栏目。';
  }
}

function handleResetAll(): void {
  clearNotices();
  resetAllSettings();
  statusMessage.value =
    '已恢复全部默认设置（自建流派与本局记录保留不受影响）。';
}
</script>

<template>
  <div class="settings-view workbench-controls">
    <div class="settings-grid">
      <section v-if="!mirrorOnly" class="panel settings-card" aria-labelledby="set-appearance">
        <header class="settings-card-head">
          <div>
            <span class="settings-kicker">DISPLAY</span>
            <h2 id="set-appearance">外观与排版</h2>
          </div>
        </header>

        <div class="settings-rows">
          <div class="settings-row">
            <div class="settings-row-info">
              <b>主题模式</b>
            </div>
            <Segmented
              :labels="THEME_OPTIONS.map((item) => item.label)"
              :active="themeIndex"
              attr="set-theme"
              @change="updateSetting('theme', THEME_OPTIONS[$event].id)" />
          </div>

          <div class="settings-row">
            <div class="settings-row-info">
              <b>卡片排版密度</b>
            </div>
            <Segmented
              :labels="DENSITY_OPTIONS.map((item) => item.label)"
              :active="densityIndex"
              attr="set-density"
              @change="
                updateSetting('cardDensity', DENSITY_OPTIONS[$event].id)
              " />
          </div>

          <div class="settings-row">
            <div class="settings-row-info">
              <b>界面文字大小</b>
            </div>
            <Segmented
              :labels="FONT_OPTIONS.map((item) => item.label)"
              :active="fontIndex"
              attr="set-font"
              @change="updateSetting('fontScale', FONT_OPTIONS[$event].id)" />
          </div>

          <label class="settings-toggle-row">
            <span class="settings-row-info">
              <b>减弱动画与滑动过渡</b>
            </span>
            <input
              type="checkbox"
              class="settings-switch"
              :checked="settings.reducedMotion"
              @change="
                updateSetting(
                  'reducedMotion',
                  ($event.target as HTMLInputElement).checked,
                )
              " />
          </label>
        </div>
      </section>

      <section v-if="!mirrorOnly" class="panel settings-card" aria-labelledby="set-habits">
        <header class="settings-card-head">
          <div>
            <span class="settings-kicker">PREFERENCES</span>
            <h2 id="set-habits">速查与交互习惯</h2>
          </div>
        </header>

        <div class="settings-rows">
          <label class="settings-row settings-select-line">
            <span class="settings-row-info">
              <b>打开网站默认进入</b>
            </span>
            <SelectInput
              aria-label="打开网站默认进入"
              :model-value="settings.defaultTab"
              :options="defaultTabOptions"
              @update:model-value="updateSetting('defaultTab', $event)" />
          </label>

          <label
            v-for="item in HABIT_TOGGLES"
            :key="item.key"
            class="settings-toggle-row">
            <span class="settings-row-info">
              <b>{{ item.title }}</b>
            </span>
            <input
              type="checkbox"
              class="settings-switch"
              :checked="settings[item.key]"
              @change="
                updateSetting(
                  item.key,
                  ($event.target as HTMLInputElement).checked,
                )
              " />
          </label>
        </div>
      </section>

      <section v-if="!mirrorOnly" class="panel settings-card" aria-labelledby="set-modules">
        <header class="settings-card-head">
          <div>
            <span class="settings-kicker">MODULES</span>
            <h2 id="set-modules">页面展示模块</h2>
          </div>
        </header>

        <div class="settings-rows">
          <label
            v-for="item in MODULE_TOGGLES"
            :key="item.key"
            class="settings-toggle-row">
            <span class="settings-row-info">
              <b>{{ item.title }}</b>
            </span>
            <input
              type="checkbox"
              class="settings-switch"
              :checked="settings[item.key]"
              @change="
                updateSetting(
                  item.key,
                  ($event.target as HTMLInputElement).checked,
                )
              " />
          </label>
        </div>
      </section>

      <section v-if="!mirrorOnly" class="panel settings-card" aria-labelledby="set-tools">
        <header class="settings-card-head">
          <div>
            <span class="settings-kicker">TOOLS</span>
            <h2 id="set-tools">小工具栏目与练度</h2>
          </div>
          <span class="tag">
            已开 {{ visibleToolCount }}/{{ CUSTOMIZABLE_TOOL_IDS.length }}
          </span>
        </header>

        <div class="settings-rows">
          <div class="settings-subblock top">
            <div class="settings-row-info">
              <b>「小工具」内展示的子栏目</b>
              <small>点击切换显隐，至少保留 1 个</small>
            </div>
            <div
              class="settings-tool-pills"
              role="group"
              aria-label="小工具子栏目">
              <button
                v-for="tool in customizableTools"
                :key="tool.id"
                type="button"
                :class="[
                  'settings-tool-pill',
                  {on: !settings.hiddenTools.includes(tool.id)},
                ]"
                :aria-pressed="!settings.hiddenTools.includes(tool.id)"
                :disabled="
                  !settings.hiddenTools.includes(tool.id) &&
                  visibleToolCount <= 1
                "
                @click="handleToggleTool(tool.id)">
                {{
                  settings.hiddenTools.includes(tool.id)
                    ? `+ ${tool.label}`
                    : `✓ ${tool.label}`
                }}
              </button>
            </div>
          </div>

          <div class="settings-box-shortcut">
            <div class="settings-row-info">
              <b>干员练度与自持加成</b>
              <small>
                自持 {{ boxSeasonCount }}/{{ OWNABLE_OPERATORS.length }} 名 ·
                已激活 {{ boxSeasonActivatedCount }} 名 · 满加成
                {{ boxSeasonMaxedCount }} 名
                <template v-if="boxSeasonBorrowedCount">
                  · 助战已借 {{ boxSeasonBorrowedCount }} 名
                </template>
              </small>
            </div>
            <button type="button" class="btn p" @click="openBoxTool">
              打开干员练度 →
            </button>
          </div>
        </div>
      </section>

      <section v-if="!mirrorOnly" class="panel settings-card" aria-labelledby="set-tabs">
        <header class="settings-card-head">
          <div>
            <span class="settings-kicker">NAVIGATION</span>
            <h2 id="set-tabs">顶部 Tab 排列与显隐</h2>
          </div>
          <ConfirmButton
            label="恢复默认栏目"
            confirm-label="确认恢复"
            title="恢复栏目顺序、显隐和默认首页"
            :disabled="isDefaultTabOrder"
            @confirm="resetContentTabs" />
        </header>

        <TransitionGroup
          tag="ul"
          name="tab-sort"
          :class="['settings-tab-list', {'is-sorting': draggedTab !== null}]"
          aria-label="栏目顺序与显隐设置">
          <li
            v-for="(tabId, index) in displayedTabOrder"
            :key="tabId"
            :ref="(el) => setSlotRef(tabId, el)"
            :class="[
              'settings-tab-slot',
              {
                'is-dragging': draggedTab === tabId,
                'is-dropping': droppingTab === tabId,
                'is-nudged': nudgedTab === tabId,
              },
            ]">
            <div
              :class="[
                'settings-tab-item',
                {
                  hidden: settings.hiddenTabs.includes(tabId),
                  dragging: draggedTab === tabId,
                  dropping: droppingTab === tabId,
                },
              ]"
              @pointerdown="onRowPointerDown(tabId, $event)">
              <span
                class="settings-drag-grip"
                aria-hidden="true"
                title="上下拖拽调整顺序">
                ⋮⋮
              </span>
              <span class="settings-tab-idx" aria-hidden="true">
                {{ index + 1 }}
              </span>
              <span class="settings-tab-name">{{ PAGE_LABELS[tabId] }}</span>
              <div class="settings-tab-btns">
                <button
                  type="button"
                  class="btn settings-step-btn"
                  :disabled="index === 0"
                  :aria-label="`将${PAGE_LABELS[tabId]}向前移动一位`"
                  @click="handleMoveTab(tabId, -1)">
                  ↑
                </button>
                <button
                  type="button"
                  class="btn settings-step-btn"
                  :disabled="index === displayedTabOrder.length - 1"
                  :aria-label="`将${PAGE_LABELS[tabId]}向后移动一位`"
                  @click="handleMoveTab(tabId, 1)">
                  ↓
                </button>
                <button
                  type="button"
                  :class="[
                    'btn',
                    'settings-vis-btn',
                    {off: settings.hiddenTabs.includes(tabId)},
                  ]"
                  :aria-pressed="!settings.hiddenTabs.includes(tabId)"
                  :disabled="
                    !settings.hiddenTabs.includes(tabId) &&
                    visibleTabList.length <= 1
                  "
                  @click="handleToggleTab(tabId)">
                  {{
                    settings.hiddenTabs.includes(tabId) ? '已隐藏' : '显示中'
                  }}
                </button>
              </div>
            </div>
          </li>
        </TransitionGroup>
      </section>

      <section class="panel settings-card" :class="{'mirror-only': mirrorOnly, 'new-site-backup': newSite}"
        :aria-label="mirrorOnly ? '存档交接' : undefined"
        :aria-labelledby="mirrorOnly ? undefined : 'set-backup'">
        <header v-if="!mirrorOnly" class="settings-card-head">
          <div>
            <span class="settings-kicker">BACKUP & RESET</span>
            <h2 id="set-backup">配置备份、导入与重置</h2>
          </div>
        </header>

        <div class="settings-backup-grid">
          <div class="settings-rows">
            <div v-if="!mirrorOnly || mirrorFailed" class="settings-backup-checks">
              <label class="settings-inline-check">
                <input v-model="includePlansInExport" type="checkbox" />
                <span>
                  导出时附带「我的流派 / 已修改预设」（{{ plans.length }} 套）
                </span>
              </label>
              <label class="settings-inline-check">
                <input v-model="includeBoxInExport" type="checkbox" />
                <span>
                  导出时附带「干员练度 Box」（自持 {{ boxSeasonCount }} 名
                  <template v-if="boxSeasonBorrowedCount">
                    · 已借 {{ boxSeasonBorrowedCount }} 名
                  </template>
                  ）
                </span>
              </label>
            </div>

            <label v-if="migration" class="settings-inline-check">
              <input v-model="migrateLegacyFile" type="checkbox" />
              <span>按域名迁移导入旧版备份（v1–v4 可跨赛季提取设置和自持练度）</span>
            </label>
            <div v-if="!mirrorOnly || mirrorFailed || migration" class="settings-btn-group">
              <button type="button" class="btn p" @click="exportSettingsFile">
                导出配置文件 (.json)
              </button>
              <button type="button" class="btn" @click="copySettingsText">
                复制配置文本
              </button>
              <button type="button" class="btn" @click="fileInput?.click()">
                选择文件导入
              </button>
              <button
                type="button"
                :class="['btn', {on: showPasteBox}]"
                :aria-expanded="showPasteBox"
                @click="showPasteBox = !showPasteBox">
                粘贴文本导入
              </button>
              <input
                ref="fileInput"
                type="file"
                accept=".json,application/json"
                hidden
                @change="onSelectFile" />
            </div>

            <div v-if="exportTextFallback" class="settings-box">
              <p class="settings-box-note">全选并复制配置文本</p>
              <textarea
                class="settings-textarea"
                readonly
                aria-label="配置导出文本"
                :value="exportTextFallback"
                @focus="
                  ($event.target as HTMLTextAreaElement).select()
                "></textarea>
            </div>

            <div v-if="showPasteBox" class="settings-box">
              <textarea
                v-model="pasteText"
                class="settings-textarea"
                aria-label="粘贴配置备份文本"
                placeholder="在此粘贴从其他设备复制的 JSON 配置文本…"></textarea>
              <div class="settings-btn-group">
                <button type="button" class="btn p" @click="parsePastedBackup">
                  解析配置
                </button>
                <button
                  type="button"
                  class="btn"
                  @click="
                    showPasteBox = false;
                    pasteText = '';
                  ">
                  收起
                </button>
              </div>
            </div>

            <p v-if="readingFile" class="settings-note" role="status">
              正在读取配置文件…
            </p>

            <section
              ref="mirrorSection"
              class="settings-box mirror-backup"
              tabindex="-1"
              aria-label="站点间存档交接">
              <SectionHeading
                title="站点间存档交接"
                badge="实验功能"
                variant="plain" />
              <template v-if="peer">
                <p v-if="migration" class="settings-box-note">
                  两个页面需保持打开。跨赛季可以带走界面设置和可按干员标识识别的自持练度。
                </p>
                <p v-else class="settings-box-note">
                  在本浏览器的两个站点之间传递界面设置、干员练度 Box 和流派。切换或取回时会打开{{ peer.name }}，请保持两页打开直到传输完成。
                </p>
                <div v-for="target in mirrorTargets" :key="target.origin">
                  <p v-if="migration" class="settings-box-note">
                    {{ target.name }}（{{ target.origin.split('://')[1] }}） ·
                    {{ target === migration ? '同赛季还可迁移流派、助战、错题本和最近查看' : '设置、Box 和流派' }}
                  </p>
                  <div class="settings-btn-group">
                    <template
                      v-for="direction in target === migration ? migrationDirections : mirrorDirections"
                      :key="direction">
                      <button
                        v-if="direction !== 'fetch' || mirrorRecovery?.origin !== target.origin"
                        type="button"
                        class="btn"
                        :class="{p: direction === 'fetch' && target === migration && newSite}"
                        :disabled="mirrorBusy || !!pendingBackup || readingFile"
                        @click="startMirror(direction, target)">
                        {{ direction === 'fetch' ? '从' + target.name + '取回存档' : '携带存档切换到' + target.name }}
                      </button>
                    </template>
                    <button
                      v-if="target === migration && !newSite"
                      type="button"
                      class="btn"
                      @click="downloadMigrationBackup">
                      下载迁移备份
                    </button>
                  </div>
                </div>
                <div v-if="mirrorActiveHere" class="settings-btn-group">
                  <button type="button" class="btn" @click="cancelMirror">取消交接</button>
                </div>
              </template>
              <p v-else class="settings-box-note">
                请在主站或大陆镜像的独立页面中使用。
              </p>
              <StatusNotice
                v-if="mirrorRecovery"
                tone="warning">
                <span class="mirror-recovery">
                  <span>{{ mirrorMessage }}</span>
                  <button
                    type="button"
                    class="btn p"
                    :disabled="mirrorBusy || !!pendingBackup || readingFile"
                    @click="startMirror('fetch', mirrorRecovery)">
                    从{{ mirrorRecovery.name }}取回存档
                  </button>
                  <span class="settings-box-note">
                    若仍无法连接，请在{{ mirrorRecovery.name }}点「{{
                      mirrorRecovery.origin === migration?.origin ? '下载迁移备份' : '导出配置文件 (.json)'
                    }}」，再回这里点「选择文件导入」。
                  </span>
                </span>
              </StatusNotice>
              <StatusNotice
                v-else-if="mirrorMessage && mirrorMessage !== errorMessage"
                :tone="mirrorFailed ? 'warning' : 'info'"
                :message="mirrorMessage" />
            </section>

            <div
              v-if="pendingBackup"
              ref="previewSection"
              class="settings-box settings-preview"
              tabindex="-1">
              <b>即将应用来自「{{ pendingSourceName }}」的配置</b>
              <small>导出时间：{{ previewExportedAt }}</small>
              <div v-if="pendingBackup.archive" class="season-archive">
                <b>跨赛季迁移 · 来源 {{ pendingBackup.archive.season.toUpperCase() }} → 本站 {{ SEASON_META.id.toUpperCase() }}</b>
                <p>本次可应用界面设置，并合并可按干员标识识别的自持练度。</p>
                <p>{{ skippedSeasonItems(pendingBackup.archive) }}</p>
                <div class="settings-btn-group">
                  <button type="button" class="btn" @click="downloadSourceArchive(pendingBackup.archive)">下载来源原始备份</button>
                </div>
              </div>
              <small v-else-if="pendingBackup.tools && pendingBackup.season">
                来源 {{ pendingBackup.season.toUpperCase() }} · 本站 {{ SEASON_META.id.toUpperCase() }}
              </small>
              <p class="settings-preview-summary">{{ previewSummary }}</p>
              <template v-if="mirrorChanges">
                <p class="settings-note">
                  与本站比较：{{ mirrorChanges.settings }} 项设置不同；流派新增
                  {{ mirrorChanges.plans }} 套（含
                  {{ mirrorChanges.conflicts }} 套冲突副本）；Box 新增
                  {{ mirrorChanges.newOperators }} 名、提高练度
                  {{ mirrorChanges.upgrades }} 名。
                </p>
                <label
                  v-if="mirrorChanges.settings"
                  class="settings-inline-check">
                  <input v-model="importPageSettings" type="checkbox" />
                  <span>采用{{ pendingSourceName }}的界面设置</span>
                </label>
              </template>
              <label
                v-if="pendingBackup.plans?.length"
                class="settings-inline-check">
                <input v-model="importPlansFromBackup" type="checkbox" />
                <span>
                  同时合并恢复附带的
                  {{ pendingBackup.plans.length }} 套流派（不覆盖现有内容）
                </span>
              </label>
              <label
                v-if="
                  pendingBackup.box && Object.keys(pendingBackup.box).length
                "
                class="settings-inline-check">
                <input v-model="importBoxFromBackup" type="checkbox" />
                <span>
                  同时合并附带的
                  {{ Object.keys(pendingBackup.box).length }} 名干员练度
                  Box（同一干员保留较高自持练度）
                </span>
              </label>
              <label
                v-for="group in mirrorChanges?.tools.filter((item) => item.changed)"
                :key="group.id"
                class="settings-inline-check">
                <input v-model="importTools" type="checkbox" :value="group.id" />
                <span>
                  采用来源的{{ group.label }}（{{ group.incoming }} 条）<template v-if="group.existing">，替换本站此组 {{ group.existing }} 条记录</template>
                </span>
              </label>
              <div class="settings-btn-group">
                <button
                  type="button"
                  class="btn p"
                  @click="confirmImportBackup">
                  {{ mirrorPreview ? '确认合并所选内容' : '确认应用设置' }}
                </button>
                <button type="button" class="btn" @click="cancelImportPreview">
                  取消
                </button>
              </div>
            </div>

            <StatusNotice
              v-if="errorMessage"
              tone="danger"
              :message="errorMessage" />
            <StatusNotice
              v-if="statusMessage"
              tone="success"
              :message="statusMessage" />
            <div v-if="lastSeasonArchive && !pendingBackup" class="settings-box season-archive">
              <b>已确认跨赛季迁移 · 来源 {{ lastSeasonArchive.season.toUpperCase() }} → 本站 {{ SEASON_META.id.toUpperCase() }}</b>
              <p>{{ skippedSeasonItems(lastSeasonArchive) }}</p>
              <p>离开或刷新本页前可下载原始备份，留待对应赛季恢复。</p>
              <div class="settings-btn-group">
                <button type="button" class="btn" @click="downloadSourceArchive(lastSeasonArchive)">下载来源原始备份</button>
              </div>
            </div>
          </div>

          <div v-if="!mirrorOnly" class="settings-reset-card">
            <div class="settings-row-info">
              <b>恢复默认界面设置</b>
              <small>
                仅重置主题、排版密度、开关与栏目顺序，不会删除你的自建流派、干员练度和本局记录。
              </small>
            </div>
            <ConfirmButton
              label="恢复全部默认设置"
              confirm-label="确认恢复默认"
              @confirm="handleResetAll" />
          </div>
        </div>
      </section>

      <section
        v-if="!mirrorOnly"
        class="panel settings-card settings-card-wide settings-season-card"
        aria-labelledby="set-season">
        <div class="settings-season-meta">
          <h2 id="set-season" class="settings-season-title">赛季数据</h2>
          <span class="tag">{{ SEASON_META.id.toUpperCase() }}</span>
          <span>
            <b>{{ SEASON_META.title }}</b>
            <small>（{{ SEASON_META.guideSubtitle }}）</small>
          </span>
          <span class="settings-season-ver">
            规则基线：{{ SEASON_META.ruleVersion }} · 已注册
            {{ REGISTERED_SEASON_IDS.length }} 个赛季
          </span>
          <a
            v-if="SEASON_META.ruleSource"
            class="btn"
            :href="SEASON_META.ruleSource"
            target="_blank"
            rel="noopener noreferrer">
            数据源 ↗
          </a>
        </div>
      </section>
      <section
        v-if="!mirrorOnly"
        class="panel settings-card settings-card-wide"
        aria-labelledby="set-developer">
        <header class="settings-card-head">
          <h2 id="set-developer">开发者设置</h2>
          <CopyButton
            v-if="settings.developerMode"
            :text="layoutReport"
            label="复制布局诊断"
            copied-label="已复制诊断" />
        </header>
        <div class="settings-rows">
          <label class="settings-toggle-row">
            <span class="settings-row-info">
              <b>开发者模式</b>
              <small>显示实时窗口尺寸，查看浏览器、PWA、缓存和错误诊断。</small>
            </span>
            <input
              type="checkbox"
              class="settings-switch"
              :checked="settings.developerMode"
              @change="
                updateSetting(
                  'developerMode',
                  ($event.target as HTMLInputElement).checked,
                )
              " />
          </label>
          <template v-if="settings.developerMode">
            <label
              v-for="item in debugOptions"
              :key="item.key"
              class="settings-toggle-row">
              <span class="settings-row-info">
                <b>{{ item.title }}</b>
                <small>{{ item.hint }}</small>
              </span>
              <input
                type="checkbox"
                class="settings-switch"
                :checked="settings[item.key]"
                @change="
                  updateSetting(
                    item.key,
                    ($event.target as HTMLInputElement).checked,
                  )
                " />
            </label>
          </template>
        </div>
        <template v-if="settings.developerMode">
          <DeveloperDiagnostics />
          <ViewportBreakpointEditor />
        </template>
      </section>
    </div>
    <LiveStatus :message="statusMessage || errorMessage" />
  </div>
</template>

<style scoped>
.settings-view {
  min-width: 0;
}
.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  align-items: stretch;
}
.settings-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
}
.settings-card-wide {
  grid-column: 1 / -1;
}
.mirror-only {
  grid-column: 1 / -1;
}
.new-site-backup {
  order: -1;
}
.mirror-only .settings-backup-grid {
  grid-template-columns: minmax(0, 1fr);
}
.settings-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--line);
}
.settings-kicker {
  display: block;
  font: 700 10px/1.2 var(--fn);
  letter-spacing: 0.1em;
  color: var(--ink3);
  margin-bottom: 2px;
}
.settings-card-head h2 {
  margin: 0;
  font-size: 16.5px;
  font-weight: 700;
  color: var(--ink);
}
.settings-rows {
  display: grid;
  gap: 8px;
  align-content: start;
}
.settings-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
  padding-top: 10px;
  border-top: 1px dashed var(--line);
}
.settings-row:first-child {
  padding-top: 0;
  border-top: 0;
}
.settings-select-line :deep(.q-select) {
  min-width: 176px;
}
.settings-row-info {
  display: grid;
  gap: 2px;
  min-width: 0;
  flex: 1 1 180px;
}
.settings-row-info b {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--ink);
}
.settings-row-info small {
  font-size: 12px;
  color: var(--ink3);
  line-height: 1.45;
}
.settings-row :deep(.seg) {
  margin: 0;
  max-width: 100%;
}
.settings-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 42px;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: var(--surface2);
  cursor: pointer;
  transition:
    border-color 0.14s,
    background-color 0.14s;
}
.settings-toggle-row:hover {
  border-color: color-mix(in srgb, var(--accent) 55%, var(--line));
}
.settings-switch {
  appearance: none;
  position: relative;
  width: 38px;
  height: 22px;
  margin: 0;
  flex: none;
  border-radius: 999px;
  border: 1px solid var(--line2);
  background: var(--surface);
  cursor: pointer;
  transition:
    background-color 0.16s ease,
    border-color 0.16s ease;
}
.settings-switch::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 999px;
  background: var(--ink3);
  transition:
    transform 0.16s ease,
    background-color 0.16s ease;
}
.settings-switch:checked {
  border-color: var(--teal);
  background: var(--teal);
}
.settings-switch:checked::after {
  transform: translateX(16px);
  background: #fff;
}
.settings-switch:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.settings-box-shortcut {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 4px;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--teal) 38%, var(--line));
  background: color-mix(in srgb, var(--teal) 6%, var(--surface2));
}
.settings-box-shortcut .btn {
  min-height: 36px;
  white-space: nowrap;
}
.settings-backup-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}
.settings-backup-checks {
  display: grid;
  gap: 4px;
}
.settings-reset-card {
  display: grid;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 8px;
  border: 1px dashed color-mix(in srgb, var(--red) 42%, var(--line));
  background: color-mix(in srgb, var(--red) 4%, var(--surface2));
}
.settings-season-card {
  padding: 12px 16px;
}
.settings-season-title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--ink);
}
.settings-season-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  font-size: 13px;
  color: var(--ink2);
}
.settings-season-meta b {
  color: var(--ink);
}
.settings-season-meta small {
  color: var(--ink3);
}
.settings-season-ver {
  font-family: var(--fn);
  font-size: 12px;
  color: var(--ink3);
}
.settings-season-meta .btn {
  margin-left: auto;
  min-height: 34px;
}
.settings-inline-check {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--ink2);
  cursor: pointer;
  min-height: 32px;
}
.settings-inline-check input[type='checkbox'] {
  width: 17px;
  height: 17px;
  flex: none;
  accent-color: var(--accent);
  cursor: pointer;
}
.settings-tab-list {
  position: relative;
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 6px;
}
.settings-tab-list.is-sorting {
  user-select: none;
}
.settings-tab-slot {
  position: relative;
}
.settings-tab-slot.is-dragging {
  z-index: 5;
  transition: none !important;
  transform: none !important;
}
.settings-tab-slot.is-dropping {
  z-index: 4;
}
.settings-tab-slot.is-nudged {
  z-index: 3;
}
.tab-sort-move {
  transition: transform 220ms cubic-bezier(0.2, 0, 0, 1);
}
.settings-tab-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: var(--surface2);
  user-select: none;
  cursor: grab;
  transition:
    border-color 0.15s,
    background-color 0.15s,
    opacity 0.15s,
    box-shadow 0.15s;
}
.settings-tab-item:hover {
  border-color: var(--line2);
}
.settings-tab-item.hidden {
  opacity: 0.65;
  border-style: dashed;
}
.settings-tab-item.dragging {
  transform: translate3d(0, var(--drag-y, 0px), 0);
  border-color: var(--accent);
  background: var(--surface);
  box-shadow:
    0 10px 24px -10px rgba(0, 0, 0, 0.35),
    0 0 0 1px var(--accent);
  cursor: grabbing;
  will-change: transform;
}
.settings-tab-item.dropping {
  transform: translate3d(0, var(--drag-y, 0px), 0);
  transition:
    transform 180ms cubic-bezier(0.2, 0, 0, 1),
    box-shadow 180ms ease,
    border-color 180ms ease,
    background-color 180ms ease;
}
.settings-drag-grip {
  display: inline-grid;
  place-items: center;
  min-width: 28px;
  min-height: 34px;
  border-radius: 5px;
  color: var(--ink3);
  font-family: var(--fn);
  font-size: 14px;
  letter-spacing: -1px;
  user-select: none;
  touch-action: none;
}
@media (pointer: coarse) {
  .settings-drag-grip {
    min-width: 36px;
  }
}
.settings-tab-idx {
  display: inline-grid;
  place-items: center;
  min-width: 24px;
  height: 24px;
  padding: 0 5px;
  border-radius: 6px;
  background: var(--surface);
  border: 1px solid var(--line);
  font-family: var(--fn);
  font-size: 12px;
  font-weight: 700;
  color: var(--ink2);
  flex: none;
}
.settings-tab-name {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--ink);
  min-width: 0;
  flex: 1;
}
.settings-tab-btns {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.settings-step-btn {
  min-width: 34px;
  min-height: 34px;
  padding: 0;
  justify-content: center;
}
.settings-vis-btn {
  min-height: 34px;
  padding: 3px 10px;
  border-color: var(--teal);
  color: var(--teal);
  font-weight: 600;
  background: color-mix(in srgb, var(--teal) 9%, var(--surface));
}
.settings-vis-btn.off {
  border-color: var(--line2);
  color: var(--ink3);
  background: var(--surface);
  font-weight: 400;
}
.settings-subblock {
  display: grid;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--line);
}
.settings-subblock.top {
  padding-top: 0;
  border-top: 0;
}
.settings-tool-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.settings-tool-pill {
  min-height: 36px;
  padding: 4px 12px;
  border-radius: 999px;
  border: 1px dashed var(--line2);
  background: var(--surface2);
  color: var(--ink3);
  font-size: 13px;
  cursor: pointer;
  transition:
    border-color 0.14s,
    background-color 0.14s,
    color 0.14s;
}
.settings-tool-pill.on {
  border-style: solid;
  border-color: var(--teal);
  background: color-mix(in srgb, var(--teal) 10%, var(--surface));
  color: var(--teal);
  font-weight: 600;
}
.settings-tool-pill:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.settings-btn-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.settings-btn-group .btn {
  min-height: 38px;
  align-items: center;
}
.settings-btn-group .btn.on {
  border-color: var(--accent);
  color: var(--accent);
}
.settings-box {
  display: grid;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: var(--surface2);
}
.settings-preview {
  border-color: color-mix(in srgb, var(--teal) 55%, var(--line));
}
.season-archive {
  display: grid;
  gap: 6px;
}
.season-archive p {
  margin: 0;
  color: var(--ink2);
  font-size: 13px;
}
.mirror-recovery {
  display: grid;
  justify-items: start;
  gap: 6px;
}
.mirror-recovery .btn {
  min-height: 36px;
}
.settings-preview b {
  font-size: 13.5px;
  color: var(--ink);
}
.settings-preview small,
.settings-box-note,
.settings-note {
  margin: 0;
  font-size: 12px;
  color: var(--ink3);
}
.settings-preview-summary {
  margin: 0;
  font-size: 13px;
  color: var(--teal);
  font-weight: 600;
}
.settings-textarea {
  width: 100%;
  min-height: 92px;
  padding: 8px;
  border-radius: 6px;
  border: 1px solid var(--line2);
  background: var(--surface);
  color: var(--ink);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  resize: vertical;
}

@container quickref-view (max-width: 820px) {
  .settings-grid,
  .settings-backup-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-height: 600px) {
  .settings-grid {
    gap: 10px;
  }
  .settings-card {
    padding: 12px;
    gap: 8px;
  }
  .settings-toggle-row {
    min-height: 36px;
    padding: 4px 8px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .tab-sort-move,
  .settings-tab-item.dropping,
  .settings-switch,
  .settings-switch::after {
    transition: none !important;
  }
}
:global(:root[data-motion='reduce'] .tab-sort-move),
:global(:root[data-motion='reduce'] .settings-tab-item.dropping),
:global(:root[data-motion='reduce'] .settings-switch),
:global(:root[data-motion='reduce'] .settings-switch::after) {
  transition: none !important;
}
</style>
