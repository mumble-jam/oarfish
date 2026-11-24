// Photographs the bloom water (bloom.js) from the game's own camera, with the help put away: as it is first met, coming from the start; in among the
// bells with the fry cornered; a nettle with its train, the fish going by on the safe side; the squid at a swarm; a bluff; an ink copy and the shoal
// scattering; and a try at settling the shoal under way. With --map, the band's plan (tools/shot_map.mjs) goes at the end of the sheet.
//   node tools/shot_bloom.mjs [prefix] [seed]     writes out/shots/<prefix>-<n>.png
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
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const prefix = process.argv[2] || 'bloom', seed = +(process.argv[3] || 4242);
const out = (n) => path.resolve(import.meta.dirname, `../out/shots/${prefix}-${n}.png`);
fs.mkdirSync(path.resolve(import.meta.dirname, '../out/shots'), { recursive: true });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 750 } })).newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.addInitScript(() => { window.__noNursery = true; });
await page.addInitScript(() => { try { const f = JSON.parse(localStorage.getItem('oarfish.feel') || '{}'); if (!f.mode) localStorage.setItem('oarfish.feel', JSON.stringify({ ...f, mode: 'point' })); } catch {} }); // made on the plate camera, the default when this was written: ask for it, unless a camera was chosen in this page
await page.goto(`http://localhost:${server.address().port}/`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
await page.addStyleTag({ content: '#stage > :not(canvas):not(#library) { display: none !important; }' });
const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const shot = async (n, what) => { await page.evaluate(() => { const g = window.__game; g.run.safe = 0; g.sim(1 / 60, S.none); g.run.safe = 1e9; }); await frame(); await page.screenshot({ path: out(n) }); console.log(`${out(n)}  ${what}`); };
// in the page: a fresh dive, and a way to put the fish down `d` metres from a point, facing it, with the camera behind it
await page.evaluate((seed) => { window.__hold = true; const g = window.__game;
  window.S = { none: { dir: null, amount: 0, vertical: 0, sprint: false, gentle: false, coil: 0, tight: false, bite: false },
    fresh() { localStorage.removeItem('oarfish.nest'); g.startRun(seed); g.run.safe = 1e9; g.sim(0.2, this.none); return g.bloom; },
    face(px, py, pz, from, d, lift = 0) { const b = g.bloom, o = b.debug.off, x = px - from.x * d, z = pz - from.z * d, yaw = Math.atan2(from.x, from.z);
      g.rig.reset(g.rig.pos.clone().set(x + o.x, py + lift, z + o.z), yaw); g.cam.yaw = yaw + Math.PI; g.snap(); },
    toward(p, k = 1) { const b = g.bloom, o = b.debug.off, dx = p.x + o.x - g.rig.pos.x, dz = p.z + o.z - g.rig.pos.z, d = Math.hypot(dx, dz) || 1; return { ...this.none, dir: { x: dx / d, y: 0, z: dz / d }, amount: k, vertical: Math.max(-1, Math.min(1, (p.y - g.rig.pos.y) * 0.8)) }; } }; }, seed);

// 0. as it is first met: coming from the start, a few metres off its edge (the plain camera sees about twenty metres ahead at the bed)
await page.evaluate(() => { const g = window.__game, b = S.fresh(), P = b.plan, s = g.world.spawn, dx = P.x - s.x, dz = P.z - s.z, d = Math.hypot(dx, dz), u = { x: dx / d, z: dz / d };
  S.face(P.x, g.world.height(P.x, P.z) + 3.5, P.z, u, P.R + 9); g.sim(1.5, { ...S.none, dir: { x: u.x, y: 0, z: u.z }, amount: 0.4 }); });
await shot(0, 'the bloom as it is first met, from the start side');
// 1. in among the bells, the fry cornered
await page.evaluate(() => { const g = window.__game, b = S.fresh(), P = b.plan, fry = g.world.schools.find((x) => x.bloom); g.sim(1, S.none);
  const o = b.debug.off, f = { x: fry.x - o.x, y: fry.y, z: fry.z - o.z }, u = { x: Math.sin(0.7), z: Math.cos(0.7) };
  S.face(f.x, f.y, f.z, u, 5); for (let i = 0; i < 18; i++) g.sim(0.1, S.toward(f, 0.4)); });
await shot(1, 'in among the bells, the fry cornered');
// 2. a nettle with its train, the fish going by on the safe side, up-current of the bell
await page.evaluate(() => { const g = window.__game, b = S.fresh(), P = b.plan, n = b.nettles[1], side = { x: P.cur.z, z: -P.cur.x };
  const at = { x: n.pos.x - P.cur.x * 1.8, y: n.pos.y - 0.3, z: n.pos.z - P.cur.z * 1.8 }; S.face(at.x, at.y, at.z, side, 5); g.run.safe = 0; g.sim(1.6, { ...S.none, dir: { x: side.x, y: 0, z: side.z }, amount: 0.5 }); g.run.safe = 1e9; });
await shot(2, 'a nettle and its train; the fish passes by the bell, up-current');
// 3. the squid at a swarm: the fry, the fish watching from out of their sight
await page.evaluate(() => { const g = window.__game, b = S.fresh(), P = b.plan, sh = b.debug.shoal, fry = g.world.schools.find((x) => x.bloom);
  const o = b.debug.off, f = { x: fry.x - o.x, y: fry.y, z: fry.z - o.z }; S.face(f.x, f.y + 1, f.z, { x: -P.cur.x, z: -P.cur.z }, 12); sh.t = 0;
  for (let t = 0; t < 30; t += 0.1) { g.sim(0.1, S.none); if (b.squid.some((q) => q.mood === 'strike')) break; } });
await shot(3, 'the squid at the fry, one striking');
// 4. a bluff: come on at the shoal at a swim, and stop when they show it
await page.evaluate(() => { const g = window.__game, b = S.fresh(), L = b.squid[0], P = b.plan, dx = L.pos.x - P.x, dz = L.pos.z - P.z, d = Math.hypot(dx, dz);
  S.face(L.pos.x, L.pos.y, L.pos.z, { x: -dx / d, z: -dz / d }, 12); g.run.safe = 0; g.run.hush = 0;
  for (let t = 0; t < 8; t += 0.1) { g.sim(0.1, S.toward(L.pos, 0.5)); if (b.squid.filter((q) => q.step === 'bluff').length >= 2) break; } g.sim(0.5, S.none); g.run.safe = 1e9; });
await shot(4, 'a bluff: big and dark, giving ground');
// 5. pressed hard: an ink copy, and the shoal scattering
await page.evaluate(() => { const g = window.__game, b = S.fresh(), L = b.squid[0], P = b.plan, dx = L.pos.x - P.x, dz = L.pos.z - P.z, d = Math.hypot(dx, dz);
  S.face(L.pos.x, L.pos.y, L.pos.z, { x: -dx / d, z: -dz / d }, 6); g.run.safe = 0; g.run.hush = 0; g.sim(0.1, S.none);
  for (let t = 0; t < 3 && !b.debug.inks.length; t += 0.05) g.sim(0.05, { ...S.toward(L.pos, 1), sprint: true, dashNow: t < 0.06 }); g.sim(0.7, S.none); g.run.safe = 1e9; });
await shot(5, 'an ink copy left behind, the shoal scattering');
// 6. a try at settling the shoal: come slowly, wait out a bluff, and hang beside them while one by one they turn to the fish
await page.evaluate(() => { const g = window.__game, b = S.fresh(), L = b.squid[0], P = b.plan, dx = L.pos.x - P.x, dz = L.pos.z - P.z, d = Math.hypot(dx, dz);
  S.face(L.pos.x, L.pos.y, L.pos.z, { x: -dx / d, z: -dz / d }, 13); g.run.safe = 0; g.run.hush = 0;
  for (let t = 0; t < 50 && !b.state.settled; t += 0.1) { const o = b.debug.off, dd = Math.hypot(L.pos.x + o.x - g.rig.pos.x, L.pos.z + o.z - g.rig.pos.z), wary = b.squid.some((q) => q.fright > 0.12);
    g.sim(0.1, !wary && dd > 2.6 ? { ...S.toward(L.pos, 0), gentle: true } : { ...S.none, vertical: Math.max(-1, Math.min(1, (L.pos.y - g.rig.pos.y) * 0.8)) }); if (b.debug.tryNow.hold > 1.7) break; }
  g.run.safe = 1e9; });
await shot(6, 'settling the shoal: hanging beside them as they turn to the fish');
await browser.close(); server.close();
