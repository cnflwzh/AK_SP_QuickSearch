import {
  COMBAT_ROLES,
  COVENANTS,
  EQUIP,
  OPERATOR,
  operatorRolesAtElite,
  type CombatRole,
  type ElementalCondition,
  type EquipmentRoleTrigger,
  type Operator,
} from '../../../data/index.ts';
import {hasBoxEntries, isBoxSubstitute} from '../box/insights.ts';
import type {OperatorBox} from '../box/model.ts';
import {covenantStats, type CovenantStat} from './covenants.ts';
import {MAX_OPS, type PlanOp} from './model.ts';

export interface RoleCoverageEntry {
  readonly role: CombatRole;
  readonly id: string;
  readonly desc: string;
  readonly essential: boolean;
  readonly providers: readonly string[];
  /** 所有已知来源都依赖会被替补的本体或其触发条件，原型能否覆盖尚需确认。 */
  readonly substituteOnly?: boolean;
}

export interface SubstituteRoleRisk {
  readonly role: CombatRole;
  readonly essential: boolean;
  readonly operators: readonly {
    readonly name: string;
    readonly backupOperator?: string;
  }[];
}

export interface LineupDiagnostics {
  readonly entries: readonly RoleCoverageEntry[];
  readonly missingEssential: readonly RoleCoverageEntry[];
  readonly substituteRisks: readonly SubstituteRoleRisk[];
  readonly borrowPlan: BorrowPlan;
}

const ESSENTIAL_ROLES: ReadonlySet<CombatRole> = new Set([
  '对空',
  '治疗',
  '阻挡',
  '群攻',
]);

function canTrigger(
  trigger: EquipmentRoleTrigger | undefined,
  op: Operator,
  gainsArtsDamage: boolean,
): boolean {
  const action = op.combatAction ?? '攻击';
  const attacks = action === '攻击' || action === '可造成法伤';
  switch (trigger) {
    case '地面':
      return !!op.melee;
    case '地面攻击':
      return !!op.melee && attacks;
    case '攻击':
      return attacks;
    case '伤害':
      return action !== '无伤害';
    case '法伤':
      return (
        action === '可造成法伤' || (action !== '无伤害' && gainsArtsDamage)
      );
    default:
      return true;
  }
}

// 每个掩码是一条可独立成立的来源，掩码中的本体必须同时可用。0 表示无需借用。
// 若借 A 已能覆盖某项职能，就丢弃同一职能下“还要借 A 和 B”的冗余条件。
function recordSource<K>(
  dependencies: Map<K, number[]>,
  key: K,
  required: number,
): void {
  const options = dependencies.get(key) ?? [];
  if (options.some((known) => (known & required) === known)) return;
  const minimal = options.filter((known) => (known & required) !== required);
  minimal.push(required);
  dependencies.set(key, minimal);
}

interface BorrowPlan {
  readonly names: readonly string[];
  readonly roles: readonly CombatRole[];
}

function bitCount(mask: number): number {
  let count = 0;
  while (mask) {
    mask &= mask - 1;
    count++;
  }
  return count;
}

/** 按未覆盖的职能选一组足以提供该职能的本体。依次比较基础职能、总职能、
 * 占用名额、核心人数。仍相同时按原站位掩码从小到大，保留旧方案的并列顺序。 */
function bestRoleBorrowPlan(
  candidates: readonly PlanOp[],
  risks: readonly SubstituteRoleRisk[],
  dependencies: ReadonlyMap<CombatRole, readonly number[]>,
  limit: number,
): BorrowPlan {
  if (!risks.length || limit < 1) return {names: [], roles: []};
  const coreMask = candidates.reduce(
    (mask, slot, i) => (slot.core ? mask | (1 << i) : mask),
    0,
  );
  const goals = risks.map(({role, essential}) => ({
    options: dependencies.get(role)!,
    // 一个基础职能优先于所有非基础职能之和。
    value: essential ? risks.length + 1 : 1,
  }));
  // 先满足基础职能、优先试来源少的缺口，以便尽早得到可剪枝的完整方案。
  const searchOrder = [...goals].sort(
    (a, b) => b.value - a.value || a.options.length - b.options.length,
  );
  let bestMask = 0;
  let bestScore = 0;
  let bestSize = 0;
  let bestCoreCount = 0;
  function search(index: number, mask: number, possibleScore: number): void {
    const size = bitCount(mask);
    if (size > limit || possibleScore < bestScore) return;
    if (possibleScore === bestScore && size > bestSize) return;
    if (index === searchOrder.length) {
      const coreCount = bitCount(mask & coreMask);
      if (
        possibleScore > bestScore ||
        size < bestSize ||
        (size === bestSize &&
          (coreCount > bestCoreCount ||
            (coreCount === bestCoreCount && mask < bestMask)))
      ) {
        bestMask = mask;
        bestScore = possibleScore;
        bestSize = size;
        bestCoreCount = coreCount;
      }
      return;
    }
    const {options, value} = searchOrder[index];
    if (options.some((required) => (mask & required) === required)) {
      search(index + 1, mask, possibleScore);
      return;
    }
    // 任一最省名额的解都是已覆盖职能各选一个来源的并集，无需枚举所有干员子集。
    if (size < limit) {
      for (const required of options)
        search(index + 1, mask | required, possibleScore);
    }
    search(index + 1, mask, possibleScore - value);
  }
  search(
    0,
    0,
    goals.reduce((sum, goal) => sum + goal.value, 0),
  );
  return {
    names: candidates
      .filter((_, i) => bestMask & (1 << i))
      .map((slot) => slot.name),
    roles: risks
      .filter((_, i) =>
        goals[i].options.some((required) => (bestMask & required) === required),
      )
      .map((risk) => risk.role),
  };
}

/**
 * 返回传入阵容的职能及来源。stats 可传入已按指定层数和人数计算的盟约状态。
 * 有当前赛季 Box 时，标记依赖未借本体的来源。替补继承盟约与特质，原型的技能和
 * 部署/攻击条件未在赛季职能表中收录，所以这类来源需确认。无条件装备仍然生效。
 * borrowLimit 是本次可用的助战名额，缺省只诊断。规划草案的所有位置均可参与诊断。
 */
export function diagnoseLineup(
  ops: readonly PlanOp[],
  stats: readonly CovenantStat[] = covenantStats(ops),
  box?: Readonly<OperatorBox>,
  borrowLimit = 0,
): LineupDiagnostics {
  const providers = new Map<CombatRole, Set<string>>();
  const roleDependencies = new Map<CombatRole, number[]>();
  const elementDependencies = new Map<ElementalCondition, number[]>();
  const artsMembers = new Set<string>();
  const conditionalElements: Operator[] = [];
  const activeBox = hasBoxEntries(box) ? box : undefined;
  const candidates = activeBox
    ? ops.slice(0, MAX_OPS).filter((slot) => {
        const op = OPERATOR[slot.name];
        return op && isBoxSubstitute(op, activeBox);
      })
    : [];
  const bodyBits = new Map(candidates.map((slot, i) => [slot.name, 1 << i]));
  const requiredBody = (op: Operator): number => bodyBits.get(op.name) ?? 0;

  function add(role: CombatRole, source: string, required = 0): void {
    const list = providers.get(role) ?? new Set<string>();
    list.add(source);
    providers.set(role, list);
    recordSource(roleDependencies, role, required);
  }

  for (const stat of stats) {
    if (!stat.active) continue;
    const covenant = COVENANTS[stat.name];
    for (const role of covenant.roles ?? []) add(role, stat.name);
    if (covenant.memberArtsDamage) {
      for (const name of stat.members) artsMembers.add(name);
    }
    if (stat.bonusActive) {
      for (const role of covenant.bonusRoles ?? []) add(role, stat.name);
      for (const element of covenant.bonusElements ?? [])
        recordSource(elementDependencies, element, 0);
    }
  }

  for (const slot of ops) {
    const op = OPERATOR[slot.name];
    if (!op) continue;
    const body = requiredBody(op);
    const minimumField = op.minimumFieldRoles;
    for (const role of operatorRolesAtElite(op, slot.elite)) {
      if (
        minimumField &&
        ops.length < minimumField.count &&
        minimumField.roles.includes(role)
      ) {
        continue;
      }
      if (role === '元素输出') {
        if (op.elementalPrerequisites?.length) {
          conditionalElements.push(op);
          continue;
        }
        for (const element of op.inflictsElements ?? [])
          recordSource(elementDependencies, element, body);
      }
      add(role, op.name, body);
    }
    const equipment = slot.eq.map((name) => EQUIP[name]).filter(Boolean);
    const gainsArts =
      artsMembers.has(slot.name) ||
      equipment.some((eq) => eq.grantsArtsOnDamage);
    for (const eq of equipment) {
      if (!canTrigger(eq.roleTrigger, op, gainsArts)) continue;
      for (const role of eq.roles ?? []) {
        if (role === '阻挡' && !op.melee) continue;
        add(
          role,
          `${op.name}·${eq.name}`,
          eq.roleTrigger || role === '阻挡' ? body : 0,
        );
      }
      for (const element of eq.inflictsElements ?? [])
        recordSource(elementDependencies, element, eq.roleTrigger ? body : 0);
    }
  }

  for (const op of conditionalElements) {
    for (const element of op.elementalPrerequisites ?? []) {
      for (const prerequisite of elementDependencies.get(element) ?? []) {
        add('元素输出', op.name, requiredBody(op) | prerequisite);
      }
    }
  }

  const entries: RoleCoverageEntry[] = COMBAT_ROLES.map((meta) => {
    const list = [...(providers.get(meta.label) ?? [])];
    const sources = roleDependencies.get(meta.label);
    const substituteOnly = !!sources?.length && !sources.includes(0);
    return {
      role: meta.label,
      id: meta.id,
      desc: meta.desc,
      essential: ESSENTIAL_ROLES.has(meta.label),
      providers: list,
      ...(substituteOnly ? {substituteOnly: true} : {}),
    };
  });
  const substituteRisks: SubstituteRoleRisk[] = entries
    .filter((entry) => entry.substituteOnly)
    .map((entry) => ({
      role: entry.role,
      essential: entry.essential,
      operators: candidates
        .filter((_, i) =>
          roleDependencies.get(entry.role)!.some((mask) => mask & (1 << i)),
        )
        .map(({name}) => ({
          name,
          backupOperator: OPERATOR[name]?.backupOperator,
        })),
    }));
  return {
    entries,
    missingEssential: entries.filter(
      (entry) => entry.essential && !entry.providers.length,
    ),
    substituteRisks,
    borrowPlan: bestRoleBorrowPlan(
      candidates,
      substituteRisks,
      roleDependencies,
      borrowLimit,
    ),
  };
}
