import {
  COVENANT_IDS,
  EQUIPMENT,
  MIXED_BUILD_IDS,
  OPERATORS,
  STRATEGIES,
} from '../../data/index.ts';

export {COVENANT_IDS, MIXED_BUILD_IDS};

export type DetailKind = 'op' | 'eq' | 'st';
export interface DetailSelection {
  kind: DetailKind;
  name: string;
}

const covenantIdsByName = new Map(
  Object.entries(COVENANT_IDS).map(([id, name]) => [name, id]),
);
const mixedBuildIdsByName = new Map(
  Object.entries(MIXED_BUILD_IDS).map(([id, name]) => [name, id]),
);
export const covenantId = (name: string): string =>
  covenantIdsByName.get(name) ?? '';
export const covenantName = (id: string): string =>
  Object.hasOwn(COVENANT_IDS, id) ? COVENANT_IDS[id] : '';

/** Built-in names map to public slugs; custom IDs remain local to the user's saved plans. */
export function buildId(key: string): string {
  return mixedBuildIdsByName.get(key) || covenantId(key) || key;
}
export function buildKey(id: string): string {
  return (
    (Object.hasOwn(MIXED_BUILD_IDS, id) ? MIXED_BUILD_IDS[id] : '') ||
    covenantName(id) ||
    id
  );
}

const detailById = new Map<string, DetailSelection>();
const idByDetail = new Map<string, string>();
function registerDetails(
  kind: DetailKind,
  entries: readonly {name: string; id: string}[],
): void {
  for (const {name, id} of entries) {
    const card = `${kind}-${id}`;
    detailById.set(card, {kind, name});
    idByDetail.set(`${kind}:${name}`, card);
  }
}
registerDetails(
  'op',
  OPERATORS.map((item) => ({name: item.name, id: item.avatar})),
);
registerDetails(
  'eq',
  EQUIPMENT.map((item) => ({name: item.name, id: item.icon})),
);
registerDetails(
  'st',
  STRATEGIES.map((item) => ({name: item.name, id: item.portrait})),
);

/** Returns undefined for unknown entities; callers keep the background page usable. */
export const detailFromId = (id: string): DetailSelection | undefined =>
  detailById.get(id);
export const detailId = (kind: DetailKind, name: string): string | undefined =>
  idByDetail.get(`${kind}:${name}`);
