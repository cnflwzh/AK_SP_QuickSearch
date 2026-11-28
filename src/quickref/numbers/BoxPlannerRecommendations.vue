<script setup lang="ts">
import {computed, nextTick, ref, shallowRef, watch} from 'vue';
import {BORROW_LIMIT, TIER_LABELS} from '../../../data/index.ts';
import {
  recommendBorrowBatch,
  recommendTraining,
} from '../../lib/box/insights.ts';
import {BOX_RANK_BORROWED} from '../../lib/box/model.ts';
import {
  boxSeasonBorrowedCount,
  operatorBox,
  setOperatorRank,
  setOperatorRanks,
} from '../../lib/box/store.ts';
import {avatarSrc} from '../../lib/ui/assets.ts';
import {presetFormation, presets} from '../planStore.ts';
import {useQuickrefActions} from '../state.ts';
import {effectivePlanIcon} from '../../lib/plans/model.ts';
import PlanEmblem from '../components/PlanEmblem.vue';
import EmptyState from '../components/EmptyState.vue';
import StatusNotice from '../components/StatusNotice.vue';
import SubTabs, {
  subTabPanelAttrs,
  type SubTabDirection,
  type SubTabItem,
} from '../components/SubTabs.vue';

type PlannerTab = 'borrow' | 'train';

const actions = useQuickrefActions();
const props = defineProps<{expanded: boolean}>();
const activeTab = ref<PlannerTab>('borrow');
const tabDir = ref<SubTabDirection>('');
const selectedBuilds = ref<string[]>([]);
const showAllBorrow = ref(false);
const showAllTrain = ref(false);
const feedback = ref('');
const errorMsg = ref('');

const planSources = computed(() =>
  presets.value
    .map((item) => ({
      key: item.key,
      name: item.plan.name,
      icon: effectivePlanIcon(item.plan),
      builtin: item.builtin,
      ops: presetFormation(item).ops,
    }))
    .filter((item) => item.ops.length > 0),
);

const selectedBuildSet = computed(() => new Set(selectedBuilds.value));

const borrowPlan = computed(() =>
  recommendBorrowBatch(
    operatorBox,
    planSources.value,
    selectedBuildSet.value.size ? selectedBuildSet.value : undefined,
  ),
);

// 进入清单或更换流派时按最新收益排一次；借用只更新卡片数据，保留玩家正在看的位置。
const borrowPositions = shallowRef(new Map<string, number>());
watch(
  [() => props.expanded, activeTab, selectedBuilds, planSources],
  ([expanded, tab]) => {
    if (expanded && tab === 'borrow') {
      borrowPositions.value = new Map(
        borrowPlan.value.ranking.map(({op}, index) => [op.avatar, index]),
      );
    }
  },
  {immediate: true},
);

const borrowList = computed(() => {
  const positions = borrowPositions.value;
  return [...borrowPlan.value.ranking].sort(
    (a, b) =>
      (positions.get(a.op.avatar) ?? positions.size) -
      (positions.get(b.op.avatar) ?? positions.size),
  );
});

const unborrowedCount = computed(
  () => borrowList.value.filter((item) => !item.borrowed).length,
);

const remainingSlots = computed(() =>
  Math.max(0, BORROW_LIMIT - boxSeasonBorrowedCount.value),
);

const visibleBorrows = computed(() =>
  showAllBorrow.value ? borrowList.value : borrowList.value.slice(0, 12),
);

const trainList = computed(() =>
  recommendTraining(
    operatorBox,
    planSources.value,
    selectedBuildSet.value.size ? selectedBuildSet.value : undefined,
  ),
);

const visibleTrains = computed(() =>
  showAllTrain.value ? trainList.value : trainList.value.slice(0, 12),
);

const tabs = computed<readonly SubTabItem<PlannerTab>[]>(() => [
  {id: 'borrow', label: '助战推荐', count: unborrowedCount.value},
  {id: 'train', label: '精 0 待练建议', count: trainList.value.length},
]);

function toggleBuildFilter(key: string): void {
  const idx = selectedBuilds.value.indexOf(key);
  if (idx >= 0)
    selectedBuilds.value = selectedBuilds.value.filter((k) => k !== key);
  else selectedBuilds.value = [...selectedBuilds.value, key];
}

async function toggleBorrow(
  name: string,
  currentlyBorrowed: boolean,
  event: MouseEvent,
): Promise<void> {
  const button = event.currentTarget as HTMLButtonElement;
  const previousTop = button.getBoundingClientRect().top;
  feedback.value = '';
  errorMsg.value = '';
  try {
    setOperatorRank(name, currentlyBorrowed ? -1 : BOX_RANK_BORROWED);
    // 其他行的实时推荐理由可能换行；等布局稳定后保持当前按钮在视口内的原位置。
    await nextTick();
    if (button.isConnected) {
      const offset = button.getBoundingClientRect().top - previousTop;
      if (Math.abs(offset) >= 1)
        window.scrollBy({top: offset, behavior: 'instant'});
    }
  } catch (error) {
    errorMsg.value = error instanceof Error ? error.message : '助战名额已满。';
  }
}

function fillRecommendedBorrows(): void {
  feedback.value = '';
  errorMsg.value = '';
  const slots = remainingSlots.value;
  if (!slots) {
    errorMsg.value = `已借满 ${BORROW_LIMIT}/${BORROW_LIMIT} 名助战。`;
    return;
  }
  const {picks, completedLineups, completedCores} = borrowPlan.value;
  if (!picks.length) return;
  try {
    const changed = setOperatorRanks(picks, BOX_RANK_BORROWED);
    if (changed > 0) {
      const gains: string[] = [];
      if (completedLineups) gains.push(`${completedLineups} 套主选`);
      if (completedCores) gains.push(`${completedCores} 套核心`);
      const result = gains.length ? `，补齐${gains.join('、')}` : '';
      feedback.value = `已加入 ${changed} 名助战${result}（当前 ${boxSeasonBorrowedCount.value}/${BORROW_LIMIT}）。`;
    }
  } catch (error) {
    errorMsg.value = error instanceof Error ? error.message : '助战名额不足。';
  }
}

function markTrainedE1(name: string): void {
  feedback.value = '';
  errorMsg.value = '';
  if (setOperatorRank(name, 1)) {
    feedback.value = `已将「${name}」标为精英一（激活攻+5% 防+5%）。`;
  }
}
</script>

<template>
  <div v-if="expanded" class="bxp-body panel-reveal">
    <div class="bxp-head">
      <SubTabs
        v-model="activeTab"
        :items="tabs"
        :level="3"
        inline
        aria-label="备战规划视角"
        panel-id="box-planner-panel"
        attr="bxp-tab"
        @change="(_, dir) => (tabDir = dir)" />
      <div
        v-if="activeTab === 'borrow' && borrowList.length"
        class="bxp-head-act">
        <button
          type="button"
          class="btn p"
          :disabled="!remainingSlots || !borrowPlan.picks.length"
          @click="fillRecommendedBorrows">
          {{
            !remainingSlots
              ? `已满 ${BORROW_LIMIT}/${BORROW_LIMIT}`
              : borrowPlan.picks.length
                ? `一键借用 ${borrowPlan.picks.length} 名助战`
                : '已全部借用'
          }}
        </button>
      </div>
    </div>

    <div class="bxp-builds" role="group" aria-label="按常玩流派聚焦推荐">
      <span class="bxp-builds-k">聚焦流派</span>
      <button
        type="button"
        :class="['bxp-bchip', {on: !selectedBuilds.length}]"
        :aria-pressed="!selectedBuilds.length"
        @click="selectedBuilds = []">
        全部流派
      </button>
      <button
        v-for="source in planSources"
        :key="source.key"
        type="button"
        :class="['bxp-bchip', {on: selectedBuildSet.has(source.key)}]"
        :aria-pressed="selectedBuildSet.has(source.key)"
        @click="toggleBuildFilter(source.key)">
        <PlanEmblem v-if="source.icon" :icon="source.icon" />
        {{ source.name }}
      </button>
    </div>

    <StatusNotice
      v-if="feedback"
      tone="success"
      :message="feedback"
      dismissible
      @dismiss="feedback = ''" />
    <StatusNotice
      v-if="errorMsg"
      tone="danger"
      :message="errorMsg"
      dismissible
      @dismiss="errorMsg = ''" />

    <div
      :key="activeTab"
      v-bind="subTabPanelAttrs('box-planner-panel', activeTab)"
      :class="{'subtab-panel': !!tabDir}"
      :data-dir="tabDir || undefined">
      <template v-if="activeTab === 'borrow'">
        <p class="bxp-hint">
          展开清单或切换流派时，按单人借用收益排序。一键借用会尽量用较少名额补齐流派核心或全部主选。
        </p>
        <div v-if="visibleBorrows.length" class="bxp-grid">
          <article
            v-for="(item, index) in visibleBorrows"
            :key="item.op.avatar"
            :class="['bxp-card', {borrowed: item.borrowed}]"
            :data-t="item.op.tier">
            <button
              type="button"
              class="bxp-op"
              @click="actions.openDetail('op', item.op.name)">
              <span class="bxp-rank">{{ index + 1 }}</span>
              <img
                :src="avatarSrc(item.op.name)"
                alt=""
                width="38"
                height="38"
                loading="lazy"
                decoding="async" />
              <span class="bxp-info">
                <span class="bxp-name">
                  <i class="tn">{{ TIER_LABELS[item.op.tier] }}</i>
                  <b>{{ item.op.name }}</b>
                </span>
                <span class="bxp-reasons">
                  <em
                    v-if="borrowPlan.picks.includes(item.op.name)"
                    class="core">
                    一键入选
                  </em>
                  <em
                    v-for="reason in item.reasons"
                    :key="reason"
                    :class="{
                      core: reason.startsWith('核心'),
                      warn: reason.startsWith('替补仅4★'),
                    }">
                    {{ reason }}
                  </em>
                </span>
              </span>
            </button>
            <button
              type="button"
              :class="['bxp-act', {on: item.borrowed}]"
              :aria-pressed="item.borrowed"
              :disabled="!item.borrowed && !remainingSlots"
              @click="toggleBorrow(item.op.name, item.borrowed, $event)">
              {{ item.borrowed ? '✓ 已借用' : '＋ 借用' }}
            </button>
          </article>
        </div>
        <EmptyState
          v-else
          compact
          :message="
            selectedBuilds.length
              ? '所选流派没有需要补位的可借六星干员。'
              : '本赛季可借用的六星干员均已持有。'
          " />
        <div v-if="borrowList.length > 12" class="bxp-more">
          <button
            type="button"
            class="btn"
            @click="showAllBorrow = !showAllBorrow">
            {{
              showAllBorrow
                ? '收起清单'
                : `查看全部 ${borrowList.length} 名助战候选`
            }}
          </button>
        </div>
      </template>

      <template v-else>
        <p class="bxp-hint">
          这些干员已持有，练到精一后，该干员在模拟作战中的攻击力和防御力各提高
          5%。主选已齐的流派会提高对应干员的养成优先级。
        </p>
        <div v-if="visibleTrains.length" class="bxp-grid">
          <article
            v-for="(item, index) in visibleTrains"
            :key="item.op.avatar"
            class="bxp-card"
            :data-t="item.op.tier">
            <button
              type="button"
              class="bxp-op"
              @click="actions.openDetail('op', item.op.name)">
              <span class="bxp-rank">{{ index + 1 }}</span>
              <img
                :src="avatarSrc(item.op.name)"
                alt=""
                width="38"
                height="38"
                loading="lazy"
                decoding="async" />
              <span class="bxp-info">
                <span class="bxp-name">
                  <i class="tn">{{ TIER_LABELS[item.op.tier] }}</i>
                  <b>{{ item.op.name }}</b>
                  <small>{{ item.op.stars }}★</small>
                </span>
                <span class="bxp-reasons">
                  <em
                    v-for="reason in item.reasons"
                    :key="reason"
                    :class="{
                      core: reason.startsWith('核心'),
                      low: reason.includes('低成本'),
                    }">
                    {{ reason }}
                  </em>
                </span>
              </span>
            </button>
            <button
              type="button"
              class="bxp-act train"
              title="已在游戏内拉到精一后点此更新记录"
              @click="markTrainedE1(item.op.name)">
              标为精一
            </button>
          </article>
        </div>
        <EmptyState
          v-else
          compact
          message="所选流派里没有已持有但未练（精 0）的干员。" />
        <div v-if="trainList.length > 12" class="bxp-more">
          <button
            type="button"
            class="btn"
            @click="showAllTrain = !showAllTrain">
            {{
              showAllTrain
                ? '收起清单'
                : `查看全部 ${trainList.length} 名精 0 待练干员`
            }}
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.bxp-body {
  display: grid;
  gap: 10px;
  padding: 10px 14px 14px;
  border-top: 1px solid var(--line);
}
.bxp-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.bxp-builds {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
}
.bxp-builds-k {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--ink3);
  margin-right: 2px;
}
.bxp-bchip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 34px;
  padding: 2px 8px;
  border: 1px solid var(--line2);
  border-radius: 999px;
  background: var(--surface2);
  color: var(--ink2);
  font: inherit;
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
}
.bxp-bchip .plan-emblem {
  --emblem-size: 18px;
}
.bxp-bchip.on {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent);
}
.bxp-hint {
  margin: 0 0 8px;
  font-size: 12px;
  color: var(--ink3);
  line-height: 1.45;
}
.bxp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 275px), 1fr));
  gap: 8px;
}
.bxp-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 7px 9px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--surface2);
}
.bxp-card.borrowed {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--line));
  background: color-mix(in srgb, var(--accent) 6%, var(--surface2));
}
.bxp-op {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.bxp-rank {
  width: 18px;
  flex: none;
  font-family: var(--fn);
  font-size: 11.5px;
  font-weight: 700;
  color: var(--ink3);
  text-align: center;
}
.bxp-op img {
  flex: none;
  border-radius: 6px;
  border: 1.5px solid var(--tc, var(--line2));
  background: var(--surface);
  object-fit: cover;
}
.bxp-info {
  display: grid;
  gap: 3px;
  min-width: 0;
}
.bxp-name {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  min-width: 0;
}
.bxp-name .tn {
  font-style: normal;
  font-family: var(--fn);
  font-size: 11px;
  font-weight: 700;
  color: var(--ink3);
}
.bxp-name b {
  font-size: 13px;
  color: var(--ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bxp-name small {
  font-size: 11px;
  color: var(--ink3);
}
.bxp-reasons {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.bxp-reasons em {
  font-style: normal;
  font-size: 10.5px;
  line-height: 1.35;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--surface);
  border: 1px solid var(--line);
  color: var(--ink2);
}
.bxp-reasons em.core {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--line));
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 700;
}
.bxp-reasons em.warn {
  border-color: color-mix(in srgb, var(--red) 40%, var(--line));
  color: var(--red);
}
.bxp-reasons em.low {
  border-color: color-mix(in srgb, var(--teal) 40%, var(--line));
  background: var(--teal-soft);
  color: var(--teal);
  font-weight: 600;
}
.bxp-act {
  min-height: 34px;
  padding: 0 10px;
  border: 1px solid var(--line2);
  border-radius: 7px;
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}
.bxp-act[aria-pressed] {
  min-inline-size: calc(4em + 22px);
}
.bxp-act:enabled:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.bxp-act.on {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--accent-ink);
}
.bxp-act.train:hover {
  border-color: var(--teal);
  color: var(--teal);
}
.bxp-more {
  display: flex;
  justify-content: center;
  margin-top: 8px;
}
@media (max-height: 600px) {
  .bxp-body {
    padding: 8px 11px 11px;
    gap: 8px;
  }
}
</style>
