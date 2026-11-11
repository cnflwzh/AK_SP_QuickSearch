<script setup lang="ts">
import { computed } from 'vue';
import { LEADER_MAP, type LayoutZone, type LeaderLayout, type LeaderStage, type MapPos, type OpRole, type StageMark } from '../../../data/index.ts';
import { prefersReducedMotion } from '../../lib/dom.ts';
/**
 * 领袖关卡站位图（数据见 data/leaders.ts 的 LEADER_MAP 与 stage）。
 * 左半场是独立模拟的场地；右半场在联合模拟里属于队友（镜像），只露出一角并淡化。
 * 传入 layout 时画我方站位：危险区 + 职能棋子，敌人路线淡化、不播动画。
 */
const props = defineProps<{ stage: LeaderStage; layout?: LeaderLayout | null; portrait: string; uid: string }>();
const C = 26;
/** 只画到第 11 列：左半场 + 领袖平台 + 一点右半场，手机上格子更大 */
const W = 11.5 * C, H = LEADER_MAP.grid.length * C;
const MID = 8;
const center = ([x, y]: MapPos): [number, number] => [x * C + C / 2, y * C + C / 2];
const d = (points: readonly MapPos[], loop = false): string =>
  points.map((p, i) => (i ? 'L' : 'M') + center(p).join(',')).join('') + (loop ? 'Z' : '');
const tiles = LEADER_MAP.grid.flatMap((row, y) => [...row].map((ch, x) => ({ x, y, ch })));
const KIND: Record<string, string> = { '#': 'no', '.': 'ok', _: 'pf', o: 'pf', S: 'sp', E: 'ex', i: 'ex' };
/**
 * 同一格的多个标记上下错开；同名标记只标一次名字。
 * 巡逻：从出发点走到第一个巡逻点，之后在巡逻点之间循环（loop 为动画路径）。
 */
const marks = computed(() => {
  const seen = new Map<string, number>(), named = new Set<string>();
  return props.stage.marks.map((mark: StageMark) => {
    const key = mark.at.join(',');
    const n = seen.get(key) ?? 0; seen.set(key, n + 1);
    const [cx, cy] = center(mark.at);
    const path = mark.path ?? [];
    const route = path.length ? d([mark.at, ...path, ...(mark.loop ? [path[0]] : [])]) : '';
    const loop = mark.loop && path.length ? d([...path, path[0]]) : route;
    const label = !named.has(mark.name); named.add(mark.name);
    return { ...mark, cx, cy: cy + n * C * .6, route, loop, label };
  });
});
const plan = computed(() => !!props.layout);
const animate = computed(() => !prefersReducedMotion && !plan.value);
const ROLE: Record<OpRole, string> = { 坦: 'tk', 输: 'dp', 疗: 'hl', 空: 'aa', 群: 'ao' };
/** 危险区拆成格子矩形；折线单独画。名称放在图例里，图上不写字，避免压住棋子 */
type Box = { x: number; y: number; w: number; h: number };
const zoneBoxes = (zone: LayoutZone): Box[] => {
  const s = zone.shape;
  if (s.kind === 'rect') return [{ x: s.at[0], y: s.at[1], w: s.w, h: s.h }];
  if (s.kind === 'col') return [{ x: s.x, y: 1, w: 1, h: 4 }];
  if (s.kind === 'cross') {
    const [x, y] = s.at;
    return [[x, y], [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]
      .filter(([cx, cy]) => cx >= 1 && cy >= 1 && cy <= 4).map(([cx, cy]) => ({ x: cx, y: cy, w: 1, h: 1 }));
  }
  return [];
};
const zones = computed(() => (props.layout?.zones ?? []).map((zone, i) => {
  const line = zone.shape.kind === 'line' ? zone.shape.path : null;
  return { key: i, tone: zone.tone ?? 'red', boxes: zoneBoxes(zone), d: line ? d(line) : '' };
}));
const walk = d(LEADER_MAP.walk), fly = d(LEADER_MAP.fly);
const shortName = (name: string) => name.length > 4 ? name.slice(0, 4) : name;
</script>
<template>
  <svg :class="['lwm', { plan }]" :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="plan ? '我方站位示意' : '领袖关卡路线图'">
    <defs>
      <clipPath :id="`lwc-${uid}`"><circle r="15"/></clipPath>
    </defs>
    <rect v-for="t in tiles" :key="`${t.x},${t.y}`" :class="['t', KIND[t.ch], { far: t.x > MID }]" :x="t.x * C + 1" :y="t.y * C + 1" :width="C - 2" :height="C - 2" rx="3"/>
    <rect class="pfb" :x="7 * C" :y="C" :width="3 * C" :height="3 * C" rx="5"/>
    <text class="lab" :x="C * 1.1" :y="C * .68">你的半场</text>
    <text class="lab far" :x="W - 4" :y="C * .68" text-anchor="end">队友 ›</text>
    <text class="lab ex" :x="C * 1.5" :y="H - C * .32">出口</text>

    <path class="pw" :d="walk"/>
    <path class="pfl" :d="fly"/>
    <template v-for="(m, i) in marks" :key="`r${i}`">
      <path v-if="m.route && !plan" :class="['pr', m.kind]" :d="m.route"/>
    </template>

    <template v-if="plan">
      <template v-for="z in zones" :key="`z${z.key}`">
        <rect v-for="(b, j) in z.boxes" :key="j" :class="['zn', z.tone]" :x="b.x * C + 1" :y="b.y * C + 1" :width="b.w * C - 2" :height="b.h * C - 2" rx="4"/>
        <path v-if="z.d" :class="['zl', z.tone]" :d="z.d"/>
      </template>
    </template>

    <template v-if="animate">
      <circle v-for="k in 3" :key="`w${k}`" class="dw" r="3.5"><animateMotion :dur="'7s'" :begin="`${(k - 1) * 2.3}s`" repeatCount="indefinite" :path="walk"/></circle>
      <circle v-for="k in 2" :key="`f${k}`" class="df" r="3.5"><animateMotion dur="11s" :begin="`${(k - 1) * 5.5}s`" repeatCount="indefinite" :path="fly"/></circle>
      <template v-for="(m, i) in marks" :key="`a${i}`">
        <circle v-if="m.route && m.kind !== 'boss'" :class="['dm', m.kind]" r="4"><animateMotion dur="8s" repeatCount="indefinite" :path="m.loop"/></circle>
      </template>
    </template>

    <g class="sp" :transform="`translate(${center(LEADER_MAP.spawn).join(',')})`"><circle r="5"/></g>
    <template v-for="(m, i) in marks" :key="`m${i}`">
      <!-- 巡逻的领袖：头像沿路线移动（站位图里静止在出发点） -->
      <g v-if="m.kind === 'boss'" class="mb" :transform="animate && m.route ? undefined : `translate(${m.cx},${m.cy})`">
        <circle class="ring" r="17"/>
        <image :href="portrait" x="-15" y="-15" width="30" height="30" :clip-path="`url(#lwc-${uid})`"/>
        <animateMotion v-if="animate && m.route" dur="12s" repeatCount="indefinite" :path="m.loop"/>
      </g>
      <g v-else :class="['mp', m.kind]" :transform="`translate(${m.cx},${m.cy})`">
        <path :d="m.kind === 'part' ? 'M0,-8L8,0L0,8L-8,0Z' : 'M0,-7L7,6L-7,6Z'"/>
        <text v-if="m.label" y="-11" text-anchor="middle">{{ shortName(m.name) }}</text>
      </g>
    </template>

    <template v-if="layout">
      <g v-for="(slot, i) in layout.slots" :key="`s${i}`" :class="['op', ROLE[slot.role]]" :transform="`translate(${center(slot.at).join(',')})`" :style="{ '--i': i }">
        <circle r="10.5"/>
        <text class="r" y="4" text-anchor="middle">{{ slot.role }}</text>
        <text v-if="slot.mark" class="mk" y="-13" text-anchor="middle">{{ slot.mark }}</text>
      </g>
    </template>
  </svg>
</template>
