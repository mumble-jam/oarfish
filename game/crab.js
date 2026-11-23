// The Keeper in motion. Its shell is one model; this hangs on it everything that works (critters.js: KEEPER and the pieces): eight legs and two
// claws, two eyes on stalks, the two doors of its mouth, four feelers, and the cracks its shell takes. The legs walk by themselves (legs.js): the
// body is told only where it is and which way it faces, and it rides on its feet over whatever ground they find. The feelers trail by themselves
// (strands.js). The claws, the eyes and the set of the body say what it is about to do, and every blow has its own look before it lands (the list
// is over `update`), because the fight is one to be read: see guards.js.
// The claws are not a pair (as with most crabs): the big one, on its right, is slow and is what it strikes hardest with; the small one is never
// still, picking at the ground and carrying what it finds to its mouth, and is the one it jabs with.
//   wary     a fish is near: it stands taller, the big claw up and open and waving, turned toward the fish, and its eyes on the fish
//   tuck     drawn in before it runs: feet under it, belly on the ground, claws folded across its face, eyes laid flat in their sockets
//   stun     it has been hurt: it sags and rocks on its feet, which stay where they are; its eyes loll and its mouth hangs
//   limp     it is done for: it goes over on its back, its legs curl up and its eyes hang
//   rage     two legs gone: it stands higher and shakes, claws up and clacking, eyes wide apart and flaring, and the cracks in its shell pulse
// Its eyes are the tell for where a blow will land: through every wind-up both stalks crane toward the point the claw is aimed at (the fight
// hands it over as `act.at`), and it is the same point the blow comes down on. A numb leg, the one to go for, does not arch like the others: its
// knee lies out to one side, low, it is pale and flickers, and it jerks. A leg torn off leaves a stump and a crack up the shell from it.
// What was taken from the real animal, and where it was read:
//   A crab's eyes are compound eyes on short thick stalks, each in a notch (an orbit) in the front edge of the shell, and a bar inside links the
//   two stalks "so the eyes move in unison"; outside the mouth the third pair of mouthparts "resemble a pair of doors protecting the mouth
//   field"; of the two pairs of feelers the first is short and folds away, the second a slender lash. The right claw is the crusher, "slightly
//   larger, with larger and more rounded teeth", the left the cutter, with "smaller and sharper teeth"; the upper finger is the one that moves.
//   A walking leg is six lengths, the last a point, and a leg is shed at a "fracture plane" near its root, which seals (R. S. Fox, "Callinectes
//   sapidus, blue crab", Invertebrate Anatomy OnLine, Lander University). So both stalks here turn together, the mouth has two doors, the
//   crusher's teeth are knobs and the cutter's are points, and a torn leg leaves a clean stump at the shell.
//   The Florida stone crab has "large and unequally sized chelae (claws) with black tips", and loses and regrows limbs easily (Wikipedia,
//   "Florida stone crab"). So the fingers of both claws are tipped dark.
//   Crabs run sideways, and the tail is folded forward under the body (Wikipedia, "Crab"): the Keeper's is drawn there, and shows when it is beaten.
// Not read anywhere: that a crab's eyes look where it will strike, or that its shell cracks when a leg goes. Both are there to be read by a player.
// What it does and when is guards.js; this is only how it looks doing it. The library shows the same poses on a stand.
import * as THREE from 'three';
import { createWalker, twoBone, lay } from './legs.js';
import { createBundle } from './strands.js';
import { KEEPER, keeperLeg, keeperClaw, keeperEye, keeperJaw, keeperFeeler, keeperCrack } from './critters.js';
import { clamp, lerp, damp } from './geo.js';

const V = (a) => new THREE.Vector3(a[0], a[1], a[2]), UP = new THREE.Vector3(0, 1, 0);
const AIMED = new Set(['slam', 'stuck', 'sweep', 'sweeping', 'jab', 'jabbed', 'feed']), WINDUP = new Set(['slam', 'sweep', 'jab']); // when its eyes are on the point it was handed, and when it is still winding up
const FEEL = { long: { stiff: [5, 1.3], drag: [1.0, 3.2], ease: 0.8 }, short: { stiff: [9, 4.5], drag: [1.0, 2.2], ease: 0.85 } };

// a: the creature as npc.js makes it (a.body is the shell, in its material). Returns the rig; a.object becomes the whole animal.
export function crabRig(a, pal) {
  const group = new THREE.Group(), mat = a.body.material; group.add(a.body);
  const leg = keeperLeg(pal); a.owned.push(leg.upper, leg.lower);
  const numbMat = mat.clone(); numbMat.emissive = new THREE.Color(pal.pale || '#e9dfc0'); a.owned.push(numbMat); // a leg that has gone numb is pale, and flickers: that is the one to go for
  const piece = (geo, parent = group) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; parent.add(m); return m; };
  const count = (g) => g.attributes.position.count / 3;
  const legs = KEEPER.legs.map((l) => ({ ...l, hip: V(l.hip), curl: V(l.curl), rest: { x: l.rest[0], z: l.rest[1] }, upper: piece(leg.upper), lower: piece(leg.lower) }));
  const walker = createWalker(group, legs, { ride: KEEPER.ride });
  let triangles = count(a.body.geometry) + 8 * (count(leg.upper) + count(leg.lower));
  const claws = KEEPER.claws.map((c) => { const geo = keeperClaw(pal, c), hand = piece(geo.hand), finger = piece(geo.finger, hand); finger.position.set(...c.hinge);
    a.owned.push(geo.arm, geo.hand, geo.finger); triangles += count(geo.arm) + count(geo.hand) + count(geo.finger);
    return { ...c, shoulder: V(c.shoulder), arm: piece(geo.arm), hand, finger, wrist: new THREE.Vector3(c.side * 0.9, 0.25, 2.1), open: 0.3, elbow: new THREE.Vector3(), pole: new THREE.Vector3(c.side, 0.7, -0.3), to: new THREE.Vector3() }; });
  // the eyes, the doors of the mouth, the feelers (drawn as one piece, each trailing by itself), and a crack for each leg, which shows when that leg has gone
  const eyeGeo = keeperEye(pal), jawGeo = keeperJaw(pal); a.owned.push(eyeGeo.stalk, eyeGeo.ball, jawGeo);
  const eyes = KEEPER.eyes.map((e) => { const mesh = piece(eyeGeo.stalk), ball = piece(eyeGeo.ball, mesh); mesh.position.set(...e.socket); ball.position.y = KEEPER.stalk; return { ...e, socket: V(e.socket), mesh, ball, look: new THREE.Quaternion() }; }); // (mesh: the stalk; ball: the eye on its top)
  const jaws = KEEPER.jaws.map((j) => { const mesh = piece(jawGeo); mesh.position.set(...j.hinge); mesh.scale.x = j.side; return { ...j, mesh, open: 0 }; });
  const strands = KEEPER.feelers.map((f) => ({ geometry: keeperFeeler(pal, f), cuts: f.cuts, feel: f.long > 0.6 ? FEEL.long : FEEL.short })), bundle = createBundle(strands, mat); group.add(bundle.mesh); a.owned.push(bundle);
  const feelers = KEEPER.feelers.map((f, i) => ({ ...f, st: bundle.strands[i], root: V(f.root), way: V(f.way).normalize(), ph: i * 2.4 }));
  const cracks = KEEPER.legs.map((l, i) => { const g = keeperCrack(pal, i), m = piece(g); m.visible = false; a.owned.push(g); return m; });
  triangles += 2 * (count(eyeGeo.stalk) + count(eyeGeo.ball)) + 2 * count(jawGeo) + strands.reduce((t, s) => t + count(s.geometry), 0); for (const s of strands) s.geometry.dispose();
  const pose = { crouch: 0, tuck: 0, roll: 0, pitch: 0, raise: 0, limp: 0, wary: 0, rage: 0, glow: 1, lost: 0, gaze: new THREE.Vector3(0, 0.4, 5) }, at = new THREE.Vector3(), face = new THREE.Vector3();
  const gazeTo = new THREE.Vector3(), aimer = new THREE.Object3D(), Z1 = new THREE.Vector3(), U1 = new THREE.Vector3(), P1 = new THREE.Vector3(), T1 = new THREE.Vector3(), K1 = new THREE.Vector3(), D1 = new THREE.Vector3(), DOWN = new THREE.Vector3(), QI = new THREE.Quaternion(), QX = new THREE.Quaternion(), X1 = new THREE.Vector3(1, 0, 0), M1 = new THREE.Matrix4();
  const moving = new THREE.Vector3(), water = new THREE.Vector3(), opts = { scale: 1, moving, water: null };

  // s: x, z, yaw, vx, vz, ground, treadmill as legs.js takes them, and the mood:
  //   wary 0..1, look: a point to turn the claws and the eyes to     tuck, stun, limp: true or false     time: seconds, for what shakes
  //   sink 0..1: how far it has dug itself into the sand            rage: true once it has lost the legs that make it rage
  //   act: what it is doing with its claws, { id, k: 0..1 through it, at: the point a claw is brought to }
  //     slam      the great claw goes up over its head, open, and it rears                 stuck   the claw is in the bed at `at`, and it is hauling on it
  //     sweep     the great claw is drawn back wide and low on its own side               sweeping  and goes across its front, right to left
  //     jab       the small claw is cocked back, open                                     jabbed  and has gone out to `at`
  //     charge    both folded across its face, as it runs                                 feed    both at its mouth, working
  //     spent     both hanging open on the ground: it has struck, and is getting its breath
  function update(dt, s) {
    const act = s.act || null, id = act ? act.id : '', k = act ? act.k || 0 : 0, limp = s.limp ? 1 : 0, hard = id === 'stuck' || id === 'jabbed' || id === 'sweeping', t = s.time;
    pose.wary = damp(pose.wary, limp || s.tuck || s.stun || act ? 0 : s.wary || 0, 5, dt);
    pose.rage = damp(pose.rage, s.rage && !limp ? 1 : 0, 3, dt); const rage = pose.rage, calm = !act && !s.tuck && !s.stun && !limp;
    pose.tuck = damp(pose.tuck, s.tuck && !limp ? 1 : 0, 7, dt); pose.limp = damp(pose.limp, limp, 3, dt);
    pose.crouch = damp(pose.crouch, limp ? 0 : s.tuck ? 1 : s.stun ? 0.5 : id === 'charge' ? 0.3 : id === 'spent' ? 0.4 : id === 'sweep' ? 0.3 : id === 'feed' ? 0.2 : 0, 7, dt);
    pose.raise = damp(pose.raise, limp ? 1.55 : (id === 'slam' ? 0.2 : 0.07 * pose.wary + (calm ? 0.1 * rage : 0)) - 2.7 * (s.sink || 0), limp ? 3 : s.sink ? 5 : 9, dt); // over on its back, it lies on the dome of its shell; dug in, the dome is under the sand; raging, it stands high
    pose.pitch = damp(pose.pitch, limp ? 0.25 : id === 'slam' ? -0.27 * Math.min(1, k * 2.5) : id === 'stuck' ? 0.15 + 0.035 * Math.sin(t * 17) : id === 'spent' ? 0.07 : id === 'feed' ? 0.1 : -0.05 * pose.wary - (calm ? 0.08 * rage : 0), hard ? 26 : 8, dt); // it rears, and comes down with the claw (and, raging, stands reared back a little)
    pose.roll = damp(pose.roll, limp ? 2.2 : id === 'sweep' ? -0.17 * Math.min(1, k * 2) : id === 'sweeping' ? 0.12 : 0, limp ? 2.6 : 9, dt); // it leans back onto the claw's side, and then through
    walker.update(dt, { ...s, crouch: pose.crouch, tuck: pose.tuck, limp: pose.limp > 0.97 ? 1 : pose.limp, raise: pose.raise, pitch: pose.pitch, roll: pose.roll + (s.stun && !limp ? 0.17 * Math.sin(t * 16) : 0) + (calm ? 0.03 * rage * Math.sin(t * 23) : 0) }); // (raging, it shakes)
    numbMat.emissiveIntensity = 1.2 + 0.5 * Math.sin(t * 11);
    let lost = 0;
    walker.legs.forEach((l, i) => { const m = l.lame ? numbMat : mat; if (l.upper.material !== m) l.upper.material = l.lower.material = m; cracks[i].visible = l.gone; if (l.gone) lost++;
      // A numb leg does not arch as the others do: its knee lies out to one side, low (toward the tail for a leg in front, toward the head for one behind), and now and then it jerks
      if (l.lame && !l.gone && pose.limp < 0.5) { const jerk = Math.max(0, Math.sin(t * 7.3 + i * 1.9)) ** 10;
        P1.set(l.side * 0.25, 0.22 + 1.5 * jerk, l.hip.z >= -0.2 ? -1 : 1); T1.copy(l.tip); T1.y += 0.25 * jerk;
        twoBone(l.hip, T1, l.l1, l.l2, P1, K1); lay(l.upper, l.hip, K1, UP); lay(l.lower, K1, T1, UP); } });
    pose.lost = lost;
    // the claws. Everything from here is in the body's own space: +z is ahead of it, +x its left
    if (s.look) face.copy(s.look).applyMatrix4(walker.inv).setY(0).normalize(); else face.set(0, 0, 1);
    if (act && act.at) at.copy(act.at).applyMatrix4(walker.inv);
    const sway = Math.sin(t * 1.3), chew = Math.sin(t * 7), up = Math.max(pose.wary, 0.8 * rage * (calm ? 1 : 0)), clack = rage * Math.abs(Math.sin(t * 5.5)); // raging, the claws are up whether a fish is near or not, and clack
    for (const c of claws) {
      const K = c.side, reach = (short) => { c.to.copy(at).sub(c.shoulder); c.to.setLength(Math.max(0.6, c.to.length() - c.span * short)).add(c.shoulder); c.to.z = Math.max(c.to.z, 1.0); }; // the fingers, not the wrist, are what get there
      let open = 0.25, quick = 9, snap = 10;
      if (pose.limp > 0.5) { c.to.set(K * 0.85, 0.45, 1.35); open = 0.45; quick = 3; }
      else if (s.tuck || id === 'charge') { if (c.big) c.to.set(K * 0.1, 0.18, 2.0); else c.to.set(K * 0.6, 0.1, 1.6); open = 0.03; } // the big one shut across its face like a door
      else if (s.stun) { c.to.set(K * (c.big ? 1.7 : 1.3), -0.15 + 0.05 * Math.sin(t * 16 + K), 1.9); open = 0.6; }
      else if (id === 'slam') { if (c.big) { c.to.set(K * 1.5, 2.2 + 0.45 * k, 1.05); open = 1.05; } else { c.to.set(K * 1.5, 0.9, 1.8); open = 0.8; } quick = 12; }
      else if (id === 'stuck') { if (c.big) { reach(0.6); open = 0.02; quick = 34; snap = 40; } else { c.to.set(K * 1.25, -0.28, 1.7); open = 0.3; } } // the small one braced on the ground, to haul with
      else if (id === 'sweep') { if (c.big) { c.to.set(K * 2.7, 0.5, 0.25 - 0.6 * k); open = 1.0; quick = 10; } else { c.to.set(K * 0.8, 0.45, 1.6); open = 0.25; } }
      else if (id === 'sweeping') { if (c.big) { const a2 = 2.75 * k; c.to.set(K * 2.9 * Math.cos(a2), 0.28, 2.9 * Math.sin(a2) + 0.35); open = 0.12; quick = 46; snap = 40; } else { c.to.set(K * 0.5, 0.3, 1.3); open = 0.1; } }
      else if (id === 'jab') { if (c.big) { c.to.set(K * 0.9, 0.9, 1.9); open = 0.3; } else { c.to.set(K * 1.0, 0.8, 0.95 - 0.3 * k); open = 1.0; quick = 18; } }
      else if (id === 'jabbed') { if (c.big) { c.to.set(K * 0.9, 0.9, 1.9); open = 0.3; } else { reach(0.5); open = 0.03; quick = 48; snap = 40; } }
      else if (id === 'feed') { if (c.big) { c.to.set(K * 0.3, 0.2 + 0.08 * chew, 1.75); open = 0.25 + 0.2 * chew; } else { c.to.set(K * 0.3, 0.15 - 0.08 * chew, 1.6); open = 0.3 - 0.2 * chew; } }
      else if (id === 'spent') { if (c.big) c.to.set(K * 1.9, -0.25, 1.6); else c.to.set(K * 1.2, -0.28, 1.7); open = 0.5; quick = 5; }
      else if (c.big) { // held low across its front; the nearer a fish, the higher it goes, and open, and it waves it at the fish
        const wave = up * Math.sin(t * 2.2);
        c.to.set(K * (0.6 + 0.95 * up) + face.x * 0.5 * pose.wary, 0.2 + 1.25 * up + 0.3 * wave + 0.03 * sway, 2.3 - 0.35 * up + Math.max(0, face.z) * 0.2 * pose.wary);
        open = 0.2 + 0.6 * up + 0.1 * wave - 0.55 * clack * up;
      } else { // the small one picks at the ground and carries what it finds to its mouth; with a fish near it is held up, snipping
        const pick = 0.5 - 0.5 * Math.cos(t * 2.6), w = up;
        c.to.set(K * lerp(lerp(0.3, 0.75, pick), 1.3, w), lerp(lerp(0.2, -0.3, pick), 0.75, w), lerp(lerp(1.62, 1.95, pick), 2.0, w));
        open = lerp(0.15 + 0.35 * pick, 0.4 + 0.3 * Math.sin(t * 9), w); quick = 11;
      }
      c.wrist.lerp(c.to, 1 - Math.exp(-quick * dt)); c.open = damp(c.open, open, snap, dt);
      twoBone(c.shoulder, c.wrist, c.l1, c.l2, c.pole, c.elbow); lay(c.arm, c.shoulder, c.elbow, UP); lay(c.hand, c.elbow, c.wrist, UP);
      c.finger.rotation.x = -c.open;
    }

    // The eyes. Both turn together, as a crab's do. In a wind-up, and while the claw is where it struck, they are on the point the fight handed over; otherwise
    // on the fish, if one is near; otherwise they wander. The eye turns on its stalk to face what it looks at, and the stalk leans that way, further in a wind-up.
    const aimed = !!(act && act.at && AIMED.has(id)), wind = WINDUP.has(id), dazed = s.stun && !limp, drawn = (s.tuck || id === 'charge') && !limp, hung = pose.limp > 0.5;
    if (aimed) gazeTo.copy(at); else if (s.look && (pose.wary > 0.12 || id === 'spent' || (s.rage && calm))) gazeTo.copy(s.look).applyMatrix4(walker.inv);
    else gazeTo.set(3.4 * Math.sin(t * 0.37) + 1.3 * Math.sin(t * 1.31 + 1), 0.5 + 0.6 * Math.sin(t * 0.53), 5);
    pose.gaze.lerp(gazeTo, 1 - Math.exp(-(wind ? 16 : 7) * dt));
    DOWN.set(0, -1, 0).applyQuaternion(QI.copy(group.quaternion).invert()); // which way down is, as the body sees it
    for (const e of eyes) { const K = e.side; let free = false; // free: the eye is looking at something, and not just carried on its stalk
      if (hung) { U1.copy(DOWN).setX(DOWN.x + K * 0.45).normalize(); Z1.set(K * 0.3, 0, 1); } // they hang
      else if (drawn) { U1.set(K * 0.97, 0.12, 0.2); Z1.set(K * 0.1, -0.4, 1); } // laid over sideways into their sockets, as a crab's fold away
      else if (dazed) { U1.set(K * (0.6 + 0.25 * Math.sin(t * 9 + K)), 0.7, 0.25 * Math.sin(t * 7)); Z1.set(0.9 * Math.sin(t * 8 + K), 0, 1); } // lolling
      else { free = true; Z1.copy(pose.gaze).sub(P1.copy(e.socket).setY(e.socket.y + KEEPER.stalk)); const flat = Math.hypot(Z1.x, Z1.z) || 1, dip = clamp(Z1.y / flat, -0.8, 0.5); Z1.set(Z1.x / flat, 0, Math.max(Z1.z / flat, 0.2)).normalize(); // (it cannot look back through its own shell)
        U1.set(K * (0.2 + 0.4 * rage), 1, 0.05).addScaledVector(Z1, 0.2 + (wind ? 0.45 * Math.min(1, k * 2.5) : 0) - 0.25 * Math.min(0, dip)); Z1.y = 0.5 * dip; }
      U1.normalize(); X1.crossVectors(U1, Z1).normalize(); T1.crossVectors(X1, U1); QX.setFromRotationMatrix(M1.makeBasis(X1, U1, T1)); // the stalk: up it exactly, and forward as near as may be
      e.mesh.quaternion.slerp(QX, 1 - Math.exp(-(wind ? 18 : drawn ? 14 : 9) * dt));
      if (free) { lay(aimer, e.socket, P1.copy(e.socket).add(Z1.normalize()), UP); e.look.slerp(aimer.quaternion, 1 - Math.exp(-(wind ? 20 : 10) * dt)); } else e.look.slerp(e.mesh.quaternion, 1 - Math.exp(-8 * dt));
      e.ball.quaternion.copy(e.mesh.quaternion).invert().multiply(e.look); }
    // their light, which is the cracks' too: flaring in a wind-up, pulsing when it rages, flickering when it is hurt, out when it is beaten
    pose.glow = damp(pose.glow, limp ? 0.05 : dazed ? 0.55 + 0.45 * Math.sin(t * 31) : drawn ? 0.7 : wind ? 1.7 : 1 + rage * (0.35 + 0.45 * Math.sin(t * 7)), 10, dt); mat.userData.glow.value = pose.glow;
    // the doors of its mouth, never quite still: a nibble now and then, a flutter with a fish near, wide and by turns when it feeds, hanging when it is hurt
    for (const j of jaws) { const K = j.side, nibble = t % 3.4 < 0.55 ? 0.3 * Math.abs(Math.sin(t * 13)) : 0;
      const open = hung || dazed ? 0.75 : drawn ? 0 : id === 'feed' ? 0.5 + 0.42 * Math.sin(t * 8 + K * 1.57) : wind ? 0.45 : 0.07 + 0.05 * Math.sin(t * 2.1 + K) + nibble + pose.wary * (0.1 + 0.1 * Math.sin(t * 9 + K)) + rage * (0.22 + 0.2 * Math.sin(t * 13 + K));
      j.open = damp(j.open, open, hung || dazed ? 4 : 16, dt); j.mesh.rotation.y = K * j.open; }
    // the feelers: each is given the shape it would hold, and goes after it through the water. The long ones wave; the short ones flick
    const sc = group.scale.x; moving.set(s.treadmill ? 0 : s.vx || 0, 0, s.treadmill ? 0 : s.vz || 0); opts.scale = sc; opts.water = s.treadmill ? water.set(-(s.vx || 0), 0, -(s.vz || 0)) : null;
    for (const f of feelers) { const st = f.st, long = f.long > 0.6, K = f.side, slack = hung || dazed ? 1 : 0;
      const flick = long ? 0 : Math.max(0, Math.sin(t * (id === 'feed' ? 19 : 4.8) + f.ph)) ** (id === 'feed' ? 2 : 12), lash = long ? 0.22 + 0.5 * rage + 0.2 * pose.wary : 0.1;
      P1.copy(f.root); st.shape[0].copy(P1);
      for (let i = 0; i < st.n; i++) { const u = (i + 0.5) / st.n;
        D1.copy(f.way); D1.x += K * lash * u * Math.sin(t * (long ? 1.1 + 5 * rage : 2.3) + f.ph + u * 1.6); D1.y += lash * 0.6 * u * Math.sin(t * 0.83 + f.ph * 1.7) - (long ? 0.5 * u * u : 0) - flick * 1.3 - (id === 'feed' && long ? 0.8 : 0); D1.z += flick * 0.6;
        D1.normalize().lerp(DOWN, slack * 0.8 * (0.4 + 0.6 * u)).normalize(); P1.addScaledVector(D1, f.cuts[i + 1] - f.cuts[i]); st.shape[i + 1].copy(P1); }
      st.trail(dt, group, walker.inv, opts); }
  }
  // a leg comes away: the walker goes on without it, and whoever took it has its two pieces, where they were
  function shed(i) { const l = walker.legs[i]; l.gone = true; l.lame = false; l.upper.material = l.lower.material = mat; group.updateMatrixWorld(true); return [l.upper, l.lower]; }
  // on the stand in the library: the same animal, the ground going by under it when it walks (sideways, as crabs do)
  const stand = { time: 0, look: new THREE.Vector3(), tail: new THREE.Vector3(), act: { id: '', k: 0, at: null } };
  const LOOPS = { snap: [2.6, ['slam', 0.4], ['stuck', 0.85]], sweep: [2.4, ['sweep', 0.36], ['sweeping', 0.5], ['spent', 0.85]], jab: [1.5, ['jab', 0.3], ['jabbed', 0.5], ['spent', 0.8]], feed: [1, ['feed', 1]], charge: [1, ['charge', 1]], numb: [1, ['spent', 1]] };
  function show(dt, state, speed) {
    stand.time += dt;
    const sc = group.scale.x, id = state.id, loop = LOOPS[id]; // a blow, over and over: wind up, strike, hold, let go
    stand.look.set(Math.sin(stand.time * 0.5) * 4 * sc, 0, 6 * sc); stand.tail.set((id === 'jab' ? 1.6 : -0.5 + (id === 'snap' ? 1.4 * Math.sin(Math.floor(stand.time / 2.6) * 2.1) : 0)) * sc, -0.1 * sc, 2.9 * sc); // (the great claw is aimed somewhere new each time, to show the eyes going there first)
    let act = null;
    if (loop) { const beat = (stand.time % loop[0]) / loop[0]; let from = 0; for (let i = 1; i < loop.length; i++) { if (beat < loop[i][1]) { act = stand.act; act.id = loop[i][0]; act.k = (beat - from) / (loop[i][1] - from); act.at = stand.tail; break; } from = loop[i][1]; } }
    walker.legs.forEach((l, i) => { const off = id === 'lame' && (i === 1 || i === 6); l.gone = off; l.upper.visible = l.lower.visible = !off; l.lame = id === 'numb' && i === 1; }); // two legs down: how it stands on what is left. One numb: how that leg lies
    update(dt, { x: 0, z: 0, yaw: 0, vx: id === 'walk' || id === 'charge' ? speed * sc : 0, vz: 0, treadmill: true, ground: (p) => { p.y = -KEEPER.ride * sc; }, time: stand.time,
      wary: id === 'wary' ? 1 : 0, look: stand.look, act, tuck: id === 'tuck', stun: id === 'stun', limp: id === 'down', rage: id === 'lame', sink: id === 'dig' ? clamp((stand.time % 3.2) / 1.2, 0, 1) : 0 });
  }
  a.object = group; a.rig = { update, show, shed, walker, claws, eyes, jaws, feelers, cracks, pose, triangles };
  return a.rig;
}
