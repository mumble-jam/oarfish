// Photographs each band's rift from the angles a player meets it: coming up to it on the plate view, standing at its
// edge in the adventure camera, on a ledge looking along it, and after its keeper has gone.
//   node tools/shot_rift.mjs [prefix] [band…]     writes out/shots/<prefix>-<band>-<view>.png
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
const args = process.argv.slice(2), prefix = args.find((a) => !/^\d$/.test(a)) || 'rift', bands = args.filter((a) => /^\d$/.test(a)).map(Number);
const out = (n) => path.resolve(import.meta.dirname, `../out/shots/${prefix}-${n}.png`);
fs.mkdirSync(path.resolve(import.meta.dirname, '../out/shots'), { recursive: true });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 820 } })).newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource|GPU stall|GL Driver|AudioContext/.test(m.text())) console.log('[error]', m.text().slice(0, 300)); });
await page.addInitScript(() => { window.__noNursery = true; });
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
await page.evaluate(() => { window.__hold = true; window.__game.startRun(4242); });
const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
// stand the fish u metres along the rift and a metres across it (less than nothing is the near side), up metres over the shelf,
// heading along `yaw` (0: across the rift, away from the start; 1.57: along it), and look at it from behind
const stand = (band, { u = 0, a = -20, up = 3, turn = 0, mode = 'point', pitch = null, zoom = 1, fall = false }) => page.evaluate(([band, u, a, up, turn, mode, pitch, zoom, fall]) => {
  const g = window.__game;
  const none = { dir: null, amount: 1, vertical: 0, sprint: false };
  if (g.run.floor !== band || fall !== !!g.guard?.done || !window.__stood) { window.__stood = true; g.run.segs = 12 + band * 2; g.buildFish(g.run.segs); g.enterFloor(band, false); g.run.safe = 1e9; g.sim(3.6, none); if (fall) { g.guard.debug.fall(); g.sim(2, none); } } // past the band's title card
  g.run.safe = 1e9; g.setMode(mode);
  const r = g.world.rift, yaw = Math.atan2(r.nx, r.nz) + turn;
  const k = a + r.mid(u);
  g.rig.reset(g.rig.pos.clone().set(r.x + r.tx * u + r.nx * k, r.y + up, r.z + r.tz * u + r.nz * k), yaw);
  g.cam.ease = null; g.cam.yaw = yaw + Math.PI; g.cam.zoom = zoom; if (pitch !== null) g.cam.pitch = pitch; else g.cam.pitch = mode === 'look' ? 0.34 : 0.56;
  g.snap(); g.sim(0.4, none); g.cam.yaw = yaw + Math.PI; if (pitch !== null) g.cam.pitch = pitch; g.snap();
  return { q: +r.in(g.rig.pos.x, g.rig.pos.z).toFixed(1), y: +(g.rig.pos.y - r.y).toFixed(1), guard: g.guard?.kind };
}, [band, u, a, up, turn, mode, pitch, zoom, fall]);
for (const band of bands.length ? bands : [0, 1, 2, 3]) {
  const views = [
    ['a-coming', { a: -30, up: 3.2 }],
    ['b-edge', { a: -17, up: 2.6, mode: 'look' }],
    ['c-over', { a: -6, up: 4.5, mode: 'look', pitch: 0.75 }],
    ['d-ledge', { u: 9, a: -9.4, up: -1.2, turn: -1.571, mode: 'look', pitch: 0.42 }],
    ['e-above', { a: -4, up: 9, pitch: 1.2, zoom: 1.5 }],
    ['f-open', { a: -17, up: 2.6, mode: 'look', fall: true }],
  ];
  for (const [name, v] of views) { const at = await stand(band, v); await frame(); await page.screenshot({ path: out(`${band}-${name}`) }); console.log(`band ${band} ${name}`, JSON.stringify(at)); }
}
await browser.close(); server.close();
