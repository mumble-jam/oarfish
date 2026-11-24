// Photographs a cleaning station (world.js, CLEAN): as it waits, at work with the hunters going round, and from above near the end of the work.
//   node tools/shot_clean.mjs [prefix] [band]     writes out/shots/<prefix>-<n>.png
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
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const prefix = process.argv[2] || 'clean', band = +(process.argv[3] || 1);
const out = (n) => path.resolve(import.meta.dirname, `../out/shots/${prefix}-${n}.png`);
fs.mkdirSync(path.resolve(import.meta.dirname, '../out/shots'), { recursive: true });
const page = await (await browser.newContext({ viewport: { width: 900, height: 600 } })).newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.addInitScript(() => { window.__noNursery = true; });
await page.addInitScript(() => { try { const f = JSON.parse(localStorage.getItem('oarfish.feel') || '{}'); if (!f.mode) localStorage.setItem('oarfish.feel', JSON.stringify({ ...f, mode: 'point' })); } catch {} }); // made on the plate camera, the default when this was written: ask for it, unless a camera was chosen in this page
await page.goto(`http://localhost:${server.address().port}/`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
await page.addStyleTag({ content: '#stage > :not(canvas):not(#library) { display: none !important; }' });
const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const none = { dir: null, amount: 0, vertical: 0, sprint: false, gentle: false, coil: 0, tight: false, bite: false };
await page.evaluate(([band, none]) => { window.__hold = true; const g = window.__game; g.startRun(4242); if (band) g.enterFloor(band, false); g.run.safe = 1e9; g.sim(0.1, none); }, [band, none]);
// look at the station from `d` metres off, `h` above its top, at angle `a`
const snap = async (n, d = 8, h = 2.5, a = 0.8, up = 0.6) => { await page.evaluate(([d, h, a, up]) => { const g = window.__game, st = g.world.react.stations[0];
    g.run.safe = 0; g.sim(1 / 60, { dir: null, amount: 0, vertical: 0, sprint: false }); g.run.safe = 1e9; g.camera.fov = 38; g.camera.updateProjectionMatrix(); g.camera.position.set(st.cx + Math.sin(a) * d, st.top + h, st.cz + Math.cos(a) * d); g.camera.lookAt(st.cx, st.top + up, st.cz); }, [d, h, a, up]);
  await frame(); await page.screenshot({ path: out(n) }); };
const hold = (until) => page.evaluate(([until, none]) => { const g = window.__game, st = g.world.react.stations[0]; let t = 0; while (st.k < until && st.uses === g.CLEAN.uses && t < 12) { g.sim(0.1, none); t += 0.1; } }, [until, none]);
await page.evaluate((none) => { const g = window.__game, st = g.world.react.stations[0]; g.rig.reset(g.rig.pos.clone().set(st.x + 10.5, st.top + 1.5, st.z + 3), -1.57); g.sim(1.5, none); }, none); await snap(0, 7, 2.2);   // as it waits
await page.evaluate((none) => { const g = window.__game, st = g.world.react.stations[0]; // the whole body has to be inside the ring (every station, reef.js's rule): parked so that a coil to the left is centred on the station, and curled once round
  const L = g.rig.length, r = (L + 0.8) / (Math.PI * 2), v = Math.min(2.8, Math.max(1.45, 1.45 + 0.25 * (L - 3))); g.rig.reset(g.rig.pos.clone().set(st.x - r, st.top + 1.2, st.z), 0); g.snap(); g.sim((L + 0.8) / v, { ...none, coil: 1 }); g.sim(0.2, none); }, none);
await hold(0.45); await snap(1, 9, 3.2, 2.4, 0.9);          // at work
await hold(0.92); await snap(2, 16, 13, 0.8, 0);            // from above, near the end: the ring of hunters closed up
await browser.close(); server.close();
