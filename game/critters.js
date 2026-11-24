// The animals of the dive, modelled the way the oarfish is: a skin over cross-sections, back darker than belly,
// fins of rays, eyes with pupils, teeth. Head toward +z, back toward +y, the animal's left toward +x.
// Each function returns one geometry; self-lit faces (eyes, photophores, lures) are marked in it.
// Every colour comes in as `pal`, the animal's palette: the palettes themselves, and everything else about how each
// one looks and moves, are its component in npc.js. Nothing here should be called from the game directly.

import * as THREE from 'three';
import { mesher, ringZ, ringY, shaded, tint, dim, bright } from './kit.js';

const CREAM = '#fff6e4';
// a skin through [z, half-width, up, down, lift] sections
const hull = (m, secs, paint, n = 6) => m.skin(secs.map(([z, w, up, dn = up, y = 0]) => ringZ(z, w, up, dn, y, n)), paint);
const tooth = (m, at, to, r = 0.016, colour = CREAM) => m.limb(at, to, r, 0.001, 3, colour);
const both = (fn) => { fn(1); fn(-1); };

// ---------------------------------------------------------------- the small fish of the swarms, one kind to a depth
// White, to be tinted by its swarm: the back takes a cool shadow, the belly stays pale. `kind`:
//   0 sprat (the two bands with light)  1 lanternfish, lights along its belly (the twilight)  2 a pale ghost of the palace
export function swarmFish(kind, pal) {
  const m = mesher(), deep = kind === 1, back = pal.back, flank = bright(kind === 2 ? 0.86 : 1), belly = bright(1.2), stripe = kind === 0 ? pal.stripe : flank;
  const secs = deep
    ? [[0.15, 0.012, 0.02, 0.022], [0.11, 0.034, 0.052, 0.05], [0.04, 0.04, 0.066, 0.07], [-0.05, 0.03, 0.05, 0.052], [-0.12, 0.013, 0.024, 0.024], [-0.155, 0.005, 0.013, 0.013]]
    : [[0.16, 0.004, 0.008, 0.008], [0.11, 0.022, 0.034, 0.03], [0.04, 0.034, 0.058, 0.056], [-0.05, 0.03, 0.052, 0.052], [-0.12, 0.014, 0.025, 0.025], [-0.155, 0.005, 0.013, 0.013]];
  hull(m, secs, (i, k, n) => (k === 0 || k === n - 1 ? back : k === 2 || k === 3 ? belly : i > 0 && i < 4 ? stripe : flank));
  m.fin([[0, 0.012, -0.15], [0, 0, -0.155], [0, -0.012, -0.15]], [[0, 0.09, -0.275], [0, 0, -0.2], [0, -0.09, -0.275]], [bright(0.85), bright(0.7)]);
  m.tri([0, 0.054, 0.03], [0, 0.105, -0.035], [0, 0.05, -0.085], back);
  m.tri([0, -0.05, -0.04], [0, -0.085, -0.09], [0, -0.04, -0.1], bright(0.8));
  both((s) => { m.tri([s * 0.03, -0.012, 0.07], [s * 0.065, -0.05, 0.0], [s * 0.03, -0.035, 0.03], bright(0.8));
    m.tri([s * 0.026, 0.02, 0.118], [s * 0.031, 0.034, 0.1], [s * 0.031, 0.01, 0.098], '#14121c'); // the eye
    if (deep) for (let i = 0; i < 4; i++) m.tri([s * 0.03, -0.045, 0.075 - i * 0.045], [s * 0.031, -0.03, 0.06 - i * 0.045], [s * 0.031, -0.05, 0.05 - i * 0.045], pal.lights, true); // photophores
    if (kind === 2) m.tri([s * 0.034, 0.008, 0.08], [s * 0.031, 0.008, -0.1], [s * 0.034, -0.004, -0.02], pal.line, true); // the line down its side
  });
  return m.geometry();
}

// ---------------------------------------------------------------- the cleaner wrasse, which keeps a cleaning station
// The real one (Labroides dimidiatus) is a finger long, pale blue going to yellow at the head, with one black stripe from the eye that widens
// all the way to the tail. Here the stripe is what is seen from across the reef, and the pale back is lit a little for the dark bands.
export function cleaner(pal) {
  const m = mesher(), { front, rear, stripe, belly, fin, tip } = pal;
  hull(m, [[0.12, 0.004, 0.006, 0.006], [0.098, 0.013, 0.018, 0.016], [0.066, 0.019, 0.026, 0.024], [0.03, 0.021, 0.03, 0.028], [-0.01, 0.02, 0.029, 0.027], [-0.05, 0.016, 0.023, 0.022], [-0.082, 0.009, 0.014, 0.014], [-0.1, 0.005, 0.011, 0.011]],
    (i, k, n) => (k === 2 || k === 3 ? belly : k === 0 || k === n - 1 ? (i < 3 ? front : rear) : stripe));
  m.tri([0, 0.011, -0.098], [0, 0.04, -0.15], [0, 0, -0.135], [stripe, tip, stripe], true).tri([0, -0.011, -0.098], [0, 0, -0.135], [0, -0.04, -0.15], [stripe, stripe, tip], true); // the tail: a blunt fan, the stripe running out to its edge
  m.tri([0, 0.028, 0.03], [0, 0.044, -0.04], [0, 0.022, -0.08], [rear, fin, fin], true); // the back fin, long and low
  both((s) => { m.tri([s * 0.02, -0.006, 0.06], [s * 0.046, -0.02, 0.03], [s * 0.021, -0.016, 0.04], fin);
    m.tri([s * 0.013, 0.01, 0.094], [s * 0.017, 0.019, 0.083], [s * 0.017, 0.004, 0.082], '#14121c'); }); // the eye
  return m.geometry();
}

// ---------------------------------------------------------------- the pilot fish, which keeps the oarfish company
// The real one (Naucrates ductor) is bluish with six or seven broad dark bars and white tips to the lobes of its tail, and
// goes about beside sharks. Here the tips are lit, so that in the dark bands it is two small lights at the fish's side.
export function pilot(pal) {
  const m = mesher(), { back, flank, bar, belly, fin, tip } = pal;
  hull(m, [[0.2, 0.005, 0.009, 0.009], [0.165, 0.022, 0.034, 0.03], [0.115, 0.034, 0.052, 0.05], [0.065, 0.039, 0.062, 0.06], [0.01, 0.04, 0.064, 0.062], [-0.045, 0.036, 0.056, 0.056], [-0.095, 0.027, 0.042, 0.042], [-0.14, 0.014, 0.024, 0.024], [-0.175, 0.006, 0.013, 0.013]],
    (i, k, n) => (k === 2 || k === 3 ? belly : i % 2 ? bar : k === 0 || k === n - 1 ? back : flank));
  // a forked tail, the lobes tipped white
  for (const up of [1, -1]) { const root = [0, up * 0.011, -0.172], mid = [0, 0, -0.2], out = [0, up * 0.085, -0.265], end = [0, up * 0.105, -0.3];
    m.tri(root, mid, out, fin).tri(mid, out, [0, up * 0.03, -0.235], fin).tri(out, end, [0, up * 0.07, -0.285], tip, true); }
  m.tri([0, 0.06, 0.02], [0, 0.092, -0.05], [0, 0.05, -0.12], [fin, fin, tip]); // the back fin, long and low
  m.tri([0, -0.058, -0.03], [0, -0.084, -0.08], [0, -0.045, -0.12], [fin, fin, tip]);
  both((s) => { m.tri([s * 0.036, -0.012, 0.085], [s * 0.075, -0.04, 0.03], [s * 0.037, -0.03, 0.05], fin);
    m.tri([s * 0.024, 0.02, 0.158], [s * 0.03, 0.035, 0.14], [s * 0.03, 0.011, 0.138], '#14121c'); }); // the eye
  return m.geometry();
}

// ---------------------------------------------------------------- the tail-biter: a deep-chested thing with an underbite
export function biter(pal) {
  const m = mesher(), { back, flank, bar, belly, fins: red, finDark: redDark, jaw: dark } = pal;
  hull(m, [[0.44, 0.014, 0.022, 0.022, -0.02], [0.36, 0.06, 0.075, 0.06, -0.01], [0.24, 0.1, 0.14, 0.12], [0.08, 0.125, 0.2, 0.18], [-0.1, 0.11, 0.17, 0.15], [-0.26, 0.06, 0.09, 0.08], [-0.36, 0.025, 0.045, 0.045]],
    (i, k, n) => (k === 0 || k === n - 1 ? back : k === 2 || k === 3 ? belly : i === 2 || i === 4 ? bar : flank));
  // the lower jaw, longer than the upper, and the teeth that give it its name
  hull(m, [[0.47, 0.012, 0.012, 0.012, -0.085], [0.37, 0.055, 0.022, 0.035, -0.125], [0.2, 0.075, 0.03, 0.045, -0.15]], dark, 4);
  m.quad([-0.05, -0.075, 0.38], [0.05, -0.075, 0.38], [0.07, -0.115, 0.22], [-0.07, -0.115, 0.22], '#3d1830');
  for (const [x, z, l] of [[0, 0.455, 0.07], [0.04, 0.41, 0.075], [-0.04, 0.41, 0.075], [0.058, 0.33, 0.06], [-0.058, 0.33, 0.06]]) tooth(m, [x, -0.105, z], [x * 0.9, -0.105 + l, z + 0.01]);
  for (const [x, z, l] of [[0.035, 0.385, 0.06], [-0.035, 0.385, 0.06], [0.06, 0.29, 0.055], [-0.06, 0.29, 0.055]]) tooth(m, [x, -0.055, z], [x, -0.055 - l, z + 0.012]);
  m.fin([[0, 0.185, 0.14], [0, 0.2, 0.04], [0, 0.19, -0.06], [0, 0.15, -0.16], [0, 0.11, -0.23]], [[0, 0.25, 0.08], [0, 0.38, -0.05], [0, 0.35, -0.15], [0, 0.25, -0.23], [0, 0.13, -0.27]], [redDark, red]);
  m.fin([[0, 0.045, -0.35], [0, 0, -0.36], [0, -0.045, -0.35]], [[0, 0.26, -0.63], [0, 0, -0.47], [0, -0.26, -0.63]], [red, redDark]);
  m.fin([[0, -0.15, -0.06], [0, -0.1, -0.22]], [[0, -0.29, -0.2], [0, -0.15, -0.29]], red);
  both((s) => { m.fin([[s * 0.11, -0.03, 0.12], [s * 0.115, -0.11, 0.06]], [[s * 0.23, -0.1, -0.06], [s * 0.15, -0.2, -0.02]], [red]);
    m.tri([s * 0.105, 0.1, 0.19], [s * 0.118, -0.06, 0.16], [s * 0.116, 0.02, 0.13], dark); // the gill
    m.eye([s * 0.079, 0.055, 0.285], [s, 0.2, 0.35], 0.034, { iris: pal.eye, glow: true, slit: true }); });
  return m.geometry();
}

// ---------------------------------------------------------------- the angler, and at three times the size the Lamplighter
// the lure itself is the game's to light: the rod ends at rodTip
export const ANGLER_ROD = [0, 0.98, 0.84];
export function angler(pal, big = false) {
  const m = mesher(), { back, skin, wart, belly, gum, fins, finTip } = pal;
  hull(m, [[0.6, 0.2, 0.08, 0.07, 0.14], [0.5, 0.42, 0.26, 0.17, 0.1], [0.25, 0.56, 0.46, 0.4, 0.04], [-0.05, 0.56, 0.5, 0.46], [-0.32, 0.4, 0.36, 0.32], [-0.52, 0.2, 0.18, 0.16], [-0.62, 0.07, 0.08, 0.08]],
    (i, k, n) => (k === 0 || k === n - 1 ? back : k === n / 2 - 1 || k === n / 2 ? belly : (i * 3 + k) % 4 === 0 ? wart : skin), 8);
  // the mouth: a scoop of a lower jaw, the dark behind the teeth, and the teeth, long and uneven
  hull(m, [[0.74, 0.16, 0.03, 0.05, -0.12], [0.52, 0.42, 0.04, 0.13, -0.25], [0.2, 0.52, 0.06, 0.16, -0.36]], (i, k, n) => (k === 0 || k === n - 1 ? '#3b3558' : skin), 6);
  m.quad([-0.36, 0.0, 0.52], [0.36, 0.0, 0.52], [0.4, -0.24, 0.5], [-0.4, -0.24, 0.5], gum).quad([-0.2, 0.06, 0.6], [0.2, 0.06, 0.6], [0.36, 0.0, 0.52], [-0.36, 0.0, 0.52], gum);
  const upper = big ? 9 : 7, lower = big ? 8 : 6;
  for (let i = 0; i < upper; i++) { const u = i / (upper - 1) - 0.5, x = u * 0.62, z = 0.62 - Math.abs(u) * 0.2, l = 0.1 + 0.09 * ((i * 5) % 3) / 2; tooth(m, [x, 0.02 - Math.abs(u) * 0.06, z], [x * 1.05, 0.02 - Math.abs(u) * 0.06 - l, z + 0.03], 0.022); }
  for (let i = 0; i < lower; i++) { const u = i / (lower - 1) - 0.5, x = u * 0.7, z = 0.7 - Math.abs(u) * 0.36, l = 0.15 + 0.12 * ((i * 7) % 3) / 2; tooth(m, [x, -0.2 - Math.abs(u) * 0.03, z], [x * 0.95, -0.2 + l, z + 0.02], 0.024); }
  m.fin([[0, 0.08, -0.6], [0, 0, -0.62], [0, -0.08, -0.6]], [[0, 0.34, -1.02], [0, 0, -0.9], [0, -0.34, -1.02]], [fins, finTip]);
  m.fin([[0, 0.48, -0.1], [0, 0.4, -0.3], [0, 0.26, -0.46]], [[0, 0.62, -0.26], [0, 0.56, -0.44], [0, 0.34, -0.56]], [finTip, fins]);
  both((s) => { m.fin([[s * 0.5, -0.02, -0.02], [s * 0.52, -0.16, -0.1], [s * 0.48, -0.26, -0.06]], [[s * 0.88, 0.1, -0.34], [s * 0.86, -0.12, -0.36], [s * 0.74, -0.3, -0.26]], [fins, finTip]);
    m.eye([s * 0.38, 0.27, 0.38], [s, 0.45, 0.5], 0.05, { iris: pal.eye, glow: true }); });
  for (const [y, z, l] of [[0.5, 0.12, 0.14], [0.47, -0.02, 0.1]]) tooth(m, [0, y, z], [0, y + l, z - 0.06], 0.03, wart); // spines along the back
  // the rod it fishes with, in three joints
  const rod = [[0, 0.4, 0.42], [0, 0.74, 0.5], [0, 0.95, 0.66], ANGLER_ROD];
  for (let i = 0; i < 3; i++) m.limb(rod[i], rod[i + 1], 0.03 - i * 0.006, 0.024 - i * 0.006, 4, i === 2 ? finTip : fins);
  if (big) both((s) => { for (let i = 0; i < 2; i++) m.limb([s * 0.12, 0.44, 0.3 - i * 0.2], [s * (0.3 + i * 0.1), 0.86 - i * 0.1, 0.36 - i * 0.3], 0.02, 0.006, 3, finTip); }); // feelers
  return m.geometry();
}

// ---------------------------------------------------------------- the spined drifter: an urchin adrift, plates in five bands, spines lit at the tip
export function drifter(pal) {
  const m = mesher(), g = new THREE.IcosahedronGeometry(0.3, 1).toNonIndexed(), a = g.attributes.position, seen = new Map();
  for (let i = 0; i < a.count; i += 3) {
    const p = [0, 1, 2].map((k) => [a.getX(i + k), a.getY(i + k) * 0.88, a.getZ(i + k)]), c = [0, 1, 2].map((k) => (p[0][k] + p[1][k] + p[2][k]) / 3);
    m.tri(p[0], p[1], p[2], Math.sin(Math.atan2(c[0], c[2]) * 5) > 0.2 ? pal.band : pal.test);
    for (const q of p) seen.set(q.map((v) => v.toFixed(2)).join(), q);
  }
  [...seen.values()].forEach((q, i) => { const l = Math.hypot(...q), d = q.map((v) => v / l), long = i % 3 === 0 ? 0.5 : 0.24, mid = q.map((v, k) => v + d[k] * long * 0.6), tip = q.map((v, k) => v + d[k] * long);
    m.limb(q.map((v) => v * 0.9), mid, 0.04, 0.022, 3, [dim(pal.test, 0.8), pal.spine]).limb(mid, tip, 0.022, 0.002, 3, [pal.tip, tint(pal.tip, '#ffffff', 0.6)], true); });
  return m.geometry();
}

// ---------------------------------------------------------------- the leech: a lamprey, all mouth at one end
export function leech(pal) {
  const m = mesher(), { back, flank, belly, fin: pink } = pal;
  const secs = [[0.5, 0.1, 0.1, 0.1, -0.03], [0.4, 0.115, 0.11, 0.11, -0.01], [0.15, 0.12, 0.12, 0.11], [-0.15, 0.1, 0.1, 0.1], [-0.38, 0.05, 0.07, 0.06], [-0.5, 0.008, 0.03, 0.03]];
  hull(m, secs, shaded(back, flank, belly));
  const lip = ringZ(0.5, 0.1, 0.1, 0.1, -0.03, 6);
  m.cap(lip, [0, 0, 1], ['#1a0d1a', CREAM, CREAM], -0.07);
  for (let i = 0; i < 6; i++) { const a2 = (i / 6) * Math.PI * 2 + 0.5; tooth(m, [Math.sin(a2) * 0.07, -0.03 + Math.cos(a2) * 0.07, 0.5], [Math.sin(a2) * 0.03, -0.03 + Math.cos(a2) * 0.03, 0.53], 0.014); }
  m.fin([[0, 0.12, 0.05], [0, 0.1, -0.15], [0, 0.07, -0.38], [0, 0.03, -0.5]], [[0, 0.17, -0.02], [0, 0.2, -0.2], [0, 0.17, -0.42], [0, 0.07, -0.6]], [pink, dim(pink, 0.84)]);
  m.fin([[0, -0.06, -0.38], [0, -0.03, -0.5]], [[0, -0.13, -0.44], [0, -0.07, -0.6]], pink);
  both((s) => { m.eye([s * 0.1, 0.045, 0.36], [s, 0.3, 0.2], 0.022, { iris: pal.eye, glow: true });
    for (let i = 0; i < 5; i++) m.tri([s * 0.118, 0.0, 0.27 - i * 0.05], [s * 0.118, 0.022, 0.255 - i * 0.05], [s * 0.118, -0.018, 0.245 - i * 0.05], '#150c1c'); }); // gill pores
  return m.geometry();
}

// ---------------------------------------------------------------- a hook on a line from above: steel, a lead, and the tally tag of whoever set it
export function hook(pal) {
  const m = mesher(), { steel, shade } = pal;
  const M4 = (x, y, z, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(1, 1, 1));
  m.add(new THREE.TorusGeometry(0.2, 0.03, 5, 10, Math.PI * 1.3), M4(0, 0.2, 0, 0, 0, Math.PI * 1.02), steel);
  m.limb([-0.2, 0.2, 0], [-0.17, 0.38, 0], 0.03, 0.002, 4, [shade, steel]).limb([-0.185, 0.27, 0], [-0.1, 0.2, 0], 0.016, 0.002, 3, shade); // the point and its barb
  m.limb([0.2, 0.2, 0], [0.2, 0.72, 0], 0.03, 0.026, 5, [shade, steel]);
  m.add(new THREE.TorusGeometry(0.05, 0.016, 4, 7), M4(0.2, 0.77, 0, 0, Math.PI / 2, 0), steel); // the eye the line is tied to
  m.skin([ringY(1.3, 0.004, 5, { x: 0.2 }), ringY(1.42, 0.06, 5, { x: 0.2 }), ringY(1.62, 0.004, 5, { x: 0.2 })], [dim(pal.lead, 0.72), pal.lead]); // the lead
  m.quad([0.2, 2.05, 0], [0.5, 2.0, 0.03], [0.5, 1.86, 0.03], [0.2, 1.9, 0], [pal.tag, pal.tag, dim(pal.tag, 0.8)]).tri([0.5, 2.0, 0.03], [0.62, 1.93, 0.05], [0.5, 1.86, 0.03], CREAM); // the tag
  return m.geometry();
}

// ---------------------------------------------------------------- a length of the oarfish's own tail, loose in the water
export function tailPiece(pal) { // pal: the oarfish's own palette
  const m = mesher(), gold = pal.body, top = pal.bodyTop, silver = pal.belly;
  const secs = [[0.3, 0.05, 0.1, 0.1], [0.0, 0.045, 0.09, 0.09], [-0.3, 0.022, 0.05, 0.05], [-0.34, 0.004, 0.02, 0.02]];
  hull(m, secs, (i, k, n) => (k === 0 || k === n - 1 ? top : k === 2 || k === 3 ? silver : (i + k) % 3 === 0 ? pal.spots : gold));
  m.cap(ringZ(0.3, 0.05, 0.1, 0.1, 0, 6), [0, 0, 1], ['#f4a4b9', '#7a2f45', '#7a2f45']);
  m.fin([[0, 0.1, 0.28], [0, 0.095, 0.08], [0, 0.085, -0.1], [0, 0.06, -0.28]], [[0, 0.27, 0.2], [0, 0.26, 0.04], [0, 0.2, -0.14], [0, 0.1, -0.3]], [pal.finPink, pal.finMid, pal.finPale]);
  return m.geometry();
}

// ================================================================ the keepers of the rifts, and the Sum
const grey = (k) => dim('#ffffff', k);

// ---------------------------------------------------------------- the Keeper: a great crab under a dome of plates
// The shell, with its face, is one model. Everything that works is a piece of its own, and KEEPER says where each joins: eight legs and two claws,
// each a rigid length modelled along +z from the joint it hangs on (crab.js hangs them on and legs.js walks them); two eyes on stalks, which turn
// to what it is looking at; the two doors of its mouth; four feelers, which trail (strands.js); and a crack in the shell for each leg, shown when
// that leg has been torn off.
const side4 = (fn) => [1, -1].flatMap((s) => [0, 1, 2, 3].map((i) => fn(s, i)));
const KEEPER_DOME = [[0.12, 1.5], [0.26, 1.66], [0.62, 1.52], [0.95, 1.24], [1.22, 0.86], [1.42, 0.44]], KEEPER_N = 12, KEEPER_SQUASH = 0.92; // the dome in rings, from its lip up: height, radius
const feeler = (side, long, root, way, n) => ({ side, long, root, way, cuts: Array.from({ length: n + 1 }, (_, i) => (long * i) / n) });
export const KEEPER = {
  ride: 0.44, // how far the shell's origin is carried over the ground its feet are on
  // front to back down each side. hip: where the leg leaves the shell; rest: where its foot stands, on the ground, as the body sees it
  legs: side4((s, i) => ({ side: s, group: (i + (s > 0 ? 0 : 1)) % 2, l1: 1.7, l2: 2.0, // (longer than they were, 1.3 and 1.6, so that the knees stand over two metres up, where a fish swims: a leg is hit where it is drawn now, and a fish keeps 1.5 m off the bed
    hip: [s * [1.2, 1.33, 1.29, 1.04][i], 0.3, [0.62, 0.1, -0.42, -0.94][i]], rest: [s * [2.5, 3.15, 3.1, 2.4][i], [1.8, 0.58, -0.72, -2.0][i]],
    curl: [s * [0.75, 0.9, 0.9, 0.7][i], -0.55, [0.75, 0.2, -0.4, -0.85][i]] })), // drawn up under the belly, when it is done for
  // Two claws, and not a pair. On its right the crusher: big, slow, and the one it strikes with. On its left the cutter: small and quick, the one it feeds with.
  // A claw is an arm from the shoulder to the elbow, then the hand, which is the forearm and the lower finger in one piece; the upper finger hinges on it.
  // l1, l2: arm and forearm; span: how far the fingers reach past the hinge; stout: how thick it all is
  claws: [
    // (Both were made bigger when the fight was made honest: the great claw had hit a disc three metres across while it was itself a hand's breadth wide.
    // It is now what it hits with, so it is drawn as great as its blow: a third longer and a third thicker. The small one reaches as far as its jab does.)
    { side: -1, big: true, shoulder: [-1.04, 0.34, 1.0], l1: 1.35, l2: 1.2, hinge: [0, 0.2, 1.14], span: 1.25, stout: 2.0 },
    { side: 1, big: false, shoulder: [0.98, 0.3, 1.06], l1: 1.1, l2: 0.9, hinge: [0, 0.08, 0.86], span: 0.75, stout: 0.95 },
  ],
  eyes: [1, -1].map((side) => ({ side, socket: [side * 0.37, 0.4, 1.47] })), stalk: 0.56, // where each stalk stands in its socket, and how far up it the eye is
  jaws: [1, -1].map((side) => ({ side, hinge: [side * 0.33, 0.21, 1.645] })), // the two doors of its mouth, each hinged at its outer edge
  // its feelers: a long one outside each eye, and a short one between them that flicks. way: which way each points when nothing moves it
  feelers: [1, -1].flatMap((side) => [feeler(side, 1.0, [side * 0.6, 0.36, 1.5], [side * 0.5, 0.42, 0.76], 5), feeler(side, 0.4, [side * 0.13, 0.4, 1.6], [side * 0.14, 0.72, 0.68], 3)]),
};
const domeAt = (phi, y) => { let i = 0; while (i < KEEPER_DOME.length - 2 && KEEPER_DOME[i + 1][0] < y) i++; const a = KEEPER_DOME[i], b = KEEPER_DOME[i + 1], r = a[1] + (b[1] - a[1]) * Math.min(1, Math.max(0, (y - a[0]) / (b[0] - a[0]))); return [Math.sin(phi) * r, y, Math.cos(phi) * r * KEEPER_SQUASH]; };
export function keeper(pal) {
  const m = mesher(), { tone, pale, dark, deep } = pal, shade = dim(tone, 0.8), N = KEEPER_N, rings = KEEPER_DOME.map(([y, r]) => ringY(y, r, N, { squash: KEEPER_SQUASH }));
  // the dome: a lip turned under, a pale band, and then plates, each raised a little in its middle, light and dark by turns
  m.skin([rings[0], rings[1], rings[2]], (i, k) => (i === 0 ? tint(pale, deep, 0.35) : k % 2 ? pale : tint(pale, tone, 0.2)));
  for (let i = 2; i < 4; i++) for (let k = 0; k < N; k++) { const a = rings[i][k], b = rings[i][(k + 1) % N], c = rings[i + 1][(k + 1) % N], d = rings[i + 1][k], mid = [0, 1, 2].map((j) => (a[j] + b[j] + c[j] + d[j]) / 4), l = Math.hypot(mid[0], mid[1] - 0.3, mid[2]);
    const boss = [mid[0] + (mid[0] / l) * 0.07, mid[1] + ((mid[1] - 0.3) / l) * 0.07, mid[2] + (mid[2] / l) * 0.07], col = (k + i) % 2 ? tone : shade, lit = tint(col, '#ffffff', 0.22), from = [0, 0.3, 0];
    m.out(a, b, boss, from, [col, col, lit]).out(b, c, boss, from, [col, col, lit]).out(c, d, boss, from, [col, col, lit]).out(d, a, boss, from, [col, col, lit]); }
  m.skin([rings[4], rings[5]], (i, k) => (k % 2 ? tone : shade)).cap(rings[5], [0, 1, 0], [pale, shade, shade], 0.14);
  for (let k = 0; k < N; k += 2) { const p = rings[3][k]; m.limb([p[0] * 0.95, p[1] - 0.05, p[2] * 0.95], [p[0] * 1.3, p[1] + 0.32, p[2] * 1.3], 0.14, 0.01, 4, [shade, pale]); } // a spine where four plates meet,
  for (let k = 1; k < N; k += 2) { const p = rings[2][k]; m.limb([p[0] * 0.97, p[1], p[2] * 0.97], [p[0] * 1.1, p[1] + 0.13, p[2] * 1.1], 0.09, 0.012, 4, [shade, pale]); } // a stud between them lower down,
  m.limb([0, 1.5, 0], [0, 1.66, -0.03], 0.3, 0.24, 6, [shade, tone]).limb([0, 1.6, -0.02], [0, 2.25, -0.2], 0.24, 0.02, 5, [tone, pale]); // and the horn on top, in its collar
  for (const s of [1, -1]) { for (const deg of [22, 38, 54, 70]) { const a = (s * deg * Math.PI) / 180, p = domeAt(a, 0.26); m.limb([p[0] * 0.97, p[1], p[2] * 0.97], [p[0] * 1.09, p[1] + 0.04, p[2] * 1.1], 0.075, 0.008, 3, [pale, CREAM]); } // teeth along the front of the lip, each side
    for (const x of [0.07, 0.2]) m.limb([s * x, 0.3, 1.5], [s * x * 1.1, 0.33, 1.62], 0.05, 0.006, 3, [pale, CREAM]); } // and two small ones each side between the eyes
  // underneath: the breastplate, and the tail folded forward under it (which is all the tail a crab has)
  const under = ringY(-0.02, 1.2, N, { squash: KEEPER_SQUASH }); m.skin([rings[0], under], deep).cap(under, [0, -1, 0], [tint(pale, deep, 0.3), deep, deep], 0.06);
  for (let j = 0; j < 4; j++) { const z0 = -1.02 + j * 0.38, z1 = z0 + 0.38, w0 = 0.44 - j * 0.09, w1 = 0.44 - (j + 1) * 0.09, y = -0.1; m.quad([-w0, y, z0], [w0, y, z0], [w1, y, z1], [-w1, y, z1], j % 2 ? [pale, pale, tint(pale, deep, 0.3)] : [tint(pale, tone, 0.35), tint(pale, tone, 0.35), tint(pale, deep, 0.4)]); }
  // the face under the shell's lip: the dark of it, the socket each eye stands in, and the red of the mouth behind its doors
  m.add(new THREE.BoxGeometry(1.3, 0.34, 0.5), new THREE.Matrix4().makeTranslation(0, 0.2, 1.38), deep);
  m.quad([-0.3, 0.05, 1.635], [0.3, 0.05, 1.635], [0.26, 0.34, 1.635], [-0.26, 0.34, 1.635], ['#7a2f45', '#7a2f45', '#3d1830']);
  both((s) => {
    const e = KEEPER.eyes[s > 0 ? 0 : 1].socket; m.limb([e[0] * 0.9, e[1] - 0.12, e[2] - 0.14], [e[0], e[1] + 0.02, e[2]], 0.13, 0.15, 6, [deep, dark]);
    for (const leg of KEEPER.legs) if (leg.side === s) m.limb([leg.hip[0] * 0.8, 0.3, leg.hip[2] * 0.9], leg.hip, 0.2, 0.17, 5, deep); // and a socket for each leg
  });
  for (const c of KEEPER.claws) m.limb([c.shoulder[0] * 0.76, c.shoulder[1], c.shoulder[2] - 0.1], c.shoulder, 0.24 * c.stout, 0.2 * c.stout, 5, deep); // the socket each claw turns in
  return m.geometry();
}
// The two lengths of a walking leg. The upper is the thigh, from the joint at the shell to the knee, with a crest of small spines; the lower is the three
// short lengths a crab's leg ends in, made as one: a wrist, a shin, and after a pale joint the last, which comes to a point.
export function keeperLeg(pal) {
  const { pale, dark, deep } = pal, { l1, l2 } = KEEPER.legs[0], u = l1 / 1.3, w = l2 / 1.6; // (u, w: how much longer than they were first made; the spines and joints keep their places along them)
  const upper = mesher().limb([0, 0, -0.1], [0, 0, 0.2], 0.21, 0.2, 5, deep).limb([0, 0.01, 0.16], [0, 0.015, l1 - 0.1], 0.185, 0.15, 5, [dark, deep]).limb([0, 0.015, l1 - 0.14], [0, 0, l1], 0.165, 0.17, 5, [deep, dark]), knee = upper.last;
  upper.cap(knee, [0, 0, 1], pale, 0.16); // the knuckle of the knee
  for (const z of [0.42, 0.72, 1.0]) upper.limb([0, 0.14, z * u], [0, 0.29, z * u + 0.1], 0.05, 0.005, 3, [dark, pale]);
  const lower = mesher().limb([0, 0, -0.05], [0, 0.02, 0.34 * w], 0.17, 0.15, 5, [deep, dark]).limb([0, 0.02, 0.3 * w], [0, 0.05, 1.0 * w], 0.14, 0.1, 5, [dark, deep])
    .limb([0, 0.05, 0.95 * w], [0, 0.05, 1.07 * w], 0.118, 0.11, 5, pale).limb([0, 0.05, 1.04 * w], [0, 0, l2], 0.095, 0.014, 5, [dark, pale]);
  return { upper: upper.geometry(), lower: lower.geometry() };
}
// The three pieces of one claw (c: its entry in KEEPER.claws). The hand's top is +y: the upper finger lifts off it that way, turning about x at the hinge, whose pin
// shows on both sides of the hand. The crusher's fingers carry blunt knobs, big toward the hinge; the cutter's a row of fine sharp teeth. Both are tipped dark.
export function keeperClaw(pal, c) {
  const { pale, dark, deep } = pal, { l1, l2, span: f, stout: w, hinge } = c;
  const arm = mesher().limb([0, 0, -0.08], [0, 0, 0.18], 0.23 * w, 0.215 * w, 5, deep).limb([0, 0, 0.14], [0, 0, l1 - 0.08], 0.2 * w, 0.175 * w, 5, [dark, deep]).limb([0, 0, l1 - 0.12], [0, 0, l1], 0.19 * w, 0.2 * w, 5, [deep, dark]);
  arm.cap(arm.last, [0, 0, 1], pale, 0.1 * w); for (const z of [0.4, 0.7]) arm.limb([0, 0.16 * w, z * l1], [0, 0.3 * w, z * l1 + 0.08], 0.05 * w, 0.005, 3, [dark, pale]);
  const hand = mesher().limb([0, 0, -0.05], [0, 0.01, l2 * 0.3], 0.2 * w, 0.215 * w, 5, [deep, dark]).limb([0, 0.01, l2 * 0.26], [0, 0, l2], 0.215 * w, 0.31 * w, 6, [dark, deep]);
  const low = [[0, -0.1 * w, l2 - 0.06], [0, -0.3 * w, l2 + f * 0.92]], up = [[0, 0, -0.05], [0, 0.07 * w, f]]; // the lower finger, in the hand's space; the upper, in its own
  const at = ([p, q], t) => [0, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t], finger = (m, line, r0, r1) => { const r = r0 + (r1 - r0) * 0.78; m.limb(line[0], at(line, 0.78), r0, r, 5, [dark, pale]).limb(at(line, 0.78), line[1], r, r1, 5, [pale, deep]); };
  hand.cap(hand.last, [0, 0, 1], dark, 0.1 * w); finger(hand, low, 0.21 * w, 0.03);
  hand.limb([-0.33 * w, hinge[1], hinge[2]], [0.33 * w, hinge[1], hinge[2]], 0.085 * w, 0.085 * w, 5, pale); // the hinge pin
  for (const z of [0.5, 0.72]) hand.limb([0, 0.27 * w, z * l2], [0, 0.4 * w, z * l2 + 0.05], 0.07 * w, 0.01, 4, [dark, pale]); // knuckles along the top of the hand
  const top = mesher(); finger(top, up, 0.27 * w, 0.035);
  const teeth = c.big ? [[0.22, 0.13, 0.12], [0.4, 0.11, 0.1], [0.57, 0.09, 0.09], [0.72, 0.07, 0.07]] : [[0.2, 0.03, 0.05], [0.34, 0.03, 0.05], [0.48, 0.028, 0.045], [0.62, 0.025, 0.04], [0.76, 0.02, 0.035]]; // how far along, how thick, how long
  for (const [t, r, l] of teeth) { const on = (m, line, r0, r1, sign) => { const p = at(line, t), rad = r0 + (r1 - r0) * t; m.limb([0, p[1] + sign * rad * 0.55, p[2]], [0, p[1] + sign * (rad + l), p[2] + 0.02], r, c.big ? r * 0.45 : 0.004, c.big ? 4 : 3, pale); };
    on(hand, low, 0.21 * w, 0.03, 1); on(top, up, 0.27 * w, 0.035, -1); }
  return { arm: arm.geometry(), hand: hand.geometry(), finger: top.geometry() };
}
// An eye, in two pieces. The stalk stands up (+y) from its socket. The eye itself sits on the stalk's top and turns there: it is modelled about its own middle,
// looking along +z, with the lit ring of it set high on its front, so that from above it is seen which way it looks.
export function keeperEye(pal) {
  const { pale, dark, deep } = pal, L = KEEPER.stalk, top = tint(dark, pale, 0.3);
  const stalk = mesher().limb([0, -0.08, 0], [0, L - 0.16, 0], 0.085, 0.06, 5, [deep, dark]).limb([0, L - 0.2, 0], [0, L - 0.1, 0], 0.085, 0.115, 5, pale);
  const m = mesher(), ball = [[-0.19, 0.06], [-0.1, 0.17], [0.03, 0.205], [0.13, 0.16]].map(([z, r]) => ringZ(z, r, r, r, 0, 8));
  m.skin(ball, shaded(top, dark, deep)).cap(ball[0], [0, 0, -1], dark, 0.03).cap(ball[3], [0, 0, 1], deep, 0.04);
  const n = new THREE.Vector3(0, 0.56, 0.83).normalize(); m.eye([n.x * 0.165, n.y * 0.165, n.z * 0.165], [n.x, n.y, n.z], 0.14, { iris: pal.eye, glow: true });
  return { stalk: stalk.geometry(), ball: m.geometry() };
}
// One door of the mouth (the third maxilliped of a real crab, which shuts over the rest like a door): hinged about y at its outer edge, the plate toward -x, with the
// small feeler such a door carries. The door on the other side is this one turned over (scale.x = -1).
export function keeperJaw(pal) {
  const m = mesher(), { pale, tone, dark } = pal, edge = tint(pale, tone, 0.35), a = [0, 0.16, 0], b = [0, -0.16, 0], c = [-0.31, -0.19, 0.015], d = [-0.31, 0.11, 0.015], mid = [-0.16, -0.02, 0.075];
  for (const [p, q] of [[a, b], [b, c], [c, d], [d, a]]) m.out(p, q, mid, [-0.15, 0, -0.5], [edge, edge, pale]);
  m.quad(a, b, [c[0], c[1], -0.02], [d[0], d[1], -0.02], dark).limb([-0.27, 0.1, 0.03], [-0.2, 0.3, 0.1], 0.04, 0.012, 3, [pale, dark]);
  return m.geometry();
}
// a feeler (def: its entry in KEEPER.feelers): straight along +z, three-sided, thinning to nothing, ringed light and dark
export function keeperFeeler(pal, def) {
  const m = mesher(), { pale, dark } = pal, n = def.cuts.length - 1, r0 = def.long > 0.6 ? 0.04 : 0.034;
  const ring = (z, i) => { const r = i === n ? 0.003 : r0 * (1 - 0.72 * (i / n)); return [[-r, -0.5 * r, z], [0, r, z], [r, -0.5 * r, z]]; };
  m.skin(def.cuts.map((z, i) => ring(i === 0 ? -0.04 : z, i)), (i) => (i % 2 ? pale : tint(dark, pale, 0.25)));
  return m.geometry();
}
// What shows when leg i has been torn off: the stump in its socket, and a crack that runs from there up the seams between the plates, lit in its depth.
// It lies along the edges the plates meet at, which are the only lines on the dome that are not raised.
export function keeperCrack(pal, i) {
  const m = mesher(), { tone, pale, deep } = pal, leg = KEEPER.legs[i], hot = pal.crack || '#ff4f7b', N = KEEPER_N, step = (Math.PI * 2) / N, s = leg.side, turn = s * (i % 2 ? -1 : 1);
  const k0 = Math.round(Math.atan2(leg.hip[0], leg.hip[2]) / step), node = (ring, k) => domeAt(k * step, KEEPER_DOME[ring][0]);
  const corners = [domeAt(k0 * step, 0.16), node(1, k0), node(2, k0), node(2, k0 + turn), node(3, k0 + turn), node(3, k0 + (i % 2 ? 2 * turn : 0)), node(4, k0 + (i % 2 ? 2 * turn : 0))];
  // from corner to corner along the seams, but not straight: each run is broken twice, to one side and the other
  const out = (p, lift) => { const l = Math.hypot(p[0], p[1] - 0.3, p[2]) || 1; return [p[0] + (p[0] / l) * lift, p[1] + ((p[1] - 0.3) / l) * lift, p[2] + (p[2] / l) * lift]; };
  const across = (a, b) => new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).cross(new THREE.Vector3(a[0], a[1] - 0.3, a[2]).normalize()).normalize();
  const path = [corners[0]]; for (let j = 0; j + 1 < corners.length; j++) { const a = corners[j], b = corners[j + 1], sd = across(a, b); for (const [t, o] of [[0.36, 0.07], [0.68, -0.06], [1, 0]]) { const q = [0, 1, 2].map((c) => a[c] + (b[c] - a[c]) * t); path.push([q[0] + sd.x * o, q[1] + sd.y * o, q[2] + sd.z * o]); } }
  const n = path.length - 1, wide = (j) => 0.19 * (1 - 0.78 * (j / n)) * (j === 0 ? 0.7 : 1); // (wide enough to be seen from the dive's camera, fifteen metres off)
  const strip = (k, lift, colour, glow) => { for (let j = 0; j < n; j++) { const a = out(path[j], lift), b = out(path[j + 1], lift), sd = across(a, b), q = (p, w, t) => [p[0] + sd.x * w * t, p[1] + sd.y * w * t, p[2] + sd.z * w * t], w0 = wide(j) * k, w1 = wide(j + 1) * k;
    m.tri(q(a, w0, 1), q(a, w0, -1), q(b, w1, -1), colour, glow).tri(q(a, w0, 1), q(b, w1, -1), q(b, w1, 1), colour, glow); } };
  strip(1, 0.022, deep, false); strip(0.5, 0.034, [hot, hot, tint(hot, '#ffffff', 0.35)], true);
  { const a = path[5], b = node(2, k0 - turn), sd = across(a, b), q = [0, 1, 2].map((c) => a[c] + (b[c] - a[c]) * 0.55), o = out(a, 0.024), e = out(q, 0.024); m.tri([o[0] + sd.x * 0.05, o[1] + sd.y * 0.05, o[2] + sd.z * 0.05], [o[0] - sd.x * 0.05, o[1] - sd.y * 0.05, o[2] - sd.z * 0.05], e, [deep, deep, hot]); } // a short one branching off it
  // the stump: pale where it tore, dark in the middle, with a splinter or two
  const h = leg.hip, d = new THREE.Vector3(h[0] * 0.2, 0, h[2] * 0.1).normalize(), tipOf = (l) => [h[0] + d.x * l, h[1] + d.y * l, h[2] + d.z * l];
  m.limb(tipOf(-0.02), tipOf(0.12), 0.17, 0.13, 5, [pale, tint(pale, tone, 0.5)]).cap(m.last, [d.x, d.y, d.z], [deep, hot, hot], -0.05, true);
  m.limb(tipOf(0.08), [h[0] + d.x * 0.3, h[1] + 0.1, h[2] + d.z * 0.3 + 0.05], 0.04, 0.004, 3, [pale, deep]).limb(tipOf(0.08), [h[0] + d.x * 0.26, h[1] - 0.08, h[2] + d.z * 0.26 - 0.06], 0.035, 0.004, 3, [pale, deep]);
  return m.geometry();
}

// ---------------------------------------------------------------- the Shearer: a sawfish, the saw toothed in the district's colour
// A ray in front and a shark behind, as sawfish are: a flat wide head with the wings grown onto it, eyes on top with a breathing hole behind each, the
// mouth, the nostrils and five gill slits a side underneath, two tall back fins, and a shark's uneven tail. The saw is a quarter of its length. Its teeth
// are lit from within and take the district's colour: sawfish.js brightens them when it feels a fish.
// It is made of pieces, and sawfish.js puts them together:
//   shearer       the head, the wings, the trunk as far as the tail root, the first back fin. It bends in its shader (spine.js), and its wings ripple, its
//                 gills heave, its breathing holes gape and its eyelids come down there too, by the marks this puts on each corner (`flex`, `swell`)
//   shearerSaw    the blade as far as where it would break, the end beyond that, the break itself, and one tooth. All rigid, and hung on the head
//   shearerTail   everything behind the hind fins, with the second back fin: modelled straight along +z from where it joins, and trailed by strands.js
// SHEARER says where they join. neck: where the head turns on the body (z); nose: the saw's tip; snap: where the saw breaks; all: every tooth (which edge,
// which of the four rows it goes with, where on the edge, how long, and whether it is on the end that breaks off). Every fourth tooth is a row, and the
// two edges lose different teeth. swim: the wave the trunk swims with, which starts behind the wings; tail: where the tail joins, and its joints.
export const SHEARER = (() => {
  const neck = 1.5, nose = 3.75, snap = 2.82, each = 16, sawY = -0.18;
  const wide = (z) => 0.3 - (z - 1.9) * 0.0865, thick = (z) => 0.076 - (z - 1.9) * 0.0225; // half the blade's width, and half its thickness, at z
  const all = [1, -1].flatMap((side) => Array.from({ length: each }, (_, i) => { const t = (i + 0.5) / each, z = 2.02 + t * (nose - 2.1); return { side, i, row: (i + (side > 0 ? 0 : 2)) % 4, z, x: side * (wide(z) - 0.035), long: 0.27 - 0.07 * t, end: z > snap }; }));
  return { neck, nose, length: 6.9, teeth: each, snap, sawY, wide, thick, all, swim: { amp: 0.2, waves: 2.2, nose: 1.3, length: 4.6 }, tail: { root: -1.25, cuts: [0, 0.42, 0.84, 1.24, 1.62, 2.05] }, holes: [[0.45, 0.34, 0.93], [-0.45, 0.34, 0.93]] }; // holes: where the two breathing holes are
})();
// the trunk in sections: z, half its width, how far the back stands over its middle and the belly under it, and the height of its middle
const SAW_BODY = [[1.95, 0.3, 0.1, 0.08, -0.18], [1.75, 0.45, 0.18, 0.11, -0.15], [1.5, 0.62, 0.27, 0.14, -0.12], [1.25, 0.76, 0.35, 0.16, -0.085], [1.0, 0.83, 0.42, 0.175, -0.05], [0.7, 0.84, 0.47, 0.19, -0.02], [0.35, 0.78, 0.5, 0.2, 0], [0, 0.66, 0.5, 0.2, 0], [-0.4, 0.52, 0.46, 0.2, 0], [-0.8, 0.4, 0.4, 0.19, 0.01], [-1.25, 0.3, 0.33, 0.17, 0.02]];
const SAW_WING = [[1.74, 0], [1.5, 0.2], [1.25, 0.42], [1.0, 0.63], [0.75, 0.83], [0.5, 1.02], [0.25, 1.17], [0.08, 1.22], [-0.12, 0.98], [-0.3, 0.6], [-0.45, 0.28], [-0.56, 0]]; // z, and how far the wing stands out from the body's side there
const SAW_HIND = [[-0.7, 0], [-0.86, 0.3], [-1.02, 0.44], [-1.14, 0.26], [-1.21, 0]]; // the same for a hind fin
const sawAt = (z) => { let i = 0; while (i < SAW_BODY.length - 2 && SAW_BODY[i + 1][0] > z) i++; const a = SAW_BODY[i], b = SAW_BODY[i + 1], t = Math.min(1, Math.max(0, (a[0] - z) / (a[0] - b[0]))); return [1, 2, 3, 4].map((k) => a[k] + (b[k] - a[k]) * t); };
// the height of its back, and of its underside, at (x, z): a section is ten-sided
const sawSkin = (x, z, top) => { const [w, up, dn, y] = sawAt(z), u = Math.min(0.951, Math.abs(x) / w), h = u <= 0.588 ? 1 - 0.191 * u / 0.588 : 0.809 - 0.5 * (u - 0.588) / 0.363; return top ? y + up * h : y - dn * h; };
// a fin that stands on the back: thick where it grows and a blade at its edge, both faces made. roots, tips: [y, z] down its length
const sail = (m, roots, tips, half, colours) => { for (const s of [1, -1]) for (let k = 0; k + 1 < roots.length; k++) { const c = colours[k % colours.length];
  m.quad([s * half, roots[k][0], roots[k][1]], [s * half, roots[k + 1][0], roots[k + 1][1]], [0, tips[k + 1][0], tips[k + 1][1]], [0, tips[k][0], tips[k][1]], [c[0], c[0], c[1]]); }
  const n = roots.length - 1; m.tri([half, roots[0][0], roots[0][1]], [-half, roots[0][0], roots[0][1]], [0, tips[0][0], tips[0][1]], colours[0][0]).tri([half, roots[n][0], roots[n][1]], [-half, roots[n][0], roots[n][1]], [0, tips[n][0], tips[n][1]], colours[0][0]); };
export function shearer(pal) {
  const m = mesher(), { tone, back, flank, belly, eye } = pal, gill = pal.gill || '#ff8fb0', shade = dim(tone, 0.8), dark = '#241833', mottle = '#4a375e', low = tint(flank, belly, 0.3), under = tint(belly, flank, 0.14), rim = tint(flank, tone, 0.55);
  const top = (x, z) => sawSkin(x, z, true), bot = (x, z) => sawSkin(x, z, false), N = 10;
  const moved = [], move = (p, d, kind) => { moved.push([p, d, kind]); return p; }; // corners that go somewhere of their own: 1 with the breath (a breathing hole, a gill slit, the mouth), 2 an eyelid, 3 the back fin's lean
  hull(m, SAW_BODY, (i, k) => (k === 0 || k === N - 1 ? back : k === 1 || k === N - 2 ? ((i * 2 + k) % 3 === 0 ? mottle : flank) : k === 2 || k === N - 3 ? low : k === 4 || k === 5 ? belly : under), N);
  m.cap(ringZ(-1.25, 0.3, 0.33, 0.17, 0.02, N), [0, 0, -1], flank, 0.24); // rounded, where the tail turns on it
  // the wings, grown onto the head: thick where they join and thin at the edge, dark above and pale below, the rim in the district's colour
  const wingFrom = m.triangles;
  const wing = (outline, lift, fall) => both((s) => { const up = [], dn = [], mid = [], edge = [];
    for (const [z, d] of outline) { const [w, u, v, y] = sawAt(z), k = d > 0 ? 1 : 0.2, r = [s * w * 0.86, y + u * 0.3 * k, z], e = [s * (w * 0.95 + d), y + lift - 0.06 - fall * d, z];
      up.push(r); dn.push([s * w * 0.86, y - v * 0.3 * k + lift, z]); edge.push(e); mid.push([r[0] + (e[0] - r[0]) * 0.8, r[1] + (e[1] - r[1]) * 0.8 + 0.035 * d, z]); } // (a little arched, and thin for its last fifth)
    for (let k = 0; k + 1 < edge.length; k++) { const c = k % 2 ? flank : tint(flank, back, 0.55), c2 = tint(c, back, 0.35), e = k % 2 ? rim : tint(rim, back, 0.3);
      m.tri(up[k], up[k + 1], mid[k + 1], [c, c, c2]).tri(up[k], mid[k + 1], mid[k], [c, c2, c2]).tri(mid[k], mid[k + 1], edge[k + 1], [c2, c2, e]).tri(mid[k], edge[k + 1], edge[k], [c2, e, e]).quad(dn[k], dn[k + 1], edge[k + 1], edge[k], k % 2 ? belly : under); } });
  wing(SAW_WING, 0, 0.07); wing(SAW_HIND, -0.05, 0.12);
  const wingTo = m.triangles;
  // the first back fin
  sail(m, [[0.5, 0.16], [0.5, -0.1], [0.47, -0.38], [0.42, -0.63]].map(([, z]) => [top(0, z) - 0.03, z]), [[0.8, -0.02], [1.3, -0.42], [1.0, -0.74], [0.56, -0.92]], 0.075, [[shade, tone], [tone, tint(tone, '#ffffff', 0.2)], [shade, tone]]);
  // the eyes, each on a low brow, looking up and out, with a lid that comes down over it
  const spots = [];
  both((s) => { const c = [s * 0.5, top(0.5, 1.26) - 0.03, 1.26], n = new THREE.Vector3(s * 0.667, 0.733, 0.133).normalize(), e = [c[0] + n.x * 0.15, c[1] + n.y * 0.15, c[2] + n.z * 0.15], r = 0.115;
    m.limb(c, e, 0.165, 0.14, 6, [back, mottle]).eye([e[0] + n.x * 0.004, e[1] + n.y * 0.004, e[2] + n.z * 0.004], [n.x, n.y, n.z], r, { iris: eye, glow: true, slit: true });
    // the lid: strips from the upper rim, which are nothing while the eye is open and are drawn down across it as it shuts
    const U = new THREE.Vector3(0, 1, 0).addScaledVector(n, -n.y).normalize(), V = new THREE.Vector3().crossVectors(n, U), on = (a, b) => [e[0] + n.x * 0.045 + U.x * a + V.x * b, e[1] + n.y * 0.045 + U.y * a + V.y * b, e[2] + n.z * 0.045 + U.z * a + V.z * b], R = r * 1.36;
    const arc = [-1, -0.5, 0, 0.5, 1].map((t) => [R * Math.sqrt(1 - t * t * 0.96), R * t]);
    for (let k = 0; k + 1 < arc.length; k++) { const [a0, b0] = arc[k], [a1, b1] = arc[k + 1], p0 = on(a0, b0), p1 = on(a1, b1), q0 = on(a0, b0 + 1e-3), q1 = on(a1, b1 + 1e-3), d0 = on(-a0, b0), d1 = on(-a1, b1);
      move(q0, [d0[0] - p0[0], d0[1] - p0[1], d0[2] - p0[2]], 2); move(q1, [d1[0] - p1[0], d1[1] - p1[1], d1[2] - p1[2]], 2); m.quad(p0, p1, q1, q0, [back, back, mottle]); }
    // the breathing hole behind it (a spiracle): a rim, and a mouth that is a slit when shut and gapes with each breath, lit inside
    const sx = s * 0.45, sz = 0.93, A = 0.2, B = 0.125, ring = (ka, kb, lift) => Array.from({ length: 6 }, (_, j) => { const t = (j / 6) * Math.PI * 2, x = sx + B * kb * Math.cos(t), z = sz + A * ka * Math.sin(t) - 0.03 * Math.cos(t) * s; return [x, top(x, z) + lift, z]; });
    const lip = ring(1, 1, 0.04), shut = ring(0.8, 0.05, 0.045), open = ring(0.8, 0.8, 0.0), pit = [sx, top(sx, sz) - 0.03, sz], from = [sx, top(sx, sz) - 0.6, sz];
    shut.forEach((q, j) => move(q, [open[j][0] - q[0], open[j][1] - q[1], open[j][2] - q[2]], 1));
    const outer = ring(1.3, 1.36, 0.004); for (let j = 0; j < 6; j++) m.out(outer[j], outer[(j + 1) % 6], lip[(j + 1) % 6], from, [back, back, mottle]).out(outer[j], lip[(j + 1) % 6], lip[j], from, [back, mottle, mottle]);
    for (let j = 0; j < 6; j++) m.out(lip[j], lip[(j + 1) % 6], shut[(j + 1) % 6], from, [mottle, mottle, dark]).out(lip[j], shut[(j + 1) % 6], shut[j], from, [mottle, dark, dark]);
    const g0 = m.triangles; for (let j = 0; j < 6; j++) m.out(shut[j], shut[(j + 1) % 6], pit, from, [gill, gill, tint(gill, '#ffffff', 0.4)]); spots.push([g0, m.triangles]);
  });
  // underneath: the nostrils, the mouth, and five gill slits a side, which open with each breath and show the gills
  const mark = (x0, z0, x1, z1, wide, colour, open = 0) => { const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz) || 1, nx = (-dz / l) * wide, nz = (dx / l) * wide, at = (x, z) => [x, bot(x, z) - 0.014, z];
    const a = at(x0 - nx, z0 - nz), b = at(x0 + nx, z0 + nz), c = at(x1 + nx, z1 + nz), d = at(x1 - nx, z1 - nz), back2 = nz > 0 ? [a, d] : [b, c]; // the two corners toward the tail are the ones that go
    if (open) for (const q of back2) move(q, [0, -0.012, -open], 1);
    m.out(a, b, c, [0, 0.2, 0.5], Array.isArray(colour) ? [nz > 0 ? colour[1] : colour[0], nz > 0 ? colour[0] : colour[1], nz > 0 ? colour[0] : colour[1]] : colour).out(a, c, d, [0, 0.2, 0.5], Array.isArray(colour) ? [nz > 0 ? colour[1] : colour[0], nz > 0 ? colour[0] : colour[1], nz > 0 ? colour[1] : colour[0]] : colour); };
  both((s) => {
    mark(s * 0.16, 1.67, s * 0.27, 1.57, 0.036, dark); m.out([s * 0.16, bot(0.16, 1.6) - 0.016, 1.6], [s * 0.25, bot(0.25, 1.53) - 0.016, 1.53], [s * 0.2, bot(0.2, 1.6) - 0.02, 1.6], [0, 0.2, 0.5], under); // a nostril, and its flap
    const g0 = m.triangles;
    for (let i = 0; i < 5; i++) mark(s * (0.29 + i * 0.012), 1.02 - i * 0.15, s * (0.52 + i * 0.012), 0.95 - i * 0.15, 0.02, [dark, gill], 0.07);
    mark(s * 0.0, 1.31, s * 0.19, 1.335, 0.026, [dark, dim(gill, 0.75)], 0.035); mark(s * 0.19, 1.335, s * 0.3, 1.41, 0.026, [dark, dim(gill, 0.75)], 0.02); // half of the mouth, turned up at the corner
    spots.push([g0, m.triangles]);
  });
  // small marks: the pores it feels with, over the snout; and paler flecks down the back
  let seed = 23; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 14; i++) { const z = 1.42 + 0.46 * rnd(), s = i % 2 ? 1 : -1, x = s * (0.05 + 0.4 * rnd()) * sawAt(z)[0], y = top(x, z) + 0.012, l = 0.02 + 0.012 * rnd(); m.tri([x, y, z + l], [x - l * 0.8, y, z - l * 0.6], [x + l * 0.8, y, z - l * 0.6], dark); }
  for (let i = 0; i < 16; i++) { const z = 0.9 - 2.0 * rnd(), s = i % 2 ? 1 : -1, x = s * (0.1 + 0.42 * rnd()) * sawAt(z)[0], l = 0.035 + 0.03 * rnd(); m.tri([x, top(x, z + l) + 0.012, z + l], [x - l * 0.7, top(x - l * 0.7, z - l) + 0.012, z - l], [x + l * 0.7, top(x + l * 0.7, z - l) + 0.012, z - l], mottle); }
  const g = m.geometry(), P = g.attributes.position, C = g.attributes.color, F = new Float32Array(P.count * 4), S = new Float32Array(P.count * 4);
  // What sawfish.js needs to move it. swell: how far a corner goes (x, y, z) when the gills fill, and, on a wing, how far out from the body's side it is (to the
  // animal's left, or minus that to its right), which is how much it ripples and folds. flex: where a corner goes of its own (x, y, z), and which kind it is.
  for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), [w, , , y0] = sawAt(z), isWing = i >= wingFrom * 3 && i < wingTo * 3, reach = isWing ? Math.max(0, Math.abs(x) - w * 0.9) : 0;
    const b = Math.sin(Math.PI * Math.min(1, Math.max(0, (z - 0.1) / 1.55))) ** 1.2 * (1 - Math.min(1, reach / 0.5)), u = Math.max(-1, Math.min(1, x / w));
    S[i * 4] = 0.13 * u * b; S[i * 4 + 1] = (y >= y0 ? 0.17 * (1 - 0.5 * Math.abs(u)) : -0.04) * b; S[i * 4 + 3] = reach > 0 ? Math.sign(x) * Math.max(1e-4, reach) : 0;
    const yr = top(0, z) - 0.03; if (!isWing && Math.abs(x) < 0.08 && z < 0.2 && z > -0.95 && y > yr + 0.02) { F[i * 4] = ((y - yr) / 0.8) ** 2 * 0.5; F[i * 4 + 3] = 3; } // the back fin: it leans most at its tip
  }
  for (const [p, d, kind] of moved) for (let i = 0; i < P.count; i++) if (Math.abs(P.getX(i) - p[0]) < 2e-4 && Math.abs(P.getY(i) - p[1]) < 2e-4 && Math.abs(P.getZ(i) - p[2]) < 2e-4) { F[i * 4] = d[0]; F[i * 4 + 1] = d[1]; F[i * 4 + 2] = d[2]; F[i * 4 + 3] = kind; }
  for (const [a2, b2] of spots) for (let i = a2 * 3; i < b2 * 3; i++) C.setW(i, 0.5); // the gills: lit by its breath, not with its teeth
  g.setAttribute('flex', new THREE.Float32BufferAttribute(F, 4)); g.setAttribute('swell', new THREE.Float32BufferAttribute(S, 4));
  return g;
}
// The saw's pieces. The blade and the break are in the saw's own space, which is the body's with the neck at the origin (z less SHEARER.neck); the end, and a
// tooth, are each about a point of their own, so that they turn about themselves once they have come away. A tooth points along +x from its root.
export function shearerSaw(pal) {
  const { tone, saw: pale } = pal, shade = dim(tone, 0.8), dark = '#241833', hot = tint(tone, '#ffffff', 0.35), { neck, nose, snap, sawY: Y, wide, thick, all } = SHEARER, mid = (snap + nose) / 2;
  const ring = (z, o, k = 1) => { const w = wide(z) * k, t = thick(z) * k; return [[-w, Y, z - o], [-w * 0.55, Y + t, z - o], [w * 0.55, Y + t, z - o], [w, Y, z - o], [w * 0.55, Y - t, z - o], [-w * 0.55, Y - t, z - o]]; };
  const paint = (z0, z1) => (i, k) => { const c = tint(pale, CREAM, Math.min(1, Math.max(0, ((i ? z1 : z0) - 1.9) / 1.85))), c1 = tint(pale, CREAM, Math.min(1, Math.max(0, (z1 - 1.9) / 1.85))); return k === 1 ? [c, c1] : k === 4 ? [dim(c, 0.78), dim(c1, 0.78)] : k < 3 ? [dim(c, 0.9), dim(c1, 0.9)] : [dim(c, 0.84), dim(c1, 0.84)]; };
  const stump = (m, t, o, y) => { const z = t.z - o, x = t.x, s = t.side; m.out([x, y + 0.022, z], [x, y, z + 0.042], [x + s * 0.085, y, z + 0.008], [x, y, z], [shade, shade, dark], true).out([x, y, z + 0.042], [x, y - 0.022, z], [x + s * 0.085, y, z + 0.008], [x, y, z], [shade, shade, dark], true)
    .out([x, y - 0.022, z], [x, y, z - 0.042], [x + s * 0.085, y, z + 0.008], [x, y, z], [shade, shade, dark], true).out([x, y, z - 0.042], [x, y + 0.022, z], [x + s * 0.085, y, z + 0.008], [x, y, z], [shade, shade, dark], true); };
  const pores = (m, from, to, o, y) => { for (let z = from; z < to; z += 0.21) for (const s of [1, -1]) { const x = s * wide(z) * 0.27, h = y + thick(z) + 0.004, r = 0.02; m.quad([x - r, h, z - o], [x, h, z - o + r * 1.6], [x + r, h, z - o], [x, h, z - o - r * 1.6], tint(pale, dark, 0.45)); } }; // the pores it feels a fish with, in two rows down the blade
  // the blade, from inside the head to where it would break
  const blade = mesher(), zs = [1.76, 1.95, 2.4, snap];
  blade.skin(zs.map((z) => ring(z, neck)), (i, k) => paint(zs[i], zs[i + 1])(0, k)).cap(ring(zs[0], neck), [0, 0, -1], pale); pores(blade, 2.04, snap - 0.05, neck, Y);
  for (const t of all) if (!t.end) stump(blade, t, neck, Y);
  // the end beyond that, blunt at its tip, dark and ragged where it would come away
  const end = mesher(), ze = [snap - 0.01, 3.3, 3.66, nose];
  end.skin(ze.map((z, i) => ring(z, mid, i === 3 ? 0.62 : 1).map((p) => [p[0], p[1] - Y, p[2]])), (i, k) => paint(ze[i], ze[i + 1])(0, k)).cap(ring(nose, mid, 0.62).map((p) => [p[0], p[1] - Y, p[2]]), [0, 0, 1], CREAM, 0.035).cap(ring(snap - 0.01, mid).map((p) => [p[0], p[1] - Y, p[2]]), [0, 0, -1], [dark, pale, pale], -0.05);
  pores(end, snap + 0.12, nose - 0.12, mid, 0); for (const t of all) if (t.end) stump(end, t, mid, 0);
  // the break: what is left on the blade when the end has gone
  const broken = mesher(); broken.cap(ring(snap, neck), [0, 0, 1], [dark, pale, pale], -0.04);
  for (const [x, l] of [[-0.14, 0.2], [0.02, 0.11], [0.13, 0.26], [-0.04, 0.17]]) broken.limb([x, Y, snap - neck - 0.02], [x * 0.8, Y + (x > 0 ? 0.02 : -0.015), snap - neck + l], 0.045, 0.004, 3, [pale, dark]);
  // one tooth: a flat spike, widest at its root, lit from the root out
  const tooth = mesher(), L = all[0].long, r0 = [[-0.05, 0.03, 0], [-0.05, 0, 0.058], [-0.05, -0.03, 0], [-0.05, 0, -0.058]], r1 = [[0.11, 0.021, 0.004], [0.11, 0, 0.046], [0.11, -0.021, 0.004], [0.11, 0, -0.036]], tip = [L, 0, 0.022];
  tooth.skin([r0, r1], [hot, tone], true); for (let k = 0; k < 4; k++) tooth.out(r1[k], r1[(k + 1) % 4], tip, [0.1, 0, 0], [tone, tone, shade], true); tooth.cap(r0, [-1, 0, 0], [pale, shade, shade]);
  return { blade: blade.geometry(), end: end.geometry(), broken: broken.geometry(), tooth: tooth.geometry(), mid: [0, Y, mid - neck] };
}
// The tail: the trunk behind the hind fins, the second back fin, and the tail fin, its upper lobe much the longer. Straight along +z from where it joins the body
// (the body's -z), its back toward +y; it begins a little inside the body, so that the join does not open when it swings.
export function shearerTail(pal) {
  const m = mesher(), { tone, back, flank, belly } = pal, shade = dim(tone, 0.8), mottle = '#4a375e', low = tint(flank, belly, 0.3), N = 8;
  const secs = [[-0.24, 0.23, 0.25, 0.12, 0.02], [0, 0.3, 0.33, 0.17, 0.02], [0.35, 0.225, 0.27, 0.14, 0.03], [0.7, 0.155, 0.205, 0.11, 0.04], [1.0, 0.105, 0.15, 0.09, 0.05], [1.2, 0.075, 0.115, 0.07, 0.06], [1.36, 0.04, 0.085, 0.05, 0.08]];
  hull(m, secs, (i, k) => (k === 0 || k === N - 1 ? back : k === 1 || k === N - 2 ? ((i + k) % 3 === 0 ? mottle : flank) : k === 3 || k === 4 ? belly : low), N);
  m.cap(ringZ(-0.24, 0.23, 0.25, 0.12, 0.02, N), [0, 0, -1], flank, 0.12);
  const ridge = (z) => { let i = 0; while (i < secs.length - 2 && secs[i + 1][0] < z) i++; const a = secs[i], b = secs[i + 1], t = (z - a[0]) / (b[0] - a[0]); return a[4] + a[2] + (b[4] + b[2] - a[4] - a[2]) * t; }; // the height of its back at z
  sail(m, [0.16, 0.38, 0.6].map((z) => [ridge(z) - 0.03, z]), [[0.56, 0.36], [0.84, 0.66], [0.44, 0.86]], 0.055, [[shade, tone], [tone, tint(tone, '#ffffff', 0.2)]]); // the second back fin
  // the tail fin: the spine turns up into the upper lobe, which carries a blade behind it; under it a short lower lobe
  m.limb([0, 0.1, 1.3], [0, 0.62, 1.68], 0.07, 0.045, 4, [back, shade]).limb([0, 0.62, 1.68], [0, 1.14, 2.05], 0.045, 0.01, 4, [shade, tone]);
  const lead = [[0, 0.1, 1.3], [0, 0.62, 1.68], [0, 1.14, 2.05]], trail = [[0, 0.0, 1.38], [0, 0.14, 1.63], [0, 0.66, 1.94]];
  m.fin(lead, trail, [[shade, shade, tone], tone]).tri(lead[2], trail[2], [0, 0.94, 2.045], tint(tone, '#ffffff', 0.2)); // (and the notch near its tip)
  m.tri([0, -0.06, 1.27], [0, 0.0, 1.38], [0, -0.44, 1.73], [shade, shade, tone]).tri([0, 0.0, 1.38], [0, 0.14, 1.63], [0, -0.44, 1.73], [shade, tone, tone]);
  return m.geometry();
}

// ---------------------------------------------------------------- the Lamplighter: the angler grown huge, its fins in the district's colour
export const LAMP_SCALE = 2.1;
export function lamplighter(pal) { const g = angler({ ...pal, fins: dim(pal.tone, 0.75), finTip: pal.tone }, true); g.scale(LAMP_SCALE, LAMP_SCALE, LAMP_SCALE); return g; }

// ---------------------------------------------------------------- the Warden: a moray's head, and one length of its body
export function wardenHead(pal) {
  const m = mesher(), { tone, pale, gum } = pal, shade = dim(tone, 0.72);
  hull(m, [[1.42, 0.1, 0.1, 0.07, 0.02], [1.05, 0.34, 0.24, 0.14, 0.02], [0.6, 0.5, 0.42, 0.26], [0, 0.5, 0.52, 0.44], [-0.5, 0.45, 0.5, 0.44]], (i, k, n) => (k === 0 || k === n - 1 ? shade : k === n / 2 - 1 || k === n / 2 ? pale : (i + k) % 2 ? tone : dim(tone, 0.88)), 8);
  hull(m, [[1.38, 0.08, 0.03, 0.05, -0.2], [0.95, 0.3, 0.05, 0.11, -0.3], [0.45, 0.42, 0.06, 0.14, -0.4]], (i, k, n) => (k === 0 || k === n - 1 ? shade : pale), 6);
  m.quad([-0.3, -0.12, 1.0], [0.3, -0.12, 1.0], [0.4, -0.3, 0.5], [-0.4, -0.3, 0.5], gum);
  both((s) => {
    for (let i = 0; i < 4; i++) { const z = 1.25 - i * 0.2, x = s * (0.12 + i * 0.07); tooth(m, [x, -0.1, z], [x, -0.24, z + 0.03], 0.03); tooth(m, [x * 1.05, -0.26, z - 0.08], [x * 1.05, -0.1, z - 0.05], 0.028); }
    m.eye([s * 0.38, 0.24, 0.78], [s, 0.45, 0.3], 0.1, { iris: pal.eye, glow: true });
    m.limb([s * 0.09, 0.1, 1.36], [s * 0.15, 0.24, 1.5], 0.035, 0.03, 4, pale); // the nostril tubes of a moray
  });
  m.fin([[0, 0.4, 0.7], [0, 0.52, 0.2], [0, 0.5, -0.5]], [[0, 0.72, 0.5], [0, 0.94, 0], [0, 0.8, -0.5]], [pale, CREAM]);
  return m.geometry();
}
// white, to be tinted: one length of an eel or of the Sum, along z, half a unit in radius, a fin along its back
export function eelSegment() {
  const m = mesher(), top = grey(0.7), belly = bright(1.12);
  hull(m, [[0.52, 0.5, 0.5, 0.5], [0, 0.52, 0.54, 0.5], [-0.52, 0.5, 0.5, 0.5]], (i, k, n) => (k === 0 || k === n - 1 ? top : k === n / 2 - 1 || k === n / 2 ? belly : (i + k) % 2 ? bright(1) : grey(0.86)), 8);
  m.fin([[0, 0.5, 0.52], [0, 0.54, 0], [0, 0.5, -0.52]], [[0, 0.8, 0.36], [0, 0.86, -0.12], [0, 0.72, -0.52]], [bright(1.2), grey(0.9)]);
  m.fin([[0, -0.5, 0.4], [0, -0.5, -0.4]], [[0, -0.62, 0.2], [0, -0.6, -0.5]], grey(0.8));
  return m.geometry();
}

// ---------------------------------------------------------------- one length of the Sum: a paid tail, joined to the next
// White, to take its district's colour. A ribbonfish in section, pinched and dark at each end where it was joined,
// spotted on the flank, and still carrying its length of the dorsal fin. Both faces of the fin are built: its material is one-sided.
export function sumSegment() {
  const m = mesher(), back = grey(0.74), belly = bright(1.16), seam = grey(0.5);
  hull(m, [[0.5, 0.4, 0.44, 0.44], [0.4, 0.5, 0.5, 0.5], [-0.4, 0.5, 0.5, 0.5], [-0.5, 0.4, 0.44, 0.44]], (i, k, n) => (i !== 1 ? seam : k === 0 || k === n - 1 ? back : k === 2 || k === 3 ? belly : k === 1 ? bright(1) : grey(0.9)), 6);
  both((s) => { for (const [y, z, r] of [[0.16, 0.22, 0.07], [-0.02, -0.08, 0.09], [0.2, -0.26, 0.06]]) { const x = s * 0.5 * Math.sin(Math.acos(Math.min(1, Math.abs(y) / 0.5))) + s * 0.004; m.tri([x, y + r, z], [x, y - r * 0.6, z + r], [x, y - r * 0.6, z - r], grey(0.6)); } }); // the spots of the flank
  const root = [[0, 0.5, 0.42], [0, 0.5, 0.14], [0, 0.5, -0.14], [0, 0.5, -0.42]], tip = [[0, 0.68, 0.34], [0, 0.74, 0.08], [0, 0.72, -0.2], [0, 0.62, -0.46]];
  m.fin(root, tip, [bright(1.3), bright(1.05)]).fin([...root].reverse(), [...tip].reverse(), [bright(1.05), bright(1.3)]);
  return m.geometry();
}


// ================================================================ the detailed creatures (the squid lives at the bloom water, bloom.js)
// ---------------------------------------------------------------- the squid
// Its shape is the bigfin reef squid's (Sepioteuthis lessoniana), whose fins run down nearly the whole mantle, so that from above the
// back end of it is a kite coming to a point. Arms and head toward +z, the point of the mantle toward -z: jetting, it goes point first.
// The mantle, fins, head, eyes and funnel are one model (squid). Its eight arms and two long tentacles are each a piece of their own
// (squidArm), modelled straight along +z from where it hangs on the head, the pale face with the suckers toward -y: squid.js hangs them
// on and strands.js trails each one through the water. The arms are not all one length: the pair on the back is the shortest and the
// third pair the longest, as in the real one. A tentacle is a thin stalk ending in a flat club.
const SQUID_MANTLE = [[0.03, 0.125, 0.115, 0.105], [-0.08, 0.16, 0.148, 0.132], [-0.3, 0.166, 0.152, 0.138], [-0.54, 0.138, 0.126, 0.112], [-0.76, 0.09, 0.082, 0.072], [-0.92, 0.04, 0.038, 0.034], [-1.0, 0.004, 0.004, 0.004]];
const SQUID_FIN = [[-0.1, 0.02], [-0.22, 0.1], [-0.36, 0.17], [-0.5, 0.22], [-0.63, 0.25], [-0.76, 0.225], [-0.88, 0.135], [-0.995, 0]]; // z, and how far the fin stands out from the mantle's side there
const squidLimb = (side, pair, deg, long, thick, club) => { const a = (deg * Math.PI) / 180, n = club ? 9 : 8, q = club ? 0.92 : 0.9, k = club ? 0.5 : 1, first = (long * (1 - q)) / (1 - q ** n), cuts = [0];
  for (let i = 0; i < n; i++) cuts.push(cuts[i] + first * q ** i); // its joints, closer together toward the tip, where it curls
  return { side, pair, club, long, thick, cuts, out: [side * Math.sin(a), Math.cos(a)], root: [side * Math.sin(a) * 0.058 * k, -0.005 + Math.cos(a) * 0.05 * k, 0.24] }; };
export const SQUID = { mantle: 1, length: 2.4,
  // down each side from the back to the belly: the pair, where round the mouth it hangs (degrees from the top), how long, how thick at the root. Pair 0 is the tentacle
  arms: [1, -1].flatMap((s) => [[1, 24, 0.86, 0.03], [2, 68, 1.02, 0.034], [3, 112, 1.18, 0.038], [0, 134, 1.5, 0.016], [4, 156, 1.04, 0.034]].map(([pair, deg, long, thick]) => squidLimb(s, pair, deg, long, thick, pair === 0))) };
export function squid(pal) {
  const m = mesher(), { back, flank, belly, fin, finUnder, fleck, eye, pupil } = pal, low = tint(flank, belly, 0.45);
  const paint = (i, k, n) => (k === 0 || k === n - 1 ? back : k === n / 2 - 1 || k === n / 2 ? belly : k === 1 || k === n - 2 ? flank : low);
  const at = (z) => { let i = 0; while (i < SQUID_MANTLE.length - 2 && SQUID_MANTLE[i + 1][0] > z) i++; const a = SQUID_MANTLE[i], b = SQUID_MANTLE[i + 1], t = Math.min(1, Math.max(0, (a[0] - z) / (a[0] - b[0]))); return [a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }; // the mantle's half-width and height at z
  hull(m, SQUID_MANTLE, paint, 8);
  // the fins: a wedge down each side, thick where it joins and thin at the edge, pink on top and lilac underneath
  const finFrom = m.triangles;
  both((s) => { const top = [], bot = [], edge = [];
    for (const [z, d] of SQUID_FIN) { const [w] = at(z), th = 0.024 * Math.min(1, w / 0.1) * (d > 0 ? 1 : 0.2); top.push([s * w * 0.8, 0.012 + th, z]); bot.push([s * w * 0.8, 0.012 - th, z]); edge.push([s * (w + d), -0.05 * d, z]); }
    for (let k = 0; k + 1 < edge.length; k++) { const c = k % 2 ? fin : tint(fin, back, 0.5);
      m.tri(top[k], top[k + 1], edge[k + 1], [flank, flank, c]).tri(top[k], edge[k + 1], edge[k], [flank, c, c]).quad(bot[k], bot[k + 1], edge[k + 1], edge[k], k % 2 ? finUnder : dim(finUnder, 0.94)); } });
  const finTo = m.triangles;
  // flecks: small pale faces scattered over the back
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 18; i++) { const z = -0.05 - 0.66 * rnd(), u = 0.12 + 0.76 * rnd(), s = i % 2 ? 1 : -1, l = 0.012 + 0.012 * rnd(), [w, up] = at(z), x = s * 0.707 * w * u, y = up * (1 - 0.293 * u) + 0.007;
    m.tri([x, y, z + l], [x, y, z - l], [x + s * 0.011, y - 0.0046, z - l * 0.3], fleck); }
  const fleckTo = m.triangles;
  // the head, narrow where it goes into the mantle, and the web the arms hang round
  const HEAD = [[-0.08, 0.08, 0.075, 0.07, -0.005], [0, 0.092, 0.082, 0.076, -0.005], [0.085, 0.12, 0.1, 0.09, -0.005], [0.17, 0.108, 0.09, 0.082, -0.005], [0.245, 0.076, 0.068, 0.064, -0.005]];
  hull(m, HEAD, paint, 8); m.cap(ringZ(0.245, 0.076, 0.068, 0.064, -0.005, 8), [0, 0, 1], belly, 0.03);
  for (const [x, z] of [[0.03, 0.12], [-0.045, 0.06], [0.01, 0.19]]) m.tri([x, 0.093, z + 0.014], [x, 0.093, z - 0.014], [x + 0.011, 0.091, z], fleck);
  // the eyes: big, on a stalk of their own so they stand out from the head. A pale ring, a dark pupil, a highlight
  const disc = (c, q, r, colour, glow, seg = 8) => m.add(new THREE.CircleGeometry(r, seg), new THREE.Matrix4().compose(new THREE.Vector3(...c), q, new THREE.Vector3(1, 1, 1)), colour, glow);
  both((s) => { const n = new THREE.Vector3(s, 0.14, 0.12).normalize(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n), c = [s * 0.136, 0.014, 0.094], on = (lift, dy = 0, dz = 0) => [c[0] + n.x * lift, c[1] + n.y * lift + dy, c[2] + n.z * lift + dz];
    m.limb([s * 0.09, 0.008, 0.088], c, 0.092, 0.083, 6, [flank, back]);
    disc(on(0.001), q, 0.082, eye, false, 10); disc(on(0.008), q, 0.056, pupil, true); disc(on(0.014, 0.024, 0.02), q, 0.013, '#ffffff', true, 5); }); // (the pupil is marked as lit, though it gives off next to nothing, so that it stays dark when the skin goes pale)
  // the funnel it jets through, under the head
  m.limb([0, -0.068, -0.05], [0, -0.118, 0.15], 0.05, 0.03, 5, [belly, finUnder]).cap(m.last, [0, -0.25, 1], dim(finUnder, 0.45), -0.03);
  const g = m.geometry(), P = g.attributes.position, F = new Float32Array(P.count * 4);
  // What squid.js needs to move it, for each corner: how far the corner goes (x, y) when the mantle swells by all of its own width; and, on a fin, how far
  // out from the mantle's side it is (to the animal's left, or minus that to its right), which is how much it ripples and folds
  const swell = (z) => (0.5 + 0.5 * Math.min(1, (0.03 - z) / 0.25)) * Math.min(1, (z + 1) / 0.5);
  for (let i = 0; i < fleckTo * 3; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), k = swell(z), isFin = i >= finFrom * 3 && i < finTo * 3, [w] = at(z), s = Math.sign(x);
    if (isFin && Math.abs(x) > w * 0.9) { F[i * 4] = s * w * k; F[i * 4 + 2] = s * Math.max(0.0001, Math.abs(x) - w); } else { F[i * 4] = x * k; F[i * 4 + 1] = y * k; } }
  g.setAttribute('flex', new THREE.Float32BufferAttribute(F, 4));
  return g;
}
// one arm, or one tentacle (def: its entry in SQUID.arms)
export function squidArm(pal, def) {
  const m = mesher(), { arm, armUnder: under, sucker } = pal, { long, thick: r0, cuts, club } = def, n = cuts.length - 1, shade = dim(arm, 0.88), from = cuts[n - 2];
  // how wide and how deep it is at z. An arm thins all the way to a point; a tentacle is a stalk, and then the club
  const size = (z) => { const s = Math.min(1, Math.max(0, z / long)); if (!club) { const r = r0 * (1 - 0.5 * s) * Math.min(1, (1 - s) / 0.25) ** 0.8 + 0.0025; return [r, r]; } // it keeps its width most of the way, and thins to its tip over the last quarter
    if (z <= from) return [r0 * (1 - 0.2 * s), r0 * (1 - 0.2 * s)]; const u = (z - from) / (long - from); return [r0 * 0.8 + 0.03 * Math.sin(Math.PI * u ** 0.75) + 0.001, r0 * 0.8 * (1 - u) + 0.003]; };
  const ring = (z) => { const [w, h] = size(z); return [[-w, -0.5 * h, z], [0, h, z], [w, -0.5 * h, z]]; };
  const zs = [-0.04]; for (let i = 0; i < n; i++) zs.push((cuts[i] + cuts[i + 1]) / 2, cuts[i + 1]); // a section at every joint and half way between
  m.skin(zs.map(ring), (i, k) => (k === 2 ? (club && zs[i] < from ? dim(arm, 0.94) : under) : k ? shade : arm)); // (a tentacle is pale only under its club)
  // suckers down the pale face: on an arm a few, to one side and the other by turns; on a club, two rows
  const dot = (z, x, r) => { const [, h] = size(z), y = -0.5 * h - 0.004; m.quad([x, y, z - r * 1.3], [x + r, y, z], [x, y, z + r * 1.3], [x - r, y, z], sucker); };
  if (club) for (const u of [0.25, 0.5, 0.75]) { const z = from + (long - from) * u, [w] = size(z); dot(z, w * 0.42, w * 0.3); dot(z + 0.012, -w * 0.42, w * 0.3); }
  else for (let i = 1; i < n - 2; i++) { const z = (cuts[i] + cuts[i + 1]) / 2, [w] = size(z); dot(z, (i % 2 ? 0.3 : -0.3) * w, w * 0.42); }
  return m.geometry();
}

// ================================================================ jellyfish (the moon jelly and the sea nettle live at the bloom water, bloom.js; the other two are not in the dive yet)
// Four of them, each after a real animal (the sources are at the top of jelly.js). A jellyfish is modelled upright: the top of its bell toward +y, its
// mouth and everything that hangs toward -y. It comes in three kinds of piece:
//   the body      what is solid in it and seen through the bell: gonads, stomach, canals, eyes, the stalks the tentacles hang from (moon, nettle, helmet, box)
//   the bell      its skin, drawn part clear over the body by jelly.js (moonBell, nettleBell, …); `veil` on each corner says how much of it is there
//   the strands   each oral arm and each tentacle a piece of its own, modelled straight along +z from where it hangs (moonPiece, …), trailed by strands.js
// MOON, NETTLE, HELMET and BOX say how the bell squeezes (`flex` on each corner, read by the shader in jelly.js) and where every strand hangs.
const TAU = Math.PI * 2, clamp01 = (v) => Math.min(1, Math.max(0, v));
// How a corner at (x, y, z) goes when the bell squeezes all the way: [x, y, z, how late]. Nothing above `from` (a part of the way down from the top to the
// rim) moves; from there down it is drawn in toward the middle, most at the rim, and the rim sinks a little as the bell deepens. The rim goes last.
export const squeezeOf = (D) => (x, y, z) => { const s = clamp01((D.top - y) / (D.top - D.rim)), u = clamp01((s - D.from) / (1 - D.from)), k = D.squeeze * u ** D.power; return [-x * k, -D.drop * u, -z * k, u]; };
const flexed = (g, D) => { const P = g.attributes.position, F = new Float32Array(P.count * 4), f = squeezeOf(D); for (let i = 0; i < P.count; i++) F.set(f(P.getX(i), P.getY(i), P.getZ(i)), i * 4); g.setAttribute('flex', new THREE.Float32BufferAttribute(F, 4)); return g; };
const veiled = (g, D, fn) => { const P = g.attributes.position, V = new Float32Array(P.count); for (let i = 0; i < P.count; i++) V[i] = fn(P.getX(i), P.getY(i), P.getZ(i)); g.setAttribute('veil', new THREE.Float32BufferAttribute(V, 1)); return flexed(g, D); };
// a skin over rings that is open, as a bell is: every face is turned away from `from`
const sheet = (m, rings, paint, from, glow = false) => { for (let i = 0; i + 1 < rings.length; i++) { const R0 = rings[i], R1 = rings[i + 1], n = R0.length;
  for (let k = 0; k < n; k++) { const a = R0[k], b = R0[(k + 1) % n], c = R1[(k + 1) % n], d = R1[k], p = typeof paint === 'function' ? paint(i, k, n) : paint, [c0, c1] = Array.isArray(p) && typeof p[0] !== 'number' ? p : [p, p];
    m.out(a, b, c, from, [c0, c0, c1], glow).out(a, c, d, from, [c0, c1, c1], glow); } } return m; };
const around = (phi, r, y) => [Math.sin(phi) * r, y, Math.cos(phi) * r];
const jointsOf = (long, n, q = 1) => { const first = q === 1 ? long / n : (long * (1 - q)) / (1 - q ** n), cuts = [0]; for (let i = 0; i < n; i++) cuts.push(cuts[i] + first * q ** i); cuts[n] = long; return cuts; };
// one strand: what kind it is (a: an oral arm, t: a tentacle, f: a length of fringe), where round the bell it hangs, where its root is, how long, how many joints
const hung = (kind, phi, root, long, n, q = 1, more = {}) => ({ kind, phi, root, long, cuts: jointsOf(long, n, q), ...more });
// A ribbon with a ruffled edge, for an oral arm: a rib down the middle, a lip to each side of it thrown into pleats. wide(s), deep(s): half its width and
// how far the pleats stand, at s along it (0 to 1). Two sections to a joint, so the pleats are finer than the bends.
function frilled(m, def, wide, deep, rib, lip, per = 2) {
  const zs = [0]; for (let i = 0; i + 1 < def.cuts.length; i++) for (let j = 1; j <= per; j++) zs.push(def.cuts[i] + ((def.cuts[i + 1] - def.cuts[i]) * j) / per);
  const sec = zs.map((z, j) => { const s = z / def.long, w = wide(s), d = deep(s) * (j % 2 ? 1 : -1); return [[-w, d, z], [0, -0.35 * w, z], [w, -d, z]]; });
  for (let j = 0; j + 1 < sec.length; j++) { const a = sec[j], b = sec[j + 1]; m.tri(a[0], a[1], b[1], [lip, rib, rib]).tri(a[0], b[1], b[0], [lip, rib, lip]).tri(a[1], a[2], b[2], [rib, lip, lip]).tri(a[1], b[2], b[1], [rib, lip, rib]); }
  return m;
}
// A flat ribbon, for a fine tentacle: one section to a joint. colour(i): the colour of length i
function ribbon(m, def, wide, colour) {
  const n = def.cuts.length - 1;
  for (let i = 0; i < n; i++) { const z0 = def.cuts[i], z1 = def.cuts[i + 1], w0 = wide(z0 / def.long), w1 = i === n - 1 ? 0.0008 : wide(z1 / def.long), c = colour(i, n); m.quad([-w0, 0, z0], [w0, 0, z0], [w1, 0, z1], [-w1, 0, z1], c); }
  return m;
}

// ---------------------------------------------------------------- the moon jelly (Aurelia aurita)
// A shallow saucer, colourless, with eight shallow lobes to its rim. What is seen from across the water is inside it: four horseshoes (its gonads), violet,
// lying round the middle like a clover, open toward the centre. Sixteen canals run out from them to the rim. Under it four short oral arms, each a little
// shorter than the bell is wide by half, and round the rim a fringe of fine short tentacles (here sixteen lengths of fringe, three threads to each).
export const MOON = { wide: 0.4, top: 0.075, rim: -0.012, squeeze: 0.3, drop: 0.04, from: 0.1, power: 1.25,
  strands: [...[0, 1, 2, 3].map((k) => hung('a', k * TAU / 4, around(k * TAU / 4, 0.022, 0.0), 0.17, 5)),
    ...Array.from({ length: 16 }, (_, k) => hung('f', (k + 0.5) * TAU / 16, around((k + 0.5) * TAU / 16, 0.192, -0.014), 0.055, 2, 1, { span: 0.034 }))] };
const moonRim = (y, r, k = 0.95) => Array.from({ length: 16 }, (_, i) => around(i * TAU / 16, r * (i % 2 ? 1 : k), y)); // drawn in a little at each of the eight sense organs
const moonMid = (r) => 0.057 * (1 - (r / 0.2) ** 2) - 0.004; // the height of the middle of the bell's thickness, r from the axis
export function moon(pal) {
  const m = mesher(), { gonad, gonadPale, canal, arm } = pal;
  // the four horseshoes, between the arms: a ribbon most of the way round a ring, the gap toward the middle
  for (let q = 0; q < 4; q++) { const phi = TAU / 8 + q * TAU / 4, c = around(phi, 0.09, 0), R = 0.043, w = 0.013, N = 8, at = (t, rad) => { const a = phi + Math.PI + 0.85 + t * (TAU - 1.7), x = c[0] + Math.sin(a) * rad, z = c[2] + Math.cos(a) * rad; return [x, moonMid(Math.hypot(x, z)), z]; };
    for (let i = 0; i < N; i++) m.quad(at(i / N, R - w), at(i / N, R + w), at((i + 1) / N, R + w), at((i + 1) / N, R - w), [gonadPale, gonad, gonad], true); }
  // the canals, sixteen, from the stomach out to the rim; and the stomach, a small cross over the mouth
  for (let k = 0; k < 16; k++) { const phi = k * TAU / 16, t = phi + TAU / 4, r0 = k % 2 ? 0.14 : 0.125, w = 0.0045, a = around(phi, r0, moonMid(r0)), b = around(phi, 0.192, moonMid(0.192) + 0.004); m.tri([a[0] + Math.sin(t) * w, a[1], a[2] + Math.cos(t) * w], [a[0] - Math.sin(t) * w, a[1], a[2] - Math.cos(t) * w], b, canal); }
  for (let k = 0; k < 4; k++) { const phi = k * TAU / 4, t = phi + TAU / 4, w = 0.012, b = around(phi, 0.062, moonMid(0.062)); m.tri([Math.sin(t) * w, 0.05, Math.cos(t) * w], [-Math.sin(t) * w, 0.05, -Math.cos(t) * w], b, [canal, canal, gonadPale]); }
  for (let k = 0; k < 8; k++) { const phi = k * TAU / 8, t = phi + TAU / 4, w = 0.006, a = around(phi, 0.186, -0.01); m.tri([a[0] + Math.sin(t) * w, a[1], a[2] + Math.cos(t) * w], [a[0] - Math.sin(t) * w, a[1], a[2] - Math.cos(t) * w], around(phi, 0.176, -0.002), gonad, true); } // a sense organ in each notch of the rim
  m.limb([0, 0.046, 0], [0, -0.004, 0], 0.03, 0.024, 4, [canal, arm]); // the mouth's short stalk, which the four arms hang from
  return flexed(m.geometry(), MOON);
}
export function moonBell(pal) {
  const m = mesher(), { bell, rim } = pal, rings = [moonRim(0.068, 0.072, 1), moonRim(0.047, 0.134, 1), moonRim(0.016, 0.182, 0.985), moonRim(-0.012, 0.2), moonRim(-0.019, 0.186)], from = [0, -0.05, 0];
  m.cap(rings[0], [0, 1, 0], bell, 0.007);
  sheet(m, rings, (i) => (i < 2 ? bell : i === 2 ? [bell, rim] : rim), from);
  return veiled(m.geometry(), MOON, (x, y, z) => { const r = Math.hypot(x, z) / 0.2; return 0.2 + 0.7 * r ** 4; }); // all but clear over the middle, milky at the rim
}
export function moonPiece(pal, def) {
  const m = mesher(), { arm, frill, fringe } = pal;
  if (def.kind === 'a') return frilled(m, def, (s) => 0.026 * (1 - 0.5 * s) * Math.min(1, (1 - s) / 0.25) + 0.002, (s) => 0.0045 * (1 - 0.5 * s), arm, frill).geometry();
  // a length of fringe: three fine threads side by side, each of its own length
  for (const [x, l] of [[-0.75, 0.82], [0, 1], [0.7, 0.7]]) { const X = x * def.span, mid = def.cuts[1] * l, end = def.long * l, w = 0.0034; m.quad([X - w, 0, 0], [X + w, 0, 0], [X + w * 0.7, 0, mid], [X - w * 0.7, 0, mid], fringe).tri([X - w * 0.7, 0, mid], [X + w * 0.7, 0, mid], [X, 0, end], fringe); }
  return m.geometry();
}

// The moon jelly from a little way off, for a bloom of them (bloom.js draws dozens at once): the saucer in eight sides and the four horseshoes
// laid on top of it, about sixty faces where the whole animal has 550. No strands, nothing that squeezes: what moves it is how it is drawn.
export function moonFar(pal) {
  const m = mesher(), { bell, rim, gonad, gonadPale } = pal, rings = [[0.068, 0.07], [0.04, 0.14], [0.006, 0.19], [-0.014, 0.2]].map(([y, r]) => ringY(y, r, 8, { turn: TAU / 16 }));
  m.cap(rings[0], [0, 1, 0], bell, 0.008);
  sheet(m, rings, (i) => (i < 2 ? bell : [bell, rim]), [0, -0.05, 0]);
  for (let q = 0; q < 4; q++) { const phi = TAU / 8 + q * TAU / 4, c = around(phi, 0.085, 0), at = (t, rad) => { const a = phi + Math.PI + 0.85 + t * (TAU - 1.7), x = c[0] + Math.sin(a) * rad, z = c[2] + Math.cos(a) * rad, r = Math.hypot(x, z); return [x, 0.071 - 0.29 * r * r + 0.009, z]; };
    for (let i = 0; i < 3; i++) m.quad(at(i / 3, 0.022), at(i / 3, 0.06), at((i + 1) / 3, 0.06), at((i + 1) / 3, 0.022), [gonad, gonad, gonadPale]); } // a little bigger and bolder than the whole animal's, so that they still read from across the bloom
  return m.geometry();
}

// ---------------------------------------------------------------- the sea nettle (the Pacific one, Chrysaora fuscescens)
// A deep amber bell, darkest toward the rim, with no more than a faint pale star on it (the stripes belong to its northern cousin). Its rim is cut into
// lappets. Twenty-four fine dark red tentacles hang from it, three between each two of its eight sense organs, and from the mouth four long pale oral arms,
// ruffled along both edges and wound in a spiral.
export const NETTLE = { wide: 0.5, top: 0.2, rim: 0, squeeze: 0.36, drop: 0.06, from: 0.18, power: 1.4,
  strands: [...[0, 1, 2, 3].map((k) => hung('a', (k + 0.5) * TAU / 4, around((k + 0.5) * TAU / 4, 0.03, -0.03), 1.45 + 0.12 * (k % 2), 12, 0.97)),
    ...Array.from({ length: 24 }, (_, i) => { const phi = (Math.floor(i / 3) + (i % 3 + 1) / 4) * TAU / 8, f = (i * 0.618) % 1; return hung('t', phi, around(phi, 0.243, 0.002), 2.4 * (0.82 + 0.3 * f), 14, 0.98); })] };
const NETTLE_BELL = [[0.085, 0.188], [0.16, 0.152], [0.215, 0.092], [0.245, 0.032], [0.25, 0]];
export function nettle(pal) {
  const m = mesher(), { gut, gutDark, arm, frill } = pal;
  // what shows through the top of the bell: the stomach, in four pouches
  const top = ringY(0.158, 0.105, 8, { star: 0.62, turn: TAU / 16 }), low = ringY(0.1, 0.085, 8, { star: 0.7, turn: TAU / 16 });
  m.cap(top, [0, 1, 0], [gut, gutDark, gutDark], 0.02); m.skin([top, low], (i, k) => (k % 2 ? gut : gutDark));
  m.limb([0, 0.11, 0], [0, -0.035, 0], 0.07, 0.05, 6, [gutDark, arm]).cap(m.last, [0, -1, 0], frill, 0.03); // the mouth's stalk
  return flexed(m.geometry(), NETTLE);
}
export function nettleBell(pal) {
  const m = mesher(), { bell, rim, ray, lappet } = pal, rings = NETTLE_BELL.map(([r, y]) => ringY(y, r, 16)), from = [0, 0.02, 0], mix = [0, 0.06, 0.2, 0.5, 0.85];
  const tone = (i, k) => tint(tint(bell, rim, mix[i]), ray, k % 2 ? 0.34 * (1 - mix[i]) : 0); // every other face a little paler: the star
  m.cap(rings[0], [0, 1, 0], [tint(bell, ray, 0.3), bell, bell], 0.012);
  sheet(m, rings, (i, k) => [tone(i, k), tone(i + 1, k)], from);
  sheet(m, [rings[4], ringY(-0.008, 0.222, 16)], rim, [0, 0.3, 0]); // the rim's own thickness, turned under
  // the lappets: two tongues to each side of the rim
  for (let k = 0; k < 16; k++) { const a = rings[4][k], b = rings[4][(k + 1) % 16], at = (t, down) => { const x = a[0] + (b[0] - a[0]) * t, z = a[2] + (b[2] - a[2]) * t, r = Math.hypot(x, z), R = down ? 0.252 : 0.25; return [x / r * R, down ? -0.034 : 0, z / r * R]; };
    m.tri(at(0.03), at(0.47), at(0.25, true), [rim, rim, lappet]).tri(at(0.53), at(0.97), at(0.75, true), [rim, rim, lappet]); }
  return veiled(m.geometry(), NETTLE, (x, y) => 0.74 + 0.2 * clamp01(1 - y / 0.2));
}
export function nettlePiece(pal, def) {
  const m = mesher(), { arm, frill, tentacle, tentacleTip } = pal;
  if (def.kind === 'a') return frilled(m, def, (s) => (0.075 - 0.05 * s) * Math.min(1, (1 - s) / 0.12) + 0.004, (s) => 0.021 * (1 - 0.6 * s), arm, frill).geometry();
  return ribbon(m, def, (s) => 0.0105 - 0.006 * s, (i, n) => tint(tentacle, tentacleTip, (i / n) ** 1.5)).geometry();
}

// ---------------------------------------------------------------- the helmet jelly (Periphylla periphylla)
// Taller than it is wide and coming to a point. The outside of the dome is as clear as glass; what is seen is the stomach inside it, a dark red cone.
// A deep groove runs round it a third of the way up, and below the groove is the crown: sixteen thick blocks, each ending in a lappet. Twelve thick
// stiff tentacles stand in the clefts between the lappets, three between each two of its four sense organs. Its light is blue-green and is in the
// groove and the lappets, not inside it.
export const HELMET = { wide: 0.35, top: 0.345, rim: -0.1, squeeze: 0.34, drop: 0.035, from: 0.775, power: 1,
  strands: Array.from({ length: 16 }, (_, k) => k).filter((k) => k % 4).map((k) => hung('t', k * TAU / 16, around(k * TAU / 16, 0.17, -0.082), 0.5 * (k % 4 === 2 ? 1 : 0.92), 7, 0.96)) };
export function helmet(pal) {
  const m = mesher(), { core, coreLit, crown, crownDark, lappet, mouth, light } = pal;
  // the stomach: a cone of dark red filling the top of the dome
  const cone = [[0.04, 0.225], [0.082, 0.105], [0.104, 0.012], [0.1, -0.012]].map(([r, y]) => ringY(y, r, 8, { turn: TAU / 16 }));
  m.cap(cone[0], [0, 1, 0], [coreLit, core, core], 0.085); m.skin(cone, (i, k) => ((i + k) % 2 ? core : coreLit));
  // the crown under the groove: sixteen blocks, light and dark by turns, each with its lappet
  const neck = ringY(-0.008, 0.126, 16, { turn: TAU / 32 }), swell = ringY(-0.042, 0.166, 16, { turn: TAU / 32 }), edge = ringY(-0.09, 0.176, 16, { turn: TAU / 32 });
  sheet(m, [neck, swell, edge], (i, k) => (k % 2 ? crown : crownDark), [0, -0.03, 0]);
  for (let k = 0; k < 16; k++) { const a = edge[k], b = edge[(k + 1) % 16], mid = (t, r, y) => { const x = a[0] + (b[0] - a[0]) * t, z = a[2] + (b[2] - a[2]) * t, l = Math.hypot(x, z); return [x / l * r, y, z / l * r]; }, c = k % 2 ? crown : crownDark;
    const l0 = mid(0.14, 0.178, -0.092), l1 = mid(0.86, 0.178, -0.092), t0 = mid(0.3, 0.181, -0.142), t1 = mid(0.7, 0.181, -0.142);
    m.quad(l0, l1, t1, t0, [c, c, lappet]).tri(t0, t1, mid(0.5, 0.176, -0.162), lappet); // the lappet: a rounded tongue
    m.tri(mid(0.36, 0.184, -0.118), mid(0.64, 0.184, -0.118), mid(0.5, 0.184, -0.15), light, true); } // and the light on it
  // the light in the groove: a broken ring
  for (let k = 0; k < 16; k++) { const p0 = (k + 0.14) * TAU / 16, p1 = (k + 0.86) * TAU / 16; m.quad(around(p0, 0.129, 0.004), around(p1, 0.129, 0.004), around(p1, 0.138, -0.016), around(p0, 0.138, -0.016), light, true); }
  // underneath: the hollow of the bell, dark, and the mouth
  m.cap(ringY(-0.09, 0.16, 8), [0, 1, 0], [mouth, crownDark, crownDark], 0.05);
  return flexed(m.geometry(), HELMET);
}
export function helmetBell(pal) {
  const m = mesher(), { glass } = pal, rings = [[0.036, 0.3], [0.078, 0.21], [0.116, 0.105], [0.14, 0.025], [0.128, -0.006]].map(([r, y]) => ringY(y, r, 16, { turn: TAU / 32 }));
  m.cap(rings[0], [0, 1, 0], glass, 0.045); sheet(m, rings, glass, [0, 0.1, 0]);
  return veiled(m.geometry(), HELMET, (x, y) => 0.1 + 0.16 * clamp01(1 - y / 0.3) ** 2);
}
export function helmetPiece(pal, def) {
  const m = mesher(), { tentacle, tentacleTip } = pal, n = def.cuts.length - 1, r = (s) => 0.017 * (1 - 0.8 * s) + 0.0012;
  const ring = (z) => { const w = r(z / def.long); return [[-w, -0.6 * w, z], [0, w, z], [w, -0.6 * w, z]]; };
  m.skin(def.cuts.map((z, i) => ring(i === 0 ? -0.02 : z)), (i, k) => { const c0 = tint(tentacle, tentacleTip, (i / n) ** 1.3), c1 = tint(tentacle, tentacleTip, ((i + 1) / n) ** 1.3); return k === 1 ? [dim(c0, 0.82), dim(c1, 0.82)] : [c0, c1]; });
  return m.geometry();
}

// ---------------------------------------------------------------- the box jelly (the sea wasp, Chironex fleckeri)
// A bell that is square from above, flat on top, clear, with a paler rib down each of its four corners. Low on each flat side, a quarter of the way
// up, an eye-stalk hangs in a niche: a dark dot. At each corner under the rim a fleshy stalk like a hand, and from each finger of it a long flat
// tentacle, ringed along its length. A shelf of skin turns in under the rim and narrows the opening, which is what makes its stroke a jet.
// The real one has up to fifteen tentacles to a corner; here there are five.
const boxRing = (y, w, p = 8) => Array.from({ length: 12 }, (_, k) => { const a = Math.floor(k / 3) * TAU / 4 + [0, 0.66, 0.91][k % 3], r = w / (Math.abs(Math.cos(a)) ** p + Math.abs(Math.sin(a)) ** p) ** (1 / p); return [Math.sin(a) * r, y, Math.cos(a) * r]; });
const BOX_FINGERS = [-2, -1, 0, 1, 2];
const boxHand = (q) => { const phi = TAU / 8 + q * TAU / 4, out = [Math.sin(phi), Math.cos(phi)], tan = [Math.cos(phi), -Math.sin(phi)], wrist = [out[0] * 0.166, -0.012, out[1] * 0.166], palm = [out[0] * 0.186, -0.085, out[1] * 0.186];
  return { phi, wrist, palm, tips: BOX_FINGERS.map((j) => [palm[0] + tan[0] * j * 0.021 + out[0] * (0.016 - 0.011 * Math.abs(j)), -0.128 + 0.008 * Math.abs(j), palm[2] + tan[1] * j * 0.021 + out[1] * (0.016 - 0.011 * Math.abs(j))]) }; };
export const BOX = { wide: 0.27, top: 0.3, rim: 0, squeeze: 0.37, drop: 0.02, from: 0.22, power: 1.2,
  strands: [0, 1, 2, 3].flatMap((q) => { const h = boxHand(q); return h.tips.map((tip, j) => hung('t', h.phi + (j - 2) * 0.16, tip, 1.25 * (1 - 0.07 * Math.abs(j - 2)), 12, 0.97)); }) };
export function box(pal) {
  const m = mesher(), { gut, gonad, eye, pedal, rib } = pal;
  // the stomach under the flat top, and the mouth on its trunk
  const roof = ringY(0.262, 0.07, 4, { turn: TAU / 8 }); m.cap(roof, [0, 1, 0], gut, 0.012).skin([roof, ringY(0.2, 0.034, 4, { turn: TAU / 8 }), ringY(0.125, 0.03, 4, { turn: TAU / 8 }), ringY(0.1, 0.046, 4, { turn: TAU / 8 })], (i) => (i === 2 ? rib : gut));
  for (let q = 0; q < 4; q++) { const h = boxHand(q), o = [Math.sin(h.phi), Math.cos(h.phi)], t = [Math.cos(h.phi), -Math.sin(h.phi)];
    // inside each corner, two leaves of gonad
    for (const s of [1, -1]) { const at = (r, y, w) => [o[0] * r + t[0] * w * s, y, o[1] * r + t[1] * w * s]; m.quad(at(0.142, 0.225, 0.012), at(0.1, 0.2, 0.05), at(0.106, 0.07, 0.056), at(0.146, 0.045, 0.012), [gonad, gonad, dim(gonad, 0.9)]); }
    // the hand at the corner: a wrist, a flat palm, five fingers
    m.limb(h.wrist, h.palm, 0.03, 0.034, 4, [rib, pedal]);
    for (const tip of h.tips) m.limb([h.palm[0] + (tip[0] - h.palm[0]) * 0.3, h.palm[1] + 0.012, h.palm[2] + (tip[2] - h.palm[2]) * 0.3], tip, 0.012, 0.007, 3, pedal);
    // the eye-stalk on the flat side next to it: a dark club in a niche of the wall
    const a = q * TAU / 4, f = [Math.sin(a), Math.cos(a)], s2 = [Math.cos(a), -Math.sin(a)], on = (r, y, w) => [f[0] * r + s2[0] * w, y, f[1] * r + s2[1] * w];
    m.tri(on(0.126, 0.1, -0.02), on(0.126, 0.1, 0.02), on(0.12, 0.066, 0), [rib, rib, pedal]); // the stalk it hangs by
    m.quad(on(0.128, 0.078, 0), on(0.128, 0.062, 0.014), on(0.128, 0.044, 0), on(0.128, 0.062, -0.014), eye).quad(on(0.111, 0.078, 0), on(0.111, 0.062, -0.014), on(0.111, 0.044, 0), on(0.111, 0.062, 0.014), eye); }
  return flexed(m.geometry(), BOX);
}
export function boxBell(pal) {
  const m = mesher(), { bell, rib } = pal, rings = [[0.07, 0.292], [0.118, 0.264], [0.131, 0.2], [0.132, 0.09], [0.138, 0]].map(([w, y]) => boxRing(y, w)), from = [0, 0.1, 0];
  m.cap(rings[0], [0, 1, 0], bell, 0.008);
  sheet(m, rings, (i, k) => (k % 3 === 1 ? rib : bell), from); // (the face across each corner is the rib)
  sheet(m, [rings[4], boxRing(-0.008, 0.094)], [rib, bell], [0, 0.3, 0]); // the shelf turned in under the rim
  return veiled(m.geometry(), BOX, (x, y, z) => { const c = Math.abs(2 * x * z) / (x * x + z * z + 1e-9); return (y < -0.001 ? 0.3 : 0.17) + 0.42 * c ** 3; });
}
export function boxPiece(pal, def) {
  const { tentacle, band } = pal;
  return ribbon(mesher(), def, (s) => 0.0095 - 0.0045 * s, (i) => (i % 2 ? tint(tentacle, band, 0.55) : tentacle)).geometry(); // ringed: light and dark by turns
}

// ================================================================ the sand flat (not yet in the dive)
// A batch made for the sand flat of the first band, and one for the oarfish's long body. Each after a real animal: the sources, and the
// one trait chosen for each, are at the top of its own file (hermit.js, trumpet.js, burrow.js, gardeneel.js, puffer.js). Models only, as
// everything here is; the files named put them together and move them. Nothing in the dive asks for any of them.
const denser = (B) => B.flatMap((r, i) => (i ? [r.map((v, k) => (v + B[i - 1][k]) / 2), r] : [r])); // a ring half way between every two
const sandStrand = (side, long, root, way, n) => ({ side, long, root, way, cuts: Array.from({ length: n + 1 }, (_, i) => (long * i) / n) });
// a tapered piece of a few sides from a to b, in bands of two colours: what a leg or a feeler is made of at this size
const banded = (m, a, b, ra, rb, n, bands, c0, c1) => { for (let i = 0; i < bands; i++) { const t0 = i / bands, t1 = (i + 1) / bands, p = (t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; m.limb(p(t0), p(t1), ra + (rb - ra) * t0, ra + (rb - ra) * t1, n, i % 2 ? c1 : c0); } return m; };

// ---------------------------------------------------------------- the hermit crab
// The front half of a crab and the soft back half of a lobster, which lives in a shell it did not make. Head toward +z, back toward +y, its left
// toward +x, in metres for the middle of the four sizes (hermit.js scales it). Made of pieces, which hermit.js puts together:
//   hermit         the shield over its front half, the face, and the sockets of everything
//   hermitLeg      the two lengths of a walking leg: two pairs walk (legs.js); the two pairs behind them are small and hold the shell from inside, and are not drawn
//   hermitClaw     a claw in three pieces, as the Keeper's: arm, hand with the fixed finger, the finger that moves. The right one is the big one, wide and flat
//                  enough to shut the shell's mouth like a door; the left is small
//   hermitEye      a stalk and the eye on its top, which turns there
//   hermitFeeler   the two long feelers and the two short ones, each trailed by strands.js
//   hermitTail     the soft curled back half, which is only seen when it is out of its shell
//   hermitShell    the plain snail shell it starts in: a turban of whorls with a lip and a dark mouth (it can also wear any of the ten the oarfish carries)
// HERMIT says where they join, and where the mouth of its shell sits (`mouth`, and `inward`, the way into the shell).
export const HERMIT = {
  ride: 0.07, // how far the body's origin is carried over the ground its feet are on
  legs: [1, -1].flatMap((s) => [0, 1].map((i) => ({ side: s, group: (i + (s > 0 ? 0 : 1)) % 2, l1: 0.085, l2: 0.118, hip: [s * 0.04, -0.012, [0.03, 0.002][i]], rest: [s * [0.12, 0.145][i], [0.13, 0.0][i]], curl: [s * 0.03, -0.02, 0.04] }))),
  // the right claw is the big one (as in most hermit crabs of the family Paguridae): l1, l2: arm and hand; span: the fingers past the hinge; stout: how thick
  claws: [
    { side: -1, big: true, shoulder: [-0.03, -0.01, 0.06], l1: 0.052, l2: 0.075, span: 0.056, stout: 1.25, hinge: [0, 0.01, 0.068] },
    { side: 1, big: false, shoulder: [0.03, -0.01, 0.06], l1: 0.042, l2: 0.045, span: 0.034, stout: 0.6, hinge: [0, 0.005, 0.042] },
  ],
  eyes: [1, -1].map((side) => ({ side, socket: [side * 0.013, 0.02, 0.066] })), stalk: 0.048,
  feelers: [1, -1].flatMap((side) => [sandStrand(side, 0.21, [side * 0.024, 0.002, 0.07], [side * 0.5, 0.28, 0.82], 6), sandStrand(side, 0.055, [side * 0.006, 0.012, 0.072], [side * 0.18, 0.62, 0.76], 3)]),
  mouth: [0, 0.0, -0.038], inward: [0, 0.36, -1], // the shell's mouth, where the shield goes into it, and the way in
  sizes: [1, 1.3, 1.65, 2.1], // the four sizes of a line, each in a shell a size up from the one behind it (1 is the model as made, and the one in the library)
};
const HERMIT_SHIELD = [[-0.045, 0.03, 0.02, 0.018, 0.002], [-0.022, 0.046, 0.03, 0.022, 0.004], [0.012, 0.05, 0.034, 0.024, 0.006], [0.045, 0.042, 0.029, 0.02, 0.006], [0.068, 0.026, 0.017, 0.014, 0.004]];
export function hermit(pal) {
  const m = mesher(), { body, bodyPale, belly, leg } = pal, dark = dim(body, 0.72), top = tint(body, bodyPale, 0.35);
  // the shield: hard and pale-flecked over the front, softer and paler behind, where it goes into the shell
  m.skin(HERMIT_SHIELD.map(([z, w, up, dn, y]) => ringZ(z, w, up, dn, y, 8)), (i, k, n) => (k === 0 || k === n - 1 ? (i < 2 ? tint(top, belly, 0.4) : top) : k === n / 2 - 1 || k === n / 2 ? belly : i < 1 ? tint(body, belly, 0.4) : body));
  m.cap(ringZ(-0.045, 0.03, 0.02, 0.018, 0.002, 8), [0, 0, -1], tint(belly, body, 0.3), 0.012);
  m.cap(ringZ(0.068, 0.026, 0.017, 0.014, 0.004, 8), [0, 0, 1], dark, 0.008);
  m.limb([0, 0.016, 0.06], [0, 0.012, 0.086], 0.007, 0.001, 3, [body, bodyPale]); // the point between the eyes
  m.quad([-0.022, 0.03, -0.012], [0.022, 0.03, -0.012], [0.026, 0.031, 0.03], [-0.026, 0.031, 0.03], [bodyPale, bodyPale, top]); // the hard plate on top, the pale shield
  for (const [x, z] of [[0.014, 0.0], [-0.016, 0.012], [0.006, 0.026], [-0.004, -0.004], [0.02, 0.02]]) m.tri([x, 0.0335, z + 0.004], [x - 0.0035, 0.0335, z - 0.003], [x + 0.0035, 0.0335, z - 0.003], '#fff4ea'); // pale flecks on it
  // the sockets everything turns in
  for (const e of HERMIT.eyes) m.limb([e.socket[0] * 0.6, e.socket[1] - 0.008, e.socket[2] - 0.008], e.socket, 0.009, 0.008, 5, dark);
  for (const l of HERMIT.legs) m.limb([l.hip[0] * 0.6, l.hip[1] + 0.004, l.hip[2]], l.hip, 0.012, 0.011, 5, [dark, leg]);
  for (const c of HERMIT.claws) m.limb([c.shoulder[0] * 0.5, c.shoulder[1] + 0.004, c.shoulder[2] - 0.008], c.shoulder, 0.015 * (c.big ? 1 : 0.8), 0.014 * (c.big ? 1 : 0.8), 5, dark);
  // the mouthparts under the face: a little bundle of pale pieces that work
  both((s) => m.limb([s * 0.008, -0.012, 0.062], [s * 0.012, -0.024, 0.074], 0.005, 0.002, 3, [belly, bodyPale]));
  return m.geometry();
}
// the two lengths of a walking leg, banded: the upper from the body to the knee, the lower ending in a long dark point
export function hermitLeg(pal) {
  const { leg, legBand, clawTip } = pal, { l1, l2 } = HERMIT.legs[0];
  const upper = banded(mesher(), [0, 0, -0.006], [0, 0.002, l1], 0.0135, 0.0115, 5, 3, leg, legBand);
  upper.cap(upper.last, [0, 0, 1], legBand, 0.006);
  for (const z of [0.03, 0.06, 0.085]) upper.limb([0, 0.008, z], [0, 0.015, z + 0.006], 0.0028, 0.0004, 3, legBand); // a few bristles along the top
  const lower = banded(mesher(), [0, 0, -0.004], [0, 0.002, l2 * 0.62], 0.011, 0.0088, 5, 2, legBand, leg);
  lower.limb([0, 0.002, l2 * 0.6], [0, 0, l2], 0.0082, 0.001, 4, [leg, clawTip]); // the last length, a long point
  return { upper: upper.geometry(), lower: lower.geometry() };
}
// One claw (c: its entry in HERMIT.claws), in three pieces as the Keeper's are: the arm, the hand with the fixed finger, the finger that moves (its pin
// at c.hinge, lifting toward +y). The big one's hand is broad and flat, studded with pale knobs, so that turned edge-on it shuts the mouth of the shell.
export function hermitClaw(pal, c) {
  const { claw, legBand, clawTip, bodyPale } = pal, w = c.stout, { l1, l2, span: f, hinge } = c, knob = tint(claw, '#fff4ea', 0.55), dark = dim(claw, 0.78);
  const arm = mesher().limb([0, 0, -0.006], [0, 0, l1], 0.012 * w + 0.003, 0.011 * w + 0.003, 5, [dark, claw]); arm.cap(arm.last, [0, 0, 1], legBand, 0.005);
  // the hand: wide across (x), flat (y), most of all on the big one
  const flat = c.big ? 0.62 : 0.8, hand = mesher(), H = [[-0.004, 0.012, 0.011], [l2 * 0.25, 0.019, 0.015], [l2 * 0.6, 0.024, 0.017], [l2 * 0.94, 0.022, 0.016]].map(([z, wx, wy]) => ringZ(z, wx * w + 0.002, wy * w * flat + 0.002, wy * w * flat + 0.002, 0, 6));
  hand.skin(H, (i, k) => (k === 0 || k === 5 ? tint(claw, bodyPale, 0.25) : k === 2 || k === 3 ? dark : claw)).cap(H[0], [0, 0, -1], dark, 0.004);
  const low = [[0, -0.006 * w, l2 * 0.9], [0, -0.008 * w, l2 + f * 0.95]], up = [[0, 0, -0.004], [0, 0.002, f]];
  const finger = (m, [a, b], r0) => { const mid = [0, a[1] + (b[1] - a[1]) * 0.75, a[2] + (b[2] - a[2]) * 0.75]; m.limb(a, mid, r0, r0 * 0.6, 5, claw).limb(mid, b, r0 * 0.6, 0.0015, 4, [claw, clawTip]); };
  finger(hand, low, 0.012 * w + 0.002); hand.cap(H[3], [0, 0, 1], claw, 0.004);
  const knobs = c.big ? [[0.3, 0.6], [0.5, -0.4], [0.62, 0.3], [0.78, -0.2], [0.45, 0.05], [0.85, 0.55]] : [[0.4, 0.3], [0.7, -0.2]];
  for (const [t, x] of knobs) { const z = l2 * t; hand.limb([x * 0.018 * w, 0.012 * w * flat, z], [x * 0.02 * w, 0.019 * w * flat + 0.002, z + 0.002], 0.0032 * w + 0.001, 0.0006, 3, knob); } // pale knobs on its top
  const top = mesher(); finger(top, up, 0.011 * w + 0.002);
  for (const t of [0.3, 0.55]) top.limb([0, 0.008 * w, f * t], [0, 0.013 * w + 0.002, f * t + 0.003], 0.0026 * w + 0.0008, 0.0004, 3, knob);
  return { arm: arm.geometry(), hand: hand.geometry(), finger: top.geometry(), hinge };
}
// an eye: the stalk stands up (+y) from its socket; the eye sits on its top, modelled about its own middle and looking along +z, dark with a pale rim
export function hermitEye(pal) {
  const { body, bodyPale, eye, eyeRing } = pal, L = HERMIT.stalk;
  const stalk = banded(mesher(), [0, -0.006, 0], [0, L - 0.006, 0], 0.0075, 0.0068, 5, 2, body, tint(body, bodyPale, 0.5));
  const m = mesher(), ball = [[-0.008, 0.006], [-0.002, 0.0115], [0.007, 0.012], [0.013, 0.007]].map(([z, r]) => ringZ(z, r, r, r, 0, 7));
  m.skin(ball, (i) => (i < 1 ? body : i < 2 ? eyeRing : eye)).cap(ball[0], [0, 0, -1], body, 0.003).cap(ball[3], [0, 0, 1], eye, 0.004);
  m.eye([0, 0.006, 0.0125], [0, 0.45, 1], 0.0052, { iris: eyeRing, pupil: eye, rim: eye, glow: true });
  return { stalk: stalk.geometry(), ball: m.geometry() };
}
// a feeler (def: its entry in HERMIT.feelers): along +z, three-sided, ringed, thinning to nothing
export function hermitFeeler(pal, def) {
  const m = mesher(), { feeler, legBand } = pal, n = def.cuts.length - 1, r0 = def.long > 0.1 ? 0.0042 : 0.0036;
  const ring = (z, i) => { const r = i === n ? 0.0006 : r0 * (1 - 0.7 * (i / n)); return [[-r, -0.5 * r, z], [0, r, z], [r, -0.5 * r, z]]; };
  m.skin(def.cuts.map((z, i) => ring(i === 0 ? -0.006 : z, i)), (i) => (i % 2 ? tint(feeler, legBand, 0.5) : feeler));
  if (def.long < 0.1) m.limb([0, 0, def.long * 0.6], [0, 0, def.long], 0.006, 0.0015, 4, tint(feeler, legBand, 0.3)); // the short ones end in a little brush
  return m.geometry();
}
// The soft back half, curled to the right as the inside of a shell is, ending in the small hooked fan it grips the shell with. Hung on behind the
// shield (at z -0.04) and only drawn when it is out of its shell.
export function hermitTail(pal) {
  const m = mesher(), { belly, bodyPale, clawTip } = pal, n = 10, rings = [];
  const at = (t) => { const a = 3.3 * t; return [-0.05 * (1 - Math.cos(a)) * (1 - 0.35 * t), 0.012 + 0.03 * Math.sin(a) * (1 - 0.3 * t) + 0.025 * t, -0.036 - 0.105 * t]; };
  for (let i = 0; i <= n; i++) { const t = i / n, p = at(t), q = at(Math.min(1, t + 0.02)), d = new THREE.Vector3(q[0] - p[0], q[1] - p[1], q[2] - p[2]).normalize(), u = new THREE.Vector3(0, 1, 0).addScaledVector(d, -d.y).normalize(), v = new THREE.Vector3().crossVectors(d, u), r = 0.029 * (1 - 0.62 * t) + 0.004;
    rings.push(Array.from({ length: 6 }, (_, k) => { const a = (k / 6) * Math.PI * 2, c = Math.cos(a) * r, s = Math.sin(a) * r * 1.1; return [p[0] + u.x * c + v.x * s, p[1] + u.y * c + v.y * s, p[2] + u.z * c + v.z * s]; })); }
  m.skin(rings, (i, k) => (k === 0 || k === 5 ? (i % 2 ? tint(belly, bodyPale, 0.4) : belly) : i % 2 ? belly : tint(belly, '#ffffff', 0.25)));
  const e = at(1); m.cap(rings[n], [0, 0, -1], belly, 0.006);
  both((s) => m.limb(e, [e[0] + s * 0.01, e[1] - 0.006, e[2] - 0.02], 0.005, 0.001, 3, [bodyPale, clawTip])); // the little hooks it holds on with
  return m.geometry();
}
// The plain snail shell it is found in: a turban of three whorls and a half, the mouth at the foot with a lip turned out and the dark inside. Stood on
// its own as the shells of the game are (the point up, y = 0 at the bottom), and HERMIT_WEAR says how it is worn like any of theirs.
export function hermitShell(pal) {
  const m = mesher(), { shell, shellBand, shellLine, mouth, lip } = pal, W = 3.4, n = 6, steps = 30, k = 2.4, g1 = Math.exp(-k), Rc = 0.13, Rt = 0.115, Hs = 0.42;
  const c = (u) => { const g = Math.exp(-k * u), a = -u * W * Math.PI * 2; return [g * Rc * Math.cos(a), Hs * (1 - g) / (1 - g1) + 0.12, g * Rc * Math.sin(a)]; };
  const rings = [];
  for (let i = 0; i <= steps; i++) { const u = i / steps, p = c(u), q = c(Math.max(0, u - 0.01)), d = new THREE.Vector3(q[0] - p[0], q[1] - p[1], q[2] - p[2]).normalize(), r = Rt * Math.exp(-k * u) * (i === 0 ? 1.16 : 1) + 0.002;
    const side = new THREE.Vector3(p[0], 0, p[2]).normalize(), up = new THREE.Vector3().crossVectors(d, side).normalize(), out = new THREE.Vector3().crossVectors(up, d).normalize();
    rings.push(Array.from({ length: n }, (_, j) => { const a = (j / n) * Math.PI * 2, x = Math.cos(a) * r, y = Math.sin(a) * r; return [p[0] + out.x * x + up.x * y, p[1] + out.y * x + up.y * y, p[2] + out.z * x + up.z * y]; })); }
  // banded across its whorls, with a darker line spiralling along the shoulder of each
  m.skin(rings, (i, j) => (i === 0 ? lip : j === 1 ? shellLine : (Math.floor(i / 2) % 3 === 0 ? shellBand : j === 4 ? tint(shell, shellBand, 0.3) : shell)));
  m.cap(rings[steps], [0, 1, 0], shellBand, 0.01);
  m.cap(rings[0], [-c(0.01)[0] + c(0)[0], 0, -c(0.01)[2] + c(0)[2]], [mouth, lip, lip], -0.06); // the mouth: dark, deep inside
  return m.geometry();
}
// How each shell is worn. Its mouth goes where HERMIT.mouth is, facing the way the crab faces and a little down, so that the way into it is
// HERMIT.inward; the rest of the shell lies behind that, turned so that its `up` is up (and a little to the crab's right, as a shell carried on a
// curled body leans). All in the shell's own space: `p` its mouth (or, for a shell with none, where the crab goes under it), `into` the way into it
// from there, `up` the side of it to turn up; `fit`, how long it is (its longest measure) on a crab of size 1. Those with `lid` have no mouth, and
// are carried like a roof. The snail first, then the oarfish's ten.
export const HERMIT_WEAR = {
  snail: { p: [0.13, 0.12, 0], into: [-0.1, 0.37, -0.92], up: [0, 1, 0], fit: 0.34 },
  spire: { p: [0.26, 0.11, 0.24], into: [-0.6, 0.1, -0.8], up: [0, 1, 0], fit: 0.42 },
  fan: { p: [0, 0.18, 0], into: [0, 1, 0], up: [0, 0, 1], fit: 0.3, lid: true },
  coil: { p: [-0.34, 0.85, 0], into: [-0.57, -0.82, 0], up: [0.82, -0.57, 0], fit: 0.32 },
  ring: { p: [0.6, 0.62, 0], into: [-1, 0, 0], up: [0, 1, 0], fit: 0.3, lid: true },
  horn: { p: [0.46, 0.22, 0], into: [-0.89, 0.45, 0], up: [0.45, 0.89, 0], fit: 0.42 },
  cap: { p: [0, 0.1, 0.32], into: [0, 0, -1], up: [0, 1, 0], fit: 0.3, lid: true },
  spine: { p: [0.15, 0.28, 0.2], into: [-0.6, 0, -0.8], up: [0, 1, 0], fit: 0.38 },
  lamp: { p: [0, 0.3, 0.36], into: [0, 0, -1], up: [0, 1, 0], fit: 0.3, lid: true },
  tusk: { p: [0, 0.06, -0.4], into: [0.07, 0.35, 1], up: [0, 1, 0], fit: 0.42 },
  pearl: { p: [0, 0.12, 0.16], into: [0, 0, -1], up: [0, 1, 0], fit: 0.3, lid: true },
};

// ---------------------------------------------------------------- the trumpetfish
// A metre of stick: long, thin, flattened from side to side, a tube of a snout with a little mouth at its end and a barbel under the chin, a row
// of short separate spines along the back, and the fins that drive it all at the back: the soft back fin over the fin under it, and a small round
// tail. Head toward +z. Its pieces, which trumpet.js puts together:
//   trumpet        the body, snout, eyes, the soft back fin and the fin under it. Those two fins ripple in its shader, and the floor of the snout
//                  swells for the strike (`flex` on each corner: x, how far out along a fin; y, how much of the throat; z, which fin)
//   trumpetSpine   one of the separate spines in front of the soft back fin, which lie flat or stand
//   trumpetFin     a pectoral or a pelvic fin, which flutters; trumpetTail the round tail fin; trumpetJaw the lower lip of the snout, which drops
//   trumpetBarbel  the barbel on the chin, trailed by strands.js
export const TRUMPET = { length: 1, neck: 0.16, size: 1.4, // modelled at a metre, the real one's greatest length; trumpet.js shows it 1.4 times that, to read from the dive's camera
  body: [[0.5, 0.0075, 0.0075, 0.0075, -0.002], [0.47, 0.0085, 0.009, 0.009, -0.002], [0.38, 0.0105, 0.012, 0.012, 0], [0.29, 0.0135, 0.017, 0.016, 0.002], [0.23, 0.018, 0.027, 0.023, 0.004], [0.15, 0.021, 0.034, 0.029, 0.002],
    [0.05, 0.023, 0.039, 0.033, 0], [-0.1, 0.023, 0.041, 0.035, 0], [-0.24, 0.02, 0.037, 0.033, 0], [-0.35, 0.014, 0.025, 0.023, 0], [-0.42, 0.0085, 0.013, 0.013, 0], [-0.445, 0.0075, 0.012, 0.012, 0]],
  spines: Array.from({ length: 10 }, (_, i) => -0.2 + i * 0.031).reverse(), // along the back, head first
  soft: [-0.24, -0.37], // the soft back fin and the fin under it, from and to
  fins: [1, -1].flatMap((s) => [{ side: s, kind: 'pectoral', at: [s * 0.02, -0.006, 0.135], long: 0.045 }, { side: s, kind: 'pelvic', at: [s * 0.012, -0.033, -0.06], long: 0.035 }]),
  tail: -0.44, jaw: [0, -0.004, 0.468], barbel: { root: [0, -0.011, 0.49], long: 0.03, cuts: [0, 0.01, 0.02, 0.03] },
};
const trumpetAt = (z) => { const B = TRUMPET.body; let i = 0; while (i < B.length - 2 && B[i + 1][0] > z) i++; const a = B[i], b = B[i + 1], t = Math.min(1, Math.max(0, (a[0] - z) / (a[0] - b[0]))); return a.map((v, k) => v + (b[k] - v) * t); };
export function trumpet(pal) {
  const m = mesher(), { back, flank, belly, mottle, streak, fin, bar, jawLine, eye } = pal, N = 10, B = denser(TRUMPET.body);
  const paint = (i, k) => { const top = k === 0 || k === N - 1, low = k === 4 || k === 5; if (top) return i >= 6 && i <= 8 ? jawLine : back; if (low) return k === 4 && i % 2 ? tint(belly, flank, 0.3) : belly; if ((k === 2 || k === 7) && i > 7 && i < 14 && i % 2) return tint(flank, streak, 0.45); if (k === 3 || k === 6) return tint(flank, belly, 0.35); return i % 3 === 1 ? tint(flank, mottle, 0.35) : flank; };
  m.skin(B.map(([z, w, up, dn, y]) => ringZ(z, w, up, dn, y, N)), paint);
  m.cap(ringZ(0.5, 0.0075, 0.0075, 0.0075, -0.002, N), [0, 0, 1], '#2a1a1e', -0.004);
  both((s) => { for (let j = 0; j < 4; j++) { const z0 = 0.17 - j * 0.012, [, w, up, dn, y] = trumpetAt(z0); m.quad([s * (w + 0.0008), y + up * (0.6 - 0.35 * j), z0], [s * (w + 0.0008), y + up * (0.6 - 0.35 * (j + 1)), z0 - 0.012], [s * (w + 0.0008), y + up * (0.6 - 0.35 * (j + 1)) - 0.003, z0 - 0.014], [s * (w + 0.0008), y + up * (0.6 - 0.35 * j) - 0.003, z0 - 0.002], tint(back, '#000000', 0.25)); } // the edge of the gill cover
    const [, w, up, , y] = trumpetAt(0.245); m.limb([s * w * 0.7, y + up * 0.5, 0.245], [s * w * 1.25, y + up * 0.62, 0.25], 0.0022, 0.0016, 4, jawLine); }); // a nostril in front of each eye // the little mouth at the end of the tube
  // dark blotches down the flanks, and silvery streaks along the head
  let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 56; i++) { const z = 0.2 - 0.58 * rnd(), s = i % 2 ? 1 : -1, [, w, up, dn, y] = trumpetAt(z), v = (rnd() - 0.4) * 0.8, h = v > 0 ? up * v : dn * v, x = s * (w * Math.sqrt(Math.max(0, 1 - v * v)) + 0.0012), l = 0.008 + 0.01 * rnd();
    m.tri([x, y + h - 0.004, z - l], [x, y + h + 0.004, z], [x, y + h - 0.003, z + l], mottle); }
  both((s) => { for (const [z0, z1, dy] of [[0.36, 0.2, 0.004], [0.3, 0.17, -0.008]]) { const a = trumpetAt(z0), b = trumpetAt(z1); m.quad([s * (a[1] + 0.0008), a[4] + dy, z0], [s * (b[1] + 0.0008), b[4] + dy * 1.6, z1], [s * (b[1] + 0.0008), b[4] + dy * 1.6 + 0.003, z1], [s * (a[1] + 0.0008), a[4] + dy + 0.002, z0], streak); } });
  // the eyes, high on the head
  both((s) => { const [, w, up, , y] = trumpetAt(0.205); m.eye([s * w * 0.86, y + up * 0.42, 0.205], [s, 0.25, 0.05], 0.0085, { iris: eye, pupil: '#1a1420', rim: tint(back, '#000000', 0.4) }); });
  // the soft back fin and the fin under it: rays from the body out, a dark bar along the root, and the edge pale
  const finFrom = m.triangles, [z0, z1] = TRUMPET.soft;
  for (const s of [1, -1]) { const root = [], tip = [], n = 11;
    for (let i = 0; i <= n; i++) { const z = z0 + (z1 - z0) * (i / n), [, , up, dn, y] = trumpetAt(z), h = 0.052 * Math.sin(Math.PI * (0.15 + 0.85 * (i / n))) ** 0.6 + 0.004; root.push([0, y + s * (s > 0 ? up : dn) * 0.92, z]); tip.push([0, y + s * ((s > 0 ? up : dn) + h), z - 0.022]); }
    for (let i = 0; i < n; i++) { const mid = (a, b) => [0, a[1] + (b[1] - a[1]) * 0.28, a[2] + (b[2] - a[2]) * 0.28], r0 = root[i], r1 = root[i + 1], m0 = mid(r0, tip[i]), m1 = mid(r1, tip[i + 1]);
      m.quad(r0, r1, m1, m0, bar).quad(m0, m1, tip[i + 1], tip[i], [fin, fin, tint(fin, '#fff3e0', 0.4)]); } }
  const finTo = m.triangles;
  const g = m.geometry(), P = g.attributes.position, F = new Float32Array(P.count * 4);
  for (let i = 0; i < P.count; i++) { const z = P.getZ(i), y = P.getY(i), [, , up, dn, yc] = trumpetAt(z);
    if (i >= finFrom * 3 && i < finTo * 3) { const s = y > yc ? 1 : -1, out = Math.max(0, (Math.abs(y - yc) - (s > 0 ? up : dn) * 0.9) / 0.055); F[i * 4] = out; F[i * 4 + 2] = s; }
    else if (z > 0.3 && y < yc) F[i * 4 + 1] = Math.min(1, (yc - y) / 0.012) * Math.sin(Math.PI * Math.min(1, (z - 0.3) / 0.18)); } // the floor of the snout, which drops and swells when it strikes
  g.setAttribute('flex', new THREE.Float32BufferAttribute(F, 4));
  return g;
}
// one spine of the back: modelled standing up (+y) from its root, raked back; trumpet.js lays it down by turning it about x
export function trumpetSpine(pal) { const { fin, bar } = pal; return mesher().limb([0, -0.002, 0.002], [0, 0.026, -0.008], 0.0032, 0.0004, 3, [bar, tint(fin, '#fff3e0', 0.3)]).geometry(); }
// a small fin, rays fanning back from its root: modelled flat in the x-z plane, out toward +x, root at the origin
export function trumpetFin(pal, def) {
  const m = mesher(), { fin } = pal, L = def.long, edge = tint(fin, '#fff3e0', 0.45), root = [], tip = [];
  for (let i = 0; i <= 4; i++) { const a = -0.5 - i * 0.28; root.push([0, 0, -i * 0.005]); tip.push([Math.cos(a) * L * (1 - 0.1 * Math.abs(i - 2)), 0, Math.sin(a) * L * 0.7 - i * 0.004]); }
  for (let i = 0; i < 4; i++) m.quad(root[i], root[i + 1], tip[i + 1], tip[i], [fin, fin, edge]);
  return m.geometry();
}
// the tail fin: round, fanned out behind its root, with the two black spots of the real one
export function trumpetTail(pal) {
  const m = mesher(), { fin, bar, back } = pal, edge = tint(fin, '#fff3e0', 0.4), n = 8, R = 0.05, root = [], tip = [];
  for (let i = 0; i <= n; i++) { const a = -0.85 + (1.7 * i) / n; root.push([0, a * 0.008, 0]); tip.push([0, Math.sin(a) * R * 0.6, -Math.cos(a) * R]); }
  for (let i = 0; i < n; i++) m.quad(root[i], root[i + 1], tip[i + 1], tip[i], [tint(fin, back, 0.3), tint(fin, back, 0.3), edge]);
  for (const y of [0.012, -0.012]) for (const s of [1, -1]) { const c = [s * 0.0008, y, -0.03]; m.quad([c[0], y + 0.006, -0.03], [c[0], y, -0.024], [c[0], y - 0.006, -0.03], [c[0], y, -0.036], bar); }
  return m.geometry();
}
// the lower lip of the snout's end, hinged at its back (the origin) and reaching forward to the mouth
export function trumpetJaw(pal) { const { belly, jawLine } = pal; return mesher().limb([0, -0.002, 0], [0, -0.002, 0.034], 0.0062, 0.0055, 5, [belly, jawLine]).geometry(); }
export function trumpetBarbel(pal) { const m = mesher(), { belly, fin } = pal, c = TRUMPET.barbel.cuts; m.skin(c.map((z, i) => { const r = 0.0018 * (1 - i / c.length) + 0.0004; return [[-r, -0.5 * r, z], [0, r, z], [r, -0.5 * r, z]]; }), [belly, fin]); return m.geometry(); }

// ---------------------------------------------------------------- the shrimp goby and the pistol shrimp, at their burrow
// Two animals and the hole they share, made four times their size (a goby of 10 cm and a shrimp of 5 would not be seen from the dive's camera). In
// burrow.js's space: the mouth of the hole at the origin, the sand's surface at y = 0, +z the way the goby watches. The pieces:
//   burrow         the patch of sand round the hole: the hole and its rim, the heap of sand the shrimp has pushed out, the edge sunk below the
//                  bed so that in the dive only the rim and the heap show; and a short dark shaft under the mouth
//   goby           the goby's body, head toward +z: it bends on a neck (spine.js), so it can turn its head and flick its tail; the second back fin
//                  and the fin under it, the disc of its joined belly fins it props itself on, and the eyes high on its head are in it
//   gobyFin        the tall first back fin, which it raises; a pectoral fin; the round tail fin, which flicks
//   shrimp         the front half of the shrimp: the shell over it, with the hood that hides its eyes
//   shrimpSegment  one of the five rings of its tail, and shrimpFan the fan at the end
//   shrimpClaw     the great snapping claw (arm, hand, the finger that cocks), and the small one
//   shrimpLeg      a walking leg; shrimpFeeler its feelers, the two long red ones and the short ones, trailed by strands.js
//   sandLoad       the load of sand it pushes out in front of its claws
// the hole's mouth is HOLE across; `heap` is the way (radians from +x toward +z) the shrimp pushes its sand out, round the side from where the goby watches
export const BURROW = { hole: 0.07, heap: -0.5 };
// the height of the sand round the hole at (x, z), as burrow() lays it (without its small wobble): for whatever stands on it
const BURROW_RINGS = [[BURROW.hole, 0.02, 0], [BURROW.hole + 0.035, 0.035, 0.03], [0.17, 0.012, 0.07], [0.3, -0.004, 0.06], [0.46, -0.03, 0.025]];
export const burrowY = (x, z) => { const r = Math.hypot(x, z), h = Math.max(0, Math.cos(Math.atan2(z, x) - BURROW.heap)) ** 3, P = BURROW_RINGS.map(([r0, y, k], j) => [r0 + (j ? h * k * 2.2 : 0), y + h * k]);
  if (r <= P[0][0]) return P[0][1]; for (let j = 0; j + 1 < P.length; j++) if (r <= P[j + 1][0]) return P[j][1] + (P[j + 1][1] - P[j][1]) * (r - P[j][0]) / (P[j + 1][0] - P[j][0]); return P[P.length - 1][1]; };
export const GOBY = { length: 0.4, neck: 0.09,
  body: [[0.205, 0.012, 0.012, 0.01, -0.006], [0.185, 0.028, 0.028, 0.024, -0.002], [0.14, 0.042, 0.042, 0.033, 0.003], [0.08, 0.041, 0.043, 0.034, 0.002], [0.0, 0.036, 0.04, 0.031, 0], [-0.08, 0.029, 0.033, 0.027, 0], [-0.135, 0.019, 0.023, 0.02, 0], [-0.165, 0.013, 0.017, 0.015, 0]],
  dorsal: [0.055, 0.03], pectoral: [0.04, -0.012, 0.105], tail: -0.165, perch: 0.034, // where the first back fin stands (z, and how far back it reaches); a pectoral's root (and the other's, mirrored); the tail's root; how high the belly sits over what it perches on
};
export const SHRIMP = { length: 0.22,
  segments: [[0.017, 0.022, 0.017], [0.018, 0.021, 0.017], [0.018, 0.019, 0.016], [0.017, 0.016, 0.014], [0.016, 0.013, 0.012]], // each ring of the tail: long, half-wide, high
  claws: [{ side: -1, big: true, shoulder: [-0.016, -0.012, 0.075], l1: 0.04, l2: 0.075, span: 0.03, stout: 1 }, { side: 1, big: false, shoulder: [0.016, -0.012, 0.075], l1: 0.035, l2: 0.04, span: 0.022, stout: 0.38 }],
  legs: [1, -1].flatMap((s) => [0, 1, 2].map((i) => ({ side: s, hip: [s * 0.016, -0.016, 0.055 - i * 0.017], ph: i * 2.1 + (s > 0 ? 0 : 1) }))),
  feelers: [1, -1].flatMap((side) => [sandStrand(side, 0.26, [side * 0.009, 0.002, 0.098], [side * 0.25, 0.25, 1], 8), sandStrand(side, 0.06, [side * 0.004, 0.006, 0.1], [side * 0.3, 0.5, 1], 3)]),
};
const gobyAt = (z) => { const B = GOBY.body; let i = 0; while (i < B.length - 2 && B[i + 1][0] > z) i++; const a = B[i], b = B[i + 1], t = Math.min(1, Math.max(0, (a[0] - z) / (a[0] - b[0]))); return a.map((v, k) => v + (b[k] - v) * t); };
export function burrow(pal) {
  const m = mesher(), { sand, sandDark, sandPale, hole } = pal, N = 14, H = BURROW.hole;
  // the ground from the hole outward: the rim, a dip, and the edge sunk below the bed. On +x the heap of what the shrimp has pushed out
  const heap = (a) => Math.max(0, Math.cos(a - BURROW.heap)) ** 3, rings = BURROW_RINGS.map(([r, y, k], j) =>
    Array.from({ length: N }, (_, i) => { const a = (i / N) * Math.PI * 2 + (j % 2) * 0.12, rr = r + (j ? heap(a) * k * 2.2 : 0), wob = j ? 0.008 * Math.sin(i * 2.7 + j) : 0; return [Math.cos(a) * rr, y + heap(a) * k + wob, Math.sin(a) * rr]; }));
  m.skin(rings, (j, i) => (j === 0 ? sandDark : (i + j) % 3 === 0 ? sandPale : j > 2 ? sand : tint(sand, sandPale, 0.4)));
  // the mouth, and a dark shaft down from it
  const lip = rings[0], deep = lip.map(([x, , z]) => [x * 0.8, -0.3, z * 0.8]); m.skin([lip, deep], hole); m.cap(deep, [0, 1, 0], hole);
  // under it all, so that from the side on the stand it is a piece of the bed: a skirt down from the edge
  const edge = rings[4], foot = edge.map(([x, , z]) => [x, -0.32, z]); m.skin([edge, foot], sandDark).cap(foot, [0, -1, 0], sandDark);
  // a few grains and bits of shell in the heap
  for (let i = 0; i < 7; i++) { const a = BURROW.heap - 0.6 + i * 0.2, r = 0.13 + 0.03 * (i % 3), y = heap(a) * 0.06 + 0.02; m.tri([Math.cos(a) * r, y + 0.006, Math.sin(a) * r], [Math.cos(a) * r + 0.012, y, Math.sin(a) * r - 0.008], [Math.cos(a) * r - 0.006, y, Math.sin(a) * r + 0.01], i % 2 ? '#fff6e6' : sandPale); }
  return m.geometry();
}
export function goby(pal) {
  const m = mesher(), { yellow, back, belly, spot, fin, eye } = pal, N = 8;
  m.skin(GOBY.body.map(([z, w, up, dn, y]) => ringZ(z, w, up, dn, y, N)), (i, k) => (k === 0 || k === N - 1 ? back : k === 3 || k === 4 ? belly : i === 2 && (k === 1 || k === 6) ? tint(yellow, belly, 0.3) : yellow));
  m.cap(ringZ(0.205, 0.012, 0.012, 0.01, -0.006, N), [0, 0, 1], dim(back, 0.8), 0.006);
  m.quad([-0.012, -0.004, 0.2], [0.012, -0.004, 0.2], [0.02, -0.01, 0.17], [-0.02, -0.01, 0.17], dim(back, 0.6)); // the wide mouth
  // pale blue spots over the head and flanks
  let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 18; i++) { const z = 0.17 - 0.3 * rnd(), s = i % 2 ? 1 : -1, [, w, up, , y] = gobyAt(z), v = rnd() * 0.7, x = s * (w * Math.sqrt(1 - v * v) + 0.0012), h = y + up * v, r = 0.0045;
    m.quad([x, h + r, z], [x, h, z + r], [x, h - r, z], [x, h, z - r], spot); }
  // the eyes, big and high on the head, looking out to each side and up
  both((s) => { const [, w, up, , y] = gobyAt(0.15); m.limb([s * w * 0.45, y + up * 0.6, 0.15], [s * w * 0.6, y + up * 1.02, 0.152], 0.016, 0.017, 6, yellow); m.eye([s * w * 0.66, y + up * 1.0, 0.153], [s * 0.7, 0.7, 0.2], 0.012, { iris: eye, pupil: '#15121c', rim: dim(back, 0.7) }); });
  // the second back fin and the fin under it: long, low, spotted, the edge pale
  const soft = (from, to, side, h) => { const root = [], tip = [], n = 6; for (let i = 0; i <= n; i++) { const z = from + (to - from) * (i / n), [, , up, dn, y] = gobyAt(z), hh = h * (0.7 + 0.3 * Math.sin(Math.PI * i / n)); root.push([0, y + side * (side > 0 ? up : dn) * 0.92, z]); tip.push([0, y + side * ((side > 0 ? up : dn) + hh), z - 0.015]); }
    for (let i = 0; i < n; i++) m.quad(root[i], root[i + 1], tip[i + 1], tip[i], [fin, fin, tint(fin, '#ffffff', 0.45)]); for (let i = 1; i < n; i += 2) { const p = tip[i], q = root[i], c = [0, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2]; m.quad([0.001, c[1] + 0.004, c[2]], [0.001, c[1], c[2] + 0.004], [0.001, c[1] - 0.004, c[2]], [0.001, c[1], c[2] - 0.004], spot); } };
  soft(0.015, -0.15, 1, 0.032); soft(-0.03, -0.145, -1, 0.026);
  // the disc of its joined belly fins, a cup under the chest that it props itself on
  const cup = ringY(-GOBY.perch, 0.026, 8, { z: 0.1 }), top = ringY(-0.026, 0.014, 8, { z: 0.102 }); m.skin([top, cup], [tint(fin, belly, 0.5), fin]).cap(cup, [0, -1, 0], tint(fin, belly, 0.3), 0.004);
  return m.geometry();
}
// a fin of the goby. kind 'dorsal': the tall first back fin, standing up (+y) from its root line along -z, which it raises and lays down; 'pectoral':
// a round fan out to +x from its root; 'tail': the round tail, fanned out behind (-z) its root
export function gobyFin(pal, kind) {
  const m = mesher(), { fin, spot, yellow } = pal, edge = tint(fin, '#ffffff', 0.5), root = [], tip = [];
  if (kind === 'dorsal') { for (let i = 0; i <= 5; i++) { const z = -GOBY.dorsal[1] * (i / 5), h = 0.065 * (1 - 0.55 * (i / 5)); root.push([0, 0, z]); tip.push([0, h, z - 0.012 - 0.01 * (i / 5)]); } }
  else if (kind === 'pectoral') { for (let i = 0; i <= 5; i++) { const a = -0.3 - i * 0.42; root.push([0, -0.004 * i, -0.003 * i]); tip.push([Math.cos(a) * 0.05, -0.012 * (i / 5), Math.sin(a) * 0.045]); } }
  else { for (let i = 0; i <= 7; i++) { const a = -0.95 + (1.9 * i) / 7; root.push([0, a * 0.01, 0]); tip.push([0, Math.sin(a) * 0.048, -Math.cos(a) * 0.075]); } }
  for (let i = 0; i + 1 < root.length; i++) m.quad(root[i], root[i + 1], tip[i + 1], tip[i], [kind === 'tail' ? yellow : fin, kind === 'tail' ? yellow : fin, edge]);
  for (let i = 0; i + 1 < root.length; i += 2) { const c = [0, 1, 2].map((k) => root[i][k] * 0.45 + tip[i][k] * 0.55); const d = kind === 'pectoral' ? [0, 0.004, 0] : [0.0015, 0, 0]; m.quad([c[0] + d[0], c[1] + 0.004, c[2]], [c[0] + d[0], c[1], c[2] + 0.004], [c[0] + d[0], c[1] - 0.004, c[2]], [c[0] + d[0], c[1], c[2] - 0.004], spot); m.quad([c[0] - d[0], c[1] - d[1] + 0.004, c[2]], [c[0] - d[0], c[1] - d[1], c[2] - 0.004], [c[0] - d[0], c[1] - d[1] - 0.004, c[2]], [c[0] - d[0], c[1] - d[1], c[2] + 0.004], spot); }
  return m.geometry();
}
// The front of the shrimp, head toward +z: the shell over its front half from z 0.015 to the hood, which comes down over its eyes; the eyes show
// only as two dark marks under it, as the real one's do.
export function shrimp(pal) {
  const m = mesher(), { shell, net, belly, eye, legBand } = pal, N = 7;
  const secs = [[0.012, 0.022, 0.02, 0.016, 0], [0.04, 0.024, 0.022, 0.017, 0.001], [0.07, 0.022, 0.02, 0.016, 0.001], [0.092, 0.016, 0.017, 0.012, 0.002], [0.104, 0.009, 0.01, 0.007, 0.002]];
  m.skin(secs.map(([z, w, up, dn, y]) => ringZ(z, w, up, dn, y, N)), (i, k) => (k === 3 || k === 4 ? belly : (i + k) % 2 ? net : shell));
  m.cap(ringZ(0.012, 0.022, 0.02, 0.016, 0, N), [0, 0, -1], belly, 0.004).cap(ringZ(0.104, 0.009, 0.01, 0.007, 0.002, N), [0, 0, 1], shell, 0.006);
  both((s) => m.quad([s * 0.012, 0.012, 0.096], [s * 0.016, 0.006, 0.093], [s * 0.012, 0.002, 0.098], [s * 0.008, 0.008, 0.1], eye)); // the eyes, under the hood
  m.quad([-0.014, 0.0215, 0.02], [0.014, 0.0215, 0.02], [0.012, 0.0205, 0.07], [-0.012, 0.0205, 0.07], [net, net, shell]); // the netted pattern on its back
  for (const c of SHRIMP.claws) m.limb([c.shoulder[0] * 0.5, c.shoulder[1], c.shoulder[2] - 0.006], c.shoulder, 0.007, 0.006, 4, legBand);
  return m.geometry();
}
// one ring of the tail (i: which, from the front), modelled from its front at the origin back along -z
export function shrimpSegment(pal, i) {
  const m = mesher(), { shell, net, belly } = pal, [l, w, h] = SHRIMP.segments[i], next = SHRIMP.segments[i + 1] || [0, w * 0.8, h * 0.8];
  m.skin([ringZ(0.002, w, h, h * 0.75, 0, 7), ringZ(-l * 0.5, w * 1.04, h * 1.05, h * 0.8, 0, 7), ringZ(-l - 0.002, next[1] * 1.02, next[2] * 1.02, next[2] * 0.78, 0, 7)], (j, k) => (k === 3 || k === 4 ? belly : (k + i) % 2 ? net : shell));
  both((s) => m.limb([s * w * 0.6, -h * 0.7, -l * 0.5], [s * w * 0.9, -h * 1.3, -l * 0.7], 0.004, 0.001, 3, belly)); // the little swimmerets under it
  return m.geometry();
}
export function shrimpFan(pal) {
  const m = mesher(), { shell, net, legBand } = pal, edge = tint(shell, '#ffffff', 0.4);
  m.quad([-0.006, 0.004, 0], [0.006, 0.004, 0], [0.008, 0.002, -0.03], [-0.008, 0.002, -0.03], [shell, shell, edge]); // the middle one
  both((s) => { m.quad([s * 0.004, 0.003, -0.002], [s * 0.016, 0.002, -0.006], [s * 0.022, 0.001, -0.03], [s * 0.008, 0.002, -0.032], [net, net, edge]); m.quad([s * 0.003, 0.002, -0.002], [s * 0.01, 0.002, -0.004], [s * 0.012, 0.001, -0.026], [s * 0.004, 0.001, -0.028], legBand); });
  return m.geometry();
}
// a claw (c: its entry in SHRIMP.claws): the arm, the hand with its fixed finger, and the finger that moves, hinged at the hand's end. The great
// one's hand is nearly half as long as the shrimp, swollen, with the knob on its finger that drives the jet; the small one is slender
export function shrimpClaw(pal, c) {
  const { shell, net, legBand, clawTip } = pal, w = c.stout, L = c.l2;
  const arm = mesher().limb([0, 0, -0.004], [0, 0, c.l1], 0.006 * w + 0.002, 0.0055 * w + 0.002, 5, [legBand, net]);
  const hand = mesher(), H = [[-0.004, 0.009, 0.008], [L * 0.3, 0.017, 0.015], [L * 0.7, 0.019, 0.016], [L, 0.012, 0.01]].map(([z, x, y]) => ringZ(z, x * w + 0.003, y * w + 0.003, y * w + 0.003, 0, 7));
  hand.skin(H, (i, k) => ((i + k) % 2 ? net : shell)).cap(H[0], [0, 0, -1], legBand, 0.003);
  hand.limb([0, -0.006 * w, L * 0.95], [0, -0.008 * w, L + c.span], 0.008 * w + 0.002, 0.002, 5, [shell, clawTip]); // the fixed finger
  const finger = mesher().limb([0, 0, -0.003], [0, 0.002, c.span * 1.02], 0.008 * w + 0.002, 0.002, 5, [net, clawTip]);
  if (c.big) finger.limb([0, -0.006, 0.004], [0, -0.013, 0.012], 0.005, 0.002, 4, shell); // the plunger
  return { arm: arm.geometry(), hand: hand.geometry(), finger: finger.geometry(), hinge: [0, 0.006 * w, L] };
}
// a walking leg, from its hip down and out (+x, -y), bent once, as one piece (burrow.js turns it at the hip to walk)
export function shrimpLeg(pal) { const { legBand, net } = pal; return mesher().limb([0, 0, 0], [0.025, -0.006, 0.004], 0.003, 0.0026, 4, [legBand, net]).limb([0.025, -0.006, 0.004], [0.034, -0.03, 0.008], 0.0026, 0.0008, 4, [net, legBand]).geometry(); }
export function shrimpFeeler(pal, def) {
  const m = mesher(), { feeler, legBand } = pal, n = def.cuts.length - 1, r0 = def.long > 0.1 ? 0.0024 : 0.002;
  m.skin(def.cuts.map((z, i) => { const r = i === n ? 0.0004 : r0 * (1 - 0.65 * (i / n)); return [[-r, -0.5 * r, i ? z : -0.004], [0, r, i ? z : -0.004], [r, -0.5 * r, i ? z : -0.004]]; }), (i) => (def.long > 0.1 ? feeler : i % 2 ? legBand : feeler));
  return m.geometry();
}
export function sandLoad(pal) { const { sand, sandPale } = pal; const m = mesher(); m.add(new THREE.IcosahedronGeometry(0.03, 0), new THREE.Matrix4().makeScale(1.3, 0.6, 1), sandPale); m.add(new THREE.IcosahedronGeometry(0.022, 0), new THREE.Matrix4().compose(new THREE.Vector3(0.02, -0.004, -0.01), new THREE.Quaternion(), new THREE.Vector3(1.2, 0.7, 1)), sand); return m.geometry(); }

// ---------------------------------------------------------------- the garden eel
// One light model, made to be drawn by the dozen as one instanced mesh (gardeneel.js). It is modelled straight up the y axis from the tip of its
// tail (y = 0) to the top of its head (y = GARDEN.long), the head turned forward (+z) at the top as the real one holds it, a question mark: the
// shader then pushes it up out of its hole by as much as it is out, and bends what is out. Five sides, a ring every tenth of a metre.
// White with fine black dots and three big black spots: at the gill opening, mid-body, and round the vent. Three times its real size.
// eelField is the patch of sand the colony lives in, each hole a little rim with the dark mouth in it, the edge sunk below the bed.
export const GARDEN = { long: 1.2, thick: 0.021, out: 0.67, // how long, how thick (half), and the most of it that comes out
  holes: Array.from({ length: 20 }, (_, i) => { const a = i * 2.39996, r = 0.38 * Math.sqrt(i + 0.6); return [Math.sin(a) * r + 0.06 * Math.sin(i * 7.1), Math.cos(a) * r + 0.06 * Math.cos(i * 5.3)]; }), // a loose colony, each a little over half a metre from the next
};
export function gardenEel(pal) {
  const m = mesher(), { skin, dot, spot, eye } = pal, L = GARDEN.long, R = GARDEN.thick, n = 5, top = L - 0.07;
  const spine = (y) => { const u = Math.min(1, Math.max(0, (y - (top - 0.06)) / 0.13)); return [0, Math.min(y, top - 0.06) + Math.sin(u * 1.3) * 0.1, (1 - Math.cos(u * 1.3)) * 0.1]; }; // up, and over at the head
  const ys = [0]; for (let y = 0.1; y < top - 0.06; y += 0.1) ys.push(y); ys.push(top - 0.02, top + 0.03, top + 0.07); // ring every tenth, closer at the head
  const rings = ys.map((y, j) => { const c = spine(y), c2 = spine(y + 0.01), d = new THREE.Vector3(c2[0] - c[0], c2[1] - c[1], c2[2] - c[2]).normalize(), u = new THREE.Vector3(1, 0, 0), v = new THREE.Vector3().crossVectors(d, u).normalize(), r = j === 0 ? 0.002 : R * Math.min(1, y / 0.25) ** 0.5 * (j === ys.length - 1 ? 0.55 : 1);
    return Array.from({ length: n }, (_, k) => { const a = (k / n) * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r; return [c[0] + u.x * x + v.x * z, c[1] + u.y * x + v.y * z, c[2] + u.z * x + v.z * z]; }); });
  const big = [L - 0.16, L * 0.6, L * 0.38]; // the three big spots, by height
  m.skin(rings, (j, k) => { const y = (ys[j] + ys[j + 1]) / 2; if (big.some((b) => Math.abs(y - b) < 0.05) && (k === 1 || k === 3)) return spot; return (j * 7 + k * 3) % 13 === 0 ? dot : skin; });
  const tip = rings[rings.length - 1], c = spine(top + 0.07); m.cap(tip, [0, 0.3, 1], skin, 0.02); // the snout
  both((s) => { const e = spine(top + 0.02); m.eye([s * R * 0.92, e[1] + 0.005, e[2]], [s, 0.35, 0.35], 0.0105, { iris: eye, pupil: '#121018', rim: dot }); }); // big eyes
  m.tri([-0.008, c[1] - 0.012, c[2] + 0.012], [0.008, c[1] - 0.012, c[2] + 0.012], [0, c[1] - 0.022, c[2] - 0.004], dot); // the mouth, under the snout
  return m.geometry();
}
export function eelField(pal) {
  const m = mesher(), { sand, sandDark, sandPale, hole } = pal, R = 2.3, N = 18;
  const disc = [[0.0, 0.0], [0.9, 0.004], [1.7, 0.0], [R, -0.035]].map(([r, y], j) => j ? ringY(y, r, N, { turn: j * 0.17 }) : [[0, 0, 0]]);
  for (let k = 0; k < N; k++) m.out(disc[0][0], disc[1][k], disc[1][(k + 1) % N], [0, -1, 0], k % 3 ? sand : sandPale);
  m.skin(disc.slice(1), (j, k) => ((j + k) % 3 ? sand : sandPale));
  const foot = disc[3].map(([x, , z]) => [x, -0.95, z]); m.skin([disc[3], foot], sandDark).cap(foot, [0, -1, 0], sandDark); // the skirt that hides what is down the holes, on the stand
  for (const [x, z] of GARDEN.holes) { const rim = ringY(0.018, 0.055, 6, { x, z }), out = ringY(0.004, 0.1, 6, { x, z, turn: 0.5 }), lip = ringY(0.012, 0.03, 6, { x, z });
    m.skin([out, rim, lip], [sandPale, sandDark]).cap(lip, [0, 1, 0], hole, -0.01); }
  return m.geometry();
}

// ---------------------------------------------------------------- the white-spotted pufferfish, and its circle in the sand
// A small round fish, head toward +z, made two and a half times its size (30 cm). puffer.js puts it together:
//   puffer       the body, eyes, beak and the spines on its belly. It puffs up in its shader: `flex` on each corner is how far that corner goes when
//                it is blown up all the way (the body to a ball, the belly's spines standing out of it)
//   pufferFin    a fin: the back fin and the fin under it, set far back, which it swims and digs by; a pectoral; the tail
//   shellBit     a fragment of shell or coral, which it carries in its mouth and sets on a peak
// sandCircle is the circle it builds: radial valleys and ridges round a flat middle of fine sand, with shell fragments on the peaks. Its shape at
// every stage of building is in its shader, from `cut` on each corner (x: the height there when the ridges are sharp, y: when they are rough, z: how
// deep the first ring was dug there, w: the stage at which a fragment appears, for the corners of a fragment, or -1 in the fine middle), and the one
// number `stage`. Its colours come in with the work too: until the sand has been worked there, it is plain sand.
export const PUFFER = { length: 0.3,
  body: [[0.13, 0.022, 0.02, 0.018, -0.004], [0.11, 0.045, 0.045, 0.038, 0], [0.06, 0.062, 0.062, 0.055, 0.004], [0.0, 0.06, 0.06, 0.056, 0.004], [-0.06, 0.044, 0.044, 0.04, 0.002], [-0.1, 0.022, 0.024, 0.02, 0], [-0.12, 0.013, 0.015, 0.012, 0]],
  ball: [0, 0.006, 0.01], puff: 0.1, // the middle of the ball it blows up to, and the ball's radius
  fins: [{ kind: 'dorsal', at: [0, 0.042, -0.07] }, { kind: 'anal', at: [0, -0.036, -0.075] }, { kind: 'pectoral', side: 1, at: [0.05, 0.002, 0.045] }, { kind: 'pectoral', side: -1, at: [-0.05, 0.002, 0.045] }, { kind: 'tail', at: [0, 0, -0.12] }],
};
export const CIRCLE = { R: 1.45, middle: 0.62, ridges: 28 }; // the outer edge, the edge of the flat middle, and how many ridges round it (made half as big again as the real one)
const pufferAt = (z) => { const B = PUFFER.body; let i = 0; while (i < B.length - 2 && B[i + 1][0] > z) i++; const a = B[i], b = B[i + 1], t = Math.min(1, Math.max(0, (a[0] - z) / (a[0] - b[0]))); return a.map((v, k) => v + (b[k] - v) * t); };
export function puffer(pal) {
  const m = mesher(), { back, flank, belly, spot, eye, beak } = pal, N = 14, B = denser(PUFFER.body);
  m.skin(B.map(([z, w, up, dn, y]) => ringZ(z, w, up, dn, y, N)), (i, k) => (k <= 1 || k >= N - 2 ? (k === 0 || k === N - 1 ? back : tint(back, flank, 0.5)) : k >= 6 && k <= 7 ? belly : k === 5 || k === 8 ? tint(flank, belly, 0.6) : k === 4 || k === 9 ? tint(flank, belly, 0.25) : flank));
  m.cap(ringZ(0.13, 0.022, 0.02, 0.018, -0.004, N), [0, 0, 1], beak, 0.006).cap(ringZ(-0.12, 0.013, 0.015, 0.012, 0, N), [0, 0, -1], back, 0.004);
  both((s) => { const [, w, up, , y] = pufferAt(0.04); m.quad([s * (w + 0.001), y + up * 0.15, 0.045], [s * (w + 0.001), y + up * 0.55, 0.04], [s * (w + 0.001), y + up * 0.55, 0.034], [s * (w + 0.001), y + up * 0.15, 0.039], dim(back, 0.55)); // the gill opening, a dark slit before the pectoral
    const [, w2, up2, , y2] = pufferAt(0.105); m.limb([s * w2 * 0.45, y2 + up2 * 0.75, 0.105], [s * w2 * 0.6, y2 + up2 * 0.95, 0.11], 0.0035, 0.003, 4, flank); // a nostril
    m.limb([s * 0.012, -0.006, 0.13], [s * 0.018, -0.006, 0.122], 0.004, 0.003, 4, tint(beak, flank, 0.3)); }); // the corners of the mouth
  m.quad([-0.006, -0.004, 0.137], [0.006, -0.004, 0.137], [0.006, 0.001, 0.137], [-0.006, 0.001, 0.137], '#fffdf2'); // the beak's four teeth, as two pale plates
  // white spots over the back and flanks, and on the belly
  let seed = 9; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 64; i++) { const z = 0.1 - 0.19 * rnd(), [, w, up, dn, y] = pufferAt(z), a = (rnd() * 2 - 1) * 2.2, x = Math.sin(a) * w * 1.03, h = y + (Math.cos(a) >= 0 ? up : dn) * Math.cos(a) * 1.03, r = 0.0055 + 0.002 * rnd(), n = [Math.sin(a), Math.cos(a), 0];
    const u = [Math.cos(a), -Math.sin(a), 0]; m.quad([x + u[0] * r, h + u[1] * r, z], [x + n[0] * 0.0005, h, z + r], [x - u[0] * r, h - u[1] * r, z], [x, h, z - r], Math.abs(a) > 1.9 ? '#ffffff' : spot); }
  both((s) => { const [, w, up, , y] = pufferAt(0.075); m.eye([s * w * 0.78, y + up * 0.5, 0.075], [s, 0.45, 0.15], 0.0105, { iris: eye, pupil: '#151219', rim: dim(back, 0.6) }); });
  // small spines over the belly, lying flat; they stand when it puffs up
  const spineFrom = m.triangles;
  for (let i = 0; i < 30; i++) { const z = 0.08 - 0.13 * ((i * 0.618) % 1), a = Math.PI + (((i * 0.37) % 1) - 0.5) * 2.2, [, w, , dn, y] = pufferAt(z), x = Math.sin(a) * w, h = y + Math.cos(a) * dn; m.tri([x - 0.003, h, z + 0.003], [x + 0.003, h, z + 0.003], [x, h - 0.0012, z - 0.008], [belly, belly, tint(belly, back, 0.4)]); }
  const g = m.geometry(), P = g.attributes.position, F = new Float32Array(P.count * 4), C = PUFFER.ball, V = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) { V.set(P.getX(i) - C[0], P.getY(i) - C[1], (P.getZ(i) - C[2]) * 0.85); const d = V.length() || 1, k = PUFFER.puff / d, spine = i >= spineFrom * 3 && (i - spineFrom * 3) % 3 === 2 ? 1.4 : 1; // a spine's point stands out of the ball
    F[i * 4] = (V.x * k * spine - V.x); F[i * 4 + 1] = (V.y * k * spine - V.y); F[i * 4 + 2] = (V.z * k * spine - V.z) / 0.85 * 0.6; }
  g.setAttribute('flex', new THREE.Float32BufferAttribute(F, 4));
  return g;
}
// a fin: 'dorsal' and 'anal' stand from a root along -z (anal turned under by puffer.js), 'pectoral' fans out to +x, 'tail' fans back
export function pufferFin(pal, kind) {
  const m = mesher(), { fin, back } = pal, edge = tint(fin, '#ffffff', 0.45), root = [], tip = [];
  if (kind === 'dorsal' || kind === 'anal') for (let i = 0; i <= 7; i++) { root.push([0, 0, -0.0034 * i]); tip.push([0, 0.032 - 0.0023 * i, -0.012 - 0.0046 * i]); }
  else if (kind === 'pectoral') for (let i = 0; i <= 7; i++) { const a = -0.2 - i * 0.23; root.push([0, 0.008 - 0.0023 * i, 0]); tip.push([Math.cos(a) * 0.03 * (i % 2 ? 0.94 : 1), 0.012 - 0.0046 * i, Math.sin(a) * 0.022]); }
  else for (let i = 0; i <= 10; i++) { const a = -0.8 + (1.6 * i) / 10; root.push([0, a * 0.009, 0]); tip.push([0, Math.sin(a) * 0.034, -Math.cos(a) * 0.042 + (i % 2 ? 0.004 : 0)]); }
  for (let i = 0; i + 1 < root.length; i++) m.quad(root[i], root[i + 1], tip[i + 1], tip[i], [kind === 'tail' ? tint(fin, back, 0.3) : fin, fin, edge]);
  return m.geometry();
}
export function shellBit(pal) { const { bitA, bitB } = pal; return mesher().tri([0, 0.008, 0.012], [-0.01, 0, -0.006], [0.011, 0.001, -0.005], [bitA, bitA, bitB]).tri([0, 0.008, 0.012], [0.011, 0.001, -0.005], [0, -0.004, 0], bitB).tri([0, 0.008, 0.012], [0, -0.004, 0], [-0.01, 0, -0.006], bitA).geometry(); }
export function sandCircle(pal) {
  const m = mesher(), { sand, sandDark, sandPale, fine, bitA, bitB } = pal, { R, middle: rc, ridges: K } = CIRCLE, A = K * 4; // four corners to a ridge round: peak, side, valley, side
  const radii = [0, 0.2, 0.42, rc - 0.05, rc + 0.08, rc + 0.3, 0.98, 1.2, R - 0.05, R + 0.08, R + 0.32, R + 0.55];
  const C = [];
  const cut = (r, a) => { // what the ground does at (r, a): [sharp, rough, first ring, middle]
    const q = (((a / (Math.PI * 2)) * K) % 1 + 1) % 1, tri = 1 - 4 * Math.abs(q - 0.5), rough = Math.cos(q * Math.PI * 2), env = r < rc ? 0 : r < rc + 0.08 ? (r - rc) / 0.08 * 0.4 : r <= R ? 0.4 + 0.6 * Math.sin(Math.PI * Math.min(1, (r - rc) / (R - rc)) * 0.75) : r < R + 0.1 ? 0.5 : 0;
    const bank = r > R - 0.1 && r < R + 0.12 ? 0.02 : 0, ring = Math.max(0, 1 - Math.abs(r - (R - 0.08)) / 0.14), mid = r < rc ? 0.006 * Math.sin(r * 40 + a * 7) * Math.sin(a * 11 - r * 23) : 0;
    return [0.055 * env * tri + bank + mid, 0.035 * env * rough + bank * 0.5, 0.035 * ring, r < rc ? -1 : 0]; }; // (w -1: the fine middle)
  const P = (r, a) => [Math.cos(a) * r, r > R + 0.3 ? -0.035 * (r - R - 0.3) / 0.25 : 0, Math.sin(a) * r];
  for (let j = 0; j + 1 < radii.length; j++) for (let i = 0; i < A; i++) { const a0 = (i / A) * Math.PI * 2, a1 = ((i + 1) / A) * Math.PI * 2, r0 = radii[j], r1 = radii[j + 1];
    const v = [[r0, a0], [r0, a1], [r1, a1], [r1, a0]], q = ((i % 4) + 4) % 4, peak = q === 3 || q === 0, inside = r1 <= rc;
    const col = inside ? ((i + j) % 3 ? fine : tint(fine, sandPale, 0.5)) : r0 >= R + 0.08 ? sand : peak ? sandPale : q === 2 || q === 1 ? sandDark : sand;
    const pts = v.map(([r, a]) => P(r, a)), cs = v.map(([r, a]) => cut(r, a));
    if (j === 0) { m.tri(pts[0], pts[2], pts[3], col); C.push(...cs[0], ...cs[2], ...cs[3]); }
    else { m.tri(pts[0], pts[2], pts[1], col).tri(pts[0], pts[3], pts[2], col); C.push(...cs[0], ...cs[2], ...cs[1], ...cs[0], ...cs[3], ...cs[2]); } }
  // the skirt round the edge, which hides what lies under it on the stand
  const edge = Array.from({ length: 24 }, (_, i) => P(R + 0.55, (i / 24) * Math.PI * 2)), foot = edge.map(([x, , z]) => [x, -0.3, z]), before = m.triangles; m.skin([edge, foot], sandDark).cap(foot, [0, -1, 0], sandDark); for (let i = before; i < m.triangles; i++) C.push(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
  // fragments of shell and coral, one on every other peak in the outer half, set there last
  for (let i = 0; i < K; i += 2) { const a = ((i + 0.0) / K) * Math.PI * 2, r = 0.92 + 0.42 * ((i * 0.618) % 1), x = Math.cos(a) * r, z = Math.sin(a) * r, [h] = cut(r, a), s = 0.045 + 0.02 * ((i * 0.37) % 1), at = 0.86 + 0.12 * ((i * 0.53) % 1), col = i % 6 === 0 ? bitB : bitA;
    const t0 = [x - s, 0.002, z - s * 0.4], t1 = [x + s * 0.8, 0.004, z - s * 0.6], t2 = [x + s * 0.2, 0.003, z + s], t3 = [x, s * 0.7, z], c = [h, h * 0.7, 0, at]; for (const [p0, p1, p2] of [[t0, t1, t3], [t1, t2, t3], [t2, t0, t3]]) { m.tri(p0, p1, p2, [col, col, tint(col, '#ffffff', 0.4)]); C.push(...c, ...c, ...c); } }
  const g = m.geometry(); g.setAttribute('cut', new THREE.Float32BufferAttribute(new Float32Array(C), 4)); return g;
}
