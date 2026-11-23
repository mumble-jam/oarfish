// The cast, as components. Everything about how a creature LOOKS is here and nowhere else: its palette, the model
// that palette is poured into (critters.js), how its body moves, what hangs off it (a lure, a line, a glow), and the
// states it can be shown in. The game asks for a creature with make(id) and moves it about; the specimen library
// (library.js) asks with the same call and puts it on a turntable. Change a component and both change.
//
// A palette can also be changed from the library without touching this file: those changes are kept in the browser
// and laid over the defaults below, in the library and in the game alike, until they are reset or written in here.

import * as THREE from 'three';
import { alive } from './kit.js';
import { glowTexture, lerp } from './geo.js';
import * as model from './critters.js';
import { crabRig } from './crab.js';
import { sawfishRig } from './sawfish.js';
import { squidRig } from './squid.js';
import { jellyRig } from './jelly.js';
import { PALETTE as FISH } from './oarfish.js';

export const DISTRICT = ['#f9cdd6', '#f4a4b9', '#ec7090', '#d83c5f', '#c9a877']; // each band's colour, shallowest first
export const BANDS = ['The sunlight zone', 'The edge of light', 'The twilight zone', 'Deep twilight', 'Ryūgū'];

let GLOW = null;
const glowMap = () => (GLOW ||= glowTexture());
const sprite = (a, color, size) => { const m = new THREE.SpriteMaterial({ map: glowMap(), color, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true }); a.owned.push(m); const s = new THREE.Sprite(m); s.scale.setScalar(size); return s; };
const BULB = new THREE.IcosahedronGeometry(0.1, 0), LINE = new THREE.CylinderGeometry(0.014, 0.014, 1, 4).translate(0, 0.5, 0), BAIT = new THREE.OctahedronGeometry(0.07, 0);
const GUARD = { flatShading: true, emissive: '#ffffff', emissiveIntensity: 0.1 }; // the keepers of the rifts carry a little light of their own, so they read in the dark
const SCHOOL = { tone1: '#f3f7fa', tone2: '#ffd96b', tone3: '#9fe0ea', tone4: '#ffb38a' }; // the tints a swarm may take, one to a swarm
// where one fish of a swarm is at time t. f: its own numbers (ph, rho, h, sp, half); sc: its swarm (x, y, z, ball, pack, threat, burst).
// A swarm with a temper (world.js, TEMPER) may also say how it lies when loose: `slack` wider or closer, `tall` stretched up or pressed flat,
// `gap` and its line (ax, az) for two lobes; and `swell`, a size it is easing out of.
function place(out, f, sc, t) {
  const loose = 1 - sc.threat, R = sc.ball * lerp(2.6 * (sc.slack ?? 1), sc.pack, sc.threat) * (1 + 2.2 * sc.burst) * (sc.swell ?? 1) * f.rho, a = f.ph + t * 0.55 * f.sp * (1 + 1.4 * sc.threat);
  out.set(sc.x + Math.sin(a) * R, sc.y + f.h * R * 0.6 * (1 + (sc.tall || 0) * loose) + Math.sin(a * 1.7 + f.ph) * 0.12, sc.z + Math.cos(a) * R * 0.9);
  if (sc.gap) { const g = f.half ? sc.gap : -sc.gap; out.x += sc.ax * g; out.z += sc.az * g; }
  return out;
}
// The tempers a swarm may have (world.js gives them out, a letter to a swarm in each band's `kinds`, and runs them). The numbers that shape the loose
// swarm are here because the library shows them too: `slack` wider or closer than the plain sort, `tall` stretched up or pressed flat, `lobes` two of them.
export const TEMPER = {
  bolt: { rise: 2.6, top: 6.5, over: 1.2, sink: 0.7, hang: 1.4, tall: 2.6, slack: 0.45 },
  twin: { at: 0.5, part: 2.2, mend: 5, lobes: 1.7, slack: 0.42 },
  glow: { fear: 9, run: 4.4, pool: 3.4, hold: 4.6, seek: 16, pull: 0.9, home: 0.05, far: 40, slack: 1.45, flat: -0.6 },
};
const swarmStates = [{ id: 'calm', name: 'Loose', threat: 0, pack: 1 }, { id: 'ball', name: 'Balled up', threat: 1, pack: 1 }, { id: 'pressed', name: 'Pressed', threat: 1, pack: 0.84 }, { id: 'burst', name: 'Scattering', threat: 0.4, pack: 1, burst: 0.8 },
  { id: 'column', name: 'One that bolts', threat: 0, pack: 1, slack: TEMPER.bolt.slack, tall: TEMPER.bolt.tall }, { id: 'lobes', name: 'One that parts', threat: 0, pack: 1, slack: TEMPER.twin.slack, lobes: TEMPER.twin.lobes },
  { id: 'sheet', name: 'In the dark', threat: 0, pack: 1, slack: TEMPER.glow.slack, tall: TEMPER.glow.flat }];
const swarmOf = (kind) => ({ group: 'Swarms', role: 'Food. A swarm is taken whole, by a body long enough to go round it.', swarm: true, length: 0.43, swim: { amp: 0.022, waves: 2.6, nose: 0.16, length: 0.43 }, beat: [11, 0], build: (pal) => model.swarmFish(kind, pal), states: swarmStates, place });

export const NPCS = [
  { id: 'sprat', name: 'Sprat', bands: [0, 1], about: 'The small silver fish of the two bands that have light. A yellow line down the flank; the back takes a cool shadow so a swarm reads from above.', ...swarmOf(0),
    palette: { back: '#a2bcd4', stripe: '#fff0b4', ...SCHOOL } },
  { id: 'lanternfish', name: 'Lanternfish', bands: [2, 3], about: 'Blunt-headed, big-eyed, with a row of lights along the belly. In the dark the swarm is found by those lights.', ...swarmOf(1),
    palette: { back: '#a2bcd4', lights: '#c9f6ff', ...SCHOOL } },
  { id: 'ghostfish', name: 'Ghost fish', bands: [4], about: 'What swims in the palace: pale, with one lit line down each side.', ...swarmOf(2),
    palette: { back: '#a2bcd4', line: '#fff3d0', ...SCHOOL } },

  { id: 'pilot', group: 'Company', name: 'Pilot fish', bands: [0, 1, 2, 3, 4], length: 0.5, role: 'Not food, and no danger. A few wait along the way in every band; they fall in beside the body as it passes and ride there, keeping up with a swim but not with a sprint.',
    about: 'Blue, with dark bars and white tips to the tail, as the real ones are that go about beside sharks. The tips are lit, so in the dark it is two small lights at your side.',
    palette: { back: '#274a7a', flank: '#a9cbe6', bar: '#1f3050', belly: '#f2f8fc', fin: '#35598a', tip: '#ffffff' },
    build: (pal) => model.pilot(pal), swim: { amp: 0.022, waves: 2.4, nose: 0.2, length: 0.5 }, beat: [5, 2.4],
    states: [{ id: 'wait', name: 'Waiting', speed: 0.7 }, { id: 'ride', name: 'Riding the wake', speed: 3.3 }] },
  { id: 'cleaner', group: 'Company', name: 'Cleaner wrasse', bands: [1, 2, 3, 4], length: 0.24, role: 'Not food, and no danger. Half a dozen keep each cleaning station, a coral head with a pale ring over it. Hold still over one and they go along the body; when they are done a segment has grown back. Nothing bites at a station while they work, but the hunters gather round to wait.',
    about: 'A finger long, pale blue going to yellow at the head, with one black stripe from the eye to the tail that widens as it goes, as the real ones have. The pale back is lit a little, so in the dark a station is a small knot of lights over a coral head.',
    palette: { front: '#ffe27a', rear: '#bfe6ff', stripe: '#1b1b2a', belly: '#f6fbff', fin: '#8fc4ee', tip: '#ffffff' },
    build: (pal) => model.cleaner(pal), swim: { amp: 0.014, waves: 2.6, nose: 0.2, length: 0.24 }, beat: [8, 3],
    states: [{ id: 'wait', name: 'Over the station', speed: 0.5 }, { id: 'work', name: 'Cleaning', speed: 1.6 }] },

  { id: 'biter', group: 'Hunters', name: 'Tail-biter', bands: [1, 2, 3, 4], length: 0.9, role: 'Goes for the back half of the body. A dash head-first breaks it.',
    about: 'Deep-chested, with an underbite and a tall fin. It lives in the shearing stalls, and on the Sum as cleaner fish live on a whale.',
    palette: { back: '#3f2550', flank: '#6d4180', bar: '#583369', belly: '#a981b3', fins: '#e2566b', finDark: '#b8364f', jaw: '#2d1a3a', eye: '#eaff7c' },
    build: (pal) => model.biter(pal), swim: { amp: 0.055, waves: 2.4, nose: 0.44, length: 0.9 }, beat: [4, 3],
    states: [{ id: 'roam', name: 'Roaming', speed: 1.2 }, { id: 'hunt', name: 'Hunting', speed: 3.8 }, { id: 'stun', name: 'Stunned', speed: 0, wobble: true }] },
  { id: 'angler', group: 'Hunters', name: 'Angler', bands: [2, 3, 4], length: 1.6, role: 'Hangs behind one warm light and lunges at what comes to it. It swallows a bait whole.',
    about: 'A globe of a fish, all mouth, with a rod over its head. It sits on the old lamp plinths, where the lamps used to be.',
    palette: { back: '#221d36', skin: '#322d4b', wart: '#2a2540', belly: '#4d4770', gum: '#2a0f20', fins: '#474066', finTip: '#6a6190', eye: '#c8ecff', lure: '#ffd27a', glow: '#ffc56a' },
    build: (pal) => model.angler(pal), swim: { amp: 0.07, waves: 1.5, nose: 0.6, length: 1.6 }, beat: [1.6, 4.4],
    assemble(a, pal) { const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: pal.lure }), bulb = new THREE.Mesh(BULB, m), glow = sprite(a, pal.glow, 1.7); a.owned.push(m); bulb.position.set(...model.ANGLER_ROD); glow.position.copy(bulb.position); g.add(a.body, bulb, glow); a.object = g; a.parts = { bulb, glow }; },
    states: [{ id: 'lurk', name: 'Lurking', speed: 0, lure: 1.7 }, { id: 'lunge', name: 'Lunging', speed: 1, lure: 2.6 }, { id: 'stun', name: 'Dazzled', speed: 0, lure: 0.3, wobble: true }] },
  { id: 'drifter', group: 'Hunters', name: 'Spined drifter', bands: [1, 2, 3, 4], length: 1.3, role: 'Hunts nothing. Costs a segment to brush against; head first, a dash breaks it.',
    about: 'An urchin adrift: plates in five bands, and spines lit at the tip so it can be seen coming.',
    palette: { test: '#4a2f63', band: '#6a4585', spine: '#c2577e', tip: '#ff9db8' },
    build: (pal) => model.drifter(pal), swim: null, beat: [0, 0], spin: [0.25, 0.4, 0],
    states: [{ id: 'drift', name: 'Drifting', speed: 0 }] },
  { id: 'leech', group: 'Hunters', name: 'Leech', bands: [2, 3, 4], length: 1.0, role: 'Fastens on the body and eats what you have eaten. A dash throws it off; a tight coil crushes it.',
    about: 'A lamprey: an eel of a body with a ring of teeth at one end and a row of gill pores behind the eye.',
    palette: { back: '#2b2038', flank: '#4a3560', belly: '#8d7aa0', fin: '#ff9db8', eye: '#eaff7c' },
    build: (pal) => model.leech(pal), swim: { amp: 0.06, waves: 4.6, nose: 0.5, length: 1.0 }, beat: [5, 3],
    states: [{ id: 'roam', name: 'Searching', speed: 1 }, { id: 'fed', name: 'Fastened on', speed: 0, rate: 0.6 }] },
  { id: 'hook', group: 'Hunters', name: 'Hook', bands: [0, 1, 2, 3], length: 0.8, role: 'Hangs on a line from above and strikes at a body under it.',
    about: 'Steel, a lead, and the tally tag of whoever set it. The lines come down from the raft, far overhead.',
    palette: { steel: '#d5dee2', shade: '#93a4ad', lead: '#9aa6ad', tag: '#e2566b', bait: '#ffe89a', glow: '#fff1b8', line: '#e8f6f6' },
    build: (pal) => model.hook(pal), swim: null, beat: [0, 0],
    // the line is tied to the eye at the top of the shank, which is 0.2 to one side of the bend: the lead is threaded on the line and the tag hangs off it
    assemble(a, pal) { const g = new THREE.Group(), lm = new THREE.MeshBasicMaterial({ color: pal.line, transparent: true, opacity: 0.5 }), bm = new THREE.MeshBasicMaterial({ color: pal.bait }), line = new THREE.Mesh(LINE, lm), bait = new THREE.Mesh(BAIT, bm); a.owned.push(lm, bm);
      line.position.set(0.2, 0.8, 0); line.scale.y = 70; bait.position.set(-0.05, 0.02, 0); g.add(a.body, line, bait, sprite(a, pal.glow, 0.8)); a.object = g; a.parts = { line, bait }; },
    states: [{ id: 'idle', name: 'Hanging', speed: 0, sway: true }] },

  { id: 'keeper', group: 'Keepers of the rifts', name: 'The Keeper', bands: [0], length: 6, role: 'Its shell turns a ram, and every blow it means to land is shown first. When it has struck and missed it is open: ram a leg then, and ram it again or go round it, and the leg comes off. Four legs, and it is done. With two gone it is quicker, and digs.',
    about: 'A great crab under a dome of plates, its right claw far bigger than its left. It keeps the first rift.',
    paintOf: 0, palette: { tone: DISTRICT[0], pale: '#e9dfc0', dark: '#3b2a4d', deep: '#2a1d38', eye: '#eaff7c' },
    build: (pal) => model.keeper(pal), swim: null, beat: [0, 0], material: GUARD,
    assemble(a, pal) { crabRig(a, pal); }, // the shell is the model; its legs and claws are hung on it, and walk (crab.js)
    states: [{ id: 'idle', name: 'Waiting', speed: 0 }, { id: 'walk', name: 'Walking', speed: 1.5 }, { id: 'wary', name: 'Claws up', speed: 0 }, { id: 'snap', name: 'The great claw comes down, and sticks', speed: 0 }, { id: 'sweep', name: 'The great claw goes across', speed: 0 }, { id: 'jab', name: 'A jab of the small claw', speed: 0 }, { id: 'tuck', name: 'Drawn in, about to run', speed: 0 }, { id: 'charge', name: 'Running, sideways', speed: 6 }, { id: 'dig', name: 'Digging in', speed: 0 }, { id: 'feed', name: 'Feeding on a shed tail', speed: 0 }, { id: 'stun', name: 'Hurt', speed: 0 }, { id: 'lame', name: 'Two legs gone', speed: 0 }, { id: 'down', name: 'Beaten', speed: 0 }] },
  { id: 'shearer', group: 'Keepers of the rifts', name: 'The Shearer', bands: [1], length: 7, role: 'It feels the water you move: its line follows a moving tail and slides off a still one. Where its saw crosses your body, what is behind the cut is gone. The saw turns a ram from ahead; from the side, when it is spent or stuck, a ram takes a row of its teeth, and a body drawn round it snaps the saw. Four rows, and it is done.',
    about: 'A sawfish, the saw toothed in the district’s colour. The saw is how it finds you and what it hits you with. It keeps the second rift.',
    paintOf: 1, palette: { tone: DISTRICT[1], back: '#3b2a4d', flank: '#55406b', belly: '#d9cfe0', saw: '#e9dfc0', eye: '#eaff7c' },
    build: (pal, wear) => model.shearer(pal, wear), swim: { amp: 0.2, waves: 2.2, nose: model.SHEARER.nose, length: model.SHEARER.length }, beat: [2.2, 0.7], material: GUARD,
    assemble(a, pal) { sawfishRig(a, pal); }, // one model, which bends: the head and saw on a neck, the body along its turn (sawfish.js)
    states: [{ id: 'idle', name: 'Searching', speed: 1.5 }, { id: 'sense', name: 'Feeling for you', speed: 0.5 }, { id: 'aim', name: 'Winding up', speed: 0 }, { id: 'charge', name: 'Slashing', speed: 6 },
      { id: 'pin', name: 'Pinning', speed: 0 }, { id: 'tired', name: 'Spent', speed: 0.3 }, { id: 'stuck', name: 'Saw stuck in the bed', speed: 0 }, { id: 'jammed', name: 'Saw stuck in a column', speed: 0 }, { id: 'swipe', name: 'Swiping, at what is by its head', speed: 0 }, { id: 'stun', name: 'Hurt', speed: 0 }, { id: 'gapped', name: 'Two rows of teeth gone', speed: 0.3 }, { id: 'snapped', name: 'The saw snapped', speed: 0.3 }, { id: 'down', name: 'Beaten', speed: 0 }] },
  { id: 'lamplighter', group: 'Keepers of the rifts', name: 'The Lamplighter', bands: [2], length: 3.5, role: 'Hangs over the rift and lunges. It takes a bait first. Ram or wrap it while its lamp is out.',
    about: 'The angler grown huge, its fins in the district’s colour. It keeps the third rift.',
    paintOf: 2, palette: { tone: DISTRICT[2], back: '#221d36', skin: '#322d4b', wart: '#2a2540', belly: '#4d4770', gum: '#2a0f20', eye: '#c8ecff', lure: '#ffd27a' },
    build: (pal) => model.lamplighter(pal), swim: { amp: 0.16, waves: 1.5, nose: 1.3, length: 3.5 }, beat: [2.2, 0.7], material: GUARD,
    assemble(a, pal) { const g = new THREE.Group(), lure = sprite(a, pal.lure, 3); lure.position.set(0, model.ANGLER_ROD[1] * model.LAMP_SCALE, model.ANGLER_ROD[2] * model.LAMP_SCALE); lure.visible = false; g.add(a.body, lure); a.object = g; a.parts = { glow: lure }; },
    states: [{ id: 'hang', name: 'Hanging', speed: 0, lure: 3 }, { id: 'windup', name: 'Winding up', speed: 0.5, lure: 5 }, { id: 'dim', name: 'Lamp out', speed: 0, lure: 0.4 }] },
  { id: 'warden', group: 'Keepers of the rifts', name: 'The Warden', bands: [3], length: 11, role: 'An eel circling the mouth of the rift, which tightens on a fish inside its ring. Ram its head, or bait the head out and wrap it.',
    about: 'A moray’s head on eleven lengths of body, banded in the district’s colour. It keeps the fourth rift.',
    paintOf: 3, palette: { tone: DISTRICT[3], pale: '#e9dfc0', gum: '#3a1626', eye: '#eaff7c' },
    build: (pal) => model.wardenHead(pal), swim: null, beat: [0, 0], material: GUARD,
    // the body is the game's to lay out: one mesh to a length, widest behind the head
    assemble(a, pal) { a.segments = (n = 11) => Array.from({ length: n }, (_, i) => { const m = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, color: i % 3 ? pal.tone : pal.pale, ...GUARD }); a.owned.push(m); const s = new THREE.Mesh(shared('warden:length', () => model.eelSegment()), m); s.scale.set(0.75 - i * 0.03, 1.3 - i * 0.06, 0.95); return s; }); },
    states: [{ id: 'circle', name: 'Circling', speed: 0 }] },

  { id: 'sum', group: 'The Sum', name: 'The Sum', bands: [4], length: 0.72, role: 'Everything the Long Ones ever paid, joined into one body. It is the wall of the palace hall, and it hunts by closing a loop.',
    about: 'One length of it: a paid tail, pinched and dark where it was joined to the next, still carrying its piece of the dorsal fin. Each takes the colour of the district it was paid in.',
    palette: { own: '#e3c28a' }, build: () => model.sumSegment(), swim: null, beat: [0, 0], run: true,
    // the material its lengths share: each glows a little in its own colour
    flank() { const m = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.86, metalness: 0, flatShading: true, emissive: '#ffffff', emissiveIntensity: 0.16 });
      m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR\n  totalEmissiveRadiance *= vColor.rgb;\n#endif'); }; return m; },
    states: [{ id: 'wall', name: 'As the wall', speed: 0 }] },
];
// the player's own animal is a component like the rest: its palette is the one oarfish.js is built from
NPCS.unshift({ id: 'oarfish', group: 'The oarfish', kind: 'fish', name: 'The oarfish', bands: [0, 1, 2, 3, 4], length: 4.9, role: 'You. Length is health: every segment is a bite you can take, and a longer body goes round a bigger swarm. At each length that opens a bigger kind of swarm the crest stands taller and the fins glow deeper.',
  about: 'Le Gymnètre épée, as the plate has it: a ribbon of a fish with a red crest and a fin the length of its back. It is rebuilt at every change of length, so the same model serves a short body and a long one.',
  palette: Object.fromEntries(Object.entries(FISH).map(([k, v]) => [k[0].toLowerCase() + k.slice(1), v])), fishKey: (k) => k[0].toUpperCase() + k.slice(1), swim: null, beat: [0, 0], fixed: true,
  states: [{ id: 'short', name: 'At its shortest', segs: 4 }, { id: 'start', name: 'As a dive begins', segs: 10 }, { id: 'second', name: 'Long enough for a middling swarm', segs: 14 }, { id: 'third', name: 'Long enough for a big one', segs: 19 }, { id: 'long', name: 'At its longest', segs: 26 }] });
NPCS.push({ id: 'tailpiece', group: 'Loose things', kind: 'thing', name: 'A shed tail', bands: [0, 1, 2, 3, 4], length: 0.65, fixed: true, paletteFrom: 'oarfish', role: 'Three segments, dropped as bait or bitten off. Hunters go to it; a shell that rode on it gives the bait its other power.',
  about: 'A length of the oarfish’s own tail, loose in the water, the cut end showing. It has no colours of its own: it is the oarfish’s, so change those and this follows.',
  palette: {}, build: (pal) => model.tailPiece(pal), baked: true, swim: null, beat: [0, 0], material: {}, show: { scale: 1.6, n: 1, lift: 1.2, spin: true }, states: [{ id: 'still', name: 'Adrift' }] });
// What is being made and is not in the dive: nothing spawns it, nothing in the game asks for it, and it has no band (so nothing that goes by band can place it).
// It is here so that it can be looked at on the stand, in every light, as the oarfish was before there was a game round it.
NPCS.push({ id: 'squid', group: 'Not yet in the dive', name: 'Squid', bands: [], length: model.SQUID.length, role: 'Nothing yet. It is a model to look at: no dive has one, and nothing has been decided about what it does.',
  about: 'A big-finned squid, a metre of mantle and as much again of arms. The fins run down the whole mantle, so the back of it is an arrowhead. Eight arms and two long tentacles with clubs, each a piece of its own that trails through the water by itself, as the oarfish’s oars do.',
  palette: { back: '#f79fbd', flank: '#ee7fa8', belly: '#fbd3e2', fin: '#f48db3', finUnder: '#dcb0e4', fleck: '#ffe6ef', arm: '#ea6f9b', armUnder: '#f9cfe0', sucker: '#fff4f6', eye: '#fff3f1', pupil: '#221a2e', pale: '#fff1ee' },
  build: (pal) => model.squid(pal), swim: null, beat: [0, 0], material: { flatShading: true, emissive: '#ffffff', emissiveIntensity: 0.06 },
  assemble(a, pal) { squidRig(a, pal); }, // the mantle and head are the model; its ten arms are hung on it, and trail (squid.js, strands.js)
  states: [{ id: 'hover', name: 'Hovering', speed: 0 }, { id: 'jet', name: 'Jetting', speed: 2.6 }, { id: 'turn', name: 'Turning', speed: 1.1 }, { id: 'alarm', name: 'Alarmed', speed: 0 }, { id: 'reach', name: 'Reaching', speed: 0 }] });
// Four jellyfish, made the same way and for the same reason: to be looked at first. Each is a bell part clear over what is inside it, with every arm and tentacle
// a piece of its own (jelly.js, strands.js). The pause menu's testing tools can put any of them in the water beside the fish; nothing else ever does.
const JELLY = { group: 'Not yet in the dive', bands: [], swim: null, beat: [0, 0], material: { flatShading: true, emissive: '#ffffff', emissiveIntensity: 0.07 }, role: 'Nothing yet. It is a model to look at: no dive has one, and nothing has been decided about what it does.' };
NPCS.push(
  { ...JELLY, id: 'moonjelly', name: 'Moon jelly', length: 0.4, about: 'A clear saucer forty centimetres across with four violet horseshoes showing through it, as the real one has. A fine fringe round the rim and four short ruffled arms under it, each a piece of its own. It beats slowly and evenly and never quite stops. A creature of the bright water, seen in numbers.',
    palette: { bell: '#dff1ff', rim: '#ffffff', gonad: '#9a3fe6', gonadPale: '#e3a6ff', canal: '#a78de8', arm: '#e2ccff', frill: '#fbf4ff', fringe: '#f6f8ff' },
    build: (pal) => model.moon(pal), assemble(a, pal) { jellyRig(a, pal, 'moon'); },
    states: [{ id: 'drift', name: 'Drifting', speed: 0 }, { id: 'pulse', name: 'Pulsing', speed: 0.14 }, { id: 'rest', name: 'Flattened, at rest', speed: 0 }] },
  { ...JELLY, id: 'nettle', name: 'Sea nettle', length: 3, about: 'An amber bell half a metre across, darkest at the rim, and behind it a train: twenty-four fine dark red tentacles, each a piece of its own, round four long pale ruffled arms wound in spirals. It beats hard; the train streams out on the stroke and catches up as the bell fills. Fishing, it lets the tentacles hang wide like a net.',
    palette: { bell: '#f2a53f', rim: '#b24c2a', ray: '#ffe0a0', lappet: '#8a3524', gut: '#ffe9cf', gutDark: '#f3c79d', arm: '#fff3e6', frill: '#f7c3ae', tentacle: '#8c2437', tentacleTip: '#cf5f6f' },
    build: (pal) => model.nettle(pal), assemble(a, pal) { jellyRig(a, pal, 'nettle'); },
    states: [{ id: 'drift', name: 'Drifting', speed: 0, lift: 1.15 }, { id: 'pulse', name: 'Pulsing', speed: 0.3 }, { id: 'turn', name: 'Turning', speed: 0.3 }, { id: 'fish', name: 'Fishing, tentacles spread', speed: 0, lift: 1.0 }] },
  { ...JELLY, id: 'helmetjelly', name: 'Helmet jelly', length: 0.9, about: 'Taller than it is wide and coming to a point: a dark red cone inside a dome as clear as glass, a groove round it, and under the groove a crown of sixteen lappets. Twelve thick stiff tentacles, which it carries up and ahead of itself. Touched, a blue-green light runs round the crown. An animal of the dark water: daylight harms the real one.',
    palette: { glass: '#ffd9e2', core: '#4a0818', coreLit: '#6b1024', crown: '#8a1629', crownDark: '#620f20', lappet: '#b8303f', mouth: '#2c0610', tentacle: '#9a1f30', tentacleTip: '#ee7f6c', light: '#74ffe4' },
    build: (pal) => model.helmet(pal), assemble(a, pal) { jellyRig(a, pal, 'helmet', { halo: sprite(a, pal.light, 1) }); }, material: { ...JELLY.material, emissive: '#ff5a66', emissiveIntensity: 0.13 }, // it carries a little red light of its own: red is the first colour the deep takes away
    states: [{ id: 'drift', name: 'Drifting', speed: 0 }, { id: 'pulse', name: 'Pulsing', speed: 0.1 }, { id: 'lit', name: 'Touched: lit', speed: 0 }, { id: 'reach', name: 'Tentacles turned down', speed: 0 }] },
  { ...JELLY, id: 'boxjelly', name: 'Box jelly', length: 1.5, about: 'A clear bell that is square from above, a pale rib down each corner and a dark eye low on each side. At each corner a stalk like a hand, with a long ringed ribbon of a tentacle from every finger (five here; the real sea wasp has up to fifteen). Unlike the others it goes somewhere: quick strokes, the tentacles drawn up short behind it. To fish it lets them out, tips over and sinks.',
    palette: { bell: '#bfe3ff', rib: '#f4fbff', gut: '#ffc4d8', gonad: '#e9d6ff', eye: '#1b1730', pedal: '#e6f4ff', tentacle: '#cfe0ff', band: '#6f8fe8' },
    build: (pal) => model.box(pal), assemble(a, pal) { jellyRig(a, pal, 'box'); }, material: { ...JELLY.material, emissive: '#bfe2ff', emissiveIntensity: 0.2 }, // the real one is all but invisible; this one has to be seen
    states: [{ id: 'drift', name: 'Drifting', speed: 0, lift: 0.45 }, { id: 'pulse', name: 'Pulsing', speed: 0.9 }, { id: 'turn', name: 'Turning sharply', speed: 0.7 }, { id: 'fish', name: 'Fishing: tipped over, sinking', speed: 0, lift: -0.55 }] });
// the two sets of colours everything built of stone is made from. They are not things: they are what things are tinted with
NPCS.push(
  { id: 'paint', group: 'Colours of the world', kind: 'tokens', name: 'District paint', bands: [0, 1, 2, 3, 4], length: 6, fixed: true, role: 'One colour to a band. It is on the top slab of every column, the caps of the well curbs, the seal over a guarded well, and the lengths of the Sum paid in that band.',
    about: 'The fin’s own reds, paler above and deeper below; the last is the body’s gold. The keepers of the rifts take their band’s colour too, unless given one of their own.',
    palette: Object.fromEntries(DISTRICT.map((c, i) => [`band${i + 1}`, c])), swim: null, beat: [0, 0], states: [{ id: 'row', name: 'The five bands' }] },
  { id: 'stone', group: 'Colours of the world', kind: 'tokens', name: 'Stone', bands: [0, 1, 2, 3, 4], length: 6, fixed: true, role: 'The stone of each band’s ruins. Each block takes this colour or one of a few near it.',
    about: 'Stone weathers from the top down: the shallow ruins are the oldest and greenest, the deepest are clean.',
    palette: { band1: '#c3cfae', band2: '#d2d8c2', band3: '#dde0cf', band4: '#e2e3d8', band5: '#e8e8e0' }, swim: null, beat: [0, 0], states: [{ id: 'row', name: 'The five bands' }] });
export const NPC = Object.fromEntries(NPCS.map((s) => [s.id, s]));
// The library lists its groups in this order. Other files add their own things to it with register().
export const GROUPS = ['The oarfish', 'Swarms', 'Company', 'Hunters', 'Keepers of the rifts', 'The Sum', 'Not yet in the dive', 'Shells', 'Loose things', 'Things that grow', 'On the bed', 'Stonework', 'Colours of the world'];
export function register(spec) { const full = { bands: [0, 1, 2, 3, 4], swim: null, beat: [0, 0], palette: {}, states: [{ id: 'still', name: 'As it stands' }], kind: 'thing', fixed: true, ...spec }; NPCS.push(full); NPC[full.id] = full; return full; }
export const inOrder = () => [...NPCS].sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group));
export const swarmFor = (band) => ['sprat', 'sprat', 'lanternfish', 'lanternfish', 'ghostfish'][band] || 'sprat';

// ---------------------------------------------------------------- changes made in the library, kept in this browser
const HEX = /^#[0-9a-f]{6}$/i;
let saved = null;
const load = () => { if (!saved) { try { saved = JSON.parse(localStorage.getItem('oarfish.npc')) || {}; } catch { saved = {}; } } return saved; };
const keep = () => { try { localStorage.setItem('oarfish.npc', JSON.stringify(saved)); } catch { /* storage is off: the changes last as long as the page */ } };
export const tweaks = {
  of: (id) => load()[id] || null,
  changed: () => Object.keys(load()).filter((id) => NPC[id]),
  set(id, key, value) {
    const t = load(), o = (t[id] ||= { palette: {} }); o.palette ||= {};
    if (key === 'scale') { if (Math.abs(value - 1) < 0.005) delete o.scale; else o.scale = +value.toFixed(2); }
    else if (!HEX.test(value) || value.toLowerCase() === NPC[id].palette[key].toLowerCase()) delete o.palette[key]; else o.palette[key] = value.toLowerCase();
    if (!Object.keys(o.palette).length && o.scale === undefined) delete t[id];
    keep();
  },
  reset(id) { if (id) delete load()[id]; else saved = {}; keep(); },
  // the changes as a few lines to paste to whoever keeps the code, so they can be written in for everyone
  text() { const ids = tweaks.changed(); return ids.length ? `Oarfish NPC changes, to write into npc.js:\n${ids.map((id) => { const o = load()[id]; return `${id}: ${[...Object.entries(o.palette || {}).map(([k, v]) => `${k} ${v}`), ...(o.scale !== undefined ? [`scale ${o.scale}`] : [])].join(', ')}`; }).join('\n')}` : ''; },
};
// a component as it stands now: its defaults with this browser's changes over them
export function resolve(id, forced = null) {
  const spec = NPC[id], t = load()[id] || {}, palette = { ...spec.palette };
  if (spec.paintOf !== undefined && id !== 'paint') palette.tone = paintOf(spec.paintOf); // a keeper wears its band's colour, unless it has been given one of its own
  for (const [k, v] of Object.entries({ ...(t.palette || {}), ...(forced?.palette || {}) })) if (k in palette && HEX.test(v)) palette[k] = v;
  return { palette, scale: forced?.scale ?? t.scale ?? 1 };
}

// the tints a component hands to whoever scatters it: its palette's tone1, tone2…
export const tonesOf = (id) => { const p = resolve(id).palette; return Object.keys(p).filter((k) => /^tone\d+$/.test(k)).map((k) => p[k]); };
// the paint of a band, and its stone: the stone as a few near colours, moved with the one that can be chosen
export const paintOf = (band) => resolve('paint').palette[`band${band + 1}`];
const STONES = [['#c3cfae', '#b3c6a2', '#a5bd9a', '#bcc9b0'], ['#d2d8c2', '#c4cdb8', '#b9c6b0', '#cdd2bf'], ['#dde0cf', '#cdd2bf', '#c8cfc4', '#d6d9cc'], ['#e2e3d8', '#d8dbd0', '#dedfd6'], ['#e8e8e0', '#e0e1da']];
export function stoneOf(band) {
  const to = new THREE.Color(resolve('stone').palette[`band${band + 1}`]), from = new THREE.Color(STONES[band][0]), d = [to.r - from.r, to.g - from.g, to.b - from.b];
  return STONES[band].map((c) => { const k = new THREE.Color(c); return `#${k.setRGB(Math.min(1, Math.max(0, k.r + d[0])), Math.min(1, Math.max(0, k.g + d[1])), Math.min(1, Math.max(0, k.b + d[2]))).getHexString()}`; });
}

// ---------------------------------------------------------------- building
const cache = new Map();
const shared = (key, build) => { if (!cache.has(key)) cache.set(key, build()); return cache.get(key); };
// the model of a component as it stands now. Shared by every creature of the kind, and never thrown away
export const geometry = (id) => { const look = resolve(NPC[id].paletteFrom || id); return shared(`${id}|${JSON.stringify(look.palette)}`, () => NPC[id].build(look.palette)); };

// One creature. Returns { object (put this in the scene), body (the mesh that swims), parts, look, tick(dt, speed), dispose() }.
// preview: a look to show in place of the saved one, for trying a change before keeping it; its model is the creature's own.
export function make(id, { preview = null } = {}) {
  const spec = NPC[id], look = resolve(id, preview), own = !!preview;
  const material = alive(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, ...(spec.material || {}) }), { swim: spec.swim });
  const body = new THREE.Mesh(own ? spec.build(look.palette) : geometry(id), material);
  body.castShadow = true; body.rotation.order = 'YXZ';
  const a = { id, spec, look, body, object: body, parts: {}, owned: [material],
    // advance its tail-beat: speed is how fast it is swimming, in metres a second
    tick(dt, speed = 0) { material.userData.swim.value += dt * (spec.beat[0] + spec.beat[1] * speed); },
    dispose() { for (const o of a.owned) o.dispose(); if (own) body.geometry.dispose(); } };
  spec.assemble?.(a, look.palette);
  a.object.scale.multiplyScalar(look.scale);
  return a;
}
// A swarm's fish are drawn all at once, so a swarm component hands over the pieces instead: the model, a material (glow:
// how much light the fish give off at this depth), the tints, how fast the tails beat, and where each fish goes.
export function swarmKit(id, { glow = 0, preview = null } = {}) {
  const spec = NPC[id], look = resolve(id, preview), own = !!preview;
  const material = alive(new THREE.MeshLambertMaterial({ color: '#ffffff', vertexColors: true, side: THREE.DoubleSide, emissive: '#9fe8ff', emissiveIntensity: glow * 0.8 }), { glow: 1, swim: spec.swim });
  const geo = own ? spec.build(look.palette) : geometry(id);
  return { id, spec, look, geometry: geo, material, tones: [look.palette.tone1, look.palette.tone2, look.palette.tone3, look.palette.tone4], beat: spec.beat[0], place, scale: look.scale, dispose() { material.dispose(); if (own) geo.dispose(); } };
}
