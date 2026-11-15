<script setup lang="ts">
import type { DeploymentAdvice } from '../../lib/runAdvisor.ts';
import { avatarSrc } from '../../lib/assets.ts';
defineProps<{ advice: readonly DeploymentAdvice[] }>();
defineEmits<{ deploy: [name: string, replace: string] }>();
</script>

<template>
  <section v-if="advice.length" class="ra-deployments" aria-label="整备区上场建议">
    <div class="ra-section-heading"><h3>先看整备区</h3></div>
    <p class="ra-muted">这些干员已持有，无需购买。每条是独立方案，上场后会重新评估。</p>
    <ol class="ra-recommendations">
      <li v-for="item in advice.slice(0, 3)" :key="`${item.name}:${item.replace}`"
        class="ra-recommendation" :class="{ cautious: item.score <= 0 }">
        <details>
          <summary>
            <span class="ra-rank" aria-hidden="true">↗</span>
            <img :src="avatarSrc(item.name)" alt="" width="32" height="32" loading="lazy">
            <span class="ra-rec-text">
              <span class="ra-rec-title"><b>{{ item.name }}</b><small>已持有 · 免费调整</small></span>
              <span class="ra-rec-preview">{{ item.replace ? `替换 ${item.replace}` : '填入上场空位' }}</span>
            </span>
          </summary>
          <div class="ra-rec-detail">
            <ul><li v-for="reason in item.reasons" :key="reason">{{ reason }}</li></ul>
            <p v-if="item.losses.length" class="ra-warning">代价：{{ item.losses.join('；') }}</p>
            <p v-if="item.replace">将 <b>{{ item.replace }}</b> 移入整备区，再让 <b>{{ item.name }}</b> 上场。</p>
            <p v-else>让 <b>{{ item.name }}</b> 填入上场空位。</p>
            <button type="button" class="btn ra-deploy-button" :aria-label="`记录${item.name}上场${item.replace ? `，替换${item.replace}` : ''}`"
              @click="$emit('deploy', item.name, item.replace)">记录上场</button>
          </div>
        </details>
      </li>
    </ol>
  </section>
</template>
