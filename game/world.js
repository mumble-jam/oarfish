// One depth band of the dive: the seabed and everything rooted on it.
// The world repeats every T metres in x and z; fog hides the seam, so it reads as open water.

import * as THREE from 'three';
import { rng, lerp, clamp, soup, M, glowTexture, beamTexture, poolTexture } from './geo.js';
import { mesher, ringY, ringZ, shaded, alive, tint, dim, bright, growing, WAKE } from './kit.js';
import { swarmKit, swarmFor, register, tonesOf, paintOf, stoneOf, TEMPER } from './npc.js';

export const T = 144;
const CELL = 3, GRID = 46, NCELL = T / CELL;
const K = (Math.PI * 2) / T;
export const SPAWN = new THREE.Vector3(T / 2, 0, T / 2);
export const wrapD = (d) => d - T * Math.round(d / T); // shortest way round the repeating world

// Swarms of small fish are the treasure chests: a swarm is only caught whole, by a body long enough to
// go round the entire ball, so the big ones wait for a long body. n fish, ball radius r in metres.
export const SWARMS = { s: { n: 8, r: 0.42 }, m: { n: 18, r: 0.76 }, l: { n: 36, r: 1.05 }, h: { n: 70, r: 1.34 } };
// Not every swarm waits to be gone round. Each band's `kinds` gives one letter to a swarm of its `schools`: '.' the plain sort; and
//   b  bolts: come at from the side or from below it goes straight up, out of the plane the body turns in. It holds for a body that is over it.
//   t  twins: cornered, it parts in two along the line its two lobes lie on, each half a swarm one size down. Left alone the halves mend.
//   g  glow-seekers: in the dark they will not bunch at all. Frightened, they run, bearing for the nearest lantern flower, and bunch in its light.
// The loop that takes them is the same loop; what differs is how the swarm is brought to hold still for it.
export { TEMPER };
const KIND = { b: 'bolt', t: 'twin', g: 'glow' }, LOWER = { m: 's', l: 'm' };
// A cleaning station: a coral head kept by cleaner wrasse, one to a band where there are tail-biters. A head held still over it (within `reach`, slower
// than `still`) for `time` seconds has a segment grown back; a station does this `uses` times in a dive, with `rest` seconds between. While the cleaners
// work nothing bites, but up to `most` of the tail-biters within `call` metres come and go round, closing from the first of `ring` to the second; when
// the work is done they start back from the body for `start` seconds; done or broken off, it is `grace` seconds before any of them hunts again.
export const CLEAN = { reach: 3.2, still: 0.9, time: 7, uses: 2, rest: 25, call: 32, ring: [7.5, 3.4], most: 3, grace: 1.6, start: 0.9, fish: 6 };
// What counts as ringing something. `assist` (0..1) is the one feel setting: with more of it the body
// need not go quite all the way round, and the ball packs a little tighter to fit inside.
export const wrapRule = (assist) => ({ sweep: Math.PI * 2 * lerp(0.93, 0.8, assist), squeeze: lerp(0.96, 0.84, assist) });
const GATE = wrapRule(0.6); // which body length may take which swarm never depends on the assist setting
export const canWrap = (total, room) => (0.9 * total) / GATE.sweep >= room * GATE.squeeze + 0.12;

// The five bands of the dive. Counts are per band; light fades and the hunters multiply on the way down.
export const FLOORS = [
  { name: 'The sunlight zone', depth: 40, water: '#2b93a3', sky: '#e2f8ff', bed: '#4f97a0', hemi: 2.0, sun: 2.3, lamp: 0, lampReach: 30, fog: [0.75, 42], seaLight: 0.2, shafts: 0.42, fishGlow: 0, finGlow: 0,
    rocks: 170, kelp: 46, coral: 150, glow: 0, schools: 'sssssmmlh', kinds: '......b..', biters: 0, hooks: 2, anglers: 0, ruins: ['ring', 'gate', 'remains'] },
  { name: 'The edge of light', depth: 180, water: '#1d6f8e', sky: '#bfe6f5', bed: '#2f6f85', hemi: 1.5, sun: 1.35, lamp: 3, lampReach: 26, fog: [0.7, 36], seaLight: 0.1, shafts: 0.22, fishGlow: 0.2, finGlow: 0.12,
    rocks: 180, kelp: 34, coral: 90, glow: 30, schools: 'ssssmmml', kinds: '...b.t..', biters: 3, hooks: 6, anglers: 0, ruins: ['gate', 'remains', 'arch'] },
  { name: 'The twilight zone', depth: 450, water: '#12426a', sky: '#7fb4d8', bed: '#173f5e', hemi: 0.85, sun: 0.4, lamp: 10, lampReach: 24, fog: [0.62, 28], seaLight: 0.03, shafts: 0, fishGlow: 0.7, finGlow: 0.3,
    rocks: 200, kelp: 14, coral: 40, glow: 110, schools: 'sssmmllh', kinds: '.gbtg.t.', biters: 5, hooks: 4, anglers: 3, ruins: ['ring', 'remains'] },
  { name: 'Deep twilight', depth: 800, water: '#0a2444', sky: '#4d7fb0', bed: '#0d2a4a', hemi: 0.42, sun: 0, lamp: 16, lampReach: 21, fog: [0.55, 22], seaLight: 0, shafts: 0, fishGlow: 1, finGlow: 0.5,
    rocks: 210, kelp: 0, coral: 14, glow: 170, schools: 'ssmmllh', kinds: '.gbtg..', biters: 6, hooks: 2, anglers: 5, ruins: ['gate', 'remains', 'arch'] },
  { name: 'Ryūgū, the palace below', depth: 1000, water: '#07142e', sky: '#3c6aa0', bed: '#0a1c3a', hemi: 0.3, sun: 0, lamp: 17, lampReach: 19, fog: [0.5, 20], seaLight: 0, shafts: 0, fishGlow: 1, finGlow: 0.6,
    rocks: 190, kelp: 0, coral: 30, glow: 200, schools: 'smmllh', kinds: '.btg..', biters: 6, hooks: 0, anglers: 6, ruins: ['remains'] },
];

function hash2(ix, iz, salt = 0) {
  ix = ((ix % NCELL) + NCELL) % NCELL; iz = ((iz % NCELL) + NCELL) % NCELL;
  let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(salt, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ---------------------------------------------------------------- geometry, built once and shared by every band
let GEO = null;
function geometries() {
  if (GEO) return GEO;
  const rand = rng(4242);
  const rock = new THREE.IcosahedronGeometry(1, 1);
  {
    const a = rock.attributes.position, seen = new Map();
    for (let i = 0; i < a.count; i++) {
      const key = `${a.getX(i).toFixed(3)},${a.getY(i).toFixed(3)},${a.getZ(i).toFixed(3)}`;
      if (!seen.has(key)) seen.set(key, 0.78 + rand() * 0.4);
      const f = seen.get(key);
      a.setXYZ(i, a.getX(i) * f, a.getY(i) * f, a.getZ(i) * f);
    }
    rock.computeVertexNormals();
  }
  // --- stonework. Each piece is white with its own shading baked in; the instance colour is the stone.
  const grey = (k) => dim('#ffffff', k);
  const plain = (parts) => { const m = mesher(); for (const [g, mx, c] of parts) m.add(g, mx, c || '#ffffff'); return m.geometry(); };
  // darker toward the foot, where silt gathers and less light reaches
  const grounded = (geo, lo = 0.78, hi = 1.03) => {
    geo.computeBoundingBox(); const { min, max } = geo.boundingBox, c = geo.attributes.color, p = geo.attributes.position;
    for (let i = 0; i < c.count; i++) { const k = lerp(lo, hi, (p.getY(i) - min.y) / Math.max(max.y - min.y, 1e-6)); c.setXYZ(i, c.getX(i) * k, c.getY(i) * k, c.getZ(i) * k); }
    return geo;
  };
  // a drum of a fluted column, one unit tall: eight flutes, the faces of each a little apart in tone
  const flutes = (i, k) => [grey(k % 2 ? 0.8 : 0.95), grey(k % 2 ? 0.86 : 1.02)];
  const fluted = (y) => ringY(y, 0.5, 16, { star: 0.9 });
  const shaft = (bottom) => { const m = mesher().skin([fluted(0), fluted(1)], flutes).cap(fluted(1), [0, 1, 0], grey(0.97)); if (bottom) m.cap(fluted(0), [0, -1, 0], grey(0.8)); return m.geometry(); };
  // a column snapped off: the break climbs to one side and is hollowed where the core came away
  const stump = (() => {
    const top = fluted(0).map((p, k) => [p[0], 0.16 + 0.5 * Math.max(0, Math.sin(k * 0.39 + 0.4)) + 0.22 * ((k * 7) % 5) / 4, p[2]]);
    return mesher().skin([fluted(0), top], flutes).cap(top, [0, 1, 0], grey(0.82), -0.3).geometry();
  })();
  const lathe = (profile, n, paint, capTop) => { const rings = profile.map(([r, y]) => ringY(y, r, n)), m = mesher().skin(rings, paint); if (capTop) m.cap(rings[rings.length - 1], [0, 1, 0], capTop); return m; };
  // the moulding a column stands on, and the cushion under its top slab
  const base = lathe([[0.6, 0], [0.7, 0.06], [0.7, 0.13], [0.57, 0.2]], 10, (i) => grey([0.8, 0.95, 1.0][i]), grey(0.9)).geometry();
  const echinus = lathe([[0.5, 0], [0.58, 0.04], [0.52, 0.08], [0.75, 0.2]], 10, (i) => grey([0.92, 0.78, 1.0][i]), grey(0.9)).geometry();
  // a paving flag: no two corners alike
  const flag = (() => { const r = [0.5, 0.42, 0.52, 0.38, 0.5, 0.46], ring = (y, k) => r.map((d, i) => { const a = (i / 6) * Math.PI * 2 + (i % 2) * 0.2; return [Math.sin(a) * d * k, y, Math.cos(a) * d * k]; });
    return mesher().skin([ring(0, 1.04), ring(1, 1)], grey(0.74)).cap(ring(1, 1), [0, 1, 0], [grey(1), grey(0.93), grey(0.97)]).geometry(); })();
  // a chunk of broken masonry
  const rubble = (() => { const g = new THREE.BoxGeometry(1, 0.7, 0.8).toNonIndexed(), a = g.attributes.position, seen = new Map();
    for (let i = 0; i < a.count; i++) { const key = `${a.getX(i)},${a.getY(i)},${a.getZ(i)}`; if (!seen.has(key)) seen.set(key, [rand() * 0.3 - 0.15, rand() * 0.24 - 0.12, rand() * 0.3 - 0.15]); const d = seen.get(key); a.setXYZ(i, a.getX(i) + d[0], a.getY(i) + d[1] + 0.35, a.getZ(i) + d[2]); }
    return grounded(plain([[g, null]]), 0.74, 1.04); })();
  // a storage jar, whole: foot, belly, shoulder, neck, lip, two handles, a painted band
  const jar = (broken) => {
    const prof = [[0.09, 0], [0.13, 0.04], [0.3, 0.3], [0.34, 0.5], [0.27, 0.72], [0.11, 0.84], [0.1, 0.94], [0.15, 1]];
    const tone = [0.62, 0.9, 1, 0.5, 0.92, 0.8, 0.66];
    if (broken) { const rings = prof.slice(0, 5).map(([r, y]) => ringY(y, r, 8)); rings[4] = rings[4].map((p, k) => [p[0], 0.5 + 0.3 * ((k * 5) % 8) / 8, p[2]]); return mesher().skin(rings, (i) => grey(tone[i])).cap(rings[0], [0, -1, 0], grey(0.5)).skin([rings[4].map((p) => [p[0] * 0.86, p[1], p[2] * 0.86]), rings[3].map((p) => [p[0] * 0.86, p[1], p[2] * 0.86]), ringY(0.1, 0.1, 8)], grey(0.34)).geometry(); }
    const m = lathe(prof, 8, (i) => grey(tone[i]), grey(0.3));
    for (const sx of [-1, 1]) m.add(new THREE.TorusGeometry(0.1, 0.022, 3, 5, Math.PI), M(sx * 0.2, 0.8, 0, 0, 0, sx > 0 ? -Math.PI / 2 : Math.PI / 2), grey(0.8));
    return m.geometry();
  };
  // a potsherd, a roof tile, a broken plate: something thin with a curve to it
  const shard = mesher().tri([-0.2, 0.02, -0.12], [0.22, 0.05, -0.05], [0, 0.1, 0.2], [grey(1), grey(0.8), grey(0.92)]).tri([-0.2, 0.02, -0.12], [0, 0.1, 0.2], [-0.16, 0, 0.14], grey(0.7)).tri([0.22, 0.05, -0.05], [0.2, 0, 0.16], [0, 0.1, 0.2], grey(0.82)).geometry();
  // the people's ring: a body closed on itself, segment by segment. The nursery's hoops are made of it
  const wreath = (() => { const m = mesher(), n = 18;
    for (let i = 0; i < n; i++) { const a0 = (i / n) * Math.PI * 2 + 0.02, a1 = ((i + 1) / n) * Math.PI * 2 - 0.02, sec = (a, s) => [[0.14, 0], [0, 0.17], [-0.12, 0], [0, -0.13]].map(([r, y]) => [Math.sin(a) * (1 + r * s), Math.cos(a) * (1 + r * s), y * s]);
      m.skin([sec(a0, 0.86), sec((a0 + a1) / 2, 1.05), sec(a1, 0.86)], grey(i % 3 ? 1 : 0.72)); }
    return m.geometry(); })();
  // --- what grows and what lies about. White with shading baked in, like the stone: the instance is the colour.
  const add3 = (p, d, k) => [p[0] + d[0] * k, p[1] + d[1] * k, p[2] + d[2] * k];
  const aim = (yaw, tilt) => [Math.sin(yaw) * Math.sin(tilt), Math.cos(tilt), Math.cos(yaw) * Math.sin(tilt)];
  // kelp: four broad blades, each folded along its midrib so the two halves take the light differently, the edges
  // ruffled, the tip paler; and round the foot a few young blades on their floats
  const kelpGeo = (() => { const m = mesher(), segs = 6;
    for (let b = 0; b < 4; b++) {
      const yaw = (b / 4) * Math.PI * 2 + rand() * 0.8, lean = 0.12 + rand() * 0.2, h = 0.68 + rand() * 0.32, c = Math.cos(yaw), sn = Math.sin(yaw), fold = 0.03;
      // a point on the blade: i along it, side -1 (one edge), 0 (the midrib, pushed out of the plane), 1 (the other edge)
      const pt = (i, side) => { const y = i / segs, wd = 0.085 * Math.pow(Math.sin(Math.PI * (0.1 + 0.9 * y)), 0.75) * (1 + (i % 2 ? 0.16 : -0.1) * Math.abs(side)), o = lean * y * y + (side ? 0 : fold * Math.sin(Math.PI * y)) + (i % 2 ? 0.02 : -0.02);
        return [o * c - wd * side * sn, y * h, o * sn + wd * side * c]; };
      for (let i = 0; i < segs; i++) { const k = 0.56 + 0.4 * (i / segs), k1 = 0.56 + 0.4 * ((i + 1) / segs), tip = i === segs - 1;
        m.quad(pt(i, -1), pt(i, 0), pt(i + 1, 0), pt(i + 1, -1), [grey(k * 0.8), grey(k * 0.8), tip ? bright(1.15) : grey(k1 * 0.8)]);
        m.quad(pt(i, 0), pt(i, 1), pt(i + 1, 1), pt(i + 1, 0), [grey(k), grey(k), tip ? bright(1.3) : grey(k1)]); }
    }
    for (let i = 0; i < 4; i++) { const yaw = i * 1.7 + rand(), o = [Math.sin(yaw), Math.cos(yaw)], base = [o[0] * 0.05, 0.05 + 0.05 * i, o[1] * 0.05], L = 0.2 + 0.08 * rand();
      const tipP = [base[0] + o[0] * L, base[1] + 0.07, base[2] + o[1] * L], mid = [base[0] + o[0] * L * 0.5, base[1] + 0.02, base[2] + o[1] * L * 0.5];
      m.tri(base, [mid[0] - o[1] * 0.04, mid[1], mid[2] + o[0] * 0.04], tipP, [grey(0.6), grey(0.8), bright(1.1)]).tri(base, tipP, [mid[0] + o[1] * 0.04, mid[1] + 0.012, mid[2] - o[0] * 0.04], [grey(0.5), bright(1.1), grey(0.7)]);
      m.limb([base[0], base[1] - 0.012, base[2]], [base[0] + o[0] * 0.05, base[1] + 0.012, base[2] + o[1] * 0.05], 0.014, 0.02, 3, '#f6ee9a'); }
    return m.geometry(); })();
  // a tuft of seagrass
  const tuft = (() => { const m = mesher();
    for (let b = 0; b < 6; b++) { const yaw = b * 1.05 + rand(), lean = 0.12 + 0.34 * rand(), h = 0.55 + 0.45 * rand(), c = Math.cos(yaw), sn = Math.sin(yaw), w = 0.024;
      const at = (t, sg) => [lean * t * t * sn + c * w * sg * (1 - t * 0.6), t * h, lean * t * t * c - sn * w * sg * (1 - t * 0.6)];
      m.quad(at(0, -1), at(0, 1), at(0.55, 1), at(0.55, -1), grey(0.62)).tri(at(0.55, -1), at(0.55, 1), at(1, 0), [grey(0.8), grey(0.8), bright(1.15)]); }
    return m.geometry(); })();
  // staghorn coral: each branch forks, and the growing tips are pale
  const stag = (() => { const m = mesher();
    for (let i = 0; i < 6; i++) { const yaw = i * 1.05 + rand(), tilt = i ? 0.3 + rand() * 0.5 : 0.08, h = 0.38 + rand() * 0.5, a = [Math.sin(yaw) * 0.1, 0, Math.cos(yaw) * 0.1], b = add3(a, aim(yaw, tilt), h);
      m.limb(a, b, 0.11, 0.07, 4, [grey(0.58), grey(0.92)]);
      for (const sg of [-1, 1]) { const c = add3(b, aim(yaw + sg * (0.7 + rand() * 0.5), tilt + 0.3), 0.2 + rand() * 0.2); m.limb(b, c, 0.06, 0.016, 4, [grey(0.92), bright(1.5)]); } }
    return m.geometry(); })();
  // table coral: tiers of plates with a scalloped, paler rim, dark underneath
  const tableGeo = (() => { const m = mesher();
    const plate = (cx, cy, cz, r, tx, tz, k) => { const rim = (s, dy) => Array.from({ length: 9 }, (_, i) => { const a = (i / 9) * Math.PI * 2, d = r * s * (0.8 + 0.2 * Math.sin(i * 2.4 + k)), x = Math.sin(a) * d, z = Math.cos(a) * d; return [cx + x, cy + dy + x * tx + z * tz, cz + z]; });
      const top = rim(1, 0), under = rim(0.84, -0.07);
      m.cap(top, [0, 1, 0], [grey(0.72), bright(1.18), bright(1.18)], 0.03).skin([under, top], [grey(0.5), grey(0.95)]).cap(under, [0, -1, 0], grey(0.42), 0.16); };
    m.limb([0, 0, 0], [0, 0.6, 0], 0.2, 0.11, 5, [grey(0.5), grey(0.7)]);
    plate(0, 0.66, 0, 1, 0.07, 0.03, 0.4); plate(0.36, 0.9, 0.2, 0.56, -0.08, 0.05, 2.1); plate(-0.3, 1.06, -0.24, 0.36, 0.05, -0.09, 3.3);
    return m.geometry(); })();
  // brain coral: a dome, its ridges and valleys in two tones
  const brain = (() => { const g = new THREE.IcosahedronGeometry(1, 1).toNonIndexed(), a = g.attributes.position, m = mesher();
    for (let i = 0; i < a.count; i += 3) { const p = [0, 1, 2].map((k) => [a.getX(i + k), a.getY(i + k) * 0.62, a.getZ(i + k)]), cy = (p[0][1] + p[1][1] + p[2][1]) / 3, cx = (p[0][0] + p[1][0] + p[2][0]) / 3, cz = (p[0][2] + p[1][2] + p[2][2]) / 3;
      if (cy < -0.12) continue;
      m.tri(p[0], p[1], p[2], grey(Math.sin(Math.atan2(cx, cz) * 5 + cy * 9) > 0 ? 1 : 0.7)); }
    return m.geometry(); })();
  // a sea fan: one flat spray of branches
  const seaFan = (() => { const m = mesher();
    const branch = (x, y, ang, len, w, depth) => { const x2 = x + Math.sin(ang) * len, y2 = y + Math.cos(ang) * len, px = Math.cos(ang), py = -Math.sin(ang), z = (depth % 2 ? 0.012 : -0.012);
      m.quad([x - px * w, y - py * w, z], [x + px * w, y + py * w, z], [x2 + px * w * 0.6, y2 + py * w * 0.6, z], [x2 - px * w * 0.6, y2 - py * w * 0.6, z], [grey(0.55 + 0.12 * depth), grey(0.55 + 0.12 * depth), depth === 3 ? bright(1.3) : grey(0.67 + 0.12 * depth)]);
      if (depth < 3) { branch(x2, y2, ang - 0.42 + rand() * 0.2, len * 0.74, w * 0.62, depth + 1); branch(x2, y2, ang + 0.42 - rand() * 0.2, len * 0.74, w * 0.62, depth + 1); if (!depth) branch(x2, y2, ang, len * 0.85, w * 0.62, 1); } };
    branch(0, 0, 0, 0.28, 0.035, 0);
    return m.geometry(); })();
  // tube sponges: open chimneys, wider at the lip, dark inside
  const sponge = (() => { const m = mesher();
    for (let i = 0; i < 4; i++) { const yaw = i * 1.6 + rand(), d = i ? 0.16 : 0, a = [Math.sin(yaw) * d, 0, Math.cos(yaw) * d], h = i ? 0.45 + rand() * 0.35 : 0.95, b = add3(a, aim(yaw, i ? 0.22 : 0.04), h);
      m.limb(a, b, 0.09, 0.14, 6, [grey(0.55), bright(1.1)]).cap(m.last, [0, 1, 0], grey(0.2), -0.3); }
    return m.geometry(); })();
  // an anemone: a short column and a crown of tentacles with pale ends
  const anemone = (() => { const m = mesher();
    m.tuck((p) => [p[0] * 1.12, p[1] * 0.72, p[2] * 1.12]); // touched, the column squats and the crown is drawn in over the mouth
    m.limb([0, 0, 0], [0, 0.2, 0], 0.17, 0.22, 7, [grey(0.5), grey(0.75)]).cap(m.last, [0, 1, 0], grey(0.45), -0.03);
    for (let i = 0; i < 11; i++) { const yaw = (i / 11) * Math.PI * 2 + rand() * 0.3, t0 = 0.5 + rand() * 0.5, a = [Math.sin(yaw) * 0.16, 0.2, Math.cos(yaw) * 0.16], b = add3(a, aim(yaw, t0), 0.22), c = add3(b, aim(yaw, t0 - 0.5), 0.2 + rand() * 0.12);
      m.tuck([Math.sin(yaw) * 0.1, 0.15, Math.cos(yaw) * 0.1], 0.86);
      m.limb(a, b, 0.04, 0.03, 3, [grey(0.7), grey(0.95)]).limb(b, c, 0.03, 0.008, 3, [grey(0.95), bright(1.6)]); }
    return m.tuck().geometry(); })();
  // a starfish (arm 0.38) or, with thin arms, a brittle star
  const star = (waist, lift) => { const m = mesher(), top = [0, lift, 0], pts = Array.from({ length: 10 }, (_, k) => { const a = (k / 10) * Math.PI * 2, r = k % 2 ? waist : 1; return [Math.sin(a) * r, k % 2 ? lift * 0.45 : 0.01, Math.cos(a) * r]; });
    for (let k = 0; k < 10; k++) m.out(top, pts[k], pts[(k + 1) % 10], [0, -1, 0], k % 2 ? [grey(0.72), grey(0.8), bright(1.25)] : [grey(0.72), bright(1.25), grey(0.8)]);
    return m.geometry(); };
  // a small urchin on the bed
  const urchin = (() => { const m = mesher(); m.cap(ringY(0, 0.42, 7), [0, 1, 0], [grey(0.75), grey(0.45), grey(0.45)], 0.36);
    for (let i = 0; i < 10; i++) { const yaw = i * 2.4, tilt = 0.25 + (i % 5) * 0.27, a = add3([0, 0.12, 0], aim(yaw, tilt), 0.25); m.limb(a, add3(a, aim(yaw, tilt), 0.45 + (i % 3) * 0.14), 0.035, 0.004, 3, [grey(0.5), bright(1.3)]); }
    return m.geometry(); })();
  // a clam, or what is left of one: two ribbed valves, standing open
  const clam = (() => { const m = mesher();
    for (const [open, k] of [[0.06, 1], [0.8, 0.85]]) { const rim = Array.from({ length: 6 }, (_, i) => { const a = -0.95 + (i / 5) * 1.9, d = 1 - 0.07 * (i % 2); return [Math.sin(a) * d * 0.9, Math.sin(open) * Math.cos(a) * d + (i % 2 ? 0.03 : 0), Math.cos(open) * Math.cos(a) * d]; });
      if (open > 0.5) { const c = Math.cos(open - 0.14), sn = Math.sin(open - 0.14); m.tuck((p) => [p[0], p[1] * c - p[2] * sn, p[2] * c + p[1] * sn]); } // the standing valve shuts, turning on the hinge
      for (let i = 0; i < 5; i++) m.tri([0, 0, 0], rim[i], rim[i + 1], [grey(0.5 * k), i % 2 ? bright(1.15 * k) : grey(0.86 * k), i % 2 ? grey(0.86 * k) : bright(1.15 * k)]); }
    return m.tuck().geometry(); })();
  const pebble = (() => { const g = new THREE.OctahedronGeometry(1, 0), a = g.attributes.position; for (let i = 0; i < a.count; i++) a.setXYZ(i, a.getX(i) * 1.1, a.getY(i) * 0.5 + 0.2, a.getZ(i) * 0.8); return grounded(plain([[g, null]]), 0.7, 1.06); })();
  // a sea lily: a jointed stalk and a cup of arms that curl in
  const lily = (() => { const m = mesher(), top = [0.05, 0.6, 0.02];
    m.limb([0, 0, 0], [0.03, 0.3, 0], 0.03, 0.026, 4, grey(0.55)).limb([0.03, 0.3, 0], top, 0.026, 0.035, 4, grey(0.65));
    for (let i = 0; i < 9; i++) { const yaw = (i / 9) * Math.PI * 2, o = aim(yaw, 1.0), s = [Math.cos(yaw), 0, -Math.sin(yaw)], w = 0.03;
      const at = (t) => [top[0] + o[0] * 0.3 * Math.sin(t * 2.0), top[1] + 0.42 * t, top[2] + o[2] * 0.3 * Math.sin(t * 2.0)], side = (p, sg, k) => [p[0] + s[0] * w * sg * k, p[1], p[2] + s[2] * w * sg * k];
      m.tuck((p) => [top[0] + (p[0] - top[0]) * 0.22, top[1] + (p[1] - top[1]) * 0.8, top[2] + (p[2] - top[2]) * 0.22]); // the arms close up over the cup
      for (let j = 0; j < 3; j++) { const p = at(j / 3), q = at((j + 1) / 3); m.quad(side(p, -1, 1 - j * 0.25), side(p, 1, 1 - j * 0.25), side(q, 1, 0.75 - j * 0.25), side(q, -1, 0.75 - j * 0.25), [grey(0.7 + 0.1 * j), grey(0.7 + 0.1 * j), j === 2 ? bright(1.4) : grey(0.8 + 0.1 * j)]); } }
    return m.tuck().geometry(); })();
  // a glass sponge: a pale vase of lattice
  const glass = (() => { const rings = [[0.05, 0], [0.13, 0.3], [0.19, 0.68], [0.25, 1]].map(([r, y]) => ringY(y, r, 7, { x: 0.05 * y * y }));
    return mesher().skin(rings, (i, k) => grey((i + k) % 2 ? 1 : 0.66)).cap(rings[3], [0, 1, 0], grey(0.3), -0.42).geometry(); })();
  // tube worms: white tubes, red plumes. Coloured in itself
  const worms = (() => { const m = mesher();
    for (let i = 0; i < 6; i++) { const yaw = i * 1.9 + rand(), d = 0.05 + 0.13 * (i % 3), a = [Math.sin(yaw) * d, 0, Math.cos(yaw) * d], h = 0.4 + rand() * 0.6, b = add3(a, aim(yaw, 0.1 + rand() * 0.25), h);
      m.tuck().limb(a, b, 0.05, 0.042, 5, ['#9a968c', '#efeadc']);
      m.tuck(add3(b, aim(yaw, 0.1), -0.07)); // the plume is gone down the tube before anything can touch it
      for (let k = 0; k < 4; k++) { const t = add3(b, aim(yaw + k * 1.57, 0.6), 0.2); m.tri(b, [t[0] - 0.03, t[1], t[2] - 0.03], [t[0] + 0.03, t[1], t[2] + 0.03], ['#a81f3c', '#ff5b6e', '#ff5b6e']); } }
    return m.tuck().geometry(); })();
  // a sea pen: a quill that makes its own light along its vanes
  const pen = (() => { const m = mesher(), spine = (t) => [0.1 * t * t, t, 0.02 * Math.sin(t * 5)];
    m.tuck((p) => { const s = spine(p[1]); return [s[0] * 0.3, p[1] * 0.3, s[2] * 0.3]; }, 0.9); // the vanes fold to the quill and the quill goes down into the bed
    m.limb(spine(0), spine(0.3), 0.03, 0.022, 3, grey(0.3));
    for (let i = 0; i < 7; i++) { const t = 0.3 + i * 0.1, p = spine(t), q = spine(t + 0.1), L = 0.2 * (1 - i / 9);
      m.limb(p, q, 0.022 - i * 0.002, 0.02 - i * 0.002, 3, grey(0.4));
      for (const sg of [-1, 1]) m.tri(p, [p[0] + 0.02, p[1] + 0.13, p[2] + sg * L], q, [grey(0.5), bright(1.1), grey(0.6)], true); }
    return m.tuck().geometry(); })();
  // the lantern flower of the dark bands: the stalk bows over and the light hangs from it in its sepals
  const lantern = (() => { const m = mesher(), arc = [[0, 0, 0], [0.03, 0.45, 0], [0.09, 0.82, 0], [0.2, 0.98, 0], [0.31, 0.9, 0]];
    for (let i = 0; i < 4; i++) m.limb(arc[i], arc[i + 1], 0.03 - i * 0.004, 0.026 - i * 0.004, 3, grey(0.22 + 0.04 * i));
    for (const sg of [-1, 1]) m.tri([0.01, 0.12, 0], [0.04, 0.34, sg * 0.16], [0.03, 0.3, 0], [grey(0.25), grey(0.4), grey(0.3)]);
    const c = [0.31, 0.74, 0], bud = [ringY(c[1] + 0.1, 0.05, 5, { x: c[0] }), ringY(c[1], 0.11, 5, { x: c[0] }), ringY(c[1] - 0.13, 0.03, 5, { x: c[0] })];
    m.skin(bud, (i) => (i ? [bright(1.1), bright(0.7)] : [bright(0.8), bright(1.1)]), true).cap(bud[2], [0, -1, 0], bright(0.7), 0.04, true);
    for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; m.tri([c[0], c[1] + 0.17, 0], [c[0] + Math.sin(a - 0.5) * 0.09, c[1] + 0.06, Math.cos(a - 0.5) * 0.09], [c[0] + Math.sin(a + 0.5) * 0.09, c[1] + 0.06, Math.cos(a + 0.5) * 0.09], grey(0.3)); }
    return m.geometry(); })();
  const rockGeo = (() => { const m = mesher().add(rock, null, '#ffffff'); const g = grounded(m.geometry(), 0.66, 1.06); return g; })();
  // a chime: a flat bar of bronze on a cord, hanging from where it is put, one long (it is stretched to its length). The band near its
  // foot is painted, and lit where there is no other light to find it by
  const chime = (() => { const m = mesher(), at = (y, k = 1) => ringY(y, 0.115 * k, 4, { turn: Math.PI / 4, squash: 0.3 });
    m.limb([0, 0, 0], [0, -0.43, 0], 0.011, 0.011, 3, grey(0.3));
    m.cap(at(-0.42, 0.8), [0, 1, 0], grey(0.75), 0.012).skin([at(-0.42, 0.8), at(-0.47), at(-0.83)], (i) => (i ? [grey(0.95), bright(1.08)] : [grey(0.75), grey(0.95)]));
    m.skin([at(-0.83), at(-0.9)], bright(1.7), true).skin([at(-0.9), at(-1)], [bright(1.08), grey(0.8)]).cap(at(-1), [0, -1, 0], grey(0.6), 0.01);
    return m.geometry(); })();
  GEO = {
    rock: rockGeo, kelp: kelpGeo, chime, tuft, stag, brain, seaFan, sponge, anemone, star: star(0.38, 0.14), brittle: star(0.13, 0.07), urchin, clam, pebble, lily, glass, worms, pen, lantern,
    finger: stag, table: tableGeo,
    drum: grounded(plain([[new THREE.CylinderGeometry(0.5, 0.5, 1, 10, 1).translate(0, 0.5, 0), null]]), 0.8, 1.02),
    block: grounded(plain([[new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), null]]), 0.8, 1.03),
    shaft: shaft(false), shaftEnd: shaft(true), stump, base, echinus, flag, rubble, jar: jar(false), jarBroken: jar(true), shard, wreath,
    coin: plain([[new THREE.TorusGeometry(0.17, 0.055, 4, 8), M(0, 0, 0, Math.PI / 2, 0, 0)]]), // a tail segment, the coin
    hoop: plain([[new THREE.TorusGeometry(0.42, 0.05, 4, 10), M(0, 0.95, 0)], [new THREE.CylinderGeometry(0.05, 0.07, 0.55, 4), M(0, 0.27, 0)], [new THREE.CylinderGeometry(0.16, 0.2, 0.08, 6), M(0, 0.04, 0), grey(0.8)]]),
    // the carved coil: a body that has almost closed on itself, with a crest where the head is
    coil: plain([[new THREE.TorusGeometry(0.62, 0.15, 5, 14, Math.PI * 1.8), M(0, 0, 0, Math.PI / 2, 0, 0)],
      ...[0, 1, 2].map((i) => [new THREE.ConeGeometry(0.05, 0.5 - i * 0.1, 4), M(0.62, 0.3 - i * 0.02, -0.04 - i * 0.16, -0.25 - i * 0.2, 0, 0)])]),
    glow: glowTexture(), beam: beamTexture(), pool: poolTexture(),
  };
  return GEO;
}

// ---------------------------------------------------------------- what the world is made of, as components
// Each model above is white with its shading baked in; what colours it is the tint it is scattered with. So a thing
// that grows carries its own tints (they can be changed in the specimen library, and are read here), and a thing of
// stone carries none: it takes its band's stone, or its band's paint, from the two sets in npc.js.
{
  const pal = (list) => Object.fromEntries(list.map((c, i) => [`tone${i + 1}`, c]));
  // what answers the fish has a second pose to show: pulled in (`shy`), or leaning out of its way (`give`). See kit.growing
  const answers = (m) => (m.shy ? [{ id: 'still', name: 'As it stands' }, { id: 'near', name: 'Pulled in, the fish going by', near: 1 }] : m.give ? [{ id: 'still', name: 'As it stands' }, { id: 'near', name: 'Leaning, the fish going by', near: 1 }] : undefined);
  const thing = (group) => (id, name, geo, bands, length, about, tones, show, material = {}) => register({ id, group, name, bands, length, about, role: material.shy ? 'Pulls in when the fish comes by, and opens again when it has gone.' : material.give ? 'Leans out of the way of the fish, and comes back.' : group === 'On the bed' ? 'Lies on the bed. Nothing to the fish but something to swim over.' : 'Grows where it grows. The fish swims through or round it.', palette: pal(tones), build: () => geometries()[geo], material, show, ...(answers(material) ? { states: answers(material) } : {}) });
  const grows = thing('Things that grow'), lies = thing('On the bed');
  grows('kelp', 'Kelp', 'kelp', [0, 1, 2], 5, 'Four broad blades, each folded along its midrib so the two halves take the light differently, the edges ruffled; round the foot, young blades on their floats.', ['#4ba57c', '#5fb88a', '#7bb262', '#3f9a8a', '#6cc09a'], { scale: [1.7, 5, 1.7], n: 5, spread: 1.7 }, { sway: 1, give: 0.4 });
  grows('seagrass', 'Seagrass', 'tuft', [0, 1], 0.7, 'A tuft of narrow blades. It grows on the green patches of the two bands that have light.', ['#6fbf86', '#86c98f', '#5aa884', '#9bd28e'], { scale: [1.4, 0.7, 1.4], n: 9, spread: 1.3 }, { sway: 1.3, give: 0.55 });
  grows('staghorn', 'Staghorn coral', 'stag', [0, 1, 2, 3, 4], 1.3, 'Each branch forks, and the growing tips are pale. It also takes root on the stonework where there is light.', ['#f28d7d', '#f6b95f', '#c98fe3', '#f9d9c9', '#ea6079', '#ff9fb0'], { scale: 1.3, n: 3, spread: 1.4 }, { double: false });
  grows('tablecoral', 'Table coral', 'table', [0, 1, 2, 3, 4], 2.4, 'Tiers of plates on a stalk, with a scalloped, paler rim and dark underneath.', ['#f28d7d', '#f6b95f', '#c98fe3', '#f9d9c9', '#ea6079', '#ff9fb0'], { scale: 1.3, n: 1 }, { double: false });
  grows('braincoral', 'Brain coral', 'brain', [0, 1], 1.8, 'A dome, its ridges and valleys in two tones. The big ones are solid: the fish goes round.', ['#f6b95f', '#d9a86a', '#9fc59a', '#f28d7d', '#e8c9a0'], { scale: 0.9, n: 1 }, { double: false });
  grows('seafan', 'Sea fan', 'seaFan', [0, 1, 2], 1.5, 'One flat spray of branches, standing across the current.', ['#b47be0', '#f08a4b', '#e2566b', '#f6d040', '#ff9fb0'], { scale: 1.5, n: 3, spread: 1.3 }, { sway: 0.5, give: 0.22 });
  grows('sponge', 'Tube sponge', 'sponge', [0, 1, 2], 1.1, 'Open chimneys, wider at the lip, dark inside.', ['#f6d040', '#c98fe3', '#f08a4b', '#7fd6c8'], { scale: 1.1, n: 3, spread: 1.2 }, { double: false });
  grows('anemone', 'Anemone', 'anemone', [0, 1, 2], 0.6, 'A short column and a crown of tentacles with pale ends, moving with the water. It shuts when the fish comes by.', ['#f4a4b9', '#9fe0b0', '#fff1d0', '#c98fe3', '#ff9f7a'], { scale: 0.95, n: 5, spread: 1 }, { sway: 0.9, shy: 1 });
  grows('sealily', 'Sea lily', 'lily', [1, 2, 3, 4], 1.3, 'A jointed stalk and a cup of arms that curl in. An animal, for all it looks like a flower: the arms close when the fish comes by.', ['#f6d040', '#f6b95f', '#fff1d0', '#f4a4b9'], { scale: 1.3, n: 3, spread: 1.1 }, { sway: 0.5, shy: 1 });
  grows('glasssponge', 'Glass sponge', 'glass', [2, 3, 4], 1, 'A pale vase of lattice, from the dark bands.', ['#e4f1ff', '#cfe3f2', '#f2faf7'], { scale: 1, n: 3, spread: 1 }, { double: false });
  grows('tubeworms', 'Tube worms', 'worms', [3, 4], 1.1, 'White tubes with red plumes, in a clump by the rocks of the deepest bands. They are coloured in themselves: the tint only warms or cools them. The plumes are gone down the tubes before the fish can touch them.', ['#ffffff'], { scale: 1.1, n: 3, spread: 0.9 }, { double: false, shy: 1 });
  grows('lantern', 'Lantern flower', 'lantern', [1, 2, 3, 4], 1.2, 'The stalk bows over and the light hangs from it in its sepals. Below the reach of the sun these are most of what there is to see by.', ['#7ff3ff', '#b79bff', '#9dffb4', '#ff9de0'], { scale: [1.25, 1.2, 1.25], n: 5, spread: 1 }, { sway: 0.3, glow: 1.15, give: 0.3 });
  grows('seapen', 'Sea pen', 'pen', [1, 2, 3, 4], 1.4, 'A quill that makes its own light along its vanes. Come near and it folds and goes down into the bed.', ['#7ff3ff', '#b79bff', '#9dffb4', '#ff9de0'], { scale: [1.5, 1.4, 1.5], n: 3, spread: 0.9 }, { sway: 0.3, glow: 1.15, shy: 1 });
  lies('starfish', 'Starfish', 'star', [0, 1, 2], 0.6, 'Five arms, paler at the tips, lying to the slope of the bed.', ['#f08a4b', '#e2566b', '#f6b95f', '#b47be0', '#f4a4b9'], { scale: 0.3, n: 5, spread: 0.7, flat: true }, { double: false });
  lies('brittlestar', 'Brittle star', 'brittle', [2, 3, 4], 0.9, 'The starfish of the dark bands: a small disc and long thin arms.', ['#e9dfc0', '#d7b9a0', '#f4a4b9', '#cfe3f2'], { scale: 0.45, n: 5, spread: 0.9, flat: true }, { double: false });
  lies('urchin', 'Urchin', 'urchin', [0, 1, 2, 3], 0.5, 'A small one on the bed, by the rocks. It is the spined drifter’s harmless cousin.', ['#3b2a4d', '#2b2038', '#5a2f4f', '#7a2f45'], { scale: 0.36, n: 5, spread: 0.8 });
  lies('clam', 'Clam', 'clam', [0, 1, 2, 3, 4], 0.5, 'Two ribbed valves, standing open, that shut as the fish goes over.', ['#f3ead2', '#f9cdd6', '#d9c7a8', '#e7d3e8'], { scale: 0.26, n: 5, spread: 0.7 }, { shy: 1 });
  lies('pebble', 'Pebbles', 'pebble', [0, 1, 2, 3, 4], 0.3, 'Pebbles and broken shell, in drifts.', ['#9aa39a', '#b7b8a6', '#8b9299', '#dcd9c6', '#7d8790', '#c9b9a0'], { scale: 0.14, n: 12, spread: 0.6, flat: true }, { double: false });
  lies('rock', 'Rock', 'rock', [0, 1, 2, 3, 4], 2.4, 'Darker toward the foot, where silt gathers. The big ones stand in reefs, and the corals keep to them.', ['#8f95a8', '#7f889c', '#a29dac', '#8c9aa3', '#969fb0'], { scale: [1.3, 0.95, 1.2], n: 1 }, { double: false });
  const built = (id, name, geo, length, about, tintWith = 'stone', show = { scale: 1, n: 1 }) => register({ id, group: 'Stonework', name, length, about, tintWith, role: `Has no colour of its own: it takes its band’s ${tintWith === 'paint' ? 'paint' : tintWith === 'clay' ? 'clay, warmed by its band’s paint' : 'stone'} (see Colours of the world).`, build: () => geometries()[geo], material: { stone: true, double: geo === 'shard' || geo === 'jarBroken' || geo === 'jar' }, show });
  built('shaft', 'Column drum', 'shaft', 1.2, 'One drum of a fluted column: eight flutes, the two faces of each a little apart in tone. A column is a stack of these, narrowing as it climbs.', 'stone', { scale: [1.05, 1.2, 1.05], n: 1 });
  built('stump', 'Broken top', 'stump', 1, 'Where a column snapped: the break climbs to one side and is hollowed where the core came away.');
  built('base', 'Column base', 'base', 1.4, 'The moulding a column stands on.');
  built('echinus', 'Capital cushion', 'echinus', 1.5, 'The cushion under a column’s top slab. The slab itself is a block in the district’s paint.');
  built('block', 'Block', 'block', 1, 'The squared stone everything else is built of: plinths, lintels, walls, kerbs, steps. Darker toward the foot.');
  built('flag', 'Paving flag', 'flag', 1, 'No two corners alike. Roads, the floors of houses, the rings round the wells.', 'stone', { scale: [1.1, 0.1, 1.1], n: 5, spread: 0.9 });
  built('rubble', 'Rubble', 'rubble', 0.6, 'A chunk of broken masonry, half sunk where it fell.', 'stone', { scale: 0.5, n: 4, spread: 0.6 });
  built('wreath', 'The people’s ring', 'wreath', 3.4, 'A body closed on itself, segment by segment. The nursery’s hoops are this ring.', 'paint', { scale: 1.55, n: 1, lift: 1.9 });
  built('hoop', 'A young one’s hoop', 'hoop', 1.4, 'The stone hoops the young swam through, beside the houses and along the way to the first well.', 'paint');
  built('coil', 'The carved coil', 'coil', 1.4, 'A body that has almost closed on itself, with a crest where the head is. It sits at the middle of every hero’s ring.', 'paint', { scale: 1.2, n: 1, lift: 0.2 });
  built('coin', 'A tail, as coin', 'coin', 0.4, 'A tail segment: what the Long Ones paid with. Stacked on the market tables, heaped at the wells.', 'paint', { scale: 1, n: 6, spread: 0.3, lift: 0.1 });
  register({ id: 'chime', group: 'Stonework', name: 'Chime', length: 2, tintWith: 'bronze', about: 'A flat bar of bronze on a cord. They hang in a row, the longest in the middle, under a lintel or on a line between two columns. The band near the foot is painted, and lit where there is nothing else to find it by.',
    role: 'Brushed, it swings aside and rings, on a note of whatever chord the band is playing at that moment. It stops nobody.', build: () => geometries().chime, material: { double: false, glow: 0.7 }, show: { scale: [1, 2, 1], n: 5, spread: 0.9, lift: 2.3 } });
  built('jar', 'Jar', 'jar', 1, 'A storage jar: foot, belly, shoulder, neck, lip, two handles, a painted band. At nearly three times the size, sealed, it is the jar a dash breaks open.', 'clay');
  built('jarbroken', 'Broken jar', 'jarBroken', 0.8, 'What is left standing when a jar is broken.', 'clay');
  built('shard', 'Sherd', 'shard', 0.4, 'A potsherd, a roof tile, a broken plate: something thin with a curve to it.', 'clay', { scale: 1, n: 6, spread: 0.5, flat: true });
}

// instanced decoration that re-seats itself on the nearest copy of the repeating world
class Scatter {
  // reach: small things are only drawn within this many metres of the fish; beyond it they are too small to miss
  constructor(geometry, material, items, { cast = true, receive = true, reach = 0 } = {}) {
    this.items = items; this.reach = reach;
    this.mesh = new THREE.InstancedMesh(geometry, material, Math.max(items.length, 1));
    this.mesh.count = items.length;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = cast; this.mesh.receiveShadow = receive;
    this.k = new Int16Array(items.length * 2).fill(32767);
    const c = new THREE.Color();
    this.tones = items.map((it) => new THREE.Color(it.color || '#ffffff'));
    items.forEach((it, i) => this.mesh.setColorAt(i, c.copy(this.tones[i])));
  }
  wrap(fx, fz) {
    const m = new THREE.Matrix4(), p = new THREE.Vector3();
    if (this.reach) { // pack the near ones to the front and draw only those
      const r2 = this.reach * this.reach; let n = 0;
      this.items.forEach((it, i) => {
        const x = it.x + T * Math.round((fx - it.x) / T), z = it.z + T * Math.round((fz - it.z) / T);
        if ((x - fx) * (x - fx) + (z - fz) * (z - fz) > r2) return;
        this.mesh.setMatrixAt(n, m.compose(p.set(x, it.y, z), it.q, it.s)); this.mesh.setColorAt(n, this.tones[i]); n++;
      });
      this.mesh.count = n; this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
      return;
    }
    let dirty = false;
    this.items.forEach((it, i) => {
      const kx = Math.round((fx - it.x) / T), kz = Math.round((fz - it.z) / T);
      if (kx === this.k[i * 2] && kz === this.k[i * 2 + 1]) return;
      this.k[i * 2] = kx; this.k[i * 2 + 1] = kz;
      this.mesh.setMatrixAt(i, m.compose(p.set(it.x + kx * T, it.y, it.z + kz * T), it.q, it.s));
      dirty = true;
    });
    if (dirty) this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export function createWorld(scene, { seed = 1, floor = 0, calm = false, nursery = false } = {}) {
  const F = FLOORS[floor], G = geometries();
  const last = floor === FLOORS.length - 1;
  const rand = rng(seed * 977 + floor * 7919 + 13);
  const rr = (a, b) => a + (b - a) * rand();
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const drand = rng(seed * 977 + floor * 7919 + 4099), dr = (a, b) => a + (b - a) * drand(), dpick = (list) => list[Math.floor(drand() * list.length)]; // dressing only: never decides where anything that matters stands
  const xrand = rng(seed * 977 + floor * 7919 + 9001), xr = (a, b) => a + (b - a) * xrand(); // for what answers the fish (chimes, pilot fish): a run of its own, so that nothing else moves to make room
  const time = { value: 0 }, seaLight = { value: F.seaLight };
  const wake = { value: Array.from({ length: WAKE }, () => new THREE.Vector4()), bound: { value: new THREE.Vector3() } }; // where the fish's body is, and for a moment where its tail was: what grows leans from it or pulls in (kit.growing)
  const colliders = []; // { x, y, z, r } spheres and { x, z, r, top } upright cylinders
  const scatters = [], owned = [], materials = [];
  const add = (o) => { scene.add(o); owned.push(o); return o; };
  const mat = (m) => { materials.push(m); return m; };
  const scatter = (geo, material, items, opts) => { const s = new Scatter(geo, material, items, opts); scatters.push(s); add(s.mesh); return s; };
  const qY = (yaw, rx = 0, rz = 0) => new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, yaw, rz, 'YXZ'));
  const S = (x, y = x, z = x) => new THREE.Vector3(x, y, z);
  const farFrom = (x, z, cx, cz, r) => Math.hypot(wrapD(x - cx), wrapD(z - cz)) > r;
  const polar = (a, d) => [SPAWN.x + Math.sin(a) * d, SPAWN.z + Math.cos(a) * d];

  // ------------------------------------------------------------ where this band leads: a rift down, or the palace
  const goalAngle = floor === 0 ? 3.9 : rr(0, Math.PI * 2);
  const goalD = rr(50, 62);
  const [gx, gz] = polar(goalAngle, last ? goalD : floor === 0 ? 70 : goalD + 8); // a rift lies further out than the palace does, so that what is built on the way to it stands on the shelf
  const goal = { x: gx, z: gz, y: 0, kind: last ? 'palace' : 'rift' };
  // Ryūgū is one ring hall whose wall is the Sum (boss.js). The gate stands just outside the wall's only gap.
  // phi is the bearing of that gap from the hall's centre; gapHalf is half its width along the ring, in metres.
  const hall = last ? { x: gx + Math.sin(goalAngle) * 24.6, z: gz + Math.cos(goalAngle) * 24.6, R: 22, phi: goalAngle + Math.PI, gapHalf: 5.4, y: undefined } : null;

  // ------------------------------------------------------------ the lie of the seabed
  const ph = Array.from({ length: 8 }, () => rr(0, Math.PI * 2));
  const bed = (x, z) => 1.5 * Math.sin(K * x + ph[0]) * Math.cos(K * z + ph[1])
    + 0.9 * Math.sin(K * (2 * x + z) + ph[2])
    + 0.55 * Math.cos(K * (3 * x - 2 * z) + ph[3])
    + 0.3 * Math.sin(K * (5 * x + 4 * z) + ph[4]); // before anything is cut into it
  // The rift. The shelf this band stands on has cracked across the way, and the crack is the way down: long and ragged,
  // closing to nothing at both ends, stepping down to a ledge and then dropping sheer into the dark of the next band.
  // Its middle is the goal. n points along the way from the start to the goal, t runs along the crack; a point is
  // u metres along the crack from its middle and a metres across it. The shelf levels out toward its edge, at rift.y.
  const rift = last ? null : { x: gx, z: gz, y: bed(gx, gz), nx: Math.sin(goalAngle), nz: Math.cos(goalAngle), tx: Math.cos(goalAngle), tz: -Math.sin(goalAngle),
    half: 38, wide: 12.5, lip: 1.6, ledge: 4.6, wall: 7.4, step: 2.4, deep: 14 }; // half its length, half its width at the middle; across it from the edge in: the lip, the ledge, the wall; how far the ledge and the bottom lie below the shelf
  const smooth = (k) => k * k * (3 - 2 * k);
  const riftMid0 = 2.6 * Math.sin(ph[5]) + 1.2 * Math.sin(ph[6]);
  const riftMid = (u) => 2.6 * Math.sin(u * 0.11 + ph[5]) + 1.2 * Math.sin(u * 0.29 + ph[6]) - riftMid0; // how far the crack wanders off its line
  const riftW = (u) => { const k = 1 - (u / rift.half) ** 2; return k <= 0 ? 0 : rift.wide * Math.pow(k, 0.6) + k * (1 - Math.exp(-(u * u) / 60)) * (1.1 * Math.sin(u * 0.31 + ph[7]) + 0.7 * Math.sin(u * 0.83 + ph[1])); }; // half its width, edge to edge
  // how far inside the rift's edge a point is, in metres; less than nothing outside it
  function riftIn(x, z) {
    if (!rift) return -99;
    const dx = wrapD(x - rift.x), dz = wrapD(z - rift.z), a = dx * rift.nx + dz * rift.nz;
    if (Math.abs(a) > rift.wide + 16) return rift.wide - Math.abs(a); // far off: near enough, and cheap
    const u = dx * rift.tx + dz * rift.tz, over = Math.abs(u) - rift.half;
    if (over >= 0) return -Math.hypot(over, a); // past its ends
    return riftW(u) - Math.abs(a - riftMid(u));
  }
  const riftDrop = (q) => rift.step * smooth(clamp(q / rift.lip, 0, 1)) + (rift.deep - rift.step) * smooth(clamp((q - rift.ledge) / (rift.wall - rift.ledge), 0, 1));
  const riftClear = (x, z, pad = 0) => !rift || riftIn(x, z) < -pad;
  function height(x, z) {
    let h = bed(x, z);
    if (rift) {
      const q = riftIn(x, z);
      if (q > -10) { h = lerp(h, rift.y, smooth(clamp((q + 10) / 8, 0, 1))); if (q > 0) h -= riftDrop(q); }
    } else if (hall.y !== undefined) {
      const d = Math.hypot(wrapD(x - hall.x), wrapD(z - hall.z));
      if (d < hall.R + 9) { const k = clamp((hall.R + 9 - d) / 7, 0, 1); h = lerp(h, hall.y, k * k * (3 - 2 * k)); } // the hall has a level floor
    }
    return h;
  }
  if (hall) hall.y = height(hall.x, hall.z);
  const meadow = (x, z) => Math.sin(K * (2 * x - z) + ph[5]) * Math.cos(K * (x + 3 * z) + ph[6]) + 0.25 * Math.sin(K * (6 * x + 5 * z) + ph[7]);
  goal.y = last ? height(goal.x, goal.z) : rift.y;

  const nTri = GRID * GRID * 2;
  const tPos = new Float32Array(nTri * 9), tCol = new Float32Array(nTri * 9), tNor = new Float32Array(nTri * 9);
  const tGeo = new THREE.BufferGeometry();
  tGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3));
  tGeo.setAttribute('color', new THREE.BufferAttribute(tCol, 3));
  tGeo.setAttribute('normal', new THREE.BufferAttribute(tNor, 3));
  const tMat = mat(new THREE.MeshLambertMaterial({ vertexColors: true }));
  tMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = time; sh.uniforms.uSea = seaLight;
    sh.vertexShader = 'varying vec2 vSea;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vSea = transformed.xz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
  { // ripples the current has combed into the sand: fine, and fading with distance before they can shimmer
    float ph = dot(vSea, vec2(5.6, 4.1)) + 1.6 * sin(vSea.y * 0.61 - vSea.x * 0.37) + 0.9 * sin(vSea.x * 1.7 + vSea.y * 0.4);
    float keep = clamp(1.0 - fwidth(ph) * 0.55, 0.0, 1.0);
    diffuseColor.rgb *= 1.0 + 0.085 * keep * (smoothstep(-0.3, 0.95, sin(ph)) - 0.6);
  }`);
    sh.fragmentShader = `uniform float uTime;
uniform float uSea;
varying vec2 vSea;
// light rippling through the surface far above: a few warped sine ridges
float seaLight(vec2 p, float t) {
  vec2 q = p;
  float a = 0.0;
  for (int i = 0; i < 3; i++) {
    float f = float(i);
    q += 0.7 * vec2(sin(q.y * 1.25 + t * 0.6 + f * 1.7), cos(q.x * 1.15 - t * 0.5 + f * 2.3));
    a += abs(sin(q.x * 0.85 + t * 0.25) * cos(q.y * 0.85 - t * 0.2));
  }
  return pow(clamp(1.0 - a / 3.0, 0.0, 1.0), 6.0);
}
` + sh.fragmentShader.replace('#include <opaque_fragment>', '  outgoingLight += vec3(0.95, 1.0, 0.85) * seaLight(vSea * 0.42, uTime) * uSea;\n#include <opaque_fragment>');
  };
  const terrain = add(new THREE.Mesh(tGeo, tMat));
  terrain.receiveShadow = true;
  terrain.frustumCulled = false;
  owned.push({ dispose: () => tGeo.dispose() });

  const sandA = new THREE.Color('#c8c9a6'), sandB = new THREE.Color('#b9bd9b'), sandHi = new THREE.Color('#d3d2ad');
  const grassA = new THREE.Color('#a5c09f'), grassB = new THREE.Color('#95b596'), pit = new THREE.Color(FLOORS[Math.min(floor + 1, FLOORS.length - 1)].water).multiplyScalar(0.55);
  const rockA = new THREE.Color('#a9ad97'), rockB = new THREE.Color('#7f8a80'); // the rock of the shelf, where the rift has laid it bare
  const vertexY = (ix, iz) => height(ix * CELL, iz * CELL) + (hash2(ix, iz) - 0.5) * 0.36;
  let tcx = 1e9, tcz = 1e9;
  function rebuildTerrain(fx, fz) {
    const cx = Math.round(fx / CELL), cz = Math.round(fz / CELL);
    if (cx === tcx && cz === tcz) return;
    tcx = cx; tcz = cz;
    const col = new THREE.Color(), A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), n = new THREE.Vector3(), e = new THREE.Vector3();
    let o = 0;
    const tri = (ax, az, bx, bz, qx, qz, salt) => {
      A.set(ax * CELL, vertexY(ax, az), az * CELL); B.set(bx * CELL, vertexY(bx, bz), bz * CELL); C.set(qx * CELL, vertexY(qx, qz), qz * CELL);
      n.subVectors(B, A).cross(e.subVectors(C, A)).normalize();
      const mx = (A.x + B.x + C.x) / 3, mz = (A.z + B.z + C.z) / 3, my = (A.y + B.y + C.y) / 3;
      const h = hash2(ax + bx + qx, az + bz + qz, salt);
      if (meadow(mx, mz) > 0.55) col.copy(grassA).lerp(grassB, h);
      else col.copy(sandA).lerp(sandB, h).lerp(sandHi, clamp((my + 1) / 4, 0, 1) * 0.5);
      if (rift) {
        const q = riftIn(mx, mz);
        if (q > -1.5) { // the rift: bare rock in beds where the shelf has broken, darkening toward the next band
          const down = rift.y - my;
          if (n.y < 0.9 || down > 1) col.copy(rockA).lerp(rockB, (Math.floor((my + 60) / 1.15) & 1 ? 0.7 : 0.12) + h * 0.3);
          col.lerp(pit, clamp((down - 1.2) / (rift.deep - 4), 0, 1) * 0.95);
        }
      }
      for (const p of [A, B, C]) {
        tPos[o] = p.x; tPos[o + 1] = p.y; tPos[o + 2] = p.z;
        tNor[o] = n.x; tNor[o + 1] = n.y; tNor[o + 2] = n.z;
        tCol[o] = col.r; tCol[o + 1] = col.g; tCol[o + 2] = col.b;
        o += 3;
      }
    };
    const half = GRID / 2;
    for (let j = -half; j < half; j++) for (let i = -half; i < half; i++) {
      const x0 = cx + i, z0 = cz + j, x1 = x0 + 1, z1 = z0 + 1;
      if ((x0 + z0) & 1) { tri(x0, z0, x0, z1, x1, z1, 1); tri(x0, z0, x1, z1, x1, z0, 2); }
      else { tri(x0, z0, x0, z1, x1, z0, 1); tri(x1, z0, x0, z1, x1, z1, 2); }
    }
    tGeo.attributes.position.needsUpdate = true;
    tGeo.attributes.color.needsUpdate = true;
    tGeo.attributes.normal.needsUpdate = true;
  }

  // ------------------------------------------------------------ stonework
  // Stone weathers from the top down: the shallow ruins are the oldest and greenest, the deepest are clean.
  const stoneTones = stoneOf(floor);
  // Each district paints its column tops in one fin colour; the last band's is the body's own gold.
  const district = paintOf(floor);
  const drums = [], blocks = [], coins = [], hoops = [], coils = [];
  const shafts = [], shaftEnds = [], stumps = [], bases = [], echini = [], flags = [], rubbles = [], shards = [], jars = [], jarsBroken = [];
  const grownFingers = [], grownBulbs = []; // what has taken root on the stonework: coral where there is light, lamps where there is none
  const up = new THREE.Vector3(0, 1, 0);
  // lying on the seabed at (x, z), following its slope
  const lie = (x, z, yaw = drand() * 6.28) => { const gx = (height(x + 0.4, z) - height(x - 0.4, z)) / 0.8, gz = (height(x, z + 0.4) - height(x, z - 0.4)) / 0.8; return new THREE.Quaternion().setFromUnitVectors(up, new THREE.Vector3(-gx, 1, -gz).normalize()).multiply(new THREE.Quaternion().setFromAxisAngle(up, yaw)); };
  const stoneLike = (tone) => tint(tone, dpick(stoneTones), 0.5);
  const greened = (tone, k = 0.4) => (floor <= 1 ? tint(tone, ['#8fbf8c', '#8ab59a'][floor], k) : tone); // growth on what faces the light, in the two bands that have any
  const flagAt = (x, z, size = 1, yaw) => flags.push({ x, y: height(x, z) - 0.03, z, q: lie(x, z, yaw), s: S(size * dr(0.9, 1.25), 0.1, size * dr(0.9, 1.25)), color: tint(dpick(stoneTones), '#7c9794', dr(0.25, 0.5)) });
  const paveRing = (cx, cz, r, size = 1.2, miss = 0.14) => { const n = Math.max(5, Math.round((Math.PI * 2 * r) / (size * 1.12))); for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; if (drand() >= miss) flagAt(cx + Math.sin(a) * r, cz + Math.cos(a) * r, size, a + dr(-0.15, 0.15)); } };
  const paveRoad = (ax, az, bx, bz, half = 1.3, size = 1.25) => { const len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len; for (let d = 0; d < len; d += size * 1.1) for (const side of [-half, 0, half]) if (drand() > 0.2) flagAt(ax + ux * d + uz * side + dr(-0.12, 0.12), az + uz * d - ux * side + dr(-0.12, 0.12), size, Math.atan2(ux, uz) + dr(-0.12, 0.12)); };
  const rubbleAt = (cx, cz, r0, r1, n) => { for (let i = 0; i < n; i++) { const a = drand() * 6.28, d = dr(r0, r1), x = cx + Math.sin(a) * d, z = cz + Math.cos(a) * d, sz = dr(0.22, 0.62); rubbles.push({ x, y: height(x, z) - sz * 0.22, z, q: lie(x, z).multiply(qY(0, dr(-0.5, 0.5), dr(-0.5, 0.5))), s: S(sz * dr(0.8, 1.4), sz, sz * dr(0.8, 1.3)), color: stoneLike(dpick(stoneTones)) }); } };
  const clay = () => tint('#c98f6c', district, dr(0.1, 0.45));
  const shardsAt = (cx, cz, r, n, color) => { for (let i = 0; i < n; i++) { const a = drand() * 6.28, d = dr(0.2, r), x = cx + Math.sin(a) * d, z = cz + Math.cos(a) * d; shards.push({ x, y: height(x, z) + 0.01, z, q: lie(x, z), s: S(dr(0.6, 1.5)), color: color || clay() }); } };
  // a storage jar: standing (and then solid), lying on its side, or a broken base with its sherds about it
  function jarAt(x, z, how = drand() < 0.55 ? 'up' : drand() < 0.5 ? 'down' : 'broken') {
    const sz = dr(0.85, 1.25), y = height(x, z), color = clay();
    if (how === 'broken') { jarsBroken.push({ x, y: y - 0.04, z, q: lie(x, z), s: S(sz), color }); shardsAt(x, z, 1.1, 4, color); }
    else if (how === 'down') jars.push({ x, y: y + 0.3 * sz, z, q: qY(drand() * 6.28, Math.PI / 2 - 0.12), s: S(sz), color });
    else { jars.push({ x, y: y - 0.05, z, q: qY(drand() * 6.28, dr(-0.06, 0.06), dr(-0.06, 0.06)), s: S(sz), color }); colliders.push({ x, z, r: 0.3 * sz, top: y + 1.0 * sz }); }
  }
  // something small growing on stone at a given height
  const growOn = (x, y, z, chance = 0.4) => { if (drand() > chance) return; if (floor <= 1) grownFingers.push({ x: x + dr(-0.3, 0.3), y: y - 0.04, z: z + dr(-0.3, 0.3), q: qY(drand() * 6.28, dr(-0.2, 0.2), dr(-0.2, 0.2)), s: S(dr(0.3, 0.6)) }); else grownBulbs.push({ x: x + dr(-0.35, 0.35), y: y - 0.03, z: z + dr(-0.35, 0.35), q: qY(drand() * 6.28, dr(-0.4, 0.4), dr(-0.4, 0.4)), s: S(0.8, dr(0.3, 0.7), 0.8) }); };
  const spots = { hooks: [], biters: [], anglers: [], pens: new Map() };
  const sites = [[goal.x, goal.z, 14]];
  if (hall) {
    sites.push([hall.x, hall.z, (hall.R + 4) / 0.75]); // nothing grows or stands in the hall, or against its wall
    for (let i = 0; i < 4; i++) { const a = hall.phi + 1.1 + i * 1.3; spots.biters.push([hall.x + Math.sin(a) * (hall.R - 2.6), hall.z + Math.cos(a) * (hall.R - 2.6)]); } // biters live on the Sum as cleaner fish do on a whale
  }
  const clearNow = (x, z, pad) => sites.every(([sx, sz, r]) => farFrom(x, z, sx, sz, r + pad)) && farFrom(x, z, SPAWN.x, SPAWN.z, 6 + pad) && riftClear(x, z, pad + 1);
  // A column is a stack: a plinth, a moulded base, fluted drums that narrow as they climb, a cushion and a top slab
  // in the district's colour. Where it broke, the break is jagged; where it was sawn (the Narrowing) it is flat.
  function column(x, z, h, { capital = true, yaw = rand() * 3, collide = true, sawn = false } = {}) {
    const y = height(x, z) - 0.25, tone = pick(stoneTones), tx = rr(-0.02, 0.02), tz = rr(-0.02, 0.02), top = y + 0.5 + h;
    blocks.push({ x, y, z, q: qY(yaw), s: S(1.55, 0.5, 1.55), color: tone });
    bases.push({ x, y: y + 0.5, z, q: qY(yaw), s: S(1), color: tone });
    const n = Math.max(1, Math.round((h - 0.2) / 1.2)), each = (h - 0.2) / n;
    for (let i = 0; i < n; i++) {
      const d = lerp(1.07, capital ? 0.93 : 1.01, n > 1 ? i / (n - 1) : 0), slip = i > 0 && drand() < 0.16 ? dr(0.03, 0.09) : 0, a = drand() * 6.28;
      shafts.push({ x: x + Math.sin(a) * slip, y: y + 0.7 + i * each, z: z + Math.cos(a) * slip, q: qY(yaw + (i ? dr(-0.25, 0.25) : 0), tx, tz), s: S(d, each, d), color: i === n - 1 && !capital ? greened(stoneLike(tone)) : stoneLike(tone) });
    }
    if (capital) {
      echini.push({ x, y: top, z, q: qY(yaw), s: S(0.97, 1, 0.97), color: tone });
      blocks.push({ x, y: top + 0.2, z, q: qY(yaw), s: S(1.5, 0.18, 1.5), color: district });
      growOn(x, top + 0.38, z, 0.3);
    } else {
      if (!sawn) stumps.push({ x, y: top - 0.01, z, q: qY(drand() * 6.28, tx, tz), s: S(1.01, dr(0.6, 1.3), 1.01), color: greened(stoneLike(tone)) });
      rubbleAt(x, z, 1.1, 2.8, sawn ? 1 : 2 + Math.floor(drand() * 3));
    }
    growOn(x + 0.9, y + 0.5, z, 0.25);
    if (collide) colliders.push({ x, z, r: 0.78, top: y + 0.9 + h });
    return top + (capital ? 0.38 : 0);
  }
  // a shaft that came down: its drums lie where they rolled, the last of them a little apart
  function fallen(x, z, len, yaw) {
    const y = height(x, z) + 0.3, tip = Math.PI / 2 + rr(-0.06, 0.06), tone = pick(stoneTones);
    const n = Math.max(2, Math.round(len / 1.3)), each = len / n;
    for (let i = 0; i < n; i++) {
      const end = i === n - 1, off = end ? dr(-0.45, 0.45) : dr(-0.06, 0.06), along = i * each + (end ? dr(0.15, 0.5) : 0), px = x + Math.sin(yaw) * along + Math.cos(yaw) * off, pz = z + Math.cos(yaw) * along - Math.sin(yaw) * off;
      shaftEnds.push({ x: px, y: height(px, pz) + 0.3 - dr(0, 0.1), z: pz, q: qY(yaw + (end ? dr(-0.3, 0.3) : dr(-0.04, 0.04)), tip).multiply(new THREE.Quaternion().setFromAxisAngle(up, drand() * 6.28)), s: S(1.05, each * 0.94, 1.05), color: greened(stoneLike(tone), 0.25) });
      growOn(px, height(px, pz) + 0.8, pz, 0.3);
    }
    rubbleAt(x + Math.sin(yaw) * len * 0.5, z + Math.cos(yaw) * len * 0.5, 0.9, 2.2, 2);
    for (let i = 0.15; i < 1; i += 0.3) colliders.push({ x: x + Math.sin(yaw) * len * i, y, z: z + Math.cos(yaw) * len * i, r: 0.7 });
  }
  // a beam across two columns: cut in two lengths, with a row of beam-ends and a painted course over them
  // Chimes: bars on cords in a row, longest in the middle, under a lintel or on a line between two columns (`line`). Brushed, a bar
  // swings aside and rings; the note is the band's to give (main.js, music.chime). They stop nobody, and nothing depends on them.
  const chimeSets = [];
  function hang(ax, az, bx, bz, y, line = false) {
    const full = Math.hypot(bx - ax, bz - az), span = full - 1.7, n = clamp(Math.round(span / 0.95), 3, 7), gap = Math.min(0.72, span / n), yaw = Math.atan2(bx - ax, bz - az), ux = Math.sin(yaw), uz = Math.cos(yaw);
    const mx = (ax + bx) / 2, mz = (az + bz) / 2, long = clamp(y - height(mx, mz) - 2.9, 1.1, 3.2), turn = xrand() < 0.5 ? 1 : -1;
    const order = Array.from({ length: n }, (_, k) => k).sort((a, b) => Math.abs(a - (n - 1) / 2 + 0.01 * turn) - Math.abs(b - (n - 1) / 2 + 0.01 * turn)); // from the middle out, a side at a time
    const bars = Array.from({ length: n }, (_, k) => { const d = (k - (n - 1) / 2) * gap, rank = order.indexOf(k);
      return { x: mx + ux * d, z: mz + uz * d, y, len: long * lerp(1, 0.52, rank / (n - 1)) * xr(0.97, 1.03), note: rank, ox: 0, oz: 0, vx: 0, vz: 0, held: 0, lit: 0, i: 0 }; });
    chimeSets.push({ x: mx, z: mz, y, q: qY(yaw), bars, wx: NaN, wz: NaN, awake: 0 });
    if (line) blocks.push({ x: mx, y: y - 0.025, z: mz, q: qY(yaw), s: S(0.05, 0.05, full - 0.9), color: '#4a4036' });
  }
  function lintel(ax, az, bx, bz, top, thick = 0.6, hung = true) {
    const yaw = Math.atan2(bx - ax, bz - az), len = Math.hypot(bx - ax, bz - az) + 1.5, tone = pick(stoneTones);
    const ux = Math.sin(yaw), uz = Math.cos(yaw), mx = (ax + bx) / 2, mz = (az + bz) / 2, cutAt = dr(0.38, 0.62), sag = drand() < 0.3 ? dr(0.04, 0.09) : 0;
    for (const [from, to, drop] of [[0, cutAt, 0], [cutAt, 1, sag]]) {
      const c = (from + to) / 2 - 0.5;
      blocks.push({ x: mx + ux * len * c, y: top - drop, z: mz + uz * len * c, q: qY(yaw, 0, drop ? dr(-0.02, 0.02) : 0), s: S(1.35, thick, len * (to - from) - 0.03), color: stoneLike(tone) });
    }
    blocks.push({ x: mx, y: top + thick, z: mz, q: qY(yaw), s: S(1.56, 0.13, len + 0.2), color: district });
    for (let d = -len / 2 + 0.45; d < len / 2 - 0.3; d += 0.78) blocks.push({ x: mx + ux * d, y: top + thick - 0.17, z: mz + uz * d, q: qY(yaw), s: S(1.5, 0.15, 0.3), color: tone });
    for (let i = 0; i < 2; i++) { const d = dr(-0.4, 0.4) * len; growOn(mx + ux * d, top + thick + 0.13, mz + uz * d, 0.5); }
    for (let i = 0; i <= 1.001; i += 0.25) colliders.push({ x: lerp(ax, bx, i), y: top + 0.3, z: lerp(az, bz, i), r: 0.75 });
    if (hung) hang(ax, az, bx, bz, top - sag);
  }
  // a line of chimes between two neighbours of a row of standing columns ([x, z, top]), in `count` places
  function strung(cols, closed, count) {
    const pairs = cols.length - (closed ? 0 : 1), first = Math.floor(xrand() * pairs);
    for (let k = 0; k < count && pairs > 1; k++) { const c = (first + Math.round((k * pairs) / count)) % pairs, a = cols[c], b = cols[(c + 1) % cols.length]; hang(a[0], a[1], b[0], b[1], Math.min(a[2], b[2]) - 0.14, true); }
  }
  // --- the pieces the story is told with
  const post = (x, z, h, r = 0.5) => { const y = height(x, z) - 0.2; bases.push({ x, y: y + 0.18, z, q: qY(0), s: S(r * 2.3, r * 2.2, r * 2.3), color: dpick(stoneTones) }); drums.push({ x, y, z, q: qY(rand() * 3), s: S(r * 2, h, r * 2), color: pick(stoneTones) }); colliders.push({ x, z, r: r + 0.25, top: y + h + 0.2 }); return y + h; };
  const slab = (x, z, r, color = district, lift = 0.02) => drums.push({ x, y: height(x, z) + lift, z, q: qY(0), s: S(r * 2, 0.07, r * 2), color });
  const coinStack = (x, y, z, n) => { for (let i = 0; i < n; i++) coins.push({ x: x + rr(-0.03, 0.03), y: y + i * 0.1, z: z + rr(-0.03, 0.03), q: qY(rand() * 6), s: S(1), color: i % 3 ? '#e9dfc0' : district }); };
  const coinHeap = (cx, cz, r, n) => { for (let i = 0; i < n; i++) { const a = rand() * 6.28, d = Math.sqrt(rand()) * r, x = cx + Math.sin(a) * d, z = cz + Math.cos(a) * d; coins.push({ x, y: height(x, z) + 0.06 + rand() * 0.2, z, q: qY(rand() * 6, rr(-0.6, 0.6), rr(-0.6, 0.6)), s: S(rr(0.8, 1.2)), color: rand() < 0.3 ? district : '#e9dfc0' }); } };
  const hoop = (x, z, s = 1, flat = 0) => hoops.push({ x, y: height(x, z) + flat, z, q: flat ? qY(rand() * 6, Math.PI / 2) : qY(rand() * 6), s: S(s), color: flat ? pick(stoneTones) : district });
  // A hero's monument: a ring of columns, one for each segment of the hero's body, round a carved coil.
  function heroRing(cx, cz, n, { sawn = false, gap = 0, carved = true } = {}) {
    const R = Math.max(3.4, n * 0.5); // wide enough to swim between the columns
    sites.push([cx, cz, R + 3]);
    const stood = [];
    for (let i = gap; i < n; i++) { const a = (i / n) * Math.PI * 2, x = cx + Math.sin(a) * R, z = cz + Math.cos(a) * R; stood.push([x, z, column(x, z, sawn ? 1.1 : 4.4, { capital: !sawn, yaw: a, sawn })]); }
    if (!sawn) strung(stood, gap === 0, n >= 14 ? 2 : 1);
    const py = height(cx, cz) - 0.3;
    blocks.push({ x: cx, y: py, z: cz, q: qY(0.2), s: S(2.6, 0.7, 2.6), color: pick(stoneTones) });
    blocks.push({ x: cx, y: py - 0.05, z: cz, q: qY(0.2), s: S(3.5, 0.4, 3.5), color: stoneLike(dpick(stoneTones)) });
    paveRing(cx, cz, 2.9, 1.0); if (R > 5) paveRing(cx, cz, R - 1.5, 1.25);
    if (sawn) { shardsAt(cx, cz, R + 2, 8, dpick(stoneTones)); rubbleAt(cx, cz, R + 0.8, R + 3, 5); }
    colliders.push({ x: cx, z: cz, r: 1.6, top: py + 1.1 });
    if (carved) coils.push({ x: cx, y: py + 0.86, z: cz, q: qY(rand() * 6), s: S(sawn ? 0.8 : 1.3), color: sawn ? pick(stoneTones) : district });
    return R;
  }
  // a low ring of kerb stones where a swarm was kept
  function pen(cx, cz, r) { for (let i = 0; i < 12; i++) { if (i === 0) continue; const a = (i / 12) * Math.PI * 2, x = cx + Math.sin(a) * r, z = cz + Math.cos(a) * r; blocks.push({ x, y: height(x, z) - 0.15, z, q: qY(a), s: S(0.9, 0.5, 0.4), color: pick(stoneTones) }); }
    for (const a of [-0.3, 0.3]) { const x = cx + Math.sin(a) * r, z = cz + Math.cos(a) * r, y = height(x, z) - 0.15; drums.push({ x, y, z, q: qY(0), s: S(0.34, 1.05, 0.34), color: dpick(stoneTones) }); blocks.push({ x, y: y + 1.05, z, q: qY(a), s: S(0.46, 0.1, 0.46), color: district }); }
    flagAt(cx, cz + r + 0.9, 1.1, 0); flagAt(cx + dr(-0.3, 0.3), cz + r + 2.0, 0.9); }
  // a round house wall with a doorway, and the small hoops the young swam through beside it
  function house(cx, cz, kids) {
    for (let i = 1; i < 9; i++) { const a = (i / 9) * Math.PI * 2, x = cx + Math.sin(a) * 2.2, z = cz + Math.cos(a) * 2.2; blocks.push({ x, y: height(x, z) - 0.2, z, q: qY(a), s: S(1.3, 1.0, 0.45), color: pick(stoneTones) }); }
    for (let i = 3; i < 7; i++) if (drand() < 0.7) { const a = ((i + 0.5) / 9) * Math.PI * 2, x = cx + Math.sin(a) * 2.2, z = cz + Math.cos(a) * 2.2; blocks.push({ x, y: height(x, z) + 0.8, z, q: qY(a + dr(-0.05, 0.05)), s: S(dr(0.9, 1.25), dr(0.5, 0.8), 0.42), color: stoneLike(dpick(stoneTones)) }); }
    { let t = 0; for (const a of [-0.36, 0.36]) { const x = cx + Math.sin(a) * 2.25, z = cz + Math.cos(a) * 2.25, y = height(x, z) - 0.2; drums.push({ x, y, z, q: qY(0), s: S(0.3, 1.6, 0.3), color: dpick(stoneTones) }); t = Math.max(t, y + 1.6); }
      blocks.push({ x: cx, y: t, z: cz + 2.25, q: qY(Math.PI / 2), s: S(0.36, 0.2, 2.1), color: district }); flagAt(cx, cz + 2.4, 1.3, 0); flagAt(cx + dr(-0.2, 0.2), cz + 3.5, 1.0); }
    for (let i = 0; i < 4; i++) { const a = drand() * 6.28, d = dr(0, 1.2); flagAt(cx + Math.sin(a) * d, cz + Math.cos(a) * d, 0.9); }
    for (let i = 0; i < 2; i++) { const a = dr(1.2, 5.1), d = 3.0 + dr(0, 0.5); jarAt(cx + Math.sin(a) * d, cz + Math.cos(a) * d); }
    colliders.push({ x: cx, z: cz, r: 2.3, top: height(cx, cz) + 1.5 });
    for (let i = 0; i < kids; i++) hoop(cx + rr(2.8, 4.2) * (i % 2 ? 1 : -1), cz + rr(-2, 2), rr(0.75, 1));
  }
  // a narrow stall: two short posts and a low lintel, where a citizen held still to be shorn
  function stall(x, z, yaw) {
    const nx = Math.cos(yaw) * 0.75, nz = -Math.sin(yaw) * 0.75;
    const t = Math.max(post(x - nx, z - nz, 1.9, 0.3), post(x + nx, z + nz, 1.9, 0.3));
    blocks.push({ x, y: t, z, q: qY(yaw + Math.PI / 2), s: S(0.6, 0.3, 2.3), color: district });
    flagAt(x, z, 1.5, yaw); flagAt(x + Math.sin(yaw) * 1.5, z + Math.cos(yaw) * 1.5, 1.1, yaw); shardsAt(x, z, 1.6, 3, district);
    spots.biters.push([x + Math.sin(yaw) * 1.6, z + Math.cos(yaw) * 1.6]);
  }
  // a stone table with the day's takings on it
  function table(x, z, size, stack) { const y = height(x, z) - 0.1; drums.push({ x, y, z, q: qY(0), s: S(0.5, 0.75, 0.5), color: pick(stoneTones) }, { x, y: y + 0.75, z, q: qY(rand()), s: S(size * 2, 0.16, size * 2), color: pick(stoneTones) }); colliders.push({ x, z, r: size, top: y + 1 }); coinStack(x, y + 0.96, z, stack); { const a = drand() * 6.28; jarAt(x + Math.sin(a) * (size + 0.6), z + Math.cos(a) * (size + 0.6)); shardsAt(x, z, size + 1.2, 3); } }
  const along = (d, side = 0) => { const [x, z] = polar(goalAngle, d); return [x + Math.cos(goalAngle) * side, z - Math.sin(goalAngle) * side]; }; // a point on the way to the goal
  const goalDist = Math.hypot(goal.x - SPAWN.x, goal.z - SPAWN.z);

  const builders = {
    gate(cx, cz) { // a long gateway to swim through
      const yaw = rr(0, 3);
      sites.push([cx, cz, 16]);
      const dx = Math.sin(yaw), dz = Math.cos(yaw), nx = Math.cos(yaw), nz = -Math.sin(yaw);
      for (let i = -2; i <= 2; i++) {
        const ax = cx + dx * i * 6.5 - nx * 3.6, az = cz + dz * i * 6.5 - nz * 3.6, bx = ax + nx * 7.2, bz = az + nz * 7.2;
        if (i === 1) { column(ax, az, 2.2, { capital: false, yaw }); column(bx, bz, 5.6, { yaw }); fallen(ax + 1.5, az + 1, 4.2, yaw + 1.9); continue; }
        const ta = column(ax, az, 5.6, { yaw }), tb = column(bx, bz, 5.6, { yaw });
        lintel(ax, az, bx, bz, Math.max(ta, tb));
      }
      paveRoad(cx - dx * 15, cz - dz * 15, cx + dx * 15, cz + dz * 15, 1.3, 1.3);
    },
    remains(cx, cz) { // scattered stumps and fallen shafts
      sites.push([cx, cz, 12]);
      for (let i = 0; i < 6; i++) {
        const a = rand() * 6.28, d = rr(2, 10), x = cx + Math.sin(a) * d, z = cz + Math.cos(a) * d;
        if (i < 3) column(x, z, rr(1.5, 5.5), { capital: i === 0 }); else fallen(x, z, rr(3, 5), rand() * 6.28);
      }
      rubbleAt(cx, cz, 2, 11, 9); for (let i = 0; i < 7; i++) { const a = drand() * 6.28, d = dr(1, 9); flagAt(cx + Math.sin(a) * d, cz + Math.cos(a) * d, dr(0.9, 1.4)); } jarAt(cx + dr(-4, 4), cz + dr(-4, 4), 'broken');
    },
    arch(cx, cz) { // a lone arch
      sites.push([cx, cz, 8]);
      const yaw = rr(0, 3), bx = cx + Math.sin(yaw) * 6, bz = cz + Math.cos(yaw) * 6;
      const t1 = column(cx, cz, 5.4, { yaw }), t2 = column(bx, bz, 5.4, { yaw });
      lintel(cx, cz, bx, bz, Math.max(t1, t2));
      paveRoad(cx + Math.cos(yaw) * 4 + Math.sin(yaw) * 3, cz - Math.sin(yaw) * 4 + Math.cos(yaw) * 3, cx - Math.cos(yaw) * 4 + Math.sin(yaw) * 3, cz + Math.sin(yaw) * 4 + Math.cos(yaw) * 3, 1.2, 1.2);
    },
  };
  // --- what each era left behind (see the plot document: the dive is their history)
  const teaseAt = polar(goalAngle + 0.5, 26); // where the great swarm is kept, in the first band
  if (floor === 0) { // The Gardens: plenty, long bodies, heroes honoured by size, children
    heroRing(SPAWN.x + 8, SPAWN.z - 14, 12); // a minor hero, barely longer than the player starts
    heroRing(teaseAt[0], teaseAt[1], 26); // the greatest, with the great swarm still circling inside
    { const [x, z] = polar(goalAngle + 2.6, 34); heroRing(x, z, 20); }
    { const [fx, fz] = polar(goalAngle - 1.1, 22); sites.push([fx, fz, 11]); // a kelp field, planted in rows
      spots.kelpRows = []; for (let r = 0; r < 5; r++) for (let c = 0; c < 8; c++) spots.kelpRows.push([fx + (c - 3.5) * 2.1, fz + (r - 2) * 2.6]); }
    for (let i = 0; i < 4; i++) { const [x, z] = polar(goalAngle - 1.9 - i * 0.28, 15 + (i % 2) * 6); sites.push([x, z, 5]); house(x, z, 2); }
    for (let i = 0; i < 5; i++) fallen(...polar(rand() * 6.28, rr(18, 60)), rr(3, 5), rand() * 6.28);
  } else if (floor === 1) { // The Market: payment was the tail, and the lines from above collected it
    for (let d = 10, i = 0; d < goalDist - 13; d += 7.5, i++) { // the arcade road from well to well
      const [ax, az] = along(d, -3.4), [bx, bz] = along(d, 3.4);
      sites.push([...along(d), 6]);
      lintel(ax, az, bx, bz, Math.max(column(ax, az, 4.4, { yaw: goalAngle }), column(bx, bz, 4.4, { yaw: goalAngle })), 0.6, i % 2 === 0);
      const [tx, tz] = along(d + 3.7, i % 2 ? 5.2 : -5.2);
      table(tx, tz, 1.15 - i * 0.12, 2 + i * 2); // further along the road the tables shrink and the coin stacks grow
    }
    paveRoad(...along(8), ...along(goalDist - 12), 1.25, 1.2); // the road itself, worn through in places
    { const [px, pz] = polar(goalAngle - 0.75, 22); sites.push([px, pz, 9]); // the measuring posts, shortest to tallest
      for (let i = 0; i < 9; i++) { const x = px + (i - 4) * 1.5 * Math.cos(goalAngle), z = pz - (i - 4) * 1.5 * Math.sin(goalAngle), t = post(x, z, 0.6 + i * 0.5, 0.24);
        for (let k = 0.5; k < 0.5 + i * 0.5; k += 0.5) bases.push({ x, y: t - k, z, q: qY(0), s: S(0.47, 0.3, 0.47), color: k % 1 ? dpick(stoneTones) : district }); // a notch at every half length
        flagAt(x, z + 0.9, 0.9); } }
    { const [cx, cz] = polar(goalAngle + 0.95, 30); sites.push([cx, cz, 10]); slab(cx, cz, 6.6, pick(stoneTones), 0.0); // the paying floor, a marked circle under each line
      for (let i = 0; i < 7; i++) { const a = (i / 6) * Math.PI * 2, x = i === 6 ? cx : cx + Math.sin(a) * 4.4, z = i === 6 ? cz : cz + Math.cos(a) * 4.4; slab(x, z, 1.1, district, 0.06); spots.hooks.push([x, z]); } }
    for (let i = 0; i < 4; i++) { const [x, z] = along(14 + i * 9, i % 2 ? -9 : 9); sites.push([x, z, 3]); stall(x, z, goalAngle + (i % 2 ? Math.PI / 2 : -Math.PI / 2)); }
    { const [x, z] = polar(goalAngle + 2.4, 36); heroRing(x, z, 18); }
  } else if (floor === 2) { // The Lamp Streets: the light failed, faith turned downward
    for (let d = 9, i = 0; d < goalDist - 12; d += 8, i++) for (const side of [-4.2, 4.2]) { // an avenue of lamp plinths, some still occupied
      const [x, z] = along(d, side), y = height(x, z) - 0.2;
      sites.push([x, z, 2.5]);
      blocks.push({ x, y, z, q: qY(goalAngle), s: S(1.3, 1.5, 1.3), color: pick(stoneTones) }, { x, y: y + 1.5, z, q: qY(goalAngle), s: S(1.6, 0.2, 1.6), color: district });
      colliders.push({ x, z, r: 1, top: y + 1.9 });
      const taken = (i + (side > 0 ? 1 : 0)) % 3 === 0; // the lamp housing: four posts and a roof, or what an angler has left of it
      for (let k = 0; k < 4; k++) { if (taken && k % 2) continue; const a = goalAngle + Math.PI / 4 + k * Math.PI / 2; blocks.push({ x: x + Math.sin(a) * 0.62, y: y + 1.7, z: z + Math.cos(a) * 0.62, q: qY(goalAngle), s: S(0.13, taken ? dr(0.2, 0.5) : 0.62, 0.13), color: dpick(stoneTones) }); }
      if (!taken) { blocks.push({ x, y: y + 2.32, z, q: qY(goalAngle), s: S(1.25, 0.12, 1.25), color: district }); blocks.push({ x, y: y + 2.44, z, q: qY(goalAngle + Math.PI / 4), s: S(0.6, 0.16, 0.6), color: dpick(stoneTones) }); if (drand() < 0.5) grownBulbs.push({ x, y: y + 1.7, z, q: qY(0), s: S(1, 0.42, 1) }); }
      else shardsAt(x, z, 1.8, 4, dpick(stoneTones));
      flagAt(x + Math.cos(goalAngle) * (side > 0 ? -1.3 : 1.3), z - Math.sin(goalAngle) * (side > 0 ? -1.3 : 1.3), 1.2);
      if (taken) spots.anglers.push([x, z, y + 2.9]);
    }
    { const [cx, cz] = polar(goalAngle + 1.25, 30); // the temple: rings within rings round a pillar wrapped in a coil
      sites.push([cx, cz, 12]);
      for (const [n, R, h] of [[14, 9.5, 4.2], [9, 6, 3.2], [5, 3, 2.3]]) { const stood = []; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + R, x = cx + Math.sin(a) * R, z = cz + Math.cos(a) * R; stood.push([x, z, column(x, z, h, { yaw: a })]); } if (n === 14) strung(stood, true, 3); }
      const top = post(cx, cz, 5.5, 0.45);
      for (let i = 0; i < 6; i++) coils.push({ x: cx, y: top - 5.2 + i * 0.9, z: cz, q: qY(i * 1.1), s: S(1.05), color: district });
      coinHeap(cx, cz, 2.6, 26); paveRing(cx, cz, 4.5, 1.2); paveRing(cx, cz, 7.7, 1.3); for (let i = 0; i < 4; i++) { const a = drand() * 6.28; jarAt(cx + Math.sin(a) * 1.6, cz + Math.cos(a) * 1.6); } }
    coinHeap(goal.x, goal.z, 9, 70); // tails given to the well
    spots.glowRows = []; { const [gx2, gz2] = polar(goalAngle - 1.0, 20); sites.push([gx2, gz2, 9]); for (let r = 0; r < 3; r++) for (let c = 0; c < 9; c++) spots.glowRows.push([gx2 + (c - 4) * 1.6, gz2 + (r - 1) * 2.2]); }
    { const [x, z] = polar(goalAngle + 2.7, 34); heroRing(x, z, 14, { gap: 2 }); } // a broken ring: the unfinished, the dead
  } else if (floor === 3) { // The Narrowing: length taxed, then capped, then gone
    { const [x, z] = polar(goalAngle + 0.9, 28); heroRing(x, z, 20, { sawn: true }); } // monuments sawn down to equal stumps
    { const [x, z] = polar(goalAngle - 1.0, 30); heroRing(x, z, 16, { sawn: true, gap: 3 }); }
    for (let r = 0; r < 2; r++) for (let i = 0; i < 6; i++) { const [x, z] = along(16 + i * 3.2, r ? 6 : -6); sites.push([x, z, 2]); stall(x, z, goalAngle + (r ? -Math.PI / 2 : Math.PI / 2)); } // halls of stalls
    for (let i = 0; i < 9; i++) { const [x, z] = along(goalDist - 20, (i - 4) * 3.1); sites.push([x, z, 2]); stall(x, z, goalAngle); } // a wall of gates too small for a long body
    for (let i = 0; i < 4; i++) { const [x, z] = polar(goalAngle + 2.2 + i * 0.5, rr(16, 30)); sites.push([x, z, 3]); for (let k = 0; k < 7; k++) hoops.push({ x: x + rr(-0.1, 0.1), y: height(x, z) + 0.05 + k * 0.1, z: z + rr(-0.1, 0.1), q: qY(rand() * 6, Math.PI / 2), s: S(0.8), color: pick(stoneTones) }); } // hoops never used, stacked
    for (let i = 0; i < 4; i++) { const [x, z] = polar(rand() * 6.28, rr(24, 55)); if (clearNow(x, z, 6)) heroRing(x, z, 8, { sawn: true, gap: 2, carved: false }); }
    coinHeap(goal.x, goal.z, 8, 40);
  } else { // Ryūgū: no houses, no pens; what is left is coin, and a marked floor
    slab(hall.x, hall.z, 3.4, district, 0.03);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; slab(hall.x + Math.sin(a) * 10.5, hall.z + Math.cos(a) * 10.5, 0.8, pick(stoneTones), 0.03); }
    for (let d = 14; d < goalDist - 10; d += 9) coinHeap(...along(d, rr(-7, 7)), 2.2, 18);
    for (let i = 0; i < 3; i++) { const [x, z] = polar(goalAngle + 1.6 + i * 1.1, rr(22, 40)); if (clearNow(x, z, 5)) heroRing(x, z, 8, { sawn: true, gap: 3, carved: false }); }
  }
  // Great sealed jars. A dash breaks one open; what was put by in it comes out.
  const urns = [];
  const urnAt = (x, z, size, prize) => { const y = height(x, z) - 0.06, col = { x, z, r: 0.36 * size, top: y + size }; colliders.push(col); const u = { x, y, z, size, r: 0.42 * size, prize, broken: false, col, color: clay(), mesh: null }; urns.push(u); for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; flagAt(x + Math.sin(a) * 0.5 * size, z + Math.cos(a) * 0.5 * size, 0.9); } return u; };
  // The nursery: where the young of the Long Ones were taught, and where a first dive begins. A paved way runs out from
  // the start, a little aside of the line to the well: three hoops to swim through, a pen with one small swarm, two more
  // small pens with a bigger one beyond them (which cannot be taken until the small ones are eaten), and a sealed jar across the way.
  const nurse = nursery && floor === 0 ? { dir: goalAngle - 0.35, hoops: [], keep: {} } : null;
  if (nurse) {
    const A = nurse.dir, ux = Math.sin(A), uz = Math.cos(A), nx = Math.cos(A), nz = -Math.sin(A);
    const P = (d, side = 0) => [SPAWN.x + ux * (d + 4.5) + nx * side, SPAWN.z + uz * (d + 4.5) + nz * side]; // measured from where the head is when the dive begins, a body's length out from the start
    for (let d = 0; d <= 48; d += 6) sites.push([...P(d), 8.5]);
    for (const [d, side, lift] of [[8, 0, 1.9], [14, 1.8, 3.9], [20, -1.8, 2.3]]) {
      const [x, z] = P(d, side), y = height(x, z) + lift, R = 1.7;
      for (const sg of [-1, 1]) { const px = x + nx * sg * (R + 0.2), pz = z + nz * sg * (R + 0.2), py = height(px, pz) - 0.2; drums.push({ x: px, y: py, z: pz, q: qY(A), s: S(0.42, y - py, 0.42), color: pick(stoneTones) }); bases.push({ x: px, y: py + 0.15, z: pz, q: qY(A), s: S(0.75, 0.8, 0.75), color: dpick(stoneTones) }); blocks.push({ x: px, y, z: pz, q: qY(A), s: S(0.56, 0.12, 0.56), color: district }); colliders.push({ x: px, z: pz, r: 0.4, top: y + 0.2 }); }
      nurse.hoops.push({ x, y, z, r: R, ux, uz, mesh: null });
    }
    nurse.keep[0] = P(26.5); nurse.keep[1] = P(33.5, 5.2); nurse.keep[2] = P(33.5, -5.2); nurse.keep[5] = P(41.5); // one small; then two small and, beyond them, a middling one that is too big to take until all three small ones are eaten
    { const [x, z] = P(26.5, 3.6), y = height(x, z) - 0.2; blocks.push({ x, y, z, q: qY(A), s: S(1.3, 0.7, 1.3), color: pick(stoneTones) }); coils.push({ x, y: y + 0.86, z, q: qY(A), s: S(0.62), color: district }); } // the lesson, carved: a body closed round a swarm
    nurse.jar = urnAt(...P(49), 2.7, 'shell');
    paveRoad(...P(-3), ...P(47), 1.2, 1.2);
    { const [jx, jz] = P(51), gd = Math.hypot(goal.x - jx, goal.z - jz), gx2 = (goal.x - jx) / gd, gz2 = (goal.z - jz) / gd; // and on from the jar to the rift, small hoops marking the way
      paveRoad(jx, jz, jx + gx2 * (gd - 19), jz + gz2 * (gd - 19), 1.2, 1.2);
      for (let d = 4, i = 0; d < gd - 20; d += 5.5, i++) hoop(jx + gx2 * d + gz2 * (i % 2 ? 2.6 : -2.6), jz + gz2 * d - gx2 * (i % 2 ? 2.6 : -2.6), 1.1); }
  }
  F.ruins.forEach((kind, i) => {
    if (!builders[kind]) return;
    for (let tries = 0; tries < 12; tries++) { const [x, z] = polar(rr(0, 6.28), rr(30, 60)); if (clearNow(x, z, 16)) { builders[kind](x, z); break; } }
  });

  // the rift's middle, where people came to it: old stones along both edges, a pillar at either side of the mouth, a pale beam rising out of it
  const beacons = [];
  const beaconMat = mat(new THREE.MeshBasicMaterial({ map: G.beam, color: last ? '#ffd9a0' : '#bfe9ff', transparent: true, opacity: last ? 0.5 : 0.34, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
  const portal = { mesh: null, level: 1 }; // level dims the gate's light: the Sum puts it out when it wakes
  if (!last) {
    const { nx, nz, tx, tz } = rift, yawT = goalAngle, yawN = goalAngle - Math.PI / 2; // a block turned to lie along the rift, or across it
    const at = (u, a) => { const k = a + riftMid(u); return [goal.x + tx * u + nx * k, goal.z + tz * u + nz * k]; }; // u metres along the rift from its middle, a metres across it
    // a curb along both edges, capped in the district's colour, with gaps to swim in through, and bollards on it
    for (const side of [-1, 1]) for (let i = -6; i <= 6; i++) {
      if (i === 0 || Math.abs(i) === 4) continue;
      const u = i * 2.5, [x, z] = at(u, side * (riftW(u) + 0.7)), y = height(x, z) - 0.15;
      blocks.push({ x, y, z, q: qY(yawT), s: S(2.3, 0.8, 0.8), color: pick(stoneTones) }, { x, y: y + 0.8, z, q: qY(yawT), s: S(2.45, 0.16, 0.95), color: district });
      colliders.push({ x, z, r: 0.85, top: y + 1.0 });
      if (Math.abs(i) % 3 === 2) { drums.push({ x, y: y + 0.96, z, q: qY(yawT), s: S(0.4, 0.5, 0.4), color: dpick(stoneTones) }); blocks.push({ x, y: y + 1.46, z, q: qY(yawT), s: S(0.5, 0.1, 0.5), color: district }); if (floor >= 2) grownBulbs.push({ x, y: y + 1.56, z, q: qY(0), s: S(1, 0.3, 1) }); } // lamps on them once it is dark
    }
    // a row of columns behind each curb, and paving between
    for (const side of [-1, 1]) for (const [u, tall] of [[-17, 0], [-11, 1], [-5, 0], [5, 1], [11, 0], [17, 1]]) {
      const [x, z] = at(u, side * (riftW(u) + 3.3)), big = (side > 0) === !!tall;
      column(x, z, big ? rr(2.6, 3.6) : rr(1.2, 2.2), { capital: big, yaw: yawT });
    }
    for (const side of [-1, 1]) for (let u = -19; u <= 19; u += 1.4) for (const out of [1.95, 4.6]) if (drand() > (out > 2 ? 0.32 : 0.12)) { const [x, z] = at(u, side * (riftW(u) + out)); flagAt(x, z, out > 2 ? 1.4 : 1.25, yawT + dr(-0.15, 0.15)); }
    // steps let into the near wall, going down into the dark
    for (let i = 0; i < 15; i++) {
      const u = -10 + i * 1.25, [x, z] = at(u, -(riftW(u) - rift.ledge - 0.35 - i * 0.17));
      blocks.push({ x, y: rift.y - rift.step - 0.25 - i * 0.66, z, q: qY(yawT), s: S(1.5, 0.2, 1.0), color: i % 5 === 4 ? district : stoneLike(dpick(stoneTones)) });
    }
    { // a tall pillar on the ledge at either side of the mouth, to mark the rift's middle from far off. Nothing hangs between them: a ring there
      // looked like the nursery's hoops, which are for swimming through, and this is no place to be told to swim through anything
      const out = riftW(0) - rift.ledge + 0.9, [ax, az] = at(0, -out), [bx, bz] = at(0, out);
      column(ax, az, 8.4, { yaw: goalAngle }); column(bx, bz, 8.4, { yaw: goalAngle });
    }
    // further along, nobody tends it: what has broken off lies on the edge and on the ledges
    for (let u = -34; u <= 34; u += 3.5) for (const side of [-1, 1]) {
      if (Math.abs(u) > 19 && drand() < 0.75) { const [x, z] = at(u, side * (riftW(u) + dr(0.4, 1.6))); rubbleAt(x, z, 0.2, 1.5, 2 + Math.floor(drand() * 3)); }
      if (riftW(u) > rift.ledge + 0.5 && drand() < 0.5) { const [x, z] = at(u + dr(-1, 1), side * (riftW(u) - dr(2.2, 3.8))); rubbleAt(x, z, 0.1, 0.9, 2); }
    }
    const beam = add(new THREE.Mesh(new THREE.PlaneGeometry(7, 40), beaconMat));
    beam.position.set(goal.x, goal.y + 13, goal.z);
    beam.frustumCulled = false; beam.rotation.order = 'YXZ'; beam.rotation.z = Math.PI; // brightest where it leaves the pit
    beacons.push(beam);
  } else {
    // the palace gate: two great columns, a doubled lintel, lanterns leading up to it, light between the posts
    const yaw = goalAngle, nx = Math.cos(yaw), nz = -Math.sin(yaw), dx = Math.sin(yaw), dz = Math.cos(yaw);
    const ax = goal.x - nx * 4.2, az = goal.z - nz * 4.2, bx = goal.x + nx * 4.2, bz = goal.z + nz * 4.2;
    const top = Math.max(column(ax, az, 8.5, { yaw }), column(bx, bz, 8.5, { yaw }));
    lintel(ax - nx * 1.4, az - nz * 1.4, bx + nx * 1.4, bz + nz * 1.4, top, 0.8, false);
    lintel(ax, az, bx, bz, top - 2.1, 0.5);
    for (let i = 1; i <= 4; i++) for (const sgn of [-1, 1]) column(goal.x - dx * i * 6 + nx * sgn * 5, goal.z - dz * i * 6 + nz * sgn * 5, 2.4, { capital: true, yaw });
    const glowMat = mat(new THREE.MeshBasicMaterial({ map: G.glow, color: '#ffcf8a', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
    portal.mesh = add(new THREE.Mesh(new THREE.PlaneGeometry(9, 9), glowMat));
    portal.mesh.position.set(goal.x, goal.y + 4.6, goal.z);
    portal.mesh.rotation.y = yaw;
    portal.mesh.frustumCulled = false;
    const beam = add(new THREE.Mesh(new THREE.PlaneGeometry(10, 44), beaconMat));
    beam.position.set(goal.x, goal.y + 20, goal.z);
    beam.frustumCulled = false; beam.rotation.order = 'YXZ'; beam.rotation.z = Math.PI;
    beacons.push(beam);
    goal.y += 4.6;
  }

  // ------------------------------------------------------------ body puzzles: three kinds, each one something only a long body can do,
  // each opening a cache. Nobody has to. Nothing is written by them: what must be done is shown by what moves when the fish begins to
  // do it. They are made of pieces the ruins already had, and placed from the third run of numbers, last of all, so that the rest of
  // the band stands where it did.
  //   capstan  a post with the carved coil for its head and a line to a lidded cist: swim round it and the head turns, the lid slides
  //   windows  four hoops in a row, as in the nursery: go through all of them in one pass and each lights as it is threaded
  //   vent     a chimney breathing silt, and its twin, capped: lie over the open one and the cap of the other is blown off
  const PUZZLE = { food: [12, 16, 20, 24, 28], turns: 1.25, reach: 4.6, gap: 5.5, between: 6, plug: 1.5 };
  const puzzles = [];
  {
    const kerb = (x, z, r, n = 9) => { for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, bx = x + Math.sin(a) * r, bz = z + Math.cos(a) * r; blocks.push({ x: bx, y: height(bx, bz) - 0.15, z: bz, q: qY(a), s: S(0.74, 0.5, 0.36), color: stoneTones[i % stoneTones.length] }); } };
    // a post, as `post` makes one, but with nothing drawn from the runs of numbers the rest of the band is laid out by
    const stand = (x, z, h, r) => { const y = height(x, z) - 0.2; bases.push({ x, y: y + 0.18, z, q: qY(0), s: S(r * 2.3, r * 2.2, r * 2.3), color: stoneTones[1 % stoneTones.length] }); drums.push({ x, y, z, q: qY(xr(0, 3)), s: S(r * 2, h, r * 2), color: stoneTones[0] }); colliders.push({ x, z, r: r + 0.25, top: y + h + 0.2 }); return y + h; };
    const flagsTo = (ax, az, bx, bz) => { const len = Math.hypot(bx - ax, bz - az); for (let d = 0.9; d < len - 0.6; d += 1.15) { const x = lerp(ax, bx, d / len) + xr(-0.1, 0.1), z = lerp(az, bz, d / len) + xr(-0.1, 0.1); flags.push({ x, y: height(x, z) - 0.03, z, q: lie(x, z, Math.atan2(bx - ax, bz - az)), s: S(0.95, 0.1, 0.8), color: tint(stoneTones[0], '#7c9794', 0.35) }); } };
    // a cist: a ring of kerb stones with a round lid in the band's paint, and what was put by inside it
    const cist = (x, z) => { kerb(x, z, 1.05); const y = height(x, z); for (let i = 0; i < 7; i++) { const a = xr(0, 6.28), d = xr(0, 0.6); coins.push({ x: x + Math.sin(a) * d, y: y + 0.05 + i * 0.03, z: z + Math.cos(a) * d, q: qY(xr(0, 6), xr(-0.5, 0.5), xr(-0.5, 0.5)), s: S(1), color: i % 2 ? '#e9dfc0' : district }); } return { x, y: y + 0.42, z, open: 0 }; };
    // somewhere clear for one: first beside the way to the well, where it will be come upon; failing that, anywhere in the band
    const spot = (pad) => { for (let t = 0; t < 260; t++) { const [x, z] = t < 90 ? along(xr(16, Math.max(goalDist - 16, 22)), (xrand() < 0.5 ? -1 : 1) * xr(9, 26)) : polar(xr(0, 6.28), xr(16, 66)); if (clearNow(x, z, pad) && puzzles.every((p) => farFrom(x, z, p.x, p.z, 15))) return [x, z]; } return null; };
    const kinds = last ? ['capstan', 'vent'] : ['capstan', 'windows', 'vent'];
    for (const kind of kinds) {
      if (kind === 'capstan') {
        const at = spot(5.5); if (!at) continue; const [x, z] = at, a = xr(0, 6.28), cx = x + Math.sin(a) * 5.2, cz = z + Math.cos(a) * 5.2;
        const top = stand(x, z, 2.5, 0.34); kerb(x, z, 0.95, 7); flagsTo(x, z, cx, cz);
        blocks.push({ x: (x + cx) / 2, y: height((x + cx) / 2, (z + cz) / 2) + 0.2, z: (z + cz) / 2, q: qY(a), s: S(0.06, 0.06, 5.2), color: '#4a4036' }); // the line from the capstan to the lid
        sites.push([x, z, 6.5, 'puzzle'], [cx, cz, 2.5, 'puzzle']);
        puzzles.push({ kind, x, z, y: top - 0.55, cache: cist(cx, cz), ax: Math.sin(a), az: Math.cos(a), turn: 0, was: null, done: false, k: 0, ring: { x, z, y: top - 0.55, left: 1, can: true, threat: 1, orbit: 2.0 } }); // `ring`: what the wrap keys go round, as they do a swarm
      } else if (kind === 'windows') {
        let made = null;
        for (let t = 0; t < 500 && !made; t++) { const p = t < 180 ? along(xr(14, Math.max(goalDist - 14, 22)), (xrand() < 0.5 ? -1 : 1) * xr(8, 26)) : polar(xr(0, 6.28), xr(16, 66));
          const dir = t < 180 ? goalAngle + xr(-0.6, 0.6) : xr(0, 6.28), ux = Math.sin(dir), uz = Math.cos(dir), pts = [0, 1, 2, 3].map((k) => [p[0] + ux * k * PUZZLE.gap + Math.cos(dir) * Math.sin(k * 1.3) * 0.9, p[1] + uz * k * PUZZLE.gap - Math.sin(dir) * Math.sin(k * 1.3) * 0.9]);
          const end = [p[0] + ux * (3 * PUZZLE.gap + 4.2), p[1] + uz * (3 * PUZZLE.gap + 4.2)];
          if ([...pts, end].every(([hx, hz]) => clearNow(hx, hz, 2.7) && puzzles.every((q) => farFrom(hx, hz, q.x, q.z, 12)))) made = { dir, ux, uz, pts, end }; }
        if (!made) continue;
        const { dir, ux, uz, pts, end } = made, nx = Math.cos(dir), nz = -Math.sin(dir), R = 1.55;
        const hoops4 = pts.map(([hx, hz], k) => { const y = height(hx, hz) + 2.3 + 0.5 * Math.sin(k * 2.1 + 1);
          for (const sg of [-1, 1]) { const px = hx + nx * sg * (R + 0.2), pz = hz + nz * sg * (R + 0.2), py = height(px, pz) - 0.2; drums.push({ x: px, y: py, z: pz, q: qY(dir), s: S(0.4, y - py, 0.4), color: stoneTones[k % stoneTones.length] }); bases.push({ x: px, y: py + 0.15, z: pz, q: qY(dir), s: S(0.72, 0.8, 0.72), color: stoneTones[(k + 1) % stoneTones.length] }); blocks.push({ x: px, y, z: pz, q: qY(dir), s: S(0.54, 0.12, 0.54), color: district }); colliders.push({ x: px, z: pz, r: 0.4, top: y + 0.2 }); }
          sites.push([hx, hz, 3, 'puzzle']); return { x: hx, y, z: hz, r: R, lit: 0, side: 0, mesh: null }; });
        flagsTo(pts[0][0] - ux * 2.5, pts[0][1] - uz * 2.5, end[0], end[1]); sites.push([end[0], end[1], 2.5, 'puzzle']);
        puzzles.push({ kind, x: pts[0][0], z: pts[0][1], y: hoops4[0].y, dir, ux, uz, hoops: hoops4, cache: cist(end[0], end[1]), next: -1, step: 0, timer: 0, done: false, k: 0 });
      } else {
        const at = spot(5.5); if (!at) continue; const [x, z] = at, a = xr(0, 6.28), bx = x + Math.sin(a) * 6, bz = z + Math.cos(a) * 6;
        const chimney = (vx, vz) => { const y = height(vx, vz) - 0.2; bases.push({ x: vx, y: y + 0.12, z: vz, q: qY(a), s: S(1.5, 1.1, 1.5), color: stoneTones[1 % stoneTones.length] }); shafts.push({ x: vx, y: y + 0.3, z: vz, q: qY(a), s: S(1.3, 1.25, 1.3), color: stoneTones[0] }); drums.push({ x: vx, y: y + 1.5, z: vz, q: qY(a), s: S(0.84, 0.06, 0.84), color: '#1d2530' }); colliders.push({ x: vx, z: vz, r: 0.72, top: y + 1.56 }); return y + 1.56; };
        const topA = chimney(x, z), topB = chimney(bx, bz); flagsTo(x, z, bx, bz); kerb(bx, bz, 1.25, 8);
        sites.push([x, z, 4, 'puzzle'], [bx, bz, 4, 'puzzle']);
        puzzles.push({ kind, x, z, y: topA, cache: { x: bx, y: topB + 0.02, z: bz, open: 0, shell: true }, press: 0, puff: 0, done: false, k: 0 });
      }
    }
  }
  // Fragments of the ruins that can be hauled to the rift (main.js, `haul`): the top of a column, fallen, its slab still in the band's paint.
  // Two to a band, a good way from the rift, so that getting one there is a journey with the body tied up.
  const fragments = [], LIE = 0.45; // how far off the bed the middle of one is, lying on its side
  for (let i = 0, t = 0; i < 2 && t < 300; t++) { const [x, z] = t < 120 ? along(xr(12, Math.max(goalDist - 26, 16)), (xrand() < 0.5 ? -1 : 1) * xr(7, 22)) : polar(xr(0, 6.28), xr(14, 60));
    if (!clearNow(x, z, 2.5) || !farFrom(x, z, goal.x, goal.z, 24) || fragments.some((f) => !farFrom(x, z, f.x, f.z, 16)) || puzzles.some((p) => !farFrom(x, z, p.x, p.z, 7))) continue;
    sites.push([x, z, 2.2, 'puzzle']); i++;
    fragments.push({ x, y: height(x, z) + LIE, z, yaw: xr(0, 6.28), tilt: xr(1.2, 1.36), held: false, gone: false, sink: 0, mesh: null, ring: { x, z, left: 1, can: true, threat: 1, orbit: 1.5 } }); }
  // A cleaning station (CLEAN), near where tail-biters live if they have a place of their own in this band, else off the way to the rift.
  const stations = [];
  if (F.biters > 0) for (let t = 0; t < 300 && !stations.length; t++) {
    const from = t < 200 && spots.biters.length ? spots.biters[Math.floor(xrand() * spots.biters.length)] : null, a = xr(0, 6.28), d = xr(9, 15);
    const [x, z] = from ? [from[0] + Math.sin(a) * d, from[1] + Math.cos(a) * d] : along(xr(14, Math.max(goalDist - 20, 18)), (xrand() < 0.5 ? -1 : 1) * xr(8, 20));
    if (!clearNow(x, z, 4.5) || !farFrom(x, z, goal.x, goal.z, 20) || (hall && !farFrom(x, z, hall.x, hall.z, hall.R + 6)) || fragments.some((f) => !farFrom(x, z, f.x, f.z, 7)) || puzzles.some((p) => !farFrom(x, z, p.x, p.z, 8))) continue;
    const y = height(x, z), col = { x, z, r: 1.25, top: y + 1.15 }; colliders.push(col); sites.push([x, z, 4, 'puzzle']);
    stations.push({ x, y, z, top: y + 1.3, yaw: xr(0, 6.28), k: 0, uses: CLEAN.uses, rest: 0, on: false, near: false, live: false, cx: x, cz: z, away: 0, ring: null, arc: null,
      fish: Array.from({ length: CLEAN.fish }, (_, i) => ({ p: new THREE.Vector3(x, y + 1.9, z), v: new THREE.Vector3(), ph: xr(0, 6.28), slot: 0.08 + 0.84 * ((i * 0.618) % 1), side: i % 2 ? 1 : -1, yaw: xr(0, 6.28), pitch: 0, size: 1 })) });
  }
  const clearOfSites = (x, z, pad = 0) => sites.every(([sx, sz, r]) => farFrom(x, z, sx, sz, r * 0.75 + pad)) && farFrom(x, z, SPAWN.x, SPAWN.z, 5 + pad) && riftClear(x, z, pad + 0.6);

  // ------------------------------------------------------------ swarms of small fish: the food, in four sizes
  const fishKit = swarmKit(swarmFor(floor), { glow: F.fishGlow }); // this band's small fish, as their component gives them
  const schools = [], schoolTones = fishKit.tones;
  [...F.schools].forEach((tier, s) => {
    const first = floor === 0 && s === 0, tease = floor === 0 && tier === 'h';
    let hx = rand() * T, hz = rand() * T;
    const kept = nurse ? nurse.keep[s] : null;
    if (first) { hx = SPAWN.x + 8; hz = SPAWN.z - 13; } // inside the ring of columns, to learn on
    if (kept) { [hx, hz] = kept; pen(hx, hz, SWARMS[tier].r * 2.6 + 1.1); }
    if (tease) [hx, hz] = [teaseAt[0] + 3.2, teaseAt[1]]; // the great swarm, kept inside the greatest hero's ring, in plain sight long before it can be caught
    const penned = !kept && !first && !tease && (floor === 0 || (floor === 1 && s % 2 === 0)); // deeper down nobody keeps them
    if (penned) { for (let t = 0; t < 12 && !clearNow(hx, hz, 5); t++) { hx = rand() * T; hz = rand() * T; } sites.push([hx, hz, 4]); pen(hx, hz, SWARMS[tier].r * 2.6 + 1.1); }
    if (hall) for (let t = 0; t < 20 && !farFrom(hx, hz, hall.x, hall.z, hall.R + 12); t++) { hx = rand() * T; hz = rand() * T; } // no swarm drifts into the hall
    if (rift && !kept && !first && !tease) for (let t = 0; t < 20 && !riftClear(hx, hz, 5); t++) { hx = rand() * T; hz = rand() * T; } // or lives in the rift
    const sw = SWARMS[tier];
    let kind = kept || first || tease ? '' : KIND[(F.kinds || '')[s]] || '';
    if (kind === 'twin' && (penned || !LOWER[tier])) kind = ''; // the halves need room to part, and a size to be
    if (kind === 'glow' && penned) kind = '';
    const sc = { tier, kind, n: sw.n, ball: sw.r, fit: sw.r, orbit: sw.r + 0.3, can: false, px: 0, pz: 0, pack: 1, progress: 0, arcStart: 0, arcSign: 1, hx, hz, hy: height(hx, hz) + rr(2.6, 4.2), ph: rand() * 6.28, r: kept ? 0.6 : first ? 1.6 : tease ? 1.4 : penned ? 0.7 : rr(4, 9), clock: rand() * 50,
      threat: 0, x: hx, z: hz, y: 0, left: sw.n, burst: 0, tone: schoolTones[s % schoolTones.length], ring: null, arc: null };
    // what the tempers add: how the loose swarm is shaped (`slack` wider or narrower, `tall` stretched or flattened), and each sort's own state
    if (kind === 'bolt') Object.assign(sc, { hy: sc.hy + TEMPER.bolt.hang, slack: TEMPER.bolt.slack, tall: TEMPER.bolt.tall, by: 0, capped: false, bolted: 0 });
    if (kind === 'twin') Object.assign(sc, { slack: TEMPER.twin.slack, ax: Math.sin(sc.ph), az: Math.cos(sc.ph), gap: sw.r * TEMPER.twin.lobes, whole: { tier, n: sw.n, ball: sw.r }, split: false, part: 0, calm: 0, sx: 0, sz: 0, swell: 1 });
    if (kind === 'glow') Object.assign(sc, { slack: TEMPER.glow.slack, tall: TEMPER.glow.flat, lit: false, fled: 0, light: null });
    schools.push(sc);
  });
  // the other half of each swarm that parts: it has no fish until the parting, then half of them, and keeps to the same drift as the half it came from
  for (const sc of schools.filter((x) => x.kind === 'twin')) {
    const low = SWARMS[LOWER[sc.tier]];
    sc.twin = { ...sc, kind: 'half', tier: LOWER[sc.tier], n: 0, left: 0, ball: low.r, fit: low.r, slack: 1, gap: 0, whole: null, twin: null, of: sc, split: true, ring: null, arc: null };
    schools.push(sc.twin);
  }
  const total = schools.reduce((a, sc) => a + sc.n, 0);
  const minnowMat = mat(fishKit.material), fishSize = new THREE.Vector3().setScalar(fishKit.scale);
  const fishMesh = add(new THREE.InstancedMesh(fishKit.geometry, minnowMat, Math.max(total, 1)));
  fishMesh.frustumCulled = false; fishMesh.castShadow = true;
  const minnows = [];
  {
    const c = new THREE.Color();
    for (const sc of schools) for (let i = 0; i < sc.n; i++) {
      // an even-ish fill of the ball: radius by cube root, so the middle is not crowded
      minnows.push({ sc, half: i % 2, ph: rand() * 6.28, rho: 0.25 + 0.75 * Math.cbrt(rand()), h: rr(-1, 1), sp: rr(0.7, 1.3), flee: new THREE.Vector3(), p: new THREE.Vector3(), first: true, alive: true });
      fishMesh.setColorAt(minnows.length - 1, c.set(sc.tone));
    }
  }
  // Round a cornered swarm: a faint ring, pale if the body is long enough to go round it and coral if not,
  // and a bright arc that fills as the body wraps it.
  const circle = Array.from({ length: 49 }, (_, i) => new THREE.Vector3(Math.sin((i / 48) * Math.PI * 2), 0, Math.cos((i / 48) * Math.PI * 2)));
  const ringGeo = new THREE.BufferGeometry().setFromPoints(circle);
  owned.push({ dispose: () => ringGeo.dispose() });
  const line = (color, opacity) => mat(new THREE.LineBasicMaterial({ color, transparent: true, opacity, fog: false }));
  const ringYes = line('#f2faf7', 0.32), ringNo = line('#ff7f96', 0.5), arcYes = line('#ffffff', 0.95), arcNo = line('#ff7f96', 0.9);
  for (const sc of schools) {
    sc.ring = add(new THREE.Line(ringGeo, ringYes)); sc.arc = add(new THREE.Line(ringGeo.clone(), arcYes));
    owned.push({ dispose: () => sc.arc.geometry.dispose() });
    for (const o of [sc.ring, sc.arc]) { o.frustumCulled = false; o.visible = false; }
  }

  // ------------------------------------------------------------ rocks
  const rockTones = tonesOf('rock');
  const rocks = [], reefs = [];
  for (let i = 0; i < 26; i++) reefs.push([rand() * T, rand() * T]);
  for (let i = 0; i < F.rocks; i++) {
    let x, z;
    const big = i < 26;
    if (big) [x, z] = reefs[i];
    else if (i < F.rocks * 0.65) { const c = pick(reefs), a = rand() * 6.28, d = rr(1.5, 9); x = c[0] + Math.sin(a) * d; z = c[1] + Math.cos(a) * d; }
    else { x = rand() * T; z = rand() * T; }
    const base = big ? rr(1.6, 3.4) : rr(0.35, 1.3);
    const s = S(base * rr(0.8, 1.3), base * rr(0.55, 1.0), base * rr(0.8, 1.3)), q = qY(rand() * 6.28, rr(-0.3, 0.3), rr(-0.3, 0.3)), tone = pick(rockTones);
    if (!clearOfSites(x, z, big ? 3 : 0)) continue;
    const y = height(x, z) + s.y * 0.2;
    rocks.push({ x, y, z, q, s, color: tone });
    if (base > 0.9) colliders.push({ x, y, z, r: (s.x + s.z) * 0.47 });
  }
  scatter(G.rock, mat(new THREE.MeshLambertMaterial({ color: '#ffffff', vertexColors: true })), rocks);

  // everything that grows shares one kind of material: it may sway with the water, and faces marked for it give light
  const plant = (o) => mat(growing(o, time, wake));
  const grownAt = {}; // where the things that answer the fish stand, by kind, for the checks and the pictures
  // ------------------------------------------------------------ kelp, swaying
  if (F.kelp) {
    const kelpMat = plant({ sway: 1, give: 0.4 });
    const kelpTones = tonesOf('kelp'), kelp = [];
    for (let c = 0; c < F.kelp; c++) {
      const cx = rand() * T, cz = rand() * T, n = 3 + Math.floor(rand() * 7), tall = rr(3, 7.5);
      for (let i = 0; i < n; i++) {
        const a = rand() * 6.28, d = rr(0, 2.8), x = cx + Math.sin(a) * d, z = cz + Math.cos(a) * d, w = rr(1.3, 2.2), hgt = tall * rr(0.6, 1.1), yaw = rand() * 6.28, tone = pick(kelpTones);
        if (clearOfSites(x, z)) kelp.push({ x, y: height(x, z) - 0.15, z, q: qY(yaw), s: S(w, hgt, w), color: tone });
      }
    }
    for (const [x, z] of spots.kelpRows || []) kelp.push({ x, y: height(x, z) - 0.15, z, q: qY(rand() * 6.28), s: S(1.6, rr(3.6, 4.6), 1.6), color: pick(kelpTones) });
    scatter(G.kelp, kelpMat, (grownAt.kelp = kelp), { receive: false });
  }

  // ------------------------------------------------------------ coral near the big rocks; lower down, things that make their own light
  const coralTones = tonesOf('staghorn'), tableTones = tonesOf('tablecoral');
  const fingers = [], tables = [];
  for (let i = 0; i < F.coral; i++) {
    const c = pick(reefs), a = rand() * 6.28, d = rr(1.8, 8), x = c[0] + Math.sin(a) * d, z = c[1] + Math.cos(a) * d;
    const s = rr(0.8, 1.9), q = qY(rand() * 6.28, rr(-0.12, 0.12), rr(-0.12, 0.12)), tone = pick(coralTones), finger = rand() < 0.62;
    if (clearOfSites(x, z)) (finger ? fingers : tables).push({ x, y: height(x, z) - 0.1, z, q, s: S(s), color: finger ? tone : tableTones[coralTones.indexOf(tone) % tableTones.length] });
  }
  for (const g of grownFingers) fingers.push({ ...g, color: dpick(coralTones) });
  const coralMat = mat(new THREE.MeshLambertMaterial({ color: '#ffffff', vertexColors: true }));
  scatter(G.finger, coralMat, fingers, { cast: false });
  scatter(G.table, coralMat, tables);
  const glowTones = tonesOf('lantern'), penTones = tonesOf('seapen'), lanterns = [], pens = [];
  for (let i = 0; i < F.glow; i++) {
    const c = rand() < 0.7 ? pick(reefs) : [rand() * T, rand() * T], a = rand() * 6.28, d = rr(0.5, 9), x = c[0] + Math.sin(a) * d, z = c[1] + Math.cos(a) * d;
    const hgt = rr(0.5, 1.9), q = qY(rand() * 6.28, rr(-0.25, 0.25), rr(-0.25, 0.25)), tone = pick(glowTones);
    if (clearOfSites(x, z)) (i % 3 === 2 ? pens : lanterns).push({ x, y: height(x, z) - 0.05, z, q, s: i % 3 === 2 ? S(1.5, hgt * 0.9 + 0.4, 1.5) : S(1.25, hgt * 0.75 + 0.35, 1.25), color: i % 3 === 2 ? penTones[glowTones.indexOf(tone) % penTones.length] : tone });
  }
  for (const [x, z] of spots.glowRows || []) lanterns.push({ x, y: height(x, z) - 0.05, z, q: qY(rand() * 6.28), s: S(1.3, rr(1.2, 1.6), 1.3), color: glowTones[0] });
  for (const g of grownBulbs) lanterns.push({ ...g, s: S(g.s.x * 1.1, g.s.y * 1.6 + 0.2, g.s.z * 1.1), color: dpick(glowTones) });
  scatter(G.lantern, plant({ sway: 0.3, glow: 1.15, give: 0.3 }), lanterns, { cast: false, receive: false });
  scatter(G.pen, plant({ sway: 0.3, glow: 1.15, shy: 1 }), (grownAt.seapen = pens), { cast: false, receive: false });

  // ------------------------------------------------------------ the bed itself: what lives and lies on it, band by band
  {
    const at = (list) => list[floor] || 0;
    const open = (pad = 1) => { for (let t = 0; t < 8; t++) { const x = drand() * T, z = drand() * T; if (clearOfSites(x, z, pad)) return [x, z]; } return null; };
    const byReef = (r0, r1) => { for (let t = 0; t < 8; t++) { const c = dpick(reefs), a = drand() * 6.28, d = dr(r0, r1), x = c[0] + Math.sin(a) * d, z = c[1] + Math.cos(a) * d; if (clearOfSites(x, z, 1)) return [x, z]; } return null; };
    const strew = (n, where, make) => { const out = []; for (let i = 0; i < n; i++) { const p = where(); if (p) { const it = make(p[0], p[1]); if (it) out.push(it); } } return out; };
    const flat = (tones, s0, s1, lift = 0.012) => (x, z) => ({ x, y: height(x, z) + lift, z, q: lie(x, z), s: S(dr(s0, s1)), color: dpick(tones) });
    const rooted = (tones, s0, s1, sink = 0.06) => (x, z) => { const sz = dr(s0, s1); return { x, y: height(x, z) - sink * sz, z, q: qY(drand() * 6.28, dr(-0.1, 0.1), dr(-0.1, 0.1)), s: S(sz), color: dpick(tones) }; };
    const still = plant({ double: false }), stillBoth = plant();
    // seagrass in the green patches of the two bands that have light
    { const grass = []; for (let i = 0, n = at([1400, 700]); i < n * 7 && grass.length < n; i++) { const x = drand() * T, z = drand() * T; if (meadow(x, z) > 0.5 && clearOfSites(x, z, 0.5)) grass.push({ x, y: height(x, z) - 0.04, z, q: qY(drand() * 6.28), s: S(dr(1.1, 1.8), dr(0.4, 0.95), dr(1.1, 1.8)), color: dpick(tonesOf('seagrass')) }); }
      if (grass.length) scatter(G.tuft, plant({ sway: 1.3, give: 0.55 }), (grownAt.seagrass = grass), { cast: false, receive: false, reach: 44 }); }
    // pebbles and broken shell, in drifts
    { const stones = [], tones = tonesOf('pebble');
      for (let c = 0, n = at([170, 170, 190, 210, 200]); c < n; c++) { const p = open(0.5); if (!p) continue; for (let i = 0, k = 3 + Math.floor(drand() * 6); i < k; i++) { const x = p[0] + dr(-1.3, 1.3), z = p[1] + dr(-1.3, 1.3), sz = dr(0.05, 0.2); stones.push({ x, y: height(x, z) - sz * 0.25, z, q: lie(x, z), s: S(sz * dr(0.8, 1.5), sz, sz * dr(0.8, 1.3)), color: dpick(tones) }); } }
      scatter(G.pebble, still, stones, { cast: false, reach: 40 }); }
    scatter(G.star, still, strew(at([70, 60, 30]), () => open(), flat(tonesOf('starfish'), 0.2, 0.38)), { cast: false, reach: 44 });
    scatter(G.brittle, still, strew(at([0, 0, 30, 60, 60]), () => open(), flat(tonesOf('brittlestar'), 0.3, 0.55)), { cast: false, reach: 44 });
    scatter(G.urchin, stillBoth, strew(at([44, 40, 30, 20]), () => byReef(1, 6), rooted(tonesOf('urchin'), 0.24, 0.46, 0.02)), { cast: false, reach: 44 });
    scatter(G.clam, plant({ shy: 1 }), (grownAt.clam = strew(at([60, 50, 34, 24, 24]), () => open(), flat(tonesOf('clam'), 0.16, 0.32))), { cast: false, reach: 44 });
    { const domes = strew(at([30, 16]), () => byReef(2, 8), rooted(tonesOf('braincoral'), 0.5, 1.25, 0.1));
      for (const d of domes) if (d.s.x > 0.8) colliders.push({ x: d.x, y: d.y, z: d.z, r: d.s.x * 0.8 });
      scatter(G.brain, still, domes); }
    scatter(G.seaFan, plant({ sway: 0.5, give: 0.22 }), strew(at([34, 30, 16]), () => byReef(1.5, 8), rooted(tonesOf('seafan'), 1.0, 2.0)), { receive: false });
    scatter(G.sponge, still, strew(at([30, 30, 20]), () => byReef(1.5, 7), rooted(tonesOf('sponge'), 0.7, 1.4)));
    scatter(G.anemone, plant({ sway: 0.9, shy: 1 }), (grownAt.anemone = strew(at([44, 30, 12]), () => byReef(1, 6), rooted(tonesOf('anemone'), 0.6, 1.25, 0.03))), { cast: false });
    scatter(G.lily, plant({ sway: 0.5, shy: 1 }), (grownAt.sealily = strew(at([0, 12, 40, 40, 22]), () => (drand() < 0.6 ? byReef(1, 8) : open()), rooted(tonesOf('sealily'), 0.9, 1.8, 0.02))), { receive: false });
    scatter(G.glass, still, strew(at([0, 0, 14, 40, 40]), () => (drand() < 0.5 ? byReef(1, 8) : open()), rooted(tonesOf('glasssponge'), 0.6, 1.4)));
    scatter(G.worms, plant({ double: false, shy: 1 }), (grownAt.tubeworms = strew(at([0, 0, 0, 30, 50]), () => byReef(0.8, 4), (x, z) => ({ ...rooted(tonesOf('tubeworms'), 0.8, 1.5)(x, z) }))));
  }

  // ------------------------------------------------------------ drifting specks and slow light shafts
  const SPECKS = 320, BOX = new THREE.Vector3(46, 16, 46);
  const sp = new Float32Array(SPECKS * 3), spBase = new Float32Array(SPECKS * 3);
  for (let i = 0; i < SPECKS * 3; i++) spBase[i] = rand();
  const spGeo = new THREE.BufferGeometry();
  spGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const specks = add(new THREE.Points(spGeo, mat(new THREE.PointsMaterial({ color: '#f1fbf8', size: 0.07, transparent: true, opacity: 0.55, depthWrite: false }))));
  specks.frustumCulled = false;
  owned.push({ dispose: () => spGeo.dispose() });

  const rays = [];
  if (F.shafts) {
    const shaftMat = mat(new THREE.MeshBasicMaterial({ map: G.beam, color: '#ebfff0', transparent: true, opacity: F.shafts, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
    for (let i = 0; i < 9; i++) {
      const m = add(new THREE.Mesh(new THREE.PlaneGeometry(rr(3.5, 7), 34), shaftMat));
      m.userData = { x: rand() * 70, z: rand() * 70, ph: rand() * 6.28 };
      m.frustumCulled = false;
      rays.push(m);
    }
  }

  // ------------------------------------------------------------ all the stonework, instanced once every builder has added its pieces
  { const places = sites.slice(1).filter(([x, z, r, what]) => r >= 5 && !what && (!hall || farFrom(x, z, hall.x, hall.z, hall.R + 8)) && (!nurse || urns.every((u) => farFrom(x, z, u.x, u.z, 12))));
    for (let i = 0; i < 5 && places.length; i++) { const [sx, sz, r] = places.splice(Math.floor(drand() * places.length), 1)[0], a = drand() * 6.28, p = new THREE.Vector3(sx + Math.sin(a) * r * 0.45, 0, sz + Math.cos(a) * r * 0.45); p.y = height(p.x, p.z) + 1; pushOut(p, 1.3); urnAt(p.x, p.z, dr(1.9, 2.4), 'food'); } }
  const single = [];
  for (const u of urns) { u.mesh = add(new THREE.Mesh(G.jar, mat(new THREE.MeshLambertMaterial({ color: u.color, vertexColors: true, side: THREE.DoubleSide })))); u.mesh.scale.setScalar(u.size); u.mesh.rotation.y = drand() * 6.28; u.mesh.castShadow = true; u.mesh.frustumCulled = false; single.push(u); }
  if (nurse) for (const h of nurse.hoops) { h.mesh = add(new THREE.Mesh(G.wreath, mat(new THREE.MeshLambertMaterial({ color: district, vertexColors: true, emissive: '#ffe9b0', emissiveIntensity: 0 })))); h.mesh.scale.setScalar(h.r); h.mesh.rotation.y = nurse.dir; h.mesh.castShadow = true; h.mesh.frustumCulled = false; single.push(h); }

  // the parts of the puzzles that move: a capstan's head, the hoops of a row of windows, and the lid of every cache
  { const paint = () => mat(new THREE.MeshLambertMaterial({ color: district, vertexColors: true, emissive: '#ffe9b0', emissiveIntensity: 0 }));
    for (const p of puzzles) {
      const c = p.cache, wide = p.kind === 'vent' ? 1.75 : 2.35;
      c.lid = { mesh: add(new THREE.Mesh(G.drum, paint())), x: c.x, y: c.y, z: c.z }; c.lid.mesh.scale.set(wide, 0.14, wide); c.lid.mesh.castShadow = true; c.lid.mesh.frustumCulled = false; single.push(c.lid);
      if (p.kind === 'capstan') { const g = add(new THREE.Group()), m = paint(), ring = new THREE.Mesh(G.coil, m); ring.scale.setScalar(1.25); ring.castShadow = true; g.add(ring);
        for (const a of [0, Math.PI / 2]) { const bar = new THREE.Mesh(G.block, m); bar.scale.set(0.13, 0.13, 3.1); bar.position.y = -0.07; bar.rotation.y = a; bar.castShadow = true; g.add(bar); }
        p.head = { mesh: g, x: p.x, y: p.y, z: p.z, mat: m }; single.push(p.head); }
      if (p.kind === 'windows') for (const h of p.hoops) { h.mesh = add(new THREE.Mesh(G.wreath, paint())); h.mesh.scale.setScalar(h.r); h.mesh.rotation.y = p.dir; h.mesh.castShadow = true; h.mesh.frustumCulled = false; single.push(h); }
    } }
  // The top of a column with the snapped end of its shaft still on it: lying on its side on the bed, hanging upright under whoever carries it.
  for (const f of fragments) { const g = add(new THREE.Group()), stone = mat(new THREE.MeshLambertMaterial({ color: stoneTones[0], vertexColors: true })), cushion = new THREE.Mesh(G.echinus, stone), neck = new THREE.Mesh(G.stump, stone),
      slab = new THREE.Mesh(G.block, mat(new THREE.MeshLambertMaterial({ color: district, vertexColors: true, emissive: district, emissiveIntensity: 0.2 })));
    slab.scale.set(1.5, 0.18, 1.5); slab.position.y = 0.2; neck.rotation.x = Math.PI; cushion.castShadow = slab.castShadow = neck.castShadow = true; g.add(neck, cushion, slab); g.scale.setScalar(0.8); g.rotation.set(f.tilt, f.yaw, 0, 'YXZ'); f.mesh = g; f.slab = slab; single.push(f); }
  // A cleaning station: a coral head on a mound with a sponge or two at its foot, its cleaners over it, and a pale ring that fills as they work.
  const cleanKit = stations.length ? swarmKit('cleaner', { glow: Math.max(F.fishGlow, 0.2) }) : null, cleanMat = cleanKit && mat(cleanKit.material), cleanSize = new THREE.Vector3();
  const cleanMesh = cleanKit && add(new THREE.InstancedMesh(cleanKit.geometry, cleanMat, stations.length * CLEAN.fish));
  if (cleanMesh) { cleanMesh.frustumCulled = false; cleanMesh.castShadow = true; owned.push({ dispose: () => cleanKit.dispose() }); }
  for (const st of stations) { const g = add(new THREE.Group()), coral = tonesOf('braincoral'), tube = tonesOf('sponge'), lit = 0.1 + 0.25 * F.fishGlow;
    const part = (geo, color, x, y, z, sx, sy = sx, sz = sx) => { const m = new THREE.Mesh(geo, mat(new THREE.MeshLambertMaterial({ color, vertexColors: true, emissive: color, emissiveIntensity: geo === G.rock ? 0 : lit }))); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
    part(G.rock, stoneTones[0], 0, 0.1, 0, 1.55, 0.8, 1.45); part(G.brain, coral[floor % coral.length], 0.1, 0.62, -0.05, 0.78); part(G.brain, coral[(floor + 3) % coral.length], -0.95, 0.3, 0.6, 0.42);
    part(G.sponge, tube[floor % tube.length], 1.05, 0.2, 0.55, 0.8); part(G.sponge, tube[(floor + 1) % tube.length], 0.75, 0.15, -1.0, 0.6);
    g.rotation.y = st.yaw; st.mesh = g; single.push(st);
    st.ring = add(new THREE.Line(ringGeo, ringYes)); st.arc = add(new THREE.Line(ringGeo.clone(), arcYes)); owned.push({ dispose: () => st.arc.geometry.dispose() });
    for (const o of [st.ring, st.arc]) { o.frustumCulled = false; o.visible = false; } }
  // a jar breaks: what stands there afterwards is its foot, and it no longer stops anyone
  const breakUrn = (u) => { if (u.broken) return false; u.broken = true; u.col.off = true; u.mesh.geometry = G.jarBroken; return true; };

  const stone = mat(new THREE.MeshLambertMaterial({ color: '#ffffff', vertexColors: true }));
  scatter(G.drum, stone, drums);
  scatter(G.block, stone, blocks);
  scatter(G.coin, stone, coins, { cast: false });
  scatter(G.hoop, stone, hoops);
  scatter(G.coil, stone, coils);
  scatter(G.shaft, stone, shafts);
  scatter(G.shaftEnd, stone, shaftEnds);
  scatter(G.stump, stone, stumps);
  scatter(G.base, stone, bases);
  scatter(G.echinus, stone, echini);
  scatter(G.flag, stone, flags, { cast: false, reach: 60 });
  scatter(G.rubble, stone, rubbles, { cast: false, reach: 60 });
  scatter(G.shard, mat(new THREE.MeshLambertMaterial({ color: '#ffffff', vertexColors: true, side: THREE.DoubleSide })), shards, { cast: false, reach: 40 });
  scatter(G.jar, stone, jars);
  scatter(G.jarBroken, mat(new THREE.MeshLambertMaterial({ color: '#ffffff', vertexColors: true, side: THREE.DoubleSide })), jarsBroken);

  // ------------------------------------------------------------ what answers the fish as it goes by. No rule hangs on any of it
  // Silt: where a body moves close over the bed, puffs of it lift, spread and thin away. Close is as close as the fish can swim: it is
  // held about a metre and a half off the bed (rig.js), so a fish kept down against it trails silt, and one swimming free does not.
  const DUST = 72, dustGeo = new THREE.IcosahedronGeometry(1, 1), dustFade = new THREE.InstancedBufferAttribute(new Float32Array(DUST), 1);
  dustGeo.setAttribute('fade', dustFade); owned.push({ dispose: () => dustGeo.dispose() });
  const silt = new THREE.Color(F.bed).lerp(new THREE.Color('#f1e8c9'), 0.5);
  const dustMat = mat(new THREE.MeshLambertMaterial({ color: silt, emissive: silt, emissiveIntensity: 0.2, transparent: true, opacity: 0.74, depthWrite: false }));
  dustMat.onBeforeCompile = (sh) => { // each puff has its own fade, and none has an outline
    sh.vertexShader = `attribute float fade;\nvarying float vFade;\n${sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vFade = fade;')}`;
    sh.fragmentShader = `varying float vFade;\n${sh.fragmentShader.replace('#include <opaque_fragment>', 'diffuseColor.a *= vFade * pow(smoothstep(0.05, 0.9, abs(dot(normalize(normal), isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(vViewPosition)))), 1.3);\n#include <opaque_fragment>')}`;
  };
  const dust = add(new THREE.InstancedMesh(dustGeo, dustMat, DUST)); dust.frustumCulled = false; dust.visible = false; // not drawn at all while there is none
  const puffs = Array.from({ length: DUST }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), age: 1, life: 1, size: 0 }));
  { const gone = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < DUST; i++) dust.setMatrixAt(i, gone); }
  let puffNext = 0, puffsLive = 0;
  const SILT = [1.35, 1.95]; // metres over the bed: all of it rises from under a body this low, none from under one this high
  // one puff of silt let go at a place, with a push: for whatever else in the band breathes (a vent, a cache thrown open)
  const puffAt = (x, y, z, vx, vy, vz, size, life) => { const pf = puffs[puffNext]; puffNext = (puffNext + 1) % DUST; pf.p.set(x, y, z); pf.v.set(vx, vy, vz); pf.age = 0; pf.life = life; pf.size = size; puffsLive = DUST; };
  const puffUp = (x, z, vx, vz, k) => { const pf = puffs[puffNext]; puffNext = (puffNext + 1) % DUST;
    pf.p.set(x + (Math.random() - 0.5) * 0.36, height(x, z) + 0.08, z + (Math.random() - 0.5) * 0.36); pf.v.set(vx * 0.2 + (Math.random() - 0.5) * 0.5, 0.28 + Math.random() * 0.4, vz * 0.2 + (Math.random() - 0.5) * 0.5);
    pf.age = 0; pf.life = 1.0 + Math.random() * 1.1; pf.size = (0.16 + Math.random() * 0.22) * (0.7 + 0.6 * k); };

  // Pilot fish: a few to a band, waiting along the way to the well. When the fish comes by they fall in beside its body and ride
  // there. They keep up with a swim but not with a sprint; left behind, they wait where they are for it to come back.
  const pilotKit = swarmKit('pilot', { glow: F.fishGlow }), pilotMat = mat(pilotKit.material), PILOTS = 5, pilotSize = new THREE.Vector3().setScalar(pilotKit.scale);
  const pilotMesh = add(new THREE.InstancedMesh(pilotKit.geometry, pilotMat, PILOTS)); pilotMesh.frustumCulled = false; pilotMesh.castShadow = true;
  const pilots = Array.from({ length: PILOTS }, (_, i) => { const [x, z] = along(9 + (i / (PILOTS - 1)) * Math.max(goalDist - 26, 12), (i % 2 ? -1 : 1) * xr(4, 8)), y = height(x, z) + xr(1.7, 2.8);
    return { hx: x, hz: z, hy: y, p: new THREE.Vector3(x, y, z), v: new THREE.Vector3(), riding: false, wait: 0, lost: 0, slot: 0.14 + 0.66 * ((i * 0.618) % 1), side: i % 2 ? 1 : -1, out: xr(0.5, 0.8), lift: xr(-0.3, 0.22), ph: xr(0, 6.28), yaw: xr(0, 6.28), pitch: 0 }; });

  // Chimes: every bar of every set is one instance, moved only while it swings.
  const chimeBars = chimeSets.flatMap((cs) => cs.bars); chimeBars.forEach((b, i) => { b.i = i; });
  const chimeTone = new THREE.Color(tint('#d9ab5a', district, 0.2)), chimeMat = mat(growing({ double: false, glow: lerp(0.25, 1.1, floor / 4) }, time));
  const chimeMesh = chimeBars.length ? add(new THREE.InstancedMesh(G.chime, chimeMat, chimeBars.length)) : null;
  if (chimeMesh) { chimeMesh.frustumCulled = false; chimeMesh.castShadow = true; }

  const stirred = { head: new THREE.Vector3(), speed: 0, was: [], acc: [], ghosts: [0, 1, 2, 3, 4].map(() => ({ p: new THREE.Vector3(), t: 9 })), ghostT: 0, ghostI: 0, rang: [], rings: 0, puffed: 0, fresh: true };
  const sv = new THREE.Vector3(), sw = new THREE.Vector3(), sq = new THREE.Quaternion(), sm = new THREE.Matrix4(), se = new THREE.Euler(0, 0, 0, 'YXZ'), sc3 = new THREE.Vector3(), down = new THREE.Vector3(0, -1, 0), sc = new THREE.Color(), still = new THREE.Quaternion();
  // body: as update() has it, or null when there is no fish to answer
  function stir(dt, focus, body) {
    const S = stirred, J = body && body.joints.length > 2 ? body.joints : null, N = J ? J.length - 1 : 0, W = wake.value, t = time.value;
    // how fast the head is going; a leap (a new dive, a fall down a rift) is not speed
    if (J) { const leap = S.fresh || J[0].distanceToSquared(S.head) > 9; if (leap) { S.was.length = 0; for (const f of pilots) if (f.riding) { f.riding = false; f.wait = 1; f.hx = f.p.x; f.hz = f.p.z; f.hy = f.p.y; } }
      const now = leap || dt <= 0 ? 0 : J[0].distanceTo(S.head) / dt; S.speed += (now - S.speed) * (dt > 0 ? 1 - Math.exp(-8 * dt) : 0); S.head.copy(J[0]); S.fresh = false; } else { S.speed = 0; S.fresh = true; }

    // ---- the wake that what grows answers: along the body, and for a moment where the tail has just been
    const BODY = WAKE - stirred.ghosts.length, LINGER = 2.5; // seconds a thing stays shut after the tail has gone by
    for (let i = 0; i < BODY; i++) { if (J) { const p = J[Math.round((i / (BODY - 1)) * N)]; W[i].set(p.x, p.y, p.z, 1); } else W[i].w = 0; }
    if (J) { S.ghostT += dt; if (S.ghostT > LINGER / S.ghosts.length) { S.ghostT = 0; const g = S.ghosts[S.ghostI]; S.ghostI = (S.ghostI + 1) % S.ghosts.length; g.p.copy(J[N]); g.t = 0; } }
    S.ghosts.forEach((g, i) => { g.t += dt; const k = J ? clamp(1 - g.t / LINGER, 0, 1) : 0; W[BODY + i].set(g.p.x, g.p.y, g.p.z, k * k * (3 - 2 * k)); });
    { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const w of W) if (w.w > 0) { x0 = Math.min(x0, w.x); x1 = Math.max(x1, w.x); z0 = Math.min(z0, w.z); z1 = Math.max(z1, w.z); }
      if (x1 >= x0) wake.bound.value.set((x0 + x1) / 2, (z0 + z1) / 2, Math.hypot(x1 - x0, z1 - z0) / 2 + 2.8); else wake.bound.value.set(0, 0, 0); } // the circle on the bed outside which nothing is near enough to answer

    // ---- silt
    if (J && dt > 0) {
      const each = Math.min(5.5, 34 / (Math.floor(N / 3) + 1)); // a long body raises no more of it than there are puffs to show
      for (let e = 0, j = 0; j <= N; e++, j += 3) {
        const p = J[j], was = S.was[e] || (S.was[e] = p.clone());
        const vx = (p.x - was.x) / dt, vz = (p.z - was.z) / dt, sp = Math.hypot(vx, (p.y - was.y) / dt, vz); was.copy(p);
        if (sp < 1.3 || sp > 40) { S.acc[e] = 0; continue; }
        const clear = p.y - height(p.x, p.z);
        if (clear > SILT[1] || clear < -0.6) continue;
        S.acc[e] = (S.acc[e] || 0) + dt * each * clamp((sp - 1) / 4, 0.25, 1.5) * clamp((SILT[1] - clear) / (SILT[1] - SILT[0]), 0, 1);
        while (S.acc[e] >= 1) { S.acc[e] -= 1; puffUp(p.x, p.z, vx, vz, clamp(sp / 6, 0, 1)); S.puffed++; puffsLive = DUST; }
      }
    }
    if (puffsLive > 0) { puffsLive = 0;
      for (let i = 0; i < DUST; i++) { const pf = puffs[i]; if (pf.age >= pf.life) continue;
        pf.age += dt; const k = pf.age / pf.life;
        if (k >= 1) { dustFade.array[i] = 0; dust.setMatrixAt(i, sm.makeScale(0, 0, 0)); continue; }
        pf.v.multiplyScalar(Math.exp(-1.7 * dt)); pf.p.addScaledVector(pf.v, dt);
        const s = pf.size * (1 + 2.5 * (1 - (1 - k) * (1 - k)));
        dustFade.array[i] = Math.min(1, k * 9) * (1 - k) * (1 - k); dust.setMatrixAt(i, sm.compose(pf.p, still, sc3.set(s, s * 0.6, s))); puffsLive++; }
      dust.instanceMatrix.needsUpdate = true; dustFade.needsUpdate = true; }
    dust.visible = puffsLive > 0;

    // ---- pilot fish
    let swum = 0;
    pilots.forEach((f, i) => {
      let tx, ty, tz, top, ahead = null;
      f.wait = Math.max(0, f.wait - dt);
      if (!f.riding && J && f.wait <= 0 && S.speed > 0.4 && f.p.distanceToSquared(J[0]) < 64) { f.riding = true; f.lost = 0; }
      if (f.riding && J) {
        const j = clamp(Math.round(f.slot * N), 1, N - 1), c = J[j];
        sv.subVectors(J[j - 1], J[j + 1]); sv.y = 0; if (sv.lengthSq() < 1e-6) sv.set(0, 0, 1); sv.normalize(); ahead = sv;
        const slow = clamp(1 - S.speed / 1.2, 0, 1), out = f.out * (1 + 0.8 * slow) + 0.1 * Math.sin(t * 1.3 + f.ph); // it gives the body more room when the body is still
        tx = c.x + sv.z * f.side * out + sv.x * 0.3 * Math.sin(t * 0.8 + f.ph); tz = c.z - sv.x * f.side * out + sv.z * 0.3 * Math.sin(t * 0.8 + f.ph); ty = c.y + f.lift + 0.12 * Math.sin(t * 1.1 + f.ph * 2); top = 5.2;
        if (f.p.distanceToSquared(c) > 144) { f.lost += dt; if (f.lost > 2.5) { f.riding = false; f.wait = 1.5; f.hx = f.p.x; f.hz = f.p.z; f.hy = f.p.y; } } else f.lost = 0;
      } else { // waiting: a slow turn about its place
        f.riding = false;
        const hx = f.hx + T * Math.round((focus.x - f.hx) / T), hz = f.hz + T * Math.round((focus.z - f.hz) / T);
        if (Math.abs(hx - f.p.x) > T / 2 || Math.abs(hz - f.p.z) > T / 2) f.p.set(hx, f.hy, hz); // the world came round: it is on the nearer copy now
        tx = hx + Math.sin(t * 0.5 + f.ph) * 1.3; tz = hz + Math.cos(t * 0.4 + f.ph * 1.3) * 1.3; ty = f.hy + Math.sin(t * 0.7 + f.ph) * 0.3; top = 1.5;
      }
      sw.set(tx - f.p.x, ty - f.p.y, tz - f.p.z); const d = sw.length(); if (d > 1e-4) sw.multiplyScalar(Math.min(top, d * 3.2) / d);
      f.v.lerp(sw, 1 - Math.exp(-5 * dt)); f.p.addScaledVector(f.v, dt); f.p.y = Math.max(f.p.y, height(f.p.x, f.p.z) + 0.35);
      const sp = f.v.length(); swum += sp;
      let yaw = f.yaw, pitch = 0;
      if (sp > 0.3) { yaw = Math.atan2(f.v.x, f.v.z); pitch = -Math.asin(clamp(f.v.y / sp, -0.6, 0.6)); } else if (ahead) yaw = Math.atan2(ahead.x, ahead.z);
      const k = dt > 0 ? 1 - Math.exp(-9 * dt) : 1; f.yaw += Math.atan2(Math.sin(yaw - f.yaw), Math.cos(yaw - f.yaw)) * k; f.pitch += (pitch - f.pitch) * k;
      pilotMesh.setMatrixAt(i, sm.compose(f.p, sq.setFromEuler(se.set(f.pitch, f.yaw, 0)), pilotSize));
    });
    pilotMesh.instanceMatrix.needsUpdate = true;
    pilotMat.userData.swim.value += dt * (pilotKit.spec.beat[0] + pilotKit.spec.beat[1] * (swum / PILOTS));

    // ---- chimes
    if (chimeMesh) {
      let moved = false;
      for (const cs of chimeSets) {
        const ox = T * Math.round((focus.x - cs.x) / T), oz = T * Math.round((focus.z - cs.z) / T), reseat = ox !== cs.wx || oz !== cs.wz;
        const near = !!J && Math.hypot(cs.x + ox - J[0].x, cs.z + oz - J[0].z) < body.total + 5;
        if (!near && !reseat && cs.awake <= 0) continue;
        cs.wx = ox; cs.wz = oz; cs.awake = Math.max(0, cs.awake - dt);
        for (const b of cs.bars) {
          const bx = b.x + ox, bz = b.z + oz, ox0 = b.ox, oz0 = b.oz;
          let touched = false;
          if (near) { // a body shoulders the bar aside; only the bar itself, not its cord
            const y0 = b.y - b.len - 0.2, y1 = b.y - b.len * 0.42 + 0.15;
            const press = (p, r) => { if (p.y < y0 || p.y > y1) return; const dx = bx + b.ox - p.x, dz = bz + b.oz - p.z, d = Math.hypot(dx, dz); if (d >= r) return; const k = (r - d) / (d || 1e-3); b.ox += (d ? dx : 1e-3) * k; b.oz += dz * k; touched = true; };
            press(body.snout, 0.4); for (let j = 0; j <= N; j++) press(J[j], 0.42);
          }
          if (touched) {
            if (b.held <= 0) { const v = clamp(0.3 + S.speed / 6.4, 0.3, 1); S.rang.push({ note: b.note, v, x: bx, y: b.y - b.len * 0.8, z: bz }); if (S.rang.length > 24) S.rang.shift(); S.rings++; b.lit = 1; }
            b.held = 0.3;
            if (dt > 0) { b.vx = clamp((b.ox - ox0) / dt, -2.2, 2.2); b.vz = clamp((b.oz - oz0) / dt, -2.2, 2.2); }
          } else { // let go, it swings back through the water: slowly, and not for long
            b.held = Math.max(0, b.held - dt);
            b.vx += (-b.ox * 5.5 - b.vx * 1.5) * dt; b.vz += (-b.oz * 5.5 - b.vz * 1.5) * dt; b.ox += b.vx * dt; b.oz += b.vz * dt;
          }
          const far = Math.hypot(b.ox, b.oz), most = b.len * 0.5; if (far > most) { b.ox *= most / far; b.oz *= most / far; }
          b.lit = Math.max(0, b.lit - dt * 1.5);
          if (far > 0.004 || Math.abs(b.vx) + Math.abs(b.vz) > 0.01 || b.lit > 0) cs.awake = 0.5;
          sv.set(b.ox, -Math.sqrt(Math.max(b.len * b.len - far * far, 0.01)), b.oz).normalize();
          chimeMesh.setMatrixAt(b.i, sm.compose(sw.set(bx, b.y, bz), sq.setFromUnitVectors(down, sv).multiply(cs.q), sc3.set(1, b.len, 1)));
          chimeMesh.setColorAt(b.i, sc.copy(chimeTone).multiplyScalar(1 + 1.6 * b.lit));
          moved = true;
        }
      }
      if (moved) { chimeMesh.instanceMatrix.needsUpdate = true; if (chimeMesh.instanceColor) chimeMesh.instanceColor.needsUpdate = true; }
    }
  }

  // ---- the body puzzles (see PUZZLE): each is watched only while the fish is near, and each shows how far along it is by what moves
  const opened = []; // caches opened since this was last read: { kind, x, y, z, food, shell }. main.js feeds the fish from them
  function unseal(p) { p.done = true; p.k = 1; p.cache.open = 1e-3; opened.push({ kind: p.kind, x: p.cache.x, y: p.cache.y + 0.5, z: p.cache.z, food: PUZZLE.food[floor], shell: !!p.cache.shell });
    for (let i = 0; i < 10; i++) { const a = i * 0.63; puffAt(p.cache.x + Math.sin(a) * 0.6, p.cache.y + 0.2, p.cache.z + Math.cos(a) * 0.6, Math.sin(a) * 1.4, 1.2 + 0.5 * Math.random(), Math.cos(a) * 1.4, 0.26, 1.5); } }
  // ---- the cleaning stations (CLEAN). What happens at one is told through `cleanNews`: { what: 'near' | 'start' | 'tick' | 'done' | 'broke', i, x, y, z, left }.
  const cleanNews = [], tq = new THREE.Quaternion(), te = new THREE.Euler(0, 0, 0, 'YXZ'), tm = new THREE.Matrix4(), tv = new THREE.Vector3(), tw = new THREE.Vector3();
  function tend(dt, focus, body) {
    const J = body ? body.joints : null, N = J ? J.length - 1 : 0, head = body ? body.snout : null, t = time.value; let swum = 0;
    stations.forEach((st, si) => {
      const cx = st.x + T * Math.round((focus.x - st.x) / T), cz = st.z + T * Math.round((focus.z - st.z) / T); st.cx = cx; st.cz = cz;
      st.rest = Math.max(0, st.rest - dt);
      const open = st.uses > 0 && st.rest <= 0, d = head ? Math.hypot(head.x - cx, head.z - cz) : 99;
      const over = open && d < CLEAN.reach && head.y > st.top - 0.3 && head.y < st.top + 4.5, still = over && stirred.speed < CLEAN.still, was = st.k;
      if (open && d < 9 && !st.near) cleanNews.push({ what: 'near', x: cx, y: st.top, z: cz });
      st.near = open && d < 12; st.on = still;
      if (still) { st.k = Math.min(1, st.k + dt / CLEAN.time); if (!st.live && st.k > 0.1) { st.live = true; cleanNews.push({ what: 'start', x: cx, y: st.top, z: cz }); } }
      else { st.k = Math.max(0, st.k - dt / (over ? 3.5 : 1.2)); if (st.live && st.k <= 0) { st.live = false; cleanNews.push({ what: 'broke', x: cx, y: st.top, z: cz }); } } // a head that stirs loses ground slowly; one that leaves, fast
      const step = (k) => Math.floor(k * 6); if (still && step(st.k) > step(was) && st.k < 1) cleanNews.push({ what: 'tick', i: step(st.k), x: cx, y: st.top, z: cz });
      if (st.k >= 1) { st.k = 0; st.live = false; st.on = false; st.uses--; st.rest = CLEAN.rest; cleanNews.push({ what: 'done', x: cx, y: st.top, z: cz, left: st.uses }); }
      if (cleanNews.length > 16) cleanNews.shift();
      // the ring over it: there while the station has something to give and the fish is about, filling as the work goes
      const show = st.near; st.ring.visible = show; st.arc.visible = show && st.k > 0.01;
      if (show) { st.ring.position.set(cx, st.top + 0.5, cz); st.ring.scale.setScalar(CLEAN.reach); st.arc.position.set(cx, st.top + 0.51, cz); st.arc.scale.setScalar(CLEAN.reach); st.arc.geometry.setDrawRange(0, Math.max(2, Math.round(st.k * 48) + 1)); }
      // its cleaners: turning over the coral head; along the body while they work; gone into the coral while the station rests or is spent
      st.away += ((open ? 0 : 1) - st.away) * (1 - Math.exp(-2.5 * dt));
      st.fish.forEach((f, i) => {
        let tx, ty, tz, top;
        if (st.k > 0.03 && J && open) { const along = (f.slot + 0.22 * Math.sin(t * 0.7 + f.ph)) * N, j = clamp(Math.round(along), 1, N - 1), c = J[j];
          tv.subVectors(J[j - 1], J[j + 1]); tv.y = 0; if (tv.lengthSq() < 1e-6) tv.set(0, 0, 1); tv.normalize();
          const out = 0.2 + 0.06 * Math.sin(t * 3.1 + f.ph); tx = c.x + tv.z * f.side * out; tz = c.z - tv.x * f.side * out; ty = c.y + 0.1 * Math.sin(t * 2.3 + f.ph * 2); top = 3.6; }
        else { const r = 0.55 + 0.45 * Math.sin(t * 0.37 + f.ph * 3) ** 2, a = t * 0.9 * f.side + f.ph; tx = cx + Math.sin(a) * r; tz = cz + Math.cos(a) * r; ty = st.top + 0.45 + 0.3 * Math.sin(t * 1.3 + f.ph) - 0.9 * st.away; top = 1.6; }
        if (f.p.distanceToSquared(tv.set(tx, ty, tz)) > 900) f.p.set(tx, ty, tz); // the world came round
        tw.set(tx - f.p.x, ty - f.p.y, tz - f.p.z); const dd = tw.length(); if (dd > 1e-4) tw.multiplyScalar(Math.min(top, dd * 4) / dd);
        f.v.lerp(tw, 1 - Math.exp(-6 * dt)); f.p.addScaledVector(f.v, dt);
        const sp = f.v.length(); swum += sp; let yaw = f.yaw, pitch = 0;
        if (sp > 0.15) { yaw = Math.atan2(f.v.x, f.v.z); pitch = -Math.asin(clamp(f.v.y / sp, -0.6, 0.6)); }
        const k = dt > 0 ? 1 - Math.exp(-9 * dt) : 1; f.yaw += Math.atan2(Math.sin(yaw - f.yaw), Math.cos(yaw - f.yaw)) * k; f.pitch += (pitch - f.pitch) * k;
        cleanMesh.setMatrixAt(si * CLEAN.fish + i, tm.compose(f.p, tq.setFromEuler(te.set(f.pitch, f.yaw, 0)), cleanSize.setScalar(cleanKit.scale * (1 - st.away))));
      });
    });
    if (cleanMesh) { cleanMesh.instanceMatrix.needsUpdate = true; cleanMat.userData.swim.value += dt * (cleanKit.spec.beat[0] + cleanKit.spec.beat[1] * (swum / (stations.length * CLEAN.fish))); }
  }
  function solve(dt, focus, body) {
    const J = body && body.joints.length > 2 ? body.joints : null, t = time.value, turnA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    for (const p of puzzles) {
      const ox = T * Math.round((focus.x - p.x) / T), oz = T * Math.round((focus.z - p.z) / T), c = p.cache, lid = c.lid;
      const near = !!J && Math.hypot(p.x + ox - J[0].x, p.z + oz - J[0].z) < 45;
      if (!near && !(c.open > 0 && c.open < 1)) continue;
      const head = J ? J[0] : null;
      if (!p.done && head) {
        if (p.kind === 'capstan') { // swim round it: the head of the capstan turns with the fish and the line draws the lid off
          const hx = head.x - (p.x + ox), hz = head.z - (p.z + oz), d = Math.hypot(hx, hz), a = Math.atan2(hx, hz);
          if (d < PUZZLE.reach && d > 0.45 && Math.abs(head.y - p.y) < 3.2) { if (p.was !== null) p.turn += turnA(a - p.was); p.was = a; }
          else { p.was = null; p.turn -= Math.sign(p.turn) * Math.min(Math.abs(p.turn), 0.8 * dt); } // left alone, it unwinds
          p.k = Math.min(1, Math.abs(p.turn) / (PUZZLE.turns * Math.PI * 2));
          if (p.k >= 1) unseal(p);
        } else if (p.kind === 'windows') { // through all four in one pass, from either end
          p.timer = Math.max(0, p.timer - dt);
          if (p.got > 0 && p.timer <= 0) { p.got = 0; p.next = null; for (const h of p.hoops) h.lit = 0; } // too long between two of them: they go dark
          p.hoops.forEach((h, k) => {
            const dx = head.x - (h.x + ox), dz = head.z - (h.z + oz), along = dx * p.ux + dz * p.uz, off = Math.hypot(dx - along * p.ux, head.y - h.y, dz - along * p.uz), side = Math.sign(along);
            const through = h.side !== 0 && side !== 0 && side !== h.side && Math.abs(along) < 2.5 && off < h.r * 1.2; if (side) h.side = side;
            if (!through) return;
            if (!p.got && (k === 0 || k === p.hoops.length - 1)) { p.next = k; p.step = k === 0 ? 1 : -1; }
            if (k !== p.next) return;
            h.lit = 1; p.got = (p.got || 0) + 1; p.next += p.step; p.timer = PUZZLE.between; stirred.rang.push({ note: p.got, v: 0.9, x: h.x + ox, y: h.y, z: h.z + oz });
            if (p.got >= p.hoops.length) unseal(p);
          });
          p.k = (p.got || 0) / p.hoops.length;
        } else { // lie over the open chimney: its breath stops and the pressure goes to the cap of the other
          const ax = p.x + ox, az = p.z + oz; let over = false;
          for (let j = 0; j < J.length && !over; j++) { const q = J[j]; over = q.y - p.y < 1.25 && q.y > p.y - 0.5 && Math.hypot(q.x - ax, q.z - az) < 0.95; }
          p.press = clamp(p.press + (over ? dt / PUZZLE.plug : -dt / 2.5), 0, 1); p.k = p.press; p.over = over;
          if (p.press >= 1) unseal(p);
        }
      }
      // ---- what shows
      if (p.kind === 'capstan') { p.head.mesh.rotation.y = p.turn; p.head.mat.emissiveIntensity = 0.12 + 0.6 * p.k; Object.assign(p.ring, { x: p.x + ox, z: p.z + oz, left: p.done ? 0 : 1 }); }
      if (p.kind === 'windows') for (const h of p.hoops) h.mesh.material.emissiveIntensity += ((h.lit ? 1 : 0.22 + 0.14 * Math.sin(t * 2.6 + h.x)) - h.mesh.material.emissiveIntensity) * (1 - Math.exp(-8 * dt));
      if (p.kind === 'vent') { p.puff -= dt;
        if (p.puff <= 0) { p.puff = 0.14; const calm = p.done ? 0.5 : 1;
          if (!p.over || p.done) puffAt(p.x + ox + (Math.random() - 0.5) * 0.3, p.y + 0.05, p.z + oz + (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, 1.5 * calm + Math.random() * 0.5, (Math.random() - 0.5) * 0.3, 0.2, 1.7);
          if (!p.done && Math.random() < 0.15 + 0.85 * p.press) { const a = Math.random() * 6.28; puffAt(c.x + ox + Math.sin(a) * 0.8, c.y, c.z + oz + Math.cos(a) * 0.8, Math.sin(a) * (0.5 + 1.2 * p.press), 0.3, Math.cos(a) * (0.5 + 1.2 * p.press), 0.11, 0.9); } } }
      // the lid: drawn off by the capstan's line as it turns, rattling on a chimney under pressure, and thrown off when the cache opens
      if (c.open > 0 && c.open < 1) c.open = Math.min(1, c.open + dt / 0.9);
      const o = c.open, e = o * o * (3 - 2 * o), sx = p.kind === 'capstan' ? -p.ax : 0.8, sz = p.kind === 'capstan' ? -p.az : 0.6, slide = (p.kind === 'capstan' ? 1.5 * p.k : 0) + (p.kind === 'capstan' ? 0.5 : 1.9) * e;
      const shake = p.kind === 'vent' && !p.done ? p.press : 0, hop = (p.kind === 'vent' ? 2.4 : 0.25) * Math.sin(Math.PI * o) - (p.kind === 'vent' ? 1.0 : 0.25) * e;
      lid.x = c.x + sx * slide; lid.z = c.z + sz * slide; lid.y = c.y + hop + 0.1 * shake * (0.5 + 0.5 * Math.sin(t * 43));
      lid.mesh.position.set(lid.x + ox, lid.y, lid.z + oz); lid.mesh.rotation.set(0.05 * shake * Math.sin(t * 37), 0, 0.5 * e + 0.05 * shake * Math.sin(t * 29));
      lid.mesh.material.emissiveIntensity = p.done ? 0.1 : 0.1 + 0.5 * p.k;
    }
  }

  // ------------------------------------------------------------ per-frame
  const m4 = new THREE.Matrix4(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), q1 = new THREE.Quaternion(), fwd = new THREE.Vector3(0, 0, 1), one = new THREE.Vector3(1, 1, 1), none = new THREE.Vector3(0, 0, 0);
  let wrapTimer = 0;
  // ---- the tempers of swarms (TEMPER). What each does is told to whoever is listening through `swarmNews`: { what: 'bolt' | 'part' | 'shy' | 'lit', x, y, z }.
  const swarmNews = [], tell = (what, sc) => { swarmNews.push({ what, x: sc.x, y: sc.y, z: sc.z }); if (swarmNews.length > 12) swarmNews.shift(); };
  // One that bolts: its height is its own. Cornered by a head that is not over it, it climbs; with the head over it, it stays, and goes down with the head
  // but never up to it. Left alone it sinks back to where it hangs.
  function bolting(sc, cx, cz, rest, dt, head) {
    const W = TEMPER.bolt, top = Math.min(rest + W.top, 15.5 - 3.6), hot = sc.threat > 0.3 && sc.left > 0;
    if (!sc.by) sc.by = rest;
    if (!hot) { sc.capped = false; sc.rising = false; sc.by += clamp(rest - sc.by, -W.sink * dt, W.sink * dt); }
    else if (sc.capped || head.y > sc.by + W.over) { sc.capped = true; sc.by = Math.max(height(cx, cz) + 1.6, Math.min(sc.by, Math.max(head.y, sc.by - 4 * dt))); }
    else if (sc.by < top) { sc.by = Math.min(top, sc.by + W.rise * dt); if (!sc.rising) { sc.rising = true; sc.bolted++; tell('bolt', sc); } }
    return sc.by;
  }
  // One that parts in two. Whole, its fish keep to two lobes `gap` either side of the middle along its own line; parted, the two halves' middles are
  // `mid` either side instead, so nothing jumps on the frame it happens. `swell` eases the fish from the size of the old ball to the new.
  function twinning(sc, dt) {
    const W = TEMPER.twin, tw = sc.twin;
    if (!sc.split) {
      if (sc.left > 0 && sc.threat > W.at) {
        const low = SWARMS[LOWER[sc.whole.tier]], was = sc.ball * lerp(2.6 * sc.slack, sc.pack, sc.threat);
        let a = 0, b = 0; for (const f of minnows) if (f.sc === sc && f.alive) { if (f.half) { f.sc = tw; b++; } else a++; }
        Object.assign(sc, { tier: LOWER[sc.whole.tier], n: a, left: a, ball: low.r, slack: 1, split: true, calm: 0, mid: sc.gap, gap: 0, progress: 0 });
        Object.assign(tw, { n: b, left: b, threat: sc.threat, pack: sc.pack, px: sc.px, pz: sc.pz, y: sc.y, burst: 0, progress: 0 });
        sc.swell = tw.swell = was / (low.r * lerp(2.6, sc.pack, sc.threat));
        tell('part', sc);
      }
    } else {
      const both = sc.left > 0 && tw.left > 0, mending = both && sc.calm > W.mend, to = mending ? sc.whole.ball * W.lobes : (W.part + sc.ball * 3) / 2;
      sc.calm = both && sc.threat < 0.1 && tw.threat < 0.1 ? sc.calm + dt : 0;
      sc.mid += (to - sc.mid) * (1 - Math.exp(-(mending ? 1.2 : 3.5) * dt));
      sc.swell = tw.swell = 1 + (sc.swell - 1) * Math.exp(-3 * dt);
      if (mending && Math.abs(sc.mid - to) < 0.05) { // the halves have come together again: one swarm, as it was
        for (const f of minnows) if (f.sc === tw && f.alive) f.sc = sc;
        Object.assign(sc, { ...sc.whole, left: sc.whole.n, slack: W.slack, split: false, gap: sc.mid, mid: 0, swell: 1 });
        Object.assign(tw, { n: 0, left: 0, threat: 0 }); tw.ring.visible = tw.arc.visible = false;
      }
    }
    const m = sc.mid || 0; sc.sx = -sc.ax * m; sc.sz = -sc.az * m; tw.sx = sc.ax * m; tw.sz = sc.az * m;
    sc.least = sc.split ? sc.ball : SWARMS[LOWER[sc.whole.tier]].r; // the smallest ball it can be taken as
  }
  // One that seeks the light: is it in the light of a lantern flower? In the dark it does not bunch, and with the head near it runs: away, and toward the
  // nearest lantern if there is one in reach. Returns whether it is lit, which is whether it can be cornered.
  let lightX = 0, lightZ = 0;
  const lightFrom = (x, z) => { let bd = 1e9; for (const L of lanterns) { const dx = wrapD(L.x - x), dz = wrapD(L.z - z), q = dx * dx + dz * dz; if (q < bd) { bd = q; lightX = dx; lightZ = dz; } } return Math.sqrt(bd); };
  function seeking(sc, cx, cz, d, dt, head) {
    const W = TEMPER.glow, ld = lightFrom(cx, cz), lit = ld < (sc.lit ? W.hold : W.pool), ease = 1 - Math.exp(-3 * dt);
    if (lit && !sc.lit && sc.left > 0 && d < 24) tell('lit', sc);
    sc.lit = lit; sc.slack += ((lit ? 1 : W.slack) - sc.slack) * ease; sc.tall += ((lit ? 0 : W.flat) - sc.tall) * ease;
    sc.fleeing = !lit && sc.left > 0 && d < W.fear;
    if (sc.fleeing) {
      let ax = (cx - head.x) / (d || 1), az = (cz - head.z) / (d || 1);
      if (ld < W.seek) { ax += (lightX / ld) * W.pull; az += (lightZ / ld) * W.pull; }
      const m = Math.hypot(ax, az) || 1;
      if (Math.hypot(sc.px, sc.pz) < W.far) { sc.px += (ax / m) * W.run * dt; sc.pz += (az / m) * W.run * dt; }
      sc.fled += dt; if (!sc.shied) { sc.shied = true; tell('shy', sc); }
    } else if (d > W.fear + 6) sc.shied = false;
    return lit;
  }

  // body: { joints, snout, total (metres, nose to tail), assist (0..1) }
  function update(dt, focus, fishHead, camera, body = null) {
    if (!calm) time.value += dt;
    rebuildTerrain(focus.x, focus.z);
    wrapTimer -= dt;
    if (wrapTimer <= 0) { wrapTimer = 0.3; for (const s of scatters) s.wrap(focus.x, focus.z); for (const o of single) o.mesh.position.set(o.x + T * Math.round((focus.x - o.x) / T), o.y, o.z + T * Math.round((focus.z - o.z) / T)); }
    const t = time.value;

    // each swarm drifts on its own clock, balls up when the oarfish comes near, and gives way to its body
    const rule = wrapRule(body ? body.assist : 0);
    for (const sc of schools) {
      if (sc.kind === 'twin') twinning(sc, dt); // before it is placed, so that the frame it parts on has both halves where their fish already are
      if (sc.of) sc.clock = sc.of.clock; else sc.clock += dt * (1 - 0.9 * sc.threat);
      let cx = sc.hx + Math.sin(sc.clock * 0.11 + sc.ph) * sc.r + sc.px + (sc.sx || 0), cz = sc.hz + Math.cos(sc.clock * 0.083 + sc.ph * 1.7) * sc.r + sc.pz + (sc.sz || 0);
      cx += T * Math.round((focus.x - cx) / T); cz += T * Math.round((focus.z - cz) / T);
      const d = Math.hypot(cx - fishHead.x, cz - fishHead.z), rest = Math.max(sc.hy, height(cx, cz) + 1.6);
      let cornered = d < 6 + sc.ball * 3 && sc.left > 0;
      if (sc.kind === 'glow') cornered = seeking(sc, cx, cz, d, dt, fishHead) && cornered;
      sc.threat += ((cornered ? 1 : 0) - sc.threat) * (1 - Math.exp(-2.2 * dt));
      if (sc.kind === 'bolt') sc.y = bolting(sc, cx, cz, rest, dt, fishHead);
      else sc.y = lerp(rest, fishHead.y, sc.threat); // a cornered swarm does not flee up or down
      sc.burst = Math.max(0, sc.burst - dt * 0.9);
      sc.fit = sc.ball * rule.squeeze;
      // the ball slides away from the body, so an arc drawn round it gathers it in, and packs tighter when pressed
      let nearest = 99;
      if (body && sc.threat > 0.2 && sc.left > 0) {
        const lim = sc.fit + 0.02, k = (2 + 6 * body.assist) * dt; // only a body cutting into the ball moves it
        const shove = (p) => {
          if (Math.abs(p.y - sc.y) > 1.8) return;
          const dx = cx - p.x, dz = cz - p.z, dd = Math.hypot(dx, dz) || 1e-3;
          if (dd < nearest) nearest = dd;
          if (dd < lim) { const m = ((lim - dd) / dd) * k; sc.px += dx * m; sc.pz += dz * m; cx += dx * m; cz += dz * m; }
        };
        shove(body.snout);
        for (const p of body.joints) shove(p);
      } else { const fade = Math.exp(-(sc.kind === 'glow' ? (sc.fleeing ? 0 : TEMPER.glow.home) : 0.4) * dt); sc.px *= fade; sc.pz *= fade; } // one that has run to a light is in no hurry home
      sc.pack += (clamp((nearest - 0.14) / sc.ball, rule.squeeze, 1) - sc.pack) * (1 - Math.exp(-6 * dt));
      sc.x = cx; sc.z = cz;
      const total = body ? body.total : 0;
      sc.can = canWrap(total, sc.ball);
      sc.orbit = clamp((0.9 * total) / rule.sweep, sc.fit + 0.1, sc.ball * 0.95 + 0.3); // the ring an assisted swim follows
      const showing = sc.left > 0 && sc.threat > 0.3;
      sc.ring.visible = showing; sc.arc.visible = showing && sc.progress > 0.02;
      if (showing) {
        const R = sc.ball * sc.pack + 0.26;
        sc.ring.position.set(cx, sc.y, cz); sc.ring.scale.setScalar(R); sc.ring.material = sc.can ? ringYes : ringNo;
        sc.arc.position.set(cx, sc.y + 0.01, cz); sc.arc.scale.set(R * sc.arcSign, R, R); sc.arc.rotation.y = sc.arcStart;
        sc.arc.material = sc.can ? arcYes : arcNo;
        sc.arc.geometry.setDrawRange(0, Math.max(2, Math.round(sc.progress * 48 * (wrapRule(body ? body.assist : 0).sweep / (Math.PI * 2))) + 1));
      }
    }
    minnows.forEach((f, i) => {
      if (!f.alive) return;
      const sc = f.sc;
      fishKit.place(v1, f, sc, t);
      v1.y = Math.max(v1.y, height(v1.x, v1.z) + 0.4);
      if (f.first || f.p.distanceToSquared(v1) > 400) { f.p.copy(v1); f.first = false; }
      v2.subVectors(v1, f.p);
      if (v2.lengthSq() > 1e-8) q1.setFromUnitVectors(fwd, v2.normalize());
      f.p.copy(v1);
      fishMesh.setMatrixAt(i, m4.compose(v1, q1, fishSize));
    });
    fishMesh.instanceMatrix.needsUpdate = true;
    minnowMat.userData.swim.value = t * fishKit.beat;

    for (let i = 0; i < SPECKS; i++) {
      for (let a = 0; a < 3; a++) {
        const size = a === 0 ? BOX.x : a === 1 ? BOX.y : BOX.z, c = a === 0 ? focus.x : a === 1 ? focus.y + 2 : focus.z;
        let p = spBase[i * 3 + a] * size + (a === 1 ? t * 0.05 : a === 0 ? t * 0.12 : 0);
        p = c + ((((p - c) % size) + size * 1.5) % size) - size / 2;
        sp[i * 3 + a] = p;
      }
    }
    spGeo.attributes.position.needsUpdate = true;

    for (const m of rays) {
      const u = m.userData;
      const x = u.x + Math.sin(t * 0.05 + u.ph) * 6, z = u.z;
      m.position.set(focus.x + ((((x - focus.x) % 70) + 105) % 70) - 35, focus.y + 12, focus.z + ((((z - focus.z) % 70) + 105) % 70) - 35);
      m.rotation.set(0, Math.atan2(camera.position.x - m.position.x, camera.position.z - m.position.z), 0.22);
    }
    // the goal sits on the nearest copy of the world; its beam turns to face the camera
    const ox = T * Math.round((focus.x - goal.x) / T), oz = T * Math.round((focus.z - goal.z) / T);
    clouds.forEach((c, i) => { const slide = c.flock ? Math.sin(t * 0.07 + i * 2.1) * 0.7 : 0; c.mesh.position.set(ox + rift.tx * slide, c.flock ? Math.sin(t * 0.3 + i * 1.9) * 0.22 : 0, oz + rift.tz * slide); }); // the bank is never quite still
    if (lamps.house) { // the light under the cloud: about three seconds from dark to dark, never quite out
      const swell = 0.5 - 0.5 * Math.cos(t * 1.9), glow = 0.3 + 0.7 * swell * Math.sqrt(swell);
      lamps.house.position.set(rift.x + ox, 0, rift.z + oz);
      lamps.loom.rotation.y = Math.atan2(camera.position.x - lamps.house.position.x, camera.position.z - lamps.house.position.z);
      for (const l of lamps) l.mesh.material.opacity = l.peak * glow;
      beaconMat.opacity = 0.34 * (0.6 + 0.6 * glow);
    }
    for (const b of beacons) {
      b.position.x = goal.x + ox; b.position.z = goal.z + oz;
      b.rotation.y = Math.atan2(camera.position.x - b.position.x, camera.position.z - b.position.z);
    }
    if (portal.mesh) { portal.mesh.position.x = goal.x + ox; portal.mesh.position.z = goal.z + oz; portal.mesh.material.opacity = (0.7 + 0.2 * Math.sin(t * 1.6)) * portal.level; beaconMat.opacity = 0.5 * portal.level; }
    solve(dt, focus, body);
    tend(dt, focus, body);
    stir(dt, focus, body);
    for (const f of fragments) { // a loose one glows a little, slowly; one given to the rift goes down into the cloud; one being carried is placed by whoever carries it
      const ox = T * Math.round((focus.x - f.x) / T), oz = T * Math.round((focus.z - f.z) / T);
      f.slab.material.emissiveIntensity = f.held ? 0.26 : 0.14 + 0.12 * Math.sin(t * 2.1 + f.x);
      if (f.held) f.mesh.rotation.x += (0.3 - f.mesh.rotation.x) * Math.min(1, dt * 4);
      if (f.gone) { if (f.sink < 6) { f.sink += dt; f.y -= dt * (1.2 + 1.5 * f.sink); f.mesh.rotation.x += dt * 0.9; f.mesh.position.set(f.x + ox, f.y, f.z + oz); if (f.sink >= 6) f.mesh.visible = false; } continue; }
      Object.assign(f.ring, { x: f.x + ox, z: f.z + oz, left: f.held ? 0 : 1 });
    }
  }
  // a fragment let go where it is: it comes to rest on the bed
  function settle(f) { f.held = false; f.y = height(f.x, f.z) + LIE; f.mesh.rotation.set(f.tilt, f.yaw, 0, 'YXZ'); f.mesh.position.y = f.y; }

  // Where a foot comes down (legs.js): on the bed, or on top of whatever low stone is there. A foot that would land inside something too
  // tall to step up onto is put down beside it. p is changed: its height always, its place only in that last case.
  function footing(p, step = 1.25) {
    let base = height(p.x, p.z), y = base;
    for (const c of colliders) {
      if (c.off) continue;
      const dx = wrapD(p.x - c.x), dz = wrapD(p.z - c.z), d2 = dx * dx + dz * dz;
      if (d2 >= c.r * c.r) continue;
      const ball = c.top === undefined, h = ball ? Math.sqrt(c.r * c.r - d2) : 0, top = ball ? c.y + h : c.top;
      if (top <= base || (ball && c.y - h > base + 2)) continue; // sunk in the bed, or overhead like a lintel
      if (top - base <= step) { y = Math.max(y, top); continue; }
      const d = Math.sqrt(d2) || 1e-4, k = (c.r + 0.12 - d) / d;
      p.x += dx * k; p.z += dz * k; base = y = height(p.x, p.z);
    }
    p.y = y; return p;
  }
  // Keeps a walker's body out of what is too tall for it to climb over. p is moved sideways only.
  function steer(p, radius, step = 1.25) {
    for (const c of colliders) {
      if (c.off) continue;
      const dx = wrapD(p.x - c.x), dz = wrapD(p.z - c.z), R = c.r + radius, d2 = dx * dx + dz * dz;
      if (d2 >= R * R) continue;
      const base = height(c.x, c.z);
      if (c.top !== undefined ? c.top - base <= step : c.y + c.r - base <= step || c.y - c.r > base + 2) continue;
      const d = Math.sqrt(d2) || 1e-4, k = (R - d) / d;
      p.x += dx * k; p.z += dz * k;
    }
    return p;
  }
  function pushOut(p, radius) {
    for (const c of colliders) {
      const dx = wrapD(p.x - c.x), dz = wrapD(p.z - c.z);
      if (c.off) continue; // a jar that has been broken
      if (c.top !== undefined) {
        const R = c.r + radius;
        if (p.y > c.top + radius || dx * dx + dz * dz >= R * R) continue;
        if (p.y > c.top - 0.25) { p.y = c.top + radius; continue; }
        const d = Math.hypot(dx, dz) || 1e-4;
        p.x += (dx / d) * (R - d); p.z += (dz / d) * (R - d);
      } else {
        const dy = p.y - c.y, R = c.r + radius, d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= R * R) continue;
        const d = Math.sqrt(d2) || 1e-4, k = (R - d) / d;
        p.x += dx * k; p.y += dy * k; p.z += dz * k;
      }
    }
  }

  // the whole swarm is taken at once; returns where its fish were
  function take(sc) {
    const at = [];
    minnows.forEach((f, i) => {
      if (f.sc !== sc || !f.alive) return;
      f.alive = false;
      at.push(f.p.clone());
      fishMesh.setMatrixAt(i, m4.compose(none, q1, none));
    });
    sc.left = 0; sc.progress = 0; sc.ring.visible = false; sc.arc.visible = false;
    fishMesh.instanceMatrix.needsUpdate = true;
    return at;
  }
  // Cloud in the rift: a bank of soft round puffs packed between the walls just under the ledges, lit like the stone, with a
  // pale floor under them so that no bed shows through the gaps. The fish drops into it and is gone (main.js closes the
  // water in round it, in the cloud's colour). The puffs are in three flocks that rise, fall and slide a little apart.
  const clouds = [], lamps = [], murk = rift ? new THREE.Color('#eef7f3').lerp(new THREE.Color(FLOORS[floor + 1].water), 0.2) : null; // the cloud's colour, from inside it
  if (rift) {
    const pale = new THREE.Color('#f3faf6').lerp(new THREE.Color(F.water), 0.08), shade = pale.clone().lerp(new THREE.Color(FLOORS[floor + 1].water), 0.42);
    const back = (t) => 0.5 - Math.sin(Math.asin(1 - 2 * clamp(t, 0, 1)) / 3); // smooth(), the other way round: how far in the wall is at a given depth
    const room = (u, depth) => riftW(u) - rift.ledge - (rift.wall - rift.ledge) * back((depth - rift.step) / (rift.deep - rift.step)); // half the width between the walls, that far below the shelf
    const P = (u, a, y) => { const c = a + riftMid(u); return [rift.x + rift.tx * u + rift.nx * c, y, rift.z + rift.tz * u + rift.nz * c]; };
    // a puff: a ball of eighty faces pushed out of true and squashed, and shaded as the round thing it nearly is, so that it has no flat faces to catch the light
    const puff = (salt) => {
      const g = new THREE.IcosahedronGeometry(1, 1), pos = g.attributes.position, nor = g.attributes.normal, moved = new Map(), v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        const key = `${pos.getX(i).toFixed(2)},${pos.getY(i).toFixed(2)},${pos.getZ(i).toFixed(2)}`;
        if (!moved.has(key)) { const h = (n) => hash2(moved.size * 7 + n, salt * 13 + n) - 0.5; moved.set(key, [1 + h(1) * 0.4, 1 + h(2) * 0.4, 1 + h(3) * 0.4]); }
        const k = moved.get(key); pos.setXYZ(i, pos.getX(i) * k[0], pos.getY(i) * k[1] * 0.62, pos.getZ(i) * k[2]);
        v.set(pos.getX(i), pos.getY(i) / 0.38, pos.getZ(i)).normalize(); nor.setXYZ(i, v.x, v.y, v.z);
      }
      owned.push({ dispose: () => g.dispose() }); return g;
    };
    // three layers, each in three flocks, from the bottom up: big puffs that close the gaps, smaller ones over them that make the bank's
    // top, and a few wide thin ones at the height of the ledges, lying out over them, that are hardly there at all
    const LAYERS = [[130, 2.0, 3.2, 2.2, 3.9, 0.5, 1, 0.85], [230, 0.55, 1.5, 1.3, 2.8, 0.5, 1, 0.6], [70, -0.5, 0.4, 2.4, 3.8, 2.2, 0.55, 0.26]]; // how many; how far under the ledges, from and to; how big, from and to; how far past the walls; how flat; how solid
    const layers = [];
    for (const [n, top, low, small, big, past, flat] of LAYERS) {
      const flocks = [[], [], []]; layers.push(flocks);
      for (let i = 0, made = 0; i < n * 3 && made < n; i++) {
        const u = dr(-rift.half, rift.half), down = rift.step + dr(top, low), half = room(u, down) + past;
        if (half < 0.9) continue;
        const r = dr(small, big) * clamp(half / 3, 0.55, 1), [x, y, z] = P(u, dr(-half, half) * 0.96, rift.y - down);
        flocks[made % 3].push({ x, y, z, q: qY(drand() * 6.28, dr(-0.25, 0.25), dr(-0.25, 0.25)), s: S(r * dr(0.85, 1.25), r * dr(0.8, 1.1) * flat, r * dr(0.85, 1.25)), tone: pale.clone().lerp(shade, clamp((down - rift.step - top) / 3 + dr(-0.12, 0.16), 0, 1)) });
        made++;
      }
    }
    // Soft: each puff is part seen through, and thins to nothing round its rim, so that no puff has an outline and the bank has no hard top.
    // Nothing is sorted, so the layers are drawn from the lowest up and each flock from the bottom up, which is right from anywhere above it.
    const rim = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', 'diffuseColor.a *= pow(smoothstep(0.1, 0.95, abs(dot(normalize(normal), isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(vViewPosition)))), 1.4);\n#include <opaque_fragment>'); };
    const m4 = new THREE.Matrix4();
    layers.forEach((flocks, layer) => {
      const lit = mat(new THREE.MeshLambertMaterial({ color: '#d9e1de', emissive: pale, emissiveIntensity: lerp(0.3, 0.58, floor / 3), transparent: true, opacity: LAYERS[layer][7], depthWrite: false })); // lit like the stone, but less than it, and holding light of its own, so that a puff is not a pillow with a bright top and dark sides
      lit.onBeforeCompile = rim;
      flocks.forEach((list, k) => {
        list.sort((a, b) => a.y - b.y);
        const mesh = add(new THREE.InstancedMesh(puff(layer * 3 + k + 1), lit, list.length));
        list.forEach((c, i) => { mesh.setMatrixAt(i, m4.compose(new THREE.Vector3(c.x, c.y, c.z), c.q, c.s)); mesh.setColorAt(i, c.tone); });
        mesh.frustumCulled = false; mesh.receiveShadow = true; mesh.renderOrder = layer - 5;
        clouds.push({ mesh, flock: true });
      });
    });
    { // the floor of the bank
      const m = mesher(), down = rift.step + 3.3, y = rift.y - down;
      for (let u = -rift.half; u < rift.half; u += 2) {
        const s0 = room(u, down) + 0.9, s1 = room(u + 2, down) + 0.9;
        if (s0 < 0.3 && s1 < 0.3) continue;
        m.quad(P(u, -Math.max(s0, 0.05), y), P(u, Math.max(s0, 0.05), y), P(u + 2, Math.max(s1, 0.05), y), P(u + 2, -Math.max(s1, 0.05), y), '#ffffff');
      }
      const geo = m.geometry(), mesh = add(new THREE.Mesh(geo, mat(new THREE.MeshBasicMaterial({ color: shade.clone().lerp(pale, 0.35), side: THREE.DoubleSide }))));
      mesh.frustumCulled = false; owned.push({ dispose: () => geo.dispose() });
      clouds.push({ mesh, flock: false });
    }
    // A light under the cloud, swelling and sinking like a lighthouse's, to say where the way on is: a pool of it between the two layers of
    // puffs, all along the rift and strongest at its middle, so that the bank glows from inside; some of it on the top of the bank; a heart
    // at the middle; and its loom, standing up out of the rift, which is what is seen from across the shelf. The beam keeps time with it.
    // Gold, because everything else down here is the colour of water. Added to a pale cloud any light just turns it white, so the pool is
    // laid over the cloud like paint, and only the heart and the loom are added light.
    const unit = new THREE.PlaneGeometry(1, 1), lie = new THREE.Group(), side = Math.sign(-rift.tz * rift.nx + rift.tx * rift.nz) || 1;
    owned.push({ dispose: () => unit.dispose() });
    lamps.house = add(new THREE.Group()); lie.rotation.y = Math.atan2(-rift.tz, rift.tx); lamps.house.add(lie); // `lie` has the rift running along its x
    const lamp = (parent, wide, tall, y, peak, order, color, added) => {
      const m = new THREE.Mesh(unit, mat(new THREE.MeshBasicMaterial({ map: added ? G.glow : G.pool, color, transparent: true, opacity: 0, blending: added ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false, fog: false, side: THREE.DoubleSide })));
      m.scale.set(wide, tall, 1); m.position.y = y; m.renderOrder = order; m.frustumCulled = false; parent.add(m); lamps.push({ mesh: m, peak }); return m;
    };
    const flat = (u, ...a) => { const m = lamp(lie, ...a); m.rotation.x = -Math.PI / 2; m.position.x = u; m.position.z = side * riftMid(u); };
    for (const [u, k] of [[-28, 0.4], [-14, 0.7], [0, 1], [14, 0.7], [28, 0.4]]) {
      flat(u, 30, 24, rift.y - rift.step - 1.75, 0.95 * k, -4.5, '#ffb85c', false); // between the layers: the upper puffs lie dark across it
      flat(u, 28, 22, rift.y - rift.step - 0.3, 0.42 * k, -3.5, '#ffc477', false); // on the top of the bank, under the wisps
    }
    flat(0, 15, 12, rift.y - rift.step - 0.25, 0.4, -3.4, '#ffd9a0', true);
    lamps.loom = lamp(lamps.house, 26, 14, rift.y + 2.4, 0.42, -2, '#ffb45a', true);
  }
  // light across the mouth of the rift, for whoever keeps it (guards.js): bars from wall to wall, and a line along each wall
  function riftVeil() {
    const m = mesher(), y = rift.y - rift.step + 0.35, slot = (u) => riftW(u) - rift.ledge - 0.3;
    const P = (u, a) => { const k = a + riftMid(u); return [rift.x + rift.tx * u + rift.nx * k, y, rift.z + rift.tz * u + rift.nz * k]; };
    for (let u = -rift.half; u < rift.half; u += 2.2) {
      const s0 = slot(u), s1 = slot(u + 0.13), s2 = slot(u + 2.2);
      if (s0 < 0.5 || s2 < 0.5) continue;
      m.quad(P(u, -s0), P(u, s0), P(u + 0.13, s1), P(u + 0.13, -s1), '#ffffff');
      for (const sg of [-1, 1]) m.quad(P(u, sg * s0), P(u, sg * (s0 - 0.11)), P(u + 2.2, sg * (s2 - 0.11)), P(u + 2.2, sg * s2), '#ffffff');
    }
    return m.geometry();
  }
  // has the fish gone down the rift, or through the palace gate?
  function atGoal(p) {
    const dx = wrapD(p.x - goal.x), dz = wrapD(p.z - goal.z), d = Math.hypot(dx, dz);
    return last ? d < 3 && Math.abs(p.y - goal.y) < 4.5 : riftIn(p.x, p.z) > rift.ledge + 2 && p.y < rift.y - rift.step - 4.6; // through the gate, or down in the cloud between the walls of the rift, long before its bed
  }
  // a clear spot on the open seabed, for placing hunters and hooks
  function openSpot(minFromSpawn = 24) {
    for (let i = 0; i < 40; i++) {
      const x = rand() * T, z = rand() * T;
      if (clearOfSites(x, z, 2) && farFrom(x, z, SPAWN.x, SPAWN.z, minFromSpawn)) return [x, z];
    }
    return [rand() * T, rand() * T];
  }
  function dispose() {
    for (const o of owned) {
      if (o.isObject3D) { scene.remove(o); if (o.isInstancedMesh) o.dispose(); else if (o.geometry && !Object.values(G).includes(o.geometry)) o.geometry.dispose(); }
      else o.dispose();
    }
    for (const m of materials) m.dispose();
  }

  // what answered the fish, for whoever gives it sound (rang: chimes brushed since last read, each { note, v, x, y, z }) and for the checks
  const react = { rang: stirred.rang, swarms: swarmNews, cleaned: cleanNews, stations, opened, puzzles, posts: puzzles.filter((p) => p.ring).map((p) => p.ring), fragments, settle, wake, pilots, chimes: chimeSets, grown: grownAt, get rings() { return stirred.rings; }, get puffed() { return stirred.puffed; }, get puffs() { return puffs.filter((pf) => pf.age < pf.life).length; }, get speed() { return stirred.speed; } };
  return { update, react, pushOut, footing, steer, height, ceiling: 15.5, time, floor: F, index: floor, goal, hall, portal, schools, take, atGoal, openSpot, rift: rift && { ...rift, in: riftIn, mid: riftMid, w: riftW, veil: riftVeil, ledgeY: rift.y - rift.step, murk, light: () => lamps[0].mesh.material.opacity / lamps[0].peak }, dispose, rand, spots, urns, breakUrn, nursery: nurse,
    stats: { rocks: rocks.length, coral: fingers.length + tables.length, colliders: colliders.length, minnows: minnows.length, swarms: F.schools } };
}
