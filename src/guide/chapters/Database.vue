<script setup lang="ts">
import Markup from '../components/Markup';
import LiveStatus from '../../lib/LiveStatus.vue';
import Segmented from '../components/Segmented.vue';
import { avatar } from '../chips';
import { computed, ref } from 'vue';
import { OPERATORS, OPERATOR_TYPES, EQUIPMENT, ALL_COVENANTS, TIERS, TIER_LABELS } from '../../../data/index';
import { equipIconSrc } from '../../lib/assets';
import { cv } from '../chips';
const tier = ref(0), covenant = ref(''), type = ref(''), query = ref(''), elite = ref(false);
const operators = computed(() => {
  const search = query.value.trim();
  return OPERATORS.filter(o => (!tier.value || o.tier === tier.value)
    && (!covenant.value || o.covenants.includes(covenant.value))
    && (!type.value || o.type === type.value)
    && (!search || (o.name + o.covenants.join('/') + o.trait).includes(search)));
});
const traitHtml = (text: string) => text.replace(/<([^>]+)>/g, '<b style="color:var(--accent)">$1</b> ');
const equipmentColumns = TIERS.map(tier => ({ tier, items: EQUIPMENT.filter(equipment => equipment.tier === tier) }));

</script>
<template>

  <div class="chap-h"><span class="no">06</span><div><h2>图鉴</h2><p class="en">DATABASE</p></div></div>
  <h3 class="bh"><span>6.1</span>干员</h3>
  <div class="dbf">
    <Segmented id="dbTier" aria-label="干员等阶" :labels="['全部', ...TIER_LABELS.slice(1)]" v-model="tier" />
    <select id="dbCov" aria-label="盟约" v-model="covenant"><option value="">全部盟约</option><option v-for="name in ALL_COVENANTS" :key="name">{{ name }}</option></select>
    <select id="dbType" aria-label="特质类型" v-model="type"><option value="">全部类型</option><option v-for="name in OPERATOR_TYPES" :key="name">{{ name }}</option></select>
    <input type="search" id="dbQ" v-model="query" placeholder="搜索" aria-label="搜索干员">
    <label class="row" style="font-size:13px;gap:6px"><input type="checkbox" id="dbEl" v-model="elite">精锐</label>
    <span class="cnt" id="dbN">{{ operators.length }} / {{ OPERATORS.length }}</span>
  </div>
  <div class="dbg" id="dbg"><div v-for="operator in operators" :key="operator.name" class="dbc" :data-key="operator.name" :data-t="operator.tier">
    <div class="t"><Markup :html="avatar(operator.name)" /><i>{{ TIER_LABELS[operator.tier] }}</i><b>{{ operator.name }}</b><span class="s">{{ operator.stars ? '★' + operator.stars : '' }}</span></div>
    <div class="row"><Markup v-for="name in operator.covenants" :key="name" :html="cv(name)" /><span class="tag">{{ operator.type }}</span></div>
    <Markup as="div" class="tx" :html="traitHtml(elite ? operator.elite : operator.trait)" />
  </div></div>
  <h3 class="bh"><span>6.2</span>装备</h3>
  <div class="eqcols" id="eqcols"><div v-for="column in equipmentColumns" :key="column.tier" class="col"><div :data-t="column.tier">{{ TIER_LABELS[column.tier] }}</div>
    <div v-for="equipment in column.items" :key="equipment.name" class="eqi" :data-t="equipment.tier"><div class="eh"><img v-if="equipIconSrc(equipment.name)" class="ico" :src="equipIconSrc(equipment.name)" alt="" width="80" height="80" loading="lazy" decoding="async"><b>{{ equipment.name }}<span>{{ equipment.price }}</span></b></div>{{ equipment.effect }}<template v-if="equipment.advanced"><br><span style="color:var(--accent)">进阶</span> {{ equipment.advanced }}</template><template v-if="equipment.covenant"><br><Markup :html="cv(equipment.covenant)" /></template></div>
  </div></div>
  <LiveStatus :message="query.trim() || tier || covenant || type ? `图鉴筛选结果：${operators.length} 名干员` : ''"/>
</template>
