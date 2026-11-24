<script setup lang="ts">
import {computed, ref, watch} from 'vue';
import {OPERATOR} from '../../../data/index.ts';
import {
  guideCandidates,
  guidePlanFields,
  isCurrentGuideSeason,
  sklandUrl,
  type SklandGuide,
} from '../../lib/plans/skland.ts';
import {MAX_NOTE, MAX_OPS, MAX_STAGE_ROUND} from '../../lib/plans/model.ts';
import {avatarSrc, equipIconSrc} from '../../lib/ui/assets.ts';
import BuildStageSwitcher from './BuildStageSwitcher.vue';
import CovenantIcon from './CovenantIcon.vue';
import EmptyState from './EmptyState.vue';
import GlossaryText from './GlossaryText.vue';
import SectionHeading from './SectionHeading.vue';
import StatusNotice from './StatusNotice.vue';

const props = defineProps<{guide: SklandGuide}>();
const lineupSections = computed(() => [
  props.guide.formation,
  ...props.guide.rounds,
]);
const expanded = ref(false);
const stageId = ref('');
// 使用原文顺序作索引，重叠回合和仅供阅读的阶段也能逐项查看。
const stages = computed(() =>
  lineupSections.value.map((lineup, index) => ({
    id: index ? String(index) : '',
    label: index
      ? `第 ${lineup.from === lineup.to ? lineup.from : `${lineup.from}–${lineup.to}`} 回合`
      : '成型阵容',
    count: lineup.operators.length,
  })),
);
const lineup = computed(
  () => lineupSections.value[Number(stageId.value)] ?? props.guide.formation,
);
watch(
  () => props.guide,
  () => {
    stageId.value = '';
  },
);
const listedOperators = computed(() =>
  lineup.value.operators.map((op) => ({
    ...op,
    portrait: OPERATOR[op.name]?.avatar === op.id ? avatarSrc(op.name) : '',
  })),
);
const hasRoster = computed(
  () =>
    !!(
      lineup.value.operators.length ||
      lineup.value.bonds.length ||
      lineup.value.equipment.length
    ),
);
const importLimits = computed(() => {
  const guide = props.guide;
  if (!isCurrentGuideSeason(guide)) return '';
  const fields = guidePlanFields(guide);
  const notes: string[] = [];
  const skippedRounds = guide.rounds.length - fields.stages.length;
  if (
    guide.rounds.some(
      (round) => typeof round.to === 'number' && round.to > MAX_STAGE_ROUND,
    )
  )
    notes.push(
      `可编辑阵容只取第 1–${MAX_STAGE_ROUND} 回合，原文保留完整范围。`,
    );
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
  <article class="source-guide" aria-label="森空岛原文快照">
    <header class="source-head">
      <div class="source-heading">
        <div class="source-meta">
          <span class="origin">森空岛</span>
          <span v-if="guide.author">{{ guide.author }}</span>
          <span v-if="guide.seasonLabel || guide.version">
            {{ guide.seasonLabel || guide.version }}
          </span>
        </div>
        <h4>{{ guide.title }}</h4>
      </div>
      <a
        class="source-link"
        :href="sklandUrl(guide.id)"
        target="_blank"
        rel="noopener noreferrer">
        查看原文
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path
            d="M9 3h4v4m0-4L6.5 9.5M6 4H4a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-2" />
        </svg>
      </a>
    </header>
    <StatusNotice
      v-if="!isCurrentGuideSeason(guide)"
      tone="warning"
      message="该攻略属于其他赛季，可保存原文，本局规划仅支持当前赛季。" />
    <StatusNotice
      v-else-if="importLimits"
      tone="info"
      :message="importLimits" />
    <details
      @toggle="expanded = ($event.currentTarget as HTMLDetailsElement).open">
      <summary>
        <svg
          class="book"
          viewBox="0 0 20 20"
          width="18"
          height="18"
          aria-hidden="true">
          <path
            d="M10 5c-2-1.5-5-1.5-7-.8v11c2-.7 5-.7 7 .8 2-1.5 5-1.5 7-.8v-11c-2-.7-5-.7-7 .8Zm0 0v11" />
        </svg>
        <strong>原文快照</strong>
        <span class="summary-count">
          成型阵容
          <span v-if="guide.rounds.length">
            · {{ guide.rounds.length }} 个阶段
          </span>
        </span>
        <span class="chevron" aria-hidden="true"></span>
      </summary>
      <div v-if="expanded" class="source-body">
        <dl v-if="guide.scope || guide.strategies.length" class="guide-facts">
          <template v-if="guide.scope">
            <dt>适用范围</dt>
            <dd class="scope"><GlossaryText :text="guide.scope" /></dd>
          </template>
          <template v-if="guide.strategies.length">
            <dt>推荐策略</dt>
            <dd>
              <ul class="tags">
                <li
                  v-for="(name, i) in guide.strategies"
                  :key="i"
                  class="strategy">
                  {{ name }}
                </li>
              </ul>
            </dd>
          </template>
        </dl>
        <BuildStageSwitcher
          v-if="guide.rounds.length"
          v-model="stageId"
          :items="stages"
          label="原文阵容阶段" />
        <div
          :key="stageId"
          class="stage-content"
          :class="{'has-aside': listedOperators.length && lineup.idea}">
          <section v-if="listedOperators.length" class="stage-roster">
            <SectionHeading
              title="阵容干员"
              :count="listedOperators.length"
              :level="5"
              variant="plain" />
            <ul class="operator-list">
              <li v-for="(op, i) in listedOperators" :key="i" class="operator">
                <span class="portrait" aria-hidden="true">
                  <img
                    v-if="op.portrait"
                    :src="op.portrait"
                    alt=""
                    width="36"
                    height="36"
                    loading="lazy"
                    decoding="async" />
                  <span v-else>{{ Array.from(op.name)[0] }}</span>
                </span>
                <span class="op-info">
                  <span class="op-name">
                    <b>{{ op.name }}</b>
                    <small v-if="op.elite" class="elite">精锐</small>
                  </span>
                  <span v-if="op.skill" class="loadout">
                    <span class="sr-only">技能：</span>
                    {{ op.skill }}
                  </span>
                  <span v-if="op.module" class="loadout">
                    <span class="sr-only">模组：</span>
                    {{ op.module }}
                  </span>
                </span>
              </li>
            </ul>
          </section>
          <section v-if="lineup.idea" class="idea">
            <SectionHeading title="运营思路" :level="5" variant="bar" />
            <p><GlossaryText :text="lineup.idea" /></p>
          </section>
          <div
            v-if="lineup.bonds.length || lineup.equipment.length"
            class="stage-resources">
            <section v-if="lineup.bonds.length">
              <SectionHeading title="激活盟约" :level="5" variant="plain" />
              <ul class="tags">
                <li v-for="(name, i) in lineup.bonds" :key="i" class="bond">
                  <CovenantIcon
                    v-if="isCurrentGuideSeason(guide)"
                    :name="name" />
                  {{ name }}
                </li>
              </ul>
            </section>
            <section v-if="lineup.equipment.length">
              <SectionHeading title="推荐装备" :level="5" variant="plain" />
              <ul class="tags">
                <li v-for="(name, i) in lineup.equipment" :key="i" class="gear">
                  <img
                    v-if="isCurrentGuideSeason(guide) && equipIconSrc(name)"
                    :src="equipIconSrc(name)"
                    alt=""
                    width="20"
                    height="20"
                    loading="lazy"
                    decoding="async" />
                  {{ name }}
                </li>
              </ul>
            </section>
          </div>
          <EmptyState
            v-if="!hasRoster && !lineup.idea"
            message="原文未填写此阵容的内容。"
            compact />
        </div>
      </div>
    </details>
  </article>
</template>

<style scoped>
.source-guide {
  --source-tint: color-mix(in srgb, var(--accent) 5%, var(--surface));
  --source-edge: color-mix(in srgb, var(--accent) 19%, var(--line));
  --source-ink: color-mix(in srgb, var(--accent) 72%, var(--ink));
  container: skland-snapshot / inline-size;
  min-width: 0;
  border: 1px solid var(--source-edge);
  border-radius: 10px;
  background: var(--surface);
  color: var(--ink);
  overflow-wrap: anywhere;
}
.source-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 9px 9px 0 0;
  background: linear-gradient(105deg, var(--source-tint), var(--surface) 85%);
}
.source-heading {
  min-width: 0;
}
.source-meta,
.source-link,
summary,
.op-name,
.tags,
.tags li {
  display: flex;
  align-items: center;
}
.source-meta {
  gap: 2px 8px;
  flex-wrap: wrap;
  color: var(--ink2);
  font-size: 12px;
  line-height: 1.5;
}
.source-meta > span {
  max-width: 100%;
}
.source-meta > span + span::before {
  content: '·';
  margin-right: 8px;
  color: var(--ink3);
}
.origin {
  color: var(--source-ink);
  font-weight: 700;
}
.source-head h4 {
  margin: 3px 0 0;
  font: 400 clamp(16px, 3cqi, 19px)/1.2 var(--fd);
}
.source-link {
  flex: none;
  gap: 3px;
  min-height: 34px;
  padding: 0 3px;
  color: var(--ink2);
  font-size: 11px;
  font-weight: 500;
  text-decoration: none;
  border-radius: 5px;
}
.source-link svg {
  width: 11px;
  height: 11px;
}
.source-guide svg {
  flex: none;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.source-guide > :deep(.q-notice) {
  margin: 4px 12px 8px;
}
summary {
  gap: 8px;
  min-height: 40px;
  padding: 5px 16px;
  border-top: 1px solid var(--source-edge);
  border-radius: 0 0 9px 9px;
  background: var(--source-tint);
  cursor: pointer;
  list-style: none;
  transition: background-color 150ms ease;
}
summary::-webkit-details-marker {
  display: none;
}
summary strong {
  font-size: 14px;
}
.book,
.chevron {
  color: var(--source-ink);
}
.summary-count {
  margin-left: auto;
  font-size: 12px;
  color: var(--ink2);
}
.chevron {
  flex: none;
  width: 7px;
  height: 7px;
  margin: 0 3px;
  border-right: 1.5px solid;
  border-bottom: 1.5px solid;
  transform: translateY(-2px) rotate(45deg);
  transition: transform 180ms ease;
}
details[open] > summary {
  border-radius: 0;
}
details[open] .chevron {
  transform: translateY(2px) rotate(225deg);
}
@media (hover: hover) {
  summary:hover,
  .source-link:hover {
    background: var(--accent-soft);
  }
  .source-link:hover {
    color: var(--source-ink);
  }
}
summary:focus-visible,
.source-link:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
.source-body {
  display: grid;
  gap: 12px;
  padding: 12px 16px 16px;
}
.source-body :deep(.subtabs.is-l3 .subtabs-btn) {
  min-height: 34px;
}
.guide-facts {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: baseline;
  gap: 5px 12px;
  margin: 0;
  font-size: 13px;
}
.guide-facts dt {
  color: var(--ink2);
  font-size: 12px;
  font-weight: 600;
}
.guide-facts dd {
  margin: 0;
  min-width: 0;
}
.scope,
.idea p {
  white-space: pre-wrap;
}
.tags,
.operator-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.tags {
  flex-wrap: wrap;
  gap: 4px 6px;
}
.tags li {
  max-width: 100%;
  gap: 4px;
  border-radius: 4px;
  padding: 3px 7px;
  font-size: 12px;
  line-height: 1.4;
}
.strategy {
  background: var(--accent-soft);
  color: var(--source-ink);
  font-weight: 650;
}
.bond {
  background: var(--teal-soft);
  color: var(--teal);
}
.gear {
  background: var(--surface2);
  color: var(--ink2);
}
.gear img {
  flex: none;
  object-fit: contain;
}
.stage-content,
.stage-roster,
.stage-resources,
.stage-resources section {
  display: grid;
  min-width: 0;
  align-content: start;
  gap: 12px;
}
.stage-content {
  align-items: start;
  animation: snapshot-in 160ms ease-out;
}
.stage-roster,
.stage-resources section {
  gap: 6px;
}
.stage-resources {
  grid-column: 1 / -1;
}
.stage-roster :deep(.q-sechead-title),
.stage-resources :deep(.q-sechead-title) {
  color: var(--ink2);
}
.operator-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 145px), 1fr));
  gap: 5px;
}
.operator {
  display: flex;
  gap: 7px;
  align-items: center;
  min-width: 0;
  padding: 4px;
  border: 1px solid var(--line);
  border-radius: 6px;
}
.portrait {
  display: grid;
  place-items: center;
  flex: none;
  width: 36px;
  height: 36px;
  background: var(--surface2);
  color: var(--ink2);
  border-radius: 3px;
  overflow: hidden;
}
.portrait img {
  display: block;
  object-fit: cover;
}
.op-info {
  min-width: 0;
}
.op-name {
  flex-wrap: wrap;
  gap: 1px 5px;
  font-size: 14px;
  line-height: 1.4;
}
.elite {
  padding: 0 4px;
  border-radius: 3px;
  color: var(--source-ink);
  background: var(--accent-soft);
  font-size: 10px;
}
.loadout {
  display: block;
  color: var(--ink2);
  font-size: 12px;
  line-height: 1.4;
}
.idea {
  min-width: 0;
  padding: 10px 12px;
  border-radius: 6px;
  background: var(--source-tint);
}
.idea p {
  margin: 6px 0 0;
  font-size: 14px;
  line-height: 1.75;
}
@container skland-snapshot (min-width: 720px) {
  .stage-content.has-aside {
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
    column-gap: 18px;
  }
  .stage-resources section {
    grid-template-columns: auto minmax(0, 1fr);
    align-items: baseline;
    gap: 12px;
  }
  .stage-resources :deep(.q-sechead-line) {
    display: none;
  }
}
@container skland-snapshot (max-width: 440px) {
  .source-head {
    padding: 5px 10px;
    gap: 4px;
  }
  summary {
    padding: 4px 10px;
    gap: 6px;
  }
  .source-body {
    padding: 10px;
    gap: 9px;
  }
  .operator-list {
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 126px), 1fr));
  }
  .portrait,
  .portrait img {
    width: 30px;
    height: 30px;
  }
}
@media (max-height: 600px) {
  .source-head {
    padding-block: 6px;
  }
  summary {
    min-height: 34px;
  }
  .source-body {
    gap: 8px;
    padding-block: 8px;
  }
}
@keyframes snapshot-in {
  from {
    opacity: 0;
    transform: translateY(3px);
  }
}
@media (prefers-reduced-motion: reduce) {
  summary,
  .chevron,
  .stage-content {
    transition: none;
    animation: none;
  }
}
:global(:root[data-motion='reduce'] .source-guide summary),
:global(:root[data-motion='reduce'] .source-guide .chevron),
:global(:root[data-motion='reduce'] .source-guide .stage-content) {
  transition: none;
  animation: none;
}
</style>
