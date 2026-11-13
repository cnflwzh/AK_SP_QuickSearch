<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { whileVisible } from '../../lib/visibility';

interface Enemy { x: number; willDie: boolean; dieAt: number; dot: SVGCircleElement; state: 'alive' | 'killed' | 'leaked' }
const svg = ref<SVGSVGElement>();
let dispose: (() => void) | undefined;
let blinkTimer: number | undefined;

/** The animation owns only its SVG layer; its timer and frame stop offscreen. */
onMounted(() => {
  const root = svg.value;
  if (!root) return;
  const layer = root.querySelector<SVGGElement>('#lkE')!;
  const base = root.querySelector<SVGRectElement>('.base')!;
  const hpLabel = root.querySelector<SVGTextElement>('#lkHp')!;
  const lostLabel = root.querySelector<SVGTextElement>('#lkLost')!;
  const timeBar = root.querySelector<SVGRectElement>('#lkT')!;
  const ROUND_SECONDS = 8.5, SPEED = 105;
  const sim: { hp: number; lost: number; t: number; enemies: Enemy[] } = { hp: 25, lost: 0, t: 0, enemies: [] };
  function newRound() {
    sim.lost = 0;
    sim.t = 0;
    layer.replaceChildren();
    sim.enemies = Array.from({ length: 14 }, (_, i) => {
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('r', '6');
      dot.setAttribute('cy', String(82 + Math.random() * 16));
      dot.setAttribute('class', 'en');
      layer.appendChild(dot);
      return { x: 650 + i * 42, willDie: Math.random() < .62, dieAt: 300 + Math.random() * 70, dot, state: 'alive' };
    });
  }
  function leak() {
    if (sim.lost < 10) { sim.lost++; sim.hp--; }
    base.style.opacity = '.4';
    clearTimeout(blinkTimer);
    blinkTimer = window.setTimeout(() => { base.style.opacity = '1'; }, 120);
  }
  function updateLabels() {
    if (hpLabel.textContent !== String(sim.hp)) hpLabel.textContent = String(sim.hp);
    if (lostLabel.textContent !== String(sim.lost)) lostLabel.textContent = String(sim.lost);
  }
  newRound();
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    sim.enemies.forEach((enemy, i) => {
      enemy.dot.setAttribute('cx', String(60 + i * 40));
      if (enemy.willDie) enemy.dot.setAttribute('class', 'en k');
    });
  }
  let last = performance.now(), frameId = 0;
  function frame(now: number) {
    const dt = Math.min(.05, (now - last) / 1000);
    last = now;
    sim.t += dt;
    sim.enemies.forEach(enemy => {
      if (enemy.state !== 'alive') return;
      enemy.x -= SPEED * dt;
      if (enemy.willDie && enemy.x < enemy.dieAt) {
        enemy.state = 'killed';
        enemy.dot.setAttribute('class', 'en k');
      } else if (enemy.x <= 36) {
        enemy.state = 'leaked';
        enemy.dot.style.display = 'none';
        leak();
      }
      enemy.dot.setAttribute('cx', String(enemy.x));
    });
    timeBar.setAttribute('width', String(Math.max(0, 150 * (1 - sim.t / ROUND_SECONDS))));
    if (sim.t >= ROUND_SECONDS) {
      sim.enemies.filter(enemy => enemy.state === 'alive' && enemy.x < 640).forEach(leak);
      if (sim.hp <= 8) sim.hp = 25;
      updateLabels();
      newRound();
    }
    updateLabels();
    frameId = requestAnimationFrame(frame);
  }
  dispose = whileVisible(root, () => {
    last = performance.now();
    frameId = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(frameId); clearTimeout(blinkTimer); base.style.opacity = '1'; };
  });
});
onBeforeUnmount(() => { dispose?.(); clearTimeout(blinkTimer); });
</script>
<template>
  <svg ref="svg" class="svgbox" id="leak" viewBox="0 0 640 170" role="img" aria-label="漏怪与目标生命演示" aria-describedby="leak-description">
    <desc id="leak-description">敌人从右侧出现，向左侧目标移动。越过防线的敌人抵达目标时扣除生命；上方显示目标剩余生命、本回合扣血和剩余作战时间。</desc>
    <rect class="lane" x="30" y="70" width="600" height="40" rx="4" />
    <rect class="base" x="10" y="62" width="26" height="56" rx="4" />
    <text class="lbl" x="23" y="134" text-anchor="middle">目标</text>
    <rect v-for="([x, y], i) in [[320, 60], [320, 96], [350, 78]]" :key="i" class="defn" :x="x" :y="y" width="22" height="22" rx="3" />
    <text class="lbl" x="340" y="150" text-anchor="middle">防线</text><text class="lbl" x="620" y="62" text-anchor="end">敌人出现 ◂</text>
    <text class="lbl" x="40" y="26">目标生命</text><text class="lblb" id="lkHp" x="40" y="52">25</text>
    <text class="lbl" x="150" y="26">本回合</text><text class="lblb" id="lkLost" x="150" y="52" style="fill:var(--red)">0</text><text class="lbl" x="196" y="52">/ 10</text>
    <text class="lbl" x="470" y="26">作战时限</text><rect x="470" y="34" width="150" height="8" rx="4" fill="var(--surface2)" stroke="var(--line)" />
    <rect id="lkT" x="470" y="34" width="150" height="8" rx="4" fill="var(--accent)" /><g id="lkE"></g>
  </svg>
</template>
