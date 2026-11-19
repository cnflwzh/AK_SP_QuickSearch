import {
  BOX_RANK_BORROWED,
  mergeBoxRank,
  isBorrowableAvatar,
  isValidBoxRank,
  rankFromEliteLevel,
  resolveBoxKey,
  resolveStoredBoxKey,
  type BoxRank,
  type OperatorBox,
  type OwnedBoxRank,
} from './model.ts';

export interface BoxImportResult {
  readonly entries: OperatorBox;
  readonly matchedCount: number;
  readonly ignoredCount: number;
  readonly otherSeasonCount: number;
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
  let otherSeasonCount = 0;
  for (const [key, rank] of Object.entries(entries)) {
    if (!resolveBoxKey(key)) {
      otherSeasonCount++;
      continue;
    }
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
    otherSeasonCount,
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
      if (key) mergeBoxRank(entries, key, fallbackRank);
      else if (rawItem.trim()) ignoredCount++;
      continue;
    }
    if (!isRecord(rawItem)) {
      ignoredCount++;
      continue;
    }
    const id = typeof rawItem.id === 'string' ? rawItem.id : '';
    const charId = typeof rawItem.charId === 'string' ? rawItem.charId : '';
    const nameCandidate = typeof rawItem.name === 'string' ? rawItem.name : '';
    const key =
      resolveBoxKey(id) ||
      resolveBoxKey(charId) ||
      resolveBoxKey(nameCandidate);
    if (!key) {
      ignoredCount++;
      continue;
    }
    const rank = readRankFromObject(rawItem, fallbackRank);
    if (rank !== -1) {
      if (rank === BOX_RANK_BORROWED && !isBorrowableAvatar(key)) continue;
      mergeBoxRank(entries, key, rank);
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
  // player/info 返回 chars，cultivate/player 返回 characters，也接受解包后的 data。
  for (const payload of [value, value.data]) {
    if (!isRecord(payload)) continue;
    for (const list of [payload.characters, payload.chars]) {
      if (Array.isArray(list)) {
        return parseArrayItems(list, fallbackRank, '森空岛 / 干员列表 JSON');
      }
    }
  }
  // 兼容 { charId/name: 0|1|2|3 | { evolvePhase/elite, level } }
  const entries: OperatorBox = {};
  let ignoredCount = 0;
  for (const [rawKey, rawVal] of Object.entries(value)) {
    const key = resolveStoredBoxKey(rawKey);
    if (!key) {
      ignoredCount++;
      continue;
    }
    let rank: BoxRank = -1;
    if (isValidBoxRank(rawVal)) rank = rawVal;
    else if (isRecord(rawVal)) rank = readRankFromObject(rawVal, fallbackRank);
    else if (rawVal === true) rank = fallbackRank;
    if (rank === -1) continue;
    if (
      rank === BOX_RANK_BORROWED &&
      resolveBoxKey(key) &&
      !isBorrowableAvatar(key)
    ) {
      ignoredCount++;
      continue;
    }
    mergeBoxRank(entries, key, rank);
  }
  return summarizeEntries(entries, ignoredCount, '键值映射 JSON');
}

/** 文件和粘贴路径共用列名、持有状态与练度校验。未识别的表头返回 null。 */
function parseYituliuRows([header = [], ...rows]: string[][]): BoxImportResult | null {
  const name = header.indexOf('干员名称');
  const owned = header.indexOf('是否已招募');
  const elite = header.indexOf('精英化等级');
  const level = header.indexOf('等级');
  if ([name, owned, elite, level].every((column) => column < 0)) {
    // 漏选表头时不能按纯名单解析，否则未招募干员也会被当作已持有。
    if (header.some((cell) => cell === '是' || cell === '否') && header.some((cell) => /^\d+$/.test(cell))) {
      throw new Error('缺少列名，请选择一图流导出的原表，或从第一行开始复制。');
    }
    return null;
  }
  if ([name, owned, elite, level].includes(-1)) {
    throw new Error('练度表需要包含「干员名称」「是否已招募」「精英化等级」「等级」四列。');
  }

  const id = header.indexOf('干员 ID');
  const entries: OperatorBox = {};
  let ignoredCount = 0;
  for (const [index, cells] of rows.entries()) {
    if (cells.every((cell) => !cell)) continue;
    if (cells[owned] === '否') continue;
    const key = resolveBoxKey(cells[id] ?? '') || resolveBoxKey(cells[name] ?? '');
    if (!key) {
      ignoredCount++;
      continue;
    }
    if (cells[owned] !== '是' || !/^[012]$/.test(cells[elite] ?? '') ||
        !/^[1-9]\d?$/.test(cells[level] ?? '') || Number(cells[level]) > 90) {
      throw new Error(`表格第 ${index + 2} 行的招募状态或练度有误，请核对一图流原表。`);
    }
    mergeBoxRank(entries, key, rankFromEliteLevel(Number(cells[elite]), Number(cells[level])));
  }
  const result = summarizeEntries(entries, ignoredCount, '一图流练度表');
  if (!result.matchedCount) throw new Error('表格中没有匹配到本赛季已招募的干员，请检查一图流的账号和导出范围。');
  return result;
}

/** 从一图流导出的 .xlsx 首张工作表生成预览；读取失败或表头不符时抛出提示，不写入练度箱。 */
export async function readYituliuWorkbook(file: File): Promise<BoxImportResult> {
  const {readSheet} = await import('read-excel-file/browser').catch(() => {
    throw new Error('Excel 读取工具加载失败，请联网后重新选择文件。');
  });
  const sheet = await readSheet(file).catch(() => {
    throw new Error('无法读取 Excel 文件，请重新选择一图流导出的 .xlsx 原表。');
  });
  const rows = sheet.map((row) => row.map((cell) => String(cell ?? '').trim()));
  const preview = parseYituliuRows(rows);
  if (!preview) throw new Error('没有找到一图流的练度表头，请从「我的干员」导出 Excel 后重试。');
  return preview;
}

/** 自动识别干员 JSON、一图流表格或纯名单。无法识别有效记录时抛出可展示的错误。 */
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
    if (!result.matchedCount && !result.otherSeasonCount) {
      throw new Error(
        '未在 JSON 中匹配到当前赛季的已持有干员数据，请检查导出内容。',
      );
    }
    return result;
  }

  if (cleaned.includes('\t')) {
    const rows = cleaned.split(/\r\n?|\n/).map((row) => row.split('\t').map((cell) => cell.trim()));
    const table = parseYituliuRows(rows);
    if (table) return table;
  }

  // 纯文本名单：支持换行、空格、顿号、逗号、分号、斜杠分隔
  const tokens = cleaned
    .split(/[\s,，、;；/|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const entries: OperatorBox = {};
  let ignoredCount = 0;
  for (const token of tokens) {
    const key = resolveBoxKey(token);
    if (key) entries[key] = fallbackRank;
    else ignoredCount++;
  }
  const result = summarizeEntries(entries, ignoredCount, '干员名单文本');
  if (!result.matchedCount) {
    throw new Error('没有识别到当前赛季的干员名称，请核对干员名拼写。');
  }
  return result;
}
