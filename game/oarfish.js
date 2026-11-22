// Low-poly oarfish ("Le Gymnètre épée"), built procedurally.
// `bones` sets how many spine segments the body has, so the same code makes a short fish or a long one.
// Rest pose: straight body along Z. Head faces +Z, up is +Y, the fish's left is +X.
// Everything is one skinned mesh with flat-shaded faces and one material per colour.

import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const V3 = THREE.Vector3;
const v = (x, y, z) => new V3(x, y, z);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const DEG = Math.PI / 180;

export const PALETTE = {
  Body: '#c9a877',
  BodyTop: '#a8875a',
  Belly: '#b3b1bb',
  Spots: '#8a6b4c',
  Face: '#98a1b2',
  Gill: '#b0b8c6',
  Jaw: '#7d8799',
  Mouth: '#3d2433',
  FinPale: '#f9cdd6',
  FinPink: '#f4a4b9',
  FinMid: '#ec7090',
  FinRed: '#d83c5f',
  EyeRing: '#2c2531',
  Eye: '#f6d040',
  Pupil: '#1a171f',
};

function rng(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Catmull-Rom through (x, y) knots
function curve(pts) {
  return (x) => {
    const n = pts.length;
    if (x <= pts[0][0]) return pts[0][1];
    if (x >= pts[n - 1][0]) return pts[n - 1][1];
    let i = 0;
    while (x > pts[i + 1][0]) i++;
    const p0 = pts[Math.max(i - 1, 0)][1], p1 = pts[i][1], p2 = pts[i + 1][1], p3 = pts[Math.min(i + 2, n - 1)][1];
    const t = (x - pts[i][0]) / (pts[i + 1][0] - pts[i][0]);
    return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
  };
}

export function buildOarfish({ seed = 11, scale = 0.4, bones: boneCount = 14, materials: sharedMaterials = null, merge = true, clip = true, palette = null } = {}) {
  // repeatable noise keyed by (ring, slot), so the body keeps its shape when the fish grows or shrinks
  const h01 = (a, b) => {
    let t = Math.imul((a + seed * 131) | 0, 0x85ebca6b) ^ Math.imul((b + 0x7f4a7c15) | 0, 0xc2b2ae35);
    t = Math.imul(t ^ (t >>> 15), 0x2c1b3c6d);
    t = Math.imul(t ^ (t >>> 12), 0x297a2d39);
    return ((t ^ (t >>> 15)) >>> 0) / 4294967296;
  };

  // ------------------------------------------------------------------ dimensions
  // Modelled with body height = 1 at the neck, then scaled at the end.
  const SEG = 0.78; // spine bone length
  const NB = Math.max(3, boneCount | 0); // spine bones
  const L = SEG * NB; // neck → tail tip
  const NRING = NB * 2; // body ring segments (two per bone)

  const hOf = curve([[0, 1.0], [0.06, 1.06], [0.3, 1.0], [0.55, 0.88], [0.75, 0.66], [0.9, 0.38], [1, 0.07]]);
  const wOf = curve([[0, 0.48], [0.06, 0.5], [0.3, 0.44], [0.6, 0.33], [0.85, 0.19], [1, 0.04]]);
  const ycOf = (u) => 0.13 * (1 - hOf(u)); // centre line drifts up a little toward the tail
  const finOf = curve([[0, 0.56], [0.1, 0.58], [0.5, 0.48], [0.8, 0.34], [0.95, 0.2], [1, 0.1]]);

  // ------------------------------------------------------------------ skeleton
  const bones = [];
  const addBone = (name, parent, pos) => (bones.push({ name, parent, pos: pos.clone() }), bones.length - 1);
  const ROOT = addBone('root', -1, v(0, 0, 0));
  const HEAD = addBone('head', ROOT, v(0, 0, 0.02));
  const JAW = addBone('jaw', HEAD, v(0, -0.44, 0.7));
  const SP = [];
  for (let k = 0; k < NB; k++) {
    SP.push(addBone(`spine_${String(k + 1).padStart(2, '0')}`, k === 0 ? ROOT : SP[k - 1], v(0, ycOf((k * SEG) / L), -k * SEG)));
  }

  // weights for anything that should bend with the body, from its rest-pose z
  function wSpine(z) {
    if (z >= 0.3) return [[HEAD, 1]];
    if (z >= 0) {
      const wh = 0.5 + z / 0.6;
      return [[HEAD, wh], [SP[0], 1 - wh]];
    }
    const s = Math.min(-z / SEG, NB - 1e-6);
    const k = Math.floor(s), t = s - k;
    if (t < 0.5) {
      const wp = 0.5 - t;
      return [[SP[k], 1 - wp], [k === 0 ? HEAD : SP[k - 1], wp]];
    }
    if (k === NB - 1) return [[SP[k], 1]];
    const wn = t - 0.5;
    return [[SP[k], 1 - wn], [SP[k + 1], wn]];
  }

  // ------------------------------------------------------------------ triangle soup
  const tris = [];
  let curW = (p) => wSpine(p.z);
  const withW = (w, fn) => { const prev = curW; curW = w; fn(); curW = prev; };

  const _a = v(), _b = v(), _n = v();
  function push(a, b, c, m) {
    _n.crossVectors(_a.subVectors(b, a), _b.subVectors(c, a));
    if (_n.lengthSq() < 1e-14) return;
    tris.push({ m, p: [a.clone(), b.clone(), c.clone()], w: [curW(a), curW(b), curW(c)] });
  }
  // face toward `dir`
  function triDir(a, b, c, m, dir) {
    _n.crossVectors(_a.subVectors(b, a), _b.subVectors(c, a));
    if (_n.dot(dir) < 0) push(a, c, b, m); else push(a, b, c, m);
  }
  // face away from the point `ref`
  function triRef(a, b, c, m, ref) {
    const d = v().add(a).add(b).add(c).multiplyScalar(1 / 3).sub(ref);
    triDir(a, b, c, m, d);
  }
  function quadRef(a, b, c, d, m, ref, flip = false) {
    if (flip) { triRef(a, b, d, m, ref); triRef(b, c, d, m, ref); }
    else { triRef(a, b, c, m, ref); triRef(a, c, d, m, ref); }
  }
  function quadDir(a, b, c, d, m, dir, flip = false) {
    if (flip) { triDir(a, b, d, m, dir); triDir(b, c, d, m, dir); }
    else { triDir(a, b, c, m, dir); triDir(a, c, d, m, dir); }
  }
  const centroid = (pts) => pts.reduce((acc, p) => acc.add(p), v()).multiplyScalar(1 / pts.length);
  // thin extruded polygon: `tvec` is the half-thickness offset
  function addPlate(pts, tvec, mat, rimMat = mat) {
    const c = centroid(pts);
    const f = pts.map((p) => p.clone().add(tvec));
    const b = pts.map((p) => p.clone().sub(tvec));
    const neg = tvec.clone().negate();
    for (let i = 1; i < pts.length - 1; i++) {
      triDir(f[0], f[i], f[i + 1], mat, tvec);
      triDir(b[0], b[i], b[i + 1], mat, neg);
    }
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      const dir = pts[i].clone().add(pts[j]).multiplyScalar(0.5).sub(c);
      quadDir(f[i], f[j], b[j], b[i], rimMat, dir);
    }
  }

  // ------------------------------------------------------------------ rings (head + body loft)
  // Each ring is a hexagon: T (top), U± (upper side), L± (lower side), B (bottom).
  const rings = [
    { z: 1.2, Ty: 0.11, Ux: 0.105, Uy: 0.02, Lx: 0.1, Ly: -0.11, By: -0.19 },
    { z: 1.05, Ty: 0.43, Ux: 0.18, Uy: 0.23, Lx: 0.185, Ly: -0.12, By: -0.3 },
    { z: 0.8, Ty: 0.6, Ux: 0.23, Uy: 0.35, Lx: 0.24, Ly: -0.24, By: -0.47 },
    { z: 0.42, Ty: 0.6, Ux: 0.245, Uy: 0.34, Lx: 0.27, Ly: -0.3, By: -0.56 },
  ];
  const HEAD_SEGS = rings.length;
  for (let i = 0; i <= NRING; i++) {
    const u = i / NRING;
    let hh = hOf(u) / 2, hw = wOf(u) / 2;
    const yc = ycOf(u);
    let ju = 0, jl = 0, jt = 0, jb = 0;
    if (i > 0 && i < NRING) {
      const j = (k, a, b) => a + (b - a) * h01(i, k);
      hw *= j(0, 0.96, 1.04) * (i % 2 ? 1.035 : 0.965);
      ju = j(1, -0.035, 0.035) * hh; jl = j(2, -0.035, 0.035) * hh;
      jt = j(3, -0.02, 0.02) * hh; jb = j(4, -0.025, 0.025) * hh;
    }
    rings.push({
      z: -u * L,
      Ty: yc + hh + jt, Ux: 0.9 * hw, Uy: yc + 0.56 * hh + ju,
      Lx: hw, Ly: yc - 0.56 * hh + jl, By: yc - hh + jb,
    });
  }
  const KEYS = ['Ty', 'Ux', 'Uy', 'Lx', 'Ly', 'By'];
  function ringAt(z) {
    const n = rings.length;
    if (z >= rings[0].z) return { ...rings[0], z };
    if (z <= rings[n - 1].z) return { ...rings[n - 1], z };
    let i = 0;
    while (z < rings[i + 1].z) i++;
    const a = rings[i], b = rings[i + 1], t = (a.z - z) / (a.z - b.z);
    const r = { z };
    for (const k of KEYS) r[k] = lerp(a[k], b[k], t);
    return r;
  }
  // half-width of the body at (z, y)
  function surfX(z, y) {
    const r = ringAt(z);
    if (y >= r.Ty || y <= r.By) return 0;
    if (y >= r.Uy) return (r.Ux * (r.Ty - y)) / (r.Ty - r.Uy);
    if (y >= r.Ly) return lerp(r.Lx, r.Ux, (y - r.Ly) / (r.Uy - r.Ly));
    return (r.Lx * (y - r.By)) / (r.Ly - r.By);
  }
  const surfRaw = (side, z, y) => v(side * surfX(z, y), y, z);
  function surfNormal(side, z, y) {
    const e = 0.012;
    const dy = surfRaw(side, z, y + e).sub(surfRaw(side, z, y - e));
    const dz = surfRaw(side, z + e, y).sub(surfRaw(side, z - e, y));
    const n = dy.cross(dz).normalize();
    if (n.x * side < 0) n.negate();
    return n;
  }
  const surfPoint = (side, z, y, lift = 0) => surfRaw(side, z, y).addScaledVector(surfNormal(side, z, y), lift);

  const ringPts = (r) => ({
    T: v(0, r.Ty, r.z), B: v(0, r.By, r.z),
    UR: v(r.Ux, r.Uy, r.z), UL: v(-r.Ux, r.Uy, r.z),
    LR: v(r.Lx, r.Ly, r.z), LL: v(-r.Lx, r.Ly, r.z),
  });

  const bandMat = (seg) => {
    if (seg === 0) return { up: 'Face', side: 'Face', low: 'Mouth' };
    if (seg === 1) return { up: 'BodyTop', side: 'Face', low: 'Face' };
    return { up: 'BodyTop', side: 'Body', low: 'Belly' };
  };
  for (let i = 0; i < rings.length - 1; i++) {
    const a = ringPts(rings[i]), b = ringPts(rings[i + 1]);
    const ref = v(0, (rings[i].Ty + rings[i].By + rings[i + 1].Ty + rings[i + 1].By) / 4, (rings[i].z + rings[i + 1].z) / 2);
    const m = bandMat(i), f = i % 2 === 0;
    quadRef(a.T, a.UR, b.UR, b.T, m.up, ref, f);
    quadRef(a.T, a.UL, b.UL, b.T, m.up, ref, !f);
    quadRef(a.UR, a.LR, b.LR, b.UR, m.side, ref, !f);
    quadRef(a.UL, a.LL, b.LL, b.UL, m.side, ref, f);
    quadRef(a.LR, a.B, b.B, b.LR, m.low, ref, f);
    quadRef(a.LL, a.B, b.B, b.LL, m.low, ref, !f);
  }
  { // snout cap
    const r = rings[0], p = ringPts(r);
    const c = v(0, (r.Ty + r.By) / 2 + 0.01, r.z + 0.05), ref = v(0, c.y, r.z - 0.2);
    const loop = [p.T, p.UR, p.LR, p.B, p.LL, p.UL];
    for (let i = 0; i < 6; i++) triRef(c, loop[i], loop[(i + 1) % 6], i === 2 || i === 3 ? 'Mouth' : 'Face', ref);
  }
  { // tail cap
    const r = rings[rings.length - 1], p = ringPts(r);
    const c = v(0, (r.Ty + r.By) / 2, r.z - 0.06), ref = v(0, c.y, r.z + 0.2);
    const loop = [p.T, p.UR, p.LR, p.B, p.LL, p.UL];
    for (let i = 0; i < 6; i++) triRef(c, loop[i], loop[(i + 1) % 6], 'BodyTop', ref);
  }

  // ------------------------------------------------------------------ jaw
  withW(() => [[JAW, 1]], () => {
    const jr = [
      { z: 0.66, yt: -0.43, w: 0.2, yb: -0.57 },
      { z: 1.0, yt: -0.31, w: 0.18, yb: -0.51 },
      { z: 1.23, yt: -0.17, w: 0.115, yb: -0.36 },
    ];
    const P = jr.map((r) => ({ R: v(r.w, r.yt, r.z), L: v(-r.w, r.yt, r.z), K: v(0, r.yb, r.z) }));
    const up = v(0, 1, 0);
    for (let i = 0; i < jr.length - 1; i++) {
      const a = P[i], b = P[i + 1];
      const ref = v(0, (jr[i].yt + jr[i].yb + jr[i + 1].yt + jr[i + 1].yb) / 4, (jr[i].z + jr[i + 1].z) / 2);
      quadDir(a.L, a.R, b.R, b.L, 'Mouth', up);
      quadRef(a.R, a.K, b.K, b.R, 'Jaw', ref);
      quadRef(a.L, a.K, b.K, b.L, 'Jaw', ref);
    }
    const e = P[P.length - 1], tip = v(0, -0.165, 1.32), ref = v(0, -0.27, 1.15);
    triDir(e.L, e.R, tip, 'Jaw', up);
    triRef(e.R, e.K, tip, 'Jaw', ref);
    triRef(e.L, e.K, tip, 'Jaw', ref);
    triDir(P[0].L, P[0].R, P[0].K, 'Jaw', v(0, 0, -1));
  });

  // ------------------------------------------------------------------ eyes
  for (const side of [1, -1]) {
    withW(() => [[HEAD, 1]], () => {
      const cz = 0.73, cy = 0.12, R = 0.168, N = 8;
      const n = surfNormal(side, cz, cy);
      const c = surfRaw(side, cz, cy);
      const t1 = v(0, 1, 0).addScaledVector(n, -n.y).normalize();
      const t2 = v().crossVectors(n, t1).normalize();
      const ring = (rad, lift) => Array.from({ length: N }, (_, i) => {
        const a = ((i + 0.5) / N) * Math.PI * 2;
        return c.clone().addScaledVector(t1, Math.cos(a) * rad).addScaledVector(t2, Math.sin(a) * rad).addScaledVector(n, lift);
      });
      const r0 = ring(R * 1.06, -0.09), r1 = ring(R, 0.03), r2 = ring(R * 0.8, 0.038), r3 = ring(R * 0.46, 0.06);
      const top = c.clone().addScaledVector(n, 0.068);
      const ref = c.clone().addScaledVector(n, -0.12);
      for (let i = 0; i < N; i++) {
        const j = (i + 1) % N;
        quadRef(r0[i], r0[j], r1[j], r1[i], 'EyeRing', ref);
        quadRef(r1[i], r1[j], r2[j], r2[i], 'EyeRing', ref);
        quadRef(r2[i], r2[j], r3[j], r3[i], 'Eye', ref);
        triRef(r3[i], r3[j], top, 'Pupil', ref);
      }
    });
  }

  // ------------------------------------------------------------------ gill covers (raised plates on the cheeks)
  for (const side of [1, -1]) {
    const plate = (outline, lift) => {
      const top = outline.map(([z, y]) => surfPoint(side, z, y, lift));
      const base = outline.map(([z, y]) => surfPoint(side, z, y, -0.02));
      const cz = outline.reduce((s, p) => s + p[0], 0) / outline.length, cy = outline.reduce((s, p) => s + p[1], 0) / outline.length;
      const c = surfPoint(side, cz, cy, lift * 1.3), ref = v(0, cy, cz);
      for (let i = 0; i < outline.length; i++) {
        const j = (i + 1) % outline.length;
        triRef(c, top[i], top[j], 'Gill', ref);
        quadRef(top[i], top[j], base[j], base[i], 'Jaw', ref);
      }
    };
    withW(() => [[HEAD, 1]], () => {
      plate([[0.5, 0.03], [0.44, 0.2], [0.26, 0.27], [0.06, 0.17], [-0.07, -0.03], [0.0, -0.2], [0.22, -0.27], [0.46, -0.24]], 0.026);
      plate([[0.57, -0.08], [0.82, -0.1], [0.85, -0.19], [0.59, -0.23]], 0.02);
    });
  }

  // ------------------------------------------------------------------ spots
  // Candidates are laid out along the longest body the game allows and kept by distance from the
  // neck, so a spot stays where it is when the tail grows or is bitten off.
  for (const side of [1, -1]) {
    const sr = rng(seed * 1000 + (side > 0 ? 1 : 2));
    const srr = (a, b) => a + (b - a) * sr();
    const DMAX = SEG * 26 * 0.93, placed = [];
    for (let c = 0; c < 420 && placed.length < 84; c++) {
      const d = 0.12 + sr() * (DMAX - 0.12), vv = srr(0.14, 0.88), radN = srr(0.034, 0.075);
      const n = 5 + Math.floor(sr() * 2), a0 = sr() * 6.283;
      const jit = Array.from({ length: 6 }, () => [srr(-0.18, 0.18), srr(0.8, 1.2)]);
      if (placed.some((p) => Math.hypot((p.d - d) * 0.8, (p.vv - vv) * 0.9) < (p.radN + radN) * 1.9)) continue;
      placed.push({ d, vv, radN });
      if (d > 0.93 * L) continue;
      const u = d / L, z = -d, r = ringAt(z), y = r.Ly + (r.Uy - r.Ly) * vv;
      const rad = radN * Math.pow(hOf(u), 0.75), pts = [];
      for (let i = 0; i < n; i++) {
        const a = a0 + ((i + jit[i][0]) / n) * Math.PI * 2, q = rad * jit[i][1];
        const pz = z + Math.cos(a) * q * 1.3;
        const rp = ringAt(pz);
        const py = clamp(y + Math.sin(a) * q, rp.Ly + 0.012, rp.Uy - 0.012);
        pts.push(surfPoint(side, pz, py, 0.007));
      }
      const dir = v(side, 0, 0);
      for (let i = 1; i < n - 1; i++) triDir(pts[0], pts[i], pts[i + 1], 'Spots', dir);
    }
  }

  // ------------------------------------------------------------------ dorsal fin
  const finTone = (d) => { // a red band every 2.75 body-heights, by distance from the neck
    const m = ((d % 2.75) + 2.75) % 2.75, k = Math.min(m, 2.75 - m);
    return k < 0.37 ? 'FinRed' : k < 0.82 ? 'FinMid' : 'FinPink';
  };
  {
    const step = SEG / 4, z0 = -0.42, n = Math.round((L - 0.05 - 0.42) / step);
    const st = [];
    for (let j = 0; j <= n; j++) {
      const z = z0 - j * step, u = -z / L, r = ringAt(z);
      const s = (r.Ty - r.By);
      const d = 0.05 * s, x = Math.max((r.Ux * d) / (r.Ty - r.Uy), 0.006);
      const fh = finOf(u) * (j % 2 === 0 ? 1 : 0.84) * (j === n ? 0.7 : 1);
      st.push({ u, R: v(x, r.Ty - d, z), Lp: v(-x, r.Ty - d, z), top: v(0, r.Ty + fh, z - 0.36 * fh) });
    }
    for (let j = 0; j < n; j++) {
      const a = st[j], b = st[j + 1], m = finTone(((a.u + b.u) / 2) * L), f = j % 2 === 0;
      quadDir(a.R, b.R, b.top, a.top, m, v(1, 0, 0), f);
      quadDir(a.Lp, b.Lp, b.top, a.top, m, v(-1, 0, 0), f);
    }
    triDir(st[0].Lp, st[0].R, st[0].top, 'FinRed', v(0, 0, 1));
    triDir(st[n].Lp, st[n].R, st[n].top, 'FinPink', v(0, 0, -1));
  }

  // ------------------------------------------------------------------ crest (the long first dorsal rays)
  {
    const K = 5;
    const lens = [1.45, 1.85, 2.25, 2.55, 2.8, 2.55, 1.9];
    const NR = lens.length;
    const rays = [];
    for (let i = 0; i < NR; i++) {
      const zb = 0.62 - i * 0.17, len = lens[i];
      const alpha = (17 - i * 8.2) * DEG, kappa = (20 + i * 2.5) * DEG;
      const beta = (i % 2 === 0 ? 1 : -1) * 1.5 * DEG;
      const base = v(0, ringAt(zb).Ty - 0.04, zb);
      const pts = [base.clone()], es = [];
      const sub = 6, p = base.clone();
      for (let k = 0; k < K; k++) {
        for (let q = 0; q < sub; q++) {
          const s = (k + (q + 0.5) / sub) / K, a = alpha - kappa * Math.pow(s, 1.3);
          p.add(v(Math.sin(beta), Math.cos(a), Math.sin(a)).multiplyScalar(len / (K * sub)));
        }
        pts.push(p.clone());
      }
      for (let k = 0; k <= K; k++) {
        const a = alpha - kappa * Math.pow(k / K, 1.3);
        es.push(v(0, -Math.sin(a), Math.cos(a))); // in-plane normal of the ray, pointing forward
      }
      rays.push({ pts, es, zb });
      withW(() => wSpine(zb), () => {
        const mats = ['FinRed', 'FinMid', 'FinPink', 'FinPink', 'FinMid'];
        const sect = (k) => {
          const s = k / K, tx = lerp(0.042, 0.011, s), c = lerp(0.105, 0.02, s), q = pts[k], e = es[k];
          return [q.clone().addScaledVector(e, c), v(q.x + tx, q.y, q.z), q.clone().addScaledVector(e, -c), v(q.x - tx, q.y, q.z)];
        };
        for (let k = 0; k < K; k++) {
          const ref = pts[k].clone().add(pts[k + 1]).multiplyScalar(0.5);
          const A = sect(k);
          if (k === K - 1) {
            for (let c = 0; c < 4; c++) triRef(A[c], A[(c + 1) % 4], pts[K], mats[k], ref);
          } else {
            const B = sect(k + 1);
            for (let c = 0; c < 4; c++) quadRef(A[c], A[(c + 1) % 4], B[(c + 1) % 4], B[c], mats[k], ref);
          }
        }
        // little pennant near the tip of the longer rays
        if (len > 2.2) {
          const q = (s) => pts[3].clone().lerp(pts[4], s);
          const back = es[4].clone().negate();
          addPlate([q(0.15), q(0.55).addScaledVector(back, 0.2), q(0.95)], v(0.007, 0, 0), 'FinRed');
        }
      });
    }
    // low membrane tying the rays into one crown
    for (let i = 0; i < NR - 1; i++) {
      const a = rays[i], b = rays[i + 1];
      withW(() => wSpine((a.zb + b.zb) / 2), () => {
        addPlate([a.pts[0], a.pts[1], b.pts[1], b.pts[0]], v(0.007, 0, 0), 'FinMid');
      });
    }
  }

  // ------------------------------------------------------------------ pectoral fins
  const pectoral = {};
  for (const side of [1, -1]) {
    const zb = -0.13;
    const a1 = surfPoint(side, zb, -0.1, -0.01), a2 = surfPoint(side, zb, -0.27, -0.01);
    const bone = addBone(`pectoral_${side > 0 ? 'L' : 'R'}`, SP[0], a1.clone().add(a2).multiplyScalar(0.5));
    pectoral[side] = bone;
    const d = v(side * 0.7, -0.15, -1).normalize(), up = v(0, 1, 0);
    const nrm = v().crossVectors(d, up).normalize();
    const pts = [
      a1, a1.clone().addScaledVector(d, 0.26).addScaledVector(up, 0.09),
      a1.clone().addScaledVector(d, 0.6).addScaledVector(up, -0.04),
      a2.clone().addScaledVector(d, 0.3).addScaledVector(up, -0.09), a2,
    ];
    withW(() => [[bone, 1]], () => addPlate(pts, nrm.multiplyScalar(0.01), 'FinPale', 'FinPink'));
  }

  // ------------------------------------------------------------------ pelvic filaments (the "oars")
  const pelvic = {};
  for (const side of [1, -1]) {
    const NS = 8, NBF = 4, len = Math.min(4.5, L * 0.42);
    const base = v(side * 0.05, -0.47, -0.3);
    const d0 = v(side * 0.085, -0.13, -1).normalize();
    const at = (s) => base.clone().addScaledVector(d0, len * s).add(v(0, -0.2 * Math.sin(Math.PI * Math.pow(s, 0.8)), 0));
    const chain = [];
    for (let k = 0; k < NBF; k++) chain.push(addBone(`pelvic_${side > 0 ? 'L' : 'R'}_${String(k + 1).padStart(2, '0')}`, k === 0 ? SP[0] : chain[k - 1], at(k / NBF)));
    pelvic[side] = chain;
    const wFil = (p) => {
      const s = clamp(p.clone().sub(base).dot(d0) / len, 0, 1 - 1e-6) * NBF;
      const k = Math.floor(s), t = s - k;
      if (t < 0.5) return k === 0 ? [[chain[0], 1]] : [[chain[k], 0.5 + t], [chain[k - 1], 0.5 - t]];
      return k === NBF - 1 ? [[chain[k], 1]] : [[chain[k], 1.5 - t], [chain[k + 1], t - 0.5]];
    };
    withW(wFil, () => {
      const sect = (k) => {
        const s = k / NS, q = at(s), r = lerp(0.04, 0.02, s);
        return [0, 1, 2].map((i) => {
          const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
          return v(q.x + Math.cos(a) * r, q.y + Math.sin(a) * r, q.z);
        });
      };
      for (let k = 0; k < NS; k++) {
        const A = sect(k), B = sect(k + 1), ref = at((k + 0.5) / NS);
        const m = k < 2 ? 'FinRed' : k < 5 ? 'FinMid' : 'FinPink';
        for (let c = 0; c < 3; c++) quadRef(A[c], A[(c + 1) % 3], B[(c + 1) % 3], B[c], m, ref);
      }
      // paddles: a small one part-way, a bigger one at the tip
      const leaf = (s0, length, width, drop, mat, rim) => {
        const o = at(s0), dir = at(Math.min(s0 + 0.02, 1)).sub(at(s0 - 0.02)).normalize();
        const up = v(0, 1, 0).addScaledVector(dir, -dir.y).normalize();
        const P = (f, w) => o.clone().addScaledVector(dir, f * length).addScaledVector(up, w * width - drop);
        const pts = [P(0, 0.08), P(0.3, 0.5), P(0.7, 0.42), P(1, 0), P(0.72, -0.5), P(0.28, -0.42), P(0, -0.08)];
        addPlate(pts, v(0.011, 0, 0), mat, rim);
      };
      leaf(0.52, 0.34, 0.15, 0.05, 'FinMid', 'FinRed');
      leaf(0.985, 0.62, 0.24, 0, 'FinRed', 'FinRed');
    });
  }

  // ------------------------------------------------------------------ tail tip spines
  withW(() => [[SP[NB - 1], 1]], () => {
    const tail = rings[rings.length - 1], o = v(0, (tail.Ty + tail.By) / 2, tail.z + 0.03);
    const spec = [[62, 0.34, 'FinMid'], [34, 0.42, 'FinRed'], [8, 0.48, 'FinRed'], [-20, 0.4, 'FinMid'], [-46, 0.3, 'FinPink']];
    for (const [deg, len, mat] of spec) {
      const a = deg * DEG, d = v(0, Math.sin(a), -Math.cos(a)), e = v(0, Math.cos(a), Math.sin(a));
      addPlate([o.clone().addScaledVector(e, 0.03), o.clone().addScaledVector(d, len), o.clone().addScaledVector(e, -0.03)], v(0.008, 0, 0), mat);
    }
  });

  // ================================================================== assemble
  const matNames = Object.keys(PALETTE);
  const materials = matNames.map((name) => {
    if (sharedMaterials?.[name]) return sharedMaterials[name];
    const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(palette?.[name] || PALETTE[name]), roughness: 0.92, metalness: 0 });
    m.name = name;
    return m;
  });
  tris.sort((a, b) => matNames.indexOf(a.m) - matNames.indexOf(b.m));

  const nv = tris.length * 3;
  const pos = new Float32Array(nv * 3), si = new Uint16Array(nv * 4), sw = new Float32Array(nv * 4);
  let geo = new THREE.BufferGeometry();
  let gStart = 0, gMat = -1;
  tris.forEach((t, ti) => {
    const mi = matNames.indexOf(t.m);
    if (mi < 0) throw new Error('unknown material ' + t.m);
    if (mi !== gMat) {
      if (gMat >= 0) geo.addGroup(gStart, ti * 3 - gStart, gMat);
      gStart = ti * 3; gMat = mi;
    }
    for (let k = 0; k < 3; k++) {
      const i = ti * 3 + k;
      pos.set([t.p[k].x * scale, t.p[k].y * scale, t.p[k].z * scale], i * 3);
      const w = t.w[k].filter((e) => e[1] > 1e-4), sum = w.reduce((s, e) => s + e[1], 0);
      w.forEach((e, q) => { si[i * 4 + q] = e[0]; sw[i * 4 + q] = e[1] / sum; });
    }
  });
  geo.addGroup(gStart, nv - gStart, gMat);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  geo.computeVertexNormals(); // non-indexed → one normal per face (flat shading baked in)
  if (merge) {
    const groups = geo.groups.map((g) => ({ ...g }));
    geo = mergeVertices(geo, 1e-5);
    geo.clearGroups();
    groups.forEach((g) => geo.addGroup(g.start, g.count, g.materialIndex));
  }
  geo.name = 'Oarfish';
  geo.computeBoundingBox();
  geo.computeBoundingSphere();

  // The skinned mesh and the root bone sit side by side (glTF wants skinned meshes un-parented).
  const group = new THREE.Group();
  group.name = 'OarfishRoot';
  const tBones = bones.map((b) => { const o = new THREE.Bone(); o.name = b.name; return o; });
  bones.forEach((b, i) => {
    const p = b.pos.clone();
    if (b.parent >= 0) { p.sub(bones[b.parent].pos); tBones[b.parent].add(tBones[i]); }
    tBones[i].position.copy(p.multiplyScalar(scale));
  });
  group.add(tBones[ROOT]);
  const mesh = new THREE.SkinnedMesh(geo, materials);
  mesh.name = 'Oarfish';
  group.add(mesh);
  group.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(tBones);
  mesh.bind(skeleton);

  // ------------------------------------------------------------------ a looping swim cycle
  const clips = [];
  if (clip) {
    const T = 4, N = 48, times = Array.from({ length: N + 1 }, (_, i) => (i / N) * T);
    const q = new THREE.Quaternion(), e = new THREE.Euler();
    const tracks = [];
    const track = (name, fn) => {
      const vals = [];
      for (let i = 0; i <= N; i++) {
        const [rx, ry, rz] = fn(((i % N) / N) * Math.PI * 2);
        q.setFromEuler(e.set(rx, ry, rz, 'YXZ'));
        vals.push(q.x, q.y, q.z, q.w);
      }
      tracks.push(new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, times, vals));
    };
    const PH = 0.6;
    const amps = SP.map((_, k) => lerp(6, 19, Math.pow(k / (NB - 1), 0.9)) * DEG);
    const spineAngles = (ph) => {
      const th = amps.map((a, k) => a * Math.sin(ph - k * PH));
      // pivot the whole body at the neck so its mean line stays on the travel axis
      let heading = 0, x = 0, d = 0, sxd = 0, sdd = 0;
      for (let k = 0; k < NB; k++) {
        heading += th[k]; x += Math.sin(heading) * SEG; d += Math.cos(heading) * SEG;
        sxd += x * d; sdd += d * d;
      }
      th[0] -= Math.atan2(sxd, sdd);
      return th;
    };
    for (let k = 0; k < NB; k++) track(bones[SP[k]].name, (ph) => [0, spineAngles(ph)[k], 0]);
    track('head', (ph) => [0, 0.4 * spineAngles(ph)[0], 0]);
    track('jaw', (ph) => [3 * DEG * (0.5 + 0.5 * Math.sin(ph * 2)), 0, 0]);
    for (const side of [1, -1]) {
      track(bones[pectoral[side]].name, (ph) => [0, side * (10 + 12 * Math.sin(ph * 2 + 1)) * DEG, 0]);
      pelvic[side].forEach((b, k) => {
        track(bones[b].name, (ph) => [
          (k === 0 ? 4 : 5) * DEG * Math.sin(ph - 1.2 - k * 0.9 + side * 0.4),
          (k === 0 ? 5 : 9) * DEG * Math.sin(ph - 0.6 - k * 0.9),
          0,
        ]);
      });
    }
    clips.push(new THREE.AnimationClip('Swim', T, tracks));
  }

  return {
    group, mesh, rootBone: tBones[ROOT], skeleton, clips,
    stats: {
      triangles: tris.length,
      vertices: geo.attributes.position.count,
      bones: bones.length,
      materials: matNames.length,
      size: geo.boundingBox.getSize(new V3()).toArray().map((x) => +x.toFixed(3)),
    },
  };
}
