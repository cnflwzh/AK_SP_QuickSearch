import { computed, readonly, ref } from 'vue';
import { ALL_COVENANTS, EQUIPMENT, STRATEGIES, isCoreCovenant } from '../../../data/index.ts';
import { covenantStats, MAX_EQ, MAX_OPS } from '../../lib/planner.ts';
import {
  deployedLineup, eliteCopyCount, MAX_RECORDED_EQUIPMENT, MAX_SHOP_CANDIDATES,
  newAdvisorRun, operatorsByName, recommendRecruits, sanitizeAdvisorRun, createRecruitmentPool, reserveLineup, runLineupGoal,
  type AdvisorRun, type RecordedOperator,
} from '../../lib/runAdvisor.ts';

const STORAGE_KEY = 'wsq.tools.advisor.v1';
const equipmentByName = new Map(EQUIPMENT.map(item => [item.name, item]));
const strategyNames = new Set(STRATEGIES.map(item => item.name));
const saveFailed = ref(false);
function load(): AdvisorRun {
  try { return sanitizeAdvisorRun(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')); }
  catch { return newAdvisorRun(); }
}
const run = ref<AdvisorRun>(load());
const undoSnapshot = ref<AdvisorRun | null>(null);
const notice = ref('');
const lineup = computed(() => deployedLineup(run.value));
const covenants = computed(() => covenantStats(lineup.value, {}, reserveLineup(run.value)));
const goal = computed(() => runLineupGoal(run.value));
const unavailableNames = computed(() => {
  const available = createRecruitmentPool(run.value);
  return [...operatorsByName.keys()].filter(name => !available(name));
});
const poolConflicts = computed(() => run.value.operators.filter(operator => unavailableNames.value.includes(operator.name)).map(operator => operator.name));
const recommendations = computed(() => recommendRecruits(run.value));
const deployed = computed(() => run.value.operators.filter(operator => operator.deployed));
const reserve = computed(() => run.value.operators.filter(operator => !operator.deployed));

function clone(value: AdvisorRun): AdvisorRun {
  return { ...value, operators: value.operators.map(operator => ({ ...operator })), equipment: value.equipment.map(item => ({ ...item })),
    shop: [...value.shop], bannedCovenants: [...value.bannedCovenants], excludedOperators: [...value.excludedOperators] };
}
function save(): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(run.value)); saveFailed.value = false; }
  catch { saveFailed.value = true; }
}
/** 所有修改都在草稿中完成；返回错误文字时不写入，也不覆盖上一条可撤销操作。 */
function change(message: string, edit: (draft: AdvisorRun) => string | void): boolean {
  const draft = clone(run.value);
  const error = edit(draft);
  if (error) { notice.value = error; return false; }
  undoSnapshot.value = clone(run.value);
  run.value = draft;
  notice.value = message;
  save();
  return true;
}

/** 在同一草稿中分配装备，添加并装备与仓库转移共用栏位/进阶规则。 */
function assignInDraft(draft: AdvisorRun, id: string, holder: string): string | void {
  const item = draft.equipment.find(equipment => equipment.id === id);
  if (!item || holder && !draft.operators.some(operator => operator.name === holder)) return '未找到装备或携带者';
  if (holder) {
    const held = draft.equipment.filter(equipment => equipment.id !== id && equipment.holder === holder);
    const same = held.find(equipment => equipment.name === item.name);
    if (same) {
      if (same.advanced || item.advanced || !equipmentByName.get(item.name)?.advanced) return '这名干员已携带同名装备，无法再进阶';
      same.advanced = true;
      draft.equipment = draft.equipment.filter(equipment => equipment.id !== id);
      return;
    }
    if (held.length >= MAX_EQ) return `${holder}已携带2件装备，请先腾出栏位`;
  }
  item.holder = holder;
}

/** 局内工具独立单例；动作立即保存，离开页面无需依赖计时器或页面退出事件。 */
export function useRunAdvisor() {
  /** 录入一张有效干员；空位默认上场，满员或指定 reserve 时入整备区；达到张数后自动晋升。 */
  function recruit(name: string, destination: 'auto' | 'reserve' = 'auto'): boolean {
    if (!operatorsByName.has(name)) return false;
    return change(`已记录${name}`, draft => {
      if (!createRecruitmentPool(draft)(name)) return `${name}不在本局招募池，请先调整禁用设置`;
      const existing = draft.operators.find(operator => operator.name === name);
      if (existing?.elite) return `${name}已是精锐，无需再记录同名合成`;
      if (existing) {
        existing.copies++;
        if (existing.copies >= eliteCopyCount(name)) { existing.elite = true; existing.copies = 1; }
      } else {
        draft.operators.push({ name, copies: 1, elite: false, deployed: destination === 'auto' && draft.operators.filter(operator => operator.deployed).length < MAX_OPS });
      }
      draft.shop = draft.shop.filter(candidate => candidate !== name);
    });
  }
  function editOperator(name: string, message: string, edit: (operator: RecordedOperator) => void): void {
    if (!run.value.operators.some(operator => operator.name === name)) return;
    change(message, draft => { edit(draft.operators.find(operator => operator.name === name)!); });
  }
  /** 切换上场状态；满员时必须显式传入替换对象，原对象与其装备一起移入整备区。 */
  function setDeployment(name: string, active: boolean, replace = ''): boolean {
    return change(`${name}${active ? '已上场' : '已移入整备区'}`, draft => {
      const operator = draft.operators.find(item => item.name === name);
      if (!operator) return '未找到这名干员';
      const onField = draft.operators.filter(item => item.deployed);
      if (active && !operator.deployed && onField.length >= MAX_OPS) {
        const outgoing = onField.find(item => item.name === replace);
        if (!outgoing) return '场上已有8名，请先选择要换下的干员';
        outgoing.deployed = false;
      }
      operator.deployed = active;
    });
  }
  /** 删除持有记录，装备归还仓库，避免误删随身装备。 */
  function removeOperator(name: string): void {
    change(`已移除${name}，携带装备退回仓库`, draft => {
      draft.operators = draft.operators.filter(operator => operator.name !== name);
      draft.equipment.forEach(item => { if (item.holder === name) item.holder = ''; });
    });
  }
  function setCopies(name: string, copies: number): void {
    if (!Number.isFinite(copies)) return;
    editOperator(name, `已更新${name}张数`, operator => {
      if (!operator.elite) operator.copies = Math.max(1, Math.min(eliteCopyCount(name) - 1, Math.round(copies)));
    });
  }
  function setElite(name: string, elite: boolean): void {
    editOperator(name, `已更新${name}精锐状态`, operator => { operator.elite = elite; operator.copies = 1; });
  }
  function setLevel(level: number): void {
    if (!Number.isInteger(level) || level < 1 || level > 6 || level === run.value.level) return;
    change(`当前${level}本`, draft => { draft.level = level; });
  }
  function setStrategy(name: string): void {
    if (name && !strategyNames.has(name)) return;
    change(name ? `已选策略${name}` : '已清除策略', draft => { draft.strategy = name; });
  }
  /** 手动选主盟约；空值恢复自动，mixed 保持混搭；切换方向同时恢复默认人数目标。 */
  function setMainCovenant(name: string): void {
    if ((name && name !== 'mixed' && !isCoreCovenant(name)) || run.value.bannedCovenants.includes(name)) return;
    change('已更新本局主轴', draft => { draft.mainCovenant = name; draft.mainTarget = 0; });
  }
  /** 仅改变推荐目标，不改变游戏盟约的真实激活与强化条件。 */
  function setMainTarget(target: number): void {
    if (target !== 0 && target !== 3 && target !== 6) return;
    change('已更新主轴目标', draft => { draft.mainTarget = target; });
  }
  /** 按开局简报记录缺席盟约；保留持有记录并提示冲突，不擅自出售或删除。 */
  function toggleBannedCovenant(name: string): void {
    if (!ALL_COVENANTS.includes(name)) return;
    change('已更新本局禁用盟约', draft => {
      draft.bannedCovenants = draft.bannedCovenants.includes(name) ? draft.bannedCovenants.filter(item => item !== name) : [...draft.bannedCovenants, name];
      if (draft.bannedCovenants.includes(draft.mainCovenant)) { draft.mainCovenant = ''; draft.mainTarget = 0; }
    });
  }
  /** 单独排除禁用干员或未选入本局的可选干员；再次选择可恢复。 */
  function toggleExcludedOperator(name: string): void {
    if (!operatorsByName.has(name)) return;
    change('已更新本局干员池', draft => {
      draft.excludedOperators = draft.excludedOperators.includes(name) ? draft.excludedOperators.filter(item => item !== name) : [...draft.excludedOperators, name];
    });
  }
  /** 记录一件装备，可直接指定携带者；整次操作可一次撤销，失败时不留下多余装备。 */
  function addEquipment(name: string, holder = ''): boolean {
    if (!equipmentByName.has(name)) return false;
    return change(holder ? `${holder}已装备${name}` : `已记录${name}，可选择携带者`, draft => {
      if (draft.equipment.length >= MAX_RECORDED_EQUIPMENT) return `最多记录${MAX_RECORDED_EQUIPMENT}件装备，请先移除多余记录`;
      const id = crypto.randomUUID();
      draft.equipment.push({ id, name, holder: '', advanced: false });
      if (holder) return assignInDraft(draft, id, holder);
    });
  }
  /** 指定实际携带者；两件相同的初始装备合并为一件进阶装备，不超过两格。 */
  function assignEquipment(id: string, holder: string): boolean {
    return change(holder ? `装备已分配给${holder}` : '装备已放回仓库', draft => assignInDraft(draft, id, holder));
  }
  function setEquipmentAdvanced(id: string, advanced: boolean): void {
    change('已更新装备进阶状态', draft => {
      const item = draft.equipment.find(equipment => equipment.id === id);
      if (item) item.advanced = advanced && !!equipmentByName.get(item.name)?.advanced;
    });
  }
  function removeEquipment(id: string): void {
    change('已移除装备', draft => { draft.equipment = draft.equipment.filter(item => item.id !== id); });
  }
  /** 添加当前商店候选；重复、无效或已满时返回 false，不改变持有阵容。 */
  function addShopCandidate(name: string): boolean {
    if (!operatorsByName.has(name) || run.value.shop.includes(name)) return false;
    return change(`已将${name}加入本次商店`, draft => {
      if (!createRecruitmentPool(draft)(name)) return `${name}不在本局招募池，请先调整禁用设置`;
      if (draft.shop.length >= MAX_SHOP_CANDIDATES) return `最多比较${MAX_SHOP_CANDIDATES}名候选`;
      draft.shop.push(name);
    });
  }
  function removeShopCandidate(name: string): void {
    change('已更新商店候选', draft => { draft.shop = draft.shop.filter(candidate => candidate !== name); });
  }
  function clearShop(): void { change('已清空商店，恢复目标推荐', draft => { draft.shop = []; }); }
  /** 清空本局并立即保存；上一局可用 undo 恢复，直到下一次编辑。 */
  function reset(): void { change('已新开一局，可撤销恢复上一局', draft => { Object.assign(draft, newAdvisorRun()); }); }
  /** 恢复最近一次成功编辑前的完整记录，随后清除撤销快照并保存。 */
  function undo(): void {
    if (!undoSnapshot.value) return;
    run.value = undoSnapshot.value;
    undoSnapshot.value = null;
    notice.value = '已撤销上一步';
    save();
  }
  return {
    run: readonly(run), deployed, reserve, covenants, recommendations, goal, unavailableNames, poolConflicts,
    notice: readonly(notice), saveFailed: readonly(saveFailed), canUndo: computed(() => undoSnapshot.value !== null),
    recruit, setDeployment, removeOperator, setCopies, setElite, setLevel, setStrategy,
    setMainCovenant, setMainTarget, toggleBannedCovenant, toggleExcludedOperator,
    addEquipment, assignEquipment, setEquipmentAdvanced, removeEquipment,
    addShopCandidate, removeShopCandidate, clearShop, reset, undo,
  };
}
