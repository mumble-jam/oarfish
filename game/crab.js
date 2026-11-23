// The Keeper in motion. Its shell is one model; this hangs eight legs and two claws on it (critters.js: KEEPER, keeperLeg,
// keeperClaw). The legs walk by themselves (legs.js): the body is told only where it is and which way it faces, and it rides
// on its feet over whatever ground they find. The claws and the set of the body say what it is about to do, and every blow
// has its own look before it lands (the list is over `update`), because the fight is one to be read: see guards.js.
// The claws are not a pair (as with most crabs): the big one, on its right, is slow and is what it strikes hardest with; the
// small one is never still, picking at the ground and carrying what it finds to its mouth, and is the one it jabs with.
//   wary     a fish is near: it stands taller, the big claw up and open and waving, turned toward the fish
//   tuck     drawn in before it runs: feet under it, belly on the ground, claws folded across its face
//   stun     it has been hurt: it sags and rocks on its feet, which stay where they are
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
  const numbMat = mat.clone(); numbMat.emissive = new THREE.Color(pal.pale || '#e9dfc0'); a.owned.push(numbMat); // a leg that has gone numb is pale, and flickers: that is the one to go for
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
  //   wary 0..1, look: a point to turn the claws to     tuck, stun, limp: true or false     time: seconds, for what shakes
  //   sink 0..1: how far it has dug itself into the sand
  //   act: what it is doing with its claws, { id, k: 0..1 through it, at: the point a claw is brought to }
  //     slam      the great claw goes up over its head, open, and it rears                 stuck   the claw is in the bed at `at`, and it is hauling on it
  //     sweep     the great claw is drawn back wide and low on its own side               sweeping  and goes across its front, right to left
  //     jab       the small claw is cocked back, open                                     jabbed  and has gone out to `at`
  //     charge    both folded across its face, as it runs                                 feed    both at its mouth, working
  //     spent     both hanging open on the ground: it has struck, and is getting its breath
  function update(dt, s) {
    const act = s.act || null, id = act ? act.id : '', k = act ? act.k || 0 : 0, limp = s.limp ? 1 : 0, hard = id === 'stuck' || id === 'jabbed' || id === 'sweeping';
    pose.wary = damp(pose.wary, limp || s.tuck || s.stun || act ? 0 : s.wary || 0, 5, dt);
    pose.tuck = damp(pose.tuck, s.tuck && !limp ? 1 : 0, 7, dt); pose.limp = damp(pose.limp, limp, 3, dt);
    pose.crouch = damp(pose.crouch, limp ? 0 : s.tuck ? 1 : s.stun ? 0.5 : id === 'charge' ? 0.3 : id === 'spent' ? 0.4 : id === 'sweep' ? 0.3 : id === 'feed' ? 0.2 : 0, 7, dt);
    pose.raise = damp(pose.raise, limp ? 1.55 : (id === 'slam' ? 0.2 : 0.07 * pose.wary) - 2.7 * (s.sink || 0), limp ? 3 : s.sink ? 5 : 9, dt); // over on its back, it lies on the dome of its shell; dug in, the dome is under the sand
    pose.pitch = damp(pose.pitch, limp ? 0.25 : id === 'slam' ? -0.27 * Math.min(1, k * 2.5) : id === 'stuck' ? 0.15 + 0.035 * Math.sin(s.time * 17) : id === 'spent' ? 0.07 : id === 'feed' ? 0.1 : -0.05 * pose.wary, hard ? 26 : 8, dt); // it rears, and comes down with the claw
    pose.roll = damp(pose.roll, limp ? 2.2 : id === 'sweep' ? -0.17 * Math.min(1, k * 2) : id === 'sweeping' ? 0.12 : 0, limp ? 2.6 : 9, dt); // it leans back onto the claw's side, and then through
    walker.update(dt, { ...s, crouch: pose.crouch, tuck: pose.tuck, limp: pose.limp > 0.97 ? 1 : pose.limp, raise: pose.raise, pitch: pose.pitch, roll: pose.roll + (s.stun && !limp ? 0.17 * Math.sin(s.time * 16) : 0) });
    numbMat.emissiveIntensity = 1.0 + 0.45 * Math.sin(s.time * 11);
    for (const l of walker.legs) { const m = l.lame ? numbMat : mat; if (l.upper.material !== m) l.upper.material = l.lower.material = m; }
    // the claws. Everything from here is in the body's own space: +z is ahead of it, +x its left
    if (s.look) face.copy(s.look).applyMatrix4(walker.inv).setY(0).normalize(); else face.set(0, 0, 1);
    if (act && act.at) at.copy(act.at).applyMatrix4(walker.inv);
    const sway = Math.sin(s.time * 1.3), chew = Math.sin(s.time * 7);
    for (const c of claws) {
      const K = c.side, reach = (short) => { c.to.copy(at).sub(c.shoulder); c.to.setLength(Math.max(0.6, c.to.length() - c.span * short)).add(c.shoulder); c.to.z = Math.max(c.to.z, 1.0); }; // the fingers, not the wrist, are what get there
      let open = 0.25, quick = 9, snap = 10;
      if (pose.limp > 0.5) { c.to.set(K * 0.85, 0.45, 1.35); open = 0.45; quick = 3; }
      else if (s.tuck || id === 'charge') { if (c.big) c.to.set(K * 0.1, 0.18, 2.0); else c.to.set(K * 0.6, 0.1, 1.6); open = 0.03; } // the big one shut across its face like a door
      else if (s.stun) { c.to.set(K * (c.big ? 1.7 : 1.3), -0.15 + 0.05 * Math.sin(s.time * 16 + K), 1.9); open = 0.6; }
      else if (id === 'slam') { if (c.big) { c.to.set(K * 1.5, 2.2 + 0.45 * k, 1.05); open = 1.05; } else { c.to.set(K * 1.5, 0.9, 1.8); open = 0.8; } quick = 12; }
      else if (id === 'stuck') { if (c.big) { reach(0.6); open = 0.02; quick = 34; snap = 40; } else { c.to.set(K * 1.25, -0.28, 1.7); open = 0.3; } } // the small one braced on the ground, to haul with
      else if (id === 'sweep') { if (c.big) { c.to.set(K * 2.7, 0.5, 0.25 - 0.6 * k); open = 1.0; quick = 10; } else { c.to.set(K * 0.8, 0.45, 1.6); open = 0.25; } }
      else if (id === 'sweeping') { if (c.big) { const a = 2.75 * k; c.to.set(K * 2.9 * Math.cos(a), 0.28, 2.9 * Math.sin(a) + 0.35); open = 0.12; quick = 46; snap = 40; } else { c.to.set(K * 0.5, 0.3, 1.3); open = 0.1; } }
      else if (id === 'jab') { if (c.big) { c.to.set(K * 0.9, 0.9, 1.9); open = 0.3; } else { c.to.set(K * 1.0, 0.8, 0.95 - 0.3 * k); open = 1.0; quick = 18; } }
      else if (id === 'jabbed') { if (c.big) { c.to.set(K * 0.9, 0.9, 1.9); open = 0.3; } else { reach(0.5); open = 0.03; quick = 48; snap = 40; } }
      else if (id === 'feed') { if (c.big) { c.to.set(K * 0.3, 0.2 + 0.08 * chew, 1.75); open = 0.25 + 0.2 * chew; } else { c.to.set(K * 0.3, 0.15 - 0.08 * chew, 1.6); open = 0.3 - 0.2 * chew; } }
      else if (id === 'spent') { if (c.big) c.to.set(K * 1.9, -0.25, 1.6); else c.to.set(K * 1.2, -0.28, 1.7); open = 0.5; quick = 5; }
      else if (c.big) { // held low across its front; the nearer a fish, the higher it goes, and open, and it waves it at the fish
        const wave = pose.wary * Math.sin(s.time * 2.2);
        c.to.set(K * (0.6 + 0.95 * pose.wary) + face.x * 0.5 * pose.wary, 0.2 + 1.25 * pose.wary + 0.3 * wave + 0.03 * sway, 2.3 - 0.35 * pose.wary + Math.max(0, face.z) * 0.2 * pose.wary);
        open = 0.2 + 0.6 * pose.wary + 0.1 * wave;
      } else { // the small one picks at the ground and carries what it finds to its mouth; with a fish near it is held up, snipping
        const pick = 0.5 - 0.5 * Math.cos(s.time * 2.6), w = pose.wary;
        c.to.set(K * lerp(lerp(0.3, 0.75, pick), 1.3, w), lerp(lerp(0.2, -0.3, pick), 0.75, w), lerp(lerp(1.62, 1.95, pick), 2.0, w));
        open = lerp(0.15 + 0.35 * pick, 0.4 + 0.3 * Math.sin(s.time * 9), w); quick = 11;
      }
      c.wrist.lerp(c.to, 1 - Math.exp(-quick * dt)); c.open = damp(c.open, open, snap, dt);
      twoBone(c.shoulder, c.wrist, c.l1, c.l2, c.pole, c.elbow); lay(c.arm, c.shoulder, c.elbow, UP); lay(c.hand, c.elbow, c.wrist, UP);
      c.finger.rotation.x = -c.open;
    }
  }
  // a leg comes away: the walker goes on without it, and whoever took it has its two pieces, where they were
  function shed(i) { const l = walker.legs[i]; l.gone = true; l.lame = false; group.updateMatrixWorld(true); return [l.upper, l.lower]; }
  // on the stand in the library: the same animal, the ground going by under it when it walks (sideways, as crabs do)
  const stand = { time: 0, look: new THREE.Vector3(), tail: new THREE.Vector3(), act: { id: '', k: 0, at: null } };
  const LOOPS = { snap: [2.6, ['slam', 0.4], ['stuck', 0.85]], sweep: [2.4, ['sweep', 0.36], ['sweeping', 0.5], ['spent', 0.85]], jab: [1.5, ['jab', 0.3], ['jabbed', 0.5], ['spent', 0.8]], feed: [1, ['feed', 1]], charge: [1, ['charge', 1]] };
  function show(dt, state, speed) {
    stand.time += dt;
    const sc = group.scale.x, id = state.id, loop = LOOPS[id]; // a blow, over and over: wind up, strike, hold, let go
    stand.look.set(Math.sin(stand.time * 0.5) * 4 * sc, 0, 6 * sc); stand.tail.set(-0.5 * sc, -0.1 * sc, 2.9 * sc);
    let act = null;
    if (loop) { const beat = (stand.time % loop[0]) / loop[0]; let from = 0; for (let i = 1; i < loop.length; i++) { if (beat < loop[i][1]) { act = stand.act; act.id = loop[i][0]; act.k = (beat - from) / (loop[i][1] - from); act.at = stand.tail; break; } from = loop[i][1]; } }
    walker.legs.forEach((l, i) => { const off = id === 'lame' && (i === 1 || i === 6); l.gone = off; l.upper.visible = l.lower.visible = !off; }); // two legs down: how it stands on what is left
    update(dt, { x: 0, z: 0, yaw: 0, vx: id === 'walk' || id === 'charge' ? speed * sc : 0, vz: 0, treadmill: true, ground: (p) => { p.y = -KEEPER.ride * sc; }, time: stand.time,
      wary: id === 'wary' ? 1 : 0, look: stand.look, act, tuck: id === 'tuck', stun: id === 'stun', limp: id === 'down', sink: id === 'dig' ? clamp((stand.time % 3.2) / 1.2, 0, 1) : 0 });
  }
  a.object = group; a.rig = { update, show, shed, walker, claws, pose, triangles };
  return a.rig;
}
