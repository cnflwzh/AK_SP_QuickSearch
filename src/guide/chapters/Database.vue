<script setup lang="ts">
import {computed, ref} from 'vue';
import {
  ALL_COVENANTS,
  COMBAT_ROLES,
  EQUIPMENT,
  OPERATORS,
  OPERATOR_TYPES,
  SEASON_META,
  TIER_LABELS,
  equipmentWithRoles,
  operatorRolesAtElite,
  type CombatRole,
} from '../../../data/index.ts';
import LiveStatus from '../../lib/ui/LiveStatus.vue';
import {nameScore, normalize} from '../../lib/ui/match.ts';
import EmptyState from '../../quickref/components/EmptyState.vue';
import SearchInput from '../../quickref/components/SearchInput.vue';
import Segmented from '../../quickref/components/Segmented.vue';
import SelectInput, {
  type SelectOption,
} from '../../quickref/components/SelectInput.vue';
import SubTabs, {type SubTabItem} from '../../quickref/components/SubTabs.vue';
import {avatar, cv, eq} from '../chips.ts';
import Markup from '../components/Markup.ts';
import {ROLE_ICONS, iconSvg, type GuideIconName} from '../icons.ts';

const pitfalls: readonly {bad: string; good: string; key: string}[] = [
  {
    key: 'money',
    bad: '省吃俭用留五六块钱进战斗，想攒到下回合吃利息',
    good: '<b>钱不过夜！</b>开战余钱直接清零（仅坎诺特保留）；花不完先买干员存备战席。',
  },
  {
    key: 'pop',
    bad: '照搬传统自走棋，前期狂点升本想靠等级多上几个人',
    good: `<b>升本不加人口。</b>默认有 ${SEASON_META.baseDeploymentLimit} 个部署位。想多上一人，需要增加部署位的效果。`,
  },
  {
    key: 'diy',
    bad: '备战把 Ⅴ/Ⅵ 阶自选干员槽全塞满，还忘借 30 个助战位',
    good: '<b>先补缺少的 6★，再选自选干员。</b>未持有的可借用 6★ 需要借同名助战才能保留特质。自选干员无特质，带得越多，高阶池越分散。',
  },
  {
    key: 'active',
    bad: '核心盟约才上 1～2 个人，就拼命买卖刷牌想叠层数',
    good: '<b>先点亮再叠层！</b>未激活的盟约默认加不上层数（仅消耗装「随身身份牌」例外）。',
  },
  {
    key: 'reward',
    bad: '合成精锐弹出三选一奖励，纠结太久忘点直接进战斗',
    good: '<b>碰牌当回合必领！</b>精锐奖励 0 费但不能刷新、不能锁店，过回合直接消失作废。',
  },
  {
    key: 'equip',
    bad: '好装备随手穿满前期过渡角色，或给已满 2 件装备的主力硬塞第 3 件',
    good: '<b>装备穿了脱不掉！</b>穿第 3 件时可选择替换哪件，也可取消。确认替换会销毁所选旧装备。',
  },
  {
    key: 'facing',
    bad: '抄作业只摆对格子，没注意箭头朝向把主 C 放阿戈尔嘴前',
    good: '<b>站对格更要转对脸！</b>身前/身后按面朝方向判定；联机分到右半场还会左右镜像。',
  },
  {
    key: 'bounty',
    bad: '道中没对空、没反隐，机变回合看到 +4/+5 悬赏无脑点',
    good: '<b>量力打赏金！</b>+4/+5 悬赏多带重生缴械秒坦；阵容未稳时宁可选 0 费源石虫保血。',
  },
];

const tier = ref(0);
const covenant = ref('');
const type = ref('');
const role = ref<CombatRole | ''>('');
const query = ref('');
const elite = ref(false);
const expanded = ref(false);

const tierTabs: readonly SubTabItem<number>[] = [
  '全部',
  ...TIER_LABELS.slice(1),
].map((label, id) => ({id, label}));

const covenantOptions: readonly SelectOption<string>[] = [
  {value: '', label: '全部盟约'},
  ...ALL_COVENANTS.map((name) => ({value: name, label: name})),
];
const typeOptions: readonly SelectOption<string>[] = [
  {value: '', label: '全部特质类型'},
  ...OPERATOR_TYPES.map((name) => ({value: name, label: name})),
];

const activeRoleMeta = computed(() =>
  role.value ? COMBAT_ROLES.find((item) => item.label === role.value) : null,
);
const activeRoleEquip = computed(() =>
  role.value ? equipmentWithRoles([role.value]) : [],
);

const hasFilter = computed(() =>
  Boolean(
    tier.value ||
    covenant.value ||
    type.value ||
    role.value ||
    query.value.trim(),
  ),
);

function resetFilters() {
  tier.value = 0;
  covenant.value = '';
  type.value = '';
  role.value = '';
  query.value = '';
}

const operators = computed(() => {
  const raw = query.value.trim();
  const q = normalize(raw);
  return OPERATORS.filter((o) => {
    if (tier.value && o.tier !== tier.value) return false;
    if (covenant.value && !o.covenants.includes(covenant.value)) return false;
    if (type.value && o.type !== type.value) return false;
    if (
      role.value &&
      !operatorRolesAtElite(o, elite.value).includes(role.value)
    ) {
      return false;
    }
    if (!q) return true;
    if (nameScore(o.name, q) > 0) return true;
    if (o.covenants.some((c) => nameScore(c, q) > 0)) return true;
    const text = elite.value ? o.elite : o.trait;
    return text.toLowerCase().includes(raw.toLowerCase());
  });
});

const INITIAL_LIMIT = 12;
const visibleOperators = computed(() =>
  hasFilter.value || expanded.value
    ? operators.value
    : operators.value.slice(0, INITIAL_LIMIT),
);

const traitHtml = (text: string) =>
  text.replace(/<([^>]+)>/g, '<b style="color:var(--accent)">$1</b> ');

const workflows: readonly {
  step: string;
  icon: GuideIconName;
  title: string;
  desc: string;
  href: string;
  cta: string;
}[] = [
  {
    step: 'STEP 01 · 局前准备',
    icon: 'box',
    title: '配好「我的 Box」',
    desc: '支持 MAA JSON 与一图流 Excel 一键导入练度，自动标出缺口 6★ 提醒备战借满助战。',
    href: '/box',
    cta: '前往我的 Box',
  },
  {
    step: 'STEP 02 · 开局定阵',
    icon: 'stack',
    title: '选定本局流派',
    desc: '选好预设或导入森空岛攻略后点「设为本局」，再到速览标记禁池，查干员和装备时即可看到推荐与替补。',
    href: '/builds',
    cta: '前往流派规划',
  },
  {
    step: 'STEP 03 · 战前看敌',
    icon: 'skull',
    title: '查 Boss 站位与悬赏',
    desc: '对照真实地形查看 Boss 巡逻路线、索敌九宫格与隐秘核心变化，秒查对策干员。',
    href: '/enemies',
    cta: '前往敌人情报',
  },
  {
    step: 'STEP 04 · 局内工具',
    icon: 'spark',
    title: '速查门槛 & 痛扁发牌',
    desc: '边打边算盟约下一档层数与刷牌预算，查术语黑话，闲暇还能做每日发牌挑战记图鉴。',
    href: '/tools',
    cta: '打开小工具箱',
  },
];
</script>
<template>
  <div class="chap-h">
    <span class="no">06</span>
    <div>
      <h2>避坑与实战</h2>
      <p class="en">PITFALLS · COMBAT ROLES · QUICKREF WORKFLOW</p>
    </div>
  </div>
  <p class="chap-lead">
    上场前最后过一遍
    <b>新手八大高频翻车点</b>
    ，学会按
    <b>13 类实战职能</b>
    抓对策牌，再把速查页挂在手机悬浮小窗或电脑分屏里边打边查。
  </p>

  <h3 class="bh">
    <span>6.1</span>
    新手八大高频翻车点
  </h3>
  <div class="pitfall-grid">
    <div v-for="item in pitfalls" :key="item.key" class="pitfall-card">
      <div class="pf-bad">
        <Markup :html="iconSvg('cross', 'g-ic')" />
        <span>{{ item.bad }}</span>
      </div>
      <div class="pf-good">
        <Markup :html="iconSvg('check', 'g-ic')" />
        <Markup as="span" :html="item.good" />
      </div>
    </div>
  </div>

  <h3 class="bh">
    <span>6.2</span>
    13 类实战职能与干员速查
    <span class="bh-note">点选职能秒查对空、反隐、元素奶等对策干员</span>
  </h3>
  <div class="role-pills" role="group" aria-label="按实战职能筛选对策">
    <button
      type="button"
      class="role-pill"
      :class="{on: role === ''}"
      :aria-pressed="role === ''"
      @click="role = ''">
      全部职能
    </button>
    <button
      v-for="item in COMBAT_ROLES"
      :key="item.id"
      type="button"
      class="role-pill"
      :class="{on: role === item.label}"
      :aria-pressed="role === item.label"
      @click="role = role === item.label ? '' : item.label">
      <Markup :html="iconSvg(ROLE_ICONS[item.label], 'g-ic sm')" />
      {{ item.label }}
    </button>
  </div>

  <div v-if="activeRoleMeta" class="role-banner">
    <b>【{{ activeRoleMeta.label }}】</b>
    {{ activeRoleMeta.desc }}
    <span v-if="activeRoleMeta.trainingTypes?.length">
      （常用于针对：
      <b>{{ activeRoleMeta.trainingTypes.join('、') }}</b>
      特训）
    </span>
    <div v-if="activeRoleEquip.length" class="row" style="margin-top: 6px">
      <span class="cnt">同职能对策装备：</span>
      <Markup
        v-for="item in activeRoleEquip"
        :key="item.name"
        :html="eq(item.name)" />
    </div>
  </div>

  <div class="dbf">
    <SubTabs
      id="dbTier"
      v-model="tier"
      :items="tierTabs"
      :level="3"
      inline
      aria-label="干员等阶" />
    <SelectInput
      id="dbCov"
      v-model="covenant"
      :options="covenantOptions"
      highlight-active
      aria-label="盟约" />
    <SelectInput
      id="dbType"
      v-model="type"
      :options="typeOptions"
      highlight-active
      aria-label="特质类型" />
    <SearchInput
      id="dbQ"
      v-model="query"
      placeholder="搜干员名 / 拼音 / 特质词…"
      aria-label="搜索干员" />
    <Segmented
      id="dbEl"
      :labels="['初始', '精锐']"
      :active="elite ? 1 : 0"
      attr="db-el"
      @change="elite = $event === 1" />
    <span class="cnt" id="dbN">
      {{ operators.length }} / {{ OPERATORS.length }}
    </span>
  </div>

  <div v-if="!operators.length" class="card">
    <EmptyState
      message="当前筛选下没有匹配的干员"
      action-label="清空全部筛选"
      :show-action="hasFilter"
      @action="resetFilters" />
  </div>
  <template v-else>
    <div class="dbg" id="dbg">
      <div
        v-for="operator in visibleOperators"
        :key="operator.name"
        class="dbc"
        :data-key="operator.name"
        :data-op="operator.name"
        :data-t="operator.tier">
        <div class="t">
          <Markup :html="avatar(operator.name)" />
          <i>{{ TIER_LABELS[operator.tier] }}</i>
          <b>{{ operator.name }}</b>
          <span class="s">
            {{ operator.stars ? '★' + operator.stars : '' }}
          </span>
        </div>
        <div class="row">
          <Markup
            v-for="name in operator.covenants"
            :key="name"
            :html="cv(name)" />
          <span class="tag">{{ operator.type }}</span>
          <span
            v-for="r in operatorRolesAtElite(operator, elite)"
            :key="r"
            class="tag t">
            {{ r }}
          </span>
        </div>
        <Markup
          as="div"
          class="tx"
          :html="traitHtml(elite ? operator.elite : operator.trait)" />
      </div>
    </div>
  </template>
  <div class="row mt" style="justify-content: center">
    <button
      v-if="!hasFilter && operators.length > INITIAL_LIMIT"
      type="button"
      class="btn"
      @click="expanded = !expanded">
      {{
        expanded
          ? '收起干员预览 ▴'
          : `展开全部 ${operators.length} 名固定池干员 ▾`
      }}
    </button>
    <a class="qlink" href="/operators">
      完整干员图鉴（含自选/替补）
      <Markup :html="iconSvg('link', 'g-ic sm')" />
    </a>
    <a id="eqcols" class="qlink" href="/equipment">
      查全部 {{ EQUIPMENT.length }} 件装备与合成配方
      <Markup :html="iconSvg('link', 'g-ic sm')" />
    </a>
  </div>

  <h3 class="bh">
    <span>6.3</span>
    四步把「卫戍速查」带进对局
  </h3>
  <div class="workflow-grid">
    <a v-for="wf in workflows" :key="wf.step" :href="wf.href" class="wf-card">
      <div class="wf-top">
        <span class="wf-step">{{ wf.step }}</span>
        <span class="ic-box sm">
          <Markup :html="iconSvg(wf.icon, 'g-ic sm')" />
        </span>
      </div>
      <b>{{ wf.title }}</b>
      <p>{{ wf.desc }}</p>
      <span class="wf-go">
        {{ wf.cta }}
        <Markup :html="iconSvg('link', 'g-ic sm')" />
      </span>
    </a>
  </div>

  <div class="card mt">
    <h4>局内分屏与悬浮小窗小贴士</h4>
    <ul class="ul">
      <li>
        <b>手机 / 平板玩家：</b>
        浏览器菜单选择「添加到主屏幕」，对局时用系统悬浮小窗打开，既能随时查表又不遮挡战场。
      </li>
      <li>
        <b>电脑分屏玩家：</b>
        在速查页按
        <code>/</code>
        键即可聚焦搜索框，支持拼音与首字母秒搜，按
        <code>Enter</code>
        直开首条详情。
      </li>
      <li>
        <b>页面内随手速览：</b>
        鼠标悬停或触屏长按任意干员、装备、盟约芯片及虚线术语，即可原地弹出数值卡片。
      </li>
    </ul>
    <div class="card-foot">
      <div class="row">
        <a class="qlink" href="/tools?tool=glossary">
          查全部游戏术语词典
          <Markup :html="iconSvg('link', 'g-ic sm')" />
        </a>
        <a class="qlink" href="/tools?tool=dealer">
          去「痛扁发牌」练记牌
          <Markup :html="iconSvg('link', 'g-ic sm')" />
        </a>
      </div>
    </div>
  </div>

  <LiveStatus
    :message="
      hasFilter ? `职能与干员筛选结果：${operators.length} 名干员` : ''
    " />
</template>
