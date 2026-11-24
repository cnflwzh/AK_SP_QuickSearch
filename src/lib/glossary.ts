import {ENEMY_GLOSSARY} from '../../data/index.ts';
import {
  ENEMY_TERM_ALIASES,
  GAME_TERMS,
  type GlossaryEntry,
} from '../../data/gameTerms.ts';
import {nameScore, normalize} from './ui/match.ts';

export {
  GLOSSARY_KIND_LABELS,
  type GlossaryEntry,
} from '../../data/gameTerms.ts';

/** 新手攻略与当前赛季的通用敌人词条，共用一个按正式名称索引的词库。 */
export const GLOSSARY_ENTRIES: readonly GlossaryEntry[] = [
  ...GAME_TERMS,
  ...Object.values(ENEMY_GLOSSARY).map((entry) => ({
    ...entry,
    aliases: ENEMY_TERM_ALIASES[entry.term] ?? [],
  })),
];

const byName = new Map<string, GlossaryEntry>();
const spellings: string[] = [];
for (const entry of GLOSSARY_ENTRIES) {
  for (const name of [entry.term, ...entry.aliases]) {
    byName.set(normalize(name), entry);
    spellings.push(name);
  }
}

/** 按完整词名或别名查词，忽略英文大小写、空格及全半角。未收录时返回 undefined。 */
export function findGlossaryTerm(text: string): GlossaryEntry | undefined {
  return byName.get(normalize(text));
}

const IDENTIFIER_CHAR = /[a-z0-9_ａ-ｚＡ-Ｚ０-９＿]/i;
const MIXED_NAME_BOUNDARY =
  /[a-z0-9](?=\p{Script=Han})|\p{Script=Han}(?=[a-z0-9])/giu;

function inlinePattern(name: string): string {
  // 攻略里「主 C」「D 牌」经常留空格。只允许词内空格，不跨段落。
  return name
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(MIXED_NAME_BOUNDARY, '$&[ \t\u3000]*')
    .replace(/[a-z0-9]/gi, (ch) => {
      const wide = String.fromCharCode(ch.charCodeAt(0) + 0xfee0);
      return '[' + ch + wide + ']';
    });
}

const inlineTerms = new RegExp(
  spellings
    .sort((left, right) => right.length - left.length)
    .map(inlinePattern)
    .join('|'),
  'giu',
);

/** text 始终保留原文；只有匹配到词条的片段才附带其正式名称 term。 */
export interface GlossaryTextPart {
  text: string;
  term?: string;
}

/** 从左到右匹配正文，同一起点优先取最长词。返回纯文本片段，调用方可直接做文本插值。 */
export function splitGlossaryText(text: string): GlossaryTextPart[] {
  const parts: GlossaryTextPart[] = [];
  let cursor = 0;
  for (const match of text.matchAll(inlineTerms)) {
    const start = match.index;
    const word = match[0];
    const end = start + word.length;
    // D 可以紧邻汉字，但 ID、DPS、build_id 等英文标识符内部的 D 没有刷牌的含义。
    if (
      (IDENTIFIER_CHAR.test(word[0]) &&
        IDENTIFIER_CHAR.test(text[start - 1] ?? '')) ||
      (IDENTIFIER_CHAR.test(word[word.length - 1]) &&
        IDENTIFIER_CHAR.test(text[end] ?? ''))
    )
      continue;
    const entry = findGlossaryTerm(word);
    if (!entry) continue;
    if (start > cursor) parts.push({text: text.slice(cursor, start)});
    parts.push({text: word, term: entry.term});
    cursor = end;
  }
  if (cursor < text.length) parts.push({text: text.slice(cursor)});
  return parts;
}

/** 按名称、别名和拼音搜索，includeDescription 控制是否同时查释义。空查询返回全表。 */
export function searchGlossary(
  query: string,
  includeDescription = true,
): readonly GlossaryEntry[] {
  const q = normalize(query);
  if (!q) return GLOSSARY_ENTRIES;
  const exact = byName.get(q);
  // 单独输入 D 时，直接给出其含义，避免同时列出含 d 首字母的所有词条。
  if (exact && /^[a-z]$/.test(q)) return [exact];
  const hits = GLOSSARY_ENTRIES.map((entry) => {
    const names = [entry.term, ...entry.aliases];
    const score =
      entry === exact
        ? 4
        : Math.max(...names.map((name) => nameScore(name, q)));
    return {
      entry,
      score:
        score ||
        Number(includeDescription && normalize(entry.desc).includes(q)),
    };
  });
  return hits
    .filter(({score}) => score > 0)
    .sort((left, right) => right.score - left.score)
    .map(({entry}) => entry);
}
