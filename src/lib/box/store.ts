import {computed, reactive} from 'vue';
import {
  BORROWABLE_SIX_STARS,
  BOX_OPERATORS,
  BOX_RANK_BORROWED,
  boxRankOf,
  isBorrowableAvatar,
  normalizeOperatorBox,
  resolveBoxKey,
  type BoxRank,
  type OperatorBox,
} from './model.ts';

export const BOX_STORAGE_KEY = 'wsq.box.v1';

function readStoredBox(): OperatorBox {
  try {
    const raw = localStorage.getItem(BOX_STORAGE_KEY);
    if (!raw) return {};
    return normalizeOperatorBox(JSON.parse(raw));
  } catch {
    return {};
  }
}

function writeStoredBox(box: Readonly<OperatorBox>): void {
  try {
    localStorage.setItem(BOX_STORAGE_KEY, JSON.stringify(box));
  } catch {
    /* 隐私模式或存储受限时保持当前会话有效。 */
  }
}

export const operatorBox = reactive<OperatorBox>(readStoredBox());

function replaceBoxState(next: OperatorBox, persist = true): void {
  for (const key of Object.keys(operatorBox)) {
    if (!Object.hasOwn(next, key)) delete operatorBox[key];
  }
  for (const [key, value] of Object.entries(next)) {
    operatorBox[key] = value;
  }
  if (persist) writeStoredBox(operatorBox);
}

/** 当前赛季已持有干员总数（含精零未练）。 */
export const boxSeasonCount = computed(
  () =>
    BOX_OPERATORS.filter((op) => boxRankOf(operatorBox, op.avatar) >= 0).length,
);

/** 当前赛季已激活自持加成的干员总数（精一及以上）。 */
export const boxSeasonActivatedCount = computed(
  () =>
    BOX_OPERATORS.filter((op) => boxRankOf(operatorBox, op.avatar) >= 1).length,
);

/** 当前赛季已持有但未练（精零）的干员总数。 */
export const boxSeasonUntrainedCount = computed(
  () =>
    BOX_OPERATORS.filter((op) => boxRankOf(operatorBox, op.avatar) === 0)
      .length,
);

/** 当前赛季已标记精二 60 级（满自持加成）的干员数。 */
export const boxSeasonMaxedCount = computed(
  () =>
    BOX_OPERATORS.filter((op) => boxRankOf(operatorBox, op.avatar) === 3)
      .length,
);

/** 当前赛季已标记为助战借用的六星干员总数。 */
export const boxSeasonBorrowedCount = computed(
  () =>
    BORROWABLE_SIX_STARS.filter(
      (op) => boxRankOf(operatorBox, op.avatar) === BOX_RANK_BORROWED,
    ).length,
);

/** 当前赛季尚未持有且尚未借用、但可通过助战借用的六星干员总数。 */
export const boxSeasonBorrowableMissingCount = computed(
  () =>
    BORROWABLE_SIX_STARS.filter((op) => boxRankOf(operatorBox, op.avatar) === -1)
      .length,
);

export const hasAnyBox = computed(
  () => boxSeasonCount.value > 0 || boxSeasonBorrowedCount.value > 0,
);

export function rankOfOperator(nameOrAvatar: string): BoxRank {
  const key = resolveBoxKey(nameOrAvatar);
  return key ? boxRankOf(operatorBox, key) : -1;
}

export function setOperatorRank(nameOrAvatar: string, rank: BoxRank): boolean {
  const key = resolveBoxKey(nameOrAvatar);
  if (!key) return false;
  if (rank === BOX_RANK_BORROWED && !isBorrowableAvatar(key)) return false;
  const prev = boxRankOf(operatorBox, key);
  if (rank === -1) {
    if (prev === -1) return false;
    delete operatorBox[key];
  } else {
    if (prev === rank) return false;
    operatorBox[key] = rank;
  }
  writeStoredBox(operatorBox);
  return true;
}

export function applyBoxBatch(
  entries: Readonly<OperatorBox>,
  mode: 'merge' | 'replace' = 'merge',
): void {
  const normalized = normalizeOperatorBox(entries);
  if (mode === 'replace') {
    replaceBoxState(normalized, true);
    return;
  }
  const merged: OperatorBox = {...operatorBox, ...normalized};
  replaceBoxState(merged, true);
}

export function clearOperatorBox(): void {
  replaceBoxState({}, true);
}

export function exportOperatorBox(): OperatorBox {
  return normalizeOperatorBox({...operatorBox});
}

let boxStorageListening = false;
export function initBoxStorageSync(): void {
  if (boxStorageListening || typeof window === 'undefined') return;
  boxStorageListening = true;
  window.addEventListener('storage', (event) => {
    if (event.key !== null && event.key !== BOX_STORAGE_KEY) return;
    replaceBoxState(readStoredBox(), false);
  });
}
