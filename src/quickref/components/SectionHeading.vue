<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string;
    count?: number | string;
    desc?: string;
    /** 左侧色标颜色（支持 CSS 变量如 var(--accent) / var(--tc)）。 */
    accent?: string;
    /** 可选前置短标（如等阶 VI）。 */
    badge?: string;
    variant?: 'bar' | 'dot' | 'plain';
    level?: 2 | 3 | 4 | 5;
    countTone?: 'default' | 'danger';
  }>(),
  {
    variant: 'bar',
    level: 3,
    countTone: 'default',
  },
);
</script>

<template>
  <header
    :class="['q-sechead', `is-${variant}`]"
    :style="accent ? {'--sh-accent': accent} : undefined">
    <i v-if="variant === 'bar'" class="q-sechead-bar" aria-hidden="true"></i>
    <i v-else-if="variant === 'dot'" class="q-sechead-dot" aria-hidden="true"></i>
    <span v-if="badge" class="q-sechead-badge">{{ badge }}</span>
    <component :is="`h${level}`" class="q-sechead-title">{{ title }}</component>
    <span
      v-if="count !== undefined && count !== ''"
      :class="['q-sechead-count', {danger: countTone === 'danger'}]">
      {{ count }}
    </span>
    <small v-if="desc" class="q-sechead-desc">{{ desc }}</small>
    <span class="q-sechead-line" aria-hidden="true"></span>
    <span v-if="$slots.extra" class="q-sechead-extra">
      <slot name="extra" />
    </span>
  </header>
</template>

<style scoped>
.q-sechead {
  --sh-accent: var(--accent);
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 8px;
  min-width: 0;
}
.q-sechead-bar {
  width: 3px;
  height: 15px;
  border-radius: 999px;
  background: var(--sh-accent);
  flex: none;
}
.q-sechead-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--sh-accent);
  flex: none;
}
.q-sechead-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  padding: 0 6px;
  border-radius: 4px;
  background: var(--sh-accent);
  color: #fff;
  font-family: var(--fn);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.45;
  flex: none;
}
.q-sechead-title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--ink);
  line-height: 1.3;
}
.q-sechead.is-plain .q-sechead-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--ink3);
  letter-spacing: 0.04em;
}
.q-sechead-count {
  font-family: var(--fn);
  font-size: 12px;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--sh-accent) 13%, var(--surface2));
  border: 1px solid color-mix(in srgb, var(--sh-accent) 34%, var(--line));
  color: var(--sh-accent);
  white-space: nowrap;
}
.q-sechead.is-plain .q-sechead-count {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink3);
}
.q-sechead-count.danger {
  background: color-mix(in srgb, var(--red) 14%, var(--surface2));
  border-color: color-mix(in srgb, var(--red) 45%, var(--line));
  color: var(--red);
}
.q-sechead-desc {
  font-size: 12px;
  color: var(--ink3);
  line-height: 1.4;
}
.q-sechead-line {
  flex: 1 1 24px;
  height: 1px;
  background: var(--line);
}
.q-sechead-extra {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: none;
}
@media (max-height: 600px) {
  .q-sechead-desc {
    display: none;
  }
}
</style>
