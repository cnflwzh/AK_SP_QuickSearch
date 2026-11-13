import { computed, readonly, ref } from 'vue';
import { OPERATORS } from '../../../data/operators.ts';

const STORAGE_KEY = 'wsq.numbers.wishlist.v1';
const MAX_TARGETS = 8;
const operatorsByName = new Map(OPERATORS.map(operator => [operator.name, operator]));

function readSavedNames(): string[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(saved)
      ? [...new Set(saved.filter((name): name is string => typeof name === 'string' && operatorsByName.has(name)))].slice(0, MAX_TARGETS)
      : [];
  } catch { return []; }
}

const names = ref(readSavedNames());
const saveFailed = ref(false);
const targets = computed(() => names.value.map(name => operatorsByName.get(name)!));
function save(): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(names.value)); saveFailed.value = false; }
  catch { saveFailed.value = true; }
}

/** 手动待找清单只在本地保存，与已有的阵容规划存档相互独立。 */
export function useWishlist() {
  /** 添加有效干员，已存在或已满时返回 false；不改变已有顺序。 */
  function add(name: string): boolean {
    if (!operatorsByName.has(name) || names.value.includes(name) || names.value.length >= MAX_TARGETS) return false;
    names.value = [...names.value, name];
    save();
    return true;
  }
  function remove(name: string): void {
    names.value = names.value.filter(item => item !== name);
    save();
  }
  return { targets, names: readonly(names), saveFailed: readonly(saveFailed), maxTargets: MAX_TARGETS, add, remove };
}
