import {EQUIP} from '../../../data/index.ts';
import type {Plan, PlanOp, PlanStage} from './model.ts';

/** 区间键供存档与导航使用；空键留给成型阵容。 */
export const stageKey = (stage: Pick<PlanStage, 'from' | 'to'>): string =>
  `${stage.from}-${stage.to}`;

/** 根据首末回合返回玩家可见的阶段名称。 */
export const stageLabel = (stage: Pick<PlanStage, 'from' | 'to'>): string =>
  stage.from === stage.to
    ? `第 ${stage.from} 回合`
    : `第 ${stage.from}–${stage.to} 回合`;

/** 按存档键查找阶段。不存在或成型阵容返回 undefined，由入口选择视图的默认阵容。 */
export const stageOf = (plan: Pick<Plan, 'stages'>, key: string) =>
  plan.stages?.find((stage) => stageKey(stage) === key);

/** 依次列出槽位配装、内置流派和当前阶段推荐，剔除重复及赛季外的装备。 */
export function lineupEquipment(
  ops: readonly PlanOp[],
  base: readonly string[] = [],
  guide: readonly string[] = [],
): Set<string> {
  return new Set(
    [...ops.flatMap((op) => op.eq), ...base, ...guide].filter((name) =>
      Object.hasOwn(EQUIP, name),
    ),
  );
}
