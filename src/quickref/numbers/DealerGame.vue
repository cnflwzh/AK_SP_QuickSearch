<script setup lang="ts">
import {
  computed,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  ref,
} from 'vue';
import {ADDON_COVENANTS, CORE_COVENANTS} from '../../../data/index.ts';
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
  SELECTABLE_COVENANTS,
  type DealerCard,
  type DealerMode,
  type DealerRoundKind,
  type HintLevel,
} from '../../lib/dealer/index.ts';
import LiveStatus from '../../lib/ui/LiveStatus.vue';
import {router} from '../../router/index.ts';
import type {DetailKind} from '../../router/entities.ts';
import Segmented from '../components/Segmented.vue';
import {color} from '../format.ts';
import {useQuickrefActions} from '../state.ts';
import {
  copyPosterToClipboard,
  downloadPosterPng,
  renderDealerPosterDataUrl,
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
  rank,
  dealerMood,
} = game;

const modeLabels = ['今日同题', '自由拷打'] as const;
const hintOptions: readonly {readonly id: HintLevel; readonly label: string}[] =
  [
    {id: 'blind', label: '盲猜记图鉴'},
    {id: 'clue', label: '线索提示'},
    {id: 'open', label: '明牌爽揍'},
  ];

const coreOptions = CORE_COVENANTS.filter((name) =>
  SELECTABLE_COVENANTS.includes(name),
);
const addonOptions = ADDON_COVENANTS.filter((name) =>
  SELECTABLE_COVENANTS.includes(name),
);

const copied = ref(false);
const copyFallback = ref('');
const imageStatus = ref<'idle' | 'copied' | 'saved'>('idle');
const fontReadyTick = ref(0);
let copyTimer: ReturnType<typeof setTimeout> | undefined;
let imageTimer: ReturnType<typeof setTimeout> | undefined;
// KeepAlive 返回及从后台恢复时刷新日期，后台不保留轮询计时器。
function refreshVisibleDate(): void {
  if (document.visibilityState === 'visible') game.refreshDate();
}
onActivated(() => {
  game.refreshDate();
  document.addEventListener('visibilitychange', refreshVisibleDate);
});
function releaseDateListener(): void {
  document.removeEventListener('visibilitychange', refreshVisibleDate);
}
onDeactivated(releaseDateListener);
onMounted(() => {
  void document.fonts?.ready?.then(() => {
    fontReadyTick.value++;
  });
});
onBeforeUnmount(() => {
  releaseDateListener();
  clearTimeout(copyTimer);
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

const statusLabels: Readonly<Record<string, string>> = {
  punched: '串场！',
  calibrated: '⚡ 校准',
  shielded: '自己人',
  kept: '✓ 保留',
};

function switchMode(index: number): void {
  const next: DealerMode = index === 0 ? 'daily' : 'free';
  copied.value = false;
  imageStatus.value = 'idle';
  copyFallback.value = '';
  game.setMode(next);
}

function changeFocus(event: Event): void {
  game.setFocusCovenant((event.target as HTMLSelectElement).value);
}

function changeHint(event: Event): void {
  game.setHintLevel((event.target as HTMLSelectElement).value as HintLevel);
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

const posterDataUrl = computed(() => {
  void fontReadyTick.value;
  if (!session.value.showReport) return '';
  return renderDealerPosterDataUrl(posterModel.value);
});

async function copyShareImage(): Promise<void> {
  clearTimeout(imageTimer);
  const dataUrl = posterDataUrl.value;
  if (!dataUrl) return;
  const result = await copyPosterToClipboard(dataUrl);
  if (result === 'copied') {
    imageStatus.value = 'copied';
  } else {
    downloadPosterPng(dataUrl, posterModel.value.fileName);
    imageStatus.value = 'saved';
  }
  imageTimer = setTimeout(() => {
    imageStatus.value = 'idle';
  }, 2600);
}

function saveShareImage(): void {
  clearTimeout(imageTimer);
  const dataUrl = posterDataUrl.value;
  if (!dataUrl) return;
  downloadPosterPng(dataUrl, posterModel.value.fileName);
  imageStatus.value = 'saved';
  imageTimer = setTimeout(() => {
    imageStatus.value = 'idle';
  }, 2600);
}

async function copyShareText(): Promise<void> {
  clearTimeout(copyTimer);
  const text = sharePreview.value;
  try {
    await navigator.clipboard.writeText(text);
    copied.value = true;
    copyFallback.value = '';
    copyTimer = setTimeout(() => {
      copied.value = false;
    }, 2400);
  } catch {
    copied.value = false;
    copyFallback.value = text;
  }
}

function switchToFreeAfterDaily(): void {
  game.closeReport();
  game.setMode('free');
}

function isRevealed(status: string): boolean {
  return status !== 'unseen' || state.hintLevel === 'open';
}

function isCardShown(card: DealerCard): boolean {
  return isRevealed(card.status) || isRoundCleared.value;
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
};

const stageAccentColor = computed(() => {
  const override = KIND_ACCENT_COLORS[round.value.kind];
  return override || color(round.value.targetCovenant);
});

const blindPromptText = computed(() => {
  const {kind, targetCovenant} = round.value;
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
      <Segmented
        :labels="modeLabels"
        :active="state.mode === 'daily' ? 0 : 1"
        attr="dealer-mode"
        @change="switchMode" />
      <select
        v-if="state.mode === 'free'"
        :value="state.focusCovenant"
        aria-label="指定特训内容"
        @change="changeFocus">
        <option value="">综合特训（全题型）</option>
        <optgroup label="玩法专项">
          <option value="kind:covenant">盟约点名（干员归属）</option>
          <option value="kind:transmute">同构转职（干员×装备）</option>
          <option value="kind:trigger">特质时机（触发×定位）</option>
          <option value="kind:tier_check">升本验阶（盲标等阶）</option>
          <option value="kind:equipment">装备整备（效果×费用）</option>
          <option value="kind:strategy">开局策略（策略立绘）</option>
          <option value="kind:bounty">悬赏猎金（通缉赏金）</option>
        </optgroup>
        <optgroup label="核心盟约">
          <option v-for="name in coreOptions" :key="name" :value="name">
            {{ name }}
          </option>
        </optgroup>
        <optgroup label="附加盟约">
          <option v-for="name in addonOptions" :key="name" :value="name">
            {{ name }}
          </option>
        </optgroup>
      </select>
      <select
        :value="state.hintLevel"
        aria-label="卡面提示难度"
        @change="changeHint">
        <option v-for="opt in hintOptions" :key="opt.id" :value="opt.id">
          {{ opt.label }}
        </option>
      </select>
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
          @click="session.showReport ? game.closeReport() : game.openReport()">
          {{ session.showReport ? '返回牌局' : '战报/分享' }}
        </button>
      </div>
    </div>

    <section
      v-if="session.showReport"
      class="nc nt-dealer-report"
      aria-label="痛扁发牌战报">
      <div class="nt-dealer-poster-wrap">
        <img
          v-if="posterDataUrl"
          class="nt-dealer-poster-img"
          :src="posterDataUrl"
          :alt="`${rank.title} 战报图片`"
          width="760"
          height="520" />
      </div>

      <div class="nt-dealer-report-side">
        <div class="nt-dealer-report-actions">
          <button
            type="button"
            class="btn p nt-dealer-poster-primary"
            @click="copyShareImage">
            {{
              imageStatus === 'copied'
                ? '✓ 图片已复制，可直接粘贴到群聊'
                : imageStatus === 'saved'
                  ? '✓ 已保存战报图片，可直接发群或长按图片转发'
                  : '复制战报图片'
            }}
          </button>
          <button type="button" class="btn" @click="saveShareImage">
            保存图片
          </button>
          <button type="button" class="btn" @click="copyShareText">
            {{ copied ? '✓ 文案已复制' : '复制文字+链接' }}
          </button>
          <button type="button" class="btn" @click="game.closeReport">
            {{
              state.mode === 'daily' && session.dailyCompleted
                ? '复盘卡牌'
                : '继续痛扁'
            }}
          </button>
          <button
            v-if="state.mode === 'daily'"
            type="button"
            class="btn"
            @click="game.replayDaily">
            重刷今日同题
          </button>
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
              class="nt-dealer-target-badge"
              :style="{'--c': stageAccentColor}">
              {{ round.targetLabel }}
            </span>
            <span class="tag" :class="isRoundCleared ? 't' : 'r'">
              {{
                isRoundCleared
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

      <section class="nt-dealer-shop" aria-label="本轮商店发牌">
        <article
          v-for="(card, index) in round.cards"
          :key="`${round.roundNumber}-${card.cardKind}-${card.title}`"
          class="nt-dealer-card"
          :class="[
            card.status,
            card.cardKind,
            {cleared: isRoundCleared, equip: card.cardKind === 'equipment'},
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
                ? `指出${card.title}不符合「${round.targetCovenant}」并痛扁发牌员`
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
                {{ statusLabels[card.status] }}
              </b>
            </div>

            <strong class="nt-dealer-name">{{ card.title }}</strong>

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

            <template v-if="isRevealed(card.status)">
              <div class="nt-dealer-covs">
                <span
                  v-for="tag in card.revealTags"
                  :key="tag.label"
                  class="nt-dealer-cov"
                  :class="{match: tag.match, mismatch: tag.mismatch}"
                  :style="
                    tag.covenant ? {'--c': color(tag.covenant)} : undefined
                  ">
                  {{ tag.label }}
                </span>
              </div>
              <p
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

            <template
              v-else-if="state.hintLevel === 'clue' || round.hintRevealed">
              <span class="nt-dealer-clue">{{ card.triggerHint }}</span>
              <span class="nt-dealer-prompt">{{ card.secondaryClue }}</span>
            </template>

            <template v-else>
              <span v-if="!card.attachedEquip" class="nt-dealer-prompt">
                {{ blindPromptText }}
              </span>
              <span class="nt-dealer-hit-cta">👊 揪出串场</span>
            </template>
          </button>
        </article>
      </section>

      <footer class="nc nt-dealer-footer">
        <span class="nt-dealer-footer-tip">
          <template v-if="isRoundCleared">
            <template v-if="round.cards[0]?.detailKind">
              已翻开本轮全部 5 张信息，点右下角继续（此时点卡片顶部
              <b>i</b>
              复盘不计提示）。
            </template>
            <template v-else>
              已翻开本轮全部 5 张情报，点右下角继续下一轮。
            </template>
          </template>
          <template v-else>
            点选不符合当前目标的条目，痛扁乱排队的发牌员（误判
            {{ session.stats.mistakes }} 次 · 无倒计时）。
          </template>
        </span>
        <div class="nt-dealer-footer-btns">
          <button
            v-if="state.mode === 'free' && session.stats.roundsCleared > 0"
            type="button"
            class="btn"
            @click="game.resetFree">
            重置战绩
          </button>
          <button
            type="button"
            class="btn"
            :class="{p: isRoundCleared}"
            :disabled="!isRoundCleared"
            @click="game.nextRound">
            {{
              !isRoundCleared
                ? `还剩 ${remainingImpostors} 处串场`
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
