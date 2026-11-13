<script setup lang="ts">
import { computed } from 'vue';
import { EQUIP, OPERATOR, TIER_LABELS } from '../../../data/index.ts';
import { avatarSrc, equipIconSrc } from '../../lib/assets.ts';
import { eliteCopyCount } from '../../lib/runAdvisor.ts';
import { MAX_OPS } from '../../lib/planner.ts';
import { peekFx } from '../format.ts';
import { useRunAdvisor } from './useRunAdvisor.ts';
import type { AdvisorSelection } from './types.ts';

const props = defineProps<{ selection: AdvisorSelection }>();
const emit = defineEmits<{ addEquipment: [holder: string]; details: [kind: 'op' | 'eq', name: string]; removed: [] }>();
const advisor = useRunAdvisor();
const { run, deployed, notice } = advisor;
const operator = computed(() => props.selection.kind === 'operator' ? run.value.operators.find(item => item.name === props.selection.id) : undefined);
const equipment = computed(() => props.selection.kind === 'equipment' ? run.value.equipment.find(item => item.id === props.selection.id) : undefined);
const held = computed(() => run.value.equipment.filter(item => item.holder === operator.value?.name));
const warehouse = computed(() => run.value.equipment.filter(item => !item.holder));
const selectValue = (event: Event): string => (event.target as HTMLSelectElement).value;
const isChecked = (event: Event): boolean => (event.target as HTMLInputElement).checked;
function equipFromWarehouse(event: Event): void {
  const id = selectValue(event);
  if (id && operator.value) advisor.assignEquipment(id, operator.value.name);
  (event.target as HTMLSelectElement).value = '';
}
function assignHolder(event: Event): void {
  if (!equipment.value) return;
  const select = event.target as HTMLSelectElement;
  if (!advisor.assignEquipment(equipment.value.id, select.value)) select.value = equipment.value.holder;
}
function replace(event: Event): void {
  const outgoingName = selectValue(event);
  if (outgoingName && operator.value) advisor.setDeployment(operator.value.name, true, outgoingName);
  (event.target as HTMLSelectElement).value = '';
}
function remove(): void {
  if (operator.value) advisor.removeOperator(operator.value.name);
  else if (equipment.value) advisor.removeEquipment(equipment.value.id);
  emit('removed');
}
</script>

<template>
  <div class="ra-inspector">
    <template v-if="operator">
      <div class="ra-inspector-identity">
        <img :src="avatarSrc(operator.name)" alt="" width="48" height="48">
        <div>
          <h3>{{ operator.name }} <small>{{ TIER_LABELS[OPERATOR[operator.name].tier] }} 阶</small></h3>
          <p>{{ OPERATOR[operator.name].covenants.join(' · ') }}</p>
        </div>
        <span class="ra-tag">{{ operator.deployed ? '上场' : '整备区' }}</span>
      </div>
      <div class="ra-inspector-row">
        <label v-if="!operator.elite && eliteCopyCount(operator.name) > 2">
          <span class="sr-only">持有张数</span>
          <select :value="operator.copies" @change="advisor.setCopies(operator.name, Number(selectValue($event)))">
            <option :value="1">1 张</option><option :value="2">2 张 · 对子</option>
          </select>
        </label>
        <span v-else-if="!operator.elite" class="ra-muted">两张合成精锐</span>
        <label class="ra-check">
          <input type="checkbox" :checked="operator.elite" @change="advisor.setElite(operator.name, isChecked($event))">精锐
        </label>
        <button type="button" class="btn" :disabled="operator.elite" @click="advisor.recruit(operator.name)">
          ＋ 再抓1张
        </button>
      </div>
      <div class="ra-inspector-section">
        <h4>携带装备 <small>{{ held.length }} / 2</small></h4>
        <div class="ra-equipped-slots">
          <div v-for="slot in 2" :key="slot" class="ra-equipped-slot">
            <template v-if="held[slot - 1]">
              <img :src="equipIconSrc(held[slot - 1].name)" alt="" width="30" height="30">
              <span>{{ held[slot - 1].name }}<small v-if="held[slot - 1].advanced">进阶</small></span>
              <button type="button" class="ra-icon-button" :aria-label="`卸下${held[slot - 1].name}`"
                @click="advisor.assignEquipment(held[slot - 1].id, '')">×</button>
            </template>
            <button v-else type="button" class="ra-add-equipment" @click="$emit('addEquipment', operator.name)">
              ＋ 装备
            </button>
          </div>
        </div>
        <label v-if="warehouse.length && held.length < 2" class="ra-warehouse-select">
          <span class="sr-only">从仓库装备</span>
          <select value="" @change="equipFromWarehouse">
            <option value="">从仓库装备…</option>
            <option v-for="item in warehouse" :key="item.id" :value="item.id">
              {{ item.name }}{{ item.advanced ? ' · 进阶' : '' }}
            </option>
          </select>
        </label>
      </div>
      <div class="ra-inspector-row ra-deployment-actions">
        <button v-if="operator.deployed" type="button" class="btn" @click="advisor.setDeployment(operator.name, false)">
          移入整备区 ↓
        </button>
        <button v-else-if="deployed.length < MAX_OPS" type="button" class="btn" @click="advisor.setDeployment(operator.name, true)">
          上场 ↑
        </button>
        <label v-else>
          <span class="sr-only">替换谁上场</span>
          <select value="" @change="replace">
            <option value="">替换谁上场…</option>
            <option v-for="outgoing in deployed" :key="outgoing.name" :value="outgoing.name">换下{{ outgoing.name }}</option>
          </select>
        </label>
        <button type="button" class="ra-text-button ra-danger" @click="remove">移除干员</button>
      </div>
      <div class="ra-trait-preview"
        v-html="peekFx(operator.elite ? OPERATOR[operator.name].elite : OPERATOR[operator.name].trait)"></div>
      <button type="button" class="ra-text-button" @click="$emit('details', 'op', operator.name)">打开完整详情 ↗</button>
    </template>
    <template v-else-if="equipment">
      <div class="ra-inspector-identity">
        <img :src="equipIconSrc(equipment.name)" alt="" width="48" height="48">
        <div><h3>{{ equipment.name }}</h3><p>{{ equipment.holder || '仓库 · 未携带' }}</p></div>
      </div>
      <label class="ra-holder-select">携带者
        <select :value="equipment.holder" @change="assignHolder">
          <option value="">仓库 · 未携带</option>
          <option v-for="item in run.operators" :key="item.name" :value="item.name">
            {{ item.name }} · {{ item.deployed ? '上场' : '整备区' }}
          </option>
        </select>
      </label>
      <label v-if="EQUIP[equipment.name]?.advanced" class="ra-check">
        <input type="checkbox" :checked="equipment.advanced"
          @change="advisor.setEquipmentAdvanced(equipment.id, isChecked($event))">进阶装备
      </label>
      <div class="ra-trait-preview"
        v-html="peekFx((equipment.advanced ? EQUIP[equipment.name]?.advanced : EQUIP[equipment.name]?.effect) || '')"></div>
      <div class="ra-inspector-row">
        <button type="button" class="ra-text-button" @click="$emit('details', 'eq', equipment.name)">打开装备详情 ↗</button>
        <button type="button" class="ra-text-button ra-danger" @click="remove">移除装备</button>
      </div>
    </template>
    <p class="ra-inspector-notice">{{ notice }}</p>
  </div>
</template>
