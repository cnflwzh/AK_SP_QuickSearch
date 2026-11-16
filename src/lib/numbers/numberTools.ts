import {
  CYCLE_REWARDS,
  LAYER_BREAKPOINTS,
  OPERATORS,
  RESTRICTED_MODE_COVENANTS,
} from '../../../data/index.ts';
import {isBanned} from '../recommendation/planning.ts';

/** 返回严格高于当前层数的下一项；全部达到时返回 undefined。 */
export function nextLayerBreakpoint(covenant: string, layers: number) {
  return LAYER_BREAKPOINTS[covenant]?.find((item) => item.layers > layers);
}

/** 返回循环奖励下一档与差值，不把累计档位计为当回合新收入。 */
export function nextCycleReward(covenant: string, layers: number) {
  const cycle = CYCLE_REWARDS[covenant];
  if (!cycle) return undefined;
  const target = (Math.floor(layers / cycle.every) + 1) * cycle.every;
  return {...cycle, target, remaining: target - layers};
}

export interface RefreshBudget {
  /** 升级之后、尚未扣除买牌预留的余额。 */
  readonly balance: number;
  readonly refreshes: number;
  readonly upgradeShortfall: number;
  readonly reserveShortfall: number;
}

/**
 * 输入当前资金、买牌预留和本次实际升级价，返回按 1 资金/次计算的付费刷新预算。
 * 留本时 upgradeCost = 0。调用方负责传入非负整数；升级不足和预留不足分开报告。
 */
export function refreshBudget(
  funds: number,
  reserve: number,
  upgradeCost = 0,
): RefreshBudget {
  const balance = funds - upgradeCost;
  return {
    balance,
    refreshes: Math.max(0, balance - reserve),
    upgradeShortfall: Math.max(0, -balance),
    reserveShortfall: balance >= 0 ? Math.max(0, reserve - balance) : 0,
  };
}

/** 合成奖励：当前调度等级 +1，最高 VI 阶，随机三选一。 */
export function synthesisTier(level: number): number {
  return Math.min(6, level + 1);
}

/** 在给定同阶未禁池干员数下，三选一中至少出现 1 张目标干员的概率（0–1）。 */
export function synthesisHitRate(activeTierCount: number, picks = 3): number {
  if (activeTierCount <= 0) return 0;
  if (activeTierCount <= picks) return 1;
  return picks / activeTierCount;
}

export interface PoolBreakdown {
  readonly targetBanned: boolean;
  readonly shopPoolTotal: number;
  readonly shopPoolActive: number;
  readonly rewardTierTotal: number;
  readonly rewardTierActive: number;
  readonly targetTierTotal: number;
  readonly targetTierActive: number;
  readonly rewardHitRate: number;
  readonly targetSynthesisHitRate: number;
}

/**
 * 结合当前调度等级、本局禁池与调度模式（精简池/全池），
 * 统计可刷总池与三选一合成奖励的真实池容量及命中率，不修改输入。
 */
export function poolBreakdown(
  level: number,
  targetName: string,
  bannedCovenants: Iterable<string> = [],
  restrictedMode = false,
): PoolBreakdown {
  const effectiveBans = new Set<string>(bannedCovenants);
  if (restrictedMode) {
    for (const covenant of RESTRICTED_MODE_COVENANTS) {
      effectiveBans.add(covenant);
    }
  }
  const rewardTier = synthesisTier(level);
  const target = OPERATORS.find((op) => op.name === targetName);
  const targetBanned = target ? isBanned(target.name, effectiveBans) : false;
  const targetInPool =
    target !== undefined && target.stars !== 0 && !targetBanned;

  let shopPoolTotal = 0;
  let shopPoolActive = 0;
  let rewardTierTotal = 0;
  let rewardTierActive = 0;
  let targetTierTotal = 0;
  let targetTierActive = 0;

  for (const op of OPERATORS) {
    /* 辅助/召唤类干员（stars === 0）不进入商店刷新与合成三选一随机池。 */
    if (op.stars === 0) continue;
    const active = !isBanned(op.name, effectiveBans);
    if (op.tier <= level) {
      shopPoolTotal++;
      if (active) shopPoolActive++;
    }
    if (op.tier === rewardTier) {
      rewardTierTotal++;
      if (active) rewardTierActive++;
    }
    if (target && op.tier === target.tier) {
      targetTierTotal++;
      if (active) targetTierActive++;
    }
  }

  const rewardHitRate =
    target && targetInPool && target.tier === rewardTier
      ? synthesisHitRate(rewardTierActive)
      : 0;
  const targetSynthesisHitRate =
    target && targetInPool && target.tier > 1
      ? synthesisHitRate(targetTierActive)
      : 0;

  return {
    targetBanned,
    shopPoolTotal,
    shopPoolActive,
    rewardTierTotal,
    rewardTierActive,
    targetTierTotal,
    targetTierActive,
    rewardHitRate,
    targetSynthesisHitRate,
  };
}
