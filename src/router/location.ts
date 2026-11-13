import type { LocationQuery, LocationQueryRaw } from 'vue-router';
import { LEADERS, LEADER_BATTLEFIELDS, OPERATOR_TYPES, STRATEGY_CATEGORIES } from '../../data/index.ts';
import { covenantId, covenantName, detailFromId } from './entities.ts';

/** The short keys are retained for existing card data attributes and swipe order. */
export const TAB_IDS = ['fx', 'bd', 'cv', 'op', 'eq', 'st', 'ld', 'nu'] as const;
export type TabId = typeof TAB_IDS[number];
export const PAGE_PATHS: Record<TabId, string> = {
  fx: '/overview', bd: '/builds', cv: '/covenants', op: '/operators',
  eq: '/equipment', st: '/strategies', ld: '/leaders', nu: '/numbers',
};
export const PAGE_LABELS: Record<TabId, string> = {
  fx: '速览', bd: '流派', cv: '盟约详情', op: '干员', eq: '装备', st: '策略', ld: '领袖', nu: '小工具',
};
export const DIFFICULTIES = ['standard', 'danger', 'desperate', 'ultimate'] as const;
export const TRIGGER_IDS: Readonly<Record<string, string>> = {
  rest: '进入休整期', acquire: '获得时', refresh: '刷新时', sell: '售出时',
  ready: '休整期结束', start: '战斗开始', battle: '战斗中', end: '战斗结束',
};
export const TYPE_IDS: Readonly<Record<string, string>> = {
  stacking: OPERATOR_TYPES[0], once: OPERATOR_TYPES[1], combat: OPERATOR_TYPES[2],
  preparation: OPERATOR_TYPES[3], specialization: OPERATOR_TYPES[4],
};
export const CATEGORY_IDS = ['', 'stacking', 'elite', 'recruit', 'economy', 'equipment', 'survival', 'faction'] as const;

/** Repeated URL parameters are interpreted consistently by taking the first value. */
export function queryText(query: LocationQuery | LocationQueryRaw, key: string): string {
  const value = query[key];
  return String((Array.isArray(value) ? value[0] : value) ?? '');
}
export function boundedInteger(value: string, fallback: number, min: number, max: number): number {
  if (!value.trim() || !Number.isFinite(Number(value))) return fallback;
  return Math.max(min, Math.min(max, Math.round(Number(value))));
}
export function idForLabel(labels: Readonly<Record<string, string>>, label: string): string {
  return Object.entries(labels).find(([, value]) => value === label)?.[0] ?? '';
}

/** Normalizes external input and omits defaults. This pure codec has no browser/storage side effects. */
export function normalizeQuery(tab: TabId, query: LocationQueryRaw, entityId = '', editing = false): LocationQueryRaw {
  const normalized: LocationQueryRaw = {};
  const read = (key: string) => queryText(query, key);
  const keep = (key: string, values: readonly string[]) => {
    if (values.includes(read(key))) normalized[key] = read(key);
  };
  const tier = () => {
    const value = boundedInteger(read('tier'), 0, 0, 6);
    if (value) normalized.tier = String(value);
  };
  const covenant = () => {
    const name = covenantName(read('covenant'));
    if (name) normalized.covenant = covenantId(name);
  };
  if (tab === 'fx') keep('group', ['core', 'addon']);
  if (tab === 'op') {
    tier(); covenant(); keep('trigger', Object.keys(TRIGGER_IDS)); keep('type', Object.keys(TYPE_IDS));
    keep('elite', ['1']);
  }
  if (tab === 'eq') {
    if (read('group') === 'combo') normalized.group = 'combo'; else tier();
  }
  if (tab === 'st') keep('category', CATEGORY_IDS.slice(1, STRATEGY_CATEGORIES.length));
  if (tab === 'ld') {
    keep('difficulty', DIFFICULTIES.filter(value => value !== 'danger'));
  }
  if (tab === 'ld' && entityId) {
    const leader = LEADERS.find(item => item.id === entityId);
    if (leader?.hiddenStage) keep('round', ['hidden']);
    keep('view', ['routes']);
    keep('map', LEADER_BATTLEFIELDS.map(map => map.id).filter(id => id !== '01'));
    keep('side', ['all', 'right']);
    const layout = read('round') === 'hidden' ? leader?.hiddenLayout ?? leader?.layout : leader?.layout;
    keep('skill', layout?.zones.slice(1).map(zone => zone.label) ?? []);
  }
  if (tab === 'nu') {
    // 路由只标识工具子页；计算输入和本局记录由工具维护，不进入导航历史。
    keep('tool', ['advisor', 'recruit', 'bounty']);
  }
  if (tab === 'bd') {
    keep('panel', editing ? ['share', 'compare', 'import', 'backup', 'closed'] : ['share', 'import', 'backup', 'closed']);
    if (editing && read('compare')) normalized.compare = read('compare').slice(0, 100);
    if (editing) {
      const poolTier = boundedInteger(read('poolTier'), 0, 0, 6);
      if (poolTier) normalized.poolTier = String(poolTier);
      if (covenantName(read('poolCovenant'))) normalized.poolCovenant = read('poolCovenant');
      if (read('poolQuery').trim()) normalized.poolQuery = read('poolQuery').trim().slice(0, 100);
      keep('strategyCategory', CATEGORY_IDS.slice(1));
    }
  }
  if (read('q').trim()) normalized.q = read('q').trim().slice(0, 200);
  if (detailFromId(read('card'))) normalized.card = read('card');
  return normalized;
}

export function sameQuery(left: LocationQueryRaw, right: LocationQueryRaw): boolean {
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key => left[key] === right[key]);
}
