import {
  ADDITIONAL_OPERATORS,
  ALL_COVENANTS,
  BOUNTIES,
  COMBAT_ROLE_LABELS,
  ENEMY_GLOSSARY,
  EQUIPMENT,
  LEADERS,
  OPERATORS,
  STRATEGIES,
  TRAINING,
  equipmentWithRoles,
  operatorRolesAtElite,
  operatorsWithRoles,
  rolesForTraining,
  type Bounty,
  type CombatRole,
  type EnemyTerm,
  type Equipment,
  type Leader,
  type Operator,
  type TrainingType,
} from '../../data/index.ts';
import {leaderGlossaryTerms} from '../lib/leaders/leader.ts';
import {nameScore, normalize} from '../lib/ui/match.ts';
import type {Plan} from '../lib/plans/model.ts';

/** 列表匹配和回车直达共用的流派正文，包括说明、策略、主力、备选和装备名称。 */
export function buildSearchDescription(plan: Plan): string {
  return [
    plan.note,
    plan.strategy,
    plan.ops.flatMap((slot) => [slot.name, ...slot.alt, ...slot.eq]).join('/'),
  ].join('|');
}

/** 将已归一化的查询词匹配到职能名称，供结果列表和回车直达共用。 */
export function matchingCombatRoles(query: string): Set<CombatRole> {
  return new Set(
    COMBAT_ROLE_LABELS.filter((role) => nameScore(role, query) > 0),
  );
}

/** 返回匹配的敌人词条，按名称和拼音优先排序。仅展示名称命中的列表可跳过正文。 */
export function matchingEnemyTerms(
  query: string,
  includeDescription = true,
): EnemyTerm[] {
  if (!query) return [];
  return Object.values(ENEMY_GLOSSARY)
    .map((entry) => ({
      entry,
      score:
        nameScore(entry.term, query) ||
        (includeDescription && normalize(entry.desc).includes(query) ? 1 : 0),
    }))
    .filter(({score}) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({entry}) => entry);
}

const leaderTermCache = new Map<string, readonly string[]>();

/** 返回 Boss 关联的全部可拼音匹配词条（技能名、专属单位/机制、随行敌人、相关词典名词）。 */
export function leaderSearchTerms(leader: Leader): readonly string[] {
  const cached = leaderTermCache.get(leader.id);
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
  leaderTermCache.set(leader.id, list);
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

const glossaryNames = Object.keys(ENEMY_GLOSSARY).map((name) => ({
  name,
  normalized: normalize(name),
}));

/** 按不可变赛季条目惰性索引正文和关联名词，连续输入查询时只比较真正相关的词。 */
function createEnemyMatcher<T extends {readonly name: string}>(
  describe: (item: T) => {body: string; terms: string[]},
): (item: T, query: string) => number {
  const index = new WeakMap<T, {body: string; terms: readonly string[]}>();
  return (item, query) => {
    if (!query) return 0;
    const direct = nameScore(item.name, query);
    if (direct) return direct;
    let entry = index.get(item);
    if (!entry) {
      const {body: raw, terms} = describe(item);
      const body = normalize(raw);
      const related = new Set(terms);
      for (const term of glossaryNames) {
        if (body.includes(term.normalized)) related.add(term.name);
      }
      entry = {body, terms: [...related]};
      index.set(item, entry);
    }
    if (entry.terms.some((name) => nameScore(name, query) > 0)) return 1.25;
    return entry.body.includes(query) ? 1 : 0;
  };
}

/** 返回悬赏敌人对归一化查询的匹配度，名称优先，其次是标签、职能和词典名词。 */
export const bountyMatchScore = createEnemyMatcher<Bounty>((item) => ({
  body: `${item.mechanics}|${item.counter}`,
  terms: [
    item.when,
    item.mobility,
    item.range,
    item.damage,
    ...(item.tags ?? []),
    ...(item.roles ?? []),
  ],
}));

/** 返回普通敌人对归一化查询的匹配度，检索名称、标签、代表机制、职能与正文。 */
export const trainingMatchScore = createEnemyMatcher<TrainingType>((item) => ({
  body: `${item.desc}|${item.attackStyle}|${item.strategy}`,
  terms: [...item.tags, ...item.examples, ...rolesForTraining(item.name)],
}));

/** 查询仅命中干员精锐特质（名称、盟约和初始特质未命中）时返回 true。 */
export function matchedOnlyElite(
  operator: Operator,
  rawQuery: string,
): boolean {
  const q = normalize(rawQuery);
  if (!q) return false;
  if (nameScore(operator.name, q) > 0) return false;
  if (operator.covenants.some((c) => nameScore(c, q) > 0)) return false;
  if (normalize(operator.trait).includes(q)) return false;
  const matchesRole = (role: CombatRole) => nameScore(role, q) > 0;
  if (operatorRolesAtElite(operator, false).some(matchesRole)) return false;
  return (
    Boolean(operator.roles?.some(matchesRole)) ||
    normalize(operator.elite).includes(q)
  );
}

/** 查询仅命中装备进阶效果（名称、盟约和基础效果未命中）时返回 true。 */
export function matchedOnlyAdvanced(
  item: Equipment,
  rawQuery: string,
): boolean {
  const q = normalize(rawQuery);
  if (!q || !item.advanced) return false;
  if (nameScore(item.name, q) > 0) return false;
  if (item.covenant && nameScore(item.covenant, q) > 0) return false;
  if (normalize(item.effect).includes(q)) return false;
  return normalize(item.advanced).includes(q);
}

export type SearchQuickTarget = {
  kind:
    'op' | 'eq' | 'st' | 'cv' | 'bd' | 'ld' | 'training' | 'bounty' | 'roster';
  id: string;
};

/**
 * 选出全局搜索框按下 Enter 后最应该直达的首个条目。
 * 优先按名称匹配最高分，同分按 `干员 > 盟约 > 装备 > 策略 > 流派 > Boss > 普通敌人 > 悬赏敌人`；
 * 若无名称命中，则回退到职能、关联词条与说明文案命中的首项。
 */
export function topSearchTarget(
  rawQuery: string,
  buildItems: readonly {key: string; name: string; plan?: Plan}[] = [],
): SearchQuickTarget | null {
  const q = normalize(rawQuery);
  if (!q) return null;

  let best: (SearchQuickTarget & {score: number; priority: number}) | null =
    null;
  const offer = (
    kind: SearchQuickTarget['kind'],
    id: string,
    score: number,
    priority: number,
  ): void => {
    if (score <= 0) return;
    if (
      !best ||
      score > best.score ||
      (score === best.score && priority < best.priority)
    ) {
      best = {kind, id, score, priority};
    }
  };

  for (const op of OPERATORS) {
    offer('op', op.name, nameScore(op.name, q), 1);
  }
  for (const op of ADDITIONAL_OPERATORS) {
    offer('roster', op.avatar, nameScore(op.name, q), 1);
  }
  for (const cov of ALL_COVENANTS) {
    offer('cv', cov, nameScore(cov, q), 2);
  }
  for (const eq of EQUIPMENT) {
    offer('eq', eq.name, nameScore(eq.name, q), 3);
  }
  for (const st of STRATEGIES) {
    offer('st', st.name, nameScore(st.name, q), 4);
  }
  for (const b of buildItems) {
    const score = Math.max(nameScore(b.name, q), nameScore(b.key, q));
    offer('bd', b.key, score, 5);
  }
  for (const ld of LEADERS) {
    offer('ld', ld.name, nameScore(ld.name, q), 6);
  }
  for (const tr of TRAINING) {
    offer('training', tr.name, nameScore(tr.name, q), 7);
  }
  for (const bounty of BOUNTIES) {
    offer('bounty', bounty.name, nameScore(bounty.name, q), 8);
  }
  if (best) {
    const found: SearchQuickTarget & {score: number; priority: number} = best;
    return {kind: found.kind, id: found.id};
  }

  const roles = [...matchingCombatRoles(q)];
  if (roles.length) {
    const firstOperator = operatorsWithRoles(roles).sort(
      (a, b) => a.tier - b.tier,
    )[0];
    if (firstOperator) return {kind: 'op', id: firstOperator.name};
    const firstItem = equipmentWithRoles(roles)[0];
    if (firstItem) return {kind: 'eq', id: firstItem.name};
  }

  for (const op of OPERATORS) {
    const hay = normalize(op.covenants.join('/') + op.trait + op.elite);
    if (hay.includes(q)) return {kind: 'op', id: op.name};
  }
  for (const eq of EQUIPMENT) {
    const hay = normalize(
      (eq.covenant || '') + eq.effect + (eq.advanced || ''),
    );
    if (hay.includes(q)) return {kind: 'eq', id: eq.name};
  }
  for (const st of STRATEGIES) {
    const hay = normalize(st.skill + '|' + st.effect + st.category);
    if (hay.includes(q)) return {kind: 'st', id: st.name};
  }
  for (const build of buildItems) {
    if (build.plan && normalize(buildSearchDescription(build.plan)).includes(q))
      return {kind: 'bd', id: build.key};
  }
  for (const ld of LEADERS) {
    if (
      leaderSearchTerms(ld).some((term) => nameScore(term, q) > 0) ||
      normalize(leaderSearchDescription(ld)).includes(q)
    ) {
      return {kind: 'ld', id: ld.name};
    }
  }
  for (const tr of TRAINING) {
    if (trainingMatchScore(tr, q) > 0) return {kind: 'training', id: tr.name};
  }
  for (const bounty of BOUNTIES) {
    if (bountyMatchScore(bounty, q) > 0) {
      return {kind: 'bounty', id: bounty.name};
    }
  }
  return null;
}
