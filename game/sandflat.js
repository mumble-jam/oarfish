// The sand flat: the life of the first band's quiet place behind the start (quiet.js lays it out, world.js builds it, world.quiet.sandflat says
// where everything is). Four creatures, each the real animal first and then ONE true trait turned into the rule it brings, each paying in something
// other than fish (a shell, a record in the nest, a step toward something). Every number is in SANDFLAT, below. How each creature looks and moves is
// its component's (npc.js) and its rig's (gardeneel.js, hermit.js, burrow.js, puffer.js); everything that decides is here.
//
//   GARDEN EELS: the meadow sinks ahead of you. True trait: each eel withdraws into its burrow as something approaches (divers get within 2.1 to
//     2.8 m: Yunger et al. 2025) and comes back up when it is quiet (Oceana; OIST on Ishikawa et al. 2022). A colony fills the cistern rim. How near
//     a body may come before an eel goes down grows with how fast and how jerkily the body moves, so the field is a live picture of how gently the
//     fish swims. The game: cross the meadow (in at one side, out at another) so that none goes fully down. Graded by how many of the eels the body
//     passed near stayed up; the best is kept in the nest. No meter: the eels are the meter.
//   HERMIT CRABS: a shell market. True trait: one empty shell re-houses a whole line of crabs, each moving up a size, and the smallest one's old
//     shell is left over (Tufts Now 2010, on Rotjan's land hermit crabs; Scientific American on Pagurus longicarpus in the sea). A line of four of
//     rising size waits at the foot of one market table, each wearing one of the game's own shells. Lie the body across the table, still, with a
//     shell-carrying segment over it, and that shell slides off onto the sand at the head of the line; the biggest crab takes it, and each moves up
//     into the house the one ahead has left; the shell the smallest left is the player's to take. One shell for another, twice a dive at most, and
//     what will come is in sight beforehand (it glows faintly on the smallest crab while a trade is to be had).
//   GOBY AND PISTOL SHRIMP: the digger works only while the lookout says it is safe. True trait: the nearly blind shrimp keeps a feeler on the goby
//     and digs only while the goby stays calm; a tail flick is the warning; at real danger both go down, the goby head first, and stay down a long
//     while (Landsittel et al. 2021). At each of the two burrows: come in fast and they vanish for a while; come near slowly and the goby flicks;
//     hold still near by and the shrimp goes on bulldozing sand out onto its heap (puffs and a growing heap, since both animals are specks from the
//     dive's camera), and after a while it pushes up something buried: a shell fragment, which the head takes up and carries.
//   THE PUFFER'S CIRCLE, which grows from dive to dive. True trait: a male white-spotted puffer ploughs a circle of ridges about two metres across
//     over seven to nine days, dresses the peaks with shell fragments, and never uses a site twice (Kawase et al. 2013; Wikipedia). On the patch of
//     fine sand: the circle is one stage further along at the start of each dive (kept in the nest); the puffer is there ploughing; a fragment
//     carried in over it is set on a ridge and moves it on; a body swept fast over it flattens it back. Finished, the middle is calm water (the real
//     middle's current is a quarter slower): a head held still there gets its breath back at once, for the rest of that dive, and the nest keeps a
//     small ring of fragments for every circle finished. The dive after, the old circle lies flattening and a new one is begun on fresh sand beside it.
//
// It is made by main.js as the bloom water is, and runs beside it. Everything is kept in the first copy of the band (as the bloom's is) and drawn
// in the copy the fish is in. What it asks of the dive is in `hooks` (main.js).
import * as THREE from 'three';
import { make, geometry } from './npc.js';
import { CIRCLE, GARDEN, HERMIT, shellBit } from './critters.js';
import { SHELLS, shellMaterial } from './shells.js';
import { rng, clamp, lerp, damp, glowTexture } from './geo.js';

// ---------------------------------------------------------------- every number, in one place
export const SANDFLAT = {
  wake: 46,
  pale: [1.11, 1.09, 1.13], // the creatures' own patches of sand are the bed's sand; the flat's is paler (world.js, paleA and paleB): this much paler // how near (m, to the place's middle) the fish has to be for anything here to be worked out; past it, all is still
  // THE EELS. ring: patches of twenty in hex rings `apart` metres apart, kept `keep` inside the rim. The fright: an eel goes all the way down when any
  // part of the body is nearer than `near` metres (3D, from a point `lift` over its hole), and `near` is `calm` m + `per` m for every m/s the body's
  // "noise" is over `quiet` m/s. Noise: the body's speed, plus `jerk` times how hard it speeds up or slows down, and `dash` while it dashes. Between
  // `near` and `near + span` it is part way down. A crossing: the head in over the rim and out again at least `across` (of the rim's radius) from
  // where it came in. An eel was passed near if any part of the body came within `passed` m of it across the sand. Grade: of those, the part that
  // never went all the way down: at least each of `grades` is a step (1, 2, 3); 3 is every one of them up. Fewer than `least` passed near: no grade.
  eels: { apart: 3.3, keep: 2.2, flow: 0.25, pick: 1, lift: 0.3, calm: 0.9, per: 0.7, quiet: 1.6, jerk: 0.12, dash: 13, span: 1.2, passed: 2.5, across: 1.1, least: 12, grades: [0.6, 0.85, 1] },
  // THE MARKET. table: which of the four tables the line waits at (counted from the place's own order). scale: the crabs, times the model's own four
  // sizes. gap: room between two in the line, of their sizes. foot: how far out from the table's edge the head of the line is. The move: a segment that
  // carries a shell over the table (within its size + `reach` across the sand), the body slower than `slow`, for `hold` seconds. trades: in a dive.
  // shy: a body nearer than this (m, plus a little for a bigger crab) and faster than `slow` sends a waiting crab in. The swap, per crab: `probe`
  // seconds feeling the shell, `turn` seconds to turn round, and the shell taken over; then back. glow: the faint light on the smallest crab's shell
  market: { table: 1, scale: 2, gap: 0.27, foot: 0.75, reach: 0.45, slow: 1.4, hold: 1.2, trades: 2, shy: 2.6, probe: 0.9, turn: 0.8, fall: 0.8, glow: 0.55, lift: 0.9 },
  // THE BURROWS. scale: of the model (already four times the real pair). A fright: a dash within `dash` m, or any part of the body nearer than `close`,
  // or nearer than `scare` and faster than `fast` m/s: both go down, and stay down till the body has been gone or still `hide` seconds. Nearer than
  // `wary` and faster than `still`: the goby flicks and the shrimp waits in the mouth. Otherwise the shrimp works, a load every `load` seconds; and while
  // the head is within `near` m, still (slower than `still`), the work counts: `dig` seconds of it and up comes a fragment. `per`: fragments a burrow
  // gives in a dive; `rest`: seconds after one before the next counts. take: how near (across the sand) the head has to come to take a fragment up
  burrow: { scale: 2.4, dash: 9, close: 1.6, scare: 6, fast: 2.6, hide: 10, wary: 5, still: 0.9, near: 9, load: 6, dig: 14, per: 2, rest: 8, take: 1.3, heap: [0.5, 1.4], puff: 0.22 },
  // THE CIRCLE. scale: of the model (2.9 m across) and the fish. stages: how the shader draws it at each whole step (0 the first ring, 3 finished);
  // a dive adds `dive` steps at its start; a fragment set on it `frag`; a body swept over it faster than `careless` (or dashing) takes `flatten`
  // steps a second away, never below `floor`. Set: a fragment carried in, the head over it (within its radius), slower than `careless`. far: how far
  // round the flat's middle (in metres along the arc) the next site is from the last. calm: within this part of the radius, slower than `still`,
  // for `rest` seconds, the breath comes back (the finished circle's gift)
  circle: { scale: 1.3, fish: 1.6, stages: [0.15, 0.4, 0.7, 1], dive: 1, frag: 0.35, careless: 2.4, flatten: 0.3, floor: 0, far: 5.5, calm: 0.5, still: 1.0, rest: 1.2, lap: 9, puff: 1.8 },
  // the nest: a pale disc ahead and to the left of the start, with three eels on it (one up for each grade of the best crossing) and a small ring of
  // fragments for each circle finished (up to three shown)
  nest: { f: 1.9, r: -2.7, rings: 3 },
  words: {
    eels: 'Garden eels sink when something comes at them fast. Cross their meadow slowly and smoothly, and they stay up.',
    market: 'Hermit crabs move house in a line. Lie across their table, still, to set a shell down: the smallest crab’s shell is then yours.',
    burrow: 'The goby keeps watch for its shrimp. Hold still near by and the shrimp goes back to digging.',
    circle: 'A puffer builds this circle over many dives. Shell fragments set on it hurry it on.',
  },
};

const TAU = Math.PI * 2, UP = new THREE.Vector3(0, 1, 0);
// two geometries with position, normal and colour, as one (neither indexed)
function mergeTwo(a, b) { const g = new THREE.BufferGeometry(); for (const k of ['position', 'normal', 'color']) { const x = a.attributes[k].array, y = b.attributes[k].array, z = new Float32Array(x.length + y.length); z.set(x); z.set(y, x.length); g.setAttribute(k, new THREE.BufferAttribute(z, 3)); } return g; }
const ease = (t) => t * t * (3 - 2 * t);
const yawTo = (dx, dz) => Math.atan2(dx, dz);
const turnTo = (a, b, k) => a + clamp(Math.atan2(Math.sin(b - a), Math.cos(b - a)), -k, k);

// ---------------------------------------------------------------- the second site for a circle: the first one turned about the flat's middle,
// `far` metres along the arc, the way that keeps it further from the tables, the burrows and the meadow's rim. Draws no numbers.
export function circleSites(S) {
  const R = Math.hypot(S.puffer.x - S.x, S.puffer.z - S.z), a0 = Math.atan2(S.puffer.x - S.x, S.puffer.z - S.z), da = SANDFLAT.circle.far / (R || 1);
  const at = (a) => ({ x: S.x + Math.sin(a) * R, z: S.z + Math.cos(a) * R });
  const clear = (p) => Math.min(...S.tables.map((t) => Math.hypot(t.x - p.x, t.z - p.z) - t.size), ...S.burrows.map((b) => Math.hypot(b.x - p.x, b.z - p.z)), Math.hypot(S.meadow.x - p.x, S.meadow.z - p.z) - S.meadow.r);
  const A = at(a0 + da), B = at(a0 - da);
  return [{ x: S.puffer.x, z: S.puffer.z }, clear(A) >= clear(B) ? A : B];
}

// world: the band (world.quiet.sandflat is the plan). hooks, from main.js:
//   rig; playing(); shells() (what the body wears: [{ type, seg }]); setDown(seg): that shell off the body, its kind returned; drop(x, z, type): a shell
//   lying to be taken; pool() (the kinds this dive may turn up); say(id, text); gulp(i, n, v); moment(kind); kept() / keep(v): what the nest holds
//   for the sand flat; fresh: is this the dive's first sight of the flat (a new dive: the circle moves on a step); rest(): the breath back; seed
export function createSandflat(scene, world, hooks) {
  const S = world.quiet.sandflat, T = world.size, rig = hooks.rig, ground = (p) => { p.y = world.drawn(p.x, p.z); return p; };
  const root = new THREE.Group(); root.name = 'sandflat'; scene.add(root); // everything here, in the band's first copy; moved to the copy the fish is in
  const owned = [], made = [], own = (o) => { owned.push(o); return o; };
  const mk = (id) => { const a = make(id); made.push(a); root.add(a.object); return a; };
  const pale = (a) => a.body.material.color.setRGB(...SANDFLAT.pale); // a patch of sand brought to the flat's paler sand, so it does not show as a disc
  // what casts a shadow: the sand patches are ground and cast none; the eels, the goby and shrimp and the puffer's fins are too thin or too small for theirs
  // to be seen from the dive's camera, and each is a draw more in the sun's pass; of a hermit crab only its shell and its body cast
  const noShadow = (o, keep = () => false) => o.traverse((x) => { if (x.isMesh && !keep(x)) x.castShadow = false; });
  const glow = own(glowTexture());
  const off = { x: 0, z: 0 }, J = [], head = new THREE.Vector3();
  const r = rng((hooks.seed | 0) * 977 + 71503); // the crabs' shells, and nothing else
  const kept = hooks.kept() || {};
  const state = { t: 0, near: false, eels: { best: kept.eels || null, crossing: null, last: null, crossings: 0 }, market: { trades: 0, busy: null, hold: 0, last: null }, burrows: null, circle: null, carry: null, carried: 0, log: [] };
  const note = (kind, v) => { state.log.push({ kind, t: +state.t.toFixed(2), ...v }); if (state.log.length > 40) state.log.shift(); };
  const save = () => hooks.keep({ eels: state.eels.best, circle: { ...C0 } });
  const sprite = (colour, opacity = 1, add = true) => { const m = own(new THREE.SpriteMaterial({ map: glow, color: colour, transparent: true, opacity, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending })); const s = new THREE.Sprite(m); root.add(s); return s; };

  // ================================================================ the eels
  const E = SANDFLAT.eels, M = S.meadow, flowYaw = Math.atan2(S.fx, S.fz) + 0.6;
  const patches = [];
  { const spots = [[0, 0]]; for (let ring = 1; ring < 4; ring++) for (let k = 0; k < 6; k++) for (let s = 0; s < ring; s++) { const a = (k / 6) * TAU, b = ((k + 1) / 6) * TAU, u = s / ring;
      const x = ring * E.apart * lerp(Math.sin(a), Math.sin(b), u), z = ring * E.apart * lerp(Math.cos(a), Math.cos(b), u); if (Math.hypot(x, z) <= M.r - E.keep) spots.push([x, z]); }
    spots.forEach(([dx, dz], i) => { const a = mk('gardeneel'); pale(a); noShadow(a.object); a.body.visible = false; const turn = i * 2.39996, x = M.x + dx, z = M.z + dz; a.object.position.set(x, world.drawn(x, z) + 0.008, z); a.object.rotation.y = turn; a.object.updateMatrix();
      const k = a.object.scale.x, c = Math.cos(turn), s = Math.sin(turn);
      const eels = a.rig.eels.map((e) => ({ x: x + (e.x * c + e.z * s) * k, z: z + (-e.x * s + e.z * c) * k, down: false, passed: false }));
      patches.push({ a, x, z, turn, eels, want: (j) => eels[j].want ?? 1 }); }); }
  const allEels = patches.flatMap((p) => p.eels);
  // their holes, all in one piece: each colony's own patch of sand is not drawn (thirteen discs of ground laid over the ground were a sixth of the cost of
  // the place, and showed as discs), so the holes are drawn here, a dark mouth in a low pale lip, where every eel is
  { const lip = new THREE.CylinderGeometry(0.11, 0.14, 0.03, 7), mouth = new THREE.CircleGeometry(0.06, 7); mouth.rotateX(-Math.PI / 2); mouth.translate(0, 0.016, 0);
    const holeMat = own(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })), tone = (g, c) => { const col = new THREE.Color(c), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) col.toArray(a, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g.index ? g.toNonIndexed() : g; };
    const parts = [tone(lip, "#d6d2b4"), tone(mouth, "#2c2a22")], geo = own(mergeTwo(parts[0], parts[1])); for (const g of [lip, mouth, ...parts]) g.dispose();
    const holes = new THREE.InstancedMesh(geo, holeMat, allEels.length), m4 = new THREE.Matrix4(); holes.receiveShadow = true; holes.frustumCulled = false; own({ dispose: () => holes.dispose() });
    allEels.forEach((e, i) => holes.setMatrixAt(i, m4.makeTranslation(e.x, world.drawn(e.x, e.z) - 0.004, e.z))); holes.instanceMatrix.needsUpdate = true; root.add(holes); state.holes = holes; }
  const noise = { v: 0, was: rig.speed, jerk: 0 };
  function eelStep(dt, t) {
    const ER = E;
    const near = ER.calm + ER.per * Math.max(0, noise.v - ER.quiet); state.eels.near = near;
    const by = Math.hypot(head.x - M.x, head.z - M.z) < M.r + 8;
    const C = state.eels.crossing;
    for (const e of allEels) {
      let want = 1;
      if (by) { const y0 = world.drawn(e.x, e.z) + ER.lift; let d = Infinity, flat = Infinity; for (const j of J) { const dx = j.x - e.x, dz = j.z - e.z, h = Math.hypot(dx, dz); flat = Math.min(flat, h); d = Math.min(d, Math.hypot(h, j.y - y0)); }
        want = clamp((d - near) / ER.span, 0, 1);
        if (C) { if (flat < ER.passed) e.passed = true; if (want <= 0 && hooks.playing()) e.down = true; } }
      e.want = want;
    }
    for (const p of patches) { const vis = !unseen(p.x, p.z, 4); p.a.object.visible = vis; if (vis || by) p.a.rig.update(dt, { time: t, flow: ER.flow, pick: ER.pick, yaw: flowYaw - p.turn, want: p.want }); }
    // a crossing: the head in over the rim, and out again somewhere else
    const dIn = Math.hypot(head.x - M.x, head.z - M.z);
    if (!C && dIn < M.r && hooks.playing()) { state.eels.crossing = { x: head.x, z: head.z, t: 0 }; for (const e of allEels) { e.passed = false; e.down = false; } }
    else if (C) { C.t += dt;
      if (dIn > M.r + 0.6) { state.eels.crossing = null; const across = Math.hypot(head.x - C.x, head.z - C.z) >= M.r * ER.across;
        const passed = allEels.filter((e) => e.passed), downAll = allEels.filter((e) => e.down).length, up = passed.filter((e) => !e.down).length;
        const ratio = passed.length ? Math.max(0, (passed.length - downAll) / passed.length) : 0;
        let grade = 0; ER.grades.forEach((g, i) => { if (ratio >= g - 1e-9) grade = i + 1; });
        if (ratio < 1) grade = Math.min(grade, ER.grades.length - 1); // the top step is every one of them up
        const result = { across, passed: passed.length, down: downAll, up, ratio: +ratio.toFixed(3), grade: across && passed.length >= ER.least ? grade : 0, time: +C.t.toFixed(1) };
        state.eels.last = result; state.eels.crossings++;
        if (across && passed.length >= ER.least) {
          for (let i = 0; i < result.grade; i++) hooks.gulp(i, 4, 0.35); // a note for each step
          const b = state.eels.best; if (result.grade && (!b || result.grade > b.grade || (result.grade === b.grade && result.ratio > b.ratio))) { state.eels.best = { grade: result.grade, ratio: result.ratio }; result.best = true; save(); nestMark(); }
          if (downAll) hooks.say('eels', SANDFLAT.words.eels);
        }
        note('eels', result);
      } }
  }

  // ================================================================ the market
  const K = SANDFLAT.market, table = S.tables[Math.min(K.table, S.tables.length - 1)];
  const mid = { x: S.x - table.x, z: S.z - table.z }, ml = Math.hypot(mid.x, mid.z) || 1; mid.x /= ml; mid.z /= ml; // from the table toward the flat's middle
  const tan = { x: mid.z, z: -mid.x }; // along the line
  const foot = { x: table.x + mid.x * (table.size + K.foot), z: table.z + mid.z * (table.size + K.foot) }; // where a shell set down lands: the head of the line
  const kinds = []; { const pool = [...(hooks.pool() || Object.keys(SHELLS))]; for (let i = 0; i < HERMIT.sizes.length && pool.length; i++) kinds.push(pool.splice(Math.floor(r() * pool.length), 1)[0]); }
  const lineYaw = yawTo(-tan.x, -tan.z); // each faces up the line, toward the head of it
  const crabs = []; { let d = 0; const sizes = [...HERMIT.sizes].reverse(); // the biggest first, at the head of the line
    sizes.forEach((k0, i) => { const k = k0 * K.scale; if (i) d += K.gap * (k + sizes[i - 1] * K.scale); else d = 0.2 * k;
      const a = mk('hermit'); a.object.scale.multiplyScalar(k); a.rig.wear(kinds[i] || 'snail'); noShadow(a.object, (x) => x === a.body || a.rig.shells.some((sh) => sh.mesh === x));
      const pos = new THREE.Vector3(foot.x + tan.x * d, 0, foot.z + tan.z * d); ground(pos);
      crabs.push({ a, k: a.object.scale.x, i, pos, yaw: lineYaw, want: lineYaw, away: 9, phase: 'wait', t: 0, i0: i }); }); }
  const prize = sprite('#ffffff', 0); prize.scale.setScalar(1.1); // what the smallest wears, lit faintly while a trade is to be had
  const holdGlow = sprite('#ffffff', 0); holdGlow.scale.setScalar(1.4); // over the shell on the body while it is being set down
  const spareOf = (c) => c.a.rig.shells.find((s) => s !== c.a.rig.worn);
  const shellAt = (sh) => ({ x: sh.M.elements[12], z: sh.M.elements[14] });
  let falling = null; const fallMat = own(shellMaterial());
  function marketStep(dt, t) {
    const m = state.market, playing = hooks.playing();
    // the move: a segment carrying a shell, lying over the table, the body slow
    let best = null;
    if (!m.busy && m.trades < K.trades && playing) for (const sh of hooks.shells() || []) { const j = J[Math.min(sh.seg, J.length - 1)]; if (!j) continue; const d = Math.hypot(j.x - table.x, j.z - table.z);
      if (d < table.size + K.reach && (!best || d < best.d)) best = { sh, j, d }; }
    if (best && rig.speed < K.slow) { m.hold += dt; holdGlow.position.set(best.j.x, best.j.y + 0.25, best.j.z); holdGlow.material.color.set(SHELLS[best.sh.type].colour); } else m.hold = Math.max(0, m.hold - dt * 2);
    holdGlow.material.opacity = best ? 0.25 + 0.6 * clamp(m.hold / K.hold, 0, 1) : 0;
    if (best && m.hold >= K.hold) { m.hold = 0; const type = hooks.setDown(best.sh.seg);
      if (type) { m.busy = { step: 0, given: type, at: t }; const mesh = new THREE.Mesh(geometry(`shell-${type}`), fallMat); mesh.scale.setScalar(0.3); root.add(mesh); falling = { mesh, from: best.j.clone(), t: 0, type }; hooks.moment('shed'); } }
    // the shell coming down off the body to the head of the line
    if (falling) { falling.t += dt / K.fall; const e = ease(Math.min(1, falling.t)), to = ground(new THREE.Vector3(foot.x, 0, foot.z));
      falling.mesh.position.lerpVectors(falling.from, to, e); falling.mesh.position.y += Math.sin(Math.PI * e) * 0.6; falling.mesh.rotation.set(e * 3, e * 5, 0); falling.mesh.scale.setScalar(lerp(0.3, 0.5 * crabs[0].k, e));
      if (falling.t >= 1) { root.remove(falling.mesh); const c0 = crabs[0]; c0.a.rig.lay(spareOf(c0), falling.type, foot.x, foot.z, lineYaw + Math.PI, ground, 1.15); falling = null; c0.phase = 'probe'; c0.t = 0; } }
    // each crab
    const busy = m.busy;
    crabs.forEach((c, i) => {
      const R = c.a.rig; c.t += dt; let act = null, aim = null, inn = false, peer = false, look = null;
      const near = J.length ? Math.min(...J.map((j) => Math.hypot(j.x - c.pos.x, j.z - c.pos.z))) : 99, rushing = rig.speed > K.slow || rig.dashT > 0;
      if (c.phase === 'wait') {
        if (near < K.shy + 0.3 * c.k && rushing && !busy) c.away = 0; else c.away += dt;
        inn = c.away < 2.2; peer = inn && c.away > 0.6;
        if (!inn) { if (i === 0) act = near < 6 ? null : 'pick'; else { act = Math.sin(t * 0.3 + i * 2) > -0.3 ? 'hold' : 'pick'; aim = crabs[i - 1].a.object.position.clone().addScaledVector(new THREE.Vector3(tan.x, 0, tan.z), 0.16 * crabs[i - 1].k); } }
        if ((near < 7 || m.hold > 0) && !rushing) { look = head; } // a slow body near by: they come out and watch it
        c.want = lineYaw;
      } else if (c.phase === 'probe') { // feeling the shell ahead
        const sp = spareOf(c), at = shellAt(sp); act = 'probe'; aim = new THREE.Vector3(at.x, world.drawn(at.x, at.z) + 0.03, at.z); c.want = lineYaw;
        if (c.t > K.probe) { c.old = R.leave(ground); c.phase = 'turn'; c.t = 0; c.want = lineYaw + Math.PI; c.handed = false; } }
      else if (c.phase === 'turn') { // out of its own shell, turning to back into the new one
        if (c.t > K.turn * 0.9 && R.worn.mode === 'lying') R.enter(R.worn);
        if (R.worn.mode === 'worn' && c.t > K.turn) { c.phase = 'back'; c.t = 0; c.want = lineYaw; } }
      else if (c.phase === 'back') { if (c.t > K.turn) { c.phase = 'wait'; c.t = 0; c.away = 9; } }
      // the shell it left: once it has slid off and settled, it is the next crab's (or, from the last, the player's)
      if (c.old && c.old.mode === 'lying' && !c.handed) { c.handed = true; const at = shellAt(c.old), kind = c.old.kind; c.old.mode = 'off'; c.old.mesh.visible = false; c.old = null;
        const next = crabs[i + 1];
        if (next) { next.a.rig.lay(spareOf(next), kind, at.x, at.z, lineYaw + Math.PI, ground, c.k / next.k); next.phase = 'probe'; next.t = 0; }
        else { hooks.drop(at.x, at.z, kind); m.trades++; m.last = { given: busy?.given, got: kind, time: +(t - (busy?.at ?? t)).toFixed(1), x: at.x, z: at.z }; m.busy = null; hooks.moment('cache'); note('trade', m.last); } }
      c.yaw = turnTo(c.yaw, c.want, (c.phase === 'turn' || c.phase === 'back' ? Math.PI / K.turn : 2) * dt);
      R.update(dt, { x: c.pos.x, z: c.pos.z, yaw: c.yaw, vx: 0, vz: 0, ground, time: t + i * 1.7, in: inn, peer, act, look, at: aim });
    });
    // the prize: what the smallest wears, lit while a trade is to be had and the fish is near
    const last = crabs[crabs.length - 1], kind = last.a.rig.worn.kind, lit = !m.busy && m.trades < K.trades && Math.hypot(head.x - foot.x, head.z - foot.z) < 16;
    prize.material.color.set(SHELLS[kind]?.colour || '#ffffff'); prize.position.set(last.pos.x, last.pos.y + K.lift * last.k * 0.5, last.pos.z); prize.material.opacity = damp(prize.material.opacity, lit ? K.glow * (0.8 + 0.2 * Math.sin(t * 2.2)) : 0, 3, dt);
    if (!state.marketSaid && Math.hypot(head.x - foot.x, head.z - foot.z) < 9 && (hooks.shells() || []).length && m.trades < K.trades) { state.marketSaid = true; hooks.say('market', SANDFLAT.words.market); }
  }

  // ================================================================ the burrows
  const B = SANDFLAT.burrow, sandCol = '#e9e3c4';
  const fragGeo = own(shellBit({ bitA: '#fff6ea', bitB: '#ffb3a8' })), fragMat = own(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide, emissive: '#ffe6d6', emissiveIntensity: 0.55 }));
  const fragment = (s = 16) => { const g = new THREE.Group(), m = new THREE.Mesh(fragGeo, fragMat); m.scale.setScalar(s); m.castShadow = true; g.add(m); const h = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: glow, color: '#ffd8c8', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }))); h.scale.setScalar(1.5); h.position.y = 0.08; g.add(h); g.userData.halo = h; root.add(g); return g; };
  const heapGeo = own(new THREE.ConeGeometry(1, 1, 9, 1)), heapMat = own(new THREE.MeshLambertMaterial({ color: sandCol, flatShading: true, emissive: '#fff6dc', emissiveIntensity: 0.12 }));
  const puffGeo = own(new THREE.IcosahedronGeometry(B.puff, 0)), puffMat = own(new THREE.MeshLambertMaterial({ color: '#f7f2dc', flatShading: true, transparent: true, opacity: 0.9, depthWrite: false, emissive: '#fffbe8', emissiveIntensity: 0.25 }));
  state.burrows = S.burrows.map((spot, i) => {
    const a = mk('burrow'); pale(a); noShadow(a.object); a.object.scale.multiplyScalar(B.scale); const face = yawTo(S.x - spot.x, S.z - spot.z) + 0.6;
    a.object.position.set(spot.x, world.drawn(spot.x, spot.z) + 0.008, spot.z); a.object.rotation.y = face; a.object.updateMatrix();
    const inv = new THREE.Matrix4().copy(a.object.matrix).invert();
    const heapAt = new THREE.Vector3(Math.cos(-0.5), 0, Math.sin(-0.5)).multiplyScalar(0.18).applyMatrix4(a.object.matrix); // beside the hole, on the heap's side (BURROW.heap is near this)
    const heap = new THREE.Mesh(heapGeo, heapMat); heap.position.copy(heapAt); heap.position.y = world.drawn(heapAt.x, heapAt.z); heap.castShadow = heap.receiveShadow = true; root.add(heap);
    const flick = sprite('#fff27a', 0); flick.scale.setScalar(2);
    const puffs = Array.from({ length: 14 }, () => { const p = new THREE.Mesh(puffGeo, puffMat); p.visible = false; root.add(p); return { m: p, age: 9, v: new THREE.Vector3() }; });
    return { i, a, spot, inv, heap, heapAt, flick, puffs, mood: 'work', k: 0, quiet: 9, down: 0, dig: 0, given: 0, rest: 0, frag: null, gone: 0, flicks: 0, worked: 0, look: new THREE.Vector3(), next: 0 };
  });
  function kick(b, n, up = 1) { for (let q = 0; q < n; q++) { const p = b.puffs.reduce((o, x) => (x.age > o.age ? x : o)); p.age = 0; p.m.position.copy(b.heapAt).add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.05, (Math.random() - 0.5) * 0.3)); p.m.position.y = world.drawn(p.m.position.x, p.m.position.z) + 0.05; p.v.set((Math.random() - 0.5) * 0.5, (0.5 + Math.random() * 0.5) * up, (Math.random() - 0.5) * 0.5); } }
  function burrowStep(dt, t) {
    for (const b of state.burrows) {
      const x = b.spot.x, z = b.spot.z; let d = 99; for (const j of J) d = Math.min(d, Math.hypot(j.x - x, j.z - z));
      const sp = rig.speed, dashing = rig.dashT > 0, playing = hooks.playing();
      const fright = playing && ((dashing && d < B.dash) || d < B.close || (d < B.scare && sp > B.fast));
      const wary = playing && d < B.wary && sp > B.still;
      if (fright) { if (b.mood !== 'gone') { b.mood = 'gone'; b.k = 0; b.gone++; b.flashT = 0; kick(b, 5, 1.6); hooks.say('burrow', SANDFLAT.words.burrow); } b.quiet = 0; }
      else b.quiet += dt;
      if (b.mood === 'gone') { b.k = b.k < 0.6 || b.quiet > B.hide ? Math.min(1, b.k + dt / (b.k < 0.6 ? 2.5 : 4)) : 0.6; if (b.k >= 1) { b.mood = 'watch'; b.k = 0; b.down = 2; } }
      else if (wary) { if (b.mood !== 'flick') { b.flashT = 0; b.flicks++; } b.mood = 'flick'; }
      else if ((b.down -= dt) > 0) b.mood = 'watch';
      else { if (b.mood !== 'work') { b.mood = 'work'; b.k = 0; } b.k = (b.k + dt / B.load) % 1;
        if ((b.next -= dt) <= 0 && b.k > 0.1 && b.k < 0.5) { b.next = 0.3; kick(b, 2); }
        const counts = Math.hypot(head.x - x, head.z - z) < B.near && sp < B.still && playing && b.given < B.per;
        if ((b.rest -= dt) <= 0 && counts) { b.dig += dt; b.worked += dt; } }
      // the heap grows with the work done toward the next find
      const hk = lerp(B.heap[0], B.heap[1], clamp(b.dig / B.dig, 0, 1) * 0.6 + Math.min(1, b.given * 0.2)); b.heap.scale.set(hk, hk * 0.32, hk); b.heap.position.y = world.drawn(b.heapAt.x, b.heapAt.z) + hk * 0.06;
      if (b.dig >= B.dig && !b.frag) { b.dig = 0; b.given++; b.rest = B.rest; const f = fragment(); f.position.copy(b.heapAt); f.position.y = world.drawn(b.heapAt.x, b.heapAt.z) + 0.22 * b.heap.scale.x + 0.04; b.frag = f; kick(b, 6, 1.4); hooks.moment('flit'); note('fragment', { burrow: b.i }); }
      // the flick: a bright yellow wink at the goby, twice; gone: one big one
      b.flashT = (b.flashT ?? 9) + dt; const wink = b.mood === 'flick' ? Math.max(0, Math.sin(b.flashT * 9)) ** 4 * (b.flashT < 1.6 ? 1 : 0.35) : b.mood === 'gone' && b.flashT < 0.4 ? 1 - b.flashT / 0.4 : 0;
      b.flick.position.copy(b.a.object.position).add(new THREE.Vector3(Math.sin(b.a.object.rotation.y) * 0.25, 0.35, Math.cos(b.a.object.rotation.y) * 0.25)); b.flick.material.opacity = 0.95 * wink; b.flick.scale.setScalar(1.4 + 1.4 * wink);
      for (const p of b.puffs) { p.age += dt; p.m.visible = p.age < 1.6; if (!p.m.visible) continue; p.m.position.addScaledVector(p.v, dt); p.v.multiplyScalar(Math.exp(-2.2 * dt)); p.v.y -= 0.25 * dt; const s = (0.6 + p.age) * (1 - p.age / 1.6); p.m.scale.setScalar(s); }
      // a fragment lying on the heap: the head takes it up, if it carries none
      if (b.frag) { b.frag.rotation.y += dt * 0.8; b.frag.userData.halo.material.opacity = 0.45 + 0.2 * Math.sin(t * 3 + b.i);
        if (!state.carry && playing && Math.hypot(head.x - b.frag.position.x, head.z - b.frag.position.z) < B.take && head.y - b.frag.position.y < 3) { state.carry = b.frag; b.frag = null; state.carried++; hooks.moment('grow'); } }
      const vis = !unseen(x, z, 3); b.a.object.visible = vis;
      if (vis) { b.look.copy(head).applyMatrix4(b.inv); b.a.rig.update(dt, { mood: b.mood, k: b.k, time: t, look: b.look }); }
    }
    if (state.carry) state.carry.rotation.y += dt * 2;
  }

  // ================================================================ the circle
  const CI = SANDFLAT.circle, sites = circleSites(S);
  const C0 = Object.assign({ p: 0, site: 0, done: 0, frags: 0, left: -1, paid: false }, kept.circle || {});
  if (hooks.fresh && kept.circle) { // a new dive: the circle is a step further on; a finished one is left, and a new one begun beside it
    if (C0.p >= 3 && C0.paid) Object.assign(C0, { left: C0.site, site: (C0.site + 1) % sites.length, p: 0, frags: 0, paid: false });
    else { C0.p = Math.min(3, Math.floor(C0.p + 1e-6) + CI.dive); C0.left = -1; }
  }
  save();
  const stageOf = (p) => { const st = CI.stages, i = Math.min(st.length - 2, Math.floor(p)), u = clamp(p - i, 0, 1); return lerp(st[i], st[i + 1], u); };
  const circ = mk('sandcircle'), site = sites[C0.site]; noShadow(circ.object); circ.object.scale.multiplyScalar(CI.scale); circ.object.position.set(site.x, world.drawn(site.x, site.z) + 0.01, site.z); circ.object.rotation.y = C0.site * 0.7; circ.object.updateMatrix();
  circ.rig.update(0, { stage: stageOf(C0.p) }); // (drawn at its stage from the first, even from far off)
  const RC = (CIRCLE.R + 0.1) * circ.object.scale.x; // the circle's radius in the world
  let old = null; if (C0.left >= 0 && C0.left !== C0.site) { old = mk('sandcircle'); noShadow(old.object); const o = sites[C0.left]; old.object.scale.multiplyScalar(CI.scale); old.object.position.set(o.x, world.drawn(o.x, o.z) + 0.005, o.z); old.object.rotation.y = C0.left * 0.7; old.rig.update(0, { stage: 1.3 }); }
  const fish = mk('puffer'); fish.object.scale.multiplyScalar(CI.fish); noShadow(fish.object, (x) => x === fish.body);
  const placed = []; // the fragments the player has brought, on the ridges
  const slot = (n) => { const ridge = 1 + 2 * ((n * 5) % 14), a = (ridge / CIRCLE.ridges) * TAU, rr = 1.02 + 0.22 * ((n * 0.618) % 1); return new THREE.Vector3(Math.cos(a) * rr, 0.05, Math.sin(a) * rr).applyMatrix4(circ.object.matrix); };
  function setFrag(n, f = fragment(11)) { const p = slot(n); f.position.copy(p); f.position.y = world.drawn(p.x, p.z) + 0.07 + 0.06 * clamp(stageOf(C0.p) / 1, 0, 1); f.userData.halo.scale.setScalar(0.9); placed.push(f); return f; }
  for (let n = 0; n < C0.frags; n++) setFrag(n);
  const cs = state.circle = { p: C0.p, start: C0.p, flat: 0, lane: 0, q: 0, puffed: 0, fall: null, calmT: 0, rested: 0, gift: false };
  function circleStep(dt, t) {
    const c = cs, cx = circ.object.position.x, cz = circ.object.position.z, playing = hooks.playing();
    // a body swept over it fast flattens it back
    let over = false; for (const j of J) if (Math.hypot(j.x - cx, j.z - cz) < RC) { over = true; break; }
    if (over && playing && (rig.speed > CI.careless || rig.dashT > 0) && C0.p < 3) { const was = C0.p; C0.p = Math.max(CI.floor, C0.p - CI.flatten * dt); c.flat += was - C0.p; c.puffed = 2; if (Math.random() < dt * 8) kickAt(cx + (Math.random() - 0.5) * RC, cz + (Math.random() - 0.5) * RC); }
    // a fragment carried in over it, not too fast: it falls to a ridge, and the work goes on
    const dh = Math.hypot(head.x - cx, head.z - cz);
    if (state.carry && playing && dh < RC && rig.speed < CI.careless && !c.fall) { const f = state.carry; state.carry = null; c.fall = { f, from: f.position.clone(), t: 0, n: C0.frags }; C0.frags++; }
    if (c.fall) { const F = c.fall; F.t += dt / 0.9; const e = ease(Math.min(1, F.t)), to = slot(F.n); to.y = world.drawn(to.x, to.z) + 0.1;
      F.f.position.lerpVectors(F.from, to, e); F.f.position.y += Math.sin(Math.PI * e) * 0.5; F.f.children[0].scale.setScalar(lerp(16, 11, e));
      if (F.t >= 1) { c.fall = null; setFrag(F.n, F.f); C0.p = Math.min(3, C0.p + CI.frag); hooks.moment('cache'); hooks.gulp(Math.min(3, placed.length - 1), 4, 0.3); save(); note('placed', { p: C0.p, frags: C0.frags }); } }
    if (!state.circleSaid && dh < 10) { state.circleSaid = true; hooks.say('circle', SANDFLAT.words.circle); }
    // finished: the gift, once
    if (C0.p >= 3 && !C0.paid && dh < 14 && playing) { C0.paid = true; C0.done++; c.gift = true; save(); nestMark(); hooks.moment('cache'); for (let i = 0; i < 4; i++) hooks.gulp(i, 4, 0.45); note('finished', { done: C0.done }); }
    // the calm middle of a finished circle: the breath comes back
    if (C0.p >= 3 && playing && dh < CIRCLE.middle * circ.object.scale.x * (1 + CI.calm) && rig.speed < CI.still) { c.calmT += dt; if (c.calmT > CI.rest) { c.calmT = 0; c.rested++; hooks.rest(); } } else c.calmT = 0;
    circ.rig.update(dt, { stage: stageOf(C0.p) }); circ.object.visible = !unseen(cx, cz, 4); if (old) old.object.visible = !unseen(old.object.position.x, old.object.position.z, 4);
    for (const f of placed) f.position.y = damp(f.position.y, world.drawn(f.position.x, f.position.z) + 0.05 + 0.07 * clamp(stageOf(C0.p), 0, 1), 3, dt);
    // the puffer: in along a valley belly down, stirring the middle, out over the ridges to the next; a body near it, or one sweeping over, and it puffs up
    c.q += dt / CI.lap; if (c.q >= 1) { c.q = 0; c.lane = (c.lane + 7) % CIRCLE.ridges; }
    const a = ((c.lane + 0.5) / CIRCLE.ridges) * TAU, R0 = CIRCLE.R + 0.1, rc = CIRCLE.middle; let rr, y, mood, yaw;
    if (c.q < 0.45) { rr = lerp(R0, rc, c.q / 0.45); y = 0.05; mood = C0.p >= 3 ? 'swim' : 'plough'; yaw = Math.atan2(-Math.cos(a), -Math.sin(a)); }
    else if (c.q < 0.65) { rr = rc * 0.5; y = 0.06; mood = 'stir'; yaw = Math.atan2(-Math.cos(a), -Math.sin(a)) + 0.6 * Math.sin(t * 0.8); }
    else { rr = lerp(rc * 0.5, R0 + 0.2, (c.q - 0.65) / 0.35); y = 0.3; mood = 'swim'; yaw = Math.atan2(Math.cos(a), Math.sin(a)); }
    const P = new THREE.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr).applyMatrix4(circ.object.matrix);
    let dn = 99; for (const j of J) dn = Math.min(dn, Math.hypot(j.x - P.x, j.z - P.z)); if (dn < CI.puff && playing) c.puffed = 3;
    if ((c.puffed -= dt) > 0) { mood = 'puffed'; P.y += 0.3; }
    if (!unseen(P.x, P.z, 2)) fish.rig.update(dt, { x: P.x, y: P.y, z: P.z, yaw: yaw + circ.object.rotation.y, mood, carry: c.fall ? false : mood === 'swim' && c.q > 0.65 && placed.length > 0 });
    fish.object.visible = !unseen(P.x, P.z, 2);
  }
  // silt over the circle when it is swept
  const silt = Array.from({ length: 10 }, () => { const p = new THREE.Mesh(puffGeo, puffMat); p.visible = false; root.add(p); return { m: p, age: 9, v: new THREE.Vector3() }; });
  function kickAt(x, z) { const p = silt.reduce((o, s) => (s.age > o.age ? s : o)); p.age = 0; p.m.position.set(x, world.drawn(x, z) + 0.1, z); p.v.set((Math.random() - 0.5) * 0.6, 0.6 + Math.random() * 0.4, (Math.random() - 0.5) * 0.6); }
  function siltStep(dt) { for (const p of silt) { p.age += dt; p.m.visible = p.age < 1.5; if (!p.m.visible) continue; p.m.position.addScaledVector(p.v, dt); p.v.multiplyScalar(Math.exp(-2 * dt)); p.m.scale.setScalar((0.8 + p.age) * (1 - p.age / 1.5) * 1.6); } }

  // ================================================================ the nest: a pale disc ahead and to the left of the start
  let mark = null;
  function nestMark() {
    const nest = world.react?.nest; if (!nest) return;
    if (mark) nest.group.remove(mark);
    const N = SANDFLAT.nest, g = new THREE.Group(), yaw = nest.yaw, fw = [Math.sin(yaw), Math.cos(yaw)], rt = [Math.cos(yaw), -Math.sin(yaw)];
    const sx = world.spawn.x + fw[0] * N.f + rt[0] * N.r, sz = world.spawn.z + fw[1] * N.f + rt[1] * N.r, y = world.drawn(sx, sz), lx = sx - world.spawn.x, lz = sz - world.spawn.z;
    const discMat = own(new THREE.MeshLambertMaterial({ color: '#e4dfbf', flatShading: true })), disc = new THREE.Mesh(own(new THREE.CylinderGeometry(0.85, 0.9, 0.08, 10)), discMat); disc.position.set(lx, y + 0.02, lz); disc.receiveShadow = true; g.add(disc);
    const grade = state.eels.best?.grade | 0, eelGeo = own(new THREE.CylinderGeometry(0.035, 0.045, 1, 5));
    for (let k = 0; k < 3; k++) { const up = k < grade, mm = own(new THREE.MeshLambertMaterial({ color: up ? '#f6f3ea' : '#59605a', flatShading: true, emissive: up ? '#fff6d8' : '#000000', emissiveIntensity: up ? 0.45 : 0 })), e = new THREE.Mesh(eelGeo, mm);
      const u = (k - 1) * 0.28, h = up ? 0.55 : 0.08; e.scale.set(1, h, 1); e.position.set(lx + rt[0] * u - fw[0] * 0.3, y + 0.06 + h / 2, lz + rt[1] * u - fw[1] * 0.3); e.rotation.x = up ? 0.12 : 0; e.castShadow = true; e.userData.up = up; g.add(e); }
    const done = Math.min(N.rings, C0.done | 0), ringGeo = own(new THREE.TorusGeometry(0.16, 0.035, 4, 12));
    for (let k = 0; k < done; k++) { const mm = own(new THREE.MeshLambertMaterial({ color: '#fff3e6', flatShading: true, emissive: '#ffb3a8', emissiveIntensity: 0.35 })), ring = new THREE.Mesh(ringGeo, mm), u = (k - (done - 1) / 2) * 0.4;
      ring.rotation.x = -Math.PI / 2; ring.position.set(lx + rt[0] * u + fw[0] * 0.35, y + 0.08, lz + rt[1] * u + fw[1] * 0.35); ring.userData.ring = true; g.add(ring); }
    g.userData.sandflat = { grade, rings: done }; nest.group.add(g); mark = g;
  }
  nestMark();

  // ================================================================ one frame
  let sight = null; const eye = new THREE.Vector3();
  const unseen = (x, z, pad) => (sight ? Math.hypot(x + off.x - eye.x, z + off.z - eye.z) > sight + pad : Math.hypot(x - head.x, z - head.z) > 60);
  function update(dt, camera) {
    state.t += dt; const t = state.t;
    sight = camera && scene.fog ? scene.fog.far : null; if (camera) eye.copy(camera.position);
    off.x = T * Math.round((rig.pos.x - S.x) / T); off.z = T * Math.round((rig.pos.z - S.z) / T); root.position.set(off.x, 0, off.z);
    head.set(rig.snout.x - off.x, rig.snout.y, rig.snout.z - off.z);
    J.length = 0; for (const j of rig.joints) J.push(new THREE.Vector3(j.x - off.x, j.y, j.z - off.z));
    state.near = Math.hypot(head.x - S.x, head.z - S.z) < S.R + SANDFLAT.wake;
    { const sp = rig.speed, acc = dt > 0 ? Math.abs(sp - noise.was) / dt : 0; noise.was = sp; noise.jerk = damp(noise.jerk, Math.min(acc, 20), 6, dt); noise.v = rig.dashT > 0 ? E.dash : sp + E.jerk * noise.jerk; } // how much noise the body makes
    if (state.carry) state.carry.position.copy(rig.snout).sub(new THREE.Vector3(off.x, 0.12, off.z)).addScaledVector(rig.forward, 0.12); // a fragment carried, in the mouth
    if (!state.near) { root.visible = !!(sight && !unseen(S.x, S.z, S.R)); return; }
    root.visible = true;
    eelStep(dt, t); marketStep(dt, t); burrowStep(dt, t); circleStep(dt, t); siltStep(dt);
  }
  function dispose() {
    for (const a of made) { root.remove(a.object); a.dispose(); }
    for (const o of owned) o.dispose?.();
    scene.remove(root);
    if (mark) world.react?.nest?.group.remove(mark);
  }
  // for the checks and the pictures
  const debug = { patches, allEels, crabs, foot, table, kinds, burrows: state.burrows, circle: circ, old, fish, sites, placed, noise, C0, RC, get mark() { return mark; },
    fragment: () => { const f = fragment(); state.carry = f; return f; }, stageOf };
  return { update, dispose, world, state, debug, plan: S };
}
