// The front page: the old plate the game's look comes from, come alive, before the first dive.
//
// Warm paper, the plate's lettering, and the game's own oarfish laid in the plate's S and drawn as if printed: flat tones in the
// plate's colours, a stipple of spots, a fine line round everything, edges that wander a little as a lithograph's do, paper grain
// through the ink. Under the caption, five items set as the plate's lettering: Dive, the specimen library, the band, settings and
// keys, feedback. The page opens silent; the first touch (a key, a click, a tap, a button on a controller) inks the menu in and
// starts its music, a long version built only from slices of one bass track (title/music; how it was cut: title-music-map.md).
//
// What it costs the dive: the dive is built behind it (index.html boots the game at once, so "Dive" has nothing to wait for), and
// nothing of the dive is stepped or drawn while this page is up: main.js holds its loop (`window.__front.holds`, one block there).
// This page draws only its own picture, at most thirty times a second, and nothing at all once it has been left alone for
// FRONT.idle seconds, or when the motion is turned down in the system, or while the tab is hidden.
//
// When it shows (decided in index.html, before anything is drawn): on opening the page. Not for a link that names a place
// (#library…), not for a page brought back by the viewer with a dive in it, not for a page a test drives (navigator.webdriver,
// the same signal the idle show uses); ?title=1 and ?title=0 force it on or off. A way back to it is put into the pause menu
// and onto the end card.
import * as THREE from 'three';
import { buildOarfish, PALETTE } from './oarfish.js';
import { OarfishRig, SPEED } from './rig.js';

// ---------------------------------------------------------------- every number of the page
export const FRONT = {
  bones: 32, // the fish is long, as on the plate: the plate's body is about 26 times as long as it is deep
  crest: 1.15, // the crest against the model's own (CREST in oarfish.js)
  // The S. Three runs one above and behind the other, joined by two turns. The page is drawn in an oblique projection, as old
  // plates were: a flank is seen square on, and what is farther back is drawn higher by `k` of its depth.
  s: { k: 0.5, lift: 0.22, R: 0.4, runs: [7.4, 6.3, 6.5] }, // lift and R in metres (the body is 0.4 m deep at the neck); runs: the plate's own proportions
  breathe: { rate: 0.16, wave: 0.55, curl: 0.035 }, // how fast the body's slow wave goes (beats a second), how big against an idle swim, how much the S swells
  fps: 30, idle: 90, // at most this many frames a second; nothing drawn after this many seconds untouched
  colours: { paper: '#f3eedb', ink: '#3b3026', water: '#1d5a68', deep: '#c94d5d', line: '#4a3a30' },
  tones: { // the fish in the plate's colours, not the game's: the game keeps its own (oarfish.js PALETTE) for the dive
    Body: '#b49a79', BodyTop: '#a68b6c', Belly: '#c9bfae', Spots: '#98805f', Face: '#9a958f', Gill: '#b9aea3', Jaw: '#7f766f', Mouth: '#5b3b3a',
    FinPale: '#efc4bd', FinPink: '#e9b6b1', FinMid: '#e4aba8', FinRed: '#d98e93', EyeRing: '#3f3429', Eye: '#e3c13a', Pupil: '#241c16',
  },
  bands: [0.3, 0.47, 0.63, 0.8], // where the dorsal fin runs deeper pink, along the body (0 the neck, 1 the tail), as on the plate
  dive: { wash: 0.95, straighten: 0.85, swim: 1.5, release: 1.3, reveal: 0.55, skip: 0.22 }, // seconds: the event of diving in
  back: { fade: 0.6 }, // coming back to the page from a dive
  music: {
    // Both versions are built only from the one track (title-music-map.md). `period` is the loop's length in samples at 44.1 kHz;
    // `first` is where its first sound crosses 0.01 in the left channel, which finds the loop in the decoded sound whatever the
    // browser's decoder puts in front of it.
    long: { src: 'title/music/title-long.m4a', period: 5359208, first: 40015 },
    loop: { src: 'title/music/title-loop.m4a', period: 914987, first: 1803 },
    gain: 0.75, fadeIn: 1.6, fadeOut: 1.4,
  },
};

const store = { get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } } };
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const lin = (hex) => new THREE.Color(hex); // sRGB hex to the renderer's working colours
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// ---------------------------------------------------------------- the page's own stylesheet
const CSS = `
@font-face { font-family: "Front Fell"; src: url(title/fonts/fell.woff2) format("woff2"); font-style: normal; font-display: block; }
@font-face { font-family: "Front Fell"; src: url(title/fonts/fell-italic.woff2) format("woff2"); font-style: italic; font-display: block; }
@font-face { font-family: "Front Fell SC"; src: url(title/fonts/fell-sc.woff2) format("woff2"); font-display: block; }
html.front, html.front body { background: ${FRONT.colours.paper}; }
#front { --lozenge: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 6 7'%3E%3Cpath d='M3 0L6 3.5L3 7L0 3.5Z' fill='%233b3026'/%3E%3C/svg%3E"); position: fixed; inset: 0; z-index: 7; overflow: hidden; color: ${FRONT.colours.ink}; background: ${FRONT.colours.paper}; font: 400 16px/1.3 "Front Fell", Georgia, serif; -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none; touch-action: manipulation; }
#front[hidden] { display: none; }
#front canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
#front .sheet { position: absolute; inset: 0; display: grid; padding: clamp(12px, 2.6vh, 30px) clamp(14px, 3.4vw, 54px) clamp(10px, 2vh, 22px);
  grid-template: "head" auto "pic" minmax(0, 1fr) "credit" auto "caption" auto "menu" minmax(4.2em, auto) / minmax(0, 1fr); row-gap: clamp(4px, 1vh, 10px); }
#front .head { grid-area: head; display: grid; grid-template-columns: 1fr auto 1fr; align-items: baseline; gap: 12px; }
#front .book { font: 400 clamp(11px, 1.15vw, 16px)/1 "Front Fell SC", serif; letter-spacing: 0.24em; margin: 0; }
#front .name { margin: 0; text-align: center; font: 400 clamp(17px, 2.1vw, 30px)/1 "Front Fell SC", serif; letter-spacing: 0.34em; padding-left: 0.34em; display: flex; align-items: center; gap: 0.7em; }
#front .name::before, #front .name::after { content: ""; width: clamp(18px, 4vw, 64px); height: 1px; background: currentColor; opacity: 0.55; }
#front .class { margin: 0; justify-self: end; font: italic 400 clamp(13px, 1.4vw, 20px)/1 "Front Fell", serif; display: flex; gap: 2.4em; align-items: baseline; }
#front .class span { font-style: normal; font-size: 0.8em; letter-spacing: 0.06em; }
#front .pic { grid-area: pic; min-height: 0; }
#front .credit { grid-area: credit; margin: 0; font: italic 400 clamp(10px, 0.9vw, 13px)/1.2 "Front Fell", serif; opacity: 0.85; padding-left: 4%; }
#front .caption { grid-area: caption; margin: 0; text-align: center; font-weight: 400; text-wrap: balance; }
#front .caption b { font: italic 400 clamp(15px, 1.75vw, 25px)/1.15 "Front Fell", serif; letter-spacing: 0.1em; text-transform: uppercase; font-size: clamp(13px, 1.45vw, 21px); }
#front .caption i { font: italic 400 clamp(14px, 1.6vw, 23px)/1.15 "Front Fell", serif; margin-left: 0.5em; white-space: nowrap; }
#front .caption i span { font-size: 0.86em; }
#front .foot { grid-area: menu; position: relative; display: grid; place-items: center; }
#front .invite { margin: 0; font: italic 400 clamp(14px, 1.45vw, 20px)/1.2 "Front Fell", serif; opacity: 0.78; transition: opacity 0.5s; }
#front .invite::before, #front .invite::after { content: "\\2009\\2014\\2009"; opacity: 0.6; }
#front.awake .invite { opacity: 0; pointer-events: none; }
#front .foot > * { grid-area: 1 / 1; }
#front .menu { display: flex; align-items: baseline; justify-content: center; flex-wrap: wrap; gap: 0.2em clamp(10px, 2.1vw, 34px); visibility: hidden; align-content: center; }
#front.awake .menu { visibility: visible; }
#front .menu button { all: unset; box-sizing: border-box; cursor: pointer; position: relative; padding: 0.32em 0.15em 0.42em; font: 400 clamp(12px, 1.15vw, 16px)/1 "Front Fell SC", serif; letter-spacing: 0.2em; color: inherit;
  clip-path: inset(-20% 100% -20% 0); opacity: 0; transition: clip-path 0.75s cubic-bezier(.3,.1,.2,1), opacity 0.5s; touch-action: manipulation; }
#front .menu button.dive { font: italic 400 clamp(22px, 2.4vw, 36px)/1 "Front Fell", serif; letter-spacing: 0.04em; padding: 0.12em 0.35em 0.3em; }
#front.awake .menu button { clip-path: inset(-20% -12% -20% -12%); opacity: 1; }
#front .menu .sep { font-size: 10px; opacity: 0; transition: opacity 0.6s 0.6s; }
#front.awake .menu .sep { opacity: 0.5; }
/* the focus: an engraver's rule drawn under the word, with a lozenge at each end */
#front .menu button::after { content: ""; position: absolute; left: 0.05em; right: 0.2em; bottom: 0.08em; height: 1px; background: currentColor; transform: scaleX(0); transition: transform 0.28s cubic-bezier(.3,.1,.2,1); }
#front .menu button::before { content: ""; position: absolute; left: -0.6em; right: -0.45em; bottom: calc(0.08em - 2.5px); height: 6px; opacity: 0; transition: opacity 0.2s;
  background: var(--lozenge) left center / 6px 7px no-repeat, var(--lozenge) right center / 6px 7px no-repeat; }
#front .menu button.dive::after { bottom: 0.12em; }
#front .menu button.dive::before { bottom: calc(0.12em - 2.5px); }
#front .menu button.cur::after, #front .menu button:hover::after { transform: scaleX(1); }
#front .menu button.cur::before { opacity: 0.9; }
#front .menu button:focus-visible { outline: none; }
#front .menu button.wait { opacity: 0.55; }
#front .ink { filter: url(#front-ink); }
#front .alt { display: none; }
#front.alt-name .alt { display: block; position: absolute; left: 0; right: 0; top: 30%; text-align: center; font: italic 400 clamp(60px, 9vw, 150px)/1 "Front Fell", serif; letter-spacing: 0.01em; pointer-events: none; }
#front.alt-name .name { visibility: hidden; }
#front .veil { position: absolute; inset: 0; pointer-events: none; }
/* a phone held upright: the S above, the menu as a list */
@media (max-aspect-ratio: 3/4) {
  #front .sheet { grid-template: "head" auto "pic" minmax(0, 0.9fr) "credit" auto "caption" auto "menu" minmax(0, 1.1fr) / minmax(0, 1fr); }
  #front .head { grid-template-columns: 1fr 1fr; grid-template-areas: "name name" "book class"; row-gap: 14px; }
  #front .name { grid-area: name; justify-content: center; font-size: clamp(18px, 5.6vw, 28px); }
  #front .book { grid-area: book; font-size: 11px; } #front .class { grid-area: class; font-size: 14px; }
  #front .menu { flex-direction: column; align-items: center; flex-wrap: nowrap; gap: 0.15em; }
  #front .menu .sep { display: none; }
  #front .menu button { font-size: 15px; padding: 0.55em 0.4em 0.6em; }
  #front .menu button.dive { font-size: 32px; padding: 0.15em 0.4em 0.3em; }
  #front .credit { text-align: center; padding: 0; }
  #front .caption i { display: block; margin: 0.2em 0 0; }
}
/* a phone on its side, or any short window: the picture and its caption at the left, the menu as a column at the right */
@media (max-height: 520px) and (min-aspect-ratio: 4/3) {
  #front .sheet { grid-template: "head head" auto "pic menu" minmax(0, 1fr) "credit menu" auto "caption menu" auto / minmax(0, 1fr) minmax(150px, 26%); column-gap: 18px; row-gap: 4px; }
  #front .menu { flex-direction: column; align-items: flex-start; flex-wrap: nowrap; gap: 0.1em; }
  #front .foot { place-items: center start; }
  #front .invite { text-align: left; font-size: 14px; }
  #front .menu .sep { display: none; }
  #front .menu button { font-size: 13px; padding: 0.5em 0.2em 0.55em; }
  #front .menu button.dive { font-size: 28px; }
  #front .caption b { font-size: 12px; } #front .caption i { font-size: 13px; }
}
/* the game's own screens, opened from this page, are laid over it */
html.front-over #pause { z-index: 8; }
html.front-over #drawer { z-index: 9; }
@media (prefers-reduced-motion: reduce) { #front .menu button, #front .invite, #front .menu button::after { transition: none; } }
`;

const MARKUP = `
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="front-ink" x="-2%" y="-20%" width="104%" height="140%">
  <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n"/>
  <feDisplacementMap in="SourceGraphic" in2="n" scale="1.1" xChannelSelector="R" yChannelSelector="G"/>
</filter></svg>
<canvas aria-hidden="true"></canvas>
<div class="sheet">
  <div class="head ink"><p class="book">Règne animal.</p><h1 class="name" aria-label="Oarfish dive">Oarfish dive</h1><p class="class">Poissons. <span>Pl. 69</span></p></div>
  <div class="pic" aria-hidden="true"></div>
  <p class="credit ink">after the plate drawn by Acarie Baron for Cuvier’s Règne animal</p>
  <p class="caption ink"><b>Le Gymnètre épée.</b><i>(Gymnetrus gladius. <span>Cuv. Val.</span>)</i></p>
  <div class="foot">
    <p class="invite ink" role="status">Press any key, or touch the page</p>
    <nav class="menu ink" aria-label="Oarfish dive">
      <button type="button" class="dive" data-go="dive">Dive</button><span class="sep" aria-hidden="true">◆</span>
      <button type="button" data-go="library">Specimen library</button><span class="sep" aria-hidden="true">◆</span>
      <button type="button" data-go="band">The band</button><span class="sep" aria-hidden="true">◆</span>
      <button type="button" data-go="settings">Settings and keys</button><span class="sep" aria-hidden="true">◆</span>
      <button type="button" data-go="feedback">Feedback</button>
    </nav>
  </div>
</div>
<p class="alt ink" aria-hidden="true">Oarfish dive</p>
<div class="veil"></div>`;

// ---------------------------------------------------------------- the fish, printed
// One material per colour of the model, flat. Each face takes one of three tones by how it faces the light (a lithograph is
// printed from a few stones, not shaded), the body is stippled with dark spots fixed to the body, the dorsal fin runs deeper
// pink in four bands, and the fins move in the vertex shader: the dorsal fin ripples down its length, the crest's rays stir.
function printMaterial(name, colour, shared) {
  const fin = /^Fin/.test(name), body = /^(Body|BodyTop|Belly|Spots)$/.test(name);
  const m = new THREE.MeshBasicMaterial({ color: lin(colour), side: fin ? THREE.DoubleSide : THREE.FrontSide });
  m.name = name;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, shared);
    sh.defines = { ...(sh.defines || {}), ...(fin ? { FIN: '' } : {}), ...(body ? { BODY: '' } : {}) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aFin; varying vec3 vRest; varying vec3 vView; uniform float uTime; uniform float uStir;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vRest = position;
        #ifdef FIN
          float fh = aFin;
          if (position.z > 0.02) { // the crest's rays stir, each a little out of step
            float ph = uTime * 0.9 + position.x * 9.0 + position.z * 6.0;
            transformed.z += fh * 0.13 * sin(ph) * uStir;
            transformed.x += fh * 0.10 * sin(uTime * 0.63 + position.z * 11.0) * uStir;
          } else { // the dorsal fin: a wave running down its length
            float w = uTime * 2.1 + position.z * 2.4;
            transformed.x += fh * 0.6 * sin(w) * uStir;
            transformed.y += fh * 0.07 * sin(w + 1.2) * uStir;
          }
        #endif`)
      .replace('#include <project_vertex>', '#include <project_vertex>\nvView = mvPosition.xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vRest; varying vec3 vView; uniform float uLen; uniform vec3 uDeep; uniform vec4 uBands;
        float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float stip(vec2 q) { vec2 c = floor(q), f = fract(q); float d = 9.0; float r = 0.0;
          for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) { vec2 o = vec2(i, j); float h = h21(c + o); vec2 p = o + vec2(h, h21(c + o + 7.3)) * 0.8 + 0.1 - f;
            float rr = mix(0.13, 0.3, h21(c + o + 3.1)); float dd = length(p * vec2(1.0, 1.25)) - rr; if (dd < d) d = dd; }
          return 1.0 - smoothstep(-0.03, 0.03, d); }`)
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', `
        vec3 base = diffuse;
        vec3 n = normalize(cross(dFdx(vView), dFdy(vView)));
        float l = dot(n, normalize(vec3(-0.35, 0.82, 0.45)));
        float tone = l > 0.45 ? 1.05 : (l > -0.1 ? 0.97 : 0.88);
        #ifdef FIN
          float u = -vRest.z / uLen;
          float band = 0.0;
          for (int i = 0; i < 4; i++) { float c = uBands[i]; band = max(band, smoothstep(0.075, 0.0, abs(u - c)) * (i == 3 ? 0.6 : 1.0)); }
          base = mix(base, uDeep, band * 0.72 * step(vRest.z, 0.02));
          float ray = smoothstep(0.32, 0.47, abs(fract(vRest.z * 24.0) - 0.5)) * step(vRest.z, 0.02) * smoothstep(0.0, 0.03, vRest.y);
          base *= 1.0 - 0.13 * ray; // the fin's rays, as the plate hatches them
          tone = 1.0;
        #endif
        #ifdef BODY
          float top = smoothstep(-0.05, 0.12, vRest.y);
          float s = stip(vec2(vRest.z * 52.0, vRest.y * 52.0 + vRest.x * 7.0));
          float s2 = stip(vec2(vRest.z * 83.0 + 3.7, vRest.y * 83.0 + 1.3));
          base *= 1.0 - (s * mix(0.14, 0.26, top) + s2 * mix(0.06, 0.16, top));
        #endif
        vec4 diffuseColor = vec4(base * tone, opacity);`);
  };
  m.customProgramCacheKey = () => `front-${fin ? 'fin' : body ? 'body' : 'flat'}`;
  return m;
}

// fin height over the body, for every corner of the model: how far up a fin each corner is, which is how far it waves
function finHeights(mesh) {
  const g = mesh.geometry, pos = g.attributes.position, n = pos.count, mats = mesh.material;
  const out = new Float32Array(n), top = new Map(), BIN = 0.05, key = (z) => Math.round(z / BIN);
  const matOf = new Array(n);
  for (const gr of g.groups) for (let i = gr.start; i < gr.start + gr.count; i++) matOf[i] = mats[gr.materialIndex].name;
  for (let i = 0; i < n; i++) if (/^(Body|BodyTop|Spots)$/.test(matOf[i])) { const k = key(pos.getZ(i)); top.set(k, Math.max(top.get(k) ?? -9, pos.getY(i))); }
  const topAt = (z) => { for (let d = 0; d < 6; d++) { const a = top.get(key(z) - d), b = top.get(key(z) + d); if (a !== undefined || b !== undefined) return Math.max(a ?? -9, b ?? -9); } return 0; };
  for (let i = 0; i < n; i++) if (/^Fin/.test(matOf[i])) out[i] = Math.max(0, pos.getY(i) - topAt(pos.getZ(i)));
  g.setAttribute('aFin', new THREE.BufferAttribute(out, 1));
}

// ---------------------------------------------------------------- the S
// Points along the body's path from the neck backwards, as the rig wants them (rig.js samples a trail 0.06 m apart).
const DS = 0.06;
function sPath(length, swell = 0) {
  const { lift, R, runs } = FRONT.s, k = 1 + swell;
  const rho = Math.hypot(lift / 2, R) * k, turn = Math.PI * rho;
  const free = Math.max(1, length - 2 * turn), sum = runs[0] + runs[1] + runs[2];
  const a = free * runs[0] / sum, b = free * runs[1] / sum;
  // run 1 from the neck to the right, turn up and back, run 2 to the left, turn up and back, run 3 to the right
  const P = (s) => {
    const r0y = -lift / 2 * k, r0z = R * k; // from a turn's centre to its start
    if (s <= a) return [s, 0, 0];
    s -= a;
    if (s <= turn) { const t = s / rho; return [a + Math.sin(t) * rho, -r0y + Math.cos(t) * r0y, -r0z + Math.cos(t) * r0z]; }
    s -= turn; const y1 = -2 * r0y, z1 = -2 * r0z;
    if (s <= b) return [a - s, y1, z1];
    s -= b;
    if (s <= turn) { const t = s / rho; return [a - b - Math.sin(t) * rho, y1 - r0y + Math.cos(t) * r0y, z1 - r0z + Math.cos(t) * r0z]; }
    s -= turn;
    return [a - b + s, 2 * y1, 2 * z1];
  };
  return { P, a, b, turn };
}

// ---------------------------------------------------------------- the paper and the press: two passes over the whole screen
const QUAD_V = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const NOISE = `
  float hash(vec2 p) { p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
  float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
  float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }`;
// the paper, made once per size: its tone, fibres, a little foxing and the edge of an old sheet; alpha holds the fine grain
const PAPER_F = `${NOISE}
  uniform vec2 uCss; uniform float uPx; uniform vec3 uPaper; varying vec2 vUv;
  void main() {
    vec2 p = vUv * uCss;
    float big = fbm(p * 0.0035), mid = fbm(p * 0.02 + 3.0), fib = vnoise(vec2(p.x * 0.55, p.y * 0.035) + 9.0) * vnoise(vec2(p.x * 0.04, p.y * 0.7) + 2.0);
    vec3 c = uPaper * (1.0 + 0.035 * (big - 0.5) * 2.0 - 0.018 * (mid - 0.5) * 2.0 - 0.03 * smoothstep(0.55, 0.95, fib));
    float fox = smoothstep(0.7, 0.78, fbm(p * 0.006 + 41.0)) * 0.6 + smoothstep(0.86, 0.9, vnoise(p * 0.09 + 5.0)) * 0.25;
    c = mix(c, c * vec3(0.93, 0.85, 0.74), fox * 0.22);
    vec2 e = min(vUv, 1.0 - vUv) * uCss; float edge = smoothstep(0.0, 60.0, min(e.x, e.y));
    c *= mix(0.955, 1.0, edge);
    float grain = hash(floor(gl_FragCoord.xy / max(1.0, uPx * 0.75))) * 0.6 + vnoise(p * 0.7) * 0.4;
    gl_FragColor = vec4(c, grain);
  }`;
// the press: the fish's layer laid on the paper as ink, with a fine line round its colours, and the water's wash for diving in
const PRESS_F = `${NOISE}
  uniform sampler2D tPaper, tFish; uniform vec2 uCss, uTexel; uniform float uPx, uWash, uTime, uInk;
  uniform vec3 uLine, uWater, uPaper; uniform vec2 uFrom; varying vec2 vUv;
  vec4 fish(vec2 uv) { vec4 f = texture2D(tFish, uv); return f; }
  void main() {
    vec2 p = vUv * uCss;
    vec4 paper = texture2D(tPaper, vUv);
    vec2 wob = (vec2(vnoise(p * 0.045), vnoise(p * 0.045 + 31.0)) - 0.5) * 1.5 * uTexel * uPx; // the wandering edge of a lithograph
    vec2 uv = vUv + wob;
    vec4 f = fish(uv);
    vec2 d = uTexel * uPx * 0.9;
    vec4 l = fish(uv - vec2(d.x, 0.0)), r = fish(uv + vec2(d.x, 0.0)), dn = fish(uv - vec2(0.0, d.y)), up = fish(uv + vec2(0.0, d.y));
    float ea = abs(r.a - l.a) + abs(up.a - dn.a);
    vec3 cl = l.rgb / max(l.a, 1e-3), cr = r.rgb / max(r.a, 1e-3), cd = dn.rgb / max(dn.a, 1e-3), cu = up.rgb / max(up.a, 1e-3);
    float ec = (length(cr - cl) + length(cu - cd)) * min(min(l.a, r.a), min(dn.a, up.a));
    float line = clamp(ea * 0.9 + smoothstep(0.05, 0.22, ec) * 0.55, 0.0, 1.0);
    float a = max(max(f.a, l.a), max(r.a, max(dn.a, up.a)));
    vec3 ink = (f.rgb + l.rgb + r.rgb + dn.rgb + up.rgb) / max(f.a + l.a + r.a + dn.a + up.a, 1e-3);
    float stone = 0.94 + 0.06 * fbm(p * 0.09 + 5.0); // the stone's own texture in a flat tone
    float cover = f.a * uInk * (0.9 + 0.1 * paper.a);
    vec3 grainy = paper.rgb / uPaper; // the paper's own grain and tone, under whatever is laid on it
    vec3 ground = paper.rgb;
    // the water's wash, for diving in: it soaks into the paper from the edges inward, with a ragged wet front, under the fish
    if (uWash > 0.0) {
      vec2 q = vUv - 0.5; q.x *= uCss.x / uCss.y;
      float r0 = length(q) / length(vec2(0.5 * uCss.x / uCss.y, 0.5)) + (fbm(p * 0.006 + 3.0) - 0.5) * 0.45;
      float th = (1.0 - uWash) * 1.3;
      float wet = smoothstep(th - 0.06, th + 0.01, r0);
      vec3 water = uWater * (0.93 + 0.07 * paper.a + 0.08 * (fbm(p * 0.01 + uTime * 0.05) - 0.5));
      float edge = smoothstep(0.0, 0.05, abs(r0 - th)) ; // the wet front is a shade darker, as wet paper is
      ground = mix(ground, water, wet) * mix(0.9, 1.0, edge * 0.7 + 0.3 * (1.0 - wet));
    }
    vec3 col = mix(ground, ink * stone * grainy, cover);
    col = mix(col, mix(uLine, ink * 0.45, 0.45) * grainy, line * a * 0.75 * uInk);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`;

// ---------------------------------------------------------------- the page
export async function openFront({ boot }) {
  const F = window.__front = { holds: true, over: false, state: 'silent', frames: 0, ready: false, gameReady: null, music: null, touched: false, alt: false };
  const style = document.createElement('style'); style.id = 'front-style'; style.textContent = CSS; document.head.append(style);
  const root = document.createElement('div'); root.id = 'front'; root.innerHTML = MARKUP; document.body.append(root);
  document.documentElement.classList.add('front');
  const $ = (s) => root.querySelector(s);
  const canvas = $('canvas'), menu = [...root.querySelectorAll('.menu button')];
  if (new URLSearchParams(location.search).get('name') === 'large') { root.classList.add('alt-name'); F.alt = true; } // the placing of the name that was not chosen (for the sheet)

  // ---- the renderer, its scene and its two passes
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'low-power' });
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -50, 50);
  const shared = { uTime: { value: 0 }, uStir: { value: 1 }, uLen: { value: 1 }, uDeep: { value: lin(FRONT.colours.deep) }, uBands: { value: new THREE.Vector4(...FRONT.bands) } };
  const mats = {};
  for (const [name, c] of Object.entries(PALETTE)) mats[name] = printMaterial(name, FRONT.tones[name] || c, shared);
  const built = buildOarfish({ bones: FRONT.bones, materials: mats, merge: false, clip: false, crest: FRONT.crest });
  const mesh = built.mesh; mesh.frustumCulled = false;
  finHeights(mesh);
  scene.add(built.group);
  const rig = new OarfishRig(); rig.attach(built.group);
  shared.uLen.value = rig.length;
  const fishRT = new THREE.WebGLRenderTarget(4, 4, { samples: 4 });
  const paperRT = new THREE.WebGLRenderTarget(4, 4);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); quad.frustumCulled = false;
  const flat = new THREE.Scene(); flat.add(quad); const flatCam = new THREE.Camera();
  const paperMat = new THREE.ShaderMaterial({ vertexShader: QUAD_V, fragmentShader: PAPER_F, uniforms: { uCss: { value: new THREE.Vector2() }, uPx: { value: 1 }, uPaper: { value: lin(FRONT.colours.paper) } } });
  const press = new THREE.ShaderMaterial({ vertexShader: QUAD_V, fragmentShader: PRESS_F, uniforms: {
    tPaper: { value: paperRT.texture }, tFish: { value: fishRT.texture }, uCss: { value: new THREE.Vector2() }, uTexel: { value: new THREE.Vector2() }, uPx: { value: 1 },
    uWash: { value: 0 }, uTime: { value: 0 }, uInk: { value: 1 }, uLine: { value: lin(FRONT.colours.line) }, uWater: { value: lin(FRONT.colours.water) }, uPaper: { value: lin(FRONT.colours.paper) }, uFrom: { value: new THREE.Vector2(0.5, 0.5) } } });

  // ---- where the fish lies, and the oblique projection that draws the plate
  const S = { swell: 0, straight: 0, off: 0, phase: 0, t: 0 };
  const path = { pts: [] };
  const trail = Array.from({ length: Math.ceil((rig.length + 1.5) / DS) + 2 }, () => ({ p: new THREE.Vector3(), roll: 0 }));
  function lay() {
    const { P } = sPath(rig.length + 0.6, S.swell);
    const st = ease(S.straight);
    const head = P(0), at = (s, out) => { const q = P(s); const x = q[0] * (1 - st) + s * st, y = q[1] * (1 - st), z = q[2] * (1 - st); return out.set(x - S.off, y, z); };
    at(0, rig.pos); rig.forward.set(-1, 0, 0);
    for (let i = 0; i < trail.length; i++) at((i + 1) * DS, trail[i].p);
    rig.trail = trail;
    void head;
  }
  rig.speed = SPEED.idle * FRONT.breathe.wave; rig.coiling = 0.4; rig.headYaw = 0; rig.gape = 0.04;
  lay(); rig._pose(1e-3, null);
  for (const f of rig.filaments) f.joints.forEach((j, i) => j.copy(f.rest[i]).applyQuaternion(rig._w0).add(rig.pos)); // the long ray starts where it hangs (as rig.reset does)
  for (let i = 0; i < 40; i++) rig._pose(1 / 30, null); // and settles before the first picture
  const shear = new THREE.Matrix4(), ortho = new THREE.Matrix4();
  const k = FRONT.s.k;
  shear.set(1, 0, 0, 0, 0, 1, -k, 0, 0, k, 1, 0, 0, 0, 0, 1); // in the camera's frame: what is farther back is drawn higher, the depth kept for what hides what
  camera.position.set(0, 0, 0); camera.updateMatrixWorld();
  const box = { x0: 0, x1: 1, y0: 0, y1: 1 };
  function measure() { // the picture's extent in the plate's projection, from the model as it lies
    built.group.updateMatrixWorld(true); mesh.skeleton.update();
    const v = new THREE.Vector3(); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    const n = mesh.geometry.attributes.position.count;
    for (let i = 0; i < n; i += 2) { mesh.getVertexPosition(i, v); v.applyMatrix4(mesh.matrixWorld); const X = v.x, Y = v.y - k * v.z; if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y; }
    Object.assign(box, { x0, x1, y0, y1 });
  }
  measure();
  const view = { W: 1, H: 1, px: 1, s: 1 };
  function frame() { // fit the plate's picture into the box the page's layout leaves for it
    const W = innerWidth, H = innerHeight, px = Math.min(devicePixelRatio || 1, 2);
    const r = $('.pic').getBoundingClientRect();
    const bw = box.x1 - box.x0, bh = box.y1 - box.y0;
    const s = Math.min(r.width / (bw * 1.04), r.height / (bh * 1.04));
    const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
    const left = cx - (r.left + r.width / 2) / s, top = cy + (r.top + r.height / 2) / s;
    ortho.makeOrthographic(left, left + W / s, top, top - H / s, -50, 50);
    camera.projectionMatrix.copy(ortho).multiply(shear); camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    if (view.W !== W || view.H !== H || view.px !== px) {
      renderer.setPixelRatio(px); renderer.setSize(W, H, false);
      fishRT.setSize(Math.round(W * px), Math.round(H * px)); paperRT.setSize(Math.round(W * px), Math.round(H * px));
      paperMat.uniforms.uCss.value.set(W, H); paperMat.uniforms.uPx.value = px;
      press.uniforms.uCss.value.set(W, H); press.uniforms.uPx.value = px; press.uniforms.uTexel.value.set(1 / (W * px), 1 / (H * px));
      quad.material = paperMat; renderer.setRenderTarget(paperRT); renderer.render(flat, flatCam); renderer.setRenderTarget(null);
    }
    Object.assign(view, { W, H, px, s });
  }
  function draw() {
    renderer.setRenderTarget(fishRT); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, camera);
    renderer.setRenderTarget(null); quad.material = press; renderer.render(flat, flatCam);
    F.frames++;
  }
  // the one moving part: the body's slow wave, the S swelling a little, the fins (in their shader) and the long ray (in the rig)
  function animate(dt) {
    S.t += dt; shared.uTime.value = S.t; press.uniforms.uTime.value = S.t;
    S.swell = FRONT.breathe.curl * Math.sin(S.t * 0.42);
    rig.phase += dt * Math.PI * 2 * FRONT.breathe.rate; rig.time += dt;
    lay(); rig._pose(dt, null);
  }

  // ---- what draws, and when: at most FRONT.fps a second while something moves; nothing once left alone
  let last = performance.now(), touchedAt = last, drawn = 0, raf = 0, still = reduced();
  const wake = () => { touchedAt = performance.now(); if (!raf && !root.hidden) raf = requestAnimationFrame(loop); };
  function loop(now) {
    raf = 0; if (root.hidden) return;
    const busy = F.state === 'diving' || F.state === 'leaving';
    const awake = busy || (!still && now - touchedAt < FRONT.idle * 1000);
    if (now - drawn >= 1000 / (busy ? 60 : FRONT.fps) - 2) {
      const dt = Math.min((now - last) / 1000, 0.1); last = now; drawn = now;
      if (awake) animate(dt); else last = now;
      if (!F.manual) tickTransition(dt);
      frame(); draw();
    }
    if (awake && !document.hidden) raf = requestAnimationFrame(loop);
  }
  addEventListener('resize', () => { frame(); draw(); wake(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { last = performance.now(); wake(); } else if (F.music) F.music.pause(); if (!document.hidden && F.music && F.state !== 'gone') F.music.resume(); });
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change', () => { still = reduced(); wake(); });
  await document.fonts?.load?.('16px "Front Fell"').catch(() => {});
  await Promise.all(['16px "Front Fell"', 'italic 16px "Front Fell"', '16px "Front Fell SC"'].map((f) => document.fonts?.load?.(f).catch(() => {})));
  frame(); draw();
  document.documentElement.classList.add('front-up'); // the stage under the page may be seen now (index.html hid it until the page was drawn)
  F.ready = true;
  raf = requestAnimationFrame(loop);

  // ---- the dive is built behind the page, after its first picture, and waits there (main.js holds its loop while F.holds)
  let game = null;
  F.gameReady = new Promise((res) => setTimeout(() => Promise.resolve(boot()).then(() => { game = window.__game; hookGame(); res(game); last = performance.now(); }), 60));

  // ---- the music: decoded once and looped between exact points, so there is no gap at the join
  F.music = createMusic();

  // ---- the first touch: the menu inks itself in and the music comes in
  function firstTouch() {
    if (F.touched) return; F.touched = true; F.state = 'menu';
    root.classList.add('awake');
    menu.forEach((b, i) => { b.style.transitionDelay = `${0.08 + i * 0.11}s`; });
    setTimeout(() => menu.forEach((b) => { b.style.transitionDelay = ''; }), 1400);
    F.music.start();
    setCur(0, true); wake();
  }
  // ---- the menu
  let cur = 0;
  function setCur(i, focus = true) {
    cur = (i + menu.length) % menu.length;
    menu.forEach((b, j) => b.classList.toggle('cur', j === cur));
    if (focus) menu[cur].focus({ preventScroll: true });
  }
  async function choose(i) {
    const go = menu[i].dataset.go; setCur(i);
    if (F.state !== 'menu') return;
    if (!game) { menu[i].classList.add('wait'); await F.gameReady; menu[i].classList.remove('wait'); }
    if (go === 'dive') return dive();
    overGame(go);
  }
  menu.forEach((b, i) => {
    b.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && F.touched) setCur(i, false); });
  });

  // Input. While the page is up it has every key, click and touch first: the dive behind it must not see them (the game's own
  // listeners come after these, on the same window). While one of the game's screens is laid over it, they pass to the game.
  const mine = () => !root.hidden && !F.over && F.state !== 'gone';
  const stop = (e) => { e.stopImmediatePropagation(); };
  for (const type of ['pointerdown', 'pointerup', 'pointermove', 'mousedown', 'mouseup', 'click', 'dblclick', 'wheel', 'contextmenu', 'touchstart', 'touchend', 'keyup']) {
    addEventListener(type, (e) => {
      if (!mine()) return;
      if (type === 'pointerdown' || type === 'touchstart') { wake(); if (F.state === 'diving') skip(); else if (!F.touched) { firstTouch(); if (!e.target.closest?.('#front .menu')) {} } }
      if (type === 'pointermove') wake();
      if (type === 'contextmenu') e.preventDefault();
      // a click lands on the page's own buttons and goes no further
      if (type === 'click' && root.contains(e.target)) { e.stopImmediatePropagation(); const b = e.target.closest('.menu button'); if (b && F.touched && F.state === 'menu') choose(menu.indexOf(b)); return; }
      stop(e);
    }, { capture: true, passive: false });
  }
  addEventListener('keydown', (e) => {
    if (!mine()) return;
    wake(); stop(e);
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (F.state === 'diving') { if (!e.repeat) skip(); return; }
    if (!F.touched) { e.preventDefault(); firstTouch(); return; }
    if (F.state !== 'menu') return;
    const k = e.key;
    if (k === 'ArrowDown' || k === 'ArrowRight' || (k === 'Tab' && !e.shiftKey)) { e.preventDefault(); setCur(cur + 1); }
    else if (k === 'ArrowUp' || k === 'ArrowLeft' || (k === 'Tab' && e.shiftKey)) { e.preventDefault(); setCur(cur - 1); }
    else if (k === 'Home') { e.preventDefault(); setCur(0); }
    else if (k === 'End') { e.preventDefault(); setCur(menu.length - 1); }
    else if ((k === 'Enter' || k === ' ') && !e.repeat) { e.preventDefault(); choose(cur); }
  }, { capture: true });

  // a controller: the D-pad or the left stick moves, Cross (A) chooses. A browser does not count a controller's button as a touch
  // that may start sound, so with a controller alone the menu inks in but the music waits for a key or a click.
  const pad = { held: new Set(), rep: 0 };
  function pollPad(dt) {
    if (root.hidden || !navigator.getGamepads) return;
    let any = null; try { for (const g of navigator.getGamepads()) if (g && g.connected) { any = g; break; } } catch { return; }
    if (F.over) { // one of the game's screens has the controller: it is handed over once every button is let go, so the press that opened it does not also press in it
      const down = !!any && any.buttons.some((x) => x?.pressed);
      if (!down) F.menus = true;
      if (F.over === 'library' && any && any.buttons[1]?.pressed && !pad.held.has('back')) game?.lib?.close(); // the library has no controller of its own: Circle leaves it
      pad.held = new Set(any && any.buttons[1]?.pressed ? ['back'] : []);
      return;
    }
    if (!mine() || !any) return;
    const b = (i) => !!any.buttons[i]?.pressed, ax = any.axes || [];
    const now = new Set();
    if (b(12) || ax[1] < -0.5) now.add('up'); if (b(13) || ax[1] > 0.5) now.add('down');
    if (b(14) || ax[0] < -0.5) now.add('left'); if (b(15) || ax[0] > 0.5) now.add('right');
    if (b(0)) now.add('ok'); if (b(9)) now.add('start');
    if (now.size) { wake(); }
    const fresh = [...now].filter((x) => !pad.held.has(x));
    pad.rep = now.size && !fresh.length ? pad.rep - dt : 0.42;
    const repeat = pad.rep < 0; if (repeat) pad.rep = 0.14;
    pad.held = now;
    const press = (x) => fresh.includes(x) || (repeat && now.has(x) && x !== 'ok' && x !== 'start');
    if (F.state === 'diving') { if (fresh.length) skip(); return; }
    if (!F.touched) { if (fresh.length) firstTouch(); return; }
    if (F.state !== 'menu') return;
    if (press('down') || press('right')) setCur(cur + 1);
    else if (press('up') || press('left')) setCur(cur - 1);
    else if (fresh.includes('ok') || fresh.includes('start')) choose(cur);
  }
  let padLast = performance.now(), padOn = false;
  function padLoop(now) { if (root.hidden) { padOn = false; return; } pollPad(Math.min(0.1, (now - padLast) / 1000)); padLast = now; requestAnimationFrame(padLoop); }
  const padStart = () => { if (!padOn) { padOn = true; padLast = performance.now(); requestAnimationFrame(padLoop); } };
  padStart();

  // ---- the game's own screens, laid over this page: they are used as they are, and closing them comes back here
  const html = document.documentElement;
  let overFrom = 0, resumeText = '';
  function overGame(go) {
    const g = game; if (!g) return;
    F.over = go; F.menus = false; html.classList.add('front-over'); overFrom = cur;
    g.look.ever = false; // so that leaving the pause menu does not take the mouse
    const resume = document.getElementById('btn-resume'); resumeText = resume.textContent; resume.textContent = 'Back to the front page';
    if (go === 'library') g.openLibrary();
    else if (go === 'feedback') g.openNote(true);
    else { g.setPaused(true); if (go === 'band') { const tab = document.getElementById('music-tab'); if (tab.getAttribute('aria-expanded') !== 'true') tab.click(); } if (go === 'settings') document.getElementById('btn-resume').focus({ preventScroll: true }); }
    F.music.duck(go === 'library' ? 0.35 : 0.6);
  }
  function overDone() {
    if (!F.over) return;
    F.over = false; F.menus = false; html.classList.remove('front-over');
    pad.held = new Set(['ok', 'start', 'up', 'down', 'left', 'right']); // what closed the game's screen is not also a press here
    const resume = document.getElementById('btn-resume'); if (resumeText) resume.textContent = resumeText;
    F.music.duck(1); F.music.level(); game.music.duck(0); // the band may have been started by the library's Hear it: it stays silent here
    setCur(overFrom); wake();
  }
  const watch = new MutationObserver(() => {
    if (!F.over || !game) return;
    const stage = document.getElementById('stage'), pause = document.getElementById('pause');
    if (F.over === 'library' && !stage.classList.contains('lib')) { if (game.paused) game.setPaused(false); }
    if (!stage.classList.contains('lib') && !pause.classList.contains('on')) overDone();
  });

  // ---- hooks into the game, once it is built: the band waits for the dive; a way back here from the pause menu and the end card
  let unlockBand = null;
  function hookGame() {
    const g = game, music = g.music;
    // the band does not start behind this page: the game's own listeners would start it at the first click
    unlockBand = music.unlock.bind(music);
    music.unlock = () => (F.state === 'gone' || F.over === 'library' ? unlockBand() : false);
    watch.observe(document.getElementById('pause'), { attributes: true, attributeFilter: ['class'] });
    watch.observe(document.getElementById('stage'), { attributes: true, attributeFilter: ['class'] });
    // the pause menu: "Front page", two presses as "New dive" is, since it leaves the dive
    const row = document.getElementById('btn-new').parentElement;
    const back = document.createElement('button'); back.type = 'button'; back.id = 'btn-front'; back.textContent = 'Front page';
    row.append(back);
    let armT = 0;
    back.addEventListener('click', () => {
      if (!back.dataset.armed) { back.dataset.armed = '1'; back.textContent = 'Leave the dive? Again'; clearTimeout(armT); armT = setTimeout(() => { delete back.dataset.armed; back.textContent = 'Front page'; }, 4000); return; }
      clearTimeout(armT); delete back.dataset.armed; back.textContent = 'Front page'; comeBack();
    });
    // the end card: one press, under "Leave feedback", and "Dive again" keeps the keyboard as before
    const end = document.getElementById('btn-note-end');
    const back2 = document.createElement('button'); back2.type = 'button'; back2.className = 'quiet'; back2.id = 'btn-front-end'; back2.textContent = 'Front page';
    end.after(back2);
    back2.addEventListener('click', () => comeBack());
    music.duck(0);
  }

  // ---- diving in: the paper takes the colour of water, the fish straightens and swims off the page, and the dive is there
  const T = { t: 0, released: false, shown: 0, skip: false };
  async function dive() {
    if (F.state !== 'menu') return;
    F.state = 'diving'; T.t = 0; T.released = false; T.shown = 0; T.skip = false;
    root.classList.remove('awake'); root.classList.add('diving');
    const g = game;
    // the water's colour: the band's own, as the first frame of the dive will be filled with it
    try { const c = g.scene.fog?.color || g.scene.background; if (c) press.uniforms.uWater.value.copy(c); } catch { /* keep the page's own */ }
    g.music.duck(0); unlockBand?.(); // the band starts now, silent, and comes up as the page's music goes
    F.music.fadeOut(FRONT.music.fadeOut);
    fadeLettering(0, 0.45);
    wake();
  }
  function skip() { if (F.state === 'diving') T.skip = true; }
  function fadeLettering(to, secs) { const s = root.querySelector('.sheet'); s.style.transition = `opacity ${secs}s`; s.style.opacity = String(to); }
  function tickTransition(dt) {
    if (F.state === 'diving') {
      const D = FRONT.dive; T.t += dt;
      if (T.skip && !T.released) T.t = Math.max(T.t, D.release);
      const t = T.t;
      press.uniforms.uWash.value = clamp(t / D.wash, 0, 1);
      S.straight = clamp((t - 0.15) / D.straighten, 0, 1);
      const sw = clamp((t - 0.35) / D.swim, 0, 1); S.off = (sw * sw) * (view.W / view.s + rig.length + 1); // it gathers speed as it goes, and is off the page
      if (!T.released && t >= D.release) release();
      if (T.released) { // the dive has drawn its first frames under the water's colour: the page lifts off it
        T.rt += dt; const k = clamp((T.rt - 0.06) / (T.skip ? D.skip : D.reveal), 0, 1);
        root.style.opacity = String(1 - ease(k));
        if (k >= 1) gone();
      }
    } else if (F.state === 'leaving') {
      // coming back: the page is laid over the dive and the dive is let go
    }
  }
  function release() {
    T.released = true; T.rt = 0;
    const g = game;
    F.holds = false;
    if (g.paused) g.setPaused(false);
    g.music.duck(1);
  }
  function gone() {
    F.state = 'gone'; root.hidden = true; root.style.transition = ''; root.style.opacity = '';
    html.classList.remove('front', 'front-over');
    F.music.stop();
    cancelAnimationFrame(raf); raf = 0;
    document.getElementById('stage')?.focus?.();
  }

  // ---- coming back to the page from a dive: the page is laid over it, the dive is held, and a fresh one is made ready behind it
  function comeBack() {
    const g = game; if (!g || F.state !== 'gone') return;
    if (document.pointerLockElement) document.exitPointerLock?.();
    F.state = 'leaving';
    root.hidden = false; root.style.transition = 'none'; root.style.opacity = '0';
    root.classList.remove('diving'); fadeLettering(1, 0.01);
    press.uniforms.uWash.value = 0; press.uniforms.uInk.value = 1; S.straight = 0; S.off = 0; T.t = 0;
    html.classList.add('front');
    frame(); draw();
    requestAnimationFrame(() => { root.style.transition = `opacity ${FRONT.back.fade}s`; root.style.opacity = '1'; });
    g.music.duck(0);
    setTimeout(() => {
      F.holds = true; g.look.ever = false;
      if (g.paused) g.setPaused(false);
      g.startRun(); // a fresh dive, waiting behind the page
      root.style.transition = ''; F.state = 'menu'; root.classList.add('awake');
      F.music.start(); setCur(0); last = performance.now(); wake(); padStart();
    }, FRONT.back.fade * 1000 + 30);
  }

  // ---- pictures and checks: the fish's clock set by hand, and the event of diving in stepped by hand (tools/shot_title.mjs)
  function at(t) {
    S.t = t - 0.5; rig.phase = S.t * Math.PI * 2 * FRONT.breathe.rate; rig.time = S.t;
    for (let i = 0; i < 15; i++) animate(1 / 30); // half a second, so the long ray hangs as it would
    frame(); draw();
  }
  function advance(secs) { for (let t = 0; t < secs - 1e-6; t += 1 / 60) { animate(1 / 60); tickTransition(1 / 60); } frame(); draw(); }
  // ---- what the checks read and drive (tools/test_title.mjs)
  Object.assign(F, { root, menu, choose: (go) => choose(menu.findIndex((b) => b.dataset.go === go)), touch: firstTouch, comeBack, skip, renderer, rig, FRONT, box, at, advance });
  Object.defineProperty(F, 'cur', { get: () => menu[cur].dataset.go }); // a getter, read each time (Object.assign would copy its value once)
  wake();
  return F;
}

// ---------------------------------------------------------------- the page's music
// One AudioContext of its own, made at the first touch. The sound is fetched and decoded once; an AudioBufferSourceNode loops it
// between exact points (a compressed file left to loop by itself usually gaps). It follows the game's sound switch and volume,
// read from the game when it is there and from what it saved before that, and it never plays once the dive has begun.
function createMusic() {
  const which = new URLSearchParams(location.search).get('music') === 'loop' ? 'loop' : 'long';
  const spec = FRONT.music[which];
  const M = { which, ctx: null, buffer: null, src: null, fade: null, master: null, playing: false, loopStart: 0, loopEnd: 0, duckK: 1, error: null, want: false };
  let data = null;
  const fetched = fetch(spec.src).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${r.status}`)))).then((b) => { data = b; }).catch((e) => { M.error = String(e); });
  function settings() { // the game's sound switch and volume: from the game when it is there, else from what it saved
    const g = window.__game;
    if (g?.music) return { muted: !!g.music.muted, volume: g.music.params?.volume ?? 0.7 };
    const p = store.get('oarfish.music', {});
    return { muted: !!p.muted, volume: Number.isFinite(p.volume) ? p.volume / 100 : 0.7 };
  }
  M.level = () => {
    if (!M.master) return;
    const s = settings(), v = s.muted ? 0 : s.volume * FRONT.music.gain * M.duckK;
    M.master.gain.setTargetAtTime(v, M.ctx.currentTime, 0.08); M.muted = s.muted; M.volume = s.volume;
  };
  async function decode() {
    if (M.buffer || !M.ctx) return M.buffer;
    await fetched; if (!data) return null;
    try { M.buffer = await M.ctx.decodeAudioData(data.slice(0)); } catch (e) { M.error = String(e); return null; }
    // find the loop in what was decoded: its first sound, against where it is in the file as made
    const ch = M.buffer.getChannelData(0), sr = M.buffer.sampleRate;
    let i = 0; while (i < ch.length && Math.abs(ch[i]) < 0.01) i++;
    const lead = clamp(i / sr - spec.first / 44100, 0, 0.2);
    M.loopStart = lead; M.loopEnd = lead + spec.period / 44100;
    if (M.loopEnd > M.buffer.duration) { M.loopEnd = M.buffer.duration; M.loopStart = M.loopEnd - spec.period / 44100; }
    return M.buffer;
  }
  M.start = async () => {
    M.want = true;
    try {
      if (!M.ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; M.ctx = new AC(); M.master = M.ctx.createGain(); M.master.gain.value = 0; M.master.connect(M.ctx.destination); }
      if (M.ctx.state === 'suspended') M.ctx.resume().catch(() => {});
    } catch (e) { M.error = String(e); return; }
    M.level();
    if (!(await decode()) || !M.want || M.playing) return;
    const src = M.ctx.createBufferSource(); src.buffer = M.buffer; src.loop = true; src.loopStart = M.loopStart; src.loopEnd = M.loopEnd;
    const fade = M.ctx.createGain(); fade.gain.value = 0; src.connect(fade).connect(M.master);
    const t = M.ctx.currentTime + 0.02;
    fade.gain.setValueAtTime(0, t); fade.gain.linearRampToValueAtTime(1, t + FRONT.music.fadeIn);
    src.start(t, M.loopStart);
    Object.assign(M, { src, fade, playing: true, startedAt: t });
  };
  M.fadeOut = (secs) => {
    M.want = false;
    if (!M.playing) return;
    const t = M.ctx.currentTime, g = M.fade.gain; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + secs);
    const src = M.src; src.stop(t + secs + 0.05); M.playing = false; M.src = null;
    setTimeout(() => { if (!M.playing && !M.want) M.ctx?.suspend?.().catch(() => {}); }, (secs + 0.3) * 1000);
  };
  M.stop = () => { M.fadeOut(0.05); };
  M.duck = (k) => { M.duckK = k; M.level(); };
  M.pause = () => { M.ctx?.suspend?.().catch(() => {}); };
  M.resume = () => { if (M.playing) M.ctx?.resume?.().catch(() => {}); };
  M.position = () => (M.playing && M.ctx ? (M.loopStart + ((M.ctx.currentTime - M.startedAt) % (M.loopEnd - M.loopStart))) : null);
  // follow the sound switch and the volume while they are changed in the band's drawer over this page
  setInterval(() => { if (M.master && (M.playing || M.want)) M.level(); }, 250);
  return M;
}
