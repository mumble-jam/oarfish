// The Sum: everything the Long Ones ever paid, joined into one body. It lies as the ring wall of the palace
// hall, its head and its tail almost meeting behind the gate. Awake, it hunts the way the player does, by
// closing a loop. It collects shed tails, because collecting them is all it knows, and adds each one to the
// gap between its tail and its head.
//
// Everything here is worked out in the hall's own frame: the origin is the hall's centre, and `root` puts
// the whole thing on whichever copy of the repeating world is nearest the fish.

import * as THREE from 'three';
import { buildOarfish } from './oarfish.js';
import { NPC, geometry, paintOf, resolve } from './npc.js';
import { canWrap } from './world.js';
import { rng, lerp, clamp, damp, soup, M, glowTexture, windingNumber } from './geo.js';

const SEG = 0.72; // metres of body to one segment of the wall
const HEAD = 2.3; // metres from the neck joint to the first segment
const DS = 0.3; // spacing of the samples of the path the head has swum
const MAX_OUT = 86; // how much body may leave the wall, in metres
export const FILLS = 4; // shed tails it takes to close the gap
const ROOM = 1.24; // the clear radius a loop round the head needs. It takes 22 segments, after the three a decoy costs: the longest body the game asks for
const LOOP_R = 4.6; // radius of the loop it closes round the fish
const TAKE = 9; // seconds the head stays down over a shed tail
const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const smooth = (k) => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };

export function createSum(scene, world, { seed = 1 } = {}, game) {
  const hall = world.hall, R = hall.R, GAP = hall.gapHalf, CIRC = Math.PI * 2 * R, T = world.size, wrapD = world.wrap; // T, wrapD: how far across this world is, and the shortest way round it
  const rand = rng(seed * 31 + 977), rr = (a, b) => a + (b - a) * rand();
  const ground = (x, z) => world.height(hall.x + x, hall.z + z);
  const root = new THREE.Group();
  scene.add(root);
  const trash = [];
  const keep = (o) => { trash.push(o); return o; };

  // ------------------------------------------------------------ the body: one instanced slab per segment
  const N = Math.floor((CIRC - 2 * GAP) / SEG); // the body as it lies
  const EXTRA = Math.round((2 * GAP - HEAD - 1.5) / SEG); // segments that close the gap, grown from shed tails
  const TOTAL = N + EXTRA;
  const segs = [];
  for (let i = 0; i < TOTAL; i++) {
    const own = i >= N, k = smooth(i / 18); // slim behind the head, full height by the eighteenth segment
    const era = clamp(Math.floor((1 - i / N) * 5) + (rand() < 0.2 ? (rand() < 0.5 ? -1 : 1) : 0), 0, 4); // the last payments lie nearest the head
    segs.push({ thick: own ? rr(1.0, 1.3) : lerp(0.82, rr(1.15, 1.75), k), tall: own ? rr(2.2, 2.9) : lerp(1.3, rr(2.6, 4.3), k), colour: own ? resolve('sum').palette.own : paintOf(era), n: rand(), ph: rand() * 6.28 });
  }
  // a tall six-sided slab, pointed above and below like a ribbon fish in section, with a low ridge along the back
  const segGeo = geometry('sum'), flank = keep(NPC.sum.flank()); // the length of body and what it is made of are its component's
  const body = new THREE.InstancedMesh(segGeo, flank, TOTAL);
  body.frustumCulled = false;
  { const c = new THREE.Color(); segs.forEach((s, i) => body.setColorAt(i, c.set(s.colour))); }
  root.add(body);
  trash.push({ dispose: () => body.dispose() });

  // ------------------------------------------------------------ the head: a small one, with a crest like the player's
  const BONE = 0.312 * (1.25 / 0.4);
  const model = buildOarfish({ seed: 11, scale: 1.25, bones: 4, merge: true, clip: false });
  model.mesh.frustumCulled = false;
  for (const m of [].concat(model.mesh.material)) { m.emissive.copy(m.color); m.emissiveIntensity = /Fin|Eye/.test(m.name) ? 0.55 : 0.1; trash.push(m); }
  trash.push(model.mesh.geometry, { dispose: () => model.skeleton.dispose() });
  root.add(model.group);
  const spine = model.skeleton.bones.filter((b) => /^spine_/.test(b.name));
  const glowMap = keep(glowTexture());
  const sprite = (color, size) => { const s = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: glowMap, color, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true, opacity: 0 }))); s.scale.setScalar(size); root.add(s); return s; };
  const eye = sprite('#ffd9a0', 2.6);
  const lamp = new THREE.PointLight('#ffd9a0', 0, 18, 1.1);
  root.add(lamp);

  // ------------------------------------------------------------ what is still lodged in the flank: old lines, old lures
  const lineGeo = keep(new THREE.BoxGeometry(0.04, 1, 0.04).translate(0, 0.5, 0));
  const lineMat = keep(new THREE.MeshBasicMaterial({ color: '#cfe3ea', transparent: true, opacity: 0.55 }));
  const lines = [], lures = [];
  for (let k = 0; k < 7; k++) { // well back along the body, where it never leaves the wall
    const mesh = new THREE.Mesh(lineGeo, lineMat);
    mesh.frustumCulled = false; root.add(mesh);
    lines.push({ i: Math.floor(N * (0.7 + 0.04 * k) + rr(0, 3)), mesh, slack: 0, side: rand() < 0.5 ? -1 : 1 });
  }
  for (let k = 0; k < 6; k++) lures.push({ i: Math.floor(N * (0.22 + 0.13 * k) + rr(0, 6)), sprite: sprite('#ffcf8a', 1.5), ph: rand() * 6.28 });

  // the faint ring and bright arc shown round the head while it can be ringed, as round a swarm
  const circle = Array.from({ length: 49 }, (_, i) => new THREE.Vector3(Math.sin((i / 48) * Math.PI * 2), 0, Math.cos((i / 48) * Math.PI * 2)));
  const ringGeo = keep(new THREE.BufferGeometry().setFromPoints(circle)), arcGeo = keep(ringGeo.clone());
  const lineOf = (color, opacity) => keep(new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false, fog: false }));
  const ringYes = lineOf('#f2faf7', 0.4), ringNo = lineOf('#ff7f96', 0.55), arcYes = lineOf('#ffffff', 0.95), arcNo = lineOf('#ff7f96', 0.9);
  const ringLine = new THREE.Line(ringGeo, ringYes), arcLine = new THREE.Line(arcGeo, arcYes);
  for (const o of [ringLine, arcLine]) { o.frustumCulled = false; o.visible = false; root.add(o); }

  // ------------------------------------------------------------ the path of the head, and the body laid along it
  const CAP = 512, tx = new Float32Array(CAP), ty = new Float32Array(CAP), tz = new Float32Array(CAP);
  const hp = new THREE.Vector3(), home = new THREE.Vector3(), cen = new THREE.Vector3(), mouth = new THREE.Vector3();
  const onRing = (a, out) => { const f = hall.phi + a / R; return out.set(Math.sin(f) * R, 0, Math.cos(f) * R); };
  onRing(GAP, home); home.y = ground(home.x, home.z) + 0.8;
  const homeYaw = (() => { const f = hall.phi + GAP / R; return Math.atan2(-Math.cos(f), Math.sin(f)); })(); // along the wall, into the gap
  let count = 1, len = 0, yaw = homeYaw, pitch = 0, onWall = 1;
  hp.copy(home); tx[0] = home.x; ty[0] = home.y; tz[0] = home.z;

  // a point u metres behind the neck along the body. Sets onWall: 1 where the body still lies on the ring
  function curve(u, out) {
    if (u < len) {
      const q = len - u, base = (count - 1) * DS;
      if (q >= base) { const f = (q - base) / Math.max(len - base, 1e-4), i = count - 1; out.set(lerp(tx[i], hp.x, f), lerp(ty[i], hp.y, f), lerp(tz[i], hp.z, f)); }
      else { const i = Math.floor(q / DS), f = q / DS - i; out.set(lerp(tx[i], tx[i + 1], f), lerp(ty[i], ty[i + 1], f), lerp(tz[i], tz[i + 1], f)); }
      onWall = 1 - smooth(q / 7);
    } else { onRing(GAP + u - len, out); onWall = 1; }
    return out;
  }
  function extend() { // lay down samples behind the moving head
    for (;;) {
      const i = count - 1, d = Math.hypot(hp.x - tx[i], hp.y - ty[i], hp.z - tz[i]);
      if (d < DS || count >= CAP - 1) { len = i * DS + Math.min(d, DS); return; }
      const f = DS / d;
      tx[count] = lerp(tx[i], hp.x, f); ty[count] = lerp(ty[i], hp.y, f); tz[count] = lerp(tz[i], hp.z, f); count++;
    }
  }
  function advance(dt, ax, ay, az, speed, turn) {
    yaw += clamp(wrapPi(Math.atan2(ax - hp.x, az - hp.z) - yaw), -turn * dt, turn * dt);
    hp.x += Math.sin(yaw) * speed * dt; hp.z += Math.cos(yaw) * speed * dt;
    const y0 = hp.y;
    hp.y = Math.max(damp(hp.y, ay, 2.4, dt), ground(hp.x, hp.z) + 0.8);
    pitch = damp(pitch, Math.atan2(hp.y - y0, Math.max(speed * dt, 1e-4)), 6, dt);
    extend();
  }
  function retract(dt, speed) { // back along its own path, like an eel into its hole
    const old = len, base = (count - 1) * DS;
    len = Math.max(0, old - speed * dt);
    if (len >= base) { const f = (len - base) / Math.max(old - base, 1e-4), i = count - 1; hp.set(lerp(tx[i], hp.x, f), lerp(ty[i], hp.y, f), lerp(tz[i], hp.z, f)); }
    else {
      const i = Math.floor(len / DS), f = len / DS - i;
      hp.set(lerp(tx[i], tx[i + 1], f), lerp(ty[i], ty[i + 1], f), lerp(tz[i], tz[i + 1], f));
      count = i + 1;
      const dx = tx[i + 1] - tx[i], dy = ty[i + 1] - ty[i], dz = tz[i + 1] - tz[i], h = Math.hypot(dx, dz);
      if (h > 0.05) yaw += clamp(wrapPi(Math.atan2(dx, dz) - yaw), -4 * dt, 4 * dt);
      pitch = damp(pitch, Math.atan2(dy, Math.max(h, 0.05)), 6, dt);
    }
    if (len <= 0) { hp.copy(home); count = 1; yaw = homeYaw; pitch = 0; }
  }

  // ------------------------------------------------------------ what it is doing
  const S = {
    state: 'asleep', t: 0, awake: false, cool: 0, fill: 0, grown: 0, closing: false, carry: 0,
    spin: 1, sweep: 0, loopFrom: 0, beta: 0, danger: 0, pulse: 0, lift: 0, slack: 0, lit: 0, loops: 0, taken: 0,
    piece: null, ring: null,
  };
  const P = new Float32Array(TOTAL * 3).fill(-999); // where each segment is, for collisions
  // the head as something to ring, shaped like a swarm so the same wrap rule and assist apply; main.js fills in the progress
  const target = { x: 0, y: 0, z: 0, room: ROOM, orbit: ROOM + 0.45, fit: ROOM, can: false, left: 1, threat: 1, progress: 0, arcStart: 0, arcSign: 1, sweep: 1 };
  let decoy = null, poly = new Float32Array(CAP * 2 + 2);
  const set = (state) => { S.state = state; S.t = 0; };
  function wake() {
    if (S.awake) return;
    S.awake = true; S.pulse = 1; set('wake');
    game.event('wake');
  }
  function addPiece() {
    if (S.fill >= FILLS) return;
    S.fill++; S.pulse = 1;
    wake();
    game.event('fill');
    if (S.fill >= FILLS) S.closing = true;
  }
  const ringed = () => { if (S.state !== 'slack') { set('slack'); S.ring = null; } };

  function closeLoop(ctx, px, py, pz) {
    const i0 = Math.max(0, Math.floor(S.loopFrom / DS));
    let n = 0;
    for (let i = i0; i < count; i++) { poly[n * 2] = tx[i]; poly[n * 2 + 1] = tz[i]; n++; }
    poly[n * 2] = hp.x; poly[n * 2 + 1] = hp.z; n++;
    const level = (y) => Math.abs(y - hp.y) < 2.3; // a fish that went over or under the loop is out of it
    const head = level(py) && windingNumber(poly, n, px, pz) !== 0;
    let tail = 0;
    for (const j of ctx.joints) if (level(j.y) && windingNumber(poly, n, wrapD(j.x - hall.x), wrapD(j.z - hall.z)) !== 0) tail++;
    S.loops++;
    const took = head ? game.take(3) : tail >= 3 ? game.take(2) : false; // the head inside costs more than a sheared tail
    if (took) { S.carry = 1; S.taken++; set('squeeze'); game.event('caught'); } else { set('miss'); game.event('missed'); }
  }

  function update(dt, ctx) {
    root.position.set(hall.x + T * Math.round((ctx.focus.x - hall.x) / T), 0, hall.z + T * Math.round((ctx.focus.z - hall.z) / T));
    const px = wrapD(ctx.pos.x - hall.x), pz = wrapD(ctx.pos.z - hall.z), py = ctx.pos.y, pr = Math.hypot(px, pz);
    const inHall = pr < R - 2.2, quick = 1 + 0.08 * S.fill;
    const toFish = Math.hypot(px - hp.x, pz - hp.z);
    S.t += dt; S.pulse = Math.max(0, S.pulse - dt * 0.6); S.danger = 0; S.ring = null;
    const live = S.state !== 'slack' && S.state !== 'closed';

    // a tail shed in the gap goes straight into the circle; one shed in the hall draws the head
    decoy = null;
    if (live) for (const p of ctx.pieces) {
      if (p.kind !== 'decoy' || p.dead || p.life <= 0.05 || p.given) continue;
      const x = wrapD(p.pos.x - hall.x), z = wrapD(p.pos.z - hall.z);
      if (Math.hypot(x - Math.sin(hall.phi) * R, z - Math.cos(hall.phi) * R) < GAP + 1.5) { p.given = true; p.life = Math.min(p.life, 0.5); addPiece(); continue; }
      if (Math.hypot(x, z) >= R - 1.5) continue;
      wake(); // a tail shed anywhere in the hall is enough to rouse it
      if (!decoy || p === S.piece) decoy = { p, x, y: p.pos.y, z };
    }

    if (S.state === 'asleep') {
      if (ctx.playing && (inHall || toFish < 6)) wake();
    } else if (S.state === 'wake') { // the head lifts off the floor and looks about
      S.lift = 1.5 * smooth(S.t / 2.2);
      if (S.t > 2.4) { set('home'); S.cool = 1; }
    } else if (S.state === 'home') {
      S.cool -= dt; S.danger = 0.25;
      if (S.closing) { set('closed'); game.event('closed'); }
      else if (decoy) { S.piece = decoy.p; set('fetch'); }
      else if (S.cool <= 0 && inHall && ctx.playing) { S.spin = rand() < 0.5 ? -1 : 1; set('reach'); }
    } else if (S.state === 'reach') { // out along a line that passes just beside the fish
      S.danger = 0.6;
      const dx = (px - hp.x) / (toFish || 1), dz = (pz - hp.z) / (toFish || 1);
      advance(dt, px - S.spin * dz * LOOP_R, py, pz + S.spin * dx * LOOP_R, 5.6 * quick, 2.3);
      if (decoy) { S.piece = decoy.p; set('fetch'); }
      else if (!ctx.playing || pr > R + 1 || len > MAX_OUT - 34) set('retract');
      else if (toFish < LOOP_R + 0.7) { cen.set(px, py, pz); S.beta = Math.atan2(hp.x - px, hp.z - pz); S.sweep = 0; S.loopFrom = len; set('circle'); game.event('loop'); }
    } else if (S.state === 'circle') { // round the fish, the loop drifting after it; out before the gap shuts
      S.danger = 1;
      const d = Math.hypot(px - cen.x, pz - cen.z), v = Math.min(1.5, d * 1.5) * dt / (d || 1);
      cen.x += (px - cen.x) * v; cen.z += (pz - cen.z) * v; cen.y = damp(cen.y, py, 1.5, dt);
      const b = Math.atan2(hp.x - cen.x, hp.z - cen.z);
      S.sweep += wrapPi(b - S.beta); S.beta = b;
      advance(dt, cen.x + Math.sin(b + S.spin * 0.6) * LOOP_R, cen.y, cen.z + Math.cos(b + S.spin * 0.6) * LOOP_R, 4.5 * quick, 3.2);
      if (Math.abs(S.sweep) >= Math.PI * 2 * 0.95) closeLoop(ctx, px, py, pz);
      else if (len > MAX_OUT || S.t > 14) set('retract');
    } else if (S.state === 'squeeze') {
      S.danger = 0.8;
      if (S.t > 0.9) set('retract');
    } else if (S.state === 'miss') { // it closed on nothing, and hangs there a moment
      S.danger = 0.3;
      if (S.t > 1.3) set('retract');
    } else if (S.state === 'retract') {
      S.danger = 0.3;
      retract(dt, 11);
      if (len <= 0) { if (S.carry) { S.carry = 0; addPiece(); } set('home'); S.cool = 2.2 - 0.25 * S.fill; }
    } else if (S.state === 'fetch') { // across to a shed tail, high, so that it comes down on it from above
      S.danger = 0.35;
      if (!decoy || decoy.p !== S.piece) set('retract');
      else {
        decoy.p.life = Math.max(decoy.p.life, 2.5);
        if (Math.hypot(decoy.x - hp.x, decoy.z - hp.z) > 0.7) advance(dt, decoy.x, Math.min(decoy.y + 4.2, world.ceiling - 1.5), decoy.z, 6.2, 2.6);
        else set('plunge');
        if (len > MAX_OUT) set('retract');
      }
    } else if (S.state === 'plunge') {
      S.danger = 0.35;
      const p = S.piece;
      if (!p || p.dead) set('retract');
      else {
        p.life = Math.max(p.life, 2.5);
        const x = wrapD(p.pos.x - hall.x), z = wrapD(p.pos.z - hall.z), floor = Math.max(p.pos.y + 0.35, ground(x, z) + 0.8);
        hp.x = damp(hp.x, x, 4, dt); hp.z = damp(hp.z, z, 4, dt); hp.y = Math.max(floor, hp.y - 4.4 * dt);
        pitch = damp(pitch, -1.1, 5, dt);
        extend();
        if (hp.y <= floor + 0.02) set('take');
      }
    } else if (S.state === 'take') { // head down over the piece, the neck standing above it: now it can be ringed
      const p = S.piece;
      if (!p || p.dead) set('retract');
      else {
        p.life = Math.max(p.life, 1.2); p.vel.set(0, 0, 0);
        p.pos.set(ctx.pos.x + (mouth.x - px), mouth.y, ctx.pos.z + (mouth.z - pz));
        if (S.t > TAKE) { p.life = 0.2; p.given = true; S.carry = 1; S.piece = null; set('retract'); }
      }
    } else if (S.state === 'closed') { // head to tail: the circle is whole, and the palace lights
      S.lit = smooth(S.t / 4); S.lift = damp(S.lift, 0, 2, dt);
      lines.forEach((l, k) => { if (S.t > 2.5 + k * 0.75) l.slack = Math.min(1, l.slack + dt * 0.9); });
    } else if (S.state === 'slack') { // ringed: the whole body lets go
      S.slack = smooth(S.t / 4.5); S.lift = damp(S.lift, 0, 3, dt);
    }
    if (live && S.awake && S.state !== 'wake') S.lift = damp(S.lift, 1.5 * (1 - smooth(len / 4)), 3, dt);
    const growTo = S.state === 'closed' ? EXTRA : (EXTRA * S.fill) / FILLS;
    S.grown = S.grown < growTo ? Math.min(growTo, S.grown + dt * 2.2) : growTo;
    world.portal.level = damp(world.portal.level, S.state === 'closed' ? 1.6 : S.awake ? 0 : 1, 1.5, dt);

    lay(ctx.time);
    if ((S.state === 'take' || S.state === 'miss') && ctx.playing) {
      target.x = ctx.pos.x + (hp.x - px); target.y = hp.y + S.lift; target.z = ctx.pos.z + (hp.z - pz); target.can = canWrap(ctx.total, ROOM);
      S.ring = target;
    } else target.progress = 0;
  }

  // ------------------------------------------------------------ put every part where the body now runs
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), q5 = new THREE.Quaternion(), eu = new THREE.Euler(0, 0, 0, 'YXZ'), sc = new THREE.Vector3(), none = new THREE.Vector3(0, 0, 0);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  function lay(time) {
    const whole = Math.floor(S.grown), part = S.grown - whole, slack = S.slack;
    for (let i = 0; i < TOTAL; i++) {
      const s = segs[i], grow = i < N ? 1 : i - N < whole ? 1 : i - N === whole ? part : 0;
      if (grow <= 0.02) { body.setMatrixAt(i, m4.compose(none, q4.identity(), none)); P[i * 3 + 1] = -999; continue; }
      const u = HEAD + i * SEG;
      curve(u + 0.36, c); curve(u - 0.36, b); curve(u, a);
      const w = onWall, rest = ground(a.x, a.z) + s.tall / 2 - 0.35;
      let y = lerp(a.y, rest, w) + S.lift * Math.max(0, 1 - u / 7) * 0.7, dy = (b.y - c.y) * (1 - w); // the neck follows the lifted head
      const tanx = b.x - c.x, tanz = b.z - c.z, tl = Math.hypot(tanx, tanz) || 1;
      if (w < 1 && !slack) { const wave = 0.22 * (1 - w) * Math.sin(u * 0.55 - time * 3 + s.ph * 0.2); a.x += (tanz / tl) * wave; a.z -= (tanx / tl) * wave; } // off the wall it swims
      else if (S.awake && !slack) y += 0.05 * Math.sin(time * 1.2 + i * 0.3); // on the wall it breathes
      let roll = 0, turn = (s.n - 0.5) * 0.1;
      if (slack) { // let go: off the line of the wall, down, and over onto its side
        const r = Math.hypot(a.x, a.z) || 1, out = w * slack * (1.2 + 5 * s.n);
        a.x += (a.x / r) * out; a.z += (a.z / r) * out;
        y = lerp(y, ground(a.x, a.z) + s.thick * 0.45, slack); dy *= 1 - slack;
        roll = slack * 1.45 * (s.n > 0.5 ? 1 : -1); turn += (s.n - 0.5) * 0.9 * slack;
      }
      eu.set(-Math.atan2(dy, tl), Math.atan2(tanx, tanz) + turn, roll);
      body.setMatrixAt(i, m4.compose(a.setY(y), q4.setFromEuler(eu), sc.set((s.thick / 0.866) * grow, s.tall * grow, SEG * 1.05)));
      P[i * 3] = a.x; P[i * 3 + 1] = y; P[i * 3 + 2] = a.z;
    }
    body.instanceMatrix.needsUpdate = true;
    flank.emissiveIntensity = (0.16 + 0.6 * S.pulse) * (1 - slack) + 1.1 * S.lit;

    // the head and the four bones behind it, bent along the same curve
    const hy = lerp(hp.y + S.lift, ground(hp.x, hp.z) + 0.45, slack);
    const bow = S.state === 'take' || S.state === 'plunge' ? 0 : 0.12 * Math.sin(time * 0.9) * (S.awake ? 1 : 0) * (1 - slack);
    eu.set(-pitch * (1 - slack) + bow * 0.4, yaw + bow, slack * 1.3);
    q5.setFromEuler(eu);
    model.rootBone.position.set(hp.x, hy, hp.z);
    model.rootBone.quaternion.copy(q5);
    a.set(hp.x, hy, hp.z);
    for (let k = 0; k < spine.length; k++) {
      curve((k + 1) * BONE, b);
      const by = lerp(lerp(b.y, ground(b.x, b.z) + 0.8, onWall) + S.lift * (1 - (k + 1) / (spine.length + 2)), ground(b.x, b.z) + 0.45, slack);
      const dx = a.x - b.x, dz = a.z - b.z, h = Math.hypot(dx, dz) || 1e-4;
      eu.set(-Math.atan2(a.y - by, h), Math.atan2(dx, dz), slack * 1.3);
      q4.setFromEuler(eu);
      spine[k].quaternion.copy(q5).invert().multiply(q4);
      q5.copy(q4); a.set(b.x, by, b.z);
    }
    mouth.set(hp.x + Math.sin(yaw) * Math.cos(pitch) * 1.3, hy + Math.sin(pitch) * 1.3 - 0.1, hp.z + Math.cos(yaw) * Math.cos(pitch) * 1.3);
    const on = S.awake ? 1 - slack : 0;
    eye.position.set(hp.x + Math.sin(yaw) * 0.5, hy + 0.25, hp.z + Math.cos(yaw) * 0.5);
    eye.material.opacity = damp(eye.material.opacity, 0.75 * on, 0.1, 1);
    lamp.position.copy(eye.position).y += 1.2;
    lamp.intensity = damp(lamp.intensity, 9 * on + 14 * S.lit, 0.1, 1);

    for (const l of lines) {
      const i = l.i * 3, s = segs[l.i];
      l.mesh.position.set(P[i], P[i + 1] + s.tall / 2 - 0.2, P[i + 2]);
      l.mesh.scale.set(1, lerp(34, 0.5, smooth(l.slack)), 1);
      l.mesh.rotation.z = l.side * 0.5 * smooth(l.slack);
    }
    for (const l of lures) {
      const i = l.i * 3, r = Math.hypot(P[i], P[i + 2]) || 1, s = segs[l.i];
      l.sprite.position.set(P[i] - (P[i] / r) * (s.thick / 2 + 0.15), P[i + 1] + 0.3, P[i + 2] - (P[i + 2] / r) * (s.thick / 2 + 0.15));
      l.sprite.material.opacity = (1 - slack) * (S.lit > 0 ? 0.9 : 0.42 + 0.12 * Math.sin(time * 1.7 + l.ph));
    }

    const g = S.state === 'take' || S.state === 'miss' ? target : null;
    ringLine.visible = !!g; arcLine.visible = !!g && g.progress > 0.02;
    if (g) {
      const Rr = g.orbit;
      ringLine.position.set(hp.x, hy, hp.z); ringLine.scale.setScalar(Rr); ringLine.material = g.can ? ringYes : ringNo;
      arcLine.position.set(hp.x, hy + 0.01, hp.z); arcLine.scale.set(Rr * g.arcSign, Rr, Rr); arcLine.rotation.y = g.arcStart; arcLine.material = g.can ? arcYes : arcNo;
      arcGeo.setDrawRange(0, Math.max(2, Math.round(g.progress * 48 * g.sweep) + 1));
    }
  }

  // ------------------------------------------------------------ the body is solid: the wall, and the loop
  function pushOut(p, radius) {
    if (S.state === 'slack') return;
    let x = wrapD(p.x - hall.x), z = wrapD(p.z - hall.z);
    const x0 = x, z0 = z, rho = Math.hypot(x, z) || 1e-4;
    if (Math.abs(rho - R) < 1.6 + radius) { // where it still lies on the ring
      let arc = wrapPi(Math.atan2(x, z) - hall.phi) * R;
      if (arc < 0) arc += CIRC;
      for (const turn of [0, CIRC]) { // the pieces that close the gap run past the start of the ring
        const u = arc + turn - GAP + len, i = Math.round((u - HEAD) / SEG);
        if (u < len || i < 0 || i >= TOTAL || P[i * 3 + 1] < -900) continue;
        const s = segs[i], half = s.thick / 2 + radius, top = P[i * 3 + 1] + s.tall / 2;
        if (Math.abs(rho - R) >= half || p.y >= top + radius) continue;
        if (p.y > top - 0.35) p.y = top + radius; // over the top
        else { const to = R + (rho >= R ? half : -half); x *= to / rho; z *= to / rho; }
      }
    }
    const out = Math.min(TOTAL, Math.ceil((len + 1 - HEAD) / SEG)); // the part that has left the wall
    for (let i = 0; i < out; i++) {
      const s = segs[i], dx = x - P[i * 3], dz = z - P[i * 3 + 2], dy = p.y - P[i * 3 + 1], reach = s.thick * 0.5 + 0.1 + radius, half = s.tall / 2 + radius * 0.6;
      const d2 = dx * dx + dz * dz;
      if (d2 >= reach * reach || Math.abs(dy) >= half) continue;
      if (Math.abs(dy) > half - 0.3) p.y = P[i * 3 + 1] + Math.sign(dy) * half; // slipping over or under it
      else { const d = Math.sqrt(d2) || 1e-4; x += (dx / d) * (reach - d); z += (dz / d) * (reach - d); }
    }
    { // the head itself
      const dx = x - hp.x, dz = z - hp.z, dy = p.y - (hp.y + S.lift), reach = 0.72 + radius, d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < reach * reach) { const d = Math.sqrt(dx * dx + dz * dz) || 1e-4, k = Math.sqrt(Math.max(reach * reach - dy * dy, 0)); x = hp.x + (dx / d) * k; z = hp.z + (dz / d) * k; }
    }
    p.x += x - x0; p.z += z - z0;
  }

  // a dash into its head while it is reaching for the fish or circling it: the loop falls apart
  function ram(snout) {
    if (S.state !== 'reach' && S.state !== 'circle') return false;
    if (Math.hypot(wrapD(snout.x - hall.x) - hp.x, snout.y - (hp.y + S.lift), wrapD(snout.z - hall.z) - hp.z) > 1.6) return false;
    set('miss'); game.event('missed');
    return true;
  }

  function dispose() {
    scene.remove(root);
    for (const o of trash) o.dispose();
  }
  lay(0);
  return {
    update, pushOut, ram, dispose, ringed, state: S, hall, FILLS,
    get ring() { return S.ring; },
    // for the automated checks
    debug: { hp, home, segs, N, EXTRA, P, lines, get len() { return len; }, get yaw() { return yaw; }, addPiece, wake, set, local: (p) => ({ x: wrapD(p.x - hall.x), y: p.y, z: wrapD(p.z - hall.z) }) },
  };
}
