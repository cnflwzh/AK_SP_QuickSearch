import {
  BOUNTIES,
  COMPANION_EQUIP_NAME,
  CORE_COVENANTS,
  EQUIP,
  EQUIPMENT,
  OPERATORS,
  rosterOf,
  STRATEGIES,
  TIER_LABELS,
} from '../../../data/index.ts';
import type {
  Bounty,
  Equipment,
  Operator,
  Strategy,
} from '../../../data/index.ts';
import {
  BOUNTY_DEAL_LINES,
  DEAL_LINES,
  EQUIP_DEAL_LINES,
  pickLine,
  STRATEGY_DEAL_LINES,
  TIER_DEAL_LINES,
  TRANSMUTE_DEAL_LINES,
  TRIGGER_DEAL_LINES,
} from './copy.ts';
import {
  BOUNTY_THEME_META,
  BOUNTY_THEMES,
  COMBO_PART_TARGET,
  CONSUMABLE_DECOY_NAMES,
  DAILY_CORE_POOL,
  EQUIP_THEME_META,
  EQUIP_THEMES,
  SELECTABLE_COVENANTS,
  STRATEGY_THEME_META,
  STRATEGY_THEMES,
  TIER_CHECK_META,
  TIER_CHECK_THEMES,
  TRANSMUTE_ADDON_POOL,
  TRANSMUTE_COVENANTS,
  TRANSMUTE_EQUIP_BY_COVENANT,
  TRICKY_DECOY_EQUIP_NAMES,
  TRIGGER_THEME_META,
  TRIGGER_THEMES,
} from './themes.ts';
import {
  DEALER_SHOP_SIZE,
  type BountyChallengeTheme,
  type CardRevealTag,
  type DealerCard,
  type DealerRound,
  type DealerKnowledgeRoundKind,
  type EquipChallengeTheme,
  type StrategyChallengeTheme,
  type TierCheckTheme,
  type TriggerChallengeTheme,
} from './types.ts';
import {
  covenantMemo,
  createOrderSeed,
  createSeededRandom,
  extractTriggerHint,
  shuffleWith,
  splitTraitSegments,
} from './utils.ts';

function sampleDistinctByName<T extends {readonly name: string}>(
  primary: readonly T[],
  fallback: readonly T[],
  count: number,
  rng: () => number,
  forceIncludeName?: string,
): T[] {
  if (forceIncludeName && count > 0) {
    const forced =
      primary.find((item) => item.name === forceIncludeName) ??
      fallback.find((item) => item.name === forceIncludeName);
    if (forced) {
      const rest = sampleDistinctByName(
        primary.filter((item) => item.name !== forced.name),
        fallback.filter((item) => item.name !== forced.name),
        count - 1,
        rng,
      );
      return [forced, ...rest];
    }
  }
  const picked = shuffleWith(primary, rng).slice(0, count);
  if (picked.length >= count) return picked;
  const chosen = new Set(picked.map((item) => item.name));
  const extra = shuffleWith(
    fallback.filter((item) => !chosen.has(item.name)),
    rng,
  ).slice(0, count - picked.length);
  return [...picked, ...extra];
}

function shuffleAvoidSameEnds<T extends {readonly title: string}>(
  canonical: readonly T[],
  shuffleRng: () => number,
): T[] {
  const ordered = shuffleWith(canonical, shuffleRng);
  if (
    ordered.length >= 2 &&
    ordered[0].title === canonical[0].title &&
    ordered[ordered.length - 1].title === canonical[canonical.length - 1].title
  ) {
    const swapIdx = 1 + Math.floor(shuffleRng() * (ordered.length - 1));
    [ordered[0], ordered[swapIdx]] = [ordered[swapIdx], ordered[0]];
  }
  return ordered;
}

function createOperatorCard(
  operator: Operator,
  targetCovenant: string,
  attachedEquip?: Equipment,
): DealerCard {
  const nativeMatch = operator.covenants.includes(targetCovenant);
  const transmuteMatch = attachedEquip?.covenant === targetCovenant;
  const revealTags: CardRevealTag[] = operator.covenants.map((cov) => ({
    label: cov,
    covenant: cov,
    match: cov === targetCovenant,
  }));

  if (attachedEquip) {
    if (attachedEquip.covenant) {
      revealTags.push({
        label: `同构→${attachedEquip.covenant}`,
        covenant: attachedEquip.covenant,
        match: transmuteMatch,
        mismatch: !transmuteMatch,
      });
    } else {
      revealTags.push({
        label: '同构无效',
        mismatch: true,
      });
    }
  }

  return {
    cardKind: 'operator',
    operator,
    attachedEquip,
    detailKind: 'op',
    title: operator.name,
    tier: operator.tier,
    cornerBadge: TIER_LABELS[operator.tier],
    isImpostor: !(nativeMatch || transmuteMatch),
    triggerHint: extractTriggerHint(operator.trait),
    secondaryClue: attachedEquip
      ? `${operator.covenants.length} 盟约 · 含同构装`
      : `${operator.covenants.length} 盟约 · ${operator.type}`,
    traitSegments: splitTraitSegments(operator.trait),
    revealTags,
    status: 'unseen',
  };
}

function buildEquipmentClue(
  eq: Equipment,
  theme: EquipChallengeTheme,
): {triggerHint: string; secondaryClue: string} {
  const cleanEffect = eq.effect.replace(/；配.*$/, '');
  if (theme === 'consumable') {
    return {
      triggerHint: `${eq.price} 资金${eq.advanced ? ' · 有进阶' : ' · 无进阶'}`,
      secondaryClue: cleanEffect.replace(/^装备时销毁[，,]\s*/, ''),
    };
  }
  if (theme === 'upgradable') {
    return {
      triggerHint: `${eq.price} 资金${eq.covenant ? ` · ${eq.covenant}向` : ''}`,
      secondaryClue: cleanEffect,
    };
  }
  if (theme === 'combo_recipe') {
    return {
      triggerHint: `${eq.price} 资金 · ${eq.advanced ? '有进阶' : '无进阶'}`,
      secondaryClue: cleanEffect,
    };
  }
  if (theme === 'price_thrift') {
    return {
      triggerHint: `${eq.tier} 阶${eq.covenant ? ` · ${eq.covenant}向` : eq.advanced ? ' · 可进阶' : ''}`,
      secondaryClue: cleanEffect,
    };
  }
  return {
    triggerHint: `${eq.price} 资金 · ${eq.tier} 阶`,
    secondaryClue: cleanEffect,
  };
}

function buildEquipmentRevealTags(
  eq: Equipment,
  theme: EquipChallengeTheme,
): CardRevealTag[] {
  const tags: CardRevealTag[] = [];
  if (theme === 'transmute_capable') {
    tags.push(
      eq.covenant
        ? {label: `可同构→${eq.covenant}`, covenant: eq.covenant, match: true}
        : {label: '无盟约词条', mismatch: true},
    );
  } else if (theme === 'upgradable') {
    tags.push(
      eq.advanced
        ? {label: '可同名进阶', match: true}
        : {label: '无同名进阶', mismatch: true},
    );
  } else if (theme === 'consumable') {
    tags.push(
      eq.effect.startsWith('装备时销毁')
        ? {label: '装备时销毁', match: true}
        : {label: '常驻穿戴装', mismatch: true},
    );
  } else if (theme === 'price_thrift') {
    tags.push(
      eq.price === 1
        ? {label: '1 资金', match: true}
        : {label: `${eq.price} 资金`, mismatch: true},
    );
  } else {
    const comboResult = COMBO_PART_TARGET.get(eq.name);
    tags.push(
      comboResult
        ? {label: `合→${comboResult}`, match: true}
        : {label: '非合成组件', mismatch: true},
    );
  }
  if (theme !== 'transmute_capable' && eq.covenant) {
    tags.push({label: `盟约:${eq.covenant}`, covenant: eq.covenant});
  }
  return tags;
}

function createEquipmentCard(
  eq: Equipment,
  theme: EquipChallengeTheme,
): DealerCard {
  const meta = EQUIP_THEME_META[theme];
  const isImpostor = !meta.match(eq);
  const {triggerHint, secondaryClue} = buildEquipmentClue(eq, theme);
  const fullText = eq.advanced
    ? `${eq.effect}；进阶：${eq.advanced}`
    : eq.effect;

  return {
    cardKind: 'equipment',
    equipment: eq,
    detailKind: 'eq',
    title: eq.name,
    tier: eq.tier,
    cornerBadge: TIER_LABELS[eq.tier],
    isImpostor,
    triggerHint,
    secondaryClue,
    traitSegments: splitTraitSegments(fullText),
    revealTags: buildEquipmentRevealTags(eq, theme),
    status: 'unseen',
  };
}

function createTriggerCard(
  operator: Operator,
  theme: TriggerChallengeTheme,
): DealerCard {
  const meta = TRIGGER_THEME_META[theme];
  const matched = meta.match(operator);
  const triggerHint =
    theme === 'prep_type'
      ? `${TIER_LABELS[operator.tier]}阶 · ${extractTriggerHint(operator.trait)}`
      : theme === 'in_battle_stack'
        ? `${TIER_LABELS[operator.tier]}阶 · ${operator.covenants.join('/')}`
        : `${TIER_LABELS[operator.tier]}阶 · ${operator.type}`;
  const secondaryClue =
    theme === 'in_battle_stack'
      ? `${operator.covenants.join(' / ')} · 查看定位与时机`
      : operator.covenants.join(' / ');

  return {
    cardKind: 'operator',
    operator,
    detailKind: 'op',
    title: operator.name,
    tier: operator.tier,
    cornerBadge: TIER_LABELS[operator.tier],
    isImpostor: !matched,
    triggerHint,
    secondaryClue,
    traitSegments: splitTraitSegments(operator.trait),
    revealTags: [
      {
        label: meta.revealText(operator, matched),
        match: matched,
        mismatch: !matched,
      },
      ...operator.covenants.map((cov) => ({label: cov, covenant: cov})),
    ],
    status: 'unseen',
  };
}

function createTierOperatorCard(
  operator: Operator,
  theme: TierCheckTheme,
): DealerCard {
  const matched =
    theme === 'low_shop_3' ? operator.tier <= 3 : operator.tier >= 5;
  return {
    cardKind: 'operator',
    operator,
    detailKind: 'op',
    title: operator.name,
    tier: operator.tier,
    cornerBadge: TIER_LABELS[operator.tier],
    cornerBadgeHidden: '?',
    hideTierBeforeReveal: true,
    isImpostor: !matched,
    triggerHint: operator.covenants.join(' / '),
    secondaryClue: `${operator.type} · ${extractTriggerHint(operator.trait)}`,
    traitSegments: splitTraitSegments(operator.trait),
    revealTags: [
      {
        label: `${TIER_LABELS[operator.tier]} 阶`,
        match: matched,
        mismatch: !matched,
      },
      ...operator.covenants.map((cov) => ({label: cov, covenant: cov})),
    ],
    status: 'unseen',
  };
}

function createTierEquipmentCard(eq: Equipment): DealerCard {
  const matched = eq.tier >= 5;
  const fullText = eq.advanced
    ? `${eq.effect}；进阶：${eq.advanced}`
    : eq.effect;
  return {
    cardKind: 'equipment',
    equipment: eq,
    detailKind: 'eq',
    title: eq.name,
    tier: eq.tier,
    cornerBadge: TIER_LABELS[eq.tier],
    cornerBadgeHidden: '?',
    hideTierBeforeReveal: true,
    isImpostor: !matched,
    triggerHint: `${eq.price} 资金${eq.covenant ? ` · ${eq.covenant}向` : ''}`,
    secondaryClue: eq.effect.replace(/；配.*$/, ''),
    traitSegments: splitTraitSegments(fullText),
    revealTags: [
      {
        label: `${TIER_LABELS[eq.tier]} 阶`,
        match: matched,
        mismatch: !matched,
      },
      ...(eq.covenant
        ? [{label: `盟约:${eq.covenant}`, covenant: eq.covenant}]
        : []),
    ],
    status: 'unseen',
  };
}

function createStrategyCard(
  st: Strategy,
  theme: StrategyChallengeTheme,
): DealerCard {
  const meta = STRATEGY_THEME_META[theme];
  const matched = meta.match(st);
  const fullText = st.skill ? `[${st.skill}] ${st.effect}` : st.effect;
  const isFaction = CORE_COVENANTS.includes(st.category);

  let triggerHint = `${st.category} · 生命 ${st.hp}`;
  if (theme === 'faction_exclusive' || theme === 'stack_focus') {
    triggerHint = `生命 ${st.hp} · ${st.unlock && st.unlock !== '初始' ? '需前置解锁' : '初始可用'}`;
  } else if (theme === 'high_hp') {
    triggerHint = `分类：${st.category}`;
  }

  const secondaryClue = st.skill
    ? `技能：${st.skill}`
    : st.unlock || '无额外前置解锁';

  const revealTags: CardRevealTag[] = [];
  if (theme === 'high_hp') {
    revealTags.push({
      label: `❤${st.hp}`,
      match: matched,
      mismatch: !matched,
    });
    revealTags.push({
      label: st.category,
      covenant: isFaction ? st.category : undefined,
    });
  } else if (theme === 'faction_exclusive') {
    revealTags.push({
      label: matched ? `专属·${st.category}` : `通用·${st.category}`,
      covenant: isFaction ? st.category : undefined,
      match: matched,
      mismatch: !matched,
    });
  } else if (theme === 'active_command') {
    revealTags.push({
      label: matched ? '主动指令' : '被动生效',
      match: matched,
      mismatch: !matched,
    });
    revealTags.push({
      label: st.category,
      covenant: isFaction ? st.category : undefined,
    });
  } else {
    revealTags.push({
      label: st.category,
      match: matched,
      mismatch: !matched,
    });
  }

  return {
    cardKind: 'strategy',
    strategy: st,
    detailKind: 'st',
    title: st.name,
    tier: 0,
    cornerBadge: st.hp ? `❤${st.hp}` : '策略',
    cornerBadgeHidden: meta.hideHp ? '❤?' : undefined,
    hideTierBeforeReveal: Boolean(meta.hideHp),
    isImpostor: !matched,
    triggerHint,
    secondaryClue,
    traitSegments: splitTraitSegments(fullText),
    revealTags,
    status: 'unseen',
  };
}

function createBountyCard(
  bounty: Bounty,
  theme: BountyChallengeTheme,
): DealerCard {
  const meta = BOUNTY_THEME_META[theme];
  const matched = meta.match(bounty);
  const fullText = `击败「${bounty.name}」后于【${bounty.when}】获得 ${bounty.funds} 资金`;

  return {
    cardKind: 'bounty',
    bounty,
    enemyId: bounty.enemyId,
    title: bounty.name,
    tier: 0,
    cornerBadge: `💰${bounty.funds}`,
    cornerBadgeHidden: '💰?',
    hideTierBeforeReveal: true,
    isImpostor: !matched,
    triggerHint:
      bounty.when === '下场' ? '单场即结赏金' : `周期：${bounty.when}`,
    secondaryClue:
      bounty.when === '下场'
        ? '仅在下场胜利后发放赏金'
        : `特殊发放时机：${bounty.when}`,
    traitSegments: splitTraitSegments(fullText),
    revealTags: [
      {
        label: `💰${bounty.funds} 资金`,
        match: matched,
        mismatch: !matched,
      },
      {label: bounty.when === '下场' ? '下场结算' : bounty.when},
    ],
    status: 'unseen',
  };
}

function resolveImpostorCount(
  rng: () => number,
  preferred?: number,
  minImpostors = 2,
  maxImpostors = 3,
): number {
  if (preferred !== undefined) {
    return Math.max(minImpostors, Math.min(maxImpostors, preferred));
  }
  return minImpostors + Math.floor(rng() * (maxImpostors - minImpostors + 1));
}

function buildCovenantRound(options: {
  roundNumber: number;
  targetCovenant: string;
  rng: () => number;
  orderRng: () => number;
  introSeed: number;
  usedNames?: Set<string>;
  preferredImpostors?: number;
  forceIncludeName?: string;
}): DealerRound {
  const {
    roundNumber,
    targetCovenant,
    rng,
    orderRng,
    introSeed,
    usedNames,
    forceIncludeName,
  } = options;
  const goodPool = rosterOf(targetCovenant);
  const badPool = OPERATORS.filter(
    (op) => !op.covenants.includes(targetCovenant),
  );

  const minGood = Math.min(2, goodPool.length);
  const minImpostor = Math.max(2, DEALER_SHOP_SIZE - goodPool.length);
  const maxImpostor = Math.min(
    DEALER_SHOP_SIZE - minGood,
    Math.max(minImpostor, 3),
  );
  const desiredImpostors = resolveImpostorCount(
    rng,
    options.preferredImpostors,
    minImpostor,
    maxImpostor,
  );
  const goodCount = Math.min(
    goodPool.length,
    DEALER_SHOP_SIZE - desiredImpostors,
  );
  const impostorCount = DEALER_SHOP_SIZE - goodCount;

  const freshGood = usedNames
    ? goodPool.filter((op) => !usedNames.has(op.name))
    : goodPool;
  const freshBad = usedNames
    ? badPool.filter((op) => !usedNames.has(op.name))
    : badPool;

  const goodPicked = sampleDistinctByName(
    freshGood,
    goodPool,
    goodCount,
    rng,
    forceIncludeName,
  );
  const badPicked = sampleDistinctByName(
    freshBad,
    badPool,
    impostorCount,
    rng,
    forceIncludeName,
  );
  for (const op of [...goodPicked, ...badPicked]) usedNames?.add(op.name);

  const canonical = [...goodPicked, ...badPicked].map((op) =>
    createOperatorCard(op, targetCovenant),
  );
  const cards = shuffleAvoidSameEnds(canonical, orderRng);
  const memo = covenantMemo(targetCovenant);

  return {
    roundNumber,
    kind: 'covenant',
    targetCovenant,
    targetLabel: `目标【${targetCovenant}】`,
    missionTitle: '盟约点名',
    missionSummary: memo.summary,
    missionBonus: memo.bonus,
    impostorTotal: badPicked.length,
    goodTotal: goodPicked.length,
    introLine: pickLine(DEAL_LINES, introSeed, targetCovenant),
    cards,
    hintRevealed: false,
    usedHint: false,
  };
}

function buildTransmuteRound(options: {
  roundNumber: number;
  targetCovenant: string;
  rng: () => number;
  orderRng: () => number;
  introSeed: number;
  usedNames?: Set<string>;
  preferredImpostors?: number;
  forceIncludeName?: string;
}): DealerRound {
  const {
    roundNumber,
    targetCovenant,
    rng,
    orderRng,
    introSeed,
    usedNames,
    forceIncludeName,
  } = options;
  const goodPool = rosterOf(targetCovenant);
  const badPool = OPERATORS.filter(
    (op) => !op.covenants.includes(targetCovenant),
  );

  const matchingEquips = TRANSMUTE_EQUIP_BY_COVENANT.get(targetCovenant) ?? [];
  if (!matchingEquips.length) {
    return buildCovenantRound(options);
  }

  const desiredImpostors = resolveImpostorCount(
    rng,
    options.preferredImpostors,
  );
  const nativeGoodCount = DEALER_SHOP_SIZE - desiredImpostors - 1;
  const freshGood = usedNames
    ? goodPool.filter((op) => !usedNames.has(op.name))
    : goodPool;
  const freshBad = usedNames
    ? badPool.filter((op) => !usedNames.has(op.name))
    : badPool;

  const nativePicked = sampleDistinctByName(
    freshGood,
    goodPool,
    Math.max(1, nativeGoodCount),
    rng,
    forceIncludeName,
  );
  const nonTargetPicked = sampleDistinctByName(
    freshBad,
    badPool,
    1 + desiredImpostors,
    rng,
    forceIncludeName,
  );
  for (const op of [...nativePicked, ...nonTargetPicked]) {
    usedNames?.add(op.name);
  }

  const trueTransmuteOp = nonTargetPicked[0];
  const trueEquip = shuffleWith(matchingEquips, rng)[0];

  // False transmute decoys: prefer configured covenant-null decoys + mismatched covenant equips.
  const trickyNullDecoys = TRICKY_DECOY_EQUIP_NAMES.map(
    (name) => EQUIP[name],
  ).filter((eq): eq is Equipment =>
    Boolean(
      eq && eq.covenant === null && !eq.mechanics?.grantsCompanionCovenant,
    ),
  );
  const nullDecoys = trickyNullDecoys.length
    ? trickyNullDecoys
    : EQUIPMENT.filter(
        (eq) => eq.covenant === null && !eq.mechanics?.grantsCompanionCovenant,
      );
  const otherCovenantDecoys = EQUIPMENT.filter(
    (eq) => eq.covenant !== null && eq.covenant !== targetCovenant,
  );
  const decoyPool = [
    // 两个带装干扰位各取一种。保留两次完整洗牌，后续每日题仍沿用原种子序列。
    ...shuffleWith(nullDecoys, rng).slice(0, 1),
    ...shuffleWith(otherCovenantDecoys, rng).slice(0, 1),
  ];

  // Put 1-2 false transmuters + 1 plain impostor (if desiredImpostors === 3) so players cannot guess solely by equip presence.
  const falseTransmuteCount = desiredImpostors >= 3 ? 2 : 1;
  const falseCards = nonTargetPicked
    .slice(1, 1 + desiredImpostors)
    .map((op, idx) =>
      createOperatorCard(
        op,
        targetCovenant,
        idx < falseTransmuteCount && decoyPool.length
          ? decoyPool[idx % decoyPool.length]
          : undefined,
      ),
    );

  const canonical: DealerCard[] = [
    ...nativePicked.map((op) => createOperatorCard(op, targetCovenant)),
    createOperatorCard(trueTransmuteOp, targetCovenant, trueEquip),
    ...falseCards,
  ];
  const cards = shuffleAvoidSameEnds(canonical, orderRng);
  const memo = covenantMemo(targetCovenant);
  const companionLabel = COMPANION_EQUIP_NAME || '同构装备';

  return {
    roundNumber,
    kind: 'transmute',
    targetCovenant,
    targetLabel: `同构转职 · 【${targetCovenant}】`,
    missionTitle: '同构转职',
    missionSummary: `携带「${companionLabel} + 对应【${targetCovenant}】装备」的非原生干员也视为自己人；揪出同构无效或异阵营串场！`,
    missionBonus: `${memo.summary}${memo.bonus ? ` · ${memo.bonus}` : ''}`,
    impostorTotal: falseCards.length,
    goodTotal: nativePicked.length + 1,
    introLine: pickLine(TRANSMUTE_DEAL_LINES, introSeed, targetCovenant),
    cards,
    hintRevealed: false,
    usedHint: false,
  };
}

function buildEquipmentRound(options: {
  roundNumber: number;
  equipTheme: EquipChallengeTheme;
  rng: () => number;
  orderRng: () => number;
  introSeed: number;
  preferredImpostors?: number;
  forceIncludeName?: string;
}): DealerRound {
  const {roundNumber, equipTheme, rng, orderRng, introSeed, forceIncludeName} =
    options;
  const meta = EQUIP_THEME_META[equipTheme];
  const goodPool = EQUIPMENT.filter(meta.match);
  let badPool = EQUIPMENT.filter(meta.impostor);

  let trickyConsumables: Equipment[] = [];
  if (equipTheme === 'consumable') {
    trickyConsumables = CONSUMABLE_DECOY_NAMES.map(
      (name) => EQUIP[name],
    ).filter((eq): eq is Equipment => Boolean(eq && meta.impostor(eq)));
    if (trickyConsumables.length >= 3) {
      badPool = [
        ...trickyConsumables,
        ...badPool.filter((eq) => !trickyConsumables.includes(eq)),
      ];
    }
  }

  const desiredImpostors = resolveImpostorCount(
    rng,
    options.preferredImpostors,
  );
  const goodCount = DEALER_SHOP_SIZE - desiredImpostors;

  const goodPicked = forceIncludeName
    ? sampleDistinctByName(goodPool, goodPool, goodCount, rng, forceIncludeName)
    : shuffleWith(goodPool, rng).slice(0, goodCount);
  const badPicked = forceIncludeName
    ? sampleDistinctByName(
        equipTheme === 'consumable' && trickyConsumables.length >= 3
          ? badPool.slice(0, 8)
          : badPool,
        badPool,
        desiredImpostors,
        rng,
        forceIncludeName,
      )
    : equipTheme === 'consumable' && trickyConsumables.length >= 3
      ? [
          ...shuffleWith(badPool.slice(0, 8), rng).slice(0, desiredImpostors),
        ].slice(0, desiredImpostors)
      : shuffleWith(badPool, rng).slice(0, desiredImpostors);

  const canonical = [...goodPicked, ...badPicked].map((eq) =>
    createEquipmentCard(eq, equipTheme),
  );
  const cards = shuffleAvoidSameEnds(canonical, orderRng);

  return {
    roundNumber,
    kind: 'equipment',
    targetCovenant: meta.shortTarget,
    targetLabel: `装备整备 · 【${meta.shortTarget}】`,
    missionTitle: '装备整备',
    missionSummary: meta.summary,
    missionBonus: meta.bonus,
    equipTheme,
    impostorTotal: badPicked.length,
    goodTotal: goodPicked.length,
    introLine: pickLine(EQUIP_DEAL_LINES, introSeed, meta.shortTarget),
    cards,
    hintRevealed: false,
    usedHint: false,
  };
}

function buildTriggerRound(options: {
  roundNumber: number;
  triggerTheme: TriggerChallengeTheme;
  rng: () => number;
  orderRng: () => number;
  introSeed: number;
  usedNames?: Set<string>;
  preferredImpostors?: number;
  forceIncludeName?: string;
}): DealerRound {
  const {
    roundNumber,
    triggerTheme,
    rng,
    orderRng,
    introSeed,
    usedNames,
    forceIncludeName,
  } = options;
  const meta = TRIGGER_THEME_META[triggerTheme];
  const goodPool = OPERATORS.filter(meta.match);
  const badPool = OPERATORS.filter(meta.impostor);
  const decoys = meta.isDecoy ? badPool.filter(meta.isDecoy) : [];
  const primaryBad = decoys.length >= 2 ? decoys : badPool;

  const impostorCount = resolveImpostorCount(rng, options.preferredImpostors);
  const goodCount = DEALER_SHOP_SIZE - impostorCount;

  const freshGood = usedNames
    ? goodPool.filter((op) => !usedNames.has(op.name))
    : goodPool;
  const freshBad = usedNames
    ? primaryBad.filter((op) => !usedNames.has(op.name))
    : primaryBad;
  const fallbackBad = usedNames
    ? badPool.filter((op) => !usedNames.has(op.name))
    : badPool;

  const goodPicked = sampleDistinctByName(
    freshGood,
    goodPool,
    goodCount,
    rng,
    forceIncludeName,
  );
  const badPicked = sampleDistinctByName(
    freshBad.length >= impostorCount ? freshBad : fallbackBad,
    badPool,
    impostorCount,
    rng,
    forceIncludeName,
  );
  for (const op of [...goodPicked, ...badPicked]) usedNames?.add(op.name);

  const canonical = [...goodPicked, ...badPicked].map((op) =>
    createTriggerCard(op, triggerTheme),
  );
  const cards = shuffleAvoidSameEnds(canonical, orderRng);

  return {
    roundNumber,
    kind: 'trigger',
    targetCovenant: meta.shortTarget,
    targetLabel: `特质时机 · 【${meta.shortTarget}】`,
    missionTitle: '特质时机',
    missionSummary: meta.summary,
    missionBonus: meta.bonus,
    triggerTheme,
    impostorTotal: badPicked.length,
    goodTotal: goodPicked.length,
    introLine: pickLine(TRIGGER_DEAL_LINES, introSeed, meta.shortTarget),
    cards,
    hintRevealed: false,
    usedHint: false,
  };
}

function buildTierCheckRound(options: {
  roundNumber: number;
  tierCheckTheme: TierCheckTheme;
  rng: () => number;
  orderRng: () => number;
  introSeed: number;
  usedNames?: Set<string>;
  preferredImpostors?: number;
  forceIncludeName?: string;
}): DealerRound {
  const {
    roundNumber,
    tierCheckTheme,
    rng,
    orderRng,
    introSeed,
    usedNames,
    forceIncludeName,
  } = options;
  const meta = TIER_CHECK_META[tierCheckTheme];
  const impostorCount = resolveImpostorCount(rng, options.preferredImpostors);
  const goodCount = DEALER_SHOP_SIZE - impostorCount;

  let canonical: DealerCard[];
  if (meta.itemKind === 'equipment') {
    const goodPool = EQUIPMENT.filter((eq) => eq.tier >= 5);
    const badPool = EQUIPMENT.filter((eq) => eq.tier <= 4);
    const goodPicked = forceIncludeName
      ? sampleDistinctByName(
          goodPool,
          goodPool,
          goodCount,
          rng,
          forceIncludeName,
        )
      : shuffleWith(goodPool, rng).slice(0, goodCount);
    const badPicked = forceIncludeName
      ? sampleDistinctByName(
          badPool,
          badPool,
          impostorCount,
          rng,
          forceIncludeName,
        )
      : shuffleWith(badPool, rng).slice(0, impostorCount);
    canonical = [...goodPicked, ...badPicked].map(createTierEquipmentCard);
  } else {
    const goodPool = OPERATORS.filter((op) =>
      tierCheckTheme === 'low_shop_3' ? op.tier <= 3 : op.tier >= 5,
    );
    const badPool = OPERATORS.filter((op) =>
      tierCheckTheme === 'low_shop_3' ? op.tier >= 4 : op.tier <= 4,
    );
    const freshGood = usedNames
      ? goodPool.filter((op) => !usedNames.has(op.name))
      : goodPool;
    const freshBad = usedNames
      ? badPool.filter((op) => !usedNames.has(op.name))
      : badPool;
    const goodPicked = sampleDistinctByName(
      freshGood,
      goodPool,
      goodCount,
      rng,
      forceIncludeName,
    );
    const badPicked = sampleDistinctByName(
      freshBad,
      badPool,
      impostorCount,
      rng,
      forceIncludeName,
    );
    for (const op of [...goodPicked, ...badPicked]) usedNames?.add(op.name);
    canonical = [...goodPicked, ...badPicked].map((op) =>
      createTierOperatorCard(op, tierCheckTheme),
    );
  }

  const cards = shuffleAvoidSameEnds(canonical, orderRng);
  return {
    roundNumber,
    kind: 'tier_check',
    targetCovenant: meta.shortTarget,
    targetLabel: `升本验阶 · 【${meta.shortTarget}】`,
    missionTitle: '升本验阶',
    missionSummary: meta.summary,
    missionBonus: meta.bonus,
    tierCheckTheme,
    impostorTotal: impostorCount,
    goodTotal: goodCount,
    introLine: pickLine(TIER_DEAL_LINES, introSeed, meta.shortTarget),
    cards,
    hintRevealed: false,
    usedHint: false,
  };
}

function buildStrategyRound(options: {
  roundNumber: number;
  strategyTheme: StrategyChallengeTheme;
  rng: () => number;
  orderRng: () => number;
  introSeed: number;
  preferredImpostors?: number;
  forceIncludeName?: string;
}): DealerRound {
  const {
    roundNumber,
    strategyTheme,
    rng,
    orderRng,
    introSeed,
    forceIncludeName,
  } = options;
  const meta = STRATEGY_THEME_META[strategyTheme];
  const goodPool = STRATEGIES.filter(meta.match);
  const badPool = STRATEGIES.filter(meta.impostor);
  const impostorCount = resolveImpostorCount(rng, options.preferredImpostors);
  const goodCount = DEALER_SHOP_SIZE - impostorCount;

  const goodPicked = forceIncludeName
    ? sampleDistinctByName(goodPool, goodPool, goodCount, rng, forceIncludeName)
    : shuffleWith(goodPool, rng).slice(0, goodCount);
  const badPicked = forceIncludeName
    ? sampleDistinctByName(
        badPool,
        badPool,
        impostorCount,
        rng,
        forceIncludeName,
      )
    : shuffleWith(badPool, rng).slice(0, impostorCount);
  const canonical = [...goodPicked, ...badPicked].map((st) =>
    createStrategyCard(st, strategyTheme),
  );
  const cards = shuffleAvoidSameEnds(canonical, orderRng);

  return {
    roundNumber,
    kind: 'strategy',
    targetCovenant: meta.shortTarget,
    targetLabel: `开局策略 · 【${meta.shortTarget}】`,
    missionTitle: '开局策略',
    missionSummary: meta.summary,
    missionBonus: meta.bonus,
    strategyTheme,
    impostorTotal: badPicked.length,
    goodTotal: goodPicked.length,
    introLine: pickLine(STRATEGY_DEAL_LINES, introSeed, meta.shortTarget),
    cards,
    hintRevealed: false,
    usedHint: false,
  };
}

function sampleDistinctBounties(
  pool: readonly Bounty[],
  count: number,
  rng: () => number,
  usedEnemyIds: Set<string>,
  forceIncludeName?: string,
): Bounty[] {
  const picked: Bounty[] = [];
  if (forceIncludeName && count > 0) {
    const forced = pool.find(
      (item) =>
        item.name === forceIncludeName && !usedEnemyIds.has(item.enemyId),
    );
    if (forced) {
      usedEnemyIds.add(forced.enemyId);
      picked.push(forced);
      if (picked.length >= count) return picked;
    }
  }
  for (const item of shuffleWith(pool, rng)) {
    if (usedEnemyIds.has(item.enemyId)) continue;
    usedEnemyIds.add(item.enemyId);
    picked.push(item);
    if (picked.length >= count) break;
  }
  return picked;
}

function buildBountyRound(options: {
  roundNumber: number;
  bountyTheme: BountyChallengeTheme;
  rng: () => number;
  orderRng: () => number;
  introSeed: number;
  preferredImpostors?: number;
  forceIncludeName?: string;
}): DealerRound {
  const {roundNumber, bountyTheme, rng, orderRng, introSeed, forceIncludeName} =
    options;
  const meta = BOUNTY_THEME_META[bountyTheme];
  const goodPool = BOUNTIES.filter(meta.match);
  const badPool = BOUNTIES.filter(meta.impostor);
  const impostorCount = resolveImpostorCount(rng, options.preferredImpostors);
  const goodCount = DEALER_SHOP_SIZE - impostorCount;

  const usedEnemyIds = new Set<string>();
  const goodPicked = sampleDistinctBounties(
    goodPool,
    goodCount,
    rng,
    usedEnemyIds,
    forceIncludeName,
  );
  const badPicked = sampleDistinctBounties(
    badPool,
    impostorCount,
    rng,
    usedEnemyIds,
    forceIncludeName,
  );
  const canonical = [...goodPicked, ...badPicked].map((b) =>
    createBountyCard(b, bountyTheme),
  );
  const cards = shuffleAvoidSameEnds(canonical, orderRng);

  return {
    roundNumber,
    kind: 'bounty',
    targetCovenant: meta.shortTarget,
    targetLabel: `悬赏猎金 · 【${meta.shortTarget}】`,
    missionTitle: '悬赏猎金',
    missionSummary: meta.summary,
    missionBonus: meta.bonus,
    bountyTheme,
    impostorTotal: badPicked.length,
    goodTotal: goodPicked.length,
    introLine: pickLine(BOUNTY_DEAL_LINES, introSeed, meta.shortTarget),
    cards,
    hintRevealed: false,
    usedHint: false,
  };
}

export interface KnowledgeRoundOptions {
  roundNumber: number;
  kind?: DealerKnowledgeRoundKind;
  targetCovenant?: string;
  equipTheme?: EquipChallengeTheme;
  triggerTheme?: TriggerChallengeTheme;
  tierCheckTheme?: TierCheckTheme;
  strategyTheme?: StrategyChallengeTheme;
  bountyTheme?: BountyChallengeTheme;
  forceIncludeName?: string;
  rng: () => number;
  orderRng?: () => number;
  introSeed?: number;
  usedNames?: Set<string>;
  preferredImpostors?: number;
}

function drawDealerRound(options: KnowledgeRoundOptions): DealerRound {
  const {roundNumber, rng, usedNames, preferredImpostors, forceIncludeName} =
    options;
  const kind = options.kind ?? 'covenant';
  const shuffleRng = options.orderRng ?? rng;
  const introSeed =
    options.introSeed ?? roundNumber + Math.floor(shuffleRng() * 97);

  if (kind === 'equipment') {
    const equipTheme =
      options.equipTheme ??
      EQUIP_THEMES[Math.floor(rng() * EQUIP_THEMES.length)];
    return buildEquipmentRound({
      roundNumber,
      equipTheme,
      rng,
      orderRng: shuffleRng,
      introSeed,
      preferredImpostors,
      forceIncludeName,
    });
  }

  if (kind === 'trigger') {
    const triggerTheme =
      options.triggerTheme ??
      TRIGGER_THEMES[Math.floor(rng() * TRIGGER_THEMES.length)];
    return buildTriggerRound({
      roundNumber,
      triggerTheme,
      rng,
      orderRng: shuffleRng,
      introSeed,
      usedNames,
      preferredImpostors,
      forceIncludeName,
    });
  }

  if (kind === 'tier_check') {
    const tierCheckTheme =
      options.tierCheckTheme ??
      TIER_CHECK_THEMES[Math.floor(rng() * TIER_CHECK_THEMES.length)];
    return buildTierCheckRound({
      roundNumber,
      tierCheckTheme,
      rng,
      orderRng: shuffleRng,
      introSeed,
      usedNames,
      preferredImpostors,
      forceIncludeName,
    });
  }

  if (kind === 'strategy') {
    const strategyTheme =
      options.strategyTheme ??
      STRATEGY_THEMES[Math.floor(rng() * STRATEGY_THEMES.length)];
    return buildStrategyRound({
      roundNumber,
      strategyTheme,
      rng,
      orderRng: shuffleRng,
      introSeed,
      preferredImpostors,
      forceIncludeName,
    });
  }

  if (kind === 'bounty') {
    const bountyTheme =
      options.bountyTheme ??
      BOUNTY_THEMES[Math.floor(rng() * BOUNTY_THEMES.length)];
    return buildBountyRound({
      roundNumber,
      bountyTheme,
      rng,
      orderRng: shuffleRng,
      introSeed,
      preferredImpostors,
      forceIncludeName,
    });
  }

  const targetCovenant =
    options.targetCovenant ??
    (kind === 'transmute' ? TRANSMUTE_COVENANTS[0] : SELECTABLE_COVENANTS[0]);

  if (kind === 'transmute') {
    return buildTransmuteRound({
      roundNumber,
      targetCovenant,
      rng,
      orderRng: shuffleRng,
      introSeed,
      usedNames,
      preferredImpostors,
      forceIncludeName,
    });
  }

  return buildCovenantRound({
    roundNumber,
    targetCovenant,
    rng,
    orderRng: shuffleRng,
    introSeed,
    usedNames,
    preferredImpostors,
    forceIncludeName,
  });
}

/** 旧每日存档用种子重建牌面。整套题抽完再替换召唤物，保留题序、牌位和命中判定。 */
function replaceNonShopTierCards(
  round: DealerRound,
  usedNames: Set<string>,
): void {
  const theme = round.tierCheckTheme;
  if (!theme) return;
  for (const [index, card] of round.cards.entries()) {
    if (card.operator?.stars !== 0) continue;
    const replacement = OPERATORS.find(
      (op) => op.stars > 0 && op.tier === card.tier && !usedNames.has(op.name),
    );
    if (replacement) {
      round.cards[index] = createTierOperatorCard(replacement, theme);
      usedNames.add(replacement.name);
    }
  }
}

/** 按题型和随机源生成一轮；传入 usedNames 时同步登记已使用的干员。 */
export function buildKnowledgeRound(
  options: KnowledgeRoundOptions,
): DealerRound {
  const round = drawDealerRound(options);
  if (round.tierCheckTheme) {
    const usedNames =
      options.usedNames ?? new Set(round.cards.map((card) => card.title));
    replaceNonShopTierCards(round, usedNames);
  }
  return round;
}

/** Generates deterministic daily challenges rotating across all 7 question types. */
export function buildDailyRounds(
  dateKey: string,
  orderSeed?: string,
): DealerRound[] {
  const questionRng = createSeededRandom(`wsq.dealer.daily:${dateKey}`);
  const effectiveOrderSeed = orderSeed ?? createOrderSeed();
  const orderRng = createSeededRandom(
    `wsq.dealer.daily.order:${dateKey}:${effectiveOrderSeed}`,
  );

  const cores = shuffleWith(DAILY_CORE_POOL, questionRng);
  const covenantCore = cores[0];

  const transmuteAddonPool = shuffleWith(
    TRANSMUTE_ADDON_POOL.filter((name) => name !== covenantCore),
    questionRng,
  );
  const transmuteAddon = transmuteAddonPool[0] ?? TRANSMUTE_COVENANTS[0];

  const round2Kind: DealerKnowledgeRoundKind =
    questionRng() < 0.5 ? 'trigger' : 'tier_check';
  const round5Kind: DealerKnowledgeRoundKind =
    questionRng() < 0.5 ? 'strategy' : 'bounty';

  const triggerTheme =
    TRIGGER_THEMES[Math.floor(questionRng() * TRIGGER_THEMES.length)];
  const tierCheckTheme =
    TIER_CHECK_THEMES[Math.floor(questionRng() * TIER_CHECK_THEMES.length)];
  const equipTheme =
    EQUIP_THEMES[Math.floor(questionRng() * EQUIP_THEMES.length)];
  const strategyTheme =
    STRATEGY_THEMES[Math.floor(questionRng() * STRATEGY_THEMES.length)];
  const bountyTheme =
    BOUNTY_THEMES[Math.floor(questionRng() * BOUNTY_THEMES.length)];

  const impostorCounts = shuffleWith([2, 3, 2, 3, 2], questionRng);
  const usedNames = new Set<string>();

  const blueprint: readonly {
    readonly kind: DealerKnowledgeRoundKind;
    readonly covenant?: string;
    readonly equipTheme?: EquipChallengeTheme;
    readonly triggerTheme?: TriggerChallengeTheme;
    readonly tierCheckTheme?: TierCheckTheme;
    readonly strategyTheme?: StrategyChallengeTheme;
    readonly bountyTheme?: BountyChallengeTheme;
  }[] = [
    {kind: 'covenant', covenant: covenantCore},
    round2Kind === 'trigger'
      ? {kind: 'trigger', triggerTheme}
      : {kind: 'tier_check', tierCheckTheme},
    {kind: 'transmute', covenant: transmuteAddon},
    {kind: 'equipment', equipTheme},
    round5Kind === 'strategy'
      ? {kind: 'strategy', strategyTheme}
      : {kind: 'bounty', bountyTheme},
  ];

  const rounds = blueprint.map((slot, index) =>
    drawDealerRound({
      roundNumber: index + 1,
      kind: slot.kind,
      targetCovenant: slot.covenant,
      equipTheme: slot.equipTheme,
      triggerTheme: slot.triggerTheme,
      tierCheckTheme: slot.tierCheckTheme,
      strategyTheme: slot.strategyTheme,
      bountyTheme: slot.bountyTheme,
      rng: questionRng,
      orderRng,
      introSeed: Math.floor(orderRng() * 1000) + index,
      usedNames,
      preferredImpostors: impostorCounts[index],
    }),
  );
  for (const round of rounds) replaceNonShopTierCards(round, usedNames);
  return rounds;
}
