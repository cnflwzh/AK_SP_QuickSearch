<script setup lang="ts">
import {ref} from 'vue';
import {CORE_COVENANTS, SEASON_META} from '../../../data/index.ts';
import {covenantIconHtml} from '../../lib/ui/assets.ts';
import {color, emblem} from '../chips.ts';
import Markup from '../components/Markup.ts';
import {iconSvg} from '../icons.ts';
import {drawBuild, mixedBuilds} from './buildsView.ts';

const starterPicks = [
  {
    name: '乌萨斯',
    title: '乌萨斯 · 击倒爽叠流（首推）',
    desc: '清怪自动叠临时层 + 折桠/乌啾转永久，冻河与塔露拉成型清屏极快。',
  },
  {
    name: '维多利亚',
    title: '维多利亚 · 重锤养核流（最稳）',
    desc: '3 维 + 3 坚守分摊反伤道中极肉，每 25 层白送重锤喂满水灯心。',
  },
  {
    name: '莱塔尼亚',
    title: '莱塔尼亚 · 小节召唤流（省心）',
    desc: '倒敌自动召小节抗线补伤，霍尔海雅 + 艾雅法拉远程高伤融化全场。',
  },
].filter((item) => CORE_COVENANTS.includes(item.name));

const selected = ref(
  starterPicks[0]?.name ??
    (CORE_COVENANTS.includes(SEASON_META.defaultCovenant)
      ? SEASON_META.defaultCovenant
      : (CORE_COVENANTS[0] ?? '')),
);
const mixed = mixedBuilds();
</script>
<template>
  <div class="chap-h">
    <span class="no">05</span>
    <div>
      <h2>热门流派</h2>
      <p class="en">META ARCHETYPES · STARTER PICKS</p>
    </div>
  </div>
  <p class="chap-lead">
    第一次玩不知道抓哪些角色？下面先选一套
    <b>容错高、容易上手的推荐阵容</b>
    ，点击「打开流派」进入速查页，再点「设为本局」，对局查表时就能高亮提示该买谁。
  </p>

  <h3 class="bh">
    <span>5.1</span>
    十大核心盟约推荐阵容
    <span class="bh-note">新人开荒首推乌萨斯、维多利亚、莱塔尼亚</span>
  </h3>

  <div class="starter-picks" aria-label="新手开荒首推三大流派">
    <button
      v-for="pick in starterPicks"
      :key="pick.name"
      type="button"
      class="starter-btn"
      :class="{on: selected === pick.name}"
      :aria-pressed="selected === pick.name"
      :style="{'--c': color(pick.name)}"
      @click="selected = pick.name">
      <Markup :html="emblem(pick.name, 38)" />
      <div>
        <b>{{ pick.title }}</b>
        <span>{{ pick.desc }}</span>
      </div>
    </button>
  </div>

  <div class="btabs" id="btabs" role="group" aria-label="核心盟约流派">
    <button
      v-for="name in CORE_COVENANTS"
      :key="name"
      type="button"
      :style="{'--c': color(name)}"
      :data-n="name"
      :class="{on: selected === name}"
      :aria-pressed="selected === name"
      aria-controls="bpanel"
      @click="selected = name">
      <Markup :html="covenantIconHtml(name)" />
      {{ name }}
    </button>
  </div>
  <Markup as="div" id="bpanel" :html="drawBuild(selected)" />

  <h3 class="bh">
    <span>5.2</span>
    低阶慢刷与多盟约进阶变阵
    <span class="bh-note">适合熟悉基础规则后再尝试的进阶配队</span>
  </h3>
  <Markup as="div" class="hyb" id="hyb" :html="mixed" />

  <div class="row mt" style="justify-content: center">
    <a class="qlink" href="/builds">
      进入流派规划器（支持自建流派与导入森空岛攻略码）
      <Markup :html="iconSvg('link', 'g-ic sm')" />
    </a>
  </div>
</template>
