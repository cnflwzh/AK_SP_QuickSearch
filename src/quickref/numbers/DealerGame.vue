<script setup lang="ts">
import {
  computed,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  ref,
  shallowRef,
  watchPostEffect,
} from 'vue';
import {
  ADDON_COVENANTS,
  CORE_COVENANTS,
  COVENANTS,
} from '../../../data/index.ts';
import {
  avatarSrc,
  enemyIconSrc,
  equipIconSrc,
  portraitSrc,
} from '../../lib/ui/assets.ts';
import {
  buildDealerPosterModel,
  DAILY_ROUND_COUNT,
  dailyTagFromKey,
  MISTAKE_KIND_LABELS,
  MISTAKE_MASTERY_STREAK,
  SELECTABLE_COVENANTS,
  type DealerCard,
  type DealerMode,
  type DealerRoundKind,
  type HintLevel,
} from '../../lib/dealer/index.ts';
import LiveStatus from '../../lib/ui/LiveStatus.vue';
import {downloadBlob} from '../../lib/ui/download.ts';
import {router} from '../../router/index.ts';
import type {DetailKind} from '../../router/entities.ts';
import CovenantIcon from '../components/CovenantIcon.vue';
import SelectInput, {
  type SelectEntry,
  type SelectOption,
} from '../components/SelectInput.vue';
import SubTabs, {type SubTabItem} from '../components/SubTabs.vue';
import ConfirmButton from '../components/ConfirmButton.vue';
import CopyButton from '../components/CopyButton.vue';
import {color} from '../format.ts';
import {useQuickrefActions} from '../state.ts';
import {
  copyPosterToClipboard,
  renderDealerPoster,
} from './dealerPoster.ts';
import {useDealerGame} from './useDealerGame.ts';

const actions = useQuickrefActions();
const game = useDealerGame();
const {
  state,
  session,
  round,
  isRoundCleared,
  remainingImpostors,
  canCastUltimate,
  activeMistakeList,
  masteredMistakes,
  mistakeSummaryByKind,
  rank,
  dealerMood,
} = game;

const MODE_TABS: readonly SubTabItem<DealerMode>[] = [
  {id: 'daily', label: '今日同题'},
  {id: 'free', label: '自由拷打'},
];
const selectedMode = computed<DealerMode>({
  get: () => state.mode,
  set: (mode) => switchMode(mode),
});
const hintOptions: readonly SelectOption<HintLevel>[] = [
  {value: 'blind', label: '盲猜记图鉴'},
  {value: 'clue', label: '线索提示'},
  {value: 'open', label: '明牌爽揍'},
];

const coreOptions = CORE_COVENANTS.filter((name) =>
  SELECTABLE_COVENANTS.includes(name),
);
const addonOptions = ADDON_COVENANTS.filter((name) =>
  SELECTABLE_COVENANTS.includes(name),
);
const focusOptions = computed<readonly SelectEntry<string>[]>(() => [
  {value: '', label: '综合特训（全题型）'},
  {
    value: 'mistakes',
    label: `🎯 错题专攻（${
      activeMistakeList.value.length
        ? `${activeMistakeList.value.length} 项待复习`
        : '暂无错题'
    }）`,
    disabled: !activeMistakeList.value.length,
  },
  {
    label: '玩法专项',
    options: [
      {value: 'kind:scenario', label: '实战抓牌（局面决策）'},
      {value: 'kind:covenant', label: '盟约点名（干员归属）'},
      {value: 'kind:transmute', label: '同构转职（干员×装备）'},
      {value: 'kind:trigger', label: '特质时机（触发×定位）'},
      {value: 'kind:tier_check', label: '升本验阶（盲标等阶）'},
      {value: 'kind:equipment', label: '装备整备（效果×费用）'},
      {value: 'kind:strategy', label: '开局策略（策略立绘）'},
      {value: 'kind:bounty', label: '悬赏猎金（通缉赏金）'},
    ],
  },
  {
    label: '核心盟约',
    options: coreOptions.map((name) => ({value: name, label: name})),
  },
  {
    label: '附加盟约',
    options: addonOptions.map((name) => ({value: name, label: name})),
  },
]);

const copyFallback = ref('');
const imageStatus = ref<'idle' | 'copied' | 'saved'>('idle');
const fontReadyTick = ref(0);
const active = ref(true);
const showMistakes = ref(false);
let imageTimer: ReturnType<typeof setTimeout> | undefined;
// KeepAlive 返回及从后台恢复时刷新日期，后台不保留轮询计时器。
function refreshVisibleDate(): void {
  if (document.visibilityState === 'visible') game.refreshDate();
}
onActivated(() => {
  active.value = true;
  game.refreshDate();
  document.addEventListener('visibilitychange', refreshVisibleDate);
});
function releaseDateListener(): void {
  document.removeEventListener('visibilitychange', refreshVisibleDate);
}
onDeactivated(() => {
  active.value = false;
  releaseDateListener();
});
onMounted(() => {
  if (document.fonts?.status === 'loading') {
    void document.fonts.ready.then(() => {
      fontReadyTick.value++;
    });
  }
});
onBeforeUnmount(() => {
  releaseDateListener();
  clearTimeout(imageTimer);
});

const dailyTag = computed(() => dailyTagFromKey(state.dateKey));
const roundHeading = computed(() => {
  if (state.mode === 'daily') {
    return `今日 #${dailyTag.value} · ${round.value.roundNumber}/${DAILY_ROUND_COUNT}`;
  }
  return `自由 · 第 ${round.value.roundNumber} 轮`;
});
const defeatedTotal = computed(
  () => session.value.stats.punched + session.value.stats.calibrated,
);
const hintsUsedTotal = computed(() => session.value.stats.hintsUsed ?? 0);

const isBestPickMode = computed(() => round.value.selectionMode === 'best_pick');

const statusLabels: Readonly<Record<string, string>> = {
  punched: '串场！',
  calibrated: '⚡ 校准',
  shielded: '自己人',
  kept: '✓ 保留',
};

function cardStatusLabel(card: DealerCard): string {
  if (isBestPickMode.value) {
    if (card.status === 'punched') return '✓ 最优解';
    if (card.status === 'calibrated') return '⚡ 最优解';
    if (card.status === 'shielded') {
      return `非最优 #${card.advisorRank ?? '?'}`;
    }
    return card.advisorRank ? `#${card.advisorRank}` : '备选';
  }
  return statusLabels[card.status] ?? '';
}

function toggleMistakesPanel(): void {
  if (session.value.showReport) game.closeReport();
  showMistakes.value = !showMistakes.value;
}

function toggleReportPanel(): void {
  if (session.value.showReport) {
    game.closeReport();
  } else {
    showMistakes.value = false;
    game.openReport();
  }
}

function launchMistakeDrill(): void {
  showMistakes.value = false;
  game.startMistakeDrill();
}

function switchMode(next: DealerMode): void {
  imageStatus.value = 'idle';
  copyFallback.value = '';
  game.setMode(next);
}

function changeFocus(value: string): void {
  game.setFocusCovenant(value);
}

function changeHint(value: HintLevel): void {
  game.setHintLevel(value);
}

function dealerShareLink(): string {
  const resolved = router.resolve({name: 'tools', query: {tool: 'dealer'}});
  return new URL(resolved.href, window.location.origin).href;
}

const sharePreview = computed(() => game.buildShareText(dealerShareLink()));

const posterModel = computed(() =>
  buildDealerPosterModel({
    mode: state.mode,
    dateKey: state.dateKey,
    history: session.value.history,
    currentRound: round.value,
    stats: session.value.stats,
    shareUrl: dealerShareLink(),
    usedAssistOnly: game.usedAssistOnly.value,
  }),
);

const poster = shallowRef<{
  blob: Blob;
  url: string;
  fileName: string;
} | null>(null);
const posterFailed = ref(false);
watchPostEffect(async (onCleanup) => {
  posterFailed.value = false;
  if (!active.value || !session.value.showReport) return;
  void fontReadyTick.value;
  const model = posterModel.value;
  let cancelled = false;
  let url: string | undefined;
  // 离开、切换模式或字体就绪时丢弃过期的编码结果，并释放预览图。
  onCleanup(() => {
    cancelled = true;
    if (url) URL.revokeObjectURL(url);
    poster.value = null;
  });
  try {
    const blob = await renderDealerPoster(model);
    if (cancelled) return;
    if (blob) {
      url = URL.createObjectURL(blob);
      poster.value = {blob, url, fileName: model.fileName};
    } else {
      posterFailed.value = true;
    }
  } catch {
    if (!cancelled) posterFailed.value = true;
  }
});

async function copyShareImage(): Promise<void> {
  clearTimeout(imageTimer);
  const image = poster.value;
  if (!image) return;
  const result = await copyPosterToClipboard(image.blob);
  if (result !== 'copied') downloadBlob(image.blob, image.fileName);
  if (poster.value !== image) return;
  imageStatus.value = result === 'copied' ? 'copied' : 'saved';
  imageTimer = setTimeout(() => {
    imageStatus.value = 'idle';
  }, 2600);
}

function saveShareImage(): void {
  clearTimeout(imageTimer);
  const image = poster.value;
  if (!image) return;
  downloadBlob(image.blob, image.fileName);
  imageStatus.value = 'saved';
  imageTimer = setTimeout(() => {
    imageStatus.value = 'idle';
  }, 2600);
}

function switchToFreeAfterDaily(): void {
  game.closeReport();
  game.setMode('free');
}

function isRevealed(card: DealerCard): boolean {
  if (isBestPickMode.value) {
    return card.status !== 'unseen' || isRoundCleared.value;
  }
  return card.status !== 'unseen' || state.hintLevel === 'open';
}

function isCardShown(card: DealerCard): boolean {
  return isRevealed(card) || isRoundCleared.value;
}

function cardTierData(card: DealerCard): number {
  return card.hideTierBeforeReveal && !isCardShown(card) ? 0 : card.tier;
}

function cardCornerBadge(card: DealerCard): string {
  return card.hideTierBeforeReveal && !isCardShown(card)
    ? (card.cornerBadgeHidden ?? '?')
    : card.cornerBadge;
}

function cardImgSrc(card: DealerCard): string {
  if (card.cardKind === 'equipment') return equipIconSrc(card.title);
  if (card.cardKind === 'strategy') return portraitSrc(card.title);
  if (card.cardKind === 'bounty') return enemyIconSrc(card.enemyId ?? '');
  return avatarSrc(card.title);
}

const KIND_ACCENT_COLORS: Readonly<Record<DealerRoundKind, string>> = {
  covenant: '',
  transmute: '',
  trigger: '#0d9488',
  tier_check: '#6d28d9',
  equipment: '#b46a07',
  strategy: '#2563eb',
  bounty: '#b91c1c',
  scenario: '#0f766e',
};

const stageAccentColor = computed(() => {
  const override = KIND_ACCENT_COLORS[round.value.kind];
  return override || color(round.value.targetCovenant);
});

const blindPromptText = computed(() => {
  const {kind, targetCovenant} = round.value;
  if (kind === 'scenario') return '当前局面最优解？';
  if (kind === 'covenant' || kind === 'transmute') {
    return `非【${targetCovenant}】编制？`;
  }
  if (kind === 'tier_check') return '阶位已隐，几阶？';
  if (kind === 'bounty') return '赏金已隐，几资？';
  return `不合【${targetCovenant}】？`;
});

function inspectCardDetail(
  index: number,
  kind: DetailKind,
  name: string,
): void {
  game.recordDetailPeek(index);
  actions.openDetail(kind, name);
}
</script>

<template>
  <div class="nt-dealer">
    <div class="bar nt-dealer-bar">
      <SubTabs
        v-model="selectedMode"
        :items="MODE_TABS"
        :level="3"
        inline
        aria-label="对局模式"
        attr="dealer-mode" />
      <SelectInput
        v-if="state.mode === 'free'"
        :model-value="state.focusCovenant"
        :options="focusOptions"
        highlight-active
        aria-label="指定特训内容"
        @update:model-value="changeFocus" />
      <SelectInput
        :model-value="state.hintLevel"
        :options="hintOptions"
        aria-label="卡面提示难度"
        @update:model-value="changeHint" />
      <div class="nt-dealer-bar-actions">
        <button
          v-if="
            !session.showReport &&
            state.hintLevel === 'blind' &&
            !isRoundCleared
          "
          type="button"
          class="btn nt-dealer-hint-btn"
          :class="{used: round.hintRevealed}"
          :disabled="round.hintRevealed"
          @click="game.requestRoundHint">
          {{ round.hintRevealed ? '💡 已开提示' : '💡 提示' }}
        </button>
        <button
          type="button"
          class="btn nt-dealer-mistakes-btn"
          :class="{p: showMistakes}"
          :aria-expanded="showMistakes"
          @click="toggleMistakesPanel">
          错题本
          <b v-if="activeMistakeList.length">{{ activeMistakeList.length }}</b>
        </button>
        <span class="nt-dealer-stat-pill">
          已打
          <b>{{ defeatedTotal }}</b>
          <template v-if="session.combo >= 2">
            ·
            <em class="nt-dealer-combo">{{ session.combo }}连</em>
          </template>
          <template v-if="hintsUsedTotal > 0">
            ·
            <em class="nt-dealer-hint-count">💡{{ hintsUsedTotal }}</em>
          </template>
        </span>
        <button
          type="button"
          class="btn"
          :class="{p: session.showReport}"
          @click="toggleReportPanel">
          {{ session.showReport ? '返回牌局' : '战报/分享' }}
        </button>
      </div>
    </div>

    <section
      v-if="showMistakes && !session.showReport"
      class="nc nt-dealer-mistakes"
      aria-label="本地错题本">
      <div class="nt-dealer-mistakes-head">
        <div class="nt-dealer-mistakes-summary">
          <strong>本地错题本</strong>
          <span class="tag r">待复习 {{ activeMistakeList.length }}</span>
          <span v-if="masteredMistakes > 0" class="tag t">
            已掌握 {{ masteredMistakes }}
          </span>
        </div>
        <div class="nt-dealer-mistakes-actions">
          <button
            v-if="activeMistakeList.length"
            type="button"
            class="btn p"
            @click="launchMistakeDrill">
            🎯 专攻错题
          </button>
          <ConfirmButton
            v-if="masteredMistakes > 0"
            label="清已掌握"
            confirm-label="确认移除已掌握错题"
            @confirm="game.clearMasteredMistakes" />
          <ConfirmButton
            v-if="state.mistakes.length"
            label="清空"
            confirm-label="确认清空错题本"
            @confirm="game.clearAllMistakes" />
          <button type="button" class="btn" @click="showMistakes = false">
            收起
          </button>
        </div>
      </div>

      <div
        v-if="mistakeSummaryByKind.length"
        class="nt-dealer-mistake-kinds">
        <span
          v-for="item in mistakeSummaryByKind"
          :key="item.kind"
          class="tag">
          {{ item.label }} ×{{ item.count }}
        </span>
      </div>

      <ul v-if="activeMistakeList.length" class="nt-dealer-mistake-list">
        <li
          v-for="item in activeMistakeList"
          :key="item.key"
          class="nt-dealer-mistake-row">
          <button
            v-if="item.detailKind"
            type="button"
            class="nt-dealer-mistake-name link"
            @click="actions.openDetail(item.detailKind, item.title)">
            {{ item.title }}
          </button>
          <span v-else class="nt-dealer-mistake-name">{{ item.title }}</span>
          <span class="nt-dealer-mistake-meta">
            {{ MISTAKE_KIND_LABELS[item.roundKind] }} · {{ item.targetLabel }}
          </span>
          <span class="nt-dealer-mistake-count">错 {{ item.wrongCount }}</span>
          <span class="nt-dealer-mistake-streak">
            {{ item.correctStreak }}/{{ MISTAKE_MASTERY_STREAK }}
          </span>
          <button
            type="button"
            class="nt-dealer-mistake-del"
            :aria-label="`移出错题 ${item.title}`"
            title="移出错题本"
            @click="game.removeMistake(item.key)">
            ×
          </button>
        </li>
      </ul>
      <p v-else class="nt-dealer-mistakes-empty">
        暂无待复习错题。答错的干员、装备、策略或悬赏会自动记入这里，在后续轮次中连续
        {{ MISTAKE_MASTERY_STREAK }} 次无误处理即自动标记掌握。
      </p>
    </section>

    <section
      v-if="session.showReport"
      class="nc nt-dealer-report"
      aria-label="痛扁发牌战报">
      <div class="nt-dealer-poster-wrap">
        <img
          v-if="poster"
          class="nt-dealer-poster-img"
          :src="poster.url"
          :alt="`${rank.title} 战报图片`"
          width="760"
          height="520" />
        <p v-else role="status">
          {{
            posterFailed
              ? '战报图片生成失败，可复制文字战报。'
              : '正在生成战报图片…'
          }}
        </p>
      </div>

      <div class="nt-dealer-report-side">
        <div class="nt-dealer-report-actions">
          <button
            type="button"
            class="btn p nt-dealer-poster-primary"
            :disabled="!poster"
            @click="copyShareImage">
            {{
              imageStatus === 'copied'
                ? '✓ 图片已复制，可直接粘贴到群聊'
                : imageStatus === 'saved'
                  ? '✓ 已保存战报图片，可直接发群或长按图片转发'
                  : '复制战报图片'
            }}
          </button>
          <button
            type="button"
            class="btn"
            :disabled="!poster"
            @click="saveShareImage">
            保存图片
          </button>
          <CopyButton
            :text="sharePreview"
            label="复制文字+链接"
            copied-label="文案已复制"
            fallback-mode="emit"
            :reset-ms="2400"
            @copied="copyFallback = ''"
            @fallback="copyFallback = $event" />
          <button type="button" class="btn" @click="game.closeReport">
            {{
              state.mode === 'daily' && session.dailyCompleted
                ? '复盘卡牌'
                : '继续痛扁'
            }}
          </button>
          <ConfirmButton
            v-if="state.mode === 'daily'"
            label="重刷今日同题"
            confirm-label="确认重置今日战绩"
            @confirm="game.replayDaily" />
          <button
            v-if="state.mode === 'daily' && session.dailyCompleted"
            type="button"
            class="btn"
            @click="switchToFreeAfterDaily">
            去自由拷打无限刷
          </button>
        </div>

        <p class="nt-dealer-poster-tip">
          支持 Ctrl+V 直接粘贴图片到 QQ / 微信，手机端也可长按图片保存或转发。
        </p>

        <textarea
          v-if="copyFallback"
          class="nt-copy-fallback"
          readonly
          aria-label="战报文本"
          :value="copyFallback"
          @focus="($event.target as HTMLTextAreaElement).select()"></textarea>
      </div>
    </section>

    <template v-else>
      <section class="nc nt-dealer-stage" aria-label="本轮目标与发牌员状态">
        <div class="nt-dealer-mission">
          <div class="nt-dealer-mission-head">
            <span class="tag">{{ roundHeading }}</span>
            <span class="tag nt-dealer-kind-tag">{{ round.missionTitle }}</span>
            <span
              v-if="round.isMistakeReview"
              class="tag nt-dealer-review-tag">
              🎯 错题复盘
            </span>
            <span
              class="nt-dealer-target-badge"
              :style="{'--c': stageAccentColor}">
              <CovenantIcon
                v-if="COVENANTS[round.targetCovenant]"
                :name="round.targetCovenant" />
              {{ round.targetLabel }}
            </span>
            <span class="tag" :class="isRoundCleared ? 't' : 'r'">
              {{
                isBestPickMode
                  ? isRoundCleared
                    ? '✓ 已揭晓评估'
                    : '选 1 张最优抓牌'
                  : isRoundCleared
                    ? '✓ 本轮已理清'
                    : `找出 ${remainingImpostors} 处串场`
              }}
            </span>
            <span v-if="round.usedHint" class="tag nt-dealer-hinted-tag">
              💡 本轮已记提示
            </span>
          </div>
          <p class="nt-dealer-memo-main">{{ round.missionSummary }}</p>
          <p v-if="round.missionBonus" class="nt-dealer-memo-bonus">
            <b>要点</b>
            {{ round.missionBonus }}
          </p>
        </div>

        <div class="nt-dealer-boss" :data-tier="dealerMood.tier">
          <div class="nt-dealer-bubble-row">
            <span class="nt-dealer-face" :title="dealerMood.label">
              {{ dealerMood.emoji }}
              <small>{{ dealerMood.label }}</small>
            </span>
            <p class="nt-dealer-bubble">“{{ session.dealerLine }}”</p>
          </div>
          <div class="nt-dealer-rage-row">
            <div
              class="nt-dealer-rage-meter"
              :aria-label="`怒气值 ${session.rage}%`">
              <div
                class="nt-dealer-rage-fill"
                :style="{width: `${session.rage}%`}"></div>
              <span>怒气 {{ session.rage }}%</span>
            </div>
            <button
              type="button"
              class="btn nt-dealer-ult"
              :class="{p: canCastUltimate, ready: canCastUltimate}"
              :disabled="!canCastUltimate"
              @click="game.castUltimate">
              ⚡ 物理校准
            </button>
          </div>
        </div>
      </section>

      <section
        v-if="round.scenarioContext"
        class="nc nt-dealer-board"
        aria-label="当前局面">
        <div class="nt-dealer-board-meta">
          <span class="nt-dealer-board-pill">
            <b>{{ round.scenarioContext.level }}</b>
            本 · 第 {{ round.scenarioContext.round }} 回合
          </span>
          <span class="nt-dealer-board-pill funds">
            💰
            <b>{{ round.scenarioContext.funds }}</b>
            资金
          </span>
          <button
            v-if="round.scenarioContext.strategy"
            type="button"
            class="nt-dealer-board-strat"
            @click="actions.openDetail('st', round.scenarioContext.strategy)">
            策略：{{ round.scenarioContext.strategy }}
          </button>
          <div class="nt-dealer-board-covs">
            <span
              v-for="cov in round.scenarioContext.covenantHints"
              :key="cov.name"
              class="nt-dealer-board-cov"
              :class="{
                active: cov.active,
                near: !cov.active && cov.count >= cov.need - 1,
              }"
              :style="{'--c': color(cov.name)}">
              <CovenantIcon :name="cov.name" />
              {{ cov.name }}
              <b>{{ cov.count }}/{{ cov.need }}</b>
            </span>
          </div>
        </div>
        <div class="nt-dealer-board-units">
          <span class="nt-dealer-board-label">
            场上 ({{ round.scenarioContext.deployed.length }})
          </span>
          <button
            v-for="unit in round.scenarioContext.deployed"
            :key="unit.name"
            type="button"
            class="nt-dealer-unit-chip"
            :class="{pair: unit.copies >= 2}"
            :data-t="unit.tier"
            :title="`查看场上干员 ${unit.name} 详情`"
            @click="actions.openDetail('op', unit.name)">
            <img
              :src="avatarSrc(unit.name)"
              alt=""
              width="24"
              height="24"
              loading="lazy"
              decoding="async" />
            <span>{{ unit.name }}</span>
            <b v-if="unit.copies >= 2" class="nt-dealer-unit-copies">
              ×{{ unit.copies }}
            </b>
            <b v-else-if="unit.elite" class="nt-dealer-unit-copies">精</b>
          </button>
        </div>
      </section>

      <section class="nt-dealer-shop" aria-label="本轮商店发牌">
        <article
          v-for="(card, index) in round.cards"
          :key="`${round.roundNumber}-${card.cardKind}-${card.title}`"
          class="nt-dealer-card"
          :class="[
            card.status,
            card.cardKind,
            {
              cleared: isRoundCleared,
              equip: card.cardKind === 'equipment',
              'best-pick': isBestPickMode,
            },
          ]"
          :data-t="cardTierData(card)">
          <div
            v-if="card.detailKind || card.attachedEquip"
            class="nt-dealer-card-actions">
            <button
              v-if="card.detailKind"
              type="button"
              class="nt-dealer-info"
              :aria-label="`查看${card.title}详情`"
              :title="
                card.status === 'unseen' &&
                !isRoundCleared &&
                state.hintLevel === 'blind'
                  ? '查看详情（本轮未通关时将计入提示）'
                  : '查看详情'
              "
              @click="inspectCardDetail(index, card.detailKind, card.title)">
              i
            </button>
            <button
              v-if="card.attachedEquip"
              type="button"
              class="nt-dealer-equip-info"
              :aria-label="`查看装备${card.attachedEquip.name}详情`"
              :title="
                card.status === 'unseen' &&
                !isRoundCleared &&
                state.hintLevel === 'blind'
                  ? '查看携带装备详情（将计入场中提示）'
                  : '查看携带装备详情'
              "
              @click="inspectCardDetail(index, 'eq', card.attachedEquip.name)">
              装
            </button>
          </div>
          <button
            type="button"
            class="nt-dealer-pick"
            :disabled="card.status !== 'unseen' || isRoundCleared"
            :aria-label="
              card.status === 'unseen'
                ? isBestPickMode
                  ? `选择${card.title}（${card.price ?? '?'}资金）作为当前局面最优抓牌`
                  : `指出${card.title}不符合「${round.targetCovenant}」并痛扁发牌员`
                : `${card.title}：${card.revealTags.map((t) => t.label).join('、')}`
            "
            @click="game.tapCard(index)">
            <div class="nt-dealer-pic">
              <img
                :src="cardImgSrc(card)"
                alt=""
                width="52"
                height="52"
                loading="lazy"
                decoding="async" />
              <i class="nt-dealer-tier">{{ cardCornerBadge(card) }}</i>
              <b
                v-if="card.status !== 'unseen'"
                class="nt-dealer-stamp"
                :class="card.status">
                {{ cardStatusLabel(card) }}
              </b>
            </div>

            <strong class="nt-dealer-name">{{ card.title }}</strong>

            <span
              v-if="card.price !== undefined"
              class="nt-dealer-price"
              :class="{
                short:
                  isRevealed(card) &&
                  round.scenarioContext &&
                  card.price > round.scenarioContext.funds,
              }">
              💰 {{ card.price }} 资
            </span>

            <span v-if="card.attachedEquip" class="nt-dealer-equip-chip">
              <img
                :src="equipIconSrc(card.attachedEquip.name)"
                alt=""
                width="14"
                height="14"
                loading="lazy"
                decoding="async" />
              <span>同构·{{ card.attachedEquip.name }}</span>
            </span>

            <template v-if="isRevealed(card)">
              <div class="nt-dealer-covs">
                <span
                  v-for="tag in card.revealTags"
                  :key="tag.label"
                  class="nt-dealer-cov"
                  :class="{match: tag.match, mismatch: tag.mismatch}"
                  :style="
                    tag.covenant ? {'--c': color(tag.covenant)} : undefined
                  ">
                  <CovenantIcon v-if="tag.covenant" :name="tag.covenant" />
                  {{ tag.label }}
                </span>
              </div>
              <div
                v-if="
                  isBestPickMode &&
                  (card.advisorLosses?.length || card.advisorReasons?.length)
                "
                class="nt-dealer-advisor-notes">
                <p
                  v-for="(loss, lIdx) in card.advisorLosses"
                  :key="`l-${lIdx}`"
                  class="nt-dealer-advisor-loss">
                  ⚠ {{ loss }}
                </p>
                <p
                  v-for="(reason, rIdx) in card.advisorReasons"
                  :key="`r-${rIdx}`"
                  class="nt-dealer-advisor-reason">
                  · {{ reason }}
                </p>
              </div>
              <p
                v-else
                class="nt-dealer-trait"
                :title="card.traitSegments.map((s) => s.text).join('')">
                <span
                  v-for="(seg, sIdx) in card.traitSegments"
                  :key="sIdx"
                  :class="`seg-${seg.kind}`">
                  {{ seg.text }}
                </span>
              </p>
            </template>

            <template v-else-if="isBestPickMode && state.hintLevel === 'open'">
              <div class="nt-dealer-covs">
                <span
                  v-for="cov in card.operator?.covenants ?? []"
                  :key="cov"
                  class="nt-dealer-cov"
                  :style="{'--c': color(cov)}">
                  <CovenantIcon :name="cov" />
                  {{ cov }}
                </span>
              </div>
              <span class="nt-dealer-clue">{{ card.triggerHint }}</span>
              <span class="nt-dealer-hit-cta">🎯 选最优抓牌</span>
            </template>

            <template
              v-else-if="state.hintLevel === 'clue' || round.hintRevealed">
              <span class="nt-dealer-clue">{{ card.triggerHint }}</span>
              <span class="nt-dealer-prompt">{{ card.secondaryClue }}</span>
              <span v-if="isBestPickMode" class="nt-dealer-hit-cta">
                🎯 选最优抓牌
              </span>
            </template>

            <template v-else>
              <span v-if="!card.attachedEquip" class="nt-dealer-prompt">
                {{ blindPromptText }}
              </span>
              <span class="nt-dealer-hit-cta">
                {{ isBestPickMode ? '🎯 选最优抓牌' : '👊 揪出串场' }}
              </span>
            </template>
          </button>
        </article>
      </section>

      <footer class="nc nt-dealer-footer">
        <span class="nt-dealer-footer-tip">
          <template v-if="isRoundCleared">
            <template v-if="isBestPickMode">
              已展开全部 {{ round.cards.length }} 张候选的局内顾问评估与推荐理由，点卡片顶部
              <b>i</b>
              可查干员详情。
            </template>
            <template v-else-if="round.cards[0]?.detailKind">
              已翻开本轮全部 5 张信息，点右下角继续（此时点卡片顶部
              <b>i</b>
              复盘不计提示）。
            </template>
            <template v-else>
              已翻开本轮全部 5 张情报，点右下角继续下一轮。
            </template>
          </template>
          <template v-else-if="isBestPickMode">
            结合场上编制、听牌对子与手头资金，点选 1 张收益最高的抓牌（误判
            {{ session.stats.mistakes }} 次 · 无倒计时）。
          </template>
          <template v-else>
            点选不符合当前目标的条目，痛扁乱排队的发牌员（误判
            {{ session.stats.mistakes }} 次 · 无倒计时）。
          </template>
        </span>
        <div class="nt-dealer-footer-btns">
          <ConfirmButton
            v-if="state.mode === 'free' && session.stats.roundsCleared > 0"
            label="重置战绩"
            confirm-label="确认重置战绩"
            @confirm="game.resetFree" />
          <button
            type="button"
            class="btn"
            :class="{p: isRoundCleared}"
            :disabled="!isRoundCleared"
            @click="game.nextRound">
            {{
              !isRoundCleared
                ? isBestPickMode
                  ? '选出最优抓牌'
                  : `还剩 ${remainingImpostors} 处串场`
                : state.mode === 'daily' &&
                    round.roundNumber >= DAILY_ROUND_COUNT
                  ? '查看今日战报 🏆'
                  : '下一轮 →'
            }}
          </button>
        </div>
      </footer>
    </template>

    <LiveStatus :message="state.announcement" />
  </div>
</template>
