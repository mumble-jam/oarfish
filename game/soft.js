// The soft look: a creature drawn as light instead of triangles. On trial, on its own branch: the hunters have one so far.
//
// A soft creature has no model. Its shape is a formula (round forms melted into each other), and every pixel it
// covers works out where that shape is and what colour it shows there: dark where the form faces you, a coloured
// rim at its edges, fins that thin into the water, a light held in the chest. It wears the same palette as the
// low-poly creature, beats its tail by the same numbers, sits in the same fog and takes the light of its band.
// The darker the band, the more it leans to the deep's own colours: its palette turns toward blue and violet,
// its rim goes sea-green and its glow reaches further.
//
// A component in npc.js asks for it with `soft: { shape, … }`; npc.js's make() builds whichever look is chosen.
// What is drawn is a plain box round the creature. The shape inside is found by the fragment shader below.

import * as THREE from 'three';

// ---------------------------------------------------------------- shapes
// A shape is written in "fish units": the animal faces +x, y is up, z is its width. unit and offset fit it to the
// low-poly model it stands in for (which faces +z, in metres): metres = fish units × unit, slid along by offset.
// A shape is drawn about three units long whatever its real size, so the same softness suits them all.
// Its GLSL gives: map() (the distance to it, its parts melted together) and albedo() (the colour of the nearest
// part, with M = how far that part gives its own light, is pale like a tooth, is a fin, is a fin's tip). It also says
// where its inner light sits and how big it is (EMBER, EMBER_R) and what colour (ACCENT), and where its eye is, which
// way it looks, its colour and how strongly it blooms (EYE, EYE_OUT, EYE_COL, BLOOM: 0 for a thing with no eyes).
const BITER = /* glsl */`
#define ACCENT cFin
#define EYE_COL cEye
const vec3 EYE = vec3(.86, .15, .205), EYE_OUT = vec3(.22, .05, 1.), JAW = vec3(1.03, -.285, 0.), EMBER = vec3(.22, -.06, 0.);
const float EMBER_R = .105, BLOOM = 1.;

void parts(vec3 p, out float dB, out float dJ, out float dE, out float dT, out float dF){
  p = bend(p);
  // body: deep chest, steep forehead, narrow tail stalk
  dB = sdEll(p - vec3(.12, .02, 0.), vec3(.98, .60, .30));
  dB = smin(dB, sdEll(p - vec3(.30, -.20, 0.), vec3(.62, .50, .27)), .25);
  dB = smin(dB, sdEll(p - vec3(.76, .07, 0.), vec3(.38, .39, .25)), .22);
  dB = smin(dB, sdEll(p - vec3(-.86, .03, 0.), vec3(.44, .17, .10)), .28);

  // lower jaw, pushed past the snout for the underbite
  vec3 q = p - JAW; q.xy = rot(.40) * q.xy;
  dJ = sdEll(q, vec3(.40, .15, .215));

  // fangs standing on the jaw rim
  vec3 t = vec3(q.x, q.y, abs(q.z));
  dT = sdCone(t - vec3(.305, .060, .030), .038, .008, .150);
  dT = min(dT, sdCone(t - vec3(.245, .065, .095), .038, .008, .140));
  dT = min(dT, sdCone(t - vec3(.155, .065, .140), .036, .008, .125));

  dE = length(vec3(p.x, p.y, abs(p.z)) - EYE) - .092;

  // fins: rounded triangles with a little thickness; the tall one has a curved trailing edge
  float d2 = sdTri(p.xy, vec2(.42, .45), vec2(-.62, .30), vec2(-.42, 1.22));
  d2 = max(d2, .70 - length(p.xy - vec2(-1.15, .86))) - .05;
  dF = slab(p, d2, .016) - .018;
  d2 = min(sdTri(p.xy, vec2(-1.02, .05), vec2(-1.90, .74), vec2(-1.50, .02)),
           sdTri(p.xy, vec2(-1.02, -.05), vec2(-1.96, -.82), vec2(-1.50, -.02))) - .04;
  dF = min(dF, slab(p, d2, .014) - .016);
  d2 = sdTri(p.xy, vec2(-.06, -.46), vec2(-.82, -.20), vec2(-.68, -.90)) - .04;
  dF = min(dF, slab(p, d2, .014) - .016);
  vec3 f = vec3(p.x - .42, p.y + .30, abs(p.z) - .25);
  f.xy = rot(3.92) * f.xy; f.xz = rot(.40) * f.xz;
  dF = min(dF, sdEll(f - vec3(.24, 0., 0.), vec3(.30, .066, .022)));
}

float map(vec3 p){
  float dB, dJ, dE, dT, dF; parts(p, dB, dJ, dE, dT, dF);
  float d = smin(dB, dJ, .06);
  d = smin(d, dF, .10);
  d = smin(d, dE, .025);
  return min(d, dT);
}

// the colour of the nearest part, colours bleeding softly across the joins. M = eye, tooth, fin, fin tip
vec3 albedo(vec3 p, out vec4 M){
  float dB, dJ, dE, dT, dF; parts(p, dB, dJ, dE, dT, dF);
  float m = min(min(min(dB, dJ), min(dE, dT)), dF);
  float wB = exp(-(dB - m) * 16.), wJ = exp(-(dJ - m) * 16.), wF = exp(-(dF - m) * 12.);
  float wE = sharp(dE, m), wT = sharp(dT, m);
  float ws = wB + wJ + wF + wE + wT;
  vec3 pb = bend(p);

  float t = clamp((pb.y + .56) / 1.12, 0., 1.);
  vec3 body = mix(cBelly, cFlank, smoothstep(.05, .46, t));
  body = mix(body, cBack, smoothstep(.50, .98, t));
  float bar = smoothstep(.45, .95, .5 + .5 * sin(pb.x * 8.5 + .9));
  bar *= smoothstep(-.12, .30, pb.y) * smoothstep(.75, .35, pb.x) * smoothstep(-1.05, -.55, pb.x);
  body = mix(body, cBar * .80, bar * .75);

  vec3 jaw = mix(cJaw, mix(cJaw, cFlank, .45), smoothstep(-.42, -.18, pb.y));
  float mouth = exp(-abs(dB - dJ) * 30.) * smoothstep(.78, .98, pb.x);
  body *= 1. - .55 * mouth; jaw *= 1. - .55 * mouth;

  float tip = smoothstep(.04, .72, dB);
  vec3 fin = mix(mix(cFinDark * .72, cFlank * .8, .25), cFin, smoothstep(0., .42, tip));
  fin = mix(fin, mix(cFin, cRim, .30) * 1.05, smoothstep(.50, 1., tip));

  vec3 e = normalize(vec3(pb.x, pb.y, abs(pb.z)) - EYE);
  float pupil = smoothstep(1.12, .88, length(vec2((e.x - .16) / .26, (e.y - .02) / .62)));
  vec3 eye = mix(cEye, vec3(.05, .03, .08), pupil);
  float lid = smoothstep(.30, .48, e.y - e.x * .55);
  eye = mix(eye, cJaw * 1.25, lid);

  M = vec4(wE / ws * (1. - lid), wT / ws, wF / ws, tip);
  return (body * wB + jaw * wJ + fin * wF + eye * wE + vec3(.99, .95, .93) * wT) / ws;
}`;

// The angler: a globe, all mouth, with a rod over its head. The game hangs the lure's glow on the rod's end.
const ANGLER = /* glsl */`
#define ACCENT cLure
#define EYE_COL cEye
const vec3 EYE = vec3(.69, .50, .62), EYE_OUT = vec3(.6, .45, 1.), EMBER = vec3(.55, -.20, 0.), LURE = vec3(1.527, 1.78, 0.);
const float EMBER_R = .20, BLOOM = .7;

// a row of teeth round the front of the mouth: n of them on a half-ring, uneven, pointing down (dir -1) or up
float teeth(vec3 p, vec3 c, vec2 ab, float n, float len, float dir){
  vec2 q = (p.xz - c.xz) / ab; float st = 2.7 / n, i = clamp(floor(atan(q.y, q.x) / st + .5), -n * .5, n * .5), t = i * st;
  vec3 r = p - vec3(c.x + ab.x * cos(t), c.y, c.z + ab.y * sin(t)); r.y *= dir;
  return sdCone(r, .05, .008, len * (.6 + .55 * fract(sin(i * 12.9898 + dir) * 43758.5453)));
}
void parts(vec3 p, out float dB, out float dM, out float dE, out float dT, out float dF, out float dR, out float dL){
  p = bend(p);
  dB = sdEll(p - vec3(.10, .03, 0.), vec3(1.12, .90, 1.00));
  dB = smin(dB, sdEll(p - vec3(-.92, 0., 0.), vec3(.50, .30, .24)), .32);   // the tail stalk
  vec3 j = p - vec3(.60, -.56, 0.); j.xy = rot(.28) * j.xy;
  dB = smin(dB, sdEll(j, vec3(.80, .24, .92)), .12);                        // the lower jaw, a scoop
  dM = sdEll(p - vec3(.95, -.18, 0.), vec3(.70, .19, .84));                 // the mouth, cut out of it
  dB = smax(dB, -dM, .07);
  dT = min(teeth(p, vec3(.62, .0, 0.), vec2(.48, .54), 7., .30, -1.), teeth(p, vec3(.60, -.47, 0.), vec2(.66, .70), 6., .44, 1.));
  dE = length(vec3(p.x, p.y, abs(p.z)) - EYE) - .095;
  float d2 = min(sdTri(p.xy, vec2(-1.15, .10), vec2(-1.90, .66), vec2(-1.62, 0.)), sdTri(p.xy, vec2(-1.15, -.10), vec2(-1.90, -.66), vec2(-1.62, 0.))) - .05;
  dF = slab(p, d2, .018) - .018;                                             // the tail
  dF = min(dF, slab(p, sdTri(p.xy, vec2(-.10, .86), vec2(-.86, .50), vec2(-.92, 1.16)) - .05, .018) - .018);
  vec3 f = vec3(p.x + .10, p.y + .22, abs(p.z) - .88);                       // a fin out of each side, swept back
  f = vec3(-.58 * f.x + .81 * f.z, f.y, .81 * f.x + .58 * f.z);
  dF = min(dF, slab(f, sdTri(f.xy, vec2(-.10, .26), vec2(-.10, -.30), vec2(.92, .0)) - .06, .016) - .018);
  dR = smin(capsule(p, vec3(.76, .70, 0.), vec3(.91, 1.35, 0.), .06), smin(capsule(p, vec3(.91, 1.35, 0.), vec3(1.20, 1.73, 0.), .05), capsule(p, vec3(1.20, 1.73, 0.), LURE, .04), .05), .05);
  dL = length(p - LURE) - .15;
}
float map(vec3 p){
  float dB, dM, dE, dT, dF, dR, dL; parts(p, dB, dM, dE, dT, dF, dR, dL);
  float d = smin(smin(dB, dF, .10), dR, .08);
  return min(smin(smin(d, dE, .03), dL, .04), dT);
}
vec3 albedo(vec3 p, out vec4 M){
  float dB, dM, dE, dT, dF, dR, dL; parts(p, dB, dM, dE, dT, dF, dR, dL);
  float m = min(min(min(dB, dF), min(dE, dT)), min(dR, dL));
  float wB = exp(-(dB - m) * 16.), wF = exp(-(dF - m) * 12.), wR = exp(-(dR - m) * 16.);
  float wE = sharp(dE, m), wT = sharp(dT, m), wL = sharp(dL, m), ws = wB + wF + wR + wE + wT + wL;
  vec3 pb = bend(p);
  float t = clamp((pb.y + .9) / 1.8, 0., 1.);
  vec3 body = mix(mix(cBelly, cSkin, smoothstep(.05, .45, t)), cBack, smoothstep(.55, .98, t));
  float wart = smoothstep(.35, .8, sin(pb.x * 9. + sin(pb.y * 7.) * 1.3) * sin(pb.z * 8. + 1.) * sin(pb.y * 8.));
  body = mix(body, cWart * .8, wart * .6);
  body = mix(body, cGum, smoothstep(.10, -.02, dM));                         // the dark behind the teeth
  float tip = smoothstep(.05, .8, dB);
  vec3 e = normalize(vec3(pb.x, pb.y, abs(pb.z)) - EYE);
  vec3 eye = mix(cEye, vec3(.04, .03, .07), smoothstep(.82, .92, dot(e, normalize(EYE_OUT))));
  M = vec4((wE + wL) / ws, wT / ws, wF / ws, tip);
  return (body * wB + mix(cFins * .8, cFinTip, tip) * wF + mix(cFins, cFinTip, smoothstep(.7, 1.7, pb.y)) * wR + eye * wE + vec3(.99, .95, .93) * wT + cLure * wL) / ws;
}`;

// The spined drifter: an urchin adrift. Forty spines in rings, every other one long, each lit at its tip.
const DRIFTER = /* glsl */`
#define ACCENT cSpine
#define EYE_COL vec3(0.)
const vec3 EYE = vec3(0.), EYE_OUT = vec3(0., 0., 1.), EMBER = vec3(0.);
const float EMBER_R = .60, BLOOM = 0.;

void spine(vec3 p, vec3 dir, float L, inout float best, inout float along){
  float h = dot(p, dir), d = sdCone(vec3(length(p - dir * h), h - .92, 0.), .15, .012, L);
  if(d < best){ best = d; along = clamp((h - .92) / L, 0., 1.); }
}
// a ring of n spines at one height on the body; only the nearest needs working out
void ring(vec3 p, float lat, float n, float turn, inout float best, inout float along){
  float st = 6.28318 / n, i = floor((atan(p.z, p.x) - turn) / st + .5), a = i * st + turn;
  spine(p, vec3(cos(lat) * cos(a), sin(lat), cos(lat) * sin(a)), mod(i, 2.) < .5 ? 1.85 : .95, best, along);
}
float spines(vec3 p, out float along){
  float best = 1e9; along = 0.;
  ring(p, 1.13, 5., 0., best, along); ring(p, .52, 9., .35, best, along); ring(p, 0., 10., .1, best, along);
  ring(p, -.52, 9., .7, best, along); ring(p, -1.13, 5., .5, best, along);
  spine(p, vec3(0., 1., 0.), 1.85, best, along); spine(p, vec3(0., -1., 0.), 1.85, best, along);
  return best;
}
float map(vec3 p){ float along; return smin(sdEll(p, vec3(1.11, .98, 1.11)), spines(p, along), .14); }
vec3 albedo(vec3 p, out vec4 M){
  float along, dC = sdEll(p, vec3(1.11, .98, 1.11)), dS = spines(p, along), m = min(dC, dS);
  float wC = exp(-(dC - m) * 14.), wS = exp(-(dS - m) * 14.), ws = wC + wS;
  vec3 body = mix(cTest, cBand, smoothstep(.1, .3, sin(atan(p.x, p.z) * 5.))) * mix(.8, 1.05, smoothstep(-1., 1., p.y));
  vec3 sp = mix(mix(cTest * .8, cSpine, smoothstep(0., .55, along)), cTip, smoothstep(.5, .9, along));
  M = vec4(wS / ws * smoothstep(.6, .95, along), 0., 0., 0.);
  return (body * wC + sp * wS) / ws;
}`;

// The leech: a lamprey. An eel of a body, a ring of teeth at one end, a ribbon of fin down the back.
const LEECH = /* glsl */`
#define ACCENT cFin
#define EYE_COL cEye
const vec3 EYE = vec3(1.06, .15, .29), EYE_OUT = vec3(.2, .3, 1.), EMBER = vec3(.85, -.02, 0.);
const float EMBER_R = .07, BLOOM = .55;

void parts(vec3 p, out float dB, out float dM, out float dE, out float dT, out float dF){
  p = bend(p);
  dB = smin(sdEll(p - vec3(1.02, -.03, 0.), vec3(.52, .37, .37)), sdEll(p - vec3(.20, 0., 0.), vec3(.98, .34, .32)), .30);
  dB = smin(dB, sdEll(p - vec3(-.85, 0., 0.), vec3(.78, .20, .12)), .30);
  dB = smin(dB, length(vec2(length(p.yz - vec2(-.03, 0.)) - .27, p.x - 1.47)) - .11, .09);   // the lip of the sucker
  dM = length(p - vec3(1.66, -.03, 0.)) - .27;                                                // and the hollow in it
  dB = smax(dB, -dM, .05);
  // seven teeth round the inside of the lip, leaning in
  float st = 6.28318 / 7., a = floor(atan(p.z, p.y + .03) / st + .5) * st;
  vec3 e = vec3(0., cos(a), sin(a)), q = p - vec3(1.50, -.03, 0.) - e * .25, ax = normalize(vec3(.45, 0., 0.) - e * .9);
  float h = dot(q, ax); dT = sdCone(vec3(length(q - ax * h), h, 0.), .036, .006, .16);
  dE = length(vec3(p.x, p.y, abs(p.z)) - EYE) - .085;
  vec2 f = (p.xy - vec2(-.72, .24)) / vec2(1.0, .21);
  float d2 = min((length(f) - 1.) * .21, min((length((p.xy - vec2(-1.30, -.13)) / vec2(.36, .14)) - 1.) * .14, (length((p.xy - vec2(-1.60, .02)) / vec2(.24, .17)) - 1.) * .17));
  dF = slab(p, d2, .016) - .016;
}
float map(vec3 p){
  float dB, dM, dE, dT, dF; parts(p, dB, dM, dE, dT, dF);
  return min(smin(smin(dB, dF, .08), dE, .025), dT);
}
vec3 albedo(vec3 p, out vec4 M){
  float dB, dM, dE, dT, dF; parts(p, dB, dM, dE, dT, dF);
  float m = min(min(dB, dF), min(dE, dT));
  float wB = exp(-(dB - m) * 16.), wF = exp(-(dF - m) * 12.), wE = sharp(dE, m), wT = sharp(dT, m), ws = wB + wF + wE + wT;
  vec3 pb = bend(p);
  float t = clamp((pb.y + .36) / .72, 0., 1.);
  vec3 body = mix(mix(cBelly, cFlank, smoothstep(.05, .45, t)), cBack, smoothstep(.55, .98, t));
  float pore = smoothstep(.06, .025, length(vec2(mod(pb.x - .17, .15) - .075, pb.y - .02))) * step(.17, pb.x) * step(pb.x, .92);
  body *= 1. - .6 * pore;                                                    // the row of gill pores
  body = mix(body, vec3(.10, .05, .10), smoothstep(.08, -.02, dM));          // the dark of the mouth
  float tip = smoothstep(.02, .30, dB);
  vec3 e = normalize(vec3(pb.x, pb.y, abs(pb.z)) - EYE);
  vec3 eye = mix(cEye, vec3(.04, .03, .07), smoothstep(.78, .9, dot(e, normalize(EYE_OUT))));
  M = vec4(wE / ws, wT / ws, wF / ws, tip);
  return (body * wB + mix(cFin * .72, cFin, tip) * wF + eye * wE + vec3(.99, .95, .93) * wT) / ws;
}`;

// The hook: steel bent round, a point and its barb, and up the line a lead and the tally tag of whoever set it.
// It lies across the animal's line (in y and z), as the model does.
const HOOK = /* glsl */`
#define ACCENT cBait
#define EYE_COL vec3(0.)
const vec3 EYE = vec3(0.), EYE_OUT = vec3(0., 0., 1.), EMBER = vec3(0., .10, -.19);
const float EMBER_R = .05, BLOOM = 0.;

void parts(vec3 p, out float dH, out float dW, out float dG){
  vec2 q = vec2(p.z, p.y - .77);
  dH = length(vec2(q.y < 0. ? abs(length(q) - .77) : length(vec2(abs(q.x) - .77, q.y)), p.x)) - .15;   // the bend
  dH = smin(dH, capsule(p, vec3(0., .77, .77), vec3(0., 2.80, .77), .14), .05);                            // the shank
  dH = smin(dH, sdCone(vec3(p.x, q.y, p.z + .77 - q.y * .15), .15, .012, .78), .04);                       // the point
  dH = smin(dH, capsule(p, vec3(0., 1.10, -.70), vec3(0., .82, -.38), .05), .04);                          // its barb
  dH = smin(dH, length(vec2(length(vec2(p.x, p.y - 2.98)) - .20, p.z - .77)) - .075, .04);                 // the eye the line is tied to
  dW = sdEll(p - vec3(0., 5.62, .77), vec3(.24, .62, .24));
  float d2 = min(sdBox2(vec2(p.z - 1.36, p.y - 7.52 + (p.z - .77) * .17), vec2(.58, .28)), sdTri(p.zy, vec2(1.92, 7.72), vec2(2.40, 7.44), vec2(1.92, 7.16))) - .04;
  dG = slab(vec3(0., 0., p.x), d2, .02) - .02;
}
float map(vec3 p){ float dH, dW, dG; parts(p, dH, dW, dG); return min(min(dH, dW), dG); }
vec3 albedo(vec3 p, out vec4 M){
  float dH, dW, dG; parts(p, dH, dW, dG);
  float m = min(min(dH, dW), dG), wH = exp(-(dH - m) * 30.), wW = exp(-(dW - m) * 30.), wG = exp(-(dG - m) * 30.), ws = wH + wW + wG;
  M = vec4(0., 0., wG / ws, .5);
  return (mix(cShade, cSteel, smoothstep(.1, 2.2, p.y)) * wH + mix(cLead * .72, cLead, smoothstep(5.1, 6.1, p.y)) * wW + cTag * wG) / ws;
}`;

// palette: which of the component's colours each of the shader's takes
export const SHAPES = {
  biter: { glsl: BITER, unit: 0.33, offset: 0.021, box: [[-2.3, -1.3, -0.85], [1.7, 1.6, 0.85]],
    palette: { cBack: 'back', cFlank: 'flank', cBar: 'bar', cBelly: 'belly', cFin: 'fins', cFinDark: 'finDark', cJaw: 'jaw', cEye: 'eye' } },
  angler: { glsl: ANGLER, unit: 0.55, offset: 0, box: [[-2.3, -1.4, -2.0], [2.05, 2.3, 2.0]],
    palette: { cBack: 'back', cSkin: 'skin', cWart: 'wart', cBelly: 'belly', cGum: 'gum', cFins: 'fins', cFinTip: 'finTip', cEye: 'eye', cLure: 'lure' } },
  drifter: { glsl: DRIFTER, unit: 0.27, offset: 0, box: [[-3.2, -3.2, -3.2], [3.2, 3.2, 3.2]], palette: { cTest: 'test', cBand: 'band', cSpine: 'spine', cTip: 'tip' } },
  leech: { glsl: LEECH, unit: 0.33, offset: 0, box: [[-2.3, -0.8, -0.8], [1.95, 0.95, 0.8]], palette: { cBack: 'back', cFlank: 'flank', cBelly: 'belly', cFin: 'fin', cEye: 'eye' } },
  hook: { glsl: HOOK, unit: 0.26, offset: 0, box: [[-0.6, -0.35, -1.3], [0.6, 8.3, 2.75]], palette: { cSteel: 'steel', cShade: 'shade', cLead: 'lead', cTag: 'tag', cBait: 'bait' } },
};

// ---------------------------------------------------------------- the shader round a shape
const VERT = /* glsl */`
uniform vec2 uFit;
varying vec3 vRo;
varying vec3 vPos;
varying vec3 vKey;
varying vec3 vUp;
vec3 toFish(vec3 o){ return vec3(o.z - uFit.y, o.y, o.x) / uFit.x; }
void main(){
  vRo = toFish((inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz);   // the eye, seen from inside the animal
  vPos = toFish(position);
  // its light comes over the viewer's left shoulder whichever way it has turned, so it never shows you a dull side
  vec3 k = transpose(mat3(modelViewMatrix)) * vec3(-.45, .75, .50), up = transpose(mat3(modelMatrix)) * vec3(0., 1., 0.);
  vKey = normalize(k.zyx); vUp = normalize(up.zyx);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = (shape) => /* glsl */`
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform vec2 uFit;
uniform vec3 uBoxMin, uBoxMax;
uniform float uSwim;
uniform vec4 uSwimShape;
uniform float uSoft, uHalo, uRim, uEmber, uEye, uGrain, uTurn;
uniform vec3 ${Object.keys(shape.palette).join(', ')}, cRim, cDeep;
varying vec3 vRo;
varying vec3 vPos;
varying vec3 vKey;
varying vec3 vUp;

#ifdef USE_FOG
  uniform vec3 fogColor;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif
#endif
// the scene's lights, as three.js hands them to every lit material
uniform vec3 ambientLightColor;
#if NUM_HEMI_LIGHTS > 0
  struct HemisphereLight { vec3 direction; vec3 skyColor; vec3 groundColor; };
  uniform HemisphereLight hemisphereLights[NUM_HEMI_LIGHTS];
#endif
#if NUM_DIR_LIGHTS > 0
  struct DirectionalLight { vec3 direction; vec3 color; };
  uniform DirectionalLight directionalLights[NUM_DIR_LIGHTS];
#endif
#if NUM_POINT_LIGHTS > 0
  struct PointLight { vec3 position; vec3 color; float distance; float decay; };
  uniform PointLight pointLights[NUM_POINT_LIGHTS];
#endif

mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float smin(float a, float b, float k){ float h = max(k - abs(a - b), 0.) / k; return min(a, b) - h * h * k * .25; }
float smax(float a, float b, float k){ return -smin(-a, -b, k); }
// how much a small, sharp-edged part (an eye, a tooth) counts at a point: crisp on the surface, loose out in the glow
float sharp(float d, float m){ return exp(-(d - m) * 90. / (1. + 40. * max(m, 0.))); }
float capsule(vec3 p, vec3 a, vec3 b, float r){ vec3 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0., 1.)) - r; }
float sdBox2(vec2 p, vec2 b){ vec2 d = abs(p) - b; return length(max(d, 0.)) + min(max(d.x, d.y), 0.); }
vec3 hueTurn(vec3 c, float a){ const vec3 k = vec3(.57735); float ca = cos(a); return c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1. - ca); }
float sdEll(vec3 p, vec3 r){ float k0 = length(p / r), k1 = length(p / (r * r)); return k0 * (k0 - 1.) / k1; }
float sdTri(vec2 p, vec2 p0, vec2 p1, vec2 p2){
  vec2 e0 = p1 - p0, e1 = p2 - p1, e2 = p0 - p2;
  vec2 v0 = p - p0, v1 = p - p1, v2 = p - p2;
  vec2 q0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0., 1.);
  vec2 q1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0., 1.);
  vec2 q2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0., 1.);
  float s = sign(e0.x * e2.y - e0.y * e2.x);
  vec2 d = min(min(vec2(dot(q0, q0), s * (v0.x * e0.y - v0.y * e0.x)),
                   vec2(dot(q1, q1), s * (v1.x * e1.y - v1.y * e1.x))),
                   vec2(dot(q2, q2), s * (v2.x * e2.y - v2.y * e2.x)));
  return -sqrt(d.x) * sign(d.y);
}
float slab(vec3 p, float d2, float th){ vec2 w = vec2(d2, abs(p.z) - th); return min(max(w.x, w.y), 0.) + length(max(w, 0.)); }
float sdCone(vec3 p, float r1, float r2, float h){
  float b = (r1 - r2) / h, a = sqrt(1. - b * b);
  vec2 q = vec2(length(p.xz), p.y);
  float k = dot(q, vec2(-b, a));
  if(k < 0.) return length(q) - r1;
  if(k > a * h) return length(q - vec2(0., h)) - r2;
  return dot(q, vec2(a, b)) - r1;
}
// the tail-beat: the same wave kit.js gives a low-poly body, nose to tail, from the component's swim numbers
vec3 bend(vec3 p){
  float sw = clamp((uSwimShape.z - p.x) * uSwimShape.w, 0., 1.);
  p.z += sin(uSwim - sw * uSwimShape.y) * uSwimShape.x * (.1 + .9 * sw * sw);
  return p;
}
vec3 toLin(vec3 c){ return mix(c / 12.92, pow((c + .055) / 1.055, vec3(2.4)), step(.04045, c)); }
vec3 toDisp(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c)); }

${shape.glsl}

vec3 normalAt(vec3 p){
  const vec2 e = vec2(1., -1.) * .0025;
  return normalize(e.xyy * map(p + e.xyy) + e.yyx * map(p + e.yyx) + e.yxy * map(p + e.yxy) + e.xxx * map(p + e.xxx));
}
// how much light there is where the animal is: about 1 in the sunlit band, a tenth of that in the palace,
// more again close to the oarfish's own lamp
vec3 sceneLight(vec3 viewPos){
  vec3 L = ambientLightColor;
  #if NUM_HEMI_LIGHTS > 0
    L += .5 * (hemisphereLights[0].skyColor + hemisphereLights[0].groundColor);
  #endif
  #if NUM_DIR_LIGHTS > 0
    L += .5 * directionalLights[0].color;
  #endif
  #if NUM_POINT_LIGHTS > 0
    for(int i = 0; i < NUM_POINT_LIGHTS; i++){
      float dist = length(pointLights[i].position - viewPos), fall = 1. / max(pow(dist, pointLights[i].decay), .01);
      if(pointLights[i].distance > 0.){ float k = dist / pointLights[i].distance; k *= k; fall *= pow(clamp(1. - k * k, 0., 1.), 2.); }
      L += .5 * pointLights[i].color * fall;
    }
  #endif
  return L / 3.14159;
}

void main(){
  vec3 ro = vRo, rd = normalize(vPos - vRo);
  // the stretch of this line of sight that lies inside the box
  vec3 inv = 1. / rd, ta = (uBoxMin - ro) * inv, tb = (uBoxMax - ro) * inv;
  vec3 tn = min(ta, tb), tf = max(ta, tb);
  float t0 = max(max(tn.x, tn.y), max(tn.z, 0.)), t1 = min(tf.x, min(tf.y, tf.z));
  if(t1 <= t0) discard;

  float t = t0, minD = 1e9, tMin = t0; bool hit = false;
  for(int i = 0; i < 80; i++){
    float d = map(ro + rd * t);
    if(d < minD){ minD = d; tMin = t; }
    if(d < .0018){ hit = true; break; }
    t += d * .82;
    if(t > t1) break;
  }

  // deep: 0 in the two bands that have light, 1 in the two that have none. There a soft thing wears the deep's colours
  float amb = 0.;
  #if NUM_HEMI_LIGHTS > 0
    amb = .5 * (hemisphereLights[0].skyColor.g + hemisphereLights[0].groundColor.g);
  #endif
  float deep = 1. - smoothstep(.35, 1.45, amb), halo = max(uHalo * (1. + 1.3 * deep), .0015);
  // a line of sight that only passes near: look closer for where it passes nearest, or its glow comes out in stripes
  if(!hit && minD < halo * 7.){
    float lo = max(tMin - minD, t0), hi = min(tMin + minD, t1);
    for(int i = 0; i < 4; i++){ float m1 = mix(lo, hi, .382), m2 = mix(lo, hi, .618); if(map(ro + rd * m1) < map(ro + rd * m2)) hi = m2; else lo = m1; }
    tMin = .5 * (lo + hi); minD = map(ro + rd * tMin);
  }

  vec3 p = ro + rd * (hit ? t : tMin);
  vec4 view = modelViewMatrix * vec4(vec3(p.z, p.y, p.x) * uFit.x + vec3(0., 0., uFit.y), 1.);
  vec3 day = clamp(sceneLight(view.xyz), 0., 1.);
  float dayS = max(day.r, max(day.g, day.b)), own = mix(mix(.32, .8, deep), 1., dayS);   // own: how much of its glow it keeps in the dark
  vec3 rimC = mix(cRim, cDeep, deep), acc = mix(ACCENT, max(hueTurn(ACCENT, uTurn), 0.), deep * .8);

  vec4 M; vec3 alb = albedo(p, M);
  float lit = (1. - M.x) * (1. - M.y);
  alb = mix(alb, max(hueTurn(alb, uTurn), 0.) * vec3(.85, .92, 1.10), deep * lit);
  vec3 glow = mix((alb * 1.12 + rimC * .22) * own, alb, 1. - lit);
  vec3 col; float a;
  if(hit){
    vec3 n = normalAt(p);
    float fac = clamp(dot(n, -rd), 0., 1.), fres = pow(1. - fac, 2.2);
    float key = dot(n, normalize(vKey)) * .5 + .5; key *= key;
    float sky = dot(n, normalize(vUp)) * .5 + .5;
    float thin = 1. - smoothstep(0., .9, clamp(-map(p + rd * .15) / .15, 0., 1.));

    vec3 c = mix(alb * vec3(.40, .44, .74) * .80, alb * 1.14, key);   // shadows lean cool
    c += alb * rimC * .30 * sky;
    c += acc * .16 * (1. - sky) * (1. - sky) * lit;                   // its accent colour bounces up from below
    c *= 1. - .30 * uRim * fac * fac * lit;                           // a deep core where the form faces you
    c *= mix(vec3(.16), vec3(1.), day);                               // the light of the band it is in
    c = mix(c, rimC * own, fres * uRim * .85 * lit);                  // a coloured rim
    c = mix(c, (alb * 1.32 + rimC * .10) * own, thin * .55 * lit);    // thin parts read as lit from behind
    c = mix(c, alb * (1. + .35 * uEye), M.x);                         // the eye gives its own light
    c = mix(c, alb * own, M.y * .75);
    col = mix(glow, c, smoothstep(0., max(uSoft, .002), fac));        // the edge goes out of focus
    a = 1. - M.z * M.w * .30;                                         // fin tips thin out into the water
  } else {
    col = glow;
    a = exp(-max(minD, 0.) / halo) * (1. - M.z * M.w * .30);
  }

  // a light held inside the chest
  float de = length(cross(rd, EMBER - ro));
  float ember = exp(-de * de / EMBER_R) * uEmber * (1. + .7 * deep) * a;
  col = 1. - (1. - col) * (1. - acc * ember * .85 - rimC * ember * .15);

  // the eye's bloom, on the side that faces you
  vec3 bloom = vec3(0.);
  if(BLOOM > 0.) for(int i = 0; i < 2; i++){
    vec3 out3 = normalize(vec3(EYE_OUT.xy, i == 0 ? EYE_OUT.z : -EYE_OUT.z)), ec = vec3(EYE.xy, i == 0 ? EYE.z : -EYE.z) + out3 * .06;
    float vis = smoothstep(-.15, .45, dot(out3, normalize(ro - ec)));
    float dr = length(cross(rd, ec - ro));
    float g = (exp(-dr * dr / .020) * .55 + exp(-dr / .30) * .16) * uEye * vis * BLOOM;
    bloom += EYE_COL * g; a = clamp(a + g * .55, 0., 1.);
  }
  if(a < .004) discard;

  // into the water: the band's fog over it, as over everything else
  float clear = 1.;
  vec3 lin = toLin(clamp(col, 0., 1.));
  #ifdef USE_FOG
    #ifdef FOG_EXP2
      clear = exp(-fogDensity * fogDensity * view.z * view.z);
    #else
      clear = 1. - smoothstep(fogNear, fogFar, -view.z);
    #endif
    lin = mix(fogColor, lin, clear);
  #endif
  vec3 rgb = toDisp(lin) * a + bloom * clear;
  rgb += (hash(gl_FragCoord.xy + floor(uSwim * 2.) * 7.) - .5) * uGrain * .10 * a;
  gl_FragColor = vec4(max(rgb, 0.), a);

  vec4 clip = projectionMatrix * view;
  gl_FragDepth = clamp(clip.z / clip.w * .5 + .5, 0., 1.);   // so stone and seabed hide it as they would a model
}`;

// ---------------------------------------------------------------- making one
const boxes = new Map();
function boxOf(key) {
  if (!boxes.has(key)) {
    const { unit: u, offset, box: [lo, hi] } = SHAPES[key];
    boxes.set(key, new THREE.BoxGeometry((hi[2] - lo[2]) * u, (hi[1] - lo[1]) * u, (hi[0] - lo[0]) * u).translate((hi[2] + lo[2]) * u / 2, (hi[1] + lo[1]) * u / 2, (hi[0] + lo[0]) * u / 2 + offset));
  }
  return boxes.get(key);
}
// the colours as the screen shows them: the look is worked out in those, not in the renderer's linear light
const shown = (hex) => { const n = parseInt(hex.slice(1), 16); return new THREE.Vector3((n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255); };
const mix = (a, b, t) => a + (b - a) * t;

// soft: the component's soft look ({ shape, rim, deep, turn, edge, halo, rimLight, inner, eyeGlow, grain }); palette: its colours
// as they stand now; swim: its tail-beat. Returns { mesh, material }; material.userData.swim.value is the beat's phase,
// advanced by whoever owns the creature, exactly as for a low-poly body.
export function softBody(soft, palette, swim) {
  const shape = SHAPES[soft.shape], u = shape.unit;
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.lights, THREE.UniformsLib.fog, {
    uFit: { value: new THREE.Vector2(u, shape.offset) },
    uBoxMin: { value: new THREE.Vector3(...shape.box[0]) }, uBoxMax: { value: new THREE.Vector3(...shape.box[1]) },
    uSwim: { value: 0 },
    uSwimShape: { value: new THREE.Vector4(swim ? swim.amp / u : 0, swim?.waves || 0, swim ? (swim.nose - shape.offset) / u : 0, swim ? u / swim.length : 0) },
    uSoft: { value: mix(0.02, 0.9, Math.pow(soft.edge, 1.3)) }, uHalo: { value: mix(0.003, 0.24, Math.pow(soft.halo, 1.5)) },
    uRim: { value: soft.rimLight }, uEmber: { value: soft.inner }, uEye: { value: soft.eyeGlow }, uGrain: { value: soft.grain },
    cRim: { value: shown(soft.rim) }, cDeep: { value: shown(soft.deep) }, uTurn: { value: soft.turn * Math.PI / 180 },
    ...Object.fromEntries(Object.entries(shape.palette).map(([name, key]) => [name, { value: shown(palette[key]) }])),
  }]);
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG(shape), lights: true, fog: true,
    transparent: true, premultipliedAlpha: true, depthWrite: false, side: THREE.BackSide }); // the back of the box, so it is still drawn with the eye inside it
  material.userData.swim = uniforms.uSwim; material.userData.glow = { value: 1 };
  return { mesh: new THREE.Mesh(boxOf(soft.shape), material), material };
}
