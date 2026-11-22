// The guard of a well. Each band's well is kept by one creature, and the way down stays shut until it has
// been dealt with. The four differ, and each is a place to use one of the fish's tools:
//   band 1  the Keeper       slow, armoured, snaps at a tail that comes near     wrap it, or ram it three times
//   band 2  the Shearer      charges the tail in a straight line, then tires     ram or wrap it while it is tired
//   band 3  the Lamplighter  hangs over the well and lunges; takes a bait first  ram or wrap it while its lamp is out
//   band 4  the Warden       an eel circling the mouth that tightens on a fish   ram its head, or bait the head out and wrap it
// Any of them can be beaten by rams alone, so a short body is never stuck.

import * as THREE from 'three';
import { T, wrapD, canWrap } from './world.js';
import { rng, lerp, clamp, damp, glowTexture } from './geo.js';
import { sealGeo } from './critters.js';
import { make, paintOf } from './npc.js';

const KINDS = ['keeper', 'shearer', 'lamplighter', 'warden'];
const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function createGuard(scene, world, { seed = 1, floor = 0 } = {}, game) {
  const kind = KINDS[floor], tint = paintOf(floor);
  const rand = rng(seed * 61 + floor * 311 + 7), rr = (a, b) => a + (b - a) * rand();
  const well = world.goal, Y0 = well.y; // the rim of the well
  const root = new THREE.Group(); scene.add(root);
  const trash = [];
  const keep = (o) => { trash.push(o); return o; };
  const actor = keep(make(kind)), mesh = actor.object, mat = actor.body.material; mesh.rotation.order = 'YXZ'; root.add(mesh); // the guard itself is its component from npc.js
  const glowMap = keep(glowTexture());
  const sprite = (color, size) => { const s = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: glowMap, color, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true }))); s.scale.setScalar(size); root.add(s); return s; };
  const warn = sprite('#ff7f96', 1), lure = actor.parts.glow || null; // the Lamplighter's lamp comes with it
  // the lid: light across the mouth of the well while its guard lives
  const lid = new THREE.Mesh(keep(sealGeo(6.1)), keep(new THREE.MeshBasicMaterial({ color: tint, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })));
  root.add(lid);
  // what it has left, as beads over its back
  const HP = { keeper: 3, shearer: 3, lamplighter: 3, warden: 4 }[kind];
  const beadGeo = keep(new THREE.SphereGeometry(0.16, 6, 5)), beadMat = keep(new THREE.MeshBasicMaterial({ color: '#f2faf7', fog: false }));
  const beads = Array.from({ length: HP }, () => { const b = new THREE.Mesh(beadGeo, beadMat); root.add(b); return b; });
  // the warden's body
  const slabs = [];
  if (kind === 'warden') {
    for (const m of actor.segments(11)) { root.add(m); slabs.push({ m, p: new THREE.Vector3() }); }
  }

  const S = { kind, state: 'idle', t: 0, hp: HP, done: false, danger: 0, stun: 0, cool: 1.5, ang: rr(0, 6.28), spin: 1, R: 4.2, hits: 0, bites: 0, flash: 0 };
  const pos = new THREE.Vector3(), vel = new THREE.Vector3(), aim = new THREE.Vector3(), v = new THREE.Vector3(), W = new THREE.Vector3();
  let yaw = 0, bait = null;
  const target = { x: 0, y: 0, z: 0, room: { keeper: 0.75, shearer: 0.55, lamplighter: 0.8, warden: 0.6 }[kind], orbit: 1.2, fit: 0.7, can: false, left: 1, threat: 1, progress: 0, arcStart: 0, arcSign: 1, sweep: 1 };
  const set = (state, t = 0) => { S.state = state; S.t = t; };
  const HOME = { keeper: [8.6, 0.9], shearer: [11, 2.6], lamplighter: [0, 3.4], warden: [4.2, 1.6] }[kind]; // distance from the well's centre, height over its rim
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
  function ram(snout) {
    if (S.done || snout.distanceTo(pos) > { keeper: 2.1, shearer: 1.5, lamplighter: 1.9, warden: 1.3 }[kind]) return null;
    if (S.stun > 0.3 && S.flash > 0.2) return null; // one ram, one blow
    if (!vulnerable()) { S.stun = 0.4; S.flash = 0.5; game.event('clang', pos); return { kind: 'guard', pos: pos.clone(), food: 0, bounced: true }; } // lit, the Lamplighter shrugs it off
    if (kind === 'warden') S.spin *= -1;
    if (kind === 'shearer') set('tired', 2.2);
    hurt({ keeper: 1.6, shearer: 1.5, lamplighter: 1.2, warden: 1.3 }[kind]);
    return { kind: 'guard', pos: pos.clone(), food: 0 };
  }
  const tailNear = (ctx, reach) => { const J = ctx.joints, N = J.length - 1; for (let j = Math.ceil(N * 0.4); j <= N; j++) if (J[j].distanceTo(pos) < reach) return j; return -1; };
  const baitNear = (ctx, reach) => ctx.pieces.find((p) => p.kind === 'decoy' && !p.dead && p.life > 0.8 && p.pos.distanceTo(pos) < reach) || null;
  const go = (dt, to, speed, turn = 4) => { // swim toward a point
    v.subVectors(to, pos); const d = v.length();
    if (d > 1e-3) { vel.lerp(v.multiplyScalar(speed / d), 1 - Math.exp(-turn * dt)); yaw += wrapPi(Math.atan2(vel.x, vel.z) - yaw) * (1 - Math.exp(-6 * dt)); }
    pos.addScaledVector(vel, dt);
    return d;
  };

  function update(dt, ctx) {
    W.set(well.x + T * Math.round((ctx.focus.x - well.x) / T), Y0, well.z + T * Math.round((ctx.focus.z - well.z) / T)); // the well on the nearest copy of the world
    pos.x += T * Math.round((ctx.focus.x - pos.x) / T); pos.z += T * Math.round((ctx.focus.z - pos.z) / T);
    for (const s of slabs) { s.p.x += T * Math.round((ctx.focus.x - s.p.x) / T); s.p.z += T * Math.round((ctx.focus.z - s.p.z) / T); }
    S.t -= dt; S.cool -= dt; S.flash = Math.max(0, S.flash - dt * 2.5); S.danger = 0;
    const fish = ctx.pos, far = Math.hypot(fish.x - W.x, fish.z - W.z), awake = ctx.playing && far < 26;
    let warnSize = 0;
    if (S.done) { pos.y = Math.max(world.height(pos.x, pos.z) + 0.5, pos.y - 1.6 * dt); mesh.rotation.z = damp(mesh.rotation.z, 1.3, 3, dt); }
    else if (S.stun > 0) { S.stun -= dt; vel.multiplyScalar(Math.exp(-4 * dt)); pos.addScaledVector(vel, dt); }
    else if (kind === 'keeper') { // round and round the rim; a tail within reach gets snapped at
      if (S.state === 'snap') { warnSize = 2.4; S.danger = 0.6; if (S.t <= 0) { const j = tailNear(ctx, 2.4); if (j >= 0 && game.bite(2, j, pos)) S.bites++; set('idle'); S.cool = 3; } }
      else if (target.progress > 0.15) vel.multiplyScalar(Math.exp(-6 * dt)); // a body going round it: it pulls into its shell and sits tight
      else {
        S.ang += dt * 0.17; aim.set(W.x + Math.sin(S.ang) * HOME[0], Y0 + HOME[1], W.z + Math.cos(S.ang) * HOME[0]); go(dt, aim, 1.5, 2);
        if (awake && S.cool <= 0 && tailNear(ctx, 2.8) >= 0) set('snap', 0.6);
      }
    } else if (kind === 'shearer') { // circle, aim at the tail, charge through where it was, tire
      if (S.state === 'aim') { warnSize = 2.8; S.danger = 0.7; yaw += wrapPi(Math.atan2(aim.x - pos.x, aim.z - pos.z) - yaw) * (1 - Math.exp(-9 * dt)); vel.multiplyScalar(Math.exp(-5 * dt)); if (S.t <= 0) { vel.subVectors(aim, pos).setLength(10.5); set('charge', Math.min(1.5, pos.distanceTo(aim) / 10.5 + 0.35)); } }
      else if (S.state === 'charge') { S.danger = 1; pos.addScaledVector(vel, dt); const j = tailNear(ctx, 0.85); if (j >= 0 && game.bite(3, j, pos)) { S.bites++; set('tired', 2.2); } else if (S.t <= 0) set('tired', 2.2); }
      else if (S.state === 'tired') { vel.multiplyScalar(Math.exp(-2.5 * dt)); pos.addScaledVector(vel, dt); if (S.t <= 0) { set('idle'); S.cool = 1.2; } }
      else {
        S.ang += dt * 0.3; aim.set(W.x + Math.sin(S.ang) * HOME[0], Y0 + HOME[1], W.z + Math.cos(S.ang) * HOME[0]); go(dt, aim, 3.2, 2.5);
        if (awake && S.cool <= 0 && pos.distanceTo(fish) < 17) { const J = ctx.joints; aim.copy(J[J.length - 1]); set('aim', 0.8); }
      }
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

    mesh.position.copy(pos); mesh.rotation.y = yaw; actor.tick(S.done ? dt * 0.27 : dt, S.done ? 0 : vel.length());
    if (!S.done) mesh.rotation.z = S.stun > 0 ? 0.35 * Math.sin(ctx.time * 16) : 0;
    mat.emissiveIntensity = 0.12 + 0.9 * S.flash;
    warn.position.copy(pos).y += 0.6; warn.scale.setScalar(Math.max(0.01, warnSize * (1 + 0.15 * Math.sin(ctx.time * 30)))); warn.visible = warnSize > 0 && !S.done;
    if (lure) { const lit = !S.done && S.state !== 'dim' && S.stun <= 0; lure.scale.setScalar(damp(lure.scale.x, lit ? (S.state === 'windup' ? 5 : 3) : 0.4, 8, dt)); }
    beads.forEach((b, i) => { b.visible = !S.done && i < S.hp; b.position.set(pos.x + (i - (HP - 1) / 2) * 0.5, pos.y + (kind === 'keeper' ? 3 : 2.1), pos.z); });
    lid.position.set(W.x, Y0 + 0.45, W.z);
    lid.material.opacity = damp(lid.material.opacity, S.done ? 0 : 0.5 + 0.12 * Math.sin(ctx.time * 2), 3, dt); lid.visible = lid.material.opacity > 0.01; lid.rotation.y += dt * 0.12;

    S.wrap = null;
    if (wrappable() && ctx.playing) { target.x = pos.x; target.y = pos.y; target.z = pos.z; target.can = canWrap(ctx.total, target.room); S.wrap = target; } else target.progress = 0;
  }
  // while the guard lives the lid holds: nothing goes down the well
  function pushOut(p, radius) {
    if (S.done) return;
    if (Math.hypot(wrapD(p.x - well.x), wrapD(p.z - well.z)) < 5.9 && p.y < Y0 + 0.5 + radius) p.y = Y0 + 0.5 + radius;
  }
  function dispose() { scene.remove(root); for (const o of trash) o.dispose(); }
  return { update, ram, pushOut, dispose, wrapped: fall, state: S, kind, pos, get ring() { return S.wrap; }, get done() { return S.done; }, debug: { set, fall, hurt } };
}
