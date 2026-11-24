import type {
  Bounty,
  Covenant,
  DispatchLevel,
  Equipment,
  Leader,
  Operator,
  SeasonDefinition,
  Strategy,
} from '../../../data/types.ts';
import {MAX_LAYERS} from './layers.ts';

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
  readonly operators: NamedEntityDiff;
  readonly covenants: NamedEntityDiff;
  readonly equipment: NamedEntityDiff;
  readonly strategies: NamedEntityDiff;
  readonly leaders: NamedEntityDiff;
  readonly bounties: NamedEntityDiff;
  readonly rules: NamedEntityDiff;
}

interface EntityTypes {
  operators: Operator;
  covenants: Covenant;
  equipment: Equipment;
  strategies: Strategy;
  leaders: Leader;
  bounties: Bounty;
  rules: SeasonDefinition;
}

export type SeasonEntityGroup = keyof EntityTypes;
type EntitySource = {
  [K in SeasonEntityGroup]: {readonly group: K; readonly item: EntityTypes[K]};
}[SeasonEntityGroup];

type Fields = Readonly<Record<string, string | number>>;

/** 单侧的原始实体与用于比较的有效字段。覆盖价格等派生值已经按所属赛季解析。 */
export interface SeasonEntitySnapshot {
  readonly source: EntitySource;
  readonly fields: Fields;
}

/** 同名实体的两侧快照；某侧不存在时为 null。字段差异与摘要共用同一份判定。 */
export interface SeasonEntityComparison extends OperatorChange {
  readonly group: SeasonEntityGroup;
  readonly status: 'added' | 'changed' | 'removed' | 'unchanged';
  readonly before: SeasonEntitySnapshot | null;
  readonly after: SeasonEntitySnapshot | null;
}

const GROUPS = [
  'covenants',
  'strategies',
  'equipment',
  'operators',
  'rules',
  'leaders',
  'bounties',
] as const satisfies readonly SeasonEntityGroup[];

export const GLOBAL_RULES_NAME = '全局赛制与调度中心规则';

const list = (items?: readonly string[]) => items?.join(' / ') ?? '';

function named<T extends {readonly name: string}>(
  items: readonly T[],
  project: (item: T) => SeasonEntitySnapshot,
): Map<string, SeasonEntitySnapshot> {
  return new Map(items.map((item) => [item.name, project(item)]));
}

// 配方材料的先后次序不影响合成结果。同一成品可以有多种配方。
function recipesByResult(season: SeasonDefinition): Map<string, string[]> {
  const recipes = new Map<string, string[]>();
  for (const [a, b, result] of season.equipmentCombos) {
    const ingredients = [a, b].sort().join(' ＋ ');
    const variants = recipes.get(result) ?? [];
    variants.push(ingredients);
    recipes.set(result, variants);
  }
  return recipes;
}

// 函数可能来自不同模块或捕获不同参数。在支持的整数层数范围内寻找首个数值差异，
// 双方都展示该层的实际值，避免使用函数字符串或只比较固定采样点。
function curveLayers(a: Covenant, b?: Covenant): number[] {
  const layers = new Set([0, 100]);
  if (b) {
    a.scaling.forEach((metric, i) => {
      const other = b.scaling[i];
      if (!other || metric.at === other.at) return;
      for (let n = 0; n <= MAX_LAYERS; n++) {
        if (metric.at(n) !== other.at(n)) {
          layers.add(n);
          break;
        }
      }
    });
  }
  return [...layers].sort((x, y) => x - y);
}

function covenantFields(cov: Covenant, other?: Covenant): Fields {
  const layers = curveLayers(cov, other);
  const count = cov.headcountBreakpoint;
  const reward = cov.cycleReward;
  const m = cov.mechanics;
  const trigger = m?.acquisitionMultiplier;
  const rest = m?.endOfRestAllActiveLayers;
  const discounts = m?.priceDiscounts;
  const thresholds = [...(discounts?.steps ?? [])]
    .sort((a, b) => a.layers - b.layers)
    .map((step) => `${step.layers} 层再减 ${step.discount} 资金`);
  return {
    kind: cov.kind,
    need: cov.need,
    effect: cov.effect,
    bonus: cov.bonus,
    layerBreakpoints: (cov.layerBreakpoints ?? [])
      .map((bp) => `${bp.layers} 层 · ${bp.effect}`)
      .join('\n'),
    headcountBreakpoint: count ? `${count.condition} · ${count.effect}` : '',
    cycleReward: reward ? `每 ${reward.every} 层 · ${reward.reward}` : '',
    scaling: cov.scaling
      .map((metric) => {
        const values = layers
          .map((n) => `${n} 层 ${metric.at(n)}${metric.unit}`)
          .join(' / ');
        const condition = metric.condition ? `（${metric.condition}）` : '';
        return `${metric.label}${condition} · ${values}`;
      })
      .join('\n'),
    restrictedModeAbsent: cov.restrictedModeAbsent ? '缺席' : '',
    roles: list(cov.roles),
    bonusRoles: list(cov.bonusRoles),
    bonusElements: list(cov.bonusElements),
    memberArtsDamage: cov.memberArtsDamage ? '盟约干员可造成法术伤害' : '',
    countMode: m?.countMode === 'fieldElites' ? '场上全部精锐' : '所属盟约干员',
    countsReserve: m?.countsReserve ? '场上和整备区' : '仅场上',
    maxCount: m?.maxCount ?? '',
    addsCoreCount: m?.addsCoreCount || '',
    bonusNeed:
      m?.bonusNeed ??
      (Number(cov.bonus.match(/^(\d+)名(?!精锐)/)?.[1]) ||
        (cov.kind === 'core' ? 6 : '')),
    acquisitionMultiplier: trigger
      ? [
          `基础 ${trigger.base} 次`,
          ...(trigger.bonusLayers !== undefined && trigger.bonus !== undefined
            ? [`${trigger.bonusLayers} 层起 ${trigger.bonus} 次`]
            : []),
        ].join(' / ')
      : '',
    endOfRestAllActiveLayers: rest
      ? `每个已激活盟约 +${rest.base} 层，强化后 +${rest.bonus} 层`
      : '',
    priceDiscounts:
      discounts && thresholds.length
        ? `${thresholds.join(' / ')}，最低 ${discounts.minPrice ?? 1} 资金`
        : '',
    rangePreviewLayers: m?.rangePreviewLayers ?? '',
  };
}

function sellTerms(op: Operator): string {
  const sell = op.sellMechanics;
  const growth = sell?.roundGrowth;
  const base = `初始 ${sell?.base ?? 1} 资金 / 精锐 ${sell?.elite ?? 1} 资金`;
  return growth
    ? `${base}。每次休整期结束时分别 +${growth.baseStep} / +${growth.eliteStep}，最高 ${growth.baseMax} / ${growth.eliteMax} 资金`
    : base;
}

function dispatchTable(table: readonly DispatchLevel[]): string {
  return [...table]
    .sort((a, b) => a.level - b.level)
    .map((row) => {
      const cost =
        row.upgradeCost === null ? '满级' : `升本 ${row.upgradeCost} 资金`;
      return `Lv.${row.level} ${cost} · 干员 ${row.operatorSlots} 格 / 装备 ${row.equipmentSlots} 格`;
    })
    .join('\n');
}

function globalFields({meta, rules}: SeasonDefinition): Fields {
  return {
    baseDeploymentLimit: meta.baseDeploymentLimit,
    defaultEliteCopies: meta.defaultEliteCopies,
    standardRounds: meta.roundLimits.standard,
    fastRounds: meta.roundLimits.fast,
    tierBasePrices: meta.tierBasePrices
      .slice(1)
      .map((price, i) => `${i + 1} 阶 ${price} 资金`)
      .join(' / '),
    dispatchLevels: dispatchTable(rules.dispatchLevels),
    dispatchByMode: rules.dispatchByMode
      .map(
        (table, i) =>
          `${rules.dispatchModes[i] ?? i + 1}\n${dispatchTable(table)}`,
      )
      .join('\n'),
    borrowLimit: rules.borrowLimit,
    leaderCreditBonus: rules.leaderCreditBonus,
    decisionRounds: Object.entries(rules.decisionRounds)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mode, rounds]) => `${mode} · ${rounds.join(' / ')}`)
      .join('\n'),
    roundTime: rules.roundTime.join(' / '),
    credit: rules.credit.join(' / '),
  };
}

type Inventory = Record<SeasonEntityGroup, Map<string, SeasonEntitySnapshot>>;

function inventory(
  season: SeasonDefinition,
  other: SeasonDefinition,
): Inventory {
  const recipes = recipesByResult(season);
  return {
    operators: named(season.operators, (op) => ({
      source: {group: 'operators', item: op},
      fields: {
        tier: op.tier,
        covenants: list(op.covenants),
        type: op.type,
        trait: op.trait,
        elite: op.elite,
        price: op.price ?? season.meta.tierBasePrices[op.tier] ?? '',
        eliteCopies: op.eliteCopies ?? season.meta.defaultEliteCopies,
        stars: op.stars,
        roles: list(op.roles),
        eliteOnlyRoles: list(op.eliteOnlyRoles),
        sellMechanics: sellTerms(op),
        inflictsElements: list(op.inflictsElements),
        elementalPrerequisites: list(op.elementalPrerequisites),
        minimumFieldRoles: op.minimumFieldRoles
          ? `场上至少 ${op.minimumFieldRoles.count} 名 · ${list(op.minimumFieldRoles.roles)}`
          : '',
        melee: op.melee ? '近战位' : '',
        combatAction: op.combatAction ?? '攻击',
        borrowable: op.borrowable ? '可借用' : '',
        backupOperator: op.backupOperator ?? '',
      },
    })),
    covenants: new Map(
      Object.entries(season.covenants).map(([name, item]) => [
        name,
        {
          source: {group: 'covenants', item},
          fields: covenantFields(
            item,
            Object.hasOwn(other.covenants, name)
              ? other.covenants[name]
              : undefined,
          ),
        },
      ]),
    ),
    equipment: named(season.equipment, (eq) => ({
      source: {group: 'equipment', item: eq},
      fields: {
        tier: eq.tier,
        price: eq.price,
        covenant: eq.covenant ?? '',
        effect: eq.effect,
        advanced: eq.advanced ?? '',
        recipe: (recipes.get(eq.name) ?? [])
          .sort()
          .map((pair) => `${pair} → ${eq.name}`)
          .join('\n'),
        roles: list(eq.roles),
        roleTrigger: eq.roleTrigger ?? '',
        deploymentSlotBonus: eq.mechanics?.deploymentSlotBonus || '',
        grantsCompanionCovenant: eq.mechanics?.grantsCompanionCovenant
          ? '携带者获得另一件装备的盟约'
          : '',
        grantsArtsOnDamage: eq.grantsArtsOnDamage
          ? '能造成伤害的携带者获得法术伤害'
          : '',
        inflictsElements: list(eq.inflictsElements),
      },
    })),
    strategies: named(season.strategies, (st) => ({
      source: {group: 'strategies', item: st},
      fields: {
        hp: st.hp,
        category: st.category,
        effect: st.effect,
        skill: st.skill,
        unlock: st.unlock,
      },
    })),
    leaders: named(season.leaders, (ld) => ({
      source: {group: 'leaders', item: ld},
      fields: {
        hp: ld.hp.join('/'),
        hiddenCore: ld.hiddenCore?.join('/') ?? '',
        damage: list(ld.damage),
        ...ld.profile,
        abilities: ld.abilities
          .map((a) => (a.skill ? `【${a.skill}】${a.text}` : a.text))
          .join('\n'),
        hiddenAbilities: ld.hiddenAbilities
          .map((a) => (a.skill ? `【${a.skill}】${a.text}` : a.text))
          .join('\n'),
      },
    })),
    bounties: named(season.rules.bounties, (b) => ({
      source: {group: 'bounties', item: b},
      fields: {
        funds: b.funds,
        when: b.when,
        mobility: b.mobility,
        range: b.range,
        damage: b.damage,
        mechanics: b.mechanics,
        counter: b.counter,
        roles: list(b.roles),
        tags: list(b.tags),
      },
    })),
    rules: new Map([
      [
        GLOBAL_RULES_NAME,
        {source: {group: 'rules', item: season}, fields: globalFields(season)},
      ],
    ]),
  };
}

function compareGroup(
  group: SeasonEntityGroup,
  before: Inventory,
  after: Inventory,
  entries?: SeasonEntityComparison[],
): NamedEntityDiff {
  const added: string[] = [],
    removed: string[] = [],
    changed: OperatorChange[] = [];
  const names = new Set([...after[group].keys(), ...before[group].keys()]);
  for (const name of names) {
    const left = before[group].get(name) ?? null;
    const right = after[group].get(name) ?? null;
    const changes: FieldChange<string | number>[] = [];
    let status: SeasonEntityComparison['status'] = 'unchanged';
    if (left && right) {
      const keys = new Set([
        ...Object.keys(left.fields),
        ...Object.keys(right.fields),
      ]);
      for (const field of keys) {
        const a = left.fields[field] ?? '',
          b = right.fields[field] ?? '';
        if (a !== b) changes.push({field, before: a, after: b});
      }
      if (changes.length) {
        changed.push({name, changes});
        status = 'changed';
      }
    } else if (right) {
      added.push(name);
      status = 'added';
    } else {
      removed.push(name);
      status = 'removed';
    }
    entries?.push({group, name, before: left, after: right, changes, status});
  }
  return {added, removed, changed};
}

/** 比较任意两个已解析的完整赛季，默认返回按名称匹配的增删改摘要。传入 details 可同时取得两侧快照和未变项。 */
export function diffSeasons(
  prev: SeasonDefinition,
  next: SeasonDefinition,
): SeasonDiff;
export function diffSeasons(
  prev: SeasonDefinition,
  next: SeasonDefinition,
  options: {readonly details: true},
): SeasonDiff & {readonly entries: readonly SeasonEntityComparison[]};
export function diffSeasons(
  prev: SeasonDefinition,
  next: SeasonDefinition,
  options?: {readonly details: true},
): SeasonDiff & {readonly entries?: readonly SeasonEntityComparison[]} {
  const before = inventory(prev, next);
  const after = prev === next ? before : inventory(next, prev);
  const entries: SeasonEntityComparison[] | undefined = options?.details
    ? []
    : undefined;
  const result = {} as Record<SeasonEntityGroup, NamedEntityDiff>;
  for (const group of GROUPS)
    result[group] = compareGroup(group, before, after, entries);
  return {
    fromId: prev.meta.id,
    toId: next.meta.id,
    ...result,
    ...(entries && {entries}),
  };
}
