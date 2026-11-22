// Photographs the light under the rift's cloud at its brightest and its dimmest, from near and far.
//   node tools/shot_light.mjs [prefix] [band…]     writes out/shots/<prefix>-<band>-<view>-<hi|lo>.png
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
const args = process.argv.slice(2), prefix = args.find((a) => !/^\d$/.test(a)) || 'light', bands = args.filter((a) => /^\d$/.test(a)).map(Number);
const out = (n) => path.resolve(import.meta.dirname, `../out/shots/${prefix}-${n}.png`);
fs.mkdirSync(path.resolve(import.meta.dirname, '../out/shots'), { recursive: true });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 820 } })).newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.addInitScript(() => { window.__noNursery = true; });
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
await page.evaluate(() => { window.__hold = true; window.__game.startRun(4242); });
const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
// stand the fish u metres along the rift and a metres across it, up metres over the shelf, looking across the rift; then let time run to the light's peak or trough
const stand = (band, { u = 0, a = -20, up = 3, mode = 'look', pitch = null, zoom = 1 }, hi) => page.evaluate(([band, u, a, up, mode, pitch, zoom, hi]) => {
  const g = window.__game, none = { dir: null, amount: 1, vertical: 0, sprint: false };
  if (g.run.floor !== band || !window.__stood) { window.__stood = true; g.run.segs = 12 + band * 2; g.buildFish(g.run.segs); g.enterFloor(band, false); g.run.safe = 1e9; g.sim(3.6, none); }
  for (const b of g.foes.biters) { b.alive = false; b.mesh.visible = false; }
  g.run.safe = 1e9; g.setMode(mode);
  const r = g.world.rift, yaw = Math.atan2(r.nx, r.nz), k = a + r.mid(u);
  const put = () => { g.rig.reset(g.rig.pos.clone().set(r.x + r.tx * u + r.nx * k, r.y + up, r.z + r.tz * u + r.nz * k), yaw); g.cam.ease = null; g.cam.yaw = yaw + Math.PI; g.cam.zoom = zoom; g.cam.pitch = pitch !== null ? pitch : mode === 'look' ? 0.34 : 0.56; g.snap(); };
  put(); g.sim(0.4, none);
  for (let i = 0; i < 80; i++) { const v = r.light(); if (hi ? v > 0.97 : v < 0.33) break; g.sim(0.05, none); }
  put(); g.sim(0.02, none); put();
  return +r.light().toFixed(2);
}, [band, u, a, up, mode, pitch, zoom, hi]);
for (const band of bands.length ? bands : [0, 2]) {
  const views = [['far', { a: -44, up: 3 }], ['plate', { a: -30, up: 3.2, mode: 'point' }], ['edge', { a: -17, up: 2.6 }], ['over', { a: -6, up: 4.5, pitch: 0.75 }], ['along', { u: 22, a: -9, up: 2.2 }]];
  for (const [name, v] of views) for (const hi of [true, false]) { const at = await stand(band, v, hi); await frame(); await page.screenshot({ path: out(`${band}-${name}-${hi ? 'hi' : 'lo'}`) }); console.log(`band ${band} ${name}`, at); }
}
await browser.close(); server.close();
