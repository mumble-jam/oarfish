// The keeper of a rift. Each band's rift is kept by one creature, and the way down stays shut until it has
// been dealt with. The four differ, and each is a place to use one of the fish's tools:
//   band 1  the Keeper       armoured; a fight to be read, blow by blow          ram a leg while it is open, then ram it again or go round it; four legs
//   band 2  the Shearer      a fight of lines and stillness                       ram its flank while it is spent or stuck (a row of teeth each); wrap the saw to snap it
//   band 3  the Lamplighter  hangs over the rift and lunges; takes a bait first  ram or wrap it while its lamp is out
//   band 4  the Warden       an eel circling the mouth that tightens on a fish   ram its head, or bait the head out and wrap it
// Any of them can be beaten by rams alone, so a short body is never stuck.

import * as THREE from 'three';
import { canWrap } from './world.js';
import { rng, lerp, clamp, damp, glowTexture } from './geo.js';
import { make, paintOf } from './npc.js';
import { fishBody, struck as takes, gap, pushOut as pushFrom, onSeg as onLeg, FISH } from './shapes.js';

const KINDS = ['keeper', 'shearer', 'lamplighter', 'warden'];
// The Keeper's fight, made the way a Souls boss is. Every blow is shown before it lands, lands where it was aimed and not where the fish has got to,
// takes whatever part of the body is still there (the part nearest the tail, so a dash that carries the head clear does not save what trails), and
// leaves the Keeper open for a moment. Its shell turns a ram. What can be hurt is its legs, and only while it is open: a ram numbs a leg; a second
// ram, or a body drawn round the numb leg, takes it off. `legs` of them gone and it is done; `rage` gone and it is quicker, and digs.
// A shed tail is a parry: it leaves whatever it was about to do and goes to eat it, and is open all the while. Times are seconds, reaches metres.
export const KEEPER_FIGHT = {
  // Legs are the fight (George: 'an epic battle where I have to go by his legs, and his legs should be fun and meaningful to engage with'). A leg goes whole,
  // cracked, numb, off: a ram cracks a whole leg, numbs a cracked one, and takes a numb one off (a numb leg comes back to cracked after `leg.numb`); or a body
  // drawn round a numb leg takes it off. `legs` of them gone and it is done; `rage` gone and it is quicker, and digs. Kept at four and two: a leg now takes three
  // blows where it took two, and the stomps and the hauling give more ways in, so the fight is longer but each leg is a little fight of its own.
  legs: 4, rage: 2, haste: 0.8, // haste: what its wind-ups and rests are multiplied by once it rages
  near: 18, leash: 13, edge: 5, walk: [2.1, 3.1], turn: [2.6, 3.7], close: 4.2, // it takes up with a body within `near`, and keeps to its ground: `leash` from the middle of it, `edge` back from the rift (its feet stand five metres out); close: how near the part of a body it goes for it walks
  // What a blow hits is the claw as it is drawn when it lands (crab.js: `landing`, `strike`), not a disc: see shapes.js. So no blow has a `hit` radius any more.
  // high: how far over the bed the great claw comes down from: it takes anything under its hand and fingers, as seen from above, lower than that.
  // shock: where its fingers hit the bed the bed jolts, and silt flies: that round, this high over the bed, takes a body lying low there too.
  slam: { reach: 5.5, step: 4.3, wind: 0.95, aim: 0.6, high: 4.2, shock: 1.3, shockHigh: 1.9, cost: 3, stuck: 2.4 }, // aim: the part of the wind-up it still follows the body for; step: farther than this, it steps toward where it struck first
  sweep: { reach: 5.0, wind: 0.75, time: 0.3, low: -1.2, cost: 2, rest: 1.1, bodies: 4 }, // low: it does not choose to sweep at what is more than this over its own back (the claw goes across at a fish's height off the bed, and passes under what is higher); bodies: how many joints lying in its way make it choose this
  jab: { reach: 3.8, wind: 0.34, short: 0.3, cost: 1, rest: 0.5, every: 1.7 }, // short: how much of its fingers' span the small claw keeps back of where it is aimed (the rest goes past it)
  charge: { from: 7, to: 14, tell: 0.75, speed: 9.5, run: 1.0, slack: 0.2, cost: 2, rest: 1.3, every: 7 }, // running, it takes what its shell or its legs meet (slack: how near counts as meeting)
  dig: { down: 0.8, speed: 5.5, under: [1.3, 2.2], tell: 0.55, burst: 0.6, high: 3.0, cost: 3, rest: 1.8, every: 9 }, // coming up, its shell takes what is over it: within its rim and `burst` more, `high` over the bed
  // A body under it is out of the great claw's reach, which cannot turn back under its own shell. It stomps: a leg lifts high and holds there (the tell; the
  // spot it will come down on is marked), then stabs down where the body was. The spike sticks in the bed for `stuck` seconds, and that leg is the one to go
  // for: a ram on it counts double, whether it is open or not. under: how far from its middle, seen from above, a body is under it; high: and how far over the bed.
  stomp: { under: 3.4, high: 3.0, lift: 4.6, tell: 0.8, down: 0.12, spike: 0.45, cost: 2, stuck: 1.7, every: 1.6 }, // lift: how high the foot is held over the bed; spike: the spiked tip's reach round its point, as it is drawn
  // A body that lingers under it: it heaves itself up (the tell: up on its toes, shuddering, silt raining from its belly) and drops its whole weight. Then it lies
  // on its belly for `down` seconds, every leg splayed and open. linger: seconds under it before it does; forget: how fast that is forgotten out from under it.
  belly: { linger: 3.0, forget: 1.0, tell: 0.9, cost: 3, down: 1.8, every: 6 },
  // stagger, torn, wrapped: how long each leaves it reeling. A leg it has its weight on is armoured: a ram rings off it unless it is open. A leg caught lifted,
  // mid-step or raised to stomp, is knocked away (`knock` metres) and it stumbles for `stumble` seconds: that is an opening, and the leg is cracked by it.
  leg: { reach: 0.5, numb: 4.5, stagger: 1.1, torn: 1.7, wrapped: 3.2, room: 0.45, stumble: 1.4, knock: 1.6, lifted: 0.5, stuck: 2 }, // reach: how near the tip of the snout must come to a leg as drawn, from its skin; lifted: how far off the bed a foot is to count as lifted; stuck: what a ram on a foot stuck from a stomp counts for
  // A body wound round any leg holds it (`guard.ring`): swum away, it drags the foot after it (the hauling the fish already does, with a leg for a load).
  // Dragged `topple` metres out from under it, it goes over: down for `down` seconds, and the leg goes numb (off, if it was numb). Held `shed` seconds and not
  // toppled, it sheds the leg itself, as real crabs do (autotomy, at a breaking plane near the body), and is free; that counts as a leg gone.
  haul: { topple: 2.4, shed: 2.2, down: 2.4, pull: 3.5 }, // pull: how fast a held foot follows the part of the body wound round it, metres a second
  // A leg that has come off lies where it fell. It is bait: within `bait` metres it draws the Keeper to eat it (open while it does), and the fish can eat it too,
  // its snout over it: `food` fish, a little length back (a segment costs five to seventeen; see LENGTH in main.js).
  shed: { food: 3, reach: 1.3, high: 2.4, bait: 8 }, // reach: how near along the leg as it lies, seen from above, its snout must come; high: and no higher over the bed than this (a fish keeps 1.5 m off it)
  // Which legs are gone matters. With `claw` of the four on its great claw's side gone it lists to that side and its great claw is `slow` times slower to
  // come down; with `rear` of its four hind legs gone it cannot run or dig; and it turns `turn` slower toward a side for each leg more that side has lost.
  lame: { claw: 2, list: 0.13, slow: 1.35, rear: 2, turn: 0.22 },
  // The wave (from the fiddler crab: a male's claw wave speeds up as a rival comes nearer, and they wrestle only if the bluff fails). The great claw waves
  // at a fish that comes within `far`: slowly (`slow` waves a second) far off, `quick` at `near`; and in the last `warn` seconds before it commits to a blow, `frantic`.
  // bluff: when a fish first comes near it waves this long before its first blow.
  wave: { far: 18, near: 6, slow: 0.35, quick: 1.3, frantic: 3.2, warn: 0.6, bluff: 1.5 },
  view: 7, // how many metres further back the dive's camera stands while a fish is near it (main.js): it is eleven metres across, and the plain view was made for a fish
  bait: { reach: 8, walk: 3.4, feed: 3.4, near: 2.7, most: 6 }, // near: how close it must get to eat; most: how long it will try to get to one. A tail lying where it cannot get that close (past its leash, or out over the rift) it leaves, and does not go for again
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
  const rift = world.rift, T = world.size; // T: how far across this world is (the first band is wider than the others)
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
  const HOME = { keeper: [8.6, 3.6], shearer: [11, 2.6], lamplighter: [0, 3.4], warden: [4.2, 1.6] }[kind]; // distance from the middle of where it lives, height over the shelf
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
  if (kind === 'keeper') Object.assign(S, { leg: new Array(8).fill(0), legT: new Array(8).fill(0), lost: 0, open: false, sink: 0, jabT: 0, chargeT: 4, digT: 0, stompT: 0, bellyT: 0, under: 0, once: false, dir: 0, last: '', jabbed: 0, wrapLeg: -1, puffT: 0, pending: '', stomp: null, held: null, knocked: null, wave: { hz: 0.35, up: 0 }, list: 0, met: false }); // leg: 0 sound, 1 numb, 2 gone
  if (kind === 'shearer') Object.assign(S, { lost: 0, snapped: false, chain: 0, swipeT: 3, baited: false, slid: 0, locked: false, cut: 0, puffT: 0, hit2: 0 });
  // the Shearer's line: where it means to go, laid on the water while it winds up
  const line = kind === 'shearer' ? new THREE.Mesh(keep(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), keep(new THREE.MeshBasicMaterial({ color: '#ffc2cf', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }))) : null;
  if (line) { line.rotation.order = 'YXZ'; line.frustumCulled = false; root.add(line); }
  const tailWas = new THREE.Vector3(), tailV = new THREE.Vector3(), sawP = new THREE.Vector3();
  const mark = kind === 'keeper' || kind === 'shearer' ? sprite('#ffe2a8', 1) : null, fallen = [], limbs = [], hip = new THREE.Vector3(), near = new THREE.Vector3(); // mark: where a blow that is on its way will land
  const vulnerable = () => !S.done && (kind === 'warden' || S.state === 'tired' || S.state === 'dim');
  const wrappable = () => !S.done && !(kind === 'shearer' && S.snapped) && (S.state === 'tired' || S.state === 'dim' || S.state === 'feed' || S.stun > 0);
  // a dash that reaches it
  // The Keeper's legs. Which one a point is at (the leg from a quarter of the way down it to the foot: nearer the hip than that is shell), and what a blow does to one.
  // (Seen from above, as the dive is: a leg arches up from the shell and down to its foot, and a fish that cannot get lower than a metre and a half off the bed still reaches it.)
  // The Keeper's legs, as they are drawn (crab.js `solids`: a capsule for each length). Which one the tip of a snout is at, if any; and whether it is at the shell.
  let SOL = [];
  const solidsNow = () => (SOL = rig.solids());
  function legAt(snout, reach) { let best = -1, least = reach; for (const s of SOL) { if (s.leg < 0 || S.leg[s.leg] === 2) continue; const d = gap(s, snout, snout, FISH.head); if (d < least) { least = d; best = s.leg; } } return best; }
  const atShell = (snout, reach) => SOL.length && SOL[0].t === 'ell' && gap(SOL[0], snout, snout, FISH.head) < reach;
  // A leg: 0 whole, 3 cracked, 1 numb, 2 gone. Each blow on it moves it on one: whole to cracked, cracked to numb, numb to off.
  const LEGS = rig && rig.walker ? rig.walker.legs : [];
  function letGo(i) { if (S.stomp && S.stomp.leg === i) S.stomp = null; if (S.held && S.held.leg === i) S.held = null; if (LEGS[i]) LEGS[i].ctrl = null; }
  function crack(i, stun = F.leg.stagger) { S.leg[i] = 3; LEGS[i].cracked = true; S.hits++; S.flash = 1; S.stun = Math.max(S.stun, stun); set('rest', S.stun); game.event('hit', pos); game.event('crack', LEGS[i].foot); }
  function numb(i) { S.leg[i] = 1; S.legT[i] = F.leg.numb; LEGS[i].cracked = true; S.hits++; S.flash = 1; S.stun = Math.max(S.stun, F.leg.stagger); set('rest', S.stun); game.event('hit', pos); game.event('numb', LEGS[i].foot); }
  function tear(i, how) { const foot = LEGS[i].foot.clone(), wrapped = how === true || how === 'wrapped', self = how === 'shed'; letGo(i);
    S.leg[i] = 2; S.lost++; S.hp = HP - S.lost; S.hits++; S.flash = 1; S.stun = self ? 0.5 : wrapped ? F.leg.wrapped : F.leg.torn; set('rest', S.stun); vel.set(0, 0, 0);
    mesh.updateMatrixWorld(true); const parts = rig.shed(i); for (const m of parts) { root.attach(m); fallen.push(m); } // the leg lies where it came off
    limbs.push({ parts, pos: foot.clone(), bait: { kind: 'leg', pos: foot.clone(), life: 1, dead: false }, eaten: false, self }); // and is food, and bait
    game.event('hit', pos); game.event(self ? 'shed' : 'tear', foot);
    if (S.lost >= HP) fall(); else if (S.lost === F.rage) { S.digT = 0; game.event('rage', pos); } }
  const harm = (i) => { if (S.leg[i] === 0) crack(i); else if (S.leg[i] === 3) numb(i); else if (S.leg[i] === 1) tear(i, false); };
  const lifted = (i) => { const l = LEGS[i]; return !l.gone && (l.t >= 0 || (!!l.ctrl && l.foot.y - world.height(l.foot.x, l.foot.z) > F.leg.lifted)); };
  const stuckFoot = (i) => !!S.stomp && S.stomp.leg === i && S.stomp.stuck > 0;
  function ramKeeper(snout, power) {
    if (S.done || S.sink > 0.5) return null;
    const i = legAt(snout, F.leg.reach);
    if (i < 0 && !atShell(snout, F.leg.reach)) return null;
    if (S.stun > 0.3 && S.flash > 0.2) return null; // one ram, one blow
    if (i >= 0 && !S.open && stuckFoot(i)) power *= F.leg.stuck; // the leg it stomped with, its spike stuck in the bed: the one to go for, open or not
    else if (i >= 0 && !S.open && lifted(i)) { // a leg caught off the ground: knocked away, and it stumbles
      const l = LEGS[i]; v.subVectors(l.foot, pos).setY(0).normalize(); letGo(i); l.ctrl = l.foot.clone().addScaledVector(v, F.leg.knock); l.ctrl.y = world.height(l.ctrl.x, l.ctrl.z); l.ctrlRate = 9; S.knocked = { leg: i, t: 0.45 };
      if (S.leg[i] === 0 || S.leg[i] === 3) { if (S.leg[i] === 0) crack(i, F.leg.stumble); else numb(i); } else tear(i, false); S.stun = Math.max(S.stun, F.leg.stumble); set('rest', S.stun); game.event('knock', l.foot); return { kind: 'guard', pos: pos.clone(), food: 0 }; }
    if (i < 0 || (!S.open && !stuckFoot(i))) { // the shell, or a leg it has its weight on: armoured
      if (power > 1 && !S.open) { S.stun = 2; S.flash = 1; set('rest', 2); game.event('hit', pos); return { kind: 'guard', pos: pos.clone(), food: 0 }; } // a full crest breaks its guard: it reels, and is open
      S.flash = 0.5; game.event('clang', i >= 0 ? LEGS[i].foot : pos); game.event('turned', pos); return { kind: 'guard', pos: pos.clone(), food: 0, bounced: true }; }
    if (stuckFoot(i)) S.stomp.stuck = 0.01;
    for (let b = 0; b < power && !S.done && S.leg[i] !== 2; b++) harm(i);
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
  const spurned = new WeakSet(); // shed tails the Keeper has given up on: it cannot get to them from its ground
  const baitNear = (ctx, reach) => ctx.pieces.find((p) => p.kind === 'decoy' && !p.dead && p.life > 0.8 && !spurned.has(p) && p.pos.distanceTo(pos) < reach)
    || (limbs.find((b) => !b.eaten && b.bait.life > 0.8 && !spurned.has(b.bait) && b.pos.distanceTo(pos) < Math.min(reach, F.shed.bait)) || {}).bait || null; // a shed tail, or a leg of its own lying on the bed
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
  const struckAt = (ctx, test) => { const J = ctx.joints; for (let j = J.length - 1; j >= 0; j--) if (test(J[j])) return j; return -1; }; // whatever part of the body is in a blow's way: the part nearest the tail (the Shearer's swipe)
  // the fish's body as the Keeper's blows meet it: a capsule for each length, as wide as the body is there (shapes.js), refreshed each frame
  let BODY = []; const hitBy = (shape, slack = 0) => takes(shape, BODY, slack);
  const blow = { t: 'cap', a: new THREE.Vector3(), b: new THREE.Vector3(), r: 0, role: 'blow' }, slamAt = { t: 'prism', a: new THREE.Vector3(), b: new THREE.Vector3(), r: 0, y0: 0, h: 0, role: 'blow' }, shock = { t: 'prism', a: new THREE.Vector3(), b: new THREE.Vector3(), r: 0, y0: 0, h: 0, role: 'blow' }, burst = { t: 'prism', a: new THREE.Vector3(), b: new THREE.Vector3(), r: 0, y0: 0, h: 0, role: 'blow' };
  // the great claw coming down at `at` (on the bed): where its hand and fingers will be, stood up from the bed to `high`, and the jolt where the fingers hit
  // (before the blow, `at` is where it is aimed, and the crab will take a step toward it first if it is far: the shape is worked out for where it will stand)
  const stepTo = (at, out) => { out.set(at.x - pos.x, 0, at.z - pos.z); const far = out.length(); return out.multiplyScalar(far > F.slam.step ? Math.min(far - F.slam.step, 1.4) / far : 0); }, STEP = new THREE.Vector3(), AT2 = new THREE.Vector3();
  const slamShape = (at, now) => { if (now) rig.strike(true, at, 0.6, blow); else { stepTo(at, STEP); rig.landing(true, AT2.copy(at).sub(STEP), 0.6, blow); blow.a.add(STEP); blow.b.add(STEP); } const bed = world.height(at.x, at.z); slamAt.a.copy(blow.a); slamAt.b.copy(blow.b); slamAt.r = blow.r; slamAt.y0 = bed - 0.5; slamAt.h = F.slam.high + 0.5;
    shock.a.copy(blow.b); shock.b.copy(blow.b); shock.r = F.slam.shock; shock.y0 = world.height(blow.b.x, blow.b.z) - 0.5; shock.h = F.slam.shockHigh + 0.5; return slamAt; };
  const burstShape = () => { const bed = world.height(pos.x, pos.z); burst.a.copy(pos); burst.b.copy(pos); burst.r = (SOL[0] && SOL[0].rx || rig.SHELL.r[0]) + F.dig.burst; burst.y0 = bed - 0.5; burst.h = F.dig.high + 0.5; return burst; };
  // The stomp, and the drop of its weight: their shapes. The spike comes straight down, so it takes what is under its point, from the bed to as high as it was held;
  // its belly comes down over the whole of its shell.
  const stompAt = { t: 'prism', a: new THREE.Vector3(), b: new THREE.Vector3(), r: 0, y0: 0, h: 0, role: 'blow' }, dropAt = { t: 'prism', a: new THREE.Vector3(), b: new THREE.Vector3(), r: 0, y0: 0, h: 0, role: 'blow' };
  const stompShape = () => { const at = S.stomp ? S.stomp.at : pos; stompAt.a.copy(at); stompAt.b.copy(at); stompAt.r = F.stomp.spike; stompAt.y0 = at.y - 0.5; stompAt.h = F.stomp.lift + 0.5; return stompAt; };
  const dropShape = () => { const bed = world.height(pos.x, pos.z); dropAt.a.copy(pos); dropAt.b.copy(pos); dropAt.r = (SOL[0] && SOL[0].rx || 2) + 0.3; dropAt.y0 = bed - 0.5; dropAt.h = F.stomp.high + 0.5; return dropAt; };
  function stomp(at, q) { // the leg whose foot stands nearest under where the body is lifts, high, and holds there
    let li = -1, least = 1e9; LEGS.forEach((l, i) => { if (S.leg[i] === 2 || S.leg[i] === 1 || (S.held && S.held.leg === i)) return; const d = Math.hypot(l.foot.x - at.x, l.foot.z - at.z); if (d < least) { least = d; li = i; } });
    if (li < 0) return; const bed = world.height(at.x, at.z), l = LEGS[li];
    S.stomp = { leg: li, at: new THREE.Vector3(at.x, bed, at.z), stuck: 0 }; l.ctrl = new THREE.Vector3(at.x, bed + F.stomp.lift, at.z); l.ctrlRate = 7;
    S.last = 'stomp'; S.stompT = F.stomp.every; set('stomp', F.stomp.tell * q); game.event('lift', l.foot); }
  const rain = () => { if (!world.puff) return; for (let i = 0; i < 2; i++) { const a = rand() * 6.28, r = rand() * 1.8; world.puff(pos.x + Math.sin(a) * r, pos.y - 0.6, pos.z + Math.cos(a) * r, 0, -1.6, 0, 0.3 + rand() * 0.3, 1.2); } }; // silt falling from its belly
  // Every frame, for its legs: a stomped foot's time stuck, a knocked foot let go, a held leg dragged (and toppled, or shed), a leg on the bed eaten,
  // and how long a body has been lying under it.
  function legsAt(dt, ctx) {
    S.stompT -= dt; S.bellyT -= dt;
    if (S.stomp && S.stomp.stuck > 0 && (S.stomp.stuck -= dt) <= 0) { letGo(S.stomp.leg); }
    if (S.knocked && (S.knocked.t -= dt) <= 0) { if (LEGS[S.knocked.leg]) LEGS[S.knocked.leg].ctrl = null; S.knocked = null; }
    if (S.held) { const h = S.held, l = LEGS[h.leg]; h.t += dt; if (!l.ctrl) l.ctrl = l.foot.clone();
      if (h.j === undefined) { let least = 1e9; for (const sh of SOL) if (sh.leg === h.leg) for (const c of BODY) { const d = gap(sh, c.a, c.b, c.r); if (d < least) { least = d; h.j = c.j; } } } // the part of the body wound round it, which has it from now on
      const to = (BODY.find((c) => c.j === h.j) || BODY[BODY.length >> 1] || {}).b;
      if (to) { v.set(to.x - l.ctrl.x, 0, to.z - l.ctrl.z); const d = v.length(); if (d > 0.6) l.ctrl.addScaledVector(v, Math.min(d - 0.6, F.haul.pull * dt) / d); l.ctrl.y = world.height(l.ctrl.x, l.ctrl.z); l.ctrlRate = 20; }
      const sc = mesh.scale.x, rx = l.rest.x * sc, rz = l.rest.z * sc, hx = pos.x + rx * Math.cos(yaw) + rz * Math.sin(yaw), hz = pos.z - rx * Math.sin(yaw) + rz * Math.cos(yaw); h.out = Math.hypot(l.ctrl.x - hx, l.ctrl.z - hz); // how far the foot is from where it would stand
      if (h.out > F.haul.topple) { const i = h.leg; letGo(i); if (S.leg[i] === 1) tear(i, 'wrapped'); else numb(i); S.stun = Math.max(S.stun, F.haul.down); set('rest', S.stun); game.event('topple', pos); } // dragged out from under it: over it goes
      else if (h.t > F.haul.shed) { tear(h.leg, 'shed'); } // held too long: it lets the leg go, at the breaking plane by its body
    }
    for (const b of limbs) { if (b.eaten) continue; v.set(0, 0, 0); for (const m of b.parts) v.add(m.position); v.multiplyScalar(1 / b.parts.length); b.pos.copy(v); b.bait.pos.copy(v);
      if (b.bait.life < 0.4) { b.eaten = true; b.bait.dead = true; for (const m of b.parts) m.visible = false; continue; } // the Keeper has eaten it
      const sn = ctx.rig && ctx.rig.snout; let near = 1e9; if (sn) for (const m of b.parts) near = Math.min(near, Math.hypot(sn.x - m.position.x, sn.z - m.position.z), Math.hypot(sn.x - (m.position.x + v.x) / 2, sn.z - (m.position.z + v.z) / 2)); // along the leg as it lies, seen from above
      if (ctx.playing && sn && near < F.shed.reach && sn.y - world.height(sn.x, sn.z) < F.shed.high) { b.eaten = true; b.bait.dead = true; for (const m of b.parts) m.visible = false; game.fed?.(v.clone(), F.shed.food); game.event('ate', v); } } // the fish has
    let under = 0; if (S.sink < 0.5 && ctx.playing) for (const c of BODY) { const m = v2.copy(c.a).lerp(c.b, 0.5); if (Math.hypot(m.x - pos.x, m.z - pos.z) < F.stomp.under && m.y - world.height(m.x, m.z) < F.stomp.high) under++; }
    S.under = under >= 2 ? S.under + dt : Math.max(0, S.under - F.belly.forget * dt);
  }
  const silt = (at, n, push = 1.6) => { if (world.puff) for (let i = 0; i < n; i++) { const a = rand() * 6.28, r = 0.3 + rand() * 0.9; world.puff(at.x + Math.sin(a) * r, world.height(at.x, at.z) + 0.15, at.z + Math.cos(a) * r, Math.sin(a) * push, 0.5 + rand() * 0.9, Math.cos(a) * push, 0.3 + rand() * 0.35, 1 + rand()); } };
  const lineTo = (to, locked) => { v2.subVectors(to, pos); const d = v2.length() || 1, far = d + 5; v2.multiplyScalar(1 / d); // from the Shearer, through where it is aimed, and on
    line.visible = true; line.material.opacity = locked ? 0.75 : 0.32; line.scale.set(locked ? 0.5 : 0.3, 1, far);
    line.rotation.set(-Math.asin(clamp(v2.y, -1, 1)), Math.atan2(v2.x, v2.z), 0); line.position.copy(pos).addScaledVector(v2, far / 2); line.position.y -= 0.25; };
  // The Keeper's marks on the bed are the true footprint of what is coming: a flat stadium (a capsule seen from above) for each shape it is handed, lit, with its rim brighter
  const bedMarks = [], markMat = kind === 'keeper' ? keep(new THREE.MeshBasicMaterial({ color: '#ffe2a8', transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })) : null,
    rimMat = kind === 'keeper' ? keep(new THREE.LineBasicMaterial({ color: '#fff1cf', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })) : null;
  function markCaps(...shapes) { shapes.forEach((sh, i) => { let m = bedMarks[i]; if (!m) { m = { fill: new THREE.Mesh(new THREE.BufferGeometry(), markMat), rim: new THREE.LineLoop(new THREE.BufferGeometry(), rimMat), key: '' }; m.fill.renderOrder = m.rim.renderOrder = 3; root.add(m.fill, m.rim); bedMarks.push(m); trash.push(m.fill.geometry, m.rim.geometry); }
      const L = Math.hypot(sh.b.x - sh.a.x, sh.b.z - sh.a.z), key = `${L.toFixed(2)} ${sh.r.toFixed(2)}`;
      if (key !== m.key) { m.key = key; const pts = []; for (let k = 0; k <= 12; k++) { const a = Math.PI / 2 + (k / 12) * Math.PI; pts.push(new THREE.Vector2(Math.cos(a) * sh.r, Math.sin(a) * sh.r)); } for (let k = 0; k <= 12; k++) { const a = -Math.PI / 2 + (k / 12) * Math.PI; pts.push(new THREE.Vector2(L + Math.cos(a) * sh.r, Math.sin(a) * sh.r)); }
        m.fill.geometry.dispose(); m.fill.geometry = new THREE.ShapeGeometry(new THREE.Shape(pts)).rotateX(Math.PI / 2); m.rim.geometry.dispose(); m.rim.geometry = new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(p.x, 0, p.y))); }
      const y = Math.max(world.height(sh.a.x, sh.a.z), world.height(sh.b.x, sh.b.z), world.height((sh.a.x + sh.b.x) / 2, (sh.a.z + sh.b.z) / 2)) + 0.12, ang = Math.atan2(sh.b.x - sh.a.x, sh.b.z - sh.a.z) - Math.PI / 2;
      for (const o of [m.fill, m.rim]) { o.visible = true; o.position.set(sh.a.x, y, sh.a.z); o.rotation.set(0, L > 1e-3 ? ang : 0, 0); } }); }
  const markAt = (at, size) => { mark.visible = true; mark.position.set(at.x, world.height(at.x, at.z) + 0.25, at.z); mark.scale.setScalar(size); };
  const watch = { p: new THREE.Vector3(), t: 0, lift: 0, side: 0, dodge: 0 }, UP = new THREE.Vector3(0, 1, 0); // the last resort: if it is getting nowhere, the Shearer rises until it is, and the Keeper turns aside

  function update(dt, ctx) {
    W.set(well.x + T * Math.round((ctx.focus.x - well.x) / T), Y0, well.z + T * Math.round((ctx.focus.z - well.z) / T)); // where it lives, on the nearest copy of the world
    pos.x += T * Math.round((ctx.focus.x - pos.x) / T); pos.z += T * Math.round((ctx.focus.z - pos.z) / T);
    for (const s of slabs) { s.p.x += T * Math.round((ctx.focus.x - s.p.x) / T); s.p.z += T * Math.round((ctx.focus.z - s.p.z) / T); }
    if (kind === 'keeper' && ctx.rig) BODY = fishBody(ctx.rig, BODY); // the fish's body as the Keeper's blows meet it, this frame
    fadeStrikes(dt); S.t -= dt; S.cool -= dt; S.flash = Math.max(0, S.flash - dt * 2.5); S.danger = 0;
    const fish = ctx.pos, far = Math.hypot(fish.x - W.x, fish.z - W.z), awake = ctx.playing && far < 26;
    let warnSize = 0;
    if (mark) mark.visible = false;
    for (const m of bedMarks) m.fill.visible = m.rim.visible = false;
    if (line) line.visible = false;
    if (kind === 'keeper') for (let i = 0; i < 8; i++) if (S.leg[i] === 1 && !(S.wrapLeg === i && target.progress > 0.15) && (S.legT[i] -= dt) <= 0) S.leg[i] = 3; // a numb leg comes back, cracked still, unless a body is going round it
    if (kind === 'keeper') { S.near = ctx.playing && Math.hypot(ctx.pos.x - pos.x, ctx.pos.z - pos.z) < 26; if (!S.done) legsAt(dt, ctx); }
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
      const gone = (list) => list.filter((i) => S.leg[i] === 2).length, leftGone = gone([0, 1, 2, 3]), rightGone = gone([4, 5, 6, 7]), noRun = gone([2, 3, 6, 7]) >= F.lame.rear, clawSide = rightGone >= F.lame.claw; // (its right is its great claw's side, legs 4 to 7)
      const lameTurn = Math.max(0.4, 1 - F.lame.turn * Math.max(0, off > 0 ? leftGone - rightGone : rightGone - leftGone)); // it turns worse toward its lame side
      S.list = clawSide ? F.lame.list * rightGone : leftGone >= F.lame.claw ? -F.lame.list * leftGone * 0.7 : 0; // it lists toward the side it has lost most of (more on the great claw's side, which is the heavier)
      // the wave: the nearer the body, the quicker; frantic just before it commits to a blow (KEEPER_FIGHT.wave)
      { const c = clamp((F.wave.far - nd) / (F.wave.far - F.wave.near), 0, 1); S.wave.up = awake && nd < F.wave.far ? lerp(0.5, 1, c) : 0; S.wave.hz = S.state === 'stalk' && engaged && S.cool > 0 && S.cool <= F.wave.warn ? F.wave.frantic : lerp(F.wave.slow, F.wave.quick, c); }
      if (S.state === 'stalk' && S.under > F.belly.linger && S.bellyT <= 0 && !S.held) { set('heave', F.belly.tell * q); S.danger = 0.9; game.event('windup', pos); } // a body has lingered under it: it heaves itself up to drop its weight
      if (S.state === 'stalk') { // it turns to the body and closes with it, and picks its blow by where the body lies
        turnTo(dt, bearing, rate * lameTurn); if (nd > F.close) walk(dt, P, speed); else { vel.multiplyScalar(Math.exp(-6 * dt)); move(dt); }
        let below = null, bd = 1e9; for (const c of BODY) { const m = v2.copy(c.a).lerp(c.b, 0.5), d = Math.hypot(m.x - pos.x, m.z - pos.z); if (d < F.stomp.under && m.y - world.height(m.x, m.z) < F.stomp.high && d < bd) { bd = d; below = below || new THREE.Vector3(); below.copy(m); } } // a body under it: out of the great claw's reach
        if (!engaged) set('idle');
        else if (below) { if (S.cool <= 0 && S.stompT <= 0 && !S.held) stomp(below, q); } // under it, the claws cannot get at it: it stomps
        else if (S.cool <= 0) {
          let lying = 0; for (let j = 0; j <= N; j++) { const dx = J[j].x - pos.x, dz = J[j].z - pos.z; if (Math.hypot(dx, dz) < F.sweep.reach && J[j].y < pos.y + F.sweep.low && Math.abs(wrapPi(Math.atan2(dx, dz) - yaw)) < 1.6) lying++; }
          const begin = (what, t) => { S.last = what; S.once = false; aim.copy(P); set(what, t); if (what === 'slam' || what === 'dig') game.event('windup', pos); }; // its biggest blows have a fill to them
          if (nd < F.jab.reach && S.jabT <= 0 && off > -0.4 && off < 2.1) { begin('jab', F.jab.wind * q); S.jabT = F.jab.every; } // near, and on the small claw's side
          else if (nd < F.slam.reach && Math.abs(off) < 0.85) { if (lying >= F.sweep.bodies && S.last !== 'sweep') { begin('sweep', F.sweep.wind * q); S.dir = yaw; } else begin('slam', F.slam.wind * q * (clawSide ? F.lame.slow : 1)); } // (with its great claw's side lame, slower to come down)
          else if (nd > F.charge.from && nd < F.charge.to && S.chargeT <= 0 && !noRun) { // (with its hind legs gone it can neither run nor dig)
            if (raging && S.digT <= 0) { begin('dig', F.dig.down); S.digT = F.dig.every; S.chargeT = 3; }
            else { begin('charge', F.charge.tell * q); S.side = off >= 0 ? 1 : -1; S.chargeT = F.charge.every * q; } }
        }
      }
      else if (S.state === 'slam') { // the great claw goes up. For the first part of that it still follows the body; then it is aimed, and the mark shows where
        warnSize = 2.6; S.danger = 0.8;
        if (k < F.slam.aim) { aim.copy(P); turnTo(dt, bearing, 5); }
        v.subVectors(aim, pos).setY(0); const d = v.length(); if (d > F.slam.reach) aim.set(pos.x + v.x * F.slam.reach / d, 0, pos.z + v.z * F.slam.reach / d);
        aim.y = world.height(aim.x, aim.z); vel.multiplyScalar(Math.exp(-6 * dt)); move(dt);
        if (k >= F.slam.aim) { slamShape(aim, false); markCaps(slamAt, shock); } // the mark is the claw's own footprint, and the jolt where its fingers will hit
        if (S.t <= 0) { // down it comes, with a step forward if it needs one
          pos.add(stepTo(aim, STEP)); hold();
          S.pending = 'slam'; set('stuck', F.slam.stuck * (raging ? 0.85 : 1)); vel.set(0, 0, 0); // what it takes is judged once the crab is drawn where it now stands (the end of update)
        }
      }
      else if (S.state === 'stuck') { if (S.t <= 0) { set('stalk'); S.cool = Math.max(F.wave.warn, 0.6 * q); } } // the claw is in the bed, and it hauls on it
      else if (S.state === 'stomp') { // a leg up high, held there, over where the body was: the tell
        warnSize = 2; S.danger = 0.8; vel.multiplyScalar(Math.exp(-6 * dt)); move(dt); markCaps(stompShape());
        if (!S.stomp) set('stalk'); else if (S.t <= 0) { const l = LEGS[S.stomp.leg]; l.ctrl.set(S.stomp.at.x, S.stomp.at.y, S.stomp.at.z); l.ctrlRate = 60; set('stomped', F.stomp.down); }
      }
      else if (S.state === 'stomped') { S.danger = 1; if (S.t <= 0) { S.pending = 'stomp'; set('pinned', F.stomp.stuck); } } // down it comes (judged once it is drawn there)
      else if (S.state === 'pinned') { vel.set(0, 0, 0); if (!S.stomp || S.stomp.stuck <= 0 || S.t <= 0) { if (S.stomp) letGo(S.stomp.leg); S.stomp = null; set('stalk'); S.cool = Math.max(F.wave.warn, 0.3 * q); } } // its spike is in the bed: it hauls on it, and that leg is the one to go for
      else if (S.state === 'heave') { // up on its toes, shuddering, silt raining from its belly: it is about to drop its weight
        S.danger = 0.9; warnSize = 3.4; vel.multiplyScalar(Math.exp(-6 * dt)); move(dt); markCaps(dropShape()); if ((S.puffT -= dt) <= 0) { S.puffT = 0.06; rain(); }
        if (S.t <= 0) set('drop', 0.14); }
      else if (S.state === 'drop') { S.danger = 1; if (S.t <= 0) { S.pending = 'drop'; set('grounded', F.belly.down); } }
      else if (S.state === 'grounded') { vel.set(0, 0, 0); if (S.t <= 0) { set('stalk'); S.cool = Math.max(F.wave.warn, 0.5 * q); } } // on its belly, every leg splayed: open
      else if (S.state === 'sweep') { warnSize = 3.2; S.danger = 0.8; vel.multiplyScalar(Math.exp(-6 * dt)); move(dt); if (S.t <= 0) { set('sweeping', F.sweep.time); S.once = false; } } // drawn back, wide and low: it does not turn again
      else if (S.state === 'sweeping') { // across its front from its right to its left, under anything that has risen over its back
        S.danger = 1; const swept = lerp(-1.8, 1.8, k) + 0.3;
        if (S.t <= 0) set('rest', F.sweep.rest * q); // (what it takes is judged after the claw is drawn this frame: see the end of update)
      }
      else if (S.state === 'jab') { // the small claw, cocked: quick, and it does not take much
        warnSize = 1.5; S.danger = 0.5; if (k < 0.5 && nd < F.jab.reach + 0.5) aim.copy(P); turnTo(dt, bearing, 1.5); vel.multiplyScalar(Math.exp(-6 * dt)); move(dt);
        if (S.t <= 0) { S.pending = 'jab'; S.jabbed = 0.2; set('rest', F.jab.rest * q); } // the small claw goes out: judged where it is drawn as it gets there (the end of update)
      }
      else if (S.state === 'charge') { // it turns side on to the body and draws itself in: crabs run sideways
        warnSize = 3; S.danger = 0.7; turnTo(dt, bearing - S.side * Math.PI / 2, 6); aim.copy(P); vel.multiplyScalar(Math.exp(-6 * dt)); move(dt);
        if (S.t <= 0) { vel.subVectors(aim, pos).setY(0).setLength(F.charge.speed); set('run', F.charge.run); S.once = false; }
      }
      else if (S.state === 'run') { // and runs, through where the body was. What stands stops it, and so does the end of its ground
        S.danger = 1; const went = move(dt);
        if (went < F.charge.speed * dt * 0.45) { vel.set(0, 0, 0); game.event('clang', pos); set('rest', F.charge.rest * 1.5); }
        else if (S.t <= 0) set('rest', F.charge.rest * q);
      }
      else if (S.state === 'rest') { vel.multiplyScalar(Math.exp(-5 * dt)); move(dt); if (S.t <= 0) { set('stalk'); S.cool = Math.max(F.wave.warn, 0.35 * q); } } // it has struck, and gets its breath: open
      else if (S.state === 'fetch') { // to the bait, by the shortest way
        if (!bait || bait.dead || bait.life < 0.4) { bait = null; set('stalk'); }
        else if (Math.hypot(bait.pos.x - W.x, bait.pos.z - W.z) > F.leash + F.bait.near || rift.in(bait.pos.x, bait.pos.z) + F.edge > F.bait.near || S.t < -F.bait.most) { spurned.add(bait); bait = null; set('stalk'); } // out of its ground, or it has been at it too long: it gives up, and that one it will not go for again
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
        S.sink = 1; warnSize = 3.2; S.danger = 0.9; markCaps(burstShape()); if ((S.puffT -= dt) <= 0) { S.puffT = 0.05; silt(pos, 2, 2.6); }
        if (S.t <= 0) { world.steer(pos, 1.2); hold(); struckShow(burstShape()); const j = hitBy(burst); if (j >= 0 && game.bite(F.dig.cost, j, pos)) S.bites++; // its shell, coming up
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
        if (engaged && S.cool <= 0) { set('stalk'); if (!S.met) { S.met = true; S.cool = F.wave.bluff; } } // the first time a fish comes near, it waves at it a while before it fights: the bluff
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
      S.open = !S.done && S.sink < 0.5 && (S.stun > 0 || st === 'stuck' || st === 'rest' || st === 'feed' || st === 'grounded'); // open: a leg can be hurt
      const id = S.done || S.stun > 0 ? '' : st === 'slam' || st === 'sweep' || st === 'sweeping' || st === 'jab' || st === 'stuck' || st === 'feed' ? st : st === 'run' ? 'charge' : st === 'rest' ? (S.jabbed > 0 ? 'jabbed' : 'spent') : '';
      rig.walker.legs.forEach((l, i) => { l.lame = S.leg[i] === 1; l.cracked = S.leg[i] === 3 || S.leg[i] === 1; });
      rig.update(dt, { x: pos.x, z: pos.z, yaw, vx: (pos.x - was.x) * kk, vz: (pos.z - was.z) * kk, ground: world.footing, floor: S.sink > 0.05 ? undefined : world.footing(v.set(pos.x, 0, pos.z)).y, time: ctx.time,
        wary: awake && !S.done ? clamp(1.3 - close / 11, 0, 1) : 0, look: fish, act: id ? { id, k, at: st === 'feed' && bait ? bait.pos : aim } : null,
        tuck: !S.done && st === 'charge', stun: S.stun > 0, limp: S.done, sink: S.sink, rage: S.lost >= F.rage, list: S.list, wave: S.wave, heave: st === 'heave' ? 1 : 0, drop: st === 'drop' || st === 'grounded' ? 1 : 0 }); // (rage: only so that it can be seen to rage)
      const clear = pos.y - (rig.walker.body.ground + HOME[1]) - 0.7; if (clear > 0 && !S.done) mesh.position.y += clear; // lifted off the ground, it is drawn where it is
      mesh.updateMatrix(); solidsNow();
      // The blows, judged against the crab as it is now drawn: what lands this frame, and what is sweeping or running through the water
      if (S.pending === 'slam') { slamShape(aim, true); const j = Math.max(hitBy(slamAt), hitBy(shock)); struckShow(slamAt); struckShow(shock); // the claw as it lands, and where its fingers hit the bed
        if (j >= 0) { aim.y = BODY.find((c) => c.j === j).b.y - 0.2; rig.strike(true, aim, 0.6, blow); if (game.bite(F.slam.cost, j, pos)) S.bites++; } // it closes on the body if the body is there; if not, it goes into the bed
        game.event('slam', aim); silt(shock.a, 8); }
      else if (S.pending === 'stomp' && S.stomp) { let spike = null; for (const sh of SOL) if (sh.leg === S.stomp.leg) spike = sh; stompShape(); if (spike) { stompAt.a.copy(spike.b).setY(stompAt.a.y); stompAt.b.copy(spike.b).setY(stompAt.a.y); } // the spike as it is drawn, driven down
        struckShow(stompAt); const j = hitBy(stompAt); if (j >= 0 && game.bite(F.stomp.cost, j, pos)) S.bites++; S.stomp.stuck = F.stomp.stuck; silt(S.stomp.at, 6, 2); game.event('stomp', S.stomp.at); }
      else if (S.pending === 'drop') { dropShape(); struckShow(dropAt); const j = hitBy(dropAt); if (j >= 0 && game.bite(F.belly.cost, j, pos)) S.bites++; silt(pos, 14, 3.2); game.event('slam', pos); S.under = 0; S.bellyT = F.belly.every; }
      else if (S.pending === 'jab') { rig.strike(false, aim, F.jab.short, blow); struckShow(blow); const j = hitBy(blow); if (j >= 0 && game.bite(F.jab.cost, j, pos)) S.bites++; }
      S.pending = '';
      if (st === 'sweeping' && !S.once) { rig.clawNow(true, blow); const j = hitBy(blow); if (j >= 0) { struckShow(blow); if (game.bite(F.sweep.cost, j, pos)) { S.bites++; S.once = true; } } } // the great claw going across, where it is
      if (st === 'run' && !S.once) for (const sh of SOL) { const j = hitBy(sh, F.charge.slack); if (j >= 0) { struckShow({ ...sh, a: sh.a.clone(), b: sh.b.clone(), c: sh.c.clone(), role: 'blow' }); if (game.bite(F.charge.cost, j, pos)) { S.bites++; S.once = true; } break; } } // running: its shell and its legs, as they go
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
      let wi = -1, least = 1e9; if (!S.done && ctx.playing && S.sink < 0.5 && !S.held) for (const sh of SOL) { if (sh.leg < 0 || S.leg[sh.leg] === 2) continue; onLeg(fish, sh.a, sh.b, v2); const d = v2.distanceToSquared(fish); if (d < least) { least = d; wi = sh.leg; } } // any leg it still has: round a numb one, it comes off; round any other, it is held
      if (wi !== S.wrapLeg) target.progress = 0; S.wrapLeg = wi;
      if (wi >= 0) { let least2 = 1e9; for (const sh of SOL) { if (sh.leg !== wi) continue; onLeg(fish, sh.a, sh.b, v2); const d = v2.distanceToSquared(fish); if (d < least2) { least2 = d; target.x = v2.x; target.y = v2.y; target.z = v2.z; } } // round the leg where the body is: the point of it nearest the head
        target.can = canWrap(ctx.total, target.room); S.wrap = target; }
    }
    else if (wrappable() && ctx.playing) { const out = kind === 'shearer' && S.stuck ? 1.9 : 0; target.x = pos.x + Math.sin(yaw) * out; target.y = pos.y; target.z = pos.z + Math.cos(yaw) * out; // (the Shearer's saw, when that is what is stuck)
      target.can = canWrap(ctx.total, target.room); S.wrap = target; } else target.progress = 0;
  }
  // while the keeper lives the veil holds: the ledges can be swum over, but nothing goes down between the walls
  function pushOut(p, radius) {
    if (kind === 'keeper' && SOL.length && S.sink < 0.5 && Math.abs(p.x - pos.x) < 7 && Math.abs(p.z - pos.z) < 7) for (let pass = 0; pass < 2; pass++) for (const sh of SOL) pushFrom(sh, p, FISH.head); // the Keeper is solid: its shell and legs turn the head aside
    if (S.done) return;
    const top = rift.ledgeY + 0.5 + radius;
    if (p.y < top && rift.in(p.x, p.z) > rift.ledge - 0.3) p.y = top;
  }
  // ...and the rest of the body: rig.js hands over the points the body is laid along (the trail it follows, and where each joint wants to be), each with how
  // thick the body is there, and each is turned out of the shell and the legs. The trail is kept, so a body pushed to one side of a leg stays on that side.
  function bend(items, radiusOf) {
    if (kind !== 'keeper' || !SOL.length || S.sink >= 0.5) return;
    for (let i = 0; i < items.length; i++) { const p = items[i].p; if (Math.abs(p.x - pos.x) > 7 || Math.abs(p.z - pos.z) > 7) continue; const r = radiusOf(i); if (r < 0) break; for (const sh of SOL) pushFrom(sh, p, r); }
  }
  function dispose() { for (const m of bedMarks) { m.fill.geometry.dispose(); m.rim.geometry.dispose(); } scene.remove(root); for (const o of trash) o.dispose(); }
  const wrapped = () => { if (kind === 'shearer') { S.snapped = true; target.progress = 0; game.event('snap', pos); return tooth(Z.snap, 2.6); } // the saw goes, and two rows with it
    if (kind !== 'keeper') return fall(); const i = S.wrapLeg; if (i >= 0 && S.leg[i] === 1) tear(i, true); else if (i >= 0 && S.leg[i] !== 2) { letGo(i); S.held = { leg: i, t: 0, out: 0, loose: 0 }; game.event('held', LEGS[i].foot); } target.progress = 0; }; // round the Keeper's numb leg, it comes off; round any of the others, it is held, and can be hauled
  // What the fight believes, as shapes (shapes.js), for the testing tool that draws them over the picture: the fish's body, what is solid of the crab, each
  // leg and whether it can be hurt now, the blow on its way, and for a moment after it lands, what it was judged by (`hot`). The same shapes the fight uses.
  const SHOWN = [], strikes = [];
  const struckShow = (shape) => { strikes.push({ ...shape, a: shape.a.clone(), b: shape.b.clone(), c: shape.c ? shape.c.clone() : undefined, role: 'blow', hot: true, life: 0.45 }); };
  const copy = (sh, role) => ({ ...sh, a: sh.a.clone(), b: sh.b.clone(), c: sh.c ? sh.c.clone() : undefined, role });
  function shapes(ctx) {
    SHOWN.length = 0; if (kind !== 'keeper' || !ctx || !ctx.rig) return SHOWN;
    for (const c of fishBody(ctx.rig)) SHOWN.push(c);
    if (S.done || S.sink >= 0.5) { if (S.state === 'rise') SHOWN.push(copy(burstShape(), 'blow')); for (const st of strikes) SHOWN.push(st); return SHOWN; }
    for (const sh of SOL) { const o = copy(sh, sh.leg >= 0 ? 'leg' : 'solid'); if (sh.leg >= 0) o.live = S.open; SHOWN.push(o); }
    const st = S.state;
    if (st === 'slam') { slamShape(aim, false); SHOWN.push(copy(slamAt, 'blow'), copy(shock, 'blow')); }
    else if (st === 'jab') SHOWN.push(copy(rig.landing(false, aim, F.jab.short, blow), 'blow'));
    else if (st === 'sweep' || st === 'sweeping') SHOWN.push({ ...copy(rig.clawNow(true, blow), 'blow'), hot: st === 'sweeping' });
    else if (st === 'charge' || st === 'run') for (const sh of SOL) SHOWN.push({ ...copy(sh, 'blow'), hot: st === 'run' });
    else if ((st === 'stomp' || st === 'stomped') && S.stomp) SHOWN.push(copy(stompShape(), 'blow'));
    else if (st === 'heave' || st === 'drop') SHOWN.push(copy(dropShape(), 'blow'));
    for (const s2 of strikes) SHOWN.push(s2);
    return SHOWN;
  }
  const fadeStrikes = (dt) => { for (let i = strikes.length - 1; i >= 0; i--) if ((strikes[i].life -= dt) <= 0) strikes.splice(i, 1); };
  return { update, ram, pushOut, bend, dispose, wrapped, shapes, state: S, kind, pos, rig, mesh, get yaw() { return yaw; }, get ring() { return S.wrap; }, get done() { return S.done; }, get view() { return kind === 'keeper' && !S.done && S.near ? F.view : 0; }, debug: { set, fall, hurt, numb, tear, crack, legAt, solids: () => SOL, body: () => BODY, forget: () => { strikes.length = 0; }, limbs: () => limbs, leg: (i) => rig.walker.legs[i].foot, charge(x, y, z) { aim.set(x, y, z); vel.subVectors(aim, pos).setLength(10.5); S.mode = 'slash'; S.stuck = false; S.cut = 0; set('charge', 1.4); }, tooth } }; // (debug.charge: for the checks, a slash at a point)
}
