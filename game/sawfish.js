// The Shearer in motion. It is one model (critters.js) that bends (spine.js): the head and saw turn and nod on a neck, the
// body lies along the curve it is swimming and banks into it, and the nose goes up or down with the way it is heading.
// What it is about to do is in how it holds the saw, and in the saw's teeth, which light as it feels a fish:
//   search   the saw tilted down, sweeping slowly from side to side
//   sense    it has felt something: the sweep stops, the saw swings round to it, the teeth come alight and tingle
//   aim      slash: the saw cocked back to one side.  pin: nose down over the tail, the saw wiggling as it lines up
//   charge   slash: the saw whipped across, three swipes in the time it takes to go through.  pin: straight down
//   tired    spent after a slash: saw drooping, teeth dark, rolling a little as it sinks
//   stuck    after a pin: the saw is in the bed and the tail is in the air, thrashing to pull it out
//   stun     rammed: it rocks, and the teeth flicker          down   beaten: belly up, limp, dark
// A real sawfish's saw is both how it finds prey and what it hits it with: prey up in the water gets fast sideways swipes, prey on
// the bottom gets pinned under the saw (Wueringer and others, "The function of the sawfish's saw", Current Biology, 2012).
// guards.js decides which and when; this is only how it looks doing it.
import * as THREE from 'three';
import { bendy } from './spine.js';
import { SHEARER } from './critters.js';
import { clamp, damp } from './geo.js';

const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a)), ease = (t) => t * t * (3 - 2 * t);

// a: the creature as npc.js makes it (a.body is the whole fish, in its swimming material). Returns the rig.
export function sawfishRig(a) {
  const body = a.body, mat = bendy(body.material, { neck: SHEARER.neck }), beat = a.spec.beat;
  const p = { roll: 0, pitch: 0, turn: 0, yawWas: null, hy: 0, hp: 0, curve: 0, glow: 0.4, t: 0, mood: '', whip: 0, swing: 0 }, to = new THREE.Vector3(); // whip: how hard the saw is being swung, and swing: where in the swing it is
  body.rotation.order = 'YXZ';

  // s: where it is and what it is doing.
  //   x, y, z, yaw; speed (over the ground), climb (upward), in metres a second
  //   mood: one of the above; mode: 'slash' | 'pin'; side: 1 | -1, the side the saw is cocked to; k: 0..1 through the mood
  //   look: a point (the fish), or null; time: seconds
  function update(dt, s) {
    p.t += dt;
    const mood = s.mood, pin = s.mode === 'pin', side = s.side || 1, k = clamp(s.k || 0, 0, 1), t = s.time;
    const turn = p.yawWas === null || dt <= 1e-5 ? 0 : clamp(wrapPi(s.yaw - p.yawWas) / dt, -3, 3); p.yawWas = s.yaw;
    p.turn = damp(p.turn, turn, 4, dt);
    // the body: it leans into a turn, lies along the curve of it, and points the way it is going
    let roll = clamp(-p.turn * 0.55, -0.5, 0.5), pitch = -Math.atan2(s.climb || 0, Math.max(s.speed || 0, 2)) * 0.8, curve = clamp(p.turn / (2 * Math.max(s.speed || 0, 2.5)), -0.08, 0.08);
    let hy = clamp(p.turn * 0.3, -0.3, 0.3), hp = 0, glow = 0.4, quick = 8, swim = 1, bodyQuick = 5;
    if (s.look) { to.copy(s.look).sub(body.position); const c = Math.cos(s.yaw), sn = Math.sin(s.yaw); to.set(to.x * c - to.z * sn, to.y, to.x * sn + to.z * c); } // the fish, as the body sees it: +z ahead, +x to its left
    if (mood === 'search') { hy += 0.34 * Math.sin(p.t * 1.15); hp = -0.24; glow = 0.38 + 0.08 * Math.sin(p.t * 2); }
    else if (mood === 'sense') { hy = s.look ? clamp(Math.atan2(to.x, Math.max(to.z, 0.5)), -0.75, 0.75) : 0; hp = s.look ? clamp(Math.atan2(to.y, Math.hypot(to.x, to.z)), -0.4, 0.3) : 0; glow = 1.15 + 0.45 * Math.sin(t * 19); swim = 0.5; quick = 6; }
    else if (mood === 'aim' && pin) { pitch = 1.0 * ease(k); hy = 0.2 * Math.sin(t * 24); hp = -0.08; glow = 1.5 + 0.5 * k; swim = 1.4; bodyQuick = 7; } // over the tail, lining the saw up on it
    else if (mood === 'aim') { hy = -0.85 * side * ease(k); hp = 0.06; roll += 0.22 * side * k; glow = 1.5 + 0.5 * k; swim = 0.7; }
    else if (mood === 'charge' && pin) { pitch = 1.15; hy = 0.1 * Math.sin(t * 34); glow = 2.3; swim = 2.2; quick = 30; bodyQuick = 14; }
    else if (mood === 'charge') { glow = 2.3; swim = 2.2; } // the saw is whipped across: see below
    else if (mood === 'tired') { hy = 0.16 * Math.sin(p.t * 0.9); hp = -0.42; roll += 0.14 * Math.sin(p.t * 0.7); pitch = 0.12; glow = 0.1; swim = 0.45; quick = 3; }
    else if (mood === 'stuck') { pitch = 0.78 + 0.05 * Math.sin(t * 11); hp = 0.42; hy = 0.07 * Math.sin(t * 11); curve = 0.06 * Math.sin(t * 11); roll = 0.16 * Math.sin(t * 9); glow = 0.1; swim = 3; quick = 16; bodyQuick = 9; }
    else if (mood === 'stun') { roll = 0.35 * Math.sin(t * 16); hy = 0.25 * Math.sin(t * 13); hp = -0.2; glow = 0.6 + 0.6 * Math.sin(t * 40); swim = 0.3; quick = 20; bodyQuick = 30; }
    else if (mood === 'down') { roll = 2.7; pitch = 0.18; hy = 0.12; hp = -0.3; curve = 0.03; glow = 0; swim = 0.27; quick = 2; bodyQuick = 2.4; }
    // the slash: from where it was cocked, across and back, three times a second, as a sawfish swipes; it swings on a moment after the blow has landed
    if (mood === 'charge' && !pin) { if (p.mood !== 'charge') p.swing = 0; p.whip = 1; } else p.whip *= Math.exp(-5 * dt);
    p.swing += dt * 18.85; p.mood = mood;
    if (p.whip > 0.02) { const w = Math.cos(p.swing) * p.whip; hy = hy * (1 - p.whip) - 0.9 * side * w; roll += 0.3 * side * w; quick = 40; }
    p.roll = damp(p.roll, roll, bodyQuick, dt); p.pitch = damp(p.pitch, pitch, bodyQuick, dt); p.curve = damp(p.curve, curve, bodyQuick, dt);
    p.hy = damp(p.hy, hy, quick, dt); p.hp = damp(p.hp, hp, quick, dt); p.glow = damp(p.glow, glow, mood === 'sense' || mood === 'stun' ? 30 : 6, dt);
    body.position.set(s.x, s.y, s.z); body.rotation.set(p.pitch, s.yaw, p.roll);
    mat.userData.head.set(p.hy, p.hp); mat.userData.curve.value = p.curve; mat.userData.glow.value = p.glow;
    mat.userData.swim.value += dt * (beat[0] + beat[1] * (s.speed || 0)) * swim;
  }
  // on the stand in the library: each mood, the ones with a beginning and an end played over and over
  const stand = { time: 0, look: new THREE.Vector3() };
  function show(dt, state, speed) {
    stand.time += dt;
    const sc = body.scale.x, id = state.id, loop = (secs) => (stand.time % secs) / secs, pin = id === 'pin' || id === 'stuck';
    stand.look.set(Math.sin(stand.time * 0.6) * 5 * sc, -1 * sc, 6 * sc);
    let mood = id === 'idle' ? 'search' : id === 'pin' ? 'aim' : id, k = 0, y = 0;
    if (id === 'aim') k = Math.min(1, loop(2.2) * 1.6);
    if (id === 'charge') { const u = loop(2.4); mood = u < 0.35 ? 'aim' : u < 0.7 ? 'charge' : 'tired'; k = u < 0.35 ? u / 0.35 : (u - 0.35) / 0.35; }
    if (id === 'pin') { const u = loop(2.8); mood = u < 0.4 ? 'aim' : u < 0.52 ? 'charge' : 'stuck'; k = u < 0.4 ? u / 0.4 : 1; y = (u < 0.4 ? 1.6 * ease(u / 0.4) : u < 0.52 ? 1.6 * (1 - (u - 0.4) / 0.12) : 0) * sc; }
    update(dt, { x: 0, y, z: 0, yaw: 0, speed: speed * sc, climb: 0, mood, mode: pin ? 'pin' : 'slash', side: 1, k, look: stand.look, time: stand.time });
  }
  a.rig = { update, show, pose: p, get head() { return mat.userData.head; }, get glow() { return mat.userData.glow.value; } };
  return a.rig;
}
