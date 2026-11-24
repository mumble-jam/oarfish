// Shells: the lost arms of the Long Ones, found again one at a time. A shell rides on a segment of the body.
// Worn, it changes what the fish can do. If its segment is bitten off, it is gone. If its segment is shed as
// bait, the bait takes the shell's other power. Nothing is kept between dives.

import * as THREE from 'three';
import { rng, glowTexture } from './geo.js';
import { mesher, ringY, alive, tint, dim } from './kit.js';
import { register, resolve } from './npc.js';

// worn: what it does while it rides on the body. shed: what the bait does when this shell goes with it.
export const SHELLS = {
  spire: { name: 'Spire', colour: '#f4e3c1', worn: 'Your dash carries half as far again.', shed: 'the bait bursts when a hunter reaches it.' },
  fan: { name: 'Fan', colour: '#f9cdd6', worn: 'You have half as much stamina again.', shed: 'your stamina refills and you surge away.' },
  coil: { name: 'Coil', colour: '#c9a877', worn: 'Dashes come back twice as fast and cost a third less.', shed: 'the bait swims off and takes its hunters with it.' },
  ring: { name: 'Ring', colour: '#e9dfc0', worn: 'A loop closes sooner: you need not go as far round.', shed: 'the bait calls twice as far and lasts twice as long.' },
  horn: { name: 'Horn', colour: '#ec7090', worn: 'Closing a loop stuns every hunter near you.', shed: 'hunters near the bait are stunned as it drops.' },
  cap: { name: 'Cap', colour: '#9fb8c4', worn: 'It takes the next bite for you, and breaks.', shed: 'the bait lasts three times as long, and anglers cannot swallow it.' },
  spine: { name: 'Spine', colour: '#d83c5f', worn: 'A biter that bites you dies of it.', shed: 'whatever reaches the bait dies.' },
  lamp: { name: 'Lamp', colour: '#ffd27a', worn: 'Your light reaches half as far again.', shed: 'the bait flares and dazzles every angler near it.' },
  tusk: { name: 'Tusk', colour: '#ffffff', worn: 'A ram breaks anglers too, and every ram feeds you more.', shed: 'each hunter that reaches the bait feeds you.' },
  pearl: { name: 'Pearl', colour: '#cfe6ff', worn: 'Every new segment costs a fifth less to grow.', shed: 'take the bait back before it fades and regain two segments.' },
};
export const SHELL_TYPES = Object.keys(SHELLS);
// Four kinds are not to be found until a feat has been done once, in any dive: after that they are in the pool for good, from the next dive on.
// The feats are the ones the murals count (world.js, MURAL): a band's greatest swarm taken, a cache opened, a keeper beaten, and a whole mural lit.
export const SHELL_FEATS = { spine: 'swarm', tusk: 'cache', horn: 'guard', pearl: 'mural' };
export const shellPool = (feats = {}) => SHELL_TYPES.filter((t) => !SHELL_FEATS[t] || feats[SHELL_FEATS[t]]);
export const SLOT_EVERY = 3; // one shell to every third segment

// what the worn shells add up to; two of a kind stack where that means anything
export function shellMods(worn) {
  const n = (t) => worn.reduce((k, s) => k + (s.type === t ? 1 : 0), 0);
  return {
    dashScale: 1 + 0.5 * n('spire'), stamina: 1 + 0.5 * n('fan'), dashCool: Math.pow(0.5, n('coil')), dashCost: Math.pow(2 / 3, n('coil')),
    sweep: Math.pow(0.9, n('ring')), shock: n('horn') > 0, thorns: n('spine') > 0, lamp: 1 + 0.5 * n('lamp'), tusk: n('tusk'), food: n('pearl') ? 0.8 : 1,
  };
}

// Each shell is a shell: the kind of animal that made it can be told from it. All stand on y = 0, about one unit tall.
const SHAPES = {
  // an auger: whorl on whorl up to a point, a dark mouth at the foot
  spire(c) { const m = mesher(), prof = [], shade = dim(c, 0.72), band = tint(c, '#d9925f', 0.5);
    for (let i = 0; i < 6; i++) { const y = i * 0.2, r = 0.42 * (1 - i / 6.6); prof.push([r * 0.8, y], [r, y + 0.07], [r * 0.86, y + 0.16]); }
    const rings = prof.map(([r, y], i) => ringY(y, r, 7, { turn: i * 0.12 })); rings.push(ringY(1.26, 0.012, 7));
    m.skin(rings, (i) => (i % 3 === 2 ? shade : i % 3 === 0 ? band : c)).cap(rings[0], [0, -1, 0], shade);
    m.quad([0.2, 0.02, 0.3], [0.36, 0.05, 0.14], [0.3, 0.2, 0.2], [0.16, 0.16, 0.34], '#3a2433');
    return m.geometry(); },
  // a scallop: ribs fanning from the hinge, the rim scalloped, two ears
  fan(c) { const m = mesher(), pale = tint(c, '#ffffff', 0.55), deep = dim(c, 0.7), hinge = [0, 0.08, 0], n = 10;
    const at = (i, r, z) => { const a = -1.2 + (i / n) * 2.4; return [Math.sin(a) * r, 0.08 + Math.cos(a) * r, z]; };
    for (const [face, z0, z1] of [[1, 0.13, 0.03], [-1, -0.1, -0.02]]) for (let i = 0; i < n; i++) {
      const tone = face > 0 ? (i % 2 ? c : pale) : deep, rim0 = at(i, 0.86 - (i % 2 ? 0.04 : 0), z1), rim1 = at(i + 1, 0.86 - (i % 2 ? 0 : 0.04), z1), m0 = at(i, 0.45, z0), m1 = at(i + 1, 0.45, z0);
      m.tri(hinge, m0, m1, tone).quad(m0, rim0, rim1, m1, face > 0 ? [tone, i % 2 ? pale : c, i % 2 ? pale : c] : tone); }
    for (const sx of [-1, 1]) m.tri([sx * 0.06, 0.02, 0], [sx * 0.34, 0.03, 0.02], [sx * 0.2, 0.26, 0.04], deep).tri([sx * 0.06, 0.02, 0], [sx * 0.2, 0.26, -0.04], [sx * 0.34, 0.03, -0.02], deep);
    return m.geometry(); },
  // a nautilus: the tube widening as it winds, striped across, the last chamber open
  coil(c) { const m = mesher(), stripe = '#8a5a3a', pale = tint(c, '#fff6e4', 0.6), pts = [], N = 13;
    for (let i = 0; i <= N; i++) { const a = i * 0.53, R = 0.11 * Math.exp(0.19 * a); pts.push([[-Math.cos(a) * R, 0.62 + Math.sin(a) * R, 0], R * 0.52]); }
    for (let i = 0; i < N; i++) m.limb(pts[i][0], pts[i + 1][0], pts[i][1], pts[i + 1][1], 6, i % 2 ? stripe : i > N - 4 ? pale : c);
    const e = N * 0.53; m.cap(m.last, [Math.sin(e), Math.cos(e), 0], ['#2a1a26', pale, pale], -0.14);
    return m.geometry(); },
  // the people's ring in small: a body closed on itself, segment by segment
  ring(c) { const m = mesher(), n = 12, shade = dim(c, 0.7);
    for (let i = 0; i < n; i++) { const a0 = (i / n) * Math.PI * 2 + 0.04, a1 = ((i + 1) / n) * Math.PI * 2 - 0.04, sec = (a, s) => [[0.12, 0], [0, 0.11], [-0.1, 0], [0, -0.11]].map(([r, z]) => [Math.cos(a) * (0.5 + r * s), 0.62 + Math.sin(a) * (0.5 + r * s), z * s]);
      m.skin([sec(a0, 0.8), sec((a0 + a1) / 2, 1.08), sec(a1, 0.8)], i % 3 ? c : shade); }
    for (let i = 0; i < 3; i++) m.limb([0.5 + 0.1, 0.62 + 0.1 - i * 0.1, 0], [0.5 + 0.34 - i * 0.05, 0.62 + 0.2 - i * 0.16, 0], 0.035, 0.004, 3, c); // the crest where the head is
    return m.geometry(); },
  // a horn shell, to be blown: ridged, bent, flaring to a lip that is pink inside
  horn(c) { const m = mesher(), pale = tint(c, '#fff6e4', 0.55), shade = dim(c, 0.72), spine = (t) => [0.34 - 0.62 * t + 0.1 * Math.sin(t * 3), 0.2 + 1.0 * t * t + 0.25 * t, 0.06 * Math.sin(t * 4)];
    for (let i = 0; i < 7; i++) { const t0 = i / 7, t1 = (i + 1) / 7, r0 = 0.3 * (1 - t0) + 0.02, r1 = 0.3 * (1 - t1) + 0.02; m.limb(spine(t0), spine(t1), r0 * (i % 2 ? 1 : 1.12), r1, 6, i % 2 ? shade : c); }
    const lip = [0, 1, 2, 3, 4, 5, 6].map((k) => { const a = (k / 7) * Math.PI * 2; return [0.34 + 0.12 + Math.cos(a) * 0.1, 0.2 - 0.04 + Math.sin(a) * 0.42 * 0.5 + 0.1, Math.cos(a + 1.57) * 0.42]; });
    m.cap(lip, [1, -0.5, 0], ['#f9cdd6', pale, pale], -0.2);
    return m.geometry(); },
  // a limpet: a low ribbed cone, off-centre at the top, worn pale along the ribs
  cap(c) { const m = mesher(), pale = tint(c, '#ffffff', 0.5), shade = dim(c, 0.68), base = ringY(0, 0.64, 14, { star: 0.88 }), mid = ringY(0.24, 0.36, 14, { star: 0.86, x: 0.03 });
    m.skin([base, mid], (i, k) => (k % 2 ? shade : c)).cap(mid, [0, 1, 0], [pale, c, shade], 0.26).cap(base, [0, -1, 0], '#3a4a55');
    m.skin([ringY(-0.03, 0.68, 14, { star: 0.9 }), base], shade);
    return m.geometry(); },
  // a murex: a small body, and a comb of spines down three sides of it
  spine(c) { const m = mesher(), body = tint(c, '#f4e3c1', 0.55), dark = dim(c, 0.6), prof = [[0.05, 0], [0.2, 0.2], [0.34, 0.46], [0.24, 0.62], [0.28, 0.72], [0.14, 0.9], [0.01, 1.08]];
    m.skin(prof.map(([r, y]) => ringY(y, r, 6)), (i) => (i % 2 ? body : tint(body, c, 0.4)));
    for (let v = 0; v < 3; v++) for (let j = 0; j < 4; j++) { const a = v * 2.094, y = 0.22 + j * 0.2, r = [0.22, 0.33, 0.26, 0.14][j], d = [Math.sin(a), 0.35, Math.cos(a)]; m.limb([d[0] * r, y, d[2] * r], [d[0] * (r + 0.36 - j * 0.04), y + 0.14, d[2] * (r + 0.36 - j * 0.04)], 0.05, 0.004, 3, [c, dark]); }
    m.limb([0, 0.02, 0], [0.12, -0.02, 0.32], 0.06, 0.02, 4, body); // the canal it breathes through
    return m.geometry(); },
  // a bubble shell thin enough to carry a light: every other panel lets it out
  lamp(c) { const m = mesher(), rings = [[0.1, 0.04], [0.34, 0.26], [0.4, 0.52], [0.3, 0.8], [0.1, 0.98]].map(([r, y]) => ringY(y, r, 8)), frame = '#8a6a3a';
    for (let i = 0; i < 4; i++) for (let k = 0; k < 8; k++) { const a = rings[i][k], b = rings[i][(k + 1) % 8], d = rings[i + 1][(k + 1) % 8], e = rings[i + 1][k], lit = (i + k) % 2 === 0 && i > 0 && i < 3;
      m.out(a, b, d, [0, 0.5, 0], lit ? c : frame, lit).out(a, d, e, [0, 0.5, 0], lit ? c : frame, lit); }
    m.cap(rings[0], [0, -1, 0], frame).cap(rings[4], [0, 1, 0], frame, 0.1);
    return m.geometry(); },
  // a tusk shell: long, bent, banded finely, open at the broad end
  tusk(c) { const m = mesher(), band = '#d8d2c4', spine = (t) => [0.08 * Math.sin(t * 1.4), 0.06 + 0.5 * t - 0.12 * t * t, 0.1 + 1.25 * t - 0.2 * t * t - 0.5];
    for (let i = 0; i < 7; i++) m.limb(spine(i / 7), spine((i + 1) / 7), 0.19 * (1 - i / 7.6), 0.19 * (1 - (i + 1) / 7.6), 6, i % 2 ? band : c);
    m.cap(ringY(0, 0.17, 6).map((p) => [p[0], 0.06 + p[2] * 0.4, -0.4 + p[1]]), [0, 0, -1], '#6f6a60');
    return m.geometry(); },
  // an oyster standing open, and what it made
  pearl(c) { const m = mesher(), out = '#8fa6c4', outDark = '#6d83a0', nacre = '#eef4ff';
    const valve = (open, k) => { const lip = Array.from({ length: 9 }, (_, i) => { const a = -1.35 + (i / 8) * 2.7, d = 0.62 * (1 - 0.06 * (i % 2)); return turnX([Math.sin(a) * d, 0, Math.cos(a) * d + 0.1], open); }), belly = lip.map((p) => turnX([p[0] * 0.55, 0, 0], 0)).map((p, i) => turnX([Math.sin(-1.35 + (i / 8) * 2.7) * 0.34, -0.2 * k, 0.3], open)), hinge = [0, 0.06, -0.28];
      for (let i = 0; i < 8; i++) m.tri(hinge, belly[i], belly[i + 1], i % 2 ? out : outDark).quad(belly[i], lip[i], lip[i + 1], belly[i + 1], i % 2 ? outDark : out).tri(hinge, lip[i + 1], lip[i], [nacre, '#d6e2f5', '#d6e2f5']); };
    const turnX = (p, a) => [p[0], 0.06 + p[1] * Math.cos(a) + (p[2] + 0.28) * Math.sin(a), -0.28 + (p[2] + 0.28) * Math.cos(a) - p[1] * Math.sin(a)];
    valve(0.06, 1); valve(1.05, -1);
    m.add(new THREE.IcosahedronGeometry(0.19, 1), new THREE.Matrix4().makeTranslation(0, 0.24, 0.08), c, true);
    return m.geometry(); },
};

// Each shell is a component: it can be seen, recoloured and resized in the specimen library, and what is chosen there is
// what the game makes. The colour is also the shell's mark on the scale bar and the stripe on its message.
const DEFAULTS = Object.fromEntries(SHELL_TYPES.map((t) => [t, SHELLS[t].colour]));
for (const t of SHELL_TYPES) register({ id: `shell-${t}`, group: 'Shells', kind: 'shell', name: SHELLS[t].name, length: 1.2, fixed: false, baked: true,
  role: `Worn: ${SHELLS[t].worn}`, about: `Shed with the segment it rides on, ${SHELLS[t].shed}`, palette: { colour: DEFAULTS[t] }, build: (pal) => SHAPES[t](pal.colour), show: { scale: 1.15, n: 1, lift: 0.9, spin: true } });
export const shellMaterial = () => alive(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide, emissive: '#ffffff', emissiveIntensity: 0.16 }), { glow: 0.9 });

// One set of meshes for the whole game: the geometry of each shell, and the material they share.
export function createShellKit() {
  const geo = {}, size = {};
  // (re)make every shell as its component now stands. The geometries stay the same objects, so shells already lying
  // about or riding on the body change with them
  function refresh() {
    for (const t of SHELL_TYPES) { const look = resolve(`shell-${t}`), g = SHAPES[t](look.palette.colour); SHELLS[t].colour = look.palette.colour; size[t] = look.scale;
      if (geo[t]) { geo[t].dispose(); geo[t].copy(g); g.dispose(); } else geo[t] = g; }
  }
  refresh();
  const material = shellMaterial();
  const glow = glowTexture();
  return {
    geo, material, glow, refresh,
    mesh(type, scale = 1) { const m = new THREE.Mesh(geo[type], material); m.scale.setScalar(scale * size[type]); m.frustumCulled = false; return m; },
    dispose() { for (const t of SHELL_TYPES) geo[t].dispose(); material.dispose(); glow.dispose(); },
  };
}

// Where the i-th shell of a band lies, before anything standing pushes it aside: drawn from the field's own run of numbers (`rand`).
//   world: { spawn, wrap, goal, rift (with in(x, z)), hall }; the world being built hands these over before it is finished (world.js, the quiet side)
export function shellSpot(rand, i, floor, world) {
  const rr = (a, b) => a + (b - a) * rand(), start = world.spawn, wrapD = world.wrap;
  let x = 0, z = 0;
  for (let t = 0; t < 30; t++) { // not in the rift, not in the hall, not on top of the start
    const a = rr(0, Math.PI * 2), d = i === 0 && floor === 0 ? rr(13, 18) : rr(16, 48);
    x = start.x + Math.sin(a) * d; z = start.z + Math.cos(a) * d;
    const g = world.goal, h = world.hall;
    if (Math.hypot(wrapD(x - g.x), wrapD(z - g.z)) < 11 || (world.rift && world.rift.in(x, z) > -3)) continue;
    if (h && Math.hypot(wrapD(x - h.x), wrapD(z - h.z)) < h.R + 5) continue;
    break;
  }
  return [x, z];
}
// Where every shell of a band will lie, without making any: the same numbers in the same order as createShellField (a spot, then the kind it
// picks, then its phase), so that what the world builds can keep clear of them (world.js keeps the quiet side's stonework three metres off).
export function shellSpots(world, { seed = 1, floor = 0, count = 3 } = {}) {
  const rand = rng(seed * 53 + floor * 173 + 29);
  return Array.from({ length: count }, (_, i) => { const p = shellSpot(rand, i, floor, world); rand(); rand(); return p; });
}

// The shells lying about one band. Swim the head over one to take it.
export function createShellField(scene, world, kit, { seed = 1, floor = 0, count = 3, types = SHELL_TYPES } = {}) {
  const rand = rng(seed * 53 + floor * 173 + 29), rr = (a, b) => a + (b - a) * rand();
  const T = world.size, wrapD = world.wrap, start = world.spawn; // how far across the world is, the shortest way round it, and where the dive begins in it: all the world's own
  const items = [], spriteMats = [];
  const pool = [...types]; // the kinds that may lie about in this dive
  function drop(x, z, type, lift = 1.2) {
    const group = new THREE.Group(), mesh = kit.mesh(type, 1.15);
    const mat = new THREE.SpriteMaterial({ map: kit.glow, color: SHELLS[type].colour, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true, opacity: 0.7 });
    const halo = new THREE.Sprite(mat); halo.scale.setScalar(3.2); halo.position.y = 0.5;
    spriteMats.push(mat);
    group.add(mesh, halo); scene.add(group);
    const it = { type, group, mesh, x, z, y: world.height(x, z) + lift, ph: rand() * 6.28, taken: false };
    items.push(it);
    return it;
  }
  for (let i = 0; i < count; i++) {
    const [x, z] = shellSpot(rand, i, floor, world);
    const p = new THREE.Vector3(x, world.height(x, z) + 1.2, z); world.pushOut(p, 1.2);
    drop(p.x, p.z, pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  }
  return {
    items, drop,
    update(dt, focus, time) {
      for (const it of items) {
        if (it.taken) continue;
        const x = it.x + T * Math.round((focus.x - it.x) / T), z = it.z + T * Math.round((focus.z - it.z) / T); // on the nearest copy of the world
        it.group.position.set(x, it.y + 0.18 * Math.sin(time * 1.6 + it.ph), z);
        it.mesh.rotation.y = time * 0.9 + it.ph;
      }
    },
    // the shell under the head, if there is one
    at(pos) {
      for (const it of items) if (!it.taken && Math.hypot(wrapD(pos.x - it.x), wrapD(pos.z - it.z)) < 1.15 && Math.abs(pos.y - it.y - 0.4) < 1.5) return it;
      return null;
    },
    take(it) { it.taken = true; scene.remove(it.group); },
    dispose() { for (const it of items) scene.remove(it.group); for (const m of spriteMats) m.dispose(); },
  };
}
