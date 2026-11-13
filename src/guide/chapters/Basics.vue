<script setup lang="ts">
import Markup from '../components/Markup';
import Segmented from '../components/Segmented.vue';
import { computed, ref } from 'vue';
import { MODES } from '../../../data/index';
import { basicsContent, roundTimeline, creditChart } from './basicsView';
const content = basicsContent();
const timelineMode = ref(1), creditMode = ref(0);
const timeline = computed(() => roundTimeline(timelineMode.value));
const credits = computed(() => creditChart(creditMode.value));
</script>
<template>

  <div class="chap-h"><span class="no">01</span><div><h2>入门</h2><p class="en">BASICS</p></div></div>

  <h3 class="bh"><span>1.1</span>一回合三阶段</h3>
  <div class="phase">
    <div><span class="pn">PHASE 1</span><b>休整期</b><ul><li>每回合发资金</li><li>招募 / 出售 / 刷新 / 冻结</li><li>升级调度中心</li><li>布阵 · 装备</li></ul></div>
    <div><span class="pn">PHASE 2</span><b>作战阶段</b><ul><li>按阵型自动部署</li><li>技能自动释放</li><li>限时清怪</li><li>漏怪扣目标生命</li></ul></div>
    <div><span class="pn">PHASE 3</span><b>联防阶段</b><ul><li>完美通关者上场</li><li>清理其他人的漏怪</li><li>至多 2 名玩家</li><li>本阶段不叠层</li></ul></div>
  </div>

  <h3 class="bh"><span>1.2</span>模式与难度</h3>
  <div class="g2">
    <div class="card"><h4>联合模拟 · 认证效率</h4><Markup as="div" id="diff" :html="content.diff" /></div>
    <div class="card"><h4>个人模拟 · 规程等级 1–20</h4>
      <Markup as="svg" class="svgbox" id="lvchart" viewBox="0 0 640 210" role="img" aria-label="个人模拟规程等级与认证效率" aria-describedby="solo-level-description" :html="content.lvchart" />
      <div class="row mt"><span class="tag">Lv1–4 缺席</span><Markup as="span" id="lvmiss" class="row" :html="content.lvmiss" /></div>
      <div class="row mt"><span class="tag a">极速模拟 100%</span><span class="tag">无限决策时间</span><span class="tag">可离开 24h</span><span class="tag">开局核心盟约二选一</span></div>
    </div>
  </div>
  <div class="card mt"><h4>解锁关系</h4><Markup as="svg" class="svgbox" id="unlock" viewBox="0 0 680 230" role="img" aria-label="个人与联合模拟解锁关系" aria-describedby="unlock-description" :html="content.unlock" />
    <div class="legend"><span><i style="background:var(--teal)"></i>个人 → 联合</span><span><i style="background:var(--accent)"></i>联合 → 个人</span><span><i style="background:var(--ink3)"></i>击败隐秘核心 / 高血量通关：额外跳级（至规程15）</span></div>
  </div>

  <h3 class="bh"><span>1.3</span>回合时间轴</h3>
  <div class="card">
    <div class="row" style="justify-content:space-between"><Segmented id="tlseg" aria-label="回合时间轴难度" :labels="MODES" v-model="timelineMode" /><span class="cnt" id="tlinfo">{{ timeline.tlinfo }}</span></div>
    <Markup as="div" class="tl" id="tl" :html="timeline.tl" />
    <div class="legend"><span><i style="background:color-mix(in srgb,var(--teal) 70%,transparent)"></i>作战时限（秒）</span><span><i style="background:var(--red)"></i>领袖回合</span><span><i style="background:var(--ink3)"></i>隐秘核心 ??</span><span><i style="background:var(--accent);transform:rotate(45deg) scale(.8)"></i>机变 / 悬赏决策（联合）</span></div>
  </div>

  <h3 class="bh"><span>1.4</span>认证收益</h3>
  <div class="g2">
    <div class="card"><h4>通过回合数 → 认证</h4>
      <div class="row" style="justify-content:space-between"><Segmented id="crseg" aria-label="认证收益难度" :labels="MODES" v-model="creditMode" /><span class="cnt" id="crsum">{{ credits.crsum }}</span></div>
      <Markup as="svg" class="svgbox" id="crchart" viewBox="0 0 600 220" role="img" :aria-label="`${MODES[creditMode]}通过回合数与认证收益`" aria-describedby="credit-chart-description" :html="credits.crchart" />
    </div>
    <div class="card"><h4>赛季商店进度</h4>
      <Markup as="svg" class="svgbox" id="shopbar" viewBox="0 0 600 150" role="img" aria-label="赛季商店认证进度" aria-describedby="season-shop-description" :html="content.shopbar" />
      <div class="row mt"><span class="tag">作战认证上限 6250 / 序列</span><span class="tag a">关键目标 +2500</span><span class="tag r">赛季结束清零</span></div>
      <div class="row mt"><span class="tag t">奖杯：仅联合模拟</span><span class="tag">0 / 10 / 30 / 60 / 100 / 150 / 200 / 300+</span></div>
    </div>
  </div>

  <h3 class="bh"><span>1.5</span>一局的节奏</h3>
  <div class="stages">
    <div style="--sc:var(--teal)"><div class="sh"><b>前期</b><span class="num">R1–4</span></div><div class="lvb">目标：调度中心 1–2 级 · Ⅰ–Ⅱ 阶</div><ul class="ul"><li>挑一个核心盟约，先凑 3 人激活</li><li>同名优先，冲第一个精锐</li><li>升级费用每回合 −1，晚点升更便宜</li></ul></div>
    <div style="--sc:var(--t4)"><div class="sh"><b>中期</b><span class="num">R5–8</span></div><div class="lvb">目标：3–4 级 · Ⅲ–Ⅳ 阶</div><ul class="ul"><li>定下主 C，装备集中给它</li><li>补附加盟约（多数 2 人激活）</li><li>机变回合拿装备 / 悬赏资金</li></ul></div>
    <div style="--sc:var(--accent)"><div class="sh"><b>后期</b><span class="num">R9–13</span></div><div class="lvb">目标：5–6 级 · Ⅴ–Ⅵ 阶</div><ul class="ul"><li>凑 6 名不同核心干员，开强化效果</li><li>叠层手配 Mon3tr / 凛御银灰 抬上限</li><li>按身前 / 身后调整站位</li></ul></div>
    <div style="--sc:var(--red)"><div class="sh"><b>领袖</b><span class="num">R14</span></div><div class="lvb">全队生命合并</div><ul class="ul"><li>超时每秒 −1 生命</li><li>伤害取决于叠到的层数</li><li>击败后满足条件 → 隐秘核心</li></ul></div>
  </div>
  <div class="row mt"><span class="tag">极速模拟 9 回合：节奏压缩；联合标准 14 回合</span></div>
</template>
