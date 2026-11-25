// The octopus in motion. Its head, mantle, eye bumps and skin points are one model; this hangs on it eight arms, each a piece of its own in a
// socket of its own, each trailed through the water by itself (strands.js); the web of skin between them, made again every frame from where
// the arms are; two eyes that turn to what they watch and keep their pupils level; the siphon; and the things it handles (a stone or a shell, and
// the stones of a den). One rig serves every size: OCTO.forms in critters.js gives each its metres and its proportions. Not in the dive yet: what it
// does there is not decided. What follows is how it looks and moves, each mood a pose the library shows (npc.js: `octopus`, `mason`).
//   den      at rest in its den: body down, arms curled round it on the bed, the tips curling and feeling about, the mantle breathing, the eyes on you
//   crawl    over the bed on its arms: each arm reaches, plants and pushes by turns, no rhythm to it, the body carried low and tilted to the ground
//   jet      mantle first, in pulses: the mantle fills and squeezes, the arms gathered and trailing behind in a bundle, pale
//   reach    one arm goes out to a thing on the bed, coils round it and brings it in under the web
//   carry    the thing held under the web, the animal up on stiff arms, walking on them
//   throw    it gathers a thing under the web, goes dark (the tell), swings its siphon under the arms and blasts the thing away; then pales again
// Its skin, separately (`skin` in the library, `s.skin` in update): pale, mottled (its skin points raised), dark, blanched (pale with dark rings
// round the eyes), passing clouds; or left to the mood. Going dark is meant to be the tell before a hard throw, so dark is near black-maroon.
//
// THE ANIMAL. One species is the model for the look: the day octopus, Octopus cyanea, a shallow-reef octopus of the Indo-Pacific that hunts by day.
//   Proportions: mantle to 16 cm, arms to at least 80 cm, so arms about five mantle lengths (Wikipedia, "Octopus cyanea"); arms stout and robust,
//   all of a length, the fourth pair a little longer (FAO species catalogue, Cephalopods of the World vol. 3, the entry "Octopus cyanea",
//   fao.org/docrep/009/ac479e). So: arm 4.6 mantle lengths here, the fourth pair 6% longer.
//   Eye: one large cirrus over each eye, the mantle smooth with a few big warts (FAO, as above). The pupil is a horizontal bar, and the statocysts
//   keep it level however the body is turned (D. Darling, "octopus eye", Encyclopedia of Science; the nerves and eye muscles that do it: Budelmann
//   and Young 1984, "The statocyst-oculomotor system of Octopus vulgaris", Phil. Trans. R. Soc. B 306). So the eyes here are turned every frame
//   to keep the bar level in the world.
//   Skin, and each tone: mantle mottled and netted, arms with purple-brown blotches, and a dark purplish ringed false eye on the web between each eye
//   and the base of arms III and IV (FAO, as above); brownish-red, with dark blue rings (Animal Diversity Web, "Octopus cyanea"); it changes colour
//   and pattern all the time (one observer counted 1,000 changes in seven hours), matches the bed it crosses, and makes a "passing clouds" display,
//   dark shadows running over it, when it stops near prey (Wikipedia, as above). The colours here are a reddish brown with a cream net, read from
//   those words: no photograph could be opened from this sandbox, so no colour was picked off a photograph.
// THE MOVES, each from a real behaviour, and where it is ours:
//   den: it keeps a den (a crevice, under an overhang, among coral heads, or a hole dug in rubble) and comes back to it after foraging, with a midden
//     of shells outside (Wikipedia, as above). Arms curled round the body, tips feeling: ours, as a resting pose; the den's low wall of stones is the
//     common octopus's doorway of stones (The Cephalopod Page, behaviour, through the research report "Oarfish first level expansion", section 5).
//   crawl: the day octopus forages by crawling, about 28% of daylight, in stop-and-go searches of about 80 m, matching the bed as it goes (Forsythe
//     and Hanlon 1997, "Foraging and associated behavior by Octopus cyanea on a coral atoll, French Polynesia", J. Exp. Mar. Biol. Ecol.). How
//     the arms work is from the common octopus: thrust comes from arms pushing by lengthening, the arms used are chosen moment to moment with no
//     rhythm, and the body's heading is held apart from the way it crawls (Levy, Flash and Hochner 2015, "Arm coordination in octopus crawling
//     involves unique motor control strategies", Current Biology 25). So: an arm behind the body lengthens as the body passes (that is the push), the
//     one that has been left furthest behind steps next, never two side by side. That an arm first reaches out and plants ahead is ours.
//   jet: the mantle leads, the siphon points toward the head, the arms trail behind (Wikipedia, "Octopus"); the mantle fills through its opening and
//     empties through the siphon (same). Pale while it jets: ours, as the squid's flight is.
//   reach and carry: the veined octopus carries coconut halves under its body, spread over them with its arms made rigid, walking on them up to 20 m
//     ("stilt walking"; Finn, Tregenza and Norman 2009, "Defensive tool use in a coconut-carrying octopus", Current Biology). The day octopus groping
//     into crevices with its long arms and pouncing with the web spread (Forsythe and Hanlon 1997) is behind the one long reach. Coiling the tip
//     round a stone: ours.
//   throw: the gloomy octopus (Sydney octopus), Octopus tetricus, throws silt, shells and algae by gathering them in its arms, holding them in its web
//     and blasting them with its siphon, sometimes several body lengths; animals in a uniform dark colour threw hard more often, and hit other
//     octopuses more often (Godfrey-Smith et al. 2022, PLOS ONE, doi:10.1371/journal.pone.0276482, through the University of Sydney's release).
//     So going dark before a hard throw is a true pattern, made into a tell. The siphon swung under the arms is the paper's; how far it goes is ours.
//   skin: dark, pale and mottled are its range (above). Blanching when alarmed is George's brief and the squid's; the pattern it takes here, pale
//     with dark eyes, is one the same paper names in Octopus tetricus (there it went with low-vigour throws, not with alarm). Raised skin points:
//     the mantle's warts and the cirri, raised and lowered (muscles in the skin change its texture: Wikipedia, "Octopus").
import * as THREE from 'three';
import { createStrand } from './strands.js';
import { OCTO, octoArm, octoArmCuts, octoArmSize, octoEye, octoSiphon, octoThing, octoDen } from './critters.js';
import { clamp, lerp, damp } from './geo.js';

const TAU = Math.PI * 2, ease = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }, wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a)), frac = (x) => x - Math.floor(x);
const UP = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);

// Its skin: tone 0 pale to 1 dark (0.5 its own colour), mottle (the net and the pale patches), points (the skin raised), blanch, clouds
export const OCTO_SKINS = {
  pale: { tone: 0.1, mottle: 0.12, points: 0, blanch: 0, clouds: 0 },
  mottled: { tone: 0.5, mottle: 1, points: 1, blanch: 0, clouds: 0 },
  dark: { tone: 1, mottle: 0.06, points: 0, blanch: 0, clouds: 0 },
  blanched: { tone: 0.2, mottle: 0, points: 0, blanch: 1, clouds: 0 },
  clouds: { tone: 0.42, mottle: 0.4, points: 0.3, blanch: 0, clouds: 1 },
};
// Each mood. skin: its own skin when nothing else is asked. high: how high the crown is carried over the bed, in mantle lengths; reach: how far out
// round the body the arms come down (mantle lengths); arch: how much longer than the straight line an arm is from its root to where it comes down
// (1 straight and stiff, more an arch); curl: how far round the rest of it curls on the bed (radians); feel: how much the tips lift and feel about;
// step: how far an arm is left behind before it steps; pitch: the body tipped (+ the face down); quick: the arms' springs made this much harder
const MOODS = {
  den: { skin: { tone: 0.55, mottle: 0.9, points: 0.75 }, high: 0.14, reach: 0.75, arch: 1.12, curl: 6.5, feel: 1, step: 9, pitch: -0.05, quick: 2.2 },
  crawl: { skin: { tone: 0.45, mottle: 0.8, points: 0.35 }, high: 0.4, reach: 1.75, arch: 1.12, curl: 1.6, feel: 0.45, step: 0.75, pitch: 0.12, quick: 3 },
  jet: { skin: { tone: 0.15, mottle: 0.15, points: 0 }, high: 1.6, reach: 1.2, arch: 1.2, curl: 1, feel: 0, step: 9, pitch: -0.68, quick: 1 },
  reach: { skin: { tone: 0.5, mottle: 0.85, points: 0.5 }, high: 0.22, reach: 1.15, arch: 1.3, curl: 2.2, feel: 0.7, step: 9, pitch: 0, quick: 2.2 },
  carry: { skin: { tone: 0.5, mottle: 0.75, points: 0.3 }, high: 1.15, reach: 1.45, arch: 1.025, curl: 1.4, feel: 0.2, step: 0.6, pitch: 0.05, quick: 3.4 },
  throw: { skin: { tone: 0.5, mottle: 0.85, points: 0.5 }, high: 0.2, reach: 1.05, arch: 1.3, curl: 2.2, feel: 0.6, step: 9, pitch: 0, quick: 2.4 },
};
const FEEL = { stiff: [3.2, 1.3], drag: [1.2, 3.4], ease: 0.85 };

// The skin's shader: the mantle's breath and the raised points move corners (`puff`, `rise`); every corner marked as skin takes its colour from the tone,
// the net, the underside, the clouds and the blanch (`skin`). The other pieces (eyes, suckers, the false eye's ring) keep their own colours.
function skinShader(material, pal) {
  const col = (k) => ({ value: new THREE.Color(pal[k]) });
  const u = { uPulse: { value: 0 }, uPoints: { value: 0 }, uTone: { value: 0.5 }, uMottle: { value: 1 }, uBlanch: { value: 0 }, uClouds: { value: 0 }, uClock: { value: 0 },
    uPale: col('pale'), uBase: col('base'), uDark: col('dark'), uNet: col('net'), uUnder: col('under'), uWhite: col('blanch'), uRing: col('ring') };
  const before = material.onBeforeCompile, key = material.customProgramCacheKey ? material.customProgramCacheKey() : '';
  material.onBeforeCompile = (sh, renderer) => {
    before?.(sh, renderer); Object.assign(sh.uniforms, u);
    sh.vertexShader = `attribute vec4 skin;\nattribute vec4 rise;\nattribute vec3 puff;\nuniform float uPulse;\nuniform float uPoints;\nvarying vec4 vSkin;\nvarying float vAlong;\n${sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed += puff * uPulse + rise.xyz * uPoints; vSkin = skin; vAlong = rise.w;')}`;
    sh.fragmentShader = `uniform float uTone;\nuniform float uMottle;\nuniform float uBlanch;\nuniform float uClouds;\nuniform float uClock;\nuniform vec3 uPale;\nuniform vec3 uBase;\nuniform vec3 uDark;\nuniform vec3 uNet;\nuniform vec3 uUnder;\nuniform vec3 uWhite;\nuniform vec3 uRing;\nvarying vec4 vSkin;\nvarying float vAlong;\n${sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
  if (vSkin.w > 0.5) {
    vec3 c = uTone < 0.5 ? mix(uPale, uBase, uTone * 2.0) : mix(uBase, uDark, uTone * 2.0 - 1.0);
    c = mix(c, uPale, max(-vSkin.x, 0.0) * uMottle * 0.5);
    c = mix(c, mix(uNet, uDark, clamp(uTone * 2.0 - 1.0, 0.0, 1.0)), max(vSkin.x, 0.0) * uMottle * 0.85);
    c = mix(c, uDark, smoothstep(0.35, 0.9, sin(vAlong * 2.4 - uClock * 2.3)) * uClouds * 0.9); // dark shadows running from the mantle out along the arms
    c = mix(c, uUnder, vSkin.y * (1.0 - 0.85 * clamp(uTone * 2.0 - 1.0, 0.0, 1.0))); // (the underside stays pale, unless it goes dark all over)
    c = mix(c, uWhite, uBlanch);
    c = mix(c, uRing, uBlanch * vSkin.z);
    diffuseColor.rgb = c * diffuseColor.rgb;
  }`)}`;
  };
  material.customProgramCacheKey = () => `${key}|octo`;
  return u;
}

// The web: for each gap between two arms, the skin from the mouth out along both arms to a part of their length, its free edge scalloped in toward
// the mouth. LEVELS rows; the arms' points are read from their strands every frame.
const LEVELS = 3;
function makeWeb(mat) {
  const tris = 8 * (1 + LEVELS * 4), n = tris * 3, geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), col = new Float32Array(n * 4).fill(1), skin = new Float32Array(n * 4), rise = new Float32Array(n * 4);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
  geo.setAttribute('skin', new THREE.BufferAttribute(skin, 4)); geo.setAttribute('rise', new THREE.BufferAttribute(rise, 4)); geo.setAttribute('puff', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  for (let t = 0; t < tris; t++) { const g = Math.floor(t / (1 + LEVELS * 4)), j = t % (1 + LEVELS * 4), h = frac(Math.sin(g * 12.9 + j * 4.1) * 437.5), net = h > 0.7 ? 1 : h < 0.25 ? -1 : 0, lit = j % 2 ? 0.93 : 1;
    for (let k = 0; k < 3; k++) { const v = t * 3 + k; skin.set([net, 0.25, 0, 1], v * 4); rise[v * 4 + 3] = 1.05 + 0.4 * Math.ceil(j / 4); col[v * 4] = col[v * 4 + 1] = col[v * 4 + 2] = lit; } }
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 100);
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.castShadow = true;
  return { mesh, geo, pos, tris };
}

// a: the creature as npc.js makes it (a.body is the head and mantle). kind: which of OCTO.forms. Returns the rig; a.object becomes the whole animal and what it handles.
export function octopusRig(a, pal, kind = 'neighbour') {
  const form = OCTO.forms[kind], wrap = new THREE.Group(), group = new THREE.Group(), body = a.body, mat = body.material, u = skinShader(mat, pal);
  wrap.name = 'octopus'; group.name = `octopus-${kind}`; group.rotation.order = 'YXZ'; group.add(body); wrap.add(group);
  let triangles = body.geometry.attributes.position.count / 3;
  const piece = (geo, parent, m = mat) => { const o = new THREE.Mesh(geo, m); o.castShadow = true; parent.add(o); a.owned.push(geo); triangles += geo.attributes.position.count / 3; return o; };
  // the arms, each in a socket at its place round the crown, turned to face out from it
  const arms = OCTO.arms.map((def) => {
    const geo = octoArm(pal, form, def), { long, cuts } = octoArmCuts(form, def), socket = new THREE.Object3D(), st = createStrand(geo, mat, cuts, FEEL);
    socket.rotation.y = def.angle; socket.position.set(Math.sin(def.angle) * OCTO.crown, -0.02, Math.cos(def.angle) * OCTO.crown); group.add(socket); socket.add(st.mesh);
    a.owned.push(geo, st); triangles += geo.attributes.position.count / 3;
    const size = (s) => octoArmSize(form, long, s); // the arm's half-width at s (mantle lengths), as the model has it
    return { def, long, cuts, st, socket, size, out: new THREE.Vector3(Math.sin(def.angle), 0, Math.cos(def.angle)), M: new THREE.Matrix4(), inv: new THREE.Matrix4(),
      foot: new THREE.Vector3(), from: new THREE.Vector3(), to: new THREE.Vector3(), lift: 0, swing: -1, ph: def.i * 2.399, sign: 1, amt: 0.75 + 0.5 * frac(def.i * 0.618 + 0.3), set: false };
  });
  // the web, the eyes and the siphon
  const web = makeWeb(mat); group.add(web.mesh); triangles += web.tris;
  const eyeGeo = octoEye(pal), eyes = [1, -1].map((s) => { const e = piece(eyeGeo, group); const E = OCTO.eye; e.position.set(s * E.at[0], E.at[1], E.at[2]); return { e, s, rest: new THREE.Vector3(s * E.look[0], E.look[1], E.look[2]).normalize(), look: new THREE.Vector3(s * E.look[0], E.look[1], E.look[2]).normalize() }; });
  a.owned.pop(); a.owned.push(eyeGeo); // (one geometry for both eyes)
  const siphon = piece(octoSiphon(pal), group); siphon.position.set(...OCTO.siphon.at); const siphonAim = new THREE.Vector3(...OCTO.siphon.look).normalize();
  // what it handles: in the parent's space, not the body's, so that it lies where it is left
  const propMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide }); a.owned.push(propMat);
  const things = { stone: new THREE.Mesh(octoThing(pal, 'stone'), propMat), shell: new THREE.Mesh(octoThing(pal, 'shell'), propMat) }, den = new THREE.Mesh(octoDen(pal), propMat);
  for (const o of [things.stone, things.shell, den]) { o.castShadow = true; o.visible = false; wrap.add(o); a.owned.push(o.geometry); }
  const thing = { kind: 'stone', state: 'none', pos: new THREE.Vector3(), vel: new THREE.Vector3(), spin: 0, by: null };

  const p = { t: 0, mood: 'den', k: 0, size: form.ml, yawWas: null, was: new THREE.Vector3(), high: 0, pitch: 0, roll: 0, jet: 0, pulse: 0, tone: 0.5, mottle: 1, points: 0.5, blanch: 0, clouds: 0, siphon: siphonAim.clone(), throwK: -1, flung: false, open: 0, gather: 0, fresh: true };
  const watch = new THREE.Vector3(), invW = new THREE.Matrix4(), moving = new THREE.Vector3(), water = new THREE.Vector3(), opts = { scale: 1, moving, water: null, quick: 1 };
  const V = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3(), R = new THREE.Vector3(), LEAD = new THREE.Vector3(), VLEAD = new THREE.Vector3(), HM = new THREE.Vector3(), FOOT = new THREE.Vector3(), STILL = new THREE.Vector3(), LEFT = new THREE.Vector3(), Q = new THREE.Quaternion(), MB = new THREE.Matrix4(), BASIS = new THREE.Matrix4();
  let ground = () => 0;
  const bedAt = (x, z) => ground(x, z);

  // ---- the shapes the arms would hold, worked out in the parent's space and handed to each strand in its socket's space
  // An arch from the root R down to F, `len` long, in the upright plane through both, bowed upward; then the rest of the arm along the bed from F,
  // curling round by `curl`, its tip lifting by `lift` and feeling about. out: n + 1 points.
  const pts = Array.from({ length: OCTO.joints + 1 }, () => new THREE.Vector3());
  function arched(arm, F, len, curl, lift, wob) {
    const sz = p.size, cuts = arm.cuts, n = cuts.length - 1, L = arm.long * sz; R.set(0, 0, 0).applyMatrix4(arm.M);
    V.subVectors(F, R); const h = -V.y; V.y = 0; let d = V.length(); if (d < 1e-4) { V.copy(arm.out).applyAxisAngle(UP, group.rotation.y); V.y = 0; d = 0; } V.normalize(); // V: the way out, on the level
    len = clamp(len, Math.hypot(d, h) * 1.0005 + 1e-5, L * 0.92);
    const c = Math.hypot(d, h), ratio = c / len; let th = 0;
    if (ratio < 0.9995) { let lo = 1e-4, hi = TAU - 1e-3; for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2, f = Math.sin(mid / 2) / (mid / 2); if (f > ratio) lo = mid; else hi = mid; } th = (lo + hi) / 2; }
    const al = Math.atan2(-h, d), ph0 = al + th / 2, rho = th > 1e-4 ? len / th : 0;
    let psi = Math.atan2(V.x, V.z), x = F.x, z = F.z, yUp = 0, lam = 0, sPrev = len; const rest = Math.max(1e-4, L - len);
    for (let i = 0; i <= n; i++) {
      const s = cuts[i] * sz, P = pts[i];
      if (s <= len) { if (rho) { const ph = ph0 - s / rho; P.copy(R).addScaledVector(V, rho * (Math.sin(ph0) - Math.sin(ph))); P.y += rho * (Math.cos(ph) - Math.cos(ph0)); } else P.copy(R).addScaledVector(V, s * Math.cos(al)).setY(R.y + s * Math.sin(al)); continue; }
      // on along the bed: a few small steps to this joint
      const steps = 3, ds = (s - sPrev) / steps;
      for (let k = 0; k < steps; k++) { const q = (sPrev + ds * (k + 0.5) - len) / rest; psi += (curl * 3 * q * q / rest) * ds * arm.sign + wob * Math.sin(p.t * 1.3 + arm.ph + q * 4) * q * q * ds * 0.8 / sz;
        lam = lift * clamp((q - 0.55) / 0.45, 0, 1) ** 1.5; x += Math.sin(psi) * Math.cos(lam) * ds; z += Math.cos(psi) * Math.cos(lam) * ds; yUp += Math.sin(lam) * ds; }
      sPrev = s; const r = arm.size(cuts[i]) * sz * 0.86, raise = Math.max(0, F.y - bedAt(F.x, F.z) - arm.size(len / sz) * sz * 0.86) * Math.max(0, 1 - ((s - len) / rest) * 1.6); // (an arm in the air: the rest of it hangs from where it is)
      P.set(x, bedAt(x, z) + r + raise + yUp, z);
    }
    return pts;
  }
  // the tip of an arm wound round a thing, round its girth (so it never goes under it into the bed): from where the arm comes to it, round and round,
  // each turn outside the last; the left arm a little above the middle and the right a little below, so two can hold it together
  function coil(arm, from, centre, rad, k) {
    const sz = p.size, cuts = arm.cuts, n = cuts.length - 1; let first = -1;
    for (let i = 0; i <= n; i++) if (cuts[i] * sz >= from && first < 0) first = i;
    if (first < 1) return;
    const r0 = rad + arm.size(from / sz) * sz * 1.1, prev = pts[first - 1], a0 = Math.atan2(prev.x - centre.x, prev.z - centre.z), side = arm.def.side;
    for (let i = first; i <= n; i++) { const s = cuts[i] * sz - from, r = r0 + (s / (TAU * r0)) * arm.size(from / sz) * sz * 2.4, turn = s / r, phi = a0 + side * turn;
      V3.set(centre.x + Math.sin(phi) * r, centre.y + side * (0.2 * rad + arm.size(from / sz) * sz * 1.05) + 0.05 * rad * Math.sin(turn * 2), centre.z + Math.cos(phi) * r);
      pts[i].lerp(V3, clamp(k, 0, 1)); }
  }
  // the arms gathered and trailing, for the jet: in the body's own space, out a little from the crown and then all along the way behind the mantle
  const TRAIL = new THREE.Vector3().copy(OCTO.mantle).negate();
  function trailing(arm, open, wave) {
    const sz = p.size, cuts = arm.cuts, n = cuts.length - 1; R.set(0, 0, 0).applyMatrix4(arm.socket.matrix);
    V2.copy(arm.out).addScaledVector(TRAIL, -arm.out.dot(TRAIL)).normalize(); V3.crossVectors(TRAIL, V2);
    for (let i = 0; i <= n; i++) { const s = cuts[i], q = s / arm.long, P = pts[i];
      const rad = ((0.44 + open * s * 0.3) * (1 - 0.5 * q) + 0.05) * form.thick / 0.19; // each in its own place round the bundle, in the order they hang, so none crosses another
      P.set(0, -0.02, 0).addScaledVector(TRAIL, s * 0.97).addScaledVector(V2, rad).sub(R).multiplyScalar(ease(Math.min(1, q * 5 + 0.15))).add(R);
      P.addScaledVector(V3, wave * q * q * Math.sin(TAU * 0.6 * q - p.t * 5 + arm.ph) * 0.07).addScaledVector(V2, wave * q * q * Math.sin(TAU * 0.45 * q - p.t * 3.7 + arm.ph * 1.7) * 0.12); // (rippling, mostly in and out from the bundle)
      P.applyMatrix4(group.matrix); }
  }

  // where each arm comes down around the body, in the parent's space: out from the crown along its socket, at `reach`, on the bed
  const home = (arm, reach, lead, out) => { out.copy(arm.out).multiplyScalar(reach * p.size); out.applyAxisAngle(UP, group.rotation.y).add(group.position).addScaledVector(lead, 1); out.y = bedAt(out.x, out.z); return out; };

  // s: where it is and what it is doing, in the space of whatever it is put in.
  //   x, z: where it is on the bed (y: where its crown is, for the jet; left out, it is carried over the bed as its mood says); yaw: the way its face points
  //   mood: one of MOODS; k: how far through a mood that has a beginning and an end (reach, throw), 0 to 1, the owner's
  //   ground(x, z): the bed's height; watch: a point in the world its eyes follow (or null); skin: one of OCTO_SKINS, or nothing for the mood's own
  //   treadmill: it stays where it is and the bed and water go by, as if it were moving at vx, vz (the library)
  function update(dt, s) {
    if (wrap.scale.x !== 1) { p.size = form.ml * wrap.scale.x; wrap.scale.set(1, 1, 1); } // a size tried in the library: taken into its own measures, so that where it is is where it is
    p.t += dt; ground = s.ground || (() => 0);
    const sz = p.size, mood = MOODS[s.mood] ? s.mood : 'den', D = MOODS[mood], k = s.k ?? 0, was = p.mood; p.mood = mood; p.k = k;
    if (was !== mood && (mood === 'throw' || mood === 'reach')) { p.flung = false; }
    group.scale.setScalar(sz);
    // the skin it wears: the mood's own, or the one asked for; the throw darkens on its own as it gathers
    const want = { ...MOODS[mood].skin, blanch: 0, clouds: 0, ...(s.skin && OCTO_SKINS[s.skin] ? OCTO_SKINS[s.skin] : {}) };
    if (mood === 'throw' && !s.skin) { const dark = ease((k - 0.08) / 0.2) * (1 - ease((k - 0.62) / 0.25)); want.tone = lerp(want.tone, 1, dark); want.mottle = lerp(want.mottle, 0.04, dark); want.points = lerp(want.points, 0, dark); }
    for (const key of ['tone', 'mottle', 'points', 'blanch', 'clouds']) p[key] = damp(p[key], want[key] ?? 0, key === 'blanch' ? 12 : 4.5, dt);
    // the mantle: a slow breath; jetting, a quick squeeze and a slow filling; throwing, filled and then emptied in one
    let pulse = 0.07 * Math.sin(p.t * 2.4);
    if (mood === 'jet') { if (was !== 'jet') p.jet = 0; p.jet = (p.jet + dt * (s.rate || 0.85)) % 1; const q = p.jet; pulse = q < 0.22 ? lerp(0.16, -0.22, ease(q / 0.22)) : lerp(-0.22, 0.16, ease((q - 0.22) / 0.78)); }
    if (mood === 'throw') pulse = k < 0.3 ? 0.07 * Math.sin(p.t * 2.4) : k < 0.5 ? lerp(0.05, 0.2, ease((k - 0.3) / 0.18)) : k < 0.56 ? lerp(0.2, -0.24, ease((k - 0.5) / 0.05)) : lerp(-0.24, 0.05 * Math.sin(p.t * 2.4), ease((k - 0.56) / 0.3));
    p.pulse = damp(p.pulse, pulse, 16, dt);
    u.uPulse.value = p.pulse; u.uPoints.value = p.points; u.uTone.value = p.tone; u.uMottle.value = p.mottle; u.uBlanch.value = p.blanch; u.uClouds.value = p.clouds; u.uClock.value = p.t;

    // ---- the body: on the bed, as high as its mood carries it, tipped to the bed under it; jetting, where it is told, mantle first
    const first = p.yawWas === null;
    const lead = LEAD.set(0, 0, 0);
    if (s.treadmill) lead.set(s.vx || 0, 0, s.vz || 0); else if (!first && dt > 1e-5) lead.set(s.x - p.was.x, 0, s.z - p.was.z).multiplyScalar(1 / dt);
    if (lead.length() > 30) lead.set(0, 0, 0);
    moving.copy(lead); const speed = lead.length();
    const r = 0.9 * sz, yaw = s.yaw || 0, fx = Math.sin(yaw), fz = Math.cos(yaw);
    const front = bedAt(s.x + fx * r, s.z + fz * r), back = bedAt(s.x - fx * r, s.z - fz * r), left = bedAt(s.x + fz * r, s.z - fx * r), right = bedAt(s.x - fz * r, s.z + fx * r), mid = (front + back + left + right) / 4;
    let high = D.high; if (mood === 'throw') high += 0.12 * ease((k - 0.25) / 0.2) * (1 - ease((k - 0.6) / 0.2)); if (mood === 'crawl' || mood === 'carry') high += 0.04 * Math.sin(p.t * 5.1) * Math.min(1, speed / (0.3 * sz));
    p.high = first ? high : damp(p.high, high, 3, dt);
    const tiltP = mood === 'jet' ? D.pitch : D.pitch - Math.atan2(front - back, 2 * r) * 0.85, tiltR = mood === 'jet' ? 0 : Math.atan2(left - right, 2 * r) * 0.85;
    p.pitch = first ? tiltP : damp(p.pitch, tiltP, 3, dt); p.roll = first ? tiltR : damp(p.roll, tiltR, 3, dt);
    let jolt = 0; if (mood === 'throw' && k > 0.5) jolt = -0.18 * Math.sin(Math.PI * clamp((k - 0.5) / 0.14, 0, 1)) * sz;
    const y = s.y ?? Math.max(mid, bedAt(s.x, s.z)) + p.high * sz;
    group.position.set(s.x + fx * jolt, y, s.z + fz * jolt); group.rotation.set(p.pitch, yaw, p.roll); group.updateMatrix();
    if (wrap.parent) wrap.updateMatrixWorld(true); else group.updateMatrixWorld(true);
    if (first || p.was.distanceTo(V.set(s.x, s.y ?? p.was.y, s.z)) > 4 * sz * arms[0].long) { p.fresh = true; for (const arm of arms) arm.set = false; }
    p.yawWas = yaw; p.was.set(s.x, s.y ?? y, s.z);
    for (const arm of arms) { arm.M.multiplyMatrices(group.matrix, arm.socket.matrix); arm.inv.copy(arm.M).invert(); }

    // ---- the thing it handles
    stepThing(dt, s, k);

    // ---- the arms
    const vLead = VLEAD.copy(lead).multiplyScalar(mood === 'crawl' || mood === 'carry' ? 0.45 : 0);
    const holders = mood === 'carry' || (mood === 'throw' && k > 0.08 && k < 0.5) ? [0, 7] : mood === 'reach' ? [0] : [];
    let lifted = arms.filter((x) => x.swing >= 0).length;
    // a stepping arm: the one left furthest behind its place goes next, if neither arm beside it is off the bed (Levy et al. 2015: no rhythm)
    if (mood === 'crawl' || mood === 'carry') {
      let pick = null, most = D.step * sz;
      for (const arm of arms) { if (arm.swing >= 0 || holders.includes(arm.def.i)) continue; const hm = home(arm, D.reach, vLead, R), e = Math.hypot(arm.foot.x - hm.x, arm.foot.z - hm.z);
        const nb = [arms[(arm.def.i + 1) % 8], arms[(arm.def.i + 7) % 8]]; if (e > most && nb.every((x) => x.swing < 0) && lifted < 3) { most = e; pick = arm; } }
      if (pick) { pick.swing = 0; pick.from.copy(pick.foot); lifted++; }
    }
    for (const arm of arms) {
      const i = arm.def.i, L = arm.long * sz, hm = home(arm, D.reach * (1 + 0.08 * Math.sin(p.t * 0.31 + arm.ph) * (mood === 'den' ? 1 : 0)), vLead, HM);
      if (!arm.set || p.fresh) { arm.foot.copy(hm); arm.set = true; arm.swing = -1; }
      if (s.treadmill) arm.foot.addScaledVector(lead, -dt);
      if (arm.swing >= 0) { // stepping: up, over and down ahead of its place
        arm.swing += dt * (mood === 'carry' ? 1.6 : 2.4) * clamp(0.6 + speed / (0.5 * sz), 0.6, 2.2); if (s.treadmill) arm.from.addScaledVector(lead, -dt);
        const e = ease(arm.swing); arm.to.copy(hm).addScaledVector(lead, 0.35); arm.foot.lerpVectors(arm.from, arm.to, e); arm.foot.y = bedAt(arm.foot.x, arm.foot.z) + Math.sin(Math.PI * e) * 0.45 * sz;
        if (arm.swing >= 1) { arm.swing = -1; arm.foot.y = bedAt(arm.foot.x, arm.foot.z); }
      } else if (mood !== 'crawl' && mood !== 'carry') { arm.foot.lerp(hm, 1 - Math.exp(-2.5 * dt)); arm.foot.y = bedAt(arm.foot.x, arm.foot.z); } // settling into its place
      else arm.foot.y = bedAt(arm.foot.x, arm.foot.z);
      const rFoot = arm.size(0) * sz * 0.5;
      let len = Math.max(Math.hypot(arm.foot.x - R.set(0, 0, 0).applyMatrix4(arm.M).x, arm.foot.z - R.z), 0.2 * sz) * D.arch + (mood === 'den' ? 0.15 * sz : 0);
      if (mood === 'jet') { const open = clamp(0.05 + 0.6 * (p.jet > 0.3 ? ease((p.jet - 0.3) / 0.7) : 0), 0, 1); trailing(arm, open, 1); }
      else if (holders.includes(i) && thing.state !== 'none') shapeHolder(arm, mood, k, D);
      else { FOOT.copy(arm.foot); FOOT.y += rFoot; arched(arm, FOOT, Math.min(len, L * 0.62), D.curl * arm.amt, D.feel * (0.55 + 0.45 * Math.sin(p.t * 0.9 + arm.ph)) * (arm.swing >= 0 ? 0.3 : 1), D.feel); }
      if (mood === 'throw' && k > 0.5 && k < 0.8 && (i === 1 || i === 6 || i === 0 || i === 7)) { const f = Math.sin(Math.PI * clamp((k - 0.5) / 0.3, 0, 1)); flare(arm, f); }
      if (mood !== 'jet') for (let j = 1; j < pts.length; j++) { const P = pts[j]; P.y = Math.max(P.y, bedAt(P.x, P.z) + arm.size(arm.cuts[j]) * sz * 0.8); } // nothing of it goes into the bed
      const st = arm.st; for (let j = 0; j <= st.n; j++) st.shape[j].copy(pts[j]).applyMatrix4(arm.inv);
      opts.scale = sz; opts.water = s.treadmill && mood === 'jet' ? water.set(-(s.vx || 0), 0, -(s.vz || 0)) : null; opts.quick = D.quick * (arm.swing >= 0 ? 1.3 : 1); opts.moving = s.treadmill && mood !== 'jet' ? STILL : moving;
      if (p.fresh) st.fresh = true;
      st.trail(dt, { matrix: arm.M }, arm.inv, opts);
    }
    p.fresh = false;
    weave(); look(dt, s); aimSiphon(dt, mood, k);
  }

  // an arm flung out forward and up as the blast goes: the front arms open like a hand
  function flare(arm, f) { const n = pts.length - 1; R.set(0, 0, 0).applyMatrix4(arm.M); V.copy(arm.out).applyAxisAngle(UP, group.rotation.y); for (let j = 1; j <= n; j++) { const c = arm.cuts[j] * p.size, up = 0.3 * (j / n); pts[j].lerp(V2.copy(R).addScaledVector(V, c * Math.cos(up)).setY(R.y + c * Math.sin(up)), f * 0.85); } } // (a straight line as long as the arm, lifting toward the tip: the strand keeps its lengths, so nothing folds)
  // an arm that holds the thing: out to it (on the bed, or under the web) and wound round it
  function shapeHolder(arm, mood, k, D) {
    const sz = p.size, L = arm.long * sz, rad = thing.r; R.set(0, 0, 0).applyMatrix4(arm.M);
    const C = thing.pos, toward = V.copy(C).sub(R); toward.y = 0; const d = toward.length();
    const near = V3.copy(C).addScaledVector(toward.normalize(), -(rad + arm.size(0.5) * sz)); near.addScaledVector(LEFT.set(Math.cos(group.rotation.y), 0, -Math.sin(group.rotation.y)), arm.def.side * rad * 0.7); near.y = Math.max(C.y, bedAt(near.x, near.z) + arm.size(1) * sz); // (each comes to it on its own side)
    let grip = 1, len = Math.max(d * 1.08, 0.3 * sz);
    if (mood === 'reach') { const out = ease(k / 0.42); grip = ease((k - 0.38) / 0.14); len = lerp(0.5 * sz, Math.max(d * 1.08, 0.4 * sz), out); if (k < 0.42) { near.lerpVectors(arm.foot, near, out); near.y += Math.sin(Math.PI * out) * 0.5 * sz; } }
    if (mood === 'throw') grip = ease((k - 0.08) / 0.08);
    arched(arm, near, Math.min(len, L * 0.6), 0.6, 0.8 * (1 - grip), 0.3);
    coil(arm, Math.min(len, L * 0.6), C, rad, grip * 1.0);
  }

  // ---- the thing: lying on the bed, held, or flying
  function stepThing(dt, s, k) {
    const sz = p.size, rad = thing.r = form.thing * sz * (thing.kind === 'shell' ? 1.15 : 1), mesh = things[thing.kind];
    things.stone.visible = thing.kind === 'stone' && thing.state !== 'none'; things.shell.visible = thing.kind === 'shell' && thing.state !== 'none';
    if (thing.state === 'none') return;
    const under = (out) => out.set(0, -(p.high * sz - rad * 1.05) / sz, p.mood === 'carry' ? 0.3 : 0.3 + (rad / sz) * 0.9).applyMatrix4(group.matrix); // under the web, between the arms (in front of the mouth when it sits low)
    if (s.treadmill && thing.state === 'bed') thing.pos.addScaledVector(V.set(s.vx || 0, 0, s.vz || 0), -dt);
    if (p.mood === 'reach' && thing.state === 'bed' && k > 0.52) thing.state = 'drawn';
    if (p.mood === 'throw' && thing.state === 'bed' && k > 0.1 && !p.flung) thing.state = 'drawn'; // (and once thrown, it is left where it lands)
    if (thing.state === 'drawn') { const e = p.mood === 'reach' ? ease((k - 0.52) / 0.4) : p.mood === 'throw' ? ease((k - 0.1) / 0.16) : 1; under(V2); if (!thing.from) thing.from = thing.pos.clone(); thing.pos.lerpVectors(thing.from, V2, e); if (e >= 1) { thing.state = 'held'; thing.from = null; } }
    else if (thing.state === 'held') { under(thing.pos); if (p.mood !== 'carry' && p.mood !== 'throw' && p.mood !== 'reach') { thing.state = 'bed'; } }
    if (p.mood === 'throw' && k >= 0.5 && !p.flung && (thing.state === 'held' || thing.state === 'drawn')) { // the blast: out from under the web, the way it faces, and up a little
      p.flung = true; thing.state = 'flying'; thing.from = null; thing.vel.set(Math.sin(group.rotation.y), 0.32, Math.cos(group.rotation.y)).multiplyScalar(9 * sz); thing.spin = 7; }
    if (thing.state === 'flying') { thing.vel.multiplyScalar(Math.exp(-1.6 * dt)); thing.vel.y -= 2.2 * sz * dt; thing.pos.addScaledVector(thing.vel, dt); if (s.treadmill) thing.pos.addScaledVector(V.set(s.vx || 0, 0, s.vz || 0), -dt);
      const floor = bedAt(thing.pos.x, thing.pos.z) + rad * 0.7; mesh.rotation.x += thing.spin * dt; if (thing.pos.y <= floor && thing.vel.y < 0) { thing.pos.y = floor; thing.state = 'bed'; mesh.rotation.x = 0; } }
    if (thing.state === 'bed') thing.pos.y = bedAt(thing.pos.x, thing.pos.z) + rad * 0.7;
    mesh.position.copy(thing.pos); mesh.scale.setScalar(rad);
    if (thing.state === 'held' || thing.state === 'drawn') mesh.rotation.set(0, group.rotation.y + 0.6, 0);
  }

  // ---- the web: for each gap, from the mouth out along both arms
  const C0 = new THREE.Vector3(0, -0.03, 0), A = Array.from({ length: LEVELS + 1 }, () => new THREE.Vector3()), B = A.map(() => new THREE.Vector3()), Mid = A.map(() => new THREE.Vector3());
  const along = (arm, f, out) => { const st = arm.st, sArc = f * arm.long; let j = 0; while (j < st.n - 1 && arm.cuts[j + 1] < sArc) j++; const t = clamp((sArc - arm.cuts[j]) / (arm.cuts[j + 1] - arm.cuts[j]), 0, 1); return out.lerpVectors(st.local[j], st.local[j + 1], t).applyMatrix4(arm.socket.matrix); };
  function weave() {
    const P = web.pos, depth = p.mood === 'jet' ? 0.1 : 0.2; let o = 0;
    const put = (v) => { P[o++] = v.x; P[o++] = v.y; P[o++] = v.z; }, tri = (a, b, c) => { put(a); put(b); put(c); };
    for (let g = 0; g < 8; g++) { const a0 = arms[g], b0 = arms[(g + 1) % 8];
      for (let j = 0; j <= LEVELS; j++) { const f = depth * j / LEVELS; along(a0, f, A[j]); along(b0, f, B[j]); Mid[j].lerpVectors(A[j], B[j], 0.5).lerp(C0, j === LEVELS ? 0.42 : 0.12 * j); }
      tri(C0, A[0], B[0]);
      for (let j = 0; j < LEVELS; j++) { tri(A[j], A[j + 1], Mid[j + 1]); tri(A[j], Mid[j + 1], Mid[j]); tri(Mid[j], Mid[j + 1], B[j + 1]); tri(Mid[j], B[j + 1], B[j]); } }
    web.geo.attributes.position.needsUpdate = true;
  }

  // ---- the eyes: each turns toward what it watches, as far as its bump lets it, and is rolled so that the bar of its pupil lies level in the world
  const lookAt = new THREE.Vector3();
  function look(dt, s) {
    invW.copy(group.matrixWorld).invert(); const upB = V3.set(0, 1, 0).transformDirection(invW);
    for (const E of eyes) {
      if (s.watch) lookAt.copy(s.watch).applyMatrix4(invW).sub(E.e.position).normalize(); else lookAt.copy(E.rest).applyAxisAngle(UP, 0.25 * Math.sin(p.t * 0.37 + E.s));
      const ang = E.rest.angleTo(lookAt); if (ang > 0.75) { V.crossVectors(E.rest, lookAt).normalize(); lookAt.copy(E.rest).applyAxisAngle(V, 0.75); }
      E.look.lerp(lookAt, 1 - Math.exp(-5 * dt)).normalize();
      V.crossVectors(upB, E.look); if (V.lengthSq() < 1e-6) V.set(1, 0, 0); V.normalize(); V2.crossVectors(E.look, V); // x along the bar (level), y up the eye, z out of it
      BASIS.makeBasis(V, V2, E.look); E.e.quaternion.setFromRotationMatrix(BASIS);
    }
  }
  // ---- the siphon: out to the side as it breathes; jetting, toward the arms; throwing, swung down under them
  function aimSiphon(dt, mood, k) {
    if (mood === 'jet') V.set(0.35, -0.5, 0.8); else if (mood === 'throw' && k > 0.22 && k < 0.7) V.set(0.15, -0.75, 0.65); else V.copy(siphonAim);
    p.siphon.lerp(V.normalize(), 1 - Math.exp(-6 * dt)).normalize(); siphon.quaternion.setFromUnitVectors(Z, p.siphon);
    siphon.scale.setScalar(1 + Math.max(0, -p.pulse) * 1.2);
  }

  // ---- what the owner can do with the thing and the den
  const rig = {
    update, arms, eyes, web, siphon, pose: p, thing, triangles, form, watch: null,
    // put the thing on the bed at x, z (the parent's space): kind 'stone' or 'shell'
    lay(x, z, kind = thing.kind) { thing.kind = kind; thing.state = 'bed'; thing.from = null; thing.pos.set(x, bedAt(x, z), z); p.flung = false; stepThing(0, {}, 0); },
    hold(kind = thing.kind) { thing.kind = kind; thing.state = 'held'; thing.from = null; },
    drop() { thing.state = 'none'; things.stone.visible = things.shell.visible = false; },
    // the den's low wall, round the back of a spot on the bed (x, z) facing yaw; null takes it away
    den(x, z, yaw) { if (x === null || x === undefined) { den.visible = false; return; } den.visible = true; den.position.set(x, bedAt(x, z) - 0.06 * p.size, z); den.rotation.set(0, yaw, 0); den.scale.setScalar(p.size); },
    show,
  };

  // ---- on the stand in the library: each mood played over and over, the bed going by under it when it travels
  const stand = { time: 0, id: null, loop: -1 };
  function show(dt, state, speed, lift = 1, skin = '') {
    const id = state.id, sz = p.size; if (stand.id !== id) { stand.id = id; stand.time = 0; stand.loop = -1; p.yawWas = null; }
    stand.time += dt; const t = stand.time, bed = () => -lift, kinds = ['stone', 'shell']; ground = bed;
    let mood = id, k = 0, y, yaw = 0.15 * Math.sin(t * 0.21), vz = 0;
    if (id === 'den') { rig.den(0, 0, 0); rig.drop(); }
    else rig.den(null);
    if (id === 'crawl') { vz = speed; yaw = 0.12 * Math.sin(t * 0.3); rig.drop(); }
    else if (id === 'jet') { y = 0.5 - lift + 2.5 * sz; vz = -speed * (0.4 + 1.3 * (p.jet < 0.25 ? ease(p.jet / 0.25) : Math.exp(-(p.jet - 0.25) * 4))); rig.drop(); yaw = 0.1 * Math.sin(t * 0.4); }
    else if (id === 'reach' || id === 'throw') { const T = id === 'reach' ? 6 : 6.5, n = Math.floor(t / T); k = (t % T) / T; yaw = 0;
      if (n !== stand.loop) { stand.loop = n; const at = id === 'reach' ? new THREE.Vector3(Math.sin(OCTO.arms[0].angle) * 2.1, 0, Math.cos(OCTO.arms[0].angle) * 2.1) : new THREE.Vector3(0, 0, 1.25); at.multiplyScalar(sz); rig.lay(at.x, at.z, kinds[n % 2]); p.flung = false; } }
    else if (id === 'carry') { vz = speed; yaw = 0.1 * Math.sin(t * 0.3); if (thing.state !== 'held') rig.hold(kinds[Math.floor(t / 8) % 2]); }
    else if (id === 'den') rig.drop();
    const w = rig.watch; update(dt, { x: 0, y, z: 0, yaw, mood, k, ground: bed, watch: w, skin, treadmill: true, vx: Math.sin(yaw) * vz, vz: Math.cos(yaw) * vz });
  }

  a.object = wrap; a.rig = rig;
  return rig;
}
