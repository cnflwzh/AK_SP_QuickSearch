<script setup lang="ts">
import {computed, ref} from 'vue';
import {
  LEADERS,
  TRAINING,
  equipmentWithRoles,
  operatorsWithRoles,
  rolesForTraining,
} from '../../../data/index.ts';
import {eq, ld, op} from '../chips.ts';
import {TRAINING_ICONS, iconSvg} from '../icons.ts';
import Markup from './Markup.ts';

const chosen = ref<number[]>([]);
const selected = ref(1);
const leader = ref('');

function shuffle() {
  const candidates = TRAINING.flatMap((entry, index) =>
    entry.randomCandidate ? [index] : [],
  );
  const picks = Array.from({length: 3}, () => {
    const index = Math.floor(Math.random() * candidates.length);
    return candidates.splice(index, 1)[0];
  });
  chosen.value = picks;
  if (!picks.includes(selected.value)) selected.value = picks[0] ?? 0;
  leader.value = LEADERS[Math.floor(Math.random() * LEADERS.length)].name;
}
shuffle();

const activeTraining = computed(() => TRAINING[selected.value] ?? TRAINING[0]);
const counterRoles = computed(() =>
  rolesForTraining(activeTraining.value.name),
);
const sampleOperators = computed(() =>
  operatorsWithRoles(counterRoles.value)
    .slice()
    .sort((a, b) => a.tier - b.tier)
    .slice(0, 6),
);
const sampleEquipment = computed(() =>
  equipmentWithRoles(counterRoles.value).slice(0, 4),
);
</script>
<template>
  <div class="row" style="justify-content: space-between; margin-bottom: 12px">
    <div class="row">
      <button
        type="button"
        class="btn"
        style="min-height: 34px"
        @click="shuffle">
        <Markup :html="iconSvg('refresh', 'g-ic sm')" />
        模拟抽一局简报
      </button>
      <span class="cnt">青色圆点为本局随机抽中的 3 类道中特训</span>
    </div>
    <span class="row" id="trLeader">
      <span class="cnt">本局领袖：</span>
      <Markup :html="ld(leader)" />
    </span>
  </div>

  <div class="tr9" id="tr9" role="group" aria-label="九类战术特训">
    <button
      v-for="(training, i) in TRAINING"
      :key="training.name"
      type="button"
      :class="{rolled: chosen.includes(i), sel: selected === i}"
      :aria-pressed="selected === i"
      :title="`${training.name}：${training.desc}`"
      @click="selected = i">
      <Markup :html="iconSvg(TRAINING_ICONS[training.name] ?? 'swords')" />
      <b>{{ training.name }}</b>
      <span class="tr-sub">{{ training.desc }}</span>
    </button>
  </div>

  <div class="tr-detail" id="waves" aria-live="polite">
    <div>
      <h5>
        <Markup
          :html="iconSvg(TRAINING_ICONS[activeTraining.name] ?? 'swords')" />
        【{{ activeTraining.name }}】特训威胁与应对
        <span v-for="tag in activeTraining.tags" :key="tag" class="tag a">
          {{ tag }}
        </span>
      </h5>
      <p>
        <b>敌方机制：</b>
        {{ activeTraining.attackStyle }}
      </p>
      <p>
        <b>实战对策：</b>
        {{ activeTraining.strategy }}
      </p>
      <div class="row">
        <span class="cnt">代表敌人：</span>
        <span v-for="enemy in activeTraining.examples" :key="enemy" class="tag">
          {{ enemy }}
        </span>
      </div>
    </div>
    <div>
      <p class="lab">推荐对策职能与代表干员 / 装备</p>
      <div class="row" style="margin-bottom: 8px">
        <span v-for="role in counterRoles" :key="role" class="tag t">
          职能：{{ role }}
        </span>
      </div>
      <div class="row">
        <Markup
          v-for="operator in sampleOperators"
          :key="operator.name"
          :html="op(operator.name)" />
      </div>
      <div v-if="sampleEquipment.length" class="row" style="margin-top: 6px">
        <Markup
          v-for="item in sampleEquipment"
          :key="item.name"
          :html="eq(item.name)" />
      </div>
    </div>
  </div>
</template>
