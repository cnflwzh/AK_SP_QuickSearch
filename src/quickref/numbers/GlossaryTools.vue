<script setup lang="ts">
import {computed, ref} from 'vue';
import {
  GLOSSARY_ENTRIES,
  GLOSSARY_KIND_LABELS,
  searchGlossary,
} from '../../lib/glossary.ts';
import EmptyState from '../components/EmptyState.vue';
import SearchInput from '../components/SearchInput.vue';
import SectionHeading from '../components/SectionHeading.vue';
import SelectInput from '../components/SelectInput.vue';

const query = ref('');
const selectedKind = ref('');
const kinds = Object.entries(GLOSSARY_KIND_LABELS).map(([value, label]) => ({
  value,
  label,
}));
const kindOptions = [{value: '', label: '全部分类'}, ...kinds];
const groups = computed(() => {
  const matches = query.value.trim()
    ? searchGlossary(query.value)
    : GLOSSARY_ENTRIES;
  return kinds
    .filter((kind) => !selectedKind.value || kind.value === selectedKind.value)
    .map((kind) => ({
      ...kind,
      entries: matches.filter((entry) => entry.kind === kind.value),
    }))
    .filter((group) => group.entries.length);
});

function resetFilters(): void {
  query.value = '';
  selectedKind.value = '';
}
</script>

<template>
  <section
    class="glossary-tools"
    aria-label="术语词典"
    data-glossary-dictionary>
    <div class="glossary-filters">
      <SearchInput
        v-model="query"
        placeholder="搜术语、别名或释义"
        aria-label="搜索术语" />
      <SelectInput
        v-model="selectedKind"
        :options="kindOptions"
        highlight-active
        aria-label="术语分类" />
    </div>
    <section
      v-for="group in groups"
      :key="group.value"
      class="nc glossary-group">
      <SectionHeading :title="group.label" :count="group.entries.length" />
      <dl class="glossary-list">
        <div
          v-for="entry in group.entries"
          :key="entry.term"
          class="glossary-row">
          <dt>
            {{ entry.term }}
            <small v-if="entry.aliases.length">
              别名：{{ entry.aliases.join('、') }}
            </small>
          </dt>
          <dd>{{ entry.desc }}</dd>
        </div>
      </dl>
    </section>
    <EmptyState
      v-if="!groups.length"
      card
      compact
      message="没有找到匹配的术语"
      action-label="清空筛选"
      @action="resetFilters" />
  </section>
</template>

<style scoped>
.glossary-tools {
  display: grid;
  gap: 10px;
}
.glossary-filters {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
}
.glossary-filters .q-search {
  min-width: 0;
}
.glossary-list {
  margin: 6px 0 0;
}
.glossary-row {
  display: grid;
  grid-template-columns: minmax(6em, 10em) minmax(0, 1fr);
  gap: 4px 16px;
  align-items: baseline;
  padding-block: 7px;
  font-size: 13px;
  line-height: 1.55;
  overflow-wrap: anywhere;
}
.glossary-row + .glossary-row {
  border-top: 1px solid var(--line);
}
.glossary-row:last-child {
  padding-bottom: 0;
}
.glossary-row dt {
  font-weight: 700;
  color: var(--ink);
}
.glossary-row small {
  display: block;
  color: var(--ink3);
  font-size: 12px;
  font-weight: 400;
}
.glossary-row dd {
  margin: 0;
  color: var(--ink2);
}
@container number-tools (max-width: 520px) {
  .glossary-row {
    grid-template-columns: minmax(5em, 25%) minmax(0, 1fr);
    column-gap: 10px;
  }
}
@container number-tools (max-width: 340px) {
  .glossary-row {
    grid-template-columns: minmax(0, 1fr);
    row-gap: 2px;
  }
}
@media (max-height: 600px) {
  .glossary-tools {
    gap: 6px;
  }
  .glossary-group {
    padding: 8px 10px;
  }
  .glossary-row {
    padding-block: 4px;
  }
}
</style>
