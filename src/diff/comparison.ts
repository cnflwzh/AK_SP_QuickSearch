import type {Covenant, SeasonDefinition} from '../../data/types.ts';
import {
  diffSeasons,
  type SeasonEntityComparison,
  type SeasonEntityGroup,
  type SeasonEntitySnapshot,
} from '../lib/season/diff.ts';
import {diffText, type TextTokenDiff} from './tokenDiff.ts';

export type DiffCategory =
  'covenants' | 'strategies' | 'equipment' | 'operators' | 'rules';
export type DiffFilterCategory = 'all' | DiffCategory;
export type DiffStatus = 'added' | 'modified' | 'removed' | 'unchanged';

export interface SideCovenantChip {
  readonly name: string;
  readonly iconSrc: string;
  readonly color: string;
  readonly diffState?: 'added' | 'removed' | 'same';
}

export interface SideBadge {
  readonly label: string;
  readonly tone?: 'default' | 'accent' | 'teal' | 'red' | 'tier';
  readonly tier?: number;
}

type IconKind =
  | 'covenant'
  | 'strategy'
  | 'equipment'
  | 'operator'
  | 'leader'
  | 'bounty'
  | 'rule';

export interface EntitySideSnapshot {
  readonly name: string;
  readonly iconSrc: string;
  readonly iconKind: IconKind;
  readonly accentColor?: string;
  readonly tier?: number;
  readonly badges: readonly SideBadge[];
  readonly covenantChips: readonly SideCovenantChip[];
}

export interface DeltaBadge {
  readonly text: string;
  readonly tone: 'up' | 'down' | 'shift';
}

export interface VisualDiffRow {
  readonly key: string;
  readonly label: string;
  readonly before: string | null;
  readonly after: string | null;
  readonly changed: boolean;
  readonly delta?: DeltaBadge;
  readonly tokenDiff?: TextTokenDiff;
}

export interface VisualDiffEntry {
  readonly key: string;
  readonly category: DiffCategory;
  readonly subKind: Exclude<IconKind, 'rule'> | 'global-rule';
  readonly name: string;
  readonly status: DiffStatus;
  readonly covenants: readonly string[];
  readonly tier: number | null;
  readonly searchText: string;
  readonly left: EntitySideSnapshot | null;
  readonly right: EntitySideSnapshot | null;
  readonly rows: readonly VisualDiffRow[];
  readonly changedCount: number;
  readonly unchangedCount: number;
}

export interface CategoryDiffSummary {
  readonly added: number;
  readonly modified: number;
  readonly removed: number;
  readonly unchanged: number;
  readonly totalChanges: number;
}

export interface SeasonVisualComparison {
  readonly from: SeasonDefinition;
  readonly to: SeasonDefinition;
  readonly identical: boolean;
  readonly entries: readonly VisualDiffEntry[];
  readonly totals: CategoryDiffSummary;
  readonly byCategory: Readonly<Record<DiffCategory, CategoryDiffSummary>>;
  readonly mergedCovenants: Readonly<Record<string, Covenant>>;
}

const labels: Readonly<Record<string, string>> = {
  tier: '等阶',
  covenants: '所属盟约',
  type: '干员类型',
  trait: '初始特质',
  elite: '精锐特质',
  price: '价格',
  eliteCopies: '合成精锐',
  stars: '星级',
  roles: '实战职能',
  eliteOnlyRoles: '精锐新增职能',
  sellMechanics: '出售价格',
  elementalPrerequisites: '元素输出触发条件',
  minimumFieldRoles: '部署人数要求',
  inflictsElements: '可施加的损伤与异常',
  melee: '近战部署条件',
  combatAction: '攻击与伤害判定',
  borrowable: '助战借用',
  backupOperator: '默认替补',
  kind: '盟约类型',
  need: '激活人数',
  effect: '基础效果',
  bonus: '强化效果',
  layerBreakpoints: '层数门槛',
  headcountBreakpoint: '人数门槛',
  cycleReward: '循环奖励',
  scaling: '层数成长',
  restrictedModeAbsent: '受限模式',
  bonusRoles: '强化职能',
  bonusElements: '强化后可施加的损伤与异常',
  memberArtsDamage: '盟约干员法术伤害',
  countMode: '计数对象',
  countsReserve: '人数统计范围',
  maxCount: '生效人数上限',
  addsCoreCount: '核心盟约额外人数',
  bonusNeed: '强化所需人数',
  acquisitionMultiplier: '获得时特质触发次数',
  endOfRestAllActiveLayers: '休整期结束叠层',
  priceDiscounts: '干员招募折扣',
  rangePreviewLayers: '范围扩大层数',
  covenant: '所属盟约',
  advanced: '进阶效果',
  recipe: '合成配方',
  roleTrigger: '职能触发条件',
  deploymentSlotBonus: '额外部署位',
  grantsCompanionCovenant: '装备盟约继承',
  grantsArtsOnDamage: '法术伤害效果',
  hp: '生命',
  category: '策略分类',
  skill: '指挥技能',
  unlock: '解锁条件',
  hiddenCore: '隐秘核心生命',
  damage: '伤害类型',
  attackMode: '攻击方式',
  defense: '抗性与减伤',
  targeting: '索敌规律',
  blocking: '阻挡需求',
  summary: '战前对策速记',
  hiddenSummary: '隐秘核心要点',
  abilities: '领袖能力',
  hiddenAbilities: '隐秘核心能力',
  funds: '悬赏收益',
  when: '发放时机',
  mobility: '行动方式',
  range: '攻击距离',
  mechanics: '核心机制',
  counter: '实战对策',
  tags: '机制标签',
  baseDeploymentLimit: '基础部署上限',
  defaultEliteCopies: '默认精锐合成',
  standardRounds: '标准回合数',
  fastRounds: '极速回合数',
  tierBasePrices: '各阶基础招募价',
  dispatchLevels: '调度中心升本与栏位',
  dispatchByMode: '各赛制调度中心',
  borrowLimit: '备战助战上限',
  leaderCreditBonus: '击败领袖认证奖励',
  decisionRounds: '决策回合',
  roundTime: '各回合作战时限（秒）',
  credit: '各回合基础认证',
};

const imagePath = (folder: string, file: string) =>
  file ? `/assets/img/${folder}/${file}.webp` : '';
const covenantIcon = (c: Covenant) => imagePath('covenants', c.icon ?? c.id);
const tierLabel = (n: number, s: SeasonDefinition) =>
  `${s.rules.tierLabels[n] || n}阶`;
const tierBadge = (n: number, s: SeasonDefinition): SideBadge => ({
  label: tierLabel(n, s),
  tone: 'tier',
  tier: n,
});

function covenantsOf(
  side: SeasonEntitySnapshot | null,
  name: string,
  season: SeasonDefinition,
): readonly string[] {
  switch (side?.source.group) {
    case 'covenants':
      return [name];
    case 'operators':
      return side.source.item.covenants;
    case 'equipment':
      return side.source.item.covenant ? [side.source.item.covenant] : [];
    case 'strategies': {
      const category = side.source.item.category;
      return Object.hasOwn(season.covenants, category) ? [category] : [];
    }
    default:
      return [];
  }
}

function sideCard(
  side: SeasonEntitySnapshot | null,
  name: string,
  season: SeasonDefinition,
  names: readonly string[],
  opposite: readonly string[],
  direction: 'added' | 'removed',
): EntitySideSnapshot | null {
  if (!side) return null;
  const {source, fields} = side;
  const covenantChips: SideCovenantChip[] =
    source.group === 'covenants'
      ? []
      : names.map((c) => {
          const cov = Object.hasOwn(season.covenants, c)
            ? season.covenants[c]
            : undefined;
          return {
            name: c,
            color: cov?.color || 'var(--teal)',
            iconSrc: cov ? covenantIcon(cov) : '',
            diffState: opposite.includes(c) ? 'same' : direction,
          };
        });
  const base = {name, covenantChips};
  switch (source.group) {
    case 'operators': {
      const op = source.item;
      return {
        ...base,
        iconKind: 'operator',
        iconSrc: imagePath('avatars', op.avatar),
        tier: op.tier,
        badges: [
          tierBadge(op.tier, season),
          {label: `${fields.price} 资金`},
          {label: op.type},
        ],
      };
    }
    case 'equipment': {
      const eq = source.item;
      return {
        ...base,
        iconKind: 'equipment',
        iconSrc: imagePath('equipment', eq.icon),
        tier: eq.tier,
        badges: [
          tierBadge(eq.tier, season),
          {label: `${eq.price} 资金`, tone: 'accent'},
        ],
      };
    }
    case 'covenants': {
      const c = source.item;
      const badges: SideBadge[] = [
        {label: c.kind === 'core' ? '核心盟约' : '附加盟约', tone: 'accent'},
        {label: `${c.need} 人激活`},
      ];
      if (c.restrictedModeAbsent) badges.push({label: '受限缺席', tone: 'red'});
      return {
        ...base,
        iconKind: 'covenant',
        iconSrc: covenantIcon(c),
        accentColor: c.color || 'var(--teal)',
        badges,
      };
    }
    case 'strategies': {
      const st = source.item;
      const badges: SideBadge[] = [{label: `生命 ${st.hp}`, tone: 'teal'}];
      if (!names.length) badges.push({label: st.category});
      badges.push({label: st.unlock});
      return {
        ...base,
        iconKind: 'strategy',
        iconSrc: imagePath('strategies', st.portrait),
        accentColor: covenantChips[0]?.color,
        badges,
      };
    }
    case 'leaders': {
      const leader = source.item;
      const badges: SideBadge[] = [
        {label: 'Boss 领袖', tone: 'red'},
        ...leader.damage.map((label) => ({label})),
      ];
      if (leader.hiddenCore) badges.push({label: '含隐秘核心', tone: 'accent'});
      return {
        ...base,
        iconKind: 'leader',
        iconSrc: imagePath('leaders', leader.id),
        badges,
      };
    }
    case 'bounties': {
      const b = source.item;
      return {
        ...base,
        iconKind: 'bounty',
        iconSrc: imagePath('enemies', b.enemyId),
        badges: [
          {label: '悬赏敌人', tone: 'teal'},
          {label: `+${b.funds} 资金`, tone: 'accent'},
          {label: b.when},
        ],
      };
    }
    case 'rules':
      return {
        ...base,
        iconKind: 'rule',
        iconSrc: '',
        badges: [
          {label: season.meta.guideSubtitle, tone: 'accent'},
          {label: `${season.meta.baseDeploymentLimit} 部署位`},
          {label: `助战 ${season.rules.borrowLimit}`},
        ],
      };
  }
}

function fieldText(
  key: string,
  side: SeasonEntitySnapshot | null,
  season: SeasonDefinition,
): string | null {
  const value = side?.fields[key];
  if (value === '' || value === undefined) return null;
  if (key === 'tier') return tierLabel(Number(value), season);
  if (key === 'kind') return value === 'core' ? '核心盟约' : '附加盟约';
  if (key === 'covenant' || key === 'covenants')
    return String(value)
      .split(' / ')
      .map((s) => `【${s}】`)
      .join(' ');
  if (
    side?.source.group === 'leaders' &&
    (key === 'hp' || key === 'hiddenCore')
  ) {
    const offset = key === 'hp' ? 0 : 1;
    return String(value)
      .split('/')
      .map(
        (hp, i) =>
          `${season.rules.modes[i + offset] ?? i + offset + 1} ${Number(hp).toLocaleString('zh-CN')}`,
      )
      .join(' / ');
  }
  return String(value);
}

function rowsFor(
  entry: SeasonEntityComparison,
  from: SeasonDefinition,
  to: SeasonDefinition,
): VisualDiffRow[] {
  const differences = new Map(
    entry.changes.map((change) => [change.field, change]),
  );
  const keys = new Set([
    ...Object.keys(entry.before?.fields ?? {}),
    ...Object.keys(entry.after?.fields ?? {}),
  ]);
  const rows: VisualDiffRow[] = [];
  for (const key of keys) {
    const before = fieldText(key, entry.before, from);
    const after = fieldText(key, entry.after, to);
    if (before === null && after === null) continue;
    const diff = differences.get(key);
    const changed = Boolean(diff || !entry.before || !entry.after);
    let delta: DeltaBadge | undefined;
    if (
      diff &&
      typeof diff.before === 'number' &&
      typeof diff.after === 'number'
    ) {
      const n = diff.after - diff.before;
      delta = {
        text: `${n > 0 ? '+' : '−'}${Math.abs(n)}`,
        tone: n > 0 ? 'up' : 'down',
      };
    }
    rows.push({
      key,
      label: labels[key] ?? key,
      before,
      after,
      changed,
      delta,
      tokenDiff:
        changed && before !== null && after !== null
          ? diffText(before, after)
          : undefined,
    });
  }
  return rows;
}

const categoryOf: Readonly<Record<SeasonEntityGroup, DiffCategory>> = {
  covenants: 'covenants',
  operators: 'operators',
  equipment: 'equipment',
  strategies: 'strategies',
  rules: 'rules',
  leaders: 'rules',
  bounties: 'rules',
};

function visualEntry(
  entry: SeasonEntityComparison,
  from: SeasonDefinition,
  to: SeasonDefinition,
): VisualDiffEntry {
  const {name} = entry;
  const beforeNames = covenantsOf(entry.before, name, from);
  const afterNames = covenantsOf(entry.after, name, to);
  const left = sideCard(
    entry.before,
    name,
    from,
    beforeNames,
    afterNames,
    'removed',
  );
  const right = sideCard(
    entry.after,
    name,
    to,
    afterNames,
    beforeNames,
    'added',
  );
  const kind = (right ?? left)!.iconKind;
  const subKind = kind === 'rule' ? 'global-rule' : kind;
  const rows = rowsFor(entry, from, to);
  const changedCount = rows.filter((row) => row.changed).length;
  const covenants = [...new Set([...afterNames, ...beforeNames])];
  return {
    key: kind === 'rule' ? 'global:rules' : `${kind}:${name}`,
    category: categoryOf[entry.group],
    subKind,
    name,
    status: entry.status === 'changed' ? 'modified' : entry.status,
    covenants,
    tier: right?.tier ?? left?.tier ?? null,
    searchText: [
      name,
      ...covenants,
      ...rows.flatMap((row) => [row.label, row.before, row.after]),
    ].join(' '),
    left,
    right,
    rows,
    changedCount,
    unchangedCount: rows.length - changedCount,
  };
}

const order: Readonly<Record<DiffStatus, number>> = {
  added: 0,
  modified: 1,
  removed: 2,
  unchanged: 3,
};

function summarize(entries: readonly VisualDiffEntry[]): CategoryDiffSummary {
  const counts = {added: 0, modified: 0, removed: 0, unchanged: 0};
  for (const {status} of entries) counts[status]++;
  return {...counts, totalChanges: entries.length - counts.unchanged};
}

/** 将所选两个赛季的核心差异转换为卡片、筛选和图表共用的展示数据，保留左右方向及未变项。 */
export function buildSeasonVisualComparison(
  from: SeasonDefinition,
  to: SeasonDefinition,
): SeasonVisualComparison {
  const entries = diffSeasons(from, to, {details: true}).entries.map((entry) =>
    visualEntry(entry, from, to),
  );
  entries.sort((a, b) => order[a.status] - order[b.status]);
  const totals = summarize(entries);
  const byCategory = (category: DiffCategory) =>
    summarize(entries.filter((entry) => entry.category === category));
  return {
    from,
    to,
    entries,
    totals,
    identical: totals.totalChanges === 0,
    mergedCovenants: {...from.covenants, ...to.covenants},
    byCategory: {
      covenants: byCategory('covenants'),
      strategies: byCategory('strategies'),
      equipment: byCategory('equipment'),
      operators: byCategory('operators'),
      rules: byCategory('rules'),
    },
  };
}
