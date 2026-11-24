// Photographs the bloom water's moon jellies (bloom.js, jellyCrowd in jelly.js) from the game's own camera, to see that every one is drawn the same at
// every distance: the fish coming up on one jelly from 16 m to 1 m (six frames, the camera behind the fish as it is in a dive); the whole bloom from
// the camera zoomed all the way out; the fish in the middle of the bloom with the plain camera looking down on it, near and far jellies in one frame;
// and a close-up, zoomed all the way in.
//   node tools/shot_moon.mjs [prefix] [seed]     writes out/shots/<prefix>-<n>.png
//   GAME_ROOT=<another checkout> photographs the game there (the before of a before and after)
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
const prefix = process.argv[2] || 'moon', seed = +(process.argv[3] || 4242);
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
const shot = async (n, what) => { await page.evaluate(() => { const g = window.__game; g.run.safe = 0; g.sim(1 / 60, S.none); g.run.safe = 1e9; }); /* (a fish kept safe blinks) */ await frame(); await page.screenshot({ path: out(n) }); console.log(`${out(n)}  ${what}`); };
await page.evaluate((seed) => { window.__hold = true; const g = window.__game;
  window.S = { none: { dir: null, amount: 0, vertical: 0, sprint: false, gentle: false, coil: 0, tight: false, bite: false },
    fresh() { localStorage.removeItem('oarfish.nest'); g.startRun(seed); g.run.safe = 1e9; g.sim(0.2, this.none); return g.bloom; },
    // a jelly at the edge of the bloom, off to the side of the current (the squid rest up-current and the nettles hang down-current), at a middling height
    target() { const P = g.bloom.plan; return P.bells.map((b) => { const dx = b.x - P.x, dz = b.z - P.z; return [b, Math.abs(dx * P.cur.z - dz * P.cur.x) - Math.abs(b.y - g.world.height(b.x, b.z) - 3.4) * 2]; }).sort((a, b) => b[1] - a[1])[0][0]; },
    // the fish `d` metres short of the bell, on the start side, level with it and facing it, the camera behind it, and swum gently in for a second
    // (from outside the bloom, straight out from its middle through the bell; the camera at the adventure camera's tilt, so the bell is in the frame from 16 m)
    approach(b, d, pitch = 0.34) { const P = g.bloom.plan, o = g.bloom.debug.off, dx = b.x - P.x, dz = b.z - P.z, L = Math.hypot(dx, dz), u = { x: dx / L, z: dz / L }, yaw = Math.atan2(-u.x, -u.z);
      g.cam.zoom = 1; g.cam.pitch = pitch; g.rig.reset(g.rig.pos.clone().set(b.x + u.x * (d + 0.6) + o.x, b.y, b.z + u.z * (d + 0.6) + o.z), yaw); g.cam.yaw = yaw + Math.PI; g.snap();
      g.sim(0.6, { ...this.none, dir: { x: -u.x, y: 0, z: -u.z }, amount: 0.15 }); } }; }, seed);

const D = [16, 12, 8, 5, 3, 1];
for (let i = 0; i < D.length; i++) {
  await page.evaluate((d) => { S.fresh(); S.approach(S.target(), d); }, D[i]);
  await shot(i, `the fish ${D[i]} m from one jelly`);
}
// the whole bloom: the camera zoomed all the way out, from the start side
await page.evaluate(() => { const g = window.__game, b = S.fresh(), P = b.plan, o = b.debug.off, s = g.world.spawn, dx = s.x - P.x, dz = s.z - P.z, L = Math.hypot(dx, dz), u = { x: dx / L, z: dz / L }, yaw = Math.atan2(-u.x, -u.z);
  g.rig.reset(g.rig.pos.clone().set(P.x + u.x * (P.R + 4) + o.x, g.world.height(P.x, P.z) + 4, P.z + u.z * (P.R + 4) + o.z), yaw); g.cam.yaw = yaw + Math.PI; g.cam.zoom = 2.6; g.snap(); g.sim(0.5, S.none); });
await shot(6, 'the whole bloom, zoomed out');
// what George saw: the fish in the middle of the bloom, the plain camera looking down, near and far jellies in one frame
await page.evaluate(() => { const g = window.__game, b = S.fresh(), P = b.plan, o = b.debug.off;
  g.rig.reset(g.rig.pos.clone().set(P.x + o.x, g.world.height(P.x, P.z) + 3.4, P.z + o.z), 0.7); g.cam.yaw = 0.7 + Math.PI; g.cam.zoom = 1; g.cam.pitch = 0.56; g.snap(); g.sim(1.2, { ...S.none, dir: { x: Math.sin(0.7), y: 0, z: Math.cos(0.7) }, amount: 0.2 }); });
await shot(7, 'in the middle of the bloom, looking down');
// a close-up: zoomed all the way in on the fish beside a jelly
await page.evaluate(() => { const g = window.__game; S.fresh(); S.approach(S.target(), 2); g.cam.zoom = 0.4; g.cam.pitch = 0.3; g.sim(0.4, S.none); });
await shot(8, 'close-up, zoomed in');
await browser.close(); server.close();
