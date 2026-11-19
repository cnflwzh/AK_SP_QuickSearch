import {OPERATOR, OPERATORS} from '../../../data/index.ts';
import {
  BOX_RANK_BORROWED,
  boxRankOf,
  isBorrowableAvatar,
  isValidBoxRank,
  rankFromEliteLevel,
  resolveBoxKey,
  type BoxRank,
  type OperatorBox,
  type OwnedBoxRank,
} from './model.ts';

export interface BoxImportResult {
  readonly entries: OperatorBox;
  readonly matchedCount: number;
  readonly ignoredCount: number;
  readonly formatLabel: string;
  readonly breakdown: {
    readonly borrowed: number;
    readonly e0: number;
    readonly e1: number;
    readonly e2: number;
    readonly e260: number;
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const seasonNames = new Set(
  OPERATORS.filter((op) => op.stars > 0).map((op) => op.name),
);

function rankPriority(rank: BoxRank): number {
  if (rank === -1) return 0;
  if (rank === BOX_RANK_BORROWED) return 1;
  return rank + 2;
}

function summarizeEntries(
  entries: OperatorBox,
  ignoredCount: number,
  formatLabel: string,
): BoxImportResult {
  let borrowed = 0;
  let e0 = 0;
  let e1 = 0;
  let e2 = 0;
  let e260 = 0;
  for (const rank of Object.values(entries)) {
    if (rank === BOX_RANK_BORROWED) borrowed++;
    else if (rank === 0) e0++;
    else if (rank === 1) e1++;
    else if (rank === 2) e2++;
    else if (rank === 3) e260++;
  }
  return {
    entries,
    matchedCount: e0 + e1 + e2 + e260 + borrowed,
    ignoredCount,
    formatLabel,
    breakdown: {borrowed, e0, e1, e2, e260},
  };
}

function readRankFromObject(
  item: Record<string, unknown>,
  fallbackRank: OwnedBoxRank,
): BoxRank {
  if (item.own === false) return -1;
  if (isValidBoxRank(item.rank)) return item.rank;
  const rawElite =
    typeof item.elite === 'number'
      ? item.elite
      : typeof item.evolvePhase === 'number'
        ? item.evolvePhase
        : typeof item.phase === 'number'
          ? item.phase
          : null;
  const rawLevel = typeof item.level === 'number' ? item.level : 1;
  if (rawElite !== null) {
    return rankFromEliteLevel(rawElite, rawLevel);
  }
  return item.own === true ? fallbackRank : -1;
}

function parseArrayItems(
  list: readonly unknown[],
  fallbackRank: OwnedBoxRank,
  formatLabel: string,
): BoxImportResult {
  const entries: OperatorBox = {};
  let ignoredCount = 0;
  for (const rawItem of list) {
    if (typeof rawItem === 'string') {
      const key = resolveBoxKey(rawItem.trim());
      if (key) entries[key] = fallbackRank;
      else if (rawItem.trim()) ignoredCount++;
      continue;
    }
    if (!isRecord(rawItem)) {
      ignoredCount++;
      continue;
    }
    const idCandidate =
      typeof rawItem.id === 'string'
        ? rawItem.id
        : typeof rawItem.charId === 'string'
          ? rawItem.charId
          : '';
    const nameCandidate = typeof rawItem.name === 'string' ? rawItem.name : '';
    const key = resolveBoxKey(idCandidate) || resolveBoxKey(nameCandidate);
    if (!key) {
      ignoredCount++;
      continue;
    }
    const rank = readRankFromObject(rawItem, fallbackRank);
    if (rank !== -1) {
      if (rank === BOX_RANK_BORROWED && !isBorrowableAvatar(key)) continue;
      const prev = boxRankOf(entries, key);
      if (rankPriority(rank) > rankPriority(prev)) entries[key] = rank;
    }
  }
  return summarizeEntries(entries, ignoredCount, formatLabel);
}

function parseJsonValue(
  value: unknown,
  fallbackRank: OwnedBoxRank,
): BoxImportResult {
  if (Array.isArray(value)) {
    return parseArrayItems(value, fallbackRank, 'MAA / 列表 JSON');
  }
  if (!isRecord(value)) {
    throw new Error('JSON 格式不支持，请粘贴 MAA / 森空岛导出数据或干员名单。');
  }
  // 兼容直接传入设置备份或纯 box 字段
  if (isRecord(value.box)) {
    return parseJsonValue(value.box, fallbackRank);
  }
  if (Array.isArray(value.chars)) {
    return parseArrayItems(value.chars, fallbackRank, '森空岛 / 干员列表 JSON');
  }
  if (isRecord(value.data) && Array.isArray(value.data.chars)) {
    return parseArrayItems(
      value.data.chars,
      fallbackRank,
      '森空岛 / 干员列表 JSON',
    );
  }
  // 兼容 { charId/name: 0|1|2|3 | { evolvePhase/elite, level } }
  const entries: OperatorBox = {};
  let ignoredCount = 0;
  for (const [rawKey, rawVal] of Object.entries(value)) {
    const key = resolveBoxKey(rawKey);
    if (!key) {
      ignoredCount++;
      continue;
    }
    if (isValidBoxRank(rawVal)) {
      if (rawVal === BOX_RANK_BORROWED && !isBorrowableAvatar(key)) continue;
      entries[key] = rawVal;
    } else if (isRecord(rawVal)) {
      const rank = readRankFromObject(rawVal, fallbackRank);
      if (rank !== -1) {
        if (rank === BOX_RANK_BORROWED && !isBorrowableAvatar(key)) continue;
        entries[key] = rank;
      }
    } else if (rawVal === true) {
      entries[key] = fallbackRank;
    }
  }
  return summarizeEntries(entries, ignoredCount, '键值映射 JSON');
}

/** 解析外部干员练度输入：自动识别 MAA JSON、森空岛 JSON、键值 JSON 或纯文本干员名单。 */
export function parseExternalBox(
  input: string,
  fallbackRank: OwnedBoxRank = 3,
): BoxImportResult {
  const cleaned = input.replace(/^\uFEFF/, '').trim();
  if (!cleaned) {
    throw new Error('请先粘贴导出的 JSON 或干员名单。');
  }
  if (cleaned.startsWith('[') || cleaned.startsWith('{')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error('JSON 解析失败，请检查是否粘贴完整。');
    }
    const result = parseJsonValue(parsed, fallbackRank);
    if (!result.matchedCount) {
      throw new Error(
        '未在 JSON 中匹配到当前赛季的已持有干员数据，请检查导出内容。',
      );
    }
    return result;
  }

  // 纯文本名单：支持换行、空格、顿号、逗号、分号、斜杠分隔
  const tokens = cleaned
    .split(/[\s,，、;；/|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const entries: OperatorBox = {};
  let ignoredCount = 0;
  for (const token of tokens) {
    if (seasonNames.has(token) && Object.hasOwn(OPERATOR, token)) {
      entries[OPERATOR[token].avatar] = fallbackRank;
    } else {
      const key = resolveBoxKey(token);
      if (key) entries[key] = fallbackRank;
      else ignoredCount++;
    }
  }
  const result = summarizeEntries(entries, ignoredCount, '干员名单文本');
  if (!result.matchedCount) {
    throw new Error('没有识别到当前赛季的干员名称，请核对干员名拼写。');
  }
  return result;
}
