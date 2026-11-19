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
} from '../../../data/index';
import {avatar} from '../chips';
import {isBanned} from '../../lib/recommendation/planning';
import {dispatchTable} from '../chapters/recruitView';
import SelectInput, {
  type SelectOption,
} from '../../quickref/components/SelectInput.vue';
import Markup from './Markup';

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
const BENCH_SIZE = 10,
  MAX_LEVEL = 6;
const mode = ref(0),
  lowSolo = ref(false),
  shopRoll = ref(0),
  flip = ref(false);
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
  Array.from({length: MAX_LEVEL + 1}, (_, level) =>
    eligible.value.filter((op) => op.tier <= level),
  ),
);
const pickRandom = <T,>(list: readonly T[]): T =>
  list[Math.floor(Math.random() * list.length)];
const randomOperator = (level: number) => pickRandom(pools.value[level]).name;
const levelInfo = (level: number) => DISPATCH_BY_MODE[mode.value][level - 1];
const tierOf = (name: string) => OPERATOR[name].tier;
const priceOf = (name: string) => operatorPrice(OPERATOR[name]);
const info = computed(() => levelInfo(sim.level));
const maxed = computed(() => sim.level >= MAX_LEVEL);
const costPercent = computed(() =>
  maxed.value ? 0 : (sim.cost / (info.value.upgradeCost ?? 1)) * 100,
);
const benchCells = computed(() =>
  Array.from({length: BENCH_SIZE}, (_, i) => sim.bench[i]),
);

/** Every card has an identity, so purchases and sales patch only affected slots. */
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
/** The special two-card merge and free reward use the current dispatch level. */
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
    .filter((o) => o.tier === Math.min(MAX_LEVEL, sim.level + 1))
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
/** Round boundaries expire unclaimed rewards and refill only frozen gaps. */
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
    调度中心模拟
  </h3>
  <div class="card">
    <div class="row" style="margin-bottom: 14px">
      <label for="dispatchMode">模式</label>
      <SelectInput
        id="dispatchMode"
        v-model="mode"
        :options="dispatchModeOptions"
        aria-label="调度模式" />
      <label v-if="mode === 0">
        <input v-model="lowSolo" type="checkbox" />
        规程 1–4（固定缺席盟约）
      </label>
      <span class="tag">切换模式重置练习</span>
    </div>
    <div class="sim">
      <div class="lvl">
        <div class="lv-badge">
          <span class="big num" id="sLv">{{ sim.level }}</span>
          <span>级调度中心</span>
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
            <span>升级费用</span>
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
            <span>已花费</span>
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
            升级
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
            {{ sim.frozen ? '已冻结 ❄' : '冻结' }}
          </button>
          <button class="btn" id="bNext" @click="nextRound">下一回合 ▸</button>
          <button class="btn" id="bReset" @click="reset">重置</button>
        </div>
      </div>
      <div>
        <div class="slots" id="sShop" :class="{frozen: sim.frozen}">
          <div
            v-for="(name, i) in sim.slots"
            :key="shopRoll + ':' + i"
            class="slot"
            :class="{empty: !name, flip: !!name && flip}"
            :data-key="'shop:' + shopRoll + ':' + i"
            :data-i="name ? i : undefined"
            :data-t="name ? tierOf(name) : undefined"
            :style="name ? {animationDelay: i * 0.05 + 's'} : undefined"
            @click="buy(i)">
            <template v-if="name">
              <Markup :html="avatar(name)" />
              <span class="ti">{{ TIER_LABELS[tierOf(name)] }}</span>
              <span>{{ name }}</span>
              <span class="pr">{{ priceOf(name) }} 资金</span>
            </template>
          </div>
          <div class="slot eqs" data-key="equipment">
            <span class="pr">装备栏 ×{{ info.equipmentSlots }}</span>
          </div>
        </div>
        <div class="reward" id="sReward" :class="{on: !!sim.reward}">
          <div class="row" style="margin-bottom: 8px">
            <span class="tag a">精锐奖励</span>
            <span class="tag">0 资金 · 三选一</span>
            <span class="tag">不可刷新 / 冻结 / 保留</span>
          </div>
          <div class="slots" id="sRewardSlots">
            <div
              v-for="(name, i) in sim.reward"
              :key="name"
              class="slot"
              :data-key="name"
              :data-r="i"
              :data-t="tierOf(name)"
              @click="claimReward(i)">
              <Markup :html="avatar(name)" />
              <span class="ti">{{ TIER_LABELS[tierOf(name)] }}</span>
              <span>{{ name }}</span>
              <span class="pr">0 资金</span>
            </div>
          </div>
        </div>
        <div
          class="row"
          style="margin-top: 12px; justify-content: space-between">
          <span class="lab" style="margin: 0">干员整备区（含召唤物）</span>
          <span class="cnt" id="sBenchN">
            {{ sim.bench.length }} / {{ BENCH_SIZE }}
          </span>
        </div>
        <div class="bench" id="sBench">
          <div
            v-for="(card, i) in benchCells"
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
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="card mt">
    <h4>调度中心等级表</h4>
    <div class="tw">
      <Markup as="table" id="shopTbl" :html="dispatchTable(mode)" />
    </div>
  </div>
</template>
