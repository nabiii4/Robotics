// Run: node --test   (Node 22+; on Node 20 use: node --experimental-detect-module --test). Set SCHOOL_JSON=path/to/school.json to test another copy of the data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildGraph, findRoute } from './navgraph.js';
import { describeRoute } from './directions.js';
import { buildWalls } from './walls.js';

const data = JSON.parse(readFileSync(process.env.SCHOOL_JSON ?? new URL('../school-map.json', import.meta.url)));
const g = buildGraph(data);

// e.g. ['ST-SW 1->3'] — which stairs/elevator a route uses
function verticals(route) {
  const out = [];
  for (let i = 1; i < route.nodes.length; i++) {
    const n = route.nodes[i];
    if (n.via !== 'stairs' && n.via !== 'elevator') continue;
    const last = out[out.length - 1];
    if (last && last.id === n.spaceId && last.to === route.nodes[i - 1].floor) last.to = n.floor;
    else out.push({ id: n.spaceId, from: route.nodes[i - 1].floor, to: n.floor });
  }
  return out.map((v) => `${v.id} ${v.from}->${v.to}`);
}

test('data: ids are unique per floor and every door sits on its own outline', () => {
  for (const fl of data.floors) {
    const ids = fl.spaces.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length, `duplicate id on floor ${fl.level}`);
    for (const s of fl.spaces) {
      if (!s.door || s.poly || s.via) continue;
      const [x, z] = s.door, onX = Math.abs(x - s.x) < 0.11 || Math.abs(x - (s.x + s.w)) < 0.11;
      const onZ = Math.abs(z - s.z) < 0.11 || Math.abs(z - (s.z + s.d)) < 0.11;
      assert.ok(onX || onZ, `door of ${s.id} is not on its wall`);
    }
  }
});

test('graph: all 183 doors are reachable from the main entrance, with and without stairs', () => {
  assert.equal(g.doorNode.size, 183);
  for (const stepFree of [false, true]) {
    for (const k of g.doorNode.keys()) assert.ok(findRoute(g, '1|LOBBY', k, { stepFree }), `${k} (stepFree=${stepFree})`);
  }
});

const routes = [
  ['1|LOBBY', '3|305', false, ['ST-SW 1->3']], ['1|LOBBY', '3|305', true, ['EL 1->3']],
  ['1|101', '4|447', false, ['ST-SW 1->4']], ['1|113', '4|437', true, ['EL 1->4']],
  ['2|271', '2|LIBRARY', false, []], ['1|CAFETERIA', '4|416', false, ['ST-NE 1->4']],
  ['3|340', '2|GYM-C', false, ['ST-NE 3->2']], ['1|LOBBY', '2|251', false, ['ST-SE 1->2']],
  ['4|453', '1|CAFETERIA', false, ['ST-SE 4->1']],
];
for (const [a, b, stepFree, expected] of routes) {
  test(`route ${a} -> ${b}${stepFree ? ' (step-free)' : ''} uses ${expected.join(', ') || 'no stairs'}`, () => {
    assert.deepEqual(verticals(findRoute(g, a, b, { stepFree })), expected);
  });
}

test('directions read naturally', () => {
  const text = (a, b, o) => describeRoute(g, findRoute(g, a, b, o)).map((s) => s.text);
  assert.deepEqual(text('1|LOBBY', '3|305'), [
    'Start at the Main Entrance Lobby.',
    'Walk about 20 m, then turn left at the Elevator.',
    'Walk about 10 m to the SW stairs.',
    'Take the SW stairs up to the 3rd floor.',
    'Step out of the stairwell on the 3rd floor and turn right.',
    'Walk about 5 m, then turn left at the Elevator.',
    'Walk about 20 m. The English Dept (305) is on your left.',
  ]);
  assert.deepEqual(text('2|271', '2|LIBRARY'), [
    'Leave the Interborough Counseling (271) and turn right.',
    "Walk about 15 m, then turn left at the Girls' Restroom.",
    'Walk about 15 m. The Library is on your left.',
  ]);
  assert.deepEqual(text('3|302', '3|301'), ['Leave Room 302. Room 301 is directly across the hallway.']);
});

test('walls: no wall blocks a door, and the gym/entrance/cafeteria passages are open', () => {
  const blocked = (walls, x, z) => walls.some((w) => (w.z1 === w.z2
    ? Math.abs(z - w.z1) < 0.06 && x > w.x1 + 0.05 && x < w.x2 - 0.05
    : Math.abs(x - w.x1) < 0.06 && z > w.z1 + 0.05 && z < w.z2 - 0.05));
  for (const fl of data.floors) {
    const walls = buildWalls(fl, data);
    assert.ok(walls.length > 100);
    for (const s of fl.spaces) if (s.door && !s.via) assert.ok(!blocked(walls, s.door[0], s.door[1]), `door of ${s.id}`);
    for (const [x1, z1, x2, z2] of fl.openings) assert.ok(!blocked(walls, (x1 + x2) / 2, (z1 + z2) / 2), `opening on floor ${fl.level}`);
  }
});
