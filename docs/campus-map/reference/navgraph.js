// navgraph.js — builds a walkable graph from school.json and finds routes.
// Pure ES module (no DOM), so it runs in the browser and in `node --test`.
const EPS = 0.05;
const NO_DOOR = new Set(['shaft', 'courtyard']);
const key = (x, z) => `${x.toFixed(2)},${z.toFixed(2)}`;

export function buildGraph(data) {
  const nodes = new Map();   // id -> {id, floor, x, z, spaceId?}
  const adj = new Map();     // id -> [{to, w, kind}]
  const doorNode = new Map(); // `${floor}|${spaceId}` -> node id
  const spaces = new Map();   // `${floor}|${spaceId}` -> space
  const addNode = (id, floor, x, z, extra = {}) => {
    if (!nodes.has(id)) { nodes.set(id, { id, floor, x, z, ...extra }); adj.set(id, []); }
    return id;
  };
  const addEdge = (a, b, w, kind = 'walk') => {
    adj.get(a).push({ to: b, w, kind });
    adj.get(b).push({ to: a, w, kind });
  };

  for (const fl of data.floors) {
    const f = fl.level;
    const segs = fl.spines.map(([a, b]) => ({ a, b, horiz: Math.abs(a[1] - b[1]) < EPS, pts: new Map() }));
    const put = (s, x, z) => {
      const k = key(x, z);
      if (!s.pts.has(k)) s.pts.set(k, addNode(`F${f}:${k}`, f, x, z));
      return s.pts.get(k);
    };
    for (const s of segs) { put(s, ...s.a); put(s, ...s.b); }
    // T-junctions and crossings between horizontal and vertical spines
    for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
      const s = segs[i], t = segs[j];
      if (s.horiz === t.horiz) continue;
      const H = s.horiz ? s : t, V = s.horiz ? t : s;
      const x = V.a[0], z = H.a[1];
      const [hx0, hx1] = [H.a[0], H.b[0]].sort((p, q) => p - q);
      const [vz0, vz1] = [V.a[1], V.b[1]].sort((p, q) => p - q);
      if (x >= hx0 - EPS && x <= hx1 + EPS && z >= vz0 - EPS && z <= vz1 + EPS) { put(H, x, z); put(V, x, z); }
    }
    // attach every door to the closest point on any spine of the same floor
    for (const sp of fl.spaces) {
      spaces.set(`${f}|${sp.id}`, sp);
      if (!sp.door || NO_DOOR.has(sp.type)) continue;
      const [dx, dz] = sp.door;
      let best = null;
      for (const s of segs) {
        const [ax, az] = s.a, [bx, bz] = s.b, vx = bx - ax, vz = bz - az, L2 = vx * vx + vz * vz;
        const t = L2 === 0 ? 0 : Math.max(0, Math.min(1, ((dx - ax) * vx + (dz - az) * vz) / L2));
        const px = ax + t * vx, pz = az + t * vz, d = Math.hypot(dx - px, dz - pz);
        if (!best || d < best.d) best = { d, s, px, pz };
      }
      const pid = put(best.s, best.px, best.pz);
      const did = addNode(`F${f}:door:${sp.id}`, f, dx, dz, { spaceId: sp.id });
      addEdge(did, pid, best.d);
      doorNode.set(`${f}|${sp.id}`, did);
    }
    // chain the points along each spine
    for (const s of segs) {
      const pts = [...s.pts.values()].map((id) => nodes.get(id))
        .sort((p, q) => (s.horiz ? p.x - q.x : p.z - q.z));
      for (let i = 1; i < pts.length; i++) addEdge(pts[i - 1].id, pts[i].id, Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
    }
  }
  // vertical links: stairs connect neighbouring floors, the elevator connects every pair
  const levels = data.floors.map((fl) => fl.level).sort((a, b) => a - b);
  const R = data.routing;
  for (const [vid, type] of Object.entries(data.verticals)) {
    for (let i = 0; i < levels.length; i++) for (let j = i + 1; j < levels.length; j++) {
      const a = doorNode.get(`${levels[i]}|${vid}`), b = doorNode.get(`${levels[j]}|${vid}`);
      if (!a || !b) continue;
      if (type === 'stairs' && j === i + 1) addEdge(a, b, R.stairCostPerFloor, 'stairs');
      if (type === 'elevator') addEdge(a, b, R.elevatorWait + R.elevatorCostPerFloor * (levels[j] - levels[i]), 'elevator');
    }
  }
  return { nodes, adj, doorNode, spaces };
}

// Find a space by id (optionally on a given floor). Returns {floor, space} or null.
export function findSpace(graph, id, floor) {
  for (const [k, sp] of graph.spaces) {
    const [f, sid] = k.split('|');
    if (sid === id && (floor == null || Number(f) === floor)) return { floor: Number(f), space: sp };
  }
  return null;
}

// Dijkstra. opts.stepFree = true never uses stairs. Returns {nodes:[...], cost} or null.
export function findRoute(graph, fromKey, toKey, opts = {}) {
  const start = graph.doorNode.get(fromKey), goal = graph.doorNode.get(toKey);
  if (!start || !goal) return null;
  const dist = new Map([[start, 0]]), prev = new Map(), done = new Set();
  const queue = [[0, start]];
  while (queue.length) {
    queue.sort((a, b) => a[0] - b[0]);        // ~400 nodes: a sorted array is fast enough
    const [d, u] = queue.shift();
    if (done.has(u)) continue;
    done.add(u);
    if (u === goal) break;
    for (const e of graph.adj.get(u)) {
      if (opts.stepFree && e.kind === 'stairs') continue;
      const nd = d + e.w;
      if (nd < (dist.get(e.to) ?? Infinity)) { dist.set(e.to, nd); prev.set(e.to, { from: u, kind: e.kind }); queue.push([nd, e.to]); }
    }
  }
  if (!dist.has(goal)) return null;
  const path = [goal];
  while (path[0] !== start) path.unshift(prev.get(path[0]).from);
  const steps = path.map((id, i) => ({ ...graph.nodes.get(id), via: i ? prev.get(id).kind : null }));
  return { nodes: steps, cost: dist.get(goal) };
}
