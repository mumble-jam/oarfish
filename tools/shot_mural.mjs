// Photographs the mural at a rift (world.js, MURAL): dark, part lit, and whole.
//   node tools/shot_mural.mjs [prefix] [band ...]     writes out/shots/<prefix>-<band>-<n>.png
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
const prefix = process.argv[2] || 'mural', bands = process.argv.slice(3).map(Number); if (!bands.length) bands.push(0);
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
// look at the mural's face from `d` metres in front of it, `h` up, `a` radians off square
const snap = async (n, d = 8, h = 2.4, a = 0) => { await page.evaluate(([d, h, a]) => { const g = window.__game, m = g.world.react.mural;
    g.run.safe = 0; g.sim(1 / 60, { dir: null, amount: 0, vertical: 0, sprint: false }); g.run.safe = 1e9; g.camera.fov = 38; g.camera.updateProjectionMatrix(); g.camera.position.set(m.cx + Math.sin(m.yaw + a) * d, m.y + h, m.cz + Math.cos(m.yaw + a) * d); g.camera.lookAt(m.cx, m.y + 1.6, m.cz); }, [d, h, a]);
  await frame(); await page.screenshot({ path: out(n) }); };
for (const band of bands) {
  await page.evaluate(([band, none]) => { window.__hold = true; const g = window.__game; g.startRun(4242); if (band) g.enterFloor(band, false); g.run.safe = 1e9;
    for (const list of [g.foes.biters, g.foes.anglers || []]) for (const b of list) { b.alive = false; if (b.mesh) b.mesh.visible = false; }
    const m = g.world.react.mural; g.rig.reset(g.rig.pos.clone().set(m.x + Math.sin(m.yaw + 0.5) * 5, m.y + 2.2, m.z + Math.cos(m.yaw + 0.5) * 5), m.yaw + Math.PI); g.sim(0.5, none); }, [band, none]);
  await snap(`${band}-0`);                                                                                            // nothing done yet
  await page.evaluate((none) => { const g = window.__game; g.world.react.earn('swarm'); g.world.react.earn('guard'); g.sim(2.5, none); }, none); await snap(`${band}-1`, 7, 2.2, 0.35);
  await page.evaluate((none) => { const g = window.__game; g.world.react.earn('cache'); g.sim(3, none); }, none); await snap(`${band}-2`, 11, 3.4, -0.5);
}
await browser.close(); server.close();
