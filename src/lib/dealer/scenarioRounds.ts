import {
  ALL_COVENANTS,
  buildByName,
  CORE_COVENANTS,
  COVENANTS,
  OPERATORS,
  operatorEliteCopies,
  operatorPrice,
  rosterOf,
  STRATEGIES,
  TIER_LABELS,
  type Operator,
} from '../../../data/index.ts';
import {covenantStats} from '../plans/covenants.ts';
import {
  advisorDeploymentLimit,
  deployedLineup,
  effectiveBans,
  newAdvisorRun,
  recommendRecruits,
  reserveLineup,
  type AdvisorRun,
  type RecruitAdvice,
} from '../recommendation/live/runAdvisor.ts';
import {pickLine, SCENARIO_DEAL_LINES} from './copy.ts';
import {
  DEALER_SHOP_SIZE,
  type CardRevealTag,
  type DealerCard,
  type DealerRound,
  type DealerScenarioArchetype,
  type DealerScenarioContext,
  type DealerScenarioCovenantHint,
  type DealerScenarioUnit,
} from './types.ts';
import {
  extractTriggerHint,
  shuffleWith,
  splitTraitSegments,
} from './utils.ts';

export const SCENARIO_MIN_SCORE_MARGIN = 30;
export const SCENARIO_ARCHETYPES: readonly DealerScenarioArchetype[] = [
  'covenant_step',
  'elite_promote',
  'budget_synergy',
];

const ARCHETYPE_LABELS: Readonly<Record<DealerScenarioArchetype, string>> = {
  covenant_step: '关键凑盟约',
  elite_promote: '二缺一晋升',
  budget_synergy: '资金与策略博弈',
};

const SHOP_OPERATORS: readonly Operator[] = OPERATORS.filter(
  (op) => op.stars > 0,
);

const ELIGIBLE_CORE_COVENANTS: readonly string[] = CORE_COVENANTS.filter(
  (cov) => {
    const meta = COVENANTS[cov];
    if (!meta || meta.need < 2) return false;
    return rosterOf(cov).filter((op) => op.stars > 0).length >= 5;
  },
);

const RESERVE_FLOOR_STRATEGIES = STRATEGIES.filter(
  (st) =>
    st.advisor?.reserveFundsFloor &&
    st.advisor.reserveFundsFloor.minFunds >= 4,
);

const GENERAL_PASSIVE_STRATEGIES = STRATEGIES.filter(
  (st) => !CORE_COVENANTS.includes(st.category) && !st.advisor,
);

const PRICE_DISCOUNT_COVENANTS = ALL_COVENANTS.filter((cov) =>
  Boolean(COVENANTS[cov]?.mechanics?.priceDiscounts),
);

function zeroDiscountLayers(): Record<string, number> {
  const layers: Record<string, number> = {};
  for (const cov of PRICE_DISCOUNT_COVENANTS) {
    layers[cov] = 0;
  }
  return layers;
}

function pickOne<T>(items: readonly T[], rng: () => number): T | undefined {
  if (!items.length) return undefined;
  return items[Math.floor(rng() * items.length)];
}

function pickDistinct<T extends {readonly name: string}>(
  pool: readonly T[],
  count: number,
  rng: () => number,
  excluded: ReadonlySet<string>,
): T[] {
  const candidates = pool.filter((item) => !excluded.has(item.name));
  return shuffleWith(candidates, rng).slice(0, count);
}

function pickStrategyForCovenant(
  covenant: string,
  rng: () => number,
): string {
  const build = buildByName(covenant);
  const preferred = (build?.strategies ?? [])
    .map((name) => STRATEGIES.find((st) => st.name === name))
    .filter(
      (st): st is (typeof STRATEGIES)[number] =>
        Boolean(st && !st.advisor?.reserveFundsFloor),
    );
  const chosen =
    pickOne(preferred, rng) ??
    pickOne(GENERAL_PASSIVE_STRATEGIES, rng) ??
    STRATEGIES[0];
  return chosen?.name ?? '';
}

function createBaseRun(params: {
  level: number;
  round: number;
  funds: number;
  strategy: string;
  goalCovenant: string;
  goalTarget: 3 | 6;
}): AdvisorRun {
  const run = newAdvisorRun();
  run.mode = 'full';
  run.format = 'standard';
  run.level = params.level;
  run.round = params.round;
  run.funds = params.funds;
  run.strategy = params.strategy;
  run.mainCovenant = params.goalCovenant;
  run.mainTarget = params.goalTarget;
  run.layers = zeroDiscountLayers();
  return run;
}

interface ScenarioDraft {
  readonly archetype: DealerScenarioArchetype;
  readonly run: AdvisorRun;
  readonly goalCovenant: string;
  readonly goalTarget: 3 | 6;
  readonly summary: string;
  readonly bonus: string;
}

function draftCovenantStep(
  covenant: string,
  rng: () => number,
): ScenarioDraft | null {
  const meta = COVENANTS[covenant];
  if (!meta) return null;
  const maxGoal = meta.need >= 3 ? 6 : 3;
  const useSix = maxGoal === 6 && rng() < 0.45;
  const goalTarget = useSix ? 6 : 3;
  const level = useSix ? (rng() < 0.5 ? 5 : 6) : rng() < 0.5 ? 3 : 4;
  const round = useSix ? level + 2 : level + 1;

  const corePool = SHOP_OPERATORS.filter(
    (op) => op.covenants.includes(covenant) && op.tier <= level,
  );
  if (corePool.length < goalTarget) return null;

  const shuffledCore = shuffleWith(corePool, rng);
  const deployedCore = shuffledCore.slice(0, goalTarget - 1);
  const winner = shuffledCore[goalTarget - 1];
  const ownedNames = new Set(deployedCore.map((op) => op.name));

  // Add 1-2 off-covenant transition units while keeping at least 1 open deployment slot.
  const limit = advisorDeploymentLimit({personnelDocumentUsed: false});
  const fillerCount = Math.min(
    useSix ? 1 : 2,
    Math.max(0, limit - deployedCore.length - 1),
  );
  const fillerPool = SHOP_OPERATORS.filter(
    (op) =>
      !op.covenants.includes(covenant) &&
      op.tier <= Math.min(3, level) &&
      !ownedNames.has(op.name),
  );
  const fillers = pickDistinct(fillerPool, fillerCount, rng, ownedNames);
  for (const op of fillers) ownedNames.add(op.name);

  const excludedShop = new Set([...ownedNames, winner.name]);
  const decoyPool = SHOP_OPERATORS.filter(
    (op) =>
      !op.covenants.includes(covenant) &&
      op.tier <= level &&
      !excludedShop.has(op.name),
  );
  const decoys = pickDistinct(
    decoyPool,
    DEALER_SHOP_SIZE - 1,
    rng,
    excludedShop,
  );
  if (decoys.length < DEALER_SHOP_SIZE - 1) return null;

  const funds = Math.max(6, operatorPrice(winner) + 2);
  const strategy = pickStrategyForCovenant(covenant, rng);
  const run = createBaseRun({
    level,
    round,
    funds,
    strategy,
    goalCovenant: covenant,
    goalTarget,
  });
  run.operators = [...deployedCore, ...fillers].map((op) => ({
    name: op.name,
    elite: false,
    deployed: true,
    copies: 1,
  }));
  run.shop = [winner.name, ...decoys.map((op) => op.name)];

  return {
    archetype: 'covenant_step',
    run,
    goalCovenant: covenant,
    goalTarget,
    summary: `当前场上【${covenant}】处于 ${goalTarget - 1}/${goalTarget} 临界点且资金充裕，选出收益最高的一抓！`,
    bonus: `优先观察哪些候选能直接点亮或升档【${covenant}】主轴，同时避开对当前编队无贡献的散件`,
  };
}

function draftElitePromote(
  covenant: string,
  rng: () => number,
): ScenarioDraft | null {
  const level = pickOne([4, 5, 6] as const, rng) ?? 5;
  const round = level + 2;
  const corePool = SHOP_OPERATORS.filter(
    (op) => op.covenants.includes(covenant) && op.tier <= level,
  );
  const promotable = corePool.filter((op) => operatorEliteCopies(op.name) >= 2);
  if (promotable.length < 1 || corePool.length < 4) return null;

  const shuffled = shuffleWith(promotable, rng);
  const target = shuffled[0];
  const needCopies = operatorEliteCopies(target.name);
  const others = shuffleWith(
    corePool.filter((op) => op.name !== target.name),
    rng,
  ).slice(0, 3);
  const deployedCore = [target, ...others];
  const ownedNames = new Set(deployedCore.map((op) => op.name));

  // Fill with 1 non-covenant unit so deployed = 5, leaving space but emphasizing elite promotion.
  const filler = pickDistinct(
    SHOP_OPERATORS.filter(
      (op) => !op.covenants.includes(covenant) && op.tier <= 3,
    ),
    1,
    rng,
    ownedNames,
  );
  for (const op of filler) ownedNames.add(op.name);

  // Shop: target (completes elite) + 4 decoys (1 non-promoting 1-copy owned or unowned off-covenant).
  const decoyPool = SHOP_OPERATORS.filter(
    (op) =>
      !op.covenants.includes(covenant) &&
      op.tier <= level &&
      !ownedNames.has(op.name),
  );
  const decoys = pickDistinct(
    decoyPool,
    DEALER_SHOP_SIZE - 1,
    rng,
    ownedNames,
  );
  if (decoys.length < DEALER_SHOP_SIZE - 1) return null;

  const funds = Math.max(6, operatorPrice(target) + 2);
  const strategy = pickStrategyForCovenant(covenant, rng);
  const run = createBaseRun({
    level,
    round,
    funds,
    strategy,
    goalCovenant: covenant,
    goalTarget: 6,
  });
  run.operators = [...deployedCore, ...filler].map((op) => ({
    name: op.name,
    elite: false,
    deployed: true,
    copies: op.name === target.name ? Math.max(1, needCopies - 1) : 1,
  }));
  run.shop = [target.name, ...decoys.map((op) => op.name)];

  return {
    archetype: 'elite_promote',
    run,
    goalCovenant: covenant,
    goalTarget: 6,
    summary: `留意场上标注「×${Math.max(1, needCopies - 1)}」的听牌干员！从 5 张商店候选中挑出当前最赚的抓牌。`,
    bonus: '在战力与节奏期，合成精锐除自身大幅强化外还会赠送高一阶免费三选一奖励',
  };
}

function draftBudgetSynergy(
  covenant: string,
  rng: () => number,
): ScenarioDraft | null {
  const useReserveFloor =
    RESERVE_FLOOR_STRATEGIES.length > 0 && rng() < 0.45;
  const level = pickOne([5, 6] as const, rng) ?? 5;
  const round = level + 2;
  const corePool = SHOP_OPERATORS.filter(
    (op) => op.covenants.includes(covenant) && op.tier <= level,
  );

  const cheapCore = corePool.filter((op) => operatorPrice(op) <= 3);
  const priceyCore = corePool.filter((op) => operatorPrice(op) >= 5);
  if (cheapCore.length < 1 || priceyCore.length < 1 || corePool.length < 4) {
    return null;
  }

  const winner = pickOne(cheapCore, rng);
  if (!winner) return null;
  const winnerPrice = operatorPrice(winner);

  const trapHighTier = shuffleWith(
    priceyCore.filter((op) => op.name !== winner.name),
    rng,
  ).slice(0, 2);
  if (!trapHighTier.length) return null;

  const shopCoreNames = new Set([
    winner.name,
    ...trapHighTier.map((op) => op.name),
  ]);
  const deployedCore = shuffleWith(
    corePool.filter((op) => !shopCoreNames.has(op.name)),
    rng,
  ).slice(0, 2);
  if (deployedCore.length < 2) return null;

  const ownedNames = new Set(deployedCore.map((op) => op.name));
  const fillers = pickDistinct(
    SHOP_OPERATORS.filter(
      (op) =>
        !op.covenants.includes(covenant) &&
        op.tier <= 3 &&
        !shopCoreNames.has(op.name),
    ),
    2,
    rng,
    ownedNames,
  );
  for (const op of fillers) ownedNames.add(op.name);

  const excludedShop = new Set([...ownedNames, ...shopCoreNames]);
  const cheapDecoyCount = DEALER_SHOP_SIZE - 1 - trapHighTier.length;
  const cheapDecoys = pickDistinct(
    SHOP_OPERATORS.filter(
      (op) =>
        !op.covenants.includes(covenant) &&
        op.tier <= level &&
        operatorPrice(op) <= winnerPrice + 1,
    ),
    cheapDecoyCount,
    rng,
    excludedShop,
  );
  if (cheapDecoys.length < cheapDecoyCount) return null;

  if (useReserveFloor) {
    const floorStrategy = pickOne(RESERVE_FLOOR_STRATEGIES, rng);
    const floor = floorStrategy?.advisor?.reserveFundsFloor;
    if (floorStrategy && floor) {
      const funds = floor.minFunds + winnerPrice;
      // Ensure pricey trap cards drop funds strictly below reserve floor.
      const validTraps = trapHighTier.filter(
        (op) => funds - operatorPrice(op) < floor.minFunds,
      );
      if (validTraps.length >= 1) {
        const extraDecoys = pickDistinct(
          SHOP_OPERATORS.filter(
            (op) => !op.covenants.includes(covenant) && op.tier <= level,
          ),
          DEALER_SHOP_SIZE - 1 - validTraps.length,
          rng,
          new Set([...ownedNames, winner.name, ...validTraps.map((o) => o.name)]),
        );
        if (extraDecoys.length === DEALER_SHOP_SIZE - 1 - validTraps.length) {
          const run = createBaseRun({
            level,
            round,
            funds,
            strategy: floorStrategy.name,
            goalCovenant: covenant,
            goalTarget: 3,
          });
          run.operators = [...deployedCore, ...fillers].map((op) => ({
            name: op.name,
            elite: false,
            deployed: true,
            copies: 1,
          }));
          run.shop = [
            winner.name,
            ...validTraps.map((op) => op.name),
            ...extraDecoys.map((op) => op.name),
          ];
          return {
            archetype: 'budget_synergy',
            run,
            goalCovenant: covenant,
            goalTarget: 3,
            summary: `当前携带策略「${floorStrategy.name}」且手头有 ${funds} 资金，兼顾留资门槛与【${covenant}】成型选最优抓牌！`,
            bonus: `部分策略要求休整结束保留不低于 ${floor.minFunds} 资金；贪买高费卡会亏掉策略红利`,
          };
        }
      }
    }
  }

  // Budget tight mode: funds exactly allow winner (<= 3 or 4) while high-tier tempting core cards are unaffordable.
  const funds = winnerPrice;
  const strategy = pickStrategyForCovenant(covenant, rng);
  const run = createBaseRun({
    level,
    round,
    funds,
    strategy,
    goalCovenant: covenant,
    goalTarget: 3,
  });
  run.operators = [...deployedCore, ...fillers].map((op) => ({
    name: op.name,
    elite: false,
    deployed: true,
    copies: 1,
  }));
  run.shop = [
    winner.name,
    ...trapHighTier.map((op) => op.name),
    ...cheapDecoys.map((op) => op.name),
  ];

  return {
    archetype: 'budget_synergy',
    run,
    goalCovenant: covenant,
    goalTarget: 3,
    summary: `资金见底只剩 ${funds} 资！别被高阶核心晃花眼，选出当前买得起且最赚的一抓！`,
    bonus: '商店里 5~6 阶高费卡虽强，但资金不足无法买下；算清手头余额优先稳稳点亮主轴',
  };
}

function isClearWinner(advice: readonly RecruitAdvice[]): boolean {
  if (advice.length !== DEALER_SHOP_SIZE) return false;
  const [first, second] = advice;
  if (first.affordable !== true) return false;
  if (first.score <= 0) return false;
  if (second.affordable === false) return true;
  return first.score - second.score >= SCENARIO_MIN_SCORE_MARGIN;
}

function condenseLines(lines: readonly string[], limit: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of lines) {
    const clean = raw.trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
    if (out.length >= limit) break;
  }
  return out;
}

function buildScenarioContext(
  draft: ScenarioDraft,
): DealerScenarioContext {
  const {run, archetype, goalCovenant, goalTarget} = draft;
  const lineup = deployedLineup(run);
  const reserve = reserveLineup(run);
  const stats = covenantStats(lineup, run.layers, reserve, effectiveBans(run));

  const covenantHints: DealerScenarioCovenantHint[] = stats
    .filter(
      (item) =>
        item.name === goalCovenant ||
        item.active ||
        item.count >= Math.max(1, item.need - 1),
    )
    .sort(
      (a, b) =>
        Number(b.name === goalCovenant) - Number(a.name === goalCovenant) ||
        Number(b.active) - Number(a.active) ||
        b.count - a.count,
    )
    .slice(0, 4)
    .map((item) => ({
      name: item.name,
      count: item.count,
      need: item.name === goalCovenant ? goalTarget : item.need,
      active: item.active,
    }));

  const toUnit = (entry: AdvisorRun['operators'][number]): DealerScenarioUnit => {
    const op = OPERATORS.find((item) => item.name === entry.name);
    return {
      name: entry.name,
      tier: op?.tier ?? 1,
      copies: entry.copies,
      elite: entry.elite,
      deployed: entry.deployed,
    };
  };

  return {
    archetype,
    archetypeLabel: ARCHETYPE_LABELS[archetype],
    level: run.level,
    round: run.round ?? 5,
    funds: run.funds ?? 0,
    strategy: run.strategy,
    goalCovenant,
    goalTarget,
    deployed: run.operators.filter((u) => u.deployed).map(toUnit),
    reserve: run.operators.filter((u) => !u.deployed).map(toUnit),
    covenantHints,
  };
}

function createScenarioCard(
  advice: RecruitAdvice,
  rank: number,
  draft: ScenarioDraft,
): DealerCard {
  const op = advice.operator;
  const price = advice.estimatedPrice ?? operatorPrice(op);
  const owned = draft.run.operators.find((u) => u.name === op.name);
  const isBestPick = rank === 1;
  const reasons = condenseLines(advice.reasons, 2);
  const losses = condenseLines(advice.losses, 2);

  const revealTags: CardRevealTag[] = [
    {
      label: isBestPick ? '#1 最优' : `#${rank}`,
      match: isBestPick,
      mismatch: !isBestPick && advice.affordable === false,
    },
    {
      label: advice.replace ? `换下${advice.replace}` : advice.label,
      match: isBestPick,
      mismatch: advice.affordable === false,
    },
    ...op.covenants.map((cov) => ({
      label: cov,
      covenant: cov,
      match: cov === draft.goalCovenant,
    })),
  ];

  const ownedTag = owned
    ? `场上已有 ×${owned.copies}`
    : `未持有 · ${op.covenants.join('/')}`;
  const fullReasonText = [...losses, ...reasons].join('；') || op.trait;

  return {
    cardKind: 'operator',
    operator: op,
    detailKind: 'op',
    title: op.name,
    tier: op.tier,
    cornerBadge: TIER_LABELS[op.tier],
    isImpostor: false,
    isBestPick,
    price,
    advisorRank: rank,
    advisorLabel: advice.label,
    advisorScore: Math.round(advice.score),
    advisorReasons: reasons,
    advisorLosses: losses,
    advisorReplace: advice.replace || undefined,
    triggerHint: ownedTag,
    secondaryClue: `${op.type} · ${extractTriggerHint(op.trait)}`,
    traitSegments: splitTraitSegments(fullReasonText),
    revealTags,
    status: 'unseen',
  };
}

function materializeScenarioRound(
  draft: ScenarioDraft,
  advice: readonly RecruitAdvice[],
  roundNumber: number,
  orderRng: () => number,
  introSeed: number,
): DealerRound {
  const canonical = advice.map((item, idx) =>
    createScenarioCard(item, idx + 1, draft),
  );
  const cards = shuffleWith(canonical, orderRng);
  const context = buildScenarioContext(draft);

  return {
    roundNumber,
    kind: 'scenario',
    selectionMode: 'best_pick',
    targetCovenant: draft.goalCovenant,
    targetLabel: `${context.archetypeLabel} · 【${draft.goalCovenant}】`,
    missionTitle: '实战抓牌',
    missionSummary: draft.summary,
    missionBonus: draft.bonus,
    scenarioContext: context,
    impostorTotal: 1,
    goodTotal: DEALER_SHOP_SIZE - 1,
    introLine: pickLine(SCENARIO_DEAL_LINES, introSeed, draft.goalCovenant),
    cards,
    hintRevealed: false,
    usedHint: false,
  };
}

function draftByArchetype(
  archetype: DealerScenarioArchetype,
  covenant: string,
  rng: () => number,
): ScenarioDraft | null {
  if (archetype === 'elite_promote') {
    return draftElitePromote(covenant, rng);
  }
  if (archetype === 'budget_synergy') {
    return draftBudgetSynergy(covenant, rng);
  }
  return draftCovenantStep(covenant, rng);
}

/**
 * Generates a high-margin practical recruit scenario validated by the live
 * RunAdvisor (`recommendRecruits`) engine with zero hardcoded operator names.
 */
export function buildScenarioRound(options: {
  roundNumber: number;
  rng: () => number;
  orderRng?: () => number;
  introSeed?: number;
  preferredArchetype?: DealerScenarioArchetype;
  avoidArchetype?: DealerScenarioArchetype;
}): DealerRound {
  const {roundNumber, rng, preferredArchetype, avoidArchetype} = options;
  const orderRng = options.orderRng ?? rng;
  const introSeed =
    options.introSeed ?? roundNumber + Math.floor(orderRng() * 97);

  const archetypePool = preferredArchetype
    ? [preferredArchetype]
    : SCENARIO_ARCHETYPES.filter((a) => a !== avoidArchetype);
  const activePool = archetypePool.length ? archetypePool : SCENARIO_ARCHETYPES;

  let bestFallback: {
    draft: ScenarioDraft;
    advice: RecruitAdvice[];
    gap: number;
  } | null = null;

  for (let attempt = 0; attempt < 36; attempt++) {
    const archetype =
      attempt < 24
        ? (pickOne(activePool, rng) ?? 'covenant_step')
        : (SCENARIO_ARCHETYPES[attempt % SCENARIO_ARCHETYPES.length] ??
          'covenant_step');
    const covenant =
      pickOne(ELIGIBLE_CORE_COVENANTS, rng) ?? ELIGIBLE_CORE_COVENANTS[0];
    if (!covenant) break;

    const draft = draftByArchetype(archetype, covenant, rng);
    if (!draft) continue;

    const advice = recommendRecruits(draft.run, DEALER_SHOP_SIZE);
    if (isClearWinner(advice)) {
      return materializeScenarioRound(
        draft,
        advice,
        roundNumber,
        orderRng,
        introSeed,
      );
    }

    if (
      advice.length === DEALER_SHOP_SIZE &&
      advice[0].affordable === true &&
      advice[0].score > 0
    ) {
      const gap =
        advice[1].affordable === false
          ? 999
          : advice[0].score - advice[1].score;
      if (!bestFallback || gap > bestFallback.gap) {
        bestFallback = {draft, advice, gap};
      }
    }
  }

  // Deterministic scan fallback across all eligible core covenants so we never fail.
  if (!bestFallback) {
    for (const covenant of ELIGIBLE_CORE_COVENANTS) {
      for (const archetype of SCENARIO_ARCHETYPES) {
        const draft = draftByArchetype(archetype, covenant, rng);
        if (!draft) continue;
        const advice = recommendRecruits(draft.run, DEALER_SHOP_SIZE);
        if (advice.length === DEALER_SHOP_SIZE && advice[0].affordable === true) {
          bestFallback = {
            draft,
            advice,
            gap: advice[0].score - advice[1].score,
          };
          break;
        }
      }
      if (bestFallback) break;
    }
  }

  if (!bestFallback) {
    throw new Error('Unable to build a valid scenario round from season data.');
  }

  return materializeScenarioRound(
    bestFallback.draft,
    bestFallback.advice,
    roundNumber,
    orderRng,
    introSeed,
  );
}
