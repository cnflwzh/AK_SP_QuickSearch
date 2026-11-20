/** 领袖卡片的共用格式：能力文本上色、伤害类型配色、简称与相关名词收集。速查页领袖标签与速览卡片共用。 */
import type {
  CounterTag,
  EnemyTerm,
  Leader,
  LeaderDamage,
} from '../../../data/index.ts';
import {esc} from '../ui/dom.ts';

const DAMAGE_CLASS: Readonly<Record<LeaderDamage, string>> = {
  物理: 'phy',
  法术: 'arts',
  真实: 'true',
  侵蚀: 'ero',
  凋亡: 'apo',
  神经: 'neu',
};
export const damageClass = (damage: LeaderDamage): string =>
  DAMAGE_CLASS[damage];

/** 归一化词条名（去掉中文引号以便匹配 “余音” / 余音 等写法） */
export const normalizeTermKey = (raw: string): string =>
  raw.replace(/[“”"「」]/g, '').trim();

/** 能力文本：数字加粗，【技能】 <单位> {状态} 分别上色；若传入已知词条表则标记可点选解释。 */
export const leaderFx = (
  text: string,
  knownTerms?: ReadonlyMap<string, string>,
): string => {
  const wrapTerm = (cls: string, raw: string) => {
    const target = knownTerms?.get(normalizeTermKey(raw));
    if (target) {
      return `<em class="${cls} has-term" data-term="${esc(target)}" tabindex="0" role="button">${raw}</em>`;
    }
    return `<em class="${cls}">${raw}</em>`;
  };
  return esc(text)
    .replace(/(\d+(?:\.\d+)?%?)/g, '<b>$1</b>')
    .replace(/【([^】]+)】/g, (_, raw: string) => wrapTerm('lk', raw))
    .replace(/&lt;([^&]+?)&gt;/g, (_, raw: string) => wrapTerm('lu', raw))
    .replace(/\{([^}]+)\}/g, (_, raw: string) => wrapTerm('ls', raw));
};

/** 收集与指定 Boss 相关的全部名词与召唤物解释（专属单位/机制在前，通用异常/损伤在后）。 */
export function leaderGlossaryTerms(
  leader: Leader,
  glossary: Readonly<Record<string, EnemyTerm>>,
): EnemyTerm[] {
  const result: EnemyTerm[] = [];
  const seen = new Set<string>();
  const push = (entry: EnemyTerm | undefined) => {
    if (!entry) return;
    const key = normalizeTermKey(entry.term);
    if (seen.has(key)) return;
    seen.add(key);
    result.push(entry);
  };

  for (const entry of leader.terms ?? []) push(entry);

  const corpus = [
    leader.profile.attackMode,
    leader.profile.defense,
    leader.profile.targeting,
    leader.profile.blocking,
    leader.profile.summary,
    leader.profile.hiddenSummary ?? '',
    ...leader.abilities.map((a) => `${a.skill ?? ''} ${a.text}`),
    ...leader.hiddenAbilities.map((a) => `${a.skill ?? ''} ${a.text}`),
    ...leader.counters.map((c) => `${c.by} ${c.text}`),
    ...leader.stage.escorts.map((e) => `${e.name} ${e.note ?? ''}`),
    ...(leader.hiddenStage?.escorts.map((e) => `${e.name} ${e.note ?? ''}`) ??
      []),
  ].join('\n');

  if (leader.hiddenCore) push(glossary['隐秘核心']);
  if (patrols(leader)) push(glossary['巡逻']);
  for (const [key, entry] of Object.entries(glossary)) {
    if (key === '隐秘核心' || key === '巡逻') continue;
    if (corpus.includes(key)) push(entry);
  }
  return result;
}

/** 根据词条名解析 Boss 专有词条或全局敌方词条（同名词条优先匹配当前 Boss 专属说明）。 */
export function resolveEnemyTerm(
  rawTerm: string,
  glossary: Readonly<Record<string, EnemyTerm>>,
  leaders: readonly Leader[],
  leaderName?: string,
): EnemyTerm | undefined {
  const key = normalizeTermKey(rawTerm);
  if (!key) return undefined;
  const scoped = leaderName
    ? leaders.find((item) => item.name === leaderName)
    : undefined;
  const matchTerms = (terms?: readonly EnemyTerm[]) =>
    terms?.find((item) => normalizeTermKey(item.term) === key);

  const scopedHit = matchTerms(scoped?.terms);
  if (scopedHit) return scopedHit;

  const direct = glossary[rawTerm] ?? glossary[key];
  if (direct) return direct;

  for (const entry of Object.values(glossary)) {
    if (normalizeTermKey(entry.term) === key) return entry;
  }
  for (const leader of leaders) {
    const fallbackHit = matchTerms(leader.terms);
    if (fallbackHit) return fallbackHit;
  }
  return undefined;
}

/** 无名能力的标签：基础形态为「特性」，隐秘核心为「强化」 */
export const abilityLabel = (
  skill: string | undefined,
  hidden = false,
): string => skill || (hidden ? '强化' : '特性');

/** 头像旁的短名：胄、昆图斯、阿利斯泰尔、萨米的意志…… */
export const shortName = (leader: Pick<Leader, 'name'>): string =>
  leader.name
    .replace(/^假想敌：/, '')
    .replace(/^盐风主教/, '')
    .replace(/，.*$/, '')
    .replace(/[“”]/g, '');

/** 领袖回合会巡逻进玩家半场（铳、鳍、矩兽） */
export const patrols = (leader: Pick<Leader, 'stage'>): boolean =>
  leader.stage.marks.some(
    (m) => m.kind === 'boss' && m.movement?.left.loopFrom !== undefined,
  );

const COUNTER_CLASS: Readonly<Record<CounterTag, string>> = {
  分散: 'sp',
  阻挡: 'bl',
  集火: 'fo',
  法抗: 'ar',
  对空: 'air',
  限时: 'tm',
  避让: 'av',
  续航: 'su',
  控制: 'cc',
};
export const counterClass = (tag: CounterTag): string => COUNTER_CLASS[tag];
