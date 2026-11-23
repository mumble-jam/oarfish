// The garden eels in motion: a colony in its patch of sand, every eel the same light model drawn as one instanced mesh, each in its own hole.
// Everything an eel does is in the shader, from two numbers it is given (`iEel`: how far out of its hole it is, 0 to 1 of the most it comes out, and
// a phase of its own) and three that the whole colony shares (`uFlow`: how hard the current is, how far they sway, how often they pick): it is
// pushed up out of its hole by as much as it is out, and what is out leans down the current, sways, and darts its head at what goes by. Whoever owns
// the colony says how far out each one wants to be; the rig eases each there, down at once and up slowly. Not in the dive yet: nothing makes one
// but the specimen library and the testing tool in the pause menu.
//   feed      two thirds out, facing into a gentle current, swaying and picking
//   current   a strong current: drawn half in and bent hard down the flow, picking only at what comes close
//   heads     only their heads out
//   down      all gone into their holes
//   wave      something passes over the colony: the eels sink ahead of it and rise again behind it, slowly
// What was taken from the real animal, and where it was read:
//   The spotted garden eel, Heteroconger hassi, to 40 cm, long and thin and round, about 14 mm across, the head no wider than the body with large
//   eyes and the mouth close to them; white with many small black spots and three big ones, at the gill opening, in the middle of the body, and
//   round the vent; about a third of the body comes out; it points its mouth into the current to catch drifting plankton (Wikipedia, "Spotted garden
//   eel"). It lives in colonies of hundreds and pulls back into its burrow when approached (Oceana, "Spotted garden eel"). With more current the
//   eels draw further into the burrow, curve the body and strike only at plankton passing close; at the strongest they withdraw completely (OIST,
//   on Ishikawa et al. 2022, in the research notes). Flight distance from divers averaged 2.1 and 2.8 m (Yunger et al. 2025, in the research notes).
// Modelled from description only: the curve of the neck (a question mark, from memory), the spacing of the holes (no figure was found; here a
// little over half a metre), and the brief's "two thirds out", where the reading says about a third: the most here is two thirds, and the
// `current` pose is the third. Made three times its size: 1.2 m long, 4 cm thick.
import * as THREE from 'three';
import { GARDEN, gardenEel } from './critters.js';
import { clamp, damp } from './geo.js';

const VERT = `
  { float E = iEel.x * ${(GARDEN.out * GARDEN.long).toFixed(4)};          // how much of it is out
    float h = transformed.y - ${GARDEN.long.toFixed(4)} + E;               // how high over the sand this corner is
    float H = max(E, 0.04), u = clamp(h / H, 0.0, 1.0), w = u * u;
    float lean = uFlow.x * (0.2 + 0.8 * uFlow.x);
    float pick = pow(max(0.0, sin(uTime * 0.83 + iEel.y * 3.7)), 18.0) * uFlow.z;
    float sway = sin(uTime * 1.15 + iEel.y) + 0.4 * sin(uTime * 2.3 + iEel.y * 1.7);
    transformed.y = h - 0.35 * lean * lean * H * w;
    transformed.z += -lean * 0.55 * H * w + pick * 0.1 * smoothstep(0.7, 1.0, u);
    transformed.x += uFlow.y * 0.12 * H * w * sway; }`;
// a: the creature as npc.js makes it (a.body: the patch of sand and its holes). Returns the rig; a.object is the colony.
export function gardenEelRig(a, pal) {
  const group = new THREE.Group(), geo = gardenEel(pal), n = GARDEN.holes.length; group.name = 'gardeneels'; group.add(a.body); a.owned.push(geo);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide, emissive: '#ffffff', emissiveIntensity: 0.07 }); a.owned.push(mat);
  const u = { uTime: { value: 0 }, uFlow: { value: new THREE.Vector3(0.3, 1, 1) } };
  mat.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, u); sh.vertexShader = `attribute vec2 iEel;\nuniform float uTime;\nuniform vec3 uFlow;\n${sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERT}`)}`; };
  mat.customProgramCacheKey = () => 'gardeneel';
  const mesh = new THREE.InstancedMesh(geo, mat, n), eel = new Float32Array(n * 2), attr = new THREE.InstancedBufferAttribute(eel, 2); geo.setAttribute('iEel', attr); attr.setUsage(THREE.DynamicDrawUsage);
  mesh.castShadow = true; mesh.frustumCulled = false; group.add(mesh);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), P = new THREE.Vector3();
  const eels = GARDEN.holes.map(([x, z], i) => ({ x, z, out: 0.6, k: 0.88 + 0.24 * ((i * 0.618) % 1), jit: (((i * 0.37) % 1) - 0.5) * 0.5, ph: i * 2.3 }));
  const p = { t: 0, flow: 0.3, sway: 1, pick: 1, yaw: null };
  const face = (yaw) => { eels.forEach((e, i) => { M.compose(P.set(e.x, 0, e.z), Q.setFromAxisAngle(Y, yaw + e.jit), S.setScalar(e.k)); mesh.setMatrixAt(i, M); eel[i * 2 + 1] = e.ph; }); mesh.instanceMatrix.needsUpdate = true; };
  // s: time; want(i, eel): how far out eel i wants to be, 0 to 1 (eel: { x, z } its hole, in the colony's space); flow: the current, 0 to 1; yaw: the
  // way the current comes from, in the colony's space (they face into it); pick: 0 to 1, how keenly they feed
  function update(dt, s) {
    p.t = s.time ?? p.t + dt; p.flow = damp(p.flow, s.flow ?? 0.3, 1.5, dt); p.pick = damp(p.pick, s.pick ?? 1, 2, dt);
    if (p.yaw === null || Math.abs((s.yaw ?? 0) - p.yaw) > 0.01) { p.yaw = s.yaw ?? 0; face(p.yaw); }
    u.uTime.value = p.t; u.uFlow.value.set(p.flow, 0.6 + 0.8 * (1 - p.flow), p.pick);
    eels.forEach((e, i) => { const want = clamp(s.want ? s.want(i, e) : 1, 0, 1) * (1 - 0.55 * p.flow); e.out = damp(e.out, want, want < e.out ? 9 : 0.7, dt); eel[i * 2] = e.out; }); // down at once, up slowly
    attr.needsUpdate = true;
  }
  // on the stand in the library
  const stand = { time: 0 };
  function show(dt, state) {
    stand.time += dt; const id = state.id, t = stand.time, X = -3 + ((t * 1.1) % 7.5); // what passes, in the wave, goes across at a little over a metre a second
    const want = id === 'heads' ? () => 0.06 : id === 'down' ? () => 0 : id === 'current' ? () => 1 : id === 'wave' ? (i, e) => (Math.hypot(e.x - X, e.z * 0.3) < 1.3 ? 0 : 1) : () => 1;
    update(dt, { time: t, want, flow: id === 'current' ? 1 : 0.25, pick: id === 'current' ? 0.25 : 1, yaw: 0.6 });
  }
  const one = geo.attributes.position.count / 3;
  a.object = group; a.rig = { update, show, mesh, eels, pose: p, one, triangles: Math.round(n * one + a.body.geometry.attributes.position.count / 3) };
  return a.rig;
}
