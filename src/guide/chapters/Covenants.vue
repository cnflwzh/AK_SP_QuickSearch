<script setup lang="ts">
import {computed, ref} from 'vue';
import {
  ADDON_COVENANTS,
  ALL_COVENANTS,
  CORE_COVENANTS,
  COVENANTS,
  CYCLE_REWARDS,
  HEADCOUNT_BREAKPOINTS,
  LAYER_BREAKPOINTS,
  OPERATORS,
  OPERATOR_TRIGGERS as TRIGGERS,
  RESERVE_COVENANTS,
  SEASON_META,
  STRATEGY_CATEGORIES,
  matchesOperatorTrigger,
} from '../../../data/index.ts';
import {round1} from '../../lib/ui/dom.ts';
import {tokenizeTrait, traitLabel} from '../../lib/ui/traitText.ts';
import GlossaryText from '../../quickref/components/GlossaryText.vue';
import Segmented from '../../quickref/components/Segmented.vue';
import SelectInput, {
  type SelectOption,
} from '../../quickref/components/SelectInput.vue';
import SubTabs, {type SubTabItem} from '../../quickref/components/SubTabs.vue';
import {cv, eq, op} from '../chips.ts';
import Markup from '../components/Markup.ts';
import {iconSvg} from '../icons.ts';
import {
  POSITIONS,
  covenantContent,
  covenantCurve,
  covenantGrid,
  strategies,
  type CovenantFilter,
} from './covenantsView.ts';

const content = covenantContent();
const milestoneCount = ALL_COVENANTS.filter((name) =>
  Boolean(
    LAYER_BREAKPOINTS[name]?.length ||
    CYCLE_REWARDS[name] ||
    HEADCOUNT_BREAKPOINTS.some((h) => h.covenant === name),
  ),
).length;
const covFilter = ref<CovenantFilter>('core');
const covFilterTabs: readonly SubTabItem<CovenantFilter>[] = [
  {id: 'core', label: '核心盟约', count: CORE_COVENANTS.length},
  {id: 'addon', label: '附加盟约', count: ADDON_COVENANTS.length},
  {id: 'milestone', label: '层数/人数里程碑', count: milestoneCount},
  {id: 'all', label: '全部', count: ALL_COVENANTS.length},
];
const filteredCovenantHtml = computed(() => covenantGrid(covFilter.value));
const reserveNames = [...RESERVE_COVENANTS];

const traitText = (text: string) =>
  tokenizeTrait(text).filter(part => part.kind !== 'trigger').map(traitLabel).join('');
const trigger = ref(4);
const triggerElite = ref(false);
const triggerLists = computed(() =>
  TRIGGERS.map(([label]) =>
    OPERATORS.filter((o) =>
      matchesOperatorTrigger(o, label, triggerElite.value),
    ).sort((a, b) => a.tier - b.tier),
  ),
);

const position = ref(0);
const mirror = ref(false);
const positionTabs: readonly SubTabItem<number>[] = POSITIONS.map(
  ([label], id) => ({id, label}),
);
const keyword = computed(() => POSITIONS[position.value][0]);
const positionOperators = computed(() =>
  OPERATORS.filter((o) => (o.trait + o.elite).includes(keyword.value)),
);
const positionCells = computed(() => {
  const offsets = POSITIONS[position.value][1];
  const direction = mirror.value ? -1 : 1;
  return Array.from({length: 15}, (_, i) => {
    const row = Math.floor(i / 5),
      column = i % 5;
    return {
      me: row === 1 && column === 2,
      on: offsets.some(([r, c]) => r === row && 2 + c * direction === column),
    };
  });
});

const scalableCovenants = Object.keys(COVENANTS).filter(
  (name) => COVENANTS[name].scaling.length,
);
const scalableCovenantOptions: readonly SelectOption<string>[] =
  scalableCovenants.map((name) => ({value: name, label: name}));
const covenant = ref(
  scalableCovenants.includes(SEASON_META.defaultCovenant)
    ? SEASON_META.defaultCovenant
    : (scalableCovenants[0] ?? ''),
);
const layers = ref(60);
const strategyCategory = ref(0);
const strategyTabs: readonly SubTabItem<number>[] = STRATEGY_CATEGORIES.map(
  (label, id) => ({id, label}),
);

const selectedCovenant = computed(() => COVENANTS[covenant.value]);
const curve = computed(() => covenantCurve(covenant.value));
const marker = computed(() => curve.value.points[layers.value]);
const values = computed(() =>
  selectedCovenant.value.scaling.map(({label, unit, at}) => ({
    label,
    unit,
    value: round1(at(layers.value)),
  })),
);
const curveDescription = computed(() => {
  const {main, start, end} = curve.value;
  const result = values.value
    .map(({label, unit, value}) => `${label} ${value}${unit}`)
    .join('，');
  return `横轴为 0 至 300 层，纵轴为${main.label}，单位${main.unit || '无'}。当前 ${layers.value} 层：${result}。${main.label}在 0 层为 ${round1(start)}${main.unit}，300 层为 ${round1(end)}${main.unit}。`;
});
const strategyContent = computed(() => strategies(strategyCategory.value));
</script>
<template>
  <div class="chap-h">
    <span class="no">04</span>
    <div>
      <h2>盟约与叠层</h2>
      <p class="en">COVENANTS · STACKING ENGINE · POSITIONING</p>
    </div>
  </div>
  <p class="chap-lead">
    每个角色都带有阵营或职业标签，在游戏里称为
    <b>「盟约」</b>
    。凑够同盟约上场人数即可激活团队加成，并通过买卖刷新或战斗不断累积
    <b>「层数」</b>
    ——层数叠得越高，全队伤害与特效就越强。
  </p>

  <h3 class="bh">
    <span>4.1</span>
    黄金配队公式：「6 核心 + 2 机动位」
    <span class="bh-note">
      核心盟约满档只需 6 名不同角色，余下 2 个空位搭配小盟约
    </span>
  </h3>
  <div class="puzzle-grid">
    <div class="card">
      <h4>为什么推荐配队大多是「6 本家 + 2 外援」？</h4>
      <p style="margin: 0; font-size: 13px; color: var(--ink2)">
        大型核心盟约（如乌萨斯、维多利亚）满档只需
        <b>6 名不同角色</b>
        （上第 7、8 人不会多开新档位）；省下的
        <b>2 个机动位</b>
        配合身兼双标签的角色，刚好能同时点亮 2～3 个小型附加盟约：
      </p>
      <div class="eight-slots" aria-label="8 人口黄金配比示意">
        <div v-for="n in 6" :key="'c' + n" class="e-slot core">
          <b>核心位 {{ n }}</b>
          <span>凑齐 6 人开强化</span>
        </div>
        <div class="e-slot flex">
          <b>机动位 7</b>
          <span>补小盟约/治疗</span>
        </div>
        <div class="e-slot flex">
          <b>机动位 8</b>
          <span>叠层加速辅助</span>
        </div>
      </div>
      <div class="card-foot">
        核心盟约 3 人激活基础效果、6 人解锁强力质变；
        <b>同名角色重复上场只计为 1 人</b>
        。
      </div>
    </div>

    <div class="card">
      <h4>三大特殊人数计算规则</h4>
      <div class="roster-tracks">
        <div class="r-track">
          <span class="ic-box sm" style="--ic-c: var(--teal)">
            <Markup :html="iconSvg('box', 'g-ic sm')" />
          </span>
          <div>
            <strong class="r-track-title">
              放在备战席也算人数（不占上场位！）
            </strong>
            <div class="row" style="margin-top: 4px">
              <Markup v-for="n in reserveNames" :key="n" :html="cv(n)" />
            </div>
          </div>
        </div>
        <div class="r-track">
          <span class="ic-box sm" style="--ic-c: var(--accent)">
            <Markup :html="iconSvg('spark', 'g-ic sm')" />
          </span>
          <div>
            <strong class="r-track-title">
              万能凑数：
              <Markup :html="cv('调和')" />
            </strong>
            <p>1 人即让场上已有的核心盟约人数 +1，且共享其加成。</p>
          </div>
        </div>
        <div class="r-track">
          <span class="ic-box sm" style="--ic-c: #8a68b8">
            <Markup :html="iconSvg('merge', 'g-ic sm')" />
          </span>
          <div>
            <strong class="r-track-title">
              <Markup :html="cv('独行')" />
              与
              <Markup :html="cv('绝技')" />
            </strong>
            <p>
              独行仅限场上
              <b>恰好 1 名</b>
              （多了失效）；绝技看场上
              <b>任意精锐总数</b>
              （2/5 人，永不进禁池）。
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="row" style="justify-content: space-between; margin-bottom: 10px">
    <SubTabs
      v-model="covFilter"
      :items="covFilterTabs"
      :level="3"
      inline
      aria-label="盟约分类筛选" />
    <a class="qlink" href="/overview">
      去速览页查禁池与全盟约
      <Markup :html="iconSvg('link', 'g-ic sm')" />
    </a>
  </div>
  <Markup as="div" class="covg" id="covg" :html="filteredCovenantHtml" />

  <h3 class="bh">
    <span>4.2</span>
    叠层四步流水线
    <span class="bh-note">激活 → 触发 → 转永久 → 倍率放大</span>
  </h3>
  <div class="snowball-pipe">
    <div class="sb-node" style="--nc: var(--teal)">
      <span class="sb-no">STEP 01 · 前提</span>
      <b>先凑人数点亮盟约</b>
      <p>
        未激活的盟约默认
        <b>叠不上层数</b>
        ！唯一例外是消耗装
        <Markup :html="eq('随身身份牌')" />
        可无视激活直接 +3/+6 层。
      </p>
    </div>
    <div class="sb-node" style="--nc: var(--t4)">
      <span class="sb-no">STEP 02 · 引擎</span>
      <b>选定主叠层触发源</b>
      <p>
        如炎靠「获得时」买卖倒牌、叙拉古靠「刷新时」D牌、萨尔贡靠开技能、谢拉格靠冻结、乌萨斯靠击倒。
      </p>
    </div>
    <div class="sb-node" style="--nc: var(--accent)">
      <span class="sb-no">STEP 03 · 留存</span>
      <b>把临时层转为固定层</b>
      <p>
        战斗中获得的
        <GlossaryText text="临时层" />
        打完会清空，必须留
        <Markup :html="op('折桠')" />
        <Markup :html="op('乌啾')" />
        等干员按各自特质指定的层数转成永久
        <b>固定层</b>
        ！
      </p>
    </div>
    <div class="sb-node" style="--nc: var(--red)">
      <span class="sb-no">STEP 04 · 放大</span>
      <b>架设上限与倍率拐</b>
      <p>
        用
        <Markup :html="op('Mon3tr')" />
        <Markup :html="op('凛御银灰')" />
        <Markup :html="op('薇薇安娜')" />
        抬高每回合上限，配
        <Markup :html="op('阿米娅')" />
        为身前一格干员在战斗中每次叠层额外 +1/+2！
      </p>
    </div>
  </div>

  <div class="g2">
    <div class="card">
      <h4>固定层 vs 临时层滚雪球示意（以乌萨斯为例）</h4>
      <Markup as="div" class="stk" id="stk" :html="content.stk" />
      <div class="legend">
        <span>
          <i style="background: var(--teal)"></i>
          固定层数（整局永久保留）
        </span>
        <span>
          <i style="background: var(--accent)"></i>
          临时层数（仅本场有效，赛后按特质转化）
        </span>
      </div>
    </div>
    <div class="card">
      <h4>常见五类干员特质定位速认</h4>
      <div style="display: grid; gap: 8px; font-size: 13px">
        <div class="fxr">
          <span class="tag a">单次叠加</span>
          <div class="row">
            <span>获得/售出时立刻给层（常买完即卖倒牌）</span>
            <Markup :html="op('拜松')" />
            <Markup :html="op('仇白')" />
          </div>
        </div>
        <div class="fxr">
          <span class="tag a">持续叠加</span>
          <div class="row">
            <span>在场每回合/每次刷新/战斗中反复刷层</span>
            <Markup :html="op('引星棘刺')" />
            <Markup :html="op('安洁莉娜')" />
          </div>
        </div>
        <div class="fxr">
          <span class="tag t">作战能力</span>
          <div class="row">
            <span>把已有层数兑现成高额自身输出</span>
            <Markup :html="op('真言')" />
            <Markup :html="op('水灯心')" />
          </div>
        </div>
        <div class="fxr">
          <span class="tag t">整备能力</span>
          <div class="row">
            <span>每回合产出资金、免费刷新或进阶装备</span>
            <Markup :html="op('酒神')" />
            <Markup :html="op('白铁')" />
          </div>
        </div>
        <div class="fxr">
          <span class="tag">复制/倍增</span>
          <div class="row">
            <span>投资人触发 2→3 次；塞雷娅复制身前休整特质</span>
            <Markup :html="cv('投资人')" />
            <Markup :html="op('塞雷娅')" />
          </div>
        </div>
      </div>
    </div>
  </div>

  <h3 class="bh">
    <span>4.3</span>
    特质触发时机时间轴
    <span class="bh-note">点选时机节点查看对应干员</span>
  </h3>
  <div class="card">
    <div
      class="row"
      style="justify-content: space-between; margin-bottom: 10px">
      <span class="cnt">点击下方任一时机节点筛选干员特质</span>
      <Segmented
        :labels="['初始特质', '精锐特质']"
        :active="triggerElite ? 1 : 0"
        attr="trig-el"
        @change="triggerElite = $event === 1" />
    </div>
    <div class="trig" id="trig">
      <div class="zone z1">休整期内</div>
      <div class="zone z2">阶段边界</div>
      <div class="zone z3">作战阶段</div>
      <button
        v-for="([label], i) in TRIGGERS"
        :key="label"
        type="button"
        :data-i="i"
        :class="{on: trigger === i}"
        :aria-pressed="trigger === i"
        aria-controls="tlist"
        @click="trigger = i">
        <b>{{ triggerLists[i].length }}</b>
        {{ label }}
      </button>
    </div>
    <div class="tlist" id="tlist">
      <div
        v-for="operator in triggerLists[trigger]"
        :key="operator.name"
        :data-key="operator.name">
        <Markup :html="op(operator.name, triggerElite ? 'el' : '')" />
        {{ traitText(triggerElite ? operator.elite : operator.trait) }}
      </div>
    </div>
  </div>

  <h3 class="bh" id="s44">
    <span>4.4</span>
    站位与部署朝向
    <span class="bh-note">
      身前/身后跟随干员面朝箭头旋转，联机右半场自动镜像
    </span>
  </h3>
  <div class="g2">
    <div class="card">
      <div
        class="row"
        style="justify-content: space-between; margin-bottom: 12px">
        <SubTabs
          id="posseg"
          v-model="position"
          :items="positionTabs"
          :level="3"
          inline
          aria-label="站位关系" />
        <label class="row" style="font-size: 13px; gap: 6px">
          <input type="checkbox" id="mirror" v-model="mirror" />
          联机右侧镜像
        </label>
      </div>
      <div class="pos" id="pos">
        <div
          v-for="(cell, i) in positionCells"
          :key="i"
          :class="{me: cell.me, on: cell.on}">
          {{ cell.me ? (mirror ? '我 ◀' : '我 ▶') : cell.on ? '生效' : '' }}
        </div>
      </div>
      <div class="card-foot">
        <b>布阵切记：</b>
        「身前一格」取决于干员面朝方向（朝上摆则上方才是身前）；
        <Markup :html="cv('阿戈尔')" />
        开战会吞噬身前一格友军，切勿把主 C 摆在阿戈尔正前方！
      </div>
    </div>
    <div class="card">
      <h4 id="posTitle">
        涉及「{{ keyword }}」的干员与盟约 · {{ positionOperators.length }} 名
      </h4>
      <div class="row" id="posOps">
        <Markup
          v-for="operator in positionOperators"
          :key="operator.name"
          :html="op(operator.name)" />
        <Markup v-if="keyword === '身前一格'" :html="cv('阿戈尔')" />
        <Markup v-if="keyword === '周围四格'" :html="cv('灵巧')" />
        <span v-if="keyword === '周围八格'" class="tag a">
          灵巧满 40 层扩至八格
        </span>
      </div>
    </div>
  </div>

  <h3 class="bh">
    <span>4.5</span>
    盟约层数收益计算器
    <span class="bh-note">拖动滑块实时预览 0–300 层加成与质变线</span>
  </h3>
  <div class="card">
    <div class="calc">
      <div>
        <div class="row" style="margin-bottom: 10px">
          <label for="cvSel" class="lab" style="margin: 0">盟约</label>
          <SelectInput
            id="cvSel"
            v-model="covenant"
            :options="scalableCovenantOptions"
            aria-label="选择盟约" />
        </div>
        <div class="row" style="justify-content: space-between">
          <label for="cvL" class="lab" style="margin: 0">当前模拟层数</label>
          <b
            class="num"
            style="font-size: 28px; color: var(--accent)"
            id="cvLv">
            {{ layers }} 层
          </b>
        </div>
        <input
          type="range"
          id="cvL"
          min="0"
          max="300"
          v-model.number="layers" />
        <div class="vals mt" id="cvVals">
          <div v-for="entry in values" :key="entry.label">
            <span>{{ entry.label }}</span>
            <b>
              {{ entry.value }}
              <small style="font-size: 14px; color: var(--ink2)">
                {{ entry.unit }}
              </small>
            </b>
          </div>
        </div>
        <p
          id="cvBase"
          style="font-size: 13px; color: var(--ink2); margin: 12px 0 0">
          {{ selectedCovenant.effect }}
        </p>
        <p
          id="cvBig"
          style="font-size: 13px; color: var(--ink); margin: 6px 0 0">
          {{ selectedCovenant.bonus }}
        </p>
      </div>
      <svg
        class="svgbox"
        id="cvChart"
        viewBox="0 0 440 260"
        role="img"
        :aria-label="`${covenant}层数与效果曲线`"
        aria-describedby="covenant-chart-description cvBase cvBig">
        <desc id="covenant-chart-description">{{ curveDescription }}</desc>
        <defs>
          <clipPath id="covenant-area-clip">
            <rect x="46" y="0" :width="marker.x - 46" height="228" />
          </clipPath>
        </defs>
        <g v-for="tick in curve.yTicks" :key="tick.y">
          <line class="gl" x1="46" x2="428" :y1="tick.y" :y2="tick.y" />
          <text class="axl" x="40" :y="tick.y + 4" text-anchor="end">
            {{ tick.label }}
          </text>
        </g>
        <g v-for="ms in curve.milestones" :key="ms.layers">
          <line
            :x1="ms.x"
            :x2="ms.x"
            y1="20"
            y2="228"
            stroke="var(--teal)"
            stroke-dasharray="4 3" />
          <text
            class="axl"
            :x="ms.x"
            y="30"
            text-anchor="middle"
            style="fill: var(--teal); font-weight: 700">
            {{ ms.layers }}层质变
          </text>
        </g>
        <text
          v-for="tick in curve.xTicks"
          :key="tick.label"
          class="axl"
          :x="tick.x"
          y="246"
          text-anchor="middle">
          {{ tick.label }}
        </text>
        <path class="ar" :d="curve.area" clip-path="url(#covenant-area-clip)" />
        <path class="ln" :d="curve.path" />
        <line
          :x1="marker.x"
          :x2="marker.x"
          y1="228"
          :y2="marker.y"
          stroke="var(--accent)"
          stroke-dasharray="3 3" />
        <circle class="dot" :cx="marker.x" :cy="marker.y" r="6" />
        <text class="axl" x="46" y="13" style="fill: var(--ink2)">
          {{ curve.main.label }}（{{ curve.main.unit || '数值' }}）
        </text>
        <text class="axl" x="428" y="222" text-anchor="end">层数</text>
      </svg>
    </div>
  </div>

  <h3 class="bh">
    <span>4.6</span>
    开局策略（指挥官技能与初始生命）
  </h3>
  <div class="card">
    <div class="row" style="justify-content: space-between">
      <SubTabs
        id="stseg"
        v-model="strategyCategory"
        :items="strategyTabs"
        :level="3"
        inline
        aria-label="策略类别" />
      <div class="row">
        <span class="cnt" id="stcnt">{{ strategyContent.stcnt }}</span>
        <a class="qlink" href="/strategies">
          去策略页搜索筛选
          <Markup :html="iconSvg('link', 'g-ic sm')" />
        </a>
      </div>
    </div>
    <p class="sim-hint" style="margin: 8px 0 0">
      <b>读卡提示：</b>
      ♥ 数字代表本局初始目标生命（20–40）；标注「点击(N) /
      拖拽(N)」代表每次发动主动指令需消耗 N 资金。
    </p>
    <Markup as="div" class="stg" id="stg" :html="strategyContent.stg" />
  </div>
</template>
