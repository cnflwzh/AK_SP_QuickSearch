<script setup lang="ts">
import {computed, ref} from 'vue';
import {BANNABLE_COVENANTS, isBannableCovenant} from '../../../data/index.ts';
import {leaderSrc} from '../../lib/ui/assets.ts';
import {color} from '../format.ts';
import {useQuickrefActions} from '../state.ts';
import {
  clearBans,
  current,
  endRun,
  presetColor,
  run,
  runBans,
  runKey,
  runLeader,
  runStats,
  toggleBan,
} from '../planStore.ts';
/** 本局提示条：当前打的流派、要用的盟约、禁池勾选与本局领袖锚点；focus = 当前正在看的盟约 */
defineProps<{focus?: string}>();
const actions = useQuickrefActions();
const banPickerOpen = ref(false);
const hasRunContext = computed(() =>
  Boolean(run.value || runBans.value.length || runLeader.value),
);
/** 优先显示终盘激活的盟约；自建尚在构筑时回退到进行中的盟约，方便直接跳去抓牌 */
const covs = computed(() => {
  const bannable = runStats.value.filter((s) => isBannableCovenant(s.name));
  const active = bannable.filter((s) => s.active);
  return active.length ? active : bannable;
});
function onEndRun(): void {
  banPickerOpen.value = false;
  endRun();
}
</script>
<template>
  <div
    v-if="hasRunContext"
    class="runb"
    :style="{'--c': run ? presetColor(run) : 'var(--accent)'}">
    <span class="k">本局</span>
    <button
      v-if="run"
      type="button"
      class="nm"
      :title="`查看「${run.plan.name}」`"
      @click="actions.openBuild(runKey)">
      {{ run.plan.name }} ▸
    </button>
    <button
      v-else
      type="button"
      class="nm muted"
      title="前往流派页选择本局要打的流派"
      @click="actions.openBuild(current.key)">
      未选流派 ▸
    </button>
    <span class="cvs">
      <button
        v-for="s in covs"
        :key="s.name"
        type="button"
        :class="[
          'c',
          {
            on: s.active,
            max: s.bonusActive,
            f: s.name === focus,
            ban: runBans.includes(s.name),
          },
        ]"
        :style="{'--c': color(s.name)}"
        :data-cv="s.name"
        data-peek="off"
        @click="actions.openCovenant(s.name)">
        {{ s.name }}
        <small>{{ s.count }}/{{ s.need }}</small>
      </button>
    </span>
    <span class="runb-tools">
      <button
        type="button"
        :class="['runb-ban-btn', {on: banPickerOpen || runBans.length > 0}]"
        :aria-expanded="banPickerOpen"
        title="标记本局被 ban 的盟约（全站图鉴、流派替补与找牌概率同步联动）"
        @click="banPickerOpen = !banPickerOpen">
        {{ runBans.length ? `禁池 ${runBans.length}` : '禁池' }}
      </button>
      <button
        v-if="runLeader"
        type="button"
        class="runb-ld"
        :title="`查看本局领袖：${runLeader.name}`"
        @click="actions.openLeader(runLeader.name)">
        <img
          :src="leaderSrc(runLeader.name)"
          alt=""
          width="18"
          height="18"
          decoding="async" />
        <span>{{ runLeader.name }}</span>
        <i v-if="runLeader.hiddenCore" title="有隐秘核心">隐</i>
      </button>
      <button
        type="button"
        class="x"
        title="结束本局（清空本局流派、禁池与领袖）"
        aria-label="结束本局"
        @click="onEndRun">
        ✕
      </button>
    </span>
    <div
      v-if="banPickerOpen"
      class="runb-bans"
      role="group"
      aria-label="标记本局禁池盟约">
      <span class="k">本局禁池</span>
      <button
        v-for="name in BANNABLE_COVENANTS"
        :key="name"
        type="button"
        :class="['bc', {on: runBans.includes(name)}]"
        :aria-pressed="runBans.includes(name)"
        :style="{'--c': color(name)}"
        @click="toggleBan(name)">
        {{ name }}
      </button>
      <button
        v-if="runBans.length"
        type="button"
        class="bc-clear"
        @click="clearBans()">
        清空
      </button>
    </div>
  </div>
</template>
