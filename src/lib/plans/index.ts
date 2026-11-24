/** 兼容既有方案API；显式保留原出口，内部校验与评分细节不自动变成公开API。 */
export {
  MAX_OPS,
  MAX_EQ,
  MAX_ALT,
  MAX_NOTE,
  MAX_STRATEGIES,
  MAX_STAGE_ROUND,
  LAYER_SLIDER,
  MAX_LAYERS,
  usesLayers,
  cleanLayers,
  newSlot,
  builtinPlan,
  samePlan,
  validStageRange,
} from './model.ts';
export type {PlanOp, Layers, Plan, PlanStage} from './model.ts';
export {
  covenantsOf,
  RESERVE_COVENANTS,
  covenantStats,
  atLayers,
} from './covenants.ts';
export type {CovenantStat} from './covenants.ts';
export {copiesFor, planCost, equipNotes} from './costs.ts';
export type {PlanCost, EquipNote} from './costs.ts';
export {diagnoseLineup} from './diagnostics.ts';
export type {
  LineupDiagnostics,
  RoleCoverageEntry,
  SubstituteRoleRisk,
} from './diagnostics.ts';
export {
  CODE_PREFIX,
  encodePlan,
  decodePlan,
  shareUrl,
  formatPlanShareText,
} from './sharing.ts';
export type {Shared, Decoded} from './sharing.ts';
export {
  newId,
  blankPlan,
  loadPlans,
  savePlans,
} from './storage.ts';
export {
  defaultLineupGoal,
  inferPrimaryCovenant,
  createLineupEvaluator,
  suggestions,
  alternatesFor,
  isBanned,
  banReplace,
} from '../recommendation/planning.ts';
export type {
  CovenantChange,
  LineupEvaluation,
  Suggestion,
  LineupGoal,
  LineupEvaluationOptions,
  BanPick,
  BanResult,
} from '../recommendation/planning.ts';
