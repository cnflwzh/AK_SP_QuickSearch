/**
 * 推荐计算的公共入口，不读取浏览器存储或修改输入。
 * 静态方案使用 suggestions/alternatesFor/banReplace；真实局面使用 recommendRecruits/recommendDeployments。
 * 两种上下文共用 createLineupEvaluator，但不能把目标装备、层数当作实际已获得状态。
 */
export type { Layers,PlanOp } from '../plans/model.ts';
export type {
AdvisorRun,
DeploymentAdvice,
RecruitAdvice
} from './live/advisorTypes.ts';
export { recommendDeployments,recommendRecruits } from './live/runAdvisor.ts';
export {
alternatesFor,
banReplace,
createLineupEvaluator,
suggestions
} from './planning.ts';
export type {
BanResult,
LineupEvaluation,
LineupEvaluationOptions,
LineupGoal,
Suggestion
} from './planning.ts';
