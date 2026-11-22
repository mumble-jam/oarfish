// Scripted checks of the last band: the Sum, the two endings, the surfacing.
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
await page.addInitScript((flat) => { window.__lowpoly = flat; window.__noNursery = true; }, process.env.LOOK !== 'soft');
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
await ev(() => { try { localStorage.clear(); } catch {} });
await browser.close(); server.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nall boss checks passed');
process.exit(failures ? 1 : 0);
