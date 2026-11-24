// The seal over a kept rift (guards.js holds one while its keeper lives). It is the picture of the rule, not the rule: what keeps
// the fish out is still `pushOut` in guards.js, which holds every part of the body over the ledges' height between the walls.
// George found the old seal, bars of light from wall to wall, 'a bit rough', a web or a net over the rift. Two looks were made in
// its place, to be compared in the water (the testing tools: 'Closed rift: glass / shoal'); the first is the one a player gets.
//   glass  A sheet like a second surface. Divers in flooded caves meet a halocline, where salt water lies under fresh: the boundary
//          looks like a pool's surface from above, a wavering sheet of glass. One soft sheet lies just over the ledges, the rift's own
//          outline, slowly heaving; the dark of the next band shows dimly through it, the light under the cloud keeps its time in it,
//          the sky is in it at a slant, and nothing the light makes passes below it (it is drawn after the cloud and before the
//          shafts, and keeps them out). Where any part of the body comes near it rings spread out from there. When the keeper
//          falls it tears from the middle along the rift's length, the two halves fold down and it drains into the dark.
//   shoal  A living lid. The rift is full to the brim of small silver fish, a bait ball stretched along it, turning slowly, each layer
//          against the one over it; flashes run along it as they roll. It gives way round the oarfish and closes behind. When the
//          keeper falls it bursts upward and scatters, the middle first. Not a swarm of the game's: nothing here can be eaten.
// Both are one draw call, with everything that moves in its shader. Every number is in SEAL.
import * as THREE from 'three';
import { FLOORS } from './world.js';
import { clamp } from './geo.js';

export const SEAL = {
  looks: ['glass', 'shoal'], // the first is the one a player gets
  over: 0.7, // how far out over the ledges, past the top of the walls, it reaches (its edge lies on the ledge, under the fish)
  glass: {
    lift: 0.16, step: 1, cols: 16, // how far over the ledges' floor it lies; its mesh: a row every metre along, this many across
    alpha: 0.93, // how much of the cloud under it it hides, looking straight down
    touch: 1.6, // a part of the body this near over it (metres) sets rings going
    rips: 16, speed: 1.6, life: 3.6, // rings at once; how fast one spreads; how long it lasts
    press: 8, // parts of the body that press a dimple into it at once
    tear: 1.0, widen: 1.5, drain: 2.8, // seconds for the tear to run out to the ends; for it to open wide where it has reached; for all of it to have gone down into the dark
  },
  shoal: {
    n: 4800, // fish
    top: 0.55, deep: 2.2, // the shoal's top over the ledges' floor (just under where the fish can sink to), and how far down it goes
    size: [0.8, 1.2], speed: [0.9, 1.7], layers: 3, // each a little fish of 0.5 m, this much bigger or smaller; metres a second
    under: 1.6, dim: 0.7, // the dark under it, so that what shows between the fish is deep water and not the pale cloud: how far under the ledges, and how dark
    near: 2.6, // how far it gives way round each part of the body
    burst: [4, 10], scatter: 3, // how fast they go, metres a second, when the keeper falls; and how long they take to be gone
  },
};
// the tones each band's lid is drawn in. Glass: its glints, and how much more its sheen and its edge show in the dark (shine). Shoal: back, flank, and a light of its own
// for the dark bands (sprat in the two bands with sun, lanternfish below, as the band's own swarms are)
const TONES = [
  { glint: 1, shine: 1, back: '#7d9db0', flank: '#eef5f7', belly: '#ffffff', glow: 0.1 },
  { glint: 0.8, shine: 1.1, back: '#6f8fa8', flank: '#e6f0f4', belly: '#ffffff', glow: 0.14 },
  { glint: 0.35, shine: 1.7, back: '#2c3e5b', flank: '#b9c8de', belly: '#dfe8f5', glow: 0.32 },
  { glint: 0.15, shine: 2.4, back: '#1f2d48', flank: '#9fb3d2', belly: '#cbd9ee', glow: 0.5 },
];
const SUN = new THREE.Vector3(9, 34, 7).normalize(); // main.js keeps the sun at this offset from the fish
const N_TABLE = 160;

// shared by both: where the gap between the walls is, as a table the shaders read (along the rift, from one end to the other: where its
// middle has wandered to, and half the width between the walls at the ledges' height)
function riftTable(rift) {
  const data = new Float32Array(N_TABLE * 4);
  for (let i = 0; i < N_TABLE; i++) { const u = -rift.half + (2 * rift.half * i) / (N_TABLE - 1); data[i * 4] = rift.mid(u); data[i * 4 + 1] = rift.w(u) - rift.ledge; }
  const tex = new THREE.DataTexture(data, N_TABLE, 1, THREE.RGBAFormat, THREE.FloatType); tex.needsUpdate = true; return tex;
}
const TABLE_GLSL = /* glsl */`
uniform sampler2D uTable;
uniform float uHalf;
vec2 riftAt(float u) { // (where the middle has wandered to, half the width between the walls), u metres along the rift from its middle
  float x = clamp((u / uHalf) * 0.5 + 0.5, 0.0, 1.0) * ${(N_TABLE - 1).toFixed(1)};
  int i = int(floor(x)); int j = min(i + 1, ${N_TABLE - 1});
  return mix(texelFetch(uTable, ivec2(i, 0), 0).xy, texelFetch(uTable, ivec2(j, 0), 0).xy, fract(x));
}`;

export function createSeal(scene, world, { floor = 0, look = SEAL.looks[0] } = {}) {
  const rift = world.rift, T = world.size, tone = TONES[Math.min(floor, TONES.length - 1)], F = FLOORS[floor], next = FLOORS[Math.min(floor + 1, FLOORS.length - 1)];
  const group = new THREE.Group(); scene.add(group);
  const trash = [], keep = (o) => { trash.push(o); return o; };
  const table = keep(riftTable(rift));
  const ledgeY = rift.ledgeY, over = SEAL.over;
  // how much of the gap there is along the rift: the ends of it, where the walls meet the ledges
  let u0 = 0, u1 = 0; for (let u = -rift.half; u <= rift.half; u += 0.05) if (rift.w(u) - rift.ledge + over > 0) { if (!u0) u0 = u; u1 = u; }
  const U = Math.max(-u0, u1); // half the length of the gap, about
  const home = (u, a, y) => { const k = a + rift.mid(u); return [rift.x + rift.tx * u + rift.nx * k, y, rift.z + rift.tz * u + rift.nz * k]; };
  const S = { look, shut: true, open: -1, t: 0, gone: false, touched: 0 };
  const uTime = { value: 0 }, uOpen = { value: -1 };

  let mesh, step;
  if (look === 'shoal') ({ mesh, step } = shoal()); else ({ mesh, step } = glass());
  mesh.frustumCulled = false; group.add(mesh);

  // ---------------------------------------------------------------- the glass
  function glass() {
    const G = SEAL.glass, y = ledgeY + G.lift, pos = [], seal = [], index = [];
    const rows = []; for (let u = u0; u < u1; u += G.step) rows.push(u); rows.push(u1);
    for (const u of rows) { const s = Math.max(rift.w(u) - rift.ledge + over, 0.02);
      for (let c = 0; c <= G.cols; c++) { const k = (c / G.cols) * 2 - 1, [x, , z] = home(u, k * s, y); pos.push(x, y, z); seal.push(u, k, s); } }
    const C = G.cols + 1; for (let r = 0; r < rows.length - 1; r++) for (let c = 0; c < G.cols; c++) { const a = r * C + c, b = a + 1, d = a + C, e = d + 1; index.push(a, d, b, b, d, e); }
    const geo = keep(new THREE.BufferGeometry()); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('seal', new THREE.Float32BufferAttribute(seal, 3)); geo.setIndex(index);
    const deep = new THREE.Color(next.water).multiplyScalar(0.36).lerp(new THREE.Color(F.water), 0.2), sky = new THREE.Color(F.sky).lerp(new THREE.Color(F.water), 0.45), gold = new THREE.Color('#ffc477');
    const rips = Array.from({ length: G.rips }, () => new THREE.Vector4(0, 0, -99, 0)), press = Array.from({ length: G.press }, () => new THREE.Vector4());
    const mat = keep(new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTable: { value: null }, uHalf: { value: rift.half }, uU: { value: U }, uTime: { value: 0 }, uOpen: { value: -1 }, uRip: { value: rips }, uPress: { value: press },
        uDeep: { value: deep }, uSky: { value: sky }, uWater: { value: new THREE.Color(F.water) }, uGold: { value: gold }, uGlow: { value: 0.5 }, uSun: { value: SUN }, uGlint: { value: tone.glint * Math.min(1, F.sun) }, uShine: { value: tone.shine }, uAlpha: { value: G.alpha } }]),
      defines: { RIPS: G.rips, PRESS: G.press, SPEED: G.speed.toFixed(2), LIFE: G.life.toFixed(2), TEAR: G.tear.toFixed(2), WIDEN: G.widen.toFixed(2), DRAIN: G.drain.toFixed(2) },
      vertexShader: /* glsl */`
attribute vec3 seal; // u along the rift, k across it (-1 to 1, wall to wall), and half its width there
uniform float uTime, uOpen, uU;
uniform vec4 uRip[RIPS]; // x, z, when, how hard
uniform vec4 uPress[PRESS]; // x, z, how hard
varying vec3 vSeal; varying vec3 vHome; varying vec3 vWorld; varying float vSag;
#include <fog_pars_vertex>
float swell(vec2 p, float t) { return 0.07 * sin(p.x * 0.41 + t * 0.62) + 0.05 * sin(p.y * 0.53 - t * 0.47 + 1.3) + 0.035 * sin((p.x - p.y) * 0.83 + t * 0.9); }
float rings(vec2 p) {
  float h = 0.0;
  for (int i = 0; i < RIPS; i++) { vec4 r = uRip[i]; float age = uTime - r.z; if (age < 0.0 || age > LIFE || r.w <= 0.0) continue;
    float x = distance(p, r.xy) - age * SPEED; h += r.w * 0.16 * exp(-age * 0.75) * exp(-x * x * 0.7) * sin(x * 2.8); }
  for (int i = 0; i < PRESS; i++) { vec4 q = uPress[i]; if (q.z <= 0.0) continue; vec2 d = p - q.xy; h -= q.z * 0.22 * exp(-dot(d, d) * 0.7); }
  return h;
}
void main() {
  vec3 p = position;
  float k = abs(seal.y), pin = smoothstep(1.0, 0.72, k); // held still at its edge, where it meets the stone
  p.y += (swell(p.xz, uTime) + rings(p.xz)) * pin;
  vSag = 0.0;
  if (uOpen >= 0.0) { // torn from the middle along its length; the two halves fold down, and all of it drains into the dark
    float tl = uOpen - TEAR * abs(seal.x) / uU, w = 0.8 * smoothstep(0.0, WIDEN, tl);
    float fold = w * (1.0 - k) * 4.0 + w * w * 0.8, drain = 9.0 * pow(smoothstep(TEAR, DRAIN, uOpen), 2.0);
    p.y -= fold + drain * (0.4 + 0.6 * (1.0 - k)); vSag = fold;
  }
  vSeal = seal; vHome = p;
  vec4 wp = modelMatrix * vec4(p, 1.0); vWorld = wp.xyz;
  vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`,
      fragmentShader: /* glsl */`
uniform float uTime, uOpen, uU, uGlow, uGlint, uAlpha, uShine;
uniform vec3 uDeep, uSky, uWater, uGold, uSun;
uniform vec4 uRip[RIPS];
varying vec3 vSeal; varying vec3 vHome; varying vec3 vWorld; varying float vSag;
#include <fog_pars_fragment>
vec2 ringSlope(vec2 p, out float crest) { // how the rings tilt it here, worked out exactly so that they are smooth however coarse the mesh
  vec2 g = vec2(0.0); crest = 0.0;
  for (int i = 0; i < RIPS; i++) { vec4 r = uRip[i]; float age = uTime - r.z; if (age < 0.0 || age > LIFE || r.w <= 0.0) continue;
    vec2 d = p - r.xy; float dist = max(length(d), 1e-3), x = dist - age * SPEED, a = r.w * 0.16 * exp(-age * 0.75) * exp(-x * x * 0.7);
    float dh = a * (2.8 * cos(x * 2.8) - 1.4 * x * sin(x * 2.8)); g += dh * d / dist; crest += a * smoothstep(0.55, 1.0, sin(x * 2.8)) * 9.0; }
  return g;
}
void main() {
  float k = abs(vSeal.y), tear = 0.0;
  if (uOpen >= 0.0) { float tl = uOpen - TEAR * abs(vSeal.x) / uU, w = 0.8 * smoothstep(0.0, WIDEN, tl); if (k < w) discard; tear = smoothstep(0.16, 0.0, k - w) * step(0.001, w); }
  vec3 N = normalize(cross(dFdx(vWorld), dFdy(vWorld))); if (N.y < 0.0) N = -N; // faceted, as everything is
  float crest; vec2 g = ringSlope(vHome.xz, crest); N = normalize(N + vec3(-g.x, 0.0, -g.y) * 2.5);
  vec3 V = normalize(cameraPosition - vWorld);
  float fres = 0.1 + 0.9 * pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);
  // the deep through it: the next band's water, with slow shapes drifting in it, and the light under the cloud keeping its time
  float drift = 0.5 + 0.5 * sin(vHome.x * 0.19 + uTime * 0.11 + 2.0 * sin(vHome.z * 0.16 - uTime * 0.09)) * sin(vHome.z * 0.23 - uTime * 0.07 + 1.5 * sin(vHome.x * 0.13));
  vec3 col = mix(uDeep, uWater, 0.04 + 0.16 * drift);
  col += uGold * uGlow * 0.22 * exp(-vSeal.x * vSeal.x / 160.0) * (0.4 + 0.6 * drift) * (1.0 - k * k); // only at the middle, so as not to grey the whole of it
  // the sky in it at a slant, wavering as a pool's surface does seen from above; and the sun's glints on its facets
  vec3 R = reflect(-V, N);
  float sheen = 0.0; { vec2 q = vHome.xz * 0.3 + vec2(g.x, g.y) * 3.0; for (int i = 0; i < 2; i++) { q += 0.6 * vec2(sin(q.y * 1.3 + uTime * 0.35 + float(i)), cos(q.x * 1.1 - uTime * 0.3)); sheen += abs(sin(q.x * 0.9) * cos(q.y * 0.9)); } sheen = pow(clamp(1.0 - sheen * 0.5, 0.0, 1.0), 5.0); }
  col = mix(col, uSky, clamp(fres * 0.32 + (sheen * 0.3 + crest * 0.6) * uShine, 0.0, 1.0));
  col += vec3(1.0, 0.97, 0.88) * pow(max(dot(R, uSun), 0.0), 40.0) * 1.3 * uGlint;
  // where it meets the stone: a bright line, as water climbs a wall
  float rim = smoothstep(0.78, 0.9, k) * smoothstep(1.0, 0.9, k);
  col = mix(col, uSky * (0.9 + 0.3 * uShine), clamp(rim * 0.45 * uShine, 0.0, 1.0));
  // a torn edge catches the light as it goes
  col = mix(col, uSky * 1.2 + uGold * 0.35 + 0.15, tear * 0.9);
  float a = uAlpha * (0.82 + 0.18 * fres) * smoothstep(1.0, 0.93, k);
  a = max(a, rim * 0.8);
  if (uOpen >= 0.0) a *= clamp(1.0 - smoothstep(DRAIN * 0.6, DRAIN, uOpen) - 0.2 * clamp(vSag, 0.0, 1.0), 0.0, 1.0);
  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
  #include <colorspace_fragment>
  #include <fog_fragment>
}`,
      transparent: true, depthWrite: true, side: THREE.DoubleSide, fog: true,
    }));
    Object.assign(mat.uniforms, { uTable: { value: table }, uRip: { value: rips }, uPress: { value: press } }); // (merge copied them: these are the ones step() writes to)
    const m = new THREE.Mesh(geo, mat); m.renderOrder = -1; // after the cloud and its light (world.js: -5 to -2), before the shafts, the beam and the specks, which it then keeps out
    const U2 = mat.uniforms, last = new Map(); let ri = 0;
    const touch = new THREE.Vector3();
    function step(dt, ctx, off) {
      U2.uTime.value = S.t; U2.uOpen.value = S.open; U2.uGlow.value = rift.light ? rift.light() : 0.5;
      for (const q of press) q.z = 0;
      if (S.open >= 0 || !ctx || !ctx.joints) return;
      const J = ctx.joints; let np = 0; S.touched = 0;
      for (let i = 0; i < J.length; i += 2) {
        const p = J[i]; touch.set(p.x - off.x, p.y, p.z - off.z);
        const inside = rift.in(touch.x, touch.z) - (rift.ledge - over * 0.6), above = p.y - (ledgeY + G.lift);
        if (inside < 0 || above > G.touch) continue;
        const k = clamp(1 - above / G.touch, 0, 1) * clamp(inside / 0.8, 0, 1) * (i === 0 ? 1 : 0.7);
        if (k < 0.05) continue; S.touched++;
        if (np < G.press) press[np++].set(touch.x, touch.z, k * 0.6, 0);
        const was = last.get(i);
        if (!was || S.t - was.t > 1.1 || (S.t - was.t > 0.4 && Math.hypot(touch.x - was.x, touch.z - was.z) > 0.6)) { rips[ri].set(touch.x, touch.z, S.t, k); ri = (ri + 1) % G.rips; last.set(i, { x: touch.x, z: touch.z, t: S.t }); }
      }
    }
    return { mesh: m, step };
  }

  // ---------------------------------------------------------------- the shoal
  function shoal() {
    const H = SEAL.shoal, L = 0.5;
    // one little fish, nose along +x: a body pressed flat from side to side, so that it flashes as it rolls, and a forked tail. Coloured by face: back, flank, belly
    const back = new THREE.Color(tone.back), flank = new THREE.Color(tone.flank), belly = new THREE.Color(tone.belly), V = [], C = [];
    const nose = [0.5 * L, 0, 0], tail = [-0.32 * L, 0.004, 0], top = [0.02 * L, 0.1 * L, 0], bot = [0.06 * L, -0.08 * L, 0], l = [0.04 * L, 0.01 * L, -0.06 * L], r = [0.04 * L, 0.01 * L, 0.06 * L];
    const tri = (a, b, c, col) => { V.push(...a, ...b, ...c); for (let i = 0; i < 3; i++) C.push(col.r, col.g, col.b); };
    tri(nose, top, l, back); tri(nose, r, top, back); tri(tail, l, top, back); tri(tail, top, r, back);
    tri(nose, l, bot, flank); tri(nose, bot, r, flank); tri(tail, bot, l, belly); tri(tail, r, bot, belly);
    tri(tail, [-0.5 * L, 0.09 * L, 0], [-0.44 * L, 0, 0], flank); tri(tail, [-0.44 * L, 0, 0], [-0.5 * L, -0.08 * L, 0], flank);
    const base = new THREE.BufferGeometry(); base.setAttribute('position', new THREE.Float32BufferAttribute(V, 3)); base.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    base.computeVertexNormals(); const geo = keep(new THREE.InstancedBufferGeometry()); for (const k of ['position', 'color', 'normal']) geo.setAttribute(k, base.attributes[k]);
    // each fish: its lane (0 the middle of the gap, 1 its walls), where it starts round, its speed and way round, how deep; and four numbers of its own
    const A = new Float32Array(H.n * 4), B = new Float32Array(H.n * 4); let s = 1;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < H.n; i++) {
      const lane = Math.sqrt(rnd()) * 0.98, depth = Math.pow(rnd(), 2.2), layer = Math.floor(depth * H.layers * 0.999), dir = layer % 2 ? -1 : 1;
      A.set([lane, rnd() * Math.PI * 2, dir * (H.speed[0] + rnd() * (H.speed[1] - H.speed[0])), depth], i * 4);
      B.set([rnd(), rnd(), rnd(), H.size[0] + rnd() * (H.size[1] - H.size[0])], i * 4);
    }
    geo.setAttribute('aA', new THREE.InstancedBufferAttribute(A, 4)); geo.setAttribute('aB', new THREE.InstancedBufferAttribute(B, 4)); geo.instanceCount = H.n;
    const body = Array.from({ length: 10 }, () => new THREE.Vector4(0, -999, 0, 0));
    const mat = keep(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: new THREE.Color(tone.flank), emissiveIntensity: tone.glow }));
    const u = { uTable: { value: table }, uHalf: { value: rift.half }, uU: { value: U }, uTime, uOpen, uBody: { value: body }, uRift: { value: new THREE.Vector4(rift.x, rift.z, ledgeY, 0) }, uFrame: { value: new THREE.Vector4(rift.tx, rift.tz, rift.nx, rift.nz) } };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = `${TABLE_GLSL}
attribute vec4 aA; attribute vec4 aB;
uniform float uU, uTime, uOpen;
uniform vec4 uBody[10]; // parts of the oarfish: x, y, z, and 1 where there is one
uniform vec4 uRift, uFrame;
varying float vFlash;
vec3 placeAt(float th, float lane, float depth) {
  float u = uU * lane * cos(th);
  vec2 ms = riftAt(u);
  float room = max(ms.y - 0.25 - depth * ${H.deep.toFixed(2)} * 0.33, 0.05), a = ms.x + room * lane * sin(th);
  float y = uRift.z + ${H.top.toFixed(2)} - depth * ${H.deep.toFixed(2)};
  return vec3(uRift.x + uFrame.x * u + uFrame.z * a, y, uRift.y + uFrame.y * u + uFrame.w * a);
}
${sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
  {
    float lane = aA.x, depth = aA.w, sp = aA.z, R = max(uU * lane, 3.0);
    float th = aA.y + uTime * sp / R;
    vec3 p = placeAt(th, lane, depth), q = placeAt(th + sign(sp) * 0.02, lane, depth);
    p.y += 0.12 * sin(uTime * 0.9 + aB.x * 6.28) + 0.05 * sin(uTime * 2.3 + aB.y * 6.28);
    vec3 fw = q - p; fw.y = 0.0; fw = length(fw) > 1e-4 ? normalize(fw) : vec3(1.0, 0.0, 0.0);
    // giving way round the oarfish: pushed out from each part of it that comes near, and down, and turned away
    vec3 push = vec3(0.0);
    for (int i = 0; i < 10; i++) { vec4 b = uBody[i]; if (b.w <= 0.0) continue; vec3 d = p - b.xyz; d.y *= 1.6; float dist = length(d);
      if (dist < ${H.near.toFixed(2)}) { float f = 1.0 - dist / ${H.near.toFixed(2)}; push += normalize(d + vec3(0.0, -0.35, 0.0)) * f * f * ${H.near.toFixed(2)} * 0.85; } }
    p += push; if (length(push) > 0.05) fw = normalize(mix(fw, normalize(vec3(push.x, 0.0, push.z) + fw * 0.3), clamp(length(push), 0.0, 0.8)));
    float roll = 0.55 * sin(uTime * 1.1 + dot(p.xz, uFrame.xy) * 0.28 * sign(sp) + aB.z * 2.0), size = aB.w;
    // when the keeper falls: up and out, the middle first, each its own way, and gone
    if (uOpen >= 0.0) {
      float tl = uOpen - 0.7 * abs(dot(p.xz - uRift.xy, uFrame.xy)) / uU - aB.x * 0.25;
      if (tl > 0.0) { vec3 dir = normalize(vec3(aB.y * 2.0 - 1.0, 1.1 + aB.z, aB.x * 2.0 - 1.0) + vec3(uFrame.z, 0.0, uFrame.w) * sign(dot(p.xz - uRift.xy, uFrame.zw)) * 0.6);
        float v = mix(${H.burst[0].toFixed(1)}, ${H.burst[1].toFixed(1)}, aB.y), go = v * (1.0 - exp(-tl * 1.3)) / 1.3;
        p += dir * go; fw = normalize(mix(fw, dir, clamp(tl * 3.0, 0.0, 1.0))); roll += tl * 9.0 * (aB.z - 0.5);
        size *= 1.0 - smoothstep(${(H.scatter * 0.45).toFixed(2)}, ${H.scatter.toFixed(2)}, tl); }
    }
    vec3 side = normalize(cross(vec3(0.0, 1.0, 0.0), fw)), up = cross(fw, side);
    float cr = cos(roll), sr = sin(roll); vec3 s2 = side * cr + up * sr, u2 = up * cr - side * sr;
    transformed = p + (fw * transformed.x + u2 * transformed.y + s2 * transformed.z) * size;
    vFlash = pow(max(sr, 0.0), 6.0);
  }`)}`;
      sh.fragmentShader = `varying float vFlash;\n${sh.fragmentShader.replace('#include <opaque_fragment>', `outgoingLight += vec3(0.85, 0.92, 1.0) * vFlash * ${(0.35 + 0.4 * tone.glint).toFixed(2)};\n#include <opaque_fragment>`)}`; // the flash of a flank turned to the light
    };
    mat.customProgramCacheKey = () => 'riftShoal';
    const m = new THREE.Mesh(geo, mat); m.renderOrder = -1;
    { // the dark under the shoal: the gap between the walls, flat, part seen through
      const y = ledgeY - H.under, pos = []; for (let u = u0; u < u1; u += 1) { const a0 = Math.max(rift.w(u) - rift.ledge, 0.02) + 0.3, a1 = Math.max(rift.w(u + 1) - rift.ledge, 0.02) + 0.3;
        pos.push(...home(u, -a0, y), ...home(u + 1, -a1, y), ...home(u, a0, y), ...home(u, a0, y), ...home(u + 1, -a1, y), ...home(u + 1, a1, y)); }
      const g2 = keep(new THREE.BufferGeometry()); g2.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      const dark = new THREE.Mesh(g2, keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(next.water).multiplyScalar(0.45).lerp(new THREE.Color(F.water), 0.2), transparent: true, opacity: H.dim, depthWrite: false, side: THREE.DoubleSide })));
      dark.renderOrder = -1.5; dark.frustumCulled = false; m.add(dark); m.userData.dark = dark; }
    function step(dt, ctx, off) {
      for (const b of body) b.w = 0;
      m.userData.dark.material.opacity = H.dim * (S.open < 0 ? 1 : 1 - clamp(S.open / (H.scatter * 0.6), 0, 1)); // the deep clears as they go
      if (!ctx || !ctx.joints) return;
      const J = ctx.joints; let n = 0;
      for (let i = 0; i < J.length && n < body.length; i += Math.max(1, Math.floor(J.length / body.length))) { const p = J[i]; body[n++].set(p.x - off.x, p.y, p.z - off.z, 1); }
      S.touched = 0; for (const b of body) if (b.w > 0 && rift.in(b.x, b.z) > rift.ledge - 0.5 && b.y - ledgeY < SEAL.shoal.top + SEAL.shoal.near) S.touched++;
    }
    return { mesh: m, step };
  }

  const off = new THREE.Vector3();
  // ctx: the guard's (focus, joints, time). done: whether the keeper has fallen
  function update(dt, ctx, done) {
    S.t += dt; uTime.value = S.t;
    if (done && S.shut) { S.shut = false; S.open = 0; }
    else if (S.open >= 0) S.open += dt;
    uOpen.value = S.open;
    const f = ctx && ctx.focus; if (f) off.set(T * Math.round((f.x - rift.x) / T), 0, T * Math.round((f.z - rift.z) / T)); // laid out where the rift is; put on the nearest copy of the world
    group.position.copy(off);
    const last = look === 'shoal' ? SEAL.shoal.scatter + 1 : SEAL.glass.drain + 0.2;
    if (S.open > last) { S.gone = true; group.visible = false; return; }
    step(dt, ctx, off);
  }
  // an already open rift (a keeper beaten before the look was changed) shows nothing
  function gone() { S.shut = false; S.open = 99; S.gone = true; group.visible = false; }
  function dispose() { scene.remove(group); for (const o of trash) o.dispose(); }
  return { update, dispose, gone, state: S, look, group, mesh };
}
