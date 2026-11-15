<script setup lang="ts">
import {computed, onBeforeUnmount, onMounted, ref} from 'vue';
import {
  ADDON_COVENANTS,
  CORE_COVENANTS,
  TIER_LABELS,
} from '../../../data/index.ts';
import {avatarSrc} from '../../lib/assets.ts';
import {
  buildDealerPosterModel,
  DAILY_ROUND_COUNT,
  dailyTagFromKey,
  SELECTABLE_COVENANTS,
  type DealerMode,
  type HintLevel,
} from '../../lib/dealerGame.ts';
import LiveStatus from '../../lib/LiveStatus.vue';
import {router} from '../../router/index.ts';
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
  memo,
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
onMounted(() => {
  void document.fonts?.ready?.then(() => {
    fontReadyTick.value++;
  });
});
onBeforeUnmount(() => {
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

const statusLabels: Readonly<Record<string, string>> = {
  punched: '退货！',
  calibrated: '⚡ 校准',
  shielded: '自己人',
  kept: '✓ 收下',
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
  const resolved = router.resolve({path: '/numbers', query: {tool: 'dealer'}});
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
</script>

<template>
  <div class="nt-dealer">
    <div class="bar nt-dealer-bar">
      <Segmented
        :labels="modeLabels"
        :active="state.mode === 'daily' ? 0 : 1"
        attr="dealer-mode"
        @change="switchMode"
      />
      <select
        v-if="state.mode === 'free'"
        :value="state.focusCovenant"
        aria-label="指定考核盟约"
        @change="changeFocus"
      >
        <option value="">随机盟约</option>
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
        @change="changeHint"
      >
        <option v-for="opt in hintOptions" :key="opt.id" :value="opt.id">
          {{ opt.label }}
        </option>
      </select>
      <div class="nt-dealer-bar-actions">
        <span class="nt-dealer-stat-pill">
          已打 <b>{{ defeatedTotal }}</b>
          <template v-if="session.combo >= 2">
            · <em class="nt-dealer-combo">{{ session.combo }}连</em>
          </template>
        </span>
        <button
          type="button"
          class="btn"
          :class="{p: session.showReport}"
          @click="
            session.showReport ? game.closeReport() : game.openReport()
          "
        >
          {{ session.showReport ? '返回牌局' : '战报/分享' }}
        </button>
      </div>
    </div>

    <section
      v-if="session.showReport"
      class="nc nt-dealer-report"
      aria-label="痛扁发牌战报"
    >
      <div class="nt-dealer-poster-wrap">
        <img
          v-if="posterDataUrl"
          class="nt-dealer-poster-img"
          :src="posterDataUrl"
          :alt="`${rank.title} 战报图片`"
          width="760"
          height="520"
        />
      </div>

      <div class="nt-dealer-report-side">
        <div class="nt-dealer-report-actions">
          <button
            type="button"
            class="btn p nt-dealer-poster-primary"
            @click="copyShareImage"
          >
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
            @click="game.replayDaily"
          >
            重刷今日同题
          </button>
          <button
            v-if="state.mode === 'daily' && session.dailyCompleted"
            type="button"
            class="btn"
            @click="switchToFreeAfterDaily"
          >
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
          @focus="($event.target as HTMLTextAreaElement).select()"
        ></textarea>
      </div>
    </section>

    <template v-else>
      <section class="nc nt-dealer-stage" aria-label="本轮目标与发牌员状态">
        <div class="nt-dealer-mission">
          <div class="nt-dealer-mission-head">
            <span class="tag">{{ roundHeading }}</span>
            <span
              class="nt-dealer-target-badge"
              :style="{'--c': color(round.targetCovenant)}"
            >
              目标【{{ round.targetCovenant }}】
            </span>
            <span
              class="tag"
              :class="isRoundCleared ? 't' : 'r'"
            >
              {{
                isRoundCleared
                  ? '✓ 歪牌已清空'
                  : `找出 ${remainingImpostors} 张歪牌`
              }}
            </span>
          </div>
          <p class="nt-dealer-memo-main">{{ memo.summary }}</p>
          <p v-if="memo.bonus" class="nt-dealer-memo-bonus">
            <b>进阶</b>{{ memo.bonus }}
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
              :aria-label="`怒气值 ${session.rage}%`"
            >
              <div
                class="nt-dealer-rage-fill"
                :style="{width: `${session.rage}%`}"
              ></div>
              <span>怒气 {{ session.rage }}%</span>
            </div>
            <button
              type="button"
              class="btn nt-dealer-ult"
              :class="{p: canCastUltimate, ready: canCastUltimate}"
              :disabled="!canCastUltimate"
              @click="game.castUltimate"
            >
              ⚡ 物理校准
            </button>
          </div>
        </div>
      </section>

      <section class="nt-dealer-shop" aria-label="本轮商店发牌">
        <article
          v-for="(card, index) in round.cards"
          :key="`${round.roundNumber}-${card.operator.name}`"
          class="nt-dealer-card"
          :class="[card.status, {cleared: isRoundCleared}]"
          :data-t="card.operator.tier"
        >
          <button
            type="button"
            class="nt-dealer-pick"
            :disabled="card.status !== 'unseen' || isRoundCleared"
            :aria-label="
              card.status === 'unseen'
                ? `判定${card.operator.name}为歪牌并退货`
                : `${card.operator.name}：${card.operator.covenants.join('、')}`
            "
            @click="game.tapCard(index)"
          >
            <div class="nt-dealer-pic">
              <img
                :src="avatarSrc(card.operator.name)"
                alt=""
                width="52"
                height="52"
                loading="lazy"
                decoding="async"
              />
              <i class="nt-dealer-tier">{{
                TIER_LABELS[card.operator.tier]
              }}</i>
              <b
                v-if="card.status !== 'unseen'"
                class="nt-dealer-stamp"
                :class="card.status"
              >
                {{ statusLabels[card.status] }}
              </b>
            </div>

            <strong class="nt-dealer-name">{{ card.operator.name }}</strong>

            <template v-if="isRevealed(card.status)">
              <div class="nt-dealer-covs">
                <span
                  v-for="cov in card.operator.covenants"
                  :key="cov"
                  class="nt-dealer-cov"
                  :class="{match: cov === round.targetCovenant}"
                  :style="{'--c': color(cov)}"
                >
                  {{ cov }}
                </span>
              </div>
              <p
                class="nt-dealer-trait"
                :title="card.operator.trait"
              >
                <span
                  v-for="(seg, sIdx) in card.traitSegments"
                  :key="sIdx"
                  :class="`seg-${seg.kind}`"
                  >{{ seg.text }}</span
                >
              </p>
            </template>

            <template v-else-if="state.hintLevel === 'clue'">
              <span class="nt-dealer-clue">{{ card.triggerHint }}</span>
              <span class="nt-dealer-prompt"
                >{{ card.operator.covenants.length }} 盟约 ·
                {{ card.operator.type }}</span
              >
            </template>

            <template v-else>
              <span class="nt-dealer-prompt">不是【{{ round.targetCovenant }}】？</span>
              <span class="nt-dealer-hit-cta">👊 退货</span>
            </template>
          </button>

          <button
            type="button"
            class="nt-dealer-info"
            :aria-label="`查看${card.operator.name}详情`"
            title="查看干员详情"
            @click="actions.openDetail('op', card.operator.name)"
          >
            i
          </button>
        </article>
      </section>

      <footer class="nc nt-dealer-footer">
        <span class="nt-dealer-footer-tip">
          <template v-if="isRoundCleared">
            已翻开本轮全部 5 名干员盟约与特质，点右下角继续（左上角
            <b>i</b> 可查详情）。
          </template>
          <template v-else>
            点选不属于【{{ round.targetCovenant }}】的干员退货（误伤 {{
              session.stats.mistakes
            }} 次 · 无倒计时）。
          </template>
        </span>
        <div class="nt-dealer-footer-btns">
          <button
            v-if="state.mode === 'free' && session.stats.roundsCleared > 0"
            type="button"
            class="btn"
            @click="game.resetFree"
          >
            重置战绩
          </button>
          <button
            type="button"
            class="btn"
            :class="{p: isRoundCleared}"
            :disabled="!isRoundCleared"
            @click="game.nextRound"
          >
            {{
              !isRoundCleared
                ? `还剩 ${remainingImpostors} 张歪牌`
                : state.mode === 'daily' &&
                    round.roundNumber >= DAILY_ROUND_COUNT
                  ? '查看今日战报 🏆'
                  : '下一轮 →'
            }}
          </button>
        </div>
      </footer>
    </template>

    <LiveStatus :message="state.announcement"/>
  </div>
</template>
