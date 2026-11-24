import {OPERATORS, SEASON_META, STRATEGY} from '../../../data/index.ts';
import {
  MAX_NOTE,
  MAX_OPS,
  MAX_STAGE_ROUND,
  cleanStrategyAlternates,
  newSlot,
  samePlan,
  validStageRange,
  type Plan,
  type PlanOp,
  type PlanStage,
} from './model.ts';

/** 本地只保存攻略展示所需的内容。资源名称来自该攻略对应的赛季版本。 */
interface GuideOperator {
  id: string;
  name: string;
  skill: string;
  module: string;
  elite: boolean;
}
interface GuideLineup {
  from: number | string;
  to: number | string;
  operators: GuideOperator[];
  equipment: string[];
  bonds: string[];
  idea: string;
}
export interface SklandGuide {
  id: string;
  title: string;
  author: string;
  season: string;
  version: string;
  seasonLabel: string;
  editedAt: string;
  scope: string;
  strategies: string[];
  formation: GuideLineup;
  rounds: GuideLineup[];
}

const guideIdPattern = /^\d{1,24}$/;
const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const string = (v: unknown): string => (typeof v === 'string' ? v : '');
function list(v: unknown): unknown[] {
  if (!Array.isArray(v)) throw new Error('森空岛攻略数据不完整，请稍后重试。');
  return v;
}
const names = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string');
const isRound = (v: unknown): v is number | string =>
  (typeof v === 'number' && Number.isFinite(v)) || typeof v === 'string';
// 无效的原文回合仍可离线阅读，但不能成为可编辑阶段。
function sourceRound(value: unknown): number | string {
  if (typeof value === 'number') return value;
  if (typeof value === 'string')
    return /^\d+$/.test(value) && Number.isSafeInteger(Number(value))
      ? Number(value)
      : value;
  return value == null ? 0 : '未知';
}
function isLineup(value: unknown): value is GuideLineup {
  const v = object(value);
  return (
    isRound(v.from) &&
    isRound(v.to) &&
    typeof v.idea === 'string' &&
    names(v.equipment) &&
    names(v.bonds) &&
    Array.isArray(v.operators) &&
    v.operators.every((raw) => {
      const op = object(raw);
      return (
        typeof op.id === 'string' &&
        !!op.id &&
        typeof op.name === 'string' &&
        typeof op.skill === 'string' &&
        typeof op.module === 'string' &&
        typeof op.elite === 'boolean'
      );
    })
  );
}
/** 校验来自本地存储和备份的攻略快照，避免无效来源触发请求。 */
export function isSklandGuide(value: unknown): value is SklandGuide {
  const v = object(value);
  return (
    guideIdPattern.test(string(v.id)) &&
    !!string(v.title) &&
    [v.author, v.season, v.version, v.seasonLabel, v.editedAt, v.scope].every(
      (x) => typeof x === 'string',
    ) &&
    names(v.strategies) &&
    isLineup(v.formation) &&
    Array.isArray(v.rounds) &&
    v.rounds.every(isLineup)
  );
}

/** 从分享文案提取官方详情链接，只返回十进制字符串，避免长 ID 丢失精度。 */
export function sklandIdFromText(text: string): string | null {
  for (const [link] of text
    .replaceAll('https\\:', 'https:')
    .matchAll(/https?:\/\/[^\s<>"'，。；、）】)\]]+/gi)) {
    try {
      const url = new URL(link);
      if (
        url.origin !== 'https://game.skland.com' ||
        url.pathname.replace(/\/$/, '') !== '/arknights/stronghold-guide/detail'
      )
        continue;
      const id = url.searchParams.get('guideId') ?? '';
      if (guideIdPattern.test(id)) return id;
    } catch {
      /* 继续检查文案中的下一个链接。 */
    }
  }
  return null;
}
export const sklandUrl = (id: string): string =>
  'https://game.skland.com/arknights/stronghold-guide/detail?guideId=' +
  encodeURIComponent(id);

/** 将公开详情及其中的资源字典转为离线快照。详情下架、字段不完整或 ID 不符时抛错。 */
export function parseSklandResponse(payload: unknown, id: string): SklandGuide {
  const response = object(payload);
  const data = object(response.data);
  const entry = object(data.guide);
  const guide = object(entry.guide);
  if (response.code !== 0 || entry.invalid || guide.guideId !== id)
    throw new Error('无法读取这篇公开攻略，请检查链接或前往森空岛查看。');
  const season = string(guide.seasonId),
    version = string(guide.versionId);
  const seasonData = object(object(data.seasonResourceMap)[season]);
  const resources = object(object(seasonData.versionResourceMap)[version]);
  if (!Object.keys(resources).length)
    throw new Error('这篇攻略的赛季资源暂时不可用，请稍后重试。');
  const resource = (kind: string, key: string) =>
    object(object(resources[kind])[key]);
  const label = (kind: string, key: unknown) =>
    string(resource(kind, string(key)).name) || string(key);
  const loadoutName = (entries: unknown, key: string, id: string) =>
    string(
      object(
        Array.isArray(entries) && entries.find((x) => object(x)[key] === id),
      ).name,
    ) || id;
  function lineup(tab: Record<string, unknown>): GuideLineup {
    const bonds = object(tab.activeBonds);
    return {
      from: sourceRound(tab.startRound),
      to: sourceRound(tab.endRound),
      operators: list(tab.recChars).map((value) => {
        const slot = object(value),
          id = string(slot.charId),
          char = resource('chars', id);
        return {
          id,
          name: string(char.name) || id,
          elite: Number(slot.mergeLevel) > 0,
          skill: loadoutName(char.skills, 'skillId', string(slot.skillId)),
          module: loadoutName(char.modules, 'moduleId', string(slot.moduleId)),
        };
      }),
      equipment: list(tab.recItems ?? []).map((x) =>
        label('items', object(x).itemId),
      ),
      bonds: [
        ...list(bonds.seasonBondIds ?? []),
        ...list(bonds.regularBondIds ?? []),
      ].map((x) => label('bonds', x)),
      idea: string(tab.operationIdea),
    };
  }
  const tabs = list(guide.tabs).map(object);
  const finals = tabs.filter((t) => t.tabType === 1);
  if (
    finals.length !== 1 ||
    tabs.some((t) => t.tabType !== 1 && t.tabType !== 2)
  )
    throw new Error('暂不支持这篇攻略的阵容格式。');
  const tag = object(entry.seasonTag);
  const result: SklandGuide = {
    id,
    title: string(guide.title),
    author: string(object(entry.poster).nickname),
    season,
    version,
    seasonLabel: [string(tag.name), string(tag.phaseName)]
      .filter(Boolean)
      .join(' · '),
    editedAt: String(guide.latestEditAtTs ?? guide.publishAtTs ?? ''),
    scope: string(guide.applicableScope),
    strategies: list(guide.strategyIds ?? []).map(
      (key) =>
        string(resource('strategies', string(key)).initiatorName) ||
        label('strategies', key),
    ),
    formation: lineup(finals[0]),
    rounds: tabs.filter((t) => t.tabType === 2).map(lineup),
  };
  if (!isSklandGuide(result))
    throw new Error('森空岛攻略数据不完整，请稍后重试。');
  return result;
}

/** 用户导入或手动拉取时读取一次公开详情，不携带账号凭据；取消、断网或超时会拒绝。 */
export async function fetchSklandGuide(
  id: string,
  signal: AbortSignal,
): Promise<SklandGuide> {
  if (!guideIdPattern.test(id)) throw new Error('森空岛攻略编号无效。');
  signal.throwIfAborted();
  const request = new AbortController();
  const cancel = () => request.abort(signal.reason);
  signal.addEventListener('abort', cancel, {once: true});
  const timer = setTimeout(
    () => request.abort(new Error('读取森空岛超时，请稍后重试。')),
    20000,
  );
  try {
    const response = await fetch(
      'https://zonai.skland.com/web/v1/game/garrison/guide/info?guideId=' +
        id +
        '&hostNeedEditing=true',
      {signal: request.signal, credentials: 'omit', cache: 'no-store'},
    );
    if (!response.ok) throw new Error('森空岛暂时无法读取，请稍后重试。');
    return parseSklandResponse(await response.json(), id);
  } catch (error) {
    request.signal.throwIfAborted();
    if (error instanceof TypeError || error instanceof SyntaxError)
      throw new Error('无法读取森空岛攻略，请检查网络后重试。', {cause: error});
    throw error;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', cancel);
  }
}

const operatorNames = new Map(OPERATORS.map((op) => [op.avatar, op.name]));
export const isCurrentGuideSeason = (guide: SklandGuide): boolean =>
  SEASON_META.skland?.season === guide.season &&
  SEASON_META.skland.version === guide.version;
/** 按来源顺序返回本赛季可识别的干员，默认读取成型阵容。 */
export function guideCandidates(
  guide: SklandGuide,
  lineup: GuideLineup = guide.formation,
): PlanOp[] {
  if (!isCurrentGuideSeason(guide)) return [];
  const seen = new Set<string>();
  return lineup.operators.flatMap((op) => {
    const name = operatorNames.get(op.id);
    if (!name || seen.has(name)) return [];
    seen.add(name);
    return [{...newSlot(name), elite: op.elite}];
  });
}
/** 提取可编辑阵容，selected 仅筛选成型干员，阶段各自独立；整队装备留在原文快照中。 */
export function guidePlanFields(
  guide: SklandGuide,
  selected?: readonly string[],
) {
  const ops = guideCandidates(guide)
    .filter((op) => !selected || selected.includes(op.name))
    .slice(0, MAX_OPS);
  const strategies = isCurrentGuideSeason(guide)
    ? guide.strategies.filter((name) => Object.hasOwn(STRATEGY, name))
    : [];
  const strategy = strategies[0] ?? '';
  const stages: PlanStage[] = [];
  if (isCurrentGuideSeason(guide)) {
    for (const lineup of guide.rounds) {
      const {from} = lineup;
      const to =
        typeof lineup.to === 'number' && Number.isInteger(lineup.to)
          ? Math.min(lineup.to, MAX_STAGE_ROUND)
          : NaN;
      if (typeof from !== 'number' || !validStageRange(from, to, stages))
        continue;
      stages.push({
        from,
        to,
        ops: guideCandidates(guide, lineup).slice(0, MAX_OPS),
        note: lineup.idea.slice(0, MAX_NOTE),
        layers: {},
      });
    }
    stages.sort((a, b) => a.from - b.from);
  }
  return {
    name: guide.title.slice(0, 16),
    ops,
    strategy,
    strategyAlternates: cleanStrategyAlternates(strategy, strategies),
    note: guide.formation.idea.slice(0, MAX_NOTE),
    layers: {},
    stages,
  };
}

/** 判断本地所有可编辑字段是否仍等于保存时的原文映射，供手动更新时决定是否另存。 */
export function matchesGuidePlan(plan: Plan, guide: SklandGuide): boolean {
  return samePlan(plan, {...plan, ...guidePlanFields(guide)});
}

/** 从旧导入快照恢复当时未进入规划器的内容，保留玩家已改动的字段及原存档 ID。 */
export function migrateLegacyGuidePlan(plan: Plan): Plan {
  const guide = plan.skland;
  if (
    !guide ||
    plan.stages !== undefined ||
    plan.strategyAlternates !== undefined
  )
    return plan;
  const fields = guidePlanFields(guide);
  // 旧版仅取前八人、原文第一项策略、240 字备注，用旧规则逐项识别本地修改。
  const legacyPrimary = guide.strategies[0] ?? '';
  const legacyStrategy =
    isCurrentGuideSeason(guide) && Object.hasOwn(STRATEGY, legacyPrimary)
      ? legacyPrimary
      : '';
  const strategy =
    plan.strategy === legacyStrategy ? fields.strategy : plan.strategy;
  const opsUnchanged = samePlan(plan, {...plan, ops: fields.ops.slice(0, 8)});
  return {
    ...plan,
    ops: opsUnchanged ? fields.ops : plan.ops,
    strategy,
    strategyAlternates: cleanStrategyAlternates(strategy, [
      fields.strategy,
      ...fields.strategyAlternates,
    ]),
    note:
      plan.note === guide.formation.idea.slice(0, 240)
        ? fields.note
        : plan.note,
    stages: fields.stages,
  };
}
