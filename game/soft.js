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
  M = vec4((wE + wL * min(uLure, 1.)) / ws, wT / ws, wF / ws, tip);
  return (body * wB + mix(cFins * .8, cFinTip, tip) * wF + mix(cFins, cFinTip, smoothstep(.7, 1.7, pb.y)) * wR + eye * wE + vec3(.99, .95, .93) * wT + cLure * (.25 + .75 * uLure) * wL) / ws;
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

// The Keeper: a great crab under a dome of plates, a spire on the dome, two claws held open and six legs.
const KEEPER = /* glsl */`
#define ACCENT cTone
#define EYE_COL cEye
const vec3 EYE = vec3(1.05, .47, .26), EYE_OUT = vec3(1., .3, .35), EMBER = vec3(0., .40, 0.);
const float EMBER_R = .22, BLOOM = .6;

void parts(vec3 p, out float dD, out float dL, out float dE, out float dK){
  vec3 s = vec3(p.x, p.y, abs(p.z));
  dD = smax(sdEll(p - vec3(0., .12, 0.), vec3(.90, .80, .96)), .10 - p.y, .08);               // the dome
  dD = smin(dD, sdEll(p - vec3(0., .13, 0.), vec3(.84, .15, .90)), .06);                       // the body under it
  dD = smin(dD, sdCone(vec3(p.x + (p.y - .86) * .27, p.y - .86, p.z), .15, .012, .46), .10);   // the spire on top
  float st = 6.28318 / 5., a = floor(atan(p.z, p.x) / st + .5) * st;                           // five knobs where the plates meet
  dD = smin(dD, length(p - vec3(cos(a) * .66, .66, sin(a) * .70)) - .09, .08);
  dK = sdEll(p - vec3(.80, .13, 0.), vec3(.16, .11, .42));                                     // the face under the shell's lip
  dE = length(s - EYE) - .085;
  dL = rcone(s, vec3(.85, .19, .19), vec3(1.02, .44, .26), .05, .04);                          // an eye stalk
  dL = min(dL, smin(rcone(s, vec3(.62, .18, .59), vec3(1.00, .29, .94), .12, .11), rcone(s, vec3(1.00, .29, .94), vec3(1.38, .25, .74), .12, .17), .05));   // a claw: arm, forearm
  dL = smin(dL, min(rcone(s, vec3(1.38, .25, .74), vec3(1.75, .40, .46), .17, .025), rcone(s, vec3(1.38, .25, .74), vec3(1.68, .06, .52), .12, .02)), .04);   // and two fingers
  for(int i = 0; i < 3; i++){ float x = .29 - float(i) * .44;                                  // three legs a side
    dL = min(dL, smin(rcone(s, vec3(x, .21, .79), vec3(x - .09, .56, 1.26), .075, .06), rcone(s, vec3(x - .09, .56, 1.26), vec3(x - .17, -.15, 1.50), .06, .02), .04)); }
}
float map(vec3 p){
  float dD, dL, dE, dK; parts(p, dD, dL, dE, dK);
  return smin(smin(smin(dD, dL, .07), dK, .05), dE, .02);
}
vec3 albedo(vec3 p, out vec4 M){
  float dD, dL, dE, dK; parts(p, dD, dL, dE, dK);
  float m = min(min(dD, dL), min(dE, dK)), wD = exp(-(dD - m) * 16.), wL = exp(-(dL - m) * 16.), wK = exp(-(dK - m) * 24.), wE = sharp(dE, m), ws = wD + wL + wK + wE;
  float plate = smoothstep(-.15, .15, sin(atan(p.z, p.x) * 5.) * sin(p.y * 9.5));
  vec3 dome = mix(mix(cTone * .8, cTone, plate), cPale, smoothstep(.26, .16, p.y));            // plates in two tones, a pale lip
  dome = mix(dome, cPale, smoothstep(.95, 1.3, p.y));                                          // the spire pales to its tip
  vec3 limb = mix(mix(cDark, cDeep, .5), cPale, smoothstep(.55, .95, dD));                     // legs and claws pale at their ends
  vec3 e = normalize(vec3(p.x, p.y, abs(p.z)) - EYE);
  vec3 eye = mix(cEye, vec3(.04, .03, .07), smoothstep(.80, .92, dot(e, normalize(EYE_OUT))));
  M = vec4(wE / ws, 0., 0., 0.);
  return (dome * wD + limb * wL + cDeep * wK + eye * wE) / ws;
}`;

// The Shearer: a sawfish. A flat body with wings, a tall fin, and the saw, toothed in the district's colour.
const SHEARER = /* glsl */`
#define ACCENT cTone
#define EYE_COL cEye
const vec3 EYE = vec3(.65, .15, .25), EYE_OUT = vec3(.2, .7, .7), EMBER = vec3(.30, 0., 0.);
const float EMBER_R = .10, BLOOM = .6;

void parts(vec3 p, out float dB, out float dS, out float dT, out float dE, out float dF, out float dW){
  p = bend(p);
  dB = smin(sdEll(p - vec3(.35, .06, 0.), vec3(.80, .25, .38)), sdEll(p - vec3(-.35, .05, 0.), vec3(.75, .22, .26)), .20);
  dB = smin(dB, sdEll(p - vec3(-.85, .02, 0.), vec3(.36, .09, .07)), .20);
  dB = smin(dB, sdEll(p - vec3(.86, -.06, 0.), vec3(.34, .11, .25)), .20);                     // the head, flattening into the saw
  dS = sdEll(p - vec3(1.27, -.10, 0.), vec3(.36, .028, .11));                                   // the saw
  float i = clamp(floor((p.x - 1.05) / .0675 + .5), 0., 7.);
  dT = sdCone(vec3(p.x - 1.05 - i * .0675, abs(p.z) - (.105 - i * .006), p.y + .10), .022, .004, .10);   // its teeth, eight a side
  dE = length(vec3(p.x, p.y, abs(p.z)) - EYE) - .06;
  float d2 = min(sdTri(p.xy, vec2(.18, .28), vec2(-.38, .24), vec2(-.14, .68)) - .03, sdTri(p.xy, vec2(-.57, .13), vec2(-.76, .11), vec2(-.74, .33)) - .02);
  d2 = min(d2, min(sdTri(p.xy, vec2(-.97, .06), vec2(-1.48, .53), vec2(-1.22, .05)), sdTri(p.xy, vec2(-.97, -.04), vec2(-1.33, -.27), vec2(-1.22, .05))) - .03);
  dF = slab(p, d2, .012) - .014;                                                               // the tall fin, a small one, the tail
  vec2 w = vec2(p.x, abs(p.z));
  float d3 = min(sdTri(w, vec2(.58, .30), vec2(.02, .92), vec2(-.18, .30)), sdTri(w, vec2(-.38, .14), vec2(-.58, .40), vec2(-.62, .14))) - .04;
  dW = slab(vec3(0., 0., p.y + .06 + (w.y - .3) * .12), d3, .014) - .016;                       // the wings
}
float map(vec3 p){
  float dB, dS, dT, dE, dF, dW; parts(p, dB, dS, dT, dE, dF, dW);
  return min(smin(smin(smin(smin(dB, dS, .08), dF, .06), dW, .08), dE, .02), dT);
}
vec3 albedo(vec3 p, out vec4 M){
  float dB, dS, dT, dE, dF, dW; parts(p, dB, dS, dT, dE, dF, dW);
  float m = min(min(min(dB, dS), min(dT, dE)), min(dF, dW));
  float wB = exp(-(dB - m) * 16.), wS = exp(-(dS - m) * 20.), wF = exp(-(dF - m) * 12.), wW = exp(-(dW - m) * 12.), wT = sharp(dT, m), wE = sharp(dE, m), ws = wB + wS + wF + wW + wT + wE;
  vec3 pb = bend(p);
  float t = clamp((pb.y + .22) / .5, 0., 1.), tip = smoothstep(.03, .45, dB);
  vec3 body = mix(mix(cBelly, cFlank, smoothstep(.1, .5, t)), cBack, smoothstep(.6, .98, t));
  vec3 e = normalize(vec3(pb.x, pb.y, abs(pb.z)) - EYE);
  vec3 eye = mix(cEye, vec3(.04, .03, .07), smoothstep(1.1, .9, length(vec2((e.x - .2) / .25, (e.z - .55) / .6))));
  M = vec4((wE + wT * .45) / ws, 0., (wF + wW) / ws, tip);
  return (body * wB + cSaw * wS + mix(cTone * .72, cTone, tip) * wF + mix(cFlank, cBack, tip) * wW + cTone * wT + eye * wE) / ws;
}`;

// The Warden's head: a moray's, with a crest. Its body is the next shape.
const WARDEN = /* glsl */`
#define ACCENT cTone
#define EYE_COL cEye
const vec3 EYE = vec3(1.26, .39, .60), EYE_OUT = vec3(.3, .45, 1.), EMBER = vec3(.60, 0., 0.);
const float EMBER_R = .18, BLOOM = .8;

void parts(vec3 p, out float dB, out float dJ, out float dE, out float dT, out float dF){
  dB = smin(sdEll(p - vec3(.25, .05, 0.), vec3(1.15, .80, .78)), sdEll(p - vec3(1.50, .14, 0.), vec3(.82, .30, .50)), .35);
  vec3 j = p - vec3(1.30, -.42, 0.); j.xy = rot(.12) * j.xy;
  dJ = sdEll(j, vec3(.95, .17, .56));                                                          // the lower jaw
  float i = clamp(floor((2.0 - p.x) / .32 + .5), 0., 3.), x = 2.0 - i * .32, z = abs(p.z) - (.19 + i * .11);
  dT = min(sdCone(vec3(p.x - x, -(p.y + .12), z), .05, .008, .22), sdCone(vec3(p.x - x + .10, p.y + .42, z * 1.05), .045, .008, .24));   // four teeth a side, above and below
  dE = length(vec3(p.x, p.y, abs(p.z)) - EYE) - .15;
  float d2 = min(sdTri(p.xy, vec2(1.15, .60), vec2(-.85, .72), vec2(-.10, 1.52)), sdTri(p.xy, vec2(-.85, .72), vec2(-.10, 1.52), vec2(-.85, 1.30))) - .04;
  dF = slab(p, d2, .014) - .016;                                                               // the crest
}
float map(vec3 p){
  float dB, dJ, dE, dT, dF; parts(p, dB, dJ, dE, dT, dF);
  return min(smin(smin(smin(dB, dJ, .10), dF, .08), dE, .03), dT);
}
vec3 albedo(vec3 p, out vec4 M){
  float dB, dJ, dE, dT, dF; parts(p, dB, dJ, dE, dT, dF);
  float m = min(min(dB, dJ), min(min(dE, dT), dF));
  float wB = exp(-(dB - m) * 16.), wJ = exp(-(dJ - m) * 16.), wF = exp(-(dF - m) * 12.), wE = sharp(dE, m), wT = sharp(dT, m), ws = wB + wJ + wF + wE + wT;
  float t = clamp((p.y + .8) / 1.6, 0., 1.), band = smoothstep(-.2, .2, sin(p.x * 5.5 + 1.));
  vec3 body = mix(mix(cPale, mix(cTone * .88, cTone, band), smoothstep(.08, .4, t)), cTone * .72, smoothstep(.62, .98, t));
  vec3 jaw = mix(cPale, cTone * .72, smoothstep(-.55, -.30, p.y));
  float mouth = exp(-abs(dB - dJ) * 22.) * smoothstep(.55, .9, p.x);
  body = mix(body, cGum, mouth * .8); jaw = mix(jaw, cGum, mouth * .8);
  float tip = smoothstep(.05, .6, dB);
  vec3 e = normalize(vec3(p.x, p.y, abs(p.z)) - EYE);
  vec3 eye = mix(cEye, vec3(.04, .03, .07), smoothstep(.80, .92, dot(e, normalize(EYE_OUT))));
  M = vec4(wE / ws, wT / ws, wF / ws, tip);
  return (body * wB + jaw * wJ + mix(cPale, vec3(1., .96, .89), tip) * wF + eye * wE + vec3(.99, .95, .93) * wT) / ws;
}`;

// The Warden's body: every length of it as one soft thing, so the lengths melt into each other. uLink holds where its head
// ends and where each length is; the game moves those, and the component (npc.js) hands them over every frame.
const EEL = /* glsl */`
uniform vec3 uLink[12];
#define ACCENT cTone
#define EYE_COL vec3(0.)
const vec3 EYE = vec3(0.), EYE_OUT = vec3(0., 0., 1.), EMBER = vec3(0.);
const float EMBER_R = .01, BLOOM = 0.;

// the body between two of its marks: taller than it is wide, thinner toward the tail (k: 0 at the head, 1 at the tail), a fin along its back
float link(vec3 p, vec3 a, vec3 b, float k, out float fin){
  vec3 pa = p - a, ba = b - a, q = pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0., 1.); float r = mix(.19, .13, k);
  fin = max(length(q.xz) - .012, abs(q.y - r * 2.15) - r * .7) - .014;
  return smin(length(vec3(q.x, q.y / 1.7, q.z)) - r, fin, .05);
}
float map(vec3 p){
  float d = 1e9, fin;
  for(int i = 0; i < 11; i++) d = smin(d, link(p, uLink[i], uLink[i + 1], float(i) / 10., fin), .08);
  return d;
}
vec3 albedo(vec3 p, out vec4 M){
  float best = 1e9, bestFin = 1e9, fin, seg = 0., y = 0.;
  for(int i = 0; i < 11; i++){ float d = link(p, uLink[i], uLink[i + 1], float(i) / 10., fin); if(d < best){ best = d; bestFin = fin; seg = float(i); y = p.y - mix(uLink[i].y, uLink[i + 1].y, .5); } }
  vec3 tone = mod(seg, 3.) < .5 ? cPale : cTone;                                                // two lengths in the district's colour, then a pale one
  vec3 body = mix(mix(cPale, tone, smoothstep(-.30, -.10, y)), tone * .72, smoothstep(.12, .32, y));
  float wF = exp(-(bestFin - best) * 30.);
  M = vec4(0., 0., wF, smoothstep(.30, .50, y));
  return mix(body, mix(cPale, vec3(1., .96, .89), M.w), wF);
}`;

// ---------------------------------------------------------------- the ten shells
// A shell is written in its model's own measure: it stands on y = 0, about one unit tall, and q and the distance are in
// that measure. Each gives its distance (d), its colour there (col) and how far it gives its own light (lit).
// cShell is the shell's one colour; PL is that colour worn pale.
const SHELL = (body) => /* glsl */`
#define ACCENT cShell
#define EYE_COL vec3(0.)
#define PL mix(cShell, vec3(1.), .55)
const vec3 EYE = vec3(0.), EYE_OUT = vec3(0., 0., 1.), EMBER = vec3(0., 1.5, 0.);
const float EMBER_R = .5, BLOOM = 0.;
float shell(vec3 q, out vec3 col, out float lit){ lit = 0.; float d; ${body}
  return d; }
float map(vec3 p){ vec3 c; float l; return shell(vec3(p.z, p.y, p.x) / 3., c, l) * 3.; }
vec3 albedo(vec3 p, out vec4 M){ vec3 c; float l; shell(vec3(p.z, p.y, p.x) / 3., c, l); M = vec4(l, 0., 0., 0.); return c; }`;
const SHELL_BODIES = {
  // an auger: whorl on whorl up to a point, a dark mouth at the foot
  spire: `float w = q.y / .2, r = .42 * max(1. - q.y / 1.32, 0.) * (1. + .13 * sin(6.28318 * w + 1.6)) + .012;
  d = max((length(q.xz) - r) * .7, max(-q.y, q.y - 1.27));
  float f = fract(w);
  col = mix(mix(mix(cShell, vec3(.85, .57, .37), .5), cShell, smoothstep(.2, .4, f)), cShell * .72, smoothstep(.7, .88, f));
  col = mix(col, vec3(.23, .14, .20), smoothstep(.14, .06, length(q - vec3(.27, .11, .24))));`,
  // a scallop: ribs fanning from the hinge, the rim scalloped, two ears
  fan: `vec2 h = q.xy - vec2(0., .08); float r = length(h), a = atan(h.x, h.y), rib = cos(a * 13.1);
  float th = .02 + .085 * max(1. - (r / .9) * (r / .9), 0.) + .012 * rib * smoothstep(.1, .5, r);
  d = max(max(r - .86 + .03 * (.5 + .5 * rib), (abs(a) - 1.2) * r), abs(q.z - .015) - th) * .8;
  d = min(d, sdEll(vec3(abs(q.x) - .2, q.y - .1, q.z), vec3(.16, .1, .03)));
  col = q.z > 0. ? mix(cShell, PL, smoothstep(-.3, .3, rib)) : cShell * .7;`,
  // a nautilus: the tube widening as it winds, striped across, the last chamber open
  coil: `d = 1e9; float best = 0., r0 = .057; vec3 a0 = vec3(-.11, .62, 0.);
  for(int i = 1; i <= 13; i++){ float a = float(i) * .53, R = .11 * exp(.19 * a), r1 = R * .52; vec3 a1 = vec3(-cos(a) * R, .62 + sin(a) * R, 0.);
    float di = rcone(q, a0, a1, r0, r1); if(di < d){ d = di; best = float(i); } a0 = a1; r0 = r1; }
  col = mod(best, 2.) < .5 ? vec3(.54, .35, .23) : best > 10. ? mix(cShell, vec3(1., .96, .89), .6) : cShell;
  col = mix(col, vec3(.16, .10, .15), smoothstep(.20, .10, length(q - vec3(-.27, .95, 0.))));`,
  // the people's ring in small: a body closed on itself, length by length, a crest where the head is
  ring: `vec2 h = q.xy - vec2(0., .62); float seg = atan(h.y, h.x) * 12. / 6.28318, f = fract(seg);
  d = length(vec2(length(h) - .5, q.z * 1.05)) - (.085 + .035 * sin(3.14159 * f));
  for(int i = 0; i < 3; i++){ float k = float(i); d = min(d, rcone(q, vec3(.60, .72 - k * .1, 0.), vec3(.84 - k * .05, .82 - k * .16, 0.), .035, .005)); }
  col = (mod(floor(seg), 3.) < .5 ? cShell * .7 : cShell) * (.75 + .25 * smoothstep(0., .25, f) * smoothstep(1., .75, f));`,
  // a horn shell, to be blown: ridged, bent, flaring to a lip that is pink inside
  horn: `d = 1e9; float best = 0.;
  for(int i = 0; i < 7; i++){ float t0 = float(i) / 7., t1 = float(i + 1) / 7.;
    vec3 a0 = vec3(.34 - .62 * t0 + .1 * sin(t0 * 3.), .2 + t0 * t0 + .25 * t0, .06 * sin(t0 * 4.)), a1 = vec3(.34 - .62 * t1 + .1 * sin(t1 * 3.), .2 + t1 * t1 + .25 * t1, .06 * sin(t1 * 4.));
    float di = rcone(q, a0, a1, (.3 * (1. - t0) + .02) * (mod(float(i), 2.) < .5 ? 1.12 : 1.), .3 * (1. - t1) + .02); if(di < d){ d = di; best = float(i); } }
  col = mod(best, 2.) < .5 ? cShell : cShell * .72;
  float lip = sdEll(q - vec3(.47, .27, 0.), vec3(.07, .26, .44));
  if(lip < d) col = mix(vec3(.98, .80, .84), PL, smoothstep(.2, .42, length(q.yz - vec2(.27, 0.))));
  d = smin(d, lip, .05);`,
  // a limpet: a low ribbed cone, off-centre at the top, worn pale along the ribs
  cap: `float rib = cos(atan(q.z, q.x) * 14.), r = length(q.xz - vec2(.03 * smoothstep(0., .5, q.y), 0.));
  float prof = q.y < .24 ? mix(.64, .36, max(q.y, 0.) / .24) : .36 * max(1. - (q.y - .24) / .27, 0.);
  d = max((r - prof * (1. + .05 * rib)) * .7, max(-q.y - .03, q.y - .52));
  col = mix(mix(cShell * .68, cShell, smoothstep(-.3, .3, rib)), PL, smoothstep(.3, .5, q.y));`,
  // a murex: a small body, and a comb of spines down three sides of it
  spine: `d = smin(sdEll(q - vec3(0., .46, 0.), vec3(.33, .48, .33)), sdCone(q - vec3(0., .72, 0.), .2, .01, .36), .12);
  float st = 2.0944, a = floor(atan(q.x, q.z) / st + .5) * st; vec2 e = vec2(sin(a), cos(a)); vec3 f = vec3(dot(q.xz, e), q.y, dot(q.xz, vec2(e.y, -e.x)));
  float sp = rcone(q, vec3(0., .02, 0.), vec3(.12, -.02, .32), .06, .02);
  for(int j = 0; j < 4; j++){ float k = float(j), r = j == 0 ? .22 : j == 1 ? .33 : j == 2 ? .26 : .14; sp = min(sp, rcone(f, vec3(r - .04, .22 + k * .2, 0.), vec3(r + .36 - k * .04, .36 + k * .2, 0.), .05, .006)); }
  vec3 body = mix(cShell, vec3(.96, .89, .76), .55);
  col = sp < d ? cShell : mix(body, mix(body, cShell, .4), smoothstep(-.3, .3, sin(q.y * 18.)));
  d = smin(d, sp, .04);`,
  // a bubble shell thin enough to carry a light: every other panel lets it out
  lamp: `d = sdEll(q - vec3(0., .51, 0.), vec3(.40, .50, .40));
  float k = floor(atan(q.z, q.x) / .7854), i = floor((q.y - .04) / .235), on = mod(k + i, 2.) < .5 && i > .5 && i < 2.5 ? 1. : 0.;
  col = mix(vec3(.54, .42, .23), cShell, on); lit = on * .9;`,
  // a tusk shell: long, bent, banded finely, open at the broad end
  tusk: `d = 1e9; float best = 0.;
  for(int i = 0; i < 7; i++){ float t0 = float(i) / 7., t1 = float(i + 1) / 7.;
    vec3 a0 = vec3(.08 * sin(t0 * 1.4), .06 + .5 * t0 - .12 * t0 * t0, 1.25 * t0 - .2 * t0 * t0 - .4), a1 = vec3(.08 * sin(t1 * 1.4), .06 + .5 * t1 - .12 * t1 * t1, 1.25 * t1 - .2 * t1 * t1 - .4);
    float di = rcone(q, a0, a1, .19 * (1. - float(i) / 7.6), .19 * (1. - float(i + 1) / 7.6)); if(di < d){ d = di; best = float(i); } }
  col = mix(mod(best, 2.) < .5 ? cShell : vec3(.85, .82, .77), vec3(.43, .41, .38), smoothstep(-.33, -.42, q.z));`,
  // an oyster standing open, and what it made
  pearl: `vec3 h = q - vec3(0., .06, -.28); vec2 zy = rot(1.05) * vec2(h.z, h.y); vec3 u = vec3(h.x, zy.y, zy.x);
  float lo = sdEll(h - vec3(0., .02, .36), vec3(.60, .09, .58)), up = sdEll(u - vec3(0., -.02, .36), vec3(.60, .09, .58)), pe = length(q - vec3(0., .24, .08)) - .19;
  d = min(min(lo, up), pe);
  vec3 outer = vec3(.56, .65, .77), nacre = vec3(.93, .96, 1.);
  col = pe <= d ? cShell : lo < up ? mix(outer, nacre, smoothstep(0., .05, h.y - .03)) : mix(outer, nacre, smoothstep(0., -.05, u.y + .02));
  lit = pe <= d ? .85 : 0.;`,
};

// palette: which of the component's colours each of the shader's takes
export const SHAPES = {
  biter: { glsl: BITER, unit: 0.33, offset: 0.021, box: [[-2.3, -1.3, -0.85], [1.7, 1.6, 0.85]],
    palette: { cBack: 'back', cFlank: 'flank', cBar: 'bar', cBelly: 'belly', cFin: 'fins', cFinDark: 'finDark', cJaw: 'jaw', cEye: 'eye' } },
  angler: { glsl: ANGLER, unit: 0.55, offset: 0, box: [[-2.3, -1.4, -2.0], [2.05, 2.3, 2.0]],
    palette: { cBack: 'back', cSkin: 'skin', cWart: 'wart', cBelly: 'belly', cGum: 'gum', cFins: 'fins', cFinTip: 'finTip', cEye: 'eye', cLure: 'lure' } },
  drifter: { glsl: DRIFTER, unit: 0.27, offset: 0, box: [[-3.2, -3.2, -3.2], [3.2, 3.2, 3.2]], palette: { cTest: 'test', cBand: 'band', cSpine: 'spine', cTip: 'tip' } },
  leech: { glsl: LEECH, unit: 0.33, offset: 0, box: [[-2.3, -0.8, -0.8], [1.95, 0.95, 0.8]], palette: { cBack: 'back', cFlank: 'flank', cBelly: 'belly', cFin: 'fin', cEye: 'eye' } },
  keeper: { glsl: KEEPER, unit: 1.7, offset: 0, box: [[-1.4, -0.5, -1.9], [2.1, 1.7, 1.9]], palette: { cTone: 'tone', cPale: 'pale', cDark: 'dark', cDeep: 'deep', cEye: 'eye' } },
  shearer: { glsl: SHEARER, unit: 2.0, offset: 0, box: [[-1.85, -0.65, -1.25], [1.95, 1.0, 1.25]], palette: { cTone: 'tone', cBack: 'back', cFlank: 'flank', cBelly: 'belly', cSaw: 'saw', cEye: 'eye' } },
  warden: { glsl: WARDEN, unit: 0.62, offset: 0, box: [[-1.3, -1.0, -1.2], [2.6, 1.9, 1.2]], palette: { cTone: 'tone', cPale: 'pale', cGum: 'gum', cEye: 'eye' } },
  eel: { glsl: EEL, unit: 2.0, offset: 0, links: 12, box: [[-5.6, -1.2, -5.6], [5.6, 1.5, 5.6]], palette: { cTone: 'tone', cPale: 'pale' } },
  hook: { glsl: HOOK, unit: 0.26, offset: 0, box: [[-0.6, -0.35, -1.3], [0.6, 8.3, 2.75]], palette: { cSteel: 'steel', cShade: 'shade', cLead: 'lead', cTag: 'tag', cBait: 'bait' } },
};

for (const [name, body] of Object.entries(SHELL_BODIES)) SHAPES[`shell-${name}`] = { glsl: SHELL(body), unit: 1 / 3, offset: 0, box: [[-3, -0.4, -3], [3, 4.1, 3]], palette: { cShell: 'colour' } };

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
uniform float uSoft, uHalo, uRim, uEmber, uEye, uGrain, uTurn, uFlash, uLure;
uniform vec3 ${Object.keys(shape.palette).join(', ')}, cRim, cAbyss;
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
float rcone(vec3 p, vec3 a, vec3 b, float r1, float r2){ vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.); return length(pa - ba * h) - mix(r1, r2, h); }
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
    float tm = .5 * (lo + hi), dm = map(ro + rd * tm);
    if(dm < minD){ minD = dm; tMin = tm; }   // (two parts may each come near: never end up further off than the march found)
  }

  vec3 p = ro + rd * (hit ? t : tMin);
  vec4 view = modelViewMatrix * vec4(vec3(p.z, p.y, p.x) * uFit.x + vec3(0., 0., uFit.y), 1.);
  vec3 day = clamp(sceneLight(view.xyz), 0., 1.);
  float dayS = max(day.r, max(day.g, day.b)), own = mix(mix(.32, .8, deep), 1., dayS);   // own: how much of its glow it keeps in the dark
  vec3 rimC = mix(cRim, cAbyss, deep), acc = mix(ACCENT, max(hueTurn(ACCENT, uTurn), 0.), deep * .8);

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

  col = mix(col, vec3(1.), min(uFlash, 1.) * .7);   // struck: it flares white for a moment

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
function boxOf(key, k = 1) {
  const id = `${key}|${k}`;
  if (!boxes.has(id)) {
    const { unit, offset, box: [lo, hi] } = SHAPES[key], u = unit * k;
    boxes.set(id, new THREE.BoxGeometry((hi[2] - lo[2]) * u, (hi[1] - lo[1]) * u, (hi[0] - lo[0]) * u).translate((hi[2] + lo[2]) * u / 2, (hi[1] + lo[1]) * u / 2, (hi[0] + lo[0]) * u / 2 + offset * k));
  }
  return boxes.get(id);
}
// the colours as the screen shows them: the look is worked out in those, not in the renderer's linear light
const shown = (hex) => { const n = parseInt(hex.slice(1), 16); return new THREE.Vector3((n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255); };
const mix = (a, b, t) => a + (b - a) * t;

// the colours of a soft material, set again from a palette (a shell recoloured in the library changes where it lies)
export function softColours(material, soft, palette) { for (const [name, key] of Object.entries(SHAPES[soft.shape].palette)) material.uniforms[name].value.copy(shown(palette[key])); }

// soft: the component's soft look ({ shape, rim, deep, turn, edge, halo, rimLight, inner, eyeGlow, grain }); palette: its colours
// as they stand now; swim: its tail-beat. Returns { mesh, material }; material.userData.swim.value is the beat's phase,
// advanced by whoever owns the creature, exactly as for a low-poly body. soft.scale: the same shape, larger; soft.colours:
// colours worked out from the palette. material.emissiveIntensity, which the game raises when a keeper is struck, flares it.
export function softBody(soft, palette, swim) {
  const shape = SHAPES[soft.shape], k = soft.scale || 1, u = shape.unit * k, pal = soft.colours ? soft.colours(palette) : palette;
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.lights, THREE.UniformsLib.fog, {
    uFit: { value: new THREE.Vector2(u, shape.offset * k) }, uFlash: { value: 0 }, uLure: { value: 1 },
    ...(shape.links ? { uLink: { value: Array.from({ length: shape.links }, () => new THREE.Vector3()) } } : {}),
    uBoxMin: { value: new THREE.Vector3(...shape.box[0]) }, uBoxMax: { value: new THREE.Vector3(...shape.box[1]) },
    uSwim: { value: 0 },
    uSwimShape: { value: new THREE.Vector4(swim ? swim.amp / u : 0, swim?.waves || 0, swim ? (swim.nose - shape.offset * k) / u : 0, swim ? u / swim.length : 0) },
    uSoft: { value: mix(0.02, 0.9, Math.pow(soft.edge, 1.3)) }, uHalo: { value: mix(0.003, 0.24, Math.pow(soft.halo, 1.5)) },
    uRim: { value: soft.rimLight }, uEmber: { value: soft.inner }, uEye: { value: soft.eyeGlow }, uGrain: { value: soft.grain },
    cRim: { value: shown(soft.rim) }, cAbyss: { value: shown(soft.deep) }, uTurn: { value: soft.turn * Math.PI / 180 },
    ...Object.fromEntries(Object.entries(shape.palette).map(([name, key]) => [name, { value: shown(pal[key]) }])),
  }]);
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG(shape), lights: true, fog: true,
    transparent: true, premultipliedAlpha: true, depthWrite: false, side: THREE.BackSide }); // the back of the box, so it is still drawn with the eye inside it
  material.userData.swim = uniforms.uSwim; material.userData.glow = { value: 1 };
  let struck = 0.12;
  Object.defineProperty(material, 'emissiveIntensity', { get: () => struck, set(v) { struck = v; uniforms.uFlash.value = Math.max(0, (v - 0.12) / 0.9); } });
  return { mesh: new THREE.Mesh(boxOf(soft.shape, k), material), material, unit: u };
}

// ---------------------------------------------------------------- the soft skin
// What comes in hundreds (plants, what lies on the bed) cannot be drawn the way above: it would cost far too much.
// It keeps its own model and is shaded softly instead: rounded where its faces meet, a deeper core, a lit rim, the
// deep's colours in the dark bands as a soft creature has them, and, on solid things, edges that fade out in grain.
const SKIN = /* glsl */`
  {
    float sFac = clamp(abs(dot(normal, normalize(vViewPosition))), 0., 1.), sFres = pow(1. - sFac, 2.2), sAmb = 0.;
    #if NUM_HEMI_LIGHTS > 0
      sAmb = .5 * (hemisphereLights[0].skyColor.g + hemisphereLights[0].groundColor.g);
    #endif
    float sDeep = 1. - smoothstep(.35, 1.45, sAmb);
    vec3 sBase = diffuseColor.rgb, sK = vec3(.57735);
    vec3 sTurned = max(sBase * cos(uSkinTurn) + cross(sK, sBase) * sin(uSkinTurn) + sK * dot(sK, sBase) * (1. - cos(uSkinTurn)), 0.);
    outgoingLight *= mix(vec3(1.), (sTurned + .03) / (sBase + .03), sDeep);          // in the dark bands its colours turn
    outgoingLight *= 1. - .25 * sFac * sFac;                                            // a deeper core where it faces you
    outgoingLight += mix(sBase, sTurned, sDeep) * mix(.05, .22, sDeep);                // a little light of its own, more in the dark
    outgoingLight += mix(uSkinRim, uSkinAbyss, sDeep) * sFres * mix(.45, .65, sDeep);   // and a lit rim
  }`;
// material: a lit three.js material already set up (it may sway, glow, be instanced). look: { rim, deep, turn } as in SOFT.
// Its geometries need smoothNormals() once each; without, it is shaded by its flat faces as before.
export function softSkin(material, look) {
  const before = material.onBeforeCompile, key = material.customProgramCacheKey ? material.customProgramCacheKey() : '', solid = material.side === THREE.FrontSide;
  const u = { uSkinRim: { value: new THREE.Color(look.rim) }, uSkinAbyss: { value: new THREE.Color(look.deep) }, uSkinTurn: { value: look.turn * Math.PI / 180 } };
  if (solid) material.alphaHash = true; // a sheet (a blade of kelp) would turn to grain wherever it is not face on, so only solid things fade at the edge
  material.onBeforeCompile = (sh, renderer) => {
    if (before) before(sh, renderer);
    Object.assign(sh.uniforms, u);
    sh.vertexShader = `attribute vec3 softNormal;\n${sh.vertexShader.replace('#include <beginnormal_vertex>', 'vec3 objectNormal = dot(softNormal, softNormal) > 0.0 ? softNormal : normal;')}`;
    sh.fragmentShader = `uniform vec3 uSkinRim;\nuniform vec3 uSkinAbyss;\nuniform float uSkinTurn;\n${sh.fragmentShader
      .replace('#include <alphahash_fragment>', `${solid ? 'diffuseColor.a = smoothstep(0.0, 0.42, abs(dot(normalize(vNormal), normalize(vViewPosition))));\n' : ''}#include <alphahash_fragment>`)
      .replace('#include <opaque_fragment>', `${SKIN}\n#include <opaque_fragment>`)}`;
  };
  material.customProgramCacheKey = () => `${key}|skin${solid ? 1 : 0}`;
  material.userData.softSkin = true;
  return material;
}
// gives a geometry a second set of normals, softNormal: at each corner, the average of the faces that meet there
export function smoothNormals(geo) {
  if (geo.attributes.softNormal) return geo;
  const g = geo.index ? null : geo, pos = geo.attributes.position, n = pos.count, sum = new Map(), out = new Float32Array(n * 3);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), key = (i) => `${Math.round(pos.getX(i) * 1e3)},${Math.round(pos.getY(i) * 1e3)},${Math.round(pos.getZ(i) * 1e3)}`;
  const tri = (i, j, k) => { a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, j).sub(a); c.fromBufferAttribute(pos, k).sub(a); b.cross(c); // (left unnormalised: a bigger face counts for more)
    for (const v of [i, j, k]) { const id = key(v), s = sum.get(id); if (s) s.add(b); else sum.set(id, b.clone()); } };
  if (g) for (let i = 0; i + 2 < n; i += 3) tri(i, i + 1, i + 2); else for (let i = 0; i + 2 < geo.index.count; i += 3) tri(geo.index.getX(i), geo.index.getX(i + 1), geo.index.getX(i + 2));
  for (let i = 0; i < n; i++) { const s = sum.get(key(i)); if (s && s.lengthSq() > 0) { a.copy(s).normalize(); out[i * 3] = a.x; out[i * 3 + 1] = a.y; out[i * 3 + 2] = a.z; } }
  geo.setAttribute('softNormal', new THREE.BufferAttribute(out, 3));
  return geo;
}
