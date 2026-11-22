// Things that go for the body: tail-biters, hooks on lines from above, anglers behind their lures.
// Also the loose tail pieces: debris from a bite, and the decoy the fish can shed on purpose.

import * as THREE from 'three';
import { rng, clamp, soup, M, glowTexture } from './geo.js';
import { T } from './world.js';
import { alive } from './kit.js';
import { make, geometry } from './npc.js';

let GEO = null;
function geometries() {
  if (GEO) return GEO;
  GEO = {
    glow: glowTexture(),
  };
  return GEO;
}

// game: { safe(): bool, bite(segments, joint, from, kind): bool }
export function createFoes(scene, world, { seed = 1 } = {}, game) {
  const G = geometries(), F = world.floor;
  const rand = rng(seed * 31 + world.index * 1013 + 5);
  const rr = (a, b) => a + (b - a) * rand();
  const owned = [], materials = [];
  const add = (o) => { scene.add(o); owned.push(o); return o; };
  // every hunter is its component from npc.js, made here and moved about by what follows
  const actors = [], cast = (id) => { const a = make(id); actors.push(a); add(a.object); return a; };
  const mat = (m) => { materials.push(m); return m; };
  const body = mat(alive(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));
  const sprite = (color, size) => { const s = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: G.glow, color, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true }))); s.scale.setScalar(size); return s; };
  const near = (p, focus) => { p.x += T * Math.round((focus.x - p.x) / T); p.z += T * Math.round((focus.z - p.z) / T); };
  const v = new THREE.Vector3(), v2 = new THREE.Vector3();
  const state = { danger: 0, stalked: 0, flared: 0, lured: 0, leeched: 0, mineNear: false };

  // ------------------------------------------------------------ tail-biters
  const biters = [];
  for (let i = 0; i < F.biters; i++) {
    const [x, z] = world.spots.biters[i] || world.openSpot(26); // in the shearing stalls, where there are any
    const actor = cast('biter'), mesh = actor.object;
    const pos = new THREE.Vector3(x, world.height(x, z) + 2.6, z);
    const mark = sprite('#ff9db8', 0.9); mark.position.y = 0.45; mark.visible = false; mesh.add(mark); // lit while a bait has it
    biters.push({ mesh, actor, mark, pos, home: pos.clone(), vel: new THREE.Vector3(), wander: pos.clone(), state: 'roam', t: 0, cool: 2, alive: true, lured: null, wig: rand() * 6 });
  }
  function updateBiter(b, dt, ctx) {
    near(b.pos, ctx.focus); near(b.home, ctx.focus); near(b.wander, ctx.focus);
    const J = ctx.joints, N = J.length - 1;
    b.t -= dt; b.cool -= dt;
    let speed = 1.2;
    const aim = v;
    const decoy = pieces.find((p) => p.kind === 'decoy' && p.life > 0.3 && p.pos.distanceTo(b.pos) < p.pull);
    if (b.lured && (b.lured.dead || (b.state !== 'decoy' && b.state !== 'chew'))) b.lured = null;
    b.mark.visible = !!b.lured;
    if (b.state === 'stun') { // knocked silly: it hangs where it is
      aim.copy(b.pos); speed = 0;
      if (b.t <= 0) { b.state = 'roam'; b.cool = 1.5; }
    } else if (b.state === 'chew') {
      aim.copy(b.wander); speed = 0.6;
      if (b.t <= 0) { b.state = 'roam'; b.cool = 3.5; }
    } else if (b.state === 'flee') {
      aim.subVectors(b.pos, ctx.snout).setLength(5).add(b.pos); speed = 4;
      if (b.t <= 0) b.state = 'roam';
    } else if (b.pos.distanceTo(ctx.snout) < ctx.fear) { // it will not come near the jaws
      b.state = 'flee'; b.t = 1.1;
      aim.subVectors(b.pos, ctx.snout).setLength(5).add(b.pos); speed = 4;
    } else if (decoy) {
      b.state = 'decoy'; b.lured = decoy; aim.copy(decoy.pos); speed = 4.2;
      if (b.pos.distanceTo(decoy.pos) < 0.5) { b.state = 'chew'; b.t = decoy.life + 1.5; b.wander.copy(decoy.pos); decoy.fed++; game.baited?.(decoy, b, 'biter'); }
    } else {
      // the nearest point on the back half of the body
      let best = -1, bd = Infinity;
      for (let j = Math.ceil(N * 0.5); j <= N; j++) { const d = b.pos.distanceToSquared(J[j]); if (d < bd) { bd = d; best = j; } }
      bd = Math.sqrt(bd);
      if (b.cool <= 0 && bd < 14 && !game.safe()) {
        b.state = 'hunt'; aim.copy(J[best]); speed = 3.8;
        if (bd < 0.42 && game.bite(2, best, b.pos, 'biter')) {
          b.state = 'chew'; b.t = 3.5;
          b.wander.subVectors(b.pos, ctx.snout).setLength(6).add(b.pos);
        }
      } else {
        if (b.state !== 'roam' || b.t <= 0) { b.state = 'roam'; b.t = rr(3, 5); b.wander.set(b.home.x + rr(-16, 16), b.home.y + rr(-1, 2), b.home.z + rr(-16, 16)); }
        aim.copy(b.wander);
      }
    }
    v2.subVectors(aim, b.pos);
    if (v2.lengthSq() > 1e-6) v2.setLength(speed);
    else v2.set(0, 0, 0);
    b.vel.lerp(v2, 1 - Math.exp(-3.5 * dt));
    b.pos.addScaledVector(b.vel, dt);
    world.pushOut(b.pos, 0.3);
    b.pos.y = clamp(b.pos.y, world.height(b.pos.x, b.pos.z) + 0.5, world.ceiling);
    b.wig += dt * (4 + b.vel.length() * 3);
    b.mesh.position.copy(b.pos); b.actor.tick(dt, b.vel.length());
    if (b.vel.lengthSq() > 1e-4) {
      b.mesh.rotation.y = Math.atan2(b.vel.x, b.vel.z) + Math.sin(b.wig) * 0.05;
      b.mesh.rotation.x = -Math.atan2(b.vel.y, Math.hypot(b.vel.x, b.vel.z));
    }
    if (b.state === 'hunt' && b.pos.distanceTo(ctx.snout) < 16) state.stalked++;
  }

  // ------------------------------------------------------------ anglers: a warm light in the dark, with teeth behind it
  const anglers = [];
  for (let i = 0; i < F.anglers; i++) {
    const seat = world.spots.anglers[i], [x, z] = seat || world.openSpot(30); // on the old lamp plinths, where there are any
    const actor = cast('angler'), group = actor.object, glow = actor.parts.glow;
    const home = new THREE.Vector3(x, seat ? seat[2] : world.height(x, z) + rr(1.5, 2.6), z);
    anglers.push({ group, glow, actor, pos: home.clone(), home, vel: new THREE.Vector3(), state: 'lurk', t: 0, yaw: rand() * 6.28, ph: rand() * 6.28, alive: true, bitten: false, target: 0 });
  }
  function updateAngler(a, dt, ctx) {
    near(a.pos, ctx.focus); near(a.home, ctx.focus);
    const J = ctx.joints, N = J.length - 1;
    a.t -= dt;
    let glow = 1.7 + 0.25 * Math.sin(ctx.time * 3 + a.ph), face = null;
    if (a.state === 'lurk') {
      a.pos.set(a.home.x, a.home.y + Math.sin(ctx.time * 0.7 + a.ph) * 0.25, a.home.z);
      if (a.pos.distanceTo(ctx.snout) < 12) face = ctx.snout;
      const bait = pieces.find((p) => p.kind === 'decoy' && p.life > 0.6 && !p.tough && p.pos.distanceTo(a.pos) < Math.min(7, p.pull));
      if (bait) { a.state = 'windup'; a.t = 0.7; a.bait = bait; } // a bait within reach is taken before the fish is
      else if (!game.safe()) {
        for (let j = 2; j <= N; j++) if (a.pos.distanceToSquared(J[j]) < 2.6 * 2.6) { a.state = 'windup'; a.t = 0.8; a.target = j; a.bait = null; break; }
      }
    } else if (a.state === 'windup') {
      const j = Math.min(a.target, N), at = a.bait ? a.bait.pos : J[j];
      face = at; glow = 4.4 + Math.sin(ctx.time * 40) * 0.7;
      if (!a.bait) state.flared++;
      if (a.t <= 0) { // lunge at where it is now
        v.subVectors(at, a.pos);
        a.vel.copy(v).setLength((v.length() + 0.8) / 0.24);
        a.state = 'lunge'; a.t = 0.24; a.bitten = false;
      }
    } else if (a.state === 'lunge') {
      a.pos.addScaledVector(a.vel, dt);
      glow = 3.2;
      if (a.bait) { if (!a.bitten && a.pos.distanceTo(a.bait.pos) < 0.9) { a.bitten = true; a.bait.fed++; game.baited?.(a.bait, a, 'angler'); a.bait.life = Math.min(a.bait.life, 0.3); } }
      else if (!a.bitten) for (let j = 1; j <= N; j++) if (a.pos.distanceToSquared(J[j]) < 0.62 * 0.62) { a.bitten = true; game.bite(3, j, a.pos, 'angler'); break; }
      if (a.t <= 0) { a.state = 'recover'; a.t = a.bait ? 4 : 3; a.bait = null; } // a mouthful of bait keeps it busy longer
    } else if (a.state === 'stun') { // rammed: knocked back, lamp out, harmless until it comes round
      a.pos.addScaledVector(a.vel, dt); a.vel.multiplyScalar(Math.exp(-3.5 * dt));
      glow = 0.5 + 0.3 * Math.abs(Math.sin(ctx.time * 14));
      if (a.t <= 0) { a.state = 'recover'; a.t = 1.5; }
    } else {
      a.pos.lerp(a.home, 1 - Math.exp(-0.9 * dt));
      if (a.t <= 0) a.state = 'lurk';
    }
    a.pos.y = Math.max(a.pos.y, world.height(a.pos.x, a.pos.z) + 0.7);
    if (face) { const want = Math.atan2(face.x - a.pos.x, face.z - a.pos.z); let d = want - a.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); a.yaw += d * (1 - Math.exp(-(a.state === 'windup' ? 9 : 1.2) * dt)); }
    a.group.position.copy(a.pos); a.actor.tick(dt, a.state === 'lurk' ? 0 : 1);
    a.group.rotation.y = a.yaw;
    a.group.rotation.z = a.state === 'stun' ? 0.45 * Math.sin(ctx.time * 9 + a.ph) : 0;
    a.glow.scale.setScalar(glow);
  }

  // ------------------------------------------------------------ hooks on lines from the surface
  const hooks = [];
  for (let i = 0; i < F.hooks; i++) {
    const [x, z] = world.spots.hooks[i] || world.openSpot(i === 0 && world.index === 0 ? 14 : 20); // over the paying floor, where there is one
    const group = cast('hook').object;
    hooks.push({ group, x, z, y0: world.height(x, z) + rr(2.3, 4.2), ph: rand() * 6.28, state: 'idle', t: 0, lift: 0, pos: new THREE.Vector3() });
  }
  function updateHook(h, dt, ctx) {
    const t = ctx.time;
    h.pos.set(h.x + Math.sin(t * 0.23 + h.ph * 2) * 1.4, h.y0 + Math.sin(t * 0.55 + h.ph) * 1.3 + h.lift, h.z + Math.cos(t * 0.19 + h.ph) * 1.4);
    near(h.pos, ctx.focus);
    if (h.state === 'idle') {
      if (!game.safe()) {
        const J = ctx.joints;
        for (let j = 2; j < J.length; j++) if (h.pos.distanceToSquared(J[j]) < 0.42 * 0.42) {
          if (game.bite(2, j, h.pos, 'hook')) { h.state = 'reel'; }
          break;
        }
      }
    } else if (h.state === 'reel') {
      h.lift += 11 * dt;
      if (h.lift > 34) { h.state = 'gone'; h.t = 7; h.group.visible = false; }
    } else if (h.state === 'gone') {
      h.t -= dt;
      if (h.t <= 0) { h.state = 'drop'; h.group.visible = true; }
    } else {
      h.lift = Math.max(0, h.lift - 7 * dt);
      if (h.lift <= 0) h.state = 'idle';
    }
    h.group.position.copy(h.pos);
    h.group.rotation.y = Math.sin(t * 0.4 + h.ph) * 0.6;
  }

  // ------------------------------------------------------------ loose tail pieces
  // ------------------------------------------------------------ spined drifters: they hunt nothing, and cost a segment to brush against
  const mines = [], leeches = [];
  const spawnAt = (lo, hi) => { const [x, z] = world.openSpot(20); return new THREE.Vector3(x, world.height(x, z) + rr(lo, hi), z); };
  for (let i = 0; i < ([0, 4, 6, 8, 6][world.index] || 0); i++) { const mesh = cast('drifter').object; const pos = spawnAt(1.6, 4.5); mines.push({ mesh, pos, home: pos.clone(), alive: true, ph: rand() * 6.28 }); }
  for (let i = 0; i < ([0, 0, 3, 4, 4][world.index] || 0); i++) { const actor = cast('leech'), mesh = actor.object; const pos = spawnAt(2, 4); leeches.push({ mesh, actor, pos, home: pos.clone(), wander: pos.clone(), vel: new THREE.Vector3(), state: 'roam', t: 0, cool: 3, joint: 0, eat: 0, crush: 0, alive: true }); }
  function updateMine(m, dt, ctx) {
    near(m.home, ctx.focus);
    m.pos.set(m.home.x + Math.sin(ctx.time * 0.3 + m.ph) * 1.2, m.home.y + Math.sin(ctx.time * 0.5 + m.ph) * 0.4, m.home.z + Math.cos(ctx.time * 0.27 + m.ph) * 1.2);
    m.mesh.position.copy(m.pos); m.mesh.rotation.y += dt * 0.4; m.mesh.rotation.x += dt * 0.25;
    if (m.pos.distanceToSquared(ctx.snout) < 49) state.mineNear = true;
    if (game.safe()) return;
    const J = ctx.joints;
    for (let j = 1; j < J.length; j++) if (m.pos.distanceToSquared(J[j]) < 0.55 * 0.55) { if (game.bite(1, j, m.pos, 'mine')) { fell(m); spawnPiece(m.pos, 'debris'); } break; } // the head pushes past it; the body behind does not
  }
  // ------------------------------------------------------------ leeches: they fasten on the middle of the body and eat what the fish has eaten
  function updateLeech(l, dt, ctx) {
    near(l.pos, ctx.focus); near(l.home, ctx.focus); near(l.wander, ctx.focus);
    const J = ctx.joints, N = J.length - 1;
    l.t -= dt; l.cool -= dt;
    if (l.state === 'on') {
      const j = Math.min(l.joint, N); l.pos.copy(J[j]); l.pos.y += 0.17; state.leeched++;
      l.eat -= dt; if (l.eat <= 0) { l.eat = 2.5; game.leech?.(j, l.pos); }
      l.crush = ctx.coil > 0.8 ? l.crush + dt : 0;
      if (ctx.dash) { l.state = 'stun'; l.t = 2.2; l.cool = 5; l.vel.set(rr(-3, 3), 2.5, rr(-3, 3)); } // a dash throws it off
      else if (l.crush > 0.9) { fell(l); game.fed?.(l.pos, 1); } // a tight coil crushes it
      l.mesh.position.copy(l.pos); l.actor.tick(dt * 0.6, 0);
      if (j > 0) l.mesh.rotation.set(0, Math.atan2(J[j - 1].x - J[j].x, J[j - 1].z - J[j].z), 0);
      return;
    }
    let speed = 1.4; const aim = v;
    if (l.state === 'stun') { aim.copy(l.pos); speed = 0; l.pos.addScaledVector(l.vel, dt); l.vel.multiplyScalar(Math.exp(-2.5 * dt)); if (l.t <= 0) { l.state = 'roam'; l.vel.set(0, 0, 0); } }
    else {
      let best = -1, bd = Infinity;
      for (let j = Math.ceil(N * 0.3); j <= Math.floor(N * 0.75); j++) { const d = l.pos.distanceToSquared(J[j]); if (d < bd) { bd = d; best = j; } }
      bd = Math.sqrt(bd);
      if (l.cool <= 0 && best >= 0 && bd < 10 && !game.safe()) {
        l.state = 'dart'; aim.copy(J[best]); speed = 5.6; state.stalked++;
        if (bd < 0.4) { l.state = 'on'; l.joint = best; l.eat = 2; l.crush = 0; l.vel.set(0, 0, 0); }
      } else {
        if (l.state !== 'roam' || l.t <= 0) { l.state = 'roam'; l.t = rr(3, 6); l.wander.set(l.home.x + rr(-12, 12), l.home.y + rr(-1, 2), l.home.z + rr(-12, 12)); }
        aim.copy(l.wander);
      }
      v2.subVectors(aim, l.pos);
      if (v2.lengthSq() > 1e-6) v2.setLength(speed); else v2.set(0, 0, 0);
      l.vel.lerp(v2, 1 - Math.exp(-5 * dt));
      l.pos.addScaledVector(l.vel, dt);
    }
    l.pos.y = clamp(l.pos.y, world.height(l.pos.x, l.pos.z) + 0.4, world.ceiling);
    l.mesh.position.copy(l.pos); l.actor.tick(dt, l.vel.length());
    if (l.vel.lengthSq() > 1e-3) l.mesh.rotation.set(-Math.atan2(l.vel.y, Math.hypot(l.vel.x, l.vel.z)), Math.atan2(l.vel.x, l.vel.z), 0);
  }

  const pieces = [];
  const circle = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 49 }, (_, i) => new THREE.Vector3(Math.sin((i / 48) * Math.PI * 2), 0, Math.cos((i / 48) * Math.PI * 2))));
  owned.push({ dispose: () => circle.dispose() });
  const baitLine = (opacity) => mat(new THREE.LineBasicMaterial({ color: '#ff9db8', transparent: true, opacity, depthWrite: false, fog: false }));
  const threadGeo = new THREE.BufferGeometry(); threadGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(32 * 3), 3));
  owned.push({ dispose: () => threadGeo.dispose() });
  const threads = add(new THREE.LineSegments(threadGeo, baitLine(0.55)));
  threads.frustumCulled = false;
  function spawnPiece(pos, kind, fx = null) {
    const mesh = add(new THREE.Mesh(geometry('tailpiece'), body)); // a shed tail is its component, in the oarfish's own colours
    mesh.rotation.order = 'YXZ';
    let glow = null;
    if (kind === 'decoy') { glow = sprite('#ff9db8', 2.2); mesh.add(glow); }
    const p = { mesh, glow, kind, fx, pos: pos.clone(), vel: new THREE.Vector3(rr(-0.5, 0.5), rr(0.1, 0.5), rr(-0.5, 0.5)), life: kind === 'decoy' ? 7 : 2.6, full: 7, pull: 22, fed: 0, age: 0, tough: false, ph: rand() * 6.28, yaw: rand() * 6.28 };
    if (kind === 'decoy') {
      p.ring = add(new THREE.Line(circle, baitLine(0.8))); p.ping = add(new THREE.Line(circle, baitLine(0.9)));
      for (const o of [p.ring, p.ping]) o.frustumCulled = false;
    }
    pieces.push(p);
    return p;
  }
  function updatePiece(p, dt, ctx) {
    p.life -= dt;
    p.vel.multiplyScalar(Math.exp(-1.3 * dt));
    p.vel.y -= 0.22 * dt;
    p.pos.addScaledVector(p.vel, dt);
    if (p.push) p.pos.addScaledVector(p.push, dt); // a bait that swims off on its own
    p.pos.y = Math.max(p.pos.y, world.height(p.pos.x, p.pos.z) + 0.25);
    p.yaw += dt * (p.kind === 'decoy' ? 2.4 : 1.2);
    p.mesh.position.copy(p.pos);
    p.mesh.rotation.set(Math.sin(ctx.time * 7 + p.ph) * 0.3, p.yaw + Math.sin(ctx.time * 9 + p.ph) * 0.5, 0);
    p.mesh.scale.setScalar(clamp(p.life / 0.8, 0, 1) * (p.kind === 'decoy' ? 1.5 : 1.1));
    if (p.glow) p.glow.scale.setScalar(2.2 + Math.sin(ctx.time * 10) * 0.5 + 0.6 * Math.min(p.fed, 4));
    p.age += dt;
    if (p.ring) {
      p.ring.position.copy(p.pos); p.ring.scale.setScalar(0.35 + 0.75 * clamp(p.life / p.full, 0, 1)); // runs down with what is left of it
      const k = clamp(p.age / 0.7, 0, 1); p.ping.visible = k < 1;
      p.ping.position.copy(p.pos); p.ping.scale.setScalar(0.5 + 9 * k); p.ping.material.opacity = 0.9 * (1 - k); // the call going out
    }
    if (p.life <= 0) { scene.remove(p.mesh); if (p.ring) { scene.remove(p.ring); scene.remove(p.ping); } p.dead = true; }
  }

  // ctx: { joints, snout, focus, time, fear }  (fear: how close to the head a biter dares to come)
  function update(dt, ctx) {
    state.stalked = 0; state.flared = 0; state.leeched = 0; state.mineNear = false;
    for (const m of mines) if (m.alive) updateMine(m, dt, ctx);
    for (const l of leeches) if (l.alive) updateLeech(l, dt, ctx);
    for (const b of biters) if (b.alive) updateBiter(b, dt, ctx);
    for (const a of anglers) if (a.alive) updateAngler(a, dt, ctx);
    for (const h of hooks) updateHook(h, dt, ctx);
    for (const p of pieces) updatePiece(p, dt, ctx);
    for (let i = pieces.length - 1; i >= 0; i--) if (pieces[i].dead) pieces.splice(i, 1);
    { // a thread from each bait to everything it is pulling, so the player sees what it bought
      const arr = threadGeo.attributes.position.array; let n = 0;
      const tie = (from, to) => { if (n < 16) { arr.set([from.x, from.y, from.z, to.x, to.y, to.z], n * 6); n++; } };
      for (const b of biters) if (b.alive && b.lured && !b.lured.dead) tie(b.lured.pos, b.pos);
      for (const a of anglers) if (a.alive && a.bait && !a.bait.dead) tie(a.bait.pos, a.pos);
      state.lured = n;
      threadGeo.setDrawRange(0, n * 2); threadGeo.attributes.position.needsUpdate = true;
    }
    state.danger = clamp(state.stalked * 0.45 + state.flared * 0.8 + state.leeched * 0.5, 0, 1);
  }

  // a dash that meets a hunter head-on. A biter is small enough to be broken by it; an angler is knocked silly
  const fell = (h) => { h.alive = false; (h.mesh || h.group).visible = false; if (h.lured !== undefined) h.lured = null; };
  // stop every hunter within reach for a while (only: 'angler' or 'biter' to spare the other kind)
  function stun(pos, radius, seconds, only = null) {
    let n = 0;
    if (only !== 'angler') for (const b of biters) if (b.alive && b.pos.distanceTo(pos) < radius) { b.state = 'stun'; b.t = seconds; n++; }
    if (only !== 'biter') for (const a of anglers) if (a.alive && a.pos.distanceTo(pos) < radius) { a.state = 'stun'; a.t = seconds; a.vel.set(0, 0, 0); a.bait = null; n++; }
    return n;
  }
  // a burst: biters within reach are broken, anglers stunned
  function blast(pos, radius) {
    const got = [];
    for (const b of biters) if (b.alive && b.pos.distanceTo(pos) < radius) { fell(b); got.push({ kind: 'biter', pos: b.pos.clone(), food: 1, killed: true }); }
    for (const m of mines) if (m.alive && m.pos.distanceTo(pos) < radius) { fell(m); got.push({ kind: 'mine', pos: m.pos.clone(), food: 1, killed: true }); }
    for (const l of leeches) if (l.alive && l.state !== 'on' && l.pos.distanceTo(pos) < radius) { fell(l); got.push({ kind: 'leech', pos: l.pos.clone(), food: 1, killed: true }); }
    stun(pos, radius + 0.5, 3, 'angler');
    return got;
  }
  function kill(h) { if (!h || !h.alive) return null; fell(h); return { pos: h.pos.clone() }; }
  function ram(snout, forward, tusk = 0) {
    const got = [];
    for (const m of mines) if (m.alive && m.pos.distanceToSquared(snout) < 0.8 * 0.8) { fell(m); got.push({ kind: 'mine', pos: m.pos.clone(), food: 1 + tusk, killed: true }); } // head first, a drifter just breaks
    for (const l of leeches) if (l.alive && l.state !== 'on' && l.pos.distanceToSquared(snout) < 0.7 * 0.7) { fell(l); got.push({ kind: 'leech', pos: l.pos.clone(), food: 1 + tusk, killed: true }); }
    if (tusk) for (const a of anglers) if (a.alive && a.pos.distanceToSquared(snout) < 1.3 * 1.3) { fell(a); got.push({ kind: 'angler', pos: a.pos.clone(), food: 3, killed: true }); }
    for (const b of biters) if (b.alive && b.pos.distanceToSquared(snout) < 0.85 * 0.85) { b.alive = false; b.mesh.visible = false; got.push({ kind: 'biter', pos: b.pos.clone(), food: (b.lured ? 2 : 1) + tusk, killed: true, baited: !!b.lured }); b.lured = null; } // broken at the bait, it is worth more
    for (const a of anglers) if (a.alive && a.state !== 'stun' && a.pos.distanceToSquared(snout) < 1.3 * 1.3) { a.state = 'stun'; a.t = 3.2; a.vel.copy(forward).multiplyScalar(5); got.push({ kind: 'angler', pos: a.pos.clone(), food: 0, killed: false }); }
    return got;
  }

  // hunters the body has gone round: `ringed(pos, room)` is the game's own test, `room` how wide the hunter is
  function catchWith(ringed) {
    const got = [];
    for (const b of biters) if (b.alive && ringed(b.pos, 0.22)) { b.alive = false; b.mesh.visible = false; got.push({ pos: b.pos.clone(), food: 3, kind: 'biter' }); }
    for (const m of mines) if (m.alive && ringed(m.pos, 0.35)) { fell(m); got.push({ pos: m.pos.clone(), food: 2, kind: 'mine' }); }
    for (const l of leeches) if (l.alive && l.state !== 'on' && ringed(l.pos, 0.18)) { fell(l); got.push({ pos: l.pos.clone(), food: 2, kind: 'leech' }); }
    for (const a of anglers) if (a.alive && ringed(a.pos, 0.72)) { a.alive = false; a.group.visible = false; got.push({ pos: a.pos.clone(), food: 6, kind: 'angler' }); }
    return got;
  }
  function dispose() {
    for (const o of owned) scene.remove(o);
    for (const a of actors) a.dispose();
    for (const m of materials) m.dispose();
  }

  return { update, catchWith, ram, stun, blast, kill, spawnPiece, dispose, state, biters, anglers, hooks, pieces, mines, leeches };
}
