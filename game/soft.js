// The soft look: a creature drawn as light instead of triangles. On trial, and so far only the tail-biter has one.
//
// A soft creature has no model. Its shape is a formula (round forms melted into each other), and every pixel it
// covers works out where that shape is and what colour it shows there: dark where the form faces you, a coloured
// rim at its edges, fins that thin into the water, a light held in the chest. It wears the same palette as the
// low-poly creature, beats its tail by the same numbers, sits in the same fog and takes the light of its band.
//
// A component in npc.js asks for it with `soft: { shape, … }`; npc.js's make() builds whichever look is chosen.
// What is drawn is a plain box round the creature. The shape inside is found by the fragment shader below.

import * as THREE from 'three';

// ---------------------------------------------------------------- shapes
// A shape is written in "fish units": the animal faces +x, y is up, z is its width. unit and offset fit it to the
// low-poly model it stands in for (which faces +z, in metres): metres = fish units × unit, slid along by offset.
// Its GLSL gives: parts() (distance to body, jaw, eye, teeth, fins), map() (all of them, melted together),
// albedo() (the colour of the nearest part) and where its inner light (EMBER) and its eye (EYE) are.
const BITER = /* glsl */`
const vec3 EYE = vec3(.86, .15, .205);
const vec3 JAW = vec3(1.03, -.285, 0.);
const vec3 EMBER = vec3(.22, -.06, 0.);

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
  float wE = exp(-(dE - m) * 90.), wT = exp(-(dT - m) * 90.);
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

// palette: which of the component's colours each of the shader's takes
export const SHAPES = {
  biter: { glsl: BITER, unit: 0.33, offset: 0.021, box: [[-2.3, -1.3, -0.85], [1.7, 1.6, 0.85]],
    palette: { cBack: 'back', cFlank: 'flank', cBar: 'bar', cBelly: 'belly', cFin: 'fins', cFinDark: 'finDark', cJaw: 'jaw', cEye: 'eye' } },
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
uniform float uSoft, uHalo, uRim, uEmber, uEye, uGrain;
uniform vec3 cBack, cFlank, cBar, cBelly, cFin, cFinDark, cJaw, cEye, cRim;
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

  vec3 p = ro + rd * (hit ? t : tMin);
  vec4 view = modelViewMatrix * vec4(vec3(p.z, p.y, p.x) * uFit.x + vec3(0., 0., uFit.y), 1.);
  vec3 day = clamp(sceneLight(view.xyz), 0., 1.);
  float dayS = max(day.r, max(day.g, day.b)), own = mix(.32, 1., dayS);   // own: how much of its glow it keeps in the dark

  vec4 M; vec3 alb = albedo(p, M);
  float lit = (1. - M.x) * (1. - M.y);
  vec3 glow = mix((alb * 1.12 + cRim * .22) * own, alb, 1. - lit);
  vec3 col; float a;
  if(hit){
    vec3 n = normalAt(p);
    float fac = clamp(dot(n, -rd), 0., 1.), fres = pow(1. - fac, 2.2);
    float key = dot(n, normalize(vKey)) * .5 + .5; key *= key;
    float sky = dot(n, normalize(vUp)) * .5 + .5;
    float thin = 1. - smoothstep(0., .9, clamp(-map(p + rd * .15) / .15, 0., 1.));

    vec3 c = mix(alb * vec3(.40, .44, .74) * .80, alb * 1.14, key);   // shadows lean cool
    c += alb * cRim * .30 * sky;
    c += cFin * .16 * (1. - sky) * (1. - sky) * lit;                  // fin colour bounces up from below
    c *= 1. - .30 * uRim * fac * fac * lit;                           // a deep core where the form faces you
    c *= mix(vec3(.16), vec3(1.), day);                               // the light of the band it is in
    c = mix(c, cRim * own, fres * uRim * .85 * lit);                  // a coloured rim
    c = mix(c, (alb * 1.32 + cRim * .10) * own, thin * .55 * lit);    // thin parts read as lit from behind
    c = mix(c, alb * (1. + .35 * uEye), M.x);                         // the eye gives its own light
    c = mix(c, alb * own, M.y * .75);
    col = mix(glow, c, smoothstep(0., max(uSoft, .002), fac));        // the edge goes out of focus
    a = 1. - M.z * M.w * .30;                                         // fin tips thin out into the water
  } else {
    col = glow;
    a = exp(-max(minD, 0.) / max(uHalo, .0015)) * (1. - M.z * M.w * .30);
  }

  // a light held inside the chest
  float de = length(cross(rd, EMBER - ro));
  float ember = exp(-de * de / .105) * uEmber * a;
  col = 1. - (1. - col) * (1. - cFin * ember * .85 - cRim * ember * .15);

  // the eye's bloom, on the side that faces you
  vec3 bloom = vec3(0.);
  for(int i = 0; i < 2; i++){
    float sgn = i == 0 ? 1. : -1.;
    vec3 ec = vec3(EYE.x + .02, EYE.y, sgn * (EYE.z + .06));
    float vis = smoothstep(-.15, .45, dot(normalize(vec3(.22, .05, sgn)), normalize(ro - ec)));
    float dr = length(cross(rd, ec - ro));
    float g = (exp(-dr * dr / .020) * .55 + exp(-dr / .30) * .16) * uEye * vis;
    bloom += cEye * g; a = clamp(a + g * .55, 0., 1.);
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

// soft: the component's soft look ({ shape, rim, edge, halo, rimLight, inner, eyeGlow, grain }); palette: its colours
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
    cRim: { value: shown(soft.rim) },
    ...Object.fromEntries(Object.entries(shape.palette).map(([name, key]) => [name, { value: shown(palette[key]) }])),
  }]);
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG(shape), lights: true, fog: true,
    transparent: true, premultipliedAlpha: true, depthWrite: false, side: THREE.BackSide }); // the back of the box, so it is still drawn with the eye inside it
  material.userData.swim = uniforms.uSwim; material.userData.glow = { value: 1 };
  return { mesh: new THREE.Mesh(boxOf(soft.shape), material), material };
}
