// Concepts: creatures that are not in the dive yet, built with the same kit as those that are (kit.js: flat triangles, a colour at each
// corner, faces that give off their own light), so that a picture of one is a picture of how it would really look there.
// Nothing in the game imports this. `node tools/shot_concepts.mjs` photographs them in the bands they are meant for, the fish beside
// them for size. Each is posed as the water would hold it: what trails, trails; what grips, grips.
//   the Mason     an octopus, a rift's keeper. It builds a den of column drums, wears jars, and passes for a column until it moves
//   the Bloom     moon jellies, a drifting curtain to thread a body through       the Lantern   a deep jelly with a light hunters keep out of
//   the Chain     a siphonophore as long as the fish: a rival body                the Darts     small squid, a shoal that jets backward out of a closing loop
//   the Thief     a bobtail squid that makes off with a shell                     the Pack      big squid that flash before they strike, two long arms out
import * as THREE from 'three';
import { mesher, ringZ, ringY, alive, dim, tint } from './kit.js';

const CREAM = '#fff6e4', INK = '#241833', EYE = '#eaff7c';
const hull = (m, secs, paint, n = 6) => m.skin(secs.map(([z, w, up, dn = up, y = 0, x = 0]) => ringZ(z, w, up, dn, y, n, x)), paint);
const skin = (opts = {}) => alive(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, flatShading: true, emissive: '#ffffff', emissiveIntensity: 0.1, ...opts }), { glow: 1 });
const part = (m, opts) => { const mesh = new THREE.Mesh(m.geometry(), skin(opts)); mesh.castShadow = !opts || !opts.transparent; mesh.receiveShadow = true; return mesh; };
// a limb that follows a line of points, thinning from r0 to r1
const tube = (m, pts, r0, r1, colours, n = 5, glow = false) => { for (let i = 0; i + 1 < pts.length; i++) { const a = i / (pts.length - 1), b = (i + 1) / (pts.length - 1); m.limb(pts[i], pts[i + 1], r0 + (r1 - r0) * a, r0 + (r1 - r0) * b, n, colours, glow); } return m; };
const turnY = (p, a, at = [0, 0, 0]) => { const c = Math.cos(a), s = Math.sin(a); return [at[0] + p[0] * c + p[2] * s, at[1] + p[1], at[2] - p[0] * s + p[2] * c]; };

// ---------------------------------------------------------------- the Mason
// one arm, from where it leaves the web: out along the bed and curling at the tip; `lift` raises its middle, `reach` straightens it
function arm(m, a, { long = 3.2, curl = 2.4, lift = 0, reach = 0, thick = 0.2, y0 = 0.62 }, top, under) {
  const pts = [], N = 12;
  for (let i = 0; i <= N; i++) { const s = i / N, r = 0.42 + long * s * (1 - 0.3 * s * (1 - reach)), ang = a + curl * s * s * s * (1 - reach);
    pts.push([Math.sin(ang) * r, 0.1 + (y0 - 0.1) * (1 - s) * (1 - s) + lift * Math.sin(Math.PI * Math.min(1, s * 1.15)) + 0.05 * Math.sin(s * 9 + a), 0.35 + Math.cos(ang) * r]); }
  tube(m, pts, thick, 0.025, [top, dim(top, 0.82)]);
  for (let i = 1; i < N; i += 1) { const p = pts[i], q = pts[i + 1], r = thick * (1 - i / N) + 0.03, dx = q[0] - p[0], dz = q[2] - p[2], l = Math.hypot(dx, dz) || 1, nx = -dz / l * r * 0.5, nz = dx / l * r * 0.5; // suckers: a pale pair under each stretch
    for (const k of [-1, 1]) m.tri([p[0] + nx * k, p[1] - r * 0.95, p[2] + nz * k], [p[0] + nx * k + dx * 0.35, p[1] - r * 0.95, p[2] + nz * k + dz * 0.35], [p[0] + nx * k * 2.1 + dx * 0.18, p[1] - r * 0.55, p[2] + nz * k * 2.1 + dz * 0.18], under); }
  return pts;
}
const jar = (m, at, size, clay, band) => { const prof = [[0, 0.16], [0.22, 0.4], [0.55, 0.46], [0.82, 0.26], [0.95, 0.3]], rings = prof.map(([y, r]) => ringY(at[1] + y * size, r * size, 8, { x: at[0], z: at[2] }));
  m.skin(rings, (i) => (i === 1 ? band : i % 2 ? clay : dim(clay, 0.86))).cap(rings[0], [0, -1, 0], dim(clay, 0.7)); };
const drum = (m, at, r, h, stone, tilt = 0) => { const lo = ringY(0, r, 10, { star: 0.93 }), hi = ringY(h, r * 0.96, 10, { star: 0.93 }), put = (ring) => ring.map((p) => { const c = Math.cos(tilt), s = Math.sin(tilt); return [at[0] + p[0], at[1] + p[1] * c - p[2] * s, at[2] + p[1] * s + p[2] * c]; });
  const A = put(lo), B = put(hi); m.skin([A, B], (i, k) => (k % 2 ? stone : dim(stone, 0.88))).cap(B, [0, 1, 0], tint(stone, '#ffffff', 0.15)).cap(A, [0, -1, 0], dim(stone, 0.7)); };
// hidden: true, it is the colour of the stone it sits among, its arms wound in under it
export function mason({ tone = '#b9577a', stone = '#9aa6a0', hidden = false } = {}) {
  const g = new THREE.Group(), m = mesher(), top = hidden ? stone : tone, flank = hidden ? dim(stone, 0.85) : dim(tone, 0.8), under = hidden ? tint(stone, '#ffffff', 0.25) : '#f1d9cf', mottle = hidden ? dim(stone, 0.72) : tint(tone, INK, 0.45);
  const paint = (i, k, n) => (k === 0 || k === n - 1 ? top : k === n / 2 - 1 || k === n / 2 ? under : (i * 2 + k) % 3 === 0 ? mottle : flank);
  // the mantle: a sack, carried high and behind; and the head under the front of it
  const back = [[0.3, 0.36, 0.3, 0.3, 0.98], [-0.1, 0.64, 0.56, 0.46, 1.14], [-0.7, 0.84, 0.74, 0.56, 1.3], [-1.3, 0.66, 0.58, 0.46, 1.24], [-1.75, 0.22, 0.2, 0.16, 1.12]];
  hull(m, back, paint, 8); m.cap(ringZ(-1.75, 0.22, 0.2, 0.16, 1.12, 8), [0, 0, -1], flank);
  hull(m, [[0.78, 0.3, 0.24, 0.24, 0.7], [0.4, 0.52, 0.4, 0.34, 0.82], [-0.05, 0.54, 0.42, 0.36, 0.92]], paint, 8); m.cap(ringZ(0.78, 0.3, 0.24, 0.24, 0.7, 8), [0, 0, 1], under);
  for (const s of [1, -1]) { // eyes on turrets, with the level slit an octopus has; a brow horn over each
    m.limb([s * 0.3, 1.0, 0.42], [s * 0.44, 1.42, 0.36], 0.19, 0.15, 6, [top, flank]);
    m.eye([s * 0.57, 1.36, 0.4], [s * 0.9, 0.25, 0.3], 0.13, { iris: EYE, glow: !hidden, slit: true });
    m.limb([s * 0.4, 1.5, 0.34], [s * 0.5, 1.72, 0.26], 0.05, 0.004, 3, [flank, top]);
    m.limb([s * 0.5, 0.86, 0.1], [s * 0.82, 0.8, -0.05], 0.13, 0.09, 5, [flank, under]); // the funnel, one each side for the look of it
  }
  // the web between the arms, and the arms
  const web = ringY(0.5, 0.95, 8, { z: 0.35 }), hub = ringY(0.78, 0.4, 8, { z: 0.35 }); m.skin([hub, web], (i, k) => (k % 2 ? flank : mottle));
  const poses = hidden
    ? Array.from({ length: 8 }, (_, i) => ({ long: 1.5, curl: 4.6, thick: 0.19 }))
    : [{ long: 3.4, curl: 1.9 }, { long: 3.0, curl: 0.3, lift: 1.5, reach: 0.75, thick: 0.22 }, { long: 3.3, curl: -2.2 }, { long: 2.6, curl: 2.8, lift: 0.5 }, { long: 3.1, curl: -2.6 }, { long: 2.5, curl: 0.2, lift: 1.25, reach: 0.6 }, { long: 3.4, curl: 2.2 }, { long: 3.2, curl: -1.6 }];
  const tips = poses.map((p, i) => arm(m, (i + 0.5) / 8 * Math.PI * 2, p, top, under));
  g.add(part(m));
  if (!hidden) { // what it wears and what it has built: two jars held up as shields, and a den of column drums behind it
    const props = mesher(), clay = '#c98a5a';
    for (const i of [1, 5]) { const t = tips[i][10]; jar(props, [t[0], t[1] - 0.25, t[2]], 0.95, clay, tone); }
    drum(props, [-0.9, 0, -2.6], 0.7, 1.1, stone); drum(props, [0.75, 0, -2.75], 0.7, 1.1, stone); drum(props, [-0.1, 1.1, -2.7], 0.72, 1.0, stone, 0.12); drum(props, [1.9, 0.35, -2.0], 0.62, 1.0, stone, 1.45); jar(props, [-1.9, 0, -1.7], 0.8, clay, tone);
    props.quad([-0.35, 0.02, -2.02], [0.25, 0.02, -2.02], [0.2, 0.95, -2.1], [-0.3, 0.95, -2.1], INK); // the way in
    g.add(part(props));
  }
  return g;
}

// ---------------------------------------------------------------- jellies
const bell = (m, at, r, h, n, colours, { skirt = 0.9, glow = false } = {}) => { const o = { x: at[0], z: at[2] }, rings = [ringY(at[1] + h, r * 0.16, n, o), ringY(at[1] + h * 0.82, r * 0.58, n, o), ringY(at[1] + h * 0.42, r * 0.93, n, o), ringY(at[1], r, n, { ...o, star: skirt })];
  m.skin(rings, (i, k) => colours[(i + k) % colours.length], glow).cap(rings[0], [0, 1, 0], colours[0], 0.02, glow); return rings; };
// one moon jelly, drifting toward +x: its fringe and its four frilled arms swept back
function moon(m, core, at, r, sweep) {
  bell(m, at, r, r * 0.62, 12, ['#dfeaf2', '#c9d9ec', '#eef4f8']);
  for (let i = 0; i < 4; i++) { const a = i / 4 * 6.283 + 0.4, x = at[0] + Math.sin(a) * r * 0.36, z = at[2] + Math.cos(a) * r * 0.36, y = at[1] + r * 0.4; // the four rings seen through the bell: they glow
    tube(core, Array.from({ length: 7 }, (_, k) => { const b = k / 6 * 5.2; return [x + Math.sin(b) * r * 0.16, y, z + Math.cos(b) * r * 0.16]; }), 0.022 * r / 0.45, 0.022 * r / 0.45, ['#ff9fc0', '#ffd0e0'], 3, true); }
  for (let i = 0; i < 4; i++) { const a = i / 4 * 6.283, p = [at[0] + Math.sin(a) * r * 0.2, at[1] + r * 0.12, at[2] + Math.cos(a) * r * 0.2]; core.fin([p, [p[0] - sweep * 0.2, p[1] - r * 0.5, p[2]], [p[0] - sweep * 0.7, p[1] - r * 0.95, p[2]]], [[p[0] + 0.1 * r, p[1] - 0.1, p[2] + 0.12 * r], [p[0] - sweep * 0.3 + 0.14 * r, p[1] - r * 0.55, p[2] + 0.1 * r], [p[0] - sweep * 0.8, p[1] - r * 1.1, p[2] + 0.05]], ['#f3dbe6', '#e6c6d8']); }
  for (let i = 0; i < 18; i++) { const a = i / 18 * 6.283, p = [at[0] + Math.sin(a) * r * 0.97, at[1], at[2] + Math.cos(a) * r * 0.97], l = r * (0.5 + 0.25 * ((i * 7) % 5) / 4); tube(m, [p, [p[0] - sweep * 0.25, p[1] - l * 0.5, p[2]], [p[0] - sweep * 0.7, p[1] - l, p[2]]], 0.012, 0.003, ['#dfeaf2', '#b9cfe8'], 3); }
}
export function bloom() {
  const g = new THREE.Group(), m = mesher(), core = mesher(); let s = 5;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 13; i++) moon(m, core, [(rnd() - 0.5) * 1.6, 0.6 + (i % 5) * 0.62 + rnd() * 0.3, (i - 6) * 0.78 + (rnd() - 0.5) * 0.3], 0.3 + rnd() * 0.2, 0.45); // a curtain across the way, hung at every height
  g.add(part(core), part(m, { transparent: true, opacity: 0.62, depthWrite: false })); return g;
}
export function lantern({ tone = '#7a2f52' } = {}) {
  const g = new THREE.Group(), m = mesher(), core = mesher(), h = 1.0, r = 0.5;
  // a tall helmet, dark outside so that its light does not give it away from above; the light is inside, and shows from under and through the groove
  const o = {}, rings = [ringY(1.55 + h, 0.05, 12, o), ringY(1.55 + h * 0.6, r * 0.62, 12, o), ringY(1.55 + h * 0.3, r * 0.7, 12, o), ringY(1.55 + h * 0.26, r * 0.96, 12, o), ringY(1.55, r, 12, { star: 0.8 })];
  m.skin(rings, (i, k) => (i === 2 ? dim(tone, 0.55) : k % 2 ? tone : dim(tone, 0.8)));
  bell(core, [0, 1.6, 0], 0.3, 0.75, 8, ['#ffd98a', '#fff1c4', '#ffbe6a'], { glow: true });
  for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283, p = [Math.sin(a) * r * 0.9, 1.6, Math.cos(a) * r * 0.9]; // it carries its tentacles stiff, up and out ahead of it, as the helmet jellies do
    tube(m, [p, [p[0] * 1.5, 1.95, p[2] * 1.5], [p[0] * 1.7, 2.6, p[2] * 1.7], [p[0] * 1.45, 3.15, p[2] * 1.45]], 0.035, 0.006, [tone, tint(tone, '#ffd98a', 0.5)], 3); }
  for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * 6.283; core.limb([Math.sin(a) * 0.22, 1.55, Math.cos(a) * 0.22], [Math.sin(a) * 0.3, 1.2, Math.cos(a) * 0.3], 0.05, 0.01, 3, ['#ffd98a', '#ffbe6a'], true); }
  const pool = new THREE.Mesh(new THREE.CircleGeometry(3.2, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffd98a', transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false })); pool.position.y = 0.3; pool.renderOrder = 1; // the light it keeps, on the bed under it
  g.add(part(core), part(m, { transparent: true, opacity: 0.72 }), pool); return g;
}
// a body in a line, as the fish is: a float, two rows of swimming bells, and then the long stem with what it feeds and stings with hung along it
export function chain({ tone = '#e88aa0' } = {}) {
  const g = new THREE.Group(), m = mesher(), core = mesher(), at = (s) => [Math.sin(s * 0.85) * 1.15, 1.9 + 0.3 * Math.sin(s * 0.6 + 1), -s], N = 44, L = 7.6;
  const stem = Array.from({ length: N + 1 }, (_, i) => at(i / N * L)); tube(core, stem, 0.075, 0.035, [tone, tint(tone, '#ffffff', 0.4)], 4, true);
  bell(m, [stem[0][0], stem[0][1] - 0.08, stem[0][2] + 0.22], 0.2, 0.42, 8, ['#ffe9c9', '#ffd0a0']); // the float
  for (let i = 0; i < 12; i++) { const p = stem[1 + i], side = i % 2 ? 1 : -1, q = stem[2 + i], dx = q[0] - p[0], dz = q[2] - p[2], l = Math.hypot(dx, dz) || 1, nx = -dz / l * side, nz = dx / l * side; // the bells, mouths outward and back
    const c = [p[0] + nx * 0.2, p[1], p[2] + nz * 0.2]; m.skin([ringZ(0, 0.05, 0.05, 0.05, 0, 6), ringZ(-0.16, 0.19, 0.19, 0.19, 0, 6), ringZ(-0.36, 0.14, 0.14, 0.14, 0, 6)].map((ring) => ring.map((v) => turnY([v[0], v[1], v[2]], Math.atan2(nx * 0.8 - dx / l, nz * 0.8 - dz / l) + Math.PI, c))), ['#f4e4ee', '#e4cfe4']); }
  for (let i = 14; i < N; i += 2) { const p = stem[i], k = (i * 7) % 5; // along the stem: a mouth, a glowing bead, and a stinging line that trails
    core.limb(p, [p[0] + 0.12, p[1] - 0.22, p[2] - 0.05], 0.05, 0.02, 4, ['#ffd98a', tone], true);
    tube(m, [p, [p[0] - 0.1, p[1] - 0.5 - 0.1 * k, p[2] - 0.25], [p[0] - 0.05, p[1] - 0.95 - 0.16 * k, p[2] - 0.7]], 0.012, 0.003, [tint(tone, '#ffffff', 0.5), tone], 3); }
  g.add(part(core), part(m, { transparent: true, opacity: 0.7, depthWrite: false })); return g;
}

// ---------------------------------------------------------------- squid
// a squid, nose (the point of the mantle) toward -z as it jets, arms trailing toward +z. size: mantle length
function squid(m, at, yaw, size, { top, flank, belly, fin = 0.5, wide = 0.2, eye = 0.07, arms = 0.5, long = 0, spread = 0.12, glow = false, round = false }) {
  const P = (x, y, z) => turnY([x * size, y * size, z * size], yaw, at), paint = (i, k, n) => (k === 0 || k === n - 1 ? top : k === n / 2 - 1 || k === n / 2 ? belly : flank);
  const secs = round ? [[-0.5, 0.06, 0.06], [-0.34, wide * 0.8, wide * 0.75], [0.05, wide, wide * 0.95], [0.4, wide * 0.8, wide * 0.7], [0.52, wide * 0.5, wide * 0.45]] : [[-0.5, 0.012, 0.012], [-0.2, wide * 0.62, wide * 0.6], [0.2, wide, wide * 0.92], [0.5, wide * 0.86, wide * 0.8]];
  m.skin(secs.map(([z, w, u]) => ringZ(z, w, u, u, 0, 8).map((v) => P(v[0], v[1], v[2]))), paint, glow);
  m.skin([[0.5, wide * 0.6, wide * 0.55], [0.72, wide * 0.52, wide * 0.5]].map(([z, w, u]) => ringZ(z, w, u, u, 0, 8).map((v) => P(v[0], v[1], v[2]))), [flank, belly]); // the head
  for (const s of [1, -1]) {
    if (round) m.fin([P(s * wide * 0.8, 0.02, -0.1), P(s * wide * 0.85, 0.02, 0.15)], [P(s * (wide + fin * 0.5), 0.1, -0.12), P(s * (wide + fin * 0.5), 0.1, 0.12)], [top, flank]); // two round ears
    else m.fin([P(0, 0.02, -0.5), P(s * wide * 0.5, 0.02, -0.26), P(s * wide * 0.7, 0.02, -0.02)], [P(s * 0.03, 0.02, -0.52), P(s * fin, 0.02, -0.3), P(s * wide * 0.8, 0.02, 0)], [top, flank]); // the diamond at the nose
    const e = P(s * wide * 0.56, 0.02, 0.62), n = turnY([s, 0.2, 0.1], yaw); m.eye(e, n, eye * size, { iris: EYE, glow: true });
  }
  for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283, c = Math.cos(a), sn = Math.sin(a); tube(m, [P(sn * wide * 0.4, c * wide * 0.4, 0.72), P(sn * (wide * 0.4 + spread * 0.5), c * (wide * 0.4 + spread * 0.5), 0.72 + arms * 0.5), P(sn * (wide * 0.3 + spread), c * (wide * 0.3 + spread), 0.72 + arms)], 0.045 * size, 0.006 * size, [flank, belly], 3, glow); }
  if (long) for (const s of [1, -1]) { tube(m, [P(s * 0.05, 0, 0.72), P(s * 0.12, 0.02, 0.72 + long * 0.5), P(s * 0.1, 0, 0.72 + long)], 0.03 * size, 0.02 * size, [flank, belly], 3, glow); // the two long arms, a club at the end of each
    m.skin([[0.72 + long, 0.03, 0.03, 0.03, 0, s * 0.1], [0.72 + long + 0.1, 0.085, 0.05, 0.05, 0, s * 0.1], [0.72 + long + 0.26, 0.01, 0.01, 0.01, 0, s * 0.1]].map(([z, w, u, d, y, x]) => ringZ(z, w, u, d, y, 5, x).map((v) => P(v[0], v[1], v[2]))), [belly, CREAM], glow); }
}
// a shoal, all jetting the same way, nose first, in the wedge small squid keep
export function darts({ tone = '#7fc7d9' } = {}) {
  const g = new THREE.Group(), m = mesher(); let i = 0;
  for (const [x, z] of [[0, -1.2], [-0.5, -0.6], [0.5, -0.6], [-1.0, 0], [0, 0], [1.0, 0], [-1.5, 0.6], [-0.5, 0.6], [0.5, 0.6], [1.5, 0.6], [-1.0, 1.2], [1.0, 1.2]]) { i++;
    squid(m, [x, 1.5 + 0.18 * Math.sin(i * 2.3), z], 0.08 * Math.sin(i * 1.7), 0.42, { top: tone, flank: tint(tone, '#ffffff', 0.35), belly: CREAM, fin: 0.26, wide: 0.17, eye: 0.085, arms: 0.42, spread: 0.02 }); }
  g.add(part(m)); return g;
}
// round, big-eyed, two ears for fins; and it has a shell, held in all its arms
export function thief({ tone = '#d98a4a', shell = '#f2d9a0' } = {}) {
  const g = new THREE.Group(), m = mesher();
  squid(m, [0, 1.3, 0], 0, 1.0, { top: tone, flank: tint(tone, '#ffffff', 0.25), belly: CREAM, fin: 0.42, wide: 0.36, eye: 0.13, arms: 0.42, spread: 0.2, round: true });
  const prize = [ringZ(0.95, 0.22, 0.22, 0.22, 1.3, 7), ringZ(1.15, 0.2, 0.2, 0.2, 1.3, 7), ringZ(1.38, 0.13, 0.13, 0.13, 1.3, 7), ringZ(1.6, 0.02, 0.02, 0.02, 1.3, 7)]; m.skin(prize, (i, k) => (k % 2 ? shell : dim(shell, 0.82))).cap(prize[0], [0, 0, -1], dim(shell, 0.6)); // a spire shell, point outward
  g.add(part(m)); return g;
}
// three of them, coming on arms first as a squid strikes: one lit pale, which is the flash before the blow; the long arms of the nearest are out
export function pack({ tone = '#b33a3a' } = {}) {
  const g = new THREE.Group(), m = mesher(), lit = mesher(), look = (c) => ({ top: c, flank: tint(c, '#ffffff', 0.2), belly: tint(c, CREAM, 0.6), fin: 0.3, wide: 0.19, eye: 0.06, arms: 0.4 });
  squid(m, [0, 1.6, 0], Math.PI, 2.0, { ...look(tone), spread: 0.16, long: 0.85 });
  squid(m, [-1.9, 2.0, -1.7], Math.PI + 0.25, 1.8, { ...look(dim(tone, 0.85)), spread: 0.06 });
  squid(lit, [1.8, 1.8, -2.1], Math.PI - 0.3, 1.8, { ...look('#ffe9e0'), spread: 0.1, glow: true });
  g.add(part(m), part(lit)); return g;
}

export const CONCEPTS = [
  { id: 'mason', name: 'The Mason', role: 'Octopus. Keeper of a rift: builds a den, wears jars, grabs with its arms.', band: 2, build: () => mason(), far: 12, high: 6.5 },
  { id: 'mason-hidden', name: 'The Mason, hidden', role: 'Arms wound in, the colour of stone: it passes for a fallen column drum until it moves.', band: 2, build: () => mason({ hidden: true }), far: 9, high: 5 },
  { id: 'bloom', name: 'The Bloom', role: 'Moon jellies. A drifting curtain to thread the body through: the fringe costs stamina.', band: 0, build: bloom, far: 13, high: 5.5 },
  { id: 'lantern', name: 'The Lantern', role: 'Deep jelly. Hunters keep out of its light; it drifts toward the rift.', band: 3, build: () => lantern(), far: 10, high: 5 },
  { id: 'chain', name: 'The Chain', role: 'Siphonophore, as long as the fish: a rival body that tries to wrap you.', band: 3, build: () => chain(), far: 11.5, high: 5.6, turn: 2.5, fish: [3.2, 4.6] },
  { id: 'darts', name: 'The Darts', role: 'Small squid. A shoal that jets backward out of a closing loop.', band: 1, build: () => darts(), far: 9, high: 5 },
  { id: 'thief', name: 'The Thief', role: 'Bobtail squid. Makes off with a shell from your tail.', band: 1, build: () => thief(), far: 7, high: 3.6 },
  { id: 'pack', name: 'The Pack', role: 'Big squid. One flashes pale before they strike, long arms first.', band: 3, build: () => pack(), far: 10.5, high: 5, turn: 2.2, fish: [3.4, 4.8] },
];
