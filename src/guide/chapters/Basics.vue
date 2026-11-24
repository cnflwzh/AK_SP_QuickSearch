<script setup lang="ts">
import {computed, ref} from 'vue';
import {
  BORROW_LIMIT,
  CREDIT_MILESTONES,
  MODES,
  OPERATORS,
  OWN_OPERATOR_BONUS,
  QUICK_CREDIT_MODE,
  SEASON_META,
  SELECTION_LIMITS,
  TIER_LABELS,
} from '../../../data/index.ts';
import GlossaryText from '../../quickref/components/GlossaryText.vue';
import SubTabs, {type SubTabItem} from '../../quickref/components/SubTabs.vue';
import Markup from '../components/Markup.ts';
import {iconSvg, type GuideIconName} from '../icons.ts';
import {basicsContent, creditChart, roundTimeline} from './basicsView.ts';

const content = basicsContent();
const spendRewards = CREDIT_MILESTONES.filter((item) => item.kind === 'spend');
const modeTabs: readonly SubTabItem<number>[] = MODES.map((label, id) => ({
  id,
  label,
}));

const timelineMode = ref(1);
const creditMode = ref(0);
const timeline = computed(() => roundTimeline(timelineMode.value));
const credits = computed(() => creditChart(creditMode.value));

const selectionSummary = SELECTION_LIMITS.map(
  (row) => `${TIER_LABELS[row.tier]}阶 ${row.slots} 槽抽 ${row.perRun}`,
).join(' · ');

const diffs: readonly {
  icon: GuideIconName;
  color: string;
  title: string;
  desc: string;
}[] = [
  {
    icon: 'shield',
    color: 'var(--teal)',
    title: '目标：守住防线 14 回合',
    desc: '怪物会沿路线冲向我方防线终点（蓝门），漏进终点会扣生命值；撑到第 14 回合击败首领（领袖）即通关。',
  },
  {
    icon: 'bolt',
    color: 'var(--accent)',
    title: '操作：花钱买人，战斗全自动',
    desc: `开局场上没人。每回合用系统发的资金买角色（干员）摆上格子，最多同时上场 ${SEASON_META.baseDeploymentLimit} 人；开战后自动打怪放技能，倒下冷却后自动返场。`,
  },
  {
    icon: 'stack',
    color: 'var(--red)',
    title: '成长：三合一与盟约叠层',
    desc: '买齐 3 个同名角色会自动合成为强力「精锐」；凑够同阵营（盟约）人数可激活团队加成，叠高「层数」才能打动后期高血量首领。',
  },
  {
    icon: 'box',
    color: '#8a68b8',
    title: `门槛：没练度也能借 ${BORROW_LIMIT} 人畅玩`,
    desc: '局内角色自带固定等级与技能，无需自己重新养成；未持有的高星角色可在开局前免费借用（不限好友）。',
  },
];
</script>
<template>
  <div class="chap-h">
    <span class="no">01</span>
    <div>
      <h2>快速上手</h2>
      <p class="en">WHAT IS STRONGHOLD PROTOCOL · QUICK START</p>
    </div>
  </div>
  <p class="chap-lead">
    哪怕你从没玩过《明日方舟》或自走棋也没关系——下面先用一分钟讲清
    <b>卫戍协议到底怎么玩</b>
    ，推荐第一把选
    <b>「个人模拟」</b>
    （没有倒计时催促，随时可暂停），边看边试最轻松。
  </p>

  <h3 class="bh">
    <span>1.1</span>
    什么是《卫戍协议》？零基础一分钟读懂
  </h3>
  <div class="diff-cards">
    <div
      v-for="item in diffs"
      :key="item.title"
      class="diff-card"
      :style="{'--dc': item.color}">
      <span class="ic-box" aria-hidden="true">
        <Markup :html="iconSvg(item.icon)" />
      </span>
      <div class="dc-title">{{ item.title }}</div>
      <p>{{ item.desc }}</p>
    </div>
  </div>
  <div class="card mt" style="padding: 13px 18px">
    <div style="font-size: 13px; line-height: 1.65; color: var(--ink2)">
      <b style="color: var(--ink)">
        如果你玩过《明日方舟》普通关卡，只需注意这三点区别：
      </b>
      ① 局内
      <b>没有部署费用（Cost）</b>
      ，开战按 1→8 号位自动依次落地；② 技能转好
      <b>全自动释放</b>
      ，你只需在战前负责买牌、穿装备和调朝向；③ 升级商店（1～6 级）
      <b>只解锁高阶角色，不会增加场上部署人数上限</b>
      。
    </div>
  </div>

  <h3 class="bh">
    <span>1.2</span>
    每回合三步走 &amp; 一局 14 回合节奏
  </h3>
  <div class="phase">
    <div>
      <div class="ph-top">
        <span class="ic-box sm" style="--ic-c: var(--accent)">
          <Markup :html="iconSvg('coin', 'g-ic sm')" />
        </span>
        <div>
          <span class="pn">PHASE 1 · 战前准备</span>
          <strong class="ph-title">休整期</strong>
        </div>
      </div>
      <ul>
        <li>
          领取本回合资金（特定回合先选一次「
          <GlossaryText text="机变" />
          」事件）
        </li>
        <li>
          在商店
          <GlossaryText text="招募 / 出售 / 刷新 / 冻结商店" />
        </li>
        <li>
          <GlossaryText text="升级调度中心（升本）" />
          以刷出更高阶角色
        </li>
        <li>拖动角色摆好格子与面朝方向 · 穿戴装备</li>
      </ul>
    </div>
    <div>
      <div class="ph-top">
        <span class="ic-box sm" style="--ic-c: var(--teal)">
          <Markup :html="iconSvg('swords', 'g-ic sm')" />
        </span>
        <div>
          <span class="pn">PHASE 2 · 自动防守</span>
          <strong class="ph-title">作战阶段</strong>
        </div>
      </div>
      <ul>
        <li>未花完的资金清零，角色按 1→8 号位自动登场</li>
        <li>自动索敌与开技能，被打倒后等冷却结束原地返场</li>
        <li>
          怪物进终点会
          <GlossaryText text="漏怪扣目标生命" />
          （普通回合最多扣 10 点）
        </li>
        <li>作战倒计时结束仍未消灭的怪物，也会算作漏怪</li>
      </ul>
    </div>
    <div>
      <div class="ph-top">
        <span class="ic-box sm" style="--ic-c: var(--green)">
          <Markup :html="iconSvg('shield', 'g-ic sm')" />
        </span>
        <div>
          <span class="pn">PHASE 3 · 仅联机模式</span>
          <strong class="ph-title">联防阶段</strong>
        </div>
      </div>
      <ul>
        <li>联合模拟中有人漏怪时，最多两名本回合 0 漏怪的队友参与联防</li>
        <li>帮漏怪的队友清掉剩余怪物，清完即可免除扣血</li>
        <li>
          联防期间
          <b>不会额外叠加盟约层数</b>
        </li>
      </ul>
    </div>
  </div>

  <div class="stages mt">
    <div style="--sc: var(--teal)">
      <div class="sh">
        <b>前期 · 稳血</b>
        <span class="num">R1–4</span>
      </div>
      <div class="lvb">1–2 级商店 · 抓 Ⅰ–Ⅱ 阶角色</div>
      <ul class="ul">
        <li>
          先凑出
          <b>3 名同核心盟约</b>
          角色，激活基础加成稳住防线
        </li>
        <li>遇到相同角色顺手买下，凑齐 3 张合成第一个精锐</li>
        <li>升级商店的费用每过一回合自动 −1，不急可等降价</li>
      </ul>
    </div>
    <div style="--sc: var(--t4)">
      <div class="sh">
        <b>中期 · 定核</b>
        <span class="num">R5–8</span>
      </div>
      <div class="lvb">3–4 级商店 · 抓 Ⅲ–Ⅳ 阶角色</div>
      <ul class="ul">
        <li>
          确定队伍里的
          <GlossaryText text="主C" />
          （主力输出），好装备集中给它穿
        </li>
        <li>利用三合一赠送的「高一阶三选一」提前拿高阶角色</li>
        <li>顺路凑齐 2～3 人的小型附加盟约补足攻速或生存</li>
      </ul>
    </div>
    <div style="--sc: var(--accent)">
      <div class="sh">
        <b>后期 · 叠层</b>
        <span class="num">R9–13</span>
      </div>
      <div class="lvb">5–6 级商店 · 抓 Ⅴ–Ⅵ 阶角色</div>
      <ul class="ul">
        <li>
          凑齐
          <b>同一核心盟约的 6 名不同干员</b>
          ，解锁阵营大幅强化
        </li>
        <li>换上高阶叠层辅助，把盟约层数快速叠到上百层</li>
        <li>按角色说明里的「身前一格 / 同一行」微调站位和朝向</li>
      </ul>
    </div>
    <div style="--sc: var(--red)">
      <div class="sh">
        <b>决战 · 首领</b>
        <span class="num">R{{ SEASON_META.roundLimits.standard }}</span>
      </div>
      <div class="lvb">终局首领战 · 联机合血</div>
      <ul class="ul">
        <li>根据首领点名规律（如专炸最高攻周围）提前分散站位</li>
        <li>120 秒超时后每秒扣 1 点血，靠叠高的层数击败首领</li>
        <li>
          高难度满足隐藏条件会进
          <b>隐秘核心</b>
          加赛（输了也算通关）
        </li>
      </ul>
    </div>
  </div>

  <h3 class="bh">
    <span>1.3</span>
    开局前准备：免费借满助战，自选槽少带更精
  </h3>
  <div class="prep-grid">
    <div class="card">
      <h4>
        商店里刷出的角色从哪来？
        <span class="h4-note">官方固定池共 {{ OPERATORS.length }} 名</span>
      </h4>
      <div class="roster-tracks">
        <div class="r-track">
          <span class="ic-box sm" style="--ic-c: var(--green)">
            <Markup :html="iconSvg('check', 'g-ic sm')" />
          </span>
          <div>
            <strong class="r-track-title">
              自己账号已有的固定池角色（最优）
            </strong>
            <p>
              不仅拥有玩法专属「特质」（被动特效），若局外养成到精英一及以上还能获得小幅属性加成。
            </p>
          </div>
        </div>
        <div class="r-track">
          <span class="ic-box sm" style="--ic-c: var(--teal)">
            <Markup :html="iconSvg('users', 'g-ic sm')" />
          </span>
          <div>
            <strong class="r-track-title">
              自己没有的 6 星 → 开局前免费借助战（上限 {{ BORROW_LIMIT }} 人）
            </strong>
            <p>
              无需加好友即可在备战页借用同名角色，同样完整保留专属叠层与作战特质。
            </p>
          </div>
        </div>
        <div class="r-track">
          <span class="ic-box sm" style="--ic-c: var(--ink3)">
            <Markup :html="iconSvg('shield', 'g-ic sm')" />
          </span>
          <div>
            <strong class="r-track-title">未持有且未借用 → 系统替补原型</strong>
            <p>
              自动替换入池，能正常凑盟约人数，但
              <b>没有原干员的个人特质</b>
              。
            </p>
          </div>
        </div>
        <div class="r-track">
          <span class="ic-box sm" style="--ic-c: var(--accent)">
            <Markup :html="iconSvg('merge', 'g-ic sm')" />
          </span>
          <div>
            <strong class="r-track-title">
              自选干员槽（{{ selectionSummary }}）
            </strong>
            <p>
              无局内特质，塞太多反而稀释高阶池，只带泛用大 C 或补关键户口即可。
            </p>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <h4>局外账号练度加成</h4>
      <table class="bonus-table">
        <tr>
          <th>自有干员练度</th>
          <th>攻击</th>
          <th>防御</th>
          <th>生命</th>
        </tr>
        <tr>
          <td>未练（精 0）/ 助战</td>
          <td class="n">—</td>
          <td class="n">—</td>
          <td class="n">—</td>
        </tr>
        <tr v-for="row in OWN_OPERATOR_BONUS" :key="row.level">
          <td>
            <b>{{ row.level }}</b>
          </td>
          <td class="n">{{ row.atk }}</td>
          <td class="n">{{ row.def }}</td>
          <td class="n">{{ row.hp }}</td>
        </tr>
      </table>
      <div class="card-foot">
        4★/5★ 与活动 6★ 多为系统特许免借直出。可在
        <a class="qlink" href="/box" style="margin-left: 4px">
          我的 Box
          <Markup :html="iconSvg('link', 'g-ic sm')" />
        </a>
        一键导入练度并查看助战建议。
      </div>
    </div>
  </div>

  <h3 class="bh">
    <span>1.4</span>
    模式选择与回合时间轴
  </h3>
  <div class="mode-picks">
    <div class="mode-pick">
      <div class="mp-h">
        <span class="ic-box sm" style="--ic-c: var(--teal)">
          <Markup :html="iconSvg('user', 'g-ic sm')" />
        </span>
        <strong class="mp-title">个人模拟（新手开荒首推）</strong>
      </div>
      <p>
        <b>无限思考时间</b>
        、随时保存暂离；开局核心盟约二选一砍半卡池，极易合出精锐熟悉套路。
      </p>
    </div>
    <div class="mode-pick">
      <div class="mp-h">
        <span class="ic-box sm" style="--ic-c: var(--accent)">
          <Markup :html="iconSvg('timer', 'g-ic sm')" />
        </span>
        <strong class="mp-title">极速模拟（日常速刷奖励）</strong>
      </div>
      <p>
        浓缩为
        <b>{{ QUICK_CREDIT_MODE.rounds }} 回合</b>
        、前两本升级仅需 1 资金，保持 {{ QUICK_CREDIT_MODE.efficiency }}%
        认证效率，一把十来分钟。
      </p>
    </div>
    <div class="mode-pick">
      <div class="mp-h">
        <span class="ic-box sm" style="--ic-c: #8a68b8">
          <Markup :html="iconSvg('users', 'g-ic sm')" />
        </span>
        <strong class="mp-title">联合模拟（4 人联机冲奖杯）</strong>
      </div>
      <p>
        4 人共享同一卡池，轮选机变与悬赏，0 漏怪队友可
        <b>联防兜底</b>
        ，第 14 回合合血共战领袖。
      </p>
    </div>
  </div>

  <div class="card">
    <div class="row" style="justify-content: space-between; margin-bottom: 8px">
      <SubTabs
        id="tlseg"
        v-model="timelineMode"
        :items="modeTabs"
        :level="3"
        inline
        aria-label="回合时间轴难度" />
      <span class="cnt" id="tlinfo">{{ timeline.tlinfo }}</span>
    </div>
    <Markup as="div" class="tl" id="tl" :html="timeline.tl" />
    <div class="legend">
      <span>
        <i
          style="
            background: color-mix(in srgb, var(--teal) 72%, transparent);
          "></i>
        每场作战时限（秒）
      </span>
      <span>
        <i style="background: var(--red)"></i>
        最终领袖战（120s）
      </span>
      <span>
        <i style="background: var(--ink3)"></i>
        隐秘核心附加战 ??
      </span>
      <span>
        <i
          style="
            background: var(--accent);
            transform: rotate(45deg) scale(0.8);
          "></i>
        回合结束后触发机变 / 悬赏决策
      </span>
    </div>
  </div>

  <details class="guide-fold">
    <summary>查看难度解锁路线、规程 1–20 效率与赛季认证收益详表</summary>
    <div class="guide-fold-body">
      <div class="g2">
        <div class="card">
          <h4>联合模拟 · 四档难度与认证效率</h4>
          <Markup as="div" id="diff" :html="content.diff" />
        </div>
        <div class="card">
          <h4>个人模拟 · 规程等级 1–20</h4>
          <Markup
            as="svg"
            class="svgbox"
            id="lvchart"
            viewBox="0 0 640 210"
            role="img"
            aria-label="个人模拟规程等级与认证效率"
            aria-describedby="solo-level-description"
            :html="content.lvchart" />
          <div class="row mt">
            <span class="cnt">Lv1–4 缺席盟约：</span>
            <Markup as="span" id="lvmiss" class="row" :html="content.lvmiss" />
          </div>
        </div>
      </div>

      <div class="card mt">
        <h4>个人规程 ⇄ 联合模拟 跨线解锁关系</h4>
        <Markup
          as="svg"
          class="svgbox"
          id="unlock"
          viewBox="0 0 680 230"
          role="img"
          aria-label="个人与联合模拟解锁关系"
          aria-describedby="unlock-description"
          :html="content.unlock" />
        <div class="legend">
          <span>
            <i style="background: var(--teal)"></i>
            个人通关解锁联合高难
          </span>
          <span>
            <i style="background: var(--accent)"></i>
            联合通关直升个人规程
          </span>
          <span>
            <i style="background: var(--ink3)"></i>
            击败隐秘核心 / 高血量通关可跳级（最高至规程 15）
          </span>
        </div>
      </div>

      <div class="g2 mt">
        <div class="card">
          <h4>单局通过回合数 → 认证获取</h4>
          <div
            class="row"
            style="justify-content: space-between; margin-bottom: 6px">
            <SubTabs
              id="crseg"
              v-model="creditMode"
              :items="modeTabs"
              :level="3"
              inline
              aria-label="认证收益难度" />
            <span class="cnt" id="crsum">{{ credits.crsum }}</span>
          </div>
          <Markup
            as="svg"
            class="svgbox"
            id="crchart"
            viewBox="0 0 600 220"
            role="img"
            :aria-label="`${MODES[creditMode]}通过回合数与认证收益`"
            aria-describedby="credit-chart-description"
            :html="credits.crchart" />
        </div>
        <div class="card">
          <h4>赛季认证上限与限时累消奖励</h4>
          <Markup
            as="svg"
            class="svgbox"
            id="shopbar"
            viewBox="0 0 600 150"
            role="img"
            aria-label="赛季商店认证进度"
            aria-describedby="season-shop-description"
            :html="content.shopbar" />
          <div class="card-foot">
            <div v-for="reward in spendRewards" :key="reward.value">
              · 限时兑换累消
              <b>{{ reward.value }}</b>
              ：{{ reward.reward }}
            </div>
            <div>
              · 联机奖杯仅联合模拟统计（0 / 10 / 30 / 60 / 100 / 150 / 200 /
              300+），序列结束认证清零。
            </div>
          </div>
        </div>
      </div>
    </div>
  </details>
</template>
