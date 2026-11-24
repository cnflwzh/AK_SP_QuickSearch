<script setup lang="ts">
import {computed} from 'vue';
import {
  guideCandidates,
  guidePlanFields,
  isCurrentGuideSeason,
  sklandUrl,
  type SklandGuide,
} from '../../lib/plans/skland.ts';
import {MAX_NOTE, MAX_OPS} from '../../lib/plans/model.ts';
import SectionHeading from './SectionHeading.vue';
import StatusNotice from './StatusNotice.vue';

const props = defineProps<{guide: SklandGuide}>();
const lineupSections = computed(() => [
  props.guide.formation,
  ...props.guide.rounds,
]);
const importLimits = computed(() => {
  const guide = props.guide;
  if (!isCurrentGuideSeason(guide)) return '';
  const fields = guidePlanFields(guide);
  const notes: string[] = [];
  const skippedRounds = guide.rounds.length - fields.stages.length;
  if (skippedRounds)
    notes.push(`${skippedRounds} 个阶段的回合无效或重叠，仅保存在原文中。`);
  if (
    lineupSections.value.some(
      (lineup) =>
        Math.min(guideCandidates(guide, lineup).length, MAX_OPS) <
        lineup.operators.length,
    )
  )
    notes.push(
      `每套阵容最多导入 ${MAX_OPS} 名本赛季干员，完整推荐名单可在原文中查看。`,
    );
  const strategyCount =
    fields.strategyAlternates.length + Number(!!fields.strategy);
  if (strategyCount < guide.strategies.length)
    notes.push(
      `原文推荐 ${guide.strategies.length} 项策略，其中 ${strategyCount} 项可导入。`,
    );
  if (lineupSections.value.some((lineup) => lineup.idea.length > MAX_NOTE))
    notes.push(`单个阵容的运营思路可编辑前 ${MAX_NOTE} 字，全文保存在原文中。`);
  return notes.join('');
});
</script>

<template>
  <div class="source-guide">
    <SectionHeading :title="guide.title" :level="4" variant="plain" />
    <div class="byline">
      <span>
        森空岛
        <span v-if="guide.author">· {{ guide.author }}</span>
      </span>
      <span>{{ guide.seasonLabel || guide.version }}</span>
      <a :href="sklandUrl(guide.id)" target="_blank" rel="noopener noreferrer">
        查看原文 ↗
      </a>
    </div>
    <StatusNotice
      v-if="!isCurrentGuideSeason(guide)"
      tone="warning"
      message="该攻略属于其他赛季，可保存原文，本局规划仅支持当前赛季。" />
    <StatusNotice
      v-else-if="importLimits"
      tone="info"
      :message="importLimits" />
    <details>
      <summary>查看原文快照</summary>
      <p v-if="guide.scope">
        <b>适用范围</b>
        {{ guide.scope }}
      </p>
      <p v-if="guide.strategies.length">
        <b>策略</b>
        {{ guide.strategies.join('、') }}
      </p>
      <section v-for="(lineup, i) in lineupSections" :key="i">
        <SectionHeading
          :title="i ? `第 ${lineup.from}–${lineup.to} 回合` : '成型阵容'"
          variant="dot"
          :level="5" />
        <ul v-if="lineup.operators.length">
          <li v-for="(op, n) in lineup.operators" :key="n">
            <b>{{ op.name }}</b>
            <span v-if="op.elite">· 精锐</span>
            <small v-if="op.skill || op.module">
              {{ [op.skill, op.module].filter(Boolean).join(' · ') }}
            </small>
          </li>
        </ul>
        <p v-if="lineup.equipment.length">
          <b>推荐装备</b>
          {{ lineup.equipment.join('、') }}
        </p>
        <p v-if="lineup.bonds.length">
          <b>激活盟约</b>
          {{ lineup.bonds.join('、') }}
        </p>
        <p v-if="lineup.idea">{{ lineup.idea }}</p>
      </section>
    </details>
  </div>
</template>

<style scoped>
.source-guide {
  min-width: 0;
  overflow-wrap: anywhere;
}
.byline {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0 10px;
  color: var(--ink3);
  font-size: 13px;
}
.byline a,
summary {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  color: var(--accent);
}
summary {
  display: list-item;
  align-content: center;
  width: fit-content;
  cursor: pointer;
  font-weight: 600;
}
details section {
  margin: 6px 0 12px;
}
p {
  margin: 5px 0;
  white-space: pre-line;
  line-height: 1.6;
}
ul {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  list-style: none;
  margin: 5px 0;
  padding: 0;
}
li {
  padding: 3px 7px;
  border: 1px solid var(--line);
  border-radius: 4px;
  font-size: 13px;
}
small {
  display: block;
  color: var(--ink3);
}
</style>
