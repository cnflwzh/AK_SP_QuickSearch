import {OPERATOR, OPERATORS, type Operator} from '../../../data/index.ts';

/**
 * 对应干员来源、持有与卫戍「自持干员加成」的状态：
 * -2 助战借用（未持有，仅限非特许六星；本体出战、无自持加成，等效精0）
 * -1 未持有（未借用 / 系统预设免借直出）
 *  0 已持有·精零未练（未激活）
 *  1 精一  2 精二  3 精二60+
 */
export const BOX_RANK_BORROWED = -2 as const;
export type OwnedBoxRank = 0 | 1 | 2 | 3;
export type StoredBoxRank = typeof BOX_RANK_BORROWED | OwnedBoxRank;
export type BoxRank = StoredBoxRank | -1;
export type OperatorBox = Record<string, StoredBoxRank>;

export interface BoxRankMeta {
  readonly rank: BoxRank;
  readonly label: string;
  readonly shortLabel: string;
  readonly bonusText: string;
  readonly owned: boolean;
  readonly borrowed: boolean;
  readonly activated: boolean;
}

export const BOX_RANK_LIST: readonly BoxRankMeta[] = [
  {
    rank: BOX_RANK_BORROWED,
    label: '已借用(助战)',
    shortLabel: '已借',
    bonusText: '助战本体出战 · 无加成(等效精0)',
    owned: false,
    borrowed: true,
    activated: false,
  },
  {
    rank: -1,
    label: '未持有',
    shortLabel: '',
    bonusText: '尚未拥有 · 无自持加成',
    owned: false,
    borrowed: false,
    activated: false,
  },
  {
    rank: 0,
    label: '未练(精0)',
    shortLabel: '精0',
    bonusText: '已持有 · 精一可激活',
    owned: true,
    borrowed: false,
    activated: false,
  },
  {
    rank: 1,
    label: '精一',
    shortLabel: '精一',
    bonusText: '攻+5% 防+5%',
    owned: true,
    borrowed: false,
    activated: true,
  },
  {
    rank: 2,
    label: '精二',
    shortLabel: '精二',
    bonusText: '攻+10% 防+5% 血+5%',
    owned: true,
    borrowed: false,
    activated: true,
  },
  {
    rank: 3,
    label: '精二60',
    shortLabel: '精二60',
    bonusText: '攻+10% 防+10% 血+10%',
    owned: true,
    borrowed: false,
    activated: true,
  },
] as const;

export const BOX_RANK_META: Readonly<Record<BoxRank, BoxRankMeta>> = {
  [BOX_RANK_BORROWED]: BOX_RANK_LIST[0],
  [-1]: BOX_RANK_LIST[1],
  [0]: BOX_RANK_LIST[2],
  [1]: BOX_RANK_LIST[3],
  [2]: BOX_RANK_LIST[4],
  [3]: BOX_RANK_LIST[5],
};

const AVATAR_KEY_RE = /^char_\d+_[a-zA-Z0-9_]+$/;

const avatarToOperator = new Map<string, Operator>(
  OPERATORS.filter((op) => op.stars > 0).map((op) => [op.avatar, op]),
);

/** 返回当前赛季可配置自持练度的干员列表（排除召唤/辅助干员）。 */
export const BOX_OPERATORS: readonly Operator[] = OPERATORS.filter(
  (op) => op.stars > 0,
);

/** 判断某干员是否属于「未持有时可借用同名助战补位」的非特许六星干员。 */
export function isBorrowableSixStar(
  op: Pick<Operator, 'stars' | 'borrowable'>,
): boolean {
  return op.stars === 6 && Boolean(op.borrowable);
}

/** 当前赛季所有非特许、未持有时可借用助战的六星干员列表。 */
export const BORROWABLE_SIX_STARS: readonly Operator[] =
  BOX_OPERATORS.filter(isBorrowableSixStar);

/** 当前赛季所有系统特许（未持有也自带本人、无需借用）的六星干员列表。 */
export const PRESET_SIX_STARS: readonly Operator[] = BOX_OPERATORS.filter(
  (op) => op.stars === 6 && !op.borrowable,
);

/** 将干员名或官方 charId（avatar）统一解析为本赛季 avatar 键；未知返回空串。 */
export function resolveBoxKey(nameOrAvatar: string): string {
  if (!nameOrAvatar) return '';
  if (avatarToOperator.has(nameOrAvatar)) return nameOrAvatar;
  if (Object.hasOwn(OPERATOR, nameOrAvatar)) {
    const op = OPERATOR[nameOrAvatar];
    return op.stars > 0 ? op.avatar : '';
  }
  return '';
}

/** 持久化映射接受其他赛季的规范 charId，普通外部名单只匹配本赛季。 */
export function resolveStoredBoxKey(key: string): string {
  return resolveBoxKey(key) || (AVATAR_KEY_RE.test(key) ? key : '');
}

/** 合并同一干员的记录，已持有优先于借用，重复的持有记录取较高练度。 */
export function mergeBoxRank(
  box: OperatorBox,
  key: string,
  rank: StoredBoxRank,
): void {
  const previous = box[key];
  if (previous === undefined || rank > previous) box[key] = rank;
}

export function isValidOwnedBoxRank(value: unknown): value is OwnedBoxRank {
  return value === 0 || value === 1 || value === 2 || value === 3;
}

export function isValidBoxRank(value: unknown): value is StoredBoxRank {
  return value === BOX_RANK_BORROWED || isValidOwnedBoxRank(value);
}

/** 按 avatar 键判断是否属于本赛季可借用六星。 */
export function isBorrowableAvatar(avatar: string): boolean {
  const op = avatarToOperator.get(avatar);
  return op ? isBorrowableSixStar(op) : false;
}

/** 从 Box 映射读取指定 avatar 键的状态；缺省表示未持有 (-1)。直接属性读取以触发 Vue 响应式追踪。 */
export function boxRankOf(box: Readonly<OperatorBox>, avatar: string): BoxRank {
  const rank = box[avatar];
  if (!isValidBoxRank(rank)) return -1;
  if (rank === BOX_RANK_BORROWED) {
    const op = avatarToOperator.get(avatar);
    if (op && !isBorrowableSixStar(op)) return -1;
  }
  return rank;
}

/** 归一化外部或本地存储的 Box 映射，过滤非法键名与越界值，保留跨赛季 charId 键。 */
export function normalizeOperatorBox(raw: unknown): OperatorBox {
  const result: OperatorBox = Object.create(null) as OperatorBox;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {...result};
  }
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isValidBoxRank(value)) continue;
    const resolved = resolveStoredBoxKey(key);
    if (!resolved) continue;
    const op = avatarToOperator.get(resolved);
    if (value === BOX_RANK_BORROWED && op && !isBorrowableSixStar(op)) continue;
    mergeBoxRank(result, resolved, value);
  }
  return {...result};
}

/** 针对已持有干员，根据精英阶段与等级映射到 0(精零未练) / 1(精一) / 2(精二) / 3(精二60+)。 */
export function rankFromEliteLevel(elite: number, level: number): OwnedBoxRank {
  if (!Number.isFinite(elite) || elite < 1) return 0;
  if (elite === 1) return 1;
  return Number.isFinite(level) && level >= 60 ? 3 : 2;
}

export interface LineupBoxCoverage {
  readonly total: number;
  /** 已持有（含精零未练） */
  readonly owned: number;
  /** 已激活自持加成（精一及以上） */
  readonly activated: number;
  /** 已持有但精零未练 */
  readonly untrained: number;
  /** 尚未持有（含已借用与系统预设） */
  readonly missing: number;
  /** 未持有但已标为助战借用的六星干员数 */
  readonly borrowed: number;
  /** 尚未持有且尚未借用、但可借用助战的六星干员数 */
  readonly borrowableMissing: number;
  readonly maxed: number;
  readonly elite2: number;
  readonly ratio: number;
}

/** 统计一套阵容在本赛季可自持干员中的持有、借用与练度覆盖情况。 */
export function lineupBoxCoverage(
  names: readonly string[],
  box: Readonly<OperatorBox>,
): LineupBoxCoverage {
  const unique = [...new Set(names)].filter(
    (name) => Object.hasOwn(OPERATOR, name) && OPERATOR[name].stars > 0,
  );
  let owned = 0;
  let activated = 0;
  let untrained = 0;
  let missing = 0;
  let borrowed = 0;
  let borrowableMissing = 0;
  let maxed = 0;
  let elite2 = 0;
  for (const name of unique) {
    const op = OPERATOR[name];
    const rank = boxRankOf(box, op.avatar);
    if (rank < 0) {
      missing++;
      if (rank === BOX_RANK_BORROWED) borrowed++;
      else if (isBorrowableSixStar(op)) borrowableMissing++;
      continue;
    }
    owned++;
    if (rank === 0) untrained++;
    if (rank >= 1) activated++;
    if (rank >= 2) elite2++;
    if (rank === 3) maxed++;
  }
  return {
    total: unique.length,
    owned,
    activated,
    untrained,
    missing,
    borrowed,
    borrowableMissing,
    maxed,
    elite2,
    ratio: unique.length ? activated / unique.length : 0,
  };
}
