import {
  ALL_COVENANTS,
  EQUIPMENT,
  LEADERS,
  OPERATORS,
  STRATEGIES,
  type Equipment,
  type Operator,
} from '../../data/index.ts';
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
  return normalize(operator.elite).includes(q);
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
  kind: 'op' | 'eq' | 'st' | 'cv' | 'bd' | 'ld';
  id: string;
};

/**
 * 选出全局搜索框按下 Enter 后最应该直达的首个条目。
 * 优先按名称匹配最高分，同分按 `干员 > 盟约 > 装备 > 策略 > 流派 > 领袖`；
 * 若无名称命中，则回退到说明/特质文案命中的首项。
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
  if (best) {
    const found: SearchQuickTarget & {score: number; priority: number} = best;
    return {kind: found.kind, id: found.id};
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
    const hay = normalize(
      [
        ...ld.abilities,
        ...ld.hiddenAbilities,
        ...ld.counters.map((c) => ({skill: c.tag, text: c.text})),
      ]
        .map((a) => (a.skill ?? '') + a.text)
        .join('|'),
    );
    if (hay.includes(q)) return {kind: 'ld', id: ld.name};
  }
  return null;
}
