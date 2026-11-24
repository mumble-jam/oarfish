// Legs that walk by themselves. A walker is a body with legs hung on it. Each foot is planted on the ground and stays where it
// is while the body moves on over it; when the body has left it too far behind, it lifts, swings to where it would rather be,
// and plants again. The legs step in two groups, turn about, so there are always feet on the ground. The body then rides on
// its feet: its height is theirs, its tilt is the slope of the ground they stand on, both on a spring, so it sways and settles.
// Nothing here knows what animal it is. critters.js gives the pieces and the measures; crab.js puts the Keeper together.
//
// Everything is worked in the space of the body's parent (the world, in a dive; the stand, in the specimen library), and
// the legs themselves are posed in the body's own space, so a body may be any size and may tilt, and its feet stay put.
import * as THREE from 'three';
import { clamp, lerp } from './geo.js';

const A = new THREE.Vector3(), B = new THREE.Vector3(), X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3(), M = new THREE.Matrix4();

// The middle joint of a limb of two rigid lengths, hung at `root` and reaching for `tip`; it bends toward `pole`. The knee is
// returned in `out`. A tip out of reach (or too close in) is brought to where the limb can put it, and `tip` is changed to say so.
export function twoBone(root, tip, l1, l2, pole, out) {
  A.subVectors(tip, root); const d = A.length();
  if (d < 1e-5) A.set(0, -1, 0); else A.multiplyScalar(1 / d);
  const dd = clamp(d, Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
  if (dd !== d) tip.copy(root).addScaledVector(A, dd);
  const a = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  B.copy(pole).addScaledVector(A, -pole.dot(A));
  if (B.lengthSq() < 1e-8) B.set(0, 1, 0).addScaledVector(A, -A.y);
  B.normalize();
  return out.copy(root).addScaledVector(A, a).addScaledVector(B, h);
}
// Lay a piece that is modelled along +z from `from` toward `to`, with its top (+y) as near `up` as it will go.
export function lay(piece, from, to, up) {
  Z.subVectors(to, from).normalize(); X.crossVectors(up, Z);
  if (X.lengthSq() < 1e-8) X.set(1, 0, 0);
  X.normalize(); Y.crossVectors(Z, X);
  piece.quaternion.setFromRotationMatrix(M.makeBasis(X, Y, Z)); piece.position.copy(from);
}
// a value on a spring: f turns a second, z how soon it stops swinging (1: it does not swing at all)
function spring(o, key, to, f, z, dt) {
  const w = 6.2832 * f, vel = `${key}V`;
  for (let left = dt; left > 1e-5; left -= 1 / 60) { const h = Math.min(left, 1 / 60); o[vel] += (w * w * (to - o[key]) - 2 * z * w * o[vel]) * h; o[key] += o[vel] * h; }
}

// object: the group the body and its legs are in. legs: [{ hip: Vector3, rest: { x, z }, side: 1 | -1, group: 0 | 1, upper, lower:
// the two pieces, modelled along +z, l1, l2: their lengths, curl: Vector3, where the foot goes when the animal is done for }],
// all in the body's own space. ride: how far the body's origin is carried over the ground under its feet.
// A leg may be marked `lame` (it carries nothing and is dragged, its foot trailing a little wide of where it stood) or `gone` (it is not there: whoever
// took it has its pieces). The body sags toward either, since the plane it rides on is taken a little low where they were.
// A leg may have a third length, `l3`, and a third piece, `last`: a tip that hangs straight down from the ankle to the foot (the Keeper's spike).
// And a leg may be taken over (`ctrl`, a point in the parent's space): its foot goes there and stays, and carries no weight, until `ctrl` is let go,
// and then it stands where it was left. That is how a leg is lifted to stomp, held up, stabbed down, or dragged by a body wound round it.
//   stride  how far the body may leave a foot behind before the foot steps     swing  how long a step takes, at most
//   lift    how high a foot comes off the ground                               lead   how far ahead of itself a moving body puts a foot, in seconds
export function createWalker(object, legs, { ride, stride = 0.6, swing = 0.19, lift = 0.42, lead = 0.2, freq = 2.3, ease = 0.55 } = {}) {
  object.rotation.order = 'YXZ';
  const L = legs.map((l, i) => ({ ...l, foot: new THREE.Vector3(), from: new THREE.Vector3(), to: new THREE.Vector3(), t: -1, dur: swing, wait: 0,
    odd: 0.86 + 0.28 * ((i * 0.618034) % 1), knee: new THREE.Vector3(), tip: new THREE.Vector3(), ankle: new THREE.Vector3(), ctrl: null, pole: new THREE.Vector3(l.side * 0.5, 1, 0), lame: false, gone: false })); // odd: no two legs step at quite the same distance
  const body = { y: 0, yV: 0, pitch: 0, pitchV: 0, roll: 0, rollV: 0, x: 0, z: 0, set: false, idle: 1.5, clock: 0, ground: 0, steps: 0, slope: [0, 0] };
  const home = new THREE.Vector3(), inv = new THREE.Matrix4(), busy = [0, 0], UPL = new THREE.Vector3();
  // the ankle of a three-length leg: straight up from the foot as the world has it (the spike stands upright), a little in toward the body
  const ankleOf = (l, out) => { UPL.set(0, 1, 0).transformDirection(inv); return out.copy(l.tip).addScaledVector(UPL, l.l3).add(A.set(-l.side * 0.12 * l.l3, 0, 0)); };
  let seed = 7; const chance = () => (seed = (seed * 16807) % 2147483647) / 2147483647; // which leg fidgets is nobody's business but the walker's

  // s: where the body is and what it is doing, in the parent's space.
  //   x, z, yaw; vx, vz: how it is moving; ground(p): sets p.y to the ground under p (and may move p off something it cannot stand on)
  //   treadmill: the body stays where it is and the ground goes by under it at -v (the library)
  //   crouch 0..1: belly to the ground    tuck 0..1: feet drawn in under the shell    limp 0..1: legs curled, done for
  //   raise, pitch, roll: added to where the feet put the body    floor: the top of whatever is right under the body, which its belly clears
  function update(dt, s) {
    const sc = object.scale.x, c = Math.cos(s.yaw), sn = Math.sin(s.yaw), vx = s.vx || 0, vz = s.vz || 0, speed = Math.hypot(vx, vz);
    const tuck = s.tuck || 0, limp = s.limp || 0, pull = lerp(1, 0.7, tuck), reach = stride * sc, k = Math.min(lead, (0.9 * reach) / (speed + 1e-4));
    const place = (l, out, ahead) => { const rx = l.rest.x * pull * sc, rz = l.rest.z * pull * sc; out.set(s.x + rx * c + rz * sn + vx * k * ahead, 0, s.z - rx * sn + rz * c + vz * k * ahead); s.ground(out); return out; };
    body.clock += dt;
    // put down for the first time, or picked up and put somewhere else (the world is a torus; the checks move things about)
    let fresh = !body.set;
    if (fresh) for (const l of L) { place(l, l.foot, 0); l.t = -1; }
    else if (Math.hypot(s.x - body.x, s.z - body.z) > 5 * sc) { const dx = s.x - body.x, dz = s.z - body.z; fresh = true; for (const l of L) { l.foot.x += dx; l.foot.z += dz; l.from.x += dx; l.from.z += dz; if (l.t < 0) s.ground(l.foot); } }
    body.x = s.x; body.z = s.z; body.set = true;

    busy[0] = busy[1] = 0; for (const l of L) if (l.t >= 0 && !l.lame && !l.gone) busy[l.group]++;
    body.idle -= dt;
    for (const l of L) {
      if (limp >= 1 || l.gone) { l.t = -1; continue; }
      if (l.ctrl) { l.t = -1; l.foot.lerp(l.ctrl, 1 - Math.exp(-(l.ctrlRate || 12) * dt)); continue; } // taken over: where it is told
      place(l, home, 0); // where this foot would stand if the body had always been here
      if (l.lame) { l.t = -1; home.x = s.x + (home.x - s.x) * 1.16; home.z = s.z + (home.z - s.z) * 1.16; s.ground(home); l.foot.lerp(home, 1 - Math.exp(-2.2 * dt)); l.foot.y = home.y; continue; } // dragged after the body
      if (l.t < 0) {
        if (s.treadmill) { l.foot.x -= vx * dt; l.foot.z -= vz * dt; }
        l.wait -= dt;
        const off = Math.hypot(l.foot.x - home.x, l.foot.z - home.z), far = reach * l.odd * (tuck > 0.5 ? 0.3 : 1);
        let go = off > far && l.wait <= 0 && (busy[1 - l.group] === 0 || off > far * 1.9); // its turn, unless it is being dragged
        if (!go && speed < 0.12 * sc && body.idle <= 0 && busy[0] + busy[1] === 0 && chance() < 0.3) { go = true; body.idle = 1.2 + 2.6 * chance(); } // standing, it shifts a foot now and then
        if (go) { l.t = 0; l.from.copy(l.foot); l.dur = clamp(reach / (speed * 2.4 + 1e-4), 0.1, swing); busy[l.group]++; }
      }
      if (l.t >= 0) {
        l.t += dt / l.dur; place(l, l.to, 1); // it keeps aiming for where it would rather be until it gets there
        if (l.t >= 1) { l.foot.copy(l.to); l.t = -1; l.wait = 0.05; body.yV -= 0.2 * sc; body.steps++; }
        else { const e = l.t * l.t * (3 - 2 * l.t); l.foot.lerpVectors(l.from, l.to, e); l.foot.y += Math.sin(Math.PI * l.t) * lift * sc * (0.7 + 0.5 * clamp(Math.abs(l.to.y - l.from.y) / sc, 0, 1)); }
      }
    }
    // the ground the feet are on, as a plane: its height under the body, and how it slopes across the body and along it
    let n = 0, sx = 0, sz = 0, sy = 0, sxx = 0, szz = 0, sxz = 0, sxy = 0, szy = 0;
    for (const l of L) { let y = l.t < 0 ? l.foot.y : lerp(l.from.y, l.to.y, l.t); const x = l.rest.x * sc, z = l.rest.z * sc; if (l.gone) y = place(l, home, 0).y - 0.5 * sc; else if (l.ctrl) y = place(l, home, 0).y - 0.2 * sc; else if (l.lame) y -= 0.28 * sc; n++; sx += x; sz += z; sy += y; sxx += x * x; szz += z * z; sxz += x * z; sxy += x * y; szy += z * y; }
    const Sxx = sxx - sx * sx / n, Szz = szz - sz * sz / n, Sxz = sxz - sx * sz / n, Sxy = sxy - sx * sy / n, Szy = szy - sz * sy / n, det = Sxx * Szz - Sxz * Sxz || 1;
    const across = (Sxy * Szz - Szy * Sxz) / det, along = (Szy * Sxx - Sxy * Sxz) / det, under = (sy - across * sx - along * sz) / n;
    body.ground = under; body.slope[0] = across; body.slope[1] = along;
    const vxl = (vx * c - vz * sn) / sc, vzl = (vx * sn + vz * c) / sc, up = 1 - limp; // how it is moving, as the body sees it: it leans a little into the way it goes
    const toY = under + ride * sc * (1 - 0.82 * (s.crouch || 0)) * up + 0.02 * sc * Math.sin(body.clock * 1.7) * up + (s.raise || 0) * sc;
    const toRoll = clamp(Math.atan(across) * 0.95 - clamp(vxl, -3, 3) * 0.03, -0.5, 0.5) * up, toPitch = clamp(-Math.atan(along) * 0.95 + clamp(vzl, -3, 3) * 0.025, -0.5, 0.5) * up;
    const clearY = s.floor === undefined || limp ? toY : Math.max(toY, s.floor - 0.12 * sc);
    if (fresh) { body.y = clearY; body.roll = toRoll; body.pitch = toPitch; body.yV = body.rollV = body.pitchV = 0; }
    else { spring(body, 'y', clearY, freq, ease, dt); spring(body, 'roll', toRoll, freq * 0.8, ease, dt); spring(body, 'pitch', toPitch, freq * 0.8, ease, dt); }
    object.position.set(s.x, body.y, s.z); object.rotation.set(body.pitch + (s.pitch || 0), s.yaw, body.roll + (s.roll || 0));
    object.updateMatrix(); inv.copy(object.matrix).invert();
    // and the legs, from where they join the body to where the feet are
    for (const l of L) {
      if (l.gone) continue;
      l.tip.copy(l.foot).applyMatrix4(inv);
      if (limp > 0) l.tip.lerp(l.curl, limp);
      if (l.l3) { ankleOf(l, l.ankle); twoBone(l.hip, l.ankle, l.l1, l.l2, l.pole, l.knee); lay(l.upper, l.hip, l.knee, l.pole); lay(l.lower, l.knee, l.ankle, l.pole); lay(l.last, l.ankle, l.tip, l.pole); }
      else { twoBone(l.hip, l.tip, l.l1, l.l2, l.pole, l.knee); lay(l.upper, l.hip, l.knee, l.pole); lay(l.lower, l.knee, l.tip, l.pole); }
    }
  }
  return { update, legs: L, body, inv, ankleOf, get stepping() { return L.filter((l) => l.t >= 0).length; } };
}
