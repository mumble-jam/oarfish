// The kelp forest's life: one box jelly that keeps the clearing at the forest's far end, the shell it keeps, and a fragment of the ruins left in the
// nook off the loop. Where the forest, its lanes, its clearing and its nook are is laid out by quiet.js and built by world.js (world.quiet.kelpwood);
// everything that decides is here, and every number is in KELPWOOD, below. How the box jelly looks is its component's (npc.js) and its rig's (jelly.js).
//
// What was taken from the real animal (the report "Oarfish first level expansion", section 5, and its notes, behaviour_current_creatures.md, section 6):
//   THE BOX JELLY, the sea wasp, Chironex fleckeri. Three true things, and one rule made of them.
//   - Unlike other jellyfish it hunts actively by day: tagged animals covered about 212 m an hour in a straight line by day, and lay still on the sand
//     by night (Seymour, Carrette and Sutherland 2004). So it patrols, slowly and with purpose, in straight runs with sharp turns (it can turn right round
//     in a few strokes: jelly.js), and never drifts.
//   - In the laboratory it swam away from dark objects (Hamner, Jones and Hamner 1995). In the small mangrove species the dodge is set off when the
//     obstacle fills enough of the eye's view, and scales with its contrast (Garm et al. 2007: that is Tripedalia, not the sea wasp, and only the
//     "how much of its view" is borrowed). So THE RULE: it turns away from the fish's body, the more strongly the more of the body is near it, and a body
//     laid round it fences it in. It can be herded with the body's length, and this is how the shell it keeps is taken.
//   - Its sting is counted by how much tentacle touches the skin: contact with roughly 6 m of it can kill a person (Animal Diversity Web). So a
//     sting here costs by how much of the body lies across its tentacles at once, and costs more than anything else in this band. It is bounded as the
//     sea nettle's is (bloom.js): it goes through the game's own bite, so a dashing head is spared and the Cap takes it, and it never takes the body
//     below `keep` segments, so it cannot end a dive.
//   Not taken: the learning (that is Tripedalia's), and the night's rest on the sand (the dive has no night).
// The shell it keeps is one of the game's ten, chosen as a cache's prize is (the first kind in this dive's pool that is neither worn nor lying about).
// The nook's find is a fragment of the ruins, a fallen column top like the two each band has, to be hauled to the rift for the nest. Nothing here pays
// in fish: the report's rule for the new places (sections 7 and 8) is that they pay in options and records, never in food.
import * as THREE from 'three';
import { make, geometry, resolve, paintOf, stoneOf } from './npc.js';
import { clamp, lerp, damp } from './geo.js';

// ---------------------------------------------------------------- every number, in one place
export const KELPWOOD = {
  // the box jelly. scale: of its component (a bell 0.27 m across, tentacles 1.25 m; here the bell is about 0.65 m and the tentacles 3 m, as the real
  // one's are). high: its bell over the bed. The patrol: corner to opposite corner of a square `half` metres from the clearing's middle, through the
  // middle where the shell lies, then along a side, and over again; `speed` metres a second; it turns `turn` radians a second (sharply). On patrol it
  // hunts, its tentacles let out long behind it, `beat` strokes a second; going away from the body it beats hard with them drawn up short (jelly.js).
  jelly: { scale: 2.4, high: 2.7, patrol: { half: 2.2, speed: 0.75, turn: 2.6, near: 0.6, beat: 1.3 },
    // what it sees: any part of the body within `see` metres (and `tall` above or below) weighs on it, more the nearer (`fall`: how fast that weight
    // falls off with distance); above `shy` of weight it turns away, at `away` metres a second; with weight from every side (`fenced`: what is left of the
    // sum, as a part of the whole, below which it is hemmed in) it holds where it is, upright, and turns about. It keeps inside `roam` metres of the
    // middle; once nothing has weighed on it for `back` seconds it goes back to its patrol.
    see: 4.2, tall: 3, fall: 1.6, shy: 0.35, away: 1.25, fenced: 0.3, roam: 8.5, back: 5,
    // the sting. A part of the body within `reach` metres of a tentacle as it is drawn this frame is touching it. Counted over `look` seconds from the
    // first touch, by the most joints (a joint to about 0.31 m) touching at once: fewer than more[0] costs cost[0] segments (a brush), fewer than more[1]
    // costs cost[1] (crossing it), and more than that cost[2] (lying along it, or wrapped through it). Never below `keep` segments. Then it stings
    // nothing for `rest` seconds and jets away from the body at `flee` metres a second.
    sting: { reach: 0.35, look: 0.35, more: [4, 8], cost: [1, 2, 3], keep: 6, rest: 3, flee: 1.9 } },
  shell: { lift: 1.1 }, // the shell in the clearing's middle, this far over the bed
  // the try: it starts when the head first comes within `near` metres of the clearing's middle (its radius and this much more), and ends when the shell
  // is taken. A clean take is one with no sting in it. The best is kept in the nest: the fewest stings, and then the quickest
  try: { near: 3 },
  find: { lie: 0.45 }, // the fragment in the nook: how far off the bed the middle of it is, lying on its side (as world.js lays the band's own)
  wake: 70, // nothing here is worked out while the fish is further than this from the clearing (it cannot be seen, and nothing can touch it)
};

const TAU = Math.PI * 2, wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// the distance from p to the segment a-b, all { x, y, z }
function toSegment(p, a, b) {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z, L = abx * abx + aby * aby + abz * abz || 1e-9;
  const t = clamp(((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz) / L, 0, 1);
  return Math.hypot(p.x - a.x - abx * t, p.y - a.y - aby * t, p.z - a.z - abz * t);
}

// world: the first band (world.quiet.kelpwood is the plan). hooks, from main.js:
//   rig, safe(), bite(n, joint, from), hurt(), segs(), playing(), moment(kind), say(id, text),
//   prize(x, z, lift): lays the shell (as a cache's prize is chosen) and returns it, as the shell field keeps it
//   best: { stings, time } kept in the nest, and took(result): the shell taken (result: { time, stings, best: was it a best, kept })
export function createKelpwood(scene, world, hooks) {
  const K = world.quiet.kelpwood, C = K.clearing, T = world.size, wrap = world.wrap, rig = hooks.rig, J = KELPWOOD.jelly, P = J.patrol, ST = J.sting;
  const owned = [], add = (o) => { scene.add(o); owned.push(o); return o; };
  const off = { x: 0, z: 0 }; // which copy of the band the fish is in: everything here is kept in the first copy and drawn in the fish's
  const state = { t: 0, stings: 0, best: hooks.best ? { ...hooks.best } : null, taken: false, said: false };

  // ---- the box jelly
  const a = make('boxjelly'); a.object.scale.multiplyScalar(J.scale); scene.add(a.object);
  // its patrol: the four corners of a square round the middle, square to the forest, taken 0, 2, 1, 3: across the middle, along a side, across, along
  const ux = K.axis.ux, uz = K.axis.uz, corner = (i) => { const s = [[1, 1], [-1, -1], [1, -1], [-1, 1]][i]; return { x: C.x + (ux * s[0] + uz * s[1]) * P.half, z: C.z + (uz * s[0] - ux * s[1]) * P.half }; };
  const route = [0, 1, 2, 3].map(corner);
  const bed = (x, z) => world.height(x, z);
  const box = { pos: new THREE.Vector3(route[0].x, bed(route[0].x, route[0].z) + J.high, route[0].z), yaw: Math.atan2(route[1].x - route[0].x, route[1].z - route[0].z), speed: 0, tilt: 1.2,
    mode: 'patrol', held: null, leg: 1, quiet: 99, rest: 0, weight: 0, push: { x: 0, z: 0 }, touch: null, mood: 'pulse', strands: a.rig.strands };

  // ---- the shell it keeps, in the middle of the clearing: laid by main.js, so that it is one of the shells lying in this band and is taken as any is
  const shell = hooks.prize(C.x, C.z, KELPWOOD.shell.lift); if (shell) shell.kelp = true;
  const tryNow = { on: false, t: 0, stings: 0 };

  // ---- the nook's find: a fallen column top, as the band's own two are made (world.js), handed to the world's fragments so that it is hauled and
  // given as they are (main.js, hauling). It is drawn here, in the fish's copy of the band
  let find = null;
  { const N = K.nook, y = world.drawn(N.x, N.z, 0.6) + KELPWOOD.find.lie, band = world.index ?? 0, stone = new THREE.MeshLambertMaterial({ color: stoneOf(band)[0], vertexColors: true }), paint = paintOf(band);
    const slabMat = new THREE.MeshLambertMaterial({ color: paint, vertexColors: true, emissive: paint, emissiveIntensity: 0.2 }); owned.push(stone, slabMat);
    const g = add(new THREE.Group()), cushion = new THREE.Mesh(geometry('echinus'), stone), neck = new THREE.Mesh(geometry('stump'), stone), slab = new THREE.Mesh(geometry('block'), slabMat);
    slab.scale.set(1.5, 0.18, 1.5); slab.position.y = 0.2; neck.rotation.x = Math.PI; cushion.castShadow = slab.castShadow = neck.castShadow = true; g.add(neck, cushion, slab); g.scale.setScalar(0.8);
    const yaw = Math.atan2(K.axis.ux, K.axis.uz) + 0.7, tilt = 1.28;
    g.rotation.set(tilt, yaw, 0, 'YXZ'); g.position.set(N.x, y, N.z);
    find = { x: N.x, y, z: N.z, yaw, tilt, held: false, gone: false, sink: 0, mesh: g, slab, kelp: true, ring: { x: N.x, z: N.z, left: 1, can: true, threat: 1, orbit: 1.5 } };
    world.react?.fragments?.push(find); }

  // ---- the nest keeps the best: a slab by the shell places with a pale box on it, lit bright for a clean take, dimly for a take with stings in it
  let mark = null;
  function nestMark() {
    const nest = world.react?.nest; if (!nest) return;
    if (mark) nest.group.remove(mark);
    const g = new THREE.Group(), yaw = nest.yaw, fw = [Math.sin(yaw), Math.cos(yaw)], rt = [Math.cos(yaw), -Math.sin(yaw)], f = 3.6, r0 = 2.9; // (3.1 left it 0.4 m from the squid's slab, all but touching)
    const sx = world.spawn.x + fw[0] * f + rt[0] * r0, sz = world.spawn.z + fw[1] * f + rt[1] * r0, y = world.drawn(sx, sz);
    const stone = new THREE.MeshLambertMaterial({ color: '#7d8a80', flatShading: true }), slab = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.54, 0.12, 4), stone); owned.push(stone, slab.geometry);
    slab.position.set(sx - world.spawn.x, y + 0.04, sz - world.spawn.z); slab.rotation.y = yaw + Math.PI / 4; slab.castShadow = slab.receiveShadow = true; g.add(slab);
    const b = state.best, clean = !!b && !b.stings, lit = !!b, cube = new THREE.BoxGeometry(0.34, 0.34, 0.34), glass = new THREE.MeshLambertMaterial({ color: lit ? resolve('boxjelly').palette.bell : '#3a4148', flatShading: true, emissive: lit ? '#9fd8ff' : '#000000', emissiveIntensity: clean ? 0.9 : lit ? 0.25 : 0 }); owned.push(cube, glass);
    const c = new THREE.Mesh(cube, glass); c.position.set(slab.position.x, y + 0.28, slab.position.z); c.rotation.y = yaw + Math.PI / 4; c.castShadow = true; g.add(c);
    g.userData = { kelp: true, clean, lit }; nest.group.add(g); mark = g;
  }
  nestMark();

  // ---------------------------------------------------------------- one frame
  const head = new THREE.Vector3(), jt = [], want = new THREE.Vector2();
  function update(dt, camera) {
    state.t += dt;
    off.x = T * Math.round((rig.pos.x - C.x) / T); off.z = T * Math.round((rig.pos.z - C.z) / T);
    head.set(rig.snout.x - off.x, rig.snout.y, rig.snout.z - off.z);
    const far = Math.hypot(head.x - C.x, head.z - C.z), playing = hooks.playing();
    // the find lies where it is, in the fish's copy of the band, until it is taken up (main.js places it then) or given (world.js sinks it)
    if (!find.held && !find.gone) find.mesh.position.set(find.x + off.x, find.y, find.z + off.z);
    if (far > KELPWOOD.wake) { a.object.visible = false; return; }
    a.object.visible = true;
    jt.length = 0; for (const j of rig.joints) jt.push({ x: j.x - off.x, y: j.y, z: j.z - off.z });

    // ---- what it sees: the body near it, weighed by how near each part is. The sum says which way the body is; what is left of it, against the whole,
    // says whether the body is on one side of it (it turns away) or all round it (it is fenced in, and holds)
    let wx = 0, wz = 0, whole = 0;
    if (playing) for (const p of jt) { const dx = box.pos.x - p.x, dz = box.pos.z - p.z, d = Math.hypot(dx, dz); if (d > J.see || Math.abs(p.y - box.pos.y) > J.tall || d < 1e-3) continue;
      const k = Math.pow(1 - d / J.see, J.fall); wx += (dx / d) * k; wz += (dz / d) * k; whole += k; }
    box.weight = whole; const lean = Math.hypot(wx, wz); box.push.x = wx; box.push.z = wz;
    box.rest = Math.max(0, box.rest - dt);
    const fromMid = Math.hypot(box.pos.x - C.x, box.pos.z - C.z);
    let goal = null, speed = P.speed, mood = 'drift', rate = P.beat;
    if (box.rest > 0 && lean > 1e-3) { box.mode = 'stung'; goal = Math.atan2(wx, wz); speed = ST.flee; box.quiet = 0; mood = 'pulse'; rate = undefined; } // it has stung: it jets away from the body
    else if (whole > J.shy) { box.quiet = 0;
      if (lean < J.fenced * whole) { box.mode = 'fenced'; speed = 0; rate = 0.6; } // hemmed in: it holds, upright, and turns about
      else { box.mode = 'shy'; goal = Math.atan2(wx, wz); speed = J.away * clamp(0.55 + whole * 0.25, 0.55, 1.3); mood = 'pulse'; rate = undefined; } }
    else { box.quiet += dt;
      if (box.mode !== 'patrol' && box.quiet < J.back) { box.mode = 'wait'; speed = 0.25; rate = 0.9; goal = box.yaw; } // left alone, it waits a while where it was put before it goes back
      else { if (box.mode !== 'patrol') { box.mode = 'patrol'; box.leg = nearest(); }
        const c = route[box.leg]; if (Math.hypot(c.x - box.pos.x, c.z - box.pos.z) < P.near) { box.leg = (box.leg + 1) % 4; }
        const n = route[box.leg]; goal = Math.atan2(n.x - box.pos.x, n.z - box.pos.z); } }
    // it keeps to the clearing: past `roam` it is turned back in, along the edge
    if (goal !== null && fromMid > J.roam - 1) { const inward = Math.atan2(C.x - box.pos.x, C.z - box.pos.z), k = clamp((fromMid - (J.roam - 1)) / 1.5, 0, 1); want.set(Math.sin(goal) * (1 - k) + Math.sin(inward) * k * 1.6, Math.cos(goal) * (1 - k) + Math.cos(inward) * k * 1.6); goal = Math.atan2(want.x, want.y); }
    if (box.held) { goal = null; speed = box.held.speed; mood = box.held.mood; rate = box.held.rate; } // (held by a check: it goes on as it was, seeing nothing)
    if (goal !== null) box.yaw += clamp(wrapPi(goal - box.yaw), -P.turn * dt, P.turn * dt);
    else if (!box.held) box.yaw += dt * 0.5; // fenced: it turns about, looking for a way out
    box.speed = damp(box.speed, speed, 2.5, dt); box.mood = mood;
    box.pos.x += Math.sin(box.yaw) * box.speed * dt; box.pos.z += Math.cos(box.yaw) * box.speed * dt;
    box.pos.y = damp(box.pos.y, bed(box.pos.x, box.pos.z) + J.high, 1.5, dt);
    // how it lies: over on its side to go level when it goes somewhere, upright when it holds
    box.tilt = damp(box.tilt, box.speed > 0.3 ? 1.25 : 0.2, 2.2, dt);
    a.rig.update(dt, { x: box.pos.x + off.x, y: box.pos.y, z: box.pos.z + off.z, yaw: box.yaw, tilt: box.tilt, mood: box.mood, rate });

    // ---- the sting: any part of the body within reach of a tentacle as it is drawn now (the strands' own joints, in the fish's copy of the band)
    let count = 0, last = -1;
    if (box.rest <= 0 && playing && !hooks.safe()) {
      const R = 1.25 * J.scale * 1.1 + 0.5, bx = box.pos.x + off.x, bz = box.pos.z + off.z;
      rig.joints.forEach((p, i) => { if (Math.hypot(p.x - bx, p.y - box.pos.y, p.z - bz) > R) return;
        for (const s of box.strands) { const q = s.st.joints; for (let k = 0; k + 1 < q.length; k++) if (toSegment(p, q[k], q[k + 1]) < ST.reach) { count++; last = i; return; } } });
    }
    if (count && !box.touch) box.touch = { t: 0, most: 0, last };
    if (box.touch) { const tc = box.touch; tc.t += dt; if (count >= tc.most) { tc.most = count; tc.last = Math.max(last, tc.last); }
      if (tc.t >= ST.look) { box.touch = null;
        if (tc.most && playing && !hooks.safe()) { const want = tc.most >= ST.more[1] ? ST.cost[2] : tc.most >= ST.more[0] ? ST.cost[1] : ST.cost[0], can = Math.max(0, Math.min(want, hooks.segs() - ST.keep));
          box.rest = ST.rest; state.stings++; if (tryNow.on) tryNow.stings++; state.last = { count: tc.most, want, cost: can, t: state.t };
          const at = new THREE.Vector3(box.pos.x + off.x, box.pos.y, box.pos.z + off.z);
          if (!(can > 0 && hooks.bite(can, tc.last, at))) hooks.hurt();
          if (!state.said) { state.said = true; hooks.say('boxjelly', 'A box jelly stings by how much of you its threads touch. It shies from your body: herd it.'); } } } }

    // ---- the try for the shell
    if (!tryNow.on && !state.taken && far < C.r + KELPWOOD.try.near && playing) Object.assign(tryNow, { on: true, t: 0, stings: 0 });
    if (tryNow.on) tryNow.t += dt;
    if (shell && shell.taken && !state.taken) taken();
  }
  // the corner of the patrol nearest the box, to take it up again from
  function nearest() { let b = 0, d = 1e9; route.forEach((c, i) => { const e = Math.hypot(c.x - box.pos.x, c.z - box.pos.z); if (e < d) { d = e; b = i; } }); return b; }
  function taken() {
    state.taken = true;
    const time = +(tryNow.on ? tryNow.t : 0).toFixed(1), stings = tryNow.on ? tryNow.stings : state.stings; tryNow.on = false;
    const b = state.best, best = !b || stings < b.stings || (stings === b.stings && time < b.time);
    if (best) { state.best = { stings, time }; nestMark(); }
    hooks.took({ time, stings, best, kept: state.best });
  }

  // who sits in with the band: the box jelly, by how near it is (its instrument is in music.js)
  function cast(most) { most('boxjelly', a.object.visible ? clamp(1 - Math.hypot(box.pos.x + off.x - rig.pos.x, box.pos.z + off.z - rig.pos.z) / 16, 0, 1) : 0); }
  function dispose() {
    for (const o of owned) { if (o.isObject3D) scene.remove(o); else o.dispose?.(); }
    scene.remove(a.object); a.dispose();
    const F = world.react?.fragments; if (F) { const i = F.indexOf(find); if (i >= 0) F.splice(i, 1); }
    if (mark) world.react?.nest?.group.remove(mark);
  }
  // for the checks and the pictures
  const debug = { off, route, tryNow, get mark() { return mark; },
    put(x, z, yaw = box.yaw, mode = 'wait') { box.pos.set(x, bed(x, z) + J.high, z); box.yaw = yaw; box.mode = mode; box.quiet = 0; box.speed = 0; for (const s of box.strands) s.st.fresh = true; },
    // where the tentacles are drawn: every joint of every one, in the band's first copy
    tentacles: () => box.strands.flatMap((s) => s.st.joints.map((q) => ({ x: q.x - off.x, y: q.y, z: q.z - off.z }))) };
  return { update, cast, dispose, plan: K, box, shell, find, state, debug, jelly: a };
}
