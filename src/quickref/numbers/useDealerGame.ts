import {computed, reactive} from 'vue';
import {
  BOUNTY_THEMES,
  buildDailyRounds,
  buildDealerRound,
  createOrderSeed,
  createSeededRandom,
  DAILY_ROUND_COUNT,
  EQUIP_THEMES,
  evaluateDealerRank,
  formatDealerShareText,
  localDateKey,
  RAGE_PER_HIT,
  reactionLine,
  replayShuffleLine,
  SELECTABLE_COVENANTS,
  STRATEGY_THEMES,
  summarizeRound,
  TIER_CHECK_THEMES,
  TRANSMUTE_COVENANTS,
  TRIGGER_THEMES,
  type BountyChallengeTheme,
  type CardStatus,
  type DealerMode,
  type DealerRound,
  type DealerRoundKind,
  type DealerStats,
  type EquipChallengeTheme,
  type HintLevel,
  type MatrixCell,
  type RoundResultSummary,
  type StrategyChallengeTheme,
  type TierCheckTheme,
  type TriggerChallengeTheme,
} from '../../lib/dealer/index.ts';

const STORAGE_KEY = 'wsq.dealer.daily.v3';
const MATRIX_TO_STATUS: Readonly<Record<MatrixCell, CardStatus>> = {
  '👊': 'punched',
  '⚡': 'calibrated',
  '💥': 'shielded',
  '🟩': 'kept',
};

interface ModeSession {
  orderSeed: string;
  roundIndex: number;
  rounds: DealerRound[];
  history: RoundResultSummary[];
  stats: DealerStats;
  combo: number;
  rage: number;
  lastEvent: 'deal' | 'hit' | 'miss' | 'ultimate' | 'clear';
  dealerLine: string;
  eventCount: number;
  dailyCompleted: boolean;
  showReport: boolean;
  playedBlind: boolean;
  startedAssist: boolean;
}

interface StoredDailyState {
  dateKey: string;
  orderSeed?: string;
  roundIndex: number;
  history: RoundResultSummary[];
  stats: DealerStats;
  combo: number;
  rage: number;
  dailyCompleted: boolean;
  playedBlind?: boolean;
  startedAssist?: boolean;
  currentUsedHint?: boolean;
  currentHintRevealed?: boolean;
}

let replaySeq = 0;

function emptyStats(): DealerStats {
  return {
    punched: 0,
    calibrated: 0,
    keptClean: 0,
    mistakes: 0,
    maxCombo: 0,
    roundsCleared: 0,
    hintsUsed: 0,
    hintedRounds: 0,
  };
}

function pickAvoid<T>(
  basePool: readonly T[],
  avoid: T | undefined,
  rng: () => number,
): T {
  const filtered = avoid === undefined ? basePool : basePool.filter((x) => x !== avoid);
  const pool = filtered.length ? filtered : basePool;
  return pool[Math.floor(rng() * pool.length)] ?? basePool[0];
}

const FOCUS_KIND_MAP: Readonly<Record<string, DealerRoundKind>> = {
  'kind:covenant': 'covenant',
  'kind:transmute': 'transmute',
  'kind:trigger': 'trigger',
  'kind:tier_check': 'tier_check',
  'kind:equipment': 'equipment',
  'kind:strategy': 'strategy',
  'kind:bounty': 'bounty',
};

const FREE_ROUND_CYCLE: readonly DealerRoundKind[] = [
  'covenant',
  'trigger',
  'transmute',
  'tier_check',
  'equipment',
  'strategy',
  'bounty',
];

function createFreeRound(
  roundNumber: number,
  focus: string,
  prevRound?: DealerRound,
): DealerRound {
  const rng = createSeededRandom(
    `wsq.dealer.free:${Date.now()}:${roundNumber}:${Math.random()}`,
  );

  let kind: DealerRoundKind;
  let targetCovenant = '';
  let equipTheme: EquipChallengeTheme | undefined;
  let triggerTheme: TriggerChallengeTheme | undefined;
  let tierCheckTheme: TierCheckTheme | undefined;
  let strategyTheme: StrategyChallengeTheme | undefined;
  let bountyTheme: BountyChallengeTheme | undefined;

  if (focus in FOCUS_KIND_MAP) {
    kind = FOCUS_KIND_MAP[focus];
  } else if (focus) {
    kind =
      TRANSMUTE_COVENANTS.includes(focus) && roundNumber % 2 === 0
        ? 'transmute'
        : 'covenant';
    targetCovenant = focus;
  } else {
    kind = FREE_ROUND_CYCLE[(roundNumber - 1) % FREE_ROUND_CYCLE.length];
  }

  if (kind === 'equipment') {
    equipTheme = pickAvoid(EQUIP_THEMES, prevRound?.equipTheme, rng);
  } else if (kind === 'trigger') {
    triggerTheme = pickAvoid(TRIGGER_THEMES, prevRound?.triggerTheme, rng);
  } else if (kind === 'tier_check') {
    tierCheckTheme = pickAvoid(
      TIER_CHECK_THEMES,
      prevRound?.tierCheckTheme,
      rng,
    );
  } else if (kind === 'strategy') {
    strategyTheme = pickAvoid(STRATEGY_THEMES, prevRound?.strategyTheme, rng);
  } else if (kind === 'bounty') {
    bountyTheme = pickAvoid(BOUNTY_THEMES, prevRound?.bountyTheme, rng);
  } else if (!targetCovenant) {
    const basePool =
      kind === 'transmute' ? TRANSMUTE_COVENANTS : SELECTABLE_COVENANTS;
    const prevCov =
      prevRound && (prevRound.kind === 'covenant' || prevRound.kind === 'transmute')
        ? prevRound.targetCovenant
        : undefined;
    targetCovenant = pickAvoid(basePool, prevCov, rng);
  }

  return buildDealerRound({
    roundNumber,
    kind,
    targetCovenant: targetCovenant || undefined,
    equipTheme,
    triggerTheme,
    tierCheckTheme,
    strategyTheme,
    bountyTheme,
    rng,
  });
}

function createDailySession(
  dateKey: string,
  orderSeed = createOrderSeed(),
): ModeSession {
  const rounds = buildDailyRounds(dateKey, orderSeed);
  return {
    orderSeed,
    roundIndex: 0,
    rounds,
    history: [],
    stats: emptyStats(),
    combo: 0,
    rage: 0,
    lastEvent: 'deal',
    dealerLine: rounds[0].introLine,
    eventCount: 0,
    dailyCompleted: false,
    showReport: false,
    playedBlind: false,
    startedAssist: false,
  };
}

function createFreeSession(focusCovenant: string): ModeSession {
  const first = createFreeRound(1, focusCovenant);
  return {
    orderSeed: '',
    roundIndex: 0,
    rounds: [first],
    history: [],
    stats: emptyStats(),
    combo: 0,
    rage: 0,
    lastEvent: 'deal',
    dealerLine: first.introLine,
    eventCount: 0,
    dailyCompleted: false,
    showReport: false,
    playedBlind: false,
    startedAssist: false,
  };
}

function isValidMatrix(
  round: DealerRound,
  matrix: unknown,
): matrix is MatrixCell[] {
  return (
    Array.isArray(matrix) &&
    matrix.length === round.cards.length &&
    matrix.every((cell, cardIdx) => {
      if (typeof cell !== 'string' || !(cell in MATRIX_TO_STATUS)) {
        return false;
      }
      const isImpostor = round.cards[cardIdx]?.isImpostor;
      return cell === '👊' || cell === '⚡' ? isImpostor : !isImpostor;
    })
  );
}

function loadDailySession(dateKey: string): ModeSession {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDailySession(dateKey);
    const saved = JSON.parse(raw) as Partial<StoredDailyState>;
    if (
      saved.dateKey !== dateKey ||
      typeof saved.orderSeed !== 'string' ||
      !saved.orderSeed ||
      !Array.isArray(saved.history)
    ) {
      return createDailySession(dateKey);
    }
    const fresh = createDailySession(dateKey, saved.orderSeed);
    const maxHistory = Math.min(saved.history.length, DAILY_ROUND_COUNT);
    for (let i = 0; i < maxHistory; i++) {
      const item = saved.history[i];
      const round = fresh.rounds[i];
      if (!item || !isValidMatrix(round, item.matrix)) {
        return createDailySession(dateKey);
      }
      round.cards.forEach((card, cardIdx) => {
        card.status = MATRIX_TO_STATUS[item.matrix[cardIdx]];
      });
      round.usedHint = Boolean(item.usedHint);
    }
    fresh.history = saved.history.slice(0, maxHistory).map((item, i) => ({
      roundNumber: item.roundNumber || i + 1,
      roundKind: item.roundKind ?? fresh.rounds[i].kind,
      targetCovenant: item.targetCovenant || fresh.rounds[i].targetCovenant,
      matrix: item.matrix,
      mistakes: Number(item.mistakes) || 0,
      calibrated: Boolean(item.calibrated),
      usedHint: Boolean(item.usedHint),
    }));
    fresh.roundIndex = Math.max(
      0,
      Math.min(DAILY_ROUND_COUNT - 1, Number(saved.roundIndex) || 0),
    );
    fresh.combo = Math.max(0, Number(saved.combo) || 0);
    fresh.rage = Math.max(0, Math.min(100, Number(saved.rage) || 0));
    fresh.dailyCompleted = Boolean(saved.dailyCompleted);
    fresh.showReport = fresh.dailyCompleted;
    fresh.playedBlind = Boolean(saved.playedBlind);
    fresh.startedAssist = Boolean(saved.startedAssist);
    if (saved.stats) {
      fresh.stats = {
        punched: Number(saved.stats.punched) || 0,
        calibrated: Number(saved.stats.calibrated) || 0,
        keptClean: Number(saved.stats.keptClean) || 0,
        mistakes: Number(saved.stats.mistakes) || 0,
        maxCombo: Number(saved.stats.maxCombo) || 0,
        roundsCleared: Number(saved.stats.roundsCleared) || maxHistory,
        hintsUsed: Number(saved.stats.hintsUsed) || 0,
        hintedRounds: Number(saved.stats.hintedRounds) || 0,
      };
    }
    const current = fresh.rounds[fresh.roundIndex];
    const cleared = current.cards
      .filter((card) => card.isImpostor)
      .every((card) => card.status !== 'unseen');
    if (!cleared) {
      current.usedHint = Boolean(saved.currentUsedHint);
      current.hintRevealed = Boolean(saved.currentHintRevealed);
    }
    fresh.lastEvent = cleared ? 'clear' : 'deal';
    fresh.dealerLine = cleared
      ? reactionLine('clear', current.targetCovenant, fresh.combo, maxHistory)
      : current.introLine;
    return fresh;
  } catch {
    return createDailySession(dateKey);
  }
}

function saveDailySession(dateKey: string, session: ModeSession): void {
  try {
    const activeRound =
      session.rounds[Math.min(session.roundIndex, session.rounds.length - 1)];
    const payload: StoredDailyState = {
      dateKey,
      orderSeed: session.orderSeed,
      roundIndex: session.roundIndex,
      history: session.history,
      stats: session.stats,
      combo: session.combo,
      rage: session.rage,
      dailyCompleted: session.dailyCompleted,
      playedBlind: session.playedBlind,
      startedAssist: session.startedAssist,
      currentUsedHint: activeRound?.usedHint ?? false,
      currentHintRevealed: activeRound?.hintRevealed ?? false,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* 存储受限时仅保留当次页面会话，不影响游玩。 */
  }
}

const initialDate = localDateKey();
const state = reactive({
  dateKey: initialDate,
  mode: 'daily' as DealerMode,
  hintLevel: 'blind' as HintLevel,
  focusCovenant: '',
  announcement: '',
  daily: loadDailySession(initialDate),
  free: createFreeSession(''),
});

function ensureCurrentDate(): void {
  const today = localDateKey();
  if (state.dateKey === today) return;
  state.dateKey = today;
  state.daily = createDailySession(today);
}

function activeSession(): ModeSession {
  ensureCurrentDate();
  return state.mode === 'daily' ? state.daily : state.free;
}

function roundCleared(round: DealerRound): boolean {
  return round.cards
    .filter((card) => card.isImpostor)
    .every((card) => card.status !== 'unseen');
}

function markRoundHint(
  session: ModeSession,
  round: DealerRound,
  incrementCount: boolean,
): void {
  if (roundCleared(round)) return;
  const firstHintInRound = !round.usedHint;
  if (firstHintInRound) {
    round.usedHint = true;
  }
  const prevHints = session.stats.hintsUsed ?? 0;
  const prevHintedRounds = session.stats.hintedRounds ?? 0;
  session.stats = {
    ...session.stats,
    hintsUsed: incrementCount ? prevHints + 1 : prevHints,
    hintedRounds: firstHintInRound ? prevHintedRounds + 1 : prevHintedRounds,
  };
  if (state.mode === 'daily') {
    saveDailySession(state.dateKey, session);
  }
}

function completeCurrentRound(
  session: ModeSession,
  round: DealerRound,
  usedUltimate: boolean,
): void {
  let keptCount = 0;
  for (const card of round.cards) {
    if (card.status === 'unseen') {
      card.status = 'kept';
      if (!card.isImpostor) keptCount++;
    }
  }
  const summary = summarizeRound(round);
  if (session.history.length <= session.roundIndex) {
    session.history.push(summary);
  }
  session.stats = {
    ...session.stats,
    keptClean: session.stats.keptClean + keptCount,
    roundsCleared: session.history.length,
  };
  session.eventCount++;
  session.lastEvent = usedUltimate ? 'ultimate' : 'clear';
  session.dealerLine = reactionLine(
    session.lastEvent,
    round.targetCovenant,
    session.combo,
    session.eventCount,
  );
  if (state.mode === 'daily') {
    if (session.roundIndex >= DAILY_ROUND_COUNT - 1) {
      session.dailyCompleted = true;
      session.showReport = true;
    }
    saveDailySession(state.dateKey, session);
  }
}

/** 轻量无倒计时小游戏状态，切出查攻略后返回仍保留当前手牌与连击。 */
export function useDealerGame() {
  const session = computed(() => activeSession());
  const round = computed(() => {
    const s = session.value;
    return s.rounds[Math.min(s.roundIndex, s.rounds.length - 1)];
  });
  const isRoundCleared = computed(() => roundCleared(round.value));
  const remainingImpostors = computed(
    () =>
      round.value.cards.filter(
        (card) => card.isImpostor && card.status === 'unseen',
      ).length,
  );
  const canCastUltimate = computed(
    () => session.value.rage >= 100 && remainingImpostors.value > 0,
  );
  const rank = computed(() => evaluateDealerRank(session.value.stats));
  const usedAssistOnly = computed(() => {
    const s = session.value;
    return (
      !s.playedBlind && (s.startedAssist || state.hintLevel !== 'blind')
    );
  });
  const dealerMood = computed(() => {
    const s = session.value;
    if (s.lastEvent === 'ultimate' || s.rage >= 100) {
      return {emoji: '🏳️', label: '跪地求饶', tier: 'broken'};
    }
    if (s.lastEvent === 'miss') {
      return {emoji: '😏', label: '偷笑得意', tier: 'smug'};
    }
    if (s.combo >= 3 || s.lastEvent === 'clear') {
      return {emoji: '🤕', label: '鼻青脸肿', tier: 'hurt'};
    }
    if (s.combo >= 1) {
      return {emoji: '😰', label: '额头冒汗', tier: 'sweat'};
    }
    return {emoji: '😎', label: '读心挑衅', tier: 'cocky'};
  });

  function recordRoundInteraction(s: ModeSession, current: DealerRound): void {
    if (state.hintLevel === 'blind') {
      s.playedBlind = true;
    } else {
      if (!s.playedBlind) s.startedAssist = true;
      if (!current.usedHint) {
        markRoundHint(s, current, true);
      }
    }
  }

  function tapCard(index: number): void {
    const s = session.value;
    const current = round.value;
    const card = current.cards[index];
    if (!card || card.status !== 'unseen' || roundCleared(current)) return;

    recordRoundInteraction(s, current);
    s.eventCount++;
    if (card.isImpostor) {
      card.status = 'punched';
      s.combo++;
      s.rage = Math.min(100, s.rage + RAGE_PER_HIT);
      s.stats = {
        ...s.stats,
        punched: s.stats.punched + 1,
        maxCombo: Math.max(s.stats.maxCombo, s.combo),
      };
      if (roundCleared(current)) {
        completeCurrentRound(s, current, false);
        state.announcement = `识破串场条目「${card.title}」，本轮【${current.targetCovenant}】已理清`;
      } else {
        s.lastEvent = 'hit';
        s.dealerLine = reactionLine(
          'hit',
          current.targetCovenant,
          s.combo,
          s.eventCount,
          {name: card.title},
        );
        state.announcement = `识破串场条目「${card.title}」，痛扁发牌员一拳`;
      }
      return;
    }

    card.status = 'shielded';
    s.combo = 0;
    s.stats = {
      ...s.stats,
      mistakes: s.stats.mistakes + 1,
    };
    s.lastEvent = 'miss';
    s.dealerLine = reactionLine(
      'miss',
      current.targetCovenant,
      0,
      s.eventCount,
      {name: card.title},
    );
    state.announcement = `「${card.title}」符合【${current.targetCovenant}】要求，误判提示`;
  }

  function castUltimate(): void {
    const s = session.value;
    const current = round.value;
    if (s.rage < 100 || roundCleared(current)) return;

    recordRoundInteraction(s, current);
    let clearedCount = 0;
    for (const card of current.cards) {
      if (card.isImpostor && card.status === 'unseen') {
        card.status = 'calibrated';
        clearedCount++;
      }
    }
    if (!clearedCount) return;

    s.combo += clearedCount;
    s.rage = 0;
    s.stats = {
      ...s.stats,
      calibrated: s.stats.calibrated + clearedCount,
      maxCombo: Math.max(s.stats.maxCombo, s.combo),
    };
    completeCurrentRound(s, current, true);
    state.announcement = `物理校准发动，痛扁发牌员并理清 ${clearedCount} 项串场`;
  }

  /** 在盲猜模式中主动点开本轮卡面线索提示（仅对当前轮生效，同时计入提示统计）。 */
  function requestRoundHint(): void {
    const s = session.value;
    const current = round.value;
    if (state.hintLevel !== 'blind' || roundCleared(current)) return;
    s.playedBlind = true;
    if (current.hintRevealed) return;
    current.hintRevealed = true;
    markRoundHint(s, current, true);
    state.announcement = `已开启第 ${current.roundNumber} 轮提示线索，将在战报中标注`;
  }

  /** 在本轮未通关时点击未翻开卡牌/携带装备详情也记录为场中查阅提示；通关复盘不计。 */
  function recordDetailPeek(index: number): void {
    const s = session.value;
    const current = round.value;
    const card = current.cards[index];
    if (!card || roundCleared(current) || card.status !== 'unseen') return;
    if (state.hintLevel === 'open') return;
    if (state.hintLevel === 'blind') {
      s.playedBlind = true;
    }
    markRoundHint(s, current, true);
    state.announcement = `查阅「${card.title}」详情，已计入场中提示`;
  }

  function nextRound(): void {
    const s = session.value;
    if (!roundCleared(round.value)) return;
    if (state.mode === 'daily') {
      if (s.roundIndex < DAILY_ROUND_COUNT - 1) {
        s.roundIndex++;
        s.lastEvent = 'deal';
        s.dealerLine = s.rounds[s.roundIndex].introLine;
        saveDailySession(state.dateKey, s);
        state.announcement = `进入今日第 ${s.roundIndex + 1} 轮：${s.rounds[s.roundIndex].targetLabel}`;
      } else {
        s.showReport = true;
      }
      return;
    }

    const prevRound = round.value;
    const next = createFreeRound(s.roundIndex + 2, state.focusCovenant, prevRound);
    s.rounds.push(next);
    s.roundIndex = s.rounds.length - 1;
    s.lastEvent = 'deal';
    s.dealerLine = next.introLine;
    state.announcement = `刷新自由拷打第 ${next.roundNumber} 轮：${next.targetLabel}`;
  }

  function setMode(mode: DealerMode): void {
    ensureCurrentDate();
    if (state.mode === mode) return;
    state.mode = mode;
    const s = activeSession();
    state.announcement =
      mode === 'daily'
        ? `已切换到今日同题第 ${s.roundIndex + 1} 轮`
        : `已切换到自由拷打：${round.value.targetLabel}`;
  }

  function setFocusCovenant(focus: string): void {
    state.focusCovenant = focus;
    if (state.mode !== 'free') return;
    const s = state.free;
    const fresh = createFreeRound(s.rounds.length + 1, focus, round.value);
    s.rounds.push(fresh);
    s.roundIndex = s.rounds.length - 1;
    s.lastEvent = 'deal';
    s.dealerLine = fresh.introLine;
    s.showReport = false;
  }

  function setHintLevel(level: HintLevel): void {
    state.hintLevel = level;
    const s = session.value;
    const current = round.value;
    if (level !== 'blind') {
      const untouchedAtStart =
        !s.playedBlind &&
        s.history.length === 0 &&
        current.cards.every((card) => card.status === 'unseen') &&
        !current.usedHint;
      if (untouchedAtStart) {
        s.startedAssist = true;
      } else {
        s.playedBlind = true;
      }
      if (!roundCleared(current)) {
        markRoundHint(s, current, !current.usedHint);
      }
    }
  }

  function openReport(): void {
    session.value.showReport = true;
  }

  function closeReport(): void {
    session.value.showReport = false;
  }

  function replayDaily(): void {
    ensureCurrentDate();
    replaySeq++;
    const replayed = createDailySession(state.dateKey, createOrderSeed());
    replayed.dealerLine = replayShuffleLine(Date.now() + replaySeq);
    state.daily = replayed;
    saveDailySession(state.dateKey, state.daily);
    state.announcement = '已重新洗牌今日同题 5 轮（题目不变，站位已打乱）';
  }

  function resetFree(): void {
    state.free = createFreeSession(state.focusCovenant);
    state.announcement = '已重置自由拷打战绩';
  }

  function buildShareText(shareUrl: string): string {
    const s = session.value;
    return formatDealerShareText({
      mode: state.mode,
      dateKey: state.dateKey,
      history: s.history,
      stats: s.stats,
      shareUrl,
      usedAssistOnly: usedAssistOnly.value,
    });
  }

  return {
    state,
    session,
    round,
    isRoundCleared,
    remainingImpostors,
    canCastUltimate,
    rank,
    usedAssistOnly,
    dealerMood,
    tapCard,
    castUltimate,
    requestRoundHint,
    recordDetailPeek,
    nextRound,
    setMode,
    setFocusCovenant,
    setHintLevel,
    openReport,
    closeReport,
    replayDaily,
    resetFree,
    buildShareText,
  };
}
