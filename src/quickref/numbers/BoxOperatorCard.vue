<script setup lang="ts">
import {computed} from 'vue';
import {TIER_LABELS, type Operator} from '../../../data/index.ts';
import {
  BOX_RANK_BORROWED,
  BOX_RANK_META,
  isBorrowableSixStar,
  type BoxRank,
} from '../../lib/box/model.ts';
import {avatarSrc} from '../../lib/ui/assets.ts';
import {color} from '../format.ts';
import {useQuickrefActions} from '../state.ts';

const props = defineProps<{
  op: Operator;
  rank: BoxRank;
  brush?: BoxRank;
  hideTier?: boolean;
}>();
const emit = defineEmits<{activate: [op: Operator]}>();
const actions = useQuickrefActions();
const borrowable = computed(() => isBorrowableSixStar(props.op));
const dimmed = computed(
  () =>
    props.brush === BOX_RANK_BORROWED && (!borrowable.value || props.rank >= 0),
);

const primaryTag = computed(() => {
  if (props.rank === 3) return '精二 60 · 满加成';
  if (props.rank === 2) return '精英二 · 已激活';
  if (props.rank === 1) return '精英一 · 已激活';
  if (props.rank === 0) return '已持未练 · 精0';
  if (props.rank === BOX_RANK_BORROWED) return '已借用 · 助战 6★';
  if (borrowable.value) return '未借用 · 可借 6★';
  if (props.op.stars === 6) return '特许 6★ · 系统预设';
  return `系统预设 · ${props.op.stars}★`;
});

const subText = computed(() => {
  if (props.rank >= 0) return BOX_RANK_META[props.rank].bonusText;
  if (props.rank === BOX_RANK_BORROWED) return '本体出战 · 无加成(等效精0)';
  if (borrowable.value) {
    return props.op.backupOperator
      ? `可借助战 · 不借替为 ${props.op.backupOperator}`
      : '可借同名助战补位';
  }
  return props.op.stars === 6 ? '自带本体 · 无需借用' : '自带本体 · 无自持加成';
});

const tone = computed(() => {
  if (props.rank >= 0) return `rank-${props.rank}`;
  if (props.rank === BOX_RANK_BORROWED) return 'rank-borrowed';
  if (borrowable.value) return 'rank-unborrowed';
  return props.op.stars === 6 ? 'rank-preset6' : 'rank-preset';
});

const title = computed(() => {
  const {op, brush} = props;
  let action = '点击查看干员详情';
  if (brush !== undefined)
    action = dimmed.value
      ? '该干员无需借用'
      : `点击标为「${BOX_RANK_META[brush].label}」`;
  return `${op.name}（${TIER_LABELS[op.tier]}阶 ${op.stars}★）：${primaryTag.value} · ${subText.value}｜${action}`;
});
</script>

<template>
  <article
    :class="['bx-card', tone, {dimmed, 'is-edit': brush !== undefined}]"
    :data-t="op.tier">
    <button
      type="button"
      class="bx-card-main"
      :aria-pressed="brush !== undefined ? rank !== -1 : undefined"
      :title="title"
      @click="emit('activate', op)">
      <span class="bx-av">
        <img
          :src="avatarSrc(op.name)"
          alt=""
          width="44"
          height="44"
          loading="lazy"
          decoding="async" />
        <b v-if="!hideTier" class="bx-av-tier">{{ TIER_LABELS[op.tier] }}</b>
      </span>
      <span class="bx-meta">
        <span class="bx-name-row">
          <strong class="bx-name">{{ op.name }}</strong>
          <span class="bx-dots" aria-hidden="true">
            <u
              v-for="cov in op.covenants"
              :key="cov"
              :style="{'--c': color(cov)}"></u>
          </span>
        </span>
        <span class="bx-status-row">
          <span class="bx-tag">{{ primaryTag }}</span>
        </span>
        <small class="bx-sub-text">{{ subText }}</small>
      </span>
    </button>
    <button
      v-if="brush !== undefined"
      type="button"
      class="bx-detail-btn"
      :aria-label="`查看${op.name}干员详情`"
      title="查看干员详情"
      @click="actions.openDetail('op', op.name)">
      i
    </button>
  </article>
</template>

<style scoped>
.bx-card {
  position: relative;
  display: flex;
  align-items: stretch;
  border: 1px solid var(--line);
  border-left: 3px solid var(--line2);
  border-radius: 8px;
  background: var(--surface);
  overflow: hidden;
  transition:
    border-color 0.14s,
    background-color 0.14s,
    opacity 0.14s,
    transform 0.12s;
}
.bx-card.dimmed {
  opacity: 0.42;
}
@media (hover: hover) {
  .bx-card:hover {
    border-color: var(--teal);
    transform: translateY(-1px);
  }
  .bx-card.is-edit:not(.dimmed):hover {
    border-color: var(--accent);
  }
}

/* 所有局内可用本体的类别均为彩色卡片+彩色头像；仅未借用 6★（局内无法用本体）置灰 */
.bx-card.rank-3 {
  border-color: color-mix(in srgb, var(--bx-r3) 56%, var(--line));
  border-left-color: var(--bx-r3);
  background: color-mix(in srgb, var(--bx-r3) 10%, var(--surface));
}
.bx-card.rank-2 {
  border-color: color-mix(in srgb, var(--bx-r2) 52%, var(--line));
  border-left-color: var(--bx-r2);
  background: color-mix(in srgb, var(--bx-r2) 9%, var(--surface));
}
.bx-card.rank-1 {
  border-color: color-mix(in srgb, var(--bx-r1) 50%, var(--line));
  border-left-color: var(--bx-r1);
  background: color-mix(in srgb, var(--bx-r1) 8%, var(--surface));
}
.bx-card.rank-0 {
  border-color: color-mix(in srgb, var(--bx-r0) 50%, var(--line));
  border-left-color: var(--bx-r0);
  background: color-mix(in srgb, var(--bx-r0) 8%, var(--surface));
}
.bx-card.rank-borrowed {
  border-color: color-mix(in srgb, var(--bx-borrowed) 58%, var(--line));
  border-left-color: var(--bx-borrowed);
  background: color-mix(in srgb, var(--bx-borrowed) 10%, var(--surface));
}
.bx-card.rank-preset6 {
  border-color: color-mix(in srgb, var(--bx-preset) 56%, var(--line));
  border-left-color: var(--bx-preset);
  background: color-mix(in srgb, var(--bx-preset) 10%, var(--surface));
}
.bx-card.rank-preset {
  border-color: color-mix(in srgb, var(--bx-preset) 42%, var(--line));
  border-left-color: var(--bx-preset);
  background: color-mix(in srgb, var(--bx-preset) 6%, var(--surface));
}
/* 唯一灰色状态：未持有且未借用的 6★，局内无法使用本体，会被替换为原型/预备干员 */
.bx-card.rank-unborrowed {
  border-style: dashed;
  border-left-style: dashed;
  border-color: color-mix(in srgb, var(--bx-unborrowed) 55%, var(--line));
  border-left-color: var(--bx-unborrowed);
  background: color-mix(in srgb, var(--surface2) 82%, var(--surface));
}

.bx-card-main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 9px 7px 8px;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  font: inherit;
}
.bx-av {
  position: relative;
  flex: 0 0 42px;
  width: 42px;
  height: 42px;
  border-radius: 6px;
  overflow: hidden;
  border: 1.5px solid var(--tc, var(--line));
  background: var(--surface2);
}
.bx-av img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.bx-av-tier {
  position: absolute;
  left: 0;
  top: 0;
  padding: 0 4px;
  border-bottom-right-radius: 4px;
  background: rgba(10, 18, 20, 0.78);
  color: #f0f4f3;
  font: 700 10px/1.35 var(--fn);
}
.bx-card.rank-borrowed .bx-av {
  border-color: var(--bx-borrowed);
}
.bx-card.rank-preset .bx-av,
.bx-card.rank-preset6 .bx-av {
  border-color: color-mix(in srgb, var(--bx-preset) 72%, var(--line));
}
.bx-card.rank-unborrowed .bx-av {
  border-color: var(--bx-unborrowed);
}
.bx-card.rank-unborrowed .bx-av img {
  filter: grayscale(0.92);
  opacity: 0.48;
}

.bx-meta {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 2px;
}
.bx-name-row {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
}
.bx-name {
  font-size: 13px;
  line-height: 1.25;
  color: var(--ink);
  overflow-wrap: anywhere;
}
.bx-card.rank-unborrowed .bx-name {
  color: var(--ink3);
}
.bx-dots {
  display: inline-flex;
  gap: 3px;
  flex: none;
}
.bx-dots u {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--c, var(--teal));
}
.bx-card.rank-unborrowed .bx-dots {
  opacity: 0.42;
}
.bx-status-row {
  display: flex;
  align-items: center;
  gap: 4px;
}
.bx-tag {
  display: inline-block;
  width: fit-content;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10.5px;
  font-weight: 700;
  line-height: 1.35;
  background: var(--surface2);
  color: var(--ink3);
}
.bx-card.rank-3 .bx-tag {
  background: var(--bx-r3);
  color: var(--bx-r3-ink);
}
.bx-card.rank-2 .bx-tag {
  background: color-mix(in srgb, var(--bx-r2) 18%, var(--surface));
  color: var(--bx-r2);
}
.bx-card.rank-1 .bx-tag {
  background: color-mix(in srgb, var(--bx-r1) 18%, var(--surface));
  color: var(--bx-r1);
}
.bx-card.rank-0 .bx-tag {
  background: color-mix(in srgb, var(--bx-r0) 18%, var(--surface));
  color: var(--bx-r0);
}
.bx-card.rank-borrowed .bx-tag {
  background: var(--bx-borrowed);
  color: var(--bx-borrowed-ink);
}
.bx-card.rank-preset6 .bx-tag {
  background: var(--bx-preset);
  color: var(--bx-preset-ink);
}
.bx-card.rank-preset .bx-tag {
  background: color-mix(in srgb, var(--bx-preset) 18%, var(--surface));
  color: var(--bx-preset);
}
.bx-card.rank-unborrowed .bx-tag {
  background: color-mix(in srgb, var(--bx-unborrowed) 16%, var(--surface));
  color: var(--bx-unborrowed);
  border: 1px dashed color-mix(in srgb, var(--bx-unborrowed) 48%, transparent);
}
.bx-sub-text {
  font: 500 10.5px/1.25 var(--fn);
  color: var(--ink3);
  overflow-wrap: anywhere;
}
.bx-card.rank-3 .bx-sub-text {
  color: var(--bx-r3);
}
.bx-card.rank-2 .bx-sub-text {
  color: var(--bx-r2);
}
.bx-card.rank-1 .bx-sub-text {
  color: var(--bx-r1);
}
.bx-card.rank-0 .bx-sub-text {
  color: var(--bx-r0);
}
.bx-card.rank-borrowed .bx-sub-text {
  color: var(--bx-borrowed);
}
.bx-card.rank-preset .bx-sub-text,
.bx-card.rank-preset6 .bx-sub-text {
  color: var(--bx-preset);
}
.bx-card.rank-unborrowed .bx-sub-text {
  color: var(--bx-unborrowed);
}

.bx-detail-btn {
  flex: 0 0 34px;
  width: 34px;
  border: 0;
  border-left: 1px solid var(--line);
  background: transparent;
  color: var(--ink3);
  font: 700 12px var(--fb);
  display: grid;
  place-items: center;
}
.bx-detail-btn:hover {
  background: var(--surface2);
  color: var(--accent);
}

@media (max-height: 600px) {
  .bx-card-main {
    padding: 5px 7px 5px 6px;
    gap: 7px;
  }
  .bx-av {
    flex-basis: 36px;
    width: 36px;
    height: 36px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .bx-card {
    transition: none;
  }
}
:global(:root[data-motion='reduce'] .bx-card) {
  transition: none;
}
</style>
