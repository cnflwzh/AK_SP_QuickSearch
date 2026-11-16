import {
  ADDON_COVENANTS,
  ALL_COVENANTS,
  CORE_COVENANTS,
  EQUIPMENT,
  EQUIPMENT_COMBOS,
  matchesOperatorTrigger,
  rosterOf,
} from '../../../data/index.ts';
import type {Bounty, Equipment, Operator, Strategy} from '../../../data/types.ts';
import type {
  BountyChallengeTheme,
  EquipChallengeTheme,
  StrategyChallengeTheme,
  TierCheckTheme,
  TriggerChallengeTheme,
} from './types.ts';
import {extractTriggerHint} from './utils.ts';

/** At least two operators belong to these covenants (excludes 0-member 绝技). */
export const SELECTABLE_COVENANTS: readonly string[] = ALL_COVENANTS.filter(
  (name) => rosterOf(name).length >= 2,
);

export const DAILY_CORE_POOL = CORE_COVENANTS.filter(
  (name) => rosterOf(name).length >= 5,
);

export const TRANSMUTE_EQUIP_BY_COVENANT = new Map<string, Equipment[]>();
for (const eq of EQUIPMENT) {
  if (!eq.covenant) continue;
  const bucket = TRANSMUTE_EQUIP_BY_COVENANT.get(eq.covenant) ?? [];
  bucket.push(eq);
  TRANSMUTE_EQUIP_BY_COVENANT.set(eq.covenant, bucket);
}

/** Covenants that have both >=5 operators and at least one equip convertible via 变形同构体. */
export const TRANSMUTE_COVENANTS: readonly string[] = ALL_COVENANTS.filter(
  (name) =>
    TRANSMUTE_EQUIP_BY_COVENANT.has(name) && rosterOf(name).length >= 5,
);

export const TRANSMUTE_ADDON_POOL = ADDON_COVENANTS.filter((name) =>
  TRANSMUTE_COVENANTS.includes(name),
);

export const COMBO_PART_TARGET = new Map<string, string>();
export const COMBO_RESULT_SET = new Set<string>();
for (const [first, second, result] of EQUIPMENT_COMBOS) {
  COMBO_PART_TARGET.set(first, result);
  COMBO_PART_TARGET.set(second, result);
  COMBO_RESULT_SET.add(result);
}

export const EQUIP_THEMES: readonly EquipChallengeTheme[] = [
  'transmute_capable',
  'upgradable',
  'consumable',
  'combo_recipe',
  'price_thrift',
];

export const TRIGGER_THEMES: readonly TriggerChallengeTheme[] = [
  'on_acquire',
  'rest_end',
  'prep_type',
  'in_battle_stack',
];

export const TIER_CHECK_THEMES: readonly TierCheckTheme[] = [
  'low_shop_3',
  'high_core_56',
  'high_equip_56',
];

export const STRATEGY_THEMES: readonly StrategyChallengeTheme[] = [
  'faction_exclusive',
  'active_command',
  'stack_focus',
  'high_hp',
];

export const BOUNTY_THEMES: readonly BountyChallengeTheme[] = [
  'big_bounty',
  'safe_bounty',
];

export const EQUIP_THEME_META: Readonly<
  Record<
    EquipChallengeTheme,
    {
      readonly shortTarget: string;
      readonly summary: string;
      readonly bonus: string;
      readonly match: (eq: Equipment) => boolean;
      readonly impostor: (eq: Equipment) => boolean;
    }
  >
> = {
  transmute_capable: {
    shortTarget: '可同构转职装',
    summary:
      '保留搭配「变形同构体」时能提供盟约加成的装备；揪出无对应盟约词条的通用装备！',
    bonus: '仅在装备详情中带有「盟约」归属的装备，才能被变形同构体转化出盟约',
    match: (eq) => eq.covenant !== null,
    impostor: (eq) => eq.covenant === null && eq.name !== '变形同构体',
  },
  upgradable: {
    shortTarget: '可同名进阶装',
    summary:
      '保留凑齐两件同名即可合成进阶版的装备；揪出没有进阶版本的一次性或特殊装备！',
    bonus: '消耗品与异名合成部件/成品通常无同名进阶效果，抓牌时留意别重复购买',
    match: (eq) => eq.advanced !== null,
    impostor: (eq) => eq.advanced === null && eq.price < 6,
  },
  consumable: {
    shortTarget: '装备时销毁',
    summary:
      '保留放入装备格即刻触发并销毁的周转道具；揪出会占住装备栏位的常驻穿戴装！',
    bonus: '周转类装备不会占用干员有限的装备槽位，常用于补资金、刷商店或补层数',
    match: (eq) => eq.effect.startsWith('装备时销毁'),
    impostor: (eq) =>
      !eq.effect.startsWith('装备时销毁') && !eq.effect.includes('销毁'),
  },
  combo_recipe: {
    shortTarget: '异名神装组件',
    summary:
      '保留可两两合成终极 6 阶神装（天马/不退者/动能/汲取者/驱逐者）的散件；揪出非合成组件！',
    bonus: '5 套异名合成神装各有 2 件特定前置散件，合成后将直接变为高阶成品装备',
    match: (eq) => COMBO_PART_TARGET.has(eq.name),
    impostor: (eq) =>
      eq.tier >= 3 &&
      !COMBO_PART_TARGET.has(eq.name) &&
      !COMBO_RESULT_SET.has(eq.name),
  },
  price_thrift: {
    shortTarget: '1 费省钱周转装',
    summary:
      '保留商店售价仅 1 资金的高性价比周转/过渡装备；揪出售价 ≥2 资金的高费装备！',
    bonus: '卫戍商店里多件 1 资金消耗品与小件能在关键回合低成本过渡或灵活周转',
    match: (eq) => eq.price === 1,
    impostor: (eq) => eq.price >= 2,
  },
};

export const TRIGGER_THEME_META: Readonly<
  Record<
    TriggerChallengeTheme,
    {
      readonly shortTarget: string;
      readonly summary: string;
      readonly bonus: string;
      readonly match: (op: Operator) => boolean;
      readonly impostor: (op: Operator) => boolean;
      readonly isDecoy?: (op: Operator) => boolean;
      readonly revealText: (op: Operator, matched: boolean) => string;
    }
  >
> = {
  on_acquire: {
    shortTarget: '获得时触发',
    summary:
      '保留特质包含「<获得时>」即时收益的干员；揪出非获得时触发的干员！',
    bonus: '带有<获得时>词条的干员购买入队即刻结算收益，常用于灵活周转或即时补强',
    match: (op) => matchesOperatorTrigger(op, '获得时', false),
    impostor: (op) =>
      !op.trait.includes('<获得时>') && !op.elite.includes('<获得时>'),
    isDecoy: (op) =>
      op.trait.includes('<售出时>') ||
      op.trait.includes('<进入休整期时>') ||
      op.trait.includes('<休整期开始时>') ||
      op.trait.includes('<刷新时>'),
    revealText: (_op, matched) => (matched ? '含<获得时>' : '非<获得时>'),
  },
  rest_end: {
    shortTarget: '休整期结束触发',
    summary:
      '保留在「<休整期结束时>」结算效果的干员；揪出仅在休整开始、战斗或其它时机触发的干员！',
    bonus: '休整结束前记得留好触发条件与站位；注意区分「进入休整期/开始时」与「结束时」',
    match: (op) => matchesOperatorTrigger(op, '休整期结束', false),
    impostor: (op) =>
      !op.trait.includes('<休整期结束时>') &&
      !op.elite.includes('<休整期结束时>'),
    isDecoy: (op) =>
      op.trait.includes('<进入休整期时>') || op.trait.includes('<休整期开始时>'),
    revealText: (_op, matched) =>
      matched ? '含<休整期结束时>' : '非<休整期结束时>',
  },
  prep_type: {
    shortTarget: '整备能力定位',
    summary:
      '保留图鉴归类为「整备能力」（偏重经济、刷新、调度整备收益）的干员；揪出作战或叠层定位干员！',
    bonus: '整备能力干员通常提供额外资金、刷新次数或整备区增益，是发育期的核心润滑剂',
    match: (op) => op.type === '整备能力',
    impostor: (op) => op.type !== '整备能力',
    revealText: (op) => op.type,
  },
  in_battle_stack: {
    shortTarget: '战斗持续叠加',
    summary:
      '保留同时具备「<战斗中>触发」与「持续叠加」定位的干员；揪出非持续叠加或非战斗中触发干员！',
    bonus: '此类干员能在战斗期间持续产出叠层与成长收益，多为叠层体系中后期核心',
    match: (op) =>
      matchesOperatorTrigger(op, '战斗中', false) && op.type === '持续叠加',
    impostor: (op) =>
      !(matchesOperatorTrigger(op, '战斗中', false) && op.type === '持续叠加'),
    isDecoy: (op) =>
      matchesOperatorTrigger(op, '战斗中', false) !== (op.type === '持续叠加'),
    revealText: (op, matched) =>
      matched ? '战斗中·持续叠加' : `${op.type}·${extractTriggerHint(op.trait)}`,
  },
};

export const TIER_CHECK_META: Readonly<
  Record<
    TierCheckTheme,
    {
      readonly shortTarget: string;
      readonly summary: string;
      readonly bonus: string;
      readonly itemKind: 'operator' | 'equipment';
    }
  >
> = {
  low_shop_3: {
    shortTarget: '1~3 阶低本干员',
    summary:
      '保留 1~3 阶前期商店即可刷出的干员；揪出须升到 4~6 阶才能拿到的高本干员！',
    bonus: '角标已隐藏为「?」——开局低本阶段究竟能搜出谁？考一考商店等阶记忆',
    itemKind: 'operator',
  },
  high_core_56: {
    shortTarget: '5~6 阶高本核心',
    summary:
      '保留须升到 5~6 阶商店才刷出的高本核心干员；揪出 1~4 阶中前期过渡干员！',
    bonus: '角标已隐藏为「?」——升 5~6 本开 D 之前，认清谁是真正的 5~6 阶终盘核心',
    itemKind: 'operator',
  },
  high_equip_56: {
    shortTarget: '5~6 阶高阶装备',
    summary:
      '保留 5~6 阶高阶毕业装备（含 6 阶合成神装与高阶成品）；揪出 1~4 阶前中期装备！',
    bonus: '角标已隐藏为「?」——区分高阶成品神装与 3~4 阶常见散件的商店等阶',
    itemKind: 'equipment',
  },
};

export const STRATEGY_THEME_META: Readonly<
  Record<
    StrategyChallengeTheme,
    {
      readonly shortTarget: string;
      readonly summary: string;
      readonly bonus: string;
      readonly hideHp?: boolean;
      readonly match: (st: Strategy) => boolean;
      readonly impostor: (st: Strategy) => boolean;
    }
  >
> = {
  faction_exclusive: {
    shortTarget: '阵营专属策略',
    summary:
      '保留属于特定核心阵营的专属开局策略；揪出泛用（开局/发育/战斗/叠层/商店/特殊）策略！',
    bonus: '炎、维多利亚、谢拉格、拉特兰、卡西米尔等核心阵营各自拥有专属开局策略',
    match: (st) => CORE_COVENANTS.includes(st.category),
    impostor: (st) => !CORE_COVENANTS.includes(st.category),
  },
  active_command: {
    shortTarget: '主动点击/拖拽策略',
    summary:
      '保留提供可手动「点击」或「拖拽」主动战术指令的策略；揪出纯被动自动生效的策略！',
    bonus: '主动指令策略可在休整期对商店或场上干员执行复制、转化、加速等特化操作',
    match: (st) => st.effect.includes('点击（') || st.effect.includes('拖拽（'),
    impostor: (st) =>
      !st.effect.includes('点击（') && !st.effect.includes('拖拽（'),
  },
  stack_focus: {
    shortTarget: '叠层流派策略',
    summary:
      '保留图鉴分类归属「叠层」专精的局内策略；揪出其它分类的常规或阵营策略！',
    bonus: '叠层类策略专精放大各类盟约层数叠加速度与层数触发红利',
    match: (st) => st.category === '叠层',
    impostor: (st) => st.category !== '叠层',
  },
  high_hp: {
    shortTarget: '高生命值策略 (≥28)',
    summary:
      '保留初始目标生命值 ≥ 28 的高血量高容错策略；揪出初始生命 ≤ 24 的高风险策略！',
    bonus: '生命角标已隐藏为「❤?」——高血量策略初期容错充裕，低血量策略常带高风险高回报特性',
    hideHp: true,
    match: (st) => st.hp >= 28,
    impostor: (st) => st.hp <= 24,
  },
};

export const BOUNTY_THEME_META: Readonly<
  Record<
    BountyChallengeTheme,
    {
      readonly shortTarget: string;
      readonly summary: string;
      readonly bonus: string;
      readonly match: (b: Bounty) => boolean;
      readonly impostor: (b: Bounty) => boolean;
    }
  >
> = {
  big_bounty: {
    shortTarget: '单场 4~5 资金高赏金',
    summary:
      '保留「下场」击败即直接发放 4~5 资金的高赏金首领；揪出低赏金（≤2）或跨场次悬赏！',
    bonus: '赏金角标已隐藏为「💰?」——高危 Boss 级别悬赏才有机会单场给出 4~5 资金高额回报',
    match: (b) => b.when === '下场' && b.funds >= 4,
    impostor: (b) => b.when !== '下场' || b.funds <= 2,
  },
  safe_bounty: {
    shortTarget: '单场 1~2 资金过渡悬赏',
    summary:
      '保留「下场」结算 1~2 资金的常规过渡悬赏；揪出 0 资特训、4~5 资高危 Boss 或跨场悬赏！',
    bonus: '赏金角标已隐藏为「💰?」——前期阵容尚在发育期时，认准稳健 1~2 资金悬赏避免翻车',
    match: (b) => b.when === '下场' && b.funds >= 1 && b.funds <= 2,
    impostor: (b) => b.when !== '下场' || b.funds >= 4 || b.funds === 0,
  },
};

export const TRICKY_DECOY_EQUIP_NAMES = [
  '雪祀之衣',
  '随身身份牌',
  '卫戍推荐信',
  '歌利亚头盔',
  '盟约之币',
  '多功能补剂',
  '虹彩活血饮料',
  'M3茧甲',
  '双模机械臂',
  '佣兵名牌',
  '不退者之盾',
  '瓶装烈性反应',
  '可靠怀表',
  '博士投影',
] as const;

export const CONSUMABLE_DECOY_NAMES = [
  '卫戍推荐信',
  '佣兵名牌',
  '博士投影',
  '拟态物质',
  '多功能补剂',
  '源石溶剂',
  '变形同构体',
  '信标',
] as const;
