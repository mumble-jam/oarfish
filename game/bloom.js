// The bloom water: the first new place in the first band, and the three creatures that live there. A crowd of moon jellies hanging in a shaft of
// sun over open bed, small fry sheltering under the bells, a few sea nettles at its edge with their trains streaming out on a slow current, and
// a shoal of reef squid that hunts the same small fish the oarfish does. Everything that decides is here; how each creature looks is its
// component's (npc.js) and its rig's (jelly.js, squid.js). Every number is in BLOOM, below.
//
// Where it stands is laid out by the world (world.js calls layBloom while it builds the first band) from a run of numbers of its own, so
// that no other band changes and nothing else in the first band moves to make room. What moves in it (createBloom) is made by main.js, as
// the hunters are, and runs beside them.
//
// What was taken from each real animal (the sources are in the research report "Oarfish first level expansion", sections 4, 5 and 9):
//   THE MOON JELLY, Aurelia aurita. True trait: a very mild sting (National Aquarium, "Moon jelly"), and among the jellyfish most often
//     recorded sheltering young fish, which retreat among its arms (Griffin et al. 2019, a review of 86 fish species that live with
//     jellyfish). So the bloom is cover and not danger: touching a bell costs nothing; a swarm of fry lives under the bells and cannot be
//     cornered from outside them; the bells give way round the body and come back behind it (that last is ours: a real bell is pushed, it
//     does not step aside). A second trait is used for the place, not the rule: in a Canadian fjord moon jellies swam toward the sun and
//     packed along one shore (Hamner et al. 1994). So this bloom hangs in a shaft of sun, which is what marks it from far off.
//   THE SEA NETTLE, the Pacific one, Chrysaora fuscescens. True trait: it cannot chase; its trailing tentacles and arms make a wide net that
//     stings on contact (Aquarium of the Pacific); blue rockfish that eat it keep clear of the tentacles and bite at the arms (Walla Walla
//     University's key). So the train is the danger and the bell is the safe end. Holding its place by swimming against the current is from
//     a flume study of another nettle (Zeman 2015, read through the report), and it is what makes every train here stream the same way,
//     so that the safe side is the same for all of them: up-current, by the bell. Taking fry that blunder into the train: it eats eggs,
//     larvae and slow small prey (Wikipedia, "Chrysaora fuscescens").
//   THE REEF SQUID. The model is the bigfin reef squid, Sepioteuthis lessoniana; almost all the behaviour is read from its Caribbean
//     cousin, S. sepioidea (Wikipedia, "Caribbean reef squid"): small shoals of about four to thirty by day in shallow water near reefs; a
//     daily intake of small fish of something like 30 to 60% of its own weight; a defence in steps, a bluff first, then paling and jetting
//     away, with ink kept for the most dangerous (The Cephalopod Page; Jaitly 2024). Ink that holds the animal's own shape and takes the
//     attack while the squid leaves, and other squid taking a neighbour's ink as an alarm, are written of cephalopods in general
//     (Wikipedia, "Cephalopod ink"). The strike with the two tentacles is from a third species, Loligo pealei (Kier and van Leeuwen 1997).
//     That a squid let alone settles and lets something come close is from hours of courtship approach and retreat in the Caribbean one;
//     the game of settling it is ours.
// The three meet each other: the squid hunt the fry under the bells; the fry, hunted, go toward the nettles' side, where the squid will not
// follow; a nettle's train takes a fry, or stings a squid, that blunders into it.
import * as THREE from 'three';
import { make, geometry, resolve } from './npc.js';
import { jellyCrowd } from './jelly.js';
import { rng, clamp, lerp, damp, glowTexture, beamTexture } from './geo.js';

// ---------------------------------------------------------------- every number, in one place
export const BLOOM = {
  // off: how far round from the way to the rift, either side (radians); dist: metres from the start; R: how far across the bells reach from its middle
  place: { off: [0.5, 0.85], dist: [62, 78], R: 13, tries: 400 },
  current: { speed: 0.5, swing: 0.6 }, // a slow current through it, outward from the start give or take `swing`: every nettle's train streams with it
  shafts: { n: 3, wide: [6, 9], tall: 44, glow: 0.3, colour: '#f4fff0' }, // the sun it hangs in: seen past the fog, as the rift's beam is
  // the moon jellies. scale: of the 0.4 m model (each bell 0.8 to 1.15 of it). high: how far over the bed. Every one is the whole animal, the same at
  // every distance, all drawn at once (jellyCrowd in jelly.js). part: how near a part of the body has to be before a bell gives way; push: how hard;
  // back: how fast it comes back. beat: strokes a second. lean: how far each lies over into the current
  moon: { n: 70, scale: 1.8, high: [1.6, 5.6], part: 1.7, push: 4, back: 0.9, beat: 0.5, lean: 0.35 },
  // the fry, a swarm of the smallest size (a few fish more than the band's food, and they come back: one every `back` seconds while nothing is in the bloom,
// up to their number; slow enough that waiting for them is never worth it). inside: how far in (of R) the head has to be before they can be cornered; hide: where they keep while it is
  // not (of R, from the middle); flee: how far toward the nettles' side they go when the squid hunt them (of R); drift: how far they wander
  fry: { inside: 0.85, hide: 0.15, flee: 0.62, drift: 1.4, high: 2.3, ease: 0.7, back: 25 },
  // the sea nettles. at: how far out (of R); apart: radians between them round the down-current side; wander: metres they drift along the edge;
  // scale: of the 3 m model; high: the bell over the bed. The train, for what it touches: from the bell, `train` metres long, going down-current
  // and sagging by `sag` (radians below level), `reach` metres thick; `bell`: a sphere round the bell that is safe. A sting: `cost` segments, the second
  // if `more` or more joints of the body (a joint to about 0.31 m) lie in the train at once within `look` seconds of the first touch; never the last of
  // the body (it stops at `keep` segments); and then not again from that nettle for `rest` seconds. `stream`: how fast the water seems to go by it,
  // which is what draws the train out (for the eye only). `fry`: a fish a second it takes
  // from a swarm whose middle is in its train
  nettle: { n: 3, at: 0.95, apart: 0.85, wander: 3.5, scale: 1.7, high: 5.2, stream: 1.1, train: 3.5, sag: 0.6, reach: 0.75, bell: 0.85, look: 0.4, rest: 2, cost: [1, 2], more: 6, keep: 6, fry: 0.6 },
  // the squid. n in the shoal; home: how far out (of R) on the up-current side; high: over the bed; swim, jet: metres a second
  // fright: see, calm (a closing speed under this frightens nothing), gain, crowd (more for being nearer than `close`), cool (what it loses a second,
  //   and `still`, more when the fish is all but still), and the three steps: bluff, flee, ink. A dash within `dash` metres, or a body drawn round it, is ink at once
  // raid: how far from home it will go for a swarm, how long it rests between raids, how many fish make a meal, a strike every `every` seconds for the
  //   shoal as a whole, `aim` seconds of taking aim first, and how far off the swarm's middle they hold. They go raiding only while the fish is within `wake`
//   metres of their home: what they take should be seen being taken
  // scatter: how far each jets on an alarm, and how long before the shoal gathers again
  squid: { n: 5, home: 0.95, high: 3.4, swim: 2.4, jet: 7, scale: 1,
    fright: { see: 10, calm: 0.9, gain: 0.55, crowd: 0.9, close: 1.7, cool: 0.22, still: 0.5, bluff: 0.3, flee: 0.65, ink: 1, dash: 6 },
    raid: { reach: 46, wake: 50, rest: 20, meal: 6, every: 2.6, aim: 0.7, ring: 1.7 },
    scatter: { far: 12, regroup: 14 } },
  ink: { hold: 2.6, fade: 2.4, swell: 1.8, colour: '#2a1c30' }, // the copy it leaves: holds its shape, then thins and spreads
  // The mini-game: settling the shoal. see: how near the head has to come for a try to start; near: how close to a squid it has to hang;
  // hold: seconds it has to stay there with the shoal calm (every squid's fright under `calm`) and the fish slower than `slow`; limit: seconds a try
  // may take before the shoal goes off hunting. grades: under each of these many seconds is a step up (1, 2, 3); 4 is the third done without a bluff
  settle: { see: 10, near: 3.2, hold: 2.5, calm: 0.2, slow: 1.3, limit: 60, grades: [45, 25, 14] },
};

const TAU = Math.PI * 2, UP = new THREE.Vector3(0, 1, 0);
// the distance from p to the segment a-b, all { x, y, z }
function toSegment(p, a, b) {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z, L = abx * abx + aby * aby + abz * abz || 1e-9;
  const t = clamp(((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz) / L, 0, 1);
  return Math.hypot(p.x - a.x - abx * t, p.y - a.y - aby * t, p.z - a.z - abz * t);
}

// ---------------------------------------------------------------- the place, as the world lays it
// Called by createWorld for the first band, after its swarms are placed and before anything is scattered: so that what is scattered keeps off it,
// and nothing placed before it moves. Draws only from its own run of numbers.
//   at: { seed, spawn, goalAngle, clear(x, z, pad), drawn(x, z) (the bed as it is meant: what floats need not sit on the facets, and the drawn bed keeps a store
//   of corners that must not be filled in a different order), wrap(d), size, swarm: { n, r }, tone }
// Returns the plan: where it is and what is in it, and the swarm of fry, which the world adds to its own.
export function layBloom({ seed, spawn, goalAngle, clear, drawn, wrap, size, swarm, tone }) {
  const r = rng(seed * 977 + 31337), rr = (a, b) => a + (b - a) * r(), P = BLOOM.place, R = P.R;
  let x = 0, z = 0, bearing = 0, found = false;
  for (let t = 0; t < P.tries && !found; t++) { // beside the way to the rift, either side; asking for a little less room as it goes on looking
    const side = r() < 0.5 ? -1 : 1; bearing = goalAngle + side * rr(P.off[0], P.off[1]); const d = rr(P.dist[0], P.dist[1]);
    x = spawn.x + Math.sin(bearing) * d; z = spawn.z + Math.cos(bearing) * d; found = clear(x, z, t < P.tries / 2 ? R : R * 0.6);
  }
  if (!found) { bearing = goalAngle + 0.68; x = spawn.x + Math.sin(bearing) * 70; z = spawn.z + Math.cos(bearing) * 70; } // nowhere clear: where it would most often be
  const flow = bearing + rr(-BLOOM.current.swing, BLOOM.current.swing), cur = { x: Math.sin(flow), z: Math.cos(flow) }; // the current: outward, more or less
  const bells = [];
  for (let i = 0, t = 0; i < BLOOM.moon.n && t < BLOOM.moon.n * 30; t++) { // thickest in the middle, never two in one place
    const a = r() * TAU, d = R * Math.sqrt(r()) * 0.97, bx = x + Math.sin(a) * d, bz = z + Math.cos(a) * d, by = drawn(bx, bz) + rr(BLOOM.moon.high[0], BLOOM.moon.high[1]);
    if (bells.some((b) => Math.hypot(b.x - bx, b.z - bz) < 1.3 && Math.abs(b.y - by) < 1.4)) continue;
    bells.push({ x: bx, y: by, z: bz, s: BLOOM.moon.scale * rr(0.8, 1.15), ph: r() * TAU, yaw: r() * TAU, ox: 0, oy: 0, oz: 0 }); i++;
  }
  const N = BLOOM.nettle, nettles = Array.from({ length: N.n }, (_, i) => { const a = flow + (i - (N.n - 1) / 2) * N.apart, nx = x + Math.sin(a) * R * N.at, nz = z + Math.cos(a) * R * N.at;
    return { x: nx, z: nz, y: drawn(nx, nz) + N.high, tx: Math.cos(a), tz: -Math.sin(a), ph: r() * TAU }; }); // (tx, tz: along the edge, which way it drifts)
  const S = BLOOM.squid, hx = x - cur.x * R * S.home, hz = z - cur.z * R * S.home, home = { x: hx, z: hz, y: drawn(hx, hz) + S.high };
  const F = BLOOM.fry, fy = drawn(x, z) + F.high;
  const plan = { x, z, R, bearing, cur, bells, nettles, home, wrap, size, hunted: 0, seed,
    // the fry: a swarm of the band's small fish like any other, but kept in the bloom. `open` is asked by the world each frame: is the head in among the
    // bells, where they can be cornered? (It also moves them: drawn in to the middle while the head is outside, toward the nettles' side while the squid hunt.)
    fry: { tier: 's', kind: '', n: swarm.n, ball: swarm.r, fit: swarm.r, orbit: swarm.r + 0.3, can: false, px: 0, pz: 0, pack: 1, progress: 0, arcStart: 0, arcSign: 1,
      hx: x, hz: z, hy: fy, ph: r() * TAU, r: F.drift, clock: r() * 50, threat: 0, x, z, y: fy, left: swarm.n, burst: 0, tone, ring: null, arc: null, sx: 0, sz: 0, bloom: null },
    minnow: () => ({ ph: r() * TAU, rho: 0.25 + 0.75 * Math.cbrt(r()), h: rr(-1, 1), sp: rr(0.7, 1.3) }), // one fry's own numbers, as the world gives every fish
    open(sc, head, dt) {
      const dx = wrap(head.x - x), dz = wrap(head.z - z), d = Math.hypot(dx, dz), inside = d < R * F.inside;
      let wx = 0, wz = 0;
      if (plan.hunted > 0.05) { wx = cur.x * R * F.flee; wz = cur.z * R * F.flee; } // hunted: toward the nettles, where the squid will not come
      else if (!inside && d < R + 16) { wx = (-dx / (d || 1)) * R * F.hide; wz = (-dz / (d || 1)) * R * F.hide; } // something big outside: deeper in, away from it
      const k = 1 - Math.exp(-F.ease * dt); sc.sx += (wx - sc.sx) * k; sc.sz += (wz - sc.sz) * k;
      return inside;
    },
  };
  plan.fry.bloom = plan;
  return plan;
}

// ---------------------------------------------------------------- what lives there, in the dive
// world: the band (world.bloom is the plan). hooks, from main.js:
//   rig, safe(), bite(n, joint, from, kind), segs(), playing(), moment(kind, v), chime(note, v), gulp(i, n, v), say(id, text),
//   best: { grade, time } kept in the nest, and settled(result): a try won (result: { time, grade, bluffs, best: was it a best })
export function createBloom(scene, world, hooks) {
  const plan = world.bloom, C = plan, R = plan.R, T = world.size, wrap = world.wrap, cur = plan.cur, rig = hooks.rig;
  const owned = [], add = (o) => { scene.add(o); owned.push(o); return o; };
  const off = { x: 0, z: 0 }; // which copy of the band the fish is in: everything here is kept in the first copy and drawn in the fish's
  const glow = glowTexture(), beam = beamTexture(); owned.push(glow, beam);
  const state = { t: 0, stung: 0, settled: false, tame: false, best: { ...(hooks.best || {}) } };

  // ---- the sun it hangs in
  const shaftMat = new THREE.MeshBasicMaterial({ map: beam, color: BLOOM.shafts.colour, transparent: true, opacity: BLOOM.shafts.glow, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }); owned.push(shaftMat);
  const shafts = Array.from({ length: BLOOM.shafts.n }, (_, i) => { const w = lerp(BLOOM.shafts.wide[0], BLOOM.shafts.wide[1], ((i * 0.618) % 1)), g = new THREE.PlaneGeometry(w, BLOOM.shafts.tall); owned.push(g);
    const m = add(new THREE.Mesh(g, shaftMat)); m.frustumCulled = false; m.rotation.order = 'YXZ'; m.rotation.z = Math.PI + 0.12 * (i - 1); // brightest at the bottom, as the rift's beam
    const a = i * 2.3 + plan.bearing, d = i ? R * 0.45 : 0; m.userData = { x: C.x + Math.sin(a) * d, z: C.z + Math.cos(a) * d, ph: i * 1.7 }; return m; });

  // ---- the moon jellies: every one the whole animal (bell, the four rings through it, arms and fringe), all of them drawn at once as one piece
  // (jellyCrowd in jelly.js): the stroke of each bell and the sway of its strands are in the shader, from each one's own place in its stroke
  const M = BLOOM.moon, one = make('moonjelly'), crowd = jellyCrowd(one, plan.bells.length, 'moon', 'pulse'); one.dispose?.();
  const jellies = add(crowd.mesh); owned.push(crowd);
  for (const b of plan.bells) { b.q = (b.ph / TAU) % 1; b.sway = b.ph * 3; }
  const order = plan.bells.map((b, i) => i), dist = new Float32Array(plan.bells.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ'), v3 = new THREE.Vector3(), s3 = new THREE.Vector3();
  const leanYaw = Math.atan2(-cur.x, -cur.z); // they lie over a little into the current, as the nettles do

  // ---- the nettles
  const NT = BLOOM.nettle;
  const nettles = plan.nettles.map((n, i) => { const a = make('nettle'); a.object.scale.multiplyScalar(NT.scale); scene.add(a.object);
    return { ...n, a, pos: new THREE.Vector3(n.x, n.y, n.z), ax: n.x, az: n.z, mood: 'pulse', moodT: 6 + i * 3, A: new THREE.Vector3(), B: new THREE.Vector3(), took: 0, i }; });
  const sag = NT.sag, trainDir = new THREE.Vector3(cur.x * Math.cos(sag), -Math.sin(sag), cur.z * Math.cos(sag)).normalize();

  // ---- the squid
  const SQ = BLOOM.squid, FR = SQ.fright;
  const squid = Array.from({ length: SQ.n }, (_, i) => { const a = make('squid'); a.object.scale.multiplyScalar(SQ.scale); scene.add(a.object); for (const arm of a.rig.arms) arm.st.mesh.castShadow = false; // (only the body casts: ten arms to a squid were a great many shadows to draw)
    const slot = { side: (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 1.6, back: Math.ceil(i / 2) * 0.9, up: ((i * 0.37) % 1 - 0.5) * 0.8 }; // a loose line abreast, the leader in the middle
    const pos = new THREE.Vector3(C.home.x + slot.side * cur.z, C.home.y + slot.up, C.home.z - slot.side * cur.x);
    return { a, i, slot, pos, vel: new THREE.Vector3(), yaw: Math.atan2(cur.x, cur.z), mood: 'hover', fright: 0, d: 99, was: 99, step: 'calm', away: null, t: 0, aimT: 0, face: 0, lit: 0 }; });
  const shoal = { mode: 'rest', t: BLOOM.squid.raid.rest * 0.5, target: null, eaten: 0, turn: 0, next: 0, raids: 0, scatterT: 0 };
  const lead = () => squid[0];

  // ---- ink: a copy of the squid in ink, which holds its shape, then thins and spreads; a dash through it bursts it
  const INK = BLOOM.ink, inkMat = () => { const m = new THREE.MeshBasicMaterial({ color: INK.colour, transparent: true, opacity: 0.88, depthWrite: false }); owned.push(m); return m; };
  const inks = [];
  function leaveInk(sq) {
    const m = add(new THREE.Mesh(geometry('squid'), inkMat())); m.quaternion.copy(sq.a.object.quaternion); m.position.copy(sq.a.object.position); m.scale.copy(sq.a.object.scale).multiplyScalar(1.15); m.renderOrder = 3;
    const cloud = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: INK.colour, transparent: true, opacity: 0.6, depthWrite: false })); owned.push(cloud.material); cloud.scale.setScalar(2.2); m.add(cloud); cloud.position.set(0, 0, -0.4);
    inks.push({ m, cloud, t: 0, at: sq.pos.clone(), burst: false, s: m.scale.x });
  }

  // a fish nearest a point taken from a swarm (the world's own: world.nibble), with a small pale spark where it was
  const sparks = Array.from({ length: 6 }, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: '#ffffff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); owned.push(s.material); s.scale.setScalar(0.9); add(s); return { s, t: 9 }; });
  let sparkNext = 0;
  function takeFish(sc, x, y, z, colour = '#ffffff') { const p = world.nibble(sc, x + off.x, z + off.z); if (!p) return false; const sp = sparks[sparkNext++ % sparks.length]; sp.s.position.copy(p); sp.s.material.color.set(colour); sp.t = 0; plan.taken = (plan.taken || 0) + 1; return true; }

  // ---- the try at settling the shoal (BLOOM.settle)
  const ST = BLOOM.settle, tryNow = { on: false, t: 0, hold: 0, bluffs: 0, tries: 0, last: null };

  // ---- the nest keeps the best: four stones by the shell places, lit one for each grade reached
  let mark = null;
  function nestMark() {
    const nest = world.react?.nest; if (!nest) return;
    if (mark) { nest.group.remove(mark); }
    const g = new THREE.Group(), yaw = nest.yaw, fw = [Math.sin(yaw), Math.cos(yaw)], rt = [Math.cos(yaw), -Math.sin(yaw)], f = 1.75, r0 = 2.9;
    const sx = world.spawn.x + fw[0] * f + rt[0] * r0, sz = world.spawn.z + fw[1] * f + rt[1] * r0, y = world.drawn(sx, sz);
    const stone = new THREE.MeshLambertMaterial({ color: '#7d8a80', flatShading: true }), slab = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.66, 0.12, 7), stone); owned.push(stone, slab.geometry);
    slab.position.set(sx - world.spawn.x, y + 0.04, sz - world.spawn.z); slab.scale.set(1.5, 1, 0.8); slab.rotation.y = yaw; slab.castShadow = slab.receiveShadow = true; g.add(slab);
    const grade = state.best.grade | 0, pebble = new THREE.IcosahedronGeometry(0.12, 0); owned.push(pebble);
    for (let k = 0; k < 4; k++) { const lit = k < grade, mm = new THREE.MeshLambertMaterial({ color: lit ? resolve('squid').palette.back : '#3a4148', flatShading: true, emissive: lit ? '#ff8fb8' : '#000000', emissiveIntensity: lit ? 0.7 : 0 }); owned.push(mm);
      const p = new THREE.Mesh(pebble, mm), u = (k - 1.5) * 0.34; p.position.set(slab.position.x + Math.sin(yaw) * u, y + 0.17, slab.position.z + Math.cos(yaw) * u); p.scale.set(1, k === 3 ? 1.35 : 1, 1); p.castShadow = true; p.userData.lit = lit; g.add(p); }
    g.userData.bloom = true; nest.group.add(g); mark = g; mark.userData.grade = grade;
  }
  nestMark();

  // ---------------------------------------------------------------- one frame
  const head = new THREE.Vector3(), jt = [], tmp = new THREE.Vector3(), eye = new THREE.Vector3();
  // a nettle or a squid is left undrawn (and unrigged) only where it cannot be seen: wholly in the fog from the camera, by `pad` metres more than its size.
  // (It was 60 m from the fish, which from a camera pulled back left them to blink in and out at the edge of sight.) No camera: 60 m from the fish
  let sight = null;
  const unseen = (p, pad) => sight ? Math.hypot(p.x + off.x - eye.x, p.y - eye.y, p.z + off.z - eye.z) > sight + pad : Math.hypot(p.x - head.x, p.z - head.z) > 60;
  function update(dt, camera) {
    state.t += dt; const t = state.t;
    sight = camera && scene.fog ? scene.fog.far : null; if (camera) eye.copy(camera.position);
    off.x = T * Math.round((rig.pos.x - C.x) / T); off.z = T * Math.round((rig.pos.z - C.z) / T);
    head.set(rig.snout.x - off.x, rig.snout.y, rig.snout.z - off.z);
    jt.length = 0; for (const j of rig.joints) jt.push({ x: j.x - off.x, y: j.y, z: j.z - off.z });
    const fishFar = Math.hypot(head.x - C.x, head.z - C.z), playing = hooks.playing(), speed = rig.speed;

    // the sun
    for (const m of shafts) { const u = m.userData; m.position.set(u.x + off.x + Math.sin(t * 0.05 + u.ph) * 1.2, world.drawn(u.x, u.z) + BLOOM.shafts.tall * 0.5 - 1, u.z + off.z);
      if (camera) m.rotation.y = Math.atan2(camera.position.x - m.position.x, camera.position.z - m.position.z); }

    // the bells: each bobs and beats; a part of the body near one pushes it aside, and it comes back
    const nearBody = fishFar < R + 4;
    for (const b of plan.bells) {
      if (nearBody) for (const p of jt) { const dx = b.x + b.ox - p.x, dy = b.y + b.oy - p.y, dz = b.z + b.oz - p.z, d = Math.hypot(dx, dy, dz); if (d < M.part && d > 1e-3) { const k = ((M.part - d) / M.part) * M.push * dt / d; b.ox += dx * k; b.oy += dy * k * 0.5; b.oz += dz * k; b.touched = t; } }
      const k = Math.exp(-M.back * dt); b.ox *= k; b.oy *= k; b.oz *= k;
    }
    // each bell: where it is, how it lies, where it is in its stroke (a touched one beats quicker for a moment). They are drawn farthest from the camera
    // first, so that a near one is laid over a far one; every one is the same model in the same piece, whatever the distance
    plan.bells.forEach((b, i) => { const rate = M.beat * (b.touched && t - b.touched < 1.2 ? 1.8 : 1); b.q = (b.q + dt * rate) % 1; b.sway += dt; b.rate = rate;
      b.at = b.at || new THREE.Vector3(); b.at.set(b.x + b.ox + off.x, b.y + b.oy + 0.18 * Math.sin(t * 0.4 + b.ph), b.z + b.oz + off.z);
      dist[i] = camera ? b.at.distanceToSquared(camera.position) : 0; });
    if (camera) order.sort((i, j) => dist[j] - dist[i]);
    order.forEach((i, k) => { const b = plan.bells[i];
      q.setFromEuler(e.set(M.lean + 0.1 * Math.sin(t * 0.3 + b.ph), leanYaw, 0)); s3.setScalar(b.s);
      crowd.set(k, m4.compose(v3.copy(b.at), q, s3), b.q, b.rate / crowd.stroke.late, b.sway); b.slot = k; });
    crowd.done();

    // the nettles: each holds its place against the current, drifting a little along the edge; it never comes after anything
    for (const n of nettles) {
      const want = Math.sin(t * 0.09 + n.ph) * NT.wander; n.ax = damp(n.ax, n.x + n.tx * want, 0.4, dt); n.az = damp(n.az, n.z + n.tz * want, 0.4, dt);
      n.pos.set(n.ax, n.y + 0.25 * Math.sin(t * 0.3 + n.ph), n.az);
      if ((n.moodT -= dt) <= 0) { n.mood = n.mood === 'pulse' ? 'drift' : 'pulse'; n.moodT = n.mood === 'pulse' ? 9 + 3 * Math.sin(n.ph + t) : 4; }
      n.A.copy(n.pos).addScaledVector(UP, -0.15 * NT.scale); n.B.copy(n.A).addScaledVector(trainDir, NT.train); // the train, as what it touches: a thick line from under the bell, streaming down-current and sagging
      const far = unseen(n.pos, 4); n.a.object.visible = !far;
      if (!far) n.a.rig.update(dt, { x: n.pos.x + off.x, y: n.pos.y, z: n.pos.z + off.z, yaw: leanYaw, tilt: 0.9, mood: n.mood, treadmill: true, vx: -cur.x * NT.stream, vy: 0, vz: -cur.z * NT.stream });
    }
    // a sting: any part of the body in a train, and not by the bell. It is counted by how much of the body lies across the train at once, over the
    // moment after the first touch (`look` seconds): a body that crosses it pays one segment, a body lying along it or wrapped through it pays two
    for (const n of nettles) {
      let count = 0, last = -1;
      if (n.rest > 0) { n.rest -= dt; n.touch = null; continue; }
      if (playing && !hooks.safe()) jt.forEach((p, i) => { if (Math.hypot(p.x - n.pos.x, p.y - n.pos.y, p.z - n.pos.z) < NT.bell) return; if (toSegment(p, n.A, n.B) < NT.reach) { count++; last = i; } });
      if (count && !n.touch) n.touch = { t: 0, most: 0, last };
      if (!n.touch) continue;
      n.touch.t += dt; if (count >= n.touch.most) { n.touch.most = count; n.touch.last = Math.max(last, n.touch.last); }
      if (n.touch.t < NT.look) continue;
      const most = n.touch.most, want = most >= NT.more ? NT.cost[1] : NT.cost[0], can = Math.max(0, Math.min(want, hooks.segs() - NT.keep)), j = n.touch.last; n.touch = null;
      if (!most || !playing || hooks.safe()) continue;
      n.stung = t; n.rest = NT.rest; state.stung++; plan.stings = (plan.stings || 0) + 1; plan.lastSting = { count: most, cost: can };
      if (can > 0) hooks.bite(can, j, n.pos, 'sting'); else hooks.hurt();
      hooks.say('nettle', 'A sea nettle’s trailing threads sting. Its bell does not: pass it on the side the current comes from.');
    }
    // a swarm whose middle is in a train loses a fish now and then: the fry, mostly, when the squid have driven them that way
    for (const n of nettles) { n.took = Math.max(0, n.took - dt);
      if (n.took > 0) continue;
      for (const sc of world.schools) { if (sc.left <= 0) continue; const p = { x: C.x + wrap(sc.x - C.x), y: sc.y, z: C.z + wrap(sc.z - C.z) }; if (Math.hypot(p.x - n.pos.x, p.z - n.pos.z) > NT.train + 3) continue;
        if (toSegment(p, n.A, n.B) < NT.reach + sc.ball) { if (takeFish(sc, n.B.x * 0.4 + p.x * 0.6, p.y, n.B.z * 0.4 + p.z * 0.6, '#ff9db8')) { n.took = 1 / NT.fry; plan.nettleTook = (plan.nettleTook || 0) + 1; } break; } } }

    squidStep(dt, t, playing);
    // young fish gather under the bells again, slowly, while nothing is among them
    { const fry = world.schools.find((sc) => sc.bloom); if (fry && fry.left < fry.n && fishFar > R + 10 && (fry.back = (fry.back || 0) + dt) > BLOOM.fry.back) { fry.back = 0; world.revive(fry); } }
    plan.hunted = Math.max(0, plan.hunted - dt * 0.5);

    // ink
    for (let i = inks.length - 1; i >= 0; i--) { const k = inks[i]; k.t += dt; const fade = clamp((k.t - (k.burst ? 0 : INK.hold)) / (k.burst ? 0.6 : INK.fade), 0, 1);
      if (!k.burst && rig.dashT > 0 && Math.hypot(head.x - k.at.x, head.y - k.at.y, head.z - k.at.z) < 1.8) { k.burst = true; k.t = 0; plan.inkBurst = (plan.inkBurst || 0) + 1; hooks.moment('burst'); }
      k.m.scale.setScalar(k.s * lerp(1, k.burst ? 2.6 : INK.swell, fade)); k.m.material.opacity = 0.88 * (1 - fade); k.cloud.material.opacity = 0.6 * (1 - fade * 0.8) * (k.burst ? 1.5 : 1);
      k.m.position.set(k.at.x + off.x, k.at.y + 0.2 * fade, k.at.z + off.z);
      if (fade >= 1) { scene.remove(k.m); inks.splice(i, 1); } }
    for (const sp of sparks) { sp.t += dt; sp.s.material.opacity = Math.max(0, 0.9 * (1 - sp.t / 0.5)); sp.s.visible = sp.t < 0.5; }
  }

  // ---------------------------------------------------------------- the squid
  function squidStep(dt, t, playing) {
    const L = lead(), S = SQ, RA = S.raid;
    // the shoal's errand: resting at home, out on a raid, or scattered
    if (shoal.mode === 'scatter') { if ((shoal.scatterT -= dt) <= 0) { shoal.mode = 'rest'; shoal.t = RA.rest; for (const s of squid) { s.step = 'calm'; s.fright = Math.min(s.fright, FR.bluff * 0.5); } } }
    else if (shoal.mode === 'rest') { if (!state.tame && (shoal.t -= dt) <= 0 && !tryNow.on && Math.hypot(head.x - C.home.x, head.z - C.home.z) < RA.wake) { const sc = target(); if (sc) { shoal.mode = 'raid'; shoal.target = sc; shoal.eaten = 0; shoal.next = RA.every; shoal.raids++; } else shoal.t = 5; } }
    else if (shoal.mode === 'raid') { const sc = shoal.target; if (state.tame || !sc || sc.left <= 0 || shoal.eaten >= RA.meal) { shoal.mode = 'rest'; shoal.t = RA.rest; shoal.target = null; } }
    const sc = shoal.mode === 'raid' ? shoal.target : null, at = sc ? { x: C.x + wrap(sc.x - C.x), y: sc.y, z: C.z + wrap(sc.z - C.z) } : null;
    if (sc && sc.bloom) plan.hunted = 1; // the fry know
    if (at) { const dL = Math.hypot(L.pos.x - at.x, L.pos.z - at.z); if (dL < 6 && (shoal.next -= dt) <= 0) { shoal.next = RA.every; const s = squid[shoal.turn++ % squid.length]; if (s.step === 'calm') { s.aimT = RA.aim + 0.35; s.aimAt = at; } } }

    for (const s of squid) {
      // fright: what the fish is doing to it
      const dx = s.pos.x - head.x, dy = s.pos.y - head.y, dz = s.pos.z - head.z, d = Math.hypot(dx, dy, dz); s.was = s.d; s.d = d;
      let closing = dt > 0 && s.was < 90 ? (s.was - d) / dt : 0; if (closing > 16) closing = 0; // (faster than a dash is no fish: one put down somewhere new)
      let p = 0;
      if (!state.tame && playing && d < FR.see) p = FR.gain * Math.max(0, closing - FR.calm) * (1 - d / FR.see) + FR.crowd * Math.max(0, FR.close - d);
      const hard = !state.tame && playing && ((rig.dashT > 0 && d < FR.dash) || (d < 7 && rig.wrap(s.pos.x + off.x, s.pos.y, s.pos.z + off.z, 6).angle > Math.PI * 1.15));
      if (hard) p = 99;
      // a train brushed: it goes pale and leaves
      for (const n of nettles) if (toSegment(s.pos, n.A, n.B) < NT.reach * 0.8) { s.fright = Math.max(s.fright, FR.flee + 0.05); s.stungBy = n; plan.squidStung = (plan.squidStung || 0) + 1; }
      if (p > 0) s.fright += p * dt; else s.fright -= (FR.cool + (speedOf() < 0.6 ? FR.still : 0)) * dt;
      s.fright = clamp(s.fright, 0, 1.2);
      const was = s.step;
      if (shoal.mode === 'scatter') s.step = 'scatter';
      else if (s.fright >= FR.ink && was !== 'scatter') { inkAndScatter(s); }
      else if (s.fright >= FR.flee) s.step = 'flee';
      else if (s.fright >= FR.bluff) s.step = was === 'flee' ? 'flee' : 'bluff';
      else if (s.fright < FR.bluff * 0.6) s.step = 'calm';
      if (s.step === 'bluff' && was !== 'bluff') { plan.bluffs = (plan.bluffs || 0) + 1; if (tryNow.on) tryNow.bluffs++; hooks.moment('flit'); }
      if (s.step === 'flee' && was !== 'flee') { const a = Math.atan2(dx, dz) + ((s.i * 0.7) % 1 - 0.5); s.away = { x: s.pos.x + Math.sin(a) * 9, z: s.pos.z + Math.cos(a) * 9 }; plan.flees = (plan.flees || 0) + 1; if (tryNow.on) tryNow.bluffs++; }

      // where it goes, and how
      let goal = null, sp = S.swim, mood = 'hover', faceX = null, faceZ = null, y = C.home.y;
      const homeAt = { x: C.home.x + s.slot.side * cur.z - cur.x * s.slot.back, z: C.home.z - s.slot.side * cur.x - cur.z * s.slot.back };
      if (s.step === 'scatter' || s.step === 'flee') { goal = s.away; sp = S.jet * (s.step === 'flee' ? 0.7 : 1); mood = Math.hypot(s.pos.x - goal.x, s.pos.z - goal.z) > 1.2 ? 'flee' : 'hover'; faceX = head.x; faceZ = head.z;
        if (s.step === 'flee' && mood === 'hover' && s.fright < FR.bluff) s.step = 'calm'; }
      else if (s.step === 'bluff') { mood = 'bluff'; faceX = head.x; faceZ = head.z; const k = 1 / (d || 1); goal = d < 7 ? { x: s.pos.x + dx * k * 2, z: s.pos.z + dz * k * 2 } : { x: s.pos.x, z: s.pos.z }; sp = 0.9; y = s.pos.y; } // big at it, and giving ground
      else if (state.tame) { goal = homeAt; if (d < 9) { faceX = head.x; faceZ = head.z; goal = { x: lerp(homeAt.x, head.x, 0.2), z: lerp(homeAt.z, head.z, 0.2) }; } }
      else if (at) { const a = (s.i / squid.length) * TAU + Math.atan2(L.pos.x - at.x, L.pos.z - at.z) * 0, ring = sc.ball * 2.6 + RA.ring; goal = { x: at.x + Math.sin(a + t * 0.05) * ring, z: at.z + Math.cos(a + t * 0.05) * ring }; y = at.y; faceX = at.x; faceZ = at.z;
        if (s.aimT > 0) { s.aimT -= dt; mood = s.aimT > 0.35 ? 'aim' : 'strike'; goal = { x: s.pos.x, z: s.pos.z }; if (s.aimT <= 0.35 && !s.struck) { s.struck = true; if (takeFish(sc, at.x, at.y, at.z)) { shoal.eaten++; plan.squidTook = (plan.squidTook || 0) + 1; } } } else s.struck = false; }
      else { goal = homeAt; if (tryNow.on && s.i < (tryNow.turned || 0)) { faceX = head.x; faceZ = head.z; } } // a try going well: one by one they turn to the fish
      // go there, keeping out of the nettles' trains
      const gx = goal.x - s.pos.x, gz = goal.z - s.pos.z, gd = Math.hypot(gx, gz);
      const want = new THREE.Vector3(gd > 0.3 ? (gx / gd) * Math.min(sp, gd * 1.2) : 0, clamp((Math.max(y, world.height(s.pos.x, s.pos.z) + 1.4) - s.pos.y) * 1.2, -1.5, 1.5), gd > 0.3 ? (gz / gd) * Math.min(sp, gd * 1.2) : 0);
      if (s.step !== 'flee' && s.step !== 'scatter') for (const n of nettles) { const dd = toSegment(s.pos, n.A, n.B); if (dd < NT.reach + 1.6) { tmp.subVectors(s.pos, n.pos).setY(0).normalize(); want.addScaledVector(tmp, 2.2 * (1 - dd / (NT.reach + 1.6))); } }
      s.vel.lerp(want, 1 - Math.exp(-(mood === 'flee' ? 6 : 2.5) * dt)); s.pos.addScaledVector(s.vel, dt);
      s.pos.y = Math.max(s.pos.y, world.height(s.pos.x, s.pos.z) + 1.2);
      // which way it points: the head at what it watches; going somewhere on a jet, point first, so the arms trail back the way it came
      const moving = Math.hypot(s.vel.x, s.vel.z);
      let yawTo = s.yaw;
      if (mood === 'flee') yawTo = Math.atan2(-s.vel.x, -s.vel.z);
      else if (faceX !== null) yawTo = Math.atan2(faceX - s.pos.x, faceZ - s.pos.z);
      else if (moving > 0.4) yawTo = Math.atan2(s.vel.x, s.vel.z);
      else yawTo = Math.atan2(-cur.x, -cur.z); // resting, it heads into the current
      if (mood === 'hover' && moving > 0.6) mood = 'swim';
      s.yaw += clamp(Math.atan2(Math.sin(yawTo - s.yaw), Math.cos(yawTo - s.yaw)), -3 * dt, 3 * dt); s.mood = mood;
      const far = unseen(s.pos, 2); s.a.object.visible = !far;
      if (!far) s.a.rig.update(dt, { x: s.pos.x + off.x, y: s.pos.y, z: s.pos.z + off.z, yaw: s.yaw, pitch: mood === 'hover' ? 0.25 : mood === 'bluff' ? -0.25 : 0, mood, rate: 1.2 });
    }
    settling(dt);
  }
  const speedOf = () => rig.speed;
  function target() { // a swarm for a raid: by turns the fry under the bells and the nearest other swarm in reach, never the great swarm nor the first one, which is for learning on
    const fry = world.schools.find((sc) => sc.bloom && sc.left > 0), others = world.schools.filter((sc) => !sc.bloom && sc.left > 0 && sc.tier !== 'h' && sc !== world.schools[0] && !sc.of)
      .map((sc) => [sc, Math.hypot(wrap(sc.hx - C.home.x), wrap(sc.hz - C.home.z))]).filter(([, d]) => d < SQ.raid.reach).sort((a, b) => a[1] - b[1]);
    if (shoal.raids % 2 === 0 && fry) return fry;
    return others.length ? others[0][0] : fry || null;
  }
  function inkAndScatter(first) {
    leaveInk(first); plan.inked = (plan.inked || 0) + 1; hooks.moment('burst');
    shoal.mode = 'scatter'; shoal.scatterT = SQ.scatter.regroup; shoal.target = null;
    if (tryNow.on) endTry(false);
    for (const s of squid) { const a = Math.atan2(s.pos.x - head.x, s.pos.z - head.z) + (s.i - 2) * 0.75, far = SQ.scatter.far * (s === first ? 1.2 : 1); // a neighbour's ink is an alarm: every one goes, each its own way
      s.away = { x: s.pos.x + Math.sin(a) * far, z: s.pos.z + Math.cos(a) * far }; s.step = 'scatter'; s.fright = Math.max(s.fright, FR.flee); s.aimT = 0; }
  }

  // ---------------------------------------------------------------- the try at settling the shoal
  function settling(dt) {
    if (state.tame || shoal.mode === 'scatter' || !hooks.playing()) return;
    const L = lead(), dLead = Math.min(...squid.map((s) => s.d));
    if (!tryNow.on) { if (dLead < ST.see) Object.assign(tryNow, { on: true, t: 0, hold: 0, bluffs: 0, tries: tryNow.tries + 1 }); else return; }
    tryNow.t += dt;
    if (dLead > ST.see + 8) { tryNow.on = false; return; } // gone away: the next time is a new try
    if (tryNow.t > ST.limit) { endTry(false); shoal.mode = 'rest'; shoal.t = 0; return; } // too long: the shoal goes off hunting
    const calm = squid.every((s) => s.fright < ST.calm), close = squid.some((s) => s.d < ST.near);
    if (calm && close && speedOf() < ST.slow) tryNow.hold += dt; else tryNow.hold = Math.max(0, tryNow.hold - dt * 2);
    // what shows how near it is: one by one they turn to the fish (squidStep turns them while a try is on); and a quiet note as each does
    const turned = Math.floor((tryNow.hold / ST.hold) * squid.length);
    if (turned > (tryNow.turned || 0)) hooks.gulp(turned - 1, squid.length + 1, 0.4); tryNow.turned = turned;
    if (tryNow.hold >= ST.hold) endTry(true);
    void L;
  }
  function endTry(won) {
    tryNow.on = false; tryNow.turned = 0;
    if (!won) { plan.failed = (plan.failed || 0) + 1; return; }
    const time = +tryNow.t.toFixed(1), g = ST.grades, grade = time <= g[2] ? (tryNow.bluffs ? 3 : 4) : time <= g[1] ? 2 : 1;
    const best = !state.best.grade || grade > state.best.grade || (grade === state.best.grade && time < (state.best.time ?? 1e9));
    if (best) { state.best = { grade: Math.max(grade, state.best.grade | 0), time: Math.min(time, state.best.time ?? 1e9) }; nestMark(); }
    state.settled = true; state.tame = true; shoal.mode = 'rest'; shoal.target = null; plan.hunted = 0;
    for (const s of squid) { s.step = 'calm'; s.fright = 0; }
    hooks.settled({ time, grade, bluffs: tryNow.bluffs, best, kept: state.best });
  }

  // who sits in with the band: the squid by the nearest, the bloom by how near, a nettle by the nearest
  function cast(most, nearBy) {
    let ds = 99; for (const s of squid) ds = Math.min(ds, Math.hypot(s.pos.x + off.x - rig.pos.x, s.pos.z + off.z - rig.pos.z)); most('squid', clamp(1 - ds / 20, 0, 1));
    most('moonjelly', nearBy({ x: C.x + off.x, z: C.z + off.z }, R + 14));
    let dn = 99; for (const n of nettles) dn = Math.min(dn, Math.hypot(n.pos.x + off.x - rig.pos.x, n.pos.z + off.z - rig.pos.z)); most('nettle', clamp(1 - dn / 14, 0, 1));
  }
  function dispose() {
    for (const o of owned) { if (o.isObject3D) { scene.remove(o); if (o.isInstancedMesh) o.dispose(); } else o.dispose?.(); }
    for (const n of nettles) { scene.remove(n.a.object); n.a.dispose(); }
    for (const s of squid) { scene.remove(s.a.object); s.a.dispose(); }
    for (const k of inks) scene.remove(k.m);
    if (mark) world.react?.nest?.group.remove(mark);
  }
  // for the checks and the pictures
  const debug = { off, shoal, tryNow, inks, crowd, jellies, scatter: (s = squid[0]) => inkAndScatter(s), settle: () => { tryNow.on = true; tryNow.t = tryNow.t || 1; tryNow.hold = ST.hold; settling(0); }, get mark() { return mark; } };
  return { update, cast, dispose, plan, nettles, squid, state, debug, at: (p) => ({ x: p.x + off.x, y: p.y, z: p.z + off.z }) };
}
