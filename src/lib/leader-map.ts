import type { EnemyMovement, LeaderBattlefield, MapPos } from '../../data/types.ts';
import { LEADER_BATTLEFIELDS } from '../../data/leader-movement.ts';

type Wall = { left: number; right: number; top: number; bottom: number };
type Edge = { to: number; distance: number };
type Navigation = {
  walls: Wall[];
  corners: MapPos[];
  edges: Edge[][];
  routes: Map<string, readonly MapPos[]>;
};
const navigation = new WeakMap<LeaderBattlefield, Navigation>();
const EPS = 1e-8;
const distance = (a: MapPos, b: MapPos): number => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** 判断线段是否触碰障碍；封住对角相接的零宽缝隙，拐角另留绘图间隙。 */
function crosses(a: MapPos, b: MapPos, wall: Wall): boolean {
  let enter = 0, leave = 1;
  for (const [axis, low, high] of [[0, wall.left, wall.right], [1, wall.top, wall.bottom]]) {
    const delta = b[axis] - a[axis];
    if (Math.abs(delta) < EPS) {
      if (a[axis] <= low + EPS || a[axis] >= high - EPS) return false;
    } else {
      const t1 = (low - a[axis]) / delta, t2 = (high - a[axis]) / delta;
      enter = Math.max(enter, Math.min(t1, t2));
      leave = Math.min(leave, Math.max(t1, t2));
    }
  }
  return enter <= leave + EPS && leave > EPS && enter < 1 - EPS;
}
const visible = (a: MapPos, b: MapPos, walls: readonly Wall[]): boolean =>
  !walls.some(wall => crosses(a, b, wall));

/** 每张地形只构建一次可见拐点图；动画帧不做寻路。 */
function graph(terrain: LeaderBattlefield): Navigation {
  const cached = navigation.get(terrain);
  if (cached) return cached;
  const blocked = new Map<string, MapPos>();
  terrain.grid.forEach((row, y) => [...row].forEach((tile, x) => {
    if (!'._oiEIMGV'.includes(tile)) blocked.set(`${x},${y}`, [x, y]);
  }));
  for (const at of [...terrain.crates, ...terrain.platforms]) blocked.set(at.join(','), at);
  const walls = [...blocked.values()].map(([x, y]) => ({ left: x - .5, right: x + .5, top: y - .5, bottom: y + .5 }));
  const width = terrain.grid[0].length, height = terrain.grid.length;
  const candidates = new Map<string, MapPos>();
  for (const wall of walls) {
    for (const x of [wall.left - .04, wall.right + .04]) for (const y of [wall.top - .04, wall.bottom + .04]) {
      if (x < -.5 || x > width - .5 || y < -.5 || y > height - .5) continue;
      if (walls.some(w => x > w.left - EPS && x < w.right + EPS && y > w.top - EPS && y < w.bottom + EPS)) continue;
      candidates.set(`${x.toFixed(2)},${y.toFixed(2)}`, [x, y]);
    }
  }
  const corners = [...candidates.values()];
  const edges: Edge[][] = corners.map(() => []);
  for (let i = 0; i < corners.length; i++) for (let j = i + 1; j < corners.length; j++) {
    if (!visible(corners[i], corners[j], walls)) continue;
    const length = distance(corners[i], corners[j]);
    edges[i].push({ to: j, distance: length }); edges[j].push({ to: i, distance: length });
  }
  const result = { walls, corners, edges, routes: new Map<string, readonly MapPos[]>() };
  navigation.set(terrain, result);
  return result;
}

/** 在障碍拐点之间求最短可见路径；支持斜向和小数坐标，路径不强制穿过格子中心。 */
function segment(from: MapPos, to: MapPos, nav: Navigation): readonly MapPos[] {
  const key = `${from.join(',')}>${to.join(',')}`;
  const cached = nav.routes.get(key);
  if (cached) return cached;
  if (visible(from, to, nav.walls)) return [from, to];
  const points = [...nav.corners, from, to], start = points.length - 2, end = start + 1;
  const edges = nav.edges.map(list => [...list]);
  edges.push([], []);
  for (const endpoint of [start, end]) {
    for (let i = 0; i < nav.corners.length; i++) if (visible(points[endpoint], points[i], nav.walls)) {
      const length = distance(points[endpoint], points[i]);
      edges[endpoint].push({ to: i, distance: length }); edges[i].push({ to: endpoint, distance: length });
    }
  }
  const costs = points.map(() => Infinity), previous = points.map(() => -1), visited = new Set<number>();
  costs[start] = 0;
  while (visited.size < points.length) {
    let current = -1;
    for (let i = 0; i < points.length; i++) {
      if (!visited.has(i) && Number.isFinite(costs[i]) && (current < 0 || costs[i] < costs[current])) current = i;
    }
    if (current < 0 || current === end) break;
    visited.add(current);
    for (const edge of edges[current]) {
      const next = costs[current] + edge.distance;
      if (next < costs[edge.to]) { costs[edge.to] = next; previous[edge.to] = current; }
    }
  }
  const result: MapPos[] = [];
  if (Number.isFinite(costs[end])) {
    for (let i = end; i !== -1; i = previous[i]) result.push(points[i]);
    result.reverse();
  }
  nav.routes.set(key, result);
  return result;
}

/**
 * 按所选场地连接地面检查点，返回连续路线；任一段不可达时返回空数组。
 * 保留游戏数据的检查点顺序，绕开禁行地形、初始工事和高台。无文件或 DOM 副作用。
 */
export function groundRoute(points: readonly MapPos[], terrain: LeaderBattlefield = LEADER_BATTLEFIELDS[0]): readonly MapPos[] {
  if (!points.length) return [];
  const nav = graph(terrain);
  if (points.some(([x, y]) => x < -.5 || x >= terrain.grid[0].length - .5 || y < -.5 || y >= terrain.grid.length - .5 ||
    nav.walls.some(w => x > w.left + EPS && x < w.right - EPS && y > w.top + EPS && y < w.bottom - EPS))) return [];
  const result: MapPos[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const leg = segment(points[i - 1], points[i], nav);
    if (!leg.length) return [];
    result.push(...leg.slice(1));
  }
  return result;
}

/** 一段 SVG 动画：begin/duration 单位秒；repeat 只用于巡逻段，传送等待期间不显示单位。 */
export interface MotionLeg {
  readonly points: readonly MapPos[];
  readonly begin: number;
  readonly duration: number;
  readonly repeat: boolean;
}

/**
 * 将移动指令编成按基础移速播放的时间段。rate 仅改变预览倍速，不修改游戏移速。
 * 出生段执行一次；每次传送等待单独计时；有限路线播放完后离场。
 */
export function movementTimeline(movement: EnemyMovement, terrain: LeaderBattlefield, rate = 1): readonly MotionLeg[] {
  const legs: MotionLeg[] = [];
  let time = movement.delay / rate;
  for (let i = 0; i < movement.legs.length; i++) {
    const leg = movement.legs[i];
    const points = movement.flying ? leg.points : groundRoute(leg.points, terrain);
    if (points.length < 2) return [];
    time += (leg.wait ?? 0) / rate;
    const length = points.slice(1).reduce((sum, at, j) => sum + distance(points[j], at), 0);
    const duration = Math.max(.001, length / movement.speed / rate);
    legs.push({ points, begin: time, duration, repeat: movement.loopFrom === i });
    time += duration;
  }
  return legs;
}
