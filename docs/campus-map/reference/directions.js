// directions.js — turns a findRoute() result into plain-English steps. Pure ES module (no DOM).
const OUT = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };   // door side -> direction you face when leaving
const ORD = (n) => ['', '1st', '2nd', '3rd', '4th'][n] || `${n}th`;
const round5 = (m) => Math.max(5, Math.round(m / 5) * 5);
const JOG = 2.5;                                                  // legs shorter than this are not announced

// Plan axes: x = east, z = south, viewed from above with north up -> cross > 0 is a RIGHT turn.
function turn(h1, h2) {
  const dot = h1[0] * h2[0] + h1[1] * h2[1], cross = h1[0] * h2[1] - h1[1] * h2[0];
  if (dot > 0.7) return 'straight';
  if (dot < -0.7) return 'around';
  return cross > 0 ? 'right' : 'left';
}
export const spaceLabel = (sp) =>
  sp.type === 'room' ? `Room ${sp.id}` : /^\d/.test(sp.id) ? `${sp.name} (${sp.id})` : sp.name;
// "the Elevator", "the Library", but "Room 154" and "Gym C"
const the = (sp) => (['room', 'gym'].includes(sp.type) ? '' : 'the ') + spaceLabel(sp);
const cap = (s) => s[0].toUpperCase() + s.slice(1);

function landmark(graph, floor, x, z, skip) {
  let best = null;
  for (const [k, sp] of graph.spaces) {
    if (Number(k.split('|')[0]) !== floor || !sp.door || sp.via || skip.has(sp.id)) continue;
    const d = Math.hypot(sp.door[0] - x, sp.door[1] - z);
    const score = d - (sp.type === 'room' ? 0 : 1.5);              // prefer named places over plain rooms
    if (d < 7 && (!best || score < best.score)) best = { sp, score };
  }
  return best ? ` at ${the(best.sp)}` : '';
}

export function describeRoute(graph, route) {
  const n = route.nodes;
  const sp = (node) => graph.spaces.get(`${node.floor}|${node.spaceId}`);
  // 1) split the node list into one "run" per floor
  const runs = [];
  let cur = { floor: n[0].floor, pts: [n[0]] };
  for (let i = 1; i < n.length; i++) {
    if (n[i].via === 'stairs' || n[i].via === 'elevator') {
      let j = i;
      while (j + 1 < n.length && n[j + 1].via === n[i].via && n[j + 1].spaceId === n[i].spaceId) j++;
      cur.vertical = { kind: n[i].via, space: sp(n[i - 1]), toFloor: n[j].floor };
      runs.push(cur);
      cur = { floor: n[j].floor, pts: [n[j]] };
      i = j;
    } else cur.pts.push(n[i]);
  }
  runs.push(cur);
  const start = sp(n[0]), end = sp(n[n.length - 1]);
  const skip = new Set([start.id, end.id, ...runs.filter((r) => r.vertical).map((r) => r.vertical.space.id)]);
  const steps = [];
  runs.forEach((run, r) => {
    const say = (text, extra = {}) => steps.push({ floor: run.floor, text, ...extra });
    const P = run.pts, legs = [];
    for (let k = 1; k < P.length; k++) {
      const dx = P[k].x - P[k - 1].x, dz = P[k].z - P[k - 1].z, len = Math.hypot(dx, dz);
      legs.push({ h: len > 1e-6 ? [dx / len, dz / len] : null, len, at: P[k - 1] });
    }
    const exit = legs.shift() || { len: 0 };            // door -> hallway
    const approach = legs.pop() || { len: 0, h: null }; // hallway -> door
    const mid = [];                                      // merge straight runs, swallow tiny jogs
    for (const g of legs) {
      if (!g.h) continue;
      const prev = mid[mid.length - 1];
      if (prev && (g.len < JOG || turn(prev.h, g.h) === 'straight')) prev.len += g.len;
      else mid.push({ ...g });
    }
    const fromSpace = r === 0 ? start : runs[r - 1].vertical.space;
    const exitDir = OUT[fromSpace.door[2]];
    const first = mid.length ? turn(exitDir, mid[0].h) : 'straight';
    const leave = r === 0
      ? (start.type === 'entrance' ? `Start at ${the(start)}` : `Leave ${the(start)}`)
      : `Step out of the ${runs[r - 1].vertical.kind === 'elevator' ? 'elevator' : 'stairwell'} on the ${ORD(run.floor)} floor`;
    const total = mid.reduce((s, g) => s + g.len, 0);
    if (!run.vertical && r === 0 && total < JOG) {                 // destination is right there
      const across = approach.h && turn(exitDir, approach.h) === 'straight';
      say(`${leave}. ${cap(the(end))} is ${across ? 'directly across the hallway' : 'right next door'}.`, { arrive: true });
      return;
    }
    say(`${leave}${first === 'left' || first === 'right' ? ` and turn ${first}` : ''}.`);
    for (let k = 1; k < mid.length; k++) {
      const t = turn(mid[k - 1].h, mid[k].h);
      say(`Walk about ${round5(mid[k - 1].len)} m, then turn ${t}${landmark(graph, run.floor, mid[k].at.x, mid[k].at.z, skip)}.`);
    }
    const lastLen = mid.length ? mid[mid.length - 1].len : 0;
    const lastH = mid.length ? mid[mid.length - 1].h : exitDir;
    if (run.vertical) {
      const v = run.vertical, dir = v.toFloor > run.floor ? 'up' : 'down';
      const what = v.kind === 'elevator' ? 'the elevator' : `the ${v.space.name.replace(/Stairs \((\w+)\)/, '$1 stairs')}`;
      if (lastLen >= JOG) say(`Walk about ${round5(lastLen)} m to ${what}.`);
      say(`Take ${what} ${dir} to the ${ORD(v.toFloor)} floor.`, { vertical: true });
    } else {
      const side = approach.h && approach.len > 0.3 ? turn(lastH, approach.h) : 'straight';
      const where = side === 'left' || side === 'right' ? `on your ${side}` : 'straight ahead';
      say(`${lastLen >= JOG ? `Walk about ${round5(lastLen)} m. ` : ''}${cap(the(end))} is ${where}.`, { arrive: true });
    }
  });
  return steps;
}
