<script setup lang="ts">
import {computed} from 'vue';
import NavigationLink from './NavigationLink.vue';
import PrtsLink from './PrtsLink.vue';
import {cardLocation} from '../../router/navigation.ts';
import {TIER_LABELS, type Operator} from '../../../data/index.ts';
import {avatarSrc} from '../../lib/ui/assets.ts';
import {
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
        <img
          v-if="avatarSrc(operator.name)"
          :src="avatarSrc(operator.name)"
          alt=""
          width="80"
          height="80"
          loading="lazy"
          decoding="async" />
        <div class="op-meta">
          <div class="op-title-row">
            <i class="tn">{{ TIER_LABELS[operator.tier] }}</i>
            <b>{{ operator.name }}</b>
            <span v-if="banned" class="inp ban">禁池</span>
            <span v-if="runSlot" class="inp">
              {{ runSlot.core ? '★ 本局核心' : '✓ 本局' }}
            </span>
            <span v-else-if="!banned && altTargets.length" class="inp alt">
              ⇄ 备选·替{{ altTargets[0] }}
            </span>
          </div>
          <div class="op-tags">
            <Chip
              v-for="name in operator.covenants"
              :key="name"
              kind="cv"
              :name="name"
              static />
            <span class="tag">{{ operator.type }}</span>
            <span
              v-if="boxRank > 0"
              :class="['tag', 'op-box-tag', `r${boxRank}`]"
              :title="`自持练度加成：${BOX_RANK_META[boxRank].bonusText}`">
              {{ BOX_RANK_META[boxRank].shortLabel }}
            </span>
            <span v-if="eliteMatched" class="tag a">精锐词条</span>
          </div>
        </div>
      </div>
      <div
        class="tx"
        v-html="fx(showElite ? operator.elite : operator.trait)"></div>
    </NavigationLink>
    <PrtsLink
      v-if="showWikiLink"
      class="operator-card-wiki"
      :name="operator.name" />
  </article>
</template>

<style scoped>
/* 详情入口与站外链接并列，保留原卡片布局，避免嵌套链接。 */
.oc {
  cursor: default;
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
  gap: 6px;
  min-width: 0;
  color: inherit;
  text-decoration: none;
}
.operator-card-main:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 3px;
}
.op-box-tag {
  --op-r1: #2563eb;
  --op-r2: #059669;
  font-family: var(--fn);
  font-weight: 700;
}
:global(:root[data-theme='dark']) .op-box-tag {
  --op-r1: #60a5fa;
  --op-r2: #34d399;
}
@media (prefers-color-scheme: dark) {
  :global(:root:not([data-theme='light'])) .op-box-tag {
    --op-r1: #60a5fa;
    --op-r2: #34d399;
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
</style>
