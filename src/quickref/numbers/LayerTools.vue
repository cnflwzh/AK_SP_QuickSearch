<script setup lang="ts">
import {computed, nextTick, ref, toRefs, watch} from 'vue';
import {
  ADDON_COVENANTS,
  ALL_COVENANTS,
  BOUNTIES,
  COMMON_LAYER_COVENANTS,
  CORE_COVENANTS,
  COVENANTS,
  CYCLE_REWARDS,
  DECISION_ROUNDS,
  DISPATCH_BY_MODE,
  DISPATCH_MODES,
  HEADCOUNT_BREAKPOINTS,
  LAYER_BREAKPOINTS,
  MODES,
  ROUND_TIME,
  SEASON_META,
  SHOP_MODE_IDS,
  TIER_LABELS,
} from '../../../data/index.ts';
import {synthesisTier} from '../../lib/numbers/numberTools.ts';
import {prefersReducedMotion} from '../../lib/ui/dom.ts';
import {color} from '../format.ts';
import {run, runStats} from '../planStore.ts';
import CovenantIcon from '../components/CovenantIcon.vue';
import SectionHeading from '../components/SectionHeading.vue';
import Segmented from '../components/Segmented.vue';
import SelectInput, {
  type SelectEntry,
  type SelectOption,
} from '../components/SelectInput.vue';
import SubTabs, {
  type SubTabDirection,
  type SubTabItem,
} from '../components/SubTabs.vue';
import LayerCalculator from './LayerCalculator.vue';
import {
  useNumberToolsState,
  type LayerSection,
  type MatchOverviewSection,
  type ShopMode,
} from './useNumberToolsState.ts';

const root = ref<HTMLElement>();
const numberState = useNumberToolsState();
const layerState = numberState.layers;
const {
  viewSection,
  covenant: selected,
  section: selectedSection,
} = toRefs(layerState);
const {level, shopMode} = toRefs(numberState.economy);
const sectionDir = ref<SubTabDirection>('');

const sectionTabs: readonly SubTabItem<MatchOverviewSection>[] = [
  {id: 'all', label: '全部'},
  {id: 'layers', label: '盟约层数'},
  {id: 'dispatch', label: '调度与回合'},
];

watch(
  () => run.value?.key ?? '',
  (key) => {
    if (!key) {
      layerState.lastAutoRunKey = '';
      return;
    }
    if (key === layerState.lastAutoRunKey) return;
    const stats = runStats.value;
    const hasLayerScale = (name: string) =>
      COVENANTS[name]?.scaling.length > 0 ||
      !!LAYER_BREAKPOINTS[name] ||
      !!CYCLE_REWARDS[name];
    const picked =
      stats.find((s) => s.core && s.active && hasLayerScale(s.name)) ??
      stats.find((s) => s.active && hasLayerScale(s.name)) ??
      stats.find((s) => hasLayerScale(s.name));
    if (!picked) return;
    layerState.lastAutoRunKey = key;
    selected.value = picked.name;
    selectedSection.value = LAYER_BREAKPOINTS[picked.name]
      ? 'threshold'
      : CYCLE_REWARDS[picked.name]
        ? 'cycle'
        : HEADCOUNT_BREAKPOINTS.some((h) => h.covenant === picked.name)
          ? 'headcount'
          : 'threshold';
    layerState.count = run.value?.plan.layers[picked.name] ?? 0;
  },
  {immediate: true},
);

const detailOrder = computed(() =>
  selectedSection.value === 'cycle'
    ? 3
    : selectedSection.value === 'headcount'
      ? 5
      : 1,
);
const groups: readonly SelectEntry<string>[] = [
  {
    label: '核心盟约',
    options: CORE_COVENANTS.map((name) => ({value: name, label: name})),
  },
  {
    label: '附加盟约',
    options: ADDON_COVENANTS.map((name) => ({value: name, label: name})),
  },
];
const eliteCov = ALL_COVENANTS.find(
  (name) => COVENANTS[name].mechanics?.countMode === 'fieldElites',
);
const eliteNeed = eliteCov
  ? COVENANTS[eliteCov].mechanics?.bonusNeed
  : undefined;
const headcountSubtitle = [
  '核心 6 名',
  '附加 3 名',
  eliteCov && eliteNeed ? `${eliteCov} ${eliteNeed} 名精锐` : '',
]
  .filter(Boolean)
  .join(' · ');

function isSelected(name: string, section: LayerSection): boolean {
  return selected.value === name && selectedSection.value === section;
}

/** 宽屏只更新常驻右栏；窄屏把同一个结果卡排在当前分组后，必要时滚动到结果。 */
async function select(
  name: string,
  section: LayerSection = 'threshold',
): Promise<void> {
  selected.value = name;
  selectedSection.value = section;
  await nextTick();
  const result = root.value?.querySelector<HTMLElement>('.nt-layer-detail');
  if (!result) return;
  if (getComputedStyle(result).position === 'sticky') return;
  const top = result.getBoundingClientRect().top;
  const visibleTop =
    (document.getElementById('qbar')?.getBoundingClientRect().height ?? 0) + 12;
  if (top < visibleTop || top + 120 > window.innerHeight) {
    window.scrollBy({
      top: top - visibleTop,
      behavior: prefersReducedMotion() ? 'instant' : 'smooth',
    });
  }
}

/* ---------- 调度中心等级 & 回合机变 ---------- */
const shopModeOptions: readonly SelectOption<ShopMode>[] = SHOP_MODE_IDS.map(
  (id, index) => ({value: id, label: DISPATCH_MODES[index]}),
);
const modeIndex = computed(() =>
  Math.max(
    0,
    SHOP_MODE_IDS.findIndex((mode) => mode === shopMode.value),
  ),
);
const levels = computed(() => DISPATCH_BY_MODE[modeIndex.value]);

const tierPriceGroups = computed(() => {
  const prices = SEASON_META.tierBasePrices;
  const result: {price: number; label: string}[] = [];
  for (let t = 1; t < prices.length; t += 1) {
    const p = prices[t];
    const last = result.at(-1);
    if (last && last.price === p) {
      const start = last.label.split('–')[0].replace(/阶$/, '');
      last.label = `${start}–${TIER_LABELS[t]}阶`;
    } else {
      result.push({price: p, label: `${TIER_LABELS[t]}阶`});
    }
  }
  return result;
});

const decisions = computed(
  () => DECISION_ROUNDS[MODES[numberState.roundDifficulty]],
);
</script>

<template>
  <div ref="root" class="nt-layers">
    <div class="bar nt-toolbar">
      <SubTabs
        v-model="viewSection"
        :items="sectionTabs"
        :level="3"
        inline
        aria-label="对局速查分区"
        attr="match-section"
        @change="(_, dir) => (sectionDir = dir)" />
      <SelectInput
        v-if="viewSection !== 'dispatch'"
        :model-value="selected"
        :options="groups"
        aria-label="选择盟约计算"
        @update:model-value="select" />
    </div>

    <div
      :key="viewSection"
      :class="['nt-match-body', {'subtab-panel': !!sectionDir}]"
      :data-dir="sectionDir || undefined">
      <!-- 分区一：盟约层数与强化 -->
      <div v-if="viewSection !== 'dispatch'" class="nt-layer-layout">
        <section class="nc nt-threshold-list" aria-label="层数门槛速查">
          <div class="nt-threshold-heading">
            <span>盟约</span>
            <span>层数</span>
            <span>关键变化</span>
          </div>
          <button
            v-for="name in COMMON_LAYER_COVENANTS"
            :key="name"
            type="button"
            class="nt-threshold-row"
            :class="{selected: isSelected(name, 'threshold')}"
            :style="{'--c': color(name)}"
            :aria-pressed="isSelected(name, 'threshold')"
            aria-controls="numbers-layer-calculator"
            @click="select(name)">
            <span class="nt-covenant-name">
              <b>
                <CovenantIcon :name="name" />
                {{ name }}
              </b>
              <small>{{ COVENANTS[name].need }} 名</small>
            </span>
            <span class="nt-threshold-number">
              {{
                LAYER_BREAKPOINTS[name].map((point) => point.layers).join(' / ')
              }}
            </span>
            <span class="nt-threshold-effect">
              {{
                LAYER_BREAKPOINTS[name].map((point) => point.effect).join('；')
              }}
              <i>›</i>
            </span>
          </button>
        </section>

        <section class="nc nt-cycle-list" aria-label="循环奖励">
          <h4 aria-level="3">循环奖励</h4>
          <button
            v-for="(cycle, name) in CYCLE_REWARDS"
            :key="name"
            type="button"
            class="nt-reference-row"
            :class="{selected: isSelected(name, 'cycle')}"
            :aria-pressed="isSelected(name, 'cycle')"
            aria-controls="numbers-layer-calculator"
            @click="select(name, 'cycle')">
            <b :style="{color: color(name)}">
              <CovenantIcon :name="name" />
              {{ name }}
            </b>
            <span class="tag">每 {{ cycle.every }} 层</span>
            <span>{{ cycle.reward }}</span>
            <i>›</i>
          </button>
        </section>

        <section class="nc nt-headcount-list" aria-label="人数强化">
          <header class="nt-heading">
            <h4 aria-level="3">人数强化</h4>
            <small class="nt-muted">{{ headcountSubtitle }}</small>
          </header>
          <p class="nt-muted">核心盟约：6 名不同干员触发强化</p>
          <button
            v-for="item in HEADCOUNT_BREAKPOINTS"
            :key="item.covenant"
            type="button"
            class="nt-reference-row"
            :class="{selected: isSelected(item.covenant, 'headcount')}"
            :aria-pressed="isSelected(item.covenant, 'headcount')"
            aria-controls="numbers-layer-calculator"
            @click="select(item.covenant, 'headcount')">
            <b :style="{color: color(item.covenant)}">
              <CovenantIcon :name="item.covenant" />
              {{ item.covenant }}
            </b>
            <span class="tag">{{ item.condition }}</span>
            <span>{{ item.effect }}</span>
            <i>›</i>
          </button>
        </section>

        <div
          id="numbers-layer-calculator"
          class="nt-layer-detail"
          :style="{'--detail-order': detailOrder}">
          <LayerCalculator v-model:layers="layerState.count" :name="selected" />
        </div>
      </div>

      <!-- 分区二：调度中心等级 + 回合与机变（并排高密度呈现） -->
      <div v-if="viewSection !== 'layers'" class="nt-match-grid">
        <section class="nc nt-match-dispatch" aria-label="调度中心等级速查">
          <SectionHeading
            title="调度中心等级"
            desc="升级初始价每回合 −1，点选等级列高亮"
            :level="3">
            <template #extra>
              <SelectInput
                v-model="shopMode"
                :options="shopModeOptions"
                compact
                aria-label="调度模式" />
            </template>
          </SectionHeading>

          <div class="nt-table-scroll">
            <table class="nt-dispatch-table">
              <thead>
                <tr>
                  <th scope="col">调度中心</th>
                  <th
                    v-for="row in levels"
                    :key="row.level"
                    scope="col"
                    :class="{current: level === row.level}">
                    <button
                      type="button"
                      class="btn"
                      :class="{p: level === row.level}"
                      :aria-pressed="level === row.level"
                      :aria-label="`高亮 ${row.level} 级`"
                      @click="level = row.level">
                      {{ row.level }}
                      <small>级</small>
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">升级初始价</th>
                  <td
                    v-for="row in levels"
                    :key="row.level"
                    :class="{current: level === row.level}"
                    :aria-label="
                      row.upgradeCost === null ? '已满级' : undefined
                    ">
                    {{ row.upgradeCost ?? '—' }}
                  </td>
                </tr>
                <tr>
                  <th scope="row">干员栏位</th>
                  <td
                    v-for="row in levels"
                    :key="row.level"
                    :class="{current: level === row.level}">
                    {{ row.operatorSlots }}
                  </td>
                </tr>
                <tr>
                  <th scope="row">刷新最高阶</th>
                  <td
                    v-for="row in levels"
                    :key="row.level"
                    :class="{current: level === row.level}">
                    <span class="tier" :data-t="row.level">
                      {{ TIER_LABELS[row.level] }}
                    </span>
                  </td>
                </tr>
                <tr>
                  <th scope="row">合成奖励阶</th>
                  <td
                    v-for="row in levels"
                    :key="row.level"
                    :class="{current: level === row.level}">
                    <span class="tier" :data-t="synthesisTier(row.level)">
                      {{ TIER_LABELS[synthesisTier(row.level)] }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="nt-match-rules">
            <div class="nt-match-prices">
              <small>招募价</small>
              <span v-for="group in tierPriceGroups" :key="group.label">
                <b>{{ group.label }}</b>
                {{ group.price }}资
              </span>
            </div>
            <p class="nt-match-note">
              基础出售
              <b>+1 资</b>
              ；3 张同名合成精锐，附赠
              <b>当前等级 +1 阶</b>
              三选一（最高 Ⅵ 阶）。
            </p>
          </div>
        </section>

        <section class="nc nt-match-rounds" aria-label="回合与机变节点">
          <SectionHeading
            title="回合与机变"
            desc="联合模拟 · 橙色回合结束后进入机变"
            :level="3">
            <template #extra>
              <Segmented
                :labels="MODES"
                :active="numberState.roundDifficulty"
                attr="number-difficulty"
                aria-label="回合难度"
                @change="numberState.roundDifficulty = $event" />
            </template>
          </SectionHeading>

          <div class="nt-match-round-grid">
            <div
              v-for="(seconds, index) in ROUND_TIME"
              :key="index"
              :class="[
                'nt-round-cell',
                {
                  decision: decisions.includes(index + 1),
                  leader: index === ROUND_TIME.length - 1,
                },
              ]">
              <small>
                {{ index === ROUND_TIME.length - 1 ? 'Boss' : `R${index + 1}` }}
              </small>
              <b>
                {{ seconds }}
                <small>s</small>
              </b>
              <span>{{ decisions.includes(index + 1) ? '◆ 机变' : '' }}</span>
            </div>
          </div>

          <div class="nt-match-foot">
            <span>
              极速模拟第 9 回合 Boss · 悬赏收益（{{ BOUNTIES.length }}
              名）已移至敌人页
            </span>
            <RouterLink to="/leaders?kind=bounty" class="nt-match-link">
              悬赏敌人 ›
            </RouterLink>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.nt-match-body {
  display: grid;
  gap: 12px;
}
.nt-match-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.95fr);
  gap: 12px;
  align-items: stretch;
}
.nt-match-dispatch,
.nt-match-rounds {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}
.nt-match-rules {
  margin-top: auto;
  display: grid;
  gap: 6px;
  padding-top: 8px;
  border-top: 1px dashed var(--line);
}
.nt-match-prices {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
}
.nt-match-prices small {
  font-size: 11px;
  font-weight: 700;
  color: var(--ink3);
  margin-right: 2px;
}
.nt-match-prices span {
  display: inline-flex;
  align-items: baseline;
  gap: 3px;
  padding: 1px 7px;
  border-radius: 5px;
  background: var(--surface2);
  border: 1px solid var(--line);
  font-family: var(--fn);
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
}
.nt-match-prices b {
  color: var(--ink);
  font-weight: 600;
}
.nt-match-note {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--ink2);
}
.nt-match-note b {
  color: var(--ink);
  font-family: var(--fn);
}

.nt-match-round-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 5px;
}
.nt-round-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 6px 2px 5px;
  border-radius: 6px;
  border: 1px solid var(--line);
  background: var(--surface2);
  color: var(--ink2);
  min-width: 0;
}
.nt-round-cell.decision {
  border-color: color-mix(in srgb, var(--accent) 48%, var(--line));
  background: var(--accent-soft);
  color: var(--accent);
}
.nt-round-cell.leader {
  border-color: color-mix(in srgb, var(--red) 45%, var(--line));
  background: color-mix(in srgb, var(--red) 9%, var(--surface2));
  color: var(--red);
}
.nt-round-cell > small {
  font-family: var(--fn);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.1;
}
.nt-round-cell b {
  font-family: var(--fn);
  font-size: 18px;
  line-height: 1.1;
  color: var(--ink);
}
.nt-round-cell.decision b {
  color: var(--accent);
}
.nt-round-cell.leader b {
  color: var(--red);
}
.nt-round-cell b small {
  font-size: 10.5px;
  font-weight: 500;
  color: var(--ink3);
}
.nt-round-cell span {
  min-height: 14px;
  font-size: 10px;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
}

.nt-match-foot {
  margin-top: auto;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 6px 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--line);
  font-size: 12px;
  color: var(--ink3);
}
.nt-match-link {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 1px 10px;
  border-radius: 6px;
  border: 1px solid color-mix(in srgb, var(--teal) 45%, var(--line2));
  background: color-mix(in srgb, var(--teal) 7%, var(--surface));
  color: var(--teal);
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
  transition:
    border-color 0.14s ease,
    color 0.14s ease;
}
.nt-match-link:hover {
  border-color: var(--accent);
  color: var(--accent);
}

@container number-tools (max-width: 920px) {
  .nt-match-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
@container number-tools (max-width: 520px) {
  .nt-match-round-grid {
    gap: 4px;
  }
  .nt-round-cell {
    padding: 5px 1px 4px;
  }
  .nt-round-cell b {
    font-size: 16px;
  }
  .nt-match-link {
    min-height: 34px;
  }
}
@media (max-height: 600px) {
  .nt-match-body {
    gap: 8px;
  }
  .nt-match-grid {
    gap: 8px;
  }
  .nt-match-dispatch,
  .nt-match-rounds {
    gap: 7px;
  }
  .nt-round-cell {
    padding: 4px 2px;
  }
  .nt-match-link {
    min-height: 34px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .nt-match-link {
    transition: none;
  }
}
:global(:root[data-motion='reduce'] .nt-match-link) {
  transition: none !important;
}
</style>
