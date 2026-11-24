import {
  DEALER_QUOTES_BY_GRADE,
  pickBySeed,
  RANK_SUBTITLES,
  VERDICT_DETAILS,
} from './copy.ts';
import type {
  DealerCard,
  DealerGrade,
  DealerMode,
  DealerPosterModel,
  DealerRank,
  DealerRound,
  DealerRoundKind,
  DealerStats,
  MatrixCell,
  PosterHintBadge,
  PosterRoundVerdict,
  RoundResultSummary,
} from './types.ts';
import {dailyTagFromKey} from './utils.ts';

const CIRCLED_NUMBERS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'] as const;

const DAILY_SCOPE_LABELS: Readonly<Record<DealerRoundKind, string>> = {
  covenant: '盟约点名',
  transmute: '同构转职',
  trigger: '特质时机',
  tier_check: '升本验阶',
  equipment: '装备整备',
  strategy: '开局策略',
  bounty: '悬赏猎金',
  scenario: '实战抓牌',
};

const FREE_SCOPE_PREFIX: Readonly<Record<DealerRoundKind, string>> = {
  covenant: '',
  transmute: '同构·',
  trigger: '时机·',
  tier_check: '验阶·',
  equipment: '装备·',
  strategy: '策略·',
  bounty: '悬赏·',
  scenario: '实战·',
};

export function cardMatrixCell(card: DealerCard): MatrixCell {
  if (card.status === 'punched') return '👊';
  if (card.status === 'calibrated') return '⚡';
  if (card.status === 'shielded') return '💥';
  return '🟩';
}

export function summarizeRound(round: DealerRound): RoundResultSummary {
  let mistakes = 0;
  let calibrated = false;
  const matrix = round.cards.map((card) => {
    if (card.status === 'shielded') mistakes++;
    if (card.status === 'calibrated') calibrated = true;
    return cardMatrixCell(card);
  });
  return {
    roundNumber: round.roundNumber,
    roundKind: round.kind,
    targetCovenant: round.targetCovenant,
    matrix,
    mistakes,
    calibrated,
    usedHint: round.usedHint,
  };
}

function statsFlavorSeed(stats: DealerStats): number {
  return Math.abs(
    stats.punched * 31 +
      stats.calibrated * 19 +
      stats.mistakes * 17 +
      stats.maxCombo * 13 +
      stats.roundsCleared * 7 +
      (stats.hintsUsed ?? 0) * 5,
  );
}

export function evaluateDealerRank(stats: DealerStats): DealerRank {
  const defeated = stats.punched + stats.calibrated;
  const attempts = defeated + stats.mistakes;
  const accuracy = attempts > 0 ? defeated / attempts : 0;
  const seed = statsFlavorSeed(stats);

  if (stats.roundsCleared === 0 && defeated === 0) {
    return {
      title: '蓄势待发的调度师',
      subtitle: pickBySeed(RANK_SUBTITLES.idle, seed),
      moodEmoji: '😏',
      dealerDamage: '满血挑衅中',
    };
  }
  if (stats.mistakes === 0 && stats.roundsCleared >= 3) {
    return {
      title: '发牌员连夜重写算法',
      subtitle: pickBySeed(RANK_SUBTITLES.sss, seed),
      moodEmoji: '🏳️',
      dealerDamage: '护甲清零 · 跪地求饶',
    };
  }
  if (accuracy >= 0.85) {
    return {
      title: '泰拉盟约活体图鉴',
      subtitle: pickBySeed(RANK_SUBTITLES.s, seed),
      moodEmoji: '🤕',
      dealerDamage: '鼻青脸肿 · 怀疑人生',
    };
  }
  if (accuracy >= 0.65) {
    return {
      title: '调度纠错专员',
      subtitle: pickBySeed(RANK_SUBTITLES.a, seed),
      moodEmoji: '😵‍💫',
      dealerDamage: '眼冒金星 · 老实了不少',
    };
  }
  return {
    title: '痛扁发牌见习生',
    subtitle: pickBySeed(RANK_SUBTITLES.b, seed),
    moodEmoji: '😰',
    dealerDamage: '额头冒汗 · 正在反省',
  };
}

function evaluateDealerGrade(
  stats: DealerStats,
  defeated: number,
  accuracy: number,
): DealerGrade {
  if (stats.roundsCleared >= 3 && stats.mistakes === 0) return 'SSS';
  if (accuracy >= 85 && (stats.roundsCleared >= 1 || defeated >= 2)) return 'S';
  if (accuracy >= 65 && defeated >= 1) return 'A';
  return 'B';
}

function summarizePerformance(stats: DealerStats) {
  const defeated = stats.punched + stats.calibrated;
  const attempts = defeated + stats.mistakes;
  const accuracy = attempts > 0 ? Math.round((defeated / attempts) * 100) : 100;
  const grade = evaluateDealerGrade(stats, defeated, accuracy);
  return {defeated, accuracy, grade};
}

function scopeLabelFor(
  mode: DealerMode,
  kind: DealerRoundKind,
  targetCovenant: string,
): string {
  if (mode === 'daily') {
    return DAILY_SCOPE_LABELS[kind];
  }
  return `${FREE_SCOPE_PREFIX[kind]}${targetCovenant}`;
}

function resolveHintBadge(
  stats: DealerStats,
  usedAssistOnly = false,
): PosterHintBadge {
  const hintsUsed = stats.hintsUsed ?? 0;
  const hintedRounds = stats.hintedRounds ?? 0;
  if (hintsUsed === 0 && hintedRounds === 0 && !usedAssistOnly) {
    return {text: '👁️ 全程盲猜', tone: 'blind'};
  }
  if (usedAssistOnly) {
    return {text: '📖 提示模式', tone: 'assist'};
  }
  return {text: `💡 场中提示 ×${Math.max(1, hintsUsed)}`, tone: 'hinted'};
}

function verdictForRound(
  mode: DealerMode,
  item: RoundResultSummary,
): PosterRoundVerdict {
  const scopeLabel = scopeLabelFor(
    mode,
    item.roundKind ?? 'covenant',
    item.targetCovenant,
  );
  const idx = Math.max(0, item.roundNumber - 1);
  if (item.calibrated) {
    return {
      roundNumber: item.roundNumber,
      scopeLabel,
      icon: '⚡',
      filledCells: 5,
      title: '物理校准',
      detail: item.usedHint
        ? '💡 本轮点过提示'
        : VERDICT_DETAILS.ult[idx % VERDICT_DETAILS.ult.length],
      usedHint: item.usedHint,
      tone: 'ult',
    };
  }
  if (item.mistakes === 0) {
    return {
      roundNumber: item.roundNumber,
      scopeLabel,
      icon: item.usedHint ? '💡' : '🎯',
      filledCells: 5,
      title: item.usedHint ? '借提示识破' : '一眼识破',
      detail: item.usedHint
        ? '💡 本轮点过提示'
        : VERDICT_DETAILS.good[idx % VERDICT_DETAILS.good.length],
      usedHint: item.usedHint,
      tone: 'good',
    };
  }
  return {
    roundNumber: item.roundNumber,
    scopeLabel,
    icon: '💥',
    filledCells: Math.max(1, 5 - item.mistakes),
    title: `误判 ×${item.mistakes}`,
    detail: item.usedHint
      ? '💡 本轮点过提示'
      : VERDICT_DETAILS.warn[idx % VERDICT_DETAILS.warn.length],
    usedHint: item.usedHint,
    tone: 'warn',
  };
}

/** Formats a spoiler-free shareable community message & site referral URL. */
export function formatDealerShareText(options: {
  mode: DealerMode;
  dateKey: string;
  history: readonly RoundResultSummary[];
  stats: DealerStats;
  shareUrl: string;
  usedAssistOnly?: boolean;
}): string {
  const {mode, dateKey, history, stats, shareUrl, usedAssistOnly} = options;
  const rank = evaluateDealerRank(stats);
  const {defeated, grade} = summarizePerformance(stats);
  const hintBadge = resolveHintBadge(stats, usedAssistOnly);
  const tag =
    mode === 'daily'
      ? `#${dailyTagFromKey(dateKey)}`
      : `自由拷打 ${stats.roundsCleared} 轮`;

  const lines: string[] = [
    `【卫戍速查 · 痛扁发牌 ${tag}】`,
    `评级：${grade} · ${rank.title} · ${hintBadge.text}`,
    `战绩：揪出串场 ${defeated} 次 · 误判 ${stats.mistakes} 次 · 最高 ${stats.maxCombo} 连扁`,
    '',
  ];

  const displayRounds = history.slice(-5);
  if (displayRounds.length) {
    const badges = displayRounds.map((item, i) => {
      const prefix =
        CIRCLED_NUMBERS[i] ?? `${String(item.roundNumber).padStart(2, '0')}`;
      const outcome = item.calibrated
        ? '⚡物理校准'
        : item.mistakes === 0
          ? '🎯零误判'
          : `💥误判${item.mistakes}`;
      const hintMark = item.usedHint ? '(💡)' : '';
      return `${prefix}${outcome}${hintMark}`;
    });
    lines.push(`拷打战况：${badges.join(' · ')}（🔒考题已防剧透隐藏）`);
  } else {
    lines.push('拷打战况：刚开局找发牌员算账中（🔒考题已防剧透隐藏）');
  }

  lines.push('');
  lines.push(
    mode === 'daily'
      ? `今日同题发牌，点这里也来揍一顿：${shareUrl}`
      : `卫戍协议速查 & 痛扁发牌员：${shareUrl}`,
  );
  return lines.join('\n');
}

/** Builds spoiler-free structured report data for Canvas poster rendering and tests. */
export function buildDealerPosterModel(options: {
  mode: DealerMode;
  dateKey: string;
  history: readonly RoundResultSummary[];
  currentRound?: DealerRound;
  stats: DealerStats;
  shareUrl: string;
  usedAssistOnly?: boolean;
}): DealerPosterModel {
  const {
    mode,
    dateKey,
    history,
    currentRound,
    stats,
    shareUrl,
    usedAssistOnly,
  } = options;
  const rank = evaluateDealerRank(stats);
  const {defeated, accuracy, grade} = summarizePerformance(stats);
  const hintBadge = resolveHintBadge(stats, usedAssistOnly);
  const hintsUsed = stats.hintsUsed ?? 0;
  const tag = dailyTagFromKey(dateKey);

  const verdicts: PosterRoundVerdict[] = history
    .slice(-5)
    .map((item) => verdictForRound(mode, item));

  if (
    verdicts.length < 5 &&
    currentRound &&
    (currentRound.cards.some((card) => card.status !== 'unseen') ||
      currentRound.usedHint) &&
    !verdicts.some((v) => v.roundNumber === currentRound.roundNumber)
  ) {
    verdicts.push({
      roundNumber: currentRound.roundNumber,
      scopeLabel: scopeLabelFor(
        mode,
        currentRound.kind,
        currentRound.targetCovenant,
      ),
      icon: currentRound.usedHint ? '💡' : '🕵️',
      filledCells: 2,
      title: '正在核对',
      detail: currentRound.usedHint ? '💡 本轮点过提示' : '本轮核对中',
      usedHint: currentRound.usedHint,
      tone: 'muted',
    });
  }

  while (verdicts.length < 5) {
    verdicts.push({
      roundNumber: verdicts.length + 1,
      scopeLabel: '待揭晓',
      icon: '🔒',
      filledCells: 0,
      title: '待挑战',
      detail: '名册防剧透',
      tone: 'empty',
    });
  }

  const dealerArmorPct =
    defeated === 0 ? 100 : grade === 'SSS' ? 0 : Math.max(5, 100 - defeated * 8);

  return {
    badgeText: '卫戍速查 · 痛扁发牌',
    modeLabel:
      mode === 'daily'
        ? `今日同题 #${tag}`
        : `自由拷打 ${stats.roundsCleared} 轮`,
    hintBadge,
    spoilerNotice: '🔒 考题防剧透',
    grade,
    rank,
    dealerArmorPct,
    dealerQuote: pickBySeed(
      DEALER_QUOTES_BY_GRADE[grade],
      statsFlavorSeed(stats) + history.length,
    ),
    metrics: [
      {label: '揪出串场', value: String(defeated), unit: '次', tone: 'accent'},
      {
        label: '误判队友',
        value: String(stats.mistakes),
        unit: '次',
        tone: stats.mistakes === 0 ? 'good' : 'warn',
      },
      {
        label: '最高连扁',
        value: String(stats.maxCombo),
        unit: '连',
        tone: 'teal',
      },
      {
        label: '识别准确率',
        value: `${accuracy}%`,
        unit: hintsUsed > 0 ? `含提示×${hintsUsed}` : `零提示·${stats.roundsCleared}轮`,
        tone: accuracy >= 85 ? 'good' : 'teal',
      },
    ],
    verdicts,
    ctaTitle:
      mode === 'daily'
        ? '今日同题发牌 · 搜【卫戍速查】或访问下方地址一起痛扁发牌员'
        : '卫戍协议速查 · 搜【卫戍速查】或访问下方地址一起痛扁发牌员',
    shareUrl,
    fileName: `卫戍速查-痛扁发牌-${mode === 'daily' ? tag : '自由拷打'}.png`,
  };
}
