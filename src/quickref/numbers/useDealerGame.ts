import {computed, reactive} from 'vue';
import {
  buildDailyRounds,
  buildDealerRound,
  createOrderSeed,
  createSeededRandom,
  covenantMemo,
  DAILY_ROUND_COUNT,
  evaluateDealerRank,
  formatDealerShareText,
  localDateKey,
  RAGE_PER_HIT,
  reactionLine,
  replayShuffleLine,
  SELECTABLE_COVENANTS,
  summarizeRound,
  type CardStatus,
  type DealerMode,
  type DealerRound,
  type DealerStats,
  type HintLevel,
  type MatrixCell,
  type RoundResultSummary,
} from '../../lib/dealerGame.ts';

const STORAGE_KEY = 'wsq.dealer.daily.v1';
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
  };
}

function createFreeRound(
  roundNumber: number,
  focusCovenant: string,
  previousCovenant = '',
): DealerRound {
  const pool = SELECTABLE_COVENANTS.filter((name) => name !== previousCovenant);
  const rng = createSeededRandom(
    `wsq.dealer.free:${Date.now()}:${roundNumber}:${Math.random()}`,
  );
  const picked =
    focusCovenant ||
    pool[Math.floor(rng() * pool.length)] ||
    SELECTABLE_COVENANTS[0];
  return buildDealerRound({roundNumber, targetCovenant: picked, rng});
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
    }
    fresh.history = saved.history.slice(0, maxHistory);
    fresh.roundIndex = Math.max(
      0,
      Math.min(DAILY_ROUND_COUNT - 1, Number(saved.roundIndex) || 0),
    );
    fresh.combo = Math.max(0, Number(saved.combo) || 0);
    fresh.rage = Math.max(0, Math.min(100, Number(saved.rage) || 0));
    fresh.dailyCompleted = Boolean(saved.dailyCompleted);
    fresh.showReport = fresh.dailyCompleted;
    if (saved.stats) {
      fresh.stats = {
        punched: Number(saved.stats.punched) || 0,
        calibrated: Number(saved.stats.calibrated) || 0,
        keptClean: Number(saved.stats.keptClean) || 0,
        mistakes: Number(saved.stats.mistakes) || 0,
        maxCombo: Number(saved.stats.maxCombo) || 0,
        roundsCleared: Number(saved.stats.roundsCleared) || maxHistory,
      };
    }
    const current = fresh.rounds[fresh.roundIndex];
    const cleared = current.cards
      .filter((card) => card.isImpostor)
      .every((card) => card.status !== 'unseen');
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
    const payload: StoredDailyState = {
      dateKey,
      orderSeed: session.orderSeed,
      roundIndex: session.roundIndex,
      history: session.history,
      stats: session.stats,
      combo: session.combo,
      rage: session.rage,
      dailyCompleted: session.dailyCompleted,
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
  const memo = computed(() => covenantMemo(round.value.targetCovenant));
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

  function tapCard(index: number): void {
    const s = session.value;
    const current = round.value;
    const card = current.cards[index];
    if (!card || card.status !== 'unseen' || roundCleared(current)) return;

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
        state.announcement = `揍飞歪牌${card.operator.name}，本轮【${current.targetCovenant}】歪牌已清空`;
      } else {
        s.lastEvent = 'hit';
        s.dealerLine = reactionLine(
          'hit',
          current.targetCovenant,
          s.combo,
          s.eventCount,
          card.operator,
        );
        state.announcement = `揍飞歪牌${card.operator.name}，真实盟约：${card.operator.covenants.join('、')}`;
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
      card.operator,
    );
    state.announcement = `${card.operator.name}属于【${current.targetCovenant}】，是自己人`;
  }

  function castUltimate(): void {
    const s = session.value;
    const current = round.value;
    if (s.rage < 100 || roundCleared(current)) return;

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
    state.announcement = `物理校准发动，一键清空 ${clearedCount} 张歪牌`;
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
        state.announcement = `进入今日第 ${s.roundIndex + 1} 轮：【${s.rounds[s.roundIndex].targetCovenant}】`;
      } else {
        s.showReport = true;
      }
      return;
    }

    const prevCovenant = round.value.targetCovenant;
    const next = createFreeRound(
      s.roundIndex + 2,
      state.focusCovenant,
      prevCovenant,
    );
    s.rounds.push(next);
    s.roundIndex = s.rounds.length - 1;
    s.lastEvent = 'deal';
    s.dealerLine = next.introLine;
    state.announcement = `刷新自由拷打第 ${next.roundNumber} 轮：【${next.targetCovenant}】`;
  }

  function setMode(mode: DealerMode): void {
    ensureCurrentDate();
    if (state.mode === mode) return;
    state.mode = mode;
    const s = activeSession();
    state.announcement =
      mode === 'daily'
        ? `已切换到今日同题第 ${s.roundIndex + 1} 轮`
        : `已切换到自由拷打：【${round.value.targetCovenant}】`;
  }

  function setFocusCovenant(covenant: string): void {
    state.focusCovenant = covenant;
    if (state.mode !== 'free') return;
    const s = state.free;
    const fresh = createFreeRound(
      s.rounds.length + 1,
      covenant,
      round.value.targetCovenant,
    );
    s.rounds.push(fresh);
    s.roundIndex = s.rounds.length - 1;
    s.lastEvent = 'deal';
    s.dealerLine = fresh.introLine;
    s.showReport = false;
  }

  function setHintLevel(level: HintLevel): void {
    state.hintLevel = level;
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
    state.announcement = '已重新洗牌今日同题 5 轮（题目不变，牌序已打乱）';
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
    });
  }

  return {
    state,
    session,
    round,
    memo,
    isRoundCleared,
    remainingImpostors,
    canCastUltimate,
    rank,
    dealerMood,
    tapCard,
    castUltimate,
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
