// The quiet side: three calm places in the outer ring of the first band, away from the rift, so that the band has a second direction. This file
// only lays them out: where each place is, the ground it claims, and the named spots in it that the creatures to come will live by (the next phase
// writes sandflat.js, reef.js and kelpwood.js against exactly this). What is built there (stone, coral, kelp, grass) is built by world.js from this plan,
// with the builders the rest of the band uses, from runs of numbers of the quiet side's own.
//
//   THE SAND FLAT, behind the start (the far side of it from the rift), 80 to 105 m out: level pale sand with nothing tall on it and sea grass at its
//     edge. A low broken ring of kerb stones (the old cistern's rim) where garden eels will be; three or four market tables at one edge where hermit crabs
//     will trade; two burrow spots for a goby and its shrimp; a clear patch of fine sand for a pufferfish's circle.
//   THE REEF HEAD, on the far side of the start from the old kelp field, about 80 m out: coral heads two to four metres tall in a ring round a clear
//     middle where a cleaning station will stand, sea rods among them, a small garden of the band's corals round the outside, and empty spots where
//     more coral can grow, one at a time, in the order given.
//   THE KELP FOREST, the old kelp field grown outward: tall kelp in a band about twenty metres wide reaching out from the field, two or three lanes
//     through it, a clearing at its far end, and one nook off a lane.
//   THE COLONNADE: a sparse line of tall columns from the edge of the town toward each place (for the kelp forest, along its flank out to the clearing),
//     some broken, some fallen. Far tall things show as dark shapes past the fog; that is the only landmark this camera allows.
//   A GATE ARCH at each place, on the side the fish arrives from, wide and tall enough to thread.
//
// Every direction here is a bearing as the game counts it (0 along +z, x = sin, z = cos), and every place is laid in the frame of the start and the
// rift (`rel`: radians round from the way to the rift), so that it holds in every world. Each place searches a little ground of its own for a spot
// clear of everything laid before it (the town, the puzzles, the fragments, the mural, the swarms' pens, the bloom water, the shells), and if none is
// clear it asks for a little less room; it cannot fail (`QUIET.*.fallback`), and the checks look at a thousand worlds.
import { rng, clamp } from './geo.js';

export const QUIET = {
  seed: 52711, // the run of numbers the layout is drawn from: seed * 977 + this. Nothing else in the world draws from it
  // rel: [least, most] radians round from the way to the rift; dist: metres from the start to the middle; R: the ground it claims; level: the sand is
  // made level out to R, and eased back into the bed over `blend` more metres (that ground has to be clear too, so that nothing placed before it moves)
  sandflat: { rel: [Math.PI - 0.5, Math.PI + 0.5], dist: [86, 100], R: 17, blend: 8,
    meadow: { r: 8, at: [-2, -3.5] }, // the cistern rim: its radius, and where its middle is from the place's middle (u toward the arrival side, v to its right)
    tables: { n: 4, v: 11.5, u: [-7, 7], size: [0.95, 1.2] }, // the market tables, in an arc at one edge (which edge is by chance)
    burrows: [[7.5, -10], [-12.5, -8]], puffer: { at: [-11.5, 6.5], r: 2 }, grass: [-1.5, 3.5] }, // grass: the band of sea grass at the edge, from R+a to R+b
  reef: { rel: [1.75, 2.35], dist: [76, 88], R: 15,
    station: 4.5, // the clear middle, where the cleaning station will stand
    heads: { n: [6, 9], ring: [7.5, 10], tall: [2, 4], wide: [1.25, 1.7] }, // coral heads round the middle: how far out, how tall, how wide (radius)
    rods: { n: [5, 7], ring: [6, 12.5], tall: [2.2, 3.4] }, // sea rods among the heads
    grow: { n: 14, ring: [5.6, 13.6], room: 1.6 }, // empty spots for coral to come, at least `n`, each with `room` metres clear round it
    garden: [10.8, 14.2] }, // the small garden of the band's corals, anemones and clams: from this far out to this
  kelpwood: { rel: [-2.3, -1.0], from: 12, froms: [12, 16, 20, 28, 36, 44, 52], long: [34, 14], W: 9, // the forest reaches out from the old field along `rel`, starting `from` metres past its middle, `long` metres (it shortens if it must), `W` either side
    lane: 1.7, // half the width of a lane: kelp keeps this far from its line
    clearing: 6, nook: 1.7, stem: 2.0 }, // the clearing at the far end (radius), the nook (radius), and how far apart the stems of the forest stand
  colonnade: { from: 28, every: [12, 15], before: 8, most: 40, tall: [6.5, 8.6], broken: [2.4, 3.8] }, // from: where the town ends, metres out; before: it stops this short of the arch
  gate: { span: 6.6, tall: 5.8 }, // the arch: between the middles of its two columns, and how tall the columns are
};

const TAU = Math.PI * 2;
const ang = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// Lays the three places out. Called by createWorld for the first band, after the bloom water and before anything is scattered.
//   seed, spawn, goalAngle, size, wrap, height(x, z): the bed as it is meant
//   sites: the ground claimed so far, [x, z, r, what]; field: [x, z] the middle of the old kelp field (its own site is not in the forest's way)
//   swarms: [{ hx, hz, ball }]; bloom: { x, z, R } or null; shells: [[x, z]] where the band's shells will lie; riftIn(x, z); keeper: { x, z, r }
// Returns the plan (world.quiet; see CLAUDE.md for every name in it).
export function layQuiet({ seed, spawn, goalAngle, size, wrap, height, sites, field, swarms, bloom, shells, riftIn, keeper }) {
  const r = rng(seed * 977 + QUIET.seed), rr = (a, b) => a + (b - a) * r();
  const far = (x, z, cx, cz, d) => Math.hypot(wrap(x - cx), wrap(z - cz)) > d;
  const P = (rel, d, from = spawn) => [from.x + Math.sin(goalAngle + rel) * d, from.z + Math.cos(goalAngle + rel) * d];
  const bearing = (ax, az, bx, bz) => Math.atan2(bx - ax, bz - az);
  const inSquare = (x, z, pad) => x - pad >= 1 && z - pad >= 1 && x + pad <= size - 1 && z + pad <= size - 1;
  const claimed = []; // what this phase has claimed so far, [x, z, r]
  // clear of everything laid before (`skip`: a site that does not count), of the rift by `pad` + 8, of the Keeper's ground, the bloom, the swarms and their pens
  const free = (x, z, pad, skip = null) => inSquare(x, z, Math.min(pad, 4)) && sites.every((s) => s === skip || far(x, z, s[0], s[1], s[2] + pad))
    && far(x, z, spawn.x, spawn.z, 8 + pad) && riftIn(x, z) < -(pad + 8) && (!keeper || far(x, z, keeper.x, keeper.z, keeper.r + pad + 4))
    && (!bloom || far(x, z, bloom.x, bloom.z, bloom.R + pad + 6)) && swarms.every((s) => far(x, z, s.hx, s.hz, s.ball * 2.6 + 2 + pad))
    && claimed.every(([cx, cz, cr]) => far(x, z, cx, cz, cr + pad + 3));
  const near = (x, z, d) => shells.some(([sx, sz]) => !far(x, z, sx, sz, d));
  // a place's frame: u toward where the fish arrives from (`facing`), v to its right as it comes in
  const frame = (x, z, facing) => { const fx = Math.sin(facing), fz = Math.cos(facing), vx = Math.cos(facing), vz = -Math.sin(facing);
    return { fx, fz, at: (u, v) => [x + fx * u + vx * v, z + fz * u + vz * v] }; };
  // look for a middle: `tries` goes over the place's own ground in a fixed order of rings and then by chance; R shrinks to `least` if it must
  const seek = (S, R, test) => {
    for (const k of [1, 0.9, 0.8]) for (let t = 0; t < 160; t++) {
      const rel = t < 40 ? (S.rel[0] + S.rel[1]) / 2 + (t % 2 ? 1 : -1) * Math.ceil(t / 2) * (S.rel[1] - S.rel[0]) / 40 : rr(S.rel[0], S.rel[1]);
      const d = t < 40 ? (S.dist[0] + S.dist[1]) / 2 : rr(S.dist[0], S.dist[1]), [x, z] = P(rel, d);
      if (test(x, z, R * k)) return { x, z, R: R * k };
    }
    return null;
  };
  const out = { places: [] };

  // ---------------------------------------------------------------- the sand flat
  { const S = QUIET.sandflat;
    let at = seek(S, S.R, (x, z, R) => free(x, z, R + S.blend) && !near(x, z, R + S.blend + 3));
    if (!at) { const [x, z] = P(Math.PI, 94); at = { x, z, R: S.R * 0.7, fallback: true }; } // nowhere clear: straight behind the start, smaller (never seen in a thousand worlds)
    const { x, z, R } = at, facing = bearing(x, z, spawn.x, spawn.z), f = frame(x, z, facing), k = R / S.R, side = r() < 0.5 ? 1 : -1, V = (v) => v * side * k;
    const [mx, mz] = f.at(S.meadow.at[0] * k, V(S.meadow.at[1]));
    const tables = Array.from({ length: S.tables.n }, (_, i) => { const u = (S.tables.u[0] + (S.tables.u[1] - S.tables.u[0]) * (i / (S.tables.n - 1))) * k, v = V(S.tables.v - Math.abs(u) * 0.12); const [tx, tz] = f.at(u, v); return { x: tx, z: tz, size: rr(S.tables.size[0], S.tables.size[1]), yaw: rr(0, TAU) }; });
    const burrows = S.burrows.map(([u, v]) => { const [bx, bz] = f.at(u * k, V(v)); return { x: bx, z: bz }; });
    const [px, pz] = f.at(S.puffer.at[0] * k, V(S.puffer.at[1]));
    const [gx, gz] = f.at(R - 1.2, 0);
    out.sandflat = { name: 'sandflat', x, z, R, facing, fx: f.fx, fz: f.fz, level: height(x, z), blend: S.blend, fallback: !!at.fallback, side,
      meadow: { x: mx, z: mz, r: S.meadow.r * k }, tables, burrows, puffer: { x: px, z: pz, r: S.puffer.r },
      gate: { x: gx, z: gz, yaw: facing, span: QUIET.gate.span, tall: QUIET.gate.tall } };
    claimed.push([x, z, R]); }

  // ---------------------------------------------------------------- the reef head
  { const S = QUIET.reef;
    let at = seek(S, S.R, (x, z, R) => free(x, z, R + 2) && !near(x, z, R + 3));
    if (!at) { const [x, z] = P(2.05, 82); at = { x, z, R: S.R * 0.7, fallback: true }; }
    const { x, z, R } = at, facing = bearing(x, z, spawn.x, spawn.z), f = frame(x, z, facing), k = R / S.R;
    // the heads: round the middle, leaving the arrival side open (the gate looks straight in at the station)
    const n = S.heads.n[0] + Math.floor(r() * (S.heads.n[1] - S.heads.n[0] + 1)), heads = [];
    for (let i = 0; i < n; i++) { const a = facing + 0.75 + (i / (n - 1)) * (TAU - 1.5) + rr(-0.12, 0.12), d = rr(S.heads.ring[0], S.heads.ring[1]) * k;
      heads.push({ x: x + Math.sin(a) * d, z: z + Math.cos(a) * d, tall: rr(S.heads.tall[0], S.heads.tall[1]), r: rr(S.heads.wide[0], S.heads.wide[1]), yaw: rr(0, TAU) }); }
    const room = (px, pz, d, list) => list.every((o) => Math.hypot(px - o.x, pz - o.z) > d + (o.r || 0));
    const rods = []; const nr = S.rods.n[0] + Math.floor(r() * (S.rods.n[1] - S.rods.n[0] + 1));
    for (let t = 0; t < 400 && rods.length < nr; t++) { const a = rr(0, TAU), d = rr(S.rods.ring[0], S.rods.ring[1]) * k, px = x + Math.sin(a) * d, pz = z + Math.cos(a) * d;
      if (Math.abs(ang(a - facing)) < 0.45) continue; // not across the way in
      if (room(px, pz, 1.4, heads) && room(px, pz, 1.8, rods)) rods.push({ x: px, z: pz, tall: rr(S.rods.tall[0], S.rods.tall[1]), yaw: rr(0, TAU) }); }
    // the spots for coral to come: between the heads first (closing the ring), then a second ring outside it; each clear of what is there and of the others
    const grow = []; const want = S.grow.n;
    for (const [lo, hi, step] of [[S.heads.ring[0] * k, S.heads.ring[1] * k, 0.33], [S.heads.ring[1] * k + 1.6, S.grow.ring[1] * k, 0.24], [S.grow.ring[0] * k, S.grow.ring[1] * k, 0.17]]) {
      for (let a = facing + 0.55; a < facing + TAU - 0.55 && grow.length < want + 4; a += step) { const d = (lo + hi) / 2 + rr(-0.6, 0.6), px = x + Math.sin(a) * d, pz = z + Math.cos(a) * d;
        if (room(px, pz, S.grow.room, heads) && room(px, pz, S.grow.room, rods) && room(px, pz, S.grow.room * 1.6, grow)) grow.push({ x: px, z: pz, r: S.grow.room, ring: lo === S.heads.ring[0] * k ? 'inner' : 'outer', a: ang(a - facing) }); }
      if (grow.length >= want + 4) break;
    }
    for (let t = 0; t < 600 && grow.length < want; t++) { const a = facing + rr(0.5, TAU - 0.5), d = rr(S.grow.ring[0], S.grow.ring[1]) * k, px = x + Math.sin(a) * d, pz = z + Math.cos(a) * d; // and wherever else there is room, until there are enough
      if (room(px, pz, S.grow.room, heads) && room(px, pz, S.grow.room, rods) && room(px, pz, S.grow.room * 1.4, grow)) grow.push({ x: px, z: pz, r: S.grow.room, ring: d < S.heads.ring[1] * k + 0.8 ? 'inner' : 'outer', a: ang(a - facing) }); }
    // the order they fill in: the inner ring first, from the far side round toward the way in, then the outer
    grow.sort((p, q) => (p.ring === q.ring ? Math.abs(q.a) - Math.abs(p.a) : p.ring === 'inner' ? -1 : 1)).forEach((g, i) => { g.order = i; delete g.a; });
    const [gx, gz] = f.at(R - 1.2, 0);
    out.reef = { name: 'reef', x, z, R, facing, fx: f.fx, fz: f.fz, fallback: !!at.fallback, station: { x, z, r: S.station * k }, heads, rods, grow, garden: [S.garden[0] * k, S.garden[1] * k],
      gate: { x: gx, z: gz, yaw: facing, span: QUIET.gate.span, tall: QUIET.gate.tall } };
    claimed.push([x, z, R]); }

  // ---------------------------------------------------------------- the kelp forest, grown out of the old field
  { const S = QUIET.kelpwood, fieldSite = sites.find((s) => Math.abs(s[0] - field[0]) < 1e-6 && Math.abs(s[1] - field[1]) < 1e-6) || null, fx0 = field[0], fz0 = field[1];
    let made = null;
    // the biggest forest that fits as near the old field as it can: grown straight out of it if there is room, wide and long first, then shorter, then
    // narrower; if the town's pens and ruins are in the way, it starts further out, and a thin run of the same kelp joins it to the field (world.js)
    for (const from of S.froms) for (const W of [S.W, S.W - 1.5, S.W - 3]) for (let L = S.long[0]; L >= S.long[1] && !made; L -= 2) for (let t = 0; t < 40 && !made; t++) {
      const rel = (S.rel[0] + S.rel[1]) / 2 + (t % 2 ? 1 : -1) * Math.ceil(t / 2) * (S.rel[1] - S.rel[0]) / 40, dir = goalAngle + rel, ux = Math.sin(dir), uz = Math.cos(dir);
      const A = [fx0 + ux * from, fz0 + uz * from], B = [A[0] + ux * L, A[1] + uz * L];
      let ok = true; for (let s = 0; s <= L && ok; s += 3) ok = free(A[0] + ux * s, A[1] + uz * s, W, fieldSite); ok = ok && free(B[0], B[1], W, fieldSite);
      if (ok) made = { W, L, dir, ux, uz, A, B };
    }
    if (!made) { const dir = goalAngle - 1.5, ux = Math.sin(dir), uz = Math.cos(dir), A = [fx0 + ux * S.from, fz0 + uz * S.from]; made = { W: S.W - 3, L: S.long[1], dir, ux, uz, A, B: [A[0] + ux * S.long[1], A[1] + uz * S.long[1]], fallback: true }; }
    const { W, L, ux, uz, A, B } = made, vx = uz, vz = -ux; // v: to the right, going out
    const pt = (s, v) => [A[0] + ux * s + vx * v, A[1] + uz * s + vz * v];
    const facing = bearing(A[0], A[1], fx0, fz0); // it is come into from the field's side
    // the lanes, as lines of points from the near end: the main lane winds down the middle to the clearing; the second leaves it near the gate, swings out
    // to one side and comes back to the clearing; the third crosses from the main lane out through the other side, a way out of the forest
    const sw = r() < 0.5 ? 1 : -1, wob = rr(0, TAU), end = L - S.clearing * 0.6;
    const main = Array.from({ length: 9 }, (_, i) => { const s = (i / 8) * end; return pt(s, Math.sin(wob + s * 0.18) * W * 0.18 * Math.sin(Math.PI * s / end)); });
    const loop = Array.from({ length: 9 }, (_, i) => { const s = 2 + (i / 8) * (end - 2); return pt(s, sw * W * 0.62 * Math.pow(Math.sin(Math.PI * Math.min(1, s / (end - 1))), 0.7)); });
    const cs = end * rr(0.42, 0.55), cross = Array.from({ length: 5 }, (_, i) => pt(cs + i * 1.2, -sw * (i / 4) * (W + 1.5)));
    cross[0] = main.reduce((b, p) => (Math.hypot(p[0] - cross[1][0], p[1] - cross[1][1]) < Math.hypot(b[0] - cross[1][0], b[1] - cross[1][1]) ? p : b), main[0]);
    const lanes = [{ name: 'main', points: main, half: S.lane }, { name: 'loop', points: loop, half: S.lane }, { name: 'across', points: cross, half: S.lane }];
    const [cx, cz] = pt(L, 0);
    // the nook: off the loop on its outer side, a little way in, out of sight of every lane
    const ns = L * rr(0.55, 0.7), [nx, nz] = pt(ns, sw * Math.min(W - 2, W * 0.62 + S.lane + S.nook + 1.4));
    const gate = { x: A[0] + ux * 1.5, z: A[1] + uz * 1.5, yaw: facing, span: QUIET.gate.span, tall: QUIET.gate.tall };
    const mid = pt(L / 2, 0);
    out.kelpwood = { name: 'kelpwood', x: mid[0], z: mid[1], R: L / 2 + W, facing, fx: Math.sin(facing), fz: Math.cos(facing), fallback: !!made.fallback,
      axis: { ax: A[0], az: A[1], bx: B[0], bz: B[1], half: W, ux, uz }, field: { x: fx0, z: fz0 }, lanes, side: sw,
      clearing: { x: cx, z: cz, r: S.clearing }, nook: { x: nx, z: nz, r: S.nook }, gate };
    for (let s = 0; s <= L; s += W) claimed.push([...pt(s, 0), W]); claimed.push([cx, cz, S.clearing + 1]); }

  // ---------------------------------------------------------------- the colonnade
  { const C = QUIET.colonnade, cols = [], places = [out.sandflat, out.reef, out.kelpwood];
    // a column's spot: on the line or a little to one side of it, clear of all that was before and of the places themselves (except the forest, whose
    // flank it walks), three metres from any shell, and not within ten metres of another column
    const spot = (x, z, nx, nz, own) => { for (const o of [0, 2.5, -2.5, 5, -5, 7.5, -7.5]) { const px = x + nx * o, pz = z + nz * o;
      if (!free(px, pz, 2.5) && !(own && ownOk(px, pz))) continue;
      if (near(px, pz, 3.5) || cols.some((c) => !far(px, pz, c.x, c.z, 10))) continue;
      if (places.some((p) => p !== own && !far(px, pz, p.x, p.z, p.R + 2))) continue;
      return [px, pz]; } return null; };
    let ownOk = () => false;
    const line = (toward, ax, az, bx, bz, own = null) => {
      const len = Math.hypot(bx - ax, bz - az); if (len < 6) return;
      const n = Math.max(1, Math.round(len / ((C.every[0] + C.every[1]) / 2))), ux = (bx - ax) / len, uz = (bz - az) / len, step = len / n;
      let lastStood = true;
      for (let i = 0; i <= n && cols.length < C.most; i++) { const s = i * step, p = spot(ax + ux * s, az + uz * s, uz, -ux, own); if (!p) continue;
        // most stand tall; now and then one is broken off or lies where it fell, but never two in a row that do not stand, so the next can always be seen
        const roll = r(), state = !lastStood || i === 0 || i === n ? 'standing' : roll < 0.2 ? 'broken' : roll < 0.36 ? 'fallen' : 'standing';
        lastStood = state === 'standing';
        cols.push({ x: p[0], z: p[1], toward, state, h: state === 'standing' ? rr(C.tall[0], C.tall[1]) : state === 'broken' ? rr(C.broken[0], C.broken[1]) : rr(4, 5.5), yaw: state === 'fallen' ? rr(0, TAU) : bearing(ax, az, bx, bz), i: cols.length }); }
    };
    for (const p of [out.sandflat, out.reef]) { const d = Math.hypot(wrap(p.gate.x - spawn.x), wrap(p.gate.z - spawn.z)), ux = wrap(p.gate.x - spawn.x) / d, uz = wrap(p.gate.z - spawn.z) / d;
      line(p.name, spawn.x + ux * C.from, spawn.z + uz * C.from, p.gate.x - ux * C.before, p.gate.z - uz * C.before); }
    { const K = out.kelpwood, a = K.axis, side = -K.side, off = a.half + 3.5; // along the flank the loop does not bulge toward, from beside the gate out to the clearing
      ownOk = (x, z) => { const s = (x - a.ax) * a.ux + (z - a.az) * a.uz, v = (x - a.ax) * a.uz - (z - a.az) * a.ux; return Math.abs(v) > a.half + 1.5 && s > -2 && s < Math.hypot(a.bx - a.ax, a.bz - a.az) + 8; };
      line('kelpwood', a.ax + a.uz * side * off + a.ux * 4, a.az - a.ux * side * off + a.uz * 4, a.bx + a.uz * side * off + a.ux * 4, a.bz - a.ux * side * off + a.uz * 4, K); }
    out.colonnade = cols; }

  out.places = [out.sandflat, out.reef, out.kelpwood];
  out.claimed = claimed; // [x, z, r]: the ground the places take, for the world's own list of claimed ground
  return out;
}

// how far a point is from a lane (a line of points), and where along it
export function laneDistance(lane, x, z) {
  let best = Infinity;
  for (let i = 0; i + 1 < lane.points.length; i++) { const [ax, az] = lane.points[i], [bx, bz] = lane.points[i + 1], dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz || 1e-9;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / L, 0, 1); best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t)); }
  return best;
}
