import assert from 'node:assert/strict';
import test from 'node:test';
import { LEADER_BATTLEFIELDS, LEADER_MOVEMENTS } from '../data/leader-movement.ts';
import { groundRoute, movementTimeline } from '../src/lib/leader-map.ts';

const length = points => points.slice(1).reduce((total, at, i) => total + Math.hypot(at[0] - points[i][0], at[1] - points[i][1]), 0);
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, a + ' != ' + b);
const field = grid => ({ id: 'fixture', name: '', grid, crates: [], platforms: [] });

// Fixtures pin the patrol order from h07_10/h08_06 and the distinct right-side branch.
test('fin keeps its spawn segment and the original patrol order on both sides', () => {
  const { fin, finCore, beast } = LEADER_MOVEMENTS;
  assert.deepEqual(fin.left.legs.map(leg => leg.points), [[[8, 2], [7, 1]], [[7, 1], [1, 4], [7, 3], [7, 1]]]);
  assert.deepEqual(fin.right.legs.map(leg => leg.points), [[[8, 2], [9, 3]], [[9, 3], [15, 4], [9, 1], [9, 3]]]);
  assert.deepEqual(finCore.left.legs, fin.left.legs);
  assert.deepEqual(finCore.right.legs, fin.right.legs);
  assert.equal(finCore.left.delay, 1);
  assert.equal(finCore.right.delay, .1);
  assert.deepEqual(beast.right.legs[1].points, [[9, 1], [15, 4], [9, 3], [9, 1]]);
});

test('ground movement takes diagonals but cannot squeeze through touching obstacles', () => {
  const points = [[0, 0], [2, 2]];
  assert.deepEqual(groundRoute(points, field(['...', '...', '...'])), points);
  assert.deepEqual(groundRoute([[0, 0], [1, 1]], field(['.B', 'B.'])), []);
  assert.deepEqual(groundRoute([[0, 0], [2, 0]], field(['.#.'])), []);
});

test('all movement branches remain reachable and avoid terrain, crates and platforms on every battlefield', () => {
  for (const terrain of LEADER_BATTLEFIELDS) {
    const blocked = terrain.grid.flatMap((row, y) => [...row].flatMap((tile, x) => '#BHb'.includes(tile) ? [[x, y]] : []));
    blocked.push(...terrain.crates, ...terrain.platforms);
    for (const [name, branches] of Object.entries(LEADER_MOVEMENTS)) for (const [side, movement] of Object.entries(branches)) {
      const timeline = movementTimeline(movement, terrain);
      const label = [terrain.id, name, side].join('/');
      assert.equal(timeline.length, movement.legs.length, label);
      for (const [legIndex, leg] of timeline.entries()) {
        assert.deepEqual(leg.points[0], movement.legs[legIndex].points[0], label);
        assert.deepEqual(leg.points.at(-1), movement.legs[legIndex].points.at(-1), label);
        near(leg.duration, length(leg.points) / movement.speed);
        if (movement.flying) continue;
        // Independent dense sampling catches diagonal shortcuts through blocked tiles.
        for (let i = 1; i < leg.points.length; i++) {
          const a = leg.points[i - 1], b = leg.points[i];
          const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / .025));
          for (let j = 0; j <= steps; j++) {
            const x = a[0] + (b[0] - a[0]) * j / steps, y = a[1] + (b[1] - a[1]) * j / steps;
            assert.ok(!blocked.some(([bx, by]) => Math.abs(x - bx) < .5 - 1e-7 && Math.abs(y - by) < .5 - 1e-7), label + ': obstacle at ' + x + ',' + y);
          }
        }
      }
    }
  }
});

test('patrol entry runs once and timing follows actual speed, distance and playback rate', () => {
  const terrain = LEADER_BATTLEFIELDS[0];
  const fin = movementTimeline(LEADER_MOVEMENTS.fin.left, terrain);
  const gun = movementTimeline(LEADER_MOVEMENTS.gun.left, terrain);
  assert.deepEqual(fin.map(leg => leg.repeat), [false, true]);
  near(fin[1].begin, fin[0].duration);
  assert.deepEqual(fin[0].points.at(-1), fin[1].points[0]);
  assert.deepEqual(fin[1].points[0], fin[1].points.at(-1));
  near(gun[1].duration, fin[1].duration * 2);
  const faster = movementTimeline(LEADER_MOVEMENTS.finCore.left, terrain, 4);
  const normal = movementTimeline(LEADER_MOVEMENTS.finCore.left, terrain);
  for (let i = 0; i < normal.length; i++) {
    near(faster[i].duration, normal[i].duration / 4);
    near(faster[i].begin, normal[i].begin / 4);
  }
});

test('flying escorts finish both sides with a three-second invisible transfer and no loop', () => {
  for (const name of ['fiber', 'sakota', 'drone']) for (const movement of Object.values(LEADER_MOVEMENTS[name])) {
    const timeline = movementTimeline(movement, LEADER_BATTLEFIELDS[0]);
    assert.equal(timeline.length, 2);
    assert.ok(timeline.every(leg => !leg.repeat));
    near(timeline[1].begin - timeline[0].begin - timeline[0].duration, 3);
    assert.deepEqual(timeline[1].points[0], [8, 1]);
    assert.notDeepEqual(timeline[0].points.at(-1), timeline[1].points.at(-1));
  }
});

test('changing battlefield changes navigation without modifying shared checkpoints', () => {
  const movement = LEADER_MOVEMENTS.fin.left;
  const original = JSON.stringify(movement);
  const first = movementTimeline(movement, LEADER_BATTLEFIELDS[0]);
  const second = movementTimeline(movement, LEADER_BATTLEFIELDS[1]);
  assert.notDeepEqual(first[1].points, second[1].points);
  assert.equal(JSON.stringify(movement), original);
  assert.deepEqual(movementTimeline(movement, LEADER_BATTLEFIELDS[0]), first);
});
