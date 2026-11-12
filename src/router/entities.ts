import { EQUIPMENT, OPERATORS, STRATEGIES } from '../../data/index.ts';

export type DetailKind = 'op' | 'eq' | 'st';
export interface DetailSelection {
  kind: DetailKind;
  name: string;
}

/** Public IDs are fixed data identifiers, never positions in a sorted catalogue. */
export const COVENANT_IDS: Readonly<Record<string, string>> = {
  yan: '炎', sargon: '萨尔贡', victoria: '维多利亚', kjerag: '谢拉格', aegir: '阿戈尔',
  siracusa: '叙拉古', kazimierz: '卡西米尔', ursus: '乌萨斯', iberia: '伊比利亚', leithanien: '莱塔尼亚',
  precision: '精准', swift: '迅捷', dexterity: '灵巧', steadfast: '坚守', support: '助力',
  foresight: '远见', miracle: '奇迹', investor: '投资人', assault: '突袭', unyielding: '不屈',
  harmony: '调和', defender: '协防干员', lone: '独行', mastery: '绝技', convergence: '聚合', arcane: '奥术',
};

const covenantIdsByName = new Map(Object.entries(COVENANT_IDS).map(([id, name]) => [name, id]));
export const covenantId = (name: string): string => covenantIdsByName.get(name) ?? '';
export const covenantName = (id: string): string => Object.hasOwn(COVENANT_IDS, id) ? COVENANT_IDS[id] : '';

/** Built-in names map to public slugs; custom IDs remain local to the user's saved plans. */
export function buildId(key: string): string {
  return key === '阿米娅 · 多盟约' ? 'amiya-multi' : covenantId(key) || key;
}
export function buildKey(id: string): string {
  return id === 'amiya-multi' ? '阿米娅 · 多盟约' : covenantName(id) || id;
}

const detailById = new Map<string, DetailSelection>();
const idByDetail = new Map<string, string>();
function registerDetails(kind: DetailKind, entries: readonly { name: string; id: string }[]): void {
  for (const { name, id } of entries) {
    const card = `${kind}-${id}`;
    detailById.set(card, { kind, name });
    idByDetail.set(`${kind}:${name}`, card);
  }
}
registerDetails('op', OPERATORS.map(item => ({ name: item.name, id: item.avatar })));
registerDetails('eq', EQUIPMENT.map(item => ({ name: item.name, id: item.icon })));
registerDetails('st', STRATEGIES.map(item => ({ name: item.name, id: item.portrait })));

/** Returns undefined for unknown entities; callers keep the background page usable. */
export const detailFromId = (id: string): DetailSelection | undefined => detailById.get(id);
export const detailId = (kind: DetailKind, name: string): string | undefined => idByDetail.get(`${kind}:${name}`);
