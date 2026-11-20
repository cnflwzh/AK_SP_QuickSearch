<script setup lang="ts">
import {computed} from 'vue';
import {
  CREDIT_CAPS,
  CREDIT_MILESTONES,
  DIFFICULTIES,
  MODES,
  QUICK_CREDIT_MODE,
  SOLO_LEVELS,
} from '../../../data/index.ts';
import type {CreditMilestone, CreditTargetKind} from '../../../data/types.ts';
import {
  calculateCreditPlan,
  compareJointDifficulties,
  compareSoloLevels,
  creditRoundLimit,
  type CreditMode,
} from '../../lib/numbers/numberTools.ts';
import Segmented from '../components/Segmented.vue';
import SelectInput, {type SelectOption} from '../components/SelectInput.vue';
import SubTabs, {type SubTabItem} from '../components/SubTabs.vue';
import NumberInput from './NumberInput.vue';
import {useNumberToolsState} from './useNumberToolsState.ts';

const creditState = useNumberToolsState().credit;
const jointDifficulties = DIFFICULTIES.filter((d) => d.efficiency > 0);
const MODE_TABS: readonly SubTabItem<CreditMode>[] = [
  {id: 'joint', label: '联合模拟'},
  {id: 'solo', label: '个人规程'},
  {id: 'quick', label: '极速模拟'},
];
const selectedMode = computed<CreditMode>({
  get: () => creditState.mode,
  set: (mode) => setMode(mode),
});
const targetKinds: Record<CreditTargetKind, string> = {
  battle: '作战累计获取',
  total: '作战与关键目标累计获取',
  spend: '限时兑换累计消费',
};
const soloLevelOptions: readonly SelectOption<number>[] = SOLO_LEVELS.map(
  (item) => ({
    value: item.level,
    label: `规程 ${item.level} · ${item.efficiency}%（强度 +${item.strength}${
      item.note ? ' · ' + item.note : ''
    }）`,
  }),
);
const targetKindOptions: readonly SelectOption<CreditTargetKind>[] = (
  Object.entries(targetKinds) as [CreditTargetKind, string][]
).map(([value, label]) => ({value, label}));
const finalRound = computed(() => creditRoundLimit(creditState.mode));
const presets = computed(() => [
  ...[8, 10, 12]
    .filter((n) => n < finalRound.value)
    .map((rounds) => ({label: `R${rounds}`, rounds, leader: false})),
  {label: `通过 R${finalRound.value}`, rounds: finalRound.value, leader: false},
  {label: '击败领袖', rounds: finalRound.value, leader: true},
]);

const difficulty = computed(() => {
  if (creditState.mode === 'quick')
    return {efficiency: QUICK_CREDIT_MODE.efficiency, strength: null};
  if (creditState.mode === 'joint')
    return jointDifficulties[creditState.jointDifficulty];
  return SOLO_LEVELS[creditState.soloLevel - 1];
});
const plan = computed(() =>
  calculateCreditPlan({
    ...creditState,
    efficiency: difficulty.value.efficiency,
  }),
);
const pct = computed(() =>
  creditState.targetCredit > 0
    ? Math.min(
        100,
        Math.floor((100 * plan.value.progress) / creditState.targetCredit),
      )
    : 100,
);
const comparisonRows = computed(() =>
  creditState.mode === 'joint'
    ? compareJointDifficulties({
        ...creditState,
        activeIndex: creditState.jointDifficulty,
      })
    : compareSoloLevels({...creditState, activeLevel: creditState.soloLevel}),
);
const combatTimeLabel = computed(() => {
  const mins = Math.floor(plan.value.maxCombatSeconds / 60);
  const secs = plan.value.maxCombatSeconds % 60;
  return secs ? `${mins} 分 ${secs} 秒` : `${mins} 分钟`;
});
function setMode(mode: CreditMode): void {
  const wasFinal = creditState.roundsCleared === finalRound.value;
  creditState.mode = mode;
  creditState.roundsCleared = wasFinal
    ? finalRound.value
    : Math.min(creditState.roundsCleared, finalRound.value);
  if (creditState.roundsCleared < finalRound.value)
    creditState.defeatedLeader = false;
}
function setProgress(rounds: number, leader: boolean): void {
  creditState.roundsCleared = rounds;
  creditState.defeatedLeader = rounds === finalRound.value && leader;
}
function selectComparisonRow(id: string): void {
  const [mode, raw] = id.split(':');
  if (mode === 'joint') creditState.jointDifficulty = Number(raw);
  if (mode === 'solo') creditState.soloLevel = Number(raw);
  if (mode === 'joint' || mode === 'solo' || mode === 'quick') setMode(mode);
}
function selectTarget(target: CreditMilestone): void {
  creditState.targetKind = target.kind;
  creditState.targetCredit = target.value;
}
</script>

<template>
  <div class="nt-credit">
    <div class="bar nt-toolbar">
      <h4 class="nt-section-title" aria-level="2">认证效率</h4>
      <SubTabs
        v-model="selectedMode"
        :items="MODE_TABS"
        :level="3"
        inline
        aria-label="模拟模式"
        attr="credit-mode" />
    </div>
    <section class="nc nt-credit-grid" aria-label="认证收益计算">
      <div class="nt-credit-inputs">
        <div class="nt-credit-field">
          <div class="nt-heading">
            <h4 aria-level="3">模拟设置</h4>
            <span class="nt-muted">
              效率 {{ difficulty.efficiency }}%
              <template v-if="difficulty.strength !== null">
                · 强度 +{{ difficulty.strength }}
              </template>
            </span>
          </div>
          <Segmented
            v-if="creditState.mode === 'joint'"
            class="panel-reveal"
            :labels="MODES"
            :active="creditState.jointDifficulty"
            attr="credit-diff"
            @change="creditState.jointDifficulty = $event" />
          <SelectInput
            v-if="creditState.mode === 'solo'"
            v-model="creditState.soloLevel"
            :options="soloLevelOptions"
            class="panel-reveal"
            aria-label="个人规程等级" />
        </div>
        <div class="nt-credit-field">
          <div class="nt-heading">
            <h4 aria-level="3">
              预计通过回合
              <small>{{ creditState.roundsCleared }} / {{ finalRound }}</small>
            </h4>
            <label
              v-if="creditState.roundsCleared === finalRound"
              class="nt-credit-check">
              <input v-model="creditState.defeatedLeader" type="checkbox" />
              <span>击败最终领袖</span>
            </label>
          </div>
          <div
            class="nt-credit-presets"
            role="group"
            aria-label="通过回合快捷项">
            <button
              v-for="preset in presets"
              :key="preset.label"
              type="button"
              class="btn"
              :class="{
                p:
                  creditState.roundsCleared === preset.rounds &&
                  creditState.defeatedLeader === preset.leader,
              }"
              :aria-pressed="
                creditState.roundsCleared === preset.rounds &&
                creditState.defeatedLeader === preset.leader
              "
              @click="setProgress(preset.rounds, preset.leader)">
              {{ preset.label }}
            </button>
          </div>
          <div class="nt-credit-slider">
            <span>R0</span>
            <input
              type="range"
              min="0"
              :max="finalRound"
              :value="creditState.roundsCleared"
              aria-label="预计通过回合数"
              @input="
                setProgress(
                  Number(($event.target as HTMLInputElement).value),
                  creditState.defeatedLeader,
                )
              " />
            <span>R{{ finalRound }}</span>
          </div>
        </div>
        <div class="nt-credit-numbers">
          <label>
            作战累计已获（上限 {{ CREDIT_CAPS.battle }}）
            <NumberInput
              :value="creditState.battleEarned"
              label="作战累计已获"
              :max="CREDIT_CAPS.battle"
              @change="creditState.battleEarned = $event ?? 0" />
          </label>
          <label>
            关键目标累计已获（上限 {{ CREDIT_CAPS.objectives }}）
            <NumberInput
              :value="creditState.objectiveEarned"
              label="关键目标累计已获"
              :max="CREDIT_CAPS.objectives"
              @change="creditState.objectiveEarned = $event ?? 0" />
          </label>
          <label>
            目标类型
            <SelectInput
              v-model="creditState.targetKind"
              :options="targetKindOptions"
              aria-label="目标类型" />
          </label>
          <label>
            目标认证点数
            <NumberInput
              :value="creditState.targetCredit"
              label="目标认证点数"
              :max="99999"
              @change="creditState.targetCredit = $event ?? 0" />
          </label>
          <template v-if="creditState.targetKind === 'spend'">
            <label class="panel-reveal">
              限时兑换累计已消费
              <NumberInput
                :value="creditState.limitedSpend"
                label="限时兑换累计已消费"
                :max="CREDIT_CAPS.limitedSpend"
                @change="creditState.limitedSpend = $event ?? 0" />
            </label>
            <label class="panel-reveal">
              当前可用认证余额
              <NumberInput
                :value="creditState.balance"
                label="当前可用认证余额"
                :max="99999"
                @change="creditState.balance = $event ?? 0" />
            </label>
          </template>
        </div>
        <div
          class="nt-credit-milestones"
          role="group"
          aria-label="常见目标节点">
          <span class="nt-muted">快捷目标</span>
          <button
            v-for="m in CREDIT_MILESTONES"
            :key="m.value"
            type="button"
            class="btn"
            :class="{
              p:
                creditState.targetKind === m.kind &&
                creditState.targetCredit === m.value,
            }"
            :title="m.reward ?? m.title"
            @click="selectTarget(m)">
            {{ m.value }}
            <small>{{ m.title }}</small>
          </button>
        </div>
      </div>

      <div class="nt-credit-summary" aria-live="polite">
        <div class="nt-credit-kpis">
          <div class="nt-budget-result">
            <h4>下一局预计作战认证</h4>
            <strong>
              +{{ plan.perRun }}
              <small>点</small>
            </strong>
            <span>
              （{{ plan.baseRoundCredit }}
              <template v-if="plan.baseLeaderBonus">
                + {{ plan.baseLeaderBonus }}
              </template>
              ）× {{ plan.efficiency }}%
            </span>
            <span v-if="plan.perRun < plan.uncappedPerRun">
              已按本序列剩余作战额度截断
            </span>
          </div>
          <div class="nt-budget-result promoted">
            <h4>距离所选目标</h4>
            <strong v-if="!plan.remainingCredit">已达成</strong>
            <strong v-else-if="plan.unreachableCredit">超出可获额度</strong>
            <strong v-else-if="!Number.isFinite(plan.runsNeeded)">
              本进度无收益
            </strong>
            <strong v-else-if="plan.runsNeeded">
              {{ plan.runsNeeded }}
              <small>局作战</small>
            </strong>
            <strong v-else-if="plan.objectiveNeeded">需完成关键目标</strong>
            <strong v-else>余额已足</strong>
            <span v-if="plan.battleNeeded">
              按优先刷作战计算，需作战收入 {{ plan.battleNeeded }} 点。
            </span>
            <span v-if="plan.objectiveNeeded">
              另需关键目标收入 {{ plan.objectiveNeeded }} 点。
            </span>
            <span v-if="plan.unreachableCredit">
              用尽本期可获或可消费额度后仍差 {{ plan.unreachableCredit }} 点。
            </span>
            <span
              v-if="creditState.targetKind === 'spend' && plan.remainingCredit">
              还需在限时兑换消费 {{ plan.remainingCredit }} 点。
            </span>
          </div>
        </div>
        <div class="nt-credit-progress">
          <div class="nt-credit-progress-head">
            <span>
              {{ targetKinds[creditState.targetKind] }} · {{ plan.progress }} /
              {{ creditState.targetCredit }}
            </span>
            <b>{{ pct }}%</b>
          </div>
          <div class="nt-credit-bar" aria-hidden="true">
            <i :style="{transform: `scaleX(${pct / 100})`}"></i>
          </div>
          <p class="nt-muted">
            前 {{ plan.roundsCleared }} 回合的基础作战时限共
            {{ combatTimeLabel }}，未计休整、联防及领袖超时。
          </p>
        </div>
      </div>
    </section>

    <section class="nc nt-credit-compare" aria-label="各档位认证效率对比">
      <header class="nt-heading">
        <h4 aria-level="3">
          {{
            creditState.mode === 'joint' ? '联合难度对比' : '个人模拟档位对比'
          }}
        </h4>
        <span class="nt-muted">按相同通关进度估算 · 局数仅含作战部分</span>
      </header>
      <div class="nt-table-scroll">
        <table class="nt-credit-table">
          <thead>
            <tr>
              <th scope="col">档位</th>
              <th scope="col">效率</th>
              <th scope="col">通过回合</th>
              <th scope="col">下局可获</th>
              <th scope="col">所需作战</th>
              <th scope="col">说明</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in comparisonRows"
              :key="row.id"
              :class="{active: row.active}"
              @click="selectComparisonRow(row.id)">
              <td>
                <button
                  type="button"
                  class="nt-credit-row-btn"
                  :aria-pressed="row.active"
                  @click.stop="selectComparisonRow(row.id)">
                  <b>{{ row.label }}</b>
                  <small v-if="row.strength !== null">
                    +{{ row.strength }}
                  </small>
                </button>
              </td>
              <td class="num">{{ row.efficiency }}%</td>
              <td class="num">{{ row.roundsCleared }}</td>
              <td class="num strong">
                +{{ row.perRun }}
                <small v-if="row.leaderBonus">
                  （含领袖 +{{ row.leaderBonus }}）
                </small>
              </td>
              <td class="num">
                {{
                  Number.isFinite(row.runsNeeded)
                    ? row.runsNeeded + ' 局'
                    : '本进度无收益'
                }}
              </td>
              <td class="note">{{ row.note || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.nt-credit {
  display: grid;
  gap: 14px;
}
.nt-credit-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(270px, 0.9fr);
  gap: 18px;
  align-items: stretch;
  padding: 16px;
}
.nt-credit-inputs {
  display: grid;
  gap: 14px;
  min-width: 0;
}
.nt-credit-field {
  display: grid;
  gap: 8px;
}
.nt-credit-field + .nt-credit-field {
  padding-top: 12px;
  border-top: 1px dashed var(--line);
}
.nt-credit-field .nt-heading {
  margin-bottom: 0;
  flex-wrap: wrap;
}
.nt-credit-check {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 9px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--surface2);
  font-size: 12px;
  color: var(--ink2);
  cursor: pointer;
}
.nt-credit-presets,
.nt-credit-milestones {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.nt-credit-presets .btn,
.nt-credit-milestones .btn {
  min-height: 34px;
  padding: 4px 11px;
  border-radius: 7px;
  font-size: 12.5px;
}
.nt-credit-milestones .btn small {
  margin-left: 4px;
  font-size: 11px;
  opacity: 0.82;
}
.nt-credit-slider {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 2px;
  font-family: var(--fn);
  font-size: 12px;
  color: var(--ink3);
}
.nt-credit-slider input[type='range'] {
  flex: 1;
  min-width: 0;
  accent-color: var(--accent);
}
.nt-credit-numbers {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  padding-top: 12px;
  border-top: 1px dashed var(--line);
}
.nt-credit-numbers label {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 12px;
  font-weight: 600;
  color: var(--ink2);
}
.nt-credit-summary {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 12px;
  padding-left: 18px;
  border-left: 1px solid var(--line);
}
.nt-credit-kpis {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.nt-credit-kpis .nt-budget-result {
  padding: 12px 12px 10px;
  border-radius: 8px;
  border: 1px solid var(--line);
  border-left: 3px solid var(--teal);
  background: color-mix(in srgb, var(--teal) 5%, var(--surface2));
}
.nt-credit-kpis .nt-budget-result.promoted {
  border-left-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 6%, var(--surface2));
}
.nt-credit-progress {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface2);
}
.nt-credit-progress-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  font-size: 12px;
  color: var(--ink2);
}
.nt-credit-progress-head b {
  font-family: var(--fn);
  font-size: 16px;
  color: var(--teal);
}
.nt-credit-bar {
  height: 9px;
  border-radius: 999px;
  background: var(--surface);
  border: 1px solid var(--line);
  overflow: hidden;
}
.nt-credit-bar i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, var(--teal), var(--accent));
  border-radius: inherit;
  transform-origin: left;
  transition: transform 0.22s ease-out;
}
.nt-credit-compare {
  padding: 14px 16px;
}
.nt-credit-table {
  width: 100%;
  border-collapse: collapse;
}
.nt-credit-table th,
.nt-credit-table td {
  padding: 9px 10px;
  border-bottom: 1px solid var(--line);
  text-align: left;
  font-size: 13px;
}
.nt-credit-table th {
  background: var(--surface2);
  color: var(--ink3);
  font-size: 12px;
  font-weight: 600;
}
.nt-credit-table tbody tr {
  cursor: pointer;
  transition: background-color 0.12s;
}
.nt-credit-table tbody tr:hover {
  background: var(--surface2);
}
.nt-credit-table tbody tr.active {
  background: color-mix(in srgb, var(--accent) 11%, var(--surface));
}
.nt-credit-table tbody tr.active td:first-child {
  box-shadow: inset 3px 0 0 var(--accent);
}
.nt-credit-table .num {
  font-family: var(--fn);
  white-space: nowrap;
}
.nt-credit-table .strong {
  color: var(--accent);
  font-weight: 700;
}
.nt-credit-table .strong small {
  font-family: var(--fb);
  font-weight: 400;
  font-size: 11px;
  color: var(--ink3);
}
.nt-credit-table .note {
  font-size: 12px;
  color: var(--ink3);
}
.nt-credit-row-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink);
  font: inherit;
  text-align: left;
}
.nt-credit-row-btn small {
  font-family: var(--fn);
  font-size: 11px;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--surface2);
  border: 1px solid var(--line);
  color: var(--ink3);
}
@container number-tools (max-width: 720px) {
  .nt-credit-grid {
    grid-template-columns: minmax(0, 1fr);
    padding: 12px;
  }
  .nt-credit-summary {
    padding-left: 0;
    padding-top: 12px;
    border-left: 0;
    border-top: 1px solid var(--line);
  }
}
@media (max-height: 600px) {
  .nt-credit {
    gap: 8px;
  }
  .nt-credit-grid {
    padding: 10px 12px;
    gap: 10px;
  }
  .nt-credit-inputs {
    gap: 8px;
  }
  .nt-credit-field + .nt-credit-field,
  .nt-credit-numbers {
    padding-top: 8px;
  }
  .nt-credit-table th,
  .nt-credit-table td {
    padding: 6px 8px;
  }
}
</style>
