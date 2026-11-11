<script setup lang="ts">
import { ref } from 'vue';
import { PURPOSE, WIKIS, UPLOADERS, FURTHER_READING, LICENSES, REPO_URL, spaceUrl, videoUrl } from '../../data/credits.ts';
const emit = defineEmits<{ seen: [] }>();
const dialog = ref<HTMLDialogElement>();
const body = ref<HTMLElement>();
const okay = ref<HTMLButtonElement>();
function close() { emit('seen'); dialog.value?.close(); }
function show() {
  if (dialog.value?.open) return;
  dialog.value?.showModal();
  if (body.value) body.value.scrollTop = 0;
  okay.value?.focus({ preventScroll: true });
}
defineExpose({ show });
</script>

<template>
  <dialog ref="dialog" class="about" aria-label="关于本项目" @click.self="close" @cancel="emit('seen')">
    <div class="ab-h">
      <div><div class="kicker">ABOUT · 关于本项目</div><h2>卫戍协议·规程 速查</h2></div>
      <button type="button" class="ab-x" data-about-close aria-label="关闭" @click="close">✕</button>
    </div>
    <div ref="body" class="ab-b">
      <section><p v-for="p in PURPOSE" :key="p">{{ p }}</p></section>
      <section>
        <h3><i>01</i>数据来源</h3>
        <ul class="ab-list"><li v-for="w in WIKIS" :key="w.url"><div class="ab-src"><a :href="w.url" target="_blank" rel="noopener"><b>{{ w.name }}</b> {{ w.page }}</a></div><div class="ab-use">{{ w.used }}</div></li></ul>
      </section>
      <section v-for="(group, index) in [UPLOADERS, FURTHER_READING]" :key="index">
        <h3><i>{{ index === 0 ? '02' : '03' }}</i>{{ index === 0 ? '流派参考 · B 站' : '延伸阅读' }}</h3>
        <p v-if="index === 0" class="ab-note">流派页的阵容由本项目根据上方 Wiki 的盟约与干员数据整理；核心盟约、开局策略与打法关键词参考了以下 UP 主的攻略。完整运营思路请看原视频。</p>
        <div v-for="u in group" :key="u.uid" class="ab-up">
          <div class="ab-uh"><b>{{ u.name }}</b> <a :href="spaceUrl(u.uid)" target="_blank" rel="noopener">UID {{ u.uid }}</a></div>
          <ul><li v-for="v in u.videos" :key="v.bv"><div class="ab-src"><a :href="videoUrl(v.bv)" target="_blank" rel="noopener">{{ v.title }}</a><span class="ab-bv">{{ v.bv }}</span></div><div class="ab-use">{{ v.used }}</div></li></ul>
        </div>
      </section>
      <section><h3><i>04</i>许可</h3><dl class="ab-lic"><template v-for="[what, license] in LICENSES" :key="what"><dt>{{ what }}</dt><dd>{{ license }}</dd></template></dl></section>
    </div>
    <div class="ab-f"><a v-if="REPO_URL" :href="REPO_URL" target="_blank" rel="noopener">源码与反馈</a><button ref="okay" type="button" class="ab-ok" data-about-close @click="close">开始使用</button></div>
  </dialog>
</template>
