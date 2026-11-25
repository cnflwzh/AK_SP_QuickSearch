<script setup lang="ts">
import {computed, ref, watch} from 'vue';
import {wan} from '../lib/ui/dom.ts';
import type {CovenantRosterNode} from './infographic.ts';
import {buildSeasonDiffInfographic} from './infographic.ts';
import type {DiffCategory, SeasonVisualComparison} from './comparison.ts';
import EmptyState from '../quickref/components/EmptyState.vue';
import SectionHeading from '../quickref/components/SectionHeading.vue';
import CovenantCurvePanel from './CovenantCurvePanel.vue';

const props = defineProps<{
  comparison: SeasonVisualComparison;
  fromLabel: string;
  toLabel: string;
  totalChanges: number;
}>();

const data = computed(() => buildSeasonDiffInfographic(props.comparison));

const emit = defineEmits<{
  selectCategory: [category: DiffCategory | 'all'];
  inspectEntity: [category: DiffCategory, name: string];
}>();

// 左侧盟约矩阵与右侧曲线选择器共享当前选中项。
const activeCurveName = ref('');

watch(
  () => data.value.covenantCurves,
  (curves) => {
    if (!curves.some((c) => c.name === activeCurveName.value)) {
      activeCurveName.value = curves[0]?.name ?? '';
    }
  },
  {immediate: true},
);

const curveNameSet = computed(
  () => new Set(data.value.covenantCurves.map((c) => c.name)),
);

function onClickCovenantNode(node: CovenantRosterNode): void {
  if (curveNameSet.value.has(node.name)) {
    activeCurveName.value = node.name;
    return;
  }
  emit('inspectEntity', 'covenants', node.name);
}

/* ---------- 干员等阶柱高度归一化 ---------- */
const maxTierCount = computed(() =>
  Math.max(
    1,
    ...data.value.operatorTiers.flatMap((t) => [t.beforeCount, t.afterCount]),
  ),
);

/* ---------- 策略生命哑铃图坐标映射 ---------- */
const hpRange = computed(() => {
  const vals = data.value.strategyDeltas.flatMap((s) =>
    [s.beforeHp, s.afterHp].filter((v): v is number => v !== null),
  );
  if (!vals.length) return {min: 20, max: 46, ticks: [20, 25, 30, 35, 40, 45]};
  const min = Math.min(20, Math.floor((Math.min(...vals) - 2) / 5) * 5);
  const max = Math.max(45, Math.ceil((Math.max(...vals) + 2) / 5) * 5);
  const ticks: number[] = [];
  for (let v = min; v <= max; v += 5) ticks.push(v);
  return {min, max, ticks};
});

function hpPct(hp: number): number {
  const {min, max} = hpRange.value;
  return Math.max(2, Math.min(98, ((hp - min) / (max - min || 1)) * 100));
}

/* ---------- 升本费用柱高度归一化 ---------- */
const maxDispatchCost = computed(() =>
  Math.max(
    1,
    ...data.value.dispatchSteps.flatMap((d) => [
      d.beforeCost ?? 0,
      d.afterCost ?? 0,
    ]),
  ),
);

/* ---------- Boss 血量涨跌双向条形图归一化 ---------- */
const maxLeaderPct = computed(() =>
  Math.max(
    15,
    ...data.value.leaderDeltas.map((l) => Math.abs(l.deltaPercent ?? 0)),
  ),
);
</script>

<template>
  <div class="ig-root">
    <!-- 0. 顶层一图读懂速览卡 + 四大核心赛制指标 -->
    <section class="ig-card ig-hero-card" aria-label="赛季更新核心要点">
      <div class="ig-hero-head">
        <div>
          <span class="kicker">VISUAL SUMMARY · 一图读懂</span>
          <h2 class="ig-hero-title">
            {{ fromLabel }}
            <span class="ig-arrow">➔</span>
            {{ toLabel }}
          </h2>
        </div>
        <button
          type="button"
          class="btn p"
          @click="emit('selectCategory', 'all')">
          查看全部 {{ totalChanges }} 项 Git 左右对比 ▸
        </button>
      </div>

      <ul v-if="data.headlines.length" class="ig-headlines">
        <li v-for="(line, idx) in data.headlines" :key="idx">
          {{ line }}
        </li>
      </ul>

      <div class="ig-kpi-grid">
        <div
          v-for="kpi in data.macroKpis"
          :key="kpi.label"
          :class="['ig-kpi', {changed: kpi.changed}]">
          <span class="ig-kpi-label">{{ kpi.label }}</span>
          <div class="ig-kpi-vals">
            <span class="ig-kpi-old">{{ kpi.before }}</span>
            <i class="ig-kpi-arr" aria-hidden="true">→</i>
            <b class="ig-kpi-new">{{ kpi.after }}</b>
          </div>
          <span :class="['ig-kpi-delta', `is-${kpi.tone}`]">
            {{ kpi.deltaText }}
          </span>
        </div>
      </div>
    </section>

    <!-- 第一排双栏：1. 五大模块变更分布 + 4. 开局策略生命哑铃图 -->
    <div class="ig-grid-2">
      <!-- 1. 五大模块改动规模堆叠图 -->
      <section class="ig-card" aria-label="各模块变更规模分布">
        <SectionHeading
          title="各模块改动规模分布"
          desc="点击任一模块直达对应 Git 左右对比"
          accent="var(--accent)"
          variant="bar"
          :level="3" />

        <div class="ig-mod-list">
          <button
            v-for="bar in data.moduleBars"
            :key="bar.id"
            type="button"
            class="ig-mod-row"
            @click="emit('selectCategory', bar.id)">
            <div class="ig-mod-top">
              <b>{{ bar.label }}</b>
              <span class="ig-mod-counts">
                <em v-if="bar.added" class="c-add">+{{ bar.added }}新</em>
                <em v-if="bar.modified" class="c-mod">~{{ bar.modified }}改</em>
                <em v-if="bar.removed" class="c-del">−{{ bar.removed }}移</em>
                <em v-if="!bar.totalChanges" class="muted">无变动</em>
              </span>
              <span class="ig-mod-pct">
                {{ bar.totalChanges }}/{{ bar.poolTotal }}（{{
                  bar.changePercent
                }}%）▸
              </span>
            </div>
            <div class="ig-stack-track" aria-hidden="true">
              <span
                v-if="bar.added"
                class="seg-add"
                :style="{
                  width: `${(bar.added / Math.max(1, bar.poolTotal)) * 100}%`,
                }"></span>
              <span
                v-if="bar.modified"
                class="seg-mod"
                :style="{
                  width: `${(bar.modified / Math.max(1, bar.poolTotal)) * 100}%`,
                }"></span>
              <span
                v-if="bar.removed"
                class="seg-del"
                :style="{
                  width: `${(bar.removed / Math.max(1, bar.poolTotal)) * 100}%`,
                }"></span>
            </div>
          </button>
        </div>

        <div class="ig-legend">
          <span>
            <i class="dot add"></i>
            新增入池
          </span>
          <span>
            <i class="dot mod"></i>
            数值/机制调整
          </span>
          <span>
            <i class="dot del"></i>
            轮换移出
          </span>
          <span>
            <i class="dot idle"></i>
            保留未变
          </span>
        </div>
      </section>

      <!-- 4. 开局策略初始目标生命与机制哑铃图 -->
      <section class="ig-card" aria-label="开局策略生命与机制变化图">
        <SectionHeading
          title="开局策略生命与技能变化"
          :count="`${data.strategyDeltas.length} 项`"
          desc="圆圈连线展示初始目标生命增减"
          accent="var(--teal)"
          variant="bar"
          :level="3">
          <template #extra>
            <button
              type="button"
              class="ig-more-link"
              @click="emit('selectCategory', 'strategies')">
              策略明细 ▸
            </button>
          </template>
        </SectionHeading>

        <div v-if="data.strategyDeltas.length" class="ig-dumbbell">
          <div class="ig-db-axis" aria-hidden="true">
            <span class="ig-db-axis-spacer">指挥官</span>
            <div class="ig-db-scale">
              <span
                v-for="tick in hpRange.ticks"
                :key="tick"
                :style="{left: `${hpPct(tick)}%`}">
                {{ tick }}
              </span>
            </div>
          </div>

          <button
            v-for="st in data.strategyDeltas"
            :key="st.name"
            type="button"
            class="ig-db-row"
            :title="st.skillSummary"
            @click="emit('inspectEntity', 'strategies', st.name)">
            <span class="ig-db-who">
              <img
                :src="st.portraitSrc"
                alt=""
                width="26"
                height="26"
                loading="lazy"
                decoding="async" />
              <b>{{ st.name }}</b>
            </span>

            <div class="ig-db-track">
              <i
                v-for="tick in hpRange.ticks"
                :key="tick"
                class="ig-db-grid"
                :style="{left: `${hpPct(tick)}%`}"
                aria-hidden="true"></i>

              <!-- 生命值发生增减：哑铃连线 -->
              <template
                v-if="
                  st.beforeHp !== null &&
                  st.afterHp !== null &&
                  st.beforeHp !== st.afterHp
                ">
                <span
                  :class="[
                    'ig-db-bar',
                    st.afterHp > st.beforeHp ? 'is-up' : 'is-down',
                  ]"
                  :style="{
                    left: `${Math.min(hpPct(st.beforeHp), hpPct(st.afterHp))}%`,
                    width: `${Math.abs(hpPct(st.afterHp) - hpPct(st.beforeHp))}%`,
                  }"></span>
                <span
                  class="ig-db-dot is-old"
                  :style="{left: `${hpPct(st.beforeHp)}%`}">
                  {{ st.beforeHp }}
                </span>
                <span
                  :class="[
                    'ig-db-dot',
                    st.afterHp > st.beforeHp ? 'is-up' : 'is-down',
                  ]"
                  :style="{left: `${hpPct(st.afterHp)}%`}">
                  {{ st.afterHp }}
                </span>
              </template>

              <!-- 生命未变、仅技能重做/加强 -->
              <template v-else-if="st.beforeHp !== null && st.afterHp !== null">
                <span
                  class="ig-db-dot is-skill"
                  :style="{left: `${hpPct(st.afterHp)}%`}">
                  {{ st.afterHp }} · 持平
                </span>
              </template>

              <!-- 新增策略 -->
              <template v-else-if="st.afterHp !== null">
                <span
                  class="ig-db-dot is-new"
                  :style="{left: `${hpPct(st.afterHp)}%`}">
                  +新 {{ st.afterHp }}
                </span>
              </template>

              <!-- 移出策略 -->
              <template v-else-if="st.beforeHp !== null">
                <span
                  class="ig-db-dot is-out"
                  :style="{left: `${hpPct(st.beforeHp)}%`}">
                  −移 {{ st.beforeHp }}
                </span>
              </template>
            </div>
          </button>
        </div>
        <EmptyState v-else compact message="开局策略无变动。" />
      </section>
    </div>

    <!-- 2. 盟约轮换矩阵 + 0–200 层收益折线图（基于 Chart.js 组件，受控宽度永不溢出） -->
    <section
      v-if="data.covenantNodes.length"
      class="ig-card"
      aria-label="盟约生态轮换与叠层收益曲线对比">
      <SectionHeading
        title="盟约轮换图谱与叠层收益折线图"
        :count="`${data.covenantNodes.length} 个盟约变动`"
        :desc="
          data.covenantCurves.length
            ? '点选盟约或切换下拉框，轻触曲线查看各层差值'
            : '点选盟约查看词条对比'
        "
        accent="var(--accent)"
        variant="bar"
        :level="3">
        <template #extra>
          <button
            type="button"
            class="ig-more-link"
            @click="emit('selectCategory', 'covenants')">
            盟约明细 ▸
          </button>
        </template>
      </SectionHeading>

      <div
        :class="['ig-cov-layout', {'is-single': !data.covenantCurves.length}]">
        <!-- 左：变动盟约徽章卡片矩阵 -->
        <div class="ig-cov-matrix">
          <div
            v-for="node in data.covenantNodes"
            :key="node.name"
            :class="[
              'ig-cov-node',
              `is-${node.status}`,
              {'is-selected': activeCurveName === node.name},
            ]"
            :style="{'--c': node.color}">
            <button
              type="button"
              class="ig-cov-main"
              @click="onClickCovenantNode(node)">
              <span class="ig-cov-emblem">
                <img
                  :src="node.iconSrc"
                  alt=""
                  width="30"
                  height="30"
                  loading="lazy"
                  decoding="async" />
              </span>
              <span class="ig-cov-body">
                <span class="ig-cov-title">
                  <b>{{ node.name }}</b>
                  <i :class="['ig-mini-tag', `is-${node.status}`]">
                    {{
                      node.status === 'added'
                        ? '+新入池'
                        : node.status === 'removed'
                          ? '−已移出'
                          : '~已调整'
                    }}
                  </i>
                </span>
                <small>{{ node.brief }}</small>
              </span>
            </button>
            <button
              type="button"
              class="ig-cov-diff-btn"
              :title="`查看【${node.name}】完整词条对比`"
              :aria-label="`查看${node.name}词条对比`"
              @click="emit('inspectEntity', 'covenants', node.name)">
              对比 ▸
            </button>
          </div>
        </div>

        <CovenantCurvePanel
          v-if="data.covenantCurves.length"
          v-model="activeCurveName"
          :curves="data.covenantCurves"
          :from-label="fromLabel"
          :to-label="toLabel"
          @inspect="(name) => emit('inspectEntity', 'covenants', name)" />
      </div>
    </section>

    <!-- 3. Ⅰ–Ⅵ 阶固定干员卡池容量与进出图解 -->
    <section class="ig-card" aria-label="各等阶干员卡池分布与轮换图">
      <SectionHeading
        title="各等阶干员卡池分布与进出图解"
        desc="双柱对比各阶人数，点击干员头像查看特质变化"
        accent="var(--t3)"
        variant="bar"
        :level="3">
        <template #extra>
          <button
            type="button"
            class="ig-more-link"
            @click="emit('selectCategory', 'operators')">
            干员明细 ▸
          </button>
        </template>
      </SectionHeading>

      <div class="ig-tier-grid">
        <div
          v-for="t in data.operatorTiers"
          :key="t.tier"
          class="ig-tier-col"
          :data-t="t.tier">
          <div class="ig-tier-head">
            <i class="ig-tier-badge">{{ t.tierLabel }} 阶</i>
            <span
              v-if="t.deltaCount !== 0"
              :class="['ig-delta-chip', t.deltaCount > 0 ? 'up' : 'down']">
              {{ t.deltaCount > 0 ? `+${t.deltaCount}` : t.deltaCount }}
            </span>
          </div>

          <!-- 双柱对比 -->
          <div
            class="ig-bars-pair"
            role="img"
            :aria-label="`${fromLabel} ${t.beforeCount} 名，${toLabel} ${t.afterCount} 名`">
            <div class="ig-vbar-wrap">
              <span class="ig-vbar-num muted">{{ t.beforeCount }}</span>
              <div
                class="ig-vbar is-old"
                :style="{
                  height: `${(t.beforeCount / maxTierCount) * 76}px`,
                }"></div>
              <small>原</small>
            </div>
            <div class="ig-vbar-wrap">
              <span class="ig-vbar-num">{{ t.afterCount }}</span>
              <div
                class="ig-vbar is-new"
                :style="{
                  height: `${(t.afterCount / maxTierCount) * 76}px`,
                }"></div>
              <small>新</small>
            </div>
          </div>

          <!-- 该阶进出/调阶干员头像 -->
          <div class="ig-tier-ops">
            <button
              v-for="op in t.addedOps"
              :key="`add:${op.name}`"
              type="button"
              class="ig-op-chip is-add"
              :title="`新增 ${t.tierLabel}阶：${op.name}`"
              @click="emit('inspectEntity', 'operators', op.name)">
              <img
                :src="op.avatarSrc"
                alt=""
                width="24"
                height="24"
                loading="lazy" />
              <span>+{{ op.name }}</span>
            </button>
            <button
              v-for="op in t.shiftedInOps"
              :key="`shift:${op.name}`"
              type="button"
              class="ig-op-chip is-mod"
              :title="`调阶 ${op.fromTierLabel}→${t.tierLabel}：${op.name}`"
              @click="emit('inspectEntity', 'operators', op.name)">
              <img
                :src="op.avatarSrc"
                alt=""
                width="24"
                height="24"
                loading="lazy" />
              <span>
                {{ op.name }} {{ op.fromTierLabel }}→{{ t.tierLabel }}
              </span>
            </button>
            <button
              v-for="op in t.removedOps"
              :key="`del:${op.name}`"
              type="button"
              class="ig-op-chip is-del"
              :title="`移出：${op.name}`"
              @click="emit('inspectEntity', 'operators', op.name)">
              <img
                :src="op.avatarSrc"
                alt=""
                width="24"
                height="24"
                loading="lazy" />
              <span>−{{ op.name }}</span>
            </button>
            <span
              v-if="
                !t.addedOps.length &&
                !t.shiftedInOps.length &&
                !t.removedOps.length
              "
              class="ig-tier-quiet">
              无进出或调入
            </span>
          </div>
        </div>
      </div>
    </section>

    <!-- 第三排双栏：5. 调度中心升本阶梯 & 装备合成树 + 6. Boss 血量涨跌图 -->
    <div class="ig-grid-2">
      <!-- 5. 调度中心升本与高阶合成配方图解 -->
      <section class="ig-card" aria-label="升本节奏与高阶合成配方变化">
        <SectionHeading
          title="升本节奏与装备合成树"
          accent="var(--t5)"
          variant="bar"
          :level="3">
          <template #extra>
            <button
              type="button"
              class="ig-more-link"
              @click="emit('selectCategory', 'equipment')">
              装备明细 ▸
            </button>
          </template>
        </SectionHeading>

        <div class="ig-dispatch-steps">
          <div
            v-for="step in data.dispatchSteps"
            :key="step.level"
            :class="['ig-step-box', {changed: step.changed}]">
            <div class="ig-step-lv">Lv.{{ step.level }}</div>
            <div
              v-if="step.afterCost !== null || step.beforeCost !== null"
              class="ig-step-bars">
              <div
                class="ig-step-bar old"
                :style="{
                  height: `${((step.beforeCost ?? 0) / maxDispatchCost) * 38}px`,
                }"></div>
              <div
                class="ig-step-bar new"
                :style="{
                  height: `${((step.afterCost ?? 0) / maxDispatchCost) * 38}px`,
                }"></div>
            </div>
            <div v-else class="ig-step-max">MAX</div>
            <div class="ig-step-cost">
              <span
                v-if="
                  step.beforeCost !== null && step.beforeCost !== step.afterCost
                "
                class="old">
                {{ step.beforeCost }}
              </span>
              <b v-if="step.afterCost !== null">{{ step.afterCost }}资</b>
              <span v-else class="muted">
                {{ step.afterOpSlots === null ? '已移除' : '满级' }}
              </span>
            </div>
            <div v-if="step.afterOpSlots !== null" class="ig-step-slots">
              {{ step.afterOpSlots }}人·
              <b :class="{hi: step.beforeEqSlots !== step.afterEqSlots}">
                {{ step.afterEqSlots }}装
              </b>
            </div>
          </div>
        </div>

        <div v-if="data.comboDiffs.length" class="ig-combos">
          <div class="ig-sub-caption">高阶装备合成树变动</div>
          <button
            v-for="combo in data.comboDiffs"
            :key="
              JSON.stringify([
                combo.status,
                combo.first.name,
                combo.second.name,
                combo.result.name,
              ])
            "
            type="button"
            :class="['ig-combo-row', `is-${combo.status}`]"
            @click="emit('inspectEntity', 'equipment', combo.result.name)">
            <span :class="['ig-mini-tag', `is-${combo.status}`]">
              {{ combo.status === 'added' ? '+新增配方' : '−移除配方' }}
            </span>
            <span class="ig-eq-node" :data-t="combo.first.tier">
              <img
                :src="combo.first.iconSrc"
                alt=""
                width="24"
                height="24"
                loading="lazy" />
              {{ combo.first.name }}
            </span>
            <b class="ig-sign">＋</b>
            <span class="ig-eq-node" :data-t="combo.second.tier">
              <img
                :src="combo.second.iconSrc"
                alt=""
                width="24"
                height="24"
                loading="lazy" />
              {{ combo.second.name }}
            </span>
            <b class="ig-sign">➔</b>
            <span class="ig-eq-node is-res" :data-t="combo.result.tier">
              <img
                :src="combo.result.iconSrc"
                alt=""
                width="26"
                height="26"
                loading="lazy" />
              <b>{{ combo.result.name }}</b>
            </span>
          </button>
        </div>
      </section>

      <!-- 6. Boss 领袖血量涨跌双向条形图 -->
      <section class="ig-card" aria-label="Boss领袖血量与隐秘核心变化">
        <SectionHeading
          title="Boss 领袖压力与隐秘核心变化"
          :count="
            data.leaderDeltas.length ? `${data.leaderDeltas.length} 名` : '稳定'
          "
          accent="var(--red)"
          variant="bar"
          :level="3">
          <template #extra>
            <button
              type="button"
              class="ig-more-link"
              @click="emit('selectCategory', 'rules')">
              Boss与规则 ▸
            </button>
          </template>
        </SectionHeading>

        <div v-if="data.leaderDeltas.length" class="ig-boss-list">
          <button
            v-for="ld in data.leaderDeltas"
            :key="ld.name"
            type="button"
            class="ig-boss-row"
            @click="emit('inspectEntity', 'rules', ld.name)">
            <div class="ig-boss-head">
              <img
                class="ig-boss-av"
                :src="ld.iconSrc"
                alt=""
                width="34"
                height="34"
                loading="lazy"
                decoding="async" />
              <div class="ig-boss-meta">
                <div class="ig-boss-title">
                  <b>{{ ld.name }}</b>
                  <span v-if="ld.addedHiddenCore" class="ig-hc-pill">
                    ★ 新增隐秘核心
                  </span>
                  <span
                    v-if="ld.status === 'removed'"
                    class="ig-mini-tag is-removed">
                    −移出轮换
                  </span>
                  <span
                    v-if="ld.status === 'added'"
                    class="ig-mini-tag is-added">
                    +新入池
                  </span>
                </div>
                <small>{{ ld.note }}</small>
              </div>
              <span
                v-if="ld.deltaPercent !== null && ld.deltaPercent !== 0"
                :class="['ig-delta-chip', ld.deltaPercent < 0 ? 'up' : 'down']">
                {{ ld.deltaPercent > 0 ? '+' : '' }}{{ ld.deltaPercent }}% 血量
              </span>
            </div>

            <div v-if="ld.status === 'modified'" class="ig-diverge-wrap">
              <span class="ig-div-num">
                标准 {{ wan(ld.beforeStandardHp ?? 0) }} →
                {{ wan(ld.afterStandardHp ?? 0) }}
              </span>
              <div class="ig-diverge-track" aria-hidden="true">
                <i class="ig-diverge-mid"></i>
                <span
                  v-if="ld.deltaPercent !== null && ld.deltaPercent !== 0"
                  :class="[
                    'ig-diverge-bar',
                    ld.deltaPercent < 0 ? 'is-down' : 'is-up',
                  ]"
                  :style="{
                    left:
                      ld.deltaPercent < 0
                        ? `${50 - (Math.abs(ld.deltaPercent) / maxLeaderPct) * 46}%`
                        : '50%',
                    width: `${(Math.abs(ld.deltaPercent) / maxLeaderPct) * 46}%`,
                  }"></span>
              </div>
              <span class="ig-div-num">
                终极 {{ wan(ld.beforeUltimateHp ?? 0) }} →
                {{ wan(ld.afterUltimateHp ?? 0) }}
              </span>
            </div>
          </button>
        </div>
        <EmptyState v-else compact message="Boss 领袖无变动。" />
      </section>
    </div>

    <!-- 底部一键进入完整 Git 对比流 -->
    <div class="ig-foot-cta">
      <span>想逐字核对每条特质、装备与策略更新前后的完整描述？</span>
      <button
        type="button"
        class="btn p"
        @click="emit('selectCategory', 'all')">
        打开左右双栏 Git 逐项对比（{{ totalChanges }} 项）▸
      </button>
    </div>
  </div>
</template>

<style scoped>
.ig-root {
  display: grid;
  gap: 12px;
  min-width: 0;
  max-width: 100%;
}

.ig-card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 14px 16px;
  box-shadow: var(--shadow);
  display: grid;
  gap: 12px;
  min-width: 0;
  max-width: 100%;
}

.ig-grid-2 {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
  align-items: start;
  min-width: 0;
}

@container diff-view (max-width: 820px) {
  .ig-grid-2 {
    grid-template-columns: minmax(0, 1fr);
  }
}

/* 0. 顶层速读英雄卡 */
.ig-hero-card {
  border-left: 3px solid var(--accent);
}

.ig-hero-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
}

.ig-hero-title {
  margin: 4px 0 0;
  font-family: var(--fd);
  font-weight: 400;
  font-size: clamp(20px, 3vw, 26px);
  line-height: 1.15;
  color: var(--ink);
}

.ig-arrow {
  color: var(--accent);
  margin-inline: 6px;
}

.ig-headlines {
  margin: 0;
  padding: 10px 12px 10px 28px;
  border-radius: 8px;
  background: var(--surface2);
  border: 1px solid var(--line);
  display: grid;
  gap: 5px;
  font-size: 13px;
  line-height: 1.55;
  color: var(--ink);
}

.ig-headlines li::marker {
  color: var(--accent);
}

.ig-kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

@container diff-view (max-width: 680px) {
  .ig-kpi-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.ig-kpi {
  padding: 9px 11px;
  border-radius: 8px;
  background: var(--surface2);
  border: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.ig-kpi.changed {
  border-color: color-mix(in srgb, var(--accent) 42%, var(--line2));
  background: color-mix(in srgb, var(--accent) 5%, var(--surface));
}
.ig-kpi-label {
  font-size: 11.5px;
  color: var(--ink3);
}
.ig-kpi-vals {
  display: flex;
  align-items: baseline;
  gap: 5px;
  font-family: var(--fn);
}
.ig-kpi-old {
  font-size: 14px;
  color: var(--ink3);
}
.ig-kpi-arr {
  font-style: normal;
  color: var(--ink3);
  font-size: 12px;
}
.ig-kpi-new {
  font-size: 20px;
  color: var(--ink);
}
.ig-kpi-delta {
  font-family: var(--fn);
  font-size: 11.5px;
  font-weight: 700;
  width: fit-content;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--surface);
  color: var(--ink3);
}
.ig-kpi-delta.is-up {
  background: var(--df-add-bg-strong);
  color: var(--df-add-ink);
}
.ig-kpi-delta.is-down {
  background: var(--df-del-bg-strong);
  color: var(--df-del-ink);
}

/* 通用小型按钮与角标 */
:deep(.ig-more-link) {
  flex: none;
  min-height: 34px;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid var(--line2);
  background: var(--surface);
  color: var(--teal);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}
:deep(.ig-more-link:hover) {
  border-color: var(--accent);
  color: var(--accent);
}

:deep(.ig-delta-chip) {
  font-family: var(--fn);
  font-size: 11.5px;
  font-weight: 700;
  padding: 0 6px;
  border-radius: 999px;
  white-space: nowrap;
}
:deep(.ig-delta-chip.up) {
  background: var(--df-add-bg-strong);
  color: var(--df-add-ink);
}
:deep(.ig-delta-chip.down) {
  background: var(--df-del-bg-strong);
  color: var(--df-del-ink);
}

.ig-mini-tag {
  font-style: normal;
  font-family: var(--fn);
  font-size: 11px;
  font-weight: 700;
  padding: 0 5px;
  border-radius: 4px;
  white-space: nowrap;
}
.ig-mini-tag.is-added {
  background: var(--df-add-bg-strong);
  color: var(--df-add-ink);
}
.ig-mini-tag.is-modified {
  background: var(--df-mod-bg);
  color: var(--df-mod-ink);
}
.ig-mini-tag.is-removed {
  background: var(--df-del-bg-strong);
  color: var(--df-del-ink);
}

/* 1. 五大模块堆叠条 */
.ig-mod-list {
  display: grid;
  gap: 8px;
}

.ig-mod-row {
  display: grid;
  gap: 5px;
  width: 100%;
  padding: 7px 10px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: var(--surface2);
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.14s ease,
    background-color 0.14s ease;
}
.ig-mod-row:hover {
  border-color: var(--accent);
  background: var(--surface);
}

.ig-mod-top {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 13px;
}

.ig-mod-counts {
  display: inline-flex;
  gap: 6px;
  font-family: var(--fn);
  font-size: 12.5px;
  font-weight: 700;
}
.ig-mod-counts em {
  font-style: normal;
}
.c-add {
  color: var(--df-add-ink);
}
.c-mod {
  color: var(--df-mod-ink);
}
.c-del {
  color: var(--df-del-ink);
}

.ig-mod-pct {
  margin-left: auto;
  font-family: var(--fn);
  font-size: 12px;
  color: var(--ink3);
}

.ig-stack-track {
  display: flex;
  height: 10px;
  border-radius: 999px;
  overflow: hidden;
  background: color-mix(in srgb, var(--line) 65%, transparent);
}
.ig-stack-track .seg-add {
  background: var(--green);
}
.ig-stack-track .seg-mod {
  background: var(--accent);
}
.ig-stack-track .seg-del {
  background: var(--red);
}

.ig-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 12px;
  color: var(--ink3);
}
.ig-legend span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.ig-legend .dot {
  width: 9px;
  height: 9px;
  border-radius: 2px;
}
.ig-legend .dot.add {
  background: var(--green);
}
.ig-legend .dot.mod {
  background: var(--accent);
}
.ig-legend .dot.del {
  background: var(--red);
}
.ig-legend .dot.idle {
  background: var(--line2);
}

/* 4. 开局策略生命哑铃图 */
.ig-dumbbell {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.ig-db-axis {
  display: grid;
  grid-template-columns: 104px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  font-family: var(--fn);
  font-size: 11px;
  color: var(--ink3);
  padding-inline: 6px;
}
.ig-db-scale {
  position: relative;
  height: 16px;
}
.ig-db-scale span {
  position: absolute;
  transform: translateX(-50%);
}

.ig-db-row {
  display: grid;
  grid-template-columns: 104px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 4px 6px;
  border-radius: 7px;
  border: 1px solid var(--line);
  background: var(--surface2);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.14s ease;
}
.ig-db-row:hover {
  border-color: var(--accent);
}

.ig-db-who {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.ig-db-who img {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  flex: none;
}
.ig-db-who b {
  font-size: 12.5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ig-db-track {
  position: relative;
  height: 24px;
  border-radius: 4px;
  background: var(--surface);
  border: 1px solid color-mix(in srgb, var(--line) 70%, transparent);
  overflow: hidden;
}
.ig-db-grid {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: color-mix(in srgb, var(--line) 55%, transparent);
}
.ig-db-bar {
  position: absolute;
  top: 50%;
  height: 4px;
  transform: translateY(-50%);
  border-radius: 2px;
}
.ig-db-bar.is-up {
  background: var(--green);
}
.ig-db-bar.is-down {
  background: var(--red);
}

.ig-db-dot {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  font-family: var(--fn);
  font-size: 11px;
  font-weight: 700;
  padding: 0 5px;
  border-radius: 999px;
  line-height: 1.35;
  white-space: nowrap;
  z-index: 1;
}
.ig-db-dot.is-old {
  background: var(--surface2);
  border: 1px solid var(--line2);
  color: var(--ink3);
}
.ig-db-dot.is-up,
.ig-db-dot.is-new {
  background: var(--green);
  color: #fff;
}
.ig-db-dot.is-down,
.ig-db-dot.is-out {
  background: var(--red);
  color: #fff;
}
.ig-db-dot.is-skill {
  background: var(--accent-soft);
  border: 1px solid var(--accent);
  color: var(--accent);
}

/* 2. 盟约轮换图谱与 Chart.js 叠层折线面板（严格防溢出） */
.ig-cov-layout {
  display: grid;
  grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
  gap: 14px;
  align-items: start;
  min-width: 0;
  max-width: 100%;
}

.ig-cov-layout.is-single {
  grid-template-columns: minmax(0, 1fr);
}

@container diff-view (max-width: 820px) {
  .ig-cov-layout {
    grid-template-columns: minmax(0, 1fr);
  }
}

.ig-cov-matrix {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 7px;
  min-width: 0;
  max-height: 364px;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-right: 2px;
}

.ig-cov-node {
  display: flex;
  align-items: stretch;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: var(--surface2);
  min-width: 0;
  overflow: hidden;
  transition:
    border-color 0.14s ease,
    box-shadow 0.14s ease;
}
.ig-cov-node:hover {
  border-color: var(--c, var(--accent));
}
.ig-cov-node.is-selected {
  border-color: var(--c, var(--accent));
  box-shadow: 0 0 0 1.5px
    color-mix(in srgb, var(--c, var(--accent)) 45%, transparent);
  background: var(--surface);
}
.ig-cov-node.is-added {
  border-color: var(--df-add-border);
  background: var(--df-add-bg);
}
.ig-cov-node.is-removed {
  border-color: var(--df-del-border);
  background: var(--df-del-bg);
  opacity: 0.88;
}

.ig-cov-main {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.ig-cov-diff-btn {
  flex: none;
  min-height: 34px;
  padding: 0 8px;
  border: 0;
  border-left: 1px solid color-mix(in srgb, var(--line) 75%, transparent);
  background: transparent;
  color: var(--ink3);
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}
.ig-cov-diff-btn:hover {
  color: var(--accent);
  background: var(--accent-soft);
}

.ig-cov-emblem {
  flex: 0 0 34px;
  width: 34px;
  height: 34px;
  border-radius: 7px;
  padding: 4px;
  display: grid;
  place-items: center;
  background: radial-gradient(
    circle at 50% 35%,
    color-mix(in srgb, var(--c, var(--teal)) 45%, #182628),
    #0d1618
  );
  border: 1px solid color-mix(in srgb, var(--c, var(--teal)) 55%, transparent);
}
.ig-cov-emblem img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.ig-cov-body {
  display: grid;
  gap: 2px;
  min-width: 0;
}
.ig-cov-title {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 13.5px;
  min-width: 0;
}
.ig-cov-title b {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ig-cov-body small {
  font-size: 11.5px;
  color: var(--ink2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 3. Ⅰ–Ⅵ 阶干员柱图 */
.ig-tier-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 8px;
  min-width: 0;
}

@container diff-view (max-width: 780px) {
  .ig-tier-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@container diff-view (max-width: 460px) {
  .ig-tier-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.ig-tier-col {
  padding: 9px 8px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: var(--surface2);
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.ig-tier-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}
.ig-tier-badge {
  font-style: normal;
  font-family: var(--fn);
  font-size: 12px;
  font-weight: 700;
  padding: 0 7px;
  border-radius: 4px;
  background: var(--tc, #666);
  color: #fff;
}

.ig-bars-pair {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 12px;
  height: 112px;
  padding-top: 14px;
  border-bottom: 1px solid var(--line);
}

.ig-vbar-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
}
.ig-vbar-num {
  font-family: var(--fn);
  font-size: 12.5px;
  font-weight: 700;
}
.ig-vbar {
  width: 20px;
  border-radius: 4px 4px 0 0;
}
.ig-vbar.is-old {
  background: color-mix(in srgb, var(--ink3) 45%, var(--line));
}
.ig-vbar.is-new {
  background: var(--tc, var(--teal));
}
.ig-vbar-wrap small {
  font-size: 10.5px;
  color: var(--ink3);
}

.ig-tier-ops {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.ig-op-chip {
  display: flex;
  align-items: center;
  gap: 5px;
  min-height: 34px;
  padding: 2px 6px 2px 3px;
  border-radius: 5px;
  border: 1px solid var(--line);
  background: var(--surface);
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  min-width: 0;
  text-align: left;
}
.ig-op-chip img {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  flex: none;
  object-fit: cover;
}
.ig-op-chip span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ig-op-chip.is-add {
  border-color: var(--df-add-border);
  color: var(--df-add-ink);
}
.ig-op-chip.is-mod {
  border-color: var(--df-mod-border);
  color: var(--df-mod-ink);
}
.ig-op-chip.is-del {
  border-color: var(--df-del-border);
  color: var(--df-del-ink);
  text-decoration: line-through;
}

.ig-tier-quiet {
  font-size: 11.5px;
  color: var(--ink3);
  text-align: center;
  padding-block: 4px;
}

/* 5. 调度中心升本阶梯与合成配方 */
.ig-dispatch-steps {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 6px;
  min-width: 0;
}

@container diff-view (max-width: 440px) {
  .ig-dispatch-steps {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.ig-step-box {
  padding: 7px 5px;
  border-radius: 7px;
  border: 1px solid var(--line);
  background: var(--surface2);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  text-align: center;
  min-width: 0;
}
.ig-step-box.changed {
  border-color: var(--df-add-border);
  background: var(--df-add-bg);
}
.ig-step-lv {
  font-family: var(--fn);
  font-size: 12px;
  font-weight: 700;
  color: var(--ink2);
}
.ig-step-bars {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 40px;
}
.ig-step-bar {
  width: 10px;
  border-radius: 2px 2px 0 0;
}
.ig-step-bar.old {
  background: var(--line2);
}
.ig-step-bar.new {
  background: var(--teal);
}
.ig-step-max {
  height: 40px;
  display: grid;
  place-items: center;
  font-family: var(--fn);
  font-size: 12px;
  color: var(--accent);
  font-weight: 700;
}
.ig-step-cost {
  font-family: var(--fn);
  font-size: 12.5px;
  display: flex;
  gap: 3px;
  align-items: baseline;
}
.ig-step-cost .old {
  text-decoration: line-through;
  color: var(--ink3);
  font-size: 11px;
}
.ig-step-slots {
  font-size: 11px;
  color: var(--ink3);
}
.ig-step-slots b {
  font-weight: 600;
  color: var(--ink2);
}
.ig-step-slots b.hi {
  color: var(--df-add-ink);
  font-weight: 700;
}

.ig-combos {
  display: grid;
  gap: 6px;
  padding-top: 6px;
  border-top: 1px dashed var(--line);
}
.ig-sub-caption {
  font-size: 12px;
  font-weight: 700;
  color: var(--ink3);
}
.ig-combo-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 7px 9px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: var(--surface2);
  cursor: pointer;
  text-align: left;
}
.ig-combo-row:hover {
  border-color: var(--accent);
}
.ig-combo-row.is-added {
  border-color: var(--df-add-border);
  background: var(--df-add-bg);
}
.ig-eq-node {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 7px 2px 3px;
  border-radius: 5px;
  background: var(--surface);
  border: 1px solid var(--line);
  font-size: 12px;
}
.ig-eq-node img {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  background: var(--tc, #555);
  object-fit: contain;
}
.ig-eq-node.is-res {
  border-color: var(--accent);
}
.ig-sign {
  color: var(--accent);
  font-family: var(--fn);
}

/* 6. Boss 血量涨跌双向条形图 */
.ig-boss-list {
  display: grid;
  gap: 8px;
}
.ig-boss-row {
  display: grid;
  gap: 7px;
  padding: 9px 10px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: var(--surface2);
  cursor: pointer;
  text-align: left;
  min-width: 0;
}
.ig-boss-row:hover {
  border-color: var(--accent);
}
.ig-boss-head {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}
.ig-boss-av {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  flex: none;
  background: #160d0d;
  border: 1px solid color-mix(in srgb, var(--red) 50%, transparent);
  object-fit: cover;
}
.ig-boss-meta {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 2px;
}
.ig-boss-title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 13.5px;
}
.ig-boss-meta small {
  font-size: 11.5px;
  color: var(--ink2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ig-hc-pill {
  font-size: 11px;
  font-weight: 700;
  padding: 0 6px;
  border-radius: 999px;
  background: rgba(154, 92, 200, 0.16);
  border: 1px solid rgba(154, 92, 200, 0.45);
  color: #9a5cc8;
}

.ig-diverge-wrap {
  display: grid;
  grid-template-columns: auto minmax(80px, 1fr) auto;
  align-items: center;
  gap: 8px;
}
.ig-div-num {
  font-family: var(--fn);
  font-size: 11.5px;
  color: var(--ink3);
  white-space: nowrap;
}
.ig-diverge-track {
  position: relative;
  height: 10px;
  border-radius: 999px;
  background: var(--surface);
  border: 1px solid var(--line);
  overflow: hidden;
}
.ig-diverge-mid {
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 1.5px;
  background: var(--ink3);
  z-index: 1;
}
.ig-diverge-bar {
  position: absolute;
  top: 1px;
  bottom: 1px;
  border-radius: 999px;
}
.ig-diverge-bar.is-down {
  background: var(--green);
}
.ig-diverge-bar.is-up {
  background: var(--red);
}

.ig-foot-cta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 10px;
  border: 1px dashed color-mix(in srgb, var(--accent) 50%, var(--line2));
  background: color-mix(in srgb, var(--accent) 6%, var(--surface));
  font-size: 13.5px;
  color: var(--ink);
}

/* 矮窗（安卓横屏小窗 max-height: 600px）紧凑适配 */
@media (max-height: 600px) {
  .ig-card {
    padding: 10px 12px;
    gap: 8px;
  }
  .ig-headlines {
    padding: 7px 10px 7px 24px;
    font-size: 12px;
  }
  .ig-kpi {
    padding: 6px 8px;
  }
  .ig-kpi-new {
    font-size: 17px;
  }
  .ig-cov-matrix {
    max-height: 240px;
  }
  .ig-bars-pair {
    height: 88px;
  }
  .ig-op-chip {
    min-height: 34px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ig-mod-row,
  .ig-db-row,
  .ig-cov-node {
    transition: none !important;
  }
}
:global(:root[data-motion='reduce'] .ig-mod-row),
:global(:root[data-motion='reduce'] .ig-db-row),
:global(:root[data-motion='reduce'] .ig-cov-node) {
  transition: none !important;
}
</style>
