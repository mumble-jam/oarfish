// The white-spotted pufferfish in motion, and the circle it builds in the sand: two components, because the circle stays where it was made and is
// a thing to be shown at any stage of its building with or without the fish. Not in the dive yet: nothing makes either but the specimen library and
// the testing tool in the pause menu.
// The fish: its body is one model that blows up into a ball in its shader (`flex`, critters.js), the spines on its belly standing out of it; its back
// fin and the fin under it, its two pectorals and its tail are pieces that flutter; it can carry a fragment of shell in its beak; ploughing, it
// kicks up puffs of sand that stay where they were kicked up and settle.
//   swim     hovering and going, on its fluttering fins, as puffers do
//   plough   belly down in the sand, driving along a valley with its fins beating hard, sand flying behind
//   stir     in the middle of the circle, rocking from side to side, the fin under it flapping: the fine pattern
//   carry    a fragment of shell in its beak, which it sets down on a peak
//   puffed   blown up into a ball, the spines out, the fins too small for it
// The circle (`sandCircle`): radial valleys and ridges round a flat middle of fine sand, shells on the peaks, at a stage of building (`stage`):
// 0 untouched, 0.15 the first ring dug, 0.4 the valleys ploughed rough, 0.7 the ridges sharp and the middle worked, 1 finished with its shells,
// and on to 1.3, left after the eggs: it flattens.
// What was taken from the real animal, and where it was read:
//   Torquigener albomaculosus, about 10 cm, brown or brownish yellow with white spots, the belly silvery white with white spots (Wikipedia,
//   "Torquigener albomaculosus"). It first makes a simple circle in the sand with its belly, then flaps its fins along the floor to raise ridges,
//   swimming in straight lines from the outside in, making valleys and peaks; it waves its anal fin in and out in the middle to make an irregular maze
//   of fine sand, which collects there; it decorates the ridges with shell and coral; the circle is about 2 m across and takes 7 to 9 days (Wikipedia).
//   Radii 79 to 105 cm, the middle 31 to 50 cm across; repeated passes sharpen the ridges; after spawning the male stays about six days without
//   repairing it and it flattens; he never uses a site twice; the middle's current is 24% slower than outside (Kawase, Okata and Ito 2013,
//   Scientific Reports, in the research notes). The trait proposed as its rule: it draws a circle and the middle is calm.
// Modelled from description only: the fish's outline and fins (from what puffers are), the number of ridges (28: no count was read), the height of
// the ridges, the look of the puffed fish (Torquigener can puff, as puffers do, but nothing read describes this one puffed), and its colours'
// pattern. The fish is made two and a half times its size (30 cm) and the circle half as big again (2.9 m across), so the fish is a little big
// for its circle.
import * as THREE from 'three';
import { PUFFER, pufferFin, shellBit } from './critters.js';
import { clamp, lerp, damp } from './geo.js';

const ease = (t) => t * t * (3 - 2 * t);
const MOODS = { swim: { flap: 9, amp: 0.45, tail: 0.25, pitch: 0 }, plough: { flap: 18, amp: 0.95, tail: 0.5, pitch: 0.16 }, stir: { flap: 14, amp: 0.6, tail: 0.3, pitch: 0.08 }, carry: { flap: 10, amp: 0.5, tail: 0.25, pitch: 0 }, puffed: { flap: 6, amp: 0.25, tail: 0.1, pitch: 0 } };
const PUFF = `\n  transformed += flex.xyz * uPuff;`;
export function pufferRig(a, pal) {
  const group = new THREE.Group(), body = a.body, mat = body.material; group.name = 'puffer'; group.rotation.order = 'YXZ'; group.add(body);
  const parts = mat.clone(); a.owned.push(parts);
  const u = { uPuff: { value: 0 } }, before = mat.onBeforeCompile, key = mat.customProgramCacheKey ? mat.customProgramCacheKey() : '';
  mat.onBeforeCompile = (sh, r) => { before?.(sh, r); Object.assign(sh.uniforms, u); sh.vertexShader = `attribute vec4 flex;\nuniform float uPuff;\n${sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>${PUFF}`)}`; };
  mat.customProgramCacheKey = () => `${key}|puff`;
  const count = (g) => g.attributes.position.count / 3; let triangles = count(body.geometry);
  const geos = {}; const geoOf = (k) => { if (!geos[k]) { geos[k] = pufferFin(pal, k); a.owned.push(geos[k]); triangles += count(geos[k]); } else triangles += count(geos[k]); return geos[k]; };
  const fins = PUFFER.fins.map((f) => { const mesh = new THREE.Mesh(geoOf(f.kind), parts); mesh.castShadow = true; group.add(mesh); if (f.side < 0) mesh.scale.x = -1; return { ...f, mesh, at: new THREE.Vector3(...f.at), ph: f.kind === 'anal' ? 1.6 : f.side < 0 ? 0.8 : 0 }; });
  const bitGeo = shellBit(pal); a.owned.push(bitGeo); triangles += count(bitGeo); const bit = new THREE.Mesh(bitGeo, parts); group.add(bit); bit.visible = false;
  // puffs of sand, kicked up behind it; kept where they were kicked up (in the space of whatever it is in), and set in its space each frame
  const puffGeo = new THREE.TetrahedronGeometry(0.025, 0), puffMat = new THREE.MeshLambertMaterial({ color: pal.silt, flatShading: true, transparent: true, opacity: 0.8, depthWrite: false }); a.owned.push(puffGeo, puffMat);
  const puffs = Array.from({ length: 10 }, () => { const m = new THREE.Mesh(puffGeo, puffMat); m.visible = false; group.add(m); return { m, at: new THREE.Vector3(), v: new THREE.Vector3(), age: 9 }; });
  const p = { t: 0, puff: 0, flap: 0, amp: 0.4, tail: 0.25, pitch: 0, rock: 0, carry: 0, kick: 0, next: 0 }, inv = new THREE.Matrix4(), V = new THREE.Vector3(), C = new THREE.Vector3(...PUFFER.ball);
  const swell = (pt, out) => { V.copy(pt).sub(C); V.z *= 0.85; const d = V.length() || 1, k = PUFFER.puff / d; return out.copy(pt).add(new THREE.Vector3(V.x * k - V.x, V.y * k - V.y, (V.z * k - V.z) / 0.85 * 0.6).multiplyScalar(p.puff)); };
  // s: x, y, z, yaw, pitch, roll as for the other swimmers; mood (above); carry: true while a fragment is in its beak; treadmill, vz for the stand
  function update(dt, s) {
    p.t += dt; const mood = MOODS[s.mood] ? s.mood : 'swim', L = MOODS[mood], t = p.t;
    p.puff = damp(p.puff, mood === 'puffed' ? 1 : 0, mood === 'puffed' ? 5 : 0.9, dt); u.uPuff.value = p.puff;
    p.amp = damp(p.amp, L.amp, 6, dt); p.tail = damp(p.tail, L.tail, 6, dt); p.pitch = damp(p.pitch, L.pitch, 4, dt); p.flap += dt * L.flap; p.rock = damp(p.rock, mood === 'stir' ? 1 : 0, 3, dt);
    group.position.set(s.x, s.y, s.z); group.rotation.set((s.pitch || 0) + p.pitch, s.yaw || 0, (s.roll || 0) + 0.25 * p.rock * Math.sin(t * 2.4)); group.updateMatrix(); inv.copy(group.matrix).invert();
    for (const f of fins) { swell(f.at, f.mesh.position); const w = Math.sin(p.flap + f.ph), small = 1 - 0.35 * p.puff;
      if (f.kind === 'dorsal') f.mesh.rotation.set(0, p.amp * 0.7 * w, 0); else if (f.kind === 'anal') f.mesh.rotation.set(0, p.amp * 0.7 * w * (1 + p.rock), Math.PI);
      else if (f.kind === 'pectoral') f.mesh.rotation.set(0, f.side * (0.4 + 0.6 * p.amp * w), 0); else f.mesh.rotation.set(0, p.tail * Math.sin(p.flap * 0.4) * (1 - p.puff) + 0.6 * p.puff * 0, 0);
      f.mesh.scale.set((f.side || 1) * small, small, small); }
    bit.visible = !!s.carry; if (s.carry) { bit.position.set(0, -0.006, 0.15 + 0.012 * p.puff); bit.rotation.set(0.3, 0.4 * Math.sin(t), 0); bit.scale.setScalar(2.2); }
    // ploughing or stirring, it kicks up sand behind and under it
    p.next -= dt; const kicking = mood === 'plough' || mood === 'stir';
    if (kicking && p.next <= 0) { p.next = mood === 'plough' ? 0.06 : 0.12; const q = puffs.reduce((o, x) => (x.age > o.age ? x : o)); q.age = 0; q.at.set((Math.random() - 0.5) * 0.06, -0.04, mood === 'plough' ? -0.08 : (Math.random() - 0.5) * 0.1).applyMatrix4(group.matrix); q.v.set((Math.random() - 0.5) * 0.15, 0.12 + 0.1 * Math.random(), (Math.random() - 0.5) * 0.15); if (s.treadmill) q.v.z -= s.vz || 0; }
    for (const q of puffs) { q.age += dt; q.m.visible = q.age < 1.4; if (!q.m.visible) continue; q.at.addScaledVector(q.v, dt); q.v.multiplyScalar(Math.exp(-2 * dt)); q.v.y -= 0.05 * dt; q.m.position.copy(q.at).applyMatrix4(inv); q.m.scale.setScalar((0.5 + q.age) * (1 - q.age / 1.4) * 1.2); q.m.rotation.set(q.age * 3, q.age * 2, 0); }
    puffMat.opacity = 0.75;
  }
  const stand = { time: 0 };
  function show(dt, state, speed) {
    stand.time += dt; const sc = group.scale.x, id = state.id, t = stand.time; let y = 0, z = 0, yaw = 0, carry = false, mood = id, vz = speed * sc;
    if (id === 'swim') { y = 0.02 * Math.sin(t * 1.3); yaw = 0.3 * Math.sin(t * 0.4); }
    else if (id === 'carry') { const q = (t % 3.2) / 3.2; carry = q < 0.7; y = q < 0.55 ? 0.02 * Math.sin(t * 1.3) : -0.05 * Math.sin(Math.PI * (q - 0.55) / 0.45); }
    else if (id === 'puffed') { y = 0.01 * Math.sin(t * 0.9); yaw = 0.2 * Math.sin(t * 0.3); }
    update(dt, { x: 0, y: y * sc, z: z * sc, yaw, mood, carry, treadmill: true, vz });
  }
  a.object = group; a.rig = { update, show, fins, bit, puffs, pose: p, triangles };
  return a.rig;
}

// The circle: its shape at a stage is the shader's, from `cut` on each corner (critters.js, sandCircle)
const CUT = `
  { float groove = smoothstep(0.0, 0.15, uStage) * (1.0 - smoothstep(0.35, 0.6, uStage));
    float rough = smoothstep(0.15, 0.4, uStage), sharp = smoothstep(0.4, 0.7, uStage), worn = smoothstep(1.0, 1.3, uStage);
    float h = mix(cut.y, cut.x, sharp) * rough * (1.0 - 0.8 * worn) - cut.z * groove;
    if (cut.w > 0.0) h -= 0.09 * (1.0 - smoothstep(cut.w - 0.04, cut.w, uStage)); // a fragment, set there late
    transformed.y += h;
    vShow = (cut.w > 0.0 ? 1.0 : cut.w < 0.0 ? sharp : rough) * (1.0 - 0.6 * worn); vRing = cut.z * groove / 0.035; }`;
export function circleRig(a, pal) {
  const mat = a.body.material, u = { uStage: { value: 1 }, uSand: { value: new THREE.Color(pal.sand) } }, before = mat.onBeforeCompile, key = mat.customProgramCacheKey ? mat.customProgramCacheKey() : '';
  mat.onBeforeCompile = (sh, r) => { before?.(sh, r); Object.assign(sh.uniforms, u);
    sh.vertexShader = `attribute vec4 cut;\nuniform float uStage;\nvarying float vShow;\nvarying float vRing;\n${sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>${CUT}`)}`;
    sh.fragmentShader = `uniform vec3 uSand;\nvarying float vShow;\nvarying float vRing;\n${sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb = mix(uSand, diffuseColor.rgb, clamp(vShow, 0.0, 1.0)) * (1.0 - 0.25 * clamp(vRing, 0.0, 1.0));')}`; };
  mat.customProgramCacheKey = () => `${key}|circle`;
  const group = new THREE.Group(); group.name = 'sandcircle'; group.add(a.body);
  const p = { stage: 1, t: 0 };
  // s: stage, 0 to 1.3 (above)
  function update(dt, s) { p.stage = s.stage ?? p.stage; u.uStage.value = p.stage; }
  const STAGE = { ring: 0.15, valleys: 0.4, ridges: 0.7, done: 1, left: 1.3 };
  function show(dt, state) { p.t += dt; update(dt, { stage: state.id === 'build' ? Math.min(1.3, (p.t % 16) / 12) : STAGE[state.id] ?? 1 }); }
  a.object = group; a.rig = { update, show, pose: p, triangles: a.body.geometry.attributes.position.count / 3 };
  return a.rig;
}
