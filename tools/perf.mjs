// Triangles and draw calls per band, and the time a frame takes in this (software) renderer, for comparing builds.
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
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.addInitScript(() => { window.__noNursery = true; });
await page.goto(`http://localhost:${server.address().port}/`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
for (const f of [0, 1, 2, 3, 4]) {
  const r = await page.evaluate(async (f) => {
    const g = window.__game; g.startRun(4242); if (f) g.enterFloor(f, false); g.run.safe = 1e9;
    g.renderer.info.autoReset = false;
    const t0 = performance.now(); g.sim(2, { dir: { x: 0.6, y: 0, z: 0.8 }, amount: 1, vertical: 0, sprint: false }); const simMs = (performance.now() - t0) / 120;
    g.renderer.info.reset(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const i = g.renderer.info;
    return { floor: f, tris: i.render.triangles, calls: i.render.calls, geometries: i.memory.geometries, stepMs: +simMs.toFixed(2) };
  }, f);
  console.log(JSON.stringify(r));
}
await browser.close(); server.close();
