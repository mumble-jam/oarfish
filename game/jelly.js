// The jellyfish in motion: one rig for four animals. The moon jelly and the sea nettle live at the bloom water in the first band (bloom.js
// says what they do there); the helmet jelly and the box jelly are made only by the specimen library and the testing tool in the pause menu. A jellyfish here is three things drawn together: what is solid in it (its component's model), the skin of its bell laid over
// that, part clear, and its strands, each oral arm and each tentacle a piece of its own that trails through the water by itself (strands.js).
// The bell squeezes and fills in its shader (`flex`, a mark the model puts on each corner: critters.js), top first and the rim last, and this
// file works out where the rim has got to, so that what hangs from the rim hangs from it wherever it is. It decides nothing: whoever moves the
// animal reads `pose.thrust` (how hard this stroke is pushing, now) and moves it; the strands answer to how it really moved.
//
// What was taken from each real animal, where it was read, and the one trait chosen for it.
//
// THE MOON JELLY, Aurelia aurita. Trait: the four violet horseshoes seen through a clear saucer.
//   A flattened saucer, colourless, 25 to 40 cm across, with eight lobes to the rim; the canals, arms and the four horseshoe gonads mauve, violet
//   or pink; a fringe of many short hollow tentacles; four oral arms a little shorter than half the bell's width, with folded lips; eight
//   branched and eight unbranched canals (MarLIN, marlin.ac.uk/species/detail/2089). Tentacles 1 to 5 cm; it pulses to keep itself level near
//   the surface (Animal Diversity Web, "Aurelia aurita"). It gets a second push for nothing while the bell refills, and goes 30% farther on each
//   stroke for it (Gemmell et al., "Passive energy recapture in jellyfish…", PNAS 2013, from its abstract). So it never quite stops between strokes.
//   Not read anywhere: which way the horseshoes open. Here the gap is toward the middle, as remembered from photographs.
// THE SEA NETTLE, the Pacific one, Chrysaora fuscescens. Trait: the long train, twenty-four dark threads round four pale ruffled arms.
//   A golden-brown bell with a reddish tint, darkest near the rim, with at most "an indistinct pale star"; about 24 long brown or maroon
//   tentacles, three between each two of eight sense organs; oral arms long, whitish, with crinkled edges, wound in a spiral when drawn up and
//   straight when let out; tentacles and arms to 2.4 m (Wikipedia, "Chrysaora fuscescens"; the Walla Walla University invertebrate key,
//   inverts.wallawalla.edu; Oregon Coast Aquarium, "Pacific sea nettle"). The radiating stripes George's brief asked for belong to another
//   nettle, C. melanaster, which has sixteen dark streaks on a pale bell: this one has only the faint star. It swims nearly all the time; it
//   gains ground only on the squeeze, and its arms and tentacles "trail distances equivalent to several bell diameters" in its wake (Ford,
//   Costello, Heidelberg and Purcell, "Swimming and feeding by the scyphomedusa Chrysaora quinquecirrha", Marine Biology 129, 1997). Fishing,
//   the tentacles hang down and spread "like a large net" (Wikipedia).
// THE HELMET JELLY, Periphylla periphylla. Trait: twelve stiff horns carried up and ahead of a dark red point.
//   The bell steeply conical with a pointed top, to 35 cm high and 25 cm across; a prominent groove round it; the jelly thick and rigid and the
//   outside colourless, the stomach deep red-brown filling the top of the dome; sixteen lappets, four sense organs, twelve thick tapering
//   tentacles, three between each two sense organs, which in life "point all in the same direction, either aborally or orally" and are more or
//   less straight (the zooplankton key at sat-zooplankton.linnaeus.naturalis.nl). Tentacles to 50 cm (Woods Hole, "Helmet jellyfish"). The
//   commonest way it holds them is straight, at about 45 degrees to its axis, and up over the top while it swims; it is slow, under 2 cm a
//   second, with short bursts and a pause after (Wikipedia, "Helmet jellyfish"). Its light is blue-green, made when it is touched, strongest at
//   the lappets and the groove, and spreads from where it was touched (Animal Diversity Web, "Periphylla periphylla"). So the light here runs
//   round the crown; the brief's "light inside" is not what the animal has (its red is said to hide the light of what it has eaten).
// THE BOX JELLY, the sea wasp, Chironex fleckeri. Trait: a square clear bell that goes somewhere, a bunch of ribbons from each corner.
//   A box of a bell, clear, 16 to 24 cm and up to 35; four fleshy stalks at the corners with up to fifteen tentacles each, to 3 m, faintly
//   blue-grey; it swims and does not drift, about one knot by day and up to four (Animal Diversity Web, "Chironex fleckeri"). Four eye-stalks,
//   one in the middle of each side (a quarter of the way up, in the small Tripedalia), six eyes on each; a shelf of skin under the rim (the
//   velarium) that makes the stroke a jet; it can turn right round in a few strokes; fishing, most kinds let the tentacles out, go up a little,
//   then turn upside down, stop beating and sink (Wikipedia, "Box jellyfish"; UC Museum of Paleontology, "Cubozoa: more on morphology"). It
//   beats one to three times a second and, unlike other jellies, keeps going forward while the bell refills (Colin et al., "Propulsion in
//   cubomedusae", PLoS ONE 2013). Not read anywhere: that it draws its tentacles short when it swims hard. That is from memory, and plausible.
import * as THREE from 'three';
import { alive } from './kit.js';
import { createBundle } from './strands.js';
import * as model from './critters.js';
import { clamp, lerp, damp } from './geo.js';

const TAU = Math.PI * 2, ease = (t) => t * t * (3 - 2 * t), wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a)), frac = (x) => x - Math.floor(x);
const ORAL = new THREE.Vector3(0, -1, 0), FWD = new THREE.Vector3(0, 0, 1), D1 = new THREE.Vector3(), E = new THREE.Vector3(), DIR = new THREE.Vector3(), P = new THREE.Vector3(), DOWN = new THREE.Vector3(), UP = new THREE.Vector3(), Q = new THREE.Quaternion();

// What each mood looks like. The stroke: rate (strokes a second), depth (how far the bell squeezes, 0 to 1), rest (how it lies between strokes: below 0 it is
// spread wider and flatter than it was modelled). For each kind of strand (a: oral arms, t: tentacles, f: fringe): Spread (how far it stands out from straight
// down, radians: 1.57 is straight out, more is up over the bell), Relax (how much of that is gone by its tip), Wave (how far its slow curves swing), Rate (how
// fast they run down it), Curl (how far round its tip turns), Hang (how much it gives to its own weight, toward its tip), Stretch (its length), Twist (how
// tightly it is wound, radians a metre). quick: the springs made harder. lit: its light. And for the animal: slack, how much its train is drawn straight by a
// stroke and falls loose after it.
const STRAND = { Spread: 0, Relax: 0, Wave: 0, Rate: 1, Curl: 0, Hang: 0, Stretch: 1, Twist: 0 };
const baseOf = (o) => { const b = { rate: 0.5, depth: 0.8, rest: 0, quick: 1, lit: 0 }; for (const L of 'atf') for (const k in STRAND) b[L + k] = STRAND[k]; return Object.assign(b, o); };
const KINDS = {
  moon: { def: model.MOON, bell: model.moonBell, piece: model.moonPiece, glow: 0.32, see: 1, slack: 0.3, turn: [0.8, 1.1, 3.4],
    stroke: { squeeze: 0.34, fill: 0.5, boost: 0.42, late: 7 }, // a slow even stroke, and the push it gets back as it fills
    feel: { a: { stiff: [3.2, 1.1], drag: [1.4, 3.6], ease: 0.8 }, f: { stiff: [5, 2.2], drag: [2.5, 6], ease: 0.8 } },
    base: baseOf({ rate: 0.55, depth: 0.75, aSpread: 0.4, aRelax: 0.5, aWave: 0.45, aRate: 0.8, aCurl: 0.6, aHang: 0.5, aTwist: 2, fSpread: 0.5, fWave: 0.3, fRate: 1.4, fHang: 0.3 }),
    moods: { drift: {}, pulse: { rate: 0.8, depth: 1, aSpread: 0.2, aWave: 0.25, aHang: 0.15, fSpread: 0.25 },
      rest: { rate: 0, rest: -0.75, aSpread: 0.75, aWave: 0.6, aRate: 0.5, aHang: 0.9, fSpread: 1.25, fWave: 0.45, fHang: 0.2 } } },
  nettle: { def: model.NETTLE, bell: model.nettleBell, piece: model.nettlePiece, glow: 0, see: 1, slack: 0.55, turn: [0.7, 1.3, 4.2], // how fast it comes round on the stand, how far, how often
    stroke: { squeeze: 0.3, fill: 0.48, boost: 0, late: 6 }, // a hard squeeze, then a long filling in which it loses way
    feel: { a: { stiff: [1.8, 0.3], drag: [1.1, 3.2], ease: 0.8 }, t: { stiff: [1.5, 0.14], drag: [0.9, 3.0], ease: 0.75 } },
    base: baseOf({ rate: 0.5, depth: 0.7, aSpread: 0.1, aRelax: 0.8, aWave: 0.3, aRate: 0.5, aCurl: 0.5, aHang: 0.7, aTwist: 3.4, tSpread: 0.22, tRelax: 0.9, tWave: 0.36, tRate: 0.5, tCurl: 0.3, tHang: 0.9, tTwist: 1.6 }),
    moods: { drift: {}, pulse: { rate: 0.72, depth: 1, aSpread: 0.05, aWave: 0.2, aRate: 1.6, aHang: 0.2, aTwist: 4.4, tSpread: 0.1, tWave: 0.3, tRate: 1.8, tCurl: 0.5, tHang: 0.25, tStretch: 0.94 },
      fish: { rate: 0.3, depth: 0.35, rest: -0.2, aSpread: 0.16, aWave: 0.22, aHang: 1.1, aTwist: 0.6, aStretch: 1.08, tSpread: 1.15, tRelax: 1.08, tWave: 0.2, tCurl: 0.1, tHang: 1.3, tStretch: 1.1, tTwist: 0.8 } } },
  helmet: { def: model.HELMET, bell: model.helmetBell, piece: model.helmetPiece, glow: 0.1, dim: 0.3, see: 1, turn: [0.8, 1.1, 3.4],
    stroke: { squeeze: 0.26, fill: 0.36, boost: 0, late: 9 }, // only the crown beats: a short stroke and a long pause
    feel: { t: { stiff: [7.5, 3.6], drag: [0.7, 1.5], ease: 0.92 } },
    base: baseOf({ rate: 0.34, depth: 0.7, tSpread: 2.36, tRelax: -0.06, tWave: 0.07, tRate: 0.7, tCurl: -0.22 }), // straight, at 45 degrees up from the crown
    moods: { drift: {}, pulse: { rate: 0.62, depth: 1, tSpread: 2.86, tRelax: 0.02, tWave: 0.03, tCurl: 0.08 }, // carried up and ahead, nearly together
      lit: { rate: 0.2, depth: 0.5, lit: 1, tSpread: 1.75, tRelax: -0.12, tWave: 0.09, tRate: 2.4, tCurl: -0.4, quick: 2 }, // touched: horns thrown out wide, and the light goes round the crown
      reach: { rate: 0.25, depth: 0.5, tSpread: 0.5, tRelax: 0.5, tWave: 0.16, tRate: 1.2, tCurl: 0.75 } } }, // all of them turned down to the mouth
  box: { def: model.BOX, bell: model.boxBell, piece: model.boxPiece, glow: 0, see: 1, slack: 0.35, turn: [3.4, 1.9, 2.3],
    stroke: { squeeze: 0.36, fill: 0.56, boost: 0.25, late: 14 }, // quick and regular, no pause: it keeps its way
    feel: { t: { stiff: [3.2, 0.3], drag: [1.1, 3.4], ease: 0.8 } },
    base: baseOf({ rate: 0.8, depth: 0.6, tSpread: 0.16, tRelax: 0.7, tWave: 0.3, tRate: 0.8, tCurl: 0.3, tHang: 0.9, tStretch: 0.85, tTwist: 1.1 }),
    moods: { drift: {}, pulse: { rate: 1.7, depth: 1, tSpread: 0.06, tWave: 0.1, tRate: 2, tCurl: 0.1, tHang: 0.15, tStretch: 0.5 }, // going somewhere: the tentacles drawn up short, streaming
      fish: { rate: 0, rest: -0.12, tSpread: 0.42, tRelax: 0.55, tWave: 0.22, tRate: 0.5, tCurl: 0.25, tHang: 0, tStretch: 1.5, tTwist: 0.8 } } }, // the bell tipped over and still, sinking; the tentacles let out long, trailing up over it
};

// The jelly's material is taught the squeeze, how clear it is, and a light that can run round it. `flex` on a corner is how far it goes when the bell
// squeezes all the way, and how late (the top goes first, the rim last); the strands have no such mark and are left as they are. On the bell's skin `veil`
// is how much of the skin is there at that corner. uLit: where the running light has got to, how bright it is, how many waves of it go round. uDim: how much
// of its colour a face that gives light shows when the light is out (a lamp that is off is dark).
function soft(material, veil) {
  const u = { uPulse: { value: new THREE.Vector2() }, uLit: { value: new THREE.Vector3(0, 0, 2) }, uSee: { value: 1 }, uDim: { value: 1 } };
  const before = material.onBeforeCompile, key = material.customProgramCacheKey ? material.customProgramCacheKey() : '';
  material.onBeforeCompile = (sh, renderer) => {
    before?.(sh, renderer); Object.assign(sh.uniforms, u);
    sh.vertexShader = `attribute vec4 flex;\nuniform vec2 uPulse;\nuniform vec3 uLit;\nvarying float vLit;\n${veil ? 'attribute float veil;\nvarying float vVeil;\n' : ''}${sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
  transformed += flex.xyz * mix(uPulse.x, uPulse.y, flex.w);
  vLit = uLit.y * pow(0.5 + 0.5 * sin(atan(position.x, position.z) * uLit.z - uLit.x), 2.0);${veil ? '\n  vVeil = veil;' : ''}`)}`;
    sh.fragmentShader = `varying float vLit;\nuniform float uDim;\n${veil ? 'uniform float uSee;\nvarying float vVeil;\n' : ''}${sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>\n#ifdef USE_COLOR_ALPHA\n  diffuseColor.rgb *= mix(uDim, 1.0, vColor.a);\n#endif${veil ? '\n  diffuseColor.a = clamp(vVeil * uSee, 0.0, 1.0);' : ''}`)
      .replace('#include <lights_lambert_fragment>', '#ifdef USE_COLOR_ALPHA\n  totalEmissiveRadiance += vColor.rgb * (1.0 - vColor.a) * vLit;\n#endif\n#include <lights_lambert_fragment>')}`;
  };
  material.customProgramCacheKey = () => `${key}|jelly${veil ? '-veil' : ''}`;
  return u;
}

// a: the creature as npc.js makes it (a.body is what is solid in it, in its material). kind: 'moon', 'nettle', 'helmet' or 'box'.
// halo: a soft glow the component may hang on it, which swells with its light (the helmet jelly's). Returns the rig; a.object becomes the whole animal.
export function jellyRig(a, pal, kind, { halo = null } = {}) {
  const K = KINDS[kind], def = K.def, group = new THREE.Group(), body = a.body, mat = body.material, u = soft(mat, false), squeeze = model.squeezeOf(def);
  group.name = `jelly-${kind}`; group.rotation.order = 'YXZ'; group.add(body); mat.userData.glow.value = K.glow; u.uDim.value = K.dim ?? 1;
  // the bell's skin: a second piece in a second material, part clear. It is drawn after everything solid and writes no depth, back faces and then front,
  // so nothing in it is sorted and nothing flickers; what is inside shows through it.
  const skinGeo = K.bell(pal), skinMat = alive(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, flatShading: true, transparent: true, depthWrite: false, emissive: mat.emissive, emissiveIntensity: mat.emissiveIntensity })), us = soft(skinMat, true);
  const skin = new THREE.Mesh(skinGeo, skinMat); skin.castShadow = true; skin.renderOrder = 2; group.add(skin); a.owned.push(skinGeo, skinMat); us.uSee.value = K.see;
  if (halo) { halo.position.set(0, def.rim * 0.4, 0); halo.visible = false; group.add(halo); }
  let triangles = (body.geometry.attributes.position.count + skinGeo.attributes.position.count) / 3;
  // the strands: each kind is drawn as one piece (there are too many threads to draw them one by one), and every strand in it goes its own way
  const strands = [], kinds = [...new Set(def.strands.map((d) => d.kind))];
  for (const L of kinds) { const defs = def.strands.filter((d) => d.kind === L), pieces = defs.map((d) => ({ geometry: K.piece(pal, d), cuts: d.cuts, feel: K.feel[L] })), bundle = createBundle(pieces, mat);
    for (const p of pieces) { triangles += p.geometry.attributes.position.count / 3; p.geometry.dispose(); }
    a.owned.push(bundle); group.add(bundle.mesh);
    defs.forEach((d, j) => { const i = strands.length, out = new THREE.Vector3(Math.sin(d.phi), 0, Math.cos(d.phi)), tan = new THREE.Vector3(Math.cos(d.phi), 0, -Math.sin(d.phi));
      strands.push({ def: d, st: bundle.strands[j], out, tan, root: new THREE.Vector3(...d.root), flex: squeeze(...d.root), ph: i * 2.399, waves: 0.7 + 0.5 * frac(i * 0.618), sign: i % 3 === 1 ? -1 : 1, amt: 0.6 + 0.7 * frac(i * 0.77 + 0.1), wide: 0.8 + 0.4 * frac(i * 0.53 + 0.3), bow: (frac(i * 0.29 + 0.6) - 0.5) * 0.9, wind: i % 2 ? 1 : -1 }); }); }
  const KEYS = Object.keys(K.base), p = { ...K.base, t: 0, q: 0, pulse: 0, late: 0, thrust: 0, surge: 0, lamp: 0, aSwing: 0, tSwing: 0, fSwing: 0, yawWas: null, was: new THREE.Vector3(), roll: 0, turn: 0, mood: 'drift' }, G = {};
  const inv = new THREE.Matrix4(), moving = new THREE.Vector3(), water = new THREE.Vector3(), opts = { scale: 1, moving, water: null, quick: 1, stretch: 1, up: UP, twist: 0 };

  // the shape a strand would hold in still water, as a line of points in the body's space: from where it hangs on the bell (which moves as the bell
  // squeezes), out and down, its slow curves running along it, its tip curled, and giving more and more to its own weight toward the tip
  function shape(s) {
    const { def: d, st } = s, L = d.kind, loose = 1 + (K.slack || 0) * (0.45 - Math.min(1, p.surge)) * 2, spread0 = p[L + 'Spread'] * (L === 't' && kind === 'helmet' ? 1 : s.wide * loose), relax = p[L + 'Relax'], wave = p[L + 'Wave'] * loose, curl = p[L + 'Curl'] * (kind === 'helmet' ? 1 : s.sign * s.amt), hang = p[L + 'Hang'], stretch = p[L + 'Stretch'], swing = p[L + 'Swing'];
    const k = lerp(p.pulse, p.late, s.flex[3]); P.set(s.root.x + s.flex[0] * k, s.root.y + s.flex[1] * k, s.root.z + s.flex[2] * k); st.shape[0].copy(P);
    for (let i = 0; i < st.n; i++) {
      const at = (d.cuts[i] + d.cuts[i + 1]) / (2 * d.long), tip = clamp((at - 0.5) / 0.5, 0, 1), spread = spread0 * (1 - relax * at);
      const bend = wave * (at ** 0.75 * Math.sin(TAU * s.waves * at - swing + s.ph) + s.bow * (at - 0.25)) + curl * tip * tip, aside = 0.7 * wave * at * Math.sin(TAU * s.waves * 0.7 * at - swing * 0.8 + s.ph * 1.9);
      D1.copy(ORAL).multiplyScalar(Math.cos(spread)).addScaledVector(s.out, Math.sin(spread)); E.copy(s.out).multiplyScalar(Math.cos(spread)).addScaledVector(ORAL, -Math.sin(spread));
      DIR.copy(D1).multiplyScalar(Math.cos(bend) * Math.cos(aside)).addScaledVector(E, Math.sin(bend) * Math.cos(aside)).addScaledVector(s.tan, Math.sin(aside));
      DIR.addScaledVector(DOWN, hang * at ** 0.7).normalize();
      P.addScaledVector(DIR, (d.cuts[i + 1] - d.cuts[i]) * stretch); st.shape[i + 1].copy(P);
    }
    // which way its face is turned where it hangs: its width lies along the rim
    D1.subVectors(st.shape[1], st.shape[0]).normalize(); UP.crossVectors(D1, s.tan); if (UP.lengthSq() < 1e-6) UP.copy(s.out); UP.normalize().applyQuaternion(Q.setFromUnitVectors(FWD, D1).invert()); UP.z = 0; UP.normalize();
    opts.stretch = stretch; opts.twist = p[L + 'Twist'] * s.wind;
  }

  // s: where it is and what it is doing, in the space of whatever it is put in.
  //   x, y, z; yaw: the way it is headed; tilt: how far the top of its bell leans that way (0: upright; 1.57: lying over, going level)
  //   mood: one of this animal's. rate: strokes a second, in place of the mood's own
  //   treadmill: the body stays where it is and the water goes by, as if it were moving at vx, vy, vz (the library)
  // It decides nothing. pose.thrust is how hard the stroke pushes at this moment (0 to 1): whoever moves it should move it by that.
  function update(dt, s) {
    p.t += dt;
    const sc = group.scale.x, mood = K.moods[s.mood] ? s.mood : 'drift', M = K.moods[mood], T = K.stroke;
    for (const k of KEYS) G[k] = M[k] ?? K.base[k];
    for (const k of KEYS) p[k] = damp(p[k], G[k], k === 'lit' ? 9 : k === 'rate' ? 6 : 3.2, dt);
    for (const L of kinds) p[L + 'Swing'] += dt * p[L + 'Rate'];
    // one stroke: the squeeze, which is what drives it; the filling; and a pause
    const rate = s.rate ?? p.rate; let pulse = p.rest, thrust = 0;
    if (rate > 0.02) { p.q = (p.q + dt * rate) % 1; const q = p.q;
      if (q < T.squeeze) { pulse = lerp(p.rest, p.depth, ease(q / T.squeeze)); thrust = Math.sin((Math.PI * q) / T.squeeze); }
      else if (q < T.squeeze + T.fill) { const f = (q - T.squeeze) / T.fill; pulse = lerp(p.depth, p.rest, ease(f)); thrust = T.boost * Math.sin(Math.PI * f) ** 2; } }
    else p.q = 0.99;
    p.pulse = damp(p.pulse, pulse, 26, dt); p.late = damp(p.late, p.pulse, T.late, dt); p.thrust = thrust * p.depth; p.mood = mood;
    p.surge += (5.5 * p.thrust - 2.4 * p.surge) * dt; // how much way the last stroke has left on it. A train is drawn out straight behind a stroke and falls slack, wider and wavier, as the way comes off
    // the body: where it is told to be, leaning into a turn
    const first = p.yawWas === null, yaw = s.yaw || 0, turn = first || dt <= 1e-5 ? 0 : clamp(wrapPi(yaw - p.yawWas) / dt, -4, 4);
    moving.set(s.x - p.was.x, s.y - p.was.y, s.z - p.was.z); if (first || dt <= 1e-5 || moving.length() > 3 * sc) moving.set(0, 0, 0); else moving.multiplyScalar(1 / dt);
    p.yawWas = yaw; p.was.set(s.x, s.y, s.z); p.turn = damp(p.turn, turn, 4, dt); p.roll = damp(p.roll, clamp(-p.turn * 0.16, -0.35, 0.35), 5, dt);
    group.position.set(s.x, s.y, s.z); group.rotation.set(s.tilt || 0, yaw, p.roll + (s.roll || 0)); group.updateMatrix(); inv.copy(group.matrix).invert();
    DOWN.set(0, -1, 0).applyQuaternion(Q.copy(group.quaternion).invert());
    // its light: a wave of it running round the crown, and a flicker
    p.lamp += dt * 5.5; const lit = p.lit * (0.75 + 0.25 * Math.sin(p.t * 17));
    for (const v of [u, us]) { v.uPulse.value.set(p.pulse, p.late); v.uLit.value.set(p.lamp, lit * 1.5, 2); }
    if (halo) { halo.visible = lit > 0.02; halo.scale.setScalar(def.wide * 3.4 * (0.6 + 0.4 * lit)); halo.material.opacity = 0.55 * lit; }
    // the strands: each is given the shape it would hold, and goes after it through the water
    opts.scale = sc; opts.water = s.treadmill ? water.set(-(s.vx || 0), -(s.vy || 0), -(s.vz || 0)) : null; opts.quick = p.quick;
    for (const st of strands) { shape(st); st.st.trail(dt, group, inv, opts); }
  }

  // On the stand in the library. A stroke is a movement, so the animal is let go a little way on each one and drawn back; when it travels the water goes
  // by it, fast on the squeeze and slower as it fills. speed: metres a second, the state's own or the slider's.
  const stand = { time: 0, off: 0, yaw: 0, to: 0, n: 0, next: 1.2 };
  function show(dt, state, speed) {
    stand.time += dt;
    const sc = group.scale.x, id = state.id, t = stand.time, lift = (state.lift ?? 0); let mood = K.moods[id] ? id : 'drift', tilt = 0, yaw = 0, x = 0, y = 0, z = 0, v = 0, sink = 0;
    const go = 0.35 + 0.95 * Math.min(1.2, p.surge); // how fast it is going just now, as a part of its best
    if (id === 'pulse' || id === 'turn') { mood = 'pulse'; tilt = 1.22 + 0.05 * Math.sin(t * 0.6); v = speed * go;
      if (id === 'turn') { const [fast, wide, often] = K.turn; if (t > stand.next) { stand.n++; stand.to += (stand.n % 2 ? 1 : -1) * wide; stand.next = t + often; } stand.yaw += clamp(stand.to - stand.yaw, -fast * dt, fast * dt); yaw = stand.yaw; } } // the box jelly right round, nearly, in a few strokes, and back; the nettle slowly, its train swinging wide
    else if (id === 'fish' && kind === 'box') { tilt = 2.8 + 0.06 * Math.sin(t * 0.5); sink = 0.22; yaw = 0.3 * Math.sin(t * 0.21); }
    else if (id === 'rest') { tilt = 0.1 * Math.sin(t * 0.37); sink = 0.035; }
    else { tilt = 0.16 * Math.sin(t * 0.33) + 0.08; yaw = 0.2 * Math.sin(t * 0.19); x = 0.03 * Math.sin(t * 0.43); z = 0.03 * Math.sin(t * 0.31); sink = id === 'fish' ? 0.02 : 0; }
    stand.off += ((v ? 0.16 : 0.1) * (go - 0.75) - 1.6 * stand.off) * dt; // it gains a little on each stroke, and is let fall back
    const st = Math.sin(tilt), ax = Math.sin(yaw) * st, ay = Math.cos(tilt), az = Math.cos(yaw) * st, d = stand.off * def.wide * 2.4;
    update(dt, { x: (x + ax * d) * sc, y: (lift + y + ay * d) * sc, z: (z + az * d) * sc, yaw, tilt, mood, treadmill: true, vx: ax * v * sc, vy: (ay * v - sink) * sc, vz: az * v * sc });
  }
  a.object = group; a.rig = { update, show, strands, pose: p, triangles, kind, skin, see: us.uSee };
  return a.rig;
}
