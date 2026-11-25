<script setup lang="ts">
import {
  ADVISOR_MODES,
  ADVISOR_FORMATS,
  advisorRoundLimit,
  RESTRICTED_MODE_COVENANTS,
  type AdvisorFormat,
  type AdvisorMode,
} from '../../lib/recommendation/live/advisorRules.ts';
import {computed, ref} from 'vue';
import {effectiveBans} from '../../lib/recommendation/live/runAdvisor.ts';
import {
  ALL_COVENANTS,
  CORE_COVENANTS,
  ADDON_COVENANTS,
  DEPLOYMENT_BONUS_EQUIP,
  SEASON_META,
  covenantColor,
  isBannableCovenant,
  strategyUsesAdvisorCommand,
} from '../../../data/index.ts';
import {MAX_LAYERS, usesLayers} from '../../lib/plans/core.ts';
import CovenantIcon from '../components/CovenantIcon.vue';
import SelectInput, {type SelectOption} from '../components/SelectInput.vue';
import {useRunAdvisor} from './useRunAdvisor.ts';

defineEmits<{excludeOperator: []}>();
const advisor = useRunAdvisor();
const {run, goal, unavailableNames, poolConflicts} = advisor;
const inactiveCovenants = computed(() => effectiveBans(run.value));
const layerCovenants = ALL_COVENANTS.filter(usesLayers);
const layerSelection = ref(layerCovenants[0] ?? '');
/** 规则层给出原有错误提示，失焦后把被拒绝的输入恢复到本局记录。 */
function commitNumber(
  event: Event,
  previous: number | null | undefined,
  update: (value: number | null) => void,
): void {
  const input = event.target as HTMLInputElement;
  const valid = input.validity.valid;
  update(input.value === '' && valid ? null : input.valueAsNumber);
  if (!valid) input.value = previous == null ? '' : String(previous);
}
function updatePersonnelDocument(value: string): void {
  advisor.setPersonnelDocumentUsed(value === 'true');
}
// 仅按全场精锐触发的盟约，不对应可从招募池移除的原生干员。
const groups = [
  {title: '核心盟约', names: CORE_COVENANTS},
  {title: '附加盟约', names: ADDON_COVENANTS.filter(isBannableCovenant)},
];
const baseDeploymentLimit = SEASON_META.baseDeploymentLimit;
const bonusDeploymentLimit =
  baseDeploymentLimit +
  (DEPLOYMENT_BONUS_EQUIP?.mechanics?.deploymentSlotBonus ?? 0);
const deploymentBonusName = DEPLOYMENT_BONUS_EQUIP?.name ?? '扩展文档';

const formatOptions: readonly SelectOption<AdvisorFormat>[] =
  ADVISOR_FORMATS.map((f) => ({value: f.id, label: f.label}));
const modeOptions: readonly SelectOption<AdvisorMode>[] = ADVISOR_MODES.map(
  (m) => ({value: m.id, label: m.label}),
);
const mainCovenantOptions = computed<readonly SelectOption<string>[]>(() => [
  {
    value: '',
    label: `自动判断${goal.value && !run.value.mainCovenant ? ` · ${goal.value.covenant}` : ''}`,
  },
  {value: 'mixed', label: '混搭，不锁主盟约'},
  ...CORE_COVENANTS.map((name) => ({
    value: name,
    label: name,
    disabled: inactiveCovenants.value.has(name),
  })),
]);
const mainTargetOptions = computed<readonly SelectOption<number>[]>(() => [
  {
    value: 0,
    label: `自动${goal.value ? ` · ${goal.value.target} 人` : ''}`,
  },
  {value: 3, label: '3 人，留位混搭'},
  {value: 6, label: '6 人，追人数强化'},
]);
const personnelDocumentOptions: readonly SelectOption<string>[] = [
  {value: 'false', label: `${baseDeploymentLimit}人 · 未记录使用文档`},
  {
    value: 'true',
    label: `${bonusDeploymentLimit}人 · 已使用${deploymentBonusName}`,
  },
];
const commandOptions: readonly SelectOption<string>[] = [
  {value: 'unknown', label: '未知，保留条件收益'},
  {value: 'true', label: '确认可用'},
  {value: 'false', label: '已用 / 暂不可用'},
];
const layerCovenantOptions: readonly SelectOption<string>[] =
  layerCovenants.map((name) => ({value: name, label: name}));
</script>

<template>
  <div class="ra-pool-settings">
    <label>
      对局长度
      <SelectInput
        :model-value="run.format"
        :options="formatOptions"
        aria-label="对局长度"
        @update:model-value="advisor.setFormat($event)" />
    </label>
    <label>
      招募池范围
      <SelectInput
        :model-value="run.mode"
        :options="modeOptions"
        :disabled="run.format === 'fast'"
        aria-label="招募池范围"
        @update:model-value="advisor.setMode($event)" />
    </label>
    <p v-if="run.mode === 'restricted'" class="ra-muted">
      模式固定缺席：{{
        RESTRICTED_MODE_COVENANTS.join('、')
      }}。仍需补录本局其他缺席信息。
    </p>
    <div class="ra-pool-direction">
      <label>
        主盟约
        <SelectInput
          :model-value="run.mainCovenant"
          :options="mainCovenantOptions"
          aria-label="主盟约"
          @update:model-value="advisor.setMainCovenant($event)" />
      </label>
      <label>
        成型目标
        <SelectInput
          :model-value="run.mainTarget"
          :options="mainTargetOptions"
          :disabled="!goal"
          aria-label="成型目标"
          @update:model-value="advisor.setMainTarget($event)" />
      </label>
    </div>
    <p class="ra-muted">
      自动按场上本家人数、专属策略判断；方向未定时不强行选边。主轴成型后再补配合与精锐。
    </p>
    <div class="ra-section-heading">
      <h3>
        局面信息
        <small>选填</small>
      </h3>
    </div>
    <div class="ra-pool-direction ra-run-context">
      <label>
        部署上限
        <SelectInput
          :model-value="String(run.personnelDocumentUsed)"
          :options="personnelDocumentOptions"
          aria-label="部署上限"
          @update:model-value="updatePersonnelDocument" />
      </label>
      <label>
        当前回合
        <input
          type="number"
          inputmode="numeric"
          min="1"
          :max="
            advisorRoundLimit(run.format) ?? SEASON_META.roundLimits.standard
          "
          step="1"
          placeholder="未知"
          :value="run.round ?? ''"
          @change="commitNumber($event, run.round, advisor.setRound)" />
      </label>
      <label v-if="strategyUsesAdvisorCommand(run.strategy)">
        本次主动指令
        <SelectInput
          :model-value="
            run.commandAvailable === null
              ? 'unknown'
              : String(run.commandAvailable)
          "
          :options="commandOptions"
          aria-label="本次主动指令"
          @update:model-value="
            advisor.setCommandAvailable(
              $event === 'unknown' ? null : $event === 'true',
            )
          " />
      </label>
      <label>
        本轮已获得人数（按游戏显示）
        <input
          type="number"
          inputmode="numeric"
          min="0"
          max="999"
          step="1"
          placeholder="未知"
          :value="run.acquisitionsThisRound ?? ''"
          @change="commitNumber($event, run.acquisitionsThisRound, advisor.setAcquisitionsThisRound)" />
      </label>
      <label>
        可用资金
        <input
          type="number"
          inputmode="numeric"
          min="0"
          max="999"
          step="1"
          placeholder="未知"
          :value="run.funds ?? ''"
          @change="commitNumber($event, run.funds, advisor.setFunds)" />
      </label>
      <label>
        记录盟约层数
        <SelectInput
          v-model="layerSelection"
          :options="layerCovenantOptions"
          aria-label="记录盟约层数" />
      </label>
      <label>
        {{ layerSelection }}层数
        <input
          type="number"
          inputmode="numeric"
          min="0"
          :max="MAX_LAYERS"
          step="1"
          placeholder="未知"
          :value="run.layers[layerSelection] ?? ''"
          @change="commitNumber($event, run.layers[layerSelection], (value) => advisor.setLayer(layerSelection, value))" />
      </label>
    </div>
    <p class="ra-muted">
      留空表示未知，0
      表示确认没有。回合、资金与层数只作推荐参考，请随局面手动更新，不会自动扣款或叠层。记录获得或切换回合后，请重新确认获得人数；切换策略或回合后，主动指令可用性重置为未知。
    </p>
    <div
      v-if="Object.keys(run.layers).length"
      class="ra-pool-chips"
      aria-label="已记录层数">
      <button
        v-for="(layers, name) in run.layers"
        :key="name"
        type="button"
        :aria-label="`清除${name}层数记录`"
        @click="advisor.setLayer(String(name), null)">
        {{ name }} {{ layers }} 层 ×
      </button>
    </div>
    <div class="ra-section-heading">
      <h3>本局禁用</h3>
      <span class="ra-muted">已排除 {{ unavailableNames.length }} 名</span>
    </div>
    <p class="ra-muted">
      按开局简报点选缺席盟约：核心缺席时其干员整组禁用；附加盟约则仅当某干员的全部原生附加盟约均缺席时禁用。保留干员的缺席盟约仍不生效。
    </p>
    <fieldset v-for="group in groups" :key="group.title" class="ra-pool-group">
      <legend>{{ group.title }}</legend>
      <div class="ra-pool-chips">
        <button
          v-for="name in group.names"
          :key="name"
          type="button"
          :aria-pressed="run.bannedCovenants.includes(name)"
          :class="{banned: run.bannedCovenants.includes(name)}"
          :style="{'--c': covenantColor(name, 'var(--teal)')}"
          @click="advisor.toggleBannedCovenant(name)">
          <CovenantIcon :name="name" />
          {{ name }}
          <span v-if="run.bannedCovenants.includes(name)">×</span>
        </button>
      </div>
    </fieldset>
    <div class="ra-section-heading">
      <h3>单独排除干员</h3>
      <button
        type="button"
        class="ra-text-button"
        @click="$emit('excludeOperator')">
        ＋ 选择干员
      </button>
    </div>
    <p class="ra-muted">用于单独禁用，或未选入本局招募池的可选干员。</p>
    <div class="ra-pool-chips">
      <button
        v-for="name in run.excludedOperators"
        :key="name"
        type="button"
        class="banned"
        :aria-label="`恢复${name}的招募资格`"
        @click="advisor.toggleExcludedOperator(name)">
        {{ name }} ×
      </button>
      <span v-if="!run.excludedOperators.length" class="ra-muted">
        未单独排除
      </span>
    </div>
    <p v-if="poolConflicts.length" class="ra-pool-conflict">
      已持有的{{
        poolConflicts.join('、')
      }}与禁用设置冲突。请修正禁用或持有记录后继续推荐。
    </p>
  </div>
</template>
