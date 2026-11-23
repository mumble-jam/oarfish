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
// The shell, with its face, is one model. Its eight legs and two claws are separate pieces, each a rigid length modelled along
// +z from the joint it hangs on, and KEEPER says where they join and how long they are: crab.js hangs them on and legs.js walks them.
const side4 = (fn) => [1, -1].flatMap((s) => [0, 1, 2, 3].map((i) => fn(s, i)));
export const KEEPER = {
  ride: 0.44, // how far the shell's origin is carried over the ground its feet are on
  // front to back down each side. hip: where the leg leaves the shell; rest: where its foot stands, on the ground, as the body sees it
  legs: side4((s, i) => ({ side: s, group: (i + (s > 0 ? 0 : 1)) % 2, l1: 1.3, l2: 1.6,
    hip: [s * [1.2, 1.33, 1.29, 1.04][i], 0.3, [0.62, 0.1, -0.42, -0.94][i]], rest: [s * [2.5, 3.15, 3.1, 2.4][i], [1.8, 0.58, -0.72, -2.0][i]],
    curl: [s * [0.75, 0.9, 0.9, 0.7][i], -0.55, [0.75, 0.2, -0.4, -0.85][i]] })), // drawn up under the belly, when it is done for
  // Two claws, and not a pair. On its right the crusher: big, slow, and the one it strikes with. On its left the cutter: small and quick, the one it feeds with.
  // A claw is an arm from the shoulder to the elbow, then the hand, which is the forearm and the lower finger in one piece; the upper finger hinges on it.
  // l1, l2: arm and forearm; span: how far the fingers reach past the hinge; stout: how thick it all is
  claws: [
    { side: -1, big: true, shoulder: [-1.02, 0.32, 1.02], l1: 1.05, l2: 0.95, hinge: [0, 0.16, 0.9], span: 0.95, stout: 1.5 },
    { side: 1, big: false, shoulder: [0.98, 0.3, 1.06], l1: 0.78, l2: 0.62, hinge: [0, 0.07, 0.6], span: 0.6, stout: 0.72 },
  ],
};
export function keeper(pal) {
  const m = mesher(), { tone, pale, dark, deep } = pal, shade = dim(tone, 0.8);
  const rings = [[0.2, 1.62], [0.62, 1.5], [1.1, 1.05], [1.42, 0.45]].map(([y, r]) => ringY(y, r, 10, { squash: 0.92 }));
  m.skin(rings, (i, k) => (i === 0 ? pale : (k + i) % 2 ? tone : shade)).cap(rings[3], [0, 1, 0], [pale, shade, shade], 0.14).cap(rings[0], [0, -1, 0], deep);
  for (let i = 0; i < 10; i += 2) { const p = rings[2][i]; m.limb([p[0] * 0.95, p[1] - 0.05, p[2] * 0.95], [p[0] * 1.28, p[1] + 0.3, p[2] * 1.28], 0.13, 0.01, 4, [shade, pale]); } // knobs where the plates meet
  m.limb([0, 1.5, 0], [0, 2.25, -0.2], 0.24, 0.02, 5, [tone, pale]);
  m.add(new THREE.BoxGeometry(1.3, 0.34, 0.5), new THREE.Matrix4().makeTranslation(0, 0.2, 1.38), deep); // the face under the shell's lip
  both((s) => {
    m.limb([s * 0.32, 0.33, 1.45], [s * 0.44, 0.74, 1.74], 0.08, 0.06, 4, dark).eye([s * 0.44, 0.8, 1.78], [s * 0.35, 0.3, 1], 0.14, { iris: pal.eye, glow: true });
    for (let i = 0; i < 2; i++) m.limb([s * 0.14, 0.12, 1.6], [s * (0.2 + i * 0.16), -0.05, 1.95 - i * 0.1], 0.05, 0.02, 3, pale); // mouth parts
    for (const leg of KEEPER.legs) if (leg.side === s) m.limb([leg.hip[0] * 0.8, 0.3, leg.hip[2] * 0.9], leg.hip, 0.2, 0.16, 4, deep); // and one for each leg
  });
  for (const c of KEEPER.claws) m.limb([c.shoulder[0] * 0.76, c.shoulder[1], c.shoulder[2] - 0.1], c.shoulder, 0.24 * c.stout, 0.2 * c.stout, 5, deep); // the socket each claw turns in
  return m.geometry();
}
// the two lengths of a walking leg: from the shell up to the knee, and from the knee down to a point
export function keeperLeg(pal) {
  const { pale, dark, deep } = pal, { l1, l2 } = KEEPER.legs[0];
  const upper = mesher().limb([0, 0, 0], [0, 0, l1], 0.2, 0.15, 4, [dark, deep]), knee = upper.last;
  upper.cap(knee, [0, 0, 1], pale, 0.16); // the knuckle of the knee
  const lower = mesher().limb([0, 0, -0.05], [0, 0, l2 * 0.6], 0.165, 0.11, 4, [deep, dark]).limb([0, 0, l2 * 0.6], [0, 0, l2], 0.11, 0.015, 4, [dark, pale]);
  return { upper: upper.geometry(), lower: lower.geometry() };
}
// the three pieces of one claw (c: its entry in KEEPER.claws). The hand's top is +y: the upper finger lifts off it that way, turning about x at the hinge
export function keeperClaw(pal, c) {
  const { pale, dark, deep } = pal, { l1, l2, span: f, stout: w } = c;
  const arm = mesher().limb([0, 0, 0], [0, 0, l1], 0.2 * w, 0.18 * w, 5, [dark, deep]);
  const hand = mesher().limb([0, 0, -0.05], [0, 0, l2], 0.2 * w, 0.31 * w, 5, [deep, dark]);
  const low = [[0, -0.1 * w, l2 - 0.06], [0, -0.3 * w, l2 + f * 0.92]], up = [[0, 0, -0.05], [0, 0.07 * w, f]]; // the lower finger, in the hand's space; the upper, in its own
  hand.cap(hand.last, [0, 0, 1], dark, 0.1 * w).limb(low[0], low[1], 0.21 * w, 0.03, 5, [dark, pale]);
  const top = mesher().limb(up[0], up[1], 0.27 * w, 0.035, 5, [dark, pale]);
  if (c.big) for (const t of [0.3, 0.5, 0.7]) { // the crusher's teeth: blunt knobs down the inside of both fingers
    const on = (m, [p, q], r0, r1, sign) => { const y = p[1] + (q[1] - p[1]) * t, z = p[2] + (q[2] - p[2]) * t, r = r0 + (r1 - r0) * t; m.limb([0, y + sign * r * 0.55, z], [0, y + sign * (r + 0.1), z + 0.02], 0.1, 0.045, 4, pale); };
    on(hand, low, 0.21 * w, 0.03, 1); on(top, up, 0.27 * w, 0.035, -1);
  }
  return { arm: arm.geometry(), hand: hand.geometry(), finger: top.geometry() };
}

// ---------------------------------------------------------------- the Shearer: a sawfish, the saw toothed in the district's colour
// A ray in front and a shark behind, as sawfish are: a flat wide head with the wings grown onto it, eyes on top, the mouth and gills
// underneath, and from the tail-root back a shark's two fins and uneven tail. The saw is a quarter of its length. Its teeth are lit
// from within and take the district's colour: sawfish.js brightens them when it feels a fish. One model; it bends in its shader.
export const SHEARER = { neck: 1.5, nose: 3.75, length: 6.9, teeth: 12 }; // neck: where the head turns on the body (z); nose: the saw's tip
// wear: how the saw has fared in its fight. lost: rows of teeth knocked out, 0 to 4 (every fourth tooth is a row, so the saw goes gap-toothed, and a stump is left
// where each was); snapped: the blade broken off short, ragged and dark at the break
export function shearer(pal, { lost = 0, snapped = false } = {}) {
  const m = mesher(), { tone, back, flank, belly, saw: pale } = pal, shade = dim(tone, 0.8), dark = '#241833', mottle = '#4a375e';
  const secs = [[1.95, 0.3, 0.1, 0.08, -0.18], [1.55, 0.58, 0.26, 0.14, -0.12], [1.05, 0.8, 0.4, 0.17, -0.05], [0.35, 0.74, 0.5, 0.2, 0], [-0.45, 0.5, 0.46, 0.2, 0], [-1.25, 0.3, 0.33, 0.17, 0.02], [-1.95, 0.15, 0.2, 0.11, 0.04], [-2.45, 0.07, 0.11, 0.07, 0.06]];
  hull(m, secs, (i, k, n) => (k === 0 || k === n - 1 ? back : k === n / 2 - 1 || k === n / 2 ? belly : (i + k) % 3 === 0 ? mottle : flank), 8);
  // the height of the underside at (x, z), for what is drawn on it
  const under = (x, z) => { let i = 0; while (i < secs.length - 2 && secs[i + 1][0] > z) i++; const [z0, w0, , d0, y0] = secs[i], [z1, w1, , d1, y1] = secs[i + 1], t = (z0 - z) / (z0 - z1), w = w0 + (w1 - w0) * t, d = d0 + (d1 - d0) * t;
    return y0 + (y1 - y0) * t - d + d * 0.293 * Math.min(1, Math.abs(x) / (0.707 * w)) - 0.012; };
  const mark = (x0, z0, x1, z1, wide, colour) => { const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz) || 1, nx = (-dz / l) * wide, nz = (dx / l) * wide; m.quad([x0 - nx, under(x0 - nx, z0 - nz), z0 - nz], [x0 + nx, under(x0 + nx, z0 + nz), z0 + nz], [x1 + nx, under(x1 + nx, z1 + nz), z1 + nz], [x1 - nx, under(x1 - nx, z1 - nz), z1 - nz], colour); };
  // the saw: a flat blade, and a row of teeth down each edge
  const end = snapped ? 2.82 : SHEARER.nose, endW = snapped ? 0.215 : 0.14;
  const base = ringZ(1.9, 0.29, 0.07, 0.07, -0.18, 4), tip = ringZ(end, endW, snapped ? 0.05 : 0.03, snapped ? 0.05 : 0.03, -0.18, 4);
  m.skin([base, tip], [pale, CREAM]).cap(tip, [0, 0, 1], snapped ? dark : pale);
  if (snapped) for (const [x, l] of [[-0.14, 0.2], [0.02, 0.11], [0.13, 0.26]]) m.limb([x, -0.18, end - 0.02], [x * 0.8, -0.18, end + l], 0.05, 0.004, 3, [pale, dark], true); // splinters, where it broke
  both((s) => {
    for (let i = 0; i < SHEARER.teeth; i++) { const t = (i + 0.5) / SHEARER.teeth, z = 2.02 + t * (SHEARER.nose - 2.1), w = 0.285 - t * 0.14, gone = (i + (s > 0 ? 0 : 2)) % 4 < lost; if (z > end - 0.05) continue; // (the two edges lose different teeth)
      if (gone) m.limb([s * (w - 0.03), -0.18, z], [s * (w + 0.05), -0.18, z + 0.01], 0.04, 0.02, 3, [shade, dark], true); else m.limb([s * (w - 0.03), -0.18, z], [s * (w + 0.24 - t * 0.05), -0.18, z + 0.035], 0.045, 0.002, 3, [tone, shade], true); }
    m.fin([[s * 0.55, -0.1, 1.55], [s * 0.8, -0.1, 0.75], [s * 0.62, -0.1, -0.25]], [[s * 1.15, -0.14, 1.1], [s * 1.95, -0.24, 0.2], [s * 1.0, -0.16, -0.55]], [flank, back]); // the wings, grown onto the head
    m.fin([[s * 0.42, -0.18, -0.75], [s * 0.32, -0.16, -1.2]], [[s * 0.85, -0.28, -1.15], [s * 0.42, -0.2, -1.45]], flank);
    m.eye([s * 0.56, 0.3, 1.22], [s * 0.7, 0.7, 0.2], 0.12, { iris: pal.eye, glow: true, slit: true });
    m.tri([s * 0.5, 0.36, 0.98], [s * 0.63, 0.31, 0.9], [s * 0.47, 0.34, 0.8], dark); // the spiracle behind each eye
    mark(s * 0.17, 1.66, s * 0.27, 1.56, 0.035, dark); // underneath: a nostril,
    for (let i = 0; i < 5; i++) mark(s * (0.3 + i * 0.012), 1.0 - i * 0.15, s * (0.5 + i * 0.012), 0.94 - i * 0.15, 0.022, dark); // five gill slits,
    mark(s * 0.02, 1.3, s * 0.2, 1.33, 0.028, dark); mark(s * 0.2, 1.33, s * 0.3, 1.4, 0.028, dark); // and half of the mouth, turned up at the corner
  });
  m.fin([[0, 0.48, 0.25], [0, 0.48, -0.2], [0, 0.44, -0.6]], [[0, 1.25, -0.3], [0, 1.08, -0.7], [0, 0.5, -0.85]], [tone, shade]);
  m.fin([[0, 0.3, -1.2], [0, 0.27, -1.55]], [[0, 0.72, -1.55], [0, 0.3, -1.8]], tone);
  m.fin([[0, 0.14, -2.42], [0, 0.02, -2.48], [0, -0.08, -2.42]], [[0, 1.15, -3.3], [0, 0.1, -2.85], [0, -0.5, -3.0]], [tone, shade]);
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


// ================================================================ not yet in the dive
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
