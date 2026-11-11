/**
 * 2.2 调度中心模拟器：随机商店、购买、三合一精锐、精锐奖励、升级、刷新、冻结、整备区。
 * 只模拟资金流向与卡池规则，不模拟战斗。
 */
import { OPERATORS, OPERATOR, DISPATCH_BY_MODE, operatorPrice, TIER_LABELS, TIERS } from '../../../data/index.js';
import { $, html } from '../../lib/dom.js';
import { avatar } from '../chips.js';

const BENCH_SIZE = 10;        // 整备区
const TEMP_SLOTS = 5;         // 临时栏位，下一回合清空
const BENCH_MAX = BENCH_SIZE + TEMP_SLOTS;
const MAX_LEVEL = 6;
const NOT_IN_SHOP = '盟约·辅助干员';

const pickRandom = list => list[Math.floor(Math.random() * list.length)];
const pools = Array.from({ length: 7 }, (_, level) => OPERATORS.filter(o => o.tier <= level && o.name !== NOT_IN_SHOP));
const shopPool = level => pools[level];
const tierPool = tier => OPERATORS.filter(o => o.tier === tier && o.name !== NOT_IN_SHOP).map(o => o.name);
const randomOperator = level => pickRandom(shopPool(level)).name;

const priceOf = name => operatorPrice(OPERATOR[name]);
const levelInfo = level => DISPATCH_BY_MODE[+$('#dispatchMode').value][level - 1];
const tierOf = name => OPERATOR[name].tier;

/** 模拟器状态。bench 元素：{ name, elite, pop(刚加入，播放动画) } */
const sim = {};

function reset() {
  Object.assign(sim, {
    level: 1, cost: levelInfo(1).upgradeCost, round: 1, spent: 0, frozen: false,
    bench: [], reward: null, slots: [],
  });
  rollShop();
  draw(true);
}

function rollShop() {
  sim.slots = Array.from({ length: levelInfo(sim.level).operatorSlots }, () => randomOperator(sim.level));
}

/** 凑齐 3 张（星极 2 张）同名未精锐 → 合成精锐，并给出比当前中心高一阶的三选一奖励 */
function tryMerge(name) {
  const need = name === '星极' ? 2 : 3;
  const copies = sim.bench
    .map((card, i) => !card.elite && card.name === name ? i : -1)
    .filter(i => i >= 0);
  if (copies.length < need) return;

  const used = copies.slice(0, need);
  sim.bench = sim.bench.filter((_, i) => !used.includes(i));
  // 晋升销毁初始牌并获得一张新的精锐牌。
  sim.bench.push({ name, elite: true, pop: true, sale: 1 });

  const pool = tierPool(Math.min(MAX_LEVEL, sim.level + 1));
  const picks = new Set();
  while (picks.size < 3 && picks.size < pool.length) picks.add(pickRandom(pool));
  sim.reward = [...picks];
}

/* ---------- 绘制 ---------- */

const shopCard = (name, i, flip) => html`<div class="slot ${flip ? 'flip' : ''}" data-i="${i}" data-t="${tierOf(name)}" style="animation-delay:${i * .05}s">
  ${avatar(name)}<span class="ti">${TIER_LABELS[tierOf(name)]}</span><span>${name}</span><span class="pr">${priceOf(name)} 资金</span>
</div>`;

const benchCell = (card, i) => {
  const temp = i >= BENCH_SIZE ? 'tmp' : '';
  if (!card) return `<div class="b x ${temp}"></div>`;
  const tier = tierOf(card.name);
  return html`<div class="b hasava ${temp} ${card.elite ? 'el' : ''} ${card.pop ? 'pop' : ''}" data-j="${i}" data-t="${tier}">
    ${avatar(card.name)}<i>${TIER_LABELS[tier]}</i>${card.name}${card.elite && '<br>精锐'}
  </div>`;
};

function draw(flip) {
  const maxed = sim.level >= MAX_LEVEL;
  const info = levelInfo(sim.level);

  $('#sLv').textContent = sim.level;
  $('#sCost').textContent = maxed ? 'MAX' : sim.cost;
  $('#bUpC').textContent = maxed ? '—' : sim.cost;
  $('#bUp').disabled = maxed || !!sim.reward;
  $('#bRef').disabled = $('#bFrz').disabled = !!sim.reward;
  // 升级费用每回合 -1，进度条显示剩余比例
  const baseCost = maxed ? 1 : info.upgradeCost;
  $('#sCd').style.width = (maxed ? 0 : sim.cost / baseCost * 100) + '%';
  $('#sRound').textContent = sim.round;
  $('#sSpent').textContent = sim.spent;
  $('#sSlots').textContent = info.operatorSlots;
  $('#sTiers').innerHTML = TIERS.map(t =>
    `<div data-t="${t}" class="${t <= sim.level ? 'on' : ''}">${TIER_LABELS[t]}</div>`).join('');

  const freeze = $('#bFrz');
  freeze.classList.toggle('p', sim.frozen);
  freeze.textContent = sim.frozen ? '已冻结 ❄' : '冻结';

  const shop = $('#sShop');
  shop.classList.toggle('frozen', sim.frozen);
  shop.innerHTML = sim.slots.map((name, i) => name ? shopCard(name, i, flip) : '<div class="slot empty"></div>').join('')
    + `<div class="slot eqs"><span class="pr">装备栏 ×${info.equipmentSlots}</span></div>`;

  $('#sBench').innerHTML = Array.from({ length: BENCH_MAX }, (_, i) => benchCell(sim.bench[i], i)).join('');
  sim.bench.forEach(card => { card.pop = false; });
  $('#sBenchN').textContent = sim.bench.length + ' / ' + BENCH_MAX;

  $('#sReward').classList.toggle('on', !!sim.reward);
  if (sim.reward) {
    $('#sRewardSlots').innerHTML = sim.reward.map((name, i) => html`<div class="slot" data-r="${i}" data-t="${tierOf(name)}">
      ${avatar(name)}<span class="ti">${TIER_LABELS[tierOf(name)]}</span><span>${name}</span><span class="pr">0 资金</span>
    </div>`).join('');
  }
}

/* ---------- 操作 ---------- */

function addToBench(name) {
  sim.bench.push({ name, elite: false, pop: true, sale: 1 });
  tryMerge(name);
  draw();
}

function bindControls() {
  // 购买
  $('#sShop').onclick = e => {
    const slot = e.target.closest('.slot[data-i]');
    if (!slot || sim.reward || sim.bench.length >= BENCH_SIZE) return;
    const i = +slot.dataset.i;
    const name = sim.slots[i];
    sim.slots[i] = null;
    sim.spent += priceOf(name);
    addToBench(name);
  };

  // 领取精锐奖励（0 资金）
  $('#sRewardSlots').onclick = e => {
    const slot = e.target.closest('.slot[data-r]');
    if (!slot || !sim.reward || sim.bench.length >= BENCH_MAX) return;
    const name = sim.reward[+slot.dataset.r];
    sim.reward = null;
    addToBench(name);
  };

  // 初始与精锐都可出售；温蒂固定售价，海沫按每张牌单独积累。
  $('#sBench').onclick = e => {
    const cell = e.target.closest('.b[data-j]');
    if (!cell) return;
    const j = +cell.dataset.j;
    const card = sim.bench[j];
    const price = card.name === '温蒂' ? (card.elite ? 6 : 3) : card.sale;
    sim.bench.splice(j, 1);
    sim.spent -= price;
    draw();
  };

  $('#bRef').onclick = () => {
    if (sim.reward) return;
    sim.spent += 1;
    rollShop();
    draw(true);
  };

  $('#bFrz').onclick = () => {
    if (sim.reward) return;
    sim.frozen = !sim.frozen;
    draw();
  };

  $('#bUp').onclick = () => {
    if (sim.level >= MAX_LEVEL || sim.reward) return;
    sim.spent += sim.cost;
    sim.level++;
    sim.cost = levelInfo(sim.level).upgradeCost ?? 0;
    while (sim.slots.length < levelInfo(sim.level).operatorSlots) sim.slots.push(randomOperator(sim.level));
    draw();
  };

  // 下一回合：升级费用 -1，奖励作废，临时栏位清空，未冻结则刷新商店
  $('#bNext').onclick = () => {
    sim.bench.forEach(card => {
      if (card.name === '海沫') card.sale = Math.min(card.elite ? 8 : 4, card.sale + (card.elite ? 2 : 1));
    });
    sim.round++;
    sim.cost = Math.max(0, sim.cost - 1);
    sim.reward = null;
    if (sim.bench.length > BENCH_SIZE) sim.bench = sim.bench.slice(0, BENCH_SIZE);
    if (sim.frozen) {
      sim.frozen = false;
      sim.slots = sim.slots.map(name => name || randomOperator(sim.level));
      draw();
    } else {
      rollShop();
      draw(true);
    }
  };

  $('#bReset').onclick = reset;
}

export function resetShopSimulator() { reset(); }

export function initShopSimulator() {
  bindControls();
  reset();
}
