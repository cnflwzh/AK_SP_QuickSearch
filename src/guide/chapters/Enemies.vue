<script setup lang="ts">
import {computed, ref} from 'vue';
import {
  BOUNTIES,
  LEADERS,
  MODES,
  ROUND_TIME,
  SEASON_META,
  operatorsWithRoles,
  type CombatRole,
} from '../../../data/index.ts';
import {damageClass} from '../../lib/leaders/leader.ts';
import {leaderSrc} from '../../lib/ui/assets.ts';
import {wan} from '../../lib/ui/dom.ts';
import {DIFFICULTIES} from '../../router/location.ts';
import GlossaryText from '../../quickref/components/GlossaryText.vue';
import SubTabs, {type SubTabItem} from '../../quickref/components/SubTabs.vue';
import {op} from '../chips.ts';
import JointDefense from '../components/JointDefense.vue';
import LeakAnimation from '../components/LeakAnimation.vue';
import Markup from '../components/Markup.ts';
import TrainingDemo from '../components/TrainingDemo.vue';
import {iconSvg} from '../icons.ts';
import {enemyContent} from './enemiesView.ts';

const leaderMode = ref(2);
const modeTabs: readonly SubTabItem<number>[] = MODES.map((label, id) => ({
  id,
  label,
}));
const content = enemyContent();
const leaderTime = ROUND_TIME[ROUND_TIME.length - 1];

const sortedLeaders = computed(() =>
  LEADERS.slice().sort(
    (a, b) => b.hp[leaderMode.value] - a.hp[leaderMode.value],
  ),
);
const maxLeaderHp = computed(() =>
  Math.max(
    ...LEADERS.map((l) =>
      leaderMode.value > 0 && l.hiddenCore
        ? l.hiddenCore[leaderMode.value - 1]
        : l.hp[leaderMode.value],
    ),
  ),
);
const hiddenHpOf = (leader: (typeof LEADERS)[number]) =>
  leaderMode.value > 0 && leader.hiddenCore
    ? leader.hiddenCore[leaderMode.value - 1]
    : 0;

const selectedLeaderName = ref(LEADERS[0]?.name ?? '');
const selectedLeader = computed(
  () =>
    LEADERS.find((l) => l.name === selectedLeaderName.value) ??
    sortedLeaders.value[0],
);
const selectedLeaderRoles = computed<CombatRole[]>(() => {
  const roles = new Set<CombatRole>();
  for (const c of selectedLeader.value?.counters ?? []) {
    if (c.hidden && leaderMode.value === 0) continue;
    for (const r of c.roles ?? []) roles.add(r);
  }
  return [...roles];
});
const selectedLeaderOps = computed(() =>
  operatorsWithRoles(selectedLeaderRoles.value)
    .slice()
    .sort((a, b) => b.tier - a.tier)
    .slice(0, 6),
);
</script>
<template>
  <div class="chap-h">
    <span class="no">03</span>
    <div>
      <h2>敌人与对策</h2>
      <p class="en">BRIEFING · JOINT DEFENSE · BOUNTIES · BOSS</p>
    </div>
  </div>
  <p class="chap-lead">
    对局失利
    <b>大概率是因为没留意开局作战简报，或过早选了高难度悬赏敌人</b>
    ：提前按本局敌人特点补上能打空中、能破隐身或能治疗的角色，首领战避开点名格子就能稳稳过关。
  </p>

  <h3 class="bh">
    <span>3.1</span>
    开局作战简报：9 类敌人特点（战术特训）速查
    <span class="bh-note">
      每局开始会预告「1 名最终首领 + 3 类道中敌人特点」
    </span>
  </h3>
  <div class="card">
    <TrainingDemo />
    <div class="card-foot">
      点击上方任意图标即可查看这类怪物的难点与推荐克制角色；完整怪物图鉴可在
      <a class="qlink" href="/enemies?kind=normal" style="margin-left: 4px">
        敌人页 · 普通敌人
        <Markup :html="iconSvg('link', 'g-ic sm')" />
      </a>
      按类别筛选。
    </div>
  </div>

  <h3 class="bh">
    <span>3.2</span>
    漏怪扣血与联机联防
  </h3>
  <div class="g2">
    <div class="card">
      <h4>道中漏怪动态演示</h4>
      <LeakAnimation />
      <div class="card-foot">
        怪物走进我方防线终点（蓝门）或作战超时未清完均会扣血；
        <b>普通回合单场最多扣 10 点</b>
        ，前期小漏两三只不必慌张。
      </div>
    </div>
    <div class="card">
      <h4>四条生命值硬规则</h4>
      <div class="hp-rules">
        <div class="hp-rule">
          <b style="color: var(--green)">20–40</b>
          <span>初始目标生命</span>
          <small>由开局所选策略决定（如歌利亚高达 40 血）</small>
        </div>
        <div class="hp-rule">
          <b style="color: var(--accent)">−10</b>
          <span>道中单回合扣血上限</span>
          <small>前期可承受少量漏怪，把当回合资金用来升本</small>
        </div>
        <div class="hp-rule">
          <b style="color: var(--red)">−1 / 秒</b>
          <span>领袖战全队合血</span>
          <small>120 秒超时未打完后每秒扣 1 点共享生命</small>
        </div>
        <div class="hp-rule">
          <b style="color: var(--red)">归零判负</b>
          <span>目标生命耗尽</span>
          <small>注意保留生命应对漏怪，最终领袖战全队共享生命</small>
        </div>
      </div>
    </div>
  </div>

  <div class="g2 mt">
    <div class="card">
      <h4>
        联机专属：
        <GlossaryText text="联防阶段" />
        流程示意
      </h4>
      <JointDefense />
    </div>
    <div class="card">
      <h4>谁会被派去帮队友联防？</h4>
      <ol class="steps" style="--c: var(--teal)">
        <li>
          本回合
          <b>完美通关（0 漏怪）</b>
          的玩家才有资格出战（至多 2 人）
        </li>
        <li>队友漏掉的敌人汇入联防战场，由参战玩家合力清理</li>
        <li>若仍有漏怪，按敌人原属玩家分别扣除目标生命</li>
        <li>
          第 {{ SEASON_META.roundLimits.standard }} 回合领袖战两两同图分站左右，
          <b>右侧半场来敌与朝向自动左右镜像！</b>
        </li>
      </ol>
      <div class="card-foot">
        联防清完即可帮队友免除本回合扣血；注意
        <b>联防期间不会触发盟约叠层</b>
        。
      </div>
    </div>
  </div>

  <h3 class="bh">
    <span>3.3</span>
    机变回合与悬赏敌人
    <span class="bh-note">量力打赏金，阵容未稳切勿贪 +4 / +5 高危怪</span>
  </h3>
  <div class="g2">
    <div class="card">
      <h4>悬赏敌人四档风险与赏金速览</h4>
      <Markup as="div" class="bty-tiers" id="bty" :html="content.bty" />
      <div class="card-foot">
        全部 {{ BOUNTIES.length }} 项悬赏敌人的详细词条可在
        <a class="qlink" href="/enemies?kind=bounty" style="margin-left: 4px">
          敌人页 · 悬赏敌人
          <Markup :html="iconSvg('link', 'g-ic sm')" />
        </a>
        按发放时机检索。
      </div>
    </div>
    <div class="card">
      <h4>机变触发回合与四类事件</h4>
      <Markup as="div" id="decTbl" :html="content.decTbl" />
      <div class="roster-tracks mt">
        <div class="r-track">
          <span class="ic-box sm" style="--ic-c: var(--accent)">
            <Markup :html="iconSvg('anvil', 'g-ic sm')" />
          </span>
          <div>
            <strong class="r-track-title">装备补给 / 秘密商店</strong>
            <p>直接白拿装备或进入高性价比折价商店补核心散件。</p>
          </div>
        </div>
        <div class="r-track">
          <span class="ic-box sm" style="--ic-c: var(--teal)">
            <Markup :html="iconSvg('bounty', 'g-ic sm')" />
          </span>
          <div>
            <strong class="r-track-title">悬赏决策 / 战术决策</strong>
            <p>
              单人模式三选一，联合模拟全队按顺位
              <b>6 选 1 轮抽</b>
              ；前期缺对空或反隐时切忌盲选对应赏金怪！
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <h3 class="bh">
    <span>3.4</span>
    最终领袖与隐秘核心
    <span class="bh-note">
      个人规程 5 起或联合险境及以上，满足条件可挑战隐秘核心；挑战失败仍算通关
    </span>
  </h3>
  <div class="card">
    <div
      class="row"
      style="justify-content: space-between; margin-bottom: 12px">
      <SubTabs
        id="ldseg"
        v-model="leaderMode"
        :items="modeTabs"
        :level="3"
        inline
        aria-label="领袖难度" />
      <div class="legend" style="margin: 0">
        <span>
          <i style="background: var(--red)"></i>
          常规领袖生命
        </span>
        <span>
          <i
            style="
              background: repeating-linear-gradient(
                45deg,
                var(--ink3) 0 3px,
                transparent 3px 6px
              );
            "></i>
          隐秘核心生命
        </span>
      </div>
    </div>

    <div class="boss-layout">
      <div
        class="ldr-list"
        id="ldr"
        role="group"
        aria-label="选择领袖查看对策">
        <button
          v-for="item in sortedLeaders"
          :key="item.name"
          type="button"
          class="ldr-btn"
          :class="{on: selectedLeader.name === item.name}"
          :aria-pressed="selectedLeader.name === item.name"
          :data-ld="item.name"
          @click="selectedLeaderName = item.name">
          <img
            class="ld-av"
            :src="leaderSrc(item.name)"
            alt=""
            width="56"
            height="56"
            loading="lazy" />
          <span class="nm">{{ item.name.replace('假想敌：', '') }}</span>
          <span class="tr">
            <span
              v-if="hiddenHpOf(item)"
              class="h"
              :style="{
                width: (hiddenHpOf(item) / maxLeaderHp) * 100 + '%',
              }"></span>
            <span
              class="m"
              :style="{
                width: (item.hp[leaderMode] / maxLeaderHp) * 100 + '%',
              }"></span>
          </span>
          <span class="v">
            {{ wan(item.hp[leaderMode])
            }}{{ hiddenHpOf(item) ? ' / ' + wan(hiddenHpOf(item)) : '' }}
          </span>
        </button>
      </div>

      <div class="boss-brief" aria-live="polite">
        <div class="boss-brief-h">
          <img
            :src="leaderSrc(selectedLeader.name)"
            alt=""
            width="92"
            height="92"
            loading="lazy" />
          <div style="flex: 1; min-width: 0">
            <strong class="boss-brief-title">{{ selectedLeader.name }}</strong>
            <div class="row" style="margin-top: 4px">
              <i
                v-for="dmg in selectedLeader.damage"
                :key="dmg"
                :class="['ldt', damageClass(dmg)]">
                {{ dmg }}
              </i>
              <span class="tag">
                {{ MODES[leaderMode] }}限时击破所需秒伤约
                {{
                  Math.round(
                    selectedLeader.hp[leaderMode] / leaderTime,
                  ).toLocaleString()
                }}/s
              </span>
            </div>
          </div>
          <a
            class="qlink"
            :href="`/enemies/${selectedLeader.id}?difficulty=${DIFFICULTIES[leaderMode]}`">
            查看站位图
            <Markup :html="iconSvg('link', 'g-ic sm')" />
          </a>
        </div>

        <div class="boss-kv">
          <div>
            <span>攻击模式</span>
            <strong>{{ selectedLeader.profile.attackMode }}</strong>
          </div>
          <div>
            <span>双抗与减伤</span>
            <strong>{{ selectedLeader.profile.defense }}</strong>
          </div>
          <div>
            <span>关键索敌规律</span>
            <strong>{{ selectedLeader.profile.targeting }}</strong>
          </div>
          <div>
            <span>阻挡与随行</span>
            <strong>{{ selectedLeader.profile.blocking }}</strong>
          </div>
        </div>

        <div style="font-size: 13px; line-height: 1.55; color: var(--ink)">
          <b>战前一句话对策：</b>
          {{ selectedLeader.profile.summary }}
        </div>
        <div
          v-if="hiddenHpOf(selectedLeader) && selectedLeader.profile.hiddenSummary"
          style="font-size: 12.5px; line-height: 1.5; color: var(--ink2)">
          <b style="color: #9a5cc8">隐秘核心变化：</b>
          {{ selectedLeader.profile.hiddenSummary }}
        </div>

        <div v-if="selectedLeaderRoles.length" class="row">
          <span v-for="r in selectedLeaderRoles" :key="r" class="tag t">
            关键对策：{{ r }}
          </span>
          <Markup
            v-for="o in selectedLeaderOps"
            :key="o.name"
            :html="op(o.name)" />
        </div>
      </div>
    </div>
  </div>
</template>
