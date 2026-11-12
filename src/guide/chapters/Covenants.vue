<script setup lang="ts">
import Markup from '../components/Markup';
import Segmented from '../components/Segmented.vue';
import { op, eq } from '../chips';
import { computed, ref } from 'vue';
import { OPERATORS, COVENANTS, STRATEGY_CATEGORIES, OPERATOR_TRIGGERS as TRIGGERS, matchesOperatorTrigger } from '../../../data/index';
import { covenantContent, calculator, strategies, POSITIONS } from './covenantsView';
const content = covenantContent();
const traitText = (text: string) => text.replace(/<[^>]+>/g, '');
const trigger = ref(4), position = ref(0), mirror = ref(false);
const triggerLists = TRIGGERS.map(([label]) => OPERATORS.filter(o => matchesOperatorTrigger(o, label)).sort((a, b) => a.tier - b.tier));
const keyword = computed(() => POSITIONS[position.value][0]);
const positionOperators = computed(() => OPERATORS.filter(o => (o.trait + o.elite).includes(keyword.value)));
const positionCells = computed(() => {
  const offsets = POSITIONS[position.value][1];
  const direction = mirror.value ? -1 : 1;
  return Array.from({ length: 15 }, (_, i) => {
    const row = Math.floor(i / 5), column = i % 5;
    return { me: row === 1 && column === 2, on: offsets.some(([r, c]) => r === row && 2 + c * direction === column) };
  });
});
const covenant = ref('乌萨斯'), layers = ref(60), strategyCategory = ref(0);
const scalableCovenants = Object.keys(COVENANTS).filter(name => COVENANTS[name].scaling.length);
const calculation = computed(() => calculator(covenant.value, layers.value));
const strategyContent = computed(() => strategies(strategyCategory.value));

</script>
<template>

  <div class="chap-h"><span class="no">04</span><div><h2>盟约进阶</h2><p class="en">COVENANTS · STACKS · TIMING</p></div></div>

  <h3 class="bh"><span>4.1</span>激活门槛</h3>
  <div class="row" style="margin-bottom:10px"><span class="tag a">核心盟约：3 人激活 · 6 名不同干员强化</span><span class="tag t">附加盟约：1–3 人激活 · 层数里程碑</span></div>
  <Markup as="div" class="covg" id="covg" :html="content.covg" />

  <h3 class="bh"><span>4.2</span>层数：固定 vs 临时</h3>
  <div class="g2">
    <div class="card">
      <Markup as="div" class="stk" id="stk" :html="content.stk" />
      <div class="legend"><span><i style="background:var(--teal)"></i>固定层数</span><span><i style="background:var(--accent)"></i>临时层数（本场有效）</span></div>
    </div>
    <div class="card"><h4>层数来源</h4>
      <div style="display:grid;gap:8px;font-size:13.5px">
        <div class="row"><span class="tag a">单次叠加</span><span>获得时一次性给层</span><Markup :html="op('拜松')" /><Markup :html="op('仇白')" /></div>
        <div class="row"><span class="tag a">持续叠加</span><span>每回合 / 每场触发</span><Markup :html="op('引星棘刺')" /><Markup :html="op('迷迭香')" /></div>
        <div class="row"><span class="tag">作战能力</span><span>按层数加自身属性</span><Markup :html="op('真言')" /></div>
        <div class="row"><span class="tag">整备能力</span><span>给资金 / 装备 / 刷新</span><Markup :html="op('酒神')" /></div>
        <div class="row"><span class="tag r">只加已激活盟约</span><Markup :html="eq('随身身份牌')" /><span>无需激活</span></div>
        <div class="row"><span class="tag t">叠层上限</span><span>“每回合 / 每场至多 N 层”</span><Markup :html="op('Mon3tr')" /><Markup :html="op('凛御银灰')" /><Markup :html="op('薇薇安娜')" /><span>提高上限</span></div>
        <div class="row"><span class="tag t">无视上限</span><Markup :html="op('阿米娅')" /><span>身前干员每次叠层额外 +1/+2</span></div>
      </div>
    </div>
  </div>

  <h3 class="bh"><span>4.3</span>特质触发时机</h3>
  <div class="card">
    <div class="trig" id="trig"><div class="zone z1">休整期内</div><div class="zone z2">边界</div><div class="zone z3">作战阶段</div><button v-for="([label], i) in TRIGGERS" :key="label" type="button" :data-i="i" :class="{ on: trigger === i }" @click="trigger = i"><b>{{ triggerLists[i].length }}</b>{{ label }}</button></div>
    <div class="tlist" id="tlist"><div v-for="operator in triggerLists[trigger]" :key="operator.name" :data-key="operator.name"><Markup :html="op(operator.name)" />{{ traitText(operator.trait) }}</div></div>
  </div>

  <h3 class="bh" id="s44"><span>4.4</span>站位关系</h3>
  <div class="g2">
    <div class="card">
      <div class="row" style="justify-content:space-between;margin-bottom:12px"><Segmented id="posseg" :labels="POSITIONS.map(p => p[0])" v-model="position" /><label class="row" style="font-size:13px;gap:6px"><input type="checkbox" id="mirror" v-model="mirror">右侧镜像</label></div>
      <div class="pos" id="pos"><div v-for="(cell, i) in positionCells" :key="i" :class="{ me: cell.me, on: cell.on }">{{ cell.me ? (mirror ? '◀' : '▶') : '' }}</div></div>
    </div>
    <div class="card"><h4 id="posTitle">{{ keyword }} · {{ positionOperators.length }} 名</h4><div class="row" id="posOps"><Markup v-for="operator in positionOperators" :key="operator.name" :html="op(operator.name)" /><span v-if="keyword === '周围四格'" class="cv" style="--c:var(--accent)">灵巧盟约</span><span v-if="keyword === '周围八格'" class="cv" style="--c:var(--accent)">灵巧 40 层</span></div></div>
  </div>

  <h3 class="bh"><span>4.5</span>盟约数值计算器</h3>
  <div class="card">
    <div class="calc">
      <div>
        <div class="row" style="margin-bottom:10px"><label for="cvSel" class="lab" style="margin:0">盟约</label><select id="cvSel" v-model="covenant"><option v-for="name in scalableCovenants" :key="name">{{ name }}</option></select></div>
        <div class="row" style="justify-content:space-between"><label for="cvL" class="lab" style="margin:0">层数</label><b class="num" style="font-size:26px" id="cvLv">{{ layers }}</b></div>
        <input type="range" id="cvL" min="0" max="300" v-model.number="layers">
        <Markup as="div" class="vals mt" id="cvVals" :html="calculation.cvVals" />
        <p id="cvBase" style="font-size:13px;color:var(--ink2);margin:12px 0 0">{{ calculation.cvBase }}</p>
        <p id="cvBig" style="font-size:13px;color:var(--ink);margin:6px 0 0">{{ calculation.cvBig }}</p>
      </div>
      <Markup as="svg" class="svgbox" id="cvChart" viewBox="0 0 440 260" :html="calculation.cvChart" />
    </div>
  </div>

  <h3 class="bh"><span>4.6</span>策略（开局指挥）</h3>
  <div class="card">
    <div class="row" style="justify-content:space-between"><Segmented id="stseg" :labels="STRATEGY_CATEGORIES" v-model="strategyCategory" /><span class="cnt" id="stcnt">{{ strategyContent.stcnt }}</span></div>
    <Markup as="div" class="stg" id="stg" :html="strategyContent.stg" />
  </div>

  <h3 class="bh"><span>4.7</span>自持干员加成</h3>
  <div class="card"><div class="tw"><table>
    <tr><th>你自己的干员练度</th><th>攻击</th><th>防御</th><th>生命</th></tr>
    <tr><td>精英一</td><td class="n">+5%</td><td class="n">+5%</td><td class="n">—</td></tr>
    <tr><td>精英二</td><td class="n">+10%</td><td class="n">+5%</td><td class="n">+5%</td></tr>
    <tr><td>精英二 60 级</td><td class="n">+10%</td><td class="n">+10%</td><td class="n">+10%</td></tr>
  </table></div></div>
</template>
