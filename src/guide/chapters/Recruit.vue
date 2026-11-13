<script setup lang="ts">
import Markup from '../components/Markup';
import Segmented from '../components/Segmented.vue';
import { op, eq, avatar } from '../chips';
import { ref } from 'vue';
import { OPERATORS, TIERS, TIER_LABELS } from '../../../data/index';
import { recruitContent, eliteComparison, poolDiagram } from './recruitView';
import ShopSimulator from '../components/ShopSimulator.vue';
const content = recruitContent();
const advancedHammer = eq('维式重锤', '维式重锤＋').replace('<span class="eq"', '<span style="border-color:var(--accent);border-style:solid" class="eq"');
const eliteName = ref('乌啾'), poolMode = ref(0);
</script>
<template>

  <div class="chap-h"><span class="no">02</span><div><h2>招募与升本</h2><p class="en">RECRUIT · UPGRADE</p></div></div>

  <h3 class="bh"><span>2.1</span>资金</h3>
  <div class="card">
    <div class="fund">
      <div><b class="m">−2 / 3 / 4</b><span>招募</span><small>Ⅰ / Ⅱ–Ⅳ / Ⅴ–Ⅵ阶 · 真理 / 至简 −1</small></div>
      <div><b class="p">+1</b><span>出售</span><small>温蒂 3/6 · 海沫涨价</small></div>
      <div><b class="m">−1</b><span>刷新</span><small>奇迹 / 忍冬 免费</small></div>
      <div><b class="m">−N</b><span>升级</span><small>每回合 N−1</small></div>
      <div><b>0</b><span>冻结</span><small>保留剩余栏位</small></div>
    </div>
    <div class="coins"><span class="tag">回合结束</span><div class="coin"></div><div class="coin"></div><div class="coin"></div><div class="coin"></div><span class="tag r">剩余资金清零</span><span class="tag t">坎诺特：继承 · ≥5 时每回合 +1</span></div>
  </div>

  <ShopSimulator />

  <h3 class="bh"><span>2.3</span>三合一 · 精锐</h3>
  <div class="card">
    <h4>合成流程</h4>
    <div class="story">
      <div class="sb"><div class="sbn">1</div><b>凑齐 3 张同名</b>
        <div class="fstack"><div class="fc" data-t="3"><Markup :html="avatar('乌啾')" /><i>Ⅲ</i>乌啾</div><div class="fc" data-t="3" style="animation-delay:.3s"><Markup :html="avatar('乌啾')" /><i>Ⅲ</i>乌啾</div><div class="fc" data-t="3" style="animation-delay:.6s"><Markup :html="avatar('乌啾')" /><i>Ⅲ</i>乌啾</div></div>
        <ul class="ul"><li>同名、未精锐的干员</li><li>场上 + 整备区合计</li><li>星极只要 2 张</li></ul></div>
      <div class="sarr">▶</div>
      <div class="sb"><div class="sbn">2</div><b>自动合成为精锐</b>
        <div class="fstack"><div class="fc el" data-t="3" style="animation-delay:1.3s"><Markup :html="avatar('乌啾')" /><i>Ⅲ</i>乌啾<span class="tag a">精锐</span></div></div>
        <ul class="ul"><li>3 张合为 1 张，空出 2 格</li><li>练度升至精锐档</li><li>特质换成精锐版</li></ul></div>
      <div class="sarr">▶</div>
      <div class="sb"><div class="sbn">3</div><b>精锐奖励 · 以三本为例</b>
        <div class="fstack"><div class="fc" data-t="4" style="animation-delay:2.6s"><i>Ⅳ</i>？</div><div class="fc" data-t="4" style="animation-delay:2.6s"><i>Ⅳ</i>？</div><div class="fc" data-t="4" style="animation-delay:2.6s"><i>Ⅳ</i>？</div></div>
        <ul class="ul"><li>比当前调度中心高一阶，3 选 1</li><li>0 资金</li><li>不能刷新、不能冻结</li><li>当回合不选即作废</li><li>奖励最高Ⅵ阶；四本合成可拿Ⅴ阶</li></ul></div>
    </div>
  </div>
  <div class="g3 mt">
    <div class="card"><h4>精锐前后对比</h4>
      <div class="row" style="margin-bottom:10px"><label for="elSel" class="lab" style="margin:0">干员</label><select id="elSel" v-model="eliteName"><optgroup v-for="tier in TIERS" :key="tier" :label="TIER_LABELS[tier] + ' 阶'"><option v-for="operator in OPERATORS.filter(o => o.tier === tier)" :key="operator.name">{{ operator.name }}</option></optgroup></select></div>
      <Markup as="div" id="elOut" :html="eliteComparison(eliteName)" />
    </div>
    <div class="card"><h4>做一名精锐要花多少资金</h4><Markup as="div" id="elCost" :html="content.elCost" />
      <div class="row mt"><span class="tag t">精锐奖励 0 资金 → 等于白送一张高阶卡</span></div>
    </div>
    <div class="card"><h4>精锐的额外价值 · 捷径</h4><Markup as="div" id="elFx" :html="content.elFx" /></div>
  </div>
  <div class="card mt"><h4>各等阶练度</h4><div class="tw"><Markup as="table" id="tierTbl" :html="content.tierTbl" /></div></div>

  <h3 class="bh"><span>2.4</span>卡池与商店</h3>
  <div class="g2">
    <div class="card"><h4>联合模拟 · 4 人共用一个卡池</h4>
      <Segmented id="poolSeg" aria-label="卡池占用情况" :labels="['只有你玩乌萨斯', '队友也玩乌萨斯']" v-model="poolMode" />
      <Markup as="div" class="pv" id="poolV" :html="poolDiagram(poolMode)" />
      <div class="row mt"><span class="tag a">队友买走的牌，你就刷不到</span><span class="tag">开局先看队友玩什么，避免撞流派</span></div>
    </div>
    <div class="card"><h4>个人模拟 · 开局核心盟约二选一</h4>
      <Markup as="div" id="soloSplit" :html="content.soloSplit" />
      <div class="row mt"><span class="tag a">另一组的干员整局不出现</span><span class="tag t">卡池更集中，更容易三合一</span></div>
    </div>
  </div>
  <div class="g2 mt">
    <div class="card"><h4>个人规程 / 险境以上：调度中心 → 商店等阶</h4><Markup as="div" id="tierMx" :html="content.tierMx" />
      <div class="row mt"><span class="tag">只出 ≤ 当前等级的等阶</span><span class="tag a">常规调度Ⅴ–Ⅵ阶 → 升到5–6级；精锐奖励可跨一阶</span></div>
    </div>
    <div class="card"><h4>刷新与冻结</h4><Markup as="div" class="rf" id="rfx" :html="content.rfx" /><Markup as="div" id="rfChips" class="mt" :html="content.rfChips" /></div>
  </div>

  <h3 class="bh"><span>2.5</span>阵型与整备区</h3>
  <div class="card"><h4>场上 vs 整备区</h4>
    <div class="cmp">
      <div class="cmpc"><div class="cmph"><b>场上（阵型）</b><span class="tag a">8 人 · 人事部文档 9 人</span></div>
        <Markup as="div" class="dgrid" id="dgrid" :html="content.dgrid" />
        <ul class="ck"><li>参与作战</li><li>计入盟约激活人数</li><li>格子位置决定“身前 / 身后 / 同一行”</li><li>倒下后原地再部署</li></ul></div>
      <div class="cmpc"><div class="cmph"><b>整备区</b><span class="tag">10 格 + 临时 5 格</span></div>
        <Markup as="div" class="bench" id="benchDemo" :html="content.benchDemo" />
        <ul class="ck"><li class="x">不参战</li><li class="x">不计入盟约人数（远见 / 奇迹 / 投资人除外）</li><li>可以装备道具</li><li>部分特质放在整备区也生效</li><li class="w">临时 5 格在下一阶段开始时清空，里面的干员直接消失</li></ul></div>
    </div>
  </div>
  <div class="card mt"><h4>开战后的部署顺序</h4>
    <div class="dsteps"><div><b>0s</b><span>作战开始</span></div><div><b>3s</b><span>1 号位上场</span></div><div><b>1 → 8</b><span>按编号依次上场<br>从上到下、从左到右</span></div><div><b>召唤物</b><span>干员全部上场之后</span></div><div><b>技能</b><span>就绪自动释放<br>间隔 3 秒</span></div><div><b>倒下</b><span>再部署时间后<br>原地返场</span></div></div>
    <div class="row mt"><span class="tag">重装：受击时放技能</span><span class="tag">战术家 / 执旗手 / 吟游者：技力满即放</span></div>
  </div>
  <div class="card mt"><h4>顺序与站位会影响什么</h4><Markup as="div" id="ordFx" :html="content.ordFx" /></div>

  <h3 class="bh"><span>2.6</span>装备</h3>
  <div class="eqrule">
    <div><div class="eqx"><Markup :html="eq('维式重锤')" />＋<Markup :html="eq('维式重锤')" /></div><div class="eqx" style="margin-top:6px">＝ <Markup :html="advancedHammer" /></div><p>同名两件 → 进阶</p></div>
    <div><div class="eqx"><span class="tag">栏位 1</span><span class="tag">栏位 2</span></div><div class="eqx" style="margin-top:6px"><span class="tag r">第 3 件 → 替换并销毁</span></div><p>每名干员至多 2 件</p></div>
    <div><div class="eqx"><span class="tag r">无法卸下</span><span class="tag r">无法出售</span></div><div class="eqx" style="margin-top:6px"><span class="tag t">可装给整备区干员</span></div><p>调度中心 1 级起出售装备</p></div>
    <div><div class="eqx"><Markup :html="eq('变形同构体')" /></div><div class="eqx" style="margin-top:6px"><span class="tag a">+ 另一件 → 对应盟约</span></div><p>如 阿戈尔重刃 → 阿戈尔</p></div>
  </div>
  <div class="card mt"><h4>组合装备 · 价格 6</h4><Markup as="div" id="combos" :html="content.combos" /></div>
</template>
