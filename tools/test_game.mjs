// Scripted checks of every mechanic in headless Chrome, plus screenshots.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { chromium } from 'playwright';
import { audit } from './audit_fn.mjs';
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

async function open(vp, touch = false) {
  const ctx = await browser.newContext({ viewport: vp, hasTouch: touch, isMobile: touch });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { failures++; console.log('[pageerror]', e.message); });
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/fonts\.g|ERR_|Failed to load resource|GPU stall|GL Driver|AudioContext/.test(m.text())) console.log(`[${m.type()}]`, m.text().slice(0, 300)); });
  await page.addInitScript(() => { window.__noNursery = true; });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
  await page.evaluate(() => { window.__hold = true; });
  return page;
}
const frame = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const snap = async (page, name) => { if (!shots) return; await page.evaluate(() => { const g = window.__game; g.run.safe = 0; g.sim(0.02, window.T ? window.T.none() : undefined); }); await frame(page); await page.screenshot({ path: out(name) }); };

const page = await open({ width: 1440, height: 820 });
// helpers that live in the page
await page.evaluate(() => {
  const g = window.__game;
  const none = () => ({ dir: null, amount: 1, vertical: 0, sprint: false, gentle: false, coil: 0, tight: false, bite: false });
  window.T = {
    none,
    put(x, y, z, yaw = 0) { g.rig.reset(g.rig.pos.clone().set(x, y, z), yaw); g.snap(); },
    // park the fish so that a coil to the left is centred on (cx, cz)
    aroundPoint(cx, y, cz, yaw = 0) { const r = (g.rig.length + 0.8) / (Math.PI * 2); this.put(cx - Math.cos(yaw) * r, y, cz + Math.sin(yaw) * r, yaw); },
    coil(seconds, tight = false) { g.sim(seconds, { ...none(), coil: 1, tight }); },
    idle(seconds) { g.sim(seconds, none()); },
    swim(seconds, dx, dz, extra = {}) { g.sim(seconds, { ...none(), dir: { x: dx, y: 0, z: dz }, ...extra }); },
    swarm(tier) { g.sim(0.05, none()); return g.world.schools.find((s) => s.tier === tier && s.left > 0 && !s.kind); }, // one of the plain sort
    toward(b, secs, stop = 0) { for (let t = 0; t < secs; t += 0.1) { const dx = b.x - g.rig.pos.x, dz = b.z - g.rig.pos.z, d = Math.hypot(dx, dz) || 1; if (d < stop) break; g.sim(0.1, { ...none(), dir: { x: dx / d, y: 0, z: dz / d }, vertical: Math.max(-1, Math.min(1, (b.y - g.rig.pos.y) * 1.5)) }); } },
    safeOff() { g.run.safe = 0; },
  };
});
const ev = (fn, arg) => page.evaluate(fn, arg);

// 1. boot
let s = await ev(() => { const g = window.__game; return { segs: g.run.segs, len: +g.rig.length.toFixed(2), floor: g.world.floor.name, stats: g.world.stats, state: g.run.state, bones: g.rig.spine.length }; });
check('boots into the first band', s.state === 'play' && s.segs === 10 && s.bones === 10, JSON.stringify(s));
await ev(() => window.T.idle(1)); await snap(page, 'g-start');

// 2. holding a coil key anywhere near a small swarm wraps it, with no careful placement
s = await ev(() => { const g = window.__game, T = window.T; const sw = T.swarm('s'); const out = [];
  for (const [ox, oz, yaw] of [[2.6, 0.9, 1.1]]) { T.put(sw.x + ox, sw.hy, sw.z + oz, yaw); T.idle(0.8); const before = { segs: g.run.segs, caught: g.run.caught }; let t = 0, prog = 0; while (sw.left > 0 && t < 9) { T.coil(0.1); t += 0.1; prog = Math.max(prog, sw.progress); } T.idle(1.2); out.push({ before, t: +t.toFixed(1), left: sw.left, n: sw.n, prog: +prog.toFixed(2), segs: g.run.segs, caught: g.run.caught, can: sw.can, orbit: +sw.orbit.toFixed(2), fit: +sw.fit.toFixed(2) }); }
  return out[0]; });
check('holding coil near a small swarm wraps and takes it whole', s.left === 0 && s.caught === s.before.caught + s.n, JSON.stringify(s));
check('eating grows the body', s.segs > s.before.segs, `${s.before.segs} → ${s.segs} segments`);
// ...and so does circling it loosely by steering, from an off-centre start
s = await ev(() => { const g = window.__game, T = window.T; const sw = T.swarm('s'); T.put(sw.x - 1.9, sw.hy, sw.z + 1.3, 2.4); T.idle(0.8); let t = 0, ang = 0; while (sw.left > 0 && t < 12) { // steer at a point that circles the swarm a quarter-turn ahead of the fish, sloppily
    const a = Math.atan2(g.rig.snout.x - sw.x, g.rig.snout.z - sw.z) + 1.25, R = 1.25 + 0.35 * Math.sin(t * 3); const tx = sw.x + Math.sin(a) * R, tz = sw.z + Math.cos(a) * R; const dx = tx - g.rig.pos.x, dz = tz - g.rig.pos.z, d = Math.hypot(dx, dz);
    g.sim(0.05, { ...T.none(), dir: { x: dx / d, y: 0, z: dz / d }, amount: 0.5 }); t += 0.05; } T.idle(1.2); return { t: +t.toFixed(1), left: sw.left }; });
check('a loose, wobbly circle steered by hand also takes it', s.left === 0, JSON.stringify(s));
// with the assist off, the same sloppy circle is not enough but a careful one is
s = await ev(() => { const g = window.__game, T = window.T; g.feel.assist = 0; const sw = T.swarm('s'); T.aroundPoint(sw.x, sw.hy, sw.z, 0); T.idle(0.6); let t = 0; while (sw.left > 0 && t < 10) { T.aroundPoint; T.coil(0.1); t += 0.1; } const careful = sw.left; g.feel.assist = 0.6; return { careful, t: +t.toFixed(1) }; });
console.log('      (assist off, plain widest coil centred by hand: swarm left =', s.careful, 'after', s.t, 's)');
await snap(page, 'g-after-catch');

// 4. the great swarm cannot be taken yet
s = await ev(() => { const g = window.__game, T = window.T; const sw = T.swarm('h'); const caught = g.run.caught; T.put(sw.x + 2.6, sw.hy, sw.z + 0.9, 1.1); T.idle(0.8); let burst = 0; for (let i = 0; i < 80; i++) { T.coil(0.1); burst = Math.max(burst, sw.burst); }
  return { left: sw.left, n: sw.n, gained: g.run.caught - caught, can: sw.can, ring: sw.ring.material.color.getHexString(), burst: +burst.toFixed(2) }; });
check('great swarm is too big for a short body', s.left === s.n && s.can === false && s.ring === 'ff7f96', JSON.stringify(s));
await ev(() => { const g = window.__game, T = window.T; const sw = T.swarm('m'); T.put(sw.x + 2.2, sw.hy, sw.z + 0.9, 1.1); T.idle(0.8); T.coil(1.4); }); await snap(page, 'g-toobig');
// ...and can once the body is long
s = await ev(() => { const g = window.__game, T = window.T; g.run.segs = 26; g.buildFish(26); const sw = T.swarm('h'); T.put(sw.x + 3.4, sw.hy, sw.z + 1.2, 1.1); T.idle(0.8); let t = 0; while (sw.left > 0 && t < 14) { T.coil(0.1); t += 0.1; } T.idle(1.5); return { left: sw.left, t: +t.toFixed(1), len: +g.rig.length.toFixed(2) }; });
check('great swarm taken by a long body', s.left === 0, JSON.stringify(s));
// gates: which swarm each length can take
s = await ev(() => { const g = window.__game, T = window.T; const out = {}; for (const n of [10, 13, 14, 18, 19, 23, 24, 26]) { g.run.segs = n; g.buildFish(n); T.idle(0.1); out[n] = ['s', 'm', 'l', 'h'].filter((tier) => { const sw = g.world.schools.find((x) => x.tier === tier); return sw && sw.can; }).join(''); } return out; });
console.log('      swarm sizes each body length can take:', JSON.stringify(s));
await snap(page, 'g-long');

// 5. band two: biters
s = await ev(() => { const g = window.__game, T = window.T; g.run.segs = 12; g.buildFish(12); g.enterFloor(1, false); T.idle(2); g.run.safe = 0;
  const b = g.foes.biters[0], J = g.rig.joints, N = J.length - 1; b.pos.copy(J[N]).x += 0.8; b.cool = 0; const before = g.run.segs; T.idle(1.2);
  return { before, after: g.run.segs, state: b.state, pieces: g.foes.pieces.length, safe: +g.run.safe.toFixed(2), floor: g.world.floor.name, counts: [g.foes.biters.length, g.foes.hooks.length] }; });
check('a biter at the tail takes two segments', s.after === s.before - 2 && s.state === 'chew', JSON.stringify(s));
s = await ev(() => { const g = window.__game, T = window.T; g.run.safe = 0; const b = g.foes.biters[1]; b.state = 'roam'; b.cool = 0; b.pos.copy(g.rig.snout); b.pos.x += 1.0; T.idle(0.2); const st1 = b.state; const d0 = b.pos.distanceTo(g.rig.snout); T.idle(0.8); return { st1, d0: +d0.toFixed(2), d1: +b.pos.distanceTo(g.rig.snout).toFixed(2) }; });
check('a biter near the head flees', s.st1 === 'flee' && s.d1 > s.d0 + 1, JSON.stringify(s));
s = await ev(() => { const g = window.__game, T = window.T; g.run.safe = 0; const before = g.run.segs; g.shed(); const b = g.foes.biters[1]; b.state = 'roam'; b.cool = 0; b.t = 0; T.idle(0.4);
  return { before, after: g.run.segs, decoys: g.foes.pieces.filter((p) => p.kind === 'decoy').length, biter: b.state, boost: g.rig.boost > 0 }; });
check('shedding costs three segments and draws the biters', s.after === s.before - 3 && s.decoys === 1 && (s.biter === 'decoy' || s.biter === 'chew'), JSON.stringify(s));
s = await ev(() => { const g = window.__game, T = window.T; T.idle(9); g.run.safe = 0; g.run.segs = 14; g.buildFish(14); const b = g.foes.biters[2];
  // somewhere with nothing standing within a coil's reach, and well away from the rift
  const free = (x, z) => { const y = g.world.height(x, z) + 3.5; for (let k = 0; k < 8; k++) { const p = g.rig.pos.clone().set(x + Math.sin(k * 0.785) * 4.5, y, z + Math.cos(k * 0.785) * 4.5), q = p.clone(); g.world.pushOut(q, 1.4); if (q.distanceTo(p) > 1e-6) return false; }
    const R = g.world.react, off = (o, d) => Math.hypot((o.cx ?? o.x) - x, (o.cz ?? o.z) - z) > d; // and nothing the wrap keys would rather go round, or that would start something
    return g.world.rift.in(x, z) < -12 && g.world.schools.every((sc) => sc.left <= 0 || off(sc, 9)) && R.stations.every((o) => off(o, 8)) && R.fragments.every((o) => off(o, 7)) && R.puzzles.every((o) => off(o, 9)) && (!R.mural || off(R.mural, 6)); };
  let sx = 30, sz = 30, found = false; find: for (let d = 0; d < 70; d += 3) for (let k = 0; k < 12; k++) { const x = 30 + Math.sin(k * 0.5236) * d, z = 30 + Math.cos(k * 0.5236) * d; if (free(x, z)) { sx = x; sz = z; found = true; break find; } }
  const y = g.world.height(sx, sz) + 3.5; T.put(sx, y, sz, 0); T.idle(0.3);
  const r = (g.rig.length + 0.8) / (Math.PI * 2); const cx = sx + r, cz = sz; b.pos.set(cx, y, cz); b.vel.set(0, 0, 0); b.cool = 99; b.state = 'chew'; b.t = 99; b.wander.copy(b.pos); const caught = g.run.caught; T.coil(5); T.idle(2.5);
  return { alive: b.alive, gained: g.run.caught - caught, at: [Math.round(sx), Math.round(sz)], found, floor: g.run.floor }; });
check('a biter inside a closed loop is caught', s.found && s.alive === false && s.gained >= 3, JSON.stringify(s));

// 6. hooks
s = await ev(() => { const g = window.__game, T = window.T; g.run.safe = 0; const h = g.foes.hooks[0]; const y = g.world.height(100, 40) + 3.2; T.put(100, y, 40, 0); T.idle(0.5); g.run.safe = 0;
  const J = g.rig.joints[5]; const t = g.world.time.value; h.x = J.x - Math.sin(t * 0.23 + h.ph * 2) * 1.4; h.z = J.z - Math.cos(t * 0.19 + h.ph) * 1.4; h.y0 = J.y - Math.sin(t * 0.55 + h.ph) * 1.3; h.state = 'idle'; h.lift = 0; const before = g.run.segs; T.idle(0.3);
  return { before, after: g.run.segs, hook: h.state }; });
check('a hook that touches the body takes two segments and reels in', s.after === s.before - 2 && s.hook === 'reel', JSON.stringify(s));
await ev(() => window.T.swim(2, 0.6, -0.8)); await snap(page, 'g-band2');

// 7. band three: anglers in the dark
s = await ev(() => { const g = window.__game, T = window.T; g.run.segs = 14; g.buildFish(14); g.enterFloor(2, false); T.idle(2); g.run.safe = 0;
  const a = g.foes.anglers[0], J = g.rig.joints[6]; a.home.set(J.x + 1.9, J.y, J.z); a.pos.copy(a.home); a.state = 'lurk'; const before = g.run.segs; let states = new Set(); for (let i = 0; i < 30; i++) { T.idle(0.05); states.add(a.state); }
  return { before, after: g.run.segs, states: [...states], lamp: g.world.floor.lamp, floor: g.world.floor.name }; });
check('an angler winds up, lunges and takes three segments', s.after === s.before - 3 && s.states.includes('windup') && s.states.includes('lunge'), JSON.stringify(s));
await ev(() => { const g = window.__game, T = window.T; const a = g.foes.anglers[1]; const y = a.home.y + 0.6; T.put(a.home.x - 5, y, a.home.z + 1.5, Math.PI / 2); T.idle(0.4); }); await snap(page, 'g-band3');

// 8. the rift leads down
s = await ev(() => { const g = window.__game, T = window.T; const w = g.world.goal, r = g.world.rift; const bottom = g.world.height(w.x, w.z), deep = r.y - 9;
  T.put(w.x, r.ledgeY + 1.2, w.z, 0); T.idle(0.2); const over = g.rig.pos.y; T.put(w.x - 1, deep, w.z, 0); T.idle(0.3); // on to the ledges it may go; between the walls it may not
  window.__sealed = { state: g.run.state, held: g.rig.pos.y > r.ledgeY, belowShelf: over < r.y, guard: g.guard.kind, depth: +(r.y - bottom).toFixed(1), ledge: +(r.y - g.world.height(w.x + r.nx * (r.w(0) - 3), w.z + r.nz * (r.w(0) - 3))).toFixed(1), shelf: +(r.y - g.world.height(w.x + r.nx * (r.w(0) + 2), w.z + r.nz * (r.w(0) + 2))).toFixed(1) };
  g.guard.debug.fall(); T.put(w.x, r.y + 1, w.z, 0); T.idle(0.2); const s0 = g.run.state; T.put(w.x + r.tx * 14 + r.nx * r.mid(14), deep, w.z + r.tz * 14 + r.nz * r.mid(14), 0); T.idle(0.1); const s1 = g.run.state; T.idle(1.0); const s2 = g.run.state, f2 = g.run.floor; T.idle(2); return { s0, s1, s2, f2, s3: g.run.state, name: g.world.floor.name, y: +g.rig.pos.y.toFixed(1) }; });
const sealed = await ev(() => window.__sealed);
check('the rift is a step down to a ledge and then a sheer drop, cut into a level shelf', Math.abs(sealed.shelf) < 0.4 && Math.abs(sealed.ledge - 2.4) < 0.4 && sealed.depth > 13, JSON.stringify(sealed));
check('while its keeper lives, the rift is shut: the fish may swim over the ledges but cannot go down between the walls', sealed.state === 'play' && sealed.held === true && sealed.belowShelf === true && !!sealed.guard, JSON.stringify(sealed));
const lit = await ev(() => { const g = window.__game, T = window.T, r = g.world.rift; let lo = 9, hi = 0; for (let i = 0; i < 45; i++) { T.idle(0.1); const v = r.light(); lo = Math.min(lo, v); hi = Math.max(hi, v); } return { lo: +lo.toFixed(2), hi: +hi.toFixed(2) }; });
check('a light under the rift\'s cloud swells and sinks, and never goes out', lit.lo > 0.25 && lit.lo < 0.4 && lit.hi > 0.95, JSON.stringify(lit));
check('with the keeper gone, diving into the rift anywhere along it leads to the next band', s.s0 === 'play' && s.s1 === 'descend' && s.f2 === 3 && s.s3 === 'play', JSON.stringify(s));
await ev(() => window.T.swim(1.5, 0.6, -0.8)); await snap(page, 'g-band4');

// 8b. stamina, dash and ram
s = await ev(() => { const g = window.__game, T = window.T; g.startRun(11); T.idle(0.5);
  g.sim(6, { ...T.none(), dir: { x: 1, y: 0, z: 0 }, sprint: true }); return { stamina: g.run.stamina, speed: +g.rig.speed.toFixed(2), hunted: g.run.hunted, ring: document.getElementById('stamina').classList.contains('on') }; });
check('with nothing hunting, sprinting costs nothing and no ring shows', s.stamina === 1 && s.speed > 6 && s.hunted === 0 && !s.ring, JSON.stringify(s));
s = await ev(() => { const g = window.__game, T = window.T; g.run.segs = 14; g.buildFish(14); g.enterFloor(1, false); for (const it of g.field.items) g.field.take(it); g.dropShells(); T.idle(1.6); g.run.safe = 0; g.guard.debug.fall();
  const b = g.foes.biters[0]; for (const o of g.foes.biters) if (o !== b) { o.alive = false; o.mesh.visible = false; } for (const a of g.foes.anglers) a.alive = false; for (const h of g.foes.hooks) h.pos.y += 500;
  const chase = () => { const J = g.rig.joints; b.pos.copy(J[J.length - 1]); b.pos.x -= 3.5; b.cool = 0; g.run.safe = 0; }; // one biter kept on the tail, never near enough to bite
  const sprint = { ...T.none(), dir: { x: 1, y: 0, z: 0 }, sprint: true }, swim = { ...T.none(), dir: { x: 1, y: 0, z: 0 } };
  const t0 = g.run.time; let fast = 0, n = 0; while (n++ < 90 && !g.run.winded) { chase(); g.sim(0.1, sprint); if (g.run.stamina > 0.5) fast = Math.max(fast, g.rig.speed); }
  const emptyAt = +(g.run.time - t0).toFixed(2), t1 = g.run.time, hunted = g.run.hunted > 0; for (let i = 0; i < 10; i++) { chase(); g.sim(0.1, sprint); } // still holding sprint
  const held = { speed: +g.rig.speed.toFixed(2), winded: g.run.winded, ring: document.getElementById('stamina').className.baseVal };
  n = 0; while (n++ < 60 && g.run.winded) { chase(); g.sim(0.1, swim); }
  return { emptyAt, fast: +fast.toFixed(2), hunted, held, back: +(g.run.time - t1).toFixed(2), stamina: +g.run.stamina.toFixed(2), biter: b.state }; });
check('hunted, a sprint empties the bar in about five seconds, and the fish swims at the ordinary pace until some of it is back', s.hunted && s.emptyAt > 4.6 && s.emptyAt < 5.6 && s.fast > 6 && s.held.winded && s.held.speed < 4.3 && /on/.test(s.held.ring) && /low/.test(s.held.ring) && s.back > 1.3 && s.back < 2.1 && s.stamina >= 0.3, JSON.stringify(s));
await ev(() => { const g = window.__game; g.cam.zoom = 0.7; g.snap(); }); await snap(page, 'g-stamina'); await ev(() => { window.__game.cam.zoom = 1; });
s = await ev(() => { const g = window.__game, T = window.T; g.startRun(11); T.idle(0.5); T.put(72, g.world.height(72, 50) + 3, 50, 0); T.idle(0.3);
  const fwd = { ...T.none(), dir: { x: 0, y: 0, z: 1 } }, tap = { ...fwd, dashNow: true }; g.sim(1.5, fwd);
  const p0 = g.rig.pos.z; g.sim(1 / 60, tap); const v0 = g.rig.speed; g.sim(0.5, fwd); const dashed = g.rig.pos.z - p0;
  g.sim(1.5, fwd); const p1 = g.rig.pos.z; g.sim(0.5 + 1 / 60, fwd); const swum = g.rig.pos.z - p1;
  g.sim(1 / 60, tap); g.sim(0.25, fwd); g.sim(1 / 60, tap); const early = g.rig.dashT; g.sim(0.5, fwd); g.sim(1 / 60, tap); const late = g.rig.dashT;
  return { v0, extra: +(dashed - swum).toFixed(2), early, late: +late.toFixed(2), stamina: g.run.stamina }; });
check('a dash is an instant lunge a few metres long, with a short cooldown, and free when nothing hunts', s.v0 >= 12.9 && s.extra > 2 && s.extra < 5 && s.early === 0 && s.late > 0 && s.stamina === 1, JSON.stringify(s));
s = await ev(() => { const g = window.__game, T = window.T; g.run.segs = 14; g.buildFish(14); g.enterFloor(1, false); T.idle(1.6); g.run.safe = 0; for (const h of g.foes.hooks) h.pos.y += 500;
  T.put(72, g.world.height(72, 50) + 3, 50, 0); T.idle(0.3); const b = g.foes.biters[0]; b.pos.copy(g.rig.snout); b.pos.z += 2.2; b.state = 'roam'; b.cool = 9; b.t = 9;
  const fwd = { ...T.none(), dir: { x: 0, y: 0, z: 1 } }; const caught = g.run.caught; g.run.hunted = 5; g.run.stamina = 0.5; g.run.dashCool = 0;
  g.sim(1 / 60, { ...fwd, dashNow: true }); const paid = +g.run.stamina.toFixed(2); g.sim(0.25, fwd); const after = { stamina: +g.run.stamina.toFixed(2), cool: g.run.dashCool, alive: b.alive }; g.sim(0.8, fwd);
  // the front of the body cannot be bitten mid-dash; the tail can
  g.run.safe = 0; g.rig.dashT = 0.1; const segs = g.run.segs; const front = g.bite(2, 1, null, 'biter'); const tail = g.bite(2, g.rig.spine.length, null, 'biter');
  return { paid, after, gained: g.run.caught - caught, front, tail, lost: segs - g.run.segs }; });
check('a dash into a biter breaks it and pays for itself; mid-dash the front of the body cannot be bitten', s.paid === 0.2 && s.after.alive === false && s.after.stamina >= 0.5 && s.after.cool === 0 && s.gained === 1 && s.front === false && s.tail === true && s.lost === 2, JSON.stringify(s));
s = await ev(() => { const g = window.__game, T = window.T; g.run.segs = 14; g.buildFish(14); g.enterFloor(2, false); T.idle(1.6); for (const b of g.foes.biters) b.alive = false;
  const a = g.foes.anglers[0]; T.put(a.pos.x, a.pos.y, a.pos.z - 3.3, 0); g.run.safe = 0; const fwd = { ...T.none(), dir: { x: 0, y: 0, z: 1 } }; const before = g.run.segs;
  g.sim(1 / 60, { ...fwd, dashNow: true }); g.sim(0.3, fwd); const st = a.state; T.idle(3.4); return { st, alive: a.alive, later: a.state, segs: g.run.segs - before }; });
check('a dash into an angler stuns it for a few seconds and costs nothing', s.st === 'stun' && s.alive && s.later !== 'stun' && s.segs === 0, JSON.stringify(s));

// 8c. the bait: it shows what it pulls, anglers take it, and hunters at it are worth breaking
s = await ev(() => { const g = window.__game, T = window.T; g.run.segs = 16; g.buildFish(16); g.enterFloor(2, false); T.idle(1.6); for (const h of g.foes.hooks) h.pos.y += 500;
  const bs = g.foes.biters.slice(0, 3); for (const o of g.foes.biters) if (!bs.includes(o)) { o.alive = false; o.mesh.visible = false; } for (const o of g.foes.anglers) { o.alive = false; o.group.visible = false; }
  T.put(72, g.world.height(72, 50) + 3, 50, 0); T.idle(0.3); g.run.safe = 0; const J = g.rig.joints, tail = J[J.length - 1].clone();
  bs.forEach((b, i) => { b.pos.copy(tail); b.pos.x += 7 + i; b.cool = 9; b.state = 'roam'; b.t = 9; });
  const before = g.run.segs, caught = g.run.caught; g.shed(); const cost = before - g.run.segs; const swim = { ...T.none(), dir: { x: 0, y: 0, z: 1 } }; let threads = 0; for (let i = 0; i < 26; i++) { g.sim(0.1, swim); threads = Math.max(threads, g.foes.state.lured); }
  const bait = g.foes.pieces.find((p) => p.kind === 'decoy'), lured = bs.filter((b) => b.lured === bait).length, marks = bs.filter((b) => b.mark.visible).length, life = +bait.life.toFixed(1);
  T.put(bait.pos.x, bait.pos.y, bait.pos.z - 3.2, 0); g.run.safe = 0; g.sim(1 / 60, { ...swim, dashNow: true }); g.sim(0.3, swim); T.idle(0.9);
  return { cost, lured, marks, threads, life, dead: bs.filter((b) => !b.alive).length, gained: g.run.caught - caught }; });
check('a shed tail calls the biters to it, shows a thread to each, and a dash through them breaks them for double', s.cost === 3 && s.lured === 3 && s.marks === 3 && s.threads === 3 && s.life > 3 && s.dead >= 2 && s.gained === s.dead * 2, JSON.stringify(s));
s = await ev(() => { const g = window.__game, T = window.T; g.run.segs = 16; g.buildFish(16); g.enterFloor(2, false); T.idle(1.6); for (const h of g.foes.hooks) h.pos.y += 500; for (const o of g.foes.biters) { o.alive = false; o.mesh.visible = false; }
  const a = g.foes.anglers[0]; for (const o of g.foes.anglers) if (o !== a) o.alive = false; T.put(72, g.world.height(72, 50) + 3, 50, 0); T.idle(0.3); g.run.safe = 0; const J = g.rig.joints, tail = J[J.length - 1];
  a.home.copy(tail); a.home.x += 4.5; a.pos.copy(a.home); a.state = 'lurk'; const before = g.run.segs; g.shed(); const swim = { ...T.none(), dir: { x: 0, y: 0, z: 1 } }; const seen = []; let fed = 0;
  for (let i = 0; i < 40; i++) { g.sim(0.05, swim); if (seen[seen.length - 1] !== a.state) seen.push(a.state); const b = g.foes.pieces.find((p) => p.kind === 'decoy'); if (b) fed = Math.max(fed, b.fed); }
  return { seen, fed, lost: before - g.run.segs, danger: g.foes.state.flared }; });
check('an angler takes a bait within its reach and leaves the fish alone', s.seen.includes('windup') && s.seen.includes('lunge') && s.seen.includes('recover') && s.fed === 1 && s.lost === 3, JSON.stringify(s));

// 8d. shells: they lie about each band, ride on a segment, change what the fish can do, and go with a bitten or shed tail
s = await ev(() => { const g = window.__game, T = window.T; g.startRun(21); T.idle(0.4); const f = g.field.items, it = f[0];
  const lay = { n: f.length, kinds: new Set(f.map((x) => x.type)).size, firstNear: +Math.hypot(it.x - 72, it.z - 72).toFixed(1) };
  T.put(it.x, it.y + 0.4, it.z, 0); T.idle(0.2);
  const took = { worn: g.run.shells.map((x) => `${x.type}@${x.seg}`), taken: it.taken, dots: document.querySelectorAll('#scale-shells i').length, onBone: g.rig.spine[8].children.some((c) => c.isMesh), hint: document.getElementById('hint').textContent.slice(0, 40), list: document.getElementById('shell-list').textContent.length };
  const more = [g.giveShell('fan'), g.giveShell('pearl'), g.giveShell('ring')], segsOf = g.run.shells.map((x) => x.seg).sort((a, b) => a - b).join();
  const m = { stamina: g.mods.stamina, food: g.mods.food }; const before = g.run.segs; g.addFood(4); const grew = g.run.segs - before;
  g.run.safe = 0; const n0 = g.run.shells.length; g.bite(3, g.rig.spine.length, null, 'angler'); // three tail segments go, and whatever rode on them
  return { lay, took, more, segsOf, m, grew, segs: g.run.segs, lost: n0 - g.run.shells.length, left: g.run.shells.map((x) => x.seg).sort((a, b) => a - b).join() }; });
check('three shells lie about a band; the head takes one onto the rearmost free third segment, and it shows on the body and the scale bar', s.lay.n === 3 && s.lay.kinds === 3 && s.lay.firstNear < 19 && s.took.worn.length === 1 && /@9$/.test(s.took.worn[0]) && s.took.taken && s.took.dots === 1 && s.took.onBone && s.took.list > 30, JSON.stringify({ lay: s.lay, took: s.took }));
await ev(() => { const g = window.__game, T = window.T; g.startRun(21); T.idle(0.3); g.giveShell('spire'); g.giveShell('fan'); g.giveShell('spine'); const it = g.field.items[1]; T.put(it.x - 2.2, it.y + 0.5, it.z - 1.2, 1.1); g.cam.zoom = 0.55; g.cam.pitch = 0.4; g.snap(); T.idle(0.2); }); await snap(page, 'g-shells'); await ev(() => { window.__game.cam.zoom = 1; window.__game.cam.pitch = 0.56; });
check('every third segment carries one shell, worn shells change the rules, and a bite takes the shell with the segment', JSON.stringify(s.more) === '[true,true,false]' && s.segsOf === '3,6,9' && s.m.stamina === 1.5 && s.m.food === 0.8 && s.grew === 1 && s.segs === 8 && s.lost === 1 && s.left === '3,6', JSON.stringify(s));
s = await ev(() => { const g = window.__game, T = window.T; g.startRun(21); g.run.segs = 12; g.buildFish(12); g.enterFloor(1, false); T.idle(1.6); for (const h of g.foes.hooks) h.pos.y += 500;
  const bs = g.foes.biters.slice(0, 3); for (const o of g.foes.biters) if (!bs.includes(o)) { o.alive = false; o.mesh.visible = false; }
  T.put(72, g.world.height(72, 50) + 3, 50, 0); T.idle(0.3); g.run.safe = 0; g.giveShell('spire'); const at = g.run.shells[0].seg;
  const fwd = { ...T.none(), dir: { x: 0, y: 0, z: 1 } }; g.sim(1 / 60, { ...fwd, dashNow: true }); const dashT = +g.rig.dashT.toFixed(2); g.sim(1, fwd);
  const tail = g.rig.joints[g.rig.joints.length - 1].clone(); bs.forEach((b, i) => { b.pos.copy(tail); b.pos.x += 6 + i * 0.6; b.cool = 9; b.state = 'roam'; b.t = 9; });
  const caught = g.run.caught; g.shed(); const bait = g.foes.pieces.find((p) => p.kind === 'decoy'), fx = bait.fx, worn = g.run.shells.length; for (let i = 0; i < 30; i++) g.sim(0.1, fwd);
  return { at, dashT, fx, worn, dead: bs.filter((b) => !b.alive).length, baitGone: bait.dead === true, gained: g.run.caught - caught }; });
check('a Spire lengthens the dash; shed with its segment, the bait bursts on the first hunter and breaks those around it', s.at === 12 && s.dashT > 0.27 && s.fx === 'spire' && s.worn === 0 && s.dead >= 2 && s.baitGone && s.gained === s.dead, JSON.stringify(s));
s = await ev(() => { const g = window.__game, T = window.T; g.startRun(21); g.run.segs = 12; g.buildFish(12); g.enterFloor(1, false); T.idle(1.6); g.run.safe = 0; g.giveShell('cap'); g.giveShell('spine');
  const b = g.foes.biters[0], segs = g.run.segs; const first = g.bite(2, g.rig.spine.length, b.pos, 'biter'); const afterCap = { segs: g.run.segs, worn: g.run.shells.map((x) => x.type).join(), biter: b.alive };
  g.run.safe = 0; const b2 = g.foes.biters[1]; g.bite(2, g.rig.spine.length, b2.pos, 'biter'); return { first, afterCap, segs, after: g.run.segs, biter2: b2.alive }; });
check('a Cap takes one bite and breaks; a Spine kills the biter that bites', s.first === true && s.afterCap.segs === s.segs && s.afterCap.worn === 'spine' && s.afterCap.biter === false && s.after === s.segs - 2 && s.biter2 === false, JSON.stringify(s));

// 8e. the guards of the two lowest rifts: each attacks in its own way, and each can be beaten by rams alone (the Keeper and the Shearer, whose fights are their own, come after)
for (const f of [2, 3]) {
  s = await ev((f) => { const g = window.__game, T = window.T; g.startRun(31); g.run.segs = 14; g.buildFish(14); g.enterFloor(f, false); T.idle(0.6);
    for (const b of g.foes.biters) { b.alive = false; b.mesh.visible = false; } for (const a of g.foes.anglers) { a.alive = false; a.group.visible = false; } for (const h of g.foes.hooks) h.pos.y += 500;
    const G = g.guard, S = G.state, w = g.world.goal, kind = G.kind, shells0 = g.field.items.length;
    // its attack: leave the fish where the guard can get at it
    if (kind === 'warden') T.put(w.x, G.pos.y, w.z, 0); else { T.put(w.x + 14, w.y + 2.5, w.z, Math.PI / 2); T.idle(0.3); if (kind !== 'shearer') { const J = g.rig.joints; G.pos.copy(J[J.length - 1]); G.pos.x -= kind === 'keeper' ? 1.6 : 3.2; } }
    g.run.safe = 0; S.cool = 0; const segs = g.run.segs; let t = 0; while (S.bites === 0 && t < 14) { g.sim(0.1, T.none()); t += 0.1; }
    const attack = { bites: S.bites, lost: segs - g.run.segs, t: +t.toFixed(1) };
    // rams: make it open to one, dash into it, repeat
    let rams = 0; const fwd = { ...T.none(), dir: { x: 0, y: 0, z: 1 } };
    while (!G.done && rams < 9) { S.stun = 0; S.flash = 0; if (kind === 'shearer') G.debug.set('tired', 3); if (kind === 'lamplighter') G.debug.set('dim', 4);
      T.put(G.pos.x, G.pos.y, G.pos.z - 2.9, 0); g.run.safe = 5; g.run.dashCool = 0; g.sim(1 / 60, { ...fwd, dashNow: true }); g.sim(0.35, fwd); rams++; }
    const hp = { lamplighter: 3, warden: 4 }[kind];
    g.sim(0.5, T.none()); const y = g.world.height(w.x, w.z) + 1; T.put(w.x - 1, y, w.z, 0); g.run.safe = 0; T.idle(0.2);
    return { kind, attack, rams, hp, done: G.done, dropped: g.field.items.length - shells0, state: g.run.state }; }, f);
  check(`band ${f + 1}: the ${s.kind} bites a fish left in its reach, falls to ${s.hp} rams, leaves a shell, and the rift opens`, s.attack.bites >= 1 && s.attack.lost >= 2 && s.done && s.rams === s.hp && s.dropped === 1 && s.state === 'descend', JSON.stringify(s));
}
// 8f. the Keeper's fight (KEEPER_FIGHT in guards.js). First the blows: each is told, lands where it was aimed, and takes what it says
const keeperKit = () => { const g = window.__game, T = window.T, G = g.guard, S = G.state, none = T.none();
  for (const b of g.foes.biters) { b.alive = false; b.mesh.visible = false; }
  return { g, T, G, S, F: g.KEEPER_FIGHT,
    ready(o = {}) { G.debug.set('stalk'); Object.assign(S, { cool: 0, stun: 0, flash: 0, jabT: 9, chargeT: 9, digT: 9, last: '' }, o); g.run.segs = 16; g.buildFish(16); g.run.safe = 0; },
    // the fish laid across the crab's front, `far` metres off and `up` over the bed; side 1 turns that toward the crab's left
    lie(far, side = 0, up = 1.6, toward = G.mesh.rotation.y) { const yaw = toward + side * 1.1, fx = Math.sin(yaw), fz = Math.cos(yaw), half = g.rig.length / 2, x = G.pos.x + fx * far + fz * half, z = G.pos.z + fz * far - fx * half; T.put(x, g.world.height(x, z) + up, z, yaw + Math.PI / 2); }, // its head to the crab's left, heading on that way, its body trailing back across the front
    until(state, secs = 8) { let t = 0; while (S.state !== state && t < secs) { g.sim(0.02, none); t += 0.02; } return +t.toFixed(2); },
    // a dash at leg i from outside it
    ramLeg(i) { const f = G.debug.leg(i), dx = f.x - G.pos.x, dz = f.z - G.pos.z, d = Math.hypot(dx, dz), at = { ...none, dir: { x: -dx / d, y: 0, z: -dz / d } };
      T.put(f.x + dx / d * 2.9, G.pos.y + 0.3, f.z + dz / d * 2.9, Math.atan2(-dx, -dz)); g.run.safe = 5; g.run.dashCool = 0; g.run.stamina = 1; g.sim(1 / 60, { ...at, dashNow: true }); g.sim(0.35, at); } }; };
await page.evaluate(`window.keeperKit = ${keeperKit.toString()}`);
s = await ev(() => { window.__game.startRun(31); const { g, T, G, S, F, ready, lie, until } = window.keeperKit(); T.idle(0.5);
  const out = {};
  ready({ last: 'sweep' }); lie(3.6); out.told = until('slam') < 8; const t0 = g.run.time; until('stuck', 3); out.wind = +(g.run.time - t0).toFixed(2); out.slam = 16 - g.run.segs; // stood under: it takes three
  ready({ last: 'sweep' }); lie(3.6); until('slam'); g.sim(F.slam.wind * F.slam.aim + 0.06, T.none()); { const r = g.world.rift; T.put(G.pos.x - r.nx * 11, G.pos.y + 1, G.pos.z - r.nz * 11, 0); } // once it is aimed, gone
  until('stuck', 3); out.dodged = 16 - g.run.segs; out.open = (g.sim(0.05, T.none()), S.open); { const t1 = g.run.time; until('stalk', 6); out.stuck = +(g.run.time - t1).toFixed(2); }
  ready({ last: 'slam' }); lie(3.0); until('sweep'); until('rest', 3); out.sweep = 16 - g.run.segs; // lying low across its front
  ready({ last: 'slam' }); lie(3.0); until('sweep'); lie(3.0, 0, 4.2); until('rest', 3); out.over = 16 - g.run.segs; // and the same body risen over it
  ready({ jabT: 0 }); lie(1.9, 1); until('jab'); until('rest', 2); out.jab = 16 - g.run.segs;
  { const r = g.world.rift; ready({ chargeT: 0 }); lie(6.5, 0, 1.6, Math.atan2(r.x - r.nx * 24 - G.pos.x, r.z - r.nz * 24 - G.pos.z)); } out.side = until('charge') < 8; until('rest', 4); out.charge = 16 - g.run.segs; // (toward the middle of its ground: it does not run past the end of it)
  ready({ last: 'sweep' }); lie(3.6); until('slam'); g.run.safe = 0; g.shed(); g.sim(0.05, T.none()); out.parry = S.state; until('feed', 7); out.fed = S.state; g.sim(0.05, T.none()); out.feeding = S.open; out.bait = 16 - g.run.segs; // a shed tail: it leaves the blow and goes to eat
  return out; });
check('the Keeper’s blows are told and land where they were aimed: the great claw takes three from a body under it and none from one that has gone, and then sticks for two seconds and more, open; its sweep takes two from a body lying low and passes under one that has risen; a jab takes one, a sideways run two; and a shed tail calls it off the blow to eat, open',
  s.told && s.wind > 0.7 && s.slam === 3 && s.dodged === 0 && s.open === true && s.stuck >= 2 && s.sweep === 2 && s.over === 0 && s.jab === 1 && s.side && s.charge === 2 && s.parry === 'fetch' && s.fed === 'feed' && s.feeding === true && s.bait === 3, JSON.stringify(s));
// then its legs: the shell turns a ram; open, a ram numbs a leg and a second takes it off; a body drawn round a numb leg takes it off; two gone and it digs; four and it is done
s = await ev(() => { window.__game.startRun(31); const { g, T, G, S, F, ready, lie, until, ramLeg } = window.keeperKit(); T.idle(0.5); const out = {}, shells0 = g.field.items.length;
  ready({ cool: 99 }); ramLeg(1); out.turned = { hits: S.hits, leg: S.leg[1], hp: S.hp }; // not open: nothing
  ready(); G.debug.set('stuck', 4); T.idle(0.05); ramLeg(1); out.numbed = { hits: S.hits, leg: S.leg[1], hp: S.hp, open: S.open };
  S.stun = 0; S.flash = 0; G.debug.set('stuck', 4); T.idle(0.05); ramLeg(1); out.torn = { hits: S.hits, leg: S.leg[1], hp: S.hp, lost: S.lost, walking: G.rig.walker.legs[1].gone };
  // a second leg, by going round it while it is numb
  S.stun = 0; S.flash = 0; G.debug.set('rest', 60); T.idle(0.05); G.debug.numb(6); S.stun = 60; const f = G.debug.leg(6); T.aroundPoint(f.x, G.pos.y + 0.4, f.z, 0.4); g.run.safe = 1e9;
  let t = 0, prog = 0; while (S.lost < 2 && t < 12) { g.sim(0.1, { ...T.none(), coil: 1 }); t += 0.1; prog = Math.max(prog, G.ring ? G.ring.progress : 0); }
  out.wrapped = { lost: S.lost, t: +t.toFixed(1), prog: +prog.toFixed(2), rage: S.lost >= F.rage };
  // raging, it digs: down, under, and up under the body
  ready({ digT: 0, chargeT: 0, stun: 0 }); lie(8.5); out.dug = until('dig') < 8; until('under', 3); g.sim(0.3, T.none()); out.under = { sink: S.sink, ram: G.ram(G.pos.clone(), 1) }; until('rest', 6); out.up = 16 - g.run.segs; g.sim(0.6, T.none()); out.sink = +S.sink.toFixed(2);
  // the last two
  for (const i of [3, 4]) { S.stun = 0; S.flash = 0; G.debug.set('stuck', 4); T.idle(0.05); G.debug.tear(i, false); }
  g.sim(0.5, T.none()); const w = g.world.goal, y = g.world.height(w.x, w.z) + 1; T.put(w.x - 1, y, w.z, 0); g.run.safe = 0; T.idle(0.2);
  return { ...out, done: G.done, hp: S.hp, dropped: g.field.items.length - shells0, state: g.run.state }; });
check('the Keeper’s shell turns a ram and so does a leg it stands on; open, a ram numbs a leg and a second takes it off; a body drawn round a numb leg takes that one off; with two gone it digs, cannot be reached under the sand, and comes up under the body; with four gone it is done, leaves a shell, and the rift opens',
  s.turned.hits === 0 && s.turned.leg === 0 && s.turned.hp === 4 && s.numbed.leg === 1 && s.numbed.hits === 1 && s.numbed.hp === 4 && s.torn.leg === 2 && s.torn.hp === 3 && s.torn.walking === true && s.wrapped.lost === 2 && s.wrapped.rage && s.dug && s.under.sink === 1 && s.under.ram === null && s.up === 3 && s.sink === 0 && s.done && s.hp === 0 && s.dropped === 1 && s.state === 'descend', JSON.stringify(s));
// 8g. the Shearer's fight (SHEARER_FIGHT in guards.js): lines, and holding still
const shearerKit = () => { const g = window.__game, T = window.T; g.startRun(31); g.run.segs = 16; g.buildFish(16); g.enterFloor(1, false); T.idle(0.6);
  for (const b of g.foes.biters) { b.alive = false; b.mesh.visible = false; } for (const a of g.foes.anglers) { a.alive = false; a.group.visible = false; } for (const h of g.foes.hooks) h.pos.y += 500;
  const G = g.guard, S = G.state, w = g.world.goal, none = T.none();
  return { g, T, G, S, w, none, Z: g.SHEARER_FIGHT, spent: () => S.state === 'tired',
    fresh(o = {}) { G.debug.set('idle'); Object.assign(S, { cool: 0, stun: 0, flash: 0, swipeT: 9, chain: 0, baited: false }, o); g.run.segs = 16; g.buildFish(16); T.put(w.x + 14, w.y + 2.5, w.z, Math.PI / 2); g.run.safe = 0; },
    go(secs, input, stop) { let t = 0; while (t < secs && !(stop && stop())) { g.sim(1 / 60, input); t += 1 / 60; } return +t.toFixed(2); },
    // a dash at it from `ang` round from dead ahead of it
    ramFrom(ang) { const a = G.yaw + ang, dx = Math.sin(a), dz = Math.cos(a), far = ang === 0 ? 5.8 : 3.2, at = { ...none, dir: { x: -dx, y: 0, z: -dz } };
      T.put(G.pos.x + dx * far, G.pos.y, G.pos.z + dz * far, a + Math.PI); g.run.safe = 5; g.run.dashCool = 0; g.run.stamina = 1; g.sim(1 / 60, { ...at, dashNow: true }); g.sim(0.35, at); } }; };
await page.evaluate(`window.shearerKit = ${shearerKit.toString()}`);
s = await ev(() => { const { g, T, G, S, w, none, Z, spent, fresh, go } = window.shearerKit(), out = {};
  fresh(); go(9, none, spent); out.still = { lost: 16 - g.run.segs, slid: +S.slid.toFixed(1) }; // it never feels where the tail is: its line slides off, and the saw goes by
  fresh(); go(9, { ...none, dir: { x: 0, y: 0, z: 1 } }, spent); out.swum = { lost: 16 - g.run.segs, cut: S.cut }; // swimming steadily on: it aims ahead, and takes the tip
  // the cut: the body lying still along x, the saw sent across it through its middle, and through its tip
  for (const [name, j] of [['middle', 8], ['tip', 15]]) { fresh({ cool: 99 }); const at = g.rig.joints[j]; G.pos.set(at.x, at.y, at.z - 7); G.debug.charge(at.x, at.y, at.z + 2); go(1.2, none, spent); out[name] = { lost: 16 - g.run.segs, stone: S.stuck === 'stone' }; }
  // by its head: two swipes, and one of them lands (the other finds a fish just bitten, which nothing can bite)
  fresh({ swipeT: 0 }); T.put(G.pos.x + Math.sin(G.yaw) * 2.6, G.pos.y, G.pos.z + Math.cos(G.yaw) * 2.6, G.yaw); g.run.safe = 0; let swiped = false; go(4, none, () => { swiped = swiped || S.state === 'swipe'; return spent(); }); out.swipe = { swiped, lost: 16 - g.run.segs };
  // a shed tail: it stoops on that, and its saw is in the bed
  fresh(); T.put(G.pos.x + 7, G.pos.y, G.pos.z, 0); g.run.safe = 0; g.shed(); go(9, none, () => spent() && S.stuck === true); out.bait = { stuck: S.stuck, lost: 16 - g.run.segs, left: +S.t.toFixed(1) };
  return out; });
check('the Shearer’s line slides off a fish that holds still and the saw goes by; a fish swimming steadily on is met and loses its tip; the saw cuts where it crosses the body, five from the middle of one lying across its line and no more than three from its tip; by its head it swipes, for one; and a shed tail has it stoop and stick its saw in the bed',
  s.still.lost === 0 && s.still.slid > 1 && s.swum.lost >= 1 && s.swum.lost === s.swum.cut && !s.middle.stone && s.middle.lost === 5 && !s.tip.stone && s.tip.lost >= 1 && s.tip.lost <= 3 && s.swipe.swiped && s.swipe.lost === 1 && s.bait.stuck === true && s.bait.lost === 3 && s.bait.left > 2, JSON.stringify(s));
s = await ev(() => { const { g, T, G, S, w, none, Z, spent, fresh, go, ramFrom } = window.shearerKit(), out = {}, shells0 = g.field.items.length, open = () => { S.stun = 0; S.flash = 0; G.debug.set('tired', 30); T.idle(0.05); };
  fresh(); open(); ramFrom(0); out.front = { hp: S.hp, lost: S.lost }; // the saw turns it
  open(); ramFrom(Math.PI / 2); out.flank = { hp: S.hp, lost: S.lost, saw: G.rig.worn };
  S.stun = 0; S.flash = 0; G.debug.set('idle'); S.cool = 99; T.idle(0.05); ramFrom(Math.PI / 2); out.wary = { hp: S.hp }; // not spent: its flank turns it too
  open(); T.aroundPoint(G.pos.x, G.pos.y, G.pos.z, 0.4); g.run.safe = 1e9; let t = 0; while (!S.snapped && t < 12) { S.t = 30; g.sim(0.1, { ...none, coil: 1 }); t += 0.1; } out.snap = { snapped: S.snapped, hp: S.hp, saw: G.rig.worn, t: +t.toFixed(1) };
  // raging: down its line, and round, and down it again
  fresh({ stun: 0 }); let wheeled = false; go(14, { ...none, dir: { x: 0, y: 0, z: 1 } }, () => { wheeled = wheeled || S.state === 'wheel'; return wheeled && spent(); }); out.rage = { wheeled, chain: S.chain };
  open(); ramFrom(Math.PI / 2); g.sim(0.5, none); const y = g.world.height(w.x, w.z) + 1; T.put(w.x - 1, y, w.z, 0); g.run.safe = 0; T.idle(0.2);
  return { ...out, done: G.done, hp: S.hp, dropped: g.field.items.length - shells0, state: g.run.state }; });
check('the Shearer’s saw turns a ram from ahead, and its flank turns one while it has its wits about it; spent, a ram in the flank takes a row of teeth, which shows on the saw; a body drawn round it snaps the saw, two rows more; then it rages, and comes back down its line; the last row gone, it is done, leaves a shell, and the rift opens',
  s.front.hp === 4 && s.flank.hp === 3 && s.flank.saw === '1|false' && s.wary.hp === 3 && s.snap.snapped && s.snap.hp === 1 && s.snap.saw === '3|true' && s.rage.wheeled && s.done && s.hp === 0 && s.dropped === 1 && s.state === 'descend', JSON.stringify(s));
await ev(() => { const g = window.__game, T = window.T; g.startRun(31); g.enterFloor(3, false); T.idle(0.5); const w = g.world.goal; T.put(w.x + 13, w.y + 3.2, w.z + 3, -1.4); g.cam.pitch = 0.42; g.cam.zoom = 0.9; g.snap(); T.idle(0.4); }); await snap(page, 'g-well');

// 8f. two more kinds of trouble: spined drifters and leeches
s = await ev(() => { const g = window.__game, T = window.T; g.startRun(41); g.run.segs = 14; g.buildFish(14); g.enterFloor(2, false); for (const it of g.field.items) g.field.take(it); T.idle(1.6);
  for (const b of g.foes.biters) { b.alive = false; b.mesh.visible = false; } for (const a of g.foes.anglers) { a.alive = false; a.group.visible = false; } for (const h of g.foes.hooks) h.pos.y += 500; g.guard.debug.fall();
  const counts = { mines: g.foes.mines.length, leeches: g.foes.leeches.length }; for (const l of g.foes.leeches) l.cool = 99;
  T.put(72, g.world.height(72, 50) + 3, 50, 0); T.idle(0.3); g.run.safe = 0; const m = g.foes.mines[0], m2 = g.foes.mines[1], J = g.rig.joints;
  const segs = g.run.segs; g.run.safe = 1; m.home.copy(J[6]); T.idle(0.02); m.home.add(J[6]).sub(m.pos); g.run.safe = 0; T.idle(0.2); const brushed = { lost: segs - g.run.segs, alive: m.alive }; // a drifter wanders a metre and more round its home: put the drifter itself on the body, not its home
  T.idle(1.6); g.run.safe = 0; const fwd = { ...T.none(), dir: { x: 0, y: 0, z: 1 } }; m2.home.copy(g.rig.snout); m2.home.z += 2.4; m2.ph = 0; T.idle(0.05); m2.home.z += g.rig.snout.z + 2.4 - m2.pos.z; m2.home.x += g.rig.snout.x - m2.pos.x; m2.home.y += g.rig.snout.y - m2.pos.y;
  const segs2 = g.run.segs, caught = g.run.caught; g.sim(1 / 60, { ...fwd, dashNow: true }); g.sim(0.3, fwd); T.idle(0.9);
  return { counts, brushed, rammed: { alive: m2.alive, lost: segs2 - g.run.segs, gained: g.run.caught - caught } }; });
check('a spined drifter costs a segment when the body brushes it, and breaks harmlessly on a dash', s.counts.mines === 6 && s.brushed.lost === 1 && s.brushed.alive === false && s.rammed.alive === false && s.rammed.lost === 0 && s.rammed.gained === 1, JSON.stringify(s));
s = await ev(() => { const g = window.__game, T = window.T; T.idle(1.6); g.run.safe = 0; for (const m of g.foes.mines) m.alive = false; const l = g.foes.leeches[0], J = g.rig.joints; for (const o of g.foes.leeches) if (o !== l) o.alive = false;
  l.pos.copy(J[7]); l.pos.x += 3; l.cool = 0; g.run.food = 3; let t = 0; while (l.state !== 'on' && t < 5) { g.sim(0.1, T.none()); t += 0.1; }
  const on = { state: l.state, t: +t.toFixed(1), hunted: g.foes.state.danger > 0 }; T.idle(5.5); const ate = 3 - g.run.food, hint = document.getElementById('hint').textContent.slice(0, 20);
  const fwd = { ...T.none(), dir: { x: 0, y: 0, z: 1 } }; g.sim(1 / 60, { ...fwd, dashNow: true }); g.sim(0.2, fwd); const thrown = l.state;
  l.cool = 0; l.state = 'roam'; l.pos.copy(g.rig.joints[7]); l.pos.x += 1; t = 0; while (l.state !== 'on' && t < 5) { g.sim(0.1, T.none()); t += 0.1; } const again = l.state, caught = g.run.caught;
  g.sim(2.2, { ...T.none(), coil: 1, tight: true }); T.idle(0.8); return { on, ate, hint, thrown, again, crushed: !l.alive, gained: g.run.caught - caught }; });
check('a leech fastens on, eats what the fish has eaten, is thrown off by a dash and crushed by a tight coil', s.on.state === 'on' && s.ate >= 2 && s.thrown === 'stun' && s.again === 'on' && s.crushed && s.gained === 1, JSON.stringify(s));

// 8g. a soak: every band left running with the fish by its rift, to shake out anything that only breaks with time
s = await ev(() => { const g = window.__game, T = window.T; const out = [];
  for (let f = 0; f < 5; f++) { g.startRun(50 + f); g.run.segs = 20; g.buildFish(20); g.enterFloor(f, false); const w = g.world.goal; T.put(w.x + 9, w.y + 2.5, w.z + 2, 1); g.giveShell('horn'); g.giveShell('spine');
    let t = 0; while (t < 24 && g.run.state === 'play') { g.sim(0.5, { ...T.none(), dir: { x: Math.sin(t), y: 0, z: Math.cos(t) }, sprint: t % 6 < 2, dashNow: Math.floor(t) % 4 === 0 }); if (Math.floor(t) % 9 === 3) g.shed(); t += 0.5; }
    out.push(`${f}:${g.run.state}:${g.run.segs}`); }
  return out; });
check('every band runs for a while with hunters, guard, shells and bait all live, without an error', s.length === 5, s.join(' '));

// 9. the palace
s = await ev(() => { const g = window.__game, T = window.T; g.enterFloor(4, false); T.idle(1); const w = g.world.goal; const d = Math.hypot(w.x - 72, w.z - 72), ux = (w.x - 72) / d, uz = (w.z - 72) / d; T.put(w.x - ux * 17, g.world.height(w.x - ux * 17, w.z - uz * 17) + 3, w.z - uz * 17, Math.atan2(ux, uz)); g.cam.pitch = 0.3; T.idle(0.5); return { kind: w.kind, state: g.run.state, anglers: g.foes.anglers.length }; });
await snap(page, 'g-palace');
s = await ev(() => { const g = window.__game, T = window.T; const w = g.world.goal; T.put(w.x, w.y, w.z, 0); T.idle(0.4); return { state: g.run.state, sum: !!g.sum, hall: !!g.world.hall }; });
check('the palace gate no longer ends the dive: it leads into the hall of the Sum (see test_boss.mjs)', s.state === 'play' && s.sum && s.hall, JSON.stringify(s));

// 10. dying, and diving again
s = await ev(() => { const g = window.__game, T = window.T; g.startRun(7); T.idle(0.5); g.run.segs = 5; g.buildFish(5); g.enterFloor(1, false); T.idle(1.6); g.run.safe = 0; const b = g.foes.biters[0], J = g.rig.joints; b.pos.copy(J[J.length - 1]).x += 0.6; b.cool = 0; T.idle(1.2); return { state: g.run.state, segs: g.run.segs }; });
await page.waitForTimeout(3500);
const deadShown = await ev(() => document.getElementById('end').classList.contains('on') && document.getElementById('end-text').textContent);
check('a bite at minimum length ends the run', s.state === 'dead' && !!deadShown, JSON.stringify({ ...s, deadShown }));
await page.keyboard.press('Enter');
s = await ev(() => { const g = window.__game; return { state: g.run.state, segs: g.run.segs, floor: g.run.floor, end: document.getElementById('end').classList.contains('on') }; });
check('Enter starts a fresh dive', s.state === 'play' && s.segs === 10 && s.floor === 0 && !s.end, JSON.stringify(s));

// 10b. what the ruins say: every band has its pieces, and the hunters sit where their old jobs were
s = await ev(() => { const g = window.__game, T = window.T; const out = {};
  for (let f = 0; f < 5; f++) { g.enterFloor(f, false); T.idle(0.3); const w = g.world, count = (geo) => { let n = 0; g.scene.traverse((o) => { if (o.isInstancedMesh && o.geometry === geo) n += o.count; }); return n; };
    const meshes = []; g.scene.traverse((o) => { if (o.isInstancedMesh) meshes.push(o.count); });
    const bit = g.foes.biters[0], ang = g.foes.anglers[0], hk = g.foes.hooks[0];
    out[f] = { instanced: meshes.reduce((a, b) => a + b, 0), spots: [w.spots.biters.length, w.spots.anglers.length, w.spots.hooks.length], penned: w.schools.filter((x) => x.r < 1).length,
      biterAtStall: bit ? w.spots.biters.some(([x, z]) => Math.hypot(bit.home.x - x, bit.home.z - z) < 0.5) : null, anglerOnPlinth: ang ? w.spots.anglers.some(([x, z]) => Math.hypot(ang.home.x - x, ang.home.z - z) < 0.5) : null, hookOverFloor: hk ? w.spots.hooks.some(([x, z]) => Math.hypot(hk.x - x, hk.z - z) < 0.5) : null }; }
  return out; });
console.log('      story census:', JSON.stringify(s));
check('each band is dressed and the hunters are seated', s[0].penned >= 4 && s[1].biterAtStall === true && s[1].hookOverFloor === true && s[2].anglerOnPlinth === true && s[3].biterAtStall === true, '');
if (shots) {
  const look = async (name, floor, fn) => { await ev(([f, body]) => { const g = window.__game, T = window.T; g.startRun(3); g.enterFloor(f, false); T.idle(0.3); new Function('g', 'T', body)(g, T); T.idle(0.4); g.snap(); }, [floor, fn]); await snap(page, name); };
  await look('s-gardens', 0, "const w = g.world; const a = Math.atan2(w.goal.x - 72, w.goal.z - 72) + 0.5; const x = 72 + Math.sin(a) * 26, z = 72 + Math.cos(a) * 26; T.put(x - 17, w.height(x - 17, z) + 5, z + 4, 1.4); g.cam.pitch = 0.5; g.cam.zoom = 1.9;");
  await look('s-market', 1, "const w = g.world; const a = Math.atan2(w.goal.x - 72, w.goal.z - 72); const x = 72 + Math.sin(a) * 24, z = 72 + Math.cos(a) * 24; T.put(x, w.height(x, z) + 3.4, z, a); g.cam.pitch = 0.5; g.cam.zoom = 1.7; g.cam.yaw = a + 2.5;");
  await look('s-temple', 2, "const w = g.world; const a = Math.atan2(w.goal.x - 72, w.goal.z - 72) + 1.25; const x = 72 + Math.sin(a) * 30, z = 72 + Math.cos(a) * 30; T.put(x - 13, w.height(x - 13, z) + 4, z, 1.57); g.cam.pitch = 0.45; g.cam.zoom = 1.7;");
  await look('s-narrowing', 3, "const w = g.world; const a = Math.atan2(w.goal.x - 72, w.goal.z - 72); const x = 72 + Math.sin(a) * 24, z = 72 + Math.cos(a) * 24; T.put(x, w.height(x, z) + 3.4, z, a); g.cam.pitch = 0.5; g.cam.zoom = 1.8; g.cam.yaw = a + 2.6;");
  await ev(() => { const g = window.__game; g.cam.pitch = 0.56; g.cam.zoom = 1; g.cam.yaw = 0.62; g.startRun(7); });
}

// 11. the real-time loop, real keys, the drawer
await ev(() => { window.__hold = false; });
await page.keyboard.down('KeyQ'); await page.waitForTimeout(1500); await page.keyboard.up('KeyQ');
await ev(() => window.__game.setFull(true, true)); // the tuning drawer belongs to the full view
await page.click('#music-tab'); await page.waitForTimeout(700);
s = await ev(() => { const g = window.__game; const el = document.getElementById('m-menace'); el.value = 90; el.dispatchEvent(new Event('input')); document.getElementById('preset-copy').click(); return { open: document.getElementById('drawer').classList.contains('open'), menace: g.music.params.menace, audio: g.music.running, now: document.getElementById('music-now').textContent, yawRate: +g.rig.yawRate.toFixed(2) }; });
const live = await ev(() => { const g = window.__game, m = g.music, rest = m.params.energy; const feed = (a, sec) => { for (let t = 0; t < sec; t += 0.1) m.update(0.1, { speed: 0, coil: 0, danger: 0, low: false, alive: true, activity: a }); return m.energy; };
  const quiet = feed(0, 40), busy = feed(1, 8), after = feed(0, 40);
  const sc = g.world.schools.find((x) => x.left > 0), here = g.rig.pos.clone(); g.rig.pos.set(sc.x, g.rig.pos.y, sc.z); const bySwarm = g.activity(); g.rig.pos.copy(here);
  return { rest, quiet, busy, after, bySwarm }; });
check('the band\'s energy rests where its slider is, climbs with what is going on round the fish and settles again; a swarm close by counts', Math.abs(live.quiet - live.rest) < 0.03 && live.busy > 0.95 && Math.abs(live.after - live.rest) < 0.03 && live.bySwarm > 0.1 && live.bySwarm <= 1, JSON.stringify(live));
// length is the dive's money: growing costs more the longer the fish is, a rift takes a toll, and a full-grown fish eats into its crest
const len = await ev(() => { const g = window.__game, T = window.T; g.startRun(4242); for (const h of g.foes.hooks) h.pos.y += 500;
  const costs = Array.from({ length: 16 }, (_, i) => g.growCost(10 + i)), fwd = { ...T.none(), dir: { x: 0, y: 0, z: 1 } };
  const grow = { first: costs[0], last: costs[15], total: costs.reduce((a, b) => a + b, 0), rising: costs.every((c, i) => !i || c >= costs[i - 1]), bitten: g.growCost(6), pearl: g.growCost(10, 0.8) };
  const b0 = g.run.segs; g.addFood(5); grow.five = g.run.segs - b0; g.run.segs = 25; g.buildFish(25); g.run.food = 0; g.addFood(16); grow.sixteen = g.run.segs; g.addFood(1); grow.seventeen = g.run.segs;
  // full grown: thirty more fish fill the crest; charged, a dash carries further and the ram that lands counts double and spends it
  g.addFood(15); const half = g.run.charge; g.addFood(15); const G = g.guard, hits0 = G.state.hits;
  { G.debug.set('stuck', 5); T.idle(0.05); const f = G.debug.leg(1), dx = f.x - G.pos.x, dz = f.z - G.pos.z, d = Math.hypot(dx, dz); // the Keeper open, and the dash at one of its legs, from outside
    T.put(f.x + dx / d * 2.9, G.pos.y + 0.3, f.z + dz / d * 2.9, Math.atan2(-dx, -dz)); g.run.safe = 5; g.run.dashCool = 0; var at = { ...T.none(), dir: { x: -dx / d, y: 0, z: -dz / d } }; }
  g.sim(1 / 60, { ...at, dashNow: true }); const reach = g.rig.dashT; g.sim(0.35, at);
  const crest = { half, full: 1, reach: +reach.toFixed(2), blows: G.state.hits - hits0, after: g.run.charge, segs: g.run.segs };
  // the toll: a body of twenty goes down the rift and comes out fifteen, and the shells that rode on what was taken move up it
  const dive = () => { const r = g.world.rift, w = g.world.goal; T.put(w.x + r.tx * 14 + r.nx * r.mid(14), r.y - r.step - 5.2, w.z + r.tz * 14 + r.nz * r.mid(14), 0); T.idle(0.1); const at = g.run.state; T.idle(2.6); return at; };
  G.debug.fall(); T.idle(0.3); g.run.segs = 20; g.buildFish(20); g.run.shells = []; g.giveShell('fan'); g.giveShell('ring'); g.run.safe = 1e9;
  const shells0 = g.run.shells.map((x) => x.seg).sort((a, b) => a - b).join(), owed = g.tollOf(20), st = dive();
  const toll = { owed, state: st, floor: g.run.floor, segs: g.run.segs, shells0, shells: g.run.shells.map((x) => x.seg).sort((a, b) => a - b).join(), kinds: g.run.shells.length };
  // too short to spare it: turned back while there is a swarm here it could take, let through for nothing when there is not
  g.guard.debug.fall(); T.idle(0.3); g.run.segs = 9; g.buildFish(9); g.run.safe = 1e9; const r1 = dive(), stay = { state: r1, floor: g.run.floor, segs: g.run.segs, back: g.run.state, owed: g.tollOf(9) };
  for (const sc of g.world.schools) g.world.take(sc); const r2 = dive(), free = { state: r2, floor: g.run.floor, segs: g.run.segs };
  return { grow, crest, toll, stay, free }; });
check('growing costs more the longer the fish is: five fish for a segment at the start, seventeen at the top, and a bitten fish grows back at the first price', len.grow.first === 5 && len.grow.last === 17 && len.grow.rising && len.grow.total > 165 && len.grow.total < 185 && len.grow.bitten === 5 && len.grow.pearl === 4 && len.grow.five === 1 && len.grow.sixteen === 25 && len.grow.seventeen === 26, JSON.stringify(len.grow));
check('a full-grown fish eats into its crest: charged, its dash carries half as far again and the ram that lands counts double and spends it', len.crest.half === 0.5 && len.crest.reach > 0.26 && len.crest.blows === 2 && len.crest.after === 0 && len.crest.segs === 26, JSON.stringify(len.crest));
check('a rift takes its toll: a body of twenty comes out fifteen, and the shells that rode on the tail move up the body', len.toll.owed === 5 && len.toll.state === 'descend' && len.toll.floor === 1 && len.toll.segs === 15 && len.toll.shells0 === '15,18' && len.toll.shells === '12,15' && len.toll.kinds === 2, JSON.stringify(len.toll));
check('a fish too short to spare the toll is turned back while there is a swarm here it could take, and let through for nothing when there is not', len.stay.owed === 0 && len.stay.state === 'refused' && len.stay.floor === 1 && len.stay.segs === 9 && len.stay.back === 'play' && len.free.state === 'descend' && len.free.floor === 2 && len.free.segs === 9, JSON.stringify({ stay: len.stay, free: len.free }));
// the Keeper walks on its own legs: feet planted, body riding on them over the ground as it lies
const crab = await ev(() => { const g = window.__game, T = window.T; g.startRun(4242); for (const b of g.foes.biters) { b.alive = false; b.mesh.visible = false; }
  const G = g.guard, S = G.state, w = g.world, r = w.rift, R = G.rig, W = R.walker, home = { x: r.x - r.nx * 24, z: r.z - r.nz * 24 };
  T.put(home.x - r.nx * 36, w.height(home.x - r.nx * 36, home.z - r.nz * 36) + 2, home.z - r.nz * 36, 0); g.run.safe = 1e9; // the fish well away: it has its ground to itself
  S.ang = 2.75; G.pos.set(home.x + Math.sin(S.ang) * 8.6, 0, home.z + Math.cos(S.ang) * 8.6); G.pos.y = w.height(G.pos.x, G.pos.z) + 0.9; T.idle(0.6); // where the ground falls away
  const steps0 = W.body.steps; let air = 0, off = 0, lean = 0, want = 0, ride = 0, n = 0, p = new G.pos.constructor();
  for (let i = 0; i < 50; i++) { T.idle(0.06); air = Math.max(air, W.stepping);
    for (const l of W.legs) if (l.t < 0) off = Math.max(off, Math.abs(l.foot.y - w.footing(p.copy(l.foot)).y)); // every foot that is down is on the ground, or on a stone
    const m = G.mesh, c = Math.cos(m.rotation.y), sn = Math.sin(m.rotation.y), h = (x, z) => w.height(G.pos.x + x * c + z * sn, G.pos.z - x * sn + z * c); // the ground under it, across the body and along it
    const across = Math.atan((h(2.6, 0) - h(-2.6, 0)) / 5.2), along = -Math.atan((h(0, 1.9) - h(0, -1.9)) / 3.8);
    want = Math.max(want, Math.hypot(across, along)); lean += (m.rotation.z * across + m.rotation.x * along) / (Math.hypot(across, along) + 1e-6); ride += m.position.y - W.body.ground; n++; }
  const walked = { steps: W.body.steps - steps0, air, off: +off.toFixed(3), slope: +want.toFixed(2), lean: +(lean / n).toFixed(2), ride: +(ride / n).toFixed(2), y: +(G.pos.y - w.height(G.pos.x, G.pos.z)).toFixed(2) };
  T.put(G.pos.x - r.nx * 6, w.height(G.pos.x - r.nx * 6, G.pos.z - r.nz * 6) + 1.2, G.pos.z - r.nz * 6, Math.atan2(r.nx, r.nz)); g.run.safe = 1e9; S.cool = 99; T.idle(1.6); // a fish comes near, nose first
  const to = Math.atan2(g.rig.pos.x - G.pos.x, g.rig.pos.z - G.pos.z), turn = Math.abs(Math.atan2(Math.sin(G.mesh.rotation.y - to), Math.cos(G.mesh.rotation.y - to)));
  const big = R.claws.find((k) => k.big), small = R.claws.find((k) => !k.big);
  const wary = { pose: +R.pose.wary.toFixed(2), claws: +big.wrist.y.toFixed(2), turn: +turn.toFixed(2) };
  // its tail left in reach: the strike is the big claw's, the one on its right
  T.put(G.pos.x - r.nx * 5.4, w.height(G.pos.x - r.nx * 5.4, G.pos.z - r.nz * 5.4) + 1.1, G.pos.z - r.nz * 5.4, Math.atan2(r.nx, r.nz) + Math.PI); g.run.safe = 1e9; T.idle(0.3); G.debug.set('slam', 0.5);
  const tip = (k) => k.hand.localToWorld(p.set(0, -0.2 * k.stout, k.l2 + k.span * 0.8)).clone(), reach = { big: 9, small: 9 };
  for (let i = 0; i < 16; i++) { T.idle(0.05); G.mesh.updateMatrixWorld(true); const J = g.rig.joints; let tail = J[J.length - 1], near = 1e9; for (let j = Math.ceil((J.length - 1) * 0.4); j < J.length; j++) { const d = J[j].distanceTo(G.pos); if (d < near) { near = d; tail = J[j]; } }
    reach.big = Math.min(reach.big, tip(big).distanceTo(tail)); reach.small = Math.min(reach.small, tip(small).distanceTo(tail)); }
  const claws = { right: big.shoulder.x < 0, longer: +((big.l1 + big.l2 + big.span) / (small.l1 + small.l2 + small.span)).toFixed(2), big: +reach.big.toFixed(2), small: +reach.small.toFixed(2) };
  S.cool = 99; T.idle(0.5); G.debug.hurt(1.6); T.idle(0.3); const stun = +R.pose.crouch.toFixed(2); G.debug.fall(); T.idle(2.5);
  return { walked, wary, claws, stun, down: { roll: +G.mesh.rotation.z.toFixed(2), curled: +Math.max(...W.legs.map((l) => l.tip.distanceTo(l.curl))).toFixed(2) } }; });
check('the Keeper walks on its legs: its feet stay planted and step in turn, on the ground or on a stone, and its shell rides on them and leans with the slope', crab.walked.steps >= 12 && crab.walked.air >= 1 && crab.walked.air <= 5 && crab.walked.off < 0.05 && crab.walked.slope > 0.1 && crab.walked.lean > 0.04 && Math.abs(crab.walked.ride - 0.44) < 0.15 && Math.abs(crab.walked.y - 0.9) < 0.3, JSON.stringify(crab.walked));
check('it turns to a fish that comes near and puts its big claw up; rammed, it sags; beaten, it goes over on its back and its legs curl', crab.wary.pose > 0.6 && crab.wary.claws > 0.7 && crab.wary.turn < 0.5 && crab.stun > 0.3 && crab.down.roll > 1.8 && crab.down.curled < 0.25, JSON.stringify(crab));
check('its claws are not a pair: the right one is much the bigger, and that is the one that comes down on a tail', crab.claws.right && crab.claws.longer > 1.35 && crab.claws.big < 1.1 && crab.claws.small > crab.claws.big + 0.5, JSON.stringify(crab.claws));
// the Shearer: a sawfish that feels for a fish with its saw, and has two blows
const saw = await ev(() => { const g = window.__game, T = window.T; g.startRun(4242); g.enterFloor(1, false); for (const b of g.foes.biters) { b.alive = false; b.mesh.visible = false; } for (const h of g.foes.hooks) h.pos.y += 500;
  const G = g.guard, S = G.state, w = g.world, r = w.rift, R = G.rig, along = Math.atan2(r.tx, r.tz), start = { x: r.x - r.nx * 11, z: r.z - r.nz * 11 };
  // Where the fish lies for the blows: outside the row of columns behind the kerb, at a place along the rift from which the Shearer's way to its tail is clear
  // of anything tall, since a blow that meets a column stops on it.
  const lane = (U) => { const p = { x: r.x + r.tx * U - r.nx * (r.w(0) + 7.5), z: r.z + r.tz * U - r.nz * (r.w(0) + 7.5) }, q = G.pos.clone(); for (let k = 0; k <= 1.0001; k += 0.04) for (const back of [0, 1.5, 3, 4.5]) for (const y of [0.8, 2.2]) { q.set(start.x + (p.x - r.tx * back - start.x) * k, r.y + y, start.z + (p.z - r.tz * back - start.z) * k); if (w.inStone(q, 1.0, 1.6)) return null; } return p; }; // (under a lintel is clear: the blows come in low)
  const near = Array.from({ length: 37 }, (_, i) => (i % 2 ? 1 : -1) * Math.ceil(i / 2)).map(lane).find(Boolean), bed = w.height(near.x, near.z); // the nearest clear one to the middle: 0, 1, -1, 2, -2 ...
  const bring = () => { S.ang = Math.atan2(-r.nx, -r.nz); G.pos.set(start.x, r.y + 2.6, start.z); G.debug.set('idle'); S.cool = 0; S.stun = 0; }; // the Shearer to the near side of its round
  // nobody near: it sweeps the saw from side to side, tilted down, and leans into its round
  T.put(near.x - r.nx * 40, bed + 3, near.z - r.nz * 40, 0); g.run.safe = 1e9; S.cool = 99; T.idle(1.5);
  let lo = 9, hi = -9, nod = 0, lean = 0, n = 0; for (let i = 0; i < 70; i++) { T.idle(0.1); lo = Math.min(lo, R.head.x); hi = Math.max(hi, R.head.x); nod += R.head.y; lean += R.pose.roll; n++; }
  const search = { sweep: +(hi - lo).toFixed(2), sides: lo < -0.1 && hi > 0.1, nod: +(nod / n).toFixed(2), lean: +(lean / n).toFixed(2), glow: +R.glow.toFixed(2), state: S.state };
  // a blow: leave the fish at a height over the bed, bring the Shearer round, and watch it through
  const blow = (up) => { T.put(near.x, bed + up, near.z, along); g.run.safe = 1e9; T.idle(0.2); bring(); const segs = g.run.segs, seen = [], o = { felt: 0, swing: 0, swipes: 0, rose: 0, nose: 0 }; let was = 0, t = 0;
    const swung = () => { const h = R.head.x; o.swing = Math.max(o.swing, Math.abs(h)); if (Math.abs(h) > 0.3 && Math.sign(h) !== was) { if (was) o.swipes++; was = Math.sign(h); } };
    g.run.safe = 0; while (t < 12 && !(S.state === 'tired' && seen.includes('charge'))) { T.idle(0.04); t += 0.04; if (seen[seen.length - 1] !== S.state) seen.push(S.state);
      if (S.state === 'sense') o.felt = Math.max(o.felt, R.glow);
      if (S.state === 'aim') { o.rose = Math.max(o.rose, G.pos.y - (bed + up)); o.nose = Math.max(o.nose, R.pose.pitch); }
      if (S.state === 'charge') swung(); }
    for (let i = 0; i < 12; i++) { T.idle(0.04); swung(); } g.run.safe = 1e9; // the saw swings on a moment after the blow
    return { seen: seen.join('>'), mode: S.mode, stuck: S.stuck, lost: segs - g.run.segs, felt: +o.felt.toFixed(2), swing: +o.swing.toFixed(2), swipes: o.swipes, rose: +o.rose.toFixed(1), nose: +o.nose.toFixed(2), tail: +R.pose.pitch.toFixed(2), off: +(G.pos.y - Math.max(w.height(G.pos.x, G.pos.z), r.ledgeY)).toFixed(2), dark: +R.glow.toFixed(2), t: +t.toFixed(1) }; };
  const A = g.SHEARER_FIGHT.aim, slide = A.slide; A.slide = 0; // (these two are about how its blows look: the fish lies still, so for them its line is kept from sliding off a still fish)
  const slash = blow(3.2); g.run.segs = 14; g.buildFish(14); const pin = blow(0.5); A.slide = slide;
  G.debug.fall(); T.idle(2.5);
  return { search, slash, pin, down: +R.pose.roll.toFixed(2) }; });
check('the Shearer sweeps its saw as it searches, tilted down, and lights its teeth when it feels a fish', saw.search.state === 'idle' && saw.search.sides && saw.search.sweep > 0.5 && saw.search.nod < -0.15 && Math.abs(saw.search.lean) > 0.03 && saw.search.glow < 0.6 && saw.slash.felt > 1.2 && /sense>aim>charge>tired/.test(saw.slash.seen), JSON.stringify(saw.search) + ' ' + saw.slash.seen);
check('a tail up in the water gets the slash: the saw whipped from side to side on the way through, and the Shearer spent after it', saw.slash.mode === 'slash' && !saw.slash.stuck && saw.slash.swing > 0.6 && saw.slash.swipes >= 1 && saw.slash.lost >= 1 && saw.slash.dark < 0.4, JSON.stringify(saw.slash));
check('a tail along the bed gets the stoop: it climbs over it, comes down nose first, and its saw sticks in the bed', saw.pin.mode === 'pin' && saw.pin.stuck && saw.pin.rose > 2.2 && saw.pin.nose > 0.6 && saw.pin.lost >= 1 && saw.pin.off > 1 && saw.pin.off < 2.4 && saw.pin.tail > 0.5 && saw.down > 2, JSON.stringify(saw.pin) + ' down ' + saw.down);
// its pieces (sawfish.js): the tail is a strand of its own, the gills heave when it is spent, and what is knocked off the saw leaves it and lies on the bed
const sawParts = await ev(() => { const g = window.__game, T = window.T; g.startRun(4242); g.enterFloor(1, false); for (const b of g.foes.biters) { b.alive = false; b.mesh.visible = false; } for (const h of g.foes.hooks) h.pos.y += 500;
  const G = g.guard, S = G.state, w = g.world, r = w.rift, R = G.rig, tail = R.tail, n = tail.n, out = {};
  T.put(r.x - r.nx * 60, w.height(r.x - r.nx * 60, r.z - r.nz * 60) + 3, r.z - r.nz * 60, 0); g.run.safe = 1e9; S.cool = 99; // the fish well away, and the dive held still: the rig is moved by hand
  // the tail. Swimming straight, it sweeps to both sides; turned hard, it is left behind, and comes back when the turning stops
  const st = { x: G.pos.x, y: G.pos.y + 4, z: G.pos.z, yaw: 0, speed: 3, climb: 0, mood: 'search', mode: 'slash', side: 1, k: 0, look: null, time: 0 }, late = () => tail.local[n].distanceTo(tail.shape[n]);
  const run = (secs, turn = 0) => { let most = 0, lo = 9, hi = -9; for (let t = 0; t < secs; t += 1 / 60) { st.time += 1 / 60; st.yaw += turn / 60; st.x += Math.sin(st.yaw) * st.speed / 60; st.z += Math.cos(st.yaw) * st.speed / 60; R.update(1 / 60, st); most = Math.max(most, late()); lo = Math.min(lo, tail.local[n].x); hi = Math.max(hi, tail.local[n].x); } return { late: +most.toFixed(2), lo: +lo.toFixed(2), hi: +hi.toFixed(2) }; };
  run(3); out.straight = run(6); out.turned = run(0.6, 2.2); run(1.6); out.settled = +late().toFixed(2);
  // its breath. Searching, it is shallow and slow; spent, it pants, the breathing holes lit, the lids half down
  const breathe = (secs) => { let lo = 9, hi = -9, lit = 0, ups = 0, was = R.pose.heave, rising = false; for (let t = 0; t < secs; t += 1 / 60) { st.time += 1 / 60; R.update(1 / 60, st); const h = R.pose.heave; lo = Math.min(lo, h); hi = Math.max(hi, h); lit = Math.max(lit, R.pose.pant); if (h > was + 1e-4 && !rising) { rising = true; ups++; } else if (h < was - 1e-4) rising = false; was = h; } return { lo: +lo.toFixed(2), hi: +hi.toFixed(2), lit: +lit.toFixed(2), breaths: ups, lid: +R.pose.lid.toFixed(2) }; };
  st.speed = 2; run(2); out.calm = breathe(4); st.mood = 'tired'; st.speed = 0.3; run(1.5); out.spent = breathe(4); out.hang = +tail.local[n].y.toFixed(2);
  // its teeth. Over the shelf, spent: a row goes, and then the saw is snapped
  const bed = (m) => +(m.getWorldPosition(G.pos.clone()).y - w.height(m.getWorldPosition(G.pos.clone()).x, m.getWorldPosition(G.pos.clone()).z)).toFixed(2), on = () => R.teeth.filter((t) => !t.off && (t.mesh.parent === R.saw || t.mesh.parent.parent === R.saw)).length;
  G.pos.set(r.x - r.nx * 17, w.height(r.x - r.nx * 17, r.z - r.nz * 17) + 2.6, r.z - r.nz * 17); G.debug.set('tired', 40); T.idle(0.3); out.whole = { teeth: on(), loose: R.loose.length, saw: R.worn };
  G.debug.tooth(1, 1.5); T.idle(0.2); out.knocked = { teeth: on(), loose: R.loose.length, saw: R.worn, up: Math.max(...R.loose.map((o) => bed(o.mesh))) }; S.stun = 0; G.debug.set('tired', 40); T.idle(7);
  out.lying = { rest: R.loose.filter((o) => o.rest).length, high: Math.max(...R.loose.map((o) => bed(o.mesh))), far: +Math.max(...R.loose.map((o) => o.mesh.position.distanceTo(G.pos))).toFixed(1), stumps: on() };
  G.wrapped(); T.idle(0.1); S.stun = 0; G.debug.set('tired', 40); T.idle(7); const end = R.loose.find((o) => o.mesh.children.length > 0);
  out.snapped = { saw: R.worn, onSaw: on(), end: !!end && end.rest, endHigh: end ? bed(end.mesh) : 9, rest: R.loose.filter((o) => o.rest).length, loose: R.loose.length, tris: R.triangles };
  return out; });
check('the Shearer’s tail is a piece of its own: swimming straight it sweeps to both sides, turned hard it is left well behind, and it comes back when the turning stops', sawParts.straight.lo < -0.25 && sawParts.straight.hi > 0.25 && sawParts.straight.late < 0.3 && sawParts.turned.late > 0.45 && sawParts.settled < 0.25, JSON.stringify({ straight: sawParts.straight, turned: sawParts.turned, settled: sawParts.settled }));
check('searching, it breathes slow and shallow; spent, it pants: the gills fill and empty more than once a second, the breathing holes light, its lids come half down and its tail hangs', sawParts.calm.hi < 0.4 && sawParts.calm.lit < 0.3 && sawParts.calm.breaths <= 3 && sawParts.spent.lo < 0.15 && sawParts.spent.hi > 0.85 && sawParts.spent.lit > 1.2 && sawParts.spent.breaths >= 5 && sawParts.spent.lid > 0.4 && sawParts.hang < -0.25, JSON.stringify({ calm: sawParts.calm, spent: sawParts.spent, hang: sawParts.hang }));
check('a row of teeth knocked out leaves the saw as eight pieces, which sink and lie on the bed; snapped, the end of the saw comes away with the teeth still on it and lies there too',
  sawParts.whole.teeth === 32 && sawParts.whole.loose === 0 && sawParts.knocked.teeth === 24 && sawParts.knocked.loose === 8 && sawParts.knocked.saw === '1|false' && sawParts.knocked.up > 0.5 && sawParts.lying.rest === 8 && sawParts.lying.high < 0.2 && sawParts.lying.far < 14
  && sawParts.snapped.saw === '3|true' && sawParts.snapped.end && sawParts.snapped.endHigh < 0.3 && sawParts.snapped.onSaw < 12 && sawParts.snapped.rest === sawParts.snapped.loose && sawParts.snapped.tris < 2500, JSON.stringify(sawParts));
const cast = await ev(() => { const g = window.__game, m = g.music, quiet = { speed: 0, coil: 0, danger: 0, low: false, alive: true };
  const feed = (c, sec) => { for (let t = 0; t < sec; t += 0.1) m.update(0.1, { ...quiet, cast: c }); return m.state.sitting.join(); };
  const none = feed({}, 12), one = feed({ biter: 0.9 }, 4), many = feed({ biter: 0.9, angler: 0.8, hook: 0.7, drifter: 0.6, warden: 0.3 }, 6), names = (m.describe() || { sitting: [] }).sitting.join();
  const heard = Object.keys(g.castNear()).length >= 0 && ['biter', 'angler', 'hook', 'drifter', 'leech', 'keeper', 'shearer', 'lamplighter', 'warden', 'sum'].every((id) => m.audition(id) === true);
  const gone = feed({}, 14); const G = g.guard, here = g.rig.pos.clone(); let byKeeper = 1; if (G && !G.done) { g.rig.pos.copy(G.pos); byKeeper = g.castNear()[G.kind]; g.rig.pos.copy(here); } // a keeper, where this band still has one
  return { none, one, many, names, heard, gone, kind: G ? G.kind : null, byKeeper }; });
check('every hunter and keeper has an instrument: it sits in while the creature is near, three at most with the keeper first, and each can be heard alone', cast.none === '' && cast.one === 'biter' && cast.many === 'warden,biter,angler' && /bowed cello/.test(cast.names) && cast.heard && cast.gone === '' && cast.byKeeper > 0.9, JSON.stringify(cast));
const floor = await ev(() => { const g = window.__game, m = g.music, quiet = { speed: 0, coil: 0, danger: 0, low: false, alive: true }, play = (secs) => { for (let t = 0; t < secs; t += 0.1) m.update(0.1, { ...quiet, cast: { keeper: 1 } }); };
  m.audition('keeper'); m.state.shownAt = -99; m.state.show = null; const l0 = m.state.licks, first = m.flourish('keeper', 'fill'), again = m.flourish('keeper', 'fill'), kind = m.state.show && m.state.show.kind; // a fill; and a second one straight after is turned away
  const solo = m.flourish('keeper', 'solo'), now = m.state.show && m.state.show.kind, nobody = m.flourish('biter', 'fill');
  return { first, again, kind, solo, now, nobody, licks: m.state.licks - l0 }; });
check('a keeper’s instrument can take the floor: a fill, which is turned away if another was played a moment ago so that they stay rare, and a solo, which is not; a hunter has neither', floor.first === true && floor.again === false && floor.kind === 'fill' && floor.solo === true && floor.now === 'solo' && floor.nobody === false, JSON.stringify(floor));
check('the Music drawer opens and its sliders reach the band', s.open && Math.abs(s.menace - 0.9) < 0.01, JSON.stringify(s));
s = await ev(() => { const g = window.__game; const code = g.presetCode(); const r1 = g.applyCode('hey try this one oarfish-music:1:dream=90,energy=20,menace=10,react=40,swing=75,band=80 :)'); const p1 = { ...g.music.params };
  const r2 = g.applyCode('oarfish-music:1:dream=30,menace=95,zone=3'); const here = { ...g.music.params }; g.enterFloor(2, false); const there = { ...g.music.params }; const code3 = g.presetCode(); const r3 = g.applyCode('nonsense'); g.enterFloor(0, false);
  return { code, r1, dream1: p1.dream, r2, dreamHere: here.dream, dreamThere: there.dream, menaceThere: there.menace, code3, r3 }; });
check('preset codes copy, paste for all depths, and paste for one depth', /^oarfish-music:1:dream=\d+/.test(s.code) && s.dream1 === 0.9 && s.dreamHere === 0.9 && s.dreamThere === 0.3 && s.menaceThere === 0.95 && /zone=3$/.test(s.code3) && /not a preset/.test(s.r3), JSON.stringify(s));
// ---- the oars: pulled in turn on the beat they build a chord and speed; out of time they lose it. Rowed here against a plain count
// kept from the dive's own clock (oars.metronome), since the band's clock is the sound card's and does not stop for a scripted dive.
s = await ev(() => { const g = window.__game, T = window.T, O = g.OARS, dur = O.tempo, east = { ...T.none(), dir: { x: 1, y: 0, z: 0 } }; g.startRun(4242); g.run.safe = 1e9; g.oars.metronome = true;
  const to = (when) => { while (g.run.time < when - 1e-6) g.sim(1 / 60, east); }, beat = () => Math.ceil((g.run.time + 0.06) / dur) * dur;
  T.put(g.rig.pos.x, g.rig.pos.y + 3, g.rig.pos.z, Math.PI / 2); to(g.run.time + 3); const plain = g.rig.speed; to(Math.ceil((g.run.time + 0.06) / dur) * dur + dur * 0.3); const mash = [g.stroke(-1), g.stroke(1), g.stroke(-1), g.run.harmony];
  const built = []; let side = -1; const pull = () => { const r = g.stroke(side); side = -side; return r; };
  for (let i = 0; i < 5; i++) { to(beat()); built.push(pull()); } const top = g.run.harmony;
  for (let i = 0; i < 6; i++) { to(beat()); pull(); } const fast = g.rig.speed, tempo = g.rig.tempo;
  to(beat() + dur * 0.3); const out = [pull(), g.run.harmony];
  to(beat()); pull(); to(beat()); const wait = g.stroke(-side); to(g.run.time + O.both + 0.05); const twice = [wait, g.oars.last, g.run.harmony];
  for (let i = 0; i < 4; i++) { to(beat()); pull(); } const again = g.run.harmony;
  const t0 = beat(); to(t0); pull(); to(t0 + dur * 0.66); const swung = [pull(), g.run.drive]; to(t0 + dur); pull(); to(t0 + dur * 1.66); const swung2 = [pull(), g.run.drive, +g.rig.tempo.toFixed(2)];
  let b = beat(); while (Math.round(b / dur) % 4 !== 0) b += dur; to(b - dur); pull(); to(b); const surge = [g.stroke(-side), g.stroke(side), +g.rig.boost.toFixed(2), g.run.harmony];
  to(g.run.time + dur * 9); const faded = [g.run.harmony, g.run.drive, +g.rig.tempo.toFixed(2)];
  g.oars.metronome = false; g.run.safe = 0;
  return { plain: +plain.toFixed(2), mash, built, top, fast: +fast.toFixed(2), tempo: +tempo.toFixed(2), out, twice, again, swung, swung2, surge, faded }; });
check('the oars: five pulls in turn on the beat build the whole chord and three quarters more speed; a pull out of time or the same oar twice costs a voice; a pull on the swing adds drive; both on the first beat is a surge; and it all fades when the rowing stops',
  s.plain > 3.1 && s.plain < 3.4 && s.mash.join() === ',,,0' && s.built.every((r) => r === 'good' || r === 'perfect') && s.top === 5 && s.fast > s.plain * 1.6 && Math.abs(s.tempo - 1.75) < 0.05 && s.out.join() === 'miss,4' && s.twice.join() === 'wait,miss,4' && s.again === 5 && s.swung.join() === 'drive,1' && s.swung2[0] === 'drive' && s.swung2[1] === 2 && s.surge[0] === 'wait' && s.surge[1] === 'surge' && s.surge[2] > 0.5 && s.surge[3] === 5 && s.faded[0] === 0 && s.faded[1] === 0 && s.faded[2] < 1.03, JSON.stringify(s));
s = await ev(async () => { const g = window.__game; g.music.unlock(); await new Promise((r) => setTimeout(r, 900)); const a = g.music.pulse(); await new Promise((r) => setTimeout(r, 300)); const b = g.music.pulse(), now = g.beatNow();
  return { a: a && { d: +a.d.toFixed(3), i: a.index, dur: +a.dur.toFixed(3) }, b: b && { i: b.index }, band: !!a && now.index === g.music.pulse().index, oar: g.music.oar('good', 3), miss: g.music.oar('miss') }; });
check('the band gives the oars its own beat: which beat is nearest, how far off, and how long a beat is', !!s.a && Math.abs(s.a.d) <= s.a.dur / 2 + 0.02 && Number.isInteger(s.a.i) && s.a.dur > 0.3 && s.a.dur < 0.6 && s.b.i >= s.a.i && s.band && s.oar > 40 && s.miss === null, JSON.stringify(s));
// ---- a catch that lands, catches in a row, and length that shows. (The hold is checked with frames run as the game runs them,
// g.sim with no input given: a step forced from here goes round it.)
s = await ev(() => { const g = window.__game, T = window.T; g.startRun(4242); g.music.unlock(); const sw = T.swarm('s');
  const hits = [], notes = [], hit0 = g.music.hit, gulp0 = g.music.gulp; g.music.hit = (k, v) => { hits.push([k, v === undefined ? null : +v.toFixed(2)]); return hit0(k, v); }; g.music.gulp = (k, of, v) => { const m = gulp0(k, of, v); notes.push([k, of, m]); return m; };
  T.put(sw.x + 2.6, sw.hy, sw.z + 0.9, 1.1); T.idle(0.8); const before = { segs: g.run.segs, caught: g.run.caught }; let t = 0; while (sw.left > 0 && t < 9) { g.sim(1 / 60, { ...T.none(), coil: 1 }); t += 1 / 60; }
  const frozen = g.run.freeze, at = g.rig.pos.clone(); g.sim(2 / 60); const held = g.rig.pos.distanceTo(at); const mid = { segs: g.run.segs, caught: g.run.caught };
  let grewAt = -1, swell = [], t2 = 0; while (t2 < 2.4) { g.sim(1 / 60, T.none()); t2 += 1 / 60; if (grewAt < 0 && g.run.segs > before.segs) grewAt = t2; if (grewAt >= 0 && g.fishPulse.value.y > 0.05) swell.push(g.fishPulse.value.x); }
  g.music.hit = hit0; g.music.gulp = gulp0;
  return { left: sw.left, frozen: +frozen.toFixed(3), held: +held.toFixed(4), before, mid, after: { segs: g.run.segs, caught: g.run.caught }, grewAt: +grewAt.toFixed(2), catchHit: hits.find((h) => h[0] === 'catch'), grew: hits.some((h) => h[0] === 'grow'),
    notes: notes.length, of: notes[0]?.[1], rising: notes.every((n, i) => !i || (n[0] > notes[i - 1][0] && n[2] > notes[i - 1][2])), swell: [swell.length, +Math.min(...swell).toFixed(2), +Math.max(...swell).toFixed(2)], pulseDone: g.fishPulse.value.y }; });
check('a catch lands: the world holds for an instant, the swarm goes down on a rising run of notes, and only then does the fish grow, with a swell down its body',
  s.left === 0 && s.frozen > 0.03 && s.held < 0.001 && s.mid.segs === s.before.segs && s.mid.caught === s.before.caught && s.after.caught === s.before.caught + 8 && s.after.segs === s.before.segs + 1 && s.grewAt > 0.3 && s.grewAt < 1.4 && s.catchHit && s.catchHit[1] > 0.25 && s.catchHit[1] < 0.45 && s.grew && s.notes >= 4 && s.notes === s.of && s.rising && s.swell[0] > 20 && s.swell[1] < 0.15 && s.swell[2] > 0.9 && s.pulseDone === 0, JSON.stringify(s));
s = await ev(() => { const g = window.__game, T = window.T; g.startRun(4242); g.music.unlock(); g.run.segs = 26; g.buildFish(26); const sw = T.swarm('h');
  const hits = [], notes = [], hit0 = g.music.hit, gulp0 = g.music.gulp; g.music.hit = (k, v) => { hits.push([k, v === undefined ? null : +v.toFixed(2)]); return hit0(k, v); }; g.music.gulp = (k, of, v) => { const m = gulp0(k, of, v); notes.push([k, of, m]); return m; };
  T.put(sw.x + 3.4, sw.hy, sw.z + 1.2, 1.1); T.idle(0.8); let t = 0; while (sw.left > 0 && t < 14) { g.sim(1 / 60, { ...T.none(), coil: 1 }); t += 1 / 60; } const frozen = g.run.freeze, caught = g.run.caught; let fed = -1, t2 = 0; while (t2 < 3 && fed < 0) { g.sim(1 / 60, T.none()); t2 += 1 / 60; if (g.run.caught > caught) fed = t2; }
  g.music.hit = hit0; g.music.gulp = gulp0;
  return { left: sw.left, frozen: +frozen.toFixed(3), fed: +fed.toFixed(2), gained: g.run.caught - caught, catchHit: hits.find((h) => h[0] === 'catch'), notes: notes.length, top: notes.length ? notes[notes.length - 1][2] - notes[0][2] : 0, charge: +g.run.charge.toFixed(2) }; });
check('a great swarm is a bigger hit: a longer hold, a longer run of notes that climbs further, and the whole band', s.left === 0 && s.frozen > 0.08 && s.fed > 1.2 && s.gained === 70 && s.catchHit && s.catchHit[1] === 1 && s.notes >= 12 && s.top >= 19 && s.charge === 1, JSON.stringify(s));
s = await ev(async () => { const g = window.__game, T = window.T; g.startRun(4242); g.music.unlock(); const small = g.world.schools.filter((x) => x.tier === 's'), chain = [], band = [], hits = [], hit0 = g.music.hit; g.music.hit = (k, v) => { hits.push(k); return hit0(k, v); };
  for (const sw of small.slice(0, 4)) { g.sim(0.05, T.none()); T.put(sw.x + 2.6, sw.hy, sw.z + 0.9, 1.1); T.idle(0.5); let t = 0; while (sw.left > 0 && t < 6) { T.coil(0.1); t += 0.1; } T.idle(0.2); chain.push(g.run.chain); band.push(g.music.state.chain); }
  g.music.hit = hit0; const top = g.run.chain, heat = +g.music.state.heat.toFixed(2); T.idle(g.CHAIN.window + 0.5); const lapsed = g.run.chain, bandAfter = g.music.state.chain;
  const sw = small[4]; T.put(sw.x + 2.6, sw.hy, sw.z + 0.9, 1.1); T.idle(0.5); let t = 0; while (sw.left > 0 && t < 6) { T.coil(0.1); t += 0.1; } const fresh = g.run.chain;
  // what the layers sound like, without a speaker: six seconds of the band with no chain and with all of one
  const M = await import('/game/music.js'), loud = async (level) => { const off = new OfflineAudioContext(2, 44100 * 6, 44100), m = M.createMusic({ context: off }), buf = await m.render(6, () => ({ speed: 0.4, chain: level })), d = buf.getChannelData(0); let e = 0; for (let i = 0; i < d.length; i++) e += d[i] * d[i]; return Math.sqrt(e / d.length); };
  const quiet = await loud(0), full = await loud(3);
  return { chain, band, top, heat, lapsed, bandAfter, fresh, entrances: hits.filter((k) => k === 'chain').length, quiet: +quiet.toFixed(4), full: +full.toFixed(4) }; });
check('catches in a row add to the band, one layer a catch up to the solo; with nothing caught in time it goes back, and the next catch starts again', s.chain.join() === '0,1,2,3' && s.band.join() === '0,1,2,3' && s.top === 3 && s.heat > 0.5 && s.lapsed === 0 && s.bandAfter === 0 && s.fresh === 0 && s.entrances === 3 && s.full > s.quiet * 1.15, JSON.stringify(s));
s = await ev(() => { const g = window.__game, T = window.T; g.startRun(4242); g.music.unlock(); const tall = (n) => { g.run.segs = n; g.buildFish(n); const m = g.scene.getObjectByName('Oarfish'); m.geometry.computeBoundingBox(); return +m.geometry.boundingBox.max.y.toFixed(3); }, glow = () => +g.scene.getObjectByName('Oarfish').material.find((m) => m.name === 'FinRed').emissiveIntensity.toFixed(2);
  const h = [10, 13, 14, 19, 26].map(tall), day = [10, 14, 26].map((n) => { tall(n); return glow(); }); g.enterFloor(3, false); const dark = [10, 26].map((n) => { tall(n); return glow(); }); g.enterFloor(0, false);
  const hits = [], hit0 = g.music.hit; g.music.hit = (k, v) => { hits.push(k); return hit0(k, v); }; g.run.segs = 13; g.buildFish(13); g.run.food = 0; g.addFood(g.growCost(13)); g.music.hit = hit0; T.idle(0.2);
  return { rank: [13, 14, 18, 19, 23, 24, 26].map(g.stature).join(''), h, day, dark, hits: hits.join(), segs: g.run.segs, slow: g.fishPulse.value.y > 1 }; });
check('length shows: at 14, 19 and 24 segments the crest stands taller and the fins glow deeper, and reaching one is marked', s.rank === '0112233' && Math.abs(s.h[1] - s.h[0]) < 0.01 && s.h[2] > s.h[1] * 1.1 && s.h[3] > s.h[2] * 1.1 && s.h[4] > s.h[3] * 1.1 && s.day[0] === 0 && s.day[1] > 0.05 && s.day[2] > s.day[1] + 0.2 && s.dark[1] > s.dark[0] * 2 && s.hits === 'crest' && s.segs === 14 && s.slow, JSON.stringify(s));
// ---- body puzzles in the ruins: three kinds in every band but the last (two there), each opening a cache
s = await ev(() => { const g = window.__game, T = window.T, out = { bands: [] };
  for (let f = 0; f < 5; f++) { g.startRun(4242); if (f) g.enterFloor(f, false); const P = g.world.react.puzzles, r = g.world.rift, sp = g.rig.pos; out.bands.push(P.map((p) => p.kind[0]).join('') + (P.every((p) => (!r || Math.hypot(p.x - r.x, p.z - r.z) > 14) && Math.hypot(p.x - sp.x, p.z - sp.z) > 12) ? '' : '!')); }
  g.startRun(4242); g.run.safe = 1e9; const P = g.world.react.puzzles, h = (x, z) => g.world.height(x, z), fed = () => g.run.caught, east = (dx, dz, v = 0) => ({ ...T.none(), dir: { x: dx, y: 0, z: dz }, vertical: v });
  // the capstan: a pass beside it turns it a little and it unwinds; a body coiled round it turns it all the way
  { const p = P.find((x) => x.kind === 'capstan'), c = p.cache, lid0 = Math.hypot(c.lid.x - c.x, c.lid.z - c.z); T.put(p.x - 6, p.y + 0.3, p.z + 1.6, Math.PI / 2); g.sim(3.4, east(1, 0)); const passed = +p.k.toFixed(2), slid = Math.hypot(c.lid.x - c.x, c.lid.z - c.z); T.put(p.x + 30, p.y, p.z); T.idle(6); const unwound = +p.k.toFixed(2);
    const before = fed(); T.put(p.x + 2.6, p.y + 0.2, p.z + 0.9, 1.1); T.idle(0.3); let t = 0; while (!p.done && t < 30) { T.coil(0.1); t += 0.1; } T.idle(2.5); out.capstan = { lid0, passed, slid: +slid.toFixed(2), unwound, done: p.done, t: +t.toFixed(1), turned: +Math.abs(p.turn / (Math.PI * 2)).toFixed(2), fed: fed() - before, open: c.open, off: +Math.hypot(c.lid.x - c.x, c.lid.z - c.z).toFixed(2) }; }
  // the windows: two and then a stall puts them out; all four in one pass opens the cache
  { const p = P.find((x) => x.kind === 'windows'), H = p.hoops, thread = (list, slow = 0) => { T.put(H[list[0]].x - p.ux * 4 * p0, H[list[0]].y, H[list[0]].z - p.uz * 4 * p0, Math.atan2(p.ux * p0, p.uz * p0)); for (const k of list) { const hp = H[k]; let n = 0; while (n++ < 400) { const dx = hp.x + p.ux * 1.5 * p0 - g.rig.pos.x, dz = hp.z + p.uz * 1.5 * p0 - g.rig.pos.z, d = Math.hypot(dx, dz); if (d < 0.5) break; g.sim(1 / 60, east(dx / d, dz / d, Math.max(-1, Math.min(1, (hp.y - g.rig.pos.y) * 2)))); } if (slow) T.idle(slow); } };
    let p0 = 1; thread([0, 1]); const two = p.got; T.idle(7); const dark = p.got || 0; const before = fed(); p0 = -1; thread([3, 2, 1, 0]); T.idle(2.5);
    out.windows = { two, dark, done: p.done, got: p.got, lit: H.filter((x) => x.lit).length, fed: fed() - before, open: p.cache.open }; }
  // the vent: a quick pass over it is not enough; a body lying over it blows the cap off the other, and a shell is left there
  { const p = P.find((x) => x.kind === 'vent'), shells = g.field.items.length; const c = p.cache, ax = -(c.z - p.z) / Math.hypot(c.x - p.x, c.z - p.z), az = (c.x - p.x) / Math.hypot(c.x - p.x, c.z - p.z); T.put(p.x - ax * 9, p.y + 0.5, p.z - az * 9, Math.atan2(ax, az)); let press = 0;
    for (let i = 0; i < 240; i++) { const tx = p.x + ax * 9 - g.rig.pos.x, tz = p.z + az * 9 - g.rig.pos.z, d = Math.hypot(tx, tz) || 1; g.sim(1 / 60, { ...east(tx / d, tz / d, Math.max(-1, Math.min(1, (p.y + 0.5 - g.rig.pos.y) * 2))), sprint: true }); press = Math.max(press, p.press); } const quick = p.done; press = +press.toFixed(2); T.put(p.x + 30, p.y + 2, p.z); T.idle(3);
    const before = fed(); T.put(p.x + 2.2, p.y + 0.45, p.z, Math.PI / 2); let t = 0, most = 0; while (!p.done && t < 6) { T.idle(0.1); t += 0.1; most = Math.max(most, p.press); } T.idle(2.5);
    out.vent = { quick, press, done: p.done, t: +t.toFixed(1), fed: fed() - before, open: p.cache.open, shells: g.field.items.length - shells, lidUp: +(p.cache.lid.y - p.cache.y).toFixed(2) }; }
  out.caches = g.run.caches.join(); out.food = g.world.react.puzzles.length; g.run.safe = 0; return out; });
check('body puzzles: a capstan turned by coiling round it, four windows threaded in one pass, a vent plugged by lying over it; each opens its cache, and half-doing one undoes itself',
  s.bands.join() === 'cwv,cwv,cwv,cwv,cv' && s.capstan.lid0 === 0 && s.capstan.passed > 0.1 && s.capstan.passed < 0.8 && s.capstan.slid > 0.1 && s.capstan.unwound === 0 && s.capstan.done && s.capstan.turned >= 1.25 && s.capstan.fed === 12 && s.capstan.open === 1 && s.capstan.off > 1.5
  && s.windows.two === 2 && s.windows.dark === 0 && s.windows.done && s.windows.lit === 4 && s.windows.fed === 12 && s.windows.open === 1
  && !s.vent.quick && s.vent.press > 0.1 && s.vent.press < 0.9 && s.vent.done && s.vent.t < 3 && s.vent.fed === 12 && s.vent.open === 1 && s.vent.shells === 1 && s.caches === '3', JSON.stringify(s));
// ---- hauling: a fragment of the ruins, wrapped, carried with the body tied up, and given to the rift
s = await ev(() => { const g = window.__game, T = window.T, out = { bands: [] };
  for (let f = 0; f < 5; f++) { g.startRun(4242); if (f) g.enterFloor(f, false); const F = g.world.react.fragments, G = g.world.goal; out.bands.push(F.length + (F.every((x) => Math.hypot(x.x - G.x, x.z - G.z) >= 24) ? '' : '!')); }
  try { localStorage.removeItem('oarfish.nest'); } catch {} g.nest.fragments = 0;
  g.startRun(4242); g.run.safe = 1e9; const F = g.world.react.fragments, f = F[0], r = g.world.rift, bed = (x, z) => g.world.height(x, z), lay = { x: f.x, z: f.z };
  const take = () => { T.put(f.x + 2.6, bed(f.x, f.z) + 1.6, f.z + 0.9, 1.1); T.idle(0.3); let t = 0; while (!g.run.haul && t < 14) { T.coil(0.1); t += 0.1; } return +t.toFixed(1); };
  const t1 = take(), held = g.run.haul === f && f.held; g.sim(2.5, { ...T.none(), dir: { x: 1, y: 0, z: 0 } }); const tempo = +g.rig.tempo.toFixed(2), under = +g.rig.joints.reduce((m, j) => Math.min(m, Math.hypot(j.x - f.x, j.z - f.z)), 9).toFixed(2), off = +(f.y - bed(f.x, f.z)).toFixed(1);
  const sw = T.swarm('s'), n0 = sw.left; T.put(sw.x + 2.6, sw.hy, sw.z + 0.9, 1.1); T.idle(0.6); T.coil(5); const tied = sw.left === n0 && g.run.haul === f; // it cannot wrap with a load
  T.put(lay.x + 1, bed(lay.x, lay.z) + 2, lay.z, 1.1); T.idle(0.6); // back to the open ground it lay on, so that what follows is not done up against a pen
  const segs = g.run.segs; g.shed(); T.idle(0.3); const dropped = !g.run.haul && !f.held && g.run.segs === segs, rest = +(f.y - bed(f.x, f.z)).toFixed(2);
  take(); const had = g.run.haul === f, pre = g.run.segs; g.run.safe = 0; const bit = g.bite(1, 5, g.rig.pos); g.run.safe = 1e9; T.coil(0.8); const shaken = had && bit && !g.run.haul && !f.held, lost = pre - g.run.segs;
  const t3 = take(), again = g.run.haul === f; T.put(r.x, r.y + 1.5, r.z, 0); T.idle(0.5); const given = { t3, again, haul: !g.run.haul, gone: f.gone, hauled: g.run.hauled, kept: g.nest.fragments, stored: JSON.parse(localStorage.getItem('oarfish.nest') || '{}').fragments };
  T.idle(7); const sunk = !f.mesh.visible; g.die(); g.sim(4); const card = document.getElementById('end-text').textContent; g.startRun(4242); g.run.safe = 0;
  return { bands: out.bands.join(), t1, held, tempo, under, off, tied, dropped, rest, shaken, lost, given, sunk, card: /1 fragment of the ruins given to the rift \(1 in all\)/.test(card) }; });
check('a fragment of the ruins is taken up by going round it, rides under the body, and ties it up: no wrapping, a slower swim; the shed key or a bite lets it go; carried over the rift it is given, counted on the end card and kept for the nest',
  s.bands === '2,2,2,2,2' && s.t1 < 8 && s.held && Math.abs(s.tempo - 0.85) < 0.03 && s.under < 0.6 && s.off > 0.5 && s.tied && s.dropped && s.rest < 0.6 && s.shaken && s.lost >= 1 && s.given.haul && s.given.gone && s.given.hauled === 1 && s.given.kept === 1 && s.given.stored === 1 && s.sunk && s.card, JSON.stringify(s));

// ---- swarms with tempers: one bolts upward, one parts in two, one only bunches near light
s = await ev(() => { const g = window.__game, T = window.T, out = {}, quiet = () => { g.run.safe = 1e9; for (const list of [g.foes.biters, g.foes.anglers || []]) for (const b of list) b.alive = false; g.sim(0.1, T.none()); };
  out.kinds = []; for (let f = 0; f < 5; f++) { g.startRun(4242); if (f) g.enterFloor(f, false); out.kinds.push(g.world.schools.filter((x) => !x.of).map((x) => (x.kind || '.')[0]).join('')); }
  // the one that bolts: come at level, it climbs; left alone it sinks back; come down on it and it holds, and is taken
  g.startRun(4242); quiet(); const b = g.world.schools.find((x) => x.kind === 'bolt'), rest = b.y;
  T.put(b.x + 7, b.y, b.z, -1.57); for (let i = 0; i < 36; i++) { const dx = b.x - g.rig.pos.x, dz = b.z - g.rig.pos.z, d = Math.hypot(dx, dz) || 1; g.sim(0.1, { ...T.none(), dir: { x: dx / d, y: 0, z: dz / d } }); }
  out.bolt = { rose: +(b.y - rest).toFixed(1), capped: b.capped, left: b.left, told: g.world.react.swarms.some((n) => n.what === 'bolt') || b.bolted };
  T.put(b.x + 40, b.y, b.z + 40, 0); g.sim(14, T.none()); out.bolt.sunk = +(b.y - rest).toFixed(1);
  for (let i = 0; i < 6; i++) g.addFood(8); g.sim(3, T.none()); T.put(b.x + 2.6, b.y + 3, b.z + 0.9, 1.1); g.sim(0.6, T.none()); out.bolt.held = b.capped && Math.abs(b.y - rest) < 0.3;
  let t = 0; while (b.left > 0 && t < 12) { g.sim(0.1, { ...T.none(), coil: 1, vertical: g.rig.pos.y > b.y + 1.3 ? -1 : 0 }); t += 0.1; } out.bolt.taken = b.left === 0;
  // the one that parts: two swarms a size down, which a body too short for the whole can take; a fresh one, left alone, mends
  const take = (q) => { T.put(q.x + 2.6, q.y, q.z + 0.9, 1.1); g.sim(0.4, T.none()); let t = 0; while (q.left > 0 && t < 10) { g.sim(0.1, { ...T.none(), coil: 1 }); t += 0.1; } return q.left === 0; };
  const fresh = () => { g.startRun(4242); g.enterFloor(1, false); quiet(); return g.world.schools.find((x) => x.kind === 'twin'); };
  let w = fresh(), tw = w.twin; const whole = { n: w.n, tier: w.tier, can: w.can, least: +w.least.toFixed(2), halfLeft: tw.left }; T.put(w.x + 14, w.y, w.z, -1.57); T.toward(w, 6, 3);
  out.twin = { whole, split: w.split, n: [w.n, tw.n].join(), tier: w.tier + tw.tier, apart: +Math.hypot(w.x - tw.x, w.z - tw.z).toFixed(1), can: w.can && tw.can, segs: g.run.segs };
  const c0 = g.run.caught; out.twin.one = take(w) && tw.left > 0; out.twin.two = take(tw); g.sim(2.5, T.none()); out.twin.fed = g.run.caught - c0;
  w = fresh(); tw = w.twin; T.put(w.x + 14, w.y, w.z, -1.57); T.toward(w, 6, 3); const parted = w.split; T.put(w.x + 50, w.y, w.z + 50, 0); g.sim(12, T.none()); out.twin.mend = parted && !w.split && w.n === whole.n && w.left === whole.n && w.tier === whole.tier && tw.left === 0;
  // the ones that seek the light: in the dark they do not bunch but run, to a lantern flower, and there they bunch and are taken
  g.startRun(4242); g.enterFloor(2, false); quiet(); out.glow = [];
  for (const q of g.world.schools.filter((x) => x.kind === 'glow')) { const o = { dark: !q.lit }; T.put(q.x + 12, q.y, q.z, -1.57); g.sim(0.3, T.none()); const x0 = q.x, z0 = q.z; let t = 0, loose = 0; while (!q.lit && t < 20) { T.toward(q, 0.1, 2.5); t += 0.1; loose = Math.max(loose, q.threat); }
    o.loose = +loose.toFixed(2); o.ran = +Math.hypot(q.x - x0, q.z - z0).toFixed(1); o.lit = q.lit; g.sim(1, T.none()); o.bunched = q.threat > 0.6; for (let i = 0; i < 6; i++) g.addFood(8); g.sim(2, T.none()); o.taken = take(q); out.glow.push(o); }
  g.startRun(4242); g.run.safe = 0; return out; });
check('swarms have tempers, the same in every dive: one bolts straight up when come at level, sinks back, and holds for a body that comes down on it; one parts into two a size down, which a short body can take one after the other, and mends if left; some will not bunch in the dark but run to a lantern flower and bunch there',
  s.kinds.join() === '......b..,...b.t..,.gbtg.t.,.gbtg..,.btg..' && s.bolt.rose > 5 && !s.bolt.capped && s.bolt.left > 0 && s.bolt.told && Math.abs(s.bolt.sunk) < 0.3 && s.bolt.held && s.bolt.taken
  && s.twin.whole.tier === 'm' && s.twin.whole.halfLeft === 0 && s.twin.split && s.twin.n === '9,9' && s.twin.tier === 'ss' && s.twin.apart > 3 && s.twin.can && s.twin.one && s.twin.two && s.twin.fed === 18 && s.twin.mend
  && s.glow.length === 2 && s.glow.every((o) => o.dark && o.loose < 0.3 && o.ran > 1 && o.lit && o.bunched && o.taken), JSON.stringify(s));

// ---- a cleaning station: hold still over it while the hunters go round, and a segment grows back
s = await ev(() => { const g = window.__game, T = window.T, C = g.CLEAN, out = {}, still = { ...T.none(), amount: 0 };
  out.bands = []; for (let f = 0; f < 5; f++) { g.startRun(4242); if (f) g.enterFloor(f, false); const S = g.world.react.stations; out.bands.push(S.length + (S.every((x) => g.foes.biters.filter((b) => Math.hypot(b.pos.x - x.x, b.pos.z - x.z) < C.call).length >= 2) ? '' : '!')); }
  g.startRun(4242); g.enterFloor(1, false); g.run.safe = 0; g.sim(0.1, T.none());
  const st = g.world.react.stations[0], segs = g.run.segs, over = () => { T.put(st.x, st.top + 1.2, st.z - 1.0, 0); }, round = () => g.foes.biters.filter((b) => b.state === 'circle'), far = () => round().map((b) => Math.hypot(b.pos.x - st.cx, b.pos.z - st.cz));
  // broken off: a start, the hunters come, then the head leaves and nothing is given
  over(); g.sim(2.5, still); const k1 = +st.k.toFixed(2), came = round().length; T.put(st.x + 30, st.top + 1.2, st.z, 0); g.sim(2, still); out.broke = { k1, came, k: st.k, segs: g.run.segs - segs, uses: st.uses, truce: round().length };
  // held to the end
  over(); g.foes.biters.forEach((b) => { b.cool = 0; }); let t = 0, most = 0, ring0 = 0; const news = [];
  while (st.uses === C.uses && t < 12) { g.sim(0.1, still); t += 0.1; most = Math.max(most, round().length); if (Math.abs(t - 1.5) < 0.05) ring0 = Math.min(...far()); }
  out.held = { t: +t.toFixed(1), most, ring0: +ring0.toFixed(1), ring1: +Math.min(...g.foes.biters.map((b) => Math.hypot(b.pos.x - st.cx, b.pos.z - st.cz))).toFixed(1), segs: g.run.segs - segs, cleaned: g.run.cleaned, uses: st.uses, resting: st.rest > 20 };
  // the truce is over: for a moment they wait, then they hunt; a head that goes at once gets away with what it was given
  g.sim(0.3, still); const back = g.foes.biters.filter((b) => b.state === 'flee').length; g.sim(0.3, still); const waiting = g.foes.biters.every((b) => b.state !== 'hunt'); let hunted = 0; for (let i = 0; i < 12; i++) { g.sim(0.25, { ...T.none(), dir: { x: 0, y: 0, z: 1 }, sprint: true }); hunted = Math.max(hunted, g.foes.biters.filter((b) => b.state === 'hunt').length); }
  out.after = { back, waiting, hunted, kept: g.run.segs - segs };
  // resting, it gives nothing; after its second time it is spent, and its cleaners have gone in
  g.foes.biters.forEach((b) => { b.alive = false; }); over(); g.sim(3, still); const rested = st.k; st.rest = 0; g.sim(0.2, still); t = 0; while (st.uses > 0 && t < 12) { g.sim(0.1, still); t += 0.1; } g.sim(2, still);
  out.spent = { rested, uses: st.uses, segs: g.run.segs - segs, away: +st.away.toFixed(2), ring: st.ring.visible };
  g.startRun(4242); g.run.safe = 0; return out; });
check('a cleaning station in every band that has tail-biters, with two of them living near it: a head held still over it is worked on while the hunters come and go round, closing in, and nothing bites; at the end a segment has grown back, the hunters start back and wait a moment and then hunt, and a head that leaves at once keeps it; broken off it gives nothing; it rests between its two times and then is spent',
  s.bands.join() === '0,1,1,1,1' && s.broke.k1 > 0.3 && s.broke.came >= 2 && s.broke.k === 0 && s.broke.segs === 0 && s.broke.uses === 2 && s.broke.truce === 0
  && s.held.t > 5.6 && s.held.t < 7.6 && s.held.most >= 2 && s.held.ring1 < s.held.ring0 - 1 && s.held.ring1 < 4.2 && s.held.segs === 1 && s.held.cleaned === 1 && s.held.uses === 1 && s.held.resting
  && s.after.back >= 2 && s.after.waiting && s.after.hunted >= 1 && s.after.kept === 1 && s.spent.rested === 0 && s.spent.uses === 0 && s.spent.segs === 2 && s.spent.away > 0.9 && !s.spent.ring, JSON.stringify(s));

// ---- the mural at each rift: three carvings, lit for what was done in the band
s = await ev(() => { const g = window.__game, T = window.T, out = {}, still = { ...T.none(), amount: 0 }, lit = (m) => m.signs.map((x) => +(x.earned) + '' + Math.round(x.lit)).join(' ');
  out.bands = []; for (let f = 0; f < 5; f++) { g.startRun(4242); if (f) g.enterFloor(f, false); const m = g.world.react.mural, G = g.world.goal; out.bands.push(m ? Math.round(Math.hypot(m.x - G.x, m.z - G.z)) : 0); out['great' + f] = g.world.react.greatest; }
  g.startRun(4242); g.enterFloor(1, false); g.run.safe = 1e9; for (const b of g.foes.biters) b.alive = false; g.sim(0.2, still);
  const R = g.world.react, m = R.mural; out.start = lit(m);
  // a small swarm is not the band's greatest; its greatest is. A cache opened, and the keeper beaten.
  const take = (q) => { T.put(q.x + 2.6, q.y, q.z + 0.9, 1.1); g.sim(0.4, T.none()); let t = 0; while (q.left > 0 && t < 12) { g.sim(0.1, { ...T.none(), coil: 1 }); t += 0.1; } return q.left === 0; };
  take(T.swarm('s')); out.small = lit(m);
  for (let i = 0; i < 9; i++) g.addFood(12); g.sim(3, still); out.segs = g.run.segs; out.took = take(T.swarm(R.greatest)); out.swarm = lit(m);
  R.opened.push({ kind: 'vent', x: g.rig.pos.x + 2, y: g.rig.pos.y, z: g.rig.pos.z, food: 6, shell: false }); g.sim(0.3, still); out.cache = lit(m);
  g.guard.debug.fall(); g.sim(0.5, still); out.guard = lit(m);
  // far from it, nothing is lit yet; come up to it and they light one after another, and then its painted top
  const news = []; T.put(m.x + Math.sin(m.yaw) * 6, m.y + 2, m.z + Math.cos(m.yaw) * 6, m.yaw + Math.PI); const grab = () => { for (const c of R.carved) news.push(c.what + (c.i ?? '')); };
  g.sim(0.3, still); const first = lit(m); g.sim(4, still); out.near = { first, then: lit(m), whole: m.whole, top: +m.top.material.emissiveIntensity.toFixed(2), sign: +m.signs[0].mesh.material.emissiveIntensity.toFixed(2) };
  g.startRun(4242); g.run.safe = 0; return out; });
check('every rift has a mural with three carvings, dark at first: the band\u2019s greatest swarm taken (not a lesser one), a cache opened and the keeper beaten each win one, and they light one after another only when the fish comes up to it, and then its painted top lights too; the palace has none',
  s.bands.slice(0, 4).every((d) => d >= 16 && d <= 36) && s.bands[4] === 0 && s.great0 === 'h' && s.great1 === 'l' && s.start === '00 00 00' && s.small === '00 00 00' && s.took && s.swarm === '10 00 00' && s.cache === '10 10 00' && s.guard === '10 10 10'
  && s.near.first !== '11 11 11' && s.near.then === '11 11 11' && s.near.whole && s.near.top > 0.4 && s.near.sign > 0.6, JSON.stringify(s));

// ---- the nest remembers: a line of stones as long as the record body, and a place for every kind of shell
s = await ev(() => { const g = window.__game, T = window.T, out = {}, kept = JSON.stringify(g.nest), shown = (N) => N.group.children.filter((c) => !c.isInstancedMesh && !c.userData.sign).length;
  Object.assign(g.nest, { record: 0, shells: [], fragments: 0 }); g.startRun(4242); let N = g.world.react.nest;
  out.bare = { line: N.line, stones: N.stones, places: N.places.length, found: N.places.filter((p) => p.found).length, stood: N.stood, shown: shown(N) };
  Object.assign(g.nest, { record: 19, shells: ['spire', 'fan', 'ring', 'cap', 'lamp'], fragments: 3 }); g.startRun(4242); N = g.world.react.nest; g.sim(0.2, T.none());
  const J = g.rig.joints, tail = J[J.length - 1], head = g.rig.snout, yaw = N.yaw, side = (p) => (p.x - N.x) * Math.cos(yaw) - (p.z - N.z) * Math.sin(yaw); // how far to the right of the start line a point is
  const low = Math.min(...N.places.filter((p) => !p.raised).map((p) => p.top)), high = N.places.filter((p) => p.raised).map((p) => p.top);
  out.full = { line: +N.line.toFixed(2), body: +(g.rig.length + 0.5).toFixed(2), stones: N.stones, found: N.places.filter((p) => p.found).map((p) => p.type).join(), stood: N.stood, shown: shown(N), lifted: high.length === 3 && high.every((y) => y > low + 0.3),
    right: N.places.every((p) => p.x * Math.cos(yaw) - p.z * Math.sin(yaw) > 1.5), fish: +side(head).toFixed(1) };
  g.enterFloor(1, false); out.below = !!g.world.react.nest;
  // it is kept as it happens: a longer body than any before, a kind of shell not found before
  Object.assign(g.nest, { record: 12, shells: [], fragments: 0 }); g.startRun(4242); for (let i = 0; i < 6; i++) g.addFood(12); g.sim(2, T.none()); g.giveShell('horn'); const saved = JSON.parse(localStorage.getItem('oarfish.nest'));
  out.kept = { segs: g.run.segs, record: g.nest.record, saved: saved.record, shells: saved.shells.join() };
  g.startRun(4242); N = g.world.react.nest; out.next = { line: +N.line.toFixed(2), found: N.places.filter((p) => p.found).map((p) => p.type).join(), shown: shown(N) };
  Object.assign(g.nest, JSON.parse(kept)); localStorage.setItem('oarfish.nest', kept); g.startRun(4242); g.run.safe = 0; return out; });
check('the nest is where a dive starts: nothing in it at first but ten empty places; then a line of stones as long as the longest body there has been, a shell over the place of each kind found, and the first of them raised on the column tops hauled to the rifts; it is kept as it happens and shown in the next dive, and only the first band has it',
  s.bare.line === 0 && s.bare.stones === 0 && s.bare.places === 10 && s.bare.found === 0 && s.bare.stood === 0 && s.bare.shown === 0
  && Math.abs(s.full.line - 6.43) < 0.02 && s.full.line > s.full.body + 2 && s.full.stones >= 13 && s.full.stones <= 17 && s.full.found === 'spire,fan,ring,cap,lamp' && s.full.stood === 3 && s.full.shown === 5 && s.full.lifted && s.full.right && Math.abs(s.full.fish) < 0.6 && !s.below
  && s.kept.segs > 12 && s.kept.record === s.kept.segs && s.kept.saved === s.kept.segs && s.kept.shells === 'horn' && Math.abs(s.next.line - (s.kept.segs * 0.312 + 0.5)) < 0.02 && s.next.found === 'horn' && s.next.shown === 1, JSON.stringify(s));

// ---- unlocks: four kinds of shell are won by feats, and are in the pool from the next dive on
s = await ev(() => { const g = window.__game, T = window.T, out = {}, kept = JSON.stringify(g.nest), still = { ...T.none(), amount: 0 }, locked = ['spine', 'tusk', 'horn', 'pearl'];
  const lying = () => { const seen = new Set(); for (const seed of [4242, 7, 99]) for (let f = 0; f < 5; f++) { g.startRun(seed); if (f) g.enterFloor(f, false); for (const it of g.field.items) seen.add(it.type); } return [...seen].sort().join(); };
  Object.assign(g.nest, { record: 0, shells: [], fragments: 0, feats: {} }); out.pool0 = (g.startRun(4242), g.run.pool.join()); out.lying0 = lying();
  // a cache opened, for the first time ever: said once, kept, and not in this dive's pool but in the next one's; its place in the nest is lit
  g.startRun(4242); g.run.safe = 1e9; const sign = (t) => g.world.react.nest.places.find((p) => p.type === t); const before = { open: sign('tusk').open, sign: sign('tusk').sign };
  g.world.react.opened.push({ kind: 'vent', x: g.rig.pos.x + 2, y: g.rig.pos.y, z: g.rig.pos.z, food: 6, shell: false }); g.sim(0.5, still);
  out.won = { before, feats: Object.keys(g.nest.feats).join(), saved: Object.keys(JSON.parse(localStorage.getItem('oarfish.nest')).feats).join(), title: document.getElementById('toast-title').textContent, now: g.run.pool.includes('tusk'), again: g.feat('cache') };
  g.startRun(4242); out.next = { pool: g.run.pool.join(), open: sign('tusk').open, others: locked.filter((t) => t !== 'tusk').every((t) => !sign(t).open), base: sign('fan').sign };
  // the other three: the band's greatest swarm, the keeper, a whole mural
  g.enterFloor(1, false); g.run.safe = 1e9; for (const b of g.foes.biters) b.alive = false; g.sim(0.2, still); const R = g.world.react, m = R.mural;
  for (let i = 0; i < 9; i++) g.addFood(12); g.sim(3, still); const q = T.swarm(R.greatest); T.put(q.x + 2.6, q.y, q.z + 0.9, 1.1); g.sim(0.4, T.none()); for (let t = 0; q.left > 0 && t < 12; t += 0.1) g.sim(0.1, { ...T.none(), coil: 1 });
  const afterSwarm = Object.keys(g.nest.feats).sort().join(); g.guard.debug.fall(); g.sim(0.5, still); const afterGuard = Object.keys(g.nest.feats).sort().join();
  R.opened.push({ kind: 'vent', x: g.rig.pos.x + 2, y: g.rig.pos.y, z: g.rig.pos.z, food: 6, shell: false }); g.sim(0.3, still); T.put(m.x + Math.sin(m.yaw) * 6, m.y + 2, m.z + Math.cos(m.yaw) * 6, m.yaw + Math.PI); g.sim(4.5, still);
  out.all = { afterSwarm, afterGuard, feats: Object.keys(g.nest.feats).sort().join(), pool: (g.startRun(4242), g.run.pool.length) }; out.lying1 = lying();
  // the testing tools
  document.getElementById('dev-forget').click(); const emptied = JSON.stringify(g.nest); document.getElementById('dev-unlock').click(); out.tools = { emptied, unlocked: Object.keys(g.nest.feats).sort().join() };
  Object.assign(g.nest, JSON.parse(kept)); g.nest.feats = JSON.parse(kept).feats || {}; localStorage.setItem('oarfish.nest', kept); g.startRun(4242); g.run.safe = 0; return out; });
check('four kinds of shell have to be won: until then none of them lies about in any band; a cache opened, a band\u2019s greatest swarm taken, a keeper beaten and a whole mural lit each win one, said once and kept; what is won is in the pool from the next dive, not this one, and its place in the nest is lit',
  s.pool0 === 'spire,fan,coil,ring,cap,lamp' && s.lying0 === 'cap,coil,fan,lamp,ring,spire' && !s.won.before.open && s.won.before.sign === 'cache' && s.won.feats === 'cache' && s.won.saved === 'cache' && s.won.title === 'Tusk' && !s.won.now && s.won.again === false
  && s.next.pool === 'spire,fan,coil,ring,cap,lamp,tusk' && s.next.open && s.next.others && s.next.base === null && s.all.afterSwarm === 'cache,swarm' && s.all.afterGuard === 'cache,guard,swarm' && s.all.feats === 'cache,guard,mural,swarm' && s.all.pool === 10
  && s.lying1 === 'cap,coil,fan,horn,lamp,pearl,ring,spine,spire,tusk' && /"record":0/.test(s.tools.emptied) && /"feats":\{\}/.test(s.tools.emptied) && s.tools.unlocked === 'cache,guard,mural,swarm', JSON.stringify(s));

// ---- nothing hangs at a rift's edge: every piece within nine metres of the line stands on the bed as it is drawn, or on another piece
{ const rows = []; for (const seed of [4242, 7]) for (let band = 0; band < 4; band++) { const a = await audit(page, seed, band); rows.push({ seed, band, looked: a.looked, hang: a.hanging.slice(0, 3), sunk: a.sunk.slice(0, 3), n: a.hanging.length + a.sunk.length }); }
  const lip = await ev(() => { const g = window.__game; g.startRun(4242); const w = g.world, r = w.rift, at = (u, q) => { const k = -(r.w(u) - q) + r.mid(u); return [r.x + r.tx * u + r.nx * k, r.z + r.tz * u + r.nz * k]; }; // q metres in from the near edge
    let shelf = 0, drawn = 0, n = 0; for (let u = -30; u <= 30; u += 1.7) for (const q of [-2, -1.2, -0.6, -0.2, 0]) { const [x, z] = at(u, q); shelf = Math.max(shelf, Math.abs(w.height(x, z) - r.y)); drawn = Math.max(drawn, Math.abs(w.drawn(x, z) - r.y)); n++; }
    let off = 0; for (let u = -30; u <= 30; u += 1.7) for (const q of [1.5, 2.2, 3, 3.8, 5, 6, 7]) { const [x, z] = at(u, q); off = Math.max(off, Math.abs(w.drawn(x, z) - w.height(x, z))); }
    g.run.safe = 0; return { n, shelf: +shelf.toFixed(3), drawn: +drawn.toFixed(2), off: +off.toFixed(2) }; });
  check('by a rift nothing hangs in the water and nothing is buried: every piece near the line stands on the bed as it is drawn; the shelf is level right up to the line, and the drawn lip, ledge and wall keep to the ones the fish swims over',
    rows.every((r) => r.looked > 300 && r.n === 0) && lip.shelf < 0.001 && lip.drawn < 0.3 && lip.off < 2, JSON.stringify({ rows: rows.filter((r) => r.n).slice(0, 3), lip })); }

// ---- the keepers do not get stuck in the stonework: dropped into every column near their ground, and between every two that stand close, they come home
s = await ev(() => { const g = window.__game, T = window.T, out = {}, none = { ...T.none(), amount: 0 }, W = (d) => d - 144 * Math.round(d / 144), far = (a, b) => Math.hypot(W(a.x - b.x), W(a.z - b.z));
  for (const [band, back, round, lift, wait] of [[0, 24, 8.6, 0.9, 60], [1, 0, 11, 1.5, 30]]) { g.startRun(4242); if (band) g.enterFloor(band, false); g.run.safe = 1e9; for (const b of g.foes.biters) b.alive = false;
    const w = g.world, r = w.rift, G = g.guard, P = G.pos, home = { x: r.x - r.nx * back, z: r.z - r.nz * back }, o = { kind: G.kind };
    const inStone = () => { const q = P.clone(); if (band) w.pushOut(q, 0.5); else { q.y = w.height(q.x, q.z) + 0.6; w.steer(q, 0.3); } return Math.hypot(q.x - P.x, q.z - P.z) > 1e-4; }; // the crab walks: only what it cannot step over counts
    T.put(home.x - r.nx * 31, r.y + 9, home.z - r.nz * 31, 0); g.sim(0.5, none); // near enough that the world does not come round between them, too far to wake it
    const cols = []; for (const p of w.pieces()) if (/shaft|stump|jar|block|drum/.test(p.name) && (band ? far(p, home) < round + 16 : Math.abs(far(p, home) - round) < 4)) { const at = cols.find((c) => far(c, p) < 0.5); if (at) at.shaft ||= /shaft/.test(p.name); else cols.push({ x: p.x, z: p.z, shaft: /shaft/.test(p.name) }); } // the Shearer's charges take it a long way; the Keeper never leaves its round
    const spots = cols.map((c) => [c.x, c.z]); for (let i = 0; i < cols.length; i++) for (let j = i + 1; j < cols.length; j++) if (far(cols[i], cols[j]) < 5) spots.push([(cols[i].x + cols[j].x) / 2, (cols[i].z + cols[j].z) / 2]);
    o.spots = spots.length; o.home = 0; o.inside = 0; o.worst = 0;
    const every = Math.max(1, Math.ceil(spots.length / 36)), tried = spots.filter((_, i) => i % every === 0);
    for (const [x, z] of tried) { G.debug.set('idle'); P.set(x, w.height(x, z) + lift, z); let t = 0, back = false;
      while (t < wait && !back) { g.sim(0.25, none); t += 0.25; if (t > 1 && inStone()) o.inside++; back = t > 1 && Math.abs(far(P, home) - round) < 1.8; }
      if (back) o.home++; o.worst = Math.max(o.worst, t); }
    o.tried = tried.length;
    if (band) { // and a charge at a column stops on it: outside it, and spent
      const open = (c) => [7, 5.5, 4, 2.5].every((d) => { const q = P.clone().set(c.x + d, w.height(c.x, c.z) + 1.6, c.z), q0 = q.clone(); w.pushOut(q, 0.9); return q.distanceTo(q0) < 1e-4; }); // a column with a clear run up to it
      const c = cols.filter((q) => q.shaft && open(q)).sort((a, b) => far(a, home) - far(b, home))[0], y = w.height(c.x, c.z) + 1.6; G.debug.set('idle'); P.set(c.x + 7, y, c.z); g.sim(0.05, none); P.set(c.x + 7, y, c.z); G.debug.charge(c.x - 7, y, c.z);
      let passed = false, stone = 0; for (let i = 0; i < 40; i++) { g.sim(0.05, none); if (W(P.x - c.x) < -1.5) passed = true; if (inStone()) stone++; } o.charge = { state: G.state.state, passed, stone, short: +W(P.x - c.x).toFixed(2) }; }
    out[G.kind] = o; }
  g.startRun(4242); g.run.safe = 0; return out; });
check('the Keeper and the Shearer, put down in every column near their ground and between every two that stand close, come home from all of them and are never left in the stone; and a charge at a column stops short of it, spent',
  s.keeper.tried > 4 && s.keeper.home === s.keeper.tried && s.keeper.inside === 0 && s.shearer.tried > 8 && s.shearer.home === s.shearer.tried && s.shearer.inside === 0 && s.shearer.worst < 20
  && s.shearer.charge.state === 'tired' && !s.shearer.charge.passed && s.shearer.charge.stone === 0 && s.shearer.charge.short > 1 && s.shearer.charge.short < 3, JSON.stringify(s));
// ---- the world answers the fish. None of it is a rule: it must only happen, and cost nothing
s = await ev(() => { const g = window.__game, T = window.T; g.startRun(4242); g.run.safe = 1e9; const R = g.world.react, A = R.grown.anemone[0];
  // how far a thing standing at (x, y, z) is pulled in, as the plants' material works it out from the wake
  const pull = (x, y, z, tall = 0.6) => Math.max(...R.wake.value.map((w) => { const dy = w.y - Math.min(Math.max(w.y, y), y + tall), d = Math.hypot(w.x - x, dy, w.z - z), k = Math.min(1, Math.max(0, (d - 0.7) / 1.9)); return w.w * (1 - k * k * (3 - 2 * k)); }));
  T.put(A.x + 30, A.y + 3, A.z); T.idle(0.3); const far = pull(A.x, A.y, A.z);
  T.put(A.x - 4, A.y + 1.5, A.z, Math.PI / 2); let over = 0, under = 1, tail = -1; const J = () => g.rig.joints;
  for (let i = 0; i < 80 && tail < 0; i++) { T.swim(0.1, 1, 0); const p = pull(A.x, A.y, A.z); over = Math.max(over, p); if (J()[0].x > A.x + 1 && J()[J().length - 1].x < A.x - 1) under = Math.min(under, p); if (J()[J().length - 1].x > A.x + 4.5) tail = p; }
  T.swim(4, 1, 0); const gone = pull(A.x, A.y, A.z);
  return { far, over, under, tail, gone, kinds: Object.keys(R.grown).filter((k) => R.grown[k].length).join(), points: R.wake.value.length }; });
check('an anemone shuts as the fish goes over, stays shut for its whole length and a moment more, and opens again', s.far === 0 && s.over > 0.7 && s.under > 0.5 && s.tail > 0.1 && s.gone === 0 && /anemone/.test(s.kinds) && /kelp/.test(s.kinds) && /seagrass/.test(s.kinds) && /clam/.test(s.kinds), JSON.stringify(s));
s = await ev(() => { const g = window.__game, T = window.T, R = g.world.react, f = R.pilots[0], h = (x, z) => g.world.height(x, z);
  const yaw = Math.atan2(g.world.goal.x - f.hx, g.world.goal.z - f.hz), dx = Math.sin(yaw), dz = Math.cos(yaw), x0 = f.hx - dx * 14 + dz * 9, z0 = f.hz - dz * 14 - dx * 9;
  T.put(x0, h(x0, z0) + 5, z0, yaw); T.idle(0.2); const p0 = R.puffed; g.sim(2.5, { ...T.none(), dir: { x: dx, y: 0, z: dz } }); const high = R.puffed - p0, clearHigh = g.rig.pos.y - h(g.rig.pos.x, g.rig.pos.z);
  T.put(x0, h(x0, z0) + 1.5, z0, yaw); T.idle(0.1); const p1 = R.puffed; g.sim(2.5, { ...T.none(), dir: { x: dx, y: 0, z: dz }, vertical: -1 }); const low = R.puffed - p1, live = R.puffs, clearLow = g.rig.pos.y - h(g.rig.pos.x, g.rig.pos.z);
  T.idle(4); return { high, low, live, after: R.puffs, clearHigh: +clearHigh.toFixed(2), clearLow: +clearLow.toFixed(2) }; });
check('a fish held down against the bed raises silt behind it, one swimming free raises none, and the silt settles', s.high === 0 && s.low >= 8 && s.live >= 4 && s.after === 0 && s.clearHigh > 3 && s.clearLow < 1.8, JSON.stringify(s));
s = await ev(() => { const g = window.__game, T = window.T, R = g.world.react, f = R.pilots[0], h = (x, z) => g.world.height(x, z), near = () => Math.min(...g.rig.joints.map((j) => j.distanceTo(f.p)));
  const yaw = Math.atan2(g.world.goal.x - f.hx, g.world.goal.z - f.hz), dx = Math.sin(yaw), dz = Math.cos(yaw), food = g.world.schools.reduce((a, sc) => a + sc.left, 0), segs = g.run.segs;
  T.put(f.hx - dx * 16, f.hy, f.hz - dz * 16, yaw); T.idle(0.5); const waiting = !f.riding && Math.hypot(f.p.x - f.hx, f.p.z - f.hz) < 2.5;
  g.sim(8, { ...T.none(), dir: { x: dx, y: 0, z: dz } }); const riding = f.riding, beside = near(), moved = Math.hypot(f.p.x - f.hx, f.p.z - f.hz);
  T.idle(3); const resting = f.riding && near() < 2.2; // the fish stops: it stays by
  f.p.x -= dx * 30; f.p.z -= dz * 30; g.sim(4, { ...T.none(), dir: { x: dx, y: 0, z: dz } }); const left = !f.riding; const at = f.p.clone(); T.idle(2); const stays = f.p.distanceTo(at) < 3.5;
  return { n: R.pilots.length, waiting, riding, beside: +beside.toFixed(2), moved: +moved.toFixed(1), resting, left, stays, food: g.world.schools.reduce((a, sc) => a + sc.left, 0) === food, segs: g.run.segs === segs }; });
check('a pilot fish waits on the way, falls in beside the body as it passes and stays by it; left far behind, it waits where it is', s.n === 5 && s.waiting && s.riding && s.beside < 1.6 && s.moved > 4 && s.resting && s.left && s.stays && s.food && s.segs, JSON.stringify(s));
s = await ev(() => { const g = window.__game, T = window.T, R = g.world.react, h = (x, z) => g.world.height(x, z), r = g.world.rift;
  const cs = R.chimes.reduce((a, c) => (Math.hypot(c.x - g.rig.pos.x, c.z - g.rig.pos.z) < Math.hypot(a.x - g.rig.pos.x, a.z - g.rig.pos.z) ? c : a)), long = cs.bars.reduce((a, b) => (b.len > a.len ? b : a));
  const yaw = 2 * Math.atan2(cs.q.y, cs.q.w) + Math.PI / 2, dx = Math.sin(yaw), dz = Math.cos(yaw), y = long.y - long.len * 0.8;
  T.put(long.x - dx * 7, y, long.z - dz * 7, yaw); T.idle(0.3); const before = R.rings, x0 = g.rig.pos.x, z0 = g.rig.pos.z;
  let swung = 0; for (let i = 0; i < 40; i++) { g.sim(0.1, { ...T.none(), dir: { x: dx, y: 0, z: dz } }); swung = Math.max(swung, Math.hypot(long.ox, long.oz)); }
  const rang = R.rings - before, went = Math.hypot(g.rig.pos.x - x0, g.rig.pos.z - z0); T.put(long.x + 40, y, long.z + 40); T.idle(9);
  const rest = Math.max(...cs.bars.map((b) => Math.hypot(b.ox, b.oz)));
  g.music.unlock(); const here = g.music.chimeNotes(), a = g.music.chime(0, 1), b = g.music.chime(1, 1); g.enterFloor(2, false); const below = g.music.chimeNotes(); g.enterFloor(0, false);
  return { sets: R.chimes.length, bars: R.chimes.reduce((n, c) => n + c.bars.length, 0), atRift: R.chimes.filter((c) => Math.hypot(c.x - r.x, c.z - r.z) < 16).length, rang, swung: +swung.toFixed(2), went: +went.toFixed(1), rest: +rest.toFixed(3), queue: R.rang.length,
    started: !!g.music.describe(), a, b, inChord: here.includes(a) && here.includes(b), moves: here.join() !== below.join(), notes: here.length }; });
check('a chime brushed swings aside and rings once, stops nobody, and hangs still again; its note is from the chord the band is on, and changes with the key',
  s.sets >= 4 && s.bars >= 12 && s.atRift === 0 && s.rang >= 1 && s.rang <= 3 && s.swung > 0.15 && s.went > 9 && s.rest < 0.02 && s.queue === 0 && s.started && s.a !== s.b && s.inChord && s.moves, JSON.stringify(s));
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await snap(page, 'g-drawer');
// the shadow pass draws only what stands in the sun's box: nothing that casts a shadow anyone could see may be left out of it
s = await ev(async () => { const g = window.__game, gl = g.renderer.getContext(), out = { apart: 0, restless: 0, views: 0, shaded: 0, cast: 0, where: [] };
  window.__hold = true; const sun = g.scene.children.find((o) => o.isDirectionalLight), pitch = g.cam.pitch, zoom = g.cam.zoom; // it is aimed at the point the picture is centred on
  const shot = () => { g.renderer.render(g.scene, g.camera); const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px); return px; };
  const apart = (a, b) => { const w = gl.drawingBufferWidth; let n = 0, x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1; for (let i = 0; i < a.length; i += 4) if (Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])) > 2) { n++; const x = (i / 4) % w, y = Math.floor(i / 4 / w); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return { n, box: `x ${x0}..${x1}, y ${y0}..${y1}` }; };
  for (const band of [0, 1, 2]) { g.startRun(4242); if (band) g.enterFloor(band, false); g.run.safe = 1e9;
    for (const [secs, yaw, tilt, far] of [[0.6, 0, 0.56, 1], [3, 2.2, 0.3, 0.9], [3, -1.3, 0.9, 2]]) { g.cam.yaw += yaw; g.cam.pitch = tilt; g.cam.zoom = far; g.sim(secs, { dir: { x: Math.sin(band + yaw), y: 0, z: Math.cos(band + yaw) }, amount: 1, vertical: 0, sprint: false }); g.snap();
      g.world.sorting(true); g.world.dress(sun.target.position); const t = g.world.tally(), a0 = shot(), a = shot();
      g.world.sorting(false); g.world.dress(sun.target.position); const u = g.world.tally(), b = shot();
      g.world.sorting(true); g.world.dress(sun.target.position);
      out.restless += apart(a0, a).n; // the same picture drawn twice: anything that differs moves by itself
      const d = apart(a, b); out.apart += d.n; if (d.n) out.where.push(`band ${band}: ${d.n} px in ${d.box}, pitch ${tilt}, zoom ${far}`);
      out.views++; out.shaded += t.shaded; out.cast += u.shaded; } }
  g.cam.pitch = pitch; g.cam.zoom = zoom;
  return out; });
check('what stands outside the sun’s box is left out of the shadow pass, and the picture is the same to the pixel: three bands, three views each, steep and flat, near and far', s.views === 9 && s.apart === 0 && s.restless === 0 && s.shaded < s.cast * 0.7, JSON.stringify(s));

// going quiet: a paused dive is drawn once and left, and drawn again when something is pressed; an end card left alone goes the same way
s = await ev(async () => { const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms)), frames = () => g.renderer.info.render.frame, key = (type) => window.dispatchEvent(new KeyboardEvent(type, { key: 'F13', code: 'F13' }));
  g.startRun(4242); g.sim(0.5); g.run.safe = 1e9; window.__hold = false;
  g.setPaused(true); await wait(1500); // what pausing itself stirred up has been drawn
  let ticks = 0, on = true; const count = () => { ticks++; if (on) requestAnimationFrame(count); }; requestAnimationFrame(count);
  const a = frames(); await wait(3200); on = false; const idle = frames() - a;
  key('keydown'); key('keyup'); await wait(900); const woke = frames() - a - idle;
  const b = frames(); g.setPaused(false); await wait(2500); const live = frames() - b;
  const away = g.QUIET.away; g.QUIET.away = 0.6; g.die(); for (let i = 0; i < 120 && g.run.stateT < 0.8; i++) await wait(250); await wait(1200); // an end card nobody has touched for a while (drawn here, the dive's clock runs slow)
  const c = frames(); await wait(3200); const left = frames() - c;
  window.dispatchEvent(new PointerEvent('pointerdown')); const d = frames(); await wait(2500); const back = frames() - d;
  g.QUIET.away = away; window.__hold = true;
  return { idle, ticks, woke, live, left, back, state: g.run.state }; });
check('a paused dive is not drawn again and again (about one frame a second, while the page goes on running), a key pressed has it drawn, and resumed it runs; an end card left alone goes quiet too, until it is touched', s.idle <= 5 && s.ticks >= 2 && s.woke >= 1 && s.live >= 3 && s.state === 'dead' && s.left <= 5 && s.back >= 2, JSON.stringify(s));

// a lighter picture is there to be asked for, and is not given unasked; and a dive left alone does not sit still to be eaten
s = await ev(async () => { const g = window.__game, box = document.getElementById('f-light'), wait = (ms) => new Promise((r) => setTimeout(r, ms)), kept = () => JSON.parse(localStorage.getItem('oarfish.feel') || '{}').light;
  const first = { box: box.checked, on: g.light.on, map: g.sun.shadow.mapSize.x };
  box.click(); const on = { on: g.light.on, map: g.sun.shadow.mapSize.x, ratio: g.renderer.getPixelRatio(), kept: kept() };
  box.click(); const off = { on: g.light.on, map: g.sun.shadow.mapSize.x, kept: kept() };
  g.startRun(4242); g.sim(0.5); g.run.safe = 0; for (const b of g.foes.biters) { b.alive = false; b.mesh.visible = false; }
  window.__hold = false; const away = g.QUIET.away; g.QUIET.away = 0.5; g.adrift.allow = true; // (a page a test is driving is never left to itself, unless the test asks)
  for (let i = 0; i < 40 && !g.adrift.on; i++) await wait(100);
  const began = g.adrift.on, p0 = g.rig.pos.clone(), segs = g.run.segs; let turned = 0, last = g.rig.yaw, far = 0;
  for (let i = 0; i < 90; i++) { g.sim(0.1); const d = Math.atan2(Math.sin(g.rig.yaw - last), Math.cos(g.rig.yaw - last)); turned += Math.abs(d); last = g.rig.yaw; far = Math.max(far, Math.hypot(g.rig.pos.x - p0.x, g.rig.pos.z - p0.z)); }
  const bitten = g.bite(2, g.rig.spine.length, g.rig.pos, 'biter'), blinking = g.run.safe > 0; // protected, but not by the kind of protection that shows
  g.QUIET.away = away; window.dispatchEvent(new PointerEvent('pointerdown')); for (let i = 0; i < 40 && g.adrift.on; i++) await wait(100); const back = g.adrift.on;
  g.adrift.allow = false; window.__hold = true;
  return { first, on, off, began, turned: +turned.toFixed(1), far: +far.toFixed(1), bitten, blinking, lost: segs - g.run.segs, back, state: g.run.state }; });
check('the lighter picture is off until it is asked for, and is kept when it is (one pixel to a point, a shadow map of half the size); a dive nobody touches has the fish swim figures about where it was left, bitten by nothing and not blinking, until it is touched',
  s.first.box === false && s.first.on === false && s.first.map === 2048 && s.on.on === true && s.on.map === 1024 && s.on.ratio === 1 && s.on.kept === true && s.off.on === false && s.off.map === 2048 && s.off.kept === false
  && s.began && s.turned > 6 && s.far < 16 && s.bitten === false && s.blinking === false && s.lost === 0 && s.back === false && s.state === 'play', JSON.stringify(s));

await page.close();

if (shots) { const m = await open({ width: 390, height: 780 }, true); await m.evaluate(() => window.__game.sim(1.5, { dir: { x: 0.6, y: 0, z: -0.8 }, amount: 1, vertical: 0, sprint: false, gentle: false, coil: 0, tight: false, bite: false })); await snap(m, 'g-mobile'); console.log('mobile overflow', await m.evaluate(() => document.documentElement.scrollWidth > innerWidth)); await m.close(); }
await browser.close(); server.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
