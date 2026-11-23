// The keeper of a rift. Each band's rift is kept by one creature, and the way down stays shut until it has
// been dealt with. The four differ, and each is a place to use one of the fish's tools:
//   band 1  the Keeper       armoured; a fight to be read, blow by blow          ram a leg while it is open, then ram it again or go round it; four legs
//   band 2  the Shearer      a fight of lines and stillness                       ram its flank while it is spent or stuck (a row of teeth each); wrap the saw to snap it
//   band 3  the Lamplighter  hangs over the rift and lunges; takes a bait first  ram or wrap it while its lamp is out
//   band 4  the Warden       an eel circling the mouth that tightens on a fish   ram its head, or bait the head out and wrap it
// Any of them can be beaten by rams alone, so a short body is never stuck.

import * as THREE from 'three';
import { T, canWrap } from './world.js';
import { rng, lerp, clamp, damp, glowTexture } from './geo.js';
import { make, paintOf } from './npc.js';

const KINDS = ['keeper', 'shearer', 'lamplighter', 'warden'];
// The Keeper's fight, made the way a Souls boss is. Every blow is shown before it lands, lands where it was aimed and not where the fish has got to,
// takes whatever part of the body is still there (the part nearest the tail, so a dash that carries the head clear does not save what trails), and
// leaves the Keeper open for a moment. Its shell turns a ram. What can be hurt is its legs, and only while it is open: a ram numbs a leg; a second
// ram, or a body drawn round the numb leg, takes it off. `legs` of them gone and it is done; `rage` gone and it is quicker, and digs.
// A shed tail is a parry: it leaves whatever it was about to do and goes to eat it, and is open all the while. Times are seconds, reaches metres.
export const KEEPER_FIGHT = {
  legs: 4, rage: 2, haste: 0.8, // haste: what its wind-ups and rests are multiplied by once it rages
  near: 15, leash: 13, edge: 2.6, walk: [2.1, 3.1], turn: [2.6, 3.7], // it takes up with a body within `near`, and keeps to its ground: `leash` from the middle of it, `edge` back from the rift
  slam: { reach: 4.5, wind: 0.95, aim: 0.6, hit: 1.5, cost: 3, stuck: 2.4 }, // aim: the part of the wind-up it still follows the body for
  sweep: { reach: 4.2, wind: 0.75, time: 0.3, low: 1.5, cost: 2, rest: 1.1, bodies: 4 }, // low: it passes under anything this far over its own back; bodies: how many joints lying in its way make it choose this
  jab: { reach: 2.8, wind: 0.34, hit: 1.0, cost: 1, rest: 0.5, every: 1.7 },
  charge: { from: 5.5, to: 12, tell: 0.75, speed: 9.5, run: 1.0, hit: 2.1, cost: 2, rest: 1.3, every: 7 },
  dig: { down: 0.8, speed: 5.5, under: [1.3, 2.2], tell: 0.55, hit: 2.4, high: 3, cost: 3, rest: 1.8, every: 9 },
  leg: { reach: 1.1, numb: 4.5, stagger: 1.1, torn: 1.7, wrapped: 3.2, room: 0.55 }, // stagger, torn, wrapped: how long each leaves it reeling
  bait: { reach: 8, walk: 3.4, feed: 3.4 },
};
const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// The Shearer's fight. Where the Keeper's is about where a body lies round it, this one is about lines, and about holding still.
// It feels the water a fish moves. Winding up, its line (drawn on the water) follows a tail that is moving, and slides off one that is not: hold still and
// it loses you, move and it has you again, until the line locks. Then it goes down the line, and the saw cuts where it crosses the body: everything behind
// the cut is lost, up to `most`. So a body trailing along its line loses a tip, and one lying across it loses the most there is to lose.
// Its saw turns a ram from ahead. From the side or behind, while it is spent, stuck, or in the middle of a blow, a ram takes a row of its teeth, which do not
// come back (and each row gone, the saw reaches less); a body drawn round it while it is spent snaps the saw, once, which is two rows. `rows` gone and it is done;
// at `rage` left it is quicker, flies low, raising silt, and comes back down its line a second and a third time.
// It sticks its saw in the bed when it stoops, and in a column it is led into; a shed tail it stoops on at once. Near its head it swipes, twice, for one each.
export const SHEARER_FIGHT = {
  rows: 4, rage: 2, haste: 0.8, still: 0.6, // still: a tail slower than this, in metres a second, it cannot feel
  aim: { slash: 0.9, pin: 1.1, lock: 0.7, slide: 2.4, most: 3.5 }, // lock: the part of the wind-up it can still follow for; slide: how fast its line leaves a still fish, and how far
  cut: { speed: [10.5, 12.5], reach: 0.85, less: 0.1, most: 5 },
  swipe: { near: 3.0, tell: 0.45, time: 0.5, reach: 3.4, cost: 1, every: 4.5, rest: 1.1 },
  tired: { slash: 2.2, pin: 2.6, stone: 2.8, bait: 3.2 }, chain: 2, wheel: 0.7,
  bait: 10, front: 1.0, stun: 1.5, snap: 2, // front: how far round from dead ahead, in radians, the saw still turns a ram
};

export function createGuard(scene, world, { seed = 1, floor = 0 } = {}, game) {
  const kind = KINDS[floor], tint = paintOf(floor);
  const rand = rng(seed * 61 + floor * 311 + 7), rr = (a, b) => a + (b - a) * rand();
  const rift = world.rift;
  // where it lives: over the middle of the rift, or, for the Keeper, which walks, on the shelf at the near edge
  const well = kind === 'keeper' ? { x: rift.x - rift.nx * 24, y: rift.y, z: rift.z - rift.nz * 24 } : world.goal, Y0 = well.y; // the level of the shelf at the rift's edge
  const root = new THREE.Group(); scene.add(root);
  const trash = [];
  const keep = (o) => { trash.push(o); return o; };
  const actor = keep(make(kind)), mesh = actor.object, mat = actor.body.material; mesh.rotation.order = 'YXZ'; root.add(mesh); // the guard itself is its component from npc.js
  const glowMap = keep(glowTexture());
  const sprite = (color, size) => { const s = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: glowMap, color, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true }))); s.scale.setScalar(size); root.add(s); return s; };
  const warn = sprite('#ff7f96', 1), lure = actor.parts.glow || null; // the Lamplighter's lamp comes with it
  const rig = actor.rig || null, was = new THREE.Vector3(), fishWas = new THREE.Vector3(); // the Keeper walks on its own legs (crab.js): it is told where it is, and stands there as its feet find the ground
  // the veil: bars of light across the mouth of the rift while its keeper lives
  const lid = new THREE.Mesh(keep(rift.veil()), keep(new THREE.MeshBasicMaterial({ color: tint, transparent: true, opacity: 0.36, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })));
  lid.frustumCulled = false; root.add(lid);
  // what it has left, as beads over its back
  const F = KEEPER_FIGHT, Z = SHEARER_FIGHT, HP = { keeper: F.legs, shearer: Z.rows, lamplighter: 3, warden: 4 }[kind];
  const beadGeo = keep(new THREE.SphereGeometry(0.16, 6, 5)), beadMat = keep(new THREE.MeshBasicMaterial({ color: '#f2faf7', fog: false }));
  const beads = Array.from({ length: HP }, () => { const b = new THREE.Mesh(beadGeo, beadMat); root.add(b); return b; });
  // the warden's body
  const slabs = [];
  if (kind === 'warden') {
    for (const m of actor.segments(11)) { root.add(m); slabs.push({ m, p: new THREE.Vector3() }); }
  }

  const S = { kind, state: 'idle', t: 0, T: 0, mode: 'slash', side: 1, stuck: false, hp: HP, done: false, danger: 0, stun: 0, cool: 1.5, ang: rr(0, 6.28), spin: 1, R: 4.2, hits: 0, bites: 0, flash: 0 };
  const pos = new THREE.Vector3(), vel = new THREE.Vector3(), aim = new THREE.Vector3(), v = new THREE.Vector3(), W = new THREE.Vector3();
  let yaw = 0, bait = null;
  const target = { x: 0, y: 0, z: 0, room: { keeper: F.leg.room, shearer: 0.55, lamplighter: 0.8, warden: 0.6 }[kind], orbit: 1.2, fit: 0.7, can: false, left: 1, threat: 1, progress: 0, arcStart: 0, arcSign: 1, sweep: 1 };
  const set = (state, t = 0) => { S.state = state; S.t = S.T = t; if (state !== 'tired') S.stuck = false; }; // T: how long it was given, so a pose can tell how far through it is
  const HOME = { keeper: [8.6, 0.9], shearer: [11, 2.6], lamplighter: [0, 3.4], warden: [4.2, 1.6] }[kind]; // distance from the middle of where it lives, height over the shelf
  pos.set(well.x + Math.sin(S.ang) * HOME[0], Y0 + HOME[1], well.z + Math.cos(S.ang) * HOME[0]);
  if (kind === 'warden') slabs.forEach((s, i) => s.p.set(well.x + Math.sin(S.ang - (i + 1) * 0.24) * S.R, pos.y, well.z + Math.cos(S.ang - (i + 1) * 0.24) * S.R));

  function fall() {
    if (S.done) return;
    S.done = true; S.hp = 0; S.danger = 0; set('down');
    game.event('down', pos);
  }
  function hurt(stun) {
    S.hp--; S.hits++; S.flash = 1; S.stun = stun;
    game.event('hit', pos); if (S.hp === 1) game.event('laststand', pos); // one blow from done: its instrument takes a solo (main.js)
    if (S.hp <= 0) fall();
  }
  if (kind === 'keeper') Object.assign(S, { leg: new Array(8).fill(0), legT: new Array(8).fill(0), lost: 0, open: false, sink: 0, jabT: 0, chargeT: 4, digT: 0, once: false, dir: 0, last: '', jabbed: 0, wrapLeg: -1, puffT: 0 }); // leg: 0 sound, 1 numb, 2 gone
  if (kind === 'shearer') Object.assign(S, { lost: 0, snapped: false, chain: 0, swipeT: 3, baited: false, slid: 0, locked: false, cut: 0, puffT: 0, hit2: 0 });
  // the Shearer's line: where it means to go, laid on the water while it winds up
  const line = kind === 'shearer' ? new THREE.Mesh(keep(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), keep(new THREE.MeshBasicMaterial({ color: '#ffc2cf', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }))) : null;
  if (line) { line.rotation.order = 'YXZ'; line.frustumCulled = false; root.add(line); }
  const tailWas = new THREE.Vector3(), tailV = new THREE.Vector3(), sawP = new THREE.Vector3();
  const mark = kind === 'keeper' || kind === 'shearer' ? sprite('#ffe2a8', 1) : null, fallen = [], hip = new THREE.Vector3(), near = new THREE.Vector3(); // mark: where a blow that is on its way will land
  const vulnerable = () => !S.done && (kind === 'warden' || S.state === 'tired' || S.state === 'dim');
  const wrappable = () => !S.done && !(kind === 'shearer' && S.snapped) && (S.state === 'tired' || S.state === 'dim' || S.state === 'feed' || S.stun > 0);
  // a dash that reaches it
  // The Keeper's legs. Which one a point is at (the leg from a quarter of the way down it to the foot: nearer the hip than that is shell), and what a blow does to one.
  // (Seen from above, as the dive is: a leg arches up from the shell and down to its foot, and a fish that cannot get lower than a metre and a half off the bed still reaches it.)
  function legNear(p, reach) { let best = -1, least = reach; if (p.y > pos.y + 2.6) return -1; rig.walker.legs.forEach((l, i) => { if (S.leg[i] === 2) return; hip.copy(l.hip).applyMatrix4(mesh.matrix); v.subVectors(l.foot, hip).setY(0);
    const t = clamp(near.subVectors(p, hip).setY(0).dot(v) / v.lengthSq(), 0.3, 1), d = Math.hypot(hip.x + v.x * t - p.x, hip.z + v.z * t - p.z); if (d < least) { least = d; best = i; } }); return best; }
  function numb(i) { S.leg[i] = 1; S.legT[i] = F.leg.numb; S.hits++; S.flash = 1; S.stun = Math.max(S.stun, F.leg.stagger); set('rest', S.stun); game.event('hit', pos); game.event('numb', rig.walker.legs[i].foot); }
  function tear(i, wrapped) { const foot = rig.walker.legs[i].foot;
    S.leg[i] = 2; S.lost++; S.hp = HP - S.lost; S.hits++; S.flash = 1; S.stun = wrapped ? F.leg.wrapped : F.leg.torn; set('rest', S.stun); vel.set(0, 0, 0);
    mesh.updateMatrixWorld(true); for (const m of rig.shed(i)) { root.attach(m); fallen.push(m); } // the leg lies where it came off
    game.event('hit', pos); game.event('tear', foot);
    if (S.lost >= HP) fall(); else if (S.lost === F.rage) { S.digT = 0; game.event('rage', pos); } }
  function ramKeeper(snout, power) {
    if (S.done || S.sink > 0.5) return null;
    const i = legNear(snout, F.leg.reach);
    if (i < 0 && snout.distanceTo(pos) > 2.1) return null;
    if (S.stun > 0.3 && S.flash > 0.2) return null; // one ram, one blow
    if (i < 0 || !S.open) { // the shell, or a leg it has its weight on
      if (power > 1 && !S.open) { S.stun = 2; S.flash = 1; set('rest', 2); game.event('hit', pos); return { kind: 'guard', pos: pos.clone(), food: 0 }; } // a full crest breaks its guard: it reels, and is open
      S.flash = 0.5; game.event('clang', pos); game.event('turned', pos); return { kind: 'guard', pos: pos.clone(), food: 0, bounced: true }; }
    for (let b = 0; b < power && !S.done && S.leg[i] !== 2; b++) { if (S.leg[i] === 0) numb(i); else tear(i, false); }
    return { kind: 'guard', pos: pos.clone(), food: 0 };
  }
  // The Shearer's teeth. A row gone: it shows on the saw, the saw reaches less, and at `rage` left the fight changes
  const wear = () => { rig.wear?.(Math.min(S.lost, Z.rows), S.snapped); };
  function tooth(n, stun) { for (let i = 0; i < n && S.hp > 0; i++) { S.hp--; S.lost++; S.hits++; } S.flash = 1; S.stun = stun; S.chain = 0; wear(); set('tired', Math.max(stun, 1.6)); vel.multiplyScalar(0.2);
    game.event('hit', pos); game.event('tooth', pos); if (S.hp <= 0) fall(); else if (S.hp <= Z.rage && S.hp + n > Z.rage) game.event('rage', pos); }
  function ramShearer(snout, power) {
    if (S.done) return null;
    sawP.set(pos.x + Math.sin(yaw) * 2.2, pos.y, pos.z + Math.cos(yaw) * 2.2);
    if (snout.distanceTo(pos) > 1.7 && snout.distanceTo(sawP) > 1.4) return null;
    if (S.stun > 0.3 && S.flash > 0.2) return null; // one ram, one blow
    const ahead = Math.abs(wrapPi(Math.atan2(snout.x - pos.x, snout.z - pos.z) - yaw)) < Z.front, st = S.state;
    if (ahead || !(st === 'tired' || S.stun > 0 || st === 'aim' || st === 'charge' || st === 'cock' || st === 'swipe')) { // the saw, or a flank it has its wits about
      S.flash = 0.5; game.event('clang', pos); if (ahead) game.event('sawturned', pos); return { kind: 'guard', pos: pos.clone(), food: 0, bounced: true }; }
    tooth(power, Z.stun);
    return { kind: 'guard', pos: pos.clone(), food: 0 };
  }
  function ram(snout, power = 1) { // power: how many blows this one counts for
    if (kind === 'keeper') return ramKeeper(snout, power);
    if (kind === 'shearer') return ramShearer(snout, power);
    if (S.done || snout.distanceTo(pos) > { keeper: 2.1, shearer: 1.5, lamplighter: 1.9, warden: 1.3 }[kind]) return null;
    if (S.stun > 0.3 && S.flash > 0.2) return null; // one ram, one blow
    if (!vulnerable()) { S.stun = 0.4; S.flash = 0.5; game.event('clang', pos); return { kind: 'guard', pos: pos.clone(), food: 0, bounced: true }; } // lit, the Lamplighter shrugs it off
    if (kind === 'warden') S.spin *= -1;
    for (let i = 0; i < power && !S.done; i++) hurt({ keeper: 1.6, shearer: 1.5, lamplighter: 1.2, warden: 1.3 }[kind]);
    return { kind: 'guard', pos: pos.clone(), food: 0 };
  }
  const tailNear = (ctx, reach) => { const J = ctx.joints, N = J.length - 1; for (let j = Math.ceil(N * 0.4); j <= N; j++) if (J[j].distanceTo(pos) < reach) return j; return -1; };
  const tailPoint = (ctx) => { const J = ctx.joints; if (!J) return null; const N = J.length - 1; let best = null, near = 1e9; for (let j = Math.ceil(N * 0.4); j <= N; j++) { const d = J[j].distanceToSquared(pos); if (d < near) { near = d; best = J[j]; } } return best; };
  const sawNear = (ctx, reach) => { const J = ctx.joints, N = J.length - 1; v.copy(vel).setLength(2.6).add(pos); for (let j = Math.ceil(N * 0.4); j <= N; j++) if (J[j].distanceTo(v) < reach || J[j].distanceTo(pos) < reach) return j; return -1; }; // the tail, where the saw out ahead of it can reach, or its body
  const baitNear = (ctx, reach) => ctx.pieces.find((p) => p.kind === 'decoy' && !p.dead && p.life > 0.8 && p.pos.distanceTo(pos) < reach) || null;
  const go = (dt, to, speed, turn = 4) => { // swim toward a point
    v.subVectors(to, pos); const d = v.length();
    if (d > 1e-3) { vel.lerp(v.multiplyScalar(speed / d), 1 - Math.exp(-turn * dt)); yaw += wrapPi(Math.atan2(vel.x, vel.z) - yaw) * (1 - Math.exp(-6 * dt)); }
    pos.addScaledVector(vel, dt);
    return d;
  };

  // The Shearer keeps to open water. It is as long as a column is tall, and where columns stand close it used to end a charge in among them and
  // could not get out again: pushed off one, it was pushed onto the next. So it never goes round what stands: it goes over. `over` is the top of
  // whatever stands under its length or just ahead of it; `struck` says whether a point is in stone, and puts it outside if it is.
  // (What stands more than HOP over where it swims, a tall pillar, it does not climb: one of those alone cannot hold it, and it is pushed round it.)
  const HOP = 3.2, over = (reach = 1.1) => { let top = -1e9; const sp = Math.hypot(vel.x, vel.z) || 1, fx = sp > 0.2 ? vel.x / sp : Math.sin(yaw), fz = sp > 0.2 ? vel.z / sp : Math.cos(yaw), most = pos.y + HOP + watch.lift;
    for (const k of [-2.6, -1.3, 0, 1.3, 2.6, 4.2]) { const t = world.topNear(pos.x + fx * k, pos.z + fz * k, reach); if (t <= most) top = Math.max(top, t); } return top; };
  const v2 = new THREE.Vector3(), struck = (radius = 0.7) => { v2.copy(pos); world.pushOut(pos, radius); return pos.distanceToSquared(v2) > 1e-6; };
  // the Keeper on its ground: it walks, round what stands, no farther from the middle of its ground than its leash and never out over the rift
  const hold = () => { const dx = pos.x - W.x, dz = pos.z - W.z, d = Math.hypot(dx, dz); if (d > F.leash) { pos.x = W.x + dx / d * F.leash; pos.z = W.z + dz / d * F.leash; }
    const inn = rift.in(pos.x, pos.z) + F.edge; if (inn > 0) { pos.x -= rift.nx * inn; pos.z -= rift.nz * inn; } };
  const move = (dt) => { const x0 = pos.x, z0 = pos.z; pos.addScaledVector(vel, dt); world.steer(pos, 1.2); hold(); pos.y = damp(pos.y, world.height(pos.x, pos.z) + HOME[1], 3, dt); return Math.hypot(pos.x - x0, pos.z - z0); };
  const walk = (dt, to, speed) => { v.subVectors(to, pos).setY(0); const d = v.length(); if (d > 1e-3) vel.lerp(v.multiplyScalar(speed / d), 1 - Math.exp(-3 * dt)); move(dt); return d; };
  const turnTo = (dt, a, rate) => { yaw += clamp(wrapPi(a - yaw), -rate * dt, rate * dt); };
  const struckAt = (ctx, test) => { const J = ctx.joints; for (let j = J.length - 1; j >= 0; j--) if (test(J[j])) return j; return -1; }; // whatever part of the body is in a blow's way: the part nearest the tail
  const silt = (at, n, push = 1.6) => { if (world.puff) for (let i = 0; i < n; i++) { const a = rand() * 6.28, r = 0.3 + rand() * 0.9; world.puff(at.x + Math.sin(a) * r, world.height(at.x, at.z) + 0.15, at.z + Math.cos(a) * r, Math.sin(a) * push, 0.5 + rand() * 0.9, Math.cos(a) * push, 0.3 + rand() * 0.35, 1 + rand()); } };
  const lineTo = (to, locked) => { v2.subVectors(to, pos); const d = v2.length() || 1, far = d + 5; v2.multiplyScalar(1 / d); // from the Shearer, through where it is aimed, and on
    line.visible = true; line.material.opacity = locked ? 0.75 : 0.32; line.scale.set(locked ? 0.5 : 0.3, 1, far);
    line.rotation.set(-Math.asin(clamp(v2.y, -1, 1)), Math.atan2(v2.x, v2.z), 0); line.position.copy(pos).addScaledVector(v2, far / 2); line.position.y -= 0.25; };
  const markAt = (at, size) => { mark.visible = true; mark.position.set(at.x, world.height(at.x, at.z) + 0.25, at.z); mark.scale.setScalar(size); };
  const watch = { p: new THREE.Vector3(), t: 0, lift: 0, side: 0, dodge: 0 }, UP = new THREE.Vector3(0, 1, 0); // the last resort: if it is getting nowhere, the Shearer rises until it is, and the Keeper turns aside

  function update(dt, ctx) {
    W.set(well.x + T * Math.round((ctx.focus.x - well.x) / T), Y0, well.z + T * Math.round((ctx.focus.z - well.z) / T)); // where it lives, on the nearest copy of the world
    pos.x += T * Math.round((ctx.focus.x - pos.x) / T); pos.z += T * Math.round((ctx.focus.z - pos.z) / T);
    for (const s of slabs) { s.p.x += T * Math.round((ctx.focus.x - s.p.x) / T); s.p.z += T * Math.round((ctx.focus.z - s.p.z) / T); }
    S.t -= dt; S.cool -= dt; S.flash = Math.max(0, S.flash - dt * 2.5); S.danger = 0;
    const fish = ctx.pos, far = Math.hypot(fish.x - W.x, fish.z - W.z), awake = ctx.playing && far < 26;
    let warnSize = 0;
    if (mark) mark.visible = false;
    if (line) line.visible = false;
    if (kind === 'keeper') for (let i = 0; i < 8; i++) if (S.leg[i] === 1 && !(S.wrapLeg === i && target.progress > 0.15) && (S.legT[i] -= dt) <= 0) S.leg[i] = 0; // a numb leg comes back, unless a body is going round it
    if (S.done) { pos.y = Math.max(world.height(pos.x, pos.z) + 0.5, kind === 'shearer' ? world.topNear(pos.x, pos.z, 0.9) + 0.4 : -1e9, pos.y - 1.6 * dt); if (!rig) mesh.rotation.z = damp(mesh.rotation.z, 1.3, 3, dt); }
    else if (S.stun > 0) { S.stun -= dt; vel.multiplyScalar(Math.exp(-4 * dt)); pos.addScaledVector(vel, dt); }
    else if (kind === 'keeper') { // round and round its ground, sideways, as crabs go, until a body comes near: then it fights (KEEPER_FIGHT)
      const J = ctx.joints, N = J.length - 1, raging = S.lost >= F.rage, q = raging ? F.haste : 1, speed = F.walk[raging ? 1 : 0], rate = F.turn[raging ? 1 : 0];
      let nj = 0, nd = 1e9; for (let j = 0; j <= N; j++) { const d = Math.hypot(J[j].x - pos.x, J[j].z - pos.z); if (d < nd) { nd = d; nj = j; } } // the part of the body nearest it: that is what it goes for
      const P = J[nj], bearing = Math.atan2(P.x - pos.x, P.z - pos.z), off = wrapPi(bearing - yaw), k = S.T > 0 ? clamp(1 - S.t / S.T, 0, 1) : 0;
      const engaged = awake && nd < F.near && Math.hypot(P.x - W.x, P.z - W.z) < F.leash + 7;
      S.jabT -= dt; S.chargeT -= dt; S.digT -= dt; S.jabbed -= dt;
      if (S.state !== 'dig' && S.state !== 'under' && S.state !== 'rise') S.sink = Math.max(0, S.sink - 5 * dt);
      // a shed tail is a parry: whatever it was winding up for, it leaves it and goes to eat
      if ((S.state === 'stalk' || S.state === 'slam' || S.state === 'sweep' || S.state === 'jab' || S.state === 'charge') && (bait = baitNear(ctx, F.bait.reach))) set('fetch');
      if (S.state === 'stalk') { // it turns to the body and closes with it, and picks its blow by where the body lies
        turnTo(dt, bearing, rate); if (nd > 3.1) walk(dt, P, speed); else { vel.multiplyScalar(Math.exp(-6 * dt)); move(dt); }
        if (!engaged) set('idle');
        else if (S.cool <= 0) {
          let lying = 0; for (let j = 0; j <= N; j++) { const dx = J[j].x - pos.x, dz = J[j].z - pos.z; if (Math.hypot(dx, dz) < F.sweep.reach && J[j].y < pos.y + F.sweep.low && Math.abs(wrapPi(Math.atan2(dx, dz) - yaw)) < 1.6) lying++; }
          const begin = (what, t) => { S.last = what; S.once = false; aim.copy(P); set(what, t); if (what === 'slam' || what === 'dig') game.event('windup', pos); }; // its biggest blows have a fill to them
          if (nd < F.jab.reach && S.jabT <= 0 && off > -0.4 && off < 2.1) { begin('jab', F.jab.wind * q); S.jabT = F.jab.every; } // near, and on the small claw's side
          else if (nd < F.slam.reach && Math.abs(off) < 0.85) { if (lying >= F.sweep.bodies && S.last !== 'sweep') { begin('sweep', F.sweep.wind * q); S.dir = yaw; } else begin('slam', F.slam.wind * q); }
          else if (nd > F.charge.from && nd < F.charge.to && S.chargeT <= 0) {
            if (raging && S.digT <= 0) { begin('dig', F.dig.down); S.digT = F.dig.every; S.chargeT = 3; }
            else { begin('charge', F.charge.tell * q); S.side = off >= 0 ? 1 : -1; S.chargeT = F.charge.every * q; } }
        }
      }
      else if (S.state === 'slam') { // the great claw goes up. For the first part of that it still follows the body; then it is aimed, and the mark shows where
        warnSize = 2.6; S.danger = 0.8;
        if (k < F.slam.aim) { aim.copy(P); turnTo(dt, bearing, 5); }
        v.subVectors(aim, pos).setY(0); const d = v.length(); if (d > F.slam.reach) aim.set(pos.x + v.x * F.slam.reach / d, 0, pos.z + v.z * F.slam.reach / d);
        aim.y = world.height(aim.x, aim.z); vel.multiplyScalar(Math.exp(-6 * dt)); move(dt);
        if (k >= F.slam.aim) markAt(aim, F.slam.hit * 2);
        if (S.t <= 0) { // down it comes, with a step forward if it needs one
          v.subVectors(aim, pos).setY(0); const far = v.length(); if (far > 3.3) { pos.addScaledVector(v, Math.min(far - 3.3, 1.4) / far); hold(); }
          const j = struckAt(ctx, (p) => Math.hypot(p.x - aim.x, p.z - aim.z) < F.slam.hit && p.y - aim.y < 3.2);
          if (j >= 0) { aim.y = ctx.joints[j].y - 0.2; if (game.bite(F.slam.cost, j, pos)) S.bites++; } // it closes on the body if the body is there; if not, it goes into the bed
          game.event('slam', aim); silt(aim, 8); set('stuck', F.slam.stuck * (raging ? 0.85 : 1)); vel.set(0, 0, 0);
        }
      }
      else if (S.state === 'stuck') { if (S.t <= 0) { set('stalk'); S.cool = 0.6 * q; } } // the claw is in the bed, and it hauls on it
      else if (S.state === 'sweep') { warnSize = 3.2; S.danger = 0.8; vel.multiplyScalar(Math.exp(-6 * dt)); move(dt); if (S.t <= 0) { set('sweeping', F.sweep.time); S.once = false; } } // drawn back, wide and low: it does not turn again
      else if (S.state === 'sweeping') { // across its front from its right to its left, under anything that has risen over its back
        S.danger = 1; const swept = lerp(-1.8, 1.8, k) + 0.3;
        if (!S.once) { const j = struckAt(ctx, (p) => { const dx = p.x - pos.x, dz = p.z - pos.z, d = Math.hypot(dx, dz); if (d > F.sweep.reach || d < 0.9 || p.y > pos.y + F.sweep.low) return false; const o = wrapPi(Math.atan2(dx, dz) - S.dir); return o > -1.9 && o < swept; });
          if (j >= 0 && game.bite(F.sweep.cost, j, pos)) { S.bites++; S.once = true; } }
        if (S.t <= 0) set('rest', F.sweep.rest * q);
      }
      else if (S.state === 'jab') { // the small claw, cocked: quick, and it does not take much
        warnSize = 1.5; S.danger = 0.5; if (k < 0.5 && nd < F.jab.reach + 0.5) aim.copy(P); turnTo(dt, bearing, 1.5); vel.multiplyScalar(Math.exp(-6 * dt)); move(dt);
        if (S.t <= 0) { const j = struckAt(ctx, (p) => Math.hypot(p.x - aim.x, p.z - aim.z) < F.jab.hit && Math.abs(p.y - aim.y) < 2); if (j >= 0 && game.bite(F.jab.cost, j, pos)) S.bites++; S.jabbed = 0.2; set('rest', F.jab.rest * q); }
      }
      else if (S.state === 'charge') { // it turns side on to the body and draws itself in: crabs run sideways
        warnSize = 3; S.danger = 0.7; turnTo(dt, bearing - S.side * Math.PI / 2, 6); aim.copy(P); vel.multiplyScalar(Math.exp(-6 * dt)); move(dt);
        if (S.t <= 0) { vel.subVectors(aim, pos).setY(0).setLength(F.charge.speed); set('run', F.charge.run); S.once = false; }
      }
      else if (S.state === 'run') { // and runs, through where the body was. What stands stops it, and so does the end of its ground
        S.danger = 1; const went = move(dt);
        if (!S.once) { const j = struckAt(ctx, (p) => Math.hypot(p.x - pos.x, p.z - pos.z) < F.charge.hit && p.y < pos.y + 1.8); if (j >= 0 && game.bite(F.charge.cost, j, pos)) { S.bites++; S.once = true; } }
        if (went < F.charge.speed * dt * 0.45) { vel.set(0, 0, 0); game.event('clang', pos); set('rest', F.charge.rest * 1.5); }
        else if (S.t <= 0) set('rest', F.charge.rest * q);
      }
      else if (S.state === 'rest') { vel.multiplyScalar(Math.exp(-5 * dt)); move(dt); if (S.t <= 0) { set('stalk'); S.cool = 0.35 * q; } } // it has struck, and gets its breath: open
      else if (S.state === 'fetch') { // to the bait, by the shortest way
        if (!bait || bait.dead || bait.life < 0.4) { bait = null; set('stalk'); }
        else { bait.life = Math.max(bait.life, 0.9); turnTo(dt, Math.atan2(bait.pos.x - pos.x, bait.pos.z - pos.z), rate * 1.5); if (walk(dt, bait.pos, F.bait.walk) < 2.7) { vel.set(0, 0, 0); set('feed', F.bait.feed); } }
      }
      else if (S.state === 'feed') { if (bait && !bait.dead) bait.life = Math.max(bait.life, 0.5); if (S.t <= 0) { if (bait) bait.life = 0.2; bait = null; set('stalk'); S.cool = 0.5; } } // both claws at its mouth: open
      else if (S.state === 'dig') { warnSize = 2; S.sink = Math.min(1, S.sink + dt / F.dig.down); vel.set(0, 0, 0); if ((S.puffT -= dt) <= 0) { S.puffT = 0.08; silt(pos, 2, 2.4); } if (S.t <= 0) set('under', rr(F.dig.under[0], F.dig.under[1])); } // it shuffles itself down into the sand
      else if (S.state === 'under') { // under the sand it makes for the middle of the body, and the sand shows where it is
        S.sink = 1; const mid = J[N >> 1]; v.set(mid.x - pos.x, 0, mid.z - pos.z); const d = v.length(); if (d > 0.05) pos.addScaledVector(v, Math.min(d, F.dig.speed * dt) / d);
        hold(); pos.y = world.height(pos.x, pos.z) + HOME[1]; if ((S.puffT -= dt) <= 0) { S.puffT = 0.1; silt(pos, 1, 0.8); }
        if (S.t <= 0) { aim.copy(pos); set('rise', F.dig.tell * q); }
      }
      else if (S.state === 'rise') { // the sand heaves where it is coming up
        S.sink = 1; warnSize = 3.2; S.danger = 0.9; markAt(pos, F.dig.hit * 2); if ((S.puffT -= dt) <= 0) { S.puffT = 0.05; silt(pos, 2, 2.6); }
        if (S.t <= 0) { world.steer(pos, 1.2); hold(); const j = struckAt(ctx, (p) => Math.hypot(p.x - pos.x, p.z - pos.z) < F.dig.hit && p.y < pos.y + F.dig.high); if (j >= 0 && game.bite(F.dig.cost, j, pos)) S.bites++;
          game.event('slam', pos); silt(pos, 10, 3); yaw = bearing; set('rest', F.dig.rest * q); }
      }
      else { // nobody near: its round
        S.ang += dt * 0.17; aim.set(W.x + Math.sin(S.ang) * HOME[0], 0, W.z + Math.cos(S.ang) * HOME[0]); aim.y = world.height(aim.x, aim.z) + HOME[1]; // over the ground as it lies, not at one height
        v.subVectors(aim, pos).setY(0); const d = v.length();
        // Walking straight at a wall of things it is pushed straight back, and gets nowhere. So if it has got nowhere for a while it turns
        // aside and walks along the wall, one way and then, if that was no good, the other, until it is past it.
        watch.t += dt; if (watch.t > 2.5) { if (d > 3 && Math.hypot(pos.x - watch.p.x, pos.z - watch.p.z) < 0.7) { watch.side = watch.side > 0 ? -1 : 1; watch.dodge = 3.2; } watch.p.copy(pos); watch.t = 0; }
        if (watch.dodge > 0) { watch.dodge -= dt; v.applyAxisAngle(UP, watch.side * 1.35); }
        if (d > 1e-3) vel.lerp(v.multiplyScalar(1.5 / d), 1 - Math.exp(-2 * dt));
        pos.addScaledVector(vel, dt); world.steer(pos, 1.2); // round a column, not through it
        pos.y = damp(pos.y, world.height(pos.x, pos.z) + HOME[1], 3, dt);
        const face = awake && pos.distanceTo(fish) < 15 ? Math.atan2(fish.x - pos.x, fish.z - pos.z) : Math.atan2(pos.x - W.x, pos.z - W.z); // it watches a fish that is near; otherwise it looks out from its ground
        yaw += wrapPi(face - yaw) * (1 - Math.exp(-2.4 * dt));
        if (engaged && S.cool <= 0) set('stalk');
      }
    } else if (kind === 'shearer') { // it sweeps its saw over the rift and feels a fish that comes near; then the fight (SHEARER_FIGHT)
      const J = ctx.joints, N = J.length - 1, tail = J[N], floor = (p) => Math.max(world.height(p.x, p.z), rift.ledgeY); // the bed, or over the mouth of the rift the veil it keeps
      const raging = S.hp <= Z.rage, q = raging ? Z.haste : 1, k = S.T > 0 ? clamp(1 - S.t / S.T, 0, 1) : 0, fx = Math.sin(yaw), fz = Math.cos(yaw);
      const tailSpeed = dt > 1e-5 ? Math.min(tail.distanceTo(tailWas) / dt, 20) : 0, moving = tailSpeed > Z.still;
      if (dt > 1e-5) { v.subVectors(tail, tailWas).multiplyScalar(1 / dt); if (v.length() > 8) v.setLength(8); tailV.lerp(v, 1 - Math.exp(-6 * dt)); } tailWas.copy(tail); // which way the tail is going, and how fast: it aims ahead of it
      const sawOut = S.snapped ? 1.5 : 2.6, reach = Z.cut.reach - Z.cut.less * S.lost;
      S.swipeT -= dt;
      const spent = (secs, stuck = false) => { set('tired', secs * q); S.stuck = stuck; S.chain = 0; S.baited = false; };
      const strike = (at, pin) => { aim.copy(at); S.mode = pin ? 'pin' : 'slash'; S.side = rand() < 0.5 ? 1 : -1; S.slid = 0; S.locked = false; set('aim', (pin ? Z.aim.pin : Z.aim.slash) * q); };
      // a shed tail: it stoops on that, whatever it was about
      if (!S.baited && (S.state === 'idle' || S.state === 'sense' || (S.state === 'aim' && !S.locked)) && S.cool <= 0 && (bait = baitNear(ctx, Z.bait))) { strike(bait.pos, true); S.baited = true; }
      if (S.baited && bait && !bait.dead) { bait.life = Math.max(bait.life, 0.9); if (!S.locked) aim.copy(bait.pos); }
      if (S.state === 'sense') { // something is there: it slows, and the saw swings round to it
        vel.multiplyScalar(Math.exp(-2.5 * dt)); pos.addScaledVector(vel, dt); struck(); yaw += wrapPi(Math.atan2(fish.x - pos.x, fish.z - pos.z) - yaw) * (1 - Math.exp(-3 * dt));
        if (S.t <= 0) { if (!awake || pos.distanceTo(fish) > 24) set('idle'); else { strike(tail, tail.y - floor(tail) < 1.5); game.event('aimed', pos); } }
      }
      else if (S.state === 'aim') { // winding up. Its line follows a tail it can feel moving and slides off one it cannot, until it locks
        warnSize = 2.8; S.danger = 0.7;
        if (!S.locked && k >= Z.aim.lock) { S.locked = true; game.event('windup', pos); }
        if (!S.locked && !S.baited) {
          if (moving) { const lead = Math.min(1.3, Math.max(S.t, 0) + pos.distanceTo(tail) / Z.cut.speed[raging ? 1 : 0]); v.copy(tail).addScaledVector(tailV, lead); aim.lerp(v, 1 - Math.exp(-9 * dt)); S.slid = 0; } // where the tail will be when the saw gets there, if it goes on as it is going
          else if (S.slid < Z.aim.most) { v.set(aim.x - pos.x, 0, aim.z - pos.z).normalize(); const d = Z.aim.slide * dt; aim.x += -v.z * S.side * d; aim.z += v.x * S.side * d; S.slid += d; }
        }
        yaw += wrapPi(Math.atan2(aim.x - pos.x, aim.z - pos.z) - yaw) * (1 - Math.exp(-9 * dt));
        if (S.mode === 'pin') { // up over the tail and a little short of it, nose down, the point of the saw hanging over it
          v.set(aim.x - pos.x, 0, aim.z - pos.z); const d = v.length() || 1; v.multiplyScalar(Math.max(0, d - 2.4) / d).add(pos).setY(aim.y + 6);
          v.sub(pos); const off = v.length(); vel.lerp(off > 1e-3 ? v.multiplyScalar(Math.min(9, off * 4) / off) : v, 1 - Math.exp(-6 * dt)); pos.addScaledVector(vel, dt); struck();
          markAt(aim, 1.6 + (S.locked ? 1 : 0));
        } else { vel.multiplyScalar(Math.exp(-5 * dt)); pos.y += clamp(aim.y - pos.y, -8 * dt, 8 * dt); lineTo(aim, S.locked); } // level with the tail, from however high it had gone to clear something: the slash goes through it flat
        if (S.t <= 0) { const sp = Z.cut.speed[raging ? 1 : 0]; vel.subVectors(aim, pos).setLength(sp); set('charge', S.mode === 'pin' ? pos.distanceTo(aim) / sp + 0.15 : Math.min(1.5, pos.distanceTo(aim) / sp + 0.35)); S.cut = 0; }
      }
      else if (S.state === 'charge') { // down the line. The saw cuts where it crosses the body, and what is behind the cut is gone
        S.danger = 1; pos.addScaledVector(vel, dt);
        let stone = false; if (world.inStone(pos, 0.7, 1.6)) { struck(); vel.set(0, 0, 0); stone = true; game.event('clang', pos); spent(Z.tired.stone, 'stone'); } // it has run onto a column or a rock (not a kerb: it stoops past those): the saw is in it
        v.copy(vel).setLength(sawOut).add(pos); let hit = false;
        if (!stone && !S.cut) for (let j = 0; j <= N && !hit; j++) if (J[j].distanceTo(v) < reach || J[j].distanceTo(pos) < reach) { const n = clamp(N - j, 1, Z.cut.most); if (game.bite(n, j, pos)) { hit = true; S.bites++; S.cut = n; } }
        if (raging && S.mode !== 'pin' && pos.y - floor(pos) < 3.2 && (S.puffT -= dt) <= 0) { S.puffT = 0.05; silt(pos, 1, 1.2); } // low over the bed, it raises the silt
        v.copy(vel).setLength(sawOut + 0.7).add(pos); const down = S.mode === 'pin' && v.y <= floor(v) + 0.1; // v: the point of the saw
        if (S.state === 'charge' && (S.mode === 'pin' ? down || S.t <= -0.6 : S.t <= 0)) { // a slash runs its line out; a stoop goes on down until the saw is in the bed
          if (S.mode === 'pin') { vel.set(0, 0, 0); if (S.baited && bait) bait.life = 0.2; const baited = S.baited; bait = null; spent(baited ? Z.tired.bait : Z.tired.pin, true); }
          else if (raging && S.chain < Z.chain) { S.chain++; set('wheel', Z.wheel); } // and round, and back down it
          else spent(Z.tired.slash);
        }
      }
      else if (S.state === 'wheel') { // it comes about
        S.danger = 0.6; warnSize = 2; vel.multiplyScalar(Math.exp(-3.5 * dt)); pos.addScaledVector(vel, dt); struck(); yaw += wrapPi(Math.atan2(tail.x - pos.x, tail.z - pos.z) - yaw) * (1 - Math.exp(-7 * dt));
        if (S.t <= 0) { strike(tail, false); S.t = S.T = Z.aim.slash * q * 0.75; }
      }
      else if (S.state === 'cock') { // a body by its head: the saw goes back to one side
        warnSize = 2; S.danger = 0.6; vel.multiplyScalar(Math.exp(-4 * dt)); pos.addScaledVector(vel, dt); struck();
        if (S.t <= 0) { set('swipe', Z.swipe.time); S.hit2 = 0; }
      }
      else if (S.state === 'swipe') { // and across, and back: one for each that lands
        S.danger = 1;
        if ((S.hit2 === 0 && k > 0.2) || (S.hit2 === 1 && k > 0.7)) { S.hit2++;
          const j = struckAt(ctx, (p) => { const dx = p.x - pos.x, dz = p.z - pos.z; return Math.hypot(dx, dz) < Z.swipe.reach - (S.snapped ? 1 : 0) && Math.abs(p.y - pos.y) < 1.3 && Math.abs(wrapPi(Math.atan2(dx, dz) - yaw)) < 1.25; });
          if (j >= 0 && game.bite(Z.swipe.cost, j, pos)) S.bites++; }
        if (S.t <= 0) { spent(Z.swipe.rest); S.swipeT = Z.swipe.every; }
      }
      else if (S.state === 'tired') { // spent, it coasts and sinks; stuck, it stays where its saw is
        if (!S.stuck) { vel.multiplyScalar(Math.exp(-2.5 * dt)); pos.addScaledVector(vel, dt); const rest = over(0.9) + 0.7, sunk = pos.y - 0.5 * dt; pos.y = Math.max(floor(pos) + 0.8, pos.y >= rest ? Math.max(sunk, rest) : sunk); struck(); } // over something, it sinks no lower than its top; beside it, it is kept out of it
        else if (S.stuck !== 'stone') pos.y = damp(pos.y, floor(pos) + 1.7, 8, dt); // its tail in the air, its saw in the bed
        if (S.t <= 0) { set('idle'); S.cool = 1.2 * q; }
      }
      else {
        S.ang += dt * 0.3; aim.set(W.x + Math.sin(S.ang) * HOME[0], Y0 + HOME[1] + 0.35 * Math.sin(ctx.time * 0.5), W.z + Math.cos(S.ang) * HOME[0]);
        // on its round, or on its way back to it from wherever a charge left it: over whatever stands in the way, and up to that height before it gets there
        watch.t += dt; if (watch.t > 2) { if (pos.distanceTo(aim) > 4 && Math.hypot(pos.x - watch.p.x, pos.z - watch.p.z) < 0.8) watch.lift = Math.min(12, watch.lift + 4); else watch.lift = Math.max(0, watch.lift - 2); watch.p.copy(pos); watch.t = 0; }
        const clear = over() + 1.2 + watch.lift; aim.y = Math.max(aim.y, clear);
        go(dt, aim, 3.2, 2.5); if (pos.y < clear) pos.y = Math.min(clear, pos.y + 7 * dt);
        struck();
        const stir = dt > 1e-5 ? Math.min(fish.distanceTo(fishWas) / dt, 12) : 0; // it feels the water a fish moves: a still one has to come nearer
        if (awake && S.cool <= 0) {
          sawP.set(pos.x + fx * 2.2, pos.y, pos.z + fz * 2.2); let by = -1; if (S.swipeT <= 0) for (let j = 0; j <= N && by < 0; j++) if (J[j].distanceTo(sawP) < Z.swipe.near) by = j; // a body right by its head gets the flat of the saw
          if (by >= 0) { S.side = wrapPi(Math.atan2(J[by].x - pos.x, J[by].z - pos.z) - yaw) >= 0 ? 1 : -1; set('cock', Z.swipe.tell * q); }
          else if (pos.distanceTo(fish) < 12 + 8 * clamp(stir / 9, 0, 1)) set('sense', 0.6 * q);
        }
      }
      fishWas.copy(fish);
    } else if (kind === 'lamplighter') { // over the mouth; it lunges at a tail, but takes a bait first, and a mouthful puts its lamp out
      if (S.state === 'windup') { warnSize = 3; S.danger = bait ? 0 : 0.8; const at = bait ? bait.pos : aim; yaw += wrapPi(Math.atan2(at.x - pos.x, at.z - pos.z) - yaw) * (1 - Math.exp(-9 * dt)); if (S.t <= 0) { v.subVectors(at, pos); vel.copy(v).setLength((v.length() + 0.8) / 0.28); set('lunge', 0.28); } }
      else if (S.state === 'lunge') {
        S.danger = bait ? 0 : 1; pos.addScaledVector(vel, dt);
        if (bait) { if (!bait.dead && pos.distanceTo(bait.pos) < 1.2) { bait.life = Math.min(bait.life, 0.3); bait = null; vel.set(0, 0, 0); set('dim', 4.5); } }
        else { const j = tailNear(ctx, 0.95); if (j >= 0 && game.bite(3, j, pos)) { S.bites++; vel.set(0, 0, 0); set('dim', 1.2); } }
        if (S.state === 'lunge' && S.t <= 0) { vel.set(0, 0, 0); set('dim', bait ? 1 : 2.2); bait = null; }
      } else if (S.state === 'dim') { if (S.t <= 0) { set('idle'); S.cool = 1; } }
      else {
        aim.set(W.x, Y0 + HOME[1] + 0.3 * Math.sin(ctx.time), W.z); go(dt, aim, 2.4, 2);
        if (pos.distanceTo(fish) < 12) yaw += wrapPi(Math.atan2(fish.x - pos.x, fish.z - pos.z) - yaw) * (1 - Math.exp(-2 * dt));
        bait = S.cool <= 0 ? baitNear(ctx, 9) : null;
        if (bait) { set('windup', 0.7); game.event('windup', pos); }
        else if (awake && S.cool <= 0) { const j = tailNear(ctx, 5); if (j >= 0) { aim.copy(ctx.joints[j]); set('windup', 0.9); game.event('windup', pos); } }
      }
    } else { // the warden: round the mouth, tightening on a fish that swims into its ring; a bait draws the head out
      const inside = Math.hypot(fish.x - W.x, fish.z - W.z) < S.R - 0.3 && Math.abs(fish.y - pos.y) < 2.2;
      if (S.state === 'fetch') { if (!bait || bait.dead) { bait = null; set('idle'); } else if (go(dt, bait.pos, 4.2) < 1) { vel.set(0, 0, 0); set('feed', 3.2); } }
      else if (S.state === 'feed') { if (bait && !bait.dead) bait.life = Math.max(bait.life, 0.5); if (S.t <= 0) { if (bait) bait.life = 0.2; bait = null; set('idle'); S.cool = 1.5; } }
      else {
        if (S.state === 'tighten') { warnSize = 3; S.danger = 1; S.R = Math.max(1.3, S.R - 2.1 * dt); if (S.t <= 0) { if (inside && game.bite(3, 1, pos)) S.bites++; set('loose', 1.6); } }
        else { S.R = Math.min(4.2, S.R + 2.4 * dt); if (S.state === 'loose' && S.t <= 0) set('idle'); bait = S.cool <= 0 && S.state === 'idle' ? baitNear(ctx, 10) : null; if (bait) set('fetch'); else if (awake && S.state === 'idle' && inside && S.R > 4) { set('tighten', 1.4); game.event('windup', pos); } }
        if (S.state !== 'fetch') { S.ang += S.spin * dt * (3.2 / Math.max(S.R, 1.3)); aim.set(W.x + Math.sin(S.ang) * S.R, Y0 + HOME[1], W.z + Math.cos(S.ang) * S.R); const d = go(dt, aim, 3.6 + 2.5 * clamp(pos.distanceTo(aim) - 1, 0, 3), 6); if (d > 6) S.ang = Math.atan2(pos.x - W.x, pos.z - W.z); }
      }
      let lead = pos; // the body follows the head, each slab a fixed distance behind the one before
      for (const s of slabs) { v.subVectors(s.p, lead); const d = v.length() || 1; s.p.copy(lead).addScaledVector(v, 0.95 / d); s.m.position.copy(s.p); s.m.rotation.y = Math.atan2(lead.x - s.p.x, lead.z - s.p.z); s.m.visible = !S.done; lead = s.p; }
    }
    if (!S.done) pos.y = clamp(pos.y, world.height(pos.x, pos.z) + 0.6, world.ceiling - 0.5);

    if (rig && kind === 'keeper') {
      const moved = Math.hypot(pos.x - was.x, pos.z - was.z), kk = dt > 1e-5 && moved < 5 ? 1 / dt : 0, close = pos.distanceTo(fish), st = S.state, k = S.T > 0 ? clamp(1 - S.t / S.T, 0, 1) : 0; // how it really moved, whatever moved it
      S.open = !S.done && S.sink < 0.5 && (S.stun > 0 || st === 'stuck' || st === 'rest' || st === 'feed'); // open: a leg can be hurt
      const id = S.done || S.stun > 0 ? '' : st === 'slam' || st === 'sweep' || st === 'sweeping' || st === 'jab' || st === 'stuck' || st === 'feed' ? st : st === 'run' ? 'charge' : st === 'rest' ? (S.jabbed > 0 ? 'jabbed' : 'spent') : '';
      rig.walker.legs.forEach((l, i) => { l.lame = S.leg[i] === 1; });
      rig.update(dt, { x: pos.x, z: pos.z, yaw, vx: (pos.x - was.x) * kk, vz: (pos.z - was.z) * kk, ground: world.footing, floor: S.sink > 0.05 ? undefined : world.footing(v.set(pos.x, 0, pos.z)).y, time: ctx.time,
        wary: awake && !S.done ? clamp(1.3 - close / 11, 0, 1) : 0, look: fish, act: id ? { id, k, at: st === 'feed' && bait ? bait.pos : aim } : null,
        tuck: !S.done && st === 'charge', stun: S.stun > 0, limp: S.done, sink: S.sink, rage: S.lost >= F.rage }); // (rage: only so that it can be seen to rage)
      const clear = pos.y - (rig.walker.body.ground + HOME[1]) - 0.7; if (clear > 0 && !S.done) mesh.position.y += clear; // lifted off the ground, it is drawn where it is
      for (const m of fallen) { m.position.x += T * Math.round((ctx.focus.x - m.position.x) / T); m.position.z += T * Math.round((ctx.focus.z - m.position.z) / T); const low = world.height(m.position.x, m.position.z) + 0.14; if (m.position.y > low) { m.position.y = Math.max(low, m.position.y - 2.4 * dt); m.rotation.x += 0.9 * dt; } } // a leg that has come off sinks to the bed and lies there
      was.copy(pos);
    } else if (rig) { // the Shearer bends its own body (sawfish.js): it is told where it is, how it is moving and what it is about
      const k = dt > 1e-5 && pos.distanceTo(was) < 5 ? 1 / dt : 0, mood = S.done ? 'down' : S.stun > 0 ? 'stun' : S.state === 'tired' ? (S.stuck === 'stone' ? 'jammed' : S.stuck ? 'stuck' : 'tired') : S.state === 'idle' ? 'search' : S.state === 'wheel' ? 'sense' : S.state === 'cock' ? 'aim' : S.state;
      rig.update(dt, { x: pos.x, y: pos.y, z: pos.z, yaw, speed: Math.hypot(pos.x - was.x, pos.z - was.z) * k, climb: (pos.y - was.y) * k, mood, mode: S.state === 'cock' ? 'slash' : S.mode, side: S.side, k: S.T > 0 ? 1 - S.t / S.T : 0, look: fish, time: ctx.time });
      rig.settle(dt, (p) => { p.x += T * Math.round((ctx.focus.x - p.x) / T); p.z += T * Math.round((ctx.focus.z - p.z) / T); return world.height(p.x, p.z); }); // the teeth it has lost, and the end of its saw, sink to the bed and lie there
      was.copy(pos);
    } else {
      mesh.position.copy(pos); mesh.rotation.y = yaw; actor.tick(S.done ? dt * 0.27 : dt, S.done ? 0 : vel.length());
      if (!S.done) mesh.rotation.z = S.stun > 0 ? 0.35 * Math.sin(ctx.time * 16) : 0;
    }
    mat.emissiveIntensity = 0.12 + 0.9 * S.flash;
    warn.position.copy(pos).y += kind === 'keeper' ? 2.4 : 0.6; // over the Keeper's back, where it can be seen from above warn.scale.setScalar(Math.max(0.01, warnSize * (1 + 0.15 * Math.sin(ctx.time * 30)))); warn.visible = warnSize > 0 && !S.done;
    if (lure) { const lit = !S.done && S.state !== 'dim' && S.stun <= 0; lure.scale.setScalar(damp(lure.scale.x, lit ? (S.state === 'windup' ? 5 : 3) : 0.4, 8, dt)); }
    beads.forEach((b, i) => { b.visible = !S.done && i < S.hp && !(S.sink > 0.5); b.position.set(pos.x + (i - (HP - 1) / 2) * 0.5, pos.y + (kind === 'keeper' ? 3 : 2.1), pos.z); });
    lid.position.set(T * Math.round((ctx.focus.x - rift.x) / T), 0, T * Math.round((ctx.focus.z - rift.z) / T)); // the veil is laid out where the rift is; this puts it on the nearest copy of the world
    lid.material.opacity = damp(lid.material.opacity, S.done ? 0 : 0.36 + 0.1 * Math.sin(ctx.time * 2), 3, dt); lid.visible = lid.material.opacity > 0.01;

    S.wrap = null;
    if (kind === 'keeper') { // what a body can be drawn round is a numb leg: the one nearest the head
      let wi = -1, least = 1e9; if (!S.done && ctx.playing && S.sink < 0.5) rig.walker.legs.forEach((l, i) => { if (S.leg[i] !== 1) return; const d = l.foot.distanceToSquared(fish); if (d < least) { least = d; wi = i; } });
      if (wi !== S.wrapLeg) target.progress = 0; S.wrapLeg = wi;
      if (wi >= 0) { const f = rig.walker.legs[wi].foot; target.x = f.x; target.y = pos.y + 0.4; target.z = f.z; target.can = canWrap(ctx.total, target.room); S.wrap = target; }
    }
    else if (wrappable() && ctx.playing) { const out = kind === 'shearer' && S.stuck ? 1.9 : 0; target.x = pos.x + Math.sin(yaw) * out; target.y = pos.y; target.z = pos.z + Math.cos(yaw) * out; // (the Shearer's saw, when that is what is stuck)
      target.can = canWrap(ctx.total, target.room); S.wrap = target; } else target.progress = 0;
  }
  // while the keeper lives the veil holds: the ledges can be swum over, but nothing goes down between the walls
  function pushOut(p, radius) {
    if (S.done) return;
    const top = rift.ledgeY + 0.5 + radius;
    if (p.y < top && rift.in(p.x, p.z) > rift.ledge - 0.3) p.y = top;
  }
  function dispose() { scene.remove(root); for (const o of trash) o.dispose(); }
  const wrapped = () => { if (kind === 'shearer') { S.snapped = true; target.progress = 0; game.event('snap', pos); return tooth(Z.snap, 2.6); } // the saw goes, and two rows with it
    if (kind !== 'keeper') return fall(); if (S.wrapLeg >= 0 && S.leg[S.wrapLeg] === 1) tear(S.wrapLeg, true); target.progress = 0; }; // round the Keeper's numb leg, it comes off; round any of the others, they are held
  return { update, ram, pushOut, dispose, wrapped, state: S, kind, pos, rig, mesh, get yaw() { return yaw; }, get ring() { return S.wrap; }, get done() { return S.done; }, debug: { set, fall, hurt, numb, tear, legNear, leg: (i) => rig.walker.legs[i].foot, charge(x, y, z) { aim.set(x, y, z); vel.subVectors(aim, pos).setLength(10.5); S.mode = 'slash'; S.stuck = false; S.cut = 0; set('charge', 1.4); }, tooth } }; // (debug.charge: for the checks, a slash at a point)
}
