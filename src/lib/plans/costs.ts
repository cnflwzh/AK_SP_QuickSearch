/** 方案费用与装备提示；不参与推荐排序或保存状态。 */
import {
  EQUIP,
  EQUIPMENT_COMBOS,
  OPERATOR,
  operatorEliteCopies,
  operatorPrice,
} from '../../../data/index.ts';
import {covenantsOf} from './covenants.ts';
import {type PlanOp} from './model.ts';
/* ---------- 费用、装备 ---------- */

export const copiesFor = (slot: PlanOp): number =>
  slot.elite ? operatorEliteCopies(slot.name) : 1;

export interface PlanCost {
  recruit: number;
  equipment: number;
  maxTier: number;
  elites: number;
  copies: number;
}
export function planCost(ops: readonly PlanOp[]): PlanCost {
  let recruit = 0,
    equipment = 0,
    maxTier = 0,
    elites = 0,
    copies = 0;
  for (const slot of ops) {
    const op = OPERATOR[slot.name];
    if (!op) continue;
    const n = copiesFor(slot);
    recruit += operatorPrice(op) * n;
    copies += n;
    maxTier = Math.max(maxTier, op.tier);
    if (slot.elite) elites++;
    for (const name of slot.eq) {
      equipment += EQUIP[name]?.price ?? 0;
      maxTier = Math.max(maxTier, EQUIP[name]?.tier ?? 0);
    }
  }
  return {recruit, equipment, maxTier, elites, copies};
}

export interface EquipNote {
  op: string;
  kind: 'adv' | 'combo' | 'grant';
  text: string;
  result?: string;
}
/** 同一名干员身上的装备互动：同名进阶、两件组合、变形同构体赋予盟约 */
export function equipNotes(ops: readonly PlanOp[]): EquipNote[] {
  const notes: EquipNote[] = [];
  for (const slot of ops) {
    const [a, b] = slot.eq;
    if (a && a === b && EQUIP[a]?.advanced)
      notes.push({
        op: slot.name,
        kind: 'adv',
        text: `${a} ×2 → 进阶`,
        result: EQUIP[a].advanced!,
      });
    const combo =
      a && b
        ? EQUIPMENT_COMBOS.find(
            ([x, y]) => (x === a && y === b) || (x === b && y === a),
          )
        : undefined;
    if (combo)
      notes.push({
        op: slot.name,
        kind: 'combo',
        text: `${a} + ${b} → ${combo[2]}`,
        result: EQUIP[combo[2]]?.effect,
      });
    const companion = slot.eq.find(
      (eqName) => EQUIP[eqName]?.mechanics?.grantsCompanionCovenant,
    );
    if (companion) {
      for (const c of covenantsOf(slot).granted)
        notes.push({
          op: slot.name,
          kind: 'grant',
          text: `${companion} → 获得【${c}】`,
        });
    }
  }
  return notes;
}
