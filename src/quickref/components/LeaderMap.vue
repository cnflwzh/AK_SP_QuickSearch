<script setup lang="ts">
import { computed, useId } from 'vue';
import { LEADER_MAP, type LayoutZone, type LeaderLayout, type LeaderStage, type MapPos, type OpRole, type ZoneShape } from '../../../data/index.ts';
import { groundRoute } from '../../lib/leader-map.ts';
import { prefersReducedMotion } from '../../lib/dom.ts';

/**
 * 左侧阵地及领袖区域。scene 只更新技能覆盖层，避免切换时重新挂载地图。
 * 关卡检查点按真实地形连接；bossAt 是领袖发动技能的演示位置。
 */
const props = defineProps<{ stage: LeaderStage; layout?: LeaderLayout | null; scene?: LayoutZone; portrait: string }>();
const uid = useId();
const C = 48, W = 10.9 * C, H = 6.55 * C;
const center = ([x, y]: MapPos): [number, number] => [(x + .5) * C, (y + .5) * C];
const path = (points: readonly MapPos[]): string => points.map((p, i) => `${i ? 'L' : 'M'}${center(p).join(',')}`).join(' ');
const plan = computed(() => !!props.layout);
const animate = computed(() => !prefersReducedMotion && !plan.value);
const tiles = LEADER_MAP.grid.flatMap((row, y) => [...row].map((ch, x) => ({ x, y, ch }))).filter(t => t.x <= 10 && t.y > 0 && !(t.ch === '#' && (t.x === 0 || t.y === 5)));
const KIND: Record<string, string> = { '#': 'no', '.': 'ok', _: 'platform', B: 'barrier', b: 'reserve', o: 'portal-out', S: 'spawn', E: 'exit', i: 'portal-in' };
const crates = LEADER_MAP.crates.filter(([x]) => x <= 10);
const TILE_LABEL: Record<string, string> = { '#': '禁行地形', '.': '可部署地面', B: '地形障碍 · 可部署', b: '整备区', _: '联合通道 · 不可部署', o: '传送出口', E: '蓝门', i: '传送入口' };
const ROLE: Record<OpRole, { name: string; tone: string }> = {
  坦: { name: '阻挡', tone: 'tk' },
  输: { name: '输出', tone: 'dp' },
  疗: { name: '治疗', tone: 'hl' },
  空: { name: '对空', tone: 'aa' },
  群: { name: '群攻', tone: 'ao' },
};
const ANGLE = { right: 0, down: 90, left: 180, up: 270 } as const;
const selectedTargets = computed(() => new Set((props.scene?.targets ?? []).map(p => p.join(','))));
const shapes = computed(() => props.scene ? [props.scene.shape, ...(props.scene.extraShapes ?? [])] : []);
const marks = computed(() => {
  const positions = new Map<string, number>();
  return props.stage.marks.filter(m => !plan.value || m.kind === 'boss').map(m => {
    const at = plan.value && m.kind === 'boss' && props.scene?.bossAt ? props.scene.bossAt : m.at;
    const key = at.join(',');
    const n = positions.get(key) ?? 0; positions.set(key, n + 1);
    const [cx, cy] = center(at);
    const points = m.path ?? [];
    const flying = props.stage.escorts.some(e => e.fly && e.name.replace(/[“”]/g, '') === m.name.replace(/[“”]/g, ''));
    const route = (p: readonly MapPos[]): string => path(flying ? p : groundRoute(p));
    return { ...m, cx, cy: cy + n * C * .58,
      route: points.length ? route([m.at, ...points, ...(m.loop ? [points[0]] : [])]) : '',
      motion: points.length ? route(m.loop ? [...points, points[0]] : [m.at, ...points]) : '',
    };
  });
});
type Box = { x: number; y: number; w: number; h: number };
/** 格子范围保留完整形状；圆形技能用真实半径，绝不换算成九宫格。 */
function boxes(s: ZoneShape): Box[] {
  if (s.kind === 'rect') return [{ x: s.at[0], y: s.at[1], w: s.w, h: s.h }];
  if (s.kind === 'col') return [{ x: s.x, y: 1, w: 1, h: 4 }];
  const positions: readonly MapPos[] = s.kind === 'tiles' ? s.at : s.kind === 'cross'
    ? [s.at, [s.at[0] - 1, s.at[1]], [s.at[0] + 1, s.at[1]], [s.at[0], s.at[1] - 1], [s.at[0], s.at[1] + 1]] : [];
  return positions.map(([x, y]) => ({ x, y, w: 1, h: 1 }));
}
const walk = path(groundRoute(LEADER_MAP.walk)), fly = path(LEADER_MAP.fly);
// Only movement paths follow terrain; laser links and airborne skill trajectories remain straight.
const linePath = (points: readonly MapPos[]): string => path(
  props.scene?.label === '巡逻路线' || props.scene?.label === '末日布道' ? groundRoute(points) : points,
);
</script>

<template>
  <svg :class="['lwm', { plan }, scene?.tone]" :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="plan ? `部署站位：${scene?.label ?? ''}` : `${LEADER_MAP.name} · 领袖关卡与敌人路线`">
    <title>{{ LEADER_MAP.name }} · {{ plan ? scene?.hint : '左侧阵地、领袖出发位置及敌人行进路线' }}</title>
    <defs>
      <clipPath :id="`${uid}-portrait`"><circle r="20"/></clipPath>
      <pattern :id="`${uid}-hatch`" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M-2 2L2-2M0 8L8 0M6 10L10 6" class="hatch"/></pattern>
      <marker :id="`${uid}-arrow`" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M1 1L9 5L1 9Z" class="arrow-fill"/></marker>
    </defs>
    <rect class="map-back" x="0" y="0" :width="W" :height="H" rx="9"/>
    <g v-for="t in tiles" :key="`${t.x},${t.y}`" :class="['map-tile', KIND[t.ch], { far: t.x === 10 }]">
      <title>{{ TILE_LABEL[t.ch] }}</title>
      <rect class="tile-side" :x="t.x * C + 2" :y="t.y * C + 5" :width="C - 4" :height="C - 5" rx="2"/>
      <rect class="tile-top" :x="t.x * C + 2" :y="t.y * C + 2" :width="C - 4" :height="C - 6" rx="2"/>
      <rect v-if="t.ch === '#'" :x="t.x * C + 2" :y="t.y * C + 2" :width="C - 4" :height="C - 6" :fill="`url(#${uid}-hatch)`"/>
      <path v-if="t.ch === 'B'" class="barrier-ridge" :d="`M${t.x * C + 8} ${t.y * C + 12}h32m-32 17h32`"/>
      <path v-if="t.ch === 'b'" class="reserve-mark" :d="`M${t.x * C + 17} ${t.y * C + 22}h14m-7-7v14`"/>
    </g>
    <g v-for="([x, y], i) in crates" :key="`crate-${i}`" class="map-crate" :transform="`translate(${x * C},${y * C})`">
      <title>阻隔工事 · 初始位置</title><rect class="crate-side" x="6" y="11" width="36" height="30" rx="2"/>
      <rect class="crate-top" x="6" y="5" width="36" height="30" rx="2"/><path d="M10 9L38 31M38 9L10 31"/>
    </g>
    <text class="map-heading" :x="1.1 * C" :y=".65 * C">01 · 左侧阵地</text>
    <text class="map-heading muted" :x="7.25 * C" :y=".65 * C">联合区域</text>
    <text class="gate-label" :x=".5 * C" :y="4.58 * C" text-anchor="middle">蓝门</text>
    <g class="portal" :transform="`translate(${center(LEADER_MAP.transfer).join(',')})`"><path d="M-9-5H9L3-11M9-5L3 1M9 6H-9L-3 12M-9 6L-3 0"/></g>
    <text class="portal-label" :x="1.5 * C" :y="6.35 * C" text-anchor="middle">传送入口</text>
    <text class="reserve-label" :x="4.5 * C" :y="5.62 * C" text-anchor="middle">整备区</text>
    <g class="portal" :transform="`translate(${center([8, 1]).join(',')})`"><path d="M-9-5H9L3-11M9-5L3 1M9 6H-9L-3 12M-9 6L-3 0"/><title>跨场传送出口</title></g>
    <g class="spawn-icon" :transform="`translate(${center(LEADER_MAP.spawn).join(',')})`"><path d="M-10-10H10V10H-10ZM-5-5L5 0L-5 5Z"/></g>

    <path v-if="!plan" class="route ground" :d="walk"/>
    <path v-if="!plan" class="route flying" :d="fly"/>
    <path v-if="plan" class="route ground quiet" :d="walk"/>
    <template v-if="!plan">
      <path v-for="(m, i) in marks.filter(m => m.route)" :key="`route-${i}`" :class="['route', m.kind]" :d="m.route"/>
    </template>

    <g v-if="plan" class="skill-layer" :data-skill="scene?.label">
      <template v-for="(s, i) in shapes" :key="i">
        <template v-for="(b, j) in boxes(s)" :key="`box-${j}`">
          <rect class="danger" :x="b.x * C + 1" :y="b.y * C + 1" :width="b.w * C - 2" :height="b.h * C - 2" rx="2"/>
        </template>
        <circle v-if="s.kind === 'circle'" class="danger" :cx="center(s.at)[0]" :cy="center(s.at)[1]" :r="s.radius * C"/>
        <path v-if="s.kind === 'line'" class="danger-path" :d="linePath(s.path)" :marker-end="`url(#${uid}-arrow)`"/>
      </template>
    </g>

    <template v-if="animate">
      <circle v-for="n in 3" :key="`w-${n}`" class="moving-ground" r="4"><animateMotion dur="7s" :begin="`${(n - 1) * 2.3}s`" repeatCount="indefinite" :path="walk"/></circle>
      <circle v-for="n in 2" :key="`f-${n}`" class="moving-flying" r="4"><animateMotion dur="11s" :begin="`${(n - 1) * 5.5}s`" repeatCount="indefinite" :path="fly"/></circle>
    </template>
    <template v-for="(m, i) in marks" :key="`enemy-${i}`">
      <g :class="['enemy', m.kind]" :transform="animate && m.motion ? undefined : `translate(${m.cx},${m.cy})`">
        <template v-if="m.kind === 'boss'">
          <circle class="portrait-ring" r="23"/>
          <image :href="portrait" x="-20" y="-20" width="40" height="40" :clip-path="`url(#${uid}-portrait)`"/>
        </template>
        <template v-else><path class="part-icon" d="M0-11L11 0L0 11L-11 0Z"/><text class="enemy-name" y="-17" text-anchor="middle">{{ m.name }}</text></template>
        <animateMotion v-if="animate && m.motion" dur="12s" repeatCount="indefinite" :path="m.motion"/>
      </g>
    </template>

    <g v-for="(s, i) in layout?.slots ?? []" :key="`operator-${i}`" :class="['operator', ROLE[s.role].tone, { targeted: selectedTargets.has(s.at.join(',')) }]" :transform="`translate(${center(s.at).join(',')})`">
      <title>{{ ROLE[s.role].name }}{{ s.mark ? ` · ${s.mark}` : '' }}</title>
      <rect class="target-ring" x="-22" y="-22" width="44" height="44" rx="4"/>
      <rect class="operator-base" x="-17" y="-18" width="34" height="34" rx="4"/>
      <text class="role-name" y="6" text-anchor="middle">{{ s.role }}</text>
      <path class="facing" d="M19-6L25 0L19 6Z" :transform="`rotate(${ANGLE[s.facing]})`"/>
    </g>
    <g v-for="(m, i) in scene?.markers ?? []" v-show="plan" :key="`skill-unit-${i}`" class="skill-unit" :transform="`translate(${center(m.at).join(',')})`">
      <rect x="-15" y="-15" width="30" height="30" rx="4"/><text y="4" text-anchor="middle">{{ m.name }}</text>
    </g>
  </svg>
</template>
