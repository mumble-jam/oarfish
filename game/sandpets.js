// How the creatures of the sand flat live when the pause menu's testing tool brings them ("Bring one to look at"). This is not their behaviour
// in the dive, which has not been decided: it is only enough life for each model to be seen where it would live, beside the fish, doing the
// things its poses are for. Nothing here is a rule, nothing is harmed, and nothing is kept.
//   hermit      a short line of four, smallest to biggest, by an empty shell a size up: the biggest feels the shell, the others hold on to the shell
//               ahead. A body coming within a couple of metres sends them in; when it has gone they peer out, and then come out again.
//   trumpet     hangs head-down by the fish while it is still; when the fish swims, it comes and lies close along its body and goes with it,
//               and now and then darts out ahead and strikes at nothing
//   burrow      the goby on watch at its hole and the shrimp working; a body near makes the goby flick, nearer sends both down the hole
//   gardeneel   a colony of them in a patch of sand, each in its own hole, facing the current; they sink as a body comes near and rise again after
//   puffer      over its finished circle, ploughing in along a valley and out again; a body very near and it puffs up
//   sandcircle  three circles side by side, at three stages of building
//   octopus     (and the Mason, the same at keeper size) not a sand flat creature, but brought the same way, since it lives on the bed: it rests in a den
//               of stones watching the fish, crawls off over the bed, reaches for a stone or a shell, walks with it under its web, goes dark and
//               throws it (away from the fish), and rests again; a fish that comes at it fast sends it jetting off, pale. In no band yet
// main.js calls bringSand(id, ctx) and then pet.step(dt) every frame, and pet.dispose() to take it away. ctx: { make, scene, rig, wrapD, world, time }.
import * as THREE from 'three';
import { HERMIT, CIRCLE } from './critters.js';
import { clamp, damp, lerp } from './geo.js';

export const SAND_PETS = {
  hermit: { here: 'A line of four hermit crabs, smallest to biggest, is on the sand just ahead of you, by an empty shell. They are only to look at.', gone: 'The hermit crabs are gone.' },
  trumpet: { here: 'A trumpetfish is in the water just ahead of you. Swim, and it comes to lie along your body. It is only to look at.', gone: 'The trumpetfish is gone.' },
  burrow: { here: 'A shrimp goby and its pistol shrimp are at their hole in the sand just ahead of you. Come near slowly. They are only to look at.', gone: 'The goby and the shrimp are gone.' },
  gardeneel: { here: 'A colony of garden eels is in the sand just ahead of you. They sink as you come near. They are only to look at.', gone: 'The garden eels are gone.' },
  puffer: { here: 'A white-spotted puffer is over its sand circle just ahead of you. It is only to look at.', gone: 'The puffer and its circle are gone.' },
  sandcircle: { here: 'Three puffer circles are in the sand just ahead of you, at three stages of building. They are only to look at.', gone: 'The circles are gone.' },
  octopus: { here: 'An octopus is on the bed just ahead of you, in its den. Watch it a while: it crawls, takes a stone, and throws it. Come at it fast and it jets off. It is only to look at.', gone: 'The octopus is gone.' },
  mason: { here: 'The Mason, an octopus at keeper size, is on the bed just ahead of you, in its den. It is only to look at.', gone: 'The Mason is gone.' },
};
const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// how near the nearest part of the fish's body is to (x, z), across the bed
function nearest(ctx, x, z) { let d = Infinity; for (const j of ctx.rig.joints) d = Math.min(d, Math.hypot(ctx.wrapD(j.x - x), ctx.wrapD(j.z - z))); return d; }
// a spot on the bed ahead of the fish and to one side, and the way across its path there
function spot(ctx, ahead, aside) {
  const r = ctx.rig, l = Math.hypot(r.forward.x, r.forward.z) || 1, fx = r.forward.x / l, fz = r.forward.z / l;
  return { x: r.pos.x + fx * ahead + fz * aside, z: r.pos.z + fz * ahead - fx * aside, fx, fz, ax: fz, az: -fx };
}

// A patch of sand laid on the bed: tilted to the slope the bed has under it, and raised by as much as the bed rises over that slope anywhere in it,
// so that none of it is buried (its edge is sunk, and goes under the bed where the bed is low). yaw: its turn about its own up.
function settle(ctx, object, x, z, R, yaw = 0) {
  const w = ctx.world, pts = [[0, 0]]; for (const r of [R * 0.5, R]) for (let i = 0; i < 8; i++) pts.push([Math.cos(i * 0.785) * r, Math.sin(i * 0.785) * r]);
  let n = 0, sx = 0, sz = 0, sy = 0, sxx = 0, szz = 0, sxz = 0, sxy = 0, szy = 0; const ys = pts.map(([u, v]) => w.drawn(x + u, z + v));
  pts.forEach(([u, v], i) => { const y = ys[i]; n++; sx += u; sz += v; sy += y; sxx += u * u; szz += v * v; sxz += u * v; sxy += u * y; szy += v * y; });
  const Sxx = sxx - sx * sx / n, Szz = szz - sz * sz / n, Sxz = sxz - sx * sz / n, Sxy = sxy - sx * sy / n, Szy = szy - sz * sy / n, det = Sxx * Szz - Sxz * Sxz || 1;
  const b = (Sxy * Szz - Szy * Sxz) / det, c = (Szy * Sxx - Sxy * Sxz) / det, a = (sy - b * sx - c * sz) / n;
  let over = 0; pts.forEach(([u, v], i) => { if (u * u + v * v < R * R * 0.6) over = Math.max(over, ys[i] - (a + b * u + c * v)); }); // (the edge may go under)
  object.position.set(x, a + over + 0.008, z);
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-b, 1, -c).normalize()).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw));
  object.updateMatrixWorld(true); return object.position;
}
export function bringSand(id, ctx) { return MAKERS[id](ctx); }
const MAKERS = {
  hermit(ctx) {
    const w = ctx.world, ground = (p) => { p.y = w.drawn(p.x, p.z); return p; }, at = spot(ctx, 5, 1.5), sizes = HERMIT.sizes, kinds = ['snail', 'spire', 'coil', 'snail'];
    // along a line across the fish's path, the biggest nearest the empty shell, each facing the one ahead of it
    const yaw = Math.atan2(at.ax, at.az); let d = 0;
    const list = sizes.map((k, i) => { const a = ctx.make('hermit'); a.object.scale.setScalar(k); a.rig.wear(kinds[i]); ctx.scene.add(a.object);
      if (i) d += 0.24 * (k + sizes[i - 1]); const pos = new THREE.Vector3(at.x + at.ax * d, 0, at.z + at.az * d); return { a, k, pos, mood: 'pick', t: 1 + i, away: 9, n: i }; });
    const big = list[list.length - 1], end = d + 0.19 * big.k;
    const empty = { x: at.x + at.ax * end, z: at.z + at.az * end }; big.a.rig.lay(big.a.rig.shells[1], 'horn', empty.x, empty.z, yaw + Math.PI, ground, 1.3);
    const look = new THREE.Vector3(), grip = new THREE.Vector3();
    return { list, centre: new THREE.Vector3(at.x + at.ax * d * 0.6, w.drawn(at.x + at.ax * d * 0.6, at.z + at.az * d * 0.6) + 0.2, at.z + at.az * d * 0.6),
      step(dt) { const t = ctx.time;
        list.forEach((s, i) => { const near = nearest(ctx, s.pos.x, s.pos.z); s.away = near < 2.2 + 0.4 * s.k ? 0 : s.away + dt; // a body within a couple of metres, and it is in
          const inn = s.away < 2.5, peer = inn && s.away > 0.6; let act = null, aim = null;
          if (!inn) { if (s === big) { act = 'probe'; aim = grip.set(empty.x - at.ax * 0.12 * s.k, w.drawn(empty.x, empty.z) + 0.03, empty.z - at.az * 0.12 * s.k); } else { const ahead = list[i + 1]; act = Math.sin(t * 0.3 + i * 2) > -0.3 ? 'hold' : 'pick'; aim = grip.copy(ahead.a.object.position).addScaledVector(new THREE.Vector3(at.ax, 0, at.az), -0.16 * ahead.k); } }
          const j = ctx.rig.joints[0]; look.set(j.x, j.y, j.z);
          s.a.rig.update(dt, { x: s.pos.x, z: s.pos.z, yaw, vx: 0, vz: 0, ground, time: t + i * 1.7, in: inn, peer, act, look: peer ? look : null, at: aim }); }); },
      dispose() { for (const s of list) { ctx.scene.remove(s.a.object); s.a.dispose(); } } };
  },
  trumpet(ctx) {
    const a = ctx.make('trumpet'); ctx.scene.add(a.object); const r = ctx.rig, at = spot(ctx, 4, 2.5);
    const s = { a, pos: new THREE.Vector3(at.x, ctx.world.drawn(at.x, at.z) + 1.6, at.z), yaw: 0, pitch: 1.2, roll: 0, curve: 0, mood: 'hang', was: r.pos.clone(), speed: 0, strike: 0, next: 6, side: 1 };
    const D = new THREE.Vector3(), N = new THREE.Vector3(), want = new THREE.Vector3();
    return { list: [s], get centre() { return s.pos; },
      step(dt) { const J = r.joints, n = J.length, w = ctx.world, t = ctx.time;
        s.speed = damp(s.speed, dt > 0 ? r.pos.distanceTo(s.was) / dt : 0, 2, dt); s.was.copy(r.pos);
        if (Math.hypot(ctx.wrapD(r.pos.x - s.pos.x), ctx.wrapD(r.pos.z - s.pos.z)) > 30) s.pos.set(r.pos.x + 3, r.pos.y, r.pos.z + 3); // left far behind: it is there again
        let mood = 'hang', yaw = s.yaw, pitch = 1.2, roll = 0.05 * Math.sin(t * 0.4), curve = 0;
        if (s.speed > 1.1 && n > 6) { // the fish is swimming: it lies along it, a third of the way back, on one side, and goes with it
          const i = Math.max(2, Math.round(n * 0.32)); D.subVectors(J[i - 2], J[i + 2]).setY(0).normalize(); N.set(D.z, 0, -D.x).multiplyScalar(s.side);
          want.copy(J[i]).addScaledVector(N, 0.62).addScaledVector(D, 0.1); want.y += 0.22; yaw = Math.atan2(D.x, D.z); pitch = -0.05; mood = 'shadow'; roll = -0.3 * s.side;
          const a1 = Math.atan2(J[i - 3].x - J[i].x, J[i - 3].z - J[i].z), a2 = Math.atan2(J[i].x - J[i + 3].x, J[i].z - J[i + 3].z); curve = clamp(Math.atan2(Math.sin(a1 - a2), Math.cos(a1 - a2)) * 0.5, -0.4, 0.4); // bent to the body's curve
          if ((s.next -= dt) <= 0) { s.strike = 0.9; s.next = 7 + 4 * Math.random(); } // and now and then darts out ahead and strikes
          if (s.strike > 0) { s.strike -= dt; mood = s.strike > 0.55 ? 'stalk' : 'strike'; want.addScaledVector(D, s.strike < 0.55 ? 0.9 * Math.sin(Math.PI * s.strike / 0.55) : 0); }
          s.pos.lerp(want, 1 - Math.exp(-(s.strike > 0 && s.strike < 0.55 ? 12 : 4) * dt)); }
        else { want.set(r.pos.x - r.forward.z * 2.2, Math.max(w.drawn(s.pos.x, s.pos.z) + 1.2, r.pos.y + 0.3), r.pos.z + r.forward.x * 2.2); s.pos.lerp(want, 1 - Math.exp(-0.5 * dt)); yaw = s.yaw + 0.2 * dt * Math.sin(t * 0.2); } // still: it hangs head down near by
        s.yaw += clamp(Math.atan2(Math.sin(yaw - s.yaw), Math.cos(yaw - s.yaw)), -2.5 * dt, 2.5 * dt); s.pitch = damp(s.pitch, pitch, 2, dt); s.roll = damp(s.roll, roll, 3, dt); s.curve = damp(s.curve, curve, 4, dt);
        a.rig.update(dt, { x: s.pos.x, y: s.pos.y, z: s.pos.z, yaw: s.yaw, pitch: s.pitch, roll: s.roll, mood, curve: s.curve }); },
      dispose() { ctx.scene.remove(a.object); a.dispose(); } };
  },
  burrow(ctx) {
    const a = ctx.make('burrow'), at = spot(ctx, 7, 1), w = ctx.world; ctx.scene.add(a.object); settle(ctx, a.object, at.x, at.z, 0.35, Math.atan2(-at.fx, -at.fz) + 0.6); // the goby looks back toward where the fish came from
    const inv = new THREE.Matrix4().copy(a.object.matrixWorld).invert(), look = new THREE.Vector3();
    const s = { a, pos: a.object.position, mood: 'work', k: 0, away: 9, down: 0 };
    return { list: [s], centre: a.object.position,
      step(dt) { const d = nearest(ctx, s.pos.x, s.pos.z); s.away = d < 4 ? 0 : s.away + dt;
        if (d < 2.2 && s.mood !== 'gone') { s.mood = 'gone'; s.k = 0; } // near: both go down, the goby head first
        if (s.mood === 'gone') { s.k = s.k < 0.6 || s.away > 4 ? Math.min(1, s.k + dt / 7) : 0.6; if (s.k >= 1) { s.mood = 'watch'; s.k = 0; s.down = 3; } } // and stay down till it has been gone a while
        else if (d < 4) s.mood = 'flick'; // a body about: the goby flicks, and the shrimp stays in
        else if ((s.down -= dt) > 0) s.mood = 'watch'; else { if (s.mood !== 'work') s.k = 0; s.mood = 'work'; s.k = (s.k + dt / 6) % 1; }
        const j = ctx.rig.joints[0]; look.copy(j).applyMatrix4(inv);
        a.rig.update(dt, { mood: s.mood, k: s.k, time: ctx.time, look }); },
      dispose() { ctx.scene.remove(a.object); a.dispose(); } };
  },
  gardeneel(ctx) {
    const a = ctx.make('gardeneel'), at = spot(ctx, 6, 0), w = ctx.world; ctx.scene.add(a.object); const P = settle(ctx, a.object, at.x, at.z, 2.1);
    return { list: [{ a, pos: P }], centre: P,
      step(dt) { a.rig.update(dt, { time: ctx.time, flow: 0.3, yaw: 0.6, want: (i, e) => clamp((nearest(ctx, P.x + e.x, P.z + e.z) - 1.6) / 1.4, 0, 1) }); }, // within two or three metres of any part of the body, it sinks
      dispose() { ctx.scene.remove(a.object); a.dispose(); } };
  },
  puffer(ctx) {
    const c = ctx.make('sandcircle'), f = ctx.make('puffer'), at = spot(ctx, 6, 1.5), w = ctx.world; ctx.scene.add(c.object, f.object);
    settle(ctx, c.object, at.x, at.z, CIRCLE.R + 0.1); c.rig.update(0, { stage: 1 });
    const C = c.object.position, s = { a: f, pos: new THREE.Vector3(), lane: 0, q: 0, puffed: 0 };
    const ridge = (n) => ((n + 0.5) / CIRCLE.ridges) * Math.PI * 2; // the middle of a valley
    return { list: [s], centre: C, circle: c,
      step(dt) { const t = ctx.time; s.q += dt / 9; if (s.q >= 1) { s.q = 0; s.lane = (s.lane + 7) % CIRCLE.ridges; }
        // along a valley from the edge in, belly down; a moment stirring the middle; and back out over the ridges to the next
        const a = ridge(s.lane), R = CIRCLE.R + 0.1, rc = CIRCLE.middle; let r, y, mood, yaw;
        if (s.q < 0.45) { r = lerp(R, rc, s.q / 0.45); y = 0.05; mood = 'plough'; yaw = Math.atan2(-Math.cos(a), -Math.sin(a)); }
        else if (s.q < 0.65) { r = rc * 0.5; y = 0.06; mood = 'stir'; yaw = Math.atan2(-Math.cos(a), -Math.sin(a)) + 0.6 * Math.sin(t * 0.8); }
        else { r = lerp(rc * 0.5, R + 0.2, (s.q - 0.65) / 0.35); y = 0.3; mood = 'swim'; yaw = Math.atan2(Math.cos(a), Math.sin(a)); }
        s.pos.set(Math.cos(a) * r, y, Math.sin(a) * r).applyMatrix4(c.object.matrixWorld); const x = s.pos.x, z = s.pos.z; // on the circle as it lies
        if (nearest(ctx, x, z) < 1.6 && Math.abs(ctx.rig.pos.y - s.pos.y) < 2.5) s.puffed = 3; if ((s.puffed -= dt) > 0) { mood = 'puffed'; s.pos.y += 0.3; } // a body right by it, and it puffs up
        f.rig.update(dt, { x: s.pos.x, y: s.pos.y, z: s.pos.z, yaw, mood }); },
      dispose() { ctx.scene.remove(c.object, f.object); c.dispose(); f.dispose(); } };
  },
  sandcircle(ctx) {
    const at = spot(ctx, 7, 0), w = ctx.world, list = [0.15, 0.45, 1].map((stage, i) => { const a = ctx.make('sandcircle'), d = (i - 1) * 3.3, x = at.x + at.ax * d, z = at.z + at.az * d; ctx.scene.add(a.object); settle(ctx, a.object, x, z, CIRCLE.R + 0.1); a.rig.update(0, { stage }); return { a, pos: a.object.position }; });
    return { list, centre: list[1].pos, step() {}, dispose() { for (const s of list) { ctx.scene.remove(s.a.object); s.a.dispose(); } } };
  },
  octopus: (ctx) => octoPet(ctx, 'octopus'),
  mason: (ctx) => octoPet(ctx, 'mason'),
};

// The octopus brought to look at: a round of what it does, each for a while (ACTS), and a jet away from a fish that comes at it fast.
// force(mood) starts that act at once (for the tools that photograph it).
const OCTO_ACTS = { den: 7, crawl: 7, reach: 3.4, carry: 4.5, throw: 4.4, jet: 2.6 }, OCTO_NEXT = { den: 'crawl', crawl: 'reach', reach: 'carry', carry: 'throw', throw: 'den', jet: 'den' };
function octoPet(ctx, id) {
  const a = ctx.make(id), R = a.rig, w = ctx.world, sz = R.pose.size, fish = ctx.rig, ground = (x, z) => w.drawn(x, z), at = spot(ctx, 4 + 6 * sz, 1.2 + 2 * sz);
  ctx.scene.add(a.object);
  const S = { x: at.x, z: at.z, y: 0, yaw: Math.atan2(-at.fx, -at.fz), mood: 'den', t: 0, k: 0, to: { x: 0, z: 0 }, n: 0, rise: 0, skin: '' }, body = { x: 0, y: 0, z: 0 }, watch = new THREE.Vector3();
  const toFish = () => Math.atan2(ctx.wrapD(fish.pos.x - S.x), ctx.wrapD(fish.pos.z - S.z));
  function start(mood) {
    S.mood = mood; S.t = 0; S.k = 0; S.n++; S.skin = '';
    if (mood === 'den') R.den(S.x, S.z, S.yaw); else R.den(null);
    if (mood === 'crawl') { const a0 = toFish() + Math.PI + (S.n % 2 ? 1.1 : -1.1), r = 2.5 + 1.5 * sz; S.to.x = S.x + Math.sin(a0) * r; S.to.z = S.z + Math.cos(a0) * r; }
    if (mood === 'reach') { const ang = S.yaw + R.arms[0].def.angle, d = 2.1 * sz; R.lay(S.x + Math.sin(ang) * d, S.z + Math.cos(ang) * d, S.n % 2 ? 'shell' : 'stone'); }
    if (mood === 'throw') { S.yaw = toFish() + Math.PI + 0.5; if (R.thing.state === 'none') R.hold(); } // it throws away from the fish
    if (mood === 'jet') { S.yaw = toFish(); S.rise = 0; R.drop(); } // facing the fish, so that it goes mantle first away from it
    if (mood === 'den' || mood === 'crawl') R.drop();
  }
  start('den');
  return { list: [{ a }], body, get centre() { return { x: S.x, z: S.z }; },
    force(mood) { start(mood); },
    place(x, z, yaw = S.yaw) { S.x = x; S.z = z; S.yaw = yaw; start(S.mood); }, // (for the tools that photograph it)
    step(dt) {
      S.t += dt; const T = OCTO_ACTS[S.mood], dx = ctx.wrapD(fish.pos.x - S.x), dz = ctx.wrapD(fish.pos.z - S.z), far = Math.hypot(dx, dz);
      if (far > 40) { const p = spot(ctx, 4 + 6 * sz, 1.2 + 2 * sz); S.x = p.x; S.z = p.z; start('den'); } // the fish has gone a long way, or down a rift: it is there again
      // a fish coming at it fast: blanch, and jet off
      const speed = fish.speed ?? 0; if (S.mood !== 'jet' && far < 1.6 + 1.2 * sz && speed > 3) start('jet');
      const turn = (want, rate) => { S.yaw += clamp(wrapPi(want - S.yaw), -rate * dt, rate * dt); };
      if (S.mood === 'den') turn(toFish(), 0.3);
      else if (S.mood === 'crawl' || S.mood === 'carry') { if (S.mood === 'crawl') { const tx = S.to.x - S.x, tz = S.to.z - S.z, d = Math.hypot(tx, tz); if (d < 0.2) S.t = T; else turn(Math.atan2(tx, tz), 0.9); }
        const v = (S.mood === 'carry' ? 0.5 : 1.1) * sz * Math.min(1, S.t / 0.8); S.x += Math.sin(S.yaw) * v * dt; S.z += Math.cos(S.yaw) * v * dt; } // (in mantle lengths a second)
      else if (S.mood === 'jet') { const q = R.pose.jet, v = 9 * sz * (0.3 + 1.2 * (q < 0.22 ? q / 0.22 : Math.exp(-(q - 0.22) * 4))); S.x -= Math.sin(S.yaw) * v * dt; S.z -= Math.cos(S.yaw) * v * dt; S.rise = Math.min(1, S.rise + dt * 1.5) * (S.t > T - 0.8 ? Math.max(0, (T - S.t) / 0.8) : 1); S.skin = S.t < 0.5 ? 'blanched' : ''; }
      S.k = Math.min(1, S.t / T);
      if (S.t >= T) { if (S.mood === 'carry') R.hold(); start(OCTO_NEXT[S.mood]); }
      S.x = fish.pos.x - ctx.wrapD(fish.pos.x - S.x); S.z = fish.pos.z - ctx.wrapD(fish.pos.z - S.z); // the nearest copy of the world to the fish
      const bed = ground(S.x, S.z), y = S.mood === 'jet' ? bed + sz * (0.6 + 3.4 * S.rise) : undefined;
      watch.set(fish.pos.x, fish.pos.y, fish.pos.z);
      R.update(dt, { x: S.x, y, z: S.z, yaw: S.yaw, mood: S.mood, k: S.k, ground, watch, skin: S.skin });
      const o = a.object.children[0].position; body.x = o.x; body.y = o.y; body.z = o.z;
    },
    dispose() { ctx.scene.remove(a.object); a.dispose(); } };
}
