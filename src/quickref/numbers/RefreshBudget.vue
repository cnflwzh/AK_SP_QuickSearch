<script setup lang="ts">
import { computed } from 'vue';
import { OPERATORS } from '../../../data/operators.ts';
import { operatorPrice } from '../../../data/rules.ts';
import { refreshBudget } from '../../lib/numberTools.ts';
import { queryText } from '../../router/location.ts';
import { routeQuery, updateQuery } from '../../router/navigation.ts';
import NumberInput from './NumberInput.vue';

const props = defineProps<{ level: number }>();
const readNumber = (key: string): number | null => {
  const text = queryText(routeQuery.value, key);
  return text === '' ? null : Number(text);
};
const funds = computed(() => readNumber('funds'));
const upgrade = computed(() => readNumber('upgrade'));
const target = computed(() => OPERATORS.find(operator => operator.avatar === queryText(routeQuery.value, 'target')));
const reserve = computed(() => readNumber('reserve') ?? (target.value ? operatorPrice(target.value) : 0));
const stay = computed(() => funds.value === null ? null : refreshBudget(funds.value, reserve.value));
const promote = computed(() => funds.value === null || upgrade.value === null || props.level === 6 ? null
  : refreshBudget(funds.value, reserve.value, upgrade.value));
function setNumber(key: 'funds' | 'upgrade' | 'reserve', value: number | null): void {
  void updateQuery({ [key]: value }, true);
}
</script>

<template>
  <section class="nt-budget">
    <header class="nt-heading"><h4>刷新预算</h4><span class="nt-muted">每次 1 资金</span></header>
    <div class="nt-budget-inputs">
      <label>当前资金<NumberInput :value="funds" label="当前资金" placeholder="填写资金" nullable @change="setNumber('funds', $event)"/></label>
      <label v-if="level < 6">当前升级价<NumberInput :value="upgrade" label="当前升级价" placeholder="游戏内价格" nullable @change="setNumber('upgrade', $event)"/></label>
      <label>买牌预留<NumberInput :value="reserve" label="买牌预留" @change="setNumber('reserve', $event)"/></label>
    </div>
    <button v-if="target" type="button" class="btn nt-text-button" @click="setNumber('reserve', null)">按{{ target.name }}基础价预留 · {{ operatorPrice(target) }}</button>

    <div v-if="stay" class="nt-budget-results" aria-live="polite">
      <div class="nt-budget-result">
        <h4>留在 {{ level }} 级</h4>
        <template v-if="stay.reserveShortfall"><strong class="nt-warning">差 {{ stay.reserveShortfall }}</strong><span>买牌预留不足</span></template>
        <template v-else><strong>{{ stay.refreshes }}<small> 次</small></strong><span>可付费刷新</span></template>
        <small>资金 {{ funds }} − 预留 {{ reserve }}</small>
      </div>
      <div v-if="level < 6" class="nt-budget-result promoted">
        <h4>升到 {{ level + 1 }} 级</h4>
        <template v-if="!promote"><strong>—</strong><span>填写当前升级价</span></template>
        <template v-else-if="promote.upgradeShortfall"><strong class="nt-warning">差 {{ promote.upgradeShortfall }}</strong><span>升级资金不足</span></template>
        <template v-else>
          <template v-if="promote.reserveShortfall"><strong class="nt-warning">差 {{ promote.reserveShortfall }}</strong><span>买牌预留不足</span></template>
          <template v-else><strong>{{ promote.refreshes }}<small> 次</small></strong><span>可付费刷新</span></template>
          <small>升级后余 {{ promote.balance }} − 预留 {{ reserve }}</small>
        </template>
      </div>
      <div v-else class="nt-budget-result promoted"><h4>调度中心已满级</h4><strong>VI</strong><span>普通刷新最高 VI 阶</span></div>
    </div>
  </section>
</template>
