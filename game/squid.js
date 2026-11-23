// The squid in motion. Its mantle, fins, head and eyes are one model; this hangs eight arms and two tentacles on the head, each a
// piece of its own (critters.js: SQUID, squidArm), and each trails through the water by itself (strands.js). A small shoal of them
// lives by the bloom water in the first band; what they do is in bloom.js. What follows is only how it looks in each mood.
//   hover    holding still: the fins ripple from front to back, the arms hang loose in slow curves and curl at the tips
//   swim     going somewhere on its fins: the arms trail, and swing wide and late when it turns
//   jet      the mantle fills, then squeezes, and it goes point first: fins wrapped down, arms drawn together and streaming
//   alarm    arms thrown wide and curled back, mantle swollen, fins stiff, and the skin flashing pale
//   aim      it has seen something: the arms come together to a point at it, the two tentacles drawn up inside them
//   strike   the tentacles shot out half as long again, clubs open, the arms flaring behind them
//   bluff    the first step of its defence: it makes itself big at what presses it, arms spread wide and curled out, mantle swollen, the
//            skin flushed darker (and not flashing): a show, held, while it gives ground
//   flee     the second step: it goes pale all over and jets away. (The third, ink, is not a pose: bloom.js leaves a copy of it in ink.)
// What was taken from the real animal, and where it was read:
//   The shape is the bigfin reef squid's, Sepioteuthis lessoniana: oval fins down almost the whole mantle, eight arms of which the
//   third pair is the longest and the first the shortest, two rows of suckers, clubs on the tentacles (Wikipedia, "Bigfin reef squid").
//   It jets by filling the mantle through the collar round its head and squeezing the water out through the funnel, which it can aim; at
//   low speed the fins undulate to help (the "Jetting" page of SMU's propulsion course, s2.smu.edu/propulsion).
//   Catching: it turns to the prey with arms and tentacles pointed at it, comes on with the arms in a tight cone round the tentacles, the
//   club tips just showing, then lunges, flares the arms, and the tentacle stalks lengthen by 43 to 80% in 20 to 40 ms; the fourth pair of
//   arms stays straight beside them (Kier and van Leeuwen, "A kinematic analysis of tentacle extension in the squid Loligo pealei",
//   Journal of Experimental Biology 200, 1997).
// Its defence comes in steps: a bluff, then paling and jetting away, with ink kept for real danger (The Cephalopod Page, "Sepioidea",
// thecephalopodpage.org; Jaitly 2024, ore.exeter.ac.uk; read through the research report "Oarfish first level expansion", section 5,
// mostly about the Caribbean reef squid, Sepioteuthis sepioidea, a cousin of the shape's species). The bluff's darker skin is our
// reading of "spreads its arms and darkens its mantle" below; the false eye spots of the real display are not drawn.
// Not read anywhere: that it goes pale when alarmed. George's brief asked for a pale flash; the page above only says that the real one
// darkens its mantle when it spreads its arms at another squid. Its colour is the reference picture's, not the animal's.
import * as THREE from 'three';
import { createStrand } from './strands.js';
import { SQUID, squidArm } from './critters.js';
import { clamp, lerp, damp } from './geo.js';

const TAU = Math.PI * 2, ease = (t) => t * t * (3 - 2 * t), wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a)), frac = (x) => x - Math.floor(x);
const Z = new THREE.Vector3(0, 0, 1), C = new THREE.Vector3(), D1 = new THREE.Vector3(), E = new THREE.Vector3(), F = new THREE.Vector3(), DIR = new THREE.Vector3(), P = new THREE.Vector3();

// What each mood looks like. Arms: open (how far they spread from the way the head points, radians), relax (how much of that is gone by the tip),
// wave (how far the slow curves swing), rate (how fast the curves run down them), curl (how far round the tips turn), out (1: every tip curls
// away from the mouth; 0: each its own way), four (how much of `open` the fourth pair takes). Tentacles: tOpen, tWave, tCurl, stretch, club (1: open).
// quick: the springs made harder. Fins: ripple (radians), beat (how fast it runs), fold (turned down round the mantle). pulse: the mantle swollen (+) or squeezed.
const BASE = { open: 0.34, relax: 0.4, wave: 0.8, rate: 1.1, curl: 2.4, out: 0, four: 1, tOpen: 0.2, tWave: 0.55, tCurl: 1.5, stretch: 1, club: 0, quick: 1, ripple: 0.5, beat: 5, fold: 0.04, blanch: 0 };
const MOODS = {
  hover: {},
  swim: { open: 0.16, relax: 0.5, wave: 0.45, rate: 2.2, curl: 1.4, tOpen: 0.08, tWave: 0.35, tCurl: 0.8, ripple: 0.4, beat: 8.5, fold: 0.1 },
  jet: { open: 0.05, relax: 0, wave: 0.16, rate: 9, curl: 0.25, tOpen: 0.03, tWave: 0.08, tCurl: 0.15, stretch: 0.92, ripple: 0.05, beat: 10, fold: 0.95 },
  alarm: { open: 1.15, relax: 0.35, wave: 0.14, rate: 3.2, curl: 1.5, out: 1, tOpen: 0.6, tWave: 0.2, tCurl: 1.8, stretch: 0.9, club: 0.5, ripple: 0.05, beat: 16, fold: -0.16, pulse: 0.13 },
  aim: { open: 0.03, relax: 0, wave: 0.03, rate: 3, curl: 0, tOpen: 0.01, tWave: 0.01, tCurl: 0, stretch: 0.8, ripple: 0.3, beat: 10, fold: 0.05, pulse: 0.1 },
  strike: { open: 0.8, relax: 0.3, wave: 0.05, rate: 3, curl: -0.5, out: 1, four: 0.12, tOpen: 0.03, tWave: 0, tCurl: 0, stretch: 1.5, club: 1, quick: 5, ripple: 0.1, beat: 10, fold: 0.5, pulse: -0.2 },
  bluff: { open: 1.05, relax: 0.2, wave: 0.1, rate: 2, curl: 1.3, out: 1, four: 1.15, tOpen: 0.5, tWave: 0.12, tCurl: 1.6, stretch: 0.85, ripple: 0.25, beat: 9, fold: -0.12, pulse: 0.12, blanch: -0.8 },
};
MOODS.flee = { ...MOODS.jet, blanch: 0.9 }; // jetting away, pale all over
const KEYS = Object.keys(BASE), SETTLE = { strike: 22, alarm: 12, jet: 7, flee: 7, bluff: 10 };
const FEEL = { arm: { stiff: [2.6, 0.6], drag: [1.2, 3.6], ease: 0.85 }, tentacle: { stiff: [2.4, 0.5], drag: [1.2, 4.2], ease: 0.8 } };

// The squid's own material is taught three things more: the mantle swells and squeezes, the fins ripple and fold, the skin goes pale.
// The model says which corners do what (its `flex`: critters.js). The arms are drawn with the same material and have none, so only the paling reaches them.
const SOFT = `
  { // a fin turns about the line it grows from: by its fold, and by the ripple running down it
    transformed.xy += flex.xy * uPulse;
    float reach = abs(flex.z), turn = uFin.w + uFin.z * sin(uFin.x + position.z * uFin.y);
    transformed.x -= sign(flex.z) * reach * (1.0 - cos(turn));
    transformed.y -= reach * sin(turn);
  }`;
function soft(material, pale) {
  const u = { uPulse: { value: 0 }, uFin: { value: new THREE.Vector4(0, 10, 0, 0) }, uBlanch: { value: 0 }, uPale: { value: new THREE.Color(pale) } };
  const before = material.onBeforeCompile, key = material.customProgramCacheKey ? material.customProgramCacheKey() : '';
  material.onBeforeCompile = (sh, renderer) => {
    before?.(sh, renderer); Object.assign(sh.uniforms, u);
    sh.vertexShader = `attribute vec4 flex;\nuniform float uPulse;\nuniform vec4 uFin;\n${sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n${SOFT}`)}`;
    sh.fragmentShader = `uniform float uBlanch;\nuniform vec3 uPale;\n${sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n#ifdef USE_COLOR_ALPHA\n  diffuseColor.rgb = mix(diffuseColor.rgb, uPale, uBlanch * vColor.a);\n#endif')}`;
  };
  material.customProgramCacheKey = () => `${key}|soft`;
  return u;
}

// a: the creature as npc.js makes it (a.body is the mantle and head, in its material). Returns the rig; a.object becomes the whole animal.
export function squidRig(a, pal) {
  const group = new THREE.Group(), body = a.body, mat = body.material, u = soft(mat, pal.pale || '#fff1ee');
  group.name = 'squid'; group.rotation.order = 'YXZ'; group.add(body);
  let triangles = body.geometry.attributes.position.count / 3;
  // the ten of them, each with a way of its own: where its curves are in their swing, how many it holds, which way its tip curls and how far
  const arms = SQUID.arms.map((def, i) => {
    const geo = squidArm(pal, def), st = createStrand(geo, mat, def.cuts, def.club ? FEEL.tentacle : FEEL.arm); a.owned.push(geo, st); group.add(st.mesh); triangles += geo.attributes.position.count / 3;
    const out = new THREE.Vector3(def.out[0], def.out[1], 0), across = new THREE.Vector3().crossVectors(Z, out), lean = (frac(i * 0.381 + 0.2) - 0.5) * 2;
    return { def, st, out, root: new THREE.Vector3(...def.root), plane: out.clone().multiplyScalar(Math.cos(lean)).addScaledVector(across, Math.sin(lean)), ph: i * 2.399, waves: 0.9 + 0.45 * frac(i * 0.618), sign: i % 3 === 1 ? -1 : 1, amt: 0.65 + 0.6 * frac(i * 0.77 + 0.1), wide: 0.55 + 0.9 * frac(i * 0.53 + 0.3), bow: (frac(i * 0.29 + 0.6) - 0.5) * 1.1 };
  });
  const p = { ...BASE, t: 0, pulse: 0, thrust: 0, jet: 0, roll: 0, turn: 0, swing: 0, fin: 0, yawWas: null, was: new THREE.Vector3(), mood: 'hover' }, G = {};
  const inv = new THREE.Matrix4(), moving = new THREE.Vector3(), water = new THREE.Vector3(), opts = { scale: 1, moving, water: null, quick: 1, stretch: 1, up: null };

  // the shape an arm would hold in still water, as a line of points in the body's space: out from the head, the curves running down it, the curl at its tip
  function shape(arm) {
    const { def, st } = arm, club = def.club, open = (club ? p.tOpen : p.open) * (def.pair === 4 ? p.four : 1) * lerp(arm.wide, 1, p.out), wave = club ? p.tWave : p.wave, loose = wave / BASE.wave;
    const curl = (club ? p.tCurl : p.curl) * lerp(arm.sign, 1, p.out) * arm.amt, stretch = club ? p.stretch : 1;
    C.copy(arm.plane).lerp(arm.out, p.out).normalize(); // the plane its curves and its curl lie in
    P.copy(arm.root); st.shape[0].copy(P);
    for (let i = 0; i < st.n; i++) {
      const s = (def.cuts[i] + def.cuts[i + 1]) / (2 * def.long), tip = clamp((s - 0.5) / 0.5, 0, 1), spread = open * (1 - p.relax * s);
      const bend = wave * (s ** 0.75 * Math.sin(TAU * arm.waves * s - p.swing + arm.ph) + arm.bow * (s - 0.25)) + curl * tip * tip, aside = 0.6 * wave * s * Math.sin(TAU * arm.waves * 0.7 * s - p.swing * 0.8 + arm.ph * 1.9);
      D1.copy(Z).multiplyScalar(Math.cos(spread)).addScaledVector(arm.out, Math.sin(spread));
      E.copy(C).addScaledVector(D1, -C.dot(D1)).normalize(); F.crossVectors(D1, E);
      DIR.copy(D1).multiplyScalar(Math.cos(bend) * Math.cos(aside)).addScaledVector(E, Math.sin(bend) * Math.cos(aside)).addScaledVector(F, Math.sin(aside));
      DIR.x += 0.13 * loose * s * Math.sin(p.t * 0.37); DIR.y += 0.11 * loose * s * Math.sin(p.t * 0.29 + 1); DIR.normalize(); // and all of them lean a little together, one way and then another
      P.addScaledVector(DIR, (def.cuts[i + 1] - def.cuts[i]) * stretch); st.shape[i + 1].copy(P);
    }
  }

  // s: where it is and what it is doing, in the space of whatever it is put in.
  //   x, y, z; yaw: the way its head and arms point (jetting, it goes the other way); pitch: head down
  //   mood: one of the above. It decides nothing: the arms are moved by how the body has really moved since the last frame.
  //   treadmill: the body stays where it is and the water goes by, as if it were moving at vx, vy, vz (the library)
  //   rate: jets a second
  function update(dt, s) {
    p.t += dt;
    const sc = group.scale.x, mood = MOODS[s.mood] ? s.mood : 'hover', L = MOODS[mood];
    for (const k of KEYS) G[k] = L[k] ?? BASE[k];
    let pulse = L.pulse ?? 0.045 * Math.sin(p.t * 2.3), thrust = 0; // holding still, it breathes
    if (mood === 'jet' || mood === 'flee') { // one jet: a quick squeeze, a hold, and a slow filling while it glides. The fins wrap down on the squeeze and the arms come together; gliding, both ease
      if (p.mood !== 'jet' && p.mood !== 'flee') p.jet = 0;
      p.jet = (p.jet + dt * (s.rate || 1.05)) % 1; const q = p.jet, glide = q < 0.2 ? 0 : (q - 0.2) / 0.8;
      if (q < 0.2) { pulse = lerp(0.18, -0.26, ease(q / 0.2)); thrust = Math.sin((Math.PI * q) / 0.2); } else if (q < 0.38) pulse = -0.26; else pulse = lerp(-0.26, 0.18, ease((q - 0.38) / 0.62));
      G.open += 0.16 * glide; G.wave += 0.4 * glide; G.tWave += 0.3 * glide; G.fold = lerp(1.0, 0.35, glide); G.ripple = 0.22 * glide;
    }
    if (mood === 'alarm') G.blanch = clamp(0.5 + 1.2 * Math.sin(p.t * 9), 0.08, 0.95); // pale, and back, four or five times a second
    const settle = SETTLE[mood] || 4;
    for (const k of KEYS) p[k] = damp(p[k], G[k], k === 'blanch' ? 30 : k === 'stretch' || k === 'club' ? (mood === 'strike' ? 40 : 5) : settle, dt);
    p.pulse = damp(p.pulse, pulse, 18, dt); p.thrust = thrust; p.mood = mood;
    p.swing += dt * p.rate; p.fin += dt * p.beat;
    // the body: where it is told to be, leaning into a turn
    const first = p.yawWas === null, turn = first || dt <= 1e-5 ? 0 : clamp(wrapPi(s.yaw - p.yawWas) / dt, -4, 4);
    moving.set(s.x - p.was.x, s.y - p.was.y, s.z - p.was.z); if (first || dt <= 1e-5 || moving.length() > 4 * sc) moving.set(0, 0, 0); else moving.multiplyScalar(1 / dt);
    p.yawWas = s.yaw; p.was.set(s.x, s.y, s.z); p.turn = damp(p.turn, turn, 4, dt); p.roll = damp(p.roll, clamp(-p.turn * 0.2, -0.4, 0.4), 5, dt);
    group.position.set(s.x, s.y, s.z); group.rotation.set(s.pitch || 0, s.yaw, p.roll + (s.roll || 0)); group.updateMatrix(); inv.copy(group.matrix).invert();
    u.uPulse.value = p.pulse; u.uFin.value.set(p.fin, 10, p.ripple, p.fold); u.uBlanch.value = p.blanch;
    // the arms: each is given the shape it would hold, and goes after it through the water
    opts.scale = sc; opts.water = s.treadmill ? water.set(-(s.vx || 0), -(s.vy || 0), -(s.vz || 0)) : null; opts.quick = p.quick;
    for (const arm of arms) { shape(arm); opts.stretch = arm.def.club ? p.stretch : 1; opts.up = arm.out; arm.st.trail(dt, group, inv, opts);
      if (arm.def.club) { const b = arm.st.bones, w = 1 + 0.75 * p.club; b[b.length - 1].scale.x = w; b[b.length - 2].scale.x = w; } } // a club opens: it flattens out wide
  }
  // on the stand in the library: each mood, the water going by it when it travels, and the ones with a beginning and an end played over and over
  const stand = { time: 0 };
  function show(dt, state, speed) {
    stand.time += dt;
    const sc = group.scale.x, id = state.id, t = stand.time; let mood = 'hover', x = 0, y = 0, z = 0, yaw = 0, pitch = 0, v = 0;
    if (id === 'jet' || id === 'flee') { const q = p.jet; mood = id; z = -0.3 * (q < 0.2 ? ease(q / 0.2) : 1 - ease((q - 0.2) / 0.8)); v = speed * (0.3 + 1.25 * (q < 0.2 ? ease(q / 0.2) : Math.exp(-(q - 0.2) * 4.5))); pitch = -0.05; } // it darts back on each squeeze, and is let come forward again as it fills
    else if (id === 'turn') { mood = 'swim'; yaw = 0.95 * Math.sin(t * 1.15); v = speed; pitch = 0.1 + 0.06 * Math.sin(t * 0.8); }
    else if (id === 'alarm') { mood = 'alarm'; pitch = -0.14; z = -0.06 + 0.012 * Math.sin(t * 23); }
    else if (id === 'bluff') { mood = 'bluff'; pitch = -0.2 + 0.04 * Math.sin(t * 1.3); z = -0.05 * (1 + Math.sin(t * 0.7)); } // held, edging back
    else if (id === 'reach') { const q = (t % 3.2) / 3.2; pitch = 0.08; // it draws up and takes aim, shoots, holds, and gathers itself in
      if (q < 0.42) { mood = 'aim'; z = 0.1 * ease(q / 0.42); } else if (q < 0.64) { mood = 'strike'; z = 0.1 + 0.2 * ease(Math.min(1, (q - 0.42) / 0.05)); } else z = 0.3 * (1 - ease((q - 0.64) / 0.36)); }
    else { pitch = 0.4 + 0.05 * Math.sin(t * 0.5); x = 0.07 * Math.sin(t * 0.43); y = 0.08 * Math.sin(t * 0.71); z = 0.06 * Math.sin(t * 0.31); yaw = 0.14 * Math.sin(t * 0.27); } // hovering: head down a little, never quite still
    const cp = Math.cos(pitch), k = -v * sc; // it travels point first: away from the way its head points
    update(dt, { x: x * sc, y: y * sc, z: z * sc, yaw, pitch, mood, treadmill: true, vx: Math.sin(yaw) * cp * k, vy: -Math.sin(pitch) * k, vz: Math.cos(yaw) * cp * k });
  }
  a.object = group; a.rig = { update, show, arms, pose: p, triangles };
  return a.rig;
}
