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
import {covenantStats, type CovenantStat} from './covenants.ts';
import type {PlanOp} from './model.ts';

export interface RoleCoverageEntry {
  readonly role: CombatRole;
  readonly id: string;
  readonly desc: string;
  readonly essential: boolean;
  readonly providers: readonly string[];
}

export interface LineupDiagnostics {
  readonly entries: readonly RoleCoverageEntry[];
  readonly missingEssential: readonly RoleCoverageEntry[];
  readonly coveredCount: number;
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

/**
 * 返回已部署阵容的职能及来源。可传入规划器已按实际层数和人数计算的盟约状态。
 * 判断可触发的能力，具体站位、触发概率和技能持续时间由实战决定。
 */
export function diagnoseLineup(
  ops: readonly PlanOp[],
  stats: readonly CovenantStat[] = covenantStats(ops),
): LineupDiagnostics {
  const providers = new Map<CombatRole, Set<string>>();
  const availableElements = new Set<ElementalCondition>();
  const artsMembers = new Set<string>();
  const conditionalElements: Operator[] = [];
  function add(role: CombatRole, source: string): void {
    const list = providers.get(role) ?? new Set<string>();
    list.add(source);
    providers.set(role, list);
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
        availableElements.add(element);
    }
  }

  for (const slot of ops) {
    const op = OPERATOR[slot.name];
    if (!op) continue;
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
          availableElements.add(element);
      }
      add(role, op.name);
    }
    const equipment = slot.eq.map((name) => EQUIP[name]).filter(Boolean);
    const gainsArts =
      artsMembers.has(slot.name) ||
      equipment.some((eq) => eq.grantsArtsOnDamage);
    for (const eq of equipment) {
      if (!canTrigger(eq.roleTrigger, op, gainsArts)) continue;
      for (const role of eq.roles ?? []) {
        if (role === '阻挡' && !op.melee) continue;
        add(role, `${op.name}·${eq.name}`);
      }
      for (const element of eq.inflictsElements ?? [])
        availableElements.add(element);
    }
  }

  for (const op of conditionalElements) {
    if (
      op.elementalPrerequisites?.some((element) =>
        availableElements.has(element),
      )
    ) {
      add('元素输出', op.name);
    }
  }

  const entries = COMBAT_ROLES.map((meta) => ({
    role: meta.label,
    id: meta.id,
    desc: meta.desc,
    essential: ESSENTIAL_ROLES.has(meta.label),
    providers: [...(providers.get(meta.label) ?? [])],
  }));
  return {
    entries,
    missingEssential: entries.filter(
      (entry) => entry.essential && !entry.providers.length,
    ),
    coveredCount: entries.filter((entry) => entry.providers.length).length,
  };
}
