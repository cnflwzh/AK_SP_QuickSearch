import { LEADER_MAP } from '../../data/leaders.ts';
import type { MapPos } from '../../data/types.ts';

const WIDTH = LEADER_MAP.grid[0].length;
const walkable = new Set(LEADER_MAP.grid.flatMap((row, y) => [...row].flatMap((tile, x) =>
  '._oiE'.includes(tile) ? [y * WIDTH + x] : [])));
const key = ([x, y]: MapPos): number => y * WIDTH + x;
const position = (id: number): MapPos => [id % WIDTH, Math.floor(id / WIDTH)];

/** Connect two checkpoints along the map's ground tiles; an unreachable pair returns no path. */
function segment(from: MapPos, to: MapPos): MapPos[] {
  const start = key(from), end = key(to);
  if (!walkable.has(start) || !walkable.has(end)) return [];
  const queue = [start], previous = new Map<number, number>([[start, -1]]);
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    if (current === end) {
      const result: MapPos[] = [];
      for (let id = end; id !== -1; id = previous.get(id)!) result.push(position(id));
      return result.reverse();
    }
    const [x, y] = position(current);
    for (const [dx, dy] of [[-1, 0], [0, -1], [0, 1], [1, 0]]) {
      const nextX = x + dx, nextY = y + dy;
      if (nextX < 0 || nextX >= WIDTH || nextY < 0 || nextY >= LEADER_MAP.grid.length) continue;
      const next = nextY * WIDTH + nextX;
      if (!walkable.has(next) || previous.has(next)) continue;
      previous.set(next, current);
      queue.push(next);
    }
  }
  return [];
}

/**
 * Expand ordered ground checkpoints into a terrain-aware reference route.
 * This uses four-way tile connections, not the game's continuous navigation mesh.
 * Returns no route if any checkpoint is unreachable; never draw a shortcut through an obstacle.
 * Pure and bounded by the fixed map size; compute on scene changes, not on animation frames.
 */
export function groundRoute(points: readonly MapPos[]): readonly MapPos[] {
  if (!points.length || !walkable.has(key(points[0]))) return [];
  const result: MapPos[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const leg = segment(points[i - 1], points[i]);
    if (!leg.length) return [];
    result.push(...leg.slice(1));
  }
  return result;
}
