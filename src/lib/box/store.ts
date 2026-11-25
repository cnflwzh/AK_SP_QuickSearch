import {computed, reactive, shallowRef} from 'vue';
import {BORROW_LIMIT} from '../../../data/index.ts';
import {
  BORROWABLE_SIX_STARS,
  OWNABLE_OPERATORS,
  BOX_RANK_BORROWED,
  boxRankOf,
  isBorrowableAvatar,
  mergeBoxRank,
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

/** 最近一次写盘失败时仍保留本页练度，供玩家重试或导出。 */
export const boxStorageWriteFailed = shallowRef(false);

function writeStoredBox(box: Readonly<OperatorBox>): void {
  try {
    localStorage.setItem(BOX_STORAGE_KEY, JSON.stringify(box));
    boxStorageWriteFailed.value = false;
  } catch {
    boxStorageWriteFailed.value = true;
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
    OWNABLE_OPERATORS.filter((op) => boxRankOf(operatorBox, op.avatar) >= 0).length,
);

/** 当前赛季已激活自持加成的干员总数（精一及以上）。 */
export const boxSeasonActivatedCount = computed(
  () =>
    OWNABLE_OPERATORS.filter((op) => boxRankOf(operatorBox, op.avatar) >= 1).length,
);

/** 当前赛季已持有但未练（精零）的干员总数。 */
export const boxSeasonUntrainedCount = computed(
  () =>
    OWNABLE_OPERATORS.filter((op) => boxRankOf(operatorBox, op.avatar) === 0)
      .length,
);

/** 当前赛季已标记精二 60 级（满自持加成）的干员数。 */
export const boxSeasonMaxedCount = computed(
  () =>
    OWNABLE_OPERATORS.filter((op) => boxRankOf(operatorBox, op.avatar) === 3)
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
    BORROWABLE_SIX_STARS.filter(
      (op) => boxRankOf(operatorBox, op.avatar) === -1,
    ).length,
);

export const hasAnyBox = computed(
  () => boxSeasonCount.value > 0 || boxSeasonBorrowedCount.value > 0,
);

export function rankOfOperator(nameOrAvatar: string): BoxRank {
  const key = resolveBoxKey(nameOrAvatar);
  return key ? boxRankOf(operatorBox, key) : -1;
}

function validateBorrowLimit(next: Readonly<OperatorBox>, previous: Readonly<OperatorBox>): void {
  const selected = BORROWABLE_SIX_STARS.filter(
    (op) => next[op.avatar] === BOX_RANK_BORROWED,
  );
  // 旧版本允许超额。保留原选择供用户逐步纠正，但不能在超额时新增借用。
  if (
    selected.length > BORROW_LIMIT &&
    selected.some((op) => previous[op.avatar] !== BOX_RANK_BORROWED)
  ) {
    throw new Error(
      `本次操作会选入 ${selected.length} 名助战，上限为 ${BORROW_LIMIT} 名。请缩小选择范围或先取消部分借用。`,
    );
  }
}

/** 按画笔指定的状态改写本季干员，返回实际改变数。超出借用名额时整批抛错且保留原状态。 */
export function setOperatorRanks(
  namesOrAvatars: readonly string[],
  rank: BoxRank,
): number {
  const changed = new Set<string>();
  for (const nameOrAvatar of namesOrAvatars) {
    const key = resolveBoxKey(nameOrAvatar);
    if (!key || boxRankOf(operatorBox, key) === rank) continue;
    if (rank === BOX_RANK_BORROWED && !isBorrowableAvatar(key)) continue;
    changed.add(key);
  }
  if (!changed.size) return 0;
  if (rank === BOX_RANK_BORROWED) {
    const count = boxSeasonBorrowedCount.value + changed.size;
    if (count > BORROW_LIMIT) {
      throw new Error(`本次操作会选入 ${count} 名助战，上限为 ${BORROW_LIMIT} 名。请缩小选择范围或先取消部分借用。`);
    }
  }
  // 整批验证完再提交；单人标注只触发该干员的响应式订阅，并只持久化一次。
  for (const key of changed) {
    if (rank === -1) delete operatorBox[key];
    else operatorBox[key] = rank;
  }
  writeStoredBox(operatorBox);
  return changed.size;
}

/** 设置一名本季干员，返回是否改变。超出助战名额会抛出可展示的错误。 */
export function setOperatorRank(nameOrAvatar: string, rank: BoxRank): boolean {
  return setOperatorRanks([nameOrAvatar], rank) > 0;
}

/** 基于指定的原 Box 计算导入结果；超出助战名额时抛错，整个过程不修改原数据。 */
export function buildBoxImport(
  previous: Readonly<OperatorBox>,
  entries: Readonly<OperatorBox>,
  mode: 'merge' | 'replace' = 'merge',
): OperatorBox {
  const next: OperatorBox = {...previous};
  if (mode === 'replace') {
    // 外部名单一般仅覆盖本季，其他赛季记录保留；备份明确提供的键可更新。
    for (const op of OWNABLE_OPERATORS) delete next[op.avatar];
  }
  for (const [key, rank] of Object.entries(normalizeOperatorBox(entries))) {
    if (mode === 'merge') mergeBoxRank(next, key, rank);
    else next[key] = rank;
  }
  validateBorrowLimit(next, previous);
  return next;
}

/** 先验证名额，再返回同步提交函数，供配置恢复在流派保存成功后一次应用 Box。 */
export function prepareBoxImport(
  entries: Readonly<OperatorBox>,
  mode: 'merge' | 'replace' = 'merge',
): () => void {
  const next = buildBoxImport(operatorBox, entries, mode);
  return () => replaceBoxState(next);
}

/** 将已成功保存的 Box 同步到当前页，避免重复写入。 */
export function acceptStoredBox(next: OperatorBox): void {
  replaceBoxState(next, false);
  boxStorageWriteFailed.value = false;
}

/** 导入一批练度。合并保留较高自持练度，覆盖替换本季；超出助战名额时不写入。 */
export function applyBoxBatch(
  entries: Readonly<OperatorBox>,
  mode: 'merge' | 'replace' = 'merge',
): void {
  const commit = prepareBoxImport(entries, mode);
  commit();
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
