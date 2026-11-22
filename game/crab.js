// The Keeper in motion. Its shell is one model; this hangs eight legs and two claws on it (critters.js: KEEPER, keeperLeg,
// keeperClaw). The legs walk by themselves (legs.js): the body is told only where it is and which way it faces, and it rides
// on its feet over whatever ground they find. The claws and the set of the body say what it is about to do:
//   wary     a fish is near: it stands taller, the big claw up and open and waving, turned toward the fish
//   snap     it rears, the big claw high and wide, and then brings it down on the tail
// The claws are not a pair (as with most crabs): the big one, on its right, is slow and is what it strikes with; the small one is
// never still, picking at the ground and carrying what it finds to its mouth.
//   tuck     a body is going round it: feet drawn in, belly on the ground, claws folded across its face
//   stun     it has been rammed: it sags and rocks on its feet, which stay where they are
//   limp     it is done for: it goes over on its back and its legs curl up
// What it does and when is guards.js; this is only how it looks doing it. The library shows the same poses on a stand.
import * as THREE from 'three';
import { createWalker, twoBone, lay } from './legs.js';
import { KEEPER, keeperLeg, keeperClaw } from './critters.js';
import { clamp, lerp, damp } from './geo.js';

const V = (a) => new THREE.Vector3(a[0], a[1], a[2]), UP = new THREE.Vector3(0, 1, 0);

// a: the creature as npc.js makes it (a.body is the shell, in its material). Returns the rig; a.object becomes the whole animal.
export function crabRig(a, pal) {
  const group = new THREE.Group(), mat = a.body.material; group.add(a.body);
  const leg = keeperLeg(pal); a.owned.push(leg.upper, leg.lower);
  const piece = (geo, parent = group) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; parent.add(m); return m; };
  const legs = KEEPER.legs.map((l) => ({ ...l, hip: V(l.hip), curl: V(l.curl), rest: { x: l.rest[0], z: l.rest[1] }, upper: piece(leg.upper), lower: piece(leg.lower) }));
  const walker = createWalker(group, legs, { ride: KEEPER.ride });
  let clawTris = 0;
  const claws = KEEPER.claws.map((c) => { const geo = keeperClaw(pal, c), hand = piece(geo.hand), finger = piece(geo.finger, hand); finger.position.set(...c.hinge);
    a.owned.push(geo.arm, geo.hand, geo.finger); clawTris += (geo.arm.attributes.position.count + geo.hand.attributes.position.count + geo.finger.attributes.position.count) / 3;
    return { ...c, shoulder: V(c.shoulder), arm: piece(geo.arm), hand, finger, wrist: new THREE.Vector3(c.side * 0.9, 0.25, 2.1), open: 0.3, elbow: new THREE.Vector3(), pole: new THREE.Vector3(c.side, 0.7, -0.3), to: new THREE.Vector3() }; });
  const pose = { crouch: 0, tuck: 0, roll: 0, pitch: 0, raise: 0, limp: 0, wary: 0 }, at = new THREE.Vector3(), face = new THREE.Vector3();
  const triangles = (a.body.geometry.attributes.position.count + 8 * (leg.upper.attributes.position.count + leg.lower.attributes.position.count)) / 3 + clawTris;

  // s: x, z, yaw, vx, vz, ground, treadmill as legs.js takes them, and the mood:
  //   wary 0..1, look: a point to turn the claws to    snap: -1, or 0..1 through the wind-up, and strike: the point it comes down on
  //   tuck, stun, limp: true or false                  time: seconds, for what shakes
  function update(dt, s) {
    const snap = s.snap >= 0 ? s.snap : -1, hit = snap > 0.82, limp = s.limp ? 1 : 0;
    pose.wary = damp(pose.wary, limp || s.tuck || s.stun ? 0 : s.wary || 0, 5, dt);
    pose.tuck = damp(pose.tuck, s.tuck && !limp ? 1 : 0, 7, dt); pose.limp = damp(pose.limp, limp, 3, dt);
    pose.crouch = damp(pose.crouch, limp ? 0 : s.tuck ? 1 : s.stun ? 0.5 : 0, 7, dt);
    pose.raise = damp(pose.raise, limp ? 1.55 : snap >= 0 && !hit ? 0.16 : 0.07 * pose.wary, limp ? 3 : 9, dt); // over on its back, it lies on the dome of its shell
    pose.pitch = damp(pose.pitch, limp ? 0.25 : snap >= 0 ? (hit ? 0.14 : -0.24 * Math.min(1, snap * 2.5)) : -0.05 * pose.wary, hit ? 26 : 8, dt); // it rears, and comes down with the claw
    pose.roll = damp(pose.roll, limp ? 2.2 : 0, 2.6, dt);
    walker.update(dt, { ...s, crouch: pose.crouch, tuck: pose.tuck, limp: pose.limp > 0.97 ? 1 : pose.limp, raise: pose.raise, pitch: pose.pitch, roll: pose.roll + (s.stun && !limp ? 0.17 * Math.sin(s.time * 16) : 0) });
    // the claws. Everything from here is in the body's own space: +z is ahead of it, +x its left
    if (s.look) face.copy(s.look).applyMatrix4(walker.inv).setY(0).normalize(); else face.set(0, 0, 1);
    if (s.strike) at.copy(s.strike).applyMatrix4(walker.inv);
    const sway = Math.sin(s.time * 1.3);
    for (const c of claws) {
      const k = c.side, striking = c.big && hit && !!s.strike;
      let open = 0.25, quick = 9;
      if (pose.limp > 0.5) { c.to.set(k * 0.85, 0.45, 1.35); open = 0.45; quick = 3; }
      else if (s.tuck) { if (c.big) c.to.set(k * 0.1, 0.18, 2.0); else c.to.set(k * 0.6, 0.1, 1.6); open = 0.03; } // the big one shut across its face like a door
      else if (s.stun) { c.to.set(k * (c.big ? 1.7 : 1.3), -0.15 + 0.05 * Math.sin(s.time * 16 + k), 1.9); open = 0.6; }
      else if (striking) { c.to.copy(at).sub(c.shoulder); c.to.setLength(Math.max(0.6, c.to.length() - c.span * 0.6)).add(c.shoulder); c.to.z = Math.max(c.to.z, 1.2); open = 0.02; quick = 34; } // the fingers, not the wrist, are what reach it
      else if (snap >= 0) { if (c.big) { c.to.set(k * 1.5, 2.2 + 0.3 * snap, 1.1); open = 1.05; } else { c.to.set(k * 1.5, 0.9, 1.8); open = 0.8; } quick = 12; }
      else if (c.big) { // held low across its front; the nearer a fish, the higher it goes, and open, and it waves it at the fish
        const wave = pose.wary * Math.sin(s.time * 2.2);
        c.to.set(k * (0.6 + 0.95 * pose.wary) + face.x * 0.5 * pose.wary, 0.2 + 1.25 * pose.wary + 0.3 * wave + 0.03 * sway, 2.3 - 0.35 * pose.wary + Math.max(0, face.z) * 0.2 * pose.wary);
        open = 0.2 + 0.6 * pose.wary + 0.1 * wave;
      } else { // the small one picks at the ground and carries what it finds to its mouth; with a fish near it is held up, snipping
        const pick = 0.5 - 0.5 * Math.cos(s.time * 2.6), w = pose.wary;
        c.to.set(k * lerp(lerp(0.3, 0.75, pick), 1.3, w), lerp(lerp(0.2, -0.3, pick), 0.75, w), lerp(lerp(1.62, 1.95, pick), 2.0, w));
        open = lerp(0.15 + 0.35 * pick, 0.4 + 0.3 * Math.sin(s.time * 9), w); quick = 11;
      }
      c.wrist.lerp(c.to, 1 - Math.exp(-quick * dt)); c.open = damp(c.open, open, striking ? 40 : 10, dt);
      twoBone(c.shoulder, c.wrist, c.l1, c.l2, c.pole, c.elbow); lay(c.arm, c.shoulder, c.elbow, UP); lay(c.hand, c.elbow, c.wrist, UP);
      c.finger.rotation.x = -c.open;
    }
  }
  // on the stand in the library: the same animal, the ground going by under it when it walks (sideways, as crabs do)
  const stand = { time: 0, look: new THREE.Vector3(), tail: new THREE.Vector3() };
  function show(dt, state, speed) {
    stand.time += dt;
    const sc = group.scale.x, id = state.id, beat = (stand.time % 2.4) / 2.4; // the snap, over and over: wind up, strike, hold, let go
    stand.look.set(Math.sin(stand.time * 0.5) * 4 * sc, 0, 6 * sc); stand.tail.set(-0.5 * sc, -0.1 * sc, 2.9 * sc);
    update(dt, { x: 0, z: 0, yaw: 0, vx: id === 'walk' ? speed * sc : 0, vz: 0, treadmill: true, ground: (p) => { p.y = -KEEPER.ride * sc; }, time: stand.time,
      wary: id === 'wary' || id === 'snap' ? 1 : 0, look: stand.look, snap: id === 'snap' && beat < 0.42 ? beat / 0.42 : -1, strike: stand.tail, tuck: id === 'tuck', stun: id === 'stun', limp: id === 'down' });
  }
  a.object = group; a.rig = { update, show, walker, claws, pose, triangles };
  return a.rig;
}
