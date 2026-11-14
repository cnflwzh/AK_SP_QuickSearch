<script setup lang="ts">
import { ADVISOR_MODES, RESTRICTED_MODE_COVENANTS, type AdvisorMode } from '../../lib/advisorRules.ts';
import { computed, ref } from 'vue';
import { effectiveBans } from '../../lib/runAdvisor.ts';
import { ALL_COVENANTS, CORE_COVENANTS, ADDON_COVENANTS, covenantColor } from '../../../data/index.ts';
import { MAX_LAYERS, usesLayers } from '../../lib/planner.ts';
import { useRunAdvisor } from './useRunAdvisor.ts';

defineEmits<{ excludeOperator: [] }>();
const advisor = useRunAdvisor();
const { run, goal, unavailableNames, poolConflicts } = advisor;
const inactiveCovenants = computed(() => effectiveBans(run.value));
const layerCovenants = ALL_COVENANTS.filter(usesLayers);
const layerSelection = ref(layerCovenants[0] ?? '');
function optionalNumber(event: Event): number | null {
  const value = (event.target as HTMLInputElement).value.trim();
  return value === '' ? null : Number(value);
}
// 绝技按全场精锐触发，不对应可从招募池移除的原生干员。
const groups = [
  { title: '核心盟约', names: CORE_COVENANTS },
  { title: '附加盟约', names: ADDON_COVENANTS.filter(name => name !== '绝技') },
];
</script>

<template>
  <div class="ra-pool-settings">
    <label>游戏模式
      <select :value="run.mode" @change="advisor.setMode(($event.target as HTMLSelectElement).value as AdvisorMode)">
        <option v-for="mode in ADVISOR_MODES" :key="mode.id" :value="mode.id">{{ mode.label }}</option>
      </select>
    </label>
    <p v-if="run.mode === 'restricted'" class="ra-muted">模式固定缺席：{{ RESTRICTED_MODE_COVENANTS.join('、') }}。仍需补录本局其他缺席信息。</p>
    <div class="ra-pool-direction">
      <label>主盟约
        <select :value="run.mainCovenant" @change="advisor.setMainCovenant(($event.target as HTMLSelectElement).value)">
          <option value="">自动判断{{ goal && !run.mainCovenant ? ` · ${goal.covenant}` : '' }}</option>
          <option value="mixed">混搭，不锁主盟约</option>
          <option v-for="name in CORE_COVENANTS" :key="name" :value="name" :disabled="inactiveCovenants.has(name)">{{ name }}</option>
        </select>
      </label>
      <label>成型目标
        <select :value="run.mainTarget" :disabled="!goal" @change="advisor.setMainTarget(Number(($event.target as HTMLSelectElement).value))">
          <option :value="0">自动{{ goal ? ` · ${goal.target} 人` : '' }}</option>
          <option :value="3">3 人，留位混搭</option>
          <option :value="6">6 人，追人数强化</option>
        </select>
      </label>
    </div>
    <p class="ra-muted">自动按场上本家人数、专属策略判断；方向未定时不强行选边。主轴成型后再补配合与精锐。</p>
    <div class="ra-section-heading"><h3>局面信息 <small>选填</small></h3></div>
    <div class="ra-pool-direction ra-run-context">
      <label>当前回合
        <input type="number" inputmode="numeric" min="1" max="14" step="1" placeholder="未知"
          :value="run.round ?? ''" @change="advisor.setRound(optionalNumber($event))">
      </label>
      <label>可用资金
        <input type="number" inputmode="numeric" min="0" max="999" step="1" placeholder="未知"
          :value="run.funds ?? ''" @change="advisor.setFunds(optionalNumber($event))">
      </label>
      <label>记录盟约层数
        <select v-model="layerSelection">
          <option v-for="name in layerCovenants" :key="name" :value="name">{{ name }}</option>
        </select>
      </label>
      <label>{{ layerSelection }}层数
        <input type="number" inputmode="numeric" min="0" :max="MAX_LAYERS" step="1" placeholder="未知"
          :value="run.layers[layerSelection] ?? ''" @change="advisor.setLayer(layerSelection, optionalNumber($event))">
      </label>
    </div>
    <p class="ra-muted">留空表示未知，0 表示确认没有。回合、资金与层数只作推荐参考，请随局面手动更新，不会自动扣款或叠层。</p>
    <div v-if="Object.keys(run.layers).length" class="ra-pool-chips" aria-label="已记录层数">
      <button v-for="(layers, name) in run.layers" :key="name" type="button"
        :aria-label="`清除${name}层数记录`" @click="advisor.setLayer(String(name), null)">{{ name }} {{ layers }} 层 ×</button>
    </div>
    <div class="ra-section-heading"><h3>本局禁用</h3><span class="ra-muted">已排除 {{ unavailableNames.length }} 名</span></div>
    <p class="ra-muted">按开局简报点选缺席盟约；属于这些盟约的干员不会出现在抓取建议或录入候选中。</p>
    <fieldset v-for="group in groups" :key="group.title" class="ra-pool-group">
      <legend>{{ group.title }}</legend>
      <div class="ra-pool-chips">
        <button v-for="name in group.names" :key="name" type="button" :aria-pressed="run.bannedCovenants.includes(name)"
          :class="{ banned: run.bannedCovenants.includes(name) }" :style="{ '--c': covenantColor(name, 'var(--teal)') }"
          @click="advisor.toggleBannedCovenant(name)">{{ name }}<span v-if="run.bannedCovenants.includes(name)"> ×</span></button>
      </div>
    </fieldset>
    <div class="ra-section-heading"><h3>单独排除干员</h3><button type="button" class="ra-text-button" @click="$emit('excludeOperator')">＋ 选择干员</button></div>
    <p class="ra-muted">用于单独禁用，或未选入本局招募池的可选干员。</p>
    <div class="ra-pool-chips">
      <button v-for="name in run.excludedOperators" :key="name" type="button" class="banned" :aria-label="`恢复${name}的招募资格`"
        @click="advisor.toggleExcludedOperator(name)">{{ name }} ×</button>
      <span v-if="!run.excludedOperators.length" class="ra-muted">未单独排除</span>
    </div>
    <p v-if="poolConflicts.length" class="ra-pool-conflict">已持有的{{ poolConflicts.join('、') }}与禁用设置冲突。请修正禁用或持有记录后继续推荐。</p>
  </div>
</template>
