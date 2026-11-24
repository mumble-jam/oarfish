// Scripted checks of the bosses: the Keeper's shapes (what it hits with, what is solid of it, what of it can be hurt), and the last band: the Sum, the two endings, the surfacing.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { chromium } from 'playwright';
const ROOT = path.resolve(import.meta.dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript' };
const server = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]); if (u === '/') u = '/index.html';
  const CDN = '/npm/three@0.170.0/';
  const p = u.startsWith(CDN) ? path.resolve(import.meta.dirname, '../node_modules/three', u.slice(CDN.length)) : path.join(ROOT, u);
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  if (u === '/index.html') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(fs.readFileSync(p, 'utf8').replaceAll('https://cdn.jsdelivr.net', '')); }
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const url = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const out = (n) => path.resolve(import.meta.dirname, `../out/shots/${n}.png`);
fs.mkdirSync(path.resolve(import.meta.dirname, '../out/shots'), { recursive: true });
const shots = process.argv.includes('--shots');
let failures = 0;
const check = (name, ok, detail = '') => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); };
const page = await (await browser.newContext({ viewport: { width: 1440, height: 820 } })).newPage();
page.on('pageerror', (e) => { failures++; console.log('[pageerror]', e.message); });
page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/fonts\.g|ERR_|Failed to load resource|GPU stall|GL Driver|AudioContext/.test(m.text())) console.log(`[${m.type()}]`, m.text().slice(0, 400)); });
await page.addInitScript(() => { window.__noNursery = true; });
await page.addInitScript(() => { try { const f = JSON.parse(localStorage.getItem('oarfish.feel') || '{}'); if (!f.mode) localStorage.setItem('oarfish.feel', JSON.stringify({ ...f, mode: 'point' })); } catch {} }); // made on the plate camera, the default when this was written: ask for it, unless a camera was chosen in this page
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
await page.evaluate(() => { window.__hold = true; });
const ev = (fn, arg) => page.evaluate(fn, arg);
const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const snap = async (name) => { if (!shots) return; await ev(() => { window.__game.run.safe = 0; }); await frame(); await page.screenshot({ path: out(name) }); };
await ev(() => {
  const g = window.__game;
  const none = () => ({ dir: null, amount: 1, vertical: 0, sprint: false, gentle: false, coil: 0, tight: false, bite: false });
  window.T = {
    none,
    put(x, y, z, yaw = 0) { g.rig.reset(g.rig.pos.clone().set(x, y, z), yaw); g.snap(); },
    idle(seconds) { g.sim(seconds, none()); },
    // hall coordinates (centre at 0,0) to the world and back
    at(lx, lz) { const h = g.world.hall; return [h.x + lx, h.z + lz]; },
    loc() { return g.sum.debug.local(g.rig.pos); },
    alone() { for (const b of g.foes.biters) { b.alive = false; b.mesh.visible = false; } for (const a of g.foes.anglers) { a.alive = false; a.group.visible = false; } },
    palace(segs = 26) { g.startRun(5); g.run.segs = segs; g.buildFish(segs); g.enterFloor(4, false); this.alone(); this.idle(0.5); g.run.safe = 0; },
    long(segs = 26) { g.run.segs = segs; g.buildFish(segs); g.run.safe = 0; },
    inHall(lx = 0, lz = 0, yaw = 0) { const h = g.world.hall, [x, z] = this.at(lx, lz); this.put(x, h.y + 2.4, z, yaw); },
    until(pred, max, input) { let t = 0; while (!pred() && t < max) { g.sim(0.1, input ? input() : none()); t += 0.1; } return +t.toFixed(1); },
  };
});

// ---- the hall and the body that walls it
let s = await ev(() => { const g = window.__game, T = window.T; T.palace(26); const d = g.sum.debug, h = g.world.hall;
  const colours = new Set(d.segs.slice(0, d.N).map((x) => x.colour)); let onRing = 0; for (let i = 0; i < d.N; i++) if (Math.abs(Math.hypot(d.P[i * 3], d.P[i * 3 + 2]) - h.R) < 0.05) onRing++;
  const gate = g.world.goal, gl = { x: gate.x - h.x, z: gate.z - h.z };
  return { state: g.sum.state.state, N: d.N, extra: d.EXTRA, colours: colours.size, onRing, R: h.R, gateFromCentre: +Math.hypot(gl.x, gl.z).toFixed(1), headFromGate: +Math.hypot(d.hp.x - gl.x, d.hp.z - gl.z).toFixed(1), biters: g.foes.biters.length }; });
check('the Sum lies asleep as the ring wall, in all five district colours, its head by the gate', s.state === 'asleep' && s.N > 150 && s.colours === 5 && s.onRing === s.N && s.headFromGate < 8, JSON.stringify(s));
// seen from outside, on the way to the gate
await ev(() => { const g = window.__game, T = window.T, h = g.world.hall; const a = h.phi + 0.75; const [x, z] = T.at(Math.sin(a) * (h.R + 6), Math.cos(a) * (h.R + 6)); T.put(x, h.y + 2.2, z, a + Math.PI * 0.6); g.cam.yaw = a; g.cam.pitch = 0.3; T.idle(0.6); });
await snap('b-wall');
// the wall is solid: a fish swimming at it from outside does not get in
s = await ev(() => { const g = window.__game, T = window.T, h = g.world.hall; const a = h.phi + Math.PI; const [x, z] = T.at(Math.sin(a) * (h.R + 5), Math.cos(a) * (h.R + 5)); T.put(x, h.y + 1.6, z, a + Math.PI);
  g.sim(4, { ...T.none(), dir: { x: -Math.sin(a), y: 0, z: -Math.cos(a) } }); const l = T.loc(); return { r: +Math.hypot(l.x, l.z).toFixed(2), awake: g.sum.state.awake }; });
check('the wall is solid from outside', s.r > 22.5 && !s.awake, JSON.stringify(s));

// ---- through the gate: it wakes
s = await ev(() => { const g = window.__game, T = window.T, h = g.world.hall, w = g.world.goal; const yaw = Math.atan2(h.x - w.x, h.z - w.z); T.put(w.x - Math.sin(yaw) * 3, h.y + 2.2, w.z - Math.cos(yaw) * 3, yaw);
  const t = T.until(() => g.sum.state.awake, 8, () => ({ ...T.none(), dir: { x: Math.sin(yaw), y: 0, z: Math.cos(yaw) } })); const l = T.loc(); T.idle(0.3);
  return { t, awake: g.sum.state.awake, state: g.sum.state.state, r: +Math.hypot(l.x, l.z).toFixed(1), marker: document.getElementById('goal').style.display, run: g.run.state }; });
check('swimming in through the gate wakes it', s.awake && s.state === 'wake' && s.marker === 'none' && s.run === 'play', JSON.stringify(s));
await ev(() => { const g = window.__game; g.cam.yaw += 2.4; g.cam.pitch = 0.28; window.T.idle(1.6); }); await snap('b-wake');

// ---- it hunts by closing a loop. A fish that stays put is taken, and its tail goes into the gap
s = await ev(() => { const g = window.__game, T = window.T; T.inHall(2, -3); g.run.safe = 0; const before = g.run.segs; const seen = [];
  const note = () => { const st = g.sum.state.state; if (seen[seen.length - 1] !== st) seen.push(st); };
  const t = T.until(() => { note(); return g.sum.state.state === 'squeeze' || g.sum.state.state === 'miss'; }, 40);
  const mid = { segs: g.run.segs, state: g.sum.state.state, out: +g.sum.debug.len.toFixed(1) };
  const t2 = T.until(() => { note(); return g.sum.state.state === 'home'; }, 20);
  return { t, t2, seen, before, mid, fill: g.sum.state.fill, grown: +g.sum.state.grown.toFixed(2), len: g.sum.debug.len }; });
check('its loop closes round a fish that stays put, takes three segments, and carries them to the gap', s.mid.state === 'squeeze' && s.mid.segs === s.before - 3 && s.seen.includes('reach') && s.seen.includes('circle') && s.fill === 1 && s.len === 0, JSON.stringify(s));
// ...and a fish that leaves through the open side is not
s = await ev(() => { const g = window.__game, T = window.T; T.long(); T.inHall(-3, 2); const before = g.run.segs;
  T.until(() => g.sum.state.state === 'circle', 40); const d = g.sum.debug; const l = T.loc(); let ux = l.x - d.hp.x, uz = l.z - d.hp.z; const m = Math.hypot(ux, uz) || 1; ux /= m; uz /= m; // straight away from the head
  const t = T.until(() => g.sum.state.state === 'squeeze' || g.sum.state.state === 'miss', 14, () => ({ ...T.none(), dir: { x: ux, y: 0, z: uz }, sprint: true }));
  return { t, state: g.sum.state.state, before, segs: g.run.segs }; });
check('a fish that swims out before the loop shuts is missed', s.state === 'miss' && s.segs === s.before, JSON.stringify(s));
// ...and a dash into its head breaks the loop
s = await ev(() => { const g = window.__game, T = window.T; T.until(() => g.sum.state.state === 'home', 20); T.long(); T.inHall(2, 3); const before = g.run.segs;
  T.until(() => g.sum.state.state === 'circle' && Math.abs(g.sum.state.sweep) > 1.5, 40); const d = g.sum.debug; const [x, z] = T.at(d.hp.x - 2.4, d.hp.z); T.put(x, d.hp.y, z, Math.PI / 2);
  const fwd = { ...T.none(), dir: { x: 1, y: 0, z: 0 } }; g.sim(1 / 60, { ...fwd, dashNow: true }); g.sim(0.2, fwd); return { state: g.sum.state.state, segs: g.run.segs - before }; });
check('a dash into its head while it circles breaks the loop', s.state === 'miss' && s.segs === 0, JSON.stringify(s));
// a picture of a loop half closed
await ev(() => { const g = window.__game, T = window.T; T.until(() => g.sum.state.state === 'home', 20); T.long(); T.inHall(3, 4); T.until(() => g.sum.state.state === 'circle' && Math.abs(g.sum.state.sweep) > 2.6, 40); g.cam.pitch = 0.95; g.snap(); });
await snap('b-loop');

// ---- a shed tail draws the head, and holds it still, head down
s = await ev(() => { const g = window.__game, T = window.T; T.until(() => g.sum.state.state === 'home', 30); T.long(); T.inHall(-6, -5, 1); T.idle(0.3); g.run.safe = 0;
  const before = g.run.segs, fill0 = g.sum.state.fill; g.shed(); const seen = [];
  const t = T.until(() => { const st = g.sum.state.state; if (seen[seen.length - 1] !== st) seen.push(st); return st === 'take'; }, 25, () => ({ ...T.none(), dir: { x: 1, y: 0, z: 0.2 }, amount: 0.4 }));
  const d = g.sum.debug, piece = g.sum.state.piece, pl = piece ? d.local(piece.pos) : null, ring = g.sum.ring;
  return { t, seen, before, after: g.run.segs, fill0, fill: g.sum.state.fill, headToPiece: pl ? +Math.hypot(pl.x - d.hp.x, pl.z - d.hp.z).toFixed(2) : null, ring: ring ? { can: ring.can, room: ring.room } : null, out: +d.len.toFixed(1) }; });
check('a shed tail draws the head across the hall and holds it over the piece', s.seen.includes('fetch') && s.seen.includes('plunge') && s.headToPiece !== null && s.headToPiece < 1.8 && s.ring && s.ring.can === true, JSON.stringify(s));
await ev(() => { const g = window.__game, d = g.sum.debug, h = g.world.hall; const [x, z] = window.T.at(d.hp.x + 3.2, d.hp.z + 1.5); window.T.put(x, d.hp.y, z, 2.2); g.cam.pitch = 0.42; g.cam.yaw += 0.8; window.T.idle(0.3); });
await snap('b-take');

// ---- ending one: ring the head with the widest loop
s = await ev(() => { const g = window.__game, T = window.T, d = g.sum.debug; const [x, z] = T.at(d.hp.x + 2.6, d.hp.z + 0.9); T.put(x, d.hp.y, z, 1.1); T.idle(0.3); g.run.safe = 0;
  let prog = 0; const t = T.until(() => { prog = Math.max(prog, g.sum.ring ? g.sum.ring.progress : 0); return g.run.state !== 'play'; }, 6.2, () => ({ ...T.none(), coil: 1, coilR: (g.rig.length + 0.45) / (2 * Math.PI * 0.84 + 0.35) }));
  return { t, prog: +prog.toFixed(2), run: g.run.state, sum: g.sum.state.state, end: g.end.kind, segs: g.run.segs }; });
check('a long body that wraps the head opens the circle', s.run === 'opening' && s.sum === 'slack' && s.end === 'open', JSON.stringify(s));
await ev(() => { const g = window.__game; g.cam.pitch = 0.8; g.sim(3.2); }); await snap('b-slack');
// up through every band, then the surface, then the end card
s = await ev(() => { const g = window.__game; const floors = [], states = []; let t = 0, raft = null, top = -99;
  while (g.run.state !== 'won' && t < 120) { g.sim(0.25); t += 0.25; if (floors[floors.length - 1] !== g.run.floor && g.run.state === 'rise') floors.push(g.run.floor); if (states[states.length - 1] !== g.run.state) states.push(g.run.state);
    if (g.run.state === 'surface') { top = Math.max(top, g.rig.pos.y); raft = g.world.raft ? +Math.hypot(g.world.raft.position.x - g.rig.pos.x, g.world.raft.position.z - g.rig.pos.z).toFixed(1) : null; if (!window.__surf && g.run.stateT > 7) { window.__surf = 1; return { pause: true, t, floors, states }; } } }
  return { t, floors, states, top, raft }; });
if (s.pause) { await snap('b-surface'); const first = s; s = await ev(() => { const g = window.__game; let t = 0, top = -99; while (g.run.state !== 'won' && t < 60) { g.sim(0.25); t += 0.25; top = Math.max(top, g.rig.pos.y); } return { t, top, raft: null }; }); s = { ...first, ...s, t: first.t + s.t }; }
await page.waitForTimeout(1500);
const card = await ev(() => ({ on: document.getElementById('end').classList.contains('on'), title: document.getElementById('end-title').textContent, text: document.getElementById('end-text').textContent, zone: document.getElementById('zone').textContent }));
check('the fish rises through all five bands, breaks the surface by the raft, and the dive ends', JSON.stringify(s.floors) === '[4,3,2,1,0]' && s.states.join() === 'opening,rise,surface' && s.top > -0.4 && card.on && card.title === 'The dive is over' && card.zone === '', JSON.stringify({ ...s, card }));

// ---- ending two: fill the gap, piece by piece
s = await ev(() => { const g = window.__game, T = window.T; T.palace(26); const h = g.world.hall, d = g.sum.debug; const fills = []; // the head out through the gate, the tail lying in the gap
  for (let k = 0; k < 4; k++) { const out = h.R + g.rig.length * 0.5, [x, z] = T.at(Math.sin(h.phi) * out, Math.cos(h.phi) * out); T.put(x, h.y + 2, z, h.phi); T.idle(0.2); g.run.safe = 0; g.shed(); T.idle(1.2); fills.push(g.sum.state.fill); }
  const segs = g.run.segs; const t = T.until(() => g.run.state === 'closing', 30);
  return { fills, segs, t, run: g.run.state, sum: g.sum.state.state, end: g.end.kind, awake: g.sum.state.awake }; });
check('four tails shed in the gap close the circle', JSON.stringify(s.fills) === '[1,2,3,4]' && s.segs === 14 && s.run === 'closing' && s.sum === 'closed' && s.end === 'close', JSON.stringify(s));
s = await ev(() => { const g = window.__game, T = window.T; g.sim(9.5); const d = g.sum.debug, h = g.world.hall; const l = T.loc();
  const tail = d.N + d.EXTRA - 1, tx = d.P[tail * 3], tz = d.P[tail * 3 + 2];
  return { lit: g.sum.state.lit, grown: g.sum.state.grown, extra: d.EXTRA, slack: d.lines.filter((x) => x.slack > 0.9).length, lines: d.lines.length, r: +Math.hypot(l.x, l.z).toFixed(1), headToTail: +Math.hypot(tx - d.hp.x, tz - d.hp.z).toFixed(1), portal: +g.world.portal.level.toFixed(2), state: g.run.state }; });
check('the palace lights, the lines go slack, head meets tail, and the fish takes its place along the ring', s.lit === 1 && s.grown === s.extra && s.slack === s.lines && Math.abs(s.r - 19) < 3 && s.headToTail < 4.5 && s.portal > 1.2, JSON.stringify(s));
await snap('b-closed');
s = await ev(() => { const g = window.__game; g.sim(3); return g.run.state; });
check('...and the dive ends there, with no surfacing', s === 'won');

// ---- a body too short cannot ring the head
s = await ev(() => { const g = window.__game, T = window.T; T.palace(16); T.inHall(-6, -5, 1); T.idle(0.3); g.run.safe = 0; g.shed();
  T.until(() => g.sum.state.state === 'take', 25, () => ({ ...T.none(), dir: { x: 1, y: 0, z: 0.2 }, amount: 0.4 })); const d = g.sum.debug; const can = g.sum.ring && g.sum.ring.can;
  const [x, z] = T.at(d.hp.x + 2.0, d.hp.z + 0.7); T.put(x, d.hp.y, z, 1.1); T.until(() => g.run.state !== 'play' || g.sum.state.state !== 'take', 6, () => ({ ...T.none(), coil: 1 }));
  return { can, run: g.run.state, segs: g.run.segs }; });
check('a body too short for the widest loop cannot open the circle', s.can === false && s.run === 'play', JSON.stringify(s));

// ---- the Keeper, made honest (stage A): what is drawn is what hits. Its fight's own checks are in test_game.mjs (keeperKit); these are about shapes.
const kk = () => { const g = window.__game, T = window.T, G = g.guard, S = G.state, F = g.KEEPER_FIGHT, none = T.none();
  for (const b of g.foes.biters) { b.alive = false; b.mesh.visible = false; } for (const h of g.foes.hooks) h.pos.y += 500;
  const r = g.world.rift, W = { x: r.x - r.nx * 24, z: r.z - r.nz * 24 };
  return { g, T, G, S, F, none, W, sh: window.__shapes,
    home() { G.debug.set('stalk'); S.stun = 0; G.pos.set(W.x + Math.sin(2.7) * 5, 0, W.z + Math.cos(2.7) * 5); G.pos.y = g.world.height(G.pos.x, G.pos.z) + 0.9; },
    ready(o = {}) { G.debug.forget(); for (let i = 0; i < 8; i++) G.rig.walker.legs[i].ctrl = null; Object.assign(S, { stomp: null, held: null, knocked: null }); G.debug.set('stalk'); Object.assign(S, { cool: 0, stun: 0, flash: 0, jabT: 9, chargeT: 9, digT: 9, stompT: 9, bellyT: 9, under: 0, met: true, last: '' }, o); g.run.segs = 16; g.buildFish(16); g.run.safe = 0; g.run.hush = 0; },
    // a point on leg i as it is drawn, `h` metres over the bed (on its shin or its spike), and the way out from the crab's middle to it
    legAt(i, h = 1.7) { let best = null, least = 1e9; for (const x of G.debug.solids()) if (x.leg === i) for (let k = 0; k <= 20; k++) { const p = x.a.clone().lerp(x.b, k / 20), d = Math.abs(p.y - g.world.height(p.x, p.z) - h); if (d < least) { least = d; best = p; } }
      const dx = best.x - G.pos.x, dz = best.z - G.pos.z, d = Math.hypot(dx, dz); return { p: best, ox: dx / d, oz: dz / d }; },
    // a dash at leg i from `out` metres outside it, at `h` over the bed (plus `lift`)
    dashLeg(i, { h = 1.7, out = 2.4, lift = 0 } = {}) { const { p, ox, oz } = this.legAt(i, h), at = { ...none, dir: { x: -ox, y: 0, z: -oz } }; T.put(p.x + ox * out, p.y + lift, p.z + oz * out, Math.atan2(-ox, -oz)); g.run.safe = 5; g.run.dashCool = 0; g.run.stamina = 1; const h0 = S.hits;
      g.sim(1 / 60, { ...at, dashNow: true }); g.sim(0.35, at); return S.hits > h0; },
    // the fish across the crab's front, `far` out, `up` over the bed, its head to the crab's left
    lie(far, side = 0, up = 1.6) { const yaw = G.mesh.rotation.y + side, fx = Math.sin(yaw), fz = Math.cos(yaw), half = g.rig.length / 2, x = G.pos.x + fx * far + fz * half, z = G.pos.z + fz * far - fx * half; T.put(x, g.world.height(x, z) + up, z, yaw + Math.PI / 2); },
    until(st, secs = 8) { let t = 0; while (S.state !== st && t < secs) { g.sim(0.02, none); t += 0.02; } return S.state === st; },
    body() { return G.debug.body(); }, solids() { return G.debug.solids(); } }; };
await page.evaluate(async (src) => { window.__shapes = await import('/game/shapes.js'); window.kk = eval(src); }, `(${kk.toString()})`);

// the testing tool: the switch in the pause menu draws what the fight believes
s = await ev(() => { const g = window.__game; g.startRun(31); const { G, S, home, ready, lie, until } = window.kk(); home(); ready({ last: 'sweep' }); lie(3.6); until('slam'); g.sim(0.75, window.T.none());
  const b = document.getElementById('dev-shapes'); g.setPaused(true); b.click(); const on = g.hitView.on, pressed = b.getAttribute('aria-pressed'), drawn = g.hitView.lines.geometry.drawRange.count;
  const roles = {}; for (const x of G.shapes(g.sctx)) roles[x.role + (x.role === 'leg' ? (x.live ? '+' : '-') : '')] = (roles[x.role + (x.role === 'leg' ? (x.live ? '+' : '-') : '')] || 0) + 1;
  b.click(); const off = !g.hitView.on; g.setPaused(false); return { on, pressed, drawn, off, roles, state: S.state }; });
check('the Keeper: a switch in the pause menu draws its fight’s shapes over the picture: the fish’s body, its shell, each leg (and whether it can be hurt now), and the blow on its way', s.on && s.pressed === 'true' && s.drawn > 500 && s.off && s.roles.fish >= 17 && s.roles.solid === 1 && s['roles']['leg-'] === 24 && s.roles.blow === 2 && s.state === 'slam', JSON.stringify(s));

// the fish has a body: a blow that grazes the skin between two joints takes it, where the joints alone would have been missed
s = await ev(() => { const { g, G, sh, body } = window.kk(); g.sim(0.1, window.T.none()); const B = body(), k = 8, c = B[k], mid = c.a.clone().lerp(c.b, 0.5), side = new (mid.constructor)().subVectors(c.b, c.a).cross(new (mid.constructor)(0, 1, 0)).normalize();
  const graze = { t: 'cap', a: mid.clone().addScaledVector(side, c.r + 0.1).setY(mid.y + 1), b: mid.clone().addScaledVector(side, c.r + 0.1).setY(mid.y - 1), r: 0.12 }, clear = { ...graze, a: graze.a.clone().addScaledVector(side, 0.2), b: graze.b.clone().addScaledVector(side, 0.2) };
  const nearestJoint = Math.min(...g.rig.joints.map((j) => Math.hypot(j.x - graze.a.x, j.z - graze.a.z))) - graze.r;
  return { r: +c.r.toFixed(3), neck: +B[1].r.toFixed(3), tail: +B[B.length - 1].r.toFixed(3), k, graze: sh.struck(graze, B), clear: sh.struck(clear, B), nearestJoint: +nearestJoint.toFixed(2) }; });
check('the fish is hit on its body, as wide as it is drawn (about 0.15 m each side at the neck, tapering to the tail): a blow grazing its skin between two joints takes it, and one 0.2 m farther off does not', s.neck > 0.12 && s.neck < 0.2 && s.tail < 0.06 && s.graze === s.k && s.clear === -1 && s.nearestJoint > 0, JSON.stringify(s));

// the crab is solid: swum straight at, the head is turned aside by the shell, and a body laid through a leg is put out of it; none of it jitters
s = await ev(() => { const { g, T, G, S, home, solids, body, sh } = window.kk(); home(); G.debug.set('rest', 30); S.stun = 30; g.run.segs = 16; g.buildFish(16); g.sim(0.3, T.none());
  const p = G.pos, yaw = G.mesh.rotation.y, from = { x: p.x + Math.sin(yaw) * 7, z: p.z + Math.cos(yaw) * 7 }; T.put(from.x, p.y + 0.9, from.z, yaw + Math.PI); g.run.safe = 1e9;
  let inside = 0, worst = 0, jump = 0; const was = g.rig.joints.map((j) => j.clone()); const fwd = { ...T.none(), dir: { x: -Math.sin(yaw), y: 0, z: -Math.cos(yaw) } };
  for (let i = 0; i < 180; i++) { g.sim(1 / 60, fwd); const SOL = solids(); for (const c of body()) for (const x of SOL) { const d = sh.gap(x, c.a, c.b, c.r); if (d < -0.06) inside++; worst = Math.min(worst, d); }
    if (i > 60) g.rig.joints.forEach((j, k) => { jump = Math.max(jump, j.distanceTo(was[k])); }); g.rig.joints.forEach((j, k) => was[k].copy(j)); }
  const headOut = sh.gap(solids()[0], g.rig.pos, g.rig.pos, 0.15);
  // a body laid straight through the front legs
  const L = solids().find((x) => x.leg === 0), m = L.a.clone().lerp(L.b, 0.5); T.put(m.x - Math.cos(yaw) * 2, m.y, m.z + Math.sin(yaw) * 2, yaw + Math.PI / 2); g.sim(0.6, T.none()); let after = 0; for (const c of body()) for (const x of solids()) after = Math.min(after, sh.gap(x, c.a, c.b, c.r));
  return { inside, worst: +worst.toFixed(2), jump: +jump.toFixed(3), headOut: +headOut.toFixed(2), after: +after.toFixed(2), speed: +g.rig.speed.toFixed(2) }; });
check('the Keeper is solid: a fish swimming straight at its shell for three seconds is turned aside, head and body, no part of it in the shell or a leg, and nothing jitters; a body laid through a leg is put out of it', s.inside === 0 && s.worst > -0.06 && s.headOut > -0.06 && s.jump < 0.2 && s.after > -0.08, JSON.stringify(s));

// the great claw hits where it is drawn: the shape it is judged by is the hand and fingers as they land, and the jolt where the fingers hit; the mark showed it
s = await ev(() => { const { g, T, G, S, F, home, ready, lie, until, body, sh } = window.kk(), out = {};
  const run = (place) => { home(); ready({ last: 'sweep' }); lie(3.6); until('slam'); g.sim(F.slam.wind * F.slam.aim + 0.1, T.none()); const s0 = G.shapes(g.sctx).filter((x) => x.role === 'blow'), foot = s0[0], shock = s0[1]; place(foot, shock); g.run.safe = 0; const segs = g.run.segs; until('stuck', 2);
    const hot = G.shapes(g.sctx).filter((x) => x.role === 'blow' && x.hot), judged = hot.find((x) => x.r < 0.8), jolt = hot.find((x) => x.r >= 0.8), gapOf = (x) => Math.min(...G.debug.body().map((c) => sh.gap(x, c.a, c.b, c.r)));
    const drawn = G.rig.clawNow(true, { a: foot.a.clone(), b: foot.b.clone(), r: 0 }), off = (p, q) => Math.max(Math.hypot(p.a.x - q.a.x, p.a.z - q.a.z), Math.hypot(p.b.x - q.b.x, p.b.z - q.b.z));
    const aimNear = Math.min(...g.rig.joints.map((j) => Math.hypot(j.x - foot.b.x, j.z - foot.b.z)));
    return { lost: segs - g.run.segs, gap: +Math.min(gapOf(judged), gapOf(jolt)).toFixed(2), aimNear: +aimNear.toFixed(2), drawnOff: +off(drawn, judged).toFixed(2), markOff: +off(foot, judged).toFixed(2), hand: +judged.r.toFixed(2), jolt: +jolt.r.toFixed(2) }; };
  const along = (foot, t, side) => { const dx = foot.b.x - foot.a.x, dz = foot.b.z - foot.a.z, l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l, x = foot.a.x + dx * t + nx * side, z = foot.a.z + dz * t + nz * side;
    T.put(x + dx / l * 0.2, g.world.height(x, z) + 1.6, z + dz / l * 0.2, Math.atan2(-dx, -dz)); g.sim(1 / 60, T.none()); }; // head on, its snout just past the point, its body trailing back along the claw
  out.under = run((foot) => along(foot, 0.5, 0)); // under the hand
  out.beside = run((foot, shock) => along(foot, 0.6, shock.r + 0.35)); // beside it, just clear of the jolt
  return out; });
check('the great claw hits where it is drawn as it lands, not a disc: what it is judged by is the claw as drawn (and the mark on the bed showed it, near enough; one that meets a body closes on it there); a body under the hand is taken, and one lying alongside, just clear of the jolt where its fingers hit, is not', s.under.lost === 3 && s.under.gap < 0 && s.beside.lost === 0 && s.beside.gap > 0 && s.beside.drawnOff < 0.2 && s.under.markOff < 0.35 && s.under.hand > 0.4, JSON.stringify(s));

// every other blow: whenever one takes a part of the body, the shape it was judged by (the claw as drawn, the crab's shell and legs as it runs, its shell coming up) touches the body as drawn
s = await ev(() => { const { g, T, G, S, F, home, ready, lie, until, sh } = window.kk(), out = {};
  const watch = (name, set, wantState, secs = 5) => { home(); ready(set.o); set.place(); if (set.rage) { S.lost = F.rage; } if (!until(wantState, 6)) return (out[name] = { skipped: S.state });
    let t = 0, lost = 0, gap = null, what = ''; g.run.safe = 0; const segs = g.run.segs;
    while (t < secs && !lost) { g.sim(1 / 60, T.none()); t += 1 / 60; lost = segs - g.run.segs; if (lost) { const hot = G.shapes(g.sctx).filter((x) => x.role === 'blow' && x.hot); gap = Math.min(...hot.map((x) => Math.min(...G.debug.body().map((c) => sh.gap(x, c.a, c.b, c.r))))); what = hot.map((x) => x.t).join(); } }
    out[name] = { lost, gap: gap === null ? null : +gap.toFixed(2), what }; S.lost = 0; };
  watch('sweep', { o: { last: 'slam' }, place: () => lie(4.3) }, 'sweep');
  watch('jab', { o: { jabT: 0, stompT: 99 }, place: () => lie(4.0, 1.1) }, 'jab');
  watch('charge', { o: { chargeT: 0 }, place: () => { const r = g.world.rift, a = Math.atan2(r.x - r.nx * 24 - G.pos.x, r.z - r.nz * 24 - G.pos.z); lie(9, a - G.mesh.rotation.y); } }, 'charge');
  watch('rise', { o: { digT: 0, chargeT: 0 }, rage: true, place: () => lie(8.5) }, 'dig', 8);
  return out; });
check('every blow that takes part of the body was judged by a shape touching the body as it is drawn: the sweep by the great claw where it is, a jab by the small claw, a run by the crab’s shell and legs, and its rising from the sand by its shell', ['sweep', 'jab', 'charge', 'rise'].every((k) => s[k].lost > 0 && s[k].gap !== null && s[k].gap <= 0.21) && /cap/.test(s.sweep.what) && /cap/.test(s.jab.what) && /prism/.test(s.rise.what), JSON.stringify(s));

// a leg is hit where it is drawn: a dash that meets it at a fish's height takes it, one that passes over it does not; and a leg it stands on while it is not open turns the ram
s = await ev(() => { const { g, T, G, S, F, home, ready } = window.kk(), out = {};
  const open = (i) => { home(); ready(); G.debug.set('stuck', 4); g.sim(0.05, T.none()); };
  open(); out.met = window.kk().dashLeg.call(window.kk(), 1); S.leg.fill(0); S.hits = 0;
  open(); out.metHind = window.kk().dashLeg.call(window.kk(), 6); if (!out.metHind) { S.leg.fill(0); S.hits = 0; open(); out.metHind = window.kk().dashLeg.call(window.kk(), 7) ? 'the next one' : false; } S.leg.fill(0); S.hits = 0; // (a dash at one hind leg can meet the shell first: then the other)
  open(); { const kk = window.kk(), low = kk.legAt(1, 1.7); out.over = kk.dashLeg(1, { h: 1.7, lift: 0 }) && false; } S.leg.fill(0); S.hits = 0; // (placeholder, replaced below)
  open(); { const kk = window.kk(); let top = null; for (const x of G.debug.solids()) if (x.leg === 1) for (const p of [x.a, x.b]) if (!top || p.y > top.y) top = p.clone(); // over its knee by a metre and a half
    const dx = top.x - G.pos.x, dz = top.z - G.pos.z, d = Math.hypot(dx, dz), at = { ...T.none(), dir: { x: -dx / d, y: 0, z: -dz / d } }; T.put(top.x + dx / d * 2.4, top.y + 1.6, top.z + dz / d * 2.4, Math.atan2(-dx, -dz)); g.run.safe = 5; g.run.dashCool = 0; g.run.stamina = 1; const h0 = S.hits; g.sim(1 / 60, { ...at, dashNow: true }); g.sim(0.35, at); out.over = S.hits > h0; out.knee = +(top.y - g.world.height(top.x, top.z)).toFixed(2); } S.leg.fill(0); S.hits = 0;
  home(); ready({ cool: 99 }); g.sim(0.3, T.none()); { const kk = window.kk(); const L = G.rig.walker.legs[1]; let t = 0; while (L.t >= 0 && t < 2) { g.sim(1 / 60, T.none()); t += 1 / 60; } kk.dashLeg(1); out.closed = { hits: S.hits, leg: S.leg[1], open: S.open, lifted: L.t >= 0 }; }
  return out; });
check('a leg is hit where it is drawn, in three dimensions: a dash that meets a leg at a fish’s height (front or back) hurts it while the crab is open; one that passes over its knee does not; and a leg it stands on while it is not open turns the ram', s.met && s.metHind && !s.over && s.closed.hits === 0 && s.closed.leg === 0, JSON.stringify(s));

// a shed tail lying where it cannot get to it: it gives up, goes back to the fight, and does not go for that one again
s = await ev(() => { const { g, T, G, S, F, W, home, ready, until } = window.kk(); home(); ready(); g.sim(0.1, T.none());
  const a = Math.atan2(G.pos.x - W.x, G.pos.z - W.z), far = F.leash + 3; G.pos.set(W.x + Math.sin(a) * (F.leash - 1.5), 0, W.z + Math.cos(a) * (F.leash - 1.5)); G.pos.y = g.world.height(G.pos.x, G.pos.z) + 0.9; g.sim(0.1, T.none());
  const out = far + g.rig.length, x = W.x + Math.sin(a) * out, z = W.z + Math.cos(a) * out; T.put(x, g.world.height(x, z) + 1.6, z, a); g.sim(0.05, T.none()); g.run.safe = 0; g.shed(); g.run.safe = 1e9; const tail = g.foes.pieces.find((p) => p.kind === 'decoy' && !p.dead); // the tail left lying past its leash, the fish swum back in close
  T.put(G.pos.x + Math.sin(a) * 4, G.pos.y + 1, G.pos.z + Math.cos(a) * 4, a); S.state = 'stalk'; const seen = []; let t = 0, fetchT = 0;
  while (t < 14) { g.sim(0.05, T.none()); t += 0.05; if (S.state === 'fetch') fetchT += 0.05; if (seen[seen.length - 1] !== S.state) seen.push(S.state); if (tail) tail.life = Math.max(tail.life, 1); }
  return { seen: seen.join(','), fetchT: +fetchT.toFixed(1), last: S.state, tailFar: tail ? +Math.hypot(tail.pos.x - W.x, tail.pos.z - W.z).toFixed(1) : null }; });
check('a shed tail lying past the Keeper’s ground does not hold it: it gives up on it (at once, or within a few seconds of trying) and goes on with the fight', s.fetchT <= 7 && s.last !== 'fetch' && /slam|sweep|jab|stomp|heave/.test(s.seen) && s.tailFar > 13, JSON.stringify(s));

// ---- the Keeper made tall (stage B): a crab to swim under, and legs worth fighting. Every number is in KEEPER_FIGHT (guards.js) and KEEPER (critters.js).
// its size and stance: belly over a fish's height, knees higher, feet eleven metres apart, three lengths to a leg; and a fish swims under it and out the other side
s = await ev(() => { window.__game.startRun(31); const { g, T, G, S, F, home, ready, solids } = window.kk(), out = {}; home(); ready({ cool: 99, stompT: 99, bellyT: 99 }); g.run.safe = 1e9; g.sim(0.3, T.none()); G.debug.set('rest', 30); // (held where it stands: it is not to follow the fish)
  const bed = (p) => g.world.height(p.x, p.z), sh = solids()[0], legs = solids().filter((x) => x.leg >= 0);
  out.belly = +(sh.c.y - sh.ry - bed(sh.c)).toFixed(2); out.lengths = legs.length; out.knees = Math.min(...legs.filter((x, k) => k % 3 === 0).map((x) => +(x.b.y - bed(x.b)).toFixed(2)));
  const W = G.rig.walker.legs; out.apart = +Math.min(...[0, 1, 2, 3].map((i) => W[i].foot.distanceTo(W[i + 4].foot))).toFixed(1); out.most = +Math.max(...[0, 1, 2, 3].map((i) => W[i].foot.distanceTo(W[i + 4].foot))).toFixed(1); out.stance = [0, 1, 2, 3].map((i) => +(2 * W[i].rest.x * G.mesh.scale.x).toFixed(1)); // where its feet stand, side to side, when it stands still
  out.swims = +(1.5).toFixed(1); // rig.js holds the fish's head 1.5 m off the bed when it is let sink as low as it goes
  const yaw = G.mesh.rotation.y, lx = Math.cos(yaw), lz = -Math.sin(yaw); T.put(G.pos.x + lx * 9, bed(G.pos) + 1.5, G.pos.z + lz * 9, Math.atan2(-lx, -lz)); let least = 1e9, t = 0; const go = { ...T.none(), dir: { x: -lx, y: 0, z: -lz } };
  while (t < 6) { g.sim(1 / 30, go); t += 1 / 30; least = Math.min(least, Math.hypot(g.rig.pos.x - G.pos.x, g.rig.pos.z - G.pos.z)); }
  out.under = +least.toFixed(2); out.across = +((g.rig.pos.x - G.pos.x) * -lx + (g.rig.pos.z - G.pos.z) * -lz).toFixed(1); return out; });
check('the Keeper stands tall: its belly is over where a fish swims and its knees higher still, its feet about eleven metres apart, each leg in three lengths; and a fish swims in under it, between its legs, and out the other side', s.belly > 2.4 && s.knees > s.belly && Math.min(...s.stance) >= 10 && Math.max(...s.stance) <= 12 && s.apart >= 9 && s.most <= 13 && s.lengths === 24 && s.under < 1.5 && s.across > 5, JSON.stringify(s));

// planted, a leg is armoured; caught lifted, it is knocked away and it stumbles, open
s = await ev(() => { window.__game.startRun(31); const { g, T, G, S, F, home, ready, dashLeg } = window.kk(), out = {}; home(); ready({ cool: 99, stompT: 99, bellyT: 99 }); g.sim(0.3, T.none());
  const L = G.rig.walker.legs[2]; L.ctrl = L.foot.clone(); L.ctrl.y += 1.2; L.ctrlRate = 30; g.sim(0.2, T.none()); out.liftedBefore = +(L.foot.y - g.world.height(L.foot.x, L.foot.z)).toFixed(2);
  const kk = window.kk(); kk.dashLeg(2, { h: 1.9 }); out.knocked = { leg: S.leg[2], stun: +S.stun.toFixed(2), open: S.open, state: S.state, hits: S.hits }; return out; });
check('a leg caught off the ground is knocked away: it cracks, and the Keeper stumbles, open', s.liftedBefore > 0.5 && s.knocked.leg === 3 && s.knocked.stun > 0.8 && s.knocked.open === true, JSON.stringify(s));

// damage you can read: whole, cracked, numb, a stump; each its own look
s = await ev(() => { window.__game.startRun(31); const { g, T, G, S, F, home, ready } = window.kk(), out = {}; home(); ready({ cool: 99, stompT: 99, bellyT: 99 }); g.sim(0.1, T.none()); const L = G.rig.walker.legs[3], R = G.rig;
  const look = () => ({ glow: '#' + L.upper.material.emissive.getHexString(), lit: +L.upper.material.emissiveIntensity.toFixed(2), stump: R.cracks[3].visible, there: L.upper.parent === G.mesh });
  out.whole = look(); G.debug.crack ? G.debug.crack(3) : null; S.stun = 0; g.sim(0.1, T.none()); out.cracked = look(); out.crackedState = S.leg[3];
  G.debug.numb(3); S.stun = 0; g.sim(0.1, T.none()); out.numb = look(); out.numbState = S.leg[3]; G.debug.tear(3, false); S.stun = 0; g.sim(0.1, T.none()); out.off = look(); out.offState = S.leg[3]; return out; });
check('each leg shows what has been done to it: whole, cracked (its seams glow red), numb (pale and flickering), and a stump in its socket when it has gone', s.crackedState === 3 && s.numbState === 1 && s.offState === 2 && s.whole.glow !== s.cracked.glow && s.cracked.glow !== s.numb.glow && !s.whole.stump && s.off.stump && !s.off.there, JSON.stringify(s));

// the stomp: a body under it; a leg up high and held (the tell, the spot marked), then down where the body was; stuck there; a ram on it counts double
s = await ev(() => { window.__game.startRun(31); const { g, T, G, S, F, home, ready, until } = window.kk(), out = {}; const under = () => { const yaw = G.mesh.rotation.y, x = G.pos.x, z = G.pos.z; T.put(x - Math.cos(yaw) * 2.6 + Math.sin(yaw) * 0.5, g.world.height(x, z) + 1.6, z + Math.sin(yaw) * 2.6 + Math.cos(yaw) * 0.5, yaw + Math.PI / 2); };
  home(); ready({ stompT: 0 }); under(); g.sim(1 / 60, T.none()); const segs = g.run.segs; const t0 = until('stomp', 2) ? g.run.time : null; const li = S.stomp ? S.stomp.leg : -1, L = G.rig.walker.legs[li], at = S.stomp && S.stomp.at.clone();
  g.sim(F.stomp.tell * 0.75, T.none()); out.held = { up: +(L.foot.y - at.y).toFixed(2), over: +Math.hypot(L.foot.x - at.x, L.foot.z - at.z).toFixed(2), mark: G.shapes(g.sctx).some((x) => x.role === 'blow') };
  until('pinned', 1); g.sim(0.05, T.none()); out.down = { lost: segs - g.run.segs, at: +Math.hypot(L.foot.x - at.x, L.foot.z - at.z).toFixed(2), stuck: +S.stomp?.stuck?.toFixed(2), told: +(g.run.time - t0).toFixed(2) };
  { const kk = window.kk(), was = S.open; kk.dashLeg(li, { h: 0.9, out: 2.2 }); out.ram = { leg: S.leg[li], open: was }; } // a ram on the stuck leg, though it is not open: whole to numb at once
  // and a body that has gone when the spike comes down is not touched
  home(); ready({ stompT: 0 }); under(); until('stomp', 2); const s2 = g.run.segs; const yaw = G.mesh.rotation.y; T.put(G.pos.x + Math.sin(yaw) * 12, g.rig.pos.y, G.pos.z + Math.cos(yaw) * 12, yaw); until('pinned', 2); out.gone = s2 - g.run.segs;
  return out; });
check('a body under it is stomped: a leg goes up high and holds over where the body was, its spot marked, then comes down there, takes two, and sticks; a ram on that leg counts double even though the crab is not open; a body that has gone is not touched', s.held.up > 3 && s.held.over < 0.8 && s.held.mark && s.down.lost === 2 && s.down.at < 0.8 && s.down.stuck > 1 && s.down.told >= 0.8 && s.ram.leg === 1 && s.ram.open === false && s.gone === 0, JSON.stringify(s));

// lingering under it: it heaves itself up (the tell) and drops its weight; then it lies on its belly, open
s = await ev(() => { window.__game.startRun(31); const { g, T, G, S, F, home, ready, until } = window.kk(), out = {}; home(); ready({ stompT: 99, bellyT: 0 }); const yaw = G.mesh.rotation.y, x = G.pos.x, z = G.pos.z; T.put(x - Math.cos(yaw) * 1.2 - Math.sin(yaw) * 2, g.world.height(x, z) + 1.6, z + Math.sin(yaw) * 1.2 - Math.cos(yaw) * 2, yaw);
  const segs = g.run.segs; const t0 = g.run.time; until('heave', 6); out.after = +(g.run.time - t0).toFixed(1); const t1 = g.run.time; until('grounded', 2); out.tell = +(g.run.time - t1).toFixed(2); out.lost = segs - g.run.segs; g.sim(0.1, T.none()); out.open = S.open; out.low = +(G.mesh.position.y - g.world.height(G.pos.x, G.pos.z)).toFixed(2); return out; });
check('a fish that lingers under it for three seconds: it heaves itself up, a tell of most of a second, and drops its weight for three; then it lies on its belly, open', s.after >= 2.9 && s.after < 4 && s.tell >= 0.85 && s.lost === 3 && s.open && s.low < 2, JSON.stringify(s));

// wrap and haul: a body wound round a whole leg holds it; swum away, it drags the foot out from under it, and over it goes: the leg numb
s = await ev(() => { window.__game.startRun(31); const { g, T, G, S, F, home, ready } = window.kk(), out = {}; home(); ready({ cool: 99, stompT: 99, bellyT: 99 }); g.run.safe = 1e9; g.sim(0.2, T.none()); G.debug.set('rest', 60); S.stun = 0; // (it stands still while the body goes round)
  const L = G.rig.walker.legs[1], f0 = L.foot.clone(); { const kk = window.kk(), { p, ox, oz } = kk.legAt(1, 1.6); const r = (g.rig.length + 0.8) / (Math.PI * 2); T.put(p.x - oz * r, p.y, p.z + ox * r, Math.atan2(ox, oz)); }
  let t = 0, prog = 0; while (!S.held && t < 8) { g.sim(0.1, { ...T.none(), coil: 1 }); t += 0.1; prog = Math.max(prog, G.ring ? G.ring.progress : 0); } out.wrap = { held: !!S.held, leg: S.held ? S.held.leg : -1, t: +t.toFixed(1), prog: +prog.toFixed(2) }; const HL = out.wrap.leg >= 0 ? G.rig.walker.legs[out.wrap.leg] : L, f1 = HL.foot.clone();
  const dx = HL.foot.x - G.pos.x, dz = HL.foot.z - G.pos.z, d = Math.hypot(dx, dz), go = { ...T.none(), dir: { x: dx / d, y: 0, z: dz / d } }; t = 0; while (S.held && t < 4) { g.sim(0.05, go); t += 0.05; }
  out.haul = { t: +t.toFixed(2), leg: S.leg[out.wrap.leg], stun: +S.stun.toFixed(1), open: S.open, state: S.state, dragged: +HL.foot.distanceTo(f1).toFixed(1) }; return out; });
check('a body wound round any leg holds it; swum away, it drags the foot out from under the Keeper, which goes over, open, and that leg goes numb', s.wrap.held && s.haul.leg === 1 && s.haul.stun > 1.5 && s.haul.open && s.haul.dragged > 1.5 && s.haul.t < 2.2, JSON.stringify(s));

// held and not hauled, it sheds the leg itself; the leg lies where it fell, and it is food: a little length back
s = await ev(() => { window.__game.startRun(31); const { g, T, G, S, F, home, ready } = window.kk(), out = {}; home(); ready({ cool: 99, stompT: 99, bellyT: 99 }); g.run.safe = 1e9; g.sim(0.2, T.none()); const lost0 = S.lost;
  G.debug.set('rest', 60); S.stun = 0; S.wrapLeg = 5; G.wrapped(); const f = G.rig.walker.legs[5].foot; T.put(f.x + 0.9, g.world.height(f.x, f.z) + 1.6, f.z + 0.9, 0); g.sim(0.1, T.none());  let t = 0; while (S.held && t < 5) { g.sim(0.05, T.none()); t += 0.05; }
  out.shed = { t: +t.toFixed(2), leg: S.leg[5], lost: S.lost - lost0, limbs: G.debug.limbs().map((b) => (b.eaten ? 'eaten' : 'lying') + (b.self ? ' shed' : '')).join() }; const limb = G.debug.limbs().find((b) => !b.eaten); if (!limb) return out; out.lies = limb ? +(limb.pos.y - g.world.height(limb.pos.x, limb.pos.z)).toFixed(2) : null; g.sim(1.2, T.none()); out.settled = limb ? +(limb.pos.y - g.world.height(limb.pos.x, limb.pos.z)).toFixed(2) : null;
  S.cool = 99; G.debug.set('rest', 30); const food0 = g.run.food, segs0 = g.run.segs; T.put(limb.pos.x - 1.6, limb.pos.y + 1.4, limb.pos.z, Math.PI / 2); g.run.safe = 1e9; t = 0; while (!limb.eaten && t < 3) { g.sim(0.05, { ...T.none(), dir: { x: 1, y: -0.3, z: 0 }, amount: 0.4 }); t += 0.05; }
  g.sim(2, T.none()); out.ate = { eaten: limb.eaten, t: +t.toFixed(2), food: g.run.food - food0, segs: g.run.segs - segs0 }; return out; });
check('a leg held and not hauled the Keeper sheds itself, and it counts as a leg gone; the leg lies on the bed, and the fish that eats it gets a little length back', s.shed.leg === 2 && s.shed.lost === 1 && s.shed.t >= 2.1 && s.settled < 1.0 && s.ate.eaten && (s.ate.food > 0 || s.ate.segs > 0), JSON.stringify(s));

// which legs are gone matters: lists and is slower with the great claw's side lame; cannot run with its hind legs gone; turns worse toward its lame side
s = await ev(() => { const g = window.__game, out = {};
  const withGone = (legs, fn) => { g.startRun(31); const { G, S } = window.kk(); for (const i of legs) { G.debug.tear(i, false); S.stun = 0; } const kk = window.kk(); kk.home(); kk.ready(); return fn(kk); };
  const wind = (kk) => { kk.lie(4.8); kk.until('slam', 3); return kk.S.state === 'slam' ? +kk.S.T.toFixed(2) : kk.S.state; };
  out.windSound = withGone([0, 1], wind); out.windClaw = withGone([4, 5], wind); // two gone either way (so it rages either way); on its left, its small claw's side, and on its right, its great claw's
  out.list = withGone([4, 5], (kk) => { kk.S.cool = 99; kk.g.sim(1.5, kk.T.none()); return { list: +kk.S.list.toFixed(2), roll: +kk.G.mesh.rotation.z.toFixed(2) }; });
  out.ran = withGone([3, 7], (kk) => { kk.S.chargeT = 0; kk.S.digT = 0; kk.lie(10); const seen = new Set(); for (let t = 0; t < 4; t += 0.05) { kk.g.sim(0.05, kk.T.none()); seen.add(kk.S.state); } return [...seen].join(); });
  out.ranWhole = withGone([0, 4], (kk) => { kk.S.chargeT = 0; kk.S.digT = 0; kk.lie(10); const seen = new Set(); for (let t = 0; t < 4; t += 0.05) { kk.g.sim(0.05, kk.T.none()); seen.add(kk.S.state); } return [...seen].join(); });
  // turning: how far round it gets in a quarter of a second toward a fish 1.4 rad to its left, and to its right, with two legs gone on its right
  const turn = (side) => withGone([4, 6], (kk) => { const { G, S, T, g } = kk; S.cool = 99; g.sim(0.3, T.none()); const y0 = G.yaw, a = y0 + side * 1.4; T.put(G.pos.x + Math.sin(a) * 9, G.pos.y - 1.6, G.pos.z + Math.cos(a) * 9, a); G.debug.set('stalk'); g.run.safe = 1e9; g.sim(0.25, T.none()); return +Math.abs(Math.atan2(Math.sin(G.yaw - y0), Math.cos(G.yaw - y0))).toFixed(2); });
  out.toSound = turn(1); out.toLame = turn(-1); return out; });
check('which legs are gone matters: with two gone on its great claw’s side it lists that way and its great claw is slower to come down; with its hind legs gone it neither runs nor digs; it turns slower toward its lame side', s.list.list > 0.2 && Math.abs(s.list.roll) > 0.1 && s.windClaw > s.windSound * 1.25 && !/charge|dig/.test(s.ran) && /charge|dig/.test(s.ranWhole) && s.toLame < s.toSound * 0.85, JSON.stringify(s));

// the wave: slow far off, quicker as the fish nears, frantic just before a blow; and the first time, it waves a while before it fights
s = await ev(() => { window.__game.startRun(31); const { g, T, G, S, F, home, ready, lie, until } = window.kk(), out = {}; home(); ready({ cool: 99, stompT: 99, bellyT: 99 }); g.run.safe = 1e9; const yaw = G.mesh.rotation.y; out.hz = [];
  for (const far of [16, 11, 7]) { T.put(G.pos.x + Math.sin(yaw) * far, g.world.height(G.pos.x, G.pos.z) + 2, G.pos.z + Math.cos(yaw) * far, yaw + Math.PI); g.sim(0.8, T.none()); out.hz.push(+G.rig.pose.hz.toFixed(2)); }
  S.cool = 0.5; g.sim(0.3, T.none()); out.frantic = +G.rig.pose.hz.toFixed(2);
  home(); ready(); S.met = false; G.debug.set('idle'); S.cool = 0; lie(4.8); const t0 = g.run.time; until('stalk', 2); until('slam', 6); out.bluff = +(g.run.time - t0).toFixed(2); return out; });
check('the great claw waves at a fish, slowly far off and quicker as it nears; frantic in the moment before a blow; and the first time a fish comes near it waves a while before it strikes', s.hz[0] < s.hz[1] && s.hz[1] < s.hz[2] && s.frantic > s.hz[2] * 1.8 && s.bluff >= 1.5, JSON.stringify(s));

// four legs and it is done, and it rages at two (and it still leaves a shell and opens the rift)
s = await ev(() => { window.__game.startRun(31); const { g, T, G, S, F, home, ready } = window.kk(); home(); ready({ cool: 99 }); const shells0 = g.field.items.length; let rage = null;
  for (const i of [0, 1, 2, 3]) { if (S.lost === F.rage) rage = S.lost; G.debug.tear(i, false); S.stun = 0; } g.sim(0.5, T.none()); return { legs: F.legs, rage: F.rage, ragedAt: rage, done: G.done, dropped: g.field.items.length - shells0 }; });
check('four legs gone and the Keeper is done (it raged from two)', s.legs === 4 && s.rage === 2 && s.ragedAt === 2 && s.done && s.dropped === 1, JSON.stringify(s));

await ev(() => { try { localStorage.clear(); } catch {} });
await browser.close(); server.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nall boss checks passed');
process.exit(failures ? 1 : 0);
