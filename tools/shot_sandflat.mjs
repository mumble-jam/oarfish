// Photographs the sand flat's life (sandflat.js) from the dive's own camera, with the help put away: the garden eels' meadow before a crossing, during a
// careless one and during a careful one; the hermit crabs' market before, during and after a trade; a burrow with the shrimp at work and the fragment
// it pushed up; the puffer's circle at three stages across dives, with and without fragments, and finished.
//   node tools/shot_sandflat.mjs [prefix] [seed] [name…]     writes out/shots/<prefix>-<camera>-<name>.png and prints each path, for each camera:
//   'look' (the adventure camera: lower, tilted, sees further) first, then 'plate' (the high, steep one). CAMS=look or CAMS=plate for one of them
//   python3 tools/sheet.py <out.jpg> 4 600 $(cat out/shots/<prefix>-list.txt)     makes the contact sheet
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { chromium } from 'playwright';
const ROOT = process.env.GAME_ROOT || path.resolve(import.meta.dirname, '..');
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
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const prefix = process.argv[2] || 'sandflat', seed = +(process.argv[3] || 4242), only = process.argv.slice(4);
const out = (n) => path.resolve(import.meta.dirname, `../out/shots/${prefix}-${n}.png`);
fs.mkdirSync(path.resolve(import.meta.dirname, '../out/shots'), { recursive: true });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 750 } })).newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.addInitScript(() => { window.__noNursery = true; });
await page.goto(`http://localhost:${server.address().port}/`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
await page.addStyleTag({ content: '#stage > :not(canvas):not(#library) { display: none !important; }' });
const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
await page.evaluate((seed) => { window.__hold = true; const g = window.__game;
  window.S = { seed, none: { dir: null, amount: 0, vertical: 0, sprint: false, gentle: false, coil: 0, tight: false, bite: false },
    // a new dive with the nest holding `circle` for the sand flat (or nothing); shells: kinds put on the body
    mode: 'point', fresh({ circle = null, shells = [], segs = 16 } = {}) { const n = g.nest; n.sandflat = circle ? { eels: null, circle } : null; localStorage.setItem('oarfish.nest', JSON.stringify(n)); g.setMode(this.mode); g.startRun(seed);
      g.run.segs = segs; g.buildFish(segs); g.dropShells(); for (const t of shells) g.giveShell(t); g.run.safe = 1e9; g.sim(0.2, this.none); return g.world.quiet.sandflat; },
    // the head `back` metres from (x, z), facing it from the bearing `from`, `lift` over the bed
    at(x, z, from, back, lift = 2) { const px = x + Math.sin(from) * back, pz = z + Math.cos(from) * back; g.rig.reset(g.rig.pos.clone().set(px, g.world.height(px, pz) + lift, pz), from + Math.PI); g.cam.yaw = from; g.cam.ease = null; this.tilt(); g.snap(); },
    // the head `back` metres off (x, z) on the bearing `from`, side on to it (heading along the circle round it), the camera behind: it is beside the fish
    beside(x, z, from, back, lift = 2) { const px = x + Math.sin(from) * back, pz = z + Math.cos(from) * back, yaw = from + Math.PI / 2; g.rig.reset(g.rig.pos.clone().set(px, g.world.height(px, pz) + lift, pz), yaw); g.cam.yaw = yaw + Math.PI; g.cam.ease = null; this.tilt(); g.snap(); },
    tilt() { g.cam.pitch = this.mode === 'look' ? 0.34 : 0.56; }, // each camera at its own resting tilt (LOOK_LEVEL, PLATE_LEVEL in main.js)
    swim(yaw, s, amount = 1, extra = {}) { g.sim(s, { ...this.none, dir: { x: Math.sin(yaw), y: 0, z: Math.cos(yaw) }, amount, ...extra }); },
    idle(s) { g.sim(s, this.none); }, table() { const sd = this.sand, f = sd.debug.foot, t = sd.debug.table; return { f, t, a: Math.atan2(f.x - t.x, f.z - t.z) }; }, get sand() { return window.__sand; } }; }, seed);
const shots = [];
let cam = 'look';
const shot = async (base, what, setup, arg) => { if (only.length && !only.includes(base)) return; const name = `${cam}-${base}`; await page.evaluate((m) => { S.mode = m; }, cam === 'plate' ? 'point' : 'look'); const info = await page.evaluate(setup, arg); await page.evaluate(() => { const g = window.__game; g.run.safe = 0; g.sim(1 / 60, S.none); g.run.safe = 1e9; }); await frame(); await page.screenshot({ path: out(name) }); shots.push(out(name)); console.log(`${out(name)}  ${what}${info ? '  ' + JSON.stringify(info) : ''}`); };

for (cam of (process.env.CAMS || 'look,plate').split(',')) {
// ---- the meadow
await shot('eels-before', 'the garden eels\' meadow, the fish at its rim', () => { const q = S.fresh(), m = q.meadow, a = Math.atan2(-q.fx, -q.fz); S.beside(m.x, m.z, a, m.r + 1, 2.2); S.idle(3); return null; });
await shot('eels-careless', 'a careless crossing: at a full swim, the eels sink ahead of the body and round it', () => { const q = S.fresh(), m = q.meadow, a = Math.atan2(q.fx, q.fz); S.at(m.x, m.z, a, m.r + 6, 1.6); S.swim(a + Math.PI, 1, 1); S.swim(a + Math.PI, (m.r + 6) / 3.3 - 0.2, 1); const sd = S.sand; return { near: +sd.state.eels.near.toFixed(2), down: sd.debug.allEels.filter((e) => e.want <= 0).length }; });
await shot('eels-careful', 'a careful crossing: slow and smooth, the eels nearest only sink a little and none goes down', () => { const q = S.fresh(), m = q.meadow, a = Math.atan2(q.fx, q.fz); S.at(m.x, m.z, a, m.r + 3, 1.6); S.swim(a + Math.PI, (m.r + 3) / 1.45, 0); const sd = S.sand; return { near: +sd.state.eels.near.toFixed(2), down: sd.debug.allEels.filter((e) => e.want <= 0).length }; });
// ---- the market
await shot('market-before', 'the hermit crabs\' market: four of rising size at the foot of a table, each in one of the game\'s shells; the smallest\'s glows faintly (what a trade would give)', () => { const q = S.fresh({ shells: ['horn', 'fan'] }); S.idle(0.2); const { f, a } = S.table(); S.beside(f.x, f.z, a, 3.2, 2.2); S.idle(2.5); return S.sand.debug.crabs.map((c) => c.a.rig.worn.kind); });
await shot('market-during', 'a trade under way: a shell set down from the body, the line moving up one house', () => { const q = S.fresh({ shells: ['horn', 'fan'] }); S.idle(0.2); const { f, t, a } = S.table(), g = window.__game;
  // lie the body across the table, still: the shell on its rearmost carrying segment over the table
  const back = g.run.shells[0].seg * 0.31; const yaw = a + Math.PI / 2; g.rig.reset(g.rig.pos.clone().set(t.x + Math.sin(yaw) * back, g.world.height(t.x, t.z) + 1.6, t.z + Math.cos(yaw) * back), yaw); S.idle(0.1);
  S.idle(3); g.cam.yaw = a + 0.9; S.tilt(); g.snap(); S.idle(3.5); return { busy: !!S.sand.state.market.busy, shells: g.run.shells.map((s) => s.type), crabs: S.sand.debug.crabs.map((c) => c.phase) }; });
await shot('market-after', 'after the trade: each crab in the next one\'s house, and the smallest crab\'s old shell risen from the sand, the player\'s to take', () => { const g = window.__game, sd = S.sand, f = sd.debug.foot; S.idle(9); S.beside(f.x, f.z, Math.atan2(f.x - sd.debug.table.x, f.z - sd.debug.table.z), 3.2, 2.2); S.idle(0.5); return { crabs: sd.debug.crabs.map((c) => c.a.rig.worn.kind), last: sd.state.market.last }; });
// ---- a burrow
await shot('burrow-work', 'a burrow, the fish holding still near by: the shrimp bulldozing sand out onto the heap', () => { const q = S.fresh(), b = q.burrows[0]; S.beside(b.x, b.z, Math.atan2(q.x - b.x, q.z - b.z), 3.2, 2); S.idle(9); const sd = S.sand.debug.burrows[0]; return { mood: sd.mood, dig: +sd.dig.toFixed(1) }; });
await shot('burrow-flick', 'the goby\'s warning: a body coming near at a swim, the flick (a bright yellow wink)', () => { const q = S.fresh(), b = q.burrows[0], a = Math.atan2(q.x - b.x, q.z - b.z); S.beside(b.x, b.z, a, 7, 2); S.idle(4); S.swim(a, 0.1, 0.3); const g = window.__game; g.rig.reset(g.rig.pos.clone().set(b.x + Math.sin(a) * 6, g.rig.pos.y, b.z + Math.cos(a) * 6), a + Math.PI); g.cam.yaw = a; S.tilt(); g.snap(); S.swim(a + Math.PI, 0.9, 0.4); return { mood: S.sand.debug.burrows[0].mood }; });
await shot('burrow-fragment', 'what it pushed up: a shell fragment on the heap, for the head to take', () => { const q = S.fresh(), b = q.burrows[0]; S.beside(b.x, b.z, Math.atan2(q.x - b.x, q.z - b.z), 3.2, 2); S.idle(16); return { frag: !!S.sand.debug.burrows[0].frag }; });
await shot('burrow-carry', 'a fragment carried in the mouth, over to the circle', () => { const q = S.fresh(), sd = S.sand; sd.debug.fragment(); const c = sd.debug.circle.object.position; S.at(c.x, c.z, Math.atan2(q.x - c.x, q.z - c.z) + 0.6, 6, 2); S.idle(0.5); return null; });
// ---- the circle across dives
const circleShot = ([p, frags]) => { S.fresh({ circle: { p: p - 1, site: 0, done: 0, frags, left: -1, paid: false } }); const sd = S.sand, c = sd.debug.circle.object.position, q = sd.plan; S.beside(c.x, c.z, Math.atan2(q.x - c.x, q.z - c.z), 3.4, 2.2); S.idle(4); return { p: sd.debug.C0.p, stage: +sd.debug.stageOf(sd.debug.C0.p).toFixed(2), frags: sd.debug.C0.frags }; };
await shot('circle-1', 'the circle on its first dive: the first ring, the puffer ploughing', circleShot, [0, 0]);
await shot('circle-2', 'the next dive: valleys ploughed', circleShot, [1, 0]);
await shot('circle-3', 'the dive after: ridges sharpened', circleShot, [2, 0]);
await shot('circle-3f', 'the same dive with five fragments brought from the burrows set on its ridges', circleShot, [2, 5]);
await shot('circle-done', 'finished: shells on the peaks, the calm middle', circleShot, [3, 5]);
await shot('circle-left', 'the dive after that: the old one left flattening, a new one begun on fresh sand beside it', () => { S.fresh({ circle: { p: 3, site: 0, done: 1, frags: 5, left: -1, paid: true } }); const sd = S.sand, c = sd.debug.circle.object.position, o = sd.debug.old.object.position, q = sd.plan, mx = (c.x + o.x) / 2, mz = (c.z + o.z) / 2; S.at(mx, mz, Math.atan2(q.x - mx, q.z - mz), 6, 2.6); S.idle(3); return { site: sd.debug.C0.site, left: sd.debug.C0.left }; });
await shot('nest', 'the nest: three eels up (a best crossing of three) and a ring of fragments for one circle finished, ahead and to the left of the start', () => { const g = window.__game; g.nest.sandflat = { eels: { grade: 3, ratio: 1 }, circle: { p: 0, site: 1, done: 1, frags: 0, left: 0, paid: false } }; localStorage.setItem('oarfish.nest', JSON.stringify(g.nest)); g.setMode(S.mode); g.startRun(S.seed); g.run.safe = 1e9; S.idle(0.5); const sp = g.world.spawn; g.cam.yaw = 2.5 + Math.PI + 0.5; g.cam.ease = null; S.tilt(); g.snap(); return window.__sand.debug.mark?.userData.sandflat; });
}
await browser.close(); server.close();
fs.writeFileSync(path.resolve(import.meta.dirname, `../out/shots/${prefix}-list.txt`), shots.join('\n'));
