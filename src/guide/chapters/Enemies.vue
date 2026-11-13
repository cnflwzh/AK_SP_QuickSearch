<script setup lang="ts">
import Markup from '../components/Markup';
import Segmented from '../components/Segmented.vue';
import { ref } from 'vue';
import { MODES } from '../../../data/index';
import { enemyContent, leaderHp } from './enemiesView';
import TrainingDemo from '../components/TrainingDemo.vue';
import LeakAnimation from '../components/LeakAnimation.vue';
import JointDefense from '../components/JointDefense.vue';
const leaderMode = ref(2);
const content = enemyContent();
</script>
<template>

  <div class="chap-h"><span class="no">03</span><div><h2>刷怪</h2><p class="en">ENEMIES · WAVES · LEADERS</p></div></div>

  <h3 class="bh"><span>3.1</span>战术特训敌人</h3>
  <div class="card">
    <TrainingDemo />
    <div class="row mt"><span class="tag">作战简报同时公布：缺席盟约 · 禁用干员</span></div>
  </div>

  <h3 class="bh"><span>3.2</span>漏怪与扣血</h3>
  <div class="g2">
    <div class="card"><h4>漏怪</h4><LeakAnimation />
      <div class="row"><span class="tag r">到达目标点 / 超时存活 → 扣血</span><span class="tag a">每回合至多 −10</span></div>
    </div>
    <div class="card"><h4>扣血规则</h4>
      <div style="display:grid;gap:10px">
        <div class="row"><span class="big num" style="color:var(--red)">−10</span><span>普通回合单回合上限</span></div>
        <div class="row"><span class="big num" style="color:var(--red)">−1/s</span><span>领袖回合：全员生命合并，超时每秒扣 1</span></div>
        <div class="row"><span class="big num" style="color:var(--red)">0</span><span>联合：原生敌人打空生命 → 立即失败</span></div>
        <div class="row"><span class="big num" style="color:var(--green)">20–40</span><span>初始生命由策略决定（歌利亚 40）</span></div>
      </div>
    </div>
  </div>

  <h3 class="bh"><span>3.3</span>联防阶段</h3>
  <div class="g2">
    <div class="card"><JointDefense /></div>
    <div class="card"><h4>谁来联防 · 优先级</h4>
      <ol class="steps" style="--c:var(--teal)"><li>场上单位最多</li><li>有激活盟约</li><li>层数最高</li><li>存活单位最多（该方在右侧）</li></ol>
      <div class="row mt"><span class="tag a">完美通关者 · 至多 2 人</span><span class="tag">对手 = 所有人漏怪合并</span><span class="tag r">不叠层</span></div>
      <div class="row mt"><span class="tag t">领袖回合（联合）：两两同图，左右分站</span><span class="tag">右侧玩家方向类效果镜像</span></div>
    </div>
  </div>

  <h3 class="bh"><span>3.4</span>领袖生命值</h3>
  <div class="card">
    <div class="row" style="justify-content:space-between;margin-bottom:12px"><Segmented id="ldseg" aria-label="领袖难度" :labels="MODES" v-model="leaderMode" /><div class="legend" style="margin:0"><span><i style="background:var(--red)"></i>领袖</span><span><i style="background:repeating-linear-gradient(45deg,var(--ink3) 0 3px,transparent 3px 6px)"></i>隐秘核心</span></div></div>
    <Markup as="div" class="ldr" id="ldr" :html="leaderHp(leaderMode)" />
    <div class="row mt"><span class="tag">隐秘核心：击败领袖后达成特定条件出现</span><span class="tag">极速模拟：第 9 回合领袖</span><span class="tag">其他：第 14 回合领袖</span></div>
  </div>

  <h3 class="bh"><span>3.5</span>悬赏 · 机变</h3>
  <div class="g2">
    <div class="card"><h4>悬赏敌人 · 资金奖励</h4><Markup as="div" class="bty" id="bty" :html="content.bty" />
      <div class="row mt"><span class="tag a">多轮悬赏：之后每场 +1</span><span class="tag">蚀裂 / 淤困 / 骨刺 / 黑云 / 再生 / 镜膜</span><span class="tag t">悬赏·飞行 / 频次 / 损伤 / 持续 / 隐匿 / 折射 Ⅰ–Ⅲ：两场内 1–3</span></div>
    </div>
    <div class="card"><h4>决策回合（联合）</h4><Markup as="div" id="decTbl" :html="content.decTbl" />
      <div class="row mt"><span class="tag">装备补给</span><span class="tag">悬赏</span><span class="tag">战术决策</span><span class="tag">秘密商店</span><span class="tag a">联合：按顺序 6 选 1</span></div>
    </div>
  </div>
</template>
