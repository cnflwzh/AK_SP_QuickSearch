import { CYCLE_REWARDS, LAYER_BREAKPOINTS } from '../../data/numberTools.ts';

/** 返回严格高于当前层数的下一项；全部达到时返回 undefined。 */
export function nextLayerBreakpoint(covenant: string, layers: number) {
  return LAYER_BREAKPOINTS[covenant]?.find(item => item.layers > layers);
}

/** 返回循环奖励下一档与差值，不把累计档位计为当回合新收入。 */
export function nextCycleReward(covenant: string, layers: number) {
  const cycle = CYCLE_REWARDS[covenant];
  if (!cycle) return undefined;
  const target = (Math.floor(layers / cycle.every) + 1) * cycle.every;
  return { ...cycle, target, remaining: target - layers };
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
export function refreshBudget(funds: number, reserve: number, upgradeCost = 0): RefreshBudget {
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
