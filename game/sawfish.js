// The Shearer in motion. Its head, wings and trunk are one model that bends (spine.js): the head turns and nods on a neck, the body lies along
// the curve it is swimming and banks into it, and the nose goes up or down with the way it is heading. The rest of it is pieces of their own
// (critters.js: SHEARER, shearerSaw, shearerTail), hung on by this file:
//   the saw      rigid, as a real one is, and carried on the head wherever the neck has turned it. Its thirty-two teeth are each a piece; a row
//                knocked out flies off, sinks and lies on the bed, and leaves its stumps. Snapped, the end of the blade comes away the same way
//   the tail     everything behind the hind fins, trailed by strands.js: it is told the sweep it would make in still water and goes after it late,
//                so it swings wide when the body turns, runs on when the body stops, and hangs when the fish is spent
//   the wings    part of the body, moved in its shader: they ripple from front to back, lift when it goes still to feel, fold down for a charge
//   the gills    the whole of the head behind the eyes swells and sinks with each breath, the two breathing holes behind the eyes gape, and the
//                gills show lit inside them (and in the five slits underneath). Spent or stuck it pants, three times as fast and as deep as
//                it will go: that is how to see, from above, that it can be hit. Its eyelids come half down then, too
// What it is about to do is in how it holds the saw, and in the saw's teeth, which light as it feels a fish:
//   search   the saw tilted down, sweeping slowly from side to side
//   sense    it has felt something: the sweep stops, the saw swings round to it, the teeth come alight and tingle, the wings lift
//   aim      slash: the saw cocked back to one side.  pin: nose down over the tail, the saw wiggling as it lines up, wings spread to hold it there
//   charge   slash: the saw whipped across, three swipes in the time it takes to go through.  pin: straight down.  Wings folded back
//   tired    spent after a slash: saw drooping, teeth dark, wings and tail hanging, rolling a little as it sinks, and panting
//   stuck    after a pin: the saw is in the bed and the tail is in the air, thrashing to pull it out      jammed   the same, in a column
//   stun     rammed: it rocks, the teeth flicker, the eyes flutter     down   beaten: belly up, limp, dark, eyes shut
// What was taken from the real animal, and where it was read:
//   A sawfish (family Pristidae) is a ray: "a strong shark-like body, a flat underside and a flat head", the mouth, the nostrils and five gill
//   slits a side underneath, small eyes on top with a spiracle behind each, wing-shaped pectoral and pelvic fins, two tall back fins, no anal
//   fin, and a tail with a long upper lobe. The saw is a quarter to a third of its length, with 14 to 37 teeth a side by kind; a tooth that is
//   lost is not replaced. Dark above, whitish below (Wikipedia, "Sawfish"). So a knocked-out tooth stays out, and leaves a stump.
//   The largetooth sawfish, Pristis pristis, has 14 to 24 teeth to an edge and is the one with a clear lower lobe to its tail; it "swims much
//   like a shark", and can lie on the bed and breathe by drawing water in through the spiracles (Florida Museum, "Largetooth sawfish"). So the
//   Shearer has sixteen teeth to an edge where it had twelve, its trunk and tail do the swimming while the head and wings ride still, and its
//   breathing shows on top, at the spiracles, where a player looking down can see it.
//   The pectoral fins give "lift and steering" and the tail drives it; the spiracles, just behind the eyes, pass water over the gills when it is
//   not moving; the eyes are on top so that it can see while half buried (Florida Museum, "Sawfish anatomy"). So the wings flex and bank and
//   only ripple a little: they are not a stingray's.
//   The saw is both how it finds prey and what it hits it with. It is studded with pores that feel the electric field of anything alive; prey
//   up in the water gets fast sideways swipes, hard enough to cut a fish in two, and prey on the bottom is pinned under the saw (Wueringer and
//   others, "The function of the sawfish's saw", Current Biology, 2012, as told in National Geographic, "How the sawfish wields its saw like a
//   swordsman"). guards.js decides which and when; this is only how it looks doing it.
// Not read anywhere: that its gills light when it pants. The real one's gills are underneath and give no light; the light is there so that the
// tell reads in the dim band it lives in. Nor is a real saw's tooth lit.
import * as THREE from 'three';
import { alive } from './kit.js';
import { bendy } from './spine.js';
import { createStrand } from './strands.js';
import { SHEARER, shearerSaw, shearerTail } from './critters.js';
import { clamp, damp, lerp } from './geo.js';

const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a)), ease = (t) => t * t * (3 - 2 * t);
// How each mood holds what is not the saw. rate: breaths a second; deep: how far the gills fill (1: as far as they go); lid: the eyes shut; fold: the
// wings turned down (below 0: lifted); droop: how much they hang by their own weight; ripple and beat: the wave down their edge, how far and how fast;
// sweep: how wide the tail swings; sag: how much the tail hangs
const BASE = { rate: 0.45, deep: 0.2, lid: 0.1, fold: 0.04, droop: 0, ripple: 0.14, beat: 2.4, sweep: 1, sag: 0 };
const LOOKS = {
  search: {},
  sense: { rate: 0.3, deep: 0.1, lid: 0, fold: -0.2, ripple: 0.04, beat: 7, sweep: 0.5 }, // gone still, to feel
  aim: { rate: 0.3, deep: 0.1, lid: 0, fold: -0.1, ripple: 0.07, beat: 6, sweep: 0.8 },
  stoop: { rate: 0.3, deep: 0.1, lid: 0, fold: -0.42, ripple: 0.16, beat: 10, sweep: 1.3 }, // hanging nose down over a tail: wings spread and working
  charge: { rate: 0.3, deep: 0.1, lid: 0, fold: 0.4, ripple: 0.05, beat: 14, sweep: 1.5 },
  swipe: { rate: 0.3, deep: 0.1, lid: 0, fold: 0.15, ripple: 0.1, beat: 14, sweep: 1.2 },
  tired: { rate: 1.45, deep: 1, lid: 0.62, fold: 0.08, droop: 0.5, ripple: 0.06, beat: 1.4, sweep: 0.35, sag: 0.45 },
  stuck: { rate: 2.2, deep: 1, lid: 0.3, fold: 0.05, ripple: 0.5, beat: 15, sweep: 2.4 },
  jammed: { rate: 2.2, deep: 1, lid: 0.3, fold: 0.05, ripple: 0.5, beat: 15, sweep: 2.2 },
  stun: { rate: 3, deep: 0.5, lid: 0.8, fold: 0.05, droop: 0.3, ripple: 0.3, beat: 22, sweep: 0.3, sag: 0.25 },
  down: { rate: 0, deep: 0, lid: 1, fold: 0, droop: 0.7, ripple: 0.02, beat: 0.8, sweep: 0.12, sag: 1 },
};
const KEYS = Object.keys(BASE), TAIL_FEEL = { stiff: [6, 2.2], drag: [0.5, 1.5], ease: 0.62 };

// The body's material is taught four things more: its gills swell, its breathing holes and gill slits gape, its eyelids come down, its wings ripple and
// fold. The model says which corners do what (its `swell` and `flex`: critters.js). Faces whose colour has alpha one half are the gills: they are lit by
// its breath (uPant) and not with its teeth.
const GILLS = `
  {
    transformed += swell.xyz * mix(uHeave.x, uHeave.y, smoothstep(1.3, 0.3, position.z)); // the breath runs back along it
    vFlush = length(swell.xyz) * 5.0;
    transformed += flex.xyz * (flex.w < 0.5 ? 0.0 : flex.w < 1.5 ? uMove.x : flex.w < 2.5 ? uMove.y : uMove.z);
    float reach = abs(swell.w), side = sign(swell.w); // a wing turns about the line it grows from, more toward its tip: by its fold, and by the ripple running down it
    float turn = ((side > 0.0 ? uFold.x : uFold.y) + uWing.z * sin(uWing.x + side * 0.9 + position.z * uWing.y)) * (0.3 + 0.7 * min(1.0, reach / 1.1));
    transformed.x -= side * reach * (1.0 - cos(turn));
    transformed.y -= reach * sin(turn);
  }`;
function gilled(material, flush) {
  const u = { uHeave: { value: new THREE.Vector2() }, uMove: { value: new THREE.Vector3() }, uWing: { value: new THREE.Vector4(0, 2.6, 0, 0) }, uFold: { value: new THREE.Vector2() }, uPant: { value: 0 }, uFlush: { value: new THREE.Color(flush) } };
  const before = material.onBeforeCompile, key = material.customProgramCacheKey ? material.customProgramCacheKey() : '';
  material.onBeforeCompile = (sh, renderer) => {
    before?.(sh, renderer); Object.assign(sh.uniforms, u);
    sh.vertexShader = `attribute vec4 flex;\nattribute vec4 swell;\nuniform vec2 uHeave;\nuniform vec3 uMove;\nuniform vec4 uWing;\nuniform vec2 uFold;\nvarying float vFlush;\n${sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n${GILLS}`)}`;
    sh.fragmentShader = `uniform float uPant;\nuniform vec3 uFlush;\nvarying float vFlush;\n${sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR_ALPHA\n  { float gills = step(0.25, vColor.a) * step(vColor.a, 0.75); totalEmissiveRadiance += vColor.rgb * gills * (uPant - (1.0 - vColor.a) * uGlow) + uFlush * (vFlush * uPant * 0.16); } // and the skin over the gills flushes a little with each breath\n#endif')}`;
  };
  material.customProgramCacheKey = () => `${key}|gilled`;
  return u;
}

// a: the creature as npc.js makes it (a.body is the head, wings and trunk, in the material that swims). halos: two soft lights the component may hang on it, one
// over each breathing hole, which swell with its breath. Returns the rig; a.object becomes the whole animal.
export function sawfishRig(a, pal, { halos = [] } = {}) {
  const body = a.body, mat = bendy(body.material, { neck: SHEARER.neck }), u = gilled(mat, pal.gill || '#ff8fb0'), beat = a.spec.beat, W = SHEARER.swim, T = SHEARER.tail;
  const group = new THREE.Group(); group.name = 'shearer'; group.rotation.order = 'YXZ'; group.add(body);
  // what is hung on it does not bend, so it has a material of its own; and what has come off it has another, whose teeth have gone dark
  const plain = (glow) => { const m = alive(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, flatShading: true, emissive: mat.emissive, emissiveIntensity: mat.emissiveIntensity }), { glow }); a.owned.push(m); return m; };
  const hard = plain(0.4), dead = plain(0.12);
  const piece = (geo, parent) => { const m = new THREE.Mesh(geo, hard); m.castShadow = true; parent.add(m); return m; };
  // the saw
  const G = shearerSaw(pal); a.owned.push(G.blade, G.end, G.broken, G.tooth);
  const saw = piece(G.blade, group), end = piece(G.end, saw), broken = piece(G.broken, saw); saw.rotation.order = 'XYZ'; saw.position.z = SHEARER.neck; end.position.set(...G.mid); broken.visible = false;
  const teeth = SHEARER.all.map((def) => { const on = def.end ? end : saw, mesh = piece(G.tooth, on), size = def.long / SHEARER.all[0].long;
    mesh.position.set(def.x, def.end ? 0 : SHEARER.sawY, def.z - SHEARER.neck - (def.end ? G.mid[2] : 0)); if (def.side < 0) mesh.rotation.z = Math.PI; mesh.scale.setScalar(size);
    return { def, mesh, on, size, off: false, home: mesh.position.clone() }; });
  // the tail: hung on a mount that looks backward, since a strand is modelled along +z
  const tailGeo = shearerTail(pal), tail = createStrand(tailGeo, hard, T.cuts, TAIL_FEEL), mount = new THREE.Object3D(); a.owned.push(tailGeo, tail);
  mount.position.set(0, 0, T.root); mount.rotation.y = Math.PI; mount.add(tail.mesh); group.add(mount); mount.updateMatrix();
  halos.forEach((h, i) => { h.position.set(...SHEARER.holes[i]); h.visible = false; group.add(h); });
  const hung = { matrix: new THREE.Matrix4() }, inv = new THREE.Matrix4(), moving = new THREE.Vector3(), water = new THREE.Vector3(), opts = { scale: 1, moving, water: null };
  const count = (g) => g.attributes.position.count / 3, triangles = count(body.geometry) + count(G.blade) + count(G.end) + count(G.broken) + teeth.length * count(G.tooth) + count(tailGeo);

  const p = { roll: 0, pitch: 0, turn: 0, yawWas: null, hy: 0, hp: 0, curve: 0, glow: 0.4, t: 0, mood: '', whip: 0, swing: 0, // whip: how hard the saw is being swung, and swing: where in the swing it is
    ...BASE, breath: 0, heave: 0, gape: 0, pant: 0, wing: 0, foldL: 0, foldR: 0, lean: 0, was: new THREE.Vector3() }, to = new THREE.Vector3(), L = {};
  const V = new THREE.Vector3(), DOWN = new THREE.Vector3(), Q = new THREE.Quaternion();
  const breathe = (x) => { const f = x - Math.floor(x); return f < 0.42 ? ease(f / 0.42) : 1 - ease((f - 0.42) / 0.58); }; // in quickly, out slowly

  // s: where it is and what it is doing.
  //   x, y, z, yaw; speed (over the ground), climb (upward), in metres a second
  //   mood: one of the above; mode: 'slash' | 'pin'; side: 1 | -1, the side the saw is cocked to; k: 0..1 through the mood
  //   look: a point (the fish), or null; time: seconds
  //   treadmill: it stays where it is and the water goes by, as if it were swimming at `speed` (the library)
  function update(dt, s) {
    p.t += dt;
    const sc = group.scale.x, mood = s.mood, pin = s.mode === 'pin', side = s.side || 1, k = clamp(s.k || 0, 0, 1), t = s.time;
    const first = p.yawWas === null, turn = first || dt <= 1e-5 ? 0 : clamp(wrapPi(s.yaw - p.yawWas) / dt, -3, 3); p.yawWas = s.yaw;
    p.turn = damp(p.turn, turn, 4, dt);
    // the body: it leans into a turn, lies along the curve of it, and points the way it is going
    let roll = clamp(-p.turn * 0.55, -0.5, 0.5), pitch = -Math.atan2(s.climb || 0, Math.max(s.speed || 0, 2)) * 0.8, curve = clamp(p.turn / (2 * Math.max(s.speed || 0, 2.5)), -0.08, 0.08);
    let hy = clamp(p.turn * 0.3, -0.3, 0.3), hp = 0, glow = 0.4, quick = 8, swim = 1, bodyQuick = 5;
    if (s.look) { to.copy(s.look).sub(group.position); const c = Math.cos(s.yaw), sn = Math.sin(s.yaw); to.set(to.x * c - to.z * sn, to.y, to.x * sn + to.z * c); } // the fish, as the body sees it: +z ahead, +x to its left
    if (mood === 'search') { hy += 0.34 * Math.sin(p.t * 1.15); hp = -0.24; glow = 0.38 + 0.08 * Math.sin(p.t * 2); }
    else if (mood === 'sense') { hy = s.look ? clamp(Math.atan2(to.x, Math.max(to.z, 0.5)), -0.75, 0.75) : 0; hp = s.look ? clamp(Math.atan2(to.y, Math.hypot(to.x, to.z)), -0.4, 0.3) : 0; glow = 1.15 + 0.45 * Math.sin(t * 19); swim = 0.5; quick = 6; }
    else if (mood === 'aim' && pin) { pitch = 1.0 * ease(k); hy = 0.2 * Math.sin(t * 24); hp = -0.08; glow = 1.5 + 0.5 * k; swim = 1.4; bodyQuick = 7; } // over the tail, lining the saw up on it
    else if (mood === 'aim') { hy = -0.85 * side * ease(k); hp = 0.06; roll += 0.22 * side * k; glow = 1.5 + 0.5 * k; swim = 0.7; }
    else if (mood === 'charge' && pin) { pitch = 1.15; hy = 0.1 * Math.sin(t * 34); glow = 2.3; swim = 2.2; quick = 30; bodyQuick = 14; }
    else if (mood === 'charge') { glow = 2.3; swim = 2.2; } // the saw is whipped across: see below
    else if (mood === 'tired') { hy = 0.16 * Math.sin(p.t * 0.9); hp = -0.42; roll += 0.14 * Math.sin(p.t * 0.7); pitch = 0.12; glow = 0.1; swim = 0.45; quick = 3; }
    else if (mood === 'jammed') { hy = 0.1 * Math.sin(t * 13); hp = 0.05; curve = 0.07 * Math.sin(t * 9); roll = 0.2 * Math.sin(t * 9); glow = 0.1; swim = 3; quick = 16; bodyQuick = 9; } // its saw in a column: it thrashes to get it out
    else if (mood === 'stuck') { pitch = 0.78 + 0.05 * Math.sin(t * 11); hp = 0.42; hy = 0.07 * Math.sin(t * 11); curve = 0.06 * Math.sin(t * 11); roll = 0.16 * Math.sin(t * 9); glow = 0.1; swim = 3; quick = 16; bodyQuick = 9; }
    else if (mood === 'stun') { roll = 0.35 * Math.sin(t * 16); hy = 0.25 * Math.sin(t * 13); hp = -0.2; glow = 0.6 + 0.6 * Math.sin(t * 40); swim = 0.3; quick = 20; bodyQuick = 30; }
    else if (mood === 'down') { roll = 2.7; pitch = 0.18; hy = 0.12; hp = -0.3; curve = 0.03; glow = 0; swim = 0.27; quick = 2; bodyQuick = 2.4; }
    // the slash: from where it was cocked, across and back, three times a second, as a sawfish swipes; it swings on a moment after the blow has landed
    if ((mood === 'charge' && !pin) || mood === 'swipe') { if (p.mood !== mood) p.swing = 0; p.whip = 1; glow = 2.3; } else p.whip *= Math.exp(-5 * dt);
    p.swing += dt * 18.85; p.mood = mood;
    if (p.whip > 0.02) { const w = Math.cos(p.swing) * p.whip; hy = hy * (1 - p.whip) - 0.9 * side * w; roll += 0.3 * side * w; quick = 40; }
    p.roll = damp(p.roll, roll, bodyQuick, dt); p.pitch = damp(p.pitch, pitch, bodyQuick, dt); p.curve = damp(p.curve, curve, bodyQuick, dt);
    p.hy = damp(p.hy, hy, quick, dt); p.hp = damp(p.hp, hp, quick, dt); p.glow = damp(p.glow, glow, mood === 'sense' || mood === 'stun' ? 30 : 6, dt);
    moving.set(s.x - p.was.x, s.y - p.was.y, s.z - p.was.z); if (first || dt <= 1e-5 || moving.length() > 5 * sc) moving.set(0, 0, 0); else moving.multiplyScalar(1 / dt); p.was.set(s.x, s.y, s.z);
    group.position.set(s.x, s.y, s.z); group.rotation.set(p.pitch, s.yaw, p.roll); group.updateMatrix();
    mat.userData.head.set(p.hy, p.hp); mat.userData.curve.value = p.curve; mat.userData.glow.value = p.glow;
    mat.userData.swim.value += dt * (beat[0] + beat[1] * (s.speed || 0)) * swim;
    hard.userData.glow.value = p.glow; hard.emissiveIntensity = dead.emissiveIntensity = mat.emissiveIntensity; hard.wireframe = dead.wireframe = mat.wireframe; // (the flash when it is hit is the fight's, and is put on the body)

    // what is not the saw: its breath, its eyes, its wings
    Object.assign(L, BASE, LOOKS[mood === 'aim' && pin ? 'stoop' : mood] || BASE);
    for (const key of KEYS) p[key] = damp(p[key], L[key], key === 'lid' ? 9 : key === 'rate' || key === 'deep' ? 4 : 6, dt);
    p.breath += dt * p.rate; p.wing += dt * p.beat;
    p.heave = p.deep * breathe(p.breath); p.gape = p.deep * breathe(p.breath + 0.1); p.pant = 1.8 * p.gape * p.deep;
    const blink = mood === 'stun' ? 0.5 + 0.45 * Math.sin(t * 23) : mood === 'search' && p.t % 4.3 < 0.13 ? 1 : p.lid; // stunned, they flutter; searching, it blinks now and then
    DOWN.set(0, -1, 0).applyQuaternion(Q.copy(group.quaternion).invert()); // which way down is, as the body sees it
    const bank = clamp(p.turn * 0.1, -0.25, 0.25), cock = mood === 'aim' && !pin ? 0.18 * side * k : 0, hang = p.droop * -DOWN.y;
    p.foldL = damp(p.foldL, p.fold + hang + bank - cock + 0.5 * p.droop * DOWN.x, 7, dt); p.foldR = damp(p.foldR, p.fold + hang - bank + cock - 0.5 * p.droop * DOWN.x, 7, dt);
    p.lean = damp(p.lean, clamp(-p.turn * 0.22, -0.5, 0.5) + (mood === 'stuck' || mood === 'jammed' ? 0.3 * Math.sin(t * 11) : 0) + 0.7 * p.droop * DOWN.x, 8, dt);
    u.uHeave.value.set(p.heave, p.deep * breathe(p.breath - 0.16)); u.uMove.value.set(p.gape, blink, p.lean); u.uWing.value.set(p.wing, 2.6, p.ripple, 0); u.uFold.value.set(p.foldL, p.foldR); u.uPant.value = p.pant;
    for (const h of halos) { const lit = Math.min(1, p.pant / 1.8); h.visible = lit > 0.03; h.scale.setScalar(0.5 + 0.9 * lit); h.material.opacity = 0.75 * lit; h.position.y = SHEARER.holes[0][1] + 0.17 * p.heave; }

    // the saw, where the neck has carried it (as the shader bends the head: spine.js), with the little of the swimming wave that reaches the head
    const ph = mat.userData.swim.value;
    saw.rotation.set(-p.hp, p.hy, 0); V.set(Math.sin(ph) * W.amp * 0.1, 0, 0).applyEuler(saw.rotation); saw.position.set(V.x, V.y, SHEARER.neck + V.z);
    // the tail: the sweep it would make in still water goes on from the trunk's own wave and its curve, wider toward the tip; spent, it hangs. It goes after that
    hung.matrix.multiplyMatrices(group.matrix, mount.matrix); inv.copy(hung.matrix).invert();
    for (let i = 0; i <= tail.n; i++) { const z = T.root - T.cuts[i], sw = (W.nose - z) / W.length, f = T.cuts[i] / tail.long, back = SHEARER.neck - z, d = p.sag * 1.05 * f ** 1.6;
      const x = Math.sin(ph - sw * W.waves) * W.amp * (0.1 + 0.9 * sw * sw) * lerp(1, 2.3 * p.sweep, f) + p.curve * back * back;
      tail.shape[i].set(-(x + DOWN.x * d), DOWN.y * d, T.cuts[i] - DOWN.z * d); }
    opts.scale = sc; opts.water = s.treadmill ? water.set(-Math.sin(s.yaw) * (s.speed || 0), 0, -Math.cos(s.yaw) * (s.speed || 0)) : null;
    tail.trail(dt, hung, inv, opts);
  }

  // What has come off it: a tooth, or the end of the saw. Each is flung, sinks through the water turning over, and lies where it comes down.
  // floor(p): the height of the bed under p (it may move p too, as the world goes round); the rig does not know where the bed is.
  const loose = []; let seed = 41; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  function fling(mesh, way, speed, lie) {
    const home = group.parent; if (!home) { mesh.visible = false; return; }
    const v = new THREE.Vector3(...way).normalize().applyQuaternion(mesh.getWorldQuaternion(Q)).multiplyScalar(speed).addScaledVector(moving, 0.35); v.y += 0.5 + rnd();
    home.attach(mesh); mesh.material = dead; mesh.traverse((o) => { o.material = dead; });
    loose.push({ mesh, v, axis: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(), turn: 5 + 6 * rnd(), lie, rest: false });
  }
  function settle(dt, floor) {
    for (const o of loose) { if (o.rest) continue; const m = o.mesh;
      o.v.multiplyScalar(Math.exp(-1.5 * dt)); o.v.y -= 3.4 * dt; m.position.addScaledVector(o.v, dt); m.rotateOnAxis(o.axis, o.turn * dt); o.turn *= Math.exp(-0.7 * dt);
      const y = floor(m.position) + o.lie * m.scale.y; if (m.position.y <= y) { m.position.y = y; o.rest = true; V.set(0, 0, 1).applyQuaternion(m.quaternion); m.rotation.set(0.04, Math.atan2(V.x, V.z), 0.03); } } // it lies flat
  }
  const back = (mesh, on, home, size) => { const i = loose.findIndex((o) => o.mesh === mesh); if (i >= 0) loose.splice(i, 1); on.add(mesh); mesh.position.copy(home); mesh.rotation.set(0, 0, 0); mesh.scale.setScalar(size); mesh.traverse((o) => { o.material = hard; }); mesh.visible = true; };
  // The saw as it now is: `lost` rows of teeth knocked out (every fourth tooth is a row, and the two edges lose different teeth), and the blade snapped short.
  // What goes, flies off. (Going back to a whole saw, which only the library does, puts everything where it was.)
  let wearing = '0|false', endOff = false;
  function wear(lost, snapped) {
    const key = `${lost}|${!!snapped}`; if (key === wearing) return; wearing = key;
    group.updateMatrixWorld(true); const gone = endOff;
    if (!snapped && endOff) { back(end, saw, new THREE.Vector3(...G.mid), 1); endOff = false; }
    for (const t of teeth) if (t.off && t.def.row >= lost) { back(t.mesh, t.on, t.home, t.size); if (t.def.side < 0) t.mesh.rotation.z = Math.PI; t.off = false; }
    for (const t of teeth) if (!t.off && t.def.row < lost) { t.off = true; if (t.def.end && gone) continue; fling(t.mesh, [1, 0.25, 0.5 * (rnd() - 0.5)], 2.6 + 2.4 * rnd(), 0.03); } // (a tooth on an end that broke off before stays on it)
    if (snapped && !endOff) { fling(end, [0.25 * (rnd() - 0.5), 0.3, 1], 2.4, 0.05); endOff = true; }
    for (const t of teeth) t.mesh.visible = !(t.off && t.mesh.parent === end && !endOff); // (the library, going back: a tooth that went while its end lay on the bed)
    broken.visible = endOff;
  }

  // on the stand in the library: each mood, the ones with a beginning and an end played over and over. lift: how far the stand is over the library's bed
  const stand = { time: 0, look: new THREE.Vector3() };
  function show(dt, state, speed, lift = 3.2) {
    stand.time += dt;
    const sc = group.scale.x, id = state.id, loop = (secs) => (stand.time % secs) / secs, pin = id === 'pin' || id === 'stuck';
    stand.look.set(Math.sin(stand.time * 0.6) * 5 * sc, -1 * sc, 6 * sc);
    let mood = id === 'idle' ? 'search' : id === 'pin' ? 'aim' : id === 'gapped' || id === 'snapped' || id === 'tooth' ? 'tired' : id, k = 0, y = 0, lost = id === 'gapped' ? 2 : id === 'snapped' ? 3 : 0;
    if (id === 'tooth') { const v = loop(4.2); lost = v > 0.14 ? 1 : 0; if (lost && v < 0.36) mood = 'stun'; } // spent; rammed in the flank, and a row of teeth goes; and whole again, to show it over
    wear(lost, id === 'snapped');
    if (id === 'swipe') { const v = loop(1.6); mood = v < 0.3 ? 'aim' : v < 0.62 ? 'swipe' : 'tired'; k = v < 0.3 ? v / 0.3 : 0; }
    if (id === 'aim') k = Math.min(1, loop(2.2) * 1.6);
    if (id === 'charge') { const v = loop(2.4); mood = v < 0.35 ? 'aim' : v < 0.7 ? 'charge' : 'tired'; k = v < 0.35 ? v / 0.35 : (v - 0.35) / 0.35; }
    if (id === 'pin') { const v = loop(2.8); mood = v < 0.4 ? 'aim' : v < 0.52 ? 'charge' : 'stuck'; k = v < 0.4 ? v / 0.4 : 1; y = (v < 0.4 ? 1.6 * ease(v / 0.4) : v < 0.52 ? 1.6 * (1 - (v - 0.4) / 0.12) : 0) * sc; }
    update(dt, { x: 0, y, z: 0, yaw: 0, speed: speed * sc, climb: 0, mood, mode: pin ? 'pin' : 'slash', side: 1, k, look: stand.look, time: stand.time, treadmill: true });
    settle(dt, () => -lift);
  }
  a.object = group;
  a.rig = { update, show, wear, settle, get worn() { return wearing; }, pose: p, get head() { return mat.userData.head; }, get glow() { return mat.userData.glow.value; }, saw, teeth, tail, loose, triangles };
  return a.rig;
}
