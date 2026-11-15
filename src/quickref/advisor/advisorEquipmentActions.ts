import { EQUIPMENT } from '../../../data/index.ts';
import { MAX_EQ } from '../../lib/planner.ts';
import { MAX_RECORDED_EQUIPMENT } from '../../lib/advisorState.ts';
import { type AdvisorRun } from '../../lib/advisorTypes.ts';
import { type AdvisorChange } from './advisorSession.ts';
const equipmentByName = new Map(EQUIPMENT.map((equipment) => [equipment.name, equipment]));
/** 在同一草稿中分配装备，添加并装备与仓库转移共用栏位/进阶规则。 */
function assignEquipmentInDraft(draft: AdvisorRun, id: string, holder: string): string | void {
  const item = draft.equipment.find((equipment) => equipment.id === id);
  if (!item || (holder && !draft.operators.some((operator) => operator.name === holder))) {
    return '未找到装备或携带者';
  }
  if (holder) {
    const heldEquipment = draft.equipment.filter(
      (equipment) => equipment.id !== id && equipment.holder === holder,
    );
    const matchingEquipment = heldEquipment.find((equipment) => equipment.name === item.name);
    if (matchingEquipment) {
      if (
        matchingEquipment.advanced ||
        item.advanced ||
        !equipmentByName.get(item.name)?.advanced
      ) {
        return '这名干员已携带同名装备，无法再进阶';
      }
      matchingEquipment.advanced = true;
      draft.equipment = draft.equipment.filter((equipment) => equipment.id !== id);
      return;
    }
    if (heldEquipment.length >= MAX_EQ) {
      return `${holder}已携带2件装备，请先腾出栏位`;
    }
  }
  item.holder = holder;
}
/** 装备变更共享会话事务：失败不留半件装备，成功只产生一次撤销快照。 */
export function createAdvisorEquipmentActions(change: AdvisorChange) {
  /** 记录一件装备，可直接指定携带者；整次操作可一次撤销，失败时不留下多余装备。 */
  function addEquipment(name: string, holder = ''): boolean {
    if (!equipmentByName.has(name)) {
      return false;
    }
    return change(holder ? `${holder}已装备${name}` : `已记录${name}，可选择携带者`, (draft) => {
      if (draft.equipment.length >= MAX_RECORDED_EQUIPMENT) {
        return `最多记录${MAX_RECORDED_EQUIPMENT}件装备，请先移除多余记录`;
      }
      const id = crypto.randomUUID();
      draft.equipment.push({ id, name, holder: '', advanced: false });
      if (holder) {
        return assignEquipmentInDraft(draft, id, holder);
      }
    });
  }
  /** 指定实际携带者；两件相同的初始装备合并为一件进阶装备，不超过两格。 */
  function assignEquipment(id: string, holder: string): boolean {
    return change(holder ? `装备已分配给${holder}` : '装备已放回仓库', (draft) =>
      assignEquipmentInDraft(draft, id, holder),
    );
  }
  function setEquipmentAdvanced(id: string, advanced: boolean): void {
    change('已更新装备进阶状态', (draft) => {
      const item = draft.equipment.find((equipment) => equipment.id === id);
      if (item) {
        item.advanced = advanced && !!equipmentByName.get(item.name)?.advanced;
      }
    });
  }
  function removeEquipment(id: string): void {
    change('已移除装备', (draft) => {
      draft.equipment = draft.equipment.filter((item) => item.id !== id);
    });
  }
  return { addEquipment, assignEquipment, setEquipmentAdvanced, removeEquipment };
}
