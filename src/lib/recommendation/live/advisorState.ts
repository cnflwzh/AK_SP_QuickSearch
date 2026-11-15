/** 局内记录的校验、招募资格和阵容投影，不依赖建议评分或页面状态。 */
import {
ALL_COVENANTS,
EQUIPMENT,
OPERATORS,
STRATEGIES,
isCoreCovenant,
operatorPrice,
type Operator,
} from '../../../../data/index.ts';
import {
MAX_EQ,
MAX_LAYERS,
MAX_OPS,
usesLayers,
type PlanOp,
} from '../../plans/model.ts';
import {
defaultLineupGoal,
inferPrimaryCovenant,
isBanned,
type LineupGoal,
} from '../planning.ts';
import { sanitizeFrontTargets } from './advisorPosition.ts';
import {
ADVISOR_FORMATS,
ADVISOR_MODES,
RESTRICTED_MODE_COVENANTS,
advisorRoundLimit,
type AdvisorFormat,
type AdvisorMode,
} from './advisorRules.ts';
import type { AdvisorRun,RecordedOperator } from './advisorTypes.ts';
export const operatorsByName = new Map(
  OPERATORS.map((operator) => [operator.name, operator]),
);
const EQUIPMENT_BY_NAME = new Map(
  EQUIPMENT.map((equipment) => [equipment.name, equipment]),
);
const STRATEGIES_BY_NAME = new Map(
  STRATEGIES.map((strategy) => [strategy.name, strategy]),
);
/** 只约束输入规模，避免损坏的存档生成过量 DOM；不是游戏内的仓库上限。 */
export const MAX_RECORDED_EQUIPMENT = 64;
export const MAX_SHOP_CANDIDATES = 8;
/** 返回一局空记录，默认从 1 本开始；每次调用得到独立数组。 */
export function newAdvisorRun(): AdvisorRun {
  return {
    level: 1,
    personnelDocumentUsed: false,
    mode: 'unknown',
    format: 'unknown',
    candidateSource: 'shop',
    round: null,
    funds: null,
    acquisitionsThisRound: null,
    layers: {},
    frontTargets: {},
    strategy: '',
    commandAvailable: null,
    mainCovenant: '',
    mainTarget: 0,
    bannedCovenants: [],
    excludedOperators: [],
    operators: [],
    equipment: [],
    shop: [],
  };
}
/** 当前赛季基础上限8；人事部文档使用后变为9，不修改预设构筑的8人格式。 */
export function advisorDeploymentLimit(
  run: Pick<AdvisorRun, 'personnelDocumentUsed'>,
): number {
  return run.personnelDocumentUsed ? 9 : MAX_OPS;
}
/** 星极两张晋升，其余干员三张；输入为数据表中的干员名称。 */
export function eliteCopyCount(name: string): number {
  return name === '星极' ? 2 : 3;
}
function asUnknownRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function boundedPositiveInteger(
  value: unknown,
  fallback: number,
  max: number,
): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(1, Math.min(max, Math.round(value)))
    : fallback;
}
/** 校验外部存档并复制为有效记录；无效名称被丢弃，超出部署/装备栏位的内容移回仓库。 */
export function sanitizeAdvisorRun(value: unknown): AdvisorRun {
  const source = asUnknownRecord(value),
    result = newAdvisorRun();
  result.level = boundedPositiveInteger(source.level, 1, 6);
  result.personnelDocumentUsed = source.personnelDocumentUsed === true;
  result.mode = ADVISOR_MODES.some((mode) => mode.id === source.mode)
    ? (source.mode as AdvisorMode)
    : 'unknown';
  result.format = ADVISOR_FORMATS.some((format) => format.id === source.format)
    ? (source.format as AdvisorFormat)
    : 'unknown';
  if (result.format === 'fast') {
    result.mode = 'restricted';
  }
  result.candidateSource =
    source.candidateSource === 'promotion' ? 'promotion' : 'shop';
  result.round =
    typeof source.round === 'number' && Number.isFinite(source.round)
      ? boundedPositiveInteger(source.round, 1, 14)
      : null;
  if (
    result.round !== null &&
    result.round > (advisorRoundLimit(result.format) ?? 14)
  ) {
    result.round = null;
  }
  result.funds =
    typeof source.funds === 'number' && Number.isFinite(source.funds)
      ? Math.max(0, Math.min(999, Math.round(source.funds)))
      : null;
  result.acquisitionsThisRound =
    typeof source.acquisitionsThisRound === 'number' &&
    Number.isFinite(source.acquisitionsThisRound)
      ? Math.max(0, Math.min(999, Math.round(source.acquisitionsThisRound)))
      : null;
  result.layers = Object.fromEntries(
    Object.entries(asUnknownRecord(source.layers))
      .filter(
        ([name, n]) =>
          ALL_COVENANTS.includes(name) &&
          usesLayers(name) &&
          typeof n === 'number' &&
          Number.isFinite(n),
      )
      .map(([name, n]) => [
        name,
        Math.max(0, Math.min(MAX_LAYERS, Math.round(n as number))),
      ]),
  );
  result.strategy =
    typeof source.strategy === 'string' &&
    STRATEGIES_BY_NAME.has(source.strategy)
      ? source.strategy
      : '';
  result.commandAvailable =
    typeof source.commandAvailable === 'boolean'
      ? source.commandAvailable
      : null;
  result.bannedCovenants = validNames(source.bannedCovenants, (name) =>
    ALL_COVENANTS.includes(name),
  );
  result.excludedOperators = validNames(source.excludedOperators, (name) =>
    operatorsByName.has(name),
  );
  result.mainCovenant =
    typeof source.mainCovenant === 'string' &&
    (isCoreCovenant(source.mainCovenant) || source.mainCovenant === 'mixed') &&
    !result.bannedCovenants.includes(source.mainCovenant)
      ? source.mainCovenant
      : '';
  result.mainTarget =
    source.mainTarget === 3 || source.mainTarget === 6 ? source.mainTarget : 0;
  const names = new Set<string>();
  let deployed = 0;
  for (const item of Array.isArray(source.operators)
    ? source.operators.slice(0, OPERATORS.length)
    : []) {
    const entry = asUnknownRecord(item),
      name = String(entry.name ?? '');
    if (!operatorsByName.has(name) || names.has(name)) {
      continue;
    }
    names.add(name);
    const onField =
      entry.deployed === true && deployed < advisorDeploymentLimit(result);
    if (onField) {
      deployed++;
    }
    const elite = entry.elite === true;
    result.operators.push({
      name,
      elite,
      deployed: onField,
      copies: elite
        ? 1
        : boundedPositiveInteger(entry.copies, 1, eliteCopyCount(name) - 1),
    });
  }
  result.frontTargets = sanitizeFrontTargets(
    source.frontTargets,
    new Set(
      result.operators.filter((item) => item.deployed).map((item) => item.name),
    ),
  );
  const held = new Map<string, Set<string>>();
  const ids = new Set<string>();
  for (const [index, item] of (Array.isArray(source.equipment)
    ? source.equipment.slice(0, MAX_RECORDED_EQUIPMENT)
    : []
  ).entries()) {
    const entry = asUnknownRecord(item),
      name = String(entry.name ?? '');
    if (!EQUIPMENT_BY_NAME.has(name)) {
      continue;
    }
    let id = typeof entry.id === 'string' ? entry.id.slice(0, 100) : '';
    if (!id || ids.has(id)) {
      id = `saved-${index}`;
    }
    while (ids.has(id)) {
      id += '-';
    }
    ids.add(id);
    let holder =
      typeof entry.holder === 'string' && names.has(entry.holder)
        ? entry.holder
        : '';
    const items = held.get(holder) ?? new Set<string>();
    if (holder && (items.size >= MAX_EQ || items.has(name))) {
      holder = '';
    }
    if (holder) {
      items.add(name);
      held.set(holder, items);
    }
    result.equipment.push({
      id,
      name,
      holder,
      advanced:
        entry.advanced === true && !!EQUIPMENT_BY_NAME.get(name)?.advanced,
    });
  }
  result.shop = [
    ...new Set(
      (Array.isArray(source.shop) ? source.shop : []).filter(
        (name): name is string =>
          typeof name === 'string' && operatorsByName.has(name),
      ),
    ),
  ].slice(0, MAX_SHOP_CANDIDATES);
  return result;
}
function validNames(
  value: unknown,
  valid: (name: string) => boolean,
): string[] {
  return Array.isArray(value)
    ? [
        ...new Set(
          value.filter(
            (name): name is string => typeof name === 'string' && valid(name),
          ),
        ),
      ]
    : [];
}
/** 招募池过滤规则；核心缺席整组排除，附加仅全部原生附加缺席时排除，装备不改变招募资格。 */
export function createRecruitmentPool(
  run: Pick<AdvisorRun, 'bannedCovenants' | 'excludedOperators'> &
    Partial<Pick<AdvisorRun, 'mode' | 'format'>>,
): (name: string) => boolean {
  const bans = effectiveBans(run),
    excluded = new Set(run.excludedOperators);
  return (name) =>
    operatorsByName.has(name) && !excluded.has(name) && !isBanned(name, bans);
}
export function effectiveBans(run: {
  bannedCovenants: readonly string[];
  mode?: AdvisorMode;
  format?: AdvisorFormat;
}): ReadonlySet<string> {
  return new Set([
    ...run.bannedCovenants,
    ...(run.mode === 'restricted' || run.format === 'fast'
      ? RESTRICTED_MODE_COVENANTS
      : []),
  ]);
}
/** 显式选择优先，其次场上投入、专属策略、整备区；证据相同则保持未定方向。 */
export function runLineupGoal(run: AdvisorRun): LineupGoal | null {
  if (run.mainCovenant === 'mixed') {
    return null;
  }
  const available = createRecruitmentPool(run);
  const field = deployedLineup(run).filter((slot) => available(slot.name));
  const strategy = STRATEGIES_BY_NAME.get(run.strategy);
  const strategyCovenant =
    strategy &&
    isCoreCovenant(strategy.category) &&
    !effectiveBans(run).has(strategy.category)
      ? strategy.category
      : '';
  const covenant =
    (effectiveBans(run).has(run.mainCovenant) ? '' : run.mainCovenant) ||
    inferPrimaryCovenant(field) ||
    strategyCovenant ||
    inferPrimaryCovenant(
      reserveLineup(run).filter((slot) => available(slot.name)),
    );
  return covenant
    ? {
        ...defaultLineupGoal(covenant),
        ...(run.mainTarget ? { target: run.mainTarget } : {}),
      }
    : null;
}
export function planSlot(run: AdvisorRun, operator: RecordedOperator): PlanOp {
  return {
    name: operator.name,
    elite: operator.elite,
    core: false,
    alt: [],
    eq: run.equipment
      .filter((item) => item.holder === operator.name)
      .map((item) => item.name),
  };
}
/** 转成共用盟约统计的上场输入；整备区由 reserveLineup 单独传入。 */
export function deployedLineup(run: AdvisorRun): PlanOp[] {
  return run.operators
    .filter((operator) => operator.deployed)
    .map((operator) => planSlot(run, operator));
}
/** 整备区携带的装备仍保留，用于远见、奇迹、投资人的人数统计。 */
export function reserveLineup(run: AdvisorRun): PlanOp[] {
  return run.operators
    .filter((operator) => !operator.deployed)
    .map((operator) => planSlot(run, operator));
}
/** 只采用当前数据可证明的价格区间，不把未知折扣当成免费。 */
export function recruitPriceRange(
  run: AdvisorRun,
  operator: Operator,
): {
  min: number;
  max: number;
} {
  if (run.candidateSource === 'promotion') {
    return { min: 0, max: 0 };
  }
  const base = operatorPrice(operator);
  let min = base,
    max = base;
  if (operator.covenants.includes('远见') && !effectiveBans(run).has('远见')) {
    const layers = run.layers['远见'];
    if (layers === undefined) {
      min = Math.max(1, base - 2);
    } else {
      min = max = Math.max(
        1,
        base - Number(layers >= 80) - Number(layers >= 150),
      );
    }
  }
  if (run.strategy === '休露丝' && operator.covenants.includes('谢拉格')) {
    min = Math.min(min, 1);
  }
  return { min, max };
}
