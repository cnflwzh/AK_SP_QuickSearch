<script setup lang="ts">
import {computed, reactive, ref, watch} from 'vue';
import {
  OPERATORS,
  OPERATOR,
  DISPATCH_BY_MODE,
  DISPATCH_MODES,
  RESTRICTED_MODE_COVENANTS,
  operatorEliteCopies,
  operatorPrice,
  operatorSellMechanics,
  operatorSellPrice,
  TIER_LABELS,
  TIERS,
} from '../../../data/index.ts';
import {avatar} from '../chips.ts';
import {isBanned} from '../../lib/recommendation/planning.ts';
import {dispatchTable} from '../chapters/recruitView.ts';
import SelectInput, {
  type SelectOption,
} from '../../quickref/components/SelectInput.vue';
import Markup from './Markup.ts';

const dispatchModeOptions: readonly SelectOption<number>[] = DISPATCH_MODES.map(
  (label, i) => ({value: i, label}),
);

interface BenchCard {
  id: number;
  name: string;
  elite: boolean;
  pop: boolean;
  sale: number;
}
interface ShopState {
  level: number;
  cost: number;
  round: number;
  spent: number;
  frozen: boolean;
  bench: BenchCard[];
  reward: string[] | null;
  slots: (string | null)[];
}
const BENCH_SIZE = 10;
const maxTier = Math.max(...TIERS);
const mode = ref(0),
  lowSolo = ref(false),
  shopRoll = ref(0),
  flip = ref(false);
const maxLevel = computed(() => DISPATCH_BY_MODE[mode.value].at(-1)!.level);
const sim = reactive<ShopState>({
  level: 1,
  cost: 5,
  round: 1,
  spent: 0,
  frozen: false,
  bench: [],
  reward: null,
  slots: [],
});
let cardId = 0;
const restrictedBans = new Set(RESTRICTED_MODE_COVENANTS);
const eligible = computed(() => {
  const restricted = mode.value !== 0 || lowSolo.value;
  return OPERATORS.filter(
    (op) => op.stars > 0 && (!restricted || !isBanned(op.name, restrictedBans)),
  );
});
const pools = computed(() =>
  Array.from({length: maxLevel.value + 1}, (_, level) =>
    eligible.value.filter((op) => op.tier <= level),
  ),
);
const pickRandom = <T,>(list: readonly T[]): T =>
  list[Math.floor(Math.random() * list.length)];
const randomOperator = (level: number) => pickRandom(pools.value[level]).name;
const levelInfo = (level: number) => DISPATCH_BY_MODE[mode.value][level - 1];
const tierOf = (name: string) => OPERATOR[name].tier;
const priceOf = (name: string) => operatorPrice(OPERATOR[name]);
const covenantsOf = (name: string) => OPERATOR[name].covenants.join(' · ');
const hasBenchCopy = (name: string) =>
  sim.bench.some((card) => !card.elite && card.name === name);
const info = computed(() => levelInfo(sim.level));
const maxed = computed(() => sim.level >= maxLevel.value);
const costPercent = computed(() =>
  maxed.value ? 0 : (sim.cost / (info.value.upgradeCost ?? 1)) * 100,
);
const benchCells = computed(() =>
  Array.from({length: BENCH_SIZE}, (_, i) => sim.bench[i]),
);

function beginAction() {
  flip.value = false;
  sim.bench.forEach((card) => {
    card.pop = false;
  });
}
function rollShop() {
  shopRoll.value++;
  flip.value = true;
  sim.slots = Array.from({length: info.value.operatorSlots}, () =>
    randomOperator(sim.level),
  );
}
function reset() {
  Object.assign(sim, {
    level: 1,
    cost: levelInfo(1).upgradeCost ?? 0,
    round: 1,
    spent: 0,
    frozen: false,
    bench: [],
    reward: null,
    slots: [],
  });
  rollShop();
}
function tryMerge(name: string) {
  const need = operatorEliteCopies(name);
  const copies = sim.bench
    .map((card, i) => (!card.elite && card.name === name ? i : -1))
    .filter((i) => i >= 0);
  if (copies.length < need) return;
  const used = copies.slice(0, need);
  sim.bench = sim.bench.filter((_, i) => !used.includes(i));
  sim.bench.push({
    id: ++cardId,
    name,
    elite: true,
    pop: true,
    sale: operatorSellPrice(name, true),
  });
  const pool = eligible.value
    .filter((o) => o.tier === Math.min(maxTier, sim.level + 1))
    .map((o) => o.name);
  const picks = new Set<string>();
  while (picks.size < 3 && picks.size < pool.length)
    picks.add(pickRandom(pool));
  sim.reward = [...picks];
}
function addToBench(name: string) {
  sim.bench.push({
    id: ++cardId,
    name,
    elite: false,
    pop: true,
    sale: operatorSellPrice(name, false),
  });
  tryMerge(name);
}
function buy(index: number) {
  const name = sim.slots[index];
  if (!name || sim.reward || sim.bench.length >= BENCH_SIZE) return;
  beginAction();
  sim.slots[index] = null;
  sim.spent += priceOf(name);
  addToBench(name);
}
function claimReward(index: number) {
  const name = sim.reward?.[index];
  if (!name || sim.bench.length >= BENCH_SIZE) return;
  beginAction();
  sim.reward = null;
  addToBench(name);
}
function sell(index: number) {
  const card = sim.bench[index];
  if (!card) return;
  beginAction();
  sim.spent -= card.sale;
  sim.bench.splice(index, 1);
}
function refresh() {
  if (sim.reward) return;
  beginAction();
  sim.spent++;
  rollShop();
}
function freeze() {
  if (sim.reward) return;
  beginAction();
  sim.frozen = !sim.frozen;
}
function upgrade() {
  if (maxed.value || sim.reward) return;
  beginAction();
  sim.spent += sim.cost;
  sim.level++;
  sim.cost = info.value.upgradeCost ?? 0;
  while (sim.slots.length < info.value.operatorSlots)
    sim.slots.push(randomOperator(sim.level));
}
function nextRound() {
  beginAction();
  sim.bench.forEach((card) => {
    const growth = operatorSellMechanics(card.name)?.roundGrowth;
    if (growth) {
      card.sale = Math.min(
        card.elite ? growth.eliteMax : growth.baseMax,
        card.sale + (card.elite ? growth.eliteStep : growth.baseStep),
      );
    }
  });
  sim.round++;
  sim.cost = Math.max(0, sim.cost - 1);
  sim.reward = null;
  if (sim.frozen) {
    sim.frozen = false;
    sim.slots = sim.slots.map((name) => name || randomOperator(sim.level));
  } else rollShop();
}
watch([mode, lowSolo], reset);
reset();
</script>
<template>
  <h3 class="bh">
    <span>2.2</span>
    调度中心模拟演练
    <span class="bh-note">亲手试一次「升本降价」与「三合一碰牌」</span>
  </h3>
  <div class="card">
    <p class="sim-hint">
      <b>试一试：</b>
      先点两下「下一回合」看升本费自动减 1 → 点「升本」解锁高阶卡 → 买齐 3
      张同名干员（金框提示已有同款）触发 0 费高一阶三选一。
      演练从当前可选干员中等概率抽牌，不能据此估算游戏内出率。
    </p>
    <div class="row" style="margin-bottom: 14px">
      <label for="dispatchMode">模式</label>
      <SelectInput
        id="dispatchMode"
        v-model="mode"
        :options="dispatchModeOptions"
        aria-label="调度模式" />
      <label v-if="mode === 0" class="row" style="font-size: 13px; gap: 5px">
        <input v-model="lowSolo" type="checkbox" />
        规程 1–4（缺席 8 盟约）
      </label>
    </div>
    <div class="sim">
      <div class="lvl">
        <div class="lv-badge">
          <span class="big num" id="sLv">{{ sim.level }}</span>
          <span>级调度中心（{{ sim.level }} 本）</span>
        </div>
        <div class="tiers" id="sTiers">
          <div
            v-for="tier in TIERS"
            :key="tier"
            :data-t="tier"
            :class="{on: tier <= sim.level}">
            {{ TIER_LABELS[tier] }}
          </div>
        </div>
        <div>
          <div
            class="row"
            style="justify-content: space-between; font-size: 13px">
            <span>当前升本费用</span>
            <b class="num" style="font-size: 22px" id="sCost">
              {{ maxed ? 'MAX' : sim.cost }}
            </b>
          </div>
          <div class="cd">
            <div id="sCd" :style="{width: costPercent + '%'}"></div>
          </div>
        </div>
        <div class="stat3">
          <div>
            <b class="num" id="sRound">{{ sim.round }}</b>
            <span>回合</span>
          </div>
          <div>
            <b class="num" id="sSpent">{{ sim.spent }}</b>
            <span>净花费</span>
          </div>
          <div>
            <b class="num" id="sSlots">{{ info.operatorSlots }}</b>
            <span>干员栏</span>
          </div>
        </div>
        <div class="row">
          <button
            class="btn p"
            id="bUp"
            :disabled="maxed || !!sim.reward"
            @click="upgrade">
            升本
            <b id="bUpC">{{ maxed ? '—' : sim.cost }}</b>
          </button>
          <button
            class="btn"
            id="bRef"
            :disabled="!!sim.reward"
            @click="refresh">
            刷新
            <b>1</b>
          </button>
          <button
            class="btn"
            id="bFrz"
            :class="{p: sim.frozen}"
            :aria-pressed="sim.frozen"
            :disabled="!!sim.reward"
            @click="freeze">
            {{ sim.frozen ? '已锁店 ❄' : '锁店' }}
          </button>
          <button class="btn" id="bNext" @click="nextRound">下一回合 ▸</button>
          <button class="btn" id="bReset" @click="reset">重置</button>
        </div>
      </div>
      <div>
        <div class="slots" id="sShop" :class="{frozen: sim.frozen}">
          <button
            v-for="(name, i) in sim.slots"
            type="button"
            :disabled="!name || !!sim.reward || sim.bench.length >= BENCH_SIZE"
            :aria-label="name ? `招募${name}，${priceOf(name)} 资金` : '空栏位'"
            :key="shopRoll + ':' + i"
            class="slot"
            :class="{
              empty: !name,
              flip: !!name && flip,
              pair: !!name && hasBenchCopy(name),
            }"
            :data-key="'shop:' + shopRoll + ':' + i"
            :data-i="name ? i : undefined"
            :data-t="name ? tierOf(name) : undefined"
            @click="buy(i)">
            <template v-if="name">
              <Markup :html="avatar(name)" />
              <span class="ti">{{ TIER_LABELS[tierOf(name)] }}</span>
              <span>{{ name }}</span>
              <span class="sl-cov">{{ covenantsOf(name) }}</span>
              <span class="pr">{{ priceOf(name) }} 资金</span>
            </template>
          </button>
          <div class="slot eqs" data-key="equipment">
            <span class="pr">装备栏 ×{{ info.equipmentSlots }}</span>
          </div>
        </div>
        <div class="reward" id="sReward" :class="{on: !!sim.reward}">
          <div class="row" style="margin-bottom: 8px">
            <span class="tag a">★ 精锐奖励（0 资金 · 高一阶三选一）</span>
            <span class="cnt">不可刷新或锁店，过回合即作废</span>
          </div>
          <div class="slots" id="sRewardSlots">
            <button
              v-for="(name, i) in sim.reward"
              type="button"
              :disabled="sim.bench.length >= BENCH_SIZE"
              :aria-label="`领取精锐奖励${name}`"
              :key="name"
              class="slot"
              :data-key="name"
              :data-r="i"
              :data-t="tierOf(name)"
              @click="claimReward(i)">
              <Markup :html="avatar(name)" />
              <span class="ti">{{ TIER_LABELS[tierOf(name)] }}</span>
              <span>{{ name }}</span>
              <span class="sl-cov">{{ covenantsOf(name) }}</span>
              <span class="pr">0 资金</span>
            </button>
          </div>
        </div>
        <div
          class="row"
          style="margin-top: 12px; justify-content: space-between">
          <span class="lab" style="margin: 0">干员整备区（点头像可出售）</span>
          <span class="cnt" id="sBenchN">
            {{ sim.bench.length }} / {{ BENCH_SIZE }}
            <template v-if="sim.bench.length >= BENCH_SIZE">
              · 已满，出售后可继续买
            </template>
          </span>
        </div>
        <div class="bench" id="sBench">
          <button
            v-for="(card, i) in benchCells"
            type="button"
            :disabled="!card"
            :aria-label="
              card ? `出售${card.name}，回收 ${card.sale} 资金` : '空整备位'
            "
            :key="card ? 'card:' + card.id : 'empty:' + i"
            class="b"
            :class="{
              x: !card,
              hasava: !!card,
              el: card?.elite,
              pop: card?.pop,
            }"
            :data-key="card ? 'card:' + card.id : 'empty:' + i"
            :data-j="card ? i : undefined"
            :data-t="card ? tierOf(card.name) : undefined"
            @click="sell(i)">
            <template v-if="card">
              <Markup :html="avatar(card.name)" />
              <i>{{ TIER_LABELS[tierOf(card.name)] }}</i>
              {{ card.name }}
              <template v-if="card.elite">
                <br />
                精锐
              </template>
            </template>
          </button>
        </div>
      </div>
    </div>
  </div>
  <details class="guide-fold">
    <summary>查看当前模式 1–6 本升本费用与栏位数表</summary>
    <div class="guide-fold-body">
      <div class="tw">
        <Markup as="table" id="shopTbl" :html="dispatchTable(mode)" />
      </div>
    </div>
  </details>
</template>
