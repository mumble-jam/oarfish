// The reef head's life: the first band's one place to recover, the trumpetfish that hang among its sea rods, and the coral that grows there from
// dive to dive. Where everything stands is the world's (quiet.js lays it out, world.js builds the heads, rods and garden, and hands the plan on as
// world.quiet.reef); everything that moves or decides is here, and every number is in REEF, below. main.js makes it as it makes the bloom
// (createReef) and runs it beside the hunters. Nothing here pays in fish: the station gives back length that was lost, the trumpetfish takes, and
// the coral is a record.
//
//   THE CLEANING STATION, at the clear middle. It works as the stations of the deeper bands do (world.js, CLEAN): a head held still over it,
//     slower than `still`, for `time` seconds, has one segment grown back; `uses` times a dive, `rest` seconds between. Down there its price is the
//     tail-biters, which gather round while it works and are close when it is done. This band has none, so it has a rule of its own: it MENDS, IT
//     DOES NOT FEED. It gives back only what this dive has lost (the body shorter than the longest it has been this dive), and a whole fish gets
//     nothing: its ring does not show and its cleaners keep to the coral. Full grown, nothing goes to the crest either. So a fish cannot come here
//     to grow, only to undo damage, twice a dive.
//   THE TRUMPETFISH, Aulostomus maculatus (the model and its sources are trumpet.js's). The one true trait made its rule: it hides along a big
//     harmless body to get close to prey. Pulled past damselfish, a trumpetfish model alone was inspected and fled from; fixed to the side of a
//     parrotfish model it drew no more than the parrotfish did (University of Cambridge, on Matchette et al. 2023, Current Biology); and it hangs
//     head down among sea fans and rods, and follows big fish until it strikes (Florida Museum). So: two or three hang head down by the rods. A
//     body that swims past close enough has one peel off and lie along its flank, in its yellow phase (the real one changes colour fast; here it is
//     how a thin line reads as a rider from the high camera). It rides. When the body closes a loop on a swarm it darts out with its mouth open, a
//     flash where it takes, and has one fish of that swarm; then it is back on the flank. A dash, or a coil round nothing, shakes it off, and it
//     swims home to its rod, back in its own colours. One rider at a time; it leaves by itself, sated or bored. Its numbers are chosen so that
//     going by the reef is a choice: a rider can be outswum (it does not try for a body sprinting past, and gives up after `give` seconds), shaken off for a dash or a
//     second's coil, or carried, at the price of one fish a catch and two at most. The decisions are in PROGRESS.md.
//   THE CORAL THAT GROWS. For every goal of a mural the player wins (a carving: the band's greatest swarm, a cache, a keeper; in any band, in any
//     dive), one more coral takes on the next bare spot of world.quiet.reef.grow, and stays: the count is kept in the nest's record
//     (localStorage['oarfish.nest'].reef), and "Empty the nest" clears it. A coral earned in a dive is seen growing in the next time the fish comes
//     to the reef, in a later dive. It does nothing; it shows what the player has done. Drawn as one instanced piece for each kind of coral.
import * as THREE from 'three';
import { make, geometry, tonesOf, swarmKit } from './npc.js';
import { growing } from './kit.js';
import { CLEAN } from './world.js';
import { clamp, lerp, damp, glowTexture } from './geo.js';

// ---------------------------------------------------------------- every number, in one place
export const REEF = {
  // the station. reach, still, time, uses, rest and fish are the deeper bands' own (CLEAN in world.js), so that a station is a station; see: how near the
  // head comes before its ring shows (and the one line is said); mound: the scale of the brain coral it is; lit: how much it glows
  station: { reach: CLEAN.reach, still: CLEAN.still, time: CLEAN.time, uses: CLEAN.uses, rest: CLEAN.rest, fish: CLEAN.fish, see: 12, mound: 0.85, lit: 0.12 },
  // the trumpetfish. n: how many hang (one to a rod, at most this many); high: how far over the bed their middles hang; scale: of the model (which is
  // already 1.4 times the real one, trumpet.js); hang: how far head down it hangs (radians; straight down would be a dot from the camera); join: how near (metres) the nearest part of a swimming body (faster than `moving` m/s) has to pass;
  // fast: a body going faster than this (a sprint) it does not try for, and gives up on; chase: how fast it can go to catch up, and give: how long it tries before it gives up; slot: how far back along the body it rides (of the body),
  // side: how far off the body's line, up: how far over it; stay: seconds it rides before it leaves on its own; reach: how near a swarm has to be for
  // it to strike, and at: how far round the loop has to have gone (of a closed loop); takes: fish a strike; spare: it never takes a swarm below this many;
  // most: strikes before it is sated and goes home; coil: seconds of coiling round nothing that shake it off; again: seconds before any of them will
  // ride again after one has been shaken off or has left; home: its swimming speed back to its rod; lost: farther than this from the body on the way
  // home, and out of sight, it is simply home
  trumpet: { n: 3, high: [1.6, 2.2], scale: 1.2, hang: 0.95, join: 3, moving: 1, fast: 4.2, chase: 5.5, give: 4, slot: 0.36, side: 0.6, up: 0.18, stay: 60, reach: 9, at: 0.5,
    takes: 1, spare: 2, most: 2, coil: 1, again: 20, home: 2.2, lost: 40,
    strike: { stalk: 0.3, dart: 0.25, back: 0.45 }, flash: { size: 2.4, life: 0.55, colour: '#fff0a0' }, fling: 3.5 },
  // the coral that grows. kinds: what may grow (a component's model and tints, as the band's own corals are scattered); see: how near the fish has to
  // come to the reef's middle before the new ones grow in; time: seconds each takes to grow, gap: between one starting and the next; size: of each
  // kind, least and most; bits: how many small pieces stand round the main one at a spot, and how big
  coral: { kinds: ['staghorn', 'tablecoral', 'braincoral', 'seafan', 'sponge'], see: 30, time: 3.5, gap: 0.8,
    size: { staghorn: [1.7, 2.3], tablecoral: [1.5, 1.9], braincoral: [1.0, 1.3], seafan: [1.8, 2.4], sponge: [1.3, 1.7] }, bits: { n: 2, size: 0.55, out: 0.75 } },
};

const TAU = Math.PI * 2;
const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); }; // the same spot looks the same every dive, and draws no number from any run
const ease = (t) => t * t * (3 - 2 * t);

// The nest's record of the reef: { grown: goals won, ever; seen: how many of them the fish has seen grow }.
const record = (nest) => { const r = nest.reef || {}; return { grown: r.grown | 0, seen: Math.min(r.seen | 0, r.grown | 0) }; };

// world: the band being dived. hooks: { rig, playing(), safe(), lost() (segments short of this dive's longest), mend() (grow one back), say(id, text),
// moment(kind, v), gulp(i, n, v), nest (the nest's record, kept by main.js), keep() (write it) }
export function createReef(scene, world, hooks) {
  const rig = hooks.rig, T = world.size, plan = world.quiet?.reef || null;
  const state = { t: 0, rider: null, again: 0, took: 0, shaken: 0, joined: 0, strikes: 0, mended: 0, grown: 0 };
  // The goals of the mural, in every band: the world says when one is won (world.react.earn answers true the first time); the reef counts it
  if (world.react?.earn && !world.react.earn.reef) { const earn = world.react.earn;
    world.react.earn = Object.assign((kind) => { const won = earn(kind); if (won) { const r = record(hooks.nest); hooks.nest.reef = { ...r, grown: r.grown + 1 }; hooks.keep(); state.grown++; } return won; }, { reef: true }); }
  // and when the world goes, so does what lives in it (main.js disposes the world; nothing more there has to know about the reef)
  const owned = [], add = (o) => { scene.add(o); owned.push(o); return o; };
  let gone = false; const dispose = () => { if (gone) return; gone = true; for (const o of owned) { if (o.isObject3D) { scene.remove(o); if (o.isInstancedMesh) o.dispose(); } else o.dispose?.(); } for (const f of fish) { scene.remove(f.a.object); f.a.dispose(); } };
  const was = world.dispose; world.dispose = (...a) => { dispose(); return was.apply(world, a); };
  const fish = [];
  if (!plan) return { update() {}, dispose, plan, state, fish, debug: {} };

  const off = { x: 0, z: 0 }, C = plan.station, S = REEF.station, TR = REEF.trumpet, CO = REEF.coral;
  const glow = glowTexture(); owned.push(glow);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ'), v3 = new THREE.Vector3(), s3 = new THREE.Vector3(), w3 = new THREE.Vector3();

  // ---- the station: a brain coral in the clear middle with two sponges at its foot, six cleaners over it, a ring that fills as they work
  const st = { x: C.x, z: C.z, y: world.drawn(C.x, C.z), k: 0, uses: S.uses, rest: 0, live: false, near: false, open: false, away: 1, told: false };
  st.top = st.y + 1.1 * S.mound;
  { const g = add(new THREE.Group()), coral = tonesOf('braincoral'), tube = tonesOf('sponge');
    const part = (id, color, x, y, z, s) => { const m = new THREE.Mesh(geometry(id), new THREE.MeshLambertMaterial({ color, vertexColors: true, emissive: color, emissiveIntensity: S.lit })); owned.push(m.material); m.position.set(x, y, z); m.scale.setScalar(s); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
    part('braincoral', coral[0], 0, -0.05, 0, S.mound * 1.25); part('braincoral', coral[3 % coral.length], -0.9, -0.05, 0.55, S.mound * 0.55);
    part('sponge', tube[0], 0.95, -0.05, 0.5, 0.8); part('sponge', tube[2 % tube.length], 0.7, -0.05, -0.95, 0.6);
    g.position.set(C.x, st.y, C.z); g.rotation.y = plan.facing; st.mesh = g; }
  const ringGeo = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 49 }, (_, i) => new THREE.Vector3(Math.sin((i / 48) * TAU), 0, Math.cos((i / 48) * TAU)))), arcGeo = ringGeo.clone(); owned.push(ringGeo, arcGeo);
  const ringMat = new THREE.LineBasicMaterial({ color: '#dffcff', transparent: true, opacity: 0.45, depthWrite: false }), arcMat = new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95, depthWrite: false }); owned.push(ringMat, arcMat);
  const ring = add(new THREE.Line(ringGeo, ringMat)), arc = add(new THREE.Line(arcGeo, arcMat)); ring.visible = arc.visible = false; ring.frustumCulled = arc.frustumCulled = false;
  const cleanKit = swarmKit('cleaner', { glow: 0.2 }), cleanMat = cleanKit.material; owned.push({ dispose: () => cleanKit.dispose() });
  const cleaners = add(new THREE.InstancedMesh(cleanKit.geometry, cleanMat, S.fish)); cleaners.frustumCulled = false; cleaners.castShadow = true;
  const cfish = Array.from({ length: S.fish }, (_, i) => ({ p: new THREE.Vector3(C.x, st.top + 0.5, C.z), v: new THREE.Vector3(), ph: i * 1.9, slot: 0.08 + 0.84 * ((i * 0.618) % 1), side: i % 2 ? 1 : -1, yaw: i, pitch: 0 }));

  function station(dt, head, J, t) {
    const cx = st.x + off.x, cz = st.z + off.z, short = hooks.lost(), playing = hooks.playing();
    st.rest = Math.max(0, st.rest - dt);
    st.open = st.uses > 0 && st.rest <= 0 && short > 0 && playing; // something to mend, and the cleaners free to mend it
    const d = Math.hypot(head.x - cx, head.z - cz), over = st.open && d < S.reach && head.y > st.top - 0.3 && head.y < st.top + 4.5, still = over && rig.speed < S.still, was = st.k;
    st.near = st.open && d < S.see;
    if (st.near && !st.told) { st.told = true; hooks.say('reefclean', 'Hold still over the cleaners. They mend what you have lost.'); }
    if (still) { st.k = Math.min(1, st.k + dt / S.time); if (!st.live && st.k > 0.1) { st.live = true; hooks.moment('loop'); } }
    else { st.k = Math.max(0, st.k - dt / (over ? 3.5 : 1.2)); if (st.live && st.k <= 0) { st.live = false; hooks.moment('flit'); } } // a head that stirs loses ground slowly; one that leaves, fast
    const step = (k) => Math.floor(k * 6); if (still && step(st.k) > step(was) && st.k < 1) hooks.gulp(step(st.k), 7, 0.6);
    if (st.k >= 1) { st.k = 0; st.live = false; st.uses--; st.rest = S.rest; state.mended++; hooks.mend(); }
    ring.visible = st.near; arc.visible = st.near && st.k > 0.01;
    if (st.near) { ring.position.set(cx, st.top + 0.5, cz); ring.scale.setScalar(S.reach); arc.position.set(cx, st.top + 0.51, cz); arc.scale.setScalar(S.reach); arcGeo.setDrawRange(0, Math.max(2, Math.round(st.k * 48) + 1)); }
    st.mesh.position.set(cx, st.y, cz);
    // the cleaners: turning over the coral; along the body while they work; down in the coral while the station rests or is spent
    st.away = damp(st.away, st.uses > 0 && st.rest <= 0 ? 0 : 1, 2.5, dt); let swum = 0;
    cfish.forEach((f, i) => { let tx, ty, tz, top;
      if (st.k > 0.03 && J) { const N = J.length - 1, along = (f.slot + 0.22 * Math.sin(t * 0.7 + f.ph)) * N, j = clamp(Math.round(along), 1, N - 1), c = J[j];
        v3.subVectors(J[j - 1], J[j + 1]); v3.y = 0; if (v3.lengthSq() < 1e-6) v3.set(0, 0, 1); v3.normalize();
        const out = 0.2 + 0.06 * Math.sin(t * 3.1 + f.ph); tx = c.x + v3.z * f.side * out; tz = c.z - v3.x * f.side * out; ty = c.y + 0.1 * Math.sin(t * 2.3 + f.ph * 2); top = 3.6; }
      else { const r = 0.55 + 0.45 * Math.sin(t * 0.37 + f.ph * 3) ** 2, a = t * 0.9 * f.side + f.ph; tx = cx + Math.sin(a) * r; tz = cz + Math.cos(a) * r; ty = st.top + 0.35 + 0.3 * Math.sin(t * 1.3 + f.ph) - 0.9 * st.away; top = 1.6; }
      if (f.p.distanceToSquared(v3.set(tx, ty, tz)) > 900) f.p.set(tx, ty, tz); // the world came round
      w3.set(tx - f.p.x, ty - f.p.y, tz - f.p.z); const dd = w3.length(); if (dd > 1e-4) w3.multiplyScalar(Math.min(top, dd * 4) / dd);
      f.v.lerp(w3, 1 - Math.exp(-6 * dt)); f.p.addScaledVector(f.v, dt);
      const sp = f.v.length(); swum += sp; let yaw = f.yaw, pitch = 0;
      if (sp > 0.15) { yaw = Math.atan2(f.v.x, f.v.z); pitch = -Math.asin(clamp(f.v.y / sp, -0.6, 0.6)); }
      const k = dt > 0 ? 1 - Math.exp(-9 * dt) : 1; f.yaw += wrapPi(yaw - f.yaw) * k; f.pitch += (pitch - f.pitch) * k;
      cleaners.setMatrixAt(i, m4.compose(f.p, q.setFromEuler(e.set(f.pitch, f.yaw, 0)), s3.setScalar(cleanKit.scale * (1 - 0.85 * st.away)))); });
    cleaners.instanceMatrix.needsUpdate = true; cleanMat.userData.swim.value += dt * (cleanKit.spec.beat[0] + cleanKit.spec.beat[1] * (swum / S.fish));
  }

  // ---- the trumpetfish: one by each of the first few rods, hanging head down
  // the rods nearest the way in from the arch to the station: they are met on arrival, so going by them close or round them wide is the player's to choose
  const G = plan.gate, gx = C.x - G.x, gz = C.z - G.z, gl = gx * gx + gz * gz || 1, wayD = (r) => { const t = clamp(((r.x - G.x) * gx + (r.z - G.z) * gz) / gl, 0, 1); return Math.hypot(r.x - G.x - gx * t, r.z - G.z - gz * t); };
  [...plan.rods].sort((a, b) => wayD(a) - wayD(b)).slice(0, TR.n).forEach((rod, i) => { const a = make('trumpet'); a.object.scale.multiplyScalar(TR.scale); scene.add(a.object);
    a.object.traverse((o) => { if (o.isMesh && o !== a.body) o.castShadow = false; }); // only the body casts: fourteen small pieces to a fish were as many shadows to draw
    const toMid = Math.atan2(C.x - rod.x, C.z - rod.z), hx = rod.x + Math.sin(toMid) * 0.55, hz = rod.z + Math.cos(toMid) * 0.55, hy = world.drawn(hx, hz) + lerp(TR.high[0], TR.high[1], hash(rod.x, rod.z));
    fish.push({ a, i, home: new THREE.Vector3(hx, hy, hz), homeYaw: toMid + Math.PI * 0.5, pos: new THREE.Vector3(hx, hy, hz), vel: new THREE.Vector3(), yaw: toMid + Math.PI * 0.5, pitch: TR.hang, roll: 0, curve: 0, phase: 0,
      mood: 'hang', do: 'hang', t: 0, side: 1, took: 0, coil: 0, sc: null, struck: new Set(), ph: i * 2.1 }); });
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: TR.flash.colour, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); owned.push(flash.material); add(flash); flash.visible = false;
  let flashT = 9;
  const D = new THREE.Vector3(), Nv = new THREE.Vector3(), want = new THREE.Vector3();
  // where a rider lies along the body, in the fish's own copy of the band (everything here is kept in the first copy, as the bloom is)
  function slot(f, J) { const n = J.length, i = clamp(Math.round(n * TR.slot), 3, n - 4);
    D.subVectors(J[i - 2], J[i + 2]).setY(0); if (D.lengthSq() < 1e-6) D.set(0, 0, 1); D.normalize(); Nv.set(D.z, 0, -D.x).multiplyScalar(f.side);
    want.copy(J[i]).addScaledVector(Nv, TR.side).addScaledVector(D, 0.1); want.x -= off.x; want.z -= off.z; want.y += TR.up;
    const a1 = Math.atan2(J[i - 3].x - J[i].x, J[i - 3].z - J[i].z), a2 = Math.atan2(J[i].x - J[i + 3].x, J[i].z - J[i + 3].z);
    return { yaw: Math.atan2(D.x, D.z), curve: clamp(wrapPi(a1 - a2) * 0.5, -0.4, 0.4) }; }
  function letGo(f, how) { // shaken off, or done: it goes home, in its own colours again
    if (state.rider === f) state.rider = null; state.again = TR.again; f.do = how === 'shaken' ? 'flung' : 'home'; f.t = 0; f.sc = null; f.coil = 0;
    if (how === 'shaken') { state.shaken++; f.vel.copy(Nv.set(Math.cos(f.yaw), 0, -Math.sin(f.yaw))).multiplyScalar(f.side * TR.fling); f.vel.y = 0.6; hooks.moment('burst'); } }
  function trumpets(dt, J, t) {
    const moving = rig.speed > TR.moving && rig.speed < TR.fast, loops = world.schools.some((sc) => sc.left > 0 && sc.progress > 0.05);
    state.again = Math.max(0, state.again - dt);
    for (const f of fish) {
      f.t += dt; let mood = 'hang', yaw = f.yaw, pitch = TR.hang, roll = 0.05 * Math.sin(t * 0.4 + f.ph), curve = 0, phase = 0, rate = 4;
      const near = Math.hypot(f.pos.x + off.x - rig.pos.x, f.pos.z + off.z - rig.pos.z);
      if (f.do === 'hang') { // head down by its rod, turning a little with the water; a body swimming by close enough, and it goes
        f.pos.lerp(want.copy(f.home).setY(f.home.y + 0.08 * Math.sin(t * 0.6 + f.ph)), 1 - Math.exp(-dt)); yaw = f.homeYaw + 0.35 * Math.sin(t * 0.13 + f.ph);
        if (!state.rider && state.again <= 0 && moving && hooks.playing() && near < 40) { let d = Infinity, side = 1;
          for (const j of J) { const dd = Math.hypot(j.x - off.x - f.pos.x, j.z - off.z - f.pos.z); if (dd < d) d = dd; }
          if (d < TR.join) { const fw = rig.forward; side = Math.sign((f.pos.x + off.x - rig.pos.x) * fw.z - (f.pos.z + off.z - rig.pos.z) * fw.x) || 1;
            state.rider = f; f.do = 'join'; f.t = 0; f.side = side; f.took = 0; f.struck.clear(); state.joined++; } } }
      if (f.do === 'join' || f.do === 'ride' || f.do === 'strike') { // after the body, along its flank, and out of it at a swarm
        const sl = slot(f, J);
        if (rig.dashT > 0) letGo(f, 'shaken');
        else { f.coil = rig.coiling > 0.85 && !loops ? f.coil + dt : 0; if (f.coil > TR.coil) letGo(f, 'shaken'); }
        if (f.do === 'join') { mood = 'swim'; pitch = 0; phase = 1; yaw = Math.atan2(want.x - f.pos.x, want.z - f.pos.z);
          D.subVectors(want, f.pos); const d = D.length(); if (d > 1e-4) f.pos.addScaledVector(D, Math.min(1, (TR.chase * dt) / d));
          if (d < 0.45) { f.do = 'ride'; f.t = 0; } else if (f.t > TR.give || rig.speed > TR.fast) letGo(f, 'home'); } // outswum: a poor swimmer, it gives up
        else if (f.do === 'ride') { mood = 'shadow'; pitch = -0.05; phase = 1; yaw = sl.yaw; curve = sl.curve; roll = -0.3 * f.side; rate = 10; f.pos.lerp(want, 1 - Math.exp(-rate * dt));
          if (f.t > TR.stay) letGo(f, 'home'); // bored: it leaves on its own
          else for (const sc of world.schools) { if (sc.left <= TR.spare || !sc.can || sc.progress < TR.at || f.struck.has(sc)) continue;
            if (Math.hypot(sc.x - off.x - f.pos.x, sc.z - off.z - f.pos.z) > TR.reach) continue;
            f.do = 'strike'; f.t = 0; f.sc = sc; f.struck.add(sc); break; } }
        if (f.do === 'strike') { const K = TR.strike, sc = f.sc, sx = sc.x - off.x, sz = sc.z - off.z; phase = 1;
          if (f.t < K.stalk) { mood = 'stalk'; yaw = Math.atan2(sx - f.pos.x, sz - f.pos.z); pitch = 0.12; f.pos.lerp(want, 1 - Math.exp(-8 * dt)); }
          else if (f.t < K.stalk + K.dart) { mood = 'strike'; yaw = Math.atan2(sx - f.pos.x, sz - f.pos.z); pitch = 0.08; f.pos.lerp(v3.set(sx, sc.y, sz), 1 - Math.exp(-14 * dt));
            if (!f.hit && f.t > K.stalk + K.dart * 0.6) { f.hit = true; const p = world.nibble(sc, f.pos.x + off.x, f.pos.z + off.z); // it takes one (TR.takes at a time) from that swarm
              for (let k = 1; k < TR.takes && sc.left > TR.spare; k++) world.nibble(sc, f.pos.x + off.x, f.pos.z + off.z);
              if (p) { flash.position.copy(p); flashT = 0; state.took += TR.takes; state.strikes++; f.took++; hooks.moment('flit'); } } }
          else { mood = f.t < K.stalk + K.dart + 0.15 ? 'strike' : 'shadow'; yaw = sl.yaw; curve = sl.curve; f.pos.lerp(want, 1 - Math.exp(-8 * dt));
            if (f.t > K.stalk + K.dart + K.back) { f.hit = false; f.do = 'ride'; if (f.took >= TR.most) letGo(f, 'home'); } } } }
      else if (f.do === 'flung') { mood = 'swim'; pitch = 0; f.pos.addScaledVector(f.vel, dt); f.vel.multiplyScalar(Math.exp(-2.5 * dt)); if (f.t > 0.9) { f.do = 'home'; f.t = 0; } }
      else if (f.do === 'home') { mood = 'swim'; pitch = 0.05; D.subVectors(f.home, f.pos); const d = D.length();
        if (d > TR.lost && near > TR.lost) { f.pos.copy(f.home); f.do = 'hang'; } // out of sight: it is home
        else if (d < 0.4) { f.do = 'hang'; f.t = 0; } else { f.pos.addScaledVector(D, Math.min(1, (TR.home * dt) / d)); yaw = Math.atan2(D.x, D.z); } }
      f.yaw += clamp(wrapPi(yaw - f.yaw), -3.5 * dt, 3.5 * dt); if (f.do === 'strike' || f.do === 'ride') f.yaw = damp(f.yaw, f.yaw + wrapPi(yaw - f.yaw), 12, dt);
      f.pitch = damp(f.pitch, pitch, 3, dt); f.roll = damp(f.roll, roll, 4, dt); f.curve = damp(f.curve, curve, 6, dt); f.mood = mood; f.phase = phase;
      const shown = near < 70; f.a.object.visible = shown;
      if (shown) f.a.rig.update(dt, { x: f.pos.x + off.x, y: f.pos.y, z: f.pos.z + off.z, yaw: f.yaw, pitch: f.pitch, roll: f.roll, mood, curve: f.curve, phase }); }
    flashT += dt; const fl = REEF.trumpet.flash, k = flashT / fl.life; flash.visible = k < 1; if (k < 1) { flash.material.opacity = 0.95 * (1 - k); flash.scale.setScalar(fl.size * (0.6 + 0.6 * Math.sqrt(k))); }
  }

  // ---- the coral that has grown: one instanced piece for each kind, tinted per coral, as the band's own corals are
  const spots = plan.grow, rec = record(hooks.nest), have = Math.min(rec.grown, spots.length);
  const coralMat = growing({ sway: 0.25, double: true }, world.time); owned.push(coralMat);
  const meshes = Object.fromEntries(CO.kinds.map((id) => { const m = add(new THREE.InstancedMesh(geometry(id), coralMat, spots.length * (1 + CO.bits.n))); m.count = 0; m.castShadow = m.receiveShadow = true; m.frustumCulled = false; return [id, m]; }));
  const pieces = []; // { mesh, slot, x, y, z, yaw, s, colour, spot }
  const pale = new THREE.Color('#fff4dc'), tint = new THREE.Color();
  for (let i = 0; i < have; i++) { const g = spots[i], h = (k) => hash(g.x + k * 3.1, g.z - k * 1.7), kinds = CO.kinds;
    const lay = (id, x, z, s, k) => { const m = meshes[id], tones = tonesOf(id); pieces.push({ m, slot: m.count++, x, y: world.drawn(x, z) - 0.06 * s, z, yaw: h(k) * TAU, s, colour: new THREE.Color(tones[Math.floor(h(k + 5) * tones.length) % tones.length]), spot: i }); };
    const main = kinds[(i * 2 + Math.floor(h(0) * 2)) % kinds.length], [s0, s1] = CO.size[main]; lay(main, g.x, g.z, lerp(s0, s1, h(1)), 2);
    for (let b = 0; b < CO.bits.n; b++) { const a = h(10 + b) * TAU, id = kinds[(i + b + 1) % kinds.length], [b0, b1] = CO.size[id]; lay(id, g.x + Math.sin(a) * CO.bits.out, g.z + Math.cos(a) * CO.bits.out, lerp(b0, b1, h(20 + b)) * CO.bits.size, 30 + b); } }
  const grow = { start: rec.seen, at: -1, have }; // the ones from `start` on grow in, one after another, when the fish comes
  const grownBy = (p, t) => p.spot < grow.start ? 1 : grow.at < 0 ? 0 : clamp((t - grow.at - (p.spot - grow.start) * CO.gap) / CO.time, 0, 1);
  function corals(head, t) {
    if (grow.at < 0 && grow.start < have && Math.hypot(head.x - off.x - plan.x, head.z - off.z - plan.z) < CO.see) { grow.at = t; const r = record(hooks.nest); hooks.nest.reef = { ...r, seen: Math.max(r.seen, have) }; hooks.keep(); } // seen: it will not grow in again
    for (const p of pieces) { const k = grownBy(p, t), s = p.s * (k <= 0 ? 0 : ease(k) * (1 + 0.12 * Math.sin(Math.PI * k)));
      p.m.setMatrixAt(p.slot, m4.compose(v3.set(p.x + off.x, p.y, p.z + off.z), q.setFromEuler(e.set(0, p.yaw, 0)), s3.setScalar(Math.max(s, 1e-4))));
      p.m.setColorAt(p.slot, tint.copy(pale).lerp(p.colour, ease(clamp(k * 1.6 - 0.4, 0, 1)))); }
    for (const m of Object.values(meshes)) { m.visible = m.count > 0; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  }

  const head = new THREE.Vector3();
  function update(dt) {
    state.t += dt; const t = state.t;
    off.x = T * Math.round((rig.pos.x - plan.x) / T); off.z = T * Math.round((rig.pos.z - plan.z) / T);
    head.copy(rig.snout); const J = rig.joints;
    station(dt, head, J, t);
    trumpets(dt, J, t);
    corals(head, t);
  }
  // for the checks and the pictures
  const debug = { st, ring, arc, cleaners, meshes, pieces, grow, flash, off, grownBy: (p) => grownBy(p, state.t) };
  return { update, dispose, plan, state, fish, debug, get rider() { return state.rider; } };
}
