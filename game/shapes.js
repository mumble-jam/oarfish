// What hits what. The shapes the game judges by, and a way to draw them over the picture.
// George played the Keeper and was 'almost certain that the hit model and the actual model are not quite the same'. They were not: blows hit
// discs, legs were judged from above, and the fish was a row of points. So everything that hits, or is hit, or is solid, is one of three shapes,
// worked in the world's space, and what is drawn over the picture by the testing tool is the same list the fight judges by:
//   cap    a capsule: every point within `r` of the segment a..b. A fish's body is a chain of these, a leg two (three, once it is tall), a claw one.
//   prism  a capsule's footprint stood up: within `r` of a..b seen from above, between y0 and y0 + h. A blow that comes down out of the water onto
//          the bed (the great claw) hits what is anywhere under it, and this is what it sweeps through.
//   ell    an ellipsoid: centre c, radii rx, ry, rz, turned `yaw` about the vertical. The Keeper's shell.
// Each shape also says what it is (`role`): fish, solid, leg (with `live`: can it be hurt now), blow (with `hot`: this is the strike, not the wind-up).
import * as THREE from 'three';
import { clamp } from './geo.js';

const D = new THREE.Vector3(), E = new THREE.Vector3(), R = new THREE.Vector3(), P = new THREE.Vector3(), Q = new THREE.Vector3(), C1 = new THREE.Vector3(), C2 = new THREE.Vector3();

// the nearest point to p on the segment a..b, into out; returns how far along (0..1)
export function onSeg(p, a, b, out) { D.subVectors(b, a); const l2 = D.lengthSq(), t = l2 > 1e-12 ? clamp(P.subVectors(p, a).dot(D) / l2, 0, 1) : 0; out.copy(a).addScaledVector(D, t); return t; }
// the nearest pair of points on two segments, into ca and cb; returns the distance between them
export function segSeg(a0, a1, b0, b1, ca = C1, cb = C2) {
  D.subVectors(a1, a0); E.subVectors(b1, b0); R.subVectors(a0, b0);
  const a = D.dot(D), e = E.dot(E), f = E.dot(R); let s, t;
  if (a < 1e-12 && e < 1e-12) { s = t = 0; }
  else if (a < 1e-12) { s = 0; t = clamp(f / e, 0, 1); }
  else { const c = D.dot(R); if (e < 1e-12) { t = 0; s = clamp(-c / a, 0, 1); } else { const b = D.dot(E), den = a * e - b * b; s = den > 1e-12 ? clamp((b * f - c * e) / den, 0, 1) : 0; t = (b * s + f) / e; if (t < 0) { t = 0; s = clamp(-c / a, 0, 1); } else if (t > 1) { t = 1; s = clamp((b - c) / a, 0, 1); } } }
  ca.copy(a0).addScaledVector(D, s); cb.copy(b0).addScaledVector(E, t); return ca.distanceTo(cb);
}
// the same, seen from above (y left out); returns the distance on the map, and the two points (with their real heights)
export function segSeg2(a0, a1, b0, b1, ca = C1, cb = C2) {
  const y = [a0.y, a1.y, b0.y, b1.y]; a0.y = a1.y = b0.y = b1.y = 0; const d = segSeg(a0, a1, b0, b1, ca, cb);
  const ta = a1.distanceToSquared(a0) > 1e-12 ? ca.distanceTo(a0) / a1.distanceTo(a0) : 0, tb = b1.distanceToSquared(b0) > 1e-12 ? cb.distanceTo(b0) / b1.distanceTo(b0) : 0;
  [a0.y, a1.y, b0.y, b1.y] = y; ca.y = y[0] + (y[1] - y[0]) * ta; cb.y = y[2] + (y[3] - y[2]) * tb; return d;
}

// ---------------------------------------------------------------- the fish
// Its body, as oarfish.js builds it (scale 0.4): half as tall as it is at the neck, tapering to the tail. A capsule along each length of spine, as
// wide as the body is there, the average of its height and its breadth (it is a ribbon on edge: half-height 0.2 m at the neck, half-breadth 0.1).
// The head is one more, from the neck to the tip of the snout.
const HEIGHT = [[0, 1.0], [0.06, 1.06], [0.3, 1.0], [0.55, 0.88], [0.75, 0.66], [0.9, 0.38], [1, 0.07]], BREADTH = [[0, 0.48], [0.06, 0.5], [0.3, 0.44], [0.6, 0.33], [0.85, 0.19], [1, 0.04]];
const along = (k, u) => { let i = 0; while (i < k.length - 2 && k[i + 1][0] < u) i++; const [u0, a] = k[i], [u1, b] = k[i + 1]; return a + (b - a) * clamp((u - u0) / (u1 - u0), 0, 1); };
export const FISH = { scale: 0.4, head: 0.15, least: 0.03 };
export const fishRadius = (u) => Math.max(FISH.least, FISH.scale * (along(HEIGHT, u) + along(BREADTH, u)) / 4); // u: 0 at the neck, 1 at the tip of the tail
// the fish's body as capsules: { t: 'cap', a, b, r, j, role: 'fish' }; j is the joint at the back of that length (0 for the head)
export function fishBody(rig, out = []) {
  const J = rig.joints, N = J.length - 1, L = rig.length || 1;
  while (out.length < N + 1) out.push({ t: 'cap', a: new THREE.Vector3(), b: new THREE.Vector3(), r: 0, j: 0, role: 'fish' });
  out.length = N + 1;
  out[0].a.copy(rig.snout); out[0].b.copy(J[0]); out[0].r = FISH.head; out[0].j = 0;
  for (let k = 0; k < N; k++) { const s = out[k + 1]; s.a.copy(J[k]); s.b.copy(J[k + 1]); s.r = fishRadius(((rig.cum ? (rig.cum[k] + rig.cum[k + 1]) / 2 : (k + 0.5) * L / N)) / L); s.j = k + 1; }
  return out;
}

// ---------------------------------------------------------------- meeting
const L1 = new THREE.Vector3(), L2 = new THREE.Vector3(), M1 = new THREE.Vector3();
// how far apart a shape and a capsule (a..b, radius r) are: below zero, they overlap by that much
export function gap(s, a, b, r) {
  if (s.t === 'cap') return segSeg(s.a, s.b, a, b, L1, L2) - s.r - r;
  if (s.t === 'prism') { const d = segSeg2(s.a, s.b, a, b, L1, L2); const y = L2.y, below = s.y0 - (y + r), above = y - r - (s.y0 + s.h); return Math.max(d - s.r - r, below, above); }
  if (s.t === 'ell') { let least = 1e9; for (const k of [0, 0.25, 0.5, 0.75, 1]) { M1.lerpVectors(a, b, k); least = Math.min(least, ellGap(s, M1, r)); } return least; }
  return 1e9;
}
// how far a point (with radius r) is outside an ellipsoid, roughly in metres (exact on its axes)
function ellGap(s, p, r) { const c = Math.cos(s.yaw || 0), n = Math.sin(s.yaw || 0), dx = p.x - s.c.x, dz = p.z - s.c.z, lx = dx * c - dz * n, lz = dx * n + dz * c, ly = p.y - s.c.y;
  const k = Math.hypot(lx / s.rx, ly / s.ry, lz / s.rz); if (k < 1e-6) return -Math.min(s.rx, s.ry, s.rz) - r; const near = Math.min(s.rx, s.ry, s.rz), far = Math.max(s.rx, s.ry, s.rz); return (k - 1) * clamp(Math.hypot(lx, ly, lz) / k, near, far) - r; }
// which part of a body a shape takes: the part nearest the tail among those it meets (a dash carries the head clear, not what trails). -1: none
export function struck(shape, body, slack = 0) { let best = -1; for (const c of body) if (c.j > best && gap(shape, c.a, c.b, c.r) < slack) best = c.j; return best; }
// Turn a point (with radius r) out of a solid shape. Returns true if it moved. A capsule pushes straight out from its line; an ellipsoid out along
// the line from its middle, scaled, which is smooth everywhere but the very middle (nothing gets there).
export function pushOut(s, p, r) {
  if (s.t === 'cap') { onSeg(p, s.a, s.b, Q); const d = p.distanceTo(Q), want = s.r + r; if (d >= want) return false; if (d < 1e-6) { p.y += want; return true; } p.sub(Q).multiplyScalar(want / d).add(Q); return true; }
  if (s.t === 'ell') { const c = Math.cos(s.yaw || 0), n = Math.sin(s.yaw || 0), dx = p.x - s.c.x, dz = p.z - s.c.z, lx = dx * c - dz * n, lz = dx * n + dz * c, ly = p.y - s.c.y, rx = s.rx + r, ry = s.ry + r, rz = s.rz + r;
    const k = Math.hypot(lx / rx, ly / ry, lz / rz); if (k >= 1) return false; if (k < 1e-6) { p.y = s.c.y + ry; return true; }
    const ox = lx / k, oy = ly / k, oz = lz / k; p.set(s.c.x + ox * c + oz * n, s.c.y + oy, s.c.z - ox * n + oz * c); return true; }
  return false;
}

// ---------------------------------------------------------------- drawing them
// Lines over the picture, drawn last and through everything, so a shape inside a shell still shows. Colours say what each is.
export const SHAPE_COLOURS = { fish: '#5ff2ff', solid: '#ffffff', live: '#7dff6a', leg: '#9a8fa8', blow: '#ffb84a', hot: '#ff3355' };
export function createShapeView(scene, most = 24000) {
  const pos = new Float32Array(most * 3), col = new Float32Array(most * 3), geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, depthWrite: false, transparent: true, opacity: 0.9, fog: false, toneMapped: false });
  const lines = new THREE.LineSegments(geo, mat); lines.frustumCulled = false; lines.renderOrder = 999; lines.visible = false; scene.add(lines);
  const tint = new THREE.Color(), U = new THREE.Vector3(), V = new THREE.Vector3(), W = new THREE.Vector3(), A = new THREE.Vector3(), B = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  let n = 0;
  const seg = (a, b) => { if (n + 2 > most) return; pos.set([a.x, a.y, a.z, b.x, b.y, b.z], n * 3); col.set([tint.r, tint.g, tint.b, tint.r, tint.g, tint.b], n * 3); n += 2; };
  // a ring about `c` in the plane of u and v (both unit), radius r
  const ring = (c, u, v, r, k = 14) => { for (let i = 0; i < k; i++) { const a0 = (i / k) * 6.2832, a1 = ((i + 1) / k) * 6.2832; A.copy(c).addScaledVector(u, Math.cos(a0) * r).addScaledVector(v, Math.sin(a0) * r); B.copy(c).addScaledVector(u, Math.cos(a1) * r).addScaledVector(v, Math.sin(a1) * r); seg(A, B); } };
  const frame = (a, b) => { W.subVectors(b, a); if (W.lengthSq() < 1e-10) W.set(0, 0, 1); W.normalize(); U.crossVectors(Math.abs(W.y) > 0.95 ? D.set(1, 0, 0) : UP, W).normalize(); V.crossVectors(W, U); };
  function cap(s) { frame(s.a, s.b); const r = s.r, u = U.clone(), v = V.clone(), w = W.clone();
    ring(s.a, u, v, r); ring(s.b, u, v, r); if (s.a.distanceTo(s.b) > r * 0.6) for (const [x, y] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { A.copy(s.a).addScaledVector(u, x * r).addScaledVector(v, y * r); B.copy(s.b).addScaledVector(u, x * r).addScaledVector(v, y * r); seg(A, B); }
    ring(E.copy(s.a).addScaledVector(w, -r * 0.7), u, v, r * 0.7, 10); ring(E.copy(s.b).addScaledVector(w, r * 0.7), u, v, r * 0.7, 10); } // the round ends, as a smaller ring past each
  // a capsule's footprint at one height: two straight sides and two half circles
  function outline(a, b, r, y) { A.set(a.x, y, a.z); B.set(b.x, y, b.z); W.subVectors(B, A).setY(0); if (W.lengthSq() < 1e-10) W.set(0, 0, 1); W.normalize(); U.set(W.z, 0, -W.x); const a0 = A.clone(), b0 = B.clone();
    for (const sd of [1, -1]) seg(E.copy(a0).addScaledVector(U, sd * r), M1.copy(b0).addScaledVector(U, sd * r));
    for (const [c, sgn] of [[a0, -1], [b0, 1]]) for (let i = 0; i < 8; i++) { const t0 = (i / 8) * Math.PI - Math.PI / 2, t1 = ((i + 1) / 8) * Math.PI - Math.PI / 2; E.copy(c).addScaledVector(W, sgn * Math.cos(t0) * r).addScaledVector(U, Math.sin(t0) * r); M1.copy(c).addScaledVector(W, sgn * Math.cos(t1) * r).addScaledVector(U, Math.sin(t1) * r); seg(E, M1); } }
  function prism(s) { outline(s.a, s.b, s.r, s.y0); outline(s.a, s.b, s.r, s.y0 + s.h); if (s.h > 0.05) { W.subVectors(s.b, s.a).setY(0); if (W.lengthSq() < 1e-10) W.set(0, 0, 1); W.normalize(); U.set(W.z, 0, -W.x);
    for (const [p, k] of [[s.a, -1], [s.b, 1]]) for (const o of [[0, 1], [0, -1], [k, 0]]) { A.set(p.x, s.y0, p.z).addScaledVector(W, o[0] * s.r).addScaledVector(U, o[1] * s.r); B.copy(A).setY(s.y0 + s.h); seg(A, B); } } }
  function ell(s) { const c = Math.cos(s.yaw || 0), sn = Math.sin(s.yaw || 0), X = new THREE.Vector3(c, 0, -sn), Z = new THREE.Vector3(sn, 0, c), k = 20;
    const ellRing = (f) => { for (let i = 0; i < k; i++) { const p = (t) => { const a = (t / k) * 6.2832; return f(Math.cos(a), Math.sin(a)); }; seg(p(i), p(i + 1)); } };
    ellRing((x, y) => A.copy(s.c).addScaledVector(X, x * s.rx).addScaledVector(Z, y * s.rz).clone());
    ellRing((x, y) => A.copy(s.c).addScaledVector(X, x * s.rx).setY(s.c.y + y * s.ry).clone());
    ellRing((x, y) => A.copy(s.c).addScaledVector(Z, x * s.rz).setY(s.c.y + y * s.ry).clone());
    for (const h of [-0.6, 0.6]) { const q = Math.sqrt(1 - h * h); ellRing((x, y) => A.copy(s.c).addScaledVector(X, x * s.rx * q).addScaledVector(Z, y * s.rz * q).setY(s.c.y + h * s.ry).clone()); } }
  // a fan: the slice of a ring between angles a0 and a1 (round from +z, as yaw is), r0 to r1 from c, between y0 and y0 + h (the old sweep)
  function fan(s) { const at = (a, r, y) => E.set(s.c.x + Math.sin(a) * r, y, s.c.z + Math.cos(a) * r).clone(), k = 12;
    for (const y of [s.y0, s.y0 + s.h]) { for (let i = 0; i < k; i++) { const a0 = s.a0 + (s.a1 - s.a0) * i / k, a1 = s.a0 + (s.a1 - s.a0) * (i + 1) / k; seg(at(a0, s.r1, y), at(a1, s.r1, y)); seg(at(a0, s.r0, y), at(a1, s.r0, y)); }
      seg(at(s.a0, s.r0, y), at(s.a0, s.r1, y)); seg(at(s.a1, s.r0, y), at(s.a1, s.r1, y)); }
    for (const a of [s.a0, s.a1, (s.a0 + s.a1) / 2]) seg(at(a, s.r1, s.y0), at(a, s.r1, s.y0 + s.h)); }
  function draw(list) {
    n = 0;
    for (const s of list) { tint.set(SHAPE_COLOURS[s.role === 'leg' ? (s.live ? 'live' : 'leg') : s.role === 'blow' ? (s.hot ? 'hot' : 'blow') : s.role] || '#ffffff');
      if (s.t === 'cap') cap(s); else if (s.t === 'prism') prism(s); else if (s.t === 'ell') ell(s); else if (s.t === 'fan') fan(s); }
    geo.setDrawRange(0, n); geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
  }
  return { draw, get on() { return lines.visible; }, set on(v) { lines.visible = !!v; }, lines, dispose() { scene.remove(lines); geo.dispose(); mat.dispose(); } };
}
