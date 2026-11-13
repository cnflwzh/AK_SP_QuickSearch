<script setup lang="ts">
import NavigationLink from './NavigationLink.vue';
import PrtsLink from './PrtsLink.vue';
import { cardLocation } from '../../router/navigation.ts';
import { TIER_LABELS, type Operator } from '../../../data/index.ts';
import { avatarSrc } from '../../lib/assets.ts';
import { fx } from '../format.ts';
import { useQuickrefActions } from '../state.ts';
import { inRun } from '../planStore.ts';
import Chip from './Chip.vue';
import { useWikiPanel } from '../wikiPanel.ts';
/** 干员目录和搜索结果通过 showWikiLink 开启同一套 Wiki 角标。 */
defineProps<{ operator: Operator; showElite?: boolean; showWikiLink?: boolean }>();
const actions = useQuickrefActions();
const wikiPanel = useWikiPanel();
</script>
<template>
  <article :class="['oc', { inplan: inRun.has(operator.name), 'wiki-selected': wikiPanel?.isOpen.value && wikiPanel.operatorName.value === operator.name }]" :data-key="`op:${operator.name}`" :data-t="operator.tier" :data-op="operator.name">
    <NavigationLink class="operator-card-main" :to="cardLocation('op', operator.name)" :activate="() => actions.openDetail('op', operator.name)" :aria-label="`查看${operator.name}详情`">
      <div class="h"><img v-if="avatarSrc(operator.name)" :src="avatarSrc(operator.name)" alt="" width="80" height="80" loading="lazy" decoding="async"><b>{{ operator.name }}</b><i class="tn">{{ TIER_LABELS[operator.tier] }}</i><span v-if="inRun.has(operator.name)" class="inp">✓ 本局</span></div>
      <div class="row"><Chip v-for="name in operator.covenants" :key="name" kind="cv" :name="name" static/><span class="tag">{{ operator.type }}</span></div>
      <div class="tx" v-html="fx(showElite ? operator.elite : operator.trait)"></div>
    </NavigationLink>
    <PrtsLink v-if="showWikiLink" class="operator-card-wiki" :name="operator.name"/>
  </article>
</template>

<style scoped>
/* 详情入口与站外链接并列，保留原卡片布局，避免嵌套链接。 */
.oc { cursor: default; }
.oc.wiki-selected { border-color: var(--teal); border-left-color: var(--tc); box-shadow: 0 0 0 1px var(--teal); }
.operator-card-main { display: flex; flex: 1; flex-direction: column; gap: 6px; min-width: 0; color: inherit; text-decoration: none; }
.operator-card-wiki { align-self: flex-end; }
.operator-card-main:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 3px; }
</style>
