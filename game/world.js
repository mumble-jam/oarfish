// One depth band of the dive: the seabed and everything rooted on it.
// The world repeats every T metres in x and z; fog hides the seam, so it reads as open water.

import * as THREE from 'three';
import { rng, lerp, clamp, soup, M, glowTexture, beamTexture } from './geo.js';
import { mesher, ringY, ringZ, shaded, alive, tint, dim, bright, growing } from './kit.js';
import { swarmKit, swarmFor, register, tonesOf, paintOf, stoneOf, look as theLook, SOFT } from './npc.js';
import { softSkin, smoothNormals } from './soft.js';

export const T = 144;
const CELL = 3, GRID = 46, NCELL = T / CELL;
const K = (Math.PI * 2) / T;
export const SPAWN = new THREE.Vector3(T / 2, 0, T / 2);
export const wrapD = (d) => d - T * Math.round(d / T); // shortest way round the repeating world

// Swarms of small fish are the treasure chests: a swarm is only caught whole, by a body long enough to
// go round the entire ball, so the big ones wait for a long body. n fish, ball radius r in metres.
export const SWARMS = { s: { n: 8, r: 0.42 }, m: { n: 18, r: 0.76 }, l: { n: 36, r: 1.05 }, h: { n: 70, r: 1.34 } };
// What counts as ringing something. `assist` (0..1) is the one feel setting: with more of it the body
// need not go quite all the way round, and the ball packs a little tighter to fit inside.
export const wrapRule = (assist) => ({ sweep: Math.PI * 2 * lerp(0.93, 0.8, assist), squeeze: lerp(0.96, 0.84, assist) });
const GATE = wrapRule(0.6); // which body length may take which swarm never depends on the assist setting
export const canWrap = (total, room) => (0.9 * total) / GATE.sweep >= room * GATE.squeeze + 0.12;

// The five bands of the dive. Counts are per band; light fades and the hunters multiply on the way down.
export const FLOORS = [
  { name: 'The sunlight zone', depth: 40, water: '#2b93a3', sky: '#e2f8ff', bed: '#4f97a0', hemi: 2.0, sun: 2.3, lamp: 0, lampReach: 30, fog: [0.75, 42], seaLight: 0.2, shafts: 0.42, fishGlow: 0, finGlow: 0,
    rocks: 170, kelp: 46, coral: 150, glow: 0, schools: 'sssssmmlh', biters: 0, hooks: 2, anglers: 0, ruins: ['ring', 'gate', 'remains'] },
  { name: 'The edge of light', depth: 180, water: '#1d6f8e', sky: '#bfe6f5', bed: '#2f6f85', hemi: 1.5, sun: 1.35, lamp: 3, lampReach: 26, fog: [0.7, 36], seaLight: 0.1, shafts: 0.22, fishGlow: 0.2, finGlow: 0.12,
    rocks: 180, kelp: 34, coral: 90, glow: 30, schools: 'ssssmmml', biters: 3, hooks: 6, anglers: 0, ruins: ['gate', 'remains', 'arch'] },
  { name: 'The twilight zone', depth: 450, water: '#12426a', sky: '#7fb4d8', bed: '#173f5e', hemi: 0.85, sun: 0.4, lamp: 10, lampReach: 24, fog: [0.62, 28], seaLight: 0.03, shafts: 0, fishGlow: 0.7, finGlow: 0.3,
    rocks: 200, kelp: 14, coral: 40, glow: 110, schools: 'sssmmllh', biters: 5, hooks: 4, anglers: 3, ruins: ['ring', 'remains'] },
  { name: 'Deep twilight', depth: 800, water: '#0a2444', sky: '#4d7fb0', bed: '#0d2a4a', hemi: 0.42, sun: 0, lamp: 16, lampReach: 21, fog: [0.55, 22], seaLight: 0, shafts: 0, fishGlow: 1, finGlow: 0.5,
    rocks: 210, kelp: 0, coral: 14, glow: 170, schools: 'ssmmllh', biters: 6, hooks: 2, anglers: 5, ruins: ['gate', 'remains', 'arch'] },
  { name: 'Ryūgū, the palace below', depth: 1000, water: '#07142e', sky: '#3c6aa0', bed: '#0a1c3a', hemi: 0.3, sun: 0, lamp: 17, lampReach: 19, fog: [0.5, 20], seaLight: 0, shafts: 0, fishGlow: 1, finGlow: 0.6,
    rocks: 190, kelp: 0, coral: 30, glow: 200, schools: 'smmllh', biters: 6, hooks: 0, anglers: 6, ruins: ['remains'] },
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
  // the people's ring, hung over a well: a body closed on itself, segment by segment
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
    m.limb([0, 0, 0], [0, 0.2, 0], 0.17, 0.22, 7, [grey(0.5), grey(0.75)]).cap(m.last, [0, 1, 0], grey(0.45), -0.03);
    for (let i = 0; i < 11; i++) { const yaw = (i / 11) * Math.PI * 2 + rand() * 0.3, t0 = 0.5 + rand() * 0.5, a = [Math.sin(yaw) * 0.16, 0.2, Math.cos(yaw) * 0.16], b = add3(a, aim(yaw, t0), 0.22), c = add3(b, aim(yaw, t0 - 0.5), 0.2 + rand() * 0.12);
      m.limb(a, b, 0.04, 0.03, 3, [grey(0.7), grey(0.95)]).limb(b, c, 0.03, 0.008, 3, [grey(0.95), bright(1.6)]); }
    return m.geometry(); })();
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
      for (let i = 0; i < 5; i++) m.tri([0, 0, 0], rim[i], rim[i + 1], [grey(0.5 * k), i % 2 ? bright(1.15 * k) : grey(0.86 * k), i % 2 ? grey(0.86 * k) : bright(1.15 * k)]); }
    return m.geometry(); })();
  const pebble = (() => { const g = new THREE.OctahedronGeometry(1, 0), a = g.attributes.position; for (let i = 0; i < a.count; i++) a.setXYZ(i, a.getX(i) * 1.1, a.getY(i) * 0.5 + 0.2, a.getZ(i) * 0.8); return grounded(plain([[g, null]]), 0.7, 1.06); })();
  // a sea lily: a jointed stalk and a cup of arms that curl in
  const lily = (() => { const m = mesher(), top = [0.05, 0.6, 0.02];
    m.limb([0, 0, 0], [0.03, 0.3, 0], 0.03, 0.026, 4, grey(0.55)).limb([0.03, 0.3, 0], top, 0.026, 0.035, 4, grey(0.65));
    for (let i = 0; i < 9; i++) { const yaw = (i / 9) * Math.PI * 2, o = aim(yaw, 1.0), s = [Math.cos(yaw), 0, -Math.sin(yaw)], w = 0.03;
      const at = (t) => [top[0] + o[0] * 0.3 * Math.sin(t * 2.0), top[1] + 0.42 * t, top[2] + o[2] * 0.3 * Math.sin(t * 2.0)], side = (p, sg, k) => [p[0] + s[0] * w * sg * k, p[1], p[2] + s[2] * w * sg * k];
      for (let j = 0; j < 3; j++) { const p = at(j / 3), q = at((j + 1) / 3); m.quad(side(p, -1, 1 - j * 0.25), side(p, 1, 1 - j * 0.25), side(q, 1, 0.75 - j * 0.25), side(q, -1, 0.75 - j * 0.25), [grey(0.7 + 0.1 * j), grey(0.7 + 0.1 * j), j === 2 ? bright(1.4) : grey(0.8 + 0.1 * j)]); } }
    return m.geometry(); })();
  // a glass sponge: a pale vase of lattice
  const glass = (() => { const rings = [[0.05, 0], [0.13, 0.3], [0.19, 0.68], [0.25, 1]].map(([r, y]) => ringY(y, r, 7, { x: 0.05 * y * y }));
    return mesher().skin(rings, (i, k) => grey((i + k) % 2 ? 1 : 0.66)).cap(rings[3], [0, 1, 0], grey(0.3), -0.42).geometry(); })();
  // tube worms: white tubes, red plumes. Coloured in itself
  const worms = (() => { const m = mesher();
    for (let i = 0; i < 6; i++) { const yaw = i * 1.9 + rand(), d = 0.05 + 0.13 * (i % 3), a = [Math.sin(yaw) * d, 0, Math.cos(yaw) * d], h = 0.4 + rand() * 0.6, b = add3(a, aim(yaw, 0.1 + rand() * 0.25), h);
      m.limb(a, b, 0.05, 0.042, 5, ['#9a968c', '#efeadc']);
      for (let k = 0; k < 4; k++) { const t = add3(b, aim(yaw + k * 1.57, 0.6), 0.2); m.tri(b, [t[0] - 0.03, t[1], t[2] - 0.03], [t[0] + 0.03, t[1], t[2] + 0.03], ['#a81f3c', '#ff5b6e', '#ff5b6e']); } }
    return m.geometry(); })();
  // a sea pen: a quill that makes its own light along its vanes
  const pen = (() => { const m = mesher(), spine = (t) => [0.1 * t * t, t, 0.02 * Math.sin(t * 5)];
    m.limb(spine(0), spine(0.3), 0.03, 0.022, 3, grey(0.3));
    for (let i = 0; i < 7; i++) { const t = 0.3 + i * 0.1, p = spine(t), q = spine(t + 0.1), L = 0.2 * (1 - i / 9);
      m.limb(p, q, 0.022 - i * 0.002, 0.02 - i * 0.002, 3, grey(0.4));
      for (const sg of [-1, 1]) m.tri(p, [p[0] + 0.02, p[1] + 0.13, p[2] + sg * L], q, [grey(0.5), bright(1.1), grey(0.6)], true); }
    return m.geometry(); })();
  // the lantern flower of the dark bands: the stalk bows over and the light hangs from it in its sepals
  const lantern = (() => { const m = mesher(), arc = [[0, 0, 0], [0.03, 0.45, 0], [0.09, 0.82, 0], [0.2, 0.98, 0], [0.31, 0.9, 0]];
    for (let i = 0; i < 4; i++) m.limb(arc[i], arc[i + 1], 0.03 - i * 0.004, 0.026 - i * 0.004, 3, grey(0.22 + 0.04 * i));
    for (const sg of [-1, 1]) m.tri([0.01, 0.12, 0], [0.04, 0.34, sg * 0.16], [0.03, 0.3, 0], [grey(0.25), grey(0.4), grey(0.3)]);
    const c = [0.31, 0.74, 0], bud = [ringY(c[1] + 0.1, 0.05, 5, { x: c[0] }), ringY(c[1], 0.11, 5, { x: c[0] }), ringY(c[1] - 0.13, 0.03, 5, { x: c[0] })];
    m.skin(bud, (i) => (i ? [bright(1.1), bright(0.7)] : [bright(0.8), bright(1.1)]), true).cap(bud[2], [0, -1, 0], bright(0.7), 0.04, true);
    for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; m.tri([c[0], c[1] + 0.17, 0], [c[0] + Math.sin(a - 0.5) * 0.09, c[1] + 0.06, Math.cos(a - 0.5) * 0.09], [c[0] + Math.sin(a + 0.5) * 0.09, c[1] + 0.06, Math.cos(a + 0.5) * 0.09], grey(0.3)); }
    return m.geometry(); })();
  const rockGeo = (() => { const m = mesher().add(rock, null, '#ffffff'); const g = grounded(m.geometry(), 0.66, 1.06); return g; })();
  GEO = {
    rock: rockGeo, kelp: kelpGeo, tuft, stag, brain, seaFan, sponge, anemone, star: star(0.38, 0.14), brittle: star(0.13, 0.07), urchin, clam, pebble, lily, glass, worms, pen, lantern,
    finger: stag, table: tableGeo,
    drum: grounded(plain([[new THREE.CylinderGeometry(0.5, 0.5, 1, 10, 1).translate(0, 0.5, 0), null]]), 0.8, 1.02),
    block: grounded(plain([[new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), null]]), 0.8, 1.03),
    shaft: shaft(false), shaftEnd: shaft(true), stump, base, echinus, flag, rubble, jar: jar(false), jarBroken: jar(true), shard, wreath,
    coin: plain([[new THREE.TorusGeometry(0.17, 0.055, 4, 8), M(0, 0, 0, Math.PI / 2, 0, 0)]]), // a tail segment, the coin
    hoop: plain([[new THREE.TorusGeometry(0.42, 0.05, 4, 10), M(0, 0.95, 0)], [new THREE.CylinderGeometry(0.05, 0.07, 0.55, 4), M(0, 0.27, 0)], [new THREE.CylinderGeometry(0.16, 0.2, 0.08, 6), M(0, 0.04, 0), grey(0.8)]]),
    // the carved coil: a body that has almost closed on itself, with a crest where the head is
    coil: plain([[new THREE.TorusGeometry(0.62, 0.15, 5, 14, Math.PI * 1.8), M(0, 0, 0, Math.PI / 2, 0, 0)],
      ...[0, 1, 2].map((i) => [new THREE.ConeGeometry(0.05, 0.5 - i * 0.1, 4), M(0.62, 0.3 - i * 0.02, -0.04 - i * 0.16, -0.25 - i * 0.2, 0, 0)])]),
    glow: glowTexture(), beam: beamTexture(),
  };
  return GEO;
}

// ---------------------------------------------------------------- what the world is made of, as components
// Each model above is white with its shading baked in; what colours it is the tint it is scattered with. So a thing
// that grows carries its own tints (they can be changed in the specimen library, and are read here), and a thing of
// stone carries none: it takes its band's stone, or its band's paint, from the two sets in npc.js.
{
  const pal = (list) => Object.fromEntries(list.map((c, i) => [`tone${i + 1}`, c]));
  const thing = (group) => (id, name, geo, bands, length, about, tones, show, material = {}) => register({ id, group, name, bands, length, about, soft: { ...SOFT, skin: true }, role: group === 'On the bed' ? 'Lies on the bed. Nothing to the fish but something to swim over.' : 'Grows where it grows. The fish swims through or round it.', palette: pal(tones), build: () => geometries()[geo], material, show });
  const grows = thing('Things that grow'), lies = thing('On the bed');
  grows('kelp', 'Kelp', 'kelp', [0, 1, 2], 5, 'Four broad blades, each folded along its midrib so the two halves take the light differently, the edges ruffled; round the foot, young blades on their floats.', ['#4ba57c', '#5fb88a', '#7bb262', '#3f9a8a', '#6cc09a'], { scale: [1.7, 5, 1.7], n: 5, spread: 1.7 }, { sway: 1 });
  grows('seagrass', 'Seagrass', 'tuft', [0, 1], 0.7, 'A tuft of narrow blades. It grows on the green patches of the two bands that have light.', ['#6fbf86', '#86c98f', '#5aa884', '#9bd28e'], { scale: [1.4, 0.7, 1.4], n: 9, spread: 1.3 }, { sway: 1.3 });
  grows('staghorn', 'Staghorn coral', 'stag', [0, 1, 2, 3, 4], 1.3, 'Each branch forks, and the growing tips are pale. It also takes root on the stonework where there is light.', ['#f28d7d', '#f6b95f', '#c98fe3', '#f9d9c9', '#ea6079', '#ff9fb0'], { scale: 1.3, n: 3, spread: 1.4 }, { double: false });
  grows('tablecoral', 'Table coral', 'table', [0, 1, 2, 3, 4], 2.4, 'Tiers of plates on a stalk, with a scalloped, paler rim and dark underneath.', ['#f28d7d', '#f6b95f', '#c98fe3', '#f9d9c9', '#ea6079', '#ff9fb0'], { scale: 1.3, n: 1 }, { double: false });
  grows('braincoral', 'Brain coral', 'brain', [0, 1], 1.8, 'A dome, its ridges and valleys in two tones. The big ones are solid: the fish goes round.', ['#f6b95f', '#d9a86a', '#9fc59a', '#f28d7d', '#e8c9a0'], { scale: 0.9, n: 1 }, { double: false });
  grows('seafan', 'Sea fan', 'seaFan', [0, 1, 2], 1.5, 'One flat spray of branches, standing across the current.', ['#b47be0', '#f08a4b', '#e2566b', '#f6d040', '#ff9fb0'], { scale: 1.5, n: 3, spread: 1.3 }, { sway: 0.5 });
  grows('sponge', 'Tube sponge', 'sponge', [0, 1, 2], 1.1, 'Open chimneys, wider at the lip, dark inside.', ['#f6d040', '#c98fe3', '#f08a4b', '#7fd6c8'], { scale: 1.1, n: 3, spread: 1.2 }, { double: false });
  grows('anemone', 'Anemone', 'anemone', [0, 1, 2], 0.6, 'A short column and a crown of tentacles with pale ends, moving with the water.', ['#f4a4b9', '#9fe0b0', '#fff1d0', '#c98fe3', '#ff9f7a'], { scale: 0.95, n: 5, spread: 1 }, { sway: 0.9 });
  grows('sealily', 'Sea lily', 'lily', [1, 2, 3, 4], 1.3, 'A jointed stalk and a cup of arms that curl in. An animal, for all it looks like a flower.', ['#f6d040', '#f6b95f', '#fff1d0', '#f4a4b9'], { scale: 1.3, n: 3, spread: 1.1 }, { sway: 0.5 });
  grows('glasssponge', 'Glass sponge', 'glass', [2, 3, 4], 1, 'A pale vase of lattice, from the dark bands.', ['#e4f1ff', '#cfe3f2', '#f2faf7'], { scale: 1, n: 3, spread: 1 }, { double: false });
  grows('tubeworms', 'Tube worms', 'worms', [3, 4], 1.1, 'White tubes with red plumes, in a clump by the rocks of the deepest bands. They are coloured in themselves: the tint only warms or cools them.', ['#ffffff'], { scale: 1.1, n: 3, spread: 0.9 }, { double: false });
  grows('lantern', 'Lantern flower', 'lantern', [1, 2, 3, 4], 1.2, 'The stalk bows over and the light hangs from it in its sepals. Below the reach of the sun these are most of what there is to see by.', ['#7ff3ff', '#b79bff', '#9dffb4', '#ff9de0'], { scale: [1.25, 1.2, 1.25], n: 5, spread: 1 }, { sway: 0.3, glow: 1.15 });
  grows('seapen', 'Sea pen', 'pen', [1, 2, 3, 4], 1.4, 'A quill that makes its own light along its vanes.', ['#7ff3ff', '#b79bff', '#9dffb4', '#ff9de0'], { scale: [1.5, 1.4, 1.5], n: 3, spread: 0.9 }, { sway: 0.3, glow: 1.15 });
  lies('starfish', 'Starfish', 'star', [0, 1, 2], 0.6, 'Five arms, paler at the tips, lying to the slope of the bed.', ['#f08a4b', '#e2566b', '#f6b95f', '#b47be0', '#f4a4b9'], { scale: 0.3, n: 5, spread: 0.7, flat: true }, { double: false });
  lies('brittlestar', 'Brittle star', 'brittle', [2, 3, 4], 0.9, 'The starfish of the dark bands: a small disc and long thin arms.', ['#e9dfc0', '#d7b9a0', '#f4a4b9', '#cfe3f2'], { scale: 0.45, n: 5, spread: 0.9, flat: true }, { double: false });
  lies('urchin', 'Urchin', 'urchin', [0, 1, 2, 3], 0.5, 'A small one on the bed, by the rocks. It is the spined drifter’s harmless cousin.', ['#3b2a4d', '#2b2038', '#5a2f4f', '#7a2f45'], { scale: 0.36, n: 5, spread: 0.8 });
  lies('clam', 'Clam', 'clam', [0, 1, 2, 3, 4], 0.5, 'Two ribbed valves, standing open: or what is left of one.', ['#f3ead2', '#f9cdd6', '#d9c7a8', '#e7d3e8'], { scale: 0.26, n: 5, spread: 0.7 });
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
  built('wreath', 'The people’s ring', 'wreath', 3.4, 'A body closed on itself, segment by segment. It hangs on two chains over every well, and the nursery’s hoops are the same ring.', 'paint', { scale: 1.55, n: 1, lift: 1.9 });
  built('hoop', 'A young one’s hoop', 'hoop', 1.4, 'The stone hoops the young swam through, beside the houses and along the way to the first well.', 'paint');
  built('coil', 'The carved coil', 'coil', 1.4, 'A body that has almost closed on itself, with a crest where the head is. It sits at the middle of every hero’s ring.', 'paint', { scale: 1.2, n: 1, lift: 0.2 });
  built('coin', 'A tail, as coin', 'coin', 0.4, 'A tail segment: what the Long Ones paid with. Stacked on the market tables, heaped at the wells.', 'paint', { scale: 1, n: 6, spread: 0.3, lift: 0.1 });
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
  const time = { value: 0 }, seaLight = { value: F.seaLight };
  const colliders = []; // { x, y, z, r } spheres and { x, z, r, top } upright cylinders
  const scatters = [], owned = [], materials = [];
  const add = (o) => { scene.add(o); owned.push(o); return o; };
  const mat = (m) => { materials.push(m); return m; };
  // in the soft look, what grows and what lies on the bed keep their models and take a soft skin (soft.js)
  const skin = (m) => (theLook.soft ? softSkin(m, SOFT) : m);
  const scatter = (geo, material, items, opts) => { if (material.userData.softSkin) smoothNormals(geo); const s = new Scatter(geo, material, items, opts); scatters.push(s); add(s.mesh); return s; };
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
  const shafts = [], shaftEnds = [], stumps = [], bases = [], echini = [], flags = [], rubbles = [], shards = [], jars = [], jarsBroken = [], wreaths = [];
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
  function lintel(ax, az, bx, bz, top, thick = 0.6) {
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
    for (let i = gap; i < n; i++) { const a = (i / n) * Math.PI * 2, x = cx + Math.sin(a) * R, z = cz + Math.cos(a) * R; column(x, z, sawn ? 1.1 : 4.4, { capital: !sawn, yaw: a, sawn }); }
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
      lintel(ax, az, bx, bz, Math.max(column(ax, az, 4.4, { yaw: goalAngle }), column(bx, bz, 4.4, { yaw: goalAngle })));
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
      for (const [n, R, h] of [[14, 9.5, 4.2], [9, 6, 3.2], [5, 3, 2.3]]) for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + R; column(cx + Math.sin(a) * R, cz + Math.cos(a) * R, h, { yaw: a }); }
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

  // the rift's middle, where people came to it: old stones along both edges, a frame over the mouth, a pale beam rising out of it
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
    { // a pillar on the ledge at either side of the mouth, and the people's ring hung between them on two long chains, over the dark
      const out = riftW(0) - rift.ledge + 0.9, [ax, az] = at(0, -out), [bx, bz] = at(0, out), a = goalAngle;
      const top = Math.max(column(ax, az, 8.4, { yaw: a }), column(bx, bz, 8.4, { yaw: a })), ry = top - 4.4;
      wreaths.push({ x: goal.x, y: ry, z: goal.z, q: qY(a + Math.PI / 2), s: S(1.55), color: district });
      for (const sgn of [-1, 1]) for (let k = 0; k <= 12; k++) { const t = k / 12, d = sgn * lerp(1.15, out - 0.35, t); coins.push({ x: goal.x + Math.sin(a) * d, y: lerp(ry + 1.2, top + 0.1, t) - 1.5 * t * (1 - t) * 4 * 0.5, z: goal.z + Math.cos(a) * d, q: qY(a + (k % 2 ? 0 : Math.PI / 2), Math.PI / 2 - sgn * 0.35), s: S(0.75, 0.75, 1.1), color: dpick(stoneTones) }); }
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
    lintel(ax - nx * 1.4, az - nz * 1.4, bx + nx * 1.4, bz + nz * 1.4, top, 0.8);
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
    schools.push({ tier, n: sw.n, ball: sw.r, fit: sw.r, orbit: sw.r + 0.3, can: false, px: 0, pz: 0, pack: 1, progress: 0, arcStart: 0, arcSign: 1, hx, hz, hy: height(hx, hz) + rr(2.6, 4.2), ph: rand() * 6.28, r: kept ? 0.6 : first ? 1.6 : tease ? 1.4 : penned ? 0.7 : rr(4, 9), clock: rand() * 50,
      threat: 0, x: hx, z: hz, y: 0, left: sw.n, burst: 0, tone: schoolTones[s % schoolTones.length], ring: null, arc: null });
  });
  const total = schools.reduce((a, sc) => a + sc.n, 0);
  const minnowMat = mat(fishKit.material), fishSize = new THREE.Vector3().setScalar(fishKit.scale);
  const fishMesh = add(new THREE.InstancedMesh(fishKit.geometry, minnowMat, Math.max(total, 1)));
  fishMesh.frustumCulled = false; fishMesh.castShadow = true;
  const minnows = [];
  {
    const c = new THREE.Color();
    for (const sc of schools) for (let i = 0; i < sc.n; i++) {
      // an even-ish fill of the ball: radius by cube root, so the middle is not crowded
      minnows.push({ sc, ph: rand() * 6.28, rho: 0.25 + 0.75 * Math.cbrt(rand()), h: rr(-1, 1), sp: rr(0.7, 1.3), flee: new THREE.Vector3(), p: new THREE.Vector3(), first: true, alive: true });
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
  scatter(G.rock, mat(skin(new THREE.MeshLambertMaterial({ color: '#ffffff', vertexColors: true }))), rocks);

  // everything that grows shares one kind of material: it may sway with the water, and faces marked for it give light
  const plant = (o) => mat(skin(growing(o, time)));
  // ------------------------------------------------------------ kelp, swaying
  if (F.kelp) {
    const kelpMat = plant({ sway: 1 });
    const kelpTones = tonesOf('kelp'), kelp = [];
    for (let c = 0; c < F.kelp; c++) {
      const cx = rand() * T, cz = rand() * T, n = 3 + Math.floor(rand() * 7), tall = rr(3, 7.5);
      for (let i = 0; i < n; i++) {
        const a = rand() * 6.28, d = rr(0, 2.8), x = cx + Math.sin(a) * d, z = cz + Math.cos(a) * d, w = rr(1.3, 2.2), hgt = tall * rr(0.6, 1.1), yaw = rand() * 6.28, tone = pick(kelpTones);
        if (clearOfSites(x, z)) kelp.push({ x, y: height(x, z) - 0.15, z, q: qY(yaw), s: S(w, hgt, w), color: tone });
      }
    }
    for (const [x, z] of spots.kelpRows || []) kelp.push({ x, y: height(x, z) - 0.15, z, q: qY(rand() * 6.28), s: S(1.6, rr(3.6, 4.6), 1.6), color: pick(kelpTones) });
    scatter(G.kelp, kelpMat, kelp, { receive: false });
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
  const glowMat = plant({ sway: 0.3, glow: 1.15 });
  scatter(G.lantern, glowMat, lanterns, { cast: false, receive: false });
  scatter(G.pen, glowMat, pens, { cast: false, receive: false });

  // ------------------------------------------------------------ the bed itself: what lives and lies on it, band by band
  {
    const at = (list) => list[floor] || 0;
    const open = (pad = 1) => { for (let t = 0; t < 8; t++) { const x = drand() * T, z = drand() * T; if (clearOfSites(x, z, pad)) return [x, z]; } return null; };
    const byReef = (r0, r1) => { for (let t = 0; t < 8; t++) { const c = dpick(reefs), a = drand() * 6.28, d = dr(r0, r1), x = c[0] + Math.sin(a) * d, z = c[1] + Math.cos(a) * d; if (clearOfSites(x, z, 1)) return [x, z]; } return null; };
    const strew = (n, where, make) => { const out = []; for (let i = 0; i < n; i++) { const p = where(); if (p) { const it = make(p[0], p[1]); if (it) out.push(it); } } return out; };
    const flat = (tones, s0, s1, lift = 0.012) => (x, z) => ({ x, y: height(x, z) + lift, z, q: lie(x, z), s: S(dr(s0, s1)), color: dpick(tones) });
    const rooted = (tones, s0, s1, sink = 0.06) => (x, z) => { const sz = dr(s0, s1); return { x, y: height(x, z) - sink * sz, z, q: qY(drand() * 6.28, dr(-0.1, 0.1), dr(-0.1, 0.1)), s: S(sz), color: dpick(tones) }; };
    const still = plant({ double: false }), stillBoth = plant(), soft = plant({ sway: 0.5 }), softer = plant({ sway: 0.9 });
    // seagrass in the green patches of the two bands that have light
    { const grass = []; for (let i = 0, n = at([1400, 700]); i < n * 7 && grass.length < n; i++) { const x = drand() * T, z = drand() * T; if (meadow(x, z) > 0.5 && clearOfSites(x, z, 0.5)) grass.push({ x, y: height(x, z) - 0.04, z, q: qY(drand() * 6.28), s: S(dr(1.1, 1.8), dr(0.4, 0.95), dr(1.1, 1.8)), color: dpick(tonesOf('seagrass')) }); }
      if (grass.length) scatter(G.tuft, plant({ sway: 1.3 }), grass, { cast: false, receive: false, reach: 44 }); }
    // pebbles and broken shell, in drifts
    { const stones = [], tones = tonesOf('pebble');
      for (let c = 0, n = at([170, 170, 190, 210, 200]); c < n; c++) { const p = open(0.5); if (!p) continue; for (let i = 0, k = 3 + Math.floor(drand() * 6); i < k; i++) { const x = p[0] + dr(-1.3, 1.3), z = p[1] + dr(-1.3, 1.3), sz = dr(0.05, 0.2); stones.push({ x, y: height(x, z) - sz * 0.25, z, q: lie(x, z), s: S(sz * dr(0.8, 1.5), sz, sz * dr(0.8, 1.3)), color: dpick(tones) }); } }
      scatter(G.pebble, still, stones, { cast: false, reach: 40 }); }
    scatter(G.star, still, strew(at([70, 60, 30]), () => open(), flat(tonesOf('starfish'), 0.2, 0.38)), { cast: false, reach: 44 });
    scatter(G.brittle, still, strew(at([0, 0, 30, 60, 60]), () => open(), flat(tonesOf('brittlestar'), 0.3, 0.55)), { cast: false, reach: 44 });
    scatter(G.urchin, stillBoth, strew(at([44, 40, 30, 20]), () => byReef(1, 6), rooted(tonesOf('urchin'), 0.24, 0.46, 0.02)), { cast: false, reach: 44 });
    scatter(G.clam, stillBoth, strew(at([60, 50, 34, 24, 24]), () => open(), flat(tonesOf('clam'), 0.16, 0.32)), { cast: false, reach: 44 });
    { const domes = strew(at([30, 16]), () => byReef(2, 8), rooted(tonesOf('braincoral'), 0.5, 1.25, 0.1));
      for (const d of domes) if (d.s.x > 0.8) colliders.push({ x: d.x, y: d.y, z: d.z, r: d.s.x * 0.8 });
      scatter(G.brain, still, domes); }
    scatter(G.seaFan, soft, strew(at([34, 30, 16]), () => byReef(1.5, 8), rooted(tonesOf('seafan'), 1.0, 2.0)), { receive: false });
    scatter(G.sponge, still, strew(at([30, 30, 20]), () => byReef(1.5, 7), rooted(tonesOf('sponge'), 0.7, 1.4)));
    scatter(G.anemone, softer, strew(at([44, 30, 12]), () => byReef(1, 6), rooted(tonesOf('anemone'), 0.6, 1.25, 0.03)), { cast: false });
    scatter(G.lily, soft, strew(at([0, 12, 40, 40, 22]), () => (drand() < 0.6 ? byReef(1, 8) : open()), rooted(tonesOf('sealily'), 0.9, 1.8, 0.02)), { receive: false });
    scatter(G.glass, still, strew(at([0, 0, 14, 40, 40]), () => (drand() < 0.5 ? byReef(1, 8) : open()), rooted(tonesOf('glasssponge'), 0.6, 1.4)));
    scatter(G.worms, still, strew(at([0, 0, 0, 30, 50]), () => byReef(0.8, 4), (x, z) => ({ ...rooted(tonesOf('tubeworms'), 0.8, 1.5)(x, z) })));
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
  { const places = sites.slice(1).filter(([x, z, r]) => r >= 5 && (!hall || farFrom(x, z, hall.x, hall.z, hall.R + 8)) && (!nurse || urns.every((u) => farFrom(x, z, u.x, u.z, 12))));
    for (let i = 0; i < 5 && places.length; i++) { const [sx, sz, r] = places.splice(Math.floor(drand() * places.length), 1)[0], a = drand() * 6.28, p = new THREE.Vector3(sx + Math.sin(a) * r * 0.45, 0, sz + Math.cos(a) * r * 0.45); p.y = height(p.x, p.z) + 1; pushOut(p, 1.3); urnAt(p.x, p.z, dr(1.9, 2.4), 'food'); } }
  const single = [];
  for (const u of urns) { u.mesh = add(new THREE.Mesh(G.jar, mat(new THREE.MeshLambertMaterial({ color: u.color, vertexColors: true, side: THREE.DoubleSide })))); u.mesh.scale.setScalar(u.size); u.mesh.rotation.y = drand() * 6.28; u.mesh.castShadow = true; u.mesh.frustumCulled = false; single.push(u); }
  if (nurse) for (const h of nurse.hoops) { h.mesh = add(new THREE.Mesh(G.wreath, mat(new THREE.MeshLambertMaterial({ color: district, vertexColors: true, emissive: '#ffe9b0', emissiveIntensity: 0 })))); h.mesh.scale.setScalar(h.r); h.mesh.rotation.y = nurse.dir; h.mesh.castShadow = true; h.mesh.frustumCulled = false; single.push(h); }
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
  scatter(G.wreath, stone, wreaths);

  // ------------------------------------------------------------ per-frame
  const m4 = new THREE.Matrix4(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), q1 = new THREE.Quaternion(), fwd = new THREE.Vector3(0, 0, 1), one = new THREE.Vector3(1, 1, 1), none = new THREE.Vector3(0, 0, 0);
  let wrapTimer = 0;
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
      sc.clock += dt * (1 - 0.9 * sc.threat);
      let cx = sc.hx + Math.sin(sc.clock * 0.11 + sc.ph) * sc.r + sc.px, cz = sc.hz + Math.cos(sc.clock * 0.083 + sc.ph * 1.7) * sc.r + sc.pz;
      cx += T * Math.round((focus.x - cx) / T); cz += T * Math.round((focus.z - cz) / T);
      const d = Math.hypot(cx - fishHead.x, cz - fishHead.z);
      sc.threat += ((d < 6 + sc.ball * 3 && sc.left > 0 ? 1 : 0) - sc.threat) * (1 - Math.exp(-2.2 * dt));
      sc.y = lerp(Math.max(sc.hy, height(cx, cz) + 1.6), fishHead.y, sc.threat); // a cornered swarm does not flee up or down
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
      } else { const fade = Math.exp(-0.4 * dt); sc.px *= fade; sc.pz *= fade; }
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
    for (const b of beacons) {
      b.position.x = goal.x + ox; b.position.z = goal.z + oz;
      b.rotation.y = Math.atan2(camera.position.x - b.position.x, camera.position.z - b.position.z);
    }
    if (portal.mesh) { portal.mesh.position.x = goal.x + ox; portal.mesh.position.z = goal.z + oz; portal.mesh.material.opacity = (0.7 + 0.2 * Math.sin(t * 1.6)) * portal.level; beaconMat.opacity = 0.5 * portal.level; }
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
    return last ? d < 3 && Math.abs(p.y - goal.y) < 4.5 : riftIn(p.x, p.z) > rift.ledge + 1 && p.y < rift.y - rift.step - 4.5; // through the gate, or well down between the walls of the rift
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

  return { update, pushOut, height, ceiling: 15.5, time, floor: F, index: floor, goal, hall, portal, schools, take, atGoal, openSpot, rift: rift && { ...rift, in: riftIn, mid: riftMid, w: riftW, veil: riftVeil, ledgeY: rift.y - rift.step }, dispose, rand, spots, urns, breakUrn, nursery: nurse,
    stats: { rocks: rocks.length, coral: fingers.length + tables.length, colliders: colliders.length, minnows: minnows.length, swarms: F.schools } };
}
