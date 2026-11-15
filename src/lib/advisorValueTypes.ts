/** Shared contracts for trait estimates. Missing observations remain unknown. */
import type { FrontTargets } from './advisorPosition.ts';
import type { Layers, PlanOp } from './planner.ts';
export interface ValueContext {
  round: number | null;
  totalRounds?: number | null;
  layers: Layers;
  level: number;
  strategy: string;
  acquisitionsThisRound?: number | null;
  commandAvailable?: boolean | null;
  frontTargets?: Readonly<FrontTargets>;
  inactiveCovenants?: ReadonlySet<string>;
}
export interface ValueRoster {
  field: readonly PlanOp[];
  reserve: readonly PlanOp[];
}
export interface LayerGain {
  covenant: string;
  amount: number;
}
export interface TraitValue {
  score: number;
  reasons: string[];
  /** 确定的获得时层数，与当前休整结束产层保持独立。 */
  acquisitionGains?: LayerGain[];
  /** 当前休整结束的确定性产层；不含未来回合、战斗上限或未知站位。 */
  endOfRestGains?: LayerGain[];
}
export interface CommandOpportunity extends TraitValue {
  target?: string;
}
