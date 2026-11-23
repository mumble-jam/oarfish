// The hermit crab in motion. Its shield and face are one model; this hangs on it everything that works (critters.js: HERMIT and the pieces): four
// walking legs, two claws that are not a pair, two eyes on stalks, two long feelers and two short ones, the soft curled back half, and the shell it
// lives in, which is a piece of its own that it can leave and that another crab can take. The legs walk by themselves (legs.js, used as it is); the
// feelers trail by themselves (strands.js). Not in the dive yet: nothing makes one but the specimen library and the testing tool in the pause menu.
// What follows is how it looks doing each thing; whoever moves it decides what it does.
//   walk       it carries its shell over its feet, the shell rocking a little, claws held before its face
//   pick       standing, the small claw picks at the sand and carries what it finds to its mouth
//   in         drawn right in: legs and eyes gone into the shell, the shell down on its side on the sand, and the big claw turned flat across the mouth
//   peer       still in, but the eyes up over the big claw and the feelers out, looking
//   probe      at an empty shell: both claws in its mouth, feeling, the eyes on it
//   hold       in a line: both claws forward, holding on to the shell of the crab ahead
//   leave      it lets go of its shell, which stays where it was, and stands out of it, the soft back half showing
//   enter      a shell lying by it is drawn on over the back half, and is its own
// Four sizes (HERMIT.sizes), and it can wear the plain snail shell or any of the ten the oarfish carries (wear(kind)).
// What was taken from the real animal, and where it was read:
//   The abdomen is soft and asymmetrical, usually curling to the right; it walks on its second and third pairs of legs, while the shorter fourth and
//   fifth pairs grip the central column of the shell; the first pair are the claws, the right one usually larger, "and its shape lets it block the
//   shell opening when the crab is inside"; it has two pairs of antennae (Britannica, "hermit crab"). So two pairs walk here, the two behind them are
//   inside and not drawn, the big claw is the door, and there are two long feelers and two short ones.
//   The whole body can retract into the shell; changing shells, a crab examines the new one, turns it aperture-up, and may take it or go back to its
//   own; finding one too large, it waits beside it for up to 8 hours, up to 20 crabs line up from largest to smallest, and when the right-sized crab
//   claims it the others swap in sequence (Wikipedia, "Hermit crab"). A crab probes the opening with its claws, rotates the shell to check it, pulls
//   out of its own shell and moves in, and the old shell is left for the next (Scientific American, "Life's a shell game", on Pagurus longicarpus).
//   Crabs in a line hold on to a larger crab's shell and ride along (Tufts Now, 2010, on Rotjan's work with the land hermit crab Coenobita clypeatus:
//   the size-ordered queue is documented on land; in the sea the chains are one crab after another, over minutes).
//   Pagurus pollicaris is reddish brown and P. bernhardus bright red (Britannica). The colours here are the bright one's, banded pale, for the high camera.
// Not read anywhere, and modelled from memory and description only: the exact shape of the claws and their pale knobs, the eyes' colour, the
// bands on the legs, and how high the shell is carried as it walks. It is made about five times as big as a hand-sized hermit crab (HERMIT.sizes:
// the line runs from 0.2 m to 0.45 m across with its shell), and the game's shells are worn smaller than the oarfish carries them.
import * as THREE from 'three';
import { createWalker, twoBone, lay } from './legs.js';
import { createBundle } from './strands.js';
import { alive } from './kit.js';
import { HERMIT, HERMIT_WEAR, hermitLeg, hermitClaw, hermitEye, hermitFeeler, hermitTail, hermitShell } from './critters.js';
import { clamp, lerp, damp } from './geo.js';

const V = (a) => new THREE.Vector3(a[0], a[1], a[2]), UP = new THREE.Vector3(0, 1, 0), ease = (t) => t * t * (3 - 2 * t);
const FEEL = { long: { stiff: [6, 1.6], drag: [1.0, 3.0], ease: 0.8 }, short: { stiff: [11, 5], drag: [1.0, 2.2], ease: 0.85 } };
export const HERMIT_SHELLS = Object.keys(HERMIT_WEAR); // what it can wear: 'snail', then the oarfish's ten
const DEPTH = 0.1; // how far it goes into its shell when it draws in
const INTO = V(HERMIT.inward).normalize(), MOUTH = V(HERMIT.mouth), LEAN = new THREE.Vector3(-0.38, 1, 0); // its shell leans a little to its right

// a: the creature as npc.js makes it (a.body is the shield). shellOf(kind): the geometry of one of the game's shells. Returns the rig; a.object becomes the animal.
export function hermitRig(a, pal, { shellOf = null } = {}) {
  const group = new THREE.Group(), crab = new THREE.Group(), mat = a.body.material; group.add(crab); crab.add(a.body); group.name = 'hermit';
  const shellMat = alive(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide, emissive: '#ffffff', emissiveIntensity: 0.16 }), { glow: 0.9 }); a.owned.push(shellMat);
  const piece = (geo, parent = crab) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; parent.add(m); return m; };
  const count = (g) => g.attributes.position.count / 3;
  const leg = hermitLeg(pal); a.owned.push(leg.upper, leg.lower);
  const legs = HERMIT.legs.map((l) => ({ ...l, base: V(l.hip), hip: V(l.hip), curl: V(l.curl), rest: { x: l.rest[0], z: l.rest[1] }, upper: piece(leg.upper, group), lower: piece(leg.lower, group) }));
  const walker = createWalker(group, legs, { ride: HERMIT.ride, stride: 0.07, swing: 0.16, lift: 0.04, lead: 0.15, freq: 3.2, ease: 0.5 });
  let triangles = count(a.body.geometry) + legs.length * (count(leg.upper) + count(leg.lower));
  const claws = HERMIT.claws.map((c) => { const geo = hermitClaw(pal, c), hand = piece(geo.hand), finger = piece(geo.finger, hand); finger.position.set(...c.hinge);
    a.owned.push(geo.arm, geo.hand, geo.finger); triangles += count(geo.arm) + count(geo.hand) + count(geo.finger);
    return { ...c, shoulder: V(c.shoulder), arm: piece(geo.arm), hand, finger, wrist: new THREE.Vector3(c.side * 0.03, -0.03, 0.14), open: 0.2, elbow: new THREE.Vector3(), pole: new THREE.Vector3(c.side, 0.8, -0.2), to: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) }; });
  const eyeGeo = hermitEye(pal); a.owned.push(eyeGeo.stalk, eyeGeo.ball); triangles += 2 * (count(eyeGeo.stalk) + count(eyeGeo.ball));
  const eyes = HERMIT.eyes.map((e) => { const mesh = piece(eyeGeo.stalk), ball = piece(eyeGeo.ball, mesh); mesh.position.set(...e.socket); ball.position.y = HERMIT.stalk; return { ...e, socket: V(e.socket), mesh, ball }; });
  const strands = HERMIT.feelers.map((f) => ({ geometry: hermitFeeler(pal, f), cuts: f.cuts, feel: f.long > 0.1 ? FEEL.long : FEEL.short })), bundle = createBundle(strands, mat); crab.add(bundle.mesh); a.owned.push(bundle);
  triangles += strands.reduce((t, s) => t + count(s.geometry), 0); for (const s of strands) s.geometry.dispose();
  const feelers = HERMIT.feelers.map((f, i) => ({ ...f, st: bundle.strands[i], root: V(f.root), way: V(f.way).normalize(), ph: i * 2.4 }));
  const tailGeo = hermitTail(pal), tail = piece(tailGeo); a.owned.push(tailGeo); tail.visible = false; const tailTris = count(tailGeo);

  // ---- the shells. Each is a piece with its own matrix: worn (carried in the body's space), or lying where it was left (in the space of the body's
  // parent, and set in the body's space each frame so it stays put), or on its way from one to the other.
  const geos = {}, fits = {};
  const geoOf = (kind) => { if (!geos[kind]) { geos[kind] = kind === 'snail' || !shellOf ? hermitShell(pal) : shellOf(kind); if (kind === 'snail' || !shellOf) a.owned.push(geos[kind]); } return geos[kind]; };
  // the matrix that wears a shell, in the body's space, and how low under the body its lowest point is
  function fitOf(kind) {
    if (fits[kind]) return fits[kind];
    const W = HERMIT_WEAR[kind] || HERMIT_WEAR.snail, g = geoOf(kind); g.computeBoundingBox(); const b = g.boundingBox, long = Math.max(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z);
    const zs = V(W.into).normalize(), ys = V(W.up).addScaledVector(zs, -V(W.up).dot(zs)).normalize(), xs = new THREE.Vector3().crossVectors(ys, zs);
    const zc = INTO.clone(), yc = LEAN.clone().addScaledVector(zc, -LEAN.dot(zc)).normalize(), xc = new THREE.Vector3().crossVectors(yc, zc);
    const R = new THREE.Matrix4().makeBasis(xc, yc, zc).multiply(new THREE.Matrix4().makeBasis(xs, ys, zs).transpose()), k = W.fit / long;
    const M = new THREE.Matrix4().makeTranslation(MOUTH.x, MOUTH.y + (W.lid ? 0.02 : 0), MOUTH.z).multiply(R).multiply(new THREE.Matrix4().makeScale(k, k, k)).multiply(new THREE.Matrix4().makeTranslation(-W.p[0], -W.p[1], -W.p[2]));
    return (fits[kind] = { M, k, tris: count(g) });
  }
  const P = new THREE.Vector3(), Q = new THREE.Quaternion(), S3 = new THREE.Vector3(), M1 = new THREE.Matrix4(), M2 = new THREE.Matrix4(), inv = new THREE.Matrix4();
  // how far under a matrix's origin the lowest corner of a shell is, once turned and sized by it
  const lowest = (geo, m) => { const p = geo.attributes.position; let lo = Infinity; for (let i = 0; i < p.count; i += 3) { P.fromBufferAttribute(p, i).applyMatrix4(m); lo = Math.min(lo, P.y); } return lo; };
  const shells = [0, 1].map(() => { const mesh = new THREE.Mesh(geoOf('snail'), shellMat); mesh.matrixAutoUpdate = false; mesh.castShadow = true; mesh.visible = false; group.add(mesh); return { mesh, kind: 'snail', mode: 'off', M: new THREE.Matrix4(), from: new THREE.Matrix4(), t: 0 }; });
  let worn = shells[0];
  function setKind(sh, kind) { sh.kind = HERMIT_WEAR[kind] ? kind : 'snail'; sh.mesh.geometry = geoOf(sh.kind); }
  // put a shell on it at once
  function wear(kind = 'snail') { setKind(worn, kind); worn.mode = 'worn'; worn.mesh.visible = true; return worn; }
  // a shell lying on the ground: of a kind, at x, z in the parent's space, its mouth turned toward `face` radians (as a crab's yaw), on the ground there; big: this many times the size it would be on this crab
  function lay_(sh, kind, x, z, face, ground, big = 1) {
    setKind(sh, kind); const f = fitOf(sh.kind), sc = group.scale.x * big; M1.makeRotationY(face).multiply(M2.makeScale(sc, sc, sc)).multiply(f.M); M1.multiply(M2.makeRotationX(0.25));
    P.set(x, 0, z); ground(P); const lo = lowest(geoOf(sh.kind), M1); M1.elements[12] += x; M1.elements[13] += P.y - lo; M1.elements[14] += z;
    sh.M.copy(M1); sh.mode = 'lying'; sh.mesh.visible = true; return sh;
  }
  const spare = () => (worn === shells[0] ? shells[1] : shells[0]);
  // it lets go of its shell: the shell stays where it is in the world, slides back off it and settles on the ground under it
  function leave(ground) { if (worn.mode !== 'worn') return null; const sh = worn; group.updateMatrix(); sh.from.copy(group.matrix).multiply(fitOf(sh.kind).M);
    sh.from.decompose(P, Q, S3); P.addScaledVector(INTO.clone().applyQuaternion(group.quaternion).setY(0).normalize(), 0.14 * group.scale.x); const lo = lowest(geoOf(sh.kind), M1.compose(new THREE.Vector3(), Q, S3)); const at = P.clone(); ground(at); P.y = at.y - lo;
    sh.M.compose(P, Q, S3); sh.mode = 'going'; sh.t = 0; worn = spare(); worn.mode = worn.mode === 'worn' ? 'off' : worn.mode; return sh; }
  // a shell lying by it is drawn on over its back half
  function enter(sh = spare()) { if (sh.mode !== 'lying' && sh.mode !== 'going') return; if (worn !== sh && worn.mode === 'worn') return; sh.from.copy(sh.M); sh.mode = 'coming'; sh.t = 0; worn = sh; }

  const pose = { in: 0, peer: 0, hold: 0, probe: 0, raise: 0, pitch: 0, roll: 0, gaze: new THREE.Vector3(0, 0.05, 0.4), naked: 0 }, at = new THREE.Vector3(), face = new THREE.Vector3(), gazeTo = new THREE.Vector3();
  const moving = new THREE.Vector3(), water = new THREE.Vector3(), opts = { scale: 1, moving, water: null };
  const Z1 = new THREE.Vector3(), U1 = new THREE.Vector3(), X1 = new THREE.Vector3(), T1 = new THREE.Vector3(), D1 = new THREE.Vector3(), aim = new THREE.Object3D(), MB = new THREE.Matrix4(), QX = new THREE.Quaternion(), crabInv = new THREE.Matrix4();

  // s: x, z, yaw, vx, vz, ground, treadmill as legs.js takes them, and time (seconds, for what fidgets). The mood:
  //   in: true, drawn right in; peer: true with it, looking out over its claw     act: 'pick' | 'probe' | 'hold' | 'walk' | null
  //   look: a point to turn its eyes to; at: the point its claws go to, probing or holding (both in the parent's space)
  function update(dt, s) {
    const t = s.time || 0, sc = group.scale.x, act = s.act || null, inShell = !!s.in && worn.mode === 'worn';
    pose.in = damp(pose.in, inShell ? (s.peer ? 0.58 : 1) : 0, inShell ? 14 : 2.6, dt); // it goes in at once, and comes out slowly
    pose.peer = damp(pose.peer, inShell && s.peer ? 1 : 0, 6, dt); pose.hold = damp(pose.hold, act === 'hold' ? 1 : 0, 5, dt); pose.probe = damp(pose.probe, act === 'probe' ? 1 : 0, 5, dt);
    const k = pose.in, sunk = clamp(k * 1.7, 0, 1);
    // the shell on its side on the sand when it is in; carried over its feet when it walks, and tipped a little forward when it reaches with both claws
    const f = fitOf(worn.kind), rest = worn.mode === 'worn' ? -lowest(geoOf(worn.kind), M1.makeRotationX(0.3 * sunk).multiply(f.M)) + 0.004 : HERMIT.ride;
    pose.raise = damp(pose.raise, sunk * rest + (1 - sunk) * (0.012 * pose.hold), 8, dt);
    pose.pitch = damp(pose.pitch, 0.3 * sunk - 0.2 * pose.hold + 0.12 * pose.probe, 6, dt);
    // drawn in, the front of it goes back up the shell's mouth, and the legs with it
    crab.position.copy(INTO).multiplyScalar(DEPTH * k);
    for (const l of legs) { l.hip.copy(l.base).addScaledVector(INTO, DEPTH * k); l.curl.copy(l.hip).addScaledVector(INTO, 0.02).setY(l.hip.y - 0.01); l.upper.visible = l.lower.visible = k < 0.8; }
    walker.update(dt, { ...s, crouch: 0.2 * pose.probe, limp: sunk > 0.97 ? 1 : sunk, raise: pose.raise, pitch: pose.pitch, roll: 0.04 * Math.sin(t * 2.3) * Math.min(1, Math.hypot(s.vx || 0, s.vz || 0) / (0.1 * sc)) });
    group.updateMatrix(); inv.copy(group.matrix).invert(); crab.updateMatrix(); crabInv.copy(group.matrix).multiply(crab.matrix).invert();

    // the shells: worn in the body's space; lying, or on the way, where they are in the world
    for (const sh of shells) {
      if (sh.mode === 'worn') { MB.copy(f.M).premultiply(M1.makeRotationZ(0.03 * Math.sin(t * 4.6) * Math.min(1, Math.hypot(s.vx || 0, s.vz || 0) / (0.1 * sc)))); sh.mesh.matrix.copy(MB); } // it rocks as it is carried
      else if (sh.mode === 'lying') sh.mesh.matrix.multiplyMatrices(inv, sh.M);
      else if (sh.mode === 'going' || sh.mode === 'coming') { sh.t = Math.min(1, sh.t + dt / (sh.mode === 'going' ? 0.45 : 0.7)); const e = ease(sh.t);
        const to = sh.mode === 'going' ? sh.M : M2.copy(group.matrix).multiply(fitOf(sh.kind).M); blend(sh.from, to, e, M1); sh.mesh.matrix.multiplyMatrices(inv, M1);
        if (sh.t >= 1) sh.mode = sh.mode === 'going' ? 'lying' : 'worn'; }
      sh.mesh.matrixWorldNeedsUpdate = true; }
    pose.naked = damp(pose.naked, worn.mode === 'worn' ? 0 : 1, worn.mode === 'coming' ? 3 : 9, dt);
    tail.visible = pose.naked > 0.02; tail.rotation.set(0.12 * Math.sin(t * 1.7) * pose.naked, 0.15 * Math.sin(t * 1.1) * pose.naked, 0);

    // the claws, in the crab's own space: +z ahead of its face
    if (s.look) face.copy(s.look).applyMatrix4(crabInv); else face.set(0, 0, 1);
    if (s.at) at.copy(s.at).applyMatrix4(crabInv); else at.set(0, 0, 0.2);
    for (const c of claws) {
      const K = c.side, pick = 0.5 - 0.5 * Math.cos(t * 2.7 + (c.big ? 1.6 : 0)); let open = 0.15, quick = 10; c.up.set(0, 1, 0);
      if (k > 0.3) { if (c.big) { c.to.set(-0.004, -0.012 + 0.03 * pose.peer, 0.055 + 0.01 * pose.peer); c.up.set(0, 0.2, 1); open = 0.02; } else { c.to.set(0.012, -0.02, 0.045); open = 0.05; } quick = 18; } // the big one turned flat across the mouth: the door
      else if (pose.probe > 0.3) { c.to.copy(at).add(T1.set(K * 0.012, 0.01 * Math.sin(t * 6 + K), -0.01 + 0.012 * Math.sin(t * 3.1 + K * 2))); open = 0.25 + 0.25 * Math.sin(t * 7 + K); quick = 7; }
      else if (pose.hold > 0.3) { c.to.copy(at).add(T1.set(K * 0.03, 0, -0.01)); open = 0.02; quick = 8; }
      else if (c.big) { c.to.set(K * 0.025, -0.035 + 0.006 * Math.sin(t * 1.3), 0.115); open = 0.12; c.up.set(0.6 * K, 0.8, 0.3); } // held folded before its face, as hermit crabs carry it
      else if (act === 'pick') { c.to.set(K * lerp(0.03, 0.05, pick), lerp(-0.02, -0.075, pick), lerp(0.085, 0.14, pick)); open = 0.1 + 0.45 * pick; quick = 12; } // down to the sand and back to the mouth
      else { c.to.set(K * 0.035, -0.04, 0.12); open = 0.15; }
      c.wrist.lerp(c.to, 1 - Math.exp(-quick * dt)); c.open = damp(c.open, open, 12, dt);
      twoBone(c.shoulder, c.wrist, c.l1, c.l2, c.pole, c.elbow); lay(c.arm, c.shoulder, c.elbow, UP); lay(c.hand, c.elbow, c.wrist, c.up);
      c.finger.rotation.x = -c.open;
    }
    // the eyes: both turn together to what it looks at; peering, they stand up high over the claw; drawn in they are laid back
    if (s.look) gazeTo.copy(face); else if (pose.probe > 0.3 || pose.hold > 0.3) gazeTo.copy(at); else gazeTo.set(0.25 * Math.sin(t * 0.43) + 0.12 * Math.sin(t * 1.37), 0.05 * Math.sin(t * 0.61), 0.4);
    pose.gaze.lerp(gazeTo, 1 - Math.exp(-8 * dt));
    for (const e of eyes) { const K = e.side, down = k > 0.3 && pose.peer < 0.5;
      if (down) { U1.set(K * 0.2, 0.15, -1); Z1.set(0, 1, 0.2); } // laid back into the shell
      else { Z1.copy(pose.gaze).sub(T1.copy(e.socket).setY(e.socket.y + HERMIT.stalk)); const flat = Math.hypot(Z1.x, Z1.z) || 1; Z1.set(Z1.x / flat, clamp(Z1.y / flat, -0.6, 0.6) * 0.5, Math.max(Z1.z / flat, 0.25)).normalize();
        U1.set(K * (0.25 - 0.15 * pose.peer), 1, 0.15 + 0.3 * pose.peer).addScaledVector(Z1, 0.2); }
      U1.normalize(); X1.crossVectors(U1, Z1).normalize(); T1.crossVectors(X1, U1); QX.setFromRotationMatrix(MB.makeBasis(X1, U1, T1));
      e.mesh.quaternion.slerp(QX, 1 - Math.exp(-(down ? 16 : 9) * dt)); e.ball.quaternion.identity(); }
    // the feelers: the long ones sweep, the short ones flick; drawn in, they are drawn in with it
    moving.set(s.treadmill ? 0 : s.vx || 0, 0, s.treadmill ? 0 : s.vz || 0); opts.scale = sc; opts.water = s.treadmill ? water.set(-(s.vx || 0), 0, -(s.vz || 0)) : null;
    for (const fl of feelers) { const st = fl.st, long = fl.long > 0.1, K = fl.side, tuck = k > 0.3 && pose.peer < 0.5 ? 1 : 0;
      const flick = long ? 0 : Math.max(0, Math.sin(t * (pose.peer > 0.5 ? 9 : 4.4) + fl.ph)) ** 8, lash = long ? 0.35 + 0.25 * pose.peer : 0.12;
      T1.copy(fl.root); st.shape[0].copy(T1);
      for (let i = 0; i < st.n; i++) { const u = (i + 0.5) / st.n;
        D1.copy(fl.way); D1.x += K * lash * u * Math.sin(t * (long ? 1.4 : 2.6) + fl.ph + u * 1.4); D1.y += lash * 0.5 * u * Math.sin(t * 0.9 + fl.ph * 1.7) - flick * 1.2; D1.z += flick * 0.5;
        if (tuck) D1.lerp(INTO, 0.85); else if (pose.probe > 0.3) D1.lerp(T1.clone().sub(fl.root).set(at.x - fl.root.x, at.y - fl.root.y, at.z - fl.root.z).normalize(), 0.5 * u);
        D1.normalize(); T1.addScaledVector(D1, fl.cuts[i + 1] - fl.cuts[i]); st.shape[i + 1].copy(T1); }
      st.trail(dt, crab, crabInv, opts); }
  }
  // a matrix part of the way from one to another, by turning and moving (not by mixing their numbers)
  const PA = new THREE.Vector3(), PB = new THREE.Vector3(), QA = new THREE.Quaternion(), QB = new THREE.Quaternion(), SA = new THREE.Vector3(), SB = new THREE.Vector3();
  function blend(A, B, e, out) { A.decompose(PA, QA, SA); B.decompose(PB, QB, SB); const lift = Math.sin(Math.PI * e) * 0.05 * group.scale.x; PA.lerp(PB, e); PA.y += lift; return out.compose(PA, QA.slerp(QB, e), SA.lerp(SB, e)); }

  // ---- on the stand in the library: each thing it does, played over and over, the ground going by under it when it walks
  const stand = { time: 0, loop: -1, kind: 1, look: new THREE.Vector3(), at: new THREE.Vector3() };
  const ground = (p) => { p.y = -HERMIT.ride * group.scale.x; return p; };
  const LOOP = 9; // moving house, a loop: it feels the empty shell, lets go of its own, turns, backs into the new one, and turns back
  function show(dt, state, speed) {
    stand.time += dt; const sc = group.scale.x, id = state.id, t = stand.time;
    let yaw = 0, vz = 0, act = null, inn = false, peer = false, look = null, atP = null;
    if (id === 'walk') { vz = speed * sc; act = 'walk'; }
    else if (id === 'wardrobe') { vz = speed * sc; const n = Math.floor(t / 2.6) % HERMIT_SHELLS.length; if (worn.kind !== HERMIT_SHELLS[n] && worn.mode === 'worn') wear(HERMIT_SHELLS[n]); }
    else if (id === 'pick') act = 'pick';
    else if (id === 'in') inn = true;
    else if (id === 'peer') { inn = true; peer = true; look = stand.look.set(0.4 * Math.sin(t * 0.7) * sc, 0.1 * sc, 0.6 * sc); }
    else if (id === 'hold') { act = 'hold'; atP = stand.at.set(0, 0.02 * sc, 0.2 * sc); }
    else if (id === 'probe' || id === 'change') {
      const loop = Math.floor(t / LOOP), q = (t % LOOP) / LOOP;
      if (loop !== stand.loop) { stand.loop = loop; // a new empty shell in front of it, mouth toward it; its own shell on its back
        if (id === 'change') { stand.kind = (stand.kind % (HERMIT_SHELLS.length - 1)) + 1; } else stand.kind = 0;
        const keep = worn.kind; worn.mode = 'off'; worn.mesh.visible = false; spare().mode = 'off'; wear(id === 'probe' ? 'snail' : keep); lay_(spare(), id === 'probe' ? 'horn' : HERMIT_SHELLS[stand.kind], 0, 0.15 * sc, Math.PI + (id === 'probe' ? 0.5 * Math.sin(t) : 0), ground); }
      const sp = spare();
      if (id === 'probe' || q < 0.24) { act = 'probe'; atP = stand.at.set(0, -0.03 * sc, 0.16 * sc); }
      else if (q < 0.3) { if (worn.mode === 'worn') leave(ground); }
      else if (q < 0.5) yaw = Math.PI * ease((q - 0.3) / 0.2); // it turns round on the spot, its back half bare
      else if (q < 0.62) { yaw = Math.PI; if (worn.mode !== 'worn' && worn.mode !== 'coming' && sp.mode !== 'coming') enter(shells.find((x) => x.mode === 'lying' && Math.abs(x.M.elements[14] - 0.15 * sc) < 0.08 * sc) || sp); }
      else if (q < 0.82) { yaw = Math.PI; act = 'pick'; }
      else yaw = Math.PI * (1 + ease((q - 0.82) / 0.18));
      if (id === 'probe') { // it turns the empty shell over to look in it
        const turn = 0.6 * Math.sin(t * 0.9); lay_(sp, 'horn', 0, 0.15 * sc, Math.PI + turn, ground); }
    }
    if (id !== 'probe' && id !== 'change') { stand.loop = -1; const sp = spare(); if (sp.mode !== 'off') { sp.mode = 'off'; sp.mesh.visible = false; } if (worn.mode !== 'worn' && worn.mode !== 'coming') wear(worn.kind); } // nothing left lying about from another state
    if (worn.mode === 'off' && !shells.some((x) => x.mode === 'coming')) wear(worn.kind);
    update(dt, { x: 0, z: 0, yaw, vx: 0, vz, treadmill: true, ground, time: t, in: inn, peer, act, look, at: atP });
  }
  wear('snail');
  a.object = group;
  a.rig = { update, show, wear, leave, enter, lay: lay_, walker, claws, eyes, feelers, legs, shells, tail, pose, get worn() { return worn; }, get triangles() { return Math.round(triangles + count(geoOf(worn.kind)) + (tail.visible ? tailTris : 0)); } };
  return a.rig;
}
