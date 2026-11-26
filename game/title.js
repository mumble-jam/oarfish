// The front page: the old plate the game's look comes from, come alive, before the first dive.
//
// Warm paper, the plate's lettering, and the game's own oarfish laid in the plate's S and drawn as if printed: flat tones in the
// plate's colours, a stipple of spots, a fine line round everything, edges that wander a little as a lithograph's do, paper grain
// through the ink. Under the caption, five items set as the plate's lettering: Dive, the specimen library, the band, settings and
// keys, feedback. The page opens silent; the first touch (a key, a click, a tap, a button on a controller) inks the menu in and
// starts its music, the Lullaby: a music box over a low held note, made as the band makes its sound (titlemusic.js), which lands on the
// band's first chord and beat when Dive is pressed.
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
import { createTitleMusic, DREAM } from './titlemusic.js';

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
  // The dorsal fin's wave (its shader, and finWave below for the checks): how fast it runs (radians a second), how many radians to a metre
  // of the body; and how far a corner rises and falls, and sways along the body, for each metre it stands over the back. It moves only in
  // the fin's own plane. It used to lean the fin a long way to the side (0.6 m a metre), and in the plate's projection, where what is
  // farther back is drawn higher, a lean shows as up or down on the paper: leaning toward the viewer the fin was drawn down into the back,
  // leaning away it lifted off it with paper showing under it, and at the turns, seen end on, it folded over the body (George: 'the dorsal
  // fin isn't attached to the body consistently across the body'). Its foot never moves.
  fin: { speed: 2.1, along: 2.4, rise: 0.1, sway: 0 }, // (no sway: along the body is into the paper at the turns, where a sway shows as up and down again)
  bands: [0.3, 0.47, 0.63, 0.8], // where the dorsal fin runs deeper pink, along the body (0 the neck, 1 the tail), as on the plate
  dive: { wash: 0.95, straighten: 0.85, swim: 1.5, release: 1.3, reveal: 0.55, skip: 0.22 }, // seconds: the event of diving in
  back: { fade: 0.6 }, // coming back to the page from a dive
  music: {
    // The Lullaby (titlemusic.js, every number of it in DREAM there). ?music=b and ?music=c play the other two sketches George was
    // offered (the waltz, the band asleep), for him to hear again; a is what a player gets.
    sketches: ['a', 'b', 'c'],
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
#front .sheet { --beat: clamp(12px, 1.1vw, 18px); position: absolute; inset: 0; display: grid; padding: clamp(12px, 2.6vh, 30px) clamp(14px, 3.4vw, 54px) clamp(10px, 2vh, 22px);
  grid-template: "head" auto "." minmax(0, 1fr) "pic" minmax(0, var(--pic-h, 1fr)) "caption" auto "credit" auto "menu" minmax(4.2em, auto) "." minmax(0, 1fr) / minmax(0, 1fr); row-gap: 0; }
/* the grid, as on the plate: the running head on one baseline across the top, its two ends on the page's margins; under it one block centred
   on the picture's axis: the picture (its row no taller than the fish needs, --pic-h, so what is left is shared above and below the block),
   the caption a beat (--beat) under it, the draughtsman's credit small and light close under the caption on the same axis (George chose one
   axis over the plate's credit at the corner, which read as a staircase), and the menu a beat under that */
#front .head { grid-area: head; display: grid; grid-template-columns: 1fr auto 1fr; align-items: baseline; gap: 12px; margin-bottom: var(--beat); }
#front .book { display: block; font: 400 clamp(11px, 1.15vw, 16px)/1 "Front Fell SC", serif; letter-spacing: 0.24em; margin: 0; }
#front .name { margin: 0; text-align: center; font: 400 clamp(17px, 2.1vw, 30px)/1 "Front Fell SC", serif; letter-spacing: 0.34em; padding-left: 0.34em; white-space: nowrap; }
#front .name::before, #front .name::after { content: ""; display: inline-block; vertical-align: 0.3em; width: clamp(18px, 4vw, 64px); height: 1px; background: currentColor; opacity: 0.55; }
#front .name::before { margin-right: 0.7em; } #front .name::after { margin-left: 0.36em; }
#front .class { display: block; margin: 0; justify-self: end; font: italic 400 clamp(13px, 1.4vw, 20px)/1 "Front Fell", serif; white-space: nowrap; }
#front .class span { font-style: normal; font-size: 0.8em; letter-spacing: 0.06em; margin-left: 3em; }
#front .pic { grid-area: pic; min-height: 0; }
#front .credit { grid-area: credit; margin: calc(var(--beat) * 0.3) 0 0; text-align: center; font: italic 400 clamp(10px, 0.78vw, 12px)/1.2 "Front Fell", serif; letter-spacing: 0.02em; opacity: 0.62; }
#front .caption { grid-area: caption; margin: var(--beat) 0 0; text-align: center; font-weight: 400; text-wrap: balance; }
#front .caption b { font: italic 400 clamp(15px, 1.75vw, 25px)/1.15 "Front Fell", serif; letter-spacing: 0.1em; text-transform: uppercase; font-size: clamp(13px, 1.45vw, 21px); }
#front .caption i { font: italic 400 clamp(14px, 1.6vw, 23px)/1.15 "Front Fell", serif; margin-left: 0.5em; white-space: nowrap; }
#front .caption i span { font-size: 0.86em; }
#front .plate-foot { grid-area: menu; position: relative; display: grid; place-items: center; margin-top: var(--beat); }
#front .invite { margin: 0; font: italic 400 clamp(14px, 1.45vw, 20px)/1.2 "Front Fell", serif; opacity: 0.78; transition: opacity 0.5s; }
#front .invite::before, #front .invite::after { content: "\\2009\\2014\\2009"; opacity: 0.6; }
#front.awake .invite { opacity: 0; pointer-events: none; }
#front .plate-foot > * { grid-area: 1 / 1; }
#front .menu { display: flex; align-items: baseline; justify-content: center; flex-wrap: wrap; gap: 0.2em clamp(10px, 2.1vw, 34px); visibility: hidden; align-content: center; padding: 0 calc(24px + 0.35 * clamp(22px, 2.4vw, 36px) - 0.35 * clamp(12px, 1.15vw, 16px)) 0 24px; }
#front.awake .menu { visibility: visible; }
#front .menu button { all: unset; box-sizing: border-box; cursor: pointer; position: relative; padding: 0.32em 0.15em 0.42em; font: 400 clamp(12px, 1.15vw, 16px)/1 "Front Fell SC", serif; letter-spacing: 0.2em; color: inherit;
  clip-path: inset(-20% 100% -20% -60%); opacity: 0; transition: clip-path 0.75s cubic-bezier(.3,.1,.2,1), opacity 0.5s; touch-action: manipulation; }
#front .menu button.dive { font: italic 400 clamp(22px, 2.4vw, 36px)/1 "Front Fell", serif; letter-spacing: 0.04em; padding: 0.12em 0.35em 0.3em; }
#front.awake .menu button { clip-path: inset(-20% -60% -20% -60%); opacity: 1; }
#front .menu .sep { font-size: 10px; opacity: 0; transition: opacity 0.6s 0.6s; }
#front.awake .menu .sep { opacity: 0.5; }
/* the focus: an engraver's rule drawn under the word, with a lozenge at each end */
#front .menu button::after { content: ""; position: absolute; left: 0.05em; right: 0.2em; bottom: 0.08em; height: 1px; background: currentColor; transform: scaleX(0); transition: transform 0.28s cubic-bezier(.3,.1,.2,1); }
#front .menu button::before { content: ""; position: absolute; left: calc(0.05em - 9px); right: calc(0.2em - 9px); bottom: calc(0.08em - 3px); height: 7px; opacity: 0; transition: opacity 0.2s;
  background: var(--lozenge) left center / 6px 7px no-repeat, var(--lozenge) right center / 6px 7px no-repeat; }
#front .menu button.dive::after { bottom: 0.12em; }
#front .menu button.dive::before { bottom: calc(0.12em - 3px); }
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
  #front .sheet { --beat: 16px; }
  #front .menu { padding: 0 24px; }
  #front .head { grid-template-columns: 1fr 1fr; grid-template-areas: "name name" "book class"; row-gap: 14px; }
  #front .name { grid-area: name; font-size: clamp(18px, 5.6vw, 28px); }
  #front .book { grid-area: book; font-size: 11px; } #front .class { grid-area: class; font-size: 14px; }
  #front .menu { flex-direction: column; align-items: center; flex-wrap: nowrap; gap: 0.15em; }
  #front .menu .sep { display: none; }
  #front .menu button { font-size: 15px; padding: 0.55em 0.4em 0.6em; }
  #front .menu button.dive { font-size: 32px; padding: 0.15em 0.4em 0.3em; }
  #front .caption i { display: block; margin: 0.2em 0 0; }
}
/* a phone on its side, or any short window: the menu as a column on the left margin, the fish to its right looking at it, its caption under it */
@media (max-height: 520px) and (min-aspect-ratio: 4/3) {
  #front .sheet { --beat: 8px; grid-template: "head head" auto "menu ." minmax(0, 1fr) "menu pic" minmax(0, var(--pic-h, 1fr)) "menu caption" auto "menu credit" auto "menu ." minmax(0, 1fr) / minmax(150px, 22%) minmax(0, 1fr); column-gap: 18px; }
  #front .menu { flex-direction: column; align-items: flex-start; flex-wrap: nowrap; gap: 0.1em; padding: 0 12px 0 20px; margin-left: -20px; }
  #front .plate-foot { place-items: start start; align-self: stretch; margin-top: 0; }
  #front .plate-foot > * { margin-top: var(--menu-top, 0px); }
  #front .invite { text-align: left; font-size: 14px; }
  #front .menu .sep { display: none; }
  #front .menu button { font-size: 13px; padding: 0.5em 0.2em 0.55em 0; }
  #front .menu button.dive { font-size: 28px; padding-left: 0; }
  #front .caption b { font-size: 12px; } #front .caption i { font-size: 13px; }
}
/* the game's own screens, opened from this page, are laid over it */
/* the library draws its specimen on the game's own canvas, which lies under this page (the library's panels are over it, its middle is
   clear): while it is open the page steps aside entirely. Under the other screens (translucent, as over a dive) the paper and the fish stay,
   still, and the lettering goes, so nothing of it reads through a screen */
html.front-under #front { visibility: hidden; }
html.front-over #front .sheet, html.front-over #front .alt { visibility: hidden; }
html.front-over #front .menu, html.front-over #front .menu button { visibility: hidden; transition: none; }
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
  <div class="plate-foot">
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
          } else { // the dorsal fin: a wave running down its length (finWave, below, is the same sum)
            float w = uTime * ${f(FRONT.fin.speed)} + position.z * ${f(FRONT.fin.along)};
            transformed.y += fh * ${f(FRONT.fin.rise)} * sin(w) * uStir;
            transformed.z += fh * ${f(FRONT.fin.sway)} * sin(w + 1.2) * uStir;
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

// the dorsal fin's wave at a corner `fh` over the back, `w` along the wave: how far it moves (x, y, z in the model), as its shader moves it
function finWave(fh, w, stir) { const F = FRONT.fin; return [0, fh * F.rise * Math.sin(w) * stir, fh * F.sway * Math.sin(w + 1.2) * stir]; }
const f = (x) => (Number.isInteger(x) ? x.toFixed(1) : String(x)); // a number written into a shader

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
      float th = (1.0 - uWash) * 1.3 - 0.4 * uWash; // at the end even the driest spot is wet
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
  function measure() { // the picture's extent in the plate's projection: its mean over one breath (the S swells and the body waves, so
    // the extent at any one moment wanders by a few per cent of the width; the picture is framed, and so centred, on the mean), and the head
    const v = new THREE.Vector3(), g = mesh.geometry, pos = g.attributes.position, n = pos.count;
    const extent = () => { built.group.updateMatrixWorld(true); mesh.skeleton.update(); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (let i = 0; i < n; i += 3) { mesh.getVertexPosition(i, v); v.applyMatrix4(mesh.matrixWorld); const X = v.x, Y = v.y - k * v.z; if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y; }
      return [x0, x1, y0, y1]; };
    const pose = (t) => { S.t = t - 0.5; rig.phase = S.t * Math.PI * 2 * FRONT.breathe.rate; rig.time = S.t; for (let i = 0; i < 15; i++) animate(1 / 30); }; // as at(t) poses it
    const sum = [0, 0, 0, 0]; let m = 0;
    pose(0); for (let f = 0; f < 225; f++) { animate(1 / 15); if (f % 3 === 0) { extent().forEach((e, j) => { sum[j] += e; }); m++; } } // fifteen seconds, a whole breath
    sum.forEach((e, j) => { sum[j] = e / m; });
    pose(0);
    const [x0, x1, y0, y1] = sum;
    built.group.updateMatrixWorld(true); mesh.skeleton.update();
    // the head: the body's skin in the front 7% of the model's length (no fins, no crest), for the menu to be set beside
    const fin = new Uint8Array(n); for (const gr of g.groups) if (/^Fin/.test(mesh.material[gr.materialIndex]?.name || '')) fin.fill(1, gr.start, gr.start + gr.count);
    let zmin = 1e9, zmax = -1e9; for (let i = 0; i < n; i++) { const z = pos.getZ(i); if (z < zmin) zmin = z; if (z > zmax) zmax = z; }
    let hy0 = 1e9, hy1 = -1e9;
    for (let i = 0; i < n; i++) { if (fin[i] || pos.getZ(i) < zmax - 0.07 * (zmax - zmin)) continue; mesh.getVertexPosition(i, v); v.applyMatrix4(mesh.matrixWorld); const Y = v.y - k * v.z; if (Y < hy0) hy0 = Y; if (Y > hy1) hy1 = Y; }
    Object.assign(box, { x0, x1, y0, y1, hy0, hy1 });
  }
  measure();
  const view = { W: 1, H: 1, px: 1, s: 1 };
  const SIDE = matchMedia('(max-height: 520px) and (min-aspect-ratio: 4/3)'); // the side-by-side layout's query, as in the CSS
  function frame() { // fit the plate's picture into the box the page's layout leaves for it
    const W = innerWidth, H = innerHeight, px = Math.min(devicePixelRatio || 1, 2);
    const bw = box.x1 - box.x0, bh = box.y1 - box.y0;
    root.style.setProperty('--pic-h', `${($('.pic').getBoundingClientRect().width * bh / bw).toFixed(1)}px`); // the picture's row: no taller than the fish at its width
    const r = $('.pic').getBoundingClientRect();
    const s = Math.min(r.width / (bw * 1.04), r.height / (bh * 1.04));
    const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
    const left = cx - (r.left + r.width / 2) / s, top = cy + (r.top + r.height / 2) / s;
    const foot = $('.plate-foot'), nav = $('.menu'), dive = menu[0];
    if (SIDE.matches) { // the menu beside the fish: Dive at the height of the fish's head, the menu kept inside its column
      root.style.setProperty('--menu-top', '0px');
      const f = foot.getBoundingClientRect(), d = dive.getBoundingClientRect(), m = nav.getBoundingClientRect();
      const headY = r.top + r.height / 2 - ((box.hy0 + box.hy1) / 2 - cy) * s;
      const want = headY - (d.top + d.height / 2 - m.top) - f.top;
      root.style.setProperty('--menu-top', `${Math.max(0, Math.min(want, f.height - m.height)).toFixed(1)}px`);
    } else root.style.removeProperty('--menu-top');
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
    raf = 0; if (root.hidden || F.over) return; // nothing steps under a screen opened over the page (overDone wakes it)
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
  document.fonts?.ready.then(() => { if (!root.hidden) { frame(); draw(); } }); // the lettering's own sizes, once its faces are in, decide where the menu sits
  // a hidden tab: the page's sound waits (its context is the band's too, which is silent while the page is up; in a dive it is the game's to keep)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { last = performance.now(); wake(); } if (!F.music || F.state === 'gone') return; if (document.hidden) F.music.pause(); else F.music.resume(); });
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

  // ---- the music: generated as it plays, on the band's own clock
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
    F.over = go; F.menus = false; html.classList.add('front-over'); html.classList.toggle('front-under', go === 'library'); overFrom = cur;
    g.look.ever = false; // so that leaving the pause menu does not take the mouse
    const resume = document.getElementById('btn-resume'); resumeText = resume.textContent; resume.textContent = 'Back to the front page';
    if (go === 'library') g.openLibrary();
    else if (go === 'feedback') g.openNote(true);
    else { g.setPaused(true); window.__leaf?.show(go === 'band' ? 'band' : 'settings'); document.getElementById('btn-resume').focus({ preventScroll: true }); } // the leaf's own chapters (leaf.js)
    F.music.duck(go === 'library' ? 0.35 : 0.6);
  }
  function overDone() {
    if (!F.over) return;
    F.over = false; F.menus = false; html.classList.remove('front-over', 'front-under');
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
    if (F.music.ctx) music.adopt(F.music.ctx); // the page's music started before the game was built: the band will play on its clock
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
    F.music.dive(g.music); // the page holds the band's chord and runs up into its downbeat, on its clock, and fades under it
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
    html.classList.remove('front', 'front-over', 'front-under');
    // (the page's music is not stopped here: its hand-over rings on under the band, a skip or not, and lets itself go)
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
  // ---- the dorsal fin against the back, measured on the screen (tools/test_title.mjs, tools/shot_fin.mjs). Slice by slice along the body
  // (the model's own length, 5 cm slices), in CSS pixels up the screen: `outline`, the back's outline as the paper shows it (the highest
  // corner of the body's skin in the slice); `base`, where the fin's base is drawn (its corners at the foot of the fin); `top`, the fin's
  // highest corner, waved as its shader waves it (the same sum, done here). `gap` is base less outline (above nought: a strip of back shows
  // under the fin; below: the fin is drawn down into the body), `shows` the fin's height over the outline.
  function finProbe() {
    built.group.updateMatrixWorld(true); mesh.skeleton.update();
    const g = mesh.geometry, pos = g.attributes.position, fin = g.attributes.aFin, n = pos.count, mats = mesh.material, t = shared.uTime.value, stir = shared.uStir.value;
    const matOf = new Array(n); for (const gr of g.groups) for (let i = gr.start; i < gr.start + gr.count; i++) matOf[i] = mats[gr.materialIndex].name;
    const v = new THREE.Vector3(), W = innerWidth, H = innerHeight, up = () => { v.applyMatrix4(mesh.matrixWorld).project(camera); return [(v.x + 1) / 2 * W, (v.y + 1) / 2 * H]; };
    const sl = new Map(), slice = (z) => { const k = Math.round(z / 0.05); if (!sl.has(k)) sl.set(k, { z: k * 0.05, outline: -1e9, base: [], top: -1e9, x: 0, nx: 0 }); return sl.get(k); };
    const ridge = new Map(); // the back's top in the model, slice by slice: only fin corners up there are the dorsal fin's (the pelvic fins are Fin too)
    for (let i = 0; i < n; i++) if (/^(Body|BodyTop|Spots)$/.test(matOf[i])) { const k = Math.round(pos.getZ(i) / 0.05); ridge.set(k, Math.max(ridge.get(k) ?? -9, pos.getY(i))); }
    for (let i = 0; i < n; i++) {
      const name = matOf[i], z = pos.getZ(i);
      if (/^Fin/.test(name) && (z > -0.45 || !(pos.getY(i) > (ridge.get(Math.round(z / 0.05)) ?? 9) - 0.08))) continue; // (the crest's rays stand forward of -0.45)
      if (/^(Body|BodyTop|Spots)$/.test(name)) { v.fromBufferAttribute(pos, i); mesh.applyBoneTransform(i, v); const [x, y] = up(); const s = slice(z); s.outline = Math.max(s.outline, y); s.x += x; s.nx++; }
      else if (/^Fin/.test(name) && z <= 0.02) {
        const fh = fin.getX(i), w = t * FRONT.fin.speed + z * FRONT.fin.along; v.fromBufferAttribute(pos, i);
        const d = finWave(fh, w, stir); v.x += d[0]; v.y += d[1]; v.z += d[2];
        mesh.applyBoneTransform(i, v); const [, y] = up(); const s = slice(z);
        if (fh < 1e-4) s.base.push(y); s.top = Math.max(s.top, y);
      }
    }
    // a fin's top corner lies a little behind its foot, so its height over the back is read over the slice and the two either side
    const topNear = (k) => Math.max(...[-2, -1, 0, 1, 2].map((d) => sl.get(k + d)?.top ?? -1e9));
    const rows = [...sl.entries()].filter(([, s]) => s.base.length && s.nx).sort((a, b) => b[1].z - a[1].z).map(([k, s]) => { const base = s.base.reduce((a, b) => a + b, 0) / s.base.length; return { z: +s.z.toFixed(2), x: +(s.x / s.nx).toFixed(1), outline: +s.outline.toFixed(2), gap: +(base - s.outline).toFixed(2), shows: +(topNear(k) - s.outline).toFixed(2) }; });
    const gaps = rows.map((r) => r.gap), shows = rows.map((r) => r.shows);
    return { rows, summary: { slices: rows.length, gapMin: Math.min(...gaps), gapMax: Math.max(...gaps), showMin: Math.min(...shows), showMax: Math.max(...shows), px: +view.s.toFixed(1) } };
  }
  // ---- what the checks read and drive (tools/test_title.mjs)
  Object.assign(F, { shared, camera, mesh, view, finProbe, root, menu, choose: (go) => choose(menu.findIndex((b) => b.dataset.go === go)), touch: firstTouch, comeBack, skip, renderer, rig, FRONT, box, at, advance });
  Object.defineProperty(F, 'cur', { get: () => menu[cur].dataset.go }); // a getter, read each time (Object.assign would copy its value once)
  wake();
  return F;
}

// ---------------------------------------------------------------- the page's music
// The Lullaby, generated as it plays (titlemusic.js). It is made at the first touch on an AudioContext that is the band's too: the game's
// music adopts it (music.js adopt), so when Dive is pressed the page reads where the band's beats will fall (music.js grid) on the same
// clock and lands its run on the band's downbeat. It follows the game's sound switch and volume, read from the game when it is there and
// from what it saved before that; a fresh one is made each time the page comes back.
function createMusic() {
  const q = new URLSearchParams(location.search).get('music'), which = FRONT.music.sketches.includes(q) ? q : 'a';
  const M = { which, ctx: null, tm: null, duckK: 1, want: false, error: null, handover: null, muted: false, volume: 0.7 };
  function settings() { // the game's sound switch and volume: from the game when it is there, else from what it saved
    const g = window.__game;
    if (g?.music) return { muted: !!g.music.muted, volume: g.music.params?.volume ?? 0.7 };
    const p = store.get('oarfish.music', {});
    return { muted: !!p.muted, volume: Number.isFinite(p.volume) ? p.volume / 100 : 0.7 };
  }
  M.level = () => { if (!M.tm) return; const s = settings(); M.tm.setVolume(s.volume, s.muted, M.duckK); M.muted = s.muted; M.volume = s.volume; };
  Object.defineProperty(M, 'playing', { get: () => !!M.tm?.playing });
  Object.defineProperty(M, 'gain', { get: () => (M.tm ? M.tm.gain : 0) }); // what the page's music is turned to now (its master), for the checks
  M.start = () => {
    M.want = true;
    try {
      if (!M.ctx) {
        const band = window.__game?.music;
        M.ctx = band?.context || null;
        if (!M.ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; M.ctx = new AC(); band?.adopt(M.ctx); }
      }
      if (M.ctx.state === 'suspended') M.ctx.resume().catch(() => {});
    } catch (e) { M.error = String(e); return; }
    if (M.tm?.playing) return;
    M.tm?.stop();
    M.tm = createTitleMusic({ context: M.ctx, sketch: which, seed: (Math.random() * 2 ** 31) | 0 });
    M.tm.start(); M.level();
  };
  // Dive: the band has just been started (or, back from a dive, has been playing silently all along). Its grid is on this clock if it
  // adopted ours; if it did not (it had a context of its own), the grid is moved across by the difference of the two clocks.
  M.dive = (band) => {
    M.want = false;
    if (!M.tm?.playing) return null;
    let grid = band?.grid?.() || null;
    const bc = band?.context;
    if (grid && bc && bc !== M.ctx) grid = { ...grid, at: grid.at + (M.ctx.currentTime - bc.currentTime) };
    M.handover = M.tm.dive({ at: M.ctx.currentTime, grid, chordOf: band?.chordOf ? (bar) => band.chordOf(bar) : null, beatAt: band?.beat ? (i) => { const b = band.beat(i); return b && bc && bc !== M.ctx ? { ...b, at: b.at + (M.ctx.currentTime - bc.currentTime) } : b; } : null, energy: band?.params?.energy, swing: band?.params?.swing });
    return M.handover;
  };
  M.stop = () => { M.want = false; M.tm?.stop(); };
  M.duck = (k) => { M.duckK = k; M.level(); };
  M.pause = () => { M.ctx?.suspend?.().catch(() => {}); };
  M.resume = () => { if (M.tm?.playing) M.ctx?.resume?.().catch(() => {}); };
  // follow the sound switch and the volume while they are changed in the band's drawer over this page
  setInterval(() => { if (M.tm?.playing) M.level(); }, 250);
  M.DREAM = DREAM;
  return M;
}
