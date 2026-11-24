import {
  ADDITIONAL_OPERATORS,
  ALL_COVENANTS,
  BOUNTIES,
  ENEMY_GLOSSARY,
  EQUIPMENT,
  LEADERS,
  OPERATORS,
  STRATEGIES,
  TRAINING,
  operatorRolesAtElite,
  rolesForTraining,
  type Bounty,
  type EnemyTerm,
  type Equipment,
  type Leader,
  type Operator,
  type TrainingType,
  type Strategy,
} from '../../data/index.ts';
import {leaderGlossaryTerms} from '../lib/leaders/leader.ts';
import {nameScore, normalize} from '../lib/ui/match.ts';
import type {Plan} from '../lib/plans/model.ts';

const leaderTermCache = new WeakMap<Leader, readonly string[]>();

/** 返回 Boss 关联的全部可拼音匹配词条（技能名、专属单位/机制、随行敌人、相关词典名词）。 */
export function leaderSearchTerms(leader: Leader): readonly string[] {
  const cached = leaderTermCache.get(leader);
  if (cached) return cached;
  const terms = new Set<string>();
  for (const a of [...leader.abilities, ...leader.hiddenAbilities]) {
    if (a.skill) terms.add(a.skill);
  }
  for (const t of leader.terms ?? []) terms.add(t.term);
  for (const e of [
    ...leader.stage.escorts,
    ...(leader.hiddenStage?.escorts ?? []),
  ]) {
    terms.add(e.name);
  }
  for (const g of leaderGlossaryTerms(leader, ENEMY_GLOSSARY)) {
    terms.add(g.term);
  }
  const list = [...terms];
  leaderTermCache.set(leader, list);
  return list;
}

/** Boss 文本检索正文（战前档案、专属词条、技能与对策）。 */
export function leaderSearchDescription(leader: Leader): string {
  return [
    leader.profile.attackMode,
    leader.profile.defense,
    leader.profile.targeting,
    leader.profile.blocking,
    leader.profile.summary,
    leader.profile.hiddenSummary ?? '',
    ...(leader.terms ?? []).map((t) => `${t.term}|${t.desc}`),
    ...leader.abilities.map((a) => (a.skill ?? '') + a.text),
    ...leader.hiddenAbilities.map((a) => (a.skill ?? '') + a.text),
    ...leader.counters.map((c) => c.tag + c.by + c.text),
    ...leader.stage.escorts.map((e) => e.name + (e.note ?? '')),
    ...(leader.hiddenStage?.escorts.map((e) => e.name + (e.note ?? '')) ?? []),
  ].join('|');
}

export type SearchQuickTarget = {
  kind:
    'op' | 'eq' | 'st' | 'cv' | 'bd' | 'ld' | 'training' | 'bounty' | 'roster';
  id: string;
};

interface SearchDocument {
  name: string;
  /** 内置流派改名后仍能用原名直达。 */
  alias?: string;
  terms?: readonly string[];
  /** 由索引构造函数归一化正文，各字段用 | 分隔，避免跨字段拼接出假命中。 */
  body?: string;
}

function scoreTerm(
  doc: SearchDocument,
  text: string,
  scoreName: (name: string) => number,
): number {
  const direct = scoreName(doc.name);
  const alias = doc.alias ? scoreName(doc.alias) : 0;
  if (direct || alias) return Math.max(direct, alias);
  if (doc.terms?.some((term) => scoreName(term) > 0)) return 1.25;
  return doc.body?.includes(text) ? 1 : 0;
}

function compileTerm(text: string) {
  // 同一次输入中的「乌萨斯」等关联词只比较一次，下一次输入可释放整个映射。
  const scores = new Map<string, number>();
  function scoreName(name: string): number {
    let score = scores.get(name);
    if (score === undefined) {
      score = nameScore(name, text);
      // 同一查询可能伴随用户反复编辑流派名称；限制单词缓存条目数。
      if (scores.size < 1024) scores.set(name, score);
    }
    return score;
  }
  return (doc: SearchDocument): number => scoreTerm(doc, text, scoreName);
}

/** 编译一次输入供各目录复用。先尝试连续名称与拼音，再对显式分隔的词做同一条目内的交集。 */
export function prepareSearchQuery(raw: string) {
  const parts = raw
    .split(/[\s,，、]+/u)
    .map(normalize)
    .filter(Boolean);
  const text = parts.join('');
  const phrase = compileTerm(text);
  const words = parts.length > 1 ? [...new Set(parts)].map(compileTerm) : [];
  return {
    text,
    score(doc: SearchDocument): number {
      if (!text) return 0;
      const whole = phrase(doc);
      if (whole === 3 || !words.length) return whole;
      let sum = 0;
      for (const word of words) {
        const score = word(doc);
        if (!score) return whole;
        sum += score;
      }
      // 无序词组可以跨名称、标签、正文；连续全名、全拼或首字母精确命中始终优先。
      return Math.max(whole, Math.min(2.75, sum / words.length));
    },
  };
}

type SearchQuery = ReturnType<typeof prepareSearchQuery>;

/** 静态赛季条目按对象缓存。可编辑方案每次从 Vue 的当前数据构建，不在此缓存。 */
function indexByItem<T extends object>(describe: (item: T) => SearchDocument) {
  const index = new WeakMap<T, SearchDocument>();
  return (item: T): SearchDocument => {
    let doc = index.get(item);
    if (!doc) {
      doc = describe(item);
      index.set(item, doc);
    }
    return doc;
  };
}

function operatorDocument(op: Operator, elite: boolean): SearchDocument {
  const roles = elite ? (op.roles ?? []) : operatorRolesAtElite(op, false);
  return {
    name: op.name,
    terms: [...op.covenants, ...roles, op.type, `${op.tier}阶`],
    body: normalize(elite ? `${op.trait}|${op.elite}` : op.trait),
  };
}
const fullOperator = indexByItem((op: Operator) => operatorDocument(op, true));
const baseOperator = indexByItem((op: Operator) => operatorDocument(op, false));

function equipmentDocument(item: Equipment, advanced: boolean): SearchDocument {
  return {
    name: item.name,
    terms: [...(item.roles ?? []), item.covenant ?? '', `${item.tier}阶`],
    body: normalize(
      advanced ? `${item.effect}|${item.advanced ?? ''}` : item.effect,
    ),
  };
}
const fullEquipment = indexByItem((item: Equipment) =>
  equipmentDocument(item, true),
);
const baseEquipment = indexByItem((item: Equipment) =>
  equipmentDocument(item, false),
);

const glossaryNames = Object.keys(ENEMY_GLOSSARY).map((name) => ({
  name,
  key: normalize(name),
}));

function enemyDocument(
  name: string,
  terms: readonly string[],
  rawBody: string,
): SearchDocument {
  const body = normalize(rawBody);
  const related = new Set(terms);
  for (const term of glossaryNames) {
    if (body.includes(term.key)) related.add(term.name);
  }
  return {name, terms: [...related], body};
}

const bountyDocument = indexByItem((item: Bounty) =>
  enemyDocument(
    item.name,
    [
      item.when,
      item.mobility,
      item.range,
      item.damage,
      ...(item.tags ?? []),
      ...(item.roles ?? []),
    ],
    `${item.mechanics}|${item.counter}`,
  ),
);
const trainingDocument = indexByItem((item: TrainingType) =>
  enemyDocument(
    item.name,
    [...item.tags, ...item.examples, ...rolesForTraining(item.name)],
    `${item.desc}|${item.attackStyle}|${item.strategy}`,
  ),
);
const leaderDocument = indexByItem((item: Leader) => ({
  name: item.name,
  terms: leaderSearchTerms(item),
  body: normalize(leaderSearchDescription(item)),
}));
const strategyDocument = indexByItem((item: Strategy) => ({
  name: item.name,
  terms: [item.skill, item.category],
  body: normalize(item.effect),
}));
const glossaryDocument = indexByItem((entry: EnemyTerm) => ({
  name: entry.term,
  body: normalize(entry.desc),
}));

/** 按名称、词条、正文依次给悬赏敌人评分；仅供悬赏目录逐项调用。 */
export function bountyMatchScore(item: Bounty, query: string): number {
  return query
    ? scoreTerm(bountyDocument(item), query, (name) => nameScore(name, query))
    : 0;
}

/** 返回普通敌人在给定名称、机制或职能检索中的匹配度。 */
export function trainingMatchScore(item: TrainingType, query: string): number {
  return query
    ? scoreTerm(trainingDocument(item), query, (name) => nameScore(name, query))
    : 0;
}

/** 完整干员条目命中而初始特质和职能不足以满足查询时，展示精锐特质。 */
export function matchedOnlyElite(
  op: Operator,
  input: string | SearchQuery,
): boolean {
  const query = typeof input === 'string' ? prepareSearchQuery(input) : input;
  return !query.score(baseOperator(op)) && query.score(fullOperator(op)) > 0;
}

/** 仅装备的进阶效果能补足查询时返回 true。 */
export function matchedOnlyAdvanced(
  item: Equipment,
  rawQuery: string,
): boolean {
  if (!item.advanced) return false;
  const query = prepareSearchQuery(rawQuery);
  return (
    !query.score(baseEquipment(item)) && query.score(fullEquipment(item)) > 0
  );
}

function ranked<T>(
  items: readonly T[],
  describe: (item: T) => SearchDocument,
  query: SearchQuery,
  tieBreak?: (a: T, b: T) => number,
) {
  if (!query.text) return [];
  return items
    .map((item) => ({item, score: query.score(describe(item))}))
    .filter(({score}) => score > 0)
    .sort((a, b) => b.score - a.score || tieBreak?.(a.item, b.item) || 0);
}

/** 返回匹配的敌人词条；全局结果只在词条名称命中时展示独立的词典解释。 */
export function matchingEnemyTerms(
  input: string | SearchQuery,
  includeDescription = true,
): EnemyTerm[] {
  const query = typeof input === 'string' ? prepareSearchQuery(input) : input;
  const describe = includeDescription
    ? glossaryDocument
    : (entry: EnemyTerm) => ({name: entry.term});
  return ranked(Object.values(ENEMY_GLOSSARY), describe, query).map(
    ({item}) => item,
  );
}

type SearchBuild = {key: string} & (
  {name: string; plan?: Plan} | {name?: string; plan: Plan}
);
function buildDocument(build: SearchBuild): SearchDocument {
  const {plan, key} = build;
  const name = plan?.name ?? build.name ?? key;
  return {
    name,
    alias: key !== name ? key : undefined,
    terms:
      plan &&
      [
        plan.strategy,
        ...(plan.strategyAlternates ?? []),
        ...[plan, ...(plan.stages ?? [])].flatMap((section) =>
          section.ops.flatMap((slot) => [slot.name, ...slot.alt, ...slot.eq]),
        ),
      ].filter(Boolean),
    body:
      plan &&
      normalize(
        [plan.note, ...(plan.stages ?? []).map((s) => s.note)].join(' '),
      ),
  };
}

type Section =
  | 'operators'
  | 'additional'
  | 'covenants'
  | 'equipment'
  | 'strategies'
  | 'builds'
  | 'leaders'
  | 'trainings'
  | 'bounties';

/** 返回各目录的有序条目、按最高分排列的可跳转分组和回车目标。并列时沿用原有目录优先级。 */
export function searchResults(
  query: SearchQuery,
  builds: readonly SearchBuild[] = [],
) {
  const sections: {key: Section; score: number; target: SearchQuickTarget}[] =
    [];
  function group<T>(
    key: Section,
    kind: SearchQuickTarget['kind'],
    items: readonly T[],
    describe: (item: T) => SearchDocument,
    id: (item: T) => string,
    tieBreak?: (a: T, b: T) => number,
  ): T[] {
    const hits = ranked(items, describe, query, tieBreak);
    const first = hits[0];
    if (first)
      sections.push({
        key,
        score: first.score,
        target: {kind, id: id(first.item)},
      });
    return hits.map(({item}) => item);
  }
  const byName = (item: {name: string}) => item.name;
  const operators = group(
    'operators',
    'op',
    OPERATORS,
    fullOperator,
    byName,
    (a, b) => a.tier - b.tier,
  );
  const additional = group(
    'additional',
    'roster',
    ADDITIONAL_OPERATORS,
    (op) => ({name: op.name, terms: op.covenants}),
    (op) => op.avatar,
  );
  const covenants = group(
    'covenants',
    'cv',
    ALL_COVENANTS,
    (name) => ({name}),
    (name) => name,
  );
  const equipment = group('equipment', 'eq', EQUIPMENT, fullEquipment, byName);
  const strategies = group(
    'strategies',
    'st',
    STRATEGIES,
    strategyDocument,
    byName,
  );
  const buildKeys = group(
    'builds',
    'bd',
    builds,
    buildDocument,
    (build) => build.key,
  ).map((build) => build.key);
  const leaders = group('leaders', 'ld', LEADERS, leaderDocument, byName);
  const trainings = group(
    'trainings',
    'training',
    TRAINING,
    trainingDocument,
    byName,
  );
  const bounties = group(
    'bounties',
    'bounty',
    BOUNTIES,
    bountyDocument,
    byName,
  );
  sections.sort((a, b) => b.score - a.score);
  return {
    operators,
    additional,
    covenants,
    equipment,
    strategies,
    builds: buildKeys,
    leaders,
    trainings,
    bounties,
    glossary: matchingEnemyTerms(query, false),
    order: sections.map((section) => section.key),
    top: sections[0]?.target ?? null,
  };
}

/** 全局搜索框回车打开与结果页首个可操作条目相同的目标；空查询或仅有词典释义时返回 null。 */
export function topSearchTarget(
  rawQuery: string,
  builds: readonly SearchBuild[] = [],
): SearchQuickTarget | null {
  return searchResults(prepareSearchQuery(rawQuery), builds).top;
}
