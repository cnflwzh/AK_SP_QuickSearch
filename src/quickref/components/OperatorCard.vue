<script setup lang="ts">
import {computed} from 'vue';
import NavigationLink from './NavigationLink.vue';
import PrtsLink from './PrtsLink.vue';
import {cardLocation} from '../../router/navigation.ts';
import {TIER_LABELS, type Operator} from '../../../data/index.ts';
import {avatarSrc} from '../../lib/ui/assets.ts';
import {
  BOX_RANK_BORROWED,
  BOX_RANK_META,
  hasAnyBox,
  rankOfOperator,
} from '../../lib/box/index.ts';
import {settings} from '../../lib/settings/index.ts';
import {fx} from '../format.ts';
import {useQuickrefActions} from '../state.ts';
import {inRun, isRunBannedOp, runAltTargets, runSlotMap} from '../planStore.ts';
import Chip from './Chip.vue';
import {useWikiPanel} from '../wikiPanel.ts';
/** 干员目录和搜索结果通过 showWikiLink 开启同一套 Wiki 角标。 */
const props = defineProps<{
  operator: Operator;
  showElite?: boolean;
  eliteMatched?: boolean;
  showWikiLink?: boolean;
}>();
const actions = useQuickrefActions();
const wikiPanel = useWikiPanel();
const runSlot = computed(() => runSlotMap.value.get(props.operator.name));
const altTargets = computed(
  () => runAltTargets.value.get(props.operator.name) ?? [],
);
const banned = computed(() => isRunBannedOp(props.operator.name));
const boxRank = computed(() =>
  hasAnyBox.value && settings.showBoxBadges && props.operator.stars > 0
    ? rankOfOperator(props.operator.avatar)
    : -1,
);
const wikiVisible = computed(
  () => !!props.showWikiLink && settings.showWikiLinks,
);
const wikiSelected = computed(
  () =>
    !!wikiPanel?.isOpen.value &&
    wikiPanel.operatorName.value === props.operator.name,
);
</script>
<template>
  <article
    :class="[
      'oc',
      'op-card',
      {
        'has-wiki': wikiVisible,
        inplan: inRun.has(operator.name),
        inalt: !inRun.has(operator.name) && altTargets.length > 0,
        'is-banned': banned,
        'wiki-selected': wikiSelected,
      },
    ]"
    :data-key="`op:${operator.name}`"
    :data-t="operator.tier"
    :data-op="operator.name">
    <NavigationLink
      class="operator-card-main"
      :to="cardLocation('op', operator.name)"
      :activate="() => actions.openDetail('op', operator.name)"
      :aria-label="`查看${operator.name}详情`">
      <div class="h">
        <span class="op-av">
          <img
            v-if="avatarSrc(operator.name)"
            :src="avatarSrc(operator.name)"
            alt=""
            width="80"
            height="80"
            loading="lazy"
            decoding="async" />
          <i class="op-av-tier">{{ TIER_LABELS[operator.tier] }}</i>
        </span>
        <div class="op-meta">
          <div class="op-title-row">
            <b class="op-name">{{ operator.name }}</b>
            <span
              v-if="boxRank > 0 || boxRank === BOX_RANK_BORROWED"
              :class="[
                'op-box-tag',
                boxRank === BOX_RANK_BORROWED ? 'borrowed' : `r${boxRank}`,
              ]"
              :title="
                boxRank === BOX_RANK_BORROWED
                  ? '助战已借用 · 本体出战（无自持加成，等效精0）'
                  : `自持练度加成：${BOX_RANK_META[boxRank].bonusText}`
              ">
              {{ BOX_RANK_META[boxRank].shortLabel }}
            </span>
            <span v-if="banned" class="inp ban">禁池</span>
            <span v-if="runSlot" :class="['inp', {core: runSlot.core}]">
              {{ runSlot.core ? '★ 核心' : '✓ 本局' }}
            </span>
            <span v-else-if="!banned && altTargets.length" class="inp alt">
              ⇄ 替{{ altTargets[0] }}
            </span>
          </div>
          <div class="op-sub-row">
            <div class="op-covs">
              <Chip
                v-for="name in operator.covenants"
                :key="name"
                kind="cv"
                :name="name"
                static />
            </div>
            <span class="op-type-label">{{ operator.type }}</span>
            <span v-if="eliteMatched" class="tag a op-elite-hit">精锐词条</span>
          </div>
        </div>
      </div>
      <div
        class="tx op-tx"
        v-html="fx(showElite ? operator.elite : operator.trait)"></div>
    </NavigationLink>
    <PrtsLink
      v-if="showWikiLink"
      class="operator-card-wiki"
      :name="operator.name" />
  </article>
</template>

<style scoped>
/* 详情入口与站外链接并列，避免嵌套链接；头部信息与特质描述清晰分层。 */
.oc.op-card {
  cursor: default;
  border-radius: 8px;
  padding: 10px 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  transition:
    border-color 0.15s,
    box-shadow 0.15s,
    transform 0.15s;
}
.oc.op-card:hover {
  box-shadow: 0 4px 12px -6px rgba(0, 0, 0, 0.25);
}
.oc.wiki-selected {
  border-color: var(--teal);
  border-left-color: var(--tc);
  box-shadow: 0 0 0 1px var(--teal);
}
.operator-card-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  color: inherit;
  text-decoration: none;
}
.operator-card-main:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 4px;
}
.op-av {
  position: relative;
  flex: 0 0 46px;
  width: 46px;
  height: 46px;
  border-radius: 6px;
  overflow: hidden;
  background: var(--tc, var(--surface2));
  border-bottom: 3px solid var(--tc, var(--line));
}
.op-av img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  border: 0;
  border-radius: 0;
}
.op-av-tier {
  position: absolute;
  left: 0;
  top: 0;
  padding: 0 5px;
  border-bottom-right-radius: 5px;
  background: var(--tc, rgba(10, 18, 20, 0.85));
  color: #fff;
  font-style: normal;
  font: 700 10.5px/1.4 var(--fn);
  letter-spacing: 0.02em;
}
.op-meta {
  gap: 5px;
}
.op-title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
  min-width: 0;
}
.oc.op-card.has-wiki .op-title-row {
  padding-right: 54px;
}
.op-name {
  font-size: 15px;
  font-weight: 700;
  line-height: 1.25;
  color: var(--ink);
}
.op-sub-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 6px;
  min-width: 0;
}
.op-covs {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}
.op-covs :deep(.cv) {
  font-size: 11px;
  padding: 0 6px;
}
.op-type-label {
  font-size: 11px;
  color: var(--ink3);
  line-height: 1.3;
  white-space: nowrap;
}
.op-type-label::before {
  content: '·';
  margin-right: 5px;
  opacity: 0.6;
}
.op-elite-hit {
  font-size: 10.5px;
  padding: 0 5px;
}
.op-tx {
  padding-top: 7px;
  border-top: 1px solid color-mix(in srgb, var(--line) 65%, transparent);
  font-size: 12.5px;
  line-height: 1.55;
  color: var(--ink);
}
.operator-card-wiki {
  top: 7px;
  right: 8px;
  min-height: 24px;
  padding: 1px 6px;
  font-size: 11px;
  opacity: 0.78;
}
.operator-card-wiki:hover {
  opacity: 1;
}
.op-box-tag {
  --op-r1: #2563eb;
  --op-r2: #059669;
  --op-borrowed: #db2777;
  display: inline-flex;
  align-items: center;
  padding: 0 6px;
  border-radius: 4px;
  border: 1px solid var(--line);
  font-family: var(--fn);
  font-size: 11px;
  font-weight: 700;
  line-height: 1.45;
  white-space: nowrap;
}
:global(:root[data-theme='dark'] .op-box-tag) {
  --op-r1: #60a5fa;
  --op-r2: #34d399;
  --op-borrowed: #f472b6;
}
@media (prefers-color-scheme: dark) {
  :global(:root:not([data-theme='light']) .op-box-tag) {
    --op-r1: #60a5fa;
    --op-r2: #34d399;
    --op-borrowed: #f472b6;
  }
}
.op-box-tag.r1 {
  border-color: color-mix(in srgb, var(--op-r1) 50%, var(--line));
  color: var(--op-r1);
  background: color-mix(in srgb, var(--op-r1) 12%, var(--surface));
}
.op-box-tag.r2 {
  border-color: color-mix(in srgb, var(--op-r2) 50%, var(--line));
  color: var(--op-r2);
  background: color-mix(in srgb, var(--op-r2) 12%, var(--surface));
}
.op-box-tag.r3 {
  border-color: color-mix(in srgb, var(--accent) 55%, var(--line));
  color: var(--accent);
  background: var(--accent-soft);
}
.op-box-tag.borrowed {
  border-color: color-mix(in srgb, var(--op-borrowed) 52%, var(--line));
  color: var(--op-borrowed);
  background: color-mix(in srgb, var(--op-borrowed) 12%, var(--surface));
}
</style>
