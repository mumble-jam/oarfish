// The keeper of a rift. Each band's rift is kept by one creature, and the way down stays shut until it has
// been dealt with. The four differ, and each is a place to use one of the fish's tools:
//   band 1  the Keeper       slow, armoured, snaps at a tail that comes near     wrap it, or ram it three times
//   band 2  the Shearer      charges the tail in a straight line, then tires     ram or wrap it while it is tired
//   band 3  the Lamplighter  hangs over the rift and lunges; takes a bait first  ram or wrap it while its lamp is out
//   band 4  the Warden       an eel circling the mouth that tightens on a fish   ram its head, or bait the head out and wrap it
// Any of them can be beaten by rams alone, so a short body is never stuck.

import * as THREE from 'three';
import { T, canWrap } from './world.js';
import { rng, lerp, clamp, damp, glowTexture } from './geo.js';
import { make, paintOf } from './npc.js';

const KINDS = ['keeper', 'shearer', 'lamplighter', 'warden'];
const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));

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
  const HP = { keeper: 3, shearer: 3, lamplighter: 3, warden: 4 }[kind];
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
  const target = { x: 0, y: 0, z: 0, room: { keeper: 0.75, shearer: 0.55, lamplighter: 0.8, warden: 0.6 }[kind], orbit: 1.2, fit: 0.7, can: false, left: 1, threat: 1, progress: 0, arcStart: 0, arcSign: 1, sweep: 1 };
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
    game.event('hit', pos);
    if (S.hp <= 0) fall();
  }
  const vulnerable = () => !S.done && (kind === 'keeper' || kind === 'warden' || S.state === 'tired' || S.state === 'dim' || (kind === 'shearer' && (S.state === 'aim' || S.state === 'charge')));
  const wrappable = () => !S.done && (kind === 'keeper' || S.state === 'tired' || S.state === 'dim' || S.state === 'feed' || S.stun > 0);
  // a dash that reaches it
  function ram(snout, power = 1) { // power: how many blows this one counts for
    if (S.done || snout.distanceTo(pos) > { keeper: 2.1, shearer: 1.5, lamplighter: 1.9, warden: 1.3 }[kind]) return null;
    if (S.stun > 0.3 && S.flash > 0.2) return null; // one ram, one blow
    if (!vulnerable()) { S.stun = 0.4; S.flash = 0.5; game.event('clang', pos); return { kind: 'guard', pos: pos.clone(), food: 0, bounced: true }; } // lit, the Lamplighter shrugs it off
    if (kind === 'warden') S.spin *= -1;
    if (kind === 'shearer') set('tired', 2.2);
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
  const watch = { p: new THREE.Vector3(), t: 0, lift: 0, side: 0, dodge: 0 }, UP = new THREE.Vector3(0, 1, 0); // the last resort: if it is getting nowhere, the Shearer rises until it is, and the Keeper turns aside

  function update(dt, ctx) {
    W.set(well.x + T * Math.round((ctx.focus.x - well.x) / T), Y0, well.z + T * Math.round((ctx.focus.z - well.z) / T)); // where it lives, on the nearest copy of the world
    pos.x += T * Math.round((ctx.focus.x - pos.x) / T); pos.z += T * Math.round((ctx.focus.z - pos.z) / T);
    for (const s of slabs) { s.p.x += T * Math.round((ctx.focus.x - s.p.x) / T); s.p.z += T * Math.round((ctx.focus.z - s.p.z) / T); }
    S.t -= dt; S.cool -= dt; S.flash = Math.max(0, S.flash - dt * 2.5); S.danger = 0;
    const fish = ctx.pos, far = Math.hypot(fish.x - W.x, fish.z - W.z), awake = ctx.playing && far < 26;
    let warnSize = 0;
    if (S.done) { pos.y = Math.max(world.height(pos.x, pos.z) + 0.5, kind === 'shearer' ? world.topNear(pos.x, pos.z, 0.9) + 0.4 : -1e9, pos.y - 1.6 * dt); if (!rig) mesh.rotation.z = damp(mesh.rotation.z, 1.3, 3, dt); }
    else if (S.stun > 0) { S.stun -= dt; vel.multiplyScalar(Math.exp(-4 * dt)); pos.addScaledVector(vel, dt); }
    else if (kind === 'keeper') { // round and round its ground, sideways, as crabs go; a tail within reach gets snapped at
      if (S.state === 'snap') { // it turns on the tail as it winds up
        warnSize = 2.4; S.danger = 0.6; const tail = tailPoint(ctx);
        if (tail) yaw += wrapPi(Math.atan2(tail.x - pos.x, tail.z - pos.z) - yaw) * (1 - Math.exp(-7 * dt));
        if (S.t <= 0) { const j = tailNear(ctx, 2.4); if (j >= 0 && game.bite(2, j, pos)) S.bites++; set('idle'); S.cool = 3; S.struck = 0.3; }
      }
      else if (target.progress > 0.15) vel.multiplyScalar(Math.exp(-6 * dt)); // a body going round it: it pulls into its shell and sits tight
      else {
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
        if (awake && S.cool <= 0 && tailNear(ctx, 2.8) >= 0) set('snap', 0.6);
      }
    } else if (kind === 'shearer') { // it sweeps its saw over the rift and feels a fish that comes near. Then it strikes where the tail was: a slash through it if it is up in the water, a stoop onto it if it lies along the bed
      const J = ctx.joints, tail = J[J.length - 1], floor = (p) => Math.max(world.height(p.x, p.z), rift.ledgeY); // the bed, or over the mouth of the rift the veil it keeps
      if (S.state === 'sense') { // something is there: it slows, and the saw swings round to it
        vel.multiplyScalar(Math.exp(-2.5 * dt)); pos.addScaledVector(vel, dt); struck(); yaw += wrapPi(Math.atan2(fish.x - pos.x, fish.z - pos.z) - yaw) * (1 - Math.exp(-3 * dt));
        if (S.t <= 0) {
          if (!awake || pos.distanceTo(fish) > 24) set('idle');
          else { aim.copy(tail); S.mode = tail.y - floor(tail) < 1.5 ? 'pin' : 'slash'; S.side = rand() < 0.5 ? 1 : -1; set('aim', S.mode === 'pin' ? 1.1 : 0.8); }
        }
      }
      else if (S.state === 'aim') {
        warnSize = 2.8; S.danger = 0.7; yaw += wrapPi(Math.atan2(aim.x - pos.x, aim.z - pos.z) - yaw) * (1 - Math.exp(-9 * dt));
        if (S.mode === 'pin') { // up over the tail and a little short of it, nose down, the point of the saw hanging over it
          v.set(aim.x - pos.x, 0, aim.z - pos.z); const d = v.length() || 1; v.multiplyScalar(Math.max(0, d - 2.4) / d).add(pos).setY(aim.y + 6);
          v.sub(pos); const off = v.length(); vel.lerp(off > 1e-3 ? v.multiplyScalar(Math.min(9, off * 4) / off) : v, 1 - Math.exp(-6 * dt)); pos.addScaledVector(vel, dt); struck();
        } else { vel.multiplyScalar(Math.exp(-5 * dt)); pos.y += clamp(aim.y - pos.y, -8 * dt, 8 * dt); } // level with the tail, from however high it had gone to clear something: the slash goes through it flat
        if (S.t <= 0) { vel.subVectors(aim, pos).setLength(10.5); set('charge', S.mode === 'pin' ? pos.distanceTo(aim) / 10.5 + 0.15 : Math.min(1.5, pos.distanceTo(aim) / 10.5 + 0.35)); }
      }
      else if (S.state === 'charge') {
        S.danger = 1; pos.addScaledVector(vel, dt);
        if (world.inStone(pos, 0.7, 1.6)) { struck(); vel.set(0, 0, 0); S.stuck = false; set('tired', 2.4); game.event('clang', pos); } // it has run onto a column or a rock (not a kerb: it stoops past those): that stops it, and it is spent
        const j = sawNear(ctx, 0.85), hit = S.state === 'charge' && j >= 0 && game.bite(3, j, pos); v.copy(vel).setLength(3.3).add(pos); const down = S.mode === 'pin' && v.y <= floor(v) + 0.1; // v: the point of the saw
        if (hit) S.bites++;
        if (S.state === 'charge' && (S.mode === 'pin' ? down || S.t <= -0.6 : hit || S.t <= 0)) { // a slash stops on what it hits, or runs out; a stoop goes on down until the saw is in the bed
          if (S.mode === 'pin') { vel.set(0, 0, 0); set('tired', 2.6); S.stuck = true; } else set('tired', 2.2);
        }
      }
      else if (S.state === 'tired') { // spent, it coasts and sinks; stuck, it stays where its saw is
        if (!S.stuck) { vel.multiplyScalar(Math.exp(-2.5 * dt)); pos.addScaledVector(vel, dt); const rest = over(0.9) + 0.7, sunk = pos.y - 0.5 * dt; pos.y = Math.max(floor(pos) + 0.8, pos.y >= rest ? Math.max(sunk, rest) : sunk); struck(); } // over something, it sinks no lower than its top; beside it, it is kept out of it
        else pos.y = damp(pos.y, floor(pos) + 1.7, 8, dt); // its tail in the air, its saw in the bed
        if (S.t <= 0) { set('idle'); S.cool = 1.2; }
      }
      else {
        S.ang += dt * 0.3; aim.set(W.x + Math.sin(S.ang) * HOME[0], Y0 + HOME[1] + 0.35 * Math.sin(ctx.time * 0.5), W.z + Math.cos(S.ang) * HOME[0]);
        // on its round, or on its way back to it from wherever a charge left it: over whatever stands in the way, and up to that height before it gets there
        watch.t += dt; if (watch.t > 2) { if (pos.distanceTo(aim) > 4 && Math.hypot(pos.x - watch.p.x, pos.z - watch.p.z) < 0.8) watch.lift = Math.min(12, watch.lift + 4); else watch.lift = Math.max(0, watch.lift - 2); watch.p.copy(pos); watch.t = 0; }
        const clear = over() + 1.2 + watch.lift; aim.y = Math.max(aim.y, clear);
        go(dt, aim, 3.2, 2.5); if (pos.y < clear) pos.y = Math.min(clear, pos.y + 7 * dt);
        struck();
        const stir = dt > 1e-5 ? Math.min(fish.distanceTo(fishWas) / dt, 12) : 0; // it feels the water a fish moves: a still one has to come nearer
        if (awake && S.cool <= 0 && pos.distanceTo(fish) < 12 + 8 * clamp(stir / 9, 0, 1)) set('sense', 0.6);
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
        if (bait) set('windup', 0.7);
        else if (awake && S.cool <= 0) { const j = tailNear(ctx, 5); if (j >= 0) { aim.copy(ctx.joints[j]); set('windup', 0.9); } }
      }
    } else { // the warden: round the mouth, tightening on a fish that swims into its ring; a bait draws the head out
      const inside = Math.hypot(fish.x - W.x, fish.z - W.z) < S.R - 0.3 && Math.abs(fish.y - pos.y) < 2.2;
      if (S.state === 'fetch') { if (!bait || bait.dead) { bait = null; set('idle'); } else if (go(dt, bait.pos, 4.2) < 1) { vel.set(0, 0, 0); set('feed', 3.2); } }
      else if (S.state === 'feed') { if (bait && !bait.dead) bait.life = Math.max(bait.life, 0.5); if (S.t <= 0) { if (bait) bait.life = 0.2; bait = null; set('idle'); S.cool = 1.5; } }
      else {
        if (S.state === 'tighten') { warnSize = 3; S.danger = 1; S.R = Math.max(1.3, S.R - 2.1 * dt); if (S.t <= 0) { if (inside && game.bite(3, 1, pos)) S.bites++; set('loose', 1.6); } }
        else { S.R = Math.min(4.2, S.R + 2.4 * dt); if (S.state === 'loose' && S.t <= 0) set('idle'); bait = S.cool <= 0 && S.state === 'idle' ? baitNear(ctx, 10) : null; if (bait) set('fetch'); else if (awake && S.state === 'idle' && inside && S.R > 4) set('tighten', 1.4); }
        if (S.state !== 'fetch') { S.ang += S.spin * dt * (3.2 / Math.max(S.R, 1.3)); aim.set(W.x + Math.sin(S.ang) * S.R, Y0 + HOME[1], W.z + Math.cos(S.ang) * S.R); const d = go(dt, aim, 3.6 + 2.5 * clamp(pos.distanceTo(aim) - 1, 0, 3), 6); if (d > 6) S.ang = Math.atan2(pos.x - W.x, pos.z - W.z); }
      }
      let lead = pos; // the body follows the head, each slab a fixed distance behind the one before
      for (const s of slabs) { v.subVectors(s.p, lead); const d = v.length() || 1; s.p.copy(lead).addScaledVector(v, 0.95 / d); s.m.position.copy(s.p); s.m.rotation.y = Math.atan2(lead.x - s.p.x, lead.z - s.p.z); s.m.visible = !S.done; lead = s.p; }
    }
    if (!S.done) pos.y = clamp(pos.y, world.height(pos.x, pos.z) + 0.6, world.ceiling - 0.5);

    if (rig && kind === 'keeper') {
      const moved = Math.hypot(pos.x - was.x, pos.z - was.z), k = dt > 1e-5 && moved < 5 ? 1 / dt : 0, near = pos.distanceTo(fish); // how it really moved, whatever moved it
      S.struck = Math.max(0, (S.struck || 0) - dt);
      rig.update(dt, { x: pos.x, z: pos.z, yaw, vx: (pos.x - was.x) * k, vz: (pos.z - was.z) * k, ground: world.footing, floor: world.footing(v.set(pos.x, 0, pos.z)).y, time: ctx.time,
        wary: awake && !S.done ? clamp(1.3 - near / 11, 0, 1) : 0, look: fish, snap: S.done ? -1 : S.state === 'snap' ? clamp(1 - S.t / 0.6, 0, 1) : S.struck > 0 ? 1 : -1, strike: S.done ? null : tailPoint(ctx),
        tuck: !S.done && target.progress > 0.15, stun: S.stun > 0, limp: S.done });
      const clear = pos.y - (rig.walker.body.ground + HOME[1]) - 0.7; if (clear > 0 && !S.done) mesh.position.y += clear; // lifted off the ground, it is drawn where it is
      was.copy(pos);
    } else if (rig) { // the Shearer bends its own body (sawfish.js): it is told where it is, how it is moving and what it is about
      const k = dt > 1e-5 && pos.distanceTo(was) < 5 ? 1 / dt : 0, mood = S.done ? 'down' : S.stun > 0 ? 'stun' : S.state === 'tired' ? (S.stuck ? 'stuck' : 'tired') : S.state === 'idle' ? 'search' : S.state;
      rig.update(dt, { x: pos.x, y: pos.y, z: pos.z, yaw, speed: Math.hypot(pos.x - was.x, pos.z - was.z) * k, climb: (pos.y - was.y) * k, mood, mode: S.mode, side: S.side, k: S.T > 0 ? 1 - S.t / S.T : 0, look: fish, time: ctx.time });
      was.copy(pos);
    } else {
      mesh.position.copy(pos); mesh.rotation.y = yaw; actor.tick(S.done ? dt * 0.27 : dt, S.done ? 0 : vel.length());
      if (!S.done) mesh.rotation.z = S.stun > 0 ? 0.35 * Math.sin(ctx.time * 16) : 0;
    }
    mat.emissiveIntensity = 0.12 + 0.9 * S.flash;
    warn.position.copy(pos).y += 0.6; warn.scale.setScalar(Math.max(0.01, warnSize * (1 + 0.15 * Math.sin(ctx.time * 30)))); warn.visible = warnSize > 0 && !S.done;
    if (lure) { const lit = !S.done && S.state !== 'dim' && S.stun <= 0; lure.scale.setScalar(damp(lure.scale.x, lit ? (S.state === 'windup' ? 5 : 3) : 0.4, 8, dt)); }
    beads.forEach((b, i) => { b.visible = !S.done && i < S.hp; b.position.set(pos.x + (i - (HP - 1) / 2) * 0.5, pos.y + (kind === 'keeper' ? 3 : 2.1), pos.z); });
    lid.position.set(T * Math.round((ctx.focus.x - rift.x) / T), 0, T * Math.round((ctx.focus.z - rift.z) / T)); // the veil is laid out where the rift is; this puts it on the nearest copy of the world
    lid.material.opacity = damp(lid.material.opacity, S.done ? 0 : 0.36 + 0.1 * Math.sin(ctx.time * 2), 3, dt); lid.visible = lid.material.opacity > 0.01;

    S.wrap = null;
    if (wrappable() && ctx.playing) { target.x = pos.x; target.y = pos.y; target.z = pos.z; target.can = canWrap(ctx.total, target.room); S.wrap = target; } else target.progress = 0;
  }
  // while the keeper lives the veil holds: the ledges can be swum over, but nothing goes down between the walls
  function pushOut(p, radius) {
    if (S.done) return;
    const top = rift.ledgeY + 0.5 + radius;
    if (p.y < top && rift.in(p.x, p.z) > rift.ledge - 0.3) p.y = top;
  }
  function dispose() { scene.remove(root); for (const o of trash) o.dispose(); }
  return { update, ram, pushOut, dispose, wrapped: fall, state: S, kind, pos, rig, mesh, get ring() { return S.wrap; }, get done() { return S.done; }, debug: { set, fall, hurt, charge(x, y, z) { aim.set(x, y, z); vel.subVectors(aim, pos).setLength(10.5); S.mode = 'slash'; S.stuck = false; set('charge', 1.4); } } }; // (debug.charge: for the checks, a slash at a point)
}
