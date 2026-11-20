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
import type {PlanOp} from './model.ts';

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
  /** 已有来源，且至少有一项不依赖待确认的替补能力。 */
  readonly coveredCount: number;
  readonly substituteRisks: readonly SubstituteRoleRisk[];
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

// 缺键表示未覆盖；空集合表示有独立来源；非空集合记录可通过借用恢复的本体。
function recordSource<K>(
  dependencies: Map<K, Set<string>>,
  key: K,
  required: readonly string[],
): void {
  const current = dependencies.get(key);
  if (!current) dependencies.set(key, new Set(required));
  else if (!required.length) current.clear();
  else if (current.size) for (const name of required) current.add(name);
}

/**
 * 返回已部署阵容的职能及来源。stats 可传入已按实际层数和人数计算的盟约状态。
 * 有当前赛季 Box 时，标记依赖未借本体的来源。替补继承盟约与特质，原型的技能和
 * 部署/攻击条件未在赛季职能表中收录，所以这类来源需确认。无条件装备仍然生效。
 */
export function diagnoseLineup(
  ops: readonly PlanOp[],
  stats: readonly CovenantStat[] = covenantStats(ops),
  box?: Readonly<OperatorBox>,
): LineupDiagnostics {
  const providers = new Map<CombatRole, Set<string>>();
  const roleDependencies = new Map<CombatRole, Set<string>>();
  const elementDependencies = new Map<ElementalCondition, Set<string>>();
  const artsMembers = new Set<string>();
  const conditionalElements: Operator[] = [];
  const activeBox = hasBoxEntries(box) ? box : undefined;
  const requiredBody = (op: Operator): string[] =>
    activeBox && isBoxSubstitute(op, activeBox) ? [op.name] : [];

  function add(
    role: CombatRole,
    source: string,
    required: string[] = [],
  ): void {
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
        recordSource(elementDependencies, element, []);
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
          eq.roleTrigger || role === '阻挡' ? body : [],
        );
      }
      for (const element of eq.inflictsElements ?? [])
        recordSource(elementDependencies, element, eq.roleTrigger ? body : []);
    }
  }

  for (const op of conditionalElements) {
    const sources = (op.elementalPrerequisites ?? [])
      .map((element) => elementDependencies.get(element))
      .filter((source): source is Set<string> => source !== undefined);
    if (!sources.length) continue;
    // 可以任选一种前置元素；有一个可靠来源就不必为前置干员借用。
    const required = requiredBody(op);
    if (sources.every((source) => source.size > 0)) {
      for (const source of sources) required.push(...source);
    }
    add('元素输出', op.name, required);
  }

  const entries: RoleCoverageEntry[] = COMBAT_ROLES.map((meta) => {
    const list = [...(providers.get(meta.label) ?? [])];
    const substituteOnly = !!roleDependencies.get(meta.label)?.size;
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
      operators: [...(roleDependencies.get(entry.role) ?? [])].map((name) => ({
        name,
        backupOperator: OPERATOR[name]?.backupOperator,
      })),
    }));
  return {
    entries,
    missingEssential: entries.filter(
      (entry) => entry.essential && !entry.providers.length,
    ),
    coveredCount: entries.filter(
      (entry) => entry.providers.length && !entry.substituteOnly,
    ).length,
    substituteRisks,
  };
}
