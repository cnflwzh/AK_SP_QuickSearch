import {
  COMBAT_ROLES,
  EQUIP,
  OPERATOR,
  type CombatRole,
} from '../../../data/index.ts';
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

/**
 * 检查规划器阵容的实战职能覆盖：同时计入干员自身与已配装备提供的实战职能，
 * 用于在配队阶段及时发现缺对空、缺治疗、缺阻挡等短板。
 */
export function diagnoseLineup(ops: readonly PlanOp[]): LineupDiagnostics {
  const providersByRole = new Map<CombatRole, Set<string>>();
  for (const meta of COMBAT_ROLES) {
    providersByRole.set(meta.label, new Set());
  }

  for (const slot of ops) {
    const op = OPERATOR[slot.name];
    if (op?.roles) {
      for (const role of op.roles) {
        providersByRole.get(role)?.add(op.name);
      }
    }
    for (const eqName of slot.eq) {
      const eq = EQUIP[eqName];
      if (!eq?.roles) continue;
      for (const role of eq.roles) {
        providersByRole.get(role)?.add(`${slot.name}·${eq.name}`);
      }
    }
  }

  const entries: RoleCoverageEntry[] = COMBAT_ROLES.map((meta) => ({
    role: meta.label,
    id: meta.id,
    desc: meta.desc,
    essential: ESSENTIAL_ROLES.has(meta.label),
    providers: [...(providersByRole.get(meta.label) ?? [])],
  }));

  const missingEssential = entries.filter(
    (entry) => entry.essential && entry.providers.length === 0,
  );
  const coveredCount = entries.filter(
    (entry) => entry.providers.length > 0,
  ).length;

  return {entries, missingEssential, coveredCount};
}
