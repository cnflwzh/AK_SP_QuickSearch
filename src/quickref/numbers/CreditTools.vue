<script setup lang="ts">
import {computed} from 'vue';
import {
  CREDIT,
  CREDIT_MILESTONES,
  DIFFICULTIES,
  LEADER_CREDIT_BONUS,
  MODES,
  SOLO_LEVELS,
} from '../../../data/index.ts';
import {
  calculateCreditPlan,
  compareJointDifficulties,
  compareSoloLevels,
} from '../../lib/numbers/numberTools.ts';
import Segmented from '../components/Segmented.vue';
import NumberInput from './NumberInput.vue';
import {useNumberToolsState} from './useNumberToolsState.ts';

const creditState = useNumberToolsState().credit;
const MAX_ROUNDS = CREDIT.length;
const jointDifficulties = DIFFICULTIES.filter((d) => d.efficiency > 0);

const ROUND_PRESETS = [
  {label: 'R8', rounds: 8, leader: false},
  {label: 'R10', rounds: 10, leader: false},
  {label: 'R12', rounds: 12, leader: false},
  {label: '通过 R14', rounds: MAX_ROUNDS, leader: false},
  {label: '击败领袖', rounds: MAX_ROUNDS, leader: true},
] as const;

const currentEfficiency = computed(() => {
  if (creditState.mode === 'joint') {
    return jointDifficulties[creditState.jointDifficulty]?.efficiency ?? 100;
  }
  return SOLO_LEVELS[creditState.soloLevel - 1]?.efficiency ?? 100;
});

const currentModeMeta = computed(() => {
  if (creditState.mode === 'joint') {
    const item = jointDifficulties[creditState.jointDifficulty];
    return item
      ? `${item.name} · 效率 ${item.efficiency}%${item.strength !== null ? ` · 强度 +${item.strength}` : ''}`
      : '';
  }
  const item = SOLO_LEVELS[creditState.soloLevel - 1];
  return item
    ? `个人规程 ${item.level} · 效率 ${item.efficiency}% · 强度 +${item.strength}${item.note ? ` · ${item.note}` : ''}`
    : '';
});

const plan = computed(() =>
  calculateCreditPlan({
    efficiency: currentEfficiency.value,
    roundsCleared: creditState.roundsCleared,
    defeatedLeader: creditState.defeatedLeader,
    currentCredit: creditState.currentCredit,
    targetCredit: creditState.targetCredit,
  }),
);

const progressPct = computed(() => {
  if (creditState.targetCredit <= 0) return 100;
  return Math.max(
    0,
    Math.min(
      100,
      Math.round((creditState.currentCredit / creditState.targetCredit) * 100),
    ),
  );
});

const comparisonRows = computed(() =>
  creditState.mode === 'joint'
    ? compareJointDifficulties({
        roundsCleared: creditState.roundsCleared,
        defeatedLeader: creditState.defeatedLeader,
        currentCredit: creditState.currentCredit,
        targetCredit: creditState.targetCredit,
        activeIndex: creditState.jointDifficulty,
      })
    : compareSoloLevels({
        roundsCleared: creditState.roundsCleared,
        defeatedLeader: creditState.defeatedLeader,
        currentCredit: creditState.currentCredit,
        targetCredit: creditState.targetCredit,
        activeLevel: creditState.soloLevel,
      }),
);

const combatTimeLabel = computed(() => {
  const mins = Math.floor(plan.value.maxCombatSeconds / 60);
  const secs = plan.value.maxCombatSeconds % 60;
  return secs ? `${mins} 分 ${secs} 秒` : `${mins} 分钟`;
});

function setMode(index: number): void {
  creditState.mode = index === 0 ? 'joint' : 'solo';
}

function applyRoundPreset(rounds: number, leader: boolean): void {
  creditState.roundsCleared = rounds;
  creditState.defeatedLeader = leader;
}

function onRoundInput(event: Event): void {
  const value = Number((event.target as HTMLInputElement).value);
  creditState.roundsCleared = Math.max(1, Math.min(MAX_ROUNDS, value));
  if (creditState.roundsCleared < MAX_ROUNDS) {
    creditState.defeatedLeader = false;
  }
}

function selectComparisonRow(id: string): void {
  const [mode, raw] = id.split(':');
  const num = Number(raw);
  if (!Number.isFinite(num)) return;
  if (mode === 'joint') creditState.jointDifficulty = num;
  else if (mode === 'solo') creditState.soloLevel = num;
}

function isPresetActive(rounds: number, leader: boolean): boolean {
  return (
    creditState.roundsCleared === rounds &&
    (rounds < MAX_ROUNDS || creditState.defeatedLeader === leader)
  );
}
</script>

<template>
  <div class="nt-credit">
    <div class="bar nt-toolbar">
      <h4 class="nt-section-title" aria-level="2">认证效率</h4>
      <Segmented
        :labels="['联合模拟', '个人规程']"
        :active="creditState.mode === 'joint' ? 0 : 1"
        attr="credit-mode"
        @change="setMode" />
    </div>

    <section class="nc nt-credit-grid" aria-label="认证收益计算">
      <div class="nt-credit-inputs">
        <div class="nt-credit-field">
          <div class="nt-heading">
            <h4 aria-level="3">
              {{ creditState.mode === 'joint' ? '模拟难度' : '规程等级' }}
            </h4>
            <span class="nt-muted">{{ currentModeMeta }}</span>
          </div>
          <Segmented
            v-if="creditState.mode === 'joint'"
            class="panel-reveal"
            :labels="MODES"
            :active="creditState.jointDifficulty"
            attr="credit-diff"
            @change="creditState.jointDifficulty = $event" />
          <select
            v-else
            :value="creditState.soloLevel"
            class="panel-reveal"
            aria-label="个人规程等级"
            @change="
              creditState.soloLevel = Number(
                ($event.target as HTMLSelectElement).value,
              )
            ">
            <option
              v-for="item in SOLO_LEVELS"
              :key="item.level"
              :value="item.level">
              规程 {{ item.level }} · {{ item.efficiency }}%（强度 +{{
                item.strength
              }}{{ item.note ? ` · ${item.note}` : '' }}）
            </option>
          </select>
        </div>

        <div class="nt-credit-field">
          <div class="nt-heading">
            <h4 aria-level="3">
              平均通关进度
              <small>
                第 {{ creditState.roundsCleared }} 回合{{
                  plan.defeatedLeader ? ' · 击败领袖' : ''
                }}
              </small>
            </h4>
            <label
              v-if="creditState.roundsCleared >= MAX_ROUNDS"
              class="nt-credit-check">
              <input v-model="creditState.defeatedLeader" type="checkbox" />
              <span>击败领袖（基础 +{{ LEADER_CREDIT_BONUS }}）</span>
            </label>
          </div>
          <div class="nt-credit-presets" role="group" aria-label="通关进度快捷项">
            <button
              v-for="preset in ROUND_PRESETS"
              :key="preset.label"
              type="button"
              :class="[
                'btn',
                {p: isPresetActive(preset.rounds, preset.leader)},
              ]"
              :aria-pressed="isPresetActive(preset.rounds, preset.leader)"
              @click="applyRoundPreset(preset.rounds, preset.leader)">
              {{ preset.label }}
            </button>
          </div>
          <div class="nt-credit-slider">
            <span>R1</span>
            <input
              type="range"
              :min="1"
              :max="MAX_ROUNDS"
              :value="creditState.roundsCleared"
              aria-label="平均通过回合数"
              @input="onRoundInput" />
            <span>R{{ MAX_ROUNDS }}</span>
          </div>
        </div>

        <div class="nt-credit-numbers">
          <label>
            当前认证点数
            <NumberInput
              :value="creditState.currentCredit"
              label="当前认证点数"
              :max="99999"
              @change="creditState.currentCredit = $event ?? 0" />
          </label>
          <label>
            目标认证点数
            <NumberInput
              :value="creditState.targetCredit"
              label="目标认证点数"
              :max="99999"
              @change="creditState.targetCredit = $event ?? 0" />
          </label>
        </div>

        <div class="nt-credit-milestones" role="group" aria-label="常见目标节点">
          <span class="nt-muted">快捷目标</span>
          <button
            v-for="m in CREDIT_MILESTONES"
            :key="m.value"
            type="button"
            :class="['btn', {p: creditState.targetCredit === m.value}]"
            :title="m.reward ? `${m.title}：${m.reward}` : m.title"
            @click="creditState.targetCredit = m.value">
            {{ m.value }}
            <small>{{ m.title }}</small>
          </button>
        </div>
      </div>

      <div class="nt-credit-summary" aria-live="polite">
        <div class="nt-credit-kpis">
          <div class="nt-budget-result">
            <h4>单局预计认证</h4>
            <strong>
              +{{ plan.perRun }}
              <small>点</small>
            </strong>
            <span>
              基础 {{ plan.baseRoundCredit
              }}<template v-if="plan.baseLeaderBonus">
                + {{ plan.baseLeaderBonus }}
              </template>
              × {{ plan.efficiency }}%
            </span>
          </div>
          <div class="nt-budget-result promoted">
            <h4>距离目标还需</h4>
            <strong v-if="plan.remainingCredit === 0">已达成</strong>
            <strong v-else>
              {{ plan.runsNeeded }}
              <small>局</small>
            </strong>
            <span>
              <template v-if="plan.remainingCredit === 0">
                超出
                {{
                  Math.max(0, creditState.currentCredit - creditState.targetCredit)
                }}
                点
              </template>
              <template v-else>
                尚差 {{ plan.remainingCredit }} 认证点数
              </template>
            </span>
          </div>
        </div>

        <div class="nt-credit-progress">
          <div class="nt-credit-progress-head">
            <span>当前进度</span>
            <b>{{ progressPct }}%</b>
          </div>
          <div class="nt-credit-bar" aria-hidden="true">
            <i :style="{transform: `scaleX(${progressPct / 100})`}"></i>
          </div>
          <p class="nt-muted">
            前 {{ plan.roundsCleared }} 回合作战时限累计
            {{ combatTimeLabel }}（不含休整与联防时间）。
          </p>
        </div>
      </div>
    </section>

    <section class="nc nt-credit-compare" aria-label="各档位认证效率横向对比">
      <header class="nt-heading">
        <h4 aria-level="3">
          {{ creditState.mode === 'joint' ? '联合难度横向对比' : '个人规程关键档位对比' }}
        </h4>
        <span class="nt-muted">
          按通过第 {{ plan.roundsCleared }} 回合{{
            plan.defeatedLeader ? '并击败领袖' : ''
          }}计算 · 点击行切换
        </span>
      </header>
      <div class="nt-table-scroll">
        <table class="nt-credit-table">
          <thead>
            <tr>
              <th scope="col">档位</th>
              <th scope="col">效率</th>
              <th scope="col">单局收益</th>
              <th scope="col">还需局数</th>
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
                  <small v-if="row.strength !== null">+{{ row.strength }}</small>
                </button>
              </td>
              <td class="num">{{ row.efficiency }}%</td>
              <td class="num strong">
                +{{ row.perRun }}
                <small v-if="row.leaderBonus">（含领袖 +{{ row.leaderBonus }}）</small>
              </td>
              <td class="num">
                {{ row.runsNeeded === 0 ? '已达成' : `${row.runsNeeded} 局` }}
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
