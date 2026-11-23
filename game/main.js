// The run: scene setup, input, camera, the rules of the dive, and the HUD.

import * as THREE from 'three';
import { buildOarfish, PALETTE, stature } from './oarfish.js';
import { OarfishRig, SPEED } from './rig.js';
import { createLibrary } from './library.js';
import { resolve, make, NPC, inOrder } from './npc.js';
import { createWorld, FLOORS, SWARMS, CLEAN, NEST, wrapRule, canWrap } from './world.js';
import { createFoes } from './foes.js';
import { createMusic } from './music.js';
import { createPad, BTN } from './pad.js';
import { createSum } from './boss.js';
import { createSurface, SKY } from './surface.js';
import { createGuard, KEEPER_FIGHT, SHEARER_FIGHT } from './guards.js';
import { SHELLS, SHELL_TYPES, SHELL_FEATS, shellPool, SLOT_EVERY, shellMods, createShellKit, createShellField } from './shells.js';
import { clamp, damp, lerp, glowTexture } from './geo.js';
import { SAND_PETS, bringSand } from './sandpets.js';

// Balance, all in one place. A segment is one spine bone, about 0.31 m of body.
const START_SEGS = 10, MIN_SEGS = 4, MAX_SEGS = 26, SHED_COST = 3;
// Length is the dive's money, and these are its prices, all in one place.
//   cost    fish to grow one segment: the first figure at the starting length and below, the second at one short of the longest, along a curve
//           bent by `bend` (1 is a straight line; more keeps it cheap for longer). A bitten fish grows back fast; a long one needs the big
//           swarms. The first four segments must cost 24 or less, or the nursery's three small pens no longer buy its bigger swarm.
//           (The Pearl takes a fifth off.)
//   toll    what a rift takes as the fish goes down it: `part` of every segment over `over`, never fewer than `least`. It never leaves a fish
//           with fewer than `keep`, the least that can still take a small swarm: a fish that cannot spare it is turned back while there is
//           still something here it could eat, and let through for nothing when there is not.
//   charge  full grown, food is not wasted: `full` fish fill the crest. Charged, a dash goes `reach` times as far, and the next ram that lands
//           counts for `blows` and stuns what is within `shock` metres for `stun` seconds. That spends it.
const LENGTH = { cost: [5, 17], bend: 1.15, toll: { part: 0.4, over: 8, least: 2, keep: 8 }, charge: { full: 30, reach: 1.5, blows: 2, shock: 6, stun: 2.5 } };
const growCost = (segs, discount = 1) => Math.max(1, Math.round(lerp(LENGTH.cost[0], LENGTH.cost[1], Math.pow(clamp((segs - START_SEGS) / (MAX_SEGS - 1 - START_SEGS), 0, 1), LENGTH.bend)) * discount));
// The oars. An oarfish is named for the two long fins under its chin, and here they are rowed: pull the left and the right in turn, on
// the beat of the band. A pull in time adds a voice to a chord the band holds for the fish (`top` of them) and each voice adds `speed` to
// its pace. That is all there is to learn. What there is to master: a pull between the beats, where the band swings it, adds `drive` on
// top (up to `driveTop` pulls of it) and is lost at the first one missed; both oars together on the first beat of a bar, with `surgeAt`
// voices or more, is a surge; and all of it has to be kept up while steering, wrapping and running away.
// good, perfect: how near the beat a pull must be, in seconds. hold: beats the chord lasts with no pull before a voice goes.
const OARS = { good: 0.115, perfect: 0.045, top: 5, speed: 0.15, hold: 2, drive: 0.05, driveTop: 8, surgeAt: 3, surge: 0.7, both: 0.09, sprint: 0.5, tempo: 0.5 };
// Catches in a row: one within `window` seconds of the last adds a layer to the band, up to `top` of them, and the top one is a solo.
// A bite ends it.
const CHAIN = { window: 9, top: 3 };
const riftToll = (segs) => Math.max(LENGTH.toll.least, Math.round((segs - LENGTH.toll.over) * LENGTH.toll.part));
// Stamina. It is only spent while something is hunting the fish; with nothing about, sprinting and dashing are free.
// sprint: seconds of sprint in a full bar. regen: seconds to refill, after `pause` seconds of not spending.
// dash: the share of the bar one dash costs. cool: seconds between dashes. linger: how long a hunt still counts after it breaks off.
const STAMINA = { sprint: 5, regen: 3, pause: 0.7, dash: 0.3, cool: 0.55, linger: 1.5 };

// The score as shipped: slider values 0..100 for every depth, then any depth that should sound different.
// A preset code from the drawer drops straight in here (zones are numbered from 0, the sunlight zone).
const MUSIC_KEYS = ['dream', 'energy', 'menace', 'react', 'swing', 'band'];
const SHIPPED_MUSIC = { all: { dream: 60, energy: 50, menace: 50, react: 70, swing: 60, band: 50 }, zones: {} };
// Every dive is built from one number, its seed, drawn afresh each time. Players never see it; the checks start a dive
// from a known one (`startRun(4242)`) so that they stand in the same world every run.
const SHIPPED_FEEL = { assist: 60, mode: 'point', look: 50, rumble: 70 }; // help with wrapping a swarm; which controls a new player gets; look speed
// The two views. 'point' is the plate: high, far and flat, and the mouse says where to swim. 'look' is the
// adventure camera: nearer and wider, free to drop below the fish, and the mouse (or the right stick) turns it.
const VIEW = { point: { fov: 30, k: 1, low: 0.16 }, look: { fov: 40, k: 0.66, low: -0.3 } };
const LOOK_LEVEL = 0.34; // the tilt the adventure camera settles at behind the fish; with the view here, forward is level
const PLATE_LEVEL = 0.56; // and the tilt the plate is seen at; with both mouse buttons held, that is where forward is level
const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// Everything a key or a controller button can be set to do, in the order the binding menu lists it.
// A key action takes up to two keys. Movement on a controller is always the left stick, and looking the right.
const ACTIONS = [
  ['up', 'Swim forward'], ['down', 'Swim back'], ['left', 'Swim left'], ['right', 'Swim right'],
  ['sprint', 'Dash, hold to sprint'], ['wrap', 'Wrap or coil, side picked for you'], ['wrapL', 'Wrap or coil left'], ['wrapR', 'Wrap or coil right'],
  ['oarL', 'Left oar, on the beat'], ['oarR', 'Right oar, on the beat'],
  ['rise', 'Rise'], ['dive', 'Dive'], ['shed', 'Shed tail as bait'], ['pause', 'Pause'], ['full', 'Full screen'], ['hide', 'Keys and tools on screen'],
  ['view', 'Switch camera'], ['behind', 'Bring the view behind you'], ['zoomIn', 'Zoom in'], ['zoomOut', 'Zoom out'],
];
const STICK = new Set(['up', 'down', 'left', 'right']);
const DEFAULT_BINDS = {
  keys: { up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], sprint: ['ShiftLeft', 'ShiftRight'], wrap: [], wrapL: ['KeyQ'], wrapR: ['KeyE'], oarL: ['KeyJ', 'Digit1'], oarR: ['KeyK', 'Digit2'],
    rise: ['Space'], dive: ['KeyC'], shed: ['KeyX'], pause: ['KeyP'], full: ['KeyF'], hide: ['KeyH'], view: ['KeyV'], behind: [], zoomIn: [], zoomOut: [] },
  pad: { sprint: 7, wrap: 6, wrapL: null, wrapR: null, oarL: 0, oarR: 1, rise: 5, dive: 4, shed: 2, pause: 9, full: null, hide: 8, view: null, behind: 11, zoomIn: 12, zoomOut: 13 },
};
// a clean copy of a set of bindings, with anything missing or malformed taken from the defaults
function cleanBinds(b) {
  const keys = {}, padB = {};
  for (const [a] of ACTIONS) {
    const k = b?.keys?.[a];
    keys[a] = Array.isArray(k) ? k.filter((c) => typeof c === 'string').slice(0, 2) : [...DEFAULT_BINDS.keys[a]];
    if (!STICK.has(a)) { const n = b?.pad?.[a]; padB[a] = Number.isInteger(n) && n >= 0 && n < 18 ? n : b?.pad && a in b.pad ? null : DEFAULT_BINDS.pad[a]; }
  }
  return { keys, pad: padB };
}
const KEY_NAMES = { ShiftLeft: 'Shift', ShiftRight: 'R Shift', Space: 'Space', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Enter: 'Enter', Tab: 'Tab', CapsLock: 'Caps', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\' };
const keyName = (code) => (!code ? '' : code.startsWith('Key') ? code.slice(3) : code.startsWith('Digit') ? code.slice(5) : KEY_NAMES[code] || code.replace(/^Numpad/, 'Num '));
const NO_FOES = { update() {}, catchWith: () => [], ram: () => [], stun: () => 0, blast: () => [], kill: () => null, mines: [], leeches: [], spawnPiece() {}, dispose() {}, state: { danger: 0 }, pieces: [], biters: [], anglers: [], hooks: [] }; // nothing hunts at the surface

const $ = (id) => document.getElementById(id);
const store = {
  get(k, fallback) { try { const v = localStorage.getItem(k); return v === null ? fallback : JSON.parse(v); } catch { return fallback; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage is a convenience only */ } },
};

export async function start(saved = {}) {
  const stage = $('stage');
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = matchMedia('(hover: none), (pointer: coarse)').matches;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  stage.prepend(renderer.domElement);
  const canvas = renderer.domElement;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color();
  scene.fog = new THREE.Fog(0x000000, 16, 74);
  const hemi = new THREE.HemisphereLight('#ffffff', '#ffffff', 2);
  const sun = new THREE.DirectionalLight('#fff3d2', 2.3);
  const SUN_OFFSET = new THREE.Vector3(9, 34, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -27, right: 27, top: 27, bottom: -27, near: 1, far: 90 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.05;
  const lamp = new THREE.PointLight('#ffe6ee', 0, 30, 1); // the fish's own glow, all there is in the deep
  const crest = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffd27a', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, fog: false })); // the charge a full-grown fish eats into its crest: seen on the fish, not on the plate
  crest.renderOrder = 5; scene.add(crest);
  scene.add(hemi, sun, sun.target, lamp);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.3, 260);

  // ---------------------------------------------------------------- the oarfish, rebuilt whenever its length changes
  const fishPulse = { value: new THREE.Vector3(-1, 0, 1) }; // where the swell is along the body (0 the head, 1 the tail), how strong, and the body's length as the model has it
  const pulse3 = { at: 9, k: 0, pace: 1.5 }; // the swell on its way: see growPulse
  const fishMats = {};
  for (const [name, color] of Object.entries(PALETTE)) {
    fishMats[name] = new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0, flatShading: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    fishMats[name].name = name;
    fishMats[name].onBeforeCompile = (sh) => { // a swell of light that runs from the head to the tail when the fish grows
      sh.uniforms.uPulse = fishPulse;
      sh.vertexShader = `uniform vec3 uPulse;\nvarying float vPulse;\n${sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vPulse = uPulse.y * exp(-pow((-position.z / uPulse.z - uPulse.x) / 0.085, 2.0));\n  transformed.xy *= 1.0 + 0.22 * vPulse;')}`;
      sh.fragmentShader = `varying float vPulse;\n${sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += vec3(1.0, 0.86, 0.6) * vPulse * 0.55;')}`;
    };
  }
  // the oarfish is a component too: its colours as they stand now, laid on the materials every length of body shares
  const paintFish = () => { const pal = resolve('oarfish').palette; for (const name of Object.keys(fishMats)) fishMats[name].color.set(pal[name[0].toLowerCase() + name.slice(1)] || PALETTE[name]); };
  paintFish();
  // a faint tint of the fish wherever a column or rock hides it, drawn before the fish itself
  const ghostMat = new THREE.MeshBasicMaterial({
    color: '#f4a4b9', depthFunc: THREE.GreaterDepth, depthWrite: false, fog: false,
    blending: THREE.CustomBlending, blendSrc: THREE.ConstantAlphaFactor, blendDst: THREE.OneMinusConstantAlphaFactor, blendAlpha: 0.4,
  });
  const wireMat = new THREE.MeshBasicMaterial({ color: '#06222e', wireframe: true, transparent: true, opacity: 0.6 });
  const rig = new OarfishRig();
  const show = { wire: !!saved.wire, bones: !!saved.bones };
  let fish = null;
  function buildFish(segments) {
    if (fish) { scene.remove(fish.group, fish.helper); fish.mesh.geometry.dispose(); fish.mesh.skeleton.dispose(); fish.helper.dispose?.(); }
    const built = buildOarfish({ bones: segments, materials: fishMats, merge: false, clip: false });
    fishPulse.value.z = 0.78 * 0.4 * segments; glowFish(segments); // the model's own length, for the swell; and the glow its length has earned
    const mesh = built.mesh;
    const twin = (material, order) => { const m = new THREE.SkinnedMesh(mesh.geometry, material); m.bind(mesh.skeleton, mesh.bindMatrix); m.frustumCulled = false; m.renderOrder = order; built.group.add(m); return m; };
    mesh.frustumCulled = false; // the bones carry the mesh far from its rest-pose bounds
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.renderOrder = 2;
    const ghost = twin(ghostMat, 1), wire = twin(wireMat, 3);
    wire.visible = show.wire;
    const helper = new THREE.SkeletonHelper(built.group);
    helper.visible = show.bones; helper.frustumCulled = false;
    scene.add(built.group, helper);
    fish = { group: built.group, mesh, ghost, wire, helper };
    rig.attach(built.group);
    for (const s of run.shells) { // each shell sits on the back of the segment that carries it
      const bone = rig.spine[s.seg - 1];
      if (!bone) continue;
      const m = kit.mesh(s.type, 0.27); m.position.set(0, 0.11, -0.12); m.renderOrder = 2;
      bone.add(m);
    }
  }
  const kit = createShellKit();

  // ---------------------------------------------------------------- effects: caught things fly to the mouth, a closed loop flashes
  const glowMap = glowTexture();
  const MOTES = 96, moteArr = new Float32Array(MOTES * 3).fill(-9999), motes = [];
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(moteArr, 3));
  const moteCloud = new THREE.Points(moteGeo, new THREE.PointsMaterial({ map: glowMap, color: '#fff2c2', size: 0.5, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  moteCloud.frustumCulled = false;
  const FLASH_MAX = 40, flashArr = new Float32Array(FLASH_MAX * 9);
  const flashGeo = new THREE.BufferGeometry();
  flashGeo.setAttribute('position', new THREE.BufferAttribute(flashArr, 3));
  const flash = new THREE.Mesh(flashGeo, new THREE.MeshBasicMaterial({ color: '#ff9db8', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
  flash.frustumCulled = false;
  scene.add(moteCloud, flash);
  // from: where it starts. wait: seconds before it sets off. stream: the catch it belongs to, if it is part of one (see `gulp`)
  function mote(from, food, wait = Math.random() * 0.09, stream = null) {
    if (motes.length >= MOTES) { if (stream) { stream.food += food; stream.total--; } else addFood(food); return; }
    motes.push({ from: from.clone(), t: -wait / 0.5, food, stream });
  }
  // A swarm that has been wrapped is not eaten all at once. It streams to the mouth, the nearest fish first, over a time that grows with
  // the swarm; each arrival steps a run of notes up the scale (music.gulp); and only when the last is in does the fish grow, all at once.
  // points: where the swarm's fish were. size: the swarm against a great one, 0 to 1.
  function gulp(points, food, size) {
    const n = Math.min(points.length, 24), per = Math.ceil(points.length / n), span = lerp(0.3, 1.15, size), each = food / points.length;
    const stream = { total: 0, in: 0, food: 0, notes: Math.round(lerp(5, 14, size)), played: -1, size };
    const near = points.map((p) => [p, p.distanceToSquared(rig.snout)]).sort((a, b) => a[1] - b[1]);
    for (let i = 0, k = 0; i < near.length; i += per, k++) { stream.total++; mote(near[i][0], each * Math.min(per, near.length - i), (k / Math.max(1, n - 1)) * span, stream); }
    if (stream.total <= 0) addFood(Math.round(food), size); // there was no room for a single spark: it is eaten all the same
    stream.notes = Math.max(1, Math.min(stream.notes, stream.total)); // never more notes than there are sparks to sound them
    return stream;
  }
  // light up the patch of water the body has just closed round: nose, then the first k joints
  function flashWrap(k, y) {
    const pts = [rig.snout, ...rig.joints.slice(0, k + 1)], n = Math.min(pts.length, FLASH_MAX);
    let cx = 0, cz = 0;
    for (let i = 0; i < n; i++) { cx += pts[i].x; cz += pts[i].z; }
    cx /= n; cz /= n;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      flashArr.set([cx, y, cz, a.x, y, a.z, b.x, y, b.z], i * 9);
    }
    flashGeo.setDrawRange(0, n * 3);
    flashGeo.attributes.position.needsUpdate = true;
    flash.material.opacity = 0.55;
  }

  // ---------------------------------------------------------------- the run
  const music = createMusic();
  const pad = createPad();
  let dev = 'keys'; // what the player last touched: 'keys' (keyboard, mouse, finger) or 'pad'
  // a moment of the game, told to the band and, on a controller, to its motors
  const RUMBLE = { dash: [0, 0.3, 70], ram: [0.8, 0.6, 140], wake: [0.8, 0.4, 900], open: [1, 0.8, 900], close: [0.3, 0.6, 1200], bite: [0.9, 0.5, 260], snag: [0.7, 0.9, 220], shed: [0.4, 0.7, 160], catch: [0, 0.45, 110], kill: [0.5, 0.7, 180], grow: [0, 0.25, 90], crest: [0.5, 0.5, 320], cache: [0.6, 0.6, 260], surge: [0.5, 0.6, 200], burst: [0.2, 0.5, 120], flit: [0, 0.22, 70], part: [0.15, 0.4, 110], descend: [0.3, 0.2, 500], dead: [1, 0.6, 700], win: [0.2, 0.5, 600] };
  function moment(kind, strength) {
    music.hit(kind, strength);
    const r = RUMBLE[kind];
    if (r && kind === 'catch' && strength !== undefined) buzz(0.75 * strength * strength, r[1] * (0.6 + 0.6 * strength), r[2] + 130 * strength); // a bigger catch is a bigger thump
    else if (r) buzz(r[0], r[1], r[2]);
  }
  // ---- what the hands feel. The controller plays one effect at a time, so everything is mixed here: a hit is an
  // envelope that dies away, and under the hits run the things that last (a hunter closing, a loop closing, speed).
  const hap = { pulses: [], sent: 0, last: [0, 0], beat: 0, click: 0, wrap: 0, sprint: 0, log: null };
  function buzz(strong, weak, ms) { hap.pulses.push({ s: strong, w: weak, t: ms / 1000, full: ms / 1000 }); }
  function haptics(dt) {
    let s = 0, w = 0;
    for (const p of hap.pulses) { const k = Math.sqrt(clamp(p.t / p.full, 0, 1)); s = Math.max(s, p.s * k); w = Math.max(w, p.w * k); p.t -= dt; }
    hap.pulses = hap.pulses.filter((p) => p.t > 0);
    if (!paused && run.state === 'play') {
      // something is after the body: a heartbeat, two knocks to the beat, quicker and harder as it closes
      const fear = Math.max(foes.state.danger, sum ? sum.state.danger : 0, guard ? guard.state.danger : 0);
      if (fear > 0.2) { hap.beat = (hap.beat + dt * lerp(1.0, 2.3, fear)) % 1; const knock = hap.beat < 0.1 ? 1 : hap.beat > 0.22 && hap.beat < 0.3 ? 0.55 : 0; s = Math.max(s, knock * lerp(0.3, 0.75, fear)); } else hap.beat = 0;
      // a loop closing: a hum that climbs, and a click at each eighth of the way round
      if (hap.wrap > 0.04) { w = Math.max(w, 0.05 + 0.22 * hap.wrap); const step = Math.floor(hap.wrap * 8); if (step > hap.click) buzz(0, 0.55, 50); hap.click = step; } else hap.click = 0;
      // water over the body at a sprint
      hap.sprint = damp(hap.sprint, clamp((rig.speed - SPEED.swim) / (SPEED.sprint - SPEED.swim), 0, 1), 6, dt); w = Math.max(w, 0.11 * hap.sprint);
      // a leech feeding
      if (foes.state.leeched) w = Math.max(w, 0.14 + 0.1 * Math.sin(run.time * 8));
    }
    s *= feel.rumble; w *= feel.rumble;
    if (hap.log) hap.log.push([+s.toFixed(2), +w.toFixed(2)]);
    if (dev !== 'pad' || !pad.state.connected) return;
    hap.sent -= dt;
    if (s > 0.012 || w > 0.012) { if (hap.sent <= 0 || Math.abs(s - hap.last[0]) > 0.05 || Math.abs(w - hap.last[1]) > 0.05) { pad.rumble(s, w, 140); hap.sent = 0.08; hap.last = [s, w]; } }
    else if (hap.last[0] || hap.last[1]) { pad.still(); hap.last = [0, 0]; }
  }
  const session = { dives: 0, played: 0, frames: 0, clock: 0 }; // what this visit has been like, for a note of feedback
  const fb = { open: false, own: false }; // the feedback sheet. own: it opened over the end of a dive, with no pause menu under it
  const run = { seed: 1, floor: 0, segs: START_SEGS, food: 0, charge: 0, toll: 0, chain: 0, chainT: 0, harmony: 0, drive: 0, caches: [], haul: null, hauled: 0, cleaned: 0, caught: 0, longest: START_SEGS, time: 0, state: 'play', stateT: 0, safe: 0,
    stamina: 1, winded: false, hunted: 0, rest: 9, dashCool: 0, kick: 0, freeze: 0, shells: [], noRoom: -9 };
  let mods = shellMods([]), field = null; // what the worn shells add up to; the shells lying about this band
  let world = null, foes = null;
  const wrapD = (d) => (world ? world.wrap(d) : d); // the shortest way round the world the dive is in: each band says how far across it is
  let sum = null, arena = null, guard = null; // guard: what keeps this band's rift // the last band's boss, and the band's collisions with the boss's body added
  // how the dive ends, once the Sum is dealt with: 'open' (its head ringed) or 'close' (its gap filled)
  const end = { kind: null, swap: 0, quake: 0, vista: 0, turn: 0, burst: -9 };
  const cine = () => run.state === 'opening' || run.state === 'rise' || run.state === 'surface' || run.state === 'closing';
  const cam = { yaw: 0.62, pitch: PLATE_LEVEL, zoom: 1, dist: 15, fit: 1, fov: VIEW.point.fov, k: 1, pull: 1, ease: null };
  const feel = { assist: SHIPPED_FEEL.assist / 100, mode: 'point', look: SHIPPED_FEEL.look / 100, rumble: SHIPPED_FEEL.rumble / 100 };
  const focus = new THREE.Vector3();
  const game = {
    safe: () => run.safe > 0 || run.hush > 0 || run.state !== 'play', // (hush: left to itself and swimming figures, or only just taken back. It is not `safe`, which shows: the fish blinks)
    // a hunter has reached a bait: what the shell that went with the bait does about it
    baited(decoy, hunter) {
      if (decoy.fx === 'spire') { for (const h of foes.blast(decoy.pos, 2.8)) mote(h.pos, h.food); decoy.life = Math.min(decoy.life, 0.15); run.kick = 1; moment('kill'); }
      else if (decoy.fx === 'spine') { const h = foes.kill(hunter); if (h) { mote(h.pos, 1); moment('ram'); } }
      else if (decoy.fx === 'tusk') mote(decoy.pos, 2);
    },
    fed: (pos, food) => mote(pos, food), // something died on the body
    leech(joint, from) { // a leech eats what the fish has eaten; with nothing there, it eats the fish
      if (run.food > 0) { run.food--; pulse('hurt'); } else game.bite(1, joint, from, 'leech');
      say('leech', `A leech is on you, eating what you have eaten. ${dev === 'pad' ? `Tap ${pb('sprint')}` : touch ? 'Tap Dash' : `Tap ${kb('sprint')}`} to throw it off, or coil tight to crush it.`, 8);
    },
    bite(n, joint, from, kind) {
      if (game.safe()) return false;
      if (rig.dashT > 0 && Number.isInteger(joint) && joint <= Math.ceil(rig.spine.length / 3)) return false; // mid-dash the front of the body cannot be bitten; the tail still can
      const cap = run.shells.findIndex((s) => s.type === 'cap');
      if (cap >= 0) { // the Cap takes it
        run.shells.splice(cap, 1); shellsChanged(); buildFish(run.segs);
        run.safe = 1; pulse('hurt'); moment('burst'); tell('It took that bite for you.', 4, { kind: 'warn', title: 'The Cap broke' });
      } else lose(n, kind);
      if (mods.thorns && kind === 'biter') { const h = foes.kill(foes.biters.find((b) => b.pos === from)); if (h) for (let i = 0; i < 2; i++) foes.spawnPiece(h.pos, 'debris'); }
      return true;
    },
  };
  const bodyMetres = () => rig.length + 0.5;

  function applyLook(F) {
    scene.background.set(F.water); scene.fog.color.set(F.water);
    hemi.color.set(F.sky); hemi.groundColor.set(F.bed); hemi.intensity = F.hemi;
    sun.intensity = F.sun; sun.castShadow = F.sun > 0.2;
    lamp.intensity = F.lamp; lamp.distance = F.lampReach * mods.lamp;
    glowFish();
  }
  // The fins and the eye give light: as much as the band asks for, and more the longer the fish is, a step at each standing (see
  // `stature` in oarfish.js), so that a long fish glows a little even in daylight and a good deal in the dark.
  const STATURE_GLOW = [0, 0.1, 0.22, 0.38];
  function glowFish(segs = run.segs) { const F = world?.floor || FLOORS[0], rank = stature(segs), k = F.finGlow * (1 + 0.3 * rank) + STATURE_GLOW[rank] + 0.06 * run.harmony; // and a little for every voice it is rowing
    for (const n of ['FinPale', 'FinPink', 'FinMid', 'FinRed', 'Eye']) { fishMats[n].emissive.set(PALETTE[n]); fishMats[n].emissiveIntensity = k * (n === 'Eye' ? 1.4 : 1); } }
  function enterFloor(index, fromAbove) {
    run.haul = null; // what was being carried stays in the band it was found in
    sum?.dispose(); sum = null;
    world?.dispose(); foes?.dispose();
    run.floor = index;
    world = createWorld(scene, { seed: run.seed, floor: index, calm, nursery: index === 0 && teach.on && !teach.done && !window.__noNursery,
      nest: index === 0 ? { record: nest.record, fragments: nest.fragments, places: SHELL_TYPES.map((type) => ({ type, found: nest.shells.includes(type), sign: SHELL_FEATS[type] || null, open: !SHELL_FEATS[type] || !!nest.feats[SHELL_FEATS[type]] })) } : null });
    nestShells.length = 0; // the shells the nest has to show, each over its own place (the world made the places; the shells are this file's to make)
    if (world.react?.nest) for (const p of world.react.nest.places) if (p.found) { const m = kit.mesh(p.type, 0.95); m.position.set(p.x, p.y, p.z); world.react.nest.group.add(m); nestShells.push({ m, p, ph: nestShells.length * 1.7 }); }
    foes = createFoes(scene, world, { seed: run.seed }, game);
    field?.dispose(); field = createShellField(scene, world, kit, { seed: run.seed, floor: index, count: world.hall ? 2 : 3, types: run.pool || SHELL_TYPES });
    Object.assign(tut, { on: !!world.nursery, step: 0, stall: 0, told: false, was: 0, prize: null });
    if (tut.on && field.items[0]) { const it = field.items[0]; it.taken = true; it.group.visible = false; tut.prize = it.type; } // the band's first shell waits in the sealed jar
    $('btn-skip').hidden = !tut.on;
    guard?.dispose(); guard = null;
    if (world.hall) sum = createSum(scene, world, { seed: run.seed }, sumGame); // the palace: its wall is the Sum
    else guard = createGuard(scene, world, { seed: run.seed, floor: index }, guardGame); // every rift has its keeper
    arena = { height: world.height, ceiling: world.ceiling, pushOut(p, r) { world.pushOut(p, r); sum?.pushOut(p, r); guard?.pushOut(p, r); } }; // the Sum is solid, and so is the veil over a kept rift
    Object.assign(end, { kind: null, swap: 0, quake: 0, vista: 0, burst: -9 }); cam.shake = 0;
    goalEl.style.display = ''; fade(false);
    applyLook(world.floor);
    const y = Math.min(world.height(world.spawn.x, world.spawn.z) + (fromAbove ? 9.5 : 3.3), world.ceiling - 1);
    rig.reset(new THREE.Vector3(world.spawn.x, y, world.spawn.z), fromAbove ? rig.yaw : world.nursery ? world.nursery.dir : NEST.yaw, fromAbove ? -0.5 : 0);
    if (world.nursery) { cam.yaw = world.nursery.dir + Math.PI; cam.ease = null; rig.speed = SPEED.idle; } // looking down the paved way at the first hoop, and at rest: the first move is the player's
    focus.copy(rig.joints[0]);
    run.state = fromAbove ? 'arrive' : 'play'; run.stateT = 0; run.safe = 1.5;
    $('zone').textContent = world.floor.name;
    $('zone-depth').textContent = `${world.floor.depth} m down`;
    card(world.floor.name, `${world.floor.depth} metres down`);
    music.setScene(index, FLOORS.length);
    showPreset();
    const F = world.floor;
    const how = dev === 'pad' ? 'pad' : touch ? 'touch' : feel.mode; // name the control the player actually has
    if (index === 0) say('loop', `${{ pad: `Hold ${pb('wrap')} beside a small swarm to wrap round it.`, touch: 'Hold a finger on a small swarm, or draw a circle round it.', look: `Hold ${kb('wrapL')} or ${kb('wrapR')}, or the left mouse button, beside a small swarm to wrap round it.`, point: `Hold ${kb('wrapL')} or ${kb('wrapR')} beside a small swarm to wrap round it.` }[how]} Go most of the way round and it is yours, whole.`, 9);
    if (F.biters && !said.has('biters')) { say('biters', 'Biters go for your tail and fear your head. Coil up, face them, or close a loop round them.', 9); say('shed', `${{ pad: pb('shed'), touch: 'Shed', look: kb('shed'), point: kb('shed') }[how]} drops your tail as bait, for three segments. Hunters go to it: ram them there, or wrap them.`, 9); }
    if (F.biters && !said.has('ram')) say('ram', `${{ pad: `Tap ${pb('sprint')}`, touch: 'Tap Dash', look: `Tap ${kb('sprint')}`, point: `Tap ${kb('sprint')}` }[how]} to dash. Dash head-first into a biter and you break it.`, 8);
    if (feel.mode === 'look') cam.ease = { yaw: rig.yaw + Math.PI, pitch: cam.pitch, t: 1 }; // start each band from behind the fish
    if (F.anglers && !said.has('lures')) say('lures', 'A cloud of small cold lights is food. A single warm light is a lure.', 9);
    if (index === FLOORS.length - 1) say('palace', 'The palace gate is near. Swim through it.', 9);
  }
  function startRun(seed = (Math.random() * 1e6) | 0) {
    session.dives++;
    if (end.kind) { cam.zoom = 1; cam.pitch = feel.mode === 'look' ? LOOK_LEVEL : PLATE_LEVEL; cam.ease = null; } // an ending leaves the camera somewhere odd
    Object.assign(run, { seed, segs: START_SEGS, food: 0, charge: 0, toll: 0, chain: 0, chainT: 0, harmony: 0, drive: 0, caches: [], haul: null, hauled: 0, cleaned: 0, caught: 0, longest: START_SEGS, time: 0, stamina: 1, winded: false, hunted: 0, rest: 9, dashCool: 0, kick: 0, freeze: 0, shells: [], noRoom: -9 });
    run.pool = shellPool(nest.feats); // the kinds of shell this dive can turn up: what has been unlocked by now, and no more until the next
    shellsChanged();
    said.clear(); hintQueue.length = 0; hintT = 0;
    motes.length = 0; // a catch still on its way to the mouth belongs to the dive that made it
    $('end').classList.remove('on'); $('fade').classList.remove('on');
    buildFish(run.segs);
    enterFloor(0, false);
    moment('start');
  }

  // ---------------------------------------------------------------- the oars (the rules and the numbers are at OARS, at the top)
  // What shows them: a small light at each side of the head that beats with the band, the one to pull next the brighter; and a ring
  // of light let go at every pull, its colour saying how the pull went, which the fish swims on through.
  const oarLights = [-1, 1].map(() => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffd98a', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, fog: false })); s.renderOrder = 4; scene.add(s); return s; });
  const ringGeo = new THREE.RingGeometry(0.93, 1, 36);
  const oarRings = Array.from({ length: 8 }, () => { const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffd98a', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide })); m.visible = false; m.frustumCulled = false; m.userData = { t: 9, life: 0.5, from: 0.4, to: 1.5, peak: 0.7 }; scene.add(m); return m; });
  const RING = { good: ['#ffd98a', 0.5, 0.55], perfect: ['#ffffff', 0.85, 0.6], drive: ['#9fe8ff', 0.5, 0.4], surge: ['#ffffff', 0.9, 0.8], miss: ['#b0506a', 0.45, 0.3] }; // colour, how bright, how long
  const oars = { side: 0, beat: -99, offBeat: -99, idle: 0, seen: null, pairAt: -9, pairSide: 0, pairBeat: -99, pending: null, surged: -99, metronome: false, last: '', ring: 0, level: 0, awake: 0 };
  function oarRing(kind, size = 1) {
    const m = oarRings[oars.ring++ % oarRings.length], [colour, peak, life] = RING[kind];
    m.material.color.set(colour); m.position.copy(rig.joints[0]); m.lookAt(m.position.x + rig.forward.x, m.position.y + rig.forward.y, m.position.z + rig.forward.z);
    Object.assign(m.userData, { t: 0, life, from: 0.35 * size, to: (kind === 'miss' ? 0.7 : 1.1 + 0.22 * run.harmony) * size, peak }); m.visible = true;
  }
  // Where the beat is: the band's own, if it is playing; else a plain count kept from the dive's clock, so that the oars work with no
  // sound at all. d: seconds from the nearest beat (negative, early). offD: the same from the nearest swung off-beat.
  function beatNow() {
    const p = oars.metronome ? null : music.pulse();
    if (p) return p;
    const dur = OARS.tempo, t = run.time, k = Math.round(t / dur), off = 0.66 * dur, ko = Math.round((t - off) / dur);
    return { d: t - k * dur, index: k, dur, offD: t - (ko * dur + off), offIndex: ko, phase: (((t / dur) % 1) + 1) % 1 };
  }
  // One oar pulled: side -1 the left, 1 the right. Returns what came of it: 'good', 'perfect', 'drive', 'surge', 'both', 'again', 'miss',
  // 'wait' (the wrong oar for this beat, unless the other comes with it: see rowing), or '' if it did not count at all.
  function stroke(side) {
    if (run.state !== 'play' || paused) return '';
    const b = beatNow(), onBeat = Math.abs(b.d) <= OARS.good, onOff = Math.abs(b.offD) <= OARS.good * 0.8;
    const done = (kind) => { oars.last = kind; return kind; };
    oars.awake = 12; rig.pull(side);
    const lands = (sd) => { // a pull in time, by the oar whose turn it was
      const perfect = Math.abs(b.d) <= OARS.perfect;
      run.harmony = Math.min(OARS.top, run.harmony + 1); oars.side = sd; oars.beat = b.index; oars.idle = 0; oars.pairAt = run.time; oars.pairSide = sd; oars.pairBeat = b.index;
      music.oar(perfect ? 'perfect' : 'good', run.harmony); buzz(0, perfect ? 0.3 : 0.2, 35); oarRing(perfect ? 'perfect' : 'good');
      if (run.harmony >= 4) say('oars2', 'Between the beats, where the band swings, a pull adds drive on top. Both oars together on the first beat of a bar is a surge.', 9);
      return perfect ? 'perfect' : 'good';
    };
    const together = () => { // both oars on one beat: a surge, if it is the first of the bar and there is chord enough behind it
      if (b.index % 4 !== 0 || run.harmony < OARS.surgeAt || oars.surged === b.index) return done('both');
      oars.surged = b.index; rig.boost = Math.max(rig.boost, OARS.surge); run.kick = Math.max(run.kick, 0.45);
      music.oar('surge', run.harmony); buzz(RUMBLE.surge[0], RUMBLE.surge[1], RUMBLE.surge[2]); oarRing('surge', 1.3); oarRing('surge', 0.8);
      return done('surge');
    };
    const held = oars.pending; // the wrong oar, pulled a moment ago on this beat and waiting to see if this one comes with it
    if (held && onBeat && held.beat === b.index && held.side === -side && run.time - held.at <= OARS.both) { oars.pending = null; lands(side); return together(); }
    if (onBeat && oars.pairBeat === b.index && oars.pairSide === -side && run.time - oars.pairAt <= OARS.both) return together(); // the other oar, hard on the first
    if (onBeat && b.index === oars.beat) return done('again'); // a second pull on a beat already rowed: nothing gained, nothing lost
    if (onBeat && side !== oars.side) return done(lands(side));
    if (onBeat && run.harmony > 0) { oars.pending = { side, at: run.time, beat: b.index }; return done('wait'); } // in time, but the same oar as the last: a miss, unless it is half of a pair
    if (onOff && side !== oars.side && run.harmony >= 2 && b.offIndex !== oars.offBeat) { // between the beats, where the band swings it
      run.drive = Math.min(OARS.driveTop, run.drive + 1); oars.side = side; oars.offBeat = b.offIndex;
      music.oar('drive', run.harmony); buzz(0, 0.14, 25); oarRing('drive', 0.7);
      return done('drive');
    }
    return done(fumble(side));
  }
  // a pull that was out of time, or out of turn: it costs a voice and all the drive. With nothing built it is only a splash
  function fumble(side) {
    if (run.harmony <= 0 && run.drive <= 0) { oars.side = 0; return ''; }
    run.harmony = Math.max(0, run.harmony - 1); run.drive = 0; oars.side = side;
    music.oar('miss'); oarRing('miss', 0.8);
    return 'miss';
  }
  // every frame: voices go when the rowing stops, the pace follows what is held, and the lights and rings are drawn
  function rowing(dt) {
    const b = beatNow(), playing = run.state === 'play';
    if (!playing) { run.harmony = 0; run.drive = 0; oars.side = 0; oars.pending = null; }
    if (oars.pending && run.time - oars.pending.at > OARS.both) { const p = oars.pending; oars.pending = null; oars.last = fumble(p.side); } // the other oar did not come: it was the wrong one
    if (oars.seen === null || Math.abs(b.index - oars.seen) > 8) oars.seen = b.index; // a new dive, or the band has only now begun
    while (playing && oars.seen < b.index) { // a beat has gone by: was it rowed?
      const i = oars.seen++;
      if (oars.beat !== i && run.harmony > 0 && ++oars.idle > OARS.hold) run.harmony--;
      if (oars.offBeat < i - 1 && run.drive > 0) run.drive = Math.max(0, run.drive - 2);
    }
    if (run.harmony <= 0) run.drive = 0;
    rig.tempo = damp(rig.tempo, (1 + OARS.speed * run.harmony + OARS.drive * run.drive) * (run.haul ? HAUL.slow : 1), 3.5, dt); // a load slows it
    if (run.harmony !== oars.level) { oars.level = run.harmony; glowFish(); }
    // the lights: one at each side of the head, where the oars are rooted, flashing on the beat and resting between
    const beat = Math.exp(-b.phase * 6), sx = Math.cos(rig.yaw), sz = -Math.sin(rig.yaw), h = rig.joints[0], next = oars.side === 0 ? 0 : -oars.side; // (sx, sz) points to the fish's own left
    oars.awake = Math.max(0, oars.awake - dt); const lit = !playing ? 0 : oars.awake > 0 || run.harmony > 0 ? 1 : 0.4; // faint until an oar has been tried, so that a player who never rows is not nagged
    oarLights.forEach((s, k) => { const sd = k ? 1 : -1, due = next === 0 || next === sd, on = due ? 1 : 0.3;
      s.position.set(h.x - sx * sd * 0.55, h.y - 0.22, h.z - sz * sd * 0.55); s.scale.setScalar(0.35 + 0.6 * beat * on + 0.06 * run.harmony);
      s.material.opacity = damp(s.material.opacity, lit * on * (0.1 + 0.05 * run.harmony + 0.75 * beat * (0.55 + 0.09 * run.harmony)), 16, dt); });
    for (const m of oarRings) { const u = m.userData; if (u.t >= u.life) { m.visible = false; continue; } u.t += dt; const k = clamp(u.t / u.life, 0, 1); m.scale.setScalar(lerp(u.from, u.to, 1 - (1 - k) * (1 - k))); m.material.opacity = u.peak * (1 - k) * (1 - k); }
  }
  // ---------------------------------------------------------------- hauling: a fragment of the ruins, wrapped and dragged to the rift
  // Go round a fallen column top as round a swarm and the body takes hold of it. It rides under the body from then on, and the body is
  // tied up with it: no wrapping, no shedding the tail, and a slower swim. A bite shakes it loose; so does the shed key, which lets it go
  // on purpose. Carried out over the open rift (or to the palace gate) it is given to the deep, and counted: in this dive, for the card
  // at its end, and for good, in this browser, for the nest that is to come.
  const HAUL = { slow: 0.85, at: 0.55, grip: 0.8, wait: 1.5 }; // `wait`: seconds a dropped one lies before a body still curled round it can take it up again
  const nest = (() => { const n = store.get('oarfish.nest') || {}; return { ...n, fragments: n.fragments | 0, record: n.record | 0, shells: Array.isArray(n.shells) ? n.shells.filter((t) => SHELLS[t]) : [], feats: { ...(n.feats || {}) } }; })();
  const nestShells = [];
  // what the nest is to remember, noted as it happens so that a dive cut short still counts: the longest body, and each kind of shell found
  function remember() { let changed = false;
    if (run.longest > nest.record) { nest.record = run.longest; changed = true; }
    for (const sh of run.shells) if (!nest.shells.includes(sh.type)) { nest.shells.push(sh.type); changed = true; }
    if (changed) store.set('oarfish.nest', nest); }
  // A feat, done for the first time in any dive, puts a new kind of shell in the pool for the dives after this one (shells.js, SHELL_FEATS).
  function feat(kind) {
    if (nest.feats[kind]) return false;
    nest.feats[kind] = true; store.set('oarfish.nest', nest);
    const type = Object.keys(SHELL_FEATS).find((t) => SHELL_FEATS[t] === kind), d = SHELLS[type];
    if (d) tell(`${d.worn}\nIt can be found from your next dive on.`, 9, { kind: 'shell', kick: 'A new kind of shell', title: d.name, tone: d.colour });
    return true;
  }
  function takeUp(f) { run.haul = f; f.held = true; moment('loop'); buzz(0.4, 0.4, 120); run.kick = Math.max(run.kick, 0.3); }
  function letGo(how) { const f = run.haul; if (!f) return false; run.haul = null; world.react?.settle(f); f.wait = HAUL.wait; if (how === 'bite') buzz(0.5, 0.3, 160); return true; }
  function hauling(dt) {
    const frags = world.react?.fragments; if (!frags || run.state !== 'play') { if (run.haul && run.state !== 'play') letGo('end'); return; }
    const f = run.haul;
    if (!f) { // is the body round one of them?
      const rule = wrapRule(feel.assist);
      const orbit = clamp((0.9 * (bodyMetres() - 0.05)) / rule.sweep, 0.8, 1.5); // the ring the wrap keys swim, as for a swarm: one this body can close
      for (const g of frags) { g.ring.orbit = orbit; if (g.wait > 0) g.wait -= dt; if (g.gone || g.held || g.wait > 0 || Math.hypot(g.ring.x - rig.snout.x, g.ring.z - rig.snout.z) > 7) continue; const w = rig.wrap(g.ring.x, rig.pos.y, g.ring.z, 5.2); if (w.angle >= rule.sweep * HAUL.grip && w.minD > 0.25) { flashWrap(w.k, rig.pos.y); takeUp(g); break; } }
      return;
    }
    const N = rig.joints.length - 1, j = rig.joints[clamp(Math.round(N * HAUL.at), 1, N)]; // it rides under the middle of the body
    f.x = j.x; f.z = j.z; f.y = j.y - 0.62; f.mesh.position.set(f.x, f.y, f.z); f.mesh.rotation.y += dt * 0.4;
    const r = world.rift, there = r ? r.in(rig.pos.x, rig.pos.z) > r.ledge + 0.4 : Math.hypot(wrapD(rig.pos.x - world.goal.x), wrapD(rig.pos.z - world.goal.z)) < 5;
    if (there) { run.haul = null; f.held = false; f.gone = true; run.hauled++; nest.fragments++; store.set('oarfish.nest', nest); moment('cache'); run.kick = Math.max(run.kick, 0.5); flash.material.opacity = Math.max(flash.material.opacity, 0.25); }
  }
  // A cache has been opened by one of the body puzzles in the ruins (world.js, PUZZLE): what was put by in it comes to the mouth, as a
  // catch does, and from some a shell is left lying by it. What is opened is counted, band by band, for whatever keeps score later.
  function openCache(c) {
    const at = new THREE.Vector3(rig.pos.x + wrapD(c.x - rig.pos.x), c.y, rig.pos.z + wrapD(c.z - rig.pos.z));
    gulp(Array.from({ length: 12 }, (_, i) => at.clone().add(new THREE.Vector3(Math.sin(i * 2.4) * 0.5, 0.12 * i, Math.cos(i * 2.4) * 0.5))), c.food, 0.6);
    moment('cache'); run.kick = Math.max(run.kick, 0.5); run.caches[run.floor] = (run.caches[run.floor] || 0) + 1; world.react?.earn('cache'); feat('cache');
    if (c.shell) { const have = new Set([...run.shells.map((s) => s.type), ...field.items.filter((it) => !it.taken).map((it) => it.type)]); field.drop(c.x + 1.6, c.z + 1.2, run.pool.find((t) => !have.has(t)) || SHELL_TYPES[(run.floor * 3 + 1) % SHELL_TYPES.length], 1.1); }
  }
  // The swell that runs down the body when it grows: k is how strong, and a slow one (a new standing) takes its time.
  function growPulse(k, slow = false) { pulse3.at = -0.12; pulse3.k = k; pulse3.pace = slow ? 0.85 : 1.55; }
  // size: how big the catch was that this came from, 0 to 1, if it came from one
  function addFood(n, size = 0) {
    run.food += n; run.caught += n;
    const before = run.segs;
    let grew = false;
    while (run.segs < MAX_SEGS && run.food >= growCost(run.segs, mods.food)) { run.food -= growCost(run.segs, mods.food); run.segs++; grew = true; }
    if (run.segs >= MAX_SEGS && run.food > 0) { // full grown: what it eats goes to its crest
      const was = run.charge; run.charge = Math.min(1, run.charge + run.food / LENGTH.charge.full); run.food = 0;
      if (run.charge >= 1 && was < 1) { moment('grow'); pulse('grow'); }
      say('charge', 'Full grown, what you eat charges your crest. Charged, a dash carries further and your next ram hits twice as hard.', 9);
    }
    if (grew) {
      const up = stature(run.segs) > stature(before), by = run.segs - before;
      buildFish(run.segs); run.longest = Math.max(run.longest, run.segs); remember(); pulse('grow');
      growPulse(up ? 1.5 : clamp(0.7 + 0.12 * by + 0.3 * size, 0.7, 1.3), up);
      moment(up ? 'crest' : 'grow', clamp(0.45 + 0.14 * by + 0.3 * size, 0, 1));
      say('grow', 'Eating makes you longer. Your length is your health.', 7);
      if (up) say('crest', 'Your crest stands taller. You are long enough now for a bigger kind of swarm.', 8);
    }
    if (grew && growCost(run.segs, 1) >= LENGTH.cost[0] + 3) say('cost', 'The longer you are, the more each new segment costs. A long body needs the bigger swarms.', 8);
    if (run.segs >= 12 && run.floor === 0) say('well', 'Follow the marker to the rift and dive down into it when you are ready.', 9);
  }
  function lose(n, kind) {
    const N = rig.spine.length;
    for (let i = 0; i < n; i++) foes.spawnPiece(rig.joints[Math.max(N - i, 1)], 'debris');
    pulse('hurt'); run.chain = 0; run.chainT = 0; run.harmony = Math.max(0, run.harmony - 2); run.drive = 0; letGo('bite');
    if (run.segs - n < MIN_SEGS) return die();
    run.segs -= n; run.safe = 1.5;
    if (trimShells().length) tell('It rode on the segment you lost.', 4, { kind: 'warn', title: 'A shell is gone' });
    buildFish(run.segs);
    moment(kind === 'hook' ? 'snag' : 'bite');
    if (kind === 'hook') say('hooks', 'Hooks hang on lines from above. Keep your whole body clear of them.', 8);
    if (run.segs <= MIN_SEGS + 2) say('low', 'You are nearly too short to survive another bite. Feed.', 7, 'warn');
  }
  function shed() {
    if (run.state !== 'play') return;
    if (letGo('shed')) return; // with a fragment in its coils the tail cannot be shed: the key lets the load go instead
    if (foes.state.stalked > 0) know('shed');
    if (run.segs - SHED_COST < MIN_SEGS) { tell('Too short to shed your tail.', 3, { kind: 'warn' }); return; }
    const worn = run.shells.find((s) => s.seg > run.segs - SHED_COST); // a shell on the part being shed goes with it, and the bait takes its power
    const piece = foes.spawnPiece(rig.joints[rig.spine.length], 'decoy', worn ? worn.type : null);
    run.segs -= SHED_COST; run.safe = 0.9; rig.boost = 1.6;
    trimShells();
    if (worn) throwShell(piece, worn.type);
    buildFish(run.segs);
    moment('shed');
  }
  // ---- shells: which segments can carry one, taking one, losing one, and what one does to a bait
  function shellsChanged() { // after any change to what is worn
    mods = shellMods(run.shells);
    if (world) lamp.distance = world.floor.lampReach * mods.lamp;
    $('scale-shells').innerHTML = run.shells.map((s) => `<i style="left: calc(var(--tick) * ${s.seg - 0.5}); background: ${SHELLS[s.type].colour}"></i>`).join('');
    $('shell-list').innerHTML = run.shells.length
      ? [...run.shells].sort((a, b) => a.seg - b.seg).map((s) => { const d = SHELLS[s.type]; return `<li><i style="background: ${d.colour}"></i><b>${d.name}</b>, on segment ${s.seg}. ${d.worn} Shed with its segment, ${d.shed}</li>`; }).join('')
      : '<li>None yet. They lie glowing about each band; swim your head over one to take it.</li>';
  }
  // ---- the rift's toll. What it would take from the fish as it is; nothing if the fish cannot spare it
  const tollOf = (segs) => (segs - riftToll(segs) >= LENGTH.toll.keep ? riftToll(segs) : 0);
  const couldFeed = () => world.schools.some((sc) => sc.left > 0 && canWrap(bodyMetres() - 0.05, sc.least || sc.ball)); // is there still a swarm here this body could take
  const overRift = () => world.rift && run.floor < FLOORS.length - 1 && (!guard || guard.done) && world.rift.in(rig.pos.x, rig.pos.z) > 0 && rig.pos.y < world.rift.y + 6;
  const tollHere = () => (run.state === 'play' && overRift() ? tollOf(run.segs) : 0);
  function payToll(n) { // the tail goes; the shells that rode on it move up the body to the rearmost places left
    if (n <= 0) return;
    const riding = run.shells.filter((sh) => sh.seg > run.segs - n).sort((a, b) => b.seg - a.seg);
    run.segs -= n; run.shells = run.shells.filter((sh) => sh.seg <= run.segs);
    let lost = 0;
    for (const sh of riding) { let seg = 0; for (let k = SLOT_EVERY; k <= run.segs; k += SLOT_EVERY) if (!run.shells.some((x) => x.seg === k)) seg = k; if (seg) run.shells.push({ type: sh.type, seg }); else lost++; }
    shellsChanged(); buildFish(run.segs);
    tell(lost ? `The rift took ${n} segments, and ${lost === 1 ? 'a shell' : `${lost} shells`} with them: there was no room left to carry ${lost === 1 ? 'it' : 'them'}.` : `The rift took ${n} segments.`, 5, { kind: lost ? 'warn' : 'note', title: 'The toll' });
  }
  function trimShells() { // shells whose segment is no longer there
    const gone = run.shells.filter((s) => s.seg > run.segs);
    if (gone.length) { run.shells = run.shells.filter((s) => s.seg <= run.segs); shellsChanged(); }
    return gone;
  }
  function giveShell(type) { // onto the rearmost free place: every third segment can carry one
    let seg = 0;
    for (let s = SLOT_EVERY; s <= run.segs; s += SLOT_EVERY) if (!run.shells.some((x) => x.seg === s)) seg = s;
    if (!seg) return false;
    run.shells.push({ type, seg }); shellsChanged(); buildFish(run.segs); remember();
    return true;
  }
  function throwShell(piece, type) {
    piece.mesh.add(kit.mesh(type, 0.55));
    if (type === 'ring') { piece.life = piece.full = 14; piece.pull = 44; }
    else if (type === 'cap') { piece.life = piece.full = 21; piece.tough = true; }
    else if (type === 'fan') { run.stamina = 1; run.winded = false; rig.boost = 3; }
    else if (type === 'horn') { foes.stun(piece.pos, 6, 2.5); run.kick = 0.6; }
    else if (type === 'lamp') { foes.stun(piece.pos, 12, 3.5, 'angler'); pulse('grow'); }
    else if (type === 'coil') piece.push = new THREE.Vector3(piece.pos.x - rig.pos.x, 0, piece.pos.z - rig.pos.z).setLength(2.2);
  }
  function die() {
    run.state = 'dead'; run.stateT = 0;
    moment('dead');
    endScreen('Taken by the deep', `You reached ${world.floor.name.replace(/^The /, 'the ')}, ${world.floor.depth} metres down.`);
  }
  // ---- the Sum, and the two ways the dive can end. Nothing here is said in words: the player rings the
  // head or fills the gap, and the world answers.
  // the keeper of a rift: when it falls the veil goes, and it leaves a shell the fish is not wearing
  const guardGame = {
    bite: (n, joint, from) => game.bite(n, joint, from, 'guard'),
    event(kind, pos) {
      if (kind === 'clang') moment('burst');
      else if (kind === 'windup') music.flourish(guard?.kind, 'fill'); // the wind-up of its biggest blow: its instrument plays a fill (seldom: music.js sees to that)
      else if (kind === 'laststand') music.flourish(guard?.kind, 'solo');
      else if (kind === 'turned') say('keeper-shell', 'Its shell turns a ram. Wait until it has struck and missed, then go for a leg.', 7);
      else if (kind === 'slam') { if (pos.distanceTo(rig.pos) < 16) { cam.shake = Math.max(cam.shake, 0.4); moment('burst'); } } // the great claw, or the Keeper itself, coming down on the bed
      else if (kind === 'numb') say('keeper-leg', 'That leg has gone numb. Ram it again, or go round it, and it comes off.', 7);
      else if (kind === 'tear') { moment('kill'); pulse('grow'); run.freeze = Math.max(run.freeze, 0.1); cam.shake = Math.max(cam.shake, 0.5); }
      else if (kind === 'rage') { cam.shake = Math.max(cam.shake, 0.7); music.flourish(guard?.kind, 'solo'); if (guard?.kind === 'keeper') say('keeper-rage', 'It is quicker now, and it digs. Watch the sand.', 6, 'warn'); else say('shearer-rage', 'It is quicker now, and comes back down its line. Watch the silt.', 6, 'warn'); }
      else if (kind === 'aimed') say('shearer-still', 'It feels the water you move. Hold still and its line slides off you.', 7);
      else if (kind === 'sawturned') say('shearer-saw', 'Its saw turns a ram. Come at its side when it is spent, or when the saw is stuck.', 7);
      else if (kind === 'tooth') { moment('kill'); pulse('grow'); run.freeze = Math.max(run.freeze, 0.08); cam.shake = Math.max(cam.shake, 0.4); }
      else if (kind === 'snap') { cam.shake = Math.max(cam.shake, 0.6); moment('burst'); }
      else if (kind === 'down') {
        moment('kill'); pulse('grow'); run.kick = 1; world.react?.earn('guard'); feat('guard');
        const spare = run.pool.filter((t) => !run.shells.some((s) => s.type === t));
        if (field && spare.length) field.drop(pos.x, pos.z, spare[(run.seed + run.floor * 7) % spare.length], 1.1);
      }
    },
  };
  const sumGame = {
    take: (n) => game.bite(n, null, null, 'sum'),
    event(kind) {
      if (kind === 'wake') { moment('wake'); goalEl.style.display = 'none'; end.quake = 0.6; }
      else if (kind === 'loop') moment('loop');
      else if (kind === 'missed') moment('burst');
      else if (kind === 'fill') { moment('grow'); pulse('grow'); }
      else if (kind === 'closed') closeCircle();
    },
  };
  function openCircle() { // its head ringed: the body lets go, and the way up is open
    run.state = 'opening'; run.stateT = 0; end.kind = 'open'; end.turn = rig.yaw;
    sum.ringed(); moment('open'); pulse('grow');
  }
  function closeCircle() { // its gap filled: head meets tail, the palace lights, and the fish stays
    run.state = 'closing'; run.stateT = 0; end.kind = 'close';
    moment('close');
    cam.ease = { yaw: cam.yaw, pitch: 1.12, t: 9, rate: 0.6 };
  }
  const fadeEl = $('fade');
  // the screen goes to one colour and comes back from it; it goes as it came, in the colour it came in
  function fade(on, colour = '', seconds = 0) { if (on) fadeEl.style.background = colour; fadeEl.style.transitionDuration = seconds ? `${seconds}s` : ''; fadeEl.classList.toggle('on', on); }
  function riseInto(index) { // up out of the rift it once went down
    sum?.dispose(); sum = null; field?.dispose(); field = null; guard?.dispose(); guard = null;
    world.dispose(); foes.dispose();
    run.floor = index;
    world = createWorld(scene, { seed: run.seed, floor: index, calm });
    foes = createFoes(scene, world, { seed: run.seed }, game);
    arena = world;
    applyLook(world.floor);
    const g = world.goal;
    rig.reset(new THREE.Vector3(g.x, world.height(g.x, g.z) + 1.4, g.z), rig.yaw, 0.6);
    focus.copy(rig.joints[0]);
    $('zone').textContent = world.floor.name; $('zone-depth').textContent = `${world.floor.depth} m down`;
    goalEl.style.display = 'none';
    music.setScene(index, FLOORS.length);
  }
  function surface() { // under an empty sky
    world.dispose(); foes.dispose(); field?.dispose(); field = null; guard?.dispose(); guard = null;
    const at = { x: rig.pos.x, z: rig.pos.z };
    world = createSurface(scene, at, { x: at.x - Math.sin(cam.yaw) * 10, z: at.z - Math.cos(cam.yaw) * 10 }); // the raft lies beyond the fish, in view
    foes = NO_FOES; arena = world; run.floor = 0;
    applyLook(world.floor);
    rig.reset(new THREE.Vector3(at.x, -7, at.z), rig.yaw, 0.55);
    focus.copy(rig.joints[0]);
    run.state = 'surface'; run.stateT = 0; end.quake = 0; cam.shake = 0;
    $('zone').textContent = ''; $('zone-depth').textContent = '';
    cam.ease = { yaw: cam.yaw, pitch: 0.2, t: 9, rate: 0.7 };
    moment('win');
  }
  function finish() {
    run.state = 'won'; run.stateT = 0;
    const m = Math.floor(run.time / 60), sec = String(Math.floor(run.time % 60)).padStart(2, '0');
    endScreen('The dive is over', `It took ${m}:${sec}.`, FLOORS[FLOORS.length - 1].depth);
  }
  // steer round a point at a set distance: how the fish circles the raft, and how it joins the ring
  function circling(cx, cz, radius, out) {
    const dx = wrapD(rig.pos.x - cx), dz = wrapD(rig.pos.z - cz), d = Math.hypot(dx, dz) || 1, pull = clamp((radius - d) * 0.6, -1, 1);
    return out.set(dz / d + (dx / d) * pull, 0, -dx / d + (dz / d) * pull).normalize();
  }
  // stone coming down while the seabed shakes
  const RUBBLE = 70, rubble = [];
  const rubbleMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: '#cfd4c4', roughness: 0.95, flatShading: true }), RUBBLE);
  rubbleMesh.frustumCulled = false; rubbleMesh.visible = false;
  scene.add(rubbleMesh);
  const rm = new THREE.Matrix4(), rq = new THREE.Quaternion(), re = new THREE.Euler(), rs = new THREE.Vector3(), rp = new THREE.Vector3();
  function fall(dt) {
    const on = end.quake > 0.05 && (run.state === 'opening' || run.state === 'rise');
    rubbleMesh.visible = on;
    if (!on) return;
    for (let i = 0; i < RUBBLE; i++) {
      let r = rubble[i];
      if (!r || r.y < world.height(r.x, r.z) - 1 || Math.hypot(r.x - focus.x, r.z - focus.z) > 26) {
        const a = Math.random() * 6.283, d = 3 + Math.random() * 18;
        r = rubble[i] = { x: focus.x + Math.sin(a) * d, z: focus.z + Math.cos(a) * d, y: focus.y + 6 + Math.random() * 14, v: 3 + Math.random() * 5, s: 0.25 + Math.random() * 0.9, a: Math.random() * 6, w: 1 + Math.random() * 2 };
      }
      r.y -= r.v * dt; r.a += r.w * dt;
      rubbleMesh.setMatrixAt(i, rm.compose(rp.set(r.x, r.y, r.z), rq.setFromEuler(re.set(r.a, r.a * 0.7, r.a * 1.3)), rs.set(r.s, r.s * 0.7, r.s * 1.2)));
    }
    rubbleMesh.instanceMatrix.needsUpdate = true;
  }
  function endScreen(title, line, depth = world.floor.depth) {
    const best = Math.max(store.get('oarfish.best', 0), depth);
    store.set('oarfish.best', best);
    $('end-title').textContent = title;
    $('end-text').textContent = `${line} Longest body ${(run.longest * 0.312 + 0.5).toFixed(1)} m. ${run.caught} caught.${run.hauled ? ` ${run.hauled} ${run.hauled === 1 ? 'fragment' : 'fragments'} of the ruins given to the rift (${nest.fragments} in all).` : ''}`;
    $('end-best').textContent = `Deepest dive so far: ${best} m`;
    setTimeout(() => { $('end').classList.add('on'); $('btn-again').focus({ preventScroll: true }); }, 900);
  }

  // ---------------------------------------------------------------- HUD: hints, the title card, flashes
  const said = new Set(), hintQueue = [];
  let hintT = 0, hintHold = 1, cardT = 0;
  // ---- teaching. One setting. On: whatever has not been learned yet is taught once, by the place itself where it can be.
  // Off: nothing is taught, and a dive never opens in the nursery. Turning it back on starts over.
  const teach = { on: true, done: false, learned: {}, ...store.get('oarfish.teach', {}) };
  const saveTeach = () => store.set('oarfish.teach', { on: teach.on, done: teach.done, learned: teach.learned });
  const know = (id) => { if (!teach.learned[id]) { teach.learned[id] = 1; saveTeach(); } };
  const LESSONS = ['hoop', 'hoop', 'hoop', 'pen', 'pens', 'big', 'jar'], COVERED = new Set(['loop', 'grow', 'toobig', 'ram', 'well', 'stamina', 'guard', 'cost', 'charge', 'toll', 'crest', 'oars']); // what the nursery teaches itself, and what can wait until it is over
  const tut = { on: false, step: 0, stall: 0, told: false, was: 0, prize: null };
  // a line of text is the last resort: once ever, never while the nursery is teaching the same thing by other means
  function say(id, text, hold = 7, kind = 'teach') { if (!teach.on || said.has(id) || teach.learned[`say:${id}`] || (tut.on && COVERED.has(id))) return; said.add(id); know(`say:${id}`); hintQueue.push({ text, hold, kind }); }
  function setTeach(on, quiet) {
    if (on && !teach.on) { teach.done = false; teach.learned = {}; } // asked for again: from the beginning
    teach.on = on; saveTeach();
    $('f-teach').checked = on;
    if (!on && tut.on) { tut.on = false; if (!quiet) tell('No more teaching. The rift is where the marker points. You can turn it back on in the pause menu.', 7); }
    $('btn-skip').hidden = !tut.on;
  }
  function lessons(dt) {
    const N = world.nursery; if (!tut.on || !N || run.state !== 'play') return;
    tut.stall += dt;
    const L = LESSONS[tut.step], head = rig.snout, t = world.time.value;
    const next = () => { tut.step++; tut.stall = 0; tut.told = false; tut.was = 0; music.hit('catch', 0.8); buzz(0, 0.5, 120); pulse('grow');
      if (tut.step >= LESSONS.length) { tut.on = false; teach.done = true; saveTeach(); $('btn-skip').hidden = true; tell('Follow the marker to the rift. Something keeps it.', 8, { kind: 'teach', title: 'That was the nursery', after: true }); } };
    if (L === 'hoop') {
      const h = N.hoops[tut.step], dx = wrapD(head.x - h.x), dz = wrapD(head.z - h.z), along = dx * h.ux + dz * h.uz, off = Math.hypot(dx - along * h.ux, dz - along * h.uz, head.y - h.y);
      h.mesh.material.emissiveIntensity = 0.3 + 0.25 * Math.sin(t * 3.2);
      if (tut.was < 0 && along >= 0 && tut.was > -3 && off < h.r) { h.mesh.material.emissiveIntensity = 1; know(['move', 'rise', 'dive'][tut.step]); next(); } else tut.was = along;
    } else if (L === 'pen') { if (world.schools[0].left === 0) { know('wrap'); next(); } }
    else if (L === 'pens') { if (world.schools[1].left === 0 && world.schools[2].left === 0) next(); }
    else if (L === 'big') { if (world.schools[5].left === 0) next(); }
    else if (N.jar.broken) { know('dash'); next(); }
    if (tut.on && tut.stall > 20 && !tut.told) { tut.told = true; const how = dev === 'pad' ? 'pad' : touch ? 'touch' : 'keys';
      tell({ hoop: ['Swim through the lit hoop.', `The next hoop is higher: ${how === 'pad' ? pb('rise') : how === 'touch' ? 'Rise' : kb('rise')} rises.`, `The last hoop is lower: ${how === 'pad' ? pb('dive') : how === 'touch' ? 'Dive' : kb('dive')} dives.`][tut.step],
        pen: how === 'pad' ? `Hold ${pb('wrap')} beside the swarm in the pen and swim round it. Close the circle and it is yours.` : how === 'touch' ? 'Hold a finger on the swarm in the pen, or draw a circle round it.' : `Hold ${kb('wrapL')} or ${kb('wrapR')} beside the swarm in the pen and swim round it. Close the circle and it is yours.`,
        pens: 'A pale ring means your body is long enough to go round. Take both small swarms.', big: 'Eating made you longer. The ring of the bigger swarm is pale now: take it.',
        jar: `The jar is sealed. ${how === 'pad' ? `Tap ${pb('sprint')}` : how === 'touch' ? 'Tap Dash' : `Tap ${kb('sprint')}`} to dash, and dash straight into it.` }[L], 9, { kind: 'teach' }); }
  }
  // where the marker should point while the nursery is teaching, in place of the rift
  function tutTarget() {
    const N = world.nursery; if (!tut.on || !N) return null;
    const L = LESSONS[tut.step], sc = (i) => { const c = world.schools[i]; return { x: c.x || c.hx, y: (c.y || c.hy) - 1.5, z: c.z || c.hz }; };
    if (L === 'hoop') { const h = N.hoops[tut.step]; return { x: h.x, y: h.y - 1.5, z: h.z, label: 'the hoop' }; }
    if (L === 'pen') return { ...sc(0), label: 'the pen' };
    if (L === 'pens') return { ...sc(world.schools[1].left ? 1 : 2), label: 'the small pens' };
    if (L === 'big') return { ...sc(5), label: 'the bigger swarm' };
    return { x: N.jar.x, y: N.jar.y + N.jar.size - 1.2, z: N.jar.z, label: 'the jar' };
  }
  // the key for the thing in front of you, hung over the thing itself: keys to show, a word, and where
  // (the pen offers the wrap keys beside the left mouse button: on a trackpad a click with two fingers down is the right button, which dashes)
  const promptEl = $('prompt'); let promptKey = '';
  function prompt() {
    let p = null;
    if (teach.on && !touch && run.state === 'play' && !paused && cardT <= 0) { // not across the band's title card
      const padOn = dev === 'pad', N = world.nursery, L = tut.on ? LESSONS[tut.step] : null, near = (o, d) => Math.hypot(wrapD(o.x - rig.pos.x), wrapD(o.z - rig.pos.z)) < d;
      if (L === 'hoop' && tut.step === 0) p = { keys: padOn ? ['Left stick'] : [kb('up'), kb('left'), kb('down'), kb('right')], verb: 'swim', at: [rig.pos.x, rig.pos.y + 1.5, rig.pos.z] };
      else if (L === 'hoop' && near(N.hoops[tut.step], 14)) { const h = N.hoops[tut.step], a = tut.step === 1 ? 'rise' : 'dive'; p = { keys: [padOn ? pb(a) : kb(a)], verb: a, at: [h.x, h.y + h.r + 0.9, h.z] }; }
      else if (L === 'pen' && near(world.schools[0], 12)) { const c = world.schools[0]; p = { keys: padOn ? [pb('wrap')] : feel.mode === 'look' ? ['Left mouse', 'or', kb('wrapL'), kb('wrapR')] : [kb('wrapL'), kb('wrapR')], verb: 'hold, and go round', at: [c.x, c.y + 1.5, c.z] }; }
      else if (L === 'jar' && near(N.jar, 13)) p = { keys: [padOn ? pb('sprint') : kb('sprint')], verb: 'dash into it', at: [N.jar.x, N.jar.y + N.jar.size + 0.8, N.jar.z] };
      else if (!tut.on && !teach.learned.shed && foes.state.stalked > 0 && run.segs - SHED_COST >= MIN_SEGS) { const tail = rig.joints[rig.joints.length - 1]; p = { keys: [padOn ? pb('shed') : kb('shed')], verb: 'shed your tail', at: [tail.x, tail.y + 1.2, tail.z] }; }
      else if (!tut.on && !teach.learned.down && world.rift && guard?.done && world.rift.in(rig.pos.x, rig.pos.z) > world.rift.ledge - 1) p = { keys: [padOn ? pb('dive') : kb('dive')], verb: 'dive into the rift', at: [rig.pos.x, rig.pos.y - 1.7, rig.pos.z] }; // over the open rift, the first time
    }
    if (!p) { if (promptKey) { promptKey = ''; promptEl.classList.remove('on'); } return; }
    const key = p.keys.join('|') + p.verb;
    if (key !== promptKey) { promptKey = key; promptEl.innerHTML = `<div class="in">${p.keys.map((k) => (k === 'or' ? '<i>or</i>' : `<kbd>${k}</kbd>`)).join('')}<span>${p.verb}</span></div>`; promptEl.classList.add('on'); }
    proj.set(rig.pos.x + wrapD(p.at[0] - rig.pos.x), p.at[1], rig.pos.z + wrapD(p.at[2] - rig.pos.z)).project(camera);
    const w = stage.clientWidth, h = stage.clientHeight, off = proj.z > 1;
    promptEl.style.opacity = off ? 0 : '';
    promptEl.style.transform = `translate(${clamp((proj.x * 0.5 + 0.5) * w, 90, w - 90).toFixed(1)}px, ${clamp((-proj.y * 0.5 + 0.5) * h, 120, h - 170).toFixed(1)}px)`;
  }
  function card(name, depth) { $('card-name').textContent = name; $('card-depth').textContent = depth; $('card').classList.add('on'); cardT = 3.2; }
  function pulse(kind) { stage.classList.remove('hurt', 'grow'); void stage.offsetWidth; stage.classList.add(kind); }
  const goalEl = $('goal'), goalLabel = $('goal-label'), goalArrow = $('goal-arrow'), staminaEl = $('stamina'), staminaArc = $('stamina-arc');
  let nowT = 0, clearT = 0, clearTop = 150;
  const proj = new THREE.Vector3();
  // say it now, ahead of the queue. What it interrupts is not lost: it comes back afterwards for the time it had left.
  // after: true waits its turn instead
  let showing = null;
  function tell(text, hold = 4, o = {}) {
    const m = { text, hold, kind: 'note', ...o };
    if (showing && showing.text === text) { hintT = hintHold = hold; return; }
    if (o.after) { if (!hintQueue.some((q) => q.text === text)) hintQueue.push(m); return; }
    if (showing && hintT > 1.2 && showing.kind !== 'note' && hintQueue.length < 4) hintQueue.unshift({ ...showing, hold: Math.max(3, hintT) });
    hintQueue.unshift(m); hintT = 0;
  }
  // How much is going on round the fish, 0 to 1: the swarms and hunters near it, whatever keeps this band, and the chase
  // itself. The band's Energy follows it (music.js), so the slider is only where the band rests when the water is empty.
  const nearBy = (p, reach) => { const d = Math.hypot(wrapD(p.x - rig.pos.x), wrapD(p.z - rig.pos.z)); return d >= reach ? 0 : 1 - d / reach; };
  function activity() {
    let a = 0;
    for (const s of world.schools) if (s.left > 0) a += 0.3 * nearBy(s, 16) * Math.min(1, 0.35 + s.left / 18);
    for (const b of foes.biters) if (b.alive) a += 0.3 * nearBy(b.pos, 22);
    for (const f of foes.anglers) if (f.alive) a += 0.3 * nearBy(f.pos, 22);
    for (const l of foes.leeches) if (l.alive !== false) a += 0.2 * nearBy(l.pos, 18);
    for (const m of foes.mines) if (m.alive) a += 0.1 * nearBy(m.pos, 14);
    for (const h of foes.hooks) a += 0.15 * nearBy(h, 14);
    a += 0.3 * Math.min(2, foes.state.stalked); // hunted outright
    if (guard && !guard.done) a += 0.6 * nearBy(guard.pos, 26);
    if (sum) a += sum.state.awake ? 0.9 : 0.25 * nearBy(world.hall, 40);
    return clamp(a, 0, 1);
  }
  // Who is close enough to sit in with the band (music.js, CAST): each kind of hunter by its nearest, this band's keeper, the Sum
  function castNear() {
    const c = {}, most = (id, v) => { if (v > (c[id] || 0)) c[id] = v; };
    for (const b of foes.biters) if (b.alive) most('biter', nearBy(b.pos, 22) * (b.state === 'hunt' ? 1 : 0.75));
    for (const f of foes.anglers) if (f.alive) most('angler', nearBy(f.pos, 22));
    for (const l of foes.leeches) if (l.alive !== false) most('leech', nearBy(l.pos, 18));
    for (const m of foes.mines) if (m.alive) most('drifter', nearBy(m.pos, 14));
    for (const h of foes.hooks) most('hook', nearBy(h, 14));
    if (guard && !guard.done) most(guard.kind, nearBy(guard.pos, 30));
    if (sum) most('sum', sum.state.awake ? 1 : 0.35 * nearBy(world.hall, 40));
    return c;
  }
  function nowPlaying(dt) { // what the band is playing, for whoever is tuning it
    nowT -= dt;
    if (nowT > 0 || !$('drawer').classList.contains('open')) return;
    nowT = 0.3;
    const d = music.describe();
    $('music-now').textContent = music.muted ? 'Sound is off.' : d ? `Now: ${d.mood}, in ${d.key}. ${d.bpm} bpm, energy ${Math.round(d.energy * 100)}%, intensity ${Math.round(d.intensity * 100)}%.${d.sitting.length ? ` Sitting in: ${d.sitting.join(', ')}.` : ''}` : 'Press any key or click to start the sound.';
    $('energy-live').style.width = `${Math.round(music.energy * 100)}%`;
  }
  function hud(dt) {
    // hints, one at a time
    hintT -= dt;
    if (hintT <= 0) {
      const next = hintQueue.shift();
      const el = $('toast');
      showing = next || null;
      if (next) { $('hint').textContent = next.text; $('toast-title').textContent = next.title || ''; $('toast-kick').textContent = next.kick || ''; el.className = `on ${next.kind || 'note'}`; if (next.tone) el.style.setProperty('--tone', next.tone); else el.style.removeProperty('--tone'); hintT = hintHold = next.hold; }
      else el.classList.remove('on');
    }
    $('toast').style.setProperty('--left', clamp(hintT / hintHold, 0, 1).toFixed(3));
    if (cardT > 0) { cardT -= dt; if (cardT <= 0) $('card').classList.remove('on'); }
    nowPlaying(dt);
    // the plate's scale bar is the health bar
    const sc = $('scale');
    sc.style.setProperty('--segs', run.segs);
    sc.style.setProperty('--food', run.segs >= MAX_SEGS ? 0 : run.food / growCost(run.segs, mods.food));
    const owed = tollHere(); sc.style.setProperty('--toll', owed); sc.classList.toggle('tolled', owed > 0); // over an open rift: what it will take
    sc.classList.toggle('low', run.segs <= MIN_SEGS + 2);
    $('len').textContent = `${bodyMetres().toFixed(1)} m`;
    $('btn-shed').disabled = run.segs - SHED_COST < MIN_SEGS;
    // marker to the rift or the palace, or to whatever the nursery is teaching
    const lesson = tutTarget(), g = lesson || world.goal;
    prompt();
    const dx = wrapD(g.x - rig.pos.x), dz = wrapD(g.z - rig.pos.z), dist = Math.hypot(dx, dz);
    proj.set(rig.pos.x + dx, g.y + 1.5, rig.pos.z + dz).project(camera);
    const w = stage.clientWidth, h = stage.clientHeight, behind = proj.z > 1;
    let sx = (proj.x * 0.5 + 0.5) * w, sy = (-proj.y * 0.5 + 0.5) * h;
    if (behind) { sx = w - sx; sy = h - sy; }
    clearT -= dt;
    if (clearT <= 0) { clearT = 0.5; clearTop = document.querySelector('.where').getBoundingClientRect().bottom - stage.getBoundingClientRect().top + 26; } // keep the marker below the lettering
    const mx = 64, top = clearTop, bottom = 150;
    const inside = !behind && sx > mx && sx < w - mx && sy > top && sy < h - bottom;
    let ang = -90;
    if (!inside) {
      const cx = w / 2, cy = (top + h - bottom) / 2, vx = sx - cx, vy = sy - cy;
      const k = Math.min((w / 2 - mx) / Math.max(Math.abs(vx), 1e-3), ((h - bottom - top) / 2) / Math.max(Math.abs(vy), 1e-3));
      sx = cx + vx * k; sy = cy + vy * k;
      ang = (Math.atan2(vy, vx) * 180) / Math.PI;
    }
    goalEl.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
    goalArrow.style.transform = `rotate(${ang.toFixed(1)}deg)`;
    goalEl.classList.toggle('here', inside);
    goalLabel.textContent = `${lesson ? lesson.label : g.kind === 'palace' ? 'the palace' : 'the rift'} · ${Math.round(dist)} m`;
    // stamina: a ring by the head, there only while it matters
    const showRing = run.state === 'play' && (run.stamina < 0.995 || run.hunted > 0);
    staminaEl.classList.toggle('on', showRing); staminaEl.classList.toggle('low', run.winded);
    if (showRing) {
      proj.copy(rig.pos).project(camera);
      staminaEl.style.transform = `translate(${((proj.x * 0.5 + 0.5) * w + 20).toFixed(1)}px, ${((-proj.y * 0.5 + 0.5) * h - 50).toFixed(1)}px)`;
      staminaArc.style.strokeDashoffset = (100 * (1 - run.stamina)).toFixed(1);
    }
  }

  // ---------------------------------------------------------------- input
  const keys = new Set();
  const held = { rise: false, dive: false, dash: false };
  let wasSprint = false;
  const pointers = new Map(); // pointerId → { x, y, button }
  let steerId = null, mouseId = null, gesture = null;
  // The mouse as a camera, in the adventure controls. `locked` is the browser's pointer lock. `free` is the
  // stand-in when the page is not allowed to lock: the view follows the pointer while it moves over the water.
  const look = { locked: false, free: false, ever: false, mine: false, over: false, mx: 0, buttons: 0 };
  const ui = store.get('oarfish.ui', {});
  const fp = store.get('oarfish.feel', {});
  let paused = false, pausedAt = 0, fsMine = false, side = 1, wasWrap = false, navY = 0, padText = null, padGreeted = false, newT = 0;
  const ended = () => run.state === 'dead' || run.state === 'won';
  // going quiet: while the dive is paused nothing in the picture moves, so it is drawn once and left standing. It is drawn again when anything is pressed, clicked or changed,
  // and once a second in case. An end card left alone for a while goes the same way, until somebody comes back.
  const QUIET = { after: 0.35, beat: 1, away: 90 };
  let drawUntil = 0, drewAt = 0, owed = 0, touchedAt = performance.now();
  const touched = () => { touchedAt = performance.now(); };
  const stir = () => { touchedAt = performance.now(); drawUntil = touchedAt + QUIET.after * 1000; owed = 3; }; // a few frames at the least, however long the thing that was pressed takes
  for (const type of ['pointermove', 'wheel']) window.addEventListener(type, touched, { capture: true, passive: true });
  for (const type of ['pointerdown', 'pointerup', 'keydown', 'keyup', 'click', 'input', 'change']) window.addEventListener(type, stir, { capture: true, passive: true });
  // a lighter picture, for a machine that runs hot: off unless it is asked for. One pixel to a point of the screen and not two, a shadow map of half the size,
  // and no more than about sixty frames a second on a screen that would show more
  const light = { on: false, gap: 12.5 };
  function setLight(on, keep = true) {
    light.on = on; renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, on ? 1 : 2));
    const size = on ? 1024 : 2048; if (sun.shadow.mapSize.x !== size) { sun.shadow.mapSize.set(size, size); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    if (keep) { fp.light = on; store.set('oarfish.feel', fp); }
    stir();
  }
  // Left alone in the middle of a dive, the fish does not hang there to be eaten: after QUIET.away seconds it swims figures by itself, about the place it was left,
  // and nothing bites it. Any touch gives it back. (Not while the page is being driven by a test, unless the test asks.)
  const adrift = { on: false, allow: navigator.webdriver !== true, t: 0, at: new THREE.Vector3(), turn: 0, inp: { dir: { x: 0, y: 0, z: 1 }, amount: 1, vertical: 0, sprint: false, gentle: true, coil: 0, tight: false, bite: false, aim: null } };
  const FIGURES = [['eight', 15], ['rise', 8], ['coil', 4.5], ['wave', 8]], FIGURE_TIME = FIGURES.reduce((a, f) => a + f[1], 0);
  function figures(dt) {
    const p = rig.pos, o = adrift.inp; adrift.t += dt;
    let t = adrift.t % FIGURE_TIME, kind = ''; for (const [name, secs] of FIGURES) { if (t < secs) { kind = name; break; } t -= secs; }
    let rate = 0; o.vertical = 0; o.coil = 0;
    if (kind === 'eight') rate = (t < 7.5 ? 1 : -1) * 0.84; // one ring to the left, one to the right
    else if (kind === 'rise') { rate = 0.9; o.vertical = Math.sin(t / 8 * Math.PI * 2) * 0.8; } // a ring that climbs and comes down again
    else if (kind === 'coil') { rate = 0.5; o.coil = t > 0.4 && t < 3.6 ? 1 : 0; } // drawn up into itself, and let go
    else rate = 1.3 * Math.sin(t * 2.1); // a long wave
    adrift.turn += rate * dt;
    const dx = wrapD(adrift.at.x - p.x), dz = wrapD(adrift.at.z - p.z), far = Math.hypot(dx, dz);
    if (far > 7) adrift.turn += clamp(Math.atan2(Math.sin(Math.atan2(dx, dz) - adrift.turn), Math.cos(Math.atan2(dx, dz) - adrift.turn)), -1, 1) * 1.6 * dt; // it does not wander off
    if (!o.vertical) o.vertical = clamp((adrift.at.y - p.y) * 0.5, -0.6, 0.6);
    o.dir.x = Math.sin(adrift.turn); o.dir.z = Math.cos(adrift.turn);
    run.hush = 0.6; // nothing bites it, and nothing shows that: it does not blink
    return o;
  }
  // Creatures to look at, in the water beside the fish: whatever the library holds under "Not yet in the dive". None of them is in the dive: this is a testing
  // tool (the pause menu), there so that a model can be seen where it would live. Each is brought and taken away by its own button; none harms or is harmed.
  // The squid hovers, turning to watch the fish; every few seconds it jets, mantle first, to another place near by; crowded, it blanches and goes.
  // A jellyfish simply lives: it beats, and each beat really moves it; it sinks a little between beats, wanders, and keeps near the fish.
  const pets = {}, BRING = inOrder().filter((n) => n.group === 'Not yet in the dive');
  // how each jelly lives. n: how many are brought; ring: how far from the fish it may wander before it turns back; push, drag: what a stroke gives it and what the
  // water takes; sink: how fast it sinks, left to itself; turn: how fast it comes round (radians a second), leg: how long it holds a heading, veer: how far it then turns;
  // high: the heights over the bed it keeps between; lean: how far its bell lies over when it climbs and when it lets itself down; moods: what it does, and for how long
  const LIVES = {
    moonjelly: { n: 6, ring: 6, push: 0.6, drag: 1.6, sink: 0.035, turn: 0.3, leg: 6, veer: 0.7, high: [2.2, 4.6], lean: [0.3, 1.05], moods: [['pulse', 8], ['drift', 5], ['pulse', 6], ['rest', 4]] },
    nettle: { n: 1, ring: 7, push: 1.25, drag: 1.3, sink: 0.05, turn: 0.32, leg: 8, veer: 0.6, high: [3.6, 6], lean: [0.6, 1.3], moods: [['pulse', 12], ['drift', 4], ['pulse', 8], ['fish', 8]] },
    helmetjelly: { n: 1, ring: 6, push: 0.55, drag: 1.5, sink: 0.03, turn: 0.25, leg: 7, veer: 0.6, high: [2.2, 4.4], lean: [0.25, 1.0], moods: [['pulse', 9], ['drift', 5], ['lit', 3.5], ['pulse', 6], ['reach', 4]] },
    boxjelly: { n: 1, ring: 9, push: 4.4, drag: 1.5, sink: 0.05, turn: 2.8, leg: 3.2, veer: 1.9, high: [2, 4.6], lean: [1.0, 1.4], moods: [['pulse', 10], ['drift', 3], ['pulse', 7], ['fish', 6]] },
  };
  const fracOf = (x) => x - Math.floor(x);
  function bring(id, on) {
    if (pets[id]) { if (pets[id].dispose) pets[id].dispose(); else for (const s of pets[id].list) { scene.remove(s.a.object); s.a.dispose(); } delete pets[id]; }
    if (!on || !BRING.some((n) => n.id === id)) return;
    if (SAND_PETS[id]) { pets[id] = bringSand(id, sandCtx); return; } // the creatures of the sand flat live as sandpets.js says
    const ahead = (d, up) => new THREE.Vector3(rig.pos.x + rig.forward.x * d, rig.pos.y + up, rig.pos.z + rig.forward.z * d), L = LIVES[id];
    if (!L) { const a = make(id); scene.add(a.object); pets[id] = { list: [{ id, a, pos: ahead(5, 1), to: new THREE.Vector3(), yaw: rig.yaw + Math.PI, mood: 'hover', t: 2.5, n: 1 }] }; return; } // the squid
    pets[id] = { list: Array.from({ length: L.n }, (_, i) => { const a = make(id), ph = i * 2.399, r = i ? 1.3 + 0.55 * i : 0, s = { id, a, i, ph, pos: ahead(5, 1.2 + (i % 3) * 0.5).add(new THREE.Vector3(Math.sin(ph) * r, 0, Math.cos(ph) * r)), vel: new THREE.Vector3(), yaw: rig.yaw + 1.2 + ph, head: rig.yaw + 1.2 + ph, tilt: 0.6, k: 0, mood: L.moods[0][0], t: L.moods[0][1] * (0.4 + 0.6 * fracOf(i * 0.37 + 0.2)), leg: L.leg * fracOf(i * 0.53 + 0.4), n: i };
      scene.add(a.object); a.rig.pose.q = fracOf(i * 0.37); return s; }) }; // (no two of a group beat together)
  }
  const sandCtx = { make, scene, rig, wrapD, get world() { return world; }, get time() { return run.time; } };
  const bringSquid = (on) => bring('squid', on);
  function squidStep(dt, s) {
    const p = s.pos, dx = wrapD(rig.pos.x - p.x), dz = wrapD(rig.pos.z - p.z), far = Math.hypot(dx, dz), turn = (a, rate) => { s.yaw += clamp(Math.atan2(Math.sin(a - s.yaw), Math.cos(a - s.yaw)), -rate * dt, rate * dt); };
    if (far > 34) { p.set(rig.pos.x + rig.forward.x * 6, rig.pos.y + 1, rig.pos.z + rig.forward.z * 6); s.mood = 'hover'; s.t = 2; } // the fish has gone a long way, or down a rift: it is there again
    s.t -= dt;
    const leave = (away) => { s.n++; const a = away ? Math.atan2(-dx, -dz) + Math.sin(s.n * 2.4) * 0.7 : s.n * 2.4, r = away ? 9 : 5 + (s.n % 3) * 2, x = (away ? p.x : rig.pos.x) + Math.sin(a) * r, z = (away ? p.z : rig.pos.z) + Math.cos(a) * r;
      s.to.set(x, world.height(x, z) + 2.4 + (s.n % 4) * 1.1, z); s.mood = 'jet'; s.t = 4; };
    if (s.mood === 'hover') { turn(Math.atan2(dx, dz), 1.2); p.y += Math.sin(run.time * 0.9) * 0.12 * dt; if (far < 2.6 && Math.abs(rig.pos.y - p.y) < 2.5) { s.mood = 'alarm'; s.t = 0.7; } else if (s.t <= 0) leave(false); }
    else if (s.mood === 'alarm') { turn(Math.atan2(dx, dz), 3); if (s.t <= 0) leave(true); }
    else { const tx = wrapD(s.to.x - p.x), ty = s.to.y - p.y, tz = wrapD(s.to.z - p.z), d = Math.hypot(tx, ty, tz); turn(Math.atan2(-tx, -tz), 4); // its arms point back the way it came
      if (d < 0.6 || s.t <= 0) { s.mood = 'hover'; s.t = 3 + (s.n % 3); } else { const v = Math.min(4.2, d * 2 + 0.6) * dt / d; p.x += tx * v; p.y += ty * v; p.z += tz * v; } }
    p.y = Math.max(p.y, world.height(p.x, p.z) + 1.2);
    const X = rig.pos.x - wrapD(rig.pos.x - p.x), Z = rig.pos.z - wrapD(rig.pos.z - p.z); p.x = X; p.z = Z; // the nearest copy of the world to the fish
    s.a.rig.update(dt, { x: p.x, y: p.y, z: p.z, yaw: s.yaw, pitch: 0, mood: s.mood, rate: 1.2 });
  }
  function jellyStep(dt, s) {
    const L = LIVES[s.id], p = s.pos, v = s.vel, dx = wrapD(rig.pos.x - p.x), dz = wrapD(rig.pos.z - p.z), far = Math.hypot(dx, dz);
    if (far > 34) { const r = 5 + s.i * 0.8; p.set(rig.pos.x + rig.forward.x * 6 + Math.sin(s.ph) * r * 0.4, rig.pos.y + 1.2, rig.pos.z + rig.forward.z * 6 + Math.cos(s.ph) * r * 0.4); v.set(0, 0, 0); } // the fish has gone a long way, or down a rift: it is there again
    if ((s.t -= dt) <= 0) { s.k = (s.k + 1) % L.moods.length; s.mood = L.moods[s.k][0]; s.t = L.moods[s.k][1] * (0.8 + 0.4 * fracOf(++s.n * 0.37)); }
    // where it is headed: it holds a heading for a while and then takes another; gone too far from the fish, it turns back toward it
    if ((s.leg -= dt) <= 0) { s.leg = L.leg * (0.7 + 0.6 * fracOf(++s.n * 0.61)); s.head = far > L.ring ? Math.atan2(dx, dz) + (fracOf(s.n * 0.29) - 0.5) : s.head + (s.n % 2 ? 1 : -1) * L.veer * (0.5 + fracOf(s.n * 0.47)); }
    s.yaw += clamp(wrapPi(s.head - s.yaw), -L.turn * dt, L.turn * dt);
    // how it lies: beating, it leans up to climb and lies over to go level, between the two heights it keeps; drifting, it rights itself; the box jelly, fishing, tips right over
    const bed = world.height(p.x, p.z), h = p.y - bed, want = (L.high[0] + L.high[1]) / 2 + ((L.high[1] - L.high[0]) / 2) * Math.sin(run.time * 0.13 + s.ph * 2);
    const lean = s.mood === 'pulse' ? lerp(L.lean[0], L.lean[1], clamp((h - want) / 1.6 + 0.6, 0, 1)) : s.mood === 'fish' && s.id === 'boxjelly' ? 2.75 : 0.12 + 0.1 * Math.sin(run.time * 0.4 + s.ph);
    s.tilt = damp(s.tilt, lean, s.id === 'boxjelly' ? 2.2 : 0.7, dt);
    // a stroke pushes it the way the top of its bell points; the water slows it; left to itself it sinks
    // (drifting, it beats gently, and when it has risen over the height it wants it stops beating and lets itself down)
    if (s.mood === 'pulse') s.idle = false; else if (h > want + 0.5) s.idle = true; else if (h < want - 0.2) s.idle = false;
    const T = s.a.rig.pose.thrust * L.push * (s.mood === 'pulse' ? 1 : 0.45), st = Math.sin(s.tilt);
    v.x += (Math.sin(s.yaw) * st * T - v.x * L.drag) * dt; v.y += (Math.cos(s.tilt) * T - (v.y + L.sink) * L.drag) * dt; v.z += (Math.cos(s.yaw) * st * T - v.z * L.drag) * dt;
    p.addScaledVector(v, dt); if (p.y < bed + 1.1) { p.y = bed + 1.1; v.y = Math.max(0, v.y); }
    p.x = rig.pos.x - wrapD(rig.pos.x - p.x); p.z = rig.pos.z - wrapD(rig.pos.z - p.z); // the nearest copy of the world to the fish
    s.a.rig.update(dt, { x: p.x, y: p.y, z: p.z, yaw: s.yaw, tilt: s.tilt, mood: s.mood, rate: s.idle ? 0 : undefined });
  }
  function petStep(dt) { for (const id in pets) { if (pets[id].step) { pets[id].step(dt); continue; } for (const s of pets[id].list) (LIVES[id] ? jellyStep : squidStep)(dt, s); } }
  const still = () => !window.__hold && (paused || (ended() && run.stateT > QUIET.away && performance.now() - touchedAt > QUIET.away * 1000));
  const lookK = () => Math.pow(4, feel.look - 0.5); // the Look speed slider: half speed to double
  function turnView(dx, dy, kx, ky = kx * 0.85) {
    if (cine()) return; // the endings hold the camera
    cam.yaw -= dx * kx * lookK();
    cam.pitch = clamp(cam.pitch + dy * ky * lookK(), VIEW[feel.mode].low, 1.4);
    cam.ease = null;
  }
  const behind = (pitch = cam.pitch) => { cam.ease = { yaw: rig.yaw + Math.PI, pitch, t: 1 }; };

  // --- the key list, written for whatever is in the player's hands
  const K = (...ks) => ks.map((k) => `<kbd>${k}</kbd>`).join('');
  const row = (...parts) => { let h = ''; for (let i = 0; i < parts.length; i += 2) h += `<span class="pair">${parts[i]}<span>${parts[i + 1]}</span></span>`; return `<li class="key">${h}</li>`; }; // key caps, then what they do
  function legend() {
    if (dev === 'pad') return row(K('Left stick'), 'steer', K(pb('sprint')), 'dash, hold to sprint') + row(K(pb('wrap')), 'wrap, or coil', K(pb('sprint')), 'tight') + row(K(pb('rise')), 'rise', K(pb('dive')), 'dive') + row(K(pb('oarL'), pb('oarR')), 'oars: in turn, on the beat') + row(K(pb('shed')), 'shed tail as bait') + row(K(pb('pause')), 'pause', K(pb('hide')), 'hide this')
      + `<li class="note">The right stick looks around; ${pb('behind')} brings the view behind you. ${pb('zoomIn')} and ${pb('zoomOut')} zoom.</li>`;
    if (touch) return '<li class="note">Hold and drag: the fish swims to your finger. Hold on a swarm to wrap it. Pinch to zoom, drag with two fingers to look around.</li>';
    return row(K(kb('up'), kb('left'), kb('down'), kb('right')), 'steer', K(kb('sprint')), 'dash, hold to sprint') + row(K(kb('wrapL'), kb('wrapR')), 'wrap, or coil', K(kb('sprint')), 'tight') + row(K(kb('rise')), 'rise', K(kb('dive')), 'dive') + row(K(kb('oarL'), kb('oarR')), 'oars: in turn, on the beat') + row(K(kb('shed')), 'shed tail as bait') + row(K(kb('pause')), 'pause', K(kb('full')), 'full screen', K(kb('hide')), 'hide this')
      + (feel.mode === 'look' ? `<li class="note">The mouse turns the view${look.locked || look.free ? '' : ': click the water to take it'}. Tilt the view up or down and the fish swims that way. Left button wraps, right button dashes and sprints, scroll zooms. On a trackpad a click with two fingers down is the right button; ${kb('wrapL')} and ${kb('wrapR')} wrap from the keys. ${kb('view')} goes back to pointing.</li>`
        : `<li class="note">Mouse: drag with the left button to look around. Hold both buttons to swim where you look, up and down too. Hold the right one to swim to the pointer. Scroll zooms. ${kb('view')} switches to the adventure camera.</li>`);
  }
  function renderLegend() { const h = legend(); $('keys').innerHTML = h; $('pause-keys').innerHTML = h; }
  function setDev(d) {
    if (dev === d) return;
    dev = d; stage.dataset.dev = d; renderLegend();
    if (d === 'pad' && !padGreeted) { padGreeted = true; if (!paused) tell(`${pad.title()} found. Hold ${pb('wrap')} beside a small swarm to wrap round it.`, 6); }
  }

  // --- the two sets of controls
  function showMode() {
    $('mode-point').setAttribute('aria-pressed', String(feel.mode === 'point')); $('mode-look').setAttribute('aria-pressed', String(feel.mode === 'look'));
    $('mode-note').textContent = feel.mode === 'point' ? 'Drag with the left mouse button to look around. Hold both buttons and the fish swims where you look; hold the right one alone and it swims to the pointer. The view stays high, as on the plate.'
      : look.free ? 'The keys swim and the mouse turns the view. This page was not allowed to capture the mouse, so the view follows it while it moves over the water, and keeps turning while it rests at the left or right edge. Tilt the view up or down and the fish swims that way.'
        : 'The keys swim and the mouse turns the view, with no button held. Tilt the view up or down and the fish swims that way. Click the water to hand the mouse to the game. Esc takes it back and pauses.';
  }
  function setMode(m, quiet) {
    if (touch || m !== 'look') m = 'point';
    const changed = feel.mode !== m;
    feel.mode = m; fp.mode = m; store.set('oarfish.feel', fp);
    stage.dataset.mode = m;
    if (changed && m === 'look') { cam.plate = cam.pitch; behind(LOOK_LEVEL); }
    if (changed && m === 'point') {
      if (look.locked) { look.mine = true; document.exitPointerLock?.(); }
      look.buttons = 0;
      cam.ease = { yaw: cam.yaw, pitch: cam.plate ?? 0.56, t: 1 }; // back up to the angle the plate view was left at
    }
    showMode(); renderLegend();
    if (changed && !quiet && !paused) tell(m === 'point' ? 'Point and swim: drag to look around, hold both mouse buttons to swim where you look.' : look.free ? 'Adventure camera: the mouse turns the view.' : 'Adventure camera: click the water and the mouse turns the view.', 5);
  }
  // ask the browser to hand the mouse to the game. Browsers only allow it from a real click
  function grab(fromClick) {
    if (feel.mode !== 'look' || touch || document.pointerLockElement === canvas) return;
    const refused = () => { if (fromClick && !look.ever && !look.free) { look.free = true; showMode(); renderLegend(); } };
    if (!canvas.requestPointerLock) return refused();
    try { const p = canvas.requestPointerLock(); if (p?.catch) p.catch(refused); } catch { refused(); }
  }
  document.addEventListener('pointerlockerror', () => { if (feel.mode === 'look' && !look.ever && !look.free) { look.free = true; showMode(); renderLegend(); } });
  document.addEventListener('pointerlockchange', () => {
    const was = look.locked;
    look.locked = document.pointerLockElement === canvas;
    if (look.locked) { look.ever = true; look.free = false; }
    else if (was) { // Esc, or the browser took the mouse back: that is a pause
      look.buttons = 0;
      if (!look.mine && !paused && !ended()) setPaused(true);
    }
    look.mine = false;
    showMode(); renderLegend();
  });

  // --- pause, full screen, hiding the help
  function setPaused(on) {
    if (on === paused || (on && ended())) return;
    paused = on; pausedAt = performance.now(); stir();
    stage.classList.toggle('paused', on); $('pause').classList.toggle('on', on);
    $('btn-pause').setAttribute('aria-pressed', String(on)); $('btn-pause').setAttribute('aria-label', on ? 'Resume' : 'Pause');
    music.duck(on ? 0.5 : 1);
    keys.clear(); held.rise = held.dive = held.dash = false; look.buttons = 0; steerId = null; pointers.clear(); gesture = null;
    newDive(false); $('pause-msg').textContent = ''; openBinds(false); openNote(false);
    if (on) {
      if (look.locked) { look.mine = true; document.exitPointerLock?.(); }
      showMode(); renderLegend(); showDev();
      $('btn-resume').focus({ preventScroll: true });
    } else {
      if ($('pause').contains(document.activeElement)) document.activeElement.blur();
      if (!ui.full) closeDrawer();
    }
  }
  const fsOn = () => !!document.fullscreenElement;
  const note = (text) => { if (paused) $('pause-msg').textContent = text; else tell(text, 5); };
  function fullscreen(real = true) {
    if (fsOn()) { fsMine = true; document.exitFullscreen?.().catch(() => {}); return; }
    if (!real) return note('The browser only goes full screen from a click or a key: press F.');
    const no = () => note('Full screen is not available in this view of the page.');
    try {
      const p = document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      // with Esc handed to the page, Esc pauses and the dive stays full screen; where that is refused, Esc leaves full screen as usual
      p.then(() => { navigator.keyboard?.lock?.(['Escape'])?.catch?.(() => {}); }).catch(no);
    } catch { no(); }
  }
  document.addEventListener('fullscreenchange', () => {
    const on = fsOn();
    for (const id of ['btn-fs', 'btn-full']) $(id).setAttribute('aria-pressed', String(on));
    $('btn-full').textContent = on ? 'Leave full screen' : 'Full screen';
    $('btn-fs').setAttribute('aria-label', on ? 'Leave full screen' : 'Full screen');
    if (!on) { try { navigator.keyboard?.unlock?.(); } catch { /* nothing was locked */ } }
    if (!on && !fsMine && !paused && !ended()) setPaused(true); // Esc took the page out of full screen: it usually means pause
    fsMine = false;
  });
  function closeDrawer() { $('drawer').classList.remove('open'); $('music-tab').setAttribute('aria-expanded', 'false'); }
  // Two views. The plain one is the game: the plate, the scale bar, the marker, the key prompts, the messages, and a way to pause.
  // The full one adds what is for looking things up and for tuning: the key list, the tuning drawer, the model tools.
  function setFull(on, quiet) {
    ui.full = !!on; delete ui.bare; store.set('oarfish.ui', ui); // `bare` was this setting the other way round, when the full view was the usual one
    stage.classList.toggle('full', ui.full);
    $('btn-keys').textContent = ui.full ? 'Hide keys and tools on screen' : 'Show keys and tools on screen';
    if (!ui.full && !paused) closeDrawer();
    if (!ui.full && !quiet && !paused) tell(dev === 'pad' ? `Keys and tools hidden. ${pb('hide')} brings them back.` : touch ? 'Keys and tools hidden.' : `Keys and tools hidden. ${kb('hide')} brings them back.`, 4);
  }
  function newDive(arm) { // leaving a dive takes two presses
    clearTimeout(newT);
    const b = $('btn-new');
    b.dataset.armed = arm ? '1' : ''; b.textContent = arm ? 'Leave this dive? Press again' : 'New dive';
    if (arm) newT = setTimeout(() => newDive(false), 4000);
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true); else stir(); });

  // ---- key and button bindings. `binds` is what is in force; named sets of them are kept in this browser.
  const bindStore = store.get('oarfish.binds', {});
  if (!bindStore.presets || typeof bindStore.presets !== 'object') bindStore.presets = {};
  let binds = cleanBinds(bindStore.now || DEFAULT_BINDS), wait = null; // wait: the slot that is listening for a key or a button
  const saveBinds = () => { bindStore.now = binds; store.set('oarfish.binds', bindStore); };
  const kd = (a) => binds.keys[a].some((c) => keys.has(c)); // is a key for this action down
  const pd = (a, min) => binds.pad[a] != null && pad.held(binds.pad[a], min);
  const pp = (a) => binds.pad[a] != null && pad.pressed(binds.pad[a]);
  const kb = (a) => keyName(binds.keys[a][0]) || 'an unset key'; // what to call it in a hint
  const pb = (a) => pad.name(binds.pad[a]) || 'an unset button';
  const actionOf = (code) => { for (const [a] of ACTIONS) if (binds.keys[a].includes(code)) return a; return null; };
  const sameBinds = (a, b) => JSON.stringify(cleanBinds(a)) === JSON.stringify(cleanBinds(b));
  function showBinds(msg) {
    const head = '<b>Action</b><b>Key</b><b>Or</b><b>Controller</b>';
    const f = document.activeElement?.closest?.('#bind-grid button'), keep = f ? `button[data-a="${f.dataset.a}"]${f.dataset.p ? '[data-p]' : `[data-k="${f.dataset.k}"]`}` : ''; // the grid is redrawn: keep the place
    $('bind-grid').innerHTML = head + ACTIONS.map(([a, label]) => {
      const slot = (i) => `<button type="button" data-a="${a}" data-k="${i}"${wait && wait.a === a && wait.k === i ? ' class="wait"' : ''}>${wait && wait.a === a && wait.k === i ? 'press a key' : keyName(binds.keys[a][i]) || '\u2013'}</button>`;
      const padSlot = STICK.has(a) ? '<span class="fixed">Left stick</span>' : `<button type="button" data-a="${a}" data-p="1"${wait && wait.a === a && wait.p ? ' class="wait"' : ''}>${wait && wait.a === a && wait.p ? 'press a button' : pad.name(binds.pad[a]) || '\u2013'}</button>`;
      return `<span>${label}</span>${slot(0)}${slot(1)}${padSlot}`;
    }).join('');
    if (keep) $('bind-grid').querySelector(keep)?.focus({ preventScroll: true });
    const names = Object.keys(bindStore.presets).sort(), sel = $('bind-preset');
    const current = sameBinds(binds, DEFAULT_BINDS) ? '' : names.find((n) => sameBinds(binds, bindStore.presets[n])) ?? '*';
    sel.innerHTML = `<option value="">The defaults</option>${names.map((n) => `<option value="${n.replace(/"/g, '&quot;')}">${n.replace(/</g, '&lt;')}</option>`).join('')}${current === '*' ? '<option value="*">Not saved yet</option>' : ''}`;
    sel.value = current;
    $('bind-delete').disabled = !current || current === '*';
    if (msg !== undefined) $('bind-msg').textContent = msg;
    renderLegend();
  }
  function setKey(a, k, code) { // put a key on an action, taking it off whatever had it
    let took = '';
    for (const [o, label] of ACTIONS) { const i = binds.keys[o].indexOf(code); if (i >= 0 && !(o === a && i === k)) { binds.keys[o].splice(i, 1); took = label; } }
    const list = binds.keys[a]; while (list.length < k) list.push(''); list[k] = code;
    binds.keys[a] = list.filter(Boolean);
    saveBinds();
    return took ? `${keyName(code)} was on \u201c${took}\u201d and has moved.` : '';
  }
  function setPad(a, i) {
    let took = '';
    for (const [o, label] of ACTIONS) if (!STICK.has(o) && o !== a && binds.pad[o] === i) { binds.pad[o] = null; took = label; }
    binds.pad[a] = i; saveBinds();
    return took ? `${pad.name(i)} was on \u201c${took}\u201d and has moved.` : '';
  }
  function openBinds(on) { wait = null; $('pause').classList.toggle('binding', on); if (on) { showBinds('Click a slot, then press the key or the button for it. Backspace empties a slot, Esc leaves it as it was.'); $('bind-back').focus({ preventScroll: true }); } }
  $('bind-grid').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    wait = b.dataset.p ? { a: b.dataset.a, p: true } : { a: b.dataset.a, k: +b.dataset.k };
    showBinds(wait.p ? 'Press the controller button for it.' : 'Press the key for it.');
  });
  window.addEventListener('keydown', (e) => { // a slot is listening: this key is for it, not for the game
    if (!wait) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const w = wait; wait = null;
    if (e.code === 'Escape') return showBinds('Left as it was.');
    if (e.code === 'Backspace' || e.code === 'Delete') { if (w.p) binds.pad[w.a] = null; else binds.keys[w.a].splice(w.k, 1); saveBinds(); return showBinds('Emptied.'); }
    if (w.p) return showBinds('That slot takes a controller button. Click it again and press one.');
    if (/^(Control|Alt|Meta|OS)/.test(e.code)) return showBinds('Ctrl, Alt and the system key cannot be used.');
    showBinds(setKey(w.a, Math.min(w.k, binds.keys[w.a].length), e.code));
  }, true);
  $('btn-binds').addEventListener('click', () => openBinds(true));
  // ---- feedback. Nothing leaves the page by itself: the note is put on the clipboard, or handed to the device's own share sheet,
  // and the player sends it to whoever gave them the link. With it goes a few lines on how the dive went, which they can read first and leave out.
  function noteFacts() {
    const mins = (s) => (s < 90 ? `${Math.round(s)} s` : `${Math.round(s / 60)} min`), ua = navigator.userAgent;
    const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'a browser';
    const system = /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux|CrOS/.test(ua) ? 'Linux' : 'an unknown system';
    const hands = dev === 'pad' ? `a controller (${pad.report()[0] || pad.title()})` : matchMedia('(pointer: coarse)').matches ? 'touch' : 'keyboard and mouse';
    const built = new Date(document.lastModified), when = Number.isNaN(+built) ? '' : ` · build of ${built.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`;
    return [
      `Band ${run.floor + 1} of ${FLOORS.length}, ${world.floor.name.replace(/^The /, 'the ')}: ${run.state === 'won' ? 'finished' : run.state === 'dead' ? 'died there' : 'still diving'}`,
      `This dive ${mins(run.time)}; ${mins(session.played)} played in ${session.dives} ${session.dives === 1 ? 'dive' : 'dives'}. Longest body ${(run.longest * 0.312 + 0.5).toFixed(1)} m, ${run.caught} caught`,
      `${feel.mode === 'look' ? 'Adventure camera' : 'Point and swim'}, ${hands}, ${ui.full ? 'keys and tools shown' : 'plain view'}`,
      `${browser} on ${system}, ${innerWidth}×${innerHeight}${session.clock > 2 ? `, ${Math.round(session.frames / session.clock)} frames a second` : ''}${when}`,
    ].join('\n');
  }
  const noteBody = () => `Oarfish dive: feedback\n\n${$('note-text').value.trim()}${$('note-facts').checked ? `\n\nHow the dive went\n${noteFacts()}` : ''}\n\n${location.origin}${location.pathname}`;
  function openNote(on) {
    if (on === fb.open) return;
    const p = $('pause'); fb.open = on;
    if (on) { fb.own = !paused; if (fb.own) p.classList.add('on'); $('note-facts-text').textContent = noteFacts(); $('note-msg').textContent = ''; $('note-out').hidden = true; $('note-share').hidden = typeof navigator.share !== 'function'; }
    else if (fb.own) p.classList.remove('on');
    p.classList.toggle('noting', on); p.scrollTop = 0;
    (on ? $('note-text') : fb.own ? $('btn-again') : $('btn-note')).focus({ preventScroll: true });
  }
  const noteReady = () => { if ($('note-text').value.trim()) return true; $('note-msg').textContent = 'Write a line first, even a short one.'; $('note-text').focus({ preventScroll: true }); return false; };
  const noteByHand = (text, why) => { const o = $('note-out'); o.hidden = false; o.value = text; o.focus({ preventScroll: true }); o.select(); $('note-msg').textContent = `${why} The whole note is in the box below, selected: copy it from there.`; };
  $('btn-note').addEventListener('click', () => openNote(true));
  $('btn-note-end').addEventListener('click', () => openNote(true));
  $('note-back').addEventListener('click', () => openNote(false));
  $('note-facts').addEventListener('change', () => { $('note-out').hidden = true; });
  $('note-copy').addEventListener('click', async () => {
    if (!noteReady()) return;
    const text = noteBody();
    try { await navigator.clipboard.writeText(text); $('note-out').hidden = true; $('note-msg').textContent = 'Copied. Paste it into a message to whoever sent you the link.'; }
    catch { noteByHand(text, 'Copying was blocked here.'); }
  });
  $('note-share').addEventListener('click', async () => {
    if (!noteReady()) return;
    const text = noteBody();
    try { await navigator.share({ title: 'Oarfish dive: feedback', text }); $('note-msg').textContent = 'Handed over. Thank you.'; }
    catch (e) { if (e?.name !== 'AbortError') noteByHand(text, 'Sharing was refused here.'); }
  });
  $('bind-back').addEventListener('click', () => { openBinds(false); $('btn-resume').focus({ preventScroll: true }); });
  $('bind-reset').addEventListener('click', () => { binds = cleanBinds(DEFAULT_BINDS); saveBinds(); showBinds('Back to the defaults.'); });
  $('bind-preset').addEventListener('change', (e) => {
    const n = e.target.value;
    if (n === '*') return;
    binds = cleanBinds(n ? bindStore.presets[n] : DEFAULT_BINDS); saveBinds(); showBinds(n ? `Using \u201c${n}\u201d.` : 'Back to the defaults.');
  });
  $('bind-save').addEventListener('click', () => {
    const sel = $('bind-preset').value, n = $('bind-name').value.trim() || (sel && sel !== '*' ? sel : '');
    if (!n) return showBinds('Type a name for this set first.');
    bindStore.presets[n] = cleanBinds(binds); saveBinds(); $('bind-name').value = '';
    showBinds(`Saved as \u201c${n}\u201d in this browser.`);
  });
  $('bind-delete').addEventListener('click', () => { const n = $('bind-preset').value; if (!n || n === '*') return; delete bindStore.presets[n]; saveBinds(); showBinds(`Deleted \u201c${n}\u201d. The keys stay as they are until you change them.`); });

  const typing = (e) => ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target?.tagName);
  window.addEventListener('keydown', (e) => {
    if (lib.isOpen) { // the library has the keyboard while it is open
      if (e.code === 'Escape') { e.preventDefault(); lib.close(); } else if ((e.code === 'ArrowDown' || e.code === 'ArrowUp') && !typing(e)) { e.preventDefault(); lib.step(e.code === 'ArrowDown' ? 1 : -1); }
      return;
    }
    if (fb.open) { if (e.code === 'Escape') { e.preventDefault(); openNote(false); } return; } // so has the feedback sheet
    music.unlock();
    if (e.metaKey || e.ctrlKey || e.altKey || (typing(e) && e.target.type !== 'range' && e.target.type !== 'checkbox')) return; // text being typed is not for the game
    setDev('keys');
    if (ended() && (e.code === 'Enter' || e.code === 'KeyR')) return startRun();
    const act = actionOf(e.code);
    if (act === 'pause' || e.code === 'Escape') { // Esc always pauses, whatever else is bound
      if (e.repeat || ended()) return;
      e.preventDefault();
      // Esc can arrive just after the browser has already released the mouse and paused the dive: do not undo that
      if (paused && performance.now() - pausedAt < 350) return;
      setPaused(!paused);
      if (!paused && look.ever) grab(false);
      return;
    }
    if (!e.repeat && act === 'full') { e.preventDefault(); return fullscreen(); }
    if (!e.repeat && act === 'hide') return setFull(!ui.full);
    if (!e.repeat && act === 'view' && !touch) return setMode(feel.mode === 'look' ? 'point' : 'look');
    if (paused || typing(e) || !act) return; // a focused slider keeps its arrow keys
    if ((e.code === 'Space' || e.code === 'Enter') && document.activeElement?.tagName === 'BUTTON') return; // let a focused button be a button
    if (!e.repeat && act === 'shed') shed();
    if (!e.repeat && (act === 'oarL' || act === 'oarR')) stroke(act === 'oarL' ? -1 : 1);
    if (!e.repeat && act === 'behind') behind(clamp(cam.pitch, 0.2, 0.6));
    keys.add(e.code);
    e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => { keys.clear(); held.rise = held.dive = held.dash = false; look.buttons = 0; });
  window.addEventListener('pointerdown', () => music.unlock(), true);
  window.addEventListener('click', () => music.unlock(), true);

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  const lookMouse = (e) => e.pointerType !== 'touch' && feel.mode === 'look'; // whatever is not a finger: some browsers leave the kind of pointer empty while they hold it
  canvas.addEventListener('pointerdown', (e) => {
    setDev('keys');
    if (lookMouse(e)) { look.buttons = e.buttons; return; } // the buttons are wrap and sprint here, read in readInput
    try { canvas.setPointerCapture?.(e.pointerId); } catch { /* not while the pointer is locked */ }
    // On the plate the mouse's left button turns the view, its right button has the fish swim to the pointer, and the two together swim it
    // where the view points while the mouse steers (readInput). A mouse is one pointer however many of its buttons are down, and says which
    // in `buttons`; a finger is a pointer each, and the fish swims to the first of them.
    const mouse = e.pointerType !== 'touch';
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button, mouse, buttons: e.buttons });
    if (pointers.size === 1 && !mouse && e.button === 0) steerId = e.pointerId;
    if (pointers.size === 2) { steerId = null; gesture = null; }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (lookMouse(e)) {
      look.buttons = e.buttons; look.over = true;
      const r = canvas.getBoundingClientRect();
      look.mx = ((e.clientX - r.left) / Math.max(r.width, 1)) * 2 - 1;
      if (look.locked || look.free) turnView(e.movementX || 0, e.movementY || 0, 0.0028);
      return;
    }
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (p.mouse) { p.buttons = e.buttons; if (e.buttons & 1) turnView(dx, dy, 0.006); } // the left button, alone or with the right: the view turns with the mouse. (A second button going down or coming up arrives here too, as a move.)
    else if (pointers.size === 2) { // two fingers: pinch to zoom, drag to look around
      const [a, b] = [...pointers.values()];
      const g = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
      if (gesture) {
        cam.zoom = clamp(cam.zoom * (gesture.d / Math.max(g.d, 1)), 0.4, 2.6);
        turnView(g.cx - gesture.cx, g.cy - gesture.cy, 0.006);
      }
      gesture = g;
    }
  });
  const release = (e) => {
    if (lookMouse(e)) look.buttons = e.buttons;
    pointers.delete(e.pointerId);
    if (steerId === e.pointerId) steerId = null;
    gesture = null;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('pointerleave', () => { look.over = false; });
  canvas.addEventListener('click', (e) => {
    if (feel.mode !== 'look' || e.pointerType === 'touch') return;
    if (ended() && look.locked && run.stateT > 1.2) return startRun(); // the mouse is the game's, so the button on the end card is out of reach: a click dives again
    if (!look.locked) grab(true);
  });
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); cam.zoom = clamp(cam.zoom * Math.exp(e.deltaY * 0.0011), 0.4, 2.6); }, { passive: false });

  // --- the controller, once a frame: its menu buttons, its camera stick; and the edge turn of an uncaptured mouse
  function moveFocus(menu, dir) {
    const items = [...menu.querySelectorAll('button, input')].filter((el) => !el.disabled && el.offsetParent !== null);
    const i = items.indexOf(document.activeElement);
    items[i < 0 ? (dir > 0 ? 0 : items.length - 1) : (i + dir + items.length) % items.length]?.focus();
  }
  function devices(dt) {
    const P = pad.poll();
    if (P.active) { setDev('pad'); stir(); }
    const text = P.blocked ? 'Controllers are blocked in this view of the page.' : !P.connected ? 'No controller seen yet. To use one, click the page once, then press any button on it.'
      : `${pad.title()} is connected${pad.motors ? ', and can vibrate' : `, but the browser reports no vibration motors for it${!/dualsense|054c/i.test(P.name) ? '' : !pad.direct.supported ? ': Chrome and Edge can get round that' : pad.direct.allowed ? ': press “Connect DualSense motors” below' : ': “Connect DualSense motors” gets round that, but only on the game’s own page, not in a preview like this one'}`}.${P.standard ? '' : ' The browser does not recognise its layout, so buttons may be mixed up. Chrome and Edge read a DualSense properly.'}`;
    if (text !== padText) { padText = text; $('pad-note').textContent = text; }
    if (P.connected && wait && wait.p) { // the binding menu is listening for a button
      const i = pad.anyPressed();
      if (i >= 0) { const w = wait; wait = null; showBinds(setPad(w.a, i)); }
    } else if (P.connected) {
      if (pp('pause') && !ended()) setPaused(!paused);
      else if (ended() && run.stateT > 1 && (pad.pressed(BTN.options) || pp('pause'))) startRun();
      const menu = paused ? $('pause') : ended() && $('end').classList.contains('on') ? $('end') : null;
      if (menu) { // in a menu the D-pad, Cross and Circle are fixed, whatever they are bound to in the dive
        const go = (pad.pressed(BTN.down) || (P.ly > 0.6 && navY <= 0.6) ? 1 : 0) - (pad.pressed(BTN.up) || (P.ly < -0.6 && navY >= -0.6) ? 1 : 0);
        if (go) moveFocus(menu, go);
        const at = menu.contains(document.activeElement) ? document.activeElement : null;
        const nudge = (pad.pressed(BTN.right) ? 1 : 0) - (pad.pressed(BTN.left) ? 1 : 0);
        if (nudge && at?.type === 'range') { at.value = +at.value + nudge * 5; at.dispatchEvent(new Event('input')); }
        if (pad.pressed(BTN.cross)) (at?.tagName === 'BUTTON' ? at : menu.querySelector('button')).click();
        if (paused && pad.pressed(BTN.circle)) { if (fb.open) openNote(false); else if ($('pause').classList.contains('binding')) openBinds(false); else setPaused(false); }
      } else {
        if (pp('hide')) setFull(!ui.full);
        if (pp('shed')) shed();
        if (pp('oarL')) stroke(-1);
        if (pp('oarR')) stroke(1);
        if (pp('behind')) behind(clamp(cam.pitch, 0.2, 0.6));
        if (pp('full')) fullscreen(false);
        if (pp('view') && !touch) setMode(feel.mode === 'look' ? 'point' : 'look');
        if (P.rx || P.ry) { const curve = (v) => v * (0.4 + 0.6 * Math.abs(v)); turnView(curve(P.rx) * dt, curve(P.ry) * dt, 2.6, 1.6); }
      }
      navY = P.ly;
    }
    if (!paused && !ended()) { // zoom, from a controller button or a key
      const z = (pd('zoomOut') || kd('zoomOut') ? 1 : 0) - (pd('zoomIn') || kd('zoomIn') ? 1 : 0);
      if (z) cam.zoom = clamp(cam.zoom * Math.exp(z * 1.2 * dt), 0.4, 2.6);
    }
    if (!paused && !ended() && feel.mode === 'look' && look.free && look.over) {
      const edge = Math.sign(look.mx) * clamp((Math.abs(look.mx) - 0.78) / 0.2, 0, 1);
      if (edge) turnView(edge * dt, 0, 1.7);
    }
  }

  for (const [id, key] of [['btn-rise', 'rise'], ['btn-dive', 'dive'], ['btn-dash', 'dash']]) {
    const b = $(id);
    b.addEventListener('pointerdown', (e) => { held[key] = true; b.setPointerCapture?.(e.pointerId); e.preventDefault(); });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, () => { held[key] = false; });
    b.addEventListener('keydown', (e) => { if (e.code === 'Enter' || e.code === 'Space') held[key] = true; });
    b.addEventListener('keyup', () => { held[key] = false; });
  }
  $('btn-shed').addEventListener('click', (e) => { shed(); if (e.detail > 0) e.currentTarget.blur(); });
  $('btn-again').addEventListener('click', (e) => { startRun(); if (e.isTrusted) grab(true); });
  $('btn-pause').addEventListener('click', (e) => { setPaused(!paused); if (!paused) { if (e.isTrusted) grab(true); if (e.detail > 0) e.currentTarget.blur(); } });
  $('btn-resume').addEventListener('click', (e) => { setPaused(false); if (e.isTrusted) grab(true); });
  for (const id of ['btn-fs', 'btn-full']) $(id).addEventListener('click', (e) => { fullscreen(e.isTrusted); if (id === 'btn-fs' && e.detail > 0) e.currentTarget.blur(); });
  $('btn-new').addEventListener('click', (e) => {
    if (!$('btn-new').dataset.armed) return newDive(true);
    setPaused(false); startRun();
    if (e.isTrusted) grab(true);
  });
  $('mode-point').addEventListener('click', () => setMode('point'));
  $('mode-look').addEventListener('click', () => setMode('look'));
  $('btn-keys').addEventListener('click', () => setFull(!ui.full, true));
  // ---- testing tools: in the pause menu, and only while the keys and tools are on screen. Straight to any band, a longer body, the keeper out of the way
  $('dev-bands').innerHTML = FLOORS.map((f, i) => `<button type="button" data-band="${i}" title="${f.name}" aria-pressed="false">${i + 1}</button>`).join('');
  const DEV_NOTE = 'For trying things out. A band starts fresh, at the length you have.';
  function showDev(msg) { for (const b of $('dev-bands').children) b.setAttribute('aria-pressed', String(+b.dataset.band === run.floor)); $('dev-keeper').disabled = !guard || guard.done; $('dev-grow').disabled = run.segs >= MAX_SEGS; $('dev-msg').textContent = msg || DEV_NOTE; }
  $('dev-bands').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b || ended()) return; enterFloor(+b.dataset.band, false); setPaused(false); if (e.isTrusted) grab(true); });
  $('dev-grow').addEventListener('click', () => { run.segs = Math.min(MAX_SEGS, run.segs + 4); run.longest = Math.max(run.longest, run.segs); buildFish(run.segs); showDev(`${run.segs} segments now.`); });
  $('dev-unlock').addEventListener('click', () => { for (const k of Object.values(SHELL_FEATS)) nest.feats[k] = true; store.set('oarfish.nest', nest); showDev('Every kind of shell can be found, from the next dive on.'); });
  $('dev-forget').addEventListener('click', () => { Object.assign(nest, { record: 0, shells: [], fragments: 0, feats: {} }); store.set('oarfish.nest', nest); showDev('The nest remembers nothing: no record, no shells, no fragments, nothing unlocked. It shows from the next dive.'); });
  $('dev-bring').innerHTML = BRING.map((n) => `<button type="button" data-bring="${n.id}"${n.id === 'squid' ? ' id="dev-squid"' : ''} aria-pressed="false">${n.name}</button>`).join('');
  $('dev-bring').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; const id = b.dataset.bring, on = !pets[id], name = NPC[id].name.toLowerCase(), many = LIVES[id]?.n > 1; bring(id, on); b.setAttribute('aria-pressed', String(on));
    const sand = SAND_PETS[id]; if (sand) { showDev(on ? sand.here : sand.gone); return; }
    showDev(on ? (many ? `${LIVES[id].n} ${name === 'moon jelly' ? 'moon jellies' : `${name}s`} are in the water just ahead of you. They are only to look at.` : `A ${name} is in the water just ahead of you. It is only to look at.`) : many ? 'They are gone.' : `The ${name} is gone.`); });
  $('dev-keeper').addEventListener('click', () => { if (guard && !guard.done) { guard.debug.fall(); showDev(`The ${guard.kind} is beaten: the rift is open.`); } });
  {
    const ls = $('f-look');
    ls.value = Number.isFinite(fp.look) ? fp.look : SHIPPED_FEEL.look;
    const setLook = () => { feel.look = +ls.value / 100; fp.look = +ls.value; store.set('oarfish.feel', fp); };
    ls.addEventListener('input', setLook);
    feel.look = +ls.value / 100;
    $('f-teach').checked = teach.on;
    $('f-light').checked = !!fp.light; if (fp.light) setLight(true, false);
    $('f-light').addEventListener('change', (e) => setLight(e.target.checked));
    $('f-teach').addEventListener('change', (e) => setTeach(e.target.checked));
    $('btn-skip').addEventListener('click', (e) => { setTeach(false); if (e.detail > 0) e.currentTarget.blur(); });
    const rs = $('f-rumble');
    rs.value = Number.isFinite(fp.rumble) ? fp.rumble : SHIPPED_FEEL.rumble;
    const setRumble = () => { feel.rumble = +rs.value / 100; fp.rumble = +rs.value; store.set('oarfish.feel', fp); };
    rs.addEventListener('input', setRumble);
    feel.rumble = +rs.value / 100;
    // the test plays the three things the motors do: the light one, the heavy one, then a heartbeat
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    $('btn-rumble').addEventListener('click', async () => {
      const say = (t) => { $('rumble-msg').textContent = t; };
      if (!pad.state.connected) return say('No controller is connected. Press any button on it first.');
      const seen = pad.report().join('; ');
      if (!pad.motors) return say(`${seen}. ${!/dualsense|054c/i.test(pad.state.name) ? 'The browser gives this page no motors to drive for this controller.' : pad.direct.supported ? 'On Windows the browser has no motor code for a DualSense, whatever the cable. Press “Connect DualSense motors” and pick the controller from the browser’s list: the game then drives the motors itself.' : 'This browser has no motor code for a DualSense and cannot hand the controller to the page either. Chrome and Edge can: open the game in one of them and press “Connect DualSense motors”.'}`);
      if (feel.rumble <= 0) return say('Vibration is turned all the way down.');
      say(`${seen}. Playing: the light motor, the heavy motor, then a heartbeat.`);
      const k = feel.rumble, first = await pad.test(0, k, 350);
      await wait(200); await pad.test(k, 0, 350); await wait(250);
      for (const m of [0.8, 0.45, 0.8, 0.45]) { await pad.test(k * m, 0, 90); await wait(m > 0.5 ? 70 : 350); }
      say(`${seen}. The browser ${first === 'played' ? 'played all three' : `answered: ${first}`}. If your hands felt nothing, the command is being dropped between the browser and the controller: try a USB cable in place of Bluetooth, and close Steam if it is running.${pad.direct.trouble ? ` (${pad.direct.trouble})` : ''}`);
    });
    // A DualSense on Windows: no browser drives its motors, but Chrome and Edge will hand the controller to the page (pad.js). The browser
    // shows its own list, the player picks the controller once, and it is taken up again on every later visit without asking.
    const db = $('btn-direct'), directName = () => { db.textContent = pad.direct.connected ? 'DualSense motors: connected' : 'Connect DualSense motors'; };
    db.hidden = !pad.direct.supported;
    db.addEventListener('click', async () => {
      const say = (t) => { $('rumble-msg').textContent = t; };
      const got = pad.direct.connected ? 'connected' : await pad.direct.connect();
      directName();
      if (got === 'connected') { pad.rumble(0.7, 0.7, 220); return say(`Connected (${pad.direct.how}): you should have felt one short buzz. The game drives the motors itself from now on, and the browser will remember the controller. If you felt nothing, close Steam or anything else that manages the controller and press this again.`); }
      say({ none: 'No controller was picked. In the browser’s list choose the one called DualSense or Wireless Controller, then press Connect.', blocked: 'This is a preview inside another page, and the browser does not let those reach devices. It works on the game’s own page.', unsupported: 'This browser cannot do this. Chrome and Edge can.', failed: `The controller would not open: ${pad.direct.trouble || 'no reason given'}. Close Steam, DS4Windows or anything else that manages the controller, and try again.` }[got] || `The browser answered: ${got}.`);
    });
    pad.direct.resume().then(directName);
  }
  const toggle = (id, key, apply) => {
    const b = $(id);
    const set = (v) => { show[key] = v; b.setAttribute('aria-pressed', String(v)); apply(v); };
    b.addEventListener('click', (e) => { set(!show[key]); if (e.detail > 0) b.blur(); });
    b.setAttribute('aria-pressed', String(show[key]));
  };
  toggle('show-wire', 'wire', (v) => { fish.wire.visible = v; });
  toggle('show-bones', 'bones', (v) => { fish.helper.visible = v; });

  // The Tuning drawer. Every music slider is one decision about the score. A set of them is a preset:
  // it can apply to every depth or only to the depth you are in, and travels as a short text code.
  const prefs = store.get('oarfish.music', {});
  if (!prefs.all) { prefs.all = {}; for (const k of MUSIC_KEYS) if (Number.isFinite(prefs[k])) prefs.all[k] = prefs[k]; } // settings saved by the first version
  prefs.zones ||= {};
  const savePrefs = () => store.set('oarfish.music', prefs);
  const preset = (floor) => ({ ...SHIPPED_MUSIC.all, ...prefs.all, ...(SHIPPED_MUSIC.zones[floor] || {}), ...(prefs.zones[floor] || {}) });
  const zoneName = (i) => FLOORS[i].name.replace(/^The /, 'the ').replace(/,.*/, '');
  function showPreset() { // put the sliders, and the band, on whatever applies at this depth
    const p = preset(run.floor), own = !!prefs.zones[run.floor];
    for (const k of MUSIC_KEYS) { $(`m-${k}`).value = p[k]; music.set(k, p[k] / 100); }
    $('scope-all').setAttribute('aria-pressed', String(!own)); $('scope-zone').setAttribute('aria-pressed', String(own));
    $('scope-note').textContent = own ? `These sliders are set for ${zoneName(run.floor)} only.` : 'These sliders are set for every depth without its own setting.';
  }
  const presetCode = () => { const p = preset(run.floor); return `oarfish-music:1:${MUSIC_KEYS.map((k) => `${k}=${Math.round(p[k])}`).join(',')}${prefs.zones[run.floor] ? `,zone=${run.floor + 1}` : ''}`; };
  function applyCode(text) { // returns a sentence saying what happened
    const m = /oarfish-music:1:([a-z0-9=,]+)/i.exec(text || '');
    if (!m) return 'That is not a preset code. A code starts with oarfish-music:1:';
    const got = {};
    let zone = null;
    for (const part of m[1].split(',')) {
      const [k, v] = part.split('='), n = Number(v);
      if (!Number.isFinite(n)) continue;
      if (k === 'zone' && n >= 1 && n <= FLOORS.length) zone = Math.round(n) - 1;
      else if (MUSIC_KEYS.includes(k)) got[k] = clamp(Math.round(n), 0, 100);
    }
    if (!Object.keys(got).length) return 'That code has no settings in it.';
    if (zone === null) Object.assign(prefs.all, got); else prefs.zones[zone] = { ...preset(zone), ...got };
    savePrefs(); showPreset();
    if (zone !== null) return `Applied to ${zoneName(zone)} only.`;
    return prefs.zones[run.floor] ? `Applied to every depth. ${zoneName(run.floor)[0].toUpperCase()}${zoneName(run.floor).slice(1)} keeps its own setting.` : 'Applied to every depth.';
  }
  {
    const drawer = $('drawer'), tab = $('music-tab');
    tab.addEventListener('click', (e) => { const open = !drawer.classList.contains('open'); drawer.classList.toggle('open', open); tab.setAttribute('aria-expanded', String(open)); if (e.detail > 0) tab.blur(); });
    drawer.querySelectorAll('input[type=range]').forEach((el) => el.addEventListener('pointerup', () => el.blur())); // hand the keyboard back to the fish
    for (const k of MUSIC_KEYS) $(`m-${k}`).addEventListener('input', (e) => {
      (prefs.zones[run.floor] || prefs.all)[k] = +e.target.value;
      music.set(k, +e.target.value / 100); savePrefs();
    });
    const vol = $('m-volume');
    if (Number.isFinite(prefs.volume)) vol.value = prefs.volume;
    vol.addEventListener('input', () => { music.set('volume', +vol.value / 100); prefs.volume = +vol.value; savePrefs(); });
    music.set('volume', +vol.value / 100);
    $('scope-all').addEventListener('click', (e) => { delete prefs.zones[run.floor]; savePrefs(); showPreset(); if (e.detail > 0) e.currentTarget.blur(); });
    $('scope-zone').addEventListener('click', (e) => { prefs.zones[run.floor] ||= preset(run.floor); savePrefs(); showPreset(); if (e.detail > 0) e.currentTarget.blur(); });
    const msg = (t) => { $('preset-msg').textContent = t; };
    $('preset-copy').addEventListener('click', async (e) => {
      const code = presetCode(), b = e.currentTarget;
      try { await navigator.clipboard.writeText(code); msg(`Copied: ${code}`); }
      catch { $('preset-in').value = code; $('preset-in').select(); msg('Copying was blocked here. The code is in the box below, selected: copy it from there.'); }
      if (e.detail > 0) b.blur();
    });
    const apply = () => { msg(applyCode($('preset-in').value)); };
    $('preset-apply').addEventListener('click', (e) => { apply(); if (e.detail > 0) e.currentTarget.blur(); });
    $('preset-in').addEventListener('keydown', (e) => { if (e.code === 'Enter') { apply(); e.target.blur(); } });
    const mute = $('music-mute');
    const setMute = (m) => { music.mute(m); mute.setAttribute('aria-pressed', String(!m)); mute.textContent = m ? 'Sound off' : 'Sound on'; prefs.muted = m; savePrefs(); };
    mute.addEventListener('click', (e) => { setMute(!music.muted); if (e.detail > 0) mute.blur(); });
    setMute(!!prefs.muted);
    // the feel
    const as = $('f-assist');
    if (Number.isFinite(fp.assist)) as.value = fp.assist; else as.value = SHIPPED_FEEL.assist;
    const setAssist = () => { feel.assist = +as.value / 100; fp.assist = +as.value; store.set('oarfish.feel', fp); };
    as.addEventListener('input', setAssist);
    feel.assist = +as.value / 100;
  }

  // what the player is asking for this frame
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(), hit = new THREE.Vector3();
  const input = { dir: null, amount: 1, vertical: 0, sprint: false, gentle: false, coil: 0, tight: false, bite: false, aim: null };
  const dirVec = new THREE.Vector3(), aimVec = new THREE.Vector3();
  // What sprinting and dashing cost. Nothing, unless something is hunting the fish: then a sprint drains the bar,
  // a dash takes a third of it, and an empty bar means swimming at the ordinary pace until some of it is back.
  function effort(dt, inp) {
    const hunt = foes.state.danger > 0 || (sum ? sum.state.danger >= 0.5 : false) || (guard ? guard.state.danger >= 0.5 : false);
    run.hunted = hunt ? STAMINA.linger : Math.max(0, run.hunted - dt);
    const taxed = run.hunted > 0;
    run.dashCool = Math.max(0, run.dashCool - dt); run.rest += dt;
    inp.dash = false; inp.winded = false;
    const cost = (STAMINA.dash * mods.dashCost) / mods.stamina; // shells change what a dash costs and how long the bar lasts
    if (inp.dashNow && !inp.coil && run.dashCool <= 0 && (!taxed || run.stamina >= cost - 1e-6)) {
      inp.dash = true; inp.dashScale = mods.dashScale * (run.charge >= 1 ? LENGTH.charge.reach : 1); run.dashCool = STAMINA.cool * mods.dashCool;
      if (taxed) { run.stamina = Math.max(0, run.stamina - cost); run.rest = 0; }
      moment('dash');
    }
    if (inp.sprint && inp.dir && !inp.coil) {
      if (run.winded) inp.winded = true;
      else if (taxed) {
        run.stamina -= (dt / (STAMINA.sprint * mods.stamina)) * (run.harmony >= OARS.top ? OARS.sprint : 1); run.rest = 0; // in full harmony a sprint costs half
        if (run.stamina <= 0) { run.stamina = 0; run.winded = true; inp.winded = true; }
        say('stamina', 'Sprinting only tires you while something hunts you. The ring by your head is what you have left.', 7);
      }
    }
    if (!taxed) run.stamina = Math.min(1, run.stamina + dt / 1.2);
    else if (run.rest > STAMINA.pause) run.stamina = Math.min(1, run.stamina + dt / STAMINA.regen);
    if (run.winded && run.stamina >= cost) run.winded = false;
  }
  const ringable = () => { const big = sum?.ring || guard?.ring; return big ? [...world.schools, big] : world.schools; }; // swarms, and the Sum's head while it holds still
  const ringableToo = () => [...(world.react?.posts || []), ...(world.react?.fragments || []).map((f) => f.ring)]; // and, when none of those is in reach, a capstan or a fragment in the ruins
  // what the wrap keys would go round from here, and how far off it is: the nearest swarm or keeper in reach, else the nearest thing in the ruins
  function nearestRing() {
    let t = null, td = Infinity;
    if (run.haul) return { t, td }; // a body with a load in it goes round nothing
    for (const list of [ringable(), ringableToo()]) {
      for (const sc of list) {
        if (sc.left <= 0 || !sc.can || sc.threat < 0.3) continue;
        const d = Math.hypot(sc.x - rig.snout.x, sc.z - rig.snout.z);
        if (d < sc.orbit * 2.4 + 1.2 && d < td) { t = sc; td = d; }
      }
      if (t) break;
    }
    return { t, td };
  }
  // the nearest swarm the body could take, and which way round it the fish is already heading
  function wrapSide() {
    const { t, td } = nearestRing();
    if (t) return rig.forward.x * (rig.snout.z - t.z) - rig.forward.z * (rig.snout.x - t.x) >= 0 ? 1 : -1;
    return Math.abs(rig.yawRate) > 0.25 ? Math.sign(rig.yawRate) : side;
  }
  function readInput() {
    let ix = (kd('right') ? 1 : 0) - (kd('left') ? 1 : 0), iy = (kd('up') ? 1 : 0) - (kd('down') ? 1 : 0), amount = 1;
    const P = pad.state, mouse = feel.mode === 'look' && (look.locked || (look.free && look.over)) ? look.buttons : 0;
    input.dir = null; input.amount = 1; input.gentle = false; input.aim = null;
    const sprintKey = kd('sprint') || !!(mouse & 2) || pd('sprint', 0.3) || held.dash;
    input.sprint = sprintKey; input.dashNow = sprintKey && !wasSprint; input.dash = false; input.winded = false; // pressing the sprint button is the dash; holding it on is the sprint
    wasSprint = sprintKey;
    // the one-button wrap (left mouse button, or whatever is bound to it) picks its own side, once, when it goes down; the left and right ones still choose
    const wrap = !!(mouse & 1) || kd('wrap') || pd('wrap', 0.35);
    if (wrap && !wasWrap) side = wrapSide();
    wasWrap = wrap;
    input.coil = (kd('wrapL') || pd('wrapL', 0.35) ? 1 : 0) - (kd('wrapR') || pd('wrapR', 0.35) ? 1 : 0) || (wrap ? side : 0);
    if (input.coil) side = input.coil;
    input.tight = sprintKey; // sprint while coiling winds a tight spiral
    input.coilR = (bodyMetres() - 0.05) / (wrapRule(feel.assist).sweep + 0.35); // a plain coil is just tight enough to count as a wrap
    input.vertical = clamp((kd('rise') || held.rise || pd('rise') ? 1 : 0) - (kd('dive') || held.dive || pd('dive') ? 1 : 0), -1, 1);
    if (!ix && !iy && (P.lx || P.ly)) { ix = P.lx; iy = -P.ly; amount = Math.min(1, Math.hypot(ix, iy)); } // the stick also says how fast
    // the mouse on the plate: which of its buttons are down. Both together is forward, and forward is where the view points.
    let btns = 0; if (feel.mode === 'point') for (const [id, p] of pointers) if (p.mouse) { btns = p.buttons & 3; mouseId = id; }
    const both = btns === 3;
    if (both && !ix && !iy) iy = 1;
    if (ix || iy) {
      // relative to the camera: up on the keyboard is away from the viewer
      const s = Math.sin(cam.yaw), c = Math.cos(cam.yaw);
      input.dir = dirVec.set(c * ix - s * iy, 0, -s * ix - c * iy).normalize();
      input.amount = amount;
      // the adventure camera also aims the fish up and down: forward goes where the view points, back goes the other way.
      // A little either side of level changes nothing, so the fish holds its depth until the view is tilted on purpose.
      if (feel.mode === 'look' || both) { // and so does the plate's view while both mouse buttons are held
        const tilt = (feel.mode === 'look' ? LOOK_LEVEL : PLATE_LEVEL) - cam.pitch, past = Math.abs(tilt) - (feel.mode === 'look' ? 0.1 : 0.15); // a held mouse wanders more than a locked one: the plate forgives a little more
        if (past > 0) input.vertical = clamp(input.vertical + Math.sign(tilt) * Math.min(1, past / 0.5) * (iy / Math.hypot(ix, iy)) * amount, -1, 1);
      }
    } else if ((steerId !== null && pointers.has(steerId)) || btns === 2) {
      // swim to the point under the pointer, at the fish's own depth: a finger, or the mouse with its right button down
      const p = pointers.get(btns === 2 ? mouseId : steerId), r = canvas.getBoundingClientRect();
      ndc.set(((p.x - r.left) / r.width) * 2 - 1, -((p.y - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      plane.set(THREE.Object3D.DEFAULT_UP, -rig.pos.y);
      if (ray.ray.intersectPlane(plane, hit)) {
        input.aim = aimVec.copy(hit);
        dirVec.set(hit.x - rig.pos.x, 0, hit.z - rig.pos.z);
        const d = dirVec.length();
        if (d > 0.7) {
          input.dir = dirVec.multiplyScalar(1 / d);
          input.gentle = true; // slow right down as it reaches the pointer
          input.amount = clamp((d - 0.7) / 5.5, 0, 1);
          input.sprint = input.sprint || d > 9.5;
        }
      }
    }
    return input;
  }
  // The loop assist. Near a swarm the body is long enough to take, steering is drawn onto the ring just
  // outside the ball: gently if the player is already circling, fully if they hold a coil key or point at
  // the swarm itself. Steering away from the ring drops it at once. `feel.assist` scales all of it.
  const assisted = { dir: new THREE.Vector3(), amount: 1, vertical: 0, sprint: false, gentle: true, coil: 0, tight: false, bite: false };
  function assist(inp) {
    const a = feel.assist;
    if (a < 0.02 || inp.tight) return inp;
    const { t, td } = nearestRing();
    if (!t) return inp;
    const rx = (rig.snout.x - t.x) / (td || 1e-3), rz = (rig.snout.z - t.z) / (td || 1e-3); // from the swarm out to the nose
    let sense = rig.forward.x * rz - rig.forward.z * rx >= 0 ? 1 : -1, full = false; // keep going the way the fish already turns
    if (a >= 0.25 && inp.coil) { full = true; sense = inp.coil; }
    else if (a >= 0.25 && inp.aim && Math.hypot(inp.aim.x - t.x, inp.aim.z - t.z) < t.orbit + 0.35) full = true;
    const pull = clamp((t.orbit - td) * 1.6, -0.95, 0.95); // back out to the ring, or in to it
    const dx = sense * rz + rx * pull, dz = -sense * rx + rz * pull, dl = Math.hypot(dx, dz) || 1;
    const cap = clamp((Math.min(SPEED.swim, 2.5 * t.orbit) - SPEED.idle * 1.6) / (SPEED.swim - SPEED.idle * 1.6), 0.1, 1); // slow enough to hold the turn
    Object.assign(assisted, { vertical: inp.vertical, sprint: false, dash: inp.dash, bite: inp.bite, coil: 0, tight: false, gentle: true });
    if (full) { assisted.dir.set(dx / dl, 0, dz / dl); assisted.amount = cap; return assisted; }
    if (!inp.dir || inp.sprint) return inp;
    const agree = (inp.dir.x * dx + inp.dir.z * dz) / dl;
    if (agree < 0.2) return inp; // the player is steering somewhere else
    const near = clamp(1 - Math.abs(td - t.orbit) / (t.orbit + 0.8), 0, 1);
    const w = a * 0.8 * clamp((agree - 0.2) / 0.5, 0, 1) * (0.35 + 0.65 * near);
    assisted.dir.set(lerp(inp.dir.x, dx / dl, w), 0, lerp(inp.dir.z, dz / dl, w)).normalize();
    assisted.gentle = inp.gentle;
    assisted.amount = lerp(inp.amount, Math.min(inp.amount, inp.gentle ? cap : clamp((2.5 * t.orbit - SPEED.swim * 0.45) / (SPEED.swim * 0.55), 0, 1)), w);
    return assisted;
  }
  const scripted = { dir: new THREE.Vector3(), amount: 1, vertical: 0, sprint: false, gentle: false, coil: 0, bite: false };
  const idle = { dir: null, amount: 1, vertical: 0, sprint: false, gentle: false, coil: 0, bite: false };

  // ---------------------------------------------------------------- camera and light
  const want = new THREE.Vector3(), camPos = new THREE.Vector3();
  function placeCamera(dt) {
    const N = rig.joints.length - 1, V = VIEW[feel.mode];
    want.copy(rig.joints[0]).lerp(rig.joints[Math.min(5, N)], 0.5).addScaledVector(rig.forward, rig.speed * 0.32);
    focus.lerp(want, dt ? 1 - Math.exp(-3.4 * dt) : 1);
    if (cam.ease) { // a move the game asked for, such as swinging in behind the fish; any look input cancels it
      const k = dt ? 1 - Math.exp(-(cam.ease.rate || 5) * dt) : 1;
      cam.yaw += wrapPi(cam.ease.yaw - cam.yaw) * k; cam.pitch += (cam.ease.pitch - cam.pitch) * k;
      cam.ease.t -= dt || 1;
      if (cam.ease.t <= 0) cam.ease = null;
    }
    cam.pitch = clamp(cam.pitch, V.low, 1.4);
    cam.dist = damp(cam.dist, 10.6 + 1.2 * bodyMetres(), dt ? 1.5 : 1e3, dt || 1); // step back as the body grows
    cam.fov = damp(cam.fov, V.fov, dt ? 3 : 1e3, dt || 1); cam.k = damp(cam.k, V.k, dt ? 3 : 1e3, dt || 1);
    if (Math.abs(camera.fov - cam.fov) > 0.01) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }
    const d = cam.dist * cam.zoom * cam.fit * cam.k, cp = Math.cos(cam.pitch), sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw);
    camPos.set(focus.x + sy * cp * d, focus.y + Math.sin(cam.pitch) * d, focus.z + cy * cp * d);
    camPos.y = Math.max(camPos.y, world.height(camPos.x, camPos.z) + 1.2); // a low camera skims the seabed
    // ...and if a rise in the seabed still stands between it and the fish, it comes in to the last clear point
    let clear = 1;
    for (let i = 2; i < 10; i++) {
      const t = i / 10;
      if (lerp(focus.y, camPos.y, t) < world.height(lerp(focus.x, camPos.x, t), lerp(focus.z, camPos.z, t)) + 0.3) { clear = Math.max(0.4, (i - 1) / 10); break; }
    }
    cam.pull = dt ? damp(cam.pull, clear, clear < cam.pull ? 12 : 2, dt) : clear;
    if (cam.pull < 0.999) { camPos.lerpVectors(focus, camPos, cam.pull); camPos.y = Math.max(camPos.y, world.height(camPos.x, camPos.z) + 1.2); }
    if (cam.shake) { camPos.x += (Math.random() - 0.5) * cam.shake; camPos.y += (Math.random() - 0.5) * cam.shake; camPos.z += (Math.random() - 0.5) * cam.shake; }
    camera.position.copy(camPos);
    camera.lookAt(focus);
    const F = world.floor;
    scene.fog.near = d * F.fog[0];
    scene.fog.far = d + F.fog[1] + end.vista * 80; // the closed circle is seen whole, from far above
    // sinking into the rift's cloud, it closes round: sight comes in to a few metres and takes the cloud's colour.
    // A new band is arrived at the same way, out of it.
    const R = world.rift, into = R && R.in(rig.pos.x, rig.pos.z) > R.ledge - 1.5 ? clamp((R.ledgeY - 0.9 - rig.pos.y) / 3, 0, 1) : 0;
    cam.murk = dt ? damp(cam.murk || 0, into * into * (3 - 2 * into), 3.5, dt) : (cam.murk || 0);
    if (cam.murk > 0.002 || cam.murky) {
      scene.fog.near = lerp(scene.fog.near, 0.4, cam.murk); scene.fog.far = lerp(scene.fog.far, d + 6, cam.murk);
      scene.fog.color.set(F.water); if (R) scene.fog.color.lerp(R.murk, cam.murk);
      scene.background.copy(scene.fog.color); cam.murky = cam.murk > 0.002;
    }
    sun.position.copy(focus).add(SUN_OFFSET);
    sun.target.position.copy(focus);
    world.dress?.(focus); // (the last hall is a world of its own kind, with no dressing) what casts is whatever stands in the sun's box where it now is: this catches a cut, which moves it all at once
    lamp.position.set(rig.pos.x + sy * 2.4, rig.pos.y + 3, rig.pos.z + cy * 2.4); // above and on the viewer's side, so the flank is lit
    { const c = run.charge, full = c >= 1, beat = full ? 0.5 + 0.5 * Math.sin(world.time.value * 7) : 0; // the crest: a glow over the head that grows as it fills, and beats when it is full
      crest.position.copy(rig.joints[0]).y += 0.3; crest.scale.setScalar(c > 0 ? 0.5 + 0.9 * c + 0.3 * beat : 0.01); crest.material.opacity = damp(crest.material.opacity, c > 0 ? 0.2 + 0.4 * c + 0.2 * beat : 0, 6, dt); }
  }
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h, false); stir(); // a canvas that changes size is wiped
    camera.aspect = w / h;
    cam.fit = Math.max(1, Math.pow(1.35 / camera.aspect, 0.8)); // step back on tall screens
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  // ---------------------------------------------------------------- one tick of the game
  const ctx = { joints: null, snout: rig.snout, focus, time: 0, fear: 1.75 };
  const sctx = {};
  const body = { joints: rig.joints, snout: rig.snout, total: 3.5, assist: feel.assist };
  function step(dt, forced) {
    let inp = forced || (adrift.on ? figures(dt) : readInput());
    if (run.state === 'play' && run.haul && (inp.coil || inp.tight)) inp = { ...inp, coil: 0, tight: false }; // a body with a load in it cannot coil
    if (run.state === 'play') { effort(dt, inp); inp = assist(inp); }
    run.stateT += dt;
    if (run.state === 'play') run.time += dt;
    scripted.sprint = false; scripted.gentle = false;
    if (run.state === 'play') petStep(dt);
    if (run.state === 'arrive') { // sinking in from the band above
      scripted.dir.copy(rig.forward).setY(0).normalize(); scripted.vertical = -0.9; scripted.amount = 0.6;
      inp = scripted;
      if (run.stateT > 1.5) run.state = 'play';
    } else if (run.state === 'descend') {
      scripted.dir.copy(rig.forward).setY(0).normalize(); scripted.vertical = -1; scripted.amount = 0.3;
      inp = scripted;
      if (run.stateT > 0.8) { const owed = run.toll; run.toll = 0; enterFloor(run.floor + 1, true); $('fade').classList.remove('on'); payToll(owed); }
    } else if (run.state === 'refused') { // too short for the rift: it is carried back up out of it
      scripted.dir.copy(rig.forward).setY(0).normalize(); scripted.vertical = 1; scripted.amount = 0.5;
      inp = scripted;
      if (run.stateT > 1.1) run.state = 'play';
    } else if (run.state === 'opening') { // the Sum lets go and the seabed begins to shake
      inp = idle; end.quake = Math.min(1, run.stateT / 3);
      if (run.stateT > 5.5) { run.state = 'rise'; run.stateT = 0; }
    } else if (run.state === 'rise') { // up through every band it came down, in one swim, the ruins coming down behind it
      end.turn += dt * 0.4; end.quake = 1;
      scripted.dir.set(Math.sin(end.turn), 0, Math.cos(end.turn)); scripted.vertical = 1; scripted.amount = 1; scripted.sprint = true;
      inp = scripted;
      if (!end.swap && rig.pos.y > world.ceiling - 4.5) { end.swap = 1e-3; fade(true, run.floor > 0 ? FLOORS[run.floor - 1].water : SKY, 0.35); }
      if (end.swap && (end.swap += dt) > 0.45) { end.swap = 0; if (run.floor > 0) riseInto(run.floor - 1); else surface(); fade(false, fadeEl.style.background, 0.5); }
    } else if (run.state === 'surface') { // it breaks the surface and circles the raft
      circling(world.raft.position.x, world.raft.position.z, 5.2, scripted.dir); scripted.vertical = 1; scripted.amount = 0.5; scripted.gentle = run.stateT > 3;
      inp = scripted;
      if (run.stateT > 13) finish();
    } else if (run.state === 'closing') { // it takes its place along the inside of the ring
      const h = world.hall;
      circling(h.x, h.z, h.R - 3, scripted.dir); scripted.vertical = clamp((h.y + 2.2 - rig.pos.y) * 0.5, -0.6, 0.6); scripted.amount = 0.45; scripted.gentle = true;
      inp = scripted;
      end.vista = Math.min(1, run.stateT / 5); cam.zoom = damp(cam.zoom, 2.6, 0.5, dt);
      if (run.stateT > 11) finish();
    } else if (run.state === 'dead' || run.state === 'won') inp = idle;
    cam.shake = calm ? 0 : 0.16 * end.quake + 0.22 * run.kick;
    stage.classList.toggle('cine', cine()); // the endings play with the help put away
    if (run.state === 'play') end.quake = Math.max(0, end.quake - dt * 0.5);
    fall(dt);
    run.safe = Math.max(0, run.safe - dt); run.hush = Math.max(0, (run.hush || 0) - dt);
    rig.update(dt, inp, arena);
    if (run.state === 'play' && rig.dashT > 0) for (const u of world.urns) { // a dash breaks a sealed jar open
      if (u.broken || Math.hypot(wrapD(rig.snout.x - u.x), wrapD(rig.snout.z - u.z)) > u.col.r + 0.85 || rig.snout.y > u.y + u.size + 0.4) continue;
      world.breakUrn(u); moment('ram'); run.freeze = 0.06; cam.shake = Math.max(cam.shake, 0.35); rig.dashT = 0;
      const at = new THREE.Vector3(rig.pos.x + wrapD(u.x - rig.pos.x), u.y + u.size * 0.5, rig.pos.z + wrapD(u.z - rig.pos.z));
      if (u.prize === 'shell') field.drop(u.x, u.z, tut.prize || 'spire', 1.1); else for (let i = 0; i < 3; i++) mote(at.clone().add(new THREE.Vector3(Math.sin(i * 2.1) * 0.5, 0.3 * i, Math.cos(i * 2.1) * 0.5)), 1);
    }
    if (run.state === 'play' && rig.dashT > 0) { // a dash that meets a hunter head-on is a ram
      const hits = foes.ram(rig.snout, rig.forward, mods.tusk);
      if (sum?.ram(rig.snout)) hits.push({ kind: 'sum', pos: rig.snout, food: 0 });
      const charged = run.charge >= 1, blow = guard?.ram(rig.snout, charged ? LENGTH.charge.blows : 1);
      if (blow && blow.bounced) { rig.dashT = 0; run.kick = 0.5; } // it shrugged the ram off
      else if (blow) hits.push(blow);
      if (hits.length) {
        for (const h of hits) { if (h.food) mote(h.pos, h.food); if (h.killed) for (let i = 0; i < 2; i++) foes.spawnPiece(h.pos, 'debris'); }
        run.stamina = Math.min(1, run.stamina + (STAMINA.dash * mods.dashCost) / mods.stamina); run.dashCool = 0; // a ram that lands pays for itself
        run.kick = 1; run.freeze = 0.07;
        if (charged) { run.charge = 0; foes.stun(rig.snout, LENGTH.charge.shock, LENGTH.charge.stun); run.freeze = 0.12; cam.shake = Math.max(cam.shake, 0.6); moment('kill', 1); } // the crest spends itself on the blow
        if (hits.some((h) => !h.killed)) rig.dashT = 0; // something that survives the blow stops the dash; small things break and the dash carries on through them
        moment(hits.some((h) => h.baited) ? 'kill' : 'ram'); pulse('grow');
      }
    }
    run.kick = Math.max(0, run.kick - dt * 4);
    if (run.chainT > 0 && (run.chainT -= dt) <= 0) run.chain = 0; // nothing caught in time: the band goes back to what it was playing
    rowing(dt);
    hauling(dt);
    if (run.state === 'play' && !tut.on && run.time > 16 && rig.speed > 2) say('oars', dev === 'pad' ? `${pb('oarL')} and ${pb('oarR')} are your oars. Pull them in turn, on the beat of the band. Each pull in time adds a voice to the chord and speed to your swim.` : `${kb('oarL')} and ${kb('oarR')} are your oars. Pull them in turn, on the beat of the band. Each pull in time adds a voice to the chord and speed to your swim.`, 10);
    if (pulse3.at < 1.25) { pulse3.at += dt * pulse3.pace; fishPulse.value.x = pulse3.at; fishPulse.value.y = pulse3.k * clamp((1.25 - pulse3.at) / 0.3, 0, 1); } else fishPulse.value.y = 0;
    fish.mesh.visible = run.state === 'dead' ? run.stateT < 0.2 || Math.floor(run.stateT * 9) % 2 === 0 : !(run.safe > 0 && run.state === 'play' && Math.floor(run.time * 14) % 2);

    // going most of the way round something catches it
    let wrapBest = 0;
    if (run.state === 'play') {
      const rule = wrapRule(feel.assist);
      rule.sweep *= mods.sweep; // the Ring
      let fishCaught = 0;
      const lying = field?.at(rig.snout);
      if (lying) { // a shell under the head
        const d = SHELLS[lying.type];
        if (giveShell(lying.type)) { field.take(lying); moment('grow'); pulse('grow'); tell(`${d.worn}\nShed the segment it rides on, and ${d.shed}`, 10, { kind: 'shell', kick: 'A shell', title: d.name, tone: d.colour }); }
        else if (run.time - run.noRoom > 6) { run.noRoom = run.time; tell('A shell needs three segments of body to ride on. Grow longer and come back for it.', 5, { kind: 'warn', title: 'No room for it yet' }); }
      }
      for (const p of foes.pieces) if (p.fx === 'pearl' && !p.dead && p.age > 1.5 && p.life > 0.2 && p.pos.distanceTo(rig.snout) < 1.1) { // the Pearl's bait, taken back
        p.life = 0.1; run.segs = Math.min(MAX_SEGS, run.segs + 2); buildFish(run.segs); moment('grow'); pulse('grow');
      }
      for (const sc of world.schools) {
        if (sc.left <= 0 || sc.threat < 0.3 || run.haul) { sc.progress = 0; continue; }
        const w = rig.wrap(sc.x, sc.y, sc.z, sc.ball * 2.6 + 2);
        sc.progress = clamp(w.angle / rule.sweep, 0, 1); sc.arcStart = w.start; sc.arcSign = w.sign;
        if (sc.can) wrapBest = Math.max(wrapBest, sc.progress);
        if (w.angle < rule.sweep) continue;
        if (sc.can && w.minD >= sc.fit * 0.88) { // long enough, and the body went round the ball, not through it
          flashWrap(w.k, sc.y);
          const at = world.take(sc); // the whole swarm streams to the mouth, a few fish to a spark
          gulp(at, at.length, clamp(Math.sqrt(sc.n / SWARMS.h.n), 0, 1));
          fishCaught += sc.n;
          if (sc.tier === world.react?.greatest && sc.n === SWARMS[sc.tier].n) { world.react.earn('swarm'); feat('swarm'); } // the band's greatest swarm, whole: a carving on its mural
          if (sc.tier !== 's') say(`swarm-${sc.tier}`, sc.tier === 'h' ? 'The great swarm, whole.' : 'A bigger swarm, whole. Bigger ones still need a longer body.', 6);
        } else if (!sc.can && sc.burst <= 0) { // a body too short to go round it: the swarm bursts out and regroups
          sc.burst = 1; moment('burst');
          say('toobig', 'That swarm is too big to wrap yet. Its ring turns pale when your body is long enough.', 8);
        }
      }
      const big = foes.catchWith((pos, room) => {
        const w = rig.wrap(pos.x, pos.y, pos.z, room * 2 + 3.5);
        if (w.angle < rule.sweep || w.minD < room) return false;
        flashWrap(w.k, pos.y);
        return true;
      });
      for (const g of big) mote(g.pos, g.food);
      if (fishCaught || big.length) { // the catch lands: the world holds for an instant, the band hits as hard as the catch was big, and a catch soon after another adds to the band
        const size = clamp(Math.sqrt((fishCaught + big.length * 12) / SWARMS.h.n), 0, 1);
        run.chain = run.chainT > 0 ? Math.min(CHAIN.top, run.chain + 1) : 0; run.chainT = CHAIN.window;
        moment(big.length ? 'kill' : 'catch', size);
        if (run.chain) music.hit('chain', run.chain / CHAIN.top);
        run.freeze = Math.max(run.freeze, lerp(0.045, 0.1, size)); run.kick = Math.max(run.kick, 0.25 + 0.45 * size);
        if (mods.shock) foes.stun(rig.pos, 5, 2); // the Horn
      }
      const prey = sum?.ring || guard?.ring; // the Sum's head held still over a shed tail, or a rift's keeper when it can be held: ringed like anything else
      if (prey) {
        const g = prey, w = rig.wrap(g.x, g.y, g.z, g.room * 2 + 3.5);
        g.progress = clamp(w.angle / rule.sweep, 0, 1); g.arcStart = w.start; g.arcSign = w.sign; g.sweep = rule.sweep / (Math.PI * 2);
        g.fit = g.room * rule.squeeze; g.orbit = clamp((0.9 * (bodyMetres() - 0.05)) / rule.sweep, g.fit + 0.1, g.room * 0.95 + 0.3); // the ring an assisted swim follows, as for a swarm
        if (g.can) wrapBest = Math.max(wrapBest, g.progress);
        if (w.angle >= rule.sweep && w.minD >= g.fit * 0.88) {
          if (g.can) { flashWrap(w.k, g.y); if (sum) openCircle(); else guard.wrapped(); }
          else if (run.time - end.burst > 2) { end.burst = run.time; moment('burst'); } // a body too short to hold it
        }
      }
      if (guard && !guard.done && Math.hypot(wrapD(world.goal.x - rig.pos.x), wrapD(world.goal.z - rig.pos.z)) < 20) say('guard', 'Something keeps this rift. Deal with it and the way down opens.', 7);
      if (overRift()) say('toll', 'A rift takes part of your tail as you go down it. The dark end of your scale is what this one will take.', 9);
      if (run.state === 'play' && run.floor < FLOORS.length - 1 && (!guard || guard.done) && world.atGoal(rig.pos)) { // the palace gate only leads into the hall
        const owed = tollOf(run.segs);
        if (!owed && couldFeed()) { run.state = 'refused'; run.stateT = 0; moment('burst'); pulse('hurt'); tell('Too short for the rift. Feed first.', 4, { kind: 'warn' }); } // it cannot spare the toll, and there is still food here
        else { run.toll = owed; const N = rig.spine.length; for (let i = 0; i < owed; i++) foes.spawnPiece(rig.joints[Math.max(N - i, 1)], 'debris'); // what the rift takes is left behind in the cloud
          run.state = 'descend'; run.stateT = 0; fade(true, `#${world.rift.murk.getHexString()}`); moment('descend'); know('down'); }
      }
    }
    ctx.joints = rig.joints; ctx.time = world.time.value; ctx.dash = rig.dashT > 0; ctx.coil = rig.coiling;
    { const st = run.state === 'play' ? world.react?.stations.find((x) => x.k > 0.02) : null; // a cleaning station at work: the hunters come round, closer as it goes, and do not bite
      ctx.truce = st ? { x: st.cx, y: st.top + 0.9, z: st.cz, r: lerp(CLEAN.ring[0], CLEAN.ring[1], st.k), call: CLEAN.call, most: CLEAN.most, grace: CLEAN.grace } : null; }
    ctx.fear = clamp(0.45 * rig.length, 0.6, 1.75); // a short body cannot hide its tail behind its own head
    foes.update(dt, ctx);
    field?.update(dt, focus, world.time.value);
    if (foes.state.mineNear) say('mine', 'A spined drifter costs a segment if your body brushes it. Head first it only breaks: dash through it, or wrap it.', 8);
    if (sum || guard) {
      Object.assign(sctx, { pos: rig.pos, joints: rig.joints, pieces: foes.pieces, total: bodyMetres() - 0.05, focus, time: world.time.value, playing: run.state === 'play' });
      sum?.update(dt, sctx); guard?.update(dt, sctx);
    }

    // caught things streak to the mouth
    let eating = false;
    for (let i = 0; i < MOTES; i++) {
      const m = motes[i];
      if (!m) { moteArr[i * 3 + 1] = -9999; continue; }
      m.t += dt / 0.5;
      const k = clamp(m.t, 0, 1), e = k * k * (3 - 2 * k);
      moteArr[i * 3] = lerp(m.from.x, rig.snout.x, e); moteArr[i * 3 + 1] = lerp(m.from.y, rig.snout.y, e) + Math.sin(k * Math.PI) * 0.5; moteArr[i * 3 + 2] = lerp(m.from.z, rig.snout.z, e);
      if (m.t > 0.6) eating = true;
    }
    for (let i = motes.length - 1; i >= 0; i--) if (motes[i].t >= 1) { const [m] = motes.splice(i, 1), st = m.stream;
      if (!st) { addFood(m.food); continue; }
      st.food += m.food; st.in++;
      const note = Math.round(((st.in - 1) / Math.max(1, st.total - 1)) * (st.notes - 1)); // the first in sounds the bottom of the run, the last the top
      if (note > st.played) { st.played = note; music.gulp(note, st.notes, 0.5 + 0.5 * st.size); buzz(0, 0.12 + 0.1 * st.size, 30); }
      if (st.in >= st.total) addFood(Math.round(st.food), st.size); // the last one is in: now it grows
    }
    moteGeo.attributes.position.needsUpdate = true;
    idle.bite = input.bite = scripted.bite = eating;
    flash.material.opacity = Math.max(0, flash.material.opacity - dt * 1.1);

    placeCamera(dt);
    body.joints = rig.joints; body.total = bodyMetres() - 0.05; body.assist = feel.assist;
    world.update(dt, focus, rig.pos, camera, body);
    if (world.react) for (const c of world.react.opened.splice(0)) openCache(c);
    for (const sh of nestShells) { sh.m.rotation.y += dt * 0.5; sh.m.position.y = sh.p.y + 0.05 * Math.sin(world.time.value * 1.3 + sh.ph); } // the nest's shells turn over their places
    // the mural at the rift (world.js, MURAL) lights a carving as the fish comes up to it: a note each, rising, and when all three are lit the band answers
    if (world.react) for (const c of world.react.carved.splice(0)) {
      if (c.what === 'sign') { music.chime(1 + c.i * 2, 0.9); buzz(0.15, 0.3, 90); }
      else if (c.what === 'whole') { moment('cache'); buzz(0.4, 0.5, 260); feat('mural'); }
    }
    // a cleaning station (world.js, CLEAN): a note for each step of the work, and at the end of it a segment grown back
    if (world.react) for (const c of world.react.cleaned.splice(0)) {
      if (run.state !== 'play') continue;
      if (c.what === 'near') say('clean', 'A cleaning station. Hold still over the coral head and its cleaners will grow a segment back.', 8);
      else if (c.what === 'start') { moment('loop'); say('truce', 'Nothing bites while the cleaners work. But the hunters gather, and when it is done they are close.', 8); }
      else if (c.what === 'tick') { music.gulp(c.i, 7, 0.6); buzz(0, 0.14, 45); }
      else if (c.what === 'broke') moment('flit');
      else if (c.what === 'done') {
        run.cleaned++;
        if (run.segs < MAX_SEGS) { run.segs++; buildFish(run.segs); run.longest = Math.max(run.longest, run.segs); remember(); growPulse(1, false); }
        else run.charge = Math.min(1, run.charge + 0.34); // full grown: it goes to the crest
        music.gulp(6, 7, 0.8); pulse('grow'); moment('grow', 0.7);
        foes.startle(rig.snout, CLEAN.ring[1] + 4, CLEAN.start); // the body flares as it grows, and the hunters that had closed in start back from it: that is the moment to go
      }
    }
    // a swarm with a temper has just shown it (world.js, TEMPER): the band marks it, and the first time each is seen there is a line about what it wants
    if (world.react) for (const c of world.react.swarms.splice(0)) {
      if (run.state !== 'play') continue;
      if (c.what === 'bolt') { moment('flit'); say('bolt', 'That swarm bolts upward when you come at it level. Get above it first, then go round it.', 8); }
      else if (c.what === 'part') { moment('part'); say('twin', 'Cornered, that swarm parted in two. Each half is a smaller swarm: take one, then the other.', 8); }
      else if (c.what === 'shy') { moment('flit'); say('glow', 'That swarm will not bunch in the dark. Drive it to a lantern flower and take it there.', 8); }
      else if (c.what === 'lit') music.chime(2, 0.5);
    }
    if (world.react) for (const c of world.react.rang.splice(0)) { music.chime(c.note, c.v); buzz(0, 0.16 * c.v, 40); } // a chime brushed: the band gives it its note, the hands a tick. (The sea's surface, at the end, is a world with nothing in it to answer.)
    lessons(dt);
    hud(dt);
    music.update(dt, {
      speed: clamp(rig.speed / SPEED.sprint, 0, 1), coil: Math.max((hap.wrap = wrapBest, rig.coiling * 0.5), wrapBest), danger: Math.max(foes.state.danger, sum ? sum.state.danger : 0, guard ? guard.state.danger : 0), // the roll tightens as the wrap closes
      low: run.segs <= MIN_SEGS + 2, alive: run.state !== 'dead', length: run.segs / MAX_SEGS, activity: activity(), cast: castNear(), chain: run.state === 'play' ? run.chain : 0, harmony: run.state === 'play' ? run.harmony : 0,
    });
  }

  // one frame: the devices are read even while the dive is held, since the controller also works the menus
  function tick(dt) {
    devices(dt);
    if (keys.size || pointers.size || look.buttons) touchedAt = performance.now(); // something held down is a hand on it, however long it is held
    { const was = adrift.on; adrift.on = adrift.allow && !paused && !lib.isOpen && run.state === 'play' && !cine() && performance.now() - touchedAt > QUIET.away * 1000;
      if (adrift.on && !was) { adrift.t = 0; adrift.at.copy(rig.pos); adrift.turn = rig.yaw; } else if (was && !adrift.on) run.hush = 1.2; } // given back, it has a moment before anything can bite
    haptics(dt);
    if (run.freeze > 0 && !paused) { run.freeze -= dt; return; } // a ram lands: the world holds still for an instant
    if (!paused) return step(dt);
    nowPlaying(dt);
    music.update(dt, { speed: 0, coil: 0, danger: 0, low: false, alive: run.state !== 'dead' }); // the band idles
  }

  startRun(Number.isFinite(saved.seed) ? saved.seed : undefined);
  setMode(fp.mode || SHIPPED_FEEL.mode, true);
  setFull(ui.full === true, true);
  renderLegend();
  if (Number.isFinite(saved.floor) && saved.floor > 0 && saved.floor < FLOORS.length) { run.segs = clamp(saved.segs | 0, MIN_SEGS, MAX_SEGS); buildFish(run.segs); enterFloor(saved.floor, false); }
  for (const k of ['yaw', 'pitch', 'zoom']) if (Number.isFinite(saved[`cam_${k}`])) cam[k] = saved[`cam_${k}`];
  placeCamera(0);
  world.update(0, focus, rig.pos, camera);
  let last = performance.now();
  // the specimen library borrows the renderer: while it is open the dive is held and its own scene is drawn
  const lib = createLibrary({ renderer, root: $('library'), onHear: (id) => music.audition(id), onClose(changed) { stage.classList.remove('lib'); if (changed) { paintFish(); kit.refresh(); shellsChanged(); $('pause-msg').textContent = 'The oarfish and the shells have changed already. Everything else shows from the next band or dive.'; } $('btn-library').focus({ preventScroll: true }); } });
  function openLibrary(id) { if (!paused && !ended()) setPaused(true); stage.classList.add('lib'); lib.open(id); }
  $('btn-library').addEventListener('click', () => openLibrary());
  if (/^#library/.test(location.hash)) openLibrary(location.hash.split('/')[1]);
  renderer.setAnimationLoop((now) => {
    if (light.on && now - last < light.gap) return; // a lighter picture: on a fast screen, every other frame
    const dt = Math.min((now - last) / 1000, 0.05);
    if (!paused && !lib.isOpen && run.state === 'play' && !window.__hold) { session.played += dt; session.frames++; session.clock += Math.min((now - last) / 1000, 0.5); }
    last = now;
    if (lib.isOpen) { if (!window.__hold) lib.frame(dt); return renderer.render(lib.scene, lib.camera); }
    if (!window.__hold) tick(dt);
    if (still() && owed <= 0 && now > drawUntil && now - drewAt < QUIET.beat * 1000) return; // nothing has moved: what is on the screen stays there
    owed--; drewAt = now; renderer.render(scene, camera);
  });

  // keep the dive going when the page is republished under an open viewer
  window.claude?.hot?.snapshot?.(() => ({ seed: run.seed, floor: run.floor, segs: run.segs, cam_yaw: cam.yaw, cam_pitch: cam.pitch, cam_zoom: cam.zoom, wire: show.wire, bones: show.bones }));

  // used by the automated checks: advance the simulation without waiting for real time
  window.__game = {
    rig, run, cam, scene, camera, renderer, music, feel, shed, addFood, startRun, enterFloor, buildFish, snap: () => placeCamera(0), presetCode, applyCode,
    get binds() { return binds; }, bindStore, hap, buzz, teach, tut, setTeach, get lib() { return lib; }, openLibrary: (id) => openLibrary(id), pad, look, ui, setPaused, setMode, setFull, activity, castNear, readInput, session, QUIET, KEEPER_FIGHT, SHEARER_FIGHT, bringSquid, bring, pets, get pet() { return pets.squid?.list[0] || null; }, light, adrift, sun, noteBody, openNote, die, LENGTH, CHAIN, OARS, HAUL, CLEAN, nest, feat, oars, stroke, beatNow, fishPulse, stature, growCost, riftToll, tollOf, bite: game.bite, STAMINA, giveShell, SHELLS,
    get mods() { return mods; }, get field() { return field; }, get guard() { return guard; },
    dropShells() { run.shells = []; shellsChanged(); buildFish(run.segs); },
    get world() { return world; }, get foes() { return foes; }, get sum() { return sum; }, end, get paused() { return paused; }, get dev() { return dev; },
    sim(seconds, forced) { for (let t = 0; t < seconds; t += 1 / 60) { if (forced) step(1 / 60, forced); else tick(1 / 60); } }, // with no forced input, the real devices are read
  };
  return true;
}
