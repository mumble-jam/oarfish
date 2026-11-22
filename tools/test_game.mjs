// Scripted checks of every mechanic in headless Chrome, plus screenshots.
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
    swarm(tier) { g.sim(0.05, none()); return g.world.schools.find((s) => s.tier === tier && s.left > 0); },
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
  const free = (x, z) => { const y = g.world.height(x, z) + 3.5; for (let k = 0; k < 8; k++) { const p = g.rig.pos.clone().set(x + Math.sin(k * 0.785) * 4.5, y, z + Math.cos(k * 0.785) * 4.5), q = p.clone(); g.world.pushOut(q, 1.4); if (q.distanceTo(p) > 1e-6) return false; } return g.world.rift.in(x, z) < -12; };
  let sx = 30, sz = 30; find: for (let d = 0; d < 44; d += 4) for (let k = 0; k < 8; k++) { const x = 30 + Math.sin(k * 0.785) * d, z = 30 + Math.cos(k * 0.785) * d; if (free(x, z)) { sx = x; sz = z; break find; } }
  const y = g.world.height(sx, sz) + 3.5; T.put(sx, y, sz, 0); T.idle(0.3);
  const r = (g.rig.length + 0.8) / (Math.PI * 2); const cx = sx + r, cz = sz; b.pos.set(cx, y, cz); b.vel.set(0, 0, 0); b.cool = 99; b.state = 'chew'; b.t = 99; b.wander.copy(b.pos); const caught = g.run.caught; T.coil(5); T.idle(1);
  return { alive: b.alive, gained: g.run.caught - caught, at: [Math.round(sx), Math.round(sz)], floor: g.run.floor }; });
check('a biter inside a closed loop is caught', s.alive === false && s.gained >= 3, JSON.stringify(s));

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
  const m = { stamina: g.mods.stamina, food: g.mods.foodPerSeg }; const before = g.run.segs; g.addFood(4); const grew = g.run.segs - before;
  g.run.safe = 0; const n0 = g.run.shells.length; g.bite(3, g.rig.spine.length, null, 'angler'); // three tail segments go, and whatever rode on them
  return { lay, took, more, segsOf, m, grew, segs: g.run.segs, lost: n0 - g.run.shells.length, left: g.run.shells.map((x) => x.seg).sort((a, b) => a - b).join() }; });
check('three shells lie about a band; the head takes one onto the rearmost free third segment, and it shows on the body and the scale bar', s.lay.n === 3 && s.lay.kinds === 3 && s.lay.firstNear < 19 && s.took.worn.length === 1 && /@9$/.test(s.took.worn[0]) && s.took.taken && s.took.dots === 1 && s.took.onBone && s.took.list > 30, JSON.stringify({ lay: s.lay, took: s.took }));
await ev(() => { const g = window.__game, T = window.T; g.startRun(21); T.idle(0.3); g.giveShell('spire'); g.giveShell('fan'); g.giveShell('spine'); const it = g.field.items[1]; T.put(it.x - 2.2, it.y + 0.5, it.z - 1.2, 1.1); g.cam.zoom = 0.55; g.cam.pitch = 0.4; g.snap(); T.idle(0.2); }); await snap(page, 'g-shells'); await ev(() => { window.__game.cam.zoom = 1; window.__game.cam.pitch = 0.56; });
check('every third segment carries one shell, worn shells change the rules, and a bite takes the shell with the segment', JSON.stringify(s.more) === '[true,true,false]' && s.segsOf === '3,6,9' && s.m.stamina === 1.5 && s.m.food === 4 && s.grew === 1 && s.segs === 8 && s.lost === 1 && s.left === '3,6', JSON.stringify(s));
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

// 8e. the four guards: each attacks in its own way, and each can be beaten by rams alone
for (const f of [0, 1, 2, 3]) {
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
    const hp = { keeper: 3, shearer: 3, lamplighter: 3, warden: 4 }[kind];
    g.sim(0.5, T.none()); const y = g.world.height(w.x, w.z) + 1; T.put(w.x - 1, y, w.z, 0); g.run.safe = 0; T.idle(0.2);
    return { kind, attack, rams, hp, done: G.done, dropped: g.field.items.length - shells0, state: g.run.state }; }, f);
  check(`band ${f + 1}: the ${s.kind} bites a fish left in its reach, falls to ${s.hp} rams, leaves a shell, and the rift opens`, s.attack.bites >= 1 && s.attack.lost >= 2 && s.done && s.rams === s.hp && s.dropped === 1 && s.state === 'descend', JSON.stringify(s));
}
s = await ev(() => { const g = window.__game, T = window.T; g.startRun(31); g.run.segs = 16; g.buildFish(16); T.idle(0.5); const G = g.guard; G.state.cool = 99;
  T.put(G.pos.x + 2.8, G.pos.y, G.pos.z + 0.9, 1.1); T.idle(0.3); let t = 0, prog = 0; while (!G.done && t < 9) { G.state.cool = 99; g.sim(0.1, { ...T.none(), coil: 1 }); t += 0.1; prog = Math.max(prog, G.ring ? G.ring.progress : 0); }
  return { done: G.done, t: +t.toFixed(1), prog: +prog.toFixed(2) }; });
check('a long enough body can wrap the Keeper instead', s.done, JSON.stringify(s));
await ev(() => { const g = window.__game, T = window.T; g.startRun(31); g.enterFloor(3, false); T.idle(0.5); const w = g.world.goal; T.put(w.x + 13, w.y + 3.2, w.z + 3, -1.4); g.cam.pitch = 0.42; g.cam.zoom = 0.9; g.snap(); T.idle(0.4); }); await snap(page, 'g-well');

// 8f. two more kinds of trouble: spined drifters and leeches
s = await ev(() => { const g = window.__game, T = window.T; g.startRun(41); g.run.segs = 14; g.buildFish(14); g.enterFloor(2, false); for (const it of g.field.items) g.field.take(it); T.idle(1.6);
  for (const b of g.foes.biters) { b.alive = false; b.mesh.visible = false; } for (const a of g.foes.anglers) { a.alive = false; a.group.visible = false; } for (const h of g.foes.hooks) h.pos.y += 500; g.guard.debug.fall();
  const counts = { mines: g.foes.mines.length, leeches: g.foes.leeches.length }; for (const l of g.foes.leeches) l.cool = 99;
  T.put(72, g.world.height(72, 50) + 3, 50, 0); T.idle(0.3); g.run.safe = 0; const m = g.foes.mines[0], m2 = g.foes.mines[1], J = g.rig.joints;
  m.home.copy(J[6]); const segs = g.run.segs; T.idle(0.2); const brushed = { lost: segs - g.run.segs, alive: m.alive };
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
const cast = await ev(() => { const g = window.__game, m = g.music, quiet = { speed: 0, coil: 0, danger: 0, low: false, alive: true };
  const feed = (c, sec) => { for (let t = 0; t < sec; t += 0.1) m.update(0.1, { ...quiet, cast: c }); return m.state.sitting.join(); };
  const none = feed({}, 12), one = feed({ biter: 0.9 }, 4), many = feed({ biter: 0.9, angler: 0.8, hook: 0.7, drifter: 0.6, warden: 0.3 }, 6), names = (m.describe() || { sitting: [] }).sitting.join();
  const heard = Object.keys(g.castNear()).length >= 0 && ['biter', 'angler', 'hook', 'drifter', 'leech', 'keeper', 'shearer', 'lamplighter', 'warden', 'sum'].every((id) => m.audition(id) === true);
  const gone = feed({}, 14); const G = g.guard, here = g.rig.pos.clone(); let byKeeper = 1; if (G && !G.done) { g.rig.pos.copy(G.pos); byKeeper = g.castNear()[G.kind]; g.rig.pos.copy(here); } // a keeper, where this band still has one
  return { none, one, many, names, heard, gone, kind: G ? G.kind : null, byKeeper }; });
check('every hunter and keeper has an instrument: it sits in while the creature is near, three at most with the keeper first, and each can be heard alone', cast.none === '' && cast.one === 'biter' && cast.many === 'warden,biter,angler' && /bowed cello/.test(cast.names) && cast.heard && cast.gone === '' && cast.byKeeper > 0.9, JSON.stringify(cast));
check('the Music drawer opens and its sliders reach the band', s.open && Math.abs(s.menace - 0.9) < 0.01, JSON.stringify(s));
s = await ev(() => { const g = window.__game; const code = g.presetCode(); const r1 = g.applyCode('hey try this one oarfish-music:1:dream=90,energy=20,menace=10,react=40,swing=75,band=80 :)'); const p1 = { ...g.music.params };
  const r2 = g.applyCode('oarfish-music:1:dream=30,menace=95,zone=3'); const here = { ...g.music.params }; g.enterFloor(2, false); const there = { ...g.music.params }; const code3 = g.presetCode(); const r3 = g.applyCode('nonsense'); g.enterFloor(0, false);
  return { code, r1, dream1: p1.dream, r2, dreamHere: here.dream, dreamThere: there.dream, menaceThere: there.menace, code3, r3 }; });
check('preset codes copy, paste for all depths, and paste for one depth', /^oarfish-music:1:dream=\d+/.test(s.code) && s.dream1 === 0.9 && s.dreamHere === 0.9 && s.dreamThere === 0.3 && s.menaceThere === 0.95 && /zone=3$/.test(s.code3) && /not a preset/.test(s.r3), JSON.stringify(s));
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await snap(page, 'g-drawer');
await page.close();

if (shots) { const m = await open({ width: 390, height: 780 }, true); await m.evaluate(() => window.__game.sim(1.5, { dir: { x: 0.6, y: 0, z: -0.8 }, amount: 1, vertical: 0, sprint: false, gentle: false, coil: 0, tight: false, bite: false })); await snap(m, 'g-mobile'); console.log('mobile overflow', await m.evaluate(() => document.documentElement.scrollWidth > innerWidth)); await m.close(); }
await browser.close(); server.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
