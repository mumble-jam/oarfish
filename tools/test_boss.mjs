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
    ready(o = {}) { G.debug.set('stalk'); Object.assign(S, { cool: 0, stun: 0, flash: 0, jabT: 9, chargeT: 9, digT: 9, last: '' }, o); g.run.segs = 16; g.buildFish(16); g.run.safe = 0; g.run.hush = 0; },
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
check('the Keeper: a switch in the pause menu draws its fight’s shapes over the picture: the fish’s body, its shell, each leg (and whether it can be hurt now), and the blow on its way', s.on && s.pressed === 'true' && s.drawn > 500 && s.off && s.roles.fish >= 17 && s.roles.solid === 1 && s['roles']['leg-'] === 16 && s.roles.blow === 2 && s.state === 'slam', JSON.stringify(s));

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
check('the great claw hits where it is drawn as it lands, not a disc: what it is judged by is the claw as drawn (and the mark on the bed showed it, near enough); a body under the hand is taken, and one lying alongside, just clear of the jolt where its fingers hit, is not', s.under.lost === 3 && s.under.gap < 0 && s.beside.lost === 0 && s.beside.gap > 0 && s.under.drawnOff < 0.2 && s.under.markOff < 0.35 && s.under.hand > 0.4, JSON.stringify(s));

// every other blow: whenever one takes a part of the body, the shape it was judged by (the claw as drawn, the crab's shell and legs as it runs, its shell coming up) touches the body as drawn
s = await ev(() => { const { g, T, G, S, F, home, ready, lie, until, sh } = window.kk(), out = {};
  const watch = (name, set, wantState, secs = 5) => { home(); ready(set.o); set.place(); if (set.rage) { S.lost = F.rage; } if (!until(wantState, 6)) return (out[name] = { skipped: S.state });
    let t = 0, lost = 0, gap = null, what = ''; g.run.safe = 0; const segs = g.run.segs;
    while (t < secs && !lost) { g.sim(1 / 60, T.none()); t += 1 / 60; lost = segs - g.run.segs; if (lost) { const hot = G.shapes(g.sctx).filter((x) => x.role === 'blow' && x.hot); gap = Math.min(...hot.map((x) => Math.min(...G.debug.body().map((c) => sh.gap(x, c.a, c.b, c.r))))); what = hot.map((x) => x.t).join(); } }
    out[name] = { lost, gap: gap === null ? null : +gap.toFixed(2), what }; S.lost = 0; };
  watch('sweep', { o: { last: 'slam' }, place: () => lie(3.0) }, 'sweep');
  watch('jab', { o: { jabT: 0 }, place: () => lie(1.9, 1.1) }, 'jab');
  watch('charge', { o: { chargeT: 0 }, place: () => { const r = g.world.rift, a = Math.atan2(r.x - r.nx * 24 - G.pos.x, r.z - r.nz * 24 - G.pos.z); lie(6.5, a - G.mesh.rotation.y); } }, 'charge');
  watch('rise', { o: { digT: 0, chargeT: 0 }, rage: true, place: () => lie(8.5) }, 'dig', 8);
  return out; });
check('every blow that takes part of the body was judged by a shape touching the body as it is drawn: the sweep by the great claw where it is, a jab by the small claw, a run by the crab’s shell and legs, and its rising from the sand by its shell', ['sweep', 'jab', 'charge', 'rise'].every((k) => s[k].lost > 0 && s[k].gap !== null && s[k].gap <= 0.21) && /cap/.test(s.sweep.what) && /cap/.test(s.jab.what) && /prism/.test(s.rise.what), JSON.stringify(s));

// a leg is hit where it is drawn: a dash that passes over a leg does not touch it, one that meets it does; and it can only be hurt while the crab is open
s = await ev(() => { const { g, T, G, S, F, home, ready, solids, sh } = window.kk(), out = {};
  const dashAt = (i, lift) => { home(); ready(); G.debug.set('stuck', 4); g.sim(0.05, T.none()); const L = solids().find((x) => x.leg === i); let m = L.a.clone().lerp(L.b, 0.85); // near the knee
    if (lift) for (const x of solids()) if (x.leg === i) for (const p of [x.a, x.b]) if (p.y > m.y) m = p.clone(); // over it: measured from its highest point (the knee), not from a point below it (merge into squid-play: from 0.85 of the way up, the knee could rise within reach)
    const dx = m.x - G.pos.x, dz = m.z - G.pos.z, d = Math.hypot(dx, dz), at = { ...T.none(), dir: { x: -dx / d, y: 0, z: -dz / d } };
    T.put(m.x + dx / d * 2.4, m.y + lift, m.z + dz / d * 2.4, Math.atan2(-dx, -dz)); g.run.safe = 5; g.run.dashCool = 0; g.run.stamina = 1; const h = S.hits; g.sim(1 / 60, { ...at, dashNow: true }); g.sim(0.35, at); const hit = S.hits > h; S.leg.fill(0); S.hits = 0; return hit; };
  out.met = dashAt(5, 0); out.over = dashAt(5, 1.7); out.metOther = dashAt(6, 0); out.knees = solids().filter((x) => x.leg >= 0 && x.r > 0.15).map((x) => +(x.b.y - g.world.height(x.b.x, x.b.z)).toFixed(2)); // (the knees, over the bed: in front they are low while it is stuck, its weight forward on the claw)
  home(); ready({ cool: 99 }); g.sim(0.05, T.none()); { const L = solids().find((x) => x.leg === 1), m = L.a.clone().lerp(L.b, 0.85), dx = m.x - G.pos.x, dz = m.z - G.pos.z, d = Math.hypot(dx, dz), at = { ...T.none(), dir: { x: -dx / d, y: 0, z: -dz / d } };
    T.put(m.x + dx / d * 2.4, m.y, m.z + dz / d * 2.4, Math.atan2(-dx, -dz)); g.run.safe = 5; g.run.dashCool = 0; g.run.stamina = 1; g.sim(1 / 60, { ...at, dashNow: true }); g.sim(0.35, at); out.closed = { hits: S.hits, leg: S.leg[1], open: S.open }; }
  return out; });
check('a leg is hit where it is drawn, in three dimensions: a dash that meets a leg at the knee numbs it, one that passes a metre and a half over the same knee does not, and a leg it stands on while it is not open turns the ram', s.met && s.metOther && !s.over && s.closed.hits === 0 && s.closed.leg === 0, JSON.stringify(s));

// a shed tail lying where it cannot get to it: it gives up, goes back to the fight, and does not go for that one again
s = await ev(() => { const { g, T, G, S, F, W, home, ready, until } = window.kk(); home(); ready(); g.sim(0.1, T.none());
  const a = Math.atan2(G.pos.x - W.x, G.pos.z - W.z), far = F.leash + 3; G.pos.set(W.x + Math.sin(a) * (F.leash - 1.5), 0, W.z + Math.cos(a) * (F.leash - 1.5)); G.pos.y = g.world.height(G.pos.x, G.pos.z) + 0.9; g.sim(0.1, T.none());
  const out = far + g.rig.length, x = W.x + Math.sin(a) * out, z = W.z + Math.cos(a) * out; T.put(x, g.world.height(x, z) + 1.6, z, a); g.sim(0.05, T.none()); g.run.safe = 0; g.shed(); g.run.safe = 1e9; const tail = g.foes.pieces.find((p) => p.kind === 'decoy' && !p.dead); // the tail left lying past its leash, the fish swum back in close
  T.put(G.pos.x + Math.sin(a) * 4, G.pos.y + 1, G.pos.z + Math.cos(a) * 4, a); S.state = 'stalk'; const seen = []; let t = 0, fetchT = 0;
  while (t < 14) { g.sim(0.05, T.none()); t += 0.05; if (S.state === 'fetch') fetchT += 0.05; if (seen[seen.length - 1] !== S.state) seen.push(S.state); if (tail) tail.life = Math.max(tail.life, 1); }
  return { seen: seen.join(','), fetchT: +fetchT.toFixed(1), last: S.state, tailFar: tail ? +Math.hypot(tail.pos.x - W.x, tail.pos.z - W.z).toFixed(1) : null }; });
check('a shed tail lying past the Keeper’s ground does not hold it: it gives up on it (at once, or within a few seconds of trying) and goes on with the fight', s.fetchT <= 7 && s.last !== 'fetch' && /slam|sweep|jab/.test(s.seen) && s.tailFar > 13, JSON.stringify(s));

await ev(() => { try { localStorage.clear(); } catch {} });
await browser.close(); server.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nall boss checks passed');
process.exit(failures ? 1 : 0);
