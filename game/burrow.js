// The shrimp goby and the pistol shrimp at the hole they share, in motion: one component, because what each does is half of what the other does.
// The patch of sand round the hole is the component's model; this puts the two animals on it, each made of pieces (critters.js: BURROW, GOBY,
// SHRIMP and the pieces). The goby's body bends on a neck (spine.js), so it turns its head to look and flicks its tail; its tall first back fin,
// its two pectorals and its tail are pieces. The shrimp is a front half, five rings of tail that curl one after another and a fan, six walking legs,
// a great snapping claw and a small one, and four feelers that trail (strands.js); and the load of sand it pushes. Not in the dive yet: nothing makes
// it but the specimen library and the testing tool in the pause menu. Its moods (`update(dt, { mood, k })`, k going 0 to 1 through the ones that
// are a sequence; whoever owns it moves k and chooses the mood):
//   watch   the goby propped at the mouth on its belly fins and pectorals, turning its head; the shrimp just inside the mouth, claws and feelers out,
//           one long feeler laid on the goby
//   work    the shrimp comes out with a load of sand before its claws, pushes it up onto the heap, and backs into the hole again, its feeler on the goby
//           all the while; the goby watches
//   flick   the goby's quick tail flicks and its back fin up: the warning. The shrimp stops where it is and backs down into the mouth
//   gone    a flick, and the goby turns and goes down the hole head first; the shrimp is already in. The mouth stays empty a while; then the goby
//           comes up again
//   snap    the shrimp out on the sand: the great claw cocks open, and snaps, and where the jet goes a bubble flashes and is gone
// What was taken from the real animals, and where it was read:
//   The shrimp digs and keeps the burrow and the goby guards the mouth; above ground the shrimp keeps an antenna almost all the time on the goby's
//   fins and reads its warnings. At a middle threat the goby gives a brief fast flick and the shrimp goes out less; at a bad one the goby goes into
//   the burrow head first and both stay inside for several minutes. The shrimp leaves the burrow only when the goby signals that it is safe
//   (Landsittel, Ermentrout and Stiefel 2021, Journal of Computational Neuroscience, as summarised in the research notes). The goby signals with a
//   tail movement, and both go in (Wikipedia, "Alpheidae"). In the snapping shrimps one claw is oversized, often more than half the body; in Alpheus
//   an outgrowth of the shell, the orbital hood, covers the eyes (Wikipedia, "Alpheidae"). The snap is the collapse of a bubble made by a jet of
//   water driven out of the claw by a plunger on the moving finger (Versluis et al. 2000, Science, in the research notes).
//   The goby here is the yellow shrimp goby, Cryptocentrus cinctus, 7.5 to 10 cm, which shares its burrow with alpheid shrimps and keeps a lookout
//   at the entrance; it comes in forms from whitish to dark, the yellow not the commonest, with spotted fins and a dark stripe over the lip
//   (Australian Museum; Wikipedia, "Yellow prawn-goby"). The shrimp is the tiger pistol shrimp, Alpheus bellulus, 4 to 5 cm, yellowish white with a
//   netted pattern in light brown, purplish or orange-brown, banded legs and red antennae, poor-sighted, which lives with Cryptocentrus cinctus
//   (Wikipedia, "Tiger pistol shrimp").
// Modelled from description only: the goby's shape (the sources give its colour and size, not its outline: the big head, the high eyes, the
// joined belly fins as a disc are from what gobies are), the pale blue spots, how high it props itself, and the shape of the shrimp's claw. Both
// are made four times their real size: a 40 cm goby and a 20 cm shrimp.
import * as THREE from 'three';
import { createBundle } from './strands.js';
import { bendy } from './spine.js';
import { twoBone, lay } from './legs.js';
import { BURROW, GOBY, SHRIMP, burrowY, goby, gobyFin, shrimp, shrimpSegment, shrimpFan, shrimpClaw, shrimpLeg, shrimpFeeler, sandLoad } from './critters.js';
import { clamp, lerp, damp } from './geo.js';

const ease = (t) => t * t * (3 - 2 * t), band = (k, a, b) => clamp((k - a) / (b - a), 0, 1), UP = new THREE.Vector3(0, 1, 0);
const OUT = new THREE.Vector3(Math.cos(BURROW.heap), 0, Math.sin(BURROW.heap)), SHRIMP_YAW = Math.atan2(OUT.x, OUT.z); // the way to the heap, and the shrimp's heading going there
const PERCH = new THREE.Vector3(-0.07, 0, 0.075), FACE = -0.55; // where the goby sits on the rim, beside the mouth and away from the heap, and which way it faces

// a: the creature as npc.js makes it (a.body: the sand round the hole). flash: a sprite for the snap's bubble. Returns the rig; a.object is the whole of it.
export function burrowRig(a, pal, { flash = null } = {}) {
  const group = new THREE.Group(), mat = a.body.material; group.name = 'burrow'; group.add(a.body);
  const count = (g) => g.attributes.position.count / 3; let triangles = count(a.body.geometry);
  const own = (geo) => { a.owned.push(geo); triangles += count(geo); return geo; };
  const piece = (geo, parent, m = mat) => { const mesh = new THREE.Mesh(geo, m); mesh.castShadow = true; parent.add(mesh); return mesh; };
  // ---- the goby: a body that bends, and its fins
  const gmat = mat.clone(); a.owned.push(gmat); bendy(gmat, { neck: GOBY.neck });
  const fish = new THREE.Group(); fish.rotation.order = 'YXZ'; group.add(fish); const gbody = piece(own(goby(pal)), fish, gmat);
  const fmat = mat.clone(); a.owned.push(fmat);
  const dorsal = piece(own(gobyFin(pal, 'dorsal')), fish, fmat), tailFin = piece(own(gobyFin(pal, 'tail')), fish, fmat), pg = own(gobyFin(pal, 'pectoral'));
  const pects = [1, -1].map((s) => { const m = piece(pg, fish, fmat); m.scale.x = s; triangles += s < 0 ? count(pg) : 0; return { s, m }; });
  const N = GOBY.neck, bent = (x, y, z, out) => { const head = gmat.userData.head, c = gmat.userData.curve.value, f = ease(clamp((z - (N - 0.45)) / 0.9, 0, 1)), ta = head.x * f, tb = head.y * f;
    let zz = z - N; const back = Math.max(0, N - z), x1 = x * Math.cos(ta) + zz * Math.sin(ta); zz = zz * Math.cos(ta) - x * Math.sin(ta); const y1 = y * Math.cos(tb) + zz * Math.sin(tb); zz = zz * Math.cos(tb) - y * Math.sin(tb);
    return out.set(x1 + c * back * back, y1, N + zz); };
  const slope = (z) => -2 * gmat.userData.curve.value * Math.max(0, N - z);
  // ---- the shrimp: the front, five rings and a fan, legs, claws, feelers, and its load
  const sh = new THREE.Group(); sh.rotation.order = 'YXZ'; group.add(sh); piece(own(shrimp(pal)), sh);
  const rings = SHRIMP.segments.map((d, i) => { const g = new THREE.Group(); piece(own(shrimpSegment(pal, i)), g); return { g, l: d[0] }; });
  rings.forEach((r, i) => { (i ? rings[i - 1].g : sh).add(r.g); r.g.position.z = i ? -rings[i - 1].l : 0.012; }); const fan = piece(own(shrimpFan(pal)), rings[4].g); fan.position.z = -rings[4].l;
  const legGeo = own(shrimpLeg(pal)); triangles += 5 * count(legGeo);
  const legs = SHRIMP.legs.map((l) => { const m = piece(legGeo, sh); m.position.set(...l.hip); m.scale.x = l.side; return { ...l, m }; });
  const claws = SHRIMP.claws.map((c) => { const g = shrimpClaw(pal, c); own(g.arm); own(g.hand); own(g.finger); const arm = piece(g.arm, sh), hand = piece(g.hand, sh), finger = piece(g.finger, hand); finger.position.set(...g.hinge);
    return { ...c, shoulder: new THREE.Vector3(...c.shoulder), arm, hand, finger, wrist: new THREE.Vector3(c.side * 0.02, -0.02, 0.13), elbow: new THREE.Vector3(), to: new THREE.Vector3(), pole: new THREE.Vector3(c.side, 1, 0), open: 0 }; });
  const strands = SHRIMP.feelers.map((f) => ({ geometry: shrimpFeeler(pal, f), cuts: f.cuts, feel: f.long > 0.1 ? { stiff: [5, 1.4], drag: [1, 3], ease: 0.8 } : { stiff: [10, 5], drag: [1, 2], ease: 0.85 } }));
  const bundle = createBundle(strands, mat); sh.add(bundle.mesh); a.owned.push(bundle); triangles += strands.reduce((t, s) => t + count(s.geometry), 0); for (const s of strands) s.geometry.dispose();
  const feelers = SHRIMP.feelers.map((f, i) => ({ ...f, st: bundle.strands[i], root: new THREE.Vector3(...f.root), way: new THREE.Vector3(...f.way).normalize(), ph: i * 2.2 }));
  const load = piece(own(sandLoad(pal)), group); load.visible = false;
  if (flash) { group.add(flash); flash.visible = false; }

  const p = { t: 0, head: 0, flick: 0, fin: 0.3, pect: 0, curl: 0.08, step: 0, touch: 1, gk: -1, cock: 0, bubble: 0, mood: 'watch', dumped: -1 };
  const T1 = new THREE.Vector3(), T2 = new THREE.Vector3(), D1 = new THREE.Vector3(), inv = new THREE.Matrix4(), shInv = new THREE.Matrix4(), opts = { scale: 1, moving: new THREE.Vector3(), water: null };
  const contact = new THREE.Vector3(); // the point on the goby the shrimp's feeler is laid on, in the burrow's space

  // The goby, in the burrow's space: where it is, how it lies, and whether it can be seen. dive: 0 on its perch, to 1 gone down the hole head first
  function placeGoby(dt, s, dive, rise) {
    const t = p.t;
    if (dive > 0) { // it turns over the mouth and goes in head first
      const turn = ease(band(dive, 0, 0.3)), down = ease(band(dive, 0.15, 1)); fish.position.set(lerp(PERCH.x, 0, turn), lerp(GOBY.perch + burrowY(PERCH.x, PERCH.z), -0.34, down), lerp(PERCH.z, -0.06, turn) + 0.02 * down);
      fish.rotation.set(lerp(-0.12, 1.45, turn), lerp(FACE, Math.PI, turn), 0); fish.visible = fish.position.y > -0.3; }
    else if (rise > 0) { // and comes up again, head first, and settles
      const up = ease(band(rise, 0, 0.6)), settle = ease(band(rise, 0.5, 1)); fish.position.set(lerp(0, PERCH.x, settle), lerp(-0.3, GOBY.perch + burrowY(PERCH.x, PERCH.z), up), lerp(0, PERCH.z, settle));
      fish.rotation.set(lerp(-1.3, -0.12, settle), FACE, 0); fish.visible = fish.position.y > -0.28; }
    else { fish.position.set(PERCH.x, GOBY.perch + burrowY(PERCH.x, PERCH.z) + 0.003 * Math.sin(t * 1.3), PERCH.z); fish.rotation.set(-0.12 - 0.04 * p.flick, FACE, 0.02 * Math.sin(t * 0.7)); fish.visible = true; }
    // its head turns to look, and its tail flicks: the body bends; the fins go with it
    gmat.userData.head.set(p.head, 0.05 * Math.sin(t * 0.9)); gmat.userData.curve.value = p.flick * 0.9 * Math.sin(t * 38);
    bent(0, GOBY.body[3][2] * 0.95 + 0.001, GOBY.dorsal[0], dorsal.position); dorsal.rotation.set(-1.25 * (1 - p.fin), 0, 0);
    bent(0, 0, GOBY.tail, tailFin.position); tailFin.rotation.set(0, Math.atan(slope(GOBY.tail)) + p.flick * 0.7 * Math.sin(t * 38 - 0.8), 0);
    for (const q of pects) { bent(q.s * GOBY.pectoral[0], GOBY.pectoral[1], GOBY.pectoral[2], q.m.position); q.m.rotation.set(0, q.s * (0.35 + 0.15 * Math.sin(t * 5 + q.s) * (1 - p.pect)), q.s * lerp(-0.3, -1.25, p.pect)); } // propped: the pectorals turned down onto the sand
    fish.updateMatrix(); bent(0.025, 0.02, -0.1, contact).applyMatrix4(fish.matrix); // where along its flank the feeler is laid
  }
  // The shrimp, in the burrow's space: d how far out from the middle of the mouth toward the heap, y over the sand there (negative: down the hole),
  // pitch (its head up, negative), and whether it walks
  function placeShrimp(d, y, pitch, walk) {
    const x = OUT.x * d, z = OUT.z * d; sh.position.set(x, burrowY(x, z) + 0.024 + y, z); sh.rotation.set(pitch, SHRIMP_YAW, 0); sh.visible = sh.position.y > -0.2;
    p.step += walk; for (const l of legs) { const w = Math.sin(p.step * 14 + l.ph); l.m.rotation.set(0, l.side * 0.35 * w * Math.min(1, walk * 60), l.side * (-0.2 - 0.25 * Math.max(0, w) * Math.min(1, walk * 60))); }
    rings.forEach((r, i) => { r.g.rotation.x = p.curl * (0.7 + 0.3 * i / 4); }); fan.rotation.x = p.curl * 0.6;
  }
  // s: mood (above), k (0 to 1 through it), time; look: a point for the goby to turn its head to (burrow space), or none
  function update(dt, s) {
    p.t = s.time ?? p.t + dt; const t = p.t, mood = s.mood || 'watch', k = s.k || 0;
    let dive = 0, rise = 0, flick = 0, fin = 0.35 + 0.15 * Math.sin(t * 0.8), d = 0.02, y = -0.03, pitch = -0.45, walk = 0, carry = false, touch = 1, cock = 0, curl = 0.12;
    if (mood === 'watch') { /* as above: the shrimp in the mouth, claws out */ }
    else if (mood === 'work') { if (k < 0.18) { const e = ease(k / 0.18); d = lerp(0.0, 0.07, e); y = lerp(-0.08, 0, e); pitch = lerp(-0.9, 0, e); carry = true; walk = dt * 0.8; }
      else if (k < 0.45) { const e = (k - 0.18) / 0.27; d = lerp(0.07, 0.2, e); y = 0; pitch = 0.05; carry = true; walk = dt; } // pushing the load ahead of it
      else if (k < 0.55) { d = 0.2; y = 0; pitch = -0.1 * Math.sin(Math.PI * (k - 0.45) / 0.1); } // it tips the load onto the heap
      else if (k < 0.86) { d = lerp(0.2, 0.03, ease((k - 0.55) / 0.31)); y = 0; pitch = 0; walk = dt; curl = 0.25; } // and backs to the hole
      else { const e = ease((k - 0.86) / 0.14); d = 0.02 * (1 - e); y = lerp(0, -0.1, e); pitch = lerp(0, -0.9, e); curl = 0.4; } }
    else if (mood === 'flick') { const q = (t % 1.6) / 1.6; flick = q < 0.35 ? 1 : 0; fin = 1; d = 0.01; y = -0.075; pitch = -0.7; curl = 0.35; } // it backs down into the mouth: only its feelers out
    else if (mood === 'gone') { if (k < 0.12) { flick = 1; fin = 1; } dive = k >= 0.12 && k < 0.75 ? (k - 0.12) / 0.2 : 0; rise = k >= 0.75 ? (k - 0.75) / 0.25 : 0; if (dive > 1) dive = 1; d = 0; y = k < 0.12 ? -0.08 : -0.3; pitch = -1.2; touch = k < 0.12 ? 1 : 0; }
    else if (mood === 'snap') { d = 0.13; y = 0; pitch = -0.08; touch = 0; cock = k < 0.6 ? ease(k / 0.6) : k < 0.63 ? 1 - (k - 0.6) / 0.03 : 0; }
    p.flick = damp(p.flick, flick, flick ? 30 : 6, dt); p.fin = damp(p.fin, fin, 10, dt); p.pect = damp(p.pect, dive || rise ? 0 : 1, 6, dt); p.curl = damp(p.curl, curl, 6, dt); p.touch = damp(p.touch, touch, 4, dt);
    p.head = damp(p.head, s.look ? clamp(Math.atan2(Math.sin(Math.atan2(s.look.x - PERCH.x, s.look.z - PERCH.z) - FACE), Math.cos(Math.atan2(s.look.x - PERCH.x, s.look.z - PERCH.z) - FACE)), -0.5, 0.5) : 0.4 * Math.sin(t * 0.43) + 0.15 * Math.sin(t * 1.7), 3, dt);
    placeGoby(dt, s, dive, rise); placeShrimp(d, y, pitch, walk);
    group.updateMatrix(); inv.copy(group.matrix).invert(); sh.updateMatrix(); shInv.copy(sh.matrix).invert();
    // the claws: held before its face, the great one over the small; pushing, both down behind the load; cocking, the great one up and open
    p.cock = cock;
    for (const c of claws) { const K = c.side; let open = 0.15;
      if (cock > 0 && c.big) { c.to.set(K * 0.01, 0.02, 0.15); open = 1.5 * cock; }
      else if (carry) { c.to.set(K * 0.018, -0.016, 0.125); open = 0.25; }
      else { c.to.set(K * 0.02, -0.008 + 0.004 * Math.sin(t * 2 + K), c.big ? 0.14 : 0.12); open = 0.1 + 0.1 * Math.sin(t * 3 + K); }
      c.wrist.lerp(c.to, 1 - Math.exp(-14 * dt)); c.open = cock > 0 || !c.big ? damp(c.open, open, 12, dt) : (p.bubble > 0.9 ? 0 : damp(c.open, open, 12, dt));
      twoBone(c.shoulder, c.wrist, c.l1, c.l2, c.pole, c.elbow); lay(c.arm, c.shoulder, c.elbow, UP); lay(c.hand, c.elbow, c.wrist, UP); c.finger.rotation.x = -c.open; }
    // the snap: when the great claw shuts from cocked, a bubble flashes where the jet goes, a little before the claw, and is gone
    if (mood === 'snap' && k >= 0.6 && k < 0.66 && p.bubble === 0) p.bubble = 1; if (mood !== 'snap' || k < 0.6) p.bubble = 0;
    if (flash) { const b = p.bubble > 0 ? clamp(1 - (k - 0.6) / 0.12, 0, 1) : 0; flash.visible = b > 0; if (b > 0) { T1.set(-0.014, -0.004, 0.27).applyMatrix4(sh.matrix); flash.position.copy(T1); flash.scale.setScalar(0.05 + 0.25 * (1 - b)); flash.material.opacity = b; } }
    // the load of sand: before its claws while it pushes; tipped on the heap, it settles into it
    if (carry) { load.visible = true; T1.set(-0.004, -0.014, 0.16).applyMatrix4(sh.matrix); load.position.copy(T1); load.rotation.y = SHRIMP_YAW; load.scale.setScalar(1); p.dumped = -1; }
    else if (mood === 'work' && k >= 0.45) { if (p.dumped < 0) p.dumped = 0; p.dumped += dt; load.scale.setScalar(Math.max(0.01, 1 - p.dumped / 1.2)); load.position.y -= dt * 0.01; load.visible = p.dumped < 1.2; }
    else load.visible = false;
    // the feelers: the long one on the goby's side laid on its flank while it is out; the other sweeps; the short ones flick
    const sc = group.scale.x; opts.scale = sc;
    for (const f of feelers) { const st = f.st, long = f.long > 0.1, onGoby = long && f.side > 0 && p.touch > 0.05 && fish.visible;
      T1.copy(f.root); st.shape[0].copy(T1);
      if (onGoby) T2.copy(contact).applyMatrix4(shInv).sub(f.root).normalize();
      for (let i = 0; i < st.n; i++) { const u = (i + 0.5) / st.n;
        D1.copy(f.way); D1.x += f.side * (long ? 0.4 : 0.15) * u * Math.sin(t * (long ? 1.2 : 5) + f.ph + u * 1.5); D1.y += 0.2 * u * Math.sin(t * 0.8 + f.ph) - (long ? 0.4 * u * u : 0);
        D1.normalize(); if (onGoby) D1.lerp(T2, p.touch * clamp(1.4 - u * 0.3, 0, 1)).normalize();
        T1.addScaledVector(D1, f.cuts[i + 1] - f.cuts[i]); st.shape[i + 1].copy(T1); }
      st.trail(dt, sh, shInv, opts); }
  }
  // on the stand in the library: each mood, the ones that are a sequence played over and over
  const LOOP = { work: 6, gone: 7, snap: 2.4 }, stand = { time: 0 };
  function show(dt, state) { stand.time += dt; const id = state.id, k = LOOP[id] ? (stand.time % LOOP[id]) / LOOP[id] : 0; update(dt, { mood: id, k, time: stand.time }); }
  a.object = group; a.rig = { update, show, goby: fish, shrimp: sh, claws, legs, feelers, rings, load, pose: p, contact, triangles };
  return a.rig;
}
