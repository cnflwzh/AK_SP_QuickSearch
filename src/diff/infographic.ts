import type {
  Covenant,
  EquipmentCombo,
  SeasonDefinition,
} from '../../data/index.ts';
import {round1} from '../lib/ui/dom.ts';
import type {
  DiffCategory,
  SeasonVisualComparison,
  VisualDiffEntry,
} from './comparison.ts';

/** 1. 五大模块变更规模分布条 */
export interface ModuleChartBar {
  readonly id: DiffCategory;
  readonly label: string;
  readonly added: number;
  readonly modified: number;
  readonly removed: number;
  readonly unchanged: number;
  readonly totalChanges: number;
  readonly poolTotal: number;
  /** 占该模块总条目池的变动比例（0–100） */
  readonly changePercent: number;
}

/** 2. 盟约生态轮换节点与层数双曲线对比 */
export interface CovenantRosterNode {
  readonly name: string;
  readonly kind: 'core' | 'addon';
  readonly status: 'added' | 'modified' | 'removed';
  readonly iconSrc: string;
  readonly color: string;
  readonly brief: string;
}

export interface CovenantCurveSeries {
  readonly name: string;
  readonly metricLabel: string;
  readonly unit: string;
  readonly color: string;
  readonly iconSrc: string;
  /** 0..200 层步长 10 的采样点（共 21 个点） */
  readonly layers: readonly number[];
  readonly beforeValues: readonly number[];
  readonly afterValues: readonly number[];
  readonly beforeAt100: number;
  readonly afterAt100: number;
  readonly deltaAt100: number;
  readonly beforeCycleEvery: number | null;
  readonly afterCycleEvery: number | null;
  readonly beforeBreakpoints: readonly number[];
  readonly afterBreakpoints: readonly number[];
}

/** 3. 1–6 阶干员卡池容量与进出分布 */
export interface OperatorTierBar {
  readonly tier: number;
  readonly tierLabel: string;
  readonly beforeCount: number;
  readonly afterCount: number;
  readonly deltaCount: number;
  readonly addedOps: readonly {name: string; avatarSrc: string}[];
  readonly removedOps: readonly {name: string; avatarSrc: string}[];
  readonly shiftedInOps: readonly {
    name: string;
    avatarSrc: string;
    fromTierLabel: string;
  }[];
}

/** 4. 开局策略初始目标生命哑铃图（Dumbbell Chart） */
export interface StrategyHpDeltaItem {
  readonly name: string;
  readonly portraitSrc: string;
  readonly category: string;
  readonly status: 'added' | 'modified' | 'removed';
  readonly beforeHp: number | null;
  readonly afterHp: number | null;
  readonly deltaHp: number;
  readonly skillSummary: string;
}

/** 5. 调度中心升本费用与栏位阶梯对比 + 新增合成线 */
export interface DispatchStepDiff {
  readonly level: number;
  readonly beforeCost: number | null;
  readonly afterCost: number | null;
  readonly deltaCost: number;
  readonly beforeOpSlots: number | null;
  readonly afterOpSlots: number | null;
  readonly beforeEqSlots: number | null;
  readonly afterEqSlots: number | null;
  readonly changed: boolean;
}

export interface ComboRecipeDiff {
  readonly status: 'added' | 'removed';
  readonly first: {name: string; iconSrc: string; tier: number};
  readonly second: {name: string; iconSrc: string; tier: number};
  readonly result: {name: string; iconSrc: string; tier: number};
}

/** 6. Boss 领袖血量涨跌幅与隐秘核心变化 */
export interface LeaderHpDeltaBar {
  readonly name: string;
  readonly iconSrc: string;
  readonly status: 'added' | 'modified' | 'removed';
  readonly beforeStandardHp: number | null;
  readonly afterStandardHp: number | null;
  readonly beforeUltimateHp: number | null;
  readonly afterUltimateHp: number | null;
  /** 两季均有该领袖且原标准生命大于零时，返回标准难度生命的变化百分比。 */
  readonly deltaPercent: number | null;
  readonly addedHiddenCore: boolean;
  readonly note: string;
}

/** 顶层赛制核心 KPI 指标卡 */
export interface MacroRuleKpi {
  readonly label: string;
  readonly before: string;
  readonly after: string;
  readonly deltaText: string;
  readonly changed: boolean;
  readonly tone: 'up' | 'down' | 'neutral';
}

export interface SeasonDiffInfographic {
  readonly headlines: readonly string[];
  readonly macroKpis: readonly MacroRuleKpi[];
  readonly moduleBars: readonly ModuleChartBar[];
  readonly covenantNodes: readonly CovenantRosterNode[];
  readonly covenantCurves: readonly CovenantCurveSeries[];
  readonly operatorTiers: readonly OperatorTierBar[];
  readonly strategyDeltas: readonly StrategyHpDeltaItem[];
  readonly dispatchSteps: readonly DispatchStepDiff[];
  readonly totalUpgradeCostBefore: number;
  readonly totalUpgradeCostAfter: number;
  readonly comboDiffs: readonly ComboRecipeDiff[];
  readonly leaderDeltas: readonly LeaderHpDeltaBar[];
}

const IMG = '/assets/img';
const covIcon = (cov: Covenant): string =>
  `${IMG}/covenants/${cov.icon ?? cov.id}.webp`;

const SAMPLE_LAYERS: readonly number[] = Array.from(
  {length: 21},
  (_, index) => index * 10,
);

function buildCovenantCurves(
  from: SeasonDefinition,
  to: SeasonDefinition,
  nodes: readonly CovenantRosterNode[],
): CovenantCurveSeries[] {
  const series: CovenantCurveSeries[] = [];
  for (const {name, status} of nodes) {
    if (status !== 'modified') continue;
    const nextCov = to.covenants[name];
    const prevCov = from.covenants[name];
    const nextMain = nextCov.scaling[0];
    if (!nextMain) continue;
    const prevMain = prevCov.scaling.find(
      (metric) =>
        metric.label === nextMain.label && metric.unit === nextMain.unit,
    );
    if (!prevMain) continue;

    const beforeValues = SAMPLE_LAYERS.map((L) => round1(prevMain.at(L)));
    const afterValues = SAMPLE_LAYERS.map((L) => round1(nextMain.at(L)));
    const curveChanged = beforeValues.some(
      (val, idx) => Math.abs(val - afterValues[idx]) >= 0.05,
    );
    const prevCycle = prevCov.cycleReward?.every ?? null;
    const nextCycle = nextCov.cycleReward?.every ?? null;
    const prevBps = (prevCov.layerBreakpoints ?? []).map((b) => b.layers);
    const nextBps = (nextCov.layerBreakpoints ?? []).map((b) => b.layers);
    const milestoneChanged =
      prevCycle !== nextCycle || prevBps.join(',') !== nextBps.join(',');

    if (!curveChanged && !milestoneChanged) continue;

    const b100 = round1(prevMain.at(100));
    const a100 = round1(nextMain.at(100));
    series.push({
      name,
      metricLabel: nextMain.label,
      unit: nextMain.unit,
      color: nextCov.color || 'var(--teal)',
      iconSrc: covIcon(nextCov),
      layers: SAMPLE_LAYERS,
      beforeValues,
      afterValues,
      beforeAt100: b100,
      afterAt100: a100,
      deltaAt100: round1(a100 - b100),
      beforeCycleEvery: prevCycle,
      afterCycleEvery: nextCycle,
      beforeBreakpoints: prevBps,
      afterBreakpoints: nextBps,
    });
  }
  return series;
}

function summarizeCovenantBrief(
  status: 'added' | 'modified' | 'removed',
  prev: Covenant | undefined,
  next: Covenant | undefined,
): string {
  if (status === 'added' && next) {
    return `新增${next.kind === 'core' ? '核心' : '附加'}（${next.need}人激活）`;
  }
  if (status === 'removed' && prev) {
    return `移出${prev.kind === 'core' ? '核心' : '附加'}池`;
  }
  if (!prev || !next) return '机制调整';
  const tags: string[] = [];
  if (prev.need !== next.need) tags.push(`${prev.need}→${next.need}人`);
  if (
    prev.scaling[0] &&
    next.scaling[0] &&
    prev.scaling[0].unit === next.scaling[0].unit &&
    prev.scaling[0].label === next.scaling[0].label
  ) {
    const d = round1(next.scaling[0].at(100) - prev.scaling[0].at(100));
    if (d > 0) tags.push(`100层 +${d}${next.scaling[0].unit}`);
    else if (d < 0) tags.push(`100层 ${d}${next.scaling[0].unit}`);
  }
  if (
    prev.cycleReward &&
    next.cycleReward &&
    prev.cycleReward.every !== next.cycleReward.every
  ) {
    tags.push(`周期 ${prev.cycleReward.every}→${next.cycleReward.every}层`);
  }
  if (
    prev.layerBreakpoints?.length &&
    next.layerBreakpoints?.length &&
    prev.layerBreakpoints[0].layers !== next.layerBreakpoints[0].layers
  ) {
    tags.push(
      `门槛 ${prev.layerBreakpoints[0].layers}→${next.layerBreakpoints[0].layers}层`,
    );
  }
  if (prev.restrictedModeAbsent !== next.restrictedModeAbsent) {
    tags.push(next.restrictedModeAbsent ? '受限缺席' : '解禁受限池');
  }
  return tags.length ? tags.join(' · ') : '词条与机制调整';
}

function buildOperatorTiers({
  from,
  to,
  entries,
}: SeasonVisualComparison): OperatorTierBar[] {
  const ops = entries.filter((entry) => entry.subKind === 'operator');
  const tiers = [...new Set([...to.rules.tiers, ...from.rules.tiers])].sort(
    (a, b) => a - b,
  );
  const badge = (entry: VisualDiffEntry) => ({
    name: entry.name,
    avatarSrc: (entry.right ?? entry.left)?.iconSrc ?? '',
  });
  return tiers.map((tier) => {
    const tierLabel =
      to.rules.tierLabels[tier] ?? from.rules.tierLabels[tier] ?? String(tier);
    const beforeOps = ops.filter((op) => op.left?.tier === tier);
    const afterOps = ops.filter((op) => op.right?.tier === tier);
    const addedOps = afterOps.filter((op) => op.status === 'added').map(badge);
    const removedOps = beforeOps
      .filter((op) => op.status === 'removed')
      .map(badge);
    const shiftedInOps = afterOps.flatMap((op) => {
      const prevTier = op.left?.tier;
      if (
        op.status !== 'modified' ||
        prevTier === undefined ||
        prevTier === tier
      )
        return [];
      return [
        {
          ...badge(op),
          fromTierLabel: from.rules.tierLabels[prevTier] ?? String(prevTier),
        },
      ];
    });

    return {
      tier,
      tierLabel,
      beforeCount: beforeOps.length,
      afterCount: afterOps.length,
      deltaCount: afterOps.length - beforeOps.length,
      addedOps,
      removedOps,
      shiftedInOps,
    };
  });
}

function buildComboDiffs(
  from: SeasonDefinition,
  to: SeasonDefinition,
): ComboRecipeDiff[] {
  // 两个合成材料可交换，数据表交换左右顺序时配方仍相同。
  const keyOf = ([first, second, result]: EquipmentCombo) =>
    JSON.stringify([[first, second].sort(), result]);
  const prevSet = new Set(from.equipmentCombos.map(keyOf));
  const nextSet = new Set(to.equipmentCombos.map(keyOf));
  const allEq = new Map([
    ...from.equipment.map((e) => [e.name, e] as const),
    ...to.equipment.map((e) => [e.name, e] as const),
  ]);
  const resolveEq = (name: string) => {
    const eq = allEq.get(name);
    return {
      name,
      iconSrc: eq ? `${IMG}/equipment/${eq.icon}.webp` : '',
      tier: eq?.tier ?? 1,
    };
  };

  const out: ComboRecipeDiff[] = [];
  for (const combo of to.equipmentCombos) {
    if (!prevSet.has(keyOf(combo))) {
      out.push({
        status: 'added',
        first: resolveEq(combo[0]),
        second: resolveEq(combo[1]),
        result: resolveEq(combo[2]),
      });
    }
  }
  for (const combo of from.equipmentCombos) {
    if (!nextSet.has(keyOf(combo))) {
      out.push({
        status: 'removed',
        first: resolveEq(combo[0]),
        second: resolveEq(combo[1]),
        result: resolveEq(combo[2]),
      });
    }
  }
  return out;
}

/**
 * 从任意两个赛季及其 VisualComparison 中提炼供图表直接渲染的可视化聚合数据。
 */
export function buildSeasonDiffInfographic(
  comparison: SeasonVisualComparison,
): SeasonDiffInfographic {
  const {from, to, byCategory} = comparison;

  // 1. 模块分布条
  const moduleMeta: readonly {id: DiffCategory; label: string}[] = [
    {id: 'covenants', label: '盟约体系'},
    {id: 'strategies', label: '开局策略'},
    {id: 'equipment', label: '装备合成'},
    {id: 'operators', label: '固定干员'},
    {id: 'rules', label: 'Boss与规则'},
  ];
  const moduleBars: ModuleChartBar[] = moduleMeta.map(({id, label}) => {
    const stat = byCategory[id];
    const poolTotal = stat.totalChanges + stat.unchanged;
    const changePercent =
      poolTotal > 0 ? Math.round((stat.totalChanges / poolTotal) * 100) : 0;
    return {
      id,
      label,
      ...stat,
      poolTotal,
      changePercent,
    };
  });

  // 2. 盟约轮换图谱 + 层数曲线
  const covenantNodes: CovenantRosterNode[] = [];
  for (const entry of comparison.entries) {
    if (entry.category !== 'covenants' || entry.status === 'unchanged') {
      continue;
    }
    const prev = Object.hasOwn(from.covenants, entry.name)
      ? from.covenants[entry.name]
      : undefined;
    const next = Object.hasOwn(to.covenants, entry.name)
      ? to.covenants[entry.name]
      : undefined;
    const refCov = next ?? prev;
    if (!refCov) continue;
    covenantNodes.push({
      name: entry.name,
      kind: refCov.kind,
      status: entry.status,
      iconSrc: covIcon(refCov),
      color: refCov.color || 'var(--teal)',
      brief: summarizeCovenantBrief(entry.status, prev, next),
    });
  }
  const covenantCurves = buildCovenantCurves(from, to, covenantNodes);

  // 3. 干员等阶分布
  const operatorTiers = buildOperatorTiers(comparison);

  // 4. 策略生命哑铃图
  const prevStMap = new Map(from.strategies.map((s) => [s.name, s]));
  const nextStMap = new Map(to.strategies.map((s) => [s.name, s]));
  const strategyDeltas: StrategyHpDeltaItem[] = [];
  for (const entry of comparison.entries) {
    if (entry.category !== 'strategies' || entry.status === 'unchanged') {
      continue;
    }
    const prev = prevStMap.get(entry.name);
    const next = nextStMap.get(entry.name);
    const refSt = next ?? prev;
    if (!refSt) continue;
    strategyDeltas.push({
      name: entry.name,
      portraitSrc: `${IMG}/strategies/${refSt.portrait}.webp`,
      category: refSt.category,
      status: entry.status,
      beforeHp: prev?.hp ?? null,
      afterHp: next?.hp ?? null,
      deltaHp:
        prev && next ? next.hp - prev.hp : next ? next.hp : -(prev?.hp ?? 0),
      skillSummary: `【${refSt.skill}】${refSt.effect}`,
    });
  }

  // 5. 调度中心升本阶梯 & 合成配方
  const oldLevels = new Map(
    from.rules.dispatchLevels.map((step) => [step.level, step]),
  );
  const newLevels = new Map(
    to.rules.dispatchLevels.map((step) => [step.level, step]),
  );
  const levels = [...new Set([...oldLevels.keys(), ...newLevels.keys()])].sort(
    (a, b) => a - b,
  );
  let totalUpgradeCostBefore = 0;
  let totalUpgradeCostAfter = 0;
  const dispatchSteps: DispatchStepDiff[] = [];
  for (const level of levels) {
    const b = oldLevels.get(level);
    const a = newLevels.get(level);
    totalUpgradeCostBefore += b?.upgradeCost ?? 0;
    totalUpgradeCostAfter += a?.upgradeCost ?? 0;
    const deltaCost = (a?.upgradeCost ?? 0) - (b?.upgradeCost ?? 0);
    const changed =
      b?.upgradeCost !== a?.upgradeCost ||
      b?.operatorSlots !== a?.operatorSlots ||
      b?.equipmentSlots !== a?.equipmentSlots;
    dispatchSteps.push({
      level,
      beforeCost: b?.upgradeCost ?? null,
      afterCost: a?.upgradeCost ?? null,
      deltaCost,
      beforeOpSlots: b?.operatorSlots ?? null,
      afterOpSlots: a?.operatorSlots ?? null,
      beforeEqSlots: b?.equipmentSlots ?? null,
      afterEqSlots: a?.equipmentSlots ?? null,
      changed,
    });
  }
  const comboDiffs = buildComboDiffs(from, to);

  // 6. Boss 领袖血量与隐秘核心变化
  const prevLdMap = new Map(from.leaders.map((l) => [l.name, l]));
  const nextLdMap = new Map(to.leaders.map((l) => [l.name, l]));
  const leaderDeltas: LeaderHpDeltaBar[] = [];
  for (const entry of comparison.entries) {
    if (entry.subKind !== 'leader' || entry.status === 'unchanged') continue;
    const prev = prevLdMap.get(entry.name);
    const next = nextLdMap.get(entry.name);
    const refLd = next ?? prev;
    if (!refLd) continue;
    const deltaPercent =
      prev && next && prev.hp[0] > 0
        ? round1(((next.hp[0] - prev.hp[0]) / prev.hp[0]) * 100)
        : null;
    const addedHiddenCore = Boolean(
      prev && !prev.hiddenCore && next?.hiddenCore,
    );
    const notes: string[] = [];
    if (addedHiddenCore) notes.push('新增隐秘核心形态');
    if (prev && next && prev.profile.defense !== next.profile.defense) {
      notes.push(next.profile.defense);
    }
    leaderDeltas.push({
      name: entry.name,
      iconSrc: `${IMG}/leaders/${refLd.id}.webp`,
      status: entry.status,
      beforeStandardHp: prev?.hp[0] ?? null,
      afterStandardHp: next?.hp[0] ?? null,
      beforeUltimateHp: prev?.hp[3] ?? null,
      afterUltimateHp: next?.hp[3] ?? null,
      deltaPercent,
      addedHiddenCore,
      note: notes.join(' · ') || refLd.profile.summary,
    });
  }

  // 7. 顶层赛制核心 KPI 指标卡
  const costDelta = totalUpgradeCostAfter - totalUpgradeCostBefore;
  const opPoolDelta = to.operators.length - from.operators.length;
  const borrowDelta = to.rules.borrowLimit - from.rules.borrowLimit;
  const deployDelta =
    to.meta.baseDeploymentLimit - from.meta.baseDeploymentLimit;

  const macroKpis: MacroRuleKpi[] = [
    {
      label: '固定干员池规模',
      before: `${from.operators.length} 名`,
      after: `${to.operators.length} 名`,
      deltaText:
        opPoolDelta === 0
          ? '容量不变'
          : `${opPoolDelta > 0 ? '+' : ''}${opPoolDelta} 名`,
      changed: opPoolDelta !== 0,
      tone: opPoolDelta > 0 ? 'up' : opPoolDelta < 0 ? 'down' : 'neutral',
    },
    {
      label: '升至满级累计基础费',
      before: `${totalUpgradeCostBefore} 资金`,
      after: `${totalUpgradeCostAfter} 资金`,
      deltaText:
        costDelta === 0
          ? '费用不变'
          : `${costDelta > 0 ? '+' : ''}${costDelta} 资金`,
      changed: costDelta !== 0,
      tone: costDelta < 0 ? 'up' : costDelta > 0 ? 'down' : 'neutral',
    },
    {
      label: '场上基础部署上限',
      before: `${from.meta.baseDeploymentLimit} 人`,
      after: `${to.meta.baseDeploymentLimit} 人`,
      deltaText:
        deployDelta === 0
          ? `${to.meta.roundLimits.standard} 回合制`
          : `${deployDelta > 0 ? '+' : ''}${deployDelta} 部署位`,
      changed:
        deployDelta !== 0 ||
        from.meta.roundLimits.standard !== to.meta.roundLimits.standard,
      tone: deployDelta > 0 ? 'up' : 'neutral',
    },
    {
      label: '备战助战借用上限',
      before: `${from.rules.borrowLimit} 名`,
      after: `${to.rules.borrowLimit} 名`,
      deltaText:
        borrowDelta === 0
          ? '上限不变'
          : `${borrowDelta > 0 ? '+' : ''}${borrowDelta} 名`,
      changed: borrowDelta !== 0,
      tone: borrowDelta > 0 ? 'up' : borrowDelta < 0 ? 'down' : 'neutral',
    },
  ];

  // 8. 自动提炼 3–4 条人话速读结论（让玩家一眼看懂本次相邻赛季改了什么）
  const headlines: string[] = [];
  const addedCovs = covenantNodes
    .filter((c) => c.status === 'added')
    .map((c) => `【${c.name}】`);
  const removedCovs = covenantNodes
    .filter((c) => c.status === 'removed')
    .map((c) => `【${c.name}】`);
  if (addedCovs.length || removedCovs.length) {
    const parts: string[] = [];
    if (addedCovs.length) parts.push(`新入池盟约 ${addedCovs.join('、')}`);
    if (removedCovs.length) parts.push(`轮换移出 ${removedCovs.join('、')}`);
    if (byCategory.covenants.modified > 0) {
      parts.push(`调整 ${byCategory.covenants.modified} 个既有盟约`);
    }
    headlines.push(`阵营轮换：${parts.join('，')}。`);
  } else if (byCategory.covenants.modified > 0) {
    headlines.push(
      `盟约调整：共 ${byCategory.covenants.modified} 个既有盟约发生变化。`,
    );
  }

  if (byCategory.operators.totalChanges > 0) {
    const highTierAdded = operatorTiers
      .filter((t) => t.tier >= 4)
      .reduce((sum, t) => sum + t.addedOps.length, 0);
    headlines.push(
      `卡池迭代：新增 ${byCategory.operators.added} 名干员${highTierAdded > 0 ? `（含 ${highTierAdded} 名 Ⅳ–Ⅵ 阶高费主力）` : ''}、调整 ${byCategory.operators.modified} 名、移出 ${byCategory.operators.removed} 名。`,
    );
  }

  if (
    costDelta !== 0 ||
    comboDiffs.length > 0 ||
    byCategory.equipment.totalChanges > 0 ||
    byCategory.strategies.totalChanges > 0
  ) {
    const econParts: string[] = [];
    if (costDelta !== 0) {
      econParts.push(
        `满本累计升级费 ${totalUpgradeCostBefore}→${totalUpgradeCostAfter}（${costDelta > 0 ? '+' : ''}${costDelta}）`,
      );
    }
    if (comboDiffs.length > 0) {
      const addedCombos = comboDiffs
        .filter((c) => c.status === 'added')
        .map((c) => c.result.name);
      if (addedCombos.length) {
        econParts.push(`新增合成配方「${addedCombos.join('」「')}」`);
      }
    }
    if (byCategory.equipment.totalChanges > 0) {
      econParts.push(`装备变动 ${byCategory.equipment.totalChanges} 项`);
    }
    if (byCategory.strategies.totalChanges > 0) {
      econParts.push(`开局策略变动 ${byCategory.strategies.totalChanges} 项`);
    }
    if (econParts.length) {
      headlines.push(`运营与装备：${econParts.join('；')}。`);
    }
  }

  if (leaderDeltas.length > 0 || deployDelta !== 0) {
    const bossParts: string[] = [];
    if (deployDelta !== 0) {
      bossParts.push(
        `基础部署上限 ${from.meta.baseDeploymentLimit}→${to.meta.baseDeploymentLimit} 人`,
      );
    }
    if (leaderDeltas.length > 0) {
      const leaders = leaderDeltas.map((leader) => {
        if (leader.status === 'added') return `${leader.name}入池`;
        if (leader.status === 'removed') return `${leader.name}移出`;
        if (leader.addedHiddenCore) return `${leader.name}新增隐秘核心`;
        const pct = leader.deltaPercent;
        return pct
          ? `${leader.name}标准生命 ${pct > 0 ? '+' : ''}${pct}%`
          : `${leader.name}调整`;
      });
      bossParts.push(leaders.join('、'));
    }
    headlines.push(`关底环境：${bossParts.join('；')}。`);
  }

  return {
    headlines,
    macroKpis,
    moduleBars,
    covenantNodes,
    covenantCurves,
    operatorTiers,
    strategyDeltas,
    dispatchSteps,
    totalUpgradeCostBefore,
    totalUpgradeCostAfter,
    comboDiffs,
    leaderDeltas,
  };
}
