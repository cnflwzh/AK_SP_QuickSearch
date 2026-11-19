<script setup lang="ts">
import {computed} from 'vue';
import {EQUIP, OPERATOR, TIER_LABELS} from '../../../data/index.ts';
import {avatarSrc, equipIconSrc} from '../../lib/ui/assets.ts';
import {supportsFrontTarget} from '../../lib/recommendation/live/advisorPosition.ts';
import {eliteCopyCount} from '../../lib/recommendation/live/runAdvisor.ts';
import {peekFx} from '../format.ts';
import SelectInput, {type SelectOption} from '../components/SelectInput.vue';
import {useRunAdvisor} from './useRunAdvisor.ts';
import type {AdvisorSelection} from './types.ts';

const COPY_OPTIONS: readonly SelectOption<number>[] = [
  {value: 1, label: '1 张'},
  {value: 2, label: '2 张 · 对子'},
];

const props = defineProps<{selection: AdvisorSelection}>();
const emit = defineEmits<{
  addEquipment: [holder: string];
  details: [kind: 'op' | 'eq', name: string];
  removed: [];
}>();
const advisor = useRunAdvisor();
const {run, deployed, deploymentLimit, notice} = advisor;
const operator = computed(() =>
  props.selection.kind === 'operator'
    ? run.value.operators.find((item) => item.name === props.selection.id)
    : undefined,
);
const frontChoices = computed(() =>
  deployed.value.filter((item) => item.name !== operator.value?.name),
);
const equipment = computed(() =>
  props.selection.kind === 'equipment'
    ? run.value.equipment.find((item) => item.id === props.selection.id)
    : undefined,
);
const held = computed(() =>
  run.value.equipment.filter((item) => item.holder === operator.value?.name),
);
const warehouse = computed(() =>
  run.value.equipment.filter((item) => !item.holder),
);
const warehouseOptions = computed<readonly SelectOption<string>[]>(() => [
  {value: '', label: '从仓库装备…'},
  ...warehouse.value.map((item) => ({
    value: item.id,
    label: `${item.name}${item.advanced ? ' · 进阶' : ''}`,
  })),
]);
const frontTargetOptions = computed<readonly SelectOption<string>[]>(() => [
  {value: '__unknown__', label: '未知，只计自身'},
  {value: '', label: '确认无人'},
  ...frontChoices.value.map((target) => ({
    value: target.name,
    label: target.name,
  })),
]);
const replaceOptions = computed<readonly SelectOption<string>[]>(() => [
  {value: '', label: '替换谁上场…'},
  ...deployed.value.map((outgoing) => ({
    value: outgoing.name,
    label: `换下${outgoing.name}`,
  })),
]);
const holderOptions = computed<readonly SelectOption<string>[]>(() => [
  {value: '', label: '仓库 · 未携带'},
  ...run.value.operators.map((item) => ({
    value: item.name,
    label: `${item.name} · ${item.deployed ? '上场' : '整备区'}`,
  })),
]);
const isChecked = (event: Event): boolean =>
  (event.target as HTMLInputElement).checked;
function equipFromWarehouse(id: string): void {
  if (id && operator.value) advisor.assignEquipment(id, operator.value.name);
}
function assignHolder(holder: string): void {
  if (!equipment.value) return;
  advisor.assignEquipment(equipment.value.id, holder);
}
function replace(outgoingName: string): void {
  if (outgoingName && operator.value)
    advisor.setDeployment(operator.value.name, true, outgoingName);
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
        <img :src="avatarSrc(operator.name)" alt="" width="48" height="48" />
        <div>
          <h3>
            {{ operator.name }}
            <small>{{ TIER_LABELS[OPERATOR[operator.name].tier] }} 阶</small>
          </h3>
          <p>{{ OPERATOR[operator.name].covenants.join(' · ') }}</p>
        </div>
      </div>
      <div class="ra-ownership-controls">
        <label v-if="!operator.elite && eliteCopyCount(operator.name) > 2">
          <span class="sr-only">持有张数</span>
          <SelectInput
            :model-value="operator.copies"
            :options="COPY_OPTIONS"
            aria-label="持有张数"
            @update:model-value="advisor.setCopies(operator.name, $event)" />
        </label>
        <span v-else-if="!operator.elite" class="ra-muted">两张合成精锐</span>
        <label class="ra-check">
          <input
            type="checkbox"
            :checked="operator.elite"
            @change="advisor.setElite(operator.name, isChecked($event))" />
          精锐
        </label>
        <button
          type="button"
          class="btn"
          :disabled="operator.elite"
          @click="advisor.recruit(operator.name)">
          ＋ 再抓1张
        </button>
      </div>
      <div class="ra-inspector-section">
        <h4>
          携带装备
          <small>{{ held.length }} / 2</small>
        </h4>
        <div class="ra-equipped-slots">
          <div v-for="slot in 2" :key="slot" class="ra-equipped-slot">
            <template v-if="held[slot - 1]">
              <img
                :src="equipIconSrc(held[slot - 1].name)"
                alt=""
                width="30"
                height="30" />
              <span>
                {{ held[slot - 1].name }}
                <small v-if="held[slot - 1].advanced">进阶</small>
              </span>
              <button
                type="button"
                class="ra-icon-button"
                :aria-label="`卸下${held[slot - 1].name}`"
                @click="advisor.assignEquipment(held[slot - 1].id, '')">
                ×
              </button>
            </template>
            <button
              v-else
              type="button"
              class="ra-add-equipment"
              @click="$emit('addEquipment', operator.name)">
              ＋ 装备
            </button>
          </div>
        </div>
        <label
          v-if="warehouse.length && held.length < 2"
          class="ra-warehouse-select">
          <span class="sr-only">从仓库装备</span>
          <SelectInput
            model-value=""
            :options="warehouseOptions"
            aria-label="从仓库装备"
            @update:model-value="equipFromWarehouse" />
        </label>
      </div>
      <label
        v-if="operator.deployed && supportsFrontTarget(operator.name)"
        class="ra-holder-select">
        身前一格（选填）
        <SelectInput
          :model-value="run.frontTargets[operator.name] ?? '__unknown__'"
          :options="frontTargetOptions"
          aria-label="身前一格"
          @update:model-value="
            advisor.setFrontTarget(
              operator.name,
              $event === '__unknown__' ? null : $event,
            )
          " />
      </label>
      <section class="ra-inspector-section ra-operator-trait">
        <div class="ra-section-heading">
          <h4>{{ operator.elite ? '精锐特质' : '初始特质' }}</h4>
          <button
            type="button"
            class="ra-text-button"
            @click="$emit('details', 'op', operator.name)">
            完整详情 ↗
          </button>
        </div>
        <div
          class="ra-trait-preview"
          v-html="
            peekFx(
              operator.elite
                ? OPERATOR[operator.name].elite
                : OPERATOR[operator.name].trait,
            )
          "></div>
      </section>
      <div class="ra-inspector-row ra-deployment-actions">
        <button
          v-if="operator.deployed"
          type="button"
          class="btn"
          @click="advisor.setDeployment(operator.name, false)">
          移入整备区 ↓
        </button>
        <button
          v-else-if="deployed.length < deploymentLimit"
          type="button"
          class="btn"
          @click="advisor.setDeployment(operator.name, true)">
          上场 ↑
        </button>
        <label v-else>
          <span class="sr-only">替换谁上场</span>
          <SelectInput
            model-value=""
            :options="replaceOptions"
            aria-label="替换谁上场"
            @update:model-value="replace" />
        </label>
        <button type="button" class="ra-text-button ra-danger" @click="remove">
          移除干员
        </button>
      </div>
    </template>
    <template v-else-if="equipment">
      <div class="ra-inspector-identity">
        <img
          :src="equipIconSrc(equipment.name)"
          alt=""
          width="48"
          height="48" />
        <div>
          <h3>{{ equipment.name }}</h3>
          <p>{{ equipment.holder || '仓库 · 未携带' }}</p>
        </div>
      </div>
      <label class="ra-holder-select">
        携带者
        <SelectInput
          :model-value="equipment.holder"
          :options="holderOptions"
          aria-label="携带者"
          @update:model-value="assignHolder" />
      </label>
      <label v-if="EQUIP[equipment.name]?.advanced" class="ra-check">
        <input
          type="checkbox"
          :checked="equipment.advanced"
          @change="
            advisor.setEquipmentAdvanced(equipment.id, isChecked($event))
          " />
        进阶装备
      </label>
      <div
        class="ra-trait-preview"
        v-html="
          peekFx(
            (equipment.advanced
              ? EQUIP[equipment.name]?.advanced
              : EQUIP[equipment.name]?.effect) || '',
          )
        "></div>
      <div class="ra-inspector-row">
        <button
          type="button"
          class="ra-text-button"
          @click="$emit('details', 'eq', equipment.name)">
          打开装备详情 ↗
        </button>
        <button type="button" class="ra-text-button ra-danger" @click="remove">
          移除装备
        </button>
      </div>
    </template>
    <p class="ra-inspector-notice">{{ notice }}</p>
  </div>
</template>
