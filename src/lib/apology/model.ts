import {
  ALL_COVENANTS,
  BUILD_NAMES,
  COVENANTS,
  CORE_COVENANTS,
  DECISION_ROUNDS,
  DIFFICULTIES,
  LEADERS,
  OPERATOR,
  OPERATORS,
  SEASON_META,
  TIER_LABELS,
  covenantColor,
} from '../../../data/index.ts';

export type ApologyTemplateId = 'apology' | 'application';
export type ApologyTargetKind = 'operator' | 'covenant' | 'build';

export interface ApologyChoice {
  readonly id: string;
  readonly text: string;
}

type Encounter = 'regular' | 'bounty' | 'boss';

interface SceneOption {
  readonly label: string;
  readonly encounter: Encounter;
}

export interface ApologyOpeningPreset {
  /** 只限制随机生成，手动选择时保留全部风格。 */
  readonly encounter?: Encounter;
  readonly id: string;
  readonly label: string;
  readonly text: string;
}

export interface ApologyTemplateMeta {
  readonly id: ApologyTemplateId;
  readonly tabLabel: string;
  readonly issuer: string;
  readonly title: string;
  readonly subtitle: string;
  readonly docPrefix: string;
  readonly applicantLabel: string;
  readonly defaultApplicant: string;
  readonly recipientLabel: string;
  readonly defaultRecipient: string;
  readonly sceneLabel: string;
  readonly defaultScene: string;
  readonly openingPresets: readonly ApologyOpeningPreset[];
  readonly defaultOpeningId: string;
  readonly reasonHeading: string;
  readonly reasons: readonly ApologyChoice[];
  readonly defaultReasons: readonly string[];
  readonly customReasonPlaceholder: string;
  readonly pledgeHeading: string;
  readonly pledges: readonly ApologyChoice[];
  readonly defaultPledges: readonly string[];
  readonly customPledgePlaceholder: string;
  readonly quoteLabel: string;
  readonly quotePlaceholder: string;
  readonly defaultQuote: string;
  readonly sampleQuotes: readonly string[];
  readonly signatureLabel: string;
}

interface OpeningDraft {
  openingId: string;
  /** null 跟随预设。空字符串表示用户主动留空。 */
  customOpening: string | null;
}

export interface ApologyFormState extends OpeningDraft {
  template: ApologyTemplateId;
  docNo: string;
  dateText: string;
  applicant: string;
  recipient: string;
  scene: string;
  leakScale: string;
  /** 使用申请书专用：用户可自由填写想玩的流派 / 盟约 / 套路名。 */
  buildText: string;
  covenant: string;
  operator: string;
  /** 暂存其他文书的正文，切回该类型时取回。 */
  savedOpenings: Partial<Record<ApologyTemplateId, OpeningDraft>>;
  checkedReasons: string[];
  /** 自定义补充原因（按行拆分，每行自动写入文书）。 */
  customReasons: string;
  checkedPledges: string[];
  /** 自定义补充条款（按行拆分，每行自动写入文书）。 */
  customPledges: string;
  customQuote: string;
  signature: string;
}

export interface ApologyTargetBadge {
  readonly kind: ApologyTargetKind;
  readonly name: string;
  readonly detail: string;
  readonly color: string;
}

export interface ApologyDocument {
  readonly template: ApologyTemplateId;
  readonly issuer: string;
  readonly title: string;
  readonly subtitle: string;
  readonly docNo: string;
  readonly dateText: string;
  readonly accentColor: string;
  readonly metaRows: readonly {
    readonly label: string;
    readonly value: string;
  }[];
  readonly targetBadge: ApologyTargetBadge | null;
  readonly salutation: string;
  readonly opening: string;
  readonly reasonHeading: string;
  readonly reasons: readonly {
    readonly id: string;
    readonly text: string;
    readonly checked: boolean;
  }[];
  readonly pledgeHeading: string;
  readonly pledges: readonly {
    readonly id: string;
    readonly text: string;
    readonly checked: boolean;
  }[];
  readonly quoteLabel: string;
  readonly quoteText: string;
  readonly closingLines: readonly string[];
  readonly signatureLabel: string;
  readonly signature: string;
  readonly footerNote: string;
  readonly fileName: string;
}

/** 贴合卫戍协议单人约 25 点耐久的实际漏怪体感。 */
const LEAK_OPTIONS: readonly {
  readonly label: string;
  readonly encounter: Encounter;
}[] = [
  {label: '放走 1 只关键怪', encounter: 'regular'},
  {label: '小漏 1–3 只', encounter: 'regular'},
  {label: '赏金怪 / 精英怪没兜住', encounter: 'bounty'},
  {label: '漏了 5–10 只', encounter: 'regular'},
  {label: '防线漏穿（10+ 只）', encounter: 'regular'},
  {label: '领袖 / 隐秘核心没拦住', encounter: 'boss'},
];
export const LEAK_SCALES: readonly string[] = LEAK_OPTIONS.map(
  (option) => option.label,
);

const RANDOM_APPLICANTS: readonly string[] = [
  '匿名博士',
  '4号位博士',
  '某位普通群友',
  '商店刷新选手',
  '执着叠层博士',
  '临时路过指挥官',
];

const RANDOM_RECIPIENTS: Readonly<
  Record<ApologyTemplateId, readonly string[]>
> = {
  apology: ['本局群友', '同房队友', '各位联机群友', '车队全员'],
  application: ['本局队友', '同房各位群友', '联机车队全员', '各位同局博士'],
};

const RANDOM_CUSTOM_BUILDS: readonly string[] = [
  '电表倒转',
  '冷门科研流',
  '多核过渡体系',
  '随缘自研流派',
];

const RECIPIENT_TOKEN = '{recipient}';

export const APOLOGY_TEMPLATES: Readonly<
  Record<ApologyTemplateId, ApologyTemplateMeta>
> = {
  apology: {
    id: 'apology',
    tabLabel: '漏怪道歉书',
    issuer: '卫戍协议 · 联机备忘文件',
    title: '卫戍协议漏怪道歉书',
    subtitle: 'DEFENSE BREACH APOLOGY PROTOCOL',
    docPrefix: 'RI-DQ',
    applicantLabel: '签署人 / ID',
    defaultApplicant: '匿名博士',
    recipientLabel: '同局队友',
    defaultRecipient: '本局群友',
    sceneLabel: '发生回合',
    defaultScene: '后期高压回合（第 11–13 回合）',
    openingPresets: [
      {
        id: 'standard',
        label: '常规漏怪',
        text: '本人「{applicant}」于 {date} 在《{season}》「{scene}」中与{recipient}联机作战，因{buildHint}{opHint}临场发挥失常，出现「{leakScale}」情况，给同局队友增添额外防守压力。经此一役，本人心甘情愿签署本道歉书，承认本局操作与理解确有不足，并保证本局遵守以下条款：',
      },
      {
        id: 'bounty',
        encounter: 'bounty',
        label: '赏金怪没兜住',
        text: '本人「{applicant}」于 {date} 在《{season}》「{scene}」中与{recipient}并肩作战，原本准备替全队稳稳收下悬赏目标，不料{buildHint}{opHint}输出衔接掉链，眼睁睁看着赏金怪顺畅溜走（{leakScale}），白白错失丰厚赏金。本人深感惭愧，特签署本道歉书，愿在本局遵守以下条款：',
      },
      {
        id: 'fumble-cover',
        label: '替队友兜底翻车',
        text: '本人「{applicant}」于 {date} 在《{season}》「{scene}」中本欲为{recipient}稳住残局，怎奈{buildHint}{opHint}临场估算偏差，非但未能顺利兜底，反倒自家防线一并出现「{leakScale}」，着实辜负全队信任。现老实签署本道歉书，并保证本局遵守以下条款：',
      },
      {
        id: 'greedy-econ',
        encounter: 'regular',
        label: '贪发育翻车',
        text: '本人「{applicant}」于 {date} 在《{season}》「{scene}」中与{recipient}联机期间，因沉迷理财贪息、盲目追求后期上限，致使{buildHint}{opHint}中期战力脱节，当回合出现「{leakScale}」，平白消耗全队耐久。本人愿赌服输，特立此道歉书，并保证本局遵守以下条款：',
      },
      {
        id: 'boss-wipe',
        encounter: 'boss',
        label: '领袖决战翻车',
        text: '本人「{applicant}」于 {date} 在《{season}》「{scene}」中与{recipient}一路协防至决战节点，本以为{buildHint}{opHint}阵容已然成型，岂料面对高难机制手忙脚乱，最终酿成「{leakScale}」，功亏一篑。本人心服口服，现郑重签署本道歉书，并保证本局遵守以下条款：',
      },
    ],
    defaultOpeningId: 'standard',
    reasonHeading: '漏怪原因说明',
    reasons: [
      {id: 'greed-level', text: '贪图利息与速升节奏，严重高估了前排承伤能力'},
      {id: 'roll-broke', text: '商店刷新上头耗光资金，关键干员全程未能到位'},
      {id: 'wrong-facing', text: '部署朝向与站位出现低级失误，变相为敌方让路'},
      {id: 'stack-tunnel', text: '沉迷凑盟约与叠层数，未提前核对当波敌方机制'},
      {id: 'bad-draws', text: '本局发牌着实不太友好，连刷数轮未见关键核心'},
      {id: 'network-lag', text: '关键波次突发网络不稳或卡顿，未能及时点出操作'},
      {id: 'pure-misplay', text: '纯属本人临场操作变形，确实没找准这波节奏'},
    ],
    defaultReasons: ['greed-level', 'bad-draws', 'stack-tunnel'],
    customReasonPlaceholder: '可自行补充漏怪原因（一行一条，将直接写入文书）…',
    pledgeHeading: '遵守条款',
    pledges: [
      {
        id: 'stay-humble',
        text: `与${RECIPIENT_TOKEN}联机期间保持举止低调，胜不骄躁、败须服气，绝不强行嘴硬`,
      },
      {
        id: 'accept-review',
        text: `听${RECIPIENT_TOKEN}点评本人的杯级与运营思路时，须虚心听讲，不得顶嘴反驳`,
      },
      {
        id: 'help-999',
        text: `后续回合主动帮${RECIPIENT_TOKEN}卡不需要的干员并及时拦截漏怪，助其顺利叠满层数`,
      },
      {
        id: 'coordinate-builds',
        text: '开局先报想玩的流派，和队友撞了阵容就趁早商量谁换',
      },
      {
        id: 'check-facing',
        text: '开打前再看一眼主力的朝向，免得敌人进了门，干员还在面壁',
      },
      {
        id: 'reserve-funds',
        text: '刷新前先留够买牌的钱，免得核心干员来了只能隔着商店干瞪眼',
      },
    ],
    defaultPledges: ['stay-humble', 'accept-review', 'help-999'],
    customPledgePlaceholder:
      '可自行补充遵守条款（一行一条，将自动编号写入文书）…',
    quoteLabel: '补充声明',
    quotePlaceholder: '可补充一句个人表态（留空则不显示该栏）…',
    defaultQuote: '以上情况均属事实，本人愿赌服输，后面回合一定老实稳血。',
    sampleQuotes: [
      '以上情况均属事实，本人愿赌服输，后面回合一定老实稳血。',
      '这波确实操作变形，待稳住阵脚后争取把节奏找回来。',
      '感谢队友临危不乱兜住防线，本人已充分认识到自身差距。',
      '本次翻车确系意外，后续回合保证提前留好余量。',
    ],
    signatureLabel: '签署人',
  },

  application: {
    id: 'application',
    tabLabel: '使用申请书',
    issuer: '卫戍协议 · 联机报备文件',
    title: '卫戍协议流派使用申请书',
    subtitle: 'BUILD & COVENANT USAGE APPLICATION',
    docPrefix: 'RI-SQ',
    applicantLabel: '申请人 / ID',
    defaultApplicant: '匿名博士',
    recipientLabel: '呈报对象',
    defaultRecipient: '本局队友',
    sceneLabel: '',
    defaultScene: '',
    openingPresets: [
      {
        id: 'polite',
        label: '礼貌报备',
        text: '本人「{applicant}」，拟在本局《{season}》联机对局中使用「{targetName}」{opHint}。鉴于联机卡池共享、局内节奏紧凑，为避免产生理解分歧或给同局队友增添压力，本人不敢擅自闭门硬玩，现依惯例提前书面报备，恳请审阅并予以放行。',
      },
      {
        id: 'shop-led',
        label: '发牌员指路',
        text: '本人「{applicant}」，原本打算老实补位过渡，奈何开局商店连续多轮推送「{targetName}」{opHint}相关核心，牌序指向过于明确，实在盛情难却。为免队友误会本人蓄意抢牌，特提前递交使用申请书一份，恳请同局队友批准顺势成型。',
      },
      {
        id: 'guide-test',
        label: '攻略实战检验',
        text: '本人「{applicant}」，赛前认真研读了数套高分攻略与实战录像，对「{targetName}」{opHint}心向往之。现诚恳申请在本局《{season}》中亲自上手演练一次，如与各路大佬思路撞车特此提前报备借用，恳请队友准予上场检验。',
      },
      {
        id: 'off-meta',
        label: '冷门流派尝鲜',
        text: '本人「{applicant}」，深知「{targetName}」{opHint}在当下环境中未必稳居主流梯队，但本局起手尚可、实在技痒难耐，特此鼓起勇气递交游玩申请。保证前期优先稳住自家血线、绝不盲目拖累全队，恳请准予本局尝试一次。',
      },
      {
        id: 'pool-sync',
        label: '错开卡池申领',
        text: '本人「{applicant}」，为防止本局《{season}》多人同抢一套核心导致集体卡手，现率先亮明运营方向，正式申请本局主攻「{targetName}」{opHint}。如与队友意向撞车愿随时商议礼让，若无冲突则按此推进，恳请同局队友确认放行。',
      },
    ],
    defaultOpeningId: 'polite',
    reasonHeading: '申请事由',
    reasons: [
      {
        id: 'shop-given',
        text: '开局商店连续推送该体系核心，确属牌序指引，并非刻意抢牌',
      },
      {
        id: 'studied-guide',
        text: '赛前已认真研读相关攻略与过渡思路，并非临场盲目摸索',
      },
      {
        id: 'personal-pick',
        text: '虽知该流派在部分榜单中评价不一，但心仪已久，愿亲自实战求证',
      },
      {
        id: 'polite-credit',
        text: '如构筑思路与热门攻略或同款打法有所雷同，特此提前礼貌报备借用',
      },
      {
        id: 'steady-early',
        text: '前期愿优先保证基础防线稳定，尽量不因过度贪发育拖累全队节奏',
      },
      {
        id: 'no-drama',
        text: '本次选用仅作常规游玩体验，不作强度定论，亦不参与场外节奏争论',
      },
    ],
    defaultReasons: ['shop-given', 'studied-guide', 'polite-credit'],
    customReasonPlaceholder:
      '可自行补充申请事由（一行一条，将直接写入申请书）…',
    pledgeHeading: '保证条款',
    pledges: [
      {
        id: 'pool-etiquette',
        text: `本局严格遵守联机卡池礼仪，不抢${RECIPIENT_TOKEN}所需核心牌，并顺手帮卡无用干员`,
      },
      {
        id: 'pivot-timely',
        text: '若中途发牌明显不顺，须及时止损转阵稳血，绝不一条路头铁到底',
      },
      {
        id: 'take-advice',
        text: `局内${RECIPIENT_TOKEN}对站位与配装提出合理建议时，须虚心采纳、积极配合`,
      },
      {
        id: 'sign-apology',
        text: '若使用该流派仍不慎漏怪，本人愿于结算后自觉补签《漏怪道歉书》一份',
      },
    ],
    defaultPledges: ['pool-etiquette', 'pivot-timely', 'sign-apology'],
    customPledgePlaceholder:
      '可自行补充保证条款（一行一条，将自动编号写入申请书）…',
    quoteLabel: '附言',
    quotePlaceholder: '可补充一句个人说明（留空则不显示该栏）…',
    defaultQuote:
      '攻略参考过多套方案，最终决定顺应发牌员安排，特此提前知会一声。',
    sampleQuotes: [
      '攻略参考过多套方案，最终决定顺应发牌员安排，特此提前知会一声。',
      '保证先稳血再追上限，如若翻车，一切按道歉书流程自觉办理。',
      '难得刷出想玩的起手牌，恳请诸位队友高抬贵手，准予本局尝试一次。',
      '本局主打安心发育、配合清线，祝全队商店刷新次次出核心。',
    ],
    signatureLabel: '申请人',
  },
};

export const APOLOGY_TEMPLATE_LIST: readonly ApologyTemplateMeta[] = [
  APOLOGY_TEMPLATES.apology,
  APOLOGY_TEMPLATES.application,
];

/** 动态基于当前赛季回合上限、决策回合、难度与领袖构建真实场景快捷项。 */
function buildSceneOptions(): SceneOption[] {
  const stdRounds = SEASON_META.roundLimits.standard;
  const fastRounds = SEASON_META.roundLimits.fast;
  const highDiffs = DIFFICULTIES.slice(-2).map((d) => d.name);
  const topDiff =
    highDiffs[highDiffs.length - 1] ?? DIFFICULTIES[0]?.name ?? '高难模拟';
  const decisionSet = [...new Set(Object.values(DECISION_ROUNDS).flat())].sort(
    (a, b) => a - b,
  );
  const midDecisions = decisionSet.filter((r) => r >= 5 && r < stdRounds);
  const bountyRange =
    midDecisions.length >= 2
      ? `第 ${midDecisions[0]}–${midDecisions[midDecisions.length - 1]} 回合`
      : midDecisions.length === 1
        ? `第 ${midDecisions[0]} 回合`
        : '中期回合';

  return [
    {label: '前期过渡回合（第 1–6 回合）', encounter: 'regular'},
    {label: `悬赏 / 机变回合（${bountyRange}）`, encounter: 'bounty'},
    {
      label: `${topDiff} · 后期高压回合（第 ${Math.max(1, stdRounds - 3)}–${stdRounds - 1} 回合）`,
      encounter: 'regular',
    },
    {label: `${topDiff} · 第 ${stdRounds} 回合领袖决战`, encounter: 'boss'},
    {label: `${topDiff} · 隐秘核心追加回合`, encounter: 'boss'},
    {
      label: `极速模拟 · 后期回合（第 ${Math.max(1, fastRounds - 2)}–${fastRounds} 回合）`,
      encounter: 'regular',
    },
    ...LEADERS.slice(0, 4).map((leader) => ({
      label: `${topDiff} · 领袖「${leader.name}」决战`,
      encounter: 'boss' as const,
    })),
  ];
}

/** 返回玩家手动选择时可用的全部场景，顺序与下拉列表一致。 */
export function buildScenePresets(): string[] {
  return buildSceneOptions().map((scene) => scene.label);
}

export function splitCustomLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function formatDateStamp(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function generateDocNo(
  template: ApologyTemplateId,
  now: Date = new Date(),
  rand: () => number = Math.random,
): string {
  const prefix = APOLOGY_TEMPLATES[template].docPrefix;
  const compactDate = formatDateStamp(now).replaceAll('-', '');
  const seq = String(Math.floor(rand() * 900) + 100);
  return `${prefix}-${compactDate}-${seq}`;
}

function pickOne<T>(list: readonly T[], rand: () => number): T {
  return list[Math.floor(rand() * list.length) % list.length];
}

function pickSubset(
  list: readonly ApologyChoice[],
  minCount: number,
  maxCount: number,
  rand: () => number,
): string[] {
  const pool = list.map((item) => item.id);
  const count = Math.min(
    pool.length,
    minCount + Math.floor(rand() * (maxCount - minCount + 1)),
  );
  const picked: string[] = [];
  const available = pool.slice();
  for (let i = 0; i < count && available.length > 0; i++) {
    const idx = Math.floor(rand() * available.length) % available.length;
    picked.push(available[idx]);
    available.splice(idx, 1);
  }
  return pool.filter((id) => picked.includes(id));
}

function defaultCovenantName(): string {
  return CORE_COVENANTS[0] ?? ALL_COVENANTS[0] ?? '';
}

function fillRecipient(text: string, recipient: string): string {
  return text.replaceAll(RECIPIENT_TOKEN, () => recipient);
}

export function resolveChoiceText(text: string, recipient: string): string {
  return fillRecipient(text, recipient.trim() || '本局队友');
}

export function createDefaultApologyState(
  template: ApologyTemplateId = 'apology',
  options?: {
    covenant?: string;
    buildText?: string;
    operator?: string;
    now?: Date;
    rand?: () => number;
  },
): ApologyFormState {
  const meta = APOLOGY_TEMPLATES[template];
  const now = options?.now ?? new Date();
  const rand = options?.rand ?? Math.random;
  const covenant =
    options?.covenant && Object.hasOwn(COVENANTS, options.covenant)
      ? options.covenant
      : defaultCovenantName();
  const buildText = options?.buildText?.trim() || covenant;
  const operator =
    options?.operator && Object.hasOwn(OPERATOR, options.operator)
      ? options.operator
      : '';

  return {
    template,
    docNo: generateDocNo(template, now, rand),
    dateText: formatDateStamp(now),
    applicant: meta.defaultApplicant,
    recipient: meta.defaultRecipient,
    scene: meta.defaultScene,
    leakScale: LEAK_SCALES[2],
    buildText,
    covenant,
    operator,
    openingId: meta.defaultOpeningId,
    customOpening: null,
    savedOpenings: {},
    checkedReasons: [...meta.defaultReasons],
    customReasons: '',
    checkedPledges: [...meta.defaultPledges],
    customPledges: '',
    customQuote: meta.defaultQuote,
    signature: '',
  };
}

/** 切换文书类型时保留用户主动填写的昵称、日期、流派/盟约、干员与自定义原因/条款。 */
export function switchApologyTemplate(
  previous: ApologyFormState,
  nextTemplate: ApologyTemplateId,
  options?: {now?: Date; rand?: () => number},
): ApologyFormState {
  if (previous.template === nextTemplate) return previous;
  const oldMeta = APOLOGY_TEMPLATES[previous.template];
  const nextMeta = APOLOGY_TEMPLATES[nextTemplate];
  const now = options?.now ?? new Date();
  const rand = options?.rand ?? Math.random;

  const keepApplicant =
    previous.applicant.trim() &&
    previous.applicant.trim() !== oldMeta.defaultApplicant
      ? previous.applicant
      : nextMeta.defaultApplicant;
  const keepRecipient =
    previous.recipient.trim() &&
    previous.recipient.trim() !== oldMeta.defaultRecipient
      ? previous.recipient
      : nextMeta.defaultRecipient;
  const keepScene =
    nextTemplate === 'application'
      ? ''
      : previous.scene.trim() && previous.scene.trim() !== oldMeta.defaultScene
        ? previous.scene
        : nextMeta.defaultScene;
  const keepQuote =
    previous.customQuote.trim() &&
    previous.customQuote.trim() !== oldMeta.defaultQuote &&
    !oldMeta.sampleQuotes.includes(previous.customQuote.trim())
      ? previous.customQuote
      : nextMeta.defaultQuote;

  const buildText =
    previous.buildText.trim() || previous.covenant || defaultCovenantName();

  const savedOpenings = {...previous.savedOpenings};
  const nextOpening = savedOpenings[nextTemplate] ?? {
    openingId: nextMeta.defaultOpeningId,
    customOpening: null,
  };
  delete savedOpenings[nextTemplate];
  savedOpenings[previous.template] = {
    openingId: previous.openingId,
    customOpening: previous.customOpening,
  };

  return {
    ...previous,
    template: nextTemplate,
    docNo: generateDocNo(nextTemplate, now, rand),
    applicant: keepApplicant,
    recipient: keepRecipient,
    scene: keepScene,
    buildText,
    ...nextOpening,
    savedOpenings,
    checkedReasons: [...nextMeta.defaultReasons],
    checkedPledges: [...nextMeta.defaultPledges],
    customQuote: keepQuote,
  };
}

/** 一键随机生成：自动组合真实赛季盟约/流派/干员/回合场景、正文风格与条款。 */
export function randomizeApologyState(
  template: ApologyTemplateId,
  options?: {now?: Date; rand?: () => number},
): ApologyFormState {
  const meta = APOLOGY_TEMPLATES[template];
  const now = options?.now ?? new Date();
  const rand = options?.rand ?? Math.random;
  const scene =
    template === 'apology' ? pickOne(buildSceneOptions(), rand) : undefined;
  const openingPresets = scene
    ? meta.openingPresets.filter(
        (preset) => !preset.encounter || preset.encounter === scene.encounter,
      )
    : meta.openingPresets;
  const leakOptions = scene
    ? LEAK_OPTIONS.filter((option) => option.encounter === scene.encounter)
    : LEAK_OPTIONS;

  const covenant = CORE_COVENANTS.length
    ? pickOne(CORE_COVENANTS, rand)
    : defaultCovenantName();
  const buildPool = [...BUILD_NAMES, ...RANDOM_CUSTOM_BUILDS];
  const buildText = buildPool.length ? pickOne(buildPool, rand) : covenant;
  const highTierOps = OPERATORS.filter((op) => op.tier >= 5);
  const opPool = highTierOps.length ? highTierOps : OPERATORS;
  const operator =
    template === 'application'
      ? rand() < 0.35 && opPool.length
        ? pickOne(opPool, rand).name
        : ''
      : rand() < 0.25 || !opPool.length
        ? ''
        : pickOne(opPool, rand).name;

  return {
    template,
    docNo: generateDocNo(template, now, rand),
    dateText: formatDateStamp(now),
    applicant: pickOne(RANDOM_APPLICANTS, rand),
    recipient: pickOne(RANDOM_RECIPIENTS[template], rand),
    scene: scene?.label ?? '',
    leakScale: pickOne(leakOptions, rand).label,
    buildText,
    covenant,
    operator,
    openingId: pickOne(openingPresets, rand).id,
    customOpening: null,
    savedOpenings: {},
    checkedReasons: pickSubset(meta.reasons, 2, 4, rand),
    customReasons: '',
    checkedPledges: pickSubset(meta.pledges, 2, 3, rand),
    customPledges: '',
    customQuote: pickOne(meta.sampleQuotes, rand),
    signature: '',
  };
}

function buildTargetBadge(state: ApologyFormState): ApologyTargetBadge | null {
  if (state.template === 'application') {
    if (state.operator && Object.hasOwn(OPERATOR, state.operator)) {
      const op = OPERATOR[state.operator];
      const primaryCov = op.covenants[0] ?? '';
      return {
        kind: 'operator',
        name: op.name,
        detail: `${TIER_LABELS[op.tier] ?? ''}阶 · ${op.covenants.join(' / ')}`,
        color: covenantColor(primaryCov, '#b8322a'),
      };
    }
    const buildName = state.buildText.trim();
    if (buildName && Object.hasOwn(COVENANTS, buildName)) {
      const cov = COVENANTS[buildName];
      return {
        kind: 'covenant',
        name: buildName,
        detail: `${cov.kind === 'core' ? '核心盟约' : '附加盟约'} · ${cov.need} 人激活`,
        color: covenantColor(buildName, '#b8322a'),
      };
    }
    if (buildName) {
      return {
        kind: 'build',
        name: buildName,
        detail: '拟使用流派 / 玩法',
        color: '#b8322a',
      };
    }
    return null;
  }

  if (state.operator && Object.hasOwn(OPERATOR, state.operator)) {
    const op = OPERATOR[state.operator];
    const primaryCov = op.covenants[0] ?? '';
    return {
      kind: 'operator',
      name: op.name,
      detail: `${TIER_LABELS[op.tier] ?? ''}阶 · ${op.covenants.join(' / ')}`,
      color: covenantColor(primaryCov, '#b8322a'),
    };
  }
  if (state.covenant && Object.hasOwn(COVENANTS, state.covenant)) {
    const cov = COVENANTS[state.covenant];
    return {
      kind: 'covenant',
      name: state.covenant,
      detail: `${cov.kind === 'core' ? '核心盟约' : '附加盟约'} · ${cov.need} 人激活`,
      color: covenantColor(state.covenant, '#b8322a'),
    };
  }
  return null;
}

/** 按当前表单参数渲染选定的正文模板（供预览和编辑器实时显示）。 */
export function renderPresetOpening(state: ApologyFormState): string {
  const meta = APOLOGY_TEMPLATES[state.template];
  const preset =
    meta.openingPresets.find((item) => item.id === state.openingId) ??
    meta.openingPresets[0];
  const applicant = state.applicant.trim() || meta.defaultApplicant;
  const recipient = state.recipient.trim() || meta.defaultRecipient;
  const scene = state.scene.trim() || meta.defaultScene;
  const leakScale = state.leakScale.trim() || LEAK_SCALES[0];
  const buildText = state.buildText.trim() || defaultCovenantName();
  const covenant =
    state.covenant && Object.hasOwn(COVENANTS, state.covenant)
      ? state.covenant
      : '';
  const operator =
    state.operator && Object.hasOwn(OPERATOR, state.operator)
      ? state.operator
      : '';
  const dateText = state.dateText.trim() || formatDateStamp();
  const buildHint = covenant ? `采用「${covenant}」体系` : '排阵运营';
  const opHint = operator
    ? state.template === 'application'
      ? `（关键干员：${operator}）`
      : `（关键位：${operator}）`
    : '';

  const fields: Readonly<Record<string, string>> = {
    applicant,
    recipient,
    date: dateText,
    season: SEASON_META.title,
    scene,
    leakScale,
    buildHint,
    opHint,
    targetName: buildText || '自选流派',
  };
  // 只读取预设里的占位符；昵称里的花括号、美元符号等都按字面保留。
  return preset.text.replace(/\{([a-zA-Z]+)\}/g, (token, key: string) =>
    Object.hasOwn(fields, key) ? fields[key] : token,
  );
}

export function buildApologyDocument(state: ApologyFormState): ApologyDocument {
  const meta = APOLOGY_TEMPLATES[state.template];
  const applicant = state.applicant.trim() || meta.defaultApplicant;
  const recipient = state.recipient.trim() || meta.defaultRecipient;
  const scene = state.scene.trim() || meta.defaultScene;
  const leakScale = state.leakScale.trim() || LEAK_SCALES[0];
  const buildText = state.buildText.trim() || defaultCovenantName();
  const covenant =
    state.covenant && Object.hasOwn(COVENANTS, state.covenant)
      ? state.covenant
      : '';
  const operator =
    state.operator && Object.hasOwn(OPERATOR, state.operator)
      ? state.operator
      : '';
  const dateText = state.dateText.trim() || formatDateStamp();
  const docNo = state.docNo.trim() || `${meta.docPrefix}-000`;
  const signature = state.signature.trim() || applicant;
  const quoteText = state.customQuote.trim();
  const opening = state.customOpening ?? renderPresetOpening(state);

  const reasonSet = new Set(state.checkedReasons);
  const pledgeSet = new Set(state.checkedPledges);
  const extraReasons = splitCustomLines(state.customReasons).map(
    (text, idx) => ({
      id: `custom-reason-${idx}`,
      text,
      checked: true,
    }),
  );
  const extraPledges = splitCustomLines(state.customPledges).map(
    (text, idx) => ({
      id: `custom-pledge-${idx}`,
      text,
      checked: true,
    }),
  );

  const targetBadge = buildTargetBadge({
    ...state,
    buildText,
    covenant,
    operator,
  });

  const metaRows: {label: string; value: string}[] = [
    {label: meta.applicantLabel, value: applicant},
    {label: meta.recipientLabel, value: recipient},
  ];
  if (state.template === 'application') {
    metaRows.push({label: '拟玩流派', value: buildText});
    if (operator) {
      metaRows.push({label: '关键干员', value: operator});
    }
  } else {
    metaRows.push({label: meta.sceneLabel, value: scene});
    metaRows.push({label: '漏怪情况', value: leakScale});
    if (covenant) {
      metaRows.push({label: '关联盟约', value: covenant});
    }
    if (operator) {
      metaRows.push({label: '相关干员', value: operator});
    }
  }

  const title =
    state.template === 'application' && buildText
      ? `关于游玩「${buildText}」的使用申请书`
      : meta.title;

  const salutation =
    state.template === 'application' ? `尊敬的${recipient}：` : '';
  const closingLines =
    state.template === 'application' ? ['妥否，请批示。'] : [];

  const safeDate = dateText.replace(/[^0-9]/g, '').slice(0, 8) || 'now';
  const fileName = `卫戍协议-${meta.tabLabel}-${safeDate}.png`;

  return {
    template: state.template,
    issuer: meta.issuer,
    title,
    subtitle: meta.subtitle,
    docNo,
    dateText,
    accentColor: '#b8322a',
    metaRows,
    targetBadge,
    salutation,
    opening,
    reasonHeading: meta.reasonHeading,
    reasons: [
      ...meta.reasons.map((item) => ({
        id: item.id,
        text: fillRecipient(item.text, recipient),
        checked: reasonSet.has(item.id),
      })),
      ...extraReasons,
    ],
    pledgeHeading: meta.pledgeHeading,
    pledges: [
      ...meta.pledges.map((item) => ({
        id: item.id,
        text: fillRecipient(item.text, recipient),
        checked: pledgeSet.has(item.id),
      })),
      ...extraPledges,
    ],
    quoteLabel: meta.quoteLabel,
    quoteText,
    closingLines,
    signatureLabel: meta.signatureLabel,
    signature,
    footerNote: `卫戍速查 · ${SEASON_META.guideSubtitle}`,
    fileName,
  };
}

/** 生成适合直接发群或论坛的纯文本公文（原因与条款均仅输出已选及自定义项）。 */
export function formatApologyText(doc: ApologyDocument): string {
  const lines: string[] = [
    `【${doc.issuer}】`,
    `《${doc.title}》`,
    `编号：${doc.docNo}　日期：${doc.dateText}`,
    '────────────────────',
  ];

  for (const row of doc.metaRows) {
    lines.push(`${row.label}：${row.value}`);
  }

  lines.push('');
  if (doc.salutation) {
    lines.push(doc.salutation);
  }
  if (doc.opening.trim()) lines.push(`　　${doc.opening}`);

  const checkedReasons = doc.reasons.filter((item) => item.checked);
  const checkedPledges = doc.pledges.filter((item) => item.checked);

  if (checkedReasons.length) {
    lines.push('', `一、${doc.reasonHeading}`);
    checkedReasons.forEach((item, index) => {
      lines.push(`${index + 1}. ${item.text}`);
    });
  }

  if (checkedPledges.length) {
    const pledgePrefix = checkedReasons.length ? '二、' : '一、';
    lines.push('', `${pledgePrefix}${doc.pledgeHeading}`);
    checkedPledges.forEach((item, index) => {
      lines.push(`${index + 1}. ${item.text}`);
    });
  }

  if (doc.quoteText) {
    lines.push('', `${doc.quoteLabel}：`, `「${doc.quoteText}」`);
  }

  if (doc.closingLines.length) {
    lines.push('');
    for (const closing of doc.closingLines) {
      lines.push(`　　${closing}`);
    }
  }

  lines.push(
    '',
    '────────────────────',
    `${doc.signatureLabel}：${doc.signature}　　日期：${doc.dateText}`,
    `（${doc.footerNote}）`,
  );

  return lines.join('\n');
}
