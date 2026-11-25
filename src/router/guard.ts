import type {RouteLocationNormalized, RouteLocationRaw} from 'vue-router';
import {
  DEFAULT_BUILD_ID,
  DEFAULT_COVENANT_ID,
  LEADERS,
} from '../../data/index.ts';
import {covenantName, detailFromId} from './entities.ts';
import {PAGE_PATHS, normalizeQuery, queryText, sameQuery} from './location.ts';

/** 返回规范导航目的地，已规范时不重定向。无效实体通过 notify 提示；保留原路径上的分享片段。 */
export function canonicalRoute(
  to: RouteLocationNormalized,
  advisorEnabled: boolean,
  notify: (notice: string) => void,
): RouteLocationRaw | undefined {
  const card = queryText(to.query, 'card');
  const knownCard = detailFromId(card);
  if (to.name === 'box') {
    if (card && !knownCard) notify('未找到这张卡片。');
    const boxQuery: Record<string, string> = {};
    if (queryText(to.query, 'import') === '1') boxQuery.import = '1';
    if (queryText(to.query, 'q').trim())
      boxQuery.q = queryText(to.query, 'q').trim().slice(0, 200);
    if (knownCard) boxQuery.card = card;
    if (!sameQuery(boxQuery, to.query))
      return {path: to.path, query: boxQuery, hash: to.hash};
    return;
  }
  const tab = to.meta.tab;
  if (!tab) return;
  const id = String(to.params.id ?? '');
  if (tab === 'cv' && (!id || !covenantName(id))) {
    if (id) notify('未找到这个盟约，已打开默认盟约。');
    return {
      path: `${PAGE_PATHS.cv}/${DEFAULT_COVENANT_ID}`,
      query: to.query,
      hash: to.hash,
    };
  }
  if (tab === 'ld' && id && !LEADERS.some((leader) => leader.id === id)) {
    notify('未找到这个 Boss，已返回敌人列表。');
    return {path: PAGE_PATHS.ld, query: to.query, hash: to.hash};
  }
  if (tab === 'bd' && !id)
    return {
      path: `${PAGE_PATHS.bd}/${DEFAULT_BUILD_ID}`,
      query: to.query,
      hash: to.hash,
    };
  if (card && !knownCard) notify('未找到这张卡片。');
  const query = normalizeQuery(tab, to.query, id, to.name === 'build-edit');
  if (tab === 'nu') {
    // 局内抓取成为默认工具时，保留显式的对局速查选择。
    if (advisorEnabled && queryText(to.query, 'tool') === 'match-reference')
      query.tool = 'match-reference';
    else if (!advisorEnabled && query.tool === 'advisor') delete query.tool;
  }
  // Preserve the caller's push/replace intent while canonicalizing default/empty controls.
  if (!sameQuery(query, to.query)) return {path: to.path, query, hash: to.hash};
}
