// Photographs the nest (world.js, NEST) as it is at the start of a dive, for a given record: body, shells found, fragments hauled.
//   node tools/shot_nest.mjs [prefix] [segments] [shells] [fragments]     writes out/shots/<prefix>-<n>.png
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
const prefix = process.argv[2] || 'nest', record = +(process.argv[3] || 19), shells = (process.argv[4] || 'spire,fan,ring,cap,lamp').split(',').filter(Boolean), fragments = +(process.argv[5] || 3);
const out = (n) => path.resolve(import.meta.dirname, `../out/shots/${prefix}-${n}.png`);
fs.mkdirSync(path.resolve(import.meta.dirname, '../out/shots'), { recursive: true });
const page = await (await browser.newContext({ viewport: { width: 900, height: 600 } })).newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.addInitScript(() => { window.__noNursery = true; });
await page.goto(`http://localhost:${server.address().port}/`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.__ready === true', null, { timeout: 90000 });
const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
await page.evaluate(([record, shells, fragments]) => { window.__hold = true; const g = window.__game; Object.assign(g.nest, { record, shells, fragments }); g.startRun(4242); g.run.safe = 0; g.sim(3.8, { dir: null, amount: 0, vertical: 0, sprint: false }); }, [record, shells, fragments]);
await frame(); await page.screenshot({ path: out(0) });                                                                // as the dive opens, through the game's own camera
await page.addStyleTag({ content: '#stage > :not(canvas):not(#library) { display: none !important; }' });
// from `d` metres off at angle `a` round the start, `h` up, looking at a point `f` ahead of the start and `r` to its right
const snap = async (n, d, h, a, f = -1.5, r = 0.8) => { await page.evaluate(([d, h, a, f, r]) => { const g = window.__game, N = g.world.react.nest, yaw = N.yaw, x = N.x + Math.sin(yaw) * f + Math.cos(yaw) * r, z = N.z + Math.cos(yaw) * f - Math.sin(yaw) * r, y = g.world.height(x, z);
    g.sim(1 / 60, { dir: null, amount: 0, vertical: 0, sprint: false }); g.camera.fov = 38; g.camera.updateProjectionMatrix(); g.camera.position.set(x + Math.sin(yaw + a) * d, y + h, z + Math.cos(yaw + a) * d); g.camera.lookAt(x, y + 0.5, z); }, [d, h, a, f, r]);
  await frame(); await page.screenshot({ path: out(n) }); };
await snap(1, 9, 11, Math.PI);                 // from above and behind: the line on the left, the places on the right
await snap(2, 7, 2.6, -1.9, -1.5, 2.9);        // the places, from the fish's side
await snap(3, 6, 2.2, 1.9, -2.5, -1.25);       // the line, from outside it
await browser.close(); server.close();
