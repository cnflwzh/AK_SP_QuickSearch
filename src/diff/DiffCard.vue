<script setup lang="ts">
import {computed, ref} from 'vue';
import type {Covenant} from '../../data/index.ts';
import type {
  EntitySideSnapshot,
  VisualDiffEntry,
  VisualDiffRow,
} from './comparison.ts';
import {formatDiffPlainHtml, formatDiffSegmentsHtml} from './tokenDiff.ts';

const props = defineProps<{
  entry: VisualDiffEntry;
  fromLabel: string;
  toLabel: string;
  viewMode: 'split' | 'unified';
  covenants: Readonly<Record<string, Covenant>>;
}>();

const expandedContext = ref(false);

const STATUS_META = {
  added: {label: '+ 新增', cls: 'is-added'},
  modified: {label: '~ 调整', cls: 'is-modified'},
  removed: {label: '− 移除', cls: 'is-removed'},
  unchanged: {label: '= 未变', cls: 'is-unchanged'},
} as const;

const SUBKIND_LABEL = {
  covenant: '盟约',
  strategy: '开局策略',
  equipment: '装备',
  operator: '干员',
  leader: 'Boss 领袖',
  bounty: '悬赏敌人',
  'global-rule': '全局规则',
} as const;

const statusInfo = computed(() => STATUS_META[props.entry.status]);
const unifiedSide = computed(() => props.entry.right ?? props.entry.left);

const visibleRows = computed<readonly VisualDiffRow[]>(() => {
  if (
    props.entry.status !== 'modified' ||
    expandedContext.value ||
    props.entry.unchangedCount <= 1
  ) {
    return props.entry.rows;
  }
  return props.entry.rows.filter((row) => row.changed);
});

const hiddenContextCount = computed(() =>
  props.entry.status === 'modified' &&
  !expandedContext.value &&
  props.entry.unchangedCount > 1
    ? props.entry.unchangedCount
    : 0,
);

function leftRowHtml(row: VisualDiffRow): string {
  if (row.before === null) return '';
  if (row.tokenDiff) {
    return formatDiffSegmentsHtml(row.tokenDiff.left, props.covenants);
  }
  return formatDiffPlainHtml(row.before, props.covenants);
}

function rightRowHtml(row: VisualDiffRow): string {
  if (row.after === null) return '';
  if (row.tokenDiff) {
    return formatDiffSegmentsHtml(row.tokenDiff.right, props.covenants);
  }
  return formatDiffPlainHtml(row.after, props.covenants);
}

function sideIconClass(side: EntitySideSnapshot): string {
  return `df-avatar is-${side.iconKind}`;
}
</script>

<template>
  <article :class="['df-card', statusInfo.cls]">
    <!-- Git 文件头风格顶栏 -->
    <header class="df-card-head">
      <span :class="['df-status-pill', statusInfo.cls]">
        {{ statusInfo.label }}
      </span>
      <b class="df-card-title">{{ entry.name }}</b>
      <span class="df-subkind-tag">{{ SUBKIND_LABEL[entry.subKind] }}</span>

      <span class="df-card-spacer" aria-hidden="true"></span>

      <span v-if="entry.status === 'modified'" class="df-card-stat">
        {{ entry.changedCount }} 项变更
      </span>
      <button
        v-if="entry.status === 'modified' && entry.unchangedCount > 1"
        type="button"
        class="df-context-btn"
        :aria-expanded="expandedContext"
        @click="expandedContext = !expandedContext">
        {{
          expandedContext
            ? '收起未变字段'
            : `展开 ${hiddenContextCount} 项未变字段`
        }}
      </button>
    </header>

    <!-- 模式 A：图形化左右双栏对比（Split Diff） -->
    <div v-if="viewMode === 'split'" class="df-split">
      <!-- 第 0 行：左右实体头部名片对照 -->
      <div class="df-pair df-id-pair">
        <div
          :class="[
            'df-cell',
            'df-id-cell',
            'is-left',
            {
              'is-empty': !entry.left,
              'is-tinted': entry.status === 'removed',
            },
          ]"
          :data-t="entry.left?.tier">
          <template v-if="entry.left">
            <span class="df-gutter" aria-hidden="true">
              {{ entry.status === 'unchanged' ? ' ' : '−' }}
            </span>
            <span
              v-if="entry.left.iconSrc"
              :class="sideIconClass(entry.left)"
              :style="
                entry.left.accentColor
                  ? {'--c': entry.left.accentColor}
                  : undefined
              ">
              <img
                :src="entry.left.iconSrc"
                alt=""
                width="40"
                height="40"
                loading="lazy"
                decoding="async" />
            </span>
            <span v-else class="df-rule-glyph" aria-hidden="true">⚙</span>
            <div class="df-id-meta">
              <div class="df-id-badges">
                <span
                  v-for="(badge, bIdx) in entry.left.badges"
                  :key="bIdx"
                  :class="[
                    'df-mini-badge',
                    badge.tone ? `is-${badge.tone}` : '',
                  ]"
                  :data-t="badge.tier">
                  {{ badge.label }}
                </span>
              </div>
              <div v-if="entry.left.covenantChips.length" class="df-cov-row">
                <span
                  v-for="chip in entry.left.covenantChips"
                  :key="chip.name"
                  :class="[
                    'df-cov-chip',
                    chip.diffState === 'removed' ? 'is-del' : '',
                  ]"
                  :style="{'--c': chip.color}">
                  <i
                    v-if="chip.iconSrc"
                    class="cv-ic"
                    :style="{'--cv-ic': `url('${chip.iconSrc}')`}"
                    aria-hidden="true"></i>
                  {{ chip.name }}
                </span>
              </div>
            </div>
          </template>
          <div v-else class="df-empty-pane">
            <span>∅ {{ fromLabel }} 未收录</span>
          </div>
        </div>

        <div
          :class="[
            'df-cell',
            'df-id-cell',
            'is-right',
            {
              'is-empty': !entry.right,
              'is-tinted': entry.status === 'added',
            },
          ]"
          :data-t="entry.right?.tier">
          <template v-if="entry.right">
            <span class="df-gutter" aria-hidden="true">
              {{ entry.status === 'unchanged' ? ' ' : '+' }}
            </span>
            <span
              v-if="entry.right.iconSrc"
              :class="sideIconClass(entry.right)"
              :style="
                entry.right.accentColor
                  ? {'--c': entry.right.accentColor}
                  : undefined
              ">
              <img
                :src="entry.right.iconSrc"
                alt=""
                width="40"
                height="40"
                loading="lazy"
                decoding="async" />
            </span>
            <span v-else class="df-rule-glyph" aria-hidden="true">⚙</span>
            <div class="df-id-meta">
              <div class="df-id-badges">
                <span
                  v-for="(badge, bIdx) in entry.right.badges"
                  :key="bIdx"
                  :class="[
                    'df-mini-badge',
                    badge.tone ? `is-${badge.tone}` : '',
                  ]"
                  :data-t="badge.tier">
                  {{ badge.label }}
                </span>
              </div>
              <div v-if="entry.right.covenantChips.length" class="df-cov-row">
                <span
                  v-for="chip in entry.right.covenantChips"
                  :key="chip.name"
                  :class="[
                    'df-cov-chip',
                    chip.diffState === 'added' ? 'is-add' : '',
                  ]"
                  :style="{'--c': chip.color}">
                  <i
                    v-if="chip.iconSrc"
                    class="cv-ic"
                    :style="{'--cv-ic': `url('${chip.iconSrc}')`}"
                    aria-hidden="true"></i>
                  {{ chip.name }}
                </span>
              </div>
            </div>
          </template>
          <div v-else class="df-empty-pane">
            <span>∅ {{ toLabel }} 已移出</span>
          </div>
        </div>
      </div>

      <!-- 第 1..N 行：逐字段水平对齐 Hunk 行 -->
      <div
        v-for="row in visibleRows"
        :key="row.key"
        :class="['df-pair', 'df-field-pair', {changed: row.changed}]">
        <!-- 左侧（Before） -->
        <div
          :class="[
            'df-cell',
            'df-field-cell',
            'is-left',
            {
              'is-del': row.changed && row.before !== null,
              'is-empty': row.before === null,
            },
          ]">
          <span class="df-gutter" aria-hidden="true">
            {{ row.before === null ? '' : row.changed ? '−' : ' ' }}
          </span>
          <div v-if="row.before !== null" class="df-field-content">
            <span class="df-field-label">{{ row.label }}</span>
            <div class="df-field-text" v-html="leftRowHtml(row)"></div>
          </div>
          <div v-else class="df-field-void">
            <span class="df-field-label muted">{{ row.label }}</span>
            <span class="df-void-dash">— 无 —</span>
          </div>
        </div>

        <!-- 右侧（After） -->
        <div
          :class="[
            'df-cell',
            'df-field-cell',
            'is-right',
            {
              'is-add': row.changed && row.after !== null,
              'is-empty': row.after === null,
            },
          ]">
          <span class="df-gutter" aria-hidden="true">
            {{ row.after === null ? '' : row.changed ? '+' : ' ' }}
          </span>
          <div v-if="row.after !== null" class="df-field-content">
            <div class="df-field-head">
              <span class="df-field-label">{{ row.label }}</span>
              <span
                v-if="row.delta"
                :class="['df-delta-pill', `is-${row.delta.tone}`]">
                {{ row.delta.text }}
              </span>
            </div>
            <div class="df-field-text" v-html="rightRowHtml(row)"></div>
          </div>
          <div v-else class="df-field-void">
            <span class="df-field-label muted">{{ row.label }}</span>
            <span class="df-void-dash">— 已移除 —</span>
          </div>
        </div>
      </div>

      <!-- 折叠行提示条（Git @@ Hunk 风格） -->
      <button
        v-if="hiddenContextCount > 0"
        type="button"
        class="df-hunk-fold"
        @click="expandedContext = true">
        @@ 展开其余 {{ hiddenContextCount }} 项未变动属性 @@
      </button>
    </div>

    <!-- 模式 B：单栏上下合并视图（Unified Diff） -->
    <div v-else class="df-unified">
      <div class="df-uni-id" :data-t="unifiedSide?.tier">
        <template v-if="unifiedSide">
          <span
            v-if="unifiedSide.iconSrc"
            :class="sideIconClass(unifiedSide)"
            :style="
              unifiedSide.accentColor
                ? {'--c': unifiedSide.accentColor}
                : undefined
            ">
            <img
              :src="unifiedSide.iconSrc"
              alt=""
              width="38"
              height="38"
              loading="lazy"
              decoding="async" />
          </span>
          <span v-else class="df-rule-glyph" aria-hidden="true">⚙</span>
          <div class="df-id-badges">
            <span
              v-for="(badge, bIdx) in unifiedSide.badges"
              :key="bIdx"
              :class="['df-mini-badge', badge.tone ? `is-${badge.tone}` : '']"
              :data-t="badge.tier">
              {{ badge.label }}
            </span>
          </div>
          <div v-if="unifiedSide.covenantChips.length" class="df-cov-row">
            <span
              v-for="chip in unifiedSide.covenantChips"
              :key="chip.name"
              class="df-cov-chip"
              :style="{'--c': chip.color}">
              <i
                v-if="chip.iconSrc"
                class="cv-ic"
                :style="{'--cv-ic': `url('${chip.iconSrc}')`}"
                aria-hidden="true"></i>
              {{ chip.name }}
            </span>
          </div>
        </template>
      </div>

      <template v-for="row in visibleRows" :key="row.key">
        <div
          v-if="row.before !== null && (row.changed || row.after === null)"
          class="df-uni-line is-del">
          <span class="df-gutter" aria-hidden="true">−</span>
          <span class="df-uni-side">{{ fromLabel }}</span>
          <span class="df-field-label">{{ row.label }}</span>
          <div class="df-field-text" v-html="leftRowHtml(row)"></div>
        </div>
        <div
          v-if="row.after !== null"
          :class="['df-uni-line', row.changed ? 'is-add' : 'is-ctx']">
          <span class="df-gutter" aria-hidden="true">
            {{ row.changed ? '+' : ' ' }}
          </span>
          <span v-if="row.changed" class="df-uni-side">{{ toLabel }}</span>
          <span class="df-field-label">{{ row.label }}</span>
          <span
            v-if="row.delta"
            :class="['df-delta-pill', `is-${row.delta.tone}`]">
            {{ row.delta.text }}
          </span>
          <div class="df-field-text" v-html="rightRowHtml(row)"></div>
        </div>
      </template>

      <button
        v-if="hiddenContextCount > 0"
        type="button"
        class="df-hunk-fold"
        @click="expandedContext = true">
        @@ 展开其余 {{ hiddenContextCount }} 项未变动属性 @@
      </button>
    </div>
  </article>
</template>

<style scoped>
.df-card {
  background: var(--surface);
  border: 1px solid var(--line2);
  border-radius: 9px;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(18, 34, 32, 0.05);
}

.df-card.is-added {
  border-color: var(--df-add-border);
}
.df-card.is-removed {
  border-color: var(--df-del-border);
}
.df-card.is-modified {
  border-color: color-mix(in srgb, var(--accent) 34%, var(--line2));
}

/* 文件头 */
.df-card-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 8px;
  padding: 7px 11px;
  background: var(--surface2);
  border-bottom: 1px solid var(--line);
}

.df-status-pill {
  font-family: var(--fn);
  font-size: 12px;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 4px;
  white-space: nowrap;
}
.df-status-pill.is-added {
  background: var(--df-add-bg-strong);
  color: var(--df-add-ink);
}
.df-status-pill.is-modified {
  background: var(--df-mod-bg);
  color: var(--df-mod-ink);
}
.df-status-pill.is-removed {
  background: var(--df-del-bg-strong);
  color: var(--df-del-ink);
}
.df-status-pill.is-unchanged {
  background: color-mix(in srgb, var(--line) 55%, transparent);
  color: var(--ink3);
}

.df-card-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--ink);
  line-height: 1.3;
}

.df-subkind-tag {
  font-size: 11.5px;
  padding: 0 6px;
  border-radius: 4px;
  background: var(--surface);
  border: 1px solid var(--line);
  color: var(--ink3);
  white-space: nowrap;
}

.df-card-spacer {
  flex: 1 1 auto;
}

.df-card-stat {
  font-family: var(--fn);
  font-size: 12px;
  font-weight: 600;
  color: var(--ink3);
  white-space: nowrap;
}

.df-context-btn {
  min-height: 34px;
  padding: 2px 8px;
  border-radius: 5px;
  border: 1px solid var(--line2);
  background: var(--surface);
  color: var(--ink2);
  font-size: 11.5px;
  cursor: pointer;
  white-space: nowrap;
  transition:
    border-color 0.14s ease,
    color 0.14s ease;
}
.df-context-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

/* Split 双栏对齐网格 */
.df-pair {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}

.df-pair + .df-pair {
  border-top: 1px solid color-mix(in srgb, var(--line) 75%, transparent);
}

.df-cell {
  display: flex;
  align-items: stretch;
  min-width: 0;
}

.df-cell.is-left {
  border-right: 1px solid var(--line);
}

.df-cell.is-empty {
  background-image: var(--df-empty-stripe);
}

.df-gutter {
  flex: 0 0 22px;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 8px;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 13px;
  font-weight: 700;
  color: var(--ink3);
  user-select: none;
  border-right: 1px solid color-mix(in srgb, var(--line) 55%, transparent);
}

/* 头部名片行 */
.df-id-cell {
  align-items: center;
  gap: 8px;
  padding-right: 10px;
  min-height: 52px;
  background: color-mix(in srgb, var(--surface2) 45%, var(--surface));
}
.df-id-cell .df-gutter {
  align-self: stretch;
  align-items: center;
  padding-top: 0;
}
.df-id-cell.is-left.is-tinted {
  background: var(--df-del-bg);
}
.df-id-cell.is-left.is-tinted .df-gutter {
  background: var(--df-del-gutter);
  color: var(--df-del-ink);
}
.df-id-cell.is-right.is-tinted {
  background: var(--df-add-bg);
}
.df-id-cell.is-right.is-tinted .df-gutter {
  background: var(--df-add-gutter);
  color: var(--df-add-ink);
}

.df-avatar {
  flex: 0 0 38px;
  width: 38px;
  height: 38px;
  border-radius: 6px;
  overflow: hidden;
  display: grid;
  place-items: center;
  margin-block: 6px;
  background: var(--tc, var(--surface2));
}
.df-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.df-avatar.is-covenant {
  padding: 5px;
  background: radial-gradient(
    circle at 50% 35%,
    color-mix(in srgb, var(--c, var(--teal)) 44%, #182628),
    #0d1618
  );
  border: 1px solid color-mix(in srgb, var(--c, var(--teal)) 55%, transparent);
}
.df-avatar.is-covenant img,
.df-avatar.is-equipment img {
  object-fit: contain;
}
.df-avatar.is-equipment {
  background: radial-gradient(
    circle at 50% 40%,
    color-mix(in srgb, var(--tc, #666) 55%, #fff 10%),
    var(--tc, #555)
  );
}
.df-avatar.is-operator {
  border-bottom: 2.5px solid var(--tc, var(--line2));
}
.df-avatar.is-leader {
  background: radial-gradient(
    circle at 50% 38%,
    color-mix(in srgb, var(--red) 38%, #1c1010),
    #120b0b
  );
  border: 1px solid color-mix(in srgb, var(--red) 55%, transparent);
}

.df-rule-glyph {
  flex: 0 0 34px;
  width: 34px;
  height: 34px;
  margin-block: 6px;
  border-radius: 6px;
  display: grid;
  place-items: center;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 17px;
}

.df-id-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-block: 6px;
  min-width: 0;
}

.df-id-badges,
.df-cov-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.df-mini-badge {
  font-size: 11px;
  line-height: 1.45;
  padding: 0 6px;
  border-radius: 3px;
  background: var(--surface);
  border: 1px solid var(--line);
  color: var(--ink2);
  white-space: nowrap;
}
.df-mini-badge.is-tier {
  font-family: var(--fn);
  font-weight: 700;
  background: var(--tc, #666);
  border-color: transparent;
  color: #fff;
}
.df-mini-badge.is-accent {
  background: var(--accent-soft);
  border-color: color-mix(in srgb, var(--accent) 40%, transparent);
  color: var(--ink);
}
.df-mini-badge.is-teal {
  background: var(--teal-soft);
  border-color: color-mix(in srgb, var(--teal) 40%, transparent);
  color: var(--ink);
}
.df-mini-badge.is-red {
  background: color-mix(in srgb, var(--red) 12%, transparent);
  border-color: color-mix(in srgb, var(--red) 40%, transparent);
  color: var(--ink);
}

.df-cov-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  padding: 0 7px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--c) 52%, transparent);
  background: color-mix(in srgb, var(--c) 14%, transparent);
  color: var(--ink);
  white-space: nowrap;
}
.df-cov-chip.is-del {
  box-shadow: 0 0 0 1.5px var(--df-del-ink);
  text-decoration: line-through;
}
.df-cov-chip.is-add {
  box-shadow: 0 0 0 1.5px var(--df-add-ink);
  font-weight: 700;
}

.df-empty-pane {
  flex: 1;
  display: grid;
  place-items: center;
  padding: 10px 8px;
  font-size: 12px;
  color: var(--ink3);
  text-align: center;
}

/* 字段差异行 */
.df-field-cell.is-del {
  background: var(--df-del-bg);
}
.df-field-cell.is-del .df-gutter {
  background: var(--df-del-gutter);
  color: var(--df-del-ink);
}
.df-field-cell.is-add {
  background: var(--df-add-bg);
}
.df-field-cell.is-add .df-gutter {
  background: var(--df-add-gutter);
  color: var(--df-add-ink);
}

.df-field-content,
.df-field-void {
  flex: 1;
  min-width: 0;
  padding: 7px 10px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.df-field-void {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.df-void-dash {
  font-size: 11.5px;
  color: var(--ink3);
}

.df-field-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
}

.df-field-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--ink3);
  letter-spacing: 0.03em;
  width: fit-content;
}

.df-delta-pill {
  font-family: var(--fn);
  font-size: 11.5px;
  font-weight: 700;
  padding: 0 6px;
  border-radius: 999px;
  line-height: 1.4;
}
.df-delta-pill.is-up {
  background: var(--df-add-bg-strong);
  color: var(--df-add-ink);
}
.df-delta-pill.is-down {
  background: var(--df-del-bg-strong);
  color: var(--df-del-ink);
}
.df-delta-pill.is-shift {
  background: var(--df-mod-bg);
  color: var(--df-mod-ink);
}

.df-field-text {
  font-size: 13px;
  line-height: 1.56;
  color: var(--ink);
  overflow-wrap: anywhere;
}

.df-hunk-fold {
  display: block;
  width: 100%;
  min-height: 34px;
  padding: 5px 10px;
  border: 0;
  border-top: 1px dashed var(--line2);
  background: color-mix(in srgb, var(--teal) 7%, var(--surface2));
  color: var(--teal);
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background-color 0.14s ease,
    color 0.14s ease;
}
.df-hunk-fold:hover {
  background: color-mix(in srgb, var(--accent) 12%, var(--surface2));
  color: var(--accent);
}

/* Unified 单栏合并模式 */
.df-uni-id {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 6px 11px;
  background: color-mix(in srgb, var(--surface2) 50%, var(--surface));
  border-bottom: 1px solid var(--line);
}

.df-uni-line {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 6px 8px;
  padding: 6px 11px 6px 0;
}
.df-uni-line + .df-uni-line {
  border-top: 1px solid color-mix(in srgb, var(--line) 65%, transparent);
}
.df-uni-line .df-gutter {
  padding-top: 0;
  border-right: 0;
}
.df-uni-line.is-del {
  background: var(--df-del-bg);
}
.df-uni-line.is-del .df-gutter {
  color: var(--df-del-ink);
}
.df-uni-line.is-add {
  background: var(--df-add-bg);
}
.df-uni-line.is-add .df-gutter {
  color: var(--df-add-ink);
}
.df-uni-side {
  font-family: var(--fn);
  font-size: 11.5px;
  font-weight: 700;
  padding: 0 5px;
  border-radius: 3px;
  background: color-mix(in srgb, var(--surface) 72%, transparent);
  color: var(--ink2);
}
.df-uni-line .df-field-text {
  flex: 1 1 220px;
}

/* 窄屏与矮窗紧凑适配 */
@container diff-view (max-width: 540px) {
  .df-gutter {
    flex-basis: 16px;
    font-size: 11.5px;
  }
  .df-id-cell {
    gap: 5px;
    padding-right: 6px;
  }
  .df-avatar {
    flex-basis: 30px;
    width: 30px;
    height: 30px;
  }
  .df-field-content,
  .df-field-void {
    padding: 6px 7px;
  }
  .df-field-text {
    font-size: 12px;
    line-height: 1.5;
  }
}

@media (pointer: coarse), (max-height: 600px) {
  .df-context-btn {
    min-height: 34px;
    padding-inline: 10px;
  }
}

@media (max-height: 600px) {
  .df-card-head {
    padding: 5px 9px;
  }
  .df-card-title {
    font-size: 14px;
  }
  .df-id-cell {
    min-height: 42px;
  }
  .df-avatar {
    flex-basis: 32px;
    width: 32px;
    height: 32px;
    margin-block: 4px;
  }
  .df-field-content,
  .df-field-void {
    padding: 5px 8px;
  }
}

:global(:root[data-font='large'] .df-card-title) {
  font-size: 16.5px;
}
:global(:root[data-font='large'] .df-field-text) {
  font-size: 14.5px;
}

@media (prefers-reduced-motion: reduce) {
  .df-context-btn,
  .df-hunk-fold {
    transition: none !important;
  }
}
:global(:root[data-motion='reduce'] .df-context-btn),
:global(:root[data-motion='reduce'] .df-hunk-fold) {
  transition: none !important;
}
</style>
