import {buildDealerRound} from './rounds.ts';
import {
  BOUNTY_THEMES,
  EQUIP_THEMES,
  SELECTABLE_COVENANTS,
  STRATEGY_THEMES,
  TIER_CHECK_THEMES,
  TRANSMUTE_COVENANTS,
  TRIGGER_THEMES,
} from './themes.ts';
import type {
  BountyChallengeTheme,
  DealerCard,
  DealerKnowledgeRoundKind,
  DealerMistakeRecord,
  DealerRound,
  EquipChallengeTheme,
  StrategyChallengeTheme,
  TierCheckTheme,
  TriggerChallengeTheme,
} from './types.ts';

export const DEALER_MISTAKES_STORAGE_KEY = 'wsq.dealer.mistakes.v1';
export const MAX_MISTAKE_RECORDS = 150;
export const MISTAKE_MASTERY_STREAK = 2;

export const MISTAKE_KIND_LABELS: Readonly<
  Record<DealerKnowledgeRoundKind, string>
> = {
  covenant: '盟约点名',
  transmute: '同构转职',
  trigger: '特质时机',
  tier_check: '升本验阶',
  equipment: '装备整备',
  strategy: '开局策略',
  bounty: '悬赏猎金',
};

const VALID_KNOWLEDGE_KINDS = new Set<string>(Object.keys(MISTAKE_KIND_LABELS));
const VALID_CARD_KINDS = new Set<string>([
  'operator',
  'equipment',
  'strategy',
  'bounty',
]);
const VALID_DETAIL_KINDS = new Set<string>(['op', 'eq', 'st']);

export function isKnowledgeRoundKind(
  kind: string,
): kind is DealerKnowledgeRoundKind {
  return VALID_KNOWLEDGE_KINDS.has(kind);
}

export function roundTargetKey(round: DealerRound): string | null {
  switch (round.kind) {
    case 'covenant':
    case 'transmute':
      return round.targetCovenant || null;
    case 'equipment':
      return round.equipTheme ?? null;
    case 'trigger':
      return round.triggerTheme ?? null;
    case 'tier_check':
      return round.tierCheckTheme ?? null;
    case 'strategy':
      return round.strategyTheme ?? null;
    case 'bounty':
      return round.bountyTheme ?? null;
    case 'scenario':
      return null;
  }
}

export function mistakeKey(
  roundKind: DealerKnowledgeRoundKind,
  targetKey: string,
  title: string,
): string {
  return `${roundKind}:${targetKey}:${title}`;
}

export function isMistakeMastered(record: DealerMistakeRecord): boolean {
  return record.correctStreak >= MISTAKE_MASTERY_STREAK;
}

function trimMistakes(
  records: readonly DealerMistakeRecord[],
): DealerMistakeRecord[] {
  if (records.length <= MAX_MISTAKE_RECORDS) return [...records];
  // Prioritize keeping unmastered mistakes and more recent / higher-error items.
  return [...records]
    .sort(
      (a, b) =>
        Number(isMistakeMastered(a)) - Number(isMistakeMastered(b)) ||
        b.wrongCount - a.wrongCount ||
        b.lastWrongAt - a.lastWrongAt,
    )
    .slice(0, MAX_MISTAKE_RECORDS);
}

export function normalizeMistakes(raw: unknown): DealerMistakeRecord[] {
  if (!Array.isArray(raw)) return [];
  const byKey = new Map<string, DealerMistakeRecord>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const entry = item as Record<string, unknown>;
    const roundKind = String(entry.roundKind ?? '');
    const cardKind = String(entry.cardKind ?? '');
    const title = String(entry.title ?? '').trim();
    const targetKey = String(entry.targetKey ?? '').trim();
    const targetLabel = String(entry.targetLabel ?? targetKey).trim();
    if (
      !isKnowledgeRoundKind(roundKind) ||
      !VALID_CARD_KINDS.has(cardKind) ||
      !title ||
      !targetKey
    ) {
      continue;
    }
    const detailKind =
      typeof entry.detailKind === 'string' &&
      VALID_DETAIL_KINDS.has(entry.detailKind)
        ? (entry.detailKind as 'op' | 'eq' | 'st')
        : undefined;
    const key = mistakeKey(roundKind, targetKey, title);
    const wrongCount = Math.max(
      1,
      Math.round(Number(entry.wrongCount) || 1),
    );
    const correctStreak = Math.max(
      0,
      Math.round(Number(entry.correctStreak) || 0),
    );
    const lastWrongAt = Math.max(0, Math.round(Number(entry.lastWrongAt) || 0));

    const prev = byKey.get(key);
    if (!prev || lastWrongAt >= prev.lastWrongAt) {
      byKey.set(key, {
        key,
        cardKind: cardKind as DealerCard['cardKind'],
        title,
        detailKind,
        roundKind,
        targetKey,
        targetLabel,
        wrongCount: prev ? Math.max(prev.wrongCount, wrongCount) : wrongCount,
        correctStreak,
        lastWrongAt,
      });
    }
  }
  return trimMistakes([...byKey.values()]);
}

export function recordMistake(
  records: readonly DealerMistakeRecord[],
  round: DealerRound,
  card: DealerCard,
  now = Date.now(),
): DealerMistakeRecord[] {
  if (!isKnowledgeRoundKind(round.kind)) return [...records];
  const targetKey = roundTargetKey(round);
  if (!targetKey) return [...records];

  const key = mistakeKey(round.kind, targetKey, card.title);
  const existing = records.find((item) => item.key === key);
  const nextRecord: DealerMistakeRecord = existing
    ? {
        ...existing,
        targetLabel: round.targetCovenant || existing.targetLabel,
        detailKind: card.detailKind ?? existing.detailKind,
        wrongCount: existing.wrongCount + 1,
        correctStreak: 0,
        lastWrongAt: now,
      }
    : {
        key,
        cardKind: card.cardKind,
        title: card.title,
        detailKind: card.detailKind,
        roundKind: round.kind,
        targetKey,
        targetLabel: round.targetCovenant || targetKey,
        wrongCount: 1,
        correctStreak: 0,
        lastWrongAt: now,
      };

  const next = existing
    ? records.map((item) => (item.key === key ? nextRecord : item))
    : [nextRecord, ...records];
  return trimMistakes(next);
}

/** Updates mastery streaks for previously missed items handled cleanly in a completed round. */
export function recordRoundMastery(
  records: readonly DealerMistakeRecord[],
  round: DealerRound,
): DealerMistakeRecord[] {
  if (!records.length || !isKnowledgeRoundKind(round.kind)) return [...records];
  const targetKey = roundTargetKey(round);
  if (!targetKey) return [...records];

  const cleanKeys = new Set<string>();
  for (const card of round.cards) {
    // 错题只记录被误击的正常牌。同一干员换装后可能成为串场牌，不应据此计为掌握。
    if (card.status === 'kept' && !card.isImpostor) {
      cleanKeys.add(mistakeKey(round.kind, targetKey, card.title));
    }
  }
  if (!cleanKeys.size) return [...records];

  let changed = false;
  const next = records.map((item) => {
    if (!cleanKeys.has(item.key) || isMistakeMastered(item)) return item;
    changed = true;
    return {
      ...item,
      correctStreak: item.correctStreak + 1,
    };
  });
  return changed ? next : [...records];
}

export function activeMistakes(
  records: readonly DealerMistakeRecord[],
): DealerMistakeRecord[] {
  return records
    .filter((item) => !isMistakeMastered(item))
    .sort(
      (a, b) =>
        b.wrongCount - a.wrongCount ||
        b.lastWrongAt - a.lastWrongAt ||
        a.title.localeCompare(b.title, 'zh-CN'),
    );
}

export function masteredMistakeCount(
  records: readonly DealerMistakeRecord[],
): number {
  return records.filter(isMistakeMastered).length;
}

export function mistakeStatsByKind(
  records: readonly DealerMistakeRecord[],
): {
  readonly kind: DealerKnowledgeRoundKind;
  readonly label: string;
  readonly count: number;
}[] {
  const counts = new Map<DealerKnowledgeRoundKind, number>();
  for (const item of records) {
    if (isMistakeMastered(item)) continue;
    counts.set(item.roundKind, (counts.get(item.roundKind) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([kind, count]) => ({
      kind,
      label: MISTAKE_KIND_LABELS[kind],
      count,
    }))
    .sort((a, b) => b.count - a.count);
}

function buildRoundForMistake(
  record: DealerMistakeRecord,
  roundNumber: number,
  rng: () => number,
  orderRng?: () => number,
): DealerRound | null {
  const common = {
    roundNumber,
    rng,
    orderRng,
    forceIncludeName: record.title,
  };

  let round: DealerRound | null = null;
  if (record.roundKind === 'covenant') {
    if (!SELECTABLE_COVENANTS.includes(record.targetKey)) return null;
    round = buildDealerRound({
      ...common,
      kind: 'covenant',
      targetCovenant: record.targetKey,
    });
  } else if (record.roundKind === 'transmute') {
    if (!TRANSMUTE_COVENANTS.includes(record.targetKey)) return null;
    round = buildDealerRound({
      ...common,
      kind: 'transmute',
      targetCovenant: record.targetKey,
    });
  } else if (record.roundKind === 'equipment') {
    if (!EQUIP_THEMES.includes(record.targetKey as EquipChallengeTheme)) {
      return null;
    }
    round = buildDealerRound({
      ...common,
      kind: 'equipment',
      equipTheme: record.targetKey as EquipChallengeTheme,
    });
  } else if (record.roundKind === 'trigger') {
    if (!TRIGGER_THEMES.includes(record.targetKey as TriggerChallengeTheme)) {
      return null;
    }
    round = buildDealerRound({
      ...common,
      kind: 'trigger',
      triggerTheme: record.targetKey as TriggerChallengeTheme,
    });
  } else if (record.roundKind === 'tier_check') {
    if (!TIER_CHECK_THEMES.includes(record.targetKey as TierCheckTheme)) {
      return null;
    }
    round = buildDealerRound({
      ...common,
      kind: 'tier_check',
      tierCheckTheme: record.targetKey as TierCheckTheme,
    });
  } else if (record.roundKind === 'strategy') {
    if (!STRATEGY_THEMES.includes(record.targetKey as StrategyChallengeTheme)) {
      return null;
    }
    round = buildDealerRound({
      ...common,
      kind: 'strategy',
      strategyTheme: record.targetKey as StrategyChallengeTheme,
    });
  } else if (record.roundKind === 'bounty') {
    if (!BOUNTY_THEMES.includes(record.targetKey as BountyChallengeTheme)) {
      return null;
    }
    round = buildDealerRound({
      ...common,
      kind: 'bounty',
      bountyTheme: record.targetKey as BountyChallengeTheme,
    });
  }

  // 旧版曾将召唤单位列入商店验阶题，换季也可能移除条目。
  if (
    !round?.cards.some(
      (card) =>
        card.title === record.title &&
        card.cardKind === record.cardKind &&
        !card.isImpostor,
    )
  ) return null;
  return {
    ...round,
    isMistakeReview: true,
    mistakeTargetKey: record.key,
  };
}

/** Builds a targeted review round focused on a high-priority unmastered mistake. */
export function buildMistakeRound(
  records: readonly DealerMistakeRecord[],
  options: {
    roundNumber: number;
    rng: () => number;
    orderRng?: () => number;
    avoidKey?: string;
  },
): DealerRound | null {
  const {roundNumber, rng, orderRng, avoidKey} = options;
  const active = activeMistakes(records);
  if (!active.length) return null;

  const preferred =
    avoidKey && active.length > 1
      ? active.filter((item) => item.key !== avoidKey)
      : active;
  const topBucket = preferred.slice(0, Math.min(3, preferred.length));
  const startIndex = Math.floor(rng() * topBucket.length);
  const candidates = [
    ...topBucket.slice(startIndex),
    ...topBucket.slice(0, startIndex),
    ...preferred.slice(topBucket.length),
    ...active.filter((item) => item.key === avoidKey),
  ];

  for (const record of candidates) {
    const built = buildRoundForMistake(record, roundNumber, rng, orderRng);
    if (built) return built;
  }
  return null;
}

export function loadMistakes(): DealerMistakeRecord[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(DEALER_MISTAKES_STORAGE_KEY);
    if (!raw) return [];
    return normalizeMistakes(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveMistakes(records: readonly DealerMistakeRecord[]): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(
      DEALER_MISTAKES_STORAGE_KEY,
      JSON.stringify(trimMistakes(records)),
    );
  } catch {
    /* 存储受限时保留当次会话。 */
  }
}
