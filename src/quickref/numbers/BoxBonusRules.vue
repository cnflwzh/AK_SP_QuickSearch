<script setup lang="ts">
import {computed} from 'vue';
import {OWN_OPERATOR_BONUS} from '../../../data/index.ts';

const bonusRules = computed(() => {
  const reversedOwned = [...OWN_OPERATOR_BONUS]
    .map((row, idx) => ({
      key: `r${idx + 1}`,
      level: row.level,
      state: idx === OWN_OPERATOR_BONUS.length - 1 ? '满加成' : '已激活',
      atk: row.atk,
      def: row.def,
      hp: row.hp,
      tone: `r${idx + 1}`,
      active: true,
    }))
    .reverse();
  return [
    ...reversedOwned,
    {
      key: 'r0',
      level: '已持未练 (精0)',
      state: '未激活',
      atk: '—',
      def: '—',
      hp: '—',
      tone: 'r0',
      active: false,
    },
    {
      key: 'rborrowed',
      level: '助战借用 6★',
      state: '等效精0',
      atk: '—',
      def: '—',
      hp: '—',
      tone: 'rborrowed',
      active: false,
    },
    {
      key: 'rpreset',
      level: '系统预设',
      state: '本体0加成',
      atk: '—',
      def: '—',
      hp: '—',
      tone: 'rpreset',
      active: false,
    },
    {
      key: 'runborrowed',
      level: '未借 6★',
      state: '原型替补',
      atk: '—',
      def: '—',
      hp: '—',
      tone: 'runborrowed',
      active: false,
    },
  ];
});
</script>

<template>
  <div class="bx-rules" aria-label="练度与来源效果一览">
    <div class="bx-rules-head">
      <span class="bx-kicker">练度与来源效果一览</span>
      <small>仅自持且达精一激活加成</small>
    </div>
    <div class="bx-rules-table">
      <div class="bx-rules-row head">
        <span>来源 / 练度</span>
        <span>局内</span>
        <span>攻击</span>
        <span>防御</span>
        <span>生命</span>
      </div>
      <div
        v-for="row in bonusRules"
        :key="row.key"
        :class="['bx-rules-row', row.tone]">
        <span class="bx-rule-lv">{{ row.level }}</span>
        <span :class="['bx-rule-st', {active: row.active}]">
          {{ row.state }}
        </span>
        <span class="num">{{ row.atk }}</span>
        <span class="num">{{ row.def }}</span>
        <span class="num">{{ row.hp }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ---------- 右侧：第一版练度加成对照表（回归并纳入助战/预设说明） ---------- */
.bx-rules {
  display: grid;
  gap: 7px;
  padding-left: 16px;
  border-left: 1px solid var(--line);
  align-content: start;
}
.bx-rules-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.bx-rules-head small {
  font-size: 11px;
  color: var(--teal);
}
.bx-rules-table {
  display: grid;
  gap: 4px;
}
.bx-rules-row {
  display: grid;
  grid-template-columns: minmax(94px, 1.35fr) 58px repeat(
      3,
      minmax(36px, 0.65fr)
    );
  align-items: center;
  gap: 5px;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 11.5px;
  background: var(--surface2);
  border: 1px solid var(--line);
}
.bx-rules-row.head {
  padding: 1px 8px;
  background: transparent;
  border: 0;
  font-size: 10.5px;
  color: var(--ink3);
}
.bx-rules-row.r3 {
  border-color: color-mix(in srgb, var(--bx-r3) 50%, var(--line));
  border-left: 3px solid var(--bx-r3);
  background: color-mix(in srgb, var(--bx-r3) 10%, var(--surface2));
}
.bx-rules-row.r2 {
  border-color: color-mix(in srgb, var(--bx-r2) 45%, var(--line));
  border-left: 3px solid var(--bx-r2);
  background: color-mix(in srgb, var(--bx-r2) 8%, var(--surface2));
}
.bx-rules-row.r1 {
  border-color: color-mix(in srgb, var(--bx-r1) 45%, var(--line));
  border-left: 3px solid var(--bx-r1);
  background: color-mix(in srgb, var(--bx-r1) 8%, var(--surface2));
}
.bx-rules-row.r0 {
  border-color: color-mix(in srgb, var(--bx-r0) 45%, var(--line));
  border-left: 3px solid var(--bx-r0);
  background: color-mix(in srgb, var(--bx-r0) 8%, var(--surface2));
}
.bx-rules-row.rborrowed {
  border-color: color-mix(in srgb, var(--bx-borrowed) 48%, var(--line));
  border-left: 3px solid var(--bx-borrowed);
  background: color-mix(in srgb, var(--bx-borrowed) 9%, var(--surface2));
}
.bx-rules-row.rpreset {
  border-color: color-mix(in srgb, var(--bx-preset) 45%, var(--line));
  border-left: 3px solid var(--bx-preset);
  background: color-mix(in srgb, var(--bx-preset) 8%, var(--surface2));
}
.bx-rules-row.runborrowed {
  border-style: dashed;
  border-left: 3px dashed var(--bx-unborrowed);
  opacity: 0.72;
}
.bx-rule-lv {
  font-weight: 600;
  color: var(--ink);
  white-space: nowrap;
}
.bx-rule-st {
  font-size: 10px;
  font-weight: 700;
  text-align: center;
  padding: 1px 4px;
  border-radius: 4px;
  background: var(--surface);
  color: var(--ink3);
  white-space: nowrap;
}
.bx-rules-row.r3 .bx-rule-st.active {
  background: var(--bx-r3);
  color: var(--bx-r3-ink);
}
.bx-rules-row.r2 .bx-rule-st.active {
  background: color-mix(in srgb, var(--bx-r2) 18%, var(--surface));
  color: var(--bx-r2);
}
.bx-rules-row.r1 .bx-rule-st.active {
  background: color-mix(in srgb, var(--bx-r1) 18%, var(--surface));
  color: var(--bx-r1);
}
.bx-rules-row.r0 .bx-rule-st {
  color: var(--bx-r0);
}
.bx-rules-row.rborrowed .bx-rule-st {
  color: var(--bx-borrowed);
}
.bx-rules-row.rpreset .bx-rule-st {
  color: var(--bx-preset);
}
.bx-rules-row.runborrowed .bx-rule-st {
  color: var(--bx-unborrowed);
}
.bx-rules-row .num {
  font: 600 11.5px var(--fn);
  text-align: right;
  color: var(--ink2);
}
.bx-rules-row.r3 .num {
  color: var(--bx-r3);
}
.bx-rules-row.r2 .num {
  color: var(--bx-r2);
}
.bx-rules-row.r1 .num {
  color: var(--bx-r1);
}

@container box-tools (max-width: 820px) {
  .bx-rules {
    padding-left: 0;
    padding-top: 10px;
    border-left: 0;
    border-top: 1px solid var(--line);
  }
}

@media (max-height: 600px) {
  .bx-rules-row {
    padding: 3px 6px;
    font-size: 11px;
  }
}
</style>
