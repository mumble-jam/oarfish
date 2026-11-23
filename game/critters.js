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

// ================================================================ jellyfish (not yet in the dive)
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
