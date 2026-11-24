<script setup lang="ts">
import {ref} from 'vue';
import {
  COMPANION_EQUIP_NAME,
  DEPLOYMENT_BONUS_EQUIP,
  OPERATORS,
  SEASON_META,
  TIERS,
  TIER_LABELS,
} from '../../../data/index.ts';
import GlossaryText from '../../quickref/components/GlossaryText.vue';
import SelectInput, {
  type SelectEntry,
} from '../../quickref/components/SelectInput.vue';
import SubTabs, {type SubTabItem} from '../../quickref/components/SubTabs.vue';
import {avatar, eq, op, st} from '../chips.ts';
import Markup from '../components/Markup.ts';
import ShopSimulator from '../components/ShopSimulator.vue';
import {eliteComparison, poolDiagram, recruitContent} from './recruitView.ts';

const content = recruitContent();
const advancedHammer = eq('维式重锤', '维式重锤＋').replace(
  '<span class="eq"',
  '<span style="border-color:var(--accent);border-style:solid" class="eq"',
);
const companionEquip = COMPANION_EQUIP_NAME || '变形同构体';
const deployBonusEquip = DEPLOYMENT_BONUS_EQUIP?.name || '人事部文档';

const eliteName = ref('乌啾');
const poolMode = ref(0);
const poolTabs: readonly SubTabItem<number>[] = [
  {id: 0, label: '只有你玩乌萨斯'},
  {id: 1, label: '队友也玩乌萨斯（撞车）'},
];
const eliteOperatorOptions: readonly SelectEntry<string>[] = TIERS.map(
  (tier) => ({
    label: `${TIER_LABELS[tier]} 阶`,
    options: OPERATORS.filter((o) => o.tier === tier).map((o) => ({
      value: o.name,
      label: o.name,
    })),
  }),
);
</script>
<template>
  <div class="chap-h">
    <span class="no">02</span>
    <div>
      <h2><GlossaryText text="招募与升本" /></h2>
      <p class="en">ECONOMY · SHOP · PROMOTION · EQUIPMENT</p>
    </div>
  </div>
  <p class="chap-lead">
    商店在游戏内叫「调度中心」。休整期的核心只有一件事：
    <b>在开战清零前把资金换成战力或备战席角色</b>
    ，再靠三合一解锁更强的高阶主力。
  </p>

  <h3 class="bh">
    <span>2.1</span>
    资金五件事
    <span class="bh-note">开战瞬间余钱清零，花不完可先买角色存进备战席</span>
  </h3>
  <div class="card">
    <div class="fund">
      <div>
        <b class="m">−2 / 3 / 4</b>
        <span>招募角色</span>
        <small>Ⅰ阶2 · Ⅱ–Ⅳ阶3 · Ⅴ–Ⅵ阶4</small>
      </div>
      <div>
        <b class="p">+1</b>
        <span>出售角色</span>
        <small>卖掉不再需要的角色回 1 块钱</small>
      </div>
      <div>
        <b class="m">−1</b>
        <span>
          <GlossaryText text="刷新" />
          商店
        </span>
        <small>换一批新商品（俗称 D 牌）</small>
      </div>
      <div>
        <b class="m">−N</b>
        <span>
          升级商店（
          <GlossaryText text="升本" />
          ）
        </span>
        <small>每过一回合升级费自动 −1</small>
      </div>
      <div>
        <b>0</b>
        <span>
          冻结商店（
          <GlossaryText text="锁店" />
          ）
        </span>
        <small>买不起的好牌留到下回合</small>
      </div>
    </div>
    <div class="card-foot">
      <b>存钱技巧：</b>
      开战时剩余资金全部清零（仅策略
      <Markup :html="st('坎诺特')" />
      例外）。还剩两三块钱刷不出好卡时，先买下
      <Markup :html="op('真理')" />
      <Markup :html="op('至简')" />
      （1 买 1 卖零损）或任意干员放整备区，下回合缺钱再卖掉换回资金。
    </div>
  </div>

  <ShopSimulator />

  <h3 class="bh">
    <span>2.3</span>
    三合一晋升精锐
    <span class="bh-note">凑齐 3 张同名 → 升精锐 + 0 费拿高一阶牌</span>
  </h3>
  <div class="card">
    <div class="story">
      <div class="sb">
        <div class="sbn">1</div>
        <b>凑齐 3 张同名初始卡</b>
        <div class="fstack">
          <div class="fc" data-t="3">
            <Markup :html="avatar('乌啾')" />
            <i>Ⅲ</i>
            乌啾
          </div>
          <div class="fc" data-t="3">
            <Markup :html="avatar('乌啾')" />
            <i>Ⅲ</i>
            乌啾
          </div>
          <div class="fc" data-t="3">
            <Markup :html="avatar('乌啾')" />
            <i>Ⅲ</i>
            乌啾
          </div>
        </div>
        <ul class="ul">
          <li>场上 + 整备区同名未精锐满 3 张</li>
          <li>特殊例外：星极只需 2 张即合成</li>
        </ul>
      </div>
      <div class="sarr">▶</div>
      <div class="sb">
        <div class="sbn">2</div>
        <b>自动晋升为精锐</b>
        <div class="fstack">
          <div class="fc el" data-t="3">
            <Markup :html="avatar('乌啾')" />
            <i>Ⅲ</i>
            乌啾
          </div>
        </div>
        <ul class="ul">
          <li>3 张合为 1 张，腾出 2 个格子</li>
          <li>直升精二高等级 + 7 级技能 + 模组</li>
          <li>个人特质切换到精锐版本，具体效果见下方对比</li>
        </ul>
      </div>
      <div class="sarr">▶</div>
      <div class="sb">
        <div class="sbn">3</div>
        <b>0 费「高一阶」三选一</b>
        <div class="fstack">
          <div class="fc" data-t="4">
            <i>Ⅳ</i>
            ？
          </div>
          <div class="fc" data-t="4">
            <i>Ⅳ</i>
            ？
          </div>
          <div class="fc" data-t="4">
            <i>Ⅳ</i>
            ？
          </div>
        </div>
        <ul class="ul">
          <li>
            刷出
            <b>当前商店等级 +1 阶</b>
            （封顶Ⅵ阶）
          </li>
          <li><b>不可刷新、不可锁店，当回合必选！</b></li>
        </ul>
      </div>
    </div>

    <div class="bump-row">
      <div class="bump-item">
        <b>3 级店合成 → 拿 Ⅳ 阶</b>
        <span>俗称「三本碰四」，提前拿中期主力</span>
      </div>
      <div class="bump-item">
        <b>4 级店合成 → 拿 Ⅴ 阶</b>
        <span>「四本碰五」，抢抓高阶叠层辅助</span>
      </div>
      <div class="bump-item">
        <b>5 级店合成 → 拿 Ⅵ 阶</b>
        <span>「五本碰六」，精准找终盘主力输出</span>
      </div>
    </div>
  </div>

  <div class="g3 mt">
    <div class="card">
      <h4>精锐前后特质对比</h4>
      <div class="row" style="margin-bottom: 10px">
        <label for="elSel" class="lab" style="margin: 0">干员</label>
        <SelectInput
          id="elSel"
          v-model="eliteName"
          :options="eliteOperatorOptions"
          aria-label="选择干员对比精锐前后" />
      </div>
      <Markup as="div" id="elOut" :html="eliteComparison(eliteName)" />
    </div>
    <div class="card">
      <h4>做一名精锐要花多少资金</h4>
      <Markup as="div" id="elCost" :html="content.elCost" />
    </div>
    <div class="card">
      <h4>精锐联动与直升捷径</h4>
      <Markup as="div" id="elFx" :html="content.elFx" />
    </div>
  </div>

  <details class="guide-fold">
    <summary>查看 Ⅰ–Ⅵ 阶干员购买价与局内固定练度详表</summary>
    <div class="guide-fold-body">
      <div class="tw">
        <Markup as="table" id="tierTbl" :html="content.tierTbl" />
      </div>
    </div>
  </details>

  <h3 class="bh">
    <span>2.4</span>
    卡池与商店规则
    <span class="bh-note">联机防撞同行 · 单人开局二选一</span>
  </h3>
  <div class="g2">
    <div class="card">
      <h4>联合模拟 · 4 人共用同一卡池</h4>
      <SubTabs
        id="poolSeg"
        v-model="poolMode"
        :items="poolTabs"
        :level="3"
        inline
        aria-label="卡池占用情况" />
      <Markup as="div" class="pv" id="poolV" :html="poolDiagram(poolMode)" />
      <div class="card-foot">
        开局先看队友阵营，避免抢同一批卡。「信标」在下个休整期把原干员送给对应盟约干员最多的队友，并列时随机选择。自选干员不能使用。
      </div>
    </div>
    <div class="card">
      <h4>个人模拟 · 开局核心盟约二选一</h4>
      <Markup as="div" id="soloSplit" :html="content.soloSplit" />
      <div class="card-foot">
        未选的 5 个核心盟约干员整局移出卡池，干扰牌少一半，搜主 C 与合精锐更快。
      </div>
    </div>
  </div>

  <div class="g2 mt">
    <div class="card">
      <h4>商店等级 → 可刷出等阶上限</h4>
      <p class="sim-hint">此表的干员栏位适用于个人规程与联合险境及以上难度。</p>
      <Markup as="div" id="tierMx" :html="content.tierMx" />
    </div>
    <div class="card">
      <h4><GlossaryText text="刷新（D 牌）与锁店" /></h4>
      <Markup as="div" class="rf" id="rfx" :html="content.rfx" />
      <Markup as="div" id="rfChips" class="mt" :html="content.rfChips" />
    </div>
  </div>

  <h3 class="bh">
    <span>2.5</span>
    场上阵型与整备区
    <span class="bh-note">
      升本不增加部署位，默认可上阵 {{ SEASON_META.baseDeploymentLimit }} 人
    </span>
  </h3>
  <div class="card">
    <div class="cmp">
      <div class="cmpc">
        <div class="cmph">
          <b>场上（作战阵型）</b>
          <span class="cnt">
            默认 {{ SEASON_META.baseDeploymentLimit }} 人 ·
            <Markup :html="eq(deployBonusEquip)" />
            +1 人
          </span>
        </div>
        <Markup as="div" class="dgrid" id="dgrid" :html="content.dgrid" />
        <ul class="ck">
          <li>参战并计入盟约人数（同名重复上场只算 1 人）</li>
          <li>格子与朝向决定「身前一格 / 身后一格 / 同一行」</li>
          <li>
            被击倒后等再部署冷却结束，
            <b>原地免费返场</b>
          </li>
        </ul>
      </div>
      <div class="cmpc">
        <div class="cmph">
          <b>整备区（备战席）</b>
          <span class="cnt">干员 10 格（含召唤物） · 装备 5 格</span>
        </div>
        <Markup
          as="div"
          class="bench"
          id="benchDemo"
          :html="content.benchDemo" />
        <ul class="ck">
          <li class="x">不参战，默认不计入盟约激活人数</li>
          <li>
            <b>远见 / 奇迹 / 投资人</b>
            放整备区也算人数！
          </li>
          <li>可直接给整备区干员穿装备；部分特质在整备区也生效</li>
          <li class="w">
            栏位塞满时额外获取会暂存「溢出」，
            <b>进下一阶段前未腾出空位将直接清空！</b>
          </li>
        </ul>
      </div>
    </div>

    <div class="dsteps mt">
      <div>
        <b>0s</b>
        <span>开战余钱清零</span>
      </div>
      <div>
        <b>3s</b>
        <span>1 号位率先落地</span>
      </div>
      <div>
        <b>1 → 8</b>
        <span>从上到下、从左到右</span>
      </div>
      <div>
        <b>召唤物</b>
        <span>干员全上场后补位</span>
      </div>
      <div>
        <b>开技能</b>
        <span>索敌就绪自动释放</span>
      </div>
      <div>
        <b>倒下后</b>
        <span>冷却后原地返场</span>
      </div>
    </div>
  </div>

  <details class="guide-fold">
    <summary>查看出场顺序、身前一格、同一行与整备区生效的干员名单</summary>
    <div class="guide-fold-body">
      <Markup as="div" id="ordFx" :html="content.ordFx" />
    </div>
  </details>

  <h3 class="bh">
    <span>2.6</span>
    装备合成与转职规则
  </h3>
  <div class="eqrule">
    <div>
      <div class="eqx">
        <Markup :html="eq('维式重锤')" />
        ＋
        <Markup :html="eq('维式重锤')" />
      </div>
      <div class="eqx" style="margin-top: 6px">
        ＝
        <Markup :html="advancedHammer" />
      </div>
      <p>
        <b>同名二合一</b>
        ：可进阶的基础装备凑齐两件时自动合成
      </p>
    </div>
    <div>
      <div class="eqx">
        <span class="tag">栏位 1</span>
        <span class="tag">栏位 2</span>
      </div>
      <div class="eqx" style="margin-top: 6px">
        <span class="tag r">第 3 件需选旧装替换，也可取消</span>
      </div>
      <p>
        <b>每人限 2 件</b>
        ：穿后无法卸下或出售，确认替换会销毁所选旧装
      </p>
    </div>
    <div>
      <div class="eqx">
        <Markup :html="eq('随身身份牌')" />
        <Markup :html="eq('精打细算玩偶')" />
      </div>
      <div class="eqx" style="margin-top: 6px">
        <span class="tag t">装备时销毁生效</span>
      </div>
      <p>
        <b>消耗道具</b>
        ：喂给有空栏位干员即可
      </p>
    </div>
    <div>
      <div class="eqx"><Markup :html="eq(companionEquip)" /></div>
      <div class="eqx" style="margin-top: 6px">
        <span class="tag a">＋ 盟约装 ＝ 转职凑户口</span>
      </div>
      <p>
        <b>凑人数利器</b>
        ：如配重锤获【维多利亚】
      </p>
    </div>
  </div>

  <div class="card mt">
    <h4>
      5 套散件组合神装（价值 6 资金）
      <span class="h4-note">成对穿给同一干员自动合成</span>
    </h4>
    <Markup as="div" class="combo-grid" id="combos" :html="content.combos" />
  </div>
</template>
