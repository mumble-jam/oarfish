// The trumpetfish in motion. Its body, snout, eyes and the two soft fins at the back are one model, which bends a little on a neck (spine.js) and
// whose two soft fins ripple in its shader, which is how it swims: by those fins alone, the body held stiff. Hung on it, each a piece of its own:
// ten spines along the back that lie flat or stand, two pectoral and two pelvic fins that flutter, the round tail, the lower lip of the snout that
// drops, and the barbel on its chin (strands.js). Not in the dive yet: nothing makes one but the specimen library and the testing tool in the pause
// menu. What follows is how it looks in each mood; whoever moves it decides what it does.
//   hang     head down among tall things, nearly upright, swaying with the water, fins barely moving
//   swim     level, the two soft fins rippling hard, everything else still
//   shadow   lying close along a long body and going with it: bent to the body's curve, rolled toward it, spines flat, fins working quick and small
//   stalk    it has seen something: the snout lowered at it, the spines half up, creeping
//   strike   the spines up, the snout's floor dropped and swollen and the mouth open, a lunge of a few lengths of its own snout
// It also has a yellow phase (pose.phase, 0 to 1): the real one can change colour quickly.
// What was taken from the real animal, and where it was read:
//   A very long, somewhat compressed body and a strongly compressed head; a very long trumpet-like snout whose mouth can open to the width of the
//   body; a prominent barbel on the chin; the back fin and the fin under it set far back, opposite each other, with 8 to 12 separate spines before
//   the soft back fin; a rounded tail with one or two spots; a black bar along the root of those two fins; commonly mottled brown to reddish brown
//   with black or brown spots and silvery streaks on the head and sides, and blue-grey, bright yellow and green phases; to a metre, commonly
//   60 cm. It hangs head down among gorgonians and sea fans, ambushes prey that swims under it, and uses big plant-eating fish as cover, following
//   them until it strikes (Florida Museum, "Aulostomus maculatus"). The pelvic fins are about halfway along with a dark spot at their base; it is a
//   poor swimmer; it takes prey by suction, expanding the gill membranes and the underside of the snout fast (Fishes of Australia, "Trumpetfish,
//   Aulostomus chinensis").
//   The trait proposed as its rule: it hides along a big harmless body to get close to prey. Trumpetfish models pulled past damselfish colonies
//   alone made the damselfish inspect and flee; attached to the side of a parrotfish model, the response was as to the parrotfish alone
//   (University of Cambridge, on Matchette et al. 2023, Current Biology). So `shadow` is its own pose, made to lie along the oarfish.
// Modelled from description only: that it swims by the back fins alone (the brief's; the sources say only that it is a poor swimmer and drifts),
// the shape of the rounded tail, the exact pattern of the blotches and streaks, and how far the snout's floor drops. It is made at a metre, the
// real one's greatest length, and no bigger.
import * as THREE from 'three';
import { createBundle } from './strands.js';
import { bendy } from './spine.js';
import { TRUMPET, trumpetSpine, trumpetFin, trumpetTail, trumpetJaw, trumpetBarbel } from './critters.js';
import { clamp, lerp, damp } from './geo.js';

const ease = (t) => t * t * (3 - 2 * t);
// What each mood looks like. ripple: how far the soft fins swing (m); beat: how fast the ripple runs (radians a second); spines: 0 flat, 1 standing;
// flutter: how far the small fins swing, and flap how fast; gape: the strike's open mouth; nod: the head turned down on its neck; tailOpen: the tail spread
const BASE = { ripple: 0.006, beat: 3, spines: 0.25, flutter: 0.25, flap: 4, gape: 0, nod: 0, tailOpen: 0.4, curve: 0 };
const MOODS = {
  hang: {},
  swim: { ripple: 0.02, beat: 15, spines: 0.05, flutter: 0.5, flap: 9, tailOpen: 0.2 },
  shadow: { ripple: 0.013, beat: 12, spines: 0, flutter: 0.15, flap: 12, tailOpen: 0.1 },
  stalk: { ripple: 0.009, beat: 7, spines: 0.55, flutter: 0.35, flap: 6, nod: 0.1, tailOpen: 0.5 },
  strike: { ripple: 0.024, beat: 20, spines: 1, flutter: 0.1, flap: 16, gape: 1, nod: 0.06, tailOpen: 1 },
};
const KEYS = Object.keys(BASE);

// The body's own material learns the ripple of the two soft fins, the throat that swells, and the yellow phase; what is hung on it, the phase only
const RIPPLE = `
  { transformed.x += sin(uRip.x - position.z * uRip.y) * uRip.z * flex.x * flex.x;
    transformed.y -= uGape * flex.y * 0.012; transformed.x *= 1.0 + uGape * flex.y * 0.6; }`;
function phased(material, tone, body) {
  const u = { uRip: { value: new THREE.Vector3(0, 60, 0) }, uGape: { value: 0 }, uPhase: { value: 0 }, uTone: { value: new THREE.Color(tone) } };
  const before = material.onBeforeCompile, key = material.customProgramCacheKey ? material.customProgramCacheKey() : '';
  material.onBeforeCompile = (sh, r) => { before?.(sh, r); Object.assign(sh.uniforms, u);
    if (body) sh.vertexShader = `attribute vec4 flex;\nuniform vec3 uRip;\nuniform float uGape;\n${sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n${RIPPLE}`)}`;
    sh.fragmentShader = `uniform float uPhase;\nuniform vec3 uTone;\n${sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n  { float l = dot(diffuseColor.rgb, vec3(0.3, 0.55, 0.15)); diffuseColor.rgb = mix(diffuseColor.rgb, uTone * (0.35 + 1.1 * l), uPhase); }')}`; };
  material.customProgramCacheKey = () => `${key}|phase${body ? 'b' : ''}`;
  return u;
}

// a: the creature as npc.js makes it (a.body: the body). Returns the rig; a.object becomes the animal.
export function trumpetRig(a, pal) {
  const group = new THREE.Group(), body = a.body, mat = body.material, parts = mat.clone(); group.name = 'trumpet'; group.rotation.order = 'YXZ'; group.add(body); a.owned.push(parts);
  const ub = phased(mat, pal.yellow, true); bendy(mat, { neck: TRUMPET.neck }); const up = phased(parts, pal.yellow, false);
  const count = (g) => g.attributes.position.count / 3; let triangles = count(body.geometry);
  const piece = (geo) => { const m = new THREE.Mesh(geo, parts); m.castShadow = true; group.add(m); a.owned.push(geo); triangles += count(geo); return m; };
  const spineGeo = trumpetSpine(pal); a.owned.push(spineGeo);
  const spines = TRUMPET.spines.map((z, i) => { const m = new THREE.Mesh(spineGeo, parts); group.add(m); triangles += count(spineGeo); const [, , upY, , y] = at(z); return { z, mesh: m, y: y + upY * 0.94, ph: i * 0.7 }; });
  const fins = TRUMPET.fins.map((f) => { const mesh = piece(trumpetFin(pal, f)); mesh.scale.x = f.side; return { ...f, mesh, ph: f.side > 0 ? 0 : 1.4 }; });
  const tail = piece(trumpetTail(pal)), jaw = piece(trumpetJaw(pal));
  const B = TRUMPET.barbel, bundle = createBundle([{ geometry: trumpetBarbel(pal), cuts: B.cuts, feel: { stiff: [7, 3], drag: [1.5, 3], ease: 0.8 } }], parts); group.add(bundle.mesh); a.owned.push(bundle); triangles += 2 * (B.cuts.length - 1);
  const barbel = bundle.strands[0];
  const p = { ...BASE, t: 0, rip: 0, flapT: 0, phase: 0, roll: 0, turn: 0, yawWas: null, was: new THREE.Vector3(), mood: 'hang' }, G = {};
  const inv = new THREE.Matrix4(), moving = new THREE.Vector3(), water = new THREE.Vector3(), opts = { scale: 1, moving, water: null }, D = new THREE.Vector3();
  function at(z) { const B2 = TRUMPET.body; let i = 0; while (i < B2.length - 2 && B2[i + 1][0] > z) i++; const a2 = B2[i], b = B2[i + 1], t = clamp((a2[0] - z) / (a2[0] - b[0]), 0, 1); return a2.map((v, k) => v + (b[k] - v) * t); }
  // where a point of the body has gone when the shader has bent it (spine.js does this sum for the body itself; the pieces are placed by doing it again)
  const N = TRUMPET.neck, bent = (x, y, z, out) => { const head = mat.userData.head, c = mat.userData.curve.value, f = ease(clamp((z - (N - 0.45)) / 0.9, 0, 1)), ta = head.x * f, tb = head.y * f;
    let zz = z - N; const back = Math.max(0, N - z), x1 = x * Math.cos(ta) + zz * Math.sin(ta); zz = zz * Math.cos(ta) - x * Math.sin(ta); const y1 = y * Math.cos(tb) + zz * Math.sin(tb); zz = zz * Math.cos(tb) - y * Math.sin(tb);
    return out.set(x1 + c * back * back, y1, N + zz); };
  const slope = (z) => -2 * mat.userData.curve.value * Math.max(0, N - z); // which way the body points there, as dx/dz

  // s: x, y, z where it is; yaw the way its snout points; pitch, snout down; roll; mood; curve: how far its body is bent aside (shadow sets it from
  // the body it lies along); phase: 0 its own colours, 1 yellow; treadmill, vx, vy, vz as for the squid (the library)
  function update(dt, s) {
    p.t += dt; const sc = group.scale.x, mood = MOODS[s.mood] ? s.mood : 'hang', L = MOODS[mood];
    for (const k of KEYS) G[k] = L[k] ?? BASE[k];
    if (s.curve !== undefined) G.curve = s.curve;
    const quick = mood === 'strike' ? 22 : 5; for (const k of KEYS) p[k] = damp(p[k], G[k], k === 'gape' && mood === 'strike' ? 30 : quick, dt);
    p.phase = damp(p.phase, s.phase || 0, 1.5, dt); p.rip += dt * p.beat; p.flapT += dt * p.flap;
    const first = p.yawWas === null, turn = first || dt <= 1e-5 ? 0 : clamp(Math.atan2(Math.sin(s.yaw - p.yawWas), Math.cos(s.yaw - p.yawWas)) / dt, -3, 3);
    moving.set(s.x - p.was.x, s.y - p.was.y, s.z - p.was.z); if (first || dt <= 1e-5 || moving.length() > 4 * sc) moving.set(0, 0, 0); else moving.multiplyScalar(1 / dt);
    p.yawWas = s.yaw; p.was.set(s.x, s.y, s.z); p.turn = damp(p.turn, turn, 3, dt);
    group.position.set(s.x, s.y, s.z); group.rotation.set(s.pitch || 0, s.yaw, (s.roll || 0) - clamp(p.turn * 0.12, -0.3, 0.3)); group.updateMatrix(); inv.copy(group.matrix).invert();
    // the body: the soft fins ripple, the throat swells, the neck nods, and a turn bends it a little (it is stiff)
    ub.uRip.value.set(p.rip, 60, p.ripple); ub.uGape.value = p.gape; ub.uPhase.value = up.uPhase.value = p.phase;
    mat.userData.head.set(-clamp(p.turn * 0.05, -0.12, 0.12), -p.nod + 0.02 * Math.sin(p.t * 0.7)); mat.userData.curve.value = p.curve + clamp(p.turn * 0.12, -0.4, 0.4);
    // the spines: each laid back flat, or standing, a little after the one before it
    for (const sp of spines) { bent(0, sp.y, sp.z, sp.mesh.position); sp.mesh.rotation.set(-1.35 * (1 - clamp(p.spines + 0.08 * Math.sin(p.t * 3 + sp.ph) * p.spines, 0, 1)), Math.atan(slope(sp.z)), 0); }
    // the small fins flutter, each a little after the other
    for (const f of fins) { bent(f.at[0], f.at[1], f.at[2], f.mesh.position); const w = Math.sin(p.flapT + f.ph);
      if (f.kind === 'pectoral') f.mesh.rotation.set(0, f.side * (0.5 + p.flutter * w), f.side * -0.25); else f.mesh.rotation.set(0, f.side * (0.2 + 0.4 * p.flutter * w), f.side * -1.2); }
    bent(0, 0, TRUMPET.tail, tail.position); tail.rotation.set(0, Math.atan(slope(TRUMPET.tail)) + 0.08 * Math.sin(p.rip * 0.5), 0); tail.scale.set(1, 0.55 + 0.5 * p.tailOpen, 1);
    bent(0, TRUMPET.jaw[1], TRUMPET.jaw[2], jaw.position); jaw.rotation.set(0.5 * p.gape + 0.02 * Math.sin(p.t * 1.3), mat.userData.head.x, 0);
    // the barbel hangs from the chin and trails in the water
    opts.scale = sc; opts.water = s.treadmill ? water.set(-(s.vx || 0), -(s.vy || 0), -(s.vz || 0)) : null;
    const root = bent(B.root[0], B.root[1], B.root[2], D.set(0, 0, 0)); barbel.shape[0].copy(root);
    for (let i = 1; i < barbel.shape.length; i++) barbel.shape[i].copy(root).add(new THREE.Vector3(0.002 * Math.sin(p.t * 2 + i), -0.6 * B.cuts[i], 0.8 * B.cuts[i]));
    barbel.trail(dt, group, inv, opts);
  }
  // on the stand in the library
  const stand = { time: 0 };
  function show(dt, state, speed) {
    stand.time += dt; const sc = group.scale.x, id = state.id, t = stand.time;
    let pitch = 0, yaw = 0, roll = 0, z = 0, y = 0, mood = id, curve, phase = 0, v = 0;
    if (id === 'hang' || id === 'yellow') { mood = 'hang'; pitch = 1.2 + 0.05 * Math.sin(t * 0.5); roll = 0.06 * Math.sin(t * 0.37); yaw = 0.1 * Math.sin(t * 0.23); phase = id === 'yellow' ? 1 : 0; }
    else if (id === 'swim') { v = speed; pitch = 0.03 * Math.sin(t * 0.6); }
    else if (id === 'shadow') { v = speed; curve = 0.22 * Math.sin(t * 0.45); roll = -0.35; }
    else if (id === 'strike') { const q = (t % 3) / 3; // it creeps up and lowers its snout, shoots forward with its mouth open, and drifts back
      if (q < 0.55) { mood = 'stalk'; z = -0.1 + 0.08 * ease(q / 0.55); pitch = 0.12; } else if (q < 0.66) { mood = 'strike'; z = -0.02 + 0.22 * ease((q - 0.55) / 0.11); pitch = 0.1; } else { mood = q < 0.75 ? 'strike' : 'hang'; z = 0.2 - 0.3 * ease((q - 0.66) / 0.34); } }
    else if (id === 'stalk') { pitch = 0.12; z = 0.02 * Math.sin(t); }
    update(dt, { x: 0, y: y * sc, z: z * sc, yaw, pitch, roll, mood, curve, phase, treadmill: true, vx: 0, vy: 0, vz: v * sc });
  }
  a.object = group; a.rig = { update, show, spines, fins, tail, jaw, barbel, pose: p, triangles };
  return a.rig;
}
