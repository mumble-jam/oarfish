// Photographs hauling: a fragment as it lies, being gone round, carried, and going down into the rift.
//   node tools/shot_haul.mjs [prefix] [band]     writes out/shots/<prefix>-<n>.png
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
const prefix = process.argv[2] || 'haul', band = +(process.argv[3] || 0);
const out = (n) => path.resolve(import.meta.dirname, `../out/shots/${prefix}-${n}.png`);
fs.mkdirSync(path.resolve(import.meta.dirname, '../out/shots'), { recursive: true });
const page = await (await browser.newContext({ viewport: { width: 900, height: 600 } })).newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.addInitScript(() => { window.__noNursery = true; });
await page.goto(`http://localhost:${server.address().port}/`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
await page.addStyleTag({ content: '#stage > :not(canvas):not(#library) { display: none !important; }' });
const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
await page.evaluate((band) => { window.__hold = true; const g = window.__game; g.startRun(4242); if (band) g.enterFloor(band, false);
  for (const list of [g.foes.biters, g.foes.anglers || []]) for (const b of list) { b.alive = false; if (b.mesh) b.mesh.visible = false; } }, band);
const none = { dir: null, amount: 1, vertical: 0, sprint: false, gentle: false, coil: 0, tight: false, bite: false };
// look at a point from `d` metres off, `h` up, at angle `a`
const snap = async (n, at, d = 9, h = 4.5, a = 0.8) => { await page.evaluate(([at, d, h, a]) => { const g = window.__game, f = g.world.react.fragments[0], p = at === 'fish' ? g.rig.joints[Math.round(g.rig.joints.length * 0.45)] : at === 'rift' ? { x: g.world.rift.x, z: g.world.rift.z } : f, y = g.world.height(p.x, p.z);
    g.run.safe = 0; g.sim(1 / 60, { dir: null, amount: 0, vertical: 0, sprint: false }); g.camera.fov = 38; g.camera.updateProjectionMatrix(); g.camera.position.set(p.x + Math.sin(a) * d, (at === 'fish' ? g.rig.pos.y : y) + h, p.z + Math.cos(a) * d); g.camera.lookAt(p.x, (at === 'fish' ? g.rig.pos.y - 0.4 : y + 0.8), p.z); g.run.safe = 1e9; }, [at, d, h, a]);
  await frame(); await page.screenshot({ path: out(n) }); };
await page.evaluate(() => { const g = window.__game, f = g.world.react.fragments[0]; g.run.safe = 1e9; g.rig.reset(g.rig.pos.clone().set(f.x + 20, f.y + 3, f.z + 20), 0); g.sim(0.2, { dir: null, amount: 0, vertical: 0, sprint: false }); }); await snap(0, "frag", 6, 2.6);
await page.evaluate((none) => { const g = window.__game, f = g.world.react.fragments[0]; g.rig.reset(g.rig.pos.clone().set(f.x + 2.6, g.world.height(f.x, f.z) + 1.6, f.z + 0.9), 1.1); g.sim(0.3, none); let t = 0; while (!g.run.haul && t < 14) { g.sim(0.1, { ...none, coil: 1 }); t += 0.1; if (Math.abs(t - 2.5) < 0.05) window.__mid = true; } }, none); await snap(1, 'fish', 9, 5);
await page.evaluate((none) => { const g = window.__game, G = g.world.goal, dx = G.x - g.rig.pos.x, dz = G.z - g.rig.pos.z, d = Math.hypot(dx, dz); g.sim(3, { ...none, dir: { x: dx / d, y: 0, z: dz / d } }); }, none); await snap(2, 'fish', 10, 4, 2.4); await snap(3, 'fish', 7, 1.2, 0.3);
await page.evaluate((none) => { const g = window.__game, r = g.world.rift; g.rig.reset(g.rig.pos.clone().set(r.x, r.y + 1.5, r.z), 0); g.sim(1.4, none); }, none); await snap(4, 'rift', 12, 7, 1.0);
await browser.close(); server.close();
