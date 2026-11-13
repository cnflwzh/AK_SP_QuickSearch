<script setup lang="ts">
import Markup from '../components/Markup';
import { ref } from 'vue';
import { CORE_COVENANTS } from '../../../data/index';
import { color } from '../chips';
import { drawBuild, mixedBuilds } from './buildsView';
const selected = ref('乌萨斯');
const mixed = mixedBuilds();
</script>
<template>

  <div class="chap-h"><span class="no">05</span><div><h2>流派</h2><p class="en">ARCHETYPES</p></div></div>
  <h3 class="bh"><span>5.1</span>核心盟约流</h3>
  <div class="btabs" id="btabs" role="group" aria-label="核心盟约流派"><button v-for="name in CORE_COVENANTS" :key="name" type="button" :style="{ '--c': color(name) }" :data-n="name" :class="{ on: selected === name }" :aria-pressed="selected === name" aria-controls="bpanel" @click="selected = name">{{ name }}</button></div>
  <Markup as="div" id="bpanel" :html="drawBuild(selected)" />
  <h3 class="bh"><span>5.2</span>附加盟约 / 混搭流</h3>
  <Markup as="div" class="hyb" id="hyb" :html="mixed" />
</template>
