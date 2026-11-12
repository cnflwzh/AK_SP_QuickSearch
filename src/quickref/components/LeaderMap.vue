<script setup lang="ts">
import { computed, onMounted, ref, useId, watch } from 'vue';
import { LEADER_MOVEMENTS, type LayoutZone, type LeaderBattlefield, type LeaderLayout, type LeaderStage, type MapPos, type MovementBranches, type OpRole, type ZoneShape } from '../../../data/index.ts';
import { groundRoute, movementTimeline } from '../../lib/leader-map.ts';
import { prefersReducedMotion } from '../../lib/dom.ts';

/** 地形与路线按场地更新；技能切换只更新覆盖层。SVG 自行播放，动画帧不触发 Vue 寻路或重绘。 */
const props = defineProps<{
  stage: LeaderStage; layout?: LeaderLayout | null; scene?: LayoutZone; portrait: string;
  terrain: LeaderBattlefield; side: 'left' | 'right' | 'all';
}>();
const uid = useId(), svg = ref<SVGSVGElement>();
const C = 48, H = 6.55 * C;
const center = ([x, y]: MapPos): [number, number] => [(x + .5) * C, (y + .5) * C];
const path = (points: readonly MapPos[]): string => points.map((p, i) => `${i ? 'L' : 'M'}${center(p).join(',')}`).join(' ');
const plan = computed(() => !!props.layout);
const animate = computed(() => !prefersReducedMotion && !plan.value);
const side = computed(() => plan.value ? 'left' : props.side);
const viewBox = computed(() => `${side.value === 'right' ? 6.1 * C : 0} 0 ${(side.value === 'all' ? 17 : 10.9) * C} ${H}`);
const tiles = computed(() => props.terrain.grid.flatMap((row, y) => [...row].map((ch, x) => ({ x, y, ch })))
  .filter(t => t.y > 0 && !(t.ch === '#' && (t.x === 0 || t.x === 16 || t.y === 5))));
const KIND: Record<string, string> = {
  '#': 'no', '.': 'ok', _: 'platform', B: 'barrier', b: 'reserve', o: 'portal-out', E: 'exit', i: 'portal-in',
  H: 'barrier', I: 'infection', M: 'mire', G: 'grass', V: 'speed',
};
const TILE_LABEL: Record<string, string> = {
  '#': '禁行地形', '.': '可部署地面', B: '地形障碍 · 可部署', b: '整备区', _: '联合通道 · 不可部署',
  o: '传送出口', E: '蓝门', i: '传送入口', H: '高台', I: '源石污染区', M: '沼泽', G: '草丛', V: '加速地板',
};
const ROLE: Record<OpRole, { name: string; tone: string }> = {
  坦: { name: '阻挡', tone: 'tk' }, 输: { name: '输出', tone: 'dp' }, 疗: { name: '治疗', tone: 'hl' },
  空: { name: '对空', tone: 'aa' }, 群: { name: '群攻', tone: 'ao' },
};
const ANGLE = { right: 0, down: 90, left: 180, up: 270 } as const;
const selectedTargets = computed(() => new Set((props.scene?.targets ?? []).map(p => p.join(','))));
const shapes = computed(() => props.scene ? [props.scene.shape, ...(props.scene.extraShapes ?? [])] : []);
const common = [
  { name: '萨卡兹枯朽前锋', kind: 'ground', at: [8, 4] as MapPos, movement: LEADER_MOVEMENTS.ground },
  { name: '妖怪', kind: 'flying', at: [8, 4] as MapPos, movement: LEADER_MOVEMENTS.drone },
];

/** 右侧使用游戏分支而非镜像左侧；跨全场的共享路线仅绘制一次。 */
function branches(movement: MovementBranches) {
  if (!movement.right) return [movement.left];
  return side.value === 'all' ? [movement.left, movement.right] : [side.value === 'right' ? movement.right : movement.left];
}
const marks = computed(() => {
  const positions = new Map<string, number>();
  const source = plan.value ? props.stage.marks.filter(m => m.kind === 'boss') : [...props.stage.marks, ...common];
  return source.flatMap((m, index) => {
    const movements = !plan.value && m.movement ? branches(m.movement) : [undefined];
    return movements.map((movement, branch) => {
      const at = plan.value && props.scene?.bossAt ? props.scene.bossAt : movement?.legs[0].points[0] ?? m.at;
      const key = at.join(','), n = positions.get(key) ?? 0; positions.set(key, n + 1);
      const [cx, cy] = center(at);
      const timeline = movement ? movementTimeline(movement, props.terrain).map(leg => ({ ...leg, path: path(leg.points) })) : [];
      return { name: m.name, kind: m.kind, key: `${index}-${branch}`, cx, cy: cy + (plan.value ? n * C * .58 : 0),
        speed: movement?.speed, timeline, route: timeline.map(leg => leg.path).join(' ') };
    });
  });
});
type Box = { x: number; y: number; w: number; h: number };
/** 格子范围保留完整形状；圆形技能使用格数半径。 */
function boxes(s: ZoneShape): Box[] {
  if (s.kind === 'rect') return [{ x: s.at[0], y: s.at[1], w: s.w, h: s.h }];
  if (s.kind === 'col') return [{ x: s.x, y: 1, w: 1, h: 4 }];
  const positions: readonly MapPos[] = s.kind === 'tiles' ? s.at : s.kind === 'cross'
    ? [s.at, [s.at[0] - 1, s.at[1]], [s.at[0] + 1, s.at[1]], [s.at[0], s.at[1] - 1], [s.at[0], s.at[1] + 1]] : [];
  return positions.map(([x, y]) => ({ x, y, w: 1, h: 1 }));
}
const planWalk = computed(() => path(groundRoute(LEADER_MOVEMENTS.ground.left.legs[0].points, props.terrain)));
function linePath(points: readonly MapPos[]): string {
  if (props.scene?.label === '巡逻路线') {
    const movement = props.stage.marks.find(m => m.kind === 'boss')?.movement?.left;
    return path(groundRoute(movement ? movement.legs.flatMap(leg => [...leg.points]) : points, props.terrain));
  }
  return path(props.scene?.label === '末日布道' ? groundRoute(points, props.terrain) : points);
}
function playback(): void {
  if (!svg.value) return;
  if (!animate.value) svg.value.pauseAnimations(); else svg.value.unpauseAnimations();
}
function restart(): void {
  svg.value?.setCurrentTime(0);
  playback();
}
onMounted(restart);
watch([() => props.stage, () => props.terrain, () => props.side, plan], restart, { flush: 'post' });
</script>

<template>
  <svg ref="svg" :class="['lwm', { plan }, scene?.tone]" :viewBox="viewBox" role="img" :aria-label="plan ? `部署站位：${scene?.label ?? ''}` : `${terrain.name} · ${side === 'all' ? '全场' : side === 'right' ? '右侧' : '左侧'}敌人路线`">
    <title>{{ terrain.name }} · {{ plan ? scene?.hint : '出生、巡逻与跨场传送路线' }}</title>
    <defs>
      <clipPath :id="`${uid}-portrait`"><circle r="20"/></clipPath>
      <pattern :id="`${uid}-hatch`" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M-2 2L2-2M0 8L8 0M6 10L10 6" class="hatch"/></pattern>
      <marker :id="`${uid}-arrow`" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M1 1L9 5L1 9Z" class="arrow-fill"/></marker>
    </defs>
    <rect class="map-back" x="0" y="0" :width="17 * C" :height="H" rx="9"/>
    <g v-for="t in tiles" :key="`${t.x},${t.y}`" :class="['map-tile', KIND[t.ch]]">
      <title>{{ TILE_LABEL[t.ch] }}</title>
      <rect class="tile-side" :x="t.x * C + 2" :y="t.y * C + 5" :width="C - 4" :height="C - 5" rx="2"/>
      <rect class="tile-top" :x="t.x * C + 2" :y="t.y * C + 2" :width="C - 4" :height="C - 6" rx="2"/>
      <rect v-if="t.ch === '#'" :x="t.x * C + 2" :y="t.y * C + 2" :width="C - 4" :height="C - 6" :fill="`url(#${uid}-hatch)`"/>
      <path v-if="t.ch === 'B' || t.ch === 'H'" class="barrier-ridge" :d="`M${t.x * C + 8} ${t.y * C + 12}h32m-32 17h32`"/>
      <path v-if="t.ch === 'b'" class="reserve-mark" :d="`M${t.x * C + 17} ${t.y * C + 22}h14m-7-7v14`"/>
      <text v-if="'IMGV'.includes(t.ch)" class="terrain-symbol" :x="(t.x + .5) * C" :y="(t.y + .6) * C" text-anchor="middle">{{ ({ I: '源', M: '沼', G: '草', V: '»' } as Record<string, string>)[t.ch] }}</text>
    </g>
    <g v-for="([x, y], i) in terrain.platforms" :key="`platform-${i}`" class="map-platform" :transform="`translate(${x * C},${y * C})`">
      <title>预置高台</title><rect x="4" y="4" width="40" height="37" rx="2"/><path d="M8 13H40M8 29H40"/>
    </g>
    <g v-for="([x, y], i) in terrain.crates" :key="`crate-${i}`" class="map-crate" :transform="`translate(${x * C},${y * C})`">
      <title>阻隔工事 · 初始位置</title><rect class="crate-side" x="6" y="11" width="36" height="30" rx="2"/>
      <rect class="crate-top" x="6" y="5" width="36" height="30" rx="2"/><path d="M10 9L38 31M38 9L10 31"/>
    </g>
    <text v-if="side !== 'right'" class="map-heading" :x="1.1 * C" :y=".65 * C">{{ terrain.id }} · 左侧阵地</text>
    <text class="map-heading muted" :x="7.3 * C" :y=".65 * C">联合区域</text>
    <text v-if="side !== 'left'" class="map-heading" :x="12.1 * C" :y=".65 * C">{{ terrain.id }} · 右侧阵地</text>
    <template v-for="x in [0, 16]" :key="`gate-${x}`"><text class="gate-label" :x="(x + .5) * C" :y="4.58 * C" text-anchor="middle">蓝门</text></template>
    <template v-for="x in [1, 15]" :key="`portal-${x}`">
      <g class="portal" :transform="`translate(${center([x, 5]).join(',')})`"><path d="M-9-5H9L3-11M9-5L3 1M9 6H-9L-3 12M-9 6L-3 0"/></g>
      <text class="portal-label" :x="(x + .5) * C" :y="6.35 * C" text-anchor="middle">传送入口</text>
    </template>
    <text v-for="x in [4, 12]" :key="`reserve-${x}`" class="reserve-label" :x="(x + .5) * C" :y="5.62 * C" text-anchor="middle">整备区</text>
    <g class="portal" :transform="`translate(${center([8, 1]).join(',')})`"><path d="M-9-5H9L3-11M9-5L3 1M9 6H-9L-3 12M-9 6L-3 0"/><title>跨场传送出口 · 等待 3 秒</title></g>
    <g class="spawn-icon" :transform="`translate(${center([8, 4]).join(',')})`"><path d="M-10-10H10V10H-10ZM-5-5L5 0L-5 5Z"/></g>
    <path v-if="plan" class="route ground quiet" :d="planWalk"/>
    <template v-else>
      <path v-for="m in marks.filter(m => m.route)" :key="`route-${m.key}`" :class="['route', m.kind]" :d="m.route"><title>{{ m.name }} · 基础移速 {{ m.speed }} 格/秒</title></path>
    </template>
    <g v-if="plan" class="skill-layer" :data-skill="scene?.label">
      <template v-for="(s, i) in shapes" :key="i">
        <rect v-for="(b, j) in boxes(s)" :key="`box-${j}`" class="danger" :x="b.x * C + 1" :y="b.y * C + 1" :width="b.w * C - 2" :height="b.h * C - 2" rx="2"/>
        <circle v-if="s.kind === 'circle'" class="danger" :cx="center(s.at)[0]" :cy="center(s.at)[1]" :r="s.radius * C"/>
        <path v-if="s.kind === 'line'" class="danger-path" :d="linePath(s.path)" :marker-end="`url(#${uid}-arrow)`"/>
      </template>
    </g>
    <g v-for="m in marks" :key="`enemy-${m.key}`" :class="['enemy', m.kind]"
      :visibility="animate && m.timeline.length ? 'hidden' : 'visible'"
      :transform="animate && m.timeline.length ? undefined : `translate(${m.cx},${m.cy})`">
      <title>{{ m.name }}{{ m.speed ? ` · 基础移速 ${m.speed} 格/秒` : '' }}</title>
      <template v-if="m.kind === 'boss'">
        <circle class="portrait-ring" r="23"/>
        <image :href="portrait" x="-20" y="-20" width="40" height="40" :clip-path="`url(#${uid}-portrait)`"/>
      </template>
      <circle v-else-if="m.kind === 'ground' || m.kind === 'flying'" :class="`moving-${m.kind}`" r="4"/>
      <template v-else><path class="part-icon" d="M0-11L11 0L0 11L-11 0Z"/><text class="enemy-name" y="-17" text-anchor="middle">{{ m.name }}</text></template>
      <template v-if="animate">
        <template v-for="(leg, i) in m.timeline" :key="i">
          <animateMotion :begin="`${leg.begin}s`" :dur="`${leg.duration}s`" :repeatCount="leg.repeat ? 'indefinite' : '1'" :path="leg.path" calcMode="paced" fill="freeze"/>
          <set attributeName="visibility" to="visible" :begin="`${leg.begin}s`" :dur="`${leg.duration}s`" :repeatCount="leg.repeat ? 'indefinite' : '1'"/>
        </template>
      </template>
    </g>
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
