import type {
  Covenant,
  Equipment,
  Leader,
  Operator,
  SeasonDefinition,
  Strategy,
} from '../../../data/types.ts';

export interface FieldChange<T = string | number | null> {
  readonly field: string;
  readonly before: T;
  readonly after: T;
}

export interface OperatorChange {
  readonly name: string;
  readonly changes: readonly FieldChange<string | number>[];
}

export interface NamedEntityDiff<TChange = OperatorChange> {
  readonly added: readonly string[];
  readonly removed: readonly string[];
  readonly changed: readonly TChange[];
}

export interface SeasonDiff {
  readonly fromId: string;
  readonly toId: string;
  readonly operators: NamedEntityDiff<OperatorChange>;
  readonly covenants: NamedEntityDiff<OperatorChange>;
  readonly equipment: NamedEntityDiff<OperatorChange>;
  readonly strategies: NamedEntityDiff<OperatorChange>;
  readonly leaders: NamedEntityDiff<OperatorChange>;
}

const sameStringList = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((item, index) => item === b[index]);

function diffOperator(prev: Operator, next: Operator): OperatorChange | null {
  const changes: FieldChange<string | number>[] = [];
  if (prev.tier !== next.tier) {
    changes.push({field: 'tier', before: prev.tier, after: next.tier});
  }
  if (!sameStringList(prev.covenants, next.covenants)) {
    changes.push({
      field: 'covenants',
      before: prev.covenants.join(' / '),
      after: next.covenants.join(' / '),
    });
  }
  if (prev.type !== next.type) {
    changes.push({field: 'type', before: prev.type, after: next.type});
  }
  if (prev.trait !== next.trait) {
    changes.push({field: 'trait', before: prev.trait, after: next.trait});
  }
  if (prev.elite !== next.elite) {
    changes.push({field: 'elite', before: prev.elite, after: next.elite});
  }
  if ((prev.price ?? 0) !== (next.price ?? 0)) {
    changes.push({
      field: 'price',
      before: prev.price ?? 0,
      after: next.price ?? 0,
    });
  }
  return changes.length ? {name: next.name, changes} : null;
}

function diffCovenant(
  name: string,
  prev: Covenant,
  next: Covenant,
): OperatorChange | null {
  const changes: FieldChange<string | number>[] = [];
  if (prev.kind !== next.kind) {
    changes.push({field: 'kind', before: prev.kind, after: next.kind});
  }
  if (prev.need !== next.need) {
    changes.push({field: 'need', before: prev.need, after: next.need});
  }
  if (prev.effect !== next.effect) {
    changes.push({field: 'effect', before: prev.effect, after: next.effect});
  }
  if (prev.bonus !== next.bonus) {
    changes.push({field: 'bonus', before: prev.bonus, after: next.bonus});
  }
  return changes.length ? {name, changes} : null;
}

function diffEquipment(
  prev: Equipment,
  next: Equipment,
): OperatorChange | null {
  const changes: FieldChange<string | number>[] = [];
  if (prev.tier !== next.tier) {
    changes.push({field: 'tier', before: prev.tier, after: next.tier});
  }
  if (prev.price !== next.price) {
    changes.push({field: 'price', before: prev.price, after: next.price});
  }
  if ((prev.covenant ?? '') !== (next.covenant ?? '')) {
    changes.push({
      field: 'covenant',
      before: prev.covenant ?? '',
      after: next.covenant ?? '',
    });
  }
  if (prev.effect !== next.effect) {
    changes.push({field: 'effect', before: prev.effect, after: next.effect});
  }
  if ((prev.advanced ?? '') !== (next.advanced ?? '')) {
    changes.push({
      field: 'advanced',
      before: prev.advanced ?? '',
      after: next.advanced ?? '',
    });
  }
  return changes.length ? {name: next.name, changes} : null;
}

function diffStrategy(prev: Strategy, next: Strategy): OperatorChange | null {
  const changes: FieldChange<string | number>[] = [];
  if (prev.hp !== next.hp) {
    changes.push({field: 'hp', before: prev.hp, after: next.hp});
  }
  if (prev.category !== next.category) {
    changes.push({
      field: 'category',
      before: prev.category,
      after: next.category,
    });
  }
  if (prev.effect !== next.effect) {
    changes.push({field: 'effect', before: prev.effect, after: next.effect});
  }
  return changes.length ? {name: next.name, changes} : null;
}

function diffLeader(prev: Leader, next: Leader): OperatorChange | null {
  const changes: FieldChange<string | number>[] = [];
  if (prev.hp.join(',') !== next.hp.join(',')) {
    changes.push({
      field: 'hp',
      before: prev.hp.join('/'),
      after: next.hp.join('/'),
    });
  }
  const prevHidden = prev.hiddenCore?.join('/') ?? '';
  const nextHidden = next.hiddenCore?.join('/') ?? '';
  if (prevHidden !== nextHidden) {
    changes.push({
      field: 'hiddenCore',
      before: prevHidden,
      after: nextHidden,
    });
  }
  return changes.length ? {name: next.name, changes} : null;
}

function diffNamedList<T extends {readonly name: string}>(
  prevList: readonly T[],
  nextList: readonly T[],
  compare: (prev: T, next: T) => OperatorChange | null,
): NamedEntityDiff<OperatorChange> {
  const prevMap = new Map(prevList.map((item) => [item.name, item]));
  const nextMap = new Map(nextList.map((item) => [item.name, item]));
  const added: string[] = [];
  const removed: string[] = [];
  const changed: OperatorChange[] = [];

  for (const item of nextList) {
    const prev = prevMap.get(item.name);
    if (!prev) {
      added.push(item.name);
      continue;
    }
    const diff = compare(prev, item);
    if (diff) changed.push(diff);
  }
  for (const item of prevList) {
    if (!nextMap.has(item.name)) removed.push(item.name);
  }
  return {added, removed, changed};
}

/** 比较两个赛季定义的新增、移出与关键数值变动，不修改任何输入对象。 */
export function diffSeasons(
  prev: SeasonDefinition,
  next: SeasonDefinition,
): SeasonDiff {
  const prevCovNames = Object.keys(prev.covenants);
  const nextCovNames = Object.keys(next.covenants);
  const addedCov = nextCovNames.filter((name) => !Object.hasOwn(prev.covenants, name));
  const removedCov = prevCovNames.filter((name) => !Object.hasOwn(next.covenants, name));
  const changedCov: OperatorChange[] = [];
  for (const name of nextCovNames) {
    if (!Object.hasOwn(prev.covenants, name)) continue;
    const diff = diffCovenant(name, prev.covenants[name], next.covenants[name]);
    if (diff) changedCov.push(diff);
  }

  return {
    fromId: prev.meta.id,
    toId: next.meta.id,
    operators: diffNamedList(prev.operators, next.operators, diffOperator),
    covenants: {added: addedCov, removed: removedCov, changed: changedCov},
    equipment: diffNamedList(prev.equipment, next.equipment, diffEquipment),
    strategies: diffNamedList(prev.strategies, next.strategies, diffStrategy),
    leaders: diffNamedList(prev.leaders, next.leaders, diffLeader),
  };
}
